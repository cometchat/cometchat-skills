# Adding calls to an existing chat integration (Flutter V5)

You have `cometchat_chat_uikit` v5 working. Adding calls = `cometchat_calls_uikit: ^5.0.15` plus iOS/Android native config.

**Read first:** `cometchat-flutter-v5-calls/SKILL.md` — Flutter calls architecture (GetX patterns).

---

## Step 1 — Add the calls package

```yaml
# pubspec.yaml
dependencies:
  cometchat_chat_uikit: ^5.x.x      # existing
  cometchat_calls_uikit: ^5.0.15    # NEW
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
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Existing chat init
  final chatSettings = UIKitSettingsBuilder()
    ..setAppId(APP_ID)
    ..setRegion(REGION);
  await CometChatUIKit.init(uiKitSettings: chatSettings.build());

  // NEW: Calls init AFTER chat init
  final callsSettings = CallAppSettings(appId: APP_ID, region: REGION);
  await CometChatCalls.init(callsSettings);

  runApp(const MyApp());
}
```

---

## Step 4 — Login both SDKs

After `CometChatUIKit.login`:

```dart
final user = await CometChatUIKit.login(uid: uid, authKey: AUTH_KEY);
final authToken = user.authToken;
await CometChatCalls.login(authToken: authToken);
```

---

## Step 5 — Mount IncomingCall at app root

```dart
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Stack(
        children: [
          const AppRoot(),
          // Sibling overlay
          const CometChatIncomingCall(),
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

Trigger after `CometChatCalls.login` completes.

---

## Step 7 — Hangup teardown

```dart
Future<void> endCall(String sessionId) async {
  CometChatCalls.leaveSession();
  await CometChat.endCall(sessionId);
  // OS-level UI dismiss via flutter_callkit_incoming
  await FlutterCallkitIncoming.endCall(sessionId);
}
```

---

## Verification checklist

- [ ] `cometchat_calls_uikit: ^5.0.15` + native plugins in pubspec
- [ ] iOS Background Modes + Info.plist usage descriptions
- [ ] Android permissions + ConnectionService declared
- [ ] Calls init AFTER chat init in main()
- [ ] Calls login AFTER chat login
- [ ] `CometChatIncomingCall` sibling-overlay at root
- [ ] VoIP token registration triggered post-login
- [ ] Hangup teardown calls leaveSession + endCall + endCall (callkit)
- [ ] Real-device smoke: backgrounded incoming call rings on lock screen
- [ ] Run `cometchat verify --calls` — should pass

---

## Pointers

- `cometchat-react-calls/references/add-calls-to-existing-chat.md` — canonical
- `cometchat-flutter-v5-calls/SKILL.md` — GetX patterns
- `cometchat-flutter-v5-calls/references/server-push-bridge.md` — server-side push
- `cometchat-ios-calls/references/add-calls-to-existing-chat.md` — iOS native config
- `cometchat-android-v5-calls/references/add-calls-to-existing-chat.md` — Android native config
