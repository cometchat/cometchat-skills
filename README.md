# cometchat-skills

**Add CometChat to any React, React Native, Angular, Android, Flutter, or iOS project through your AI coding agent.** Works with Claude Code, Cursor, Codex, VS Code Copilot, Windsurf, Cline, Kiro, and [50+ more agents](https://github.com/vercel-labs/skills).

v4 takes an AI-first approach: your agent has a short conversation with you to understand your project and chat requirements, then writes production-grade integration code tailored to the files you already have. One slash — `/cometchat` — works for every supported framework, on web, mobile, and native.

## Install

```bash
npx @cometchat/skills add
```

That's it — one command for every supported framework. The installer detects what you're working with (React, Next.js, React Router, Astro, Expo, bare React Native, Angular, native Android, Flutter, or native iOS) from your project, then opens an interactive picker so you can choose which AI agents to install for — Claude Code, Cursor, Codex, Cline, Kiro, Replit Agent, and [50+ more](https://github.com/vercel-labs/skills) all in one pass.

Override detection if needed:

```bash
npx @cometchat/skills add --family web      # React / Next.js / React Router / Astro
npx @cometchat/skills add --family native   # Expo / bare RN
npx @cometchat/skills add --family angular  # Angular 17-21
npx @cometchat/skills add --family android  # Native Android (V6 stable, recommended + V5 legacy)
npx @cometchat/skills add --family flutter  # Flutter (V6 stable, recommended + V5 legacy)
npx @cometchat/skills add --family ios      # Native iOS (V5 stable)
npx @cometchat/skills add --family all      # install every published skill
```

### Two install shapes

**Base install (default, recommended)** — `npx @cometchat/skills add` writes only the cross-family skills (the `cometchat` dispatcher and friends). Smallest initial install. After it lands, open your project in your IDE and run `/cometchat`:

1. The dispatcher detects your framework (Vite + React → `web`, Expo → `native`, etc.)
2. It asks the agent to install family-specific skills on demand via `npx @cometchat/skills add --family <X> --ide <Y>`
3. The agent gets the 13 web skills (or 31 android, 28 flutter, etc.) at exactly the moment they're needed
4. Integration continues with the full skill set loaded

You install once with the multi-agent picker (Claude Code, Cursor, Codex, Cline, Kiro, Replit Agent, [50+ more](https://github.com/vercel-labs/skills)); the dispatcher handles framework-specific expansion as the project actually needs it.

**Full family install** — `npx @cometchat/skills add --family <name>` writes the dispatcher + every skill for that family upfront (web=13, android=31, flutter=28, etc.). Use when you know the framework upfront and want all skills present without runtime expansion. Power users + CI smoke tests.

```bash
# Base install (recommended) — picker + dispatcher routes the rest
npx @cometchat/skills add

# Full family install — power-user / CI flow
npx @cometchat/skills add --family web      # all 13 web skills upfront
npx @cometchat/skills add --family native   # all 13 RN skills upfront
npx @cometchat/skills add --family android  # all 31 Android skills upfront
# ... etc
```

### Direct-write to one IDE (CI / Dockerfile)

When stdin isn't a TTY (CI, Docker), or when you pass `--ide <name>`, the picker is skipped and skills are written directly to one IDE's directory. Default is base install; pass `--family <name>` for the full family install.

```bash
npx @cometchat/skills add --ide claude              # base install to .claude/skills/
npx @cometchat/skills add --ide cursor              # base install to .cursor/skills/
npx @cometchat/skills add --ide kiro                # base install to .kiro/skills/
npx @cometchat/skills add --ide replit              # base install to .agents/skills/
npx @cometchat/skills add --ide copilot             # base install to .github/copilot-instructions.md
npx @cometchat/skills add --ide all                 # write base install to every supported IDE
npx @cometchat/skills add --ide claude --family web # full web family install to .claude/skills/
```

Direct-write supports 10 agents: `claude`, `cursor`, `kiro`, `replit`, `copilot`, `continue`, `cline`, `aider`, `codex`, `gemini`. The interactive picker supports 55+ via the vercel-labs/skills ecosystem.

Pass `--no-picker` to force direct-write even in an interactive terminal.

> **Migrating from v3?** `npx @cometchat/skills-native add` still works (with a deprecation notice). New projects should use the unified command.

Then in your IDE:

```
/cometchat add chat to my app
```

Or add voice & video calling (new in v4.2):

```
/cometchat add voice and video calls to my app
```

When integrating chat, the dispatcher now asks **how** you want to customize (new in v4.3):

```
◉ Visually — enable-disable in browser
○ In code — code-driven defaults
```

Pick **Visually** and the dispatcher opens CometChat's Visual Builder in your browser, waits while you customize colors / layout / features, then fetches the config and emits the integration into your existing app — no ZIP downloads, no manual file copying. Works for React, React Native, iOS, Android v6, and Flutter v6. Angular customers auto-route to the In-code path (Visual Builder doesn't ship Angular code yet).

## What happens

1. **Detects** your framework (React / Next.js / React Router / Astro / Expo / bare React Native / Angular / Android / Flutter / iOS), router, env prefix, existing auth system
2. **Onboards** you to CometChat in the terminal — no browser round-trip. Signup, login, app creation all via the CLI.
3. **Asks** what you're building (marketplace, SaaS, messaging, support, social, or just exploring) and **where** chat should live in your project — it reads your routes/screens, nav, and components before proposing a placement that fits (route+drawer for web, stack/tab/modal/bottom-sheet for RN, route/modal for Angular, Activity/Fragment for Android, navigation controller for iOS, route/modal sheet for Flutter)
4. **Shows the plan** — exactly which files it will create, which it will modify, and which it will not touch — and waits for your approval
5. **Writes** the provider, integration components, and route/screen/trigger wiring
6. **Saves** credentials with the correct convention for your framework (`.env` with `VITE_` / `NEXT_PUBLIC_` / `PUBLIC_` / `EXPO_PUBLIC_` prefix on web/RN; `src/environments/environment.ts` on Angular; `local.properties` + `BuildConfig` on Android; `Secrets.swift` / `.xcconfig` on iOS; Dart const file or `--dart-define` on Flutter) and records your choices in `.cometchat/config.json`

No templates, no experiences to pick — the agent writes real code that fits your app.

## Supported frameworks

| Framework | Chat | Voice & Video Calls | Visual Builder |
|---|---|---|---|
| React.js / Vite / CRA | ✅ | ✅ Ringing + Session | ✅ (v4.3) |
| Next.js (App Router + Pages Router) | ✅ | ✅ Ringing + Session | ✅ (v4.3) |
| React Router v6 / v7 | ✅ | ✅ Ringing + Session | ✅ (v4.3) |
| Astro (React islands) | ✅ | ✅ Ringing + Session | ✅ (v4.3) |
| Expo (managed + Expo Router) | ✅ | ✅ Ringing + Session | ✅ (v4.3) |
| Bare React Native (CLI) | ✅ | ✅ Ringing + Session | ✅ (v4.3) |
| Angular 17-21 | ✅ | ✅ Ringing + Session | ❌ (auto-falls back to In code) |
| Android (V6 stable, recommended + V5 legacy) | ✅ | ✅ Ringing + Session | ✅ V6 (v4.3) |
| Flutter (V6 stable, recommended + V5 legacy) | ✅ | ✅ Ringing + Session | ✅ V6 chat-only (v4.3) |
| iOS (V5 stable) | ✅ | ✅ Ringing + Session | ✅ (v4.4) |

**Calling modes:**
- **Ringing** — kit-driven incoming/outgoing call surfaces, system-level VoIP push (CallKit on iOS, ConnectionService on Android, web push fallback on browsers). Production-grade for 1:1 + group calls.
- **Session** — both peers join a shared `/meet/:sessionId` URL. No ringing. For embedded meetings, scheduled calls, support flows, broadcast use-cases.

The dispatcher asks Ringing vs Session up front in Step 3.0.

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
