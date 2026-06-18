# Ringing — call signaling with custom UI (Flutter V5 / GetX)

Same SDK shape as web/RN. Flutter-specific deltas: GetX-controlled state, flutter_callkit_incoming for OS-level backgrounded UI, just_audio for foreground ringtone.

**Read first:** `cometchat-react-calls/references/ringing-integration.md` — full architecture, hard rules.

---

## SDK API + GetX controller

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_sdk/cometchat_sdk.dart';   // Call, CallListener (Chat SDK signaling)

class CallSignalingController extends GetxController implements CallListener {
  final incoming = Rx<Call?>(null);
  final outgoing = Rx<Call?>(null);
  final activeSessionId = Rx<String?>(null);

  static const _listenerId = 'app';

  @override
  void onInit() {
    super.onInit();
    CometChat.addCallListener(_listenerId, this);
  }

  @override
  void onIncomingCallReceived(Call call) {
    incoming.value = call;
  }

  @override
  void onOutgoingCallAccepted(Call call) {
    outgoing.value = null;
    activeSessionId.value = call.sessionId;
  }

  @override
  void onOutgoingCallRejected(Call call) {
    outgoing.value = null;
  }

  @override
  void onIncomingCallCancelled(Call call) {
    incoming.value = null;
  }

  @override
  void onCallEndedMessageReceived(Call call) {
    incoming.value = null;
    outgoing.value = null;
    activeSessionId.value = null;
  }

  Future<void> initiate(String receiverUid, {String type = 'video'}) async {
    final call = Call(
      receiverUid: receiverUid,
      type: type == 'video' ? CometChatCallType.video : CometChatCallType.audio, // ctor param is `type`, not `callType`
      receiverType: CometChatReceiverType.user,
    );
    // initiateCall is void + callback: the Call comes back in onSuccess, not via await.
    CometChat.initiateCall(call,
      onSuccess: (Call result) => outgoing.value = result,
      onError: (CometChatException e) => debugPrint(e.message ?? ''));
  }

  Future<void> accept(Call call) async {
    // acceptCall takes the sessionID POSITIONALLY + onSuccess/onError; it returns void.
    CometChat.acceptCall(call.sessionId!,
      onSuccess: (Call result) {
        incoming.value = null;
        activeSessionId.value = result.sessionId;
      },
      onError: (CometChatException e) => debugPrint(e.message ?? ''));
  }

  Future<void> reject(Call call) async {
    // rejectCall: positional sessionID + status String + onSuccess/onError (void).
    CometChat.rejectCall(call.sessionId!, CometChatCallStatus.rejected,
      onSuccess: (Call result) => incoming.value = null,
      onError: (CometChatException e) => debugPrint(e.message ?? ''));
  }

  @override
  void onClose() {
    CometChat.removeCallListener(_listenerId);
    super.onClose();
  }
}
```

Initialize at app start via `Get.put(CallSignalingController(), permanent: true);` so the listener survives navigation.

---

## Incoming-call overlay

```dart
class IncomingCallOverlay extends StatelessWidget {
  const IncomingCallOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<CallSignalingController>();

    return Obx(() {
      final call = ctrl.incoming.value;
      if (call == null) return const SizedBox.shrink();

      return Material(
        color: Colors.black.withOpacity(0.85),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(
                radius: 60,
                backgroundImage: NetworkImage(call.callInitiator?.avatar ?? ''),
              ),
              const SizedBox(height: 16),
              Text(
                call.callInitiator?.name ?? 'Unknown',
                style: const TextStyle(color: Colors.white, fontSize: 24),
              ),
              Text('Incoming ${call.type} call', style: const TextStyle(color: Colors.white70)),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Semantics(
                    label: 'Decline call',
                    button: true,
                    child: FloatingActionButton(
                      backgroundColor: Colors.red,
                      onPressed: () => ctrl.reject(call),
                      child: const Icon(Icons.call_end),
                    ),
                  ),
                  const SizedBox(width: 32),
                  Semantics(
                    label: 'Accept call',
                    button: true,
                    child: FloatingActionButton(
                      backgroundColor: Colors.green,
                      onPressed: () => ctrl.accept(call),
                      child: const Icon(Icons.call),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    });
  }
}
```

Wrap above the navigator (typically in `MaterialApp.builder` or as a sibling Stack item) so it surfaces over any route.

---

## Backgrounded ring — flutter_callkit_incoming + push (mandatory)

GetX listeners only fire while the app is alive. For backgrounded/killed ring, server fires push (APNs PushKit on iOS, FCM data-message on Android) → `flutter_callkit_incoming` shows OS-level UI. See `cometchat-flutter-v5-calls/references/server-push-bridge.md`.

---

## Anti-patterns

Web sister rules apply, plus Flutter-specific:

1. **`Get.put` without `permanent: true`.** Controller disposed on route change → listener gone → backgrounded calls miss.
2. **`StatefulWidget` with `setState` instead of `Obx`.** Rx values won't trigger rebuild without `Obx` wrapper.
3. **JS-style ringtone via `audioplayers` during a CallKit ring.** Both play at once.

---

## Verification checklist

- [ ] `Get.put(CallSignalingController(), permanent: true)` at app start
- [ ] `IncomingCallOverlay` mounted in `MaterialApp.builder`
- [ ] `removeCallListener` in `onClose`
- [ ] `flutter_callkit_incoming` wired for backgrounded ring
- [ ] Real-device smoke (iOS + Android): foreground, backgrounded, killed ring all surface UI

---

## Pointers

- `cometchat-react-calls/references/ringing-integration.md` — canonical
- `cometchat-flutter-v5-calls/SKILL.md` — Flutter calls architecture
- `cometchat-flutter-v5-calls/references/server-push-bridge.md` — backgrounded ring
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/ringing
