# Adding calls to an existing chat integration (Android V5)

You have `chatuikit-android` (V5 cohort) working. Adding calls = `calls-sdk-android` + ConnectionService + foreground service permissions.

**Read first:** `cometchat-android-v5-calls/SKILL.md` — seven hard rules (init order, ConnectionService, foreground service type, hangup teardown).

---

## Step 1 — Install Calls SDK from Cloudsmith

```kotlin
// settings.gradle.kts (or settings.gradle)
dependencyResolutionManagement {
  repositories {
    maven { url = uri("https://dl.cloudsmith.io/public/cometchat/cometchat/maven/") }
    google()
    mavenCentral()
  }
}

// app/build.gradle.kts
dependencies {
  implementation("com.cometchat:calls-sdk-android:5.+")
  // existing chat-uikit dependency stays
}
```

```bash
./gradlew :app:dependencies | grep calls-sdk-android
```

Should resolve to `5.x.x`.

---

## Step 2 — Permissions + manifest

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA"/>

<application ...>
  <service
    android:name=".AppConnectionService"
    android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
    android:foregroundServiceType="microphone|camera"
    android:exported="true">
    <intent-filter>
      <action android:name="android.telecom.ConnectionService"/>
    </intent-filter>
  </service>
</application>
```

`foregroundServiceType="microphone|camera"` is mandatory on Android 14+.

---

## Step 3 — Init order: chat → calls

In your existing `Application.onCreate` or your init activity:

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.core.CallAppSettings

// Existing chat init
CometChatUIKit.init(this, uikitSettings, object : CometChat.CallbackListener<String>() {
  override fun onSuccess(s: String) {
    // NEW: Calls init AFTER chat init
    val callsSettings = CallAppSettings(appId = APP_ID, region = REGION)
    CometChatCalls.init(callsSettings, object : CometChatCalls.CallbackListener<String>() {
      override fun onSuccess(s: String) { /* both initialized */ }
      override fun onError(e: CometChatException) { Log.e("App", "Calls init failed", e) }
    })
  }

  override fun onError(e: CometChatException) {}
})
```

---

## Step 4 — Login both SDKs

After your existing login flow:

```kotlin
CometChat.login(uid, authKey, object : CometChat.CallbackListener<User>() {
  override fun onSuccess(user: User) {
    val authToken = user.authToken
    CometChatCalls.login(authToken, object : CometChatCalls.CallbackListener<User>() {
      override fun onSuccess(user: User) { /* calls SDK ready */ }
      override fun onError(e: CometChatException) {}
    })
  }
  override fun onError(e: CometChatException) {}
})
```

---

## Step 5 — IncomingCall via ConnectionService

Implement `AppConnectionService` (see `cometchat-android-v5-calls/SKILL.md` rule 4). The ConnectionService receives FCM data-message → calls `addNewIncomingCall` → OS shows incoming-call UI.

Plus an `IncomingCallActivity` that handles user action (accept/reject) and routes to your chat UI's call surface:

```kotlin
class IncomingCallActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Show over lock screen
    setShowWhenLocked(true)
    setTurnScreenOn(true)
    // ... bind your incoming-call layout
  }
}
```

---

## Step 6 — FCM token registration

Add a `FirebaseMessagingService` subclass and POST tokens to your server (see `cometchat-android-v5-calls/references/server-fcm-voip.md`):

```kotlin
class VoipMessagingService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    // POST to your server, keyed to current user UID
    api.registerCallToken(currentUid, "android-fcm", token)
  }

  override fun onMessageReceived(message: RemoteMessage) {
    if (message.data["type"] != "incoming_call") return
    // Hand off to ConnectionService — see V5 server-fcm-voip reference
  }
}
```

Register in manifest:
```xml
<service
  android:name=".VoipMessagingService"
  android:exported="false">
  <intent-filter>
    <action android:name="com.google.firebase.MESSAGING_EVENT" />
  </intent-filter>
</service>
```

---

## Step 7 — Hangup teardown

```kotlin
fun endCall(sessionId: String) {
  CometChatCalls.leaveSession()
  CometChat.endCall(sessionId, object : CometChat.CallbackListener<Call>() { /* ... */ })
  // ConnectionService disconnect
  activeConnection?.setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
  activeConnection?.destroy()
}
```

---

## Verification checklist

- [ ] Cloudsmith Maven repo added
- [ ] `calls-sdk-android:5.+` in app/build.gradle
- [ ] Manifest permissions: RECORD_AUDIO, CAMERA, MANAGE_OWN_CALLS, FOREGROUND_SERVICE_MICROPHONE/CAMERA
- [ ] AppConnectionService declared with `foregroundServiceType` + permission
- [ ] Calls init runs AFTER chat init's onSuccess
- [ ] Calls login runs AFTER chat login's onSuccess
- [ ] FCM token registered + POSTed to server
- [ ] Hangup tears down all 3: leaveSession, endCall, ConnectionService disconnect
- [ ] Real-device smoke: app killed → caller dials → recipient phone rings on lock screen
- [ ] Run `cometchat verify --calls` — should pass

---

## Pointers

- `cometchat-react-calls/references/add-calls-to-existing-chat.md` — canonical
- `cometchat-android-v5-calls/SKILL.md` — seven hard rules
- `cometchat-android-v5-calls/references/server-fcm-voip.md` — server-side FCM
