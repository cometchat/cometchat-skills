# cometchat-skills

**Add CometChat to any React project through your AI coding agent.** Works with Claude Code, Cursor, Codex, VS Code Copilot, Windsurf, Cline, Kiro, and [30+ more agents](https://github.com/vercel-labs/skills).

## Install

```bash
npx skills add cometchat/cometchat-skills
```

Then in your IDE:

```
/cometchat
```

Your agent detects the framework, asks which experience you want, integrates CometChat, installs dependencies, and sets up your env file — all through the CLI under the hood.

## Chat Experiences

| # | Name | What it is | Use case |
|---|---|---|---|
| 1 | **Multi-conversation** | Two-panel: conversation list + active thread (header, message list, composer) | Messaging apps, team chat, inboxes |
| 2 | **Single thread** | One chat window for two known users or a group. No conversation list | Support widgets, marketplace chat, embedded consult |
| 3 | **Full messenger** | Bottom tab bar: Chats / Calls / Users / Groups | Social apps, community platforms, dating |

```
/cometchat 1    # Multi-conversation
/cometchat 2    # Single thread
/cometchat 3    # Full messenger
```

## Supported Frameworks

| Framework | Status |
|---|---|
| React.js / Vite / CRA | ✅ |
| Next.js (App Router + Pages Router) | ✅ |
| React Router v6 / v7 | ✅ |
| Astro (React islands) | ✅ |
| React Native | 🔜 Coming soon |
| Flutter | 🔜 Coming soon |
| Android / iOS | 🔜 Coming soon |

## What happens when you run `/cometchat`

1. **Detects** your framework, version, router, env prefix, package manager
2. **Asks** which experience (1, 2, or 3)
3. **Applies** the integration — writes files, patches CSS, wires routes
4. **Installs** `@cometchat/chat-uikit-react` + `@cometchat/chat-sdk-javascript`
5. **Verifies** with 5 AST checks (init order, no leaked auth keys, error UI, etc.)
6. **Creates** `.env` with placeholder values + adds it to `.gitignore`
7. **Shows** the Phase B menu: theme, features, search, details, threads, widget, production auth, diagnostics

## After integration — Phase B

The skill keeps going. Pick from the menu:

- **a.** Theme — `slack` / `whatsapp` / `imessage` / `discord` / `notion` presets or custom colors
- **b.** Features — 40 features (calls, polls, reactions, AI smart replies, etc.)
- **c.** Customize — search, user details, group details, threaded messages (uses the v6 sample app's reference implementations)
- **d.** Floating chat widget
- **e.** Production auth (server-side token endpoint)
- **f.** Server-side user management
- **g.** Diagnostics (`cometchat doctor`)
- **h.** Progress checklist (`cometchat status`)

## Recommended: CometChat Docs MCP

For the best Phase B experience (component customization, SDK events, request builders), install the docs MCP:

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

No authentication required. Not needed for the initial integration — the CLI handles Phase A without it.

## CLI (used by the agent under the hood)

The skill calls `@cometchat/skills-cli` commands. You can also run them directly:

```bash
npx @cometchat/skills-cli@latest init --install          # One-command setup
npx @cometchat/skills-cli@latest detect --json            # Framework detection
npx @cometchat/skills-cli@latest apply-theme --preset slack
npx @cometchat/skills-cli@latest production-auth
npx @cometchat/skills-cli@latest add-widget
npx @cometchat/skills-cli@latest doctor                   # Diagnostics
npx @cometchat/skills-cli@latest status                   # Progress checklist
npx @cometchat/skills-cli@latest --help                   # All 17 commands
```

## Prerequisites

- An AI coding agent ([Claude Code](https://claude.ai/code), [Cursor](https://cursor.sh), [Kiro](https://kiro.dev), VS Code Copilot, or any [skills.sh](https://skills.sh)-compatible agent)
- A CometChat account — [create a free app](https://app.cometchat.com/signup)
- Node.js 18+, React 18+

## License

MIT
