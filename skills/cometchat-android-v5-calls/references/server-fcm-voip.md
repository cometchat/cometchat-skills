# Server-side FCM HTTP v1 for Android VoIP push

When a CometChat call event fires, your server sends a **high-priority FCM data message** to the recipient's Android device. The app's `FirebaseMessagingService` receives it (even when killed/backgrounded) and starts a `ConnectionService` that surfaces the OS-level incoming-call UI. Without this, Android won't ring when the app is backgrounded.

**Canonical docs:** https://firebase.google.com/docs/cloud-messaging/migrate-v1, https://developer.android.com/develop/connectivity/telecom

---

## Hard rules

1. **HTTP v1 API only.** Legacy `/fcm/send` is deprecated since 2024-06. Use `https://fcm.googleapis.com/v1/projects/{projectId}/messages:send` with OAuth2 service-account auth.
2. **Data-only message** (no `notification` field). System notifications are throttled by Android Doze; data messages with high priority bypass.
3. **`priority: HIGH`** + **`android.priority: HIGH`**. High priority bypasses Doze for the next 10s; long enough to get the user to answer.
4. **Show OS UI within ~10s of receiving the data message.** Android 14+ enforces this — late notifications fail with `ERR_FOREGROUND_SERVICE_TYPE_MICROPHONE_DENIED` or get silently dropped.
5. **`time_to_live: 30`** seconds. VoIP push must be fast or fail.
6. **Don't include sensitive data in the payload.** Auth keys / tokens never go in the push — only `sessionId` + display strings.

---

## Service-account setup

1. Firebase Console → Project Settings → Service accounts → "Generate new private key"
2. Download the JSON file. Store securely (Secret Manager / Vault).
3. The service account has `firebase.messaging` scope by default.

---

## Node.js template (Firebase Admin SDK)

```js
// npm install firebase-admin
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
});

export async function sendAndroidVoipPush(opts) {
  const { recipientUid, sessionId, callerName, callerUid, callType } = opts;

  const fcmToken = await db.getFcmToken(recipientUid);
  if (!fcmToken) return; // not on Android or token expired

  const message = {
    token: fcmToken,
    // Data-only — see Hard Rule 2
    data: {
      type: "incoming_call",
      sessionId: String(sessionId),
      callerName: String(callerName),
      callerUid: String(callerUid),
      callType: String(callType), // "audio" | "video"
      timestamp: String(Date.now()),
    },
    android: {
      priority: "HIGH",      // Hard Rule 3
      ttl: 30 * 1000,        // Hard Rule 5 — milliseconds
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (err) {
    if (err.code === "messaging/registration-token-not-registered") {
      // Token is dead — drop it
      await db.removeFcmToken(recipientUid, fcmToken);
      return;
    }
    throw err;
  }
}
```

---

## Python template (google-auth + httpx, no Firebase Admin SDK)

```python
# pip install google-auth httpx
import time, json, httpx
from google.oauth2 import service_account
from google.auth.transport.requests import Request

CREDS = service_account.Credentials.from_service_account_file(
    "/secrets/firebase-service-account.json",
    scopes=["https://www.googleapis.com/auth/firebase.messaging"],
)
PROJECT_ID = os.environ["FIREBASE_PROJECT_ID"]
FCM_URL = f"https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send"

def access_token() -> str:
    if not CREDS.valid:
        CREDS.refresh(Request())
    return CREDS.token

async def send_android_voip_push(fcm_token: str, payload: dict):
    body = {
        "message": {
            "token": fcm_token,
            "data": {k: str(v) for k, v in payload.items()},  # data values must be strings
            "android": {"priority": "HIGH", "ttl": "30s"},
        }
    }
    headers = {
        "authorization": f"Bearer {access_token()}",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(FCM_URL, json=body, headers=headers)
        if r.status_code == 404:
            error = r.json().get("error", {})
            if error.get("status") == "NOT_FOUND" or "UNREGISTERED" in str(error):
                return "unregistered"
        r.raise_for_status()
```

---

## Receiver side (Android V5)

The Android client's `FirebaseMessagingService` receives the data message and starts a `ConnectionService`:

```kotlin
class VoipMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    if (data["type"] != "incoming_call") return

    val sessionId = data["sessionId"] ?: return
    val callerName = data["callerName"] ?: "Unknown"
    val callType = data["callType"] ?: "audio"

    // Hard Rule 4 — show OS UI within ~10s
    val telecom = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
    val handle = PhoneAccountHandle(
      ComponentName(this, AppConnectionService::class.java),
      "cometchat-voip"
    )
    val extras = Bundle().apply {
      putString("sessionId", sessionId)
      putString("callerName", callerName)
      putString("callType", callType)
    }
    telecom.addNewIncomingCall(handle, Bundle().apply {
      putBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, extras)
    })
  }

  override fun onNewToken(token: String) {
    // Send to your server
    // api.registerFcmToken(currentUserUid, token)
  }
}
```

Plus an `AppConnectionService extends ConnectionService` (see `cometchat-android-v5-calls/SKILL.md` rule 4). The `ConnectionService` calls `setRinging()` on the Connection, which surfaces the system incoming-call UI.

---

## Webhook handler shape

Same as iOS — verify signature, dispatch by recipient platform:

```js
app.post("/webhooks/call", async (req, res) => {
  if (req.body.trigger !== "call_initiated") return res.status(200).end();
  const { sessionId, type, initiator, receiver } = req.body.data;
  const platform = await db.getPushPlatform(receiver.uid);
  if (platform === "ios") {
    await sendVoipPush({ /* see cometchat-ios-calls/references/server-apns-pushkit.md */ });
  } else if (platform === "android") {
    await sendAndroidVoipPush({
      recipientUid: receiver.uid,
      sessionId, callerName: initiator.name, callerUid: initiator.uid, callType: type,
    });
  }
  // Many users have multiple devices — fan out to ALL active tokens
  res.status(200).end();
});
```

---

## Anti-patterns

1. **Sending a `notification` field.** Android shows a regular system notification, doesn't wake your service. VoIP UX dies.
2. **Skipping `priority: HIGH`.** Doze mode swallows the message until the next maintenance window — call rings 30 minutes later.
3. **Using legacy `/fcm/send` endpoint.** Returns 401/404 since 2024-06. Migrate to HTTP v1.
4. **Hardcoding service-account JSON in source.** Largest source of FCM credential leaks. Always env var or Secret Manager.
5. **Forgetting to start `ConnectionService.setForeground()` from `onMessageReceived`.** Android 14+: `ForegroundServiceTypeException`. Use `setRinging()` on the Connection, which is exempt.
6. **Storing FCM token only at app install.** FCM tokens rotate. Implement `onNewToken` and POST the new token immediately.

---

## Verification checklist

- [ ] HTTP v1 API used (not legacy `/fcm/send`)
- [ ] Service account JSON in Secret Manager
- [ ] `priority: HIGH`, `ttl: 30s`, data-only payload
- [ ] Android client `onMessageReceived` calls `addNewIncomingCall` within ~10s
- [ ] `ConnectionService` declared in manifest with telecom permissions
- [ ] FCM token rotation handled (`onNewToken` POSTs to your API)
- [ ] 404/UNREGISTERED responses purge dead tokens
- [ ] Real-device smoke: app killed → caller dials → recipient device rings + lock-screen UI

---

## Pointers

- `cometchat-android-v5-calls/SKILL.md` — seven hard rules (init order, ConnectionService, foreground type)
- `cometchat-android-v5-calls/references/server-fcm-voip.md` — this doc (canonical)
- `cometchat-android-v6-calls/references/server-fcm-voip.md` — V6 sister (Compose VoIP receiver patterns)
- `cometchat-ios-calls/references/server-apns-pushkit.md` — iOS sibling
- FCM HTTP v1: https://firebase.google.com/docs/cloud-messaging/migrate-v1
- Android Telecom: https://developer.android.com/develop/connectivity/telecom
