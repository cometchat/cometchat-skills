---
name: cometchat-android-v6-push
description: "CometChat Android UIKit v6 push notifications — FCM setup, chat/call notification handling, VoIP integration, and deep-linking"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, push, fcm, firebase, voip, notifications, calls"
---

> **Companion skills:** cometchat-android-v6-core (init/login), cometchat-android-v6-events (call events), cometchat-android-v6-builder-settings (calling config)

## Purpose

Set up push notifications for CometChat v6 using Firebase Cloud Messaging (FCM), handle chat and call notifications, and integrate VoIP for background call handling.

## Use this skill when

- Adding FCM push notifications for chat messages
- Handling incoming call notifications (foreground and background)
- Setting up VoIP with TelecomManager for native call UI
- Implementing deep-link navigation from notifications

## Do not use this skill when

- Just initializing the SDK (use `cometchat-android-v6-core`)
- Working with UI components (use `cometchat-*-components`)

## 1. FCM Setup

### 1.1 Gradle Dependencies

```kotlin
// In project-level build.gradle
plugins {
    id("com.google.gms.google-services") version "4.4.2" apply false
}

// In app-level build.gradle.kts
plugins {
    id("com.google.gms.google-services")
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.x.x"))
    implementation("com.google.firebase:firebase-messaging")
}
```

Add `google-services.json` to your app module's root directory.

### 1.2 Initialize Firebase

```kotlin
// In Application.onCreate()
FirebaseApp.initializeApp(this)
```

## 2. FCMService Implementation

> **Heads-up — this is a reference pattern.** The classes referenced below (`CometChatVoIP`, `CometChatVoIPConnectionService`, `FCMMessageDTO`, `FCMCallDto`, `FCMService`, `VoIPPermissionListener`, `CometChatVoIPUtils`, `FCMMessageNotificationUtils`) are NOT exported from `com.cometchat:chatuikit-{compose,kotlin}-android:6.x`. They live in the `master-app-jetpack` sample app — copy the relevant source files into your project, or use them as a guide for writing your own equivalents. The kit's only public push surface is `CometChatNotifications.registerPushToken(...)` / `unregisterPushToken(...)`; everything below is glue you control.

Pattern from `master-app-jetpack/fcm/FCMService.kt` (sample-app code, copy into your project):

```kotlin
class FCMService : FirebaseMessagingService() {

    companion object {
        var fcmToken: String? = null
            private set
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        fcmToken = token
        // Store token for later use (e.g., SharedPreferences)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        if (message.data.isEmpty()) return

        val type = message.data["type"]?.lowercase()
        when (type) {
            "chat" -> handleChatNotification(message)
            "call" -> handleCallNotification(message)
        }
    }
}
```

### 2.1 Chat Notification Handling

```kotlin
private fun handleChatNotification(message: RemoteMessage) {
    val fcmMessageDTO = Gson().fromJson(
        Gson().toJson(message.data),
        FCMMessageDTO::class.java
    )

    // Mark as delivered for read receipts (only if SDK is initialized)
    if (CometChatUIKit.isSDKInitialized()) {
        CometChat.markAsDelivered(
            fcmMessageDTO.tag!!.toLong(),
            fcmMessageDTO.sender!!,
            fcmMessageDTO.receiverType!!,
            fcmMessageDTO.receiver!!
        )
    }

    // Show notification if user is NOT in the same chat
    val isUser = fcmMessageDTO.receiverType == CometChatConstants.RECEIVER_TYPE_USER
    val uid = if (isUser) fcmMessageDTO.sender!! else fcmMessageDTO.receiver!!

    if (uid != currentOpenChatId) {
        // Build and show notification
        FCMMessageNotificationUtils.showNotification(
            this, fcmMessageDTO, intent,
            NOTIFICATION_KEY_REPLY_ACTION,
            NotificationCompat.CATEGORY_MESSAGE
        )
    }
}
```

### 2.2 Call Notification Handling

```kotlin
private fun handleCallNotification(message: RemoteMessage) {
    val sessionId = message.data["sessionId"]
    val callAction = message.data["callAction"]

    // CRITICAL: Check if SDK is initialized
    if (!CometChatUIKit.isSDKInitialized()) {
        return // Cannot handle call without SDK
    }

    // Check VoIP permissions
    if (!CometChatVoIP.hasReadPhoneStatePermission(this) ||
        !CometChatVoIP.hasManageOwnCallsPermission(this) ||
        !CometChatVoIP.hasAnswerPhoneCallsPermission(this)) {
        return
    }

    // Check phone account is enabled
    CometChatVoIP.hasEnabledPhoneAccountForVoIP(this, object : VoIPPermissionListener {
        override fun onPermissionsGranted() {
            handleCallFlow(message)
        }
        override fun onPermissionsDenied(error: CometChatVoIPError?) {
            // Cannot show VoIP UI
        }
    })
}
```

## 3. VoIP Integration

### 3.1 Required Permissions

```xml
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
<uses-permission android:name="android.permission.ANSWER_PHONE_CALLS" />
```

### 3.2 VoIP Call Flow

```kotlin
private fun handleCallFlow(message: RemoteMessage) {
    val callData = Gson().fromJson(
        Gson().toJson(message.data),
        FCMCallDto::class.java
    )

    // Initialize VoIP
    CometChatVoIP.init(this, applicationInfo.loadLabel(packageManager).toString())

    when (callData.callAction) {
        "initiated" -> {
            // Show incoming call UI (only if app is in background)
            if (!isAppInForeground()) {
                voipIncomingCall(callData)
            }
            // If foreground, UIKit's CometChatIncomingCall handles it
        }
        "cancelled", "unanswered" -> {
            // End the native call UI if session matches
            if (CometChatVoIPUtils.currentSessionId == callData.sessionId) {
                CometChatVoIP.telecomManager?.endCall()
            }
        }
    }
}
```

### 3.3 Foreground vs Background Routing

| App State | Incoming Call Handler |
|---|---|
| Foreground | UIKit's `CometChatIncomingCall` via SDK call listener |
| Background | VoIP via `TelecomManager` + `CometChatVoIPConnectionService` |
| Killed | FCM wakes app, but SDK may not be initialized — cannot handle call |

### 3.4 Busy Rejection

```kotlin
private fun rejectCallWithBusyStatus(call: Call) {
    CometChat.rejectCall(
        call.sessionId,
        CometChatConstants.CALL_STATUS_BUSY,
        object : CometChat.CallbackListener<Call>() {
            override fun onSuccess(rejectedCall: Call?) {
                rejectedCall?.let {
                    CometChatEvents.emitCallEvent(CometChatCallEvent.CallRejected(it))
                }
            }
            override fun onError(e: CometChatException) { }
        }
    )
}
```

## 4. AndroidManifest Registration

```xml
<service
    android:name=".fcm.FCMService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>

<!-- VoIP Connection Service -->
<service
    android:name=".voip.CometChatVoIPConnectionService"
    android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.telecom.ConnectionService" />
    </intent-filter>
</service>
```

## 5. WebSocket Connection Management

From `master-app-jetpack/Application.kt` — manage WebSocket connections based on app lifecycle:

```kotlin
// When app comes to foreground
CometChat.connect(object : CometChat.CallbackListener<String?>() {
    override fun onSuccess(s: String?) { /* connected */ }
    override fun onError(e: CometChatException) { /* failed */ }
})

// When app goes to background
CometChat.disconnect(object : CometChat.CallbackListener<String?>() {
    override fun onSuccess(s: String?) { /* disconnected */ }
    override fun onError(e: CometChatException) { /* failed */ }
})
```

## Hard rules

- ALWAYS check `CometChatUIKit.isSDKInitialized()` before making SDK calls in FCM service — the app may have been killed
- NEVER show VoIP incoming call UI when app is in foreground — UIKit's `CometChatIncomingCall` handles foreground calls
- VoIP requires READ_PHONE_STATE, MANAGE_OWN_CALLS, and ANSWER_PHONE_CALLS permissions — check all three before handling calls
- `CometChat.markAsDelivered()` requires the SDK to be initialized — skip it if not
- For push token registration, use `CometChatNotifications.registerPushToken(...)` / `unregisterPushToken(...)` — that is the kit's only public push API. The `CometChatVoIP*` / `FCM*` classes shown above are sample-app glue (`master-app-jetpack`), not part of `chatuikit-{compose,kotlin}`
- Always manage WebSocket connections based on app lifecycle to avoid battery drain
