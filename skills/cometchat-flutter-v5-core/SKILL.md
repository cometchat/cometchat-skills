---
name: cometchat-flutter-v5-core
description: "Use when writing any code that uses CometChat Flutter UIKit v5 (cometchat_chat_uikit v5.2.14, cometchat_calls_uikit v5.0.15, cometchat_uikit_shared v5.2.3). Contains hard rules that prevent silent failures."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_calls_uikit ^5.0.15; cometchat_uikit_shared ^5.2.3; cometchat_sdk ^4.1.2; get ^4.6.5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 core rules init login logout lifecycle getx"
---

# CometChat Flutter UIKit v5 — Core Rules

Non-negotiable constraints for all CometChat UIKit v5 code. Violating these causes silent failures or crashes.

## Key v5 Architecture Facts

- State management: **GetX** (GetBuilder, GetxController, Get.put, Get.find, Get.delete)
- Separate packages: `cometchat_chat_uikit` + `cometchat_calls_uikit` + `cometchat_uikit_shared`
- SDK: `cometchat_sdk ^4.1.2` + `cometchat_calls_sdk ^4.2.2`
- **Imports — two barrels.** For chat-only projects: `package:cometchat_chat_uikit/cometchat_chat_uikit.dart`. For projects that also need voice/video calling: ADD `package:cometchat_calls_uikit/cometchat_calls_uikit.dart` as a SECOND import — the calls barrel re-exports shared + SDK only and does NOT re-export `cometchat_chat_uikit`. Chat widgets like `CometChatConversations`, `CometChatMessageList`, `CometChatMessageComposer` are reachable only through the chat barrel.
- `CometChatUIKit.login(uid)` takes a **String** directly (not an object)
- No ServiceLocator pattern — controllers are created via `Get.put()` internally
- Style classes use `ThemeExtension` with `merge()` pattern

## Rule: INIT_FIRST

`CometChatUIKit.init()` must complete before any login, component usage, or SDK call.

```dart
// ✅ CORRECT
final settings = (UIKitSettingsBuilder()
      ..appId = 'APP_ID'
      ..region = 'us'
      ..authKey = 'AUTH_KEY'
      ..subscriptionType = CometChatSubscriptionType.allUsers)
    .build();

CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) => debugPrint('Init done'),
  onError: (e) => debugPrint('Init failed: ${e.message}'),
);

// ❌ WRONG — login before init completes
CometChatUIKit.init(uiKitSettings: settings);
CometChatUIKit.login('uid'); // Race condition
```

## Rule: AUTH_CHECK_AFTER_INIT

After `CometChatUIKit.init()` completes, the static field `CometChatUIKit.loggedInUser` is populated if a cached session exists (init internally calls `getLoggedInUser()`). You can check it synchronously in `onSuccess`, or use `CometChatUIKit.getLoggedInUser()` for an explicit async check.

```dart
// ✅ CORRECT — synchronous check after init
CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) {
    final hasUser = CometChatUIKit.loggedInUser != null;
    // Route to home or login
  },
);

// ✅ ALSO CORRECT — explicit async check (used by master app)
CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) async {
    final user = await CometChatUIKit.getLoggedInUser();
    if (user != null) {
      await CometChatUIKit.login(user.uid, onSuccess: ...);
    }
  },
);
```

Note: `CometChatUIKit.login()` handles re-login gracefully — if the user is already logged in with the same UID, it returns the cached user without hitting the server.

## Rule: LISTENER_LIFECYCLE

SDK listeners MUST be registered with a unique ID in `initState()` (or GetxController `onInit()`) and removed in `dispose()` (or `onClose()`).

```dart
// ✅ CORRECT
class _MyScreenState extends State<MyScreen> with MessageListener {
  late final String _listenerId;

  @override
  void initState() {
    super.initState();
    _listenerId = 'my_screen_${DateTime.now().millisecondsSinceEpoch}';
    CometChat.addMessageListener(_listenerId, this);
  }

  @override
  void dispose() {
    CometChat.removeMessageListener(_listenerId);
    super.dispose();
  }
}

// ❌ WRONG — hardcoded ID causes collisions; missing dispose removal
CometChat.addMessageListener('messages', this); // Collision!
```

## Rule: THEME_CACHE

Cache theme values in `didChangeDependencies()` — unconditionally, no flag needed. Never call `CometChatThemeHelper.getColorPalette(context)` in `build()`.

`getColorPalette()` creates a new `CometChatColorPalette` object every call, resolving each token individually via `Theme.of(context)`. During keyboard animation, `MediaQuery` changes trigger rebuilds, making this expensive in `build()`.

```dart
// ✅ CORRECT — matches actual package pattern (no flag)
@override
void didChangeDependencies() {
  super.didChangeDependencies();
  colorPalette = CometChatThemeHelper.getColorPalette(context);
  spacing = CometChatThemeHelper.getSpacing(context);
  typography = CometChatThemeHelper.getTypography(context);
}

// ❌ WRONG — lookup in build causes jank
@override
Widget build(BuildContext context) {
  final colors = CometChatThemeHelper.getColorPalette(context); // Expensive!
  return Container(color: colors.primary);
}
```

Do NOT use a `_themeInitialized` flag — it prevents theme updates when the system switches between light/dark mode.

## Rule: SUBSCRIPTION_TYPE_REQUIRED

Omitting `subscriptionType` in `UIKitSettingsBuilder` silently disables all presence events (online/offline, typing indicators). No error is thrown.

```dart
// ✅ CORRECT
UIKitSettingsBuilder()
  ..subscriptionType = CometChatSubscriptionType.allUsers
```

## Rule: REGION_LOWERCASE

Region must be a lowercase string: `'us'`, `'eu'`, or `'in'`.

## Rule: MUID_PRESERVATION

When handling `ccMessageSent` events, compare by `muid` first, then `id` — the SDK may return an empty `muid` in the success callback.

## Pattern: Callback → Async Bridge (Completer)

```dart
import 'dart:async';

Future<bool> initAsync(UIKitSettings settings) {
  final completer = Completer<bool>();
  CometChatUIKit.init(
    uiKitSettings: settings,
    onSuccess: (_) => completer.complete(true),
    onError: (e) => completer.complete(false),
  );
  return completer.future;
}
```

## v5 Component Architecture Pattern (GetX)

```
{component}/
├── cometchat_{component}.dart              # StatefulWidget
├── cometchat_{component}_controller.dart   # extends GetxController
├── cometchat_{component}_style.dart        # ThemeExtension with merge()
└── {component}_builder_protocol.dart       # Request builder protocol
```

Internal lifecycle:
```dart
@override
void initState() {
  super.initState();
  tag = widget.controllerTag ?? 'default_tag_${DateTime.now().millisecondsSinceEpoch}';
  controller = Get.put<Controller>(Controller(...), tag: tag);
}

@override
void dispose() {
  if (widget.controllerTag == null) {
    Get.delete<Controller>(tag: tag);
  }
  super.dispose();
}
```

## Android Build Requirements

- `android.useAndroidX=true` and `android.enableJetifier=true` in `gradle.properties`
- `minSdk 26` in `android/app/build.gradle`
- ProGuard: `-keep class com.cometchat.** { *; }` and `-keep interface com.cometchat.** { *; }`

## Top 10 Error Debugging

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Authentication null" | `CometChatUIKit.init()` not called | Call init before login/components |
| "APP ID null" | appId not set in UIKitSettingsBuilder | Set `..appId = 'YOUR_APP_ID'` |
| No typing indicators / presence | `subscriptionType` not set | Set `..subscriptionType = CometChatSubscriptionType.allUsers` |
| Theme jank during keyboard | Theme looked up in `build()` | Cache in `didChangeDependencies()` |
| Listener leak / duplicate events | Listener not removed in `dispose()` | Always remove with same ID |
| GetX controller not found | Using `Get.find()` before `Get.put()` | Let UIKit components manage their own controllers |
| Region error | Uppercase region string | Use lowercase: 'us', 'eu', 'in' |
| Release build crash | Missing ProGuard keep rules | Add `-keep class com.cometchat.** { *; }` |

## Checklist — Every CometChat v5 Screen

- [ ] `CometChatUIKit.init()` called before any usage
- [ ] `subscriptionType` set in UIKitSettingsBuilder
- [ ] `region` is lowercase
- [ ] Theme cached in `didChangeDependencies()`, not `build()`
- [ ] SDK listeners registered with unique ID, removed in `dispose()`
- [ ] Colors from `CometChatThemeHelper`, never hardcoded
- [ ] Imports: `package:cometchat_chat_uikit/cometchat_chat_uikit.dart` always; ADD `package:cometchat_calls_uikit/cometchat_calls_uikit.dart` if you use voice/video
