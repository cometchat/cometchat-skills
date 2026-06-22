---
name: cometchat-i18n
description: Localization (i18n) across all CometChat UI Kit families — React, React Native, Angular, Android (V5/V6), iOS, Flutter (V5/V6). Covers CometChatLocalize.init signature differences (positional vs object), bundled languages, custom-language registration, RTL support, fallback to English, and cross-family drift risks. Cross-family — applies wherever the agent is configuring CometChat localization.
license: "MIT"
compatibility: "All CometChat UI Kit families v4.x / v5.x / v6.x"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat i18n localization l10n cometchatlocalize languages rtl arabic hebrew bundled-languages custom-language fallback cross-family"
---

> **Ground truth:** the UI Kit `CometChatLocalize` API + `docs/fundamentals`. **Official docs:** https://www.cometchat.com/docs/fundamentals/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

## Purpose

Localize the CometChat UI Kit to the user's language. Every kit ships with English + ~15 bundled languages (Arabic, Bengali, Chinese, German, Spanish, French, Hindi, Indonesian, Italian, Japanese, Korean, Malay, Portuguese, Russian, Swedish, Turkish — exact set varies by kit version). Custom languages can be added at runtime.

The biggest gotcha: **the localization API differs across kits.** Web + Angular v5 use `CometChatLocalize.init({ ... })` (object); **React Native v5 uses a `<CometChatI18nProvider>` component + `useCometChatTranslation` hook (no `CometChatLocalize.init`)**; **Android uses `CometChatLocalize.setLocale(context, "es")`** (Context + code String); **iOS uses `CometChatLocalize.set(locale: "es")`**; **Flutter has no `CometChatLocalize` class at all — register the kit's `Translations` localization delegate.** (Angular's positional `init("es")` was a v4-only form — v5 moved to the object signature, matching React.) This skill is the canonical reference.

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

### React Native (v5) — `CometChatI18nProvider` (NOT `CometChatLocalize.init`)

The RN v5 kit does **not** export a `CometChatLocalize` class with `.init(...)` (that was the v4 RN API). v5 localizes through a **provider component** + a hook. Wrap your app (inside `CometChatThemeProvider`) and read strings with `useCometChatTranslation`:

```tsx
import {
  CometChatThemeProvider,
  CometChatI18nProvider,
} from "@cometchat/chat-uikit-react-native";

const App = () => (
  <CometChatThemeProvider theme={{ mode: "light" }}>
    {/* autoDetectLanguage reads the device locale; or pin one with selectedLanguage="es" */}
    <CometChatI18nProvider autoDetectLanguage={true} fallbackLanguage="en">
      {/* your screens / kit components */}
    </CometChatI18nProvider>
  </CometChatThemeProvider>
);

// In a component:
import { useCometChatTranslation } from "@cometchat/chat-uikit-react-native";
const { t } = useCometChatTranslation();
// t("CHATS")
```

`CometChatI18nProviderProps`: `selectedLanguage?`, `autoDetectLanguage?: boolean`, `fallbackLanguage?`, `translations?: { [code]: {...} }` (verified vs `shared/resources/CometChatLocalizeNew/CometChatI18nProvider.tsx`). For imperative switching there's `setGlobalLanguage(language, translations?, fallback?)`.

### Angular (v5) — OBJECT signature

```ts
import { CometChatLocalize } from "@cometchat/chat-uikit-angular";

CometChatLocalize.init({ language: "es" });
// with more options:
CometChatLocalize.init({
  language: "es",
  fallbackLanguage: "en-US",
  timezone: "Europe/Madrid",
});
```

**Object literal, not positional** — in v5 (`@cometchat/chat-uikit-angular@5`), `init(settings: LocalizationSettings)` takes an object, the same shape as React. (Verified in `projects/cometchat-uikit/src/lib/resources/CometChatLocalize/cometchat-localize.ts` — `static init(settings: LocalizationSettings)`.) The old positional `init("es")` form was the **v4** Angular API and no longer applies. Switch language at runtime with `CometChatLocalize.setCurrentLanguage("fr")`, read keys with `getLocalizedString(key)`, and add custom strings with `addTranslation({ ... })`.

### Android V5 — Java/Kotlin static method

```kotlin
// Kotlin — takes (Context, language-code String). Language.* are String constants.
CometChatLocalize.setLocale(context, Language.SPANISH)   // or "es"
```

```java
// Java
CometChatLocalize.setLocale(context, Language.SPANISH);  // or "es"
```

`setLocale`, not `init`. **Signature is `setLocale(Context, @Language.Code String)`** — a Context plus a two-letter language-code String (NOT a `java.util.Locale`). `Language` exposes `ENGLISH="en"`, `SPANISH="es"`, `FRENCH="fr"`, `GERMAN="de"`, … (verified vs `chatuikit/.../localise/CometChatLocalize.java` + `Language.kt`).

### Android V6 (stable) — same as V5

V6 keeps the same API: `CometChatLocalize.setLocale(context, "es")` (verified vs `chatuikit-kotlin/.../localise/CometChatLocalize.kt:22` — `fun setLocale(context: Context, language: String)`). No drift between V5 and V6.

### iOS V5

```swift
import CometChatUIKitSwift

CometChatLocalize.set(locale: "es")   // or set(locale: Language.spanish)
```

The method is **`set(locale:)`**, not `setLocale(...)`. It takes a String (or a `Language`) — `public class func set(locale: String)` / `set(locale: Language)` (verified vs `Components/Shared/Helpers/CometChatLocalize/CometChatLocalize.swift:78,82`). There is no `setStringResources` — override individual strings via your app's `Localizable.strings`.

### Flutter V5 + V6 — there is NO `CometChatLocalize.init(...)`

> **Verified against the kit source + docs (`ui-kits/cometchat-uikit-flutter-v6`, `documentation/docs/ui-kit/flutter/localize.mdx`): Flutter does NOT expose a `CometChatLocalize` class.** Localization is wired the idiomatic Flutter way — register the kit's `Translations` localization delegate on your `MaterialApp` and drive the language through the app's `Locale`. Earlier drafts of this skill showed `CometChatLocalize.init(language: 'es')`; that symbol does not exist in the Flutter UI Kit (V5 or V6) — do not emit it.

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart' as cc; // V6
// V5: import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart' as cc; (5.2.x)

MaterialApp(
  // Language follows the app Locale. Set `locale:` to force one, or omit to
  // follow the device + supportedLocales.
  locale: const Locale('es'),
  supportedLocales: const [
    Locale('en'), Locale('ar'), Locale('de'), Locale('es'), Locale('fr'),
    Locale('hi'), Locale('ja'), Locale('ko'), Locale('pt'), Locale('ru'),
    Locale('zh'), // …19 supported total — see the docs list
  ],
  localizationsDelegates: const [
    cc.Translations.delegate,            // ← the CometChat UI Kit strings
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  home: const YourHomeScreen(),
);
```

Read a translated string with `cc.Translations.of(context).users`. Add a custom
language or override one by subclassing `cc.Translations` and registering your
own `LocalizationsDelegate` *before* `cc.Translations.delegate` in the list
(full recipe in `documentation/docs/ui-kit/flutter/localize.mdx`).

---

## Cross-family signature summary

| Family | Init call | Notes |
|---|---|---|
| React (v6) | `CometChatLocalize.init({ language, fallbackLanguage })` | Object |
| React Native (v5) | `<CometChatI18nProvider autoDetectLanguage selectedLanguage="es" fallbackLanguage="en">` + `useCometChatTranslation()` | **Provider component, NOT `CometChatLocalize.init`** |
| Angular (v5) | `CometChatLocalize.init({ language, fallbackLanguage })` | Object (same shape as React) |
| Android (V5/V6) | `CometChatLocalize.setLocale(context, "es")` | Method `setLocale(Context, String code)` — NOT a `Locale` |
| iOS (V5) | `CometChatLocalize.set(locale: "es")` | Method `set(locale:)` (String or `Language`) — NOT `setLocale` |
| Flutter (V5/V6) | `MaterialApp(localizationsDelegates: [cc.Translations.delegate, …], supportedLocales: […], locale: Locale('es'))` | **No `CometChatLocalize`** — register the kit's `Translations` delegate + drive via `Locale`; read with `Translations.of(context)` |

The agent must consult this table before writing any localization code. **Verify against the installed package's type definitions** if uncertain — the localization surface genuinely differs per family (e.g. React Native moved from a `CometChatLocalize` class to the `<CometChatI18nProvider>` component; Flutter never had a `CometChatLocalize` class).

---

## When to call init/setLocale

After CometChat init is configured but before mounting any kit components:

```ts
// React example — in your provider
useEffect(() => {
  CometChatUIKit.init(settings)?.then(() => {
    CometChatLocalize.init({ language: getUserLocale(), fallbackLanguage: "en" });
    // Now mount kit components
  });
}, []);
```

```kotlin
// Android — in Application.onCreate. setLocale takes (Context, code String).
override fun onCreate() {
  super.onCreate()
  val settings = UIKitSettings.UIKitSettingsBuilder()/* ... */.build()
  CometChatUIKit.init(this, settings, object : CometChat.CallbackListener<String>() {
    override fun onSuccess(p: String) {
      CometChatLocalize.setLocale(this@MyApp, getUserLocale())   // e.g. "es"
    }
    override fun onError(e: CometChatException) {}
  })
}
```

```swift
// iOS — in App.init or AppDelegate. The method is set(locale:), takes a String.
CometChat.init(appId: ...) { _, error in
  guard error == nil else { return }
  let code = Locale.preferredLanguages.first?.split(separator: "-").first.map(String.init) ?? "en"
  CometChatLocalize.set(locale: code)
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
  // FLAT key->value map for the ACTIVE language (NOT a nested `resources: { es: {...} }`
  // object — LocalizationSettings has no `resources` field; it's silently ignored).
  translationsForLanguage: {
    "Chat": "Charla",
    "Messages": "Mensajes",
    // ... override only the strings you want, for the active language
  },
});
// To add overrides for additional languages, call CometChatLocalize.addTranslation({...}) per language.
```

### React Native (v5) — `translations` prop on the provider

```tsx
<CometChatI18nProvider
  selectedLanguage="es"
  translations={{ es: { CHATS: "Charla", MESSAGES: "Mensajes" } }}
>
  {/* … */}
</CometChatI18nProvider>
```

Add a brand-new language the same way: `translations={{ custom: { CHATS: "…" } }}` with `selectedLanguage="custom"`.

### Angular

Init with the object signature, then register custom strings via `addTranslation` (v5):

```ts
CometChatLocalize.init({ language: "es" });
CometChatLocalize.addTranslation({
  es: { CHAT: "Charla", MESSAGES: "Mensajes" },
});
```

### Android

The Android kit has **no string-override API** on `CometChatLocalize` (no `addStringResources`/`setStringResources`). Override individual strings the Android-native way — add a `values-es/strings.xml` with the kit's string keys to your app resources; Android resource resolution picks them up for the active locale.

```kotlin
CometChatLocalize.setLocale(context, "es")   // selects the locale; string overrides live in res/values-es/
```

### iOS

iOS has **no `setStringResources` API** either. Override strings via your app's `Localizable.strings` (per-locale `.lproj`) using the kit's string keys; `set(locale:)` only selects the active locale.

```swift
CometChatLocalize.set(locale: "es")   // overrides live in es.lproj/Localizable.strings
```

### Flutter

Flutter has **no `CometChatLocalize.init`** — subclass the kit's `Translations` delegate to override or add strings, and register your delegate *before* `cc.Translations.delegate` in `MaterialApp.localizationsDelegates` (full recipe in `documentation/docs/ui-kit/flutter/localize.mdx`):

```dart
class MyTranslations extends cc.Translations {
  @override
  String get chats => 'Charla';   // override individual getters
}
// register MyTranslationsDelegate() ahead of cc.Translations.delegate
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
// React/RN/Angular (object signature) — fallbackLanguage is a settings field
CometChatLocalize.init({ language: "es", fallbackLanguage: "en-US" });
```

Angular v5's `LocalizationSettings` carries `fallbackLanguage` (verified in `cometchat-localize.ts` — defaults to `en-US`). RN's `<CometChatI18nProvider>` takes a `fallbackLanguage` prop. Flutter's `Translations` delegate and iOS's `set(locale:)` don't expose an explicit fallback arg — they fall back to English internally, so the skill doesn't try to override it there.

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

## Advanced init options + date/time formatting (web / JS family)

`CometChatLocalize.init(settings)` (web, RN, Angular) accepts more than a language — the `LocalizationSettings` carries options the basic recipe omits (all verified in `cometchat-uikit-react-v6/src/resources/CometChatLocalize/cometchat-localize.ts`):

- **`translationsForLanguage`** — inject custom string overrides at init (sugar for `addTranslation`).
- **`missingKeyHandler`** — a callback invoked with any key that has no translation (log it, or return a fallback). Great for catching gaps in custom languages.
- **`timezone`** — IANA zone string (e.g. `"America/New_York"`) used when the kit formats timestamps.

**Date/time formatting** is controlled with `CalendarObject` (exported from the kit, `utils/CalendarObject.ts`) — pass one globally or per-component (e.g. a component's `lastActiveAtDateTimeFormat`-style prop) to control how the kit renders relative/absolute times. Query the docs MCP / `ui-kit/react/localize` for the full `CalendarObject` field list and the `flag_message_reason_*` / `message_composer_mention_*` translation-key conventions.

> These are web/JS-family details. Native families (Android/iOS/Flutter) localize through their own resource/string mechanisms — see the per-family `-core`/`-troubleshooting` skills.

---

## Anti-patterns

1. **Using the wrong localization surface for the family.** Web + **Angular v5** take `CometChatLocalize.init({ language })` (object); **React Native v5** uses `<CometChatI18nProvider>` + `useCometChatTranslation` (NO `CometChatLocalize.init`); **Android** uses `CometChatLocalize.setLocale(context, "es")`; **iOS** uses `CometChatLocalize.set(locale: "es")`; **Flutter** has no `CometChatLocalize` — register the kit's `Translations` delegate. The legacy positional `init("es")` only ever applied to Angular **v4**. Verify against the installed package's types if unsure.
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
