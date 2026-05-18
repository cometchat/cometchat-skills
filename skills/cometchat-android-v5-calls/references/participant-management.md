---
name: participant-management
description: Manage call participants — mute, pause video, pin/unpin, raise hand, view participant list. Use when implementing moderation, participant actions, or custom participant UI. Triggers on "mute participant", "pin participant", "participant list", "raise hand", "kick participant", "participant management".
inclusion: manual
---

# CometChat Calls SDK v5 — Participant Management

## Overview

Control other participants during calls: mute their audio, pause their video, pin/unpin in layout. Monitor participant state via `ParticipantEventListener`. Raise hand is available for self.

## Key Imports

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.ParticipantEventListener
import com.cometchat.calls.model.Participant
```

## Implementation

### Participant Actions

```kotlin
val callSession = CallSession.getInstance()

// Mute a participant's audio
callSession.muteParticipant(participant.uid)

// Pause a participant's video
callSession.pauseParticipantVideo(participant.uid)

// Pin a participant (keeps them prominent in layout)
callSession.pinParticipant(participant.uid)

// Unpin (return to automatic speaker highlighting)
callSession.unPinParticipant()
```

### Raise Hand (Self)

Raise hand is controlled via the built-in UI button. Listen for it:

```kotlin
callSession.addButtonClickListener(this, object : ButtonClickListener() {
    override fun onRaiseHandButtonClicked() {
        Log.d(TAG, "Hand raised/lowered")
    }
    // ... other overrides
})
```

### Listen for Participant Events

```kotlin
callSession.addParticipantEventListener(this, object : ParticipantEventListener() {
    override fun onParticipantJoined(participant: Participant) {}
    override fun onParticipantLeft(participant: Participant) {}
    override fun onParticipantListChanged(participants: List<Participant>) {
        // Full participant list — use for UI updates
    }
    override fun onParticipantAudioMuted(participant: Participant) {}
    override fun onParticipantAudioUnmuted(participant: Participant) {}
    override fun onParticipantVideoPaused(participant: Participant) {}
    override fun onParticipantVideoResumed(participant: Participant) {}
    override fun onParticipantHandRaised(participant: Participant) {}
    override fun onParticipantHandLowered(participant: Participant) {}
    override fun onDominantSpeakerChanged(participant: Participant) {}
    override fun onParticipantStartedScreenShare(participant: Participant) {}
    override fun onParticipantStoppedScreenShare(participant: Participant) {}
    override fun onParticipantStartedRecording(participant: Participant) {}
    override fun onParticipantStoppedRecording(participant: Participant) {}
})
```

### Participant Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `uid` | String | CometChat user ID |
| `name` | String | Display name |
| `avatar` | String | Avatar URL |
| `isAudioMuted` | Boolean | Audio muted? |
| `isVideoPaused` | Boolean | Video paused? |
| `isPinned` | Boolean | Pinned in layout? |
| `isPresenting` | Boolean | Screen sharing? |
| `raisedHandTimestamp` | Long | 0 if not raised |

### Show/Hide Participant List Button

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    .hideParticipantListButton(false)  // show participant list
    .hideRaiseHandButton(false)        // show raise hand
    .build()
```

## Gotchas

- By default, **all participants** have moderator access (can mute/pause others)
- Implement role-based restrictions in your app logic if needed
- Pinning only affects **your local view** — other participants can pin independently
- `unPinParticipant()` takes no arguments — unpins whoever is currently pinned
- `raisedHandTimestamp > 0` means hand is raised
- There is no "kick" API — only mute and pause video

## Sample App Reference

- `CallActivity.kt` — `setupCallListeners()` with `ButtonClickListener`
