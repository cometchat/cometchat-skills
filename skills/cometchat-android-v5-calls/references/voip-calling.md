---
name: voip-calling
description: Implement native VoIP calling with ConnectionService, PhoneAccount, FCM push, and system call UI. Use when receiving calls in background/killed state, lock screen calls, or Telecom framework integration. Triggers on "VoIP", "voip calling", "ConnectionService", "PhoneAccount", "push notification call", "background call".
inclusion: manual
---

# CometChat Calls SDK v5 — VoIP Calling

## Overview

Native VoIP calling using Android's Telecom framework (`ConnectionService`). Shows system call UI on lock screen, works when app is killed, integrates with Bluetooth/car systems. Requires FCM push notifications. Falls back to a high-priority notification when TelecomManager is unavailable.

## Prerequisites

- Chat SDK v4 (`com.cometchat:chat-sdk-android:4.0.+`) + Calls SDK v5 (`com.cometchat:calls-sdk-android:5.0.0-beta.2`) integrated
- Firebase Cloud Messaging (FCM) configured with `com.google.gms.google-services` plugin
- Push notifications enabled in CometChat Dashboard
- Android 8.0+ (API 26+), compileSdk 35

## Key Components

| Component | Purpose |
|-----------|---------|
| `CallFirebaseMessagingService` | Receives FCM push for incoming calls, parses payload, routes to CallNotificationManager |
| `CallConnectionService` | Bridges app with Android Telecom, creates CallConnection instances |
| `PhoneAccountManager` | Registers app as self-managed VoIP calling provider |
| `CallConnection` | Represents individual call (accept/reject/hold) in Telecom framework |
| `CallNotificationManager` | Routes calls to TelecomManager with fallback to high-priority notification |
| `CallActionReceiver` | Handles accept/decline from fallback notification |
| `CallConnectionHolder` | Singleton for cross-component access to active CallConnection |
| `CallData` | Parcelable call metadata passed between components |
| `VoIPApplication` | Application subclass tracking foreground state, global CallListener |

## Dual Incoming Call Path

| App State | Trigger | Handler | UI |
|-----------|---------|---------|-----|
| Foreground | `CometChat.CallListener` | `VoIPApplication` global listener | `IncomingCallActivity` |
| Background | FCM push | `CallFirebaseMessagingService` → `CallNotificationManager` → `TelecomManager` | System call UI |
| Killed | FCM push | `CallFirebaseMessagingService` → `CallNotificationManager` → `TelecomManager` | System call UI |
| Background/Killed (fallback) | FCM push | `CallNotificationManager` → high-priority notification | `IncomingCallActivity` via full-screen intent |

## Implementation

### 1. CallData Parcelable Model

```kotlin
package com.cometchat.samplecallsvoip.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class CallData(
    val sessionId: String,
    val callerName: String,
    val callerUid: String,
    val callType: String,       // "audio" or "video"
    val callerAvatar: String?
) : Parcelable
```

### 2. FCM Payload Structure

The FCM push payload for incoming calls:

```json
{
  "type": "call",
  "sessionId": "v1.us.xxx",
  "senderName": "John Doe",
  "senderUid": "john_doe",
  "callType": "video",
  "senderAvatar": "https://..."
}
```

### 3. FCM Service

```kotlin
class CallFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "CallFCMService"
        private const val KEY_TYPE = "type"
        private const val KEY_SESSION_ID = "sessionId"
        private const val KEY_SENDER_NAME = "senderName"
        private const val KEY_SENDER_UID = "senderUid"
        private const val KEY_CALL_TYPE = "callType"
        private const val KEY_SENDER_AVATAR = "senderAvatar"
        private const val TYPE_CALL = "call"

        /** Parses FCM data payload into CallData. Returns null if not a call or missing required fields. */
        fun parseCallData(data: Map<String, String>): CallData? {
            if (data[KEY_TYPE] != TYPE_CALL) return null
            val sessionId = data[KEY_SESSION_ID]
            val senderUid = data[KEY_SENDER_UID]
            if (sessionId.isNullOrEmpty() || senderUid.isNullOrEmpty()) return null
            return CallData(
                sessionId = sessionId,
                callerName = data[KEY_SENDER_NAME] ?: "",
                callerUid = senderUid,
                callType = data[KEY_CALL_TYPE] ?: "audio",
                callerAvatar = data[KEY_SENDER_AVATAR]
            )
        }

        /** Returns true when push should be handled (background/killed), false when ignored (foreground). */
        fun shouldHandlePush(isAppInForeground: Boolean): Boolean = !isAppInForeground
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val callData = parseCallData(remoteMessage.data) ?: return
        if (isAppInForeground()) return
        CallNotificationManager.showIncomingCall(this, callData)
    }

    override fun onNewToken(token: String) {
        CometChat.registerTokenForPushNotification(token, object : CometChat.CallbackListener<String>() {
            override fun onSuccess(message: String) { Log.d(TAG, "FCM token registered") }
            override fun onError(e: CometChatException) { Log.w(TAG, "Failed to register FCM token: ${e.message}") }
        })
    }

    private fun isAppInForeground(): Boolean {
        val app = application
        if (app is VoIPApplication) return app.isInForeground
        return ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
    }
}
```

### 4. Register PhoneAccount

```kotlin
object PhoneAccountManager {
    private const val ACCOUNT_ID = "cometchat_voip_account"
    private const val ACCOUNT_LABEL = "CometChat Calls VoIP"

    fun register(context: Context) {
        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        val handle = getPhoneAccountHandle(context)
        val phoneAccount = PhoneAccount.builder(handle, ACCOUNT_LABEL)
            .setCapabilities(PhoneAccount.CAPABILITY_CALL_PROVIDER or PhoneAccount.CAPABILITY_SELF_MANAGED)
            .build()
        telecomManager.registerPhoneAccount(phoneAccount)
    }

    fun getPhoneAccountHandle(context: Context): PhoneAccountHandle {
        val componentName = ComponentName(context, CallConnectionService::class.java)
        return PhoneAccountHandle(componentName, ACCOUNT_ID)
    }

    fun isPhoneAccountEnabled(context: Context): Boolean {
        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        val account = telecomManager.getPhoneAccount(getPhoneAccountHandle(context))
        return account?.isEnabled == true
    }

    fun openPhoneAccountSettings(context: Context) {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Intent(TelecomManager.ACTION_CHANGE_PHONE_ACCOUNTS)
        } else {
            Intent("android.telecom.action.CHANGE_PHONE_ACCOUNTS")
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}
// Call PhoneAccountManager.register() in Application.onCreate() or SplashActivity
```

### 5. CallNotificationManager (TelecomManager + Fallback)

```kotlin
object CallNotificationManager {
    const val NOTIFICATION_ID = 1001
    const val CHANNEL_ID = "voip_call_channel"
    const val ACTION_ACCEPT = "ACTION_ACCEPT"
    const val ACTION_DECLINE = "ACTION_DECLINE"
    const val EXTRA_CALL_DATA = "call_data"

    fun showIncomingCall(context: Context, callData: CallData) {
        // Check PhoneAccount first — if not enabled, go straight to fallback
        if (!PhoneAccountManager.isPhoneAccountEnabled(context)) {
            showFallbackNotification(context, callData)
            return
        }
        try {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val extras = Bundle().apply { putParcelable("call_data", callData) }
            telecomManager.addNewIncomingCall(PhoneAccountManager.getPhoneAccountHandle(context), extras)
        } catch (e: SecurityException) {
            showFallbackNotification(context, callData)
        }
    }

    fun cancelNotification(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID)
    }

    private fun showFallbackNotification(context: Context, callData: CallData) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH)
        )

        // Full-screen intent → IncomingCallActivity
        val fullScreenIntent = Intent().apply {
            setClassName(context, "com.cometchat.samplecallsvoip.ui.activity.IncomingCallActivity")
            putExtra(EXTRA_CALL_DATA, callData)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val fullScreenPI = PendingIntent.getActivity(context, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        // Accept/Decline actions → CallActionReceiver
        val acceptPI = PendingIntent.getBroadcast(context, 1,
            Intent(context, CallActionReceiver::class.java).apply {
                action = ACTION_ACCEPT; putExtra(EXTRA_CALL_DATA, callData)
            }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val declinePI = PendingIntent.getBroadcast(context, 2,
            Intent(context, CallActionReceiver::class.java).apply {
                action = ACTION_DECLINE; putExtra(EXTRA_CALL_DATA, callData)
            }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_cometchat_logo)
            .setContentTitle("${if (callData.callType == "audio") "Voice" else "Video"} Call")
            .setContentText("${callData.callerName.ifEmpty { "Unknown" }} is calling…")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setFullScreenIntent(fullScreenPI, true)
            .addAction(0, "Accept", acceptPI)
            .addAction(0, "Decline", declinePI)
            .build()

        nm.notify(NOTIFICATION_ID, notification)
    }
}
```

### 6. ConnectionService

```kotlin
class CallConnectionService : ConnectionService() {
    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        val callData: CallData? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            request?.extras?.getParcelable("call_data", CallData::class.java)
        } else {
            @Suppress("DEPRECATION")
            request?.extras?.getParcelable("call_data")
        }
        val connection = CallConnection(applicationContext, callData)
        CallConnectionHolder.set(connection)
        return connection
    }
}
```

### 7. CallConnection (Accept/Reject)

```kotlin
class CallConnection(
    private val context: Context,
    private val callData: CallData?
) : Connection() {

    companion object {
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_CALL_TYPE = "call_type"
    }

    init {
        connectionProperties = PROPERTY_SELF_MANAGED
        connectionCapabilities = CAPABILITY_HOLD or CAPABILITY_SUPPORT_HOLD
        audioModeIsVoip = true
        callData?.let {
            setCallerDisplayName(it.callerName, TelecomManager.PRESENTATION_ALLOWED)
            setAddress(Uri.fromParts("tel", it.callerUid, null), TelecomManager.PRESENTATION_ALLOWED)
        }
        setInitializing()
        setRinging()
    }

    override fun onAnswer() {
        val sessionId = callData?.sessionId ?: run {
            setDisconnected(DisconnectCause(DisconnectCause.ERROR)); destroy(); return
        }
        CometChat.acceptCall(sessionId, object : CometChat.CallbackListener<Call>() {
            override fun onSuccess(call: Call) {
                setActive()
                launchCallActivity(sessionId)
                CallNotificationManager.cancelNotification(context)
            }
            override fun onError(e: CometChatException) {
                setDisconnected(DisconnectCause(DisconnectCause.ERROR)); destroy()
            }
        })
    }

    override fun onReject() {
        val sessionId = callData?.sessionId
        if (!sessionId.isNullOrEmpty()) {
            CometChat.rejectCall(sessionId, CometChatConstants.CALL_STATUS_REJECTED,
                object : CometChat.CallbackListener<Call>() {
                    override fun onSuccess(call: Call) {}
                    override fun onError(e: CometChatException) {}
                })
        }
        setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
        destroy()
        CallNotificationManager.cancelNotification(context)
    }

    override fun onDisconnect() {
        setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
        destroy()
    }

    private fun launchCallActivity(sessionId: String) {
        val intent = Intent().apply {
            setClassName(context, "com.cometchat.samplecallsvoip.ui.activity.CallActivity")
            putExtra(EXTRA_SESSION_ID, sessionId)
            putExtra(EXTRA_CALL_TYPE, callData?.callType ?: CometChatConstants.CALL_TYPE_VIDEO)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
```

### 8. CallActionReceiver (Fallback Notification Actions)

```kotlin
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val callData = intent.getParcelableExtra<CallData>(CallNotificationManager.EXTRA_CALL_DATA)
        val sessionId = callData?.sessionId ?: return

        when (intent.action) {
            CallNotificationManager.ACTION_ACCEPT -> {
                CometChat.acceptCall(sessionId, object : CometChat.CallbackListener<Call>() {
                    override fun onSuccess(call: Call) {
                        val launchIntent = Intent().apply {
                            setClassName(context, "com.cometchat.samplecallsvoip.ui.activity.CallActivity")
                            putExtra(CallConnection.EXTRA_SESSION_ID, sessionId)
                            putExtra(CallConnection.EXTRA_CALL_TYPE, callData?.callType ?: CometChatConstants.CALL_TYPE_VIDEO)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        }
                        context.startActivity(launchIntent)
                        CallNotificationManager.cancelNotification(context)
                    }
                    override fun onError(e: CometChatException) {
                        CallNotificationManager.cancelNotification(context)
                    }
                })
            }
            CallNotificationManager.ACTION_DECLINE -> {
                CometChat.rejectCall(sessionId, CometChatConstants.CALL_STATUS_REJECTED,
                    object : CometChat.CallbackListener<Call>() {
                        override fun onSuccess(call: Call) {}
                        override fun onError(e: CometChatException) {}
                    })
                CallNotificationManager.cancelNotification(context)
            }
        }
    }
}
```

### 9. CallConnectionHolder

```kotlin
object CallConnectionHolder {
    private var activeConnection: Connection? = null

    fun set(connection: Connection) { activeConnection = connection }
    fun get(): Connection? = activeConnection
    fun clear() { activeConnection = null }

    /** Ends the active call by calling onDisconnect() and clears the reference. */
    fun endCall() {
        activeConnection?.onDisconnect()
        clear()
    }
}
```

### 10. VoIPApplication (Foreground State + Global CallListener)

```kotlin
class VoIPApplication : Application(), DefaultLifecycleObserver {
    var isInForeground: Boolean = false
        private set

    override fun onCreate() {
        super<Application>.onCreate()
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
    }

    override fun onStart(owner: LifecycleOwner) { isInForeground = true }
    override fun onStop(owner: LifecycleOwner) { isInForeground = false }

    /** Register after SDK init + user login. Launches IncomingCallActivity for foreground calls. */
    fun registerCallListener() {
        CometChat.addCallListener("voip_app_call_listener", object : CometChat.CallListener() {
            override fun onIncomingCallReceived(call: Call?) {
                if (call == null || !isInForeground) return
                val caller = call.callInitiator as? User
                val intent = Intent(this@VoIPApplication, IncomingCallActivity::class.java).apply {
                    putExtra("session_id", call.sessionId)
                    putExtra("caller_name", caller?.name ?: "Unknown")
                    putExtra("caller_avatar", caller?.avatar ?: "")
                    putExtra("call_type", call.type)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
            }
            override fun onOutgoingCallAccepted(call: Call?) {}
            override fun onOutgoingCallRejected(call: Call?) {}
            override fun onIncomingCallCancelled(call: Call?) {}
            override fun onCallEndedMessageReceived(call: Call?) {}
        })
    }

    fun unregisterCallListener() {
        CometChat.removeCallListener("voip_app_call_listener")
    }
}
```

### 11. Manifest

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />

<!-- VoIP ConnectionService -->
<service android:name=".voip.CallConnectionService"
    android:exported="true"
    android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE">
    <intent-filter>
        <action android:name="android.telecom.ConnectionService" />
    </intent-filter>
</service>

<!-- FCM Service -->
<service android:name=".voip.CallFirebaseMessagingService" android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>

<!-- Fallback notification action receiver -->
<receiver android:name=".voip.CallActionReceiver" android:exported="false" />
```

## Call Session Integration

When a call is accepted (via ConnectionService or fallback notification), launch `CallActivity` which joins the session:

```kotlin
// Build SessionSettings based on call type
val isVoiceOnly = callType == CometChatConstants.CALL_TYPE_AUDIO
val settings = CometChatCalls.SessionSettingsBuilder()
    .setTitle("CometChat Call")
    .setType(if (isVoiceOnly) SessionType.VOICE else SessionType.VIDEO)
    .setLayout(if (isVoiceOnly) LayoutType.SPOTLIGHT else LayoutType.TILE)
    .setAudioMode(if (isVoiceOnly) AudioMode.EARPIECE else AudioMode.SPEAKER)
    .startVideoPaused(isVoiceOnly)
    .startAudioMuted(false)
    .build()

CometChatCalls.joinSession(sessionId, settings, callContainer, listener)

// On session joined → start foreground service
CometChatOngoingCallService.launch(activity)

// On session end → clean up
CometChatOngoingCallService.abort(activity)
CallConnectionHolder.endCall()
CallNotificationManager.cancelNotification(activity)
```

## Gotchas

- `CAPABILITY_SELF_MANAGED` is required for VoIP apps that manage their own UI
- Some devices require users to manually enable the PhoneAccount in Settings — use `PhoneAccountManager.isPhoneAccountEnabled()` to check and `openPhoneAccountSettings()` to redirect
- If app is in foreground, let `CometChat.CallListener` handle it instead of ConnectionService — the FCM service checks `isAppInForeground()` and skips
- `CallData` must implement `Parcelable` to pass between components (Services, Activities, BroadcastReceivers)
- Always register PhoneAccount in `Application.onCreate()` or `SplashActivity` before any calls arrive
- On API 33+ use the typed `getParcelable(key, Class)` overload in `ConnectionService.onCreateIncomingConnection()`
- Always cancel the fallback notification on terminal call states (answered, rejected, cancelled) via `CallNotificationManager.cancelNotification()`
- Always disconnect the `CallConnection` via `CallConnectionHolder.endCall()` when the call session ends
- The fallback notification uses `PRIORITY_MAX`, `CATEGORY_CALL`, `ongoing=true`, and a full-screen intent for lock screen display
- This builds on top of the basic ringing integration — understand that first

## Sample App Reference

- `samples/sample-app-voip/` — Complete working VoIP sample app demonstrating all patterns above
  - `voip/CallFirebaseMessagingService.kt` — FCM push handling with payload parsing
  - `voip/PhoneAccountManager.kt` — PhoneAccount registration and status checks
  - `voip/CallConnectionService.kt` — ConnectionService bridging Telecom framework
  - `voip/CallConnection.kt` — Individual call representation (accept/reject/disconnect)
  - `voip/CallNotificationManager.kt` — TelecomManager routing with fallback notification
  - `voip/CallActionReceiver.kt` — Fallback notification accept/decline handler
  - `voip/CallConnectionHolder.kt` — Singleton for active connection access
  - `data/model/CallData.kt` — Parcelable call metadata
  - `VoIPApplication.kt` — Application class with foreground tracking and global CallListener
  - `ui/activity/CallActivity.kt` — Call session with SessionSettings mapping
