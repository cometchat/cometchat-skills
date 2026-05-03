---
name: cometchat-angular-production
description: "Production-readiness for Angular — server-minted auth tokens, user management CRUD, external-backend recipes (Express / Hono / Firebase Functions / Vercel). Angular has no API routes, so the backend is always external."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular production auth token security user-management rest-api"
---

## Purpose

Teaches Claude how to move an Angular CometChat integration from dev-mode Auth Key to production-ready server-minted auth tokens + user CRUD. Covers:

1. Why the dev `authKey` can't ship to production
2. Auth Key vs REST API Key — which lives where
3. Server endpoint recipes (Express / Hono / Firebase Functions / Vercel)
4. Client-side: `CometChatUIKit.login({ authToken })` + token refresh
5. User CRUD endpoints + auth-provider integration (Firebase Auth / Supabase / Clerk / Auth0)
6. Security checklist

**Read `cometchat-angular-core` first** — production just swaps one call on the init service, but understanding the init lifecycle is the prerequisite.

Ground truth: `docs/ui-kit/angular/methods`, and the cross-platform REST API at `https://{APP_ID}.api-{REGION}.cometchat.io/v3/`.

---

## 1. Why production auth matters

In dev mode, `CometChatUIKit.login({ uid: "..." })` uses the `authKey` passed to `UIKitSettingsBuilder`. That key is bundled into your Angular JavaScript. Anyone can open DevTools → Sources → search for the key string and use it to log in as **ANY** user in your CometChat app — read private messages, send as other users, access every conversation.

Production MUST use server-side token generation:

- Your **server** holds the REST API Key (a different key from the client Auth Key).
- On user login, your server calls CometChat's REST API with the REST API Key to mint a short-lived **Auth Token** for that specific UID.
- Your Angular client receives the Auth Token and calls `CometChatUIKit.login({ authToken })`.
- If the token leaks, the blast radius is one user session, not your whole app.

---

## 2. Auth Key vs REST API Key — two different keys

| Key | Where in dashboard | Purpose | Where it lives |
|---|---|---|---|
| **Auth Key** | "Auth Keys" table | Client-side SDK `login({ uid })` in dev mode | **Client bundle** — dev only. Never in production builds. |
| **REST API Key** | "REST API Keys" table | Server-to-server: token generation, user CRUD | **Server only.** Never in `environment.ts`, `environment.prod.ts`, or any Angular file. |

If the project only has an Auth Key, the user needs to generate a REST API Key in the dashboard: **API & Auth Keys → REST API Keys → Add Key**. Pick "Full Access" for server-side use.

---

## 3. The token auth pattern (4 steps)

```
1. User logs into YOUR auth (Firebase Auth / Supabase / Clerk / Auth0 / custom)
   ↓
2. Angular app asks YOUR backend for a CometChat auth token
   ↓ (POST /api/cometchat-token with Authorization: Bearer <jwt>)
3. Backend calls CometChat REST API → gets an Auth Token for that UID
   ↓ POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens
     with header apiKey: <REST_API_KEY>
   ↓
4. Angular calls CometChatUIKit.login({ authToken: "..." })
```

The Angular client never sees the REST API Key. The server never ships a password or email to the client.

---

## 4. Server endpoint recipes

Angular projects don't have built-in API routes. You need a separate backend.

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
  const uid = req.user.id;  // from authenticated session — NOT from request body

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
    return res.status(r.status).json({ error: "Failed to generate auth token" });
  }

  const data = await r.json();
  return res.json({ authToken: data.data.authToken });
});

export default router;
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
    // 1. Check if already logged in
    const existing = await CometChatUIKit.getLoggedinUser();
    if (existing) return;

    // 2. Fetch CometChat auth token from your backend
    const response = await firstValueFrom(
      this.http.post<{ authToken: string }>(
        environment.cometchat.tokenEndpoint,
        {},
        { headers: new HttpHeaders({ Authorization: `Bearer ${appJwt}` }) }
      )
    );

    // 3. Login with the auth token
    await CometChatUIKit.login({ authToken: response.authToken });
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
import { YourAuthService } from "./your-auth.service";  // your existing auth

@Component({ selector: "app-root", templateUrl: "./app.component.html" })
export class AppComponent implements OnInit {
  isReady = false;

  constructor(
    private cometChatAuth: CometChatAuthService,
    private yourAuth: YourAuthService
  ) {}

  ngOnInit(): void {
    // CometChat.init() already called via APP_INITIALIZER
    this.yourAuth.getJwt().then((jwt) => {
      return this.cometChatAuth.loginWithToken(jwt);
    }).then(() => {
      this.isReady = true;
    }).catch(console.error);
  }
}
```

### Production environment file

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  cometchat: {
    appId: "YOUR_APP_ID",
    region: "us",
    // No authKey in production
    tokenEndpoint: "https://api.yourapp.com/cometchat-token",
  },
};
```

---

## 6. User management CRUD

When someone signs up in your app, create a matching CometChat user on your backend.

### 6a. Create a user on signup

```typescript
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
      body: JSON.stringify({ uid, name, avatar: avatarUrl }),
    }
  );
  if (!r.ok) throw new Error(`CometChat user create failed: ${await r.text()}`);
  return r.json();
}
```

### 6b. Update a user on profile change

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

### 6c. Delete a user on account deletion

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

---

## 7. Environment variables — split between client + server

| Variable | Location | Visibility |
|---|---|---|
| `COMETCHAT_APP_ID` | `environment.ts` + server | OK client-side |
| `COMETCHAT_REGION` | `environment.ts` + server | OK client-side |
| `COMETCHAT_AUTH_KEY` | **Dev `environment.ts` only.** Remove from `environment.prod.ts`. | Should NEVER ship in a production Angular build |
| `COMETCHAT_REST_API_KEY` | **Server only.** Your backend's env. | Never in any Angular file, ever |
| `COMETCHAT_TOKEN_ENDPOINT` | `environment.prod.ts` | Your backend URL — safe in client bundle |

---

## 8. Security checklist

Before releasing to production:

- [ ] `authKey` removed from `environment.prod.ts`
- [ ] Production init uses `UIKitSettingsBuilder` without `.setAuthKey()`
- [ ] Production login uses `CometChatUIKit.login({ authToken })`, not `login({ uid })`
- [ ] `COMETCHAT_REST_API_KEY` lives only on your backend (check with `grep -r REST_API_KEY src/`)
- [ ] Token endpoint is behind auth — unauthenticated users can't mint a token for an arbitrary UID
- [ ] UID derivation on the token endpoint comes from the authenticated session, NOT from the request body
- [ ] Rate limit on the token endpoint (prevents abuse)
- [ ] HTTPS-only — no HTTP in production
- [ ] User CRUD endpoints are authenticated (or called from webhooks with signature verification)
- [ ] CometChat user deletion happens on account deletion (GDPR / privacy compliance)

---

## 9. Anti-patterns

1. **NEVER put the REST API Key in any Angular file.** Not in `environment.ts`, `environment.prod.ts`, `assets/`, or any TypeScript file. Angular bundles everything in `src/` into the client JavaScript.

2. **NEVER let the client specify the UID to mint a token for.** The server must derive UID from the authenticated session. A `POST /cometchat-token { uid: "..." }` that trusts the body is equivalent to no auth.

3. **Don't cache the auth token to localStorage forever.** It expires. Either re-mint on every cold start or store with a short TTL and refresh on 401.

4. **Don't use `login({ uid })` in production.** `uid` mode requires an Auth Key on the UIKitSettings. In production, set neither `authKey` on the builder nor call `login({ uid })`.

5. **Don't forget user CRUD.** A user who signs up in your app but has no matching CometChat user will get "user does not exist" errors on `login({ authToken })`.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Init / login / module setup — prerequisite |
| `cometchat-angular-components` | The base component props |
| `cometchat-angular-placement` | Where your chat UI goes |
| `cometchat-angular-patterns` | Angular-specific auth guard + APP_INITIALIZER |
| `cometchat-angular-theming` | Theme customization |
| `cometchat-angular-features` | Feature flags |
| `cometchat-angular-customization` | If customization depends on server-side data |
| `cometchat-angular-production` | This skill — server tokens + user CRUD |
| `cometchat-angular-troubleshooting` | 401 on token fetch, "user does not exist" on login |
