---
name: cometchat-theming
description: Customize CometChat UI to match the user's app design system. Covers the CSS variable cascade, preset themes, brand color overrides, design system extraction, dark mode, and framework-specific override locations.
license: "MIT"
compatibility: "Node.js >=18; @cometchat/chat-uikit-react ^6; integration must already be applied"
metadata:
  author: "CometChat"
  version: "3.1.0"
  tags: "cometchat theming css customization branding dark-mode"
---

> **Ground truth:** per-platform UI Kit theme system + `docs/ui-kit`. **Official docs:** https://www.cometchat.com/docs/ui-kit/react/theme · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

> **Companion skills:** `cometchat-core` covers CSS import placement
> and the one-import rule; `cometchat-customization` covers
> component-level CSS selectors for deeper overrides;
> `cometchat-troubleshooting` handles cases where the theme doesn't
> apply.

## Purpose

Teach Claude how to theme CometChat in a v3 (AI-written) integration.
Themes are just CSS variable overrides — you write them directly into
the project's CSS (or, for Astro, the React island file). **Do not use
the `cometchat apply-theme` CLI command — it was a v2 tool that expects
a CLI-generated `.cometchat/state.json` marker that v3 integrations
don't create, and it will fail with "No integration found".**

---

## 1. How CometChat theming works

### The CSS variable cascade

CometChat's entire visual identity is driven by **200+ CSS custom
properties** defined in `@cometchat/chat-uikit-react/css-variables.css`.
This file is imported once at the app root (see `cometchat-core`).
Every `<CometChat*>` component reads these variables — there is no
component-level style-props API for colors, fonts, or spacing.

**Scope to `.cometchat`, not `:root`.** The UI Kit renders under a `.cometchat`
root element. The canonical scope (per the docs) is that class — it keeps the
overrides from leaking into the rest of your app, and it's where component-scoped
overrides hang off. (`:root` *works* because CSS variables inherit downward, but
it's global and lower-precedence — prefer `.cometchat`.) Write the rules **after**
the `css-variables.css` import.

```css
/* Must appear AFTER the @import of css-variables.css */

/* Global — applies to every CometChat component */
.cometchat {
  --cometchat-primary-color: #6C63FF;
  --cometchat-background-color-01: #FFFFFF;
  --cometchat-text-color-primary: #141414;
  --cometchat-font-family: "Inter", sans-serif;
  --cometchat-radius-2: 8px;
}

/* Component-scoped — only the conversations list */
.cometchat .cometchat-conversations {
  --cometchat-primary-color: #FF6C63;
}
```

**Precedence ladder** (highest wins): runtime `element.style.setProperty(...)` →
component-scoped `.cometchat .cometchat-<component> { --var }` → global
`.cometchat { --var }` → the kit's `css-variables.css` defaults.

### Dark mode

Two broad strategies — pick based on how the project already handles dark mode.

**Strategy A — OS-driven only** (simplest). Overrides live inside a `@media (prefers-color-scheme: dark)` block. The browser swaps themes based on the user's OS preference:

```css
@media (prefers-color-scheme: dark) {
  .cometchat {
    --cometchat-primary-color: #7B73FF;
    --cometchat-background-color-01: #1A1A2E;
    --cometchat-text-color-primary: #E0E0E0;
    /* ... remaining dark overrides ... */
  }
}
```

**Strategy B — App-controlled theme toggle.** If the project already has a theme toggle (next-themes, Tailwind `dark:` prefix, React Context, etc.), wire CometChat's dark mode to the same trigger. The trigger is typically a class or `data-theme` attribute on an ancestor (`<html>`/`<body>`/the `.cometchat-root` wrapper). Scope the override to **`.cometchat` under that ancestor** — NOT `:root` (a bare `:root` can never be a *descendant* of `.dark`/`[data-theme]`, so `.dark :root { }` matches nothing):

```css
/* next-themes default: applies a `.dark` class to <html> */
.dark .cometchat {
  --cometchat-primary-color: #7B73FF;
  --cometchat-background-color-01: #1A1A2E;
  --cometchat-text-color-primary: #E0E0E0;
}

/* OR data-theme="dark" on the wrapper (the kit's own convention + Tailwind v4) */
.cometchat-root[data-theme="dark"] .cometchat {
  --cometchat-primary-color: #7B73FF;
  --cometchat-background-color-01: #1A1A2E;
  --cometchat-text-color-primary: #E0E0E0;
}

/* OR for Tailwind's `class` strategy with `darkMode: 'class'` in tailwind.config */
html.dark .cometchat {
  --cometchat-primary-color: #7B73FF;
  --cometchat-background-color-01: #1A1A2E;
  --cometchat-text-color-primary: #E0E0E0;
}
```

**How to tell which selector the project uses:**

| Library / setup | Selector to target |
|---|---|
| `next-themes` (Next.js default) | `.dark` on `<html>` |
| Tailwind with `darkMode: 'class'` | `html.dark` (or `.dark` on any ancestor) |
| Tailwind with `darkMode: 'media'` | Matches `@media (prefers-color-scheme: dark)` — use Strategy A |
| Tailwind CSS v4 (`@custom-variant dark`) | `[data-theme="dark"]` by default |
| Radix UI / shadcn defaults | `.dark` class on `<html>` |
| Custom React Context (`useTheme()` hook) | Check what the context writes to the DOM — usually a class on `<html>` or `<body>` |

**Rule:** whichever selector is toggled by the app's theme system, use that same selector as the CometChat override's parent. The UI Kit components sit inside the app's DOM, so they inherit whatever variable values are active at the nearest matching scope.

**Do not** emit both Strategy A and Strategy B in the same stylesheet unless the user explicitly wants "follow OS except when app toggle is set." That's a legitimate pattern but usually over-engineered for a first integration — ship Strategy B alone if the project has a toggle, Strategy A if it doesn't.

### Why Astro is different

Astro's `client:only="react"` islands run in isolation — global
stylesheets in `.astro` layouts do not cascade into them. CSS variable
overrides in a global `.css` file will have no effect on CometChat
components. The overrides must live **inside the React island `.tsx`
file** (typically `src/cometchat/ChatApp.tsx`), as an inline `<style>`
tag or a CSS import within the component.

---

## 2. Use this skill when

The user wants to customize the look and feel of an already-integrated
CometChat UI. Trigger phrases:

- `/cometchat theming`, `/cometchat theme` (or invoke the cometchat-theming skill via your agent's mechanism — keyword "cometchat theming" or "match brand colors" works in most agents)
- "match my brand colors"
- "make cometchat dark mode"
- "change the chat colors"
- "customize the cometchat ui"
- "the chat doesn't match my design system"

## 3. Preconditions

The project must already have a CometChat integration. Check by looking
for `.cometchat/config.json` and the UI Kit dependency:

```bash
test -f .cometchat/config.json && cat package.json | grep "@cometchat/chat-uikit-react"
```

If neither is present, **stop** and tell the user to run `/cometchat`
to create an integration first. Theming requires the provider +
`css-variables.css` import to already be in place.

## 4. When to use which path

| Situation | Path |
|---|---|
| Complete, opinionated theme fast | **Path A** — Preset |
| Brand color hex (and optionally font/radius) | **Path B** — Brand color |
| Existing Tailwind config or CSS custom properties | **Path C** — Design system extraction |

---

## 5. Preset values

Five built-in presets. All values are in the table below — write them
directly into the override CSS; do **not** try to call a CLI for this.

| Preset | `--cometchat-primary-color` | `--cometchat-text-color-primary` | `--cometchat-background-color-01` | `--cometchat-font-family` | `--cometchat-radius-2` | Dark mode included |
|---|---|---|---|---|---|---|
| `slack` | `#611f69` | `#1d1c1d` | `#ffffff` | `Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | `8px` | no |
| `whatsapp` | `#25d366` | `#111b21` | `#f0f2f5` | `'Segoe UI', Helvetica, Arial, sans-serif` | `12px` | no |
| `imessage` | `#007aff` | `#000000` | `#ffffff` | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif` | `18px` | no |
| `discord` | `#5865f2` | `#dcddde` | `#36393f` | `'gg sans', 'Noto Sans', Helvetica, Arial, sans-serif` | `8px` | **yes** |
| `notion` | `#2eaadc` | `#37352f` | `#ffffff` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif` | `6px` | no |

## 6. Where to write the overrides

Target file is determined by `framework` in `.cometchat/config.json`:

| Framework | Target file |
|---|---|
| `reactjs` | `src/index.css` (append a `.cometchat { ... }` block after the existing import) |
| `nextjs` | `src/app/globals.css` (App Router) or `styles/globals.css` (Pages Router) |
| `react-router` | `app/app.css` (or `src/index.css` if you used a Vite-style structure) |
| `astro` | Inline `<style>` tag or imported CSS **inside** `src/cometchat/ChatApp.tsx` (see section 1 for why) |

Scope the block to `.cometchat` (global) or `.cometchat .cometchat-<component>` (component-specific) — see §1's precedence ladder.

The override block must be written **after** the existing
`@cometchat/chat-uikit-react/css-variables.css` import so it takes
precedence. If the project imports the CometChat CSS in a TSX file
(e.g. `src/main.tsx`), the override can still live in the adjacent
`index.css` because it appears in the DOM after the JS import resolves.

## 7. Steps

### Step 1 — Ask what theme source to use

If the user already specified a preset name, brand color, or pointed
to a design system file, skip to Step 2.

Otherwise ask the user (preserve the structured shape — `question`/`header`/`multiSelect`/`options[].label`/`options[].description`):
- **question:** "How do you want to theme CometChat?"
- **header:** "Theme"
- **multiSelect:** false
- **options:**
  1. label: "Use a preset", description: "Pick one of: slack, whatsapp, imessage, discord, notion."
  2. label: "Match my brand", description: "Give me your primary brand color (hex). I'll also ask about font and radius."
  3. label: "Match my existing design system", description: "Point me at your tailwind.config.{js,ts} or your CSS variables file. I'll extract the tokens."

### Step 2 — Build the override block

**Path A — Preset:** Look up the preset in section 5's table. Emit a
`.cometchat { ... }` block with those five variables. If the preset's
`Dark mode included` column is "yes" (currently just `discord`),
also emit a `@media (prefers-color-scheme: dark) { .cometchat { ... } }`
block with sensible dark variants (invert background to dark, text to
light, keep primary).

**Path B — Custom brand color:** The user gave you a hex (e.g.
`#853953`). Emit at minimum:

```css
.cometchat {
  --cometchat-primary-color: #853953;
}
```

Then ask if they want:
- a matching font family (defaults to the project's existing font
  stack from `body { font-family: ... }` in the project's main CSS)
- a border radius (defaults to `8px`)
- dark mode variants

### Step 3 — Read the current CSS file

Read the target file (see section 6) so you can append to it instead
of overwriting existing rules. Check the file doesn't already have a
`--cometchat-primary-color` line — if it does, you're updating an
earlier theming pass; replace that block rather than duplicating.

### Step 4 — Write / update the override block

Use `Edit` to insert or replace the `.cometchat` block. Keep it grouped and
commented so the user can see where their theme lives:

```css
/* CometChat theme override — edit these to change the chat UI */
.cometchat {
  --cometchat-primary-color: #853953;
  --cometchat-font-family: "Inter", sans-serif;
}
```

**Path C — Design system extraction:** Read
`tailwind.config.{js,ts}` (look for `theme.colors.primary`,
`theme.colors.background`, `theme.fontFamily.sans`,
`theme.borderRadius`) or the project's root CSS file (look for
`--primary`, `--background`, etc.). Extract the tokens. Then use
Path B's block shape with the extracted values.

### Step 5 — Save the choice to config

```bash
npx @cometchat/skills-cli config set theme "<preset-or-custom>"
```

Where `<preset-or-custom>` is the preset name (e.g. `slack`) or
`custom` for Path B / Path C.

### Step 6 — Tell the user to restart the dev server

The theme is applied. Tell the user:
1. Restart the dev server (CSS changes need a fresh reload)
2. Refresh the chat page
3. Verify the colors match their design

If the theme doesn't appear to apply:
- Double-check the override block is **after** the css-variables.css
  import in the DOM order
- For Astro: confirm the override is inside the `.tsx` island, not a
  global `.css` file
- Route to `cometchat-troubleshooting` for deeper triage.

## 8. Extended variable list (reference)

Beyond the five "headline" variables in the preset table, common ones
worth knowing:

| Variable | What it controls |
|---|---|
| `--cometchat-primary-color` | Active message bubble, primary buttons, brand accents |
| `--cometchat-text-color-primary` | Main body text |
| `--cometchat-text-color-secondary` | Timestamps, muted labels |
| `--cometchat-background-color-01` | Main app background |
| `--cometchat-background-color-02` | Panels (conversation list, details sidebar) |
| `--cometchat-background-color-03` | Hover / selected states |
| `--cometchat-border-color-light` | Dividers between rows |
| `--cometchat-font-family` | All text |
| `--cometchat-radius-2` | Medium radius (bubbles, buttons) |
| `--cometchat-radius-3` | Larger radius (panels) |

### Color palette scales (the real brand-swap surface)

`--cometchat-primary-color` is the headline accent, but the docs' canonical
brand-override surface is two **numbered scales** (50 → 900, light + dark hex
each) — set these to re-skin the kit, not just the single primary token:

| Scale | What it drives |
|---|---|
| `--cometchat-neutral-color-50` … `-900` | Greys: surfaces, borders, dividers, disabled. **`--cometchat-neutral-color-300`** is the incoming message-bubble body (default `#E8E8E8`). |
| `--cometchat-extended-primary-color-50` … `-900` | Tints/shades of the brand color the kit derives for hovers, badges, selected states. Set these alongside `--cometchat-primary-color` for a complete brand swap. |

Plus the semantic status tokens: `--cometchat-error-color`, `--cometchat-info-color`, `--cometchat-success-color`, `--cometchat-warning-color`, and `--cometchat-message-seen-color`. (Docs: ui-kit/react/theme/color-resources.)

For the full 200+ list, query the docs MCP (see below) or read
`node_modules/@cometchat/chat-uikit-react/dist/styles/css-variables/css-variables.css`.

## 9. Docs MCP contract

The CometChat docs MCP at `cometchat-docs` is the canonical source for:

- The full CSS variable list (200+ tokens) with descriptions
- Component-level styling selectors (`.cometchat-message-bubble-outgoing`,
  `.cometchat-conversations-header`, etc.)
- Dark mode patterns beyond the simple invert
- Font / radius / spacing token names

**When to use it:**
- Component-level overrides beyond the 10 tokens above (e.g., "make
  incoming bubbles green" needs a specific selector) — query the docs
  MCP. Never invent CSS class names from memory.
- If the docs MCP is not installed and the user asks for this, tell
  them: "I need the CometChat docs MCP for component-level styling.
  Install it with `claude mcp add --transport http cometchat-docs
  https://www.cometchat.com/docs/mcp` and re-run."

**Canonical reference URL:**
https://www.cometchat.com/docs/ui-kit/react/theme

## 10. Copy-ready UI recipes (ENG-35714)

A short catalog of worked examples for the most-asked customizations. Pasted into `cometchat-overrides.css` (or the framework-specific override file from §6), these compile against any kit ≥ v5 without further tweaking.

### Recipe 1 — Brand color + system font (most common)

```css
.cometchat {
  /* Brand primary — replaces "CometChat purple" everywhere it shows up */
  --cometchat-primary-color: #2563EB;   /* tailwind blue-600 */
  --cometchat-primary-button-background: var(--cometchat-primary-color);
  --cometchat-primary-button-text: #FFFFFF;   /* NOT -primary-button-text-color */

  /* System font stack — matches your app's typography */
  --cometchat-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
```

### Recipe 2 — Force dark mode (regardless of OS)

```css
/* App-controlled: you set data-theme="dark" on the .cometchat-root wrapper.
   The canonical scope is `.cometchat-root[data-theme="dark"] .cometchat` —
   NOT a bare `:root`/`[data-theme="dark"]` (a bare :root in the selector list
   would force dark UNCONDITIONALLY, ignoring the toggle). */
.cometchat-root[data-theme="dark"] .cometchat {
  --cometchat-background-color-01: #0F172A;   /* page background */
  --cometchat-background-color-02: #1E293B;   /* card / surface */
  --cometchat-background-color-03: #334155;   /* hover */
  --cometchat-text-color-primary: #F1F5F9;
  --cometchat-text-color-secondary: #94A3B8;
  --cometchat-border-color-default: #1E293B;
  --cometchat-primary-color: #60A5FA;          /* lighter primary for dark bg */
  color-scheme: dark;
}
```

For OS-driven auto theme (the default per ENG-35715), wrap the same variables in `@media (prefers-color-scheme: dark) { .cometchat { … } }` instead of the `data-theme` selector. The variables-only approach beats class-toggling because it works everywhere the kit renders without an explicit theme prop.

### Recipe 3 — Custom message bubble color (outgoing/incoming)

**Preferred technique (per docs): override the CSS *variable* inside the bubble
`__body` selector** — not raw `background`/`color`. The kit's bubble reads
`--cometchat-neutral-color-300` (incoming) and the primary color (outgoing); setting
those inside the scoped selector keeps the rest of the bubble's styling intact.

```css
/* Outgoing bubble (your messages) — override the variable the body reads */
.cometchat .cometchat-message-bubble-outgoing .cometchat-message-bubble__body {
  --cometchat-primary-color: #2563EB;
}

/* Incoming bubble (their messages) — neutral-300 is the incoming body token */
.cometchat .cometchat-message-bubble-incoming .cometchat-message-bubble__body {
  --cometchat-neutral-color-300: #E8E8E8;
}
```

**Per-message-TYPE overrides.** Beyond direction, the kit body carries a
per-type class so you can style one message type only. Chain it onto the body:

```css
/* Style only TEXT bubbles outgoing */
.cometchat .cometchat-message-bubble-outgoing
  .cometchat-message-bubble__body.cometchat-message-bubble__text-message {
  border-radius: 16px 16px 4px 16px;
}
```

> ⚠️ **Use the kit's ACTUAL class names — some are misspelled in the kit's own CSS** (verified against `cometchat-uikit-react-v6/src/styles/`). Real per-type classes: `__text-message`, `__audio-message`, `__file-message`, `__document-message`, `__delete-message`, `__sticker-message`, **`__pol-message`** (poll — note the missing `l`), and **`__whiteboad-message`** (note the missing `r`; a correctly-spelled `__whiteboard-message` also exists). The non-directional `.cometchat-action-bubble` styles call/group action bubbles. Direction classes are `.cometchat-message-bubble-outgoing` / `-incoming` (NOT BEM `--sender`/`--receiver`). Class names are NOT version-stable — re-verify in DevTools (and against `src/styles/`) when the kit bumps; the CSS variables (Recipe 1) ARE stable.

### Recipe 4 — Rounded corners + borderless header

```css
.cometchat {
  --cometchat-radius-1: 8px;
  --cometchat-radius-2: 12px;
  --cometchat-radius-max: 999px;   /* fully circular avatars */
}

.cometchat .cometchat-message-header,
.cometchat .cometchat-conversations-header {
  border-bottom: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);   /* subtle shadow instead of a line */
}
```

### Recipe 5 — Tighter conversation list (denser layout)

```css
/* The kit's conversation rows are .cometchat-list-item inside .cometchat-conversations
   (there is NO .cometchat-conversations-list-item selector). Re-verify nested
   classes in DevTools — they aren't version-stable. */
.cometchat-conversations .cometchat-list-item {
  padding-block: 8px;          /* default is 12px */
}

.cometchat-conversations .cometchat-list-item .cometchat-avatar {
  width: 36px;                  /* default is 40-48px */
  height: 36px;
}
```

> ⚠️ **v6 has NO React theme-provider / theme object.** Earlier kits exposed `CometChatThemeProvider` + a `CometChatTheme` `{ palette, typography }` object — **neither exists in v6** (they're v4/v5 residue; importing them won't compile). v6 theming is **exclusively CSS variables** (Recipes 1–5) + the `[data-theme="dark"]` attribute. To drive theme from your design tokens, write your tokens INTO the `--cometchat-*` CSS variables. Read-only helpers `getThemeMode()` / `isDarkMode()` exist for branching logic, but there is no provider/theme-object API.

> **Where to find more recipes:** the upstream sample at https://github.com/cometchat/cometchat-uikit-react/tree/v6/sample-app has a `theme.tsx` with the full reference palette. For per-`*Style` field enumeration (a per-version exhaustive list), the kit's TypeScript `.d.ts` files in `node_modules/@cometchat/chat-uikit-react/dist/types/` are authoritative — open them when a recipe doesn't cover what you need.

### Recipe 6 — Custom notification & call sounds (Sound Manager)

Sounds are **not CSS** — they're driven by the Sound Manager, a helper class with static methods. The UI Kit plays the built-in cues automatically; use this to **override** a cue with your own audio, or to **mute** by passing a silent/empty track. (Docs: ui-kit/react/sound-manager.)

> **Access it as `CometChatUIKit.SoundManager`.** The class `CometChatSoundManager` is **NOT** a package-root export in v6 — `import { CometChatSoundManager } from "@cometchat/chat-uikit-react"` fails with `TS2459: ... declares 'CometChatSoundManager' locally, but it is not exported`. It is exposed as the static `CometChatUIKit.SoundManager` (verified `CometChatUIKit.ts:53`). And `play()` takes a **string literal** — `play("incomingCall")` — NOT `play(SoundManager.Sound.incomingCall)` (the `Sound` map's values are typed optional, so passing one fails `TS2345`; the kit's own JSDoc uses the string form). Verified against kit 6.5.1 in a live build (Journey-7 runtime test, 2026-06-14).

```ts
import { CometChatUIKit } from "@cometchat/chat-uikit-react";
const SoundManager = CometChatUIKit.SoundManager;

// Play a cue — pass the STRING LITERAL: "incomingCall" | "outgoingCall"
//   | "incomingMessage" | "incomingMessageFromOther" | "outgoingMessage"
SoundManager.play("incomingCall");

// Override a cue with your own audio (2nd arg = custom URL/asset path)
SoundManager.play("incomingMessage", "/sounds/ping.mp3");

// Per-event helpers exist too (each takes an optional custom-sound URL):
SoundManager.onIncomingCall("/sounds/ring.mp3");
SoundManager.onOutgoingMessage();

// Stop whatever is playing (resets playback position)
SoundManager.pause();
```

> Browser autoplay policies block audio until the user has interacted with the page — `SoundManager.hasInteracted()` returns whether that's happened, so gate any manual `play()` on it. To **mute** the kit's own cues, the cleaner path is the component-level config (e.g. `CometChatMessageList`/conversation sound props) rather than monkey-patching the manager.

## Hard rules

- **Do NOT call `cometchat apply-theme`.** It's a v2 CLI command that
  requires a CLI-generated `.cometchat/state.json` and fails on v3
  AI-written integrations. Write CSS directly instead.
- Never apply theming to a project without an existing CometChat
  integration (no `.cometchat/config.json` = no integration).
- Always write theme overrides **after** the css-variables.css import.
- Never invent CSS variable names. Use the preset table (section 5),
  the common-variables table (section 8), or query the docs MCP.
- Never edit `node_modules` or vendor files.
- Astro is special: theme overrides must live inside the `.tsx`
  React island file, not a global `.css`.
- Always use `npx @cometchat/skills-cli` for config saves.
