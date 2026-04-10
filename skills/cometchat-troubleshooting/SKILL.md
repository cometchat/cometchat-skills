---
name: cometchat-troubleshooting
description: Diagnose and fix problems with a CometChat integration. Runs verify checks, detects drift, queries the docs MCP for symptom-to-cause lookups, and proposes targeted fixes. Works on any state — broken, missing, or drifted integrations.
license: "MIT"
compatibility: "Node.js >=18; @cometchat/chat-uikit-react ^6"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, grepSearch"
metadata:
  author: "CometChat"
  version: "2.0.0"
  tags: "cometchat troubleshooting fix diagnose verify drift errors doctor"
---

> **STATUS: v2.0.** The CLI provides `info`, `verify`, `doctor`, and
> drift detection today, all in `@cometchat/skills-cli@2.0.0` on npm.
> `cometchat doctor` is the canonical entry point — it combines
> `detect + info + verify + env-var checks` and returns a structured
> issues list with severity-tagged fixes per issue. This skill is a
> thin wrapper: run `doctor`, surface its output, and use the docs
> MCP for symptom-to-cause matching when `doctor`'s known-issues
> table doesn't have a hit.

## Use this skill when

The user has a problem with their CometChat integration. Trigger phrases:

- `/cometchat troubleshoot`
- `/cometchat fix`
- `/cometchat fix <symptom>`
- "chat isn't loading"
- "i'm getting a cometchat error"
- "the chat is broken"
- "blank screen on /chat"
- "401 Unauthorized from cometchat"
- "css-variables not loading"
- "the chat doesn't show messages"

## Docs MCP contract

The CometChat docs MCP at `cometchat-docs` is a **hard requirement** for
this skill. `cometchat doctor` handles the local diagnostic checks
(integration state, drift, env vars, AST verify rules), but for any
symptom that doesn't match a doctor known-issue code, the MCP is the
canonical source for symptom → cause → fix.

**Hard rules:**

1. **Always run `cometchat doctor` first** — its known-issues table
   covers the common failure modes (env-placeholder, env-missing, drift, init-before-login,
   no-auth-key-in-source).
2. **For symptoms NOT in doctor's table**, query the docs MCP with the
   exact error message or symptom keywords. Never guess at the cause.
3. **If the docs MCP is not installed**, STOP. Tell the user: "Doctor
   didn't recognize this symptom and I need the CometChat docs MCP to
   diagnose further. Install it with `claude mcp add --transport http
   cometchat-docs https://www.cometchat.com/docs/mcp` and re-run."
4. **Never blame the user's code** if doctor + MCP both pass — the issue
   is probably infrastructure (network, dashboard config, auth provider).
5. **Canonical reference URL:**
   https://www.cometchat.com/docs/ui-kit/react/troubleshooting

## Steps

### Step 1 — Triage: read the project state

```bash
npx @cometchat/skills-cli@latest info --json
```

Three possible outcomes:

| `info` says | Diagnosis | Next step |
|---|---|---|
| `integrated: false` | No integration exists | Tell user to run `/cometchat` first. Stop. |
| `integrated: true, drift.has_drift: true` | User edited owned files | Step 2 + flag the drift |
| `integrated: true, drift.has_drift: false` | Clean integration but something is broken | Step 2 |

If drift is detected, surface the modified file list verbatim. Offer to run
`cometchat apply --force` to restore the original templates.

### Step 2 — Run verify

```bash
npx @cometchat/skills-cli@latest verify --json
```

This runs the AST checks. The output looks like:

```json
{
  "status": "fail",
  "checks": {
    "css_variables_imported_once": { "status": "fail", "reason": "..." },
    "init_before_login": { "status": "pass" },
    ...
  }
}
```

For each failed check, look up the fix in the table below or via the docs MCP.

### Step 3 — Match symptom to known issues

Common doctor issue codes + verify failures and their fixes:

| Issue code / failed check | Likely cause | Fix |
|---|---|---|
| `env-placeholder` (warning) | One or more CometChat env vars still contain `YOUR_*_HERE` sentinels — the user ran `cometchat init` but never filled in real credentials | Open the env file the doctor report names (`.env` for Vite/RR/Astro, `.env.local` for Next.js) and replace each `YOUR_*_HERE` value with the real one from https://app.cometchat.com → Your App → API & Auth Keys. This is by far the most common post-init failure mode. |
| `env-missing` (warning) | A required CometChat env var key isn't in the env file at all | Run `cometchat apply --force-overwrite` to re-emit the placeholders, then fill them in. |
| `drift-modified` / `drift-missing` | Owned files have been edited or deleted since apply | If the edits are intentional customizations, ignore. If accidental, run `cometchat apply --force` to restore. For deletes, `cometchat apply --force` recreates them. |
| `css_variables_imported_once` (count=0) | The css-variables.css import was removed | Re-add `@import url("@cometchat/chat-uikit-react/css-variables.css");` to the top of `src/index.css` (or the per-framework target). For Astro, it goes inside the .tsx file, not the global CSS. |
| `css_variables_imported_once` (count>1) | Imported in multiple places | Remove the duplicate. Keep only the one in the canonical location. |
| `init_before_login` | Code calls `CometChatUIKit.login` before `CometChatUIKit.init` resolves | Wrap `login()` inside `init()?.then(() => login(...))` |
| `render_gated_on_login_resolve` | `createRoot(...).render` is called at top level, not inside a `mount()` function | Wrap render in `mount()` and call it only after `login()` resolves. For React island frameworks, gate render with `if (!user) return null` |
| `no_auth_key_in_source` | Auth Key hardcoded in a source file | Move it to `.env` and reference via `import.meta.env.VITE_COMETCHAT_AUTH_KEY` (or `process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY` for Next.js) |
| `error_ui_visible_on_failure` | No `color: red` error UI in any owned file | Add an error state component that renders on init/login failure |

For symptoms not in this table, query the docs MCP.

### Step 4 — Symptom-driven lookup via the docs MCP

If the user has reported a specific symptom that isn't covered by verify
checks, query the CometChat docs MCP:

```
Use the cometchat-docs MCP to search for "<symptom keywords>"
```

Common symptom searches:

| Symptom | MCP search query |
|---|---|
| Blank screen at /chat | "blank screen ssr nextjs" or "blank screen react-router" |
| 401 Unauthorized | "401 unauthorized authentication" |
| Chat doesn't load | "chat not loading init login" |
| Build error | "<exact error message from build output>" |
| CORS error | "cors origin allowed" |
| Mixed user/group error | "user group same component" |
| Theme not applying | "theming css variables override" |

The docs MCP returns the canonical fix. Apply it as a targeted patch.

### Step 5 — Propose the fix

Show the user:
1. What's broken (verify output, drift report, or symptom)
2. The likely cause (from the table or docs MCP)
3. The exact fix (file path + content change)
4. Whether to:
   - **Restore from the registry** — `cometchat apply --force` rewrites
     all owned files back to their template state. Safe if the user
     hasn't customized them; destructive if they have.
   - **Re-run the integration cleanly** — `cometchat uninstall --force`
     followed by `cometchat init`. Wipes state.json and starts over.
   - **Patch by hand** — only if the issue is in user code outside
     `state.files_owned`. Show the user the exact change to make.

For dashboard/network/auth issues, the fix is on the user's side
(CometChat dashboard, .env values, network connectivity) — `cometchat
doctor` surfaces the issue and the fix verbatim. Don't try to "fix"
infrastructure issues from the CLI.

### Step 6 — Verify the fix

After any fix is applied, re-run:

```bash
npx @cometchat/skills-cli@latest verify --json
```

Confirm `status: "pass"`. If anything is still failing, repeat from Step 2.

## Hard rules

- Never apply a fix without showing the user what will change first.
- Never invent error causes — query the docs MCP if you don't know.
- Never blame the user's code if the verify checks are passing — the issue
  is probably in the docs MCP territory (network, auth, dashboard config).
- For drift detected, default to **showing** the drift, not auto-restoring.
- Always use `npx @cometchat/skills-cli@latest`.
