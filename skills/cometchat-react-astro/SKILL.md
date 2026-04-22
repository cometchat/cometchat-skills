---
name: cometchat-react-astro
description: Integrate CometChat React UI Kit v6 into an Astro project using React islands and the @cometchat/skills-cli. Replaces the v1 prose skill once the CLI is published to npm.
license: "MIT"
compatibility: "Node.js >=18; React >=18; Astro >=4; @cometchat/chat-uikit-react ^6"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "2.0.0"
  tags: "chat cometchat react astro islands client-only messaging ui-kit"
---

## Use this skill when

The user wants to integrate CometChat into an Astro project using React islands.

## Do not use this skill when

- The project uses Next.js → use `cometchat-react-nextjs`
- The project is plain React.js → use `cometchat-react-reactjs`
- The project uses React Router → use `cometchat-react-react-router`

## How this skill works

Thin glue around two things: (a) the `cometchat` CLI for deterministic
scaffolding, (b) the CometChat docs MCP for everything else. Never invent
SDK signatures from memory.

## Docs MCP contract (read this before any SDK question)

The CometChat docs MCP at `cometchat-docs` is the **canonical, always-current
source of truth** for everything beyond what the CLI's templates produce:
component props, callback signatures, request builder methods, SDK events,
CSS variable names, error decoders, dashboard activation steps. Astro
specifically needs the MCP for `client:only` patterns and React island
boundary questions.

**Hard rules:**

1. **Always query the docs MCP first** for any SDK reference question. Never
   invent code from training-data memory.
2. **If the docs MCP is not installed**, STOP the moment you need a non-CLI
   fact. Tell the user: "I need the CometChat docs MCP. Install it with
   `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp`
   (see https://www.cometchat.com/docs/mcp-server for other clients)."
3. **The CLI's templates already handle** init/login/render, production-auth,
   user-mgmt, theming, widget, and component-swap features. Use the MCP for
   everything BEYOND those.
4. **Canonical reference URL:** https://www.cometchat.com/docs/ui-kit/react/overview
   (Astro specifics: query the MCP for "astro react island" or
   "client:only react")

## Steps

### Step 1 — Pre-flight: ensure @astrojs/react

The CLI assumes `@astrojs/react` integration is configured. If the user's
`astro.config.mjs` doesn't have it, tell them to run:

```bash
npx astro add react
```

…and confirm it succeeded before continuing.

### Step 2 — Detect

```bash
npx @cometchat/skills-cli@latest detect --json
```

If `framework` is not `"astro"`, **stop** and use the correct framework skill.

### Step 2.5 — Authenticate the user

Before applying the integration the user must be signed in. The CLI
saves the bearer token to the OS keychain, so subsequent runs skip
this step automatically.

First, check status:

```bash
npx @cometchat/skills-cli@latest auth status --json
```

If the response says `"status": "logged-in"`, proceed to Step 3.
Otherwise, ask the user with `AskUserQuestion`:

- **question:** "Do you have a CometChat account?"
- **header:** "Account"
- **multiSelect:** false
- **options:**
  1. label: "Log in", description: "I already have a CometChat account. Opens the dashboard in my browser to sign in."
  2. label: "Sign up", description: "Create a new CometChat account. Opens the signup page in my browser."

Run the matching command — it opens the browser and polls until the
user authorizes (up to 15 min):

- **Log in** → `npx @cometchat/skills-cli@latest auth login`
- **Sign up** → `npx @cometchat/skills-cli@latest auth signup`

When the CLI prints `✓ Logged in as <email>`, proceed to Step 3. If
it exits with an error (`ACCESS_DENIED`, `EXPIRED`, `TIMEOUT`,
`NETWORK`), surface the message verbatim and stop. Do not retry
silently — let the user re-run `/cometchat`.

### Step 3 — Determine experience

If the user passed `/cometchat <N>` (1, 2, or 3), use it directly and skip to Step 4.

Otherwise, **ask the user which experience they want** using the `AskUserQuestion` tool so they get an arrow-key selector. Do not assume a default.

Use `AskUserQuestion` with these options:
- **question:** "Which CometChat experience do you want?"
- **header:** "Experience"
- **multiSelect:** false
- **options:**
  1. label: "Multi-conversation", description: "Users switch between threads. Two-panel: conversation list + active thread (header, message list, composer). Messaging apps, team chat, inboxes."
  2. label: "Single thread", description: "One chat window for two known users or a group. Header + message list + composer, no conversation list. Marketplace chat, embedded consult."
  3. label: "Full messenger", description: "Bottom tab bar: Chats / Calls / Users / Groups. Users browse, start conversations, make calls. Social apps, community platforms, dating."

Map the user's selection to the experience number: Multi-conversation → 1, Single thread → 2, Full messenger → 3.

After the user picks, log the choice and proceed to Step 4 with their N.

### Step 4 — Preview + Apply + Verify

```bash
npx @cometchat/skills-cli@latest view  --experience N --framework astro --json
npx @cometchat/skills-cli@latest apply --experience N --framework astro --placement dedicated-route
npx @cometchat/skills-cli@latest verify --json
```

After apply:
- `applied` → continue
- `already-applied` → tell user, run `info`, stop
- `conflict` → surface verbatim
- `error` → surface verbatim, do not retry

### Step 5 — Show install + next steps

### Step 5 — Install dependencies

```bash
npx @cometchat/skills-cli@latest install
```

Auto-detects npm/pnpm/yarn/bun from the lockfile and installs ALL the
deps the apply step declared — for Astro that's `@astrojs/react`,
`react`, `react-dom`, AND the CometChat packages. Idempotent. The
user invoked `/cometchat`, that IS consent — do not ask first.
Surface the install output.

### Step 6 — Show env vars + next steps

The CLI has already created `.env` with `YOUR_*_HERE` placeholder
values for the three CometChat env vars (APP_ID, REGION, AUTH_KEY) and
added `.env` to `.gitignore`. The apply response includes an
`env_file` block confirming this and a `next_steps` array — surface
both verbatim. The user just needs to:

```
Open .env and replace the YOUR_*_HERE values with real ones from
https://app.cometchat.com → Your App → API & Auth Keys.
```

Then surface the next_steps array verbatim from the apply response.

The CLI creates `src/pages/chat.astro` (an `.astro` page that mounts a React
island via `<ChatApp client:only="react" />`) and `src/cometchat/ChatApp.tsx`
(the React component, which imports `css-variables.css` directly inside the
file because global stylesheets do not apply to client:only islands).

**Then add this guidance verbatim** so the user knows what to expect
when they open the browser:

> **Try it now — your test data is already there:**
>
> Every new CometChat app comes with **5 pre-created test users**
> (`cometchat-uid-1` through `cometchat-uid-5`) and **pre-created test
> groups**. Your integration logs in as `cometchat-uid-1` by default.
> When you open `http://localhost:4321/chat`, here's what to expect
> and how to test:
>
> - **Experience 1 (conversation list):** the left panel shows
>   `cometchat-uid-1`'s existing conversations. If this is a brand-new
>   app with no prior messages, the list starts empty — that's normal,
>   not a bug. To make a conversation appear, open a second browser
>   (or incognito window), edit the `login()` call in the integration
>   file to use `cometchat-uid-2`, and send a message to
>   `cometchat-uid-1`. Refresh the first browser and the conversation
>   shows up instantly.
> - **Experience 2 (one-to-one):** the chat is hardcoded to a test
>   user or group — just type in the composer and send.
> - **Experience 3 (tab-based):** open the **Users** or **Groups** tab
>   inside the chat UI, pick any pre-seeded test user or group, and
>   start a thread. This is the fastest way to see messages flowing
>   without a second browser.

This is the END of **Phase A — initial integration**. For most
developers, this is where the journey BEGINS.

### Step 7 — Open Phase B: ask what's next

> ## ⛔ RULES FOR EVERY PHASE B ACTION
>
> **Rule 1 — Re-read project state before every action.** Run this
> before writing any code:
> ```bash
> grep -hoE '<CometChat[A-Z][a-zA-Z]*' \
>   $(jq -r '.files_owned[]' .cometchat/state.json 2>/dev/null) \
>   2>/dev/null | sort -u
> ```
> This tells you what components are mounted. Don't assume Phase A
> state is still current.
>
> **Rule 2 — NEVER use your own knowledge for CometChat code.** Your
> training data is outdated. The v6 API differs from v5/v4/v3.
>
> **Rule 3 — Sources of truth, in this order:**
> 1. **This lookup table** (below) — exact answers for top 20 cases
> 2. **The installed d.ts** — grep prop interfaces directly:
>    `grep -A 80 "interface CometChat<Name>Props" node_modules/@cometchat/chat-uikit-react/dist/index.d.ts`
>    Faster and more accurate than docs MCP for prop lookups.
> 3. **The v6 sample app on GitHub** — fetch with curl from
>    `raw.githubusercontent.com/cometchat/cometchat-uikit-react/v6/sample-app/...`
>    **Keep the EXACT BEM class names** (`cometchat-user-details__header`,
>    NOT `side-component-header`). **Keep the full prop interface**
>    (actionItems, showStatus, etc. — don't drop props). **Fetch the
>    component's OWN CSS** (e.g. `CometChatUserDetails.css`), not just
>    the wrapper. Only strip: AppContext, getLocalizedString, icon imports.
>    Do NOT simplify, rename, or "clean up" the sample app code.
> 4. **The docs MCP** — LAST resort for events, builders, CSS selectors
> 5. **The component catalog** at
>    `.claude/skills/cometchat-customization/references/component-catalog.md`
>
> **If none have the answer**, tell the user you need to check the docs.
> Do NOT guess from memory.

> ## PHASE B COMPONENT LOOKUP
>
> **Find the user's request in this table. If it's here, use exactly
> what the table says.**
>
> | User asks for | Answer | How to get it |
> |---|---|---|
> | "search" / "search bar" / "conversation search" / "search messages" / "search across conversations" / "search all conversations" / "find messages" | `showSearchBar={true}` + `onSearchBarClicked` on `CometChatConversations`, swap in `<CometChatSearch>` when clicked | Add both props + conditionally render `<CometChatSearch>` for full dual-scope search. Do NOT add just `showSearchBar` alone — that's only a basic name filter. NEVER build a custom search bar — always use CometChat's built-in components. |
> | "search from message header" / "message search" | `showSearchOption={true}` + `onSearchOptionClicked` on `CometChatMessageHeader` → open `CometChatSearchView` (sample app) in side panel | Scoped to current conversation (`uid`/`guid`). On message click: `goToMessageId` to scroll + `CometChatTextHighlightFormatter` to highlight. Fetch `sample-app/src/components/CometChatSearchView/` + `CometChatMessages/`. |
> | "user details" / "user info" | `CometChatUserDetails.tsx` from v6 sample app | Fetch from `raw.githubusercontent.com/cometchat/cometchat-uikit-react/v6/sample-app/src/components/CometChatDetails/CometChatUserDetails.tsx` + matching CSS. Wire via `onItemClick` on `CometChatMessageHeader`. |
> | "group details" / "group info" | Group view in `CometChatHome.tsx` from v6 sample app | Fetch `CometChatHome.tsx`, find `SideComponentGroup`. Uses `CometChatGroupMembers` (exported). |
> | "threaded messages" / "reply in thread" | `CometChatThreadHeader` (exported) + `CometChatMessageList` + `CometChatMessageComposer` with `parentMessageId` | Wire via `onThreadRepliesClick`. Full layout: fetch `sample-app/.../CometChatThreadedMessages.tsx`. |
> | "group members" | `CometChatGroupMembers` (exported) | Direct use |
> | "add/ban/transfer members" | Sample app `CometChatAddMembers/`, `CometChatBannedMembers/`, `CometChatTransferOwnership/` | Fetch from `sample-app/src/components/CometChat<X>/` |
> | "create group" | Sample app `CometChatCreateGroup/` | Fetch from sample app |
> | "call buttons" | `CometChatCallButtons` (exported) | Place in header `menu` prop |
> | "incoming call" | `CometChatIncomingCall` (exported) | Render at app root |
> | "call logs" | `CometChatCallLogs` (exported) | Direct use |
> | "users/groups list" | `CometChatUsers` / `CometChatGroups` (exported) | Direct use |
> | "filter conversations/messages" | `conversationsRequestBuilder` / `messagesRequestBuilder` props | Prop, not new component |
> | "custom empty/error/loading state" | `emptyStateView` / `errorStateView` / `loadingStateView` props | Prop, not new component |
> | "custom message bubble" | `templates` prop on `CometChatMessageList` | NOT a hand-written bubble |
> | "top-level layout" | `CometChatHome.tsx` from v6 sample app | Fetch from sample app |
>
> **Sample app URL:** `https://github.com/cometchat/cometchat-uikit-react/tree/v6/sample-app/src/components`
>
> **The docs MCP does NOT index the sample app.** When MCP says "no
> CometChatDetails exists" — it's wrong. Always fetch from GitHub.
>
> **When adapting sample app code:** fetch both `.tsx` + CSS from
> `sample-app/src/styles/<ComponentName>/`. Match BEM classes. Strip
> `AppContext` / `getLocalizedString` / `cometchat-resources/`. Custom
> CSS must use `--cometchat-*` variables, never hardcoded values.
>
> **Not in the table?** Check existing component props → kit exports →
> sample app on GitHub → hand-roll as last resort. Full catalog:
> `.claude/skills/cometchat-customization/references/component-catalog.md`.

After the user sees the chat working at `/chat`, present the iteration
menu using `AskUserQuestion`. This reflects the React UI Kit Integration
Journey: **init is the trailhead, not the destination.**

Use `AskUserQuestion` with these options:
- **question:** "Your CometChat integration is running. What do you want to do next?"
- **header:** "Next Steps"
- **multiSelect:** true
- **options:**
  1. label: "Customize the look and feel", description: "Theme presets (Slack / WhatsApp / iMessage / Discord / Notion), brand colors, font, border radius, dark mode. Astro caveat: theme overrides live inside the React island .tsx file. → cometchat-theming skill"
  2. label: "Add a feature", description: "Voice/video calls, polls, reactions, AI smart replies, link previews, file collaboration, ~35 more. → cometchat-features skill"
  3. label: "Customize a component", description: "Filter conversations, custom message bubbles, custom header, etc. → cometchat-customization skill"
  4. label: "Add a floating chat widget", description: "React island via <CometChatWidget client:only='react' /> in any .astro file. → npx @cometchat/skills-cli@latest add-widget"
  5. label: "Production auth", description: "Server-side token endpoint at src/pages/api/cometchat-token.ts. Auto-rewrites client login. → npx @cometchat/skills-cli@latest production-auth"
  6. label: "Server-side user management", description: "POST/PATCH/DELETE endpoint at src/pages/api/cometchat-user.ts. → npx @cometchat/skills-cli@latest add-user-mgmt"
  7. label: "Diagnose a problem", description: "Drift detection, env-var checks, AST verifications. → npx @cometchat/skills-cli@latest doctor"
  8. label: "Where am I in the journey?", description: "Step-by-step progress checklist (base / features / widget / production-auth / theme) with highest-leverage next step. → npx @cometchat/skills-cli@latest status"
  9. label: "I'm done for now", description: "Show the audit log and integration summary."
Handle the user's selections in order, then re-show the menu until they
pick "I'm done for now". The iteration loop is Phase B's whole point.

## Hard rules

- The CLI is the only thing that writes files during Phase A. Never edit by hand during initial integration.
- **Phase B customization** (search, details, threads, custom bubbles) DOES require editing files — but you MUST consult the **PHASE B COMPONENT LOOKUP** table above BEFORE writing any code. If the user's request matches a row in that table, follow the table's instructions exactly. Do NOT hand-roll custom components when CometChat provides built-in ones.
- **NEVER build custom search UI.** CometChat provides `<CometChatSearch>` and `showSearchBar` / `onSearchBarClicked` props. Any request involving "search", "find messages", "search conversations" MUST use these built-in components. Do NOT create custom search bars, inputs, or result lists.
- **Always ask the user for choices that are theirs to make** (which experience, theme preset, optional feature). Default agent contexts are interactive — don't pre-select.
- **Never** ask for choices the CLI already decides (file paths, package manager, SSR strategy). Detect output is the source of truth.
- The user invoking `/cometchat` IS consent to run install/apply/verify.
- Never retry failed commands automatically.
- Never invent SDK code. Query the docs MCP if unsure.
- **Astro-specific:** Never put `css-variables.css` in a global stylesheet — it must live inside the React island `.tsx` file because Astro `client:only="react"` islands don't pick up global stylesheets.
  It must be imported inside the React island `.tsx` file.
- Always use `npx @cometchat/skills-cli@latest`.
