# Picture-in-Picture on iOS

iOS supports PiP for video calls via `AVPictureInPictureController` (iOS 14+) or via CallKit's auto-PiP (iOS 14+ when CallKit reports a video call). For most production calling apps, **CallKit handles PiP for free** — if you've integrated CallKit (rule 1.7 in the SKILL.md), iOS auto-PiPs your call when the user backgrounds the app.

The `AVPictureInPictureController` path is only needed for non-CallKit foreground-only calls (rare — most production apps use CallKit).

---

## CallKit auto-PiP — the simplest path

If your app integrates CallKit (rule 1.7, mandatory for VoIP push standalone mode), iOS auto-handles PiP. When the user presses Home during an active call:

1. iOS automatically captures the call's video stream
2. The CallKit-managed call enters PiP mode
3. The PiP window floats above all apps, even system UI
4. Tapping the PiP window foregrounds your app

No code needed beyond CallKit setup. The skill defaults to this path for standalone-mode calls.

### Required entitlements

```xml
<!-- Info.plist — already required by CallKit -->
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
  <string>remote-notification</string>
</array>
```

`audio` background mode is what lets the call's audio continue while in PiP. Without it, video PiP works but audio cuts.

---

## SDK-managed PiP layout — `CallSession.shared.enablePictureInPictureLayout()`

> **Audit 2026-05-14, confirmed against `https://www.cometchat.com/docs/calls/ios/picture-in-picture.md`:** The iOS Calls SDK v5.x exposes two methods to toggle the SDK's INTERNAL compact layout — it does NOT expose video frames or a `CMSampleBuffer` pipeline to drive a host-app `AVPictureInPictureController`. An earlier draft of this doc cited `CometChatCalls.attachPictureInPictureLayer(layer)` / `detachPictureInPictureLayer()` — **those symbols do not exist on CometChatCallsSDK v5.x**.

### What works today

| Goal | API |
|---|---|
| Switch the SDK's call surface to compact "PiP-style" layout | `CallSession.shared.enablePictureInPictureLayout()` |
| Switch back to full layout | `CallSession.shared.disablePictureInPictureLayout()` |

```swift
import CometChatCallsSDK

// When the user taps "minimize" in the call UI
CallSession.shared.enablePictureInPictureLayout()

// When they tap to expand back, or before hangup
CallSession.shared.disablePictureInPictureLayout()
```

This is **NOT iOS system-level PiP** (the floating window that survives backgrounding). It's an in-app compact layout. For true OS-level PiP (floating call window across all apps + lock screen), see the CallKit path above.

### Custom system-level PiP via `AVPictureInPictureController` — NOT directly supported

Driving iOS system-level PiP via `AVPictureInPictureController` requires feeding video frames to an `AVSampleBufferDisplayLayer`. The Calls SDK does not expose its WebRTC video track for this — the peer-connection handle is internal. Three options:

1. **Recommended: use CallKit** (rule 1.7 SKILL.md). CallKit-managed VoIP calls get auto-PiP for free — no `AVPictureInPictureController` plumbing needed.
2. **Use the SDK's compact layout API** (above) for in-app minimization. Acceptable UX for foreground-only flows.
3. **Roll your own WebRTC bridge.** Requires forking/patching the SDK to expose the underlying `RTCMediaStream` — not recommended.

### Required capability (CallKit path)

In Xcode → Signing & Capabilities → Background Modes → ensure **Audio, AirPlay, and Picture in Picture** is checked. CallKit needs this; without it, CallKit's auto-PiP doesn't fire even with a CallKit-managed call.

### Toggle button for SDK compact layout

```swift
@IBAction func toggleCompactLayout(_ sender: UIButton) {
  if isCompact {
    CallSession.shared.disablePictureInPictureLayout()
  } else {
    CallSession.shared.enablePictureInPictureLayout()
  }
  isCompact.toggle()
}
```

This switches the SDK's call surface between full and compact layouts. The compact view shows local + remote video tiles in a smaller container; useful when you want to free screen space for other UI but keep the call visible.

> **Note**: `AVPictureInPictureController` + KVO on `isPictureInPicturePossible` patterns (previously documented here) are not applicable because the SDK does not expose the video frames `AVPictureInPictureController` requires. Use the CallKit path for system-level PiP, or this compact-layout API for in-app PiP-style minimization.

---

## SwiftUI integration

Wrap the UIKit view controller as a `UIViewControllerRepresentable`:

```swift
struct PiPCallView: UIViewControllerRepresentable {
  let sessionID: String

  func makeUIViewController(context: Context) -> CustomOngoingCallViewController {
    let vc = CustomOngoingCallViewController(sessionID: sessionID)
    return vc
  }

  func updateUIViewController(_ vc: CustomOngoingCallViewController, context: Context) {}
}
```

Use in your SwiftUI app:

```swift
struct CallScreen: View {
  let sessionID: String

  var body: some View {
    PiPCallView(sessionID: sessionID)
      .ignoresSafeArea()
  }
}
```

---

## Auto-PiP on backgrounding (manual path)

iOS 14+ supports auto-PiP from inline AVKit playback. For active calls:

```swift
pipController?.canStartPictureInPictureAutomaticallyFromInline = true
```

Combined with the `audio` background mode, this gives you the same behavior as CallKit auto-PiP: press Home → call enters PiP → audio + video continue.

---

## Delegate methods

```swift
extension CustomOngoingCallViewController: AVPictureInPictureControllerDelegate {
  func pictureInPictureControllerWillStartPictureInPicture(_ pip: AVPictureInPictureController) {
    // Hide your in-page video (it duplicates with PiP)
    sampleBufferDisplayLayer?.isHidden = true
  }

  func pictureInPictureControllerDidStartPictureInPicture(_ pip: AVPictureInPictureController) {
    // PiP is active
  }

  func pictureInPictureController(_ pip: AVPictureInPictureController,
                                    failedToStartPictureInPictureWithError error: Error) {
    print("PiP failed:", error)
  }

  func pictureInPictureControllerDidStopPictureInPicture(_ pip: AVPictureInPictureController) {
    sampleBufferDisplayLayer?.isHidden = false
  }

  func pictureInPictureController(_ pip: AVPictureInPictureController,
                                    restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completion: @escaping (Bool) -> Void) {
    // User tapped the PiP window — restore the full call screen
    if let nav = self.navigationController {
      nav.popToRootViewController(animated: true)
    }
    completion(true)
  }
}
```

`restoreUserInterfaceForPictureInPictureStopWithCompletionHandler` is critical — without it, tapping the PiP window restores nothing.

---

## Lock screen + PiP

When the device is locked during a call:

- **CallKit-managed call:** PiP appears on the lock screen as part of the CallKit incoming-call card. Audio continues; video shows in the lock-screen UI.
- **Manual `AVPictureInPictureController`:** PiP cannot show on the lock screen. The video pauses; audio continues if `audio` background mode is set.

Standalone-mode VoIP apps must use CallKit for the lock-screen video story to work.

---

## Hangup cleanup

When the call ends:

```swift
func endCall() {
  // Switch SDK back to default layout BEFORE ending the session, otherwise
  // a re-init of the SDK can inherit compact-layout state on the next call.
  CallSession.shared.disablePictureInPictureLayout()

  CallSession.shared.leaveSession()   // ends the WebRTC session

  do {
    try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  } catch {}
}
```

If you ALSO drove a host-app `AVPictureInPictureController` (against an external video source), call `pipController?.stopPictureInPicture()` before tearing down. The CometChat SDK has no awareness of that controller.

---

## Anti-patterns

1. **Using `CometChatCalls.attachPictureInPictureLayer(layer)` / `detachPictureInPictureLayer()`** — these symbols **do not exist** on `CometChatCallsSDK` v5.x. Confirmed against the SDK docs 2026-05-14. Use `CallSession.shared.enable/disablePictureInPictureLayout()` instead.
2. **Manual `AVPictureInPictureController` for VoIP apps without CallKit.** Lock-screen ringing breaks; the SDK does not expose its video pipeline so the PiP window won't render the call. Use CallKit.
3. **No `audio` background mode.** Audio cuts when the app backgrounds, regardless of PiP path.
4. **Mixing SDK compact-layout with host-driven `AVPictureInPictureController`.** Two competing PiP surfaces — the SDK's compact layout fights the user's manual PiP, both look broken. Pick one.

---

## Verification checklist

- [ ] CallKit integrated (rule 1.7 in SKILL.md) — gives you PiP for free
- [ ] `audio` in `UIBackgroundModes` (Info.plist)
- [ ] Background Modes capability includes "Audio, AirPlay, and Picture in Picture"

**SDK compact-layout path (in-app PiP, no system-level PiP):**
- [ ] `CallSession.shared.enablePictureInPictureLayout()` called to enter compact mode
- [ ] `CallSession.shared.disablePictureInPictureLayout()` called BEFORE `leaveSession()` on hangup
- [ ] UI button to toggle between full/compact layouts
- [ ] NOT used together with a host-app `AVPictureInPictureController` (see anti-pattern #4)

**Real-device smoke (CallKit path):**
- [ ] Press Home during call → PiP appears (auto via CallKit)
- [ ] Audio continues through PiP transition
- [ ] Tap PiP window → app foregrounds, full call screen restored
- [ ] Lock device → PiP visible on lock screen (CallKit only)
- [ ] Hangup ends call cleanly; no stuck PiP window

**Real-device smoke (SDK compact-layout path):**
- [ ] Tap "minimize" → SDK switches to compact layout in-app
- [ ] Tap "expand" → SDK switches back to full layout
- [ ] Hangup from compact layout cleanly ends call

---

## Pointers

- `references/callkit-and-pushkit.md` — CallKit gives PiP for free
- `references/avaudiosession-routing.md` — audio routing during PiP transitions
- `references/swiftui-uikit-hosting.md` — SwiftUI hosting of the UIKit PiP view controller
- `cometchat-native-calls/references/picture-in-picture.md` — sister reference (RN bridges to the same iOS APIs)
- `cometchat-react-calls/references/picture-in-picture.md` — Web PiP (different APIs but same UX shape)
- `cometchat-ios-calls` SKILL.md — base hard rules
