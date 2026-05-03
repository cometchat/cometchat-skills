---
name: cometchat-android-v6-core
description: "CometChat Android UIKit v6 core setup — Gradle dependencies, SDK initialization, login/logout, and message sending"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.1"
  tags: "cometchat, android, init, login, gradle, setup, core"
---

> **Companion skills:** cometchat (dispatcher), cometchat-android-v6-builder-settings (detailed UIKitSettings config), cometchat-android-v6-events (event system)

## Purpose

Set up CometChat Android UIKit v6 in a project: add Gradle dependencies, initialize the SDK, authenticate users, and send messages. This skill covers the shared `chatuikit-core` module that both Kotlin Views and Jetpack Compose stacks depend on.

## Use this skill when

- Adding CometChat to a new Android project
- Setting up Gradle dependencies for CometChat UIKit v6
- Initializing the CometChat SDK
- Implementing login, logout, or user creation
- Sending text, media, or custom messages via `CometChatUIKit`

## Do not use this skill when

- Configuring `UIKitSettings` in detail (use `cometchat-android-v6-builder-settings`)
- Working with UI components (use `cometchat-android-v6-kotlin-components` or `cometchat-android-v6-compose-components`)
- Handling events (use `cometchat-android-v6-events`)

## 1. Gradle Setup

### 1.1 Add the CometChat Maven Repository

In `settings.gradle` or `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://dl.cloudsmith.io/public/cometchat/cometchat/maven/") }
    }
}
```

### 1.2 Add Dependencies

Choose the stack you need in your module's `build.gradle.kts`:

```kotlin
// Jetpack Compose stack (includes core transitively)
implementation("com.cometchat:chatuikit-compose-android:6.0.0-beta2")

// Kotlin Views stack (includes core transitively)
implementation("com.cometchat:chatuikit-kotlin-android:6.0.0-beta2")

// Core only (no UI — for shared modules or custom UI)
implementation("com.cometchat:chatuikit-core-android:6.0.0-beta2")
```

### 1.3 SDK Requirements

```kotlin
android {
    compileSdk = 36
    defaultConfig {
        minSdk = 28
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
}
```

### 1.3a AndroidX + Jetifier (REQUIRED — non-negotiable)

The CometChat Chat SDK transitively depends on the legacy `com.android.support:support-compat` library. Modern Android Studio projects (Arctic Fox+) default to `androidx.core` instead. Without Jetifier, Gradle sees the same classes (`android.support.v4.os.ResultReceiver`, etc.) declared in both libraries and fails the build with:

```
Duplicate class android.support.v4.os.ResultReceiver$1 found in modules
  core-1.16.0.aar -> core-1.16.0-runtime (androidx.core:core:1.16.0)
  and support-compat-26.1.0.aar -> support-compat-26.1.0-runtime
  (com.android.support:support-compat:26.1.0)
```

**Add these two lines to `gradle.properties` at the project root** before any UI Kit code is wired in:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

Both are **mandatory**. Jetifier rewrites the legacy `android.support.*` references in the CometChat SDK's transitive deps to their `androidx.*` equivalents at build time, so the duplicate-class error doesn't happen.

A freshly-created Android Studio project usually has `android.useAndroidX=true` already (Arctic Fox+) but **Jetifier is OFF by default** since it's deprecated in newer SDK landscapes. Both V5 and V6 CometChat SDKs still need it. If `gradle.properties` doesn't have either line, append both. If it has `useAndroidX=true` but no Jetifier line, add the Jetifier line. Idempotent.

### 1.3b Annotation library exclude (REQUIRED — non-negotiable)

The CometChat Chat SDK transitively depends on `org.jetbrains:annotations-java5:17.0.0`, which collides with Kotlin stdlib's `org.jetbrains:annotations:23.0.0` and fails the build with:

```
Duplicate class org.jetbrains.annotations.ApiStatus$* found in modules
  annotations-23.0.0 (org.jetbrains:annotations:23.0.0)
  and annotations-java5-17.0.0 (org.jetbrains:annotations-java5:17.0.0)
```

**Add this block to `app/build.gradle.kts`** at the top level (sibling of the `android { }` and `dependencies { }` blocks), before any UI Kit code is wired in:

```kotlin
configurations.all {
    // CometChat SDK transitively pulls org.jetbrains:annotations-java5:17.0.0,
    // which collides with Kotlin stdlib's org.jetbrains:annotations:23.0.0.
    exclude(group = "org.jetbrains", module = "annotations-java5")
}
```

This is mandatory for both V5 and V6, both Compose and Kotlin Views. Idempotent — if the block already exists, leave it.

### 1.4 Credentials → `local.properties` → `BuildConfig`

V6 has no runtime `.env` lookup; credentials are injected at compile time as `BuildConfig` fields. Do NOT hardcode App ID / Region / Auth Key in source files.

**Step 1.** Put credentials in `local.properties` (project root, gitignored by default in every Android Studio template):

```properties
cometchat.appId=<APP_ID>
cometchat.region=<REGION>
cometchat.authKey=<AUTH_KEY>
```

**Step 2.** In `app/build.gradle.kts`, read those properties and surface them as `BuildConfig` fields:

```kotlin
import java.util.Properties

val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    defaultConfig {
        buildConfigField("String", "COMETCHAT_APP_ID",   "\"${localProps.getProperty("cometchat.appId", "")}\"")
        buildConfigField("String", "COMETCHAT_REGION",   "\"${localProps.getProperty("cometchat.region", "")}\"")
        buildConfigField("String", "COMETCHAT_AUTH_KEY", "\"${localProps.getProperty("cometchat.authKey", "")}\"")
    }
    buildFeatures { buildConfig = true }
}
```

**Step 3.** In code, read `BuildConfig.COMETCHAT_APP_ID` etc.:

```kotlin
val settings = UIKitSettings.UIKitSettingsBuilder()
    .setAppId(BuildConfig.COMETCHAT_APP_ID)
    .setRegion(BuildConfig.COMETCHAT_REGION)
    .setAuthKey(BuildConfig.COMETCHAT_AUTH_KEY)   // dev only — drop for production
    .build()
```

If `npx @cometchat/skills-cli provision setup --framework android` ran first, it wrote a `.env` as a credentials handoff. Migrate those values into `local.properties` (above) and delete the `.env` — Android won't read it at runtime.

## 2. SDK Initialization

Initialize once in your `Application` class or splash screen — never in every Activity.

```kotlin
import com.cometchat.uikit.core.CometChatUIKit
import com.cometchat.uikit.core.UIKitSettings
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.exceptions.CometChatException

val settings = UIKitSettings.UIKitSettingsBuilder()
    .setAppId("YOUR_APP_ID")
    .setRegion("us") // "us" or "eu"
    .setAuthKey("YOUR_AUTH_KEY") // dev only — use token auth in production
    .build()

CometChatUIKit.init(context, settings, object : CometChat.CallbackListener<String>() {
    override fun onSuccess(result: String) {
        // SDK ready — proceed to login
    }
    override fun onError(e: CometChatException) {
        // Handle initialization error
    }
})
```

For calling features, enable them in settings:

```kotlin
val settings = UIKitSettings.UIKitSettingsBuilder()
    .setAppId("YOUR_APP_ID")
    .setRegion("us")
    .setAuthKey("YOUR_AUTH_KEY")
    .setEnableCalling(true) // Auto-initializes CometChatCalls SDK
    .build()
```

See `cometchat-android-v6-builder-settings` for all `UIKitSettingsBuilder` options.

## 3. Authentication

### 3.1 Login with UID (Development Only)

```kotlin
CometChatUIKit.login("user_uid", object : CometChat.CallbackListener<User>() {
    override fun onSuccess(user: User) {
        // User logged in — show chat UI
    }
    override fun onError(e: CometChatException) {
        // Handle login error
    }
})
```

### 3.2 Login with Auth Token (Production)

```kotlin
CometChatUIKit.loginWithAuthToken("auth_token_from_server",
    object : CometChat.CallbackListener<User>() {
        override fun onSuccess(user: User) {
            // User logged in
        }
        override fun onError(e: CometChatException) {
            // Handle error
        }
    }
)
```

### 3.3 Logout

```kotlin
CometChatUIKit.logout(object : CometChat.CallbackListener<String>() {
    override fun onSuccess(message: String) {
        // User logged out — navigate to login screen
    }
    override fun onError(e: CometChatException) {
        // Handle error
    }
})
```

### 3.4 Create User

```kotlin
val user = User().apply {
    uid = "new_user_uid"
    name = "New User"
}

CometChatUIKit.createUser(user, object : CometChat.CallbackListener<User>() {
    override fun onSuccess(createdUser: User) {
        // User created — now login
    }
    override fun onError(e: CometChatException) {
        // Handle error
    }
})
```

## 4. Utility Methods

```kotlin
// Check if SDK is initialized
val isReady = CometChatUIKit.isSDKInitialized()

// Check if Calls SDK is initialized (only if enableCalling = true)
val callsReady = CometChatUIKit.isCallsSDKInitialized()

// Get currently logged-in user (null if not logged in)
val currentUser: User? = CometChatUIKit.getLoggedInUser()

// Get current auth settings
val authSettings: UIKitSettings? = CometChatUIKit.getAuthSettings()

// Get conversation update settings
val convSettings = CometChatUIKit.getConversationUpdateSettings()
```

## 5. Sending Messages

`CometChatUIKit` provides convenience methods that automatically emit events via `CometChatEvents`:

### 5.1 Text Message

```kotlin
val textMessage = TextMessage("receiver_uid", "Hello!", CometChatConstants.RECEIVER_TYPE_USER)

CometChatUIKit.sendTextMessage(textMessage, object : CometChat.CallbackListener<TextMessage>() {
    override fun onSuccess(message: TextMessage) {
        // Message sent
    }
    override fun onError(e: CometChatException) {
        // Handle error
    }
})
```

### 5.2 Media Message

```kotlin
val mediaMessage = MediaMessage(
    "receiver_uid",
    file, // java.io.File
    CometChatConstants.MESSAGE_TYPE_IMAGE,
    CometChatConstants.RECEIVER_TYPE_USER
)

CometChatUIKit.sendMediaMessage(mediaMessage, object : CometChat.CallbackListener<MediaMessage>() {
    override fun onSuccess(message: MediaMessage) { }
    override fun onError(e: CometChatException) { }
})
```

### 5.3 Custom Message

```kotlin
val customMessage = CustomMessage(
    "receiver_uid",
    CometChatConstants.RECEIVER_TYPE_USER,
    "custom_type",
    JSONObject().put("key", "value")
)

CometChatUIKit.sendCustomMessage(customMessage, object : CometChat.CallbackListener<CustomMessage>() {
    override fun onSuccess(message: CustomMessage) { }
    override fun onError(e: CometChatException) { }
})
```

All send methods automatically:
1. Set `sender`, `muid`, and `sentAt` if not already set
2. Emit `CometChatMessageEvent.MessageSent` with `IN_PROGRESS` status
3. On success: emit with `SUCCESS` status
4. On error: embed error in metadata and emit with `ERROR` status

## Hard rules

- NEVER call `CometChatUIKit.init()` in every Activity — call it once in `Application.onCreate()` or a splash screen
- NEVER ship `authKey` in production builds — use `loginWithAuthToken()` with server-generated tokens
- ALWAYS check `isSDKInitialized()` before making SDK calls if initialization might not have completed
- `minSdk` must be 28 or higher — v6 does not support lower API levels
- `compileSdk` should be 36 for full compatibility
- Both UI stacks depend on `chatuikit-core` transitively — do NOT add core as a separate dependency when using a UI stack
- `gradle.properties` MUST contain `android.useAndroidX=true` AND `android.enableJetifier=true` — see § 1.3a. Without Jetifier, the build fails with "Duplicate class android.support.v4.os.ResultReceiver$1" because the CometChat SDK's transitive `com.android.support:support-compat` collides with `androidx.core` in any modern Android Studio project
