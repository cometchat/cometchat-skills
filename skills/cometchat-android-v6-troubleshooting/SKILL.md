---
name: cometchat-android-v6-troubleshooting
description: "CometChat Android UIKit v6 troubleshooting — diagnostic table, common issues, and fixes for both Kotlin Views and Compose stacks"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.1"
  tags: "cometchat, android, troubleshooting, debugging, errors, issues"
---

> **Companion skills:** cometchat-android-v6-core (init/login), cometchat-android-v6-compose-theming, cometchat-android-v6-kotlin-theming, cometchat-android-v6-push

## Purpose

Diagnose and fix common issues with CometChat Android UIKit v6 across both Kotlin Views and Jetpack Compose stacks.

## Use this skill when

- Encountering errors during SDK initialization or login
- Components not rendering or displaying incorrectly
- Push notifications not working
- Call features not functioning
- Build or dependency issues

## Do not use this skill when

- Setting up a new project (use `cometchat-android-v6-core`)
- Looking for component APIs (use `cometchat-*-components`)

## 1. Diagnostic Table

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Authentication null` error on init | `UIKitSettings` not configured | Ensure `setAppId()` and `setRegion()` are called on builder |
| `APP ID null` error on init | Missing app ID | Call `setAppId("YOUR_APP_ID")` on `UIKitSettingsBuilder` |
| Login fails with auth error | Invalid authKey or UID | Verify authKey from CometChat dashboard; check UID exists |
| Components show no data | SDK not initialized or user not logged in | Check `CometChatUIKit.isSDKInitialized()` and `getLoggedInUser()` |
| Compose components crash | Missing `CometChatTheme {}` wrapper | Wrap all CometChat composables in `CometChatTheme {}` |
| Views theme colors wrong | XML attrs not set | Inherit Activity theme from `CometChatTheme.DayNight` (see `-kotlin-placement`); for brand colors override `cometchat*` attrs in the Activity theme or call `CometChatTheme.setPrimaryColor(...)` |
| `IllegalArgumentException: The style on this component requires your app theme to be Theme.MaterialComponents (or a descendant)` at `MaterialCardView.<init>` (typically from `CometChatConversations.<init>`) | Activity theme parent is `Theme.AppCompat.*` or `android:Theme.*` | Switch `themes.xml` parent to `CometChatTheme.DayNight` (NOT `Theme.MaterialComponents.*.Bridge` — Bridge drops Material widget defaults and triggers the `MaterialButton` crash below) |
| `UnsupportedOperationException: Failed to resolve attribute at index N` at `MaterialButton.<init>` (during inflate of kit-internal layout) | Activity theme is `Theme.MaterialComponents.*` (or `.Bridge`) but missing `cometchat*` attrs | Switch `themes.xml` parent to `CometChatTheme.DayNight` — the kit's own theme supplies every `cometchat*` attr its internal layouts reference |
| Dark mode not applied (Compose) | Using `lightColorScheme()` always | Use `if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()` |
| Dark mode not applied (Views) | Theme cache stale | Call `CometChatTheme.clearCache()` on configuration change |
| Messages not loading | User/Group not set on component | Call `setUser(user)` or pass `user` parameter before display |
| Push notifications not received | Missing `google-services.json` | Add file to app module root; verify Firebase project config |
| FCM token not registered | `onNewToken()` not called | Manually request token with `FirebaseMessaging.getInstance().token` |
| Call notifications not showing | VoIP permissions missing | Request READ_PHONE_STATE, MANAGE_OWN_CALLS, ANSWER_PHONE_CALLS |
| Calls SDK not initialized | `enableCalling` not set | Set `setEnableCalling(true)` on `UIKitSettingsBuilder` |
| `CometChatCalls` class not found | Missing calls SDK dependency | Add `com.cometchat:calls-sdk-android` to dependencies |
| Build fails with duplicate classes | Conflicting annotation libs | Add `exclude(group = "org.jetbrains", module = "annotations-java5")` to configurations |
| `compileSdk` error | SDK too low | Set `compileSdk = 36` |
| `minSdk` error | API level too low | Set `minSdk = 28` — v6 requires Android 9.0+ |
| Compose preview crashes | Missing preview data | Use the `preview/` package helpers for `@Preview` composables |
| WebSocket disconnects in background | No lifecycle management | Call `CometChat.connect()` on foreground, `disconnect()` on background |
| Recomposition issues | Unstable state in composables | Ensure state is hoisted properly; use `remember` and `derivedStateOf` |
| BubbleFactory not applied | Wrong factory key | Verify `getCategory()` and `getType()` match the message's category and type |
| Style not applied (Compose) | Using constructor instead of `default()` | Use `StyleClass.default(param = value)` not `StyleClass(...)` |

## 2. Initialization Issues

### 2.1 Verify SDK State

```kotlin
// Check initialization
Log.d("CometChat", "SDK initialized: ${CometChatUIKit.isSDKInitialized()}")
Log.d("CometChat", "Calls SDK initialized: ${CometChatUIKit.isCallsSDKInitialized()}")
Log.d("CometChat", "Logged in user: ${CometChatUIKit.getLoggedInUser()?.uid}")
```

### 2.2 Common Init Sequence Issues

```kotlin
// ❌ Wrong: init in every Activity
class ChatActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        CometChatUIKit.init(this, settings, callback) // DON'T DO THIS
    }
}

// ✅ Correct: init once in Application or splash
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        CometChatUIKit.init(this, settings, callback)
    }
}
```

## 3. Compose-Specific Issues

### 3.1 Missing Theme Wrapper

```kotlin
// ❌ Crash: CompositionLocal not provided
setContent {
    CometChatConversations() // Will crash or look wrong
}

// ✅ Correct
setContent {
    CometChatTheme {
        CometChatConversations()
    }
}
```

### 3.2 Nested Theme Wrappers

```kotlin
// ❌ Unnecessary nesting
CometChatTheme {
    NavHost(...) {
        composable("chat") {
            CometChatTheme { // Don't nest
                CometChatMessageList(user = user)
            }
        }
    }
}

// ✅ Single wrapper at top level
CometChatTheme {
    NavHost(...) {
        composable("chat") {
            CometChatMessageList(user = user)
        }
    }
}
```

## 4. Views-Specific Issues

### 4.1 Theme Attributes Not Resolving

```kotlin
// If colors are all 0/transparent, the XML attrs aren't set
// Fix: Set programmatically
CometChatTheme.setPrimaryColor(Color.parseColor("#6851D6"))
// Or add attrs to your Activity's theme in styles.xml
```

### 4.2 RecyclerView Scroll Issues

If message list doesn't scroll properly, ensure the layout gives it flexible height:

```xml
<!-- ✅ Use layout_weight for flexible height -->
<CometChatMessageList
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1" />
```

## 5. Push Notification Issues

### 5.1 SDK Not Initialized in FCM Service

```kotlin
// When app is killed and FCM wakes it, SDK may not be initialized
override fun onMessageReceived(message: RemoteMessage) {
    if (!CometChatUIKit.isSDKInitialized()) {
        // Cannot handle message — show basic notification or skip
        return
    }
    // Safe to proceed
}
```

### 5.2 VoIP Permission Check

```kotlin
// All three permissions are required for VoIP
val hasPermissions = CometChatVoIP.hasReadPhoneStatePermission(context) &&
    CometChatVoIP.hasManageOwnCallsPermission(context) &&
    CometChatVoIP.hasAnswerPhoneCallsPermission(context)
```

## 6. Dependency Conflicts

### 6.1 Jetbrains Annotations Conflict

```kotlin
// In build.gradle.kts
configurations.all {
    exclude(group = "org.jetbrains", module = "annotations-java5")
}
```

### 6.2 Maven Repository Missing

```kotlin
// In settings.gradle
repositories {
    maven { url = uri("https://dl.cloudsmith.io/public/cometchat/cometchat/maven/") }
}
```

## 7. Release-build Issues (R8 / ProGuard)

### 7.1 `ClassNotFoundException` on release builds

**Symptom:** App works in debug, crashes on release with `java.lang.ClassNotFoundException: com.cometchat.uikit.compose...` (or `kotlin...` package). R8 has stripped kit classes that look unused via reflection.

**Fix:** Add to `app/proguard-rules.pro`:

```proguard
# Keep all CometChat UIKit and chat-sdk classes
-keep class com.cometchat.** { *; }
-keepclassmembers class com.cometchat.** { *; }
-dontwarn com.cometchat.**
```

If you use the calls SDK, also add:

```proguard
-keep class io.dyte.** { *; }
-dontwarn io.dyte.**
```

### 7.2 `BuildConfig` field missing in release

**Symptom:** `BuildConfig.COMETCHAT_APP_ID` resolves to empty string in release. Caused by `local.properties` not being copied during CI builds.

**Fix:** Provide credentials via Gradle properties from CI environment vars instead of relying on `local.properties`:

```kotlin
// app/build.gradle.kts
android {
    defaultConfig {
        buildConfigField(
            "String", "COMETCHAT_APP_ID",
            "\"${project.findProperty("cometchat.appId") ?: System.getenv("COMETCHAT_APP_ID") ?: ""}\""
        )
        // …same for region + authKey
    }
}
```

In CI (e.g. GitHub Actions), set `COMETCHAT_APP_ID` etc. as repository secrets, not as files.

## Hard rules

- ALWAYS check `isSDKInitialized()` before making SDK calls in background services (FCM, VoIP)
- ALWAYS wrap Compose components in `CometChatTheme {}` — this is the #1 cause of Compose rendering issues
- Call `CometChatTheme.clearCache()` in Views when the theme changes dynamically
- Do NOT lower `minSdk` below 28 or `compileSdk` below 36
- When reporting bugs, include: SDK version, stack (Compose/Views), Android API level, and the full stack trace
