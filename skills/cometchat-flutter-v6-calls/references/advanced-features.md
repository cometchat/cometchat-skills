# Flutter V6 — advanced in-call features (Recording, Virtual Background, Audio Modes, PiP, Screen-share)

V6 folds calls into `cometchat_chat_uikit:^6.0` (depends transitively on `cometchat_calls_sdk >=5.0.2`). Every symbol below is verified against `cometchat_calls_sdk-5.0.2`'s `CallSession`. All controls hang off the active session singleton:

```dart
final session = CallSession.getInstance();   // active call session (after onSuccess)
```

State changes arrive on `MediaEventListeners` / `ParticipantEventListeners` (register the same way this skill already registers `SessionStatusListeners` — via the session after the join succeeds, and remove them in `dispose`).

---

## 1. Recording

Server-gated — enable recording for the app in the CometChat dashboard first.

```dart
await CallSession.getInstance().startRecording();
await CallSession.getInstance().stopRecording();
```

React to state via `MediaEventListeners.onRecordingStarted()` / `onRecordingStopped()`.

Verified: `CallSession.startRecording()` / `stopRecording()`, `MediaEventListeners.onRecordingStarted()`.

---

## 2. Virtual Background

Flutter DOES support virtual background (unlike native iOS/Android). The SDK opens the kit's built-in settings panel (blur / image / clear); you don't build the picker:

```dart
await CallSession.getInstance().openVirtualBackgroundSettingsPanel();
```

Verified: `CallSession.openVirtualBackgroundSettingsPanel()`.

---

## 3. Audio modes

```dart
await CallSession.getInstance().setAudioModeType(AudioMode.speaker);
// AudioMode.speaker | AudioMode.earpiece | AudioMode.bluetooth  (no .headphones on Flutter)
```

React via `MediaEventListeners.onAudioModeChanged(...)`.

Verified: `CallSession.setAudioModeType(AudioMode)`; `enum AudioMode { speaker, earpiece, bluetooth }`.

---

## 4. Picture-in-Picture

- **In-call compact layout:** `enablePictureInPictureLayout()` / `disablePictureInPictureLayout()`.
- **System PiP** (OS floats the call when the user leaves the app): gate it on `isPipSupported()` then `enterPipMode()`.

```dart
final session = CallSession.getInstance();
await session.enablePictureInPictureLayout();
// system PiP
if (await session.isPipSupported()) {
  await session.enterPipMode();
}
```

Verified: `CallSession.enablePictureInPictureLayout()` / `disablePictureInPictureLayout()` / `enterPipMode()` / `isPipSupported()`.

---

## 5. Screen sharing — receive only

Flutter (like iOS/Android) cannot locally INITIATE screen share — it renders a remote participant's shared screen inside the call grid automatically. Wire a listener only to react:

```dart
// ParticipantEventListeners
@override
void onParticipantStartedScreenShare(Participant participant) { /* e.g. switch layout */ }
@override
void onParticipantStoppedScreenShare(Participant participant) { }
```

Verified: `ParticipantEventListeners.onParticipantStartedScreenShare(Participant)` / `onParticipantStoppedScreenShare(Participant)`. No local-initiation symbol exists — do not author one.

---

## Camera (cross-reference)

Front/back switch + on/off is in `references/device-management.md` (`CallSession.switchCamera()`). Custom Control Panel: the V6 kit owns the in-call control surface; per-button hiding is via the session/call settings, not a separate panel API.
