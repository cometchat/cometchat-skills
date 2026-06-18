# Device management on Flutter V6 (Bloc)

Same SDK API as V5; Bloc-based state.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/device-management
**Read first:** `cometchat-flutter-v5-calls/references/device-management.md` — SDK shape + flutter_callkit_incoming integration.

---

## SDK API

These are **instance methods on the `CallSession` singleton**, not static on `CometChatCalls` (verified `cometchat_calls_sdk-5.0.2`):

- `CallSession.getInstance()?.switchCamera()` — front/back flip (`src/call_session.dart:205`).
- Audio output is **not** a `setSpeakerEnabled(bool)` toggle (no such method exists). Use `CallSession.getInstance()?.setAudioModeType(AudioMode)` (`src/call_session.dart:381`), where `AudioMode` is the enum `{ speaker, earpiece, bluetooth }` (`src/enums/audio_mode.dart`).

---

## Bloc-driven device state

```dart
class DeviceState extends Equatable {
  final bool speakerOn;
  final bool cameraIsBack;
  const DeviceState({this.speakerOn = false, this.cameraIsBack = false});
  DeviceState copyWith({bool? speakerOn, bool? cameraIsBack}) =>
    DeviceState(
      speakerOn: speakerOn ?? this.speakerOn,
      cameraIsBack: cameraIsBack ?? this.cameraIsBack,
    );
  @override List<Object> get props => [speakerOn, cameraIsBack];
}

abstract class DeviceEvent {}
class ToggleSpeaker extends DeviceEvent {}
class FlipCamera extends DeviceEvent {}

class DeviceBloc extends Bloc<DeviceEvent, DeviceState> {
  DeviceBloc() : super(const DeviceState()) {
    on<ToggleSpeaker>((event, emit) {
      final next = !state.speakerOn;
      // No setSpeakerEnabled(bool); route audio via the AudioMode enum.
      CallSession.getInstance()?.setAudioModeType(
        next ? AudioMode.speaker : AudioMode.earpiece,
      );
      emit(state.copyWith(speakerOn: next));
    });
    on<FlipCamera>((event, emit) {
      CallSession.getInstance()?.switchCamera();
      emit(state.copyWith(cameraIsBack: !state.cameraIsBack));
    });
  }
}
```

---

## Toggle widgets

```dart
class SpeakerToggle extends StatelessWidget {
  const SpeakerToggle({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<DeviceBloc, DeviceState>(
      buildWhen: (prev, curr) => prev.speakerOn != curr.speakerOn,
      builder: (context, state) => IconButton(
        icon: Icon(state.speakerOn ? Icons.volume_up : Icons.hearing),
        onPressed: () => context.read<DeviceBloc>().add(ToggleSpeaker()),
        tooltip: state.speakerOn ? 'Switch to earpiece' : 'Switch to speaker',
      ),
    );
  }
}
```

`buildWhen` prevents re-rendering on unrelated state changes — important during a video call where rebuild thrash hurts performance.

---

## Anti-patterns

Same as V5; plus V6-specific:

1. **`buildWhen` omitted.** Every state emit re-renders every BlocBuilder.
2. **Calling SDK methods inside Bloc handlers without try/catch.** Throwing inside the handler crashes the bloc.

---

## Verification checklist

- [ ] DeviceBloc with `ToggleSpeaker` + `FlipCamera` events
- [ ] BlocBuilder uses `buildWhen` for narrow rebuilds
- [ ] State is `Equatable` with proper `props`
- [ ] Real-device smoke: speaker toggle, camera flip both work

---

## Pointers

- `cometchat-flutter-v5-calls/references/device-management.md` — V5 sister
- `cometchat-flutter-v6-calls` SKILL.md
- `cometchat-flutter-v6-calls/references/raise-hand.md` — Bloc pattern sibling
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/device-management
