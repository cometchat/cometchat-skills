# Custom call UI on iOS

Same shape as the other families' custom-ui references. iOS-specific because of CallKit interplay (rule 1.7: CallKit owns standalone-mode incoming UI, so custom in-app incoming UI is additive-mode-only) and AVFoundation routing.

---

## Two paths

1. **Style the kit's `CometChatOngoingCall`** UIViewController via theming + property overrides. Cheapest. Covers most apps.
2. **Build your own UIViewController on the SDK** — direct `CometChatCalls.joinSession` with your own UIView containers. Maximum control.

This reference covers path 2.

---

## Architecture

```
Your UIViewController
├── containerView for remote participant(s)    ← UIView the SDK draws into
├── localPreviewView                            ← AVCaptureVideoPreviewLayer or SDK preview
├── controlPanel (mute / camera / end / switch)
└── statusLabel (call state, duration)
```

The Calls SDK draws video into UIViews you provide. You don't render WebRTC tracks yourself (unlike web/RN where you wire `<video>` elements).

---

## Custom OngoingCallViewController

```swift
import UIKit
import AVFoundation
import CometChatCallsSDK

class CustomOngoingCallViewController: UIViewController {
  private let containerView = UIView()
  private let localPreviewView = UIView()
  private lazy var controlPanel = ControlPanelView()
  private let statusLabel = UILabel()

  private let sessionID: String
  private let isAudioOnly: Bool
  private var listener: CometChatCallsEventsListener?

  init(sessionID: String, isAudioOnly: Bool) {
    self.sessionID = sessionID
    self.isAudioOnly = isAudioOnly
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .fullScreen
  }

  required init?(coder: NSCoder) { fatalError() }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    setupLayout()
    startCall()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    cleanup()
  }

  private func startCall() {
    listener = self
    // Build SessionSettings — match upstream sample shape.
    // For custom UI, you typically build your own controls and just need the SDK
    // to feed video tiles into your container. enableDefaultLayout is not part
    // of SessionSettings — disable individual default-UI elements via the
    // hide* setters on SessionSettingsBuilder if you want a minimal surface.
    let settings = SessionSettingsBuilder()
      .setTitle(isAudioOnly ? "Voice Call" : "Video Call")
      .startVideoPaused(isAudioOnly)
      .startAudioMuted(false)
      .build()

    // Configure audio session BEFORE joining
    try? configureAudioSession()

    // Single-call joinSession(sessionID:callSetting:container:) — the SDK
    // generates the token internally. NO separate generateToken call.
    CometChatCalls.joinSession(
      sessionID: sessionID,
      callSetting: settings,
      container: containerView
    ) { [weak self] success in
      guard let self = self else { return }
      // Register listeners on the resulting CallSession AFTER onSuccess.
      let session = CometChatCallsSDK.CallSession.shared
      session.addSessionStatusListener(self.listener)
      session.addButtonClickListener(self.listener)
    } onError: { error in
      print("joinSession failed: \(error?.errorDescription ?? "unknown")")
    }
  }

  private func configureAudioSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playAndRecord,
      mode: isAudioOnly ? .voiceChat : .videoChat,
      options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker]
    )
    try session.setActive(true)
  }

  private func cleanup() {
    // CometChatCalls.endSession() does NOT exist on iOS — use CallSession.shared.leaveSession()
    CometChatCallsSDK.CallSession.shared.leaveSession()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  private func setupLayout() {
    [containerView, localPreviewView, controlPanel, statusLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      view.addSubview($0)
    }

    NSLayoutConstraint.activate([
      containerView.topAnchor.constraint(equalTo: view.topAnchor),
      containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

      localPreviewView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
      localPreviewView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      localPreviewView.widthAnchor.constraint(equalToConstant: 120),
      localPreviewView.heightAnchor.constraint(equalToConstant: 160),

      controlPanel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
      controlPanel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      controlPanel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      controlPanel.heightAnchor.constraint(equalToConstant: 80),

      statusLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
      statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
    ])
  }
}

extension CustomOngoingCallViewController: CometChatCallsEventsListener {
  func onCallEnded() {
    DispatchQueue.main.async { [weak self] in
      self?.cleanup()
      self?.dismiss(animated: true)
    }
  }

  func onUserListUpdated(_ users: [Any]) {
    DispatchQueue.main.async { [weak self] in
      self?.statusLabel.text = "\(users.count) participants"
    }
  }

  func onError(_ error: Error) {
    print("Call error: \(error)")
  }
}
```

The `DispatchQueue.main.async` wrapping is the iOS equivalent of NgZone.run on Angular — SDK callbacks fire on background queues; UI updates must be on main.

---

## Control panel

```swift
final class ControlPanelView: UIView {
  let muteButton = UIButton(type: .system)
  let cameraButton = UIButton(type: .system)
  let switchCameraButton = UIButton(type: .system)
  let endButton = UIButton(type: .system)

  var onMute: (() -> Void)?
  var onCamera: (() -> Void)?
  var onSwitch: (() -> Void)?
  var onEnd: (() -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = UIColor(white: 0, alpha: 0.4)
    layer.cornerRadius = 40

    let stack = UIStackView(arrangedSubviews: [muteButton, cameraButton, switchCameraButton, endButton])
    stack.distribution = .equalCentering
    stack.alignment = .center
    stack.translatesAutoresizingMaskIntoConstraints = false
    addSubview(stack)

    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      stack.centerYAnchor.constraint(equalTo: centerYAnchor),
    ])

    muteButton.setTitle("Mute", for: .normal)
    cameraButton.setTitle("Cam", for: .normal)
    switchCameraButton.setTitle("Flip", for: .normal)
    endButton.setTitle("End", for: .normal)
    endButton.tintColor = .red

    muteButton.addAction(UIAction { [weak self] _ in self?.onMute?() }, for: .touchUpInside)
    cameraButton.addAction(UIAction { [weak self] _ in self?.onCamera?() }, for: .touchUpInside)
    switchCameraButton.addAction(UIAction { [weak self] _ in self?.onSwitch?() }, for: .touchUpInside)
    endButton.addAction(UIAction { [weak self] _ in self?.onEnd?() }, for: .touchUpInside)
  }

  required init?(coder: NSCoder) { fatalError() }
}
```

Wire actions in the VC:

```swift
override func viewDidLoad() {
  super.viewDidLoad()
  // ...
  controlPanel.onMute = { [weak self] in
    guard let self = self else { return }
    self.muted.toggle()
    CometChatCalls.muteAudio(self.muted)
  }
  controlPanel.onCamera = { [weak self] in
    guard let self = self else { return }
    self.cameraOff.toggle()
    CometChatCalls.pauseVideo(self.cameraOff)
  }
  controlPanel.onSwitch = { CometChatCalls.switchCamera() }
  controlPanel.onEnd = { [weak self] in
    self?.cleanup()
    self?.dismiss(animated: true)
  }
}
```

---

## Local preview before connect

```swift
private lazy var captureSession = AVCaptureSession()
private lazy var previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)

private func startLocalPreview() {
  guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
        let input = try? AVCaptureDeviceInput(device: device) else { return }

  captureSession.addInput(input)
  previewLayer.frame = localPreviewView.bounds
  previewLayer.videoGravity = .resizeAspectFill
  localPreviewView.layer.addSublayer(previewLayer)

  DispatchQueue.global(qos: .userInitiated).async {
    self.captureSession.startRunning()
  }
}

private func stopLocalPreview() {
  captureSession.stopRunning()
  previewLayer.removeFromSuperlayer()
}
```

Stop the preview BEFORE `joinSession` — the SDK takes over the camera and your `AVCaptureSession` will fight with it.

---

## SwiftUI hosting

Wrap with `UIViewControllerRepresentable` (see `references/swiftui-uikit-hosting.md`):

```swift
struct CustomOngoingCallView: UIViewControllerRepresentable {
  let sessionID: String
  let isAudioOnly: Bool

  func makeUIViewController(context: Context) -> CustomOngoingCallViewController {
    CustomOngoingCallViewController(sessionID: sessionID, isAudioOnly: isAudioOnly)
  }

  func updateUIViewController(_ vc: CustomOngoingCallViewController, context: Context) {}
}
```

Present via `.fullScreenCover` (NOT `.sheet`).

---

## Picture-in-picture

iOS supports PiP for video calls via `AVPictureInPictureController`:

```swift
import AVKit

class CustomOngoingCallViewController {
  private var pipController: AVPictureInPictureController?

  func setupPiP() {
    guard AVPictureInPictureController.isPictureInPictureSupported() else { return }
    let layer = AVSampleBufferDisplayLayer()
    containerView.layer.addSublayer(layer)
    let contentSource = AVPictureInPictureController.ContentSource(sampleBufferDisplayLayer: layer, playbackDelegate: self)
    pipController = AVPictureInPictureController(contentSource: contentSource)
    pipController?.canStartPictureInPictureAutomaticallyFromInline = true
  }
}
```

Setting up PiP for WebRTC video is involved — the SDK doesn't expose a `CMSampleBuffer` stream directly. For most apps, `enableDefaultLayout(true)` and let the kit's PiP work; custom UI authors who need PiP can use `CometChatPictureInPicture` (kit class) as a hybrid — kit's PiP, custom rest of UI.

---

## When NOT to go custom

The kit's `CometChatOngoingCall` covers 80% of apps. Custom is for design-system requirements that the kit's theming + property overrides can't reach. Same calculus as web/RN/Angular.

The dispatcher asks before scaffolding custom and defaults to "no — use kit."
