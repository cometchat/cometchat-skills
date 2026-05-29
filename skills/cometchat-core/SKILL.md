---
name: cometchat-core
description: "Shared rules for CometChat React UI Kit v6. Always loaded alongside framework + placement skills. Read this first."
license: "MIT"
compatibility: "Node.js >=18; React >=18; @cometchat/chat-uikit-react ^6; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "shell, file-read, file-search, file-list"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat react core rules initialization patterns"
---

## Purpose

This is the foundational skill for every CometChat React UI Kit v6 integration. It teaches Claude HOW CometChat works -- initialization, login, CSS, environment variables, SSR safety, and the provider pattern -- so Claude can write project-appropriate code instead of relying on templates.

**Read this skill first, before any framework or placement skill.**

---

## 1. Initialization

CometChat must be initialized exactly once before any UI component renders. Initialization is asynchronous and must complete fully before mounting any `CometChat*` component.

### The UIKitSettingsBuilder

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
  if (existing) return;                 // sequential case — already logged in
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

interface CometChatProviderProps {
  appId: string;
  region: string;
  authKey?: string;
  authToken?: string;
  uid?: string;
  children: React.ReactNode;
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
          const builder = new UIKitSettingsBuilder()
            .setAppId(appId)
            .setRegion(region)
            .subscribePresenceForAllUsers();

          if (authKey) {
            builder.setAuthKey(authKey);
          }

          const settings = builder.build();
          await CometChatUIKit.init(settings);
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
>
  <ChatPage />
</CometChatProvider>
```

The provider pattern keeps init/login logic in one place. Chat components inside `<CometChatProvider>` are guaranteed to render only after init and login succeed.

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

For a dynamic language switcher, call `CometChatLocalize.setLocale(newLang)` when the user picks a language. The UI Kit re-renders with the new strings.

**To override a string:** the `resources` option accepts custom translations merged over the defaults. Useful for brand-specific terms:

```typescript
CometChatLocalize.init({
  language: "en",
  resources: {
    en: {
      "type a message": "Write your message…",
      "start a conversation": "Say hi 👋",
    },
  },
});
```

**Full translation key list** lives in `node_modules/@cometchat/chat-uikit-react/dist/resources/` or the docs MCP. Don't invent keys — unknown keys fall through to the default.

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

When the dispatcher's Step 3.1 sets `customize=visual`, skills runs **`cometchat builder export --platform react`** — a single CLI command that mirrors the dashboard's Export-button workflow. It downloads the canonical static template ZIP from `preview.cometchat.com/downloads/cometchat-builder-react.zip`, fetches the per-builder settings JSON via `GET /vcb/builders/{id}`, unzips the template, patches `CometChatSettings.ts` with the fetched JSON + missing-field defaults + a sentinel comment, and writes the result to `--output` (default: `src/CometChat/`).

The `src/CometChat/` directory contains `CometChatApp.tsx`, the repo's own `CometChatProvider`-style context, `CometChatHome` with tabs (Chats / Calls / Users / Groups), theme hooks (`useThemeStyles`, `useSystemColorScheme`), login listener wiring, and 13 supporting components. Skills does NOT hand-roll a wrapper — the canonical app IS the wrapper.

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
| Patches `CometChatSettings.ts` | Per-builder JSON + sentinel comment ("SKILLS-AUTO-GENERATED — do not edit by hand. Last sync: <ISO>") |
| Copies to `--output` | Default `src/CometChat/` |
| Reports JSON | `{ status: "exported", builderId, appId, platform, output, settings_file, builder_name }` |

**For Next.js App Router**, pass `--output src/app/CometChat`. For React Router v7 framework mode, pass `--output app/CometChat`. The CLI's F25 case-collision pre-check warns if a lowercase `src/cometchat/` exists with In-code-shape files (init.ts / CometChatProvider.tsx).

**For resync** (Step 7 iteration menu → Re-sync visual builder), re-run the SAME command with `--force`. This re-downloads the latest canonical template + re-fetches the latest settings + replaces the `--output` directory entirely. Customer hand-edits inside the `CometChat/` directory are lost — matches the "SKILLS-AUTO-GENERATED" contract on the sentinel.

### 11.2 Files patched (after export)

The `builder export` command writes the canonical files. Skills then patches the customer's existing project to wire it in:

| Path | Patch |
|---|---|
| `package.json` | (1) `npm install @cometchat/chat-uikit-react@6.4.3 @cometchat/calls-sdk-javascript@4.2.5` — **pinned versions from the canonical repo's README**. Older/newer versions of `chat-uikit-react` may drift from the exported `src/CometChat/` directory's expected API surface. (2) **Add a top-level `cometChatCustomConfig` block** — the canonical context reads it via `import packageJson from "../../../package.json"` and accesses `packageJson.cometChatCustomConfig.name` / `.version` / `.production` for init wiring. Without it, the build fails with `TS2339: Property 'cometChatCustomConfig' does not exist`. Shape: `"cometChatCustomConfig": { "name": "<your-app-name>", "version": "<your-app-version>", "production": true }`. |
| Entry file — `src/main.tsx` (Vite) / `src/index.tsx` (CRA) / new client component (Next.js) / route file (React Router) / `.astro` page (Astro) | Init UI Kit + render `<CometChatProvider><App /></CometChatProvider>`. Pattern below — varies by framework. |
| `tsconfig.app.json` (Vite 7+) or `tsconfig.json` (CRA / older Vite) | **Multiple non-negotiable adjustments** beyond `resolveJsonModule` + `jsx`. The canonical `src/CometChat/` was authored under CRA's looser TS settings; Vite 7+ template defaults are too strict and will fail the build with dozens of `TS6133` / `TS1484` errors:<br>• `"resolveJsonModule": true` — non-negotiable (`utils/utils.ts` imports a JSON locale)<br>• `"jsx": "react-jsx"` — non-negotiable<br>• `"verbatimModuleSyntax": false` — Vite 7+ default is `true`; canonical code uses mixed value + type imports without the `type` modifier<br>• `"noUnusedLocals": false` — Vite 7+ default is `true`; canonical code has many unused-by-default destructured listener args (e.g. `({ groupOwner, kickedUser, ... })`)<br>• `"noUnusedParameters": false` — same rationale<br>• `"erasableSyntaxOnly": false` — Vite 7+ template flag; canonical code uses const enums / namespace patterns<br>• `"allowJs": true` — canonical app's tsconfig sets this; some kit internals may rely on JS fallthrough<br>Validated 2026-05-21 against `create-vite@8` + canonical `uikit-builder-app-master` + `@cometchat/chat-uikit-react@6.4.3`. |
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

**Customer hand-edits inside `src/CometChat/` are lost on resync.** This is intentional — the SKILLS-AUTO-GENERATED sentinel comment on `CometChatSettings.ts` documents the "do not edit by hand" contract.

If a customer needs to override beyond what the Visual Builder exposes, the supported escape hatches are:
- Edit the entry file (e.g., `src/main.tsx`) — outside `src/CometChat/`, never touched by resync
- Edit `src/App.tsx` to wrap `<CometChatApp />` with additional providers / styling
- Use `cometchat apply-feature <id>` for extension toggles (server-side, survives resync)
- For one-off CSS overrides, edit `src/index.css` or equivalent — also outside `src/CometChat/`

The `cometchat-core` §11.7 "Override hook pattern" documents the recommended places to override without touching the canonical.

`verify --builder` runs after resync to confirm the new export is structurally sound.

### 11.7 What this section does NOT emit

The canonical `src/CometChat/` honors every Builder setting it supports — theme colors, typography, dark/light, sidebar toggle, layout tabs, `chatFeatures.*`, `callFeatures.*`, `agent.*` (per the repo's `CometChatHome` + `styleConfig.ts`). The only setting that isn't auto-applied is `noCode.docked` (the floating-widget shape) — that's a runtime DOM injection that requires the customer to mount `<CometChatApp />` inside a docked overlay container. Surface this in the post-emit summary:

> Builder settings honored: theme, typography, layout/tabs, sidebar, chat features (mentions/reactions/threads/media/etc.), call features, agent UI.
> Builder settings deferred: `noCode.docked` floating-widget mode — requires manual mount inside a positioned overlay; see `cometchat-placement § Floating widget`.
