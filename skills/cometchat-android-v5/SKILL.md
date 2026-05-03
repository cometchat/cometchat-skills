---
name: cometchat-android-v5
description: "Entry-point dispatcher for CometChat Android UI Kit v5. Detects project setup, understands what the dev is building, and routes to the right sub-skills."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat android dispatcher entry-point integration"
---

## Purpose

This is the entry-point skill for CometChat Android UI Kit v5. It helps you understand what the developer is building, detects their project setup, and routes to the correct sub-skill for the task at hand.

**All skills are designed to work with both Java and Kotlin projects.** Code examples in each skill are provided in both languages.

---

## Use this skill when

- A developer asks to "add chat to my Android app"
- Starting a new CometChat integration
- Unsure which skill to use for a specific task
- Need an overview of what CometChat Android UI Kit v5 offers

## Do not use this skill when

- You already know which specific skill is needed (go directly to it)

---

## 1. Project detection

Before writing any code, detect the project setup:

| Check | How | Why |
|---|---|---|
| Language | Look for `.kt` files in `src/main/java/` or `src/main/kotlin/` | Determines Java vs Kotlin code examples |
| Gradle version | Check `gradle-wrapper.properties` for `distributionUrl` | Affects dependency syntax (Groovy vs Kotlin DSL) |
| Min SDK | Check `build.gradle` for `minSdkVersion` | Must be 24+ for CometChat |
| Existing CometChat | Search for `com.cometchat` in `build.gradle` | Avoid duplicate setup |
| Calling SDK | Search for `com.cometchat:calls-sdk-android` | Determines if voice/video is already available |

---

## 2. What are you building?

Ask the developer what they're building to recommend the right placement:

| Intent | Recommended placement | Components |
|---|---|---|
| Messaging app | Dedicated Activity with bottom tabs | `CometChatConversations` + `CometChatMessageList` + `CometChatMessageComposer` + `CometChatMessageHeader` |
| Marketplace / platform | Chat button on product screen + inbox Activity | Single thread (button trigger) + multi-conversation (inbox) |
| SaaS / dashboard | Chat Fragment in existing Activity | `CometChatConversations` in a Fragment |
| Social / community | Full messenger with tabs | Conversations + Users + Groups + Calls in ViewPager/BottomNav |
| Support / helpdesk | BottomSheet or Dialog overlay | `CometChatMessageList` + `CometChatMessageComposer` in BottomSheet |
| Just exploring | Minimal single-Activity demo | `CometChatConversations` with pre-logged-in test user |

---

## 3. Skill routing reference

| Skill | When to load |
|---|---|
| `cometchat-android-v5-core` | **Always** — before any integration code. Init, login, builder, dependencies. |
| `cometchat-android-v5-components` | **Always** — before writing component code. Full catalog of all CometChat views. |
| `cometchat-android-v5-placement` | When integrating — Activity, Fragment, BottomSheet, Dialog, Tab patterns. |
| `cometchat-android-v5-theming` | When customizing look and feel — colors, fonts, dark mode, style classes. |
| `cometchat-android-v5-features` | When adding features — calls, reactions, polls, AI, extensions. |
| `cometchat-android-v5-customization` | When writing custom templates, events, DataSource decorators. |
| `cometchat-android-v5-production` | When setting up production auth or user management. |
| `cometchat-android-v5-troubleshooting` | When diagnosing problems — Gradle errors, crashes, rendering issues. |
| `cometchat-android-v5-extensions` | When working with extensions (polls, stickers, collaborative, etc.). |
| `cometchat-android-v5-push` | When setting up push notifications (FCM, token lifecycle, deep-link). |
| `cometchat-android-v5-testing` | When adding tests (unit, UI, instrumented, E2E, CI). |

---

## 4. Integration order

Every integration follows this sequence:

```
1. Dependencies (Gradle)          → cometchat-android-v5-core §1
2. Manifest permissions            → cometchat-android-v5-core §5
3. App theme setup                 → cometchat-android-v5-core §5b (must inherit CometChatTheme.DayNight — Material 2 parent)
4. Init + Login                    → cometchat-android-v5-core §2-3
5. Place components in your app    → cometchat-android-v5-placement
6. Customize appearance            → cometchat-android-v5-theming
7. Add features                    → cometchat-android-v5-features
8. Production hardening            → cometchat-android-v5-production
```

---

## 5. Iteration menu

After the initial integration, the developer can:

1. **Customize look and feel** — Theme presets, brand colors, dark mode
2. **Add a feature** — Calls, reactions, polls, AI smart replies, file sharing
3. **Customize a component** — Custom message bubbles, headers, composer actions
4. **Set up production auth** — Replace dev Auth Key with server-side tokens
5. **Set up push notifications** — FCM setup, token lifecycle, deep-link on tap
6. **Add tests** — Unit tests, UI tests, E2E with Maestro
7. **Troubleshoot an issue** — Gradle errors, runtime crashes, rendering problems

Route each choice to the appropriate skill.

---

## Hard rules

- **Always read `cometchat-android-v5-core` first.** It covers init, login, and dependencies — prerequisites for everything else.
- **Always read `cometchat-android-v5-components` before writing component code.** Never invent component names or method signatures from memory.
- **Provide both Java and Kotlin examples.** The v5 UIKit is written in Java but is fully interoperable with Kotlin. Client devs use both.
- **Ask, don't assume.** Every integration decision (placement, features, auth mode) should be confirmed with the developer.
- **Always read existing files before modifying them.** Never blindly overwrite project files.
