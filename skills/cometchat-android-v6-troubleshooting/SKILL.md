---
name: cometchat-android-v6-troubleshooting
description: "CometChat Android UIKit v6 troubleshooting — diagnostic table, common issues, and fixes for both Kotlin Views and Compose stacks"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.1"
  tags: "cometchat, android, troubleshooting, debugging, errors, issues"
---

> **Ground truth:** `com.cometchat:chatuikit-{compose,kotlin}-android:6.x` (+ `calls-sdk-android:5.x`) — resolved AAR (javap) + `ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

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
| Calls broken on `chatuikit:6.0.0` (call button targets wrong user, in-call screen blank, etc.) | Known v6.0.0 calls defects — `CometChatCallButtons` captures the first-rendered user globally + 4 related bugs | Apply the **5 documented workarounds (W1–W5)** in `cometchat-android-v6-calls` (§"Five required workarounds"). The kit ships broken for calls at 6.0.0 but works end-to-end with W1–W5 (validated on device). Don't hand-patch blind — use that section. |
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

### 5.0 No notifications shown on Android 13+ (API 33+)

- **Symptom**: FCM messages arrive (visible in logcat) but no system notification appears on Android 13+.
- **Cause**: `POST_NOTIFICATIONS` is a **runtime** permission on API 33+ — declaring it in the manifest isn't enough.
- **Fix**: Declare `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` AND request it at runtime (`ActivityCompat.requestPermissions(...)` / the Activity Result API) before you expect notifications. Below API 33 it's granted implicitly.

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

> ⚠️ **`CometChatVoIP` is NOT a v6 kit/SDK API.** It exists only as an app-local helper in the **V5** sample app; the v6 sample even asserts it must not be referenced (`PreservationPropertyTest.kt:78`). Check the permissions directly with `ContextCompat.checkSelfPermission` (or copy the V5 helper into your project if you want its convenience wrappers):

```kotlin
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import android.Manifest

// All three permissions are required for VoIP calling
fun hasVoipPermissions(context: Context): Boolean {
    val needed = listOf(
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.MANAGE_OWN_CALLS,
        Manifest.permission.ANSWER_PHONE_CALLS,
    )
    return needed.all {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }
}
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
