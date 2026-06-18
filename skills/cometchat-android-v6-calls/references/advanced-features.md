# Android V6 — advanced in-call features (Recording, PiP, Screen-share)

These use the same `calls-sdk-android:5.x` the rest of V6 calls relies on (the W1 peer dep). Every symbol below is verified against the decompiled `calls-sdk-android` 5.x API. Works in both the Compose and Kotlin-Views surfaces — drive UI state from a ViewModel; the SDK calls are surface-agnostic.

**Session handle:** `CallSession.getInstance()` returns the active `CallSession` singleton. Several controls also have static convenience methods directly on `CometChatCalls`.

---

## 1. Recording

Server-gated — recording must be enabled for the app in the CometChat dashboard first; otherwise the calls below no-op.

```kotlin
// Start / stop on demand (static convenience)
CometChatCalls.startRecording()
CometChatCalls.stopRecording()

// …or on the active session
CallSession.getInstance().startRecording()
CallSession.getInstance().stopRecording()
```

**Auto-start + hide the default button** at session config time (both builders expose these):

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder(activity)  // or no-arg SessionSettingsBuilder()
    .enableAutoStartRecording(true)   // begin recording when the call connects
    .hideRecordingButton(false)        // keep the kit's built-in record toggle (default UI)
    .build()
```

**React to recording state** via `MediaEventsListener` (registered the same way as the other call event listeners in this skill):

```kotlin
object : MediaEventsListener() {
    override fun onRecordingStarted() { /* show REC indicator */ }
    override fun onRecordingStopped() { /* hide REC indicator */ }
}
```

Verified: `CometChatCalls.startRecording()/stopRecording()` (static + `CallSession` instance), `SessionSettingsBuilder.enableAutoStartRecording(boolean)` + `hideRecordingButton(boolean)` (NOTE: `CallSettingsBuilder` is the deprecated v4 name, replaced by `SessionSettingsBuilder` in calls-sdk v5 — it no longer exists on android-v6), `MediaEventsListener.onRecordingStarted()/onRecordingStopped()`.

---

## 2. Picture-in-Picture

Two distinct things — don't confuse them:

- **In-call compact layout** (the SDK shrinks the call grid to a floating tile *inside your app*): `CallSession.enablePictureInPictureLayout()` / `disablePictureInPictureLayout()`.
- **System PiP** (the OS floats the call over other apps when the user leaves): static `CometChatCalls.enterPIPMode()` / `exitPIPMode()`. For OS-level PiP you must also declare the Activity `android:supportsPictureInPicture="true"` in the manifest and call `enterPIPMode()` from `onUserLeaveHint()`.

```kotlin
// in-call compact layout
CallSession.getInstance().enablePictureInPictureLayout()
CallSession.getInstance().disablePictureInPictureLayout()

// system PiP (manifest: android:supportsPictureInPicture="true")
override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    CometChatCalls.enterPIPMode()
}
```

Verified: `CallSession.enablePictureInPictureLayout()/disablePictureInPictureLayout()`, static `CometChatCalls.enterPIPMode()/exitPIPMode()`.

---

## 3. Screen sharing — receive only

**Android cannot locally INITIATE screen share** (that's a web-only capability). It *renders a remote participant's* shared screen automatically inside the call grid. You only wire a listener to react to it (e.g. switch to spotlight layout, show a banner):

```kotlin
object : ParticipantEventListener() {
    override fun onParticipantStartedScreenShare(participant: Participant) {
        // optional: CallSession.getInstance().setLayout(LayoutType.SPOTLIGHT)
    }
    override fun onParticipantStoppedScreenShare(participant: Participant) { }
}
```

Verified: `ParticipantEventListener.onParticipantStartedScreenShare(Participant)/onParticipantStoppedScreenShare(Participant)`. There is NO local `startScreenShare` symbol in `calls-sdk-android` 5.x — do not author one.

---

## Audio modes (cross-reference)

Speaker / earpiece / Bluetooth routing is already covered in `references/device-management.md` (`setAudioMode(AudioMode.SPEAKER/EARPIECE/BLUETOOTH/HEADPHONES)` + `MediaEventsListener.onAudioModeChanged`). Virtual Background is **not supported** by `calls-sdk-android` 5.x (no symbol) — it is a web / React Native / Flutter capability only; do not author it for Android.
