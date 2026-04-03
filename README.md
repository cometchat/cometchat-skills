# cometchat-skills

Production-ready agent skills for integrating **CometChat React UI Kit v6** into React apps. Works with Claude Code, Cursor, Kiro, VS Code Copilot, and any AI coding agent.

```bash
npx cometchat-skills add
```

Detects your framework automatically and scaffolds a full chat integration — conversations, one-to-one chat, or tab-based chat — with the correct SSR pattern, TypeScript types, and error handling.

**Supported frameworks:** React.js / Vite · Next.js (App Router + Pages Router) · React Router v6 / v7 · Astro

**Supported agents:** Claude Code · Cursor · Kiro · VS Code Copilot · Codex · any agent that reads markdown context

---

## Install

```bash
# Install for Claude Code (default)
npx cometchat-skills add

# Install for a specific IDE
npx cometchat-skills add --ide cursor     # → .cursor/rules/
npx cometchat-skills add --ide kiro       # → .kiro/skills/
npx cometchat-skills add --ide copilot    # → .github/copilot-instructions.md
npx cometchat-skills add --ide all        # → all of the above + .claude/skills/

# Global install (works in any project)
npx cometchat-skills add --global
```

```bash
npx skills add cometchat/cometchat-skills
```

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

## What the skills do

- Detect your project's router type, bundler, and framework version
- Infer credentials from `.env` / existing `CometChatUIKit.init` calls before asking
- Choose the right SSR prevention pattern for your framework
- Patch existing files minimally — never overwrite app logic, auth, or routing
- Generate TypeScript with no `any` types
- Surface init/login errors as visible UI
- Run a verification checklist after integration

---

## Prerequisites

- An AI coding assistant: [Claude Code](https://claude.ai/code), [Cursor](https://cursor.sh), [Kiro](https://kiro.dev), VS Code with Copilot, or Antigravity
- A CometChat account — [create a free app](https://app.cometchat.com/signup)
- Node.js 16+, React 18+

---

## Repository Structure

```
cometchat-skills/
  skills/              ← skill files (agentskills.io format, shipped to npm)
    cometchat/
      SKILL.md                      dispatcher (entry point)
    cometchat-react-core/
      SKILL.md                      shared rules for all React integrations
    cometchat-react-reactjs/
      SKILL.md                      React.js / Vite
    cometchat-react-nextjs/
      SKILL.md                      Next.js
    cometchat-react-react-router/
      SKILL.md                      React Router v6 + v7
    cometchat-react-astro/
      SKILL.md                      Astro
  bin/
    install.js         ← npx cometchat-skills add
  test-suite/          ← test harness (not shipped)
    fixtures/          ← existing-project test scenarios
    scripts/           ← scaffold, verify, run-test, run-matrix, report
    matrix.json        ← all test dimensions
    RESULTS.md         ← live results table
  docs/                ← internal design docs (not shipped)
```

---

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md).

---

## License

MIT
