# Device management on iOS

iOS handles audio routing at the system level via `AVAudioSession.sharedInstance().availableInputs`. The Calls SDK exposes camera switching (`switchCamera`) but defers audio device selection to the OS — the user picks via the system's audio route picker (`AVRoutePickerView`) or Control Center.

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/device-management
**Read first:** `references/avaudiosession-routing.md` — AVAudioSession setup + Bluetooth/AirPods routing rules.

---

## Camera switching (front / back / external)

```swift
import CometChatCallsSDK

CometChatCalls.switchCamera()
```

That's the SDK's primary camera control — toggles front/back. For iPad with attached external cameras (Studio Display, Continuity Camera), the user picks via the system Camera control center.

---

## Audio inputs (mic / Bluetooth / AirPods)

System-driven via `AVAudioSession`. The user picks from Control Center → Audio destination, or via your in-app `AVRoutePickerView`:

```swift
import AVKit

class CallControlsView: UIView {
  private let routePicker = AVRoutePickerView()

  init() {
    super.init(frame: .zero)
    routePicker.translatesAutoresizingMaskIntoConstraints = false
    routePicker.activeTintColor = .systemBlue
    addSubview(routePicker)
    NSLayoutConstraint.activate([
      routePicker.widthAnchor.constraint(equalToConstant: 44),
      routePicker.heightAnchor.constraint(equalToConstant: 44),
    ])
  }
  required init?(coder: NSCoder) { fatalError() }
}
```

`AVRoutePickerView` is the canonical iOS audio-route picker. Tapping shows the system sheet with all available outputs (Built-in Speaker, AirPods, CarPlay, Bluetooth speakers, etc.). System-styled; matches user expectations.

---

## Speakerphone toggle

Most calls want a quick speaker on/off without going through the route picker:

```swift
import AVFoundation

func toggleSpeaker(on: Bool) {
  do {
    let session = AVAudioSession.sharedInstance()
    if on {
      try session.overrideOutputAudioPort(.speaker)
    } else {
      try session.overrideOutputAudioPort(.none)   // restore default routing
    }
  } catch {
    print("Failed to switch speaker: \(error)")
  }
}
```

`.none` means "use the system default for current category" (typically receiver/earpiece for `playAndRecord` + `voiceChat`). NOT "no audio."

---

## SwiftUI integration

```swift
struct CallControls: View {
  @State private var speakerOn = false

  var body: some View {
    HStack(spacing: 16) {
      // Speaker toggle
      Button(action: {
        speakerOn.toggle()
        toggleSpeaker(on: speakerOn)
      }) {
        Image(systemName: speakerOn ? "speaker.wave.3.fill" : "speaker.fill")
      }

      // Camera flip
      Button(action: { CometChatCalls.switchCamera() }) {
        Image(systemName: "camera.rotate")
      }

      // System route picker (Bluetooth / AirPods)
      AVRoutePickerViewWrapper()
        .frame(width: 44, height: 44)
    }
  }
}

struct AVRoutePickerViewWrapper: UIViewRepresentable {
  func makeUIView(context: Context) -> AVRoutePickerView {
    let view = AVRoutePickerView()
    view.activeTintColor = .systemBlue
    return view
  }
  func updateUIView(_ view: AVRoutePickerView, context: Context) {}
}
```

---

## Listen for route changes

```swift
NotificationCenter.default.addObserver(
  forName: AVAudioSession.routeChangeNotification,
  object: AVAudioSession.sharedInstance(),
  queue: .main
) { notification in
  guard let userInfo = notification.userInfo,
        let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
        let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }

  switch reason {
  case .newDeviceAvailable:
    // AirPods connected, headphones plugged
    print("New audio device available")
  case .oldDeviceUnavailable:
    // Headphones unplugged
    print("Audio device unavailable")
  default:
    break
  }
}
```

The two reason codes that matter for UI: `.newDeviceAvailable` (show "AirPods connected" toast) and `.oldDeviceUnavailable` (audio routes back to speaker; might want to update UI button state).

---

## Anti-patterns

1. **Building a custom audio route picker** instead of using `AVRoutePickerView`. iOS users expect the system picker; custom feels off-brand.
2. **Setting `overrideOutputAudioPort(.speaker)` from background.** AVAudioSession changes only work when session is active. Wrap in `setActive(true)` first.
3. **Forgetting to listen for `routeChangeNotification`.** UI gets out of sync when user changes route via Control Center.
4. **Calling `setActive(true)` repeatedly during a call.** AVAudioSession is sticky once activated; redundant calls produce warnings in console.
5. **Not handling `.failed` errors from `overrideOutputAudioPort`.** Some Bluetooth devices reject the override; silently swallow OR show a toast.

---

## Verification checklist

- [ ] `AVRoutePickerView` rendered in call controls
- [ ] Speaker toggle uses `overrideOutputAudioPort` correctly
- [ ] `.routeChangeNotification` observer set up
- [ ] All AVAudioSession calls on main queue
- [ ] Real-device smoke: AirPods connect mid-call → toast shown, audio routes
- [ ] Real-device smoke: Speaker toggle works
- [ ] Real-device smoke: Camera flip works (front/back)

---

## Pointers

- `cometchat-react-calls/references/device-management.md` — web sister reference (different mechanism but UX shape)
- `cometchat-ios-calls` SKILL.md — the seven hard rules
- `references/avaudiosession-routing.md` — AVAudioSession setup details
- Canonical docs: https://www.cometchat.com/docs/calls/ios/device-management
