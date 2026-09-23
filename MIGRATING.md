# Migrating from Sendbird or Stream (GetStream) to CometChat

This guide takes an existing chat app built on **Sendbird** or **Stream Chat** and moves it to
**CometChat** — in a single prompt to your AI coding agent. The agent does the whole job: it finds
every place your app uses the old vendor, swaps each supported feature for its CometChat equivalent,
removes the few features CometChat has no equivalent for, rewrites your token server and webhooks,
writes a script to import your users and message history, uninstalls the vendor, and checks the build.

It works whether your app uses the vendor's **UI Kit** (their prebuilt chat components) or their
**SDK / low-level client** (your own UI on their client) — or a mix of both. Every CometChat API it
writes is fetched from the live CometChat docs, never guessed.

Supported app platforms: **React, Angular, React Native / Expo, iOS, Android, Flutter.**

---

## Before you start (prerequisites)

1. **A CometChat account and app.** Sign up free at [app.cometchat.com](https://app.cometchat.com)
   and create an app. From **Dashboard → your app**, note the **App ID**, **Region**, and **Auth Key**
   (under *Credentials*). For importing history you'll also create a **REST API key** (full access) —
   see step 6.
   - Create your CometChat app yourself. The migration never creates one for you.
2. **Node.js 18 or newer** (for `npx` and the data-import script).
3. **Your app builds today**, on the vendor, with your normal build command. Migrating an app that
   doesn't build first only hides which errors were yours.
4. **A clean git working tree.** The agent works on a new `cometchat-migration` branch and never
   commits — but start from a clean state so the diff is easy to review.
5. **Your AI coding agent** with the CometChat skills installed (next step). Claude Code is the
   default; Cursor, Copilot, Windsurf, Cline, Continue, Gemini, Kiro, Replit and others are supported.

---

## Step 1 — Install the CometChat skills into your project

From your project root:

```bash
npx @cometchat/skills add
```

That installs the skills for Claude Code and connects the CometChat Docs MCP. For another agent, pass
`--ide` (for example `--ide cursor`); run `npx @cometchat/skills add --help` for the full list. Commit
the installed skill files if you want your whole team to share them.

> The skills that do the migration — `cometchat-migrate-from-sendbird` and
> `cometchat-migrate-from-getstream` — are installed for every platform, so you don't pick one; the
> agent selects the right one from what your project uses.

## Step 2 — (Optional) fetch your credentials without copy-paste

You can paste your App ID / Region / Auth Key by hand later, or let the credentials CLI fetch them:

```bash
npx @cometchat/skills-cli@3 auth login       # opens the dashboard in your browser
npx @cometchat/skills-cli@3 provision run     # writes .cometchat/config.json (git-ignored, owner-only)
```

The migration reuses `.cometchat/config.json` if it's there, so this saves a step. Skip it if you'd
rather paste.

## Step 3 — Ask your agent to migrate

Open your project in your agent and say:

```
migrate my app to CometChat
```

That's the whole instruction. You don't name the vendor — the agent detects Sendbird or Stream from
your dependencies. It then runs end-to-end **without stopping to ask you questions**, taking sensible
defaults and recording each one in the report at the end.

You can also be explicit: *"migrate my app from Sendbird to CometChat"* /
*"replace Stream Chat with CometChat"*.

### What the agent does, in order

1. **Detects** your framework and which vendor you're on, and creates a `cometchat-migration` git branch.
2. **Inventories** every use of the vendor: UI Kit screens, SDK/client calls, event handlers, calls,
   push, the token server, webhooks, env vars and tests.
3. **Maps each feature** to CometChat, checking the CometChat docs at both levels — the **UI Kit** and
   the **Chat SDK / REST API**. A feature with a UI Kit component is wired with that component; a
   feature with only an SDK method is built on that method in your own UI. Every API is taken from the
   live docs.
4. **Installs CometChat** and wires init → login → render, keeping your own screens and routes.
5. **Replaces usage file by file** — UI Kit components for UI-Kit apps, CometChat SDK calls for
   client-mode apps, or both for a mixed app.
6. **Removes, in full,** any feature CometChat genuinely doesn't offer (code, buttons, routes,
   dependencies) — no dead ends left behind.
7. **Rewrites the server side** — your token endpoint mints CometChat auth tokens; your webhooks map
   to CometChat webhooks.
8. **Writes a data-migration script** (`scripts/cometchat-migration/`) for your users, groups and
   history, then — once the app migration is done — asks for your credentials and **runs the import
   for you** (dry-run first, then import). If you don't share credentials, it's left for you to run.
9. **Uninstalls the vendor** and re-runs your package manager.
10. **Verifies the build** and writes `COMETCHAT_MIGRATION.md`.

## Step 4 — Read the report

At the repo root you'll find **`COMETCHAT_MIGRATION.md`**, and the agent ends its reply with its two
key lists:

- **Removed — not available in CometChat.** Each row names the feature, the files it touched, what
  users lose, and the closest CometChat alternative. Review these — this is where you decide whether to
  rebuild anything a different way or drop it.
- **Your action items.** The remaining manual steps (below), in order.

## Step 5 — Add your credentials and run it

If you didn't do step 2, put your credentials in the env file the report names (for React that's an
untracked `.env.local` with `VITE_COMETCHAT_APP_ID` / `VITE_COMETCHAT_REGION` /
`VITE_COMETCHAT_AUTH_KEY`), then start the app:

```bash
npm run dev
```

Sign in as one of **your own** users — the UID your server's `toCometChatId()` produces for them,
created in Dashboard → **Users** or by the import in Step 6. (A fresh app also seeds sample users such
as `cometchat-uid-1`; they're fine for a quick smoke test, but never hardcode one — production login is
your server-minted auth token.) You should see your conversations and be able to send a message.

## Step 6 — Import your existing users and history

Once the app migration is done, the agent asks for your credentials and runs `scripts/cometchat-migration/` for you (dry-run first, then import). If you didn't share credentials at the time, run it yourself:

1. In the CometChat Dashboard, create a **REST API key** with full access.
2. Read `scripts/cometchat-migration/README.md`, set the environment variables it lists (your vendor
   export credentials + your CometChat App ID / Region / REST API key).
3. **Dry-run first**, then import:
   ```bash
   node scripts/cometchat-migration/migrate.mjs --dry-run
   node scripts/cometchat-migration/migrate.mjs
   ```
4. Spot-check a few conversations in the app, then delete the export files (they hold user data).

The import uses CometChat's [Data Import API](https://www.cometchat.com/docs/rest-api/data-import) and
respects its limits (50 records per request, 60 requests per minute). Re-running it is safe.

**Choose a cut-over strategy:**
- **Hard switch (default here)** — export from the old vendor, import into CometChat, deploy. Simplest; do it in a maintenance window so no messages are sent mid-copy. The generated script does this.
- **Zero-downtime live migration** — keep both systems in sync while users roll onto the new build gradually. This bridges the two providers and is set up with CometChat's team: [contact sales](https://www.cometchat.com/contact-sales). Pick this if you can't take a window.
See [Data Import and Migration](https://www.cometchat.com/docs/fundamentals/data-import-and-migration) for both.

## Step 7 — Go to production

- Enable in the CometChat Dashboard any features the report lists (extensions, AI, Search, etc.).
- For push, upload your FCM / APNs credentials to CometChat.
- Point your webhooks at the new receiver and pick the events.
- **Switch login from the dev Auth Key to server-minted auth tokens.** The Auth Key is for development
  only; in production your server mints a per-user token
  ([auth tokens](https://www.cometchat.com/docs/rest-api/auth-tokens)) and the client logs in with
  `loginWithAuthToken()`. The agent leaves this as an action item and, where your app already had a
  token server, wires it for you.
- Remove the old vendor's secrets from your CI and hosting, and deactivate the vendor app after the
  cut-over.

---

## What migrates, and what doesn't

**Migrated** (fetched from the CometChat docs): 1:1 and group chat, conversation list, send / edit /
delete, typing indicators, read/delivery receipts, attachments, threads, reactions, mentions, polls,
message search, translation, link previews, presence, group membership and moderation, calls, and push
— wherever CometChat offers them for your platform.

**Removed** (no CometChat equivalent, examples): scheduled messages, atomic channel counters, custom
slash commands, arbitrary location sharing, Stream Activity Feeds, and vendor-only dev/QA tooling.
Every removal is listed in the report with its files and the closest alternative.

**Changed** (works differently): open/livestream channels become public groups; very large groups
(over 300 members) don't send receipts or typing indicators; a fresh group appears in the list after
its first message.

---

## Notes

- **One CometChat app for dev, one for production** is the recommended setup; migrate against dev
  first.
- **Identity is preserved.** Your existing user IDs are converted to valid CometChat UIDs by one shared
  rule used by the client, the server and the import script, so logins and imported history line up.
- **Nothing is destroyed.** The agent works on a branch and never force-deletes non-vendor code; your
  vendor code is what it removes, by design.
- If no Sendbird or Stream usage is found, the agent says so and points you at
  `npx @cometchat/skills add` for a fresh integration instead.
