# Call session — joinSession with no ringing (Flutter V6 / Bloc)

Bloc-driven adaptation of the upstream sample. Same SDK underneath as V5 (`cometchat_calls_sdk`); the V6 kit (`cometchat_chat_uikit ^6.0.0`) is OPTIONAL for session-only flows.

**Read first:**
- `cometchat-flutter-v5-calls/references/call-session.md` — V5 sister, canonical SDK API surface (callback shape, `SessionSettingsBuilder`, `SessionStatusListeners`)
- `cometchat-react-calls/references/call-session.md` — full cross-platform architecture

**Source of truth:** `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/cometchat-calls-sample-app-flutter/lib/screens/call_screen.dart` (the SDK version is the same; only the state-management primitive differs between v5 GetX and v6 Bloc).

---

## Hard rules

All V5 rules apply (callback API, `SessionSettingsBuilder`, `SessionStatusListeners` interface, `CometChatOngoingCallService.launch/abort`, `SizedBox.expand`, no Chat SDK for session-only). The V6-specific delta is:

1. **Cubit, not full Bloc.** Single 1-state-update flow — Cubit is the right primitive. Don't introduce events + reducer ceremony.
2. **`BlocConsumer` for auto-pop on idle transition** — combines side-effect (Navigator.pop on terminated) with builder (loading / error / active UI).
3. **Cubit holds the listener references**, not the widget. `close()` calls `removeSessionStatusListener` + `CometChatOngoingCallService.abort()`.

---

## Cubit

```dart
import 'package:bloc/bloc.dart';
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/widgets.dart';
import 'package:permission_handler/permission_handler.dart';

enum CallSessionStatus { idle, requesting, joining, active, leaving, error }

class CallSessionState extends Equatable {
  final CallSessionStatus status;
  final Widget? videoWidget;
  final String? error;
  const CallSessionState({this.status = CallSessionStatus.idle, this.videoWidget, this.error});

  CallSessionState copyWith({
    CallSessionStatus? status,
    Widget? videoWidget,
    String? error,
  }) =>
      CallSessionState(
        status: status ?? this.status,
        videoWidget: videoWidget ?? this.videoWidget,
        error: error ?? this.error,
      );

  @override
  List<Object?> get props => [status, videoWidget, error];
}

class CallSessionCubit extends Cubit<CallSessionState> implements SessionStatusListeners {
  CallSessionCubit() : super(const CallSessionState());

  CallSession? _callSession;

  Future<void> join(String sessionId) async {
    if (state.status != CallSessionStatus.idle) return;
    emit(state.copyWith(status: CallSessionStatus.requesting));

    final cam = await Permission.camera.request();
    final mic = await Permission.microphone.request();
    if (!cam.isGranted || !mic.isGranted) {
      emit(state.copyWith(status: CallSessionStatus.error, error: 'Permission denied'));
      return;
    }

    emit(state.copyWith(status: CallSessionStatus.joining));

    final settings = (SessionSettingsBuilder()
          .setTitle('CometChat Meeting')
          .startVideoPaused(false)
          .startAudioMuted(false))
        .build();

    CometChatCalls.joinSession(
      sessionId: sessionId,
      sessionSettings: settings,
      onSuccess: (Widget? widget) {
        _callSession = CallSession.getInstance();
        _callSession?.addSessionStatusListener(this);
        CometChatOngoingCallService.launch();
        emit(state.copyWith(status: CallSessionStatus.active, videoWidget: widget));
      },
      onError: (CometChatCallsException error) {
        emit(state.copyWith(status: CallSessionStatus.error, error: error.message ?? 'Failed'));
      },
    );
  }

  Future<void> leave() async {
    if (state.status == CallSessionStatus.idle) return;
    emit(state.copyWith(status: CallSessionStatus.leaving));
    try {
      await _callSession?.leaveSession();
    } catch (_) {
      // best-effort
    }
    await CometChatOngoingCallService.abort();
    emit(const CallSessionState());  // back to idle
  }

  // --- SessionStatusListeners ---
  @override
  void onSessionJoined() {
    CometChatOngoingCallService.launch();
  }

  // All termination events funnel through ONE guarded _handleTermination().
  // The v5 Calls SDK fires onSessionLeft + onConnectionClosed in sequence on
  // every hangup. Without the guard, abort() + emit() fire 3 times (wasteful
  // and races with cubit close on rapid leave/rejoin).
  bool _isTerminating = false;
  void _handleTermination() {
    if (_isTerminating) return;
    _isTerminating = true;
    CometChatOngoingCallService.abort();
    emit(const CallSessionState());
  }

  @override
  void onSessionLeft() => _handleTermination();

  @override
  void onConnectionClosed() => _handleTermination();

  @override
  void onSessionTimedOut() => _handleTermination();

  @override
  void onConnectionLost() {}
  @override
  void onConnectionRestored() {}

  @override
  Future<void> close() async {
    _callSession?.removeSessionStatusListener(this);
    if (state.status != CallSessionStatus.idle) {
      await CometChatOngoingCallService.abort();
      try {
        await _callSession?.leaveSession();
      } catch (_) {}
    }
    return super.close();
  }
}
```

---

## Call room widget

```dart
class CallRoom extends StatelessWidget {
  final String sessionId;
  const CallRoom({super.key, required this.sessionId});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<CallSessionCubit>(
      create: (_) => CallSessionCubit()..join(sessionId),
      child: BlocConsumer<CallSessionCubit, CallSessionState>(
        listenWhen: (prev, curr) =>
            prev.status != CallSessionStatus.idle && curr.status == CallSessionStatus.idle,
        listener: (context, state) => Navigator.of(context).pop(),
        builder: (context, state) {
          if (state.status == CallSessionStatus.error) {
            return Scaffold(
              backgroundColor: Colors.black,
              body: Center(child: Text('Error: ${state.error}', style: const TextStyle(color: Colors.white))),
            );
          }
          if (state.status != CallSessionStatus.active || state.videoWidget == null) {
            return const Scaffold(
              backgroundColor: Colors.black,
              body: Center(child: CircularProgressIndicator(color: Colors.white)),
            );
          }
          return Scaffold(
            backgroundColor: Colors.black,
            body: SizedBox.expand(child: state.videoWidget),
          );
        },
      ),
    );
  }
}
```

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **Storing the returned widget in the cubit's `_controller` field** as if it were a controller. The `Widget?` IS what you render — there is no controller layer in the v5 Calls SDK.
2. **Full Bloc with events for a 1-state-update flow.** Cubit fits cleanly.
3. **`BlocBuilder` instead of `BlocConsumer`.** Need both side-effect (auto-pop) and builder (loading/error UI).
4. **Forgetting `..join(sessionId)` cascade.** Cubit created but never starts joining.
5. **Forgetting to call `CometChatOngoingCallService.abort()` in `close()`.** Service notification persists after route pops.
6. **`CometChatOngoingCallController` / `CometChatOngoingCallView`.** These do not exist in the v5 Calls SDK API. Use the `Widget?` returned by `onSuccess` directly.

---

## Verification checklist

- [ ] Cubit implements `SessionStatusListeners` and registers itself in `onSuccess`
- [ ] `joinSession` called with `sessionId:`, `sessionSettings:`, `onSuccess:`, `onError:`
- [ ] Settings built via `SessionSettingsBuilder()`, not `CallSettings`
- [ ] `BlocProvider` creates cubit and triggers `..join(sessionId)`
- [ ] `BlocConsumer.listener` pops route on idle transition
- [ ] Loading / error UI for non-active states
- [ ] Widget rendered via `SizedBox.expand(child: state.videoWidget)`
- [ ] `close()` removes listener + aborts ongoing-call service + best-effort leaves
- [ ] **Standalone session-only:** no `cometchat_chat_sdk` dependency — Calls SDK alone
- [ ] Real-device smoke: same as V5 sister

---

## Pointers

- `cometchat-flutter-v5-calls/references/call-session.md` — V5 sister + canonical SDK API
- `cometchat-flutter-v6-calls/SKILL.md` — V6 Bloc patterns
- `cometchat-flutter-v6-calls/references/share-invite.md` — deep-link config
- Upstream sample — `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/cometchat-calls-sample-app-flutter/lib/screens/call_screen.dart` (SDK is the same)
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/join-session
