---
name: background-handling
description: Keep calls alive in background using CometChatOngoingCallService foreground service. Use when handling home button press during calls, ongoing call notifications, or preventing call termination. Triggers on "background handling", "foreground service", "ongoing call", "CometChatOngoingCallService", "keep call alive".
inclusion: manual
---

# CometChat Calls SDK v5 — Background Handling

## Overview

`CometChatOngoingCallService` is a foreground service that keeps calls alive when users press HOME or switch apps. Shows an ongoing notification with tap-to-return and hangup actions.

## Prerequisites

- Active call session
- Foreground service permissions in manifest

## Key Imports

```kotlin
import com.cometchat.calls.services.CometChatOngoingCallService
import com.cometchat.calls.utils.OngoingNotification
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.SessionStatusListener
import com.cometchat.calls.listeners.ButtonClickListener
```

## Implementation

### 1. Manifest Permissions

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### 2. Start/Stop Service

```kotlin
callSession.addSessionStatusListener(this, object : SessionStatusListener() {
    override fun onSessionJoined() {
        CometChatOngoingCallService.launch(this@CallActivity)
    }
    override fun onSessionLeft() {
        CometChatOngoingCallService.abort(this@CallActivity)
        finish()
    }
    override fun onConnectionClosed() {
        CometChatOngoingCallService.abort(this@CallActivity)
        finish()
    }
    override fun onSessionTimedOut() {
        CometChatOngoingCallService.abort(this@CallActivity)
        finish()
    }
    override fun onConnectionLost() {}
    override fun onConnectionRestored() {}
})
```

### 3. Handle Leave Button

```kotlin
callSession.addButtonClickListener(this, object : ButtonClickListener() {
    override fun onLeaveSessionButtonClicked() {
        endCall()
    }
})
```

### 4. Handle Remote Call End

Register a `CometChat.CallListener` to detect when the remote party ends the call, then clean up the foreground service:

```kotlin
CometChat.addCallListener(LISTENER_ID, object : CometChat.CallListener() {
    override fun onCallEndedMessageReceived(call: Call?) {
        val session = CallSession.getInstance()
        if (session.isSessionActive) {
            session.leaveSession()
        }
        CometChatOngoingCallService.abort(this@CallActivity)
        runOnUiThread { finish() }
    }
    override fun onIncomingCallReceived(call: Call?) {}
    override fun onOutgoingCallAccepted(call: Call?) {}
    override fun onOutgoingCallRejected(call: Call?) {}
    override fun onIncomingCallCancelled(call: Call?) {}
})
```

### 5. Always Stop in onDestroy

```kotlin
override fun onDestroy() {
    super.onDestroy()
    CometChat.removeCallListener(LISTENER_ID)
    CometChatOngoingCallService.abort(this)
}
```

### 6. Custom Notification (Optional)

```kotlin
private fun buildCustomNotification(): Notification {
    val channelId = "CometChat_Call_Ongoing_Conference"  // must use this ID
    val intent = Intent(this, CallActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
        this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return NotificationCompat.Builder(this, channelId)
        .setSmallIcon(R.drawable.ic_call)
        .setContentTitle("Ongoing Call")
        .setContentText("Tap to return to your call")
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(pendingIntent)
        .setOngoing(true)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .build()
}

// Set before launching service
OngoingNotification.buildOngoingConferenceNotification(buildCustomNotification())
CometChatOngoingCallService.launch(this)
```

### 7. VoIP Integration — Additional Cleanup (Optional)

When using background handling with VoIP calling (ConnectionService + TelecomManager), also disconnect the `CallConnection` and cancel any VoIP notifications on every terminal state:

```kotlin
// In each terminal callback (onSessionLeft, onSessionTimedOut, onConnectionClosed, onCallEndedMessageReceived):
CometChatOngoingCallService.abort(this@CallActivity)
CallConnectionHolder.endCall()
CallNotificationManager.cancelNotification(this@CallActivity)
finish()
```

See the `sample-app-voip` CallActivity for the full VoIP-integrated pattern.

## API Reference

| Method | Description |
|--------|-------------|
| `CometChatOngoingCallService.launch(context)` | Start foreground service |
| `CometChatOngoingCallService.abort(context)` | Stop foreground service |
| `OngoingNotification.buildOngoingConferenceNotification(notification)` | Set custom notification (call before `launch()`) |

## Gotchas

- The notification channel ID **must** be `"CometChat_Call_Ongoing_Conference"`
- Always call `abort()` in `onDestroy()` to prevent leaked services
- Always remove `CometChat.CallListener` in `onDestroy()` to prevent leaks
- This is for keeping **active** calls alive — for receiving calls when app is killed, use VoIP Calling
- Call `launch()` only after `onSessionJoined()` — not before joining
- Custom notification must be set **before** calling `launch()`
- When using VoIP (ConnectionService), also call `CallConnectionHolder.endCall()` in every terminal state to properly disconnect the Telecom connection

## Sample App Reference

- `sample-app-ringing` — `CallActivity.kt` — basic foreground service pattern with `launch()` in `onSessionJoined()`, `abort()` in `onSessionLeft()` and `onDestroy()`
- `sample-app-voip` — `CallActivity.kt` — full VoIP-integrated pattern with foreground service + CallConnection cleanup + notification cancellation on every terminal state
