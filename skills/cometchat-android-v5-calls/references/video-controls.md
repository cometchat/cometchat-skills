---
name: video-controls
description: Control video during calls — pause/resume camera, switch front/back camera. Use when implementing camera toggle, camera switch, or custom video buttons. Triggers on "pause video", "resume video", "switch camera", "camera toggle", "video controls".
inclusion: manual
---

# CometChat Calls SDK v5 — Video Controls

## Overview

Programmatically control the local camera (pause/resume) and switch between front/back cameras during an active call.

## Key Imports

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.model.CameraFacing
import com.cometchat.calls.listeners.MediaEventsListener
```

## Implementation

### Pause / Resume Video

```kotlin
val callSession = CallSession.getInstance()

callSession.pauseVideo()   // turn off camera
callSession.resumeVideo()  // turn on camera
```

### Switch Camera

```kotlin
callSession.switchCamera()  // toggle front ↔ back
```

### Listen for Video Events

```kotlin
callSession.addMediaEventsListener(this, object : MediaEventsListener() {
    override fun onVideoPaused() {
        // Update video button to "off" state, show avatar
    }
    override fun onVideoResumed() {
        // Update video button to "on" state, show video
    }
    override fun onCameraFacingChanged(facing: CameraFacing) {
        when (facing) {
            CameraFacing.FRONT -> { /* front camera active */ }
            CameraFacing.BACK -> { /* rear camera active */ }
        }
    }
    // ... other required overrides
    override fun onAudioMuted() {}
    override fun onAudioUnMuted() {}
    override fun onRecordingStarted() {}
    override fun onRecordingStopped() {}
    override fun onScreenShareStarted() {}
    override fun onScreenShareStopped() {}
    override fun onAudioModeChanged(audioMode: AudioMode) {}
})
```

### Initial Video Settings (Pre-Session)

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    .setSessionType(SessionType.VIDEO)
    .startVideoPaused(false)                        // start with camera on
    .setInitialCameraFacing(CameraFacing.FRONT)     // start with front camera
    .hideToggleVideoButton(false)                   // show video toggle
    .hideSwitchCameraButton(false)                  // show camera switch
    .build()
```

## Gotchas

- `pauseVideo()` / `resumeVideo()` only work during an active session
- `switchCamera()` toggles between front and back — no parameter needed
- `CameraFacing` enum: `FRONT`, `BACK`
- For voice calls (`SessionType.VOICE`), set `.startVideoPaused(true)`
- Camera permissions must be granted at runtime before joining

## Sample App Reference

- `CallActivity.kt` — Sets `startVideoPaused(true)` for voice calls
