# Group calls — broadcast meeting pattern (Flutter V5)

Group calls use a **different signaling channel than 1:1 user calls**. The Ringing flow (`CometChat.initiateCall` → `onIncomingCallReceived` on peer) is **1:1 user only**. For groups, broadcast a **custom message of type `"meeting"`** to the group; receivers handle it via `MessageListener.onCustomMessageReceived` and join the WebRTC session whose `sessionId = group GUID`.

By-design signaling semantic — same across all CometChat kits.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/group-calls

V5 specifics: Flutter V5 uses `cometchat_chat_uikit ^5.2` (GetX chat kit) + the **raw `cometchat_calls_sdk ^5.0.2`** (direct dependency) — you build a custom meeting/ongoing-call surface. The signaling semantic below is identical to Flutter V6.

---

## Architecture

```
Caller (uidA, member of groupX)        CometChat                Receivers (members of groupX)
  │                                       │                              │
  │ sendCustomMessage(GUID, GROUP,        │                              │
  │   "meeting", { callType, sessionId }) │                              │
  ├──────────────────────────────────────>│                              │
  │                                       │ onCustomMessageReceived      │
  │                                       ├─────────────────────────────>│
  │ caller pushes OngoingCallScreen       │  receiver taps Join          │
  │  with sessionID = groupGuid           │  → CometChatCalls            │
  │                                       │    .joinSession(...)         │
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

1. **Group calls broadcast a custom message; they do NOT use the call listener.** Add a `MessageListener`.
2. **Session ID = group GUID.** Persistent.
3. **`CometChatCalls.init()` must complete AFTER `CometChatUIKit.init()`** (CALLS_INIT_AFTER_CHAT_INIT rule from SKILL.md) — same as 1:1.
4. **No `CometChat.endCall` for groups.** Use `CallSession.getInstance()?.leaveSession()` only.

---

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

On Join tap, join the WebRTC session with the group GUID as the sessionId (5.x raw SDK):

```dart
CometChatCalls.joinSession(            // cometchatcalls.dart:735
  sessionId: groupGuid,                // sessionId == group GUID
  sessionSettings: (SessionSettingsBuilder()..setTitle('Meeting')).build(),
  onSuccess: (Widget? widget) { /* render via SizedBox.expand */ },
  onError: (CometChatCallsException e) { /* surface */ },
);
```

> **Legacy 4.x-kit alternative (incompatible with the 5.x calls SDK).** The old `cometchat_calls_uikit` path used `CometChatCallButtons(group: group)` for the caller, auto-rendered the meeting card in `CometChatMessageList(group: group)`, and joined via `CometChatUIKitCalls.startSession`. Those widgets are 4.x-bound and cannot run against `cometchat_calls_sdk ^5.0.2` — replicate with the custom-message + `joinSession` flow above.

---

## Edge cases

### Late joining

Meeting persists in chat. Tap any time to join the live session.

### Push notifications (FCM Android, APNs / VoIP iOS)

Meeting `CustomMessage.metadata.pushNotification = "meeting"` — delivered as regular FCM/APNs notification. To get CallKit (iOS) or ConnectionService (Android) ringing for meetings, intercept the push payload and route to `flutter_callkit_incoming` manually. Not auto-wired.

### `navigatorKey` requirement (V5 too)

Set `MaterialApp.navigatorKey` to a plain `GlobalKey<NavigatorState>` so the meeting flow can navigate from anywhere — same requirement as 1:1 (rule 1.7 in SKILL.md). (Do NOT use `CallNavigationContext.navigatorKey` — that is a 4.x-kit symbol.)

---

## Anti-patterns

1. **Only `CometChat.addCallListener` registered, expecting group calls to ring.** Add `addMessageListener` too.
2. **`CometChat.endCall(sessionId)` after a group hangup.** No call entity exists.
3. **Treating sessionId as ephemeral.** It IS the group's GUID.
4. **Registering `MessageListener` before login.** Listeners registered pre-login are silently dropped. Wire AFTER `CometChatUIKit.login` completes.
5. **Skipping the `navigatorKey` for the meeting flow.** Same context-navigation requirement as 1:1.

---

## Verification checklist

- [ ] Caller: `CometChat.sendCustomMessage` called with `type: 'meeting'`, `category: MessageCategoryConstants.custom`, `customData: {callType, sessionId}`, `metadata: { pushNotification: 'meeting' }`
- [ ] Receiver: `CometChat.addMessageListener` registered with category+type filter, AFTER login
- [ ] Join action calls `CometChatCalls.joinSession(sessionId: groupGuid, ...)`
- [ ] `MaterialApp.navigatorKey` is a `GlobalKey<NavigatorState>`
- [ ] On hangup: `CallSession.getInstance()?.leaveSession()` only (no `CometChat.endCall`)
- [ ] Late-joining tested
- [ ] Push notifications fire for offline members

---

## Pointers

- `ringing-integration.md` — 1:1 user calls (different signaling channel)
- `cometchat-flutter-v5-calls/SKILL.md` — V5 hard rules (raw `cometchat_calls_sdk ^5.0.2`, Jetifier, etc.)
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/group-calls
- Cross-platform reference (semantic ground-truth): `cometchat-react-calls/references/group-calls.md`
