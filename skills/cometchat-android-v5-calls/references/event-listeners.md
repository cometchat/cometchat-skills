---
name: event-listeners
description: Register all five call event listeners — SessionStatusListener, ParticipantEventListener, MediaEventsListener, ButtonClickListener, LayoutListener. Use when handling call events, session status, participant changes, media state, button clicks, or layout changes. Triggers on "event listener", "session listener", "participant listener", "media listener", "button click", "layout listener".
inclusion: manual
---

# CometChat Calls SDK v5 — Event Listeners

## Overview

Five lifecycle-aware listeners monitor call events. All are registered on `CallSession.getInstance()` and auto-removed when the `LifecycleOwner` (Activity/Fragment) is destroyed.

## Key Imports

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.SessionStatusListener
import com.cometchat.calls.listeners.ParticipantEventListener
import com.cometchat.calls.listeners.MediaEventsListener
import com.cometchat.calls.listeners.ButtonClickListener
import com.cometchat.calls.listeners.LayoutListener
import com.cometchat.calls.model.Participant
import com.cometchat.calls.model.AudioMode
import com.cometchat.calls.model.CameraFacing
import com.cometchat.calls.model.LayoutType
```

## Implementation

### 1. SessionStatusListener

```kotlin
val callSession = CallSession.getInstance()

callSession.addSessionStatusListener(this, object : SessionStatusListener() {
    override fun onSessionJoined() { /* connected */ }
    override fun onSessionLeft() { finish() }
    override fun onSessionTimedOut() { finish() }
    override fun onConnectionLost() { /* show reconnecting UI */ }
    override fun onConnectionRestored() { /* hide reconnecting UI */ }
    override fun onConnectionClosed() { finish() }
})
```

### 2. ParticipantEventListener

```kotlin
callSession.addParticipantEventListener(this, object : ParticipantEventListener() {
    override fun onParticipantJoined(participant: Participant) {}
    override fun onParticipantLeft(participant: Participant) {}
    override fun onParticipantListChanged(participants: List<Participant>) {}
    override fun onParticipantAudioMuted(participant: Participant) {}
    override fun onParticipantAudioUnmuted(participant: Participant) {}
    override fun onParticipantVideoPaused(participant: Participant) {}
    override fun onParticipantVideoResumed(participant: Participant) {}
    override fun onParticipantHandRaised(participant: Participant) {}
    override fun onParticipantHandLowered(participant: Participant) {}
    override fun onParticipantStartedScreenShare(participant: Participant) {}
    override fun onParticipantStoppedScreenShare(participant: Participant) {}
    override fun onParticipantStartedRecording(participant: Participant) {}
    override fun onParticipantStoppedRecording(participant: Participant) {}
    override fun onDominantSpeakerChanged(participant: Participant) {}
})
```

### 3. MediaEventsListener

```kotlin
callSession.addMediaEventsListener(this, object : MediaEventsListener() {
    override fun onAudioMuted() {}
    override fun onAudioUnMuted() {}
    override fun onVideoPaused() {}
    override fun onVideoResumed() {}
    override fun onRecordingStarted() {}
    override fun onRecordingStopped() {}
    override fun onScreenShareStarted() {}
    override fun onScreenShareStopped() {}
    override fun onAudioModeChanged(audioMode: AudioMode) {}
    override fun onCameraFacingChanged(facing: CameraFacing) {}
})
```

### 4. ButtonClickListener

```kotlin
callSession.addButtonClickListener(this, object : ButtonClickListener() {
    override fun onLeaveSessionButtonClicked() {}
    override fun onToggleAudioButtonClicked() {}
    override fun onToggleVideoButtonClicked() {}
    override fun onSwitchCameraButtonClicked() {}
    override fun onRaiseHandButtonClicked() {}
    override fun onShareInviteButtonClicked() {}
    override fun onChangeLayoutButtonClicked() {}
    override fun onParticipantListButtonClicked() {}
    override fun onChatButtonClicked() {}
    override fun onRecordingToggleButtonClicked() {}
})
```

### 5. LayoutListener

```kotlin
callSession.addLayoutListener(this, object : LayoutListener() {
    override fun onCallLayoutChanged(layoutType: LayoutType) {}
    override fun onParticipantListVisible() {}
    override fun onParticipantListHidden() {}
    override fun onPictureInPictureLayoutEnabled() {}
    override fun onPictureInPictureLayoutDisabled() {}
})
```

## Gotchas

- All listeners are **lifecycle-aware** — no manual removal needed
- Pass `this` (Activity/Fragment) as the first argument for lifecycle binding
- Register listeners **after** `joinSession()` succeeds (in the `onSuccess` callback)
- Button click events fire **before** the SDK's default action
- `Participant` object has: `uid`, `name`, `avatar`, `isAudioMuted`, `isVideoPaused`, `isPresenting`, `isPinned`, `raisedHandTimestamp`
- Use `runOnUiThread {}` for UI updates inside listener callbacks

## Sample App Reference

- `CallActivity.kt` — `setupCallListeners()` registers `SessionStatusListener` and `ButtonClickListener`
