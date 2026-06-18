---
name: cometchat-flutter-v6-conversations
description: >
  Use when implementing the conversations list with CometChat Flutter UIKit v6.
  Triggers on mentions of CometChatConversations, ConversationsBloc, ConversationsState,
  ConversationsLoaded, ConversationsServiceLocator, conversation list, recent chats,
  unread count, typing indicator in conversations, conversation item, last message,
  delete conversation, swipe actions, ConversationsRequestBuilder, onItemTap,
  subtitleView, trailingView, listItemView, or customizing the conversations screen.
  Also use when the user asks about showing a list of chats or recent conversations.
license: "MIT"
compatibility: "cometchat_chat_uikit ^6.0.1; flutter_bloc ^8.1.0"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter conversations chat-list recent-chats bloc"
---

> **Ground truth:** `cometchat_chat_uikit: ^6.0` — pub-cache source + `ui-kit/flutter`. **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

# CometChat Flutter UIKit — Conversations

The `CometChatConversations` widget displays a list of recent conversations with real-time updates.

## Basic Usage

```dart
CometChatConversations(
  onItemTap: (conversation) {
    final user = conversation.conversationWith is User
        ? conversation.conversationWith as User : null;
    final group = conversation.conversationWith is Group
        ? conversation.conversationWith as Group : null;
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => MessagesScreen(user: user, group: group),
    ));
  },
)
```

## Architecture

```
conversations/                     # Key folders (excerpt)
├── bloc/
│   ├── conversations_bloc.dart    # SDK listeners, real-time updates, O(1) lookups
│   ├── conversations_event.dart   # LoadConversations, DeleteConversation, etc.
│   └── conversations_state.dart   # ConversationsInitial/Loading/Loaded/Empty/Error
├── domain/usecases/               # GetConversationsUseCase, DeleteConversationUseCase, etc.
├── data/                          # Repository + DataSources (remote + local)
├── di/                            # ConversationsServiceLocator (singleton)
├── utils/                         # Helpers (date formatting, last-message preview, etc.)
├── widgets/                       # List item, subtitle, trailing, empty/error/loading views
├── cometchat_conversations.dart   # Public widget entry point
└── cometchat_conversations_style.dart  # Style class
```

## State Classes

```dart
ConversationsInitial    // Before any data loaded
ConversationsLoading    // Fetching initial list
ConversationsLoaded     // Has data: conversations, hasMore, selectedConversations, isLoadingMore
ConversationsEmpty      // No conversations exist
ConversationsError      // Error with message + optional previousConversations
```

`ConversationsLoaded` uses a monotonically increasing `_version` counter to guarantee unique emissions even when conversation IDs haven't changed (SDK's `Conversation.==` only compares `conversationId`).

## Key Events

| Event | Purpose |
|-------|---------|
| `LoadConversations({silent})` | Initial load. `silent: true` keeps existing list visible during refresh. |
| `LoadMoreConversations` | Pagination (scroll to bottom) |
| `DeleteConversation(id)` | Calls SDK to delete |
| `RemoveConversation(id)` | Remove from list without SDK call (e.g., after group kick) |
| `SetActiveConversation(id)` | Track which conversation is open |
| `UpdateConversation({required conversationId, required updatedConversation, forceUpdate})` | Update a specific conversation's data. `forceUpdate` defaults to `true`. **Named params — positional form will not compile.** |
| `ResetUnreadCount(id)` | Clear unread badge when user reads messages |
| `RefreshConversations` | Re-fetch the list from the SDK (e.g., after a manual refresh gesture) |
| `ToggleConversationSelection(id)` | Add/remove a conversation from the multi-select set |
| `ClearConversationSelection` | Exit multi-select mode and clear selection |

## Real-Time Features

The BLoC automatically registers SDK listeners for:
- New messages → updates last message + moves conversation to top
- Typing indicators → per-conversation `ValueNotifier<List<TypingIndicator>>`
- User presence → online/offline status
- Read/delivery receipts → receipt icons
- Group events → member join/leave/kick/ban
- Connection state → reconnect triggers silent refresh

### Typing Indicators (ValueNotifier Pattern)

```dart
// In your custom list item, use ValueListenableBuilder for isolated rebuilds:
ValueListenableBuilder<List<TypingIndicator>>(
  valueListenable: conversationsBloc.getTypingNotifier(conversation.conversationId!),
  builder: (context, typingList, child) {
    if (typingList.isEmpty) return _buildLastMessage();
    return Text('${typingList.first.sender?.name} is typing...');
  },
)
```

## Customization — View Slots

```dart
CometChatConversations(
  // Replace entire list item
  listItemView: (conversation) => MyCustomListItem(conversation),

  // Replace just the subtitle — two-arg builder (BuildContext, Conversation)
  subtitleView: (context, conversation) => Text(conversation.lastMessage?.text ?? ''),

  // Replace trailing (time + badge) — SINGLE-arg builder. Note the asymmetry:
  // subtitleView/leadingView/titleView take (BuildContext, Conversation),
  // but trailingView takes just (Conversation).
  trailingView: (conversation) => MyTrailingWidget(conversation),

  // Style overrides
  conversationsStyle: CometChatConversationsStyle(
    backgroundColor: colors.background1,
    titleTextStyle: typography.heading3?.bold,
  ),

  // Configuration (all bool? — defaults supplied if null)
  usersStatusVisibility: true,
  receiptsVisibility: true,
  deleteConversationOptionVisibility: true,
  hideAppbar: false,
  showBackButton: true,

  // Callbacks — onBack is REQUIRED when showBackButton: true, otherwise the button is a no-op
  onBack: () => Navigator.of(context).maybePop(),

  // Error callback — OnError typedef is `Function(Exception e)`
  // Pair with hideError / errorStateView if you want to suppress or replace the in-widget error view.
  onError: (Exception e) => ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text('Failed to load conversations: $e')),
  ),

  // Other widget callbacks: onItemLongPress, onSelection, onEmpty, onLoad

  // Text formatters for subtitle preview
  textFormatters: [
    CometChatMentionsFormatter(),
    MarkdownTextFormatter(),
  ],
)
```

## Custom ConversationsRequest

```dart
CometChatConversations(
  conversationsRequestBuilder: ConversationsRequestBuilder()
    ..limit = 30
    ..conversationType = 'user'  // Only 1:1 chats
    ..withTags = true
    ..tags = ['important'],
)
```

## Gotchas

- `ConversationsLoaded` uses a `_version` counter because SDK's `Conversation.==` only compares `conversationId`. Without it, BLoC considers two lists with same IDs as equal even when `lastMessage` or `unreadMessageCount` changed, and skips the emission.
- The BLoC uses `_conversationIndexMap` for O(1) lookups. If you maintain your own list outside the BLoC, keep a parallel Map for performance.
- `silent: true` on `LoadConversations` keeps the existing list visible during refresh — use this for background→foreground and reconnect scenarios, not initial load.
- Typing indicators use `ValueNotifier` per conversation, NOT BLoC state. This prevents the entire list from rebuilding when one person types.

## Anti-Patterns

```dart
// ❌ WRONG — navigating with raw conversation object
onItemTap: (conv) => Navigator.push(context, MaterialPageRoute(
  builder: (_) => MessagesScreen(conversation: conv), // MessagesScreen expects user OR group
))

// ✅ CORRECT — extract user/group from conversation
onItemTap: (conv) {
  final user = conv.conversationWith is User ? conv.conversationWith as User : null;
  final group = conv.conversationWith is Group ? conv.conversationWith as Group : null;
  Navigator.push(context, MaterialPageRoute(
    builder: (_) => MessagesScreen(user: user, group: group),
  ));
}
```

```dart
// ⚠️ The ServiceLocator is auto-initialized on first use, but calling
// setup() explicitly in main.dart before runApp() is the documented contract
// and surfaces any init failures early.

// ✅ RECOMMENDED — explicit setup, then construct
ConversationsServiceLocator.instance.setup();
final bloc = ConversationsBloc(
  // Minimal example — the constructor also accepts:
  //   getConversationsUseCase, loadMoreConversationsUseCase,
  //   disableSDKListeners, conversationsRequestBuilder,
  //   usersStatusVisibility, receiptsVisibility, includeBlockedUsers,
  //   visibleItemThreshold, disableSoundForMessages, customSoundForMessages,
  //   conversationsProtocol — all optional.
  getLoggedInUserUseCase: ConversationsServiceLocator.instance.getLoggedInUserUseCase,
  getConversationUseCase: ConversationsServiceLocator.instance.getConversationUseCase,
  markAsDeliveredUseCase: ConversationsServiceLocator.instance.markAsDeliveredUseCase,
  deleteConversationUseCase: ConversationsServiceLocator.instance.deleteConversationUseCase,
);
```

```dart
// ❌ WRONG — rebuilding entire list for typing indicator
BlocBuilder<ConversationsBloc, ConversationsState>(
  builder: (context, state) {
    // This rebuilds ALL items when ANY state changes
  },
)

// ✅ CORRECT — use ValueListenableBuilder per item
ValueListenableBuilder<List<TypingIndicator>>(
  valueListenable: bloc.getTypingNotifier(conversationId),
  builder: (_, typingList, __) { /* Only this item rebuilds */ },
)
```

## Checklist

- [ ] `onItemTap` extracts `User`/`Group` from `conversation.conversationWith`
- [ ] `onBack` wired when `showBackButton: true` (otherwise the back button is a no-op)
- [ ] `onError` callback (or `errorStateView` / `hideError`) wired so widget errors surface to users
- [ ] `subscriptionType` set in UIKitSettings (required for real-time updates)
- [ ] Typing indicators use `ValueListenableBuilder`, not BLoC state
- [ ] Custom list items use `CometChatThemeHelper` for colors
- [ ] Text formatters passed if using mentions or markdown in subtitle preview
- [ ] `deleteConversationOptionVisibility` set based on app requirements
- [ ] `UpdateConversation` dispatched with **named** params (`conversationId`, `updatedConversation`) — positional form will not compile
