---
name: screen-sharing
description: Handle screen sharing in calls. Android can receive/view screen shares from web clients. Use when implementing screen share viewing, listening for screen share events, or checking presenter status. Triggers on "screen sharing", "screen share", "presenter", "share screen".
inclusion: manual
---

# CometChat Calls SDK v5 — Screen Sharing

## Overview

The Android Calls SDK can **receive and display** screen shares initiated from web clients. Android does not support initiating screen sharing. The call layout automatically adjusts to display shared content.

## Key Imports

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.ParticipantEventListener
import com.cometchat.calls.model.Participant
```

## Implementation

### Listen for Screen Share Events

```kotlin
val callSession = CallSession.getInstance()

callSession.addParticipantEventListener(this, object : ParticipantEventListener() {
    override fun onParticipantStartedScreenShare(participant: Participant) {
        Log.d(TAG, "${participant.name} started screen sharing")
        // Layout auto-adjusts to show shared screen
    }
    override fun onParticipantStoppedScreenShare(participant: Participant) {
        Log.d(TAG, "${participant.name} stopped screen sharing")
        // Layout returns to normal
    }
    // ... other required overrides
    override fun onParticipantJoined(participant: Participant) {}
    override fun onParticipantLeft(participant: Participant) {}
    override fun onParticipantListChanged(participants: List<Participant>) {}
    override fun onParticipantAudioMuted(participant: Participant) {}
    override fun onParticipantAudioUnmuted(participant: Participant) {}
    override fun onParticipantVideoPaused(participant: Participant) {}
    override fun onParticipantVideoResumed(participant: Participant) {}
    override fun onParticipantStartedRecording(participant: Participant) {}
    override fun onParticipantStoppedRecording(participant: Participant) {}
    override fun onParticipantHandRaised(participant: Participant) {}
    override fun onParticipantHandLowered(participant: Participant) {}
    override fun onDominantSpeakerChanged(participant: Participant) {}
})
```

### Check Presenter Status

```kotlin
override fun onParticipantListChanged(participants: List<Participant>) {
    val presenter = participants.find { it.isPresenting }
    if (presenter != null) {
        Log.d(TAG, "${presenter.name} is sharing their screen")
    }
}
```

### Show/Hide Screen Share Button

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    .hideScreenSharingButton(true)  // hide since Android can't initiate
    .build()
```

## Gotchas

- Android **cannot initiate** screen sharing — only web clients can
- The SDK automatically adjusts the layout when a screen share starts
- Use `participant.isPresenting` to check if someone is sharing
- Consider hiding the screen share button on Android since it's not functional for initiating
- `MediaEventsListener` also has `onScreenShareStarted()`/`onScreenShareStopped()` for local events

## Sample App Reference

- `CallActivity.kt` — Session settings configuration
