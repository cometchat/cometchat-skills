---
name: cometchat-production
description: "Interactive skill for moving CometChat from dev-mode Auth Key to production mode (server-minted per-user tokens + server-side user management). Generates a per-framework token endpoint, rewrites the client login, and wires create/update/delete user endpoints to your auth system."
license: "MIT"
compatibility: "Node.js >=18; React >=18; @cometchat/chat-uikit-react ^6; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat production auth token user-management server rest-api"
---

## Use this skill when

The user wants to move off the client-side Auth Key (dev mode) to a production setup:

- "set up production auth" / "replace the auth key" / "I'm going to production"
- "server-side user management" / "sign users up on CometChat when they sign up on my app"
- Iteration menu from the `cometchat` dispatcher → "Set up production auth" or "Set up user management"

This skill is **interactive and conversational**. Ask about the user's auth system, their user model, and which flows they need (sign-up / update / delete) before writing a single line of code. Reuse what the dispatcher already learned in Step 3d (auth system detection) and Step 3e (user ID shape) — do NOT re-ask.

## Why production mode exists

Dev mode uses a client-side `AUTH_KEY` so anyone with your bundle can log in as any user ID. That's fine for local testing; it's a vulnerability in production. Production mode shifts the trust boundary:

- Your **server** holds the `COMETCHAT_AUTH_TOKEN` (the REST API Key from the dashboard — never shipped to the browser).
- Your **server** calls CometChat's REST API to mint a short-lived **per-user auth token** for the specific user your auth system says is logged in.
- Your **client** calls `CometChatUIKit.loginWithAuthToken(userToken)` instead of `CometChatUIKit.login(uid)`.

Terminology note: the env var is named `COMETCHAT_AUTH_TOKEN` because that's the long-standing convention across the other pattern skills. The value is the key that appears in the dashboard as **"REST API Key"**, not a per-user token. The per-user auth tokens referred to above are a separate, short-lived concept minted from this key.

That's the whole flip. Everything else in this skill is plumbing to make it happen inside the user's framework.

## Hard rules

- **The REST API key is server-only.** Never prefix it with `VITE_`, `NEXT_PUBLIC_`, or `PUBLIC_`. If you see yourself about to write one of those prefixes on an API key, stop.
- **Auth tokens are per-user and short-lived.** Mint a fresh token per login, don't cache tokens across users, and never log the token value.
- **The server endpoint MUST authenticate the caller** against the user's existing auth system before minting a token. If the user is unauthenticated and your endpoint mints a token anyway, you've rebuilt dev mode with extra steps.
- **Never overwrite the existing client-side login call without confirmation.** Show the diff. The user may want dev-mode + prod-mode behind a flag during rollout.
- **Never invent REST endpoints or request shapes from memory.** The canonical paths are in the table below; if the user needs something beyond those, query the docs MCP.

## REST API reference (the three paths that matter)

All requests go to `https://<APP_ID>.api-<REGION>.cometchat.io/v3/...` with two headers:

```
apiKey: <COMETCHAT_AUTH_TOKEN>
Content-Type: application/json
```

| Operation | Method + path | Body | Returns |
|---|---|---|---|
| Mint an auth token | `POST /users/{uid}/auth_tokens` | none | `{ data: { authToken, uid, ... } }` |
| Create a user | `POST /users` | `{ uid, name, avatar?, metadata?, ... }` | `{ data: { uid, name, ... } }` |
| Update a user | `PUT /users/{uid}` | partial user fields | `{ data: { ... } }` |
| Delete a user | `DELETE /users/{uid}` | none (query: `?permanent=true` for hard delete) | `{ data: { success: true } }` |

The value for `COMETCHAT_AUTH_TOKEN` comes from https://app.cometchat.com → Your App → API & Auth Keys → **"REST API Key"** (different from the client-side "Auth Key"). Tell the user to copy it there.

## Steps

### Step 1 — Reuse what the dispatcher already learned

Read `.cometchat/config.json`:

```bash
npx @cometchat/skills-cli config show --json
```

You're looking for:

- `framework` — one of `reactjs`, `nextjs`, `react-router`, `astro`
- `authSystem` — `next-auth` / `clerk` / `supabase` / `firebase` / `passport` / `jwt` / `none` (set by dispatcher Step 3d)
- `userIdShape` — from dispatcher Step 3e (e.g. "clerk IDs look like `user_2abc...`")

If any of these are missing, the user came straight to this skill without the dispatcher wizard — ask now. Use `AskUserQuestion` for framework and auth system. Don't guess.

### Step 2 — Confirm what you're about to change

Before writing anything, show the user exactly what will land in their project.

> "Here's the production-auth wiring I'm about to do:
>
> **New files:**
> - `<server-endpoint-path>` — mints auth tokens from your backend
> - *(if user mgmt)* `<user-endpoint-path>` — create/update/delete CometChat users
>
> **Files I'll modify:**
> - `<provider-or-login-file>` — swap `CometChatUIKit.login(uid)` → `loginWithAuthToken(token)`
> - `.env` / `.env.local` — add `COMETCHAT_AUTH_TOKEN` (server-only)
>
> **What I need from you:**
> - Your REST API Key from https://app.cometchat.com → Your App → API & Auth Keys
> - *(reactjs only — no built-in server)* Where your backend lives (separate Express service? an existing API route in another repo?)
>
> Proceed?"

Wait for explicit confirmation. If the user is on reactjs (Vite/CRA) and has no backend, **stop here** and tell them: "Vite/CRA is a client-only build. Production auth needs a server to hold the REST API key. Options: (a) add an Express server to this repo, (b) add a Cloud Function / Vercel Serverless Function, (c) add the endpoint to your existing backend. Which?" Don't push forward until they pick one.

### Step 3 — Write the token endpoint (framework-specific)

Pick the section that matches the detected framework. Each endpoint shares the same contract: authenticate the caller, look up their user ID, mint a token via the REST API, return `{ token }`.

#### Next.js — App Router

Create `app/api/cometchat-token/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
// import your auth (adapt to the user's system — examples follow)
// import { auth } from "@/auth";  // NextAuth v5
// import { currentUser } from "@clerk/nextjs/server";  // Clerk

export async function POST(_req: NextRequest) {
  // 1. Authenticate the caller against YOUR auth system.
  // NextAuth v5:
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = session.user.id;

  // 2. Mint the CometChat token.
  const appId = process.env.COMETCHAT_APP_ID!;
  const region = process.env.COMETCHAT_REGION!;
  const restKey = process.env.COMETCHAT_AUTH_TOKEN!;

  const r = await fetch(
    `https://${appId}.api-${region}.cometchat.io/v3/users/${encodeURIComponent(uid)}/auth_tokens`,
    {
      method: "POST",
      headers: { apiKey: restKey, "Content-Type": "application/json" },
    }
  );

  if (!r.ok) {
    const err = await r.text();
    return NextResponse.json({ error: "mint-failed", detail: err }, { status: 502 });
  }
  const body = await r.json();
  return NextResponse.json({ token: body.data.authToken });
}
```

#### Next.js — Pages Router

Create `pages/api/cometchat-token.ts` with the same logic, using `req: NextApiRequest, res: NextApiResponse` and `getServerSession` instead of `auth()`.

#### React Router v7 (framework mode)

Create `app/routes/api.cometchat-token.ts`:

```typescript
import type { ActionFunctionArgs } from "react-router";

export async function action({ request }: ActionFunctionArgs) {
  // Authenticate via your session cookie / auth lib.
  const user = await getAuthenticatedUser(request);
  if (!user) return new Response("unauthorized", { status: 401 });

  const appId = process.env.COMETCHAT_APP_ID!;
  const region = process.env.COMETCHAT_REGION!;
  const restKey = process.env.COMETCHAT_AUTH_TOKEN!;

  const r = await fetch(
    `https://${appId}.api-${region}.cometchat.io/v3/users/${encodeURIComponent(user.id)}/auth_tokens`,
    { method: "POST", headers: { apiKey: restKey, "Content-Type": "application/json" } }
  );
  if (!r.ok) return new Response("mint-failed", { status: 502 });
  const body = await r.json();
  return Response.json({ token: body.data.authToken });
}
```

#### Astro

Create `src/pages/api/cometchat-token.ts`:

```typescript
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  // locals.user is whatever your auth middleware populates — adapt as needed.
  const user = locals.user;
  if (!user) return new Response("unauthorized", { status: 401 });

  const appId = import.meta.env.COMETCHAT_APP_ID;
  const region = import.meta.env.COMETCHAT_REGION;
  const restKey = import.meta.env.COMETCHAT_AUTH_TOKEN;

  const r = await fetch(
    `https://${appId}.api-${region}.cometchat.io/v3/users/${encodeURIComponent(user.id)}/auth_tokens`,
    { method: "POST", headers: { apiKey: restKey, "Content-Type": "application/json" } }
  );
  if (!r.ok) return new Response("mint-failed", { status: 502 });
  const body = await r.json();
  return new Response(JSON.stringify({ token: body.data.authToken }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

Make sure the Astro project has `output: "server"` (or `"hybrid"`) in `astro.config.*`, or the API route will be pre-rendered and won't execute at request time. Check and tell the user if it needs flipping.

#### React.js (Vite / CRA) — external backend

Vite/CRA don't serve API routes. Generate the endpoint in whichever backend the user named in Step 2 (Express, Fastify, Hono, Cloud Function). The logic is identical to the Next.js example above — authenticate, `fetch` the REST API, return `{ token }`. Mount it at a path the client can call (`/api/cometchat-token` on the same origin, or a full URL if the backend is on a separate host — then you also need CORS there).

### Step 4 — Swap the client login call

Find the file where `CometChatUIKit.login(...)` is called (the dispatcher's integration left this in the provider or a login-effect). Show the user the diff before writing:

```diff
- await CometChatUIKit.login("cometchat-uid-1");  // DEV: hardcoded test user
+ // PRODUCTION: mint a per-user token from our server
+ const res = await fetch("/api/cometchat-token", { method: "POST", credentials: "include" });
+ if (!res.ok) throw new Error("Failed to get CometChat auth token");
+ const { token } = await res.json();
+ await CometChatUIKit.loginWithAuthToken(token);
```

Three things to get right:

1. **`credentials: "include"`** on the fetch, so the browser forwards the auth cookie/session. Without this, the endpoint sees no session and returns 401.
2. **The login call must run AFTER the user signs into your app** — gate it on whatever your auth library exposes (`useSession`, `useAuth`, `onAuthStateChanged`, etc.). Don't call it on mount unconditionally.
3. **`CometChatUIKit.login` is idempotent but `loginWithAuthToken` is NOT.** Calling it twice with the same token throws. Guard with a `loggedIn` flag or check `CometChatUIKit.getLoggedinUser()` first.

### Step 5 — (Optional) Server-side user management

Users of your app need a matching CometChat user before they can be logged into. In dev mode, CometChat's 5 pre-seeded test users cover this. In production, when a real user signs up in your app, you need to create them in CometChat too.

Ask the user which flows they want. Use `AskUserQuestion`:

- **question:** "Which user lifecycle flows should the server handle?"
- **header:** "User mgmt flows"
- **multiSelect:** true
- **options:**
  1. label: "Sign-up", description: "When a user signs up in my app, create a matching CometChat user."
  2. label: "Profile update", description: "When a user changes their name/avatar, update it in CometChat."
  3. label: "Account deletion", description: "When a user deletes their account, delete from CometChat."
  4. label: "None — I'll just call login() and let CometChat auto-create", description: "CometChat creates the user on first auth-token mint."

Option 4 is the shortcut — if the uid doesn't exist at token-mint time, CometChat creates the user on the fly with just the uid. Good enough for many apps. Stop here and skip the rest of Step 5.

For Options 1-3, generate a single endpoint that handles POST/PUT/DELETE (or three endpoints — ask the user which they prefer). Example for Next.js App Router, `app/api/cometchat-user/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

const BASE = `https://${process.env.COMETCHAT_APP_ID}.api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users`;
const HEADERS = {
  apiKey: process.env.COMETCHAT_AUTH_TOKEN!,
  "Content-Type": "application/json",
};

async function requireAdmin(req: NextRequest) {
  // This endpoint must only be callable from your server's own code
  // (e.g. your sign-up handler) or by an authenticated admin. Validate
  // a server-to-server secret or admin session here. Never expose this
  // directly to client fetches from an unauthenticated page.
}

export async function POST(req: NextRequest) {
  await requireAdmin(req);
  const { uid, name, avatar, metadata } = await req.json();
  const r = await fetch(BASE, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ uid, name, avatar, metadata }),
  });
  return NextResponse.json(await r.json(), { status: r.status });
}

export async function PUT(req: NextRequest) {
  await requireAdmin(req);
  const { uid, ...fields } = await req.json();
  const r = await fetch(`${BASE}/${encodeURIComponent(uid)}`, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify(fields),
  });
  return NextResponse.json(await r.json(), { status: r.status });
}

export async function DELETE(req: NextRequest) {
  await requireAdmin(req);
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
  const r = await fetch(`${BASE}/${encodeURIComponent(uid)}?permanent=true`, {
    method: "DELETE",
    headers: HEADERS,
  });
  return NextResponse.json(await r.json(), { status: r.status });
}
```

Adapt per framework using the same transpositions as Step 3. For React Router: one `action` with `request.method` dispatch. For Astro: separate `POST`/`PUT`/`DELETE` named exports. For reactjs: route in the external backend.

**Wiring into the user's auth lifecycle:**

Ask which hook the user's auth system exposes:

- **NextAuth** → `events.createUser` callback in `auth.ts`
- **Clerk** → webhook at `/api/webhooks/clerk` with `user.created` / `user.updated` / `user.deleted`
- **Supabase** → Database trigger → Edge Function, OR call from your sign-up handler directly
- **Firebase Auth** → Cloud Function on `functions.auth.user().onCreate()`
- **Passport / Custom JWT** → call from the sign-up route handler after creating the app user

Walk the user through wiring one — don't generate all of them speculatively. Read their auth config file and show a diff.

### Step 6 — Environment variables

Add to the correct env file (ask the user to paste values — don't accept them in chat, write them to the file directly from a prompt):

| Framework | Env file | New vars |
|---|---|---|
| Next.js | `.env.local` | `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_TOKEN` (no `NEXT_PUBLIC_` prefix — these stay server-side) |
| React Router | `.env` | `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_TOKEN` |
| Astro | `.env` | `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_TOKEN` |
| React.js (external backend) | Whatever the backend uses | Same three names |

Note the overlap: the dispatcher's dev-mode integration already set public-prefixed versions (`VITE_COMETCHAT_APP_ID`, etc.) for the client-side init. **Keep both.** The client still needs `APP_ID` + `REGION` to call `CometChatUIKit.init()`; only the `AUTH_KEY` is replaced by the token flow. The server needs unprefixed versions of `APP_ID` + `REGION` + `REST_API_KEY` so it can call the REST API.

Add `.env*` to `.gitignore` if it isn't already. Never commit the REST API key.

### Step 7 — Verify

Run a type check:

```bash
npx tsc --noEmit
```

Then a smoke test path:

1. Start the dev server.
2. Log in as a real user through the app's normal auth flow.
3. Open the network tab. The client should fire `POST /api/cometchat-token`, get back `{ token: "..." }`, and then the CometChat UI renders with that user's UID (not `cometchat-uid-1`).
4. If the endpoint 401s, auth isn't wired — check `credentials: "include"` on the fetch and that the session cookie is being sent.
5. If the REST API call 401s, the REST API key is wrong — re-copy from the dashboard, and confirm no `PUBLIC_`/`VITE_`/`NEXT_PUBLIC_` prefix (those get bundled to the client and exposed).

### Step 8 — Record state

Update `.cometchat/state.json` so `doctor` / `verify` / `uninstall` know about the new files. `--framework` is required — pass the same value the dispatcher used (`reactjs`, `nextjs`, `react-router`, or `astro`):

```bash
npx @cometchat/skills-cli state record \
  --framework "<framework>" \
  --auth-mode "production" \
  --files-owned "<token-endpoint-path>,<user-endpoint-path>" \
  --files-patched "<provider-path>:v3/production-auth" \
  --json
```

Before running this, check what's already in `.cometchat/state.json` with `cometchat state show --json`. The initial integration already recorded Phase A files; pass only the NEW files production-auth adds (the token endpoint, the user endpoint) and the provider file you repatched — otherwise you'll clobber the existing records.

Then save config:

```bash
npx @cometchat/skills-cli config save --auth-mode production --json
```

### Step 9 — Tell the user what changed and what's next

> "Production auth is wired. Quick summary:
>
> - Token endpoint at `<path>` — mints a per-user token from your backend.
> - Client login now calls `loginWithAuthToken()` with a token fetched from the endpoint.
> - REST API key lives in `<env-file>` as `COMETCHAT_AUTH_TOKEN` (server-only).
> - *(if applicable)* User sign-up hook updated to mirror users into CometChat.
>
> Before shipping:
> 1. Set `COMETCHAT_AUTH_TOKEN` in your production environment (Vercel / Netlify / your host's env settings).
> 2. Remove the dev `AUTH_KEY` from the production environment — it's no longer used.
> 3. Sign in as a test user in production and confirm the Network tab shows the token endpoint returning 200 with a token."

Then return to the iteration menu.

## Auth-system adapter quick reference

When the user's `authSystem` from config is known, use this table to pick the right `getAuthenticatedUser()` shape for Step 3. Don't invent — if the user's setup doesn't match, ask.

| authSystem | How to read the logged-in user on the server |
|---|---|
| `next-auth` (v5) | `const session = await auth(); session?.user?.id` |
| `next-auth` (v4) | `const session = await getServerSession(authOptions); session?.user?.id` |
| `clerk` | `import { currentUser, auth } from "@clerk/nextjs/server"; const { userId } = auth();` |
| `supabase` | `const { data: { user } } = await supabase.auth.getUser()` (using server client with request cookies) |
| `firebase` | Verify the ID token on the server: `await getAuth().verifyIdToken(idToken)` — client must send the token |
| `passport` | `req.user` if session middleware is set; or verify JWT from `Authorization: Bearer` header |
| `jwt` | Read `Authorization: Bearer <jwt>`, verify with the signing key, extract the subject claim |
| `none` | Stop and tell the user: "You don't have an auth system yet. Add one first (NextAuth / Clerk / Supabase / Firebase) before wiring production auth. Want me to set one up?" |

## Error handling

If the REST API returns a non-2xx:

| Status | Meaning | Fix |
|---|---|---|
| 401 | Invalid `apiKey` header | Re-copy REST API Key from dashboard; confirm it's the REST key, not the client Auth Key |
| 404 | User with `uid` doesn't exist when minting token | Create the user first (Step 5 POST) or fall back to on-the-fly create by minting without pre-create |
| 409 | User already exists (on POST create) | Treat as success — it's the idempotent path |
| 5xx | CometChat infra issue | Surface the error, don't retry in a tight loop |

Never retry 4xx errors automatically — they're configuration mistakes that retrying won't fix.

## What NOT to do

- Don't ship the REST API key to the browser under ANY variable name or prefix.
- Don't cache the token across users — always mint per login.
- Don't call `loginWithAuthToken` before your app's own auth has a real user — you'll mint a token for `undefined` or an anonymous ID and then not be able to recover.
- Don't keep `CometChatUIKit.login(uid)` as a fallback in production code. The whole point is to remove it. If you need to keep dev-mode alive for staging, put the whole block behind a build-time flag, not a runtime string.
- Don't generate sign-up / update / delete endpoints the user didn't ask for. Each one is a lifecycle commitment — only wire the flows the user confirmed in Step 5.
