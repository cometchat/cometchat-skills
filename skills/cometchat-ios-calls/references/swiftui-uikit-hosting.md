# SwiftUI + UIKit hosting for iOS calls

CometChat's iOS Calls UI Kit ships UIKit `UIViewController`s. SwiftUI apps host them via `UIViewControllerRepresentable`. Mixed projects (SwiftUI app shell with UIKit feature screens) work natively.

---

## Pure UIKit project — direct usage

```swift
import UIKit
import CometChatUIKitSwift

class ProfileViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()

    let callButton = CometChatCallButton(user: user)
    callButton.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(callButton)
    NSLayoutConstraint.activate([
      callButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      callButton.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),
    ])
  }
}
```

For ongoing call:

```swift
let ongoingCallVC = CometChatOngoingCall()
ongoingCallVC.set(sessionID: sessionId)
present(ongoingCallVC, animated: true)
```

---

## Pure SwiftUI project — UIViewControllerRepresentable

Wrap each UIKit VC in a SwiftUI view:

```swift
import SwiftUI
import CometChatUIKitSwift

struct CallButtonView: UIViewRepresentable {
  let user: User

  func makeUIView(context: Context) -> CometChatCallButton {
    CometChatCallButton(user: user)
  }

  func updateUIView(_ uiView: CometChatCallButton, context: Context) {
    // Re-bind on user change if your view supports that
  }
}

struct OngoingCallView: UIViewControllerRepresentable {
  let sessionID: String
  @Binding var isPresented: Bool

  func makeUIViewController(context: Context) -> CometChatOngoingCall {
    let vc = CometChatOngoingCall()
    vc.set(sessionID: sessionID)
    return vc
  }

  func updateUIViewController(_ vc: CometChatOngoingCall, context: Context) {}
}

struct CallLogsView: UIViewControllerRepresentable {
  func makeUIViewController(context: Context) -> CometChatCallLogs {
    CometChatCallLogs()
  }

  func updateUIViewController(_ vc: CometChatCallLogs, context: Context) {}
}
```

Use them like any SwiftUI view:

```swift
struct ProfileView: View {
  let user: User
  @State private var ongoingSessionID: String?

  var body: some View {
    VStack {
      Text(user.name)
      CallButtonView(user: user)
        .frame(width: 100, height: 44)
    }
    .fullScreenCover(isPresented: Binding(
      get: { ongoingSessionID != nil },
      set: { if !$0 { ongoingSessionID = nil } }
    )) {
      if let id = ongoingSessionID {
        OngoingCallView(sessionID: id, isPresented: Binding(
          get: { true }, set: { _ in ongoingSessionID = nil }
        ))
      }
    }
  }
}
```

---

## Mixed-stack — SwiftUI app, UIKit feature screen

Common in apps that started UIKit and adopted SwiftUI for new features. Calls can stay UIKit; chat can be SwiftUI; both interop.

```swift
// SwiftUI screen pushing a UIKit call screen via UIHostingController bridge
import SwiftUI

struct ChatView: View {
  let user: User

  var body: some View {
    NavigationLink(destination: UIKitCallScreenWrapper(user: user)) {
      Text("Start call")
    }
  }
}

struct UIKitCallScreenWrapper: UIViewControllerRepresentable {
  let user: User

  func makeUIViewController(context: Context) -> UINavigationController {
    let vc = OngoingCallViewController(user: user)   // your custom UIKit VC
    return UINavigationController(rootViewController: vc)
  }

  func updateUIViewController(_ vc: UINavigationController, context: Context) {}
}
```

---

## Where the IncomingCall UI goes (additive mode)

In standalone mode, **CallKit owns the incoming-call UI** — no in-app rendering needed.

In additive mode (chat already integrated and user is foregrounded when a call comes in), the kit's `CometChatIncomingCall` view can render. Mount it at the root:

### SwiftUI app — root mount

```swift
@main
struct YourApp: App {
  @StateObject private var callState = CallState.shared

  var body: some Scene {
    WindowGroup {
      ZStack {
        ContentView()
        if let call = callState.foregroundIncomingCall {
          IncomingCallView(call: call, callState: callState)
            .transition(.move(edge: .top))
        }
      }
    }
  }
}

struct IncomingCallView: UIViewControllerRepresentable {
  let call: Call
  let callState: CallState

  func makeUIViewController(context: Context) -> CometChatIncomingCall {
    let vc = CometChatIncomingCall()
    vc.set(call: call)
    vc.setOnAccept { [weak callState] _ in callState?.accept(call) }
    vc.setOnDecline { [weak callState] _ in callState?.decline(call) }
    return vc
  }

  func updateUIViewController(_ vc: CometChatIncomingCall, context: Context) {}
}
```

### UIKit app — present from root window

```swift
class CallObserver: NSObject {
  func showIncomingCallUI(call: Call) {
    let vc = CometChatIncomingCall()
    vc.set(call: call)
    UIApplication.shared.windows.first?.rootViewController?.present(vc, animated: true)
  }
}
```

In standalone, neither — CallKit handles it.

---

## When to use SwiftUI navigation vs UIKit modal

For ongoing calls specifically, **modal full-screen** is the right pattern on both stacks:

- SwiftUI: `.fullScreenCover(isPresented:)` (NOT `.sheet`, which is dismissable by swipe)
- UIKit: `present(_:animated:)` with `vc.modalPresentationStyle = .fullScreen`

Reason: in-call UI shouldn't be navigable-back-to (the user shouldn't accidentally swipe-down and lose the call view). Full-screen modal forces explicit "End" button to dismiss.

---

## CometChatUIKit init for SwiftUI

Init in `App.init()`:

```swift
@main
struct YourApp: App {
  init() {
    let settings = UIKitSettings()
      .set(appID: Secrets.cometchatAppID)
      .set(region: Secrets.cometchatRegion)
      .set(authKey: Secrets.cometchatAuthKey)
      .subscribePresenceForAllUsers()
      .build()

    CometChatUIKit.init(uiKitSettings: settings) { result in
      switch result {
      case .success: print("Init OK")
      case .onError(let error): print("Init failed: \(error)")
      }
    }
  }

  var body: some Scene { /* ... */ }
}
```

Reference `cometchat-ios-core` for the full init pattern with login.

---

## Things that don't work cleanly in SwiftUI

- **Custom theming via Storyboard inspection** — UIKit-only. SwiftUI projects override theme via `CometChatTheme` API in code (see `cometchat-ios-theming`).
- **NavigationLink to a `CometChat*` VC without representable wrapper** — must wrap.
- **Sharing UIKit and SwiftUI navigation stacks** — possible but messy. Pick one for any single feature.
- **Presenting `CometChatIncomingCall` from a SwiftUI sheet** — sheets dismiss on swipe; calls shouldn't. Use `fullScreenCover` or a manually-rendered ZStack overlay.
