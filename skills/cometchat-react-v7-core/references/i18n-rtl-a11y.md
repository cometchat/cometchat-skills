# i18n, RTL, accessibility (React v7)

The UI Kit handles all three out of the box; careless customization breaks them.

## RTL
Reads `dir="rtl"` from the document root — components flip automatically (bubbles mirror, avatars swap, icons rotate). Test with `<html dir="rtl">`. Custom views MUST use logical properties (`margin-inline-start`, `padding-inline-end`) or they break RTL.

## i18n — localization works via the provider; NEVER render a raw key
`CometChatProvider` **auto-wires localization** (it renders `LocaleProvider` internally, `locale` prop) — the kit's ~40 built-in languages load out of the box (default `en-us`). You do NOT manually init for the default language.
- **Non-default language:** set the `locale` prop on `CometChatProvider` (`<CometChatProvider locale="fr">`) — that's the v7 way to switch language. `init` / `setCurrentLanguage` / `getCurrentLanguage` / `addTranslation` are **INSTANCE** methods on `CometChatLocalize`, NOT statics — calling e.g. `CometChatLocalize.setCurrentLanguage(...)` is a TS2339 error. Reach the live instance with `CometChatLocalize.getSharedInstance()` (registered by `CometChatUIKit.init*` / the provider) and configure it there — `getSharedInstance()?.init({ translationsForLanguage, timezone, calendarObject, fallbackLanguage, … })`. **Don't `new CometChatLocalize(...)`**: the provider reads only the shared instance, so a constructed one isn't wired to the UI. Language stays on the `locale` prop (default `"en-us"`) — the provider applies it on mount/change, overriding an earlier `init({ language })`.
- **Custom strings:** `CometChatLocalize.getSharedInstance()?.addTranslation(resources)` where `resources` is **nested per-language** `Record<lang, Record<key, string>>` (NOT a flat map; verified vs 7.1.0). Runtime hook: `useLocale()` → `{ getLocalizedString, language }`.
- **`getLocalizedString(key)` returns the RAW KEY on a miss** (verified in the kit — `translate` falls back to `return key`). So a snake_case token in the UI (`group_info`, `add_members`, `delete_and_exit`, `view_members`) is a **localization failure**: a wrong/removed key, a custom language set without its translations, or — the #1 cause — **custom UI that rendered the key literally as a label.**
- **NEVER hardcode a localization key as text.** Use the kit component (it localizes itself) or `useLocale().getLocalizedString(key)` — never `<button>group_info</button>`.
- Don't invent keys; verify against the localization docs (`.md` twin, never the `.d.ts`). **v6→v7 changed some keys**, so a stale v6 key now misses and shows the raw string.

## Accessibility
Defaults ship: `aria-label` on icon buttons; `role="listbox"`/`option` on lists; Tab/Enter/Esc keyboard nav; focus management on thread open/close. When customizing:
1. Icon-only button → add `aria-label="<verb>"`.
2. List item → keep `role="option"` + `aria-selected`.
3. Composer → keep an accessible `<label>` + `Enter`/`Shift+Enter`.
4. Modal → trap focus, restore on close, `role="dialog"` + `aria-modal="true"` + labelled heading.
5. Theming → verify text contrast ≥ 4.5:1. Deep custom views own their own a11y; test with a screen reader + keyboard.
