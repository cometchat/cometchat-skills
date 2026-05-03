---
name: cometchat-android-v6-extensions
description: "CometChat Android UIKit v6 extension architecture — DataSource/Repository pattern, custom message types, and data-layer overrides"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-core-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, extensions, datasource, repository, clean-architecture"
---

> **Companion skills:** cometchat-android-v6-features (feature catalog), cometchat-android-v6-kotlin-customization, cometchat-android-v6-compose-customization

## Purpose

Extend the CometChat UIKit v6 data layer using the clean architecture DataSource/Repository pattern. Create custom DataSource implementations, override repository behavior, and register custom message types.

## Use this skill when

- Creating a custom DataSource implementation to change how data is fetched
- Overriding default repository behavior
- Registering custom message types
- Understanding the data flow from DataSource → Repository → ViewModel

## Do not use this skill when

- Customizing UI/bubble rendering (use `cometchat-*-customization` — that's the BubbleFactory layer)
- Working with component APIs (use `cometchat-*-components`)

## 1. Clean Architecture Overview

The `chatuikit-core` module follows clean architecture with three layers:

```
┌─────────────────────────────────────────┐
│  UI Layer (chatuikit-kotlin / compose)  │
│  Components observe ViewModel state     │
├─────────────────────────────────────────┤
│  ViewModel Layer (core/viewmodel/)      │
│  Calls use cases / repositories         │
├─────────────────────────────────────────┤
│  Domain Layer (core/domain/)            │
│  Repository interfaces, Use cases       │
├─────────────────────────────────────────┤
│  Data Layer (core/data/)                │
│  DataSource interfaces + impls          │
│  Repository implementations            │
└─────────────────────────────────────────┘
```

## 2. DataSource Pattern

Each feature area has a DataSource interface and default implementation:

```
core/data/datasource/
├── ConversationListDataSource.kt       (interface)
├── ConversationListDataSourceImpl.kt   (default implementation)
├── MessageListDataSource.kt
├── MessageListDataSourceImpl.kt
├── ...
```

### 2.1 All DataSource Types

| DataSource | Implementation | What it provides |
|---|---|---|
| `CallButtonsDataSource` | `CallButtonsDataSourceImpl` | Call button actions |
| `CallLogsDataSource` | `CallLogsDataSourceImpl` | Call history fetching |
| `CollaborativeDataSource` | `CollaborativeDataSourceImpl` | Document/whiteboard data |
| `ConversationListDataSource` | `ConversationListDataSourceImpl` | Conversation list fetching |
| `GroupMembersDataSource` | `GroupMembersDataSourceImpl` | Group member operations |
| `GroupsDataSource` | `GroupsDataSourceImpl` | Group list fetching |
| `MessageComposerDataSource` | `MessageComposerDataSourceImpl` | Composer actions/attachments |
| `MessageHeaderDataSource` | `MessageHeaderDataSourceImpl` | Header data (name, status) |
| `MessageInformationDataSource` | `MessageInformationDataSourceImpl` | Read receipts, delivery info |
| `MessageListDataSource` | `MessageListDataSourceImpl` | Message fetching/pagination |
| `PollDataSource` | `PollDataSourceImpl` | Poll creation/voting |
| `ReactionListDataSource` | `ReactionListDataSourceImpl` | Reaction data |
| `SearchDataSource` | `SearchDataSourceImpl` | Global search |
| `StickerDataSource` | `StickerDataSourceImpl` | Sticker fetching |
| `UsersDataSource` | `UsersDataSourceImpl` | User list fetching |

### 2.2 Additional DataSource

| File | Purpose |
|---|---|
| `MessageReceiptEventListener.kt` | Listens for receipt events at the data layer |

## 3. Repository Pattern

Repositories in `core/data/repository/` implement domain interfaces from `core/domain/repository/`:

```
core/data/repository/
├── CallButtonsRepositoryImpl.kt
├── CallLogsRepositoryImpl.kt
├── ConversationListRepositoryImpl.kt
├── GroupMembersRepositoryImpl.kt
├── GroupsRepositoryImpl.kt
├── MessageComposerRepositoryImpl.kt
├── MessageHeaderRepositoryImpl.kt
├── MessageInformationRepositoryImpl.kt
├── MessageListRepositoryImpl.kt
├── PollRepositoryImpl.kt
├── ReactionListRepositoryImpl.kt
├── SearchRepositoryImpl.kt
├── StickerRepositoryImpl.kt
├── UsersRepositoryImpl.kt
```

Each repository wraps a DataSource and adds business logic, caching, or transformation.

## 4. ViewModel Layer

ViewModels in `core/viewmodel/` consume repositories and expose UI state:

```kotlin
// Example: CometChatConversationsViewModel
// - Injected via CometChatConversationsViewModelFactory
// - Exposes StateFlow<ConversationListUIState>
// - Calls ConversationListRepositoryImpl internally
```

ViewModel factories in `core/factory/` handle dependency injection:

| Factory | ViewModel |
|---|---|
| `CometChatConversationsViewModelFactory` | `CometChatConversationsViewModel` |
| `CometChatMessageListViewModelFactory` | `CometChatMessageListViewModel` |
| `CometChatGroupsViewModelFactory` | `CometChatGroupsViewModel` |
| `CometChatUsersViewModelFactory` | `CometChatUsersViewModel` |
| `CometChatCallLogsViewModelFactory` | `CometChatCallLogsViewModel` |
| `CometChatMessageComposerViewModelFactory` | `CometChatMessageComposerViewModel` |
| `CometChatMessageHeaderViewModelFactory` | `CometChatMessageHeaderViewModel` |
| `CometChatGroupMembersViewModelFactory` | `CometChatGroupMembersViewModel` |
| `CometChatMessageInformationViewModelFactory` | `CometChatMessageInformationViewModel` |
| `CometChatReactionListViewModelFactory` | `CometChatReactionListViewModel` |
| `CometChatSearchViewModelFactory` | `CometChatSearchViewModel` |
| `CometChatCallButtonsViewModelFactory` | `CometChatCallButtonsViewModel` |
| `CometChatCreatePollViewModelFactory` | `CometChatCreatePollViewModel` |
| `CometChatThreadHeaderViewModelFactory` | `CometChatThreadHeaderViewModel` |
| `CometChatStickerKeyboardViewModelFactory` | `CometChatStickerKeyboardViewModel` |
| `CometChatIncomingCallViewModelFactory` | `CometChatIncomingCallViewModel` |
| `CometChatOutgoingCallViewModelFactory` | `CometChatOutgoingCallViewModel` |
| `CometChatAIAssistantChatHistoryViewModelFactory` | `CometChatAIAssistantChatHistoryViewModel` |

## 5. UI State Classes

Each ViewModel exposes a sealed UI state from `core/state/`:

| State Class | Used By |
|---|---|
| `CallLogsUIState` | Call logs |
| `MessageListUIState` | Message list |
| `GroupsUIState` | Groups list |
| `UsersUIState` | Users list |
| `GroupMembersUIState` | Group members |
| `MessageComposerUIState` | Composer |
| `MessageHeaderUIState` | Header |
| `MessageInformationUIState` | Message info |
| `ReactionListUIState` | Reactions |
| `SearchUIState` | Search |
| `CallButtonsUIState` | Call buttons |
| `CreatePollUIState` | Poll creation |
| `ThreadHeaderUIState` | Thread header |
| `StickerKeyboardUIState` | Sticker keyboard |
| `IncomingCallUIState` | Incoming call |
| `OutgoingCallUIState` | Outgoing call |
| `ChatHistoryUIState` | AI chat history |
| `ConversationStarterUIState` | AI conversation starter |
| `ConversationSummaryUIState` | AI conversation summary |
| `SmartRepliesUIState` | AI smart replies |
| `DeleteState` | Delete operations |
| `UIState` | Base UI state |

## 6. Data Flow

```
User Action → Component → ViewModel → Repository → DataSource → CometChat SDK
                                                                      ↓
UI Update  ← Component ← ViewModel ← StateFlow ← Repository ← SDK Response
```

## Hard rules

- DataSources are the DATA layer — they fetch and mutate data. Do NOT confuse with BubbleFactory which is the UI rendering layer
- The v5 `DataSource` decorator / `ChatConfigurator` pattern for bubble customization does NOT exist in v6 — use BubbleFactory instead (see `cometchat-*-customization`)
- ViewModels are shared across both UI stacks (Kotlin Views and Compose) — they live in `chatuikit-core`
- Always use the provided ViewModel factories — do not instantiate ViewModels directly
