---
name: cometchat-android-v6-core
description: "CometChat Android UIKit v6 core setup — Gradle dependencies, SDK initialization, login/logout, and message sending"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "shell, file-read, file-search, file-list"
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

**Add these three lines to `gradle.properties` at the project root** before any UI Kit code is wired in:

```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
android.useAndroidX=true
android.enableJetifier=true
```

All three are **mandatory**. Jetifier rewrites the legacy `android.support.*` references in the CometChat SDK's transitive deps to their `androidx.*` equivalents at build time, so the duplicate-class error doesn't happen.

**Why the heap setting matters (F47, 2026-05-22)**: a fresh Android Studio scaffold's default `org.gradle.jvmargs=-Xmx2048m` is **insufficient** when calls features are enabled — `com.cometchat:calls-sdk-android:4.+` transitively pulls `react-native` and other heavy deps that Jetifier has to rewrite. The first `assembleDebug` OOMs partway through with `OutOfMemoryError: Java heap space`. Bumping to `4096m` + `MaxMetaspaceSize=1024m` is the validated minimum. If you skip this, the customer sees a confusing mid-build crash with no actionable error.

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

## Visual Builder integration

> **⚠ The Visual Builder emits V5-shaped code.** The canonical builder repo at the Android Visual Builder ZIP (download from https://preview.cometchat.com/downloads/cometchat-builder-android.zip) uses `com.cometchat:chat-uikit-android:5.2.6` — the **V5** Android UI Kit. There is no V6-native Visual Builder canonical from vendor side yet ([F22 finding, 2026-05-22](https://github.com/cometchat/cometchat-skills/issues)). When a V6 project picks the Visually path, skills emits V5 deps (`chat-uikit-android:5.+`) into `app/build.gradle` — your V6 Compose / Kotlin Views code in the rest of the project is untouched, but the Visual-Builder-emitted screens are V5-flavored. Treat as transitional until vendor publishes a V6 canonical. V6 customers preferring a single-version dep tree should use the In-code path.
>
> The recipe below is identical to what `cometchat-android-v5-core` §"Visual Builder integration" prescribes (both reference the same canonical). This page kept for V6 customers who still hit the Visually flow.

When the dispatcher's Step 3.1 sets `customize=visual` and the platform resolves to `android`, skills runs **`cometchat builder export --platform android`** — a single CLI command that downloads the canonical static template ZIP from `preview.cometchat.com/downloads/cometchat-builder-android.zip`, fetches the per-builder settings JSON, applies F3 + F10 missing-field defaults, and writes 2 files to `--output` (default: `cometchat/`):

- `BuilderSettingsHelper.kt` — verbatim helper (with original `package com.cometchat.builder` declaration; **skills patches the package to the customer's app package** before final placement at `app/src/main/java/<package>/cometchat/`)
- `cometchat-builder-settings.json` — **envelope-shape JSON** `{ builderId, name, settings: {...} }` (no sentinel — JSON forbids `//` comments)

### 1. Run `cometchat builder export`

```bash
cometchat builder export --platform android --json
```

Defaults to `--output cometchat/`. The CLI emits the helper with the original `com.cometchat.builder` package declaration. **You must then move the files** to the customer's project + rewrite the package, per the table below:

### 2. Place + patch (after `builder export`)

| Source (from `--output`) | Destination | Notes |
|---|---|---|
| `cometchat/cometchat-builder-settings.json` | `app/cometchat-builder-settings.json` | Move to app module root (sibling of `build.gradle.kts`). The Gradle plugin requires the envelope shape — already provided by the CLI. |
| `cometchat/BuilderSettingsHelper.kt` | `app/src/main/java/<customer-package>/cometchat/BuilderSettingsHelper.kt` | **Move + 3 transforms** — see F50/F51 below. |
| `cometchat/font/*` | `app/src/main/res/font/*` | 12 font files (Arial / Inter / Roboto / Times — regular/medium/bold). Auto-emitted by `builder export --platform android` since F48 (2026-05-22). Just move them. |
| (skills-emitted, not from ZIP) | `app/src/main/java/<customer-package>/cometchat/CometChatApp.kt` | Compose wrapper that mounts kit View components via `AndroidView` and applies `BuilderSettingsHelper.applySettings*` to each |

#### F50 + F51 — BuilderSettingsHelper.kt requires 3 transforms on move (NON-NEGOTIABLE)

After moving `cometchat/BuilderSettingsHelper.kt` to
`app/src/main/java/<customer-package>/cometchat/BuilderSettingsHelper.kt`,
the file needs these 3 transforms before it compiles:

**1. Rewrite the package line:**

```kotlin
package com.cometchat.builder            // before
package com.example.myapp.cometchat      // after (match customer's applicationId + .cometchat suffix)
```

**2. Add 3 explicit imports** under the existing import block:

```kotlin
import com.cometchat.builder.CometChatBuilderSettings    // auto-generated constants class — stays at original package
import com.example.myapp.BuildConfig                      // customer's BuildConfig — must use their applicationId
import com.example.myapp.R                                // customer's R class — same applicationId
```

Without these, the file fails to compile with `Unresolved reference 'R'`, `Unresolved reference 'BuildConfig'`, `Unresolved reference 'CometChatBuilderSettings'`. (When the file was in the original `com.cometchat.builder` package, these resolved implicitly via same-package; after the rewrite, they need explicit imports.)

**3. Strip the entire `applySettingsToBottomNavigationView` method** (per README option 2 — skills doesn't emit the bottom-nav shape). The method references `R.id.nav_chats`, `R.id.nav_calls`, `R.id.nav_users`, `R.id.nav_groups` which don't exist in the customer's `res/menu/`. Removing the method removes the references.

```kotlin
// Delete the entire function from `fun applySettingsToBottomNavigationView(...)` to its closing `}` —
// roughly lines 27-54 in the canonical file. Leave a comment in its place so future readers
// understand why:
//
//   // applySettingsToBottomNavigationView removed per cometchat-android-v6-core
//   // SKILL.md (README option 2 — no bottom-nav module in app integration).
```

Validated on `/Users/swapnil/Downloads/builder-demo/my-android-app/` 2026-05-25 — after all 3 transforms, `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL in 6s`. F50 + F51 findings.

The Gradle plugin REQUIRES the `{ builderId, settings: {...} }` envelope — writing the raw settings blob produces an empty `CometChatBuilderSettings` constants class and Kotlin compile fails with `Unresolved reference 'ChatFeatures'` / `'CallFeatures'`. The CLI always writes the envelope shape.

Resync = re-run `cometchat builder export --platform android --force`. Re-apply the move+package-rewrite each time (Skills should automate this in a future release).

### Files patched

| Path | Patch |
|---|---|
| `settings.gradle.kts` | Add `maven("https://dl.cloudsmith.io/public/cometchat/cometchat/maven/")` to BOTH `pluginManagement.repositories` AND `dependencyResolutionManagement.repositories` |
| `app/build.gradle.kts` | Add `id("com.cometchat.builder.settings") version "5.0.1"` to the `plugins { }` block. Add `implementation("com.cometchat:chat-uikit-android:5.1.+")`. Add `implementation("com.cometchat:calls-sdk-android:4.1.+")` if `cometchat-builder-settings.json` has any call feature enabled |
| `gradle.properties` | `android.useAndroidX=true` + `android.enableJetifier=true` per §1.3a (non-negotiable) |
| `AndroidManifest.xml` | Set `android:theme="@style/CometChat.Builder.Theme"` on `<application>`. Add `RECORD_AUDIO` + `CAMERA` permissions if any `CallFeatures.*` flag is true |
| `Application` subclass | Call `CometChatUIKit.init(this, uiKitSettings)` in `onCreate()` per §2 — credentials from `BuildConfig.COMETCHAT_*` via §1.4 |

### Init flow (build-time + runtime)

**Build time** — the Gradle plugin:
1. Reads `app/cometchat-builder-settings.json`
2. Generates `com.cometchat.builder.CometChatBuilderSettings` (typed Kotlin constants: `ChatFeatures.CoreMessagingExperience.PHOTOSSHARING`, `Style.Color.BRANDCOLOR`, etc.)
3. Injects style values into `@style/CometChat.Builder.Theme` so the kit's `CometChatTheme` resolves builder tokens automatically

**Runtime** — customer code accesses both:
```kotlin
import com.cometchat.builder.CometChatBuilderSettings       // generated by plugin
import <package>.cometchat.BuilderSettingsHelper            // copied helper

if (CometChatBuilderSettings.ChatFeatures.CoreMessagingExperience.PHOTOSSHARING) {
    // photo attachment enabled
}
BuilderSettingsHelper.applySettingsToMessageList(binding.messageList)
```

### The wrapper template

```kotlin
// app/src/main/java/<package>/cometchat/CometChatApp.kt
package <package>.cometchat

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.cometchat.chat.models.Group
import com.cometchat.chat.models.User
import com.cometchat.chatuikit.conversations.CometChatConversations
import com.cometchat.chatuikit.messagecomposer.CometChatMessageComposer
import com.cometchat.chatuikit.messageheader.CometChatMessageHeader
import com.cometchat.chatuikit.messagelist.CometChatMessageList

/**
 * Top-level chat surface emitted by the Visual Builder Visually path.
 *
 * Hosts the kit's View-based components via AndroidView; BuilderSettingsHelper
 * (copied from the builder repo) wires CometChatBuilderSettings → component
 * visibility on each instance.
 *
 * CometChatUIKit.init(...) must have been called in Application.onCreate()
 * BEFORE this composable mounts — see §2.
 */
@Composable
fun CometChatApp() {
    var selectedUser by remember { mutableStateOf<User?>(null) }
    var selectedGroup by remember { mutableStateOf<Group?>(null) }
    val hasSelection = selectedUser != null || selectedGroup != null

    if (!hasSelection) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                CometChatConversations(ctx).apply {
                    BuilderSettingsHelper.applySettingsToConversations(this)
                    setOnItemClickListener { _, conversation ->
                        when (val entity = conversation.conversationWith) {
                            is User -> { selectedUser = entity; selectedGroup = null }
                            is Group -> { selectedUser = null; selectedGroup = entity }
                        }
                    }
                }
            },
        )
        return
    }

    Column(Modifier.fillMaxSize()) {
        AndroidView(factory = { ctx ->
            CometChatMessageHeader(ctx).apply {
                user = selectedUser
                group = selectedGroup
                BuilderSettingsHelper.applySettingsToMessageHeader(this)
            }
        })
        AndroidView(modifier = Modifier.weight(1f), factory = { ctx ->
            CometChatMessageList(ctx).apply {
                user = selectedUser
                group = selectedGroup
                BuilderSettingsHelper.applySettingsToMessageList(this)
            }
        })
        AndroidView(factory = { ctx ->
            CometChatMessageComposer(ctx).apply {
                user = selectedUser
                group = selectedGroup
                BuilderSettingsHelper.applySettingsToMessageComposer(this)
            }
        })
    }
}
```

`BuilderSettingsHelper.kt` is copied verbatim from the builder repo. Methods used above:
- `applySettingsToConversations(...)` → user-status / receipts / search-box visibility
- `applySettingsToMessageHeader(...)` → voice/video call buttons + user-status visibility (group vs user-aware)
- `applySettingsToMessageList(...)` → edit/delete/reply-in-thread/reactions/translation/conversation-starter/smart-replies/message-privately visibility
- `applySettingsToMessageComposer(...)` → attachment/voice-note/poll/sticker/etc. visibility

For a Compose-native stack (`chatuikit-compose-android` instead of `chatuikit-android` Views), skip the `AndroidView` + `BuilderSettingsHelper` indirection and read `CometChatBuilderSettings.ChatFeatures.*` constants directly into the Compose components' visibility/feature props — see `cometchat-android-v6-compose-components`. The Views-via-AndroidView path above matches the canonical builder repo, which is Views-based.

### Calls + builder

If any `CometChatBuilderSettings.CallFeatures.*` flag is true:
1. Init Calls SDK in `Application.onCreate()` alongside UI Kit (see `cometchat-android-v6-calls`)
2. Mount `CometChatIncomingCall` overlay — the builder repo's `BuilderApplication.kt` registers `ActivityLifecycleCallbacks` and shows a `Snackbar`-hosted incoming-call view at the top of the foreground activity. Copy that pattern verbatim from `chat-builder/src/main/java/com/cometchat/builder/utils/BuilderApplication.kt` (inside the Android Visual Builder ZIP at https://preview.cometchat.com/downloads/cometchat-builder-android.zip)
3. FCM data-message wiring — defer to `cometchat-android-v6-push`

### What is NOT honored in v1

The builder repo's `HomeActivity` exposes a `BottomNavigationView` with up to 4 tabs (Chats / Calls / Users / Groups) driven by `CometChatBuilderSettings.Layout.TABS`. Skills emits a single Compose conversations surface, not the tabbed shape. The corresponding `applySettingsToBottomNavigationView` method is also **intentionally removed** when emitting `BuilderSettingsHelper.kt` (per README option 2). Theme + typography + chat-feature toggles ARE honored. For the full tabbed shape, copy the builder repo's `HomeActivity` + per-tab fragments alongside skills' emission (or use README option 1 — "Import as module").
