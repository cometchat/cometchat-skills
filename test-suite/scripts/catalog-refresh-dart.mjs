#!/usr/bin/env node
/**
 * catalog-refresh-dart.mjs — re-derive the flutter-v6 Tier-1 oracle from the pinned kit.
 *
 * The Dart sibling of catalog-refresh.mjs. It exists because the Flutter catalog is
 * COMPILER-VERIFIED, not parsed: a declaration scan is wrong in both directions on this
 * kit (it counts internals that are never exported, and misses the entire Chat SDK
 * surface that the barrels re-export via `export 'package:...'`). So this script uses
 * the scan only to propose CANDIDATES, then asks the Dart analyzer which of them
 * actually resolve from each barrel. The analyzer's verdict is the oracle.
 *
 * It also records WHICH barrel each symbol comes from. That is not cosmetic: the calls
 * widgets resolve only from cometchat_calls_uikit.dart, and a skill that imports the
 * chat barrel and emits CometChatIncomingCall fails to compile.
 *
 * Usage:
 *   node test-suite/scripts/catalog-refresh-dart.mjs            # rewrite the catalog
 *   node test-suite/scripts/catalog-refresh-dart.mjs --check    # CI: fail on drift
 * Requires the pinned project resolved (npm run verify:fences:flutter-v6:setup).
 * Exit: 0 clean/written · 1 drift (--check) · 2 project not installed.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEFAULT_FAMILY, CATALOG_KEY, TYPECHECK_PROJECT, PROP_TABLES_DIR } from "./_dart-family.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROJECT = TYPECHECK_PROJECT;
const OUT = join(ROOT, "test-suite", "catalogs", "flutter-v6.json");
const CHECK = process.argv.includes("--check");

const CHAT_BARREL = "package:cometchat_chat_uikit/cometchat_chat_uikit.dart";
const CALLS_BARREL = "package:cometchat_chat_uikit/cometchat_calls_uikit.dart";

const cfgPath = join(PROJECT, ".dart_tool", "package_config.json");
if (!existsSync(cfgPath)) {
  console.error(`ERROR: pinned kit not installed.\n       Run: npm run verify:fences:flutter-v6:setup`);
  process.exit(2);
}
const pkgCfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const pkg = (name) => pkgCfg.packages.find((p) => p.name === name);
const kit = pkg("cometchat_chat_uikit");
if (!kit) { console.error("ERROR: cometchat_chat_uikit not in package_config.json"); process.exit(2); }
const kitLib = new URL(kit.rootUri.endsWith("/") ? kit.rootUri + "lib/" : kit.rootUri + "/lib/", `file://${cfgPath}`).pathname;
const kitVersion = (kit.rootUri.match(/cometchat_chat_uikit-([0-9][^/]*)/) || [])[1] || "unknown";
const versionOf = (n) => (pkg(n)?.rootUri.match(new RegExp(`${n}-([0-9][^/]*)`)) || [])[1] || "unknown";

// ── 1. CANDIDATES: every CometChat*-prefixed declaration anywhere in the kit, plus the
// re-exported SDK packages. Over-inclusive on purpose — the analyzer prunes it.
const DECL_RE = /(?:^|[\s;{])(?:abstract\s+|base\s+|final\s+|sealed\s+|interface\s+)*(?:class|mixin|enum|typedef|extension)\s+(CometChat[A-Za-z0-9_]*)/g;
const candidates = new Set();
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".dart")) {
      for (const m of readFileSync(p, "utf8").matchAll(DECL_RE)) candidates.add(m[1]);
    }
  }
};
walk(kitLib);
for (const dep of ["cometchat_sdk", "cometchat_calls_sdk", "cometchat_cards"]) {
  const d = pkg(dep);
  if (!d) continue;
  const lib = new URL(d.rootUri.endsWith("/") ? d.rootUri + "lib/" : d.rootUri + "/lib/", `file://${cfgPath}`).pathname;
  if (existsSync(lib)) walk(lib);
}
const cands = [...candidates].sort();
console.log(`candidates: ${cands.length} CometChat* declaration(s) across the kit + re-exported SDKs`);

// ── 2. VERIFY: ask the analyzer which resolve from each barrel. One file per symbol so
// a single bad name cannot poison the others and the error→symbol mapping is exact.
const probeDir = join(PROJECT, "lib", "__catalogprobe");
function resolveFrom(barrel) {
  rmSync(probeDir, { recursive: true, force: true });
  mkdirSync(probeDir, { recursive: true });
  cands.forEach((sym, i) => {
    writeFileSync(join(probeDir, `s${i}.dart`),
      `// probe ${sym}\nimport '${barrel}';\n` +
      `// ignore_for_file: unused_element, non_constant_identifier_names\n` +
      `${sym}? _t${i};\nfinal _v${i} = ${sym};\n`);
  });
  let raw = "";
  try {
    raw = execSync("flutter analyze --no-pub lib/__catalogprobe", { cwd: PROJECT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { raw = `${e.stdout || ""}${e.stderr || ""}`; }
  const missing = new Set(), proven = new Set();
  for (const line of raw.split("\n")) {
    const m = line.match(/lib\/__catalogprobe\/s(\d+)\.dart/);
    if (!m) continue;
    const sym = cands[+m[1]];
    // An EXTENSION resolves but fits neither position; this diagnostic PROVES it exists.
    if (/can't be used as an expression|extension_as_expression/.test(line)) { proven.add(sym); continue; }
    if (/(isn't a class|Undefined name|isn't defined|not a type|isn't a type)/.test(line)) missing.add(sym);
  }
  for (const s of proven) missing.delete(s);
  return cands.filter((s) => !missing.has(s));
}
const chat = new Set(resolveFrom(CHAT_BARREL));
const calls = new Set(resolveFrom(CALLS_BARREL));
rmSync(probeDir, { recursive: true, force: true });

const symbols = [...new Set([...chat, ...calls])].sort();
const rejected = cands.filter((s) => !chat.has(s) && !calls.has(s));

const catalog = {
  family: CATALOG_KEY,
  generatedFrom: [
    `cometchat_chat_uikit ${kitVersion} (pub.dev archive, resolved via test-suite/typecheck/flutter-v6)`,
    "COMPILER-VERIFIED: every symbol was probed with `flutter analyze` and resolves from the stated barrel. A declaration scan generates candidates only — it over-counts (declared but not exported) and under-counts (skips `export 'package:...'`, i.e. the whole re-exported Chat SDK surface).",
  ],
  kitPackage: "cometchat_chat_uikit",
  kitVersion,
  sdkPackage: `cometchat_sdk ${versionOf("cometchat_sdk")} (re-exported through the kit barrels)`,
  callsSdkPackage: `cometchat_calls_sdk ${versionOf("cometchat_calls_sdk")} (re-exported through the CALLS barrel only)`,
  source: "compiler-verified",
  mode: "analyzer-probe",
  lang: "dart",
  barrels: { chat: CHAT_BARREL, calls: CALLS_BARREL },
  barrelNote: "TWO barrels, DIFFERENT surfaces — a real compile trap. The calls-only symbols are NOT importable from cometchat_chat_uikit.dart, and the calls barrel does not re-export the chat widgets, so a calls screen imports BOTH.",
  symbolCount: symbols.length,
  symbols,
  symbolsByBarrel: {
    "chat-only": [...chat].filter((s) => !calls.has(s)).sort(),
    "calls-only": [...calls].filter((s) => !chat.has(s)).sort(),
    both: [...chat].filter((s) => calls.has(s)).sort(),
  },
  internalOnlyExcluded: rejected,
  internalOnlyExcludedNote: "Declared in the kit/SDK source but NOT resolvable from either barrel — phantoms if emitted.",
};

const next = JSON.stringify(catalog, null, 2) + "\n";
const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
console.log(`resolved: ${symbols.length} symbol(s) — ${catalog.symbolsByBarrel["chat-only"].length} chat-only · ${catalog.symbolsByBarrel["calls-only"].length} calls-only · ${catalog.symbolsByBarrel.both.length} both · ${rejected.length} excluded`);

if (CHECK) {
  if (cur.trim() !== next.trim()) {
    console.log(`\n❌ catalogs/flutter-v6.json is STALE vs the pinned kit ${kitVersion} — run: node test-suite/scripts/catalog-refresh-dart.mjs`);
    const curSyms = new Set(cur ? JSON.parse(cur).symbols : []);
    const added = symbols.filter((s) => !curSyms.has(s));
    const removed = [...curSyms].filter((s) => !symbols.includes(s));
    if (added.length) console.log(`   + added:   ${added.join(", ")}`);
    if (removed.length) console.log(`   - removed: ${removed.join(", ")}   ← a skill fence using one of these will now fail Tier-1`);
    process.exit(1);
  }
  console.log("✅ catalogs/flutter-v6.json matches the pinned kit.");
  process.exit(0);
}
writeFileSync(OUT, next);
console.log(`✅ wrote ${OUT.replace(ROOT + "/", "")}`);
