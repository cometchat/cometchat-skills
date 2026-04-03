---
name: cometchat-react-astro
description: Use this skill when integrating CometChat React UI Kit v6 into an Astro app using React islands, including client:only rendering, setup, login, conversations, one-to-one chat, and tab-based chat. Do not use for plain React, Next.js, or React Router.
license: "MIT"
compatibility: "Node.js >=16; Astro >=4; @astrojs/react; @cometchat/chat-uikit-react ^6; Claude Code or any agentskills.io-compatible agent"
allowed-tools: "readFile, readCode, readMultipleFiles, grepSearch, fileSearch, listDirectory, fsWrite, strReplace, executeBash, getDiagnostics"
metadata:
  author: "CometChat"
  version: "1.0.0"
  tags: "chat cometchat astro react islands messaging ui-kit conversations one-to-one"
---

## Use this skill when

Trigger this skill when the request involves any of the following:
- integrate CometChat in Astro
- add chat to an Astro app
- CometChat Astro UI Kit setup
- CometChat with React islands in Astro
- CometChat conversations in Astro
- one-to-one chat with CometChat in Astro
- tab-based chat using CometChat in Astro
- client:only React component with CometChat
- initialize CometChat UI Kit in Astro
- login a CometChat user in Astro

## Do not use this skill when

- the project uses plain React (Vite/CRA) → use `cometchat-react-reactjs` instead
- the project uses Next.js → use `cometchat-react-nextjs` instead
- the project uses React Router → use `cometchat-react-react-router` instead
- the user is asking about Android, iOS, Flutter, React Native, Angular, or Vue
- the user needs backend-only CometChat REST API calls (no UI)

## Output rules

When generating code with this skill:
- use `tsx` for React island components
- placeholders must be explicit: `YOUR_APP_ID`, `YOUR_REGION`, `YOUR_AUTH_KEY`, `YOUR_UID`
- always use `client:only="react"` on the component in `.astro` files — no other SSR pattern works
- always import `css-variables.css` inside the React island `.tsx` file — never in `.astro` global stylesheets
- use `PUBLIC_` prefix for all client-side env vars (`import.meta.env.PUBLIC_*`)
- show which file each snippet belongs to

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank screen | `client:only="react"` missing from component in `.astro` | Add `client:only="react"` directive to the component tag |
| Broken styles | `css-variables.css` imported in `.astro` global stylesheet | Move import inside the React island `.tsx` file, remove from `.astro` |
| Broken styles | `css-variables.css` not imported at all | Add `import "@cometchat/chat-uikit-react/css-variables.css"` inside `ChatApp.tsx` |
| `401 Unauthorized` | Wrong App ID or Auth Key | Check `.env` values match the CometChat dashboard |
| TypeScript error "possibly undefined" | `init().then()` used | Change to `init()?.then()` |
| Blank screen | `login()` called before `init()` resolves | Move `login()` inside `init()?.then()` |
| `@astrojs/react` not found | React integration not installed | Run `npx astro add react` |

## HARD RULES

```
- Do not duplicate CSS imports — grep for css-variables.css before adding
- css-variables.css MUST be inside the React island .tsx file — NEVER in .astro global stylesheets
  (global stylesheets do not apply to client:only React islands — this is an Astro constraint)
- If css-variables.css is currently in a .astro file → MOVE it to the island .tsx file, remove from .astro
- Do not recreate existing pages or components
- Do not overwrite files with real business logic — PATCH only
- Infer credentials from .env or existing CometChatUIKit.init before asking
- Never introduce Auth Key if /api/auth or /api/cometchat-token exists
- init() → login() → render: never break this order
- client:only="react" is the ONLY valid SSR prevention for Astro — no other pattern works
- Return null (not undefined) from components on loading/empty states
```

---

## AGENT CONTRACT

**Goal:** Integrate CometChat React UI Kit v6 into an Astro app using React islands — experience chosen by user.

**Required inputs:**
- `PUBLIC_COMETCHAT_APP_ID` (string)
- `PUBLIC_COMETCHAT_REGION` ("us" | "eu" | "in")
- `PUBLIC_COMETCHAT_AUTH_KEY` (string, dev only) OR existing auth token endpoint
- Login UID (string) — default: `cometchat-uid-1`
- Experience: "conversation-list" | "one-to-one" | "tab"

**Output files:**
- `.env` — credentials
- `src/pages/index.astro` — Astro page with `<ChatApp client:only="react" />`
- `src/cometchat/ChatApp.tsx` — React island: init + login + experience UI
- `src/cometchat/ChatApp.css` — layout styles (imported inside the island)
- `src/cometchat/CometChatSelector.tsx` — (Experience 1 and 3 only)
- `src/cometchat/CometChatTabs.tsx` + `CometChatTabs.css` — (Experience 3 only)
- `public/assets/*.svg` — (Experience 3 only)

**Invariants:**
1. `init()` MUST resolve before `login()`
2. `login()` MUST resolve before any component renders (`if (!user) return null` guard)
3. `css-variables.css` imported exactly once — inside the React island `.tsx` file, NOT in any `.astro` global stylesheet
4. Never pass `user` AND `group` to the same component instance
5. SSR rule: `client:only="react"` on the component in the `.astro` file — this is the ONLY way to prevent server-side execution

**Failure modes:**
- Blank screen → `client:only="react"` missing from component in `.astro` file
- `401 Unauthorized` → wrong App ID or Auth Key
- Broken styles → `css-variables.css` imported in global stylesheet instead of inside the island, or missing entirely
- TypeScript error `Object is possibly undefined` → use `init()?.then()` not `init().then()`

**Completion criteria:**
- `npm run build` exits 0 with no TypeScript errors
- `css-variables.css` imported exactly once, inside `ChatApp.tsx` (not in any `.astro` file)
- Chat UI loads and messages are visible
- No CometChat errors in browser console

---

## DECISION LOGIC

```
// Stop early if wrong skill
IF "astro" is NOT in package.json → STOP, use the correct framework skill
IF "next" in package.json → STOP, use cometchat-react-nextjs instead
IF "@react-router/dev" in package.json OR "react-router" in dependencies → STOP, use cometchat-react-react-router instead

// React integration
IF "@astrojs/react" already in dependencies AND astro.config.mjs has integrations: [react()] → skip npx astro add react
IF @astrojs/react missing → run npx astro add react (installs @astrojs/react, react, react-dom and updates config automatically)

// Auth strategy
IF server-side auth token endpoint exists (e.g. /api/auth, /api/cometchat-token) → use loginWithAuthToken(), do NOT use Auth Key
IF project is clearly dev/demo with no existing auth → use login(UID) with Auth Key (add TODO comment for production)

// Credential source
IF .env already has PUBLIC_COMETCHAT_APP_ID → reuse, do NOT overwrite
IF CometChatUIKit.init call already exists in source → extract credentials from there

// File operations
IF file exists AND contains app logic beyond boilerplate → PATCH only, preserve all existing logic
IF file exists AND is boilerplate stub (placeholder content only) → REPLACE allowed
IF file does not exist → CREATE

// CSS import — CRITICAL for Astro
IF css-variables.css already imported inside a .tsx React island file → DO NOT add again
IF css-variables.css imported in a .astro global stylesheet → MOVE it to the React island file, remove from .astro
IF not imported anywhere → add inside ChatApp.tsx (the React island), NEVER in a .astro file
```

---

## QUICK INTEGRATION

Fast path for Experience 1 (Conversation List + Message View) on a fresh Astro + React project.

**1. Install**
```bash
npx astro add react   # if @astrojs/react not already installed
npm install @cometchat/chat-uikit-react
```

**2. `.env`**
```
PUBLIC_COMETCHAT_APP_ID=your_app_id
PUBLIC_COMETCHAT_REGION=us
PUBLIC_COMETCHAT_AUTH_KEY=your_auth_key
```

**3. `src/pages/index.astro` — use client:only="react"**
```astro
---
import ChatApp from "../cometchat/ChatApp.tsx";
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>CometChat</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; }
    </style>
  </head>
  <body>
    <ChatApp client:only="react" />
  </body>
</html>
```

**4. `src/cometchat/ChatApp.tsx` — key init/login/render snippet**
```tsx
import { useEffect, useState } from "react";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import "@cometchat/chat-uikit-react/css-variables.css"; // MUST be here, not in .astro
import "./ChatApp.css";

const UID = "cometchat-uid-1"; // TODO: replace with real UID in production

export default function ChatApp() {
  const [user, setUser] = useState<CometChat.User | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settings = new UIKitSettingsBuilder()
      .setAppId(import.meta.env.PUBLIC_COMETCHAT_APP_ID as string)
      .setRegion(import.meta.env.PUBLIC_COMETCHAT_REGION as string)
      .setAuthKey(import.meta.env.PUBLIC_COMETCHAT_AUTH_KEY as string)
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
}
```

**5. Run**
```bash
npm run dev
```

For other experiences (One-to-One, Tab-Based), see Steps 7B and 7C below.

---

# CometChat + Astro Integration

Integrate CometChat React UI Kit v6 into an Astro app using React islands. CometChat requires browser APIs — use `client:only="react"` to skip SSR entirely.

Follow all rules in `cometchat-react-core`. The invariants and decision logic in core override anything in this file.

This skill owns: SSR pattern (`client:only="react"` directive), env prefix (`PUBLIC_`), CSS rule (import inside React island only — NOT global stylesheet), file layout, and experience code examples.

**Minimal diff rule:** Prefer integrating into the user's current app structure. Only scaffold a demo structure when the repository is clearly a starter app.

**CSS note for Astro:** Component-level CSS import is required inside each React island. Global stylesheets (imported in `.astro` files) do not apply to React islands rendered with `client:only`. Do not add `css-variables.css` to the global stylesheet — import it directly in the `.tsx` file.

---

## Step 0 — Check Existing State and Hard Rules

**No-duplicate rules — check these before writing anything:**
- Do not add duplicate CSS imports (`css-variables.css` must appear exactly once, inside the React island `.tsx` file).
- Do not create a duplicate chat route if one already exists.
- Do not recreate components that already exist — patch them instead.

Before writing any files:
1. Read `package.json` — if `@cometchat/chat-uikit-react` is already in dependencies, skip the install step. If `@astrojs/react` is already present, skip `npx astro add react`.
2. Read `astro.config.mjs` — if `integrations: [react()]` is already there, do not modify it.
3. Check if `.env` or `.env.development` exists — if it already has `PUBLIC_COMETCHAT_APP_ID`, reuse those values. Only ask the user for credentials that are missing.
4. Check if `src/cometchat/ChatApp.tsx` already exists — if so, read it and patch only what is missing rather than overwriting. If it already has app logic, patch minimally — do not replace.
5. Check if existing `.astro` pages have real content — if so, DO NOT modify them. Create a new `src/pages/chat.astro` page instead. See Pattern F in `cometchat-react-core` EXISTING PROJECT PATCH GUIDE.

**EXISTING PROJECT STRATEGY:**
- DO NOT modify `astro.config.mjs` if `@astrojs/react` is already configured
- DO NOT run `npx astro add react` if `@astrojs/react` is already in dependencies
- DO NOT modify existing `.astro` pages (index.astro, etc.) if they have real content
- DO NOT modify `src/layouts/Layout.astro`
- CREATE `src/pages/chat.astro` as a new page for the chat UI
- CREATE `src/cometchat/ChatApp.tsx` as the React island component

**PLACEMENT — dedicated page vs inline embed:**
The dispatcher (Step 4) asks the user where to place the chat:
- **Dedicated `/chat` page** (default): create `src/pages/chat.astro` with `<ChatApp client:only="react" />`.
- **Embed in existing page**: if the user named a specific page (e.g., `index.astro`), patch that page to add `<ChatApp client:only="react" />` at the location they specify. Import `ChatApp` at the top of the frontmatter block.

**THEMING:**
If the dispatcher's Step 6b theming question was answered "yes", after completing the integration ask:
> "What's your app's primary brand color and font family?"
Then add CSS variable overrides inside `ChatApp.tsx` after the `css-variables.css` import (Astro constraint — must be in the island), following the Theming section in `cometchat-react-core`.

**Concrete existing-project example (Astro with existing pages + layout):**

Given an existing `src/pages/index.astro` with real content and a Layout, DO NOT modify it.

Instead, CREATE `src/pages/chat.astro`:
```astro
---
import ChatApp from "../cometchat/ChatApp.tsx";
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Chat</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; }
    </style>
  </head>
  <body>
    <ChatApp client:only="react" />
  </body>
</html>
```

Then CREATE `src/cometchat/ChatApp.tsx` and `src/cometchat/ChatApp.css` as new files.

Leave `src/pages/index.astro`, `src/layouts/Layout.astro`, and `astro.config.mjs` completely untouched.

---

## Step 1 — Confirm Framework and Version

Read `package.json`. Confirm `"astro"` is in dependencies. If not, use the correct framework skill.

Check whether `@astrojs/react` is already installed:
- If `"@astrojs/react"` is in dependencies and `astro.config.mjs` already has `integrations: [react()]` → skip Step 3's `npx astro add react` command.
- If missing → run `npx astro add react` which installs `@astrojs/react`, `react`, and `react-dom` and updates `astro.config.mjs` automatically.

Astro uses `import.meta.env` for all env vars (same as Vite), with `PUBLIC_` prefix for browser-exposed vars.

---

## Step 2 — Collect Credentials (Infer First)

Execute in order before asking the user anything:

1. Read `.env` and `.env.development` — if `PUBLIC_COMETCHAT_APP_ID` exists, reuse it. Do NOT overwrite.
2. Grep source for `CometChatUIKit.init` — extract APP_ID, REGION, AUTH_KEY from existing call.
3. Check for auth token endpoint (`/api/auth`, `/api/cometchat-token`) — if found, plan to use `loginWithAuthToken()`. Do not add Auth Key.
4. Default `LOGIN_UID` to `cometchat-uid-1` unless a different UID is evident from the codebase.

Only ask for values still missing after steps 1–4. If experience was passed as an argument to the dispatcher, skip asking about it.

---

## Step 3 — Install

Add React integration to Astro (if not already added):
```bash
npx astro add react
```

Verify `astro.config.mjs` includes:
```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
export default defineConfig({ integrations: [react()] });
```

Then install the UI Kit:
```bash
npm install @cometchat/chat-uikit-react
```

---

## Step 4 — Write credentials to `.env`

Only create or update `.env` if `PUBLIC_COMETCHAT_APP_ID` is not already present. Add `.env` to `.gitignore` if not already there.

```
PUBLIC_COMETCHAT_APP_ID=your_app_id
PUBLIC_COMETCHAT_REGION=us
PUBLIC_COMETCHAT_AUTH_KEY=your_auth_key
```

> Warning: Auth Key is for development only. In production, omit `PUBLIC_COMETCHAT_AUTH_KEY` and use server-generated Auth Tokens with `loginWithAuthToken()` instead.

---

## Step 5 — Render the Island in an Astro Page

Read `src/pages/index.astro` first.

**CRITICAL DECISION:**
- If `src/pages/index.astro` is a demo stub (just "Welcome to Astro" or similar) → REPLACE with the code below.
- If `src/pages/index.astro` has real content (existing layout, navigation, app logic) → DO NOT modify it. CREATE `src/pages/chat.astro` instead with the code below (change the import path and title accordingly). See EXISTING PROJECT STRATEGY above.

`client:only="react"` ensures the component is skipped during SSR and only hydrates in the browser.

**`src/pages/index.astro`**
```astro
---
import ChatApp from "../cometchat/ChatApp.tsx";
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>CometChat</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; }
    </style>
  </head>
  <body>
    <ChatApp client:only="react" />
  </body>
</html>
```

Note: The `<style>` block handles only layout — CometChat CSS variables are imported inside the React island itself.

---

## Step 6 — Shell Pattern (all experiences)

All Astro chat experiences are self-contained React islands. Init, login, and rendering all happen client-side. `CometChatUIKit.init(settings)` returns `Promise | undefined` in Astro's environment — use `?.then(...)` not `.then(...)`.

```tsx
import { useEffect, useState } from "react";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import "@cometchat/chat-uikit-react/css-variables.css"; // must be here — not in global stylesheet
// import experience-specific components below

const COMETCHAT_CONSTANTS = {
  APP_ID: import.meta.env.PUBLIC_COMETCHAT_APP_ID as string,
  REGION: import.meta.env.PUBLIC_COMETCHAT_REGION as string,
  AUTH_KEY: import.meta.env.PUBLIC_COMETCHAT_AUTH_KEY as string,
};
const UID = "UID"; // replace with the login UID

export default function ChatApp() {
  const [user, setUser] = useState<CometChat.User | undefined>();
  const [error, setError] = useState<string | null>(null);

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
  // render experience UI here
}
```

---

## Step 7A — Experience 1: Conversation List + Message View

**`src/cometchat/ChatApp.tsx`**
```tsx
import { useEffect, useState } from "react";
import {
  CometChatConversations,
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatUIKit,
  UIKitSettingsBuilder,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import "@cometchat/chat-uikit-react/css-variables.css";
import "./ChatApp.css";

const COMETCHAT_CONSTANTS = {
  APP_ID: import.meta.env.PUBLIC_COMETCHAT_APP_ID as string,
  REGION: import.meta.env.PUBLIC_COMETCHAT_REGION as string,
  AUTH_KEY: import.meta.env.PUBLIC_COMETCHAT_AUTH_KEY as string,
};
const UID = "UID"; // replace with the login UID

export default function ChatApp() {
  const [user, setUser] = useState<CometChat.User | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CometChat.User | undefined>();
  const [selectedGroup, setSelectedGroup] = useState<CometChat.Group | undefined>();
  const [activeConversation, setActiveConversation] = useState<CometChat.Conversation | undefined>();

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
        <CometChatConversations
          activeConversation={activeConversation}
          onItemClick={(conversation) => {
            setActiveConversation(conversation);
            const item = conversation.getConversationWith();
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
}
```

**`src/cometchat/ChatApp.css`**
```css
.conversations-with-messages { display: flex; height: 100%; width: 100%; }
.conversations-wrapper { height: 100%; width: 480px; overflow: hidden; display: flex; flex-direction: column; }
.conversations-wrapper > .cometchat { overflow: hidden; }
.messages-wrapper { width: calc(100% - 480px); height: 100%; display: flex; flex-direction: column; }
.empty-conversation { height: 100%; width: 100%; display: flex; justify-content: center; align-items: center; background: var(--cometchat-background-color-03, #F5F5F5); color: var(--cometchat-text-color-secondary, #727272); }
.cometchat .cometchat-message-composer { border-radius: 0; }
```

---

## Step 7B — Experience 2: One-to-One / Group Chat

**`src/cometchat/ChatApp.tsx`**
```tsx
import { useEffect, useState } from "react";
import {
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatUIKit,
  UIKitSettingsBuilder,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import "@cometchat/chat-uikit-react/css-variables.css";
import "./ChatApp.css";

const COMETCHAT_CONSTANTS = {
  APP_ID: import.meta.env.PUBLIC_COMETCHAT_APP_ID as string,
  REGION: import.meta.env.PUBLIC_COMETCHAT_REGION as string,
  AUTH_KEY: import.meta.env.PUBLIC_COMETCHAT_AUTH_KEY as string,
};
const LOGIN_UID = "UID"; // replace with login UID
const CHAT_UID = "cometchat-uid-1"; // replace with target UID

export default function ChatApp() {
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
}
```

**`src/cometchat/ChatApp.css`** (one-to-one)
```css
.messages-wrapper { width: 100%; height: 100%; display: flex; flex-direction: column; }
.empty-conversation { height: 100%; width: 100%; display: flex; justify-content: center; align-items: center; background: var(--cometchat-background-color-03, #F5F5F5); color: var(--cometchat-text-color-secondary, #727272); }
.cometchat .cometchat-message-composer { border-radius: 0; }
```

Update `index.astro` to import `ChatApp` from `../cometchat/ChatApp.tsx`.

---

## Step 7C — Experience 3: Tab-Based Chat

**IMPORTANT:** Experience 3 builds on Experience 1. Follow these steps in order:
1. First, create ALL the same files as Experience 1 (Step 7A) — `ChatApp.tsx`, `ChatApp.css`, `CometChatSelector.tsx`, and the chat page.
2. Then, add the tab components below and replace `CometChatSelector.tsx` with the tab-aware version.
3. The `ChatApp.tsx` and `ChatApp.css` are IDENTICAL to Experience 1 — do not change them.

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

**`src/cometchat/CometChatTabs.tsx`**
```tsx
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

**`src/cometchat/CometChatTabs.css`**
```css
.cometchat-tab-component { display: flex; width: 100%; padding: 0 8px; gap: 8px; border-top: 1px solid var(--cometchat-border-color-light, #F5F5F5); background: var(--cometchat-background-color-01, #FFF); }
.cometchat-tab-component__tab { display: flex; padding: 12px 0 10px; flex-direction: column; align-items: center; gap: 4px; flex: 1; min-height: 48px; cursor: pointer; }
.cometchat-tab-component__tab-icon { width: 32px; height: 32px; background: var(--cometchat-icon-color-secondary, #A1A1A1); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-size: contain; mask-position: center; mask-repeat: no-repeat; }
.cometchat-tab-component__tab-text { color: var(--cometchat-text-color-secondary, #727272); font: var(--cometchat-font-caption1-medium, 500 12px Roboto); }
.cometchat-tab-component__tab-icon-active { background: var(--cometchat-icon-color-highlight); }
.cometchat-tab-component__tab-text-active { color: var(--cometchat-text-color-highlight); }
```

**`src/cometchat/CometChatSelector.tsx`** (tab-aware version)
```tsx
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

**`src/cometchat/ChatApp.tsx`** (tab experience):
```tsx
import { useEffect, useState } from "react";
import {
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatUIKit,
  UIKitSettingsBuilder,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatSelector } from "./CometChatSelector";
import "@cometchat/chat-uikit-react/css-variables.css";
import "./ChatApp.css";

const COMETCHAT_CONSTANTS = {
  APP_ID: import.meta.env.PUBLIC_COMETCHAT_APP_ID as string,
  REGION: import.meta.env.PUBLIC_COMETCHAT_REGION as string,
  AUTH_KEY: import.meta.env.PUBLIC_COMETCHAT_AUTH_KEY as string,
};
const UID = "UID"; // replace with the login UID

export default function ChatApp() {
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
}
```

Use the same `ChatApp.css` as Experience 1.

Update `index.astro` to import `ChatApp` from `../cometchat/ChatApp.tsx`.

---

## Step 8 — Substitute Credentials

Replace `"APP_ID"`, `"REGION"`, `"AUTH_KEY"`, `"UID"` in all generated files with values from `.env`.

---

## Step 9 — Run

```bash
npm run dev
```

---

## Agent Verification Checklist

Before finishing, verify each item and report pass or fail:

- [ ] `npm run build` exits with no TypeScript errors
- [ ] `css-variables.css` imported exactly once, inside the React island `.tsx` file (not in any `.astro` global stylesheet)
- [ ] No component renders before `login()` resolves (`if (!user) return null` guard in place)
- [ ] `user` and `group` never both passed to the same component instance (conditional rendering used)
- [ ] Visible error UI reachable on init/login failure (`if (error) return <div ...>` renders the message)
- [ ] No Auth Key in source files (only in `.env`)

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
# .env — add this (no PUBLIC_ prefix — server-only)
COMETCHAT_API_KEY=your_rest_api_key_from_dashboard
```

### 2. Create CometChat user at sign-up

```ts
// src/lib/cometchat.ts (server-side utility, import only in .astro or API endpoints)
export async function createCometChatUser(uid: string, name: string) {
  await fetch(`https://api-${import.meta.env.COMETCHAT_REGION}.cometchat.io/v3/users`, {
    method: 'POST',
    headers: {
      apiKey: import.meta.env.COMETCHAT_API_KEY,
      appId: import.meta.env.COMETCHAT_APP_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, name }),
  });
}
```

### 3. Create auth token API endpoint

```ts
// src/pages/api/cometchat-token.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, request }) => {
  // Get logged-in user ID from your auth system
  // Adapt to your provider: Astro sessions, Lucia, Auth.js, custom cookie, etc.
  const uid = cookies.get('userId')?.value;

  if (!uid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const res = await fetch(
    `https://api-${import.meta.env.COMETCHAT_REGION}.cometchat.io/v3/users/${uid}/auth_tokens`,
    {
      method: 'POST',
      headers: {
        apiKey: import.meta.env.COMETCHAT_API_KEY,
        appId: import.meta.env.COMETCHAT_APP_ID,
      },
    }
  );
  const { data } = await res.json();
  return new Response(JSON.stringify({ authToken: data.authToken }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### 4. Update ChatApp.tsx (React island) to use loginWithAuthToken

```tsx
// src/cometchat/ChatApp.tsx — update init block
const settings = new UIKitSettingsBuilder()
  .setAppId(import.meta.env.PUBLIC_COMETCHAT_APP_ID)
  .setRegion(import.meta.env.PUBLIC_COMETCHAT_REGION)
  // remove .setAuthKey() entirely
  .subscribePresenceForAllUsers()
  .build();

useEffect(() => {
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
}, []);
```

### 5. Remove Auth Key from .env

```bash
# .env — remove:
# PUBLIC_COMETCHAT_AUTH_KEY=...

# Keep:
PUBLIC_COMETCHAT_APP_ID=...
PUBLIC_COMETCHAT_REGION=...
COMETCHAT_API_KEY=...     # no PUBLIC_ prefix — server-only
```

### Verification

- [ ] `POST /api/cometchat-token` returns 401 when called without a valid session cookie
- [ ] Two users signed in separately see each other's messages in real time
- [ ] No `AUTH_KEY` in `.env` or `.tsx` source files
- [ ] `COMETCHAT_API_KEY` has no `PUBLIC_` prefix
