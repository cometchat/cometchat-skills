---
name: cometchat-flutter-v6-theming
description: >
  Use when customizing the visual appearance of CometChat Flutter UIKit v6 components.
  Triggers on mentions of CometChatThemeHelper, CometChatColorPalette, CometChatSpacing,
  CometChatTypography, CometChatThemeMode, dark mode, light mode, theme, colors, styling,
  custom theme, Style class, merge(), getColorPalette, getSpacing, getTypography,
  ThemeExtension, primary color, neutral colors, background colors, text colors, icon colors,
  button colors, border colors, or any CometChat{Component}Style class. Also use when the
  user asks about changing colors, fonts, spacing, or appearance of chat components.
license: "MIT"
compatibility: "cometchat_chat_uikit ^6.0.1; flutter >=2.5.0"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter theme colors typography spacing dark-mode styling"
---

> **Ground truth:** `cometchat_chat_uikit: ^6.0` — pub-cache source + `ui-kit/flutter`. **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

# CometChat Flutter UIKit — Theming & Styling

How to customize the visual appearance of all CometChat components.

## Theme System Architecture

Three layers, resolved via Flutter's `ThemeExtension` system:

1. `CometChatColorPalette` — all colors (primary, neutral, alert, background, text, icon, button, border)
2. `CometChatSpacing` — spacing tokens
3. `CometChatTypography` — text styles (heading1-4, body, caption1-2, button, link, title)

Access via static helpers:
```dart
final colors = CometChatThemeHelper.getColorPalette(context);
final spacing = CometChatThemeHelper.getSpacing(context);
final typography = CometChatThemeHelper.getTypography(context);
```

## Applying a Custom Theme

Register `CometChatColorPalette` as a `ThemeExtension` on your `ThemeData`:

```dart
MaterialApp(
  theme: ThemeData(
    brightness: Brightness.light,
    extensions: [
      CometChatColorPalette(
        primary: const Color(0xFF6852D6),
        background1: Colors.white,
        textPrimary: const Color(0xFF141414),
        // ... override only what you need, rest falls back to defaults
      ),
    ],
  ),
  darkTheme: ThemeData(
    brightness: Brightness.dark,
    extensions: [
      CometChatColorPalette(
        primary: const Color(0xFF604CC3),
        background1: const Color(0xFF141414),
        textPrimary: Colors.white,
      ),
    ],
  ),
)
```

Note: `CometChatColorPalette` does NOT have a `const` constructor (it has mutable default fields for `white`, `black`, `transparent`). Don't try `const CometChatColorPalette(...)` — it won't compile.

## Dark Mode

`CometChatThemeMode` controls how brightness is resolved:

```dart
// Follow system setting (default)
CometChatThemeMode.mode = ThemeMode.system;

// Force light
CometChatThemeMode.mode = ThemeMode.light;

// Force dark
CometChatThemeMode.mode = ThemeMode.dark;
```

The helper reads brightness via:
```dart
// ThemeMode.system → MediaQuery.of(context).platformBrightness
// ThemeMode.light → Brightness.light
// ThemeMode.dark → Brightness.dark
```

## Color Palette Tokens

| Category | Tokens | Default Source |
|----------|--------|---------------|
| Primary | `primary` | `#6852D6` light / `#604CC3` dark |
| Extended Primary | `extendedPrimary50`–`900` | Auto-generated from primary via blend |
| Neutral | `neutral50`–`900` | 10-shade grayscale |
| Alert | `info`, `warning`, `error`, `success`, `error100` | Semantic colors |
| Background | `background1`–`4` | Mapped from neutral shades |
| Text | `textPrimary`, `textSecondary`, `textTertiary`, `textDisabled`, `textWhite`, `textHighlight` | Mapped from neutral/primary |
| Icon | `iconPrimary`, `iconSecondary`, `iconTertiary`, `iconWhite`, `iconHighlight` | Mapped from neutral/primary |
| Button | `buttonBackground`, `secondaryButtonBackground`, `buttonText`, `buttonIconColor`, `secondaryButtonText`, `secondaryButtonIcon` | Primary + neutral |
| Border | `borderLight`, `borderDefault`, `borderDark`, `borderHighlight` | Neutral shades + primary |
| Special | `white`, `black`, `messageSeen` | Fixed values |

## Component Style Classes

Every component has a `CometChat{Component}Style` class with a `merge()` method:

```dart
CometChatConversations(
  conversationsStyle: CometChatConversationsStyle(
    backgroundColor: colors.background1,
    titleTextStyle: typography.heading3?.bold,
  ),
)

CometChatMessageList(
  style: CometChatMessageListStyle(
    backgroundColor: colors.background3,
  ),
)
```

Style classes support `merge()` for combining defaults with overrides:
```dart
final baseStyle = CometChatConversationsStyle(backgroundColor: Colors.white);
final override = CometChatConversationsStyle(titleTextStyle: myTitleStyle);
final merged = baseStyle.merge(override); // backgroundColor + titleTextStyle
```

## Theme Caching (Performance-Critical)

Cache theme in `didChangeDependencies()` — never in `build()`:

> **Trade-off (vs the Flutter V5 theming skill, which forbids this flag):** the
> `_themeInitialized` guard caches the palette once and skips re-reads on every
> `didChangeDependencies()` (e.g. keyboard animations) — but it also means a
> runtime **system light↔dark switch won't re-resolve** the cached palette. If
> your app supports live theme switching, either drop the flag (re-read every
> call, as V5 recommends) or also invalidate it from `didChangePlatformBrightness`.
> The flag is the right default for apps with a fixed theme mode.

```dart
class _MyWidgetState extends State<MyWidget> {
  late CometChatColorPalette _colorPalette;
  bool _themeInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_themeInitialized) {
      _colorPalette = CometChatThemeHelper.getColorPalette(context);
      _themeInitialized = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(color: _colorPalette.primary); // Cached, no lookup
  }
}
```

For child widgets that receive theme from parent (hybrid pattern):
```dart
class CometChatImageBubble extends StatefulWidget {
  final CometChatColorPalette? colorPalette; // Optional — parent can pass cached value
  // ...
}

class _CometChatImageBubbleState extends State<CometChatImageBubble> {
  late CometChatColorPalette colorPalette;
  bool _themeInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_themeInitialized) {
      colorPalette = widget.colorPalette ?? CometChatThemeHelper.getColorPalette(context);
      _themeInitialized = true;
    }
  }

  @override
  void didUpdateWidget(CometChatImageBubble oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.colorPalette != oldWidget.colorPalette && widget.colorPalette != null) {
      colorPalette = widget.colorPalette!;
    }
  }
}
```

## Localization

To translate the UI, switch the active language, or override individual strings, route to the dedicated **`cometchat-i18n`** skill — the canonical cross-family localization reference. Flutter has **no `CometChatLocalize` class**: localization is wired via the kit's `Translations` localization delegate on `MaterialApp` (drive the language through the app `Locale`). `cometchat-i18n` covers bundled languages, custom translations, RTL, and date/time formatting. Docs: https://www.cometchat.com/docs/ui-kit/flutter/localize

## Sound Manager — custom notification & call sounds

Sounds are a **behavioral** customization — driven by `SoundManager` (note: `SoundManager`, NOT `CometChatSoundManager`, and the stop method is `stop()`, NOT `pause()`). The UI Kit plays the built-in cues automatically; use this to override a cue with a custom asset.

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

// Play a default cue — Sound: incomingMessage | outgoingMessage
//                       | incomingMessageFromOther | incomingCall | outgoingCall
SoundManager().play(sound: Sound.incomingMessage);

// Override with a custom asset
SoundManager().play(sound: Sound.outgoingMessage, customSound: "assets/sound/my_ping.wav");

// Stop whatever is playing
SoundManager().stop();
```

> For the common case (muting/replacing message sounds), prefer the **widget-level** props instead of the manager: in V6 `CometChatConversations` exposes `disableSoundForMessages` and `customSoundForMessages`.

## Gotchas

- `CometChatColorPalette` is NOT const-constructible. It has mutable default fields (`white = Colors.white`, `black = Colors.black`, `transparent = Colors.transparent`). Writing `const CometChatColorPalette(...)` or `const [CometChatColorPalette()]` won't compile.
- `CometChatThemeHelper.getColorPalette(context)` does `Theme.of(context).extension<CometChatColorPalette>()` internally — this is an InheritedWidget lookup. In `build()` during keyboard animation, this fires every frame causing 44-95ms build times.
- Extended primary colors are auto-generated by blending `primary` with white (light) or black (dark). Override individual shades only if the auto-blend doesn't match your brand.
- `CometChatThemeMode.mode` is a static field — changing it doesn't trigger rebuilds. You need to also change `ThemeData` brightness or call `setState` on the `MaterialApp`.
- Style `merge()` is null-aware: only non-null fields from the override replace the base. This means you can't explicitly set a field to `null` via merge.

## Anti-Patterns

```dart
// ❌ WRONG — hardcoded colors
Container(color: Colors.purple)

// ✅ CORRECT — use theme tokens
Container(color: colorPalette.primary)
```

```dart
// ❌ WRONG — theme lookup in build
@override
Widget build(BuildContext context) {
  final colors = CometChatThemeHelper.getColorPalette(context);
  return Text('Hi', style: TextStyle(color: colors.textPrimary));
}

// ❌ ALSO WRONG — theme lookup in a method called from build
Widget _buildProfileMenu() {
  final typography = CometChatThemeHelper.getTypography(context); // Still in build tree!
  final spacing = CometChatThemeHelper.getSpacing(context);
  // ...
}

// ✅ CORRECT — cached in didChangeDependencies
late CometChatColorPalette _colors;
late CometChatTypography _typography;
late CometChatSpacing _spacing;
bool _init = false;
@override
void didChangeDependencies() {
  super.didChangeDependencies();
  if (!_init) {
    _colors = CometChatThemeHelper.getColorPalette(context);
    _typography = CometChatThemeHelper.getTypography(context);
    _spacing = CometChatThemeHelper.getSpacing(context);
    _init = true;
  }
}
@override
Widget build(BuildContext context) {
  return Text('Hi', style: TextStyle(color: _colors.textPrimary));
}
```

```dart
// ❌ WRONG — MediaQuery.of(context).size triggers full rebuild
final size = MediaQuery.of(context).size;

// ✅ CORRECT — only subscribes to size changes
final size = MediaQuery.sizeOf(context);
```

## Checklist

- [ ] Custom colors registered as `ThemeExtension` on `ThemeData`
- [ ] Both `theme` and `darkTheme` configured if supporting dark mode
- [ ] Theme values cached in `didChangeDependencies()`, not `build()`
- [ ] No `CometChatThemeHelper.get*()` calls in any method invoked during `build()` (including helper methods like `_buildProfileMenu()`)
- [ ] `_themeInitialized` flag prevents re-init during keyboard animation
- [ ] No hardcoded colors — all from `CometChatColorPalette`
- [ ] `MediaQuery.sizeOf(context)` used instead of `MediaQuery.of(context).size`
- [ ] Style overrides use component's Style class, not inline styles
