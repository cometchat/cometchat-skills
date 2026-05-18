---
name: call-logs
description: Fetch call history using CallLogRequest with pagination and filters. Use when displaying call logs, filtering by type/status/recording, or accessing recordings. Triggers on "call logs", "call history", "CallLogRequest", "fetch recordings".
inclusion: manual
---

# CometChat Calls SDK v5 — Call Logs

## Overview

Retrieve call history using `CallLogRequest` with pagination, filtering by type, status, direction, recordings, and specific users/groups.

## Key Imports

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.model.CallLog
import com.cometchat.calls.model.CallLogRequest
import com.cometchat.calls.model.Recording
import com.cometchat.calls.exceptions.CometChatException
```

## Implementation

### Basic Fetch

```kotlin
val callLogRequest = CallLogRequest.CallLogRequestBuilder()
    .setLimit(30)
    .build()

callLogRequest.fetchNext(object : CometChatCalls.CallbackListener<List<CallLog>>() {
    override fun onSuccess(callLogs: List<CallLog>) {
        for (log in callLogs) {
            Log.d(TAG, "Session: ${log.sessionID}, Duration: ${log.totalDuration}, Status: ${log.status}")
        }
    }
    override fun onError(e: CometChatException) {
        Log.e(TAG, "Error: ${e.message}")
    }
})
```

### Filtered Queries

```kotlin
// Video calls only
CallLogRequest.CallLogRequestBuilder().setSessionType("video").setLimit(20).build()

// Calls with recordings
CallLogRequest.CallLogRequestBuilder().setHasRecording(true).build()

// Missed incoming calls
CallLogRequest.CallLogRequestBuilder().setCallStatus("missed").setCallDirection("incoming").build()

// Calls with a specific user
CallLogRequest.CallLogRequestBuilder().setUid("user_id").build()

// Meeting calls only
CallLogRequest.CallLogRequestBuilder().setCallCategory("meet").build()
```

### Pagination

```kotlin
// Forward pagination
callLogRequest.fetchNext(listener)

// Backward pagination
callLogRequest.fetchPrevious(listener)
```

### Access Recordings

```kotlin
for (callLog in callLogs) {
    if (callLog.isHasRecording) {
        callLog.recordings?.forEach { recording ->
            Log.d(TAG, "URL: ${recording.recordingURL}")
            Log.d(TAG, "Duration: ${recording.duration} seconds")
        }
    }
}
```

### CallLog Properties

| Property | Type | Description |
|----------|------|-------------|
| `sessionID` | String | Session identifier |
| `type` | String | `video` or `audio` |
| `status` | String | `ended`, `missed`, `rejected`, `cancelled`, etc. |
| `callCategory` | String | `call` or `meet` |
| `totalDuration` | String | Human-readable duration |
| `totalParticipants` | int | Participant count |
| `hasRecording` | boolean | Whether recorded |
| `recordings` | List\<Recording\> | Recording objects |
| `initiator` | CallEntity | Who started the call |
| `receiver` | CallEntity | Who received the call |

## Gotchas

- `CallLogRequest` is from the **Calls SDK**, not the Chat SDK
- `setSessionType()` takes lowercase strings: `"video"` or `"audio"`
- `setCallDirection()` takes `"incoming"` or `"outgoing"`
- `setCallCategory()` takes `"call"` or `"meet"`
- Create a new `CallLogRequest` to reset pagination
- The sample app uses Chat SDK's `MessagesRequest` for call logs — the Calls SDK's `CallLogRequest` provides richer data

## Sample App Reference

- `Repository.kt` — `fetchCallLogs()` (uses Chat SDK approach)
- For Calls SDK approach, use `CallLogRequest` as shown above
