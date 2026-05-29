---
name: cometchat-android-v6-calls
description: "CometChat Calls v6 integration for native Android (V6 beta — Compose + Kotlin Views). Works end-to-end on chatuikit-compose-android:6.0.0 (validated 2026-05-12 against web peer) — but only with FIVE non-obvious workarounds the kit itself doesn't ship — (1) explicit calls-sdk-android:5.0.+ peer dep, (2) annotations-java5 exclude, (3) stub classes for legacy com.cometchat.calls.{CometChatRTCView, model.RTCUser, model.RTCReceiver, model.RTCCallback} to satisfy chat-sdk's CallManager bytecode, (4) AVOID CometChatCallButtons (broken — captures first-rendered user globally; ignores per-row prop) — instead wire your own button to CometChat.initiateCall then CometChatCallActivity.Companion.launchOutgoingCallScreen(context, call, null), (5) Call constructor arg order CHANGED in chat-sdk 5.x — (receiverUid, receiverType, type) not (receiverUid, type, receiverType). Covers UIKitSettings calling configuration, surface-aware Compose+Views routing, foreground service correctness on Android 14+, ConnectionService + FCM VoIP push."
license: "MIT"
compatibility: "Android Studio Hedgehog+, JDK 17, Gradle 8+, AGP 8+, minSdk 28+ (V6 raised the floor); chatuikit-compose-android:6.0.+ OR chatuikit-kotlin-android:6.0.+ PAIRED with com.cometchat:calls-sdk-android:5.0.+ (peer dep required despite the V6 marketing — see §1.0)"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat android v6 calls voice video webrtc compose kotlin-views uikitsettings calling-configuration foreground-service voip fcm connectionservice beta"
---

## ⚠️ Five required workarounds for chatuikit-compose-android:6.0.0

Validated end-to-end on Pixel 3 (Android 12) ↔ Next.js peer on 2026-05-12. **All five must be applied** — the V6 beta artifacts ship without them and the app crashes on first call attempt without one of them in place.

### W1 — `calls-sdk-android:5.0.+` is a REQUIRED peer dep

The V6 chatuikit advertises bundled calling, but its compose AAR references `com.cometchat.calls.core.CometChatCalls$SessionSettingsBuilder` at bytecode level — that class lives in `calls-sdk-android:5.0.0`, not in the chatuikit AAR. Without this dep, `Application.onCreate` crashes with `ClassNotFoundException`.

```kotlin
implementation("com.cometchat:chatuikit-compose-android:6.0.+")
implementation("com.cometchat:calls-sdk-android:5.0.+")  // REQUIRED
```

### W2 — `annotations-java5` duplicate-class exclude

Build fails with `Duplicate class org.jetbrains.annotations.*` from a transitive legacy dep.

```kotlin
configurations.all {
    exclude(group = "org.jetbrains", module = "annotations-java5")
}
```

### W3 — Stub classes for chat-sdk's legacy CallManager references

chat-sdk-android's `CallManager` bytecode references legacy `com.cometchat.calls.{CometChatRTCView, model.RTCUser, model.RTCReceiver, model.RTCCallback}` (V3-era paths). calls-sdk-android:5.0.0 moved everything to `com.cometchat.calls.core.*` and dropped these. Without stubs in your source tree, the first call attempt fires `E/CallManager: CometChat Calling module not found`.

Create empty stubs at the legacy paths:

```java
// app/src/main/java/com/cometchat/calls/CometChatRTCView.java
package com.cometchat.calls;
public class CometChatRTCView {}

// app/src/main/java/com/cometchat/calls/model/RTCUser.java
package com.cometchat.calls.model;
public class RTCUser {
    public RTCUser(String uid, String name, String avatar) {}
}

// app/src/main/java/com/cometchat/calls/model/RTCReceiver.java
package com.cometchat.calls.model;
public class RTCReceiver {
    public RTCReceiver(String uid, String name, String type) {}
}

// app/src/main/java/com/cometchat/calls/model/RTCCallback.java
package com.cometchat.calls.model;
public interface RTCCallback<T> { void onSuccess(T result); }
```

Class verification finds these locally and lets CallManager load. They're never actually invoked at runtime because the V6 chatuikit uses `com.cometchat.calls.core.CometChatCalls.startSession` (a different code path) for the real call surface.

### W4 — Do NOT use `CometChatCallButtons` — wire your own

The kit's `CometChatCallButtons(user = user)` composable IGNORES the per-row `user` prop and dials whichever user was first rendered (it captures global state on first composition). Symptom: every call regardless of which row you tap rings the same person. Workaround:

```kotlin
@Composable
fun UserRow(user: User) {
    val context = LocalContext.current
    Row(...) {
        Text(user.name ?: user.uid)
        IconButton(onClick = {
            val outgoing = Call(
                user.uid,
                CometChatConstants.RECEIVER_TYPE_USER,   // see W5 — order matters
                CometChatConstants.CALL_TYPE_VIDEO,
            )
            CometChat.initiateCall(outgoing, object : CometChat.CallbackListener<Call>() {
                override fun onSuccess(call: Call) {
                    // Hand off to the kit's outgoing-call screen — this part works correctly
                    CometChatCallActivity.Companion.launchOutgoingCallScreen(context, call, null)
                }
                override fun onError(e: CometChatException) { /* surface */ }
            })
        }) { Text("📹") }
    }
}
```

`CometChatCallActivity.launchOutgoingCallScreen` handles the full lifecycle (ringing UI, token mint, joinSession, transition to in-call surface) correctly — only the button composable is broken.

### W5 — `Call` constructor arg order CHANGED in chat-sdk 5.x

```kotlin
// ❌ v4 style — server returns ERR_BAD_REQUEST: "Failed to validate the data sent with the request"
Call(receiverUid, CALL_TYPE_VIDEO, RECEIVER_TYPE_USER)

// ✅ v5 (what chatuikit-compose:6.0.0 pulls in transitively as chat-sdk-android:5.0.1)
Call(receiverUid, RECEIVER_TYPE_USER, CALL_TYPE_VIDEO)
```

Bytecode-confirmed against chat-sdk-android:5.0.1: `arg1 → receiverUid`, `arg2 → receiverType`, `arg3 → type`.

---

## Purpose

Production-grade voice + video calling for native Android v6 (beta). Loaded by `cometchat-calls` when `android_version === "v6"`. Routes to the **Compose** or **Kotlin Views** sub-flow based on the surface the project uses (already determined by `cometchat-android-v6-core` from the presence of `androidx.compose.ui:ui` / `compose.material3` in the dependency graph).

**⚠️ Important — V6 still needs `calls-sdk-android` on the classpath despite marketing claims.** The V6 chatuikit packages advertise "bundled calling," but at runtime `CometChatUIKit.init` references `com.cometchat.calls.core.CometChatCalls$SessionSettingsBuilder` — a class that lives in `com.cometchat:calls-sdk-android`, NOT in the chatuikit AAR. Without the peer dep, the app crashes on `Application.onCreate` with `ClassNotFoundException`. Always add:

```kotlin
dependencies {
    implementation("com.cometchat:chatuikit-compose-android:6.0.+") // or chatuikit-kotlin-android
    implementation("com.cometchat:calls-sdk-android:5.0.+")          // REQUIRED — not optional
}
```

The `UIKitSettings` builder must still call `.setEnableCalling(true)` to register the calling extension at init time.

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-android-v6-core` — UIKitSettings shape, Compose vs Views detection, init order
- `cometchat-android-v6-builder-settings` — every option on `UIKitSettings` including the calling block
- `cometchat-android-v6-{compose,kotlin}-components` — surface-specific component catalogs

**Ground truth:**
- SDK source — installed `chatuikit-{compose,kotlin}-android@6.0.0-beta2` artifacts under `~/.gradle/caches/`
- V5 sibling skill — `cometchat-android-v5-calls` (different module shape, same hard rules)
- Public docs — https://www.cometchat.com/docs/calls/android/overview (note: V6 docs may still reference V5 module split)

---

## 1. The seven hard rules — Android v6 specialization

The same seven non-negotiables from the dispatcher; v6 changes the *how* but not the *what*.

### 1.0 Calls SDK login is its own step (v5+)

Same as v5 cohort — the v5 Calls SDK has its own auth state, separate from the Chat SDK. After `CometChat.login(uid, AUTH_KEY)` succeeds, you MUST also call `CometChatCalls.login(uid, AUTH_KEY, ...)` — without it, the FIRST calls API call throws **"auth token cannot be null"**.

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

**Surprises (verified on real hardware, Android 12 + 14):**
- `com.cometchat.chat.models.User` does **NOT** expose `authToken` on Android — don't try `user.authToken`. Use the `(uid, apiKey)` overload for dev or fetch the auth token from your backend for production.
- The Calls SDK callback returns `com.cometchat.calls.model.CallUser`, NOT `com.cometchat.chat.models.User`. Importing the wrong type gives "Type mismatch" at compile time.
- The Calls SDK does NOT persist login across launches like the Chat SDK does. Re-login on every cold start where `CometChat.getLoggedInUser()` returns a non-null user.

### 1.1 Dual-SDK contract — same shape, simpler imports

V6 still routes ringing through Chat SDK (`CometChat.initiateCall`) and the WebRTC session through the Calls SDK — but both are accessed via the unified V6 facade. The two-`Call`-classes problem from V5 still exists internally; the V6 components hide it but custom code that imports `com.cometchat.chat.core.Call` directly must still pick the right one.

```kotlin
// ⚠️ DO NOT USE — broken at chatuikit-compose:6.0.0 (see W4 above).
// Captures first-rendered user globally; every row dials the same person.
// CometChatCallButtons(user = user, group = null)

// ✓ RIGHT — wire your own button + use the kit's outgoing-call Activity directly.
// See §"Five required workarounds" W4 for the full pattern.
IconButton(onClick = {
    val call = Call(user.uid, RECEIVER_TYPE_USER, CALL_TYPE_VIDEO)  // see W5 — arg order
    CometChat.initiateCall(call, object : CometChat.CallbackListener<Call>() {
        override fun onSuccess(c: Call) {
            CometChatCallActivity.Companion.launchOutgoingCallScreen(context, c, null)
        }
        override fun onError(e: CometChatException) { /* surface */ }
    })
}) { Text("📹") }
```

### 1.2 VoIP push — same architecture, ConnectionService + FCM

Identical to V5 (rule 1.2 in `cometchat-android-v5-calls`). The V6 UIKit doesn't ship its own ConnectionService — you write one. Reference implementation in `cometchat-android-v5-calls/references/voip-calling.md` works unchanged for V6 (the FCM payload shape and ConnectionService API are platform-level, not SDK-version-specific).

### 1.3 Build prerequisite — annotations-java5 duplicate-class conflict

**⚠️ Mandatory exclude.** A transitive dep of `chatuikit-compose-android:6.0.+` pulls in the legacy `org.jetbrains:annotations-java5:17.0.0`, which conflicts with the modern `org.jetbrains:annotations:23.0.0` brought in by Kotlin 2.0+. AGP fails the build with dozens of `Duplicate class org.jetbrains.annotations.*` lines. Add to `app/build.gradle.kts`:

```kotlin
configurations.all {
    exclude(group = "org.jetbrains", module = "annotations-java5")
}
```

The exclude must be on `configurations.all` (not on a specific configuration) because the legacy artifact leaks into runtime, compile, and androidTest classpaths.

### 1.4 Foreground service type — UIKit-managed in V6

V6 ships its own `CometChatOngoingCallService` registered automatically via the kit's manifest merge. You still must declare the Android 14+ `FOREGROUND_SERVICE_PHONE_CALL` / `FOREGROUND_SERVICE_MICROPHONE` / `FOREGROUND_SERVICE_CAMERA` permissions in your app's manifest — manifest merge does NOT pull permissions across module boundaries.

```xml
<!-- AndroidManifest.xml — required even though the service is kit-provided -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
```

### 1.5 Server-minted auth tokens

Unchanged from V5 / chat dispatcher — see `cometchat-android-v6-production` for the token-endpoint pattern.

### 1.6 Hangup cleanup — V6 components handle it

The V6 `CometChatOngoingCall` composable / Kotlin View handles the camera-light / mic-release cleanup via its own `DisposableEffect` (Compose) or `onDetachedFromWindow` (Views). Custom OngoingCall surfaces (Section 5) must replicate this — the hard rule still applies, just the canonical implementation is in the kit.

### 1.7 Permissions with rationale

Same set as V5, plus V6's `minSdk = 28` floor means `POST_NOTIFICATIONS` runtime prompt (Android 13+) is always required. The V6 kit ships a `CallPermissionsHandler` that runs the standard request flow with rationale strings.

### 1.8 IncomingCall mounted at app root

V6 exposes `CometChatIncomingCall` as a top-level composable / View. In standalone mode, mount it inside `setContent { ... }` at the root of your `MainActivity`, OUTSIDE the navigation graph, so it survives screen transitions.

```kotlin
// MainActivity.kt — Compose, standalone mode
class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      CometChatTheme {
        Box(modifier = Modifier.fillMaxSize()) {
          AppNavigation()                          // Your nav graph (calls or otherwise)
          CometChatIncomingCall(modifier = Modifier.fillMaxSize())  // overlays everything
        }
      }
    }
  }
}
```

In Kotlin Views, the equivalent is a top-level `FrameLayout` in the Activity's layout XML containing both the host `<fragment>` and `<com.cometchat.chatuikit.calling.CometChatIncomingCall>`.

---

## 2. Setup — the V6 difference

V6 has no separate calls module. If `chatuikit-{compose,kotlin}-android` is already in `app/build.gradle.kts` from `cometchat-android-v6-core`, calls are already on the classpath. The skill only:

1. Adds calling configuration to `UIKitSettings`:
   ```kotlin
   val settings = UIKitSettings.Builder()
     .setAppId(BuildConfig.COMETCHAT_APP_ID)
     .setRegion(BuildConfig.COMETCHAT_REGION)
     .setAuthKey(BuildConfig.COMETCHAT_AUTH_KEY)
     .subscribePresenceForAllUsers()
     .enableCalling()                              // ← v6 flips calling on here
     .build()
   ```
2. Ensures the four FOREGROUND_SERVICE permissions and the four call permissions are in `AndroidManifest.xml`.
3. Adds the V6 Kotlin Views theme parent rule from `cometchat-android-v6-troubleshooting`: Activity themes hosting V6 Views must inherit from `CometChatTheme.DayNight` (V6 components extend `MaterialCardView` and reference kit-specific theme attrs that aren't in `Theme.AppCompat.*` or `Theme.MaterialComponents.*`). Compose surfaces are immune.

Detailed V6 init order: `cometchat-android-v6-core`. UIKitSettings option-by-option: `cometchat-android-v6-builder-settings`.

---

## 3. Components — Compose vs Kotlin Views

Both surfaces ship the same five call components with the same parameter names. Surface determines which import you use.

### Compose (`com.cometchat.chatuikit.calling.compose.*`)

| Composable | Purpose |
|---|---|
| `CometChatCallButtons(user, group)` | Voice + video buttons — typically in a top-bar trailing slot or contact card |
| `CometChatIncomingCall(modifier)` | Root-mounted overlay; renders nothing when no call active |
| `CometChatOutgoingCall(call, user, group)` | Pushed when local user initiates; auto-dismisses on accept/reject |
| `CometChatOngoingCall(callSettingsBuilder, sessionId)` | WebRTC view — handles camera/mic/end controls |
| `CometChatCallLogs(onItemClick)` | Paginated history; integrates with Compose Navigation |

### Kotlin Views (`com.cometchat.chatuikit.calling.views.*`)

Same names, different package. Inflate via XML or programmatically:

```xml
<com.cometchat.chatuikit.calling.views.CometChatCallButtons
    android:id="@+id/callButtons"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content" />
```

Then in code: `binding.callButtons.setUser(user)`.

Full component-by-component catalogs live in the existing `cometchat-android-v6-compose-components` and `cometchat-android-v6-kotlin-components` skills — read whichever matches the project's surface.

---

## 4. Standalone integration

When `product === "voice-video"` and there is no V6 chat integration yet.

**Split by calling mode:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

Calls SDK ONLY. NO chatuikit-android, NO ConnectionService, NO FCM-for-VoIP. Same SDK as V5 (`com.cometchat.calls-sdk-android`). Scaffold:

1. **`Application` class** — `CometChatCalls.init(...)` ONLY. No chatuikit, no Chat SDK init.
2. **`MainActivity` (Compose)** — `setContent` with `NavHost` for `/`, `/meet/{sessionId}`.
3. **`CallRoom` composable** — `AndroidView` factory wrapping `RelativeLayout` (remember-stable), `LaunchedEffect(sessionId)` fires `CometChatCalls.joinSession(sessionId, settings, container, CallbackListener)`, `DisposableEffect` cleanup. See `references/call-session.md`.
4. **`AndroidManifest.xml`** — Camera + microphone permissions + `FOREGROUND_SERVICE_MICROPHONE/CAMERA` + `CometChatOngoingCallService` registration. NO ConnectionService.
5. **App Links** — `https://yourapp.com/meet/<sessionId>` deep-link routing.

**Why no chatuikit / no ConnectionService:** session mode never touches kit components or push. The W1–W5 V6 workarounds (which are for chatuikit's broken integration with the Calls SDK) DO NOT apply to standalone session-only — they're only relevant when the V6 kit is loaded.

### 4b. Standalone — Ringing mode (kit-driven with W1–W5 workarounds)

Dual-SDK + telecom + push + V6 chatuikit:

- **Compose path:** A `MainActivity` with `setContent` that holds: nav graph (with `/profile`, `/calls`, `/ongoing-call/{sessionId}` routes), `CometChatIncomingCall` overlay (rule 1.7), top-level theme with `CometChatTheme`. Profile screen has `CometChatCallButtons` next to the user's name.
- **Kotlin Views path:** `MainActivity` extending `AppCompatActivity` with theme `CometChatTheme.DayNight`, a `FragmentContainerView` for nav + a sibling `CometChatIncomingCall` view in the same `FrameLayout`. Profile fragment hosts `CometChatCallButtons`.
- VoIP push: ConnectionService + FCM (rule 1.2 — implementation copied from V5 references/voip-calling.md, unchanged on V6).
- Manifest permissions, foreground service permissions, ProGuard rules (`-keep class com.cometchat.** { *; }`).
- **W1–W5 workarounds apply** (see "Five required workarounds" above).

## 5. Additive integration

When chat is already integrated via V6. The skill:

- Adds `.enableCalling()` to the existing `UIKitSettings.Builder()` chain.
- Adds the four `FOREGROUND_SERVICE_*` permissions to manifest.
- Mounts `CometChatIncomingCall` at the root of the existing Activity (Compose: in `setContent`; Views: in the root layout XML).
- Wires call buttons inline — `CometChatMessageHeader` (V6) already renders them; the kit calls `initiateCall` automatically when calling is enabled.
- VoIP push: opt-in (asks user).

## 6. Anti-patterns

1. **Treating V6 calls as a separate module.** No `com.cometchat:calls-sdk-android` dependency on V6 — adding it pulls a V5 module that conflicts at runtime. The setup is just `.enableCalling()`.
2. **Mounting `CometChatIncomingCall` inside the navigation graph.** Disappears on navigation events. Mount at root (rule 1.7).
3. **Activity theme not inheriting `CometChatTheme.DayNight` for V6 Kotlin Views.** Calls components extend `MaterialCardView` and crash with `Failed to resolve attribute at index N` if hosted in `Theme.AppCompat.*`. Compose surfaces are not affected. Already documented in `cometchat-android-v6-troubleshooting`; surfaced here because calls components are the canary that exposes the bug.
4. **Skipping the four `FOREGROUND_SERVICE_*` permissions** because the kit "already" registers the service. Manifest merge does not pull permissions — your app must declare them.
5. **Mixing V5 and V6 call types.** The V5 `SessionType.VOICE` and the V6 `CallType.AUDIO` are not interchangeable enums. If you import from `com.cometchat.calls.types.SessionType`, you're pulling V5; V6 uses `CallType` from the unified UIKit package.

## 7. Verification checklist

- [ ] `chatuikit-compose-android` OR `chatuikit-kotlin-android` (NOT both) in `app/build.gradle.kts` — V6 picks one surface
- [ ] `.enableCalling()` on `UIKitSettings.Builder()`
- [ ] Activity theme is `CometChatTheme.DayNight` (Kotlin Views only)
- [ ] All four `FOREGROUND_SERVICE_*` permissions in `AndroidManifest.xml`
- [ ] All four call permissions (RECORD_AUDIO / CAMERA / POST_NOTIFICATIONS / MANAGE_OWN_CALLS)
- [ ] `CometChatIncomingCall` mounted at root (Compose: outside nav graph; Views: top-level FrameLayout)
- [ ] **Standalone only:** ConnectionService + FCM service registered
- [ ] **Standalone only:** PhoneAccount registered in `Application.onCreate`
- [ ] Real device: outgoing call → audio + video two-way
- [ ] Real device: incoming call rings on lock screen
- [ ] Hangup releases camera + mic within 2 seconds
- [ ] On Android 14+: ongoing-call notification visible, swipe-up doesn't kill the call

## 8. Pointers

- `cometchat-android-v5-calls/references/` — VoIP push, foreground service, ConnectionService, FCM payload shape — all unchanged on V6
- `cometchat-android-v6-builder-settings` — every UIKitSettings option including calling block details
- `cometchat-android-v6-{compose,kotlin}-components` — full surface-specific component catalogs
- `cometchat-android-v6-production` — token endpoints, ProGuard rules
- `cometchat-android-v6-troubleshooting` — V6 Kotlin Views theme parent crash diagnostic
