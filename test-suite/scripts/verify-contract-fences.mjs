#!/usr/bin/env node
/**
 * verify-contract-fences.mjs — the machine guard for RULES.md §23.
 *
 * An agent copies CODE FENCES, not prose and not tables. A skill can name a mandated component
 * in a capability table, warn about it in prose, and still emit a surface without it — because
 * the fence the agent actually copies never showed it. That is AUDIT-098: core's fence stopped
 * at `onThreadRepliesPress` / `onSearchBarClicked` and never showed the screens those callbacks
 * push, so every emit shipped 75% of core-chat-surface and G1 failed three times.
 *
 * SCOPE — contract-backed features ONLY. The pack is deliberately bake-the-hot-path /
 * fetch-the-long-tail: most features' `ui_components` are legitimately fetched from docs and
 * MUST NOT be baked. But a feature carrying a CONTRACT in contracts.<family>.json is the
 * guaranteed minimum every emit must contain — so those components have to be shown, not
 * merely named. It catches the class statically: no reviewer run, no credentials, no simulator.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FAMILIES = join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json");
if (!existsSync(FAMILIES)) { console.log("❌ families.json missing"); process.exit(2); }
const { families } = JSON.parse(readFileSync(FAMILIES, "utf8"));

const walk = (d, acc = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (e.endsWith(".md")) acc.push(p);
  }
  return acc;
};
const fencesOf = (text) => {
  const out = [];
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) out.push(line);
  }
  return out.join("\n");
};

let checked = 0, failures = [], baselined = [];
for (const [key, fam] of Object.entries(families)) {
  if (/^template\b/i.test(fam._status || "")) continue;
  const name = basename(fam.catalog || "", ".json");
  const featPath = join(ROOT, fam.features || `features.${name}.json`);
  const conPath = join(ROOT, fam.contracts || `contracts.${name}.json`);
  if (!existsSync(featPath) || !existsSync(conPath)) continue;
  const feats = JSON.parse(readFileSync(featPath, "utf8")).features || [];
  // Only features that carry a `kind: "feature"` contract — the guaranteed minimum.
  const contracted = new Set(
    (JSON.parse(readFileSync(conPath, "utf8")).contracts || [])
      .filter((c) => c.kind === "feature").map((c) => c.for));

  // the skills belonging to this family
  const prefixes = (fam.reviewsSkills || []).filter((p) => p.endsWith("-"));
  const dir = join(ROOT, "skills");
  const mine = readdirSync(dir).filter((s) => prefixes.some((p) => s.startsWith(p)));
  if (!mine.length) continue;
  const fenceText = mine.flatMap((s) => walk(join(dir, s))).map((f) => fencesOf(readFileSync(f, "utf8"))).join("\n");

  for (const feat of feats) {
    if (!contracted.has(feat.id)) continue;   // long tail is fetched from docs, by design
    const comps = feat.ui_components || [];
    if (!comps.length) continue;
    if (feat.auto_rendered_ui) continue;       // kit renders it internally — no client code to show
    checked++;
    let missing = comps.filter((c) => !new RegExp(`\\b${c}\\b`).test(fenceText));
    // A baselined entry is a RECORDED ARTIFACT CONFLICT, not an exemption: it still prints on
    // every run so it cannot rot into silence. Never extend it to quiet a NEW failure.
    const base = (fam.fenceBaseline || {})[feat.id] || [];
    const waived = missing.filter((c) => base.includes(c));
    missing = missing.filter((c) => !base.includes(c));
    if (waived.length) baselined.push({ family: name, feature: feat.id, waived });
    if (missing.length) failures.push({ family: name, feature: feat.id, missing, total: comps.length });
  }
}

if (!checked) { console.log("❌ contract-fences: no features checked — discovery broke"); process.exit(2); }
for (const b of baselined) {
  console.log(`⚠️  contract-fences: ${b.family} · ${b.feature} — baselined artifact conflict: ${b.waived.join(", ")}`);
  console.log(`    (contracts.json mandates it; the skill routes it to FETCH — one of the two is wrong. See families.json fenceBaseline._reason.)`);
}
if (!failures.length) { console.log(`✅ contract-fences: ${checked} feature(s) checked; every declared ui_component appears in a code fence${baselined.length ? ` (${baselined.length} baselined conflict(s) above)` : ""}.`); process.exit(0); }

console.log(`❌ contract-fences: ${failures.length}/${checked} feature(s) declare a component no code fence shows — RULES.md §23.`);
console.log("   Prose and capability tables do not survive into an emit; the agent copies fences.\n");
for (const f of failures) {
  console.log(`   ${f.family} · ${f.feature}  (${f.total - f.missing.length}/${f.total} shown)`);
  console.log(`      never in a fence: ${f.missing.join(", ")}`);
}
process.exit(1);
