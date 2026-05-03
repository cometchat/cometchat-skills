---
name: cometchat-angular-theming
description: "CometChatThemeService palette — color tokens, light/dark mode, typography, per-component style objects, and CSS variable overrides for the CometChat Angular UI Kit v4."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular theming colors dark-mode typography palette css-variables"
---

## Purpose

Teaches Claude how to theme the CometChat Angular UI Kit v4 via `CometChatThemeService` and per-component style objects. Covers palette tokens, light/dark mode switching, typography, per-component style classes, CSS variable overrides, and preset themes.

**Read `cometchat-angular-core` first** — `CometChatThemeService` is injected in `AppComponent`'s constructor, which is covered there.

Ground truth: `docs/ui-kit/angular/theme`, `docs/ui-kit/angular/colors`, `docs/ui-kit/angular/component-styling`, and `@cometchat/chat-uikit-angular@4.x` style exports.

---

## 0. Preset themes (quickest start)

Five built-in presets. Apply by setting these CSS variables in `src/styles.scss` after any existing imports:

| Preset | `--cometchat-primary-color` | `--cometchat-font-family` | `--cometchat-background-color-01` | `--cometchat-text-color-primary` | Notes |
|---|---|---|---|---|---|
| `slack` | `#611f69` | `Lato, sans-serif` | `#ffffff` | `#1d1c1d` | |
| `whatsapp` | `#25d366` | `'Segoe UI', Helvetica, sans-serif` | `#f0f2f5` | `#111b21` | |
| `imessage` | `#007aff` | `-apple-system, 'SF Pro Text', sans-serif` | `#ffffff` | `#000000` | |
| `discord` | `#5865f2` | `'gg sans', 'Noto Sans', Helvetica, sans-serif` | `#36393f` | `#dcddde` | Dark mode built-in |
| `notion` | `#2eaadc` | `-apple-system, Helvetica, sans-serif` | `#ffffff` | `#37352f` | |

Example — apply the Slack preset:

```scss
/* src/styles.scss — after existing imports */
:root {
  --cometchat-primary-color: #611f69;
  --cometchat-font-family: Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --cometchat-background-color-01: #ffffff;
  --cometchat-text-color-primary: #1d1c1d;
}
```

Also set the matching `CometChatThemeService` palette so the Angular DI layer stays in sync:

```typescript
// AppComponent constructor:
themeService.theme.palette.setPrimary({ light: "#611f69", dark: "#611f69" });
```

---

## 1. How theming works in Angular

The Angular UI Kit uses two mechanisms for theming:

1. **`CometChatThemeService`** — Angular DI service that controls the global palette (primary color, mode). Inject once in `AppComponent`.
2. **Per-component style objects** — typed style classes (`ConversationsStyle`, `MessageListStyle`, etc.) passed as `[*Style]` inputs to individual components.

```
CometChatThemeService (global palette)
  ↓
every <cometchat-*> component reads palette via the service
  ↓
component's default styles merge with palette + per-component style overrides
```

### Style precedence (highest to lowest)

1. **Per-component `[*Style]` input** — wins always. Per-component tweak.
2. **`CometChatThemeService` palette** — app-wide primary color + mode.
3. **Default theme** — the UI Kit's built-in palette.

---

## 2. CometChatThemeService — global palette

Inject in `AppComponent`'s constructor (not `ngOnInit` — the palette must be set before any component renders):

```typescript
import { Component } from "@angular/core";
import { CometChatThemeService } from "@cometchat/chat-uikit-angular";

@Component({ selector: "app-root", templateUrl: "./app.component.html" })
export class AppComponent {
  constructor(private themeService: CometChatThemeService) {
    // Set mode
    themeService.theme.palette.setMode("light");  // "light" | "dark"

    // Set primary brand color (light + dark variants)
    themeService.theme.palette.setPrimary({ light: "#6851D6", dark: "#6851D6" });

    // Optional: set accent color
    themeService.theme.palette.setAccent({ light: "#F76808", dark: "#FF8A3D" });
  }
}
```

### Dynamic mode switching

```typescript
@Component({ /* ... */ })
export class AppComponent {
  constructor(private themeService: CometChatThemeService) {}

  toggleDarkMode(isDark: boolean): void {
    this.themeService.theme.palette.setMode(isDark ? "dark" : "light");
  }
}
```

The palette change propagates to all rendered CometChat components immediately — no page reload needed.

---

## 3. Color tokens

### Primary (brand accent)

| Method | Controls |
|---|---|
| `setPrimary({ light, dark })` | Outgoing message bubbles, send button, active tabs, buttons |
| `setAccent({ light, dark })` | Secondary accent — links, highlights |

Both methods take `{ light: "#hex", dark: "#hex" }`. Always provide both variants.

### Mode

| Mode | Effect |
|---|---|
| `"light"` | Light backgrounds, dark text |
| `"dark"` | Dark backgrounds, light text |

### Palette methods reference

```typescript
themeService.theme.palette.setMode("light" | "dark");
themeService.theme.palette.setPrimary({ light: "#hex", dark: "#hex" });
themeService.theme.palette.setAccent({ light: "#hex", dark: "#hex" });
themeService.theme.palette.setBackground({ light: "#hex", dark: "#hex" });
themeService.theme.palette.setSecondary({ light: "#hex", dark: "#hex" });
```

---

## 4. Per-component style objects

Each component accepts a typed style object. Import from `@cometchat/uikit-shared`:

```typescript
import {
  ConversationsStyle,
  MessagesStyle,
  MessageListStyle,
  MessageComposerStyle,
  MessageHeaderStyle,
  UsersStyle,
  GroupsStyle,
  AvatarStyle,
  BadgeStyle,
  StatusIndicatorStyle,
  ListItemStyle,
  DateStyle,
  BackdropStyle,
  ConfirmDialogStyle,
  LoaderStyle,
} from "@cometchat/uikit-shared";
```

### ConversationsStyle

```typescript
conversationsStyle = new ConversationsStyle({
  width: "100%",
  height: "100%",
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  background: "#ffffff",
  titleTextFont: "600 18px Inter, sans-serif",
  titleTextColor: "#141414",
  lastMessageTextFont: "400 14px Inter, sans-serif",
  lastMessageTextColor: "#727272",
  typingIndictorTextColor: "#6851D6",
  onlineStatusColor: "#09C26F",
  privateGroupIconBackground: "#F76808",
  passwordGroupIconBackground: "#FFAB00",
});
```

```html
<cometchat-conversations [conversationsStyle]="conversationsStyle"></cometchat-conversations>
```

### MessageListStyle

```typescript
messageListStyle = new MessageListStyle({
  width: "100%",
  height: "100%",
  background: "#fafafa",
  border: "none",
  // Bubble colors
  sendBubbleBackground: "#6851D6",
  sendBubbleTextColor: "#ffffff",
  sendBubbleTextFont: "400 15px Inter, sans-serif",
  receiveBubbleBackground: "#f0f0f0",
  receiveBubbleTextColor: "#141414",
  receiveBubbleTextFont: "400 15px Inter, sans-serif",
});
```

### MessageComposerStyle

```typescript
messageComposerStyle = new MessageComposerStyle({
  width: "100%",
  background: "#ffffff",
  border: "1px solid #e8e8e8",
  borderRadius: "0",
  inputBackground: "#f5f5f5",
  inputBorder: "none",
  inputBorderRadius: "8px",
  textFont: "400 15px Inter, sans-serif",
  textColor: "#141414",
  placeHolderTextColor: "#a1a1a1",
  sendIconTint: "#6851D6",
  attachmentIconTint: "#727272",
});
```

### AvatarStyle

```typescript
avatarStyle = new AvatarStyle({
  width: "40px",
  height: "40px",
  border: "none",
  borderRadius: "50%",
  backgroundColor: "#6851D6",
  nameTextColor: "#ffffff",
  nameTextFont: "600 16px Inter, sans-serif",
  backgroundSize: "cover",
});
```

### BadgeStyle

```typescript
badgeStyle = new BadgeStyle({
  background: "#6851D6",
  textColor: "#ffffff",
  textFont: "600 11px Inter, sans-serif",
  border: "none",
  borderRadius: "10px",
  width: "20px",
  height: "20px",
});
```

---

## 5. Common theming recipes

### Match a brand color (most common)

```typescript
// In AppComponent constructor:
themeService.theme.palette.setPrimary({ light: "#FF6B35", dark: "#FF8F66" });
```

This single call changes the outgoing message bubble color, send button, active tab indicator, and every primary accent in the UI.

### Dark mode + custom brand

```typescript
themeService.theme.palette.setMode("dark");
themeService.theme.palette.setPrimary({ light: "#6851D6", dark: "#A594F3" });
themeService.theme.palette.setBackground({ light: "#ffffff", dark: "#1a1a1a" });
```

### Custom message bubble colors

```typescript
messageListStyle = new MessageListStyle({
  sendBubbleBackground: "#FF6B35",
  sendBubbleTextColor: "#ffffff",
  receiveBubbleBackground: "#f0f0f0",
  receiveBubbleTextColor: "#1a1a1a",
});
```

### Custom font across the whole UI

The Angular UI Kit reads font from CSS. Override via global styles:

```css
/* styles.css (global) */
:root {
  --cometchat-font-family: "Inter", sans-serif;
}
```

Or pass `textFont` / `titleTextFont` in each component's style object.

---

## 6. CSS variable overrides

The Angular UI Kit exposes CSS custom properties for fine-grained control. Override in `styles.css` (global):

```css
/* styles.css */
:root {
  /* Primary color */
  --cometchat-primary-color: #6851D6;

  /* Background colors */
  --cometchat-background-color-01: #ffffff;
  --cometchat-background-color-02: #fafafa;
  --cometchat-background-color-03: #f5f5f5;

  /* Text colors */
  --cometchat-text-color-primary: #141414;
  --cometchat-text-color-secondary: #727272;
  --cometchat-text-color-tertiary: #a1a1a1;

  /* Border */
  --cometchat-border-color-default: #e8e8e8;

  /* Font */
  --cometchat-font-family: "Inter", sans-serif;
}
```

CSS variable overrides apply globally and take effect immediately. Use them for app-wide changes that the `CometChatThemeService` palette methods don't cover.

---

## 7. Anti-patterns

1. **Do NOT call `themeService.theme.palette.setMode()` in `ngOnInit`.** Call it in the constructor — the palette must be set before any CometChat component renders. `ngOnInit` runs after the first change detection cycle, which may be too late.

2. **Do NOT mix `CometChatThemeService` and per-component `[*Style]` for the same property.** The per-component style wins — the service override becomes dead code. Pick one: service for app-wide, `[*Style]` for one-offs.

3. **Do NOT use non-hex colors in style objects.** Some style properties expect hex strings. `rgb()` / named colors / `hsl()` may not work in all style properties.

4. **Do NOT wrap `CometChatThemeService` injection in a lazy-loaded module.** The service is a singleton — inject it at the root level (`AppComponent`) so the palette is set before any component renders.

5. **Do NOT forget to provide both `light` and `dark` variants** when calling `setPrimary()` or `setAccent()`. Providing only one variant leaves the other as the default, which may not match your brand in dark mode.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Init, login, module setup — always first |
| `cometchat-angular-components` | Per-component `[*Style]` prop reference |
| `cometchat-angular-placement` | Where to put chat |
| `cometchat-angular-theming` | This skill — palette, dark mode, typography |
| `cometchat-angular-customization` | Custom slot views, formatters |
| `cometchat-angular-troubleshooting` | Colors not applying, dark mode not switching |
