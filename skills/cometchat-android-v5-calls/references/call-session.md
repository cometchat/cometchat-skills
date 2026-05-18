# Call session — joinSession with no ringing (Android V5 / Views)

Server-generated sessionId, both parties enter it. Customer-validated against `~/Downloads/calls-sdk/calls-sdk-android-5/samples/sample-app/src/main/kotlin/com/cometchat/samplecalls/ui/activity/CallActivity.kt`.

**Read first:** `cometchat-react-calls/references/call-session.md` — cross-platform architecture (sessionId strategies, server-side authorization). Then come back here for the Android shape.

---

## Hard rules (Android-specific overrides on top of the cross-platform rules)

1. **`CometChatCalls.joinSession(sessionId, sessionSettings, container, CallbackListener<CallSession>)`** takes the sessionId DIRECTLY — token generation happens internally. No separate `generateToken` call required. Matches the upstream sample.
2. **`CometChatCalls.SessionSettingsBuilder()` is the canonical settings shape** (nested class on `CometChatCalls`). Chained `.setTitle().startVideoPaused(false).startAudioMuted(false).build()`. NOT `SessionSettings(sessionType:, layout:)` — that constructor does not exist on Android.
3. **`SessionStatusListener` + `ButtonClickListener` are abstract classes registered on the `CallSession` instance** returned in `onSuccess`. NOT `CometChatCalls.addEventListener(CallEvent.SESSION_LEFT)` — that does not exist.
4. **`CometChatOngoingCallService.launch(this)` + `.abort(this)`** manage the platform foreground service. Call `launch()` in `onSessionJoined`; call `abort()` in EVERY termination path (`onSessionLeft`, `onConnectionClosed`, `onSessionTimedOut`, `onDestroy`, `endCall`). Service notification persists otherwise.
5. **For standalone session-only integrations, the Chat SDK is OPTIONAL.** The upstream Android sample only depends on `com.cometchat.calls-sdk-android`. Keep `CometChat.init` / `CometChat.login` only for additive (chat + calls) integrations.
6. **Runtime permission request** for `CAMERA` + `RECORD_AUDIO` (Android 6.0+). The manifest entries are necessary but not sufficient on modern Android.

---

## CallActivity (canonical XML/Views shape)

```kotlin
package com.example.calls

import android.os.Bundle
import android.util.Log
import android.widget.RelativeLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.exceptions.CometChatException
import com.cometchat.calls.listeners.ButtonClickListener
import com.cometchat.calls.listeners.SessionStatusListener
import com.cometchat.calls.services.CometChatOngoingCallService

class CallActivity : AppCompatActivity() {

  companion object {
    private const val TAG = "CallActivity"
    const val EXTRA_SESSION_ID = "session_id"
  }

  private lateinit var callContainer: RelativeLayout
  private lateinit var sessionId: String

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_call)

    sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: run {
      Toast.makeText(this, "Invalid session ID", Toast.LENGTH_SHORT).show()
      finish()
      return
    }

    callContainer = findViewById(R.id.call_container)

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() = endCall()
    })

    joinSession()
  }

  private fun joinSession() {
    val sessionSettings = CometChatCalls.SessionSettingsBuilder()
      .setTitle("CometChat Meeting")
      .startVideoPaused(false)
      .startAudioMuted(false)
      .build()

    CometChatCalls.joinSession(
      sessionId,
      sessionSettings,
      callContainer,
      object : CometChatCalls.CallbackListener<CallSession>() {
        override fun onSuccess(callSession: CallSession) {
          Log.d(TAG, "Joined session: $sessionId")
          setupCallListeners(callSession)
        }

        override fun onError(e: CometChatException) {
          Log.e(TAG, "Failed to join session: ${e.message}")
          runOnUiThread {
            Toast.makeText(this@CallActivity, "Failed to join: ${e.message}", Toast.LENGTH_LONG).show()
            finish()
          }
        }
      }
    )
  }

  private fun setupCallListeners(callSession: CallSession) {
    callSession.addSessionStatusListener(this, object : SessionStatusListener() {
      override fun onSessionJoined() {
        CometChatOngoingCallService.launch(this@CallActivity)
      }

      // All termination events funnel through ONE guarded handleTermination().
      // The v5 Calls SDK fires onSessionLeft + onConnectionClosed in sequence
      // on every hangup. Activity.finish() is idempotent (safe to call multiple
      // times) but abort() isn't — multiple abort calls log warnings and waste
      // foreground-service teardown work.
      override fun onSessionLeft() = handleTermination()
      override fun onConnectionClosed() = handleTermination()
      override fun onSessionTimedOut() = handleTermination()

      override fun onConnectionLost() {
        runOnUiThread {
          Toast.makeText(this@CallActivity, "Connection lost", Toast.LENGTH_SHORT).show()
        }
      }

      override fun onConnectionRestored() {
        runOnUiThread {
          Toast.makeText(this@CallActivity, "Connection restored", Toast.LENGTH_SHORT).show()
        }
      }
    })

    callSession.addButtonClickListener(this, object : ButtonClickListener() {
      override fun onLeaveSessionButtonClicked() = endCall()
    })
  }

  private var isTerminating = false

  private fun handleTermination() {
    if (isTerminating) return
    isTerminating = true
    runOnUiThread {
      CometChatOngoingCallService.abort(this)
      if (!isFinishing) finish()
    }
  }

  private fun endCall() {
    val callSession = CallSession.getInstance()
    if (callSession.isSessionActive) callSession.leaveSession()
    handleTermination()
  }

  override fun onDestroy() {
    super.onDestroy()
    CometChatOngoingCallService.abort(this)
  }
}
```

XML (`res/layout/activity_call.xml`):

```xml
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/call_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@android:color/black" />
```

**Why this shape:**

- **Single-call `joinSession(sessionId, settings, container, callback)`** — token generation is internal. Customers don't manage tokens; the SDK does.
- **`CometChatCalls.SessionSettingsBuilder()` (nested class)** — the outer namespacing matters; raw `SessionSettingsBuilder()` won't resolve.
- **Listener-on-`CallSession`-instance pattern** — register against the `CallSession` from `onSuccess`, NOT against the global `CometChatCalls` singleton. Each session has its own listener registry.
- **`onSessionLeft`, `onConnectionClosed`, `onSessionTimedOut` ALL terminate the activity.** All three are real termination paths.
- **`CometChatOngoingCallService.launch/abort`** — required for Android 14+ foreground-service compliance with `FOREGROUND_SERVICE_MICROPHONE`. Skipping `abort()` leaves the persistent notification.

---

## Manifest requirements

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<application>
  <activity android:name=".CallActivity" />
  <service
    android:name="com.cometchat.calls.services.CometChatOngoingCallService"
    android:foregroundServiceType="microphone|camera"
    android:exported="false" />
</application>
```

---

## Runtime permissions (Kotlin)

```kotlin
val permLauncher = registerForActivityResult(
  ActivityResultContracts.RequestMultiplePermissions()
) { perms ->
  val granted = perms[Manifest.permission.CAMERA] == true &&
                perms[Manifest.permission.RECORD_AUDIO] == true
  if (granted) {
    // proceed to call
  } else {
    // show explanation + deep-link to app settings
  }
}

permLauncher.launch(arrayOf(
  Manifest.permission.CAMERA,
  Manifest.permission.RECORD_AUDIO,
  Manifest.permission.POST_NOTIFICATIONS,  // Android 13+
))
```

---

## Deep-link routing (App Links)

```xml
<activity android:name=".CallActivity">
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="yourapp.com" android:pathPrefix="/meet/" />
  </intent-filter>
</activity>
```

`MainActivity.onCreate` / `onNewIntent` routes to `CallActivity` extracting the sessionId from `intent.data.lastPathSegment`.

See `cometchat-android-v5-calls/references/share-invite.md` for full deep-link config.

---

## Anti-patterns

1. **`CometChatCalls.generateToken(sessionId)` then `joinSession(callToken, ...)` two-step.** The Android API takes sessionId directly via `joinSession(sessionId, settings, container, callback)`. The two-step exists for advanced cases (custom auth tokens) but the canonical pattern is single-call.
2. **`SessionSettings(sessionType:, layout:)` data-class constructor.** Doesn't exist on Android. Use `CometChatCalls.SessionSettingsBuilder().build()`.
3. **`CometChatCalls.addEventListener(CallEvent.SESSION_LEFT)`.** Doesn't exist on Android. Register `SessionStatusListener()` on the `CallSession` instance from `onSuccess`.
4. **Skipping `CometChatOngoingCallService.abort()` in `onDestroy` / `onConnectionClosed` / `onSessionTimedOut`.** Foreground-service notification persists; user sees "Ongoing call" with no way to clear.
5. **`addSessionStatusListener` without the `lifecycleOwner` (this) argument.** The two-arg form `(lifecycleOwner, listener)` ties listener cleanup to the activity's lifecycle — required to avoid leaks.
6. **Calling `leaveSession()` without checking `callSession.isSessionActive`.** Throws on double-leave; can happen if back button + onSessionLeft fire concurrently.
7. **Initializing Chat SDK for a session-only integration.** Wastes time and adds two extra failure modes. Drop `CometChat.init` / `CometChat.login` entirely for standalone session apps.

---

## Verification checklist

- [ ] `CometChatCalls.joinSession(sessionId, settings, container, CallbackListener)` — single-call shape
- [ ] Settings built via `CometChatCalls.SessionSettingsBuilder()`, not constructor
- [ ] `SessionStatusListener()` registered on the `CallSession` from `onSuccess` (with lifecycle owner)
- [ ] `ButtonClickListener()` registered for the leave button
- [ ] `CometChatOngoingCallService.launch(this)` in `onSessionJoined`
- [ ] `CometChatOngoingCallService.abort(this)` in EVERY termination path
- [ ] Manifest has `FOREGROUND_SERVICE_MICROPHONE` + `FOREGROUND_SERVICE_CAMERA` (Android 14+)
- [ ] `<service android:name="com.cometchat.calls.services.CometChatOngoingCallService" android:foregroundServiceType="microphone|camera" />` in manifest
- [ ] Runtime permission request for `CAMERA`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`
- [ ] App Links intent-filter for `/meet/*`
- [ ] **Standalone session-only:** no `com.cometchat:chat-sdk-android` dependency — Calls SDK alone
- [ ] **Additive (chat + calls):** dual-SDK contract preserved
- [ ] Real-device smoke: rotation doesn't double-join, leave clears the foreground notification

---

## Pointers

- `cometchat-react-calls/references/call-session.md` — cross-platform architecture
- `cometchat-android-v5-calls/SKILL.md` — Android V5 architecture
- `cometchat-android-v5-calls/references/share-invite.md` — App Links config
- Upstream Android sample — `~/Downloads/calls-sdk/calls-sdk-android-5/samples/sample-app/src/main/kotlin/com/cometchat/samplecalls/ui/activity/CallActivity.kt`
- Canonical docs: https://www.cometchat.com/docs/calls/android/join-session
