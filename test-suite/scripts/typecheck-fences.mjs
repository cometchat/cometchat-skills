#!/usr/bin/env node
/**
 * typecheck-fences.mjs — Tier-2 compile gate: type-check the skills' code fences
 * against the REAL pinned kit (catches method/signature/importability drift that
 * the Tier-1 name-only catalog can't see — a wrong arg count, a member that moved,
 * a symbol that exists but isn't barrel-exported).
 *
 * Ported from the legacy pack's battle-tested engine, adapted for the v5 layout:
 *   • scans SKILL.md AND references/*.md for each react-v7 skill (v5 puts real code
 *     in references/), where legacy only scanned SKILL.md;
 *   • --discover web-v7 routes fences by the kit they import.
 *
 * Strategy: extract every ```ts/```tsx fence that imports from "@cometchat/…"
 * (real recipe blocks, not prose fragments), drop each into a throwaway dir inside
 * a project that has the kit installed, run `tsc --noEmit`, report only KIT-API
 * errors. Placeholder identifiers the recipes use (selectedUser, myHandler, …)
 * surface as TS2304/implicit-any — expected fragment noise, filtered out. What
 * remains is real API drift:
 *   TS2305/2307/2724 (no exported member / cannot find module)
 *   TS2339/2551       (property does not exist on type)
 *   TS2345/2554/2769  (argument type / arg count / overload mismatch)
 *   TS2353            (unknown property in object literal)
 *
 * Usage:
 *   node test-suite/scripts/typecheck-fences.mjs \
 *     --project test-suite/typecheck/web-v7 --tsconfig tsconfig.json --discover web-v7
 * The --project dir must have the kit installed (CI: `npm ci` it first).
 * Exit: 0 no kit-API errors · 1 kit-API drift · 2 bad invocation / project not installed.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };

const PROJECT = opt("project");
const TSCONFIG = opt("tsconfig", "tsconfig.json");
const DISCOVER = opt("discover"); // web-v7

if (!PROJECT) { console.error("ERROR: --project <kit-installed-dir> is required"); process.exit(2); }
const projectAbs = join(ROOT, PROJECT);
if (!existsSync(join(projectAbs, "node_modules", "@cometchat"))) {
  console.error(`ERROR: pinned kit not installed in ${PROJECT}.\n` +
    `       Run:  npm --prefix ${PROJECT} ci   (or  npm --prefix ${PROJECT} install)`);
  process.exit(2);
}

// --discover <family>: auto-find every react-v7 skill file whose fences import
// that family's kit (self-maintaining — the skill list can't rot). The trailing
// quote keeps chat-uikit-react" from matching chat-uikit-react-native".
// Per family: the import needle that identifies its fences, AND the skill-directory prefix to
// scan. BOTH must be family-driven — a hardcoded directory prefix silently discovers 0 files for
// every other family, which reads as "all fences pass". (AUDIT: RN Phase C.)
const FAMILIES_JSON = join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json");
// Needles + skill-dir pattern are declared per family in families.json (RULES.md §22),
// so onboarding a family needs no edit here.
const DISCOVER_FAMILY = Object.fromEntries(
  Object.values(JSON.parse(readFileSync(FAMILIES_JSON, "utf8")).families)
    .filter((f) => f.fenceNeedles && f.skillDirPattern)
    .map((f) => [basename(f.catalog || "", ".json"),
                 { needles: f.fenceNeedles, dir: new RegExp(f.skillDirPattern) }]),
);
const files = [];
if (DISCOVER) {
  const fam = DISCOVER_FAMILY[DISCOVER];
  if (!fam) { console.error(`unknown --discover family: ${DISCOVER}`); process.exit(2); }
  const { needles, dir: dirRe } = fam;
  const skillsRoot = join(ROOT, "skills");
  const collect = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) collect(p);
      else if (e.name.endsWith(".md")) {
        const body = readFileSync(p, "utf8");
        if (needles.some((n) => body.includes(n))) files.push(p);
      }
    }
  };
  for (const d of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (d.isDirectory() && dirRe.test(d.name)) collect(join(skillsRoot, d.name));
  }
  if (files.length === 0) {
    console.error(`ERROR: --discover ${DISCOVER} matched 0 files (dir ${dirRe}, needles ${needles.join(" | ")}).\n` +
      `A family that discovers nothing is a WIRING bug — it would otherwise report "all fences pass".`);
    process.exit(2);
  }
} else {
  // explicit file/dir args
  for (const a of args.filter((x, i) => !x.startsWith("--") && !["--project", "--tsconfig", "--discover"].includes(args[i - 1]))) {
    const p = join(ROOT, a);
    if (existsSync(p)) files.push(p);
  }
}

const KIT_ERROR_CODES = new Set([
  "TS2305", "TS2307", "TS2724", // module / exported member
  "TS2614",                     // no exported member (import-kind mismatch, e.g. default vs named)
  "TS2339", "TS2551",           // property does not exist
  "TS2345", "TS2554", "TS2769", // argument / arg-count / overload
  "TS2353",                     // unknown object-literal property
  "TS2322", "TS2741",           // type not assignable / missing required property (real API-shape drift)
  "TS2882",                     // side-effect import with no type declaration (e.g. the CSS "/styles" entry)
]);

// TS2304 (cannot find name) is placeholder noise in illustrative fragments (APP_ID, uid, guid…),
// so it only counts for WHOLE-FILE fences — a first line naming the file (`// src/main.ts`) says
// "paste this as the file", and an undeclared helper there fails the user's build. A fence that
// extends a file shown earlier says so: `// src/app/x.ts — continued …` is exempt.
const WHOLE_FILE_RE = /^\/\/\s*[\w@./\[\]()-]+\.(?:ts|tsx|mts)\b/;
function isWholeFile(body) {
  const first = (body.split("\n").find((l) => l.trim()) || "").trim();
  return WHOLE_FILE_RE.test(first) && !/\bcontinued\b/i.test(first);
}

function extractFences(file) {
  const src = readFileSync(file, "utf8");
  const out = [];
  const re = /```(?:tsx?|typescript|ts)\n([\s\S]*?)```/g;
  let m, idx = 0;
  while ((m = re.exec(src))) {
    const body = m[1];
    if (!/from\s+["']@cometchat\//.test(body)) continue;      // real recipe, not a fragment
    if (/tier2-version-gated/.test(body)) continue;           // API newer than the pinned kit
    out.push({ idx: idx++, body, wholeFile: isWholeFile(body) });
  }
  return out;
}

const FENCE_DIR = join(projectAbs, "src", "__fences__");
rmSync(FENCE_DIR, { recursive: true, force: true });
mkdirSync(FENCE_DIR, { recursive: true });

// Ambient decls for framework globals the fences legitimately use (Vite env, CSS,
// ?url/?raw asset imports) — not kit APIs; without them tsc emits env noise.
writeFileSync(join(FENCE_DIR, "__ambient.d.ts"),
  [
    "interface ImportMeta { env: Record<string, string>; }",
    'declare module "*.css" { const s: string; export default s; }',
    'declare module "*.css?url" { const s: string; export default s; }',
    'declare module "*?url" { const s: string; export default s; }',
    'declare module "*?raw" { const s: string; export default s; }',
  ].join("\n") + "\n");

const manifest = [];
for (const file of files) {
  if (!existsSync(file)) { console.error(`skip (not found): ${file}`); continue; }
  const rel = file.replace(ROOT + "/", "");
  const name = rel.replace(/[^A-Za-z0-9_-]/g, "_");
  for (const f of extractFences(file)) {
    const fenceFile = join(FENCE_DIR, `${name}__${f.idx}.tsx`);
    writeFileSync(fenceFile, `// @fence ${rel} #${f.idx}\n${f.body}\n`);
    manifest.push({ fenceFile, skill: name, idx: f.idx, wholeFile: f.wholeFile });
  }
}
console.log(`Extracted ${manifest.length} import-bearing fence(s) from ${files.length} file(s) into ${PROJECT}/src/__fences__`);

// tsc --noEmit, TWO-PASS: tsc suppresses ALL semantic diagnostics if any file has
// a syntactic (TS1xxx) error. Illustrative fragments often don't parse standalone
// and would mask real drift in every other fence — so strip the non-parseable ones
// (reported as a count) and re-run until the set parses cleanly.
const ERR_RE = /__fences__\/(.+)\.tsx\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)/;
function runTsc() {
  try {
    execSync(`npx tsc --noEmit -p ${TSCONFIG}`, { cwd: projectAbs, stdio: ["ignore", "pipe", "pipe"] });
    return "";
  } catch (e) { return `${e.stdout || ""}${e.stderr || ""}`; }
}
let raw = runTsc();
const stripped = new Set();
for (let pass = 0; pass < 10; pass++) {
  const syntactic = new Set();
  for (const line of raw.split("\n")) {
    const m = line.match(ERR_RE);
    if (m && /^TS1\d{3}$/.test(m[4])) syntactic.add(m[1]);
  }
  if (syntactic.size === 0) break;
  for (const nm of syntactic) { rmSync(join(FENCE_DIR, `${nm}.tsx`), { force: true }); stripped.add(nm); }
  raw = runTsc();
}

const wholeFileFences = new Set(manifest.filter((f) => f.wholeFile).map((f) => `${f.skill}__${f.idx}`));
const kitErrors = [];
for (const line of raw.split("\n")) {
  const m = line.match(ERR_RE);
  if (!m) continue;
  const [, fenceName, , , code, msg] = m;
  if (code === "TS2304" && wholeFileFences.has(fenceName)) { kitErrors.push({ fenceName, code, msg }); continue; }
  if (!KIT_ERROR_CODES.has(code)) continue;
  if (code === "TS2307" && !/@cometchat\//.test(msg)) continue; // app-relative/CSS imports = env noise
  kitErrors.push({ fenceName, code, msg });
}

rmSync(FENCE_DIR, { recursive: true, force: true });
const checked = manifest.length - stripped.size;
const strippedNote = stripped.size ? ` (${stripped.size} non-parseable fragment fence(s) skipped)` : "";
if (kitErrors.length === 0) {
  console.log(`\n✅ Tier-2: no kit-API errors across ${checked} semantically-checked fence(s)${strippedNote}.`);
  process.exit(0);
}
console.log(`\n❌ ${kitErrors.length} kit-API error(s) — real method/signature/import drift:`);
for (const e of kitErrors) console.log(`  [${e.fenceName}] ${e.code}: ${e.msg}`);
process.exit(1);
