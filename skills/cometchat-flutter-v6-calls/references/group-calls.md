# Group calls — broadcast meeting pattern (Flutter V6)

Group calls use a **different signaling channel than 1:1 user calls**. The Ringing flow (`CometChat.initiateCall` → `onIncomingCallReceived` on peer) is **1:1 user only**. For groups, the kit broadcasts a **custom message of type `"meeting"`** to the group; receivers see a "Join meeting" card in `CometChatMessageList` (kit) or need an explicit `MessageListener.onCustomMessageReceived` (custom UI).

By-design kit behavior — same semantic across all CometChat kits.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/group-calls

V6 specifics: Flutter V6 folds calls into `cometchat_chat_uikit ^6.0.1` (no separate calls package). Bloc-based state. The outgoing→in-call transition bug that existed in `6.0.0-beta2` is **FIXED in 6.0.1 GA** (see SKILL.md §1.7) — the kit-driven path now works for groups too, **provided `navigatorKey: CallNavigationContext.navigatorKey` is wired on your MaterialApp**. The custom-UI path below remains a valid alternative (and is required if you render your own call surface).

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
3. **`navigatorKey` is mandatory for the kit's group call screen** (SKILL.md §1.7). With it wired, the kit's outgoing→ongoing transition works on 6.0.1 (the beta2 bug is fixed). Without it, the outgoing-call screen never renders — this is the one remaining requirement, not a reason to avoid the kit path.
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

> **✅ On 6.0.1 the outgoing→in-call transition works** once `navigatorKey: CallNavigationContext.navigatorKey` is wired on MaterialApp (SKILL §1.7). Without that wiring the caller sees "Calling..." indefinitely — so wire it. The custom-UI path below is an alternative for apps that render their own call surface.

## Caller side — custom UI (alternative to the kit path)

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

Then in your custom `/ongoing-call` screen, join the session against your own RTC view — same primitives the kit uses internally, but you control the navigation. On the raw Calls SDK the current API is the **named-parameter** `CometChatCalls.joinSession(callToken:` (or `sessionId:`)`, sessionSettings:, onSuccess:, onError:)` (`cometchat_calls_sdk-5.0.2` `src/plugin/cometchatcalls.dart:735`). The old positional `CometChatCalls.startSession(...)` is `@Deprecated` — do not use it. (If you stay on the kit wrapper `CometChatUIKitCalls`, use its kit-side join API — that is kit-side, not the raw SDK.)

---

## Receiver side — kit-based

`CometChatMessageList(group: group)` (or whichever message-list widget V6 ships) auto-renders the meeting message as a "Join meeting" card. Tap → kit calls `generateToken` + pushes the ongoing-call screen.

> Same `navigatorKey` requirement applies on the receiver side for the kit-driven join flow on 6.0.1. With it wired, the join→ongoing transition works; the custom join flow below is the alternative.

## Receiver side — custom UI (alternative)

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

### V6 calls status (resolved)

The beta2 outgoing-call → in-call transition bug is **FIXED in 6.0.1 GA** (validated 2026-05-27 on Pixel 3 — see SKILL.md §1.7). Production Flutter customers can use V6 for both 1:1 and group calls; the only requirement is the `navigatorKey: CallNavigationContext.navigatorKey` MaterialApp wiring.

### Late joining

Meeting persists in chat. Tap any time to join.

### Push notifications

Meeting `CustomMessage.metadata.pushNotification = "meeting"` — delivered as regular FCM/APNs. To get CallKit/ConnectionService ring on iOS/Android, intercept the push and route to `flutter_callkit_incoming` manually.

---

## Anti-patterns

1. **Only `CometChat.addCallListener` registered.** Won't fire for groups.
2. **Using the kit's group call screen WITHOUT wiring `navigatorKey`.** The screen never renders. Wire `CallNavigationContext.navigatorKey` (the beta2 transition bug itself is fixed in 6.0.1).
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
