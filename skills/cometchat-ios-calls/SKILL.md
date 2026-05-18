---
name: cometchat-ios-calls
description: CometChat Calls SDK v5 integration for native iOS (Swift; SwiftUI + UIKit hosting). Covers SDK install (SPM + CocoaPods), CometChatCalls init, dual-SDK ringing (Chat SDK initiateCall + Calls SDK joinSession), CallKit + PushKit VoIP push, AVAudioSession routing, mixed-stack hosting (UIViewControllerRepresentable for SwiftUI), Info.plist permissions + Background Modes, and additive-vs-standalone modes.
license: "MIT"
compatibility: "Xcode 15+, Swift 5.9+, iOS 13+ deployment target; CometChatCallsSDK 5.x; CometChatSDK 4.x; CometChatUIKitSwift 5.x (additive mode)"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
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
- SDK source — `~/Downloads/calls-sdk/calls-sdk-ios-5/sdk/`
- Sample app — `~/Downloads/calls-sdk/calls-sdk-ios-5/sample-apps/cometchat-calls-sample-app-ios/`
- `Package.swift` — `https://github.com/cometchat/calls-sdk-ios.git` (SPM)
- Public docs — https://www.cometchat.com/docs/calls/ios/overview

---

## ⚠️ Known upstream issue — iOS v5 binary is broken (May 2026)

**SPM and CocoaPods both fail to resolve the iOS Calls SDK v5** because the WebRTC binary it depends on is missing from Cloudsmith:

```
https://dl.cloudsmith.io/public/cometchat/cometchat/raw/versions/124.0.4/CometChatWebRTC-124.0.4.xcframework.zip
→ 404 Not Found
```

This affects every v5 tag (`5.0.0`, `5.0.0-beta.1` … `5.0.0-beta.3`). The `Package.swift` and `.podspec` both reference the same broken URL.

**Until upstream republishes the binary:**
- Customers on iOS should stay on **v4.2.x** of the Calls SDK (it has its own WebRTC dependency that's still hosted)
- If you must use v5 for parity with other platforms, contact CometChat support for a working binary or a private SPM fork
- This skill's v5 setup section assumes the binary is available — that assumption is currently invalid for iOS only

Tracking this so the next audit pass can verify when it's fixed. The vendor sample-apps at `~/Downloads/calls-sdk/calls-sdk-ios-5/sample-apps/` reference the same broken binary — they don't ship a workaround.

---

## 1. The seven hard rules — iOS specialization

### 1.0 Calls SDK login is its own step (v5+)

The v5 Calls SDK has its own auth state, separate from the Chat SDK. After `CometChat.login` succeeds, you MUST also call `CometChatCalls.login` — without it, the FIRST calls API call throws **"auth token cannot be null"**.

```swift
import CometChatSDK
import CometChatCallsSDK

CometChat.login(UID: uid, authKey: AUTH_KEY) { user in
    // Chat SDK ready — now login Calls SDK
    CometChatCalls.login(UID: uid, authKey: AUTH_KEY) { callUser in
        // both ready — incoming-call listener can be registered, calls can fire
    } onError: { error in
        // surface to user — common cause: typo in app id / auth key
    }
} onError: { error in
    // chat login failed; calls login never fires
}
```

For production with server-minted tokens:

```swift
CometChatCalls.login(authToken: tokenFromBackend) { callUser in
    // …
} onError: { error in /* … */ }
```

**Surprises:**
- The Chat SDK persists login via Keychain across app launches. The **Calls SDK does NOT** persist as reliably — always check `CometChatCalls.getLoggedInUser()` on app start and re-login if nil.
- Calls SDK errors hit the `onError` closure (not `do/try/catch`). The error type is `CometChatException` from the Calls module — has `errorDescription` and `errorCode`.

### 1.1 Dual-SDK contract

Chat SDK (`CometChatSDK`) initiates ringing; Calls SDK (`CometChatCallsSDK`) runs the WebRTC session. There is no two-`Call`-classes problem on iOS — Swift's module separation prevents it. But the API split still exists:

```swift
// ✓ RIGHT — initiate ringing (Chat SDK)
import CometChatSDK

let outgoing = Call(receiverUid: receiverUid, receiverType: .user, callType: .video)
CometChat.initiateCall(call: outgoing, onSuccess: { initiated in
  // initiated.sessionID is what the Calls SDK will join
}, onError: { error in
  // surface to UI
})
```

```swift
// ✓ RIGHT — join WebRTC session (Calls SDK) after acceptance.
// Matches upstream sample at calls-sdk-ios-5/sample-apps/cometchat-calls-
// sample-app-ringing-ios/CometChatCallsRinging/CallView.swift.
//   - SessionSettingsBuilder (NOT CallSettingsBuilder — that's chat-side)
//   - Single-call joinSession(sessionID:callSetting:container:) — token is
//     generated internally; no separate generateToken needed
//   - Register listeners on the resulting CallSession in onSuccess
import CometChatCallsSDK

let settings = SessionSettingsBuilder()
  .setTitle("CometChat Call")
  .startVideoPaused(false)
  .startAudioMuted(false)
  .build()

CometChatCalls.joinSession(
  sessionID: sessionID,
  callSetting: settings,
  container: callContainerView   // UIView with measurable bounds
) { success in
  let session = CometChatCallsSDK.CallSession.shared
  session.addSessionStatusListener(callListener)
  session.addButtonClickListener(callListener)
} onError: { error in
  print("joinSession failed: \(error?.errorDescription ?? "unknown")")
}
```

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
import CometChatCallsSDK   // for the CallSession namespace

func endCall() {
  // v5: leaveSession lives on the CallSession singleton, NOT on CometChatCalls.
  // CometChatCalls.endSession() exists as a deprecated alias but the v5 API is
  // singleton-based — use the form below to stay forward-compatible.
  CometChatCallsSDK.CallSession.shared.leaveSession()
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

**Module-qualified `CometChatCallsSDK.CallSession.shared`** is the canonical reference (matches the iOS sample app). `CallSession` exists in both `CometChatSDK` and `CometChatCallsSDK` modules — Swift will resolve the unqualified name based on import order, but qualifying with the module prefix makes intent explicit and avoids drift if Swift's resolution changes. Same singleton hosts the in-call control APIs:

```swift
CometChatCallsSDK.CallSession.shared.muteAudio()
CometChatCallsSDK.CallSession.shared.unmuteAudio()
CometChatCallsSDK.CallSession.shared.pauseVideo()
CometChatCallsSDK.CallSession.shared.resumeVideo()
CometChatCallsSDK.CallSession.shared.startScreenShare()
CometChatCallsSDK.CallSession.shared.stopScreenShare()
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
3. Implement `CXProviderDelegate` `provider(_:perform:)` for `CXAnswerCallAction` — this is where you finally call `CometChatCalls.joinSession`

In additive mode, the UI Kit's incoming-call view can be used for in-foreground rings; CallKit handles backgrounded/terminated rings.

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
platform :ios, '13.0'
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

### Init

In SwiftUI app entry (`@main struct App.init()`) or UIKit `application(_:didFinishLaunchingWithOptions:)`:

```swift
import CometChatSDK
import CometChatCallsSDK

let appSettings = AppSettings.AppSettingsBuilder()
  .subscribePresenceForAllUsers()
  .setRegion(region: Secrets.cometchatRegion)
  .build()

CometChat.init(appId: Secrets.cometchatAppID, appSettings: appSettings) { isInitialized, error in
  guard error == nil else { return }

  let callAppSettings = CallAppSettingsBuilder()
    .setAppId(Secrets.cometchatAppID)
    .setRegion(Secrets.cometchatRegion)
    .build()

  CometChatCalls.init(callAppSettings: callAppSettings) { _ in
    // ready — register PushKit (rule 1.2) and CXProvider (rule 1.7) here
  }
}
```

Credentials via `Secrets.swift` (gitignored) or `.xcconfig` Build Settings — see `cometchat-ios-core`.

---

## 3. Components catalog

### Calls SDK primitives (used in standalone or wherever you build custom UI)

| Type | Purpose |
|---|---|
| `CometChatCalls` | Top-level facade — init, joinSession, endSession, generateToken |
| `CallSettingsBuilder` | Per-session config (type, layout, hide buttons, audio mode) |
| `CallSession` | Active session object — held during a call |
| `CallType` | `.voice` / `.video` |
| `LayoutMode` | `.tile` / `.sidebar` / `.spotlight` |
| `CallLogRequest.CallLogRequestBuilder` | Paginated call history |
| `CometChatCallsEventsListener` (protocol) | Lifecycle + media + participant + button events |

### UI Kit views (additive mode — `CometChatUIKitSwift`)

| View / VC | Purpose |
|---|---|
| `CometChatCallButton` | Voice + video button row (standalone or in `CometChatMessageHeader`) |
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

Calls SDK ONLY. NO Chat SDK, NO CallKit, NO PushKit. Matches `~/Downloads/calls-sdk/calls-sdk-ios-5/sample-apps/cometchat-calls-sample-app-ios/`. Scaffold:

1. **App entry** — `CometChatCalls.init({appId, region, authKey})` ONLY. No `CometChat.init`, no `CometChat.login`, no PushKit, no CallKit.
2. **`JoinSessionView.swift`** — UID picker + "Start meeting" / "Join meeting" + state.
3. **`CallView.swift` + `CallContainerView: UIViewRepresentable`** — Single-call `CometChatCalls.joinSession(sessionID:callSetting:container:)`. Coordinator implements `SessionStatusListener` + `ButtonClickListener`. See `references/call-session.md`.
4. **`Info.plist` patch** — Camera + microphone permissions ONLY. No `audio` or `voip` Background Modes needed.
5. **Universal Link routing** — meeting URL → CallView.

**Why no CallKit / no PushKit:** session mode is link-driven, not push-driven. No incoming ring to surface.

### 4b. Standalone — Ringing mode (CallKit + PushKit + Chat SDK signaling)

Dual-SDK + CallKit + PushKit. Scaffold:

1. **App entry** — Chat SDK + Calls SDK init, PushKit + CallKit registration (rule 1.2, 1.7).
2. **`CallKitProviderDelegate.swift`** — `CXProviderDelegate` implementation. Routes `CXAnswerCallAction` → `CometChatCalls.joinSession(sessionID:callSetting:container:)`. Routes `CXEndCallAction` → `CallSession.shared.leaveSession()` + `AVAudioSession` cleanup (rule 1.5).
3. **`PushRegistryDelegate.swift`** — `PKPushRegistryDelegate` listening on `.voIP`. On payload → `CXProvider.reportNewIncomingCall` immediately.
4. **`ProfileView.swift` (SwiftUI) or `ProfileViewController.swift` (UIKit)** — Hosts call buttons next to user info. Tap → `CometChat.initiateCall`.
5. **`OngoingCallView.swift`** — Custom view hosting the SDK's call surface via `UIViewRepresentable` bridging. Implements rule 1.5 teardown.
6. **`CallLogsView.swift`** — `/calls` equivalent — `CallLogRequest.CallLogRequestBuilder`.
7. **`Info.plist` patch** — Background Modes (rule 1.3), permissions (rule 1.6).
8. **VoIP Services certificate setup** — manual step (Apple Developer portal + App Store Connect). The skill documents the steps; cannot automate.

## 5. Additive integration

When `cometchat-ios` is already integrated. The skill:

1. Adds `CometChatCallsSDK` to SPM or Podfile.
2. Adds `CometChatCalls.init(...)` to the existing `CometChat.init` success callback.
3. Adds Background Modes + permissions to `Info.plist`.
4. Wires `CometChatMessageHeader` call buttons (already rendered by the kit — just enable them).
5. Adds CallKit + PushKit (asks user — same opt-in as Android).
6. Adds `CallLogsView` as an additional tab/route.

## 6. Anti-patterns

1. **Skipping CallKit + PushKit** in standalone mode. The app cannot ring backgrounded/terminated devices any other way. App Store reviewers test this.
2. **Calling `CXProvider.reportNewIncomingCall` after async work.** Apple terminates the app process if the report happens more than ~5 seconds after PushKit delivery. Report immediately, then do the actual `joinSession` from inside `CXAnswerCallAction`.
3. **Forgetting `setActive(false, options: .notifyOthersOnDeactivation)`** on hangup. Music/phone-call audio sounds wrong until the next foreground. The "looks fine in dev, fails review" bug.
4. **Declaring `voip` in `UIBackgroundModes` without using PushKit.** Apple rejects.
5. **Mixing CallKit and an in-app incoming-call screen** in standalone mode. Causes double-rings and confused state. CallKit owns standalone rings; in-app UI is additive-mode only.
6. **Using SwiftUI `.alert` for incoming calls.** It only fires when the app is foregrounded. Use CallKit (rule 1.7).
7. **Pinning `CometChatCallsSDK` to a `4.x`** because that's what the chat SDK is on. They version independently — Calls SDK 5.x is the current calls major.

## 7. Verification checklist

**Static:**

- [ ] `CometChatCallsSDK` in SPM Package.resolved or Podfile.lock
- [ ] `CometChat.init` followed by `CometChatCalls.init` in app entry
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

- `cometchat-ios-core` — Chat SDK init, login, `Secrets.swift` conventions
- `cometchat-ios-components` — full UI Kit catalog (additive mode)
- `cometchat-ios-push` — APNs setup; some overlap with PushKit but distinct (PushKit is VoIP-only)
- `cometchat-ios-production` — server-minted tokens, security checklist
- `cometchat-ios-troubleshooting` — common failure modes (PushKit delivery, CallKit reporting timing, ENABLE_USER_SCRIPT_SANDBOXING)
