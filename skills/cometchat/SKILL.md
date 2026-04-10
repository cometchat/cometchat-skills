---
name: cometchat
description: Entry-point dispatcher for CometChat skills v2. Detects the user's framework via @cometchat/skills-cli and routes to the correct framework skill. Replaces the v1 prose dispatcher once the CLI is published to npm.
license: "MIT"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "2.0.0"
  tags: "cometchat dispatcher entry react chat"
---

## Use this skill when

The user wants to add CometChat to any kind of project. Trigger phrases:

- `/cometchat`
- `/cometchat 1` / `/cometchat 2` / `/cometchat 3` (experience numbers)
- `/cometchat conversation-list` / `/cometchat one-to-one` / `/cometchat tab-based`
- "add cometchat", "integrate cometchat", "add chat to my app"
- "add messaging", "add chat ui"

This is the **entry point**. Do not invoke framework-specific skills directly —
this dispatcher will route to the right one.

## Steps (do not deviate)

### Step 1 — Detect framework

```bash
npx @cometchat/skills-cli@latest detect --json
```

Parse the JSON response. The `framework` field tells you which skill to invoke.

### Step 2 — Route based on detected framework

| `framework` | Route to skill |
|---|---|
| `reactjs` | `cometchat-react-reactjs` |
| `nextjs` | `cometchat-react-nextjs` |
| `react-router` | `cometchat-react-react-router` |
| `astro` | `cometchat-react-astro` |
| `null` | **Stop**, surface the compatibility warnings |

If `compatibility.supported` is `false`, do not attempt the integration. Tell
the user the project type isn't supported and surface the warnings verbatim.

**Special case — JavaScript-only reactjs project:** if `framework` is
`"reactjs"` AND `uses_jsx` is `true`, the project uses `.jsx` entry
files (created with `npm create vite@latest -- --template react`).
The CometChat React UI Kit v6 templates are TypeScript-only — apply
WILL refuse and the user experience is much better if you stop here
instead of routing to the framework skill. Surface this verbatim:

> **This project uses JavaScript (`.jsx`).** The CometChat React UI Kit
> v6 templates are TypeScript-only, so I can't integrate as-is. Two
> options:
>
> 1. **Recreate as TypeScript** (recommended for new projects):
>    ```
>    npm create vite@latest my-react-app -- --template react-ts
>    ```
> 2. **Convert this project to TypeScript** first:
>    - Add a `tsconfig.json`
>    - Rename `src/main.jsx` → `src/main.tsx`
>    - Rename `src/App.jsx` → `src/App.tsx`
>    - Update `index.html` to reference `/src/main.tsx`
>    - Then re-run `/cometchat`.
>
> JSX template variants ship in v2.1. Which option do you want?

Wait for the user. Do NOT route to `cometchat-react-reactjs` until
they've recreated or converted.

### Step 3 — Pass arguments through

If the user invoked `/cometchat <N>` (where N is 1, 2, or 3), pass that
experience to the framework skill. If they invoked plain `/cometchat`,
the framework skill will **ask the user which experience they want**
(presenting all three options) before proceeding — do NOT pre-select
or default to one. The user's choice is theirs to make.

If the user invoked `/cometchat <category>` (e.g. `theming`, `features`,
`troubleshoot`), route to:

| Category | Skill |
|---|---|
| `theming` / `theme` | `cometchat-theming` (alpha — see status note below) |
| `features` / `<feature-name>` | `cometchat-features` (alpha) |
| `troubleshoot` / `fix` | `cometchat-troubleshooting` (alpha) |

### Step 4 — Recommend (but do NOT block on) the docs MCP

The CometChat docs MCP at `cometchat-docs` is useful for Phase B
customization (component props, SDK events, request builders, CSS
selectors). However, **Phase A (init → apply → verify → install) does
NOT need the MCP** — the CLI handles everything deterministically.

**Do NOT block the integration on the MCP.** If the MCP isn't
installed, proceed with the integration and mention the MCP as a
recommendation for later customization:

> *"Tip: for Phase B customization (custom components, event
> subscriptions, request builders), install the CometChat docs MCP:
> `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp`
> — but it's not needed for the initial integration."*

If the MCP IS available, great — it becomes source #4 in the
framework skill's discovery order (after the lookup table, d.ts grep,
and sample app fetch). MCP install instructions for other IDEs:

**Claude Code:**
```bash
claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp
```

**Cursor** (`.cursor/mcp.json`):
```json
{ "mcpServers": { "cometchat-docs": { "url": "https://www.cometchat.com/docs/mcp" } } }
```

**Windsurf:**
```json
{ "mcpServers": { "cometchat-docs": { "type": "sse", "serverUrl": "https://www.cometchat.com/docs/mcp" } } }
```

**Other clients:** see https://www.cometchat.com/docs/mcp-server

The MCP is hosted by CometChat — no authentication required. After the
user installs it, restart the agent session and re-run `/cometchat`.

## Hard rules

- Always run `detect` first. Do not assume the framework.
- Always use `npx @cometchat/skills-cli@latest`.
- Never ask the user "which framework?" — the CLI tells you.
- Never invoke a framework skill if `compatibility.supported` is `false`.
- The docs MCP is **recommended** for Phase B customization but
  **NOT required** for Phase A integration. Do NOT block on it.

## Note on category skills (theming / features / troubleshooting / customization)

The 4 v2 category skills (`cometchat-theming`, `cometchat-features`,
`cometchat-troubleshooting`, `cometchat-customization`) ship in v2.0.0
and route from this dispatcher based on the user's request. Each is a
thin wrapper around the relevant `cometchat` CLI command + the docs MCP
for any reference questions beyond the CLI's surface.
