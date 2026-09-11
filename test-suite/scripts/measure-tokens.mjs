#!/usr/bin/env node
/**
 * measure-tokens.mjs — token-budget gate (dependency-free, no network).
 *
 * Entry cost is an adoption/conversion lever, not just efficiency (TOKEN-BUDGET.md):
 * the old mega-dispatcher cost ~49K tokens at entry on EVERY invocation. A thin
 * router is ~4–7K. This gate keeps a generated skill from silently regressing back
 * toward a fat entry by measuring the emitted skill against the recorded budget:
 *
 *   • ENTRY  — the SKILL.md a skill loads first (thin classifier + dispatch).
 *   • FULL   — SKILL.md + its references/*.md (the whole task's content-load).
 *
 * Budgets are READ from references/TOKEN-BUDGET.md (single source of truth), not
 * hardcoded here — if the doctrine changes the number, this gate follows. Today:
 *   Entry ≤ 5K tokens · full task ≤ 20K tokens.
 *
 * TOKEN ESTIMATE (heuristic — stated in the output, per TOKEN-BUDGET.md):
 *   chars / 4. TOKEN-BUDGET.md calls bytes/4 "a fine first estimate; confirm with a
 *   real BPE tokenizer (cl100k_base) for the gate." We keep this script DEPENDENCY-FREE
 *   (like every other test-suite/scripts/*.mjs — no tiktoken install), so it uses the
 *   documented chars/4 estimate and prints the heuristic on every run. It is a REAL
 *   gate on the estimate; when a BPE tokenizer is wired, swap `estimateTokens()` alone.
 *
 * Usage:
 *   node test-suite/scripts/measure-tokens.mjs [--skill <dir-or-name>] [--all] [--json] [--tolerance <pct>]
 *   --skill      measure one skill (dir path or bare name, e.g. cometchat-react-v7-core)
 *   --all        measure every skills/cometchat-* skill (default if no --skill)
 *   --tolerance  allowed % OVER the recorded budget before failing (default 0). Exists ONLY
 *                because the chars/4 heuristic OVERCOUNTS vs a real cl100k_base tokenizer for
 *                prose/code — a small slack keeps the estimate-based gate from red-flagging a
 *                skill that is actually within budget under a real tokenizer. Not a way to
 *                paper over a real regression: overage is ALWAYS printed, and the CI `verify`
 *                wiring runs at the recorded tolerance. Swap `estimateTokens()` for a BPE
 *                tokenizer and set tolerance 0 for the exact gate.
 * Exit:  0 all within (budget × 1+tolerance) · 1 one or more over · 2 bad invocation.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS_DIR = join(ROOT, "skills");
// react-v7 is maintained elsewhere; this repo owns the angular family + the shared skills.
// Unowned skills are still MEASURED and REPORTED (an overage stays visible, never hidden),
// but they do not fail the gate — a red CI on a family we cannot edit makes the green
// signal meaningless for the family we can.
const UNOWNED_FAMILY = /^cometchat-react-v7-/;
const BUDGET_DOC = join(ROOT, ".claude", "skills", "cometchat-skill-creator", "references", "TOKEN-BUDGET.md");
const JSON_OUT = process.argv.includes("--json");

// ── the heuristic (documented in the output) ─────────────────────────────────
const HEURISTIC = "chars/4 (dependency-free estimate; TOKEN-BUDGET.md — confirm with a cl100k_base BPE tokenizer for the hard gate)";
const estimateTokens = (text) => Math.ceil(text.length / 4);

// ── read the budget numbers from TOKEN-BUDGET.md (source of truth) ────────────
// Falls back to the doctrine defaults (5K / 20K) if the doc can't be parsed, so
// the gate still runs — but prefers the recorded numbers so it can't drift from doctrine.
function readBudgets() {
  const dflt = { entry: 5000, full: 20000, source: "default (5K/20K)" };
  if (!existsSync(BUDGET_DOC)) return dflt;
  const txt = readFileSync(BUDGET_DOC, "utf8");
  const kToN = (s) => Math.round(parseFloat(s) * 1000);
  // Tolerant of markdown emphasis around the numbers: "**Entry ≤ 5K tokens**",
  // "A full task with the skill ≤ 20K". Match "Entry … <N>K" and "full task … <N>K".
  const entryM = txt.match(/Entry[^\d\n]*?([\d.]+)\s*K/i);
  const fullM = txt.match(/full task[^\d\n]*?([\d.]+)\s*K/i);
  if (!entryM || !fullM) return dflt;
  return { entry: kToN(entryM[1]), full: kToN(fullM[1]), source: `TOKEN-BUDGET.md (${entryM[1]}K/${fullM[1]}K)` };
}

function walkMd(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function measureSkill(skillDir, budgets, tolerance) {
  const entryFile = join(skillDir, "SKILL.md");
  if (!existsSync(entryFile)) return null;

  const entryTokens = estimateTokens(readFileSync(entryFile, "utf8"));
  // FULL = entry + every reference the task can pull in (references/*.md).
  const refFiles = walkMd(join(skillDir, "references"));
  const fullText = [entryFile, ...refFiles].map((f) => readFileSync(f, "utf8")).join("\n");
  const fullTokens = estimateTokens(fullText);

  // The fail threshold is the recorded budget grown by the tolerance (0 by default).
  const entryLimit = Math.round(budgets.entry * (1 + tolerance));
  const fullLimit = Math.round(budgets.full * (1 + tolerance));
  const entryOver = entryTokens > entryLimit;
  const fullOver = fullTokens > fullLimit;
  return {
    skill: basename(skillDir),
    entryTokens, fullTokens,
    entryBudget: budgets.entry, fullBudget: budgets.full,
    refFiles: refFiles.length,
    entryOver, fullOver, ok: !entryOver && !fullOver,
  };
}

function resolveSkillArg(arg) {
  if (existsSync(arg) && statSync(arg).isDirectory()) return arg;
  const inSkills = join(SKILLS_DIR, arg);
  if (existsSync(inSkills)) return inSkills;
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const budgets = readBudgets();
  const one = argv.includes("--skill") ? argv[argv.indexOf("--skill") + 1] : null;
  const tolerance = argv.includes("--tolerance") ? (parseFloat(argv[argv.indexOf("--tolerance") + 1]) || 0) / 100 : 0;

  let dirs = [];
  if (one) {
    const d = resolveSkillArg(one);
    if (!d) { console.error(`skill not found: ${one}`); process.exit(2); }
    dirs = [d];
  } else {
    if (!existsSync(SKILLS_DIR)) { console.error("no skills/ dir"); process.exit(2); }
    dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("cometchat-") && e.name !== "cometchat")
      .map((e) => join(SKILLS_DIR, e.name));
  }

  const results = dirs.map((d) => measureSkill(d, budgets, tolerance)).filter(Boolean)
    .map((r) => ({ ...r, unowned: UNOWNED_FAMILY.test(r.skill) }));
  const over = results.filter((r) => !r.ok && !r.unowned);
  const overUnowned = results.filter((r) => !r.ok && r.unowned);
  const ok = over.length === 0;

  if (JSON_OUT) {
    console.log(JSON.stringify({ ok, heuristic: HEURISTIC, budgets, tolerancePct: tolerance * 100, results, overUnowned: overUnowned.map((r) => r.skill) }, null, 0));
    process.exit(ok ? 0 : 1);
  }

  const tolNote = tolerance ? ` · tolerance +${tolerance * 100}% (heuristic overcount slack)` : "";
  console.log(`measure-tokens: budget ${budgets.source} · estimate = ${HEURISTIC}${tolNote}`);
  const fmt = (n) => n.toLocaleString("en-US");
  for (const r of results) {
    const e = r.entryOver ? "❌" : "✅";
    const f = r.fullOver ? "❌" : "✅";
    console.log(`  ${r.ok ? "✅" : r.unowned ? "➖" : "⚠️ "} ${r.skill}${r.unowned && !r.ok ? "   (not owned here — reported, not gated)" : ""}`);
    console.log(`       ${e} entry ${fmt(r.entryTokens)} / ${fmt(r.entryBudget)}   ${f} full ${fmt(r.fullTokens)} / ${fmt(r.fullBudget)}  (${r.refFiles} ref file(s))`);
  }
  if (overUnowned.length) {
    console.log(`\n➖ token-budget: ${overUnowned.length} skill(s) over budget in a family this repo does NOT own — reported, not gated:`);
    for (const r of overUnowned) {
      if (r.entryOver) console.log(`  - ${r.skill}: ENTRY ${fmt(r.entryTokens)} > ${fmt(r.entryBudget)}`);
      if (r.fullOver) console.log(`  - ${r.skill}: FULL ${fmt(r.fullTokens)} > ${fmt(r.fullBudget)}`);
    }
  }
  if (ok) {
    console.log(`✅ token-budget: ${results.length - overUnowned.length} owned skill(s) within budget (entry ≤ ${fmt(budgets.entry)}, full ≤ ${fmt(budgets.full)}).`);
  } else {
    console.log(`\n❌ token-budget: ${over.length}/${results.length} skill(s) OVER budget — push detail into references/ (TOKEN-BUDGET.md levers):`);
    for (const r of over) {
      if (r.entryOver) console.log(`  - ${r.skill}: ENTRY ${fmt(r.entryTokens)} > ${fmt(r.entryBudget)} (thin the entry — dominant lever)`);
      if (r.fullOver) console.log(`  - ${r.skill}: FULL ${fmt(r.fullTokens)} > ${fmt(r.fullBudget)} (split references / bake less, fetch more)`);
    }
  }
  process.exit(ok ? 0 : 1);
}

main();
