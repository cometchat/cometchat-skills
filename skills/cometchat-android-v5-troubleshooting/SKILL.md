---
name: cometchat-android-v5-troubleshooting
description: "Diagnose and fix problems with a CometChat Android integration. Gradle errors, runtime crashes, rendering issues, and version compatibility."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, grepSearch"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat android troubleshooting fix diagnose errors crashes gradle proguard"
---

> **Companion skills:** `cometchat-android-v5-core` covers correct init/login patterns;
> `cometchat-android-v5-production` covers ProGuard rules.

## Purpose

This skill teaches how to diagnose CometChat Android integration problems systematically. It covers Gradle build errors, runtime crashes, rendering issues, and version compatibility.

---

## Use this skill when

- "CometChat isn't working"
- "I'm getting a build error"
- "The chat screen is blank"
- "Messages aren't loading"
- Gradle sync failures
- Runtime crashes with CometChat in the stack trace

## Do not use this skill when

- Setting up a new integration → use `cometchat-android-v5-core`
- Customizing appearance → use `cometchat-android-v5-theming`

---

## 1. Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `Could not resolve com.cometchat:chat-uikit-android` | Missing Maven repo | Add `maven { url "https://dl.cloudsmith.io/public/cometchat/cometchat/maven/" }` to repositories |
| `Duplicate class com.cometchat.*` | Multiple CometChat versions | Check dependency tree: `./gradlew app:dependencies` |
| Blank conversation list | Not logged in, or no conversations exist | Verify `getLoggedInUser() != null`. Send a test message from dashboard. |
| `CometChatException: ERR - Authentication null` | `init()` not called or failed | Call `init()` before `login()`. Check `isSDKInitialized()`. |
| `CometChatException: appIdErr` | App ID not set in UIKitSettings | Verify `setAppId()` in UIKitSettingsBuilder |
| Components show but no data | Login succeeded but wrong region | Verify region matches dashboard: `"us"`, `"eu"`, `"in"` |
| `ClassNotFoundException` in release build | ProGuard stripping CometChat classes | Add `-keep class com.cometchat.** { *; }` to proguard-rules.pro |
| `UnsupportedOperationException: Failed to resolve attribute` when inflating CometChat views | App theme inherits `Theme.AppCompat.*` or `Theme.Material3.*` — the kit's attrs are resolved against Material 2 (`CometChatTheme.DayNight` itself parents on `Theme.MaterialComponents.DayNight.NoActionBar`) | Change app theme parent to `CometChatTheme.DayNight` |
| `NetworkOnMainThreadException` | Calling CometChat sync methods on main thread | Use callbacks (all CometChat methods are async) |
| `minSdkVersion 21` error | CometChat requires API 24+ | Set `minSdkVersion 24` in build.gradle |
| Message list shows wrong messages | `setUser()`/`setGroup()` called with wrong object | Verify UID/GUID matches the intended conversation |
| Calling buttons not showing | Calling SDK not added | Add `com.cometchat:calls-sdk-android:4.+` dependency |
| `java.lang.NoSuchMethodError` | Version mismatch between UI Kit and Chat SDK | Use compatible versions — UI Kit 5.x requires Chat SDK 4.x |

---

## 2. Diagnostic steps

1. **Check init:** `CometChatUIKit.isSDKInitialized()` — must be `true`
2. **Check login:** `CometChatUIKit.getLoggedInUser()` — must not be `null`
3. **Check Gradle:** `./gradlew app:dependencies | grep cometchat` — verify versions
4. **Check manifest:** Verify `INTERNET` permission
5. **Check region:** Must match dashboard exactly
6. **Check logs:** Filter logcat for `CometChat` tag

---

## Hard rules

- **Always check init + login first.** 90% of "it's not working" issues are init/login failures.
- **Never guess at the cause.** Check logcat, check the dependency tree, check the dashboard.
- **ProGuard is the #1 release-build issue.** Always add keep rules before the first release build.
