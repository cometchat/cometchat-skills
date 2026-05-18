---
name: setup
description: Set up CometChat Calls SDK v5 for Android. Use when adding SDK dependencies, configuring Cloudsmith maven, CallAppSettings, init, permissions, or Jetifier. Triggers on "setup calls sdk", "add cometchat dependency", "initialize calls", "gradle setup".
inclusion: manual
---

# CometChat Calls SDK v5 — Setup

## Overview

Install and initialize the CometChat Calls SDK v5 (beta) in an Android project. Covers Cloudsmith maven repository, Gradle dependencies, manifest permissions, Jetifier, and `CometChatCalls.init()`.

## Prerequisites

- Android project with minSdk 26+, compileSdk 35
- App ID and Region from CometChat Dashboard

## Key Imports

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.core.CallAppSettings
import com.cometchat.calls.exceptions.CometChatException
```

## Implementation

### 1. Add Cloudsmith Maven Repository

In project-level `settings.gradle.kts` (or `build.gradle`):

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://dl.cloudsmith.io/public/cometchat/cometchat/maven/") }
    }
}
```

### 2. Add Dependencies

In app-level `build.gradle.kts`:

```kotlin
dependencies {
    // CometChat Calls SDK v5
    implementation("com.cometchat:calls-sdk-android:5.0.0-beta.2")

    // If using ringing (dual-SDK), also add Chat SDK:
    // implementation("com.cometchat:chat-sdk-android:4.0.+")
}
```

### 3. Enable Jetifier

In `gradle.properties`:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

### 4. Java Compatibility

In app-level `build.gradle.kts`:

```kotlin
android {
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}
```

### 5. Manifest Permissions

In `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 6. Initialize SDK

Call once in `Application.onCreate()` or main Activity:

```kotlin
val callAppSettings = CallAppSettings.CallAppSettingBuilder("APP_ID", "REGION").build()

CometChatCalls.init(this, callAppSettings, object : CometChatCalls.CallbackListener<String>() {
    override fun onSuccess(message: String) {
        Log.d(TAG, "Calls SDK initialized")
    }
    override fun onError(e: CometChatException) {
        Log.e(TAG, "Init failed: ${e.message}")
    }
})
```

### 7. Check Initialization

```kotlin
if (CometChatCalls.isInitialized()) { /* ready */ }
```

### 8. Authentication

Login with UID + API Key (dev only) or Auth Token (production):

```kotlin
CometChatCalls.login(uid, apiKey, object : CometChatCalls.CallbackListener<CallUser>() {
    override fun onSuccess(user: CallUser) { /* logged in */ }
    override fun onError(e: CometChatException) { /* handle error */ }
})
```

## Gotchas

- `android.enableJetifier=true` is **required** in `gradle.properties` — builds fail without it
- The maven URL must be `https://dl.cloudsmith.io/public/cometchat/cometchat/maven/` — no trailing path variations
- Request CAMERA and RECORD_AUDIO permissions at runtime on Android 6.0+
- Call `CometChatCalls.init()` before any other SDK method
- If using both Chat SDK and Calls SDK, initialize both separately

## Sample App Reference

- `PublicSampleApps/calls-sdk-android/settings.gradle.kts` — Cloudsmith maven config
- `PublicSampleApps/calls-sdk-android/samples/sample-app-ringing/build.gradle.kts` — dependency declarations
- `PublicSampleApps/calls-sdk-android/gradle.properties` — Jetifier enabled
- `PublicSampleApps/calls-sdk-android/samples/sample-app-ringing/src/main/kotlin/com/cometchat/samplecallsringing/RingingApplication.kt` — Application class
