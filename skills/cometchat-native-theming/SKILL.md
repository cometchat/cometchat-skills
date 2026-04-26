---
name: cometchat-native-theming
description: "CometChatThemeProvider + CometChatI18nProvider — color tokens, typography, dark mode, per-component style overrides, and localization (18 built-in languages + custom translations). The JS theme object replaces CSS variables."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native theming colors dark-mode typography"
---

## Purpose

Teaches Claude how to theme and localize the React Native UI Kit via `CometChatThemeProvider` + `CometChatI18nProvider`. No CSS — React Native uses a JS theme object instead. This skill covers color tokens, typography, light/dark modes, per-component style overrides, the `useTheme()` hook for custom views, and localization (18 built-in languages, device auto-detect, custom translation overrides) via `useCometChatTranslation()`.

**Read `cometchat-native-core` first** (the wrapper chain that includes `CometChatThemeProvider`) before this skill. `cometchat-native-components` § 13 covers per-component `style={}` overrides, which are a sibling concern to theming.

Ground truth: `docs/ui-kit/react-native/theme.mdx`, `colors.mdx`, `component-styling.mdx`, `message-bubble-styling.mdx`, and `packages/ChatUiKit/src/theme/type.ts` (the canonical type definitions).

---

## 1. How theming works (no CSS — JS theme object)

React Native has no CSS. Instead:

```
CometChatThemeProvider
  ↓  (provides theme via React Context)
every <CometChat*> component reads theme via internal useTheme()
  ↓
component's default styles merge with theme overrides → rendered styles
```

The theme object you pass has two top-level keys for light/dark variants:

```tsx
<CometChatThemeProvider
  theme={{
    mode: "light",      // or "dark", or omit for OS-default
    light: { color: { primary: "#F76808" } },
    dark:  { color: { primary: "#FF8A3D" } },
  }}
>
  <App />
</CometChatThemeProvider>
```

### Style precedence (highest to lowest)

1. **Component `style={}` prop** — wins always. Per-component tweak, overrides everything.
2. **Custom theme** via `CometChatThemeProvider` — app-wide.
3. **Default theme** — the UI Kit's built-in palette.

So for a one-off color on a single component, use `style={}`. For a brand-wide change (primary color everywhere), use the theme.

### Deep merge

Theme values are deeply merged with defaults — you only specify what you want to change:

```tsx
theme={{
  light: {
    color: {
      primary: "#F76808",      // override just primary; everything else keeps defaults
    },
    typography: {
      heading1: { fontWeight: "700" },  // override just heading1 weight
    },
  },
}}
```

---

## 2. The CometChatThemeProvider

### Minimum setup — follow system light/dark

```tsx
import { CometChatThemeProvider } from "@cometchat/chat-uikit-react-native";

<CometChatThemeProvider>
  {/* children read the current system mode automatically */}
</CometChatThemeProvider>
```

### Force a mode

```tsx
<CometChatThemeProvider theme={{ mode: "light" }}>{/* ... */}</CometChatThemeProvider>
<CometChatThemeProvider theme={{ mode: "dark"  }}>{/* ... */}</CometChatThemeProvider>
```

### App-controlled theme toggle (wire to the project's existing theme system)

If the project already has a dark-mode toggle, wire `CometChatThemeProvider`'s `mode` prop to the same source. RN doesn't have CSS selectors — the React Native theme is just a value held somewhere in JS, and you forward that value to CometChat. Three common shapes:

```tsx
// Pattern A — OS-driven (no toggle yet, just react to system)
import { useColorScheme } from "react-native";

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme(); // "light" | "dark" | null
  return (
    <CometChatThemeProvider theme={{ mode: scheme === "dark" ? "dark" : "light" }}>
      {children}
    </CometChatThemeProvider>
  );
}
```

```tsx
// Pattern B — App-controlled toggle via custom Context
const ThemeContext = createContext<{ mode: "light" | "dark"; toggle: () => void }>({
  mode: "light",
  toggle: () => {},
});

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { mode } = useContext(ThemeContext);
  return (
    <CometChatThemeProvider theme={{ mode }}>{children}</CometChatThemeProvider>
  );
}
```

```tsx
// Pattern C — react-native-paper (or any provider that exposes a theme)
import { useTheme } from "react-native-paper";

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const paperTheme = useTheme();
  return (
    <CometChatThemeProvider theme={{ mode: paperTheme.dark ? "dark" : "light" }}>
      {children}
    </CometChatThemeProvider>
  );
}
```

**How to tell which pattern the project uses:**

| Library / setup | Where the mode lives | Wire `theme={{ mode: ... }}` to |
|---|---|---|
| Plain RN, no toggle yet | `useColorScheme()` from `react-native` | `scheme === "dark" ? "dark" : "light"` |
| Custom React Context | `useContext(ThemeContext).mode` (or whatever shape it has) | Read from the context |
| `react-native-paper` | `useTheme().dark` | `dark ? "dark" : "light"` |
| `restyle` | `useTheme<Theme>().colors` (no built-in mode flag — track separately) | A sibling Context that holds the mode string |
| `tamagui` | `useThemeName()` returns the current theme name | `name === "dark" ? "dark" : "light"` |
| `Appearance.addChangeListener` (manual OS) | A `useState` that mirrors `Appearance.getColorScheme()` | Read from that state |

**Rule:** wherever the project's theme toggle writes its current state, read from THAT and forward to `CometChatThemeProvider`'s `mode` prop. Don't keep two parallel sources of truth.

**Don't** combine Pattern A with Pattern B unless the user explicitly wants "follow OS until the user opens settings and overrides." That hybrid is legitimate but usually over-engineered for a first integration — ship Pattern B alone if the project has a toggle, Pattern A if it doesn't.

### Placement in the wrapper chain

`CometChatThemeProvider` is one of the four required wrappers — goes right above `CometChatProvider`, below `SafeAreaProvider` (see `cometchat-native-core` § 3):

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <CometChatThemeProvider theme={/* your theme */}>
      <CometChatProvider appId={...} region={...} authKey={...}>
        <YourApp />
      </CometChatProvider>
    </CometChatThemeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

Without `CometChatThemeProvider`, components throw or fall back to minimal styles. Even if you don't customize anything, the wrapper is mandatory.

---

## 3. Color tokens

Every color is a hex string (`"#F76808"` — never `"rgb(...)"` or named colors).

### Primary (brand accent)

| Token | Controls |
|---|---|
| `primary` | Outgoing message bubbles, send button, active tabs, buttons |
| `extendedPrimary50–900` | Auto-derived shades of primary. Used for hover, pressed, subtle accents. **Only override these if you need finer control** — the auto-derivation is usually correct. |

### Neutrals (surfaces + borders)

| Token | Default (light) | Controls |
|---|---|---|
| `neutral50` | `#FFFFFF` | White/light surface, background1 default |
| `neutral100` | `#FAFAFA` | background2 default |
| `neutral200` | `#F5F5F5` | background3 default |
| `neutral300` | `#E8E8E8` | Incoming bubble default, borders |
| `neutral400` | `#DCDCDC` | Divider lines |
| `neutral500` | `#A1A1A1` | Placeholder / muted text, iconSecondary default |
| `neutral600` | `#727272` | textSecondary (timestamps, subtitles) |
| `neutral700` | `#5B5B5B` | Body text tier 3 |
| `neutral800` | `#434343` | Headings default |
| `neutral900` | `#141414` | textPrimary default, iconPrimary default |

### Background aliases

| Token | Maps to (default) | Controls |
|---|---|---|
| `background1` | `neutral50` | Main app background |
| `background2` | `neutral100` | Sidebars, panels |
| `background3` | `neutral200` | Nested panels, cards |
| `background4` | `neutral300` | Additional surface |

### Text

| Token | Default | Controls |
|---|---|---|
| `textPrimary` | `neutral900` | Main body text |
| `textSecondary` | `neutral600` | Timestamps, subtitles |
| `textTertiary` | `neutral500` | Hints, placeholders |
| `textHighlight` | `primary` | Links, mentions |

### Icon

| Token | Default | Controls |
|---|---|---|
| `iconPrimary` | `neutral900` | Active / default icons |
| `iconSecondary` | `neutral500` | Inactive icons |
| `iconHighlight` | `primary` | Action icons |

### Semantic (state indicators)

| Token | Default (light) | Controls |
|---|---|---|
| `info` | `#0B7BEA` | Info callouts, links |
| `warning` | `#FFAB00` | Warning callouts |
| `success` | `#09C26F` | Online indicator, success messages |
| `error` | `#F44649` | Error messages, validation |

### Bubble-specific

| Token | Default | Controls |
|---|---|---|
| `sendBubbleBackground` | `primary` | Outgoing bubble bg |
| `sendBubbleText` | `staticWhite` (`#FFFFFF`) | Outgoing bubble text |
| `receiveBubbleBackground` | `neutral300` | Incoming bubble bg |
| `receiveBubbleText` | `neutral900` | Incoming bubble text |

### Static (never flip light/dark)

| Token | Value | Controls |
|---|---|---|
| `staticBlack` | `#141414` | Fixed dark elements (overlays, opacity-based) |
| `staticWhite` | `#FFFFFF` | Fixed light elements |

---

## 4. Mode: light / dark / system

### Follow system

Don't pass `mode` — the provider reads the OS setting via `useColorScheme()` and re-renders on change. The user gets automatic dark mode when they flip the system setting.

```tsx
<CometChatThemeProvider>{/* ... */}</CometChatThemeProvider>
```

### Force a specific mode

```tsx
<CometChatThemeProvider theme={{ mode: "dark" }}>{/* ... */}</CometChatThemeProvider>
```

### Toggle controlled by your app

If your app has its own dark-mode switch (stored in user prefs or Redux), drive `mode` from that state:

```tsx
const [darkMode, setDarkMode] = useState(false);
// ...
<CometChatThemeProvider theme={{ mode: darkMode ? "dark" : "light" }}>
  <Switch value={darkMode} onValueChange={setDarkMode} />
  <App />
</CometChatThemeProvider>
```

The provider re-renders children and they pick up the new theme immediately.

### Dark-mode palette

Override the `dark` branch of the theme for a custom dark palette:

```tsx
<CometChatThemeProvider
  theme={{
    light: { color: { primary: "#6852D6" } },
    dark:  { color: { primary: "#A594F3", background1: "#0B0B0F" } },
  }}
>
```

---

## 5. Typography overrides

The theme has a `typography` block with tokens per role:

```tsx
<CometChatThemeProvider
  theme={{
    light: {
      typography: {
        heading1: { fontFamily: "Inter-Bold", fontSize: 28, fontWeight: "700" },
        heading2: { fontFamily: "Inter-SemiBold", fontSize: 20 },
        body1: { fontFamily: "Inter-Regular", fontSize: 15 },
        caption1: { fontFamily: "Inter-Regular", fontSize: 12 },
        // ... etc
      },
    },
  }}
>
```

Common tokens: `heading1`, `heading2`, `heading3`, `heading4`, `body1`, `body2`, `caption1`, `caption2`, `button1`, `button2`. Each follows the RN `TextStyle` shape — `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`.

### Custom font setup

React Native font loading is NOT covered by the UI Kit — use your project's existing font system:

- **Expo**: `useFonts()` from `expo-font`, load before rendering the provider
- **Bare RN**: add fonts to `ios/<App>/Info.plist` `UIAppFonts` + `android/app/src/main/assets/fonts/` + run `npx react-native-asset`

Only reference a `fontFamily` in the theme once the font is actually loaded — otherwise iOS shows the system default and Android crashes.

---

## 6. Per-component style blocks

Beyond color / typography, the theme has per-component style blocks for fine control. These sit inside the `light` / `dark` branches:

```tsx
<CometChatThemeProvider
  theme={{
    light: {
      // component-specific overrides
      conversationStyles: {
        containerStyle: { backgroundColor: "#FAFAFA" },
      },
      messageHeaderStyles: {
        titleStyle: { fontSize: 18 },
      },
      messageListStyles: {
        containerStyle: { padding: 8 },
        sendBubbleStyle: {
          backgroundColor: "#F76808",
          textStyle: { color: "#FFFFFF" },
        },
        receiveBubbleStyle: {
          backgroundColor: "#F5F5F5",
          textStyle: { color: "#141414" },
        },
      },
      messageComposerStyles: {
        containerStyle: { backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E8E8E8" },
      },
    },
  }}
>
```

Common component-style keys: `conversationStyles`, `usersStyles`, `groupsStyles`, `groupMembersStyles`, `messageHeaderStyles`, `messageListStyles`, `messageComposerStyles`, `threadHeaderStyles`, `callButtonsStyles`, `callLogsStyles`.

Each block has the same nested shape as the component's `style` prop (see `cometchat-native-components` § 13).

### Source of truth for available keys

The exact list of style keys per component is authoritative in the kit's type file:
```
packages/ChatUiKit/src/theme/type.ts
```

If you're overriding a component style and the TypeScript compiler complains about an unknown key, check that file (or use `useTheme()` + autocomplete in your IDE).

---

## 7. Common recipes

### Match a brand color (most common)

```tsx
<CometChatThemeProvider
  theme={{ light: { color: { primary: "#FF6B35" } } }}
>
  <App />
</CometChatThemeProvider>
```

This single line changes the outgoing message bubble color, send button color, active tab indicator, and every primary accent in the UI. The `extendedPrimary50–900` tints are auto-derived from `primary`.

### Dark mode + custom brand

```tsx
<CometChatThemeProvider
  theme={{
    light: { color: { primary: "#FF6B35" } },
    dark:  { color: { primary: "#FF8F66", background1: "#1A1A1A" } },
  }}
>
  <App />
</CometChatThemeProvider>
```

### Custom message-bubble colors

```tsx
<CometChatThemeProvider
  theme={{
    light: {
      color: {
        sendBubbleBackground: "#FF6B35",
        sendBubbleText: "#FFFFFF",
        receiveBubbleBackground: "#F0F0F0",
        receiveBubbleText: "#1A1A1A",
      },
    },
  }}
>
```

Overriding the bubble tokens directly is cleaner than doing it via `messageListStyles.sendBubbleStyle` — the tokens apply consistently everywhere bubbles render (main list + thread panel + search results).

### Custom font across the whole UI

1. Load font (Expo `useFonts` or bare `npx react-native-asset`)
2. Override the typography block:

```tsx
<CometChatThemeProvider
  theme={{
    light: {
      typography: {
        heading1: { fontFamily: "Inter-Bold" },
        heading2: { fontFamily: "Inter-SemiBold" },
        heading3: { fontFamily: "Inter-SemiBold" },
        heading4: { fontFamily: "Inter-Medium" },
        body1: { fontFamily: "Inter-Regular" },
        body2: { fontFamily: "Inter-Regular" },
        caption1: { fontFamily: "Inter-Regular" },
        caption2: { fontFamily: "Inter-Regular" },
        button1: { fontFamily: "Inter-SemiBold" },
        button2: { fontFamily: "Inter-Medium" },
      },
    },
  }}
>
```

---

## 8. Reading the theme in custom views

When you write a custom slot view (e.g. a `TitleView` on `CometChatMessageHeader`) and want your custom component to match the theme, use the `useTheme()` hook:

```tsx
import { useTheme } from "@cometchat/chat-uikit-react-native";

function CustomTitle({ user }: any) {
  const theme = useTheme();
  return (
    <Text style={{
      color: theme.color.textPrimary,
      fontFamily: theme.typography.heading3.fontFamily,
      fontSize: theme.typography.heading3.fontSize,
    }}>
      {user.getName()}
    </Text>
  );
}

// Wire into a header:
<CometChatMessageHeader user={selectedUser} TitleView={(user) => <CustomTitle user={user} />} />
```

This is how you write custom views that automatically follow dark mode — by reading tokens from `useTheme()` instead of hardcoding colors.

---

## 9. Localization — `CometChatI18nProvider`

Theming and localization are separate concerns but ship together. If your users aren't all English-speaking, wire `CometChatI18nProvider` alongside `CometChatThemeProvider`. Every string rendered by the UI Kit (message-action labels, empty states, system messages, alerts) flows through the i18n layer.

### 9a. Built-in locales

The UI Kit ships translations for 18 languages out of the box:

```
de, en, es, fr, hi, hu, it, ja, ko, lt, ms, nl, pt, ru, sv, tr, zh, zh-tw
```

### 9b. Wrapper chain with i18n — five wrappers, not four

`CometChatI18nProvider` goes above `CometChatThemeProvider` (theme is a child of i18n, not the other way around):

```tsx
import { CometChatI18nProvider, CometChatThemeProvider } from "@cometchat/chat-uikit-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <CometChatI18nProvider>
      <CometChatThemeProvider>
        <CometChatProvider>
          <YourApp />
        </CometChatProvider>
      </CometChatThemeProvider>
    </CometChatI18nProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

### 9c. Auto-detect (default)

With no props, `CometChatI18nProvider` reads the device locale via `react-native-localize` and picks the matching language if available, falling back to English. No setup needed beyond the wrapper.

**Install `react-native-localize`** (required peer dep for auto-detect):
```bash
npx expo install react-native-localize     # Expo managed
# or
npm install react-native-localize && cd ios && pod install && cd ..   # bare RN
```

### 9d. Force a specific language

Override the device default via `selectedLanguage`:

```tsx
<CometChatI18nProvider selectedLanguage="ja">
```

If the user's app has its own language preference (stored in settings / Redux / MMKV), drive `selectedLanguage` from that state. The provider re-renders children on change so strings update immediately.

### 9e. Fallback behavior

Chain: **`selectedLanguage` (if set + available) → device language (if `autoDetectLanguage=true`) → `fallbackLanguage` (default `'en'`)**.

```tsx
<CometChatI18nProvider
  selectedLanguage={user.preferredLanguage}   // from your app state
  autoDetectLanguage={true}                    // fall back to device language
  fallbackLanguage="en"                        // final fallback
>
```

If the user's preferred language isn't bundled AND there's no custom translation for it, the provider logs a warning and uses the fallback.

### 9f. Custom translations — override or add languages

Pass a `translations` object to override specific keys in an existing locale, or add a brand-new locale the UI Kit doesn't ship:

```tsx
const translations = {
  en: {
    // Override a built-in English string
    "NO_MESSAGES_YET": "Say hello to start the conversation!",
    "SENT": "Delivered",
  },
  th: {
    // Add a new language — Thai
    "NO_MESSAGES_YET": "ยังไม่มีข้อความ",
    "SENT": "ส่งแล้ว",
    // ...provide the full key set
  },
};

<CometChatI18nProvider selectedLanguage="th" translations={translations}>
```

The translation schema is a flat `{ KEY: "string" }` map. Keys are screaming-snake-case (`NO_MESSAGES_YET`, `MESSAGE_COMPOSER_MENTION_ALL`, `TRANSLATE`, etc.). Full key list lives at `packages/ChatUiKit/src/shared/resources/CometChatLocalizeNew/resources/en/translation.json` in the UI Kit source — grep for `"KEY":` there to find the exact key for a string you want to override.

### 9g. Reading the language inside custom views

When you write a custom slot view and need the current language (or want to translate your own strings using the same key set), use the `useCometChatTranslation` hook:

```tsx
import { useCometChatTranslation } from "@cometchat/chat-uikit-react-native";

function CustomEmptyState() {
  const { t, language } = useCometChatTranslation();
  return <Text>{t("NO_MESSAGES_YET")}</Text>;
}
```

The hook also exposes `availableLanguages` — useful for building a language-picker UI.

### 9h. Common pitfall — i18n outside the provider

Calling `useCometChatTranslation()` from a component rendered OUTSIDE `CometChatI18nProvider` (common when a custom view mounts at the navigator root instead of inside the chat subtree) logs `"useCometChatTranslation used outside provider, using fallback translations"` and falls through to English. Check your wrapper chain — i18n must wrap every component that reads translations, which is the whole app tree in practice.

---

## 10. Anti-patterns

1. **Don't pass non-hex colors.** `"rgb(...)"`, `"rgba(...)"`, named colors, or `hsl(...)` will break the kit's internal color math (used to derive `extendedPrimary`). Use `"#RRGGBB"` or `"#RRGGBBAA"` (opacity via alpha).

2. **Don't override `staticBlack` / `staticWhite`.** They're "static" for a reason — used in places where a specific absolute color is needed regardless of theme (overlays, badges on fixed-color avatars). Overriding them breaks visual consistency.

3. **Don't override extended primary colors unless you need to.** `extendedPrimary50–900` are auto-derived from `primary`. Override them only if the auto-derivation doesn't match your brand's tints — and then override the full range, not just one level.

4. **Don't wrap `CometChatThemeProvider` inside a screen.** It belongs at the app root, once. Re-wrapping per screen creates hydration-like flashes on navigation and breaks dark-mode switching.

5. **Don't mix theme overrides and per-component `style={}` for the same property.** `style={}` wins — the theme override becomes dead code. Pick one: theme for app-wide, `style={}` for one-offs.

6. **Don't reference an unloaded font in typography.** iOS silently falls back to system default; Android crashes. Gate the provider on font loading:

    ```tsx
    // Expo example
    const [fontsLoaded] = useFonts({ "Inter-Bold": require("./assets/Inter-Bold.ttf") });
    if (!fontsLoaded) return null;
    return (
      <CometChatThemeProvider theme={{ light: { typography: { heading1: { fontFamily: "Inter-Bold" } } } }}>
        <App />
      </CometChatThemeProvider>
    );
    ```

7. **Don't bypass the theme via `useColorScheme()` in a custom view.** Call `useTheme()` from `@cometchat/chat-uikit-react-native` — that gives you the current theme (including any overrides you set). `useColorScheme()` only gives you the raw system mode.

---

## 11. Verifying a theme change

After changing the theme:

1. Hard-reload the Metro bundler (not Fast Refresh — theme context sometimes doesn't update on Fast Refresh)
2. Send a message — check the outgoing bubble color matches `primary` / `sendBubbleBackground`
3. Toggle dark mode on the device (iOS: Settings → Display; Android: Settings → Display → Dark theme)
4. Check that both modes render without reloading the app

If something looks unstyled or crashes:
- Check the color is a hex string (not a name or rgb)
- Check the font (if you overrode typography) is actually loaded
- Check the override key matches the type in `packages/ChatUiKit/src/theme/type.ts`

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Always read first — init/login/provider wrapper chain |
| `cometchat-native-components` | For per-component `style={}` prop (sibling concern to theming) |
| `cometchat-native-placement` | Where CometChat components go |
| `cometchat-native-theming` | This skill — app-wide color/typography/dark mode |
| `cometchat-native-customization` | Custom slot views + `useTheme()` in your own components |
| `cometchat-native-expo-patterns` | Expo font loading via `expo-font` |
| `cometchat-native-bare-patterns` | Bare RN font loading via `react-native-asset` |
| `cometchat-native-troubleshooting` | Colors not applying, dark mode not switching, font shows system default |
