# Picture-in-Picture on React Native

Both Android and iOS support PiP for video calls — but the integration paths are different. Android exposes `PictureInPictureParams` via `Activity` APIs; iOS exposes `AVPictureInPictureController` (and CallKit handles it for VoIP calls). RN bridges both via native modules.

---

## Android — Activity-level PiP

Android PiP is an Activity attribute. The activity declares it supports PiP, and you transition into PiP by calling `enterPictureInPictureMode()` from native (RN exposes a bridge).

### Manifest

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity
  android:name=".MainActivity"
  android:supportsPictureInPicture="true"
  android:configChanges="screenSize|smallestScreenSize|screenLayout|orientation|keyboardHidden">
  <!-- ... -->
</activity>
```

`configChanges` is critical — without it, Android destroys + recreates the activity on PiP transition, which kills the WebRTC connection.

### Bridge

`react-native-webrtc` ships a helper module (in some versions) for entering PiP. If your version doesn't have it, write a tiny native module:

```kotlin
// android/app/src/main/java/com/yourapp/PictureInPictureModule.kt
package com.yourapp

import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class PictureInPictureModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "PictureInPicture"

  @ReactMethod
  fun enterPip(promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No current activity")
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.reject("UNSUPPORTED", "Android < 8.0 doesn't support PiP")
      return
    }

    val aspectRatio = Rational(16, 9)
    val params = PictureInPictureParams.Builder()
      .setAspectRatio(aspectRatio)
      .build()

    val ok = activity.enterPictureInPictureMode(params)
    if (ok) promise.resolve(null) else promise.reject("FAILED", "Couldn't enter PiP")
  }
}
```

Register in `MainApplication.kt`:

```kotlin
override fun getPackages(): List<ReactPackage> {
  val packages = PackageList(this).packages
  packages.add(PictureInPicturePackage())          // your package wrapping the module
  return packages
}
```

### React side

```ts
import { NativeModules, Platform } from "react-native";

const PictureInPicture = NativeModules.PictureInPicture;

async function enterPiP() {
  if (Platform.OS !== "android") return;
  try {
    await PictureInPicture.enterPip();
  } catch (err) {
    console.warn("PiP failed:", err);
  }
}
```

### Listening for PiP transitions

On Android, the activity gets `onPictureInPictureModeChanged` callback. RN exposes this via `AppState`:

```ts
import { AppState, type AppStateStatus } from "react-native";

useEffect(() => {
  const handler = (state: AppStateStatus) => {
    // 'background' fires when entering PiP on some Android versions
    // 'active' fires on returning
    if (state === "active") {
      // restore full UI
    }
  };
  const sub = AppState.addEventListener("change", handler);
  return () => sub.remove();
}, []);
```

Better — emit a custom event from your native module on `onPictureInPictureModeChanged` and listen in JS:

```ts
import { NativeEventEmitter, NativeModules } from "react-native";

const emitter = new NativeEventEmitter(NativeModules.PictureInPicture);
useEffect(() => {
  const sub = emitter.addListener("pipModeChanged", ({ inPip }: { inPip: boolean }) => {
    setInPip(inPip);
  });
  return () => sub.remove();
}, []);
```

---

## iOS — CallKit handles it for VoIP calls

The simplest iOS PiP path: **don't write any.** If you've integrated CallKit (rule 1.2 in the SKILL.md, mandatory for standalone-mode VoIP), iOS auto-handles PiP for active video calls when the user backgrounds the app. The system shows your CallKit-reported call in a small floating window.

For non-CallKit calls (in-foreground only), you need `AVPictureInPictureController`. This is involved on iOS because `AVPictureInPictureController` requires an `AVSampleBufferDisplayLayer` — it doesn't work directly with `<RTCView />`.

### AVPictureInPictureController bridge

`react-native-webrtc` ≥ 119 ships an `RTCVideoView` that supports PiP via a system-managed display layer. The bridge:

```ts
import { RTCView } from "react-native-webrtc";

// react-native-webrtc 119+
<RTCView
  streamURL={remoteStream.toURL()}
  style={styles.remoteVideo}
  pictureInPicture={true}
  onPictureInPictureStart={() => setInPip(true)}
  onPictureInPictureStop={() => setInPip(false)}
/>
```

Older versions: write a wrapper around `AVPictureInPictureController` and a `WebRTCVideoView` subclass that exposes its `AVSampleBufferDisplayLayer` to the controller. Substantial native work; deferring to CallKit is the right call for most apps.

### Info.plist

Background modes must include `audio` (rule 1.3 in the SKILL.md). PiP itself doesn't need a separate capability; it inherits from "audio" + active call.

---

## App state preservation across PiP

When the app enters PiP (Android) or background-with-active-call (iOS), the call state must persist. Practical rules:

1. **Don't tear down the WebRTC connection** on `componentWillUnmount` of the call screen. The screen survives PiP; tearing down kills the call.
2. **Hide the in-page video** when PiP is active — same rule as web. Two videos rendering = bad UX, double battery.
3. **Restore on PiP exit** — listen to `pipModeChanged` and re-render the full call surface.

```tsx
function CallScreen() {
  const [inPip, setInPip] = useState(false);

  return (
    <View style={[styles.container, inPip && styles.minimalPip]}>
      <RTCView
        streamURL={remoteStream?.toURL()}
        style={inPip ? styles.pipFullSize : styles.normalSize}
        pictureInPicture={true}
        onPictureInPictureStart={() => setInPip(true)}
        onPictureInPictureStop={() => setInPip(false)}
      />
      {!inPip && <ControlPanel onEnd={endCall} />}
    </View>
  );
}
```

The control panel is only visible in non-PiP mode; PiP is video-only by design.

---

## Auto-PiP on app backgrounding

Common UX: user presses Home button or switches apps → call auto-enters PiP so video keeps playing.

### Android

In `MainActivity.kt`:

```kotlin
override fun onUserLeaveHint() {
  super.onUserLeaveHint()
  // User pressed Home — auto-enter PiP if a call is active
  if (isCallActive() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    enterPictureInPictureMode(PictureInPictureParams.Builder().build())
  }
}

private fun isCallActive(): Boolean {
  // bridge to JS state — store this in a SharedPreferences flag
  return getSharedPreferences("call", MODE_PRIVATE).getBoolean("active", false)
}
```

JS side: write the flag whenever the call starts/ends:

```ts
import { NativeModules } from "react-native";

useEffect(() => {
  NativeModules.PictureInPicture.setCallActive(true);
  return () => NativeModules.PictureInPicture.setCallActive(false);
}, []);
```

### iOS

CallKit handles this — if you've reported the call to CallKit (rule 1.2), iOS auto-PiPs on background. No bridge code needed for the auto-PiP path.

For non-CallKit calls (rare in production calling apps), use `react-native-webrtc`'s `pictureInPicture` prop with auto-enter behavior at the native level.

---

## Anti-patterns

1. **Skipping `configChanges` on the manifest activity.** PiP transition destroys + recreates the activity → call dies.
2. **Tearing down WebRTC in PiP transition.** Same outcome — call dies.
3. **No iOS Background Modes `audio` capability.** PiP video plays without sound; user thinks it's broken.
4. **Auto-PiP on every app background, including non-call screens.** User opens settings, comes back to a PiP'd home screen. Gate on `isCallActive()`.
5. **Rendering control panel inside PiP window.** PiP windows are small; controls don't fit. Hide them.
6. **Using two separate `<RTCView />` instances** — one for normal, one for PiP. The `pictureInPicture` prop on a single view is the right pattern.
7. **iOS PiP without CallKit.** Doesn't work for backgrounded calls — only foregrounded. CallKit is required for "real" PiP.

---

## Verification checklist

**Android:**
- [ ] `android:supportsPictureInPicture="true"` on the activity
- [ ] `android:configChanges` includes screenSize/smallestScreenSize/screenLayout/orientation
- [ ] Native PiP module registered + bridged
- [ ] `onUserLeaveHint` auto-PiP gated on `isCallActive()`
- [ ] PiP entry uses 16:9 aspect ratio (or matches stream resolution)
- [ ] PiP mode change emits to JS; controls hidden in PiP

**iOS:**
- [ ] CallKit integrated (rule 1.2 in SKILL.md)
- [ ] Background Modes: audio + voip + remote-notification
- [ ] `react-native-webrtc` ≥ 119 if using `pictureInPicture` prop
- [ ] PiP transitions don't tear down call

**Real-device smoke:**
- [ ] Android: press Home during call → PiP appears, video keeps playing, audio continues
- [ ] Android: tap PiP window → call screen restored, controls visible
- [ ] iOS: press Home during call → CallKit-managed PiP appears
- [ ] iOS: tap PiP → app foregrounds, full call screen visible

---

## Pointers

- `references/custom-ui.md` — composing custom call surfaces (PiP integration via the `pictureInPicture` prop pattern)
- `references/voip-push-end-to-end.md` — CallKit which handles iOS PiP for free
- `cometchat-android-v5-calls/references/picture-in-picture.md` — Android-native PiP reference (deeper Android-specific patterns)
- `cometchat-react-calls/references/picture-in-picture.md` — Web PiP (different APIs but same UX shape)
- `cometchat-native-calls` SKILL.md — base hard rules
