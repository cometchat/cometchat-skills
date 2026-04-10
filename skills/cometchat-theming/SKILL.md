---
name: cometchat-theming
description: Customize CometChat UI to match the user's app design system. Generates CSS variable overrides, theming partials, and dark mode pairs. Requires an existing integration (.cometchat/state.json must exist).
license: "MIT"
compatibility: "Node.js >=18; @cometchat/chat-uikit-react ^6; integration must already be applied"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, grepSearch"
metadata:
  author: "CometChat"
  version: "2.0.0"
  tags: "cometchat theming css customization branding dark-mode"
---

> **STATUS: v2.0.** This skill is a thin wrapper around the
> `cometchat apply-theme` CLI command which ships in `@cometchat/skills-cli@2.0.0`
> on npm. The CLI handles all CSS generation, framework-specific file
> targeting, and the Astro special case deterministically. This skill's
> job is to figure out what the user wants (preset / brand color / token
> extraction from existing config) and call the right `apply-theme` form.

## Use this skill when

The user wants to customize the look and feel of an already-integrated
CometChat UI. Trigger phrases:

- `/cometchat theming`
- `/cometchat theme`
- "match my brand colors"
- "make cometchat dark mode"
- "change the chat colors"
- "customize the cometchat ui"
- "the chat doesn't match my design system"

## Preconditions

The user must have an existing integration. Run:

```bash
npx @cometchat/skills-cli@latest info --json
```

If `integrated` is `false`, **stop** and tell the user to run `/cometchat`
to create an integration first. Theming requires base files to override.

## Docs MCP contract

The CometChat docs MCP at `cometchat-docs` is a **hard requirement** for
non-preset theming questions. It's the canonical source for:

- The full CSS variable list (200+ tokens) with descriptions
- Component-level styling selectors (`.cometchat-message-bubble-outgoing`,
  `.cometchat-conversations-header`, etc.)
- Dark mode patterns
- Font / radius / spacing token names

**Hard rules:**

1. **For preset and basic color theming**, use `cometchat apply-theme`
   directly — it has the canonical SDK variable list baked in (verified
   by sdk-validation.test.ts at build time).
2. **For component-level CSS overrides** (e.g., "make incoming bubbles
   green"), query the docs MCP for the right selector class. Never invent
   CSS class names from memory.
3. **If the docs MCP is not installed and the user asks for non-preset
   theming**, STOP. Tell the user: "I need the CometChat docs MCP for
   that. Install it with `claude mcp add --transport http cometchat-docs
   https://www.cometchat.com/docs/mcp` and re-run."
4. **Canonical reference URL:**
   https://www.cometchat.com/docs/ui-kit/react/theme

## Steps

This skill is **thin glue** around `cometchat apply-theme`. The CLI knows
which CSS file to write per framework, knows the canonical CometChat CSS
variable names, handles the Astro special case, and is idempotent. Do NOT
hand-write CSS overrides — the CLI is the source of truth.

### Step 1 — Read current state

```bash
npx @cometchat/skills-cli@latest info --json
```

If `integrated` is `false`, **stop** and tell the user to run `/cometchat`
to create an integration first. Theming requires base files to override.

### Step 2 — Determine the theme source

If the user already specified what they want (a brand color, a preset
name, a copy-pasted hex code), use it directly and skip to Step 3.

Otherwise, **ask the user** using the `AskUserQuestion` tool so they get an arrow-key selector:

Use `AskUserQuestion` with these options:
- **question:** "How do you want to theme CometChat?"
- **header:** "Theme"
- **multiSelect:** false
- **options:**
  1. label: "Use a preset", description: "Pick one of: slack, whatsapp, imessage, discord, notion. One command, full theme."
  2. label: "Match my brand", description: "Give me your primary brand color (hex) and optionally a font family + border radius. I'll generate the override."
  3. label: "Match my existing design system", description: "Point me at your tailwind.config.{js,ts} or your CSS variables file. I'll extract the tokens and use them."

Map the selection: Use a preset → Path A, Match my brand → Path B, Match my existing design system → Path C.

### Step 3 — Apply the theme via the CLI

**Path A — Preset:**

```bash
npx @cometchat/skills-cli@latest apply-theme --preset <name>
```

Where `<name>` is one of `slack`, `whatsapp`, `imessage`, `discord`, `notion`.
Each preset bundles primary + text + background + font + radius + dark-mode
in one command.

**Path B — Custom brand color:**

```bash
npx @cometchat/skills-cli@latest apply-theme \
  --primary-color "#hex" \
  [--text-color "#hex"] \
  [--background-color "#hex"] \
  [--font-family "Family Name"] \
  [--border-radius "8px"] \
  [--dark-mode]
```

Only `--primary-color` is required; the rest are optional. The CLI uses
sensible defaults for anything you omit.

**Path C — Match existing design system:**

Read the user's `tailwind.config.{js,ts}` (look for `theme.colors.primary`,
`theme.colors.background`, `theme.fontFamily.sans`, `theme.borderRadius`)
or their root CSS file (look for `--primary`, `--background`, etc.). Extract
the tokens. Then run the same command shape as Path B with the extracted
values:

```bash
npx @cometchat/skills-cli@latest apply-theme \
  --primary-color "<extracted>" \
  --text-color "<extracted>" \
  --background-color "<extracted>" \
  --font-family "<extracted>" \
  --border-radius "<extracted>"
```

The CLI knows the framework (from `state.json`) and writes the override
to the correct CSS file automatically:
- reactjs → `src/index.css`
- nextjs → `src/app/globals.css`
- react-router → `app/app.css`
- astro → inside `src/cometchat/ChatApp.tsx` (special — Astro
  `client:only="react"` islands don't pick up global stylesheets)

### Step 4 — Verify

```bash
npx @cometchat/skills-cli@latest verify --json
```

If anything fails, surface verbatim.

### Step 5 — Tell the user to restart the dev server

The theme is applied. Tell the user:
1. Restart the dev server (CSS changes need a fresh reload)
2. Refresh the chat page
3. Verify the colors match their design

If the theme doesn't appear to apply, run `cometchat doctor` for
combined drift + env + AST diagnostics — it will catch cases like the
override block landing in the wrong file or being shadowed by an
earlier rule. For deeper triage, route to the
`cometchat-troubleshooting` skill.

## Hard rules

- Never apply theming to a project without an existing CometChat integration.
- Always use `cometchat apply-theme` — the CLI is the source of truth for
  variable names, target file paths, and the Astro special case.
- NEVER hand-write CSS override blocks. The CLI does this deterministically.
- Never invent CSS variable names. The CLI uses the canonical SDK list
  (verified by sdk-validation.test.ts at build time).
- Never overwrite the user's existing CSS variables — `apply-theme` is
  append-only and idempotent.
- Never edit `node_modules` or vendor files.
- Always use `npx @cometchat/skills-cli@latest`.
- Always write theme overrides AFTER the css-variables.css import, not before.
- Astro is special: theme overrides must live inside the .tsx React island file.
- Always use `npx @cometchat/skills-cli@latest`.
