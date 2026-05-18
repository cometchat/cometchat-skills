# AVAudioSession routing for iOS calls

The most-overlooked piece of iOS calls. Without correct `AVAudioSession` configuration, calls sound like the user is talking through an earpiece even with the speaker on, or background music doesn't resume after hangup.

---

## The four states that matter

| State | When |
|---|---|
| Inactive | App not in a call |
| Active + .playAndRecord, .voiceChat | Active call (voice or video) |
| Active + .playAndRecord, .videoChat | Active video call (slightly different routing — closer to face) |
| Inactive + .notifyOthersOnDeactivation | Just hung up — tells music apps to resume |

---

## On call start

```swift
import AVFoundation

func configureForCall(isVideo: Bool) throws {
  let session = AVAudioSession.sharedInstance()

  try session.setCategory(
    .playAndRecord,
    mode: isVideo ? .videoChat : .voiceChat,
    options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker]
  )

  try session.setActive(true)
}
```

`mode: .voiceChat` enables echo cancellation and noise suppression optimized for voice calls. `mode: .videoChat` does the same but defaults to a slightly louder speaker volume (designed for handsfree use).

`.allowBluetooth` allows AirPods, hearing aids. `.allowBluetoothA2DP` allows Bluetooth speakers. `.defaultToSpeaker` makes voice calls speakerphone by default — without it, calls route to the earpiece, which feels wrong for a video call.

---

## On hangup — the canonical bug fix

```swift
func endCall() {
  // CometChatCalls.endSession() does NOT exist on iOS — use leaveSession on CallSession.shared
  CometChatCallsSDK.CallSession.shared.leaveSession()

  do {
    try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  } catch {
    // Best-effort — don't block hangup on this
    print("Failed to deactivate audio session: \(error)")
  }
}
```

`.notifyOthersOnDeactivation` is the magic. Without it:

- Music app was paused by the call → stays paused
- Other apps' audio was ducked → stays ducked
- The user thinks the music app is broken

With it, the system tells other audio sessions "the call's done, resume what you were doing."

---

## Switching speaker on/off mid-call

```swift
func toggleSpeaker(on: Bool) throws {
  let session = AVAudioSession.sharedInstance()
  try session.overrideOutputAudioPort(on ? .speaker : .none)
}
```

`.none` doesn't mean "no audio" — it means "use the system's default routing for this category" (which for `.playAndRecord` + `.voiceChat` is the receiver/earpiece).

---

## Detecting Bluetooth + AirPods + hearing aids

```swift
func currentAudioRoute() -> String {
  let route = AVAudioSession.sharedInstance().currentRoute
  let outputs = route.outputs.map { $0.portType.rawValue }
  // Common values: "Speaker", "Receiver", "BluetoothA2DPOutput", "BluetoothHFP", "BuiltInReceiver"
  return outputs.first ?? "unknown"
}

func observeRouteChanges() {
  NotificationCenter.default.addObserver(
    forName: AVAudioSession.routeChangeNotification,
    object: nil,
    queue: .main
  ) { notification in
    // User plugged in headphones / unplugged AirPods
    print("Route changed: \(self.currentAudioRoute())")
  }
}
```

For UI: show a "Speaker / AirPods / Bluetooth" indicator in the call control panel based on `currentAudioRoute()`.

---

## CallKit + AVAudioSession — they fight if you don't coordinate

CallKit's `provider(_:didActivate:)` callback fires when CallKit takes over the audio session (typically when the user answers from the lock screen). If you call `setActive(true)` yourself in the answer handler, CallKit might do it again and you get warnings.

**Pattern:**

```swift
extension CallManager: CXProviderDelegate {
  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    // CallKit just activated the session — do post-activation work
    // (e.g. start the WebRTC session)
    if let pendingSessionId = self.pendingActivation {
      startCometChatCallsSession(sessionID: pendingSessionId)
      self.pendingActivation = nil
    }
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    // CallKit deactivated — your cleanup runs in CXEndCallAction
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    // Configure category but DO NOT set active
    try? AVAudioSession.sharedInstance().setCategory(
      .playAndRecord, mode: .voiceChat,
      options: [.allowBluetooth, .defaultToSpeaker]
    )

    // Store sessionId; defer joinSession to didActivate
    self.pendingActivation = pendingSessionIds[action.callUUID]
    action.fulfill()
  }
}
```

CallKit calls `setActive(true)` for you when it's done with its lock-screen UI. You call `joinSession` from `didActivate`.

For non-CallKit-driven calls (outgoing from inside the app), you do `setActive(true)` yourself.

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Music doesn't resume after call | Missing `.notifyOthersOnDeactivation` | Add to `setActive(false, ...)` call |
| Voice call sounds quiet, like through phone receiver | Missing `.defaultToSpeaker` option | Add to `setCategory` options |
| Bluetooth headphones not used during call | Missing `.allowBluetooth` option | Add to `setCategory` options |
| CXAnswerCallAction races with `setActive(true)` | Manual `setActive(true)` in answer handler | Defer `joinSession` to `didActivate` |
| Echo / feedback during voice call | Wrong `mode` (e.g. `.default` instead of `.voiceChat`) | Use `.voiceChat` or `.videoChat` |
| Call audio works in foreground but cuts in background | UIBackgroundModes missing `audio` | Add `audio` to `Info.plist` UIBackgroundModes |

---

## Audio session interruptions

Phone calls (the actual phone, not your VoIP) can interrupt your call:

```swift
NotificationCenter.default.addObserver(
  forName: AVAudioSession.interruptionNotification,
  object: AVAudioSession.sharedInstance(),
  queue: .main
) { notification in
  guard let userInfo = notification.userInfo,
        let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
        let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

  switch type {
  case .began:
    // Phone call started — pause our call's audio (CallKit may auto-handle this for you)
    CometChatCalls.muteAudio(true)
  case .ended:
    // Phone call ended — resume
    CometChatCalls.muteAudio(false)
    try? AVAudioSession.sharedInstance().setActive(true)
  @unknown default:
    break
  }
}
```

If you've integrated CallKit fully, iOS handles most of this — your VoIP call shows up as a "second call" in the system UI and the user can choose which to keep.
