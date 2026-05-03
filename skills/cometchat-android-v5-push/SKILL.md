---
name: cometchat-android-v5-push
description: "Push notifications for CometChat Android — FCM setup, CometChatNotifications API, token registration with PushPlatforms, foreground/background handling, notification channels, reply-from-notification, and tap-to-deep-link."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x; com.google.firebase:firebase-messaging"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat android push notifications fcm firebase deep-link CometChatNotifications PushPlatforms"
---

> **Companion skills:** `cometchat-android-v5-core` covers init and login;
> `cometchat-android-v5-production` covers production auth and token security.

## Purpose

Push notifications are non-negotiable for production chat. Without them, a backgrounded app never wakes when a message arrives. This skill covers end-to-end FCM setup for CometChat Android v5 — using the correct `CometChatNotifications` API with `PushPlatforms.FCM_ANDROID`, notification channels, foreground/background handling, reply-from-notification, and tap-to-deep-link.

**Ground truth:** `sample-app-java+push-notification/src/main/java/com/cometchat/sampleapp/java/fcm/` and `sample-app-kotlin+push-notification/src/main/java/com/cometchat/sampleapp/kotlin/fcm/` in the v5 UIKit repository.

---

## Use this skill when

- "Set up push notifications"
- "Messages don't arrive when app is backgrounded"
- "How do I handle notification taps?"
- "FCM token registration with CometChat"
- "How do I register push token?"
- "CometChatNotifications API"

## Do not use this skill when

- Setting up init/login → use `cometchat-android-v5-core`
- Diagnosing non-push issues → use `cometchat-android-v5-troubleshooting`
- Setting up VoIP calls → see VoIP section in this skill, but call UI is in `cometchat-android-v5-features`

---

## 1. The moving pieces

```
FCM (Google) → CometChat Dashboard → CometChat Server → Android Client
```

When user A sends a message to user B:
1. CometChat server receives the message
2. Looks up B's registered push token (registered via `CometChatNotifications.registerPushToken()`)
3. Sends push via FCM using the dashboard credentials
4. B's device receives it via `FirebaseMessagingService.onMessageReceived()`
5. App builds and displays a notification; tap → deep-link to conversation

All five steps must work. A broken step is almost always silent — no log, no error, just no notification.

---

## 2. FCM setup

### 2a. Firebase project + google-services.json

1. https://console.firebase.google.com → Add project
2. Project Overview → Add app → Android → enter your `applicationId`
3. Download `google-services.json` → place at `app/google-services.json`

### 2b. Gradle dependencies

```groovy
// project-level build.gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.2'
    }
}

// app-level build.gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation 'com.google.firebase:firebase-messaging:24.+'
}
```

### 2c. Service account JSON (for CometChat dashboard)

1. Firebase Console → Project Settings → Service accounts
2. Generate new private key → downloads a `.json` file
3. You'll upload this to the CometChat dashboard in §3

---

## 3. CometChat dashboard — upload FCM credentials

1. https://app.cometchat.com → your app → **Notifications** → **Push Notifications**
2. **Add Provider** → choose **FCM**
3. Upload the service account `.json` file from §2c
4. Save → note the **Provider ID** (e.g., `"Android-CometChat-Team-Messenger"`)

You'll use this Provider ID in your client code when calling `CometChatNotifications.registerPushToken()`.

---

## 4. Token registration API — `CometChatNotifications`

The v5 SDK uses `CometChatNotifications.registerPushToken()` — **not** the deprecated `CometChat.registerTokenForPushNotification()`.

### API reference

| Method | Signature | Description |
|---|---|---|
| `registerPushToken` | `CometChatNotifications.registerPushToken(String token, String platform, String providerId, CallbackListener<String>)` | Register FCM token with CometChat |
| `unregisterPushToken` | `CometChatNotifications.unregisterPushToken(CallbackListener<String>)` | Unregister token (call before logout) |

### PushPlatforms constants

| Constant | Value | Use for |
|---|---|---|
| `PushPlatforms.FCM_ANDROID` | `"fcm_android"` | Android FCM push |

### Register token after login

**Java:**
```java
public static void registerFCMToken(CometChat.CallbackListener<String> listener) {
    FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
        if (task.isSuccessful()) {
            String pushToken = task.getResult();
            CometChatNotifications.registerPushToken(
                pushToken,
                PushPlatforms.FCM_ANDROID,
                "YOUR_PROVIDER_ID",  // from CometChat dashboard §3
                new CometChat.CallbackListener<String>() {
                    @Override
                    public void onSuccess(String s) {
                        listener.onSuccess(s);
                    }

                    @Override
                    public void onError(CometChatException e) {
                        listener.onError(e);
                    }
                }
            );
        } else {
            listener.onError(new CometChatException("ERROR", "Failed to get FCM token"));
        }
    });
}
```

**Kotlin:**
```kotlin
fun registerFCMToken(listener: CometChat.CallbackListener<String>) {
    FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
        if (task.isSuccessful) {
            val pushToken = task.result
            CometChatNotifications.registerPushToken(
                pushToken,
                PushPlatforms.FCM_ANDROID,
                "YOUR_PROVIDER_ID",  // from CometChat dashboard §3
                object : CometChat.CallbackListener<String?>() {
                    override fun onSuccess(s: String?) {
                        listener.onSuccess(s)
                    }

                    override fun onError(e: CometChatException) {
                        listener.onError(e)
                    }
                }
            )
        } else {
            listener.onError(CometChatException("ERROR", "Failed to get FCM token"))
        }
    }
}
```

### Unregister before logout

**Java:**
```java
public static void unregisterFCMToken(CometChat.CallbackListener<String> listener) {
    CometChatNotifications.unregisterPushToken(new CometChat.CallbackListener<String>() {
        @Override
        public void onSuccess(String s) {
            listener.onSuccess(s);
        }

        @Override
        public void onError(CometChatException e) {
            listener.onError(e);
        }
    });
}
```

**Kotlin:**
```kotlin
fun unregisterFCMToken(listener: CometChat.CallbackListener<String>) {
    CometChatNotifications.unregisterPushToken(object : CometChat.CallbackListener<String?>() {
        override fun onSuccess(s: String?) {
            listener.onSuccess(s)
        }

        override fun onError(e: CometChatException) {
            listener.onError(e)
        }
    })
}
```

---

## 5. FirebaseMessagingService implementation

### 5a. Service class

**Java:**
```java
public class FCMService extends FirebaseMessagingService {
    private static String fcmToken;

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        fcmToken = token;
        // Re-register if user is already logged in
        // (token rotation can happen at any time)
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        if (message.getData().isEmpty()) return;

        String type = message.getData().get("type");
        if ("chat".equalsIgnoreCase(type)) {
            handleChatMessage(message);
        } else if ("call".equalsIgnoreCase(type)) {
            handleCallMessage(message);
        }
    }

    private void handleChatMessage(RemoteMessage message) {
        FCMMessageDTO dto = new Gson().fromJson(
            new Gson().toJson(message.getData()), FCMMessageDTO.class);

        // Mark as delivered
        CometChat.markAsDelivered(
            Long.parseLong(dto.getTag()),
            dto.getSender(),
            dto.getReceiverType(),
            dto.getReceiver()
        );

        // Build and show notification
        Intent clickIntent = new Intent(this, SplashActivity.class);
        FCMMessageNotificationUtils.showNotification(
            this, dto, clickIntent,
            "Reply", NotificationCompat.CATEGORY_MESSAGE
        );
    }
}
```

**Kotlin:**
```kotlin
class FCMService : FirebaseMessagingService() {
    companion object {
        var fcmToken: String? = null
            private set
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        fcmToken = token
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        if (message.data.isEmpty()) return

        when (message.data["type"]?.lowercase()) {
            "chat" -> handleChatMessage(message)
            "call" -> handleCallMessage(message)
        }
    }

    private fun handleChatMessage(message: RemoteMessage) {
        val dto = Gson().fromJson(
            Gson().toJson(message.data), FCMMessageDTO::class.java)

        CometChat.markAsDelivered(
            dto.tag!!.toLong(),
            dto.sender!!,
            dto.receiverType!!,
            dto.receiver!!
        )

        val clickIntent = Intent(this, SplashActivity::class.java)
        FCMMessageNotificationUtils.showNotification(
            this, dto, clickIntent,
            "Reply", NotificationCompat.CATEGORY_MESSAGE
        )
    }
}
```

### 5b. Register in AndroidManifest.xml

```xml
<service
    android:name=".fcm.FCMService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

---

## 6. Push payload schema

CometChat sends data-only FCM messages. The payload fields:

### Chat message payload (`type: "chat"`)

| Field | Type | Description |
|---|---|---|
| `type` | `String` | Always `"chat"` for messages |
| `sender` | `String` | Sender UID |
| `senderName` | `String` | Sender display name |
| `senderAvatar` | `String` | Sender avatar URL |
| `receiver` | `String` | Receiver UID (user) or GUID (group) |
| `receiverName` | `String` | Receiver display name |
| `receiverType` | `String` | `"user"` or `"group"` |
| `receiverAvatar` | `String` | Receiver avatar URL |
| `conversationId` | `String` | Conversation ID |
| `body` | `String` | Message text |
| `title` | `String` | Notification title |
| `tag` | `String` | Message ID (as string) |
| `unreadMessageCount` | `String` | Unread count (as string) |

### Call payload (`type: "call"`)

| Field | Type | Description |
|---|---|---|
| `type` | `String` | Always `"call"` |
| `callAction` | `String` | `"initiated"`, `"cancelled"`, `"unanswered"` |
| `sessionId` | `String` | Call session ID |
| `callType` | `String` | `"audio"` or `"video"` |
| `sender` / `receiver` / `senderName` / etc. | `String` | Same as chat payload |

### DTO classes

**Java:**
```java
public class FCMMessageDTO {
    @SerializedName("conversationId") private String conversationId;
    @SerializedName("sender") private String sender;
    @SerializedName("receiver") private String receiver;
    @SerializedName("receiverName") private String receiverName;
    @SerializedName("receiverType") private String receiverType;
    @SerializedName("receiverAvatar") private String receiverAvatar;
    @SerializedName("tag") private String tag;
    @SerializedName("body") private String text;
    @SerializedName("type") private String type;
    @SerializedName("title") private String title;
    @SerializedName("senderAvatar") private String senderAvatar;
    @SerializedName("senderName") private String senderName;
    @SerializedName("unreadMessageCount") private String unreadMessageCount;
    // getters and setters
}
```

**Kotlin:**
```kotlin
class FCMMessageDTO {
    @SerializedName("conversationId") var conversationId: String? = null
    @SerializedName("sender") var sender: String? = null
    @SerializedName("receiver") var receiver: String? = null
    @SerializedName("receiverName") var receiverName: String? = null
    @SerializedName("receiverType") var receiverType: String? = null
    @SerializedName("receiverAvatar") var receiverAvatar: String? = null
    @SerializedName("tag") var tag: String? = null
    @SerializedName("body") var text: String? = null
    @SerializedName("type") var type: String? = null
    @SerializedName("title") var title: String? = null
    @SerializedName("senderAvatar") var senderAvatar: String? = null
    @SerializedName("senderName") var senderName: String? = null
    @SerializedName("unreadMessageCount") var unreadMessageCount: String? = null
}
```

Parse from `RemoteMessage`:
```java
FCMMessageDTO dto = new Gson().fromJson(new Gson().toJson(message.getData()), FCMMessageDTO.class);
```

---

## 7. Notification channels (API 26+)

Create channels in your `Application.onCreate()` or before showing the first notification:

**Java:**
```java
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    NotificationManager manager = getSystemService(NotificationManager.class);

    NotificationChannel messageChannel = new NotificationChannel(
        "Message",                              // channel ID
        "Message notification",                 // channel name
        NotificationManager.IMPORTANCE_HIGH
    );
    manager.createNotificationChannel(messageChannel);

    NotificationChannel callChannel = new NotificationChannel(
        "Call",
        "Call notification",
        NotificationManager.IMPORTANCE_HIGH
    );
    callChannel.setSound(null, null);  // calls use their own ringtone
    manager.createNotificationChannel(callChannel);
}
```

**Kotlin:**
```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    val manager = getSystemService(NotificationManager::class.java)

    val messageChannel = NotificationChannel(
        "Message", "Message notification", NotificationManager.IMPORTANCE_HIGH
    )
    manager.createNotificationChannel(messageChannel)

    val callChannel = NotificationChannel(
        "Call", "Call notification", NotificationManager.IMPORTANCE_HIGH
    ).apply { setSound(null, null) }
    manager.createNotificationChannel(callChannel)
}
```

---

## 8. Tap-to-deep-link

The notification click intent routes through `SplashActivity` → `HomeActivity` → correct fragment/conversation.

### Setting up the click intent

**Java:**
```java
Intent clickIntent = new Intent(context, SplashActivity.class);
clickIntent.putExtra("NOTIFICATION_TYPE", "NOTIFICATION_TYPE_MESSAGE");
clickIntent.putExtra("NOTIFICATION_DATA", new Gson().toJson(fcmMessageDTO));
clickIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

PendingIntent pendingIntent = PendingIntent.getActivity(
    context, notificationId, clickIntent,
    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
);
```

### Handling in SplashActivity → HomeActivity

```java
// In HomeActivity.onCreate() or onNewIntent()
String notificationType = getIntent().getStringExtra("NOTIFICATION_TYPE");
String notificationPayload = getIntent().getStringExtra("NOTIFICATION_DATA");

if ("NOTIFICATION_TYPE_MESSAGE".equals(notificationType) && notificationPayload != null) {
    FCMMessageDTO dto = new Gson().fromJson(notificationPayload, FCMMessageDTO.class);
    if ("chat".equalsIgnoreCase(dto.getType())) {
        // Navigate to the conversation
        boolean isUser = "user".equals(dto.getReceiverType());
        String uid = isUser ? dto.getSender() : dto.getReceiver();
        // Open MessagesActivity with uid/guid
    }
}
```

---

## 9. Reply from notification

The sample apps support inline reply from the notification tray using `RemoteInput`:

**Java:**
```java
RemoteInput remoteInput = new RemoteInput.Builder("key_text_reply")
    .setLabel("Reply")
    .build();

NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
    R.drawable.ic_reply, "Reply", replyPendingIntent)
    .addRemoteInput(remoteInput)
    .build();

builder.addAction(replyAction);
```

The reply is received in a `BroadcastReceiver`:

```java
public class FCMMessageBroadcastReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
        if (remoteInput != null) {
            CharSequence replyText = remoteInput.getCharSequence("key_text_reply");
            // Send as TextMessage via CometChat.sendMessage()
        }
    }
}
```

---

## 10. Permissions

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
```

Request `POST_NOTIFICATIONS` at runtime on Android 13+:

**Java:**
```java
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
    }
}
```

**Kotlin:**
```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100)
    }
}
```

---

## 11. Badge count

CometChat sends `unreadMessageCount` in the payload. Apply it:

```java
String unreadCountStr = message.getData().get("unreadMessageCount");
if (unreadCountStr != null) {
    int count = Integer.parseInt(unreadCountStr);
    ShortcutBadger.applyCount(getApplicationContext(), count);
}
```

Clear on app open:
```java
ShortcutBadger.removeCount(this);
```

---

## 12. Testing the push pipeline

| Step | How | What it verifies |
|---|---|---|
| 1. FCM alone | Firebase Console → Cloud Messaging → Send test message to your FCM token | Firebase + `google-services.json` are correct |
| 2. CometChat → device | Send a message to the logged-in user from another user (dashboard or another device) | Dashboard provider config + token registration |
| 3. Tap deep-link | Background the app, send a message, tap the notification | `PendingIntent` routing to correct conversation |
| 4. Reply from notification | Pull down notification, type reply, send | `BroadcastReceiver` + `CometChat.sendMessage()` |
| 5. Token rotation | Clear app data, re-open → `onNewToken()` fires | `onNewToken()` re-registers with CometChat |

---

## 13. Troubleshooting — common silent failures

| Symptom | Likely cause | Fix |
|---|---|---|
| Token prints but no push arrives | Token registered BEFORE login, or wrong Provider ID | Call `registerPushToken()` AFTER `CometChatUIKit.login()` resolves. Verify Provider ID matches dashboard. |
| Foreground: nothing shows | No `onMessageReceived()` implementation or no notification channel | Implement `FCMService.onMessageReceived()` + create `NotificationChannel` on API 26+ |
| "Default FirebaseApp is not initialized" | `google-services.json` missing or Gradle plugin not applied | Re-check §2. Clean build: `./gradlew clean` |
| Notification tap doesn't navigate | `PendingIntent` missing extras or wrong Activity | Pass `NOTIFICATION_TYPE` + `NOTIFICATION_DATA` in Intent extras, handle in target Activity |
| Works for User A but not User B after logout | `unregisterPushToken` not called on logout | Call `CometChatNotifications.unregisterPushToken()` BEFORE `CometChatUIKit.logout()` |
| No notifications on Android 13+ | Missing `POST_NOTIFICATIONS` runtime permission | Request at runtime before registering token |
| Using deprecated `registerTokenForPushNotification()` | Old API from v4 | Use `CometChatNotifications.registerPushToken()` with `PushPlatforms.FCM_ANDROID` |
| Provider ID mismatch | Client uses different Provider ID than dashboard | Copy exact Provider ID string from CometChat dashboard → Notifications → Push |

---

## 14. VoIP call push (advanced)

Call pushes (`type: "call"`) require VoIP permissions and `CometChatVoIP` integration. The flow:

1. `onMessageReceived()` detects `type == "call"`
2. Check `callAction`: `"initiated"` → show incoming call, `"cancelled"` / `"unanswered"` → dismiss
3. Verify VoIP permissions: `CometChatVoIP.hasReadPhoneStatePermission()`, `hasManageOwnCallsPermission()`, `hasAnswerPhoneCallsPermission()`
4. If granted: `CometChatVoIP.addNewIncomingCall()` with call details in a `Bundle`

This is an advanced topic — see the `voip/` package in the sample apps for the full implementation.

---

## Hard rules

- **Use `CometChatNotifications.registerPushToken()` — NOT the deprecated `CometChat.registerTokenForPushNotification()`.** The v5 API requires `PushPlatforms.FCM_ANDROID` and a Provider ID.
- **Register AFTER login.** The SDK needs a logged-in user to scope the token.
- **Unregister BEFORE logout.** Call `CometChatNotifications.unregisterPushToken()` before `CometChatUIKit.logout()`.
- **Handle `onNewToken()`.** FCM rotates tokens — missing the rotation means push stops working for some users.
- **Create notification channels on API 26+.** Without a channel, notifications are silently dropped.
- **Provider ID must match the dashboard.** Copy the exact string from CometChat dashboard → Notifications → Push Notifications.
- **Call `CometChat.markAsDelivered()` in `onMessageReceived()`.** This updates delivery receipts even when the app is backgrounded.
- **Test on a real device.** Emulator FCM behavior differs from real devices.
- **Don't suppress `onMessageReceived()` for foreground messages.** CometChat sends data-only pushes — the OS does NOT auto-display them. You must build the notification yourself.
