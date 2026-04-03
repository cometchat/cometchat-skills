#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

// ── Lazy-load optional deps ───────────────────────────────────────────────────
function tryRequire(name) {
  try { return require(name); } catch { return null; }
}

const chalk = tryRequire("chalk");
const ora = tryRequire("ora");

const c = {
  bold:   (s) => chalk ? chalk.bold(s)   : s,
  cyan:   (s) => chalk ? chalk.cyan(s)   : s,
  green:  (s) => chalk ? chalk.green(s)  : s,
  yellow: (s) => chalk ? chalk.yellow(s) : s,
  gray:   (s) => chalk ? chalk.gray(s)   : s,
  red:    (s) => chalk ? chalk.red(s)    : s,
  dim:    (s) => chalk ? chalk.dim(s)    : s,
};

// ── Skills registry ───────────────────────────────────────────────────────────
const SKILLS_SRC_DIR = path.join(__dirname, "..", "skills");

const SKILLS = [
  {
    name: "cometchat",
    description: "Entry point — auto-detects your platform and guides the integration",
  },
  {
    name: "cometchat-react-core",
    description: "Shared rules for all React integrations (init order, auth, CSS, SSR)",
  },
  {
    name: "cometchat-react-reactjs",
    description: "React.js / Vite / CRA",
  },
  {
    name: "cometchat-react-nextjs",
    description: "Next.js — App Router or Pages Router",
  },
  {
    name: "cometchat-react-react-router",
    description: "React Router v6 / v7",
  },
  {
    name: "cometchat-react-astro",
    description: "Astro — React islands with client:only",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── IDE target directories ────────────────────────────────────────────────────
const IDE_TARGETS = {
  claude:      { local: ".claude/skills",  global: path.join(os.homedir(), ".claude", "skills"),  skillFile: "SKILL.md" },
  // Cursor loads agent "skills" from `.cursor/skills/` (not `.cursor/rules/`).
  cursor:      { local: ".cursor/skills",  global: path.join(os.homedir(), ".cursor", "skills"),  skillFile: "SKILL.md" },
  kiro:        { local: ".kiro/skills",     global: path.join(os.homedir(), ".kiro", "skills"),    skillFile: "SKILL.md" },
  copilot:     { local: ".github",          global: null,                                          skillFile: null },  // single-file mode
};

// Each skill is installed as <base>/<name>/SKILL.md (or concatenated for copilot)
function installSkill(skill, baseDir, skillFile) {
  const src = path.join(SKILLS_SRC_DIR, skill.name, "SKILL.md");
  const skillDir = path.join(baseDir, skill.name);
  ensureDir(skillDir);
  const dest = path.join(skillDir, skillFile);
  fs.copyFileSync(src, dest);
  return dest;
}

function installCopilotSkills(baseDir) {
  ensureDir(baseDir);
  const dest = path.join(baseDir, "copilot-instructions.md");
  let content = "# CometChat Skills\n\n";
  for (const skill of SKILLS) {
    const src = path.join(SKILLS_SRC_DIR, skill.name, "SKILL.md");
    content += fs.readFileSync(src, "utf8") + "\n\n---\n\n";
  }
  fs.writeFileSync(dest, content, "utf8");
  return dest;
}

function printHelp() {
  console.log(`
  ${c.bold("cometchat-skills")} — Install CometChat AI coding skills

  ${c.bold("Usage:")}
    ${c.cyan("npx cometchat-skills add")}                    Install for Claude Code (default)
    ${c.cyan("npx cometchat-skills add --ide cursor")}       Install for Cursor
    ${c.cyan("npx cometchat-skills add --ide kiro")}         Install for Kiro
    ${c.cyan("npx cometchat-skills add --ide copilot")}      Install for VS Code Copilot
    ${c.cyan("npx cometchat-skills add --ide all")}          Install for all supported IDEs
    ${c.cyan("npx cometchat-skills add --global")}           Install globally
    ${c.cyan("npx cometchat-skills add --list")}             Show available skills

  ${c.bold("Supported IDEs:")} claude, cursor, kiro, copilot, all

  ${c.bold("After installing, open your project in your IDE and run:")}
    ${c.cyan("/cometchat")}
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(0);
  }

  if (cmd !== "add") {
    console.error(c.red(`\n  Unknown command: ${cmd}`));
    printHelp();
    process.exit(1);
  }

  const isGlobal = args.includes("--global") || args.includes("-g");
  const listOnly = args.includes("--list") || args.includes("-l");
  const ideIdx = args.indexOf("--ide");
  const ideArg = ideIdx !== -1 ? args[ideIdx + 1] : "claude";

  if (listOnly) {
    console.log(`\n  ${c.bold("Available skills:")}\n`);
    for (const s of SKILLS) {
      console.log(`  ${c.cyan(s.name)}`);
      console.log(`    ${c.dim(s.description)}\n`);
    }
    process.exit(0);
  }

  const targets = ideArg === "all" ? Object.keys(IDE_TARGETS) : [ideArg];

  for (const ide of targets) {
    const target = IDE_TARGETS[ide];
    if (!target) {
      console.error(c.red(`\n  Unknown IDE: ${ide}. Valid: ${Object.keys(IDE_TARGETS).join(", ")}, all`));
      process.exit(1);
    }

    if (isGlobal && !target.global) {
      console.log(`\n  ${c.yellow("⚠")} ${ide} does not support global install — skipping.`);
      continue;
    }

    const baseDir = isGlobal ? target.global : path.join(process.cwd(), target.local);
    const scopeLabel = isGlobal
      ? `global  ${c.gray(`(${target.global}/`)}`
      : `local   ${c.gray(`(${target.local}/)`)}`;

    console.log(`\n  ${c.bold(c.cyan("CometChat Skills"))}  —  ${ide} integration\n`);
    console.log(`  Scope: ${scopeLabel}\n`);

    ensureDir(baseDir);

    if (ide === "copilot") {
      const spinner = ora ? ora({ text: "copilot-instructions.md", prefixText: "  " }).start() : null;
      try {
        const dest = installCopilotSkills(baseDir);
        if (spinner) spinner.succeed(c.green("✓ ") + c.bold("copilot-instructions.md") + `  ${c.dim("All skills concatenated")}`);
        else console.log(`  ✓ copilot-instructions.md`);
      } catch (err) {
        if (spinner) spinner.fail(c.red(`✗ copilot-instructions.md: ${err.message}`));
        else console.error(`  ✗ copilot-instructions.md: ${err.message}`);
      }
    } else {
      for (const skill of SKILLS) {
        const spinner = ora ? ora({ text: skill.name, prefixText: "  " }).start() : null;
        try {
          installSkill(skill, baseDir, target.skillFile);
          if (spinner) spinner.succeed(c.green("✓ ") + c.bold(skill.name) + `  ${c.dim(skill.description)}`);
          else console.log(`  ✓ ${skill.name}`);
        } catch (err) {
          if (spinner) spinner.fail(c.red(`✗ ${skill.name}: ${err.message}`));
          else console.error(`  ✗ ${skill.name}: ${err.message}`);
        }
      }
    }
  }

  console.log(`\n  ${c.bold("Done.")} Open your project in your IDE and run:\n`);
  console.log(`    ${c.cyan("/cometchat")}\n`);
}

main().catch((err) => {
  console.error(chalk ? chalk.red(`\n  Error: ${err.message}`) : `\n  Error: ${err.message}`);
  process.exit(1);
});
