# Server-side APNs PushKit for iOS VoIP

When a CometChat call event fires (`onIncomingCallReceived` → CometChat backend webhook), your server sends a **VoIP push** to the recipient's iPhone via Apple's PushKit. Your app's PushKit delegate then triggers CallKit's incoming-call UI. Without VoIP push, the recipient's phone won't ring when the app is backgrounded.

**Canonical docs:** https://developer.apple.com/documentation/pushkit, https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns

---

## Hard rules

1. **VoIP push is .p8 only** (token-auth). Old .pem cert auth was deprecated in 2020 and is no longer supported for VoIP.
2. **Use a separate APNs topic.** VoIP topic = `<bundle-id>.voip`. NOT the same as your regular APNs topic.
3. **`apns-push-type: voip`** header is mandatory. Apple drops the push silently if missing.
4. **`apns-priority: 10`** (immediate). VoIP must be high-priority.
5. **Must report to CallKit within ~5 seconds.** PushKit gives you a tiny window — if you don't call `CXProvider.reportNewIncomingCall(with:update:)` fast, iOS terminates your app and counts a strike. Three strikes in 24h and Apple revokes your VoIP entitlement.
6. **VoIP push payload size ≤ 4KB.** Include the minimum (`sessionId`, `callerName`, `callType`); fetch the rest after CallKit is reported.

---

## .p8 setup

1. Apple Developer Portal → Certificates, Identifiers & Profiles → **Keys** → "+"
2. Enable **Apple Push Notifications service (APNs)** → Continue → Register
3. Download the `.p8` file. **Save it — Apple shows it once.**
4. Note the **Key ID** (10-char alphanumeric).
5. Note your **Team ID** (top-right of Apple Developer dashboard).

Store securely on your server (Secret Manager / Vault — never in source).

---

## Node.js template

```js
// npm install @parse/node-apn
import apn from "@parse/node-apn";
import fs from "fs";

const provider = new apn.Provider({
  token: {
    key: fs.readFileSync("/secrets/AuthKey_ABC123.p8"),
    keyId: process.env.APNS_KEY_ID,       // e.g. "ABC123XYZ"
    teamId: process.env.APNS_TEAM_ID,     // e.g. "TEAM12345"
  },
  production: process.env.NODE_ENV === "production",
});

/**
 * Called from your CometChat call-event webhook handler.
 * Looks up the recipient's PushKit token (you stored it when their app
 * registered) and fires the VoIP push.
 */
export async function sendVoipPush(opts) {
  const { recipientUid, sessionId, callerName, callerUid, callType } = opts;

  const pushKitToken = await db.getVoipToken(recipientUid);
  if (!pushKitToken) return; // user not on iOS or token expired

  const note = new apn.Notification();
  note.topic = `${process.env.APNS_BUNDLE_ID}.voip`;  // <bundle>.voip — required
  note.pushType = "voip";                              // apns-push-type: voip
  note.priority = 10;                                  // apns-priority: 10 — immediate
  note.expiry = Math.floor(Date.now() / 1000) + 30;    // 30s — VoIP push must fire fast

  // Custom payload — keep ≤4KB, include only what CallKit needs
  note.rawPayload = {
    aps: { "content-available": 1 },
    sessionId,
    callerName,
    callerUid,
    callType,        // "audio" | "video"
    timestamp: Date.now(),
  };

  const result = await provider.send(note, pushKitToken);
  if (result.failed.length > 0) {
    const fail = result.failed[0];
    if (fail.status === "410" || fail.response?.reason === "Unregistered") {
      // Token is dead — remove from DB so we don't keep retrying
      await db.removeVoipToken(recipientUid, pushKitToken);
    }
    console.error("APNs VoIP push failed", fail);
    return;
  }
}
```

---

## Python template

```python
# pip install httpx pyjwt cryptography
import time, json, jwt, httpx
from cryptography.hazmat.primitives.serialization import load_pem_private_key

PRIVATE_KEY = load_pem_private_key(
    open("/secrets/AuthKey_ABC123.p8", "rb").read(), password=None
)
KEY_ID = os.environ["APNS_KEY_ID"]
TEAM_ID = os.environ["APNS_TEAM_ID"]
BUNDLE_ID = os.environ["APNS_BUNDLE_ID"]
APNS_HOST = "https://api.push.apple.com" if os.environ.get("ENV") == "production" else "https://api.sandbox.push.apple.com"

# Provider tokens are valid for 1h; cache + refresh
_token_cache = {"token": None, "issued_at": 0}

def provider_token() -> str:
    if time.time() - _token_cache["issued_at"] < 3000:  # refresh every 50min
        return _token_cache["token"]
    token = jwt.encode(
        {"iss": TEAM_ID, "iat": int(time.time())},
        PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": KEY_ID},
    )
    _token_cache.update(token=token, issued_at=time.time())
    return token

async def send_voip_push(pushkit_token: str, payload: dict):
    headers = {
        "authorization": f"bearer {provider_token()}",
        "apns-topic": f"{BUNDLE_ID}.voip",
        "apns-push-type": "voip",
        "apns-priority": "10",
        "apns-expiration": str(int(time.time()) + 30),
    }
    async with httpx.AsyncClient(http2=True) as client:
        r = await client.post(
            f"{APNS_HOST}/3/device/{pushkit_token}",
            headers=headers,
            content=json.dumps(payload),
        )
        if r.status_code == 410:
            # Token unregistered — remove from DB
            return "unregistered"
        if r.status_code != 200:
            raise RuntimeError(f"APNs error {r.status_code}: {r.text}")
```

---

## Webhook payload from CometChat

In the CometChat dashboard, configure a **Webhook** → "Call events" → POST to `https://yourserver.com/webhooks/call`. The body shape:

```json
{
  "trigger": "call_initiated",
  "data": {
    "id": "session-uuid",
    "sessionId": "session-uuid",
    "type": "video",
    "initiator": { "uid": "alice", "name": "Alice" },
    "receiver": { "uid": "bob", "name": "Bob" },
    "receiverType": "user"
  }
}
```

Your handler:

```js
app.post("/webhooks/call", async (req, res) => {
  // 1. Verify webhook signature (X-CometChat-Signature header)
  const sig = req.headers["x-cometchat-signature"];
  const expected = crypto.createHmac("sha256", process.env.COMETCHAT_WEBHOOK_SECRET)
    .update(req.rawBody).digest("hex");
  if (sig !== expected) return res.status(401).end();

  // 2. Only fire VoIP push on call_initiated (not on call-ended)
  if (req.body.trigger !== "call_initiated") return res.status(200).end();

  // 3. Forward to platform-specific push
  const { sessionId, type, initiator, receiver } = req.body.data;
  await sendVoipPush({
    recipientUid: receiver.uid,
    sessionId,
    callerName: initiator.name,
    callerUid: initiator.uid,
    callType: type,
  });

  res.status(200).end();
});
```

---

## Token registration (the round-trip)

When your iOS app launches, register PushKit and POST the token to your server:

```swift
// AppDelegate or dedicated VoIP manager
import PushKit

class VoipPushHandler: NSObject, PKPushRegistryDelegate {
  let registry = PKPushRegistry(queue: .main)

  override init() {
    super.init()
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
  }

  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    guard type == .voIP else { return }
    let token = credentials.token.map { String(format: "%02x", $0) }.joined()
    Task { try? await api.registerVoipToken(uid: currentUserUid, token: token) }
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    Task { try? await api.removeVoipToken(uid: currentUserUid) }
  }

  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    // Report to CallKit IMMEDIATELY — Apple gives you ~5s
    let dict = payload.dictionaryPayload
    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: dict["callerUid"] as? String ?? "Unknown")
    update.localizedCallerName = dict["callerName"] as? String ?? "Unknown"
    update.hasVideo = (dict["callType"] as? String) == "video"

    let uuid = UUID()
    callProvider.reportNewIncomingCall(with: uuid, update: update) { error in
      if let error = error { print("CallKit reportNewIncomingCall failed:", error) }
      completion()
    }
  }
}
```

---

## Anti-patterns

1. **Using regular APNs token, not VoIP.** Push arrives but CallKit doesn't trigger — the app got woken up, not put into "incoming call" state.
2. **Forgetting `apns-push-type: voip`.** Apple drops the push, no error to your server.
3. **Not calling `reportNewIncomingCall` from `didReceiveIncomingPushWith`.** Three strikes → entitlement revoked.
4. **Sending too much in the VoIP payload.** Apple throttles or rejects >4KB. Send minimum, fetch the rest after CallKit fires.
5. **Webhook handler doing slow work synchronously.** Push to a queue (Redis, SQS, BullMQ); return 200 immediately. Slow webhook = CometChat retries = duplicate calls.
6. **Same token for chat push and VoIP push.** Different tokens — you must register both via `UNUserNotificationCenter` (regular) AND `PKPushRegistry` (VoIP).

---

## Verification checklist

- [ ] `.p8` key stored in secret manager
- [ ] `apns-topic = <bundle-id>.voip`
- [ ] `apns-push-type: voip` + `apns-priority: 10`
- [ ] `reportNewIncomingCall` fires from PushKit delegate inside ~5s
- [ ] 410 responses purge dead tokens from DB
- [ ] Webhook signature verified before processing
- [ ] Webhook returns 200 within 1s (push enqueued, not awaited)
- [ ] Real-device smoke: backgrounded recipient → caller dials → recipient phone rings on lock screen

---

## Pointers

- `cometchat-ios-calls/SKILL.md` — the seven hard rules (init order, IncomingCall mounting, hangup teardown)
- `cometchat-ios-push/SKILL.md` — chat push (sister, different APNs topic)
- `cometchat-android-v5-calls/references/server-fcm-voip.md` — Android sibling (FCM HTTP v1)
- `cometchat-react-calls/references/server-web-push-vapid.md` — Web sibling
- Apple PushKit: https://developer.apple.com/documentation/pushkit
- APNs HTTP/2 reference: https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
