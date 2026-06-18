---
name: cometchat-android-v6-kotlin-theming
description: "CometChat Android UIKit v6 Kotlin Views theming — CometChatTheme singleton, XML attributes, programmatic overrides, typography, and dark mode"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-kotlin-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, kotlin-views, theming, xml-attrs, colors, typography, dark-mode"
---

> **Ground truth:** `com.cometchat:chatuikit-{compose,kotlin}-android:6.x` (+ `calls-sdk-android:5.x`) — resolved AAR (javap) + `ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

> **Companion skills:** cometchat-android-v6-compose-theming (Compose equivalent), cometchat-android-v6-kotlin-components, cometchat-android-v6-kotlin-customization

## Purpose

Apply and customize the CometChat theme in Kotlin Views — XML theme attributes, programmatic color/font overrides via the `CometChatTheme` singleton, dark mode support, and per-component style classes.

## Use this skill when

- Setting CometChat theme colors via XML attributes or programmatically
- Overriding primary, neutral, alert, or button colors
- Customizing typography and fonts
- Implementing dark mode for Kotlin Views components
- Clearing the theme cache after dynamic theme changes

## Do not use this skill when

- Working with Compose theming (use `cometchat-android-v6-compose-theming`)
- Customizing bubble rendering (use `cometchat-android-v6-kotlin-customization`)

## 1. CometChatTheme Singleton

`CometChatTheme` is a Kotlin `object` in `com.cometchat.uikit.kotlin.theme` that provides `Context`-based getters and setters for all theme tokens.

```kotlin
import com.cometchat.uikit.kotlin.theme.CometChatTheme

// Get a color (requires Context)
val primaryColor: Int = CometChatTheme.getPrimaryColor(context)
val textColor: Int = CometChatTheme.getTextColorPrimary(context)

// Set a color programmatically (cached globally)
CometChatTheme.setPrimaryColor(Color.parseColor("#6851D6"))
CometChatTheme.setErrorColor(Color.RED)
```

## 2. XML Theme Attributes

> **The app/activity theme MUST extend `CometChatTheme.DayNight` (required — components crash without it).** The kit ships `CometChatTheme.DayNight` (parent `Theme.MaterialComponents.DayNight.NoActionBar`), which defines every `cometchat*` theme attribute the component layouts reference. Parenting a plain `Theme.MaterialComponents` / `Theme.Material3` / `Theme.AppCompat` instead leaves those attrs unresolved and the **first component inflate crashes** — e.g. `CometChatConversations` (which inflates a `MaterialButton`/`MaterialCardView`) throws `java.lang.UnsupportedOperationException: Failed to resolve attribute …` or `IllegalArgumentException: requires your app theme to be Theme.MaterialComponents`. Set it in `AndroidManifest.xml` via `android:theme="@style/AppTheme"` (or `android:theme="@style/CometChatTheme.DayNight"` directly). Verified by building + running on-device, 2026-06-11.

Define theme colors in your app's `styles.xml` or `themes.xml`, parenting the kit theme:

```xml
<!-- parent MUST be CometChatTheme.DayNight (or a descendant) -->
<style name="AppTheme" parent="CometChatTheme.DayNight">
    <!-- Override only what you want; the parent supplies all defaults. -->
    <!-- Primary -->
    <item name="cometchatPrimaryColor">#6851D6</item>

    <!-- Neutral scale -->
    <item name="cometchatNeutralColor50">#FAFAFA</item>
    <item name="cometchatNeutralColor100">#F5F5F5</item>
    <item name="cometchatNeutralColor200">#E8E8E8</item>
    <!-- ... through cometchatNeutralColor900 -->

    <!-- Alert colors -->
    <item name="cometchatSuccessColor">#34C759</item>
    <item name="cometchatErrorColor">#FF3B30</item>
    <item name="cometchatWarningColor">#FFCC00</item>
    <item name="cometchatInfoColor">#007AFF</item>
    <item name="cometchatMessageReadColor">#007AFF</item>

    <!-- Background colors -->
    <item name="cometchatBackgroundColor1">@color/bg1</item>
    <!-- ... through cometchatBackgroundColor4 -->

    <!-- Stroke/border colors -->
    <item name="cometchatStrokeColorDefault">@color/stroke</item>
    <item name="cometchatStrokeColorLight">@color/strokeLight</item>
    <item name="cometchatStrokeColorDark">@color/strokeDark</item>
    <item name="cometchatStrokeColorHighlight">@color/primary</item>

    <!-- Text colors -->
    <item name="cometchatTextColorPrimary">@color/textPrimary</item>
    <item name="cometchatTextColorSecondary">@color/textSecondary</item>
    <!-- ... -->

    <!-- Icon tints -->
    <item name="cometchatIconTintPrimary">@color/iconPrimary</item>
    <!-- ... -->

    <!-- Button colors -->
    <item name="cometchatPrimaryButtonBackgroundColor">@color/primary</item>
    <item name="cometchatPrimaryButtonIconTint">@color/white</item>
    <item name="cometchatPrimaryButtonTextColor">@color/white</item>
    <!-- ... -->
</style>
```

## 3. Color Token Reference

### 3.1 Primary Colors

| Getter | Setter | XML Attr |
|---|---|---|
| `getPrimaryColor(ctx)` | `setPrimaryColor(color)` | `cometchatPrimaryColor` |

### 3.2 Extended Primary (auto-generated from primary)

| Getter | Setter | XML Attr |
|---|---|---|
| `getExtendedPrimaryColor50(ctx)` | `setExtendedPrimaryColor50(color)` | `cometchatExtendedPrimaryColor50` |
| ... through 900 | ... | ... |

Extended primary colors auto-generate by blending primary with white (day) or black (night) if not explicitly set.

### 3.3 Neutral Colors

`getNeutralColor50(ctx)` through `getNeutralColor900(ctx)` with corresponding setters and XML attrs `cometchatNeutralColor50` through `cometchatNeutralColor900`.

### 3.4 Alert Colors

| Getter | Setter | XML Attr |
|---|---|---|
| `getSuccessColor(ctx)` | `setSuccessColor(color)` | `cometchatSuccessColor` |
| `getErrorColor(ctx)` | `setErrorColor(color)` | `cometchatErrorColor` |
| `getWarningColor(ctx)` | `setWarningColor(color)` | `cometchatWarningColor` |
| `getInfoColor(ctx)` | `setInfoColor(color)` | `cometchatInfoColor` |
| `getMessageReadColor(ctx)` | `setMessageReadColor(color)` | `cometchatMessageReadColor` |

### 3.5 Background, Stroke, Text, Icon, Button Colors

All follow the same pattern: `get{Token}(ctx)` / `set{Token}(color)` / `cometchat{Token}` XML attr. Defaults fall back to neutral scale values if not explicitly set.

Border color aliases: `getBorderColorLight()` = `getStrokeColorLight()`, `getBorderColorDefault()` = `getStrokeColorDefault()`, `getBorderColorDark()` = `getStrokeColorDark()`. Note: `StrokeColor` also has a `Highlight` variant (`getStrokeColorHighlight()`); there is **no** `getBorderColorHighlight()`.

## 4. Typography

```kotlin
// Get text appearance resource IDs
val titleBold: Int = CometChatTheme.getTextAppearanceTitleBold(context)
val bodyRegular: Int = CometChatTheme.getTextAppearanceBodyRegular(context)
val heading1Medium: Int = CometChatTheme.getTextAppearanceHeading1Medium(context)
// ... combinations: Title, Heading1-4, Body, Caption1-2, Button each have Regular/Medium/Bold.
// Link is the exception — only getTextAppearanceLinkRegular(context) exists (no Medium/Bold).

// Get font resource IDs
val regularFont: Int = CometChatTheme.getFontRegular(context)
val mediumFont: Int = CometChatTheme.getFontMedium(context)
val boldFont: Int = CometChatTheme.getFontBold(context)
```

Override via XML attrs: `cometchatTextAppearanceTitleBold`, `cometchatFontRegular`, etc.

## 5. Dark Mode

Dark mode is detected via `Configuration.UI_MODE_NIGHT_MASK`:

```kotlin
val nightMode = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
val isDark = nightMode == Configuration.UI_MODE_NIGHT_YES
```

The theme automatically:
- Uses day/night qualified XML resources
- Blends extended primary colors with white (day) or black (night)
- Falls back to appropriate neutral scale for each mode

For programmatic overrides, set colors after detecting the mode:

```kotlin
if (isDark) {
    CometChatTheme.setPrimaryColor(Color.parseColor("#BB86FC"))
} else {
    CometChatTheme.setPrimaryColor(Color.parseColor("#6851D6"))
}
```

## 6. Theme Cache

Programmatic overrides are cached in memory. Clear the cache when the theme changes:

```kotlin
CometChatTheme.clearCache()
```

Call this when:
- The user switches between light and dark mode at runtime
- You dynamically change the primary color
- The Activity recreates with a new theme

## 7. Static Colors

```kotlin
val white: Int = CometChatTheme.getColorWhite(context)
val black: Int = CometChatTheme.getColorBlack(context)
val transparent: Int = CometChatTheme.getColorTransparent(context)
```

## Localization

To translate the UI, switch the active language, or override individual strings, route to the dedicated **`cometchat-i18n`** skill — the canonical cross-family localization reference. Android uses `CometChatLocalize.setLocale(context, Language.Code.<lang>)` / `getLocale(context)` (a separate method, **not** an `init` object — unlike web/RN). `cometchat-i18n` covers bundled languages, custom translations, and RTL. Docs: https://www.cometchat.com/docs/ui-kit/android/localize

## Sound Manager — custom notification & call sounds

Sounds are a **behavioral** customization — driven by `CometChatSoundManager`, an **instance** class that needs a `Context`. The UI Kit plays the built-in cues automatically; use this to override a cue with your own raw resource. V6 package (NOT the V5 `com.cometchat.chatuikit.*` path):

```kotlin
import com.cometchat.uikit.core.resources.soundmanager.CometChatSoundManager
import com.cometchat.uikit.core.resources.soundmanager.Sound

val soundManager = CometChatSoundManager(context)

// Play a default cue — Sound enum is SCREAMING_SNAKE_CASE: INCOMING_CALL |
//   OUTGOING_CALL | INCOMING_MESSAGE | INCOMING_MESSAGE_FROM_OTHER | OUTGOING_MESSAGE
soundManager.play(Sound.INCOMING_CALL)

// Override with your own raw resource (R.raw.*)
soundManager.play(Sound.INCOMING_MESSAGE, R.raw.my_ping)

// Stop whatever is playing
soundManager.pause()
```

## Hard rules

- ALWAYS pass a valid `Context` to getter methods — they resolve XML attributes from the theme
- Call `CometChatTheme.clearCache()` after programmatic theme changes to ensure fresh values
- Programmatic setters (`setPrimaryColor()`, etc.) take priority over XML attributes
- Extended primary colors auto-generate from the primary color — only override them if you need specific shades
- Do NOT mix Compose `CometChatTheme.colorScheme` with Views `CometChatTheme.getPrimaryColor(ctx)` — they are separate theme systems in separate modules
