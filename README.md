# cometchat-skills

**Add CometChat to any React project through your AI coding agent.** Works with Claude Code, Cursor, Codex, VS Code Copilot, Windsurf, Cline, Kiro, and [30+ more agents](https://github.com/vercel-labs/skills).

v3 takes an AI-first approach: your agent has a short conversation with you to understand your project and chat requirements, then writes production-grade integration code tailored to the files you already have.

## Install

```bash
npx @cometchat/skills add
```

Supported IDEs: Claude Code (default), Cursor, Kiro, VS Code Copilot. Use `--ide <name>` to target a specific one, or `--ide all`.

Then in your IDE:

```
/cometchat add chat to my app
```

## What happens

1. **Detects** your framework (React / Next.js / React Router / Astro), router, env prefix, existing auth system
2. **Onboards** you to CometChat in the terminal — no browser round-trip. Signup, login, app creation all via the CLI.
3. **Asks** what you're building (marketplace, SaaS, messaging, support, social, or just exploring) and **where** chat should live in your project — it reads your routes, nav, and components before proposing a placement
4. **Shows the plan** — exactly which files it will create, which it will modify, and which it will not touch — and waits for your approval
5. **Writes** the provider, integration components, and route/trigger wiring
6. **Saves** `.env` with the correct framework prefix (`VITE_` / `NEXT_PUBLIC_` / `PUBLIC_`) and records your choices in `.cometchat/config.json`

No templates, no experiences to pick — the agent writes real code that fits your app.

## Supported frameworks

| Framework | Status |
|---|---|
| React.js / Vite / CRA | ✅ |
| Next.js (App Router + Pages Router) | ✅ |
| React Router v6 / v7 | ✅ |
| Astro (React islands) | ✅ |
| React Native | 🔜 Coming soon |
| Flutter | 🔜 Coming soon |
| Android / iOS | 🔜 Coming soon |

## After the first integration

Re-run `/cometchat` anytime to pick from the iteration menu:

- **Customize look & feel** — theme presets (slack / whatsapp / imessage / discord / notion) or your own brand color
- **Add a feature** — 40+ features including calls, reactions, polls, AI smart replies, file sharing, presence
- **Customize a component** — custom message bubbles, headers, composer actions, empty/loading states
- **Add a floating widget** — overlay chat button + drawer on top of your existing app
- **Set up production auth** — replace the dev Auth Key with a server-side token endpoint
- **Set up user management** — server endpoints for creating/updating/deleting CometChat users
- **Run diagnostics** — verify, drift detection, symptom-to-cause lookup

## Recommended: CometChat Docs MCP

For deeper component customization (custom views, SDK events, request builders), install the docs MCP:

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

No authentication required. Not needed for the initial integration — the skill handles Phase A without it.

## CLI (used by the agent under the hood)

The skill calls `@cometchat/skills-cli` commands. You can also run them directly:

```bash
# Onboarding
npx @cometchat/skills-cli auth signup       # create account, all in terminal
npx @cometchat/skills-cli auth login        # sign in (masked password)
npx @cometchat/skills-cli auth status       # check current session

# App provisioning
npx @cometchat/skills-cli provision list    # list apps on your account
npx @cometchat/skills-cli provision setup \
  --name my-chat --region us --industry saas_businesses \
  --framework reactjs                       # create app + write .env + save config

# Project introspection
npx @cometchat/skills-cli detect            # framework, router, env prefix
npx @cometchat/skills-cli config show       # read .cometchat/config.json
npx @cometchat/skills-cli doctor            # diagnostics

# See everything
npx @cometchat/skills-cli --help
```

## Prerequisites

- An AI coding agent ([Claude Code](https://claude.ai/code), [Cursor](https://cursor.sh), [Kiro](https://kiro.dev), VS Code Copilot, or any [skills.sh](https://skills.sh)-compatible agent)
- Node.js 18+
- React 18+ (React 19 fully supported)

No CometChat account required before starting — the skill walks you through signup from the terminal.

## License

MIT
