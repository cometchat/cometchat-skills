#!/usr/bin/env node
/**
 * build-registry.mjs — generate the pack's "materials index", one registry per family.
 *
 * NOTHING is hardcoded per framework. The family list, its catalog, its oracles and
 * which skills belong to it all come from the reviewer's families.json — the same
 * single source the reviewer tools read. Adding a family there is enough; this script
 * needs no edit.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHECK = process.argv.includes("--check");
const famArg = (() => { const i = process.argv.indexOf("--family"); return i >= 0 ? process.argv[i + 1] : null; })();
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));

const FAMILIES = join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json");
// families.json lives under .claude/, which package.json `files` does NOT ship — only
// `.claude-plugin` and `peers.yaml` do. The registries themselves ARE shipped, pre-built, so a
// consumer never needs to regenerate them; this is a dev-only tool. Exiting 2 there turned a
// non-task into a hard failure for anyone who ran `npm run verify` from an installed package.
// Degrade to a no-op with a clear reason instead.
if (!existsSync(FAMILIES)) {
  console.log("✅ build-registry: skipped — families.json is not present (dev-only tool; the shipped registries are pre-built).");
  process.exit(0);
}
const { families } = readJSON(FAMILIES);

const y = readFileSync(join(ROOT, "peers.yaml"), "utf8");
const entry = (y.match(/^entry:\s*(\S+)/m) || [])[1] || "cometchat";
const blocks = y.split(/^\s*-\s*platform:/m).slice(1).map((b) => "platform:" + b);

// Every skill dir once; each family selects its own by the prefixes families.json declares.
const skillsDir = join(ROOT, "skills");
const allSkills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name)
  .filter((name) => existsSync(join(skillsDir, name, "SKILL.md")))
  .map((name) => {
    const b = (readFileSync(join(skillsDir, name, "SKILL.md"), "utf8").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
    return { name, version: (b.match(/^\s+version:\s*"?([^"\n]+)"?/m) || [])[1] || null, role: name === entry ? "router" : "skill" };
  });

// Every platform-specific prefix any family declares — anything matching none of these is shared.
const PLATFORM_PREFIXES = [...new Set(
  Object.values(families).flatMap((f) => (f.reviewsSkills || []).filter((p) => p.endsWith("-"))),
)];

let stale = 0, wrote = 0, skipped = [];
for (const [key, fam] of Object.entries(families)) {
  if (/^template\b/i.test(fam._status || "")) { skipped.push(`${key} (template)`); continue; }

  // registry name == catalog basename, so web-v7.json keeps its existing filename
  const name = basename(fam.catalog || "", ".json");
  const catalogPath = `test-suite/catalogs/${name}.json`;
  if (!name || !existsSync(join(ROOT, catalogPath))) { skipped.push(`${key} (no catalog)`); continue; }

  // peers block: match on this family's kit package, with the trailing @ so
  // "@cometchat/chat-uikit-react" cannot swallow "@cometchat/chat-uikit-react-native"
  const block = blocks.find((b) => b.includes(`kit_package: "${fam.kitPackage}@`)) || "";
  const grab = (re) => (block.match(re) || [])[1];

  // Legacy unsuffixed filenames are declared per-family in families.json, not guessed here.
  const featPath = fam.features || `features.${name}.json`;
  const conPath = fam.contracts || `contracts.${name}.json`;
  const features = existsSync(join(ROOT, featPath)) ? readJSON(join(ROOT, featPath)) : null;
  const contracts = existsSync(join(ROOT, conPath)) ? readJSON(join(ROOT, conPath)) : null;
  const catalog = readJSON(join(ROOT, catalogPath));

  // A skill carrying no platform prefix at all (the `cometchat` router, `cometchat-onboarding`)
  // is SHARED and ships with every family. reviewsSkills is a *review* scope and cannot be
  // reused as the ship list — it deliberately omits skills that emit no reviewable surface.
  const prefixes = fam.reviewsSkills || [];
  const skills = allSkills.filter(({ name: s }) =>
    !PLATFORM_PREFIXES.some((p) => s.startsWith(p)) ||
    prefixes.some((p) => (p.endsWith("-") ? s.startsWith(p) : s === p)));

  const registry = {
    family: name,
    entry,
    kit_package: grab(/kit_package:\s*"([^"]+)"/),
    sdk_package: grab(/sdk_package:\s*"([^"]+)"/),
    verified: /verified:\s*true/.test(block),
    materials: {
      catalog: { path: catalogPath, symbolCount: catalog.symbolCount, mode: catalog.mode },
      features: { path: featPath, count: new Set((features?.features || []).map((f) => f.id).filter(Boolean)).size },
      contracts: {
        path: conPath,
        count: Array.isArray(contracts?.contracts) ? contracts.contracts.length : Object.keys(contracts?.contracts || {}).length,
      },
    },
    skills,
  };

  const outPath = join(ROOT, "registry", `${name}.json`);
  const next = JSON.stringify(registry, null, 2) + "\n";
  if (CHECK) {
    if ((existsSync(outPath) ? readFileSync(outPath, "utf8") : "") !== next) {
      console.log(`❌ registry/${name}.json is stale — run: node test-suite/scripts/build-registry.mjs`); stale++;
    }
    continue;
  }
  mkdirSync(join(ROOT, "registry"), { recursive: true });
  writeFileSync(outPath, next);
  console.log(`✅ wrote registry/${name}.json — ${skills.length} skill(s), ${catalog.symbolCount} symbols, ${registry.materials.features.count} features, ${registry.materials.contracts.count} contracts.`);
  wrote++;
}

if (skipped.length) console.log(`   skipped: ${skipped.join(", ")}`);
if (CHECK) { if (stale) process.exit(1); console.log(`✅ all ${Object.keys(families).length - skipped.length - 1} registry file(s) up to date.`); process.exit(0); }
// A family list that yields nothing means the discovery broke — never report green over zero.
if (!wrote) { console.log("❌ build-registry: no families produced a registry — check families.json / catalog paths"); process.exit(2); }
