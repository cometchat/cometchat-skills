---
name: cometchat-android-v6-core
description: "CometChat Android UIKit v6 core setup — Gradle dependencies, SDK initialization, login/logout, and message sending"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 2.2.0+; AGP 8.9.1+; JDK 17; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x (+ chat-sdk-android:5.x). File-based init (CometChatUIKit.initFromSettings + app/src/main/assets/cometchat-settings.json — ENG-35866 Skills Telemetry) ships in chatuikit-*-android >= 6.0.2 GA on the public cometchat/cometchat Maven repo."
metadata:
  author: "CometChat"
  version: "3.0.1"
  tags: "cometchat, android, init, login, gradle, setup, core"
---

> **Ground truth:** `com.cometchat:chatuikit-compose-android:6.x` / `chatuikit-kotlin-android:6.x` (+ `chat-sdk-android:5.x`, `calls-sdk-android:5.x`) — `javap` the resolved AARs from the Gradle cache + `docs/ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the resolved AAR before relying on them.

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

Choose the stack you need in your module's `build.gradle.kts`. **Always resolve `6.0.+` (latest patch) — never hard-pin `6.0.0-beta2` or any earlier preview (ENG-35701).** V6 went GA on 2026-05-25; testers shipped with `-beta2` strings copy-pasted from older docs and missed two bug-fix patches. The dynamic `6.0.+` pin tracks GA forward without manual bumps.

```kotlin
// Jetpack Compose stack (includes core transitively)
implementation("com.cometchat:chatuikit-compose-android:6.0.+")

// Kotlin Views stack (includes core transitively)
implementation("com.cometchat:chatuikit-kotlin-android:6.0.+")

// Core only (no UI — for shared modules or custom UI)
implementation("com.cometchat:chatuikit-core-android:6.0.+")
```

### 1.3 SDK + toolchain Requirements

> **Toolchain floor (verified building `6.0.2` GA to an APK):** the kit's transitive deps are newer than a default Arctic-Fox-era scaffold, so a fresh project on older tooling fails to build. The build needs:
> - **AGP ≥ 8.9.1** and **`compileSdk = 36`** — `chatuikit-core` pulls `androidx.core:core(-ktx):1.18.0`, which refuses AGP 8.7.x / compileSdk 35 (`requires Android Gradle plugin 8.9.1 or higher` / `compile against version 36 or later`).
> - **Kotlin ≥ 2.2.0** — the kit classes ship **Kotlin 2.2.0 metadata**; on Kotlin 1.9 the build fails with `Class 'com.cometchat.uikit.core.CometChatUIKit' was compiled with an incompatible version of Kotlin … metadata version is 2.2.0, but the compiler version 1.9.0 can read versions up to 2.0.0`.

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

> ⚠️ **Toolchain floors — verified against the published `chatuikit-kotlin-android:6.0.1` in a real `./gradlew :app:assembleDebug` (do NOT understate these):**
> - **Kotlin ≥ 2.1.0** (NOT "1.9+"). The 6.0.1 kit classes carry Kotlin metadata 2.1.0 and pull `kotlin-stdlib` 2.2.x; a Kotlin 1.9.x or 2.0.x project fails `compileDebugKotlin` with ~20 errors: *"Class … was compiled with an incompatible version of Kotlin. The actual metadata version is 2.1.0, but the compiler … can read versions up to 2.0.0."*
> - **AGP ≥ 8.9.1.** The kit transitively pulls `androidx.core:1.18.0` (needs AGP 8.9.1+) and `androidx.lifecycle:…-compose:2.9.2` (needs 8.6.0+); on AGP 8.5.x a fresh project fails at `:app:checkDebugAarMetadata`. `compileSdk = 36` already implies a recent AGP.
> - **Gradle JVM = JDK 17.** AGP 8.9.1 rejects JDK 11/20 as the Gradle JVM in common configs; build with JDK 17. (`compileOptions`/`jvmTarget` above stay at 11 for *your* code — that's the source/bytecode target, distinct from the Gradle daemon's JVM.)
>
> A default Android Studio project on AGP 8.5.x + Kotlin 1.9/2.0 hits two hard failures before any CometChat code runs. Bump `settings.gradle`/`build.gradle` plugin versions to `com.android.application` ≥ 8.9.1 and `org.jetbrains.kotlin.android` ≥ 2.1.0.

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

**Why the heap setting matters (F47, 2026-05-22)**: a fresh Android Studio scaffold's default `org.gradle.jvmargs=-Xmx2048m` is **insufficient** when calls features are enabled — `com.cometchat:calls-sdk-android:5.0.+` (the V6 calls peer dep — see `cometchat-android-v6-calls` W1) transitively pulls `react-native` and other heavy deps that Jetifier has to rewrite. The first `assembleDebug` OOMs partway through with `OutOfMemoryError: Java heap space`. Bumping to `4096m` + `MaxMetaspaceSize=1024m` is the validated minimum. If you skip this, the customer sees a confusing mid-build crash with no actionable error.

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

### 1.3c App theme MUST extend `CometChatTheme.DayNight` (Kotlin Views — REQUIRED)

For the **Kotlin Views** stack, the app/activity theme must extend the kit's `CometChatTheme.DayNight` (parent `Theme.MaterialComponents.DayNight.NoActionBar`). The component layouts reference `cometchat*` theme attributes that only that theme defines — a plain `Theme.AppCompat` / `Theme.Material3` / bare `Theme.MaterialComponents` theme makes the **first component inflate crash** (`CometChatConversations` → `MaterialButton`/`MaterialCardView` → `UnsupportedOperationException: Failed to resolve attribute …` or `requires your app theme to be Theme.MaterialComponents`). A default `flutter create`-style or Empty-Activity scaffold does NOT use this theme, so set it explicitly.

```xml
<!-- app/src/main/res/values/themes.xml -->
<style name="AppTheme" parent="CometChatTheme.DayNight" />
```

```xml
<!-- AndroidManifest.xml → <application android:theme="@style/AppTheme"> -->
```

(Customizing colors/typography on top of this theme → `cometchat-android-v6-kotlin-theming`. The Compose stack themes via `CometChatTheme { }` composables instead — see `cometchat-android-v6-compose-theming`.) Verified by building + running on-device, 2026-06-11.

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

### File-based init with `cometchat-settings.json` (recommended)

> **Version requirement (ENG-35866 — Skills Telemetry).** `CometChatUIKit.initFromSettings(context, callback)` ships in **`chatuikit-{kotlin,compose}-android` ≥ `6.0.2` GA** on the public `cometchat/cometchat` Maven repo (pulls `chatuikit-core-android:6.0.2` + `chat-sdk-android:5.0.3`). It reads `app/src/main/assets/cometchat-settings.json` and lets the SDK self-report `integrationSource = "ai-agent"`. On an older kit (`< 6.0.2`) the method does not exist — use the **`UIKitSettingsBuilder` fallback** below.

**Step 1 — create `app/src/main/assets/cometchat-settings.json`** (create the `assets/` dir if it doesn't exist). Fill `appId` / `region` / `credentials.authKey`; leave everything else at the defaults below. These are the **same credentials** used everywhere else in the app — this file is the single source.

```json
{
  "appId": "APP_ID_HERE",
  "region": "us",
  "credentials": {
    "authKey": "AUTH_KEY_HERE"
  },
  "chatSDK": {
    "presenceSubscription": {
      "type": "ALL_USERS",
      "roles": []
    },
    "autoEstablishSocketConnection": true,
    "adminHost": null,
    "clientHost": null
  },
  "callsSDK": {
    "host": null,
    "adminHost": null,
    "clientHost": null,
    "callsHost": null
  },
  "uiKit": {
    "subscribePresenceForAllUsers": true
  }
}
```

> Do NOT gitignore `cometchat-settings.json` — the dev-mode `authKey` it holds is no more exposed than a `BuildConfig.COMETCHAT_AUTH_KEY` value.

**Step 2 — init in `Application.onCreate()`.** No `UIKitSettingsBuilder` — the SDK reads `app/src/main/assets/cometchat-settings.json` itself:

```kotlin
import com.cometchat.uikit.core.CometChatUIKit
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.exceptions.CometChatException

CometChatUIKit.initFromSettings(context, object : CometChat.CallbackListener<String>() {
    override fun onSuccess(result: String) {
        // SDK ready — proceed to login
    }
    override fun onError(e: CometChatException) {
        // Handle initialization error
    }
})
```

### `UIKitSettingsBuilder` init (fallback — any kit before `6.0.2`)

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
import com.cometchat.uikit.core.CometChatUIKit
import com.cometchat.chat.core.CometChat            // for CometChat.CallbackListener
import com.cometchat.chat.models.User
import com.cometchat.chat.exceptions.CometChatException

CometChatUIKit.login("user_uid", object : CometChat.CallbackListener<User>() {
    override fun onSuccess(user: User) {
        // User logged in — show chat UI
    }
    override fun onError(e: CometChatException) {
        // Handle login error
    }
})
```

> The login/logout/send snippets in §3 use `CometChat.CallbackListener` — its import (`com.cometchat.chat.core.CometChat`) is shown in the §2 init block but a fresh agent copying only a §3 block needs it too. The four imports above carry it; reuse them across §3.1–§3.4.

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

> ⚠️ **NAMESPACE WARNING (ENG-35698):** code below imports `com.cometchat.chatuikit.*` (the V5 namespace) because the Visual Builder canonical IS V5-shaped. **Do NOT copy these imports into your V6-native Compose / Kotlin Views code** — V6 Compose uses `com.cometchat.uikit.compose.*` and V6 Kotlin Views uses different module paths. The two namespaces export classes with identical short names but completely different APIs. If you're scaffolding a V6 chat surface elsewhere in the project, use the V6 paths from `cometchat-android-v6-compose-components` / `cometchat-android-v6-kotlin-components` — keep the Visual-Builder-emitted V5 `chat-uikit-android:5.+` module isolated to the screens it generates.

When the dispatcher's Step 3.1 sets `customize=visual` and the platform resolves to `android`, skills runs **`cometchat builder export --platform android`** — a single CLI command that downloads the canonical static template ZIP from `preview.cometchat.com/downloads/cometchat-builder-android.zip`, fetches the per-builder settings JSON, applies F3 + F10 missing-field defaults, and writes **3 files/dirs** to `--output` (default: `cometchat/`):

- `BuilderSettingsHelper.kt` — verbatim helper (with original `package com.cometchat.builder` declaration; **skills patches the package to the customer's app package** before final placement at `app/src/main/java/<package>/cometchat/`)
- `cometchat-builder-settings.json` — **envelope-shape JSON** `{ builderId, name, settings: {...} }` (no sentinel — JSON forbids `//` comments)
- `font/` — 12 font files (Arial / Inter / Roboto / Times — regular/medium/bold), moved to `app/src/main/res/font/` (see the Place + patch table)

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
| (skills-emitted, not from ZIP) | `app/src/main/java/<customer-package>/cometchat/MessagesActivity.kt` | **DEFAULT — Views/viewBinding `AppCompatActivity`** mirroring the canonical builder repo's `MessagesActivity` (which is pure Views, **zero Compose**). Mounts the kit's `CometChatMessageHeader` / `CometChatMessageList` / `CometChatMessageComposer` via viewBinding and applies `BuilderSettingsHelper.applySettingsTo*` to each. This is the canonical-matching surface — see "The default surface (Views)" below. |

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

Validated on a fresh builder-demo Android app (2026-05-25) — after all 3 transforms, `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL in 6s`. F50 + F51 findings.

The Gradle plugin REQUIRES the `{ builderId, settings: {...} }` envelope — writing the raw settings blob produces an empty `CometChatBuilderSettings` constants class and Kotlin compile fails with `Unresolved reference 'ChatFeatures'` / `'CallFeatures'`. The CLI always writes the envelope shape.

Resync = re-run `cometchat builder export --platform android --force`. Re-apply the move+package-rewrite each time (Skills should automate this in a future release).

### Files patched

| Path | Patch |
|---|---|
| `settings.gradle.kts` | Add `maven("https://dl.cloudsmith.io/public/cometchat/cometchat/maven/")` to BOTH `pluginManagement.repositories` AND `dependencyResolutionManagement.repositories` |
| `app/build.gradle.kts` | Add `id("com.cometchat.builder.settings") version "5.0.1"` to the `plugins { }` block. Add `implementation("com.cometchat:chat-uikit-android:5.2.6")` (the version the canonical builder app pins). Add `implementation("com.cometchat:calls-sdk-android:4.3.1")` if `cometchat-builder-settings.json` has any call feature enabled |
| `gradle.properties` | `android.useAndroidX=true` + `android.enableJetifier=true` per §1.3a (non-negotiable) |
| `AndroidManifest.xml` | Set `android:theme="@style/CometChat.Builder.Theme"` on `<application>`. Add `RECORD_AUDIO` + `CAMERA` permissions if any `CallFeatures.*` flag is true. **Do NOT hand-author that style** — the `generateBuilderThemeXml` Gradle task auto-writes `res/values/themes.xml` + `res/values-night/themes.xml` (defining `CometChat.Builder.Theme`) into the host module at build time; you only *reference* it here (authoring your own collides with the generated file). Verified live 2026-06-14. |
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

### The default surface (Views) — matches the canonical builder repo

The canonical builder repo (`chat-builder/` inside the Android Visual Builder ZIP) is **pure Views** — viewBinding + Activities/Fragments, **zero Compose**. Its `MessagesActivity` extends `AppCompatActivity`, inflates a viewBinding layout, sets `user`/`group` on the kit's View components, and calls `BuilderSettingsHelper.applySettingsTo*` on each. The default surface skills emits mirrors that shape so it drops into a Views-only host with no Compose build setup.

```kotlin
// app/src/main/java/<package>/cometchat/MessagesActivity.kt
package <package>.cometchat

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.cometchat.builder.BuilderSettingsHelper        // copied helper — stays at original package
import com.cometchat.chat.models.Group
import com.cometchat.chat.models.User
import <package>.databinding.ActivityMessagesBinding      // viewBinding for your layout

/**
 * Views/viewBinding chat surface for the Visual Builder Visually path —
 * mirrors the canonical builder repo's MessagesActivity (pure Views, no Compose).
 *
 * CometChatUIKit.init(...) must have been called in Application.onCreate()
 * BEFORE this Activity launches — see §2.
 *
 * The layout (activity_messages.xml) hosts, top-to-bottom:
 *   <com.cometchat.chatuikit.messageheader.CometChatMessageHeader   android:id="@+id/messageHeader" .../>
 *   <com.cometchat.chatuikit.messagelist.CometChatMessageList       android:id="@+id/messageList"   .../>  (weight=1)
 *   <com.cometchat.chatuikit.messagecomposer.CometChatMessageComposer android:id="@+id/messageComposer" .../>
 */
class MessagesActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMessagesBinding
    private var user: User? = null
    private var group: Group? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMessagesBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Deserialize the selected user/group from the launching Intent
        // (see the builder repo's MessagesActivity for the Gson/JSON pattern).

        if (user != null) {
            binding.messageHeader.user = user!!
            binding.messageList.user = user
            binding.messageComposer.user = user
        } else if (group != null) {
            binding.messageHeader.group = group!!
            binding.messageList.group = group
            binding.messageComposer.group = group
        }

        binding.messageHeader.setOnBackButtonPressed { finish() }

        // Apply builder settings to each component (verbatim helper from the repo)
        BuilderSettingsHelper.applySettingsToMessageHeader(binding.messageHeader)
        BuilderSettingsHelper.applySettingsToMessageList(binding.messageList)
        BuilderSettingsHelper.applySettingsToMessageComposer(binding.messageComposer)
    }
}
```

A `CometChatConversations` list (gated by `BuilderSettingsHelper.applySettingsToConversations(...)`) lives in its own Fragment/Activity that launches `MessagesActivity` on item click — again mirroring the repo's `ChatsFragment` → `MessagesActivity` flow.

`BuilderSettingsHelper.kt` is copied verbatim from the builder repo. Methods used above:
- `applySettingsToConversations(...)` → user-status / receipts / search-box visibility
- `applySettingsToMessageHeader(...)` → voice/video call buttons + user-status visibility (group vs user-aware)
- `applySettingsToMessageList(...)` → edit/delete/reply-in-thread/reactions/translation/conversation-starter/smart-replies/message-privately visibility
- `applySettingsToMessageComposer(...)` → attachment/voice-note/poll/sticker/etc. visibility

### Compose-only alternative

**Only if the host app already uses Jetpack Compose** (it has `buildFeatures { compose = true }`, the Compose BOM, and the `org.jetbrains.kotlin.plugin.compose` plugin), you may instead emit a `@Composable` wrapper that hosts the kit's View components via `AndroidView`. Do NOT emit this on a Views-only app — it won't compile without the Compose build setup, and the canonical repo is Views, not Compose.

If the host is Views-only and you (or the customer) still want the Compose wrapper, you must first add the Compose-enable patch to `app/build.gradle.kts`:

```kotlin
plugins {
    // ...existing plugins...
    id("org.jetbrains.kotlin.plugin.compose")           // required for Kotlin 2.0+
}

android {
    buildFeatures { compose = true }
    composeOptions {
        // omit kotlinCompilerExtensionVersion when using the Kotlin Compose plugin (2.0+)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.00")
    implementation(composeBom)
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.activity:activity-compose:1.9.3")
}
```

Then the Compose wrapper:

```kotlin
// app/src/main/java/<package>/cometchat/CometChatApp.kt — COMPOSE-ONLY alternative
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
 * Compose-ONLY alternative to MessagesActivity above. Use this ONLY if the host
 * app already enables Compose. Hosts the kit's View-based components via AndroidView;
 * BuilderSettingsHelper wires CometChatBuilderSettings → component visibility.
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

For a Compose-native UI Kit stack (`chatuikit-compose-android` instead of `chatuikit-android` Views), skip the `AndroidView` + `BuilderSettingsHelper` indirection and read `CometChatBuilderSettings.ChatFeatures.*` constants directly into the Compose components' visibility/feature props — see `cometchat-android-v6-compose-components`. The default Views path above matches the canonical builder repo, which is Views-based.

### Calls + builder

If any `CometChatBuilderSettings.CallFeatures.*` flag is true:
1. Init Calls SDK in `Application.onCreate()` alongside UI Kit (see `cometchat-android-v6-calls`)
2. Mount `CometChatIncomingCall` overlay — the builder repo's `BuilderApplication.kt` registers `ActivityLifecycleCallbacks` and shows a `Snackbar`-hosted incoming-call view at the top of the foreground activity. Copy that pattern verbatim from `chat-builder/src/main/java/com/cometchat/builder/utils/BuilderApplication.kt` (inside the Android Visual Builder ZIP at https://preview.cometchat.com/downloads/cometchat-builder-android.zip)
3. FCM data-message wiring — defer to `cometchat-android-v6-push`

### What is NOT honored in v1

The builder repo's `HomeActivity` exposes a `BottomNavigationView` with up to 4 tabs (Chats / Calls / Users / Groups) driven by `CometChatBuilderSettings.Layout.TABS`. Skills emits a single conversations → `MessagesActivity` surface, not the tabbed shape. The corresponding `applySettingsToBottomNavigationView` method is also **intentionally removed** when emitting `BuilderSettingsHelper.kt` (per README option 2). Theme + typography + chat-feature toggles ARE honored. For the full tabbed shape, copy the builder repo's `HomeActivity` + per-tab fragments alongside skills' emission (or use README option 1 — "Import as module").
