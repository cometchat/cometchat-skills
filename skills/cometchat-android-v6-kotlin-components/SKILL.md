---
name: cometchat-android-v6-kotlin-components
description: "CometChat Android UIKit v6 Kotlin Views component catalog — all custom View chat UI components, their properties, styles, and usage"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.1"
  tags: "cometchat, android, kotlin-views, components, conversations, messages, users, groups, calls"
---

> **Companion skills:** cometchat-android-v6-compose-components (Compose equivalent), cometchat-android-v6-kotlin-theming, cometchat-android-v6-kotlin-customization, cometchat-android-v6-kotlin-placement

## Purpose

Complete catalog of all Kotlin Views components in CometChat UIKit v6. Each component is a custom `View` class in `com.cometchat.uikit.kotlin.presentation`.

## Use this skill when

- Adding a CometChat Views component to an Activity or Fragment
- Looking up component properties and methods
- Understanding which component to use for a specific chat feature
- Finding the style class for a component

## Do not use this skill when

- Working with Compose components (use `cometchat-android-v6-compose-components`)
- Customizing bubble rendering (use `cometchat-android-v6-kotlin-customization`)
- Placing components in navigation (use `cometchat-android-v6-kotlin-placement`)

## 1. Component Catalog

### 1.1 List Components

| Component | Package | Type | Purpose |
|---|---|---|---|
| `CometChatConversations` | `presentation.conversations.ui` | View | Recent conversations list |
| `CometChatUsers` | `presentation.users.ui` | View | User list |
| `CometChatGroups` | `presentation.groups.ui` | View | Group list |
| `CometChatGroupMembers` | `presentation.groupmembers.ui` | View | Members of a group |
| `CometChatCallLogs` | `presentation.calllogs.ui` | View | Call history |

### 1.2 Messaging Components

| Component | Package | Type | Purpose |
|---|---|---|---|
| `CometChatMessageList` | `presentation.messagelist.ui` | View | Message list with bubbles |
| `CometChatMessageComposer` | `presentation.messagecomposer.ui` | View | Message input with attachments |
| `CometChatMessageHeader` | `presentation.messageheader.ui` | View | Chat header (name, status, actions) |
| `CometChatMessageInformation` | `presentation.messageinformation.ui` | View | Message delivery/read info |
| `CometChatThreadHeader` | `presentation.threadheader.ui` | View | Thread parent message header |

### 1.3 Call Components

| Component | Package | Type | Purpose |
|---|---|---|---|
| `CometChatCallButtons` | `presentation.callbuttons` | View | Audio/video call buttons |
| `CometChatIncomingCall` | `presentation.incomingcall` | View | Incoming call screen |
| `CometChatOutgoingCall` | `presentation.outgoingcall` | View | Outgoing call screen |
| `CometChatOngoingCall` | `presentation.ongoingcall.ui` | View | Active call screen |
| `CometChatCallActivity` | `calls` | Activity | Activity wrapper for calls |

### 1.4 Utility Components

| Component | Package | Type | Purpose |
|---|---|---|---|
| `CometChatSearch` | `presentation.search.ui` | View | Global search |
| `CometChatReactionList` | `presentation.reactionlist.ui` | View | Reaction details |
| `CometChatEmojiKeyboard` | `presentation.emojikeyboard.ui` | View | Emoji picker |
| `CometChatStickerKeyboard` | `presentation.stickerkeyboard.ui` | View | Sticker picker |
| `CometChatFlagMessageDialog` | `presentation.report` | Dialog | Report/flag message |

### 1.5 Shared Elements

Located in `presentation.shared/`:

- AI features: `aiconversationstarter/`, `aiconversationsummary/`, `aismartreplies/`
- Base elements: `baseelements/`
- Message bubble: `messagebubble/` (BubbleFactory, CometChatMessageBubble, InternalContentRenderer)
- Dialog: `dialog/`
- Media: `mediarecorder/`, `mediaselection/`, `mediaviewer/`, `inlineaudiorecorder/`
- Message preview: `messagepreview/`
- Moderation: `moderation/`
- Permissions: `permission/`
- Popup menu: `popupmenu/`
- Reactions: `reaction/`
- Receipts: `receipts/`
- Search box: `searchbox/`
- Shimmer: `shimmer/`
- Status indicator: `statusindicator/`
- Suggestion list: `suggestionlist/`
- Toolbar: `toolbar/`
- Typing indicator: `typingindicator/`

### 1.6 Adapters

List components use RecyclerView adapters:

| Adapter | Component |
|---|---|
| `ConversationsAdapter` | `CometChatConversations` |
| `MessageAdapter` | `CometChatMessageList` |
| Group/User adapters in respective packages | `CometChatGroups`, `CometChatUsers` |

## 2. Basic Usage Examples

### 2.1 Conversations List in an Activity

```kotlin
import com.cometchat.uikit.kotlin.presentation.conversations.ui.CometChatConversations

class ConversationsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val conversations = CometChatConversations(this)
        conversations.setOnItemClick { conversation ->
            // Navigate to chat
        }
        setContentView(conversations)
    }
}
```

### 2.2 Message List in XML Layout

```xml
<com.cometchat.uikit.kotlin.presentation.messagelist.ui.CometChatMessageList
    android:id="@+id/messageList"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1" />
```

```kotlin
val messageList = findViewById<CometChatMessageList>(R.id.messageList)
messageList.setUser(user)
```

### 2.3 Users List

```kotlin
val users = CometChatUsers(this)
users.setOnItemClick { user ->
    // Navigate to chat with user
}
setContentView(users)
```

### 2.4 Full Chat Screen

```kotlin
class MessagesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_messages)

        val header = findViewById<CometChatMessageHeader>(R.id.messageHeader)
        val messageList = findViewById<CometChatMessageList>(R.id.messageList)
        val composer = findViewById<CometChatMessageComposer>(R.id.messageComposer)

        header.setUser(user)
        messageList.setUser(user)
        composer.setUser(user)
    }
}
```

## 3. Style Classes

Every component has a corresponding style class in its `style/` subpackage:

| Component | Style Class |
|---|---|
| `CometChatConversations` | `CometChatConversationsStyle` |
| `CometChatUsers` | `CometChatUsersStyle` |
| `CometChatGroups` | `CometChatGroupsStyle` |
| `CometChatGroupMembers` | `CometChatGroupMembersStyle` |
| `CometChatMessageList` | `CometChatMessageListStyle` |
| `CometChatMessageComposer` | `CometChatMessageComposerStyle` |
| `CometChatMessageHeader` | `CometChatMessageHeaderStyle` |
| `CometChatCallLogs` | `CometChatCallLogsStyle` |
| `CometChatThreadHeader` | `CometChatThreadHeaderStyle` |

Style classes resolve defaults from XML theme attributes and `CometChatTheme` singleton.

## 4. ViewModel Integration

Each component creates its own ViewModel internally via factories from `chatuikit-core`. ViewModels are shared with the Compose stack — the same `CometChatConversationsViewModel` powers both `CometChatConversations` (View) and `CometChatConversations` (@Composable).

## Hard rules

- Activity theme MUST inherit from `CometChatTheme.DayNight` (or `.Light` / `.Dark`) — `Theme.AppCompat.*`, `Theme.MaterialComponents.*.Bridge`, plain `Theme.MaterialComponents.*`, and `Theme.Material3.*` all crash at component inflation. See `cometchat-android-v6-kotlin-placement` "Activity theme" section.
- Components create their own ViewModels internally — do NOT try to create or inject ViewModels manually
- Use `setUser(user)` or `setGroup(group)` to configure messaging components — they need a target to load messages
- For bubble customization, use `setBubbleFactories()` and `set*ViewProvider()` — see `cometchat-android-v6-kotlin-customization`
