---
name: cometchat-android-v6-compose-components
description: "CometChat Android UIKit v6 Jetpack Compose component catalog — all @Composable chat UI components, their parameters, styles, and usage"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, compose, components, conversations, messages, users, groups, calls"
---

> **Ground truth:** `com.cometchat:chatuikit-compose-android:6.x` component catalog (javap the AAR) + `docs/ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/components-overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

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

> ⛔ **Only the `@Composable`s in THIS catalog exist — do not invent or recall names from v4/older memory.** Before emitting any `CometChat*` composable, confirm it's listed below; if it's not here, it doesn't exist (→ "unresolved reference" compile error). **There is no all-in-one composable:** the v4-era composites `CometChatConversationsWithMessages` / `CometChatUsersWithMessages` / `CometChatGroupsWithMessages` / `CometChatMessages` and the `CometChatUI` god-component do **not** exist in v6 Android (verified against the v6 Kotlin-Views kit, which the Compose stack mirrors). Compose a two-pane experience yourself: `CometChatConversations()` (list) → on item-click, host `CometChatMessageHeader()` + `CometChatMessageList()` + `CometChatMessageComposer()` for the selected `User`/`Group`.

### 1.1 List Components

| Component | Package | Purpose |
|---|---|---|
| `CometChatConversations` | `presentation.conversations.ui` | Recent conversations list |
| `CometChatUsers` | `presentation.users.ui` | User list |
| `CometChatGroups` | `presentation.groups.ui` | Group list |
| `CometChatGroupMembers` | `presentation.groupmembers.ui` | Members of a group |
| `CometChatCallLogs` | `presentation.calllogs.ui` | Call history |

### 1.2 Messaging Components

> ⚠️ **There is NO combined `CometChatMessages` composable on Android Compose.** Unlike React / Flutter / Android V5 (Views), the V6 Compose surface ships the three pieces separately and you compose the chat screen manually as `CometChatMessageHeader + CometChatMessageList + CometChatMessageComposer` in a `Column` (see §2.2). Do not import `com.cometchat.uikit.compose.presentation.cometchatmessages.CometChatMessages` — that package does not exist (ENG-35698 fix).

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
| `CometChatCallButtons` | `presentation.callbuttons.ui` | Audio/video call buttons — ⚠️ broken at 6.0.0, captures first-rendered user globally; see `cometchat-android-v6-calls` §W4 for workaround |
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
| `CometChatNotificationFeed` | `presentation.notificationfeed.ui` | Full-screen notification feed (category filter chips, timestamp grouping, rich cards, real-time updates) |

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

> **`CometChatTheme {}` is applied ONCE at the app root, outside the `NavHost` — not per screen.** The examples below assume that root wrapper is already in place (see `cometchat-android-v6-compose-placement` §1), so individual screens do NOT re-wrap in `CometChatTheme {}`. Nesting multiple `CometChatTheme {}` wrappers is an anti-pattern.

### 2.1 Conversations List

```kotlin
import com.cometchat.uikit.compose.presentation.conversations.ui.CometChatConversations

@Composable
fun ConversationsScreen(onConversationClick: (Conversation) -> Unit) {
    CometChatConversations(
        onItemClick = { conversation ->
            onConversationClick(conversation)
        }
    )
}
```

### 2.2 Message List

The chat screen composes the three pieces in a `Column`. Match the kit sample app (`sample-app-compose/.../messages/MessagesScreen.kt`): wrap in a `Scaffold(contentWindowInsets = WindowInsets.statusBars)` and give the `Column` `.navigationBarsPadding().imePadding()` so the soft keyboard pushes the composer up instead of covering it. Header and Composer take `Modifier.fillMaxWidth()`; the List takes `weight(1f)`.

```kotlin
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import com.cometchat.uikit.compose.presentation.messagelist.ui.CometChatMessageList
import com.cometchat.chat.models.User

@Composable
fun ChatScreen(user: User) {
    Scaffold(contentWindowInsets = WindowInsets.statusBars) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .consumeWindowInsets(paddingValues)
                .navigationBarsPadding()
                .imePadding()
        ) {
            CometChatMessageHeader(modifier = Modifier.fillMaxWidth(), user = user)
            CometChatMessageList(
                user = user,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            )
            CometChatMessageComposer(modifier = Modifier.fillMaxWidth(), user = user)
        }
    }
}
```

### 2.3 Users List

```kotlin
@Composable
fun UsersScreen() {
    CometChatUsers(
        onItemClick = { user ->
            // Navigate to chat with user
        }
    )
}
```

### 2.4 Groups List

```kotlin
@Composable
fun GroupsScreen() {
    CometChatGroups(
        onItemClick = { group ->
            // Navigate to group chat
        }
    )
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
| `CometChatNotificationFeed` | `CometChatNotificationFeedStyle` | constructor (`Color.Unspecified` defaults) + `.fromTheme(overrides)` |

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

- CometChat Compose components depend on `CometChatTheme {}` `CompositionLocal` values — apply `CometChatTheme {}` ONCE at the app root (outside the `NavHost`), NOT per screen; never nest multiple `CometChatTheme {}` wrappers
- Components create their own ViewModels internally — do NOT try to create or inject ViewModels manually
- Style classes use `Companion.default()` factory functions — do NOT use the data class constructor directly (it requires all parameters)
- All style defaults source from `CometChatTheme` tokens — override only what you need via named parameters
