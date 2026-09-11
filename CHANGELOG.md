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
