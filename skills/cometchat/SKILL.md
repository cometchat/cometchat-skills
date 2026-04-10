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

### Step 3 — Ask which experience (if not already specified)

If the user passed `/cometchat <N>` (1, 2, or 3), use it directly.
Otherwise, **ask the user** using the `AskUserQuestion` tool so they get an arrow-key selector:

Use `AskUserQuestion` with these options:
- **question:** "Which CometChat experience do you want?"
- **header:** "Experience"
- **multiSelect:** false
- **options:**
  1. label: "Multi-conversation", description: "Users switch between threads. Two-panel: conversation list + active thread. Best for: messaging apps, team chat, inboxes."
  2. label: "Single thread", description: "One chat window for two known users or a group. Header + message list + composer, no conversation list. Best for: marketplace chat, embedded consult."
  3. label: "Full messenger", description: "Bottom tab bar: Chats / Calls / Users / Groups. Users browse, start conversations, make calls. Best for: social apps, community platforms, dating."

Map the user's selection to the experience number: Multi-conversation → 1, Single thread → 2, Full messenger → 3.

Wait for the user's answer. Do NOT default to 1. If the user
selects "Other" and describes what they want in natural language, map it:
- "messaging", "inbox", "team chat", "slack-like", "conversations" → 1
- "support", "widget", "one-on-one", "two users", "embedded" → 2
- "social", "full app", "calls", "groups", "dating", "discord" → 3

### Step 4 — Apply the integration

Run these commands in sequence:

```bash
npx @cometchat/skills-cli@latest view --experience N --framework <detected> --json
npx @cometchat/skills-cli@latest apply --experience N --framework <detected>
npx @cometchat/skills-cli@latest verify --json
npx @cometchat/skills-cli@latest install
```

After apply:
- `applied` → continue
- `already-applied` → tell user, stop
- `conflict` → surface verbatim, suggest `--force` only on explicit user confirm
- `error` → surface verbatim, do not retry

### Step 5 — Show env vars + next steps

The CLI creates a `.env` file with `YOUR_*_HERE` placeholders. Tell the
user to open `.env` and replace the placeholders with real values from
https://app.cometchat.com → Your App → API & Auth Keys. Surface the
`next_steps` from the apply response verbatim.

### Step 6 — Phase B iteration menu

> **Your CometChat integration is running. What do you want to do next?**
>
> - **a.** Customize the look and feel — theme presets or brand colors.
>   → `npx @cometchat/skills-cli@latest apply-theme --preset <name>`
> - **b.** Add a feature — calls, polls, reactions, AI, ~35 more.
>   → `npx @cometchat/skills-cli@latest features list`
> - **c.** Customize a component — search, details, threads, custom
>   bubbles, filters.
> - **d.** Add a floating chat widget.
>   → `npx @cometchat/skills-cli@latest add-widget`
> - **e.** Production auth (server-side token endpoint).
>   → `npx @cometchat/skills-cli@latest production-auth`
> - **f.** Server-side user management.
>   → `npx @cometchat/skills-cli@latest add-user-mgmt`
> - **g.** Diagnose a problem.
>   → `npx @cometchat/skills-cli@latest doctor`
> - **h.** Where am I in the journey?
>   → `npx @cometchat/skills-cli@latest status`
> - **i.** I'm done for now.

The CometChat docs MCP is useful for Phase B (option c — component
customization). Mention it as a tip after the integration completes:

> *"Tip: for Phase B customization, install the CometChat docs MCP:
> `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp`"*

Do NOT block Phase A on the MCP — the CLI handles it without the MCP.

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
