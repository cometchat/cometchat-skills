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

  // Calls dispatcher — shared across every family (v4.1)
  { name: "cometchat-calls", families: ["web", "native", "flutter", "angular", "android", "ios"], description: "Calls entry point — routes to per-family -calls skill, picks standalone vs additive mode" },

  // Cross-family polish (v4.1) — i18n + accessibility apply to every family
  { name: "cometchat-i18n", families: ["web", "native", "flutter", "angular", "android", "ios"], description: "Localization across all kits — CometChatLocalize.init/setLocale signature differences, RTL, fallback language, custom resources" },
  { name: "cometchat-a11y", families: ["web", "native", "flutter", "angular", "android", "ios"], description: "Accessibility (WCAG 2.1 AA) — contrast, keyboard nav, live regions for new messages, focus management on chat entry, prefers-reduced-motion, calls a11y" },

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
  { name: "cometchat-react-calls",             families: ["web"], description: "Web calls (v4.1) — Calls SDK install, dual-SDK init, Incoming/Outgoing/Ongoing, framework SSR safety" },
  { name: "cometchat-react-testing",           families: ["web"], description: "Web testing (v4.1) — Vitest + RTL setup, mocking the SDK, Playwright e2e, init-resolves-before-render assertion, no-Auth-Key-in-source meta-test, CI" },
  { name: "cometchat-react-push",              families: ["web"], description: "Web push (v4.1) — Service Worker + VAPID + Push API for new-message notifications, server-side webhook send, click-through routing, iOS PWA-only caveat" },

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
  { name: "cometchat-native-calls",            families: ["native"], description: "RN calls (v4.1) — Calls SDK + callkeep + voip-push + FCM, CallKit/ConnectionService, dev-client requirement" },

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
  { name: "cometchat-angular-calls",            families: ["angular"], description: "Angular calls (v4.1) — Calls SDK in APP_INITIALIZER, NgZone correctness, <cometchat-call-buttons> + <cometchat-incoming-call>" },
  { name: "cometchat-angular-testing",          families: ["angular"], description: "Angular testing (v4.1) — Karma OR Jest, TestBed with CUSTOM_ELEMENTS_SCHEMA, NgZone-aware fakeAsync, Cypress e2e" },
  { name: "cometchat-angular-push",             families: ["angular"], description: "Angular push (v4.1) — @angular/service-worker + ngsw-config, SwPush subscription, click-through via Router.navigateByUrl, Universal SSR guards" },

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
  { name: "cometchat-android-v5-calls",          families: ["android"], description: "V5 calls (v4.1) — calls-sdk-android Cloudsmith install, ConnectionService + FCM VoIP, foreground service, 16 deep references/" },

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
  { name: "cometchat-android-v6-calls",           families: ["android"], description: "V6 calls (v4.1, beta) — calls bundled into chatuikit-{compose,kotlin}, .enableCalling(), surface-aware Compose+Views routing" },
  { name: "cometchat-android-v6-migration",       families: ["android"], description: "V5→V6 migration recipes — gradle deps rewrite, UIKitSettings.Builder API, theme parent (CometChatTheme.DayNight), calls bundled, Compose vs Views cohort selection" },

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
  { name: "cometchat-flutter-v5-testing",        families: ["flutter"], description: "V5 testing (v4.1) — flutter_test + mocktail, GetX-aware widget tests, integration_test, golden tests, CI" },

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
  { name: "cometchat-flutter-v6-testing",        families: ["flutter"], description: "V6 testing (v4.1) — flutter_test + bloc_test, BlocProvider.value patterns, integration_test, calls init-order assertion" },
  { name: "cometchat-flutter-v6-push",           families: ["flutter"], description: "V6 push (v4.1) — firebase_messaging FCM/APNs, background isolate handler with @pragma vm:entry-point, Bloc-driven foreground UI, deep-link to chat threads" },

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
  { name: "cometchat-ios-calls",                 families: ["ios"], description: "iOS calls (v4.1) — CometChatCallsSDK install, CallKit + PushKit VoIP, AVAudioSession routing, mixed SwiftUI/UIKit hosting" },
  { name: "cometchat-ios-testing",               families: ["ios"], description: "iOS testing (v4.1) — XCTest + protocol-wrapped SDK mocks, async/await tests, SnapshotTesting, XCUITest, Xcode Cloud / GitHub Actions CI" },
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
//
// Three install modes:
//
//   - "multi"  → one SKILL.md per skill in a directory tree. Anthropic-spec
//                native. Used by Claude Code, Replit Agent, Kiro.
//
//   - "single" → all skills concatenated into one markdown file at a
//                specific path. Used by GitHub Copilot Chat
//                (.github/copilot-instructions.md), Cursor + Continue.dev
//                (AGENTS.md at project root), Cline (.clinerules/cometchat.md),
//                Aider (CONVENTIONS.md). The single file is markdown with
//                `---` separators between skills — works with any agent that
//                reads markdown context.
//
//   - "cli-only" → no file written. The agent uses the `cometchat` CLI
//                  directly. For agents without a skill/rules format
//                  (Codex CLI, Gemini CLI, Aider when not using
//                  CONVENTIONS.md). Installer prints CLI usage hints.
//
// File-path notes:
//   - Cursor's docs (cursor.com/docs/rules) say rules live at `.cursor/rules/`,
//     NOT `.cursor/skills/`. AGENTS.md at project root is the simpler
//     alternative Cursor also supports.
//   - GitHub Copilot reads `.github/copilot-instructions.md` automatically.
//   - Cline reads `.clinerules/*.md`.
//   - Aider reads any markdown file passed via `--read CONVENTIONS.md` (or via
//     `read: CONVENTIONS.md` in `.aider.conf.yml`).
const IDE_TARGETS = {
  // Multi-file (Anthropic-spec compatible)
  claude:      { mode: "multi",    local: ".claude/skills",  global: path.join(os.homedir(), ".claude", "skills"),         skillFile: "SKILL.md" },
  kiro:        { mode: "multi",    local: ".kiro/skills",    global: path.join(os.homedir(), ".kiro", "skills"),           skillFile: "SKILL.md" },
  // Replit Agent reads `.agents/skills/` per docs.replit.com/core-concepts/agent/skills.
  replit:      { mode: "multi",    local: ".agents/skills",  global: path.join(os.homedir(), ".config", "agents", "skills"), skillFile: "SKILL.md" },

  // Single-file (concatenated markdown)
  copilot:     { mode: "single",   local: ".github",         global: null, fileName: "copilot-instructions.md" },
  cursor:      { mode: "single",   local: ".",               global: null, fileName: "AGENTS.md" },
  continue:    { mode: "single",   local: ".",               global: null, fileName: "AGENTS.md" },
  cline:       { mode: "single",   local: ".clinerules",     global: null, fileName: "cometchat.md" },
  aider:       { mode: "single",   local: ".",               global: null, fileName: "CONVENTIONS.md" },

  // CLI-only (no skill/rules format on the agent side)
  codex:       { mode: "cli-only", local: null,              global: null },
  gemini:      { mode: "cli-only", local: null,              global: null },
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

/**
 * Generate a short orienting AGENTS.md / CONVENTIONS.md / etc. (~3-5 KB)
 * that tells the agent how to drive the cometchat CLI for any task.
 *
 * Why short instead of full SKILL.md concatenation:
 *   - Cursor / Continue / Cline read these as ALWAYS-ON context. A 430 KB
 *     concatenation burns tokens on every turn. Bad UX, bad cost.
 *   - The CLI is the universal surface — `cometchat init`, `apply-feature`,
 *     `builder open/export`, etc. Agents reliably execute CLI commands.
 *   - Inline help (`cometchat <cmd> --help`) carries the per-command
 *     guidance lazily, only when the agent needs it.
 *
 * The full SKILL.md tree still ships when the user installs with --ide claude
 * (or replit / kiro). For non-Anthropic agents, this short orientation is
 * the right shape.
 */
function generateOrientingMd(skillsToInstall, families) {
  const familyLabel = families.includes("all") ? "all platforms" : families.join(" + ");
  const familyHint = families.length === 1 ? families[0] : "your project's framework";

  let md = `# CometChat — AI Agent Instructions\n\n`;
  md += `> Auto-generated by \`npx @cometchat/skills add\`. Do not hand-edit; rerun the installer to refresh.\n`;
  md += `> Family: **${familyLabel}**. ${skillsToInstall.length} skills available.\n\n`;

  md += `## When the user asks about CometChat\n\n`;
  md += `If the user asks any of the following, run the matching CLI command — DO NOT improvise from training memory:\n\n`;
  md += `| User says... | Run |\n|---|---|\n`;
  md += `| "integrate cometchat" / "add chat" / "/cometchat" | \`cometchat init\` (or walk the user through \`detect\` → \`auth login\` → \`provision setup\` → \`apply\` → \`verify\`) |\n`;
  md += `| "what's my framework" | \`cometchat detect --json\` |\n`;
  md += `| "log me into CometChat" / "set up credentials" | \`cometchat auth login\` then \`cometchat provision setup --app-id <id> --framework <fw>\` |\n`;
  md += `| "design chat visually" / "open the UI Kit Builder" | \`cometchat builder open --json\` (returns a deep URL into the dashboard's UI Kit Builder), then \`cometchat builder export --target . --json\` after the user designs |\n`;
  md += `| "add polls" / "enable smart replies" / "turn on \\<feature\\>" | \`cometchat features list\` to find the feature id, then \`cometchat apply-feature <id>\` |\n`;
  md += `| "match my brand" / "theme it like Slack" | \`cometchat apply-theme --preset slack\` (or \`--primary-color #...\`) |\n`;
  md += `| "use real auth tokens, not the auth key" | \`cometchat production-auth\` |\n`;
  md += `| "what went wrong" / "diagnose this" | \`cometchat doctor\` |\n`;
  md += `| "what's installed already" | \`cometchat info\` or \`cometchat status\` |\n\n`;

  md += `Run \`cometchat --help\` for the full command list. Each subcommand has \`--help\` with detailed usage.\n\n`;

  md += `## How CometChat integration works (${familyHint})\n\n`;
  md += `1. **Detect** the framework — \`cometchat detect --json\` returns framework, version, env-var prefix, and existing-integration state.\n`;
  md += `2. **Authenticate** — the user logs into the CometChat dashboard via \`cometchat auth login\` (browser flow). Token is stored in OS keychain.\n`;
  md += `3. **Provision** — \`cometchat provision setup --app-id <id> --framework <fw>\` writes credentials to the right env file (\`.env\` for Vite, \`.env.local\` for Next.js, \`local.properties\` for Android, \`Secrets.swift\` for iOS, etc.).\n`;
  md += `4. **Apply** — \`cometchat apply --experience <N>\` writes the integration code (provider, components, placement). Idempotent.\n`;
  md += `5. **Verify** — \`cometchat verify\` runs build + AST checks. \`cometchat doctor\` runs combined diagnostics.\n`;
  md += `6. **Iterate** — features / theming / customization via the CLI commands above.\n\n`;

  md += `## Hard rules (non-negotiable)\n\n`;
  md += `- **Run \`cometchat detect\` BEFORE making framework assumptions.** The user's project might be React+Vite, Next.js App Router, React Router v7, Astro, Expo, bare RN, Angular 12-15, native Android (V5 stable + V6 beta), iOS V5, or Flutter (V5 stable + V6 beta) — each has different conventions.\n`;
  md += `- **NEVER hardcode credentials.** Use \`cometchat provision setup\`, which writes the right env file with the right prefix. The Auth Key is for dev only — \`cometchat production-auth\` upgrades to server-minted tokens.\n`;
  md += `- **NEVER hand-roll a custom search UI** — the UI Kit ships \`<CometChatSearch>\` (and \`showSearchBar\` on \`<CometChatConversations>\`). Hand-rolling silently breaks pagination + result highlighting.\n`;
  md += `- **NEVER \`Skill()\`-style auto-load skills.** This file is your orientation; for deeper detail, run the CLI command for the specific task. The CLI's \`--help\` text is the source of truth.\n`;
  md += `- **Component names + props** — for an unfamiliar component, run \`cometchat features info <name>\` or query the CometChat docs MCP if available. Don't invent from training data; the UI Kit's API surface has changed across versions.\n\n`;

  md += `## When you need richer guidance\n\n`;
  md += `Each \`cometchat <cmd> --help\` covers usage for that command. For deeper skill content (placement patterns, customization four-tier model, troubleshooting symptom-table, framework-specific gotchas) — install the multi-file skill set:\n\n`;
  md += "```bash\n";
  md += `npx @cometchat/skills add --family ${families[0] || "web"} --ide claude\n`;
  md += "```\n\n";
  md += `That writes ${skillsToInstall.length} per-skill markdown files to \`.claude/skills/cometchat-*/SKILL.md\`. Cursor / Continue / Cline can read those too — open the files directly when needed (\`@.claude/skills/cometchat-core/SKILL.md\` in Cursor, etc.).\n`;

  return md;
}

/**
 * Write a single orienting file (AGENTS.md / CONVENTIONS.md / etc.) at
 * <baseDir>/<fileName>. Used for non-Anthropic-spec agents that read one
 * always-on context file instead of a per-skill directory tree.
 *
 * The orienting file is short (~3-5 KB) and points the agent at the CLI as
 * the universal surface. The full per-skill SKILL.md tree is opt-in via
 * `--ide claude` (or replit / kiro) for agents that want the rich content.
 */
function installSingleFileSkills(skillsToInstall, baseDir, fileName, families) {
  ensureDir(baseDir);
  const dest = path.join(baseDir, fileName);
  fs.writeFileSync(dest, generateOrientingMd(skillsToInstall, families), "utf8");
  return dest;
}

/**
 * For agents without a skill/rules format (Codex CLI, Gemini CLI), no file
 * is written. The installer just prints CLI usage hints — the agent runs
 * shell commands directly.
 */
function printCliOnlyHints(ide, skillsToInstall) {
  console.log(c.dim(`\n  ${ide} has no skill/rules format. The cometchat CLI is the integration surface.`));
  console.log(c.dim(`  Available commands (run any from the project root):\n`));
  console.log(`    ${c.cyan("cometchat detect")}              Identify framework`);
  console.log(`    ${c.cyan("cometchat auth login")}           Authenticate to CometChat`);
  console.log(`    ${c.cyan("cometchat provision setup")}      Wire credentials into .env`);
  console.log(`    ${c.cyan("cometchat init")}                 Apply the integration`);
  console.log(`    ${c.cyan("cometchat builder open")}         Visual UI Kit Builder (deep URL)`);
  console.log(`    ${c.cyan("cometchat builder export")}       Export visual builder output to project`);
  console.log(`    ${c.cyan("cometchat apply-feature <id>")}   Toggle a feature (polls / smart-replies / etc.)`);
  console.log(`    ${c.cyan("cometchat doctor")}               Diagnose drift / missing config`);
  console.log(c.dim(`\n  ${skillsToInstall.length} skills available — none copied (no compatible format).\n`));
}

// ── Multi-agent picker via vercel-labs/skills ────────────────────────────────
//
// Spawns `npx -y skills@<pin> add cometchat/cometchat-skills -s <names>`
// so the interactive multi-agent picker (Claude Code / Cursor / Codex /
// Cline / Kiro / Replit / 50+ agents) shows. The user picks which agents
// to write to; the skills CLI handles the per-agent path conventions.
//
// We pre-resolve the relevant skill list (BASE_SKILLS by default, full
// family if --family is set) and pass the names via `-s name1 name2 ...`
// so the user only sees skills relevant to their integration — not all
// 100+ in the marketplace.
//
// Pin: `skills@1.5.5` was the version verified against this codebase.
// Bump on intentional re-verification; pre-pin avoids breakage from a
// future major bump in the upstream CLI.
const SKILLS_CLI_PIN = "skills@1.5.5";
const SKILLS_REPO = "cometchat/cometchat-skills";

/**
 * Read package.json + signal files to build a one-line "Detected" string
 * we show the user before spawning the picker. Strictly cosmetic — the
 * actual install doesn't depend on this.
 *
 * Returns something like:
 *   "Vite + React 19 + TypeScript (web family)"
 *   "Next.js 14 + TypeScript (web family)"
 *   "Expo 49 + React Native 0.72 (native family)"
 *   "no framework detected — base skills install fine without one"
 */
function describeProjectContext(cwd) {
  const pkg = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8")); }
    catch { return null; }
  })();

  const family = detectFamily(cwd);
  const familyLabel = family ? FAMILY_LABELS[family] : null;
  if (!pkg) {
    return family
      ? { line: `${familyLabel} project`, family }
      : { line: "no framework detected — base skills install fine without one", family: null };
  }

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const hasTS = !!(deps.typescript || pkg.types || pkg.typings);
  const reactV = deps.react ? deps.react.replace(/^[~^]/, "").split(".")[0] : null;
  const parts = [];

  if (deps.next) parts.push(`Next.js ${deps.next.replace(/^[~^]/, "").split(".")[0]}`);
  else if (deps.vite || deps["@vitejs/plugin-react"]) parts.push(`Vite${reactV ? ` + React ${reactV}` : ""}`);
  else if (deps.astro) parts.push(`Astro`);
  else if (deps.expo) parts.push(`Expo ${deps.expo.replace(/^[~^]/, "").split(".")[0]}${deps["react-native"] ? ` + React Native ${deps["react-native"].replace(/^[~^]/, "").split(".")[0]}` : ""}`);
  else if (deps["react-native"]) parts.push(`React Native ${deps["react-native"].replace(/^[~^]/, "").split(".")[0]}`);
  else if (deps["@angular/core"]) parts.push(`Angular ${deps["@angular/core"].replace(/^[~^]/, "").split(".")[0]}`);
  else if (deps.react) parts.push(`React ${reactV}`);
  else if (familyLabel) parts.push(familyLabel);

  if (hasTS && !parts.some(p => p.includes("TypeScript"))) parts.push("TypeScript");

  const line = parts.length
    ? `${parts.join(" + ")}${family ? ` (${family} family)` : ""}`
    : familyLabel || "unknown framework — base install still works";

  return { line, family };
}

async function delegateToSkillsCli({ skills, families, isGlobal }) {
  const skillNames = skills.map(s => s.name);
  const isBaseInstall = families.length === 1 && families[0] === "base";
  const cwd = process.cwd();
  const ctx = describeProjectContext(cwd);
  const projectPath = cwd.replace(os.homedir(), "~");

  // Pre-spawn: brand + project context + framing of what's about to happen
  const installLabel = isBaseInstall
    ? `base install ${c.dim("· dispatcher routes the rest at runtime")}`
    : `${families.includes("all") ? "all" : families.join("+")} family ${c.dim(`· ${skillNames.length} skills`)}`;

  console.log(``);
  console.log(`  ${c.bold(c.cyan("CometChat Skills"))} ${c.dim("·")} ${installLabel}`);
  console.log(``);
  console.log(`  ${c.dim("Project")}    ${projectPath}`);
  console.log(`  ${c.dim("Detected")}   ${ctx.line}`);
  console.log(``);
  if (isBaseInstall) {
    console.log(`  ${c.gray(`We're about to install ${skillNames.length} cross-family skills (${skillNames.map(s => s.replace(/^cometchat-?/, "") || "router").filter(Boolean).join(", ")})`)}`);
    console.log(`  ${c.gray(`to whichever AI agents you pick. Once installed, run /cometchat in your IDE`)}`);
    console.log(`  ${c.gray(`— the dispatcher detects your framework and writes the integration.`)}`);
  } else {
    console.log(`  ${c.gray(`Installing ${skillNames.length} ${families.join("+")} skills via the multi-agent picker.`)}`);
  }
  console.log(``);
  console.log(`  ${c.gray("Launching the multi-agent picker...")}`);
  console.log(``);

  const npxArgs = [
    "-y",                       // auto-accept the npx install prompt for the skills CLI itself
    SKILLS_CLI_PIN,
    "add",
    SKILLS_REPO,
    "-s", ...skillNames,        // space-separated skill names (skills CLI's flag shape)
  ];
  if (isGlobal) npxArgs.push("-g");

  // F42 (2026-05-22) + F79 (2026-05-28): on Windows, `npx` is `npx.cmd` /
  // `npx.ps1` and Node's spawn can't resolve the shim cleanly. The original
  // F42 fix used `shell: true`, but that still fails in some Windows envs
  // (nested npx, PowerShell execution-policy restrictions) with
  // `spawn npx ENOENT` — reported by a customer on 2026-05-28.
  //
  // F79: on Windows, resolve npm's bundled `npx-cli.js` next to the running
  // Node binary and invoke it directly via `process.execPath`. This bypasses
  // the .cmd/.ps1 shim entirely. Falls back to the F42 `shell: true` path if
  // npx-cli.js can't be located (pnpm / yarn / custom Node installs without
  // a bundled npm). macOS/Linux keep the plain `spawn("npx")` path unchanged.
  const isWindows = process.platform === "win32";

  let spawnCmd = "npx";
  let spawnArgs = npxArgs;
  let spawnOpts = { stdio: "inherit" };

  if (isWindows) {
    // npm ships npx-cli.js at <node-dir>/node_modules/npm/bin/npx-cli.js
    const nodeDir = path.dirname(process.execPath);
    const npxCli = path.join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js");
    if (fs.existsSync(npxCli)) {
      spawnCmd = process.execPath;          // the current node binary
      spawnArgs = [npxCli, ...npxArgs];
      spawnOpts = { stdio: "inherit" };     // no shell needed — direct node invocation
    } else {
      // Fallback: F42 path (shim via shell). Covers pnpm/yarn/custom installs.
      spawnOpts = { stdio: "inherit", shell: true };
    }
  }

  return new Promise((resolve) => {
    const child = spawn(spawnCmd, spawnArgs, spawnOpts);
    child.on("close", (code) => {
      if (code === 0) {
        // Post-spawn success: celebrate + concrete next steps
        printPostInstallNextSteps({ isBaseInstall, ctx, projectPath });
      }
      resolve(code ?? 1);
    });
    child.on("error", (err) => {
      console.error(c.red(`\n  ✗ Failed to spawn skills CLI: ${err.message}`));
      console.error(c.dim(`  Falling back to legacy direct-write — re-run with --ide <name> to bypass the picker.\n`));
      resolve(2);
    });
  });
}

function printPostInstallNextSteps({ isBaseInstall, ctx, projectPath }) {
  console.log(``);
  console.log(`  ${c.green("✓")} ${c.bold(isBaseInstall ? "Base skills installed." : "Skills installed.")}`);
  console.log(``);
  console.log(`  ${c.bold("Next:")} open ${c.cyan(projectPath)} in any agent you picked, then in the chat panel:`);
  console.log(``);
  console.log(`      ${c.cyan("/cometchat add chat to my app")}`);
  console.log(``);
  if (isBaseInstall) {
    const detected = ctx.family ? ctx.line.replace(/ \(.*\)$/, "") : "your framework";
    console.log(`  ${c.gray(`The dispatcher detects ${detected}, walks you through CometChat signup,`)}`);
    console.log(`  ${c.gray(`and writes the integration code based on your project (~30 seconds).`)}`);
  } else {
    console.log(`  ${c.gray("All skills are loaded; the dispatcher walks you through the rest.")}`);
  }
  console.log(``);
  console.log(`  ${c.dim("Docs:")} ${c.cyan("https://www.cometchat.com/docs/skills")}`);
  console.log(``);
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
    ${c.cyan("--ide claude")}     Multi-file SKILL.md at .claude/skills/ (default)
    ${c.cyan("--ide cursor")}     Single AGENTS.md at project root
    ${c.cyan("--ide copilot")}    Single .github/copilot-instructions.md
    ${c.cyan("--ide cline")}      Single .clinerules/cometchat.md
    ${c.cyan("--ide continue")}   Single AGENTS.md at project root
    ${c.cyan("--ide aider")}      Single CONVENTIONS.md at project root
    ${c.cyan("--ide kiro")}       Multi-file SKILL.md at .kiro/skills/
    ${c.cyan("--ide replit")}     Multi-file SKILL.md at .agents/skills/
    ${c.cyan("--ide codex")}      No skill format — print CLI hints
    ${c.cyan("--ide gemini")}     No skill format — print CLI hints
    ${c.cyan("--ide all")}        Install for every IDE

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
    // family-specific skills via its own runtime npx invocation. The
    // user-facing intro is printed by delegateToSkillsCli (interactive
    // flow) or the direct-write loop below (CI flow) — no duplicate
    // banner here.
    skillsToInstall = BASE_SKILLS;
    families = ["base"];
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

    // CLI-only mode: no file write. Just print CLI usage hints.
    if (target.mode === "cli-only") {
      const familyLabel = families.includes("all") ? "all" : families.join("+");
      console.log(`\n  ${c.bold(c.cyan("CometChat Skills"))}  —  ${ide}  —  ${c.bold(familyLabel)} family\n`);
      printCliOnlyHints(ide, skillsToInstall);
      continue;
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

    // ENG-35720: warn if cometchat-* skills already exist at a DIFFERENT IDE target.
    // Reading skills from two paths (e.g. `.agents/skills/` + `.kiro/skills/`) works
    // for agents that scan both (Kiro), but is fragile and confusing. Surface the
    // mismatch so the integrator can clean up the older path.
    if (!isGlobal) {
      const conflictingPaths = Object.entries(IDE_TARGETS)
        .filter(([otherIde, otherTarget]) =>
          otherIde !== ide &&
          otherTarget.mode === "multi" &&
          otherTarget.local !== target.local
        )
        .map(([otherIde, otherTarget]) => ({ ide: otherIde, path: path.join(process.cwd(), otherTarget.local) }))
        .filter(({ path: p }) => {
          try {
            if (!fs.existsSync(p)) return false;
            return fs.readdirSync(p).some(d => d.startsWith("cometchat-"));
          } catch { return false; }
        });
      if (conflictingPaths.length > 0) {
        console.log(`  ${c.yellow("⚠")} Existing CometChat skills found at:`);
        for (const { ide: oIde, path: p } of conflictingPaths) {
          console.log(`     ${c.dim("•")} ${p}/  (from --ide ${oIde})`);
        }
        console.log(`  ${c.dim("Multi-path skill installs work for IDEs that scan all locations (e.g. Kiro), but are fragile.")}\n  ${c.dim("Consider removing the older path or staying on a single --ide flag across re-runs.\n")}`);
      }
    }

    ensureDir(baseDir);

    // --clean: wipe existing cometchat-* skill dirs in baseDir before install.
    // Avoids stale skills accumulating across multiple --family runs in the
    // same project. Only touches the cometchat-* skill dirs in multi-mode;
    // single-mode rewrites the whole file.
    if (isClean && target.mode === "multi" && fs.existsSync(baseDir)) {
      let wiped = 0;
      for (const entry of fs.readdirSync(baseDir)) {
        if (entry === "cometchat" || entry.startsWith("cometchat-")) {
          fs.rmSync(path.join(baseDir, entry), { recursive: true, force: true });
          wiped++;
        }
      }
      if (wiped > 0) console.log(c.dim(`  ✓ cleaned ${wiped} existing cometchat-* skill ${wiped === 1 ? "dir" : "dirs"}\n`));
    }

    if (target.mode === "single") {
      const spinner = ora ? ora({ text: target.fileName, prefixText: "  " }).start() : null;
      try {
        installSingleFileSkills(skillsToInstall, baseDir, target.fileName, families);
        if (spinner) spinner.succeed(c.green("✓ ") + c.bold(target.fileName) + `  ${c.dim(`(${skillsToInstall.length} skills concatenated)`)}`);
        else console.log(`  ✓ ${target.fileName} (${skillsToInstall.length} skills)`);
      } catch (err) {
        if (spinner) spinner.fail(c.red(`✗ ${target.fileName}: ${err.message}`));
        else console.error(`  ✗ ${target.fileName}: ${err.message}`);
      }
    } else {
      // multi mode: one SKILL.md per skill
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
