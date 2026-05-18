# Device management on Flutter V5 (GetX)

The Calls SDK exposes basic camera switching (`switchCamera()`); audio device management goes through platform-channel bridges to native AVAudioSession (iOS) / AudioManager (Android). For most apps, the kit's default control panel handles this; custom UI uses `flutter_callkit_incoming` or platform channels.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/device-management
**Read first:** `cometchat-react-calls/references/device-management.md` — UX patterns; the SDK conceptual model carries over.

---

## SDK API

```dart
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

// Camera flip
CometChatCalls.switchCamera();

// Speaker toggle (iOS + Android — wraps native AudioManager / AVAudioSession)
CometChatCalls.setSpeakerEnabled(true);
```

---

## Audio routing — flutter_callkit_incoming

For Bluetooth / AirPods routing, integrate `flutter_callkit_incoming` which wraps native CallKit on iOS and ConnectionService on Android. It exposes the audio route picker:

```dart
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';

// Toggle speaker
await FlutterCallkitIncoming.setAudioRoute(AudioRoute.speaker);
await FlutterCallkitIncoming.setAudioRoute(AudioRoute.earpiece);
```

For deep AirPods / Bluetooth control, the recommended pattern is letting the OS handle it via the system audio picker (CallKit on iOS, ConnectionService on Android both expose audio route control natively).

---

## Camera flip button

```dart
class CameraFlipButton extends StatelessWidget {
  const CameraFlipButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.flip_camera_ios),
      onPressed: () {
        CometChatCalls.switchCamera();
        SemanticsService.announce('Camera flipped', TextDirection.ltr);
      },
      tooltip: 'Flip camera',
    );
  }
}
```

---

## Speaker toggle

```dart
class SpeakerToggle extends GetView<CallController> {
  const SpeakerToggle({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() => IconButton(
      icon: Icon(controller.speakerOn.value
        ? Icons.volume_up
        : Icons.hearing),
      onPressed: () {
        controller.toggleSpeaker();
      },
      tooltip: controller.speakerOn.value ? 'Switch to earpiece' : 'Switch to speaker',
    ));
  }
}

class CallController extends GetxController {
  final speakerOn = false.obs;

  void toggleSpeaker() {
    speakerOn.value = !speakerOn.value;
    CometChatCalls.setSpeakerEnabled(speakerOn.value);
  }
}
```

---

## Anti-patterns

Web sister rules apply, plus Flutter-specific:

1. **Custom UI for audio device selection** instead of letting CallKit / ConnectionService handle it. System picker is what users expect.
2. **Calling `switchCamera` inline without await on the SDK promise.** Some platforms queue the switch; back-to-back calls drop.
3. **Forgetting `flutter_callkit_incoming.setAudioRoute` doesn't work without an active call session.** Call must be live.

---

## Verification checklist

- [ ] Camera flip wired to `CometChatCalls.switchCamera()`
- [ ] Speaker toggle uses `setSpeakerEnabled`
- [ ] System audio route picker (CallKit / ConnectionService) preferred for Bluetooth
- [ ] Real-device smoke: speaker toggle works
- [ ] Real-device smoke: camera flip works
- [ ] AirPods smoke: connecting AirPods routes audio (CallKit/ConnectionService handles)

---

## Pointers

- `cometchat-react-calls/references/device-management.md` — sister web reference (UX shape)
- `cometchat-flutter-v5-calls` SKILL.md — V5 hard rules
- `references/voip-push-end-to-end.md` (if you have it) — flutter_callkit_incoming setup
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/device-management
