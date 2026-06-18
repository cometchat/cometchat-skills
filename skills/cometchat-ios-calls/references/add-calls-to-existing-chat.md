# Adding calls to an existing chat integration (iOS)

You have `CometChatUIKitSwift` working. This guide adds `CometChatCallsSDK` plus PushKit + CallKit + the seven hard rules.

**Read first:** `cometchat-ios-calls/SKILL.md` — seven hard rules (init order, IncomingCall mount, hangup teardown, VoIP push, etc.).

---

## Step 1 — Install Calls SDK

**SwiftPM:**
- File → Add Packages → `https://github.com/cometchat/calls-sdk-ios` → version `5.0.0+`
- Add `CometChatCallsSDK` to your app target

**CocoaPods:**
```ruby
pod 'CometChatCallsSDK', '~> 5.0'
```
```bash
pod install --repo-update
```

---

## Step 2 — Add capabilities + Info.plist entries

**Xcode → target → Signing & Capabilities:**
- Push Notifications
- Background Modes → check Audio, AirPlay, and Picture in Picture + Voice over IP + Remote notifications

**Info.plist:**
```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
  <string>remote-notification</string>
</array>
<key>NSCameraUsageDescription</key>
<string>Camera access is required for video calls.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access is required for calls.</string>
```

---

## Step 3 — Init order: chat → calls

Wherever you currently call `CometChatUIKit.init(uikitSettings:)`, append the calls init:

```swift
import CometChatSDK
import CometChatCallsSDK
import CometChatUIKitSwift

// Existing chat init
CometChatUIKit.init(uikitSettings: chatSettings) { result in
  switch result {
  case .success:
    // NEW: Calls init AFTER chat init succeeded
    let callsSettings = CallAppSettings(appId: APP_ID, region: REGION)
    Task {
      try await CometChatCalls.init(with: callsSettings)
    }
  case .onError(let error):
    print(error)
  }
}
```

---

## Step 4 — Login

Log in with the Chat SDK only. **There is no `CometChatCalls.login` and no `CometChat.loginAsync`** — the Calls SDK has no separate login step; it authenticates per call session via `generateToken`.

```swift
CometChat.login(UID: uid, authKey: authKey, onSuccess: { user in
  // logged in — that's it. Do NOT call CometChatCalls.login (doesn't exist).
  // When a call starts, call CometChatCalls.generateToken(authToken:sessionID:)
  // with CometChat.getUserAuthToken() (User has no `authToken` property).
}, onError: { error in /* surface */ })
```

If you use server-minted auth tokens (recommended), use the `CometChat.login(UID:authToken:...)` overload instead of `authKey`.

---

## Step 5 — Mount IncomingCall at root

In SwiftUI:

```swift
@main
struct YourApp: App {
  var body: some Scene {
    WindowGroup {
      RootView()
        .overlay(alignment: .top) {
          CometChatIncomingCall()
        }
    }
  }
}
```

In UIKit:
- Make a `RootViewController` that holds your existing app + the `CometChatIncomingCallView`
- Or use `UIWindow.rootViewController` swap pattern when an incoming call arrives

---

## Step 6 — PushKit + CallKit registration

Implement `PKPushRegistryDelegate` (see `cometchat-ios-calls/references/server-apns-pushkit.md`):

```swift
class VoipPushHandler: NSObject, PKPushRegistryDelegate {
  let registry = PKPushRegistry(queue: .main)
  let callProvider: CXProvider

  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    let token = credentials.token.map { String(format: "%02x", $0) }.joined()
    Task { try await api.registerVoipToken(uid: currentUid, token: token) }
  }

  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    // Report to CallKit IMMEDIATELY
    let update = CXCallUpdate()
    let dict = payload.dictionaryPayload
    update.remoteHandle = CXHandle(type: .generic, value: dict["callerUid"] as? String ?? "Unknown")
    update.localizedCallerName = dict["callerName"] as? String ?? "Unknown"
    update.hasVideo = (dict["callType"] as? String) == "video"
    callProvider.reportNewIncomingCall(with: UUID(), update: update) { _ in completion() }
  }
}
```

Init this handler from your `AppDelegate.didFinishLaunchingWithOptions`.

---

## Step 7 — Hangup teardown

```swift
func endCall(sessionId: String) {
  CometChatCalls.endSession()   // Calls SDK — EXISTS (not leaveSession)
  CometChat.endCall(sessionID: sessionId, onSuccess: { _ in }, onError: { _ in })
  callProvider.reportCall(with: callUUID, endedAt: nil, reason: .remoteEnded)
}
```

---

## Verification checklist

- [ ] `CometChatCallsSDK` in SwiftPM/CocoaPods
- [ ] Background Modes capability + Info.plist UIBackgroundModes (audio + voip + remote-notification)
- [ ] NSCameraUsageDescription + NSMicrophoneUsageDescription
- [ ] Calls init runs AFTER chat init succeeds
- [ ] NO `CometChatCalls.login` (doesn't exist) — Calls auth is per-session via `generateToken`
- [ ] `CometChatIncomingCall` mounted at root (SwiftUI overlay or UIKit window-root)
- [ ] PushKit registry initialized + reports to CallKit within 5s
- [ ] Hangup teardown ends both SDK + CallKit + chat-side call record
- [ ] Real-device smoke: backgrounded incoming call rings on lock screen
- [ ] Run `cometchat verify --calls` — should pass

---

## Pointers

- `cometchat-react-calls/references/add-calls-to-existing-chat.md` — canonical (no native modules)
- `cometchat-ios-calls/SKILL.md` — seven hard rules
- `cometchat-ios-calls/references/server-apns-pushkit.md` — server-side PushKit
