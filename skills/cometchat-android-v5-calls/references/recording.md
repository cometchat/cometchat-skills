---
name: recording
description: Record call sessions with start/stop, auto-start recording, and recording events. Use when implementing call recording, accessing recordings from call logs, or showing recording indicators. Triggers on "recording", "record call", "auto start recording", "recording events".
inclusion: manual
---

# CometChat Calls SDK v5 — Recording

## Overview

Record call sessions server-side. Supports manual start/stop, auto-start via `SessionSettings`, and event listeners for recording state. Recordings are accessible via call logs or the CometChat Dashboard.

## Key Imports

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.listeners.MediaEventsListener
import com.cometchat.calls.listeners.ParticipantEventListener
import com.cometchat.calls.model.CallLogRequest
import com.cometchat.calls.model.Participant
```

## Implementation

### Start/Stop Recording

```kotlin
val callSession = CallSession.getInstance()
callSession.startRecording()
callSession.stopRecording()
```

### Auto-Start Recording (SessionSettings)

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    .enableAutoStartRecording(true)
    .hideRecordingButton(false)  // show button (hidden by default)
    .build()
```

### Listen for Recording Events (Local)

```kotlin
callSession.addMediaEventsListener(this, object : MediaEventsListener() {
    override fun onRecordingStarted() { showRecordingIndicator() }
    override fun onRecordingStopped() { hideRecordingIndicator() }
    // ... other required overrides
    override fun onAudioMuted() {}
    override fun onAudioUnMuted() {}
    override fun onVideoPaused() {}
    override fun onVideoResumed() {}
    override fun onScreenShareStarted() {}
    override fun onScreenShareStopped() {}
    override fun onAudioModeChanged(audioMode: AudioMode) {}
    override fun onCameraFacingChanged(facing: CameraFacing) {}
})
```

### Track Participant Recording

```kotlin
callSession.addParticipantEventListener(this, object : ParticipantEventListener() {
    override fun onParticipantStartedRecording(participant: Participant) {
        Log.d(TAG, "${participant.name} started recording")
    }
    override fun onParticipantStoppedRecording(participant: Participant) {
        Log.d(TAG, "${participant.name} stopped recording")
    }
    // ... other required overrides
})
```

### Access Recordings from Call Logs

```kotlin
val request = CallLogRequest.CallLogRequestBuilder().setHasRecording(true).build()
request.fetchNext(object : CometChatCalls.CallbackListener<List<CallLog>>() {
    override fun onSuccess(callLogs: List<CallLog>) {
        callLogs.forEach { log ->
            log.recordings?.forEach { recording ->
                Log.d(TAG, "URL: ${recording.recordingURL}, Duration: ${recording.duration}s")
            }
        }
    }
    override fun onError(e: CometChatException) {}
})
```

## Gotchas

- Recording must be **enabled** in your CometChat Dashboard
- The recording button is **hidden by default** — use `.hideRecordingButton(false)` to show it
- All participants are notified when recording starts
- Recordings are stored server-side and available after the call ends
- `Recording` object has: `rid`, `recordingURL`, `startTime`, `endTime`, `duration`

## Sample App Reference

- `CallActivity.kt` — Session settings configuration (recording button visibility)
