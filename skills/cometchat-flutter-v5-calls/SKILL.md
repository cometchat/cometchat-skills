---
name: cometchat-flutter-v5-calls
description: CometChat Calls integration for Flutter UIKit v5 (GetX-based chat kit) on the v5 Calls SDK (cometchat_calls_sdk ^5.0.2, added as a DIRECT dependency — raw SDK + custom call surface). Covers the 5.x lifecycle (CometChatCalls.init/login/loginWithAuthToken/generateToken/joinSession/getLoggedInUser), the CallSession.getInstance() in-call controls (mute/pauseVideo/switchCamera/raiseHand/setLayout/setAudioModeType/recording/leaveSession), SessionSettingsBuilder, the 5 split listeners (SessionStatus/ParticipantEvent/MediaEvent/ButtonClick/Layout), Android FCM + ConnectionService for VoIP push, iOS CallKit + PushKit, foreground service correctness on Android 14+, hangup cleanup, and additive-vs-standalone modes. The 4.x-bound cometchat_calls_uikit prebuilt call widgets are documented only as a legacy alternative incompatible with the 5.x calls SDK.
license: "MIT"
compatibility: "Flutter >= 2.5, Dart >= 2.17; cometchat_chat_uikit ^5.2.14; cometchat_calls_sdk ^5.0.2 (DIRECT dependency — raw SDK, custom call surface); cometchat_sdk ^4.1.2. NOTE: cometchat_calls_uikit ^5.0.16 transitively pins cometchat_calls_sdk ^4.2.2 and its prebuilt call widgets are 4.x-bound — do NOT use them with the 5.x calls SDK."
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat flutter v5 calls voice video webrtc getx incoming outgoing ongoing call-logs callkit pushkit connectionservice fcm voip-push foreground-service navigatorkey calling-extension"
---

## Purpose

Production-grade voice + video calling for Flutter UIKit v5 (GetX-based chat kit) on the **v5 Calls SDK** (`cometchat_calls_sdk ^5.0.2`, added as a **direct** dependency). Loaded by `cometchat-calls` when `framework === "flutter"` and `flutter_version === "v5"`. Operates in two modes:

- **Standalone** — calls is the product. `cometchat_chat_sdk` (signaling) + `cometchat_calls_sdk ^5.0.2` (WebRTC) without the `cometchat_chat_uikit` UI Kit. Custom call screens. **VoIP push is mandatory** — same rule as native iOS / Android.
- **Additive** — calls layered onto an existing v5 chat integration. Keep the existing GetX chat UI Kit (`cometchat_chat_uikit`), add the **raw `cometchat_calls_sdk ^5.0.2`** directly, and build a **custom call surface** around it. Mount the global incoming-call listener at the app shell.

> **DEPENDENCY CONTEXT — why raw SDK, not the calls UI Kit (read first).** The V5 Flutter calls UI Kit `cometchat_calls_uikit` (latest **5.0.16**) transitively pins `cometchat_calls_sdk ^4.2.2`, and its prebuilt call widgets (`CometChatCallButtons` / `CometChatIncomingCall` / `CometChatOutgoingCall` / `CometChatOngoingCall`) are **compiled against the 4.x API**. To run the **5.x** calls SDK (`cometchat_calls_sdk ^5.0.2`) on the Flutter V5 (GetX) chat UI Kit — per the product decision that all families use the V5 calls SDK — you integrate the **raw `cometchat_calls_sdk ^5.0.2`** directly with a **custom call surface**. You do **NOT** use `cometchat_calls_uikit`'s prebuilt call widgets — they require the 4.x SDK and will clash with the 5.x pin. Wherever this skill mentions those widgets, they are a **legacy 4.x-kit alternative, incompatible with the 5.x calls SDK**. Substrate of record (Dart 5.x): `~/.pub-cache/hosted/pub.dev/cometchat_calls_sdk-5.0.2/lib/`.

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-flutter-v5-core` — UIKitSettingsBuilder, init/login order, GetX scope rules, app entry conventions
- `cometchat-flutter-v5-events` — CometChatMessageEvents / CometChatCallEvents subscription patterns

**Ground truth:**
- Calls SDK substrate — `~/.pub-cache/hosted/pub.dev/cometchat_calls_sdk-5.0.2/lib/` (lifecycle: `src/plugin/cometchatcalls.dart`; in-call controls: `src/call_session.dart`; the 5 split listeners: `src/listener/*`; settings: `src/builder/session_settings.dart`)
- Public docs — https://www.cometchat.com/docs/calls/flutter/overview

---

## 1. The seven hard rules — Flutter v5 specialization (5.x Calls SDK)

> **THIS SKILL TARGETS THE 5.x CALLS SDK (read this first).** Add `cometchat_calls_sdk ^5.0.2` as a **direct** dependency. The 5.x SDK splits its surface: **lifecycle is static on `CometChatCalls`** (`init`/`login`/`loginWithAuthToken`/`logout`/`generateToken`/`generateCallToken`/`joinSession`/`getLoggedInUser`) while **in-call controls are instance methods on the `CallSession` singleton** fetched via `CallSession.getInstance()`. Settings use `SessionSettingsBuilder` (NOT `CallSettingsBuilder` — `@Deprecated` in 5.0.2, `src/builder/call_settings.dart:209`). Events arrive through the **5 split listeners** (NOT the single `CometChatCallsEventsListener` — `@Deprecated`, `src/listener/cometchat_calls_events_listener.dart:16`). Do **not** pull calls transitively via `cometchat_calls_uikit` — that brings the 4.x SDK (see the dependency-context note above).

### 1.0 The 5.x Calls SDK has its OWN login

Unlike 4.x, the 5.x Calls SDK is logged in explicitly and caches the auth token internally — `generateCallToken`/`joinSession` then need no per-call token argument. The lifecycle (all static on `CometChatCalls`, `src/plugin/cometchatcalls.dart`):

- `init(CallAppSettings, {onSuccess, onError})` — `:172`
- `login({uid:, authKey:, onSuccess:, onError:})` — `:224`
- `loginWithAuthToken({authToken:, onSuccess:, onError:})` — `:316` (production path)
- `logout({onSuccess:, onError:})` — `:409`
- `generateToken(sessionId, userAuthToken, {onSuccess, onError})` — `:449` (**@Deprecated** v4-compat shim; prefer `generateCallToken`)
- `generateCallToken(sessionId, {onSuccess, onError})` — `:565` (uses the cached auth token)
- `joinSession({sessionId: OR callToken:, sessionSettings:, onSuccess:, onError:})` — `:735`
- `getLoggedInUser()` — `:698`

```dart
import 'package:cometchat_sdk/cometchat_sdk.dart';
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

// 1. Chat SDK login (signaling).
CometChat.login(uid, AUTH_KEY,
  onSuccess: (User user) async {
    // 2. Calls SDK login (5.x has its own). Borrow the Chat auth token.
    // getAuthToken() is NOT a User method — use the static CometChat.getUserAuthToken().
    final authToken = await CometChat.getUserAuthToken();
    if (authToken != null) {
      CometChatCalls.loginWithAuthToken(    // :316
        authToken: authToken,
        onSuccess: (cu) { /* Calls SDK ready */ },
        onError: (CometChatCallsException e) { debugPrint(e.message ?? ''); },
      );
    }
  },
  onError: (CometChatException e) { /* chat login failed */ },
);
```

You can also `CometChatCalls.login(uid: uid, authKey: AUTH_KEY, ...)` (`:224`) directly with the app's auth key in dev. In production use `loginWithAuthToken` with a server-minted token (rule 1.4).

**Surprises:**
- `CometChatCalls.init(...)` (`:172`) takes a `CallAppSettings` (built via `CallAppSettingBuilder`, `src/builder/call_app_settings_request.dart:36`) — `appId` + `region`, no `authKey` field.
- After login, `CometChatCalls.getLoggedInUser()` (`:698`) returns the calls user; `generateCallToken` (`:565`) and `joinSession` (`:735`) use the **cached** auth token — no per-call token arg.

### 1.1 Dual-SDK contract — Chat SDK signals, Calls SDK (5.x) does WebRTC

Both modes integrate the **raw 5.x calls SDK** directly (no calling-extension widget — that's a 4.x-kit construct). Chat SDK initiates ringing; the 5.x Calls SDK joins the WebRTC session via `joinSession`:

```dart
// ✓ RIGHT — raw 5.x dual-SDK (additive AND standalone)
import 'package:cometchat_chat_sdk/cometchat_chat_sdk.dart';
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

// Chat SDK — initiate ringing
// Chat SDK Call — NAMED constructor; `type`/`receiverType` are Strings (the constants resolve to strings).
final outgoing = Call(
  receiverUid: receiverUid,
  type: CometChatCallType.video,            // 'video'
  receiverType: CometChatReceiverType.user, // 'user'
);

final settings = (SessionSettingsBuilder()
      ..setTitle('CometChat Call')          // src/builder/session_settings.dart:155
      ..startAudioMuted(false)              // :173
      ..startVideoPaused(false))            // :167
    .build();

// initiateCall is VOID + callback-based — the Call (with sessionId) arrives in onSuccess,
// NOT via `await`/a return value. Join the WebRTC session inside that callback.
CometChat.initiateCall(
  outgoing,                                 // POSITIONAL Call arg
  onSuccess: (Call initiated) {
    CometChatCalls.joinSession(
      sessionId: initiated.sessionId,       // SDK mints the call token internally
      sessionSettings: settings,
      onSuccess: (Widget? widget) {
        // render widget via SizedBox.expand; register split listeners on
        // CallSession.getInstance() (rule 1.0 / references/call-session.md)
      },
      onError: (CometChatCallsException err) {
        debugPrint('joinSession failed: ${err.message}');
      },
    );
  },
  onError: (CometChatException e) { debugPrint('initiateCall failed: ${e.message}'); },
);
```

> **Legacy 4.x-kit alternative (incompatible with the 5.x calls SDK).** The old `cometchat_calls_uikit` path registered a `CometChatCallingExtension` on `UIKitSettingsBuilder` and used `CometChatUIKitCalls.startSession` + the prebuilt `CometChatCallButtons`/`CometChatIncomingCall`/`CometChatOutgoingCall`/`CometChatOngoingCall` widgets. Those widgets are **compiled against the 4.x calls SDK** — they cannot run against `cometchat_calls_sdk ^5.0.2`. Do not mix them in.

### 1.2 VoIP push — `flutter_callkit_incoming` + `firebase_messaging` + platform-channel bridges

Standalone mode requires working VoIP push end-to-end. The Flutter stack:

- **`flutter_callkit_incoming`** — bridges CallKit (iOS) and a custom heads-up notification (Android). Single Dart API for "ring this device".
- **`firebase_messaging`** — FCM data messages on Android (priority `high`, `data` payload — NOT `notification`).
- **iOS PushKit** — Flutter doesn't have a first-party PushKit plugin; the skill ships a tiny platform-channel bridge in `ios/Runner/AppDelegate.swift` registering `PKPushRegistry.voIP` and forwarding payloads through a `MethodChannel` to Dart.
- **Server side** — same split as native: PushKit (VoIP cert) for iOS, FCM data-message for Android.

In additive mode, this is opt-in but recommended.

### 1.3 Foreground service — Android 14+ rules apply unchanged

**⚠️ Android build prerequisite — Jetifier.** If your build pulls in any legacy `com.android.support:*` AAR transitively, AGP fails `assembleDebug` with dozens of `Duplicate class android.support.v4.*` errors against `androidx.core`. Set in `android/gradle.properties`:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

The 5.x calls SDK ships `CometChatOngoingCallService` (`src/services/ongoing_call_service.dart`) — call `CometChatOngoingCallService.launch()` after the session starts and `.abort()` on teardown (both `static Future<void>`, no-arg). The host app's `android/app/src/main/AndroidManifest.xml` must declare the four FOREGROUND_SERVICE permissions plus MANAGE_OWN_CALLS / BIND_TELECOM_CONNECTION_SERVICE — the same rule as native Android (cf. `cometchat-android-v5-calls` rule 1.3).

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
<uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
    tools:ignore="ProtectedPermissions" />
```

Silent crash on Android 14+ if `FOREGROUND_SERVICE_PHONE_CALL` is missing. The `tools` namespace must be declared on the `<manifest>` element.

### 1.4 Server-minted auth tokens

`cometchat-flutter-v5-production` covers the token-endpoint pattern. In production, log BOTH SDKs in with a server-minted auth token, not the app auth key: `CometChat.loginWithAuthToken(token)` (Chat SDK) then `CometChatCalls.loginWithAuthToken(authToken: token, onSuccess:, onError:)` (Calls SDK, `:316`). The 5.x calls SDK caches that token internally — `generateCallToken` (`:565`) / `joinSession` (`:735`) then need no per-call token.

### 1.5 Hangup cleanup — Dart + native + system call UI

```dart
Future<void> endCall(String sessionId) async {
  // 1. Leave the Calls SDK session — releases WebRTC tracks.
  // In 5.x the canonical teardown is the CallSession INSTANCE method
  // leaveSession() (call_session.dart:272). The static CometChatCalls.endSession
  // still exists (cometchatcalls.dart:676) but is @Deprecated — it just
  // delegates to CallSession.getInstance()?.leaveSession() internally.
  await CallSession.getInstance()?.leaveSession();
  await CometChatOngoingCallService.abort();

  // 2. Tell the OS-level call UI the call ended
  await FlutterCallkitIncoming.endAllCalls();

  // 3. Pop the call screen
  if (mounted) {
    Navigator.of(context, rootNavigator: true).popUntil((r) => r.isFirst);
  }

  // 4. After logout flows: reset ServiceLocator if it was used directly
  // (UIKit handles this for additive mode)
}
```

Skipping `FlutterCallkitIncoming.endAllCalls` leaves the lock-screen/heads-up call UI stuck. Skipping the `Navigator.popUntil` strands the Dart-side call screen with WebRTC views still in the tree.

### 1.6 Permissions — `permission_handler` + Info.plist + AndroidManifest

```dart
import 'package:permission_handler/permission_handler.dart';

await [Permission.camera, Permission.microphone, Permission.notification].request();
```

iOS — `ios/Runner/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>So you can be seen during video calls.</string>
<key>NSMicrophoneUsageDescription</key>
<string>So you can talk during voice and video calls.</string>
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
  <string>remote-notification</string>
</array>
```

Android — manifest as above (rule 1.3) plus runtime requests via `permission_handler`.

### 1.7 IncomingCall mounted at app root + a global navigator key

With the raw 5.x SDK + custom call surface, use a plain `GlobalKey<NavigatorState>` on `MaterialApp.navigatorKey` so call overlays can navigate even when a call is initiated from a sub-route. (Do NOT use `CallNavigationContext.navigatorKey` — that is a `cometchat_calls_uikit` (4.x-kit) symbol and is not available on the raw 5.x SDK path.)

```dart
// ✓ RIGHT
final navigatorKey = GlobalKey<NavigatorState>();

MaterialApp(
  navigatorKey: navigatorKey,
  // ...
);
```

Incoming calls are signaled by the **Chat SDK** `CallListener` — register it app-wide in the app shell's State, not in a feature screen:

```dart
class AppShellState extends State<AppShell> with CallListener {
  static const _listenerId = 'app-shell-call-listener';

  @override
  void initState() {
    super.initState();
    CometChat.addCallListener(_listenerId, this);
  }

  @override
  void dispose() {
    CometChat.removeCallListener(_listenerId);
    super.dispose();
  }

  @override
  void onIncomingCallReceived(Call call) {
    // Show your custom incoming-call UI / flutter_callkit_incoming, then on
    // accept: CometChat.acceptCall(call.sessionId) → CometChatCalls.joinSession(...)
  }
}
```

Use a stable string ID for the listener — duplicate IDs overwrite, distinct IDs fire both (double-ring bug).

---

## 2. Setup

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  cometchat_chat_uikit: ^5.2.14         # additive mode — existing GetX chat kit (keep)
  cometchat_calls_sdk: ^5.0.4           # DIRECT dependency — 5.x calls SDK (raw); >=5.0.4 ships initFromSettings
  permission_handler: ^11.0.0           # rule 1.6
  flutter_callkit_incoming: ^2.0.0      # standalone — VoIP UI bridge
  firebase_messaging: ^14.0.0           # standalone — Android FCM
  firebase_core: ^2.0.0                 # firebase_messaging peer
```

> **Do NOT add `cometchat_calls_uikit`.** Its latest (5.0.16) transitively pins `cometchat_calls_sdk ^4.2.2` and clashes with the 5.x SDK above. The raw `cometchat_calls_sdk ^5.0.2` is the calls dependency; build a custom call surface around it (Section 3). See the dependency-context note at the top.

Hosted source if pub.dev resolution lags:

```yaml
  cometchat_calls_sdk:
    hosted: https://dart.cloudsmith.io/cometchat/cometchat/
    version: ^5.0.2
```

Init order — init both SDKs, then log both in (rule 1.0):

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';  // additive chat kit
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

// Chat UI Kit init (additive — existing GetX chat integration)
final settings = (UIKitSettingsBuilder()
      ..appId = CometChatConfig.appId
      ..region = CometChatConfig.region
      ..authKey = CometChatConfig.authKey
      ..subscriptionType = CometChatSubscriptionType.allUsers)
    .build();
await CometChatUIKit.init(uiKitSettings: settings);

// 5.x Calls SDK init (raw) — CallAppSettingBuilder, no authKey field
final callAppSettings = (CallAppSettingBuilder()
      ..appId = CometChatConfig.appId
      ..region = CometChatConfig.region)
    .build();

CometChatCalls.init(                       // cometchatcalls.dart:172
  callAppSettings,
  onSuccess: (String success) { /* Calls SDK ready */ },
  onError: (CometChatCallsException e) { /* surface to user */ },
);
// After login, also CometChatCalls.loginWithAuthToken(...) — rule 1.0.
```

Standalone mode is identical except you use the raw `cometchat_chat_sdk` (`CometChat.init`) instead of the chat UI Kit for signaling.

---

## 3. The raw 5.x calls surface (custom UI)

Import the raw SDK barrel — it re-exports the lifecycle class, `CallSession`, `SessionSettingsBuilder`, the 5 listeners, the enums, and `CometChatOngoingCallService`:

```dart
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';
```

You build the call surface yourself (custom widgets) around these APIs. There are no prebuilt 5.x call widgets in this package — `joinSession` hands back a `Widget?` you render via `SizedBox.expand`, and you wrap it with your own controls bound to the `CallSession` singleton.

**Lifecycle — static on `CometChatCalls`** (`src/plugin/cometchatcalls.dart`):

| Method | Line | Purpose |
|---|---|---|
| `init(CallAppSettings, {onSuccess, onError})` | `:172` | Initialize the SDK (appId + region) |
| `login({uid:, authKey:, onSuccess:, onError:})` | `:224` | Dev login with app auth key |
| `loginWithAuthToken({authToken:, onSuccess:, onError:})` | `:316` | Production login (server-minted token) |
| `logout({onSuccess:, onError:})` | `:409` | Log out, clear cached token |
| `generateCallToken(sessionId, {onSuccess, onError})` | `:565` | Mint a `CallToken` using the cached auth token |
| `generateToken(sessionId, userAuthToken, {...})` | `:449` | **@Deprecated** v4-compat shim (explicit token) |
| `joinSession({sessionId: OR callToken:, sessionSettings:, onSuccess:, onError:})` | `:735` | Join WebRTC; `onSuccess` → `Widget?` |
| `getLoggedInUser()` | `:698` | The logged-in calls user |
| `endSession({onSuccess:, onError:})` | `:676` | **@Deprecated** — delegates to `CallSession.getInstance()?.leaveSession()` |

**In-call controls — instance on `CallSession.getInstance()`** (`src/call_session.dart`):

| Method | Line | Purpose |
|---|---|---|
| `muteAudio()` / `unMuteAudio()` | `:131` / `:145` | Local audio mute (no-arg) |
| `pauseVideo()` / `resumeVideo()` | `:168` / `:182` | Local video pause (no-arg) |
| `switchCamera()` | `:205` | Flip front/back camera |
| `raiseHand()` / `lowerHand()` | `:292` / `:306` | Hand raise |
| `setLayout(LayoutType)` | `:394` | `tile` / `sidebar` / `spotlight` |
| `setAudioModeType(AudioMode)` | `:381` | `speaker` / `earpiece` / `bluetooth` |
| `startRecording()` / `stopRecording()` | `:451` / `:465` | Recording |
| `enablePictureInPictureLayout()` / `disablePictureInPictureLayout()` | `:223` / `:236` | PiP layout toggle |
| `enterPipMode()` / `isPipSupported()` | `:250` / `:263` | OS-level PiP (Future&lt;bool&gt;) |
| `openVirtualBackgroundSettingsPanel()` | `:438` | Virtual Background — the raw 5.0.2 SDK DOES support VB (unlike the 4.x calls-uikit) |
| `muteParticipant(String)` / `pauseParticipantVideo(String)` | `:329` / `:342` | Moderator: mute/pause a remote participant |
| `pinParticipant(String?)` / `unPinParticipant()` | `:355` / `:368` | Pin/unpin a participant (Flutter: single nullable arg + `unPinParticipant` capital P — differs from Android) |
| `setChatButtonUnreadCount(int)` | `:489` | In-call chat badge |
| `leaveSession()` | `:272` | End session, release tracks |

**Settings:** `SessionSettingsBuilder` (`src/builder/session_settings.dart`) — `setTitle` (`:155`), `startAudioMuted(bool)` (`:173`), `startVideoPaused(bool)` (`:167`), `setLayout(LayoutType)` (`:179`), `setIdleTimeoutPeriod(int seconds)` (`:185`), `setAudioMode(AudioMode)` (`:191`), and the `hide*Button(bool)` family (`:215`–`:305`). **NOT `CallSettingsBuilder`** (`@Deprecated`, `src/builder/call_settings.dart:209`).

**Listeners — register on `CallSession.getInstance()`:** the 5 split interfaces in `src/listener/`: `SessionStatusListeners`, `ParticipantEventListeners`, `MediaEventListeners`, `ButtonClickListeners`, `LayoutListeners`. **NOT the single `CometChatCallsEventsListener`** (`@Deprecated`, `src/listener/cometchat_calls_events_listener.dart:16`). See `references/call-session.md`.

> **Legacy 4.x-kit alternative (incompatible with the 5.x calls SDK).** `cometchat_calls_uikit` ships prebuilt `CometChatCallButtons` / `CometChatIncomingCall` / `CometChatOutgoingCall` / `CometChatOngoingCall` / `CometChatCallLogs` widgets and a `CometChatUIKitCalls` facade — but those are compiled against the **4.x** calls SDK (`cometchat_calls_sdk ^4.2.2`). They cannot be used with `cometchat_calls_sdk ^5.0.2`. Replicate their behavior with your own widgets bound to the raw 5.x API above. For call-log history, fetch via `CometChatCalls.getCallDetails(sessionId, ...)` or the Chat SDK `CallLogRequestBuilder` and render your own list.

---

## 4. Standalone integration

When `product === "voice-video"` and there is no v5 chat integration.

> **Telemetry attribution (`ai-agent`).** Session mode (§4a) MUST init the calls SDK via `CometChatCalls.initFromSettings(onSuccess:, onError:)` (`cometchat_calls_sdk >= 5.0.4`, verified against `lib/src/plugin/cometchatcalls.dart`) reading the `cometchat-settings.json` asset — it persists the `ai-agent` source and the report fires on `CometChatCalls.loginWithAuthToken`/`login`. **Additive** mode (raw calls SDK added to a v5 chat integration) is attributed by the chat side when chat inits via `CometChatUIKit.initFromSettings` (`cometchat-flutter-v5-core`). Pin `cometchat_calls_sdk: ^5.0.4` — the floor that ships `initFromSettings`.

**Split by calling mode:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

5.x Calls SDK ONLY. The Chat SDK is present only as the source of the auth token used to log the Calls SDK in (rule 1.0). Scaffold:

1. **`pubspec.yaml`** — `cometchat_calls_sdk: ^5.0.4` (the floor that ships `initFromSettings`) + `cometchat_chat_sdk` (for the auth token). No `cometchat_chat_uikit`, no `cometchat_calls_uikit`. Declare `cometchat-settings.json` under `flutter: assets:`.
2. **`lib/main.dart`** — `CometChat.init(...)` + `CometChat.login(...)` (Chat SDK only mints the auth token), then **`CometChatCalls.initFromSettings(onSuccess:, onError:)`** reading the committed `cometchat-settings.json` asset so the calls app self-reports `integrationSource = "ai-agent"` (on `<= 5.0.3` the method is absent — fall back to `CometChatCalls.init(callAppSettings, onSuccess:, onError:)` built via `CallAppSettingBuilder()..appId=…..region=…`) + `CometChatCalls.loginWithAuthToken(authToken: ..., ...)` (the login that fires the report) + `permission_handler` flow.
3. **`lib/screens/call_screen.dart`** — `StatefulWidget` implementing the relevant 5.x split listeners (`SessionStatusListeners`, etc.). `CometChatCalls.joinSession(sessionId: ..., sessionSettings: SessionSettingsBuilder().build(), onSuccess:, onError:)`. Register listeners on `CallSession.getInstance()` in `onSuccess`. `CometChatOngoingCallService.launch/abort`. See `references/call-session.md`.
4. **Native config** — Camera + microphone permissions only (no PushKit, no FCM for VoIP).

**Why no chat UI Kit / no VoIP push:** session mode never touches a Chat SDK call entity. No ringing. The Chat SDK is present only to mint the auth token for `CometChatCalls.loginWithAuthToken`.

### 4b. Standalone — Ringing mode (CallKit + FCM + custom UI)

Dual-SDK: Chat SDK signaling + 5.x Calls SDK media. Scaffold:

1. **`lib/main.dart`** — Chat SDK + 5.x Calls SDK init + dual login (rule 1.0). Permission_handler request flow. PushKit + FCM listener registration.
2. **`lib/services/voip_service.dart`** — Combines `flutter_callkit_incoming` events + `firebase_messaging` + iOS platform-channel PushKit. On payload → `FlutterCallkitIncoming.showCallkitIncoming(...)`. On accept → `CometChat.acceptCall(sessionId)` → navigate to ongoing-call screen.
3. **`lib/widgets/call_button.dart`** — Custom voice + video icon buttons → `CometChat.initiateCall(...)`.
4. **`lib/screens/ongoing_call_screen.dart`** — `CometChatCalls.joinSession(sessionId: ..., sessionSettings: ..., onSuccess:, onError:)` with the returned `Widget?` rendered via `SizedBox.expand`. Implements rule 1.5 cleanup (`CallSession.getInstance()?.leaveSession()`). Sets `resizeToAvoidBottomInset: false`.
5. **`lib/screens/call_logs_screen.dart`** — `/calls` route. Custom list via Chat SDK `CallLogRequestBuilder` (or `CometChatCalls.getCallDetails`).
6. **`MaterialApp.navigatorKey: navigatorKey`** — a plain `GlobalKey<NavigatorState>` (rule 1.7).
7. **Native config** — `Info.plist` (rule 1.6), `AndroidManifest.xml` (rule 1.3 + FCM service registration), Firebase config (`google-services.json` in `android/app/`, `GoogleService-Info.plist` in `ios/Runner/`).

## 5. Additive integration

When chat is already integrated (existing GetX `cometchat_chat_uikit`). The skill:

1. Adds **`cometchat_calls_sdk: ^5.0.4`** (raw, direct) to `pubspec.yaml` — NOT `cometchat_calls_uikit`.
2. Inits + logs in the 5.x Calls SDK alongside the existing chat init/login (rules 1.0, 1.1).
3. Sets a plain `GlobalKey<NavigatorState>` on `MaterialApp.navigatorKey` (rule 1.7).
4. Mounts the global Chat SDK `CallListener` in the app-shell `State` (rule 1.7).
5. Adds a **custom** call button (e.g. into `CometChatMessageHeader`'s trailing slot) → `CometChat.initiateCall(...)`.
6. Builds a custom ongoing-call screen around `CometChatCalls.joinSession` + `CallSession` controls (Section 3, `references/call-session.md`).
7. VoIP push: opt-in (substantial native config).

## 6. Anti-patterns

1. **`MaterialApp` without a global `navigatorKey`.** Call overlays can't navigate; in-app ring works but accept-into-ongoing breaks. Rule 1.7.
2. **Adding `cometchat_calls_uikit` to get calls.** It pins `cometchat_calls_sdk ^4.2.2` and clashes with the 5.x SDK; its prebuilt call widgets are 4.x-bound. Use the raw 5.x SDK + custom surface.
3. **`CallSettingsBuilder` / single `CometChatCallsEventsListener` / `CometChatCalls.startSession`.** All 4.x (the builder + listener are `@Deprecated` in 5.0.2). Use `SessionSettingsBuilder`, the 5 split listeners, and `joinSession`.
4. **Per-screen incoming-call handling.** Calls only ring on the screen where the listener is attached. Listener belongs in the app shell (rule 1.7).
5. **Skipping `resizeToAvoidBottomInset: false`** on Scaffolds with call UI. Keyboard-show during a call resizes WebRTC views and breaks layout.
6. **Calling in-call controls statically on `CometChatCalls`** (e.g. `CometChatCalls.muteAudio(...)`, `CometChatCalls.setLayout(...)`). In 5.x those are INSTANCE methods on `CallSession.getInstance()`.
7. **Sending Android push as `notification`** instead of `data`. ConnectionService can't intercept `notification` payloads. Server must send `data: { type: "incoming_call", sessionId: ... }` with `priority: "high"`.

## 7. Verification checklist

**Static:**

- [ ] `cometchat_calls_sdk ^5.0.2` is a DIRECT dependency in `pubspec.yaml`; `cometchat_calls_uikit` is ABSENT
- [ ] No `CallSettingsBuilder` / `CometChatCallsEventsListener` / `CometChatCalls.startSession` / `CometChatUIKitCalls` / `CometChatCallingExtension` anywhere (all 4.x)
- [ ] Lifecycle uses `CometChatCalls.init/loginWithAuthToken/joinSession`; settings via `SessionSettingsBuilder`; events via the 5 split listeners on `CallSession.getInstance()`
- [ ] In-call controls go through `CallSession.getInstance()?.X()`, not static `CometChatCalls.X()`
- [ ] `MaterialApp.navigatorKey` is a `GlobalKey<NavigatorState>`
- [ ] Global Chat SDK `CallListener` attached in app-shell State, removed in `dispose`
- [ ] Listener uses a stable string ID
- [ ] Camera + microphone + notification permissions requested via `permission_handler`
- [ ] iOS `Info.plist`: NSCameraUsageDescription + NSMicrophoneUsageDescription + UIBackgroundModes (audio + voip + remote-notification)
- [ ] Android manifest: four FOREGROUND_SERVICE_* permissions + MANAGE_OWN_CALLS + BIND_TELECOM_CONNECTION_SERVICE
- [ ] Hangup path: `CallSession.getInstance()?.leaveSession()` + `CometChatOngoingCallService.abort()` + `FlutterCallkitIncoming.endAllCalls()` + `Navigator.popUntil` (rule 1.5)
- [ ] **Standalone only:** Firebase configured (`google-services.json` + `GoogleService-Info.plist`)
- [ ] **Standalone only:** `flutter_callkit_incoming` + `firebase_messaging` + iOS PushKit platform-channel bridge

**Runtime (real devices, both platforms):**

- [ ] iOS — terminated app, lock-screen rings on incoming call
- [ ] iOS — answer from lock screen → opens app, joins ongoing call
- [ ] Android — terminated app, heads-up notification rings on incoming call
- [ ] Android — answer from heads-up → opens app, joins ongoing call
- [ ] Both — outgoing call connects, two-way audio + video
- [ ] Both — hangup releases camera + mic, no system call UI stuck
- [ ] Android 14+: ongoing-call notification visible, swipe-up doesn't kill the call
- [ ] Keyboard-show during call doesn't break WebRTC view (rule from anti-pattern 5)

## 8. Pointers

- `cometchat-calls` — dispatcher
- `cometchat-flutter-v5-core` — UIKitSettingsBuilder, init/login order, GetX scope
- `cometchat-flutter-v5-events` — CometChatCallEvents subscription patterns
- `cometchat-flutter-v5-push` — FCM/APNs for chat (overlap with VoIP push but distinct paths)
- `cometchat-flutter-v5-production` — server-minted tokens, ProGuard, environment config
- `cometchat-flutter-v5-troubleshooting` — pubspec conflicts, GetX issues, Pod errors, runtime crashes
- `cometchat-flutter-v6-calls` + `cometchat-flutter-v6-migration` — when migrating to V6 (calls fold into the unified package, Bloc replaces GetX)
