---
name: cometchat-react-reactjs
description: Integrate CometChat React UI Kit v6 into a React (Vite or CRA) project using the @cometchat/skills-cli. Replaces the v1 prose skill once the CLI is published to npm.
license: "MIT"
compatibility: "Node.js >=18; React >=18; Vite >=4 or react-scripts (CRA); @cometchat/chat-uikit-react ^6"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "2.0.0"
  tags: "chat cometchat react vite cra messaging ui-kit"
---

## Use this skill when

The user wants to integrate CometChat React UI Kit v6 into a React.js project (Vite or Create React App). Trigger phrases:

- "add cometchat to my react app"
- "integrate cometchat in vite"
- "/cometchat" or "/cometchat 1" / "/cometchat 2" / "/cometchat 3"

## Do not use this skill when

- The project uses Next.js → use `cometchat-react-nextjs` instead
- The project uses React Router → use `cometchat-react-react-router` instead
- The project uses Astro → use `cometchat-react-astro` instead

## How this skill works

This skill is **thin glue** around two things: (a) the `cometchat` CLI for
deterministic scaffolding, and (b) the CometChat docs MCP for everything
else. Your job is to call the CLI in the right order and query the docs
MCP for any fact the CLI doesn't ship in its templates. **Never hand-write
integration code. Never invent SDK signatures from memory.**

## Docs MCP contract (read this before any SDK question)

The CometChat docs MCP at `cometchat-docs` is the **canonical, always-current
source of truth** for everything beyond what `cometchat init` and the other
deterministic CLI commands produce. Specifically:

- Component props, prop types, default values
- Callback signatures (`onItemClick`, `onError`, etc.)
- Request builder methods (`ConversationsRequestBuilder.setLimit`, etc.)
- SDK events (`CometChatMessageEvents.ccMessageSent`, etc.)
- CSS variable names (verify before generating overrides)
- Error message decoder (e.g. "what does INVALID_AUTH_KEY mean")
- Dashboard activation steps (the dashboard UI changes; never embed paths)

**Hard rules:**

1. **Always query the docs MCP first** for any of the above. Never invent
   SDK code from training-data memory.
2. **If the docs MCP is not installed**, STOP the moment you need a
   non-CLI fact. Tell the user: "I need the CometChat docs MCP to answer
   that. Install it with: `claude mcp add --transport http cometchat-docs
   https://www.cometchat.com/docs/mcp` (or the equivalent for your IDE).
   See https://www.cometchat.com/docs/mcp-server for other clients."
   Don't fall back to LLM memory — the SDK is too easy to hallucinate.
3. **The CLI's templates already handle the init/login/render path** —
   you don't need the docs MCP for any step that `cometchat init`,
   `cometchat apply-feature`, `cometchat apply-theme`, `cometchat
   add-widget`, `cometchat add-user-mgmt`, or `cometchat production-auth`
   handle. Use the MCP for everything BEYOND those.
4. **For canonical reference URLs**, the React UI Kit overview is
   https://www.cometchat.com/docs/ui-kit/react/overview — link the user
   there for deeper reading after the integration runs.

## Steps

### Step 1 — Detect

```bash
npx @cometchat/skills-cli@latest detect --json
```

**Two checks on the detect response — do them in this exact order. STOP
on either mismatch; do NOT proceed to view or apply.**

1. **Wrong framework:** if `framework` is not `"reactjs"`, stop and tell
   the user to use the correct framework skill instead
   (`cometchat-react-nextjs`, `cometchat-react-react-router`, or
   `cometchat-react-astro`).

2. **JavaScript-only project (`uses_jsx === true`):** the project was
   created with `npm create vite@latest -- --template react` (the
   JavaScript template) and has `.jsx` entry files instead of `.tsx`.
   The CometChat React UI Kit v6 templates are TypeScript-only. **Do
   NOT run view or apply** — the CLI will refuse, but the user
   experience is much better if you stop here and surface the recovery
   path immediately. Tell the user verbatim:

   > **This project uses JavaScript (`.jsx`).** The CometChat React UI
   > Kit v6 templates are TypeScript-only, so I can't integrate as-is.
   > Two options:
   >
   > 1. **Recreate the project as TypeScript** (recommended for new
   >    projects):
   >    ```
   >    npm create vite@latest my-react-app -- --template react-ts
   >    ```
   > 2. **Convert this project to TypeScript** first:
   >    - Add a `tsconfig.json` (see https://vite.dev/guide/features#typescript)
   >    - Rename `src/main.jsx` → `src/main.tsx`
   >    - Rename `src/App.jsx` → `src/App.tsx`
   >    - Update `index.html` to reference `/src/main.tsx`
   >    - Then re-run `/cometchat`.
   >
   > JSX template variants ship in a future release (v2.1).
   >
   > Which option do you want — recreate, convert, or stop here?

   Wait for the user's answer. If they pick "convert", offer to do the
   renames + tsconfig for them (since you have the Edit tool). If they
   pick "recreate", give them the exact command and stop. If they say
   "stop", stop. **Never** retry `cometchat apply` against an
   unconverted JS project.

### Step 1.5 — Authenticate the user

Before applying the integration the user must be signed in. The CLI
saves the bearer token to the OS keychain, so subsequent runs skip
this step automatically.

First, check status:

```bash
npx @cometchat/skills-cli@latest auth status --json
```

If the response says `"status": "logged-in"`, proceed to Step 2.
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

When the CLI prints `✓ Logged in as <email>`, proceed to Step 2. If
it exits with an error (`ACCESS_DENIED`, `EXPIRED`, `TIMEOUT`,
`NETWORK`), surface the message verbatim and stop. Do not retry
silently — let the user re-run `/cometchat`.

### Step 2 — Determine experience

If the user passed an experience number with `/cometchat <N>` (1, 2, or 3), use it directly and skip to Step 3.

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

After the user picks, log the choice and proceed to Step 2.5.

### Step 2.5 — Ask where chat should live (path)

Skip if the detect response shows no router (pure Vite SPA, no
`react-router-dom`/`next`/`astro` dep) OR if the user already passed
`--placement` / `--path` on the command line.

Otherwise ask the user with `AskUserQuestion`:

- **question:** "What URL path should the chat mount at?"
- **header:** "Chat route"
- **multiSelect:** false
- **options:**
  1. label: "/chat", description: "Default — simple and generic."
  2. label: "/messages", description: "Recommended for apps where chat is a core feature."
  3. label: "/inbox", description: "Fits messaging-first apps and support queues."
  4. label: "/messenger", description: "Fits community or social apps."

Accept an "Other" custom path if it starts with `/` and has no whitespace.

Pass the path to Step 4 (apply) as `--placement dedicated-route:<path>`.
Omit this if the project has no router — the CLI defaults to spa-root.

### Step 3 — Preview

```bash
npx @cometchat/skills-cli@latest view --experience N --framework reactjs --json
```

Show the user the file list (paths only — not full content) so they know what
will be created. Do not run apply yet.

### Step 4 — Apply

```bash
npx @cometchat/skills-cli@latest apply --experience N --framework reactjs
```

If the response status is:
- `applied` — the integration succeeded. Continue to step 5.
- `already-applied` — tell the user, run `info`, stop.
- `conflict` — surface the message verbatim. Suggest `--force` only if the
  user explicitly confirms they want to overwrite their existing integration.
- `error` — surface the error verbatim. Do not retry. Do not try to "fix" it.

### Step 5 — Verify

```bash
npx @cometchat/skills-cli@latest verify --json
```

If the response status is not `pass`, surface the failed checks verbatim
and ask the user how to proceed. Do not auto-fix.

### Step 6 — Install dependencies

Run the CLI's install command. It auto-detects the package manager
(npm / pnpm / yarn / bun) from the project's lockfile and installs
the deps the apply step declared:

```bash
npx @cometchat/skills-cli@latest install
```

This is idempotent — re-running on already-installed deps is a no-op.
The user invoked `/cometchat`, that IS consent to install dependencies.
Do not ask first. Surface the install output.

If install fails, surface the error verbatim and stop. Do not retry.

### Step 7 — Tell the user to fill in env vars + start the dev server

The CLI has already created a `.env` file with `YOUR_*_HERE` placeholder
values for `VITE_COMETCHAT_APP_ID`, `VITE_COMETCHAT_REGION`, and
`VITE_COMETCHAT_AUTH_KEY`, and added `.env` to `.gitignore`. The
apply response includes an `env_file` block confirming this and a
`next_steps` array — surface both verbatim. The user just needs to:

```
Open .env and replace the YOUR_*_HERE values with real ones from
https://app.cometchat.com → Your App → API & Auth Keys.
```

Then surface the next_steps array verbatim (it has the `npm run dev` /
visit URL / etc. instructions). Do NOT paraphrase the env var names —
the CLI knows which prefix the framework uses.

**Then add this guidance verbatim** so the user knows the test data
is already there and they can chat immediately:

> **Try it now — your test data is already there:**
>
> Every new CometChat app comes with **5 pre-created test users**
> (`cometchat-uid-1` through `cometchat-uid-5`) and **pre-created test
> groups**. Your integration logs in as `cometchat-uid-1` by default.
> When you open `http://localhost:5173`, here's what to expect and
> how to test:
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
>   user or group — just type in the composer and send. Your messages
>   appear immediately.
> - **Experience 3 (tab-based):** open the **Users** or **Groups** tab
>   inside the chat UI, pick any pre-seeded test user or group, and
>   start a thread. This is the fastest way to see messages flowing
>   without a second browser.

This is the END of **Phase A — initial integration**. Phase A landed
the user at "I have a working chat in my app." For most developers,
this is where the journey BEGINS, not where it ends.

### Step 8 — Open Phase B: ask what's next

> ## ⛔ RULES FOR EVERY PHASE B ACTION
>
> **Rule 1 — Re-read project state before every action.** Run this
> before writing any code:
>
> ```bash
> # What components are mounted right now?
> grep -hoE '<CometChat[A-Z][a-zA-Z]*' \
>   $(jq -r '.files_owned[]' .cometchat/state.json 2>/dev/null) \
>   2>/dev/null | sort -u
>
> # What features are applied?
> jq '.applied_features // []' .cometchat/state.json 2>/dev/null
> ```
>
> This tells you exactly what's in the project. Don't assume Phase A
> state is still current — the user may have added features, widgets,
> or customizations since then.
>
> **Rule 2 — NEVER use your own knowledge for CometChat code.** Your
> training data is outdated. The v6 API differs from v5/v4/v3.
> Components, props, and class names you "remember" may not exist.
>
> **Rule 3 — Use these sources of truth, in this order:**
>
> 1. **This lookup table** (below) — exact answers for top 20 cases.
>    If it's in the table, use what the table says. Done.
> 2. **The installed package's TypeScript definitions** — for prop
>    signatures not in the table, grep the d.ts directly:
>    ```bash
>    # Find a component's props interface
>    grep -A 80 "interface CometChat<ComponentName>Props" \
>      node_modules/@cometchat/chat-uikit-react/dist/index.d.ts \
>      2>/dev/null | head -80
>    ```
>    This is **faster and more accurate than the docs MCP** for prop
>    lookups. No network call, no empty results, no hallucination risk.
> 3. **The v6 sample app on GitHub** — for patterns that combine
>    multiple components (details, search view, threads, home layout):
>    ```bash
>    curl -s "https://raw.githubusercontent.com/cometchat/\
>    cometchat-uikit-react/v6/sample-app/src/components/\
>    <ComponentName>/<FileName>.tsx"
>    ```
>    Always fetch both the `.tsx` AND its matching CSS from
>    `sample-app/src/styles/<ComponentName>/`. Read the actual code.
>
>    **⛔ CRITICAL: when adapting sample app code, you MUST:**
>    - **Keep the EXACT same BEM class names** from the sample app
>      (e.g. `cometchat-user-details__header`, NOT `side-component-header`).
>      The sample app's class names are canonical. Do NOT rename them.
>    - **Keep the full prop interface** — `actionItems`, `showStatus`,
>      `onUserActionClick`, etc. Do NOT simplify or drop props. The
>      sample app's props exist because users need them (block/unblock,
>      delete chat, action buttons). Stripping them makes the component
>      less useful.
>    - **Fetch the COMPONENT'S OWN CSS** (e.g. `CometChatUserDetails.css`)
>      not just the wrapper CSS (`CometChatDetails.css`). These are two
>      different files — the wrapper handles the sidebar layout, the
>      component CSS handles the content styling.
>    - **Only strip:** `useContext(AppContext)` → inline values,
>      `getLocalizedString(...)` → inline English strings,
>      `import "../../styles/..."` → local import path,
>      `cometchat-resources/` SVG icons → Unicode or inline SVG.
>    - **Do NOT "simplify", "clean up", or "streamline"** the sample app
>      code. Copy it faithfully, strip only the 4 things above.
> 4. **The docs MCP** (`cometchat-docs`) — for event topics, request
>    builder methods, CSS selector names, dashboard config details.
>    Use as a LAST resort, not first.
> 5. **The component catalog** at
>    `.claude/skills/cometchat-customization/references/component-catalog.md`
>
> **If none have the answer**, tell the user you need to check the
> docs. Do NOT guess from memory.

> ## PHASE B COMPONENT LOOKUP — consult this table FIRST
>
> **Find the user's request in this table. If it's here, use exactly
> what the table says.**
>
> | User asks for | Answer | How to get it |
> |---|---|---|
> | "search" / "search bar" / "find conversations" / "conversation search" / "search messages" / "search across conversations" / "search all conversations" / "find messages" | `showSearchBar={true}` + `onSearchBarClicked` on `CometChatConversations`, swap in `<CometChatSearch>` when clicked | Add `showSearchBar={true}` and `onSearchBarClicked={() => setShowSearch(true)}` to the existing `CometChatConversations`. When search is active, conditionally render `<CometChatSearch onBack={...} onConversationClicked={...} onMessageClicked={...} />` in place of the conversation list. This gives full dual-scope search (conversations + messages + filter chips). Do NOT add just `showSearchBar` alone — that's only a basic name filter without real search. NEVER build a custom search bar — always use CometChat's built-in components. |
> | "search from message header" / "message search" / "search in conversation" | `showSearchOption={true}` + `onSearchOptionClicked` on `CometChatMessageHeader` → open `CometChatSearchView` from v6 sample app in a **side panel** | Fetch `sample-app/src/components/CometChatSearchView/CometChatSearchView.tsx` + its CSS. Render it as a side panel (like details/threads), NOT replacing the message list. The sample app scopes search to the current conversation via `uid={user.getUid()}` / `guid={group.getGuid()}` on `<CometChatSearch>`. On message click: set `goToMessageId` on `CometChatMessageList` to scroll to the message + pass `CometChatTextHighlightFormatter(searchKeyword)` via the `textFormatters` prop to highlight the match. Also fetch `sample-app/src/components/CometChatMessages/CometChatMessages.tsx` to see how it wires `goToMessageId` + `searchKeyword` + `getFormatters()`. |
> | "user details" / "user info panel" | `CometChatUserDetails.tsx` from v6 sample app | `curl -s "https://raw.githubusercontent.com/cometchat/cometchat-uikit-react/v6/sample-app/src/components/CometChatDetails/CometChatUserDetails.tsx"` — adapt to project, match BEM classes, fetch matching CSS from `sample-app/src/styles/CometChatDetails/`. Wire via `onItemClick` on `CometChatMessageHeader`. |
> | "group details" / "group info panel" | Group detail view inline in `CometChatHome.tsx` from v6 sample app | `curl -s "https://raw.githubusercontent.com/cometchat/cometchat-uikit-react/v6/sample-app/src/components/CometChatHome/CometChatHome.tsx"` — look for `SideComponentGroup`. Wire via `onItemClick` on `CometChatMessageHeader`. Uses `CometChatGroupMembers` (exported) for the members list. |
> | "threaded messages" / "reply in thread" | `CometChatThreadHeader` (exported) + `CometChatMessageList` with `parentMessageId` + `CometChatMessageComposer` with `parentMessageId` | Wire via `onThreadRepliesClick` on the main `CometChatMessageList`. For the full layout pattern, also fetch `sample-app/src/components/CometChatDetails/CometChatThreadedMessages.tsx`. |
> | "group members" | `CometChatGroupMembers` (exported) | `<CometChatGroupMembers group={selectedGroup} />` |
> | "add members to group" | `CometChatAddMembers/` from v6 sample app | Fetch from `sample-app/src/components/CometChatAddMembers/` |
> | "banned members" | `CometChatBannedMembers/` from v6 sample app | Fetch from `sample-app/src/components/CometChatBannedMembers/` |
> | "transfer group ownership" | `CometChatTransferOwnership/` from v6 sample app | Fetch from `sample-app/src/components/CometChatTransferOwnership/` |
> | "create group" | `CometChatCreateGroup/` from v6 sample app | Fetch from `sample-app/src/components/CometChatCreateGroup/` |
> | "voice/video call buttons" | `CometChatCallButtons` (exported) | Place in `CometChatMessageHeader`'s `menu` prop or standalone |
> | "incoming call" | `CometChatIncomingCall` (exported) | Render at app root, always-mounted |
> | "call logs" / "call history" | `CometChatCallLogs` (exported) | `<CometChatCallLogs />` |
> | "users list" / "browse users" | `CometChatUsers` (exported) | `<CometChatUsers onItemClick={...} />` |
> | "groups list" / "browse groups" | `CometChatGroups` (exported) | `<CometChatGroups onItemClick={...} />` |
> | "filter conversations" | `conversationsRequestBuilder` prop on `CometChatConversations` | Prop, not new component |
> | "filter messages" | `messagesRequestBuilder` prop on `CometChatMessageList` | Prop, not new component |
> | "custom empty state" | `emptyStateView` prop on any list component | Prop, not new component |
> | "custom message bubble" | `templates` prop on `CometChatMessageList` | Use `CometChatMessageTemplate`, NOT a hand-written bubble |
> | "emoji picker" | `CometChatEmojiKeyboard` (exported) | Already auto-rendered in composer |
> | "message info / receipts" | `CometChatMessageInformation` (exported) | Triggered from message options |
> | "top-level layout" / "home screen" | `CometChatHome.tsx` from v6 sample app | Fetch from `sample-app/src/components/CometChatHome/` |
>
> **The v6 sample app URL for ALL patterns above:**
> `https://github.com/cometchat/cometchat-uikit-react/tree/v6/sample-app/src/components`
>
> **The docs MCP does NOT index the sample app.** When the MCP says
> "no CometChatDetails exists" — it's WRONG. The sample app has it.
> Always fetch from GitHub before concluding something doesn't exist.
>
> **When adapting sample app code:** fetch both the `.tsx` and its
> matching `.css` from `sample-app/src/styles/<ComponentName>/`. Mirror
> the folder structure. Match the BEM class names
> (`.cometchat-user-details__*`). Strip `AppContext` / `getLocalizedString` /
> `cometchat-resources/` icon imports. Custom layout-glue CSS must use
> `--cometchat-*` variables, never hardcoded colors/fonts/borders.
>
> **If the request is NOT in this table:** check existing component
> props first (the kit is "props over components"), then check kit
> exports, then check the sample app on GitHub, then hand-roll as
> absolute last resort. For the full component catalog (88 exports +
> 14 sample-app patterns), read
> `.claude/skills/cometchat-customization/references/component-catalog.md`.

After the user sees the chat working in their browser (or after they
say "now what?"), present the iteration menu using `AskUserQuestion`.
This reflects the React UI Kit Integration Journey: **init is the
trailhead, not the destination.**

Use `AskUserQuestion` with these options:
- **question:** "Your CometChat integration is running. What do you want to do next?"
- **header:** "Next Steps"
- **multiSelect:** true
- **options:**
  1. label: "Customize the look and feel", description: "Theme presets (Slack / WhatsApp / iMessage / Discord / Notion), brand colors, font, border radius, dark mode. → cometchat-theming skill"
  2. label: "Add a feature", description: "Voice/video calls, polls, reactions, AI smart replies, link previews, file collaboration, ~35 more. → cometchat-features skill"
  3. label: "Customize a component", description: "Filter conversations, custom message bubbles, custom header, etc. → cometchat-customization skill"
  4. label: "Add a floating chat widget", description: "Button-in-the-corner chat overlay. → npx @cometchat/skills-cli@latest add-widget"
  5. label: "Production auth", description: "Replace client-side Auth Key with a server-side token endpoint. Auto-rewrites login flow. Note: reactjs/Vite needs a separate backend. → npx @cometchat/skills-cli@latest production-auth"
  6. label: "Server-side user management", description: "Sign up / update / delete CometChat users from your backend. Note: reactjs needs a separate backend. → npx @cometchat/skills-cli@latest add-user-mgmt"
  7. label: "Diagnose a problem", description: "Drift detection, env-var checks, AST verifications. → npx @cometchat/skills-cli@latest doctor"
  8. label: "Where am I in the journey?", description: "Step-by-step progress checklist (base / features / widget / production-auth / theme) with highest-leverage next step. → npx @cometchat/skills-cli@latest status"
  9. label: "I'm done for now", description: "Show the audit log and integration summary."

Handle the user's selections in order. Each option corresponds to a CLI
command or a sub-skill that already exists; don't re-implement any of
them in this skill. Your job is to be the GUIDE through the iteration
loop, not the worker.

After each option finishes, **re-show this menu** until the user picks
`i` (done). The iteration loop is the whole point of Phase B.

## Hard rules

- **Never** edit files by hand during Phase A. The CLI is the only thing that writes files during initial integration.
- **Phase B customization** (search, details, threads, custom bubbles) DOES require editing files — but you MUST consult the **PHASE B COMPONENT LOOKUP** table above BEFORE writing any code. If the user's request matches a row in that table, follow the table's instructions exactly. Do NOT hand-roll custom components when CometChat provides built-in ones.
- **NEVER build custom search UI.** CometChat provides `<CometChatSearch>` (full dual-scope search with filter chips) and `showSearchBar` / `onSearchBarClicked` props on `CometChatConversations`. Any request involving "search", "find messages", "search conversations", or "search across conversations" MUST use these built-in components. Do NOT create custom search bars, search inputs, or search result lists.
- **Always ask the user for choices that are theirs to make** (which experience, which theme preset, which optional feature). Default agent contexts (Claude Code, Cursor, Copilot) are interactive — don't pre-select on the user's behalf.
- **Never** ask the user for choices the CLI already decides deterministically (which framework, which file paths, which package manager). The CLI's detect output is the source of truth.
- **The user invoking `/cometchat` IS consent** to run the deterministic integration steps (install dependencies, write template files, patch CSS imports). Don't ask permission for those — they're what the skill is FOR.
- **Never** retry failed CLI commands automatically. Surface the error verbatim and let the user decide.
- **Never** invent SDK code. If you don't know how something works, query the docs MCP.
- **Always** use `npx @cometchat/skills-cli@latest` (with `@latest`) so the user gets the current version.
