# Ringing — call signaling with custom UI (Flutter V6 / Bloc)

Same SDK shape; Bloc-driven state instead of GetX.

**Read first:**
- `cometchat-flutter-v5-calls/references/ringing-integration.md` — V5 sister (GetX patterns)
- `cometchat-react-calls/references/ringing-integration.md` — full architecture, hard rules

---

## Bloc

```dart
class CallSignalingState extends Equatable {
  final Call? incoming;
  final Call? outgoing;
  final String? activeSessionId;

  const CallSignalingState({this.incoming, this.outgoing, this.activeSessionId});
  CallSignalingState copyWith({Call? incoming, Call? outgoing, String? activeSessionId}) =>
      CallSignalingState(
        incoming: incoming ?? this.incoming,
        outgoing: outgoing ?? this.outgoing,
        activeSessionId: activeSessionId ?? this.activeSessionId,
      );
  CallSignalingState clear() => const CallSignalingState();
  @override
  List<Object?> get props => [incoming?.sessionId, outgoing?.sessionId, activeSessionId];
}

abstract class CallSignalingEvent {}
class _IncomingReceived extends CallSignalingEvent { final Call call; _IncomingReceived(this.call); }
class _OutgoingAccepted extends CallSignalingEvent { final Call call; _OutgoingAccepted(this.call); }
class _OutgoingRejected extends CallSignalingEvent {}
class _IncomingCancelled extends CallSignalingEvent {}
class _CallEnded extends CallSignalingEvent {}
class InitiateCall extends CallSignalingEvent { final String receiverUid; final String type; InitiateCall(this.receiverUid, {this.type = 'video'}); }
class AcceptCall extends CallSignalingEvent { final Call call; AcceptCall(this.call); }
class RejectCall extends CallSignalingEvent { final Call call; RejectCall(this.call); }

class CallSignalingBloc extends Bloc<CallSignalingEvent, CallSignalingState> implements CallListener {
  static const _listenerId = 'app';

  CallSignalingBloc() : super(const CallSignalingState()) {
    on<_IncomingReceived>((e, emit) => emit(state.copyWith(incoming: e.call)));
    on<_OutgoingAccepted>((e, emit) => emit(state.copyWith(outgoing: null, activeSessionId: e.call.sessionId)));
    on<_OutgoingRejected>((_, emit) => emit(state.copyWith(outgoing: null)));
    on<_IncomingCancelled>((_, emit) => emit(state.copyWith(incoming: null)));
    on<_CallEnded>((_, emit) => emit(state.clear()));
    on<InitiateCall>(_onInitiate);
    on<AcceptCall>(_onAccept);
    on<RejectCall>(_onReject);

    CometChat.addCallListener(_listenerId, this);
  }

  @override
  void onIncomingCallReceived(Call call) => add(_IncomingReceived(call));
  @override
  void onOutgoingCallAccepted(Call call) => add(_OutgoingAccepted(call));
  @override
  void onOutgoingCallRejected(Call call) => add(_OutgoingRejected());
  @override
  void onIncomingCallCancelled(Call call) => add(_IncomingCancelled());
  @override
  void onCallEndedMessageReceived(Call call) => add(_CallEnded());

  Future<void> _onInitiate(InitiateCall e, Emitter<CallSignalingState> emit) async {
    final call = Call(
      receiverUid: e.receiverUid,
      callType: e.type == 'video' ? CometChatCallType.video : CometChatCallType.audio,
      receiverType: CometChatReceiverType.user,
    );
    final result = await CometChat.initiateCall(call: call);
    if (result is Call) emit(state.copyWith(outgoing: result));
  }

  Future<void> _onAccept(AcceptCall e, Emitter<CallSignalingState> emit) async {
    final result = await CometChat.acceptCall(sessionId: e.call.sessionId!);
    if (result is Call) emit(state.copyWith(incoming: null, activeSessionId: result.sessionId));
  }

  Future<void> _onReject(RejectCall e, Emitter<CallSignalingState> emit) async {
    await CometChat.rejectCall(sessionId: e.call.sessionId!, status: CallStatus.rejected);
    emit(state.copyWith(incoming: null));
  }

  @override
  Future<void> close() {
    CometChat.removeCallListener(_listenerId);
    return super.close();
  }
}
```

---

## Provide above the router

```dart
BlocProvider<CallSignalingBloc>(
  create: (_) => CallSignalingBloc(),
  child: MaterialApp.router(...),
);
```

---

## Incoming-call overlay

```dart
class IncomingCallOverlay extends StatelessWidget {
  const IncomingCallOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CallSignalingBloc, CallSignalingState>(
      buildWhen: (prev, curr) => prev.incoming?.sessionId != curr.incoming?.sessionId,
      builder: (context, state) {
        final call = state.incoming;
        if (call == null) return const SizedBox.shrink();
        // Same UI as V5 sister; replace ctrl.accept/reject with bloc.add(...)
        return Material(/* ... see V5 sister ... */);
      },
    );
  }
}
```

Mount in `MaterialApp.builder`:

```dart
MaterialApp.router(
  builder: (context, child) => Stack(
    children: [
      child ?? const SizedBox.shrink(),
      const IncomingCallOverlay(),
    ],
  ),
  routerConfig: ...,
);
```

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **`BlocBuilder` without `buildWhen`.** Rebuilds on every state change — listener events for outgoing/active also retrigger incoming UI.
2. **Calling SDK methods from UI directly.** Adds back to bloc — use `bloc.add(InitiateCall(...))`.
3. **Provider scoped to a feature module.** Backgrounded ring path can't find the bloc when push fires.

---

## Verification checklist

- [ ] `BlocProvider<CallSignalingBloc>` above `MaterialApp`
- [ ] `IncomingCallOverlay` in `MaterialApp.builder`'s Stack
- [ ] `BlocBuilder` uses `buildWhen` to scope rebuilds to `incoming` changes
- [ ] `close()` calls `removeCallListener`
- [ ] Real-device smoke: same as V5 sister

---

## Pointers

- `cometchat-flutter-v5-calls/references/ringing-integration.md` — V5 sister (GetX)
- `cometchat-flutter-v6-calls/SKILL.md` — V6 Bloc patterns
- `cometchat-flutter-v6-calls/references/server-push-bridge.md` — backgrounded ring
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/ringing
