---
name: cometchat-native-core
description: "Shared rules for CometChat React Native UI Kit v5. Always loaded alongside framework (expo/bare) and placement skills. Read this first."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5; @cometchat/chat-sdk-react-native ^4"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat react-native core rules initialization provider theming"
---

## Purpose

This is the foundational skill for every CometChat React Native UI Kit v5 integration. It teaches Claude HOW CometChat works on RN — initialization order, provider wrapper chain, login, env vars, auth tokens, and the anti-patterns that break real apps.

**Read this skill first, before any framework (`cometchat-native-expo-patterns` / `cometchat-native-bare-patterns`) or placement skill.**

Ground-truth sources: `docs/ui-kit/react-native/overview.mdx`, `react-native-cli-integration.mdx`, `expo-integration.mdx`, `methods.mdx`, and `@cometchat/chat-uikit-react-native@5.3.8`'s `src/index.ts` (file-based `initFromSettings` GA). **Official docs:** https://www.cometchat.com/docs/ui-kit/react-native/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).

---

## 1. The init-login-render order

CometChat has exactly one valid lifecycle on React Native:

```
CometChatUIKit.init(settings)   →   CometChatUIKit.login({ uid })   →   render <CometChat*> components
```

Breaking this order produces a blank screen, a "CometChat is not initialized" runtime error, or a hung login. No exceptions.

### File-based init with `cometchat-settings.json` (recommended)

> **Version requirement (ENG-35866 — Skills Telemetry).** `CometChatUIKit.initFromSettings(settings)` reads a `cometchat-settings.json` object and lets the SDK self-report `integrationSource = "ai-agent"` to `/user_sessions`. It ships GA in **`@cometchat/chat-uikit-react-native >= 5.3.8`** + **`@cometchat/chat-sdk-react-native >= 4.0.25`** (npm `latest`). On an older UI Kit the method does not exist — use the flat-object `init()` **fallback** below.

**Step 1 — create `cometchat-settings.json` at the project root.** Fill `appId` / `region` / `credentials.authKey` from the CLI `provision setup` output; leave everything else at the defaults below. Single source of credentials — no second copy to keep in sync.

```json
{
  "appId": "APP_ID_HERE",
  "region": "us",
  "credentials": {
    "authKey": "AUTH_KEY_HERE"
  },
  "chatSDK": {
    "presenceSubscription": {
      "type": "ALL_USERS",
      "roles": []
    },
    "autoEstablishSocketConnection": true,
    "adminHost": null,
    "clientHost": null
  },
  "callsSDK": {
    "host": null,
    "adminHost": null,
    "clientHost": null,
    "callsHost": null
  },
  "uiKit": {
    "subscribePresenceForAllUsers": true
  }
}
```

**Step 2 — init by importing the JSON.** Metro bundles JSON imports natively (no extra config), so the file is read at build time exactly like the web kit:

```tsx
// initFromSettings ships GA in @cometchat/chat-uikit-react-native >= 5.3.8 (ENG-35866)
import { CometChatUIKit } from "@cometchat/chat-uikit-react-native";
import cometchatSettings from "../cometchat-settings.json"; // adjust path to the file's location

await CometChatUIKit.initFromSettings(cometchatSettings);
// then: CometChatUIKit.login({ uid }) — see §2
```

- **Do NOT gitignore `cometchat-settings.json`.** The dev-mode `authKey` ships in the JS bundle either way; production integrations use server-minted auth tokens.
- The init-once flag + "init before first render" rules below apply unchanged — just swap the `init({...})` call for `initFromSettings(cometchatSettings)`.

### UIKitSettings — the init object (fallback — UI Kit before file-based init)

The v5 RN UI Kit's `init()` takes a flat `UIKitSettings` object (NOT a `UIKitSettingsBuilder` like the web kit). Pass fields directly:

```tsx
import { CometChatUIKit } from "@cometchat/chat-uikit-react-native";

await CometChatUIKit.init({
  appId: APP_ID,                  // Required — from the CometChat dashboard
  region: REGION,                 // Required — "us" | "eu" | "in"
  authKey: AUTH_KEY,              // Required for dev mode. Omit in production.
  subscriptionType: "ALL_USERS",  // Optional — "NONE" | "ALL_USERS" | "ROLES" | "FRIENDS"
});
```

**⚠️ `UIKitSettingsBuilder` does NOT exist in the v5 React Native UI Kit.** That's a web-kit pattern. RN expects the flat object. If an agent imports `UIKitSettingsBuilder` from `@cometchat/chat-uikit-react-native`, the import resolves to `undefined` and `new UIKitSettingsBuilder()` throws at runtime.

Other valid `UIKitSettings` fields (all optional): `autoEstablishSocketConnection`, `overrideAdminHost`, `overrideClientHost`, `disableCalling`, `extensions`, `roles`, `callingExtension`. The full type is exported from the package as `UIKitSettings`; check the installed kit's type defs (`node_modules/@cometchat/chat-uikit-react-native`) if you need the exact shape.

### Init must happen once

Use a module-level flag to prevent double-init. React re-mounts in dev (strict mode, fast refresh, and navigation nesting all trigger effect re-fires):

```tsx
let initialized = false;

async function initCometChat(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Fail loud if env vars didn't load (EXPO_PUBLIC_* not set, or a config
  // module returning undefined). Empty creds otherwise surface later as a
  // cryptic init/login failure that's hard to trace. (audit P0-5)
  if (!APP_ID || !REGION || !AUTH_KEY) {
    throw new Error(
      "CometChat credentials are empty — check your EXPO_PUBLIC_* env (or config module) " +
        "and restart Metro with --reset-cache after editing it.",
    );
  }

  await CometChatUIKit.init({
    appId: APP_ID,
    region: REGION,
    authKey: AUTH_KEY,
    subscriptionType: "ALL_USERS",
  });
}
```

### Init must run before first render

Put the init call in a top-level `useEffect` (preferred — the provider pattern in section 6 does this) or in `App.tsx` before the initial navigator mounts. Avoid calling `init()` in a screen's effect — by the time the screen mounts, the app has already tried to render components that expect init to be done.

---

## 2. Login

### Development mode

```tsx
let user;
try {
  user = await CometChatUIKit.getLoggedInUser();
} catch (e: any) {
  if (e?.code !== "NOT_FOUND") throw e;   // no-session is the expected "first run" path
}
if (!user) {
  await CometChatUIKit.login({ uid: "cometchat-uid-1" });  // note: OBJECT form
}
```

**⚠️ `getLoggedInUser()` THROWS `code: "NOT_FOUND"` when there's no session** — it does NOT return `null`. An uncaught throw here is the #1 cause of "app stuck on splash screen" — the provider's `setReady(true)` never fires. Always wrap in try/catch and treat `NOT_FOUND` as the normal first-run path. (Validated on `@cometchat/chat-uikit-react-native@5.3.5`, kit source `CometChatUIKit.getLoggedInUser`.)

**⚠️ `login()` takes an object `{ uid: "..." }` on React Native**, not a bare string like on the web. Passing `"cometchat-uid-1"` directly silently fails.

Every new CometChat app ships 5 pre-seeded test users — `cometchat-uid-1` through `cometchat-uid-5`. Use one for development.

### ⚠️ `login()` is safe sequentially, NOT concurrently

A second `login()` call fired while the first is in-flight throws *"Please wait until the previous login request ends."* Classic trap in React Native because:

- React strict mode double-mounts effects
- `react-navigation` remounts screens on tab switches
- Fast Refresh triggers effect re-runs in dev

Guard with a module-level in-flight promise, same pattern as the web skill:

```tsx
let loginInFlight: Promise<unknown> | null = null;

async function ensureLoggedIn(uid: string, authToken?: string): Promise<void> {
  let existing;
  try {
    existing = await CometChatUIKit.getLoggedInUser();
  } catch (e: any) {
    if (e?.code !== "NOT_FOUND") throw e;   // first-run path
  }
  if (existing) return;
  if (loginInFlight) {
    await loginInFlight;   // reuse the pending promise
    return;
  }
  loginInFlight = authToken
    ? CometChatUIKit.login({ authToken })
    : CometChatUIKit.login({ uid });
  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}
```

Call `ensureLoggedIn()` from the provider / effect. Both mounts resolve against the same promise; only one login request hits the server.

### Production mode

Use `CometChatUIKit.login({ authToken })` with a token from your backend. The backend generates the token with the CometChat REST API using the server-only **REST API Key** (not the client-side Auth Key). See `cometchat-native-production` for the server-side token endpoint patterns.

### Logout

```tsx
await CometChatUIKit.logout();
```

Clears the local CometChat session. Call from your app's sign-out handler.

---

## 3. Provider wrapper chain (mandatory order)

Every CometChat RN app has this wrapper chain at the root. Missing wrappers cause silent layout breakage, broken gestures, or hard crashes — each wrapper is required by a specific RN ecosystem piece the UI Kit depends on.

```tsx
// App.tsx (bare) or the root of your Expo app
import "react-native-gesture-handler";   // MUST be the first import
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CometChatThemeProvider } from "@cometchat/chat-uikit-react-native";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CometChatThemeProvider>
          <CometChatProvider>    {/* your own init/login provider — see section 6 */}
            <AppNavigator />
          </CometChatProvider>
        </CometChatThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Why each wrapper is mandatory:

| Wrapper | Required because |
|---|---|
| `import "react-native-gesture-handler"` (at the very top of entry) | RNGH patches the global gesture system; must happen before any screen renders. |
| `<GestureHandlerRootView style={{ flex: 1 }}>` | Message composer swipe actions, attachment sheet drags, modal swipe-to-dismiss all use RNGH. No wrapper → gestures silently disabled. |
| `<SafeAreaProvider>` | UI Kit headers + bottom-sheets respect safe-area insets. Missing → content overlaps status bar / home indicator. |
| `<CometChatThemeProvider>` | Provides the JS theme context. UI Kit components read colors / fonts / styles from here. Missing → components throw or render with fallback styles that may look broken. |
| Your own `<CometChatProvider>` | Wraps the `init` + `login` lifecycle in React state so child components can gate on `isReady`. Not optional — you can't render UI Kit components before init + login complete. |

The `cometchat-native-expo-patterns` and `cometchat-native-bare-patterns` skills show framework-specific nuances (Expo adds `expo-splash-screen`, bare adds pod setup), but the four-wrapper chain is fixed.

**Recommended: include `<CometChatI18nProvider>` as a fifth wrapper.** The kit's own SampleApp + SampleAppExpo always wrap `<CometChatI18nProvider>` between SafeAreaProvider and CometChatThemeProvider — even when the app is English-only. It's a no-op for default-locale apps and the wiring is identical to the other wrappers, so add it by default. The four-wrapper minimum is the strict floor; the five-wrapper shape is what every shipped sample uses. See `cometchat-native-theming § 9` for the full chain (gesture → safe-area → i18n → theme → provider) and localization config.

---

## 4. Environment variables

### Values to set

| Variable | Purpose | Client-exposed? |
|---|---|---|
| `APP_ID` | Dashboard App ID | Yes |
| `REGION` | `us` \| `eu` \| `in` | Yes |
| `AUTH_KEY` | Dev-mode login key — **never in production** | Yes (dev only) |
| `REST_API_KEY` | Server-side token generation — **server-only** | NO — server env only |

### Where they live

- **Bare RN**: `.env` at project root + a runtime reader like `react-native-config` or `babel-plugin-dotenv-import`. Access: `Config.APP_ID`.
- **Expo managed**: `app.json` `extra` section + read via `Constants.expoConfig?.extra?.APP_ID` from `expo-constants`. Or use `.env` with `expo-dotenv` / `expo-router`'s built-in support depending on SDK version. The `cometchat-native-expo-patterns` skill covers this in detail.

Do NOT bundle the `REST_API_KEY` into the client — RN bundles everything visible. Server endpoints live outside the RN app (Express / Hono / Cloud Functions); see `cometchat-native-production`.

### .env / extra example

```
# client-side (safe to ship in the RN bundle for dev mode)
APP_ID=your_app_id
REGION=us
AUTH_KEY=your_auth_key

# server-only (NEVER ship — used by your token endpoint)
# REST_API_KEY=your_rest_api_key
```

---

## 5. Android + iOS platform notes

The UI Kit is cross-platform, but a few concerns only apply to one target:

| Platform | Concern | Fix |
|---|---|---|
| iOS (bare) | Missing `pod install` after `npm install` | `cd ios && pod install` after adding or updating any CometChat dep |
| iOS | Apple privacy manifest (PrivacyInfo.xcprivacy) required since Xcode 15+ | See `docs/apple-privacy-manifest-guide.mdx`; copied into `cometchat-native-bare-patterns` |
| iOS | Microphone / camera / photo-library permissions in `Info.plist` for calls + media messages | `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription` strings |
| Android | Internet + read-media permissions in `AndroidManifest.xml` | `INTERNET`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `RECORD_AUDIO` (only what you need) |
| Both | Push notifications require the APNs + FCM dance — not automatic | Covered by `SampleAppWithPushNotifications` + `cometchat-native-troubleshooting` |

The framework skills (`cometchat-native-expo-patterns`, `cometchat-native-bare-patterns`) apply these platform settings with the right syntax for each workflow.

---

## 6. Provider pattern

Instead of inlining `init` + `login` in every component, create a reusable `CometChatProvider` that gates rendering on `isReady`. Drop it below `<CometChatThemeProvider>` in the wrapper chain.

```tsx
// CometChatProvider.tsx
import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CometChatUIKit } from "@cometchat/chat-uikit-react-native";

interface CometChatContextValue {
  isReady: boolean;
  error: string | null;
}

const CometChatContext = createContext<CometChatContextValue>({
  isReady: false,
  error: null,
});

export const useCometChat = () => useContext(CometChatContext);

// Module-level state — shared across all mounts
let initialized = false;
let loginInFlight: Promise<unknown> | null = null;

async function ensureLoggedIn(uid: string, authToken?: string): Promise<void> {
  let existing;
  try {
    existing = await CometChatUIKit.getLoggedInUser();
  } catch (e: any) {
    if (e?.code !== "NOT_FOUND") throw e;   // first-run path
  }
  if (existing) return;
  if (loginInFlight) {
    await loginInFlight;
    return;
  }
  loginInFlight = authToken
    ? CometChatUIKit.login({ authToken })
    : CometChatUIKit.login({ uid });
  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

interface CometChatProviderProps {
  appId: string;
  region: string;
  authKey?: string;
  authToken?: string;
  uid?: string;
  children: ReactNode;
}

export function CometChatProvider({
  appId,
  region,
  authKey,
  authToken,
  uid = "cometchat-uid-1",
  children,
}: CometChatProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        if (!initialized) {
          initialized = true;
          await CometChatUIKit.init({
            appId,
            region,
            authKey,
            subscriptionType: "ALL_USERS",
          });
        }
        await ensureLoggedIn(uid, authToken);
        setIsReady(true);
      } catch (e) {
        setError(String(e));
      }
    }
    setup();
  }, [appId, region, authKey, authToken, uid]);

  if (error) {
    return null;  // or your app's error boundary — don't render CometChat components
  }
  if (!isReady) {
    return null;  // or a splash / loading screen
  }

  return (
    <CometChatContext.Provider value={{ isReady, error }}>
      {children}
    </CometChatContext.Provider>
  );
}
```

Children of `<CometChatProvider>` can use `useCometChat()` to check `isReady` — useful if some UI wants to render before chat is ready.

---

## 7. Anti-patterns

1. **Do NOT call `CometChatUIKit.init()` during render.** Init is async with side effects; calling during render triggers infinite re-renders. Always inside `useEffect` or before `createRoot` equivalent.

2. **Do NOT call `login("uid")` with a string.** RN's `login()` expects an object: `login({ uid: "..." })`. Passing a string silently no-ops.

3. **Do NOT skip the four-wrapper chain** (GestureHandlerRootView → SafeAreaProvider → CometChatThemeProvider → your provider). Each wrapper is required.

4. **Guard concurrent `login()` with a module-level in-flight promise.** `login()` is only safe sequentially. Two calls racing (React strict mode, tab remount, Fast Refresh) throw *"Please wait until the previous login request ends."*

5. **Do NOT hardcode `AUTH_KEY` in source files.** Use env vars for dev. Use `login({ authToken })` in production.

6. **Do NOT render CometChat components before `isReady`.** The provider's `isReady: false` branch should return `null` (or a splash), not try to render children.

7. **Do NOT re-initialize on navigation.** Init and login belong at app root, not per-screen. Re-init causes WebSocket churn and lost messages mid-switch.

8. **Do NOT invent component names.** Only use components exported from `@cometchat/chat-uikit-react-native`. See `cometchat-native-components` for the catalog.

9. **Do NOT forget `import "react-native-gesture-handler"` at the top of the entry file** (`App.tsx` or `index.js`). Without it, swipe gestures in the composer and bottom sheets silently disable.

10. **Do NOT bundle the REST API key.** It's server-only. Token generation happens on your backend; the RN client never sees it.

---

## 8. Docs MCP (recommended, not required)

The CometChat docs MCP gives runtime access to the most current RN UI Kit docs. Install:

```bash
claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp
```

Use the MCP to verify prop signatures, callback names, theme token names, or error message meanings before writing any non-obvious code. Everything the skills describe here is grounded in the docs — the MCP is how you double-check during generation.

Not required to install. The skills ship with the current truth baked in. The MCP is the fallback for edge cases and for upstream changes between skill releases.

---

## 9. Package dependencies

Minimum peer deps to install before the UI Kit works:

```bash
npm install \
  @cometchat/chat-sdk-react-native \
  @cometchat/chat-uikit-react-native \
  react-native-gesture-handler \
  react-native-safe-area-context \
  @react-native-clipboard/clipboard \
  react-native-svg \
  react-native-video \
  react-native-localize \
  punycode
```

> The kit's declared peer deps include `@react-native-clipboard/clipboard`, `react-native-svg`, `react-native-video`, and `react-native-localize` (it imports all four) — install them or the bundle fails at runtime. `react-native-safe-area-context` is also required (imported by several components) though not formally declared.

> **Why `punycode` — still REQUIRED on 5.3.7 (kit 5.3.7's markdown path needs it).** The kit's `CometChatAIAssistantMessageBubble` pulls in `react-native-markdown-display` → `markdown-it@^10` → `linkify-it@^2`, which does `require('punycode')`. **React Native / Metro does not bundle Node core modules**, so Metro can't resolve `punycode` unless you install the userland package → otherwise the bundle fails with `Unable to resolve module punycode`. (This is NOT version-gone-from-Node — it's RN not shipping Node core libs; affects any kit whose markdown/AI path is reachable, incl. 5.3.5 AND 5.3.7.) **Verified 2026-06-14 on a real `expo export`: Expo SDK 56 + RN 0.85.3 + kit 5.3.7 FAILED on `punycode` until the userland package was installed**, then bundled clean (5.5 MB Hermes). Keep `punycode` in the install list — it is load-bearing whenever any feature that renders markdown / the AI Assistant bubble is reachable.

> Note: `react-native-reanimated` is NOT a peer dependency of the kit (verified against `@cometchat/chat-uikit-react-native@5.x` `peerDependencies`). Add it only if your own app uses it for other animations.

Expo adds `expo-av` / `expo-image-picker` depending on which features you enable. Calls require the separate package PLUS the WebRTC native peers AND the polyfill peers the calls-sdk imports but doesn't declare:

```bash
npm install @cometchat/calls-sdk-react-native@^5 \
  @react-native-community/netinfo \
  react-native-callstats \
  react-native-webrtc \
  react-native-background-timer \
  react-native-url-polyfill \
  react-native-performance \
  valibot
```

> `@react-native-community/netinfo`, `react-native-callstats`, and `react-native-webrtc` are the WebRTC native peers; `react-native-background-timer`, `react-native-url-polyfill/auto`, and `react-native-performance` are imported at the top of the calls-sdk `dist/polyfills/browser.js`, and `valibot` is consumed deeper in the calls state machine. The polyfill peers + valibot are NOT in the calls-sdk `peerDependencies` array — they fail at bundle resolution if missing. (Validated 2026-05-26 on `@cometchat/calls-sdk-react-native@5.0.0`.) Then run `npx expo prebuild` (Expo) or `cd ios && pod install` (bare) so the native modules get autolinked into the next debug build. This mirrors the lists in `cometchat-native-features` / `cometchat-native-expo-patterns` / `cometchat-native-bare-patterns` — see `cometchat-native-calls` for full calls setup.

See `cometchat-native-features` for when to add the calls SDK.

---

## Skill routing reference

| Skill | When to load |
|---|---|
| `cometchat-native-core` | Always — before any integration code |
| `cometchat-native-components` | Always — before writing any `<CometChat*>` JSX |
| `cometchat-native-placement` | When integrating — for placement patterns |
| `cometchat-native-expo-patterns` | Framework = Expo managed |
| `cometchat-native-bare-patterns` | Framework = bare React Native |
| `cometchat-native-theming` | When customizing themes |
| `cometchat-native-features` | When adding features (calls / extensions / AI) |
| `cometchat-native-customization` | When customizing components (text formatters, events, DataSource) |
| `cometchat-native-production` | When setting up server-side auth + user management |
| `cometchat-native-troubleshooting` | When diagnosing build errors, runtime failures, permission issues |

## Visual Builder integration

When the dispatcher's Step 3.1 sets `customize=visual` and the framework maps to builder platform `react-native`, skills runs **`cometchat builder export --platform react-native`** — a single CLI command that downloads the canonical static template ZIP from `preview.cometchat.com/downloads/cometchat-builder-react-native.zip`, fetches the per-builder settings JSON via `GET /vcb/builders/{id}`, applies F3 + F10 missing-field defaults, and writes the result to `--output` (default: `src/config/`).

The canonical app uses a **Zustand-backed config store** (`src/config/store.ts`) that exposes `useConfig(selector)` — components read theme tokens and feature flags reactively. The exported `config.json` carries the **envelope shape** `{ builderId, name, type, createdAt, updatedAt, expiresAt, settings: { chatFeatures, callFeatures, layout, style, noCode, agent } }` — the store reads `config.settings.*` from it (verified 2026-06-14 against a live `builder export --platform react-native`). Theme tokens live under `settings.style` (`{ theme, color, typography }`) — there is **no `settings.theme`** key. `settings.agent` (`{ chatHistory, newChat, agentIcon, showAgentIcon }`) IS present (AI-agent config).

This is intentionally lighter than the React web copy (full `src/CometChat/` directory). The RN builder repo is a QR-driven sample with custom navigation that doesn't fit cleanly into the customer's existing navigator. So `builder export` extracts the **configuration plumbing only** (per the repo's own README §"Integration in Your Existing React Native App"), then skills writes a minimal wrapper that consumes the config in the customer's existing four-wrapper chain.

### 1. Run `cometchat builder export`

```bash
cometchat builder export --platform react-native --json
```

Defaults to `--output src/config/`. The command writes:

| File | Content |
|---|---|
| `src/config/store.ts` | Zustand store with full `AppConfig` typings, AsyncStorage persistence, `useConfig<T>(selector)` hook, `useConfigStore`. Verbatim from canonical ZIP. |
| `src/config/config.json` | **Envelope-shape JSON** `{ builderId, name, type, createdAt, updatedAt, expiresAt, settings: { chatFeatures, callFeatures, layout, style, noCode, agent } }`. There is **no `theme` key** (theme tokens live under `settings.style.{theme,color,typography}`); `settings.agent` (`{chatHistory,newChat,agentIcon,showAgentIcon}`) IS present (verified live 2026-06-14). Settings come from `GET /vcb/builders/{id}`. `inAppSounds` / `mentionAll` are **CLI-injected defaults** (not returned by the builder). **No SKILLS-AUTO-GENERATED sentinel** (JSON forbids `//` comments). |

Resync = re-run the same command with `--force` (full re-download + replace). See `cometchat-core` §11.6 for the resync contract.

### Files patched

| Path | Patch |
|---|---|
| `package.json` | `npm install zustand @react-native-async-storage/async-storage` — required by the copied `store.ts`. Then the normal `cometchat-native-{bare,expo}-patterns` deps (11 explicit peers on bare, `npx expo install` list on Expo). If `useConfig(state => state.settings.callFeatures.*).oneOnOne*` returns true, also add `@cometchat/calls-sdk-react-native@5.0.0` + the Cloudsmith `@cometchat/calls-lib-webrtc` tarball per `cometchat-native-calls`. |
| Entry — `App.tsx` (bare) / `app/_layout.tsx` (Expo Router) | Init UI Kit + wrap the provider chain (`SafeAreaProvider → SafeAreaView → CometChatThemeProvider → CometChatI18nProvider`) with `theme` derived from `useConfig`. Template below. |
| `App.tsx` line 1 (bare) / app entry (Expo Router) | Gesture-handler side-effect import. The reference app uses `import './gesture-handler';` (a local shim file) as the **first import in `App.tsx`** — not in `index.js`. Bare CLI projects without that shim use `import 'react-native-gesture-handler';` instead. Either form must be the top-of-file side-effect import. |
| `index.js` (bare) | App registration. The reference wraps `<App />` in `<AppErrorBoundary><ActiveChatProvider>` before `AppRegistry.registerComponent`. Preserve the customer's existing `index.js` registration; only add these wrappers if you also copy the corresponding files. |
| `src/utils/AppConstants.tsx` (canonical pattern) OR `.env` (Step 2c convention) | Credentials. Skills writes the canonical path the customer already had from §2 (Expo: `process.env.EXPO_PUBLIC_*`; bare: `@env` via `react-native-dotenv`). |
| `ios/Podfile` + `ios/<App>/Info.plist` (bare) or `app.json` plugins (Expo) | Camera + microphone usage descriptions if any `callFeatures.voiceAndVideoCalling.*` is true. |

### Entry-file init pattern (bare RN / Expo)

```tsx
// App.tsx
import './gesture-handler'; // line 1, before any other import — gesture-handler side-effect
                            // (bare CLI w/o the shim file: `import 'react-native-gesture-handler';`)
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  CometChatUIKit,
  UIKitSettings,
  CometChatThemeProvider,
  CometChatI18nProvider,
  CometChatTheme,
} from '@cometchat/chat-uikit-react-native';
import { CometChat } from '@cometchat/chat-sdk-react-native';
import type { DeepPartial } from '@cometchat/chat-uikit-react-native/src/shared/helper/types';

import { useConfig } from './src/config/store';
import RootStackNavigator from './src/navigation/RootStackNavigator'; // your existing navigator

// Map builder font name → platform-specific PostScript / asset name.
// Verbatim from the canonical `App.tsx` inside the React Native Visual Builder
// ZIP (download from https://preview.cometchat.com/downloads/cometchat-builder-react-native.zip).
const FONT_MAP: Record<string, { regular: string; medium: string; bold: string }> = {
  'times new roman': {
    regular: Platform.OS === 'ios' ? 'TimesNewRomanPSMT' : 'times_new_roman_regular',
    medium: Platform.OS === 'ios' ? 'TimesNewRomanPSMT' : 'times_new_roman_medium',
    bold: Platform.OS === 'ios' ? 'TimesNewRomanPS-BoldMT' : 'times_new_roman_bold',
  },
  inter: {
    regular: Platform.OS === 'ios' ? 'Inter-Regular' : 'inter_regular',
    medium: Platform.OS === 'ios' ? 'Inter-Medium' : 'inter_medium',
    bold: Platform.OS === 'ios' ? 'Inter-Bold' : 'inter_bold',
  },
  roboto: {
    regular: Platform.OS === 'ios' ? 'Roboto-Regular' : 'roboto_regular',
    medium: Platform.OS === 'ios' ? 'Roboto-Medium' : 'roboto_medium',
    bold: Platform.OS === 'ios' ? 'Roboto-Bold' : 'roboto_bold',
  },
};

export default function App() {
  const styleConfig = useConfig(state => state.settings.style);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // RN kit takes a FLAT UIKitSettings object — there is NO UIKitSettingsBuilder
    // on react-native (see §1; the builder is web-only). Using it throws
    // "UIKitSettingsBuilder is not a constructor".
    CometChatUIKit.init({
      appId: process.env.EXPO_PUBLIC_COMETCHAT_APP_ID!,
      region: process.env.EXPO_PUBLIC_COMETCHAT_REGION!,
      authKey: process.env.EXPO_PUBLIC_COMETCHAT_AUTH_KEY!,
      subscriptionType: "ALL_USERS",
    }).then(() => setIsReady(true)).catch(console.error);
  }, []);

  const fontKey = styleConfig.typography.font.toLowerCase().trim();
  const fontVariants = FONT_MAP[fontKey] ?? FONT_MAP.inter;

  const theme: { light: DeepPartial<CometChatTheme>; dark: DeepPartial<CometChatTheme> } = {
    light: {
      color: {
        primary: styleConfig.color.brandColor,
        textPrimary: styleConfig.color.primaryTextLight,
        textSecondary: styleConfig.color.secondaryTextLight,
      },
      typography: { fontFamily: fontVariants.regular },
    },
    dark: {
      color: {
        primary: styleConfig.color.brandColor,
        textPrimary: styleConfig.color.primaryTextDark,
        textSecondary: styleConfig.color.secondaryTextDark,
      },
      typography: { fontFamily: fontVariants.regular },
    },
  };

  if (!isReady) return null;

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <CometChatThemeProvider theme={theme}>
          <CometChatI18nProvider>
            <RootStackNavigator />
          </CometChatI18nProvider>
        </CometChatThemeProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
```

**Critical:**

- `useConfig(state => state.settings.style)` is the canonical hook — **not** a static `import` of the JSON. The store hydrates from AsyncStorage on first read; importing the JSON directly would freeze the initial values and skip QR-update / resync flows that may follow.
- `CometChatThemeProvider`'s `theme` prop takes a `{ light, dark }` object (NOT a string like `"dark"`). The string-form `theme="dark"` was a v4-era shape and was removed in `chat-uikit-react-native@5+`.
- The reference app's provider chain is `SafeAreaProvider → SafeAreaView → CometChatThemeProvider → CometChatI18nProvider`, and gesture-handler is wired as a **top-of-file side-effect import** (`import './gesture-handler';` on App.tsx line 1) — **not** as a `<GestureHandlerRootView>` wrapper. Match this. (If you deliberately add `<GestureHandlerRootView style={{ flex: 1 }}>` as the outermost wrapper for extra hardening, that is also valid — but it is not what the reference ships, so don't present it as required.) Skipping safe areas, theming, i18n, or the gesture-handler import breaks gestures, safe areas, theming, or i18n — and fails silently in dev.
- `CometChatUIKit.init(settings)` returns a Promise — `isReady` gate before render prevents `RootStackNavigator` from mounting chat components before init resolves.
- The canonical RN builder app also registers a `CometChat.addCallListener` at the App level (handles incoming calls / busy / cancelled / ended). When `callFeatures.voiceAndVideoCalling.*` is true, copy that listener block verbatim from the canonical `App.tsx` inside the React Native Visual Builder ZIP (download from https://preview.cometchat.com/downloads/cometchat-builder-react-native.zip) (look for `'app'` listener id).

### Feature flag access

Components throughout the customer's app can read flags reactively:

```tsx
const reactionsEnabled = useConfig(s => s.settings.chatFeatures.deeperUserEngagement.reactions);
const audioCallsEnabled = useConfig(
  s => s.settings.callFeatures.voiceAndVideoCalling.oneOnOneVoiceCalling,
);
```

Hide buttons / disable composer actions / skip mounting components based on these. The full `AppConfig` typings are in the copied `src/config/store.ts`.

### Resync flow

The "Re-sync visual builder" iteration menu option (see `cometchat/SKILL.md § Step 7`) is a one-command re-run:

```bash
cometchat builder export --platform react-native --force --json
```

`--force` is required (it explicitly authorizes replacing the existing `src/config/`). The command re-downloads the canonical static template, re-fetches the per-builder settings, and replaces the directory entirely.

Per the SKILLS-AUTO-GENERATED contract (see `cometchat-core` §11.6): customer hand-edits inside `src/config/` are lost on resync. Override via `App.tsx` (outside `src/config/`) or via the `useConfig` selector pattern documented in §"Theme derivation".

The customer reloads the dev build (`r` in Metro) — `useConfig` rehydrates from AsyncStorage on next mount.

### Calls + builder

> **Version note (intentional divergence):** the reference builder app `builder-apps/uikit-builder-app-react-native` still ships `@cometchat/calls-sdk-react-native@^4.3.0` (no `@cometchat/calls-lib-webrtc`; it uses `react-native-webrtc` directly). Skills intentionally targets **calls SDK v5** per the calls-v5-canonical policy. If you diff the reference app, don't "correct" the skill back to 4.3.0 — the v5 guidance below is deliberate.

If `callFeatures.voiceAndVideoCalling.*` is true:
1. Add `@cometchat/calls-sdk-react-native@5.0.0` + the Cloudsmith `@cometchat/calls-lib-webrtc` tarball (per `cometchat-native-calls`).
2. Wire `CometChat.addCallListener` + `CometChatUIEventHandler.addCallListener` in `App.tsx` — copy the listener block verbatim from the canonical app's `App.tsx`.
3. Mount `<CometChatIncomingCall>` between `<CometChatI18nProvider>` and `<RootStackNavigator>` when an `incomingCall` ref is set. The full pattern is in the canonical `App.tsx`.
4. Configure iOS PushKit + Android FCM data-message wiring — defer to `cometchat-native-push` and invoke it after the Visual Builder section completes.

### What is NOT honored in v1

`noCode.docked` (floating-widget shape) and `layout.withSideBar` don't have RN-native equivalents — RN uses tabs / stacks, not sidebars. The canonical `RootStackNavigator` from the builder repo IS NOT copied — the customer's existing navigator stays. Layout-tab features like `layout.tabs: ['chats','calls','users','groups']` need the customer's existing `bottom-tabs` navigator to add those tabs manually (skills can do this in a follow-up `cometchat-native-placement` flow). Theme + typography + chat features + call features ARE honored via `useConfig`.
