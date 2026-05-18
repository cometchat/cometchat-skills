---
name: join-session
description: Join a CometChat call session using CometChatCalls.joinSession with SessionSettingsBuilder. Use when joining calls, configuring session settings, voice vs video calls, or generating tokens. Triggers on "join session", "join call", "start call", "SessionSettingsBuilder".
inclusion: manual
---

# CometChat Calls SDK v5 — Join Session

## Overview

Join a call session using `CometChatCalls.joinSession()`. Supports two approaches: direct session ID (simple) or manual token generation (advanced). Requires a `RelativeLayout` container and configured `SessionSettings`.

## Prerequisites

- Calls SDK initialized and user logged in
- A valid session ID (from Chat SDK's `Call.sessionId` or your backend)
- A `RelativeLayout` container in your layout XML

## Key Imports

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.model.SessionType
import com.cometchat.calls.model.LayoutType
import com.cometchat.calls.model.AudioMode
import com.cometchat.calls.exceptions.CometChatException
```

## Implementation

### Layout Container

```xml
<RelativeLayout
    android:id="@+id/call_view_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

### Join with Session ID (Recommended)

```kotlin
val callContainer = findViewById<RelativeLayout>(R.id.call_view_container)

val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    .setTitle("Team Meeting")
    .setSessionType(if (isVoiceCall) SessionType.VOICE else SessionType.VIDEO)
    .setLayout(LayoutType.TILE)
    .setAudioMode(if (isVoiceCall) AudioMode.EARPIECE else AudioMode.SPEAKER)
    .startAudioMuted(false)
    .startVideoPaused(isVoiceCall)
    .build()

CometChatCalls.joinSession(
    sessionId,
    sessionSettings,
    callContainer,
    object : CometChatCalls.CallbackListener<CallSession>() {
        override fun onSuccess(callSession: CallSession) {
            Log.d(TAG, "Joined session: $sessionId")
            // Setup listeners on callSession
        }
        override fun onError(e: CometChatException) {
            Log.e(TAG, "Failed to join: ${e.message}")
        }
    }
)
```

### Join with Token (Advanced)

```kotlin
// Step 1: Generate token
CometChatCalls.generateToken(sessionId, object : CometChatCalls.CallbackListener<GenerateToken>() {
    override fun onSuccess(token: GenerateToken) {
        // Step 2: Join with token
        CometChatCalls.joinSession(token, sessionSettings, callContainer,
            object : CometChatCalls.CallbackListener<CallSession>() {
                override fun onSuccess(callSession: CallSession) { /* joined */ }
                override fun onError(e: CometChatException) { /* error */ }
            }
        )
    }
    override fun onError(e: CometChatException) { /* token error */ }
})
```

### Voice Call vs Video Call

```kotlin
// Video call
val videoSettings = CometChatCalls.SessionSettingsBuilder()
    .setSessionType(SessionType.VIDEO)
    .setLayout(LayoutType.TILE)
    .setAudioMode(AudioMode.SPEAKER)
    .startVideoPaused(false)
    .build()

// Voice call
val voiceSettings = CometChatCalls.SessionSettingsBuilder()
    .setSessionType(SessionType.VOICE)
    .setLayout(LayoutType.SPOTLIGHT)
    .setAudioMode(AudioMode.EARPIECE)
    .startVideoPaused(true)
    .build()
```

## Gotchas

- The container **must** be a `RelativeLayout`, not `FrameLayout`
- All participants must use the **same session ID** to join the same call
- `SessionType` values are `VIDEO` and `VOICE` (not "AUDIO")
- Call `joinSession` only after SDK is initialized and user is logged in
- The `CallSession` returned in `onSuccess` is used to register all event listeners

## Sample App Reference

- `CallActivity.kt` — `joinSession()` method with voice/video branching
- `Repository.kt` — `loginCallsUser()` for authentication before joining
