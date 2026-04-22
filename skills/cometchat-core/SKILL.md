---
name: cometchat-core
description: "Shared rules for CometChat React UI Kit v6. Always loaded alongside framework + placement skills. Read this first."
license: "MIT"
compatibility: "Node.js >=18; React >=18; @cometchat/chat-uikit-react ^6; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
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

The `login()` method is idempotent — it internally checks `getLoggedinUser()` and resolves immediately with the existing user if already logged in. Calling it again is safe, but checking first avoids the unnecessary async call.

### Getting the current logged-in UID in app code

When your integration code needs the current user's UID (for example, to decide which conversation to target, or to filter by sender), **always fetch it from the SDK — never hardcode a UID like `"cometchat-uid-1"`**.

Two getters, for different contexts:

```typescript
// Async — preferred for app logic, guaranteed correct after init completes
const me = await CometChatUIKit.getLoggedinUser();
const myUid = me?.getUid();

// Sync — use inside render paths where you already know init is done
import { CometChatUIKitLoginListener } from "@cometchat/chat-uikit-react";
const me = CometChatUIKitLoginListener.getLoggedInUser();  // note capital `I` in `InUser`
const myUid = me?.getUid();
```

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

let initialized = false;

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

        const loggedInUser = await CometChatUIKit.getLoggedinUser();
        if (!loggedInUser) {
          if (authToken) {
            await CometChatUIKit.loginWithAuthToken(authToken);
          } else {
            await CometChatUIKit.login(uid);
          }
        }

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

5. **Check `getLoggedinUser()` before `login()` to avoid unnecessary async calls.** The `login()` method is idempotent (silently resolves if already logged in), but checking first is cleaner.

6. **Do NOT render CometChat components in a server-side context.** All components require browser APIs. In Next.js, always use `"use client"`. In Astro, always use `client:only="react"`.

7. **Do NOT target CometChat's internal CSS class names for styling.** These are not part of the public API. Use `--cometchat-*` CSS variables instead. Internal classes change between minor versions.

8. **Do NOT create CometChat components without a container that has explicit dimensions.** CometChat components fill 100% of their container. If the container has no height, the components collapse to zero height. Always set `height`, `min-height`, or use flexbox/grid to give the container dimensions.

9. **Do NOT re-initialize CometChat when navigating between routes.** Init should happen once at the app level (in the provider or entry file), not per-route. Re-initializing causes flickering and dropped WebSocket connections.

10. **Do NOT invent component names.** CometChat exports specific components with specific names. Check the `cometchat-components` skill before writing any `<CometChat*>` JSX. Using a wrong name (e.g., `<CometChatChat>`, `<CometChatMessenger>`) causes a build error.

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
