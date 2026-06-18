---
name: cometchat-core
description: "Shared rules for CometChat React UI Kit v6. Always loaded alongside framework + placement skills. Read this first."
license: "MIT"
compatibility: "Node.js >=18; React >=18; @cometchat/chat-uikit-react ^6; @cometchat/chat-sdk-javascript ^4"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat react core rules initialization patterns"
---

> **Ground truth:** the installed `@cometchat/chat-uikit-react@^6` + `@cometchat/chat-sdk-javascript@^4` package types (`node_modules/@cometchat/chat-uikit-react`) + `docs/ui-kit/react`. **Official docs:** https://www.cometchat.com/docs/ui-kit/react/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly on agents without MCP). Verify any non-obvious symbol against the installed package types before relying on it.

## Purpose

This is the foundational skill for every CometChat React UI Kit v6 integration. It teaches Claude HOW CometChat works -- initialization, login, CSS, environment variables, SSR safety, and the provider pattern -- so Claude can write project-appropriate code instead of relying on templates.

**Read this skill first, before any framework or placement skill.**

## When to use

- Any React-family integration: Vite + React, Next.js (App or Pages Router), React Router v6/v7, Astro with React islands.
- BEFORE loading any framework-specific patterns skill (`cometchat-react-patterns`, `cometchat-nextjs-patterns`, etc.) — those layer on top of this.
- When the user is asking about CometChat init, login, env vars, CSS, provider pattern, SSR safety, or production auth.

## When NOT to use

- **React Native** (Expo or bare) — load `cometchat-native-core` instead. The wrappers, env-var prefixes, and lifecycle are different.
- **Angular** — load `cometchat-angular-core`. Uses `APP_INITIALIZER` + `CUSTOM_ELEMENTS_SCHEMA` + `environment.ts`, not React's provider chain.
- **Native Android (V5 or V6)** — load `cometchat-android-v5-core` or `cometchat-android-v6-core`. Kotlin init, `local.properties` credentials.
- **Native iOS (V5)** — load `cometchat-ios-core`. Swift init, CocoaPods/SPM.
- **Flutter (V5 or V6)** — load `cometchat-flutter-v5-core` or `cometchat-flutter-v6-core`. Dart init via `pubspec.yaml`.
- **Backend-only token-mint server work** — load `cometchat-production` for the REST-API token recipes; this skill is client-side.

## Common Rationalizations — and why they're wrong

A two-column anti-skip defense. Every excuse below has been used by agents (or could plausibly be) to skip rules in this skill. The rebuttal cites the validated incident.

| Excuse the agent might invent | Reality |
|---|---|
| "StrictMode double-invocation is a dev-only quirk, so I can skip the in-flight login promise pattern (§2)" | The same race fires anywhere a parent component re-mounts (React Router v6 nested routes, Suspense boundary retries, error-boundary resets). Skipping yields the canonical `"Please wait until the previous login request ends"` error on production refreshes too. |
| "This is a quick prototype, I'll hardcode `cometchat-uid-1` instead of asking the user" | Two testers shipped apps where the default UID was a Bot in their dashboard (ENG-35717). Auth-key login refuses bot users by design; the error `Auth token creation not allowed for this bot <uid>` is opaque. **Always ask via the dispatcher's Step 3d.1 prompt.** |
| "I'll use `setError(String(e))` for now and pretty-print later" | `String(e)` on a CometChatException renders `[object Object]` — testers wasted 10-minute debugging sessions on this (ENG-35719). Always emit the §6 `formatCometChatError` helper from `cometchat/errors.ts`. "Later" never comes. |
| "The env file looks right, I don't need to run `config show --json`" | Two testers shipped code with empty `VITE_COMETCHAT_APP_ID` because the dispatcher moved on without confirming (ENG-35718). The pre-flight is 1 second; the cost of skipping is a customer-facing init failure. |
| "I know React, I can skip reading the framework-specific patterns skill" | The framework patterns carry version-pinned traps that aren't in training data: the Next.js 15+ rule `dynamic(ssr:false)` must live in a Client Component (verified by runtime smoke 2026-06-02), the Vite Visual Builder `tsconfig` patches (resolveJsonModule, jsx: react-jsx, verbatimModuleSyntax: false), the React Router v7 `appDirectory` constraint. Skipping = customer-visible build failure. |
| "I'll add the telemetry hook later; the basic provider works without it" | The telemetry prop is opt-in by design (no-op if not passed) — but the four lifecycle events (init_started / init_finished / login_started / login_finished + their _failed variants) are how customers wire analytics into onboarding funnels without monkey-patching. Skipping ENG-35715 wiring means the customer has to refactor their provider post-launch. |

## Red flags — signs you're misapplying this skill

- The agent emitted `setError(String(e))` anywhere in code — should be `setError(formatCometChatError(e))` per §6 (ENG-35719).
- The agent's plan (Step 3f) doesn't include `cometchat/errors.ts` as a created file.
- The agent emitted bare `CometChatUIKit.login(uid)` without the in-flight-promise guard (`ensureLoggedIn`) — guaranteed StrictMode race in dev.
- A `<style>` or CSS rule targets internal class names like `.cometchat-conversation-list-item` (anti-pattern §8.3) instead of the `--cometchat-*` CSS variables.
- The agent picked `cometchat-uid-1` without asking the user (ENG-35717 — the bot-flag failure mode).
- The agent's env file uses the wrong framework prefix (e.g., `VITE_*` in a Next.js project, or `EXPO_PUBLIC_*` in a Vite project).
- The provider doesn't gate `{children}` on `isReady` — chat components mount before init completes and throw `CometChat is not initialized` errors.

## Verification — before declaring this skill applied

Run through this checklist before saying "done" for any task that touched cometchat-core territory:

- [ ] `grep -nE "setError\(String\(" src/` returns ZERO matches (ENG-35719 — must use `formatCometChatError`).
- [ ] `src/cometchat/errors.ts` exists and exports `formatCometChatError` + `logCometChatError`.
- [ ] The provider has an `ensureLoggedIn`-style in-flight guard (no bare `CometChatUIKit.login` calls).
- [ ] `tsc --noEmit` passes against the project's existing `tsconfig`.
- [ ] Env vars use the **detected framework's prefix** (`VITE_*` / `NEXT_PUBLIC_*` / `PUBLIC_*` / `EXPO_PUBLIC_*`), and `.env` (or `.env.local` for Next.js) is in `.gitignore`.
- [ ] CSS imports happen once at the entry / root (per framework section in §3).
- [ ] If the user is on Next.js: the page that owns CometChat components has `"use client"` (App Router) or is dynamic-imported with `ssr: false` (App Router only inside another Client Component, per the Next.js 15+ rule verified 2026-06-02).
- [ ] The user confirmed the dev-mode UID via the dispatcher's Step 3d.1 prompt — NOT silently picked.

---

## 1. Initialization

CometChat must be initialized exactly once before any UI component renders. Initialization is asynchronous and must complete fully before mounting any `CometChat*` component.

### File-based init with `cometchat-settings.json` (recommended)

> **Version requirement (ENG-35866 — Skills Telemetry).** `CometChatUIKit.initFromSettings(settings)` reads a `cometchat-settings.json` object and lets the SDK self-report `integrationSource = "ai-agent"` to `/user_sessions`. It ships GA in **`@cometchat/chat-uikit-react >= 6.5.2`** + **`@cometchat/chat-sdk-javascript >= 4.1.11`** (npm `latest`). On an older UI Kit the method does not exist — use the **`UIKitSettingsBuilder` fallback** below.

**Step 1 — create `cometchat-settings.json` at the project root.** Fill `appId` / `region` / `credentials.authKey` from the CLI `provision setup` output; leave everything else at the defaults below. This is the single source of credentials — no second copy to keep in sync.

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

**Step 2 — init by importing the JSON as a build-time module.** Vite, CRA, Next.js, and Astro all have `resolveJsonModule` on by default, so the import is type-safe with no extra config:

```typescript
// initFromSettings ships GA in @cometchat/chat-uikit-react >= 6.5.2 (ENG-35866)
import { CometChatUIKit } from "@cometchat/chat-uikit-react";
import cometchatSettings from "./cometchat-settings.json"; // adjust path to the file's location

await CometChatUIKit.initFromSettings(cometchatSettings);
```

- **Do NOT gitignore `cometchat-settings.json`.** The dev-mode `authKey` it holds is no more exposed than a `VITE_COMETCHAT_AUTH_KEY=…` env value (both ship in the built bundle); production integrations migrate to server-minted auth tokens regardless.
- The same module-flag / `useEffect` / entry-point placement rules in the rest of this section apply unchanged — just swap `CometChatUIKit.init(settings)` for `CometChatUIKit.initFromSettings(cometchatSettings)`.

### The UIKitSettingsBuilder (fallback — UI Kit before file-based init)

```typescript
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";

const settings = new UIKitSettingsBuilder()
  .setAppId(APP_ID)       // Required. String from the CometChat dashboard.
  .setRegion(REGION)       // Required. "us", "eu", "in", etc.
  .setAuthKey(AUTH_KEY)    // Required for dev mode. Omit in production (use auth tokens).
  .subscribePresenceForAllUsers() // Optional but recommended -- enables online/offline indicators.
  .build();
```

### Init must happen once

Use a module-level flag to prevent double-init. This is critical because React StrictMode in development calls effects twice:

```typescript
let initialized = false;

async function initCometChat(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Fail loud if env vars didn't load. Empty credentials otherwise surface
  // much later as a cryptic `ERROR_API_KEY_NOT_FOUND` / failed init that's hard
  // to trace back to a missing/mis-prefixed .env. (audit P0-5)
  if (!APP_ID || !REGION || !AUTH_KEY) {
    throw new Error(
      "CometChat credentials are empty — check .env and the framework's env prefix " +
        "(VITE_ / NEXT_PUBLIC_ / PUBLIC_), and restart the dev server after editing .env.",
    );
  }

  const settings = new UIKitSettingsBuilder()
    .setAppId(APP_ID)
    .setRegion(REGION)
    .setAuthKey(AUTH_KEY)
    .subscribePresenceForAllUsers()
    .build();

  await CometChatUIKit.init(settings);
}
```

### Init must be in useEffect (React components) or before mount (entry files)

**In a useEffect (Next.js, Astro, React Router SSR):**

```typescript
useEffect(() => {
  initCometChat()
    .then(() => loginUser())
    .then(() => setReady(true))
    .catch((e) => setError(String(e)));
}, []);
```

**At the entry point (Vite/CRA -- no SSR):**

```typescript
// main.tsx -- runs once, before React mounts
CometChatUIKit.init(settings)
  ?.then(() => CometChatUIKit.login("cometchat-uid-1"))
  .then(() => mount())
  .catch((e) => mountError(String(e)));
```

The init-at-entry pattern works for Vite/CRA because `main.tsx` only runs in the browser. For frameworks with SSR (Next.js, Astro, React Router v7 SSR), you MUST use the useEffect pattern because the module runs on the server first.

---

## 2. Login

### Development mode

Use `CometChatUIKit.login(uid)` with a test UID. Every new CometChat app comes with five pre-created test users: `cometchat-uid-1` through `cometchat-uid-5`.

```typescript
const user = await CometChatUIKit.getLoggedinUser();
if (!user) {
  await CometChatUIKit.login("cometchat-uid-1");
}
```

### ⚠️ `login()` is safe to call sequentially, NOT concurrently

A subtle but important distinction:

- **Sequential** (first `login()` completes, then second is called): the SDK's second call returns immediately with the already-logged-in user. Safe.
- **Concurrent** (a second `login()` fires while the first is still in-flight): the SDK throws `"Please wait until the previous login request ends."` The user sees a red error on the page, has to refresh, and only then does it work (because the first session is now cached).

This is exactly the case that React 18 StrictMode triggers in development: effects run mount → unmount → mount, so a `useEffect` that calls `login()` fires twice with no time for the first call to finish. Production builds don't double-mount, but any code path that can call `login()` from two places simultaneously hits the same error.

**Guard concurrent login with a module-level in-flight promise:**

```typescript
let loginInFlight: Promise<unknown> | null = null;

async function ensureLoggedIn(
  uid: string,
  authToken?: string,
): Promise<void> {
  const existing = await CometChatUIKit.getLoggedinUser();
  // Same user already logged in → nothing to do (sequential case).
  if (existing && existing.getUid?.() === uid) return;
  // A DIFFERENT user is logged in (account switch, or logout → login-as-other).
  // Log out first: otherwise the SDK keeps the old session and login() silently
  // no-ops, so the app shows the previous account. (Switching accounts requires
  // an explicit logout — login() is a no-op against an existing session.)
  if (existing) await CometChatUIKit.logout();
  if (loginInFlight) {                   // concurrent case — reuse pending promise
    await loginInFlight;
    return;
  }
  loginInFlight = authToken
    ? CometChatUIKit.loginWithAuthToken(authToken)
    : CometChatUIKit.login(uid);
  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}
```

Call `ensureLoggedIn()` from the provider / effect instead of `CometChatUIKit.login()` directly. Both StrictMode mounts resolve against the same promise, so only one login request actually hits the server.

**Why not just a boolean flag?** A boolean would require extra wait-loop code to handle "login started but not finished yet." A cached promise handles that automatically — `await` on the same promise is free for all callers.

### Getting the current logged-in UID in app code

When your integration code needs the current user's UID (for example, to decide which conversation to target, or to filter by sender), **always fetch it from the SDK — never hardcode a UID like `"cometchat-uid-1"`**.

Two getters, for different contexts. **Default to the sync version** — it matches the v6 sample app and works for almost all app code, because by the time UI components render, the kit's init + login flow is already complete:

```typescript
// ✓ Preferred — sync, returns User | null directly. Use this in app code.
import { CometChatUIKitLoginListener } from "@cometchat/chat-uikit-react";
const me = CometChatUIKitLoginListener.getLoggedInUser();  // note capital `I` in `InUser`
const myUid = me?.getUid();

// Fallback — async, for the bootstrap path where init may not be complete
// (e.g., inside the provider's init effect, or before the first login resolves).
const me = await CometChatUIKit.getLoggedinUser();
const myUid = me?.getUid();
```

The sync `CometChatUIKitLoginListener.getLoggedInUser()` is the right call from any component that mounts AFTER login completes — which is virtually all of them, since the dispatcher's recipes put login on a dedicated route or in the provider's init effect that gates rendering. Reach for the async `CometChatUIKit.getLoggedinUser()` only when you're inside that init effect itself.

**Casing matters.** Note `getLogged**In**User` (capital `I`) on the LoginListener vs `getLogged**in**User` (lowercase `i`) on `CometChatUIKit` — both casings exist in the kit, they're different methods.

Hardcoding `"cometchat-uid-1"` only works in the dev mode login call (`CometChatUIKit.login("cometchat-uid-1")`) because you're *choosing* who to log in as. Once logged in, the getters are the source of truth — useful when the logged-in user comes from production auth (a real user ID, not a test UID), or when the user logs out and logs in as someone else.

### Production mode

Use `CometChatUIKit.loginWithAuthToken(token)` with a token obtained from your backend. The backend generates the token using the CometChat REST API with your `AUTH_TOKEN` (not the client-side `AUTH_KEY`).

```typescript
// Fetch token from YOUR backend, which calls CometChat's REST API
const response = await fetch("/api/cometchat-token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ uid: currentUser.id }),
});
const { token } = await response.json();

await CometChatUIKit.loginWithAuthToken(token);
```

For the full production auth setup, use `npx @cometchat/skills-cli production-auth`. Never hardcode auth keys in source code that ships to production.

### Logout

```typescript
await CometChatUIKit.logout();
```

Call this when the user signs out of your application. This clears CometChat's local session.

---

## 3. CSS

### Import once at the app root

```typescript
import "@cometchat/chat-uikit-react/css-variables.css";
```

This import MUST appear exactly once, at the highest level of your application:

| Framework | Where to import |
|---|---|
| React (Vite) | `src/main.tsx` or `src/index.css` via `@import` |
| Next.js (App Router) | `app/globals.css` via `@import` or `app/layout.tsx` |
| Next.js (Pages Router) | `pages/_app.tsx` or `styles/globals.css` |
| Astro | Global layout file or `src/styles/global.css` |
| React Router | Root route module or `app/root.tsx` |

### Theming with CSS variables

All CometChat components respect `--cometchat-*` CSS variables. Override them on a parent element or `:root`:

```css
:root {
  --cometchat-primary-color: #6851d6;
  --cometchat-background-color-01: #ffffff;
  --cometchat-text-color-primary: #141414;
  --cometchat-font-family: "Inter", sans-serif;
  --cometchat-border-radius-lg: 12px;
}
```

### Never target internal class names

CometChat's internal class names (like `.cometchat-message-bubble__wrapper`) are not part of the public API and may change between versions. Always use CSS variables for customization. The only exception is when explicitly copying patterns from the v6 sample app that use documented BEM class names.

---

## 4. Environment variables

Each framework has its own convention for exposing env vars to client-side code. CometChat needs three variables: `APP_ID`, `REGION`, and `AUTH_KEY`.

### Per-framework naming

| Framework | Prefix | Example |
|---|---|---|
| React (Vite) | `VITE_` | `import.meta.env.VITE_COMETCHAT_APP_ID` |
| Next.js | `NEXT_PUBLIC_` | `process.env.NEXT_PUBLIC_COMETCHAT_APP_ID` |
| Astro | `PUBLIC_` | `import.meta.env.PUBLIC_COMETCHAT_APP_ID` |
| React Router (Vite) | `VITE_` | `import.meta.env.VITE_COMETCHAT_APP_ID` |
| CRA | `REACT_APP_` | `process.env.REACT_APP_COMETCHAT_APP_ID` |

### The three variables

| Variable suffix | Required | Description |
|---|---|---|
| `COMETCHAT_APP_ID` | Yes | Your app ID from the CometChat dashboard |
| `COMETCHAT_REGION` | Yes | Region code: `"us"`, `"eu"`, `"in"`, etc. |
| `COMETCHAT_AUTH_KEY` | Dev only | Client-side auth key. Replace with auth tokens for production. |

### .env file placement

| Framework | File | Gitignored by default |
|---|---|---|
| Vite / React Router | `.env` | No -- add to `.gitignore` |
| Next.js | `.env.local` | Yes |
| Astro | `.env` | No -- add to `.gitignore` |
| CRA | `.env` | No -- add to `.gitignore` |

---

## 5. SSR safety

All CometChat UI Kit components are browser-only. They access `window`, `document`, and browser APIs during import. Rendering them on the server will crash.

### Framework-specific SSR prevention

**Next.js (App Router):**

Mark the file containing CometChat components with `"use client"` at the top. Use `next/dynamic` with `ssr: false` if the component is imported from a server component:

```typescript
"use client";
// This entire file only runs in the browser

import { CometChatConversations } from "@cometchat/chat-uikit-react";
```

Or from a server component:

```typescript
import dynamic from "next/dynamic";

const ChatView = dynamic(() => import("./ChatView"), { ssr: false });
```

**Next.js (Pages Router):**

Use `next/dynamic` with `ssr: false`:

```typescript
import dynamic from "next/dynamic";

const CometChatNoSSR = dynamic(() => import("../components/CometChatNoSSR"), {
  ssr: false,
});
```

**Astro:**

Use the `client:only="react"` directive. This prevents the component from rendering during Astro's static build:

```astro
---
import ChatPanel from "../components/ChatPanel";
---
<ChatPanel client:only="react" />
```

**React Router v7 (SSR mode):**

Use `React.lazy()` with `Suspense` in a `clientLoader` or `useEffect` guard:

```typescript
import { lazy, Suspense } from "react";

const ChatView = lazy(() => import("./ChatView"));

export default function ChatRoute() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      <ChatView />
    </Suspense>
  );
}
```

**React (Vite / CRA):**

No SSR concerns. These are client-only by nature. Import and use directly.

---

## 6. Provider pattern

Instead of inlining init/login logic in every component, create a reusable `CometChatProvider` that handles initialization, login, and ready-state gating. Wrap your chat UI with it.

```typescript
// CometChatProvider.tsx
"use client"; // Required for Next.js App Router; harmless in other frameworks

import React, { useEffect, useState, createContext, useContext } from "react";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";

interface CometChatContextValue {
  isReady: boolean;
  error: string | null;
}

const CometChatContext = createContext<CometChatContextValue>({
  isReady: false,
  error: null,
});

export const useCometChat = () => useContext(CometChatContext);

// Module-level state: shared across all mounts so React 18 StrictMode's
// double-invocation of effects doesn't fire init or login twice.
let initialized = false;
let loginInFlight: Promise<unknown> | null = null;

async function ensureLoggedIn(
  uid: string,
  authToken?: string,
): Promise<void> {
  const existing = await CometChatUIKit.getLoggedinUser();
  if (existing) return;
  if (loginInFlight) {
    // A prior StrictMode mount (or another effect) already started login —
    // reuse its promise instead of calling login() a second time, which
    // throws "Please wait until the previous login request ends."
    await loginInFlight;
    return;
  }
  loginInFlight = authToken
    ? CometChatUIKit.loginWithAuthToken(authToken)
    : CometChatUIKit.login(uid);
  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

// ENG-35715 telemetry hook — opt-in callback for init/login lifecycle.
// Fires at six phases. If `telemetry` prop is not passed, all calls are no-ops.
export type CometChatTelemetryEvent =
  | { phase: "init_started";    appId: string; region: string }
  | { phase: "init_finished";   durationMs: number }
  | { phase: "init_failed";     error: unknown }
  | { phase: "login_started";   uid: string; mode: "authKey" | "authToken" }
  | { phase: "login_finished";  durationMs: number }
  | { phase: "login_failed";    error: unknown };

interface CometChatProviderProps {
  appId: string;
  region: string;
  authKey?: string;
  authToken?: string;
  uid?: string;
  telemetry?: (event: CometChatTelemetryEvent) => void;   // ← opt-in lifecycle hook
  children: React.ReactNode;
}

export function CometChatProvider({
  appId,
  region,
  authKey,
  authToken,
  uid = "cometchat-uid-1",
  telemetry,
  children,
}: CometChatProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      const initStart = performance.now();
      try {
        if (!initialized) {
          initialized = true;
          telemetry?.({ phase: "init_started", appId, region });
          const builder = new UIKitSettingsBuilder()
            .setAppId(appId)
            .setRegion(region)
            .subscribePresenceForAllUsers();

          if (authKey) {
            builder.setAuthKey(authKey);
          }

          const settings = builder.build();
          await CometChatUIKit.init(settings);
          telemetry?.({ phase: "init_finished", durationMs: performance.now() - initStart });
        }

        const loginStart = performance.now();
        telemetry?.({ phase: "login_started", uid, mode: authToken ? "authToken" : "authKey" });
        await ensureLoggedIn(uid, authToken);
        telemetry?.({ phase: "login_finished", durationMs: performance.now() - loginStart });

        setIsReady(true);
      } catch (e) {
        // If init never completed, this is an init_failed; otherwise login_failed.
        const phase = isReady ? "login_failed" : "init_failed";
        telemetry?.({ phase, error: e } as CometChatTelemetryEvent);
        setError(formatCometChatError(e));
      }
    }

    setup();
  }, [appId, region, authKey, authToken, uid, telemetry]);

  if (error) {
    return (
      <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>
        CometChat Error: {error}
      </div>
    );
  }

  if (!isReady) {
    return null; // Or a loading spinner
  }

  return (
    <CometChatContext.Provider value={{ isReady, error }}>
      {children}
    </CometChatContext.Provider>
  );
}
```

### Usage

```typescript
// In your app layout or route wrapper:
<CometChatProvider
  appId={import.meta.env.VITE_COMETCHAT_APP_ID}
  region={import.meta.env.VITE_COMETCHAT_REGION}
  authKey={import.meta.env.VITE_COMETCHAT_AUTH_KEY}
  // Optional — wire your analytics on each lifecycle event (ENG-35715):
  telemetry={(event) => {
    if (event.phase === "init_finished" || event.phase === "login_finished") {
      analytics.track(`cometchat.${event.phase}`, { ms: event.durationMs });
    } else if (event.phase === "init_failed" || event.phase === "login_failed") {
      analytics.trackError(`cometchat.${event.phase}`, { error: String(event.error) });
    } else {
      analytics.track(`cometchat.${event.phase}`, event);
    }
  }}
>
  <ChatPage />
</CometChatProvider>
```

The provider pattern keeps init/login logic in one place. Chat components inside `<CometChatProvider>` are guaranteed to render only after init and login succeed.

### Pretty-print errors — DO NOT `String(error)` (ENG-35719)

`CometChat.CometChatException` objects look like `{ code: "ERROR_API_KEY_NOT_FOUND", message: "Auth Key cannot be empty", details: ..., source: ... }` (in some kit versions the fields are `errorCode` / `errorDescription`). Calling `String(e)` on them yields `"[object Object]"` — the integrator then has to open devtools, copy the error to the console, and `JSON.stringify` it by hand just to read the message. Testers consistently flag this as the most frustrating moment of the first-run integration.

**Emit this helper in `cometchat/errors.ts` and reuse it from the provider, login screen, and any feature module that catches a kit error:**

```typescript
// cometchat/errors.ts
export function formatCometChatError(e: unknown): string {
  if (e == null) return "Unknown CometChat error.";
  const err = e as Record<string, unknown>;
  const code =
    (err.code as string | undefined) ??
    (err.errorCode as string | undefined);
  const message =
    (err.message as string | undefined) ??
    (err.errorDescription as string | undefined);
  if (code && message) return `[CometChat ${code}] ${message}`;
  if (message) return `[CometChat] ${message}`;
  try {
    return `[CometChat] ${JSON.stringify(e)}`;
  } catch {
    return `[CometChat] ${String(e)}`;
  }
}

const KNOWN_DOC_HINTS: Record<string, string> = {
  ERROR_API_KEY_NOT_FOUND:
    "Auth Key is missing or invalid. Check your env vars (VITE_COMETCHAT_AUTH_KEY / EXPO_PUBLIC_COMETCHAT_AUTH_KEY) and confirm the key in Dashboard → App → Credentials.",
  ERR_UID_NOT_FOUND:
    "The UID you're logging in with doesn't exist in this CometChat app. Create the user in Dashboard → Users, or pick one of the pre-seeded test UIDs (cometchat-uid-1 .. cometchat-uid-5).",
  ERR_AUTH_TOKEN_NOT_FOUND:
    "Auth token is empty or expired. Re-mint it from your backend via the CometChat REST API.",
  AUTH_ERR_BOT:
    "This UID is flagged as a Bot in the dashboard — auth-key login is refused for bot users by design. Toggle Bot OFF in Dashboard → Users, or pick a non-bot UID.",
};

export function logCometChatError(e: unknown): void {
  const formatted = formatCometChatError(e);
  console.error(formatted, e);
  const code = (e as { code?: string; errorCode?: string })?.code ??
               (e as { code?: string; errorCode?: string })?.errorCode;
  if (code && KNOWN_DOC_HINTS[code]) {
    console.warn(`[CometChat hint] ${KNOWN_DOC_HINTS[code]}`);
  }
}
```

Then in the provider:

```typescript
} catch (e) {
  logCometChatError(e);
  setError(formatCometChatError(e));
}
```

And in the error renderer:

```tsx
if (error) {
  return (
    <div role="alert" style={{ color: "#b91c1c", padding: 16, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap" }}>
      <strong>CometChat failed to initialize.</strong>
      <div style={{ marginTop: 8 }}>{error}</div>
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        See the browser console for the full error object and any [CometChat hint] line above it.
      </div>
    </div>
  );
}
```

This three-part recipe — `formatCometChatError` for the visible message, `logCometChatError` for the console (with a docs hint for known codes), and a multi-line render that points at the console — turns "ERR_API_KEY_NOT_FOUND" from a 10-minute debugging session into a 10-second fix.

> ⚠️ **Replace `setError(String(e))` everywhere.** The two earlier examples in this skill (§1 init-in-useEffect, §6 provider's setup() catch) use `setError(String(e))` for compactness — when you scaffold the real integration, emit `formatCometChatError(e)` instead and import it from `cometchat/errors.ts`. The same applies to RN (`cometchat-native-core`), Angular (`cometchat-angular-core`), and the native cores — the helper is platform-agnostic, just adapt the file extension.

---

## 7. RTL, i18n, and accessibility

These three concerns share one property: the UI Kit handles them out of the box, but a careless customization can break them. Read this before writing custom views, composer actions, or header replacements.

### RTL (right-to-left)

The UI Kit reads `dir="rtl"` from the document root. If the project already sets `<html dir="rtl">` (or toggles it dynamically for Arabic/Hebrew locales), **CometChat components flip automatically** — message bubbles mirror, avatars swap sides, icons rotate where appropriate. No CometChat-specific config needed.

**To test:** add `<html dir="rtl">` to `index.html` (or set it via JS in Next.js App Router: `<html dir="rtl">` in `app/layout.tsx`). Reload — the conversation list avatar + text should render on the right, message bubbles mirror, the composer input aligns right.

**When customizing:** if you replace a default view (e.g. a custom message bubble), test it in both LTR and RTL. The UI Kit's components use logical properties (`margin-inline-start`, `padding-inline-end`) — your custom components should too, or they'll break RTL.

### i18n (translations)

The UI Kit has a built-in `CometChatLocalize` utility that covers ~40 languages out of the box. Initialize it once, alongside `CometChatUIKit.init()`:

```typescript
import { CometChatLocalize } from "@cometchat/chat-uikit-react";

CometChatLocalize.init({
  language: "es",  // or "fr", "de", "ar", "hi", etc.
});
```

For a dynamic language switcher, call `CometChatLocalize.setCurrentLanguage(newLang)` when the user picks a language (NOT `setLocale` — that method doesn't exist in v6). The UI Kit re-renders with the new strings.

**To override a string:** there's no nested `resources: { en: {...} }` option. Use either `translationsForLanguage` at init (a FLAT key→value map for the chosen `language`), or the standalone `CometChatLocalize.addTranslation({...})`:

```typescript
// (a) at init — flat map for the active language
CometChatLocalize.init({
  language: "en",
  translationsForLanguage: {
    "type a message": "Write your message…",
    "start a conversation": "Say hi 👋",
  },
});

// (b) anytime after init
CometChatLocalize.addTranslation({
  "type a message": "Write your message…",
});
```

**Full translation key list** lives under `node_modules/@cometchat/chat-uikit-react/dist/types/resources/` (types) or the docs MCP. Don't invent keys — unknown keys fall through to the default.

### Accessibility

Default components ship with:
- `aria-label` on icon-only buttons (send, attach, call, etc.)
- `role="listbox"` + `role="option"` on conversation / user / group lists
- Keyboard navigation: `Tab` to focus, `Enter` to activate, `Esc` to close modals
- Focus management: opening a thread view moves focus to the thread header; closing returns focus to the trigger

**Rules when customizing:**

1. **Replacing an icon-only button?** Add `aria-label="<verb>"` (e.g. `aria-label="Send message"`).
2. **Replacing a list item?** Keep `role="option"` + `aria-selected` on the wrapping element.
3. **Replacing the composer?** Preserve the `<textarea>` with an accessible `<label>` (visible or `aria-label`), and keep `Enter`/`Shift+Enter` behavior.
4. **Replacing a modal?** Trap focus inside the modal while open, restore focus to the trigger on close, and add `role="dialog"` + `aria-modal="true"` + a labelled heading.
5. **Color contrast:** when theming with custom colors, verify text contrast ≥ 4.5:1 against background. A low-saturation primary color on a white background breaks AA contrast.

For deep customization (e.g. a fully custom message bubble), the a11y responsibility shifts to the custom component — the UI Kit only guarantees it for its own defaults. Test with a screen reader (VoiceOver on macOS, NVDA on Windows) and keyboard-only navigation before shipping.

---

## 8. Anti-patterns

These are specific things NOT to do. Each one causes real bugs that are hard to debug.

1. **Do NOT call `CometChatUIKit.init()` during render.** Init is async and has side effects. Calling it during render causes infinite re-render loops. Always call in `useEffect` or before `createRoot`.

2. **Do NOT import `css-variables.css` in multiple files.** Duplicate imports cause CSS specificity conflicts and doubled variable declarations. Import it exactly once at the app root.

3. **Do NOT render CometChat components before init completes.** Components assume the SDK is initialized. Rendering before init finishes causes "CometChat is not initialized" runtime errors. Use the provider pattern or a ready-state gate.

4. **Do NOT hardcode `AUTH_KEY` in source files.** The auth key is a secret. Use environment variables during development. Use auth tokens in production.

5. **Guard concurrent `login()` calls with a module-level in-flight promise.** `login()` is only safe to call sequentially. Two `login()` calls overlapping (e.g. React 18 StrictMode's double effect) throw *"Please wait until the previous login request ends."* Cache the first login's promise at module scope and `await` that from subsequent callers. See the `ensureLoggedIn` helper in section 2 and section 6's provider pattern.

6. **Do NOT render CometChat components in a server-side context.** All components require browser APIs. In Next.js, always use `"use client"`. In Astro, always use `client:only="react"`.

7. **Do NOT target CometChat's internal CSS class names for styling.** These are not part of the public API. Use `--cometchat-*` CSS variables instead. Internal classes change between minor versions.

8. **Do NOT create CometChat components without a container that has explicit dimensions.** CometChat components fill 100% of their container. If the container has no height, the components collapse to zero height. Always set `height`, `min-height`, or use flexbox/grid to give the container dimensions.

9. **Do NOT re-initialize CometChat when navigating between routes.** Init should happen once at the app level (in the provider or entry file), not per-route. Re-initializing causes flickering and dropped WebSocket connections.

10. **Do NOT invent component names.** CometChat exports specific components with specific names. Check the `cometchat-components` skill before writing any `<CometChat*>` JSX. Using a wrong name (e.g., `<CometChatChat>`, `<CometChatMessenger>`) causes a build error.

11. **Do NOT wrap CometChat components in a `transform`ed container.** Per the CSS spec, any non-`none` `transform` on an element creates a new containing block for `position: fixed` descendants. CometChat UI Kit renders several overlays as `position: fixed` (message options menu, emoji picker, file preview, reactions popover, thread panel) and expects them to anchor to the viewport. Wrapping the chat in a container that uses `transform: translateX(...)` — a common pattern for slide-in drawers / sidebars — reparents those overlays to the drawer, causing them to appear clipped, offset, or drift mid-animation.

    **This includes Tailwind's `translate-x-*` utilities — `translate-x-full`, `-translate-x-full`, `translate-x-0`, `translate-x-[420px]`, etc. all compile to `transform: translateX(...)` and trigger the same bug.** Same for `-translate-y-*`, `translate-*`, `scale-*`, `rotate-*`, `skew-*`, `transform-*`, and any `transition-transform` utility applied to a container wrapping CometChat components. If you see yourself reaching for any Tailwind class in the `transform:` family on a drawer/sidebar/modal that contains chat UI, stop.

    **Animate the `right` / `left` offset instead**, or use `margin-right: isOpen ? 0 : -<width>`. In Tailwind: toggle between `right-0` and a negative `right-[-420px]` with `transition-[right]` instead of `transition-transform`.

    Same rule applies to `filter`, `perspective`, `backdrop-filter`, and `will-change: transform` — any of those also trigger the containing-block takeover. See `cometchat-placement`'s drawer and widget patterns for the correct right-offset animation.

---

## 9. Docs MCP (recommended, not required)

The CometChat docs MCP provides runtime access to the latest documentation, including prop types, callback signatures, request builder methods, SDK events, CSS variable names, and error decoders.

### Installation

```bash
claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp
```

For other clients, see: https://www.cometchat.com/docs/mcp-server

### When to use

- Looking up a prop's exact type or default value
- Finding callback signatures (e.g., what `onItemClick` passes)
- Checking request builder methods (e.g., `ConversationsRequestBuilder.setLimit`)
- Understanding SDK events (e.g., `CometChatMessageEvents.ccMessageSent`)
- Verifying CSS variable names before writing overrides
- Decoding error messages (e.g., "INVALID_AUTH_KEY")

### When NOT to use

- For component names and basic props -- use the `cometchat-components` skill instead (it works offline)
- For init/login/CSS patterns -- they are in this skill
- For placement patterns -- they are in the `cometchat-placement` skill
- For anything the CLI handles -- the CLI templates are the source of truth for those paths

### Fallback when not installed

If the docs MCP is not installed and you need information beyond what the component and core skills contain, check the installed TypeScript definitions:

```bash
grep -A 80 "interface CometChat<ComponentName>Props" \
  node_modules/@cometchat/chat-uikit-react/dist/index.d.ts \
  2>/dev/null | head -80
```

This is faster and more accurate than guessing from training data. Never invent SDK signatures from memory.

---

## 10. Package dependencies

Every CometChat React integration requires these two packages:

```json
{
  "@cometchat/chat-uikit-react": "^6",
  "@cometchat/chat-sdk-javascript": "^4"
}
```

The UI Kit (`@cometchat/chat-uikit-react`) provides all the React components. The SDK (`@cometchat/chat-sdk-javascript`) provides the `CometChat` namespace with types (`CometChat.User`, `CometChat.Group`, `CometChat.Conversation`, `CometChat.BaseMessage`) and methods.

Install with your project's package manager:

```bash
npm install @cometchat/chat-uikit-react @cometchat/chat-sdk-javascript
```

> 💡 **Cost transparency (ENG-35722) — disclose proactively when integrating into a new project:** the kit adds roughly **2.8 MB of JS** (~860 KB gzipped), **~860 KB of CSS**, and **~1.5 MB of Roboto TTF fonts** (9 weights bundled). If the customer's app already loads custom fonts, the Roboto bundle is redundant; override via the `--cometchat-font-family` CSS variable to skip preloading the kit fonts (the TTFs still ship but the browser doesn't download them unless they're actually used). For SaaS founders evaluating CometChat vs self-build, also mention:
> - **Pricing:** https://www.cometchat.com/pricing (free tier covers small dev/test use)
> - **Data extraction / migration:** REST API endpoints `GET /v3/users`, `GET /v3/groups`, `GET /v3/messages?conversationId=` can export everything; no proprietary lock-in
> - **Demo without account:** for `intent: "evaluating"` users, point at the hosted demo at https://app.cometchat.com/login (sign-up gives a free app immediately; ENG-35722 demo-without-account hosted-demo is a vendor follow-up)

### SDK types you will use

```typescript
import { CometChat } from "@cometchat/chat-sdk-javascript";

// Common types:
CometChat.User        // A chat user
CometChat.Group       // A chat group
CometChat.Conversation // A conversation (wraps User or Group)
CometChat.BaseMessage  // A message (text, media, custom, etc.)
CometChat.TextMessage  // A text message specifically

// Common static methods:
CometChat.getUser(uid: string): Promise<CometChat.User>
CometChat.getGroup(guid: string): Promise<CometChat.Group>
```

## 11. Visual Builder integration

When the dispatcher's Step 3.1 sets `customize=visual`, skills runs **`cometchat builder export --platform react`** — a single CLI command that mirrors the dashboard's Export-button workflow. It downloads the canonical static template ZIP from `preview.cometchat.com/downloads/cometchat-builder-react.zip`, fetches the per-builder settings JSON via `GET /vcb/builders/{id}`, unzips the template, **splices** the fetched JSON (+ missing-field defaults) into `CometChatSettings.ts`, and writes the result to `--output` (default: `src/CometChat/`).

**How `CometChatSettings.ts` is patched (splice, not full-file overwrite):** the canonical file declares both `export interface CometChatSettingsInterface { ... }` and `export const CometChatSettings: CometChatSettingsInterface = { ... }`. The CLI rewrites **only the `export const CometChatSettings = {...}` object literal** with the per-builder JSON, **preserving the `export interface CometChatSettingsInterface`** above it (the const is typed against that interface — destroying it breaks the build). The sentinel comment (`SKILLS-AUTO-GENERATED — do not edit by hand. Last sync: <ISO>`) is **prepended to the spliced file**. Do not describe this as a full-file replace.

The `src/CometChat/` directory contains `CometChatApp.tsx`, the repo's own `CometChatProvider`-style context, `CometChatHome` with tabs (Chats / Calls / Users / Groups), theme hooks (`useThemeStyles`, `useSystemColorScheme`), login listener wiring, and 13 supporting components. Skills does NOT hand-roll these — the copied directory is the integration. Two valid render entry points exist: the canonical CRA app's own `src/App.tsx` composes `CometChatHome` + `CometChatLogin` directly (gated on a login listener), while the Next.js entry renders the higher-level `<CometChatApp />` wrapper. Both are fine — `<CometChatApp />` is the simplest, but don't assume it's the only canonical shape.

This is the same pattern iOS (verbatim `MessagesVC.swift`), Android v6 (verbatim `BuilderSettingsHelper.kt`), and Flutter v6 (verbatim `chat_builder/` package) use. React just happens to copy a directory of TSX files instead of a single class.

### 11.1 Run `cometchat builder export`

After Step 3.1.v step 4 (customer says "Done" + skills caches the builderId in `.cometchat/builder.json`), run:

```bash
cometchat builder export --platform react --json
```

This produces the full per-builder integration in one shot:

| What | Where |
|---|---|
| Downloads static template ZIP | `https://preview.cometchat.com/downloads/cometchat-builder-react.zip` |
| Fetches per-builder settings | `GET /vcb/builders/{builderId}` via the same `Bearer` token used elsewhere |
| Applies F3 + F10 missing-field defaults | `chatFeatures.inAppSounds` + `chatFeatures.deeperUserEngagement.mentionAll` |
| Unzips template into temp dir | `/tmp/cometchat-builder-export-XXXX/extracted/` |
| Splices `CometChatSettings.ts` | Rewrites only the `export const CometChatSettings = {...}` literal with the per-builder JSON; preserves `export interface CometChatSettingsInterface`; prepends the sentinel comment ("SKILLS-AUTO-GENERATED — do not edit by hand. Last sync: <ISO>") |
| Copies to `--output` | Default `src/CometChat/` |
| Reports JSON | `{ status: "exported", builderId, appId, platform, output, settings_file, builder_name }` |

**For Next.js App Router**, pass `--output src/app/CometChat`. For React Router v7 framework mode, pass `--output app/CometChat`. The CLI's F25 case-collision pre-check warns if a lowercase `src/cometchat/` exists with In-code-shape files (init.ts / CometChatProvider.tsx).

**For resync** (Step 7 iteration menu → Re-sync visual builder), re-run the SAME command with `--force`. This re-downloads the latest canonical template + re-fetches the latest settings + replaces the `--output` directory entirely. Customer hand-edits inside the `CometChat/` directory are lost — matches the "SKILLS-AUTO-GENERATED" contract on the sentinel.

### 11.2 Files patched (after export)

The `builder export` command writes the canonical files. Skills then patches the customer's existing project to wire it in:

| Path | Patch |
|---|---|
| `package.json` | (1) `npm install @cometchat/chat-uikit-react@6.4.3 @cometchat/calls-sdk-javascript@4.2.5` — **pinned versions from the canonical repo's README**. Older/newer versions of `chat-uikit-react` may drift from the exported `src/CometChat/` directory's expected API surface. (2) **REQUIRED for Vite — add the `cometChatCustomConfig` block to `package.json`.** The canonical `package.json` carries a top-level `cometChatCustomConfig` block, and the copied context (`CometChat/context/CometChatContext.tsx:~216`) reads `pkg?.default?.cometChatCustomConfig.name`. ⚠ This **IS build-breaking on Vite**: the Builder tsconfig requires `resolveJsonModule: true` (next row), so `tsc -b` (the project-references build `npm run build` runs) **statically types `package.json`** → `TS2339: Property 'cometChatCustomConfig' does not exist` when absent. (`tsc --noEmit` passes and HIDES this — use `tsc -b`/`npm run build` for the build proof. Verified 2026-06-14 on a real export build.) Add: `"cometChatCustomConfig": { "name": "<your-app-name>", "version": "<your-app-version>", "production": true }`. |
| Entry file — `src/main.tsx` (Vite) / `src/index.tsx` (CRA) / new client component (Next.js) / route file (React Router) / `.astro` page (Astro) | Init UI Kit + render `<CometChatProvider><App /></CometChatProvider>`. Pattern below — varies by framework. |
| `tsconfig.app.json` (Vite 7+) or `tsconfig.json` (CRA / older Vite) | **Imports resolve on Vite as-is** — the current `builder export` writes `src/CometChat/` with **relative imports** (`../utils/utils`, `../context/CometChatContext`), NOT the bare `CometChat/…`-rooted imports older CRA exports used. So you do **NOT** need `vite-tsconfig-paths` / `baseUrl` (verified 2026-06-14: zero `from "CometChat/…"` in a fresh export; resolves on Vite out of the box). *(Historical: pre-2026 CRA exports used `baseUrl:"./src"` bare imports that needed `vite-tsconfig-paths`; the current template ships relative.)*<br><br>You DO still need these stricter-than-CRA tsconfig flags — Vite 7+ template defaults will otherwise fail the build with `TS6133` / `TS1484`:<br>• `"resolveJsonModule": true` — required (`utils/utils.ts` imports a JSON locale)<br>• `"jsx": "react-jsx"` — required<br>• `"verbatimModuleSyntax": false` — Vite 7+ default is `true`; canonical code uses mixed value + type imports without the `type` modifier<br>• `"noUnusedLocals": false` — Vite 7+ default is `true`; canonical code has many unused-by-default destructured listener args (e.g. `({ groupOwner, kickedUser, ... })`)<br>• `"noUnusedParameters": false` — same rationale<br>• `"erasableSyntaxOnly": false` — Vite 7+ template flag; canonical code uses const enums / namespace patterns<br>• `"allowJs": true` — canonical app's tsconfig sets this; some kit internals may rely on JS fallthrough<br>Validated 2026-05-21 against `create-vite@8` + canonical `uikit-builder-app` (CRA) + `@cometchat/chat-uikit-react@6.4.3`. |
| `.env` (framework-prefixed) | Already written by Step 2c provision. Skip if present; warn if missing. |

The `builder export` command handles the JSON patching + sentinel comment automatically. Skills only needs to patch the four files above (package.json, entry file, tsconfig, .env).

### 11.3 Entry-file init pattern (Vite + React)

```tsx
// src/main.tsx
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import {
  UIKitSettingsBuilder,
  CometChatUIKit,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { setupLocalization } from "./CometChat/utils/utils.ts";
import { CometChatProvider } from "./CometChat/context/CometChatContext.tsx";

export const COMETCHAT_CONSTANTS = {
  APP_ID: import.meta.env.VITE_COMETCHAT_APP_ID!,
  REGION: import.meta.env.VITE_COMETCHAT_REGION!,
  AUTH_KEY: import.meta.env.VITE_COMETCHAT_AUTH_KEY!,
};

const uiKitSettings = new UIKitSettingsBuilder()
  .setAppId(COMETCHAT_CONSTANTS.APP_ID)
  .setRegion(COMETCHAT_CONSTANTS.REGION)
  .setAuthKey(COMETCHAT_CONSTANTS.AUTH_KEY)
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(uiKitSettings)?.then(() => {
  setupLocalization();
  createRoot(document.getElementById("root")!).render(
    <CometChatProvider>
      <App />
    </CometChatProvider>
  );
});
```

Then in `src/App.tsx`:

```tsx
import CometChatApp from "./CometChat/CometChatApp";

export default function App() {
  return (
    // CometChatApp requires an explicit width and height to render. Adjust as needed
    // for your Step 3c placement (full route, drawer, modal, embedded panel).
    <div style={{ width: "100vw", height: "100dvh" }}>
      <CometChatApp />
    </div>
  );
}
```

**Critical:**

- `CometChatProvider` is the **repo's own context** from `./CometChat/context/CometChatContext`, NOT the kit's `CometChatUIKit` export. It manages the builder's `styleFeatures` / `chatFeatures` state and is required for `CometChatHome`, `useThemeStyles`, and the customization toggles to work.
- `setupLocalization()` from `./CometChat/utils/utils` is required before render — it wires the builder's i18n catalog into the kit. Skipping it leaves UI strings empty.
- `CometChatUIKit.init(...)` returns a Promise — render only AFTER it resolves. Rendering before init resolves causes `CometChatHome` to throw on first listener attach.
- Login is handled by `CometChatApp` itself (the canonical component uses `CometChat.addLoginListener` + `CometChatUIKit.getLoggedinUser`). For dev mode, the customer's `App.tsx` should call `CometChatUIKit.login("cometchat-uid-1")` after init resolves but BEFORE rendering — see §2's login order. The canonical app shows a `LoginPlaceholder` until a user is present.

### 11.4 Per-framework variants

| Framework | Where to put `CometChat/` | Entry-file pattern | SSR notes |
|---|---|---|---|
| **Vite + React** | `src/CometChat/` | `src/main.tsx` (above) | N/A |
| **Create React App** | `src/CometChat/` | `src/index.tsx` — same as Vite but use `ReactDOM.createRoot` from `react-dom/client` | N/A |
| **Next.js App Router** | `src/app/CometChat/` | Create `src/app/CometChatNoSSR/CometChatNoSSR.tsx` (client component) that does init + login + renders `<CometChatProvider><CometChatApp /></CometChatProvider>`. Then create `src/app/CometChatAppWrapper.tsx` with `"use client"` + `dynamic(() => import("../app/CometChatNoSSR/CometChatNoSSR"), { ssr: false })`. Import the wrapper in `src/app/page.tsx`. | The canonical `src/CometChat/` uses `window` / `document` / WebSocket APIs at module scope. `{ ssr: false }` on the wrapper is **non-negotiable** — direct import from a server component causes hydration errors. Use `process.env.NEXT_PUBLIC_COMETCHAT_*` instead of `import.meta.env.*`. |
| **Next.js Pages Router** | `src/CometChat/` | `pages/chat.tsx` — `const CometChatApp = dynamic(() => import("../src/CometChat/CometChatApp"), { ssr: false });` Init in `pages/_app.tsx` inside `useEffect`. | Same SSR rationale as App Router. |
| **React Router v7** | `app/CometChat/` (framework mode) or `src/CometChat/` (data mode) | Framework mode: use a `.client.tsx` suffix or `<ClientOnly>` from `remix-utils/client-only`. Data mode: same as Vite. | Framework mode SSRs by default — `.client.tsx` suffix OR `<ClientOnly>` is the only safe pattern. |
| **Astro** | `src/CometChat/` | `<CometChatApp client:only="react" />` inside an `.astro` page. Init runs in a sibling `.tsx` component that mounts before `CometChatApp`. | `client:only="react"` — never `client:load` (Astro will still SSR the import resolution and crash). |

### 11.5 Calls + builder

If `CometChatSettings.callFeatures` has any `true` value (`oneOnOneVoiceCalling`, `oneOnOneVideoCalling`, `groupVideoConference`, `groupVoiceConference`):

1. The canonical `src/CometChat/` already wires `CometChatIncomingCall` inside `CometChatHome` — no extra mount required.
2. Skills patches `package.json` to add `@cometchat/calls-sdk-javascript@4.2.5` (already in the canonical install command above) and the Cloudsmith-hosted `@cometchat/calls-lib-webrtc` per `cometchat-react-calls`.
3. Calls SDK init runs alongside UI Kit init — pattern in `cometchat-react-calls § 2`.

Invoke `cometchat-react-calls` after this section with `{ mode: "additive" }` so it adds Calls SDK init + lib-webrtc without duplicating the kit-level wiring already present in the copied `src/CometChat/`.

### 11.6 Resync flow

The "Re-sync visual builder" iteration menu option (see `cometchat/SKILL.md § Step 7`) is a **one-command re-run**:

```bash
cometchat builder export --platform react --force
```

The `--force` flag is mandatory: it explicitly authorizes replacing the existing `src/CometChat/` directory. Without it, the CLI bails with *"--output directory \`src/CometChat\` already exists. Pass --force to replace it (full re-download per the resync flow), or pick a different --output path."*

This matches the product contract for step 7 of the UI Kit Builder workflow:

1. Re-download the canonical static template ZIP (in case vendor has shipped fixes)
2. Re-fetch the customer's current settings JSON (in case they tweaked in browser)
3. Apply the F3 + F10 missing-field defaults
4. Replace the `src/CometChat/` directory entirely

**Customer hand-edits inside `src/CometChat/` are lost on resync.** This is intentional — the SKILLS-AUTO-GENERATED sentinel comment prepended to `CometChatSettings.ts` documents the "do not edit by hand" contract. (Note the export itself is a splice — only the `export const CometChatSettings = {...}` literal is rewritten and `export interface CometChatSettingsInterface` is preserved — but on `--force` resync the whole `src/CometChat/` directory is re-downloaded and replaced, so any in-folder hand-edits are discarded regardless.)

If a customer needs to override beyond what the Visual Builder exposes, the supported escape hatches are:
- Edit the entry file (e.g., `src/main.tsx`) — outside `src/CometChat/`, never touched by resync
- Edit `src/App.tsx` to wrap `<CometChatApp />` with additional providers / styling
- Use `cometchat apply-feature <id>` for extension toggles (server-side, survives resync)
- For one-off CSS overrides, edit `src/index.css` or equivalent — also outside `src/CometChat/`

> **Builder feature toggles vs. dashboard extensions — two independent layers.** The Visual Builder's `chatFeatures` toggles (baked into `CometChatSettings.ts`) only control whether a feature's **UI** is shown. Extension- and AI-backed features (polls, message translation, collaborative document/whiteboard, stickers, smart replies, conversation starter/summary) need their **server-side capability** enabled separately — the dashboard extensions store, which `cometchat apply-feature <id>` writes and the builder export **never touches**. So: (a) `apply-feature`'d extensions always survive `builder export --force`; (b) turning a feature ON in the builder shows its UI but it fails at runtime until the matching extension is enabled — that's why `builder export` reports a `dashboardSetupNeeded` list (the dispatcher runs `apply-feature` for each). The two flows are complementary: the builder draws the UI, `apply-feature` turns on the capability behind it.

The `cometchat-core` §11.7 "Override hook pattern" documents the recommended places to override without touching the canonical.

`verify --builder` runs after resync to confirm the new export is structurally sound.

### 11.7 What this section does NOT emit

The canonical `src/CometChat/` honors every Builder setting it supports — theme colors, typography, dark/light, sidebar toggle, layout tabs, `chatFeatures.*`, `callFeatures.*`, `agent.*` (per the repo's `CometChatHome` + `styleConfig.ts`). The only setting that isn't auto-applied is `noCode.docked` (the floating-widget shape) — that's a runtime DOM injection that requires the customer to mount `<CometChatApp />` inside a docked overlay container. Surface this in the post-emit summary:

> Builder settings honored: theme, typography, layout/tabs, sidebar, chat features (mentions/reactions/threads/media/etc.), call features, agent UI.
> Builder settings deferred: `noCode.docked` floating-widget mode — requires manual mount inside a positioned overlay; see `cometchat-placement § Floating widget`.
