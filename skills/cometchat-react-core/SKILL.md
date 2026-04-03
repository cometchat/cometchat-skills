---
name: cometchat-react-core
description: Shared rules for any CometChat React UI Kit v6 integration. Use as foundational context alongside a framework-specific skill. Do not use alone for implementation — pair with the correct framework skill.
license: "MIT"
compatibility: "Node.js >=16; React >=18; @cometchat/chat-uikit-react ^6; Claude Code or any agentskills.io-compatible agent"
allowed-tools: "readFile, readCode, readMultipleFiles, grepSearch, fileSearch, listDirectory"
# Core is a read-only policy skill — it does not write files itself. Framework skills handle all writes.
metadata:
  author: "CometChat"
  version: "1.0.0"
  tags: "chat cometchat react ui-kit"
---

# CometChat React UI Kit — Core Rules

These rules apply to every CometChat React UI Kit integration regardless of framework. They are hard constraints, not suggestions. Framework-specific skills must not contradict them.

---

## HARD RULES

These are non-negotiable constraints. Every framework skill inherits them. They may not be overridden.

```
INFER_BEFORE_ASK
  1. Check .env / .env.local / .env.development for APP_ID, REGION, AUTH_KEY
  2. Grep source for CometChatUIKit.init — extract credentials from there
  3. Check for /api/auth or /api/cometchat-token endpoints → use loginWithAuthToken, do NOT add Auth Key
  4. Only ask user for values that cannot be found or inferred

PATCH_NOT_REPLACE
  - If file exists + has real logic → PATCH only; never overwrite non-CometChat sections
  - If file exists + is boilerplate stub → REPLACE allowed
  - If file does not exist → CREATE under cometchat/ subfolder

NO_DUPLICATES
  - css-variables.css must appear exactly once across the entire project
  - Do not register a chat route that already exists
  - Do not create a component file that already exists — read and patch it

NEVER_TOUCH
  - Existing auth systems (NextAuth, Clerk, Auth0, custom JWT)
  - Existing API routes or server actions
  - Existing Tailwind config, CSS Modules, or theme files
  - Existing routing definitions (add to them, never remove or reorder)

SAFETY
  - Never introduce Auth Key into a project that already has an auth token endpoint
  - Never render CometChat components before login() resolves
  - Always surface init/login errors as visible UI — never swallow errors
  - Always use init()?.then() — init() returns Promise | void
  - Always return null (not undefined) from components on loading/empty states

NO_REFACTOR
  - Do not restructure existing code
  - Do not introduce abstractions (hooks, services, contexts) unless explicitly required by the skill
  - Do not rename, move, or reorganize existing files
  - Only insert minimal working logic — no "improvements" to existing code

SKILL_VALIDATION
  - Each framework skill MUST verify it is the correct skill before executing
  - IF wrong framework detected → STOP execution immediately, return the correct skill name
  - NEVER proceed with integration if framework does not match the skill
  - Example: cometchat-react-nextjs detects "astro" in package.json → STOP, say "use cometchat-react-astro"
```

---

## AGENT CONTRACT

```
GOAL
  Integrate CometChat React UI Kit v6 into an existing React-based project
  following the mandatory init → login → render order, without breaking
  existing auth, routing, styling, or file structure.

REQUIRED INPUTS
  APP_ID:   string   — CometChat application ID (from dashboard)
  REGION:   string   — "us" | "eu" | "in" (must match app creation region)
  AUTH_KEY: string   — Dev/testing only. Omit in production; use auth token instead.
  UID:      string   — User identifier to log in (e.g. "cometchat-uid-1" for dev)

INVARIANTS
  1. init() MUST resolve before login() is called. No exceptions.
  2. login() MUST resolve before any CometChat component is mounted. No exceptions.
  3. css-variables.css MUST be imported exactly once per app. No exceptions.
  4. user and group MUST NOT both be passed to the same component simultaneously. No exceptions.
  5. Auth Key MUST NOT appear in any committed source file — .env only. No exceptions.
  6. CometChat MUST NOT execute server-side — client-only always. No exceptions.
  7. An existing auth system MUST NOT be replaced or bypassed — extend it. No exceptions.
  8. Every init/login failure MUST produce a visible error UI — never swallow errors. No exceptions.

FAILURE MODES
  Blank screen             → login() called before init() resolves
  Blank screen             → component rendered before login() resolves
  Blank screen             → state flag set after init() instead of after login()
  Hydration error          → CometChat component rendered server-side
  Broken styles            → css-variables.css not imported, or imported twice
  401 Unauthorized         → APP_ID or AUTH_KEY does not match dashboard values
  Wrong region error       → REGION value does not match app creation region
  TypeScript error         → init().then() used instead of init()?.then()
  Silent failure           → error caught but not surfaced to UI

COMPLETION CRITERIA
  PASS:
    - npm install exits with no errors
    - npm run build (or tsc --noEmit) exits with no TypeScript errors
    - css-variables.css imported exactly once in the project
    - No CometChat component mounted before login() resolves
    - Only user OR group passed to message components, never both
    - No Auth Key in any source file (only in .env / .env.local)
    - No duplicate route registrations for the chat route
    - Visible error UI reachable on init/login failure
  FAIL:
    - Any blank screen after credentials are known-good
    - Any TypeScript error introduced by the integration
    - Any duplicate import, route, or component file
    - Auth Key present in committed source
```

---

## DECISION LOGIC

```
// FRAMEWORK ROUTING — which skill to pair with this one
if framework == "Next.js"           → use cometchat-react-nextjs skill
if framework == "React Router v7"   → use cometchat-react-react-router skill
if framework == "Astro"             → use cometchat-react-astro skill
if framework == "Vite / CRA"        → use cometchat-react-reactjs skill
// Never use cometchat-react-core alone for implementation

// AUTH STRATEGY
if project has existing /api/auth or /api/cometchat-token endpoint
  → use loginWithAuthToken(token)
  → do NOT introduce Auth Key into the project
else if project is clearly a dev/demo scaffold (no existing auth system)
  → use setAuthKey(AUTH_KEY) + login(UID) temporarily
  → add comment: "Replace with loginWithAuthToken before production"
else if uncertain
  → ask user before choosing

// FILE OPERATIONS
if target file does not exist
  → CREATE it under the cometchat/ subfolder
if target file exists AND contains only placeholder content
    (e.g. "Hello World", "Get Started", Vite/CRA boilerplate, single default export returning JSX stub)
  → REPLACE is allowed
if target file exists AND has real application content
  → PATCH only — preserve all existing imports, routing, and auth
  → insert only the missing logic
  → never overwrite non-CometChat sections

// CSS IMPORT
if css-variables.css is already imported anywhere in the project
  → SKIP — do not add another import
if css-variables.css is not yet imported
  → ADD to the canonical root location for the framework (see CSS Import table)
  → for Astro only: add inside the React island component, not a global stylesheet
```

---

## REAL OBJECT SHAPES

These are the TypeScript shapes for the four SDK objects agents most commonly work with. Use these to type state variables, props, and callbacks correctly.

```ts
// CometChat.User — represents a chat participant
interface CometChatUser {
  uid: string;                   // unique user identifier, e.g. "cometchat-uid-1"
  name: string;                  // display name
  avatar?: string;               // URL to avatar image
  status: "online" | "offline";  // presence status
  lastActiveAt?: number;         // Unix timestamp (seconds)
}

// Example payload
const user: CometChatUser = {
  uid: "cometchat-uid-1",
  name: "Alice",
  avatar: "https://data-us.cometchat.io/assets/images/avatars/cometchat-uid-1.webp",
  status: "online",
  lastActiveAt: 1711900800
};

// CometChat.Group — represents a group conversation
interface CometChatGroup {
  guid: string;                              // unique group identifier
  name: string;                             // display name
  type: "public" | "private" | "password";  // group visibility
  membersCount: number;                     // current member count
}

// Example payload
const group: CometChatGroup = {
  guid: "group_engineering",
  name: "Engineering Team",
  type: "private",
  membersCount: 12
};

// CometChat.Conversation — represents a conversation list item
interface CometChatConversation {
  conversationId: string;             // unique conversation identifier
  conversationType: "user" | "group"; // one-to-one or group
  lastMessage?: CometChatTextMessage; // most recent message object (may be absent)
  unreadMessageCount: number;         // count of unread messages for logged-in user
  conversationWith: CometChatUser | CometChatGroup; // the other party
}

// Example payload
const conversation: CometChatConversation = {
  conversationId: "cometchat-uid-1_user_cometchat-uid-2",
  conversationType: "user",
  unreadMessageCount: 3,
  lastMessage: {
    id: 1024,
    text: "Hey, are you free for a call later?",
    sender: { uid: "cometchat-uid-2", name: "Bob", status: "offline", lastActiveAt: 1711897200 },
    receiver: { uid: "cometchat-uid-1", name: "Alice", status: "online", lastActiveAt: 1711900800 },
    receiverType: "user",
    sentAt: 1711899600
  },
  conversationWith: {
    uid: "cometchat-uid-2",
    name: "Bob",
    avatar: "https://data-us.cometchat.io/assets/images/avatars/cometchat-uid-2.webp",
    status: "offline",
    lastActiveAt: 1711897200
  }
};

// CometChat.TextMessage — represents a text chat message
interface CometChatTextMessage {
  id: number;                         // numeric message ID
  text: string;                       // message body
  sender: CometChatUser;              // who sent it
  receiver: CometChatUser | CometChatGroup; // who received it
  receiverType: "user" | "group";     // matches receiver shape
  sentAt: number;                     // Unix timestamp (seconds)
}

// Example payload
const textMessage: CometChatTextMessage = {
  id: 1025,
  text: "Sure, let's sync at 3pm!",
  sender: {
    uid: "cometchat-uid-1",
    name: "Alice",
    avatar: "https://data-us.cometchat.io/assets/images/avatars/cometchat-uid-1.webp",
    status: "online",
    lastActiveAt: 1711900800
  },
  receiver: {
    uid: "cometchat-uid-2",
    name: "Bob",
    avatar: "https://data-us.cometchat.io/assets/images/avatars/cometchat-uid-2.webp",
    status: "offline",
    lastActiveAt: 1711897200
  },
  receiverType: "user",
  sentAt: 1711900860
};
```

---

## FILE OPERATION RULES

```
NEVER CREATE if file already exists → PATCH instead
  - Check the file exists before deciding to create
  - If it exists with real content, always patch

PATCH RULES (when file has existing content)
  - Preserve all existing imports — only add imports not already present
  - Preserve all existing routing — only add the new chat route
  - Preserve all existing auth logic — do not replace, wrap, or bypass it
  - Insert only the missing CometChat logic (init block, component mount, CSS import)
  - Do not reorder or reformat unrelated code sections

REPLACE ALLOWED only when ALL of the following are true
  - File already exists
  - File contains ONLY placeholder/boilerplate content:
      "Hello World" text, "Get Started" text,
      default Vite/CRA scaffold, single-line JSX stub, empty default export
  - No real application logic, routing, or auth is present

DO NOT TOUCH under any circumstance
  - Existing authentication system (NextAuth, Clerk, Auth0, custom JWT, etc.)
  - Existing API routes or server actions
  - Existing styling system (Tailwind config, CSS Modules, theme files)
  - Existing routing definitions (add to them, never remove or reorder)
  - Files outside the cometchat/ subfolder unless adding a single import line
```

---

## EXISTING PROJECT PATCH GUIDE

When integrating into a project that has real application logic (auth, routing, existing pages), follow these concrete patterns. DO NOT replace files — add CometChat alongside existing code.

**GUIDING PRINCIPLE: Minimize touchpoints.** For existing projects:
1. Wrap `main.tsx` entry point with init → login → mount (Pattern A) — this is always safe
2. Create ALL new CometChat files in a `cometchat/` subfolder — these are always safe to create
3. For frameworks with routing (Next.js, React Router, Astro): create a NEW `/chat` route — do NOT modify existing pages
4. For plain React (no router): add a single import + component render into the existing `App.tsx` JSX — do NOT replace `App.tsx`
5. Add CSS import to the TOP of the existing root stylesheet — do NOT replace the stylesheet
6. Touch at most 3 existing files: `main.tsx` (wrap), `App.tsx` or equivalent (add one import + render), root CSS (add one line at top)

### Pattern A: Entry file has existing app logic (main.tsx / index.tsx)

DO NOT replace the entry file. Instead:
1. Add CometChat imports at the top
2. Wrap the existing `createRoot(...).render(...)` call inside the init → login chain
3. Preserve ALL existing imports and logic

**Before (existing main.tsx):**
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
```

**After (patched — only CometChat lines added):**
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

Key: The existing `<App />` component is preserved inside `mount()`. All existing imports stay.

### Pattern B: App.tsx has existing auth/dashboard logic

DO NOT replace App.tsx. Create CometChat components in `src/cometchat/` and import them into the existing App.tsx.

**Patch approach:**
1. Create `src/cometchat/CometChatSelector.tsx` (new file — safe to create)
2. Add a single import + component render into the existing App.tsx's JSX

**Example patch to existing App.tsx (add only these lines):**
```tsx
// ADD this import at the top:
import { CometChatSelector } from "./cometchat/CometChatSelector";

// ADD the chat component inside the existing JSX where appropriate:
// e.g., inside <main> or as a new section:
<CometChatSelector onSelectorItemClicked={(item) => { /* handle */ }} />
```

DO NOT remove the existing auth form, header, dashboard content, or any other logic.

### Pattern C: Project has an auth token endpoint (e.g., /api/cometchat-token)

If the project already has a server-side auth token endpoint:
1. DO NOT add Auth Key to .env
2. DO NOT use `setAuthKey()` in UIKitSettingsBuilder
3. Use `loginWithAuthToken(token)` instead of `login(UID)`

**Concrete pattern:**
```tsx
// In the init block, replace login(UID) with:
const res = await fetch("/api/cometchat-token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ uid: "cometchat-uid-1" }),
});
const { authToken } = await res.json();
await CometChatUIKit.loginWithAuthToken(authToken);
```

### Pattern D: Adding a route to existing routing (React Router)

DO NOT replace routes.ts. Append the chat route:

**Before:**
```ts
export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
] satisfies RouteConfig;
```

**After (one line added):**
```ts
export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("chat", "routes/CometChat.tsx"),
] satisfies RouteConfig;
```

### Pattern E: Next.js existing page — add chat as a new route

DO NOT modify existing pages. Create a new `/chat` route:
1. Create `src/app/chat/page.tsx` with `"use client"` + dynamic import
2. Create `src/app/cometchat/CometChatNoSSR.tsx` (the actual component)
3. Leave existing `src/app/page.tsx` untouched

### Pattern F: Astro existing page — add chat as a React island

DO NOT modify existing `.astro` pages. Either:
1. Create a new `src/pages/chat.astro` page with the `<ChatApp client:only="react" />` island
2. Or add the island to the existing page if the user requests it there

---

## FEATURE AVAILABILITY

| Feature | Available by default | Requires dashboard config | Requires SDK code |
|---|---|---|---|
| Text messaging | ✅ | ❌ | ❌ |
| Typing indicator | ❌ | ✅ | ❌ |
| Read receipts | ❌ | ✅ | ❌ |
| Smart replies | ❌ | ✅ | ⚠️ optional config |
| Reactions | ❌ | ❌ | ✅ |
| Voice/video calls | ❌ | ✅ | ✅ install calls SDK |
| Push notifications | ❌ | ✅ | ✅ |

---

## Hard Rules (apply everywhere, always)

These duplicate the HARD RULES section at the top for quick reference in context where agents may have truncated the header.

1. **Never call `login()` before `init()` resolves.**
2. **Never render components before `login()` resolves.**
3. **Never pass both `user` and `group` to the same component — use conditional rendering.**
4. **Never import `css-variables.css` more than once per app.**
5. **Never replace an entry file (main.tsx, layout.tsx, App.tsx) unless it is clearly a demo stub.**
6. **Never introduce Auth Key into an existing production app. If an auth token endpoint already exists, use `loginWithAuthToken()`.**
7. **Always render a visible error state on init or login failure — never silently swallow errors.**
8. **Always inspect existing files before creating or patching. Patch minimally.**
9. **Never duplicate CSS imports, route registrations, or component files that already exist.**
10. **Always infer credentials from .env / existing init calls before asking the user.**

---

## Package

```bash
npm install @cometchat/chat-uikit-react
# Optional — only if voice/video calling is needed:
npm install @cometchat/calls-sdk-javascript
```

Peer deps: `react >=18`, `react-dom >=18`, `rxjs ^7.8.1` (installed automatically).

---

## Mandatory Init → Login → Render Order

```
CometChatUIKit.init(settings)
  → resolves
  → CometChatUIKit.login(UID)  or  CometChatUIKit.loginWithAuthToken(token)
    → resolves
    → mount UI Kit components
```

**Breaking this order produces a blank screen.** Gate rendering with a state flag set only after `login()` resolves — not after `init()`.

---

## UIKit Settings

```ts
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";

const settings = new UIKitSettingsBuilder()
  .setAppId(APP_ID)
  .setRegion(REGION)        // "us" | "eu" | "in"
  .setAuthKey(AUTH_KEY)     // dev/testing only — omit in production
  .subscribePresenceForAllUsers()
  .build();
```

---

## Auth Key vs Auth Token

| Context | Method |
|---------|--------|
| Development / testing | `.setAuthKey(AUTH_KEY)` → `CometChatUIKit.login(UID)` |
| Production | Omit Auth Key → `CometChatUIKit.loginWithAuthToken(token)` |

**Detection rule:**
- If the project already has a server-side auth token endpoint (e.g., `/api/auth`, `/api/cometchat-token`), use `loginWithAuthToken()` — do not introduce Auth Key.
- If the project is clearly a dev/demo scaffold with no existing auth, Auth Key is acceptable temporarily with a comment noting it must be replaced before production.

**Auth Key must never ship to production.** Generate Auth Tokens server-side via the REST API.

---

## CSS Import — Canonical Rule

Import `css-variables.css` **exactly once**, in the root client entry or top-level app stylesheet:

| Framework | Canonical location |
|---|---|
| React.js / Vite | `src/index.css` (first line) |
| Next.js | `app/globals.css` (first line) |
| React Router | `app/app.css` (first line) |
| Astro | Inside the React island component (framework constraint — no global stylesheet applies to islands) |

Never add a second import in a component file if it is already in the root stylesheet. Astro is the only exception where component-level import is required.

Also ensure `html, body { height: 100%; }` so the chat UI fills the viewport.

---

## Never Pass Both User and Group

```tsx
// correct — conditional rendering, one at a time
{selectedUser && <CometChatMessageList user={selectedUser} />}
{selectedGroup && <CometChatMessageList group={selectedGroup} />}

// also correct when state guarantees mutual exclusivity
<CometChatMessageList user={selectedUser ?? undefined} />   // only when selectedGroup is undefined
<CometChatMessageList group={selectedGroup ?? undefined} />  // only when selectedUser is undefined

// WRONG — both props set simultaneously
<CometChatMessageList user={selectedUser} group={selectedGroup} />
```

When `selectedUser` and `selectedGroup` are mutually exclusive state (setting one clears the other), passing them as separate props is safe only if the cleared value is `undefined`, not `null`.

---

## Error Handling Pattern

This is the canonical reference implementation. Framework-specific skills may wrap this in framework idioms but must not deviate from the init → login → render ordering or the visible error requirement.

```tsx
const [user, setUser] = useState<CometChat.User | null>(null);
const [error, setError] = useState<string | null>(null);

CometChatUIKit.init(settings)
  ?.then(() => {
    CometChatUIKit.getLoggedinUser().then((u) => {
      if (!u) {
        CometChatUIKit.login(UID)
          .then(setUser)
          .catch((e) => setError(`Login failed: ${e?.message ?? e}`));
      } else {
        setUser(u);
      }
    });
  })
  .catch((e) => setError(`Init failed: ${e?.message ?? e}`));

if (error) return <div style={{ color: "red", padding: 16, fontFamily: "monospace" }}>{error}</div>;
if (!user) return null;
```

Use `null` (not `undefined`) for empty component returns.

---

## Credentials — Inspect Before Asking

Before requesting credentials from the user:
1. Check for existing `.env` / `.env.local` / `.env.development` — if `APP_ID`, `REGION`, `AUTH_KEY` are already present, reuse them.
2. Check for existing CometChat init calls in the codebase — extract credentials from there if present.
3. Only ask for values that cannot be found or safely inferred.

When writing credentials, use the framework's env var prefix:

| Framework | Prefix | File |
|---|---|---|
| React.js / Vite | `VITE_` | `.env` |
| Next.js | `NEXT_PUBLIC_` | `.env.local` |
| React Router (Vite) | `VITE_` | `.env` |
| Astro | `PUBLIC_` | `.env` |

---

## Canonical File Layout

All CometChat files go under a dedicated `cometchat/` subfolder to avoid polluting the project structure:

| Framework | Layout |
|---|---|
| React.js | `src/cometchat/CometChatSelector.tsx`, init in `src/main.tsx` |
| Next.js | `src/app/cometchat/CometChatNoSSR.tsx`, `CometChatNoSSR.css`, `CometChatSelector.tsx` |
| React Router | `app/cometchat/CometChatNoSSR.tsx`, `CometChatNoSSR.css`, `CometChatSelector.tsx`; route at `app/routes/CometChat.tsx` |
| Astro | `src/cometchat/ChatApp.tsx`, `ChatApp.css`; optional `CometChatSelector.tsx` for tab experience |

Use this layout unless the project already has a different conventions pattern — in that case, follow the project's existing structure.

---

## Three Chat Experiences

| Experience | Components |
|------------|------------|
| Conversation List + Message View | `CometChatConversations`, `CometChatMessageHeader`, `CometChatMessageList`, `CometChatMessageComposer` |
| One-to-One / Group Chat | `CometChatMessageHeader`, `CometChatMessageList`, `CometChatMessageComposer` |
| Tab-Based Chat | + `CometChatCallLogs`, `CometChatUsers`, `CometChatGroups` |

---

## SSR Constraint

CometChat requires browser APIs (`window`, `WebSocket`, `document`). It is **client-side only**.

| Framework | Client-only pattern |
|-----------|-------------------|
| React.js (Vite/CRA) | No SSR — no special handling needed |
| Next.js | `dynamic(() => import(...), { ssr: false })` + `"use client"` on page |
| React Router | `lazy(() => import(...))` + `mounted` state check |
| Astro | `<Component client:only="react" />` |

---

## Test Users

Every CometChat app comes with 5 pre-created test users: `cometchat-uid-1` through `cometchat-uid-5`. For development, log in as `cometchat-uid-1` and chat with `cometchat-uid-2` for One-to-One.

---

## ERROR DEBUGGING TABLE

| Symptom | Cause | Fix |
|---|---|---|
| Blank screen | `login()` called before `init()` resolves | Move `login()` inside `init()?.then()` |
| Blank screen | Component renders before `login()` resolves | Gate render with user state set only after `login()` resolves |
| Blank screen | State flag set after `init()` instead of `login()` | Move `setInitialized(true)` (or equivalent) inside the `login().then()` callback |
| Hydration error | CometChat rendered server-side | Add SSR prevention for your framework (see SSR Constraint table) |
| Broken styles | `css-variables.css` not imported | Add import to root stylesheet at the canonical location for your framework |
| Broken styles | `css-variables.css` imported twice | Remove the duplicate import — keep only the one in the root stylesheet |
| 401 Unauthorized | Wrong Auth Key or App ID | Check `.env` values match the dashboard exactly — no extra spaces |
| Wrong region error | Wrong `REGION` value | Must match the region where the app was created in the dashboard |
| TypeScript error "possibly undefined" | `init().then()` used | Change to `init()?.then()` — `init()` returns `Promise \| void` |
| Silent failure on bad credentials | Error caught but not shown | Surface error to UI — see Error Handling Pattern |
| Chat UI does not fill viewport | Missing `html, body { height: 100% }` | Add to root stylesheet alongside the css-variables import |

---

## Agent Verification Checklist

After applying any integration, verify in this order:

### Build verification (automated)
- [ ] `npm install` exits with no errors
- [ ] `npm run build` (or `tsc --noEmit`) exits with no TypeScript errors
- [ ] `css-variables.css` is imported exactly once in the project
- [ ] No CometChat component is rendered before `login()` resolves
- [ ] Only `user` **or** `group` is passed to message components, never both simultaneously
- [ ] No Auth Key in source files (only in `.env` / `.env.local`)
- [ ] No duplicate route registrations for the chat route
- [ ] Visible error UI is reachable if init/login fails

### UI verification (runtime — check after `npm run dev`)

**All experiences:**
- [ ] No blank screen — chat UI renders after init/login completes
- [ ] No errors in browser console related to CometChat
- [ ] Existing app functionality still works (auth, routing, other pages)

**Experience 1 — Conversation List + Messages:**
- [ ] Conversation list renders in left panel with at least one conversation
- [ ] Clicking a conversation shows MessageHeader, MessageList, and MessageComposer on the right
- [ ] Sending a message appears in the list in real time

**Experience 2 — One-to-One Chat:**
- [ ] MessageHeader shows the target user's name and avatar
- [ ] MessageList shows existing message history (or empty state)
- [ ] MessageComposer accepts input and sends on Enter/button click

**Experience 3 — Tab-Based Chat:**
- [ ] Tab bar visible at bottom of left panel with CHATS / CALLS / USERS / GROUPS
- [ ] Each tab click switches the list component without errors
- [ ] Selecting a user or group opens message view on the right

### Real-time verification (two-tab test)

This confirms messages actually flow between users in real time — the most important functional check.

1. Keep the current browser tab open (logged in as `cometchat-uid-1`)
2. Open a second browser window in **incognito / private mode**
3. Navigate to the same app URL in the incognito window
4. In `main.tsx` (or `CometChatNoSSR.tsx`), temporarily change the login UID to `"cometchat-uid-2"` for this second window — or use a different test account if you have one
5. In the first window, find `cometchat-uid-2` in the conversation list (or start a new conversation)
6. Send a message from the first window
7. Confirm it appears in the second window in real time (no page refresh)
8. Send a reply from the second window — confirm it appears in the first

> Both `cometchat-uid-1` and `cometchat-uid-2` are pre-created in every CometChat app. No dashboard setup needed for this test.

Once real-time is confirmed, revert the UID change in the second window.

---

## Theming — Match Your App's Visual Style

> Activate this section when the user says yes to the theming question, or asks to "match my theme", "change colors", "customize the chat UI", or "override CometChat styles".

CometChat UI Kit v6 uses CSS custom properties (variables) for all visual tokens. Override them in your root stylesheet to match your app's design system.

### Where to place overrides

Add to the same file where you imported `css-variables.css` (the canonical root stylesheet for your framework):

| Framework | File |
|---|---|
| React.js / Vite | `src/index.css` |
| Next.js | `app/globals.css` |
| React Router | `app/app.css` |
| Astro | Inside the React island `.tsx` file, after the `css-variables.css` import |

### Key variables to override

```css
/* Place these AFTER the @import for css-variables.css */
:root {
  /* Primary brand color — used for active states, highlights, send button */
  --cometchat-primary-color: #your-brand-color;

  /* Background colors */
  --cometchat-background-color-01: #ffffff;   /* main panel background */
  --cometchat-background-color-02: #f5f5f5;   /* secondary background */
  --cometchat-background-color-03: #eeeeee;   /* tertiary background */

  /* Text colors */
  --cometchat-text-color-primary: #141414;    /* primary text */
  --cometchat-text-color-secondary: #727272;  /* secondary/muted text */

  /* Border */
  --cometchat-border-color-light: #f5f5f5;

  /* Font — set to match your app's typeface */
  --cometchat-font-family: 'Your Font', sans-serif;

  /* Border radius — set to 0 for sharp corners, higher for rounded */
  --cometchat-border-radius-max: 8px;
}
```

### Ask the user for their values

Before writing overrides, ask:

> "What's your app's primary brand color (hex or CSS value)? And what font family does your app use?"

Use their answers to fill in `--cometchat-primary-color` and `--cometchat-font-family`. Leave other variables at defaults unless the user specifies them.

### Dark mode

If the app uses dark mode, add a `[data-theme="dark"]` or `.dark` selector matching your app's dark mode class:

```css
[data-theme="dark"] {
  --cometchat-background-color-01: #1a1a1a;
  --cometchat-background-color-02: #2a2a2a;
  --cometchat-text-color-primary: #ffffff;
  --cometchat-text-color-secondary: #a0a0a0;
}
```

---

## Common Mistakes to Prevent

1. `login()` called before `init()` resolves → blank screen
2. Components rendered before `login()` resolves → blank screen
3. Missing `css-variables.css` import → broken styles
4. Auth Key shipped to production → security risk
5. Both `user` and `group` passed to message components → undefined behavior
6. CometChat rendered server-side → browser API crash
7. Raw SDK used where UIKit wrapper exists → desynced UI state
8. `init().then()` instead of `init()?.then()` → TypeScript error
9. Credentials hardcoded in source files → security risk, fails in CI
10. `return undefined` from a React component → use `return null`
11. `setInitialized(true)` after `init()` instead of after `login()` → renders before login completes

---

## Production Auth: Real Users & Auth Tokens

> Activate this section when the user asks to "go to production", "connect real users", "replace cometchat-uid-1", or "set up auth tokens".

### Why Auth Key must not ship to production

Auth Key grants unrestricted access to your CometChat app. Anyone who extracts it from client-side code can impersonate any user. In production, the server generates short-lived auth tokens instead.

### Two env vars to distinguish

| Variable | Where | Used for |
|---|---|---|
| `AUTH_KEY` | `.env` (dev only) | `setAuthKey()` — remove before production |
| `API_KEY` | Server `.env` only | REST API calls to generate auth tokens — never expose to client |

Get your API Key from CometChat Dashboard → API & Auth Keys → REST API Key.

### UID Strategy

CometChat UID = your app's user identifier. Rules:
- Use the same ID you already have (database UUID, email, username)
- Keep it stable — changing UIDs breaks message history
- Max 100 chars, no spaces (URL-encode if needed)
- CometChat user must exist before `loginWithAuthToken()` is called

### Step A — Create CometChat users at sign-up

Call this from your sign-up / user-creation handler (server-side only):

```ts
async function createCometChatUser(uid: string, name: string, avatar?: string) {
  const res = await fetch(
    `https://api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users`,
    {
      method: 'POST',
      headers: {
        apiKey: process.env.COMETCHAT_API_KEY!,
        appId: process.env.COMETCHAT_APP_ID!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid, name, ...(avatar ? { avatar } : {}) }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    // uid already exists → safe to ignore (409)
    if (err.error?.code !== 'ERR_UID_ALREADY_EXISTS') throw new Error(err.error?.message);
  }
}
```

Call during sign-up: `await createCometChatUser(user.id, user.name, user.avatarUrl)`

### Step B — Generate auth token server-side

On every login / session refresh, call from the server using the logged-in user's ID:

```ts
async function getCometChatAuthToken(uid: string): Promise<string> {
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
  return data.authToken;
}
```

### Step C — Update client to use loginWithAuthToken

Replace the dev init block:

```tsx
// BEFORE (dev only)
const settings = new UIKitSettingsBuilder()
  .setAppId(APP_ID)
  .setRegion(REGION)
  .setAuthKey(AUTH_KEY)          // ← remove this
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(settings)?.then(() => {
  CometChatUIKit.login("cometchat-uid-1")  // ← replace this
    .then(() => mount())
    .catch((e) => mountError(String(e)));
});
```

```tsx
// AFTER (production)
const settings = new UIKitSettingsBuilder()
  .setAppId(APP_ID)
  .setRegion(REGION)
  // no setAuthKey()
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(settings)?.then(() => {
  CometChatUIKit.getLoggedinUser().then(async (user) => {
    if (!user) {
      try {
        const res = await fetch('/api/cometchat-token', { method: 'POST' });
        const { authToken } = await res.json();
        await CometChatUIKit.loginWithAuthToken(authToken);
        mount();
      } catch (e) {
        mountError(String(e));
      }
    } else {
      mount();
    }
  });
}).catch((e) => mountError(String(e)));
```

### Step D — Remove Auth Key from .env

```bash
# .env — production
VITE_COMETCHAT_APP_ID=...
VITE_COMETCHAT_REGION=...
# VITE_COMETCHAT_AUTH_KEY removed ← never commit to production

# Server-only (not prefixed — never sent to client)
COMETCHAT_API_KEY=...
COMETCHAT_APP_ID=...
COMETCHAT_REGION=...
```

### Testing with two real users

1. Create two users in your app (or CometChat dashboard test users `cometchat-uid-1` / `cometchat-uid-2`)
2. Open two browser windows (one normal, one incognito)
3. Sign in as User A in one, User B in the other
4. Both get their own auth tokens → both log in to CometChat as themselves
5. Send a message from User A → it appears in User B's conversation list in real time

### Production checklist

- [ ] `COMETCHAT_AUTH_KEY` removed from all `.env` files
- [ ] `COMETCHAT_API_KEY` present in server environment only (not prefixed for client)
- [ ] `createCometChatUser()` called at sign-up
- [ ] `/api/cometchat-token` endpoint reads UID from server session (not from client request body)
- [ ] `loginWithAuthToken()` used on client — no `login(UID)` with hardcoded value
- [ ] Auth token endpoint is authenticated (only logged-in users can call it)
