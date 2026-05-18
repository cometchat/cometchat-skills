---
name: audio-controls
description: Control audio during calls — mute/unmute microphone, switch audio output device (speaker, earpiece, bluetooth). Use when implementing audio toggle, audio mode switching, or custom mute buttons. Triggers on "mute audio", "unmute", "audio mode", "speaker", "earpiece", "bluetooth audio".
inclusion: manual
---

# CometChat Calls SDK v5 — Audio Controls

## Overview

Programmatically control the local microphone (mute/unmute) and audio output device (speaker, earpiece, Bluetooth, headphones) during an active call.

## Key Imports

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.model.AudioMode
import com.cometchat.calls.listeners.MediaEventsListener
```

## Implementation

### Mute / Unmute

```kotlin
val callSession = CallSession.getInstance()

callSession.muteAudio()    // mute microphone
callSession.unMuteAudio()  // unmute microphone
```

### Switch Audio Output

```kotlin
callSession.setAudioMode(AudioMode.SPEAKER)     // loudspeaker
callSession.setAudioMode(AudioMode.EARPIECE)     // phone earpiece
callSession.setAudioMode(AudioMode.BLUETOOTH)    // connected Bluetooth device
callSession.setAudioMode(AudioMode.HEADPHONES)   // wired headphones
```

### Listen for Audio Events

```kotlin
callSession.addMediaEventsListener(this, object : MediaEventsListener() {
    override fun onAudioMuted() {
        // Update mute button to "muted" state
    }
    override fun onAudioUnMuted() {
        // Update mute button to "unmuted" state
    }
    override fun onAudioModeChanged(audioMode: AudioMode) {
        when (audioMode) {
            AudioMode.SPEAKER -> { /* update icon */ }
            AudioMode.EARPIECE -> { /* update icon */ }
            AudioMode.BLUETOOTH -> { /* update icon */ }
            AudioMode.HEADPHONES -> { /* update icon */ }
        }
    }
    // ... other required overrides
    override fun onVideoPaused() {}
    override fun onVideoResumed() {}
    override fun onRecordingStarted() {}
    override fun onRecordingStopped() {}
    override fun onScreenShareStarted() {}
    override fun onScreenShareStopped() {}
    override fun onCameraFacingChanged(facing: CameraFacing) {}
})
```

### Initial Audio Settings (Pre-Session)

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    .startAudioMuted(true)              // join muted
    .setAudioMode(AudioMode.SPEAKER)    // initial output device
    .hideToggleAudioButton(false)       // show mute button
    .hideAudioModeButton(false)         // show audio mode button
    .build()
```

## Gotchas

- `muteAudio()` / `unMuteAudio()` only work during an active session
- Audio mode changes trigger `onAudioModeChanged()` on `MediaEventsListener`
- `AudioMode` enum: `SPEAKER`, `EARPIECE`, `BLUETOOTH`, `HEADPHONES`
- For voice calls, default to `AudioMode.EARPIECE`; for video calls, default to `AudioMode.SPEAKER`
- Bluetooth audio mode only works when a Bluetooth device is connected

## Sample App Reference

- `CallActivity.kt` — Sets `AudioMode.EARPIECE` for voice calls, `AudioMode.SPEAKER` for video calls
