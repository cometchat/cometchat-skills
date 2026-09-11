#!/usr/bin/env node
/**
 * verify-oracle-components.mjs — features.<family>.json `ui_components` must list only
 * components a HOST imports and writes in a template.
 *
 * `ui_components` drives the reviewer's G1 `mustUseComponents`, so a KIT-INTERNAL child
 * (a *-item inside its list, a singular *-bubble inside cometchat-message-bubble, a
 * keyboard/dialog inside the composer) makes the gate demand an import a CORRECT emit
 * must not have. That shipped in six features and cost a review tick each time.
 *
 * A component is kit-internal when BOTH hold:
 *   1. some OTHER kit component lists it in its own standalone `imports: []`, and
 *   2. no skill RECIPE writes its selector (catalog.md is excluded — that file is the
 *      complete EXISTENCE list, not a list of things a host emits).
 * Condition 2 is what keeps host-facing components that merely happen to be reused
 * inside another kit component (cometchat-message-list inside cometchat-ai-assistant-chat)
 * from being flagged.
 *
 * Usage: node test-suite/scripts/verify-oracle-components.mjs [--family angular-v5] [--json]
 * Exit:  0 clean · 1 kit-internal entries found · 2 bad invocation (kit not installed).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
if (!_f) { console.error(`unknown --family: ${FAMILY}`); process.exit(2); }
const _kitDir = (_f.catalog_build?.dirs || []).find((d) => /chat-uikit-/.test(d));
if (!_kitDir || !_f.features || !_f.skillDirPattern) {
  console.log(`⏭  verify-oracle-components [${FAMILY}]: family declares no kit dir / features / skillDirPattern — skipped`);
  process.exit(0);
}
const FAM = {
  features: _f.features,
  bundle: `${_kitDir}/fesm2022/${_f.kitPackage.replace(/^@/, "").replace("/", "-")}.mjs`,
  skillGlob: new RegExp(_f.skillDirPattern),
};

const bundlePath = join(ROOT, FAM.bundle);
if (!existsSync(bundlePath)) {
  // The review app is git-ignored, so this gate is a no-op in a clean checkout rather
  // than a false failure. It runs wherever the kit is installed (locally, and in CI once
  // the app is provisioned).
  console.log(`⏭  verify-oracle-components [${FAMILY}]: kit bundle not installed — skipped (not a failure)`);
  process.exit(0);
}
const bundle = readFileSync(bundlePath, "utf8");

const selectorOf = (c) =>
  (bundle.match(new RegExp(`type: ${c}, isStandalone: true, selector: "([a-z-]+)"`)) || [])[1] || null;

function kitParents(c) {
  const own = selectorOf(c);
  const re = /args: \[\{ selector: .([a-z-]+)., standalone: true, [^]{0,700}?imports: \[([^\]]*)\]/g;
  const out = new Set();
  let m;
  while ((m = re.exec(bundle))) {
    if (m[1] !== own && new RegExp(`\\b${c}\\b`).test(m[2])) out.add(m[1]);
  }
  return [...out];
}

// Every selector written in a skill RECIPE (catalog.md excluded).
function recipeSelectors() {
  const found = new Set();
  const skills = join(ROOT, "skills");
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith(".md") || e.name === "catalog.md") continue;
      // Only selectors inside a CODE FENCE count as "a recipe emits this". A prose
      // enumeration ("**Search** `<cometchat-search>` · `<cometchat-search-bar>` · …") is a
      // listing, like catalog.md, and counting it let three kit-internal search components
      // pass this gate — a false negative that then cost a review tick at G1.
      const txt = readFileSync(p, "utf8");
      for (const f of txt.matchAll(/```(?:html|ts|tsx|typescript)\n([\s\S]*?)```/g)) {
        for (const m of f[1].matchAll(/<(cometchat-[a-z-]+)\b/g)) found.add(m[1]);
      }
    }
  };
  for (const d of readdirSync(skills, { withFileTypes: true })) {
    if (d.isDirectory() && FAM.skillGlob.test(d.name)) walk(join(skills, d.name));
  }
  return found;
}

const recipes = recipeSelectors();
const features = JSON.parse(readFileSync(join(ROOT, FAM.features), "utf8")).features || [];
const offenders = [];
for (const f of features) {
  // `auto_rendered_ui: true` already tells compile-expect to demand NOTHING (the kit
  // renders it all), so listing the bubbles there is harmless documentation of what the
  // kit draws. The defect only bites when the entries are actually demanded.
  if (f.auto_rendered_ui) continue;
  for (const c of f.ui_components || []) {
    const sel = selectorOf(c);
    if (!sel) continue;                       // not a component (a formatter class etc.)
    if (recipes.has(sel)) continue;           // a recipe emits it → host-facing
    const parents = kitParents(c);
    if (parents.length) offenders.push({ feature: f.id, component: c, selector: sel, renderedBy: parents });
  }
}

if (JSON_OUT) { console.log(JSON.stringify({ ok: !offenders.length, offenders }, null, 0)); process.exit(offenders.length ? 1 : 0); }
if (!offenders.length) {
  console.log(`✅ verify-oracle-components [${FAMILY}]: every ui_components entry is host-facing.`);
  process.exit(0);
}
console.log(`❌ verify-oracle-components [${FAMILY}]: ${offenders.length} kit-internal component(s) listed as host imports:`);
for (const o of offenders) {
  console.log(`  - ${o.feature}: ${o.component} <${o.selector}> is rendered by ${o.renderedBy.join(", ")} — G1 will demand an import a correct emit must not have`);
}
process.exit(1);
