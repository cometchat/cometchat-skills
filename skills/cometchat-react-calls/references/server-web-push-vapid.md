# Server-side Web Push VAPID for browser ringing

Browsers don't have a true VoIP-push equivalent (the way iOS PushKit + Android FCM data-messages do). But **Web Push** with VAPID is the closest analog: when a CometChat call event fires, your server sends a push, the browser's Service Worker receives it (even with the tab closed), and posts a notification + plays a ringtone.

**Caveat — set expectations:** Web Push is best-effort. It works reliably when:
- The user has the tab open OR a recent installed PWA
- The browser is running (Chrome/Edge/Firefox running but minimized → ✓)
- Battery saver isn't aggressive

It does NOT work when:
- The user closed all browser windows
- iOS Safari except in PWA-only mode (16.4+)
- The user denied notification permission

For production-grade ringing on the web, recommend customers offer the iOS/Android app for unreliable-recipient scenarios.

**Canonical docs:** https://datatracker.ietf.org/doc/html/rfc8030 (Web Push), https://datatracker.ietf.org/doc/html/rfc8292 (VAPID), https://developer.mozilla.org/en-US/docs/Web/API/Push_API

---

## Hard rules

1. **VAPID keys are mandatory.** Browsers will reject pushes without them since 2018.
2. **Use the `web-push` library or its equivalents** — implementing VAPID JWT + AES128GCM payload encryption from scratch is error-prone.
3. **HTTPS required.** Web Push doesn't work on HTTP except localhost.
4. **Subscriptions expire.** Browsers rotate `endpoint` URLs every ~3 months on Chrome desktop. Implement re-subscription on push failure (410 Gone).
5. **TTL ≤ 60s for VoIP-style ringing.** A push that arrives 5 minutes late is worse than no push.
6. **Topic must be set** so a fresh ringing push displaces an older queued one (avoid stacking).

---

## Generate VAPID keys (one-time)

```bash
npx web-push generate-vapid-keys
# Output:
# Public Key:  BNa...   (paste into your client code)
# Private Key: 3kL...   (server-side env var only)
```

Or via Node API:

```js
import webpush from "web-push";
const keys = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=", keys.publicKey);
console.log("VAPID_PRIVATE_KEY=", keys.privateKey);
```

---

## Node.js template

```js
// npm install web-push
import webpush from "web-push";

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_CONTACT_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

export async function sendWebVoipPush(opts) {
  const { recipientUid, sessionId, callerName, callerUid, callType } = opts;

  // A user may have multiple subscriptions (laptop + work computer); fan out.
  const subscriptions = await db.getWebPushSubscriptions(recipientUid);

  const payload = JSON.stringify({
    type: "incoming_call",
    sessionId,
    callerName,
    callerUid,
    callType,
    timestamp: Date.now(),
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload, {
          TTL: 30,                                 // Hard Rule 5
          urgency: "high",                          // urgency header
          topic: `call-${sessionId}`.slice(0, 32),  // Hard Rule 6 — replaces older with same topic
        });
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Endpoint dead — purge from DB
          await db.removeWebPushSubscription(recipientUid, sub.endpoint);
          return;
        }
        console.error("Web push failed", err);
      }
    }),
  );
}
```

---

## Python template (pywebpush)

```python
# pip install pywebpush
from pywebpush import webpush, WebPushException
import json, os

VAPID_CLAIMS = {"sub": f"mailto:{os.environ['VAPID_CONTACT_EMAIL']}"}
VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]

def send_web_voip_push(subscription_info: dict, payload: dict):
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
            ttl=30,
            headers={
                "Urgency": "high",
                "Topic": f"call-{payload['sessionId']}"[:32],
            },
        )
    except WebPushException as ex:
        if ex.response and ex.response.status_code in (404, 410):
            return "expired"
        raise
```

---

## Receiver: Service Worker

`/public/sw.js`:

```js
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  if (data.type !== "incoming_call") return;

  event.waitUntil((async () => {
    // 1. Show notification (must happen synchronously in `push` event,
    //    otherwise browser shows "[App] is sending notifications in the background"
    //    indicator and may unsubscribe you).
    await self.registration.showNotification(`Incoming call from ${data.callerName}`, {
      body: data.callType === "video" ? "Video call" : "Audio call",
      tag: `call-${data.sessionId}`,
      icon: "/icons/incoming-call-192.png",
      badge: "/icons/badge-72.png",
      requireInteraction: true,        // stays until user acts
      silent: false,                    // play default ringtone (some OSes ignore this for browser pushes)
      vibrate: [500, 200, 500],         // mobile haptic
      actions: [
        { action: "accept", title: "Accept" },
        { action: "reject", title: "Decline" },
      ],
      data: {
        sessionId: data.sessionId,
        callerName: data.callerName,
        callerUid: data.callerUid,
        callType: data.callType,
      },
    });

    // 2. Wake any open clients so the in-app ringer can fire too
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: "incoming_call", ...data }));
  })());
});

self.addEventListener("notificationclick", (event) => {
  const { sessionId } = event.notification.data;
  event.notification.close();
  const url = `/call/${sessionId}?action=${event.action || "open"}`;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window" });
    const existing = clients.find((c) => c.url.includes(`/call/${sessionId}`));
    if (existing) {
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});
```

Register in `main.tsx`:

```tsx
useEffect(() => {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js")
    .then(async (reg) => {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      });
      await api.registerWebPushSubscription(currentUserUid, sub.toJSON());
    })
    .catch((err) => console.warn("SW register / push subscribe failed:", err));
}, []);
```

---

## Anti-patterns

1. **Embedding VAPID private key in client code.** Push spam by anyone who views source. Server-only.
2. **Skipping `requireInteraction: true`.** Notification disappears in 5s on Chrome desktop — call seems to "ring once" then vanish.
3. **No `tag` on the notification.** Multiple incoming-call notifications stack.
4. **TTL: 0.** Notification dies the instant the device is offline. Use 30s minimum.
5. **`silent: true`.** Browser doesn't ring, only shows the visual notification.
6. **Forgetting to handle `notificationclick`.** User taps notification → nothing happens.
7. **Implementing Web Push for iOS Safari without checking PWA-only mode.** iOS Safari requires the user to "Add to Home Screen" first — Web Push doesn't work in regular tabs.

---

## Verification checklist

- [ ] VAPID keys generated; private key in env var
- [ ] HTTPS (or localhost for dev)
- [ ] Subscription stored server-side keyed to user UID
- [ ] `topic` set so newer push replaces older
- [ ] `requireInteraction: true` + `tag` set on notification
- [ ] 410/404 responses purge dead subscriptions
- [ ] `notificationclick` opens a call route
- [ ] Smoke: 2 browsers, recipient minimizes window, caller dials, recipient sees notification + ringtone

---

## Pointers

- `cometchat-react-calls/SKILL.md` — calls architecture
- `cometchat-react-push/SKILL.md` — chat web push (sister, different payload)
- `cometchat-ios-calls/references/server-apns-pushkit.md` — iOS sibling
- `cometchat-android-v5-calls/references/server-fcm-voip.md` — Android sibling
- Web Push spec (RFC 8030): https://datatracker.ietf.org/doc/html/rfc8030
- VAPID (RFC 8292): https://datatracker.ietf.org/doc/html/rfc8292
- web-push npm: https://www.npmjs.com/package/web-push
