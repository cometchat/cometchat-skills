---
name: ringing-integration
description: Implement ringing with dual SDK (Chat + Calls). Use when adding incoming/outgoing call screens, CometChat.initiateCall, accept/reject/cancel calls, or Call class from com.cometchat.chat.core. Triggers on "ringing", "incoming call", "outgoing call", "initiateCall", "acceptCall", "rejectCall".
inclusion: manual
---

# CometChat Calls SDK v5 — Ringing Integration

## Overview

Implement call ringing using both CometChat Chat SDK (signaling) and Calls SDK (session). The Chat SDK handles initiating, accepting, rejecting, and cancelling calls. The Calls SDK manages the actual call session after acceptance.

## Prerequisites

- Both SDKs added to `build.gradle.kts`:
  ```kotlin
  implementation("com.cometchat:chat-sdk-android:4.0.+")
  implementation("com.cometchat:calls-sdk-android:5.0.0-beta.2")
  ```
- Both SDKs initialized and user logged in to both

## Key Imports

```kotlin
// Chat SDK — signaling
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.core.Call                    // NOT com.cometchat.chat.models.Call
import com.cometchat.chat.constants.CometChatConstants
import com.cometchat.chat.exceptions.CometChatException as ChatException

// Calls SDK — session
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.exceptions.CometChatException as CallsException
```

## Implementation

### 1. Initiate a Call (Caller Side)

```kotlin
val call = Call(receiverUID, CometChatConstants.RECEIVER_TYPE_USER, CometChatConstants.CALL_TYPE_VIDEO)

CometChat.initiateCall(call, object : CometChat.CallbackListener<Call>() {
    override fun onSuccess(outgoingCall: Call) {
        // Show outgoing call UI with outgoingCall.sessionId
    }
    override fun onError(e: ChatException) {
        Log.e(TAG, "Initiate failed: ${e.message}")
    }
})
```

### 2. Listen for Incoming Calls (Global Listener)

Register in `Application` class:

```kotlin
CometChat.addCallListener(LISTENER_ID, object : CometChat.CallListener() {
    override fun onIncomingCallReceived(call: Call) {
        // Show incoming call UI
        // call.sessionId, call.sender?.name, call.type
    }
    override fun onOutgoingCallAccepted(call: Call) {
        // Navigate to CallActivity with call.sessionId
    }
    override fun onOutgoingCallRejected(call: Call) {
        // Dismiss outgoing call UI
    }
    override fun onIncomingCallCancelled(call: Call) {
        // Dismiss incoming call UI
    }
    override fun onCallEndedMessageReceived(call: Call) {
        // Handle call ended
    }
})
```

### 3. Accept a Call (Receiver Side)

```kotlin
CometChat.acceptCall(sessionId, object : CometChat.CallbackListener<Call>() {
    override fun onSuccess(call: Call) {
        // Navigate to CallActivity, join session with call.sessionId
    }
    override fun onError(e: ChatException) { /* handle */ }
})
```

### 4. Reject a Call

```kotlin
CometChat.rejectCall(sessionId, CometChatConstants.CALL_STATUS_REJECTED,
    object : CometChat.CallbackListener<Call>() {
        override fun onSuccess(call: Call) { finish() }
        override fun onError(e: ChatException) { finish() }
    })
```

### 5. Cancel an Outgoing Call

```kotlin
CometChat.rejectCall(sessionId, CometChatConstants.CALL_STATUS_CANCELLED,
    object : CometChat.CallbackListener<Call>() {
        override fun onSuccess(call: Call) { finish() }
        override fun onError(e: ChatException) { finish() }
    })
```

### 6. End a Call (During Session)

```kotlin
// 1. Leave the Calls SDK session
CallSession.getInstance().leaveSession()

// 2. Notify via Chat SDK
CometChat.endCall(sessionId, object : CometChat.CallbackListener<Call>() {
    override fun onSuccess(call: Call) { finish() }
    override fun onError(e: ChatException) { finish() }
})
```

### 7. Handle Remote End

```kotlin
CometChat.addCallListener(LISTENER_ID, object : CometChat.CallListener() {
    override fun onCallEndedMessageReceived(call: Call?) {
        val session = CallSession.getInstance()
        if (session.isSessionActive) session.leaveSession()
        CometChatOngoingCallService.abort(this@CallActivity)
        finish()
    }
    // ... other callbacks
})
```

## Gotchas

- **Use `com.cometchat.chat.core.Call`** — NOT `com.cometchat.chat.models.Call`
- Cancel uses `CometChat.rejectCall()` with `CALL_STATUS_CANCELLED` status
- Always call `CometChat.endCall()` when ending — otherwise the other party won't know
- Remove call listeners in `onDestroy()` to prevent memory leaks
- Call type constants: `CALL_TYPE_VIDEO` and `CALL_TYPE_AUDIO` (from `CometChatConstants`)
- Use alias imports to disambiguate exception classes between Chat and Calls SDKs

## Sample App Reference

- `RingingApplication.kt` — Global call listener registration
- `OutgoingCallActivity.kt` — Cancel call, listen for accept/reject
- `IncomingCallActivity.kt` — Accept/reject incoming call
- `CallActivity.kt` — Join session after accept, end call flow
- `Repository.kt` — `initiateCall()`, `acceptCall()`, `rejectCall()`, `cancelCall()`, `endCall()`
