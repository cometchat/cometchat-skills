---
name: cometchat-native-production
description: "Production-readiness for React Native — server-minted auth tokens, user management CRUD, external-backend recipes (Express / Hono / Firebase Functions / Vercel Serverless). RN has no API routes, so the backend is always external."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native production auth token security user-management rest-api"
---

## Purpose

Teaches Claude how to move a React Native CometChat integration from dev-mode Auth Key to production-ready server-minted auth tokens + user CRUD. Covers:

1. Why the dev `authKey` can't ship to production
2. Auth Key vs REST API Key — which lives where
3. Server endpoint recipes (Express / Hono / Firebase Functions / Vercel)
4. Client-side: `CometChatUIKit.login({ authToken })` + token refresh
5. User CRUD endpoints + auth-provider integration (Firebase Auth / Supabase / Clerk / Auth0)
6. Security checklist + rate limits

**Read `cometchat-native-core` first** (init/login/wrapper chain) before this skill — production just swaps one prop on the provider, but understanding the provider lifecycle is the prerequisite.

Ground truth: `docs/ui-kit/react-native/methods.mdx`, and the cross-platform REST API at `https://{APP_ID}.api-{REGION}.cometchat.io/v3/`.

---

## 1. Why production auth matters

In dev mode, `CometChatUIKit.login({ uid: "..." })` uses the `authKey` passed to `CometChatUIKit.init({ authKey })`. That key is embedded in your React Native bundle. For a signed iOS `.ipa` or Android `.apk`/`.aab`, anyone can extract it with standard reverse-engineering tools (unzip, strings, `apktool`, `ReverseAPK`) and use it to log in as **ANY** user in your CometChat app — read private messages, send as other users, access every conversation.

Production MUST use server-side token generation:

- Your **server** holds the REST API Key (a different key from the client Auth Key).
- On user login, your server calls CometChat's REST API with the REST API Key to mint a short-lived **Auth Token** for that specific UID.
- Your client receives the Auth Token and calls `CometChatUIKit.login({ authToken })`.
- If the token leaks, the blast radius is one user session, not your whole app.

**Exactly the same threat model as JWTs for a REST API.** If you've built a login flow before, this is that.

---

## 2. Auth Key vs REST API Key — two different keys

Easy to confuse. Both come from the CometChat Dashboard (your app → API & Auth Keys), but they live in different places and have different privileges.

| Key | Where in dashboard | Purpose | Where it lives |
|---|---|---|---|
| **Auth Key** | "Auth Keys" table | Client-side SDK `login({ uid })` in dev mode | **Client bundle** — dev only. Never in production builds. |
| **REST API Key** | "REST API Keys" table | Server-to-server: token generation, user CRUD, custom-message-send | **Server only.** Never in an RN bundle, `app.json extra`, `EXPO_PUBLIC_*` var, or git-committed file. |

If the project only has an Auth Key, the user needs to generate a REST API Key in the dashboard: **API & Auth Keys → REST API Keys → Add Key**. Pick "Full Access" for server-side use.

---

## 3. The token auth pattern (4 steps)

```
1. Client logs into YOUR auth (Firebase Auth / Supabase / Clerk / Auth0 / custom)
   ↓
2. Client asks YOUR backend for a CometChat auth token
   ↓ (POST /api/cometchat-token { uid })
3. Backend calls CometChat REST API → gets an Auth Token for that UID
   ↓ POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens
     with header apiKey: <REST_API_KEY>
   ↓
4. Client calls CometChatUIKit.login({ authToken: "..." })
```

The RN client never sees the REST API Key. The server never ships a password or email to the client. The CometChat SDK holds the auth token, not a static key.

---

## 4. Server endpoint recipes

RN projects don't have Next.js-style API routes. You need a separate backend. Pick the one the user already has, or the simplest if they're starting fresh.

### 4a. Express (Node.js backend)

```ts
// server/routes/cometchat-token.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";   // your existing auth

const router = Router();
const APP_ID = process.env.COMETCHAT_APP_ID!;
const REGION = process.env.COMETCHAT_REGION!;
const REST_API_KEY = process.env.COMETCHAT_REST_API_KEY!;

router.post("/cometchat-token", requireAuth, async (req, res) => {
  // Derive UID from authenticated session — NOT from the request body in prod.
  const uid = req.user.id;

  const r = await fetch(
    `https://${APP_ID}.api-${REGION}.cometchat.io/v3/users/${encodeURIComponent(uid)}/auth_tokens`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        appId: APP_ID,
        apiKey: REST_API_KEY,
      },
      body: JSON.stringify({}),
    },
  );

  if (!r.ok) {
    const error = await r.text();
    console.error("CometChat token error:", error);
    return res.status(r.status).json({ error: "Failed to generate auth token" });
  }

  const data = await r.json();
  return res.json({ authToken: data.data.authToken });
});

export default router;
```

### 4b. Hono (Cloudflare Workers / Bun / Node)

```ts
// server/cometchat-token.ts
import { Hono } from "hono";

const app = new Hono();

app.post("/api/cometchat-token", async (c) => {
  const user = c.get("user");   // your middleware-resolved user
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const APP_ID = c.env.COMETCHAT_APP_ID;
  const REGION = c.env.COMETCHAT_REGION;
  const REST_API_KEY = c.env.COMETCHAT_REST_API_KEY;

  const r = await fetch(
    `https://${APP_ID}.api-${REGION}.cometchat.io/v3/users/${encodeURIComponent(user.id)}/auth_tokens`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        appId: APP_ID,
        apiKey: REST_API_KEY,
      },
      body: JSON.stringify({}),
    },
  );

  if (!r.ok) return c.json({ error: "token mint failed" }, 502);
  const data = await r.json();
  return c.json({ authToken: data.data.authToken });
});

export default app;
```

### 4c. Firebase Cloud Functions

```ts
// functions/src/cometchat-token.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";

export const getCometChatToken = onCall(
  { secrets: ["COMETCHAT_APP_ID", "COMETCHAT_REGION", "COMETCHAT_REST_API_KEY"] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const uid = request.auth.uid;

    const APP_ID = process.env.COMETCHAT_APP_ID!;
    const REGION = process.env.COMETCHAT_REGION!;
    const REST_API_KEY = process.env.COMETCHAT_REST_API_KEY!;

    const r = await fetch(
      `https://${APP_ID}.api-${REGION}.cometchat.io/v3/users/${encodeURIComponent(uid)}/auth_tokens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          appId: APP_ID,
          apiKey: REST_API_KEY,
        },
        body: JSON.stringify({}),
      },
    );

    if (!r.ok) throw new HttpsError("internal", "token mint failed");
    const data = await r.json();
    return { authToken: data.data.authToken };
  },
);
```

Client call:

```tsx
import functions from "@react-native-firebase/functions";
const result = await functions().httpsCallable("getCometChatToken")();
const authToken = result.data.authToken;
```

### 4d. Vercel Serverless / Next.js API Route

Even if the RN app isn't Next.js, the user's existing web app often is. Reuse the same backend:

```ts
// pages/api/cometchat-token.ts  (or app/api/cometchat-token/route.ts)
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "unauthorized" });

  const APP_ID = process.env.COMETCHAT_APP_ID!;
  const REGION = process.env.COMETCHAT_REGION!;
  const REST_API_KEY = process.env.COMETCHAT_REST_API_KEY!;
  const uid = session.user.id;

  const r = await fetch(
    `https://${APP_ID}.api-${REGION}.cometchat.io/v3/users/${encodeURIComponent(uid)}/auth_tokens`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", appId: APP_ID, apiKey: REST_API_KEY },
      body: JSON.stringify({}),
    },
  );

  if (!r.ok) return res.status(502).json({ error: "token mint failed" });
  const data = await r.json();
  return res.json({ authToken: data.data.authToken });
}
```

---

## 5. Client-side: `CometChatUIKit.login({ authToken })`

Once the server is serving tokens, update the RN client to fetch the token and use it. This is a change to the `CometChatProvider` (see `cometchat-native-core` § 6) — swap the `uid` prop for an `authToken` prop.

### 5a. Update the provider to support authToken

```tsx
// CometChatProvider.tsx — production-aware version
import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CometChatUIKit } from "@cometchat/chat-uikit-react-native";

let initialized = false;
let loginInFlight: Promise<unknown> | null = null;

async function ensureLoggedIn(authToken?: string, uid?: string): Promise<void> {
  const existing = await CometChatUIKit.getLoggedInUser();
  if (existing) return;
  if (loginInFlight) {
    await loginInFlight;
    return;
  }
  // Production — prefer authToken
  if (authToken) {
    loginInFlight = CometChatUIKit.login({ authToken });
  } else if (uid) {
    loginInFlight = CometChatUIKit.login({ uid });   // dev fallback
  } else {
    return;  // nothing to log in with yet
  }
  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

interface Props {
  appId: string;
  region: string;
  authKey?: string;      // dev only; omit in production
  authToken?: string;    // production — from your backend
  uid?: string;          // dev only
  children: ReactNode;
}

export function CometChatProvider({ appId, region, authKey, authToken, uid, children }: Props) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        if (!initialized) {
          initialized = true;
          await CometChatUIKit.init({
            appId,
            region,
            subscriptionType: "ALL_USERS",
            ...(authKey ? { authKey } : {}),
          });
        }
        await ensureLoggedIn(authToken, uid);
        setIsReady(true);
      } catch (e) {
        setError(String(e));
      }
    }
    setup();
  }, [appId, region, authKey, authToken, uid]);

  if (!isReady) return null;
  return <>{children}</>;
}
```

**Push registration lands here** — right after `ensureLoggedIn` resolves,
before `setIsReady(true)`. The CometChat SDK scopes push tokens to the
logged-in user, so registering before login associates the token with
"anonymous" and the device won't receive pushes.

```tsx
import { bootstrapPushAfterLogin } from "../push/bootstrap";
//...
await ensureLoggedIn(authToken, uid);
await bootstrapPushAfterLogin();   // registers FCM/APNs token with CometChat
setIsReady(true);
```

And unregister BEFORE `CometChatUIKit.logout()` — the SDK needs the user
context to dissociate the token. See `cometchat-native-push § 7` for
the full `bootstrapPushAfterLogin` / `unregisterPushTokenOnLogout` helper
pair.

### 5b. Fetch the token from your backend

Typical app flow:

```tsx
// App.tsx
import { useState, useEffect } from "react";
import { CometChatProvider } from "./src/providers/CometChatProvider";
import { useMyAppAuth } from "./src/hooks/useMyAppAuth";   // your existing auth

export default function App() {
  const { user, isAuthenticated } = useMyAppAuth();
  const [cometChatToken, setCometChatToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setCometChatToken(null);
      return;
    }
    // Fetch a CometChat auth token from your backend
    fetch("https://api.yourapp.com/cometchat-token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.jwt}` },
    })
      .then((r) => r.json())
      .then((data) => setCometChatToken(data.authToken))
      .catch((e) => console.error("CometChat token fetch failed:", e));
  }, [isAuthenticated, user?.jwt]);

  if (!isAuthenticated) return <LoginScreen />;
  if (!cometChatToken) return <LoadingScreen message="Connecting chat..." />;

  return (
    <CometChatProvider
      appId={COMETCHAT_APP_ID}
      region={COMETCHAT_REGION}
      authToken={cometChatToken}
      // no authKey prop in production
    >
      <AppNavigator />
    </CometChatProvider>
  );
}
```

### 5c. Handle token expiry / refresh

Auth tokens have a configurable TTL (default 24 hours). On token expiry, SDK calls start failing. Handle this by re-minting on 401:

```tsx
useEffect(() => {
  const LISTENER_ID = "TOKEN_EXPIRY_LISTENER";
  CometChat.addConnectionListener(
    LISTENER_ID,
    new CometChat.ConnectionListener({
      onDisconnected: async () => {
        // Connection dropped. Token might be expired.
        // Re-fetch and re-login.
        const freshToken = await fetchCometChatToken(user.jwt);
        setCometChatToken(freshToken);
        await CometChatUIKit.login({ authToken: freshToken });
      },
    }),
  );
  return () => CometChat.removeConnectionListener(LISTENER_ID);
}, [user?.jwt]);
```

A simpler approach for apps that can tolerate a forced re-login: on any 401 from the SDK, log the user out and force them through your app's sign-in flow again.

---

## 6. User management CRUD

When someone signs up in your app, you need to create a matching CometChat user. Same for profile updates (name/avatar change) and deletion. These happen on your backend, using the REST API with the REST API Key.

### 6a. Create a user on signup

```ts
async function createCometChatUser(uid: string, name: string, avatarUrl?: string) {
  const r = await fetch(
    `https://${APP_ID}.api-${REGION}.cometchat.io/v3/users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        appId: APP_ID,
        apiKey: REST_API_KEY,
      },
      body: JSON.stringify({
        uid,
        name,
        avatar: avatarUrl,
      }),
    },
  );
  if (!r.ok) throw new Error(`CometChat user create failed: ${await r.text()}`);
  return r.json();
}
```

### 6b. Update a user on profile change

```ts
async function updateCometChatUser(uid: string, updates: Partial<{ name: string; avatar: string; metadata: any }>) {
  const r = await fetch(
    `https://${APP_ID}.api-${REGION}.cometchat.io/v3/users/${encodeURIComponent(uid)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        appId: APP_ID,
        apiKey: REST_API_KEY,
      },
      body: JSON.stringify(updates),
    },
  );
  if (!r.ok) throw new Error(`CometChat user update failed: ${await r.text()}`);
  return r.json();
}
```

### 6c. Delete a user on account deletion

```ts
async function deleteCometChatUser(uid: string) {
  const r = await fetch(
    `https://${APP_ID}.api-${REGION}.cometchat.io/v3/users/${encodeURIComponent(uid)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        appId: APP_ID,
        apiKey: REST_API_KEY,
      },
      body: JSON.stringify({ permanent: true }),
    },
  );
  if (!r.ok) throw new Error(`CometChat user delete failed: ${await r.text()}`);
}
```

### 6d. Where to wire these calls

The CRUD functions live on your backend; you call them from your existing auth event handlers:

| Auth event | When to call | Function |
|---|---|---|
| User signs up | After your app's user creation succeeds | `createCometChatUser(newUser.id, newUser.name, newUser.avatarUrl)` |
| User updates name or avatar | After your app's profile update succeeds | `updateCometChatUser(user.id, { name, avatar })` |
| User deletes account | Before/after your app's user deletion | `deleteCometChatUser(user.id)` |

---

## 7. Auth-provider integration recipes

Your RN app's auth layer typically comes from one of these SDKs. How to wire CometChat into each:

### 7a. Firebase Auth

Firebase issues a UID per user. Use that same UID in CometChat.

```ts
// Backend (Firebase Cloud Function)
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onUserCreated, onUserDeleted } from "firebase-functions/v2/auth";

export const onSignup = onUserCreated(async (event) => {
  const { uid, displayName, photoURL } = event.data;
  await createCometChatUser(uid, displayName ?? "User", photoURL);
});

export const onAccountDelete = onUserDeleted(async (event) => {
  await deleteCometChatUser(event.data.uid);
});

// Profile updates are app-level — hook into your profile-update handler
```

Client — get the Firebase ID token, send to your `cometchat-token` endpoint:

```tsx
import auth from "@react-native-firebase/auth";
const idToken = await auth().currentUser!.getIdToken();
const r = await fetch("/api/cometchat-token", {
  method: "POST",
  headers: { Authorization: `Bearer ${idToken}` },
});
const { authToken } = await r.json();
```

### 7b. Supabase Auth

Supabase also issues a UID. Use it as the CometChat UID.

```ts
// Backend — Supabase Edge Function triggered on signup
Deno.serve(async (req) => {
  const event = await req.json();
  if (event.type === "INSERT" && event.table === "users") {
    const { id, email } = event.record;
    await createCometChatUser(id, email.split("@")[0]);
  }
  return new Response("ok");
});
```

Client:

```tsx
import { supabase } from "./supabase";
const { data: { session } } = await supabase.auth.getSession();
const r = await fetch("/api/cometchat-token", {
  method: "POST",
  headers: { Authorization: `Bearer ${session!.access_token}` },
});
```

### 7c. Clerk Expo

Clerk is Expo-friendly and has its own webhooks for user lifecycle events.

```tsx
// Client — React Native
import { useAuth } from "@clerk/clerk-expo";
const { getToken, userId } = useAuth();
const jwt = await getToken();
const r = await fetch("/api/cometchat-token", {
  method: "POST",
  headers: { Authorization: `Bearer ${jwt}` },
});
```

Backend — use a Clerk webhook to trigger CRUD on user lifecycle events.

### 7d. Auth0

```tsx
import { useAuth0 } from "react-native-auth0";
const { getCredentials } = useAuth0();
const { accessToken } = await getCredentials();
const r = await fetch("/api/cometchat-token", {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

Backend — use Auth0 Actions or Rules to trigger CRUD webhooks.

### 7e. Custom JWT / bespoke auth

If the user's auth is custom (their own JWT), the pattern is the same: client includes `Authorization: Bearer <jwt>`, server validates + extracts UID + mints CometChat auth token.

---

## 8. Environment variables — split between client + server

| Variable | Location | Visibility |
|---|---|---|
| `COMETCHAT_APP_ID` | Client AND server | OK client-side |
| `COMETCHAT_REGION` | Client AND server | OK client-side |
| `COMETCHAT_AUTH_KEY` | **Dev client only.** Remove from production. | Should NEVER ship in a production RN bundle |
| `COMETCHAT_REST_API_KEY` | **Server only.** Your backend's env. | Never ships to client, ever |
| `COMETCHAT_TOKEN_ENDPOINT` | Client | Your backend URL (e.g. `https://api.yourapp.com/cometchat-token`) — safe in client bundle |

### Production RN client `.env` (or app.json extra):

```
COMETCHAT_APP_ID=your_app_id
COMETCHAT_REGION=us
COMETCHAT_TOKEN_ENDPOINT=https://api.yourapp.com/cometchat-token
# No COMETCHAT_AUTH_KEY in production
# No COMETCHAT_REST_API_KEY — server-only
```

### Server `.env`:

```
COMETCHAT_APP_ID=your_app_id
COMETCHAT_REGION=us
COMETCHAT_REST_API_KEY=your_rest_api_key
```

---

## 9. Security checklist

Before releasing to production, verify:

- [ ] `COMETCHAT_AUTH_KEY` removed from client `.env` / `app.json extra` / any `EXPO_PUBLIC_*` var
- [ ] Production provider uses `authToken` prop, not `authKey`
- [ ] `COMETCHAT_REST_API_KEY` lives only on your backend (check with `grep -r REST_API_KEY src/`)
- [ ] Token endpoint is behind auth — unauthenticated users can't mint a token for an arbitrary UID
- [ ] UID derivation on the token endpoint comes from the authenticated session, NOT from the request body (otherwise anyone can mint a token for anyone)
- [ ] Rate limit on the token endpoint (prevents abuse)
- [ ] HTTPS-only — no HTTP in production
- [ ] User CRUD endpoints are authenticated (or called from webhooks with signature verification)
- [ ] CometChat user deletion happens on account deletion (GDPR / privacy compliance)

---

## 10. Rate limits + retry

CometChat's REST API has rate limits per app. For the token endpoint:

- Default: 100 requests/minute per app
- Token generation is cheap — if you're hitting limits, you're likely minting too often (e.g. one mint per RN screen mount). Mint once per sign-in, cache client-side, reuse until expiry.

Retry policy:

- 5xx — retry with exponential backoff (1s, 2s, 4s, give up)
- 4xx — do NOT retry. Surface the error.

---

## 11. Anti-patterns

1. **NEVER ship the REST API Key in an RN bundle.** Not under any env-var name or prefix. Not in `app.json extra`. Not in `EXPO_PUBLIC_*`. Not in a .gitignored file the user commits by accident. If you see yourself writing an env var for `REST_API_KEY` in a client-side config, stop.

2. **NEVER let the client specify the UID to mint a token for.** The server must derive UID from the authenticated session. A `POST /cometchat-token { uid: "..." }` that trusts the body is equivalent to no auth — anyone can impersonate anyone.

3. **Don't cache the auth token to disk forever.** It expires. Either re-mint on every cold start or store with a short TTL and refresh on 401.

4. **Don't use `login({ uid })` in production.** `uid` mode requires an Auth Key on the UIKit settings. In production you should set neither `authKey` on the UIKitSettings nor call `login({ uid })` — both are dev-only patterns.

5. **Don't forget user CRUD.** A user who signs up in your app but has no matching CometChat user will get "user does not exist" errors on `login({ authToken })`. The token endpoint mints tokens, but the user must already exist in CometChat.

6. **Don't skip the security checklist.** Production bugs in auth are catastrophic.

7. **Don't retry 4xx errors.** Token-endpoint 400s are config mistakes (wrong REST API Key, malformed UID, etc.). Retrying makes it worse.

---

## 12. Verifying production auth works

1. Build a production-configuration version of the app (no Auth Key, only AppId + Region + token endpoint).
2. Log in as a real user through your app's normal flow.
3. In the RN debugger network tab, confirm `POST /cometchat-token` returns `{ authToken: "..." }`.
4. Confirm `CometChatUIKit.login({ authToken })` resolves.
5. Send a message — verify delivery.
6. Force-close the app, reopen — token fetch + login should happen again on cold start.
7. (Optional) Wait out the token TTL (default 24hr), verify the 401-refresh path works.

If any step fails, see `cometchat-native-troubleshooting` § Auth / Token issues.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Init / login / provider wrapper chain — prerequisite |
| `cometchat-native-components` | The base component props (nothing production-specific there) |
| `cometchat-native-placement` | Where your chat UI goes (no change in production) |
| `cometchat-native-expo-patterns` | Expo-specific env var wiring (`expo-constants` vs `EXPO_PUBLIC_*`) |
| `cometchat-native-bare-patterns` | Bare RN env var wiring (`react-native-config`) |
| `cometchat-native-theming` | Theme customization (independent of auth) |
| `cometchat-native-features` | Feature flags (polls, extensions, etc. — all still work in prod) |
| `cometchat-native-customization` | If customization depends on server-side data (user tags, metadata) |
| `cometchat-native-production` | This skill — server tokens + user CRUD |
| `cometchat-native-troubleshooting` | 401 on token fetch, "user does not exist" on login, token-endpoint rate limit |
