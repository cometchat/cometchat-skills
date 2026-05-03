---
name: cometchat-flutter-v5-push
description: "Use when implementing push notifications with CometChat Flutter UIKit v5. Covers FCM (Android), APNs (iOS), VoIP calls, token lifecycle, local notifications, and tap-to-navigate."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_calls_uikit ^5.0.15; firebase_messaging; flutter_local_notifications; flutter_callkit_incoming"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 push notifications fcm apns voip callkit firebase"
---

# CometChat Flutter UIKit v5 — Push Notifications

Push notification setup for Android (FCM) and iOS (APNs + VoIP).

## Dependencies

```yaml
dependencies:
  firebase_core: ^3.9.0
  firebase_messaging: ^15.1.6
  flutter_local_notifications: ^18.0.0
  flutter_callkit_incoming: # for VoIP call notifications
  app_badge_plus: ^1.2.6  # badge count
```

## Architecture Overview

```
notifications/
├── models/
│   ├── payload.dart              # PayloadData model for parsing FCM data
│   ├── call_action.dart          # CallAction enum (initiated, cancelled, unanswered)
│   ├── call_type.dart            # CallType enum (audio, video)
│   └── notification_message_type.dart  # Message type constants
├── services/
│   ├── android_notification_service/
│   │   ├── firebase_services.dart       # FCM init, listeners, token management
│   │   ├── local_notification_handler.dart  # Local notification display + tap handling
│   │   ├── voip_notification_handler.dart   # VoIP call display, accept, decline
│   │   └── notification_launch_handler.dart # Terminated state launch handling
│   ├── iOS_notification_service/
│   │   └── apns_services.dart           # APNs connector, VoIP token, CallKit
│   └── cometchat_service/
│       └── cometchat_services.dart      # PNRegistry (token registration/unregistration)
```

## Token Registration — `CometChatNotifications.registerPushToken`

The kit's only public push surface is `CometChatNotifications.registerPushToken(platform, {providerId, fcmToken, deviceToken, voipToken, onSuccess, onError})` (and `unregisterPushToken({onSuccess, onError})`). The sample app wraps this in an extension named `PNRegistry on CometChatService` (see `sample_app_push_notifications/lib/notifications/services/cometchat_service/cometchat_services.dart`) that picks the right provider ID + platform constant for FCM-Android / FCM-iOS / APNs / APNs-VoIP. **Copy that helper into your project, or call `CometChatNotifications.registerPushToken` directly** — `PNRegistry` is a sample-app extension, not importable from any cometchat package.

```dart
// Direct kit API:
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

await CometChatNotifications.registerPushToken(
  PushPlatforms.FCM_FLUTTER_ANDROID,    // platform — first positional arg
  providerId: fcmProviderId,            // dashboard FCM provider ID
  fcmToken: token,                      // use fcmToken / deviceToken / voipToken depending on platform
  onSuccess: (response) => debugPrint('registered: $response'),
  onError: (e) => debugPrint('register failed: $e'),
);

// On logout:
await CometChatNotifications.unregisterPushToken(
  onSuccess: (_) {},
  onError: (e) => debugPrint('unregister failed: $e'),
);
```

```dart
// Or use the sample-app PNRegistry helper after copying it into your project:
PNRegistry.registerPNService(token, true, false);   // (token, isFcm, isVoip)
PNRegistry.unregisterPNService();
```

Platform mapping:
- FCM Android → `PushPlatforms.FCM_FLUTTER_ANDROID`
- FCM iOS → `PushPlatforms.FCM_FLUTTER_IOS`
- APNs Device → `PushPlatforms.APNS_FLUTTER_DEVICE`
- APNs VoIP → `PushPlatforms.APNS_FLUTTER_VOIP`

Provider IDs come from `AppCredentials.fcmProviderId` / `AppCredentials.apnProviderId` (your own constants — these are dashboard-configured values, not kit exports).

The remaining examples below assume you've copied `PNRegistry` from the sample app. If you call `CometChatNotifications.registerPushToken` directly, swap the call sites accordingly.

## Android — FCM Setup

### 1. Background handler (must be top-level function)

```dart
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage rMessage) async {
  LocalNotificationService.showNotification(rMessage.data, rMessage, "", false);
  await VoipNotificationHandler.displayIncomingCall(rMessage);
}
```

### 2. Initialize in dashboard/home screen

```dart
class FirebaseService {
  Future<void> init(BuildContext context) async {
    _firebaseMessaging = FirebaseMessaging.instance;
    await requestPermissions();
    await initListeners(context);

    String? token = await _firebaseMessaging.getToken();
    if (token != null) {
      PNRegistry.registerPNService(token, true, false);
    }
  }
}
```

### 3. Listener setup

```dart
// Background messages
FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

// Token refresh
_firebaseMessaging.onTokenRefresh.listen((token) {
  PNRegistry.registerPNService(token, true, false);
});

// Foreground messages
FirebaseMessaging.onMessage.listen((message) {
  LocalNotificationService.showNotification(message.data, message, conversationId, isAgentic);
});

// Tap from background
FirebaseMessaging.onMessageOpenedApp.listen((message) {
  openNotification(context, message, conversationId);
});

// Tap from terminated state
FirebaseMessaging.instance.getInitialMessage().then((message) {
  if (message != null) openNotification(context, message, conversationId);
});
```

## iOS — APNs Setup

```dart
final _connector = ApnsPushConnector();
_connector.shouldPresent = (x) => Future.value(false);

_connector.configure(
  onLaunch: (message) async { openNotification(message, context, ""); },
  onResume: (message) async { openNotification(message, context, conversationId); },
  onMessage: (message) async { _showNotification(message.data, message, conversationId, isAgentic); },
);

_connector.requestNotificationPermissions();

// APNs device token
_connector.token.addListener(() {
  PNRegistry.registerPNService(_connector.token.value!, false, false);
});

// VoIP token
FlutterCallkitIncoming.getDevicePushTokenVoIP().then((voipToken) {
  PNRegistry.registerPNService(voipToken, false, true);
});
```

## VoIP Call Notifications

### Display incoming call (both platforms)

```dart
static Future<void> displayIncomingCall(RemoteMessage rMessage) async {
  PayloadData callPayload = PayloadData.fromJson(rMessage.data);
  if (callPayload.type == 'call' && callPayload.callAction == CallAction.initiated) {
    CallKitParams params = CallKitParams(
      id: callPayload.sessionId,
      nameCaller: callPayload.senderName,
      type: (callPayload.callType == CallType.audio) ? 0 : 1,
      duration: 45000,
    );
    await FlutterCallkitIncoming.showCallkitIncoming(params);
  }
}
```

### Accept/Decline via CallKit events

```dart
FlutterCallkitIncoming.onEvent.listen((CallEvent? callEvent) {
  switch (callEvent?.event) {
    case Event.actionCallAccept:
      VoipNotificationHandler.acceptVoipCall(callEvent, context);
      break;
    case Event.actionCallDecline:
      VoipNotificationHandler.declineVoipCall(callEvent);
      break;
    case Event.actionCallTimeout:
    case Event.actionCallEnded:
      VoipNotificationHandler.endCall(sessionId: callEvent?.body['id']);
      break;
  }
});
```

## Local Notification Display

Uses `flutter_local_notifications` with inbox-style grouping per conversation:

```dart
// Skip if user is viewing the same conversation
if (conversationId == notifConversationId) return;

// Skip call-type notifications (handled by CallKit)
if (data["type"] == "call") return;

// Show with stable ID per conversation (replaces previous)
final notificationId = conversationId.hashCode;
await flutterLocalNotificationsPlugin.show(notificationId, title, body, details, payload: jsonPayload);
```

## Tap-to-Navigate

```dart
static void handleNotificationTap(NotificationResponse? response) async {
  if (response?.payload != null) {
    final body = jsonDecode(response!.payload!);
    NotificationDataModel model = NotificationDataModel.fromJson(body);

    User? user; Group? group;
    if (model.receiverType == "user") {
      user = await CometChat.getUser(model.sender);
    } else {
      group = await CometChat.getGroup(model.receiver);
    }

    if (model.type == "chat" && (user != null || group != null)) {
      Navigator.of(CallNavigationContext.navigatorKey.currentContext!).push(
        MaterialPageRoute(builder: (_) => MessagesSample(user: user, group: group)),
      );
    }
  }
}
```

## Terminated State Handling

```dart
// In main()
final launchDetails = await flutterLocalNotificationsPlugin.getNotificationAppLaunchDetails();
if (launchDetails?.didNotificationLaunchApp == true) {
  NotificationLaunchHandler.pendingNotificationResponse = launchDetails!.notificationResponse;
}

// In dashboard initState()
Future.delayed(Duration(milliseconds: 300), () {
  final response = NotificationLaunchHandler.pendingNotificationResponse;
  if (response != null) {
    NotificationLaunchHandler.pendingNotificationResponse = null;
    LocalNotificationService.handleNotificationTap(response, isTerminatedState: true);
  }
});
```

## Logout — Unregister Token

```dart
PNRegistry.unregisterPNService();
// Then: CometChatUIKit.logout(...)
```

## Checklist — Push Notifications

- [ ] Firebase initialized before CometChat init
- [ ] FCM token registered via `PNRegistry.registerPNService(token, true, false)`
- [ ] APNs device + VoIP tokens registered on iOS
- [ ] Background handler is top-level `@pragma('vm:entry-point')` function
- [ ] Token refresh listener re-registers token
- [ ] Local notifications skip current active conversation
- [ ] Call notifications handled via `FlutterCallkitIncoming`, not local notifications
- [ ] Tap-to-navigate uses `CallNavigationContext.navigatorKey.currentContext`
- [ ] Tokens unregistered on logout via `PNRegistry.unregisterPNService()`
- [ ] Terminated state launch handled via `NotificationLaunchHandler`
