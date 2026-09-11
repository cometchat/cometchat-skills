#!/usr/bin/env node
/**
 * verify-family-agnostic.mjs — the machine guard for RULES.md §22.
 *
 * The pack's tools are documented as "family-agnostic — copy them; a new family adds only
 * its typecheck/<family>/ + a --discover needle". Nothing enforced that claim, and eleven
 * separate tools drifted into hardcoding `web-v7` (AUDIT-091/087/088/090/091). Three of them
 * reported green while checking nothing.
 *
 * This fails the build when a family key appears as a literal in a tool that does not resolve
 * it from families.json. Allowed: a default read from families.json's own `default`, and the
 * families.json file itself.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FAMILIES = join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json");
if (!existsSync(FAMILIES)) { console.log("❌ families.json missing — cannot verify"); process.exit(2); }

const fams = JSON.parse(readFileSync(FAMILIES, "utf8")).families;
// Both the family keys and the registry/catalog basenames they imply are family identifiers.
const KEYS = [...new Set(Object.entries(fams).flatMap(([k, v]) =>
  [k, (v.catalog || "").replace(/^catalog\//, "").replace(/\.json$/, "")].filter(Boolean)))];

const TOOLS = [
  ...readdirSync(join(ROOT, "test-suite/scripts")).filter((f) => f.endsWith(".mjs")).map((f) => `test-suite/scripts/${f}`),
  ...(existsSync(join(ROOT, "bin")) ? readdirSync(join(ROOT, "bin")).filter((f) => f.endsWith(".mjs")).map((f) => `bin/${f}`) : []),
];

const SELF = "verify-family-agnostic.mjs";
const violations = [];
for (const rel of TOOLS) {
  if (rel.endsWith(SELF)) continue;
  const src = readFileSync(join(ROOT, rel), "utf8");
  const readsFamilies = src.includes("families.json");
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;              // comments may name families freely
    for (const k of KEYS) {
      if (!new RegExp(`["'\`]${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`).test(line)) continue;
      // a default sourced from families.json is legitimate
      if (readsFamilies && /families?\.default|DEFAULT_FAMILY/.test(line)) continue;
      violations.push({ rel, line: i + 1, key: k, text: line.trim().slice(0, 96), readsFamilies });
    }
  });
}

// ── §22b: PLATFORM-NEUTRAL surfaces must not name one family ────────────────
// The key-literal scan above passed while bin/ hardcoded "React v7 UI Kit" as the
// AGENTS.md title and the entry router sent every request to `cometchat-react-v7-*`
// — neither is a family KEY, so neither was seen. A React Native project got a
// router claiming it was React web, and the agent stopped trusting it (AUDIT-101).
// These files are read by EVERY family, so a family-specific literal is a defect.
const NEUTRAL = [
  ...(existsSync(join(ROOT, "bin")) ? readdirSync(join(ROOT, "bin")).filter((f) => f.endsWith(".mjs")).map((f) => `bin/${f}`) : []),
  "RULES.md",
  ...["cometchat", "cometchat-onboarding"].flatMap((d) => {
    const dir = join(ROOT, "skills", d);
    if (!existsSync(dir)) return [];
    const out = [`skills/${d}/SKILL.md`];
    const refs = join(dir, "references");
    if (existsSync(refs)) out.push(...readdirSync(refs).filter((f) => f.endsWith(".md")).map((f) => `skills/${d}/references/${f}`));
    return out.filter((f) => existsSync(join(ROOT, f)));
  }),
];
// Family identifiers that are NOT keys: the skill-dir prefix and the kit package.
const peersYaml = existsSync(join(ROOT, "peers.yaml")) ? readFileSync(join(ROOT, "peers.yaml"), "utf8") : "";
const MARKS = [...new Set([
  ...[...peersYaml.matchAll(/dir_prefix:\s*"([^"]+)"/g)].map((m) => m[1]),
  ...[...peersYaml.matchAll(/kit_package:\s*"([^"]+)"/g)].map((m) => m[1]),
])].filter(Boolean);
const FAMILY_NAMES = [...new Set([...peersYaml.matchAll(/dir_prefix:\s*"cometchat-([^"]+?)-?"/g)].map((m) => m[1]))].filter(Boolean);

// §22c: a reference that is PER-PLATFORM BY DESIGN may DECLARE itself.
// `skills/cometchat-onboarding/references/platforms.md` is a per-platform table/list whose whole
// job is one entry per shipped family — `lint-skills.mjs` GATE R (gateSharedSkillsCoverShippedFamilies)
// FAILS it when a shipped family has no column. So the two gates contradict on that file: one demands
// per-family content, the other forbids naming a single family. The escape is a DECLARED marker the
// file itself carries — never a filename hardcoded here — so the exemption is auditable, is printed
// on every run, and cannot be silently inherited by the next reference dropped into `references/`.
// It is not a blanket pass: a declaring file must name TWO OR MORE families overall, otherwise the
// marker is being used to smuggle a single-family document onto a platform-neutral surface.
const PER_PLATFORM_MARKER = /^\s*<!--\s*family-agnostic:\s*per-platform-by-design\b/m;
const declaredExempt = [];

for (const rel of NEUTRAL) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  if (PER_PLATFORM_MARKER.test(src)) {
    const namedInFile = FAMILY_NAMES.filter((f) => src.includes(f));
    if (namedInFile.length >= 2) { declaredExempt.push({ rel, families: namedInFile.length }); continue; }
    violations.push({
      rel, line: src.split("\n").findIndex((l) => PER_PLATFORM_MARKER.test(l)) + 1,
      key: "per-platform-by-design", readsFamilies: true, neutral: true,
      text: `declares the per-platform exemption but names ${namedInFile.length} family/families — the marker is for MULTI-family references only`,
    });
    continue;
  }
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*|>)/.test(line)) return;        // comments/quotes may name families
    if (/<family>/.test(line)) return;                      // already parameterised
    // Naming ONE family in a neutral file is the defect. A line that names TWO or more is
    // an explicit per-family branch ("react-v7: X; react-native: Y") — that is how a neutral
    // file legitimately documents a divergence, so allow it.
    const named = FAMILY_NAMES.filter((f) => line.includes(f));
    if (named.length >= 2) return;
    for (const mark of MARKS) {
      if (!line.includes(mark)) continue;
      violations.push({ rel, line: i + 1, key: mark, text: line.trim().slice(0, 96), readsFamilies: true, neutral: true });
    }
  });
}

// Declared exemptions PRINT on every run (pass or fail) so they cannot rot into silence.
for (const e of declaredExempt) {
  console.log(`ℹ️  per-platform-by-design (declared): ${e.rel} — exempt from the neutral scan; names ${e.families} families. GATE R (lint-skills) enforces its per-family coverage.`);
}

if (!violations.length) {
  console.log(`✅ family-agnostic: ${TOOLS.length} tool(s) scanned; no hardcoded family keys; ${NEUTRAL.length - declaredExempt.length} platform-neutral file(s) clean; ${declaredExempt.length} declared per-platform reference(s).`);
  process.exit(0);
}
console.log(`❌ family-agnostic: ${violations.length} hardcoded family key(s) — RULES.md §22.`);
console.log("   Every family-scoped path must come from families.json; a literal here means the");
console.log("   tool silently skips (or mis-attributes) every other family.\n");
for (const v of violations) {
  console.log(`   ${v.rel}:${v.line}  "${v.key}"${v.readsFamilies ? "" : "   (does not read families.json at all)"}`);
  console.log(`      ${v.text}`);
}
process.exit(1);
