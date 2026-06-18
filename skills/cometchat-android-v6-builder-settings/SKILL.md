---
name: cometchat-android-v6-builder-settings
description: "CometChat Android UIKit v6 UIKitSettings configuration — all builder options for SDK init, presence, calling, and host overrides"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-core-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, settings, builder, configuration, calling"
---

> **Ground truth:** `com.cometchat:chatuikit-{compose,kotlin}-android:6.x` (+ `calls-sdk-android:5.x`) — resolved AAR (javap) + `ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

> **Companion skills:** cometchat-android-v6-core (init/login), cometchat-android-v6-push (FCM/VoIP)

## Purpose

Detailed reference for `UIKitSettings.UIKitSettingsBuilder` — all configuration options for initializing the CometChat SDK, including presence subscriptions, calling features, and host overrides.

## Use this skill when

- Configuring presence subscription types (all users, roles, friends)
- Enabling calling features and configuring `CallSettingsBuilder`
- Overriding admin or client host URLs
- Controlling socket connection behavior
- Understanding the full `UIKitSettingsBuilder` API

## Do not use this skill when

- Just doing basic init/login (use `cometchat-android-v6-core` for quick setup)
- Working with UI components or theming

## 1. UIKitSettingsBuilder — Complete API

```kotlin
import com.cometchat.uikit.core.UIKitSettings

val settings = UIKitSettings.UIKitSettingsBuilder()

    // Required
    .setAppId("APP_ID")                          // CometChat App ID
    .setRegion("us")                             // "us" or "eu"

    // Authentication (dev only — use token auth in production)
    .setAuthKey("AUTH_KEY")                      // Auth key from dashboard

    // Presence subscriptions
    .subscribePresenceForAllUsers()              // Subscribe to all users' presence
    .subscribePresenceForRoles(listOf("admin"))  // Subscribe by roles
    .subscribePresenceForFriends()               // Subscribe to friends' presence
    .setRoles(listOf("admin"))                   // Override the roles list directly (advanced)

    // Socket connection
    .setAutoEstablishSocketConnection(true)      // Auto-connect (default: true)

    // Calling
    .setEnableCalling(true)                      // Auto-init CometChatCalls SDK (default: false)
    .setCallSettingsBuilder(sessionSettingsBuilder)  // Custom call config (optional) — pass a CometChatCalls.SessionSettingsBuilder

    // Host overrides (advanced — for on-premise deployments)
    .overrideAdminHost("https://custom-admin.example.com")
    .overrideClientHost("https://custom-client.example.com")

    .build()
```

## 2. Presence Subscription Types

Only one subscription type is active at a time. The last one set wins.

| Method | Subscription Type | Use Case |
|---|---|---|
| (none) | `"NONE"` | No presence updates (default) |
| `subscribePresenceForAllUsers()` | `"ALL_USERS"` | Small apps where you want all online statuses |
| `subscribePresenceForRoles(roles)` | `"ROLES"` | Subscribe to specific user roles |
| `subscribePresenceForFriends()` | `"FRIENDS"` | Social apps with friend lists |

## 3. Calling Configuration

When `setEnableCalling(true)` is set, `CometChatUIKit.init()` automatically initializes the CometChatCalls SDK after the Chat SDK succeeds:

```kotlin
// Basic calling setup
val settings = UIKitSettings.UIKitSettingsBuilder()
    .setAppId("APP_ID")
    .setRegion("us")
    .setAuthKey("AUTH_KEY")
    .setEnableCalling(true)
    .build()
```

For custom call settings:

```kotlin
import com.cometchat.calls.core.CometChatCalls

// The kit stores/uses a SessionSettingsBuilder (no-arg ctor) — NOT CallSettingsBuilder.
// setCallSettingsBuilder(Any) casts its arg to CometChatCalls.SessionSettingsBuilder
// internally; passing a CallSettingsBuilder is silently stored as null.
val sessionSettingsBuilder = CometChatCalls.SessionSettingsBuilder()
    // configure via the SessionSettingsBuilder setters (see cometchat-android-v6-calls)

val settings = UIKitSettings.UIKitSettingsBuilder()
    .setAppId("APP_ID")
    .setRegion("us")
    .setAuthKey("AUTH_KEY")
    .setEnableCalling(true)
    .setCallSettingsBuilder(sessionSettingsBuilder)  // param typed Any; pass a SessionSettingsBuilder
    .build()
```

After init, retrieve the stored builder:

```kotlin
val builder: CometChatCalls.SessionSettingsBuilder? = CometChatUIKit.getSessionSettingsBuilder()
```

## 4. Checking Initialization State

```kotlin
// Chat SDK initialized?
CometChatUIKit.isSDKInitialized()

// Calls SDK initialized? (only true if enableCalling was true AND init succeeded)
CometChatUIKit.isCallsSDKInitialized()
```

## 5. Application-Level Init Pattern

From `master-app-jetpack`, the recommended pattern separates SDK init from Calls SDK init:

```kotlin
class MyApplication : Application() {
    fun onSDKInitialized() {
        // Called after CometChatUIKit.init() succeeds
        // CometChatCalls is auto-initialized if enableCalling = true
        // Register call listeners here
        addCallListener()
    }
}
```

## Hard rules

- NEVER set both `subscribePresenceForAllUsers()` and `subscribePresenceForRoles()` — only the last one takes effect
- NEVER use `setAuthKey()` in production — use `loginWithAuthToken()` instead
- `setEnableCalling(true)` requires the CometChatCalls SDK dependency in your Gradle file
- If CometChatCalls init fails, the Chat SDK still reports success — check `isCallsSDKInitialized()` separately
- `overrideAdminHost()` and `overrideClientHost()` are for on-premise deployments only — do not use with cloud-hosted CometChat
