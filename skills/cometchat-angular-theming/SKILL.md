---
name: cometchat-angular-theming
description: "CSS-variable theming for the CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) — the --cometchat-* token reference, brand color overrides, light/dark mode via CometChatUIKit.themeMode and the kit's ThemeService, global styles.css placement, and the ::ng-deep / ViewEncapsulation.None nuance Angular needs. NO theme service palette API (that was v4)."
license: "MIT"
compatibility: "Angular >=17 <22 (standalone APIs); @cometchat/chat-uikit-angular ^5.0; @cometchat/chat-sdk-javascript ^4.1"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular theming css-variables dark-mode typography branding v5 themeMode"
---

## Purpose

How to theme the CometChat **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`). v5 theming is **CSS-custom-property based** — the same `--cometchat-*` token system the React kit uses. You override tokens in your global stylesheet; every `<cometchat-*>` component reads them through the cascade. There is **no programmatic palette API** in v5.

**Read `cometchat-angular-core` first** — install, init, login, standalone-component model.

Ground truth: `@cometchat/chat-uikit-angular@5.0.2` bundled types + the kit's bundled CSS variables. The full token list (200+) is shared across the web kits — query the docs MCP or read the kit's bundled `css-variables.css` rather than inventing names. **Official docs:** https://www.cometchat.com/docs/ui-kit/angular/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).

---

## 1. v4 → v5: what changed

| Area | v4 (legacy, NgModule, Angular 12–15) | v5 (this skill, standalone, Angular 17–21) |
|---|---|---|
| Theme mechanism | `CometChatThemeService` injected in `AppComponent` | **CSS variables** (`--cometchat-*`) in global styles |
| Brand color | `themeService.theme.palette.setPrimary({ light, dark })` | **`:root { --cometchat-primary-color: #...; }`** |
| Light/dark mode | `themeService.theme.palette.setMode("dark")` | **`CometChatUIKit.themeMode = 'dark'`** (static setter) or the kit's `ThemeService` |
| Per-component styling | `*Style` objects (`new ConversationsStyle({...})`) from `@cometchat/uikit-shared` | **CSS variables + scoped CSS overrides** (`::ng-deep` / `ViewEncapsulation.None`) |
| Token source package | `@cometchat/uikit-shared` | bundled in `@cometchat/chat-uikit-angular` |

**Removed in v5 — do NOT emit (phantom symbols):** `CometChatThemeService`; `theme.palette.setMode()/setPrimary()/setAccent()`; the `*Style` constructors (`ConversationsStyle`, `MessageListStyle`, `AvatarStyle`, …) and their `@cometchat/uikit-shared` package. Translate `setPrimary({light,dark})` into a `:root` light token + a dark-scoped override (§4); translate each `*Style` field into the matching `--cometchat-*` variable or a scoped CSS rule (§7 Recipe 3).

---

## 2. How theming works in v5

Every `<cometchat-*>` component reads `--cometchat-*` CSS variables at render time — there is no color/font props API on the components.

```
your global styles.css   :root { --cometchat-primary-color: #...; }
        ↓ (CSS cascade)
every <cometchat-*> component picks up the value automatically
```

**Precedence (high → low):** scoped CSS override (with `::ng-deep`/`ViewEncapsulation.None`) → `:root { --cometchat-* }` global override → kit default tokens.

---

## 3. Where to put overrides in Angular (the key nuance)

### Global tokens → `src/styles.css` (the common case)

`src/styles.{css,scss}` is **not** view-encapsulated, so `:root` overrides there cascade into every component including the kit. ~95% of theming lives here:

```css
/* src/styles.css — app-wide */
:root {
  --cometchat-primary-color: #6852D6;
  --cometchat-font-family: "Inter", sans-serif;
}
```

(Confirm it's listed in `angular.json` → `…architect.build.options.styles` — it is by default.)

### Component-scoped overrides → need `::ng-deep` or `ViewEncapsulation.None`

> **Angular gotcha (#1 reason a CometChat override "does nothing"):** the kit renders **inside your component's view**, and Angular's default `ViewEncapsulation.Emulated` rewrites a component's CSS with a per-component attribute. A plain rule in `chat.component.css` only matches elements carrying that attribute — the kit's nested DOM does not — so the rule silently fails.

**Option A — `::ng-deep`** (scoped, keeps default encapsulation):

```css
/* chat.component.css */
:host ::ng-deep {
  --cometchat-primary-color: #FF6B35;
  --cometchat-background-color-01: #ffffff;
}
```

**Option B — `ViewEncapsulation.None`** (component CSS becomes global while mounted):

```typescript
@Component({
  selector: "app-chat",
  standalone: true,
  styleUrls: ["./chat.component.css"],
  encapsulation: ViewEncapsulation.None,
})
export class ChatComponent {}
```

**Recommendation:** use global `src/styles.css` for brand/app-wide theming (no encapsulation issue). Reach for `::ng-deep` / `ViewEncapsulation.None` only when you need *different* CometChat theming in *different* parts of the app.

---

## 4. Light / dark mode

### 4a. `CometChatUIKit.themeMode` — the kit's switch

Static setter (verified in v5 `.d.ts`: `static set themeMode(value: 'light' | 'dark')`):

```typescript
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
CometChatUIKit.themeMode = "dark";   // 'light' | 'dark'
```

### 4b. `ThemeService` — Angular-idiomatic toggle (optional)

The kit exports an injectable `ThemeService` (`providedIn: 'root'`, from `@cometchat/chat-uikit-angular`) that on construction reads OS `prefers-color-scheme`, applies a `data-theme` attribute on `<html>` (SSR-safe via the `DOCUMENT` token), follows live OS changes, and exposes a `currentTheme` signal (`'light' | 'dark'`). API: `currentTheme()`, `setTheme('light' | 'dark')`, `toggleTheme()`, `initFromPreference()`. It is a **mode toggle only** (no colors/palette).

> **Two gotchas, verified against the v5.0.2 source:**
> 1. **It does NOT persist to `localStorage`.** The kit's own JSDoc claims it does, but `applyTheme()` only sets the signal + the `<html>` `data-theme` attribute — there is no `localStorage` write. If you need persistence across reloads, wrap it (read/write `localStorage` yourself).
> 2. **It does NOT touch `CometChatUIKit.themeMode`.** Toggling `ThemeService` flips `<html data-theme>` (which your CSS overrides key off, §4c) but leaves the SDK-level `themeMode` (§4a) on its default. The kit's sample app bridges this with a thin wrapper that mirrors the signal into the SDK setter via an `effect` (see §4d).

```typescript
import { Component, inject } from "@angular/core";
import { ThemeService } from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-root", standalone: true,
  template: `<button (click)="toggle()">{{ themeService.currentTheme() === 'dark' ? 'Light' : 'Dark' }} mode</button>`,
})
export class AppComponent {
  themeService = inject(ThemeService);
  constructor() { this.themeService.initFromPreference(); }
  toggle() { this.themeService.toggleTheme(); }   // or setTheme('dark' | 'light')
}
```

### 4d. Keep `themeMode` in sync (the sample-app pattern)

If you want the kit's `ThemeService` toggle (§4b) AND the SDK-level `CometChatUIKit.themeMode` (§4a) to stay aligned, wrap the kit service and mirror its signal — this is exactly what the v5 sample app does:

```typescript
import { Injectable, inject, effect } from "@angular/core";
import { ThemeService as UIKitThemeService, CometChatUIKit } from "@cometchat/chat-uikit-angular";

@Injectable({ providedIn: "root" })
export class AppThemeService {
  private uiKitTheme = inject(UIKitThemeService);
  readonly currentTheme = this.uiKitTheme.currentTheme;          // re-expose for templates
  private sync = effect(() => { CometChatUIKit.themeMode = this.uiKitTheme.currentTheme(); },
                        { allowSignalWrites: true });
  setTheme(t: "light" | "dark") { this.uiKitTheme.setTheme(t); }
  toggleTheme() { this.uiKitTheme.toggleTheme(); }
}
```
Inject `AppThemeService` (not the kit one directly) so the SDK-sync side-effect always fires.

### 4c. Your own dark token overrides (CSS)

**OS-driven:**
```css
@media (prefers-color-scheme: dark) {
  :root {
    --cometchat-primary-color: #A594F3;
    --cometchat-background-color-01: #1A1A2E;
    --cometchat-text-color-primary: #E0E0E0;
  }
}
```

**App-controlled** (scope to whatever `ThemeService`/your toggle writes on `<html>`, e.g. `data-theme="dark"`):
```css
[data-theme="dark"] {
  --cometchat-primary-color: #A594F3;
  --cometchat-background-color-01: #1A1A2E;
  --cometchat-text-color-primary: #E0E0E0;
}
```

Don't ship both OS-driven and app-toggle dark overrides unless the user explicitly wants the hybrid.

---

## 5. The `--cometchat-*` token reference

Shared web-kit tokens (same names as the React kit). Set in `src/styles.css`. **Do not invent names** — query the docs MCP or read the kit's bundled `css-variables.css`.

| Variable | Controls |
|---|---|
| `--cometchat-primary-color` | Outgoing bubble, primary buttons, active tab, accents |
| `--cometchat-primary-color-hover` | Hover of primary elements |
| `--cometchat-text-color-primary` | Main body text |
| `--cometchat-text-color-secondary` | Timestamps, muted labels |
| `--cometchat-text-color-tertiary` | Placeholders |
| `--cometchat-background-color-01` | Main app background |
| `--cometchat-background-color-02` | Panels (list, details sidebar) |
| `--cometchat-background-color-03` | Hover / selected states |
| `--cometchat-icon-color-primary` / `-secondary` | Icon tints |
| `--cometchat-border-color-default` / `-light` | Borders, dividers |
| `--cometchat-font-family` | All text |
| `--cometchat-radius-1` / `-2` / `-3` / `-max` | Corner radii (`-max` = `999px` circular) |

**Palette scales** (the real brand-swap surface — verified present in the Angular kit): `--cometchat-neutral-color-50` … `-900` (greys: surfaces, borders, disabled; **`-300`** is the incoming message-bubble body) and `--cometchat-extended-primary-color-50` … `-900` (the brand-color tints/shades the kit derives for hovers, badges, selected states — set these alongside `--cometchat-primary-color` for a full re-skin). Plus semantic `--cometchat-error-color` / `-info-color` / `-success-color` / `-warning-color`.

For the full 200+ list, query the docs MCP (§9).

---

## 6. Preset themes

Write the values into `src/styles.css` as a `:root` block.

| Preset | primary-color | text-color-primary | background-color-01 | font-family | radius-2 |
|---|---|---|---|---|---|
| `slack` | `#611f69` | `#1d1c1d` | `#ffffff` | `Lato, sans-serif` | `8px` |
| `whatsapp` | `#25d366` | `#111b21` | `#f0f2f5` | `'Segoe UI', sans-serif` | `12px` |
| `imessage` | `#007aff` | `#000000` | `#ffffff` | `-apple-system, sans-serif` | `18px` |
| `discord` (dark) | `#5865f2` | `#dcddde` | `#36393f` | `'gg sans', sans-serif` | `8px` |
| `notion` | `#2eaadc` | `#37352f` | `#ffffff` | `-apple-system, sans-serif` | `6px` |

---

## 7. Recipes

**Recipe 1 — brand color (most common):**
```css
:root { --cometchat-primary-color: #FF6B35; --cometchat-primary-color-hover: #E85D2C; }
```
One token recolors the outgoing bubble, send button, active tab, and every primary accent.

**Recipe 2 — brand + dark toggle:** wire `ThemeService` (§4b — optionally the `themeMode`-syncing wrapper in §4d) + `:root` light tokens + `[data-theme="dark"]` overrides (§4c). The toggle flips `<html data-theme>`; your `[data-theme="dark"]` block recolors the kit.

**Recipe 3 — custom bubble colors** (class-level, not tokens; needs `::ng-deep`; class names aren't version-stable — verify in DevTools). Prefer overriding the bubble's CSS *variable* inside the `__body` selector over a raw `background` (keeps the rest of the bubble styling intact; incoming bubbles read `--cometchat-neutral-color-300`):
```css
/* outgoing — override the var the body reads */
:host ::ng-deep .cometchat-message-bubble-outgoing .cometchat-message-bubble__body { --cometchat-primary-color: #FF6B35; }
/* incoming — neutral-300 is the incoming body token */
:host ::ng-deep .cometchat-message-bubble-incoming .cometchat-message-bubble__body { --cometchat-neutral-color-300: #E8E8E8; }
```
**Per-message-TYPE bubbles** (style one type only — chain the type class onto `__body`). The Angular kit spells these correctly (unlike the React kit): `__text-message`, `__image-message`, `__video-message`, `__audio-message`, `__file-message`, `__document-message`, `__poll-message`, `__sticker-message`, `__meeting-message`, `__whiteboard-message`, `__delete-message`, `__group-message`; plus the non-directional `.cometchat-action-bubble`.
```css
:host ::ng-deep .cometchat-message-bubble-outgoing .cometchat-message-bubble__body.cometchat-message-bubble__text-message { border-radius: 16px 16px 4px 16px; }
```

**Recipe 4 — custom font:** `:root { --cometchat-font-family: "Inter", sans-serif; }`

**Recipe 5 — rounded corners:** `:root { --cometchat-radius-2: 12px; --cometchat-radius-max: 999px; }`

---

## Localization

To translate the UI, switch the active language, or override individual strings, route to the dedicated **`cometchat-i18n`** skill — the canonical cross-family localization reference. Angular v5 uses `CometChatLocalize.init({ language })` + `setCurrentLanguage(...)` / `getLocalizedString(key)` / `addTranslation({...})` (the object signature, **not** the v4 positional `init("es")` form). `cometchat-i18n` covers bundled languages, custom strings, RTL, and date/time formatting.

## Sound Manager — custom notification & call sounds

Sounds are a **behavioral** customization (not CSS) — driven by `CometChatSoundManager`, a helper class with static methods. The UI Kit plays the built-in cues automatically; use this to override a cue with your own audio. `Sound` is a frozen object ON the class (`CometChatSoundManager.Sound`), not a separate export. (Docs: ui-kit/angular/sound-manager.)

```typescript
import { CometChatSoundManager } from "@cometchat/chat-uikit-angular";

// Play a default cue — keys: incomingCall | outgoingCall | incomingMessage
//                              | incomingMessageFromOther | outgoingMessage
CometChatSoundManager.play(CometChatSoundManager.Sound.incomingCall);

// Override a cue with your own audio (2nd arg = custom URL/asset path)
CometChatSoundManager.play(CometChatSoundManager.Sound.incomingMessage, 'assets/sounds/ping.mp3');

// Per-event helpers (call versions loop until pause); then stop:
CometChatSoundManager.onIncomingCall();
CometChatSoundManager.pause();
```

## 8. Anti-patterns

1. **Don't use `CometChatThemeService`** — phantom in v5. Theme via CSS variables + `CometChatUIKit.themeMode` / `ThemeService`.
2. **Don't call `theme.palette.setMode()/setPrimary()`** — phantom v4 APIs.
3. **Don't construct `*Style` objects** (`new ConversationsStyle({...})`, etc.) — pattern + `@cometchat/uikit-shared` gone in v5. Use CSS variables / scoped CSS.
4. **Don't put component-scoped overrides in encapsulated component CSS and expect them to hit the kit** — use global `styles.css`, `:host ::ng-deep`, or `ViewEncapsulation.None` (§3).
5. **Don't invent `--cometchat-*` names** — a misspelled token silently does nothing.
6. **Don't rely on memorized kit CSS class names** for component-level overrides (Recipe 3) — verify in DevTools per version.
7. **Don't edit `node_modules`** — override in your own stylesheet so it survives reinstalls.

---

## 9. Docs MCP (recommended)

```bash
claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp
```

For the full 200+ token list + component CSS selectors. Per-version exact tokens ship in `node_modules/@cometchat/chat-uikit-angular/styles/css-variables.css` (verified v5.0.2: tokens live under a `:root` block, with the kit's own dark overrides under `[data-theme="dark"]`). `CometChatUIKit.themeMode` (static get/set), `ThemeService`, and `CometChatSoundManager` are all confirmed in the bundled `.d.ts`.

## Skill routing
- `cometchat-angular-core` — init/login/standalone
- `cometchat-angular-components` — selectors, inputs/outputs, slots
- `cometchat-angular-customization` — slot views, formatters, templates, events
- `cometchat-angular-troubleshooting` — colors not applying / encapsulation issues
