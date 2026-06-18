# Raise hand on Flutter (UIKit V6, Bloc-based)

Same SDK conceptual API as V5; the difference is state management — V6 uses `flutter_bloc` rather than GetX. The reactive shape is `RaiseHandBloc → emit(state)` where state is an immutable record of `localRaised + raisedParticipants`.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/raise-hand
**Read first:** `cometchat-flutter-v5-calls/references/raise-hand.md` — UX shape is identical; this is the V6 Bloc translation.

---

## SDK API (same as V5)

Raise/lower hand are **instance methods on the `CallSession` singleton**, NOT static on `CometChatCalls` (verified `cometchat_calls_sdk-5.0.2` `src/call_session.dart:292,306`; the static `CometChatCalls` class has no `raiseHand`/`lowerHand`). Participant hand events arrive via `ParticipantEventListeners`, registered through `CallSession.getInstance()?.addParticipantEventListener(...)` (`src/call_session.dart:78`) — there is no `CometChatCalls.addCallEventListener`.

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart';

CallSession.getInstance()?.raiseHand();
CallSession.getInstance()?.lowerHand();

// Register a ParticipantEventListeners implementation:
CallSession.getInstance()?.addParticipantEventListener(myListener);

// In your ParticipantEventListeners implementation:
@override
void onParticipantHandRaised(Participant p) { /* ... */ }
@override
void onParticipantHandLowered(Participant p) { /* ... */ }

// hideRaiseHandButton is a METHOD on the (non-deprecated) SessionSettingsBuilder.
// `CallSettingsBuilder` is @Deprecated in 5.0.2 (src/builder/call_settings.dart:208).
final settings = SessionSettingsBuilder().hideRaiseHandButton(true).build();
```

---

## Bloc setup

```dart
import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart';

// State
class RaiseHandState extends Equatable {
  final bool localRaised;
  final List<RaisedParticipant> raised;
  const RaiseHandState({this.localRaised = false, this.raised = const []});

  RaiseHandState copyWith({bool? localRaised, List<RaisedParticipant>? raised}) =>
    RaiseHandState(
      localRaised: localRaised ?? this.localRaised,
      raised: raised ?? this.raised,
    );

  @override
  List<Object> get props => [localRaised, raised];
}

class RaisedParticipant extends Equatable {
  final String uid;
  final String name;
  final DateTime raisedAt;
  const RaisedParticipant({required this.uid, required this.name, required this.raisedAt});
  @override
  List<Object> get props => [uid, name, raisedAt];
}

// Events
abstract class RaiseHandEvent {}
class ToggleHand extends RaiseHandEvent {}
class _ParticipantRaised extends RaiseHandEvent {
  final Participant participant;
  _ParticipantRaised(this.participant);
}
class _ParticipantLowered extends RaiseHandEvent {
  final Participant participant;
  _ParticipantLowered(this.participant);
}
```

---

## Bloc implementation

```dart
class RaiseHandBloc extends Bloc<RaiseHandEvent, RaiseHandState>
    implements ParticipantEventListeners {

  RaiseHandBloc() : super(const RaiseHandState()) {
    on<ToggleHand>(_onToggle);
    on<_ParticipantRaised>(_onParticipantRaised);
    on<_ParticipantLowered>(_onParticipantLowered);

    // Self-register as the participant event listener (v5 split listener).
    CallSession.getInstance()?.addParticipantEventListener(this);
  }

  void _onToggle(ToggleHand event, Emitter<RaiseHandState> emit) {
    if (state.localRaised) {
      CallSession.getInstance()?.lowerHand();
    } else {
      CallSession.getInstance()?.raiseHand();
    }
    emit(state.copyWith(localRaised: !state.localRaised));
  }

  void _onParticipantRaised(_ParticipantRaised event, Emitter<RaiseHandState> emit) {
    final entry = RaisedParticipant(
      uid: event.participant.uid,
      name: event.participant.name,
      raisedAt: DateTime.now(),
    );
    final next = [...state.raised.where((r) => r.uid != entry.uid), entry];
    next.sort((a, b) => a.raisedAt.compareTo(b.raisedAt));
    emit(state.copyWith(raised: next));
  }

  void _onParticipantLowered(_ParticipantLowered event, Emitter<RaiseHandState> emit) {
    final next = state.raised.where((r) => r.uid != event.participant.uid).toList();
    emit(state.copyWith(raised: next));
  }

  // ParticipantEventListeners — bridge to Bloc events
  @override
  void onParticipantHandRaised(Participant p) {
    add(_ParticipantRaised(p));
  }

  @override
  void onParticipantHandLowered(Participant p) {
    add(_ParticipantLowered(p));
  }

  // ... implement other ParticipantEventListeners methods (no-ops or pass-through)

  @override
  Future<void> close() {
    CallSession.getInstance()?.removeParticipantEventListener(this);
    return super.close();
  }
}
```

The bridge pattern: the bloc IS the SDK listener. SDK callbacks call `add()` on the bloc, which dispatches an event handler that emits new state. This keeps Bloc's "single source of truth" intact — no parallel state outside the bloc.

---

## Toggle button widget

```dart
class RaiseHandButton extends StatelessWidget {
  const RaiseHandButton({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<RaiseHandBloc, RaiseHandState>(
      buildWhen: (prev, curr) => prev.localRaised != curr.localRaised,
      builder: (context, state) => Semantics(
        button: true,
        selected: state.localRaised,
        label: state.localRaised ? 'Lower hand' : 'Raise hand',
        child: GestureDetector(
          onTap: () {
            context.read<RaiseHandBloc>().add(ToggleHand());
            SemanticsService.announce(
              state.localRaised ? 'Hand lowered' : 'Hand raised',
              TextDirection.ltr,
            );
          },
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: state.localRaised ? const Color(0xFFFFD60A) : Colors.white24,
              borderRadius: BorderRadius.circular(32),
            ),
            child: Row(
              children: [
                const Text('✋'),
                const SizedBox(width: 4),
                Text(state.localRaised ? 'Lower' : 'Raise'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

`buildWhen` ensures the button only rebuilds when `localRaised` changes — not on every roster update. Performance discipline matters in a video call.

---

## Raised-hands sheet

Same `DraggableScrollableSheet` shape as V5; bind via `BlocBuilder` instead of `Obx`:

```dart
BlocBuilder<RaiseHandBloc, RaiseHandState>(
  buildWhen: (prev, curr) => prev.raised != curr.raised,
  builder: (context, state) => ListView(
    children: [
      Text('Raised hands (${state.raised.length})'),
      for (final p in state.raised)
        ListTile(leading: const Text('✋'), title: Text(p.name)),
    ],
  ),
)
```

`buildWhen` again — only rebuild when the roster changes, not on toggle.

---

## Wiring to the call screen

```dart
class CallScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => RaiseHandBloc(),
      child: Scaffold(
        body: Stack(
          children: [
            // ... call surface (CometChatOngoingCall)
            const Positioned(bottom: 100, right: 20, child: RaiseHandButton()),
            const RaisedHandsSheet(),
          ],
        ),
      ),
    );
  }
}
```

`BlocProvider(create:)` scopes the bloc to the screen — disposed automatically on screen pop.

---

## Anti-patterns

Web sister reference rules apply, plus V6-specific:

1. **`buildWhen` omitted.** Every state change rebuilds every BlocBuilder — lots of unnecessary work during a call. Add `buildWhen` for narrow rebuilds.
2. **Mutating `state.raised` directly** instead of creating a new list. `Equatable` props compare via `==`; mutation doesn't trigger rebuild.
3. **Calling `CallSession.getInstance()?.raiseHand()` outside the bloc.** Bypasses the state machine; UI doesn't update. Always go through `add(ToggleHand())`.
4. **Adding the SDK listener in `initState`** instead of the bloc constructor. Component-level lifecycle ≠ Bloc lifecycle. Bloc `close()` is the canonical place to clean up.

---

## Verification checklist

- [ ] `RaiseHandBloc` extends `Bloc<RaiseHandEvent, RaiseHandState>`
- [ ] `RaiseHandState` extends `Equatable` with proper `props`
- [ ] Bloc registers itself as `ParticipantEventListeners` via `CallSession.getInstance()?.addParticipantEventListener(this)` in constructor
- [ ] Bloc `close()` removes the listener via `removeParticipantEventListener(this)`
- [ ] `BlocProvider(create:)` scopes the bloc to the call screen
- [ ] `buildWhen` on every BlocBuilder narrows rebuilds
- [ ] `Semantics` + `SemanticsService.announce` for a11y
- [ ] `SessionSettingsBuilder().hideRaiseHandButton(true)` if custom UI
- [ ] Real-device smoke: 3 devices (iOS + Android), 2 raise hands, host sees both
- [ ] Hot-reload smoke: trigger raise → save code → bloc state survives (bloc is created via `create:`, persists across hot reload)

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — sister reference (UX shape)
- `cometchat-flutter-v5-calls/references/raise-hand.md` — V5 sibling (GetX-based)
- `cometchat-flutter-v6-calls` SKILL.md — V6 hard rules + Bloc patterns
- `cometchat-a11y` — Flutter Semantics + SemanticsService
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/raise-hand
