#!/usr/bin/env node
/**
 * verify-docs-base.mjs — block a preview docs host from ever being merged.
 *
 * A skill's fetch ladder is half its value: the hot path is baked, everything else is fetched
 * from DOCS_BASE at runtime. Pointing that at a Mintlify PR preview is the right thing while
 * the docs PR is open — you want to test against the fixed pages, not stale production ones.
 *
 * But a preview DIES when its PR closes. Merging a pack that points at one silently breaks
 * every long-tail fetch for every customer: no error at build, no error at install, just a
 * skill that can no longer answer anything it did not bake.
 *
 * A comment saying "revert before merge" is not a guard — it depends on someone remembering
 * at exactly the wrong moment. This is the guard.
 *
 *   default   warn — the dev loop stays green so testing against a preview works
 *   --strict  FAIL — wired into verify:ci, so a preview host cannot reach main
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const STRICT = process.argv.includes("--strict");

// Anything that is not the production docs origin is a staging/preview host.
const PRODUCTION = "https://www.cometchat.com/docs";
const SUSPECT = /https:\/\/[a-z0-9.-]*(mintlify\.site|vercel\.app|netlify\.app|ngrok[a-z.-]*|localhost(:\d+)?)/gi;

const walk = (d, acc = []) => {
  if (!existsSync(d)) return acc;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(md|json|ya?ml)$/i.test(e)) acc.push(p);
  }
  return acc;
};

const hits = [];
for (const f of walk(join(ROOT, "skills"))) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(SUSPECT)) {
      // A prose mention of localhost (HTTPS requirements, service workers) is not a docs base.
      if (/localhost/i.test(m[0]) && !/DOCS_BASE|SDK_DOCS_BASE/.test(line)) continue;
      hits.push({ file: relative(ROOT, f), line: i + 1, host: m[0], isBase: /DOCS_BASE|SDK_DOCS_BASE/.test(line) });
    }
  });
}

// AUDIT-182 — the TEST-MODE:MCP-ONLY banner is the same class as a preview host: a temporary
// test-run artifact whose "delete before go-live" comment is not a guard. A HARD-STOP wording
// ("if the MCP is not connected, STOP") strands every real user without the MCP, so it is
// flagged in the dev loop too; any banner at all fails --strict, exactly like a preview host.
const BANNER = /TEST-MODE:MCP-ONLY/;
const SOFT = /SOFT gate|authorize the fetch fallback/i;
const banners = [];
const bannerFiles = walk(join(ROOT, "skills")).filter((f) => /\.md$/i.test(f));
if (existsSync(join(ROOT, "RULES.md"))) bannerFiles.push(join(ROOT, "RULES.md"));
for (const f of bannerFiles) {
  const txt = readFileSync(f, "utf8");
  if (!BANNER.test(txt)) continue;
  const i = txt.split("\n").findIndex((l) => BANNER.test(l));
  const block = txt.slice(txt.indexOf("TEST-MODE:MCP-ONLY"), txt.indexOf("TEST-MODE:MCP-ONLY") + 1200);
  banners.push({ file: relative(ROOT, f), line: i + 1, hard: !SOFT.test(block) });
}
if (banners.length) {
  const hard = banners.filter((b) => b.hard);
  console.log(`${STRICT ? "❌" : "⚠️ "} docs-base: ${banners.length} TEST-MODE:MCP-ONLY banner(s) still shipped${hard.length ? ` — ${hard.length} with HARD-STOP wording (a real user without the MCP gets no integration; AUDIT-182)` : ""}.`);
  for (const b of banners) console.log(`   ${b.file}:${b.line}${b.hard ? "  [HARD STOP — make it the soft ask-to-authorize gate]" : "  [soft gate — delete before go-live]"}`);
  console.log("   Fix: delete the banner (grep TEST-MODE:MCP-ONLY) to restore MCP-preferred + fetch-fallback; ADD-FRAMEWORK.md Phase F.\n");
}

if (!hits.length) {
  if (banners.length && STRICT) { console.log("   (blocking: verify:ci)"); process.exit(1); }
  console.log(`✅ docs-base: every skill fetches from production (${PRODUCTION}).`);
  process.exit(0);
}

const bases = hits.filter((h) => h.isBase);
const label = STRICT ? "❌" : "⚠️ ";
console.log(`${label} docs-base: ${hits.length} non-production docs host(s) in skills/ — ${bases.length} of them a DOCS_BASE.`);
console.log("   A preview dies when its PR closes; merging this breaks every long-tail fetch, silently.\n");
for (const h of hits) {
  console.log(`   ${h.file}:${h.line}${h.isBase ? "  [DOCS_BASE]" : ""}`);
  console.log(`      ${h.host}`);
}
console.log(`\n   Fix: set DOCS_BASE and SDK_DOCS_BASE back to ${PRODUCTION}`);
if (STRICT) { console.log("   (blocking: verify:ci)"); process.exit(1); }
console.log("   (warning only — verify:ci will BLOCK this)");
process.exit(0);
