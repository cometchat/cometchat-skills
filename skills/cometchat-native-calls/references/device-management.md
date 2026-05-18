# Device management on React Native

Same SDK API as web. RN-specific: `react-native-incall-manager` for audio routing (speaker / earpiece / Bluetooth) — the SDK's `setAudioOutputDevice` doesn't reach iOS/Android system audio routing the way it does in browsers.

**Canonical docs:** https://www.cometchat.com/docs/calls/react-native/device-management
**Read first:** `cometchat-react-calls/references/device-management.md` — pre-call picker pattern + empty-label gotcha + Bluetooth caveats.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

const cameras = await CometChatCalls.getVideoInputDevices();
const mics = await CometChatCalls.getAudioInputDevices();

await CometChatCalls.setVideoInputDevice(deviceId);
```

Camera + mic enumeration works the same as web. Speaker/output is where it diverges.

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

## Camera picker UI

```tsx
import { TouchableOpacity, Text, FlatList } from "react-native";

function CameraPicker({ onClose }: { onClose: () => void }) {
  const [cameras, setCameras] = useState<MediaDevice[]>([]);

  useEffect(() => {
    CometChatCalls.getVideoInputDevices().then(setCameras);
  }, []);

  return (
    <FlatList
      data={cameras}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={async () => {
            await CometChatCalls.setVideoInputDevice(item.id);
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.label}`}
        >
          <Text>{item.label || `Camera ${item.id.slice(0, 6)}`}</Text>
        </TouchableOpacity>
      )}
    />
  );
}
```

---

## Anti-patterns

Web sister rules apply, plus RN-specific:

1. **Forgetting `InCallManager.stop()` on hangup.** Music + phone audio sound wrong until reboot.
2. **Switching cameras mid-call without checking `setVideoInputDevice` await.** SDK queues the switch; switching twice rapidly without awaiting causes the second switch to drop.
3. **Skipping permissions check before enumeration.** Empty labels (same as web).
4. **Hardcoding speakerphone-on for voice calls.** User holding phone to ear wants earpiece. Default to earpiece for voice; speaker for video.

---

## Verification checklist

- [ ] `react-native-incall-manager` installed (it's a peer dep of the kit)
- [ ] `InCallManager.start({ media: "video"|"audio" })` on call start
- [ ] `InCallManager.stop()` on call end
- [ ] `setForceSpeakerphoneOn(true)` for video; `false` for voice
- [ ] Permissions checked before device enumeration
- [ ] Real-device smoke: AirPods connect mid-call → audio routes to AirPods
- [ ] Real-device smoke: speaker toggle on/off works
- [ ] Hangup smoke: music app's playback resumes correctly after call end

---

## Pointers

- `cometchat-react-calls/references/device-management.md` — sister web reference
- `cometchat-native-calls` SKILL.md — the seven hard rules (rule 1.5 = audio teardown)
- `references/voip-push-end-to-end.md` — incall manager + callkeep coordination
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/device-management
