---
name: cometchat-flutter-v5-theming
description: "Use when customizing the visual appearance of CometChat Flutter UIKit v5 components. Triggers on CometChatThemeHelper, CometChatColorPalette, CometChatSpacing, CometChatTypography, Style classes, merge()."
license: "MIT"
compatibility: "cometchat_uikit_shared ^5.2.3; flutter >=2.5.0"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 theme colors typography spacing dark-mode styling"
---

# CometChat Flutter UIKit v5 — Theming & Styling

How to customize the visual appearance of all CometChat v5 components.

## Theme System Architecture

Three layers, resolved via Flutter's `ThemeExtension` system:

1. `CometChatColorPalette` — colors (primary, neutral, alert, background, text, icon, button, border)
2. `CometChatSpacing` — spacing, padding, margin, and radius tokens
3. `CometChatTypography` — text styles (heading1-4, body, caption1-2, button, link, title)

Access via static helpers:
```dart
final colors = CometChatThemeHelper.getColorPalette(context);
final spacing = CometChatThemeHelper.getSpacing(context);
final typography = CometChatThemeHelper.getTypography(context);
```

**Important:** `getColorPalette()` creates a new object every call, resolving each token via `Theme.of(context)`. Cache in `didChangeDependencies()`, never call in `build()`.

## Applying a Custom Theme

Register `CometChatColorPalette` as a `ThemeExtension` on your `ThemeData`:

```dart
// ✅ CORRECT
MaterialApp(
  theme: ThemeData(
    extensions: [
      CometChatColorPalette(
        primary: const Color(0xFF6852D6),
        textPrimary: const Color(0xFF141414),
        textSecondary: const Color(0xFF727272),
      ),
    ],
  ),
  darkTheme: ThemeData(
    extensions: [
      CometChatColorPalette(
        primary: const Color(0xFF604CC3),
        textPrimary: const Color(0xFFFFFFFF),
        textSecondary: const Color(0xFFA0A0A0),
      ),
    ],
  ),
)
```

## Dark Mode

```dart
CometChatThemeMode.mode = ThemeMode.dark;   // Force dark
CometChatThemeMode.mode = ThemeMode.system;  // Follow system
```

## Commonly Used Color Tokens

| Token | Description | Light Default | Dark Default |
|-------|-------------|---------------|--------------|
| `primary` | Brand color | `#6852D6` | `#604CC3` |
| `background1`–`4` | Surface backgrounds | neutral50→neutral300 | neutral50→neutral300 |
| `textPrimary` | Main text | neutral900 | neutral900 |
| `textSecondary` | Secondary text | neutral600 | neutral600 |
| `borderLight` | Subtle borders | neutral200 | neutral200 |
| `iconPrimary` | Main icons | neutral900 | neutral900 |
| `iconSecondary` | Secondary icons | neutral500 | neutral500 |
| `iconHighlight` | Highlighted icons | primary | primary |
| `error` | Error states | `#F44649` | `#C73C3E` |
| `white` / `black` | Fixed (NOT brightness-aware) | `Colors.white` / `Colors.black` | Same |
| `transparent` | Transparent | `Colors.transparent` | Same |
| `neutral600` | Used for date styles | — | — |

Extended primary shades (`extendedPrimary50`–`900`) are auto-generated from `primary`. Override individually if needed.

## Commonly Used Spacing Tokens

| Token | Default |
|-------|---------|
| `padding` / `spacing` / `radius` | 2 |
| `padding1` / `spacing1` / `radius1` | 4 |
| `padding2` / `spacing2` / `radius2` | 8 |
| `padding3` / `spacing3` / `radius3` | 12 |
| `padding4` / `spacing4` / `radius4` | 16 |
| `padding5` / `spacing5` / `radius5` | 20 |
| `padding6` / `spacing6` | 24 |
| `radiusMax` / `spacingMax` | 1000 |

## Typography Tokens

`CometChatTypography` provides: `heading1`–`heading4`, `body`, `caption1`, `caption2`, `button`, `link`, `title`.

Each has `.bold`, `.medium`, `.regular` variants:
```dart
typography.body?.regular?.fontSize
typography.heading2?.bold?.fontWeight
typography.caption1?.regular?.fontFamily
```

## Theme Caching Pattern (from package source)

All UIKit components cache theme unconditionally in `didChangeDependencies()`:

```dart
// ✅ CORRECT — matches actual package pattern
@override
void didChangeDependencies() {
  super.didChangeDependencies();
  colorPalette = CometChatThemeHelper.getColorPalette(context);
  spacing = CometChatThemeHelper.getSpacing(context);
  typography = CometChatThemeHelper.getTypography(context);
}
```

Do NOT use a `_themeInitialized` flag — it prevents theme updates on system theme changes.

## Component Style Classes — merge() Pattern

Every component has a `CometChat{Component}Style` extending `ThemeExtension`. Resolved internally:

```dart
// Inside component's didChangeDependencies():
style = CometChatThemeHelper.getTheme<CometChatConversationsStyle>(
    context: context,
    defaultTheme: CometChatConversationsStyle.of,
).merge(widget.conversationsStyle);
```

Pass overrides via constructor:
```dart
CometChatConversations(
  conversationsStyle: CometChatConversationsStyle(
    backgroundColor: Colors.black,
  ),
)
```

## Gotchas

- `colorPalette.white` / `black` / `transparent` are NOT brightness-aware — use `neutral50` for brightness-aware white
- Extended primary shades auto-generated from `primary` by blending with white (light) or black (dark)

## Checklist — Theming

- [ ] Colors from `CometChatThemeHelper.getColorPalette(context)`, never hardcoded
- [ ] Theme cached in `didChangeDependencies()`, not `build()`
- [ ] Custom theme registered as `ThemeExtension` on both `theme` and `darkTheme`
- [ ] Component styles passed via constructor props
