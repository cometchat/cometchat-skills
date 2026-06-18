# CometChat Calls iOS SDK v4 → v5 migration

`CometChatCallsSDK` v5 keeps the same session model as v4 — a per-session call token, a `CallSettingsBuilder`, and a static `CometChatCalls` facade. There is **no** `CometChatCalls.login`, **no** `CallSession`/`CallSession.shared`, and **no** `SessionSettings` struct. Auth is per-session via `generateToken`.

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/migration-guide-v5

> Every symbol below is verified against the v5 `CometChatCallsSDK` Swift interface. Do NOT introduce `CallSession`, `joinSession`, `SessionSettings`, `SessionSettingsBuilder`, `CometChatCallsEventsListener`, `muteAudio`/`pauseVideo`, `setLayout`, or `startScreenShare` — none of these exist in v5.

---

## Step 1 — Bump the SDK

**SwiftPM:** Update the `CometChatCallsSDK` package version pin to `5.0.0` or higher.

**CocoaPods:**
```ruby
# Podfile
pod 'CometChatCallsSDK', '~> 5.0'
```

```bash
pod install --repo-update
```

---

## Step 2 — Init

Init takes a `CallAppSettings` built with `CallAppSettingsBuilder`, passed under the `callsAppSettings:` label (note the `s` — `callsAppSettings`, not `callAppSettings`).

```swift
let callAppSettings = CallAppSettingsBuilder()
  .setAppId("APP_ID")
  .setRegion("REGION")
  .build()

CometChatCalls.init(callsAppSettings: callAppSettings, onSuccess: { _ in
  // ready
}, onError: { error in
  // surface error
})
```

There is no async/await `init(with:)` form and no `CallAppSettings.Builder()` nested type — use `CallAppSettingsBuilder()`.

---

## Step 3 — Auth is per-session (no Calls SDK login)

> **There is NO `CometChatCalls.login` and NO `CometChatCalls.getLoggedInUser` in v5.** Do not call them — they do not exist on the Calls SDK.

Authentication is per call session. Get a call token immediately before starting a session:

```swift
// Chat SDK still owns the user session. Get its auth token from the Chat SDK:
let authToken = CometChat.getUserAuthToken()   // CometChatSDK — User has NO `authToken` property

CometChatCalls.generateToken(authToken: authToken, sessionID: sessionID, onSuccess: { token in
  // `token` is the call token you pass to startSession
}, onError: { error in
  // surface error
})
```

`generateToken` is `CometChatCalls.generateToken(authToken:sessionID:onSuccess:onError:)`.

---

## Step 4 — Session settings (`CallSettingsBuilder`, not `SessionSettings`)

> **There is NO `SessionSettings` struct and NO `SessionSettingsBuilder`.** Use `CallSettingsBuilder().build()` which returns `CallSettings`.

```swift
let callSettings = CallSettingsBuilder()
  .setIsAudioOnly(false)               // was setSessionType(.video) — there is no setSessionType
  .setStartAudioMuted(false)
  .setStartVideoMuted(false)
  .setShowRecordingButton(true)        // NOT inverted — there is no hideRecordingButton
  .setMode(.default)                   // setMode(_ value: DisplayModes) — swiftinterface:281 (.default/.single/.spotlight); NSString overload is deprecated
  .setDelegate(self)                   // self conforms to CallsEventsDelegate
  .build()
```

There is no `setLayout`, no `setHideChatButton`, no `enableRecording`. Recording-button visibility is `setShowRecordingButton(_:)`; auto-record on start is `setStartRecordingOnCallStart(_:)`.

---

## Step 5 — Start / end the session

> **There is NO `joinSession` and NO `CallSession`.** The lifecycle is `generateToken` → `startSession` → `endSession`, all static on `CometChatCalls`.

```swift
// `view` is the UIView the SDK renders the call into.
CometChatCalls.startSession(callToken: token, callSetting: callSettings, view: callView, onSuccess: { _ in
  // session started
}, onError: { error in
  // surface error
})

// End the call:
CometChatCalls.endSession()             // EXISTS in v5 — do not say it doesn't
```

---

## Step 6 — Events: `CallsEventsDelegate`, not `CometChatCallsEventsListener`

> **The listener protocol is `CallsEventsDelegate`.** `CometChatCallsEventsListener` does not exist. There is no `addEventListener(.someEnum)` granular-subscription API.

```swift
// v5: implement the CallsEventsDelegate protocol (callbacks are @objc optional).
// Prefer the TYPED forms below (swiftinterface:29-54); the NSDictionary/NSArray
// overloads still exist but are DEPRECATED.
extension MyCallController: CallsEventsDelegate {
  func onSessionTimeout()                                          { /* idle timeout — swiftinterface:30 */ }
  func onCallEnded()                                               { /* ... */ }
  func onCallEndButtonPressed()                                    { /* ... */ }
  func onUserJoined(rtcUser: RTCUser)                              { /* swiftinterface:35 */ }
  func onUserLeft(rtcUser: RTCUser)                                { /* swiftinterface:38 */ }
  func onUserListChanged(rtcUsers: [RTCUser])                      { /* swiftinterface:41 */ }
  func onAudioModeChanged(mode: [CallAudioMode])                   { /* swiftinterface:44 */ }
  func onCallSwitchedToVideo(callSwitchedInfo: CallSwitchRequestInfo) { /* swiftinterface:47 */ }
  func onUserMuted(rtcMutedUser: RTCMutedUser)                     { /* swiftinterface:50 */ }
  func onRecordingToggled(recordingInfo: RTCRecordingInfo)         { /* one callback — no Started/Stopped/Failed split — swiftinterface:53 */ }
}

// Register either via the builder (setDelegate, Step 4) or:
CometChatCalls.addCallEventListener(observerId: "my-id", delegate: self)
```

There is no `onScreenShareStarted`/`onScreenShareEnded`, no `onChatButtonClicked`, no `onActiveSpeakerUpdated`, and no layout-change callback in v5.

---

## Step 7 — In-call control method names

```diff
- CometChatCalls.muteAudio(true)       // phantom
+ CometChatCalls.audioMuted(true)      // mute
+ CometChatCalls.audioMuted(false)     // unmute

- CometChatCalls.pauseVideo(true)      // phantom
+ CometChatCalls.videoPaused(true)
+ CometChatCalls.videoPaused(false)

  CometChatCalls.switchCamera()        // unchanged

- CometChatCalls.setMode(mode)         // setMode is on CallSettingsBuilder, not the runtime facade
+ // layout is fixed at session start via CallSettingsBuilder.setMode(_:) — there is no runtime setLayout

  CometChatCalls.startRecording()      // recording control
  CometChatCalls.stopRecording()

  CometChatCalls.enterPIPMode()        // PiP — NOT CallSession.shared.enablePictureInPictureLayout
  CometChatCalls.exitPIPMode()
```

Local screen-share initiation is **not** available on the iOS Calls SDK v5 — there is no `startScreenShare`.

---

## Chat SDK signaling (ringing mode) — verify these too

```diff
- Call(receiverUid: uid, receiverType: .user, callType: .video)
+ Call(receiverId: uid, callType: .video, receiverType: .user)   // CometChatSDK arg order

- callType: .voice
+ callType: .audio                     // CallType is .audio / .video / .audioVideo — there is no .voice

- CometChat.login(UID:..., authKey:...)  // still correct; there is NO loginAsync
```

Call delegate is `CometChatCallDelegate` with two-param callbacks, e.g. `onIncomingCallReceived(incomingCall:error:)`; register with `CometChat.addCallListener(_:_:)` (positional labels).

---

## Verification checklist

- [ ] Podfile / Package.swift updated to `~> 5.0`
- [ ] `pod install --repo-update` (CocoaPods) or SwiftPM resolved cleanly
- [ ] NO `CometChatCalls.login` anywhere — auth is per-session via `generateToken`
- [ ] `CallSettingsBuilder().build()` used; no `SessionSettings`/`SessionSettingsBuilder`
- [ ] `CallsEventsDelegate` implemented; no `CometChatCallsEventsListener`, no `addEventListener(.enum)`
- [ ] Lifecycle is `generateToken` → `startSession` → `endSession`; no `joinSession`, no `CallSession.shared`
- [ ] Controls use `audioMuted`/`videoPaused`/`enterPIPMode`/`exitPIPMode`
- [ ] `Call(receiverId:callType:receiverType:)` arg order; `CallType` has no `.voice`
- [ ] Real-device smoke: incoming call from iPhone → answer → mute → end

---

## Pointers

- Canonical migration: https://www.cometchat.com/docs/calls/ios/migration-guide-v5
- `cometchat-ios-calls/SKILL.md` — seven hard rules (still apply post-v5)
- `cometchat-ios-calls/references/server-apns-pushkit.md` — PushKit setup (unchanged in v5)
