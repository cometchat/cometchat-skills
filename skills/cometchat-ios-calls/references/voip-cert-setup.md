# VoIP cert setup — the manual Apple Developer steps

The skill cannot automate these. They require browser access to https://developer.apple.com and physical possession of the developer team's signing identity. This reference is the printed instruction sheet the dispatcher hands the user.

Print this verbatim during scaffold; pause execution until the user confirms each step.

---

## What you're creating

A **VoIP Services certificate** is a separate certificate from your standard APNs (push notifications) certificate. It's specifically for PushKit VoIP delivery — the high-priority, terminated-app-wakeup channel iOS provides for calling apps.

Without this certificate, your push server cannot deliver VoIP pushes. The OS won't ring the user's lock screen. CallKit never fires.

---

## Prerequisites

- Apple Developer Program membership (paid — free accounts can't create VoIP certs)
- Admin or App Manager role in the developer team
- The bundle ID of your app already registered in https://developer.apple.com/account/resources/identifiers/list
- Mac with Keychain Access (the cert must be generated from a CSR signed by your dev keychain)

---

## Step-by-step

### 1. Generate a Certificate Signing Request

On your Mac:

1. Open **Keychain Access** (`/Applications/Utilities/Keychain Access.app`)
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority...**
3. Fill in:
   - **User Email Address:** your Apple ID email
   - **Common Name:** something like "YourApp VoIP CSR"
   - **CA Email Address:** leave blank
   - **Request is:** Saved to disk + Let me specify key pair information (check both)
4. Click Continue → save the `.certSigningRequest` file (e.g. to Desktop)
5. On the key-pair-info screen: 2048 bits, RSA → Continue → save

### 2. Create the cert in Apple Developer portal

1. Open https://developer.apple.com/account/resources/certificates/list
2. Click the "+" button to add a new certificate
3. Under "Services", select **VoIP Services Certificate** → Continue
4. Pick the App ID (bundle ID) of your app from the dropdown → Continue
5. Upload the `.certSigningRequest` file you just created → Continue
6. Apple generates the cert. Click **Download** → saves a `.cer` file (e.g. `voip_services.cer`)

### 3. Install the cert in Keychain

1. Double-click the `.cer` file → Keychain Access opens with the cert added
2. Find it in the "My Certificates" category — should expand to show a private key alongside

### 4. Export as .p12

1. Right-click the cert → **Export "VoIP Services: ..."**
2. File Format: **Personal Information Exchange (.p12)**
3. Save → enter a passphrase (you'll need this on the push server)
4. Output: a `.p12` file (e.g. `voip_services.p12`)

### 5. (Optional) Convert .p12 to .pem for some push libs

Some Node.js libraries (e.g. `node-apn` older versions) need `.pem`:

```bash
openssl pkcs12 -in voip_services.p12 -out voip_cert.pem -nodes -clcerts
```

The `.pem` contains both cert and key.

### 6. Upload to your push server

Where this goes depends on your stack:

- **Node.js (`node-apn` v3+):** point at the `.p12` file via `cert: { path, passphrase }`
- **Server-side using `apn` lib:** load the cert + key
- **Self-managed APNs:** use the .p12 directly via `curl` to APNs HTTP/2 endpoint
- **Third-party services (OneSignal, Firebase APNs forwarding):** they have UIs to upload the .p12 + passphrase

---

## Critical detail: the topic

When sending a VoIP push, the APNs `topic` header MUST be your bundle ID **with `.voip` suffix**:

```
apns-topic: com.yourcompany.yourapp.voip
```

NOT just `com.yourcompany.yourapp` — that's the standard APNs topic for non-VoIP pushes. The two are separate channels.

If you set the wrong topic, APNs returns `BadDeviceToken` or `TopicMismatch` and your call doesn't ring.

In `node-apn`:

```ts
const note = new apn.Notification();
note.topic = `${process.env.IOS_BUNDLE_ID}.voip`;
note.pushType = "voip";
```

`pushType: "voip"` is required by APNs HTTP/2 protocol since iOS 13.

---

## Cert expiration

VoIP certs expire after **1 year**. Calendar this — Apple will email a warning ~30 days before expiry, but it's easy to miss in inbox noise. When the cert expires:

- iOS devices keep working briefly (cached subscriptions)
- New incoming-call pushes silently fail
- Users complain "I'm not getting calls anymore"

Renew by repeating steps 1-6. The new cert can replace the old in your push server with no client-side change required (devices use the same VoIP push token).

---

## Bypassing the cert: APNs Auth Tokens (.p8)

Apple now supports **token-based auth** for APNs (since iOS 10) — a `.p8` key + key ID + team ID instead of a per-app cert. Pros:

- Single key works for all your apps (vs one cert per bundle)
- Doesn't expire (you rotate manually when you want)
- Easier rotation

Cons:

- Some older push libraries don't support it
- Setup process is different

To use:

1. Apple Developer portal → Keys → "+" → APNs (Authentication Key)
2. Download the `.p8` (one-time download — Apple won't let you download it again)
3. Note the Key ID + Team ID
4. Configure your push lib with `{ token: { key: ".p8 contents", keyId, teamId } }`

The skill prefers token-auth for new push servers; uses cert auth if the project already has one.

---

## When stuck

| Error | Fix |
|---|---|
| `BadDeviceToken` from APNs | Topic mismatch — `.voip` suffix missing, or production token used with sandbox cert |
| `TopicDisallowed` | The cert is for a different bundle ID |
| `Unregistered` | Token expired or app uninstalled — drop from your DB |
| `BadCertificate` | Cert expired or tampered — re-export or re-generate |
| `BadCertificateEnvironment` | Production cert + sandbox token, or vice versa |
| `Forbidden` | Cert revoked or topic doesn't match |

---

## Sandbox vs production

Apple has two APNs environments:

- **Sandbox** (Xcode debug builds, dev provisioning profile) — uses sandbox APNs (api.sandbox.push.apple.com)
- **Production** (TestFlight + App Store, distribution profile) — uses production APNs (api.push.apple.com)

VoIP cert covers both — the same cert works for sandbox and production tokens. But the SERVER must hit the right endpoint depending on which environment the device token was registered against.

The skill writes the push server with environment switching (`production: process.env.NODE_ENV === "production"` for `node-apn`).
