# cometchat-skills

**Add CometChat to any React, React Native, Angular, Android, Flutter, or iOS project through your AI coding agent.** Works with Claude Code, Cursor, Codex, VS Code Copilot, Windsurf, Cline, Kiro, and [30+ more agents](https://github.com/vercel-labs/skills).

v4 takes an AI-first approach: your agent has a short conversation with you to understand your project and chat requirements, then writes production-grade integration code tailored to the files you already have. One slash — `/cometchat` — works for every supported framework, on web, mobile, and native.

## Install

```bash
npx @cometchat/skills add
```

That's it — one command for every supported framework. The installer detects what you're working with (React, Next.js, React Router, Astro, Expo, bare React Native, Angular, native Android, Flutter, or native iOS) from your project and installs the right skills.

Override detection if needed:

```bash
npx @cometchat/skills add --family web      # React / Next.js / React Router / Astro
npx @cometchat/skills add --family native   # Expo / bare RN
npx @cometchat/skills add --family angular  # Angular 12-15
npx @cometchat/skills add --family android  # Native Android (V5 stable + V6 beta)
npx @cometchat/skills add --family flutter  # Flutter (V5 stable + V6 beta)
npx @cometchat/skills add --family ios      # Native iOS (V5 stable)
npx @cometchat/skills add --family all      # install every published skill
```

Supported IDEs: Claude Code (default), Cursor, Kiro, VS Code Copilot, Replit Agent. Use `--ide <name>` to target a specific one, or `--ide all`. Replit users: skills land in `.agents/skills/` automatically when you pass `--ide replit`.

> **Migrating from v3?** `npx @cometchat/skills-native add` still works (with a deprecation notice). New projects should use the unified command.

Then in your IDE:

```
/cometchat add chat to my app
```

## What happens

1. **Detects** your framework (React / Next.js / React Router / Astro / Expo / bare React Native / Angular / Android / Flutter / iOS), router, env prefix, existing auth system
2. **Onboards** you to CometChat in the terminal — no browser round-trip. Signup, login, app creation all via the CLI.
3. **Asks** what you're building (marketplace, SaaS, messaging, support, social, or just exploring) and **where** chat should live in your project — it reads your routes/screens, nav, and components before proposing a placement that fits (route+drawer for web, stack/tab/modal/bottom-sheet for RN, route/modal for Angular, Activity/Fragment for Android, navigation controller for iOS, route/modal sheet for Flutter)
4. **Shows the plan** — exactly which files it will create, which it will modify, and which it will not touch — and waits for your approval
5. **Writes** the provider, integration components, and route/screen/trigger wiring
6. **Saves** credentials with the correct convention for your framework (`.env` with `VITE_` / `NEXT_PUBLIC_` / `PUBLIC_` / `EXPO_PUBLIC_` prefix on web/RN; `src/environments/environment.ts` on Angular; `local.properties` + `BuildConfig` on Android; `Secrets.swift` / `.xcconfig` on iOS; Dart const file or `--dart-define` on Flutter) and records your choices in `.cometchat/config.json`

No templates, no experiences to pick — the agent writes real code that fits your app.

## Supported frameworks

| Framework | Status |
|---|---|
| React.js / Vite / CRA | ✅ (`@cometchat/skills`) |
| Next.js (App Router + Pages Router) | ✅ (`@cometchat/skills`) |
| React Router v6 / v7 | ✅ (`@cometchat/skills`) |
| Astro (React islands) | ✅ (`@cometchat/skills`) |
| Expo (managed + Expo Router) | ✅ (`@cometchat/skills`) |
| Bare React Native (CLI) | ✅ (`@cometchat/skills`) |
| Angular 12-15 | ✅ (`@cometchat/skills`) |
| Android (V5 stable + V6 beta) | ✅ (`@cometchat/skills`) |
| Flutter (V5 stable + V6 beta) | ✅ (`@cometchat/skills`) |
| iOS (V5 stable) | ✅ (`@cometchat/skills`) |

## After the first integration

Re-run `/cometchat` anytime to pick from the iteration menu:

- **Customize look & feel** — theme presets (slack / whatsapp / imessage / discord / notion) or your own brand color
- **Add a feature** — 40+ features including calls, reactions, polls, AI smart replies, file sharing, presence
- **Customize a component** — custom message bubbles, headers, composer actions, empty/loading states
- **Add another placement** — floating widget (web), modal / bottom sheet / extra tab (RN)
- **Set up production auth** — replace the dev Auth Key with a server-side token endpoint
- **Set up user management** — server endpoints for creating/updating/deleting CometChat users
- **Run diagnostics** — verify, drift detection, symptom-to-cause lookup

React Native projects also get **Set up push notifications** (APNs + FCM end-to-end), **Set up testing** (Jest + RNTL + Detox/Maestro), and **Troubleshoot an issue** (Metro cache, pod install, privacy manifest) in the menu.

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

# App provisioning — web example
npx @cometchat/skills-cli provision list    # list apps on your account
npx @cometchat/skills-cli provision setup \
  --name my-chat --region us --industry saas_businesses \
  --framework reactjs                       # create app + write .env (VITE_ prefix) + save config

# App provisioning — React Native example (Expo or bare RN)
npx @cometchat/skills-cli provision setup \
  --name my-rn-chat --region us --industry online_marketplaces \
  --framework expo                          # writes EXPO_PUBLIC_* env vars
# Use --framework react-native for bare RN (no env prefix; pair with react-native-dotenv)

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
