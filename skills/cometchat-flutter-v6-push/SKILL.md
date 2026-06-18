---
name: cometchat-flutter-v6-push
description: Push notifications for CometChat Flutter UIKit v6 (stable, Bloc-based). Covers firebase_messaging setup for FCM (Android) + APNs (iOS via Firebase), CometChat dashboard PushPlatform configuration, token registration via the Notifications SDK, background isolate handler (Dart entry-point rule), foreground vs background message routing, notification tap deep-link to chat threads, and the Bloc patterns for surfacing push state. Sister skill of cometchat-flutter-v5-push — same FCM stack, Bloc-flavored client integration.
license: "MIT"
compatibility: "Flutter >= 2.5, Dart >= 3.0; cometchat_chat_uikit ^6.0.1; firebase_messaging ^14.0.0; firebase_core ^2.0.0; Android minSdk 26+; iOS 13+ deployment target"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat flutter v6 push notifications fcm apns firebase-messaging background-isolate dart-entry-point pushplatform bloc deep-link"
---

## Purpose

Push notifications for Flutter v6 (stable, GA 2026-05-25). Notifies users on incoming messages when the app is backgrounded or terminated. Two components: **Firebase Messaging** (FCM on Android, APNs forwarded via Firebase on iOS) on the client, plus **CometChat dashboard PushPlatform** configured to forward CometChat's webhook to Firebase.

This skill is for **chat push** (new messages). Calls/VoIP push has different mechanics — see `cometchat-flutter-v6-calls/SKILL.md` §1.2 (VoIP push — `native_call_kit` + FCM + PushKit) and its `references/server-push-bridge.md`.

**Read these other skills first:**
- `cometchat-flutter-v6-core` — UIKitSettings, init/login order
- `cometchat-flutter-v5-push` — sister skill (V5/GetX); same FCM stack with different client wiring
- `cometchat-flutter-v6-calls` — calls VoIP push (overlap with this; both can coexist)

**Ground truth:**
- firebase_messaging — https://pub.dev/packages/firebase_messaging
- CometChat docs — https://www.cometchat.com/docs/notifications/push-notifications
- FCM data vs notification payloads — https://firebase.google.com/docs/cloud-messaging/concept-options

---

## 1. Architecture

```
Flutter app
  ├── firebase_messaging — FCM token registration + receive
  └── Background isolate handler — handles pushes when app is killed

CometChat Notifications SDK (server-side, dashboard-managed)
  ├── PushPlatform configured (FCM key for Android, APNs cert for iOS)
  └── Listens for new-message events → fans out to FCM/APNs

CometChat dashboard
  └── Webhook → CometChat Notifications backend (no custom server needed for chat push)
```

Unlike Web Push (which requires you to run a push server), CometChat hosts the chat-push relay. Configure FCM/APNs creds in the dashboard's Notifications settings; CometChat does the rest.

---

## 2. Setup

### Add packages

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  cometchat_chat_uikit: ^6.0
  firebase_messaging: ^14.0.0
  firebase_core: ^2.0.0
  flutter_local_notifications: ^16.0.0    # for foreground notifications + iOS in-app banner
```

### Firebase project setup

```bash
flutterfire configure
```

This wizard:
- Asks which Firebase project to use (or creates one)
- Asks which platforms (iOS, Android, Web)
- Generates `lib/firebase_options.dart`
- Places `android/app/google-services.json`
- Places `ios/Runner/GoogleService-Info.plist`

If you don't have FlutterFire CLI: `dart pub global activate flutterfire_cli`.

### Android — `android/app/build.gradle`

```gradle
apply plugin: 'com.google.gms.google-services'

android {
  defaultConfig {
    minSdkVersion 26          // V6 floor; FCM needs 19+
  }
}
```

In `android/build.gradle`:

```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
  }
}
```

### Android — manifest

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />     <!-- Android 13+ -->

<application>
  <meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="cometchat_messages" />
  <meta-data
    android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@drawable/ic_notification" />
</application>
```

### iOS — capabilities

In Xcode → target → Signing & Capabilities:
- ☑ Push Notifications
- ☑ Background Modes → Remote notifications

Then upload an APNs Authentication Key (.p8) to **Firebase Console → Project Settings → Cloud Messaging → Apple app configuration**. Token-based auth (.p8) is preferred over cert-based — same key works for sandbox + production.

---

## 3. Initialize Firebase + register for push

```dart
// lib/main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // CRITICAL: register the background handler BEFORE runApp
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(const MyApp());
}

// Background handler MUST be a top-level function (not a closure inside a class)
// AND must be annotated with @pragma to survive tree-shaking in release builds
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Runs in a SEPARATE isolate. No Bloc, no UI state — just data persistence
  // or local notifications if needed.
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // CometChat Notifications backend already shows the system notification;
  // typically no extra work needed here.
}
```

**The `@pragma('vm:entry-point')` annotation is non-negotiable.** Without it, Flutter's tree-shaking removes the function in release builds and the background handler silently fails.

---

## 4. Token registration with CometChat

The CometChat Notifications backend needs the device's FCM token to send pushes. Register it via the `CometChatNotifications` SDK after login resolves:

```dart
// lib/services/push_service.dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/services.dart';

class PushService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;

  /// Call AFTER CometChatUIKit.login resolves.
  Future<void> registerForPush() async {
    // Request permission (iOS prompts; Android 13+ prompts)
    final settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus != AuthorizationStatus.authorized) return;

    // Get the FCM token
    final token = await _fcm.getToken();
    if (token == null) return;

    // Register with CometChat — provider ID matches your dashboard PushPlatform
    await _registerWithCometChat(token, platform: defaultTargetPlatform);

    // Listen for token refresh — happens on OS upgrades, app reinstalls
    _fcm.onTokenRefresh.listen((newToken) async {
      await _registerWithCometChat(newToken, platform: defaultTargetPlatform);
    });
  }

  Future<void> unregister() async {
    final token = await _fcm.getToken();
    if (token == null) return;
    await _unregisterWithCometChat(token);
  }

  Future<void> _registerWithCometChat(String token, {required TargetPlatform platform}) async {
    // Canonical SDK source: chat-sdk-flutter/lib/notification/main/cometchat_notifications.dart
    // (registerPushToken lines 36-235, unregisterPushToken lines 246-261).
    //
    // The kit's only public push surface is CometChatNotifications.registerPushToken /
    // unregisterPushToken — named-arg signature. PNRegistry seen in the vendor docs is
    // a sample-app extension (cometchat-uikit-flutter sample_app_push_notifications),
    // NOT a kit-exported symbol — copying it as-is into a customer project fails to
    // compile with "Undefined name 'PNRegistry'".
    //
    // Provider ID comes from the dashboard's Notifications → Push → Provider ID config;
    // customers typically store it as a const (AppCredentials.fcmProviderId pattern).
    final pushPlatform = platform == TargetPlatform.android
        ? PushPlatforms.FCM_FLUTTER_ANDROID
        : PushPlatforms.FCM_FLUTTER_IOS;   // iOS via Firebase (FCM relay).
                                            // For pure APNs chat:  PushPlatforms.APNS_FLUTTER_DEVICE + deviceToken: <APNs token>
                                            // For VoIP/CallKit:    PushPlatforms.APNS_FLUTTER_VOIP   + voipToken:   <PushKit token>
                                            //   See cometchat-flutter-v6-calls for VoIP plumbing.

    await CometChatNotifications.registerPushToken(
      pushPlatform,
      fcmToken: token,
      providerId: AppCredentials.fcmProviderId, // your dashboard PushPlatform provider ID
      onSuccess: (resp) => debugPrint('CometChat push registered: $resp'),
      onError: (CometChatException e) => debugPrint('CometChat push register failed: ${e.message}'),
    );
  }

  Future<void> _unregisterWithCometChat(String token) async {
    // Distinct method on CometChatNotifications (chat-sdk-flutter lines 246-261).
    // No token arg required — the SDK resolves the registration by the logged-in user's identity.
    await CometChatNotifications.unregisterPushToken(
      onSuccess: (_) => debugPrint('CometChat push unregistered'),
      onError: (CometChatException e) => debugPrint('CometChat push unregister failed: ${e.message}'),
    );
  }
}
```

**Symbol note (2026-06-03, reversing 2026-05-14):** The kit's only public push surface is `CometChatNotifications.registerPushToken` / `unregisterPushToken` — verified in `chat-sdk-flutter/lib/notification/main/cometchat_notifications.dart` and cross-verified against the V5 sister skill (`cometchat-flutter-v5-push`) and the replit-template canonical skill. `PNRegistry.registerPNService` is a v5-sample-app extension (lives in `cometchat-uikit-flutter/sample_app_push_notifications/`, defined as `extension PNRegistry on CometChatService`) — it is NOT exported by any `cometchat_*` pub package. The previous 2026-05-14 audit treated a docs page that cites the sample-app helper as SDK ground truth; that audit has been reversed.

**Signature:** `CometChatNotifications.registerPushToken` is **named-arg only**: `(PushPlatforms platform, {String? fcmToken, String? deviceToken, String? voipToken, String? providerId, Function(String)? onSuccess, Function(CometChatException)? onError})`. The positional `(token, true, false)` shape from the v5 sample-app helper does not type-check against the SDK.

---

## 5. Wire into the auth flow

```dart
// lib/main.dart (continued)
class MyApp extends StatefulWidget {
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final PushService _push = PushService();

  @override
  void initState() {
    super.initState();
    _initCometChat();
  }

  Future<void> _initCometChat() async {
    final settings = (UIKitSettingsBuilder()
      ..appId = CometChatConfig.appId
      ..region = CometChatConfig.region
      ..authKey = CometChatConfig.authKey)
      .build();

    CometChatUIKit.init(
      uiKitSettings: settings,
      onSuccess: (_) async {
        // After login (in your AuthBloc or wherever)
        await _push.registerForPush();
        _setupForegroundHandler();
        _setupNotificationTapHandler();
      },
    );
  }

  void _setupForegroundHandler() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      // App is in foreground — system doesn't show a notification automatically.
      // Either show a flutter_local_notifications banner, or surface in-app via Bloc.
    });
  }

  void _setupNotificationTapHandler() {
    // Tap on notification while app is backgrounded
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      _navigateToConversation(message);
    });

    // Cold-start tap — app was terminated, user tapped notification
    FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) _navigateToConversation(message);
    });
  }

  void _navigateToConversation(RemoteMessage message) {
    final data = message.data;
    final conversationId = data['conversationId'] as String?;
    final receiverType = data['receiverType'] as String?;
    if (conversationId == null) return;

    // Use a global navigator key (set on MaterialApp.navigatorKey) to navigate
    // from outside the widget tree
    AppNavigator.navigatorKey.currentState?.pushNamed(
      receiverType == 'group' ? '/messages/group/$conversationId' : '/messages/user/$conversationId',
    );
  }
}
```

---

## 6. CometChat dashboard PushPlatform

In the dashboard:

1. Navigate to **Notifications → Push Notifications**.
2. Add provider:
   - **FCM** for Android: paste the FCM Server Key (from Firebase Console → Project Settings → Cloud Messaging → Cloud Messaging API (Legacy)) OR the new HTTP v1 API service account JSON
   - **APN** for iOS: paste the .p8 + Team ID + Key ID, OR the .p12 (legacy)
3. Save. CometChat now relays new-message events to FCM/APNs.

**Use HTTP v1 API for FCM** — Google deprecated the legacy server keys. The dashboard's UI lists both; pick HTTP v1 for new setups.

---

## 7. Foreground notifications

When the app is foregrounded, FCM does NOT show a system notification — `onMessage` fires instead and you decide what to do. Options:

### A — In-app banner via Bloc

```dart
// In your AppBloc or a NotificationBloc
on<IncomingMessageNotification>((event, emit) {
  emit(state.copyWith(banner: BannerData(
    title: event.senderName,
    body: event.preview,
    onTap: () => navigatorKey.currentState?.pushNamed(...),
  )));
});
```

Render the banner in `MaterialApp.builder`.

### B — Local notification via flutter_local_notifications

```dart
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final FlutterLocalNotificationsPlugin _localNotifs = FlutterLocalNotificationsPlugin();

Future<void> _showLocalNotif(RemoteMessage message) async {
  await _localNotifs.show(
    message.hashCode,
    message.notification?.title ?? '',
    message.notification?.body ?? '',
    NotificationDetails(
      android: AndroidNotificationDetails(
        'cometchat_messages',
        'Messages',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    ),
    payload: jsonEncode(message.data),
  );
}
```

Initialize `flutter_local_notifications` once in `main()`:

```dart
await _localNotifs.initialize(
  InitializationSettings(
    android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    iOS: DarwinInitializationSettings(),
  ),
  onDidReceiveNotificationResponse: (response) {
    if (response.payload != null) {
      final data = jsonDecode(response.payload!);
      // navigate
    }
  },
);
```

---

## 8. Logout cleanup

```dart
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final PushService _push;

  on<LogoutRequested>((event, emit) async {
    await _push.unregister();             // CRITICAL — before SDK logout
    await CometChatUIKit.logout(/* ... */);
    emit(Unauthenticated());
  });
}
```

If you skip unregister, the previous user keeps getting notifications for the new user's messages.

---

## 9. v5 → v6 push migration

If migrating from v5:

| Concern | V5 | V6 |
|---|---|---|
| Listener pattern | GetX `Get.put` for push handlers | Bloc — handlers in app shell or a NotificationBloc |
| Init lifecycle | `CometChatUIKit.init` callback | Same shape — `onSuccess` / `onError` |
| Token registration API | `CometChatNotifications.registerPushToken(platform, {fcmToken, deviceToken, voipToken, providerId, onSuccess, onError})` | Same — namespace and signature unchanged in V6 chat-sdk-flutter; only the surrounding state-mgmt wiring differs (Bloc instead of GetX) |
| Background handler | `@pragma('vm:entry-point')` required | Unchanged — Flutter framework requirement |
| Calls VoIP push interaction | `cometchat_calls_uikit ^5` separate package | Calls bundled into `cometchat_chat_uikit ^6.0.1`; VoIP push handled in `cometchat-flutter-v6-calls` references |

The migration is small for push specifically — the FCM/firebase_messaging stack is unchanged; the deltas are in the surrounding architecture.

---

## 10. Anti-patterns

1. **Background handler missing `@pragma('vm:entry-point')`.** Tree-shaken in release builds; works in debug. The "works in dev, fails in production" canary.
2. **Background handler as a closure inside a class.** Must be a TOP-LEVEL function. Closures can't be passed across isolate boundaries.
3. **Calling `_push.registerForPush()` before login.** CometChat doesn't know whose UID this token belongs to. Register from the post-login success callback.
4. **Skipping `onTokenRefresh`.** OS upgrades and app reinstalls rotate the FCM token without warning. Listen to refresh and re-register.
5. **Using FCM legacy server keys.** Google deprecated them. Use HTTP v1 API service account in CometChat dashboard.
6. **Not unregistering on logout.** Previous user's notifications keep arriving for the new session.
7. **Showing a foreground notification AND an in-app banner for the same message.** Pick one. The skill defaults to in-app banner (Bloc-driven) if the chat tab is active; system notification otherwise.
8. **`flutter_local_notifications` initialization missing icon resource.** Crashes on Android with "Notification icon not found." Drop a `ic_notification.png` in `android/app/src/main/res/drawable/`.

---

## 11. Verification checklist

- [ ] `firebase_messaging ^14.0.0` + `firebase_core ^2.0.0` in pubspec.yaml
- [ ] `flutterfire configure` ran successfully; `lib/firebase_options.dart` exists
- [ ] `google-services.json` in `android/app/`
- [ ] `GoogleService-Info.plist` in `ios/Runner/`
- [ ] iOS: Push Notifications + Remote-notification background mode capabilities enabled
- [ ] iOS: APNs .p8 key uploaded to Firebase Console
- [ ] Android: `minSdkVersion 26` in `android/app/build.gradle` (V6 floor)
- [ ] Android manifest: `POST_NOTIFICATIONS` permission + notification channel meta-data
- [ ] Background handler is top-level + `@pragma('vm:entry-point')`
- [ ] Background handler initialized via `FirebaseMessaging.onBackgroundMessage` BEFORE `runApp`
- [ ] FCM/APN token registered with CometChat via `CometChatNotifications.registerPushToken(PushPlatforms.FCM_FLUTTER_ANDROID, fcmToken: token, providerId: ..., onSuccess: ..., onError: ...)` (or `PushPlatforms.FCM_FLUTTER_IOS` / `APNS_FLUTTER_DEVICE` + `deviceToken:` / `APNS_FLUTTER_VOIP` + `voipToken:` equivalent) AFTER login resolves. `PNRegistry` in the vendor docs is a v5-sample-app extension, not a kit API.
- [ ] `onTokenRefresh` re-registers
- [ ] Foreground handler decides banner vs no-banner based on chat tab focus
- [ ] `onMessageOpenedApp` + `getInitialMessage` both navigate to the conversation
- [ ] Logout calls `_push.unregister()` BEFORE `CometChatUIKit.logout()`
- [ ] Dashboard PushPlatform configured with FCM HTTP v1 + APNs .p8
- [ ] Real-device smoke (NOT simulator): backgrounded app → message → notification rings + tapping opens chat thread

---

## 12. Pointers

- `cometchat-flutter-v5-push` — V5/GetX sister skill (FCM stack unchanged; client wiring different)
- `cometchat-flutter-v6-calls` SKILL.md §1.2 + `references/server-push-bridge.md` — calls VoIP push (overlap; both can coexist)
- `cometchat-flutter-v6-core` — UIKitSettings, init/login order
- `cometchat-flutter-v6-troubleshooting` — push debugging (token never registers, background handler doesn't fire, FCM payload not received)
- `cometchat-flutter-v6-migration` — full V5→V6 migration recipe; push delta is one section
