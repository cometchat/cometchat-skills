---
name: cometchat-android-v6-compose-theming
description: "CometChat Android UIKit v6 Jetpack Compose theming — CometChatTheme, CompositionLocal color schemes, typography, shapes, and dark mode"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, compose, theming, colors, typography, dark-mode"
---

> **Companion skills:** cometchat-android-v6-kotlin-theming (Views equivalent), cometchat-android-v6-compose-components, cometchat-android-v6-compose-customization

## Purpose

Apply and customize the CometChat theme in Jetpack Compose — color schemes, typography, shapes, dark mode, and per-component style overrides using the `CompositionLocal`-based theme system.

## Use this skill when

- Wrapping CometChat components in `CometChatTheme {}`
- Changing the primary color or color scheme
- Implementing dark mode support
- Customizing typography or shapes
- Accessing theme tokens in custom composables

## Do not use this skill when

- Working with Kotlin Views theming (use `cometchat-android-v6-kotlin-theming`)
- Customizing bubble rendering (use `cometchat-android-v6-compose-customization`)

## 1. CometChatTheme Wrapper

All CometChat Compose components must be wrapped in `CometChatTheme {}`:

```kotlin
import com.cometchat.uikit.compose.theme.CometChatTheme

setContent {
    CometChatTheme {
        // CometChat components go here
        CometChatConversations()
    }
}
```

`CometChatTheme` is a composable that provides theme values via `CompositionLocalProvider`:
- `LocalColorScheme` → `CometChatColorScheme`
- `LocalTypography` → `CometChatTypography`
- `LocalShapes` → `Shapes`

## 2. Color Scheme

### 2.1 Default Light/Dark Schemes

```kotlin
import com.cometchat.uikit.compose.theme.*

// Light mode (default)
CometChatTheme(colorScheme = lightColorScheme()) {
    // ...
}

// Dark mode
CometChatTheme(colorScheme = darkColorScheme()) {
    // ...
}

// Auto based on system setting
CometChatTheme(
    colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()
) {
    // ...
}
```

### 2.2 Custom Primary Color

```kotlin
CometChatTheme(
    colorScheme = lightColorScheme(primary = Color(0xFF6851D6))
) {
    // All extended primary colors (50-900) auto-generate from the primary
}
```

### 2.3 CometChatColorScheme Token Reference

The `CometChatColorScheme` class contains these token groups:

**Primary Colors:**
- `primary` — Main brand color

**Extended Primary (auto-generated from primary):**
- `extendedPrimaryColor50` through `extendedPrimaryColor900` — 10 shades blended with white (light) or black (dark)

**Neutral Colors:**
- `neutralColor50` through `neutralColor900` — 10 neutral shades

**Alert Colors:**
- `infoColor`, `successColor`, `warningColor`, `errorColor`, `messageReadColor`

**Background Colors:**
- `backgroundColor1` (lightest) through `backgroundColor4` (darkest)

**Stroke/Border Colors:**
- `strokeColorDefault`, `strokeColorLight`, `strokeColorDark`, `strokeColorHighlight`
- Aliases: `borderColorLight`, `borderColorDefault`, `borderColorDark`, `borderColorHighlight`

**Text Colors:**
- `textColorPrimary`, `textColorSecondary`, `textColorTertiary`, `textColorDisabled`, `textColorWhite`, `textColorHighlight`

**Icon Tint Colors:**
- `iconTintPrimary`, `iconTintSecondary`, `iconTintTertiary`, `iconTintWhite`, `iconTintHighlight`

**Button Colors:**
- `primaryButtonBackgroundColor`, `primaryButtonIconTint`, `primaryButtonTextColor`
- `secondaryButtonBackgroundColor`, `secondaryButtonIconTint`, `secondaryButtonTextColor`
- `linkButtonColor`, `fabButtonBackgroundColor`, `fabButtonIconTint`, `whiteButtonPressed`

**Static Colors:**
- `colorWhite`, `colorBlack`

### 2.4 Fully Custom Color Scheme

```kotlin
val customScheme = lightColorScheme(
    primary = Color(0xFF6851D6),
    neutralColor50 = Color(0xFFFAFAFA),
    neutralColor900 = Color(0xFF141414),
    errorColor = Color(0xFFFF3B30),
    successColor = Color(0xFF34C759),
    // ... override any token
)

CometChatTheme(colorScheme = customScheme) {
    // ...
}
```

## 3. Typography

```kotlin
// Access typography in composables
val style: TextStyle = CometChatTheme.typography.heading1Bold
val bodyStyle: TextStyle = CometChatTheme.typography.bodyRegular
val titleStyle: TextStyle = CometChatTheme.typography.titleRegular
```

Custom typography:

```kotlin
CometChatTheme(
    typography = CometChatTypography(/* custom TextStyles */)
) {
    // ...
}
```

## 4. Shapes

```kotlin
// Access shapes
val shapes: Shapes = CometChatTheme.shapes

// Custom shapes
CometChatTheme(
    shapes = Shapes(/* custom corner radii */)
) {
    // ...
}
```

## 5. Accessing Theme in Custom Composables

```kotlin
@Composable
fun MyCustomView() {
    val colors = CometChatTheme.colorScheme
    val typography = CometChatTheme.typography

    Text(
        text = "Hello",
        color = colors.textColorPrimary,
        style = typography.bodyRegular
    )

    Box(
        modifier = Modifier.background(colors.backgroundColor1)
    )
}
```

## 6. Extended Primary Color Generation

Extended primary colors are auto-generated by blending the primary color with white (light mode) or black (dark mode):

```kotlin
// Light mode: primary blended with white at various percentages
// extendedPrimaryColor50 = blend(primary, white, 0.96)  // lightest
// extendedPrimaryColor500 = blend(primary, white, 0.44) // mid
// extendedPrimaryColor900 = blend(primary, black, 0.08) // darkest

// Dark mode: primary blended with black at various percentages
// extendedPrimaryColor50 = blend(primary, black, 0.80)  // lightest
// extendedPrimaryColor900 = blend(primary, white, 0.11) // lightest in dark
```

You can override individual extended colors:

```kotlin
lightColorScheme(
    primary = Color(0xFF6851D6),
    extendedPrimaryColor500 = Color(0xFF9B8AE0) // manual override
)
```

## Hard rules

- ALWAYS wrap CometChat Compose components in `CometChatTheme {}` — components will crash or look wrong without it
- NEVER use Material `MaterialTheme` tokens inside CometChat components — use `CometChatTheme.colorScheme` / `.typography` / `.shapes`
- `CometChatTheme` does NOT extend `MaterialTheme` — they are separate theme systems
- When overriding just the primary color, extended primary colors auto-regenerate — you don't need to set all 10 shades
- `lightColorScheme()` and `darkColorScheme()` are factory functions, not data class constructors — use named parameters to override specific tokens
