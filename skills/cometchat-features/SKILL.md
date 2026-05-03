---
name: cometchat-features
description: Add features (calls, reactions, polls, file sharing, presence, etc.) to an already-integrated CometChat project. Routes to the right sub-flow based on feature type — default (already enabled), extension (API toggle), ai-feature (API toggle + OpenAI key), dashboard-only (third-party config), package-install (calls), or component-swap (rich text).
license: "MIT"
compatibility: "Node.js >=18; @cometchat/chat-uikit-react ^6; integration must already be applied"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat features extensions calls reactions polls ai-features"
---

> **Companion skills:** `cometchat-core` covers initialization and the
> provider pattern; `cometchat-customization` is the next step when a
> feature is enabled but needs visual customization;
> `cometchat-troubleshooting` handles post-feature-enable failures.

## Purpose

This skill teaches Claude how CometChat features are structured and
what work is actually required to enable each one. Most features require
**zero code** — they are either already built into the UI Kit, toggled
via the `cometchat apply-feature` CLI (which hits the dashboard API),
or activated by a single npm install. Understanding which type a feature
is prevents unnecessary work.

---

## 1. Use this skill when

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

## 2. Preconditions

The user must have an existing integration:

```bash
npx @cometchat/skills-cli info --json
```

If `integrated` is `false`, **stop** and tell the user to run `/cometchat`
first to create the integration.

## 3. Why features fall into each type

CometChat features split into six types based on what work is actually
needed to enable each one:

- **default (compiled-in):** Shipped inside the UI Kit component bundle
  unconditionally. CometChat builds reactions, typing indicators,
  mentions, etc. into `CometChatMessageList` and `CometChatMessageComposer`
  at compile time. The feature is always present; the only question is
  whether the prop that surfaces it is enabled. No action needed.

- **extension (backend boolean toggle):** Pure on/off backend extension.
  The CLI's `apply-feature` command flips the toggle via the same REST
  API the dashboard UI uses (`POST /apps/{id}/extensions`), so no
  browser visit required. Once enabled, the UI Kit renders the matching
  UI automatically. Examples: polls, link-preview, voice-transcription,
  message-translation, stickers.

- **ai-feature (backend AI toggle + OpenAI key):** Same API path as
  extensions but split out because the AI feature requires an OpenAI
  API key on the app's AI settings (`PUT /apps/{id}/ai/settings`)
  before the toggle (`POST /apps/{id}/features/ai.{key}/enabled`)
  succeeds. The CLI handles both calls in one invocation when given
  `--openai-key sk-…`. Examples: smart-replies, conversation-summary,
  conversation-starter.

- **dashboard-only (third-party config):** Requires entering config
  the user has to fetch themselves — third-party API keys (Giphy,
  Stipop, Tenor), webhooks (Chatwoot), or multi-field choices
  (disappearing-messages interval, message-shortcuts list). The CLI
  cannot automate these; the skill prints the dashboard path and
  stops.

- **package-install (separate SDK):** Voice/video calling requires
  `@cometchat/calls-sdk-javascript` because it links against browser
  media APIs that would bloat every integration if bundled unconditionally.
  Once installed, the UI Kit detects it via dynamic import.

- **component-swap (variant component):** Replaces one UI Kit component
  with a drop-in variant whose default behavior differs (e.g.
  `CometChatCompactMessageComposer` enables rich text by default).
  The CLI does a safe word-boundary replace in `state.files_owned`.
  Requires `cometchat apply` to have run (i.e. web/RN integrations
  only — native cohorts can't use this path).

---

## 4. The feature catalog

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

### Type 2a — Extensions (pure boolean, CLI-toggleable)

These are backend extensions enabled by a single API call (`POST /apps/{id}/extensions`).
Use the CLI — no browser visit required:

```bash
cometchat apply-feature <id>
```

For native cohorts (iOS / Android / Flutter / Angular) where there's no
`.cometchat/state.json`, pass `--app-id` explicitly:

```bash
cometchat apply-feature <id> --app-id <your-app-id>
```

Once enabled, the UI Kit auto-integrates them. **No code changes needed.**

> **Note:** Conversation and Advanced Search has its own toggle on the
> Features page. It is on by default but can be disabled. If a user
> reports that search is missing, check this toggle.

**Extensions — User Experience:**
Avatar, Bitly, Link Preview, Message Shortcuts, Pin Message, Rich
Media Preview, Save Message, Thumbnail Generation, TinyURL, Voice
Transcription

**Extensions — User Engagement:**
Broadcast, Giphy, Gfycat, Message Translation, Polls, Reminders,
Stickers, Stipop, Tenor

**Extensions — Collaboration:**
Collaborative Document, Collaborative Whiteboard

**Extensions — Security:**
Disappearing Messages, E2E Encryption (Enterprise plan only)

**Extensions — Moderation** (on the separate Extensions page, not Features):
Data Masking, Image Moderation, Profanity Filter, Sentiment Analysis,
XSS Filter, Human Moderation, Report User, Slow Mode,
Virus/Malware Scanner

**Extensions — Notifications** (on the separate Extensions page):
Email Notification, Push Notification, SMS Notification

**Extensions — Customer Support:**
Chatwoot, Intercom

### Type 2b — AI features (CLI-toggleable, OpenAI key required)

`smart-replies`, `conversation-summary`, `conversation-starter`. These
need an OpenAI API key on the app's AI settings before the toggle
succeeds. The CLI does both calls in one invocation:

```bash
cometchat apply-feature smart-replies --openai-key sk-...
# native:
cometchat apply-feature smart-replies --app-id <id> --openai-key sk-...
```

After the first AI feature is enabled the key is stored on the app, so
subsequent ai-feature applies don't need `--openai-key` repeated.

Get an OpenAI key: https://platform.openai.com/api-keys

### Type 2c — Dashboard-only (third-party config required)

These extensions require config the user has to provide themselves
(third-party API keys / webhooks / multi-field setup) — `apply-feature`
returns `manual-action-required` and prints the dashboard path. The
CLI cannot automate these:

- **Third-party API keys:** Giphy, Stipop, Tenor, Intercom
- **Webhooks:** Chatwoot
- **Multi-field config:** Message Shortcuts (shortcut list), Disappearing Messages (interval)

Manual flow for these:
1. https://app.cometchat.com → select your app
2. Sidebar → Extensions (or Chat & Messaging → Features for
   Disappearing Messages)
3. Find the extension, enter the third-party config, toggle ON

### Moderation and Notification extensions

Live on a separate Extensions page (not Features). Both currently
require dashboard navigation (Phase 1 didn't cover moderation rules):

- **Moderation:** Data Masking, Image Moderation, Profanity Filter,
  Sentiment Analysis, XSS Filter, Human Moderation, Report User,
  Slow Mode, Virus/Malware Scanner
- **Notifications:** Email, Push, SMS

> Sidebar → **Extensions** → find extension → configure + enable.

After enabling any feature, run `cometchat verify` to ensure the
existing integration still passes. No code changes are needed — the
UI Kit picks up enabled features automatically.

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
npx @cometchat/skills-cli verify --json
```

The UI Kit's `initiateAfterLogin()` auto-calls `enableCalling()` after the
package is installed. No manual wiring needed for default call buttons in
CometChatMessageHeader. Restart the dev server.

### Type 4 — Component-swap features (drop-in variant)

Some features require swapping one component for a variant that has
different default behavior. The CLI handles the swap automatically —
it walks `state.files_owned`, performs a word-boundary regex replace,
updates `state.json` checksums, and records the applied feature so
re-runs are no-ops. Idempotent.

Currently available:

- `rich-text-formatting` — swaps `CometChatMessageComposer` →
  `CometChatCompactMessageComposer` (the compact variant enables rich
  text formatting by default; the regular composer has
  `enableRichTextEditor=false` baked in)

```bash
npx @cometchat/skills-cli apply-feature rich-text-formatting
```

Do NOT hand-edit the swap. The CLI is the source of truth. If future
SDK releases add new variant components, they will follow this same
`apply-feature <id>` pattern.

---

## 4b. Deep patterns for three most-requested features

For calls, AI smart replies, and presence, the catalog above only says "install a package" or "toggle in dashboard." Here are the concrete compositional patterns so common requests don't require a docs MCP round-trip.

### Calls (audio + video)

After `npm install @cometchat/calls-sdk-javascript`, call buttons auto-appear in `CometChatMessageHeader` and the call UI renders in place. **No manual wiring needed** for basic 1:1 audio/video calls.

For custom integration — e.g. putting a "Start video call" button outside the message header, or handling an incoming call notification in a custom way — use `CometChatCallButtons` + `CometChatIncomingCall` + `CometChatOngoingCall`:

```tsx
import { useState, useEffect } from "react";
import {
  CometChatCallButtons,
  CometChatIncomingCall,
  CometChatOngoingCall,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";

export function CustomCallUI({ targetUser }: { targetUser: CometChat.User }) {
  const [ongoingCall, setOngoingCall] = useState<CometChat.Call>();

  useEffect(() => {
    // Listen for call state changes
    const listenerId = "custom-call-listener";
    CometChat.addCallListener(
      listenerId,
      new CometChat.CallListener({
        onOutgoingCallAccepted: (call: CometChat.Call) => setOngoingCall(call),
        onIncomingCallCancelled: () => setOngoingCall(undefined),
        onCallEnded: () => setOngoingCall(undefined),
      }),
    );
    return () => CometChat.removeCallListener(listenerId);
  }, []);

  return (
    <>
      <CometChatCallButtons user={targetUser} />
      <CometChatIncomingCall />
      {ongoingCall && <CometChatOngoingCall call={ongoingCall} />}
    </>
  );
}
```

**Common gotchas:**
- Calls require a logged-in CometChat user on *both* sides. Test from two browsers (or incognito) logged in as different UIDs.
- `CometChatIncomingCall` must be mounted globally (e.g. in your provider or layout) so incoming calls ring on every page.
- Group calls use `CometChat.Group` instead of `CometChat.User` on `CometChatCallButtons`.

### AI smart replies

Smart replies is an `ai-feature`. Enable with one CLI call (the first time also sets the OpenAI key on the app):

```bash
cometchat apply-feature smart-replies --openai-key sk-...
# native cohorts: add --app-id <your-app-id>
```

**No code changes are required** — the `CometChatMessageComposer` automatically renders suggested replies as chips above the input when there's a recent incoming message.

For a custom UI — e.g. showing smart replies inline instead of above the composer, or only for certain conversation types — you read the extension data from the incoming message and render your own chips:

```tsx
function SmartReplyChips({ message }: { message: CometChat.BaseMessage }) {
  const metadata = message.getMetadata() as Record<string, unknown> | undefined;
  const extensions = (metadata?.["@injected"] as Record<string, unknown>)?.["extensions"] as
    | Record<string, unknown>
    | undefined;
  const smartReply = extensions?.["smart-reply"] as { reply_positive?: string; reply_neutral?: string; reply_negative?: string } | undefined;

  if (!smartReply) return null;

  const replies = [smartReply.reply_positive, smartReply.reply_neutral, smartReply.reply_negative].filter(Boolean) as string[];
  return (
    <div style={{ display: "flex", gap: 8, padding: 8 }}>
      {replies.map((r) => (
        <button key={r} onClick={() => sendTextMessage(r)}>{r}</button>
      ))}
    </div>
  );
}
```

Smart replies are server-generated and attached to messages via the `@injected.extensions.smart-reply` metadata path — the AI feature runs on CometChat's backend, not in your code.

### Presence (online / offline status)

Presence is a **default feature** (Type 1) — online status indicators appear automatically on user avatars in `CometChatConversations`, `CometChatUsers`, and `CometChatGroupMembers`. Nothing to install, nothing to enable.

For custom UI that needs to know a specific user's online state — e.g. a "Sold by Aria Chen · online now" label on a product page — subscribe to user events:

```tsx
import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";

export function useUserPresence(uid: string): "online" | "offline" | "unknown" {
  const [status, setStatus] = useState<"online" | "offline" | "unknown">("unknown");

  useEffect(() => {
    // 1. Fetch initial state
    CometChat.getUser(uid).then((u) => {
      setStatus(u.getStatus() === "online" ? "online" : "offline");
    });

    // 2. Subscribe to live changes
    const listenerId = `presence-${uid}`;
    CometChat.addUserListener(
      listenerId,
      new CometChat.UserListener({
        onUserOnline: (user: CometChat.User) => {
          if (user.getUid() === uid) setStatus("online");
        },
        onUserOffline: (user: CometChat.User) => {
          if (user.getUid() === uid) setStatus("offline");
        },
      }),
    );
    return () => CometChat.removeUserListener(listenerId);
  }, [uid]);

  return status;
}
```

**Common gotchas:**
- Presence events only fire for users the current user has interacted with (conversation exists, in same group, etc.). For arbitrary UIDs with no prior interaction, you may need to call `CometChat.getUser(uid)` periodically instead.
- `getStatus()` returns `"online"` or `"offline"` — also check `getLastActiveAt()` for a "last seen X ago" timestamp.
- "Last seen" is disabled by default on free-tier apps. Enable it in the dashboard (Settings → Chat → Last Seen).

---

## 5. Docs MCP contract

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
3. **Use `cometchat apply-feature <id>` for extension and ai-feature
   types.** The CLI is the canonical path. Only fall back to the
   dashboard URL when the CLI returns `manual-action-required`,
   `auth-required`, or `error`.
4. **Canonical reference URLs** (use as starting points if the agent
   doesn't have an MCP query handy):
   - Extensions: https://www.cometchat.com/docs/ui-kit/react/extensions
   - AI features: https://www.cometchat.com/docs/ui-kit/react/ai-features
   - Calls: https://www.cometchat.com/docs/ui-kit/react/call-features
   - Core features: https://www.cometchat.com/docs/ui-kit/react/core-features

---

## 6. Steps

### Step 1 — Read state

```bash
npx @cometchat/skills-cli info --json
```

If not integrated, stop. Otherwise note the framework + experience so you
can find the right files.

### Step 2 — Determine feature

If the user named a feature, use it. Otherwise list the categories above
and ask which feature they want.

### Step 3 — Classify the feature

Match the feature name against the 4 types in section 4. If you don't know
the type, query the docs MCP first.

### Step 4 — Execute the right sub-flow

- **Default:** show the user it's already there. Point at the component.
  Use `npx @cometchat/skills-cli features info <id>` to surface
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
- **Extension / AI feature:** run `cometchat apply-feature <id>`. The
  CLI hits the dashboard API directly using the bearer token from
  `cometchat auth login` (stored in the OS keychain). For native
  cohorts (iOS / Android / Flutter / Angular), pass `--app-id <id>`
  explicitly because there's no `.cometchat/state.json`. AI features
  also take `--openai-key sk-…` the first time:

  ```bash
  # Web/RN (state.json present):
  cometchat apply-feature polls
  cometchat apply-feature smart-replies --openai-key sk-...

  # Native (stateless):
  cometchat apply-feature polls --app-id A1B2C3
  cometchat apply-feature smart-replies --app-id A1B2C3 --openai-key sk-...
  ```

  Response shapes (`--json`):
  - `"status": "applied"` → done. Tell the user to hard-refresh
    (Cmd+Shift+R) the browser tab running their dev server.
  - `"status": "already-applied"` → the feature is already enabled
    in this integration's `state.applied_features`.
  - `"status": "auth-required"` → run `cometchat auth login` first.
  - `"status": "openai-key-required"` (ai-feature only) → re-run
    with `--openai-key sk-…`.
  - `"status": "error"` → surface `next_steps` verbatim.

  **Only fall back to the dashboard** when the CLI returns `error` or
  isn't available. Manual flow for extensions: app.cometchat.com →
  *Chat & Messaging → Features → flip Status toggle*.

  **Note:** if the feature has `auto_wired_in_uikit: false` in the
  catalog (most non-default extensions), the toggle alone isn't
  enough — you also need to register the extension via
  `UIKitSettingsBuilder.setExtensions([...])` before `init`. Query
  the docs MCP for the exact builder syntax.

- **Dashboard-only:** the CLI returns `manual-action-required` and
  prints the dashboard path. These need third-party config (Giphy
  API key, Chatwoot webhook, etc.) that only the user can supply.
  Walk them through the dashboard.

- **Package-install (calls):** run `npm install @cometchat/calls-sdk-javascript`
  directly. The user opted in, that IS consent.

- **Component-swap:** run `cometchat apply-feature <id>` (web/RN
  only — needs `state.json`). The CLI handles the swap
  deterministically. Do NOT hand-edit.

### Step 5 — Verify

```bash
npx @cometchat/skills-cli verify --json
```

Surface any failed checks verbatim. If anything looks off after enabling
a feature (drift, unexpected build error, env warning), run
`cometchat doctor` for combined drift + env + AST diagnostics with
per-issue fix instructions, or route to the `cometchat-troubleshooting`
skill for deeper triage.

## Hard rules

- Never modify a project without an existing CometChat integration.
- Always query the docs MCP for SDK reference (do not invent function names).
- For component-swap, extension, and ai-feature types, always use
  `cometchat apply-feature <id>` — the CLI is the source of truth,
  never hand-edit and never tell the user to navigate the dashboard
  unless the CLI itself returns `manual-action-required`.
- For ai-feature types, the OpenAI key prerequisite is the only
  manual input — pass it as `--openai-key sk-…` the first time per
  app.
- For native cohorts (iOS / Android / Flutter / Angular), always
  pass `--app-id <id>` because their projects don't write
  `.cometchat/state.json`.
- For package-install features (calls), the user opting in IS consent —
  run `npm install <package>` directly.
- For dashboard-only features (third-party API keys, webhooks,
  multi-field config), walk the user through the dashboard — these
  cannot be automated.
- Always use `npx @cometchat/skills-cli`.

## Sources

- [Core features](https://www.cometchat.com/docs/ui-kit/react/core-features)
- [Extensions](https://www.cometchat.com/docs/ui-kit/react/extensions)
- [AI features](https://www.cometchat.com/docs/ui-kit/react/ai-features)
- [Call features](https://www.cometchat.com/docs/ui-kit/react/call-features)
