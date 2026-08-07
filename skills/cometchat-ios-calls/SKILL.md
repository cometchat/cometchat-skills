---
name: cometchat-ios-calls
description: CometChat Calls SDK v5 integration for native iOS (Swift; SwiftUI + UIKit hosting). Covers SDK install (SPM + CocoaPods), file-based init via cometchat-settings.json (CometChatCalls.initFromSettings, ai-agent telemetry) with builder fallback, dual-SDK ringing (Chat SDK initiateCall + Calls SDK generateToken/startSession), CallKit + PushKit VoIP push, AVAudioSession routing, mixed-stack hosting (UIViewControllerRepresentable for SwiftUI), Info.plist permissions + Background Modes, and additive-vs-standalone modes.
license: "MIT"
compatibility: "Xcode 15+, Swift 5.9+, iOS 15.1+ deployment target (CometChatCallsSDK 5.0.2+; 13.0 only for <= 5.0.1); CometChatSDK 4.x; CometChatUIKitSwift 5.x (additive mode)"
metadata:
  author: "CometChat"
  version: "4.1.0"
  tags: "cometchat ios calls voice video webrtc swift swiftui uikit callkit pushkit avaudiosession spm cocoapods voip background-modes"
---

## Purpose

Production-grade voice + video calling for native iOS. Loaded by `cometchat-calls` when `framework === "ios"`. Operates in two modes:

- **Standalone** — calls is the product. `CometChatSDK` (signaling) + `CometChatCallsSDK` (WebRTC) + your own SwiftUI views or UIKit view controllers. **CallKit + PushKit are mandatory.**
- **Additive** — calls layered onto an existing CometChat iOS UI Kit integration. The kit's `CometChatMessageHeader` already exposes call buttons; this skill wires them and mounts the global call listener.

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-ios-core` — Chat SDK init, login, `Secrets.swift` / `.xcconfig` credential conventions, SwiftUI vs UIKit entry-point detection

**Ground truth:**
- SDK source — `calls-sdk-ios-5/sdk/`
- Sample app — `calls-sdk-ios-5/sample-apps/cometchat-calls-sample-app-ios/`
- `Package.swift` — `https://github.com/cometchat/calls-sdk-ios.git` (SPM)
- Public docs — https://www.cometchat.com/docs/calls/ios/overview

---

## iOS Calls SDK v5 resolution — verified working (re-checked 2026-06-04)

> An earlier draft of this skill warned that "the iOS Calls SDK v5 binary is broken / missing from Cloudsmith — stay on v4.2.x." **That warning was wrong and has been removed.** It was based on a hand-constructed URL (`…/raw/versions/124.0.4/CometChatWebRTC-124.0.4.xcframework.zip`) that 404s — but that is NOT the path the podspec/`Package.swift` actually fetches, so its 404 never proved anything. Verified 2026-06-04:
> - **Additive (UI Kit) path:** `CometChatCallsSDK` v5 ships **vendored inside `CometChatUIKitSwift`** — a clean `pod install` resolves `CometChatUIKitSwift (5.1.13)` (which bundles the v5 CallsSDK framework) with **no 404**. The audited `CometChatCallsSDK.swiftinterface` (v5 shape: `generateToken`/`startSession`, no `login`) came straight out of that resolved framework.
> - **Standalone path:** `CometChatCallsSDK` v5.0.0 is consumable via CocoaPods (e.g. the internal VoIP+APNs sample under Linear ENG-35167 builds against it).
>
> If you ever DO hit a missing-WebRTC binary on a direct standalone `pod 'CometChatCallsSDK'` install, treat it as an environment/registry hiccup and check the current podspec URL — it is not a known blanket failure, and there is no open vendor ticket for it.

---

## 1. The seven hard rules — iOS specialization

> ⚠️ **TOP PRIORITY (ENG-35710): Auth-token passing is the most-broken step on iOS Calls integrations.** Unlike Android / Flutter / JS, the **iOS Calls SDK 5.x has NO separate login step** — there is no `CometChatCalls.login(...)` and no `CometChatCalls.getLoggedInUser()` (those are phantom; verified absent from `CometChatCallsSDK` — **in 5.0.1 and earlier; 5.0.2 restores them — see the §1.0 correction**). Auth is supplied **per session** as the `authToken:` argument to `CometChatCalls.generateToken(authToken:sessionID:)`. Every tester who hit "calls don't work" on iOS traced back to that token: (a) the token was empty/nil → `generateToken` fails with **"auth token cannot be null"**; (b) a server-minted token expired between mint and `generateToken` (default ~30-minute TTL); (c) the client-side `apiKey` was passed instead of the user's auth token. Before scaffolding ANY iOS calls code, confirm the auth path (dev: read `CometChat.getUserAuthToken()`; production: fetch a fresh server-minted token) and feed it to `generateToken`. Mixing them is the canonical "ringing but never joins" iOS failure mode.

### 1.0 The iOS Calls SDK has NO separate login (v5) — CORRECTED for 5.0.2 (2026-07-21)

> **Correction (ENG-37137, verified against the published 5.0.2 binary + live end-to-end test 2026-07-21):** the "no login" claim below is TRUE for the UI Kit-vendored calls framework and for standalone **5.0.1 and earlier**, but **standalone `CometChatCallsSDK` 5.0.2 exports `login(UID:authKey:)` / `login(UID:apiKey:)` / `login(authToken:)` / `logout()` and persists the session** (v4-compat surface restored in `calls-core`; the SDK's own sample app logs in via `LoginViewController`). This matters for two reasons: (a) after login, the `generateToken(sessionID:)` overload works without hand-passing an auth token; (b) **login success is the trigger for the ai-agent identification telemetry** (§2) — in a calls-only app that never logs in, the self-report has nothing to fire on. Dual-SDK (ringing) integrations are unaffected: the Chat SDK login remains the only login you need there.

Unlike the Android / Flutter / JS Calls SDKs, **`CometChatCalls` on iOS has no `login()` and no `getLoggedInUser()`** — those methods do not exist in `CometChatCallsSDK` 5.0.1 and earlier (see correction above for 5.0.2+). There is nothing to "log in" to. Once the Chat SDK session exists, you authorize each call session by passing an **auth token** to `generateToken(authToken:sessionID:)`, then `startSession(callToken:callSetting:view:)` with the returned call token (full flow in §1.1).

```swift
import CometChatSDK
import CometChatCallsSDK

// Chat SDK login is the ONLY login. (UI Kit users: CometChatUIKit.login already did this.)
CometChat.login(UID: uid, authKey: AUTH_KEY) { user in
    // Chat SDK ready. No CometChatCalls.login() exists — do NOT call it.
    // The incoming-call listener can be registered now; per-call auth happens via generateToken.
} onError: { error in
    // chat login failed
}

// Dev: the auth token for generateToken comes from the Chat SDK:
let authToken = CometChat.getUserAuthToken()   // String? — pass to generateToken(authToken:)
// Production: fetch a fresh server-minted token from your backend instead.
```

**Surprises:**
- There is **no Calls-SDK session to persist** — the Chat SDK's Keychain session is the only persisted login. On app start just confirm `CometChat.getLoggedInUser() != nil`.
- `generateToken` / `startSession` errors hit the `onError` closure (not `do/try/catch`). The error type is `CometChatCallException` — has `errorDescription` and `errorCode`.

### 1.1 Dual-SDK contract

Chat SDK (`CometChatSDK`) initiates ringing; Calls SDK (`CometChatCallsSDK`) runs the WebRTC session. There is no two-`Call`-classes problem on iOS — Swift's module separation prevents it. But the API split still exists:

```swift
// ✓ RIGHT — initiate ringing (Chat SDK)
import CometChatSDK

let outgoing = Call(receiverId: receiverUid, callType: .video, receiverType: .user)
CometChat.initiateCall(call: outgoing, onSuccess: { initiated in
  // initiated.sessionID is what the Calls SDK will join
}, onError: { error in
  // surface to UI
})
```

```swift
// ✓ RIGHT — start the WebRTC session (Calls SDK 5.x) after acceptance.
// iOS Calls SDK 5.x is a TWO-STEP flow: generateToken → startSession.
// There is NO joinSession, NO CallSession singleton, and NO SessionSettingsBuilder
// in the 5.x SDK — those are phantom. The real builder is CallSettingsBuilder.
//   - CallSettingsBuilder (NOT SessionSettingsBuilder) builds the CallSettings
//   - generateToken(authToken:sessionID:) FIRST, then startSession(callToken:callSetting:view:)
//   - Attach the event listener via CallSettingsBuilder.setDelegate(_:) (CallsEventsDelegate)
import CometChatCallsSDK

let settings = CallSettingsBuilder()
  .setStartVideoMuted(false)
  .setStartAudioMuted(false)
  .setDelegate(callListener)        // any CallsEventsDelegate — onCallEnded, onUserJoined, …
  .build()

// loggedInAuthToken: the current user's auth token — CometChat.getUserAuthToken()
//   (User has NO .authToken property; getUserAuthToken() is the real accessor)
CometChatCalls.generateToken(authToken: loggedInAuthToken, sessionID: sessionID) { callToken in
  guard let callToken = callToken else { return }
  CometChatCalls.startSession(
    callToken: callToken,
    callSetting: settings,
    view: callContainerView         // UIView with measurable bounds
  ) { _ in
    // session started — the call UI is rendered into callContainerView
  } onError: { error in
    print("startSession failed: \(error?.errorDescription ?? "unknown")")
  }
} onError: { error in
  print("generateToken failed: \(error?.errorDescription ?? "unknown")")
}
```

### 1.1a End-to-end initiate→join sequence (ENG-35710)

After `CometChat.initiateCall` the caller's session is NOT auto-joined — the gap between *initiation* and *joining* is the second canonical iOS failure (after auth-token). Three events must fire in sequence; the caller side handles each in a different callback.

> **Corrected 2026-06-02 against `calls-sdk-ios/sample-apps/cometchat-calls-sample-app-ringing-ios/CometChatCallsRinging/AppState.swift:213`** — the listener protocol is **`CometChatCallDelegate`** (NOT `CometChatCallsListener` as earlier drafts said), and each callback takes TWO parameters (`Call?` + `CometChatException?`), NOT one. Earlier example would not compile.

```swift
// Step A: register the listener on app start (before any call fires)
// Listener ID is a String; listener instance is "self" or any class conforming
// to CometChatCallDelegate.
CometChat.addCallListener(callListenerID, self)

// Step B: conform to CometChatCallDelegate (NOT CometChatCallsListener)
extension YourClass: CometChatCallDelegate {
  // Caller side: the OTHER party accepted — NOW join the session
  func onOutgoingCallAccepted(acceptedCall: Call?, error: CometChatException?) {
    if let error = error { /* surface */ return }
    guard let call = acceptedCall, let sessionID = call.sessionID else { return }
    startCallSession(sessionID: sessionID)
  }
  // Receiver side: incoming call rang — present accept UI; on accept, start the session
  func onIncomingCallReceived(incomingCall: Call?, error: CometChatException?) {
    if let error = error { /* surface */ return }
    guard let call = incomingCall else { return }
    presentIncomingCallUI(for: call) { accepted in
      if accepted {
        CometChat.acceptCall(sessionID: call.sessionID ?? "") { acceptedCall in
          self.startCallSession(sessionID: acceptedCall?.sessionID ?? "")
        } onError: { _ in /* surface */ }
      }
    }
  }
  func onOutgoingCallRejected(rejectedCall: Call?, error: CometChatException?) { /* end UI, cleanup */ }
  func onIncomingCallCancelled(canceledCall: Call?, error: CometChatException?) { /* dismiss incoming UI — label is canceledCall: (single L) */ }
}

// Don't forget to remove the listener on teardown
// CometChat.removeCallListener(callListenerID)

// Step B: kick the call off (caller — your "Call" button taps this)
let outgoing = Call(receiverId: targetUid, callType: .video, receiverType: .user)
CometChat.initiateCall(call: outgoing, onSuccess: { initiated in
  // initiated.sessionID is what the session will use — but DO NOT start the
  // session here. Wait for onOutgoingCallAccepted on the listener. Starting before
  // the remote accepts means you're alone in an empty session.
}, onError: { error in /* surface */ })

// Step C: start the session (caller in onOutgoingCallAccepted, receiver after acceptCall)
// 5.x flow: generateToken(authToken:sessionID:) → startSession(callToken:callSetting:view:)
func startCallSession(sessionID: String) {
  let settings = CallSettingsBuilder()
    .setStartVideoMuted(false)
    .setStartAudioMuted(false)
    .setDelegate(self)             // self conforms to CallsEventsDelegate
    .build()
  CometChatCalls.generateToken(authToken: loggedInAuthToken, sessionID: sessionID) { callToken in
    guard let callToken = callToken else { return }
    CometChatCalls.startSession(
      callToken: callToken,
      callSetting: settings,
      view: callContainerView      // UIView WITH non-zero bounds (lay out first)
    ) { _ in
      // session started
    } onError: { error in
      print("startSession failed: \(error?.errorDescription ?? "unknown")")
    }
  } onError: { error in
    print("generateToken failed: \(error?.errorDescription ?? "unknown")")
  }
}
```

The shape: `initiateCall` → wait for `onOutgoingCallAccepted` on your `CometChatCallDelegate` → `generateToken` → `startSession`. Skipping the listener and starting inside `initiateCall`'s `onSuccess` is the "ringing but never joins" trap — you'll see the call connect on the wire but the receiver's accept never reaches your code.

### 1.2 CallKit + PushKit are mandatory

iOS will not deliver standard push notifications to a backgrounded/terminated app for an incoming call — the app would have to be foregrounded for it to ring. CallKit + PushKit is the only correct path:

- **PushKit** delivers VoIP push tokens (separate from APNs tokens) and high-priority VoIP payloads even when the app is terminated
- **CallKit** presents the system incoming-call UI (lock-screen, even when device is locked) and reports call state to the OS
- Your `PKPushRegistry` listener calls `CXProvider.reportNewIncomingCall(...)` immediately on receiving the VoIP payload — Apple terminates apps that delay this

This pattern is non-negotiable for App Store review on apps that ring users. Standalone mode wires it; additive mode prompts but doesn't force it.

### 1.3 Background modes — three required entries

In the target's "Signing & Capabilities" → Background Modes:

- **`Audio, AirPlay, and Picture in Picture`** — required for ongoing-call audio when backgrounded
- **`Voice over IP`** — required for PushKit VoIP payload delivery
- **`Remote notifications`** — required for chat push (keeps existing entitlements working)

In `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
  <string>remote-notification</string>
</array>
```

Apple will reject the app if `voip` is declared but PushKit is not actually used.

### 1.4 Server-minted auth tokens

Same rule as the chat dispatcher / `cometchat-ios-production`. Production calls path uses `CometChat.login(authToken:)`, not `CometChat.login(uid:authKey:)`.

### 1.5 Hangup cleanup — `AVAudioSession` routing

Releasing the camera + mic on iOS is straightforward; the gotcha is `AVAudioSession`:

```swift
import CometChatCallsSDK

func endCall() {
  // v5: end the session via the static CometChatCalls.endSession().
  // There is NO CallSession singleton and NO leaveSession() in the 5.x SDK —
  // all in-call control is via static funcs on CometChatCalls.
  CometChatCalls.endSession()
  callContainer.subviews.forEach { $0.removeFromSuperview() }

  // CRITICAL: deactivate the audio session, otherwise the speaker stays
  // routed to "earpiece + voice processing" mode and other audio (music,
  // phone calls outside the app) sounds wrong until the user resets it.
  do {
    try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  } catch {
    // log but don't block — best-effort cleanup
  }

  // CallKit must be told the call ended, even if WE ended it
  cxProvider.reportCall(with: callUUID, endedAt: Date(), reason: .remoteEnded)
}
```

In-call controls are **static funcs on `CometChatCalls`** (there is no `CallSession` type in the 5.x Calls SDK). Audio/video toggles take a `Bool`:

```swift
CometChatCalls.audioMuted(true)    // mute mic;   false = unmute
CometChatCalls.videoPaused(true)   // pause video; false = resume
CometChatCalls.switchCamera()
CometChatCalls.enterPIPMode()      // picture-in-picture; exitPIPMode() to leave
CometChatCalls.startRecording()    // stopRecording() to end
// NOTE: the iOS Calls SDK 5.x has NO local screen-share initiation API
// (no startScreenShare/stopScreenShare) — iOS can only RECEIVE a remote
// participant's screen share, not start one.
```

Skipping the `setActive(false, options: .notifyOthersOnDeactivation)` is the canonical "music doesn't resume after the call" bug.

### 1.6 Permissions with rationale — Info.plist usage strings

Two required entries; iOS rejects builds that record without them:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>So you can talk during voice and video calls.</string>
<key>NSCameraUsageDescription</key>
<string>So you can be seen during video calls.</string>
```

Plus, on iOS 15+, request permission via `AVCaptureDevice.requestAccess(for:)` and `AVAudioApplication.requestRecordPermission` (deprecating `AVAudioSession.requestRecordPermission` in iOS 17+). The skill writes the modern path.

### 1.7 IncomingCall UI — CallKit owns it

In standalone mode, you do NOT render an in-app incoming-call screen. CallKit's system UI handles it (rule 1.2). Your job is:

1. Keep `PKPushRegistry` alive — register in `application(_:didFinishLaunchingWithOptions:)` (UIKit) or `App.init()` (SwiftUI's `@main`)
2. On VoIP payload → call `CXProvider.reportNewIncomingCall`
3. Implement `CXProviderDelegate` `provider(_:perform:)` for `CXAnswerCallAction` — this is where you finally call `CometChatCalls.generateToken` then `startSession`

In additive mode, the UI Kit's incoming-call view can be used for in-foreground rings; CallKit handles backgrounded/terminated rings.

### 1.7a Default incoming/outgoing UI fallback (ENG-35710)

Two iOS testers shipped without a foreground incoming/outgoing screen because the skill jumped straight to CallKit and never showed what to render when the app is already in-foreground. Result: a Call rings on the wire, but the user-facing app shows nothing — the call connects, the call drops, no feedback.

**If the developer hasn't asked for a custom incoming-call UI, wire the kit's defaults:**

```swift
// SwiftUI host
import SwiftUI
import UIKit
import CometChatUIKitSwift

// The kit ships call UI as UIViewControllers (CometChatIncomingCall / CometChatOutgoingCall /
// CometChatOngoingCall) — there are NO `…SwiftUI`-suffixed wrappers. Bridge with
// UIViewControllerRepresentable. Present the controller when your delegate fires (§1.1a);
// configure it via the kit's IncomingCallConfiguration rather than a constructor arg.
struct CometChatIncomingCallView: UIViewControllerRepresentable {
  func makeUIViewController(context: Context) -> CometChatIncomingCall {
    CometChatIncomingCall()
  }
  func updateUIViewController(_ vc: CometChatIncomingCall, context: Context) {}
}

struct AppRootView: View {
  @State private var hasIncomingCall = false
  var body: some View {
    ZStack {
      ContentView()    // your app's tabs / nav
      if hasIncomingCall {
        CometChatIncomingCallView()
          .ignoresSafeArea()
      }
    }
    // flip `hasIncomingCall` from your CometChatCallDelegate.onIncomingCallReceived (see §1.1a)
  }
}
```

```swift
// UIKit host
class RootViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    // Install the kit's incoming-call VC above all other view controllers
    let incoming = CometChatIncomingCall()
    addChild(incoming)
    view.addSubview(incoming.view)
    incoming.view.frame = view.bounds
    incoming.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    incoming.didMove(toParent: self)
  }
}
```

Mounting at the root (above your nav / tab structure) means foreground rings work app-wide — same idea as the web skill's "mount above the route boundary" rule. CallKit still handles backgrounded/terminated rings; the kit's incoming-call VC handles foreground rings. Together they're the complete foreground-and-background coverage.

If the developer DOES want a custom UI: tell them to (a) implement `CometChatCallDelegate.onIncomingCallReceived` to drive their own SwiftUI/UIKit screen, (b) call `CometChat.acceptCall` / `rejectCall` from that screen, and (c) on accept, follow the `generateToken` → `startSession` recipe in §1.1a. The kit's default UI is the recommended starting point because it already wires accept/reject/timer/profile-pic; replicating it from scratch is a 200-line side quest.

---

## 2. Setup

### Swift Package Manager (preferred)

Add via Xcode → File → Add Package Dependencies:

```
https://github.com/cometchat/calls-sdk-ios.git
```

Pin to `5.0.0..<6.0.0`. SPM resolves `CometChatSDK` automatically.

### CocoaPods

```ruby
platform :ios, '15.1'   # REQUIRED for CometChatCallsSDK 5.0.2+ — a lower platform silently resolves 5.0.1 (no initFromSettings)
target 'YourApp' do
  use_frameworks!
  pod 'CometChatSDK',       '~> 4.0'    # signaling
  pod 'CometChatCallsSDK',  '~> 5.0'    # WebRTC session
  # additive mode also has CometChatUIKitSwift '~> 5.1' already
end

post_install do |installer|
  installer.pods_project.build_configurations.each do |config|
    config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'  # Xcode 15+
  end
end
```

### Init — file-based with `cometchat-settings.json` (recommended)

> **Version requirement (ENG-37137 — Skills Telemetry).** `CometChatCalls.initFromSettings(onSuccess:onError:)` reads a bundled `cometchat-settings.json` and lets the **Calls SDK** self-report `integrationSource = "ai-agent"` to `/user_sessions`. It ships in **`CometChatCallsSDK` >= 5.0.2** (released 2026-07-20). ⚠️ **THE SILENT-DOWNGRADE TRAP: 5.0.2 raised the minimum iOS deployment target to 15.1.** If the Podfile declares `platform :ios` below 15.1, CocoaPods does NOT error — it silently resolves **5.0.1**, which has no `initFromSettings` (and self-reports version 99.0.0). After `pod install`, **verify `Podfile.lock` shows `CometChatCallsSDK (5.0.2)`** — a missing `initFromSettings` symbol at build time means you got 5.0.1. On 5.0.1/5.0.0 the method does not exist — bump the platform to 15.1 (preferred) or use the **`CallAppSettingsBuilder` fallback** below.

Like the iOS UI Kit's `CometChatUIKit.initFromSettings` (see `cometchat-ios-core`), the Calls variant takes **no settings argument** — it reads the file straight from the app's main bundle, so the file must be in the target's **Copy Bundle Resources**.

**Step 1 — `cometchat-settings.json`.** It is the SAME unified file the chat-side skills create. If `cometchat-ios-core` already added one, reuse it — just confirm the `callsSDK` section exists. Creating it fresh (calls-only app):

```json
{
  "appId": "APP_ID_HERE",
  "region": "us",
  "credentials": {
    "authKey": "AUTH_KEY_HERE"
  },
  "callsSDK": {
    "host": null,
    "adminHost": null,
    "clientHost": null,
    "callsHost": null
  }
}
```

`initFromSettings` reads the root `appId` / `region` and the four optional `callsSDK` host overrides; everything else in the unified schema is ignored by the Calls SDK. Add the file to the app target (*File → Add Files…* AND confirm it under *Build Phases → Copy Bundle Resources*) — `SETTINGS_FILE_NOT_FOUND` at init means it's missing from Copy Bundle Resources. Commit the file; treat any `authKey` in it as a public demo credential (same rule as `cometchat-ios-core` §2).

**Step 2 — init (no builder, no args):**

```swift
import CometChatSDK
import CometChatCallsSDK

let appSettings = AppSettings.AppSettingsBuilder()
  .subscribePresenceForAllUsers()
  .setRegion(region: Secrets.cometchatRegion)
  .build()

CometChat.init(appId: Secrets.cometchatAppID, appSettings: appSettings) { isInitialized, error in
  guard error == nil else { return }

  // File-based init — reads cometchat-settings.json from the bundle and
  // attributes the integration as ai-agent for /user_sessions telemetry.
  CometChatCalls.initFromSettings(onSuccess: { _ in
    // ready — register PushKit (rule 1.2) and CXProvider (rule 1.7) here
  }, onError: { error in
    print("CometChatCalls init failed: \(error?.errorDescription ?? "")")
  })
}
```

**How the attribution works (don't fight it):** `initFromSettings` persists `integrationSource = "ai-agent"` (appId-scoped) *before* delegating to the normal init. The identification POST itself fires on `CometChatCalls.login(...)` success or on a later `init` that restores a persisted session, and is deduped via a SHA-256 hash — repeats are no-ops until the app/SDK version or integration source changes. Two consequences:

- **Do NOT scaffold a raw `CallAppSettingsBuilder` init when `initFromSettings` is available** — a direct builder init re-attributes the integration as `manual`.
- When the **Chat SDK is linked in the same app** (dual-SDK ringing mode, additive mode), the Calls SDK suppresses its own self-report — the chat side reports instead, so ALSO use the chat-side file-based init there (`CometChatUIKit.initFromSettings` — `cometchat-ios-core` §2). The calls-side `initFromSettings` is still the right init (one config file, ai-agent source persisted either way).

### Init — `CallAppSettingsBuilder` (fallback — 5.0.1 and earlier)

```swift
let callAppSettings = CallAppSettingsBuilder()
  .setAppId(Secrets.cometchatAppID)
  .setRegion(Secrets.cometchatRegion)
  .build()

CometChatCalls.init(callsAppSettings: callAppSettings, onSuccess: { _ in
  // ready
}, onError: { error in
  print("CometChatCalls.init failed: \(error?.errorDescription ?? "")")
})
```

Credentials via `Secrets.swift` (gitignored) or `.xcconfig` Build Settings — see `cometchat-ios-core`.

---

## 3. Components catalog

### Calls SDK primitives (used in standalone or wherever you build custom UI)

| Type | Purpose |
|---|---|
| `CometChatCalls` | Top-level facade — `init`, `generateToken`, `startSession`, `endSession`, `audioMuted(_:)`, `videoPaused(_:)`, `switchCamera`, `enterPIPMode`/`exitPIPMode`, `startRecording`/`stopRecording`, `addCallEventListener` |
| `CallSettingsBuilder` | Per-session config (audio-only, presenter, hide buttons, start muted, `setDelegate`) → `.build()` returns `CallSettings` |
| `CallSettings` | The built per-session config passed to `startSession(callToken:callSetting:view:)` (there is no `CallSession` object in 5.x — `startSession` returns a session-id `String`) |
| `CallType` | `.video` / `.audio` / `.audioVideo` (swiftinterface:294-297) — there is NO `.voice` |
| `DisplayModes` (enum) | `.default` / `.single` / `.spotlight` (swiftinterface:175) — passed to `CallSettingsBuilder.setMode(_:)`. The current setter is `setMode(_ value: DisplayModes)` (swiftinterface:281); the `setMode(_ value: NSString)` string overload (swiftinterface:280) is DEPRECATED. There is no `LayoutMode`/`.tile`/`.sidebar` |
| `CallLogsRequest` + `CallLogsBuilder` | Paginated call history (note the plural — there is no `CallLogRequest`/`CallLogRequestBuilder`) |
| `CallsEventsDelegate` (protocol) | Lifecycle + media + participant + button events — set via `CallSettingsBuilder.setDelegate(_:)` or `CometChatCalls.addCallEventListener(observerId:delegate:)`. (NOT `CometChatCallsEventsListener` — that name doesn't exist.) |

### UI Kit views (additive mode — `CometChatUIKitSwift`)

| View / VC | Purpose |
|---|---|
| `CometChatCallButtons` | Voice + video button row (standalone or in `CometChatMessageHeader`) |
| `CometChatIncomingCall` (UIViewController) | Foreground in-app ring UI |
| `CometChatOutgoingCall` (UIViewController) | Dialing UI |
| `CometChatOngoingCall` (UIViewController) | Active call UI hosting WebRTC |
| `CometChatCallLogs` (UIViewController) | Paginated history |

SwiftUI hosting via `UIViewControllerRepresentable`:

```swift
struct CallLogsView: UIViewControllerRepresentable {
  func makeUIViewController(context: Context) -> CometChatCallLogs { CometChatCallLogs() }
  func updateUIViewController(_ vc: CometChatCallLogs, context: Context) {}
}
```

---

## 4. Standalone integration

When `product === "voice-video"` and there is no existing UI Kit.

**Split by calling mode:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

Calls SDK ONLY. NO Chat SDK, NO CallKit, NO PushKit. Matches `calls-sdk-ios-5/sample-apps/cometchat-calls-sample-app-ios/`. Scaffold:

1. **App entry** — `CometChatCalls.initFromSettings(onSuccess:onError:)` with a bundled `cometchat-settings.json` (§2) ONLY — builder init is the pre-5.0.2 fallback. No `CometChat.init`, no `CometChat.login`, no PushKit, no CallKit. Note: with no Chat SDK linked, the Calls SDK is the only telemetry reporter here, and its send triggers on `CometChatCalls.login` success / persisted-session restore — if the app has identified users, log them in via `CometChatCalls.login(UID:authKey:)` (5.0.2+, see §1.0 correction) rather than hand-passing an auth token to `generateToken`.
2. **`JoinSessionView.swift`** — UID picker + "Start meeting" / "Join meeting" + state.
3. **`CallView.swift` + `CallContainerView: UIViewRepresentable`** — `CometChatCalls.generateToken(authToken:sessionID:)` then `CometChatCalls.startSession(callToken:callSetting:view:)`. Coordinator conforms to `CallsEventsDelegate` (set via `CallSettingsBuilder.setDelegate`). See `references/call-session.md`.
4. **`Info.plist` patch** — Camera + microphone permissions ONLY. No `audio` or `voip` Background Modes needed.
5. **Universal Link routing** — meeting URL → CallView.

**Why no CallKit / no PushKit:** session mode is link-driven, not push-driven. No incoming ring to surface.

### 4b. Standalone — Ringing mode (CallKit + PushKit + Chat SDK signaling)

Dual-SDK + CallKit + PushKit. Scaffold:

1. **App entry** — Chat SDK + Calls SDK init (both file-based: `CometChat.init` per `cometchat-ios-core`, then `CometChatCalls.initFromSettings` — §2), PushKit + CallKit registration (rule 1.2, 1.7).
2. **`CallKitProviderDelegate.swift`** — `CXProviderDelegate` implementation. Routes `CXAnswerCallAction` → `CometChatCalls.generateToken` then `startSession(callToken:callSetting:view:)`. Routes `CXEndCallAction` → `CometChatCalls.endSession()` + `AVAudioSession` cleanup (rule 1.5).
3. **`PushRegistryDelegate.swift`** — `PKPushRegistryDelegate` listening on `.voIP`. On payload → `CXProvider.reportNewIncomingCall` immediately.
4. **`ProfileView.swift` (SwiftUI) or `ProfileViewController.swift` (UIKit)** — Hosts call buttons next to user info. Tap → `CometChat.initiateCall`.
5. **`OngoingCallView.swift`** — Custom view hosting the SDK's call surface via `UIViewRepresentable` bridging. Implements rule 1.5 teardown.
6. **`CallLogsView.swift`** — `/calls` equivalent — `CallLogsRequest.CallLogsBuilder`.
7. **`Info.plist` patch** — Background Modes (rule 1.3), permissions (rule 1.6).
8. **VoIP Services certificate setup** — manual step (Apple Developer portal + App Store Connect). The skill documents the steps; cannot automate.

## 5. Additive integration

When `cometchat-ios` is already integrated.

> ✅ **Kit-default path FIRST (what the canonical `SampleApp` actually does).** `CometChatCallsSDK` is **vendored inside `CometChatUIKitSwift`** — no separate SPM/Pod add, and **no separate `CometChatCalls.init`**. The sample turns calling on with **`UIKitSettings…enable(inAppIncomingCall: true)`** at init (`SampleApp/SceneDelegate.swift`), then just drops in `CometChatCallButtons(...).set(user:)` (e.g. in the user-details screen) and a `CometChatCallLogs` tab — the kit handles `generateToken`/`startSession` and the incoming-call UI internally. You do NOT hand-write `CometChatCalls.init` + a manual `generateToken → startSession` flow on this path. (The manual two-step is the **standalone / custom-UI** path only — §1.1 / §4.)

The kit-default additive recipe:
1. Confirm `CometChatUIKitSwift` is present (CallsSDK is bundled — nothing extra to install).
2. Set **`.enable(inAppIncomingCall: true)`** on the `UIKitSettings` builder at init (the one calling switch). If the integration was scaffolded with **`CometChatUIKit.initFromSettings`** (`cometchat-ios-core` §2 — the skills default), telemetry attribution is already handled on the chat side; the vendored calls framework needs no separate init or attribution step.
3. Add Background Modes (`voip`, `remote-notification`, `audio`) + camera/mic permissions to `Info.plist`.
4. Drop in `CometChatCallButtons` (e.g. user-details / contact screen) — the kit also auto-renders them in `CometChatMessageHeader` when CallsSDK is present; add `CometChatCallLogs` as a tab/route.
5. (Optional) CallKit + PushKit for background VoIP (asks user — same opt-in as Android).

Only reach for `CometChatCalls.init` + `generateToken`/`startSession` (§1.1) when building a **custom call surface** without the kit's call components.

## 6. Anti-patterns

1. **Skipping CallKit + PushKit** in standalone mode. The app cannot ring backgrounded/terminated devices any other way. App Store reviewers test this.
2. **Calling `CXProvider.reportNewIncomingCall` after async work.** Apple terminates the app process if the report happens more than ~5 seconds after PushKit delivery. Report immediately, then do the actual `generateToken` + `startSession` from inside `CXAnswerCallAction`.
3. **Forgetting `setActive(false, options: .notifyOthersOnDeactivation)`** on hangup. Music/phone-call audio sounds wrong until the next foreground. The "looks fine in dev, fails review" bug.
4. **Declaring `voip` in `UIBackgroundModes` without using PushKit.** Apple rejects.
5. **Mixing CallKit and an in-app incoming-call screen** in standalone mode. Causes double-rings and confused state. CallKit owns standalone rings; in-app UI is additive-mode only.
6. **Using SwiftUI `.alert` for incoming calls.** It only fires when the app is foregrounded. Use CallKit (rule 1.7).
7. **Pinning `CometChatCallsSDK` to a `4.x`** because that's what the chat SDK is on. They version independently — Calls SDK 5.x is the current calls major.
8. **Hand-rolling `CallAppSettingsBuilder` init when `initFromSettings` is available (5.0.2+, §2).** The raw builder init re-attributes the integration as `manual` — file-based init is the skills path; the builder is only the pre-5.0.2 fallback.

## 7. Verification checklist

**Static:**

- [ ] `CometChatCallsSDK` in SPM Package.resolved or Podfile.lock
- [ ] `CometChat.init` followed by `CometChatCalls.initFromSettings` in app entry (builder `CometChatCalls.init` only as the pre-5.0.2 fallback — §2)
- [ ] `cometchat-settings.json` present, has the `callsSDK` section, and listed under Copy Bundle Resources
- [ ] PushKit registry listening on `.voIP`
- [ ] `CXProvider` configured with `CXProviderConfiguration` (app name + ringtone if any)
- [ ] `CXProviderDelegate` implements answer + end actions
- [ ] `Info.plist` has `NSMicrophoneUsageDescription` + `NSCameraUsageDescription`
- [ ] `Info.plist` `UIBackgroundModes` has `audio` + `voip` + `remote-notification`
- [ ] Hangup path includes `endSession` + `setActive(false, options: .notifyOthersOnDeactivation)` + `cxProvider.reportCall(...endedAt:reason:)`
- [ ] **Standalone only:** No in-app incoming-call screen — CallKit owns it

**Runtime (real device):**

- [ ] Outgoing call connects, two-way audio + video
- [ ] Incoming call rings on lock screen (device locked + app terminated)
- [ ] Tap "Answer" on lock screen → app opens directly into ongoing call
- [ ] Hangup ends call, camera light off, music resumes if it was playing
- [ ] Background the app during a call → audio continues
- [ ] Lock device during a call → ongoing-call UI on lock screen, audio continues

## 8. Pointers

- `references/audio-modes-and-controls.md` — audio-route switching (speaker/earpiece/Bluetooth) + custom control panel (button-disable matrix)
- `cometchat-ios-core` — Chat SDK init, login, `Secrets.swift` conventions
- `cometchat-ios-components` — full UI Kit catalog (additive mode)
- `cometchat-ios-push` — APNs setup; some overlap with PushKit but distinct (PushKit is VoIP-only)
- `cometchat-ios-production` — server-minted tokens, security checklist
- `cometchat-ios-troubleshooting` — common failure modes (PushKit delivery, CallKit reporting timing, ENABLE_USER_SCRIPT_SANDBOXING)
