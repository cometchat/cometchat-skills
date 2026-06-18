# Call session — no ringing (iOS)

Server-generated sessionId, both parties enter it. Customer-validated against `calls-sdk-ios-5/sample-apps/cometchat-calls-sample-app-ios/CometChatCallsSample/CallView.swift`.

**Read first:** `cometchat-react-calls/references/call-session.md` — cross-platform architecture (sessionId strategies, server-side authorization). Then come back here for the iOS shape.

**Known issue:** iOS V5 native (`CometChatCallsSDK`) is currently blocked upstream by a Cloudsmith 404 on the WebRTC binary. See `docs/known-issues-v4.2.0.md`. This file describes the correct shape for when the binary becomes available; the canonical pattern itself is sound.

---

## Hard rules (iOS-specific overrides on top of the cross-platform rules)

1. **Two-step session start: `generateToken` then `startSession`.** `CometChatCalls.generateToken(authToken:sessionID:onSuccess:onError:)` returns a call token; pass it to `CometChatCalls.startSession(callToken:callSetting:view:onSuccess:onError:)`. There is NO `joinSession` convenience method on the iOS Calls SDK v5.
2. **`CallSettingsBuilder()` is the canonical settings shape** (chained `.setIsAudioOnly(false).setStartVideoMuted(false).setStartAudioMuted(false).setDelegate(coordinator).build()`). There is NO `SessionSettings` or `SessionSettingsBuilder` type.
3. **`CallsEventsDelegate` protocol on a Coordinator object**, set via `CallSettingsBuilder.setDelegate(_:)` or registered with `CometChatCalls.addCallEventListener(observerId:delegate:)`. There is NO `SessionStatusListener`, NO `ButtonClickListener`, NO `CometChatCallsEventsListener`, and NO `addEventListener(.sessionLeft)`.
4. **`onCallEnded` and `onCallEndButtonPressed` trigger UI dismiss.** These are the real termination callbacks; ignoring either leaves the call view stranded. `CallsEventsDelegate` ALSO has an optional `onSessionTimeout()` callback (swiftinterface:30) that fires when the idle timeout set via `CallSettingsBuilder.setIdleTimeoutPeriod(_:)` elapses — handle it for dismiss/cleanup too. See `references/idle-timeout.md`.
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
        let settings = CallSettingsBuilder()
            .setIsAudioOnly(false)
            .setStartVideoMuted(false)
            .setStartAudioMuted(false)
            .setDelegate(coordinator)        // CallsEventsDelegate — set here, on the builder
            .build()

        // Two-step: generateToken THEN startSession. There is no joinSession convenience.
        // authToken is nil for session-only apps (Calls SDK derives it server-side from the
        // session); pass CometChat.getUserAuthToken() in additive (chat + calls) integrations.
        CometChatCalls.generateToken(authToken: nil, sessionID: sessionID) { token in
            guard let token = token else {
                DispatchQueue.main.async { onError("Failed to generate call token") }
                return
            }
            CometChatCalls.startSession(
                callToken: token,
                callSetting: settings,
                view: container
            ) { _ in
                // session started — delegate already wired via setDelegate
            } onError: { error in
                DispatchQueue.main.async {
                    onError(error?.errorDescription ?? "Failed to start call")
                }
            }
        } onError: { error in
            DispatchQueue.main.async {
                onError(error?.errorDescription ?? "Failed to generate call token")
            }
        }
    }

    class Coordinator: NSObject, CallsEventsDelegate {
        let onEnd: () -> Void

        init(onEnd: @escaping () -> Void) {
            self.onEnd = onEnd
        }

        // --- CallsEventsDelegate (all @objc optional) ---
        func onCallEnded() {
            DispatchQueue.main.async { self.onEnd() }
        }

        func onCallEndButtonPressed() {
            CometChatCalls.endSession()           // EXISTS on the static facade
            DispatchQueue.main.async { self.onEnd() }
        }
    }
}
```

**Why this shape:**

- **`UIViewRepresentable` bridging a `UIView` container**, not a raw SwiftUI view — the SDK draws into a `UIView` it owns and lays out internally. SwiftUI can't host that directly.
- **`generateToken` then `startSession`** — the iOS Calls SDK v5 has no single-call `joinSession`. Generate the call token, then start the session into the container `UIView`.
- **`CallSettingsBuilder().build()`** — chained builder ending in `.build()` returning `CallSettings`. There is no `SessionSettings`/`SessionSettingsBuilder` type.
- **`Coordinator` implements `CallsEventsDelegate`** — wired via `setDelegate(_:)` on the builder. There is no `SessionStatusListener`/`ButtonClickListener`; do not register against `CallSession.shared` (it doesn't exist).

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

1. **Looking for a single-call `joinSession(sessionID:)` convenience.** It does not exist on iOS v5. Always do `generateToken` → `startSession`.
2. **`SessionSettings` / `SessionSettingsBuilder`.** Neither type exists. Use `CallSettingsBuilder()...build()`.
3. **`CometChatCalls.addEventListener(.sessionLeft)` or `SessionStatusListener`/`ButtonClickListener`.** None exist. iOS uses the `CallsEventsDelegate` protocol set via `setDelegate(_:)` or `addCallEventListener(observerId:delegate:)`.
4. **Skipping the `onCallEnded` callback.** The call ends via this (remote hangup, server end) → call view stays mounted forever. (For idle-timeout termination, also handle `onSessionTimeout()` — swiftinterface:30.)
5. **Starting the session from `viewDidAppear`.** Re-runs on every navigation push. Use `viewDidLoad` + a `started` flag, OR use `UIViewRepresentable` + Coordinator (the pattern above).
6. **`AVAudioSession.setCategory(.playback)`.** Mic input doesn't capture. Use `.playAndRecord` + `.voiceChat` mode.
7. **`async/await` on `startSession`/`generateToken`.** They use completion handlers — `try await` does nothing.
8. **Initializing Chat SDK for a session-only integration.** Wastes time and adds two extra failure modes. Drop `CometChat.init` / `CometChat.login` entirely for standalone session apps.

---

## Verification checklist

- [ ] `generateToken(authToken:sessionID:)` → `startSession(callToken:callSetting:view:)` two-step (no `joinSession`)
- [ ] Settings built via `CallSettingsBuilder()`, not `SessionSettings`/`SessionSettingsBuilder`
- [ ] `CallsEventsDelegate` protocol implemented on a Coordinator class
- [ ] Coordinator wired via `CallSettingsBuilder.setDelegate(_:)` (or `addCallEventListener(observerId:delegate:)`)
- [ ] `onCallEnded` and `onCallEndButtonPressed` both trigger dismiss
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
- Upstream iOS sample — `calls-sdk-ios-5/sample-apps/cometchat-calls-sample-app-ios/CometChatCallsSample/CallView.swift`
- Canonical docs: https://www.cometchat.com/docs/calls/ios/join-session
