---
name: cometchat-i18n
description: Localization (i18n) across all CometChat UI Kit families — React, React Native, Angular, Android (V5/V6), iOS, Flutter (V5/V6). Covers CometChatLocalize.init signature differences (positional vs object), bundled languages, custom-language registration, RTL support, fallback to English, and cross-family drift risks. Cross-family — applies wherever the agent is configuring CometChat localization.
license: "MIT"
compatibility: "All CometChat UI Kit families v4.x / v5.x / v6.x"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat i18n localization l10n cometchatlocalize languages rtl arabic hebrew bundled-languages custom-language fallback cross-family"
---

## Purpose

Localize the CometChat UI Kit to the user's language. Every kit ships with English + ~15 bundled languages (Arabic, Bengali, Chinese, German, Spanish, French, Hindi, Indonesian, Italian, Japanese, Korean, Malay, Portuguese, Russian, Swedish, Turkish — exact set varies by kit version). Custom languages can be added at runtime.

The biggest gotcha: **the `init` signature differs across kits and major versions**. The same audit pass that caught calls API drift caught one of these too (Angular Localize positional signature) — this skill is the canonical reference.

---

## API surface per family

### React (v6) — object signature

```ts
import { CometChatLocalize } from "@cometchat/chat-uikit-react";

CometChatLocalize.init({
  language: "es",
  fallbackLanguage: "en",
});
```

Object literal. `init({ ... })`.

### React Native (v5) — object signature

```ts
import { CometChatLocalize } from "@cometchat/chat-uikit-react-native";

CometChatLocalize.init({
  language: "es",
  fallbackLanguage: "en",
});
```

Same object signature as React.

### Angular (v4) — POSITIONAL signature

```ts
import { CometChatLocalize } from "@cometchat/chat-uikit-angular";

CometChatLocalize.init("es");
// or with custom resources:
CometChatLocalize.init("es", { es: { CHAT: "Charla" } });
```

**Positional, not object.** This was the v4.0 audit fix — calling `.init({ language: "es" })` on Angular sets `language = [object Object]` and silently breaks translations. The skill's verification checklist flags this drift.

### Android V5 — Java/Kotlin static method

```kotlin
// Kotlin
CometChatLocalize.setLocale(Locale.forLanguageTag("es"))
```

```java
// Java
CometChatLocalize.setLocale(Locale.forLanguageTag("es"));
```

`setLocale`, not `init`. Takes a `java.util.Locale`.

### Android V6 (beta) — same as V5

V6 keeps the `setLocale(Locale)` API. No drift here.

### iOS V5

```swift
import CometChatUIKitSwift

CometChatLocalize.setLocale(locale: "es")
```

`setLocale(locale:)`. Takes a String, not `Locale`.

### Flutter V5 (GetX-based)

```dart
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

CometChatLocalize.init(language: 'es');
```

Named-arg, not positional. Single string.

### Flutter V6 (Bloc-based)

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

CometChatLocalize.init(language: 'es');
```

Same as V5 in Flutter — named arg.

---

## Cross-family signature summary

| Family | Init call | Notes |
|---|---|---|
| React (v6) | `CometChatLocalize.init({ language, fallbackLanguage })` | Object |
| React Native (v5) | `CometChatLocalize.init({ language, fallbackLanguage })` | Object |
| **Angular (v4)** | `CometChatLocalize.init("es")` | **Positional — drift trap** |
| Android (V5/V6) | `CometChatLocalize.setLocale(Locale.forLanguageTag("es"))` | Method name `setLocale`, takes `Locale` |
| iOS (V5) | `CometChatLocalize.setLocale(locale: "es")` | Method name `setLocale`, takes String |
| Flutter (V5/V6) | `CometChatLocalize.init(language: 'es')` | Named arg |

The agent must consult this table before writing any localization code. **Verify against the installed package's type definitions** if uncertain — symbol drift between minor versions is real (the React v5 → v6 changed from positional to object).

---

## When to call init/setLocale

After CometChat init is configured but before mounting any kit components:

```ts
// React example — in your provider
useEffect(() => {
  CometChatUIKit.init(settings).then(() => {
    CometChatLocalize.init({ language: getUserLocale(), fallbackLanguage: "en" });
    // Now mount kit components
  });
}, []);
```

```kotlin
// Android — in Application.onCreate
override fun onCreate() {
  super.onCreate()
  val settings = UIKitSettings.Builder()/* ... */.build()
  CometChatUIKit.init(this, settings) {
    CometChatLocalize.setLocale(Locale.forLanguageTag(getUserLocale()))
  }
}
```

```swift
// iOS — in App.init or AppDelegate
CometChat.init(appId: ...) { _, error in
  guard error == nil else { return }
  CometChatLocalize.setLocale(locale: Locale.preferredLanguages.first ?? "en")
}
```

Setting locale before init is harmless but the kit doesn't pick up the locale until init completes; some components read the locale at first render. Doing both in sequence is safest.

---

## Custom languages / overriding strings

Each kit lets you register a custom language or override individual strings.

### React / React Native (v6)

```ts
CometChatLocalize.init({
  language: "es",
  fallbackLanguage: "en",
  resources: {
    es: {
      CHAT: "Charla",
      MESSAGES: "Mensajes",
      // ... override only the strings you want
    },
  },
});
```

### Angular

Positional second arg:

```ts
CometChatLocalize.init("es", {
  es: { CHAT: "Charla", MESSAGES: "Mensajes" },
});
```

### Android

```kotlin
val customResources = mapOf(
  "CHAT" to "Charla",
  "MESSAGES" to "Mensajes",
)
CometChatLocalize.setLocale(Locale("es"))
CometChatLocalize.addStringResources("es", customResources)   // verify symbol
```

The exact symbol for resource-override on Android varies by version — check the kit's published API surface.

### iOS

```swift
CometChatLocalize.setLocale(locale: "es")
CometChatLocalize.setStringResources(["CHAT": "Charla"], for: "es")
```

### Flutter

```dart
CometChatLocalize.init(
  language: 'es',
  resources: {
    'es': { 'CHAT': 'Charla', 'MESSAGES': 'Mensajes' },
  },
);
```

---

## RTL languages

Arabic, Hebrew, Persian, Urdu render right-to-left. The kits handle layout direction automatically based on the locale, BUT:

1. **Native iOS / Android**: layout direction follows the device's locale OR the explicitly-set CometChat locale, whichever is set last. If your app sets the device locale to Arabic but the kit's locale is English, mismatched RTL is visible.
2. **Web (React / Angular)**: `<html dir="rtl">` is required for full RTL support. The kit reads this from the document root. Set it when locale changes:

```ts
useEffect(() => {
  const lang = currentLocale;
  document.documentElement.dir = ["ar", "he", "fa", "ur"].includes(lang) ? "rtl" : "ltr";
  CometChatLocalize.init({ language: lang });
}, [currentLocale]);
```

3. **React Native**: `I18nManager.forceRTL(true)` for global RTL flip. Requires app restart to take effect (this is the one common production bug — set RTL, app doesn't visibly change, devs miss the "restart required" warning).

```ts
import { I18nManager, NativeModules, Platform } from "react-native";

if (isRTLLocale(language) && !I18nManager.isRTL) {
  I18nManager.forceRTL(true);
  if (__DEV__) {
    console.warn("RTL set — app must restart for layout change to apply");
  } else {
    NativeModules.DevSettings.reload();
  }
}
```

4. **Flutter**: handled automatically via `MaterialApp.localizationsDelegates` + `Locale('ar')`. Flutter's framework flips layout direction on locale change without restart.

---

## Fallback language

Every kit falls back to English when a translation is missing for the active locale. Make this explicit:

```ts
// React/RN/Flutter
CometChatLocalize.init({ language: "es", fallbackLanguage: "en" });
```

Angular and iOS don't have an explicit `fallbackLanguage` arg in their `init` / `setLocale` API — they hardcode English fallback internally. The skill doesn't try to override this.

---

## Detecting the user's preferred language

```ts
// Web — browser language
const language = navigator.language.split("-")[0];   // "en-US" → "en"

// React Native — device language
import * as Localization from "expo-localization";    // Expo
const language = Localization.locale.split("-")[0];

// or react-native-localize for bare RN:
import { getLocales } from "react-native-localize";
const language = getLocales()[0]?.languageCode ?? "en";
```

```kotlin
// Android
val language = Locale.getDefault().language          // "en"
```

```swift
// iOS
let language = Locale.preferredLanguages.first?.split(separator: "-").first.map(String.init) ?? "en"
```

```dart
// Flutter
import 'dart:ui';
final language = window.locale.languageCode;          // 'en'
```

Map these to your kit's locale convention (most kits use ISO 639-1 two-letter codes; Flutter sometimes accepts BCP47 like `en-US`).

---

## Logout / language switch — re-init the kit

When the user changes language at runtime, simply call `init`/`setLocale` again with the new language. The kit re-renders kit components on the next render cycle. No need to logout/re-login.

For React/RN — wrap kit components in a `key={language}` to force re-mount if the kit doesn't auto-detect:

```tsx
<div key={language}>
  <CometChatConversations />
</div>
```

This is the workaround for kits that cache localized strings at first render.

---

## Anti-patterns

1. **Calling `init` with the wrong signature.** Object instead of positional on Angular, vice-versa on React. The audit pass catches this — don't ship without verifying.
2. **Setting locale before kit init.** Some kits ignore the early call. Always sequence: kit init → localize init.
3. **No fallback language on web/RN/Flutter.** Missing translations show as raw keys (`CHAT_HEADER_TITLE` etc.) instead of English fallback.
4. **`document.dir` not synced with locale on web.** RTL languages render LTR — broken layout.
5. **`I18nManager.forceRTL` without app restart.** Layout doesn't flip; devs think the kit is broken.
6. **Hardcoding language in skill output.** Always read user preference (browser/device/explicit setting).
7. **Custom resources keyed by lowercase ID** (`"chat"` instead of `"CHAT"`). Kit string keys are uppercase by convention. Mismatched case = no override applied.
8. **Trusting the audit-fix-once mindset.** Localize signatures can drift in future minor versions. Re-verify on kit upgrade.

---

## Verification checklist

- [ ] `init` / `setLocale` signature matches the family in the table above
- [ ] Locale set AFTER kit init resolves
- [ ] `fallbackLanguage` set where supported (React, RN, Flutter)
- [ ] Web: `document.documentElement.dir` synced with RTL languages
- [ ] React Native: `I18nManager.forceRTL` warning + restart on RTL set
- [ ] Custom resources use uppercase string keys
- [ ] Language detection from browser/device, not hardcoded
- [ ] Re-init on language switch (or `key={language}` workaround)
- [ ] Smoke test: switch to a bundled non-English language, verify kit components localize
- [ ] Smoke test: switch to a missing-resource language, verify English fallback
- [ ] RTL smoke test: Arabic / Hebrew on web (with `dir="rtl"`) and RN (with `I18nManager.forceRTL`) and native Android/iOS — kit components mirror correctly

---

## Pointers

- `cometchat-{family}-core` — kit init order and conventions (localize hooks into the post-init phase)
- `cometchat-{family}-customization` — custom string resources / theme strings
- `cometchat-{family}-troubleshooting` — when localization doesn't apply (cache, sequence, fallback)
- `cometchat-a11y` — sister skill; localization + accessibility together cover the bulk of "production polish"
