# VoIP push on web — there isn't any

Web browsers do not have VoIP push. You cannot ring a user whose tab is closed. The closest equivalents are:

1. **Web Push** (Service Worker + Push API + Notification API) — can fire a system-level notification while the browser is open even if the tab is backgrounded. Limitations:
   - Service Worker must be installed (one prior visit required)
   - User must have granted notification permission
   - Browser must be running (Chrome/Edge can deliver to closed tabs IF the browser process is alive; Safari requires Safari to be running; Firefox stops Service Workers aggressively)
   - Does NOT bypass closed browser. Production calling apps on web pair this with email/SMS fallback for missed calls.

2. **Email/SMS missed-call fallback** — server-side. When a call rings unanswered for ~30 seconds, send a "missed call from X" email/SMS with a deep link back into the app.

This reference covers Web Push end-to-end. Email/SMS is out of scope (server-side only, not skill-scaffoldable).

---

## Web Push setup (Service Worker + push subscription)

### 1. Generate VAPID keys (server-side, one-time)

```bash
npx web-push generate-vapid-keys
```

Stores public + private keys. Public goes to the client; private stays on the push server.

### 2. Register the Service Worker

`public/sw.js`:

```js
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  if (payload.type !== "incoming_call") return;

  event.waitUntil(
    self.registration.showNotification("Incoming call", {
      body: `${payload.callerName} is calling`,
      icon: "/icons/call.png",
      tag: `call-${payload.sessionId}`,           // dedupe — only one ring per session
      requireInteraction: true,                    // don't auto-dismiss
      data: { sessionId: payload.sessionId, callerUid: payload.callerUid },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Focus existing tab if open, otherwise open a new one
      for (const w of wins) {
        if (w.url.includes(self.registration.scope)) {
          w.focus();
          w.postMessage({ type: "incoming_call_click", ...event.notification.data });
          return;
        }
      }
      return clients.openWindow(`/calls/incoming?sessionId=${event.notification.data.sessionId}`);
    }),
  );
});
```

### 3. Register from the app

```ts
// cometchat/registerWebPush.ts
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export async function registerWebPushForCalls(uid: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const reg = await navigator.serviceWorker.register("/sw.js");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
  });

  // Send subscription to YOUR server, keyed by uid
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

### 4. Listen for SW messages in your React app

```tsx
// CometChatProvider.tsx
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === "incoming_call_click") {
      // Navigate to the call screen and let CometChatIncomingCall pick it up
      navigate(`/calls/incoming?sessionId=${event.data.sessionId}`);
    }
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}, [navigate]);
```

### 5. Server-side push send (signaling integration)

Your CometChat backend (or webhook listener) detects an incoming call event and sends Web Push to the receiver's subscription:

```ts
// server (Node.js) — runs when CometChat fires the call.received webhook
import webpush from "web-push";

webpush.setVapidDetails("mailto:you@example.com", VAPID_PUBLIC, VAPID_PRIVATE);

async function sendIncomingCallPush(receiverUid: string, sessionId: string, callerName: string, callerUid: string) {
  const subs = await getSubscriptionsForUid(receiverUid);  // your DB
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub, JSON.stringify({
        type: "incoming_call",
        sessionId,
        callerName,
        callerUid,
      })),
    ),
  );
}
```

The webhook setup itself is server-side; the skill scaffolds the client side and points users at this template for the server.

---

## Browser support matrix

| Browser | Push API | Notification while tab closed | Service Worker terminated background |
|---|---|---|---|
| Chrome/Edge desktop | ✓ | ✓ if browser process alive | After ~30s idle |
| Chrome/Edge mobile | ✓ | ✓ | Aggressive; Web Push is best-effort |
| Firefox desktop | ✓ | ✓ | After ~30s idle |
| Safari 16+ desktop | ✓ | ✓ if Safari running | Tighter |
| Safari iOS 16.4+ | ✓ | Only when added to Home Screen as PWA | N/A — PWA only |
| Mobile Web (any) | Limited | Often not delivered when browser killed | OS-driven |

**Bottom line:** Web Push is "best-effort ring" — it works often enough to be worth wiring, but production calling apps must have a missed-call email/SMS fallback. The skill warns the user about this explicitly during scaffold.

---

## When NOT to bother with Web Push

- Internal tools where users keep the tab open during work hours — `<CometChatIncomingCall />` mounted at root rings the tab itself, which is enough.
- Apps where the call surface is a route the user navigates to deliberately (telehealth waiting room) — the ring happens when they arrive on the route; they don't need to be paged.
- Greenfield projects that haven't shipped to production yet — add it later when missed-calls become a real complaint.

The dispatcher's Step 3 in `cometchat-react-calls/SKILL.md` asks the user whether to scaffold Web Push. Default = no for "just exploring" / "messaging app" intents; default = yes for "support" / "marketplace" intents (where users may receive a call without expecting it).
