---
name: session-settings
description: Configure all SessionSettingsBuilder options — layouts, session type, audio mode, hide buttons, idle timeout, recording, camera facing. Use when customizing call UI or pre-session config. Triggers on "SessionSettingsBuilder", "session settings", "hide button", "layout type", "audio mode", "idle timeout".
inclusion: manual
---

# CometChat Calls SDK v5 — Session Settings

## Overview

`SessionSettingsBuilder` configures every aspect of a call session before joining. Settings are immutable after `build()` — pass the result to `joinSession()`.

## Key Imports

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.model.SessionType   // VIDEO, VOICE
import com.cometchat.calls.model.LayoutType    // TILE, SIDEBAR, SPOTLIGHT
import com.cometchat.calls.model.AudioMode     // SPEAKER, EARPIECE, BLUETOOTH, HEADPHONES
import com.cometchat.calls.model.CameraFacing  // FRONT, BACK
```

## Implementation

### Full Builder Example

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    // Identity
    .setTitle("Team Meeting")
    .setDisplayName("John Doe")

    // Session type & layout
    .setSessionType(SessionType.VIDEO)       // VIDEO or VOICE
    .setLayout(LayoutType.TILE)              // TILE, SIDEBAR, or SPOTLIGHT

    // Initial media state
    .startAudioMuted(false)
    .startVideoPaused(false)
    .setAudioMode(AudioMode.SPEAKER)         // SPEAKER, EARPIECE, BLUETOOTH, HEADPHONES
    .setInitialCameraFacing(CameraFacing.FRONT) // FRONT or BACK

    // Timeout & recording
    .setIdleTimeoutPeriod(300)               // seconds (default 300)
    .enableAutoStartRecording(false)

    // Hide panels
    .hideControlPanel(false)
    .hideHeaderPanel(false)
    .hideSessionTimer(false)

    // Hide individual buttons
    .hideLeaveSessionButton(false)
    .hideToggleAudioButton(false)
    .hideToggleVideoButton(false)
    .hideSwitchCameraButton(false)
    .hideRecordingButton(true)               // hidden by default
    .hideAudioModeButton(false)
    .hideRaiseHandButton(false)
    .hideShareInviteButton(true)             // hidden by default
    .hideParticipantListButton(false)
    .hideChangeLayoutButton(false)
    .hideChatButton(true)                    // hidden by default

    .build()
```

### Enum Values Reference

| Enum | Values |
|------|--------|
| `SessionType` | `VIDEO`, `VOICE` |
| `LayoutType` | `TILE`, `SIDEBAR`, `SPOTLIGHT` |
| `AudioMode` | `SPEAKER`, `EARPIECE`, `BLUETOOTH`, `HEADPHONES` |
| `CameraFacing` | `FRONT`, `BACK` |

### Common Presets

**Voice call:**
```kotlin
.setSessionType(SessionType.VOICE)
.setLayout(LayoutType.SPOTLIGHT)
.setAudioMode(AudioMode.EARPIECE)
.startVideoPaused(true)
```

**Video call:**
```kotlin
.setSessionType(SessionType.VIDEO)
.setLayout(LayoutType.TILE)
.setAudioMode(AudioMode.SPEAKER)
.startVideoPaused(false)
```

**Custom UI (hide default controls):**
```kotlin
.hideControlPanel(true)
.hideHeaderPanel(true)
```

### Button Defaults

| Button | Default Hidden? |
|--------|----------------|
| Recording | Yes (`true`) |
| Share Invite | Yes (`true`) |
| Chat | Yes (`true`) |
| All others | No (`false`) |

## Gotchas

- Settings are **immutable** after `build()` — create a new builder for changes
- `SessionType` uses `VOICE` not "AUDIO"
- `LayoutType` values: `TILE`, `SIDEBAR`, `SPOTLIGHT` — all caps
- `setIdleTimeoutPeriod()` takes seconds, default is 300 (5 minutes)
- Recording, share invite, and chat buttons are hidden by default
- These are pre-session configs only; use `CallSession` actions for runtime changes

## Sample App Reference

- `CallActivity.kt` — `joinSession()` method builds settings based on voice/video call type
