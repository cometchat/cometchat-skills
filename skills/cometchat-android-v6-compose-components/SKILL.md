---
name: cometchat-android-v6-compose-components
description: "CometChat Android UIKit v6 Jetpack Compose component catalog — all @Composable chat UI components, their parameters, styles, and usage"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, compose, components, conversations, messages, users, groups, calls"
---

> **Companion skills:** cometchat-android-v6-kotlin-components (Views equivalent), cometchat-android-v6-compose-theming, cometchat-android-v6-compose-customization, cometchat-android-v6-compose-placement

## Purpose

Complete catalog of all Jetpack Compose components in CometChat UIKit v6. Each component is a `@Composable` function in `com.cometchat.uikit.compose.presentation`.

## Use this skill when

- Adding a CometChat Compose component to a screen
- Looking up component parameters and their types
- Understanding which component to use for a specific chat feature
- Finding the style class for a component

## Do not use this skill when

- Working with Kotlin Views components (use `cometchat-android-v6-kotlin-components`)
- Customizing bubble rendering (use `cometchat-android-v6-compose-customization`)
- Placing components in navigation (use `cometchat-android-v6-compose-placement`)

## 1. Component Catalog


### 1.1 List Components

| Component | Package | Purpose |
|---|---|---|
| `CometChatConversations` | `presentation.conversations.ui` | Recent conversations list |
| `CometChatUsers` | `presentation.users.ui` | User list |
| `CometChatGroups` | `presentation.groups.ui` | Group list |
| `CometChatGroupMembers` | `presentation.groupmembers.ui` | Members of a group |
| `CometChatCallLogs` | `presentation.calllogs.ui` | Call history |

### 1.2 Messaging Components

| Component | Package | Purpose |
|---|---|---|
| `CometChatMessageList` | `presentation.messagelist.ui` | Message list with bubbles |
| `CometChatMessageComposer` | `presentation.messagecomposer.ui` | Message input with attachments |
| `CometChatMessageHeader` | `presentation.messageheader.ui` | Chat header (name, status, actions) |
| `CometChatMessageInformation` | `presentation.messageinformation.ui` | Message delivery/read info |
| `CometChatThreadHeader` | `presentation.threadheader.ui` | Thread parent message header |

### 1.3 Call Components

| Component | Package | Purpose |
|---|---|---|
| `CometChatCallButtons` | `presentation.callbuttons.ui` | Audio/video call buttons |
| `CometChatIncomingCall` | `presentation.incomingcall.ui` | Incoming call screen |
| `CometChatOutgoingCall` | `presentation.outgoingcall.ui` | Outgoing call screen |
| `CometChatOngoingCall` | `presentation.ongoingcall.ui` | Active call screen |
| `CometChatCallActivity` | `calls` | Activity wrapper for calls |

### 1.4 Utility Components

| Component | Package | Purpose |
|---|---|---|
| `CometChatSearch` | `presentation.search.ui` | Global search |
| `CometChatReactionList` | `presentation.reactionlist.ui` | Reaction details |
| `CometChatEmojiKeyboard` | `presentation.emojikeyboard.ui` | Emoji picker |
| `CometChatStickerKeyboard` | `presentation.stickerkeyboard.ui` | Sticker picker |
| `CometChatCreatePoll` | `presentation.createpoll.ui` | Poll creation |
| `CometChatImageViewerScreen` | `presentation.imageviewer.ui` | Full-screen image viewer |
| `CometChatFlagMessageDialog` | `presentation.report` | Report/flag message |
| `CometChatAIAssistantChatHistory` | `presentation.aiassistantchathistory.ui` | AI chat history |

### 1.5 Shared Elements

Located in `presentation.shared/`:

- AI features: `aiconversationstarter/`, `aiconversationsummary/`, `aismartreplies/`
- Message bubble: `messagebubble/` (BubbleFactory, InternalContentRenderer, CometChatMessageBubble)
- Mentions: `mentions/`
- Formatters: `formatters/` (CometChatTextFormatter, CometChatMentionsFormatter)
- Default states: `defaultstates/` (empty, error, loading state composables)
- Dialog: `dialog/`
- Popup menu: `popupmenu/`

### 1.6 Preview Support

The `preview/` package provides preview data, domain models, and presentation helpers for `@Preview` composables during development.

## 2. Basic Usage Examples

### 2.1 Conversations List

```kotlin
import com.cometchat.uikit.compose.presentation.conversations.ui.CometChatConversations
import com.cometchat.uikit.compose.theme.CometChatTheme

@Composable
fun ConversationsScreen(onConversationClick: (Conversation) -> Unit) {
    CometChatTheme {
        CometChatConversations(
            onItemClick = { conversation ->
                onConversationClick(conversation)
            }
        )
    }
}
```

### 2.2 Message List

```kotlin
import com.cometchat.uikit.compose.presentation.messagelist.ui.CometChatMessageList
import com.cometchat.chat.models.User

@Composable
fun ChatScreen(user: User) {
    CometChatTheme {
        Column {
            CometChatMessageHeader(user = user)
            CometChatMessageList(
                user = user,
                modifier = Modifier.weight(1f)
            )
            CometChatMessageComposer(user = user)
        }
    }
}
```

### 2.3 Users List

```kotlin
@Composable
fun UsersScreen() {
    CometChatTheme {
        CometChatUsers(
            onItemClick = { user ->
                // Navigate to chat with user
            }
        )
    }
}
```

### 2.4 Groups List

```kotlin
@Composable
fun GroupsScreen() {
    CometChatTheme {
        CometChatGroups(
            onItemClick = { group ->
                // Navigate to group chat
            }
        )
    }
}
```

## 3. Style Classes

Every component has a corresponding `@Immutable data class` style in its `style/` subpackage:

| Component | Style Class | Factory |
|---|---|---|
| `CometChatConversations` | `CometChatConversationsStyle` | `.default()` |
| `CometChatUsers` | `CometChatUsersStyle` | `.default()` |
| `CometChatGroups` | `CometChatGroupsStyle` | `.default()` |
| `CometChatGroupMembers` | `CometChatGroupMembersStyle` | `.default()` |
| `CometChatMessageList` | `CometChatMessageListStyle` | `.default()` |
| `CometChatMessageComposer` | `CometChatMessageComposerStyle` | `.default()` |
| `CometChatMessageHeader` | `CometChatMessageHeaderStyle` | `.default()` |
| `CometChatCallLogs` | `CometChatCallLogsStyle` | `.default()` |
| `CometChatThreadHeader` | `CometChatThreadHeaderStyle` | `.default()` |

Usage:

```kotlin
CometChatConversations(
    style = CometChatConversationsStyle.default(
        backgroundColor = Color.White,
        titleTextColor = Color.Black,
        titleTextStyle = CometChatTheme.typography.heading1Bold
    )
)
```

## 4. ViewModel Integration

Each component creates its own ViewModel internally via factories from `chatuikit-core`. The ViewModels expose `StateFlow` of sealed UI state classes. You typically don't need to interact with ViewModels directly — the components handle everything.

## Hard rules

- ALWAYS wrap CometChat Compose components in `CometChatTheme {}` — they depend on `CompositionLocal` theme values
- Components create their own ViewModels internally — do NOT try to create or inject ViewModels manually
- Style classes use `Companion.default()` factory functions — do NOT use the data class constructor directly (it requires all parameters)
- All style defaults source from `CometChatTheme` tokens — override only what you need via named parameters
