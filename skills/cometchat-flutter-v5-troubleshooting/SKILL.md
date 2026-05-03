---
name: cometchat-flutter-v5-troubleshooting
description: "Use when debugging CometChat Flutter UIKit v5 issues. Symptom-to-cause lookup, verify checks, common errors, drift detection."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_calls_uikit ^5.0.15; cometchat_uikit_shared ^5.2.3"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 troubleshooting debug errors fix"
---

# CometChat Flutter UIKit v5 — Troubleshooting

Symptom-to-cause lookup and verification checks.

## Init / Login Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Authentication null" | `CometChatUIKit.init()` not called | Call init before login/components |
| "APP ID null" | appId not set in UIKitSettingsBuilder | Set `..appId = 'YOUR_APP_ID'` |
| Login hangs silently | `init()` hasn't completed yet | Await init completion via `onSuccess` before calling login |
| "ERR_INVALID_REGION" | Uppercase region | Use lowercase: `'us'`, `'eu'`, `'in'` |
| Login succeeds but no messages load | `subscriptionType` not set | Set `..subscriptionType = CometChatSubscriptionType.allUsers` |

## UI / Layout Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Theme jank during keyboard animation | `CometChatThemeHelper.getColorPalette(context)` called in `build()` | Cache in `didChangeDependencies()` |
| Components don't reflect theme changes | Using `_themeInitialized` flag | Remove flag — cache unconditionally in `didChangeDependencies()` |
| Hardcoded colors don't match dark mode | Using `Color(0xFF...)` instead of theme tokens | Use `colorPalette.primary`, `colorPalette.textPrimary`, etc. |
| `colorPalette.white` doesn't change in dark mode | `white`/`black`/`transparent` are NOT brightness-aware | Use `colorPalette.neutral50` for brightness-aware white |

## GetX Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "GetX controller not found" | Using `Get.find()` before `Get.put()` | Let UIKit components manage their own controllers |
| Controller not disposed | Manually created controller without cleanup | Use `controllerTag` or let widget manage lifecycle |
| Multiple controller instances | Creating controller outside the widget | Let the widget's `initState()` handle `Get.put()` |
| `Get.delete()` throws | Deleting controller that was created with `controllerTag` | Only delete if `controllerTag` was null (widget-managed) |

## Listener / Event Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Duplicate events firing | Listener not removed in `dispose()` | Always remove with same ID used to register |
| Listener ID collision | Hardcoded listener ID string | Use timestamp: `'id_${DateTime.now().millisecondsSinceEpoch}'` |
| No typing indicators | `subscriptionType` not set | Set `CometChatSubscriptionType.allUsers` |
| No online/offline status | `subscriptionType` not set | Same fix |
| `ccMessageSent` not firing | Using `CometChat.sendMessage()` directly | Use `CometChatUIKit.sendTextMessage()` instead |
| Events fire after screen disposed | Listener not removed | Remove in `dispose()` / `onClose()` |

## Call Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Incoming call overlay doesn't show | `CallNavigationContext.navigatorKey` not set | Set on `MaterialApp.navigatorKey` |
| Call buttons don't appear | `CometChatCallingExtension` not registered | Set `..callingExtension = CometChatCallingExtension()` on UIKitSettingsBuilder |
| Call fails silently | Camera/microphone permissions not granted | Request `Permission.camera` and `Permission.microphone` |
| Incoming calls not handled | Call listener not registered globally | Register `CallListener` + `CometChatCallEventListener` at dashboard level |

## Push Notification Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| No push notifications | Token not registered | Call `PNRegistry.registerPNService(token, isFcm, isVoip)` |
| Notifications after logout | Token not unregistered | Call `PNRegistry.unregisterPNService()` before logout |
| Duplicate notifications | Foreground notification shown for active conversation | Check `conversationId` match before showing |
| VoIP call notification doesn't show | Background handler not top-level | Use `@pragma('vm:entry-point')` on top-level function |
| Tap doesn't navigate | `CallNavigationContext.navigatorKey.currentContext` is null | Ensure `navigatorKey` is set on MaterialApp |
| iOS VoIP token not registered | Missing VoIP background mode | Enable Voice over IP in Xcode Background Modes |

## Android Build Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Release build crash | Missing ProGuard keep rules | Add `-keep class com.cometchat.** { *; }` |
| Build fails with minSdk error | minSdk too low | Set `minSdk 26` in `android/app/build.gradle` |
| AndroidX conflict | Missing AndroidX migration | Set `android.useAndroidX=true` in `gradle.properties` |

## iOS Build Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Camera/mic permission crash | Missing Info.plist entries | Add `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` |
| Pod install fails | Cocoapods version mismatch | Run `pod repo update` then `pod install` |

## Callback Signature Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| Type error on `CometChatUsers.onItemTap` | Missing `BuildContext` parameter | Signature is `Function(BuildContext, User)?` |
| Type error on `CometChatGroups.onItemTap` | Missing `BuildContext` parameter | Signature is `Function(BuildContext, Group)?` |
| Type error on `CometChatConversations.onItemTap` | Extra `BuildContext` parameter | Signature is `Function(Conversation)?` — no BuildContext |
| Type error on `CometChatGroupMembers.onItemTap` | Extra `BuildContext` parameter | Signature is `Function(GroupMember)?` — no BuildContext |

## v5 vs v6 Drift Detection

If you see any of these in a v5 project, it's a v6 pattern that was accidentally used:

| v6 Pattern (wrong in v5) | v5 Equivalent |
|--------------------------|---------------|
| `import 'package:flutter_bloc/flutter_bloc.dart'` | GetX — no BLoC in v5 |
| `extends Bloc<Event, State>` | `extends GetxController` |
| `extends Equatable` | Not used in v5 |
| `ServiceLocator.get<T>()` | `Get.find<T>()` or let widget manage |
| Single `cometchat_chat_uikit` with calls built-in | Separate `cometchat_calls_uikit` package |
| Per-widget feature flags only — no `BuilderSettings` | `BuilderSettings`, `BuilderColor`, `BuilderTypography` |
| `enableCalls: true` + `CallingConfiguration()` on UIKitSettingsBuilder | `..callingExtension = CometChatCallingExtension()` |

## Verify Checklist

Run through this when something isn't working:

- [ ] `CometChatUIKit.init()` completes before any other CometChat call
- [ ] `subscriptionType` set in UIKitSettingsBuilder
- [ ] `region` is lowercase
- [ ] Theme cached in `didChangeDependencies()`, not `build()`
- [ ] All listeners registered with unique IDs
- [ ] All listeners removed in `dispose()` / `onClose()`
- [ ] `CallNavigationContext.navigatorKey` set on MaterialApp
- [ ] `CometChatCallingExtension()` set if using calls
- [ ] Push tokens registered after login
- [ ] Push tokens unregistered before logout
- [ ] ProGuard rules present for release builds
- [ ] No v6 imports (`flutter_bloc`, `equatable`, `BlocProvider` / `BlocBuilder`)
