---
name: cometchat-react-push
description: Push notifications for CometChat React UI Kit v6 in Vite / Next.js / React Router / Astro projects. Web doesn't have native push — covers Web Push (Service Worker + Push API + Notification API + VAPID keys), CometChat dashboard PushPlatform configuration, server-side webhook to send pushes when a message arrives, click-through to chat, foreground vs background handling, iOS Safari 16.4+ PWA-only quirks, and HTTPS requirements.
license: "MIT"
compatibility: "React >= 18; Web Push API (Chrome 50+, Firefox 44+, Edge 17+, Safari 16+ desktop, Safari 16.4+ iOS PWA-only); HTTPS required (or localhost); CometChat dashboard PushPlatform configured"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat react web push notifications service-worker vapid push-api notification-api ios-safari-pwa nextjs astro react-router"
---

## Purpose

Web Push for CometChat chat. The web has no native VoIP-push equivalent for incoming-call ringing (see `cometchat-react-calls/references/voip-and-web-push.md` for that limit), but it does have **Web Push** for new-message notifications when the user's tab is backgrounded or closed. This skill wires the full path: client subscription → server webhook → push send → notification → click-through.

**Not the same as the calls Web Push.** Calls Web Push tries to ring the device through a closed tab (best-effort, browser-dependent). Chat Web Push notifies on new messages — fundamentally similar plumbing, different payload + UX. Many apps need both.

**Read these other skills first:**
- `cometchat-core` — provider pattern, login order
- `cometchat-{react,nextjs,react-router,astro}-patterns` — framework-specific Service Worker registration
- `cometchat-react-calls/references/voip-and-web-push.md` — calls-specific Web Push (overlap with this; both can coexist)
- `cometchat-production` — server-minted auth tokens (push payloads should NOT contain Auth Key)

**Ground truth:**
- Web Push spec — https://datatracker.ietf.org/doc/html/rfc8030
- VAPID — https://datatracker.ietf.org/doc/html/rfc8292
- Push API — https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- CometChat dashboard `PushNotifications` (formerly Extensions → Enhanced Push Notifications)

---

## 1. Architecture

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

Three pieces, all yours: client SW, push server, webhook integration. CometChat doesn't host the push server for you — its dashboard's "PushPlatform" config is for FCM/APNs (mobile), not Web Push.

---

## 2. Generate VAPID keys (server-side, one-time)

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

---

## 3. Service Worker

### `public/sw.js` (Vite / CRA / React Router) or `app/sw.js` (Next.js / Astro)

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

---

## 4. Client-side registration

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

**The permission prompt rule:** Chrome / Firefox / Safari all require permission requests in response to a user gesture. If you call `Notification.requestPermission()` from a top-level `useEffect` that runs on page load, browsers reject it. Best pattern: a "Enable notifications" button the user clicks once.

---

## 5. Listen for SW messages in the React app

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

---

## 6. Server-side push send

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

---

## 7. CometChat webhook setup (manual)

In the CometChat dashboard:

1. Navigate to **Webhooks**.
2. Click **+ Webhook**.
3. URL: `https://your-push-server.example.com/webhook/cometchat/message-sent`
4. Trigger: **Message sent**
5. Verification: copy the signing secret to your push server's env (`COMETCHAT_WEBHOOK_SECRET`).

The webhook fires for EVERY message — your server filters out the sender, dedupes per conversation, and respects user notification preferences.

---

## 8. Webhook signature verification

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

## 9. Browser support matrix + iOS PWA caveat

| Browser | Web Push | Notification while closed | Notes |
|---|---|---|---|
| Chrome desktop | ✓ | ✓ if Chrome process alive | Service Worker terminates after ~30s idle |
| Edge desktop | ✓ | ✓ | Same as Chrome |
| Firefox desktop | ✓ | ✓ | Slightly more SW survival |
| Safari 16+ desktop | ✓ | ✓ if Safari running | macOS 13+ |
| Safari 16.4+ iOS | ✓ | **Only when added to Home Screen as PWA** | Critical caveat |
| Chrome mobile | ✓ | ✓ | Aggressive throttling on Android |
| Edge mobile | ✓ | ✓ | Same as Chrome mobile |

**iOS PWA-only requirement:** iOS 16.4+ supports Web Push, but ONLY for sites added to the Home Screen as a PWA. Safari-the-browser-app does NOT receive Web Push. To unlock iOS Web Push:

1. App must have a `manifest.json` (PWA manifest)
2. User must use Safari → Share → "Add to Home Screen"
3. Subsequent push subscriptions and notifications work as expected

This is a real production constraint. The skill detects whether the project ships a `manifest.json` and warns if not.

---

## 10. Framework-specific Service Worker registration

### Vite / React (CRA)

`public/sw.js` is served from `/sw.js`. `register("/sw.js")` works directly.

### Next.js (App Router)

Service Workers + Next.js have a known gotcha: the SW can't be inside `app/` because Next handles those routes. Place it in `public/sw.js` and serve from `/sw.js`. Register from a `"use client"` component that runs after hydration.

### Next.js (Pages Router)

Same — `public/sw.js`.

### React Router

`public/sw.js` works. If using SSR (loaders), the SW registration code must be guarded by `typeof window !== "undefined"`.

### Astro

Place the SW at `public/sw.js`. Register from a `client:only="react"` island.

The framework-specific patterns skills cover the SSR guards in detail.

---

## 11. HTTPS requirement

Service Workers + Push API both require HTTPS (or `localhost` for dev). The skill detects the dev server protocol and warns:

```
⚠️  Web Push requires HTTPS or localhost. Your dev server is running on http://192.168.x.x.
   Web Push subscriptions will fail. Either:
   - Use http://localhost (Chrome/Firefox/Safari all allow Push API on localhost), or
   - Set up HTTPS dev (mkcert, ngrok, or Vite's --https flag)
```

For production, the Vercel / Netlify / Cloudflare default deploys are HTTPS — no extra work.

---

## 12. Anti-patterns

1. **Calling `Notification.requestPermission()` on page load.** Browsers reject this. Wire to a user-clicked "Enable notifications" button.
2. **Sending the Auth Key in push payloads.** Push payloads are visible in the SW; never include credentials. Use the user's UID as a key into your server's session store.
3. **Missing webhook signature verification.** Without HMAC verification, anyone with the URL can spoof notifications.
4. **Showing notifications even when the chat tab is open.** Check `clients.matchAll()` from the SW and skip if the user already has the chat focused.
5. **Skipping the iOS PWA warning.** iOS users will silently get nothing. The skill explicitly tells them to "Add to Home Screen."
6. **Service Worker registered before login completes.** Race conditions where the subscription exists but the server doesn't know whose UID it belongs to. Register from inside the auth state effect.
7. **Forgetting subscription cleanup on logout.** The previous user's subscription keeps notifying them with the new user's messages. Call `subscription.unsubscribe()` and DELETE the server record on logout.

---

## 13. Logout cleanup

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

## 14. Verification checklist

- [ ] `public/sw.js` (or framework equivalent) exists and listens for `push` + `notificationclick` events
- [ ] VAPID public key in client env vars (correct framework prefix)
- [ ] VAPID private key in server env, NOT client
- [ ] `Notification.requestPermission()` triggered from a user gesture, not page load
- [ ] Push subscription registered AFTER login resolves
- [ ] Subscription POSTed to your push server, keyed by CometChat UID
- [ ] CometChat dashboard webhook configured for `Message sent` events
- [ ] Webhook signature verification on the push server (HMAC SHA256)
- [ ] Notifications dedupe per conversation via `tag` field
- [ ] `notificationclick` focuses existing tab via `clients.matchAll` OR opens new tab
- [ ] Foreground tab does NOT show notifications (check tab focus before `showNotification`)
- [ ] Logout flow calls `subscription.unsubscribe()` and deletes server record
- [ ] HTTPS or localhost only (warned otherwise)
- [ ] `manifest.json` shipped if iOS users are expected (PWA caveat)
- [ ] Server cleanup of dead subscriptions on 410 response

---

## 15. Pointers

- `cometchat-react-calls/references/voip-and-web-push.md` — Web Push for incoming calls (overlap; both can coexist on the same SW)
- `cometchat-{react,nextjs,react-router,astro}-patterns` — framework-specific SSR handling
- `cometchat-production` — auth tokens, security
- `cometchat-troubleshooting` — Web Push debugging (chrome://serviceworker-internals, Firefox about:debugging)
