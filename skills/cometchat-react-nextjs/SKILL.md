---
name: cometchat-react-nextjs
description: Use this skill when integrating CometChat React UI Kit v6 into a Next.js app (App Router or Pages Router), including SSR prevention, setup, login, conversations, one-to-one chat, and tab-based chat. Do not use for plain React, React Router, or Astro.
license: "MIT"
compatibility: "Node.js >=16; Next.js >=13; React >=18; @cometchat/chat-uikit-react ^6; Claude Code or any agentskills.io-compatible agent"
allowed-tools: "readFile, readCode, readMultipleFiles, grepSearch, fileSearch, listDirectory, fsWrite, strReplace, executeBash, getDiagnostics"
metadata:
  author: "CometChat"
  version: "1.0.0"
  tags: "chat cometchat nextjs app-router pages-router messaging ui-kit conversations one-to-one"
---

## Use this skill when

Trigger this skill when the request involves any of the following:
- integrate CometChat in Next.js
- add chat to a Next.js app
- CometChat Next.js UI Kit setup
- CometChat with App Router or Pages Router
- CometChat conversations in Next.js
- one-to-one chat with CometChat in Next.js
- tab-based chat using CometChat in Next.js
- CometChat SSR prevention in Next.js
- dynamic import with ssr:false for CometChat
- initialize CometChat UI Kit in Next.js
- login a CometChat user in Next.js

## Do not use this skill when

- the project uses plain React (Vite/CRA) → use `cometchat-react-reactjs` instead
- the project uses React Router → use `cometchat-react-react-router` instead
- the project uses Astro → use `cometchat-react-astro` instead
- the user is asking about Android, iOS, Flutter, React Native, Angular, or Vue
- the user needs backend-only CometChat REST API calls (no UI)

## Output rules

When generating code with this skill:
- use `tsx` for TypeScript projects
- placeholders must be explicit: `YOUR_APP_ID`, `YOUR_REGION`, `YOUR_AUTH_KEY`, `YOUR_UID`
- always add `"use client"` to pages that use `dynamic(..., { ssr: false })`
- never import `css-variables.css` inside `CometChatNoSSR.tsx` — it goes in `globals.css`
- use `NEXT_PUBLIC_` prefix for all client-side env vars
- show which file each snippet belongs to

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build error: `ssr: false not allowed in Server Components` | Missing `"use client"` on page | Add `"use client"` to the top of `page.tsx` |
| Blank screen | `login()` called before `init()` resolves | Move `login()` inside `init()?.then()` |
| Blank screen | Component renders before `login()` resolves | Gate render with `if (!user) return null` |
| Broken styles | `css-variables.css` not in `globals.css` | Add `@import url("@cometchat/chat-uikit-react/css-variables.css")` as first line of `globals.css` |
| Broken styles | `css-variables.css` imported inside `CometChatNoSSR.tsx` | Move import to `globals.css`, remove from component |
| `401 Unauthorized` | Wrong App ID or Auth Key | Check `.env.local` values match the CometChat dashboard |
| TypeScript error "possibly undefined" | `init().then()` used | Change to `init()?.then()` |
| Hydration error | CometChat rendered server-side | Ensure `dynamic(..., { ssr: false })` wraps the component |

## HARD RULES

```
- Do not duplicate CSS imports — grep for css-variables.css before adding
- Do not recreate existing routes or pages
- Do not overwrite files with real business logic — PATCH only
- Infer credentials from .env.local or existing CometChatUIKit.init before asking
- Never introduce Auth Key if /api/auth or /api/cometchat-token exists
- init() → login() → render: never break this order
- css-variables.css goes in app/globals.css (App Router) or styles/globals.css (Pages Router) — NEVER inside CometChatNoSSR.tsx
- "use client" is REQUIRED on any page that uses dynamic(..., { ssr: false }) — applies to all Next.js versions
- Detect router type: src/app/ → App Router; pages/ → Pages Router — do NOT hardcode paths
- Return null (not undefined) from components on loading/empty states
```

---

## AGENT CONTRACT

**Goal:** Integrate CometChat React UI Kit v6 into a Next.js app — experience chosen by user.

**Required inputs:**
- `NEXT_PUBLIC_COMETCHAT_APP_ID` (string)
- `NEXT_PUBLIC_COMETCHAT_REGION` ("us" | "eu" | "in")
- `NEXT_PUBLIC_COMETCHAT_AUTH_KEY` (string, dev only) OR existing auth token endpoint
- Login UID (string) — default: `cometchat-uid-1`
- Experience: "conversation-list" | "one-to-one" | "tab"

**Output files:**
- `.env.local` — credentials
- `app/globals.css` (or `styles/globals.css` for Pages Router) — CSS variables import
- `src/app/page.tsx` (or `pages/index.tsx`) — dynamic import wrapper with `ssr: false`
- `src/app/cometchat/CometChatNoSSR.tsx` — init + login + experience UI
- `src/app/cometchat/CometChatNoSSR.css` — layout styles
- `src/app/cometchat/CometChatSelector.tsx` — (Experience 1 and 3 only)
- `src/app/cometchat/CometChatTabs.tsx` + `CometChatTabs.css` — (Experience 3 only)
- `public/assets/*.svg` — (Experience 3 only)

**Invariants:**
1. `init()` MUST resolve before `login()`
2. `login()` MUST resolve before any component renders (`if (!user) return null` guard)
3. `css-variables.css` imported exactly once per app — first line of `app/globals.css` (NOT inside `CometChatNoSSR.tsx`)
4. Never pass `user` AND `group` to the same component instance
5. SSR rule: `dynamic(() => import(...), { ssr: false })` + `"use client"` on the page (required for Turbopack/Next.js 16+)

**Failure modes:**
- Blank screen → init/login order broken OR component rendered before login resolves
- `401 Unauthorized` → wrong App ID or Auth Key
- Broken styles → `css-variables.css` missing or imported twice
- Build error `ssr: false not allowed in Server Components` → add `"use client"` to page.tsx

**Completion criteria:**
- `npm run build` exits 0 with no TypeScript errors
- `css-variables.css` imported exactly once (first line of `app/globals.css`)
- Chat UI loads and messages are visible
- No CometChat errors in browser console

---

## DECISION LOGIC

```
// Stop early if wrong skill
IF "next" is NOT in package.json dependencies → STOP, use cometchat-react-reactjs instead
IF "@react-router/dev" in package.json → STOP, use cometchat-react-react-router instead
IF "astro" in package.json → STOP, use cometchat-react-astro instead

// Next.js version
IF Next.js version >= 16 (Turbopack default) → "use client" on page.tsx is REQUIRED alongside ssr: false
IF Next.js version 13–15 → "use client" is still recommended; add it to avoid future breakage

// Router type
IF src/app/ directory exists → App Router (use src/app/cometchat/ path)
IF pages/ directory exists → Pages Router (use styles/globals.css, pages/index.tsx)

// Auth strategy
IF server-side auth token endpoint exists (e.g. /api/auth, /api/cometchat-token) → use loginWithAuthToken(), do NOT use Auth Key
IF project is clearly dev/demo with no existing auth → use login(UID) with Auth Key (add TODO comment for production)

// Credential source
IF .env.local already has NEXT_PUBLIC_COMETCHAT_APP_ID → reuse, do NOT overwrite
IF CometChatUIKit.init call already exists in source → extract credentials from there

// File operations
IF file exists AND contains app logic beyond boilerplate → PATCH only, preserve all existing logic
IF file exists AND is boilerplate stub (placeholder content only) → REPLACE allowed
IF file does not exist → CREATE

// CSS import
IF css-variables.css already imported anywhere in the project → DO NOT add again
IF not imported → add as first line of app/globals.css (NOT inside CometChatNoSSR.tsx)
```

---

## QUICK INTEGRATION

Fast path for Experience 1 (Conversation List + Message View) on a fresh Next.js App Router project.

**1. Install**
```bash
npm install @cometchat/chat-uikit-react
```

**2. `.env.local`**
```
NEXT_PUBLIC_COMETCHAT_APP_ID=your_app_id
NEXT_PUBLIC_COMETCHAT_REGION=us
NEXT_PUBLIC_COMETCHAT_AUTH_KEY=your_auth_key
```

**3. `src/app/page.tsx` — replace contents**
```tsx
"use client";
import dynamic from "next/dynamic";

const CometChatComponent = dynamic(
  () => import("./cometchat/CometChatNoSSR"),
  { ssr: false }
);

export default function Home() {
  return <CometChatComponent />;
}
```

**4. `src/app/cometchat/CometChatNoSSR.tsx` — key init/login/render snippet**
```tsx
"use client";
import React, { useEffect, useState } from "react";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
// css-variables.css is imported in app/globals.css — do NOT import it here
// ... import experience components and CSS

const UID = "cometchat-uid-1"; // TODO: replace with real UID in production

const CometChatNoSSR: React.FC = () => {
  const [user, setUser] = useState<CometChat.User | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settings = new UIKitSettingsBuilder()
      .setAppId(process.env.NEXT_PUBLIC_COMETCHAT_APP_ID!)
      .setRegion(process.env.NEXT_PUBLIC_COMETCHAT_REGION!)
      .setAuthKey(process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY!)
      .subscribePresenceForAllUsers()
      .build();

    CometChatUIKit.init(settings)?.then(() => {
      CometChatUIKit.getLoggedinUser().then((u) => {
        if (!u) {
          CometChatUIKit.login(UID).then(setUser).catch((e: unknown) => setError(String(e)));
        } else {
          setUser(u);
        }
      });
    }).catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{error}</div>;
  if (!user) return null;
  // render experience UI here
};
export default CometChatNoSSR;
```

**5. Run**
```bash
npm run dev
```

For other experiences (One-to-One, Tab-Based), see Steps 7B and 7C below.

---

# CometChat + Next.js Integration

Integrate CometChat React UI Kit v6 into a Next.js app. CometChat requires browser APIs (`window`, `WebSocket`, `document`) — all CometChat components must be loaded client-side only.

Follow all rules in `cometchat-react-core`. The invariants and decision logic in core override anything in this file.

This skill owns: SSR pattern (`dynamic` + `ssr: false` + `"use client"`), env prefix (`NEXT_PUBLIC_`), canonical CSS location (first line of `app/globals.css`), file layout, and experience code examples.

**Minimal diff rule:** Prefer integrating into the user's current app structure. Only scaffold a demo structure when the repository is clearly a starter app.

---

## Step 0 — Check Existing State and Hard Rules

**No-duplicate rules — check these before writing anything:**
- Do not add duplicate CSS imports (`css-variables.css` must appear exactly once across all files).
- Do not create a duplicate chat route if one already exists.
- Do not recreate components that already exist — patch them instead.

Before writing any files:
1. Read `package.json` — if `@cometchat/chat-uikit-react` is already in dependencies, skip the install step.
2. Check if `src/app/cometchat/` already exists — if so, read the existing files and patch only what is missing rather than overwriting. If files already have app logic, patch minimally — do not replace.
3. Check if `.env.local` or `.env.development` exists — if it already has `NEXT_PUBLIC_COMETCHAT_APP_ID`, reuse those values. Only ask the user for credentials that are missing.
4. Check if `@cometchat/chat-uikit-react/css-variables.css` is already imported anywhere — if so, do not add it again.
5. Check if `src/app/page.tsx` already exists and has app logic — if so, DO NOT modify it. Create a new `/chat` route instead (see Pattern E in `cometchat-react-core` EXISTING PROJECT PATCH GUIDE).
6. Check for `/api/cometchat-token` or `/api/auth` endpoints — if found, use `loginWithAuthToken()` and DO NOT add `NEXT_PUBLIC_COMETCHAT_AUTH_KEY` to `.env.local`. See Pattern C in core.

**EXISTING PROJECT STRATEGY:**
- DO NOT modify `src/app/page.tsx` if it has real content
- DO NOT modify `src/app/layout.tsx` except to add the CSS import to `globals.css`
- DO NOT modify any existing API routes
- CREATE `src/app/chat/page.tsx` as a new route for the chat UI
- CREATE `src/app/cometchat/` directory for CometChat components

**PLACEMENT — dedicated route vs inline embed:**
The dispatcher (Step 4) asks the user where to place the chat:
- **Dedicated `/chat` route** (default): create `src/app/chat/page.tsx` with the dynamic import wrapper. This is the standard path.
- **Embed in existing page**: if the user named a specific page (e.g., `/dashboard`), patch that page's `page.tsx` to add the dynamic import alongside existing content. Do NOT replace the page — add the component below or beside existing JSX.

**THEMING:**
If the dispatcher's Step 6b theming question was answered "yes", after completing the integration ask:
> "What's your app's primary brand color and font family?"
Then add CSS variable overrides to `app/globals.css` after the `css-variables.css` import, following the Theming section in `cometchat-react-core`.

**Concrete existing-project example (Next.js with NextAuth + auth token endpoint):**

If the project has `/api/cometchat-token/route.ts`, the skill MUST:
1. NOT add `NEXT_PUBLIC_COMETCHAT_AUTH_KEY` to `.env.local`
2. NOT call `setAuthKey()` in UIKitSettingsBuilder
3. Use `loginWithAuthToken()` in `CometChatNoSSR.tsx`

Create `src/app/chat/page.tsx` (NOT modify `src/app/page.tsx`):
```tsx
"use client";
import dynamic from "next/dynamic";

const CometChatComponent = dynamic(
  () => import("../cometchat/CometChatNoSSR"),
  { ssr: false }
);

export default function ChatPage() {
  return <CometChatComponent />;
}
```

Create `src/app/cometchat/CometChatNoSSR.tsx` with `loginWithAuthToken`:
```tsx
"use client";
import React, { useEffect, useState } from "react";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
// ... import experience components
import "./CometChatNoSSR.css";

const CometChatNoSSR: React.FC = () => {
  const [user, setUser] = useState<CometChat.User | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settings = new UIKitSettingsBuilder()
      .setAppId(process.env.NEXT_PUBLIC_COMETCHAT_APP_ID!)
      .setRegion(process.env.NEXT_PUBLIC_COMETCHAT_REGION!)
      // NO setAuthKey() — using auth token endpoint instead
      .subscribePresenceForAllUsers()
      .build();

    CometChatUIKit.init(settings)?.then(() => {
      CometChatUIKit.getLoggedinUser().then((u) => {
        if (!u) {
          fetch("/api/cometchat-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: "cometchat-uid-1" }),
          })
            .then((res) => res.json())
            .then(({ authToken }) => CometChatUIKit.loginWithAuthToken(authToken))
            .then(setUser)
            .catch((e: unknown) => setError(String(e)));
        } else {
          setUser(u);
        }
      });
    }).catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{error}</div>;
  if (!user) return null;
  // render experience UI here
};
export default CometChatNoSSR;
```

Add CSS import to the TOP of `src/app/globals.css` (do not replace the file):
```css
@import url("@cometchat/chat-uikit-react/css-variables.css");
/* ... existing styles below stay untouched ... */
```

Leave `src/app/page.tsx`, `src/app/layout.tsx`, and all `/api/` routes completely untouched.

---

## Step 1 — Confirm Framework and Version

Read `package.json`. Confirm `"next"` is in dependencies. If not, use `cometchat-react-reactjs` instead.

Check the Next.js major version:
- **Next.js 13–15**: uses webpack by default. `dynamic(..., { ssr: false })` works in Server Components.
- **Next.js 16+**: uses Turbopack by default. `dynamic(..., { ssr: false })` requires `"use client"` on the page — add it or the build will fail with: `` `ssr: false` is not allowed with `next/dynamic` in Server Components ``.

Check the router type by reading the project structure — do NOT hardcode paths:
- `src/app/` present → **App Router**: components at `src/app/cometchat/`, CSS at `app/globals.css` or `src/app/globals.css`
- `app/` present (no `src/`) → **App Router** (no src): components at `app/cometchat/`, CSS at `app/globals.css`
- `pages/` present → **Pages Router**: components at `src/cometchat/` or `components/cometchat/`, CSS at `styles/globals.css`

Determine the actual globals.css path by reading the layout file (`src/app/layout.tsx` or `app/layout.tsx`) — it will contain the existing globals.css import, showing the correct path.

---

## Step 2 — Collect Credentials (Infer First)

Execute in order before asking the user anything:

1. Read `.env.local` and `.env.development` — if `NEXT_PUBLIC_COMETCHAT_APP_ID` exists, reuse it. Do NOT overwrite.
2. Grep source for `CometChatUIKit.init` — extract APP_ID, REGION, AUTH_KEY from existing call.
3. Check for auth token endpoint (`/api/auth`, `/api/cometchat-token`) — if found, plan to use `loginWithAuthToken()`. Do not add Auth Key.
4. Default `LOGIN_UID` to `cometchat-uid-1` unless a different UID is evident from the codebase.

Only ask for values still missing after steps 1–4. If experience was passed as an argument to the dispatcher, skip asking about it.

---

## Step 3 — Install

```bash
npm install @cometchat/chat-uikit-react
```

---

## Step 4 — Write credentials to `.env.local`

Only create or update `.env.local` if `NEXT_PUBLIC_COMETCHAT_APP_ID` is not already present. `.env.local` is already in Next.js's default `.gitignore`.

```
NEXT_PUBLIC_COMETCHAT_APP_ID=your_app_id
NEXT_PUBLIC_COMETCHAT_REGION=us
NEXT_PUBLIC_COMETCHAT_AUTH_KEY=your_auth_key
```

> Warning: Auth Key is for development only. In production, omit `NEXT_PUBLIC_COMETCHAT_AUTH_KEY` and use server-generated Auth Tokens with `loginWithAuthToken()` instead.

---

## Step 5 — Add CSS to globals.css

Add at the top of `app/globals.css` (or `styles/globals.css` for Pages Router). Do not add if already present.

```css
@import url("@cometchat/chat-uikit-react/css-variables.css");
html, body { height: 100%; }
#__next { height: 100%; }
```

---

## Step 6 — Disable SSR in Page

Read `src/app/page.tsx` (or `pages/index.tsx`) first.

**CRITICAL DECISION:**
- If `src/app/page.tsx` is a demo stub (just "Hello World", Next.js default template) → REPLACE with the code below.
- If `src/app/page.tsx` has real content (existing dashboard, auth, app logic) → DO NOT modify it. CREATE `src/app/chat/page.tsx` instead with the code below (adjust the import path to `../cometchat/CometChatNoSSR`). See EXISTING PROJECT STRATEGY above.

`"use client"` is required when using `dynamic(..., { ssr: false })` with Turbopack (Next.js 16+).

**`src/app/page.tsx`** (App Router) or **`pages/index.tsx`** (Pages Router):
```tsx
"use client";
import dynamic from "next/dynamic";

const CometChatComponent = dynamic(
  () => import("./cometchat/CometChatNoSSR"),
  { ssr: false }
);

export default function Home() {
  return <CometChatComponent />;
}
```

The `ssr: false` flag prevents Next.js from attempting to server-render CometChat components.

---

## Step 7A — Experience 1: Conversation List + Message View

**`src/app/cometchat/CometChatSelector.tsx`**
```tsx
"use client";
import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatConversations, CometChatUIKitLoginListener } from "@cometchat/chat-uikit-react";

interface SelectorProps {
  onSelectorItemClicked?: (
    input: CometChat.Conversation | CometChat.User | CometChat.Group,
    type: string
  ) => void;
}

export const CometChatSelector = ({ onSelectorItemClicked = () => {} }: SelectorProps) => {
  const [loggedInUser, setLoggedInUser] = useState<CometChat.User | null>(null);
  const [activeConversation, setActiveConversation] = useState<CometChat.Conversation | undefined>();

  useEffect(() => {
    setLoggedInUser(CometChatUIKitLoginListener.getLoggedInUser());
  }, []);

  return (
    <>
      {loggedInUser && (
        <CometChatConversations
          activeConversation={activeConversation}
          onItemClick={(e) => {
            setActiveConversation(e);
            onSelectorItemClicked(e, "updateSelectedItem");
          }}
        />
      )}
    </>
  );
};
```

**`src/app/cometchat/CometChatNoSSR.tsx`:**
```tsx
"use client";
import React, { useEffect, useState } from "react";
import {
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatUIKit,
  UIKitSettingsBuilder,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatSelector } from "./CometChatSelector";
// css-variables.css is imported in app/globals.css — do NOT import it here
import "./CometChatNoSSR.css";

const COMETCHAT_CONSTANTS = {
  APP_ID: process.env.NEXT_PUBLIC_COMETCHAT_APP_ID!,
  REGION: process.env.NEXT_PUBLIC_COMETCHAT_REGION!,
  AUTH_KEY: process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY!,
};
const UID = "UID"; // replace with the login UID

const CometChatNoSSR: React.FC = () => {
  const [user, setUser] = useState<CometChat.User | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CometChat.User | undefined>();
  const [selectedGroup, setSelectedGroup] = useState<CometChat.Group | undefined>();

  useEffect(() => {
    const settings = new UIKitSettingsBuilder()
      .setAppId(COMETCHAT_CONSTANTS.APP_ID)
      .setRegion(COMETCHAT_CONSTANTS.REGION)
      .setAuthKey(COMETCHAT_CONSTANTS.AUTH_KEY)
      .subscribePresenceForAllUsers()
      .build();

    CometChatUIKit.init(settings)?.then(() => {
      CometChatUIKit.getLoggedinUser().then((u) => {
        if (!u) {
          CometChatUIKit.login(UID)
            .then(setUser)
            .catch((e: unknown) => setError(String(e)));
        } else {
          setUser(u);
        }
      });
    }).catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{error}</div>;
  if (!user) return null;

  return (
    <div className="conversations-with-messages">
      <div className="conversations-wrapper">
        <CometChatSelector
          onSelectorItemClicked={(activeItem) => {
            const item =
              activeItem instanceof CometChat.Conversation
                ? activeItem.getConversationWith()
                : activeItem;
            if (item instanceof CometChat.User) {
              setSelectedUser(item);
              setSelectedGroup(undefined);
            } else if (item instanceof CometChat.Group) {
              setSelectedUser(undefined);
              setSelectedGroup(item);
            }
          }}
        />
      </div>
      {selectedUser || selectedGroup ? (
        <div className="messages-wrapper">
          {selectedUser && <CometChatMessageHeader user={selectedUser} />}
          {selectedGroup && <CometChatMessageHeader group={selectedGroup} />}
          {selectedUser && <CometChatMessageList user={selectedUser} />}
          {selectedGroup && <CometChatMessageList group={selectedGroup} />}
          {selectedUser && <CometChatMessageComposer user={selectedUser} />}
          {selectedGroup && <CometChatMessageComposer group={selectedGroup} />}
        </div>
      ) : (
        <div className="empty-conversation">Select a conversation to start chatting</div>
      )}
    </div>
  );
};
export default CometChatNoSSR;
```

**`src/app/cometchat/CometChatNoSSR.css`**
```css
.conversations-with-messages { display: flex; height: 100%; width: 100%; }
.conversations-wrapper { height: 100%; width: 480px; overflow: hidden; display: flex; flex-direction: column; }
.conversations-wrapper > .cometchat { overflow: hidden; }
.messages-wrapper { width: calc(100% - 480px); height: 100%; display: flex; flex-direction: column; }
.empty-conversation { height: 100%; width: 100%; display: flex; justify-content: center; align-items: center; background: white; color: var(--cometchat-text-color-secondary, #727272); font: var(--cometchat-font-body-regular, 400 14px Roboto); }
.cometchat .cometchat-message-composer { border-radius: 0; }
```

---

## Step 7B — Experience 2: One-to-One / Group Chat

**`src/app/cometchat/CometChatNoSSR.tsx`:**
```tsx
"use client";
import React, { useEffect, useState } from "react";
import {
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatUIKit,
  UIKitSettingsBuilder,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
// css-variables.css is imported in app/globals.css — do NOT import it here
import "./CometChatNoSSR.css";

const COMETCHAT_CONSTANTS = {
  APP_ID: process.env.NEXT_PUBLIC_COMETCHAT_APP_ID!,
  REGION: process.env.NEXT_PUBLIC_COMETCHAT_REGION!,
  AUTH_KEY: process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY!,
};
const LOGIN_UID = "UID"; // replace with login UID
const CHAT_UID = "cometchat-uid-1"; // replace with target UID

const CometChatNoSSR: React.FC = () => {
  const [user, setUser] = useState<CometChat.User | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CometChat.User | undefined>();

  useEffect(() => {
    const settings = new UIKitSettingsBuilder()
      .setAppId(COMETCHAT_CONSTANTS.APP_ID)
      .setRegion(COMETCHAT_CONSTANTS.REGION)
      .setAuthKey(COMETCHAT_CONSTANTS.AUTH_KEY)
      .subscribePresenceForAllUsers()
      .build();

    CometChatUIKit.init(settings)?.then(() => {
      CometChatUIKit.getLoggedinUser().then((u) => {
        if (!u) {
          CometChatUIKit.login(LOGIN_UID)
            .then(setUser)
            .catch((e: unknown) => setError(String(e)));
        } else {
          setUser(u);
        }
      });
    }).catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (user) {
      CometChat.getUser(CHAT_UID)
        .then(setSelectedUser)
        .catch((e: unknown) => setError(String(e)));
    }
  }, [user]);

  if (error) return <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{error}</div>;
  if (!user) return null;

  return selectedUser ? (
    <div className="messages-wrapper">
      <CometChatMessageHeader user={selectedUser} />
      <CometChatMessageList user={selectedUser} />
      <CometChatMessageComposer user={selectedUser} />
    </div>
  ) : (
    <div className="empty-conversation">Set CHAT_UID to start chatting</div>
  );
};
export default CometChatNoSSR;
```

Use the same `CometChatNoSSR.css` as Experience 1.

---

## Step 7C — Experience 3: Tab-Based Chat

**IMPORTANT:** Experience 3 builds on Experience 1. Follow these steps in order:
1. First, create ALL the same files as Experience 1 (Step 7A) — `CometChatNoSSR.tsx`, `CometChatNoSSR.css`, `CometChatSelector.tsx`, and the chat page.
2. Then, add the tab components below and replace `CometChatSelector.tsx` with the tab-aware version.
3. The `CometChatNoSSR.tsx` and `CometChatNoSSR.css` are IDENTICAL to Experience 1 — do not change them.

Create icon files in `public/assets/`. Reference them as `/assets/chats.svg` (absolute URL, not ES imports).

**`public/assets/chats.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
```

**`public/assets/calls.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
```

**`public/assets/users.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
```

**`public/assets/groups.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
```

**`src/app/cometchat/CometChatTabs.tsx`**
```tsx
"use client";
import { useState } from "react";
import "./CometChatTabs.css";

const TABS = [
  { name: "CHATS", icon: "/assets/chats.svg" },
  { name: "CALLS", icon: "/assets/calls.svg" },
  { name: "USERS", icon: "/assets/users.svg" },
  { name: "GROUPS", icon: "/assets/groups.svg" },
];

export const CometChatTabs = ({
  onTabClicked = () => {},
  activeTab,
}: {
  onTabClicked?: (t: { name: string }) => void;
  activeTab?: string;
}) => {
  const [hover, setHover] = useState("");
  return (
    <div className="cometchat-tab-component">
      {TABS.map((tab) => {
        const active =
          activeTab === tab.name.toLowerCase() || hover === tab.name.toLowerCase();
        return (
          <div
            key={tab.name}
            className="cometchat-tab-component__tab"
            onClick={() => onTabClicked(tab)}
          >
            <div
              className={`cometchat-tab-component__tab-icon${active ? " cometchat-tab-component__tab-icon-active" : ""}`}
              style={{ WebkitMaskImage: `url("${tab.icon}")`, maskImage: `url("${tab.icon}")` }}
              onMouseEnter={() => setHover(tab.name.toLowerCase())}
              onMouseLeave={() => setHover("")}
            />
            <div
              className={`cometchat-tab-component__tab-text${active ? " cometchat-tab-component__tab-text-active" : ""}`}
              onMouseEnter={() => setHover(tab.name.toLowerCase())}
              onMouseLeave={() => setHover("")}
            >
              {tab.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

**`src/app/cometchat/CometChatTabs.css`**
```css
.cometchat-tab-component { display: flex; width: 100%; padding: 0 8px; gap: 8px; border-top: 1px solid var(--cometchat-border-color-light, #F5F5F5); background: var(--cometchat-background-color-01, #FFF); }
.cometchat-tab-component__tab { display: flex; padding: 12px 0 10px; flex-direction: column; align-items: center; gap: 4px; flex: 1; min-height: 48px; cursor: pointer; }
.cometchat-tab-component__tab-icon { width: 32px; height: 32px; background: var(--cometchat-icon-color-secondary, #A1A1A1); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-size: contain; mask-position: center; mask-repeat: no-repeat; }
.cometchat-tab-component__tab-text { color: var(--cometchat-text-color-secondary, #727272); font: var(--cometchat-font-caption1-medium, 500 12px Roboto); }
.cometchat-tab-component__tab-icon-active { background: var(--cometchat-icon-color-highlight); }
.cometchat-tab-component__tab-text-active { color: var(--cometchat-text-color-highlight); }
```

**`src/app/cometchat/CometChatSelector.tsx`** (tab-aware version)
```tsx
"use client";
import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import type { Call, Conversation, Group, User } from "@cometchat/chat-sdk-javascript";
import {
  CometChatCallLogs,
  CometChatConversations,
  CometChatGroups,
  CometChatUIKitLoginListener,
  CometChatUsers,
} from "@cometchat/chat-uikit-react";
import { CometChatTabs } from "./CometChatTabs";

interface SelectorProps {
  onSelectorItemClicked?: (
    input: User | Group | Conversation | Call,
    type: string
  ) => void;
}

export const CometChatSelector = ({ onSelectorItemClicked = () => {} }: SelectorProps) => {
  const [loggedInUser, setLoggedInUser] = useState<CometChat.User | null>(null);
  const [activeConversation, setActiveConversation] = useState<CometChat.Conversation | undefined>();
  const [activeUser, setActiveUser] = useState<CometChat.User | undefined>();
  const [activeGroup, setActiveGroup] = useState<CometChat.Group | undefined>();
  const [activeCall, setActiveCall] = useState<Call | undefined>();
  const [activeTab, setActiveTab] = useState("chats");

  useEffect(() => {
    setLoggedInUser(CometChatUIKitLoginListener.getLoggedInUser());
  }, []);

  return (
    <>
      {loggedInUser && (
        <>
          {activeTab === "chats" && (
            <CometChatConversations
              activeConversation={activeConversation}
              onItemClick={(e) => {
                setActiveConversation(e);
                onSelectorItemClicked(e, "updateSelectedItem");
              }}
            />
          )}
          {activeTab === "calls" && (
            <CometChatCallLogs
              activeCall={activeCall}
              onItemClick={(e: Call) => {
                setActiveCall(e);
                onSelectorItemClicked(e, "updateSelectedItemCall");
              }}
            />
          )}
          {activeTab === "users" && (
            <CometChatUsers
              activeUser={activeUser}
              onItemClick={(e) => {
                setActiveUser(e);
                onSelectorItemClicked(e, "updateSelectedItemUser");
              }}
            />
          )}
          {activeTab === "groups" && (
            <CometChatGroups
              activeGroup={activeGroup}
              onItemClick={(e) => {
                setActiveGroup(e);
                onSelectorItemClicked(e, "updateSelectedItemGroup");
              }}
            />
          )}
        </>
      )}
      <CometChatTabs
        activeTab={activeTab}
        onTabClicked={(t) => setActiveTab(t.name.toLowerCase())}
      />
    </>
  );
};
```

**Full `src/app/cometchat/CometChatNoSSR.tsx`** (tab experience):
```tsx
"use client";
import React, { useEffect, useState } from "react";
import {
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatUIKit,
  UIKitSettingsBuilder,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatSelector } from "./CometChatSelector";
// css-variables.css is imported in app/globals.css — do NOT import it here
import "./CometChatNoSSR.css";

const COMETCHAT_CONSTANTS = {
  APP_ID: process.env.NEXT_PUBLIC_COMETCHAT_APP_ID!,
  REGION: process.env.NEXT_PUBLIC_COMETCHAT_REGION!,
  AUTH_KEY: process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY!,
};
const UID = "UID"; // replace with the login UID

const CometChatNoSSR: React.FC = () => {
  const [user, setUser] = useState<CometChat.User | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CometChat.User | undefined>();
  const [selectedGroup, setSelectedGroup] = useState<CometChat.Group | undefined>();

  useEffect(() => {
    const settings = new UIKitSettingsBuilder()
      .setAppId(COMETCHAT_CONSTANTS.APP_ID)
      .setRegion(COMETCHAT_CONSTANTS.REGION)
      .setAuthKey(COMETCHAT_CONSTANTS.AUTH_KEY)
      .subscribePresenceForAllUsers()
      .build();

    CometChatUIKit.init(settings)?.then(() => {
      CometChatUIKit.getLoggedinUser().then((u) => {
        if (!u) {
          CometChatUIKit.login(UID)
            .then(setUser)
            .catch((e: unknown) => setError(String(e)));
        } else {
          setUser(u);
        }
      });
    }).catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{error}</div>;
  if (!user) return null;

  return (
    <div className="conversations-with-messages">
      <div className="conversations-wrapper">
        <CometChatSelector
          onSelectorItemClicked={(activeItem) => {
            const item =
              activeItem instanceof CometChat.Conversation
                ? activeItem.getConversationWith()
                : activeItem;
            if (item instanceof CometChat.User) {
              setSelectedUser(item);
              setSelectedGroup(undefined);
            } else if (item instanceof CometChat.Group) {
              setSelectedUser(undefined);
              setSelectedGroup(item);
            }
          }}
        />
      </div>
      {selectedUser || selectedGroup ? (
        <div className="messages-wrapper">
          {selectedUser && <CometChatMessageHeader user={selectedUser} />}
          {selectedGroup && <CometChatMessageHeader group={selectedGroup} />}
          {selectedUser && <CometChatMessageList user={selectedUser} />}
          {selectedGroup && <CometChatMessageList group={selectedGroup} />}
          {selectedUser && <CometChatMessageComposer user={selectedUser} />}
          {selectedGroup && <CometChatMessageComposer group={selectedGroup} />}
        </div>
      ) : (
        <div className="empty-conversation">Select a conversation to start chatting</div>
      )}
    </div>
  );
};
export default CometChatNoSSR;
```

Use the same `CometChatNoSSR.css` as Experience 1.

---

## Step 8 — Substitute Credentials

Replace `"APP_ID"`, `"REGION"`, `"AUTH_KEY"`, `"UID"` in all generated files with values from `.env.local`.

---

## Step 9 — Run

```bash
npm run dev
```

---

## Agent Verification Checklist

Before finishing, verify each item and report pass or fail:

- [ ] `npm run build` exits with no TypeScript errors
- [ ] `css-variables.css` imported exactly once (first line of `app/globals.css`, not inside `CometChatNoSSR.tsx`)
- [ ] No component renders before `login()` resolves (`if (!user) return null` guard in place)
- [ ] `user` and `group` never both passed to the same component instance (conditional rendering used)
- [ ] Visible error UI reachable on init/login failure (`if (error) return <div ...>` renders the message)
- [ ] No Auth Key in source files (only in `.env.local`)

### Runtime verification (browser)

**Experience 1 — Conversation List + Message View:**
- [ ] Conversation list renders in left panel with at least one conversation
- [ ] Clicking a conversation shows MessageHeader, MessageList, and MessageComposer on the right
- [ ] Sending a message appears in the list in real time
- [ ] Selecting a group conversation shows group name in header

**Experience 2 — One-to-One Chat:**
- [ ] MessageHeader shows the target user's name and avatar
- [ ] MessageList shows existing message history (or empty state)
- [ ] MessageComposer accepts input and sends on Enter/button click

**Experience 3 — Tab-Based Chat:**
- [ ] Tab bar visible at bottom of left panel with CHATS / CALLS / USERS / GROUPS
- [ ] Each tab click switches the list component
- [ ] Selecting a user from USERS tab opens message view on the right
- [ ] Selecting a group from GROUPS tab opens message view on the right

---

## Step 8 — Go to Production (Real Users + Auth Tokens)

> Follow this step when the user asks to "go to production", "connect real users", "replace cometchat-uid-1", or "remove Auth Key". Follow the Production Auth section of `cometchat-react-core` for shared concepts.

### 1. Add API Key to server environment

```bash
# .env.local — add this (server-only, no NEXT_PUBLIC_ prefix)
COMETCHAT_API_KEY=your_rest_api_key_from_dashboard
```

Get REST API Key from CometChat Dashboard → API & Auth Keys → REST API Key.

### 2. Create CometChat user at sign-up

In your NextAuth callback, Clerk webhook, or sign-up handler:

```ts
// lib/cometchat.ts (server-side utility)
export async function createCometChatUser(uid: string, name: string) {
  await fetch(`https://api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users`, {
    method: 'POST',
    headers: {
      apiKey: process.env.COMETCHAT_API_KEY!,
      appId: process.env.COMETCHAT_APP_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, name }),
  });
}

// Call from your sign-up route / NextAuth createUser callback:
// await createCometChatUser(user.id, user.name)
```

### 3. Create auth token endpoint

```ts
// app/api/cometchat-token/route.ts
import { getServerSession } from 'next-auth'; // or: auth() from Clerk, getUser() from Supabase, etc.
import { authOptions } from '@/lib/auth';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uid = session.user.id; // your app's user ID = CometChat UID

  const res = await fetch(
    `https://api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users/${uid}/auth_tokens`,
    {
      method: 'POST',
      headers: {
        apiKey: process.env.COMETCHAT_API_KEY!,
        appId: process.env.COMETCHAT_APP_ID!,
      },
    }
  );
  const { data } = await res.json();
  return Response.json({ authToken: data.authToken });
}
```

Adapt `session.user.id` to your auth provider:
- **NextAuth** → `session.user.id`
- **Clerk** → `auth().userId`
- **Supabase** → `supabase.auth.getUser()` → `user.id`
- **Custom JWT** → verify token, extract `sub` / `userId`

### 4. Update CometChatNoSSR.tsx to use loginWithAuthToken

```tsx
// src/app/cometchat/CometChatNoSSR.tsx — update init block
const settings = new UIKitSettingsBuilder()
  .setAppId(process.env.NEXT_PUBLIC_COMETCHAT_APP_ID!)
  .setRegion(process.env.NEXT_PUBLIC_COMETCHAT_REGION!)
  // remove .setAuthKey() entirely
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(settings)?.then(async () => {
  const existing = await CometChatUIKit.getLoggedinUser();
  if (!existing) {
    try {
      const res = await fetch('/api/cometchat-token', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to get auth token');
      const { authToken } = await res.json();
      await CometChatUIKit.loginWithAuthToken(authToken);
      setUser(await CometChatUIKit.getLoggedinUser());
    } catch (e) {
      setError(String(e));
    }
  } else {
    setUser(existing);
  }
}).catch((e) => setError(String(e)));
```

### 5. Remove Auth Key from .env.local

```bash
# .env.local — remove this line:
# NEXT_PUBLIC_COMETCHAT_AUTH_KEY=...

# Keep:
NEXT_PUBLIC_COMETCHAT_APP_ID=...
NEXT_PUBLIC_COMETCHAT_REGION=...
COMETCHAT_API_KEY=...          # server-only
```

### Verification

- [ ] `/api/cometchat-token` returns 401 when called without a session
- [ ] Signing in as User A and User B in separate windows → both see each other in conversations
- [ ] No `AUTH_KEY` in any `.env.local` or source file
- [ ] `COMETCHAT_API_KEY` has no `NEXT_PUBLIC_` prefix (server-only)
