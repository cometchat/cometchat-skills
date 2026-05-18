# Server-side push routing for Flutter V5 (iOS PushKit + Android FCM)

Same server architecture as React Native — your server uses the iOS APNs PushKit canonical for iPhones and the Android FCM HTTP v1 canonical for Android. Flutter-specific changes are in token registration on the client.

**Canonical docs:**
- iOS: `cometchat-ios-calls/references/server-apns-pushkit.md`
- Android: `cometchat-android-v5-calls/references/server-fcm-voip.md`

---

## Dependencies

```yaml
dependencies:
  flutter_callkit_incoming: ^2.0.4
  flutter_voip_pushkit: ^0.2.1
  firebase_messaging: ^15.0.0
```

---

## Token registration (Flutter client)

```dart
import 'dart:io';
import 'package:flutter_voip_pushkit/flutter_voip_pushkit.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class CallPushService {
  Future<void> registerCallTokens(String userUid) async {
    if (Platform.isIOS) {
      final voip = FlutterVoipPushKit();
      voip.onTokenRefresh.listen((token) async {
        await api.registerCallToken(
          uid: userUid,
          platform: 'ios-voip',
          token: token,
        );
      });
      voip.onPushNotification.listen((payload) {
        // flutter_callkit_incoming surfaces the OS UI from here
      });
      // Trigger token registration
      await voip.configure();
    } else if (Platform.isAndroid) {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) {
        await api.registerCallToken(
          uid: userUid,
          platform: 'android-fcm',
          token: token,
        );
      }
      messaging.onTokenRefresh.listen((newToken) async {
        await api.registerCallToken(
          uid: userUid,
          platform: 'android-fcm',
          token: newToken,
        );
      });
    }
  }
}
```

---

## Server-side: same as RN

Identical webhook + dispatcher to RN — the platform-specific server templates do all the work. See `cometchat-native-calls/references/server-push-bridge.md` for the dispatcher code.

---

## Anti-patterns

RN sister rules apply, plus Flutter-specific:

1. **Calling `voip.configure()` before login.** Same problem as RN — register AFTER CometChat login.
2. **Forgetting `firebase_messaging` background isolate setup.** Android background pushes when the app is killed need `FirebaseMessaging.onBackgroundMessage(handler)` registered in `main.dart` before `runApp`.
3. **Skipping `flutter_callkit_incoming.showCallkitIncoming` in the push handler.** Without this, Flutter doesn't surface the OS-level call UI even though the push arrived.

---

## Verification checklist

- [ ] iOS: `FlutterVoipPushKit.configure()` + onTokenRefresh listener
- [ ] Android: `FirebaseMessaging.instance.getToken()` + onTokenRefresh
- [ ] Background isolate handler for Android (`onBackgroundMessage`)
- [ ] Server has both APNs + FCM dispatchers
- [ ] Real-device smoke: both iOS and Android ring when caller dials

---

## Pointers

- `cometchat-ios-calls/references/server-apns-pushkit.md` — iOS canonical
- `cometchat-android-v5-calls/references/server-fcm-voip.md` — Android canonical
- `cometchat-native-calls/references/server-push-bridge.md` — RN sister (same dispatcher pattern)
- `cometchat-flutter-v5-calls` SKILL.md — Flutter calls architecture
