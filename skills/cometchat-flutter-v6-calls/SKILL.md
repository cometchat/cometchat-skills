---
name: cometchat-flutter-v6-calls
description: "CometChat Calls integration for Flutter UIKit v6 (Bloc-based, stable). Production-ready at v6.0.1 GA (validated 2026-05-27 on Pixel 3) with ONE explicit MaterialApp wiring requirement still active from v6.0.0-beta2 — MaterialApp MUST wire navigatorKey to CallNavigationContext.navigatorKey or the outgoing-call screen never renders. (Vendor's own 6.0.1 sample is missing this line and broken out-of-the-box — file a vendor ticket if you find that sample first.) The earlier outgoing-to-in-call BLoC transition bug from beta2 is FIXED in 6.0.1 GA per the v6.0.0 changelog's 'Refreshed BLoC implementations across ongoing call flows' entry. Customers can now use V6 for calls. Covers UIKitSettings calling block, CometChatUIKitCalls.init() after CometChatUIKit.init() (CALLS_INIT_AFTER_CHAT_INIT), the kit's Bloc-driven CometChatCallButtons / CometChatIncomingCall / CometChatOutgoingCall / CometChatOngoingCall / CometChatCallLogs / CometChatCallBubble widgets, CallingConfiguration, CallOperationsServiceLocator lifecycle, VoIP push via external packages (FCM + PushKit + flutter_callkit_incoming — there is NO bundled native_call_kit module in the kit), and additive-vs-standalone modes."
license: "MIT"
compatibility: "Flutter >= 2.5, Dart >= 3.0; cometchat_chat_uikit ^6.0.1 (calls bundled in); minSdk 26+ on Android; iOS 13+"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat flutter v6 ga calls voice video webrtc bloc incoming outgoing ongoing call-logs callkit pushkit connectionservice fcm voip-push native-call-kit call-operations service-locator"
---

## Purpose

Production-grade voice + video calling for Flutter UIKit v6 (stable, Bloc-based). Loaded by `cometchat-calls` when `framework === "flutter"` and `flutter_version === "v6"`. Operates in two modes:

- **Standalone** — calls is the product. Chat SDK + Calls SDK without the v6 UI Kit (rare today, since the UI Kit ships calling bundled). Custom call screens on the SDKs.
- **Additive** — calls layered onto an existing v6 chat integration. The v6 UI Kit ships call widgets in the same package (`cometchat_chat_uikit`) — no extra dependency. The skill enables calling on `UIKitSettings`, calls `CometChatUIKitCalls.init()` in the chat-init success callback, mounts the global incoming-call overlay at app root.

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-flutter-v6-core` — UIKitSettings, init/login order (CHAT_INIT_BEFORE_CALLS_INIT is THE rule)
- `cometchat-flutter-v6-events` — Bloc event streams + listener registration

**V6 vs V5 difference (critical for migration):**
- V6 — single `cometchat_chat_uikit` package (calls bundled in)
- V5 — `cometchat_chat_uikit` + `cometchat_calls_uikit` (separate)
- V6 uses Bloc; V5 uses GetX
- V6 `CometChatUIKitCalls.init(appId, region)` must run AFTER `CometChatUIKit.init()` succeeds; V5 hides this via `CometChatCallingExtension`

**Ground truth:**
- SDK source — installed `cometchat_chat_uikit@6.0.1` artifacts under `~/.pub-cache/`
- Sample app — `calls-sdk-flutter-5/sample-apps/` (V5 sample; V6 sample app may not exist yet — verify before citing)
- Public docs — https://www.cometchat.com/docs/calls/flutter/overview (note: V6 docs may still reference V5 module split)

---

## 1. The seven hard rules — Flutter v6 specialization

### 1.0 Calls SDK login — handled automatically when `enableCalls: true` (ENG-35699)

> **Single source of truth, verified against installed `cometchat_chat_uikit-6.0.1` source on 2026-06-01:** when you set `..enableCalls = true` on `UIKitSettingsBuilder` AND use `CometChatUIKit.init`/`login` (i.e. the V6 UIKit shape, the recommended path), **the kit's `CallEventService` calls `CometChatCalls.init()` AND `CometChatCalls.loginWithAuthToken(...)` for you internally** — once Chat SDK login resolves, the kit hands the auth token to the Calls SDK and brings it online. You do NOT need to call `CometChatCalls.login` yourself. See `lib/call_ui/src/call_event_service.dart` lines 87-197 in the installed package.
>
> The earlier version of this skill said "Same as v5 cohort — you MUST also call `CometChatCalls.login`." That's wrong for V6 UIKit usage. It IS correct only when the integration is **raw SDK (no UIKit)** — i.e. the developer imported `cometchat_calls_sdk` directly without going through `CometChatUIKit`. Most integrations don't.

**The V6 UIKit recipe (recommended — 99% of integrations):**

```dart
final settings = (UIKitSettingsBuilder()
      ..subscriptionType = CometChatSubscriptionType.allUsers
      ..region = REGION
      ..appId = APP_ID
      ..authKey = AUTH_KEY
      ..enableCalls = true)              // <-- this flag wires CallEventService
    .build();

CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) async {
    await CometChatUIKit.login(uid);     // kit logs Chat SDK
    // Calls SDK login fires INTERNALLY here via CallEventService.
    // No manual CometChatCalls.login needed.
  },
  onError: (e) { /* surface */ },
);
```

**Raw-SDK fallback (only if NOT using `CometChatUIKit`):**

```dart
// You should rarely need this in V6 — only when you've opted out of the UIKit
// entirely and are wiring chat-sdk + calls-sdk by hand.
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

// Chat SDK login is POSITIONAL (cometchat.dart:843 — login(String uid, String authKey, {onSuccess, onError}))
await CometChat.login(uid, AUTH_KEY, onSuccess: (User u) {}, onError: (CometChatException e) {});
// Calls SDK login uses NAMED params; onError is CometChatCallsException (cometchatcalls.dart:224-228)
CometChatCalls.login(
  uid: uid,
  authKey: AUTH_KEY,
  onSuccess: (User? callUser) { /* both ready */ },
  onError: (CometChatCallsException e) { /* surface */ },
);
```

**Surprises:**
- The kit waits to log the Calls SDK in until Chat SDK login resolves; this is internal — your code only awaits Chat SDK login.
- If you set `enableCalls = true` but Chat-SDK login never fires (init error, network), call buttons silently render but the internal `CometChatCalls.startSession` flow throws "auth token cannot be null" (there is no `startCall` method — the lifecycle is `startSession`/`joinSession`). The fix is to surface the Chat SDK login error, not to add a manual `CometChatCalls.login`.
- Cross-reference: `references/add-calls-to-existing-chat.md` (additive-mode recipe) shows the same canonical pattern.

### 1.1 Dual-SDK contract — `CometChatUIKitCalls.init` after `CometChatUIKit.init`

The V6 UI Kit unifies the two SDKs but `init` order is still load-bearing:

```dart
// ✓ RIGHT — calls init in chat init's onSuccess
CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) {
    CometChatUIKitCalls.init(appId, region,
      onSuccess: (_) => debugPrint('Calls SDK ready'),
      onError: (e) => debugPrint('Calls init failed: ${e.message}'),
    );
  },
);
```

```dart
// ✗ WRONG — parallel init causes "auth token null" intermittently
CometChatUIKit.init(uiKitSettings: settings);   // returns immediately
CometChatUIKitCalls.init(appId, region);         // race — chat auth not ready yet
```

`CometChatUIKitCalls.init()` must be called **exactly once per app lifecycle**. Re-calling it after logout + re-login causes "session already started" errors.

After logout: the calls SDK session is invalidated; on next login, call `CometChatUIKitCalls.init()` again. Treat this as a "first run" of the calls subsystem.

### 1.2 VoIP push — external packages (FCM + CallKit/PushKit bridge)

> **There is NO bundled `native_call_kit` module in `cometchat_chat_uikit` v6.** (Verified against the published `cometchat_chat_uikit` 6.0.1 source — no `native_call_kit` directory, and no `flutter_callkit_incoming` / CallKit / ConnectionService dependency in its `pubspec.yaml`.) VoIP push is wired with the SAME external packages the v5 family uses — the kit does not provide an OS-ring-UI module of its own.

Wire VoIP push with:

- **`firebase_messaging`** — FCM data messages on Android (and iOS data path)
- **`flutter_callkit_incoming`** — cross-platform OS-level incoming-call ring UI (iOS CallKit + Android ConnectionService); you add this package yourself
- **iOS PushKit** — platform-channel bridge for VoIP pushes (Flutter has no first-party PushKit plugin) — same approach as v5

The Dart-side handler decodes the incoming-call payload from FCM/PushKit, shows the ring UI via `flutter_callkit_incoming`, and on accept routes into the kit's call surface. In additive mode this is opt-in; in standalone, mandatory.

### 1.3 Foreground service — same Android 14+ rules

**⚠️ Android build prerequisite — Jetifier is mandatory.** In V6 calls are bundled in `cometchat_chat_uikit` (there is no separate `cometchat_calls_uikit` package); one of its transitive deps still pulls in the legacy `com.android.support:support-compat:26.1.0` AAR. Without Jetifier, AGP fails with `Duplicate class android.support.v4.*` errors. Set in `android/gradle.properties`:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

Flutter 3.x scaffolds omit `enableJetifier=true` by default — the build fails on first `flutter build apk` if you skip this.

Same as native Android / Flutter v5. The four FOREGROUND_SERVICE_* permissions plus MANAGE_OWN_CALLS / BIND_TELECOM_CONNECTION_SERVICE in `android/app/src/main/AndroidManifest.xml`. V6 raised Android `minSdk` to 26 (calls SDK in V6 raised the floor) — verify this is set in `android/app/build.gradle`.

### 1.4 Server-minted auth tokens

`cometchat-flutter-v6-production` covers it. `CometChatUIKit.loginWithAuthToken(token)` for production, never `loginWithAuthKey(uid, authKey)`.

### 1.5 Hangup cleanup — Calls + ServiceLocator + native call UI

```dart
Future<void> endCall(String sessionId) async {
  await CometChatUIKitCalls.endSession();        // 1. end WebRTC + release tracks
  await FlutterCallkitIncoming.endAllCalls();    // 2. clear OS-level ring UI
  if (mounted) Navigator.of(context, rootNavigator: true).pop();  // 3. pop call screen
}
```

After `CometChatUIKit.logout()`, also reset the calls service locator:
```dart
CallOperationsServiceLocator.instance.reset();
```

The kit's call widgets handle the basic teardown automatically; custom WebRTC surfaces must replicate this.

### 1.6 Permissions — `permission_handler` + `CallPermissions`

V6 ships an internal `CallPermissions` helper that wraps the standard permission flow:

```dart
final granted = await CallPermissions.requestMicrophoneAndCamera(); // video; use requestMicrophone() for audio-only
if (!granted) { /* surface a clear UI message */ }
```

Native config (Info.plist + AndroidManifest) is identical to V5 (rule 1.6 in `cometchat-flutter-v5-calls`).

### 1.7 IncomingCall — automatic when `enableCalls = true` (ENG-35698)

> **Canonical truth from `cometchat_chat_uikit-6.0.1`:** the kit's `CallEventService` automatically calls `IncomingCallOverlay.show(...)` from `lib/call_ui/src/incoming_call/cometchat_display_incoming_call_overlay.dart` whenever a foreground incoming call fires AND `enableCalls = true` is set on `UIKitSettingsBuilder`. You do NOT mount the overlay yourself. There is NO `CometChatDisplayIncomingCallOverlay` widget — that was a fictional class name from earlier drafts. The real class is `IncomingCallOverlay` (in `cometchat_display_incoming_call_overlay.dart`) and it's an imperative singleton (`.show(...)` / `.dismiss()`).

**The correct V6 wiring is just the navigatorKey:**

```dart
MaterialApp(
  navigatorKey: CallNavigationContext.navigatorKey,  // ⚠️ REQUIRED — see warning below
  home: const AppRoot(),                              // your existing root
);
```

That's it. No `Stack`, no `builder` wrapper, no mounting of an "overlay widget" — once `enableCalls = true` is in your `UIKitSettingsBuilder`, the kit's `CallEventService` shows + dismisses `IncomingCallOverlay` for you when foreground rings happen.

**⚠️ `navigatorKey: CallNavigationContext.navigatorKey` is REQUIRED on MaterialApp — still active in v6.0.1 GA.** The kit's `CometChatCallButtons` and outgoing-call flow navigate via `CallNavigationContext.navigatorKey.currentContext`. Without this line, `CometChat.initiateCall` succeeds (CALL-TRAP confirms `onSuccess` fires with a valid sessionId) but `currentContext` is null so `CometChatOutgoingCall` never mounts. Symptom: user taps call button, peer rings, but the Flutter app shows nothing. **Note: the vendor's own 6.0.1 sample app (`examples/sample_app`) is broken for calls on mobile out-of-the-box** — its `main.dart` sets `navigatorKey: kIsWeb ? CallNavigationContext.navigatorKey : null`, i.e. it wires the key **only on web** and passes `null` on Android/iOS, so the outgoing-call screen never mounts on a device (validated on Pixel 3). The kit's *other* sample (`examples/ai_sample_app`) sets it **unconditionally** (`navigatorKey: navigatorKey` + `CallNavigationContext.navigatorKey = navigatorKey`) — that is the correct, device-safe form this skill prescribes. **Wire `navigatorKey: CallNavigationContext.navigatorKey` unconditionally** (do NOT gate it on `kIsWeb` like `sample_app` does); don't copy `sample_app`'s `main.dart` verbatim.

Import: `import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart' show CallNavigationContext;` (use `show` to avoid a name collision with kit-exported `IncomingCallOverlay`).

**✅ Outgoing → in-call screen transition is FIXED in v6.0.1 GA.** (It was broken in v6.0.0-beta2 — the outgoing-call screen stayed on "Calling…" indefinitely after the peer accepted.) Validated end-to-end 2026-05-27 on Pixel 3 with full CALL-TRAP instrumentation: with the navigatorKey wired (above), when the peer accepts, the kit's `OutgoingCallBloc` swaps the outgoing screen for the in-call surface automatically (via the kit's internal call-overlay — `CallScreenOverlay.show()`), transitioning from `CometChatOutgoingCall` ("Calling…") to the in-call view — observed call-duration timer ticking + WebRTC rendering frames @ ~27 fps. The v6.0.0 changelog's "Refreshed BLoC implementations across … call buttons, and ongoing call flows" was the fix. No client-side workaround needed beyond the navigatorKey wiring.

In standalone mode, `flutter_callkit_incoming` (the external package you add) owns the OS-level ring UI; the kit's in-app overlay only fires when the app is foregrounded.

---

## 2. Setup

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  cometchat_chat_uikit: ^6.0     # calls bundled in
  permission_handler: ^11.0.0
  flutter_callkit_incoming: ^2.0.0       # standalone — VoIP UI bridge
  firebase_messaging: ^14.0.0            # standalone — Android FCM
  firebase_core: ^2.0.0
```

> **V6 GA is on pub.dev — use the plain dependency above, NOT a Cloudsmith `hosted:` stanza.** Cloudsmith (`dart.cloudsmith.io/cometchat/cometchat/`) only hosts the pre-GA `6.0.0-beta*` builds, so a `hosted:` install of `^6.0.x` fails with "version solving failed". The GA range resolves `6.0.1`/`6.0.2`/`6.0.3` from pub.dev. (Cloudsmith is only for the legacy **V5** packages.)

Init (additive mode):

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final settings = (UIKitSettingsBuilder()
    ..appId = CometChatConfig.appId
    ..region = CometChatConfig.region
    ..authKey = CometChatConfig.authKey
    ..subscriptionType = CometChatSubscriptionType.allUsers)
    .build();

  CometChatUIKit.init(
    uiKitSettings: settings,
    onSuccess: (_) {
      CometChatUIKitCalls.init(
        CometChatConfig.appId,
        CometChatConfig.region,
        onSuccess: (_) => runApp(const MyApp()),
        onError: (e) => runApp(MyErrorApp(e.message)),
      );
    },
    onError: (e) => runApp(MyErrorApp(e.message)),
  );
}
```

The first import gives you chat components. The second gives you call-specific types.

---

## 3. Components catalog (V6 widgets — Bloc-driven)

Architecture (lives inside `cometchat_chat_uikit`):

```
call_ui/src/
├── call_buttons/          # CometChatCallButtons + CallButtonsBloc
├── incoming_call/         # CometChatIncomingCall + IncomingCallBloc
├── outgoing_call/         # CometChatOutgoingCall + OutgoingCallBloc
├── ongoing_call/          # CometChatOngoingCall + OngoingCallBloc
├── call_logs/             # CometChatCallLogs + CallLogsBloc + Clean Architecture
├── call_operations/       # Shared DI / use cases / repositories (CallOperationsServiceLocator)
├── call_bubble/           # CometChatCallBubble — call-event bubble in message list (auto-rendered)
├── call_settings/         # CometChatUIKitCalls, CallNavigationContext
├── utils/                 # CallUtils, CallStateService, CallPermissions
├── call_event_service.dart  # Centralized call event handling
└── calling_configuration.dart  # Top-level config object
```

### Component reference

| Widget | Purpose | Notes |
|---|---|---|
| `CometChatCallButtons(user:, group:)` | Voice + video buttons | Mutually exclusive `user` / `group`. Use `group:` for group calls (meetings). |
| `CometChatIncomingCall(call:, user:, onAccept:, onDecline:)` | In-app foreground ring UI | `onAccept`/`onDecline` are `(BuildContext, Call) -> void`. Custom view slots: `titleView`, `subTitleView`, `leadingView`, `trailingView`. ⚠️ **Param-name quirk:** this widget's settings param is `callSettingsBuilder:` (takes a `SessionSettingsBuilder`), NOT `sessionSettingsBuilder:` like Ongoing/Outgoing — verified `lib/call_ui/src/incoming_call/cometchat_incoming_call.dart`. |
| `CometChatOutgoingCall(call:, user:, outgoingCallStyle:)` | Dialing UI | Auto-mounted when `initiateCall` is called via the kit. |
| `CometChatOngoingCall(sessionSettingsBuilder:, sessionId:, callWorkFlow:)` | Active call view | **Param is `sessionSettingsBuilder:` NOT `callSettingsBuilder:`** (verified `lib/call_ui/src/ongoing_call/cometchat_ongoing_call.dart` constructor). `callWorkFlow: CallWorkFlow.directCalling` or `CallWorkFlow.defaultCalling`. Set `resizeToAvoidBottomInset: false` on host Scaffold. |
| `CometChatCallLogs(onItemClick:, callLogsStyle:)` | Paginated history | Clean Architecture + BLoC; `CallLogsServiceLocator` is initialized automatically when the widget mounts. |
| `CometChatCallBubble` | Call-event message bubble | Auto-rendered for call-type messages in `CometChatMessageList`. |

### `CometChatUIKitCalls` API

| Method | Purpose |
|---|---|
| `CometChatUIKitCalls.init(appId, region)` | Initialize calls SDK (after chat init — rule 1.1) |
| `CometChatUIKitCalls.initiateCall(call)` | Start a call (Chat SDK initiate + Calls SDK preflight) |
| `CometChatUIKitCalls.acceptCall(sessionId)` | Accept incoming |
| `CometChatUIKitCalls.rejectCall(sessionId, status)` | Reject / cancel |
| `CometChatUIKitCalls.generateToken(sessionId)` | Mint session-scoped RTC token |
| `CometChatUIKitCalls.startSession(sessionId, settings)` | Start WebRTC |
| `CometChatUIKitCalls.endSession()` | End and cleanup |

### `CallingConfiguration` — top-level config

```dart
CallingConfiguration(
  outgoingCallConfiguration: CometChatOutgoingCallConfiguration(...),
  incomingCallConfiguration: CometChatIncomingCallConfiguration(...),
  callButtonsConfiguration: CallButtonsConfiguration(...),
  groupSessionSettingsBuilder: sessionSettingsBuilder,
)
```

Pass to `UIKitSettings.callingConfiguration` to apply globally without per-component plumbing.

### Bloc events (when interacting directly — UIKit widgets handle these for you)

| Bloc | Events |
|---|---|
| `CallButtonsBloc` | `InitiateVoiceCall`, `InitiateVideoCall` |
| `IncomingCallBloc` | `AcceptCall`, `RejectCall` |
| `OutgoingCallBloc` | `CancelCall`, `CallAccepted(call)`, `CallRejected(call)` |
| `OngoingCallBloc` | `StartSession(sessionId, settings)`, `EndSession` |
| `CallLogsBloc` | `LoadCallLogs`, `LoadMoreCallLogs` |

`CallOperationsServiceLocator` must be initialized before using call BLoCs directly — UIKit widgets handle this automatically. After logout, call `CallOperationsServiceLocator.instance.reset()` to clean up.

---

## 4. Standalone integration

When `product === "voice-video"` and there is no v6 chat integration.

**Split by calling mode:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

Calls SDK ONLY. NO Chat SDK, NO UIKit. Same SDK as v5 (`cometchat_calls_sdk`). Scaffold:

1. **`pubspec.yaml`** — `cometchat_calls_sdk: ^5.0.0` + `flutter_bloc` + `equatable` + `permission_handler` ONLY.
2. **`lib/main.dart`** — `CometChatCalls.init((CallAppSettingBuilder()..appId = APP_ID..region = REGION).build(), onSuccess: ..., onError: ...)` (named-callback form; `CallAppSettingBuilder` exposes only `appId`/`region`/host overrides — there is NO `authKey` field. Verified `cometchat_calls_sdk-5.0.2` `src/builder/call_app_settings_request.dart` + `src/plugin/cometchatcalls.dart:172`). Permission requests. NO Chat SDK init.
3. **`lib/cubits/call_session_cubit.dart`** — Cubit implements `SessionStatusListeners`. `CometChatCalls.joinSession(sessionId:, sessionSettings: SessionSettingsBuilder().build(), onSuccess:, onError:)`. Renders the returned `Widget?` via `SizedBox.expand`. See `references/call-session.md`.
4. **`lib/screens/call_room.dart`** — `BlocConsumer` for auto-pop on idle transition.
5. **Native config** — Camera + microphone permissions only.

**Why no Chat SDK / no UIKit:** session mode never touches a Chat SDK call entity. No ringing, no UIKit incoming-call overlay needed.

### 4b. Standalone — Ringing mode (kit overlay + CallKit + FCM)

Dual-SDK + UIKit. Scaffold:

1. **`lib/main.dart`** — Chat SDK + Calls SDK init (no UIKit), permission requests, `flutter_callkit_incoming` + Firebase setup.
2. **`lib/services/voip_service.dart`** — FCM + PushKit + `flutter_callkit_incoming` bridge (you write this; the kit ships no VoIP/ring-UI module).
3. **`lib/widgets/call_button.dart`** — Voice + video buttons next to a contact.
4. **`lib/screens/ongoing_call_screen.dart`** — `CometChatCalls.joinSession(sessionId:, sessionSettings:, onSuccess:, onError:)` with Widget rendered via `SizedBox.expand`. Cubit-driven state.
5. **`lib/screens/call_logs_screen.dart`** — `/calls` route.
6. **`MaterialApp`** — `navigatorKey: CallNavigationContext.navigatorKey` wired; `enableCalls = true` on UIKitSettingsBuilder shows the foreground overlay automatically (rule 1.7). No widget mount needed.
7. **Native config** — same as V5 standalone (Info.plist + AndroidManifest + Firebase config files).

## 5. Additive integration

When chat is already integrated. The skill:

1. Confirms `cometchat_chat_uikit` is on `^6.0.1` — calls are already bundled.
2. Patches the `CometChatUIKit.init` call to add `CometChatUIKitCalls.init` in the success callback (rule 1.1).
3. Confirms `..enableCalls = true` is set on UIKitSettingsBuilder (rule 1.0) so foreground overlay fires automatically; ensures `navigatorKey: CallNavigationContext.navigatorKey` is on MaterialApp (rule 1.7).
4. Confirms `CometChatMessageHeader` shows call buttons by default (`hideVoiceCallButton: false`, `hideVideoCallButton: false`).
5. Optionally adds `CometChatCallLogs` as a tab/screen.
6. VoIP push: opt-in.

## 6. Anti-patterns

1. **Init Calls SDK before Chat SDK.** Auth-token race; `CometChatUIKitCalls.init` must run inside `CometChatUIKit.init`'s `onSuccess`. Rule 1.1.
2. **Calling `CometChatUIKitCalls.init` more than once per app lifecycle.** Causes "session already started". After logout-relogin, this is the first run again — but in a single session, do it exactly once.
3. **Per-screen incoming-call handling.** `CometChatIncomingCall(call: c, user: u)` mounted on the messages screen only fires there. Mount the overlay at app root via `MaterialApp.builder` (rule 1.7).
4. **Forgetting `resizeToAvoidBottomInset: false`** on Scaffolds with call UI — keyboard show breaks WebRTC layout.
5. **Group calls with `user:` instead of `group:`** on `CometChatCallButtons`. Group calls require `group:`; the widget silently mismatches if both are passed.
6. **Caching the theme in `build()`** instead of `didChangeDependencies()`. Listed in V6 components catalog as a perf rule but applies to every call surface.
7. **Skipping `CallOperationsServiceLocator.instance.reset()` after logout.** Stale singletons leak across user sessions; calls subsystem behaves erratically on next login.
8. **Mixing V5 and V6 widget imports.** V5's `cometchat_calls_uikit` namespace and V6's `cometchat_chat_uikit/cometchat_calls_uikit.dart` barrel re-export different classes with the same name. Pick a cohort and stay there.

## 7. Verification checklist

**Static:**

- [ ] `cometchat_chat_uikit ^6.0.1` in pubspec.yaml (V6 bundles calls — no separate calls package)
- [ ] `CometChatUIKitCalls.init` called inside `CometChatUIKit.init`'s `onSuccess` (rule 1.1)
- [ ] `CometChatUIKitCalls.init` called exactly once per app lifecycle
- [ ] `..enableCalls = true` on UIKitSettingsBuilder + `navigatorKey: CallNavigationContext.navigatorKey` on MaterialApp (rule 1.7) — no manual overlay widget mount
- [ ] No reference to `CometChatDisplayIncomingCallOverlay` (fictional class — does NOT exist; ENG-35698)
- [ ] iOS `Info.plist`: NSCameraUsageDescription + NSMicrophoneUsageDescription + UIBackgroundModes (audio + voip + remote-notification)
- [ ] Android `minSdk = 26`, ProGuard rules `-keep class com.cometchat.** { *; }`
- [ ] Android manifest: four FOREGROUND_SERVICE_* permissions + MANAGE_OWN_CALLS + BIND_TELECOM_CONNECTION_SERVICE
- [ ] Hangup path: `endSession` + `FlutterCallkitIncoming.endAllCalls` + Navigator pop
- [ ] After logout: `CallOperationsServiceLocator.instance.reset()`
- [ ] `resizeToAvoidBottomInset: false` on call-screen Scaffolds
- [ ] Theme cached in `didChangeDependencies()`, not `build()`
- [ ] **Standalone only:** `flutter_callkit_incoming` + `firebase_messaging` + iOS PushKit platform-channel bridge

**Runtime (real devices, both platforms):**

- [ ] iOS — terminated app, lock-screen rings on incoming call (CallKit)
- [ ] Android — terminated app, heads-up notification rings (ConnectionService)
- [ ] Both — outgoing call connects, two-way audio + video
- [ ] Both — hangup releases camera + mic, no system call UI stuck
- [ ] Logout + relogin: calls subsystem reinitializes cleanly (no "session already started")
- [ ] Android 14+: ongoing-call notification visible, swipe-up doesn't kill the call
- [ ] Keyboard during call doesn't break layout

## 8. Pointers

- `references/advanced-features.md` — Recording, Virtual Background, Audio Modes, Picture-in-Picture, Screen-share (receive) — source-verified against `cometchat_calls_sdk` 5.0.2
- `cometchat-calls` — dispatcher
- `cometchat-flutter-v6-core` — UIKitSettings, init/login order, init guard rules
- `cometchat-flutter-v6-events` — Bloc event streams
- `cometchat-flutter-v6-features` — feature catalog (calls is a base capability — features layer on top)
- `cometchat-flutter-v6-production` — server-minted tokens, ProGuard, environment config
- `cometchat-flutter-v6-troubleshooting` — pubspec resolution, Bloc errors, theme cache, build errors
- `cometchat-flutter-v6-migration` — V5 → V6 migration recipes (GetX → Bloc, calls package → bundled, theme API rewrite)

## Known external SDK gotchas (worth surfacing in any agent message)

- `startSession` on Android can return `null` with a 5-second timeout and no error feedback — **field-observed on Pixel 3, not confirmed in the SDK source**; retry once before surfacing failure. (Audio vs video is driven by the Chat-SDK `Call.type` string — there is no `SessionType` enum in the calls SDK.)
- Audio-only calls have been observed opening with video on Android in some builds (field-observed; verify against your installed SDK version) — set the call type explicitly via the Chat-SDK `Call(type: "audio")` and confirm the rendered surface.
