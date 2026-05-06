---
name: cometchat
description: Entry-point for CometChat integration in any React, React Native, Angular, Android, Flutter, or iOS project — web (React/Next.js/React Router/Astro), React Native (Expo/bare), Angular (12-15), native Android (V5 stable, V6 beta), Flutter (V5 stable, V6 beta), and native iOS (V5 stable). Detects the framework, gathers requirements through an interactive conversation, and writes production-quality integration code.
license: "MIT"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat dispatcher entry react nextjs react-router astro expo react-native angular android flutter ios chat"
---

## Use this skill when

The user wants to add CometChat to any kind of project. Trigger phrases:

- `/cometchat`
- "add cometchat", "integrate cometchat", "add chat to my app"
- "add messaging", "add chat ui", "add in-app chat"

This is the **entry point for every framework**. Do NOT invoke
framework-specific skills directly — this dispatcher detects the
framework first and routes to the right ones.

**Supported frameworks:**

| Family | Frameworks |
|---|---|
| **Web** | React (Vite/CRA), Next.js, React Router v6/v7, Astro |
| **React Native** | Expo (managed + Expo Router), bare RN CLI |
| **Angular** | Angular 12-15 (Angular CLI / NgModule) |
| **Android** | V5 stable (Java + Kotlin Views) / V6 beta (Compose + Kotlin Views) |
| **Flutter** | V5 stable (GetX-based, `cometchat_chat_uikit:^5.2`) / V6 beta (Bloc-based, `cometchat_chat_uikit:^6.0.0-beta`) |
| **iOS** | V5 stable (Swift; SwiftUI + UIKit hosting; `CometChatUIKitSwift:~> 5.1`) |

The web family loads `@cometchat/chat-uikit-react` + `@cometchat/chat-sdk-javascript`. The RN family loads `@cometchat/chat-uikit-react-native` + `@cometchat/chat-sdk-react-native`. The Angular family loads `@cometchat/chat-uikit-angular` + `@cometchat/chat-sdk-javascript`. The Android family loads `com.cometchat:chat-uikit-android:5.x` (V5) or `com.cometchat:chatuikit-{compose,kotlin}-android:6.x` (V6) from Maven Central. The Flutter family loads `cometchat_chat_uikit:^5.2` (V5; pair with `cometchat_calls_uikit:^5.0` for calls) or `cometchat_chat_uikit:^6.0.0-beta` (V6; calls fold into the same package) from the Cloudsmith Dart pub-hosted registry. The dispatcher decides which set after Step 1's detection.

## How v3 works

v3 skills are **interactive and conversational**. You don't just detect
the framework and dump code. You have a conversation with the developer
to understand their project, their use case, and exactly where chat
should go — THEN you write code that fits.

Pattern skills (loaded from your context, not via `Skill()`):
- `cometchat-core` (web) / `cometchat-native-core` (RN) / `cometchat-angular-core` (Angular) / `cometchat-android-{v5,v6}-core` (Android) / `cometchat-flutter-{v5,v6}-core` (Flutter) — init, login, provider chain, env vars, anti-patterns
- `cometchat-components` (web) / `cometchat-native-components` (RN) / `cometchat-angular-components` (Angular) / `cometchat-android-v5-components` or `cometchat-android-v6-{compose,kotlin}-components` (Android) / `cometchat-flutter-v6-components` (V6 only — V5 splits into `-conversations`/`-messages`/`-users-groups`) — component catalog, props, composition
- `cometchat-placement` (web) / `cometchat-native-placement` (RN) / `cometchat-angular-placement` (Angular) / `cometchat-android-v5-placement` or `cometchat-android-v6-{compose,kotlin}-placement` (Android) / `cometchat-flutter-v6-placement` (V6 only) — WHERE to put chat
- One per-framework skill (`cometchat-{react,nextjs,react-router,astro}-patterns`, `cometchat-native-{expo,bare}-patterns`, `cometchat-angular-patterns`, the v5/v6 Android sub-tree, or the Flutter v5/v6 sub-tree) — framework-specific details

**Key principle: ask, don't assume.** Every piece of information you need
from the user should be asked explicitly. Don't guess the route path,
don't guess where the trigger button goes, don't guess the auth system.

## Steps

### Step 1 — Detect framework + map the project

First, check if `.cometchat/config.json` exists:
```bash
npx @cometchat/skills-cli config show --json
```

If config exists with previous answers, tell the user:
> "I see you've set up CometChat before. Using your saved config:
> Framework: {framework}, App: {appId}, Intent: {intent}.
> Want to continue with these, or start fresh?"

If no config, run detection:
```bash
npx @cometchat/skills-cli detect --json
```

The JSON output includes `framework` (one of `reactjs`, `nextjs`, `react-router`, `astro`, `expo`, `react-native`, `angular`, `android`, `flutter`, `ios`, or `null`), framework-specific fields (`router`, `expo_mode`, `react_native_version`, `android_version`, `flutter_version`, `env_prefix`), and a `compatibility.supported` flag. If `supported` is `false`, stop and surface the warnings.

**Android — `android_version` is load-bearing.** When `framework === "android"`, the detect output includes `android_version: "v5" | "v6" | null`. The cohort selects which V5 or V6 pattern set to load — V5 (live, `chat-uikit-android:5.x`, Java + Kotlin Views) and V6 (beta, `chatuikit-{compose,kotlin}-android:6.x`) are different SDKs with different APIs. Treat them as separate routing targets even though both live under `--family android`.

If `android_version` is `null`, the project is greenfield (no cometchat dep yet). Ask the user via `AskUserQuestion`:
> "Which CometChat Android UI Kit do you want to use? V5 is the live SDK (recommended for production today). V6 is beta (Compose + Kotlin Views split, future-facing)."

Save the choice into `.cometchat/config.json` under `android_version` so subsequent `/cometchat` runs don't re-ask.

**Flutter — `flutter_version` is load-bearing too.** When `framework === "flutter"`, the detect output includes `flutter_version: "v5" | "v6" | null`. V5 is GetX-based (`cometchat_chat_uikit:^5.2`); V6 is Bloc-based (`cometchat_chat_uikit:^6.0.0-beta2`). The two cohorts have different state-management primitives, different barrel exports, and different theme APIs — never mix them. Same `--family flutter` install ships both sets; routing picks the right one.

If `flutter_version` is `null`, ask via `AskUserQuestion`:
> "Which CometChat Flutter UI Kit do you want to use? V5 is the live SDK (GetX-based, recommended for production today). V6 is beta (Bloc-based, future-facing)."

Save the choice into `.cometchat/config.json` under `flutter_version`.

**Then read the project yourself — this is critical.**

**For web frameworks (`reactjs`, `nextjs`, `react-router`, `astro`):**
- `package.json` — name, dependencies, scripts
- The source directory structure — list all directories under `src/` or `app/`
- Find the router: `createBrowserRouter`, `app/` directory, `pages/`, `react-router.config.ts`, `astro.config.*`
- Find the layout: `App.tsx`, `layout.tsx`, `root.tsx`, `Layout.astro`
- Find the nav: components with "nav", "header", "sidebar" in name
- Find existing pages/routes: list them so you can reference them later

**For React Native (`expo`, `react-native`):**
- `package.json` — name, RN version, all dependencies, scripts
- Entry file — `index.js` or `App.{tsx,jsx}` or `app/_layout.tsx` (Expo Router)
- Navigation — look for `@react-navigation/native`, `@react-navigation/stack`, `@react-navigation/bottom-tabs`, or `expo-router`
- Existing screens — list all files under `screens/`, `src/screens/`, `app/`, or wherever routes live
- Existing nav structure — read the root navigator to see stack vs tab vs drawer layout

**For Angular (`angular`):**
- `package.json` — name, `@angular/core` version (12-15 supported), all `@angular/*` deps
- `angular.json` — workspace config; identify the project name + `sourceRoot`
- Root NgModule — usually `src/app/app.module.ts`; check imports + declarations + `schemas`
- Routing — `src/app/app-routing.module.ts` or root `RouterModule.forRoot([...])`; list all routes
- Layout — `src/app/app.component.{ts,html}`; identify nav, sidebar, header components
- Existing pages/components — list under `src/app/pages/`, `src/app/components/`, or wherever the project organizes them
- Environment files — `src/environments/environment.ts` (and `.prod.ts`); credentials live here, NOT in `.env`

**For Android (`android`):**
- `settings.gradle` (or `.kts`) — module list; usually `:app` plus optional library modules
- Root `build.gradle` (or `.kts`) — top-level plugins, repositories, classpath versions
- App `build.gradle` (or `.kts`) — dependencies (this is where the cometchat dep lives), Android plugin, `applicationId`, `minSdk`/`targetSdk`/`compileSdk`, `buildConfigField` entries
- `AndroidManifest.xml` — root `<application>` class, permissions, `<activity>` entries, deep links
- Source dirs: `app/src/main/java/<pkg>/` (Java) and/or `app/src/main/kotlin/<pkg>/` (Kotlin)
- For V6 stack split: presence of `androidx.compose.ui:ui` or `compose.material3` in deps signals Compose; otherwise Kotlin Views (XML layouts under `app/src/main/res/layout/`). Many V6 projects have both — ask the user which surface chat lands in.
- `gradle.properties` and `local.properties` — credentials live here as `cometchat.appId=...` / `cometchat.region=...` / `cometchat.authKey=...`, exposed to code as `BuildConfig` fields via `buildConfigField` in the app `build.gradle`. NOT in `.env`.
- `Application` class (e.g. `MyApp extends android.app.Application`) — init goes in `onCreate()`. Note the class FQN; you'll wire `CometChatUIKit.init(this, settings, callback)` here.

**For Flutter (`flutter`):**
- `pubspec.yaml` — package name + Dart SDK constraint + Flutter SDK constraint + `dependencies:` (this is where `cometchat_chat_uikit` lives)
- For V5: a typical project has BOTH `cometchat_chat_uikit:^5.2` AND `cometchat_calls_uikit:^5.0` if calls are needed. V6 folds calls into the single `cometchat_chat_uikit:^6.0.0-beta2` package (no separate calls package).
- `lib/` — Dart source. The app entry is `lib/main.dart` (the `void main() => runApp(...)` site); init goes in `main()` or in a top-level `Stateful`/`State.initState()`.
- `lib/<config>.dart` (or similar) — credentials. There is NO Flutter `.env` convention — credentials are typically defined as `const` Dart values in a config file, OR injected at compile time via `--dart-define=COMETCHAT_APP_ID=...` flags read inside Dart with `String.fromEnvironment`. NOT a `.env` file at runtime.
- `android/app/build.gradle` and `ios/Runner/Info.plist` — platform-specific config (FCM service registration, Push capabilities, microphone/camera Info.plist entries for calls). Flutter projects DO have these subdirs but they're configured Flutter-side; do not run the native skill flows.
- For V5 vs V6: V5 uses **GetX** (`get` in deps); V6 uses **flutter_bloc** + `equatable`. Their controllers, observers, and theming are different — match the integration code to the detected cohort.

**For iOS (`ios`):**
- `<App>.xcodeproj` and/or `<App>.xcworkspace` — Xcode project / workspace. The `.xcworkspace` is preferred when CocoaPods is in use (open it, NOT the .xcodeproj).
- `Podfile` (CocoaPods) — pin `pod 'CometChatUIKitSwift', '~> 5.1'` and run `pod install`. Look for `platform :ios, '13.0'` (or higher) — V5 needs iOS 13+.
- `Package.swift` (Swift Package Manager) — `dependencies:` block adds `https://github.com/cometchat/cometchat-uikit-ios`. Both SPM and CocoaPods are supported; check which the project uses.
- App entry — `<App>App.swift` (SwiftUI) or `AppDelegate.swift` + `SceneDelegate.swift` (UIKit). Init goes in `@main struct App.init()` (SwiftUI) or `application(_:didFinishLaunchingWithOptions:)` (UIKit).
- `Info.plist` — for calls add `NSMicrophoneUsageDescription` + `NSCameraUsageDescription`; for push add the APNs entitlement and a `BackgroundModes` entry with `remote-notification` (and `voip` for VoIP push).
- Credentials: NO `.env` at runtime. Use a `Secrets.swift` const enum/struct (gitignored) or an `*.xcconfig` file with `COMETCHAT_APP_ID = ...` exposed as Build Settings. The skill teaches both.
- **Mixed-stack apps (SwiftUI + UIKit):** the kit ships UIKit `UIViewController`s and exposes them via `UIViewControllerRepresentable` for SwiftUI hosting. Identify which surface chat lands in (SwiftUI screen vs UIKit nav stack) and follow the matching pattern.

Store this mental map — you'll use it throughout the conversation.

#### Then show the user what you found — Step 1.5 (the "I see you" moment)

This is the most important moment of the whole flow. After running detection + reading the project, narrate what you found in **3–5 specific, observation-grounded bullets** BEFORE asking any question. The user should feel that you understand their project before deciding whether to trust you with it.

The shape (use it verbatim — the structure earns trust):

> Taking a look at your project...
>
> - **{Framework} + {Build tool} {version}** {with TypeScript / JavaScript / etc., as detected}
> - **{Router or nav state}** — {one observation about how routing is set up, or "no router yet" for greenfield}
> - **{Auth system status}** — {"NextAuth detected → I'll wire token-based login", or "no auth detected → I'll start with dev mode + a test user; you can upgrade later"}
> - **{Existing CometChat state}** — {"existing `cometchat/` folder with X — I'll patch around it", or "fresh start — no prior CometChat code"}
> - **{One personal observation}** — {something specific you noticed: "Tailwind classes throughout", "shadcn/ui components", "monorepo with apps/* and packages/*"}
>
> Ready to set this up? I'll walk you through account setup, then ask where chat should live.

**The rules for this moment:**

1. **Be specific, not generic.** "Vite + React 19 + TypeScript" beats "a React project." Read the actual versions from `package.json`.
2. **Five bullets max.** Beyond five, it stops feeling observational and starts feeling like a recital. Cut to what's *interesting* about the project.
3. **Lead with what's load-bearing.** Framework + version, router, auth, existing CometChat, then one personal touch. The personal touch is what makes it land — show you actually looked.
4. **Skip the bullet if there's nothing to say.** No router on greenfield → say "no router yet"; don't invent one. No auth → say "no auth detected"; don't list every package you didn't find.
5. **End with a single confident question.** Not five questions. The flow continues into Step 2 (credentials) or Step 3 (placement) — let the next step ask.

**Examples of good vs bad bullets:**

| ✓ Good (specific, observational) | ✗ Bad (generic, unfounded) |
|---|---|
| "Vite + React 19 + TypeScript, Tailwind for styling" | "A React project with TypeScript" |
| "React Router v7 detected (`routes.ts` + `react-router.config.ts`)" | "Some routing is configured" |
| "NextAuth in `auth.config.ts` — I'll mint CometChat tokens server-side via your existing session cookie" | "Authentication is set up" |
| "shadcn/ui detected (`components/ui/*`) — I'll use your existing Button + Dialog primitives in the chat trigger" | "Some UI components are present" |
| "Monorepo: `apps/web` is your dashboard, `apps/marketing` is the public site — I'll integrate into apps/web" | "This is a monorepo" |

**For greenfield projects (the test case):**

> Taking a look at your project...
>
> - **Vite + React 19 + TypeScript** — fresh `cometchat-test-app` scaffold
> - **No router yet** — for the demo, chat will mount in `src/App.tsx` directly; we can move it to a route later
> - **No auth system detected** — I'll set you up in dev mode with a pre-seeded test user (`cometchat-uid-1`); production auth is a one-flag upgrade later
> - **Fresh start** — no existing CometChat code to patch around
>
> Ready to set this up? I'll get you a CometChat account first, then ask where chat should live.

This moment costs ~5 seconds of conversation but anchors the rest. Skip it and the user feels like they're talking to a script. Run it well and the rest of the flow feels effortless.

---

**Compatibility baselines (the CLI enforces these):**
- Web: react@<18 → upgrade required; nextjs@<13 → warning; astro@<4 → warning
- RN: react-native@<0.70 → upgrade required; expo@<49 → upgrade required
- Angular: @angular/core@<12 → upgrade required; @angular/core@>=16 → warning (skill is verified against v15)
- Android V5: minSdk@<21 → upgrade required; minSdk@<24 → warning; AGP@<7.0 → warning
- Android V6: minSdk@<28 → upgrade required (V6 raised the floor from API 23 to API 28); Kotlin@<1.9 → warning; for Compose stack, Compose BOM@<2024.x → warning
- Flutter V5: Dart SDK <2.17 → upgrade required; Flutter <2.5 → warning; Android `minSdk 24` (Flutter platform default) when V5 is in use
- Flutter V6: Dart SDK <2.17 → upgrade required; Flutter <2.5 → warning; Android `minSdk 26` REQUIRED (cometchat_calls_sdk in V6 raised the floor)
- iOS V5: iOS deployment target <13 → upgrade required; Swift <5.0 → upgrade required; Xcode 15+ requires `ENABLE_USER_SCRIPT_SANDBOXING = NO` in Build Settings (or the `post_install` Podfile hook)

#### Pattern skills not installed?

The dispatcher routes to web pattern skills (`cometchat-{core,components,placement,*-patterns}`), RN pattern skills (`cometchat-native-{core,components,placement,*-patterns}`), or Angular pattern skills (`cometchat-angular-{core,components,placement,patterns}`) based on the detected framework. If the matching set isn't loaded — i.e. the user has only the dispatcher in `.claude/skills/`, OR they installed only `@cometchat/skills` (web) but the project is RN/Angular, OR vice versa — **install the missing package yourself**. Do NOT stop and ask the user to run the npx command manually — that turns a 0-step recovery into a 2-step recovery for no benefit.

To check whether the pattern skills are loaded, attempt to read `cometchat-core/SKILL.md` (web), `cometchat-native-core/SKILL.md` (RN), or `cometchat-angular-core/SKILL.md` (Angular) from your loaded skills context. If the read fails, the package isn't installed — run the installer.

**If `framework` is `expo` or `react-native` AND `cometchat-native-core` is NOT loaded:**

```bash
npx @cometchat/skills-native add
```

**If `framework` is `reactjs`, `nextjs`, `react-router`, or `astro` AND `cometchat-core` is NOT loaded:**

```bash
npx @cometchat/skills add
```

**If `framework` is `angular` AND `cometchat-angular-core` is NOT loaded:**

```bash
npx @cometchat/skills add --family angular
```

**If `framework` is `android` AND neither `cometchat-android-v5-core` nor `cometchat-android-v6-core` is loaded:**

```bash
npx @cometchat/skills add --family android
```

This installs both V5 and V6 skill sets — the dispatcher's Step 4 routing picks the correct one based on `android_version`.

**If `framework` is `flutter` AND neither `cometchat-flutter-v5-core` nor `cometchat-flutter-v6-core` is loaded:**

```bash
npx @cometchat/skills add --family flutter
```

Same shape as Android — installs both V5 and V6 skill sets; routing picks the right one based on `flutter_version`.

**If `framework` is `ios` AND `cometchat-ios-core` is NOT loaded:**

```bash
npx @cometchat/skills add --family ios
```

iOS only ships V5 today (no V6 beta yet), so there's no version-detection step — the install command lands the single iOS skill set.

After the install completes, tell the user:

> "I just installed the {family} pattern skills into your workspace. Please re-run `/cometchat` to continue — your config is saved in `.cometchat/config.json` and credentials in `.env`, so the next run picks up at code generation without re-asking the questions you've already answered."

**Why re-run rather than continue in this session:** Claude Code (and most coding agents) snapshot the skill set at session start and do NOT hot-reload SKILL.md mid-session. Even though the install writes the new skill files into `.claude/skills/`, your in-context skill set is the snapshot. Continuing would mean writing code from training memory — which the skills explicitly forbid (this is the same failure mode that produced the `UIKitSettingsBuilder` and `getLoggedinUser` casing bugs at v2.2.0). The re-run is the only safe path.

**Non-default IDE — pass `--ide`.** The default installer target is `claude` (`.claude/skills/`). If the dispatcher's own SKILL.md was loaded from a different location, pass the matching flag:

| Dispatcher loaded from | Install command |
|---|---|
| `.claude/skills/cometchat/SKILL.md` (default) | `npx @cometchat/skills add` |
| `.agents/skills/cometchat/SKILL.md` (Replit / Cursor / Copilot / Cline / Codex) | `npx @cometchat/skills add --ide replit` |
| `.cursor/skills/cometchat/SKILL.md` (legacy Cursor path) | `npx @cometchat/skills add --ide cursor` |
| `.kiro/skills/cometchat/SKILL.md` | `npx @cometchat/skills add --ide kiro` |

You can usually infer the IDE from where the dispatcher itself was loaded. If uncertain, default to `claude`. (Same logic applies to `@cometchat/skills-native` for RN projects.)

Do NOT attempt to write web UI Kit code into an RN project (CSS imports + `<a href>` + `document.*` fail at runtime) or RN UI Kit code into a web project (`react-native-gesture-handler`, `@gorhom/bottom-sheet`, native bubble components have no browser equivalents). Likewise, never use the React UI Kit (`@cometchat/chat-uikit-react`) in an Angular project — it's a different package (`@cometchat/chat-uikit-angular`) with NgModule imports, kebab-case selectors, content-projection slots, and no React reconciler. And never mix V5 and V6 skill sets within Android or Flutter — the artifact coordinates, package names, state-management primitives (V5 GetX vs V6 Bloc on Flutter; V5 Java/Views vs V6 Compose+Kotlin on Android), and theme system differ; the skills target one cohort each.

### Step 2 — Set up credentials (onboarding)

**CRITICAL: All onboarding happens via CLI commands. NEVER send the user
to a browser or dashboard for credential copy-pasting. The CLI handles
signup, login, app creation, and credential writing — all from the
terminal — for every framework.**

If config has `appId` set, verify credentials are in `.env` and skip to Step 3.

Otherwise check:
```bash
npx @cometchat/skills-cli auth status --json
```

If `status` is `"logged-in"`, skip to **Step 2b.5** (fetch dashboard profile).

If `status` is `"logged-out"`, ask:

Use `AskUserQuestion`:
- **question:** "Let's set up CometChat. Do you have an account?"
- **header:** "Account"
- **multiSelect:** false
- **options:**
  1. label: "Create a new account", description: "Free signup — I'll handle it right here, no browser needed."
  2. label: "Sign in to existing account", description: "Log in and pick one of your apps."
  3. label: "I'll paste credentials myself", description: "I already have my App ID, Region, and Auth Key."

Option 1 → **Step 2b**. Option 2 → **Step 2a**. Option 3 → **Step 2d**.

#### Step 2a — Sign in (existing account, browser flow)

```bash
npx @cometchat/skills-cli auth login
```

This command:
1. Generates a short-lived session via the CLI auth API.
2. Opens `https://app.cometchat.com/login?sessionId=<hex>` in the user's default browser.
3. Polls the auth API every 5 seconds for up to 15 minutes.
4. When the user finishes signing in, the dashboard marks the session authenticated. The next poll receives the bearer token and stores it in the OS keychain.
5. Prints `✓ Logged in as <email> (backend: keychain-macos).`

Let the CLI block — do NOT background it, do NOT race it with other prompts.

Terminal error handling (surface verbatim, stop, do not retry silently):
- `ACCESS_DENIED` — user clicked Deny in the dashboard.
- `EXPIRED` — 15-minute window elapsed.
- `TIMEOUT` — max polls exhausted before user authorized.
- `ABORTED` — user Ctrl-C'd the CLI.
- `NETWORK` — couldn't reach the auth host.
- `ALREADY_AUTHENTICATED` — this session was already consumed. Re-run `auth login` to mint a fresh session.

After success, verify via `auth status --json` and proceed to **Step 2b.5**.

#### Step 2b — Sign up (new account, browser flow)

```bash
npx @cometchat/skills-cli auth signup
```

Same polling flow as Step 2a, but the CLI opens the signup URL. The browser handles email, name, password, verification email, role, industry. The CLI never sees any of those values.

No role / name / verification-code questions in the chat. The dashboard owns that flow now; skipping it keeps the user's password and verification code out of the transcript.

Error codes match Step 2a. After success, verify via `auth status --json` and proceed to **Step 2b.5**.

#### Step 2b.5 — Fetch the user's dashboard profile

The dashboard's signup flow (`/auth/signup` → `/choose-role` → `/choose-intent`) collects the user's name, email, role, and product intent during browser onboarding — none of those values touch the CLI. Now that the bearer token is in the keychain, fetch them via `cometchat auth me` so the rest of this skill can:

- Greet the user by name in subsequent steps
- Skip the placement-intent question (Step 3a) when `meta.intent === "exploring"` (the user already told the dashboard they're just exploring)
- Tailor explanation depth by `meta.role` (frontend developer → UI examples; engineering manager → architecture trade-offs)

```bash
npx @cometchat/skills-cli auth me --json
```

Response shape:
```json
{
  "status": "logged-in",
  "email": "you@example.com",
  "name": "Your Name",
  "role": "frontend",
  "other_role": null,
  "intent": "building",
  "last_app": {
    "id": "27xxxxx",
    "name": "my-marketplace-chat",
    "region": "us",
    "industry": "online_marketplaces",
    "technology": "react",
    "product": "support"
  }
}
```

Field meanings (from the dashboard's signup screens — see `/Users/swapnil/Downloads/customer-dashboard-main/src/components/auth/Welcome/`):

- `role`: `"frontend"` / `"backend"` / `"fullstack_engineer"` / `"startup_founder"` / `"product_leader/manager"` / `"engineering_leader/manager"` / `"others"` (when `others`, `other_role` carries the freeform value)
- `intent`: `"building"` / `"evaluating"` / `"exploring"` (this is the **dashboard's** intent — distinct from Step 3a's `placement_intent` which asks about app archetype)
- `last_app`: most-recently-created app on the user's account (or `null` if they have none). The dashboard's `/create-app` and `/select-product` screens write `industry`, `technology`, `product` into the app's `metadata` — we surface them here so Step 2c can pre-fill region/industry instead of asking again.

**Store the response in working memory.** Reference these fields downstream:

- **Step 2c (new app):** if `last_app` is non-null, default `--region` and `--industry` to the values from `last_app` and only ask the user to confirm — do NOT re-prompt from scratch.
- **Step 3a:** if `meta.intent === "exploring"`, skip the placement-intent question and route straight to the "Just exploring" branch (one route/screen with `<CometChatConversations />` and `cometchat-uid-1` pre-logged-in).
- **Step 5 explanations:** if `meta.role === "frontend"`, lead with concrete component composition + CSS examples; if `meta.role === "engineering_leader/manager"`, lead with placement architecture trade-offs (where state lives, what gets cached, how routing fits the project's pattern).
- **Greeting:** if `meta.name` is non-null, greet by name in any user-facing message during the rest of the flow ("Got it, Swapnil — let's pick an app").

**Failure modes — each is non-blocking; degrade to the original generic flow:**

- `status: "logged-out"` → bearer expired between Step 2a/b and now (rare). Re-run `auth login` and retry.
- `status: "auth-required"` → 401 from server. Same fix.
- `status: "error"` → network or unexpected. Skip silently, proceed to Step 2b.6 (will ask role + intent there).
- `name` is `null` → no greeting (don't ask, the dashboard will collect it on next browser visit).
- `role` is `null` → **ask in Step 2b.6** (this is the case for accounts that signed up via `auth signup` from the CLI — they never saw the dashboard's `/choose-role` screen).
- `intent` is `null` → **ask in Step 2b.6**.
- `last_app` is `null` → ask region/industry normally in Step 2c.

After this step, proceed to **Step 2b.6**.

#### Step 2b.6 — Backfill role + intent if missing

The dashboard's `/choose-role` and `/choose-intent` screens collect two profile fields used to tailor the rest of the integration:

- `role` shapes the depth and angle of code explanations in Step 5
- `intent` decides whether Step 3a's placement question is needed (`exploring` short-circuits to a single screen)

If `auth me` returned non-null values for both, **skip this step entirely** and go to Step 2c — the dashboard already collected them, do not re-ask.

If either is `null` (typical for accounts created via `cometchat auth signup` rather than the dashboard browser flow), ask the user. The options below mirror the dashboard exactly so that anyone who later visits the dashboard sees consistent terminology.

**If `role === null`** — `AskUserQuestion`:
- **question:** "What's your role? (We'll tailor explanations to match.)"
- **header:** "Role"
- **multiSelect:** false
- **options** (label → store as `role` value):

  | Label | `role` value |
  |---|---|
  | Frontend Developer | `frontend` |
  | Backend Developer | `backend` |
  | Fullstack Developer | `fullstack_engineer` |
  | Founder | `startup_founder` |
  | Product Manager | `product_leader/manager` |
  | Engineering Manager | `engineering_leader/manager` |
  | Other | `others` |

  If the user picks **Other**, follow up with a free-form `AskUserQuestion` for `other_role` (single short text field; store the freeform value in `other_role`).

**If `intent === null`** — `AskUserQuestion`:
- **question:** "What brings you to CometChat?"
- **header:** "Intent"
- **multiSelect:** false
- **options** (use the dashboard's exact wording):

  | Label | Description shown under the label | `intent` value |
  |---|---|---|
  | I'm building | Integrating chat into my app now. | `building` |
  | I'm evaluating | Comparing options for my team. | `evaluating` |
  | I'm exploring | Just looking around for now. | `exploring` |

**Store the answers in working memory under the same keys** (`role`, `other_role`, `intent`) as if they had come from `auth me`. Downstream steps (3a + 5) treat dashboard-supplied and CLI-collected values identically.

> **Note:** These answers are not yet persisted back to the dashboard `/me` endpoint — they only live for the current session. A follow-up will add a `cometchat auth me --update` mode that PATCHes them server-side so the next session won't re-ask. Until then, the user may be asked again in a fresh session.

After this step, proceed to **Step 2c**.

#### Step 2c — Pick or create an app

**Run this immediately — do NOT ask the user to go to any dashboard:**
```bash
npx @cometchat/skills-cli provision list --json
```

**If the user has existing apps**, show them and ask which to use:
> "I found these CometChat apps on your account:
> 1. my-marketplace-chat (us) — Developer plan
> 2. test-app (eu) — Developer plan
>
> Which one should I use, or should I create a new one?"

**For an existing app**, fetch credentials and wire everything in one call. Pass `--framework` from Step 1 detection (one of `reactjs`, `nextjs`, `react-router`, `astro`, `expo`, `react-native`):
```bash
npx @cometchat/skills-cli provision setup \
  --app-id "<selected-appId>" --framework "<framework>" --json
```

This creates/updates the env file with the correct prefix AND writes `.cometchat/config.json` in one step. Output is compact: `{ appId, region, framework, envFile, configPath }` — no authKey echoed back.

**If no apps exist** (or user wants new), collect:
1. App name — suggest `<project-name>-chat` from package.json `name`
2. Region — **if Step 2b.5 returned `last_app.region`**, default to that value and ask only `"Use the same region as your <last_app.name> app (<region>)? [Y/n]"`. Otherwise `AskUserQuestion`:
   - **question:** "Which region for your CometChat app?"
   - **header:** "Region"
   - **options:** US (recommended), EU, India

   **Region key mapping** (CLI expects lowercase):
   | Label | `--region` value |
   |---|---|
   | US | `us` |
   | EU | `eu` |
   | India | `in` |
3. Industry — **if Step 2b.5 returned `last_app.industry`**, default to that value and ask only `"Same industry as your previous app (<industry>)? [Y/n]"`. Otherwise `AskUserQuestion`:
   - **options:** SaaS / Business, Marketplace, Social / Community, Other (or finer-grained from the table below)

**Industry key mapping:**

| Label | `--industry` value |
|---|---|
| SaaS / Business | `saas_businesses` |
| Marketplace | `online_marketplaces` |
| Social / Community | `community_and_social` |
| Healthcare | `healthcare` |
| Dating | `dating` |
| Education | `online_education` |
| Events / Streaming | `events_and_streaming` |
| Sports / Gaming | `sports_and_gaming` |
| Team Communication | `team_comms_and_workflows` |
| On-demand Services | `on_demand_services` |
| Other | `other` |

**Confirm before creating, then:**
```bash
npx @cometchat/skills-cli provision setup \
  --name "<name>" --region "<region>" --industry "<industry_key>" \
  --framework "<framework>" --json
```

The authKey is written to the env file but is NOT echoed to stdout, so credentials don't appear multiple times in the transcript.

Tell the user: "Your CometChat account and app are ready. Credentials saved to `<envFile>`. Let's set up the integration."

#### Step 2d — Paste keys manually

Tell the user which env vars to set based on the detected framework:

| Framework | Env file | Variables |
|---|---|---|
| reactjs (Vite) | `.env` | `VITE_COMETCHAT_APP_ID`, `VITE_COMETCHAT_REGION`, `VITE_COMETCHAT_AUTH_KEY` |
| nextjs | `.env.local` | `NEXT_PUBLIC_COMETCHAT_APP_ID`, `NEXT_PUBLIC_COMETCHAT_REGION`, `NEXT_PUBLIC_COMETCHAT_AUTH_KEY` |
| react-router | `.env` | `VITE_COMETCHAT_APP_ID`, `VITE_COMETCHAT_REGION`, `VITE_COMETCHAT_AUTH_KEY` |
| astro | `.env` | `PUBLIC_COMETCHAT_APP_ID`, `PUBLIC_COMETCHAT_REGION`, `PUBLIC_COMETCHAT_AUTH_KEY` |
| expo (managed + Expo Router) | `.env` | `EXPO_PUBLIC_COMETCHAT_APP_ID`, `EXPO_PUBLIC_COMETCHAT_REGION`, `EXPO_PUBLIC_COMETCHAT_AUTH_KEY` |
| react-native (bare CLI) | `.env` | `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY` (paired with `react-native-dotenv`) |
| angular | `src/environments/environment.ts` | `cometchat: { appId, region, authKey }` (TypeScript object — Angular does NOT use `.env`) |
| android | `local.properties` (gitignored) → `BuildConfig` | `cometchat.appId`, `cometchat.region`, `cometchat.authKey` in `local.properties`; expose to code via `buildConfigField "String", "COMETCHAT_APP_ID", "\"...\""` in `app/build.gradle`. Code reads `BuildConfig.COMETCHAT_APP_ID`. |
| flutter | `lib/cometchat_config.dart` (or `--dart-define` flags) | A `const` Dart class with `appId`, `region`, `authKey`. Add `lib/cometchat_config.dart` to `.gitignore` so the file isn't committed. For CI, use `--dart-define=COMETCHAT_APP_ID=...` and read via `String.fromEnvironment('COMETCHAT_APP_ID')` instead. Flutter does NOT load `.env` at runtime. |
| ios | `Secrets.swift` (gitignored) or `*.xcconfig` Build Settings | A const enum/struct in `Secrets.swift`: `enum Secrets { static let appId = "..."; static let region = "..."; static let authKey = "..." }`. Add `Secrets.swift` to `.gitignore`. For CI, define them in an `.xcconfig` file (`COMETCHAT_APP_ID = ...`) and read via `Bundle.main.object(forInfoDictionaryKey: "COMETCHAT_APP_ID")` after exposing them in `Info.plist`. iOS does NOT load `.env` at runtime. |

> "Grab your credentials from https://app.cometchat.com → Your App →
> API & Auth Keys. Create the env file above and tell me when done."

**Bare RN extra step.** Bare RN doesn't ship a public-env-prefix convention — pair the env file with `react-native-dotenv`:
```bash
npm install --save-dev react-native-dotenv
```
and add the plugin to `babel.config.js`:
```js
module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [["module:react-native-dotenv"]],
};
```
Then `import { COMETCHAT_APP_ID, COMETCHAT_REGION, COMETCHAT_AUTH_KEY } from "@env";` in the provider.

**iOS — write to `Secrets.swift` or an `.xcconfig`, NOT `.env`.** iOS has no runtime `.env` lookup. The CLI's `provision setup --framework ios` writes a `.env` only as a credentials handoff. During Step 5, migrate values into one of:

1. **`Secrets.swift` const enum** (preferred for local dev):
   ```swift
   // Secrets.swift  (add to .gitignore)
   enum Secrets {
     static let cometchatAppID  = "<APP_ID>"
     static let cometchatRegion = "<REGION>"
     static let cometchatAuthKey = "<AUTH_KEY>"   // dev only
   }
   ```
   Use as: `UIKitSettings().set(appID: Secrets.cometchatAppID).set(region: Secrets.cometchatRegion).set(authKey: Secrets.cometchatAuthKey).build()`.
2. **`.xcconfig` Build Settings** (preferred for CI; secrets stay out of source files):
   ```
   // Secrets.xcconfig  (add to .gitignore; reference from project Build Settings)
   COMETCHAT_APP_ID = <APP_ID>
   COMETCHAT_REGION = <REGION>
   COMETCHAT_AUTH_KEY = <AUTH_KEY>
   ```
   Expose as Info.plist entries (`$(COMETCHAT_APP_ID)` etc.) and read via `Bundle.main.object(forInfoDictionaryKey: "COMETCHAT_APP_ID") as? String`.

Never read `.env` at runtime in iOS. The handoff `.env` exists only so the integration agent can find the values during initial setup.

**Flutter — write to a Dart const file, NOT `.env`.** Flutter has no runtime `.env` lookup. The CLI's `provision setup --framework flutter` writes a `.env` only as a credentials handoff. During Step 5, migrate values into one of:

1. **Dart const file** (preferred for local dev, simpler):
   ```dart
   // lib/cometchat_config.dart  (add to .gitignore)
   class CometChatConfig {
     static const String appId = '<APP_ID>';
     static const String region = '<REGION>';
     static const String authKey = '<AUTH_KEY>';   // dev only
   }
   ```
   Then in `main.dart`:
   ```dart
   import 'cometchat_config.dart';
   final settings = (UIKitSettingsBuilder()
         ..appId = CometChatConfig.appId
         ..region = CometChatConfig.region
         ..authKey = CometChatConfig.authKey
         ..subscriptionType = CometChatSubscriptionType.allUsers)
       .build();
   ```
2. **`--dart-define` flags** (preferred for CI; secrets never hit the repo):
   ```dart
   const appId = String.fromEnvironment('COMETCHAT_APP_ID');
   const region = String.fromEnvironment('COMETCHAT_REGION');
   const authKey = String.fromEnvironment('COMETCHAT_AUTH_KEY');
   ```
   Run with `flutter run --dart-define=COMETCHAT_APP_ID=... --dart-define=COMETCHAT_REGION=... --dart-define=COMETCHAT_AUTH_KEY=...`.

Never read `.env` at runtime in Flutter. The handoff `.env` exists only so the integration agent can find the values during initial setup.

**Android — write to `local.properties` + expose via `BuildConfig`.** Android has no runtime `.env` lookup; credentials are injected at compile time as `BuildConfig` fields. The CLI's `provision setup --framework android` writes a `.env` as a credentials handoff — you (the agent) must during Step 5 mirror those values into:

1. `local.properties` (project root, gitignored):
   ```
   cometchat.appId=<APP_ID>
   cometchat.region=<REGION>
   cometchat.authKey=<AUTH_KEY>   # dev only — omit / use auth tokens in production
   ```
2. `app/build.gradle` (or `.kts`) — read those properties and surface them via `buildConfigField`:
   ```groovy
   def localProps = new Properties()
   def localPropsFile = rootProject.file('local.properties')
   if (localPropsFile.exists()) localProps.load(new FileInputStream(localPropsFile))

   android {
     defaultConfig {
       buildConfigField "String", "COMETCHAT_APP_ID",   "\"${localProps['cometchat.appId'] ?: ''}\""
       buildConfigField "String", "COMETCHAT_REGION",   "\"${localProps['cometchat.region'] ?: ''}\""
       buildConfigField "String", "COMETCHAT_AUTH_KEY", "\"${localProps['cometchat.authKey'] ?: ''}\""
     }
     buildFeatures { buildConfig true }
   }
   ```
3. Application code reads `BuildConfig.COMETCHAT_APP_ID` etc. — never hardcoded strings, never read from `.env` at runtime.

**Angular — write to `src/environments/environment.ts`, NOT `.env`.** Angular bundles `environment.ts` into the build at compile time; there is no runtime `.env` lookup. Insert (or extend) the `cometchat` block:
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  cometchat: {
    appId: "<APP_ID>",
    region: "<REGION>",
    authKey: "<AUTH_KEY>",   // dev only — omit from environment.prod.ts
  },
};
```
Then `import { environment } from "../environments/environment";` and access `environment.cometchat.appId` in the init service. The CLI's `provision setup --framework angular` writes a `.env` as a credentials handoff — you (the agent) must migrate the values into `environment.ts` during Step 5. Never read `.env` from Angular runtime code.

After they confirm, verify:
```bash
npx @cometchat/skills-cli config init --json
```

#### Never log the Auth Key

After writing credentials, don't echo the Auth Key back in the transcript. Confirm as `✓ Wrote <PREFIX>COMETCHAT_AUTH_KEY (hidden)`.

### Step 3 — Interactive requirements gathering

This is the core of v3. A multi-step conversation that gathers everything you need before writing a single line of code.

#### 3a. "What are you building?"

If config has `intent` set, confirm it and move on.

**If `meta.intent === "exploring"` from Step 2b.5** (the user already told the dashboard during signup that they're just exploring), skip the rest of Step 3 entirely and route to the "Just exploring" branch — scaffold the minimal integration in Step 5 (one route/screen showing `<CometChatConversations />` with `cometchat-uid-1` pre-logged-in). Do not ask the placement-intent question; the user has already said "show me the simplest thing."

Otherwise, use `AskUserQuestion`:
- **question:** "What kind of app are you building?"
- **header:** "Your app"
- **multiSelect:** false
- **options:**
  1. label: "Messaging app", description: "Chat is the main feature — like Slack, Discord, WhatsApp, or Telegram."
  2. label: "Marketplace or platform", description: "Buyers and sellers communicate — like Airbnb, eBay, OfferUp, or Depop."
  3. label: "SaaS or productivity", description: "Team chat or support chat inside a product — like Notion, Intercom, or Linear."
  4. label: "Social or community", description: "User profiles with messaging — like a dating app or community forum."
  5. label: "Support or helpdesk", description: "Customer-to-agent communication."
  6. label: "Just exploring", description: "Quick demo — fastest path to see chat working."

**If "Just exploring":** skip the rest of Step 3 and scaffold the minimal integration in Step 5 — one route/screen showing `<CometChatConversations />` with `cometchat-uid-1` pre-logged-in.

#### 3b. Show what you recommend and why

This is the second wow moment after the detection summary. Don't just list a placement — **tell the user why**. Two sentences of reasoning earn confidence; a table alone reads like a lookup.

The recommendation has two layers:

1. **The placement** — what you'll set up (route / drawer / modal / tab / widget)
2. **The reason** — why this fits the user's archetype (one or two sentences grounded in how their kind of app actually works)

When you write your response, lead with the reason, then the concrete placement, then offer to override:

> **For a marketplace app, I'd put a "Chat with seller" drawer on your product page + an inbox at `/messages`.**
>
> The drawer keeps buyers in the buying flow — they can ask a question without losing the listing. The inbox is for going back to past conversations. Two surfaces, one integration.
>
> Sound right, or want to try a different shape?

That's the shape. The recommendation tables below are the *what*; the reasoning column is the *why* you should narrate.

**Web family (reactjs, nextjs, react-router, astro):**

| Intent | Placement | Why |
|---|---|---|
| **Messaging app** | Dedicated messages page (route you pick), two-pane: conversation list + active chat | Chat IS the product. Users land directly on it; the route is the home of your app. |
| **Marketplace** | "Chat with seller" drawer on the product page + inbox at `/messages` | Drawer keeps buyers in the buying flow; the inbox handles "go back to a past conversation." |
| **SaaS / dashboard** | Modal triggered from your navbar + full messages page | Modal feels lightweight (chat without leaving your work); the page is for serious conversations. |
| **Social / community** | Full messenger page with tabs: Chats, Calls, Users, Groups | Discovery matters as much as messaging — users want to find people, not just their existing threads. |
| **Support** | Floating widget bubble in the bottom-right | One-way customer-to-team — minimal cognitive load on the customer; your team triages from the dashboard. |

**React Native family (expo, react-native):**

| Intent | Placement | Why |
|---|---|---|
| **Messaging app** | Dedicated "Messages" bottom tab → conversations → thread | Mobile users expect chat as a first-class destination; a tab puts it one tap away. |
| **Marketplace** | "Chat with seller" button on the product screen → modal thread + Inbox stack screen | Modal preserves the buying context; the Inbox is the "back to a conversation" entry point. |
| **SaaS / productivity** | "Chat" stack screen accessible from nav, optionally bottom sheet for quick replies | Stack screen for focused conversations; bottom sheet for fast back-and-forth without leaving your current work. |
| **Social / community** | "Messages" bottom tab + "Message" button on profile screens → modal thread | Tab handles discovery; per-profile button is the "I want to talk to THIS person" path. |
| **Support** | Modal triggered from a "Help" or "Support" button in header/settings | Lightweight, doesn't compete with your product's primary tabs. |

When explaining, reference the ASCII diagrams from `cometchat-placement` (web) or `cometchat-native-placement` (RN) so the user can visualize the shape.

**One sentence to hand them control:** end the recommendation with "Sound right, or want to try a different shape?" — never "Which would you like?" The first phrasing implies you've thought it through and they can override; the second implies you're just collecting answers.

Ask: "Does this sound right, or do you want a different approach?" Let them override.

#### 3c. Ask where things should go

**Show the user their actual project structure** — list the pages/routes/screens you found in Step 1. Then ask placement-specific questions appropriate to the family.

**Web — Route placement (messaging, social):**
> "I found these pages in your project:
>   - /  (home)
>   - /about
>   - /products
>   - /profile
>
> Where should the messages page live?"

Default: `/messages`. Let user type a custom path.

**Web — Drawer placement (marketplace):**
> "Which page should have the 'Chat' button that opens the drawer?
> I found these pages: ..."

Read the picked page. Look for existing buttons, actions, or interactive elements. Ask whether to wire to the existing button or add a new one.

**Web — Modal placement (SaaS):**
> "Where should the 'Open chat' button go? I found these components
> that look like navigation: ..."

**Web — Widget placement (support):**
> "Should the widget appear on all pages, or only specific ones?"

**RN — Bottom tab placement (messaging, social):**
> "I found these bottom tabs in your navigator at App.tsx:
>   - Home
>   - Profile
>   - Settings
>
> Where should the 'Messages' tab go? (At the end, or pick a position.)"

**RN — Stack screen placement (saas, marketplace inbox):**
> "I found these stack screens in your root navigator: ...
>
> What should I call the chat screen? Default: MessagesScreen."

**RN — Modal placement (marketplace, support):**
> "Which screen should have the 'Chat' button that opens the modal?
> I found these screens: ..."

Read the picked screen. Look for existing buttons. Ask whether to wire to it or add a new one.

**RN — BottomSheet placement (quick reply, support):**
> "Bottom sheets slide up from below. Should the sheet be:
>   1. Draggable (user can dismiss by swiping down) — uses @gorhom/bottom-sheet
>   2. Fixed overlay — uses CometChat's built-in CometChatBottomSheet
>
> Which one?"

**Combinations** (marketplace = drawer/modal + inbox): ask both questions in sequence — they're separate components wired into separate places.

**Expo Router projects** — adapt screen names to file paths:
- Stack screen → `app/messages.tsx` (or the path the user picks)
- Bottom tab → file under `app/(tabs)/messages.tsx` + update `app/(tabs)/_layout.tsx`
- Modal → `app/(modals)/chat.tsx` with `presentation: "modal"` in the parent `_layout.tsx`

#### 3d. Detect and ask about authentication

Read the project's `package.json` and source files. Look for auth.

**Web auth libraries:**
- `next-auth` / `@auth/core` → NextAuth
- `@clerk/nextjs` / `@clerk/clerk-react` → Clerk
- `@supabase/supabase-js` + auth usage → Supabase Auth
- `firebase` / `firebase/auth` → Firebase Auth
- `passport` → Passport.js
- `jsonwebtoken` / `jose` → Custom JWT

**RN auth libraries:**
- `firebase` / `@react-native-firebase/auth` → Firebase Auth
- `@clerk/clerk-expo` / `@clerk/clerk-react-native` → Clerk
- `@supabase/supabase-js` + auth usage → Supabase Auth
- `react-native-auth0` → Auth0
- `aws-amplify` + auth module → AWS Cognito
- `@react-native-google-signin/google-signin` → Google Sign-In (usually paired with something above)
- `expo-auth-session` / `expo-secure-store` → Expo Auth Session (custom)

**None detected** → no auth.

Report what you found and ask:

If auth detected:
> "I see you're using [NextAuth / Firebase Auth / etc.]. Here's how
> CometChat will work with it:
>
> - **Development (now):** I'll use CometChat's Auth Key for quick
>   testing with pre-seeded users (cometchat-uid-1 through uid-5).
> - **Production (later):** Your server will mint per-user auth tokens
>   via the CometChat REST API. I can set this up now or later
>   (see `cometchat-production` / `cometchat-native-production`).
>
> Start with dev mode for now? You can upgrade to production auth
> anytime by choosing 'Set up production auth' from the menu."

If no auth detected:
> "I don't see an authentication system in your project yet. For now,
> I'll set up CometChat with a hardcoded test user (cometchat-uid-1).
>
> When you add auth later, run `/cometchat` again and choose
> 'Set up production auth' to connect them."

#### 3e. Ask about user mapping (if auth detected)

If the user has auth AND wants to set up production mode now:

> "How should your app's users map to CometChat users?
>
> 1. Use your existing user ID as the CometChat UID (simplest)
> 2. Generate a separate CometChat UID and store it alongside your user record
> 3. Let me just set up dev mode for now"

If they share an example, validate it's CometChat-compatible (alphanumeric, underscores, hyphens — no spaces or special chars; max 100 chars). Firebase UIDs, Clerk user IDs, Supabase UUIDs, and Auth0 `sub` claims are all CometChat-compatible by default.

#### 3f. Confirm the plan — the third wow moment

**This is the trust contract. Show EXACTLY what you'll do BEFORE doing it.** Three sections, in this order:

1. **Files I'll create** — new files, with a one-line purpose for each
2. **Files I'll modify** — existing files, with the specific edit (not "wrap with provider" alone — say "wrap the children of `<Layout>` with `<CometChatProvider>` at line ~14")
3. **Files I won't touch** — call out the load-bearing files that stay untouched (auth config, route definitions outside the chat surface, your existing components). This is the reassurance.

Then dependencies + auth mode + an approval line that hands the user control.

The shape (use it verbatim — three sections + reassurance):

> Here's the plan:
>
> **Files I'll create**
> - `cometchat/CometChatProvider.tsx` — wraps the kit's auth + theme providers, gates render on login
> - `cometchat/init.ts` — module-level CometChat.init + login, called from the provider
> - `app/messages/page.tsx` — full-page messages route (your inbox)
> - `app/components/ChatDrawer.tsx` — the "chat with seller" drawer for product pages
> - `.env.local` — your CometChat App ID + Region + Auth Key (gitignored)
>
> **Files I'll modify**
> - `app/layout.tsx` — wrap `{children}` with `<CometChatProvider>` (one line, around line 14)
> - `app/products/[id]/page.tsx` — add the `<ChatDrawer />` trigger button next to the seller info (your existing layout stays)
> - `app/components/Navbar.tsx` — add a `<Link href="/messages">Messages</Link>` next to your existing nav items
>
> **Files I won't touch**
> - `auth.config.ts` — your NextAuth setup stays as-is; we'll wire CometChat to it in production-auth mode later
> - `tailwind.config.ts`, `globals.css` — no styling changes outside `cometchat/`
> - Anything under `app/products/`, `app/cart/`, etc. — your existing routes are untouched
>
> **Dependencies**
> `@cometchat/chat-sdk-javascript`, `@cometchat/chat-uikit-react`
>
> **Auth mode** Development (Auth Key for now; production auth is a one-flag upgrade later)
>
> **Estimated time** ~30 seconds to write the code, ~1 minute for `npm install` to finish.
>
> If anything looks off, just tell me what to change. Otherwise, say "go" and I'll write it.

**The rules for this moment:**

1. **Be specific in the modify section.** "Wrap with provider" is vague. "Wrap `{children}` with `<CometChatProvider>` at line ~14" tells the user exactly what to expect when they git-diff later.
2. **List the don't-touch files explicitly.** Users worry about agents stomping their auth config, their tailwind, their routes. Naming what stays untouched defuses that worry up front.
3. **Estimated time matters.** Two short numbers — a few seconds to write code, a couple minutes for `npm install`. Sets expectations; reduces "is it stuck?" mid-flow.
4. **End with a hand-off, not a yes/no.** "Say 'go' and I'll write it. Or tell me what to change." Beats "Proceed? [y/n]" — it implies the user can adjust without throwing the whole plan away.
5. **Never abbreviate the plan in subsequent runs.** Every integration deserves a fresh, full plan. If the user has been through this before, they can skim — but don't pre-skim for them.

**Web example (Next.js + NextAuth, marketplace):** see the shape above.

**Web example (Vite + React, greenfield messaging app):**

> Here's the plan:
>
> **Files I'll create**
> - `src/cometchat/CometChatProvider.tsx` — wraps the kit's providers, gates render on login
> - `src/cometchat/init.ts` — `CometChat.init` + `CometChat.login` (with `cometchat-uid-1` for dev)
> - `src/components/ChatScreen.tsx` — your full-page chat surface (conversations + messages)
> - `.env` — your CometChat App ID + Region + Auth Key (gitignored)
>
> **Files I'll modify**
> - `src/main.tsx` — wrap `<App />` with `<CometChatProvider>` (line ~10)
> - `src/App.tsx` — render `<ChatScreen />` instead of the Vite default (you can move it to a route later)
>
> **Files I won't touch**
> - `vite.config.ts`, `tsconfig.*` — no build config changes
> - `src/index.css`, `src/App.css` — kit ships its own CSS; your styles stay
>
> **Dependencies** `@cometchat/chat-sdk-javascript`, `@cometchat/chat-uikit-react`
>
> **Auth mode** Development (Auth Key + `cometchat-uid-1`; you can log in as `cometchat-uid-1`–`uid-5` to chat with yourself across browser windows)
>
> **Estimated time** ~30 seconds to write, ~1 minute for `npm install`.
>
> Say "go" or tell me what to change.

**RN example (Expo Router, messaging):**

> Here's the plan:
>
> **Files I'll create**
> - `cometchat/CometChatProvider.tsx` — four-wrapper chain (gesture handler → safe area → theme → CometChat)
> - `cometchat/init.ts` — init + login, module-level guard
> - `app/(tabs)/messages.tsx` — your Messages tab
> - `.env` — `EXPO_PUBLIC_COMETCHAT_APP_ID` + region + auth key
>
> **Files I'll modify**
> - `app/_layout.tsx` — wrap with the four-wrapper chain (line ~10)
> - `app/(tabs)/_layout.tsx` — add the Messages tab as the third entry, after Home and Profile
> - `index.js` — `import 'react-native-gesture-handler'` at line 1 (mandatory; without it release builds break silently)
>
> **Files I won't touch**
> - `app.json` — no Expo config changes for dev mode (production push needs them, but that's later)
> - Your existing `app/(tabs)/index.tsx`, `profile.tsx` — stay as-is
>
> **Dependencies (via `npx expo install`)**
> `@cometchat/chat-uikit-react-native`, `@cometchat/chat-sdk-react-native`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `react-native-video`, `react-native-image-picker`, `react-native-document-picker`, `react-native-vector-icons`, `react-native-fs`
>
> **Auth mode** Development (Auth Key).
>
> **Estimated time** ~30 seconds to write, ~3 minutes for `expo install` (RN deps are heavier).
>
> Say "go" or tell me what to change.

**Bare RN variant** — same as Expo, except:
- `npm install` instead of `npx expo install`
- Run `cd ios && pod install` (~1-2 min extra)
- Patch `ios/<Name>/Info.plist`, `android/app/src/main/AndroidManifest.xml` for camera/mic permissions
- Add `ios/<Name>/PrivacyInfo.xcprivacy` (Apple Privacy Manifest)
- Patch `android/build.gradle` for the async-storage Maven repo (v3+)

Surface these in the "Files I'll modify" section so the user knows they're coming.

**After approval — the writing moment:**

When the user says "go", narrate progress as you work. Don't be silent for 30 seconds while you write 5 files. Brief structured updates, one per beat:

> ✓ Created `cometchat/CometChatProvider.tsx`
> ✓ Created `cometchat/init.ts`
> ✓ Modified `src/main.tsx` (wrapped App with provider)
> ✓ Wrote `.env` (Auth Key hidden)
> Installing dependencies (this takes ~1 minute)...

The structured beats make the writing feel like a contract being executed, not a black box churning.

**If the user says no or wants changes:** go back to the relevant question and re-ask. Don't try to negotiate the plan in-line — the plan is atomic. Adjust the source decision, then regenerate the plan.

### Step 4 — Reference pattern skills

**All skills are already loaded in your context** as `.claude/skills/` files. Do NOT use the `Skill()` tool. Read and follow them directly.

**For web frameworks:**
1. `cometchat-core` — initialization, provider, CSS, anti-patterns
2. `cometchat-components` — component catalog, composition patterns
3. Framework-specific:
   - `reactjs` → `cometchat-react-patterns`
   - `nextjs` → `cometchat-nextjs-patterns`
   - `react-router` → `cometchat-react-router-patterns`
   - `astro` → `cometchat-astro-patterns`
4. `cometchat-placement` — placement pattern for the chosen approach

**For React Native:**
1. `cometchat-native-core` — init, login, four-wrapper provider chain, env vars, anti-patterns
2. `cometchat-native-components` — component catalog
3. Framework-specific:
   - `expo` (managed + Expo Router) → `cometchat-native-expo-patterns`
   - `react-native` (bare CLI) → `cometchat-native-bare-patterns`
4. `cometchat-native-placement` — placement pattern (stack/tab/modal/bottom-sheet/embed)

**For Angular:**
1. `cometchat-angular-core` — init via `UIKitSettingsBuilder`, `APP_INITIALIZER` pattern, `CUSTOM_ELEMENTS_SCHEMA`, env config in `environment.ts`, login order, anti-patterns
2. `cometchat-angular-components` — component catalog (kebab-case selectors, `[input]` callbacks vs `(output)` events, content-projection slots, NgModule imports)
3. `angular` → `cometchat-angular-patterns` — module organization, lazy-loading the chat module, environment file editing, providers
4. `cometchat-angular-placement` — placement pattern (route, modal, drawer, embedded panel)

**For Android — branches by `android_version`:**

If `android_version === "v5"`:
1. `cometchat-android-v5-core` — Gradle deps, `UIKitSettings.UIKitSettingsBuilder`, `CometChatUIKit.init()` in `Application.onCreate()`, login, theme requirements (`CometChatTheme.DayNight` → Material 2 parent)
2. `cometchat-android-v5-components` — View classes (`CometChatConversations`, `CometChatMessageList`, `CometChatMessageComposer`, …), `setUser`/`setGroup`, listener setters (`setOnItemClick`, `setOnSendButtonClick`), thread-mode rule (`setParentMessage(long)` on list, `setParentMessageId(long)` on composer)
3. `cometchat-android-v5-placement` — Activity, Fragment, BottomSheet placement, navigation
4. `cometchat-android-v5-customization` — `CometChatTextFormatter`, message templates, `CometChatMessageEvents.addListener`, DataSource decorators
5. `cometchat-android-v5-extensions` — registrar (`PollsExtension`, `StickerExtension`, `SmartRepliesExtension` extending `ExtensionsDataSource`) vs decorator pattern; never construct decorators directly

If `android_version === "v6"`, additionally branch by UI stack (Compose vs Kotlin Views — ask the user if both are present):
1. `cometchat-android-v6-core` — Gradle deps for `chatuikit-{compose,kotlin}-android:6.x` + `chatuikit-core`, init, login, message sending
2. `cometchat-android-v6-events` — `CometChatEvents` SharedFlows + sealed event classes
3. **Compose stack** → `cometchat-android-v6-compose-{components,placement,theming,customization}` — Composables, `CometChatTheme { ... }`, `BubbleFactory`, slot lambdas
4. **Kotlin Views stack** → `cometchat-android-v6-kotlin-{components,placement,theming,customization}` — custom View classes, `setOnItemClick`, `BubbleFactory` abstract class, `setBubbleFactories`
5. `cometchat-android-v6-builder-settings` — `UIKitSettingsBuilder` knobs (calling, presence, etc.)

Both V5 and V6 share `cometchat-android-{v5,v6}-{features,extensions,push,production,testing,troubleshooting}` for cross-cutting concerns.

**For Flutter — branches by `flutter_version`:**

If `flutter_version === "v5"`:
1. `cometchat-flutter-v5-core` — pubspec deps, `UIKitSettings.UIKitSettingsBuilder`, `CometChatUIKit.init()`, login, GetX-based controller pattern, `subscriptionType` requirement, theme caching rule, listener lifecycle
2. `cometchat-flutter-v5-conversations` / `-messages` / `-users-groups` / `-calls` — widget-by-widget catalog (V5 splits its component catalog across these four skills)
3. `cometchat-flutter-v5-theming` — `CometChatThemeHelper`, `CometChatColorPalette`, `CometChatSpacing`, `CometChatTypography`, dark mode
4. `cometchat-flutter-v5-customization` — `DataSource`, `DataSourceDecorator`, `CometChatMessageTemplate`, `CometChatTextFormatter`, slot views
5. `cometchat-flutter-v5-events` — `CometChatMessageEvents.addListener`, `CometChatGroupEvents`, `CometChatUserEvents`, `CometChatCallEvents`, `CometChatUIEvents`
6. `cometchat-flutter-v5-push` — FCM/APNs/VoIP setup; `CometChatNotifications.registerPushToken()` is the public surface (sample-app `PNRegistry` is a wrapper users copy)
7. `cometchat-flutter-v5-production` — server-minted auth tokens, ProGuard, release builds
8. `cometchat-flutter-v5-troubleshooting` — pubspec resolution, GetX errors, runtime crashes

If `flutter_version === "v6"`:
1. `cometchat-flutter-v6-core` — pubspec deps (single `cometchat_chat_uikit:^6.0.0-beta2` package), `UIKitSettingsBuilder`, init, login, message sending. The `enableCalls`/`CallingConfiguration()` knobs live in `cometchat-flutter-v6-calls`.
2. `cometchat-flutter-v6-components` — full Bloc-driven widget catalog
3. `cometchat-flutter-v6-conversations` / `-messages` / `-users-groups` / `-calls` — per-widget deep dives
4. `cometchat-flutter-v6-features` — feature catalog
5. `cometchat-flutter-v6-placement` — route, modal sheet, embedded widget — where chat lives in the app
6. `cometchat-flutter-v6-theming` — `CometChatThemeHelper`, `CometChatColorPalette` (V6 names), `CometChatThemeMode`
7. `cometchat-flutter-v6-customization` — `BubbleFactory<T>`, `CometChatMessageTemplate`, text formatters, slot widgets
8. `cometchat-flutter-v6-events` — Bloc-based event streams, listener registration
9. `cometchat-flutter-v6-production` — server-minted auth tokens, ProGuard
10. `cometchat-flutter-v6-troubleshooting` — pubspec, Bloc, theme cache

For projects migrating from V5 to V6, ALSO load `cometchat-flutter-v6-migration` — V5→V6 breaking changes (GetX → Bloc, theme API rewrite, `BuilderSettings` removal, callMain entry-point removal).

**For iOS — single cohort (V5 only today):**

1. `cometchat-ios-core` — Installation (CocoaPods + SPM), `UIKitSettings`, `CometChatUIKit(uiKitSettings:)` constructor init, login (`.success` / `.onError` switch — NOT Swift's standard `Result.failure`), AppDelegate vs SwiftUI App-struct init sites, anti-patterns
2. `cometchat-ios-components` — Component catalog: `CometChatConversations`, `CometChatUsers`, `CometChatGroups`, `CometChatGroupMembers`, `CometChatMessageHeader/List/Composer`, `CometChatIncomingCall/OutgoingCall/OngoingCall/CallButtons/CallLogs`, `CometChatSearch`, `CometChatReactionList`, `CometChatThreadedMessageHeader`. Build a `MessagesVC` by composing header + list + composer (the kit does NOT ship a pre-built `CometChatMessages` UIViewController).
3. `cometchat-ios-placement` — Navigation controller, modal, tab bar, embedded view — where chat lives. Mixed SwiftUI + UIKit hosting via `UIViewControllerRepresentable`.
4. `cometchat-ios-customization` — Custom message templates, text formatters, DataSource/Decorator pattern, custom views.
5. `cometchat-ios-theming` — `CometChatTheme` color tokens, `CometChatTypography.setFont(name:)`, dark mode.
6. `cometchat-ios-features` — Feature catalog: calls, polls, reactions, AI, extensions.
7. `cometchat-ios-production` — Server-minted auth tokens, user management.
8. `cometchat-ios-push` — APNs + VoIP, CallKit integration, token lifecycle.
9. `cometchat-ios-troubleshooting` — SPM/CocoaPods errors, Xcode build issues, Info.plist gotchas, runtime crashes.

### Step 5 — Write the integration

Execute the confirmed plan. The order of operations is the same for every framework, but the file names + provider shape differ.

**Web — common steps:**

1. **CometChatProvider** — follow the framework skill's provider pattern. Use the correct env var prefix. Module-level `initialized` guard. Mount at the level agreed in Step 3f.
2. **Chat component(s)** — follow the placement skill's pattern.
3. **Wire into existing project** — READ each file before modifying. Add the route, nav link, drawer/modal trigger.
4. **CSS import** — add once at the root level per framework conventions.
5. **Environment variables** — write the env file with the correct prefix.
6. **Install dependencies:**
   ```bash
   npm install @cometchat/chat-sdk-javascript @cometchat/chat-uikit-react
   ```

**React Native — common steps:**

1. **Entry file** (`index.js` / `App.tsx` / `app/_layout.tsx`) — verify `import "react-native-gesture-handler";` is **line 1**. Not line 2, not after another import. Non-negotiable.
2. **CometChatProvider** — follow `cometchat-native-core` § 6. Module-level `initialized` guard. Module-level `loginInFlight` promise for login concurrency.
3. **Four-wrapper chain** — wrap the app's root in this exact order:
   ```tsx
   <GestureHandlerRootView style={{ flex: 1 }}>
     <SafeAreaProvider>
       <CometChatThemeProvider>
         <CometChatProvider>
           {/* navigator / Expo Router <Stack> */}
         </CometChatProvider>
       </CometChatThemeProvider>
     </SafeAreaProvider>
   </GestureHandlerRootView>
   ```
4. **Chat screen(s)** — follow `cometchat-native-placement`'s pattern.
5. **Every `<CometChatMessageList>` MUST pass `hideReplyInThreadOption={true}`** (see hard rules).
6. **Wire into existing project** — READ each file before modifying.
7. **Environment variables** — write `.env` with the correct prefix (`EXPO_PUBLIC_` for Expo, bare for `react-native`).
8. **Install dependencies:**

   **Expo managed:**
   ```bash
   npx expo install @cometchat/chat-uikit-react-native @cometchat/chat-sdk-react-native \
     react-native-gesture-handler react-native-reanimated react-native-safe-area-context \
     react-native-screens @react-native-async-storage/async-storage \
     @react-native-community/netinfo react-native-video react-native-image-picker \
     react-native-document-picker react-native-vector-icons react-native-fs
   ```

   **Bare RN:**
   ```bash
   npm install @cometchat/chat-uikit-react-native @cometchat/chat-sdk-react-native \
     react-native-gesture-handler react-native-reanimated react-native-safe-area-context \
     react-native-screens @react-native-async-storage/async-storage \
     @react-native-community/netinfo react-native-video react-native-image-picker \
     react-native-document-picker react-native-vector-icons react-native-fs
   cd ios && pod install && cd ..
   ```

   **Reanimated plugin (both):** verify `react-native-reanimated/plugin` is the LAST entry in `babel.config.js` `plugins` array. Metro cache is sensitive to plugin order.

9. **Native config (bare RN only):**
   - `ios/<Name>/Info.plist` — add `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription`
   - `android/app/src/main/AndroidManifest.xml` — add `CAMERA`, `RECORD_AUDIO`, `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` permissions
   - `ios/<Name>/PrivacyInfo.xcprivacy` — add the 3 required API codes (C617.1, CA92.1, 35F9.1) — matching the kit's own SampleApp manifest. Add `E174.1` (DiskSpace) only if your app does explicit free-space checks. See `cometchat-native-bare-patterns`.
   - `android/build.gradle` — async-storage Maven repo if v3+

   **Expo managed** — all of this goes in `app.json` under `plugins` and `ios.infoPlist` / `android.permissions`. See `cometchat-native-expo-patterns`.

**iOS — common steps:**

1. **Migrate credentials to `Secrets.swift` or an `.xcconfig`** — if `provision setup` wrote a `.env` (iOS handoff), do the migration documented in Step 2d above. Confirm the secrets file is in `.gitignore`.
2. **Add the kit dep:**
   - **CocoaPods:** add `pod 'CometChatUIKitSwift', '~> 5.1'` to `Podfile` → `pod install`. Open the `.xcworkspace` (NOT `.xcodeproj`). For Xcode 15+, set `ENABLE_USER_SCRIPT_SANDBOXING = NO` in Build Settings (or add the `post_install` Podfile hook that does this for every pod target).
   - **SPM:** in Xcode → File → Add Package Dependencies → `https://github.com/cometchat/cometchat-uikit-ios` (latest 5.x). Or add the package URL to your `Package.swift` if you're an SPM-only app.
3. **Init in your app entry point** — UIKit: in `AppDelegate.application(_:didFinishLaunchingWithOptions:)`. SwiftUI: in `@main struct App.init()`. The init takes a `UIKitSettings` and a `Result<Bool, Error>` completion: `CometChatUIKit(uiKitSettings: settings) { result in switch result { case .success: ... case .failure(let error): ... } }`. The explicit `.init(...)` form (`CometChatUIKit.init(uiKitSettings: ...) { ... }`) compiles identically in Swift and is what the kit's sample apps use — both are fine. **Note that this completion uses Swift's standard `Result.failure`, NOT the kit's `.onError` enum which only appears in login/logout callbacks (see step 4).**
4. **Login order** — `CometChatUIKit.login(uid:)` (dev) or `.login(authToken:)` (production). The login callback uses `.success` / `.onError` cases (NOT Swift's standard `Result.failure`).
5. **Place chat in your app** — for UIKit nav stacks, push your composed `MessagesVC` (header + list + composer). For SwiftUI, wrap each kit `UIViewController` in a `UIViewControllerRepresentable`. The kit does NOT ship a pre-built `CometChatMessages` or `CometChatConversationsWithMessages` — compose your own.
6. **Info.plist permissions** — for calls add `NSMicrophoneUsageDescription` + `NSCameraUsageDescription`. For push add the APNs entitlement + a `BackgroundModes` entry (`remote-notification`, plus `voip` for VoIP push).
7. **Verify** — `xcodebuild -workspace <App>.xcworkspace -scheme <App> -configuration Debug build` (CocoaPods) or `-project <App>.xcodeproj -scheme <App> ...` (SPM). Skip `xcodebuild test` and `xcodebuild run-app` — those need a simulator and longer compile time than CI usually permits.

**Flutter — common steps:**

1. **Migrate credentials to a Dart const file or `--dart-define`** — if `provision setup` wrote a `.env` (Flutter handoff), do the migration documented in Step 2d above. Confirm `lib/cometchat_config.dart` is in `.gitignore` if you go the const-file route.
2. **Add the cometchat dep** to `pubspec.yaml` and run `flutter pub get`:
   - V5: `cometchat_chat_uikit: ^5.2.14` (and `cometchat_calls_uikit: ^5.0.15` if calls are needed). Both packages live on the Cloudsmith Dart pub registry, so you'll also need a `--hosted-url` flag in your CI scripts: `dart pub add cometchat_chat_uikit:^5.2.14 --hosted-url https://dart.cloudsmith.io/cometchat/cometchat/`.
   - V6: `cometchat_chat_uikit: ^6.0.0-beta2` (single package — calls fold in).
3. **Imports — V5 has TWO barrels.** For chat-only V5 apps, only the chat barrel is needed: `import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';`. For V5 + calls, ADD a second import: `import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';` — the calls barrel does NOT re-export the chat barrel, so chat widgets aren't reachable through it alone. V6 has ONE barrel: `import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';`.
4. **Init in `main.dart`** — `CometChatUIKit.init(uiKitSettings: settings, onSuccess: ..., onError: ...)`. V5 and V6 share the same init signature (callback-style); the difference is what comes after — V5 wires GetX controllers; V6 wires `BlocProvider`s. Always set `subscriptionType: CometChatSubscriptionType.allUsers` on the builder.
5. **Place chat in your app** — Flutter routing is in code (`Navigator.push`/`go_router`/etc.). Wire chat screens into your app's existing navigation. V6 has a dedicated placement skill for route/modal/embed patterns; V5 covers the same ground inside its per-widget skills.
6. **AndroidManifest + Info.plist** — for calls, add the platform permissions (microphone, camera, modify-audio-settings on Android; `NSMicrophoneUsageDescription` + `NSCameraUsageDescription` on iOS). For push, register the FCM service / configure APNs entitlements per `cometchat-flutter-{v5,v6}-push` (V5) or the troubleshooting skill (V6).
7. **Verify** — `flutter analyze` first (catches Dart compile + import errors), then `flutter build apk --debug` (Android) or `flutter build ios --debug --no-codesign` (iOS). The build catches dep-resolution / native-config issues.

**Android — common steps:**

1. **Migrate credentials to `local.properties` + `BuildConfig`** — if `provision setup` wrote a `.env` (Android handoff), do the migration documented in Step 2d above. Confirm `local.properties` is in `.gitignore` (it is by default in `ng new`-style scaffolds and Android Studio templates, but verify).
2. **Add the cometchat dep** to `app/build.gradle` (or `.kts`):
   - V5: `implementation 'com.cometchat:chat-uikit-android:5.+'`
   - V6 Compose: `implementation 'com.cometchat:chatuikit-compose-android:6.+'` (plus `compose-bom` if not already present)
   - V6 Kotlin Views: `implementation 'com.cometchat:chatuikit-kotlin-android:6.+'`
   - Both V6 stacks: add both `chatuikit-compose-android` AND `chatuikit-kotlin-android` (plus `chatuikit-core` if the kit splits it out)
3. **Theme parent (V5 only)** — `Application` theme must inherit from `CometChatTheme.DayNight` (which itself parents on `Theme.MaterialComponents.DayNight.NoActionBar`). Inheriting from `Theme.AppCompat.*` or `Theme.Material3.*` causes `UnsupportedOperationException` at inflate time. V6 doesn't share this requirement — Compose has its own `CometChatTheme { }` block; Kotlin Views uses style attrs.
4. **Init in `Application.onCreate()`** — `CometChatUIKit.init(this, settings, callback)`. Wire `login(uid, callback)` inside the init success callback. `Application` class must be registered in `AndroidManifest.xml` via `<application android:name=".MyApp" …>`.
5. **Place chat in your app** — V5: Activity / Fragment with the View classes (`CometChatConversations` etc.). V6 Compose: Composable screens via NavHost. V6 Kotlin Views: same Activity/Fragment shape as V5 but with V6 View classes.
6. **AndroidManifest permissions** — `INTERNET` is mandatory; for calls add `RECORD_AUDIO`, `CAMERA`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT` (API 31+).
7. **ProGuard/R8** — for release builds, add `-keep class com.cometchat.** { *; }` to `proguard-rules.pro` to prevent stripping.
8. **Verify** — `./gradlew :app:assembleDebug` (or `app:assembleDebug` from project root) catches Gradle/AGP/dependency issues; the kit's compile-time annotation processors surface schema errors here.

**Angular — common steps:**

1. **Migrate credentials into `environment.ts`** — if `provision setup` wrote a `.env` (Angular fallback), extend `src/environments/environment.ts` with a `cometchat: { appId, region, authKey }` block. Mirror in `environment.prod.ts` WITHOUT the `authKey` (production uses server-minted auth tokens — see `cometchat-angular-production`).
2. **Add `CUSTOM_ELEMENTS_SCHEMA`** to the NgModule that hosts CometChat templates — kit atom components (`<cometchat-avatar>`, `<cometchat-status-indicator>`, etc.) are LitElement web components, not Angular standalone modules. Without the schema, Angular throws `Can't bind to '...' since it isn't a known property of 'cometchat-...'`.
3. **Init service + APP_INITIALIZER** — follow `cometchat-angular-core` § 1-3. `UIKitSettingsBuilder().setAppId().setRegion().setAuthKey().build()`, then `CometChatUIKit.init(settings)` returns a Promise — chain login. Wire as `APP_INITIALIZER` so init completes before any component renders.
4. **Import the right NgModule(s)** — for the chat-hosting module, add the kit modules from `@cometchat/chat-uikit-angular` (e.g. `CometChatConversations`, `CometChatMessages`) to `imports: []`. `cometchat-angular-components` documents the module name vs. component name pairing.
5. **Wire chat into existing project** — READ each file before modifying. Add the route, nav link, modal trigger.
6. **Theming** — inject `CometChatThemeService` to control palette/typography. See `cometchat-angular-theming`.
7. **Install dependencies:**
   ```bash
   npm install @cometchat/chat-uikit-angular @cometchat/chat-sdk-javascript
   ```

#### Step 5 — common to ALL frameworks

After the framework-specific work above, every integration ends the same way:

10. **Update config.json** — save all the choices in one call:
    ```bash
    npx @cometchat/skills-cli config save \
      --intent "<intent>" \
      --placement "<type>" \
      --placement-path "<path>" \
      --auth-mode "<mode>" --json
    ```
    Pass only the fields you have — `config save` accepts any subset.

11. **Record state so Phase B commands work — DO NOT SKIP.** Every Phase B command (`info`, `status`, `doctor`, `verify`, `uninstall`, `apply-theme`, `apply-feature`, `add-widget`, `add-user-mgmt`, `production-auth`) reads `.cometchat/state.json` to know what the integration looks like. Without this step, every one of them reports "not integrated in this project" even though the code is there.

    Pass every file you wrote (owned) and every existing file you patched:
    ```bash
    npx @cometchat/skills-cli state record \
      --framework "<framework>" \
      --placement "<type>" \
      --placement-path "<path>" \
      --auth-mode "<mode>" \
      --files-owned "<comma-list of new files>" \
      --files-patched "<comma-list of path:patch_id pairs>" \
      --json
    ```

    - `--files-owned` — comma-separated list of every NEW file you wrote (provider, drawer, inbox page, screen). The CLI computes SHA-256 checksums for each so it can detect drift later.
    - `--files-patched` — comma-separated `path:patch_id` pairs for every EXISTING file you modified. `patch_id` can be any stable label — `v3/<filename>` is a reasonable default.

    If this call errors (CLI flag mismatch, missing `--framework`, etc.), surface the error and retry. A completed Phase A with a missing state.json is worse than a visible error — the user discovers the breakage later when they try to add a feature or run diagnostics.

**Exception — "Just exploring" / demo mode (web only):**
```bash
npx @cometchat/skills-cli apply --experience 1 --framework <detected>
npx @cometchat/skills-cli verify --json
npx @cometchat/skills-cli install
```

For RN demo mode, scaffold the minimal integration directly — there's no `apply` template path for RN.

### Step 6 — Verify + show result

Run a TypeScript check to verify the code compiles:
```bash
npx tsc --noEmit
```

**Angular projects:** prefer `npx ng build --configuration development` (Angular's compiler validates templates, NgModule shape, and DI graph — `tsc` alone misses template type errors).

**Android projects:** run `./gradlew :app:assembleDebug` (or `gradlew.bat :app:assembleDebug` on Windows). The Gradle build catches dependency-resolution errors (wrong cometchat coords), Kotlin/Java compile errors (wrong method signatures), `BuildConfig` field errors (missing `buildConfigField` declarations), and AndroidManifest issues. Do NOT start an emulator or run the app — keep verification to the build step.

**Flutter projects:** run `flutter analyze` (catches Dart compile + null-safety + import errors), then `flutter build apk --debug` for Android-side verification (or `flutter build ios --debug --no-codesign` for iOS-side). Skip `flutter run` — it starts an emulator/device session that can't be observed from CI.

**iOS projects:** run `xcodebuild -workspace <App>.xcworkspace -scheme <App> -configuration Debug -destination 'generic/platform=iOS' build` (CocoaPods) or the `-project` variant (SPM). The build catches CocoaPods/SPM dep-resolution errors, Swift compile errors, missing `Info.plist` keys, and signing-config issues. Do NOT run `xcodebuild test` or boot a simulator.

**Do NOT run `npx @cometchat/skills-cli verify`** — it checks for CLI-generated `.cometchat/state.json` that's authored by `cometchat apply`, not by AI integration. Use `tsc` (or `ng build` / `./gradlew :app:assembleDebug` / `flutter analyze` / `xcodebuild build` for Angular / Android / Flutter / iOS) instead.

**RN extra: do not start Metro automatically** — let the user do that in their own terminal. Metro blocks the terminal and cannot be meaningfully observed from here.

Surface any common issues:

**Web:**
- `Module not found: @cometchat/chat-uikit-react` → install didn't complete
- CSS variable warnings → CSS import not at root or wrong path

**RN:**
- `Cannot find module '@cometchat/chat-uikit-react-native'` → install didn't complete
- `JSX element 'GestureHandlerRootView' has no corresponding closing tag` → wrapper chain partially applied
- `Property 'hideReplyInThreadOption' does not exist on type '...'` → older UI Kit types installed; on RN make sure `@cometchat/chat-uikit-react-native@^5` is resolved (the prop exists from v5 onwards)

Then:

**Web result message:**
> "CometChat is integrated! Here's what was set up:
>
> - <list of new + patched files> ✓
> - Provider + CSS wired ✓
> - Dependencies installed ✓
>
> Run `npm run dev` (or `ng serve` for Angular) and open the app:
> - **Vite (reactjs)**: http://localhost:5173
> - **Next.js**: http://localhost:3000/chat
> - **React Router v7**: http://localhost:5173/chat
> - **Astro**: http://localhost:4321/chat
> - **Angular**: http://localhost:4200"

**RN result message:**
> "CometChat is integrated! Here's what was set up:
>
> - <list of new + patched files> ✓
> - Provider + four-wrapper chain ✓
> - `import 'react-native-gesture-handler'` verified at line 1 ✓
> - Dependencies installed ✓
> - `hideReplyInThreadOption={true}` on MessageList ✓
>
> Next steps:
>
> **Expo managed:**
> 1. `npx expo start --clear`
> 2. Open the app in Expo Go (if no native modules) or a dev build
>
> **Bare RN:**
> 1. `npm start -- --reset-cache`
> 2. In another terminal: `npm run ios` or `npm run android`"

**Common ending — what you'll see on first load (every framework):**

> ---
>
> **Pre-seeded test data — chat works immediately, no dashboard setup needed:**
>
> Every CometChat app ships with **5 pre-created test users**
> (`cometchat-uid-1` through `cometchat-uid-5`), a **"Hello" test group**,
> and **sample messages between them**. Your integration is logged in
> as `cometchat-uid-1` by default, so on first load the conversation
> list is already populated — you'll see existing 1:1 threads and the
> test group with message history. Open any conversation and reply;
> round-trip is ~50ms. Receipts, typing indicators, presence, and
> reactions all work out of the box.
>
> **Want to see real-time delivery between two users?** Open the
> integration in two browser windows (or two simulators on RN), and
> temporarily change the login UID in your provider — `cometchat-uid-2`
> in one window, `cometchat-uid-1` in the other. Messages from one
> arrive live in the other without refresh.
>
> The dashboard at `https://app.cometchat.com` is useful later for
> creating real users, configuring extensions, and viewing analytics
> — but you don't need it to confirm the integration is working.
>
> What would you like to do next?"

### Step 7 — Iteration menu

Use `AskUserQuestion`. The option set differs by family — RN has two extra options (push notifications + testing) that don't apply to web.

**Web — 8 canonical options:**
- **question:** "What would you like to do next?"
- **header:** "Next step"
- **multiSelect:** false
- **options:**
  1. label: "Customize look and feel (themes)", description: "Pick a preset (slack, whatsapp, imessage, discord, notion) or set brand colors."
  2. label: "Add a feature", description: "Browse ~35 features — calls, reactions, polls, AI, and more."
  3. label: "Customize a component", description: "Custom bubbles, headers, composer actions, details views — I'll read the docs and write it."
  4. label: "Add a floating chat widget", description: "An overlay button + drawer on top of your existing app."
  5. label: "Set up production auth", description: "Replace the dev Auth Key with a server-side token endpoint. Read `cometchat-production` skill."
  6. label: "Set up user management", description: "Server endpoints for creating, updating, deleting CometChat users."
  7. label: "Run diagnostics", description: "Check for drift, missing env vars, broken imports."
  8. label: "I'm done", description: "Exit."

**RN — 10 canonical options:**
- **question:** "What would you like to do next?"
- **header:** "Next step"
- **multiSelect:** false
- **options:**
  1. label: "Customize look and feel (themes)", description: "Colors, typography, dark mode — edit CometChatThemeProvider."
  2. label: "Add a feature", description: "Calls, reactions, polls, extensions, AI agent — browse the catalog."
  3. label: "Customize a component", description: "Custom bubbles, headers, message composer actions, empty states."
  4. label: "Add another placement", description: "Add a modal chat, a bottom sheet, or another tab — without touching the existing integration."
  5. label: "Set up push notifications", description: "APNs + FCM setup, CometChat dashboard config, client registration, tap-to-deep-link. Required for production."
  6. label: "Set up production auth", description: "Replace the dev Auth Key with a server-minted auth token. Read `cometchat-native-production` skill."
  7. label: "Set up user management", description: "Server endpoints for creating, updating, deleting CometChat users."
  8. label: "Set up testing", description: "Jest + React Native Testing Library setup, mocks for the UI Kit / SDK, E2E with Detox or Maestro."
  9. label: "Troubleshoot an issue", description: "Metro cache, pod install, iOS privacy manifest, push notifications, native module linking."
  10. label: "I'm done", description: "Exit."

For **theme customization**: read the framework-appropriate theming skill and write the customization code.

For **adding features**: read the framework-appropriate features skill. Features fall into six buckets:

  - **default** — already enabled by the UI Kit, no action needed.
  - **extension** — pure boolean toggle. Run `cometchat apply-feature <id>` (web/RN with `state.json`) or `cometchat apply-feature <id> --app-id <X>` (native cohorts: iOS / Android / Flutter / Angular). Hits the dashboard API; no browser visit required.
  - **ai-feature** — `smart-replies`, `conversation-summary`, `conversation-starter`. Run `cometchat apply-feature <id> --openai-key sk-...` (add `--app-id <X>` for native). The CLI sets the OpenAI key on the app's AI settings, then flips the toggle in one call.
  - **dashboard-only** — third-party API keys / multi-field config (Giphy, Stipop, Tenor, Chatwoot, Intercom, Disappearing Messages, Message Shortcuts). The CLI returns `manual-action-required` and prints the dashboard path — these genuinely need the user to configure third-party credentials.
  - **package-install** — calls. Run `npm install @cometchat/calls-sdk-javascript` (or the framework's calls SDK).
  - **component-swap** — `rich-text-formatting`. Run `cometchat apply-feature rich-text-formatting`.

  Ask which feature, look it up in `packages/registry/v6/features/catalog.json` (or run `cometchat features info <id>`) to learn its bucket, then execute the right recipe. **Never tell the user to "open the dashboard and flip a toggle" for an extension or ai-feature** — that's what `cometchat apply-feature <id>` does for them.

For **component customization**: read the customization + components skills, then write the customization code directly. Ask the user what they want to customize, read the relevant component's props from the catalog, propose changes.

For **production auth**: read the framework-appropriate production skill. It's interactive — ask the user about their auth system and generate the server-side token endpoint for their backend.

For **push notifications (RN only)**: read `cometchat-native-push`. Structured 12-section walkthrough.

For **testing (RN only)**: read `cometchat-native-testing`. Ask the user whether they want unit tests (Jest + RNTL), E2E (Detox vs Maestro), or both.

For **troubleshooting (RN)**: read `cometchat-native-troubleshooting` and match the symptom to a triage table. (Web: option 7 "Run diagnostics" runs `cometchat doctor` against `.cometchat/state.json`.)

### Re-rendering the menu after each action

After every Phase B action completes, you **MUST** re-invoke `AskUserQuestion` with the **exact same option set** (web: 8 options, RN: 10) — same `question`, `header`, `multiSelect: false`, same labels and descriptions, verbatim. This gives the user arrow-key selection in their terminal.

**Do NOT:**
- Present the options as a prose bullet list — forces typed answers, worse UX.
- Invent new options based on what the user just did. The canonical set doesn't change between iterations.
- Skip the menu and ask freeform "What's next?" — always route through `AskUserQuestion`.
- Drop options or add new ones. The user expects the same choices every time, even if some are redundant with what they just did (they may want to do the same kind of action twice).

The iteration loop is the whole point of Phase B. Re-rendering the canonical menu via `AskUserQuestion` after every action is how the user controls the session.

## Hard rules

### Always (every framework)

- **Ask, don't assume.** Every integration decision should be confirmed.
- **Always run `detect` first.** Do not assume the framework.
- Always use `npx @cometchat/skills-cli` for CLI commands.
- NEVER replace existing project files unless the user chose demo mode.
- ALWAYS read existing files before modifying them.
- ALWAYS show the plan (Step 3f) and get confirmation before writing.
- **Every `<CometChatMessageList>` must pass `hideReplyInThreadOption={true}`** unless the user has explicitly opted into thread support and you've built the thread screen too. Without it, tapping a message shows a "Reply in Thread" action that leads to a broken (undefined) thread view.
- **NEVER build a custom search UI.** The UI Kit ships `<CometChatSearch>` — full dual-scope search across conversations + messages with built-in filter chips, pagination, and result highlighting. Any request involving "search", "find messages", "search conversations" MUST use the built-in component (and `showSearchBar` / `onSearchBarClicked` on `CometChatConversations` for web; `hideSearch={false}` for RN). Do NOT create custom search bars, hand-rolled result lists, or filter UIs.
- For component names and props, use the framework-appropriate `*-components` skill or docs MCP — never invent from training data.
- After writing code, record state in `.cometchat/state.json` (Step 5 step 11) so the iteration menu can detect the integration in a future session.
- **NEVER use the `Skill()` tool** to load CometChat skills. They're already in your context as `.claude/skills/` files. Just read and follow them directly.

### Web only

- **CSS import goes once at the root level** per framework conventions. The framework skill (cometchat-{react,nextjs,react-router,astro}-patterns) tells you exactly where.
- **For drawer / widget animations, animate `right` / `left`, NEVER `transform` / `translate-*`.** A `transform` on a CometChat-containing element creates a new containing block that re-anchors absolutely-positioned overlays (emoji picker, action sheet, reactions, thread panel) to the transformed element instead of the viewport. Tailwind utilities `translate-x-*`, `-translate-x-*`, `scale-*`, `rotate-*`, `transform-*` are also banned for this reason. See `cometchat-placement` § 10.

### React Native only

- **`import "react-native-gesture-handler"` must be line 1 of the entry file.** Not line 2. Not after another import. This is non-negotiable.
- **All four wrappers are required, in this order:** `GestureHandlerRootView → SafeAreaProvider → CometChatThemeProvider → CometChatProvider`. Omitting any of them breaks gestures, safe areas, theming, or login state — and it fails silently in dev.
- **Login API is `CometChatUIKit.login({ uid })` or `CometChatUIKit.login({ authToken })`** — same method, different object key. There is no `loginWithAuthToken`. Passing a bare string like `login("cometchat-uid-1")` silently fails on RN.

### Angular only

- **`CUSTOM_ELEMENTS_SCHEMA` is required** in any NgModule that hosts CometChat components. Kit atom elements (`<cometchat-avatar>`, `<cometchat-status-indicator>`, `<cometchat-badge>`, etc.) are LitElement web components, not Angular standalone modules — without the schema Angular throws `Can't bind to '...'`. The schema goes in the module's `schemas: [CUSTOM_ELEMENTS_SCHEMA]` array, not in `imports`.
- **Credentials live in `src/environments/environment.ts`, NOT `.env`.** Angular bundles `environment.ts` at compile time; there is no runtime `.env` lookup. The CLI's `provision setup --framework angular` writes a `.env` only as a credentials handoff — migrate the values into `environment.ts` (and `environment.prod.ts` minus the `authKey`) during integration.
- **Init runs through `APP_INITIALIZER`, not a wrapper component.** Angular has no React-style provider tree — `CometChatUIKit.init(settings)` must complete before any chat component renders. Wire it as `{ provide: APP_INITIALIZER, useFactory, deps: [...], multi: true }` in the root module.
- **Login API is `CometChatUIKit.login({ uid })` (object form), NOT a bare string.** Same shape as the React Native UI Kit. Calling `CometChatUIKit.login("cometchat-uid-1")` silently fails on Angular too — always pass the credentials object: `login({ uid })` for dev, `login({ authToken })` for production.
- **Events are `[onX]` Input callbacks, not `(onX)` Output bindings.** The Angular UI Kit declares almost no `@Output` — events like `onSendButtonClick`, `onAccept`, `onItemClick` are `@Input()` callback functions. Writing `(onAccept)="handleAccept()"` silently no-ops or fails template type checking.
- **`[messagesRequestBuilder]` is plural.** `[messageRequestBuilder]` (singular) on `<cometchat-message-list>` silently no-ops — the input doesn't exist.
- **Match the kit's `auxilaryButtonView` typo** on `<cometchat-message-composer>` (missing first 'i'). The corrected spelling `auxiliaryButtonView` does not exist in the kit and silently no-ops.
- **`CometChatThemeService` is the v4 theme entry point**, NOT the legacy v3 `CometChatTheme` class. Inject the service; access `themeService.theme` for palette/typography control.

### Android only

- **Never mix V5 and V6 artifacts.** `chat-uikit-android:5.x` and `chatuikit-{compose,kotlin}-android:6.x` are different SDKs with different package paths, theme systems, and APIs. The dispatcher routes by `android_version`; treat the cohort as a hard switch.
- **V5 app theme must inherit from `CometChatTheme.DayNight`** — the kit itself parents on `Theme.MaterialComponents.DayNight.NoActionBar` (Material 2). Using `Theme.AppCompat.*` or `Theme.Material3.*` triggers `UnsupportedOperationException: Failed to resolve attribute` at inflate time. V6 has no equivalent rule — Compose uses `CometChatTheme { … }`, Kotlin Views uses kit-defined style attrs.
- **Init in `Application.onCreate()`, not in an Activity.** `CometChatUIKit.init(context, settings, callback)` must complete before any chat View / Composable inflates. Wire `login(...)` inside the init success callback. The `<application android:name=".MyApp">` registration in `AndroidManifest.xml` is non-negotiable.
- **Credentials live in `local.properties` + `BuildConfig`, NOT `.env`.** Android has no runtime `.env` lookup; surface secrets via `buildConfigField` and read `BuildConfig.COMETCHAT_APP_ID` etc. in code. The CLI's `provision setup --framework android` writes a `.env` only as a credentials handoff — migrate during integration.
- **`INTERNET` permission is mandatory.** Without it, the SDK silently fails to connect — no error, no symptom except missing data.
- **V5 thread-mode method asymmetry.** `CometChatMessageList` uses `setParentMessage(long)` (no `Id` suffix). `CometChatMessageComposer` uses `setParentMessageId(long)`. Different methods on different classes — the same value, two names. Never use `setParentMessageId` on the list.
- **V5 extensions: registrar vs decorator.** `setExtensions(...)` accepts registrars (`PollsExtension`, `StickerExtension`, `SmartRepliesExtension` — extending `ExtensionsDataSource`). NEVER add `*ExtensionDecorator` instances directly — they extend `DataSourceDecorator` and won't compile in a `List<ExtensionsDataSource>`. The decorator chain is built by the registrar's `enable()` method internally.
- **V6 Kotlin Views — `setOnItemClick`, NOT `setOnItemClickListener`.** The kit doesn't expose `*Listener`-suffixed setters; use the bare callback name. Same for other V6 setters — check the actual View class before guessing.
- **V6 reaction list takes `baseMessage`, not `message`.** `CometChatReactionList(baseMessage = ...)` (Compose) or `reactionList.setBaseMessage(...)` (Kotlin Views). The bare `message` param/setter doesn't exist in V6.
- **Push notifications: `CometChatNotifications.registerPushToken/unregisterPushToken` is the only public surface.** Sample-app helpers like `CometChatVoIP`, `FCMService`, `FCMMessageDTO` are NOT exported from `chatuikit-*` artifacts — they live in the master sample apps. Copy the pattern; don't import them as kit classes.
- **R8/ProGuard rule for release.** Add `-keep class com.cometchat.** { *; }` to `proguard-rules.pro`. Without it, release builds strip kit classes and crash with `ClassNotFoundException`.

### Flutter only

- **Never mix V5 and V6 packages.** `cometchat_chat_uikit:^5.2` (V5, GetX-based, calls in a separate `cometchat_calls_uikit:^5.0` package) and `cometchat_chat_uikit:^6.0.0-beta2` (V6, Bloc-based, calls bundled in) are different SDKs with different state-management primitives, theme APIs, and barrel exports. The skills target one cohort each — pick V5 for production, V6 for beta evaluation, never both.
- **V5 has TWO barrels; V6 has ONE.** V5 chat widgets (`CometChatConversations`, `CometChatMessageList`, `CometChatMessageComposer`) are reachable ONLY through `package:cometchat_chat_uikit/cometchat_chat_uikit.dart`. The calls package barrel re-exports `cometchat_uikit_shared` + `cometchat_sdk` + `cometchat_calls_sdk` but NOT `cometchat_chat_uikit` — using only the calls import will fail to resolve chat widgets. V6 ships a single package, so the chat barrel covers both chat AND calls.
- **`subscriptionType` is required on `UIKitSettingsBuilder`.** Omitting it silently disables presence and typing-indicator events — no error is thrown, just no presence updates. Always set `..subscriptionType = CometChatSubscriptionType.allUsers` (or `..forFriends` / `..forRoles`).
- **`CometChatUIKit.login(uid)` takes a String, not an object.** Both V5 and V6 use the bare-string form for dev login. For production: `CometChatUIKit.loginWithAuthToken(token, ...)`.
- **Cache theme values in `didChangeDependencies()`, not `build()`.** `CometChatThemeHelper.getColorPalette(context)` allocates and resolves tokens on every call — running it in `build()` causes jank during keyboard animations and theme changes.
- **Listener IDs must be unique + removed in `dispose()`.** Hardcoded listener IDs collide across screens; missing `dispose()` removal leaks listeners across navigations. Use a per-instance ID and remove it on teardown.
- **Credentials live in a Dart const file or `--dart-define`, NOT `.env`.** Flutter doesn't read `.env` at runtime; the CLI's `provision setup --framework flutter` writes a `.env` only as a credentials handoff — migrate during Step 5.
- **`ComponentToggles` and `CallScreenOverlay` do not exist in V6.** Per-widget feature flags (e.g. `disableReactions`, `hideReplyInThreadOption`) replace v5's `BuilderSettings`. In-call UI is `CometChatOngoingCall` widget + `CometChatDisplayIncomingCallOverlay`, not an overlay class with `.show()`.
- **AI widget availability varies across V6 betas.** Some AI widgets (`CometChatAIAssistantChatHistory`, `CometChatAIConversationSummary`) are exported in `6.0.0-beta2`; others may not be. If an import errors with "undefined name", the symbol isn't in that beta. Drive AI features via dashboard-enabled extensions for the most stable path — the kit surfaces AI replies/summaries inside the existing message list and composer regardless.
- **V6 conversations slot signatures are asymmetric.** `subtitleView` / `leadingView` / `titleView` take `(BuildContext, Conversation)` (two-arg). `trailingView` and `listItemView` take just `(Conversation)` (single-arg). Match the source — guessing one shape across all four breaks template type-checking. See `cometchat-flutter-v6-conversations` for the example.
- **`PNRegistry` is sample-app code, not a kit API.** The kit's only public push surface is `CometChatNotifications.registerPushToken(token, providerId, platform)` and `unregisterPushToken()`. Use the kit API directly, or copy the sample-app `PNRegistry` helper into your project.

### iOS only

- **No `CometChatMessages` / `CometChatConversationsWithMessages` / `CometChatDetails` exist.** These look like "pre-built composite UIViewControllers" but the kit doesn't ship them. Build your own `MessagesVC` by composing `CometChatMessageHeader` + `CometChatMessageList` + `CometChatMessageComposer` (sample app: `SampleApp/View Controllers/CometChat Components/MessagesVC.swift`). Same for details — compose your own.
- **Init completion uses Swift's standard `Result<Bool, Error>`** (`case .success` / `case .failure`), NOT the kit's `.success`/`.onError` enum that only appears in login/logout callbacks. The `CometChatUIKit(uiKitSettings:)` and `CometChatUIKit.init(uiKitSettings:)` forms are identical in Swift; both compile and the kit's sample apps use the explicit `.init` form.
- **Login result switches on `.success` / `.onError`** — NOT Swift's `.failure`. The kit ships its own `Result`-shaped enum for login callbacks. Add `@unknown default: break` to silence the compiler warning.
- **App theme parent is irrelevant on iOS** — but pod-side: Xcode 15+ requires `ENABLE_USER_SCRIPT_SANDBOXING = NO` in Build Settings (or the `post_install` Podfile hook). Without it, the resource-bundle build phase silently fails and assets/strings load empty at runtime.
- **`pod 'CometChatUIKitSwift', '~> 5.1'`**, NOT `~> 5.0` — the binary target ships at 5.1.x (5.1.12 at last verification); the older pin would resolve to a stale subrelease.
- **`CometChatLocalize.set(key:value:)` does not exist.** Public API is locale-only: `set(locale: Language)` / `set(locale: String)`. Override individual keys via your app's `Localizable.strings` instead.
- **`CometChatTypography.setFont(name:)` is a class func**, not a settable `fontFamily` property. `CometChatTypography.fontFamily = "Avenir"` does not compile.
- **`CometChatGroupMembers()` takes zero args**; pass the group via `set(group:)`. There is no `CometChatGroupMembers(group:)` initializer.
- **`CometChatCallButtons(width:height:)` requires explicit dimensions**; there is no zero-arg initializer.
- **`CometChatThreadHeader` does NOT exist** — the real class is `CometChatThreadedMessageHeader`.
- **Avatar `cornerRadius` is a `CGFloat` on a `CometChatCornerStyle` struct** — there is no `.circle` enum case. For a circular avatar, set a value larger than half the dimension.
- **`hideSearch` defaults to `true`** on `CometChatUsers` / `CometChatGroups` / `CometChatConversations` (inherited from `CometChatListBase`). To SHOW the built-in search bar, set `vc.hideSearch = false` — the search bar is hidden out of the box, which catches developers expecting it to render automatically.
- **Open the `.xcworkspace`, not the `.xcodeproj`, when CocoaPods is in use.** Opening the bare project skips the `Pods` workspace and Build Settings will show "no such module 'CometChatUIKitSwift'" at compile time.

## Error handling

If the CLI's `--json` output includes `human_message` / `suggestion` fields, show those to the user. Then show the raw `error` in parentheses for debuggability. If `retryable: false`, do NOT offer a retry.

For RN: if a command errors (e.g., `pod install` fails, `npx expo install` fails), surface the raw error output and consult `cometchat-native-troubleshooting` for the relevant triage table before retrying. Don't loop silently.

If the user's project is bare RN with `ios/` and `android/` but no `package.json` scripts for `ios`/`android` (common when React Native was added incrementally to an existing native app), flag that and pause. Writing integration code won't help if the app can't build.

## Optional: docs MCP

For deeper component customization:
```
claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp
```

Not required for integration or Phase B CLI flows.

## Skill routing reference

### Web family

| Skill | When to load |
|---|---|
| `cometchat-core` | Always — before any integration code |
| `cometchat-components` | Always — before writing component code |
| `cometchat-placement` | When integrating — for placement patterns |
| `cometchat-react-patterns` | framework = reactjs |
| `cometchat-nextjs-patterns` | framework = nextjs |
| `cometchat-react-router-patterns` | framework = react-router |
| `cometchat-astro-patterns` | framework = astro |
| `cometchat-theming` | When customizing themes |
| `cometchat-features` | When adding features |
| `cometchat-customization` | When writing custom formatters, events, request-builder filters |
| `cometchat-production` | When setting up production auth |
| `cometchat-troubleshooting` | When diagnosing problems |

### React Native family

| Skill | When to load |
|---|---|
| `cometchat-native-core` | Always — before any integration code |
| `cometchat-native-components` | Always — before writing component code |
| `cometchat-native-placement` | When integrating — for placement patterns |
| `cometchat-native-expo-patterns` | framework = expo (managed + Expo Router) |
| `cometchat-native-bare-patterns` | framework = react-native (bare CLI) |
| `cometchat-native-theming` | When customizing themes |
| `cometchat-native-features` | When adding features |
| `cometchat-native-customization` | When writing custom text formatters, events, request-builder filters, or DataSource decorators |
| `cometchat-native-production` | When setting up production auth or user management |
| `cometchat-native-push` | When setting up push notifications |
| `cometchat-native-testing` | When adding tests |
| `cometchat-native-troubleshooting` | When diagnosing problems |

### Angular family

| Skill | When to load |
|---|---|
| `cometchat-angular-core` | Always — before any integration code |
| `cometchat-angular-components` | Always — before writing component code |
| `cometchat-angular-placement` | When integrating — for placement patterns (route, modal, drawer, embed) |
| `cometchat-angular-patterns` | framework = angular — module organization, lazy loading, environment files |
| `cometchat-angular-theming` | When customizing themes (`CometChatThemeService`) |
| `cometchat-angular-features` | When adding features (calls, polls, reactions, AI, extensions) |
| `cometchat-angular-customization` | When writing custom views via content projection, `<ng-template>` slots, DataSource decorators |
| `cometchat-angular-production` | When setting up production auth (server-minted auth tokens) or user management |
| `cometchat-angular-troubleshooting` | When diagnosing problems (build errors, schema errors, Zone.js issues) |

### Android V5 family (live — `chat-uikit-android:5.x`)

| Skill | When to load |
|---|---|
| `cometchat-android-v5` | Dispatcher entry — `android_version === "v5"` |
| `cometchat-android-v5-core` | Always — Gradle deps, `UIKitSettings.UIKitSettingsBuilder`, init/login, theme parent |
| `cometchat-android-v5-components` | Always — View class catalog (`CometChatConversations`, `CometChatMessageList`, …) |
| `cometchat-android-v5-placement` | When integrating — Activity / Fragment / BottomSheet placement |
| `cometchat-android-v5-theming` | When customizing themes — colors.xml, theme attrs, dark mode |
| `cometchat-android-v5-features` | When adding features — calls, reactions, polls, AI, extensions |
| `cometchat-android-v5-customization` | When writing custom Views, message templates, `CometChatTextFormatter`, event listeners |
| `cometchat-android-v5-extensions` | When working with extensions (`PollsExtension` / `StickerExtension` registrars + custom decorator pattern) |
| `cometchat-android-v5-production` | When setting up production auth (server-minted auth tokens) or user management |
| `cometchat-android-v5-push` | When setting up push notifications (FCM, token lifecycle, deep-link) |
| `cometchat-android-v5-testing` | When adding tests (Espresso, Robolectric, mocking the kit/SDK) |
| `cometchat-android-v5-troubleshooting` | When diagnosing problems (Gradle, manifest, ProGuard, lifecycle) |

### Android V6 family (beta — `chatuikit-{compose,kotlin}-android:6.x`)

| Skill | When to load |
|---|---|
| `cometchat-android-v6` | Dispatcher entry — `android_version === "v6"` |
| `cometchat-android-v6-core` | Always — Gradle deps, init, login, message sending |
| `cometchat-android-v6-events` | Always — `CometChatEvents` SharedFlows + sealed event classes |
| `cometchat-android-v6-builder-settings` | When configuring `UIKitSettingsBuilder` (calling, presence, etc.) |
| `cometchat-android-v6-features` | When adding features — calls, reactions, polls, AI agent, extensions |
| `cometchat-android-v6-extensions` | When working with extensions / DataSource interfaces |
| `cometchat-android-v6-production` | When setting up production auth or user management |
| `cometchat-android-v6-push` | When setting up push notifications |
| `cometchat-android-v6-testing` | When adding tests (Espresso, Compose UI tests, Robolectric, mocking) |
| `cometchat-android-v6-troubleshooting` | When diagnosing problems (Gradle, Compose runtime, R8, BuildConfig) |
| `cometchat-android-v6-compose-components` | UI stack = Compose — Composable component catalog |
| `cometchat-android-v6-compose-placement` | UI stack = Compose — NavHost, modal, bottom sheet placement |
| `cometchat-android-v6-compose-theming` | UI stack = Compose — `CometChatTheme { … }`, `LocalColorScheme`/`LocalTypography` |
| `cometchat-android-v6-compose-customization` | UI stack = Compose — `BubbleFactory`, slot lambdas, custom Composables |
| `cometchat-android-v6-kotlin-components` | UI stack = Kotlin Views — custom View class catalog |
| `cometchat-android-v6-kotlin-placement` | UI stack = Kotlin Views — Activity / Fragment / BottomSheet placement |
| `cometchat-android-v6-kotlin-theming` | UI stack = Kotlin Views — style attrs, colors.xml, dark mode |
| `cometchat-android-v6-kotlin-customization` | UI stack = Kotlin Views — custom Views, `BubbleFactory` abstract class, `setBubbleFactories` |

### Flutter V5 family (live — `cometchat_chat_uikit:^5.2`)

| Skill | When to load |
|---|---|
| `cometchat-flutter-v5` | Dispatcher entry — `flutter_version === "v5"` |
| `cometchat-flutter-v5-core` | Always — pubspec deps, init/login, GetX patterns, theme caching, listener lifecycle |
| `cometchat-flutter-v5-conversations` | When integrating — `CometChatConversations` widget |
| `cometchat-flutter-v5-messages` | When integrating — `CometChatMessages`, `CometChatMessageList`, `CometChatMessageComposer`, `CometChatMessageHeader`, threads |
| `cometchat-flutter-v5-users-groups` | When integrating — `CometChatUsers`, `CometChatGroups`, `CometChatGroupMembers` |
| `cometchat-flutter-v5-calls` | When adding voice/video — `CometChatCallButtons`, `CometChatIncomingCall`, `CometChatOutgoingCall`, `CometChatOngoingCall`, `CometChatCallLogs` |
| `cometchat-flutter-v5-theming` | When customizing themes — `CometChatThemeHelper`, `CometChatColorPalette`, dark mode |
| `cometchat-flutter-v5-customization` | When writing custom bubbles, templates, formatters, slot views, DataSource decorators |
| `cometchat-flutter-v5-events` | When subscribing to SDK events (`CometChatMessageEvents`, etc.) |
| `cometchat-flutter-v5-production` | When setting up production auth (server-minted tokens) and ProGuard |
| `cometchat-flutter-v5-push` | When setting up FCM / APNs / VoIP push |
| `cometchat-flutter-v5-troubleshooting` | When diagnosing problems (pubspec, GetX, Pod errors, runtime crashes) |

### Flutter V6 family (beta — `cometchat_chat_uikit:^6.0.0-beta2`)

| Skill | When to load |
|---|---|
| `cometchat-flutter-v6` | Dispatcher entry — `flutter_version === "v6"` |
| `cometchat-flutter-v6-core` | Always — pubspec deps, init/login, message sending |
| `cometchat-flutter-v6-components` | Always — Bloc-driven widget catalog |
| `cometchat-flutter-v6-conversations` | When integrating `CometChatConversations` (Bloc, request builder, callbacks) |
| `cometchat-flutter-v6-messages` | When integrating `CometChatMessages`, list/header/composer composition |
| `cometchat-flutter-v6-users-groups` | When integrating `CometChatUsers`/`CometChatGroups`/`CometChatGroupMembers` |
| `cometchat-flutter-v6-calls` | When adding voice/video — incoming/outgoing/ongoing screens |
| `cometchat-flutter-v6-features` | When adding features — calls, polls, reactions, AI, extensions |
| `cometchat-flutter-v6-placement` | When deciding placement — route, modal sheet, embedded widget |
| `cometchat-flutter-v6-theming` | When customizing themes — `CometChatThemeHelper`, `CometChatColorPalette`, light/dark schemes |
| `cometchat-flutter-v6-customization` | When writing bubble factories, message templates, text formatters, slot widgets |
| `cometchat-flutter-v6-events` | When subscribing to Bloc-based event streams |
| `cometchat-flutter-v6-production` | When setting up production auth and external-backend recipes |
| `cometchat-flutter-v6-troubleshooting` | When diagnosing problems (pubspec, Bloc, theme cache, build errors) |
| `cometchat-flutter-v6-migration` | When migrating from V5 — GetX → Bloc, theme API rewrite, breaking changes |

### iOS family (V5 stable — `CometChatUIKitSwift:~> 5.1`)

iOS only ships V5 today; no V6 beta yet. When V6 lands, this section will fork like Android and Flutter do.

| Skill | When to load |
|---|---|
| `cometchat-ios` | Dispatcher entry — `framework === "ios"` |
| `cometchat-ios-core` | Always — Installation (CocoaPods + SPM), `UIKitSettings` builder, `CometChatUIKit(uiKitSettings:)` constructor init, login order |
| `cometchat-ios-components` | Always — UIViewController + SwiftUI view catalog, custom `MessagesVC` composition pattern |
| `cometchat-ios-placement` | When integrating — UINavigationController, modal, tab bar, embedded view, SwiftUI hosting |
| `cometchat-ios-theming` | When customizing themes — `CometChatTheme` color tokens, `CometChatTypography.setFont(name:)`, dark mode |
| `cometchat-ios-customization` | When writing custom message templates, formatters, DataSource decorators, custom views |
| `cometchat-ios-features` | When adding features — calls, polls, reactions, AI, extensions |
| `cometchat-ios-production` | When setting up production auth (server-minted auth tokens) and user management |
| `cometchat-ios-push` | When setting up APNs + VoIP push, CallKit |
| `cometchat-ios-troubleshooting` | When diagnosing problems — SPM/CocoaPods errors, Xcode build issues, Info.plist, runtime crashes |
