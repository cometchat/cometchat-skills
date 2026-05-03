---
name: cometchat-flutter-v5
description: "Use when building chat with CometChat Flutter UIKit v5 (cometchat_chat_uikit v5.2.14, cometchat_calls_uikit v5.0.15). Orchestrator skill that routes to feature-specific skills."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_calls_uikit ^5.0.15; cometchat_uikit_shared ^5.2.3; cometchat_sdk ^4.1.2; get ^4.6.5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 chat uikit messaging conversations getx"
---

# CometChat Flutter UIKit v5 — Orchestrator

Entry point skill for the CometChat UIKit v5 packages. Routes to feature skills based on context.

## Project Detection

Confirm the project uses CometChat UIKit v5 by checking `pubspec.yaml` for:

```yaml
dependencies:
  cometchat_chat_uikit: ^5.2.14
  cometchat_calls_uikit: ^5.0.15  # Optional, for calling features
```

The v5 uses **separate packages** (unlike v6 which bundles everything):
- `cometchat_chat_uikit` — Chat UI components
- `cometchat_calls_uikit` — Call UI components (re-exports `cometchat_uikit_shared` + `cometchat_sdk` + `cometchat_calls_sdk`; does NOT re-export `cometchat_chat_uikit`)
- `cometchat_uikit_shared` — Shared utilities

**Imports — two barrels, not one.** For chat-only apps, the chat barrel is sufficient. If you also need voice/video calls, add a SECOND import — the calls barrel does NOT re-export the chat barrel.

```dart
// Always:
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

// Add this only if your app uses calls:
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';
```

## Key v5 vs v6 Differences

| Aspect | v5 | v6 |
|--------|----|----|
| State management | GetX (GetBuilder, GetxController) | BLoC (Bloc, Equatable) |
| Packages | Separate (chat_uikit + calls_uikit) | Single (cometchat_chat_uikit) |
| Controllers | `Get.put()` internally | ServiceLocator pattern |
| SDK | `cometchat_sdk ^4.1.2` | `cometchat_sdk ^5.0.0` |

## Skill Routing

| User mentions | Route to skill |
|---------------|---------------|
| init, login, logout, UIKitSettings, setup, GetX, GetBuilder | `cometchat-flutter-v5-core` |
| theme, colors, dark mode, styling, CometChatColorPalette, merge() | `cometchat-flutter-v5-theming` |
| conversations, conversation list, recent chats | `cometchat-flutter-v5-conversations` |
| messages, message list, composer, compact composer, header, keyboard, threads | `cometchat-flutter-v5-messages` |
| users, groups, group members, contacts, CometChatChangeScope | `cometchat-flutter-v5-users-groups` |
| calls, voice call, video call, CometChatCallButtons, incoming call, call logs | `cometchat-flutter-v5-calls` |
| events, listeners, real-time, typing indicator, online status, receipts | `cometchat-flutter-v5-events` |
| custom bubbles, templates, DataSource, decorator, formatters, slot views, extensions | `cometchat-flutter-v5-customization` |
| push notifications, FCM, APNs, VoIP, token, firebase messaging, callkit | `cometchat-flutter-v5-push` |
| auth tokens, ProGuard, release build, security, environment, production | `cometchat-flutter-v5-production` |
| error, debug, not working, crash, fix, troubleshoot, verify | `cometchat-flutter-v5-troubleshooting` |

## Architecture Overview

The UIKit v5 follows a **GetX controller pattern**:

```
{component}/
├── cometchat_{component}.dart              # StatefulWidget
├── cometchat_{component}_controller.dart   # extends GetxController
├── cometchat_{component}_style.dart        # ThemeExtension with merge()
└── {component}_builder_protocol.dart       # Request builder protocol
```

## Golden Path — Minimal Chat App (v5)

```dart
import 'package:flutter/material.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
// Add the calls import only if your app uses voice/video calls:
// import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

const String appId = 'YOUR_APP_ID';
const String region = 'us';
const String authKey = 'YOUR_AUTH_KEY';

void main() => runApp(const MyApp());

class MyApp extends StatefulWidget {
  const MyApp({super.key});
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _initializing = true;
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _initCometChat();
  }

  void _initCometChat() {
    final settings = (UIKitSettingsBuilder()
          ..appId = appId
          ..region = region
          ..authKey = authKey
          ..subscriptionType = CometChatSubscriptionType.allUsers
          ..callingExtension = CometChatCallingExtension())
        .build();

    CometChatUIKit.init(
      uiKitSettings: settings,
      onSuccess: (_) {
        setState(() {
          _loggedIn = CometChatUIKit.loggedInUser != null;
          _initializing = false;
        });
      },
      onError: (e) {
        debugPrint('Init failed: ${e.message}');
        setState(() => _initializing = false);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: CallNavigationContext.navigatorKey,
      home: _initializing
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _loggedIn
              ? HomeScreen()
              : LoginScreen(),
    );
  }
}
```

Key points:
- Always import `package:cometchat_chat_uikit/cometchat_chat_uikit.dart` for chat widgets; add `package:cometchat_calls_uikit/cometchat_calls_uikit.dart` as a second import only when using calls
- `CometChatUIKit.login(uid)` takes a String directly
- `CallNavigationContext.navigatorKey` set on MaterialApp
- `CometChatCallingExtension()` set on UIKitSettingsBuilder
- `subscriptionType` always set

## Autonomous Mode

- If `pubspec.yaml` has `cometchat_chat_uikit` v5.x or `cometchat_calls_uikit` v5.x → proceed without asking
- If credentials exist in code → reuse them
- If user says "messages screen" → generate Scaffold + Header + List + Composer
- Always add `subscriptionType` to UIKitSettingsBuilder
- Always use `CometChatThemeHelper` for colors, never hardcode
- Always import from `cometchat_chat_uikit` barrel for chat widgets. Add `cometchat_calls_uikit` as a SECOND import for calls — never as a replacement (the calls barrel does not re-export chat).

## Android Build Requirements

- `android.useAndroidX=true` and `android.enableJetifier=true` in `gradle.properties`
- `minSdk 26` in `android/app/build.gradle`
- ProGuard: `-keep class com.cometchat.** { *; }`
