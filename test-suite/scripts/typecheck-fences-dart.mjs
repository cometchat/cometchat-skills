#!/usr/bin/env node
/**
 * typecheck-fences-dart.mjs — Tier-2 compile gate for DART/Flutter families.
 *
 * The Dart sibling of typecheck-fences.mjs (same contract, same exit codes, same
 * "only real kit-API drift fails the build" philosophy): extract every ```dart
 * fence that imports package:cometchat_*, drop it into a project that has the
 * PINNED kit installed, run `flutter analyze`, and report only KIT-API errors.
 * Placeholder identifiers the recipes use (selectedUser, myHandler, …) surface as
 * undefined_identifier — expected fragment noise, filtered out. What remains is
 * real drift:
 *   uri_does_not_exist / uri_has_not_been_generated  (import / package path)
 *   undefined_class · undefined_function · undefined_method · undefined_getter ·
 *   undefined_setter · undefined_named_parameter    (symbol/member moved or gone)
 *   not_enough_positional_arguments · extra_positional_arguments ·
 *   missing_required_argument · argument_type_not_assignable  (signature drift)
 *
 * ── One deliberate divergence from the TS engine (documented, not accidental) ──
 * TypeScript modules allow top-level statements, so the TS gate can analyze a bare
 * snippet as-is and merely STRIPS what won't parse. Dart does NOT: `await foo();`
 * at top level is a syntax error, which describes most real Flutter recipe fences.
 * Stripping them all would leave a vacuous gate that reports "✅ 0 errors" while
 * checking almost nothing — a silent cap, the exact failure mode RULES forbids.
 * So this engine tries each fence in THREE escalating shapes and keeps the first
 * that parses:
 *   1. as-is            (a complete file: imports + declarations)
 *   2. body-wrapped     (statements → wrapped in an async function body)
 *   3. member-wrapped   (widget/class members → wrapped in a class body)
 * Imports are always hoisted to the top of the generated file. Only a fence that
 * parses in NO shape is stripped, and the counts are printed so the gate can never
 * silently shrink.
 *
 * Usage:
 *   node test-suite/scripts/typecheck-fences-dart.mjs \
 *     --project test-suite/typecheck/flutter-v6 --discover flutter-v6
 * The --project dir must have the kit installed (CI: `flutter pub get` it first).
 * Exit: 0 no kit-API errors · 1 kit-API drift · 2 bad invocation / project not installed.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CATALOG_KEY, FAMILY } from "./_dart-family.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };

const PROJECT = opt("project");
const DISCOVER = opt("discover");
// Pages that intentionally show a PREVIOUS major's code (e.g. an upgrade guide's
// "before" snippets) are correct as written and must not be reported. Repeatable.
const EXCLUDES = args.reduce((acc, a, i) => (args[i - 1] === "--exclude" ? [...acc, a] : acc), []);

if (!PROJECT) { console.error("ERROR: --project <kit-installed-dir> is required"); process.exit(2); }
const projectAbs = join(ROOT, PROJECT);
if (!existsSync(join(projectAbs, ".dart_tool", "package_config.json"))) {
  console.error(`ERROR: pinned kit not installed in ${PROJECT}.\n` +
    `       Run:  (cd ${PROJECT} && flutter pub get)`);
  process.exit(2);
}

// --discover <family>: auto-find every skill file for that family whose fences
// import the kit (self-maintaining — the skill list can't rot).
// A file is IN SCOPE if it imports the kit OR has a dart fence naming a CometChat symbol.
// Matching on the import alone silently skipped reference files whose fences elide imports
// (3 real fences in core/references went unchecked) — a shrinking denominator that reports
// success while testing less, the exact failure this engine is supposed to prevent.
const DART_FENCE_RE = /```(?:dart|flutter)[^\n]*\n([\s\S]*?)```/g;
// Keyed by CATALOG_KEY from families.json rather than a literal (RULES.md §22): the skill
// prefix comes from the family's own `reviewsSkills`, so a rename in the registry cannot
// leave this engine quietly discovering nothing.
const SKILL_PREFIX = (FAMILY.reviewsSkills || []).find((p) => p.endsWith("-")) || "";
const DISCOVER_CFG = {
  [CATALOG_KEY]: {
    inScope: (txt) => {
      if (txt.includes(`package:${FAMILY.kitPackage}/`)) return true;
      for (const m of txt.matchAll(DART_FENCE_RE)) if (/CometChat[A-Za-z0-9_]*/.test(m[1])) return true;
      return false;
    },
    skillDir: new RegExp("^" + SKILL_PREFIX),
  },
};
const files = [];
if (DISCOVER) {
  const cfg = DISCOVER_CFG[DISCOVER];
  if (!cfg) { console.error(`unknown --discover family: ${DISCOVER}`); process.exit(2); }
  const skillsRoot = join(ROOT, "skills");
  const collect = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) collect(p);
      else if (e.name.endsWith(".md") && cfg.inScope(readFileSync(p, "utf8"))) files.push(p);
    }
  };
  if (existsSync(skillsRoot)) {
    for (const d of readdirSync(skillsRoot, { withFileTypes: true })) {
      if (d.isDirectory() && cfg.skillDir.test(d.name)) collect(join(skillsRoot, d.name));
    }
  }
} else {
  for (const a of args.filter((x, i) => !x.startsWith("--") && !["--project", "--discover"].includes(args[i - 1]))) {
    const p = join(ROOT, a);
    if (existsSync(p) && !EXCLUDES.some((x) => p.includes(x))) files.push(p);
  }
}

const KIT_ERROR_CODES = new Set([
  "uri_does_not_exist", "uri_has_not_been_generated",       // import / package path
  "undefined_class", "undefined_function", "undefined_method",
  "undefined_getter", "undefined_setter", "undefined_named_parameter",
  "not_enough_positional_arguments", "extra_positional_arguments",
  "missing_required_argument", "argument_type_not_assignable",
  "new_with_undefined_constructor_default", "undefined_enum_constant",
  "wrong_number_of_type_arguments", "non_type_as_type_argument",
  // A PHANTOM WIDGET (a React/v5 name that doesn't exist in this kit) lands here,
  // not on undefined_class: `const CometChatThreadHeader()` in a constructor
  // position is reported as creation_with_non_type. This is the single most
  // important drift class the catalog exists to prevent — never drop these.
  "creation_with_non_type", "new_with_non_type", "const_with_non_type", "not_a_type",
]);

// Placeholder identifiers are FRAGMENT NOISE, not drift: a recipe legitimately says
// `selectedUser` without declaring it, so a diagnostic naming only host identifiers
// is filtered. But ANY error that names a CometChat* symbol is drift by definition —
// the kit surface is exactly what this gate owns. isKitError therefore fails CLOSED:
// the code set above, PLUS any error whose message mentions a CometChat* symbol, so a
// diagnostic code we didn't enumerate can never silently pass (the creation_with_non_type
// miss found by the negative-control test).
const COMETCHAT_RE = /CometChat[A-Za-z0-9_]*/;

// Names the document itself declares across its fences (classes/enums/mixins/typedefs).
const DECL_RE = /(?:^|[\s;{])(?:abstract\s+)?(?:class|mixin|enum|typedef|extension)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
// Guides also define helper FUNCTIONS across fences (`Future<User> fetchCometChatUser(...)`),
// which are just as reader-owned as a helper class.
const FUNC_DECL_RE = /(?:^|\n)\s*(?:static\s+)?(?:Future<[^>]*>|void|[A-Za-z_][A-Za-z0-9_<>,?\s]*?)\s+([a-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?:async\s*)?\{/g;
function localDecls(file) {
  const src = readFileSync(file, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/```(?:dart|flutter)[^\n]*\n([\s\S]*?)```/g)) {
    for (const d of m[1].matchAll(DECL_RE)) names.add(d[1]);
    for (const d of m[1].matchAll(FUNC_DECL_RE)) names.add(d[1]);
  }
  return names;
}

/**
 * Byte ranges of OLD-VERSION tabs — fences inside them are illustrative, not current API.
 *
 * A migration page shows the old call next to the new one, inside `<Tabs>` with `<Tab title="v4">`
 * and `<Tab title="v5">`. The v4 snippet is SUPPOSED to use the removed API; reporting it as drift
 * is a false positive, and "fixing" it would destroy the page's whole point. On
 * /calls/flutter/migration-guide-v5 that was 8 of 10 reported errors — enough noise to hide the 2
 * real ones.
 *
 * The rule is self-describing rather than a maintained page list: within one `<Tabs>` group whose
 * titles are ALL version-like (`v4`, `v5`, …), every tab except the highest version is old. A group
 * with any non-version title (`Groovy`, `Kotlin`) is left entirely alone — those are alternatives,
 * not history, and both halves must compile.
 */
function staleTabRanges(src) {
  const ranges = [];
  const groupRe = /<Tabs>([\s\S]*?)<\/Tabs>/g;
  let g;
  while ((g = groupRe.exec(src))) {
    const groupStart = g.index + g[0].indexOf(g[1]);
    const tabRe = /<Tab\s+title="([^"]*)"\s*>([\s\S]*?)<\/Tab>/g;
    const tabs = [];
    let t;
    while ((t = tabRe.exec(g[1]))) {
      const bodyStart = groupStart + t.index + t[0].indexOf(t[2]);
      tabs.push({ title: t[1].trim(), start: bodyStart, end: bodyStart + t[2].length });
    }
    if (tabs.length < 2) continue;
    const versions = tabs.map((x) => /^v(\d+)$/i.exec(x.title));
    if (versions.some((v) => v === null)) continue;          // not a version group — leave it alone
    const nums = versions.map((v) => Number(v[1]));
    const newest = Math.max(...nums);
    tabs.forEach((tab, i) => { if (nums[i] !== newest) ranges.push([tab.start, tab.end]); });
  }
  return ranges;
}

function extractFences(file) {
  const src = readFileSync(file, "utf8");
  const stale = staleTabRanges(src);
  const inStaleTab = (pos) => stale.some(([a, b]) => pos >= a && pos < b);
  const out = [];
  const re = /```(?:dart|flutter)[^\n]*\n([\s\S]*?)```/g;
  let m, idx = 0;
  while ((m = re.exec(src))) {
    const body = m[1];
    if (!/import\s+["']package:cometchat/.test(body) && !COMETCHAT_RE.test(body)) continue; // real recipe, not prose
    if (/tier2-version-gated/.test(body)) continue;  // API newer than the pinned kit
    // An old-version tab still consumes an index, so fence numbering stays stable against the
    // page whether or not this filter is on — a reported "#5" means the same fence either way.
    if (inStaleTab(m.index)) { idx++; continue; }
    out.push({ idx: idx++, body });
  }
  return out;
}

// Split a fence into its import lines and the rest (imports must be file-top in Dart).
function splitImports(body) {
  const lines = body.split("\n");
  const imports = [], rest = [];
  for (const l of lines) {
    if (/^\s*(import|export|part)\s+['"]/.test(l)) imports.push(l.trim());
    else rest.push(l);
  }
  // Every fence needs the kit + material in scope even when the snippet omitted them
  // (recipes routinely elide imports); adding them can only RESOLVE symbols, never
  // manufacture a kit-API error, so this cannot mask drift.
  const have = imports.join("\n");
  // A CALLS-SDK fence needs the calls barrel, and `User` is exported by BOTH it and the chat
  // barrel — so importing both unqualified is `ambiguous_import`, or (worse) resolves `User` to
  // the wrong package and reports a type mismatch between two classes with the same name. That
  // is not drift; it is the injector's own doing. Real apps hit it too, which is why the ringing
  // page now documents `hide User` — so mirror exactly that here rather than inventing a fix.
  // Detect the calls SDK by any of its DISTINCTIVE top-level types, not just `CometChatCalls`.
  // Gating on the entry-point class alone missed every fence that only touches a live session —
  // `CallSession`, the listener classes, `SessionSettingsBuilder` — which is most of them, and
  // those came back as one giant phantom sweep (`Undefined class 'ButtonClickListeners'`).
  const CALLS_SDK_TYPES = /\b(CometChatCalls|CallSession|SessionSettings(?:Builder)?|CallAppSetting(?:s|Builder)|CallToken|CometChatCallsException|CometChatOngoingCallService|Transcript(?:Request(?:Builder)?)?|CallLogRequest(?:Builder)?|(?:SessionStatus|ParticipantEvent|MediaEvent|ButtonClick|Layout)Listeners)\b/;
  const usesCallsSdk = CALLS_SDK_TYPES.test(have + "\n" + rest.join("\n")) || /package:cometchat_calls_sdk\//.test(have);
  if (usesCallsSdk && !/package:cometchat_calls_sdk\//.test(have)) {
    imports.unshift("import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';");
  }
  if (!/package:flutter\/material\.dart/.test(have)) imports.unshift("import 'package:flutter/material.dart';");
  if (!/package:cometchat_chat_uikit\//.test(have)) imports.unshift("import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';");
  if (!/package:cometchat_sdk\//.test(have)) {
    imports.unshift(usesCallsSdk
      ? "import 'package:cometchat_sdk/cometchat_sdk.dart' hide User;"
      : "import 'package:cometchat_sdk/cometchat_sdk.dart';");
  }
  // Calls widgets (CometChatOutgoingCall, CometChatIncomingCall, ...) resolve ONLY from the
  // calls barrel. Import it too so a calls page isn't reported as one giant phantom sweep.
  if (!/cometchat_calls_uikit\.dart/.test(have)) imports.unshift("import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart';");
  return { imports: [...new Set(imports)].join("\n"), rest: rest.join("\n") };
}

const SHAPES = [
  { name: "as-is", build: (imp, rest, n) => `${imp}\n${rest}\n` },
  { name: "body-wrapped", build: (imp, rest, n) => `${imp}\n// ignore_for_file: unused_element\nFuture<void> _fence$n() async {\n${rest}\n}\n` },
  // DOC snippets are overwhelmingly a bare widget EXPRESSION with no trailing semicolon
  // (`CometChatSearch(onBack: () {})`). That parses as neither a file nor a statement, so
  // without this shape a docs run silently checks almost nothing — which is exactly what
  // happened the first time this engine was pointed at the Flutter pages (4 of 22 fences).
  { name: "expr-wrapped", build: (imp, rest, n) => `${imp}\n// ignore_for_file: unused_element\ndynamic _expr$n() => ${rest.trim().replace(/;\s*$/, "")};\n` },
  { name: "member-wrapped", build: (imp, rest, n) => `${imp}\n// ignore_for_file: unused_element\nclass _Fence$n extends StatelessWidget {\n  const _Fence$n({super.key});\n${rest}\n}\n` },
  // A fence that MIXES top-level declarations with loose statements parses in none of the shapes
  // above: statements are illegal at file scope, and Dart has no local class declaration, so
  // wrapping the whole thing in a function is illegal too. That combination is not exotic — it is
  // what a realistic recipe looks like once listeners became classes ("here is the listener class,
  // now register it"). Twelve fences on /calls/flutter were unchecked for exactly this reason, and
  // an unchecked fence is where defects hide: the 34-site abstract-listener bug sat partly in them.
  //
  // So split the fence instead of choosing one shape for all of it: declarations stay at file
  // scope, the remaining statements go in a wrapper. Both halves are still compiled together
  // against the real package, so nothing is skipped to make the fence parse.
  { name: "split-decls", build: (imp, rest, n) => {
      const { decls, stmts } = splitTopLevel(rest);
      if (!decls.trim() || !stmts.trim()) return null;   // not a mixed fence — let another shape own it
      return `${imp}\n// ignore_for_file: unused_element\n${decls}\nFuture<void> _fence$n() async {\n${stmts}\n}\n`;
    } },
];

/**
 * Split a fence body into top-level declarations and everything else, by brace depth.
 *
 * A declaration is a `class` / `mixin` / `enum` / `extension` / `typedef` at depth 0, or a
 * top-level function (a signature at depth 0 whose line ends in `{`). Everything at depth 0 that
 * is not part of one of those is a statement. Comments and blank lines follow whichever side they
 * precede, so a doc comment stays attached to its declaration.
 */
function splitTopLevel(body) {
  const lines = body.split("\n");
  const decls = [], stmts = [];
  let depth = 0, inDecl = false, pending = [];
  const DECL_START = /^\s*(?:@\w+\s+)*(?:abstract\s+|final\s+|base\s+|sealed\s+|interface\s+|mixin\s+)*(?:class|mixin|enum|extension|typedef)\s/;
  const FUNC_START = /^\s*(?:Future<[^>]*>|void|[A-Z][\w<>,?\s]*|[a-z]\w*)\s+[_a-zA-Z]\w*\s*\([^)]*\)\s*(?:async\s*)?\{\s*$/;
  for (const raw of lines) {
    const line = raw;
    if (depth === 0 && !inDecl) {
      if (/^\s*(\/\/|$)/.test(line)) { pending.push(line); continue; }   // hold comments/blanks
      if (DECL_START.test(line) || FUNC_START.test(line)) {
        decls.push(...pending, line); pending = []; inDecl = true;
      } else {
        stmts.push(...pending, line); pending = [];
      }
    } else {
      (inDecl ? decls : stmts).push(line);
    }
    for (const ch of line) { if (ch === "{") depth++; else if (ch === "}") depth--; }
    if (inDecl && depth <= 0) { inDecl = false; depth = 0; }
  }
  (inDecl ? decls : stmts).push(...pending);
  return { decls: decls.join("\n"), stmts: stmts.join("\n") };
}

const FENCE_DIR = join(projectAbs, "lib", "__fences__");
const rel = (f) => f.replace(ROOT + "/", "");

// Analyze the CURRENT fence dir; returns diagnostics as {file, code, msg}.
const DIAG_RE = /^\s*(error|warning|info)\s+•\s+(.*?)\s+•\s+(?:.*?)__fences__\/(.+?\.dart):(\d+):(\d+)\s+•\s+(\S+)\s*$/;
function analyze() {
  let raw = "";
  try {
    raw = execSync(`flutter analyze --no-pub .`, { cwd: projectAbs, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch (e) { raw = `${e.stdout || ""}${e.stderr || ""}`; }
  const diags = [];
  for (const line of raw.split("\n")) {
    const m = line.match(DIAG_RE);
    if (m) diags.push({ severity: m[1], msg: m[2], file: m[3], code: m[6] });
  }
  return diags;
}

// A Dart SYNTAX error means the shape is wrong (try the next shape), not drift.
const SYNTACTIC = /^(expected_|unexpected_|missing_|named_parameter_outside|positional_after|illegal_|invalid_|annotation_|const_|factory_|getter_|setter_|method_|class_in_class|top_level|directive_after|import_directive_after_part|experiment_not_enabled|extraneous_modifier|abstract_|field_initializ|local_function_declaration|declared_in_)/;
const isSyntactic = (d) => d.severity === "error" && SYNTACTIC.test(d.code);
// NAME-RESOLUTION codes name the unresolved symbol IN the message, so they can be
// attributed: `ThreadScreen`/`navigateToUserChat` are the reader's own widgets/helpers
// (legitimate placeholders in a recipe), while `CometChatThreadHeader` is a phantom.
// Gate these on the name being a CometChat symbol. Every OTHER code is a USAGE error
// (bad named param, wrong arg count/type/order, missing required arg, bad member access)
// that only arises at a call site we reached BY constructing a kit widget — those always
// count, even though the message names the parameter rather than the widget.
const NAME_RESOLUTION_CODES = new Set([
  "undefined_class", "undefined_function", "undefined_identifier",
  "creation_with_non_type", "new_with_non_type", "const_with_non_type", "not_a_type",
  "non_type_as_type_argument",
]);
// MEMBER-ACCESS codes ("The getter 'x' isn't defined for the type 'T'") are real drift
// only when T is a kit/SDK type. The kit's model types are UN-prefixed (User, Group,
// Conversation, BaseMessage, ...), so a CometChat*-only test would miss real bugs like
// `Group.membersCount`; conversely `YourHomeScreen isn't defined for the type MyApp` is
// the reader's own code. Attribute by the RECEIVER type instead.
const MEMBER_ACCESS_CODES = new Set(["undefined_method", "undefined_getter", "undefined_setter"]);
const KIT_TYPE_RE = /^(CometChat[A-Za-z0-9_]*|User|Group|GroupMember|Conversation|BaseMessage|TextMessage|MediaMessage|CustomMessage|Action|Call|CallLog|AppEntity|Attachment|Exception|UIKitSettings|UIKitSettingsBuilder|Translations[A-Za-z]*|AttachmentTile)$/;
const isKitError = (d) => {
  if (d.severity !== "error" || isSyntactic(d)) return false;
  if (d.code === "uri_does_not_exist" || d.code === "uri_has_not_been_generated") {
    return /package:cometchat/.test(d.msg);      // relative imports = reader's own files
  }
  if (NAME_RESOLUTION_CODES.has(d.code)) {
    const named = d.msg.match(/'([A-Za-z_][A-Za-z0-9_]*)'/);
    if (named && DOC_DECLARED.has(named[1])) return false;   // the doc defines it itself
    return COMETCHAT_RE.test(d.msg);
  }
  if (MEMBER_ACCESS_CODES.has(d.code)) {
    const m = d.msg.match(/for the type '([^']+)'/);
    if (m) return KIT_TYPE_RE.test(m[1]) || COMETCHAT_RE.test(d.msg);
    return COMETCHAT_RE.test(d.msg);
  }
  return KIT_ERROR_CODES.has(d.code) || COMETCHAT_RE.test(d.msg);
};

// ── Shape resolution: write every fence in shape 1, analyze once, and demote only
// the fences that showed a SYNTAX error to the next shape. Batching keeps this to a
// few analyzer runs total instead of one per fence.
if (!process.env.KEEP_FENCES) rmSync(FENCE_DIR, { recursive: true, force: true });
mkdirSync(FENCE_DIR, { recursive: true });

const fences = [];
const DOC_DECLARED = new Set();   // symbols the docs themselves define (reader-owned)
for (const file of files) {
  if (!existsSync(file)) { console.error(`skip (not found): ${file}`); continue; }
  const name = rel(file).replace(/[^A-Za-z0-9_]/g, "_").toLowerCase();
  for (const n of localDecls(file)) DOC_DECLARED.add(n);   // reader-owned symbols
  for (const f of extractFences(file)) {
    const { imports, rest } = splitImports(f.body);
    fences.push({ id: `${name}__${f.idx}`, src: rel(file), idx: f.idx, imports, rest, shape: 0, dead: false });
  }
}
if (!fences.length) {
  console.log(`No import-bearing dart fence(s) found in ${files.length} file(s) — nothing to check.`);
  if (!process.env.KEEP_FENCES) rmSync(FENCE_DIR, { recursive: true, force: true });
  process.exit(0);
}

const writeAll = () => {
  rmSync(FENCE_DIR, { recursive: true, force: true });
  mkdirSync(FENCE_DIR, { recursive: true });
  for (const f of fences) {
    if (f.dead) continue;
    // A shape may DECLINE a fence by returning null (split-decls does, for anything that is not
    // a declarations+statements mix). Advance to the next shape rather than writing "null" into
    // the file, which would surface as a bogus syntax error and demote the fence for the wrong
    // reason.
    let shape = SHAPES[f.shape], built = shape.build(f.imports, f.rest, f.idx);
    while (built == null && f.shape < SHAPES.length - 1) {
      f.shape++;
      shape = SHAPES[f.shape];
      built = shape.build(f.imports, f.rest, f.idx);
    }
    if (built == null) { f.dead = true; continue; }
    writeFileSync(join(FENCE_DIR, `${f.id}.dart`),
      `// @fence ${f.src} #${f.idx} [${shape.name}]\n` + built);
  }
};

let diags = [];
for (let pass = 0; pass < SHAPES.length + 1; pass++) {
  writeAll();
  diags = analyze();
  const broken = new Set(diags.filter(isSyntactic).map((d) => d.file.replace(/\.dart$/, "")));
  if (!broken.size) break;
  for (const f of fences) {
    if (f.dead || !broken.has(f.id)) continue;
    if (f.shape + 1 < SHAPES.length) f.shape += 1;   // try the next shape
    else f.dead = true;                              // parses in no shape → strip
  }
}

const live = fences.filter((f) => !f.dead);
const stripped = fences.filter((f) => f.dead);
const byShape = SHAPES.map((s, i) => `${live.filter((f) => f.shape === i).length} ${s.name}`).join(" · ");
console.log(`Extracted ${fences.length} fence(s) from ${files.length} file(s) → ${PROJECT}/lib/__fences__`);
console.log(`Shapes: ${byShape}${stripped.length ? ` · ${stripped.length} unparseable (stripped)` : ""}`);

const kitErrors = diags.filter(isKitError);
if (!process.env.KEEP_FENCES) rmSync(FENCE_DIR, { recursive: true, force: true });

if (stripped.length) {
  // Never let a shrinking denominator masquerade as a pass (RULES: no silent caps).
  console.log(`\n⚠️  ${stripped.length} fence(s) parsed in NO shape and were NOT checked:`);
  for (const f of stripped) console.log(`     ${f.src} #${f.idx}`);
}
if (kitErrors.length === 0) {
  console.log(`\n✅ Tier-2 (dart): no kit-API errors across ${live.length} analyzed fence(s).`);
  process.exit(0);
}
console.log(`\n❌ ${kitErrors.length} kit-API error(s) — real symbol/signature/import drift:`);
for (const e of kitErrors) console.log(`  [${e.file}] ${e.code}: ${e.msg}`);
process.exit(1);
