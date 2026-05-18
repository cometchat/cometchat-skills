# Raise hand on Flutter (UIKit V5, GetX-based)

Same SDK conceptual API as web/native. Flutter V5 uses GetX for state management — the canonical pattern is a `GetxController` that wraps the call event listener and publishes raised-hand state via `Rx<List<RaisedParticipant>>`.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/raise-hand
**Read first:** `cometchat-react-calls/references/raise-hand.md` — UX shape + anti-patterns are identical; this is the V5 GetX-specific wiring.

---

## SDK API

```dart
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

// Local user
CometChatCalls.raiseHand();
CometChatCalls.lowerHand();

// Listener — registered via the call event listener attached to the OngoingCall widget
class CallListener implements CometChatCallsEventsListener {
  @override
  void onParticipantHandRaised(Participant participant) {
    // participant.uid, participant.name
  }

  @override
  void onParticipantHandLowered(Participant participant) {
    // ...
  }
  // ... other event handlers
}

// Settings flag
final settings = CallSettingsBuilder()
  ..hideRaiseHandButton = true;
final builtSettings = settings.build();
```

---

## GetX controller

```dart
import 'package:get/get.dart';
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

class RaisedParticipant {
  final String uid;
  final String name;
  final DateTime raisedAt;
  RaisedParticipant({required this.uid, required this.name, required this.raisedAt});
}

class RaiseHandController extends GetxController implements CometChatCallsEventsListener {
  final localRaised = false.obs;
  final raised = <RaisedParticipant>[].obs;

  void toggle() {
    if (localRaised.value) {
      CometChatCalls.lowerHand();
    } else {
      CometChatCalls.raiseHand();
    }
    localRaised.value = !localRaised.value;
  }

  @override
  void onParticipantHandRaised(Participant p) {
    final entry = RaisedParticipant(
      uid: p.uid, name: p.name, raisedAt: DateTime.now(),
    );
    raised.removeWhere((r) => r.uid == p.uid);
    raised.add(entry);
    raised.sort((a, b) => a.raisedAt.compareTo(b.raisedAt));
  }

  @override
  void onParticipantHandLowered(Participant p) {
    raised.removeWhere((r) => r.uid == p.uid);
  }

  // ... implement other CometChatCallsEventsListener methods (no-ops or pass-through)
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
@override
void initState() {
  super.initState();
  Get.put(RaiseHandController());

  // Attach to the call session — the controller IS the listener
  final ctrl = Get.find<RaiseHandController>();
  CometChatCalls.addCallEventListener('raise-hand', ctrl);
}

@override
void dispose() {
  CometChatCalls.removeCallEventListener('raise-hand');
  Get.delete<RaiseHandController>();
  super.dispose();
}
```

Use a STABLE listener ID ('raise-hand'). Changing IDs across remounts orphans listeners — duplicate events fire for each.

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
- [ ] Stable listener ID for `addCallEventListener` / `removeCallEventListener`
- [ ] `Get.delete<RaiseHandController>()` in `dispose()`
- [ ] `hideRaiseHandButton: true` in CallSettings if custom UI
- [ ] Real-device smoke: 3 devices (mix of iOS + Android), raise from 2 → host sees both
- [ ] TalkBack / VoiceOver announces "Hand raised" / "Hand lowered" on toggle

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — sister reference (UX shape)
- `cometchat-flutter-v5-calls` SKILL.md — V5 hard rules + GetX scope rules
- `cometchat-flutter-v6-calls/references/raise-hand.md` — V6 sibling (Bloc-based — different state shape)
- `cometchat-a11y` — Flutter Semantics + SemanticsService
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/raise-hand
