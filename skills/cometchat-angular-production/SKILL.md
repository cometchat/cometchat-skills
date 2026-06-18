---
name: cometchat-angular-production
description: "Production-readiness for CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) — server-minted auth tokens via CometChatUIKit.loginWithAuthToken(authToken), user management CRUD, environment.prod.ts hardening (no authKey, no REST API Key), external-backend recipes (Express / Hono / Firebase Functions / Vercel), and the security checklist. Angular ships src/ to the client, so the REST API Key is always server-only."
license: "MIT"
compatibility: "Angular >=17 <22; @cometchat/chat-uikit-angular ^5.0; @cometchat/chat-sdk-javascript ^4.1"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular production auth token security user-management rest-api v5 standalone"
---

## Purpose

Teaches Claude how to move a CometChat **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`) integration from dev-mode Auth Key to production-ready server-minted auth tokens + user CRUD. Covers:

1. Why the dev `authKey` can't ship to production
2. Auth Key vs REST API Key — which lives where
3. The token auth pattern (4 steps)
4. Server endpoint recipes (Express / Hono / Firebase Functions / Vercel) — Angular has no API routes, so the backend is always external
5. Client-side: `CometChatUIKit.loginWithAuthToken(authToken)` + token refresh
6. User CRUD — the REST API (production path) and the client helpers (`CometChatUIKit.createUser` / `updateUser`)
7. Environment files (`environment.ts` → `environment.prod.ts`) + production build
8. Security checklist

**Read `cometchat-angular-core` first** — production just swaps one call on the init/login flow, but understanding the standalone `init → login → render` lifecycle is the prerequisite.

Ground truth: `@cometchat/chat-uikit-angular@5.0.2` source (`projects/cometchat-uikit/src/lib/cometchat-uikit.ts` — the `CometChatUIKit` class with both static and injectable APIs), the sample-app login flow (`projects/sample-app/src` — `main.ts` init, `services/auth.service.ts` login/logout), `docs/ui-kit/angular/integration.mdx` + `docs/fundamentals/user-auth`, and the cross-platform REST API at `https://{APP_ID}.api-{REGION}.cometchat.io/v3/`. Verify any non-obvious symbol against the kit source before relying on it. **Official docs:** https://www.cometchat.com/docs/fundamentals/user-auth · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).

---

## 1. Why production auth matters

In dev mode, `CometChatUIKit.login(uid)` uses the `authKey` passed to `UIKitSettingsBuilder.setAuthKey()`. That key is bundled into your Angular JavaScript. Anyone can open DevTools → Sources → search for the key string and use it to log in as **ANY** user in your CometChat app — read private messages, send as other users, access every conversation.

Production MUST use server-side token generation:

- Your **server** holds the REST API Key (a different key from the client Auth Key).
- On user login, your server calls CometChat's REST API with the REST API Key to mint a short-lived **Auth Token** for that specific UID.
- Your Angular client receives the Auth Token and calls `CometChatUIKit.loginWithAuthToken(authToken)`.
- If the token leaks, the blast radius is one user session, not your whole app.

The dev `setAuthKey()` call MUST NOT ship in production builds. See §7 for the `environment.prod.ts` swap.

---

## 2. Auth Key vs REST API Key — two different keys

| Key | Where in dashboard | Purpose | Where it lives |
|---|---|---|---|
| **Auth Key** | API & Auth Keys → "Auth Keys" table | Client-side SDK `login(uid)` in dev mode | **Client bundle** — dev only. Never in production builds. |
| **REST API Key** | API & Auth Keys → "REST API Keys" table | Server-to-server: token generation, user CRUD | **Server only.** Never in `environment.ts`, `environment.prod.ts`, or any file under `src/`. |

If the project only has an Auth Key, the user needs to generate a REST API Key in the dashboard: **API & Auth Keys → REST API Keys → Add Key**. Pick "Full Access" for server-side use.

**Why this matters more in Angular than elsewhere:** Angular has no server runtime and no `process.env` split. Everything under `src/` — including both `environment.ts` files — is compiled into the client bundle. There is no framework-prefix convention (`NEXT_PUBLIC_`, `VITE_`) that decides client vs server. So the rule is absolute: the REST API Key never appears in any Angular source file.

---

## 3. The token auth pattern (4 steps)

```
1. User logs into YOUR auth (Firebase Auth / Supabase / Clerk / Auth0 / custom)
   ↓
2. Angular app asks YOUR backend for a CometChat auth token
   ↓ (POST /api/cometchat-token with Authorization: Bearer <your-jwt>)
3. Backend calls CometChat REST API → gets an Auth Token for that UID
   ↓ POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens
     with header apiKey: <REST_API_KEY>
   ↓
4. Angular calls CometChatUIKit.loginWithAuthToken(authToken)
```

The Angular client never sees the REST API Key. The backend derives the UID from the authenticated session — never from the request body (see anti-patterns §9).

The CometChat REST API requires two headers on every server-to-server call:
- `appId` — your CometChat app ID
- `apiKey` — your **REST API Key** (NOT the Auth Key used in dev mode)

---

## 4. Server endpoint recipes

Angular projects have **no built-in API routes**. You need a separate backend. The token endpoint does the same thing in every recipe:

1. Validate the caller is authenticated (your existing auth middleware/guard).
2. Derive the UID from the authenticated session.
3. POST to `https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens` with the `apiKey` header.
4. Return `{ authToken }` to the client.

### 4a. Express (Node.js backend)

```typescript
// server/routes/cometchat-token.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();
const APP_ID = process.env.COMETCHAT_APP_ID!;
const REGION = process.env.COMETCHAT_REGION!;
const REST_API_KEY = process.env.COMETCHAT_REST_API_KEY!;

router.post("/cometchat-token", requireAuth, async (req, res) => {
  const uid = req.user.id; // from authenticated session — NOT from request body

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
    }
  );

  if (!r.ok) {
    console.error("CometChat token error:", await r.text());
    return res.status(r.status).json({ error: "Failed to generate auth token" });
  }

  const data = await r.json();
  return res.json({ authToken: data.data.authToken });
});

export default router;
```

Enable CORS for your Angular origin (e.g. `http://localhost:4200` in dev) so the browser can call this endpoint:

```typescript
import cors from "cors";
app.use(cors({ origin: "http://localhost:4200" }));
```

### 4b. Hono (Cloudflare Workers / Bun / Node)

```typescript
import { Hono } from "hono";

const app = new Hono();

app.post("/api/cometchat-token", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const r = await fetch(
    `https://${c.env.COMETCHAT_APP_ID}.api-${c.env.COMETCHAT_REGION}.cometchat.io/v3/users/${encodeURIComponent(user.id)}/auth_tokens`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        appId: c.env.COMETCHAT_APP_ID,
        apiKey: c.env.COMETCHAT_REST_API_KEY,
      },
      body: JSON.stringify({}),
    }
  );

  if (!r.ok) return c.json({ error: "token mint failed" }, 502);
  const data = await r.json();
  return c.json({ authToken: data.data.authToken });
});
```

### 4c. Firebase Cloud Functions

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";

export const getCometChatToken = onCall(
  { secrets: ["COMETCHAT_APP_ID", "COMETCHAT_REGION", "COMETCHAT_REST_API_KEY"] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const uid = request.auth.uid;

    const r = await fetch(
      `https://${process.env.COMETCHAT_APP_ID}.api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users/${encodeURIComponent(uid)}/auth_tokens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          appId: process.env.COMETCHAT_APP_ID!,
          apiKey: process.env.COMETCHAT_REST_API_KEY!,
        },
        body: JSON.stringify({}),
      }
    );

    if (!r.ok) throw new HttpsError("internal", "token mint failed");
    const data = await r.json();
    return { authToken: data.data.authToken };
  }
);
```

### 4d. Vercel Serverless / Next.js API Route

```typescript
// pages/api/cometchat-token.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "unauthorized" });

  const uid = session.user.id;
  const r = await fetch(
    `https://${process.env.COMETCHAT_APP_ID}.api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users/${encodeURIComponent(uid)}/auth_tokens`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        appId: process.env.COMETCHAT_APP_ID!,
        apiKey: process.env.COMETCHAT_REST_API_KEY!,
      },
      body: JSON.stringify({}),
    }
  );

  if (!r.ok) return res.status(502).json({ error: "token mint failed" });
  const data = await r.json();
  return res.json({ authToken: data.data.authToken });
}
```

---

## 5. Client-side: Angular service for production auth

The v5 production login call is **`CometChatUIKit.loginWithAuthToken(authToken)`** — it takes a **bare token string**, the same way v5 dev login takes a bare uid string (`CometChatUIKit.login(uid)`). Do NOT pass an object — `loginWithAuthToken({ authToken })` is a v4-ism and will not compile against the v5 types (verified: `static loginWithAuthToken(authToken: string): Promise<CometChat.User>`).

```typescript
// cometchat-auth.service.ts
import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { environment } from "../environments/environment";
import { firstValueFrom } from "rxjs";

@Injectable({ providedIn: "root" })
export class CometChatAuthService {
  constructor(private http: HttpClient) {}

  async loginWithToken(appJwt: string): Promise<void> {
    // 1. Already logged in? getLoggedInUser() (capital I) is the SYNC v5 accessor —
    //    returns CometChat.User | null from the cached BehaviorSubject, no await.
    //    (There is also an async getLoggedinUser() — lowercase i — returning
    //    Promise<CometChat.User | null>; the sample-app route guards use that one.
    //    Both are real v5 symbols; pick sync for a fast already-logged-in short-circuit.)
    if (CometChatUIKit.getLoggedInUser()) return;

    // 2. Fetch a CometChat auth token from your backend.
    const response = await firstValueFrom(
      this.http.post<{ authToken: string }>(
        environment.cometchat.tokenEndpoint,
        {},
        { headers: new HttpHeaders({ Authorization: `Bearer ${appJwt}` }) }
      )
    );

    // 3. Log in with the bare token string (v5 signature).
    await CometChatUIKit.loginWithAuthToken(response.authToken);
  }

  async logout(): Promise<void> {
    await CometChatUIKit.logout();
  }
}
```

```typescript
// app.component.ts — production-aware init
import { Component, OnInit } from "@angular/core";
import { CometChatAuthService } from "./cometchat-auth.service";
import { YourAuthService } from "./your-auth.service"; // your existing auth

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit {
  isReady = false;

  constructor(
    private cometChatAuth: CometChatAuthService,
    private yourAuth: YourAuthService
  ) {}

  ngOnInit(): void {
    // CometChatUIKit.init() already ran via APP_INITIALIZER (see cometchat-angular-core).
    this.yourAuth
      .getJwt()
      .then((jwt) => this.cometChatAuth.loginWithToken(jwt))
      .then(() => (this.isReady = true))
      .catch(console.error);
  }
}
```

Gate the chat UI on `isReady` so no `<cometchat-*>` component renders before `loginWithAuthToken` resolves.

### Token refresh on disconnect / expiry

CometChat auth tokens expire. When a token expires, the SDK disconnects. Re-mint and re-login through a single in-flight guard so concurrent triggers don't fire two logins (the SDK throws *"Please wait until the previous login request ends."* on a racing second `loginWithAuthToken`).

```typescript
// In CometChatAuthService — module/instance-level guard.
private refreshInFlight: Promise<void> | null = null;

async refreshSession(appJwt: string): Promise<void> {
  if (this.refreshInFlight) {
    await this.refreshInFlight; // another caller already triggered a refresh
    return;
  }
  this.refreshInFlight = (async () => {
    const response = await firstValueFrom(
      this.http.post<{ authToken: string }>(
        environment.cometchat.tokenEndpoint,
        {},
        { headers: new HttpHeaders({ Authorization: `Bearer ${appJwt}` }) }
      )
    );
    await CometChatUIKit.loginWithAuthToken(response.authToken);
  })();
  try {
    await this.refreshInFlight;
  } finally {
    this.refreshInFlight = null;
  }
}
```

Wire `refreshSession` to a `CometChat.addConnectionListener(...)` `onDisconnected` handler, or simply re-mint and re-login whenever a CometChat operation returns an auth error.

---

## 6. User management CRUD

In production you keep CometChat users in sync with your app's users. There are two paths:

**The production path is the REST API** (server-side, REST API Key). Create the CometChat user the moment the app user signs up — otherwise `loginWithAuthToken` fails with *"user does not exist."*

**The client helpers exist too** — `CometChatUIKit.createUser(user)` and `CometChatUIKit.updateUser(user)` are exported by the v5 kit (verified: both `(user: CometChat.User): Promise<CometChat.User>`). But they require the Auth Key on the UIKitSettings to authorize, which is exactly what you remove in production. **Treat them as a dev/admin-tool convenience, not the production user-provisioning mechanism.** Production provisioning belongs server-side via the REST API. (Note: the kit exposes `createUser`/`updateUser` only — there is no client-side `deleteUser`; deletion is REST-only.)

If you do use the client helper (e.g. a one-off admin screen running with the Auth Key), the shape is a `CometChat.User`:

```typescript
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";

const user = new CometChat.User("user-uid-1");
user.setName("Alice");
await CometChatUIKit.createUser(user); // Promise<CometChat.User>
```

### 6a. Create a user on signup (REST — production path)

```typescript
async function createCometChatUser(uid: string, name: string, avatarUrl?: string) {
  const r = await fetch(`https://${APP_ID}.api-${REGION}.cometchat.io/v3/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      appId: APP_ID,
      apiKey: REST_API_KEY,
    },
    body: JSON.stringify({ uid, name, ...(avatarUrl ? { avatar: avatarUrl } : {}) }),
  });
  if (!r.ok) {
    // 409 = user already exists — safe to ignore on re-signup.
    if (r.status === 409) return;
    throw new Error(`CometChat user create failed: ${await r.text()}`);
  }
  return r.json();
}
```

### 6b. Update a user on profile change (REST)

```typescript
async function updateCometChatUser(uid: string, updates: { name?: string; avatar?: string }) {
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
    }
  );
  if (!r.ok) throw new Error(`CometChat user update failed: ${await r.text()}`);
  return r.json();
}
```

### 6c. Delete a user on account deletion (REST only)

```typescript
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
    }
  );
  if (!r.ok) throw new Error(`CometChat user delete failed: ${await r.text()}`);
}
```

### 6d. Where to hook user CRUD into common auth providers

- **Firebase Auth** — `functions.auth.user().onCreate(...)` → `createCometChatUser`; `.onDelete(...)` → `deleteCometChatUser`. Firebase fires no event on profile change, so call `updateCometChatUser` from your profile-update endpoint.
- **Supabase** — a Database Webhook on `auth.users` (INSERT/UPDATE/DELETE) → the matching CRUD helper.
- **Clerk** — the `user.created` / `user.updated` / `user.deleted` webhook events (verify the svix signature first).
- **Auth0** — a post-registration Action / Log Stream webhook → `createCometChatUser`.

---

## 7. Environment files + production build

Angular has no `.env` / `process.env`. Config lives in `src/environments/`. The production build (`ng build --configuration production`) swaps `environment.ts` → `environment.prod.ts` via the `fileReplacements` in `angular.json`. **The split is your only lever** — anything in the active file ships to the client.

### Dev environment (Auth Key — never built for production)

```typescript
// src/environments/environment.ts (development)
export const environment = {
  production: false,
  cometchat: {
    appId: "YOUR_APP_ID",
    region: "us", // "us" | "eu" | "in"
    authKey: "YOUR_AUTH_KEY", // dev only — must NOT exist in environment.prod.ts
  },
};
```

### Production environment (no Auth Key, no REST API Key — just a token endpoint)

```typescript
// src/environments/environment.prod.ts (production)
export const environment = {
  production: true,
  cometchat: {
    appId: "YOUR_APP_ID",
    region: "us",
    // No authKey — mint auth tokens server-side and call loginWithAuthToken().
    // No REST API Key — it lives on your backend only.
    tokenEndpoint: "https://api.yourapp.com/cometchat-token",
  },
};
```

### The build swap (already in angular.json for the standard schematic)

```json
"configurations": {
  "production": {
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.prod.ts"
      }
    ]
  }
}
```

### The init builder must drop setAuthKey() in production

Because `environment.prod.ts` has no `authKey`, the `UIKitSettingsBuilder` must not call `.setAuthKey()` in a production build. Guard it:

```typescript
const builder = new UIKitSettingsBuilder()
  .setAppId(environment.cometchat.appId)
  .setRegion(environment.cometchat.region)
  .subscribePresenceForAllUsers();

// Dev only — the prod environment has no authKey, so this branch is skipped.
if (!environment.production && "authKey" in environment.cometchat) {
  builder.setAuthKey((environment.cometchat as any).authKey);
}

await CometChatUIKit.init(builder.build());
```

### Variable visibility summary

| Variable | Location | Visibility |
|---|---|---|
| `appId` | `environment.ts` + `environment.prod.ts` + backend | OK client-side |
| `region` | `environment.ts` + `environment.prod.ts` + backend | OK client-side |
| `authKey` | **Dev `environment.ts` only.** Absent from `environment.prod.ts`. | Must NEVER ship in a production Angular build |
| `tokenEndpoint` | `environment.prod.ts` | Your backend URL — safe in client bundle |
| REST API Key | **Backend env only.** Never under `src/`. | Never in any Angular file, ever |

---

## 8. Security checklist

Before releasing to production, verify every item:

- [ ] `authKey` removed from `environment.prod.ts`.
- [ ] Production init uses `UIKitSettingsBuilder` **without** `.setAuthKey()`.
- [ ] Production login uses `CometChatUIKit.loginWithAuthToken(authToken)` (bare string), **not** `login(uid)`.
- [ ] REST API Key lives only on your backend — verify with `grep -rIE "REST_API_KEY|restApiKey" src/` (must return nothing).
- [ ] Token endpoint is behind auth — unauthenticated callers can't mint a token for an arbitrary UID.
- [ ] UID is derived from the authenticated session on the backend, **not** from the request body.
- [ ] Rate limit on the token endpoint (prevents abuse / token farming).
- [ ] CORS on the token endpoint allows only your Angular origin(s).
- [ ] HTTPS-only — no HTTP in production.
- [ ] CometChat user is created (REST API) when the app user signs up — otherwise `loginWithAuthToken` fails with "user does not exist."
- [ ] User CRUD endpoints are authenticated (or invoked from webhooks with signature verification).
- [ ] CometChat user deletion runs on account deletion (GDPR / privacy compliance).
- [ ] Production build confirmed to swap `environment.ts` → `environment.prod.ts` (check `fileReplacements` in `angular.json`).

---

## 9. Anti-patterns

1. **NEVER put the REST API Key in any Angular file.** Not in `environment.ts`, `environment.prod.ts`, `assets/`, or any TypeScript under `src/`. Angular bundles everything in `src/` into client JavaScript. There is no `process.env` split to save you.

2. **NEVER let the client choose the UID to mint a token for.** The backend must derive UID from the authenticated session. A `POST /cometchat-token { uid: "..." }` that trusts the body is equivalent to no auth — any user can impersonate any other.

3. **Don't pass an object to `loginWithAuthToken`.** v5 takes a bare string: `loginWithAuthToken(token)`, mirroring `login(uid)`. `loginWithAuthToken({ authToken })` is a v4-era shape and won't typecheck against v5.

4. **Don't use `login(uid)` in production.** `uid` login requires the Auth Key on the UIKitSettings. In production set neither `.setAuthKey()` on the builder nor call `login(uid)` — use `loginWithAuthToken(token)`.

5. **Don't rely on `CometChatUIKit.createUser` / `updateUser` for production provisioning.** They authorize with the Auth Key (which you remove in production). Provision users server-side via the REST API; the kit helpers are a dev/admin convenience only. (And note: the kit has no client `deleteUser` — deletion is REST-only.)

6. **Don't cache the auth token in localStorage forever.** It expires. Re-mint on cold start, or store with a short TTL and refresh on disconnect/401 (§5).

7. **Don't forget user CRUD.** A user who signs up in your app but has no matching CometChat user gets "user does not exist" on `loginWithAuthToken`.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Init / login / standalone setup / environment — prerequisite |
| `cometchat-angular-components` | Base component props |
| `cometchat-angular-placement` | Where your chat UI goes |
| `cometchat-angular-patterns` | Standalone wiring, APP_INITIALIZER, auth guard |
| `cometchat-angular-theming` | CSS-variable theme customization |
| `cometchat-angular-features` | Feature flags |
| `cometchat-angular-calls` | Voice/video calling |
| `cometchat-angular-customization` | Customization tied to server-side data |
| `cometchat-angular-production` | This skill — server tokens + user CRUD |
| `cometchat-angular-troubleshooting` | 401 on token fetch, "user does not exist" on login |
