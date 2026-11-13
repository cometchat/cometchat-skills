# v5.2.0

## New
- **"Build me a clone of X" just works.** Name an app to copy — *"build a <app> clone"*, *"make it like <app>"* — and the skills run the whole flow from that one line: one short question round (app name, platform if there's no project, optional screenshots), research of the target down to small details (where each feature opens, how it's reached and how it closes), a build level per item (UI Kit as-is → configured → custom views → hosted in your own dialog or panel → your own UI on the SDK), a plan with a clone inventory, one approval, then build-and-compare item by item. Kit components and your own UI share one token set measured from the target. Follows the CometChat chat experience blueprint (`/docs/design-system`).
- **No sample data without asking.** If your app has no conversations yet, the skills say so and ask whether to create clearly marked sample users, groups and messages, and only create them after you agree. They never send messages as your users on their own.
- **No duplicate API calls.** New shared rule: one init and one login in flight, one owner per list (your own components don't re-fetch what a UI Kit component already loads), real-time listeners registered once and removed on unmount.
- **Calls and huddles in clones.** A clone of an app with calls now includes calling in the plan and the build (calling is off until the Calls SDK is installed and enabled). Huddles map to a group call that members join, with your own "huddle active" indicator. A call counts as done only when two users connect; otherwise it's reported as built but not verified.
- **Avatars and names on every message, and docked huddles, on every platform.** When the app you're cloning shows the sender's avatar and name on every message (team apps do), the skills set that up through the UI Kit's settings and, where the settings don't reach (often 1:1 chats and your own messages), its per-message views. Huddles start from the channel, open in a docked panel instead of the full-screen call screen, and Join opens the same panel. Each platform's skill has the verified how-to: React, Angular, Android (Views and Compose), iOS, Flutter and React Native.
- **Clones match the details people notice.** Clone mode now lists every secondary screen (thread view, message info, reactions list, pickers, menus, dialogs, media viewer, call screens) and every animation (animated emoji, message entry, transitions) as its own item. It opens each one to compare with the target and checks that animations actually move. Sending a message must look like one change (only the status icon updates), with a check for the React UI Kit's row remount on confirm. A new shared rule: customize the UI Kit through its API, never by editing its DOM.

## Changed
- **Your CometChat account, through the MCP. No CLI.** The skills fetch credentials and do account tasks through the CometChat MCP server's `cometchat_*` tools, signed in with your CometChat account. They no longer use `npx @cometchat/skills-cli`. The first time your agent needs your account, it opens a CometChat sign-in page. (Claude Code: `/mcp` → `cometchat` → Authenticate.)
- **More than the CLI could do.** With your OK, the skills can also:
  - turn features on and confirm they took effect;
  - create test users, groups and login tokens;
  - create a server-side REST API key (for a token endpoint or a data import);
  - set up webhooks;
  - check usage, moderation and push setup.
- **Installer and plugins: one MCP server.** They wire one server, `cometchat` (`https://mcp.cometchat.com/mcp`). Its docs tools work with no sign-in; its account tools ask you to sign in to CometChat the first time one is called. Use `--mcp-url` (or `COMETCHAT_MCP_URL`) with the server's base URL for a staging or self-hosted server.
  - **Coming from a 5.2.0 prerelease?** Those wired two servers (`cometchat-docs` and `cometchat` on `/mcp/dashboard`), which now shows every account tool twice. Re-run `npx @cometchat/skills add`: it replaces them with the one server and removes the old `cometchat-docs` entry (only when it points at a CometChat MCP host).
- **Some changes need your OK in the browser.** Creating API keys or login tokens, setting the OpenAI key, webhooks, app settings, team invites and deletes return a link instead of acting. The agent gives you the link; you approve that exact change and pass the code back. Other changes still just need you to say yes in the chat.
- **The MCP is a setup step, checked up front.** The README and `MIGRATING.md` list connecting the CometChat MCP as part of setup, with the steps for each agent. If it isn't connected, the skills now say so in their first reply, before any code is written, with the step to connect it, instead of finding out when a docs lookup fails partway through. Onboarding records it in the plan; the Sendbird, Stream and Twilio migrations say it and carry on with web docs.
- **Connect and sign-in steps for your agent, not just Claude Code.** When the CometChat MCP isn't connected or signed in, the skills give the step for the agent you use: Claude Code, Codex, Cursor or ChatGPT.
- **The MCP is wired for every agent.** `add` now also writes the CometChat MCP into VS Code + GitHub Copilot (`.vscode/mcp.json`), Kiro, Antigravity and Continue, and into Windsurf's and Cline's user-level config when they're installed, each in the format that agent expects. Replit gets printed steps with one-click install links; Aider has no MCP support yet and says so.
- **New `remove` command; `doctor` checks the MCP.** `npx @cometchat/skills remove --ide <agent>` undoes `add` (your own skills, rules and MCP servers stay). `doctor` now shows which agent configs have the CometChat MCP and whether its docs and account tools answer (`--offline` skips the network); it also flags the two-server setup from a 5.2.0 prerelease. `add` exits 1 when it can't write an agent's MCP config (for example an invalid `.mcp.json`) instead of reporting success.
- **Cleaner installs.** A native skills folder (`.claude/skills`, `~/.claude/skills` with `--global`, `.kiro/skills`, `.agents/skills`) now holds only skill folders; the shared data files the skills read are inside each skill, not loose at the root. Re-running `add` removes the loose files an earlier version left.
- **Every platform is checked against a current UI Kit.** React 7.2.4, Angular 5.2.2, React Native 5.5.1, Flutter 6.2.0, Android 6.1.1 and iOS 5.2.3 (with their chat and calls SDKs). The skills install the newest release in that major (Android pins 6.1.1). iOS no longer pins exact versions: add CometChatUIKitSwift (Up to Next Major from 5.2.3) and, only for calling, CometChatCallsSDK. Android no longer needs Jetifier. Flutter localization uses `Translations`.
- **The `@cometchat/skills-cli` package is gone from this repo.** Everything it did is in the CometChat MCP's account tools.
- **Manual paste still works.** If you'd rather not connect your account, paste your App ID / Region / Auth Key when asked. If the account server isn't connected or can't be reached, the skills go straight to this path and offer connecting as an option, instead of sending you to a sign-in that can't work.

# v5.1.0


## New
- **Install as a plugin in your AI coding tool.** The skills now ship as a plugin that bundles the CometChat Docs MCP, so the skills read current docs with no extra setup:
  - **Claude Code:** `/plugin marketplace add cometchat/cometchat-skills`, then `/plugin install cometchat-skills@cometchat`.
  - **Gemini CLI:** `gemini extensions install https://github.com/cometchat/cometchat-skills`.
  - **Cursor, Codex and GitHub Copilot:** the repo includes their plugin manifests.
- **Migrate only your data.** The Sendbird and Stream migration skills have a data-only mode. Say *"Migrate only my data from Sendbird to CometChat. Don't change my app code."* The agent writes and runs the data-import script (dry run first) and changes nothing else in your app. If your app already logs in to CometChat, the script reuses your existing user-ID conversion.

## Fixes
- **React v7:** the TypeScript declaration for the UI Kit styles import is now `src/cometchat-styles.d.ts`. A `src/cometchat.d.ts` next to a `src/cometchat.ts` file was ignored by TypeScript, so the build failed with TS2882.
- **Migration skills:** the data-import script folder now has a `.gitignore` for exported user data (`export/`) and, where the script installs packages, `node_modules/`, so the export files can't be committed by accident.

---

# v5.0.1

## New
- **Migrate from another chat provider in one prompt.** Added **Sendbird → CometChat** and **Stream (GetStream) → CometChat** migration skills, installed for every platform. From a single "migrate my app to CometChat" prompt they inventory the app, replace each supported feature with its CometChat equivalent, remove the features CometChat has no equivalent for (and list them), rewire the token server and webhooks, and write a data-migration script for users, groups and message history — then run the import for you once the app migration is done and you provide credentials (dry-run first, then import).
- The data-migration script works within CometChat's [Data Import](https://www.cometchat.com/docs/rest-api/data-import) limits (batch size and rate) and the ~6-month message-retention window (reach out to CometChat to import older history).

---

# v5.0.0

## New
- Added CometChat UI Kit integration skills for six platforms: React v7, Angular v5, React Native v5, iOS v5 (Swift / SPM), Android v6 (Kotlin / Compose), and Flutter v6.
- Added headless Calls SDK v5 skills for JavaScript, React Native, iOS, Android, and Flutter, letting you add voice and video calling without a UI Kit.
- Added a guided onboarding journey that scopes each integration — framework, features, placement, and theming — before any code is generated.
- Added task-shaped skills per platform (core, components, placement, customization, features, calls, push, and migration) that load on demand as the build needs them.
- Added automatic connection to the first-party CometChat Docs MCP, with a guided-add step and a direct documentation-fetch fallback, so skills always read current documentation.

## Breaking
- **Full pack replacement, not an additive update.** v5 is a new generation of skills — new platform targets (React v7, Angular v5, React Native v5, iOS v5, Android v6, Flutter v6), new skill names, and a new layout. Same package name (`@cometchat/skills`), so every existing v4 user is affected.
- **82 v4 skill folders were removed** (the React-UI-Kit-v6 generation and its siblings — e.g. `cometchat-core`, `cometchat-features`, `cometchat-theming`). Their v5 equivalents live under the per-platform, task-shaped names above.
- **Naming shift:** `cometchat-<platform>-v5-*` now refers to the Calls/Chat SDK skills on several platforms (e.g. `cometchat-flutter-v5-*` is the Calls SDK). Update any tooling that referenced v4 skill names.
- **`@cometchat/skills-cli` is now credentials-only (v3.0.0).** The code-writing subcommands from v2 were removed; the CLI now fetches dashboard credentials (App ID, Region, Auth Key) and toggles extensions / AI features. v4-generated `AGENTS.md`/rules files that invoke removed commands should be regenerated.

## Removed
- 82 v4 skill folders (the React-UI-Kit-v6 generation and its siblings).
- `packages/skills-native`, `packages/registry`, the deploy templates, and most of `docs/`.
- The v2 code-writing CLI subcommands (see Breaking).

## Upgrading from v4
- **`@cometchat/skills add` removes stale v4 skills:** before laying down the current family's v5 skills it deletes the skill folders earlier versions shipped (e.g. `cometchat-core`, `cometchat-features`, `cometchat-theming`; the full list is in `bin/legacy-skills.json`) and prints what it removed, so no stale v4 skills are left behind. Other v5 skills already in the directory (a second family, a calls peer, a `--global` install from another project) and your own skills, including any you named `cometchat-*`, are untouched.
- If you installed v4 skills into a location this CLI does not manage, or pinned old skill names in an `AGENTS.md` / editor-rules file, remove those references by hand.
- The companion CLI changed majors (`@cometchat/skills-cli` 2.x → 3.x) and is credentials-only; run `npx @cometchat/skills-cli@3 --help` for the current commands.

## Enhancements
- The Claude Code plugin (`/plugin marketplace add cometchat/cometchat-skills`) now carries the v5 pack and auto-connects the CometChat Docs MCP.
- `add` detects native projects too (an Xcode project or workspace, an iOS `Package.swift`, Gradle, `pubspec.yaml`), not just JavaScript frameworks. `--family` forces a platform or adds a headless Calls SDK skill alongside a UI Kit.
- Agent instruction files (`AGENTS.md`, `GEMINI.md`, `CONVENTIONS.md`, `.windsurfrules`, `.clinerules/cometchat.md`, `.github/copilot-instructions.md`) are written inside a `<!-- cometchat-skills:start/end -->` block, so your own content in those files is kept.
- `add --global` installs Claude Code skills to `~/.claude/skills` and prints the `claude mcp add --scope user` command instead of writing a project `.mcp.json`; agents with no user-level location are skipped with a note.
- Smaller installs: each skill folder now gets only the reference files and catalogs its family's skills cite.
- `@cometchat/skills-cli` warns when `.cometchat/config.json` (which can hold your Auth Key) is already tracked by git, and removed v2 commands explain where that functionality moved.
- Skills are checked against the pinned UI Kit and SDK: a symbol catalog guards against hallucinated APIs and a compile fence confirms the generated code builds. Several families additionally pass a live smoke run on a real simulator/emulator; the remaining families are being wired to it (per-family status in `peers.yaml`).

## Fixes
- None
