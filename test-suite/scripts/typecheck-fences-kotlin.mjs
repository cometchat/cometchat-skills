#!/usr/bin/env node
/**
 * typecheck-fences-kotlin.mjs — Tier-2 compile gate for NATIVE (Kotlin/Android) skill
 * families: compile the skills' Kotlin code fences against the REAL pinned UI Kit +
 * Chat SDK, catching signature/import drift that the Tier-1 name-only catalog can't
 * see (a wrong arg count, a member that moved, a symbol that exists but isn't public).
 *
 * The Kotlin sibling of typecheck-fences.mjs (which does the same for TS/React). Same
 * contract: extract import-bearing fences → stage them into a project that has the kit
 * installed → compile → report ONLY kit-API errors.
 *
 * Strategy: extract every ```kotlin fence that imports `com.cometchat.…` (real recipe
 * blocks, not prose fragments), wrap each in its own package/file inside the Gradle
 * probe project, run `:fences:compileDebugKotlin`, and classify the diagnostics:
 *   • KIT-API errors  → the fence references a CometChat symbol/signature that does not
 *                       exist as written. This FAILS the gate (exit 1).
 *   • FRAGMENT noise  → unresolved placeholder identifiers the recipes legitimately use
 *                       (`uid`, `binding`, `R`, a screen the reader supplies). Fences that
 *                       only produce these are stripped and counted, like the TS gate's
 *                       non-parseable-fragment pass.
 *
 * Usage:
 *   node test-suite/scripts/typecheck-fences-kotlin.mjs \
 *     --project test-suite/typecheck/android-v6 --discover android-v6 [--keep]
 * Exit: 0 no kit-API errors · 1 kit-API drift · 2 BLOCKED(setup) — toolchain/SDK/kit
 *       unavailable (honest, never fake-green).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const KEEP = args.includes("--keep");

// ── derive family metadata from families.json (RULES.md §22) ─────────────────
const FAMILIES_PATH = join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json");
const { families: FAM_DATA, default: DEFAULT_FAMILY } = JSON.parse(readFileSync(FAMILIES_PATH, "utf8"));

const PROJECT = opt("project", null);
const DISCOVER = opt("discover", DEFAULT_FAMILY);
const projectAbs = PROJECT ? join(ROOT, PROJECT) : null;

// ── families: skill-dir globs derived from families.json ─────────────────────
// --discover accepts a catalog-basename prefix (e.g. the part before "-v<N>").
// All non-parked, non-template families whose platform matches contribute their
// reviewsSkills globs — so adding a new Android family requires no edit here.
const discoverPlatform = DISCOVER.replace(/-v\d+$/, "");
const discoverGlobs = Object.values(FAM_DATA)
  .filter((f) => f.platform === discoverPlatform && !f.parked && !/^template/i.test(f._status || ""))
  .flatMap((f) => (f.reviewsSkills || []).map((p) =>
    p.endsWith("-") ? new RegExp("^" + p) : new RegExp("^" + p + "$")));

// ── BLOCKED(setup) preflight — fail honestly, with the fix ───────────────────
function blocked(msg, fix) {
  console.error(`\n⛔ BLOCKED(setup): ${msg}`);
  if (fix) console.error(`   → ${fix}`);
  console.error(`   The gate did NOT run — this is not a pass.`);
  process.exit(2);
}
if (!projectAbs) blocked(`--project is required`, `pass --project test-suite/typecheck/<family>`);
if (!existsSync(projectAbs)) blocked(`probe project not found: ${PROJECT}`);
const gradlew = join(projectAbs, "gradlew");
if (!existsSync(gradlew)) blocked(`no Gradle wrapper in ${PROJECT}`, `copy gradle/wrapper + gradlew from an Android project`);
const localProps = join(projectAbs, "local.properties");
if (!existsSync(localProps) || !/sdk\.dir=/.test(readFileSync(localProps, "utf8"))) {
  blocked(`Android SDK location unknown (${PROJECT}/local.properties has no sdk.dir)`,
    `write sdk.dir=/path/to/Android/sdk into ${PROJECT}/local.properties (git-ignored)`);
}

// ── discover skill files whose fences import the kit ─────────────────────────
const globs = discoverGlobs;
if (!globs.length) blocked(`unknown --discover platform "${DISCOVER}" — no matching families found in families.json`);
const NEEDLE = "import com.cometchat.";
const files = [];
const collect = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) collect(p);
    else if (e.name.endsWith(".md") && readFileSync(p, "utf8").includes(NEEDLE)) files.push(p);
  }
};
const skillsRoot = join(ROOT, "skills");
for (const d of readdirSync(skillsRoot, { withFileTypes: true })) {
  if (d.isDirectory() && globs.some((g) => g.test(d.name))) collect(join(skillsRoot, d.name));
}

// ── extract + stage fences ───────────────────────────────────────────────────
const FENCE_RE = /```kotlin[^\n]*\n([\s\S]*?)```/g;
// Placeholders the recipes legitimately reference without defining. Provided as
// function parameters so the fence body compiles; anything ELSE unresolved is real.
const PLACEHOLDERS = [
  ["context", "android.content.Context"],
  ["uid", "String"],
  ["authToken", "String"],
  ["user", "com.cometchat.chat.models.User"],
  ["group", "com.cometchat.chat.models.Group"],
  ["message", "com.cometchat.chat.models.BaseMessage"],
  ["conversation", "com.cometchat.chat.models.Conversation"],
  ["lifecycleScope", "kotlinx.coroutines.CoroutineScope"],
];

function extractFences(file) {
  const src = readFileSync(file, "utf8");
  const out = [];
  let m, idx = 0;
  while ((m = FENCE_RE.exec(src))) {
    const body = m[1];
    if (!body.includes(NEEDLE)) continue;               // real recipe, not a fragment
    if (/gate-skip/.test(body)) continue;               // explicitly excluded
    out.push({ idx: idx++, body });
  }
  return out;
}

const FENCE_DIR = join(projectAbs, "fences", "src", "main", "kotlin", "__fences__");
rmSync(FENCE_DIR, { recursive: true, force: true });
mkdirSync(FENCE_DIR, { recursive: true });

const manifest = [];
let n = 0;
for (const file of files) {
  const rel = file.replace(ROOT + "/", "");
  for (const f of extractFences(file)) {
    const id = `f${n++}`;
    const lines = f.body.split("\n");
    const imports = lines.filter((l) => /^\s*import\s+/.test(l)).map((l) => l.trim());
    const rest = lines.filter((l) => !/^\s*import\s+/.test(l) && !/^\s*package\s+/.test(l)).join("\n");
    // How to stage the body so it compiles in the SAME context the recipe assumes —
    // otherwise the compiler reports context errors (Compose/coroutine) that look like
    // kit drift but are staging artifacts:
    //   • declares a class/object/interface or an annotated (@Composable) function → it is
    //     already top-level Kotlin; emit as-is.
    //   • calls Compose APIs (Modifier/remember/Scaffold/a composable kit call) → wrap in a
    //     @Composable function (composable invocations are only legal from one).
    //   • otherwise → wrap in a suspend function (covers `collect`/`await` style snippets)
    //     that supplies the placeholder identifiers the recipe assumes.
    const declaresTopLevel = /^\s*(?:@[A-Za-z]|(?:private |internal |public |abstract |sealed |open |data )*(?:class|object|interface)\s)/m.test(rest);
    const usesCompose = /\bModifier\b|\bremember\b|\bScaffold\b|\bLaunchedEffect\b|\bComposable\b|\bColumn\(|\bBox\(|CometChatTheme\(/.test(rest);
    const used = PLACEHOLDERS.filter(([nme]) => new RegExp(`\\b${nme}\\b`).test(rest));
    const params = used.map(([nme, type]) => `${nme}: ${type}`).join(", ");
    // Non-Compose recipes are written from inside an Activity (`init(this, …)`), so stage
    // them as an Activity EXTENSION function — otherwise `this` doesn't resolve and the
    // compiler reports a context error that looks like drift.
    const wrapper = usesCompose
      ? [`@androidx.compose.runtime.Composable`, `private fun fence(${params}) {`]
      : [`private suspend fun androidx.activity.ComponentActivity.fence(${params}) {`];
    const src = [
      `@file:Suppress("unused", "UNUSED_VARIABLE", "UNUSED_PARAMETER", "UNUSED_EXPRESSION")`,
      `package __fences__.${id}`,
      ``,
      ...imports,
      ``,
      `// @fence ${rel} #${f.idx}`,
      declaresTopLevel ? rest : [...wrapper, rest, `}`].join("\n"),
      ``,
    ].join("\n");
    writeFileSync(join(FENCE_DIR, `${id}.kt`), src);
    manifest.push({ id, file: rel, idx: f.idx });
  }
}
console.log(`Extracted ${manifest.length} import-bearing kotlin fence(s) from ${files.length} skill file(s) into ${PROJECT}/fences/src/main/kotlin/__fences__`);
if (!manifest.length) { console.log("nothing to compile."); process.exit(0); }

// ── compile ──────────────────────────────────────────────────────────────────
// Kotlin 2.x diagnostic line shape (VERIFIED against the real compiler output, not
// assumed — the message text follows the position directly, with NO literal "error:"):
//   e: file:///abs/path/__fences__/f3.kt:9:1 Syntax error: Expecting a top level declaration.
//   e: file:///abs/path/__fences__/f7.kt:12:5 Unresolved reference: foo
const DIAG_RE = /^e:\s+\S*__fences__\/(f\d+)\.kt:(\d+):(\d+)\s+(.*)$/;
function runGradle() {
  try {
    execFileSync(gradlew, [":fences:compileDebugKotlin", "--console=plain", "-q"],
      { cwd: projectAbs, stdio: ["ignore", "pipe", "pipe"], timeout: 15 * 60 * 1000 });
    return { ok: true, out: "" };
  } catch (e) {
    const out = `${e.stdout || ""}${e.stderr || ""}`;
    if (/Could not (resolve|find)\s+com\.cometchat/i.test(out))
      blocked("the pinned CometChat kit could not be resolved from Cloudsmith",
        "check network access to dl.cloudsmith.io and the pinned version in fences/build.gradle.kts");
    if (/SDK location not found|Failed to install the following Android SDK|No version of NDK/i.test(out))
      blocked("Android SDK/toolchain incomplete", "install the required compileSdk platform via Android Studio / sdkmanager");
    if (/Unsupported class file major version|Could not determine java version|JAVA_HOME/i.test(out))
      blocked("JDK mismatch for AGP", "use JDK 17+ (AGP 8.x); set JAVA_HOME accordingly");
    return { ok: false, out };
  }
}

const diagsByFence = (text) => {
  const per = new Map();
  for (const line of text.split("\n")) {
    const m = line.trim().match(DIAG_RE);
    if (!m) continue;
    const [, id, ln, , msg] = m;
    if (!per.has(id)) per.set(id, []);
    per.get(id).push({ line: ln, msg });
  }
  return per;
};
// A diagnostic is KIT-API drift only when it implicates a CometChat symbol. Kotlin
// reports an unresolved kit symbol as "Unresolved reference: CometChatFoo" and a bad
// signature as "None of the following candidates is applicable…" / argument errors on
// a line that names the symbol — so match the message OR the staged source line.
const fenceSrc = (id) => { try { return readFileSync(join(FENCE_DIR, `${id}.kt`), "utf8").split("\n"); } catch { return []; } };
const isKitDiag = (id, d) => {
  const srcLine = fenceSrc(id)[Number(d.line) - 1] || "";
  const unresolved = d.msg.match(/Unresolved reference:?\s*'?([A-Za-z_][\w]*)'?/i);
  if (unresolved) {
    const sym = unresolved[1];
    if (/^CometChat/.test(sym)) return true;                       // a kit type that doesn't exist
    // A MEMBER access on a kit receiver that doesn't resolve IS drift
    // (`CometChatUIKit.totallyBogusMethod(…)`, `CometChatEvents.nonexistentProperty`).
    // A BARE identifier is a placeholder the recipe expects the reader to supply.
    const isMemberOfKit = new RegExp(`CometChat[\\w.]*\\s*\\.\\s*${sym}\\b`).test(srcLine) ||
      new RegExp(`\\.\\s*${sym}\\b`).test(srcLine) && /CometChat/.test(srcLine);
    return isMemberOfKit;
  }
  // Everything else counts as drift when it implicates the kit — by message, or by the
  // staged source line (argument/overload errors name the callee on that line).
  return /CometChat|com\.cometchat/i.test(d.msg) || /CometChat/i.test(srcLine);
};

let { ok, out } = runGradle();
const stripped = new Set();
// Fragment pass (the Kotlin analogue of the TS gate's non-parseable pass): a fence whose
// errors are ALL non-kit — a syntax error from an illustrative snippet, or an unresolved
// placeholder the reader supplies — is a fragment, not drift. Drop it and recompile so it
// cannot mask real errors in the OTHER fences (a syntax error aborts the whole module).
for (let pass = 0; !ok && pass < 6; pass++) {
  const per = diagsByFence(out);
  if (!per.size) break;
  const dropping = [...per.entries()].filter(([id, ds]) => ds.every((d) => !isKitDiag(id, d)));
  if (!dropping.length) break;
  for (const [id] of dropping) { rmSync(join(FENCE_DIR, `${id}.kt`), { force: true }); stripped.add(id); }
  ({ ok, out } = runGradle());
}

// ── classify what remains ────────────────────────────────────────────────────
const kitErrors = [];
if (!ok) {
  for (const [id, ds] of diagsByFence(out)) {
    for (const d of ds) {
      if (!isKitDiag(id, d)) continue;
      const src = manifest.find((x) => x.id === id);
      kitErrors.push({ id, where: src ? `${src.file} #${src.idx}` : id, line: d.line, msg: d.msg });
    }
  }
  // Compile failed but nothing was attributable to a fence: a project/toolchain problem,
  // NOT a green result. Fail as BLOCKED(setup) rather than silently passing.
  if (!kitErrors.length && !diagsByFence(out).size) {
    console.error(out.split("\n").filter((l) => /error|FAILURE|Caused by/i.test(l)).slice(0, 12).join("\n"));
    blocked("the probe project failed to compile for a non-fence reason",
      `run: (cd ${PROJECT} && ./gradlew :fences:compileDebugKotlin) and fix the project`);
  }
}

if (!KEEP) rmSync(FENCE_DIR, { recursive: true, force: true });
const checked = manifest.length - stripped.size;
const note = stripped.size ? ` (${stripped.size} illustrative fragment fence(s) skipped)` : "";

if (ok || kitErrors.length === 0) {
  console.log(`\n✅ Tier-2 (kotlin): no kit-API errors across ${checked} compiled fence(s)${note}.`);
  process.exit(0);
}
console.log(`\n❌ ${kitErrors.length} kit-API error(s) — real signature/import drift vs the pinned kit:`);
for (const e of kitErrors) console.log(`  [${e.where}] line ${e.line}: ${e.msg}`);
process.exit(1);
