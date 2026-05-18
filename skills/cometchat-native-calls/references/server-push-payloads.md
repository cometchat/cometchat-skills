# Server-side push payloads for RN calls

The RN client only handles received pushes. The server side — building and sending the payloads — is yours to implement. This reference is a copy-paste-ready Node.js example the skill points users at.

---

## What the server has to do

1. Subscribe to CometChat's `call.received` webhook (Dashboard → Webhooks)
2. When fired, look up the receiver UID's stored push tokens (PushKit + FCM)
3. Send a VoIP-shaped payload to each platform with the right priority + cert

Two endpoints, two payload shapes, one webhook. Simple but easy to get wrong.

---

## Express skeleton

```ts
// server/push-handler.ts
import express from "express";
import apn from "node-apn";                                  // npm i node-apn
import admin from "firebase-admin";                          // npm i firebase-admin

const app = express();
app.use(express.json());

// Initialize APNs (PushKit) provider with your VoIP cert
const voipCert = apn.Provider({
  token: undefined,
  cert: process.env.APNS_VOIP_CERT_PATH,                    // path to your VoIP .p12 / .pem
  key: process.env.APNS_VOIP_KEY_PATH,
  passphrase: process.env.APNS_VOIP_PASSPHRASE,
  production: process.env.NODE_ENV === "production",
});

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  }),
});

// CometChat webhook — fired when a call is initiated
app.post("/webhook/cometchat/call-received", async (req, res) => {
  const { receiver, sender, sessionId, type } = req.body.data;
  const subs = await getPushSubscriptionsForUid(receiver);  // your DB

  await Promise.allSettled([
    ...subs.ios.map((token) => sendIOSVoip(token, { sessionId, callerName: sender.name, callerUid: sender.uid, callType: type })),
    ...subs.android.map((token) => sendAndroidVoip(token, { sessionId, callerName: sender.name, callerUid: sender.uid, callType: type })),
  ]);

  res.status(200).send({ ok: true });
});

async function sendIOSVoip(token: string, payload: { sessionId: string; callerName: string; callerUid: string; callType: string }) {
  const note = new apn.Notification();
  note.topic = `${process.env.IOS_BUNDLE_ID}.voip`;          // CRITICAL: voip topic, not the bundle id
  note.pushType = "voip";                                     // CRITICAL
  note.priority = 10;
  note.expiry = Math.floor(Date.now() / 1000) + 30;          // expire in 30s — call rings or doesn't
  note.payload = {
    "content-available": 1,
    data: payload,
  };

  const result = await voipCert.send(note, token);
  if (result.failed.length > 0) {
    console.error("PushKit send failed:", result.failed);
  }
}

async function sendAndroidVoip(token: string, payload: { sessionId: string; callerName: string; callerUid: string; callType: string }) {
  await admin.messaging().send({
    token,
    android: {
      priority: "high",                                       // CRITICAL — without this, FCM may delay
      ttl: 30 * 1000,                                         // 30s TTL
    },
    data: {                                                   // CRITICAL — `data`, not `notification`
      type: "incoming_call",
      sessionId: payload.sessionId,
      callerName: payload.callerName,
      callerUid: payload.callerUid,
      callType: payload.callType,
    },
  });
}

app.listen(3000);
```

The skill writes this file as `server/push.example.ts` next to a README pointing at the env vars + cert paths.

---

## Token registration endpoint

The client sends its tokens to your server when the user logs in:

```ts
// Client side
import VoipPushNotification from "react-native-voip-push-notification";
import messaging from "@react-native-firebase/messaging";

async function registerPushTokens(cometchatUid: string) {
  if (Platform.OS === "ios") {
    VoipPushNotification.addEventListener("register", async (token) => {
      await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: cometchatUid, platform: "ios", token }),
      });
    });
    VoipPushNotification.registerVoipToken();
  } else {
    const token = await messaging().getToken();
    await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: cometchatUid, platform: "android", token }),
    });
  }
}
```

Server stores tokens keyed by `(cometchatUid, platform)`. On logout, call `/api/push/unregister` to clean up.

---

## Token rotation

Both PushKit and FCM tokens can rotate without warning (OS upgrades, app reinstalls, expirations).

- iOS PushKit: handle `didInvalidatePushToken` and re-register
- FCM: handle `messaging().onTokenRefresh` and re-register

```ts
// iOS
VoipPushNotification.addEventListener("didInvalidatePushToken", async () => {
  // wait for next register event, will fire automatically
});

// Android
messaging().onTokenRefresh(async (newToken) => {
  await fetch("/api/push/register", {
    method: "POST",
    body: JSON.stringify({ uid: getCurrentUid(), platform: "android", token: newToken }),
  });
});
```

---

## Webhook verification

CometChat signs webhooks. Verify the signature before trusting payloads:

```ts
import crypto from "crypto";

app.post("/webhook/cometchat/call-received", (req, res, next) => {
  const signature = req.header("x-cometchat-signature");
  const expected = crypto
    .createHmac("sha256", process.env.COMETCHAT_WEBHOOK_SECRET!)
    .update(JSON.stringify(req.body))
    .digest("hex");
  if (signature !== expected) return res.status(401).send({ error: "invalid signature" });
  next();
});
```

Without this, anyone with your endpoint URL can ring your users.

---

## Rate limits

- **APNs:** 4000 notifications/sec per cert. Far above what an app needs for VoIP.
- **FCM:** 1000 tokens per `send()` call (use `sendMulticast` for batches). Per-token rate limits not enforced strictly.

For one-call-at-a-time semantics, you won't hit either. For broadcast scenarios (multi-party "ring everyone"), batch sends instead of looping `send()`.

---

## Testing the server locally

ngrok the webhook endpoint to a public URL, register it in CometChat dashboard. Two real devices (one iOS, one Android) on real networks. Trigger a call from device A to device B; watch the server logs for the webhook fire and the push send.

For unit tests, mock the apn + firebase-admin modules. Don't try to test real APNs/FCM in CI — certs and rate limits make it hostile.
