# Group calls — broadcast meeting pattern (Flutter V6)

Group calls use a **different signaling channel than 1:1 user calls**. The Ringing flow (`CometChat.initiateCall` → `onIncomingCallReceived` on peer) is **1:1 user only**. For groups, the kit broadcasts a **custom message of type `"meeting"`** to the group; receivers see a "Join meeting" card in `CometChatMessageList` (kit) or need an explicit `MessageListener.onCustomMessageReceived` (custom UI).

By-design kit behavior — same semantic across all CometChat kits.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/group-calls

V6 specifics: Flutter V6 folds calls into `cometchat_chat_uikit ^6.0.0-beta2` (no separate calls package). Bloc-based state. **At v6.0.0-beta2, the outgoing-call → in-call transition is broken for 1:1 calls** (vendor bug — see SKILL.md §1.7); this affects group meetings too if customers use the kit's outgoing-call UI. The custom-UI approach is more reliable on V6 today.

---

## Architecture

```
Caller (uidA, member of groupX)        CometChat                Receivers (members of groupX)
  │                                       │                              │
  │ CometChatCallButtons / custom code    │                              │
  │ sends CustomMessage(GUID, GROUP,      │                              │
  │   "meeting", { callType, sessionId }) │                              │
  ├──────────────────────────────────────>│                              │
  │                                       │ onCustomMessageReceived      │
  │                                       ├─────────────────────────────>│
  │ caller pushes OngoingCall screen      │  receiver taps Join          │
  │  with sessionID = groupGuid           │  → joinSession(GUID)         │
  ├──────────────────────────────────────>│ <─────────────────────────── │
  │            ───── WebRTC session active (sessionId = group GUID) ─────│
```

| Channel | 1:1 user calls | Group calls |
|---|---|---|
| Signaling | `CometChat.initiateCall(call, callback)` | `CometChat.sendCustomMessage(message, callback)` (type="meeting") |
| Receiver event | `CallListener.onIncomingCallReceived` | `MessageListener.onCustomMessageReceived` |
| Session ID | server-generated unique | group's GUID (persistent) |

---

## Hard rules

1. **Group calls broadcast a custom message; they do NOT use the call listener.** Custom UI must add a `MessageListener`.
2. **Session ID = group GUID.** Persistent.
3. **V6 vendor bug applies to groups too** (SKILL.md §1.7) — kit's outgoing-call screen does not reliably transition to ongoing-call surface. Prefer custom UI for groups on v6.0.0-beta2.
4. **`navigatorKey: CallNavigationContext.navigatorKey` required on MaterialApp** if using ANY kit-driven call UI path (group or 1:1) — same as the SKILL rule.
5. **No `CometChat.endCall` for groups.** Use `CometChatUIKitCalls.endSession()` only.

---

## Caller side — kit-based

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

CometChatCallButtons(
  group: group,
)
```

Tap → kit sends meeting `CustomMessage` + opens outgoing-call screen.

> **⚠️ At v6.0.0-beta2, the outgoing→in-call transition is broken** (vendor — SKILL §1.7). Caller may see "Calling..." indefinitely after kit-driven group call. **Workaround**: use the custom-UI path below until vendor fix lands.

## Caller side — custom UI (RECOMMENDED on v6.0.0-beta2)

```dart
import 'package:flutter_chat_sdk/flutter_chat_sdk.dart';

Future<void> startGroupCall(BuildContext context, String groupGuid, String callType) async {
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
      // Caller navigates to YOUR OngoingCall screen (not the kit's)
      Navigator.of(context).pushNamed('/ongoing-call', arguments: {
        'sessionId': sessionId,
        'callType': callType,
      });
    },
    onError: (e) {/* surface error */},
  );
}
```

Then in your custom `/ongoing-call` screen, call `CometChatUIKitCalls.startSession(callToken, callSettings, ...)` against your own RTC view — same primitives the kit uses internally, but you control the navigation.

---

## Receiver side — kit-based

`CometChatMessageList(group: group)` (or whichever message-list widget V6 ships) auto-renders the meeting message as a "Join meeting" card. Tap → kit calls `generateToken` + pushes the ongoing-call screen.

> Same v6.0.0-beta2 caveat applies — if the kit's ongoing-call transition is broken, receivers may also see "Connecting…" indefinitely. Prefer custom join flow.

## Receiver side — custom UI (RECOMMENDED)

```dart
import 'package:flutter_chat_sdk/flutter_chat_sdk.dart';

const groupMeetingListenerId = 'APP_ROOT_GROUP_MEETING_LISTENER';

class MeetingListener {
  void register({required void Function(IncomingMeetingInfo) onIncoming}) {
    CometChat.addMessageListener(
      groupMeetingListenerId,
      MessageListener(
        onCustomMessageReceived: (msg) {
          if (msg.category != MessageCategoryConstants.custom) return;
          if (msg.type != 'meeting') return;

          final customData = msg.customData ?? {};
          onIncoming(IncomingMeetingInfo(
            sessionId: customData['sessionId'] as String? ?? msg.receiverUid,
            callType: customData['callType'] as String? ?? 'video',
            fromUid: msg.sender?.uid ?? 'unknown',
            groupGuid: msg.receiverUid,
          ));
        },
      ),
    );
  }

  void unregister() => CometChat.removeMessageListener(groupMeetingListenerId);
}
```

In a Bloc-based app, dispatch an event into your CallBloc; the listener's `onIncoming` callback wraps the Bloc emit.

Register AFTER `CometChatUIKit.login` succeeds (e.g. in the auth Bloc's `_onLoginSuccess` state transition).

---

## Edge cases

### V6 vendor blocker context

This SKILL.md notes that V6 calling is partially-blocked at v6.0.0-beta2 — specifically the outgoing-call → in-call screen transition. **Production Flutter customers should stay on V5** for both 1:1 and group calls until the vendor fixes the V6 BLoC handler. Group calls on V6 inherit the same blocker.

### Late joining

Meeting persists in chat. Tap any time to join.

### Push notifications

Meeting `CustomMessage.metadata.pushNotification = "meeting"` — delivered as regular FCM/APNs. To get CallKit/ConnectionService ring on iOS/Android, intercept the push and route to `flutter_callkit_incoming` manually.

---

## Anti-patterns

1. **Only `CometChat.addCallListener` registered.** Won't fire for groups.
2. **Relying on V6 kit's outgoing-call screen for groups on v6.0.0-beta2.** Vendor blocker. Use custom navigation.
3. **`CometChat.endCall(sessionId)` after group hangup.** No call entity.
4. **`MessageListener` registered before login.** Silently dropped.
5. **Skipping `navigatorKey` setup** for any kit-driven call path.

---

## Verification checklist

- [ ] V6 SKILL.md §1.7 `navigatorKey` requirement met (MaterialApp has CallNavigationContext.navigatorKey)
- [ ] If kit caller: `CometChatCallButtons(group: group)` — but verify outgoing-call transition works post-vendor-fix
- [ ] If custom caller: `CometChat.sendCustomMessage(type: 'meeting', category: custom, customData: {callType, sessionId})`
- [ ] If kit receiver: `CometChatMessageList(group: group)` — see V6 vendor blocker caveat
- [ ] If custom receiver: `CometChat.addMessageListener` registered AFTER login with category+type filter
- [ ] On hangup: `CometChatUIKitCalls.endSession()` only
- [ ] Late-joining tested
- [ ] Push notifications fire for offline members

---

## Pointers

- `cometchat-flutter-v6-calls/SKILL.md` §1.7 — `navigatorKey` requirement + V6 vendor blocker context
- `ringing-integration.md` — 1:1 user calls (different channel)
- Cross-platform reference (semantic ground-truth): `cometchat-react-calls/references/group-calls.md`
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/group-calls
