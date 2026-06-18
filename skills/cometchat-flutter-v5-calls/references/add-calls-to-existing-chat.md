# Adding calls to an existing chat integration (Flutter V5)

You have `cometchat_chat_uikit` v5 working. Adding calls = the **raw 5.x calls SDK** (`cometchat_calls_sdk: ^5.0.2`, direct dependency) plus iOS/Android native config and a custom call surface.

> **Do NOT add `cometchat_calls_uikit`.** Its latest (5.0.16) pins `cometchat_calls_sdk ^4.2.2` and its prebuilt call widgets are 4.x-bound — incompatible with the 5.x calls SDK. Use the raw SDK + custom UI.

**Read first:** `cometchat-flutter-v5-calls/SKILL.md` — Flutter calls architecture (GetX patterns) + `references/call-session.md` for the canonical 5.x surface.

---

## Step 1 — Add the calls package

```yaml
# pubspec.yaml
dependencies:
  cometchat_chat_uikit: ^5.x.x      # existing (GetX chat kit — keep)
  cometchat_calls_sdk: ^5.0.2       # NEW — raw 5.x calls SDK (direct)
  flutter_callkit_incoming: ^2.0.4  # for OS-level incoming-call UI
  flutter_voip_pushkit: ^0.2.1      # iOS PushKit
  firebase_messaging: ^15.0.0       # Android FCM
```

```bash
flutter pub get
cd ios && pod install
```

---

## Step 2 — iOS + Android native config

**iOS** — same as native iOS calls (see `cometchat-ios-calls/references/add-calls-to-existing-chat.md`):
- Push Notifications + Background Modes (audio, voip, remote-notification) capabilities
- Info.plist: NSCameraUsageDescription, NSMicrophoneUsageDescription

**Android** — same as Android V5 calls (see `cometchat-android-v5-calls/references/add-calls-to-existing-chat.md`):
- All permissions
- ConnectionService declared
- `foregroundServiceType` for Android 14+

---

## Step 3 — Init order: chat → calls

In your existing init (typically `main.dart`):

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Existing chat init
  final chatSettings = UIKitSettingsBuilder()
    ..setAppId(APP_ID)
    ..setRegion(REGION);
  await CometChatUIKit.init(uiKitSettings: chatSettings.build());

  // NEW: 5.x Calls SDK init AFTER chat init.
  // init is callback-based (NOT awaitable) and takes a CallAppSettings built
  // via CallAppSettingBuilder — no authKey field (call_app_settings_request.dart).
  // Verified cometchatcalls.dart:172.
  final callsSettings = (CallAppSettingBuilder()
        ..appId = APP_ID
        ..region = REGION)
      .build();
  CometChatCalls.init(
    callsSettings,
    onSuccess: (String success) {/* Calls SDK ready */},
    onError: (CometChatCallsException e) {/* surface */},
  );

  runApp(const MyApp());
}
```

---

## Step 4 — Login BOTH SDKs (5.x Calls SDK has its own login)

Unlike 4.x, the 5.x Calls SDK logs in explicitly and caches the auth token (`cometchatcalls.dart:316`). Log the chat user in, then log the Calls SDK in with the same token:

```dart
final user = await CometChatUIKit.login(uid: uid, authKey: AUTH_KEY);
final authToken = await CometChat.getUserAuthToken();  // static; no User.getAuthToken() method
if (authToken != null) {
  CometChatCalls.loginWithAuthToken(
    authToken: authToken,
    onSuccess: (cu) {/* Calls SDK ready */},
    onError: (CometChatCallsException e) {/* surface */},
  );
}
```

---

## Step 5 — Mount a custom incoming-call overlay at app root

There is no prebuilt `CometChatIncomingCall` on the raw 5.x SDK (that widget is 4.x-kit-only). Listen for incoming calls via the Chat SDK `CallListener` (app shell, SKILL.md rule 1.7) and show your own overlay; on accept, `CometChat.acceptCall(sessionId)` → `CometChatCalls.joinSession(...)`.

```dart
class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,      // GlobalKey<NavigatorState> — rule 1.7
      home: const Stack(
        children: [
          AppRoot(),                   // hosts the Chat SDK CallListener
          MyIncomingCallOverlay(),     // your custom ring UI
        ],
      ),
    );
  }
}
```

---

## Step 6 — VoIP push registration

```dart
import 'dart:io';
import 'package:flutter_voip_pushkit/flutter_voip_pushkit.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class CallPushService {
  Future<void> register(String userUid) async {
    if (Platform.isIOS) {
      final voip = FlutterVoipPushKit();
      voip.onTokenRefresh.listen((token) {
        api.registerCallToken(uid: userUid, platform: 'ios-voip', token: token);
      });
      await voip.configure();
    } else if (Platform.isAndroid) {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) {
        await api.registerCallToken(uid: userUid, platform: 'android-fcm', token: token);
      }
      messaging.onTokenRefresh.listen((t) {
        api.registerCallToken(uid: userUid, platform: 'android-fcm', token: t);
      });
    }
  }
}
```

Trigger after `CometChatUIKit.login` completes (there is no separate Calls login).

---

## Step 7 — Hangup teardown

```dart
Future<void> endCall(String sessionId) async {
  // 5.x: teardown is the CallSession INSTANCE leaveSession() (call_session.dart:272).
  // The static CometChatCalls.endSession exists (cometchatcalls.dart:676) but is
  // @Deprecated and just delegates to leaveSession().
  await CallSession.getInstance()?.leaveSession();
  await CometChat.endCall(sessionId);
  // OS-level UI dismiss via flutter_callkit_incoming
  await FlutterCallkitIncoming.endCall(sessionId);
}
```

---

## Verification checklist

- [ ] `cometchat_calls_sdk: ^5.0.2` (direct) + native plugins in pubspec; NO `cometchat_calls_uikit`
- [ ] iOS Background Modes + Info.plist usage descriptions
- [ ] Android permissions + ConnectionService declared
- [ ] Calls init AFTER chat init in main() (callback-based `CometChatCalls.init`, NOT awaited)
- [ ] `CometChatCalls.loginWithAuthToken(...)` after chat login (5.x has its own login)
- [ ] Custom incoming-call overlay driven by the Chat SDK `CallListener` (no `CometChatIncomingCall`)
- [ ] VoIP token registration triggered post-login
- [ ] Hangup teardown calls `CallSession.getInstance()?.leaveSession()` + `CometChat.endCall` + endCall (callkit)
- [ ] Real-device smoke: backgrounded incoming call rings on lock screen
- [ ] Run `cometchat verify --calls` — should pass

---

## Pointers

- `cometchat-react-calls/references/add-calls-to-existing-chat.md` — canonical
- `cometchat-flutter-v5-calls/SKILL.md` — GetX patterns
- `cometchat-flutter-v5-calls/references/server-push-bridge.md` — server-side push
- `cometchat-ios-calls/references/add-calls-to-existing-chat.md` — iOS native config
- `cometchat-android-v5-calls/references/add-calls-to-existing-chat.md` — Android native config
