# Idle timeout on Flutter V6 (Bloc-based)

Same SDK API as V5; Bloc-based wiring. Read `cometchat-flutter-v5-calls/references/idle-timeout.md` first.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/idle-timeout

---

## SDK API + listener bridge

Same `CallSettingsBuilder` setters as V5. Listener via Bloc bridge (cf. `cometchat-flutter-v6-calls/references/raise-hand.md`):

```dart
abstract class CallEvent {}
class _SessionTimedOut extends CallEvent {}

class CallBloc extends Bloc<CallEvent, CallState> implements CometChatCallsEventsListener {
  CallBloc() : super(const CallState()) {
    on<_SessionTimedOut>(_onTimedOut);
    CometChatCalls.addCallEventListener('call-bloc', this);
  }

  @override
  void onSessionTimedOut() {
    add(_SessionTimedOut());
  }

  void _onTimedOut(_SessionTimedOut event, Emitter<CallState> emit) {
    emit(state.copyWith(timedOut: true));
  }

  @override
  Future<void> close() {
    CometChatCalls.removeCallEventListener('call-bloc');
    return super.close();
  }
}
```

UI listens for `state.timedOut`:

```dart
BlocListener<CallBloc, CallState>(
  listenWhen: (prev, curr) => !prev.timedOut && curr.timedOut,
  listener: (context, state) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Call ended due to inactivity')),
    );
    Navigator.of(context).popUntil((route) => route.isFirst);
  },
  child: /* call surface */,
)
```

`BlocListener` is one-shot side effects (navigation, snackbars). `listenWhen` ensures the listener only fires on the transition.

---

## Custom prompt — same showDialog as V5

Identical code; cite V5 sister reference.

---

## Verification checklist

- [ ] CallSettingsBuilder sets both idle periods
- [ ] CallBloc bridges `onSessionTimedOut` to `_SessionTimedOut` event
- [ ] BlocListener with `listenWhen` triggers nav + snackbar
- [ ] Bloc `close()` removes the listener
- [ ] Real-device smoke: same as V5

---

## Pointers

- `cometchat-flutter-v5-calls/references/idle-timeout.md` — V5 sister
- `cometchat-flutter-v6-calls` SKILL.md — V6 hard rules
- `cometchat-flutter-v6-calls/references/raise-hand.md` — Bloc-bridge sibling pattern
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/idle-timeout
