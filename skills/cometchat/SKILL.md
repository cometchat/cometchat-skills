---
name: cometchat
description: Entry-point for CometChat integration. Guides a multi-step interactive conversation to understand the project, gather requirements, and write production-quality integration code.
license: "MIT"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat dispatcher entry react chat"
---

## Use this skill when

The user wants to add CometChat to any kind of project. Trigger phrases:

- `/cometchat`
- "add cometchat", "integrate cometchat", "add chat to my app"
- "add messaging", "add chat ui"

This is the **entry point**. Do not invoke framework-specific skills
directly — this dispatcher will route to the right ones.

## How v3 works

v3 skills are **interactive and conversational**. You don't just detect
the framework and dump code. You have a conversation with the developer
to understand their project, their use case, and exactly where chat
should go — THEN you write code that fits.

The pattern skills teach you:
- `cometchat-core` — initialization, login, CSS, env vars, provider pattern
- `cometchat-components` — every component name, props, composition patterns
- `cometchat-placement` — WHERE to put chat (route, modal, drawer, embed, widget)
- `cometchat-{framework}-patterns` — framework-specific integration patterns

**Key principle: ask, don't assume.** Every piece of information you need
from the user should be asked explicitly. Don't guess the route path,
don't guess where the trigger button goes, don't guess the auth system.

## Steps

### Step 1 — Detect framework + map the project

First, check if `.cometchat/config.json` exists:
```bash
npx @cometchat/skills-cli config show --json
```

If config exists with previous answers, tell the user:
> "I see you've set up CometChat before. Using your saved config:
> Framework: {framework}, App: {appId}, Intent: {intent}.
> Want to continue with these, or start fresh?"

If no config, run detection:
```bash
npx @cometchat/skills-cli detect --json
```

**Then read the project yourself — this is critical:**
- `package.json` — name, dependencies, scripts
- The source directory structure — list all directories under `src/` or `app/`
- Find the router: look for `createBrowserRouter`, `app/` directory, `pages/`,
  `react-router.config.ts`, `astro.config.*`
- Find the layout: `App.tsx`, `layout.tsx`, `root.tsx`, `Layout.astro`
- Find the nav: look for components with "nav", "header", "sidebar" in name
- Find existing pages/routes: list them so you can reference them later

Store this mental map — you'll use it throughout the conversation.

If `compatibility.supported` is `false`, stop and surface the warnings.

### Step 2 — Set up credentials (onboarding)

Credentials are handled in two parts: (A) browser-based auth and (B)
CLI-driven app selection/creation. The CLI opens the dashboard in the
user's browser for login/signup — no passwords in the terminal, no
email-verification-code copy-paste. Google and GitHub accounts work
the same as email+password because the dashboard handles those flows.

If config has `appId` set, verify credentials are in `.env` and skip to Step 3.

Otherwise check:
```bash
npx @cometchat/skills-cli auth status --json
```

If `status` is `"logged-in"`, skip to **Step 2c** (app selection).

If `status` is `"logged-out"`, ask:

Use `AskUserQuestion`:
- **question:** "Let's set up CometChat. Do you have an account?"
- **header:** "Account"
- **multiSelect:** false
- **options:**
  1. label: "Create a new account", description: "Opens CometChat signup in your browser. Email, Google, or GitHub all work."
  2. label: "Sign in to existing account", description: "Opens CometChat login in your browser."
  3. label: "I'll paste credentials myself", description: "Skip auth — I already have my App ID, Region, and Auth Key."

Option 1 → **Step 2b**. Option 2 → **Step 2a**. Option 3 → **Step 2d**.

#### Step 2a — Sign in (existing account, browser flow)

```bash
npx @cometchat/skills-cli auth login
```

This command:
1. Generates a short-lived session via the CLI auth API.
2. Opens `https://app.cometchat.com/login?sessionId=<hex>` in the user's default browser.
3. Polls the auth API every 5 seconds for up to 15 minutes.
4. When the user finishes signing in (email+password, Google, or GitHub — whatever their account uses), the dashboard marks the session authenticated. The next poll receives the bearer token and stores it in the OS keychain.
5. Prints `✓ Logged in as <email> (backend: keychain-macos).`

Let the CLI block — do NOT background it, do NOT race it with other
prompts. The user completes sign-in in the browser tab; the terminal
waits.

Terminal error handling (surface verbatim, stop, do not retry silently):
- `ACCESS_DENIED` — user clicked Deny in the dashboard.
- `EXPIRED` — 15-minute window elapsed.
- `TIMEOUT` — max polls exhausted before user authorized.
- `ABORTED` — user Ctrl-C'd the CLI.
- `NETWORK` — couldn't reach the auth host.
- `ALREADY_AUTHENTICATED` — this session was already consumed. Re-run
  `auth login` to mint a fresh session.

After success, verify:
```bash
npx @cometchat/skills-cli auth status --json
```

If `status` is `"logged-in"`, proceed to **Step 2c**.

#### Step 2b — Sign up (new account, browser flow)

```bash
npx @cometchat/skills-cli auth signup
```

Same polling flow as Step 2a, but the CLI opens
`https://app.cometchat.com/signup?sessionId=<hex>`. The browser
handles everything — email, name, password, verification email, role,
industry. The CLI never sees any of those values. When the user
finishes signup in the browser, the next poll stores the bearer token
in the OS keychain and the CLI prints `✓ Logged in as <email>`.

No role / name / verification-code questions in the chat. The dashboard
owns that flow now; skipping it keeps the user's password and verification
code out of the transcript.

Error codes match Step 2a (ACCESS_DENIED, EXPIRED, TIMEOUT, ABORTED,
NETWORK, ALREADY_AUTHENTICATED). Surface verbatim and stop.

After success, verify:
```bash
npx @cometchat/skills-cli auth status --json
```

If `status` is `"logged-in"`, proceed to **Step 2c**.

#### Step 2c — Pick or create an app

**Run this immediately — do NOT ask the user to go to any dashboard:**
```bash
npx @cometchat/skills-cli provision list --json
```

**If the user has existing apps**, show them and ask which to use:
> "I found these CometChat apps on your account:
> 1. my-marketplace-chat (us) — Developer plan
> 2. test-app (eu) — Developer plan
>
> Which one should I use, or should I create a new one?"

**For an existing app**, fetch credentials and wire everything in one call
(pass `--framework` from Step 1 detection — one of `reactjs`, `nextjs`,
`react-router`, `astro`):
```bash
npx @cometchat/skills-cli provision setup \
  --app-id "<selected-appId>" --framework "<framework>" --json
```

This creates/updates `.env` with the correct prefix AND writes
`.cometchat/config.json` in one step. Output is compact:
`{ appId, region, framework, envFile, configPath }` — no authKey echoed
back, no multi-command chain. Skip ahead to "Tell the user" below.

**If no apps exist** (or user wants new), collect:
1. App name — suggest `<project-name>-chat` from package.json `name`
2. Region — use `AskUserQuestion`:
   - **question:** "Which region for your CometChat app?"
   - **header:** "Region"
   - **options:**
     1. label: "US", description: "United States (recommended)"
     2. label: "EU", description: "Europe"
     3. label: "India", description: "India"

   **Region key mapping** (CLI expects lowercase):
   | Label | `--region` value |
   |---|---|
   | US | `us` |
   | EU | `eu` |
   | India | `in` |
3. Industry — use `AskUserQuestion`. This matches the industry picker
   on https://app.cometchat.com's Create Application form, so ask it
   here and **reuse the answer in Step 3a — do NOT ask the user again
   what kind of app they're building**.

   - **question:** "What's your app's industry?"
   - **header:** "Industry"
   - **options:**
     1. label: "SaaS / Business", description: ""
     2. label: "Marketplace", description: ""
     3. label: "Social / Community", description: ""
     4. label: "Healthcare", description: ""
     5. label: "Dating", description: ""
     6. label: "Education", description: ""
     7. label: "Other", description: ""

**Industry key mapping** (pass as `--industry`):

| Label | `--industry` value |
|---|---|
| SaaS / Business | `saas_businesses` |
| Marketplace | `online_marketplaces` |
| Social / Community | `community_and_social` |
| Healthcare | `healthcare` |
| Dating | `dating` |
| Education | `online_education` |
| Events / Streaming | `events_and_streaming` |
| Sports / Gaming | `sports_and_gaming` |
| Team Communication | `team_comms_and_workflows` |
| On-demand Services | `on_demand_services` |
| Other | `other` |

**Remember the industry value** — Step 3a maps it directly to intent
(Marketplace → marketplace intent, Healthcare → SaaS/dashboard intent,
etc.). Do NOT re-ask the user what kind of app they're building.

**Confirm before creating:**
> "I'll create a CometChat app:
> - Name: <name>
> - Region: <region>
> - Industry: <industry label>
>
> Go ahead?"

Then create the app AND wire `.env` AND save config in one step. Pass
`--framework` from Step 1 detection (one of `reactjs`, `nextjs`,
`react-router`, `astro`):
```bash
npx @cometchat/skills-cli provision setup \
  --name "<name>" --region "<region>" --industry "<industry_key>" \
  --framework "<framework>" --json
```

Output is compact: `{ appId, region, framework, envFile, configPath }`.
The authKey is written to the env file but is NOT echoed to stdout, so
credentials don't appear multiple times in the transcript. This replaces
the old `provision create` → `provision use` → `config init` chain.

Tell the user: "Your CometChat account and app are ready. Credentials
saved to `.env`. Let's set up the integration."

#### Step 2d — Paste keys manually

Tell the user which env vars to set based on the detected framework:

| Framework | Env file | Variables |
|---|---|---|
| reactjs (Vite) | `.env` | `VITE_COMETCHAT_APP_ID`, `VITE_COMETCHAT_REGION`, `VITE_COMETCHAT_AUTH_KEY` |
| nextjs | `.env.local` | `NEXT_PUBLIC_COMETCHAT_APP_ID`, `NEXT_PUBLIC_COMETCHAT_REGION`, `NEXT_PUBLIC_COMETCHAT_AUTH_KEY` |
| react-router | `.env` | `VITE_COMETCHAT_APP_ID`, `VITE_COMETCHAT_REGION`, `VITE_COMETCHAT_AUTH_KEY` |
| astro | `.env` | `PUBLIC_COMETCHAT_APP_ID`, `PUBLIC_COMETCHAT_REGION`, `PUBLIC_COMETCHAT_AUTH_KEY` |

> "Grab your credentials from https://app.cometchat.com → Your App →
> API & Auth Keys. Create the env file above and tell me when done."

After they confirm, verify:
```bash
npx @cometchat/skills-cli config init --json
```

### Step 3 — Interactive requirements gathering

This is the core of v3. A multi-step conversation that gathers everything
you need before writing a single line of code.

#### 3a. Map industry → intent (NO new question)

**Do NOT ask "what kind of app are you building?" here.** You already
asked the user for industry in Step 2c — reuse that answer. Map it to
an intent using this table:

| Step 2c industry | Intent for placement reasoning |
|---|---|
| `online_marketplaces` | marketplace |
| `saas_businesses` | saas |
| `community_and_social` | social |
| `healthcare` | saas (support-style chat inside a product) |
| `dating` | social |
| `online_education` | saas |
| `events_and_streaming` | social |
| `sports_and_gaming` | social |
| `team_comms_and_workflows` | messaging |
| `on_demand_services` | marketplace |
| `other` | **ask follow-up** — use `AskUserQuestion` with the 6 intents below |

Only when industry is `other` (or the user explicitly wants to override
the mapping), use `AskUserQuestion`:
- **question:** "What kind of app is this?"
- **header:** "App type"
- **multiSelect:** false
- **options:**
  1. label: "Messaging app", description: "Chat is the main feature."
  2. label: "Marketplace or platform", description: "Buyers and sellers communicate."
  3. label: "SaaS or dashboard", description: "Team or support chat inside a product."
  4. label: "Social or community", description: "Profiles + messaging."
  5. label: "Support or helpdesk", description: "Customer-to-agent."
  6. label: "Just exploring", description: "Quick demo — fastest path to chat."

If the user picks "Just exploring", skip the rest of Step 3 and use
`cometchat apply` demo mode in Step 5.

Store the resolved intent in memory (you'll use it in 3b-3f), and save
it to config later:
```bash
npx @cometchat/skills-cli config save --intent "<intent>" --json
```

#### 3b. Show what you recommend and why

Based on the intent, present the recommendation:

| Intent | What you'll set up |
|---|---|
| **Messaging app** | A dedicated messages page at a route you choose. Two-pane: conversation list + active chat. |
| **Marketplace** | A "Chat with seller" drawer on your product page + an inbox page at /messages. |
| **SaaS / dashboard** | A chat modal triggered from your navbar + a full messages page. |
| **Social / community** | A full messenger page with tabs: Chats, Calls, Users, Groups. |
| **Support** | A floating widget bubble in the bottom-right corner. |

When explaining, reference the ASCII art from `cometchat-placement`
("Visual reference — experience layouts") so the user can visualize it.

Ask: "Does this sound right, or do you want a different approach?"
Let them override.

#### 3c. Ask where things should go

**Show the user their actual project structure** — list the pages/routes
you found in Step 1. Then ask placement-specific questions:

**For Route placement (messaging, social):**
> "I found these pages in your project:
>   - /  (home)
>   - /about
>   - /products
>   - /profile
>
> Where should the messages page live?"

Default suggestion: `/messages`. Let user type a custom path.

**For Drawer placement (marketplace):**
> "Which page should have the 'Chat' button that opens the drawer?
> I found these pages:
>   - app/products/[id]/page.tsx
>   - app/listings/page.tsx
>   - app/profile/[id]/page.tsx
>
> Which one?"

After they pick, read that page file. Look for existing buttons,
actions, or interactive elements. Ask:
> "I see a 'Contact Seller' button in ProductDetail.tsx at line 45.
> Should I wire the chat drawer to that button, or add a new one?"

**For Modal placement (SaaS):**
> "Where should the 'Open chat' button go? I found these components
> that look like navigation:
>   - src/components/Navbar.tsx
>   - src/components/Sidebar.tsx
>
> Which one should have the chat trigger?"

**For Widget placement (support):**
> "Should the widget appear on all pages, or only specific ones?"

**For combinations (marketplace = drawer + route):**
Ask both questions in sequence. The drawer and route are separate
components wired into separate places.

#### 3d. Detect and ask about authentication

Read the project's `package.json` and source files. Look for auth:

- `next-auth` / `@auth/core` → NextAuth
- `@clerk/nextjs` / `@clerk/clerk-react` → Clerk
- `@supabase/supabase-js` + auth usage → Supabase Auth
- `firebase` / `firebase/auth` → Firebase Auth
- `passport` → Passport.js
- `jsonwebtoken` / `jose` → Custom JWT
- None detected → no auth

Report what you found and ask:

If auth detected:
> "I see you're using [NextAuth / Clerk / etc.]. Here's how CometChat
> will work with it:
>
> - **Development (now):** I'll use CometChat's Auth Key for quick
>   testing with pre-seeded users (cometchat-uid-1, uid-2, etc.)
> - **Production (later):** Your server will call CometChat's REST API
>   to generate per-user auth tokens. I can set this up now or later.
>
> Start with dev mode for now? You can upgrade to production auth
> anytime by choosing 'Set up production auth' from the menu."

If no auth detected:
> "I don't see an authentication system in your project yet. For now,
> I'll set up CometChat with a hardcoded test user (cometchat-uid-1).
>
> When you add auth later, run `/cometchat` again and choose
> 'Set up production auth' to connect them."

#### 3e. Ask about user mapping (if auth detected)

If the user has auth AND wants to set up production mode now:

> "How should your app's users map to CometChat users?
>
> 1. Use your existing user ID as the CometChat UID (simplest)
> 2. Generate a separate CometChat UID and store it in your database
> 3. Let me just set up dev mode for now
>
> Option 1 works if your user IDs are alphanumeric strings (no spaces,
> no special characters). What does a typical user ID look like in
> your system?"

If they share an example, validate it's CometChat-compatible
(alphanumeric, underscores, hyphens — no spaces or special chars).

#### 3f. Confirm the plan

**This is critical. Show EXACTLY what you'll do before doing it.**

> "Here's what I'll create:
>
> **New files:**
> - `app/providers/CometChatProvider.tsx` — initialization + login
> - `app/messages/page.tsx` — inbox with conversation list + message view
> - `app/components/ChatDrawer.tsx` — slide-out drawer for product page chat
> - `.env.local` — CometChat credentials (already filled)
>
> **Files I'll modify:**
> - `app/products/[id]/page.tsx` — add ChatDrawer import + trigger button
> - `app/layout.tsx` — wrap children with CometChatProvider
> - `app/components/Navbar.tsx` — add 'Messages' link
>
> **Files I will NOT touch:**
> - `app/page.tsx` (your home page)
> - Any other existing pages
>
> **Dependencies to install:**
> - @cometchat/chat-sdk-javascript
> - @cometchat/chat-uikit-react
>
> **Auth mode:** Development (Auth Key). Upgrade to production
> with `/cometchat` → 'Set up production auth' when ready.
>
> Proceed? [y/n]"

Wait for explicit confirmation. If the user says no or wants changes,
go back to the relevant question and re-ask.

### Step 4 — Reference pattern skills

**All 13 skills are already loaded in your context** as `.claude/skills/`
files. Do NOT use the `Skill()` tool — that's for a different system.
Instead, simply read and follow the instructions in these skills:

1. `cometchat-core` — initialization, provider, CSS, anti-patterns
2. `cometchat-components` — component catalog, composition patterns
3. Framework skill for the detected framework:
   - `reactjs` → `cometchat-react-patterns`
   - `nextjs` → `cometchat-nextjs-patterns`
   - `react-router` → `cometchat-react-router-patterns`
   - `astro` → `cometchat-astro-patterns`
4. `cometchat-placement` — placement pattern for the chosen approach

These are reference documents in your context, not tool calls.

### Step 5 — Write the integration

Execute the confirmed plan. For each file:

1. **CometChatProvider** — follow the framework skill's provider pattern.
   Use the correct env var prefix. Module-level `initialized` guard.
   Mount at the level agreed in Step 3f.

2. **Chat component(s)** — follow the placement skill's pattern.
   Use the component compositions from the components skill.
   If drawer/modal: connect to the specific user/group the user specified.

3. **Wire into existing project** — READ each file before modifying:
   - Router: add the route entry. Show the user the diff.
   - Nav: add the link. Show the user the diff.
   - Trigger page: add the drawer/modal import + trigger button. Show diff.

4. **CSS import** — add once at the root level per framework conventions.

5. **Environment variables** — write `.env` with the correct prefix.
   If auth key is already there from the wizard, don't duplicate.

6. **Install dependencies:**
   ```bash
   npm install @cometchat/chat-sdk-javascript @cometchat/chat-uikit-react
   ```

7. **Update config.json** — save all the choices in one call:
   ```bash
   npx @cometchat/skills-cli config save \
     --intent "<intent>" \
     --experience <n> \
     --placement "<type>" \
     --placement-path "<path>" \
     --auth-mode "<mode>" --json
   ```
   Pass only the fields you have — `config save` accepts any subset.
   This replaces the old 5-command `config set k v` chain. Omit
   `--experience` in the AI-written path (it only applies to CLI-
   generated experiences 1/2/3).

8. **Record state so Phase B commands can find the integration.** Every
   Phase B command (`uninstall`, `doctor`, `verify`, `apply-theme`,
   `customize`, `apply-feature`, `status`, `info`, `add-widget`,
   `add-user-mgmt`, `production-auth`) expects `.cometchat/state.json`.
   After writing files, pass the exhaustive list of files you created
   and patched:

   ```bash
   npx @cometchat/skills-cli state record \
     --framework "<framework>" \
     --placement "<type>" \
     --placement-path "<path>" \
     --auth-mode "<mode>" \
     --files-owned "src/providers/CometChatProvider.tsx,src/components/ChatDrawer.tsx,src/pages/MessagesPage.tsx" \
     --files-patched "src/main.tsx:v3/main.tsx,src/App.tsx:v3/App.tsx,src/components/Layout.tsx:v3/Layout.tsx" \
     --json
   ```

   `--files-owned` = every file you WROTE (comma-separated paths).
   `--files-patched` = every file you MODIFIED (comma-separated
   `path:patch_id` pairs; `patch_id` can be any stable string you use
   to identify the patch — e.g. `"v3/<filename>"`).
   `state record` computes SHA-256 checksums for each owned file from
   the content currently on disk. Without this step, users who later
   run `cometchat uninstall` or `cometchat doctor` get "no-integration"
   errors even though the integration is working.

**Exception — "Just exploring" / demo mode:**
```bash
npx @cometchat/skills-cli apply --experience 1 --framework <detected>
npx @cometchat/skills-cli verify --json
npx @cometchat/skills-cli install
```

### Step 6 — Verify + show result

Run a TypeScript check to verify the code compiles:
```bash
npx tsc --noEmit
```

**Do NOT run `npx @cometchat/skills-cli verify`** — it checks for
CLI-generated `.cometchat/state.json` which doesn't exist in v3
(AI writes code directly, not via `cometchat apply`). Use `tsc` instead.

Surface any issues. Then:

> "CometChat is integrated! Here's what was set up:
>
> - Messages page at /messages ✓
> - Chat drawer on product page ✓
> - Provider + CSS wired ✓
> - Dependencies installed ✓
>
> Run `npm run dev` and try it out. Pre-seeded test users
> (cometchat-uid-1 through uid-5) are ready to chat.
>
> What would you like to do next?"

### Step 7 — Iteration menu

Use `AskUserQuestion`:
- **question:** "What would you like to do next?"
- **header:** "Next step"
- **multiSelect:** false
- **options:**
  1. label: "Customize look and feel (themes)", description: "Pick a preset (slack, whatsapp, imessage, discord, notion) or set brand colors."
  2. label: "Add a feature", description: "Browse ~35 features — calls, reactions, polls, AI, and more."
  3. label: "Customize a component", description: "Custom bubbles, headers, composer actions, details views — I'll read the docs and write it."
  4. label: "Add a floating chat widget", description: "An overlay button + drawer on top of your existing app."
  5. label: "Set up production auth", description: "Replace the dev Auth Key with a server-side token endpoint. Read `cometchat-production` skill."
  6. label: "Set up user management", description: "Server endpoints for creating, updating, deleting CometChat users."
  7. label: "Run diagnostics", description: "Check for drift, missing env vars, broken imports."
  8. label: "I'm done", description: "Exit."

For **component customization**: read `cometchat-components` + docs MCP,
then write the customization code directly. This is pure AI work — no
CLI command. Ask the user what they want to customize, read the relevant
component's props from the catalog, and propose changes.

For **production auth**: read the `cometchat-production` skill (already
in your context). It's interactive — ask the user about their auth
system and generate the server-side token endpoint for their framework.

After each action, re-render the menu.

## Hard rules

- **Ask, don't assume.** Every integration decision should be confirmed.
- Always run `detect` first. Do not assume the framework.
- Always use `npx @cometchat/skills-cli` for CLI commands.
- NEVER replace existing project files unless the user chose demo mode.
- ALWAYS read existing files before modifying them.
- ALWAYS show the plan (Step 3f) and get confirmation before writing.
- For component names and props, use the `cometchat-components` skill
  or docs MCP — never invent from training data.
- After writing code, update `.cometchat/config.json` with the choices made.
- **NEVER use the `Skill()` tool** to load CometChat skills. All 13
  skills are already in your context as `.claude/skills/` files. Just
  read and follow them directly.

## Error handling

If the CLI's `--json` output includes `human_message` / `suggestion` fields,
show those to the user. Then show the raw `error` in parentheses for
debuggability. If `retryable: false`, do NOT offer a retry.

## Optional: docs MCP

For deeper component customization:
```
claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp
```

Not required for integration or Phase B CLI flows.

## Skill routing reference

| Skill | When to load |
|---|---|
| `cometchat-core` | Always — before any integration code |
| `cometchat-components` | Always — before writing component code |
| `cometchat-placement` | When integrating — for placement patterns |
| `cometchat-react-patterns` | framework = reactjs |
| `cometchat-nextjs-patterns` | framework = nextjs |
| `cometchat-react-router-patterns` | framework = react-router |
| `cometchat-astro-patterns` | framework = astro |
| `cometchat-theming` | When customizing themes |
| `cometchat-features` | When adding features |
| `cometchat-production` | When setting up production auth |
| `cometchat-troubleshooting` | When diagnosing problems |
