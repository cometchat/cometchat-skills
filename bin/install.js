#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { spawn } = require("child_process");

// ── Lazy-load optional deps ───────────────────────────────────────────────────
function tryRequire(name) {
  try { return require(name); } catch { return null; }
}

const chalk = tryRequire("chalk");
const ora = tryRequire("ora");

const c = {
  bold:   (s) => chalk ? chalk.bold(s)   : s,
  cyan:   (s) => chalk ? chalk.cyan(s)   : s,
  green:  (s) => chalk ? chalk.green(s)  : s,
  yellow: (s) => chalk ? chalk.yellow(s) : s,
  gray:   (s) => chalk ? chalk.gray(s)   : s,
  red:    (s) => chalk ? chalk.red(s)    : s,
  dim:    (s) => chalk ? chalk.dim(s)    : s,
};

// ── Skills registry ───────────────────────────────────────────────────────────
const SKILLS_SRC_DIR = path.join(__dirname, "..", "skills");

// Each skill declares which families it belongs to. The dispatcher (`cometchat`)
// is shared across all families; pattern skills are family-specific. Adding a
// new family (e.g. flutter) means flipping its `coming soon` placeholder below
// to real entries with `families: ["flutter"]`.
const SKILLS = [
  // Dispatcher — shared across every family
  { name: "cometchat", families: ["web", "native", "flutter", "angular", "android", "ios"], description: "Entry point — detects framework, handles onboarding, guides integration" },

  // Web (React / Next.js / React Router / Astro)
  { name: "cometchat-core",                    families: ["web"], description: "Foundational rules — init, login, CSS, env vars, SSR safety, provider" },
  { name: "cometchat-components",              families: ["web"], description: "Component catalog — names, props, composition patterns" },
  { name: "cometchat-placement",               families: ["web"], description: "Where to put chat — route, modal, drawer, widget, embedded" },
  { name: "cometchat-react-patterns",          families: ["web"], description: "React / Vite / CRA integration patterns" },
  { name: "cometchat-nextjs-patterns",         families: ["web"], description: "Next.js App Router + Pages Router patterns" },
  { name: "cometchat-react-router-patterns",   families: ["web"], description: "React Router v6 / v7 patterns" },
  { name: "cometchat-astro-patterns",          families: ["web"], description: "Astro React islands patterns" },
  { name: "cometchat-theming",                 families: ["web"], description: "Theme presets, brand colors, CSS variable overrides" },
  { name: "cometchat-features",                families: ["web"], description: "40+ feature catalog — calls, polls, AI, moderation" },
  { name: "cometchat-customization",           families: ["web"], description: "Component customization — custom views, builders, events" },
  { name: "cometchat-production",              families: ["web"], description: "Production auth — token endpoints, user management, security" },
  { name: "cometchat-troubleshooting",         families: ["web"], description: "Diagnostics — verify, drift, doctor, symptom lookup" },

  // React Native (Expo + bare RN)
  { name: "cometchat-native-core",             families: ["native"], description: "RN: init, login, provider chain, env vars, anti-patterns" },
  { name: "cometchat-native-components",       families: ["native"], description: "RN component catalog — names, props, slot views, request builders" },
  { name: "cometchat-native-placement",        families: ["native"], description: "RN: stack screen, bottom tab, modal, bottom sheet, embedded" },
  { name: "cometchat-native-expo-patterns",    families: ["native"], description: "Expo managed workflow + Expo Router + app.json config" },
  { name: "cometchat-native-bare-patterns",    families: ["native"], description: "Bare RN: pod install, native modules, privacy manifest" },
  { name: "cometchat-native-theming",          families: ["native"], description: "RN: CometChatThemeProvider — colors, typography, dark mode" },
  { name: "cometchat-native-features",         families: ["native"], description: "RN feature catalog — calls, extensions, AI agent, reactions, polls" },
  { name: "cometchat-native-customization",    families: ["native"], description: "RN: custom text formatters, events, request builder filtering" },
  { name: "cometchat-native-production",       families: ["native"], description: "RN: server-minted auth tokens, user management, external-backend recipes" },
  { name: "cometchat-native-push",             families: ["native"], description: "RN push: APNs + FCM, dashboard providers, client registration, deep-link" },
  { name: "cometchat-native-testing",          families: ["native"], description: "RN testing: Jest + RNTL, mocking the kit/SDK, Detox vs Maestro, CI" },
  { name: "cometchat-native-troubleshooting",  families: ["native"], description: "RN troubleshooting: Metro cache, pod install, native module linking" },

  // Angular (12-15)
  { name: "cometchat-angular-core",             families: ["angular"], description: "Angular: UIKitSettingsBuilder init, login order, environment config, provider" },
  { name: "cometchat-angular-components",       families: ["angular"], description: "Angular component catalog — selectors, inputs, content projection, modules" },
  { name: "cometchat-angular-placement",        families: ["angular"], description: "Angular: route, modal, drawer, embedded panel — where to put chat" },
  { name: "cometchat-angular-patterns",         families: ["angular"], description: "Angular integration patterns — modules, lazy loading, environment files" },
  { name: "cometchat-angular-theming",          families: ["angular"], description: "Angular: CometChatThemeService — colors, typography, dark mode" },
  { name: "cometchat-angular-features",         families: ["angular"], description: "Angular feature catalog — calls, polls, reactions, extensions, AI" },
  { name: "cometchat-angular-customization",    families: ["angular"], description: "Angular: content projection, ng-template slots, custom views" },
  { name: "cometchat-angular-production",       families: ["angular"], description: "Angular: server-minted auth tokens, user management, external-backend recipes" },
  { name: "cometchat-angular-troubleshooting",  families: ["angular"], description: "Angular troubleshooting: build errors, module imports, Zone.js issues" },

  // Android native — both V5 (live, Java + Kotlin Views) and V6 (beta,
  // Compose + Kotlin Views) ship together. The V5 + V6 dispatcher entries
  // (`cometchat-android-v5` / `cometchat-android-v6`) are routed by the
  // unified `cometchat` dispatcher after detecting the gradle dep.
  { name: "cometchat-android-v5",                families: ["android"], description: "V5 dispatcher — Java + Kotlin Views (com.cometchat:chat-uikit-android:5.x)" },
  { name: "cometchat-android-v5-core",           families: ["android"], description: "V5: UIKitSettings init, login, dependency setup" },
  { name: "cometchat-android-v5-components",     families: ["android"], description: "V5 component catalog — Conversations, Messages, Users, Groups, Calls" },
  { name: "cometchat-android-v5-placement",      families: ["android"], description: "V5: Activity, Fragment, BottomSheet — where to put chat" },
  { name: "cometchat-android-v5-theming",        families: ["android"], description: "V5: theme attrs, colors.xml, dark mode, brand styling" },
  { name: "cometchat-android-v5-features",       families: ["android"], description: "V5 feature catalog — calls, reactions, polls, extensions, AI" },
  { name: "cometchat-android-v5-customization",  families: ["android"], description: "V5: custom views, DataSource decorators, request builders" },
  { name: "cometchat-android-v5-production",     families: ["android"], description: "V5: server-minted auth tokens, user management, external-backend recipes" },
  { name: "cometchat-android-v5-push",           families: ["android"], description: "V5 push: FCM, dashboard providers, deep-link, foreground/background" },
  { name: "cometchat-android-v5-extensions",     families: ["android"], description: "V5 extensions — moderation, smart replies, message translation" },
  { name: "cometchat-android-v5-testing",        families: ["android"], description: "V5 testing: Espresso, Robolectric, mocking the kit/SDK" },
  { name: "cometchat-android-v5-troubleshooting", families: ["android"], description: "V5 troubleshooting: gradle conflicts, manifest, lifecycle, ProGuard" },

  { name: "cometchat-android-v6",                families: ["android"], description: "V6 dispatcher — Compose + Kotlin Views (chatuikit-{compose,kotlin}-android:6.x)" },
  { name: "cometchat-android-v6-core",           families: ["android"], description: "V6: gradle deps, init, login, message sending" },
  { name: "cometchat-android-v6-events",         families: ["android"], description: "V6: SDK event subscriptions and lifecycle" },
  { name: "cometchat-android-v6-compose-components", families: ["android"], description: "V6 Compose component catalog — Composables for chat UI" },
  { name: "cometchat-android-v6-compose-placement",  families: ["android"], description: "V6 Compose: NavHost, modal, bottom sheet — where to put chat" },
  { name: "cometchat-android-v6-compose-theming",    families: ["android"], description: "V6 Compose: CometChatTheme, color schemes, typography" },
  { name: "cometchat-android-v6-compose-customization", families: ["android"], description: "V6 Compose: custom slots, DataSource, message templates" },
  { name: "cometchat-android-v6-kotlin-components", families: ["android"], description: "V6 Kotlin Views component catalog — custom View classes" },
  { name: "cometchat-android-v6-kotlin-placement",  families: ["android"], description: "V6 Kotlin Views: Activity, Fragment, BottomSheet placement" },
  { name: "cometchat-android-v6-kotlin-theming",    families: ["android"], description: "V6 Kotlin Views: style attributes, colors.xml, dark mode" },
  { name: "cometchat-android-v6-kotlin-customization", families: ["android"], description: "V6 Kotlin Views: custom Views, DataSource, request builders" },
  { name: "cometchat-android-v6-features",       families: ["android"], description: "V6 feature catalog — calls, reactions, polls, AI agent, extensions" },
  { name: "cometchat-android-v6-extensions",     families: ["android"], description: "V6 extensions — moderation, smart replies, message translation" },
  { name: "cometchat-android-v6-builder-settings", families: ["android"], description: "V6: UIKitSettingsBuilder options — presence, typing, receipts" },
  { name: "cometchat-android-v6-production",     families: ["android"], description: "V6: server-minted auth tokens, user management, external-backend recipes" },
  { name: "cometchat-android-v6-push",           families: ["android"], description: "V6 push: FCM, dashboard providers, deep-link" },
  { name: "cometchat-android-v6-testing",        families: ["android"], description: "V6 testing: Espresso, Robolectric, Compose UI tests, mocking" },
  { name: "cometchat-android-v6-troubleshooting", families: ["android"], description: "V6 troubleshooting: gradle, Compose runtime, R8, BuildConfig" },

  // Flutter — V5 stable (`cometchat_chat_uikit:^5.2`) + V6 beta
  // (`cometchat_chat_uikit:^6.0.0-beta`) ship together. Routed by the
  // unified `cometchat` dispatcher after detecting the pubspec.yaml dep.
  { name: "cometchat-flutter-v5",                families: ["flutter"], description: "V5 dispatcher — cometchat_chat_uikit ^5.2 + cometchat_calls_uikit ^5.0" },
  { name: "cometchat-flutter-v5-core",           families: ["flutter"], description: "V5: pubspec deps, UIKitSettings, init/login, app entry" },
  { name: "cometchat-flutter-v5-conversations",  families: ["flutter"], description: "V5: CometChatConversations widget — props, callbacks, request builder" },
  { name: "cometchat-flutter-v5-messages",       families: ["flutter"], description: "V5: CometChatMessages screen — message list, header, composer wiring" },
  { name: "cometchat-flutter-v5-users-groups",   families: ["flutter"], description: "V5: CometChatUsers / CometChatGroups / CometChatGroupMembers" },
  { name: "cometchat-flutter-v5-calls",          families: ["flutter"], description: "V5: voice/video calling — incoming/outgoing/ongoing screens, call buttons" },
  { name: "cometchat-flutter-v5-theming",        families: ["flutter"], description: "V5: CometChatTheme, color palette, typography, dark mode" },
  { name: "cometchat-flutter-v5-customization",  families: ["flutter"], description: "V5: custom message templates, options, text formatters, builders" },
  { name: "cometchat-flutter-v5-events",         families: ["flutter"], description: "V5: CometChatMessageEvents / GroupEvents / CallEvents subscription" },
  { name: "cometchat-flutter-v5-production",     families: ["flutter"], description: "V5: server-minted auth tokens, user management, external-backend recipes" },
  { name: "cometchat-flutter-v5-push",           families: ["flutter"], description: "V5: FCM/APNs push, token lifecycle, deep-link" },
  { name: "cometchat-flutter-v5-troubleshooting", families: ["flutter"], description: "V5 troubleshooting: pubspec, GetX, Pod errors, runtime crashes" },

  { name: "cometchat-flutter-v6",                families: ["flutter"], description: "V6 dispatcher — cometchat_chat_uikit ^6.0.0-beta (Bloc-based)" },
  { name: "cometchat-flutter-v6-core",           families: ["flutter"], description: "V6: pubspec deps, UIKitSettings, init/login, app entry" },
  { name: "cometchat-flutter-v6-components",     families: ["flutter"], description: "V6 component catalog — Bloc-driven widgets, slots, request builders" },
  { name: "cometchat-flutter-v6-conversations",  families: ["flutter"], description: "V6: CometChatConversations widget — Bloc, request builder, callbacks" },
  { name: "cometchat-flutter-v6-messages",       families: ["flutter"], description: "V6: CometChatMessages — list / header / composer composition" },
  { name: "cometchat-flutter-v6-users-groups",   families: ["flutter"], description: "V6: CometChatUsers / CometChatGroups / CometChatGroupMembers" },
  { name: "cometchat-flutter-v6-calls",          families: ["flutter"], description: "V6: voice/video calling — incoming/outgoing/ongoing screens" },
  { name: "cometchat-flutter-v6-features",       families: ["flutter"], description: "V6 feature catalog — calls, polls, reactions, AI, extensions" },
  { name: "cometchat-flutter-v6-placement",      families: ["flutter"], description: "V6: route, modal sheet, embedded widget — where chat lives in the app" },
  { name: "cometchat-flutter-v6-theming",        families: ["flutter"], description: "V6: CometChatThemeHelper, CometChatColorPalette, light/dark schemes" },
  { name: "cometchat-flutter-v6-customization",  families: ["flutter"], description: "V6: bubble factories, message templates, text formatters, slot widgets" },
  { name: "cometchat-flutter-v6-events",         families: ["flutter"], description: "V6: Bloc-based event streams + listener registration" },
  { name: "cometchat-flutter-v6-production",     families: ["flutter"], description: "V6: server-minted auth tokens, user management, external-backend recipes" },
  { name: "cometchat-flutter-v6-troubleshooting", families: ["flutter"], description: "V6 troubleshooting: pubspec, Bloc, theme cache, build errors" },
  { name: "cometchat-flutter-v6-migration",      families: ["flutter"], description: "V5→V6 migration recipes — GetX → Bloc, theme API rewrite, breaking changes" },

  // iOS — V5 stable (`CometChatUIKitSwift:^5`). No V6 beta yet; when
  // it ships, add per-cohort namespacing as Android/Flutter do today.
  { name: "cometchat-ios",                       families: ["ios"], description: "iOS dispatcher — Swift project setup, dependency manager routing" },
  { name: "cometchat-ios-core",                  families: ["ios"], description: "iOS: SDK init, login, UIKit settings builder, SwiftUI/UIKit entry points" },
  { name: "cometchat-ios-components",            families: ["ios"], description: "iOS component catalog — view controllers, SwiftUI views, request builders" },
  { name: "cometchat-ios-placement",             families: ["ios"], description: "iOS: navigation controller, modal, tab, embedded — where chat lives" },
  { name: "cometchat-ios-theming",               families: ["ios"], description: "iOS: CometChatTheme, color tokens, typography, dark mode" },
  { name: "cometchat-ios-features",              families: ["ios"], description: "iOS feature catalog — calls, polls, reactions, AI, extensions" },
  { name: "cometchat-ios-customization",         families: ["ios"], description: "iOS: custom views, message templates, text formatters, DataSource decorators" },
  { name: "cometchat-ios-production",            families: ["ios"], description: "iOS: server-minted auth tokens, user management, external-backend recipes" },
  { name: "cometchat-ios-push",                  families: ["ios"], description: "iOS push: APNs + VoIP, CallKit, token lifecycle, deep-link" },
  { name: "cometchat-ios-troubleshooting",       families: ["ios"], description: "iOS troubleshooting: SPM, CocoaPods, Xcode build errors, Info.plist, runtime crashes" },
];

// ── Base skills (cross-family) ────────────────────────────────────────────────
//
// Skills registered for ALL six families. These are the baseline a dispatcher
// needs to detect framework and route — they're installed in the default
// interactive flow, before any family is resolved. The dispatcher (read at
// runtime in the user's IDE) detects the framework and asks the agent to
// install the relevant family skills via:
//
//   npx @cometchat/skills add --family <X> --ide <Y>
//
// (Logic already in `skills/cometchat/SKILL.md` Step 1 — "If `framework` is
// X AND `cometchat-{X}-core` is NOT loaded: <install command>".)
//
// This list grows automatically as more cross-family skills are registered
// (e.g. when the calls work merges, cometchat-calls/i18n/a11y join).
const ALL_FAMILIES_SET = ["web", "native", "flutter", "angular", "android", "ios"];
const BASE_SKILLS = SKILLS.filter(s =>
  ALL_FAMILIES_SET.every(f => s.families.includes(f))
);

// ── Framework → family routing ────────────────────────────────────────────────
const FRAMEWORK_TO_FAMILY = {
  reactjs:        "web",
  nextjs:         "web",
  "react-router": "web",
  astro:          "web",
  expo:           "native",
  "react-native": "native",
  flutter:        "flutter",
  angular:        "angular",
  android:        "android",
  ios:            "ios",
};

const FAMILY_LABELS = {
  web:     "Web (React / Next.js / React Router / Astro)",
  native:  "React Native (Expo / bare RN)",
  angular: "Angular (12-15)",
  flutter: "Flutter (V5 stable + V6 beta)",
  android: "Android native (V5 stable + V6 beta)",
  ios:     "iOS native (V5 stable)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── IDE target directories ────────────────────────────────────────────────────
const IDE_TARGETS = {
  claude:      { local: ".claude/skills",  global: path.join(os.homedir(), ".claude", "skills"),                  skillFile: "SKILL.md" },
  // Cursor loads agent "skills" from `.cursor/skills/` (not `.cursor/rules/`).
  cursor:      { local: ".cursor/skills",  global: path.join(os.homedir(), ".cursor", "skills"),                  skillFile: "SKILL.md" },
  kiro:        { local: ".kiro/skills",    global: path.join(os.homedir(), ".kiro", "skills"),                    skillFile: "SKILL.md" },
  copilot:     { local: ".github",         global: null,                                                          skillFile: null },         // single-file mode
  // Replit Agent reads `.agents/skills/` per docs.replit.com/core-concepts/agent/skills.
  // Global path matches the convention published by vercel-labs/skills.
  replit:      { local: ".agents/skills",  global: path.join(os.homedir(), ".config", "agents", "skills"),        skillFile: "SKILL.md" },
};

// ── Framework detection (inline — no subprocess) ─────────────────────────────
//
// Reads package.json + signal files in cwd to determine which family this
// project belongs to. Returns the family string ("web", "native", "flutter",
// "angular", "android", "ios") or null if undetectable.
//
// We inline this rather than subprocess to @cometchat/skills-cli because:
//   1. Cold `npx -y` adds 5-15 s on first run — bad first impression
//   2. Avoids attack surface of auto-installing a separate package
//   3. The unified installer only needs family resolution, not the CLI's
//      richer detection (router/bundler/env-prefix/SSR strategy etc.)
//
// Detection order matters — more specific first:
//   1. RN (expo / react-native dep)  — must come before generic React
//   2. Next.js (next dep)
//   3. React Router (any of the v6/v7 deps)
//   4. Astro (deps OR astro.config.*)
//   5. Angular (@angular/core dep OR angular.json)
//   6. Generic React (react / react-dom dep) → web
//   7. Flutter (pubspec.yaml with `flutter:` key)
//   8. Android (build.gradle / settings.gradle)
//   9. iOS (*.xcodeproj, *.xcworkspace, Package.swift with .iOS, Podfile with platform :ios)
function detectFamily(cwd) {
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps["expo"] || deps["react-native"]) return "native";
      if (deps["next"]) return "web";
      if (deps["@react-router/dev"] || deps["react-router-dom"] || deps["react-router"]) return "web";
      if (deps["astro"]) return "web";
      if (deps["@angular/core"]) return "angular";
      if (deps["react"] || deps["react-dom"]) return "web";
    } catch { /* malformed package.json — fall through */ }
  }

  // Astro config exists even before deps install
  for (const ext of ["ts", "mjs", "js", "cjs"]) {
    if (fs.existsSync(path.join(cwd, `astro.config.${ext}`))) return "web";
  }

  // Flutter — pubspec.yaml with `flutter:` key
  const pubspecPath = path.join(cwd, "pubspec.yaml");
  if (fs.existsSync(pubspecPath)) {
    try {
      const pubspec = fs.readFileSync(pubspecPath, "utf-8");
      if (/^flutter:/m.test(pubspec)) return "flutter";
    } catch { /* fall through */ }
  }

  // Angular workspace
  if (fs.existsSync(path.join(cwd, "angular.json"))) return "angular";

  // Android (Gradle-based)
  if (
    fs.existsSync(path.join(cwd, "build.gradle")) ||
    fs.existsSync(path.join(cwd, "build.gradle.kts")) ||
    fs.existsSync(path.join(cwd, "settings.gradle"))
  ) {
    return "android";
  }

  // iOS — Xcode project / workspace, or Package.swift with .iOS, or Podfile with `platform :ios`
  try {
    for (const f of fs.readdirSync(cwd)) {
      if (f.endsWith(".xcodeproj") || f.endsWith(".xcworkspace")) return "ios";
    }
  } catch { /* unreadable cwd — fall through */ }
  const podfilePath = path.join(cwd, "Podfile");
  if (fs.existsSync(podfilePath)) {
    try {
      if (/platform\s+:ios/.test(fs.readFileSync(podfilePath, "utf-8"))) return "ios";
    } catch { /* fall through */ }
  }
  const packageSwiftPath = path.join(cwd, "Package.swift");
  if (fs.existsSync(packageSwiftPath)) {
    try {
      if (/\.iOS\s*\(/.test(fs.readFileSync(packageSwiftPath, "utf-8"))) return "ios";
    } catch { /* fall through */ }
  }

  return null;
}

function promptFamily() {
  // Refuse to prompt in non-interactive environments — readline would block
  // forever waiting for stdin that never comes (CI, Dockerfile, scripted
  // installs). Tell the user how to recover.
  if (!process.stdin.isTTY) {
    console.error(c.red(`\n  Cannot prompt for family in a non-interactive environment.`));
    console.error(`  Pass ${c.cyan("--family <name>")} explicitly. Valid:`);
    console.error(`    ${Object.keys(FAMILY_LABELS).join(", ")}, all\n`);
    process.exit(1);
  }

  const families = ["web", "native", "flutter", "angular", "android", "ios"];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n  ${c.bold("Which framework does your project use?")}\n`);
  families.forEach((f, i) => {
    console.log(`    ${c.cyan(String(i + 1))}. ${FAMILY_LABELS[f]}`);
  });
  return new Promise((resolve) => {
    rl.question(`\n  Enter 1-${families.length}: `, (answer) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= families.length) {
        console.error(c.red(`\n  Invalid choice: ${answer}\n`));
        process.exit(1);
      }
      resolve(families[idx]);
    });
  });
}

// Returns an array of families. Most calls return a single-item array;
// repeated `--family` flags (`--family web --family native`) return multiple,
// useful for monorepos with both web + RN packages. `--family all` is a single
// item that means "every family" downstream.
async function resolveFamilies(args) {
  // 1. Explicit --family flag(s) — repeatable
  const explicit = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--family" && args[i + 1]) {
      const f = args[i + 1];
      if (f === "all") { explicit.length = 0; explicit.push("all"); break; }
      if (!Object.keys(FAMILY_LABELS).includes(f)) {
        console.error(c.red(`\n  Unknown family: ${f}. Valid: ${Object.keys(FAMILY_LABELS).join(", ")}, all\n`));
        process.exit(1);
      }
      if (!explicit.includes(f)) explicit.push(f);
      i++; // skip the value
    }
  }
  if (explicit.length > 0) return explicit;

  // 2. Auto-detect (inline, no subprocess)
  process.stdout.write(c.dim("\n  Detecting framework... "));
  const family = detectFamily(process.cwd());
  if (family) {
    console.log(c.green(`✓ ${family} — ${FAMILY_LABELS[family]}`));
    return [family];
  }
  console.log(c.dim("could not detect from project files"));

  // 3. Prompt the user (with TTY guard)
  return [await promptFamily()];
}

// ── Install one skill (per-IDE write) ─────────────────────────────────────────
function installSkill(skill, baseDir, skillFile) {
  const src = path.join(SKILLS_SRC_DIR, skill.name, "SKILL.md");
  if (!fs.existsSync(src)) {
    return null;
  }
  const skillDir = path.join(baseDir, skill.name);
  ensureDir(skillDir);
  const dest = path.join(skillDir, skillFile);
  fs.copyFileSync(src, dest);

  // Copy supporting files (e.g. references/component-catalog.md)
  // that live alongside SKILL.md in the skill's directory.
  const refsDir = path.join(SKILLS_SRC_DIR, skill.name, "references");
  if (fs.existsSync(refsDir)) {
    const destRefs = path.join(skillDir, "references");
    ensureDir(destRefs);
    for (const file of fs.readdirSync(refsDir)) {
      fs.copyFileSync(path.join(refsDir, file), path.join(destRefs, file));
    }
  }

  return dest;
}

function installCopilotSkills(skillsToInstall, baseDir) {
  ensureDir(baseDir);
  const dest = path.join(baseDir, "copilot-instructions.md");
  let content = "# CometChat Skills\n\n";
  for (const skill of skillsToInstall) {
    const src = path.join(SKILLS_SRC_DIR, skill.name, "SKILL.md");
    if (!fs.existsSync(src)) continue;
    content += fs.readFileSync(src, "utf8") + "\n\n---\n\n";
  }
  fs.writeFileSync(dest, content, "utf8");
  return dest;
}

// ── Multi-agent picker via vercel-labs/skills ────────────────────────────────
//
// Spawns `npx -y skills@<pin> add cometchat-team/cometchat-skills -s <names>`
// so the interactive multi-agent picker (Claude Code / Cursor / Codex /
// Cline / Kiro / Replit / 50+ agents) shows. The user picks which agents
// to write to; the skills CLI handles the per-agent path conventions.
//
// We pre-resolve the family-specific skill list (from `resolveFamilies` +
// SKILLS table) and pass the names via `-s name1 name2 ...` so the user
// only sees skills relevant to their detected family — not all 100+ in
// the marketplace.
//
// Pin: `skills@1.5.5` was the version verified against this codebase.
// Bump on intentional re-verification; pre-pin avoids breakage from a
// future major bump in the upstream CLI.
const SKILLS_CLI_PIN = "skills@1.5.5";
const SKILLS_REPO = "cometchat-team/cometchat-skills";

async function delegateToSkillsCli({ skills, families, isGlobal }) {
  const skillNames = skills.map(s => s.name);
  const familyLabel = families.includes("all") ? "all" : families.join("+");

  console.log(`\n  ${c.bold(c.cyan("CometChat Skills"))}  —  ${c.bold(familyLabel)} family  —  ${skillNames.length} skills`);
  console.log(`  ${c.gray("Launching multi-agent picker via vercel-labs/skills...")}\n`);

  const npxArgs = [
    "-y",                       // auto-accept the npx install prompt for the skills CLI itself
    SKILLS_CLI_PIN,
    "add",
    SKILLS_REPO,
    "-s", ...skillNames,        // space-separated skill names (skills CLI's flag shape)
  ];
  if (isGlobal) npxArgs.push("-g");

  return new Promise((resolve) => {
    const child = spawn("npx", npxArgs, {
      stdio: "inherit",
      shell: false,
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", (err) => {
      console.error(c.red(`\n  ✗ Failed to spawn skills CLI: ${err.message}`));
      console.error(c.dim(`  Falling back to legacy direct-write — re-run with --ide <name> to bypass the picker.\n`));
      resolve(2);
    });
  });
}

function printHelp() {
  console.log(`
  ${c.bold("@cometchat/skills")} — Install CometChat AI coding skills

  ${c.bold("Usage:")}
    ${c.cyan("npx @cometchat/skills add")}                       Base install + interactive multi-agent picker
    ${c.cyan("npx @cometchat/skills add --family <name>")}       Install full family upfront (no runtime expansion)
    ${c.cyan("npx @cometchat/skills add --ide <name>")}          Direct-write base skills to one IDE (CI/scripted)

  ${c.bold("Two install shapes:")}
    ${c.bold("Base install")} (default — no --family flag): writes only the cross-family
      skills (the cometchat dispatcher + cross-family helpers). Once installed,
      open your project in your IDE and run /cometchat — the dispatcher detects
      your framework and asks the agent to install the family-specific skills
      via \`npx @cometchat/skills add --family <X> --ide <Y>\`. Smallest initial
      install, dispatcher routes the rest. Recommended for most users.
    ${c.bold("Full family install")} (--family flag): writes the dispatcher + every
      skill registered for that family (web=13, android=31, flutter=28, etc.)
      upfront. Use when you know the project's framework and prefer all skills
      present immediately. Used by power users + CI smoke tests.

  ${c.bold("Family values:")}
    ${c.cyan("web")}      React / Next.js / React Router / Astro
    ${c.cyan("native")}   Expo / bare React Native
    ${c.cyan("angular")}  Angular (12-15)
    ${c.cyan("android")}  Android native (V5 stable + V6 beta)
    ${c.cyan("flutter")}  Flutter (V5 stable + V6 beta)
    ${c.cyan("ios")}      iOS native (V5 stable)
    ${c.cyan("all")}      Install every skill (legacy v3 behavior)

  ${c.bold("IDE selection (direct-write mode only — default: claude):")}
    ${c.cyan("--ide cursor")}    ${c.cyan("--ide kiro")}    ${c.cyan("--ide copilot")}    ${c.cyan("--ide replit")}    ${c.cyan("--ide all")}

  ${c.bold("Multi-family / monorepo:")}
    ${c.cyan("--family web --family native")}    Install BOTH families (repeat flag)

  ${c.bold("Other:")}
    ${c.cyan("--global")}        Install globally (~/.claude/skills/, etc.)
    ${c.cyan("--clean")}         Wipe existing cometchat-* skill dirs before install (direct-write mode only)
    ${c.cyan("--list")}          Show every skill with its family tags
    ${c.cyan("--no-picker")}     Force direct-write even in interactive TTY (useful for testing the legacy path)

  ${c.bold("After installing, open your project in your IDE and run:")}
    ${c.cyan("/cometchat")}
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(0);
  }

  if (cmd !== "add") {
    console.error(c.red(`\n  Unknown command: ${cmd}`));
    printHelp();
    process.exit(1);
  }

  const isGlobal = args.includes("--global") || args.includes("-g");
  const listOnly = args.includes("--list") || args.includes("-l");
  const isClean  = args.includes("--clean");
  const ideIdx = args.indexOf("--ide");
  const ideArg = ideIdx !== -1 ? args[ideIdx + 1] : "claude";

  if (listOnly) {
    console.log(`\n  ${c.bold("Available skills:")}\n`);
    for (const s of SKILLS) {
      console.log(`  ${c.cyan(s.name)}  ${c.dim(`[${s.families.join(", ")}]`)}`);
      console.log(`    ${c.dim(s.description)}\n`);
    }
    process.exit(0);
  }

  // ── Install mode selection ─────────────────────────────────────────────
  //
  // Three valid invocation shapes:
  //
  //   1. `npx @cometchat/skills add` (TTY, no --family, no --ide)
  //      → BASE INSTALL: install only cross-family skills (cometchat
  //        dispatcher + cometchat-calls + i18n + a11y) via the multi-agent
  //        picker. The dispatcher detects the framework AT RUNTIME inside
  //        the user's IDE and asks the agent to install family-specific
  //        skills via `npx @cometchat/skills add --family <X> --ide <Y>`.
  //        Smallest initial install; routing is the dispatcher's job.
  //
  //   2. `npx @cometchat/skills add --family <X>` (TTY)
  //      → FAMILY INSTALL: install the dispatcher + every skill registered
  //        for family X (web=13, android=31, etc.) via the picker. Use this
  //        when you know upfront which family you want and prefer all
  //        skills present immediately.
  //
  //   3. `npx @cometchat/skills add --ide <Y>` (or non-TTY, e.g. CI)
  //      → DIRECT WRITE: skips the picker and writes directly to one IDE's
  //        directory. With --family, writes the family subset; without, falls
  //        back to BASE skills (CI smoke). Used by Dockerfiles and the
  //        legacy single-agent flow.
  const ideExplicit = ideIdx !== -1;
  const familyExplicit = args.includes("--family");
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  const skipPicker = ideExplicit || !isTTY || args.includes("--no-picker");

  // Resolve skill set based on mode:
  //   - --family X → install the dispatcher + every skill registered for X
  //     (legacy power-user / CI flow; everything present immediately)
  //   - No --family (with or without --ide) → BASE install only. The
  //     dispatcher handles family-specific install at runtime via its own
  //     `npx @cometchat/skills add --family <X>` invocation logic.
  let skillsToInstall;
  let families;
  if (familyExplicit) {
    families = await resolveFamilies(args);
    if (families.includes("all")) {
      skillsToInstall = SKILLS;
    } else {
      const seen = new Set();
      skillsToInstall = [];
      for (const fam of families) {
        for (const s of SKILLS) {
          if (s.families.includes(fam) && !seen.has(s.name)) {
            seen.add(s.name);
            skillsToInstall.push(s);
          }
        }
      }
    }

    // If no pattern skills matched (only the dispatcher), all selected
    // families are "coming soon" — bail with a friendly message rather than
    // installing a half-broken set.
    const patternSkills = skillsToInstall.filter(s => s.name !== "cometchat");
    if (patternSkills.length === 0) {
      const labels = families.map(f => FAMILY_LABELS[f] || f).join(", ");
      console.log(c.yellow(`\n  ⚠ Pattern skills for ${labels} aren't published yet.`));
      console.log(`  Supported families today: ${c.cyan("web")}, ${c.cyan("native")}, ${c.cyan("angular")}, ${c.cyan("android")}, ${c.cyan("flutter")}, ${c.cyan("ios")}.`);
      console.log(`  Run with one of those, or wait for ${families.join(" + ")} skills to ship.\n`);
      process.exit(1);
    }
  } else {
    // Default: base install only (whether interactive or with --ide).
    // The dispatcher detects the framework at runtime and installs the
    // family-specific skills via its own runtime npx invocation.
    skillsToInstall = BASE_SKILLS;
    families = ["base"];
    console.log(`\n  ${c.bold(c.cyan("CometChat Skills"))}  ${c.dim("(base install — dispatcher routes the rest at runtime)")}`);
    console.log(`  ${c.gray(`Installing ${BASE_SKILLS.length} cross-family ${BASE_SKILLS.length === 1 ? "skill" : "skills"}: ${BASE_SKILLS.map(s => s.name).join(", ")}.`)}`);
    console.log(`  ${c.gray("After install, open your project in your IDE → /cometchat detects your framework and asks the agent to install family-specific skills on demand.")}\n`);
  }

  if (!skipPicker) {
    const exitCode = await delegateToSkillsCli({
      skills: skillsToInstall,
      families,
      isGlobal,
    });
    process.exit(exitCode);
  }

  const targets = ideArg === "all" ? Object.keys(IDE_TARGETS) : [ideArg];

  for (const ide of targets) {
    const target = IDE_TARGETS[ide];
    if (!target) {
      console.error(c.red(`\n  Unknown IDE: ${ide}. Valid: ${Object.keys(IDE_TARGETS).join(", ")}, all`));
      process.exit(1);
    }

    if (isGlobal && !target.global) {
      console.log(`\n  ${c.yellow("⚠")} ${ide} does not support global install — skipping.`);
      continue;
    }

    const baseDir = isGlobal ? target.global : path.join(process.cwd(), target.local);
    const scopeLabel = isGlobal
      ? `global  ${c.gray(`(${target.global}/`)}`
      : `local   ${c.gray(`(${target.local}/)`)}`;

    const familyLabel = families.includes("all") ? "all" : families.join("+");
    console.log(`\n  ${c.bold(c.cyan("CometChat Skills"))}  —  ${ide}  —  ${c.bold(familyLabel)} family\n`);
    console.log(`  Scope: ${scopeLabel}\n`);

    ensureDir(baseDir);

    // --clean: wipe existing cometchat-* skill dirs in baseDir before install.
    // Avoids stale skills accumulating across multiple --family runs in the
    // same project (e.g. user runs --family web then later switches to
    // --family native and wants only the new family present). Only touches
    // dirs prefixed `cometchat` so we never blow away unrelated skills.
    if (isClean && ide !== "copilot" && fs.existsSync(baseDir)) {
      let wiped = 0;
      for (const entry of fs.readdirSync(baseDir)) {
        if (entry === "cometchat" || entry.startsWith("cometchat-")) {
          fs.rmSync(path.join(baseDir, entry), { recursive: true, force: true });
          wiped++;
        }
      }
      if (wiped > 0) console.log(c.dim(`  ✓ cleaned ${wiped} existing cometchat-* skill ${wiped === 1 ? "dir" : "dirs"}\n`));
    }

    if (ide === "copilot") {
      const spinner = ora ? ora({ text: "copilot-instructions.md", prefixText: "  " }).start() : null;
      try {
        installCopilotSkills(skillsToInstall, baseDir);
        if (spinner) spinner.succeed(c.green("✓ ") + c.bold("copilot-instructions.md") + `  ${c.dim(`(${skillsToInstall.length} skills concatenated)`)}`);
        else console.log(`  ✓ copilot-instructions.md (${skillsToInstall.length} skills)`);
      } catch (err) {
        if (spinner) spinner.fail(c.red(`✗ copilot-instructions.md: ${err.message}`));
        else console.error(`  ✗ copilot-instructions.md: ${err.message}`);
      }
    } else {
      for (const skill of skillsToInstall) {
        const spinner = ora ? ora({ text: skill.name, prefixText: "  " }).start() : null;
        try {
          installSkill(skill, baseDir, target.skillFile);
          if (spinner) spinner.succeed(c.green("✓ ") + c.bold(skill.name) + `  ${c.dim(skill.description)}`);
          else console.log(`  ✓ ${skill.name}`);
        } catch (err) {
          if (spinner) spinner.fail(c.red(`✗ ${skill.name}: ${err.message}`));
          else console.error(`  ✗ ${skill.name}: ${err.message}`);
        }
      }
    }
  }

  console.log(`\n  ${c.bold("Done.")} Open your project in your IDE and run:\n`);
  console.log(`    ${c.cyan("/cometchat")}\n`);
}

main().catch((err) => {
  console.error(chalk ? chalk.red(`\n  Error: ${err.message}`) : `\n  Error: ${err.message}`);
  process.exit(1);
});
