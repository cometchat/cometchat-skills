#!/usr/bin/env node
/**
 * cometchat-skills — the deterministic "hands" layer of the pack.
 *
 * The v5 pivot kept the brain (skills/) and the materials (catalog/features/
 * contracts/peers) but dropped the CLI the legacy pack had. This restores a
 * small, dependency-free, DETERMINISTIC CLI so the steps an LLM should NOT
 * improvise — detect the project, install skills, run the verification gates,
 * refresh the oracle — are real commands with stable JSON contracts.
 *
 *   npx @cometchat/skills <command> [options]
 *
 * Commands:
 *   detect            Probe the CWD → framework / installed UI Kit / version_conflict (tools/detect.md contract)
 *   add [--ide <a>]   Install THIS project's family skills for an agent (claude default; cursor/codex/copilot/… or `all`)
 *   list              List the skills this pack ships (from peers.yaml + skills/)
 *   info <slug>       Show one skill's triggers + compatibility
 *   verify [tier]     Run the safety-net gates: lint | catalog | fences | predicate | all (default all offline)
 *   catalog [--check] Refresh the Tier-1 symbol catalog from the installed kit (oracle refresh)
 *   doctor            Environment health check (node, kit install, catalog freshness, review state)
 *   version           Print the pack version
 *   help              This message
 *
 * Scope: every family in peers.yaml. Family-scoped paths/labels resolve from
 * peers.yaml + families.json (RULES.md §22) — never a hardcoded family.
 * Dependency-free (Node >=18 built-ins only). Every command supports --json.
 */
import {
  readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, cpSync, statSync, rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const PACK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CWD = process.cwd();
const argv = process.argv.slice(2);
const CMD = argv[0];
const JSON_OUT = argv.includes("--json");
const has = (f) => argv.includes(f);
const flagVal = (f, d) => {
  const i = argv.indexOf(f);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(f + "=")); // also accept --flag=value (e.g. --ide=cursor)
  return eq ? eq.slice(f.length + 1) : d;
};
// A value-taking flag given WITHOUT a value — a bare trailing `--ide`, or `--ide --global` —
// used to fall through to the default and silently install for Claude. Refuse it instead.
function requireFlagValue(f, supported) {
  const i = argv.indexOf(f);
  if (i < 0) return;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("-")) {
    console.error(`${f} needs a value\nsupported: ${supported.join(", ")}`);
    process.exit(2);
  }
}

function out(obj, human) {
  if (JSON_OUT) console.log(JSON.stringify(obj, null, 0));
  else human();
}
function readJSON(p) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }
// Resolve which family the CURRENT workspace belongs to, from families.json — the same single
// source the pack tools read (RULES.md §22). detect() already knows the framework; this maps it
// onto a family so no command has to name one.
// detect() -> the family THIS project actually uses. families.json is the dev
// oracle but is NOT packed (see package.json "files"), so an installed pack must
// resolve from peers.yaml, which ships. Hardcoding a family here is what put
// "React v7 UI Kit" atop every React Native AGENTS.md (AUDIT-101).
const FRAMEWORK_PLATFORM = {
  "react-native": "react-native", expo: "react-native",
  reactjs: "react", nextjs: "react", astro: "react", "react-router": "react",
  angular: "angular",
  // Native families detect() already recognises (pubspec / gradle / xcodeproj). Without
  // these, `add` in a native iOS/Android/Flutter project resolved no family and exited 3
  // with a false "no family" message even though detect() knew the framework.
  flutter: "flutter", android: "android", ios: "ios",
};
// NO "nearest family" fallback. Defaulting to react is what titled an Angular
// project's router "React v7 UI Kit" and installed 9 React skills into it — the
// same silent-substitution defect as AUDIT-101, one framework over (AUDIT-105).
// An unresolved family is reported, never guessed. `--family <platform>` is the
// explicit escape hatch for a monorepo root, where detect() sees no framework.
function resolvePeer(fw) {
  const live = (peers().peers || []).filter((p) => !p.parked && p.dirPrefix);
  requireFlagValue("--family", live.map((p) => p.platform));
  const forced = flagVal("--family");
  if (forced) {
    const hit = live.find((p) => p.platform === forced);
    if (!hit) {
      console.error(`unknown --family: ${forced}\nshippable: ${live.map((p) => p.platform).join(", ")}`);
      process.exit(2);
    }
    return hit;
  }
  return live.find((p) => p.platform === FRAMEWORK_PLATFORM[fw])
      || (live.length === 1 ? live[0] : null)
      || null;
}
const FAMILIES_JSON = join(PACK_ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json");
// The DEV-ONLY reviewer family for a peer (families.json is not packed → null on an npm install).
// Matched by CATALOG key — the one field both registries share. Matching by `platform` picked
// whichever family sorted first: an Angular project resolved to web-react-v7 (families.json's
// Angular platform is "web"), and React Native to rn-calls-v5 instead of rn-uikit-v5.
function reviewerFamily(peer) {
  const F = readJSON(FAMILIES_JSON);
  if (!peer || !F || !F.families) return null;
  const key = (f) => (f.catalog || "").replace(/^catalog\//, "").replace(/\.json$/, "");
  const hit = Object.entries(F.families)
    .find(([, f]) => !/^template\b/i.test(f._status || "") && key(f) === peer.catalog);
  if (!hit) return null;
  const [name, f] = hit;
  return { ...f, name, key: key(f), typecheckProject: f.typecheckProject || `test-suite/typecheck/${key(f)}` };
}
function resolveFamily() {
  const det = detect() || {};
  const fw = det.framework || "";
  const peer = resolvePeer(fw);
  if (!peer) failUnresolvedFamily(fw, det);
  const base = { label: peer.label, dirPrefix: peer.dirPrefix, kit_package: peer.kit_package, major: peer.major };
  const fam = reviewerFamily(peer);
  if (fam) return { ...fam, ...base };
  // ponytail: packed install — peers.yaml is the only shipped registry.
  return { platform: peer.platform, key: null, typecheckProject: null, ...base };
}

function failUnresolvedFamily(fw, det = {}) {
  {
    const live = (peers().peers || []).filter((x) => !x.parked && x.dirPrefix);
    console.error(
      `cannot resolve a CometChat family for this project.\n` +
      `  detected framework: ${fw || "(none)"}\n` +
      (det.hint ? `  hint: ${det.hint}\n` : "") +
      `  shippable families: ${live.map((x) => `${x.platform} (${x.label})`).join(", ") || "(none)"}\n\n` +
      (fw
        ? `There is no CometChat skills family for "${fw}" in this pack. Installing the nearest one\n` +
          `would hand you another framework's APIs — so nothing was written.\n`
        : `No framework was detected (a monorepo root looks like this). Run this inside the app\n` +
          `package, or name the family explicitly.\n`) +
      `\n  npx @cometchat/skills add --ide <agent> --family <${live.map((x) => x.platform).join("|")}>`
    );
    process.exit(3);
  }
}

function packVersion() { return (readJSON(join(PACK_ROOT, "package.json")) || {}).version || "0.0.0"; }

// ── detect — tools/detect.md contract (deterministic, offline) ───────────────
const TARGET_MAJOR = 7; // react UI Kit major these skills target (fallback when peers.yaml is absent)

// The UI Kit major EACH family targets, from peers.yaml `kit_package: "<npm-name>@<major>"`
// (react → 7, angular → 5, react-native → 5). "Not v7" is only a conflict for React: Angular v5
// and RN v5 are the CORRECT majors for their own families.
function jsKitTargets() {
  const t = {};
  for (const p of peers().peers || []) {
    const m = /^(@cometchat\/chat-uikit-[a-z-]+)@(\d+)$/.exec(p.kit_package || "");
    if (m && !p.parked) t[m[1]] = parseInt(m[2], 10);
  }
  if (!Object.keys(t).length) t["@cometchat/chat-uikit-react"] = TARGET_MAJOR;
  return t;
}
const FRAMEWORK_KIT = { angular: "@cometchat/chat-uikit-angular", "react-native": "@cometchat/chat-uikit-react-native", expo: "@cometchat/chat-uikit-react-native" };

function ccVersion(pkg, dep) {
  const v = (pkg.dependencies && pkg.dependencies[dep]) || (pkg.devDependencies && pkg.devDependencies[dep]);
  if (!v) return null;
  const m = v.match(/(\d+)\.(\d+)\.(\d+)/) || v.match(/(\d+)/);
  return { range: v, major: m ? parseInt(m[1], 10) : null };
}

// A REAL product package -- kit/sdk/calls, any peer, from peers.yaml -- never
// the AI-tooling package itself. The old check used "any @cometchat/* dependency
// or a .cometchat/ dir", and BOTH halves were tool-installation signals, not
// integration signals: @cometchat/skills always matches "@cometchat/*" (every
// project that can run this CLI has it installed), and .cometchat/skills is
// literally NEUTRAL_SKILLS_DIR -- the tool's OWN install target, created by any
// --ide antigravity/cursor/codex/... install regardless of whether the product
// was ever integrated. So existing_cometchat had read true from the moment the
// TOOL was installed, on every project, forever -- which matters because it is
// the load-bearing signal for the dispatcher's "already integrated, skip
// onboarding" branch (AUDIT-108).
function productPackageNames() {
  const y = existsSync(join(PACK_ROOT, "peers.yaml")) ? readFileSync(join(PACK_ROOT, "peers.yaml"), "utf8") : "";
  const raw = [...y.matchAll(/(?:kit|sdk|calls)_package:\s*"([^"]+)"/g)].map((m) => m[1]);
  return new Set(raw.map((pkg) => pkg.replace(/@[^@/]+$/, ""))); // strip trailing @<major>, keep the leading @scope
}

function detect() {
  const pkgPath = join(CWD, "package.json");
  const result = {
    framework: null, flutter_version: null, android_variant: null,
    installed_uikit: null, version_conflict: null, env_file: null, existing_cometchat: false,
    // CometChat-relevant repo signals (for cometchat-onboarding). Additive: null when
    // the evidence is absent (graceful degradation) — existing consumers ignore them.
    auth: null, styling: null, state: null, routing: null, ssr: null,
  };

  // JS ecosystem
  if (existsSync(pkgPath)) {
    const pkg = readJSON(pkgPath) || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const hasDep = (d) => Object.prototype.hasOwnProperty.call(deps, d);
    const hasAnyDep = (...ds) => ds.some(hasDep);
    // some deps are namespaced (e.g. @clerk/*, @react-router/*) — match by prefix too.
    const depKeys = Object.keys(deps);
    const hasDepPrefix = (p) => depKeys.some((d) => d === p || d.startsWith(p));
    const fileExists = (rel) => existsSync(join(CWD, rel));
    const globish = (names) => names.some(fileExists);

    let fwDep = null; // the dependency that decided the framework
    if (hasDep("@angular/core")) { result.framework = "angular"; fwDep = "@angular/core"; }
    else if (hasDep("expo")) { result.framework = "expo"; result.env_file = ".env"; fwDep = "expo"; }
    else if (hasDep("react-native")) { result.framework = "react-native"; result.env_file = ".env"; fwDep = "react-native"; }
    else if (hasDep("astro")) { result.framework = "astro"; result.env_file = ".env"; fwDep = "astro"; }
    else if (hasDep("next")) { result.framework = "nextjs"; result.env_file = ".env.local"; fwDep = "next"; }
    else if (hasDep("react-router-dom") || hasDep("@react-router/dev")) { result.framework = "react-router"; result.env_file = ".env"; fwDep = hasDep("react-router-dom") ? "react-router-dom" : "@react-router/dev"; }
    else if (hasDep("react")) { result.framework = "reactjs"; result.env_file = ".env"; fwDep = "react"; }

    if (result.framework === "angular") result.env_file = "src/environments/environment.ts";

    // A WORKSPACE ROOT (package.json `workspaces`, or pnpm-workspace.yaml) whose framework dep is
    // only a devDependency is tooling (storybook, lint, test config) — not an app. Auto-picking
    // React there installed the React skills at a monorepo root. Report it; the user runs inside
    // the app package or names the family. A root that lists the dep in `dependencies` IS an app.
    const wsRoot = !!pkg.workspaces || fileExists("pnpm-workspace.yaml");
    const inProdDeps = fwDep && pkg.dependencies && Object.prototype.hasOwnProperty.call(pkg.dependencies, fwDep);
    if (result.framework && wsRoot && !inProdDeps) {
      result.workspace_root = true;
      result.hint = `workspace root (${pkg.workspaces ? 'package.json "workspaces"' : "pnpm-workspace.yaml"}) with ` +
        `${fwDep} only in devDependencies — that is tooling, not an app. Run inside the app package ` +
        `(e.g. apps/web), or pass --family <platform>.`;
      result.framework = null; result.env_file = null;
    }

    // ── CometChat-relevant repo signals (deterministic, offline, graceful) ─────
    // auth
    if (hasDepPrefix("@auth/") || hasDep("next-auth")) result.auth = "nextauth";
    else if (hasDepPrefix("@clerk/")) result.auth = "clerk";
    else if (hasDep("firebase") || hasDepPrefix("@firebase/")) result.auth = "firebase";
    else if (hasDep("auth0") || hasDepPrefix("@auth0/")) result.auth = "auth0";
    else if (hasDep("@supabase/supabase-js") || hasDepPrefix("@supabase/")) result.auth = "supabase";
    // else null — custom auth isn't inferable from deps alone.

    // styling / design system
    if (hasDep("tailwindcss") || globish(["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "tailwind.config.mjs"])) result.styling = "tailwind";
    else if (hasDepPrefix("@mui/")) result.styling = "mui";
    else if (hasDep("styled-components")) result.styling = "styled-components";
    else if (hasDepPrefix("@chakra-ui/")) result.styling = "chakra";
    // css-modules is a convention, not a dep — leave to onboarding's repo read; null here.

    // state management
    if (hasDep("@reduxjs/toolkit") || hasDep("react-redux") || hasDep("redux")) result.state = "redux";
    else if (hasDep("zustand")) result.state = "zustand";
    else if (hasDep("mobx") || hasDepPrefix("mobx-react")) result.state = "mobx";
    else if (hasDep("recoil")) result.state = "recoil";
    else if (result.framework && /^(reactjs|nextjs|react-router|expo|react-native)$/.test(result.framework)) result.state = "context"; // React's built-in default
    // else null (e.g. angular has its own DI; leave null unless a lib is present)

    // routing
    if (result.framework === "nextjs") result.routing = fileExists("app") || fileExists("src/app") ? "next-app-router" : (fileExists("pages") || fileExists("src/pages") ? "next-pages-router" : "next-app-router");
    else if (hasDep("react-router-dom") || hasDepPrefix("@react-router/")) result.routing = "react-router";
    else if (hasDepPrefix("@tanstack/react-router")) result.routing = "tanstack-router";
    else if (hasDep("vue-router")) result.routing = "vue-router";
    else if (hasDep("expo-router")) result.routing = "expo-router";
    else if (hasDep("@angular/router") || result.framework === "angular") result.routing = "angular-router";
    // else null

    // SSR/CSR boundary
    if (hasDep("next") || hasDep("nuxt") || hasDep("@remix-run/react") || hasDepPrefix("@sveltejs/kit")) result.ssr = "ssr";
    else if (hasDep("astro")) result.ssr = "islands";
    else if (result.framework && /^(reactjs|react-router|expo|react-native)$/.test(result.framework)) result.ssr = "csr";
    // else null

    if (result.workspace_root) { result.auth = result.styling = result.state = result.routing = result.ssr = null; }

    // installed UI Kit — each JS family's kit, checked against THAT family's target major.
    const kits = [];
    for (const [name, target] of Object.entries(jsKitTargets())) {
      const v = ccVersion(pkg, name);
      if (!v) continue;
      // prefer the actually-installed version if node_modules is present
      const inst = readJSON(join(CWD, "node_modules", name, "package.json"));
      const version = inst && inst.version ? inst.version : v.range;
      const major = inst && inst.version ? parseInt(inst.version.split(".")[0], 10) : v.major;
      kits.push({ name, target, version, major });
    }
    if (kits.length) {
      const k = kits.find((x) => x.name === (FRAMEWORK_KIT[result.framework] || "@cometchat/chat-uikit-react")) || kits[0];
      result.installed_uikit = { package: k.name, version: k.version };
      if (k.major && k.major !== k.target) {
        result.version_conflict = { detail: `project has ${k.name}@${k.major} but these skills target v${k.target}` };
      }
      // two different UI Kits (e.g. react + angular) declared at different majors
      if (kits.length > 1 && new Set(kits.map((x) => x.major)).size > 1) {
        const short = (x) => x.name.replace("@cometchat/chat-uikit-", "");
        result.version_conflict = { detail: `two UI Kit majors declared (${kits.map((x) => `${short(x)} v${x.major}`).join(" + ")}) — pick one cohort` };
      }
    }
    // A REAL product package as a project dependency is the only reliable "already
    // integrated" signal. Do NOT also treat a `.cometchat/` dir as proof: it is this
    // TOOL's own install target (NEUTRAL_SKILLS_DIR), created on every `add`, so it made
    // every project read as integrated the moment the tooling was installed — the other
    // half of the AUDIT-108 false positive (the dependency half was already narrowed to
    // productPackageNames; this removes the dir half).
    result.existing_cometchat =
      Object.keys(deps).some((d) => productPackageNames().has(d));
  }

  // Non-JS scaffolds (light-touch — enough to fire version_conflict / routing)
  if (!result.framework && existsSync(join(CWD, "pubspec.yaml"))) {
    result.framework = "flutter";
    const pub = readFileSync(join(CWD, "pubspec.yaml"), "utf8");
    if (/cometchat_chat_uikit/.test(pub)) {
      result.existing_cometchat = true;
      const m = pub.match(/cometchat_chat_uikit:\s*["']?\^?(\d+)/);
      if (m) result.flutter_version = parseInt(m[1], 10) >= 6 ? "v6" : "v5";
      // installed_uikit was never populated on this branch, and version_conflict is
      // derived from it — so a Flutter project sitting on the wrong major could never
      // raise a conflict at all. Prefer the RESOLVED version in pubspec.lock over the
      // declared range: "^6.1.0" says what is allowed, the lock says what is installed.
      const declared = pub.match(/cometchat_chat_uikit:\s*["']?([^"'\s]+)/);
      let version = declared ? declared[1] : null;
      const lockPath = join(CWD, "pubspec.lock");
      if (existsSync(lockPath)) {
        const lock = readFileSync(lockPath, "utf8");
        const lm = lock.match(/^\s{2}cometchat_chat_uikit:[\s\S]*?^\s{4}version:\s*["']?([\d.]+)/m);
        if (lm) version = lm[1];
      }
      result.installed_uikit = { package: "cometchat_chat_uikit", version };
      const major = version ? parseInt(String(version).replace(/^\D+/, ""), 10) : null;
      if (major && major !== 6) {
        result.version_conflict = {
          detail: `project has cometchat_chat_uikit@${major} but these skills target v6`,
        };
      }
    }
    // The Flutter kit reads its credentials from a registered settings ASSET, not a dotenv
    // file (commit a placeholder — a registered asset must exist for a fresh clone to build;
    // cometchat-flutter-v6-core). Same reason the Android branch below names one. Leaving this
    // null pointed the user at nothing on the one step that must precede any render.
    result.env_file = "cometchat-settings.json";
  }
  // Android. BOTH DSLs — Groovy (.gradle) and Kotlin (.gradle.kts). Checking only the Groovy
  // names missed every Kotlin-DSL project, which is the majority AND what this pack's own install
  // block prescribes: `framework` came back null and the router could not route to Android at all.
  const GRADLE_MARKERS = ["settings.gradle", "settings.gradle.kts", "app/build.gradle",
                          "app/build.gradle.kts", "build.gradle", "build.gradle.kts"];
  if (!result.framework && GRADLE_MARKERS.some((f) => existsSync(join(CWD, f)))) {
    result.framework = "android";
    // Android credentials are NOT a dotenv file — they are the gitignored settings asset that
    // `CometChatUIKit.initFromSettings` reads. Reporting "(n/a)" left the user with no pointer at
    // all, on the one setup step that must happen before anything renders.
    result.env_file = "app/src/main/assets/cometchat-settings.json";
    const gradle = ["app/build.gradle", "app/build.gradle.kts", "build.gradle", "build.gradle.kts",
                    "gradle/libs.versions.toml"]
      .map((f) => join(CWD, f)).filter(existsSync).map((f) => readFileSync(f, "utf8")).join("\n");

    // Cohort. A bare /compose/ test matched "composer", the kit's own artifact name, and comments.
    // Score STRUCTURAL signals instead, and report `mixed`/`unknown` honestly rather than guessing —
    // emitting the wrong cohort is unrecoverable for the consumer.
    const composeHits = [
      /buildFeatures\s*\{[^}]*\bcompose\s*[= ]\s*true/s,     // buildFeatures { compose = true }
      /org\.jetbrains\.kotlin\.plugin\.compose/,               // the compose compiler plugin
      /androidx\.compose[.:]/,                                   // androidx.compose.* dependency
      /compose-bom/,
    ].filter((re) => re.test(gradle)).length;
    const viewsHits = [
      /buildFeatures\s*\{[^}]*viewBinding\s*[= ]\s*true/s,
      /buildFeatures\s*\{[^}]*dataBinding\s*[= ]\s*true/s,
      /com\.android\.databinding/,
    ].filter((re) => re.test(gradle)).length
      + (existsSync(join(CWD, "app/src/main/res/layout")) ? 1 : 0);   // XML layouts on disk

    result.android_variant =
      composeHits && !viewsHits ? "compose" :
      viewsHits && !composeHits ? "views"   :
      composeHits && viewsHits  ? "mixed"   : "unknown";
    result.android_cohort_signals = { composeHits, viewsHits };

    // Existing CometChat dependency + major — drives version_conflict and the upgrade offer.
    const kit = gradle.match(/com\.cometchat:(chatuikit-(?:kotlin|compose|core)-android|chat-uikit-android)[:"'\s]*([0-9]+)?/);
    if (kit) {
      result.existing_cometchat = true;
      result.installed_uikit = kit[1];
      const major = kit[2] ? parseInt(kit[2], 10) : null;
      if (major) result.android_uikit_major = `v${major}`;
      if (major && major < 6) {
        result.version_conflict = { detail: `android UI Kit v${major} installed; this pack targets v6` };
      }
    }
  }
  // iOS. peers.yaml lists Package.swift / *.xcodeproj / Podfile / *.xcworkspace; checking only the
  // Podfile + .xcodeproj left an SPM-only app and an .xcworkspace-only checkout detecting as nothing.
  // A root Package.swift is AMBIGUOUS on its own — a Swift server/CLI package has one too — so it
  // counts only with an iOS signal: an `.iOS(` platform, or a CometChat iOS product dependency.
  if (!result.framework) {
    const entries = readdirSync(CWD);
    const read = (rel) => { try { return readFileSync(join(CWD, rel), "utf8"); } catch { return ""; } };
    const xcode = entries.filter((f) => f.endsWith(".xcodeproj") || f.endsWith(".xcworkspace"));
    const spm = existsSync(join(CWD, "Package.swift")) ? read("Package.swift") : null;
    const IOS_CC = /CometChatUIKitSwift|CometChatCallsSDK|CometChatSDK|cometchat-uikit-ios|chat-sdk-ios|calls-sdk-ios/;
    const spmIsIos = spm !== null && (/\.iOS\s*\(/.test(spm) || IOS_CC.test(spm));
    if (existsSync(join(CWD, "Podfile")) || xcode.length || spmIsIos) {
      result.framework = "ios";
      result.env_file = "Secrets.xcconfig";
      // Existing integration: a CometChat iOS product in the Podfile, Package.swift, the Xcode
      // project, or a resolved SPM pin.
      const evidence = [read("Podfile"), spm || "", read("Package.resolved"),
        ...xcode.flatMap((x) => [read(`${x}/project.pbxproj`),
          read(`${x}/xcshareddata/swiftpm/Package.resolved`),
          read(`${x}/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`)])].join("\n");
      if (IOS_CC.test(evidence)) {
        result.existing_cometchat = true;
        // The kit id comes from peers.yaml (RULES §22 — no hardcoded family keys in tools).
        const iosKit = ((peers().peers || []).find((p) => p.platform === "ios") || {}).kit_package;
        if (iosKit && (evidence.includes(iosKit) || /cometchat-uikit-ios/.test(evidence))) result.installed_uikit = iosKit;
      }
    } else if (spm !== null) {
      result.ambiguous = "ios";
      result.hint = "Package.swift found, but no iOS signal (no .iOS(...) platform, no CometChat iOS dependency) — " +
        "this looks like a Swift server/CLI package. If it IS an iOS app, pass --family ios.";
    }
  }
  // Competitor SDKs (Sendbird / Stream) → the cross-family migration skill that replaces them.
  // null when none — additive, so existing consumers of detect --json are unaffected.
  result.migrate_from = detectMigrations();
  return result;
}

// ── registry (derived from peers.yaml) ───────────────────────────────────────
function peers() {
  const p = join(PACK_ROOT, "peers.yaml");
  if (!existsSync(p)) return { entry: "cometchat", peers: [] };
  const y = readFileSync(p, "utf8");
  const entry = (y.match(/^entry:\s*(\S+)/m) || [])[1] || "cometchat";
  const list = [];
  for (const block of y.split(/^\s*-\s*platform:/m).slice(1)) {
    const platform = (block.match(/^\s*(\S+)/) || [])[1];
    const major = (block.match(/major:\s*(\S+)/) || [])[1];
    const kit = (block.match(/kit_package:\s*"([^"]+)"/) || [])[1];
    const skills = (block.match(/skills:\s*\[([^\]]*)\]/) || [])[1];
    const verified = /^\s*verified:\s*true\b/m.test(block); // line-anchored: don't match "verified:true" inside a trailing comment on a `verified: false` line
    const label = (block.match(/label:\s*"([^"]+)"/) || [])[1];
    const dirPrefix = (block.match(/dir_prefix:\s*"([^"]+)"/) || [])[1];
    const parked = /^\s*parked:\s*true\b/m.test(block); // line-anchored, like `verified`
    list.push({ platform, major, kit_package: kit, label, dirPrefix, parked, skills: skills ? skills.split(",").map((s) => s.trim()) : [], verified });
  }
  // `catalog` + `env_file` make doctor/detect family-aware instead of hardcoding one family.
  // Enriched in a SECOND pass, deliberately: the loop body above is shared with the React Native
  // branch (PR #170), and editing it there turns a clean 3-way merge into a hand-resolved conflict.
  y.split(/^\s*-\s*platform:/m).slice(1).forEach((block, i) => {
    if (!list[i]) return;
    list[i].catalog = (block.match(/catalog:\s*(\S+)/) || [])[1];
    list[i].env_file = (block.match(/env_file:\s*"([^"]+)"/) || [])[1];
    list[i].features = (block.match(/features:\s*(\S+\.json)/) || [])[1];
    list[i].contracts = (block.match(/contracts:\s*(\S+\.json)/) || [])[1];
  });
  const gate = (y.match(/^gate:\s*(\S+)/m) || [])[1] || "cometchat-onboarding";
  const entSec = (y.match(/^enterprise:\s*\n([\s\S]*?)(?=^\S)/m) || [])[1] || "";
  const enterprise = [...entSec.matchAll(/^\s*-\s*(\S+)/gm)].map((m) => m[1].trim());
  const cfSec = (y.match(/^crossFamily:\s*\n([\s\S]*?)(?=^\S)/m) || [])[1] || "";
  const crossFamily = [...cfSec.matchAll(/^\s*-\s*(\S+)/gm)].map((m) => m[1].trim());
  return { entry, gate, peers: list, migrations: migrationsFrom(y), enterprise, crossFamily };
}

// `migrations:` (peers.yaml, above `peers:`): one cross-family competitor-migration skill per
// vendor + the dependency patterns `detect` reports as `migrate_from`. Patterns are single-quoted
// YAML scalars, so backslashes arrive literally and go straight into RegExp.
function migrationsFrom(y) {
  const sec = (y.match(/^migrations:\s*\n([\s\S]*?)(?=^\S)/m) || [])[1] || "";
  return sec.split(/^\s*-\s*vendor:/m).slice(1).map((block) => {
    const vendor = (block.match(/^\s*(\S+)/) || [])[1];
    const q = (k) => (block.match(new RegExp(`^\\s*${k}:\\s*'([^']*)'`, "m")) || [])[1] || null;
    const label = (block.match(/label:\s*"([^"]+)"/) || [])[1] || vendor;
    const skill = (block.match(/skill:\s*(\S+)/) || [])[1];
    return { vendor, label, skill, npm: q("npm"), pub: q("pub"), gradle: q("gradle"), ios: q("ios") };
  }).filter((m) => m.vendor && m.skill);
}

// Platform-NEUTRAL skills: installed for every family (entry router, onboarding gate, and the
// competitor-migration skills). One list, read from peers.yaml, so `add`, the orienting router
// and the family filter never disagree about what is shared.
function neutralSkillDirs() {
  const p = peers();
  return new Set([p.entry || "cometchat", p.gate, ...(p.migrations || []).map((m) => m.skill), ...(p.enterprise || []), ...(p.crossFamily || [])].filter(Boolean));
}

// Workspace package dirs for a monorepo: npm/yarn `workspaces` + pnpm-workspace.yaml. A monorepo
// keeps the vendor dependency in apps/<x>/package.json, not the root. Globs are scanned one level
// only (`apps/*`; `apps/**` is treated the same, so a package nested deeper isn't found); `!`
// exclusions are honored; the result is capped.
function workspaceDirs() {
  const pkg = readJSON(join(CWD, "package.json")) || {};
  const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces && pkg.workspaces.packages) || [];
  let pnpm = "";
  try { pnpm = readFileSync(join(CWD, "pnpm-workspace.yaml"), "utf8"); } catch { /* none */ }
  const patterns = [...ws, ...[...pnpm.matchAll(/^\s*-\s*['"]?([^'"\n#]+?)['"]?\s*$/gm)].map((m) => m[1])];
  const excluded = patterns.filter((g) => g.startsWith("!")).map((g) => g.slice(1).replace(/\/\*{1,2}$/, ""));
  const dirs = [];
  for (const g of patterns) {
    if (g.startsWith("!")) continue;
    const m = g.match(/^(.*?)\/\*{1,2}$/);
    if (!m) { dirs.push(g); continue; }
    try {
      for (const d of readdirSync(join(CWD, m[1]), { withFileTypes: true }))
        if (d.isDirectory() && d.name !== "node_modules") dirs.push(`${m[1]}/${d.name}`);
    } catch { /* missing dir */ }
  }
  const kept = dirs.filter((d) => !excluded.some((x) => d === x || d.startsWith(`${x}/`)));
  return [...new Set(kept)].slice(0, 50);
}

// Competitor SDKs present in THIS project (→ the migration skill to run). Reads dependency
// manifests only — names, not code — so it stays offline and cheap, like the rest of detect.
function detectMigrations() {
  const read = (rel) => { try { return readFileSync(join(CWD, rel), "utf8"); } catch { return ""; } };
  const depsOf = (p) => Object.keys({ ...((p && p.dependencies) || {}), ...((p && p.devDependencies) || {}) });
  // Root package.json + every workspace package (monorepo): the vendor dep may live in apps/<x>.
  const npmSources = [["package.json", readJSON(join(CWD, "package.json"))],
    ...workspaceDirs().map((d) => [`${d}/package.json`, readJSON(join(CWD, d, "package.json"))])]
    .map(([where, p]) => [where, depsOf(p)]);
  const pub = read("pubspec.yaml");
  const pubDeps = [...pub.matchAll(/^\s+([a-z0-9_]+):/gm)].map((m) => m[1]);
  const gradle = ["app/build.gradle", "app/build.gradle.kts", "build.gradle", "build.gradle.kts",
    "settings.gradle", "settings.gradle.kts", "gradle/libs.versions.toml"].map(read).join("\n");
  let entries = [];
  try { entries = readdirSync(CWD); } catch { /* unreadable cwd */ }
  const xcode = entries.filter((f) => f.endsWith(".xcodeproj") || f.endsWith(".xcworkspace"));
  const ios = [read("Podfile"), read("Package.swift"), read("Package.resolved"),
    ...xcode.flatMap((x) => [read(`${x}/project.pbxproj`),
      read(`${x}/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`),
      read(`${x}/xcshareddata/swiftpm/Package.resolved`)])].join("\n");
  const found = [];
  for (const m of peers().migrations || []) {
    const evidence = new Set();
    const names = (pattern, list, where) => {
      if (!pattern) return;
      const re = new RegExp(pattern, "i");
      for (const d of list) if (re.test(d)) evidence.add(`${where}:${d}`);
    };
    const text = (pattern, src, where) => {
      if (!pattern || !src) return;
      for (const hit of src.matchAll(new RegExp(pattern, "gi"))) evidence.add(`${where}:${hit[0].toLowerCase()}`);
    };
    for (const [where, deps] of npmSources) names(m.npm, deps, where);
    names(m.pub, pubDeps, "pubspec.yaml");
    text(m.gradle, gradle, "gradle");
    text(m.ios, ios, "ios");
    if (evidence.size) found.push({ vendor: m.vendor, label: m.label, skill: m.skill, evidence: [...evidence].slice(0, 8) });
  }
  return found.length ? found : null;
}

function shippedSkillDirs() {
  const dir = join(PACK_ROOT, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}

// ── commands ──────────────────────────────────────────────────────────────────
function cmdDetect() {
  const r = detect();
  out(r, () => {
    console.log(`framework:        ${r.framework || "(none detected)"}`);
    // The react branch sets `{package, version}`; the android branch sets a bare artifact STRING
    // (there is no lockfile to read a version from), so the object form printed
    // "undefined@undefined" on every Android project that already had the kit.
    if (r.installed_uikit) {
      const u = r.installed_uikit;
      console.log(`installed UI Kit: ${typeof u === "string" ? u : `${u.package}@${u.version}`}`);
    }
    console.log(`env file:         ${r.env_file || "(n/a)"}`);
    console.log(`existing CometChat: ${r.existing_cometchat}`);
    // repo signals for onboarding (only print the ones we found)
    const sig = [["auth", r.auth], ["styling", r.styling], ["state", r.state], ["routing", r.routing], ["ssr", r.ssr]].filter(([, v]) => v);
    if (sig.length) console.log(`repo signals:     ${sig.map(([k, v]) => `${k}=${v}`).join("  ")}`);
    if (r.version_conflict) console.log(`⚠️  version_conflict: ${r.version_conflict.detail}  → STOP & reconcile (RULES §3)`);
    if (r.hint) console.log(`hint:             ${r.hint}`);
    for (const m of r.migrate_from || []) {
      console.log(`migrate from:     ${m.label} (${m.evidence.join(", ")}) → skill ${m.skill}`);
    }
  });
}

function cmdList() {
  const reg = peers();
  const dirs = shippedSkillDirs();
  out({ entry: reg.entry, peers: reg.peers, skills: dirs }, () => {
    console.log(`Entry: /${reg.entry}`);
    // Parked peers are a routing SPEC only (no installable skill) — listing them with a
    // "verified" badge and "declared but not shipped" rows read as a broken pack.
    const parked = reg.peers.filter((p) => p.parked);
    for (const p of reg.peers.filter((x) => !x.parked)) {
      console.log(`\n${p.platform} ${p.major}  (${p.kit_package})  ${p.verified ? "✓ verified" : "unverified"}`);
      for (const s of p.skills) {
        // `dir_prefix` is the peer's own answer and always wins. Without it, composing
        // `cometchat-<platform>-<major>-<skill>` invents names: the SDK peer carries its
        // consumption in `platform` (android-sdk) while the dir does not, and a platform with only
        // one live major ships no <major> segment at all (NAMING.md) — e.g. cometchat-ios-core.
        const base = p.platform.replace(/-(sdk|uikit)$/, "");
        const direct = `cometchat-${p.platform}-${p.major}-${s}`;
        const slug = [p.dirPrefix && `${p.dirPrefix}${s}`, direct,
                      `cometchat-${base}-${p.major}-${s}`,
                      `cometchat-${p.platform}-${s}`, `cometchat-${base}-${s}`]
          .filter(Boolean).find((c) => dirs.includes(c)) || null;
        console.log(slug ? `  - ${slug}` : `  - ${direct}  ⚠️  declared in peers.yaml but not shipped`);
      }
    }
    if (parked.length) console.log(`\nparked (routing spec only — no installable skills): ${parked.map((p) => `${p.platform} (${p.label || p.kit_package})`).join(", ")}`);
  });
}

function cmdInfo() {
  const slug = argv[1];
  if (!slug) { console.error("usage: cometchat-skills info <skill-dir>"); process.exit(2); }
  const file = join(PACK_ROOT, "skills", slug, "SKILL.md");
  if (!existsSync(file)) { console.error(`no such skill: ${slug}`); process.exit(2); }
  const b = (readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
  const g = (k) => (b.match(new RegExp("^" + k + ':\\s*"?(.+?)"?$', "m")) || [])[1] || "";
  out({ name: g("name"), description: g("description"), compatibility: g("compatibility") }, () => {
    console.log(`${g("name")}\n\n${g("description")}\n\ncompatibility: ${g("compatibility")}`);
  });
}

// Shared pack-root data files that skills reference by BARE name (RULES.md,
// features.json, …). The copy step used to ship only skill directories, so these
// references resolved to nothing post-install — the skills pointed at files that
// were never installed. Ship a copy alongside every skill so bare refs resolve.
// Discovered, not hard-coded. A per-family pack has one oracle pair PER FAMILY
// (features.json + contracts.json for web-react, features.rn-v5.json +
// contracts.rn-v5.json for react-native, …). A fixed list ships only the first family's,
// so every later family's skills point at oracles that were never installed — the exact
// bug this comment block was written about, recurring one family later.
const SHARED_ROOT_FILES = ["RULES.md", "peers.yaml"];
function sharedRootFiles() {
  const dynamic = readdirSync(PACK_ROOT).filter(
    (f) => /^(features|contracts)([.-][a-z0-9-]+)?\.json$/i.test(f)
  );
  return [...SHARED_ROOT_FILES, ...dynamic];
}

// Same problem as sharedRootFiles(), one level down: a skill's own prose can bake a
// literal runtime-fetchable path ("catalogs/rn-v5.json") as its anti-hallucination
// oracle -- "anything not in catalogs/rn-v5.json does not exist, do not emit it".
// sharedRootFiles()'s regex only ever matches top-level FILENAMES, so a directory
// referenced this way could never be discovered by it and never installed at all
// (AUDIT-107). Whole-directory shared items are rare and structural -- there is
// exactly one today -- so this is a short literal list, not a second regex scan.
const SHARED_ROOT_DIRS = ["catalogs"];
function sharedRootDirs() {
  return SHARED_ROOT_DIRS.filter((d) => existsSync(join(PACK_ROOT, d)));
}

// Only THIS project's family (+ the platform-neutral skills: router, gate, competitor migrations) is installed.
// Installing every family let a React skill out-match its RN twin: React's
// features triggers are unqualified ('add polls'), RN's say "React Native", so an
// RN user asking "add polls" matched the WRONG framework's skill (AUDIT-101).
// The prefix match deliberately co-installs a family's headless-SDK sibling where the prefixes
// overlap: cometchat-ios-calls/-push route VoIP push to cometchat-ios-v5-sdk, and the Android
// calls-sdk skill's 1:1 ringing leans on the cometchat-android-v5-sdk recipe (and vice versa).
function familySkillDirs(fam) {
  const all = shippedSkillDirs();
  if (!fam || !fam.dirPrefix) return all;
  const neutral = neutralSkillDirs();
  return all.filter((d) => neutral.has(d) || d.startsWith(fam.dirPrefix));
}

// Remove-on-add: drop the skill folders an EARLIER generation shipped, so a v4→v5 upgrade
// never leaves stale skills behind (v4's cometchat-core/features/theming lingering next to
// the v5 set, with cometchat-core still advertising "React UI Kit v6"). Scoped to the exact
// legacy names in bin/legacy-skills.json — NOT every `cometchat*` dir: a current-pack skill
// may belong to another family, a calls peer, or a --global install from another project
// (installing a second family must not wipe the first), and any other cometchat-* dir is the
// user's own. The authoring/meta skills are never pruned either (dev tooling, not installed by `add`).
const PROTECTED_SKILLS = new Set(["cometchat-skill-creator", "cometchat-skill-reviewer", "cometchat-skill-explorer"]);
function legacySkillNames() {
  try { return new Set(JSON.parse(readFileSync(join(PACK_ROOT, "bin", "legacy-skills.json"), "utf8")).skills || []); }
  catch { return new Set(); }
}
function pruneLegacySkills(target) {
  if (!existsSync(target)) return [];
  const legacy = legacySkillNames();
  const current = new Set(shippedSkillDirs());
  const removed = [];
  for (const name of readdirSync(target)) {
    if (!legacy.has(name) || current.has(name) || PROTECTED_SKILLS.has(name)) continue;
    const p = join(target, name);
    try { if (statSync(p).isDirectory()) { rmSync(p, { recursive: true, force: true }); removed.push(name); } } catch { /* ignore */ }
  }
  return removed;
}

function copySkillsTo(target, fam) {
  const src = join(PACK_ROOT, "skills");
  mkdirSync(target, { recursive: true });
  const removed = pruneLegacySkills(target); // remove-on-add: drop stale earlier-generation skills
  const shared = sharedRootFiles().filter((f) => existsSync(join(PACK_ROOT, f)));
  const sharedDirs = sharedRootDirs();
  for (const f of shared) cpSync(join(PACK_ROOT, f), join(target, f)); // tree-root copy so <target>/RULES.md (the router's ref) resolves
  for (const d of sharedDirs) cpSync(join(PACK_ROOT, d), join(target, d), { recursive: true });
  // Per-skill ORACLES. The root features.json/contracts.json are the WEB pack's, so copying them
  // into every skill shipped `family: "web-react", major: "v7"` into all 19 Android skills — while
  // the correct android files sat uninstalled. The skills cite these as ground truth, so an Android
  // agent was reading React's feature list (down to CometChatErrorBoundary, a web-only component).
  // Resolve each skill's family from its peer's dir_prefix and install THAT peer's oracles under
  // the bare names the skills reference.
  const peerList = (peers().peers || []).filter((p) => p.dirPrefix);
  const oracleFor = (skillDir) => {
    // Resolve to the peer that actually SHIPS this skill dir — dirPrefix + a slug in its
    // `skills` list — so android-sdk vs android-calls (which share `cometchat-android-v5-`)
    // and react-native vs react-native-calls each get their OWN oracle, not whichever peer
    // sorts first. Fall back to the longest matching prefix for shared/neutral dirs.
    const owns = (p) => skillDir.startsWith(p.dirPrefix)
      && (p.skills || []).includes(skillDir.slice(p.dirPrefix.length));
    const peer = peerList.find(owns)
      || peerList.filter((p) => skillDir.startsWith(p.dirPrefix))
                 .sort((a, b) => b.dirPrefix.length - a.dirPrefix.length)[0];
    return {
      "features.json": peer && peer.features,
      "contracts.json": peer && peer.contracts,
    };
  };
  // Per-skill copies are what a skill's RELATIVE refs resolve against ("features.json",
  // "catalogs/android-v6.json"). Copy only what this install's skills actually cite — plus the
  // bare family-correct oracles and RULES/peers — not all 25 oracle files and every catalog into
  // every folder (that made a React install 8.9 MB and an Android one 14 MB). The tree root above
  // keeps the full set.
  const names = familySkillDirs(fam);
  const cited = citedSharedFiles(names.map((n) => join(src, n)));
  const always = new Set([...SHARED_ROOT_FILES, "features.json", "contracts.json"]);
  const perSkill = shared.filter((f) => always.has(f) || cited.files.has(f));
  const installed = [];
  for (const name of names) {
    const dest = join(target, name);
    cpSync(join(src, name), dest, { recursive: true }); // overlay, not rm+copy: files a user added inside survive a re-install
    const oracles = oracleFor(name);
    for (const f of perSkill) {
      const override = oracles[f];
      const from = override && existsSync(join(PACK_ROOT, override)) ? override : f;
      cpSync(join(PACK_ROOT, from), join(dest, f)); // bare name, family-correct content
    }
    for (const d of sharedDirs) { // AUDIT-107: a skill's "catalogs/<file>" reference resolves same-folder
      const files = [...(cited.dirs.get(d) || [])].filter((f) => existsSync(join(PACK_ROOT, d, f)));
      if (!files.length) continue;
      mkdirSync(join(dest, d), { recursive: true });
      for (const f of files) cpSync(join(PACK_ROOT, d, f), join(dest, d, f));
    }
    installed.push(name);
  }
  return { installed, removed };
}

// Every named oracle ("features.rn-v5.json") and shared-dir file ("catalogs/rn-v5.json") that the
// given skill dirs cite anywhere in their markdown.
function citedSharedFiles(skillDirs) {
  const files = new Set();
  const dirs = new Map(SHARED_ROOT_DIRS.map((d) => [d, new Set()]));
  const dirRe = new RegExp(`\\b(${SHARED_ROOT_DIRS.join("|")})/([A-Za-z0-9._-]+\\.(?:json|txt))`, "g");
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const q = join(p, e.name);
      if (e.isDirectory()) { walk(q); continue; }
      if (!e.name.endsWith(".md")) continue;
      const text = readFileSync(q, "utf8");
      for (const m of text.matchAll(/\b((?:features|contracts)\.[a-z0-9-]+\.json)\b/g)) files.add(m[1]);
      for (const m of text.matchAll(dirRe)) dirs.get(m[1]).add(m[2]);
    }
  };
  for (const d of skillDirs) if (existsSync(d)) walk(d);
  return { files, dirs };
}

// ── multi-agent install targets ──────────────────────────────────────────────
// The v4 pack shipped a three-mode IDE_TARGETS map (multi / single / cli-only).
// v5 ports it forward, refreshed to 2026 conventions: AGENTS.md is now the
// near-universal single-file entrypoint, so Codex / Antigravity / Cursor /
// Continue read it and NO agent is left "CLI-only".
//   • "multi"  agents get the native SKILL.md folder tree (full progressive
//     disclosure) at their own skills dir.
//   • "single" agents get a short (~4KB) orienting ROUTER file at their rules
//     location PLUS the full tree copied to a neutral ./.cometchat/skills so the
//     router points at REAL files the agent reads ON DEMAND (keeps the token win;
//     never a mega-concatenation — that burns tokens every turn).
// The skill CONTENT is identical across every target — only the delivery differs.
const NEUTRAL_SKILLS_DIR = ".cometchat/skills";
const IDE_TARGETS = {
  claude:      { mode: "multi",  dir: ".claude/skills", globalDir: join(homedir(), ".claude", "skills") },
  kiro:        { mode: "multi",  dir: ".kiro/skills" },
  replit:      { mode: "multi",  dir: ".agents/skills" },
  cursor:      { mode: "single", base: ".",           file: "AGENTS.md" },
  codex:       { mode: "single", base: ".",           file: "AGENTS.md" },
  antigravity: { mode: "single", base: ".",           file: "AGENTS.md" },
  continue:    { mode: "single", base: ".",           file: "AGENTS.md" },
  windsurf:    { mode: "single", base: ".",           file: ".windsurfrules" },
  copilot:     { mode: "single", base: ".github",     file: "copilot-instructions.md" },
  cline:       { mode: "single", base: ".clinerules", file: "cometchat.md" },
  gemini:      { mode: "single", base: ".",           file: "GEMINI.md" },
  aider:       { mode: "single", base: ".",           file: "CONVENTIONS.md" },
};

// ─── MCP auto-wiring (RULES.md "Canonical doc channel" tier 1) ──────────────
// Beyond placing skill files, wire the CometChat docs MCP into each agent's OWN
// config so live docs load automatically. Each agent's mechanism differs — JSON
// vs TOML, `url` vs `httpUrl` vs `url`+`type` — so there is NO single snippet.
// MERGE, never clobber: preserve the user's existing servers/settings, only add
// or refresh `cometchat-docs`. Skipped with `--no-mcp`. Claude also auto-connects
// via the plugin manifest (plugin-root .mcp.json); this covers the CLI path too.
const MCP_NAME = "cometchat-docs";
const MCP_URL = "https://mcp.cometchat.com/mcp";
// Claude's USER-level MCP lives in ~/.claude.json — a large file Claude Code itself rewrites
// while running, so the installer never edits it: `--global` prints the `claude mcp add
// --scope user` command instead of writing a project .mcp.json into whatever folder you ran from.
const CLAUDE_USER_MCP_CMD = `claude mcp add --scope user --transport http ${MCP_NAME} ${MCP_URL}`;
const MCP_TARGETS = {
  claude: { kind: "json", proj: ".mcp.json",             glob: null,                                          shape: () => ({ type: "http", url: MCP_URL }) },
  cursor: { kind: "json", proj: ".cursor/mcp.json",      glob: join(homedir(), ".cursor", "mcp.json"),        shape: () => ({ url: MCP_URL }) },              // Cursor: bare `url`, transport inferred
  gemini: { kind: "json", proj: ".gemini/settings.json", glob: join(homedir(), ".gemini", "settings.json"),   shape: () => ({ httpUrl: MCP_URL, timeout: 5000 }) }, // Gemini: `httpUrl` (its `url` = SSE!)
  codex:  { kind: "toml", proj: ".codex/config.toml",    glob: join(homedir(), ".codex", "config.toml") },      // Codex: TOML + needs the RMCP flag
};
const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// How to add the server by hand when we could not (or must not) write the agent's config.
function manualMcpHint(ide, file) {
  if (ide === "claude") return `claude mcp add --scope ${file ? "project" : "user"} --transport http ${MCP_NAME} ${MCP_URL}`;
  if (ide === "codex") return `add to ${file}: experimental_use_rmcp_client = true (root) + [mcp_servers.${MCP_NAME}] url = "${MCP_URL}"`;
  const m = MCP_TARGETS[ide];
  return `add "${MCP_NAME}": ${JSON.stringify(m.shape())} under "mcpServers" in ${file}`;
}

// Merge the server into a JSON `mcpServers` map without touching anything else. Anything that is
// not a JSON OBJECT at the top level (null, a string, a number, an array) — or whose `mcpServers`
// is not an object — is left untouched and reported, never "fixed": assigning a property onto
// `null` crashed the install AFTER the skills were copied, and onto a string/array it silently did
// nothing while reporting "added".
function mergeJsonMcp(file, serverShape) {
  let cfg = {};
  if (existsSync(file)) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { return { file, status: "skipped-unparseable", reason: e && e.code === "EISDIR" ? "is a directory" : "not valid JSON" }; } // never corrupt a file we can't parse
    if (!isPlainObject(parsed)) return { file, status: "skipped-unparseable", reason: `top-level JSON is ${Array.isArray(parsed) ? "an array" : parsed === null ? "null" : `a ${typeof parsed}`}, not an object` };
    cfg = parsed;
  }
  if (cfg.mcpServers === undefined || cfg.mcpServers === null) cfg.mcpServers = {};
  else if (!isPlainObject(cfg.mcpServers)) return { file, status: "skipped-unparseable", reason: `"mcpServers" is ${Array.isArray(cfg.mcpServers) ? "an array" : `a ${typeof cfg.mcpServers}`}, not an object` };
  const existed = !!cfg.mcpServers[MCP_NAME];
  cfg.mcpServers[MCP_NAME] = serverShape;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  return { file, status: existed ? "updated" : "added" };
}

// Codex is TOML AND gates HTTP transport behind a ROOT-level flag that must
// precede the first table — so prepend the flag if missing, append the server
// table if missing. Idempotent; leaves an existing entry untouched.
function mergeCodexToml(file) {
  const FLAG = "experimental_use_rmcp_client = true";
  const TABLE = `[mcp_servers.${MCP_NAME}]`;
  let txt = existsSync(file) ? readFileSync(file, "utf8") : "";
  const hadTable = txt.includes(TABLE);
  if (!/experimental_use_rmcp_client\s*=/.test(txt)) txt = `${FLAG}\n\n${txt}`; // root flag before any table
  if (!hadTable) txt = `${txt.replace(/\s*$/, "")}\n\n${TABLE}\nurl = "${MCP_URL}"\n`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, txt, "utf8");
  return { file, status: hadTable ? "present" : "added" };
}

function wireMcpForIde(ide, global) {
  const m = MCP_TARGETS[ide];
  if (!m) return null; // this agent has no supported HTTP-MCP wiring
  if (global && !m.glob) return { file: null, status: "manual", command: CLAUDE_USER_MCP_CMD };
  const file = global ? m.glob : join(CWD, m.proj);
  // Never let a config-write failure (EACCES, a directory where the file should be, …) crash the
  // run after the skills are already copied — report it with the by-hand fallback instead.
  try { return m.kind === "toml" ? mergeCodexToml(file) : mergeJsonMcp(file, m.shape()); }
  catch (e) { return { file, status: "skipped-error", reason: e.code || e.message }; }
}

// Read a shipped skill's frontmatter (name + description → summary + triggers).
// Drives the orienting router table from real data so it can't drift.
function skillMeta(name) {
  const file = join(PACK_ROOT, "skills", name, "SKILL.md");
  const b = existsSync(file) ? (readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "" : "";
  const g = (k) => (b.match(new RegExp("^" + k + ':\\s*"?(.+?)"?\\s*$', "m")) || [])[1] || "";
  const desc = g("description");
  const triggers = (desc.match(/Triggers?:\s*(.+)$/) || [])[1] || "";
  const summary = desc.split(/Triggers?:/)[0].replace(/\s+/g, " ").trim();
  return { name: g("name") || name, dir: name, summary, triggers };
}

// The short (~4KB) orienting router written for "single" agents. refBase is the
// on-disk location of the full skill tree the agent reads on demand.
function generateOrientingMd(reg, dirs, refBase, fam) {
  const entry = reg.entry || "cometchat";
  const label = (fam && fam.label) || "UI Kit";
  const kit = (fam && fam.kit_package) || "";
  // Scope the table to THIS family + the platform-neutral router/gate. Listing
  // every family's skills is what let an RN agent read React rows (AUDIT-101).
  const shared = neutralSkillDirs();
  const scoped = (fam && fam.dirPrefix)
    ? dirs.filter((d) => shared.has(d) || d.startsWith(fam.dirPrefix))
    : dirs;
  const metas = scoped.map(skillMeta);
  let md = `# CometChat — AI Agent Instructions (${label})\n\n`;
  md += `> Auto-generated by \`npx @cometchat/skills add --ide <agent>\` between the \`cometchat-skills\` markers — edits inside them are overwritten on re-run; anything outside them is yours and is kept.\n`;
  md += `> ${metas.length} task-shaped skills ship as Markdown under \`${refBase}/\`. Read them ON DEMAND — do not inline them all (that burns tokens every turn).\n\n`;

  md += `## For any CometChat chat / messaging / calls task\n\n`;
  md += `This project integrates **CometChat** via the **${label}**${kit ? ` (\`${kit}\`)` : ""}. OPEN the matching skill file below and follow it — do **not** answer from training memory (the UI Kit API changes across majors; these skills are verified against the pinned kit).\n\n`;
  md += `| When the user wants… | Read this skill |\n|---|---|\n`;
  for (const m of metas) {
    const purpose = (m.triggers || m.summary).replace(/\|/g, "\\|"); // ponytail: no slice — a cut trigger cannot match (AUDIT-102)
    md += `| ${purpose} | \`${refBase}/${m.dir}/SKILL.md\` |\n`;
  }
  md += `\nEach skill lazily pulls deeper detail from its own \`references/*.md\` — open those only when the skill points you to them.\n\n`;

  md += `## Start here\n\n`;
  md += `1. **Detect** — \`npx @cometchat/skills detect --json\` (framework, installed UI Kit, version_conflict). If \`version_conflict\` is non-null, STOP and reconcile before touching code.\n`;
  md += `2. **Already integrated?** If \`detect\` says \`existing_cometchat: true\`, this is a TASK, not an integration — go **straight** to the matching skill in the table above and skip onboarding. "Change my avatar", "add a logout button", "add polls", "restyle the bubble" are all tasks. Do NOT re-run the plan/approve journey, and do NOT fall back to reading \`node_modules\` when the phrasing is not an exact match — pick the closest row and open it.\n`;
  md += `3. **Migrating off Sendbird or Stream?** If the user asks to migrate/switch/replace and \`detect\` reports \`migrate_from\` (or the user names the vendor), open that entry's \`skill\` from the table — it runs the whole migration in one pass (no onboarding) and ends with the list of removed features.\n`;
  md += `4. **Route** — open \`${refBase}/${entry}/SKILL.md\` (the dispatcher); it points to the right task skill for the request.\n`;
  md += `5. **Follow the skill** — it carries the exact init→login→render, the component props, and the verify steps.\n\n`;

  md += `## Hard rules (full text in \`${refBase}/RULES.md\`)\n\n`;
  md += `- **APPEND, never replace** the user's code — additive diffs; confirm before bulk edits.\n`;
  md += `- **One package per platform**; never mix UI Kit majors (v5/v6/v7).\n`;
  md += `- **Never hardcode credentials** — the Auth Key is dev-only; use a server-minted auth token for production.\n`;
  md += `- **Give the chat container real height + width** or it collapses; **never render a raw localization key** as a label.\n`;
  md += `- **Render custom controls in the component's own view slot**, not as a sibling on top of it.\n`;
  md += `- **Verify against the catalog + a real build** before "done"; fetch signatures from live docs, never from memory or \`node_modules\`.\n`;
  md += `- **Need a CometChat API that is not in the table above? FETCH THE DOCS** — open the family \`core\` skill's \`references/docs-map.md\` and follow it. **Never** grep \`node_modules\` and **never** read \`*.d.ts\`: they carry internal, unsupported and version-drifting surface. If the docs do not have it, say so — do not infer it from types.\n\n`;

  md += `## Want the native Claude Code install instead?\n\n`;
  md += "```bash\n";
  md += `npx @cometchat/skills add --ide claude   # writes the .claude/skills tree (auto progressive disclosure)\n`;
  md += "```\n";
  return md;
}

// The single-file targets (AGENTS.md, GEMINI.md, CONVENTIONS.md, .windsurfrules,
// .github/copilot-instructions.md, .clinerules/cometchat.md) are often the USER's own file —
// AGENTS.md especially is shared by many tools. Overwriting it wholesale destroyed their content.
// So the router lives in a MANAGED BLOCK: re-runs replace only what is between the markers.
// Every one of these files is Markdown (or read raw as Markdown-ish rules text), where an HTML
// comment is invisible when rendered and inert when read raw — a safe fence for all of them.
const MARK_START = "<!-- cometchat-skills:start -->";
const MARK_END = "<!-- cometchat-skills:end -->";
// The unmarked router an earlier installer version wrote (whole-file, "Do not hand-edit"): replace
// exactly that span on upgrade instead of appending a second router next to it.
const LEGACY_ROUTER_RE = /^# CometChat — AI Agent Instructions[^\r\n]*\r?\n[\s\S]*?\r?\n## Want the native Claude Code install instead\?\r?\n(?:\r?\n)*```bash\r?\n[^\r\n]*\r?\n```[ \t]*(?:\r?\n)?/m;
// The router the PUBLISHED v4.2–4.4.x installer wrote (npm `latest` users have it on disk): from its
// "Auto-generated … Do not hand-edit" header to its closing "That writes N per-skill markdown files"
// line. Anything a user appended after that line is left alone. (4.0/4.1 wrote no router file.)
const LEGACY_V4_ROUTER_RE = /^# CometChat — AI Agent Instructions\r?\n\r?\n> Auto-generated by `npx @cometchat\/skills add`\. Do not hand-edit;[\s\S]*?\r?\nThat writes \d+ per-skill markdown files to `\.claude\/skills\/cometchat-\*\/SKILL\.md`\.[^\r\n]*(?:\r?\n)?/m;
function writeManagedBlock(dest, body) {
  const block = (eol) => [MARK_START, body.replace(/\n+$/, ""), MARK_END].join("\n").replace(/\n/g, eol);
  if (!existsSync(dest)) { writeFileSync(dest, block("\n") + "\n", "utf8"); return "created"; }
  if (statSync(dest).isDirectory()) return "skipped-not-a-file"; // e.g. an AGENTS.md FOLDER — never write into or over it
  const text = readFileSync(dest, "utf8");
  const legacy = [LEGACY_ROUTER_RE, LEGACY_V4_ROUTER_RE].find((re) => re.test(text));
  const eol = /\r\n/.test(text) ? "\r\n" : "\n"; // keep a CRLF file CRLF
  const s = text.indexOf(MARK_START);
  const e = text.indexOf(MARK_END);
  let next, status;
  if (s >= 0 && e > s) { next = text.slice(0, s) + block(eol) + text.slice(e + MARK_END.length); status = "updated"; }
  else if (s >= 0 || e >= 0) return "skipped-malformed"; // one marker without its partner: don't guess where the block ends
  else if (legacy) { next = text.replace(legacy, block(eol) + eol); status = "migrated"; }
  else { next = text.replace(/(\r?\n)*$/, "") + (text.trim() ? eol + eol : "") + block(eol) + eol; status = "appended"; }
  if (next === text) return "unchanged";
  writeFileSync(dest, next, "utf8");
  return status;
}

// Install for one agent. "multi" → native SKILL.md tree; "single" → orienting
// router at the agent's rules file + the full tree at the neutral dir.
function installForIde(ide, global) {
  const t = IDE_TARGETS[ide];
  const fam = resolveFamily();
  if (t.mode === "multi") {
    const target = global && t.globalDir ? t.globalDir : join(CWD, t.dir);
    const { installed, removed } = copySkillsTo(target, fam);
    return { ide, mode: "multi", target, count: installed.length, removed };
  }
  const neutral = join(CWD, NEUTRAL_SKILLS_DIR);
  const { installed, removed } = copySkillsTo(neutral, fam);
  const base = join(CWD, t.base);
  let dest = join(base, t.file), fileStatus;
  try {
    if (t.base !== "." && existsSync(base) && !statSync(base).isDirectory()) {
      // The rules "folder" is a FILE. Cline's original single-file form is a `.clinerules` file, and
      // Cline still reads it — so put the block there. Any other target: leave the user's file alone.
      if (t.base === ".clinerules") dest = base;
      else fileStatus = "skipped-not-a-directory";
    } else mkdirSync(base, { recursive: true });
    fileStatus ||= writeManagedBlock(dest, generateOrientingMd(peers(), shippedSkillDirs(), NEUTRAL_SKILLS_DIR, fam));
  } catch (e) {
    fileStatus = "skipped-error"; // never crash after the skills are already copied
    return { ide, mode: "single", target: dest, neutral, count: installed.length, removed, file_status: fileStatus, reason: e.code || e.message };
  }
  return { ide, mode: "single", target: dest, neutral, count: installed.length, removed, file_status: fileStatus };
}

function cmdAdd() {
  const global = has("--global");
  const supported = Object.keys(IDE_TARGETS);
  requireFlagValue("--ide", [...supported, "all"]);
  requireFlagValue("--target", [...supported, "all"]);
  const ide = (flagVal("--ide") || flagVal("--target") || "claude").toLowerCase();
  if (ide !== "all" && !IDE_TARGETS[ide]) {
    console.error(`unknown --ide: ${ide}\nsupported: ${supported.join(", ")}, all`);
    process.exit(2);
  }
  let ides = ide === "all" ? supported : [ide];
  // --global needs a USER-level location. Only claude has one here (~/.claude/skills); kiro/replit
  // and the single-file agents (AGENTS.md, GEMINI.md, …) are per-project by nature. They used to
  // ignore --global and write into whatever folder you ran from — now they are skipped, loudly.
  const noGlobal = global ? ides.filter((n) => !(IDE_TARGETS[n].mode === "multi" && IDE_TARGETS[n].globalDir)) : [];
  if (noGlobal.length) {
    ides = ides.filter((n) => !noGlobal.includes(n));
    const msg = `--global: no user-level install location for ${noGlobal.join(", ")} — skipped (nothing written to ${CWD}). ` +
      `Run \`npx @cometchat/skills add --ide <agent>\` inside the project for ${noGlobal.length > 1 ? "those" : "it"}.`;
    if (!ides.length) {
      if (JSON_OUT) console.log(JSON.stringify({ ok: false, error: msg, skipped: noGlobal }));
      else console.error(msg);
      process.exit(2);
    }
    if (!JSON_OUT) console.error(`↷ ${msg}`);
  }
  // Surface a version-conflict up front (non-fatal): a project already on a different UI Kit
  // major still gets skills, but the agent must reconcile before emitting code (RULES §3).
  const vc = (detect() || {}).version_conflict || null;
  if (vc && !JSON_OUT) console.error(`⚠️  version_conflict: ${vc.detail} — reconcile before generating code (RULES §3).`);
  const results = [];
  const writtenSingles = new Set();
  for (const name of ides) {
    const t = IDE_TARGETS[name];
    if (t.mode === "single") { // dedupe agents that share a file (cursor/codex/antigravity/continue → AGENTS.md)
      const key = join(t.base, t.file);
      if (writtenSingles.has(key)) { results.push({ ide: name, mode: "single", target: join(CWD, key), deduped: true }); continue; }
      writtenSingles.add(key);
    }
    results.push(installForIde(name, global));
  }

  // Wire the docs MCP into each agent's own config (tier 1 auto-connect), unless opted out.
  const mcpResults = [];
  if (!has("--no-mcp")) {
    const wroteMcp = new Set();
    for (const name of ides) {
      const m = MCP_TARGETS[name];
      if (!m) continue; // agent has no supported HTTP-MCP wiring (e.g. copilot/windsurf/aider)
      const file = global ? (m.glob || `user:${name}`) : join(CWD, m.proj);
      if (wroteMcp.has(file)) continue;
      wroteMcp.add(file);
      const r = wireMcpForIde(name, global);
      if (r) mcpResults.push({ ide: name, ...r });
    }
  }

  const FILE_VERB = { created: "created", updated: "updated (managed block)", migrated: "updated (replaced an earlier unmarked router)",
    appended: "appended (your content kept)", unchanged: "unchanged" };
  out({ ok: true, results, mcp: mcpResults, version_conflict: vc, ...(noGlobal.length ? { skipped: noGlobal } : {}) }, () => {
    for (const r of results) {
      if (r.deduped) console.log(`✅ ${r.ide.padEnd(11)} → shares ${r.target} (already written)`);
      else if (r.mode === "multi") console.log(`✅ ${r.ide.padEnd(11)} → ${r.count} skill(s) in ${r.target}`);
      else if (r.file_status === "skipped-malformed") console.log(`⚠️  ${r.ide.padEnd(11)} → ${r.target} has an unmatched cometchat-skills start/end marker — router NOT written; fix or remove the marker and re-run  (+ ${r.count} skills in ${r.neutral})`);
      else if (String(r.file_status).startsWith("skipped")) {
        const why = { "skipped-not-a-file": "is a folder, not a file", "skipped-not-a-directory": "sits where a folder is expected" }[r.file_status] || `could not be written (${r.reason})`;
        console.log(`⚠️  ${r.ide.padEnd(11)} → ${r.target.replace(CWD + "/", "")} ${why} — router NOT written; the skills are installed (+ ${r.count} skills in ${r.neutral})`);
      }
      else console.log(`✅ ${r.ide.padEnd(11)} → router ${r.target} ${FILE_VERB[r.file_status] || r.file_status}  (+ ${r.count} skills in ${r.neutral})`);
      if (r.removed && r.removed.length) console.log(`   removed ${r.removed.length} stale skill(s) from an earlier version: ${r.removed.join(", ")}`);
    }
    for (const r of mcpResults) {
      const rel = r.file ? r.file.replace(CWD + "/", "") : null;
      if (r.status === "manual") console.log(`🔌 MCP ${r.ide.padEnd(8)} → --global: user-level MCP lives in ~/.claude.json (owned by Claude Code, not edited). Run:\n     ${r.command}`);
      else if (r.status.startsWith("skipped")) console.log(`⚠️  MCP ${r.ide.padEnd(8)} → ${rel} left untouched (${r.reason}) — add by hand: ${manualMcpHint(r.ide, rel)}`);
      else console.log(`🔌 MCP ${r.ide.padEnd(8)} → ${MCP_NAME} ${r.status} in ${rel}`);
    }
    // Only point at the neutral tree when a router-file agent actually got one — a claude-only
    // install has no .cometchat/skills, and naming it sent people to a path that doesn't exist.
    const neutralDir = (results.find((r) => r.neutral) || {}).neutral;
    console.log(`\nEntry: /cometchat add chat to my app` +
      (neutralDir ? `   (agents without slash-skills: open ${neutralDir.replace(CWD + "/", "")}/cometchat/SKILL.md)` : ""));
    if (mcpResults.length) console.log(`Docs MCP: ${MCP_URL}  (auto-loads live docs; restart the agent if it doesn't connect. Skip with --no-mcp.)`);
    // Claude Code gates a PROJECT .mcp.json server behind a one-time trust prompt (`claude mcp list`
    // shows "Pending approval" until then) — say so, or "auto-loads" reads as broken on first run.
    if (mcpResults.some((r) => r.ide === "claude" && (r.status === "added" || r.status === "updated")))
      console.log(`Claude Code: approve "${MCP_NAME}" when \`claude\` asks on first start in this project — until then it shows "Pending approval" in \`claude mcp list\`. Skills fall back to the docs site if you decline.`);
  });
}

function runNode(scriptRel, extra = []) {
  const r = spawnSync("node", [join(PACK_ROOT, scriptRel), ...extra], { stdio: "inherit" });
  return r.status ?? 1;
}

// The Tier-2 fence for a family: which engine, against which pinned-kit project, and whether that
// project is set up. A packed (npm) install has no families.json, so `key`/`typecheckProject` are
// null — this returns { skip } instead of handing the engine `--project null` (which printed
// "npm --prefix null ci" and exited 1 on every npm install).
function fencePlan(f) {
  const proj = f && f.key && f.typecheckProject && existsSync(join(PACK_ROOT, f.typecheckProject)) ? f.typecheckProject : null;
  if (!proj) return { skip: `no pinned-kit typecheck project for ${(f && f.label) || "this family"} in this install` };
  const P = join(PACK_ROOT, proj);
  const has = (rel) => existsSync(join(P, rel));
  let plan;
  if (has("tsconfig.json")) {
    const fam = f.fenceNeedles && f.skillDirPattern;
    if (!fam) return { skip: `no TypeScript fence declared for ${f.key}` };
    plan = { engine: "typecheck-fences.mjs", args: ["--project", proj, "--tsconfig", "tsconfig.json", "--discover", f.key],
             ready: has("node_modules/@cometchat"), setup: `npm --prefix ${proj} ci` };
  } else if (has("pubspec.yaml")) {
    plan = { engine: "typecheck-fences-dart.mjs", args: ["--project", proj, "--discover", f.key],
             ready: has(".dart_tool/package_config.json"), setup: `(cd ${proj} && flutter pub get)` };
  } else if (has("settings.gradle.kts") || has("settings.gradle")) {
    plan = { engine: "typecheck-fences-kotlin.mjs", args: ["--project", proj, "--discover", f.key],
             ready: has("local.properties"), setup: `write sdk.dir=<Android SDK path> into ${proj}/local.properties` };
  } else return { skip: `no fence engine for ${proj}` };
  if (!existsSync(join(PACK_ROOT, "test-suite/scripts", plan.engine))) return { skip: `${plan.engine} not in this install` };
  return { ...plan, proj };
}

function cmdVerify() {
  const tier = argv[1] && !argv[1].startsWith("-") ? argv[1] : "all";
  // The predicate (review done-oracle) belongs to the reviewer, which is INTERNAL-DEV-ONLY
  // and NOT shipped in the published package (no e2e harness on npm). When it's absent —
  // i.e. running from an npm install rather than the dev repo — skip it cleanly instead of
  // erroring, so the end-user CLI never fails on the missing dev harness.
  const PREDICATE = ".claude/skills/cometchat-skill-reviewer/tools/predicate.mjs";
  const hasReviewer = existsSync(join(PACK_ROOT, PREDICATE));
  const gates = {
    lint: () => runNode("test-suite/scripts/lint-skills.mjs"),
    catalog: () => runNode("test-suite/scripts/verify-catalog.mjs"),
    // Family resolved from families.json (RULES.md §22). This hardcoded web-v7, so `fences`
    // silently checked only React regardless of which family the workspace actually used.
    fences: () => {
      if (!resolvePeer((detect() || {}).framework || "")) {
        console.log("↷ fences — DEV-ONLY Tier-2 gate: no family resolved for this directory (pass --family <platform>); skipped.");
        return 0;
      }
      const p = fencePlan(resolveFamily());
      if (p.skip) { console.log(`↷ fences — DEV-ONLY Tier-2 gate (${p.skip}); skipped.`); return 0; }
      if (!p.ready) { console.log(`↷ fences — DEV-ONLY Tier-2 gate: pinned kit not set up in ${p.proj}; skipped. Set up: ${p.setup}`); return 0; }
      return runNode(`test-suite/scripts/${p.engine}`, p.args);
    },
    predicate: () => {
      if (!hasReviewer) { console.log("↷ predicate — DEV-ONLY review gate (e2e harness not present in this install); skipped."); return 0; }
      return runNode(PREDICATE);
    },
  };
  let seq;
  if (tier === "all") seq = ["lint", "catalog", "predicate"];      // offline gates (fences needs the kit)
  else if (tier === "ci") seq = ["lint", "catalog", "fences", "predicate"];
  else if (gates[tier]) seq = [tier];
  else { console.error(`unknown tier: ${tier} (lint|catalog|fences|predicate|all|ci)`); process.exit(2); }
  let bad = 0;
  for (const g of seq) { const code = gates[g](); if (code !== 0) bad++; }
  process.exit(bad ? 1 : 0);
}

function cmdCatalog() {
  process.exit(runNode("test-suite/scripts/catalog-refresh.mjs", has("--check") ? ["--check"] : []));
}

function cmdDoctor() {
  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  // Family-aware. Reporting the WEB catalog (405 symbols) and "npm --prefix cometchat-react-app ci"
  // inside an Android or iOS project was worse than noise: it told the user their oracle was fine
  // while reading React's. Resolve the peer the project actually is.
  // Resolved exactly like `add` (FRAMEWORK_PLATFORM + --family): Expo → react-native, Next/Astro →
  // react. The old platform-string match fell through to React for Expo, and with NO family it
  // printed "harness/null". No family ⇒ say so; never substitute React's catalog.
  const det = detect();
  const peer = resolvePeer(det.framework || "");
  const fam = reviewerFamily(peer); // dev-only (families.json); null on an npm install
  const noFamily = "n/a — no family resolved (run inside the app package, or pass --family <platform>)";
  const catalog = peer && peer.catalog ? readJSON(join(PACK_ROOT, `test-suite/catalogs/${peer.catalog}.json`)) : null;
  // The pinned kit (Tier-2 typecheck project) and the review app/harness (Tier-3) for THIS family.
  let kit;
  if (!peer) kit = { ok: false, detail: noFamily };
  else if (!fam) kit = { ok: false, detail: "n/a — dev-only (pinned kit + review harness are not in this install)" };
  else {
    const plan = fencePlan({ ...fam, label: peer.label });
    const dirs = [plan.proj, fam.appDir].filter((d, i, a) => d && a.indexOf(d) === i);
    const installed = (d) => {
      const P = join(PACK_ROOT, d);
      if (!existsSync(P)) return false;
      if (existsSync(join(P, "package.json"))) return existsSync(join(P, "node_modules", "@cometchat"));
      if (existsSync(join(P, "pubspec.yaml"))) return existsSync(join(P, ".dart_tool"));
      return true; // native harness: present = usable (its own gate reports toolchain gaps)
    };
    const hit = dirs.find(installed);
    kit = hit ? { ok: true, detail: hit }
      : { ok: false, detail: plan.setup ? `not set up — ${plan.setup}` : dirs.length ? `${dirs.join(" / ")} not set up` : "no pinned kit or harness declared for this family" };
  }
  // Review state for THIS family only (reviews/<family>/review-state.*.json) — never React's as a fallback.
  let state = null;
  const reviewDir = fam ? join(PACK_ROOT, "reviews", fam.name) : null;
  if (reviewDir && existsSync(reviewDir)) {
    for (const f of readdirSync(reviewDir).filter((n) => n.startsWith("review-state."))) {
      const j = readJSON(join(reviewDir, f));
      if (j && (!state || ((j.totals || {}).passed || 0) > ((state.totals || {}).passed || 0))) state = j;
    }
  }
  // The pinned kit and the review harness/state are INTERNAL-DEV concerns — neither ships
  // in the published package. Mark those checks devOnly so `doctor` stays green on an npm
  // install (they surface as advisory ⚠️, not failures).
  const reviewerPresent = existsSync(join(PACK_ROOT, ".claude/skills/cometchat-skill-reviewer"));
  const checks = [
    { name: "node >= 18", ok: nodeMajor >= 18, detail: `v${process.versions.node}` },
    { name: `family`, ok: !!peer, detail: peer ? `${peer.platform} (${peer.label})` : noFamily, advisory: true },
    { name: "Tier-1 catalog present", ok: !!catalog,
      detail: !peer ? noFamily : catalog ? `${peer.catalog}: ${catalog.symbolCount} symbols` : `test-suite/catalogs/${peer.catalog}.json missing (npm run catalog:refresh)`,
      advisory: !peer },
    { name: "pinned kit / harness (dev-only Tier-2/3)", ok: kit.ok, detail: kit.detail, devOnly: true },
    { name: "review state (dev-only)", ok: !!state,
      detail: state ? `${(state.totals || {}).passed || 0}/${(state.totals || {}).count || 0} passed`
        : !peer ? noFamily : !reviewerPresent ? "n/a — e2e review harness is dev-only, not in this install" : "no review yet", devOnly: true },
  ];
  const ok = checks.every((c) => c.ok || c.devOnly || c.advisory); // kit-install + review state are dev-only; no-family is advisory
  out({ ok, checks }, () => {
    console.log(`cometchat-skills doctor (v${packVersion()})`);
    for (const c of checks) console.log(`  ${c.ok ? "✅" : "⚠️ "} ${c.name} — ${c.detail}`);
  });
  process.exit(ok ? 0 : 1);
}

function help() {
  console.log(`cometchat-skills v${packVersion()} — deterministic CLI for the CometChat skills pack

Usage: npx @cometchat/skills <command> [--json]

  detect              Probe the current project (framework, UI Kit, version_conflict)
  add [--ide <a>]     Install the skills for an AI agent (default: claude)
                        --ide claude|kiro|replit  → native SKILL.md tree
                        --ide cursor|codex|antigravity|continue|windsurf|copilot|cline|gemini|aider
                                                  → orienting router + ./.cometchat/skills tree
                                                    (router goes in a <!-- cometchat-skills:start/end -->
                                                     block; your own content in that file is kept)
                        --ide all                 → every supported agent
                        --global                  → user-level dir: claude only (~/.claude/skills; prints
                                                    the \`claude mcp add --scope user\` command instead of
                                                    writing .mcp.json). Agents with no user-level location
                                                    (kiro, replit, the router-file agents) are skipped.
                        (also wires the docs MCP into the agent's config so live
                         docs auto-load: claude .mcp.json · cursor .cursor/mcp.json ·
                         codex .codex/config.toml · gemini .gemini/settings.json)
                        --no-mcp                  → skip the MCP wiring
                        --family <platform>       → force the family (monorepo root / ambiguous detect;
                                                    e.g. js-calls, ios-calls to add a headless calls skill
                                                    alongside the UI Kit skills)
  list                List the skills this pack ships
  info <slug>         Show a skill's triggers + compatibility
  verify [tier]       Run gates: lint | catalog | fences | predicate | all | ci
  catalog [--check]   Refresh the Tier-1 catalog from the installed kit (oracle refresh)
  doctor              Environment health check
  version | help

Notes:
  • Credentials/provisioning (auth, provision, config, features) are a
    SEPARATE published tool, @cometchat/skills-cli — see the core skill's
    references/setup-credentials.md. This CLI is the skill-management + verify layer.`);
}

switch (CMD) {
  case "detect": cmdDetect(); break;
  case "add": case "install": cmdAdd(); break;
  case "list": cmdList(); break;
  case "info": cmdInfo(); break;
  case "verify": cmdVerify(); break;
  case "catalog": cmdCatalog(); break;
  case "doctor": cmdDoctor(); break;
  case "version": case "--version": case "-v": console.log(packVersion()); break;
  case "help": case "--help": case "-h": case undefined: help(); break;
  default: console.error(`unknown command: ${CMD}\n`); help(); process.exit(2);
}
