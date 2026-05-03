---
name: cometchat-android-v6-production
description: "CometChat Android UIKit v6 production readiness — token auth, ProGuard/R8, security checklist, release configuration"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, production, security, proguard, release, auth-token"
---

> **Companion skills:** cometchat-android-v6-core (init/login), cometchat-android-v6-builder-settings (UIKitSettings), cometchat-android-v6-push (FCM)

## Purpose

Prepare a CometChat v6 Android app for production release — switch to token-based auth, configure ProGuard/R8, apply security best practices, and optimize the release build.

## Use this skill when

- Preparing an app for production/release
- Switching from authKey to token-based authentication
- Configuring ProGuard/R8 rules for CometChat
- Reviewing security best practices

## Do not use this skill when

- Setting up for development (use `cometchat-android-v6-core`)
- Debugging issues (use `cometchat-android-v6-troubleshooting`)

## 1. Token-Based Authentication

### 1.1 Never Ship authKey

```kotlin
// ❌ NEVER in production
val settings = UIKitSettings.UIKitSettingsBuilder()
    .setAppId("APP_ID")
    .setRegion("us")
    .setAuthKey("AUTH_KEY") // REMOVE THIS
    .build()

CometChatUIKit.login("uid", callback) // Uses authKey internally

// ✅ Production pattern
val settings = UIKitSettings.UIKitSettingsBuilder()
    .setAppId("APP_ID")
    .setRegion("us")
    // No authKey
    .build()

// Get token from your backend server
val authToken = yourServer.getAuthToken(userId)
CometChatUIKit.loginWithAuthToken(authToken, callback)
```

### 1.2 Server-Side Token Generation

Your backend generates auth tokens using the CometChat REST API:
- Endpoint: `POST https://{appId}.api-{region}.cometchat.io/v3/users/{uid}/auth_tokens`
- Header: `apiKey: YOUR_API_KEY` (server-side only)

The auth token is then passed to the client for `loginWithAuthToken()`.

## 2. ProGuard / R8 Configuration

### 2.1 Consumer Rules

CometChat UIKit modules include `consumer-rules.pro` that are automatically applied. Check that your app's `build.gradle.kts` has:

```kotlin
android {
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

### 2.2 Additional ProGuard Rules

If you encounter issues with minification, add these rules:

```proguard
# CometChat SDK
-keep class com.cometchat.chat.** { *; }
-keep class com.cometchat.calls.** { *; }

# CometChat UIKit
-keep class com.cometchat.uikit.** { *; }

# Gson (used for FCM DTO parsing)
-keep class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# Firebase
-keep class com.google.firebase.** { *; }
```

## 3. Security Checklist

| Item | Status | Notes |
|---|---|---|
| Remove `authKey` from client code | Required | Use `loginWithAuthToken()` |
| Store `appId` securely | Recommended | Use BuildConfig or encrypted prefs |
| Use HTTPS for all custom endpoints | Required | `overrideAdminHost` / `overrideClientHost` |
| Validate auth tokens server-side | Required | Tokens should expire |
| Do not log sensitive data | Required | Remove debug logs in release |
| Enable R8/ProGuard | Recommended | Obfuscates code |
| Pin SSL certificates | Optional | For high-security apps |

## 4. Release Build Configuration

```kotlin
android {
    compileSdk = 36

    defaultConfig {
        minSdk = 28
        targetSdk = 36
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
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

## 5. Dependency Management

### 5.1 Compose BOM

For Compose stack, use the BOM to align Compose library versions:

```kotlin
implementation(platform("androidx.compose:compose-bom:2024.x.x"))
implementation("androidx.compose.ui:ui")
implementation("androidx.compose.material3:material3")
```

### 5.2 Version Pinning

Pin CometChat SDK versions explicitly:

```kotlin
implementation("com.cometchat:chatuikit-compose-android:6.0.0-beta2")
// or
implementation("com.cometchat:chatuikit-kotlin-android:6.0.0-beta2")
```

## 6. minSdk 28 Implications

v6 requires `minSdk = 28` (Android 9.0 Pie). This means:
- No support for Android 7.0-8.1 devices
- Full TLS 1.3 support
- Native BiometricPrompt API available
- Adaptive icons required

## Hard rules

- NEVER ship `authKey` in production builds — it allows anyone to create users and login
- ALWAYS use `loginWithAuthToken()` with server-generated tokens in production
- ALWAYS test the release build with ProGuard/R8 enabled before shipping — CometChat uses reflection in some areas
- `minSdk` must be 28 — do NOT lower it, v6 APIs depend on API 28+ features
- Remove all `Log.d()` / debug logging in release builds — use `BuildConfig.DEBUG` guards
