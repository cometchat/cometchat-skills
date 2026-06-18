# Raise hand on Flutter (UIKit V5, GetX-based)

Same SDK conceptual API as web/native. Flutter V5 uses GetX for state management — the canonical pattern is a `GetxController` that wraps the call event listener and publishes raised-hand state via `Rx<List<RaisedParticipant>>`.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/raise-hand
**Read first:** `cometchat-react-calls/references/raise-hand.md` — UX shape + anti-patterns are identical; this is the V5 GetX-specific wiring.

---

## SDK API

Raise/lower hand are **instance methods on the `CallSession` singleton**, NOT static on `CometChatCalls` (`cometchat_calls_sdk-5.0.2` `src/call_session.dart:292,306`). Participant hand events arrive via `ParticipantEventListeners`, registered through `CallSession.getInstance()?.addParticipantEventListener(...)` (`src/call_session.dart:74`).

```dart
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

// Local user
CallSession.getInstance()?.raiseHand();   // call_session.dart:292
CallSession.getInstance()?.lowerHand();   // call_session.dart:306

// Listener — implement the split ParticipantEventListeners interface
class HandListener implements ParticipantEventListeners {
  @override
  void onParticipantHandRaised(Participant participant) {  // participant_event_listeners.dart:30
    // participant.uid, participant.name (both nullable)
  }

  @override
  void onParticipantHandLowered(Participant participant) {  // :33
    // ...
  }
  // ... other ParticipantEventListeners methods (no-ops or pass-through)
}

// Register on the session singleton (inside joinSession.onSuccess):
CallSession.getInstance()?.addParticipantEventListener(HandListener());  // :74

// Settings flag — method on the (non-deprecated) SessionSettingsBuilder.
final settings = (SessionSettingsBuilder()
      ..hideRaiseHandButton(true))   // session_settings.dart:215
    .build();
```

---

## GetX controller

```dart
import 'package:get/get.dart';
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

class RaisedParticipant {
  final String uid;
  final String name;
  final DateTime raisedAt;
  RaisedParticipant({required this.uid, required this.name, required this.raisedAt});
}

class RaiseHandController extends GetxController implements ParticipantEventListeners {
  final localRaised = false.obs;
  final raised = <RaisedParticipant>[].obs;

  void toggle() {
    if (localRaised.value) {
      CallSession.getInstance()?.lowerHand();
    } else {
      CallSession.getInstance()?.raiseHand();
    }
    localRaised.value = !localRaised.value;
  }

  @override
  void onParticipantHandRaised(Participant p) {
    // Participant.uid / .name are nullable in 5.x.
    final uid = p.uid ?? '';
    final entry = RaisedParticipant(
      uid: uid, name: p.name ?? uid, raisedAt: DateTime.now(),
    );
    raised.removeWhere((r) => r.uid == uid);
    raised.add(entry);
    raised.sort((a, b) => a.raisedAt.compareTo(b.raisedAt));
  }

  @override
  void onParticipantHandLowered(Participant p) {
    raised.removeWhere((r) => r.uid == (p.uid ?? ''));
  }

  // ... implement other ParticipantEventListeners methods (no-ops or pass-through)
}
```

`.obs` is GetX's reactive marker. UI rebuilds automatically when these mutate.

---

## Toggle button widget

```dart
class RaiseHandButton extends StatelessWidget {
  const RaiseHandButton({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<RaiseHandController>();
    return Obx(() => GestureDetector(
      onTap: () {
        ctrl.toggle();
        // Announce for screen readers
        SemanticsService.announce(
          ctrl.localRaised.value ? 'Hand raised' : 'Hand lowered',
          TextDirection.ltr,
        );
      },
      child: Semantics(
        button: true,
        selected: ctrl.localRaised.value,
        label: ctrl.localRaised.value ? 'Lower hand' : 'Raise hand',
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: ctrl.localRaised.value
              ? const Color(0xFFFFD60A)
              : Colors.white24,
            borderRadius: BorderRadius.circular(32),
          ),
          child: Row(
            children: [
              const Text('✋'),
              const SizedBox(width: 4),
              Text(ctrl.localRaised.value ? 'Lower' : 'Raise'),
            ],
          ),
        ),
      ),
    ));
  }
}
```

`SemanticsService.announce` is the Flutter equivalent of `aria-live` / `UIAccessibility.post(.announcement, ...)` — TalkBack and VoiceOver pick up the announcement.

`Semantics` wrapper sets `button: true`, `selected:`, `label:` — these map to platform a11y conventions.

---

## Raised-hands sheet (DraggableScrollableSheet)

```dart
class RaisedHandsSheet extends StatelessWidget {
  const RaisedHandsSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<RaiseHandController>();
    return DraggableScrollableSheet(
      initialChildSize: 0.1,
      minChildSize: 0.1,
      maxChildSize: 0.5,
      builder: (context, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Obx(() => ListView(
          controller: scrollController,
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Raised hands (${ctrl.raised.length})',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            for (final p in ctrl.raised)
              ListTile(
                leading: const Text('✋', style: TextStyle(fontSize: 20)),
                title: Text(p.name),
                trailing: Text(
                  '${DateTime.now().difference(p.raisedAt).inSeconds}s ago',
                  style: const TextStyle(color: Colors.grey),
                ),
              ),
          ],
        )),
      ),
    );
  }
}
```

---

## Wiring to the call session

```dart
RaiseHandController? _handCtrl;

@override
void initState() {
  super.initState();
  _handCtrl = Get.put(RaiseHandController());
  // NOTE: attach the listener inside joinSession.onSuccess (CallSession.getInstance()
  // is null until the session exists). If this widget is mounted only after the
  // session is live, attach here:
  CallSession.getInstance()?.addParticipantEventListener(_handCtrl!);  // call_session.dart:74
}

@override
void dispose() {
  if (_handCtrl != null) {
    CallSession.getInstance()?.removeParticipantEventListener(_handCtrl!);  // call_session.dart:78
  }
  Get.delete<RaiseHandController>();
  super.dispose();
}
```

The 5.x SDK identifies listeners by object identity (a `Set`), not a string ID — keep the same controller instance you registered and pass it to `removeParticipantEventListener` on dispose.

---

## Anti-patterns

Web sister reference rules apply, plus Flutter V5-specific:

1. **Forgetting `Get.delete<RaiseHandController>()` on dispose.** GetX retains the controller across navigation — listeners survive past the call view, fire stale events.
2. **`Get.put(RaiseHandController(), permanent: true)` for the call.** Lifetime is too long; controller survives logout. Use scoped `Get.put` without permanent.
3. **Skipping `Semantics` wrapper on the button.** TalkBack reads the GestureDetector as untyped — bad a11y.
4. **`Obx` rebuilding the entire widget tree** when only one `.obs` field changes. Wrap minimally — the `Obx` should hug only the reactive part.
5. **DraggableScrollableSheet without `initialChildSize` < `minChildSize`** — sheet pops above the screen on render, looks broken.

---

## Verification checklist

- [ ] `RaiseHandController` is a `GetxController`
- [ ] `localRaised` and `raised` are `.obs` reactive
- [ ] `Obx` wraps only reactive parts of the UI
- [ ] `Semantics` wrapper on toggle button with `button: true, selected:, label:`
- [ ] `SemanticsService.announce` on toggle
- [ ] Same controller instance registered via `CallSession.getInstance()?.addParticipantEventListener(ctrl)` and removed via `removeParticipantEventListener(ctrl)` on dispose
- [ ] `Get.delete<RaiseHandController>()` in `dispose()`
- [ ] `SessionSettingsBuilder()..hideRaiseHandButton(true)` if custom UI
- [ ] Real-device smoke: 3 devices (mix of iOS + Android), raise from 2 → host sees both
- [ ] TalkBack / VoiceOver announces "Hand raised" / "Hand lowered" on toggle

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — sister reference (UX shape)
- `cometchat-flutter-v5-calls` SKILL.md — V5 hard rules + GetX scope rules
- `cometchat-flutter-v6-calls/references/raise-hand.md` — V6 sibling (Bloc-based — different state shape)
- `cometchat-a11y` — Flutter Semantics + SemanticsService
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/raise-hand
