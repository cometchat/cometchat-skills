# CallKit + PushKit on iOS — the canonical implementation

iOS is the only platform where the OS owns the incoming-call UI. CallKit + PushKit isn't optional for production — without them, calls don't ring on locked devices and Apple rejects production builds. This reference is the full implementation; the SKILL.md sketches it, here is the code.

---

## Why two frameworks

| Framework | Role |
|---|---|
| **PushKit** | Receives high-priority VoIP push payloads, even when the app is terminated. Separate from APNs. |
| **CallKit** | Presents the system incoming-call UI (lock-screen, even on locked device), reports call state to the OS, integrates with Phone app's "Recents" list. |

Combined: a VoIP push wakes the app via PushKit; the app immediately reports the call to CallKit; CallKit takes over and shows the system UI.

---

## Apple Developer setup (one-time, manual)

The skill cannot automate these:

1. **Create a VoIP Services certificate** in Apple Developer portal → Certificates → "+" → VoIP Services.
2. **Pin to the bundle ID** of your app.
3. **Download the .p12** and convert to .pem if your push server needs it (`openssl pkcs12 -in cert.p12 -out cert.pem -nodes`).
4. **Upload to your push server.** This is a SEPARATE certificate from your standard APNs cert.

The skill prints these steps and waits for the user to confirm before proceeding.

---

## Xcode setup

In the target's "Signing & Capabilities":

1. Click "+" → "Push Notifications" → adds the entitlement.
2. Click "+" → "Background Modes" → check:
   - ☑ Audio, AirPlay, and Picture in Picture
   - ☑ Voice over IP
   - ☑ Remote notifications

Verify the resulting `Info.plist` has:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
  <string>remote-notification</string>
</array>
<key>NSMicrophoneUsageDescription</key>
<string>So you can talk during voice and video calls.</string>
<key>NSCameraUsageDescription</key>
<string>So you can be seen during video calls.</string>
```

---

## App entry — register PushKit + CallKit

### SwiftUI (`@main App`)

```swift
import SwiftUI
import PushKit
import CallKit
import CometChatSDK
import CometChatCallsSDK

@main
struct YourApp: App {
  @StateObject private var callManager = CallManager.shared

  var body: some Scene {
    WindowGroup {
      ContentView()
        .onAppear {
          CometChat.init(appId: Secrets.cometchatAppID, appSettings: appSettings) { isInitialized, error in
            guard error == nil else { return }
            CometChatCalls.init(callsAppSettings: callAppSettings) { _ in
              callManager.registerForPushKit()                     // wait for SDK ready
            }
          }
        }
    }
  }
}
```

### UIKit (`AppDelegate`)

```swift
import UIKit
import PushKit
import CallKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ app: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    CometChat.init(appId: Secrets.cometchatAppID, appSettings: appSettings) { _, error in
      guard error == nil else { return }
      CometChatCalls.init(callsAppSettings: callAppSettings) { _ in
        CallManager.shared.registerForPushKit()
      }
    }
    return true
  }
}
```

---

## CallManager — the shared state holder

```swift
import PushKit
import CallKit
import CometChatCallsSDK

class CallManager: NSObject, ObservableObject {
  static let shared = CallManager()

  private let pushRegistry = PKPushRegistry(queue: .main)
  private let provider: CXProvider
  private let callController = CXCallController()

  private override init() {
    let config = CXProviderConfiguration(localizedName: "YourApp")
    config.supportsVideo = true
    config.maximumCallGroups = 1
    config.maximumCallsPerCallGroup = 1
    config.supportedHandleTypes = [.generic]
    config.iconTemplateImageData = UIImage(named: "CallKitIcon")?.pngData()
    config.ringtoneSound = "ringtone.caf"

    self.provider = CXProvider(configuration: config)
    super.init()
    provider.setDelegate(self, queue: .main)
  }

  func registerForPushKit() {
    pushRegistry.delegate = self
    pushRegistry.desiredPushTypes = [.voIP]
  }

  func reportIncomingCall(uuid: UUID, callerName: String, callerUid: String, hasVideo: Bool) {
    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: callerUid)
    update.localizedCallerName = callerName
    update.hasVideo = hasVideo

    provider.reportNewIncomingCall(with: uuid, update: update) { error in
      if let error = error {
        print("Failed to report incoming call: \(error)")
      }
    }
  }
}
```

---

## PushKit delegate — the 5-second rule

```swift
extension CallManager: PKPushRegistryDelegate {
  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    guard type == .voIP else { return }
    let token = credentials.token.map { String(format: "%02x", $0) }.joined()
    // Send this token to your server, keyed by the logged-in CometChat UID
    Task {
      await sendVoipTokenToServer(token: token, uid: CometChat.getLoggedInUser()?.uid ?? "")
    }
  }

  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    guard type == .voIP else { completion(); return }

    // CRITICAL: report to CallKit IMMEDIATELY. iOS terminates apps that delay this >~5s.
    let data = payload.dictionaryPayload["data"] as? [String: Any] ?? [:]
    let sessionId = data["sessionId"] as? String ?? UUID().uuidString
    let callerName = data["callerName"] as? String ?? "Unknown"
    let callerUid = data["callerUid"] as? String ?? ""
    let hasVideo = (data["callType"] as? String) == "video"

    let uuid = UUID(uuidString: sessionId) ?? UUID()
    reportIncomingCall(uuid: uuid, callerName: callerName, callerUid: callerUid, hasVideo: hasVideo)

    // Store sessionId for later when CXAnswerCallAction fires
    self.pendingSessionIds[uuid] = sessionId

    completion()                     // ← tell iOS we're done
  }

  // iOS may invalidate the token (OS upgrade, app reinstall)
  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    // Token will re-register; wait for didUpdate
  }
}
```

**The 5-second rule:** Apple's `PKPushRegistry` documentation says you must call `reportNewIncomingCall` "promptly." Practical limit: ~5 seconds. If you exceed it, iOS terminates your app process and won't deliver future VoIP pushes for ~24 hours (apologies, no public retry mechanism).

---

## CallKit delegate — answer + end actions

```swift
extension CallManager: CXProviderDelegate {
  func providerDidReset(_ provider: CXProvider) {
    // OS reset everything — clean up local state
    pendingSessionIds.removeAll()
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    // User tapped "Answer" on the lock screen
    guard let sessionId = pendingSessionIds[action.callUUID] else {
      action.fail()
      return
    }

    Task {
      do {
        // Accept via Chat SDK
        try await CometChat.acceptCall(sessionID: sessionId)

        // Configure AVAudioSession for voice/video call audio
        try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .voiceChat)
        try AVAudioSession.sharedInstance().setActive(true)

        // Build session settings via CallSettingsBuilder. The CallsEventsDelegate
        // is wired with setDelegate(_:); there is no SessionSettings(Builder).
        let settings = CallSettingsBuilder()
          .setIsAudioOnly(false)
          .setStartVideoMuted(false)
          .setStartAudioMuted(false)
          .setDelegate(callListener)        // callListener conforms to CallsEventsDelegate
          .build()

        // Two-step: generateToken THEN startSession. There is no joinSession.
        // `view` is the UIView the ongoing-call UI will be drawn into.
        CometChatCalls.generateToken(authToken: CometChat.getUserAuthToken(), sessionID: sessionId) { token in
          guard let token = token else {
            print("generateToken returned nil")
            action.fail()
            return
          }
          CometChatCalls.startSession(
            callToken: token,
            callSetting: settings,
            view: callContainerView   // a UIView with measurable bounds
          ) { _ in
            action.fulfill()                // tell CallKit we answered successfully
          } onError: { error in
            print("startSession failed: \(error?.errorDescription ?? "unknown")")
            action.fail()
          }
        } onError: { error in
          print("generateToken failed: \(error?.errorDescription ?? "unknown")")
          action.fail()
        }

        // Navigate the app's UI to the ongoing-call screen
        await MainActor.run {
          // ...your nav logic — push the view that hosts callContainerView...
        }
      } catch {
        action.fail()
      }
    }
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    // User tapped "End" or call ended remotely.
    CometChatCalls.endSession()   // EXISTS on the static facade in v5

    // CRITICAL: deactivate audio session (rule 1.5)
    do {
      try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    } catch {
      // log but don't block
    }

    pendingSessionIds.removeValue(forKey: action.callUUID)
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    CometChatCalls.audioMuted(action.isMuted)   // NOT muteAudio
    action.fulfill()
  }
}
```

---

## Outgoing calls — also through CallKit

For caller-initiated calls, report via `CXStartCallAction` so the call appears in the iOS Phone app's Recents:

```swift
extension CallManager {
  func startOutgoingCall(receiverUid: String, callType: CallType) {
    let uuid = UUID()
    let handle = CXHandle(type: .generic, value: receiverUid)
    let action = CXStartCallAction(call: uuid, handle: handle)
    action.isVideo = (callType == .video)

    let transaction = CXTransaction(action: action)
    callController.request(transaction) { error in
      if let error = error {
        print("Failed to start outgoing call: \(error)")
      }
    }
  }
}

extension CallManager {
  // CXProviderDelegate
  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    Task {
      do {
        let outgoing = Call(receiverId: action.handle.value,
                           callType: action.isVideo ? .video : .audio,   // CallType has no .voice
                           receiverType: .user)
        let initiated = try await CometChat.initiateCall(call: outgoing)
        pendingSessionIds[action.callUUID] = initiated.sessionID
        provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: nil)
        action.fulfill()
      } catch {
        action.fail()
      }
    }
  }
}
```

This gives the user a "Calling..." UI in the iOS system. When the receiver accepts, `provider.reportOutgoingCall(connectedAt:)` switches the UI to "Connected."

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| App terminates 5s after PushKit delivery | Async work before `reportNewIncomingCall` | Report first, then do anything else |
| "VoIP services not available" at registry setup | Background Modes capability missing | Add VoIP capability in Xcode and rebuild |
| Token never registers | App not signed with VoIP-capable provisioning profile | Re-download provisioning profile |
| Call rings but answering does nothing | `CXAnswerCallAction` delegate doesn't fail/fulfill | Always call `action.fulfill()` or `action.fail()` |
| Music doesn't resume after hangup | Missing `setActive(false, .notifyOthersOnDeactivation)` | Add to `CXEndCallAction` handler |
| Lock-screen rings but unlocking shows wrong screen | App didn't navigate to ongoing-call view in `CXAnswerCallAction` | Navigate inside the action handler |
| Outgoing call never shows "Calling..." UI | Started via `initiateCall` directly without `CXStartCallAction` | Use `CXTransaction` flow |

---

## Testing without a push server

Same workaround as RN — call `CallManager.shared.reportIncomingCall(...)` from a debug button. Bypasses PushKit entirely. Useful for testing the in-app + CallKit-UI flow but doesn't exercise the lock-screen ring (which requires PushKit delivery to an unlocked or terminated app).
