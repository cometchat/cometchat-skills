#!/usr/bin/env node
/**
 * verify-detection.mjs — assert peers.yaml `detect_signals` route each fixture to
 * the right platform.
 *
 *   node test-suite/scripts/verify-detection.mjs [--json]
 *
 * WHY THIS EXISTS
 * Detection is the FIRST thing that happens in a real run: the router reads the
 * repo, matches `detect_signals`, and dispatches. Get it wrong and every skill
 * downstream is unreachable — the failure looks like "the pack doesn't support my
 * framework", with nothing pointing at the cause.
 *
 * `test-suite/fixtures/` held realistic project skeletons for exactly this, but
 * nothing had read them since the v5 pivot deleted the harness that did. So the
 * signals were unverified, and adding a fixture without a consumer would just be
 * a prop that makes coverage look real.
 *
 * Checks per fixture:
 *   1. it matches its EXPECTED platform
 *   2. it does NOT match any other platform (no ambiguous routing)
 * A fixture with no expectation is a hard error, so a new one can't be added and
 * silently ignored.
 *
 * `signal:` entries are conversational cues, not repo facts — skipped here. Parked peers are a
 * routing spec only (nothing installable) and never route.
 *
 * Static checks on peers.yaml itself (fail even with no fixture for the peer):
 *   3. every live peer's `detect_signals` parses to ≥1 entry — BOTH YAML list styles (inline
 *      `[a, b]` and block `- a`). The old inline-only regex read 0 signals for react-native,
 *      ios-calls and flutter-calls and still printed "no ambiguous matches".
 *   4. no two live peers claim the SAME repo-fact signal (ios-calls once shared `*.xcodeproj`
 *      with the ios UI Kit peer, so every Xcode project matched both).
 *
 * Signal forms: `<file>:<dep>` (a .json manifest dependency, else a substring of the file),
 * `file:<path>` / `<path>` (presence), `*.ext` (any root entry with that suffix).
 *
 * Exit: 0 all fixtures route correctly · 1 a mismatch · 2 bad setup.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES = join(ROOT, "test-suite", "fixtures");
const JSON_OUT = process.argv.includes("--json");

// Expected platform per fixture. Adding a fixture without an entry FAILS — that is
// deliberate: an unclassified fixture is an untested one.
const EXPECTED = {
  "angular-cli": "angular",
  "astro-react": "react",
  "astro-with-pages": "react",
  // RN / Expo route to the react-native peer (its detect_signals are a BLOCK-style YAML list,
  // which the old inline-only parser read as empty — so these used to "pass" as null).
  "bare-react-native": "react-native",
  "expo-managed": "react-native",
  "expo-router": "react-native",
  "nextjs-app": "react",
  "nextjs-with-nextauth": "react",
  "react-router-v7": "react",
  "react-router-with-routes": "react",
  "react-vite": "react",
  "react-with-auth": "react",
};

// ── parse peers.yaml: platform → detect_signals[] ────────────────────────────
// A YAML list value in either style: inline `key: [a, "b"]` (may wrap lines) or block
//   key:
//     - "a"   # comment
// Returns null when the key is absent, [] when present but empty.
const unquote = (v) => { const q = /^(["'])(.*?)\1/.exec(v); return q ? q[2] : v.replace(/\s+#.*$/, "").trim(); };
function yamlList(block, key) {
  const inline = new RegExp(`^[ \\t]*${key}:[ \\t]*\\[([^\\]]*)\\]`, "m").exec(block);
  if (inline) return inline[1].split(",").map((x) => unquote(x.trim())).filter(Boolean);
  const head = new RegExp(`^[ \\t]*${key}:[ \\t]*(?:#.*)?$`, "m").exec(block);
  if (!head) return null;
  const items = [];
  for (const line of block.slice(head.index + head[0].length).split("\n").slice(1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;             // blank / comment line inside the list
    const it = /^\s*-\s+(.*)$/.exec(line);
    if (!it) break;                                     // next key — list ended
    items.push(unquote(it[1].trim()));
  }
  return items;
}
const y = readFileSync(join(ROOT, "peers.yaml"), "utf8");
const peers = [];
let badSetup = 0;
for (const raw of y.split(/^\s*-\s*platform:/m).slice(1)) {
  const block = "platform:" + raw;
  const platform = (block.match(/platform:\s*(\S+)/) || [])[1];
  if (!platform) continue;
  if (/^\s*parked:\s*true\b/m.test(block)) continue; // routing spec only — never routes
  const signals = yamlList(block, "detect_signals");
  const exclude = yamlList(block, "exclude_signals") || [];
  if (signals !== null && signals.length === 0) {
    console.error(`❌ ${platform}: detect_signals parsed to 0 entries — peers.yaml format and this parser disagree`);
    badSetup++;
  }
  peers.push({ platform, signals: signals || [], exclude });
}
if (!peers.length) { console.error("parsed 0 peers from peers.yaml — check the format"); process.exit(2); }
if (badSetup) process.exit(2);

// ── static: no two live peers may claim the same repo-fact signal ────────────
const owners = new Map();
for (const p of peers) for (const s of p.signals.filter((x) => !x.startsWith("signal:"))) {
  owners.set(s, [...(owners.get(s) || []), p.platform]);
}
const collisions = [...owners].filter(([, ps]) => ps.length > 1);
for (const [s, ps] of collisions) console.error(`❌ detect signal "${s}" is claimed by ${ps.join(" + ")} — every such project matches both`);

// ── evaluate one signal against a fixture dir ────────────────────────────────
function matches(signal, dir) {
  if (signal.startsWith("signal:")) return false;            // conversational cue, not a repo fact
  if (signal.startsWith("*.")) {                              // glob on a root entry, e.g. *.xcodeproj
    const ext = signal.slice(1);
    return readdirSync(dir).some((f) => f.endsWith(ext));
  }
  const i = signal.indexOf(":");
  let file = i < 0 ? signal : signal.slice(0, i);
  let dep = i < 0 ? "" : signal.slice(i + 1);
  if (file === "file") { file = dep; dep = ""; }             // file:<path> — bare presence
  const p = join(dir, file);
  if (!existsSync(p)) return false;
  if (!dep) return true;                                     // bare file presence, e.g. angular.json
  let text;
  try { text = readFileSync(p, "utf8"); } catch { return false; }
  if (!file.endsWith(".json")) return text.includes(dep);    // Package.swift / Podfile / gradle / pubspec
  let pkg;
  try { pkg = JSON.parse(text); } catch { return false; }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.peerDependencies || {}) };
  return Object.prototype.hasOwnProperty.call(deps, dep);
}

const fixtures = readdirSync(FIXTURES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const rows = [];
let failed = 0;

for (const name of fixtures) {
  const fixtureDir = join(FIXTURES, name);
  if (!existsSync(join(fixtureDir, "package.json")) && !existsSync(join(fixtureDir, "pubspec.yaml"))) {
    continue;   // not an app fixture — belongs to another gate, not detection
  }
  if (!(name in EXPECTED)) {
    console.error(`❌ ${name}: no entry in EXPECTED — add one (use null if no peer should match)`);
    failed++;
    continue;
  }
  const dir = join(FIXTURES, name);
  // exclude_signals veto a match: e.g. `react` matches an RN project, but
  // package.json:react-native rules the web peer out.
  const hits = peers
    .filter((p) => p.signals.some((s) => matches(s, dir)) && !p.exclude.some((s) => matches(s, dir)))
    .map((p) => p.platform);
  const want = EXPECTED[name];
  const ok = want === null ? hits.length === 0 : hits.length === 1 && hits[0] === want;
  rows.push({ fixture: name, expected: want, matched: hits, ok });
  if (!ok) failed++;
}

failed += collisions.length;
if (JSON_OUT) { console.log(JSON.stringify({ rows, collisions: collisions.map(([signal, ps]) => ({ signal, peers: ps })), failed }, null, 2)); process.exit(failed ? 1 : 0); }

const sigCount = peers.reduce((n, p) => n + p.signals.length, 0);
console.log(`verify-detection: ${fixtures.length} fixture(s) · ${peers.length} live peer(s) · ${sigCount} detect signal(s) in peers.yaml\n`);
for (const r of rows) {
  const mark = r.ok ? "✅" : "❌";
  const got = r.matched.length ? r.matched.join(" + ") : "(none)";
  console.log(`  ${mark} ${r.fixture.padEnd(26)} expected ${String(r.expected ?? "(none)").padEnd(12)} matched ${got}`);
}
if (failed === 0) {
  console.log(`\n✅ every fixture routes to exactly its expected platform (no ambiguous matches; no shared detect signals).`);
  process.exit(0);
}
console.log(`\n❌ ${failed} problem(s): ${failed - collisions.length} fixture(s) route incorrectly, ${collisions.length} shared detect signal(s) — fix detect_signals in peers.yaml, or EXPECTED if it is wrong.`);
process.exit(1);
