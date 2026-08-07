---
name: cometchat-android-v5-calls
description: CometChat Calls SDK v5 integration for native Android (V5 stable, Java + Kotlin Views). Covers SDK setup (Cloudsmith Maven, CallAppSettings, init), the dual-SDK ringing pattern (Chat SDK initiateCall + Calls SDK joinSession), session settings, event listeners, call logs, recording, screen sharing, picture-in-picture, foreground service for ongoing calls, VoIP push via FCM + ConnectionService, audio/video/participant controls, custom UI, and in-call chat. Use in standalone mode (calls is the product) or additive mode (calls layered on top of an existing CometChat Android v5 chat integration).
license: "MIT"
compatibility: "Android Studio Hedgehog+, JDK 17, Gradle 8+, AGP 8+, minSdk 26+, compileSdk 35; com.cometchat:calls-sdk-android:5.x; com.cometchat:chat-sdk-android:4.x (when ringing)"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat android v5 calls voice video webrtc kotlin java cloudsmith callappsettings session-settings call-logs recording screen-sharing pip foreground-service voip fcm connectionservice"
---

## Purpose

Production-grade voice + video calling for native Android v5. Loaded by the `cometchat-calls` dispatcher when the project is Android v5 (detected from `chat-sdk-android:4.x` / `chatuikit-android:5.x` or asked when greenfield). Operates in two modes:

- **Standalone** — calls is the product. No `chatuikit-android` UI Kit; just `chat-sdk-android` (for signaling) + `calls-sdk-android` + your own UI surfaces (CallButton on profile, CallLogsActivity, OngoingCallActivity).
- **Additive** — calls layered onto an existing v5 chat integration. The kit's `CometChatMessageHeader` already exposes call buttons; this skill wires them to the Calls SDK and mounts the global `IncomingCall` listener at app root.

**Read these other skills first:**
- `cometchat-calls` — the dispatcher (mode selection, hard rules, anti-patterns)
- `cometchat-android-v5-core` — Chat SDK init, login order, `local.properties` + `BuildConfig` credential conventions, Application class wiring

**Ground truth:**
- SDK source — `calls-sdk-android-5/sdk/`
- Sample app — `calls-sdk-android-5/samples/`
- Pre-authored topic docs — `references/` in this skill (16 docs, ~2300 lines, audited against `calls-sdk-android@5.0.x` (v5 GA))
- Public docs — https://www.cometchat.com/docs/calls/android/overview

---

## How to use this skill

This SKILL.md is the **index + hard rules + Android-specific gotchas**. Deep topic content lives in `references/`. Always read this file end-to-end first; load references on demand.

| Topic | Reference file | When to load |
|---|---|---|
| SDK setup (Cloudsmith, init, permissions, Jetifier) | `references/setup.md` | Step 1 of every integration |
| Joining a session (`SessionSettingsBuilder`, voice vs video) | `references/join-session.md` | Step 2 — every integration |
| Dual-SDK ringing (Chat SDK + Calls SDK together) | `references/ringing-integration.md` | Standalone or additive — every integration with peer-to-peer call flow |
| All `SessionSettingsBuilder` options (layouts, mode, hide buttons) | `references/session-settings.md` | When customizing in-call UI behavior |
| Event listeners (status, participant, media, button-click, layout) | `references/event-listeners.md` | When wiring call lifecycle to app state |
| Call history list | `references/call-logs.md` | When adding `/calls` route or in-app history |
| Recording (auto-start, recording events) | `references/recording.md` | Feature add |
| Screen sharing (viewer + presenter status) | `references/screen-sharing.md` | Feature add |
| Picture-in-picture | `references/picture-in-picture.md` | Feature add |
| **Foreground service for ongoing calls** | `references/background-handling.md` | **Required** — every standalone integration on Android 14+ |
| **VoIP push (ConnectionService + FCM high-priority + PhoneAccount)** | `references/voip-calling.md` | **Required** — every standalone integration; optional but strongly recommended in additive |
| Audio controls (mute/unmute, device switching) | `references/audio-controls.md` | Default UI customization |
| Video controls (camera on/off, switch camera) | `references/video-controls.md` | Default UI customization |
| Participant management (mute/kick/raise hand) | `references/participant-management.md` | Group calls / moderator features |
| Custom UI (control panel, participant list, layout) | `references/custom-ui.md` | When the default UI doesn't fit |
| In-call chat (messaging during active session) | `references/in-call-chat.md` | Feature add |

`references/README.md` is a skim-friendly index of the same.

---

## 1. The seven hard rules

These are the production-grade non-negotiables from the `cometchat-calls` dispatcher, specialized for Android v5. Every integration this skill writes must satisfy all seven.

### 1.0 Calls SDK login is its own step (v5+)

The v5 Calls SDK has its own auth state, separate from the Chat SDK. After `CometChat.login(uid, AUTH_KEY)` succeeds, you MUST also call `CometChatCalls.login(uid, AUTH_KEY, ...)` — without it, the FIRST calls API call (`initiateCall`, `joinSession`, `generateToken`) throws **"auth token cannot be null"**.

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.exceptions.CometChatException as CallsException
import com.cometchat.calls.model.CallUser   // ← callback type, NOT chat User

// ✓ RIGHT — chat login first, then calls login
CometChat.login(uid, AUTH_KEY, object : CometChat.CallbackListener<User>() {
  override fun onSuccess(user: User) {
    CometChatCalls.login(uid, AUTH_KEY,
      object : CometChatCalls.CallbackListener<CallUser>() {
        override fun onSuccess(callUser: CallUser) { /* both ready */ }
        override fun onError(e: CallsException) { /* surface */ }
      })
  }
  override fun onError(e: CometChatException) { /* surface */ }
})
```

**Surprises:**
- The chat-side `User` object does **NOT** expose `authToken` as a Kotlin property or Java getter on Android. Don't try `user.authToken` — use the `(uid, apiKey)` overload for dev, or fetch the auth token from your backend for production.
- The Calls SDK callback returns `com.cometchat.calls.model.CallUser`, NOT `com.cometchat.chat.models.User`. Importing the wrong type produces "Type mismatch" at compile time.
- The Calls SDK does NOT persist login across launches the way the Chat SDK does. Even if `CometChat.getLoggedInUser()` returns a non-null user on cold start, you still need to call `CometChatCalls.login` again before any calls API works.

This trapped a real smoke run. The chat skill's `loginAfter` pattern doesn't transfer to calls; this is calls-specific.

### 1.1 Dual-SDK contract — `Call` lives in two places

The Chat SDK initiates ringing (`CometChat.initiateCall(...)`); the Calls SDK runs the WebRTC session (`CometChatCalls.joinSession(...)`). They are NOT interchangeable, and there are **two `Call` classes** with the same simple name:

- **`com.cometchat.chat.core.Call`** — Chat SDK. Used by `initiateCall`, `acceptCall`, `rejectCall`. Carries `sessionId`, `receiver`, `receiverType`, `callType`. **This is the one you almost always want.**
- **There is only ONE `Call` class: `com.cometchat.chat.core.Call`** (it extends `BaseMessage`, so it surfaces in conversation/message-list contexts too). There is **no** `com.cometchat.chat.models.Call` — do not import that path (it does not exist).

```kotlin
// ✓ RIGHT — initiate ringing
import com.cometchat.chat.core.Call
import com.cometchat.chat.core.CometChat

val outgoing = Call(receiverUid, CometChatConstants.RECEIVER_TYPE_USER, CometChatConstants.CALL_TYPE_VIDEO)
CometChat.initiateCall(outgoing, object : CometChat.CallbackListener<Call>() {
  override fun onSuccess(initiated: Call) {
    // initiated.sessionId is what the Calls SDK will join
  }
  override fun onError(e: CometChatException) { /* surface to UI */ }
})
```

```kotlin
// ✓ RIGHT — join the WebRTC session after the receiver accepts
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.model.SessionType

// SessionSettingsBuilder is a NESTED class on CometChatCalls — access it via
// CometChatCalls.SessionSettingsBuilder, NOT a top-level import.
// `import com.cometchat.calls.core.SessionSettingsBuilder` fails: no such class.
// Audio vs video is set via setSessionType(SessionType.VOICE | SessionType.VIDEO).
// There is NO setIsAudioOnly() method on SessionSettingsBuilder — earlier
// drafts of this skill cited it; that was wrong. Confirmed against
// calls-sdk-android 5.0.x (ENG-35698 fix).
val settings = CometChatCalls.SessionSettingsBuilder()
  .setSessionType(SessionType.VIDEO)   // or SessionType.VOICE for audio-only
  .build()

// 4-arg signature: sessionId (or token), settings, RelativeLayout container, callback.
CometChatCalls.joinSession(sessionId, settings, callContainer,
  object : CometChatCalls.CallbackListener<CallSession>() {
    override fun onSuccess(callSession: CallSession) {
      // Hold onto callSession — in-call APIs (mute, video, layout, leave) live on it.
    }
    override fun onError(e: CometChatException) { /* surface */ }
  })
```

```kotlin
// ✗ WRONG — wrong Call class
import com.cometchat.chat.core.Call  // the ONLY Call class (extends BaseMessage)
val c = Call(...)  // compile-time errors on shape; or worse, runtime ambiguity
```

### 1.2 VoIP push is wired, not documented

Standalone-mode integration **must** ship working VoIP push: ConnectionService + FCM high-priority data messages + a registered `PhoneAccount`. Without it, missed calls don't ring → the integration isn't a product.

The full implementation is in `references/voip-calling.md` (~526 lines, the deepest doc in this skill). This skill's standalone-mode scaffold (Section 4) writes:

- A `MyConnectionService` extending `android.telecom.ConnectionService`
- A `PhoneAccountHandle` registered in `Application.onCreate()`
- A high-priority FCM `FirebaseMessagingService` that listens for incoming-call data messages
- `MANAGE_OWN_CALLS` + `BIND_TELECOM_CONNECTION_SERVICE` permissions in `AndroidManifest.xml`
- A `placeIncomingCall` flow that hands off to ConnectionService so the OS rings (lock-screen UI, hardware buttons)

In additive mode, this is opt-in but strongly recommended — without it, the app must be foregrounded for incoming calls to ring, which contradicts user expectations.

### 1.3 Foreground service type — the silent crash

Android 14+ silently terminates ongoing-call foreground services that don't declare a correct `foregroundServiceType`. The Calls SDK ships `CometChatOngoingCallService`, but the integration must register it correctly:

```xml
<!-- AndroidManifest.xml -->
<service
    android:name="com.cometchat.calls.services.CometChatOngoingCallService"
    android:foregroundServiceType="phoneCall|microphone|camera"
    android:exported="false" />
```

**Common failure mode:** copying older sample-app manifests that omit `phoneCall` (the type that allows the OS to keep the service alive in low-memory). On Android 14+, the call dies with `ForegroundServiceStartNotAllowedException` — visible in `adb logcat`, invisible in-app.

Full background-handling guide in `references/background-handling.md`.

### 1.4 Server-minted auth tokens for calls in production

The Calls SDK consumes the same auth token the Chat SDK uses. In dev, an Auth Key is fine. In production:

- Mint a per-user token via the CometChat REST API on your server
- Hand it to the client; client calls `CometChat.login(authToken, callback)` (Chat SDK) — Calls SDK reads the same auth context
- **Never embed Auth Key in `local.properties` for production builds.** The skill's setup writes it for dev and the production-mode flow (handled by `cometchat-android-v5-production`) replaces it with the token-endpoint pattern.

This rule mirrors the chat dispatcher's auth rule — `cometchat-android-v5-core` already enforces it.

### 1.5 Hangup cleanup — the camera light

The most common "looks fine in dev, fails review" bug: camera light stays on after hangup, or microphone keeps recording until the activity is destroyed.

Required teardown when ending a call:

```kotlin
override fun onCallEnded(call: CallSession) {
  // 1. End the Calls SDK session. Canonical v5 teardown is the CallSession
  //    INSTANCE method leaveSession(), guarded by isSessionActive — exactly
  //    what both calls-sdk-android sample apps use and what the v4→v5 migration
  //    guide maps the old static CometChatCalls.endSession() to. Matches this
  //    skill's references/call-session.md.
  val session = CallSession.getInstance()
  if (session.isSessionActive) session.leaveSession()
  callContainer?.removeAllViews()                   // 2. Detach the WebRTC view
  audioManager?.mode = AudioManager.MODE_NORMAL     // 3. Release audio routing
  audioManager?.abandonAudioFocusRequest(focusReq)  // 4. Abandon audio focus
  stopService(Intent(this, MyOngoingCallService::class.java))  // 5. Stop foreground service
  finish()                                          // 6. Pop the call activity
}
```

Skipping any of these strands a system resource. The verification step (Section 9) checks that all six are present in the call-end path.

### 1.6 Permissions with rationale

Standalone-mode integration prompts for **four** permissions, each with a rationale string:

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />        <!-- Android 13+ -->
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />          <!-- VoIP -->
<uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
    tools:ignore="ProtectedPermissions" />                                       <!-- VoIP -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />  <!-- Android 14+ -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />  <!-- Android 14+ -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />      <!-- Android 14+ -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.INTERNET" />
```

The runtime request (`ActivityResultContracts.RequestMultiplePermissions`) must include a denial-rationale dialog — Android lints this.

### 1.7 `IncomingCall` mounted at app root in standalone mode

In standalone mode, the `CometChat.addCallListener(...)` registration must happen in the `Application.onCreate()` (not in the foreground activity), so calls ring even when the app is backgrounded or the foreground activity has been destroyed. The listener routes to the ConnectionService (rule 1.2) which presents the OS-level incoming-call UI.

In additive mode (alongside chat), the listener can live in a `CallsLifecycleObserver` registered with the application's `LifecycleOwner` — the chat integration's `CometChatActivity` may be destroyed across configuration changes, but the observer survives.

---

## 2. Setup (always)

Detailed walkthrough in `references/setup.md`. Summary:

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
  repositories {
    google()
    mavenCentral()
    maven { url = uri("https://dl.cloudsmith.io/public/cometchat/cometchat/maven/") }
  }
}

// app/build.gradle.kts
dependencies {
  implementation("com.cometchat:chat-sdk-android:4.0.+")     // signaling
  implementation("com.cometchat:calls-sdk-android:5.0.+")    // WebRTC session
  // additive mode also has chatuikit-android already on the classpath; do not re-add
}

// gradle.properties
android.useAndroidX=true
android.enableJetifier=true
```

Init in `Application.onCreate()`:

```kotlin
class App : Application() {
  override fun onCreate() {
    super.onCreate()

    // 1. Chat SDK init (signaling — required for ringing)
    val appSettings = AppSettings.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(BuildConfig.COMETCHAT_REGION)
      .build()
    CometChat.init(this, BuildConfig.COMETCHAT_APP_ID, appSettings, /* callback */)

    // 2. Calls SDK init — must come after Chat SDK init.
    //
    // The builder is the NESTED CallAppSettings.CallAppSettingBuilder
    // (note: singular "Setting", not plural). It is NOT a top-level
    // CallAppSettingsBuilder class — earlier drafts of this skill cited
    // that wrong name; verified against calls-sdk-android 5.0.x (ENG-35698).
    val callAppSettings = CallAppSettings.CallAppSettingBuilder()
      .setAppId(BuildConfig.COMETCHAT_APP_ID)
      .setRegion(BuildConfig.COMETCHAT_REGION)
      .build()
    CometChatCalls.init(this, callAppSettings, /* callback */)

    // 3. Standalone mode: register PhoneAccount + global call listener (rules 1.2 + 1.7)
    registerPhoneAccount()
    CometChat.addCallListener(LISTENER_ID, GlobalCallListener)
  }
}
```

---

## 3. Components catalog (Calls SDK only — no UI Kit in standalone)

The Calls SDK ships these primitives. Names are stable across v5.x:

| Class / type | Purpose | Where it lives |
|---|---|---|
| `CometChatCalls` | Top-level facade — init, joinSession, generateToken (session teardown is the instance method `CallSession.leaveSession()`, not a static here) | `com.cometchat.calls.core` |
| `CallAppSettings.CallAppSettingBuilder` | Init-time config (appId, region, host) — **nested** class, singular "Setting" (NOT `CallAppSettingsBuilder`) | `com.cometchat.calls.core` |
| `GenerateToken` | Wrapper returned by `CometChatCalls.generateToken` — extract the JWT via `.token` (NOT a raw `String`) | `com.cometchat.calls.model` |
| `CometChatCalls.SessionSettingsBuilder` | Per-session config (layout, type, hide buttons, audio mode, recording) — **nested class**, access as `CometChatCalls.SessionSettingsBuilder()` |
| `CometChatOngoingCallService` | Foreground service for active calls | `com.cometchat.calls.services` |
| `SessionType` | `VOICE` / `VIDEO` (NOT "AUDIO") | `com.cometchat.calls.model` |
| `LayoutType` | `TILE` / `SIDEBAR` / `SPOTLIGHT` | `com.cometchat.calls.model` |
| `CallLogRequest.CallLogRequestBuilder` | Paginated call history fetcher | `com.cometchat.calls.core` |
| `SessionStatusListener` / `ParticipantEventListener` / `MediaEventsListener` / `ButtonClickListener` / `LayoutListener` | The **five** v5 call-event listeners — register each on the `CallSession` instance (`callSession.addSessionStatusListener(...)` etc.). v5 split the old monolithic `CometChatCallsEventsListener` into these. See `references/event-listeners.md`. | `com.cometchat.calls.listeners` |

In additive mode, `chatuikit-android`'s `CometChatMessageHeader` already exposes call buttons — see `cometchat-android-v5-components` for the kit-side view.

Component-level deep dives: `references/audio-controls.md`, `references/video-controls.md`, `references/participant-management.md`, `references/custom-ui.md`.

---

## 4. Standalone integration (calls is the product)

When `product === "voice-video"` and there is no existing chat integration.

> **Telemetry attribution (`ai-agent`).** Session mode (§4a, Calls SDK only) MUST init via `CometChatCalls.initFromSettings(context, callback)` (`com.cometchat:calls-sdk-android >= 5.0.2`, verified via `javap`) reading `app/src/main/assets/cometchat-settings.json` — it's the only reporter in a calls-only app and fires on `CometChatCalls.login`. **Additive** mode (calls added on top of a v5 chat integration) is attributed by the chat side when chat inits via `CometChatUIKit.initFromSettings` (`cometchat-android-v5-core`); the additive calls step adds a raw `CometChatCalls.init`, which the SDK suppresses in favour of the chat report. **Ringing mode (§4b)** links the raw Chat SDK for signaling — use `CometChatCalls.initFromSettings` there too so the calls side carries the flag.

**Split by calling mode:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

Calls SDK ONLY. NO Chat SDK, NO ConnectionService, NO FCM-for-VoIP. Matches `calls-sdk-android-5/samples/sample-app/`. Scaffold:

1. **`Application` class** — **`CometChatCalls.initFromSettings(context, callback)`** ONLY in `onCreate`, reading the committed `app/src/main/assets/cometchat-settings.json` so the calls-only app self-reports `integrationSource = "ai-agent"` (`calls-sdk-android >= 5.0.2`; on an older SDK the method is absent — fall back to the `CallAppSettings.CallAppSettingBuilder` + `CometChatCalls.init(...)` shown in §2). No `CometChat.init`, no PhoneAccount, no ConnectionService. The report fires on `CometChatCalls.login(uid, authKey, callback)` success, so log the user in via `CometChatCalls.login` in session mode.
2. **`JoinSessionActivity`** — UID picker + Start/Join meeting + state.
3. **`CallActivity`** — Single-call `CometChatCalls.joinSession(sessionId, sessionSettings, container, CallbackListener)`. `SessionStatusListener` + `ButtonClickListener` registered on the `CallSession` from `onSuccess`. `CometChatOngoingCallService.launch/abort`. See `references/call-session.md`.
4. **`AndroidManifest.xml`** — Camera + microphone permissions + `FOREGROUND_SERVICE_MICROPHONE/CAMERA` + `CometChatOngoingCallService` registration. NO ConnectionService.
5. **App Links** — `https://yourapp.com/meet/<sessionId>` deep-link routing.

**Why no ConnectionService / no FCM-VoIP:** session mode never receives an incoming-call FCM payload. No ringing.

### 4b. Standalone — Ringing mode (Chat SDK signaling + ConnectionService + FCM-VoIP)

Dual-SDK + telecom + push. Scaffold:

1. **`Application` class** — Chat SDK + Calls SDK init in onCreate, PhoneAccount registration, global call listener (rules 1.7, 1.2).
2. **`CallButtonView` Kotlin component** — voice + video buttons rendered next to a user profile / contact card. Calls `CometChat.initiateCall(...)` on tap, navigates to `OutgoingCallActivity`.
3. **`OutgoingCallActivity`** — shows the dialing UI; transitions to `OngoingCallActivity` when the receiver accepts (`OutgoingCallStatusListener`).
4. **`OngoingCallActivity`** — hosts the WebRTC view via `CometChatCalls.joinSession(sessionId, settings, container, callback)`, handles all in-call controls (mute/camera/end), implements rule 1.5 teardown.
5. **`CallLogsActivity`** — `/calls` equivalent — paginated history via `CallLogRequest.CallLogRequestBuilder`. Tap a row → re-call.
6. **`MyConnectionService` + `MyFirebaseMessagingService`** — VoIP push end-to-end (rule 1.2). Wired in manifest with the right `foregroundServiceType` (rule 1.3).
7. **Permission rationale dialog** — `ActivityResultContracts.RequestMultiplePermissions` with denial-rationale strings (rule 1.6).

Detailed walkthrough: `references/ringing-integration.md` (dual-SDK setup), `references/voip-calling.md` (push end-to-end), `references/background-handling.md` (foreground service).

---

## 5. Additive integration (calls on top of existing chat)

When the project already has `chatuikit-android` integrated. The skill:

1. **Patches `Application.onCreate()`** — adds `CometChatCalls.init(...)` after the existing `CometChat.init(...)` block. Adds the global call listener.
2. **Patches `AndroidManifest.xml`** — adds the four FOREGROUND_SERVICE permissions (rule 1.6) and the `CometChatOngoingCallService` registration with the correct type (rule 1.3).
3. **Wires `CometChatMessageHeader` call buttons** — the kit's header already shows voice + video icons; the skill registers the listeners so they call `CometChat.initiateCall` (rule 1.1).
4. **Adds an `IncomingCallListener`** scoped to the application LifecycleOwner (rule 1.7) — survives chat-activity recreation.
5. **VoIP push: opt-in.** The skill asks the user before scaffolding ConnectionService — it's a substantial code addition, and additive-mode users may prefer to add it later.
6. **Adds a `CallLogsFragment`** that can be hosted alongside `CometChatConversationsFragment` in the existing tab/activity structure.

Important: do NOT re-add `chat-sdk-android` or `chatuikit-android` to `build.gradle.kts` — they're already there. Only add `calls-sdk-android`.

---

## 6. Anti-patterns

1. **Calling `CometChatCalls.joinSession()` with the wrong `Call` import.** Compile errors are obvious; the dangerous case is inventing a non-existent `com.cometchat.chat.models.Call` import — the only Call class is `com.cometchat.chat.core.Call`. Cross-reference rule 1.1.

2. **Hardcoding `SessionType.AUDIO`.** No such constant exists. The voice path is `SessionType.VOICE`. Listed here because it's the most common cargo-culted mistake — the iOS SDK uses "audio" terminology.

3. **Registering the call listener in the foreground activity.** Survives only as long as the activity does — meaning the app must be open for calls to ring. Rule 1.7 requires Application or a process-scoped LifecycleOwner.

4. **Skipping `android.enableJetifier=true`.** Without it, `androidx.legacy.support` artifacts inside the SDK throw `Duplicate class android.support.v4.*` at build. Rule lives in setup.

5. **Omitting `foregroundServiceType="phoneCall"`.** Silent crash on Android 14+ (rule 1.3). Common when copying older sample-app manifests.

6. **Re-initializing the Calls SDK after every login.** `CometChatCalls.init()` is process-scoped — call it once in Application.onCreate(). Re-init does not "refresh" the auth context; logout-handling lives in rule 1.4's token replay.

7. **Using `addCallListener` without a stable listener ID.** Two listeners with the same ID overwrite. Two listeners with different IDs both fire — easy duplicate-IncomingCall UI bug. Use a documented constant (`const val LISTENER_ID = "global-call-listener"`).

---

## 7. Verification checklist

After scaffolding, verify (the skill writes Espresso-style smoke tests where possible; otherwise prompts the user to confirm):

**Static (the agent checks before claiming done):**

- [ ] `calls-sdk-android` in `app/build.gradle.kts` dependencies
- [ ] Cloudsmith maven URL in `settings.gradle.kts`
- [ ] `android.useAndroidX=true` and `android.enableJetifier=true` in `gradle.properties`
- [ ] `CometChat.init` followed by `CometChatCalls.init` in `Application.onCreate`
- [ ] All four `RECORD_AUDIO` / `CAMERA` / `POST_NOTIFICATIONS` / `MANAGE_OWN_CALLS` permissions in `AndroidManifest.xml`
- [ ] All three `FOREGROUND_SERVICE_*` Android 14+ permissions in `AndroidManifest.xml`
- [ ] `CometChatOngoingCallService` with `foregroundServiceType="phoneCall|microphone|camera"`
- [ ] Call listener registration uses a stable string ID
- [ ] Hangup path includes `CallSession.getInstance().leaveSession()` (guarded by `isSessionActive`) + `removeAllViews()` + audio-focus abandon + service stop + finish (rule 1.5)
- [ ] **Standalone only:** `ConnectionService` subclass + `PhoneAccount` registration + FCM `MessagingService` for incoming-call data messages
- [ ] **Standalone only:** Call listener registered in `Application.onCreate`, not an activity

**Runtime (real device — the skill prompts the user):**

- [ ] Outgoing voice call connects and audio is two-way
- [ ] Outgoing video call connects and video is two-way
- [ ] Incoming call rings on lock screen with the device backgrounded (standalone) or with chat-activity destroyed (additive)
- [ ] Hangup releases the camera light and microphone within 2 seconds
- [ ] Call log entry appears after the call ends
- [ ] Permission rationale dialog appears the second time a permission is requested after denial
- [ ] On Android 14+ device: ongoing-call notification shows, swipe-up doesn't kill the call

---

## 8. Pointers to other skills

- `cometchat-calls` — the dispatcher that loads this skill
- `cometchat-android-v5-core` — Chat SDK init, login, env conventions
- `cometchat-android-v5-components` — `CometChatMessageHeader` call buttons (additive mode)
- `cometchat-android-v5-push` — FCM setup, notification handling (overlap with VoIP push but distinct)
- `cometchat-android-v5-production` — server-minted auth tokens, ProGuard rules for the Calls SDK
- `cometchat-android-v5-troubleshooting` — symptom-to-cause for the common failure modes (Jetifier, foregroundServiceType, MANAGE_OWN_CALLS not granted)
