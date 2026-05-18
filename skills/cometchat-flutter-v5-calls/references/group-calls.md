# Group calls — broadcast meeting pattern (Flutter V5)

Group calls use a **different signaling channel than 1:1 user calls**. The Ringing flow (`CometChat.initiateCall` → `onIncomingCallReceived` on peer) is **1:1 user only**. For groups, the kit broadcasts a **custom message of type `"meeting"`** to the group; receivers see a "Join meeting" card in `CometChatMessageList` (kit) or need an explicit `MessageListener.onCustomMessageReceived` (custom UI).

By-design kit behavior — same semantic across all CometChat kits.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/group-calls

V5 specifics: Flutter V5 uses `cometchat_chat_uikit ^5.2` + `cometchat_calls_uikit ^5.0` (separate calls package). GetX-based state. The signaling semantic below is identical to Flutter V6.

---

## Architecture

```
Caller (uidA, member of groupX)        CometChat                Receivers (members of groupX)
  │                                       │                              │
  │ CometChatCallButtons sends            │                              │
  │ CustomMessage(GUID, GROUP, "meeting", │                              │
  │   { callType, sessionId })            │                              │
  ├──────────────────────────────────────>│                              │
  │                                       │ onCustomMessageReceived      │
  │                                       ├─────────────────────────────>│
  │ caller pushes OngoingCallScreen       │  receiver taps Join          │
  │  with sessionID = groupGuid           │  → CometChatUIKitCalls       │
  │                                       │    .startSession(...)        │
  ├──────────────────────────────────────>│ <─────────────────────────── │
  │            ───── WebRTC session active (sessionId = group GUID) ─────│
```

| Channel | 1:1 user calls | Group calls |
|---|---|---|
| Signaling | `CometChat.initiateCall(call, callback)` | `CometChat.sendCustomMessage(message, callback)` (type="meeting") |
| Receiver event | `CallListener.onIncomingCallReceived` | `MessageListener.onCustomMessageReceived` |
| Session ID | server-generated unique | group's GUID (persistent) |
| Ring/decline | yes — `acceptCall` / `rejectCall` | no — receivers join or ignore |

---

## Hard rules

1. **Group calls broadcast a custom message; they do NOT use the call listener.** Custom UI must add a `MessageListener`.
2. **Session ID = group GUID.** Persistent.
3. **`CometChatUIKitCalls.init()` must complete AFTER `CometChatUIKit.init()`** (CALLS_INIT_AFTER_CHAT_INIT rule from SKILL.md) — same as 1:1.
4. **No `CometChat.endCall` for groups.** Use `CometChatUIKitCalls.endSession()` only.

---

## Caller side — kit-based

```dart
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

// Inside a chat surface (e.g. inside CometChatMessageHeader):
CometChatCallButtons(
  group: group,
)
```

Tap → kit sends meeting `CustomMessage` + pushes outgoing-call screen → transitions to ongoing call with `sessionId = group.guid`.

## Caller side — custom UI

```dart
import 'package:flutter_chat_sdk/flutter_chat_sdk.dart';

Future<void> startGroupCall(String groupGuid, String callType) async {
  final sessionId = groupGuid;
  final customData = {'callType': callType, 'sessionId': sessionId};

  final meetingMessage = CustomMessage(
    receiverUid: groupGuid,
    receiverType: CometChatReceiverType.group,
    customData: customData,
    type: 'meeting',
  )
    ..category = MessageCategoryConstants.custom
    ..metadata = {
      'incrementUnreadCount': true,
      'pushNotification': 'meeting',
      ...customData,
    };

  await CometChat.sendCustomMessage(
    meetingMessage,
    onSuccess: (msg) {
      // Navigate to OngoingCall screen with sessionId
      Navigator.of(context).pushNamed('/ongoing-call', arguments: {
        'sessionId': sessionId,
        'callType': callType,
      });
    },
    onError: (e) {/* surface error */},
  );
}
```

---

## Receiver side — kit-based

`CometChatMessageList(group: group)` auto-renders the meeting message as a "Join meeting" card. Tap → kit calls `generateToken` and pushes the ongoing-call screen with `sessionId = group.guid`.

## Receiver side — custom UI

```dart
import 'package:flutter_chat_sdk/flutter_chat_sdk.dart';

const groupMeetingListenerId = 'APP_ROOT_GROUP_MEETING_LISTENER';

void registerGroupMeetingListener() {
  CometChat.addMessageListener(
    groupMeetingListenerId,
    MessageListener(
      onCustomMessageReceived: (msg) {
        if (msg.category != MessageCategoryConstants.custom) return;
        if (msg.type != 'meeting') return;

        final customData = msg.customData ?? {};
        final sessionId = customData['sessionId'] as String? ?? msg.receiverUid;
        final callType = customData['callType'] as String? ?? 'video';
        final fromUid = msg.sender?.uid;
        final groupGuid = msg.receiverUid;

        // Update your state (GetX controller, Provider, Riverpod):
        // Get.find<CallController>().receiveIncomingMeeting(
        //   sessionId: sessionId, callType: callType, fromUid: fromUid, groupGuid: groupGuid,
        // );
      },
    ),
  );
}

void unregisterGroupMeetingListener() {
  CometChat.removeMessageListener(groupMeetingListenerId);
}
```

Wire register in `initState` / GetX controller `onInit`, unregister in `dispose` / `onClose`. Register AFTER `CometChatUIKit.login()` succeeds.

---

## Edge cases

### Late joining

Meeting persists in chat. Tap any time to join the live session.

### Push notifications (FCM Android, APNs / VoIP iOS)

Meeting `CustomMessage.metadata.pushNotification = "meeting"` — delivered as regular FCM/APNs notification. To get CallKit (iOS) or ConnectionService (Android) ringing for meetings, intercept the push payload and route to `flutter_callkit_incoming` manually. Not auto-wired.

### `navigatorKey` requirement (V5 too)

If you use the kit's outgoing-call screen for groups, ensure `MaterialApp` has `navigatorKey: CallNavigationContext.navigatorKey` — same requirement as 1:1 (rule 1.7 in SKILL.md).

---

## Anti-patterns

1. **Only `CometChat.addCallListener` registered, expecting group calls to ring.** Add `addMessageListener` too.
2. **`CometChat.endCall(sessionId)` after a group hangup.** No call entity exists.
3. **Treating sessionId as ephemeral.** It IS the group's GUID.
4. **Registering `MessageListener` before login.** Listeners registered pre-login are silently dropped. Wire AFTER `CometChatUIKit.login` completes.
5. **Skipping the `navigatorKey` for the meeting flow.** Same context-navigation requirement as 1:1.

---

## Verification checklist

- [ ] If using kit caller: `CometChatCallButtons(group: group)` tap initiates meeting message
- [ ] If using custom caller: `CometChat.sendCustomMessage` called with `type: 'meeting'`, `category: MessageCategoryConstants.custom`, `customData: {callType, sessionId}`, `metadata: { pushNotification: 'meeting' }`
- [ ] If using kit receiver: `CometChatMessageList(group: group)` renders meeting card
- [ ] If using custom receiver: `CometChat.addMessageListener` registered with category+type filter, AFTER login
- [ ] `MaterialApp.navigatorKey = CallNavigationContext.navigatorKey` set (kit-driven UI path)
- [ ] On hangup: `CometChatUIKitCalls.endSession()` only (no `CometChat.endCall`)
- [ ] Late-joining tested
- [ ] Push notifications fire for offline members

---

## Pointers

- `ringing-integration.md` — 1:1 user calls (different signaling channel)
- `cometchat-flutter-v5-calls/SKILL.md` — V5 hard rules (cometchat_calls_uikit peer, Jetifier, etc.)
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/group-calls
- Cross-platform reference (semantic ground-truth): `cometchat-react-calls/references/group-calls.md`
