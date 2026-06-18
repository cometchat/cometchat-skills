# CometChat Calls Android SDK v4 → v5 migration

`com.cometchat:calls-sdk-android:5.+` is a drop-in upgrade for v4 — bump the Gradle dependency, existing code still compiles thanks to deprecated method shims.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/migration-guide-v5

**Important:** This is the migration for the **Calls SDK** (v4 → v5 of the calls dependency). It is NOT the same as the **UI Kit cohort migration** (V5 cohort → V6 Compose cohort), which is documented in `cometchat-android-v6-migration`. You can be on UI Kit V5 cohort with Calls SDK v5 — they version independently.

---

## Step 1 — Bump the Gradle dependency

```kotlin
// app/build.gradle.kts
dependencies {
  implementation("com.cometchat:calls-sdk-android:5.+")
}
```

```bash
./gradlew :app:dependencies | grep calls-sdk
```

Should show `com.cometchat:calls-sdk-android:5.x.x`.

---

## Step 2 — Migrate init to the v5 builder + `Context`

v5 still uses a builder — but the class is the **nested `CallAppSettings.CallAppSettingBuilder`** (singular "Setting"), and `init` now takes `Context` as its first argument.

```diff
- val callAppSettings = CallAppSettings.Builder()
-   .setAppId("APP_ID")
-   .setRegion("REGION")
-   .build()
- CometChatCalls.init(callAppSettings, object : CometChatCalls.CallbackListener<String>() {
-   override fun onSuccess(s: String) { /* ... */ }
-   override fun onError(e: CometChatException) { /* ... */ }
- })

+ val callAppSettings = CallAppSettings.CallAppSettingBuilder()   // nested, singular "Setting"
+   .setAppId("APP_ID")
+   .setRegion("REGION")
+   .build()
+ CometChatCalls.init(context, callAppSettings, object : CometChatCalls.CallbackListener<String>() {
+   override fun onSuccess(s: String) { /* ... */ }
+   override fun onError(e: CometChatException) { /* ... */ }
+ })
```

> Verified against `calls-sdk-android` 5.x: `CometChatCalls.init(Context, CallAppSettings, CallbackListener<String>)` and `CallAppSettings.CallAppSettingBuilder().setAppId(...).setRegion(...).build()`. There is NO `CallAppSettings(appId =, region =)` constructor and NO `CallAppSettings.Builder()`.

(V5 also supports coroutine-suspend `init` via `kotlinx.coroutines` extensions, if you've enabled them.)

---

## Step 3 — Add Calls SDK login (mandatory)

In v5 the Calls SDK has its own auth state, separate from the Chat SDK. Without a Calls SDK login step, the FIRST calls API call (initiate, join, generateToken) throws **"auth token cannot be null"**.

The Android v5 Calls SDK exposes two `CometChatCalls.login` overloads — match the API exactly:

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.exceptions.CometChatException as CallsException
import com.cometchat.calls.model.CallUser   // ← callback returns CallUser, NOT User

// Dev mode (Auth Key)
CometChatCalls.login(uid, AUTH_KEY,
    object : CometChatCalls.CallbackListener<CallUser>() {
        override fun onSuccess(callUser: CallUser) {
            // calls SDK is now ready
        }
        override fun onError(e: CallsException) {
            // surface to user — common cause: typo in app id / auth key
        }
    })

// Production mode (server-minted auth token)
CometChatCalls.login(authToken,
    object : CometChatCalls.CallbackListener<CallUser>() { /* … */ })
```

**Hard rules:**

1. **Call this AFTER `CometChat.login()` succeeds** — the Calls SDK login won't work until the Chat SDK has a valid session.
2. **The callback receives `com.cometchat.calls.model.CallUser`**, not `com.cometchat.chat.models.User`. Importing the wrong type produces "Type mismatch" at compile time.
3. **Re-login on every cold start** — the Chat SDK persists login across launches via Shared Prefs; the Calls SDK does NOT. Each app launch where `CometChat.getLoggedInUser()` returns non-null still needs a fresh `CometChatCalls.login` call.
4. **Don't try `user.authToken`** — `com.cometchat.chat.models.User` does NOT expose `authToken` as a Kotlin property or Java getter on Android. Use the (uid, apiKey) overload for dev, or fetch the auth token from your backend for production. *(This trapped a real smoke run — the chat-side User object hides the auth token.)*

After this step, `generateToken()` no longer needs the authToken parameter — the Calls SDK uses its internal session.

---

## Step 4 — Migrate CallSettings.Builder to SessionSettings

```diff
- val callSettings = CallSettings.Builder(activity)
-   .setSessionType(SessionType.VIDEO)
-   .startWithAudioMuted(false)
-   .showRecordingButton(true)
-   .build()

+ val sessionSettings = CometChatCalls.SessionSettingsBuilder()
+   .setSessionType(SessionType.VIDEO)
+   .startAudioMuted(false)
+   .hideRecordingButton(false)     // INVERTED — showRecordingButton(true) → hideRecordingButton(false)
+   .setLayout(LayoutType.TILE)
+   .build()
```

> There is NO `SessionSettings(sessionType =, startAudioMuted =, hideRecordingButton =, layout =)` data-class constructor on Android — use `CometChatCalls.SessionSettingsBuilder()` with the chained flag methods (cf. `call-session.md` rule 2).

---

## Step 5 — Migrate listener interface to event listeners

v5 splits the old single events interface into five abstract listeners (`SessionStatusListener`,
`ParticipantEventListener`, `MediaEventsListener`, `ButtonClickListener`, `LayoutListener`).
Register them on the `CallSession` instance from `joinSession`'s `onSuccess` callback — there is
NO `CometChatCalls.addEventListener` and NO `CallEvent` enum on Android (cf. `call-session.md`
rule 3 and `references/event-listeners.md`). The listeners are lifecycle-aware (pass the
Activity/Fragment as the first arg) and auto-removed on destroy.

```diff
- class MyCallEvents : CometChatCallsEventsListener {
-   override fun onCallEnded() { /* ... */ }
-   override fun onUserJoined(user: User) { /* ... */ }
-   override fun onUserLeft(user: User) { /* ... */ }
-   override fun onError(error: CometChatException) { /* ... */ }
- }

+ // In joinSession's onSuccess(callSession: CallSession):
+ callSession.addSessionStatusListener(this, object : SessionStatusListener() {
+   override fun onSessionLeft() { /* ... */ }
+ })
+ callSession.addParticipantEventListener(this, object : ParticipantEventListener() {
+   override fun onParticipantJoined(participant: Participant) { /* ... */ }
+   override fun onParticipantLeft(participant: Participant) { /* ... */ }
+ })
+ // ...plus MediaEventsListener / ButtonClickListener / LayoutListener as needed.
+ // See references/event-listeners.md for the full override set on each.
```

---

## Step 6 — Method renames + receiver shift (Android-specific)

v5 moved call-control APIs from static methods on `CometChatCalls` to **instance methods on `CallSession`** (the object returned by `joinSession`'s callback). Session teardown moved from the v4 static `CometChatCalls.endSession()` to the instance method `callSession.leaveSession()` — this is what both calls-sdk-android sample apps use and what the migration guide maps it to. Keep a reference to the `CallSession` (or use `CallSession.getInstance()`); v4 static receivers throw "method not found" against the v5 SDK.

```diff
// session lifecycle — receiver changes from CometChatCalls (static) to CallSession (instance)
- CometChatCalls.endSession()
+ callSession.leaveSession()                       // call on the CallSession from joinSession's onSuccess
+ // OR if you don't have the reference handy:
+ CallSession.getInstance().leaveSession()

// media controls — same receiver shift
- CometChatCalls.muteAudio(true)
+ callSession.muteAudio()
- CometChatCalls.muteAudio(false)
+ callSession.unmuteAudio()

- CometChatCalls.pauseVideo(true)
+ callSession.pauseVideo()
- CometChatCalls.pauseVideo(false)
+ callSession.resumeVideo()

// screen share — Android is RECEIVE-ONLY in v5: there is NO screen-share initiation API.
// Drop any startScreenShare()/stopScreenShare() calls; observe incoming shares via
// ParticipantEventListener.onParticipantStartedScreenShare / onParticipantStoppedScreenShare.
- CometChatCalls.startScreenShare()
- CometChatCalls.stopScreenShare()

// layout — instance method on the CallSession in v5 (NOT static on CometChatCalls)
- CometChatCalls.setMode(mode)
+ callSession.setLayout(layout)              // or CallSession.getInstance().setLayout(layout)
```

**Hold onto the `CallSession` reference** returned by `joinSession`'s `onSuccess(callSession: CallSession)` callback — most v5 in-call APIs live there. Stashing it in an Activity field or ViewModel is the canonical pattern; the SDK also exposes `CallSession.getInstance()` as a fallback if you've lost the reference.

---

## Step 7 — Compose call surface unchanged

If you're using XML `CometChatCallActivity`, no changes. If you've embedded the call surface via `CometChatOngoingCallView`, the v5 SDK's view component takes `SessionSettings` directly:

```diff
- callView.startCall(callSettings)
+ callView.joinSession(sessionSettings)
```

---

## ConnectionService + ForegroundServiceType (no v5 changes)

The seven hard rules from `cometchat-android-v5-calls/SKILL.md` still apply post-v5:
- ConnectionService for incoming calls
- `foregroundServiceType="microphone"` (or `camera|microphone`) for active calls
- Hangup teardown sequence

---

## Verification checklist

- [ ] `app/build.gradle.kts` lists calls-sdk-android v5+
- [ ] `./gradlew :app:dependencies` shows v5 resolved
- [ ] `CometChatCalls.login(authToken)` called after `CometChat.login`
- [ ] `CometChatCallsEventsListener` replaced with the five split listeners on the `CallSession` instance
- [ ] `CallSettings.Builder` replaced with `CometChatCalls.SessionSettingsBuilder()`
- [ ] Method renames applied
- [ ] FCM VoIP push still arrives + ConnectionService still surfaces UI
- [ ] Real-device smoke: 2 phones, foreground + backgrounded recipient, mic/camera/screenshare/end

---

## Pointers

- Canonical migration: https://www.cometchat.com/docs/calls/android/migration-guide-v5
- `cometchat-android-v5-calls/SKILL.md` — seven hard rules (unchanged in v5)
- `cometchat-android-v5-calls/references/server-fcm-voip.md` — FCM (unchanged in v5)
