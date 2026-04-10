---
name: cometchat-features
description: Add features (calls, reactions, polls, file sharing, presence, etc.) to an already-integrated CometChat project. Routes to the right sub-flow based on feature type — default features (already enabled), dashboard-toggle features (extensions + AI), package-install features (calls), or component-swap features (rich text).
license: "MIT"
compatibility: "Node.js >=18; @cometchat/chat-uikit-react ^6; integration must already be applied"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "2.0.0"
  tags: "cometchat features extensions calls reactions polls ai-features"
---

> **STATUS: v2.0.** Both the `cometchat features` browse command and
> the `cometchat apply-feature <id>` command ship in
> `@cometchat/skills-cli@2.0.0` on npm. This skill is a thin wrapper:
> classify the requested feature, then call the right CLI command for
> its category (default / dashboard-toggle / package-install /
> component-swap).

## Use this skill when

The user wants to add a specific feature to an already-integrated CometChat
project. Trigger phrases:

- `/cometchat features`
- `/cometchat features <name>` (e.g. `/cometchat features reactions`)
- `/cometchat <feature>` (e.g. `/cometchat polls`, `/cometchat calls`)
- "add reactions to my chat"
- "add video calling"
- "enable polls"
- "add file sharing"
- "enable smart replies"
- "add typing indicators"

## Preconditions

The user must have an existing integration:

```bash
npx @cometchat/skills-cli@latest info --json
```

If `integrated` is `false`, **stop** and tell the user to run `/cometchat`
first to create the integration.

## The feature catalog (46 features in v2)

CometChat features split into 4 types by what work is needed:

### Type 1 — Default features (~14, already enabled in UI Kit)

These are already part of the components your integration uses. The skill's
job is to **tell the user they're already there** and point at the relevant
component:

- Instant Messaging
- Media Sharing (file/image/audio/video)
- Read Receipts
- Mark as Unread
- Typing Indicator
- User Presence (online/offline)
- Reactions
- Mentions (incl. @all)
- Threaded Conversations
- Quoted Replies
- Group Chat
- Report Message
- Conversation/Advanced Search

For these: query the docs MCP for the feature's component/usage docs, show
the user where it is in their integration. **No code changes needed.**

### Type 2 — Dashboard-toggle features (~27, no code needed)

These require flipping a toggle in the [CometChat Dashboard](https://app.cometchat.com).
Once enabled, the UI Kit auto-integrates them. **No code changes needed.**

**Core features (always-on toggles, found at the top of the page):**
Instant Messaging, Media Sharing, Read Receipts, Mark as Unread,
Typing Indicators, User Presence, Reactions, Mentions, Threaded
Conversations, Quoted Replies, Group Chats, Report Message,
Conversation and Advanced Search

**Extensions — User Experience:**
Bitly, Link Preview, Message Shortcuts, Pin Message, Rich Media
Preview, Save Message, Thumbnail Generation, TinyURL, Voice
Transcription

**Extensions — User Engagement:**
Giphy, Message Translation, Polls, Reminders, Stickers, Stipop, Tenor

**Extensions — Collaboration:**
Collaborative Document, Collaborative Whiteboard

**Extensions — Security:**
Disappearing Messages

**Extensions — Customer Support:**
Chatwoot, Intercom

**Smart Chat Features (AI):**
Conversation Starter, Smart Replies, Conversation Summary

**Exact dashboard path (give this to the user verbatim):**

> 1. Open https://app.cometchat.com
> 2. Select your app
> 3. In the left sidebar: **Chat & Messaging** → **Features**
> 4. The page lists all features organized by category (Core,
>    Extensions, Smart Chat Features)
> 5. Find the feature and flip its **Status** toggle to ON
> 6. Some extensions also have a ⚙️ settings icon — click it if
>    the feature needs configuration (e.g. API keys for Giphy,
>    language settings for Message Translation)
> 7. Changes take effect immediately — refresh the chat in the
>    browser to see the feature appear

After enabling, run `cometchat verify` to ensure the existing
integration still passes. No code changes are needed — the UI Kit
picks up enabled features automatically.

### Type 3 — Package-install features (4, calls)

These require installing `@cometchat/calls-sdk-javascript`. Once installed,
the UI Kit auto-detects it and surfaces the call UI in CometChatMessageHeader,
CometChatConversations, etc.

- Call Buttons (in message headers)
- Incoming Call notifications
- Outgoing Call interface
- Call Logs (call history)

For these, the user opting in IS consent — run the install directly:

```bash
npm install @cometchat/calls-sdk-javascript
npx @cometchat/skills-cli@latest verify --json
```

The UI Kit's `initiateAfterLogin()` auto-calls `enableCalling()` after the
package is installed. No manual wiring needed for default call buttons in
CometChatMessageHeader. Restart the dev server.

### Type 4 — Component-swap features (drop-in variant)

The CometChat React UI Kit ships drop-in variant components for some
features. Currently:

- `rich-text-formatting` swaps `CometChatMessageComposer` →
  `CometChatCompactMessageComposer` (compact composer enables rich text
  formatting by default; the regular composer hardcodes
  `enableRichTextEditor=false`)

The CLI handles the swap automatically. Run:

```bash
npx @cometchat/skills-cli@latest apply-feature rich-text-formatting
```

This walks `state.files_owned`, performs a word-boundary regex replace of
`CometChatMessageComposer` → `CometChatCompactMessageComposer` in every
file that uses it, updates `state.json` checksums, and records the
applied feature so re-runs are no-ops. Idempotent. Surface the output.

Do NOT hand-edit the swap. The CLI is the source of truth.

## Docs MCP contract

The CometChat docs MCP at `cometchat-docs` is a **hard requirement** for
this skill. It's the canonical source for:

- Per-feature SDK reference (props, callbacks, builders, events)
- Per-feature configuration details beyond the dashboard path above
- Feature compatibility notes (which features need backend setup,
  which auto-wire, which require explicit `setExtensions([...])`)

**Hard rules:**

1. **Always query the docs MCP first** before answering any feature
   question that's not in our local catalog (`cometchat features info`).
2. **If the docs MCP is not installed**, STOP. Tell the user:
   "I need the CometChat docs MCP to walk you through this feature.
   Install it with `claude mcp add --transport http cometchat-docs
   https://www.cometchat.com/docs/mcp` and re-run."
3. **Use the dashboard path from this skill** (Chat & Messaging →
   Features) for all toggle features. Query the docs MCP for
   per-feature configuration details beyond the basic toggle.
4. **Canonical reference URLs** (use as starting points if the agent
   doesn't have an MCP query handy):
   - Extensions: https://www.cometchat.com/docs/ui-kit/react/extensions
   - AI features: https://www.cometchat.com/docs/ui-kit/react/ai-features
   - Calls: https://www.cometchat.com/docs/ui-kit/react/call-features
   - Core features: https://www.cometchat.com/docs/ui-kit/react/core-features

## Steps

### Step 1 — Read state

```bash
npx @cometchat/skills-cli@latest info --json
```

If not integrated, stop. Otherwise note the framework + experience so you
can find the right files.

### Step 2 — Determine feature

If the user named a feature, use it. Otherwise list the categories above
and ask which feature they want.

### Step 3 — Classify the feature

Match the feature name against the 4 categories above. If you don't know the
type, query the docs MCP first.

### Step 4 — Execute the right sub-flow

- **Default:** show the user it's already there. Point at the component.
  Use `npx @cometchat/skills-cli@latest features info <id>` to surface
  the walkthrough verbatim.
  - **CRITICAL — if the user explicitly wants a UI element to surface
    the default feature** (e.g. "implement conversation search",
    "add a search bar", "show typing indicators in the header",
    "expose mentions in the composer"), **do NOT add a new component
    yet**. Most default features are exposed via PROPS on the
    components your integration already mounts:
    - "search bar" → `showSearchBar` on `CometChatConversations`
      (and `onSearchBarClicked` to swap in `<CometChatSearch>` for
      advanced dual-scope search if the user wants that)
    - "filter conversations / messages" → `conversationsRequestBuilder`
      / `messagesRequestBuilder`
    - "custom empty / error / loading state" → `emptyStateView`,
      `errorStateView`, `loadingStateView`
    - "custom message bubble" → `templates` prop on
      `CometChatMessageList` (NOT a custom bubble component)
    - "hide / disable a sub-feature" → `disable*` boolean props
    - "click handler" → `onItemClick`, `onMessageClick`,
      `onSearchBarClicked`, `onBack`
    - "custom subtitle / status / timestamp" → `subtitleView`,
      `statusView`, `timestampView`
    Process before any code change:
    1. Read the files in `.cometchat/state.json` `files_owned` and
       grep for the `<CometChat[A-Z]` JSX components actually in use:
       ```bash
       grep -hoE '<CometChat[A-Z][a-zA-Z]*' \
         $(jq -r '.files_owned[]' .cometchat/state.json 2>/dev/null) \
         2>/dev/null | sort -u
       ```
    2. Query the docs MCP for `"<ComponentName> props"` for each one.
    3. If a prop matches the user's intent, **add the prop and stop**.
       No new components, no custom CSS, no new files.
    4. Only if no prop matches, route to the `cometchat-customization`
       skill for the full four-tier discovery.
- **Dashboard-toggle:** give the user the exact path: **app.cometchat.com
  → select app → sidebar: Chat & Messaging → Features → find the
  feature → flip the Status toggle ON.** The user must do this
  themselves (the agent can't access the dashboard). Run
  `cometchat features info <id>` for any per-feature config details
  beyond the basic toggle.
- **Package-install (calls):** run `npm install @cometchat/calls-sdk-javascript`
  directly. The user opted in, that IS consent.
- **Component-swap:** run `npx @cometchat/skills-cli@latest apply-feature <id>`.
  The CLI handles the swap deterministically. Do NOT hand-edit.

### Step 5 — Verify

```bash
npx @cometchat/skills-cli@latest verify --json
```

Surface any failed checks verbatim. If anything looks off after enabling
a feature (drift, unexpected build error, env warning), run
`cometchat doctor` for combined drift + env + AST diagnostics with
per-issue fix instructions, or route to the `cometchat-troubleshooting`
skill for deeper triage.

## Hard rules

- Never modify a project without an existing CometChat integration.
- Always query the docs MCP for SDK reference (do not invent function names).
- For component-swap features, always use `cometchat apply-feature <id>` —
  the CLI is the source of truth, never hand-edit.
- For package-install features (calls), the user opting in IS consent —
  run `npm install <package>` directly.
- For dashboard-toggle features, walk the user through the dashboard
  activation steps from `cometchat features info <id>` — the dashboard
  flip is something only the human can do.
- For dashboard-toggle features, always give the canonical path:
  **app.cometchat.com → select app → Chat & Messaging → Features →
  toggle ON.** Query the docs MCP for per-feature config details
  (e.g. Giphy API key, Translation language settings).
- Always use `npx @cometchat/skills-cli@latest`.

## Sources

- [Core features](https://www.cometchat.com/docs/ui-kit/react/core-features)
- [Extensions](https://www.cometchat.com/docs/ui-kit/react/extensions)
- [AI features](https://www.cometchat.com/docs/ui-kit/react/ai-features)
- [Call features](https://www.cometchat.com/docs/ui-kit/react/call-features)
