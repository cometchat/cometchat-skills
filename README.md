# cometchat-skills

**Add CometChat to a React project in one command.** Production-ready integration for **CometChat React UI Kit v6** across React.js / Next.js / React Router / Astro — detects your framework, scaffolds the right files, wires auth, and is verified by 180 end-to-end tests across 5 AI models.

## Quickstart

```bash
# In your React project:
npx cometchat init --install
```

That's it. The CLI detects your framework, generates the integration files for the [Conversation List](#chat-experiences) experience, installs `@cometchat/chat-uikit-react`, and prints the env vars to add. Add your CometChat credentials and run `npm run dev`.

**Need a different experience?**

```bash
npx cometchat init --experience 2 --install   # One-to-One
npx cometchat init --experience 3 --install   # Tab-Based (Slack/Discord style)
```

**Want a branded look?**

```bash
npx cometchat apply-theme --preset slack       # also: whatsapp, imessage, discord, notion
```

**Production-ready auth (server-side token endpoint):**

```bash
npx cometchat production-auth                  # auto-rewrites the client login flow too
```

**Add a floating chat widget on top of any other UI:**

```bash
npx cometchat add-widget                       # all 4 frameworks supported
```

**More commands:** `detect`, `view` (dry-run), `apply`, `verify`, `info`, `doctor`, `uninstall`, `install`, `features`, `apply-feature`, `add-user-mgmt`. Run `npx cometchat --help`.

**Supported frameworks:** React.js / Vite · Next.js 13/14/15/16 (App Router + Pages Router) · React Router v6 / v7 · Astro
**Supported AI agents:** Claude Code · Cursor · Codex · VS Code Copilot · Windsurf · Cline · Continue · Kiro · Roo · Junie · OpenHands · Goose · Antigravity · 30+ more — any agent supported by [`vercel-labs/skills`](https://github.com/vercel-labs/skills)

---

## Use it from an AI agent (Claude Code, Cursor, etc.)

If you'd rather have your AI agent run the integration for you, install the skills with one command:

```bash
npx skills add cometchat/cometchat-skills --all
```

Then in your agent (Claude Code, Cursor, Windsurf, Copilot, etc.) just say:

```
/cometchat
```

The agent will detect your framework, ask which experience you want, and run the right `cometchat` commands.

```bash
# Install specific skills only
npx skills add cometchat/cometchat-skills --skill cometchat-react-nextjs

# Install to a specific agent
npx skills add cometchat/cometchat-skills --agent claude-code

# Global install
npx skills add cometchat/cometchat-skills --all --global
```

### Recommended companion: CometChat Docs MCP

For the best experience, also install the [CometChat Docs MCP server](https://www.cometchat.com/docs/mcp-server). It gives your AI agent live access to the entire CometChat documentation tree — SDK references, API docs, theming guides, troubleshooting, and feature how-tos — so the agent can answer CometChat-specific questions accurately during integration.

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

**VS Code Copilot:** add as SSE server with URL `https://www.cometchat.com/docs/mcp`.

No authentication required — the docs MCP is hosted by CometChat.

---

## Usage

Open your project in Claude Code and run:

```
/cometchat
```

Claude will:
1. Detect your framework (Next.js, React.js, React Router, Astro)
2. Show three chat experience options
3. Collect or infer your CometChat credentials
4. Scaffold the integration with the correct SSR pattern, file layout, and TypeScript types

### Pass an experience directly

```
/cometchat 1    # Conversation List + Message View
/cometchat 2    # One-to-One Chat
/cometchat 3    # Tab-Based Chat (Chats / Calls / Users / Groups)
```

---

## Supported Platforms

| Platform | Status |
|---|---|
| React.js / Vite / CRA | ✅ |
| Next.js (App Router + Pages Router) | ✅ |
| React Router v7 | ✅ |
| React Router v6 | ✅ |
| Astro (React islands) | ✅ |
| React Native | 🔜 Coming soon |
| Flutter | 🔜 Coming soon |
| Android | 🔜 Coming soon |
| iOS | 🔜 Coming soon |

---

## Chat Experiences

**[1] Conversation List + Message View**
Two-panel layout. Left panel shows all conversations. Clicking one opens the message thread on the right with header, list, and composer. Best for apps where users switch between multiple conversations.

**[2] One-to-One Chat**
Single message window with a hardcoded user or group. No conversation list — just header, message list, and composer. Best for customer support or matched-pair chat.

**[3] Tab-Based Chat**
Left panel has a tab bar: Chats, Calls, Users, Groups. Each tab shows the matching CometChat list. Clicking a conversation opens messages on the right. Best for full-featured messenger-style apps.

---

## What it does

- **Detects** your project's framework, version, router type, env-var prefix, package manager, and existing CometChat installation
- **Refuses to overwrite** files containing user code (boilerplate detection per framework — App.tsx / page.tsx / routes/CometChat.tsx / chat.astro / App.css / main.tsx)
- **Patches existing files minimally** — composable multi-patch with rollback on failure (e.g. React Router `routes.ts` gets the import line + the route registration as 2 idempotent patches)
- **Multi-router** for Next.js — App Router (`src/app/*`) and Pages Router (`src/pages/*`) get different file layouts and SSR-isolation patterns
- **Generates strict TypeScript** with no `any` and explicit error UIs
- **Verifies** the integration with 5 AST checks (init-before-login, no-auth-key-in-source, render-gated-on-login, etc.)
- **Drift detection** via SHA-256 checksums on every owned file
- **Production auth flow** — auto-creates a server-side token endpoint AND auto-rewrites the client login chain to use it (nextjs/react-router/astro)
- **180 end-to-end agent tests** across 5 AI models × 4 frameworks × 6 framework-versions × 3 experiences × 2 project states pass on every release

## Embed in custom locations

By default the chat lands at sensible places (`src/App.tsx` for Vite, `src/app/chat/page.tsx` for Next.js, etc.). If you have your own layout, point at any path:

```bash
npx cometchat init --placement embed:src/features/messaging/ChatPage.tsx
```

The CLI relocates the entry file there, rewrites its relative imports, skips wire-up files that conflict (`main.tsx` for Vite, `routes.ts` patches for React Router), and tells you the one-line route/import you need to add to your existing app.

---

## Prerequisites

- An AI coding assistant: [Claude Code](https://claude.ai/code), [Cursor](https://cursor.sh), [Kiro](https://kiro.dev), VS Code with Copilot, or Antigravity
- A CometChat account — [create a free app](https://app.cometchat.com/signup)
- Node.js 16+, React 18+

---

## Repository Structure

```
cometchat-skills/
  packages/
    cli/                 ← @cometchat/skills-cli — the `cometchat` CLI
      src/commands/      ← detect, view, apply, install, verify, info,
                            uninstall, init, doctor, production-auth,
                            apply-theme, features, apply-feature,
                            add-widget, add-user-mgmt
      test/              ← 168 unit + integration tests (~840ms)
    registry/            ← @cometchat/skills-registry — versioned templates
      v6/
        experiences/     ← 12 manifests (4 frameworks × 3 experiences) + nextjs-pages variant
        production/      ← server-side token endpoint templates
        widget/          ← floating overlay templates (all 4 frameworks)
        user-mgmt/       ← server-side user CRUD templates
        features/        ← 40-feature catalog
  skills/                ← thin agent skills (shipped to public via sync-to-prod.sh)
    cometchat/
    cometchat-react-{reactjs,nextjs,react-router,astro}/
    cometchat-theming/
    cometchat-features/
    cometchat-troubleshooting/
  test-suite/            ← agent E2E test harness (not shipped)
    matrix.json          ← 180-case test plan (5 models × 4 frameworks × 3 exp × 2 projects)
    scripts/             ← scaffold, run-test, run-matrix, report
    RESULTS.md           ← latest matrix results
  docs/                  ← internal design docs (not shipped)
```

---

## License

MIT
