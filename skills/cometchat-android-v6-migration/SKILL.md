---
name: cometchat-android-v6-migration
description: V5→V6 migration recipes for native Android. CometChat ships V5 (chat-uikit-android:5.x — Java + Kotlin Views) and V6 beta (chatuikit-{compose,kotlin}-android:6.x — Compose surface OR Kotlin Views, calls bundled) side-by-side. Covers when to migrate vs stay, the cohort-selection decision (Compose vs Kotlin Views on V6), gradle dependency rewrites, builder API changes (UIKitSettings replaces UIKitSettingsBuilder), theme system rewrite (CometChatTheme.DayNight), calls integration delta (calls bundled — drop calls-sdk-android), Activity theme rules, side-by-side cohort selection during migration, and a verification checklist.
license: "MIT"
compatibility: "Migrating FROM com.cometchat:chat-uikit-android:5.x TO com.cometchat:chatuikit-{compose,kotlin}-android:6.0.0-beta2; minSdk 28+ (V6 raised the floor from 21 to 28); Kotlin >= 1.9 for V6 Compose"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat android v5 v6 migration compose kotlin-views uikit-settings cometchat-theme daynight calls-bundled minsdk gradle migration-recipes"
---

## Purpose

Migration recipes for moving from CometChat Android UIKit V5 (`chat-uikit-android:5.x`) to V6 (`chatuikit-{compose,kotlin}-android:6.0.0-beta2`). V6 is beta — most production apps should stay on V5 today; this skill is for teams evaluating V6 or planning the eventual migration.

V6 is a different SDK, not a drop-in replacement. The migration is roughly the size of jumping from React Native UIKit v5 to v6 — package coordinates, builder APIs, theme system, calls handling all change.

**Read these other skills first:**
- `cometchat-android-v5-core` — current state baseline
- `cometchat-android-v6-core` — destination state
- `cometchat-android-v6-builder-settings` — the new UIKitSettings API in detail
- `cometchat-android-v6-{compose,kotlin}-{components,placement,theming,customization}` — surface-specific destination skills
- `cometchat-android-v6-calls` — calls migration (calls SDK is bundled in V6)

**Ground truth:**
- V5 source — installed `com.cometchat:chat-uikit-android@5.x` artifacts under `~/.gradle/caches/`
- V6 source — installed `chatuikit-{compose,kotlin}-android@6.0.0-beta2` artifacts
- Sister skill — `cometchat-flutter-v6-migration` (different platform, same migration shape)

---

## 1. When to migrate vs stay

**Stay on V5 if:**

- Your app is in production and stable
- You're not actively shipping new chat features
- You don't need V6's specific additions (Compose-first surface, AI Agent integration, Material 3 theming defaults)
- Your minSdk is 21-27 (V6 requires minSdk 28)

**Move to V6 if:**

- You're starting a new project
- You're rewriting your existing app's UI to Compose anyway
- You need V6 features that aren't backported to V5 (e.g. some AI Agent components)
- You've validated V6 beta against your use cases on a sample project first

**The dispatcher (`cometchat-android-v6`) routes by detected version.** Both V5 and V6 skill sets ship in `npx @cometchat/skills add --family android` — the migration here lives under V6 because that's the destination cohort.

---

## 2. The cohort decision (Compose vs Kotlin Views)

V6 is split into two surfaces:

| Surface | Package | When to pick |
|---|---|---|
| Compose | `com.cometchat:chatuikit-compose-android:6.0.0-beta2` | New apps; existing apps already on Compose |
| Kotlin Views | `com.cometchat:chatuikit-kotlin-android:6.0.0-beta2` | Existing apps on Java + XML layouts; teams not ready for Compose |

**You can mix both in the same app**, but a single chat surface is one or the other — not both.

The migration plan asks the user upfront: which surface for each chat screen? Default = match the surrounding app.

---

## 3. Gradle dependency migration

### V5 (today)

```kotlin
// app/build.gradle.kts
dependencies {
  implementation("com.cometchat:chat-uikit-android:5.0.+")     // chat
  implementation("com.cometchat:calls-sdk-android:5.0.+")      // separate calls SDK
}
```

### V6 (Compose path)

```kotlin
dependencies {
  implementation("com.cometchat:chatuikit-compose-android:6.0.0-beta2")
  // No separate calls SDK — calls bundled into the same artifact
  // Compose dependencies (if not already present)
  implementation(platform("androidx.compose:compose-bom:2024.02.00"))
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
}
```

### V6 (Kotlin Views path)

```kotlin
dependencies {
  implementation("com.cometchat:chatuikit-kotlin-android:6.0.0-beta2")
  // No separate calls SDK
  // Material Components for theming (`CometChatTheme.DayNight` extends Material themes)
  implementation("com.google.android.material:material:1.11.+")
}
```

### `gradle.properties` rules carry over

```properties
android.useAndroidX=true
android.enableJetifier=true
```

Both still required on V6.

### `minSdk` floor

V5: minSdk 21. V6: **minSdk 28**. If you're on minSdk 21-27 and want V6, this is the first thing to address — bump minSdk and audit your other dependencies for compatibility.

---

## 4. Init API rewrite

### V5 — `UIKitSettingsBuilder`

```kotlin
val settings = UIKitSettingsBuilder()
  .setRegion("us")
  .setAppId(BuildConfig.COMETCHAT_APP_ID)
  .setAuthKey(BuildConfig.COMETCHAT_AUTH_KEY)
  .subscribePresenceForAllUsers()
  .build()

CometChatUIKit.init(this, settings, object : CometChat.CallbackListener<String>() {
  override fun onSuccess(s: String) { /* ... */ }
  override fun onError(e: CometChatException) { /* ... */ }
})
```

### V6 — `UIKitSettings.Builder()`

```kotlin
val settings = UIKitSettings.Builder()
  .setAppId(BuildConfig.COMETCHAT_APP_ID)
  .setRegion(BuildConfig.COMETCHAT_REGION)
  .setAuthKey(BuildConfig.COMETCHAT_AUTH_KEY)
  .subscribePresenceForAllUsers()
  .enableCalling()                                // ← calls toggled on here, not via separate SDK
  .build()

CometChatUIKit.init(this, settings) { result ->
  when (result) {
    is CometChatUIKit.Result.Success -> { /* ... */ }
    is CometChatUIKit.Result.Error   -> { /* surface to UI */ }
  }
}
```

Differences:

- Class name: `UIKitSettingsBuilder` → `UIKitSettings.Builder()`
- Calls: separate SDK init → `.enableCalling()` flag
- Result: `CallbackListener` → `Result.Success` / `Result.Error` sealed class

For full builder option mapping, see `cometchat-android-v6-builder-settings`.

---

## 5. Calls integration migration

V5 has a separate `calls-sdk-android` artifact + a separate `CometChatCalls.init`. V6 bundles calls into `chatuikit-{compose,kotlin}-android` and toggles via `.enableCalling()`.

### V5 calls init

```kotlin
// In Application.onCreate
CometChat.init(this, BuildConfig.COMETCHAT_APP_ID, appSettings, /* callback */)

val callAppSettings = CallAppSettingsBuilder()
  .setAppId(BuildConfig.COMETCHAT_APP_ID)
  .setRegion(BuildConfig.COMETCHAT_REGION)
  .build()
CometChatCalls.init(this, callAppSettings, /* callback */)
```

### V6 calls init

```kotlin
val settings = UIKitSettings.Builder()
  // ... appId, region, authKey ...
  .enableCalling()              // ← that's it; calls SDK init happens internally
  .build()

CometChatUIKit.init(this, settings) { /* ... */ }
```

### Permissions + manifest carry over

V5's manifest entries (FOREGROUND_SERVICE_*, MANAGE_OWN_CALLS, BIND_TELECOM_CONNECTION_SERVICE, RECORD_AUDIO, CAMERA, POST_NOTIFICATIONS) are unchanged on V6. Same `foregroundServiceType="phoneCall|microphone|camera"` rule applies. See `cometchat-android-v5-calls/references/voip-calling.md` — the VoIP push implementation works as-is on V6.

### KEEP `calls-sdk-android:5.0.+` — V6 still needs it as a peer dep

**⚠️ Despite vendor marketing of "bundled calling," chatuikit-compose-android:6.0.0 ships without the calls SDK and CRASHES on init without it.** Keep `com.cometchat:calls-sdk-android:5.0.+` in `app/build.gradle.kts` plus apply the W3 stub-class workaround. Full set of five required workarounds is in `cometchat-android-v6-calls` §"Five required workarounds" — apply them all if your app uses calls.

Earlier guidance to "drop calls-sdk-android" was wrong; validated end-to-end against a web peer on 2026-05-12 confirmed the dep is mandatory.

---

## 6. Theme system rewrite

### V5 — XML theme attrs + style classes

```xml
<!-- res/values/themes.xml -->
<style name="Theme.YourApp" parent="Theme.Material3.DayNight.NoActionBar">
  <item name="cometchatPrimaryColor">@color/your_primary</item>
  <item name="cometchatBackgroundColor">@color/your_bg</item>
  <!-- ... -->
</style>
```

Plus programmatic overrides via `CometChatTheme.getInstance().palette.setPrimary(...)`.

### V6 Compose — `CometChatTheme` composable

```kotlin
setContent {
  CometChatTheme(
    colorScheme = lightColorScheme(
      primary = Color(0xFF6750A4),
      // ...
    ),
    typography = ourTypography,
    shapes = ourShapes,
  ) {
    AppNavigation()
  }
}
```

### V6 Kotlin Views — `CometChatTheme.DayNight` parent

```xml
<!-- res/values/themes.xml -->
<style name="Theme.YourApp" parent="CometChatTheme.DayNight">
  <item name="cometchatPrimaryColor">@color/your_primary</item>
  <!-- ... -->
</style>
```

**CRITICAL:** Activity themes hosting V6 Kotlin Views components MUST inherit from `CometChatTheme.DayNight` (or its `.Light` / `.Dark` variants) — NOT `Theme.AppCompat.*` or `Theme.MaterialComponents.*`. V6 components extend `MaterialCardView` and reference kit-specific theme attrs that aren't in the older theme parents. Crash signature: `Failed to resolve attribute at index N`.

This is documented in `cometchat-android-v6-troubleshooting` and surfaced in the V6 calls smoke (calls components are the canary that exposes the bug first).

### Migration plan for theme

1. Audit V5 theme attrs (`grep cometchat res/values/`)
2. Map each to its V6 equivalent (most are same names; some have been renamed for Material 3 alignment)
3. Activity manifest: change `android:theme="@style/Theme.AppCompat.*"` → `android:theme="@style/Theme.YourApp"` where the new theme inherits `CometChatTheme.DayNight`
4. Programmatic theme overrides: rewrite via Compose `CometChatTheme(colorScheme = ...)` or Kotlin Views `CometChatTheme.singleton.colors.primary = ...` (depending on surface)

For full mapping, see `cometchat-android-v6-{compose,kotlin}-theming`.

---

## 7. Component name + import migration

The component names (`CometChatConversations`, `CometChatMessageList`, `CometChatMessageHeader`, `CometChatMessageComposer`, `CometChatUsers`, `CometChatGroups`, `CometChatCallButtons`, etc.) are unchanged in V6. The packages differ:

### V5 imports

```kotlin
import com.cometchat.chatuikit.conversations.CometChatConversations
import com.cometchat.chatuikit.messages.CometChatMessageList
```

### V6 Compose imports

```kotlin
import com.cometchat.chatuikit.compose.conversations.CometChatConversations
import com.cometchat.chatuikit.compose.messages.CometChatMessageList
```

### V6 Kotlin Views imports

```kotlin
import com.cometchat.chatuikit.kotlin.conversations.CometChatConversations
import com.cometchat.chatuikit.kotlin.messages.CometChatMessageList
```

The skill rewrites imports during migration. Most projects can do a regex sweep:

```bash
# Compose path
sed -i 's|com.cometchat.chatuikit.conversations|com.cometchat.chatuikit.compose.conversations|g' app/src/main/kotlin/**/*.kt
# Kotlin Views path
sed -i 's|com.cometchat.chatuikit.conversations|com.cometchat.chatuikit.kotlin.conversations|g' app/src/main/kotlin/**/*.kt
```

But verify each rewrite — some V5 modules have been split or merged in V6 in ways the agent should review case-by-case.

---

## 8. Side-by-side cohort selection

V5 and V6 skill sets both ship in `--family android`. During migration, the dispatcher detects which is in use from `app/build.gradle.kts`:

- `chat-uikit-android:5.x` only → V5 cohort
- `chatuikit-{compose,kotlin}-android:6.x` only → V6 cohort
- Both present → ASK (rare; usually means in-progress migration)

For an in-progress migration, you can have V5 and V6 in the same module temporarily, but they'll fight over runtime singletons (`CometChatUIKit.init` exists in both). Best practice: migrate one feature at a time, fully — don't leave a half-migrated state.

---

## 9. Migration plan template

```
□ Audit current V5 integration
  □ Which V5 skills' patterns are in use?
  □ List Activities / Fragments hosting CometChat surfaces
  □ List custom views, decorators, request builders
  □ List theme attrs in use

□ Pick V6 surface
  □ Compose vs Kotlin Views per chat screen
  □ Bump minSdk if below 28

□ Update gradle
  □ Remove chat-uikit-android:5.x
  □ KEEP calls-sdk-android:5.0.+ (V6 needs it as peer dep — see §"Drop the calls-sdk-android dependency" above)
  □ Add chatuikit-{compose,kotlin}-android:6.0.0-beta2
  □ Add Compose deps (if applicable) or Material Components (if Kotlin Views)

□ Rewrite init
  □ UIKitSettingsBuilder → UIKitSettings.Builder()
  □ Drop separate CometChatCalls.init; add .enableCalling() on UIKitSettings
  □ CallbackListener → Result sealed class

□ Rewrite themes
  □ Activity theme parent → CometChatTheme.DayNight (Kotlin Views)
  □ Compose entry uses CometChatTheme composable
  □ Re-map any custom theme attrs

□ Rewrite imports
  □ All com.cometchat.chatuikit.* → com.cometchat.chatuikit.{compose,kotlin}.*

□ Migrate custom views / decorators / request builders
  □ See cometchat-android-v6-{compose,kotlin}-customization

□ Verify build
  □ ./gradlew clean assembleDebug
  □ Resolve any "Duplicate class" errors (drop conflicting V5 deps)

□ Smoke on real device
  □ Login → see conversations
  □ Send message
  □ Call (voice + video)
  □ Theme renders correctly (light + dark)
  □ No crashes from theme parent mismatch
```

---

## 10. Common migration failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Build error: "Duplicate class com.cometchat.chatuikit.*" | Both V5 and V6 deps in `app/build.gradle.kts` | Remove `chat-uikit-android:5.x` |
| `IllegalArgumentException` at activity start | Activity theme not `CometChatTheme.DayNight` | Update theme parent |
| Calls don't ring / `E/CallManager: Calling module not found` | chatuikit-compose:6.0.0 needs `calls-sdk-android:5.0.+` as explicit peer + W1–W5 workarounds | See `cometchat-android-v6-calls` §"Five required workarounds" — do NOT remove calls-sdk-android |
| Theme attrs missing | V5 attr name renamed in V6 | Audit `cometchat-android-v6-{compose,kotlin}-theming` for the V6 attr name |
| `Failed to resolve attribute at index N` | Activity theme inherits `Theme.AppCompat.*` | Change parent to `CometChatTheme.DayNight` |
| Init never resolves | V5 `CometChat.init` still being called alongside V6 `CometChatUIKit.init` | Remove the V5 call |
| `minSdk` build error | Trying to use V6 with minSdk < 28 | Bump minSdk to 28 |

---

## 11. Verification checklist

- [ ] `app/build.gradle.kts` has only one CometChat dep tree (V5 OR V6, not both)
- [ ] `minSdk = 28` or higher
- [ ] All V5 imports rewritten to the V6 surface (`compose` or `kotlin` namespace)
- [ ] `UIKitSettingsBuilder` → `UIKitSettings.Builder()` everywhere
- [ ] `.enableCalling()` on the builder if calls are used
- [ ] Activity themes inherit `CometChatTheme.DayNight` (Kotlin Views path)
- [ ] No `CometChatCalls.init` calls outside what V6 does internally
- [ ] `calls-sdk-android:5.0.+` retained as explicit peer dep (V6 needs it; despite vendor marketing of "bundled calls")
- [ ] Build succeeds: `./gradlew clean assembleDebug`
- [ ] Real-device smoke: login + chat + voice call + video call
- [ ] Theme smoke: light mode + dark mode + custom palette renders correctly

## 12. Pointers

- `cometchat-android-v6-core` — V6 init/login/build setup
- `cometchat-android-v6-builder-settings` — full UIKitSettings options
- `cometchat-android-v6-{compose,kotlin}-{components,placement,theming,customization}` — destination skills per surface
- `cometchat-android-v6-calls` — calls integration delta
- `cometchat-android-v6-troubleshooting` — common V6-specific failure modes (theme parent, R8, Compose runtime)
- `cometchat-flutter-v6-migration` — sibling skill for Flutter (same migration shape on a different platform)
