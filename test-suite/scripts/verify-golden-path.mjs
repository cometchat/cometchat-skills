#!/usr/bin/env node
/**
 * verify-golden-path.mjs — compile a skill's RECIPE as a real Angular component.
 *
 * The gap this closes: `verify:fences` type-checks ts fences in isolation, and
 * `verify:templates` checks that a template's selectors/bindings EXIST. Neither ever
 * type-checks an html fence's bindings AGAINST the ts fence that backs it. So a recipe
 * could declare `selectedUser: CometChat.User | null` and bind it to the kit's
 * `user?: CometChat.User`, and every gate stayed green while the recipe failed
 * `ng build` with 8× TS2322 in any stock Angular app (strictTemplates is on by default).
 * That shipped in the always-loaded core golden path — the first thing a new user runs.
 *
 * It pairs a `templateUrl:`-bearing ts fence with the html fence that follows it (plus an
 * optional css fence), writes them as a component into the review app, and runs the real
 * Angular compiler over the whole app.
 *
 * Usage: node test-suite/scripts/verify-golden-path.mjs [--family angular-v5] [--json]
 * Exit:  0 clean (or skipped — app absent) · 1 a recipe does not compile · 2 bad usage.
 */
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// RULES.md §22 — every family-scoped path comes from families.json; a literal family key
// here means the tool silently skips (or mis-attributes) every other family.
const FAMILIES = JSON.parse(readFileSync(
  join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json"), "utf8")).families;
// families.json is keyed by review key (web-angular-v5); tools take the catalog key
// (angular-v5). Resolve either, so --family angular-v5 and --family web-angular-v5 both work.
function resolveFamily(key) {
  const byCatalog = Object.values(FAMILIES).find(
    (f) => (f.catalog || "").replace(/^catalog\//, "").replace(/\.json$/, "") === key);
  return FAMILIES[key] || byCatalog || null;
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const JSON_OUT = process.argv.includes("--json");
// RULES.md §22: no literal family key, not even as a default — the caller names the family
const FAMILY = arg("--family");
if (!FAMILY) { console.error("--family is required (see families.json)"); process.exit(2); }

const _f = resolveFamily(FAMILY);
if (!_f) { console.error(`unknown --family: ${FAMILY} (known: ${Object.keys(FAMILIES).join(", ")})`); process.exit(2); }
if (!_f.appDir || !_f.skillDirPattern) {
  console.log(`⏭  verify-golden-path [${FAMILY}]: family declares no appDir/skillDirPattern — skipped`);
  process.exit(0);
}
const FAM = { app: _f.appDir, skillDir: new RegExp(_f.skillDirPattern) };

const app = join(ROOT, FAM.app);
if (!existsSync(join(app, "node_modules", "@cometchat"))) {
  console.log(`⏭  verify-golden-path [${FAMILY}]: review app not provisioned — skipped (not a failure)`);
  process.exit(0);
}

// Collect (ts, html, css?) recipe triples from every skill markdown.
function recipes() {
  const out = [];
  const skills = join(ROOT, "skills");
  const walk = (d, skill) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p, skill); continue; }
      if (!e.name.endsWith(".md")) continue;
      const txt = readFileSync(p, "utf8");
      // Fences in document order, so an html fence can be matched to the ts fence above it.
      const fences = [...txt.matchAll(/```(ts|html|css)\n([\s\S]*?)```/g)]
        .map((m) => ({ lang: m[1], body: m[2] }));
      for (let i = 0; i < fences.length; i++) {
        if (fences[i].lang !== "ts" || !/templateUrl:/.test(fences[i].body)) continue;
        const html = fences.slice(i + 1).find((f) => f.lang === "html");
        if (!html) continue;
        const css = fences.slice(i + 1).find((f) => f.lang === "css");
        out.push({ file: `${skill}/${e.name}`, ts: fences[i].body, html: html.body, css: css ? css.body : "" });
      }
    }
  };
  for (const d of readdirSync(join(skills), { withFileTypes: true })) {
    if (d.isDirectory() && FAM.skillDir.test(d.name)) walk(join(skills, d.name), d.name);
  }
  return out;
}

const found = recipes();
const stage = join(app, "src", "app", "__goldenpath__");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const written = [];
found.forEach((r, n) => {
  const dir = join(stage, `r${n}`);
  mkdirSync(dir, { recursive: true });
  // Point the component at the files we write beside it, whatever the recipe named them.
  const ts = r.ts
    .replace(/templateUrl:\s*'[^']*'/, "templateUrl: './tpl.html'")
    .replace(/styleUrls?:\s*\[[^\]]*\]/, "styleUrl: './tpl.css'")
    .replace(/styleUrl:\s*'[^']*'/, "styleUrl: './tpl.css'");
  writeFileSync(join(dir, "cmp.ts"), ts);
  writeFileSync(join(dir, "tpl.html"), r.html);
  writeFileSync(join(dir, "tpl.css"), r.css);
  written.push({ index: n, file: r.file });
});

const res = spawnSync("npx", ["ng", "build", "--configuration", "development"], { cwd: app, encoding: "utf8" });
const out = (res.stdout || "") + (res.stderr || "");
rmSync(stage, { recursive: true, force: true });

// Attribute each error block back to the recipe whose staged dir it names.
const lines = out.split("\n");
const isHead = (l) => /error TS\d+/.test(l) || /\[ERROR\]/.test(l);
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  if (!isHead(lines[i])) continue;
  const parts = [lines[i].trim()];
  for (let j = i + 1; j < lines.length && !isHead(lines[j]); j++) {
    if (!lines[j].trim()) { if (j + 1 < lines.length && /^\s+\S/.test(lines[j + 1])) continue; break; }
    if (!/^\s+\S/.test(lines[j])) break;
    parts.push(lines[j].trim());
  }
  blocks.push(parts.join(" "));
}
const mine = blocks.filter((b) => b.includes("__goldenpath__"));
const attributed = mine.map((b) => {
  const m = b.match(/__goldenpath__\/r(\d+)\//);
  const rec = m ? written.find((w) => w.index === Number(m[1])) : null;
  return { recipe: rec ? rec.file : "(unknown)", error: b.slice(0, 240) };
});

if (JSON_OUT) { console.log(JSON.stringify({ ok: !attributed.length, recipes: written.length, errors: attributed }, null, 0)); process.exit(attributed.length ? 1 : 0); }
if (!attributed.length) {
  console.log(`✅ verify-golden-path [${FAMILY}]: ${written.length} recipe(s) compile as real components (template bindings type-checked against their own class).`);
  process.exit(0);
}
console.log(`❌ verify-golden-path [${FAMILY}]: ${attributed.length} error(s) — a documented recipe does not compile:`);
for (const a of attributed) console.log(`  [${a.recipe}] ${a.error}`);
process.exit(1);
