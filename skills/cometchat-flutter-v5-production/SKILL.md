---
name: cometchat-flutter-v5-production
description: "Use when preparing a CometChat Flutter UIKit v5 app for production. Covers auth tokens, ProGuard, environment config, security hardening."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_calls_uikit ^5.0.15"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 production security auth tokens proguard environment"
---

# CometChat Flutter UIKit v5 — Production

Hardening a CometChat Flutter app for production deployment.

## Auth Tokens vs Auth Key

**Development:** `CometChatUIKit.login(uid)` uses `authKey` from `UIKitSettingsBuilder`. This is convenient but insecure — the authKey is embedded in the app binary.

**Production:** Use server-minted auth tokens via `CometChatUIKit.loginWithAuthToken(authToken)`:

```dart
// 1. Your backend generates an auth token via CometChat REST API
// POST https://{appId}.api-{region}.cometchat.io/v3/users/{uid}/auth_tokens
// Header: apiKey: YOUR_API_KEY

// 2. Your Flutter app receives the token and logs in
CometChatUIKit.loginWithAuthToken(authToken,
  onSuccess: (user) { ... },
  onError: (e) { ... },
);
```

This keeps the API key on your server, never in the client.

## Environment Configuration

Store credentials outside source code:

```dart
class AppCredentials {
  static String _appId = '';
  static String _authKey = '';
  static String _region = '';

  // Load from SharedPreferences, environment, or remote config
  static String get appId => _appId.isEmpty
      ? SharedPreferencesClass.getString('appId')
      : _appId;

  static Future<void> setAppId(String value) async {
    await SharedPreferencesClass.setString('appId', value);
    _appId = value;
  }
}
```

The master app supports QR code scanning to load credentials dynamically (`CometChatQRScreen`).

## Android Build Requirements

### gradle.properties

```properties
android.useAndroidX=true
android.enableJetifier=true
```

### minSdk 26

```groovy
// android/app/build.gradle
defaultConfig {
    minSdk 26  // Required by cometchat_calls_sdk
}
```

### ProGuard / R8 Keep Rules

Create `android/app/proguard-rules.pro`:

```
-keep class com.cometchat.** { *; }
-keep interface com.cometchat.** { *; }
-dontwarn com.cometchat.calls.**
```

Reference in `build.gradle`:

```groovy
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### Signing

```groovy
signingConfigs {
    release {
        storeFile file('your_keystore.jks')
        storePassword 'STORE_PASSWORD'
        keyAlias 'KEY_ALIAS'
        keyPassword 'KEY_PASSWORD'
    }
}
```

## iOS Build Requirements

### Info.plist Permissions

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access for video calls and photo sharing</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access for voice and video calls</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access for sharing images</string>
```

### Background Modes (for VoIP)

Enable in Xcode: Background Modes → Voice over IP, Remote notifications, Background fetch.

### Podfile

Ensure minimum iOS deployment target matches CometChat requirements.

## Firebase Setup

```dart
// In main(), before runApp:
await Firebase.initializeApp(
  options: DefaultFirebaseOptions.currentPlatform,
);
```

### Crashlytics

```dart
FlutterError.onError = (errorDetails) {
  FirebaseCrashlytics.instance.recordFlutterFatalError(errorDetails);
};
PlatformDispatcher.instance.onError = (error, stack) {
  FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  return true;
};
```

## Push Notification Provider IDs

Configure provider IDs for FCM and APNs in the CometChat dashboard:

```dart
static String get fcmProviderId => 'your-fcm-provider-id';
static String get apnProviderId => 'your-apn-provider-id';
```

These must match what's configured in the CometChat dashboard under Notifications → Push Notifications.

## Demo Meta Info

For internal tracking (optional):

```dart
CometChat.setDemoMetaInfo(jsonObject: {
  "name": "flutter-sample-app",
  "type": "sample",
  "version": "5.2.11",
  "platform": "flutter",
});
```

## Logout Flow

```dart
// 1. Unregister push tokens
PNRegistry.unregisterPNService();

// 2. Sign out from Firebase/Google (if applicable)
await FirebaseAuth.instance.signOut();
await GoogleSignIn().signOut();

// 3. Logout from CometChat
await CometChatUIKit.logout(
  onSuccess: (_) { /* navigate to login */ },
  onError: (e) { /* show error */ },
);
```

## Checklist — Production

- [ ] Auth tokens minted server-side, not authKey in client
- [ ] Credentials not hardcoded in source (use SharedPreferences or remote config)
- [ ] ProGuard rules added for release builds
- [ ] minSdk 26 set
- [ ] iOS permissions in Info.plist
- [ ] Firebase Crashlytics configured
- [ ] Push notification provider IDs match CometChat dashboard
- [ ] Logout unregisters push tokens before CometChat logout
- [ ] Signing config set for release builds
