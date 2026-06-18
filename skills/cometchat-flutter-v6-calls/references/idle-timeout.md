# Idle timeout on Flutter V6 (Bloc-based)

Same SDK API as V5; Bloc-based wiring. Read `cometchat-flutter-v5-calls/references/idle-timeout.md` first.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/idle-timeout

---

## SDK API + listener bridge

Set the idle period on `SessionSettingsBuilder().setIdleTimeoutPeriod(int)` (seconds — `cometchat_calls_sdk-5.0.2` `src/builder/session_settings.dart:185`). The monolithic `CometChatCallsEventsListener` is `@Deprecated` in 5.0.2 (`src/listener/cometchat_calls_events_listener.dart:16`) — use the v5 split listeners instead. `onSessionTimedOut()` lives on `SessionStatusListeners` (`src/listener/session_status_listeners.dart`), registered via `CallSession.getInstance()?.addSessionStatusListener(...)` (`src/call_session.dart:66`). There is no `CometChatCalls.addCallEventListener`.

Listener via Bloc bridge (cf. `cometchat-flutter-v6-calls/references/raise-hand.md`):

```dart
// Apply the idle timeout when building session settings:
final settings = SessionSettingsBuilder().setIdleTimeoutPeriod(180).build();

abstract class CallEvent {}
class _SessionTimedOut extends CallEvent {}

class CallBloc extends Bloc<CallEvent, CallState> implements SessionStatusListeners {
  CallBloc() : super(const CallState()) {
    on<_SessionTimedOut>(_onTimedOut);
    CallSession.getInstance()?.addSessionStatusListener(this);
  }

  @override
  void onSessionTimedOut() {
    add(_SessionTimedOut());
  }

  void _onTimedOut(_SessionTimedOut event, Emitter<CallState> emit) {
    emit(state.copyWith(timedOut: true));
  }

  // ... other SessionStatusListeners callbacks (onSessionJoined/onSessionLeft/...) as no-ops

  @override
  Future<void> close() {
    CallSession.getInstance()?.removeSessionStatusListener(this);
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

- [ ] `SessionSettingsBuilder().setIdleTimeoutPeriod(seconds)` sets the idle period
- [ ] CallBloc implements `SessionStatusListeners` and bridges `onSessionTimedOut` to `_SessionTimedOut`
- [ ] Listener registered via `CallSession.getInstance()?.addSessionStatusListener(this)`
- [ ] BlocListener with `listenWhen` triggers nav + snackbar
- [ ] Bloc `close()` removes the listener via `removeSessionStatusListener(this)`
- [ ] Real-device smoke: same as V5

---

## Pointers

- `cometchat-flutter-v5-calls/references/idle-timeout.md` — V5 sister
- `cometchat-flutter-v6-calls` SKILL.md — V6 hard rules
- `cometchat-flutter-v6-calls/references/raise-hand.md` — Bloc-bridge sibling pattern
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/idle-timeout
