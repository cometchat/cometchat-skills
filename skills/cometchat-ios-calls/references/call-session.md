# Call session — joinSession with no ringing (iOS)

Server-generated sessionId, both parties enter it. Customer-validated against `~/Downloads/calls-sdk/calls-sdk-ios-5/sample-apps/cometchat-calls-sample-app-ios/CometChatCallsSample/CallView.swift`.

**Read first:** `cometchat-react-calls/references/call-session.md` — cross-platform architecture (sessionId strategies, server-side authorization). Then come back here for the iOS shape.

**Known issue:** iOS V5 native (`CometChatCallsSDK`) is currently blocked upstream by a Cloudsmith 404 on the WebRTC binary. See `docs/known-issues-v4.2.0.md`. This file describes the correct shape for when the binary becomes available; the canonical pattern itself is sound.

---

## Hard rules (iOS-specific overrides on top of the cross-platform rules)

1. **Use the `joinSession(sessionID:callSetting:container:onSuccess:onError:)` convenience method.** It handles token generation internally — you do NOT need to call `generateToken` separately. Matches the upstream sample exactly.
2. **`SessionSettingsBuilder()` is the canonical settings shape** (chained `.setTitle().startVideoPaused(false).startAudioMuted(false).build()`). NOT `SessionSettings(sessionType:layout:)` — that initializer is the chat-side type.
3. **`SessionStatusListener` protocol on a Coordinator object**, registered against `CometChatCallsSDK.CallSession.shared.addSessionStatusListener(...)`. NOT raw `CometChatCalls.addEventListener(.sessionLeft)` — that does not exist on iOS.
4. **`onSessionLeft`, `onConnectionClosed`, `onSessionTimedOut` all trigger UI dismiss.** All three are real termination paths; ignoring any of them leaves the call view stranded.
5. **For standalone session-only integrations, the Chat SDK is OPTIONAL.** The upstream iOS sample never imports `CometChatSDK` (the chat SDK). Keep `CometChat.init` / `CometChat.login` only for additive (chat + calls) integrations.
6. **`AVAudioSession` activated with `.playAndRecord` + `.voiceChat`** — `.playback` mode captures NO mic input.

---

## SwiftUI + UIViewRepresentable (canonical shape)

```swift
import SwiftUI
import CometChatCallsSDK

struct CallView: View {
    let sessionID: String
    @Environment(\.dismiss) private var dismiss
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            CallContainerView(
                sessionID: sessionID,
                onEnd: { dismiss() },
                onError: { msg in errorMessage = msg }
            )
        }
        .alert("Call Error", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil; dismiss() } }
        )) {
            Button("OK") { errorMessage = nil; dismiss() }
        } message: {
            Text(errorMessage ?? "")
        }
    }
}

// MARK: - UIKit container bridging the Calls SDK

struct CallContainerView: UIViewRepresentable {
    let sessionID: String
    let onEnd: () -> Void
    let onError: (String) -> Void

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .black
        startSession(container: container, coordinator: context.coordinator)
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onEnd: onEnd)
    }

    private func startSession(container: UIView, coordinator: Coordinator) {
        let settings = SessionSettingsBuilder()
            .setTitle("CometChat Meeting")
            .startVideoPaused(false)
            .startAudioMuted(false)
            .build()

        // The convenience joinSession(sessionID:) generates the token internally.
        // No separate generateToken call needed.
        CometChatCalls.joinSession(
            sessionID: sessionID,
            callSetting: settings,
            container: container
        ) { success in
            let session = CometChatCallsSDK.CallSession.shared
            session.addSessionStatusListener(coordinator)
            session.addButtonClickListener(coordinator)
        } onError: { error in
            DispatchQueue.main.async {
                onError(error?.errorDescription ?? "Failed to join call")
            }
        }
    }

    class Coordinator: NSObject, SessionStatusListener, ButtonClickListener {
        let onEnd: () -> Void

        init(onEnd: @escaping () -> Void) {
            self.onEnd = onEnd
        }

        // --- SessionStatusListener ---
        func onSessionJoined() {}

        func onSessionLeft() {
            DispatchQueue.main.async { self.onEnd() }
        }

        func onConnectionClosed() {
            DispatchQueue.main.async { self.onEnd() }
        }

        func onSessionTimedOut() {
            DispatchQueue.main.async { self.onEnd() }
        }

        func onConnectionLost() {}
        func onConnectionRestored() {}

        // --- ButtonClickListener ---
        func onLeaveSessionButtonClicked() {
            CometChatCallsSDK.CallSession.shared.leaveSession()
        }
    }
}
```

**Why this shape:**

- **`UIViewRepresentable` bridging a `UIView` container**, not a raw SwiftUI view — the SDK draws into a `UIView` it owns and lays out internally. SwiftUI can't host that directly.
- **`joinSession(sessionID:callSetting:container:)` convenience** — generates the call token internally. No need for `CometChatCalls.generateToken(forSession:)` then `joinSession(callToken:)` two-step. The sample uses this and so should every customer.
- **`SessionSettingsBuilder().build()`** — chained builder ending in `.build()`. The non-builder `SessionSettings(sessionType:layout:)` is the chat-side type and rejects at runtime.
- **`Coordinator` implements `SessionStatusListener` AND `ButtonClickListener`** — register both against `CallSession.shared` AFTER `onSuccess` fires. Don't register against `CometChatCalls` — that's not where the events live.

---

## Required iOS configuration

`Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Camera is needed for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone is needed for calls</string>
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
    <string>voip</string>
</array>
```

`AVAudioSession` setup (call once at app launch):
```swift
import AVFoundation

let session = AVAudioSession.sharedInstance()
try? session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
try? session.setActive(true)
```

See `references/avaudiosession-routing.md` for full audio routing including AirPods / CarPlay handoff.

---

## Universal Link routing

`SceneDelegate.scene(_:continue:)`:
```swift
func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL,
          url.pathComponents.count >= 3,
          url.pathComponents[1] == "meet" else { return }
    let sessionID = url.pathComponents[2]
    router.routeToCallView(sessionID: sessionID)
}
```

Configure `applinks:yourapp.com` per `references/share-invite.md`.

---

## Anti-patterns

1. **Calling `CometChatCalls.generateToken(forSession:)` then `joinSession(callToken:)`.** Two-step doesn't match the sample — the sample uses the single-call `joinSession(sessionID:)` convenience. Prior versions of this skill cited the two-step; it works but is not the canonical iOS shape.
2. **`SessionSettings(sessionType:layout:)` initializer.** Wrong type — that's the chat-side entity. Use `SessionSettingsBuilder()...build()`.
3. **`CometChatCalls.addEventListener(.sessionLeft)`** — iOS uses the protocol-based `SessionStatusListener`, not a string-keyed listener API.
4. **Skipping `onConnectionClosed` and `onSessionTimedOut` callbacks.** User's call ends via either of these (network drop, server timeout) → call view stays mounted forever.
5. **Calling `joinSession` from `viewDidAppear`.** Re-runs on every navigation push. Use `viewDidLoad` + a `joined` flag, OR use `UIViewRepresentable` + Coordinator (the sample's pattern).
6. **`AVAudioSession.setCategory(.playback)`.** Mic input doesn't capture. Use `.playAndRecord` + `.voiceChat` mode.
7. **`async/await` on `joinSession`.** It returns void with completion handlers — `try await` does nothing.
8. **Initializing Chat SDK for a session-only integration.** Wastes time and adds two extra failure modes. Drop `CometChat.init` / `CometChat.login` entirely for standalone session apps.

---

## Verification checklist

- [ ] `joinSession(sessionID:callSetting:container:)` used (single-call), NOT `generateToken` + `joinSession(callToken:)` two-step
- [ ] Settings built via `SessionSettingsBuilder()`, not `SessionSettings(sessionType:layout:)`
- [ ] `SessionStatusListener` protocol implemented on a Coordinator class
- [ ] Coordinator registered via `CallSession.shared.addSessionStatusListener(...)` AFTER `onSuccess`
- [ ] `onSessionLeft`, `onConnectionClosed`, `onSessionTimedOut` ALL trigger dismiss
- [ ] `Info.plist` has `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `UIBackgroundModes: audio, voip`
- [ ] `AVAudioSession.setCategory(.playAndRecord, mode: .voiceChat, ...)`
- [ ] Universal Link routing wired in SceneDelegate
- [ ] **Standalone session-only:** no `CometChatSDK` (chat SDK) import — Calls SDK alone
- [ ] **Additive (chat + calls):** dual-SDK contract preserved
- [ ] Real-device smoke: tap meeting link in Messages → app opens at `/meet/:sessionID` → joins

---

## Pointers

- `cometchat-react-calls/references/call-session.md` — cross-platform architecture
- `cometchat-ios-calls/SKILL.md` — iOS seven hard rules
- `cometchat-ios-calls/references/share-invite.md` — Universal Link config
- `cometchat-ios-calls/references/avaudiosession-routing.md` — audio session routing
- Upstream iOS sample — `~/Downloads/calls-sdk/calls-sdk-ios-5/sample-apps/cometchat-calls-sample-app-ios/CometChatCallsSample/CallView.swift`
- Canonical docs: https://www.cometchat.com/docs/calls/ios/join-session
