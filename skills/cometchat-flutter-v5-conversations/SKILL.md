---
name: cometchat-flutter-v5-conversations
description: "Use when working with CometChat Flutter UIKit v5 conversation list component. Triggers on CometChatConversations, conversation list, recent chats."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_uikit_shared ^5.2.3"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 conversations list recent chats"
---

# CometChat Flutter UIKit v5 — Conversations

The `CometChatConversations` component displays a list of recent conversations.

## Key Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `conversationsRequestBuilder` | `ConversationsRequestBuilder?` | — | Custom fetch builder |
| `conversationsStyle` | `CometChatConversationsStyle` | `const CometChatConversationsStyle()` | Visual styling |
| `onItemTap` | `Function(Conversation)?` | — | Tap callback (**no BuildContext**) |
| `onItemLongPress` | `Function(Conversation)?` | — | Long press callback |
| `subtitleView` | `Widget? Function(BuildContext, Conversation)?` | — | Custom subtitle |
| `listItemView` | `Widget Function(Conversation)?` | — | Custom list item (replaces the whole row) |
| `leadingView` | `Widget? Function(BuildContext, Conversation)?` | — | Custom leading widget (avatar slot) |
| `titleView` | `Widget? Function(BuildContext, Conversation)?` | — | Custom title widget |
| `trailingView` | `Widget? Function(Conversation)?` | — | Custom trailing widget (single-arg — asymmetric with the other slots) |
| `title` | `String?` | — | List title |
| `showBackButton` | `bool` | `false` | Show back button |
| `onBack` | `VoidCallback?` | — | Back button callback |
| `hideAppbar` | `bool?` | `false` | Hide app bar |
| `appBarOptions` | `List<Widget>?` | — | App bar trailing widgets |
| `usersStatusVisibility` | `bool?` | `true` | Show online status |
| `receiptsVisibility` | `bool?` | `true` | Show read receipts |
| `textFormatters` | `List<CometChatTextFormatter>?` | — | Text formatters for subtitles |
| `controllerTag` | `String?` | — | Custom GetX controller tag |
| `hideSearch` | `bool?` | — | Hide search bar |
| `searchReadOnly` | `bool` | `false` | Read-only search |
| `onSearchTap` | `GestureTapCallback?` | — | Search tap callback |
| `deleteConversationOptionVisibility` | `bool?` | `true` | Show delete option |
| `loadingStateView` | `WidgetBuilder?` | — | Custom loading state |
| `emptyStateView` | `WidgetBuilder?` | — | Custom empty state |
| `errorStateView` | `WidgetBuilder?` | — | Custom error state |
| `setOptions` | `Function?` | — | Replace long-press options |
| `addOptions` | `Function?` | — | Add to long-press options |

## Basic Usage

```dart
CometChatConversations(
  onItemTap: (conversation) {
    User? user;
    Group? group;
    if (conversation.conversationWith is User) {
      user = conversation.conversationWith as User;
    } else {
      group = conversation.conversationWith as Group;
    }
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => MessagesScreen(user: user, group: group),
    ));
  },
)
```

## Custom Request Builder

```dart
CometChatConversations(
  conversationsRequestBuilder: ConversationsRequestBuilder()
    ..limit = 30
    ..conversationType = ConversationType.user,
)
```

## Internal Architecture (GetX)

The component creates `CometChatConversationsController` via `Get.put()` in `initState()` and deletes it in `dispose()` (unless `controllerTag` is provided externally).

Theme values are cached in `didChangeDependencies()` (unconditionally, no flag):
```dart
@override
void didChangeDependencies() {
  typography = CometChatThemeHelper.getTypography(context);
  colorPalette = CometChatThemeHelper.getColorPalette(context);
  spacing = CometChatThemeHelper.getSpacing(context);
  style = CometChatThemeHelper.getTheme<CometChatConversationsStyle>(
      context: context, defaultTheme: CometChatConversationsStyle.of)
    .merge(widget.conversationsStyle);
  super.didChangeDependencies();
}
```

## Anti-Patterns

```dart
// ❌ WRONG — trying to access controller before component mounts
final controller = Get.find<CometChatConversationsController>();

// ❌ WRONG — manually creating controller outside the widget
Get.put(CometChatConversationsController(...));

// ❌ WRONG — not extracting User/Group from conversation
onItemTap: (conversation) {
  Navigator.push(context, MaterialPageRoute(
    builder: (_) => MessagesScreen(user: conversation.conversationWith), // Type error
  ));
}
```

## Checklist — Conversations

- [ ] `onItemTap` extracts `User`/`Group` from `conversation.conversationWith` with type check
- [ ] Navigation to messages screen passes extracted `user` or `group`
- [ ] Let the widget manage its own GetX controller lifecycle
