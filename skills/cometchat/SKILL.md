---
name: cometchat
description: Integrate CometChat into any app. Auto-detects your platform and framework, then walks you through picking and applying a chat experience. Start here — do not invoke platform-specific skills directly. Trigger with "/cometchat", "integrate cometchat", or "add chat to my app".
license: "MIT"
compatibility: "Node.js >=16; React >=18; Claude Code or any agentskills.io-compatible agent"
allowed-tools: "readFile, readCode, readMultipleFiles, grepSearch, fileSearch, listDirectory, executeBash"
metadata:
  author: "CometChat"
  version: "1.0.0"
  tags: "chat cometchat react nextjs astro react-router"
---

# CometChat Integration

You are the entry point for all CometChat integrations. Follow every step in order.

> **Trigger phrases:** `/cometchat`, `/cometchat 1`, `/cometchat 2`, `/cometchat 3`, "integrate CometChat", "add CometChat", "add chat to my app"

---

## AUTONOMOUS MODE

If ALL of the following are true, proceed without asking for confirmation:
1. Framework is unambiguously detected (only one framework matches)
2. Credentials already exist in .env / .env.local (APP_ID, REGION, AUTH_KEY present)
3. Experience was passed as an argument (e.g. /cometchat 1 or /cometchat conversation-list)

If ANY of the following require clarification, ask once and proceed:
- Multiple frameworks detected (e.g. Next.js + Astro in a monorepo)
- No .env file and no existing CometChat init in source
- No experience specified and cannot be inferred from existing code

DO NOT ask for confirmation on:
- Framework version detection (read package.json and decide)
- Whether to patch vs create (follow FILE OPERATION RULES from core)
- Whether to skip install (read package.json and decide)
- Whether CSS is already imported (read the file and decide)

---

## Step 1 — Detect Platform

Read the following files (whichever exist) to identify the platform:

| File to read | Signal |
|---|---|
| `package.json` | Web / React Native |
| `pubspec.yaml` | Flutter |
| `app/build.gradle` or `build.gradle.kts` | Android |
| `*.xcodeproj/` (glob) or `Package.swift` | iOS |

**Detection rules (check in this order):**

1. `package.json` exists → read `dependencies` and `devDependencies`:
   - `"next"` present → **Next.js**
   - `"@react-router/dev"` present → **React Router v7**
   - `"react-router-dom"` present (no `@react-router/dev`) → **React Router v6**
   - `"astro"` present → **Astro**
   - `"react-native"` present → **React Native** *(coming soon)*
   - `"expo"` present → **Expo** *(coming soon)*
   - `"react"` present (none of the above) → **React.js / Vite**
   - None of the above → **Unknown web project**

2. `pubspec.yaml` exists → **Flutter** *(coming soon)*

3. `app/build.gradle` or `build.gradle.kts` exists → **Android** *(coming soon)*

4. `*.xcodeproj` or `Package.swift` exists → **iOS** *(coming soon)*

5. Nothing matched → ask the user: "What platform are you building on?"

---

## Edge Cases

Handle these before proceeding to Step 2:

**Monorepo with multiple `package.json` files:**
- Read the `package.json` nearest to the current working directory first
- If the nearest one has no recognizable framework, check one level up
- If still ambiguous (e.g., Next.js in `apps/web/` and Astro in `apps/docs/`), ask: "I found multiple apps — which one should I add chat to?"

**No `package.json` at all:**
- Ask: "What platform are you building on?" — do not attempt detection
- If the user names a supported framework, proceed with that skill

**`package.json` exists but no recognizable framework (`"react"` not present, no `"next"`, no `"astro"`, etc.):**
- Say: "I couldn't detect a supported framework in your `package.json`. CometChat skills currently support React.js, Next.js, React Router, and Astro. Are you using one of these?"
- If yes, proceed with the named skill. If no, point to the [CometChat docs](https://www.cometchat.com/docs).

**Framework detected but marked "coming soon":**
- See Step 3 — stop and point to docs. Do not attempt integration.

---

## Example — Full Invocation Flow

This shows what a complete `/cometchat` run looks like from trigger to delegation.

```
User: /cometchat 1

→ Step 1: Read package.json
  Found: "next": "^15.0.0"
  Detected: Next.js (App Router — src/app/ present)

→ Step 2: Confirm
  "Detected Next.js 15 (App Router) — continuing."

→ Step 3: Support check
  Next.js → supported ✓

→ Step 4: Route placement
  "Where would you like to embed the chat?"
  User: "A dedicated /chat route"

→ Step 4b: Experience
  Experience 1 passed as argument — skip asking

→ Step 5: Credentials
  Read .env.local → NEXT_PUBLIC_COMETCHAT_APP_ID found
  Read .env.local → NEXT_PUBLIC_COMETCHAT_REGION found
  Read .env.local → NEXT_PUBLIC_COMETCHAT_AUTH_KEY found
  No /api/cometchat-token endpoint found
  All credentials inferred — no questions needed

→ Step 6: Delegate to cometchat-react-nextjs
  Passing: experience=1, placement=dedicated-route, credentials=from-.env.local

→ Step 6b: Theming
  "Would you like the chat UI to match your app's visual theme?"
  User: "No"
  → Skip theming

→ Step 7: Post-integration prompt
  "Your chat integration is working with test users. When you're ready
   to connect your real app users, run /cometchat production."
```

---

## Step 2 — Confirm Detection

If detection is unambiguous, state what was detected and continue. Only pause for confirmation if ambiguous.

Example (unambiguous): "Detected **Next.js** (App Router) — continuing."
Example (ambiguous): "Detected both Next.js and Astro in this monorepo. Which should I target?"

If the user corrects you, use their answer.

---

## Step 3 — Check UI Kit Support

**Supported now:**
- React.js / Vite / CRA → `cometchat-react-reactjs`
- Next.js → `cometchat-react-nextjs`
- React Router v6 / v7 → `cometchat-react-react-router`
- Astro → `cometchat-react-astro`

**Coming soon (not yet available):**
- React Native, Expo, Flutter, Android, iOS

If the detected platform is *coming soon*, say:

> "CometChat skills for **[platform]** are not available yet. You can integrate manually using the [CometChat docs](https://www.cometchat.com/docs). Want me to open the docs for your platform?"

Then stop — do not attempt an integration without a skill file.

---

## Step 4 — Ask Where to Place the Chat

**Skip this step and use `placement=dedicated-route` (default to [A]) if ANY of the following is true:**
- A placement was passed as argument (e.g. `/cometchat 1 dedicated-route`, `/cometchat 1 embed:/dashboard`)
- You are running in non-interactive / automated / one-shot mode (no live human turn available)
- The user's prompt does not explicitly mention an existing page to embed into

In any of those cases, **DO NOT print the question below**. Silently set `placement=dedicated-route` and proceed to Step 4b. Log one line: "No placement specified — defaulting to [A] dedicated `/chat` route".

Otherwise (interactive mode, no argument, no inferred page), ask the user:

> "Where would you like to embed the chat?"
>
> **[A] Dedicated `/chat` route** — creates a new page/route at `/chat`. Best for apps where chat is a top-level destination.
>
> **[B] Embed in an existing page** — adds the chat component directly into a page you already have (e.g., `/dashboard`, `/support`). Best when chat is a secondary feature alongside other content.

Wait for the user to choose [A] or [B].

- If **[A]**: proceed normally — the framework skill will create a `/chat` route.
- If **[B]**: ask "Which page/route should I add chat to?" then pass that path to the framework skill. The framework skill will patch that page instead of creating a new `/chat` route.

---

## Step 4b — Present Experience Options

If experience was passed as argument (e.g. `/cometchat 1`, `/cometchat conversation-list`), skip this step and use the specified experience.

Otherwise, ask:

> "Which chat experience would you like to integrate?"

Show all three options with descriptions:

**[1] Conversation List + Messages**
A full chat UI. The left panel shows all conversations (users and groups). Clicking one opens the message thread on the right — header, message list, and composer. Best for apps where users need to browse and switch between multiple conversations.

**[2] One-to-One Chat**
Embeds a direct message window with a single hardcoded user or group. No conversation list — just the message header, list, and composer filling the screen. Best for apps where the chat partner is known in advance (e.g., customer support, matched pairs).

**[3] Tab-Based Chat**
The left panel has a bottom tab bar with four tabs: Chats, Calls, Users, Groups. Each tab shows the corresponding CometChat list component. Clicking a conversation or user opens messages on the right. Best for full-featured messenger-style apps.

Wait for the user to choose [1], [2], or [3].

**Autonomous fallback:** If running in non-interactive / automated mode and no experience was specified:
1. Default to Experience 1 (Conversation List + Messages)
2. DO NOT ask the user — proceed immediately
3. Log the assumption in output: "No experience specified — defaulting to Experience 1 (Conversation List + Messages)"

---

## Step 5 — Collect Credentials

**Inference order — execute all before asking:**

1. Check `.env` / `.env.local` / `.env.development` for `APP_ID`, `REGION`, `AUTH_KEY`
2. Grep source files for `CometChatUIKit.init` — extract credentials from existing call if found
3. Check for server-side auth token endpoint (`/api/auth`, `/api/cometchat-token`) → if found, use `loginWithAuthToken()` and skip Auth Key entirely
4. Default `LOGIN_UID` to `cometchat-uid-1` if not found (pre-created in every CometChat app)

Only ask the user for values still missing after the steps above.

> ⚠ Auth Key is for development only. In production use server-generated Auth Tokens.

---

## Step 6 — Delegate to Platform Skill

Based on the detected platform, follow the corresponding skill **in full**, passing through the chosen experience and credentials:

| Platform | Skill to follow |
|---|---|
| React.js / Vite / CRA | `cometchat-react-reactjs` |
| Next.js | `cometchat-react-nextjs` |
| React Router v6 / v7 | `cometchat-react-react-router` |
| Astro | `cometchat-react-astro` |

Start from **Step 0** of the target skill (idempotency check). Skip steps the target skill says to skip. Apply the experience the user chose in Step 4 (maps to Step 7A / 7B / 7C in the target skill).

Do not ask the user for credentials again — carry them through from Step 5.

---

## Step 6b — Ask About Theming

After the framework skill completes the integration, ask:

> "Would you like the chat UI to match your app's visual theme (colors, fonts, border radius)?"

- If **yes**: follow the **Theming** section in `cometchat-react-core` — it covers the key CSS variables to override and where to place them.
- If **no**: skip and proceed to Step 7.

**Autonomous fallback:** Skip theming in non-interactive / automated mode.

---

## Step 7 — Post-Integration: Go to Production

After the basic integration is complete, offer this follow-up:

> "Your chat integration is working with test users. When you're ready to connect your real app users, run `/cometchat production`."

**Trigger phrases for production setup:**
`/cometchat production`, "go to production", "connect real users", "replace cometchat-uid-1", "set up auth tokens", "remove Auth Key"

When triggered:
1. Detect framework (same as Step 1)
2. Follow **Step 8** of the corresponding framework skill — it covers:
   - UID strategy (map your app's user ID → CometChat UID)
   - Creating CometChat users at sign-up (REST API)
   - Server-side auth token endpoint (framework-specific)
   - Updating the client to use `loginWithAuthToken()`
   - Removing Auth Key from `.env`
   - Testing with two real users in separate windows
