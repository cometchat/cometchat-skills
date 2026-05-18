---
name: custom-ui
description: Build custom call UI — custom control panel, custom participant list, layout customization. Use when hiding default controls and building your own call interface. Triggers on "custom control panel", "custom participant list", "custom UI", "hideControlPanel", "custom call interface".
inclusion: manual
---

# CometChat Calls SDK v5 — Custom UI

## Overview

Build fully custom call interfaces by hiding the default SDK controls and implementing your own using `CallSession` actions and event listeners.

## Key Imports

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.listeners.MediaEventsListener
import com.cometchat.calls.listeners.SessionStatusListener
import com.cometchat.calls.listeners.ParticipantEventListener
import com.cometchat.calls.model.*
```

## Implementation

### 1. Hide Default Controls

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    .hideControlPanel(true)          // hide entire bottom bar
    .hideHeaderPanel(true)           // hide top header
    // Or hide individual buttons:
    // .hideToggleAudioButton(true)
    // .hideToggleVideoButton(true)
    // .hideParticipantListButton(true)
    .build()
```

### 2. Custom Control Panel

Create your own buttons and wire them to `CallSession` actions:

```kotlin
val callSession = CallSession.getInstance()
var isAudioMuted = false
var isVideoPaused = false

btnMute.setOnClickListener {
    if (isAudioMuted) callSession.unMuteAudio() else callSession.muteAudio()
}
btnVideo.setOnClickListener {
    if (isVideoPaused) callSession.resumeVideo() else callSession.pauseVideo()
}
btnSwitchCamera.setOnClickListener { callSession.switchCamera() }
btnEndCall.setOnClickListener {
    callSession.leaveSession()
    finish()
}
```

### 3. Sync UI with Media Events

```kotlin
callSession.addMediaEventsListener(this, object : MediaEventsListener() {
    override fun onAudioMuted() {
        runOnUiThread { isAudioMuted = true; btnMute.setImageResource(R.drawable.ic_mic_off) }
    }
    override fun onAudioUnMuted() {
        runOnUiThread { isAudioMuted = false; btnMute.setImageResource(R.drawable.ic_mic_on) }
    }
    override fun onVideoPaused() {
        runOnUiThread { isVideoPaused = true; btnVideo.setImageResource(R.drawable.ic_video_off) }
    }
    override fun onVideoResumed() {
        runOnUiThread { isVideoPaused = false; btnVideo.setImageResource(R.drawable.ic_video_on) }
    }
    // ... other overrides
})
```

### 4. Custom Participant List

Hide default and build with RecyclerView:

```kotlin
// Hide default
.hideParticipantListButton(true)

// Listen for participant updates
callSession.addParticipantEventListener(this, object : ParticipantEventListener() {
    override fun onParticipantListChanged(participants: List<Participant>) {
        runOnUiThread { adapter.updateParticipants(participants) }
    }
    // ... other overrides
})

// Participant actions from custom UI
adapter.onMuteClick = { participant -> callSession.muteParticipant(participant.uid) }
adapter.onPauseVideoClick = { participant -> callSession.pauseParticipantVideo(participant.uid) }
adapter.onPinClick = { participant ->
    if (participant.isPinned) callSession.unPinParticipant()
    else callSession.pinParticipant(participant.uid)
}
```

### 5. Layout Control

```kotlin
// Change layout programmatically
callSession.setLayout(LayoutType.TILE)
callSession.setLayout(LayoutType.SPOTLIGHT)

// Listen for layout changes
callSession.addLayoutListener(this, object : LayoutListener() {
    override fun onCallLayoutChanged(layoutType: LayoutType) { /* update UI */ }
    override fun onParticipantListVisible() {}
    override fun onParticipantListHidden() {}
    override fun onPictureInPictureLayoutEnabled() {}
    override fun onPictureInPictureLayoutDisabled() {}
})
```

### Available CallSession Actions

| Action | Method |
|--------|--------|
| Mute/unmute audio | `muteAudio()`, `unMuteAudio()` |
| Pause/resume video | `pauseVideo()`, `resumeVideo()` |
| Switch camera | `switchCamera()` |
| Change audio output | `setAudioMode(AudioMode)` |
| Change layout | `setLayout(LayoutType)` |
| Start/stop recording | `startRecording()`, `stopRecording()` |
| Pin/unpin participant | `pinParticipant(uid)`, `unPinParticipant()` |
| Mute participant | `muteParticipant(uid)` |
| Pause participant video | `pauseParticipantVideo(uid)` |
| Leave session | `leaveSession()` |
| Enable/disable PiP | `enablePictureInPictureLayout()`, `disablePictureInPictureLayout()` |
| Set chat badge count | `setChatButtonUnreadCount(count)` |

## Gotchas

- Always use `MediaEventsListener` to sync your custom UI with actual state
- `runOnUiThread {}` is required for UI updates from listener callbacks
- `hideControlPanel(true)` hides the entire bottom bar — individual hide methods are ignored
- The call view container still renders video tiles even with controls hidden
- Use `SessionStatusListener` to handle session end and navigate away

## Sample App Reference

- `CallActivity.kt` — Default UI with `SessionStatusListener` and `ButtonClickListener`
