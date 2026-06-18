# Device management on React Native

**RN is NOT web.** The web `getVideoInputDevices()` / `getAudioInputDevices()` / `setVideoInputDevice()` enumeration getters **do not exist on the RN Calls SDK** — there is no `MediaDevices.enumerateDevices()` equivalent. On mobile there are only two cameras (front / rear) and a fixed set of audio routes (earpiece / speaker / Bluetooth / wired), so the RN SDK exposes:

- **Camera:** `CometChatCalls.switchCamera()` — toggles front ↔ rear (no device-id picker).
- **Audio output:** `CometChatCalls.setAudioMode(mode)` where `mode` is an `AUDIO_MODE` value (`"SPEAKER" | "EARPIECE" | "BLUETOOTH" | "HEADPHONES"`).

The thesis of this reference is therefore **`react-native-incall-manager`** for real-world routing UX.

**Canonical docs:** https://www.cometchat.com/docs/calls/react-native/device-management
**Read first:** `cometchat-react-calls/references/device-management.md` — pre-call picker pattern + empty-label gotcha + Bluetooth caveats (web-only enumeration semantics; do NOT carry the getters over to RN).

---

## SDK API (RN)

```ts
import { CometChatCalls, AUDIO_MODE } from "@cometchat/calls-sdk-react-native";

// Front ↔ rear camera toggle (no enumeration / no device ids on RN):
CometChatCalls.switchCamera();

// Audio output route (mobile only):
CometChatCalls.setAudioMode(AUDIO_MODE.SPEAKER);   // or EARPIECE / BLUETOOTH / HEADPHONES
```

There is no camera/mic device list to enumerate — `switchCamera()` flips between the two on-device cameras. For fine-grained audio routing (and reliable Bluetooth/headset detection) use `react-native-incall-manager` below.

---

## Audio routing — react-native-incall-manager

For speaker on/off + Bluetooth/earpiece routing, RN integrates `react-native-incall-manager` (already a peer dep of the kit when calls are integrated):

```ts
import InCallManager from "react-native-incall-manager";

// Force speakerphone on (default for video calls)
InCallManager.setForceSpeakerphoneOn(true);

// Earpiece (small speaker near top of phone — for private 1:1 voice calls)
InCallManager.setForceSpeakerphoneOn(false);

// Toggle Bluetooth audio
InCallManager.setBluetoothScoOn(true);

// Stop on call end (CRITICAL — restores normal audio routing)
InCallManager.stop();
```

`InCallManager.stop()` MUST be called on hangup or the device's audio routing stays "in-call mode" — affects other apps' audio until phone reboots. (Same canonical "music doesn't resume" bug as iOS rule 1.5.)

---

## Bluetooth detection

```ts
import InCallManager from "react-native-incall-manager";

// Listen for Bluetooth connection events (iOS + Android)
const sub = InCallManager.addListener("WiredHeadset", (data) => {
  if (data.isPlugged) {
    console.log("Headphones plugged in");
  } else {
    console.log("Headphones unplugged");
  }
});

// Bluetooth state
InCallManager.startProximitySensor();   // optional — auto-screen-off when phone near ear
```

`react-native-incall-manager` doesn't fire a clean "Bluetooth connected" event consistently across platforms. The reliable signal: poll `InCallManager.getAudioRoute()` periodically, or use platform-channel native bridges for production-grade Bluetooth detection.

---

## Camera switch UI (front ↔ rear)

There's no device picker on RN — just a flip button calling `switchCamera()`:

```tsx
import { TouchableOpacity, Text } from "react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

function FlipCameraButton() {
  return (
    <TouchableOpacity
      onPress={() => CometChatCalls.switchCamera()}   // toggles front ↔ rear; returns void
      accessibilityRole="button"
      accessibilityLabel="Switch camera"
    >
      <Text>Flip camera</Text>
    </TouchableOpacity>
  );
}
```

## Audio output picker (SPEAKER / EARPIECE / BLUETOOTH / HEADPHONES)

```tsx
import { TouchableOpacity, Text, View } from "react-native";
import { CometChatCalls, AUDIO_MODE } from "@cometchat/calls-sdk-react-native";

const MODES = [AUDIO_MODE.SPEAKER, AUDIO_MODE.EARPIECE, AUDIO_MODE.BLUETOOTH, AUDIO_MODE.HEADPHONES];

function AudioOutputPicker() {
  return (
    <View>
      {MODES.map((mode) => (
        <TouchableOpacity
          key={mode}
          onPress={() => CometChatCalls.setAudioMode(mode)}
          accessibilityRole="button"
          accessibilityLabel={`Route audio to ${mode}`}
        >
          <Text>{mode}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

Note: `setAudioMode` is the SDK-level route hint; `react-native-incall-manager` (above) remains the most reliable cross-platform path for forcing speaker/Bluetooth and detecting headset plug/unplug.

---

## Anti-patterns

Web sister rules apply, plus RN-specific:

1. **Forgetting `InCallManager.stop()` on hangup.** Music + phone audio sound wrong until reboot.
2. **Spamming `switchCamera()` rapidly.** The SDK queues the front/rear toggle; double-tapping can drop the second toggle. Debounce the flip button.
3. **Assuming web-style device enumeration on RN.** There is no `getVideoInputDevices()`/`getAudioInputDevices()`/`setVideoInputDevice()` — use `switchCamera()` + `setAudioMode()`.
4. **Hardcoding speakerphone-on for voice calls.** User holding phone to ear wants earpiece. Default to earpiece for voice; speaker for video.

---

## Verification checklist

- [ ] `react-native-incall-manager` installed (it's a peer dep of the kit)
- [ ] `InCallManager.start({ media: "video"|"audio" })` on call start
- [ ] `InCallManager.stop()` on call end
- [ ] `setForceSpeakerphoneOn(true)` for video; `false` for voice
- [ ] Camera flip uses `CometChatCalls.switchCamera()` (no device enumeration on RN)
- [ ] Audio route changes use `CometChatCalls.setAudioMode(AUDIO_MODE.*)` and/or InCallManager
- [ ] Real-device smoke: AirPods connect mid-call → audio routes to AirPods
- [ ] Real-device smoke: speaker toggle on/off works
- [ ] Hangup smoke: music app's playback resumes correctly after call end

---

## Pointers

- `cometchat-react-calls/references/device-management.md` — sister web reference
- `cometchat-native-calls` SKILL.md — the seven hard rules (rule 1.5 = audio teardown)
- `references/voip-push-end-to-end.md` — incall manager + callkeep coordination
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/device-management
