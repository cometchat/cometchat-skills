# Server-side push routing for React Native (iOS PushKit + Android FCM)

React Native projects target iOS and Android — your server needs to dispatch the right kind of push to each platform. Use the iOS canonical (APNs PushKit + .p8) for iPhone tokens and the Android canonical (FCM HTTP v1 + service account) for Android tokens.

**Canonical docs:**
- iOS: `cometchat-ios-calls/references/server-apns-pushkit.md`
- Android: `cometchat-android-v5-calls/references/server-fcm-voip.md`

---

## Token registration (RN client)

```tsx
// On app start, after CometChat login completes
import VoipPushNotification from "react-native-voip-push-notification";
import messaging from "@react-native-firebase/messaging";
import { Platform } from "react-native";

async function registerCallPushTokens(userUid: string) {
  if (Platform.OS === "ios") {
    VoipPushNotification.addEventListener("register", async (token) => {
      await api.registerCallToken({
        uid: userUid,
        platform: "ios-voip",
        token,
      });
    });
    VoipPushNotification.addEventListener("notification", (payload) => {
      // CallKeep takes over from here — see cometchat-native-calls/SKILL.md rule 4
    });
    VoipPushNotification.registerVoipToken();
  } else if (Platform.OS === "android") {
    await messaging().requestPermission();
    const fcmToken = await messaging().getToken();
    await api.registerCallToken({
      uid: userUid,
      platform: "android-fcm",
      token: fcmToken,
    });

    messaging().onTokenRefresh(async (newToken) => {
      await api.registerCallToken({
        uid: userUid,
        platform: "android-fcm",
        token: newToken,
      });
    });
  }
}
```

---

## Server-side dispatcher

Single webhook handler routes by platform:

```js
import { sendVoipPush as sendApns } from "./apns-pushkit.js";   // iOS canonical template
import { sendAndroidVoipPush } from "./fcm-voip.js";             // Android canonical template

app.post("/webhooks/call", verifyCometChatWebhook, async (req, res) => {
  if (req.body.trigger !== "call_initiated") return res.status(200).end();

  const { sessionId, type, initiator, receiver } = req.body.data;
  const tokens = await db.getActiveCallTokens(receiver.uid);  // returns [{platform, token}, ...]

  // Fan out to all the user's devices in parallel
  const sends = tokens.map((t) => {
    const payload = {
      recipientUid: receiver.uid,
      sessionId,
      callerName: initiator.name,
      callerUid: initiator.uid,
      callType: type,
    };
    if (t.platform === "ios-voip") return sendApns({ ...payload, pushKitToken: t.token });
    if (t.platform === "android-fcm") return sendAndroidVoipPush({ ...payload, fcmToken: t.token });
    return Promise.resolve();
  });

  await Promise.allSettled(sends);
  res.status(200).end();
});
```

---

## Schema for tokens

```sql
CREATE TABLE call_push_tokens (
  uid          text NOT NULL,
  platform     text NOT NULL CHECK (platform IN ('ios-voip', 'android-fcm')),
  token        text NOT NULL,
  device_id    text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, platform, token)
);

CREATE INDEX idx_call_push_tokens_uid ON call_push_tokens(uid);
```

Why include `device_id`: a user may have iPhone + iPad + Android tablet. Allow multiple tokens per (uid, platform).

---

## Anti-patterns

iOS + Android sister rules apply, plus RN-specific:

1. **Single token table without `platform` column.** Can't tell which dispatcher to use → wrong push API → silent failure.
2. **Registering FCM token before login.** No user UID, can't store correctly. Register tokens AFTER `CometChat.login` resolves.
3. **Forgetting `messaging().onTokenRefresh`.** FCM tokens rotate every few months. Without refresh, push silently breaks.
4. **Returning the Promise.allSettled to the webhook caller.** CometChat retries on slow/failed webhooks; awaiting all pushes can block 5+ seconds. Use a queue (BullMQ/SQS): enqueue job, return 200 immediately.

---

## Verification checklist

- [ ] iOS: VoipPushNotification configured + token registered post-login
- [ ] Android: messaging() permission requested + token registered + onTokenRefresh handler
- [ ] Server has both apns-pushkit + fcm-voip dispatchers wired
- [ ] Webhook returns 200 within 1s (push enqueued)
- [ ] Token table supports multiple devices per user
- [ ] Real-device smoke: iPhone + Android both ring when caller dials

---

## Pointers

- `cometchat-ios-calls/references/server-apns-pushkit.md` — iOS canonical
- `cometchat-android-v5-calls/references/server-fcm-voip.md` — Android canonical
- `cometchat-native-calls` SKILL.md — RN seven hard rules (CallKeep + VoipPush wiring)
- `cometchat-native-push/SKILL.md` — chat push (sister, different payload)
