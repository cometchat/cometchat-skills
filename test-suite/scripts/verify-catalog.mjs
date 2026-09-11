#!/usr/bin/env node
/**
 * verify-catalog.mjs — Tier-1 existence oracle (dependency-free, no network).
 *
 * The anti-hallucination gate (RULES.md §8): every `CometChat*` symbol the skills
 * put in a CODE FENCE must exist in the family catalog (the public export surface
 * of the pinned kit). A symbol that isn't in the catalog is a phantom — it will
 * fail compile in the user's project. This tier catches it for ~0 cost, offline.
 *
 * FAMILY-DRIVEN (multi-family pack): UIKIT_FAMILIES + SDK_SKILLS below are the only
 * places a new family is added.
 *
 * What it checks (per UI-Kit family):
 *   • HARD (exit 1): every `CometChat*` token inside a code fence in the family's
 *     skill markdown exists in that family's catalog.
 *   • SOFT (warn):   `CometChat*` tokens that appear only in prose (not in a fence)
 *     and aren't in the catalog. Known-intentional mentions (migration removed-symbols,
 *     phantom "never emit" warnings, non-kit names) are allowlisted per family
 *     (EXPECTED_PROSE, AUDIT-032); only UNEXPECTED prose-only tokens are surfaced.
 *   • DRIFT guard:   each shipped catalog (test-suite/catalogs/<key>.json) must match
 *     the reviewer's G0 oracle (.claude/.../tools/catalog/<key>.json) symbol for
 *     symbol — two copies that diverge is the AUDIT-008/012 failure mode.
 *     WARN by default; --strict-drift makes it exit 1 (use in CI).
 *
 * Usage: node test-suite/scripts/verify-catalog.mjs [--json] [--strict-drift]
 * Exit:  0 clean · 1 phantom(s) or strict-drift · 2 bad invocation.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS_DIR = join(ROOT, "skills");
const JSON_OUT = process.argv.includes("--json");
const STRICT_DRIFT = process.argv.includes("--strict-drift");

const SYMBOL_RE = /\bCometChat[A-Za-z0-9_]*/g;
// One fence regex across families — a web skill has no kotlin fences and vice versa,
// so the union is harmless and keeps the scan single-pass.
const FENCE_RE = /```(?:tsx?|jsx?|typescript|javascript|kotlin|java|groovy|xml)[^\n]*\n([\s\S]*?)```/g;

// ── Derive family tables from families.json (RULES.md §22) ───────────────────
// The reviewer oracle is DEV-ONLY and NOT in the npm tarball (package.json "files").
// Running `cometchat verify catalog` from an installed pack must skip cleanly, not ENOENT.
const _FAM_PATH = join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json");
if (!existsSync(_FAM_PATH)) {
  console.log("catalog: reviewer oracle (families.json) not present — dev-only gate, skipping (installed pack).");
  process.exit(0);
}
const { families: FAM_DATA } = JSON.parse(readFileSync(_FAM_PATH, "utf8"));

// UI-Kit families: skill-name glob → {catalog key, extra catalogs to union in}.
// Derived from families.json: non-parked, non-template, non-headless families.
// Android Kotlin fences mix UI-kit + SDK symbols (SDK is a transitive dep of the kit),
// so their existence oracle is the UNION of the kit catalog + the SDK catalog;
// extraCatalogs in families.json carries those extra paths.
const UIKIT_FAMILIES = Object.fromEntries(
  Object.values(FAM_DATA)
    .filter((f) => !f.parked && !/^template/i.test(f._status || "") && f.surface !== "headless" && f.surface !== "static")
    .map((f) => {
      const catBase = (f.catalog || "").replace(/^catalog\//, "").replace(/\.json$/, "");
      if (!catBase) return null;
      const prefix = (f.reviewsSkills || []).find((p) => p.endsWith("-"));
      if (!prefix) return null;
      const alsoCatalogs = (f.extraCatalogs || []).map((p) => p.replace(/^catalog\//, "").replace(/\.json$/, ""));
      return [catBase, { glob: new RegExp("^" + prefix), alsoCatalogs }];
    })
    .filter(Boolean)
);

// SDK families (NAMESPACE shape): skill dir → catalog key.
// Derived from families.json sdkSkill/sdkCatalog fields.
const SDK_SKILLS = Object.fromEntries(
  Object.values(FAM_DATA)
    .filter((f) => f.sdkSkill && f.sdkCatalog)
    // extraCatalogs unioned in too (like UIKIT_FAMILIES): an SDK skill legitimately
    // names cross-package/native symbols (chat SDK under the calls SDK, a native
    // service class) — real, not phantoms. Data-driven, not special-cased.
    .map((f) => [f.sdkSkill, {
      cat: f.sdkCatalog,
      extra: (f.extraCatalogs || []).map((p) => p.replace(/^catalog\//, "").replace(/\.json$/, "")),
    }])
);

// AUDIT-032: known-intentional prose mentions, per family, stored in families.json
// as `expectedProseAllowlist` arrays. Fence usage is still HARD-blocked; this governs
// only the SOFT prose warning.
const EXPECTED_PROSE = Object.fromEntries(
  Object.values(FAM_DATA)
    .filter((f) => f.catalog && Array.isArray(f.expectedProseAllowlist))
    .map((f) => [
      (f.catalog || "").replace(/^catalog\//, "").replace(/\.json$/, ""),
      new Set(f.expectedProseAllowlist),
    ])
);
function loadSymbols(p) {
  if (!existsSync(p)) return null;
  const j = JSON.parse(readFileSync(p, "utf8"));
  return new Set(j.symbols || []);
}

function walkMd(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function tokensIn(text) {
  return new Set((text.match(SYMBOL_RE) || []).filter((t) => t !== "CometChat"));
}

function main() {
  const out = { ok: true, families: {}, sdk: {}, drift: {} };
  let hardFail = false;

  // ── UI-Kit families: fence phantoms + prose warnings ──────────────────────
  for (const [family, cfg] of Object.entries(UIKIT_FAMILIES)) {
    const catalog = loadSymbols(join(ROOT, "test-suite", "catalogs", `${family}.json`));
    if (!catalog) { console.error(`missing catalog: test-suite/catalogs/${family}.json (run npm run catalog:refresh)`); process.exit(2); }
    for (const extra of cfg.alsoCatalogs || []) {
      const s = loadSymbols(join(ROOT, "test-suite", "catalogs", `${extra}.json`));
      if (s) for (const sym of s) catalog.add(sym);
    }
    const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && cfg.glob.test(d.name))
      .map((d) => join(SKILLS_DIR, d.name));
    const files = [];
    for (const d of skillDirs) if (existsSync(d)) walkMd(d, files);

    const fencePhantoms = new Map();
    const proseOnly = new Map();
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const fenceText = [...src.matchAll(FENCE_RE)].map((m) => m[1]).join("\n");
      const fenceToks = tokensIn(fenceText);
      const allToks = tokensIn(src);
      for (const t of fenceToks) {
        if (!catalog.has(t)) {
          if (!fencePhantoms.has(t)) fencePhantoms.set(t, []);
          fencePhantoms.get(t).push(f.replace(ROOT + "/", ""));
        }
      }
      for (const t of allToks) {
        if (!catalog.has(t) && !fenceToks.has(t)) {
          if (!proseOnly.has(t)) proseOnly.set(t, []);
          proseOnly.get(t).push(f.replace(ROOT + "/", ""));
        }
      }
    }

    const expected = EXPECTED_PROSE[family] || new Set();
    const phantomList = [...fencePhantoms.entries()].map(([sym, fs]) => ({ symbol: sym, files: [...new Set(fs)] }));
    const unexpectedProse = [...proseOnly.keys()].filter((t) => !expected.has(t));
    if (phantomList.length) hardFail = true;
    out.families[family] = {
      catalogSymbols: catalog.size, filesScanned: files.length,
      fencePhantoms: phantomList, proseOnlyUnexpected: unexpectedProse,
      proseOnlyExpected: [...proseOnly.keys()].filter((t) => expected.has(t)),
    };
  }


  // ── SDK families (NAMESPACE shape) — check headless SDK skill(s) against THEIR catalog ──
  // SDK_SKILLS is derived from families.json at module level (RULES.md §22).
  const NS_RE = /CometChat\.([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const [dir, { cat: catKey, extra }] of Object.entries(SDK_SKILLS)) {
    const sdir = join(SKILLS_DIR, dir);
    if (!existsSync(sdir)) continue;
    const scat = loadSymbols(join(ROOT, "test-suite", "catalogs", catKey + ".json"));
    if (!scat) { console.error(`missing SDK catalog: ${catKey}.json`); continue; }
    for (const ex of extra || []) {
      const s = loadSymbols(join(ROOT, "test-suite", "catalogs", ex + ".json"));
      if (s) for (const sym of s) scat.add(sym);
    }
    const sdkPhantoms = new Map();
    let sdkFiles = 0;
    for (const f of walkMd(sdir, [])) {
      sdkFiles++;
      const fenceText = [...readFileSync(f, "utf8").matchAll(FENCE_RE)].map((m) => m[1]).join("\n");
      const toks = new Set([...fenceText.matchAll(NS_RE)].map((m) => m[1]));
      for (const t of tokensIn(fenceText)) if (t !== "CometChat") toks.add(t);
      for (const t of toks) {
        if (!scat.has(t)) { if (!sdkPhantoms.has(t)) sdkPhantoms.set(t, []); sdkPhantoms.get(t).push(f.replace(ROOT + "/", "")); }
      }
    }
    const list = [...sdkPhantoms.entries()].map(([sym, fs]) => ({ symbol: sym, files: [...new Set(fs)] }));
    if (list.length) hardFail = true;
    out.sdk[dir] = { catalog: catKey, filesScanned: sdkFiles, fencePhantoms: list };
  }

  // ── Drift guard: every shipped catalog vs the reviewer's G0 oracle copy ───
  for (const key of readdirSync(join(ROOT, "test-suite", "catalogs")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))) {
    const shipped = loadSymbols(join(ROOT, "test-suite", "catalogs", `${key}.json`));
    const reviewer = loadSymbols(join(ROOT, ".claude", "skills", "cometchat-skill-reviewer", "tools", "catalog", `${key}.json`));
    if (!shipped || !reviewer) continue;
    const onlyShipped = [...shipped].filter((s) => !reviewer.has(s));
    const onlyReviewer = [...reviewer].filter((s) => !shipped.has(s));
    if (onlyShipped.length || onlyReviewer.length) {
      out.drift[key] = { onlyShipped, onlyReviewer };
      if (STRICT_DRIFT) hardFail = true;
    }
  }

  out.ok = !hardFail;
  if (JSON_OUT) { console.log(JSON.stringify(out)); process.exit(hardFail ? 1 : 0); }

  for (const [family, r] of Object.entries(out.families)) {
    console.log(`verify-catalog [${family}]: ${r.catalogSymbols} catalog symbols · ${r.filesScanned} skill file(s) scanned`);
    if (r.fencePhantoms.length) {
      console.log(`❌ ${r.fencePhantoms.length} phantom symbol(s) in code fences (not in ${family}.json):`);
      for (const p of r.fencePhantoms) console.log(`  - ${p.symbol}  (${p.files.join(", ")})`);
    } else {
      console.log(`✅ Tier-1 [${family}]: every CometChat* symbol in a code fence exists in the catalog.`);
    }
    if (r.proseOnlyUnexpected.length) {
      console.log(`⚠️  ${r.proseOnlyUnexpected.length} UNEXPECTED prose-only CometChat* token(s) [${family}] (review): ${r.proseOnlyUnexpected.join(", ")}`);
    } else if (r.proseOnlyExpected.length) {
      console.log(`✅ Tier-1 (prose) [${family}]: only allowlisted intentional mentions (${r.proseOnlyExpected.length}).`);
    }
  }
  for (const [dir, r] of Object.entries(out.sdk)) {
    if (r.fencePhantoms.length) {
      console.log(`❌ ${r.fencePhantoms.length} phantom SDK symbol(s) in ${dir} fences (not in ${r.catalog}.json):`);
      for (const p of r.fencePhantoms) console.log(`  - ${p.symbol}  (${p.files.join(", ")})`);
    } else {
      console.log(`✅ Tier-1 (SDK) [${dir}]: every CometChat.<member> in a fence exists in ${r.catalog}.json (${r.filesScanned} file(s)).`);
    }
  }
  for (const [key, d] of Object.entries(out.drift)) {
    const tag = STRICT_DRIFT ? "❌ DRIFT" : "⚠️  DRIFT";
    console.log(`${tag} [${key}]: shipped catalog != reviewer oracle.`);
    if (d.onlyShipped.length) console.log(`    only in shipped: ${d.onlyShipped.join(", ")}`);
    if (d.onlyReviewer.length) console.log(`    only in reviewer: ${d.onlyReviewer.join(", ")}`);
    console.log(`    → resync both copies from the installed kit.`);
  }
  process.exit(hardFail ? 1 : 0);
}

main();
