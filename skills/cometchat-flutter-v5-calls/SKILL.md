---
name: cometchat-flutter-v5-calls
description: CometChat Calls integration for Flutter UIKit v5 (GetX-based, cometchat_calls_uikit separate package). Covers package wiring (cometchat_calls_uikit ^5.0.15 alongside cometchat_chat_uikit ^5.2), CometChatCallingExtension via UIKitSettingsBuilder, CallNavigationContext.navigatorKey, the kit's CometChatCallButtons / CometChatIncomingCall / CometChatOutgoingCall / CometChatOngoingCall / CometChatCallLogs widgets, dual-SDK ringing (CometChat.initiateCall + CometChatUIKitCalls.joinSession), Android FCM + ConnectionService for VoIP push, iOS CallKit + PushKit, foreground service correctness on Android 14+, hangup cleanup, and additive-vs-standalone modes.
license: "MIT"
compatibility: "Flutter >= 2.5, Dart >= 2.17; cometchat_chat_uikit ^5.2.14; cometchat_calls_uikit ^5.0.15; cometchat_calls_sdk ^4.2.2; cometchat_sdk ^4.1.2"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat flutter v5 calls voice video webrtc getx incoming outgoing ongoing call-logs callkit pushkit connectionservice fcm voip-push foreground-service navigatorkey calling-extension"
---

## Purpose

Production-grade voice + video calling for Flutter UIKit v5 (GetX-based). Loaded by `cometchat-calls` when `framework === "flutter"` and `flutter_version === "v5"`. Operates in two modes:

- **Standalone** — calls is the product. `cometchat_chat_sdk` (signaling) + `cometchat_calls_sdk` (WebRTC) without the `cometchat_chat_uikit` UI Kit. Custom call screens (or hand-roll the kit's call widgets without the conversation kit). **VoIP push is mandatory** — same rule as native iOS / Android.
- **Additive** — calls layered onto an existing v5 chat integration. Adds `cometchat_calls_uikit` package, configures the calling extension via `UIKitSettingsBuilder.callingExtension`, sets `CallNavigationContext.navigatorKey` on `MaterialApp`, mounts the global incoming-call listener at the app shell.

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-flutter-v5-core` — UIKitSettingsBuilder, init/login order, GetX scope rules, app entry conventions
- `cometchat-flutter-v5-events` — CometChatMessageEvents / CometChatCallEvents subscription patterns

**Ground truth:**
- SDK source — `~/Downloads/calls-sdk/calls-sdk-flutter-5/sdk/`
- Sample app — `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/`
- Public docs — https://www.cometchat.com/docs/calls/flutter/overview

---

## 1. The seven hard rules — Flutter v5 specialization

### 1.0 Calls SDK login is its own step (v5+)

The v5 Calls SDK has its own auth state, separate from the Chat SDK. After `CometChat.login` succeeds, you MUST also call `CometChatCalls.login` — without it, the FIRST calls API call throws **"auth token cannot be null"**.

```dart
import 'package:cometchat_sdk/cometchat_sdk.dart';
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

CometChat.login(uid, AUTH_KEY,
  onSuccess: (User user) {
    // Chat SDK ready — now login Calls SDK
    CometChatCalls.login(
      uid: uid,
      authKey: AUTH_KEY,
      onSuccess: (User? callUser) {
        // both ready
      },
      onError: (CometChatException e) {
        // surface to user
      },
    );
  },
  onError: (CometChatException e) {
    // chat login failed
  },
);
```

For production with server-minted tokens:

```dart
CometChatCalls.loginWithAuthToken(
  authToken: tokenFromBackend,
  onSuccess: (User? user) { /* … */ },
  onError: (CometChatException e) { /* … */ },
);
```

**Surprises:**
- Chat SDK persists login via shared preferences across launches. The **Calls SDK does NOT** — always check `CometChatCalls.getLoggedInUser()` on app start and re-login if it returns null.
- The Calls SDK's onSuccess hands back `User?` (nullable) — guard before using.

### 1.1 Dual-SDK contract — `CometChatCallingExtension` hides it (additive); standalone code sees both

In additive mode, the `CometChatCallingExtension` registered via `UIKitSettingsBuilder.callingExtension` wires both SDKs internally — your code rarely touches `CometChatUIKitCalls` directly. In standalone mode (no UI Kit), you call both SDKs explicitly:

```dart
// ✓ RIGHT — additive mode (calling extension owns the dual-SDK split)
final settings = (UIKitSettingsBuilder()
      ..appId = 'APP_ID'
      ..region = 'us'
      ..authKey = 'AUTH_KEY'
      ..subscriptionType = CometChatSubscriptionType.allUsers
      ..callingExtension = CometChatCallingExtension())
    .build();
CometChatUIKit.init(uiKitSettings: settings);
```

```dart
// ✓ RIGHT — standalone mode (explicit dual-SDK)
import 'package:cometchat_chat_sdk/cometchat_chat_sdk.dart';
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

// Chat SDK — initiate ringing
final outgoing = Call(receiverUid, CometChatReceiverType.user, CometChatCallType.video);
final initiated = await CometChat.initiateCall(call: outgoing);

// Calls SDK — join WebRTC session after acceptance.
// Use SessionSettingsBuilder + callback shape — matches the upstream sample
// at calls-sdk-flutter-5/sample-apps/cometchat-calls-sample-app-flutter/.
// CallSettingsBuilder is the chat-side type; SessionSettingsBuilder is what
// session/joinSession accepts.
final sessionSettings = (SessionSettingsBuilder()
      .setTitle('CometChat Call')
      .startVideoPaused(false)
      .startAudioMuted(false))
    .build();

CometChatCalls.joinSession(
  sessionId: sessionId,
  sessionSettings: sessionSettings,
  onSuccess: (Widget? widget) {
    // render widget via SizedBox.expand; register SessionStatusListeners
  },
  onError: (CometChatCallsException err) {
    debugPrint('joinSession failed: ${err.message}');
  },
);
```

### 1.2 VoIP push — `flutter_callkit_incoming` + `firebase_messaging` + platform-channel bridges

Standalone mode requires working VoIP push end-to-end. The Flutter stack:

- **`flutter_callkit_incoming`** — bridges CallKit (iOS) and a custom heads-up notification (Android). Single Dart API for "ring this device".
- **`firebase_messaging`** — FCM data messages on Android (priority `high`, `data` payload — NOT `notification`).
- **iOS PushKit** — Flutter doesn't have a first-party PushKit plugin; the skill ships a tiny platform-channel bridge in `ios/Runner/AppDelegate.swift` registering `PKPushRegistry.voIP` and forwarding payloads through a `MethodChannel` to Dart.
- **Server side** — same split as native: PushKit (VoIP cert) for iOS, FCM data-message for Android.

In additive mode, this is opt-in but recommended.

### 1.3 Foreground service — Android 14+ rules apply unchanged

**⚠️ Android build prerequisite — Jetifier is mandatory.** One of the `cometchat_calls_uikit` transitive deps pulls in the legacy `com.android.support:support-compat:26.1.0` AAR. Without Jetifier, AGP fails the assembleDebug step with dozens of `Duplicate class android.support.v4.*` errors against `androidx.core`. Set in `android/gradle.properties`:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

Flutter 3.x scaffolds omit `enableJetifier=true` by default — the build blows up on the first `flutter build apk` if you skip this. The error is loud but the fix is one line.

The `cometchat_calls_uikit` registers `CometChatOngoingCallService` via manifest merge, but the host app's `android/app/src/main/AndroidManifest.xml` must declare the four FOREGROUND_SERVICE permissions plus MANAGE_OWN_CALLS / BIND_TELECOM_CONNECTION_SERVICE — the same rule as native Android (cf. `cometchat-android-v5-calls` rule 1.3).

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

`cometchat-flutter-v5-production` covers the token-endpoint pattern. Production calls path uses `CometChatUIKit.loginWithAuthToken(token)`, not `loginWithAuthKey(uid, authKey)`. The Calls SDK piggybacks on the Chat SDK auth context — there is no separate calls-only token.

### 1.5 Hangup cleanup — Dart + native + system call UI

```dart
Future<void> endCall(String sessionId) async {
  // 1. End the Calls SDK session — releases WebRTC tracks.
  // CometChatCalls.endSession() does NOT exist on Flutter — use the
  // CallSession singleton's leaveSession().
  await CallSession.getInstance().leaveSession();
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

### 1.7 IncomingCall mounted at app root + `CallNavigationContext.navigatorKey`

V5 uses GetX's navigator key pattern. `CallNavigationContext.navigatorKey` MUST be set on `MaterialApp.navigatorKey` so call overlays can navigate even when a call is initiated from a sub-route:

```dart
// ✓ RIGHT
MaterialApp(
  navigatorKey: CallNavigationContext.navigatorKey,
  // ...
);
```

Global call listener registration (incoming calls fire app-wide) belongs in the app shell's State, not in a feature screen:

```dart
class AppShellState extends State<AppShell>
    with CallListener, CometChatCallEventListener {
  static const _listenerId = 'app-shell-call-listener';

  @override
  void initState() {
    super.initState();
    CometChat.addCallListener(_listenerId, this);
    CometChatCallEvents.addCallEventsListener(_listenerId, this);
  }

  @override
  void dispose() {
    CometChat.removeCallListener(_listenerId);
    CometChatCallEvents.removeCallEventsListener(_listenerId);
    super.dispose();
  }

  @override
  void onIncomingCallReceived(Call call) {
    // Route through CallNavigationContext or flutter_callkit_incoming
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
  cometchat_chat_uikit: ^5.2.14         # additive mode — already there
  cometchat_calls_uikit: ^5.0.15        # adds the calling extension + widgets
  permission_handler: ^11.0.0           # rule 1.6
  flutter_callkit_incoming: ^2.0.0      # standalone — VoIP UI bridge
  firebase_messaging: ^14.0.0           # standalone — Android FCM
  firebase_core: ^2.0.0                 # firebase_messaging peer
```

Hosted source if pub.dev resolution lags:

```yaml
  cometchat_calls_uikit:
    hosted: https://dart.cloudsmith.io/cometchat/cometchat/
    version: ^5.0.15
```

Init order — calling extension flows the dual-SDK init internally:

```dart
final settings = (UIKitSettingsBuilder()
      ..appId = CometChatConfig.appId
      ..region = CometChatConfig.region
      ..authKey = CometChatConfig.authKey
      ..subscriptionType = CometChatSubscriptionType.allUsers
      ..callingExtension = CometChatCallingExtension())  // ← rule 1.1 (additive)
    .build();

await CometChatUIKit.init(uiKitSettings: settings);
```

In standalone mode (no UI Kit), use the SDKs directly:

```dart
await CometChat.init(CometChatConfig.appId, AppSettings.builder
  ..setRegion(CometChatConfig.region)
  ..subscribePresenceForAllUsers());

await CometChatCalls.init(CallAppSettings.builder
  ..setAppId(CometChatConfig.appId)
  ..setRegion(CometChatConfig.region));
```

---

## 3. Components catalog (UI Kit widgets)

Imports (additive mode — barrel re-exports `cometchat_uikit_shared`, `cometchat_sdk`, `cometchat_calls_sdk`):

```dart
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';
```

| Widget | Purpose |
|---|---|
| `CometChatCallButtons(user: ..., group: ...)` | Voice + video buttons. Drop into `CometChatMessageHeader` trailing slot or anywhere in the tree. Mutually exclusive `user` / `group`. |
| `CometChatIncomingCall(call:, onAccept:, onDecline:)` | Foreground in-app ring UI (additive mode). **Callbacks take `(BuildContext, Call)`, NOT `(Call)` alone** — common mistake. |
| `CometChatOutgoingCall(call:, user: OR group:, onCancelled:)` | Dialing UI. `call:` is the result of `CometChatUIKitCalls.initiateCall(...)`. Callbacks `(BuildContext, Call)?`. |
| `CometChatOngoingCall(callSettingsBuilder:, sessionId:)` | Active call view, hosts WebRTC. |
| `CometChatCallLogs(onItemClick:, callLogsRequestBuilder:)` | Paginated history. **`CometChatCallLogDetails` is NOT a UIKit export** — copy the sample-app pattern from `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/.../call_log_details/` for the detail screen. |

`CometChatUIKitCalls` API:

| Method | Purpose |
|---|---|
| `CometChatUIKitCalls.initiateCall(call)` | Start a call (wraps Chat SDK `initiateCall` + Calls SDK preflight) |
| `CometChatUIKitCalls.acceptCall(sessionId)` | Accept incoming |
| `CometChatUIKitCalls.rejectCall(sessionId, status)` | Reject / cancel |
| `CometChatUIKitCalls.generateToken(sessionId)` | Mint session-scoped RTC token |
| `CometChatUIKitCalls.startSession(sessionId, settings)` | Start WebRTC |
| `CometChatUIKitCalls.endSession()` | End and cleanup |

---

## 4. Standalone integration

When `product === "voice-video"` and there is no v5 chat integration.

**Split by calling mode:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

Calls SDK ONLY. NO Chat SDK. Matches `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/cometchat-calls-sample-app-flutter/`. Scaffold:

1. **`pubspec.yaml`** — `cometchat_calls_sdk: ^5.0.0` ONLY. No `cometchat_chat_sdk` / `cometchat_uikit_chat`.
2. **`lib/main.dart`** — `CometChatCalls.init(appId, region, authKey)` + `permission_handler` flow.
3. **`lib/screens/call_screen.dart`** — `StatefulWidget implements SessionStatusListeners, ButtonClickListeners`. `CometChatCalls.joinSession(sessionId:, sessionSettings: SessionSettingsBuilder().build(), onSuccess:, onError:)`. `CometChatOngoingCallService.launch/abort`. See `references/call-session.md`.
4. **Native config** — Camera + microphone permissions only (no PushKit, no FCM for VoIP).

**Why no Chat SDK / no VoIP push:** session mode never touches a Chat SDK call entity. No ringing.

### 4b. Standalone — Ringing mode (CallKit + FCM + UIKit-driven UI)

Dual-SDK: Chat SDK signaling + Calls SDK media. Scaffold:

1. **`lib/main.dart`** — Chat SDK + Calls SDK init (no UIKit). Permission_handler request flow. PushKit + FCM listener registration.
2. **`lib/services/voip_service.dart`** — Combines `flutter_callkit_incoming` events + `firebase_messaging` + iOS platform-channel PushKit. On payload → `FlutterCallkitIncoming.showCallkitIncoming(...)`. On accept → navigate to ongoing-call screen.
3. **`lib/widgets/call_button.dart`** — Voice + video icon buttons rendered next to a user / contact.
4. **`lib/screens/ongoing_call_screen.dart`** — `CometChatCalls.joinSession(sessionId:, sessionSettings:, onSuccess:, onError:)` with the returned Widget rendered via `SizedBox.expand`. Implements rule 1.5 cleanup. Sets `resizeToAvoidBottomInset: false`.
5. **`lib/screens/call_logs_screen.dart`** — `/calls` route. Paginated via `CallLogsRequestBuilder`.
6. **`MaterialApp.navigatorKey: CallNavigationContext.navigatorKey`** — rule 1.7.
7. **Native config** — `Info.plist` (rule 1.6), `AndroidManifest.xml` (rule 1.3 + FCM service registration), Firebase config (`google-services.json` in `android/app/`, `GoogleService-Info.plist` in `ios/Runner/`).

## 5. Additive integration

When chat is already integrated. The skill:

1. Adds `cometchat_calls_uikit` to `pubspec.yaml`.
2. Patches the existing `UIKitSettingsBuilder` to add `..callingExtension = CometChatCallingExtension()`.
3. Sets `CallNavigationContext.navigatorKey` on `MaterialApp.navigatorKey` (rule 1.7).
4. Mounts the global call listener in the app-shell `State` (rule 1.7).
5. Confirms `CometChatMessageHeader` already shows call buttons (auto-rendered when `user` / `group` is passed).
6. Optionally adds `CometChatCallLogs` as a tab/screen if user picked dedicated history.
7. VoIP push: opt-in (substantial native config).

## 6. Anti-patterns

1. **`MaterialApp` without `CallNavigationContext.navigatorKey`.** Call overlays can't navigate; in-app ring works but accept-into-ongoing breaks. Rule 1.7.
2. **Forgetting `..callingExtension = CometChatCallingExtension()`** on `UIKitSettingsBuilder`. Calls compile but `CometChatMessageHeader` doesn't show call icons; nothing rings. Most common additive-mode mistake.
3. **`onAccept` / `onDecline` typed as `Function(Call)`** instead of `Function(BuildContext, Call)`. Compile errors are obvious; the dangerous case is when an agent wraps an existing chat screen's accept handler and silently mismatches signatures.
4. **Per-screen incoming-call handling.** Calls only ring on the screen where the listener is attached. Listener belongs in the app shell (rule 1.7).
5. **Skipping `resizeToAvoidBottomInset: false`** on Scaffolds with call UI. Keyboard-show during a call resizes WebRTC views and breaks layout.
6. **Mixing `cometchat_chat_uikit ^5.x` with `cometchat_calls_uikit ^4.x`** (or vice versa). Internal SDK pin clash. Both UI Kit packages must be on matching majors.
7. **Sending Android push as `notification`** instead of `data`. ConnectionService can't intercept `notification` payloads. Server must send `data: { type: "incoming_call", sessionId: ... }` with `priority: "high"`.

## 7. Verification checklist

**Static:**

- [ ] `cometchat_calls_uikit ^5.0.15` in `pubspec.yaml` (additive) OR `cometchat_calls_sdk ^4.2.2` + `cometchat_sdk ^4.1.2` (standalone)
- [ ] `..callingExtension = CometChatCallingExtension()` on `UIKitSettingsBuilder` (additive)
- [ ] `MaterialApp.navigatorKey` is `CallNavigationContext.navigatorKey`
- [ ] Global call listener attached in app-shell State, removed in `dispose`
- [ ] Listener uses a stable string ID
- [ ] Camera + microphone + notification permissions requested via `permission_handler`
- [ ] iOS `Info.plist`: NSCameraUsageDescription + NSMicrophoneUsageDescription + UIBackgroundModes (audio + voip + remote-notification)
- [ ] Android manifest: four FOREGROUND_SERVICE_* permissions + MANAGE_OWN_CALLS + BIND_TELECOM_CONNECTION_SERVICE
- [ ] Hangup path: `endSession()` + `FlutterCallkitIncoming.endAllCalls()` + `Navigator.popUntil` (rule 1.5)
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
