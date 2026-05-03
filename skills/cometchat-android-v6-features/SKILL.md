---
name: cometchat-android-v6-features
description: "CometChat Android UIKit v6 feature catalog — AI features, reactions, polls, stickers, moderation, collaborative, and media features"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, features, ai, reactions, polls, stickers, moderation"
---

> **Companion skills:** cometchat-android-v6-kotlin-components, cometchat-android-v6-compose-components, cometchat-android-v6-extensions (DataSource pattern), cometchat-android-v6-events

## Purpose

Catalog of all features available in CometChat UIKit v6, how they map to components and DataSources, and how to enable/disable them.

## Use this skill when

- Enabling or disabling specific features (AI, reactions, polls, stickers)
- Understanding what features are available out of the box
- Mapping a feature to its component and DataSource

## Do not use this skill when

- Working with component APIs directly (use `cometchat-*-components`)
- Customizing bubble rendering (use `cometchat-*-customization`)

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
