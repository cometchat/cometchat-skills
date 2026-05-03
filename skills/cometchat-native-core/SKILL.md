---
name: cometchat-native-core
description: "Shared rules for CometChat React Native UI Kit v5. Always loaded alongside framework (expo/bare) and placement skills. Read this first."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5; @cometchat/chat-sdk-react-native ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat react-native core rules initialization provider theming"
---

## Purpose

This is the foundational skill for every CometChat React Native UI Kit v5 integration. It teaches Claude HOW CometChat works on RN — initialization order, provider wrapper chain, login, env vars, auth tokens, and the anti-patterns that break real apps.

**Read this skill first, before any framework (`cometchat-native-expo-patterns` / `cometchat-native-bare-patterns`) or placement skill.**

Ground-truth sources: `docs/ui-kit/react-native/overview.mdx`, `react-native-cli-integration.mdx`, `expo-integration.mdx`, `methods.mdx`, and `@cometchat/chat-uikit-react-native@5.3.3`'s `src/index.ts`.

---

## 1. The init-login-render order

CometChat has exactly one valid lifecycle on React Native:

```
CometChatUIKit.init(settings)   →   CometChatUIKit.login({ uid })   →   render <CometChat*> components
```

Breaking this order produces a blank screen, a "CometChat is not initialized" runtime error, or a hung login. No exceptions.

### UIKitSettings — the init object

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
const user = await CometChatUIKit.getLoggedInUser();
if (!user) {
  await CometChatUIKit.login({ uid: "cometchat-uid-1" });  // note: OBJECT form
}
```

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
  const existing = await CometChatUIKit.getLoggedInUser();
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
  const existing = await CometChatUIKit.getLoggedInUser();
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
  react-native-safe-area-context
```

> Note: `react-native-reanimated` is NOT a peer dependency of the kit (verified against `@cometchat/chat-uikit-react-native@5.x` `peerDependencies`). Add it only if your own app uses it for other animations.

Expo adds `expo-av` / `expo-image-picker` depending on which features you enable. Calls require the separate package:

```bash
npm install @cometchat/calls-sdk-react-native
```

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
