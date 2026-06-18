# Recording + screen-share on iOS

Recording is server-side (same as every family). Screen-share on iOS requires a **separate Xcode target** — the iOS Broadcast Upload Extension — because Apple sandboxes screen capture in a separate process. This is the most involved screen-share integration of any family.

For SDK semantics + browser-side details, read `cometchat-react-calls/references/recording-screen-share.md` first. This reference is the iOS-specific manual setup and bridge code.

---

## Recording

### Server-side: dashboard gate

Same as web/RN — enable in **Dashboard → Chat & Messaging → Calls → Recording**. Client flag is no-op without it.

### Client-side flag

```swift
import CometChatCallsSDK

let settings = CallSettingsBuilder()
  .setIsAudioOnly(false)
  .setStartRecordingOnCallStart(true)   // auto-start recording on session start
  .setShowRecordingButton(true)         // show the kit's user-toggleable REC button
  .build()
```

There is no `setSessionType` and no `enableRecording` on the iOS v5 builder. Auto-start is `setStartRecordingOnCallStart(_:)`; button visibility is `setShowRecordingButton(_:)`. To toggle recording programmatically mid-call, use the static `CometChatCalls.startRecording()` / `CometChatCalls.stopRecording()`.

### Lifecycle events (REC indicator)

The iOS Calls SDK v5 has a SINGLE recording callback — `onRecordingToggled(info:)` on `CallsEventsDelegate` (swiftinterface label is `info:`, payload is an `NSDictionary`). There is no `onRecordingStarted`/`onRecordingStopped`/`onRecordingFailed` split, and the delegate is a protocol you conform to (not an object with assignable closure properties).

```swift
extension CustomOngoingCallViewController: CallsEventsDelegate {
  // swiftinterface: onRecordingToggled(info: NSDictionary)
  func onRecordingToggled(info: NSDictionary) {
    DispatchQueue.main.async { [weak self] in
      // info carries the current recording state + initiating user.
      // Drive the REC badge from your own isRecording flag toggled here.
      self?.isRecording.toggle()
      self?.recBadge.isHidden = !(self?.isRecording ?? false)
    }
  }
}
```

Wire the delegate via `CallSettingsBuilder.setDelegate(self)` or `CometChatCalls.addCallEventListener(observerId:delegate:)`. There is no separate recording-failure callback — surface failures from your own start/stop call sites if you toggle programmatically.

The badge: a small "REC" pill with a blinking red dot. Must be visible to all participants — compliance requirement (CCPA, GDPR Art. 6/7, two-party-consent US states).

```swift
final class RecBadgeView: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = UIColor(white: 0, alpha: 0.6)
    layer.cornerRadius = 4

    let dot = UILabel()
    dot.text = "●"
    dot.textColor = .systemRed
    dot.font = .systemFont(ofSize: 12)
    dot.translatesAutoresizingMaskIntoConstraints = false

    let label = UILabel()
    label.text = "REC"
    label.textColor = .white
    label.font = .systemFont(ofSize: 12, weight: .semibold)
    label.translatesAutoresizingMaskIntoConstraints = false

    addSubview(dot)
    addSubview(label)
    NSLayoutConstraint.activate([
      dot.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
      dot.centerYAnchor.constraint(equalTo: centerYAnchor),
      label.leadingAnchor.constraint(equalTo: dot.trailingAnchor, constant: 4),
      label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
      label.centerYAnchor.constraint(equalTo: centerYAnchor),
    ])

    // Blink animation
    UIView.animate(withDuration: 0.8, delay: 0, options: [.repeat, .autoreverse], animations: {
      dot.alpha = 0.3
    })
  }
  required init?(coder: NSCoder) { fatalError() }
}
```

### Recording retrieval

CometChat hosts the file. Same as web/RN — accessible via dashboard UI or REST API from your server. Never expose recording URLs to the iOS client.

---

## Screen sharing — iOS Calls SDK v5.x does NOT support INITIATING

**Confirmed against the v5 `CometChatCallsSDK` Swift interface:** the iOS Calls SDK does not support initiating screen sharing. iOS callees can RECEIVE incoming screen shares from web/Android peers — the SDK renders the incoming screen track into the session view automatically — but `CallsEventsDelegate` exposes NO dedicated screen-share callback (no `onScreenShareStarted`/`onScreenShareEnded`, no `onParticipantStartedScreenShare`, no `OngoingCallListener`). iOS cannot SEND.

The symbols previously documented in this file (`CometChatCalls.startScreenShareBroadcast`, `processBroadcastVideoFrame`, `processBroadcastAudioFrame`, `endScreenShareBroadcast`) **do not exist** on `CometChatCallsSDK` v5.x. If you've copied these from an earlier draft of this doc, they will not compile against the actual SDK.

### What works today

| Direction | Status | API |
|---|---|---|
| Receive screen share (iOS callee) | ✅ supported (rendered by the SDK into the session view) | no dedicated callback — the screen track renders like any remote video |
| Initiate screen share (iOS caller → others) | ❌ NOT supported by CometChatCallsSDK v5 | n/a |

For applications that need iOS users to share their screen today, the practical options are:

1. **Defer screen-share initiation to web/Android peers.** Document that iOS callers are receive-only for screen content.
2. **Wait for vendor support.** Track the CometChat iOS Calls SDK release notes; this is a known gap.
3. **Build your own WebRTC bridge** in a Broadcast Upload Extension and attach a manual video track to the underlying peer connection. The CometChat session is a WebRTC peer connection internally, but the SDK does not expose the peer-connection handle, so this requires forking/patching the SDK — not recommended.

### Architecture pieces that remain valid (for future SDK support)

Steps 1–4 below (Broadcast Upload Extension target, App Groups capability, `RPBroadcastProcessModeSampleBuffer` Info.plist, `RPSystemBroadcastPickerView`) are all valid iOS-level setup that any future SDK adding sender-side screen-share would also require. Kept here for reference. **Skip Steps 5–6 (SampleHandler.swift + App-Group state pre-write) — they reference SDK symbols that do not exist.**

iOS sandboxes screen capture inside a separate process. To share (IF the SDK supported it), you would need:

1. **A Broadcast Upload Extension target** in your Xcode project
2. **An App Group capability** shared between the main app and the extension
3. **An RPSystemBroadcastPickerView** (provided by ReplayKit) that lets the user start sharing
4. **A WebRTC bridge in the extension** that pipes captured frames into the Calls SDK session

Apple doesn't allow main-app screen capture for privacy reasons; this Extension architecture is unavoidable.

### Step 1 — Create the Broadcast Upload Extension

Xcode → File → New → Target → **Broadcast Upload Extension**.

- Product Name: `YourAppBroadcastExtension`
- Bundle Identifier: `com.yourcompany.YourApp.BroadcastExtension`
- Embed in Application: YourApp

Xcode generates a `SampleHandler.swift` with stub methods.

### Step 2 — App Group

Both the main target AND the extension target need this capability.

Main app target → Signing & Capabilities → + Capability → **App Groups** → enable `group.com.yourcompany.yourapp.broadcast`.

Extension target → same capability, same group identifier.

### Step 3 — Info.plist for the extension

The extension's `Info.plist` (auto-generated by Xcode) must have:

```xml
<key>NSExtension</key>
<dict>
  <key>NSExtensionPointIdentifier</key>
  <string>com.apple.broadcast-services-upload</string>
  <key>NSExtensionPrincipalClass</key>
  <string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
  <key>RPBroadcastProcessMode</key>
  <string>RPBroadcastProcessModeSampleBuffer</string>
</dict>
```

`RPBroadcastProcessModeSampleBuffer` is critical — without it, the extension receives audio/video data in a different format that doesn't fit the Calls SDK's bridge.

### Step 4 — RPSystemBroadcastPickerView in the call screen

```swift
import ReplayKit

class CustomOngoingCallViewController: UIViewController {
  private lazy var broadcastPicker: RPSystemBroadcastPickerView = {
    let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 50, height: 50))
    picker.preferredExtension = "com.yourcompany.YourApp.BroadcastExtension"
    picker.showsMicrophoneButton = false           // SDK handles mic
    return picker
  }()

  override func viewDidLoad() {
    super.viewDidLoad()
    // Find and customize the actual button inside the picker (Apple's API restriction)
    if let button = broadcastPicker.subviews.compactMap({ $0 as? UIButton }).first {
      button.setImage(UIImage(systemName: "rectangle.on.rectangle.angled"), for: .normal)
    }
    view.addSubview(broadcastPicker)
    // Layout broadcastPicker as part of your control panel
  }
}
```

When the user taps the picker, iOS shows the system broadcast UI listing your extension. They tap it; the extension activates; capture begins.

### Steps 5–6 — SDK frame bridge: NOT available

iOS cannot INITIATE screen share (receive-only). `CometChatCallsSDK` v5.x exposes no frame-bridge API (`startScreenShareBroadcast`/`processBroadcastVideoFrame`/`processBroadcastAudioFrame`/`endScreenShareBroadcast` are all absent), so there is no `SampleHandler` pipeline to write — defer screen-share initiation to web/Android peers.

---

## Viewer — receiving someone else's screen share

When a web/Android peer starts sharing, the iOS Calls SDK renders the incoming screen track into the session `view` you passed to `startSession` — exactly like any other remote video tile. There is **no** `onScreenShareStarted`/`onScreenShareEnded` callback on `CallsEventsDelegate` to hook (those symbols do not exist on iOS v5).

If you need to react to participant changes around a screen share (e.g. relayout), use the typed participant callbacks — `onUserJoined(rtcUser:)`, `onUserLeft(rtcUser:)`, `onUserListChanged(rtcUsers:)` (swiftinterface:35,38,41 — `RTCUser` objects). For default-UI integrations no code is required: the SDK handles the screen-track layout for you.

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Picker doesn't show your extension | Bundle ID mismatch in `preferredExtension` | Match the extension target's Bundle ID exactly |
| "No active session" finishBroadcastWithError | App Group identifier mismatch | Both targets must use the same `group.*` identifier |
| Extension launches but no video on remote side | Missing `RPBroadcastProcessModeSampleBuffer` in extension Info.plist | Add it |
| Recording flag set but no recording in dashboard | Plan doesn't include recording, or dashboard toggle off | Enable in dashboard |
| REC badge missing | Custom UI — must render manually | Subscribe to `onRecordingToggled(info:)` and render badge |
| Screen share doesn't end on call hangup | `broadcastFinished` not triggering | Manually call `RPBroadcastController.shared.finishBroadcast(...)` from main app on hangup |

---

## Anti-patterns

1. **Embedding screen-share logic in the main app target.** iOS doesn't allow it — must be a separate extension.
2. **App Groups with mismatched identifiers.** Extension can't see main app state; broadcast finishes immediately.
3. **`RPSystemBroadcastPickerView` with hidden button via removeFromSuperview.** Apple may reject the build for App Store. Customize via subview iteration only.
4. **No REC indicator.** Compliance violation in two-party-consent jurisdictions.
5. **Trying to access recording files from the device.** They're not local — server-only access via REST API.
6. **Implementing the SampleHandler.broadcastStarted/processSampleBuffer/broadcastFinished pipeline against CometChatCallsSDK v5.x.** Per the audit above, the SDK does not expose `startScreenShareBroadcast`, `processBroadcastVideoFrame`, `processBroadcastAudioFrame`, or `endScreenShareBroadcast`. Steps 5–6 of this doc are kept for reference but will not compile against the actual SDK today.

---

## Verification checklist

**Recording:**
- [ ] Dashboard plan includes recording feature
- [ ] `setStartRecordingOnCallStart(true)` and/or `setShowRecordingButton(true)` on `CallSettingsBuilder` (no `enableRecording`)
- [ ] `onRecordingToggled(info:)` listener wired (single callback — no Started/Stopped/Failed split)
- [ ] REC badge visible to all participants when active

**Screen share — receiver side only (iOS Calls SDK v5 cannot INITIATE):**
- [ ] No code required for default UI — the SDK renders the incoming screen track into the session view
- [ ] No `onScreenShareStarted`/`onScreenShareEnded`/`onParticipantStartedScreenShare`/`OngoingCallListener` referenced (none exist on iOS v5)
- [ ] Sender-side screen-share architecture (Broadcast Extension, SampleHandler) NOT implemented against current SDK — the symbols don't exist

**Real-device smoke (receive-only — iOS cannot INITIATE screen share):**
- [ ] When a participant on another platform (web/Android) shares their screen, it renders in the iOS call view
- [ ] No sender-side broadcast picker/UI is shown on iOS (there is no initiation API in the v5 SDK)

---

## Pointers

- `cometchat-react-calls/references/recording-screen-share.md` — sister reference (SDK semantics, browser semantics, server-side recording retrieval)
- `cometchat-native-calls/references/recording-screen-share.md` — RN reference (same Broadcast Upload Extension pattern; this iOS version is more detailed)
- `references/group-calls.md` — recording group calls (server composition handles layout)
- `cometchat-ios-calls` SKILL.md — base hard rules
