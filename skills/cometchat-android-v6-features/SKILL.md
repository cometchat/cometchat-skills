---
name: cometchat-android-v6-features
description: "CometChat Android UIKit v6 feature catalog — AI features, reactions, polls, stickers, moderation, collaborative, and media features"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, features, ai, reactions, polls, stickers, moderation"
---

> **Ground truth:** `com.cometchat:chatuikit-{compose,kotlin}-android:6.x` + `packages/registry/v6/features/catalog.json`. (Official docs linked below.) Verify symbols against the installed package/source before relying on them.

> **Companion skills:** cometchat-android-v6-kotlin-components, cometchat-android-v6-compose-components, cometchat-android-v6-extensions (DataSource pattern), cometchat-android-v6-events, **cometchat-android-v6-calls** (voice/video calling enablement — recording is a paid add-on)

## Purpose

Catalog of all features available in CometChat UIKit v6, how they map to components and DataSources, and how to enable/disable them.

## Use this skill when

- Enabling or disabling specific features (AI, reactions, polls, stickers)
- Understanding what features are available out of the box
- Mapping a feature to its component and DataSource

## Do not use this skill when

- Working with component APIs directly (use `cometchat-*-components`)
- Customizing bubble rendering (use `cometchat-*-customization`)

## 0. Feature categories — what work each needs

> **Canonical public feature-availability matrix:** [Features & Extensions Guide](https://www.cometchat.com/docs/fundamentals/features-and-extensions-guide) — the authoritative source for which integration method (UI Kit / UI Kit Builder / Widget Builder / SDK) supports each feature + dashboard setup + whether code is required. It **outranks the local `catalog.json` snapshot on conflict**; consult it (WebFetch or docs MCP) for any availability decision.


Before enabling anything, classify the feature by the product's 5-category "work needed" model:

| Category | Work needed | Example |
|---|---|---|
| **Core (zero-setup)** | Nothing — renders out of the box | Typing indicators, reactions |
| **Builder-enabled** | Dashboard API + toggle in the UI Kit Builder | Polls |
| **Config-only** | Dashboard API enable; works automatically | Link preview |
| **Config + settings** | Dashboard API + extra settings (API keys, thresholds) — no code | Smart replies (OpenAI key) |
| **SDK-integrated** | Dashboard API + **custom client code** | Bitly |

**Key rule:** only **SDK-integrated** features need client code — and **the implementation lives in the docs** (`cometchat features info <id> --json` shows what's needed; fetch + adapt the doc code, don't hand-roll). Everything else is enable-and-done.

**Honest-automation boundary (what the CLI can vs can't do):**
- **Extensions** (polls, link-preview, message-translation, reactions, etc.) → `cometchat apply-feature <id> --app-id <your-app-id>` makes the **real dashboard API call** to flip the toggle. No browser visit, no code. Never tell the user to "open the dashboard and toggle it" for an extension.
- **AI features** → `cometchat apply-feature <id> --app-id <X> --openai-key sk-...` (sets the key, then enables) — see §1.
- **Third-party dashboard-only features** (Giphy, Stipop, Tenor, Chatwoot, Intercom, Disappearing Messages, Message Shortcuts) → the CLI returns `manual-action-required` and prints the dashboard path. These need **your** third-party credentials and **cannot be automated** — state that honestly.
- **Calls** → see `cometchat-android-v6-calls`. **Call recording is a paid plan add-on** — there is no dashboard toggle / CLI call to enable it; the user must contact CometChat support. Never claim recording was "enabled."

## 1. AI Features

AI features need an OpenAI API key on the app's AI settings. Enable each one with the CLI in stateless mode (Android projects don't write `.cometchat/state.json`):

```bash
cometchat apply-feature smart-replies --app-id <your-app-id> --openai-key sk-...
cometchat apply-feature conversation-summary --app-id <your-app-id>
cometchat apply-feature conversation-starter --app-id <your-app-id>
```

The OpenAI key is stored on the app once, so subsequent ai-feature applies don't need `--openai-key` repeated. Requires `cometchat auth login` once per machine.

| Feature | Compose Component | Core DataSource | Description |
|---|---|---|---|
| AI Assistant Chat History | `CometChatAIAssistantChatHistory` | — | Shows AI bot conversation history |
| AI Conversation Starter | Shared element in `presentation/shared/aiconversationstarter/` | — | Suggests conversation starters |
| AI Conversation Summary | Shared element in `presentation/shared/aiconversationsummary/` | — | Summarizes long conversations |
| AI Smart Replies | Shared element in `presentation/shared/aismartreplies/` | — | Suggests contextual replies |

AI features integrate with `CometChatMessageList` via the `smartRepliesView` slot and AI-specific parameters.

The `CometChatAIStreamService` in `chatuikit-core` handles streaming AI responses.

## 2. Reactions

| Feature | Component | DataSource | Description |
|---|---|---|---|
| Reaction List | `CometChatReactionList` | `ReactionListDataSource` | Shows who reacted with what |
| Add Reaction | Shared element in `presentation/shared/reaction/` | — | Emoji picker for adding reactions |

Reactions appear in the **footer slot** of message bubbles. Reaction events flow through `CometChatEvents.messageEvents`.

## 3. Polls

| Feature | Component | DataSource | Description |
|---|---|---|---|
| Create Poll | `CometChatCreatePoll` (Compose) | `PollDataSource` | Create a new poll |
| Poll Bubble | Shared element in `presentation/shared/` | `PollDataSourceImpl` | Renders poll in message list |

Polls are custom messages with type `extension_poll`. The `PollRepositoryImpl` handles vote submission.

## 4. Stickers

| Feature | Component | DataSource | Description |
|---|---|---|---|
| Sticker Keyboard | `CometChatStickerKeyboard` | `StickerDataSource` | Browse and send stickers |
| Sticker Bubble | `stickerbubble/` (Kotlin Views) | `StickerDataSourceImpl` | Renders sticker in message list |

Stickers integrate with `CometChatMessageComposer` as an auxiliary input.

## 5. Moderation

| Feature | Component | Description |
|---|---|---|
| Report/Flag Message | `CometChatFlagMessageDialog` (Views) / `CometChatFlagMessageDialog` (Compose) | Report inappropriate messages |

Moderation views appear in the **bottom slot** of message bubbles when moderation is enabled.

## 6. Collaborative Features

| Feature | DataSource | Description |
|---|---|---|
| Collaborative Document | `CollaborativeDataSource` | Real-time document editing |
| Collaborative Whiteboard | `CollaborativeDataSourceImpl` | Real-time whiteboard |

## 7. Media Features

| Feature | Component | Description |
|---|---|---|
| Image Viewer | `CometChatImageViewerScreen` (Compose) | Full-screen image viewing with zoom |
| Media Recorder | Shared element in `presentation/shared/mediarecorder/` | Audio/video recording |
| Inline Audio Recorder | Shared element in `presentation/shared/inlineaudiorecorder/` | In-composer audio recording |
| Media Selection | Shared element in `presentation/shared/mediaselection/` | Photo/video picker |

## 8. Feature-to-DataSource Mapping

All DataSources live in `chatuikit-core/data/datasource/`:

| DataSource Interface | Implementation | Feature Area |
|---|---|---|
| `CallButtonsDataSource` | `CallButtonsDataSourceImpl` | Audio/video call buttons |
| `CallLogsDataSource` | `CallLogsDataSourceImpl` | Call history |
| `CollaborativeDataSource` | `CollaborativeDataSourceImpl` | Documents/whiteboards |
| `ConversationListDataSource` | `ConversationListDataSourceImpl` | Conversation list |
| `GroupMembersDataSource` | `GroupMembersDataSourceImpl` | Group member management |
| `GroupsDataSource` | `GroupsDataSourceImpl` | Group list |
| `MessageComposerDataSource` | `MessageComposerDataSourceImpl` | Message input |
| `MessageHeaderDataSource` | `MessageHeaderDataSourceImpl` | Chat header |
| `MessageInformationDataSource` | `MessageInformationDataSourceImpl` | Message info/receipts |
| `MessageListDataSource` | `MessageListDataSourceImpl` | Message list |
| `PollDataSource` | `PollDataSourceImpl` | Polls |
| `ReactionListDataSource` | `ReactionListDataSourceImpl` | Reactions |
| `SearchDataSource` | `SearchDataSourceImpl` | Global search |
| `StickerDataSource` | `StickerDataSourceImpl` | Stickers |
| `UsersDataSource` | `UsersDataSourceImpl` | User list |

## Hard rules

- AI features require dashboard configuration — they cannot be enabled purely from client code
- Polls and stickers are custom message types — they require the corresponding extensions enabled on the dashboard
- Do NOT confuse DataSources (data layer in core) with BubbleFactory (UI layer in kotlin/compose) — DataSources fetch data, BubbleFactories render bubbles
