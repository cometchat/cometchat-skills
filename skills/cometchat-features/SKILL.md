---
name: cometchat-features
description: Add features (calls, reactions, polls, file sharing, presence, etc.) to an already-integrated CometChat project. Routes to the right sub-flow based on feature type — default (already enabled), extension (API toggle), ai-feature (API toggle + OpenAI key), dashboard-only (third-party config), package-install (calls), or component-swap (rich text).
license: "MIT"
compatibility: "Node.js >=18; @cometchat/chat-uikit-react ^6; integration must already be applied"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat features extensions calls reactions polls ai-features"
---

> **Ground truth:** the 5-tier feature catalog `packages/registry/v6/features/catalog.json` + the per-platform UI Kit `defaultExtensions[]`. (Official docs linked below.) Verify symbols against the installed package/source before relying on them.

> **Scope — this IS the web / React features skill** (`@cometchat/chat-uikit-react`). Web/React intentionally has no separate "react-features" skill: this one is it. Each other family has its own features skill (native / angular / android-v5 / android-v6 / ios / flutter-v6). **Flutter V5 has none — it proxies to `cometchat-flutter-v6-features`** for enablement: feature *enablement* is the SDK/dashboard `apply-feature` path (identical across V5/V6); only the in-UI wiring differs, and V5 is legacy/maintenance-only. The `apply-feature` CLI + the 5-tier taxonomy below apply to all families.

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

- `/cometchat features` (or invoke the cometchat-features skill via your agent's mechanism — keyword "cometchat feature" or "add chat feature" works in most agents)
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

## 3. The 5 feature categories (customer-facing) — and what work each needs

CometChat's canonical "Feature Availability" model sorts every feature into **5 categories by the work needed** (the catalog encodes this per-feature as `tier` + the operative columns `code` / `dashboard_settings` / `builder`; run `cometchat features info <id> --json`).

> **Canonical public decision-reference (source of truth):** [Features & Extensions Guide](https://www.cometchat.com/docs/fundamentals/features-and-extensions-guide) on the public docs. It is the authoritative, always-current matrix of *which integration method supports each feature* (UI Kit / UI Kit Builder / Widget Builder / SDK), *what dashboard setup it needs*, and *whether code is required*. **When the local `catalog.json` and this page disagree, the docs page wins** — the catalog is a build-time snapshot derived from the same model and can lag a release. For any "can the builder do X? / is feature Y code-or-dashboard?" decision, consult this page (WebFetch it, or query the docs MCP) rather than answering from memory or a stale snapshot.



| Tier | Category | Work needed | Example |
|---|---|---|---|
| **1** | Core Messaging (Zero Setup) | Nothing — renders out of the box | Typing Indicators |
| **2** | Builder-Enabled (Config + UI Toggle) | Enable via Dashboard API; toggle/place in the UI Kit Builder | Polls |
| **3** | Config-Only (Dashboard-Driven) | Enable via Dashboard API; works automatically | Link Preview |
| **4** | Config + Settings (Smart) | Dashboard API + extra settings (API keys, thresholds) — no code | Smart Replies |
| **5** | SDK-Integrated (Config + Code) | Dashboard API + **custom client code** | Bitly |

Tiers 1–4 need **no client code** (`code: "none"`). **Tier 5 needs code — and the implementation already lives in the docs.** When a feature's `code` is `custom-code` or `steps-in-docs` (i.e. `auto_wired_in_uikit: false`), the flow is: flip the dashboard toggle (`apply-feature <id>`), then **fetch the reference implementation from the docs (`docs_topic`, via the docs MCP) and adapt it — do NOT hand-roll.** A few Core features carry `code: "stitch-components"` (e.g. Threaded Conversations, Advanced Search): no extension, but you **compose existing kit components** — the kit sample apps show the wiring (see [[uikit-local-clones-canonical-source]]). The 14 code-needed extensions: bitly, message-shortcuts, pin-message, rich-media-preview, save-message, tinyurl, voice-transcription, giphy, reminders, stipop, tenor, disappearing-messages, chatwoot, intercom.

> T2 vs T3 is a Builder-surface nuance (does the Builder expose a placement/toggle for it). Operationally both are "enable via Dashboard, no code" — the `builder: "toggle"` flag marks the ones the Builder surfaces.

---

## 3b. Enablement mechanism (how the CLI flips each on)

Independently of the 5 customer-facing tiers above, the catalog tags each feature with an **enablement mechanism** — what the CLI's `apply-feature` actually does:

- **default (compiled-in):** Shipped inside the UI Kit component bundle
  unconditionally. CometChat builds reactions, typing indicators,
  mentions, etc. into `CometChatMessageList` and `CometChatMessageComposer`
  at compile time. The feature is always present; the only question is
  whether the prop that surfaces it is enabled. No action needed.

- **extension (backend boolean toggle):** Pure on/off backend extension.
  The CLI's `apply-feature` command flips the toggle via the same REST
  API the dashboard UI uses (`POST /apps/{id}/extensions`), so no
  browser visit required. Once enabled, the UI Kit renders the matching
  UI automatically **only for the auto-wired subset** (`auto_wired_in_uikit: true`,
  `code: "none"`); the rest (tier 5) need client code from the docs. Examples: polls, link-preview,
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

Once enabled, the UI Kit auto-integrates them. **No code changes needed — for the auto-wired subset.**

> ⚠️ **The "no code needed" pitch only holds for ~7 of 24 dashboard-toggle features (ENG-35721).** The dashboard exposes 24 extensions; only the ones marked `auto_wired_in_uikit: true` in the CLI's catalog (~7 — Link Preview, Polls, Stickers, Message Translation, Smart Replies, Conversation Starter, and a handful more) render automatically via the kit's bubbles + composer. The other ~17 (Bitly, TinyURL, Voice Transcription, Reminders, Save Message, Pin Message, etc.) require **either a kit prop opt-in OR a small component-side handler** — `apply-feature <id>` flips the dashboard toggle but does NOT wire client-side rendering for those. **Before promising "no code needed" to the customer**, run `cometchat features info <id> --json` and check the `auto_wired_in_uikit` field; if `false`, set expectations honestly and emit the wiring code.

> ⚠️ **`features enable` has TWO unstated prereqs (ENG-35721):**
> 1. **`auth login` must have completed** — the toggle is gated on the dashboard bearer token. The CLI's "no app" error says nothing about login; running `cometchat features enable <id>` cold (after only `provision setup`) fails with a misleading message. Run `cometchat auth status --json` first; if `"logged-out"`, run `cometchat auth login` before any `features enable`.
> 2. **Either `.cometchat/config.json` OR `--app-id <id>`** — the toggle needs an app context. If the user pasted credentials manually (the dispatcher's Step 2d path) they may NOT have a `.cometchat/config.json` yet. **Manual `.env` users:** run `cometchat config save --app-id <id> --region <region> --json` to bridge into `.cometchat/config.json` before `apply-feature`, OR pass `--app-id` on every `apply-feature` call.

> **Note:** Conversation and Advanced Search has its own toggle on the
> Features page. It is on by default but can be disabled. If a user
> reports that search is missing, check this toggle.

**Extensions — User Experience:**
Avatar, Bitly, Link Preview, Message Shortcuts, Pin Message, Rich
Media Preview, Save Message, Thumbnail Generation, TinyURL, Voice
Transcription

**Extensions — User Engagement:**
Giphy, Message Translation, Polls, Reminders,
Stickers, Stipop, Tenor

> ⚠️ **Broadcast was removed (ENG-35699).** Earlier versions of this skill listed "Broadcast" here, but the CLI's 40-feature catalog has no `broadcast` or `broadcast-message` id — `cometchat-skills-cli features info broadcast` returns "not found." Broadcast as a *use case* is achievable via standard CometChat extensions (one-to-many group messages with `subscribePresenceForAllUsers`) or via Custom Messages — but there is no "Broadcast" extension toggle in the dashboard today. If a customer asks for broadcast functionality, route them at custom messages + a server-side fan-out webhook, not a feature toggle.

**Extensions — Collaboration:**
Collaborative Document, Collaborative Whiteboard

**Extensions — Security:**
Disappearing Messages, E2E Encryption (Enterprise plan only)

**Extensions — Moderation (LEGACY — prefer Rules Management, see §"Moderation" below):**
Data Masking, Image Moderation, Profanity Filter, Sentiment Analysis,
XSS Filter, Human Moderation, Report User, Slow Mode,
Virus/Malware Scanner. ⚠️ Deprecated; don't run alongside moderation Rules (double-processes every message).

**Notifications extensions** (Chat & Messaging → Features):
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
2. Sidebar → Chat & Messaging → Features
3. Find the extension, enter the third-party config, toggle ON

### Moderation — use Rules Management (NOT the legacy extensions)

**The canonical moderation system is Rules Management**, not the old per-extension
toggles. Configure rules once in the Dashboard (**Moderation → Settings → Rules**,
or the `/moderation/rules` REST API — also `/moderation/{keywords,reasons,
blocked-messages,flagged-messages,reviewed-messages}`) and they auto-apply to every
message with **no client code** (the UI Kit + SDK enforce them seamlessly). Docs:
`moderation/overview` + `moderation/rules-management`.

> ⚠️ **Do NOT run legacy moderation extensions AND Rules on the same app.** The
> legacy extensions (Data Masking, Image Moderation, Profanity Filter, Sentiment
> Analysis, XSS Filter, Slow Mode, Virus/Malware Scanner) are **deprecated**. If
> both a legacy extension and a Rule are active, **every message is processed
> twice** → delays + perf issues. Disable the legacy extensions (Dashboard →
> Extensions) before creating Rules. `apply-feature <legacy-id>` still works but
> emits this same warning — prefer Rules.

- **Notifications** (separate, unaffected): Email, Push, SMS — Sidebar →
  **Extensions** → configure + enable.

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

### Type 5 — Custom message types (APPEND, never REPLACE — ENG-35706)

When a customer wants to send a new message type (location, product card, custom event), the V6 React kit ships a templates API that is **dangerously easy to misuse.** Two testers hit the same trap: they added one custom template and watched ALL existing bubbles (text, image, audio, video, file) disappear AND the composer's entire attachment menu (Camera/Image/Video/File/Whiteboard/Document) get replaced by their one new attachment.

**Cause:** `<CometChatMessageList templates={[locationTemplate]} />` and `<CometChatMessageComposer attachmentOptions={[locationOption]} />` **REPLACE** the kit's built-in templates / options rather than appending to them.

**Correct pattern — always merge with the kit's defaults:**

```tsx
import {
  CometChatMessageList,
  CometChatMessageComposer,
  CometChatMessageTemplate,        // the kit's template class — verified export (src/index.ts:79)
  CometChatMessageComposerAction,  // attachment-menu action class
  CometChatUIKit,                  // exposes getDataSource()
  CometChatUIKitConstants,         // MessageTypes / MessageCategory enums
} from "@cometchat/chat-uikit-react";

// 1. Build your custom template with the kit's CometChatMessageTemplate class.
//    ⚠️ It is `new CometChatMessageTemplate(...)` (UI Kit) — NOT
//    `new CometChat.MessageTemplate(...)`. The Chat SDK has no MessageTemplate
//    export; that form does not exist and will not compile.
const locationTemplate = new CometChatMessageTemplate({
  type: "location",
  category: CometChatUIKitConstants.MessageCategory.custom,   // "custom"
  contentView: (message, alignment) => <LocationBubble message={message} />,
  // headerView / footerView / bottomView / bubbleView / statusInfoView / options
  // all inherit the kit's defaults when omitted.
});

// 2. Merge with the kit's defaults — DO NOT pass only your template.
//    CometChatUIKit.getDataSource() is the public accessor; it returns the same
//    DataSource as ChatConfigurator.getDataSource() (the latter is internal).
const defaultTemplates = CometChatUIKit.getDataSource().getAllMessageTemplates();
const mergedTemplates = [...defaultTemplates, locationTemplate];

<CometChatMessageList templates={mergedTemplates} />
```

**Same rule for attachment options.** `getAttachmentOptions` takes a `ComposerId` (`{ user?, group?, parentMessageId? }`) **AND a required second argument** (`additionalConfigurations`), then append your action:

```tsx
// ComposerId = { parentMessageId, user, group } — all three keys, values nullable.
const composerId = {
  parentMessageId: null,
  user: selectedUser?.getUid() ?? null,
  group: selectedGroup?.getGuid() ?? null,
};
// ⚠️ MUST pass a defined object as the 2nd arg. The extension data sources
// (Polls, Collaborative Document/Whiteboard) read `messageToReplyRef` off it
// WITHOUT optional chaining — passing nothing/undefined throws at runtime:
//   "Cannot read properties of undefined (reading 'messageToReplyRef')"
// (Verified against the official v6 sample app's live-location feature.)
const additionalConfigurations = { messageToReplyRef: { current: null } };
const defaultAttachments = CometChatUIKit.getDataSource().getAttachmentOptions(
  composerId,
  additionalConfigurations,
);
const mergedAttachments = [...defaultAttachments, new CometChatMessageComposerAction({
  id: "send-location",
  title: "Location",
  iconURL: "/icons/location.svg",
  onClick: () => { /* open location picker */ },
})];

<CometChatMessageComposer attachmentOptions={mergedAttachments} />
```

**Also**: when sending the custom message, set both `receiverType` AND `type` correctly. Two testers hit `"Cannot determine message recipient"` because they passed a partial `CustomMessage` constructor. Use the full form:

```tsx
const msg = new CometChat.CustomMessage(
  receiverID,                          // who to send to (required)
  receiverType,                        // CometChat.RECEIVER_TYPE.USER or .GROUP (required — this is the field testers missed)
  "location",                          // custom type identifier
  { lat, lng, label }                  // your payload
);
CometChat.sendCustomMessage(msg);
```

> **Custom type sends + renders live, but vanishes on reload?** The custom message
> appears immediately (the `ccMessageSent` event), but to **fetch it from history**
> you must include your custom category + type in the list's `messagesRequestBuilder`.
> Extend the kit's defaults (don't hand-list them) — append to
> `getAllMessageCategories()` + `getAllMessageTypes()`:
>
> ```tsx
> const categories = CometChatUIKit.getDataSource().getAllMessageCategories();
> if (!categories.includes(CometChatUIKitConstants.MessageCategory.custom))
>   categories.push(CometChatUIKitConstants.MessageCategory.custom);
> const types = CometChatUIKit.getDataSource().getAllMessageTypes();
> if (!types.includes("location")) types.push("location");
>
> const messagesRequestBuilder = new CometChat.MessagesRequestBuilder()
>   .setCategories(categories).setTypes(types).hideReplies(true).setLimit(30);
>
> <CometChatMessageList templates={mergedTemplates} messagesRequestBuilder={messagesRequestBuilder} />
> ```
> (Verified against the official v6 sample app's live-location feature.) Tip: on the
> `CustomMessage`, call `setConversationText("Live Location")` so it reads nicely as
> the conversation-list preview, and `setSender(loggedInUser)` for optimistic render.

#### Override an existing message type's bubble (text / image / etc.)

Same templates API — fetch all, replace `contentView` (or `bubbleView` for the whole bubble) on the matching template, pass the array. There is NO separate "override" call; you reuse `getAllMessageTemplates()`:

```tsx
const templates = CometChatUIKit.getDataSource().getAllMessageTemplates();
const withCustomTextBubble = templates.map((t) => {
  if (
    t.type === CometChatUIKitConstants.MessageTypes.text &&
    t.category === CometChatUIKitConstants.MessageCategory.message
  ) {
    t.contentView = (message, alignment) => <MyTextBubble message={message} />;
    // or t.bubbleView = (...) => <... />  to replace the ENTIRE bubble (header+content+footer)
  }
  return t;
});

<CometChatMessageList templates={withCustomTextBubble} />
```

(`CometChatUIKit.getDataSource().getMessageTemplate(type, category)` returns a single template if you'd rather fetch just one — but you still pass the full array to the `templates` prop.)

#### Add a custom message option (Forward-style long-press action)

Message options live on each template's `options` function. Override it and **merge with the kit defaults** (same REPLACE-vs-APPEND rule) via `getMessageOptions`. Custom actions use `CometChatActionsIcon` (NOT `CometChatMessageComposerAction` — that's composer-only):

```tsx
import { CometChatActionsIcon } from "@cometchat/chat-uikit-react";

const templates = CometChatUIKit.getDataSource().getAllMessageTemplates();
const withForward = templates.map((t) => {
  if (t.type === CometChatUIKitConstants.MessageTypes.text) {
    t.options = (loggedInUser, message, group) => {
      // getMessageOptions(loggedInUser, messageObject, group?, additionalParams?)
      const options = CometChatUIKit.getDataSource().getMessageOptions(loggedInUser, message, group);
      options.push(
        new CometChatActionsIcon({
          id: "forward",
          title: "Forward",
          iconURL: "/icons/forward.svg",
          onClick: (id) => { /* open your forward-to picker → CometChat.sendMessage(...) */ },
        })
      );
      return options;
    };
  }
  return t;
});

<CometChatMessageList templates={withForward} />
```

"Forward" is not a built-in kit option, so it's added as a custom `CometChatActionsIcon`. The built-ins (reply, edit, delete, react, …) come from `getMessageOptions` — keep them by merging, don't return only your action.

> ⚠️ **Kit-side limitation (ENG-35706):** custom message send sometimes **replaces** an existing message in the list in real-time (UI-side overwrite, not server-side). No client workaround today; file a kit ticket if you observe this and document for the customer.

#### Text formatters (inline text styling — mentions, URLs, custom @/#/! tokens)

Text formatters transform message text inline. The kit ships `CometChatMentionsFormatter`, `CometChatUrlsFormatter`, `CometChatMarkdownFormatter` (all subclasses of the base `CometChatTextFormatter`). **Same APPEND-not-REPLACE rule** as templates/options: passing a bare `textFormatters={[...]}` array drops the built-ins — start from `getAllTextFormatters({})` and append. (Pattern verified against the kit sample app `sample-app/src/components/CometChatMessages/CometChatMessages.tsx`.)

```tsx
import {
  CometChatUIKit,
  CometChatMessageList,
  CometChatTextFormatter,
} from "@cometchat/chat-uikit-react";

// getAllTextFormatters({}) returns the kit defaults (mentions, URLs, …).
// START here and append — don't hand the component a bare array.
const formatters: CometChatTextFormatter[] =
  CometChatUIKit.getDataSource().getAllTextFormatters({});

// Append your own: subclass CometChatTextFormatter (override its regex + view
// hooks) and push it. See the per-pattern guides below for full subclasses.
// formatters.push(new MyHashtagFormatter());

<CometChatMessageList textFormatters={formatters} />;
```

> **Guides (canonical subclass examples):** custom-text-formatter-guide, mentions-formatter-guide, url-formatter-guide, shortcut-formatter-guide — all under `ui-kit/react/` (query the docs MCP, or `documentation/docs/ui-kit/react/*-formatter-guide.mdx` locally). Each shows a complete `CometChatTextFormatter` subclass (regex + `getFormattedText` + a custom view).

### Type 6 — Dashboard-AI mode (UI-side side-effects — ENG-35706)

When the customer enables the AI Agent on the dashboard (e.g. `aiAssistant: true` for an app), the SAME `<CometChatMessageList>` renders with thread reply buttons + call buttons that don't make sense in an AI-only conversation surface.

**Detect AI mode and branch the layout:**

```tsx
// Read app's AI config from the dashboard via the CLI
//   npx @cometchat/skills-cli features info ai-assistant --json
// → { enabled: true, models: [...], ... }

const isAiMode = aiAssistantConfig?.enabled === true;

<CometChatMessageList
  user={selectedUser}
  group={selectedGroup}
  // AI conversations shouldn't show "Reply in Thread" / "Message Privately" / call buttons
  hideReplyInThreadOption={true}
  // (call buttons live on CometChatMessageHeader, NOT MessageList — hide them there)
/>
<CometChatMessageHeader
  user={selectedUser}
  hideVideoCallButton={isAiMode}
  hideVoiceCallButton={isAiMode}
/>
```

The kit doesn't auto-detect dashboard AI mode and adjust its layout — that's a kit-side gap (filed as part of ENG-35706). Until the kit ships a built-in `aiMode` prop, the skill must read the dashboard flag via `features info ai-assistant --json` (see ENG-35716 dispatcher rule) and gate the relevant buttons.

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
        // CallListener uses onCallEndedMessageReceived (NOT onCallEnded — that's
        // an OngoingCallListener callback, passed to CallSettingsBuilder).
        onCallEndedMessageReceived: () => setOngoingCall(undefined),
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

**Common gotchas — UI Kit path:**
- Calls require a logged-in CometChat user on *both* sides. Test from two browsers (or incognito) logged in as different UIDs.
- `CometChatIncomingCall` must be mounted globally (e.g. in your provider or layout) so incoming calls ring on every page.
- Group calls use `CometChat.Group` instead of `CometChat.User` on `CometChatCallButtons`.

**Common gotchas — SDK-only path (no UI Kit components, ENG-35707 Birendra follow-up):**

When the integrator opts out of `<CometChatCallButtons>` / `<CometChatIncomingCall>` / `<CometChatOngoingCall>` and builds the call surface directly on the Calls SDK, the UI-Kit gotchas above don't apply but a different set kicks in:

- **`CometChat.CALL_TYPE.AUDIO` vs `.VIDEO` (Chat SDK)** are NOT the same as **`CometChatCalls.constants.TYPE.VOICE` / `.VIDEO` (Calls SDK)** — use Chat SDK enum on the `Call` entity, Calls SDK enum on `CallSettings`. See `cometchat-react-calls` §4c constants table.
- **`setIsAudioOnlyCall(true)` on `CallSettingsBuilder`** for voice calls — without it, voice calls still acquire the camera (just don't render it).
- **`joinSession` MUST fire after the container is mounted** — don't call it inside the `onOutgoingCallAccepted` listener directly; set state and let a `useEffect(phase, containerRef)` join when the ref + phase agree. The natural site fires before the in-call panel renders.
- **Group calls have no "ring a group" primitive** — use a CustomMessage broadcast + a shared sessionId; the UI Kit's `CometChatCallButtons` for groups sends a `meeting`-type CustomMessage, not `initiateCall`. SDK-only mirrors that.
- **Default call types** — 1:1 = video, group = voice (mirroring the kit's defaults). If you build custom buttons, replicate this so customers' integrations behave consistently.
- **`CometChatCalls.login` is mandatory on raw-SDK paths** (NOT when using the UI Kit, where `enableCalls = true` / kit-managed init auto-logs the Calls SDK). On raw SDK, after Chat SDK login, separately call `CometChatCalls.login(uid, apiKey)` — without it, `generateToken` returns 401.

These map to the React-specific recipes in `cometchat-react-calls` §4c. Same primitives apply across families; container-mount race + ref-state coordination is generic.

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

## 5. Docs lookup contract

For any feature question not in our local catalog (`cometchat features
info`), the canonical CometChat docs are the source of truth for:

- **Feature/method availability matrix** — [Features & Extensions Guide](https://www.cometchat.com/docs/fundamentals/features-and-extensions-guide): which of UI Kit / UI Kit Builder / Widget Builder / SDK supports each feature, dashboard setup, and code-required flags. **This page outranks the local `catalog.json` snapshot when they disagree.**
- Per-feature SDK reference (props, callbacks, builders, events)
- Per-feature configuration details beyond the dashboard path above
- Feature compatibility notes (which features need backend setup,
  which auto-wire, which require explicit `setExtensions([...])`)

The docs MCP at `cometchat-docs` is the **best** way to query them when
available, but it is **not** a hard requirement.

**Hard rules:**

1. **Look up the docs before answering** any feature question that's not
   in our local catalog. Never invent feature config from training-data
   memory. Use whichever lookup path is available, in order:
   - **(a) docs MCP** — query the `cometchat-docs` MCP tool if your agent
     has it. Richest path.
   - **(b) install the MCP, if your agent supports it** — Claude Code:
     `claude mcp add --transport http cometchat-docs
     https://www.cometchat.com/docs/mcp`. Other agents (Cursor, Codex,
     Cline, …) configure MCP their own way, or not at all — do NOT block.
   - **(c) fetch/search the public docs** — same content at the canonical
     URLs below, or web-search `site:cometchat.com/docs`. Universal
     fallback; never STOP and dead-end the user when the MCP isn't
     installed — fall through to (c).
2. **Use `cometchat apply-feature <id>` for extension and ai-feature
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
    - "custom empty / error / loading state" → `emptyView`,
      `errorView`, `loadingView` on the list components (verified vs the v6
      React kit; the `*StateView` form is only on `CometChatNotificationFeed`)
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
