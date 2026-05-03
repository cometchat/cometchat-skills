---
name: cometchat-flutter-v5-events
description: "Use when working with CometChat Flutter UIKit v5 event system. Triggers on CometChatMessageEvents, CometChatUserEvents, CometChatGroupEvents, CometChatCallEvents, CometChatUIEvents, listeners."
license: "MIT"
compatibility: "cometchat_uikit_shared ^5.2.3; cometchat_sdk ^4.1.2"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 events listeners real-time typing receipts"
---

# CometChat Flutter UIKit v5 — Events

Two layers: SDK listeners (low-level) and UIKit events (high-level component coordination).

## Event System Architecture

### Layer 1: SDK Listeners (CometChat SDK)
Raw message/call/user/group events from the network.

### Layer 2: UIKit Events (CometChat UIKit)
High-level events emitted by UIKit components for UI coordination. Use a static `Map<String, Listener>` pattern.

## Listener Registration Pattern

All event classes follow the same register/remove pattern:

```dart
// ✅ CORRECT — register in initState, remove in dispose
class _MyWidgetState extends State<MyWidget> {
  late final String _listenerId;

  @override
  void initState() {
    super.initState();
    _listenerId = 'my_widget_${DateTime.now().millisecondsSinceEpoch}';

    // UIKit events
    CometChatMessageEvents.addMessagesListener(_listenerId, this);
    CometChatUIEvents.addUiListener(_listenerId, this);

    // SDK listeners
    CometChat.addMessageListener(_listenerId, this);
    CometChat.addUserListener(_listenerId, this);
    CometChat.addGroupListener(_listenerId, this);
    CometChat.addCallListener(_listenerId, this);
  }

  @override
  void dispose() {
    CometChatMessageEvents.removeMessagesListener(_listenerId);
    CometChatUIEvents.removeUiListener(_listenerId);
    CometChat.removeMessageListener(_listenerId);
    CometChat.removeUserListener(_listenerId);
    CometChat.removeGroupListener(_listenerId);
    CometChat.removeCallListener(_listenerId);
    super.dispose();
  }
}
```

For GetxController, use `onInit()` / `onClose()` instead of `initState()` / `dispose()`.

## UIKit Event Classes — Registration

| Class | Register | Remove |
|-------|----------|--------|
| `CometChatMessageEvents` | `addMessagesListener(id, listener)` | `removeMessagesListener(id)` |
| `CometChatUserEvents` | `addUsersListener(id, listener)` | `removeUsersListener(id)` |
| `CometChatGroupEvents` | `addGroupsListener(id, listener)` | `removeGroupsListener(id)` |
| `CometChatCallEvents` | `addCallEventsListener(id, listener)` | `removeCallEventsListener(id)` |
| `CometChatUIEvents` | `addUiListener(id, listener)` | `removeUiListener(id)` |
| `CometChatConversationEvents` | `addConversationListListener(id, listener)` | `removeConversationListListener(id)` |

## SDK Listeners — Registration

| Listener | Register | Remove |
|----------|----------|--------|
| Messages | `CometChat.addMessageListener(id, this)` | `CometChat.removeMessageListener(id)` |
| Users (online/offline) | `CometChat.addUserListener(id, this)` | `CometChat.removeUserListener(id)` |
| Groups | `CometChat.addGroupListener(id, this)` | `CometChat.removeGroupListener(id)` |
| Calls | `CometChat.addCallListener(id, this)` | `CometChat.removeCallListener(id)` |
| Connection | `CometChat.addConnectionListener(id, this)` | `CometChat.removeConnectionListener(id)` |

## Key UIKit Events (commonly used)

**CometChatUIEvents:**
- `openChat(User? user, Group? group)` — request to open a chat

**CometChatMessageEvents:**
- `ccMessageSent(BaseMessage message, MessageStatus status)` — message sent
- `ccMessageEdited(BaseMessage message, MessageEditStatus status)` — message edited
- `ccMessageDeleted(BaseMessage message, EventStatus status)` — message deleted

**CometChatUserEvents:**
- `ccUserBlocked(User user)` / `ccUserUnblocked(User user)`

**CometChatGroupEvents:**
- `ccGroupMemberKicked`, `ccGroupMemberBanned`, `ccGroupMemberAdded`, `ccOwnershipChanged`

**CometChatCallEvents:**
- `ccOutgoingCall(Call)`, `ccCallAccepted(Call)`, `ccCallRejected(Call)`, `ccCallEnded(Call)`

## UIKit Events vs SDK Listeners

- **UIKit events** — react to UIKit-level actions (message sent via composer, group created via UI, user blocked via UI)
- **SDK listeners** — raw network events (message received, user online/offline, group member joined)
- UIKit components internally use both

## Gotchas

### Unique Listener IDs
```dart
// ❌ WRONG — hardcoded ID
CometChat.addMessageListener('messages', this);

// ✅ CORRECT — unique ID
final id = 'messages_${DateTime.now().millisecondsSinceEpoch}';
CometChat.addMessageListener(id, this);
```

### Always Remove in dispose()
```dart
// ❌ WRONG — listener leaks
@override
void dispose() {
  super.dispose();
}

// ✅ CORRECT
@override
void dispose() {
  CometChat.removeMessageListener(_listenerId);
  super.dispose();
}
```

### Never Register in build()
```dart
// ❌ WRONG — called every rebuild
@override
Widget build(BuildContext context) {
  CometChat.addMessageListener(id, this);
  return Container();
}
```

## Checklist — Events

- [ ] Listener ID is unique (use timestamp or hashCode)
- [ ] Listener registered in `initState()` / `onInit()`, not `build()`
- [ ] Listener removed in `dispose()` / `onClose()` with same ID
- [ ] UIKit events for UI coordination, SDK listeners for raw events
- [ ] `subscriptionType` set in UIKitSettings for presence events to work
