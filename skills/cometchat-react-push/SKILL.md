---
name: cometchat-react-push
description: Push notifications for CometChat React UI Kit v6 in Vite / Next.js / React Router / Astro projects. Recommended path is CometChat-native web push via Firebase Cloud Messaging for Web — `CometChatNotifications.registerPushToken(token, PushPlatforms.FCM_WEB)` + a dashboard FCM provider, so CometChat's own backend delivers new-message pushes with NO self-hosted push server. Also documents an optional advanced self-hosted Web Push fallback (Service Worker + Push API + VAPID + message-sent webhook) for projects that can't use Firebase. Covers click-through to chat, foreground vs background handling, iOS Safari 16.4+ PWA-only quirks, and HTTPS requirements.
license: "MIT"
compatibility: "React >= 18; @cometchat/chat-sdk-javascript ^4.1.10 (ships CometChatNotifications.registerPushToken + PushPlatforms.FCM_WEB); firebase modular SDK for FCM_WEB; Web Push API (Chrome 50+, Firefox 44+, Edge 17+, Safari 16+ desktop, Safari 16.4+ iOS PWA-only); HTTPS required (or localhost)"
metadata:
  author: "CometChat"
  version: "4.1.0"
  tags: "cometchat react web push notifications fcm-web firebase cometchatnotifications registerpushtoken service-worker vapid push-api notification-api ios-safari-pwa nextjs astro react-router"
---

## Purpose

Web push for CometChat chat — new-message notifications when the user's tab is backgrounded or closed.

**The web DOES have CometChat-native push.** The JS Chat SDK ships a first-class web-push registration API: `CometChatNotifications.registerPushToken(token, PushPlatforms.FCM_WEB)`. Paired with a Firebase Cloud Messaging (FCM) provider configured in the CometChat dashboard, **CometChat's own backend delivers the push on every new message** — no self-hosted push server, no `web-push` lib, no VAPID server of your own, and no message-sent webhook for the basic case. This is the recommended path (§1).

A self-hosted Web Push path (your own VAPID keys + push server + CometChat webhook) is documented as an advanced fallback (§7) for projects that can't or won't use Firebase. Don't reach for it unless you have to.

**Not the same as the calls Web Push.** Calls Web Push tries to ring the device through a closed tab (best-effort, browser-dependent). Chat push notifies on new messages — different payload + UX. Many apps need both.

**Read these other skills first:**
- `cometchat-core` — provider pattern, login order
- `cometchat-{react,nextjs,react-router,astro}-patterns` — framework-specific Service Worker registration
- `cometchat-react-calls/references/voip-and-web-push.md` — calls-specific Web Push (overlap with this; both can coexist)
- `cometchat-production` — server-minted auth tokens

**Ground truth (verified against the JS Chat SDK source):** **Official docs:** https://www.cometchat.com/docs/notifications/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).
- `CometChatNotifications.registerPushToken(pushToken: string, platform: PushPlatforms, providerId?: string): Promise<string>` — `chat-sdk-javascript/src/Notifications/CometChatNotifications.ts:616`
- `CometChatNotifications.unregisterPushToken(): Promise<string>` — `chat-sdk-javascript/src/Notifications/CometChatNotifications.ts:649`
- `enum PushPlatforms { FCM_WEB = 'fcm_web' }` — `chat-sdk-javascript/src/Notifications/constants/CometChatNotificationsConstants.ts:46-47`
- The web kit pins `@cometchat/chat-sdk-javascript ^4.1.10`, which has this API.
- There is NO `PNPlatform` and NO `PushNotificationOptions` symbol — the real names are `PushPlatforms` and `CometChatNotifications`.
- Firebase Cloud Messaging for Web — https://firebase.google.com/docs/cloud-messaging/js/client
- Web Push spec / VAPID / Push API (fallback path only) — RFC 8030, RFC 8292, https://developer.mozilla.org/en-US/docs/Web/API/Push_API

---

## 1. Recommended: CometChat-native web push (FCM_WEB)

CometChat delivers web push through **Firebase Cloud Messaging for Web**. You register the FCM device token with CometChat via the Chat SDK; CometChat's backend then sends pushes on new messages through your dashboard-configured FCM provider. No push server of yours.

```
Browser (your React app)
  ├── firebase/messaging  — getToken() → FCM web token
  ├── firebase-messaging-sw.js — receives background pushes (onBackgroundMessage)
  └── CometChatNotifications.registerPushToken(token, FCM_WEB) — hands token to CometChat

CometChat backend
  └── FCM provider (dashboard) → sends push to the token on every new message
```

### 1.1 Firebase setup (one-time)

1. Create a Firebase project, enable **Cloud Messaging**.
2. Add a Web app; copy its web SDK config (`apiKey`, `projectId`, `messagingSenderId`, `appId`, …).
3. Under **Project Settings → Cloud Messaging → Web configuration**, generate a **Web Push certificate**. This key pair is Firebase's own VAPID key — it is consumed by `getToken({ vapidKey })`. It is NOT a self-hosted VAPID server; you don't run any server for it.

### 1.2 Install + initialize Firebase

```bash
npm install firebase
```

```ts
// cometchat/firebase.ts
import { initializeApp } from "firebase/app";

export const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,           // adjust prefix per framework
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const FIREBASE_WEB_PUSH_CERT_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY; // Web Push certificate key
```

### 1.3 Service worker — `public/firebase-messaging-sw.js`

The file MUST live at the origin root (`/firebase-messaging-sw.js`) — `getToken` looks for it by default, or pass an explicit `serviceWorkerRegistration`.

> **Coexistence check first (P0-10).** If `detect` reported `coexistence.existing_firebase: true` or listed an existing service worker, the project already runs Firebase and/or a SW. Do NOT blindly overwrite: (a) reuse the project's existing Firebase config/app instead of a second `initializeApp` — duplicate apps fight over the FCM token; (b) if a service worker already exists at the origin root (e.g. a PWA/Workbox `sw.js`), **merge** the messaging handlers (`importScripts` + `firebase.initializeApp` + `onBackgroundMessage`) into it rather than replacing it, or register CometChat's worker at a distinct scope and pass it as `serviceWorkerRegistration` to `getToken`. Overwriting the app's worker silently kills its offline/caching logic.

```js
// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "…",
  projectId: "…",
  messagingSenderId: "…",
  appId: "…",
});

const messaging = firebase.messaging();

// Background pushes (tab closed / not focused)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "New message", {
    body: body ?? "",
    icon: "/icons/chat.png",
    tag: payload.data?.conversationId ? `chat-${payload.data.conversationId}` : undefined,
    data: payload.data ?? {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  const targetUrl = data.receiverType === "group"
    ? `/messages?group=${data.conversationId}`
    : `/messages?user=${data.senderUid ?? data.conversationId}`;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(self.registration.scope)) {
          w.focus();
          w.postMessage({ type: "open_conversation", ...data });
          return;
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
```

### 1.4 Register the FCM token with CometChat (after login)

```ts
// cometchat/registerFcmWebPush.ts
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { CometChatNotifications } from "@cometchat/chat-sdk-javascript";
import { firebaseApp, FIREBASE_WEB_PUSH_CERT_KEY } from "./firebase";

export async function registerFcmWebPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

  // Permission MUST be requested in response to a user gesture (see §2 rule).
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  // Register the FCM service worker.
  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  const messaging = getMessaging(firebaseApp);
  const fcmToken = await getToken(messaging, {
    vapidKey: FIREBASE_WEB_PUSH_CERT_KEY,        // Firebase Web Push certificate — NOT a self-hosted VAPID server
    serviceWorkerRegistration: swReg,
  });
  if (!fcmToken) return;

  // Hand the token to CometChat. Its backend now delivers pushes on new messages.
  await CometChatNotifications.registerPushToken(
    fcmToken,
    CometChatNotifications.PushPlatforms.FCM_WEB,
    /* providerId */ undefined,                  // omit for "default", or pass your dashboard FCM provider id
  );

  // Foreground messages (tab focused) don't fire the SW — show them yourself if desired.
  onMessage(messaging, (payload) => {
    if (document.visibilityState === "visible") {
      // e.g. toast / in-app banner instead of an OS notification
      window.dispatchEvent(new CustomEvent("cometchat:foreground-push", { detail: payload }));
    }
  });
}
```

Call it from your provider AFTER `CometChatUIKit.login(...)` resolves:

```tsx
// CometChatProvider.tsx
useEffect(() => {
  if (!user) return;
  registerFcmWebPush().catch((err) => {
    console.warn("FCM web push registration failed:", err); // never block chat — push is opt-in
  });
}, [user]);
```

### 1.5 Dashboard FCM provider (manual, one-time)

In the CometChat dashboard: **Notifications → Push Notifications → Add FCM provider**. Upload the Firebase service-account JSON (or legacy server key) for the same Firebase project. CometChat now sends new-message pushes to every registered `FCM_WEB` token — **no webhook of yours**.

### 1.6 Logout — unregister the token

```ts
import { CometChatNotifications } from "@cometchat/chat-sdk-javascript";

// Call BEFORE CometChat.logout(), while the auth token is still valid.
await CometChatNotifications.unregisterPushToken();   // CometChatNotifications.ts:649
```

> **Hard rule — register only AFTER login.** `registerPushToken` operates on the current logged-in user's auth token. Calling it before `CometChatUIKit.login(...)` resolves will fail or attach the token to nobody. Wire it inside the auth-state effect, never on page load.

> **Hard rule — `firebase-messaging-sw.js` must be at the origin root.** Place it in `public/` so it serves from `/firebase-messaging-sw.js`. In Next.js it cannot live under `app/`. See §8 for per-framework placement.

> **Hard rule — iOS still needs PWA install.** FCM web push on iOS 16.4+ only works for a Home-Screen-installed PWA, exactly like the fallback path. See §9.

---

## 2. The permission-prompt rule (applies to both paths)

Chrome / Firefox / Safari all require `Notification.requestPermission()` to run in response to a **user gesture** (a click). Calling it from a top-level `useEffect` on page load is rejected. Best pattern: an "Enable notifications" button the user clicks once, which then calls `registerFcmWebPush()` (or the fallback `registerWebPushForChat()`).

---

## 3. Alternative / advanced: self-hosted Web Push (no Firebase)

> Use this path **only** if you cannot or will not use Firebase (§1). It is more work — you run your own VAPID keys, a push server, and a CometChat message-sent webhook. CometChat's backend does NOT deliver the push for you on this path; your server does. For most apps, prefer §1.

### 3.1 Architecture

```
Browser (your React app)
  ├── Service Worker — long-lived; receives push events
  ├── Push subscription — issued by browser, sent to your server
  └── Notification UI — fired by SW on push event

CometChat backend
  └── Webhook → your push server when a message is sent

Your push server (Node, Cloudflare Worker, Lambda, etc.)
  ├── Stores push subscriptions per UID
  ├── Receives CometChat webhook
  └── Sends push payload via web-push lib → browser
```

Three pieces, all yours: client SW, push server, webhook integration.

### 3.2 Generate VAPID keys (server-side, one-time)

VAPID = Voluntary Application Server Identification — proves to the browser that the push originated from an authorized server.

```bash
npx web-push generate-vapid-keys
```

Output:
```
=======================================
Public Key: BLBz-...
Private Key: 9tT...
=======================================
```

Public key → client (env var). Private key → push server only (never ship to client).

### 3.3 Service Worker

#### `public/sw.js` (Vite / CRA / React Router) or `app/sw.js` (Next.js / Astro)

```js
// Fired when a push payload arrives
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  if (payload.type !== "new_message") return;

  event.waitUntil(
    self.registration.showNotification(payload.senderName, {
      body: payload.preview,                          // truncated message
      icon: payload.senderAvatar ?? "/icons/chat.png",
      tag: `chat-${payload.conversationId}`,          // dedupe — replace prior unread for same conversation
      badge: "/icons/badge.png",
      data: {
        conversationId: payload.conversationId,
        senderUid: payload.senderUid,
        receiverType: payload.receiverType,           // "user" or "group"
      },
    }),
  );
});

// Fired when user clicks the notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data;
  const targetUrl = data.receiverType === "group"
    ? `/messages?group=${data.conversationId}`
    : `/messages?user=${data.senderUid}`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Focus existing tab if open
      for (const w of wins) {
        if (w.url.includes(self.registration.scope)) {
          w.focus();
          w.postMessage({ type: "open_conversation", ...data });
          return;
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(targetUrl);
    }),
  );
});

// Optional: fired when a notification is dismissed without click
self.addEventListener("notificationclose", (event) => {
  // Send a "dismissed" beacon to your server if you track this
});
```

### 3.4 Client-side registration (self-hosted)

```ts
// cometchat/registerWebPush.ts
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;     // adjust prefix per framework

export async function registerWebPushForChat(uid: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  // Register the SW (one-time per origin)
  const reg = await navigator.serviceWorker.register("/sw.js");

  // Wait for SW activation
  await navigator.serviceWorker.ready;

  // Ask permission — must be in response to a user gesture (click)
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  // Get or create subscription
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,                          // required by Chrome
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }

  // Send subscription to YOUR push server, keyed by uid
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, subscription }),
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
```

Call this from your CometChatProvider AFTER login resolves:

```tsx
// CometChatProvider.tsx
useEffect(() => {
  if (!user) return;
  registerWebPushForChat(user.uid).catch((err) => {
    // surface to UI but don't block chat — push is opt-in
    console.warn("Web Push registration failed:", err);
  });
}, [user]);
```

The permission-prompt rule (§2) applies here too — request permission from a user gesture, not page load.

### 3.5 Listen for SW messages in the React app

```tsx
// CometChatProvider.tsx
useEffect(() => {
  if (!("serviceWorker" in navigator)) return;

  const handler = (event: MessageEvent) => {
    if (event.data?.type === "open_conversation") {
      navigate(`/messages?${event.data.receiverType}=${event.data.conversationId}`);
    }
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}, [navigate]);
```

When the SW posts `open_conversation`, the React app navigates to the right thread.

### 3.6 Server-side push send

Your push server runs on Node.js / Cloudflare Worker / Lambda / Vercel Functions. The shape:

```ts
// server/push.ts
import express from "express";
import webpush from "web-push";
import { z } from "zod";

webpush.setVapidDetails(
  "mailto:notifications@yourapp.com",
  process.env.VAPID_PUBLIC!,
  process.env.VAPID_PRIVATE!,
);

const app = express();
app.use(express.json());

// 1. Client registers a subscription
app.post("/api/push/subscribe", async (req, res) => {
  const { uid, subscription } = req.body;          // validate with zod in production
  await db.savePushSubscription(uid, subscription);
  res.status(204).send();
});

// 2. CometChat fires a webhook when a message is sent
app.post("/webhook/cometchat/message-sent", async (req, res) => {
  const { receiver, sender, data } = req.body.data;

  // Don't notify the sender — they sent the message
  const subs = await db.getPushSubscriptions(receiver);
  if (!subs.length) return res.status(204).send();

  const payload = JSON.stringify({
    type: "new_message",
    conversationId: receiver,
    senderUid: sender.uid,
    senderName: sender.name,
    senderAvatar: sender.avatar,
    preview: truncate(data.text, 80),
    receiverType: data.entityType,                 // "user" or "group"
  });

  // Send to all of receiver's subscriptions in parallel; clean up dead ones
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await db.removePushSubscription(receiver, sub);   // browser unsubscribed
        }
      }
    }),
  );

  res.status(204).send();
});

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

app.listen(3000);
```

The skill writes a starter version of this server file (`server/push.example.ts`) with a README pointing at env vars; the user owns the actual deployment.

### 3.7 CometChat webhook setup (manual)

In the CometChat dashboard:

1. Navigate to **Webhooks**.
2. Click **+ Webhook**.
3. URL: `https://your-push-server.example.com/webhook/cometchat/message-sent`
4. Trigger: **Message sent**
5. Verification: copy the signing secret to your push server's env (`COMETCHAT_WEBHOOK_SECRET`).

The webhook fires for EVERY message — your server filters out the sender, dedupes per conversation, and respects user notification preferences.

### 3.8 Webhook signature verification

```ts
import crypto from "crypto";

app.use("/webhook/cometchat", (req, res, next) => {
  const signature = req.header("x-cometchat-signature");
  const expected = crypto
    .createHmac("sha256", process.env.COMETCHAT_WEBHOOK_SECRET!)
    .update(JSON.stringify(req.body))
    .digest("hex");
  if (signature !== expected) return res.status(401).send({ error: "invalid signature" });
  next();
});
```

Without this, anyone with your endpoint URL can flood your users with fake notifications.

---

## 4. Browser support matrix + iOS PWA caveat (both paths)

| Browser | Web Push | Notification while closed | Notes |
|---|---|---|---|
| Chrome desktop | ✓ | ✓ if Chrome process alive | Service Worker terminates after ~30s idle |
| Edge desktop | ✓ | ✓ | Same as Chrome |
| Firefox desktop | ✓ | ✓ | Slightly more SW survival |
| Safari 16+ desktop | ✓ | ✓ if Safari running | macOS 13+ |
| Safari 16.4+ iOS | ✓ | **Only when added to Home Screen as PWA** | Critical caveat |
| Chrome mobile | ✓ | ✓ | Aggressive throttling on Android |
| Edge mobile | ✓ | ✓ | Same as Chrome mobile |

**iOS PWA-only requirement (applies to FCM_WEB too):** iOS 16.4+ supports web push, but ONLY for sites added to the Home Screen as a PWA. Safari-the-browser-app does NOT receive push. This is platform-level and applies equally to the FCM_WEB path (§1) and the self-hosted path (§3). To unlock iOS web push:

1. App must have a `manifest.json` (PWA manifest)
2. User must use Safari → Share → "Add to Home Screen"
3. Subsequent push subscriptions and notifications work as expected

This is a real production constraint. The skill detects whether the project ships a `manifest.json` and warns if not.

---

## 5. Framework-specific service worker placement (both paths)

The FCM service worker (`firebase-messaging-sw.js`, §1) and the self-hosted SW (`sw.js`, §3) follow the same placement rules.

### Vite / React (CRA)

`public/firebase-messaging-sw.js` (or `public/sw.js`) is served from the origin root. `register("/firebase-messaging-sw.js")` works directly.

### Next.js (App Router)

Service Workers + Next.js have a known gotcha: the SW can't be inside `app/` because Next handles those routes. Place it in `public/` and serve from the origin root. Register from a `"use client"` component that runs after hydration.

### Next.js (Pages Router)

Same — `public/`.

### React Router

`public/` works. If using SSR (loaders), the SW registration code must be guarded by `typeof window !== "undefined"`.

### Astro

Place the SW at `public/`. Register from a `client:only="react"` island.

The framework-specific patterns skills cover the SSR guards in detail.

---

## 6. HTTPS requirement (both paths)

Service Workers + Push API + FCM all require HTTPS (or `localhost` for dev). The skill detects the dev server protocol and warns:

```
⚠️  Web push requires HTTPS or localhost. Your dev server is running on http://192.168.x.x.
   Push subscriptions will fail. Either:
   - Use http://localhost (Chrome/Firefox/Safari all allow Push API on localhost), or
   - Set up HTTPS dev (mkcert, ngrok, or Vite's --https flag)
```

For production, the Vercel / Netlify / Cloudflare default deploys are HTTPS — no extra work.

---

## 7. Anti-patterns

1. **Believing "the web has no CometChat push."** It does — `CometChatNotifications.registerPushToken(token, PushPlatforms.FCM_WEB)` + a dashboard FCM provider (§1). Don't hand-roll a push server unless you've ruled out Firebase.
2. **Inventing SDK symbols.** There is no `PNPlatform`, no `PushNotificationOptions`. The real names are `CometChatNotifications` and `PushPlatforms` (only member: `FCM_WEB`).
3. **Calling `registerPushToken` before login.** It binds to the current logged-in user's auth token — call it only after `CometChatUIKit.login(...)` resolves.
4. **Calling `Notification.requestPermission()` on page load.** Browsers reject this. Wire to a user-clicked "Enable notifications" button (§2).
5. **Self-hosted path: sending the Auth Key in push payloads.** Payloads are visible in the SW; never include credentials. Use the user's UID as a key into your server's session store.
6. **Self-hosted path: missing webhook signature verification.** Without HMAC verification, anyone with the URL can spoof notifications.
7. **Showing notifications even when the chat tab is open.** Check `clients.matchAll()` (self-hosted) or `document.visibilityState` in `onMessage` (FCM) and skip if the user already has the chat focused.
8. **Skipping the iOS PWA warning.** iOS users will silently get nothing. Tell them to "Add to Home Screen."
9. **Forgetting cleanup on logout.** FCM path: call `CometChatNotifications.unregisterPushToken()` (§1.6). Self-hosted path: `subscription.unsubscribe()` + DELETE the server record (§8). Otherwise the previous user keeps getting the new user's messages.

---

## 8. Self-hosted logout cleanup

(FCM_WEB logout uses `CometChatNotifications.unregisterPushToken()` — see §1.6. This is the self-hosted equivalent.)

```ts
async function unsubscribeWebPush(uid: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, subscription }),
  });
  await subscription.unsubscribe();
}
```

Call this from your logout flow before `CometChat.logout()`.

---

## 9. Verification checklist

**Recommended FCM_WEB path (§1):**
- [ ] `firebase` installed; `firebaseApp` initialized with the web SDK config
- [ ] Firebase Web Push certificate generated and wired as `getToken({ vapidKey })`
- [ ] `public/firebase-messaging-sw.js` at origin root, handles `onBackgroundMessage` + `notificationclick`
- [ ] `Notification.requestPermission()` triggered from a user gesture, not page load (§2)
- [ ] `CometChatNotifications.registerPushToken(token, CometChatNotifications.PushPlatforms.FCM_WEB)` called AFTER `CometChatUIKit.login(...)` resolves
- [ ] FCM provider configured in the CometChat dashboard (Notifications → Push)
- [ ] Foreground `onMessage` does NOT pop an OS notification when the tab is focused
- [ ] Logout flow calls `CometChatNotifications.unregisterPushToken()` before `CometChat.logout()`
- [ ] No phantom symbols (`PNPlatform` / `PushNotificationOptions`) anywhere

**Common to both paths:**
- [ ] HTTPS or localhost only (warned otherwise)
- [ ] `manifest.json` shipped if iOS users are expected (PWA caveat, §4)
- [ ] Notifications dedupe per conversation via `tag` field

**Self-hosted fallback path (§3) only:**
- [ ] `public/sw.js` exists and listens for `push` + `notificationclick` events
- [ ] VAPID public key in client env vars; private key in server env, NOT client
- [ ] Subscription POSTed to your push server, keyed by CometChat UID
- [ ] CometChat dashboard webhook configured for `Message sent` events
- [ ] Webhook signature verification on the push server (HMAC SHA256)
- [ ] Logout flow calls `subscription.unsubscribe()` and deletes server record
- [ ] Server cleanup of dead subscriptions on 410 response

---

## 10. Pointers

- `cometchat-react-calls/references/voip-and-web-push.md` — Web Push for incoming calls (overlap; both can coexist on the same SW)
- `cometchat-{react,nextjs,react-router,astro}-patterns` — framework-specific SSR handling
- `cometchat-production` — auth tokens, security
- `cometchat-troubleshooting` — web push debugging (chrome://serviceworker-internals, Firefox about:debugging)
- Firebase Cloud Messaging for Web — https://firebase.google.com/docs/cloud-messaging/js/client
