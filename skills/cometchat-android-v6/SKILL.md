---
name: cometchat-android-v6
description: "Entry-point dispatcher for CometChat Android UIKit v6 — routes to the correct skill based on project stack and task"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, uikit, kotlin, jetpack-compose, dispatcher"
---

> **Ground truth:** `com.cometchat:chatuikit-{compose,kotlin}-android:6.x` (+ `calls-sdk-android:5.x`) — resolved AAR (javap) + `ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

> **Companion skills:** cometchat-android-v6-core, cometchat-android-v6-events, cometchat-android-v6-kotlin-components, cometchat-android-v6-compose-components, cometchat-android-v6-kotlin-theming, cometchat-android-v6-compose-theming, cometchat-android-v6-kotlin-customization, cometchat-android-v6-compose-customization, cometchat-android-v6-kotlin-placement, cometchat-android-v6-compose-placement, cometchat-android-v6-builder-settings, cometchat-android-v6-features, cometchat-android-v6-extensions, cometchat-android-v6-push, cometchat-android-v6-production, cometchat-android-v6-troubleshooting, cometchat-android-v6-testing

## Purpose

This is the entry-point skill for the CometChat Android UIKit v6. It detects the project's UI stack (Kotlin Views, Jetpack Compose, or both) and routes to the correct specialized skill.

## Use this skill when

- The user mentions "CometChat" in an Android/Kotlin project
- The user wants to add chat, messaging, or calling features to an Android app
- You need to determine which CometChat skill to activate
- The user asks a general CometChat question without specifying a stack

## Do not use this skill when

- You already know which specific skill to use (go directly to it)
- The project is React, React Native, iOS, Flutter, or Web (this skill is Android-only)

## 1. Project Detection

Detect the UI stack by inspecting the project's Gradle files:

```kotlin
// Check build.gradle.kts or build.gradle for dependencies:

// Jetpack Compose stack
implementation("com.cometchat:chatuikit-compose-android:6.x")

// Kotlin Views stack
implementation("com.cometchat:chatuikit-kotlin-android:6.x")

// Core only (shared module, no UI)
implementation("com.cometchat:chatuikit-core-android:6.x")
```

Also check for module includes in `settings.gradle`:
- `:chatuikit-compose` → Compose stack
- `:chatuikit-kotlin` → Kotlin Views stack
- `:chatuikit-core` → Core module

## 2. Architecture Overview

v6 uses a 3-module architecture:

| Module | Package | Purpose |
|---|---|---|
| `chatuikit-core` | `com.cometchat.uikit.core` | Shared: init, login, ViewModels, events, data layer |
| `chatuikit-kotlin` | `com.cometchat.uikit.kotlin` | Kotlin Views UI: custom Views, RecyclerView, XML themes |
| `chatuikit-compose` | `com.cometchat.uikit.compose` | Compose UI: @Composable functions, CompositionLocal themes |

Both UI modules depend on `chatuikit-core`. The core module holds all business logic.

## 3. Routing Table

| User wants to... | Route to skill |
|---|---|
| Add CometChat to a project / Gradle setup | `cometchat-android-v6-core` |
| Initialize the SDK / login / logout | `cometchat-android-v6-core` |
| Configure UIKitSettings in detail | `cometchat-android-v6-builder-settings` |
| Use a component (Kotlin Views) | `cometchat-android-v6-kotlin-components` |
| Use a component (Jetpack Compose) | `cometchat-android-v6-compose-components` |
| Place components in Activities/Fragments | `cometchat-android-v6-kotlin-placement` |
| Place components in Compose screens | `cometchat-android-v6-compose-placement` |
| Change colors/fonts (Kotlin Views) | `cometchat-android-v6-kotlin-theming` |
| Change colors/fonts (Compose) | `cometchat-android-v6-compose-theming` |
| Customize bubble rendering (Kotlin Views) | `cometchat-android-v6-kotlin-customization` |
| Customize bubble rendering (Compose) | `cometchat-android-v6-compose-customization` |
| Use AI features, reactions, polls, stickers | `cometchat-android-v6-features` |
| Extend with custom DataSources / message types | `cometchat-android-v6-extensions` |
| Listen to chat/call/user events | `cometchat-android-v6-events` |
| Add push notifications / FCM / VoIP | `cometchat-android-v6-push` |
| Prepare for production release | `cometchat-android-v6-production` |
| Debug issues | `cometchat-android-v6-troubleshooting` |
| Write tests | `cometchat-android-v6-testing` |

## 4. Quick-Start Decision Tree

1. **New project?** → `cometchat-android-v6-core` (Gradle setup + init)
2. **Which UI stack?**
   - Jetpack Compose → `cometchat-compose-*` skills
   - Kotlin Views (XML layouts) → `cometchat-kotlin-*` skills
   - Both → Use the appropriate stack-specific skill for each task
3. **What task?**
   - Show a component → `*-components`
   - Style/theme → `*-theming`
   - Customize bubbles → `*-customization`
   - Place in navigation → `*-placement`

## Hard rules

- ALWAYS detect the project stack before routing to a stack-specific skill
- NEVER mix Kotlin Views APIs with Compose APIs in the same code example
- NEVER reference v5 Java UIKit APIs — v6 is Kotlin-only
- When both stacks are present, ask the user which stack they're working with before proceeding
- Route to the most specific skill possible — don't try to answer from this dispatcher skill
