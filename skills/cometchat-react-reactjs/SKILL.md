---
name: cometchat-react-reactjs
description: Use this skill when integrating CometChat React UI Kit v6 into a React app (Vite or Create React App), including setup, login, conversations, one-to-one chat, and tab-based chat. Do not use for Next.js, React Router, or Astro.
license: "MIT"
compatibility: "Node.js >=16; React >=18; Vite >=4 or react-scripts (CRA); @cometchat/chat-uikit-react ^6; Claude Code or any agentskills.io-compatible agent"
allowed-tools: "readFile, readCode, readMultipleFiles, grepSearch, fileSearch, listDirectory, fsWrite, strReplace, executeBash, getDiagnostics"
metadata:
  author: "CometChat"
  version: "1.0.0"
  tags: "chat cometchat react vite cra messaging ui-kit conversations one-to-one"
---

## Use this skill when

Trigger this skill when the request involves any of the following:
- integrate CometChat in React / Vite / Create React App
- add chat to a React app
- add messaging to a React app
- CometChat React UI Kit setup
- CometChat conversations component in React
- one-to-one chat with CometChat in React
- tab-based chat using CometChat in React
- initialize CometChat UI Kit in React
- login a CometChat user in React
- build a chat screen in React with CometChat

## Do not use this skill when

- the project uses Next.js → use `cometchat-react-nextjs` instead
- the project uses React Router → use `cometchat-react-react-router` instead
- the project uses Astro → use `cometchat-react-astro` instead
- the user is asking about Android, iOS, Flutter, React Native, Angular, or Vue
- the user needs backend-only CometChat REST API calls (no UI)

## Output rules

When generating code with this skill:
- use `tsx` for TypeScript projects, `jsx` for JavaScript
- placeholders must be explicit: `YOUR_APP_ID`, `YOUR_REGION`, `YOUR_AUTH_KEY`, `YOUR_UID`
- prefer minimal runnable examples — no unnecessary abstractions
- always show which file each snippet belongs to
- never hardcode credentials in source files — always use env vars
- use `VITE_` prefix for Vite projects, `REACT_APP_` for CRA

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank screen after login | `login()` called before `init()` resolves | Move `login()` inside `init()?.then()` |
| Blank screen | Component renders before `login()` resolves | Gate render with `mount()` called only after `login()` resolves |
| Broken styles | `css-variables.css` not imported | Add `@import url("@cometchat/chat-uikit-react/css-variables.css")` to `src/index.css` |
| Broken styles | `css-variables.css` imported twice | Remove duplicate — keep only the one in `src/index.css` |
| `401 Unauthorized` | Wrong App ID or Auth Key | Check `.env` values match the CometChat dashboard exactly |
| TypeScript error "possibly undefined" | `init().then()` used | Change to `init()?.then()` |
| Chat UI doesn't fill screen | Missing `html, body { height: 100% }` | Add to `src/index.css` |
| Auth Key in source file | Credentials hardcoded | Move to `.env`, use `import.meta.env.VITE_COMETCHAT_AUTH_KEY` |

## HARD RULES

```
- Do not duplicate CSS imports — grep for css-variables.css before adding
- Do not recreate existing routes — read App.tsx / router config first
- Do not overwrite files with real business logic — PATCH only
- If App.tsx has auth, dashboard, headers, or any real UI → DO NOT REPLACE IT. Create components in src/cometchat/ and add a single import + render into the existing JSX.
- Infer credentials from .env or existing CometChatUIKit.init before asking
- Never introduce Auth Key if /api/auth or /api/cometchat-token exists
- init() → login() → render: never break this order
- Return null (not undefined) from components on loading/empty states
- Bundler affects env prefix: VITE_ (Vite) vs REACT_APP_ (CRA) — detect from package.json
```

---

## AGENT CONTRACT

**Goal:** Integrate CometChat React UI Kit v6 into a React.js (Vite or Create React App) app — experience chosen by user.

**Required inputs:**
- `VITE_COMETCHAT_APP_ID` (Vite) or `REACT_APP_COMETCHAT_APP_ID` (CRA) — string
- `VITE_COMETCHAT_REGION` (Vite) or `REACT_APP_COMETCHAT_REGION` (CRA) — "us" | "eu" | "in"
- `VITE_COMETCHAT_AUTH_KEY` (Vite) or `REACT_APP_COMETCHAT_AUTH_KEY` (CRA) — string, dev only; OR existing auth token endpoint
- Login UID (string) — default: `cometchat-uid-1`
- Experience: "conversation-list" | "one-to-one" | "tab"

**Output files:**
- `.env` — credentials
- `src/index.css` — CSS variables import (top of file)
- `src/main.tsx` — init + login gate + mount
- `src/App.tsx` — experience UI
- `src/App.css` — layout styles
- `src/cometchat/CometChatSelector.tsx` — (Experience 1 and 3 only)
- `src/cometchat/CometChatTabs.tsx` + `CometChatTabs.css` — (Experience 3 only)
- `src/cometchat/assets/*.svg` — (Experience 3 only)

**Invariants:**
1. `init()` MUST resolve before `login()`
2. `login()` MUST resolve before any component renders (app only mounts inside `mount()` callback)
3. `css-variables.css` imported exactly once per app — only in `src/index.css`
4. Never pass `user` AND `group` to the same component instance
5. No SSR concerns — plain React is always client-side; no special SSR handling needed

**Failure modes:**
- Blank screen → init/login order broken OR component rendered before login resolves
- `401 Unauthorized` → wrong App ID or Auth Key
- Broken styles → `css-variables.css` missing or imported twice
- TypeScript error `Object is possibly undefined` → use `init()?.then()` not `init().then()`

**Completion criteria:**
- `npm run build` exits 0 with no TypeScript errors
- `css-variables.css` imported exactly once (in `src/index.css`)
- Chat UI loads and messages are visible
- No CometChat errors in browser console

---

## DECISION LOGIC

```
// Stop early if wrong skill
IF "next" in package.json dependencies → STOP, use cometchat-react-nextjs instead
IF "@react-router/dev" in package.json OR "react-router" in dependencies → STOP, use cometchat-react-react-router instead
IF "astro" in package.json → STOP, use cometchat-react-astro instead

// Bundler detection
IF "vite" in devDependencies → env prefix = VITE_, start command = npm run dev
IF "react-scripts" in dependencies → env prefix = REACT_APP_, start command = npm start, replace all import.meta.env.VITE_ with process.env.REACT_APP_

// Auth strategy
IF server-side auth token endpoint exists (e.g. /api/auth, /api/cometchat-token) → use loginWithAuthToken(), do NOT use Auth Key
IF project is clearly dev/demo with no existing auth → use login(UID) with Auth Key (add TODO comment for production)

// Credential source
IF .env already has VITE_COMETCHAT_APP_ID → reuse, do NOT overwrite
IF CometChatUIKit.init call already exists in source → extract credentials from there

// File operations
IF file exists AND contains app logic beyond boilerplate → PATCH only, preserve all existing logic
IF file exists AND is boilerplate stub (placeholder content only) → REPLACE allowed
IF file does not exist → CREATE

// CSS import
IF css-variables.css already imported anywhere in the project → DO NOT add again
IF not imported → add to top of src/index.css only
```

---

## QUICK INTEGRATION

Fast path for Experience 1 (Conversation List + Message View) on a fresh Vite + React project.

**1. Install**
```bash
npm install @cometchat/chat-uikit-react
```

**2. `.env`**
```
VITE_COMETCHAT_APP_ID=your_app_id
VITE_COMETCHAT_REGION=us
VITE_COMETCHAT_AUTH_KEY=your_auth_key
```

**3. `src/index.css` — top of file**
```css
@import url("@cometchat/chat-uikit-react/css-variables.css");
```

**4. `src/main.tsx` — replace contents**
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import App from "./App.tsx";
import "./index.css";

const settings = new UIKitSettingsBuilder()
  .setAppId(import.meta.env.VITE_COMETCHAT_APP_ID as string)
  .setRegion(import.meta.env.VITE_COMETCHAT_REGION as string)
  .setAuthKey(import.meta.env.VITE_COMETCHAT_AUTH_KEY as string)
  .subscribePresenceForAllUsers()
  .build();

const UID = "cometchat-uid-1"; // TODO: replace with real UID in production

CometChatUIKit.init(settings)
  ?.then(() => {
    CometChatUIKit.getLoggedinUser().then((user) => {
      if (!user) {
        CometChatUIKit.login(UID)
          .then(() => mount())
          .catch((e: unknown) => mountError(String(e)));
      } else {
        mount();
      }
    });
  })
  .catch((e: unknown) => mountError(String(e)));

function mount() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode><App /></StrictMode>
  );
}
function mountError(message: string) {
  createRoot(document.getElementById("root")!).render(
    <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{message}</div>
  );
}
```

**5. Run**
```bash
npm run dev
```

For other experiences (One-to-One, Tab-Based), see Steps 7B and 7C below.

---

# CometChat + React.js Integration

Integrate CometChat React UI Kit v6 into a Vite or Create React App project. No SSR concerns — standard client-side React.

Follow all rules in `cometchat-react-core`. The invariants and decision logic in core override anything in this file.

This skill owns: env prefix (`VITE_`), canonical CSS location (`src/index.css`), file layout, init/login pattern in `main.tsx`, and experience code examples.

**Minimal diff rule:** Prefer integrating into the user's current app structure. Only scaffold a demo structure when the repository is clearly a starter app.

---

## Step 0 — Check Existing State and Hard Rules

**No-duplicate rules — check these before writing anything:**
- Do not add duplicate CSS imports (`css-variables.css` must appear exactly once across all files).
- Do not create a duplicate chat route if one already exists.
- Do not recreate components that already exist — patch them instead.

Before writing any files:
1. Read `package.json` — if `@cometchat/chat-uikit-react` is already in dependencies, skip the install step.
2. Check if `src/main.tsx` already contains `CometChatUIKit.init` — if so, read it and patch only what is missing. Do not overwrite it. If it already has app logic, patch minimally — do not replace.
3. Check if `.env` or `.env.development` exists — if it already has `VITE_COMETCHAT_APP_ID`, reuse those values. Only ask the user for credentials that are missing.
4. Check if `@cometchat/chat-uikit-react/css-variables.css` is already imported anywhere — if so, do not add it again.
5. Check if `src/cometchat/CometChatSelector.tsx` already exists — if so, read it and patch rather than overwriting.
6. Read `src/App.tsx` — if it has ANY real application logic (auth forms, dashboard, headers, state management), DO NOT replace it. Create CometChat components in `src/cometchat/` and add a single import + render into the existing JSX.

**EXISTING PROJECT STRATEGY:**
- DO NOT replace `src/App.tsx` if it has real content (auth, dashboard, headers, etc.)
- DO NOT remove existing imports, components, or logic from any file
- ALWAYS wrap the existing `createRoot().render()` in `src/main.tsx` inside the init → login → mount chain
- CREATE `src/cometchat/` directory for all new CometChat components
- PATCH `src/App.tsx` by adding a single import + component render into the existing JSX

**PLACEMENT — dedicated page vs inline embed:**
The dispatcher (Step 4) asks the user where to place the chat. React.js has no router by default, so:
- **Dedicated page**: not applicable — React.js is a SPA. The chat component fills the app or a section of it.
- **Inline embed**: add `<CometChatSelector />` (or the relevant experience component) inside the existing `App.tsx` JSX at the location the user specifies (e.g., inside `<main>`, after a header, in a sidebar).
- If the user said "embed in an existing page", ask which element/section to place it in, then patch `App.tsx` accordingly.

**THEMING:**
If the dispatcher's Step 6b theming question was answered "yes", after completing the integration ask:
> "What's your app's primary brand color and font family?"
Then add CSS variable overrides to `src/index.css` after the `css-variables.css` import, following the Theming section in `cometchat-react-core`.

**Concrete existing-project example (React + Vite with auth):**

Given an existing `src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
```

Patch it to:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import App from "./App.tsx";
import "./index.css";

const COMETCHAT_CONSTANTS = {
  APP_ID: import.meta.env.VITE_COMETCHAT_APP_ID as string,
  REGION: import.meta.env.VITE_COMETCHAT_REGION as string,
  AUTH_KEY: import.meta.env.VITE_COMETCHAT_AUTH_KEY as string,
};

const settings = new UIKitSettingsBuilder()
  .setAppId(COMETCHAT_CONSTANTS.APP_ID)
  .setRegion(COMETCHAT_CONSTANTS.REGION)
  .setAuthKey(COMETCHAT_CONSTANTS.AUTH_KEY)
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(settings)
  ?.then(() => {
    CometChatUIKit.getLoggedinUser().then((user) => {
      if (!user) {
        CometChatUIKit.login("cometchat-uid-1")
          .then(() => mount())
          .catch((e: unknown) => mountError(String(e)));
      } else {
        mount();
      }
    });
  })
  .catch((e: unknown) => mountError(String(e)));

function mount() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode><App /></StrictMode>
  );
}
function mountError(message: string) {
  createRoot(document.getElementById("root")!).render(
    <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{message}</div>
  );
}
```

Key: The existing `<App />` is preserved inside `mount()`. All existing imports stay. `App.tsx` is NOT touched.

Given an existing `src/App.tsx` with auth logic and a dashboard:
```tsx
// DO NOT REPLACE THIS FILE — only add a CometChat import + render
// Add this import at the top:
import { CometChatSelector } from "./cometchat/CometChatSelector";

// Add the component inside the existing <main> tag:
<main>
  {/* existing content stays */}
  <CometChatSelector />
</main>
```

Create new files in `src/cometchat/` — these are safe to create since the directory doesn't exist yet.

---

## Step 1 — Confirm Framework and Version

Read `package.json`. Confirm: no `next`, no `react-router`, no `astro` in dependencies. If any are present, use the corresponding framework skill instead.

Check the bundler — do NOT hardcode paths:
- `"vite"` in devDependencies → Vite project. Entry: `src/main.tsx`. Env prefix: `VITE_`. Start: `npm run dev`. CSS: `src/index.css`.
- `"react-scripts"` in dependencies → Create React App. Entry: `src/index.tsx`. Env prefix: `REACT_APP_`. Start: `npm start`. CSS: `src/index.css`. Replace all `import.meta.env.VITE_COMETCHAT_*` references with `process.env.REACT_APP_COMETCHAT_*`.

Verify the entry file path by checking whether `src/main.tsx` or `src/index.tsx` exists — use whichever is present.

---

## Step 2 — Collect Credentials (Infer First)

Execute in order before asking the user anything:

1. Read `.env` and `.env.development` — if `VITE_COMETCHAT_APP_ID` exists, reuse it. Do NOT overwrite.
2. Grep source for `CometChatUIKit.init` — extract APP_ID, REGION, AUTH_KEY from existing call.
3. Check for auth token endpoint (`/api/auth`, `/api/cometchat-token`) — if found, plan to use `loginWithAuthToken()`. Do not add Auth Key.
4. Default `LOGIN_UID` to `cometchat-uid-1` unless a different UID is evident from the codebase.

Only ask for values still missing after steps 1–4. If experience was passed as an argument to the dispatcher, skip asking about it.

---

## Step 3 — Install

```bash
npm install @cometchat/chat-uikit-react
# Optional calling support:
npm install @cometchat/calls-sdk-javascript
```

---

## Step 4 — Write credentials to `.env`

Only create or update `.env` if `VITE_COMETCHAT_APP_ID` is not already present. Add `.env` to `.gitignore` if not already there.

```
VITE_COMETCHAT_APP_ID=your_app_id
VITE_COMETCHAT_REGION=us
VITE_COMETCHAT_AUTH_KEY=your_auth_key
```

> Warning: Auth Key is for development only. In production, omit `VITE_COMETCHAT_AUTH_KEY` and use server-generated Auth Tokens with `loginWithAuthToken()` instead.

---

## Step 5 — Add CSS

Add to the top of `src/index.css` only. Do not add if already present anywhere in the project.

```css
@import url("@cometchat/chat-uikit-react/css-variables.css");
```

---

## Step 6 — Update main.tsx (Init + Login)

Read `src/main.tsx` first.

**CRITICAL DECISION — `main.tsx` is ALWAYS safe to wrap:**
- `main.tsx` is the entry point. Whether it looks like boilerplate or has comments saying "don't replace" — the init → login → mount pattern ALWAYS wraps the existing `createRoot().render()` call. This is not "replacing" the file — it's wrapping the existing render in a gate.
- Preserve ALL existing imports (React, App, CSS, providers, stores, etc.)
- Preserve the existing `<App />` component reference inside `mount()`
- The ONLY change is: move the `createRoot().render()` call inside a `mount()` function, and call `mount()` after init → login resolves
- DO NOT touch `App.tsx` from this step — `App.tsx` changes (if any) happen in Step 7

**What counts as "real application logic" in main.tsx (PATCH, don't replace):**
- Custom providers wrapping `<App />` (Redux, React Query, Auth, Theme)
- Store initialization code
- Service worker registration
- Custom error boundaries
- Multiple imports beyond React + App + CSS

**What counts as "boilerplate" in main.tsx (REPLACE is allowed):**
- Only `createRoot().render(<StrictMode><App /></StrictMode>)` with standard React imports
- Comments alone do NOT make a file "real logic" — ignore comments when deciding

In BOTH cases, the result is the same: wrap the render in init → login → mount. The only difference is whether you preserve extra imports/providers.

The pattern below works for both fresh and existing projects — just preserve any extra imports and providers that exist:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import App from "./App.tsx";
import "./index.css";

const COMETCHAT_CONSTANTS = {
  APP_ID: import.meta.env.VITE_COMETCHAT_APP_ID as string,
  REGION: import.meta.env.VITE_COMETCHAT_REGION as string,
  AUTH_KEY: import.meta.env.VITE_COMETCHAT_AUTH_KEY as string,
};
const UID = "UID"; // replace with the login UID

const settings = new UIKitSettingsBuilder()
  .setAppId(COMETCHAT_CONSTANTS.APP_ID)
  .setRegion(COMETCHAT_CONSTANTS.REGION)
  .setAuthKey(COMETCHAT_CONSTANTS.AUTH_KEY)
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(settings)
  ?.then(() => {
    CometChatUIKit.getLoggedinUser().then((user) => {
      if (!user) {
        CometChatUIKit.login(UID)
          .then(() => mount())
          .catch((e: unknown) => mountError(String(e)));
      } else {
        mount();
      }
    });
  })
  .catch((e: unknown) => mountError(String(e)));

function mount() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode><App /></StrictMode>
  );
}

function mountError(message: string) {
  createRoot(document.getElementById("root")!).render(
    <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{message}</div>
  );
}
```

---

## Step 7A — Experience 1: Conversation List + Message View

**`src/cometchat/CometChatSelector.tsx`**
```tsx
import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatConversations, CometChatUIKitLoginListener } from "@cometchat/chat-uikit-react";

interface SelectorProps {
  onSelectorItemClicked?: (input: CometChat.Conversation | CometChat.User | CometChat.Group, type: string) => void;
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

**`src/App.tsx`**

Read `src/App.tsx` first.

**CRITICAL DECISION:**
- If `src/App.tsx` contains ONLY Vite boilerplate (counter, logos, "Hello Vite", no auth, no dashboard, no real state) → REPLACE with the code below.
- If `src/App.tsx` has ANY real application logic (auth forms, dashboard, headers, existing components, state management beyond a counter) → **STOP — DO NOT REPLACE.** Instead:
  1. `src/cometchat/CometChatSelector.tsx` is already created above — no extra work needed.
  2. Add ONE import at the top of the existing `App.tsx`: `import { CometChatSelector } from "./cometchat/CometChatSelector";`
  3. Add the `<CometChatSelector />` component inside the existing JSX (e.g., inside `<main>` or as a new section).
  4. Do NOT remove any existing JSX, imports, state, or logic.

**How to tell if App.tsx is boilerplate:**
- Has Vite/CRA logos, "Hello Vite", "Learn React" text → boilerplate
- Has a simple counter with `useState(0)` and nothing else → boilerplate
- Has auth forms, login/logout, user state, dashboard, headers, navigation → REAL LOGIC, do not replace

```tsx
import { useState } from "react";
import {
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatSelector } from "./cometchat/CometChatSelector";
import "./App.css";

function App() {
  const [selectedUser, setSelectedUser] = useState<CometChat.User | undefined>();
  const [selectedGroup, setSelectedGroup] = useState<CometChat.Group | undefined>();

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
export default App;
```

**`src/App.css`**

Read `src/App.css` first. Add only the rules below if not already present. Do not add `css-variables.css` import here if it is already in `src/index.css`.

```css
#root { width: 100vw; height: 100vh; }
.conversations-with-messages { display: flex; height: 100%; width: 100%; }
.conversations-wrapper { height: 100vh; width: 480px; overflow: hidden; display: flex; flex-direction: column; }
.conversations-wrapper > .cometchat { overflow: hidden; }
.messages-wrapper { width: 100%; height: 100%; display: flex; flex-direction: column; }
.empty-conversation { height: 100vh; width: 100%; display: flex; justify-content: center; align-items: center; background: var(--cometchat-background-color-03, #F5F5F5); color: var(--cometchat-text-color-secondary, #727272); font: var(--cometchat-font-body-regular, 400 14px Roboto); }
.cometchat .cometchat-message-composer { border-radius: 0; }
```

---

## Step 7B — Experience 2: One-to-One / Group Chat

**This experience is SIMPLER than Experience 1.** It does NOT use `CometChatSelector` or `CometChatConversations`. It renders a single chat window with a hardcoded user. Only 3 components: `CometChatMessageHeader`, `CometChatMessageList`, `CometChatMessageComposer`.

**`src/App.tsx`**

Read `src/App.tsx` first.

**CRITICAL DECISION:**
- If `src/App.tsx` contains ONLY Vite boilerplate → REPLACE with the code below.
- If `src/App.tsx` has real application logic (auth, dashboard, headers, state) → **STOP — DO NOT REPLACE.** Create `src/cometchat/CometChatOneToOne.tsx` as a new file with the code below, then add a single `import` + `<CometChatOneToOne />` render into the existing App.tsx's JSX. Do NOT remove any existing content.

```tsx
import { useEffect, useState } from "react";
import {
  CometChatMessageComposer,
  CometChatMessageHeader,
  CometChatMessageList,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import "./App.css";

const CHAT_UID = "cometchat-uid-1"; // replace with the target UID

function App() {
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CometChat.User | undefined>();

  useEffect(() => {
    CometChat.getUser(CHAT_UID)
      .then(setSelectedUser)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{error}</div>;

  return selectedUser ? (
    <div className="messages-wrapper">
      <CometChatMessageHeader user={selectedUser} />
      <CometChatMessageList user={selectedUser} />
      <CometChatMessageComposer user={selectedUser} />
    </div>
  ) : (
    <div className="empty-conversation">Set CHAT_UID in App.tsx to start chatting</div>
  );
}
export default App;
```

**`src/App.css`**

Read first. Add only if not already present:

```css
#root { width: 100vw; height: 100vh; }
.messages-wrapper { width: 100%; height: 100vh; display: flex; flex-direction: column; }
.empty-conversation { height: 100vh; width: 100%; display: flex; justify-content: center; align-items: center; background: var(--cometchat-background-color-03, #F5F5F5); color: var(--cometchat-text-color-secondary, #727272); }
.cometchat .cometchat-message-composer { border-radius: 0; }
```

---

## Step 7C — Experience 3: Tab-Based Chat

Create the following icon files in `src/cometchat/assets/`:

**`src/cometchat/assets/chats.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
```

**`src/cometchat/assets/calls.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
```

**`src/cometchat/assets/users.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
```

**`src/cometchat/assets/groups.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
```

**`src/cometchat/CometChatTabs.tsx`**
```tsx
import { useState } from "react";
import chatsIcon from "./assets/chats.svg";
import callsIcon from "./assets/calls.svg";
import usersIcon from "./assets/users.svg";
import groupsIcon from "./assets/groups.svg";
import "./CometChatTabs.css";

const TABS = [
  { name: "CHATS", icon: chatsIcon },
  { name: "CALLS", icon: callsIcon },
  { name: "USERS", icon: usersIcon },
  { name: "GROUPS", icon: groupsIcon },
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
      <CometChatTabs activeTab={activeTab} onTabClicked={(t) => setActiveTab(t.name.toLowerCase())} />
    </>
  );
};
```

Use the same `App.tsx` and `App.css` as Experience 1 (the selector handles tab switching internally).

---

## Step 8 — Substitute Credentials

Replace all placeholders in the generated files:
- `"APP_ID"` → actual App ID
- `"REGION"` → actual region
- `"AUTH_KEY"` → actual Auth Key (development only)
- `"UID"` → login UID
- `"cometchat-uid-1"` in CHAT_UID → target UID (One-to-One only)

---

## Step 9 — Run

```bash
npm run dev      # Vite
npm start        # Create React App
```

---

## Agent Verification Checklist

Before finishing, verify each item and report pass or fail:

- [ ] `npm run build` exits with no TypeScript errors
- [ ] `css-variables.css` imported exactly once across all files
- [ ] No component renders before `login()` resolves (app only mounts inside `mount()` callback)
- [ ] `user` and `group` never both passed to the same component instance (conditional rendering used)
- [ ] Visible error UI reachable on init/login failure (`mountError()` renders the error message)
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

> **Note for Vite/CRA apps:** Vite has no built-in server. The auth token endpoint must live on your existing backend (Express, FastAPI, Django, etc.) or a serverless function (Vercel, Netlify, Cloudflare Workers). If the user has no backend yet, recommend migrating to Next.js or React Router v7 which have built-in server support.

### 1. Add API Key to your backend server environment

```bash
# On your backend server (NOT in .env exposed to Vite)
COMETCHAT_API_KEY=your_rest_api_key_from_dashboard
COMETCHAT_APP_ID=...
COMETCHAT_REGION=...
```

### 2. Create CometChat user at sign-up (backend)

```ts
// On your backend — call this when a user signs up
async function createCometChatUser(uid: string, name: string) {
  await fetch(`https://api-${COMETCHAT_REGION}.cometchat.io/v3/users`, {
    method: 'POST',
    headers: {
      apiKey: COMETCHAT_API_KEY,
      appId: COMETCHAT_APP_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, name }),
  });
}
```

### 3. Create auth token endpoint on your backend

```ts
// Express example — POST /api/cometchat-token
app.post('/api/cometchat-token', requireAuth, async (req, res) => {
  const uid = req.user.id; // your app's user ID = CometChat UID

  const response = await fetch(
    `https://api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users/${uid}/auth_tokens`,
    {
      method: 'POST',
      headers: {
        apiKey: process.env.COMETCHAT_API_KEY!,
        appId: process.env.COMETCHAT_APP_ID!,
      },
    }
  );
  const { data } = await response.json();
  res.json({ authToken: data.authToken });
});
```

### 4. Update main.tsx to use loginWithAuthToken

```tsx
// src/main.tsx — update init block
const settings = new UIKitSettingsBuilder()
  .setAppId(import.meta.env.VITE_COMETCHAT_APP_ID as string)
  .setRegion(import.meta.env.VITE_COMETCHAT_REGION as string)
  // remove .setAuthKey() entirely
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(settings)?.then(async () => {
  const existing = await CometChatUIKit.getLoggedinUser();
  if (!existing) {
    try {
      // Point to your backend URL (configure via VITE_API_BASE_URL or similar)
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/cometchat-token`, {
        method: 'POST',
        credentials: 'include', // send session cookie
      });
      if (!res.ok) throw new Error('Failed to get auth token');
      const { authToken } = await res.json();
      await CometChatUIKit.loginWithAuthToken(authToken);
      mount();
    } catch (e) {
      mountError(String(e));
    }
  } else {
    mount();
  }
}).catch((e) => mountError(String(e)));
```

### 5. Remove Auth Key from .env

```bash
# .env — remove:
# VITE_COMETCHAT_AUTH_KEY=...

# Keep:
VITE_COMETCHAT_APP_ID=...
VITE_COMETCHAT_REGION=...
VITE_API_BASE_URL=http://localhost:3001   # your backend URL
```

### Verification

- [ ] Backend `/api/cometchat-token` returns 401 for unauthenticated requests
- [ ] Two users signed in separately see each other's messages in real time
- [ ] No `AUTH_KEY` in `.env` or source files
- [ ] `COMETCHAT_API_KEY` is on the backend only — not in Vite `.env`
