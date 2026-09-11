#!/usr/bin/env node
/**
 * catalog-refresh.mjs — regenerate the Tier-1 symbol catalog from the installed
 * kit and keep BOTH copies in sync (the shipped oracle + the reviewer's G0 oracle).
 * This is the automation for oracle-rot (AUDIT-005): SDK minors add/rename symbols;
 * a stale catalog silently false-passes Tier-1. Run on a schedule + on kit bumps.
 *
 *   node test-suite/scripts/catalog-refresh.mjs           # regenerate + write both copies
 *   node test-suite/scripts/catalog-refresh.mjs --check   # diff only; exit 1 if the catalog would change (CI rot detector)
 *   node test-suite/scripts/catalog-refresh.mjs --kit <dir> --sdk <dir>   # point at a different install
 *
 * Default: reads the kit from the demo app's node_modules (the pinned reference
 * install). CI can point --kit/--sdk at the lean test-suite/typecheck/web-v7
 * install instead. Delegates symbol extraction to the skill-creator's
 * build-catalog.mjs so there is ONE generator, not two.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const flagDir = (f, def) => {
  const i = argv.indexOf(f);
  if (i < 0) return def;
  const v = argv[i + 1];
  return isAbsolute(v) ? v : join(ROOT, v);
};

const BUILDER = join(ROOT, ".claude/skills/cometchat-skill-creator/tools/build-catalog.mjs");
const KIT = flagDir("--kit", join(ROOT, "cometchat-react-app/node_modules/@cometchat/chat-uikit-react"));
const SDK = flagDir("--sdk", join(ROOT, "cometchat-react-app/node_modules/@cometchat/chat-sdk-javascript"));
// Which family to refresh comes from families.json (RULES.md §22). This hardcoded web-v7,
// so the scheduled refresh could never keep any other family's catalog from going stale.
const _FJ = join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json");
// Reviewer oracle is DEV-ONLY / not in the tarball — skip cleanly from an installed pack.
if (!existsSync(_FJ)) {
  console.log("catalog: reviewer oracle (families.json) not present — dev-only refresh, skipping (installed pack).");
  process.exit(0);
}
const _F = JSON.parse(readFileSync(_FJ, "utf8"));
const _key = (f) => (f.catalog || "").replace(/^catalog\//, "").replace(/\.json$/, "");
const _arg = (process.argv.find((a) => a.startsWith("--family=")) || "").split("=")[1]
  || (process.argv.includes("--family") ? process.argv[process.argv.indexOf("--family") + 1] : null);
const FAM_ENTRY = _arg
  ? Object.values(_F.families).find((f) => _key(f) === _arg) || _F.families[_arg]
  : _F.families[_F.default];
if (!FAM_ENTRY) { console.error(`ERROR: unknown --family ${_arg}`); process.exit(2); }
const FAMILY = _key(FAM_ENTRY);
const CATALOG_MODE = FAM_ENTRY.catalog_build?.mode || ["--exports-only"];
const SHIPPED = join(ROOT, `test-suite/catalogs/${FAMILY}.json`);
const REVIEWER = join(ROOT, `.claude/skills/cometchat-skill-reviewer/tools/catalog/${FAMILY}.json`);

if (!existsSync(KIT) || !existsSync(SDK)) {
  console.error(`ERROR: kit not installed at node_modules/@cometchat.\n` +
    `       Run:  npm i @cometchat/chat-uikit-react@7 @cometchat/chat-sdk-javascript@4`);
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), "cc-catalog-"));
const outFile = join(tmp, `${FAMILY}.json`);
const res = spawnSync("node", [
  BUILDER, "--family", FAMILY, ...CATALOG_MODE,
  "--dir", KIT, "--dir", SDK, "--out", outFile,
], { encoding: "utf8" });
if (res.status !== 0) {
  console.error(res.stdout || "", res.stderr || "");
  console.error("ERROR: build-catalog.mjs failed");
  rmSync(tmp, { recursive: true, force: true });
  process.exit(2);
}

const next = JSON.parse(readFileSync(outFile, "utf8"));
const prev = existsSync(SHIPPED) ? JSON.parse(readFileSync(SHIPPED, "utf8")) : { symbols: [] };
const prevSet = new Set(prev.symbols || []);
const nextSet = new Set(next.symbols || []);
const added = [...nextSet].filter((s) => !prevSet.has(s));
const removed = [...prevSet].filter((s) => !nextSet.has(s));

console.log(`catalog-refresh: ${prevSet.size} → ${nextSet.size} symbols  (+${added.length} / -${removed.length})`);
if (added.length) console.log(`  added:   ${added.slice(0, 20).join(", ")}${added.length > 20 ? " …" : ""}`);
if (removed.length) console.log(`  removed: ${removed.slice(0, 20).join(", ")}${removed.length > 20 ? " …" : ""}`);

if (CHECK) {
  rmSync(tmp, { recursive: true, force: true });
  if (added.length || removed.length) {
    console.log(`\n❌ catalog is STALE — the installed kit's export surface changed. Run: npm run catalog:refresh`);
    process.exit(1);
  }
  console.log(`\n✅ catalog is fresh (matches the installed kit).`);
  process.exit(0);
}

copyFileSync(outFile, SHIPPED);
copyFileSync(outFile, REVIEWER);
rmSync(tmp, { recursive: true, force: true });
console.log(`\n✅ wrote ${SHIPPED.replace(ROOT + "/", "")} and ${REVIEWER.replace(ROOT + "/", "")} (both oracles in sync).`);
