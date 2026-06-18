---
name: cometchat-angular-features
description: "Feature catalog for CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) — how to enable/configure calls, reactions, mentions, AI (smart replies / conversation starter / summary), polls, stickers, collaborative doc/whiteboard, message translation, link preview. Five-bucket taxonomy: auto-enabled / component-prop / dashboard-extension / AI-with-OpenAI-key / package-install (calls). Verified @Input names against the v5 .d.ts."
license: "MIT"
compatibility: "Angular >=17 <22; @cometchat/chat-uikit-angular ^5.0; @cometchat/calls-sdk-javascript ^5.0 (calls)"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular features calls reactions mentions ai polls stickers extensions v5"
---

## Purpose

Teaches Claude how to add features on top of a working CometChat **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`) integration. Each feature falls into exactly one of five categories; this skill gives the correct recipe for each and — critically — names the precise component `@Input` you flip, every one of which is **verified against the v5 component catalog / `.d.ts`**.

**Read `cometchat-angular-core` + `cometchat-angular-components` first** — a base v5 integration (standalone components, `UIKitSettingsBuilder` init, `login(uid)` bare string, CSS-variable theming) must already exist before features layer on. For the full voice/video call flow, read `cometchat-angular-calls`.

Ground truth: `@cometchat/chat-uikit-angular@5.0.2` source (component `@Input`/`@Output` declarations in `projects/cometchat-uikit/src/lib/components/**`) + `docs/ui-kit/angular`. **Never invent a component `@Input`** — every prop cited here is verified against the v5 component source.

---

## 1. Feature taxonomy

Every CometChat Angular v5 feature falls into exactly one of these five **mechanism** categories — they tell you *how* to wire each feature (the actionable Angular view), and map onto the product's canonical **5-tier "work-needed" model** (Core Zero-Setup → Builder-Enabled → Config-Only → Config+Settings → SDK-Integrated; see `cometchat-features` §3 + `packages/registry/v6/features/catalog.json`; canonical public matrix → [Features & Extensions Guide](https://www.cometchat.com/docs/fundamentals/features-and-extensions-guide), which outranks this snapshot on conflict): Auto-enabled ≈ Core; Component-prop ≈ Core/Config; Dashboard-extension ≈ Config-Only; AI-with-OpenAI-key ≈ Config+Settings; Package-install ≈ SDK-Integrated:

| Category | What it means | Example features | How to enable |
|---|---|---|---|
| **Auto-enabled** | Already on — shipped compiled into the kit's base components. The only question is whether a hide flag is turning it off. | Instant messaging, typing indicators, read receipts, **reactions**, replies, threads, media upload, edit/delete, message info, presence | Just render `<cometchat-message-header>` + `<cometchat-message-list>` + `<cometchat-message-composer>` |
| **Component-prop** | Present in the kit but surfaced via a component `@Input` you set. | **@mentions** (`textFormatters`), AI smart replies / conversation starters / summary (`@Input`s on message-list + message-header) | Set the verified `@Input` (§2, §4) |
| **Dashboard-extension** | Backend toggle enabled in the CometChat dashboard (or via the `cometchat apply-feature` CLI). The kit auto-renders the matching UI once enabled. | Polls, stickers, collaborative doc/whiteboard, message translation, link preview, thumbnail generation | `cometchat apply-feature <id> --app-id <X>` → hard-reload (§3) |
| **AI-with-OpenAI-key** | Dashboard AI toggle that also needs an OpenAI API key on the app, **then** a component `@Input` to surface it. | Smart replies, conversation starter, conversation summary | `cometchat apply-feature <id> --app-id <X> --openai-key sk-…` → set the message-list / header `@Input` (§4) |
| **Package-install (calls)** | Install the separate calls SDK + enable calling on the builder. The kit's call components then work. | Voice + video calls, call logs | `npm install @cometchat/calls-sdk-javascript@^5` + `.setCallingEnabled(true)` → see `cometchat-angular-calls` (§5) |

> The `cometchat apply-feature <id>` CLI and the dashboard toggles are **not code symbols** — they configure the backend. The code-side work for dashboard-extension features is usually zero; for component-prop and AI features it's a single `@Input`.

---

## 2. Auto-enabled features (no work) + the two component-prop ones

### Already on from day 1 — no feature-enabling step

Rendering the three messaging components gives you all of these for free:

- **Instant messaging** (text, real-time delivery)
- **Media sharing** (images, video, audio, files)
- **Read receipts** (sent / delivered / read ticks)
- **Typing indicators**
- **Reactions** — on by default in `<cometchat-message-list>`. Click any message → emoji reaction. To turn it off, set `[hideReactionOption]="true"` (verified hide flag on the message list).
- **Replies** / **threads** (`hideReplyOption`, `hideReplyInThreadOption` to hide)
- **Edit / delete** own messages (`hideEditMessageOption`, `hideDeleteMessageOption`)
- **Message info** (`hideMessageInfoOption`)
- **Voice messages** (record + send from composer; `hideVoiceRecordingButton` to hide)
- **User presence** (online/offline status indicators render on avatars in `<cometchat-conversations>`, `<cometchat-users>`, `<cometchat-group-members>` by default — there is no per-list presence-hide `@Input` in v5; the only `hideUserStatus` flag lives on `<cometchat-search>`)
- **Search** — `<cometchat-users>` and `<cometchat-groups>` render a search bar by default; set `[hideSearch]="true"` to remove it (verified hide flag, default `false`). `<cometchat-conversations>` is the inverse: it has a **`[showSearchBar]` `@Input`** (default `false` — search hidden), so set `[showSearchBar]="true"` to show it; it also exposes a `[searchView]` template slot for a fully custom search surface.

These need **no install and no toggle**. If a customer reports one "missing," the cause is almost always a `hide*` input set to `true` somewhere — grep the templates first.

### Mentions (`@mentions`) — component-prop

Mentions are not auto-on; they surface only when you pass a `CometChatMentionsFormatter` into the verified `textFormatters` `@Input` (which exists on `<cometchat-message-list>`, `<cometchat-message-composer>`, and `<cometchat-conversations>`):

```typescript
// chat.component.ts
import { Component } from "@angular/core";
import {
  CometChatMessageListComponent,
  CometChatMessageComposerComponent,
  CometChatMentionsFormatter,
} from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({
  selector: "app-chat",
  standalone: true,
  imports: [CometChatMessageListComponent, CometChatMessageComposerComponent],
  template: `
    <cometchat-message-list  [user]="user" [textFormatters]="formatters"></cometchat-message-list>
    <cometchat-message-composer [user]="user" [textFormatters]="formatters"></cometchat-message-composer>
  `,
})
export class ChatComponent {
  @Input() user!: CometChat.User;
  // Pass the SAME formatter array to list + composer so typed @mentions render consistently
  formatters = [new CometChatMentionsFormatter()];
}
```

- `@all` mentions: the composer enables mention-all by default; set `[disableMentionAll]="true"` to suppress it (verified composer hide flag).
- To disable mentions entirely, set `[disableMentions]="true"` on the composer instead of omitting the formatter.

> **Why a formatter, not a toggle?** Mentions are a text-rendering concern. `CometChatMentionsFormatter` (verified export) is a `CometChatTextFormatter` subclass; the kit runs it over message text in the list and over input in the composer.

---

## 3. Dashboard-extension features (polls, stickers, collaborative, translation, link preview)

These are backend extensions. Enable each in the **CometChat dashboard**, or via the cross-family CLI. The components auto-render the result — usually **zero code**.

### Enable via the CLI (preferred — no browser)

Angular projects don't go through `cometchat apply` (no `.cometchat/state.json`), so always pass `--app-id <id>` explicitly. The CLI hits the dashboard API using the bearer from `cometchat auth login`:

```bash
cometchat apply-feature polls --app-id <your-app-id>
cometchat apply-feature stickers --app-id <your-app-id>
cometchat apply-feature message-translation --app-id <your-app-id>
cometchat apply-feature link-preview --app-id <your-app-id>
cometchat apply-feature collaborative-document --app-id <your-app-id>
cometchat apply-feature collaborative-whiteboard --app-id <your-app-id>
```

`cometchat apply-feature` and the dashboard toggles configure the **backend**; they are not code symbols.

**Response shapes (`--json`):**
- `"status": "applied"` → done. Hard-reload the Angular dev server (`ng serve` restart or browser refresh).
- `"status": "already-applied"` → already in the desired state.
- `"status": "auth-required"` → run `cometchat auth login` first.
- `"status": "manual-action-required"` → a third-party-config extension (Giphy, Stipop, Tenor, Chatwoot, Intercom, Disappearing Messages, Message Shortcuts). The CLI can't automate these — surface `next_steps` verbatim and walk the user through the dashboard.
- `"status": "error"` → surface `next_steps`.

### Enable via the dashboard (fallback)

1. https://app.cometchat.com → your app
2. Chat & Messaging → Features
3. Find the extension by name → flip Status ON
4. Hard-reload the Angular app

### Where each toggle surfaces in the v5 UI

| Extension | UI surface when enabled | Related verified hide flag (to suppress) |
|---|---|---|
| Polls | "Poll" option in `<cometchat-message-composer>`'s attachment menu; poll bubble in the list | `hidePollsOption` (composer) |
| Stickers | Sticker button in the composer; sticker bubble in the list | `hideStickersButton` (composer) |
| Collaborative document | Option in the composer attachment menu; opens a shared doc | `hideCollaborativeDocumentOption` (composer) |
| Collaborative whiteboard | Option in the composer attachment menu; opens a shared canvas | `hideCollaborativeWhiteboardOption` (composer) |
| Message translation | "Translate" option in the message context menu | `hideTranslateMessageOption` (message list) |
| Link preview | Rich-card bubble for URLs in the message list | — |
| Thumbnail generation | Image/video bubbles show thumbnails | — |

These are real, verified `@Input` hide flags on the v5 components — the feature *renders by default once the dashboard toggle is on*; you only touch a flag if you want to hide it.

After enabling, run `cometchat verify --json` and hard-reload. No code changes are needed for the auto-wired subset above.

---

## 4. AI features — dashboard toggle + OpenAI key + one component `@Input`

`smart-replies`, `conversation-starter`, and `conversation-summary` are AI features. Two steps: (1) enable on the backend with an OpenAI key, (2) surface with the verified component `@Input`.

### 4a — Enable on the backend (one CLI call)

The CLI sets the OpenAI key on the app and flips the toggle together:

```bash
cometchat apply-feature smart-replies        --app-id <your-app-id> --openai-key sk-...
cometchat apply-feature conversation-starter  --app-id <your-app-id> --openai-key sk-...
cometchat apply-feature conversation-summary  --app-id <your-app-id> --openai-key sk-...
```

The key is stored on the app once, so subsequent AI applies don't need `--openai-key` repeated. `"status": "openai-key-required"` → re-run with `--openai-key sk-…`. Get a key: https://platform.openai.com/api-keys.

### 4b — Surface smart replies + conversation starters (message-list `@Input`s)

These are **verified `@Input`s on `<cometchat-message-list>`** (confirmed in the v5 `.d.ts`):

```html
<cometchat-message-list
  [user]="selectedUser"
  [showSmartReplies]="true"
  [showConversationStarters]="true"
  [smartRepliesKeywords]="['help', 'pricing']"
  [smartRepliesDelayDuration]="2000">
</cometchat-message-list>
```

- `showSmartReplies` (boolean) — renders smart-reply chips after a recent incoming message.
- `showConversationStarters` (boolean) — renders starter suggestions when the conversation is empty.
- `smartRepliesKeywords` (`string[]`) — only show smart replies when the incoming message contains one of these keywords. Defaults to `['what', 'when', 'why', 'who', 'where', 'how', '?']` in v5 — set your own array to narrow it.
- `smartRepliesDelayDuration` (number, ms) — debounce before chips appear (v5 default `10000`).

`<cometchat-message-list>` also exposes the `(smartReplyClick)` and `(conversationStarterClick)` `@Output`s (each emits the selected reply `string`) if you want to observe selection. (There are also standalone `<cometchat-smart-replies>` and `<cometchat-conversation-starter>` components — verified exports under `base-elements/` — but the message-list `@Input`s are the idiomatic path.)

### 4c — Surface conversation summary (message-header `@Input`s)

Conversation summary is driven by **verified `@Input`s on `<cometchat-message-header>`**:

```html
<cometchat-message-header
  [user]="selectedUser"
  [showConversationSummaryButton]="true"
  [enableAutoSummaryGeneration]="true"
  [summaryGenerationMessageCount]="50"
  (conversationSummaryClick)="onSummary($event)">
</cometchat-message-header>
```

- `showConversationSummaryButton` (boolean, default `false`) — shows the "Summarize" button in the header.
- `enableAutoSummaryGeneration` (boolean, default `false`) — auto-generate a summary once the message count crosses the threshold.
- `summaryGenerationMessageCount` (number, **v5 default `1000`**) — the message-count threshold that triggers auto-summary. Lower it (e.g. `50`) to summarize sooner.
- `(conversationSummaryClick)` — `@Output` fired when the summary button is clicked; emits `{ messageCount: number }` (type the `$event` accordingly).

> The standalone `<cometchat-conversation-summary>` component (verified `@Input`s `getConversationSummary: () => Promise<string>` and `closeCallback: () => void`) is for fully custom summary UIs. For the standard flow, the header `@Input`s above are all you need.

### 4d — Reading smart-reply metadata for a fully custom UI

If you render your own chips instead of using `showSmartReplies`, read the server-injected metadata off the incoming message (the AI runs on CometChat's backend, not in your code):

```typescript
const metadata = message.getMetadata() as Record<string, any>;
const smartReply = metadata?.["@injected"]?.["extensions"]?.["smart-reply"];
if (smartReply) {
  const replies = [
    smartReply.reply_positive,
    smartReply.reply_neutral,
    smartReply.reply_negative,
  ].filter(Boolean);
  // render your own reply chips → on click, CometChatUIKit.sendTextMessage(...)
}
```

---

## 5. Calls (package-install) — pointer to the calls skill

Voice + video calling is the one package-install feature. Two steps:

```bash
npm install @cometchat/calls-sdk-javascript@^5
```

```typescript
// in your UIKitSettingsBuilder chain, before CometChatUIKit.init(...)
const settings = new UIKitSettingsBuilder()
  .setAppId(environment.cometchat.appId)
  .setRegion(environment.cometchat.region)
  .setAuthKey(environment.cometchat.authKey)
  .setCallingEnabled(true)        // verified builder method (v5 .d.ts)
  .build();
```

`setCallingEnabled(true)` is a **verified** `UIKitSettingsBuilder` method. Once the calls SDK peer is installed and calling is enabled, the kit's standalone call components work: `<cometchat-call-buttons>`, `<cometchat-incoming-call>`, `<cometchat-outgoing-call>`, `<cometchat-ongoing-call>`, `<cometchat-call-logs>`.

**For the full call flow — app-wide incoming-call mounting, the `@Input`-callback-vs-`@Output` binding split (`[onAccept]` input vs `(callAccepted)` output), NgZone correctness, getUserMedia handling, additive-vs-standalone modes — read `cometchat-angular-calls`.** Do not re-derive the call wiring here; that skill is the source of truth.

Quick reminder on call-button placement (header `[auxiliaryButtonView]` / `[menuView]` slot):

```html
<cometchat-message-header [user]="selectedUser" [auxiliaryButtonView]="callButtons"></cometchat-message-header>
<ng-template #callButtons>
  <cometchat-call-buttons
    [user]="selectedUser"
    [onVoiceCallClick]="handleVoiceCall"
    [onVideoCallClick]="handleVideoCall">
  </cometchat-call-buttons>
</ng-template>
```

`onVoiceCallClick` / `onVideoCallClick` are **`@Input` callback props** (square brackets, function refs) — not `@Output`s. See the components catalog and calls skill.

---

## 6. AI Agent (dashboard setup, no dedicated v5 component)

1. https://app.cometchat.com → your app → AI → Agents
2. Create an agent (name, system prompt, model) and assign it a UID (e.g. `ai-support-agent`).
3. Users message the agent like any other user.

Angular v5 ships AI-assistant building blocks (`CometChatAIAssistantChat`, `-ChatHistory`, `-MessageBubble` are exported), but the standard, supported path to chat with an agent is the normal message components targeted at the agent's UID:

```typescript
CometChat.getUser("ai-support-agent").then((agent) => { this.aiAgent = agent; });
```

```html
<cometchat-message-header   [user]="aiAgent"></cometchat-message-header>
<cometchat-message-list     [user]="aiAgent"></cometchat-message-list>
<cometchat-message-composer [user]="aiAgent"></cometchat-message-composer>
```

Smart replies / conversation starter / summary surface through the §4 `@Input`s once enabled.

---

## 7. Finding a feature's category quickly

1. **In the auto-enabled list (§2)?** → Already works. Confirm no `hide*` `@Input` is turning it off.
2. **@mentions?** → Component-prop: pass `[textFormatters]="[new CometChatMentionsFormatter()]"` (§2).
3. **Smart replies / conversation starter / summary?** → AI feature: enable with `cometchat apply-feature <id> --app-id <X> --openai-key sk-…`, then set the message-list / message-header `@Input` (§4).
4. **Polls / stickers / collaborative doc-or-whiteboard / message translation / link preview / thumbnails?** → Dashboard-extension: `cometchat apply-feature <id> --app-id <X>`, then hard-reload (§3).
5. **Giphy / Stipop / Tenor / Chatwoot / Intercom / Disappearing Messages / Message Shortcuts?** → Dashboard-extension needing third-party config; CLI returns `manual-action-required`. Walk the user through https://app.cometchat.com → Chat & Messaging → Features.
6. **Voice / video / call logs?** → Package-install: `npm install @cometchat/calls-sdk-javascript@^5` + `.setCallingEnabled(true)` → `cometchat-angular-calls` (§5).
7. **AI agent?** → §6.
8. **Custom text formatting / custom message templates / custom slot views / theming?** → That's **customization**, not a feature. Route to `cometchat-angular-customization` / `cometchat-angular-theming`.
9. **Not on this list?** → Check `docs/ui-kit/angular/guide-overview` + the kit's exports. If still nothing, the feature isn't in the UI Kit; the user may need the raw SDK.

---

## 8. Anti-patterns

1. **Don't invent a component `@Input`.** Every prop in this skill (`showSmartReplies`, `showConversationStarters`, `smartRepliesKeywords`, `smartRepliesDelayDuration`, `showConversationSummaryButton`, `enableAutoSummaryGeneration`, `summaryGenerationMessageCount`, `textFormatters`, the `hide*` flags, `setCallingEnabled`) is verified against the v5 `.d.ts`. If a prop isn't in `cometchat-angular-components` or the `.d.ts`, it doesn't exist — v4 prop names frequently differ.
2. **Don't treat reactions/mentions as a backend toggle.** Reactions are auto-on (hide via `hideReactionOption`); mentions are a `textFormatters` `@Input`. Neither uses `apply-feature`.
3. **Don't speculatively install the calls SDK.** Install `@cometchat/calls-sdk-javascript` only after the user asks for calls, and pin `^5`.
4. **Don't enable extensions the app doesn't use.** Each enabled extension adds data-fetching overhead.
5. **Don't omit `--app-id`.** Angular has no `.cometchat/state.json`; every `apply-feature` call needs `--app-id <id>`.
6. **Don't bind a call `@Input` callback as an `@Output`.** `[onVoiceCallClick]="fn"` (input) vs `(voiceCallClick)="fn($event)"` (output) — use the one the catalog lists.
7. **Don't reference AI streaming APIs from memory.** They change across minor versions — confirm against the docs MCP / `.d.ts` before generating code.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Init / login / standalone setup / `UIKitSettingsBuilder` |
| `cometchat-angular-components` | Component selector + `@Input`/`@Output` reference |
| `cometchat-angular-calls` | Full voice/video call flow + incoming-call mounting |
| `cometchat-angular-placement` | Where the call-logs tab / AI chat route / message panes go |
| `cometchat-angular-features` | This skill — which features exist + how to enable each |
| `cometchat-angular-theming` | Theming reaction colors, call buttons, extension UI (CSS variables) |
| `cometchat-angular-customization` | Custom text formatters, custom message templates, event bus |
| `cometchat-angular-production` | Server-side auth tokens (prerequisite for AI agent in prod) |
| `cometchat-angular-troubleshooting` | Extension not showing after enabling, call permission failures |

## Sources

- [Core features](https://www.cometchat.com/docs/ui-kit/angular/core-features)
- [Extensions](https://www.cometchat.com/docs/ui-kit/angular/extensions)
- [AI features](https://www.cometchat.com/docs/ui-kit/angular/ai-features)
- [Calling integration](https://www.cometchat.com/docs/ui-kit/angular/calling-integration)
