# Group calls (meetings) on iOS

iOS group calls combine the `CometChatCallsSDK` group APIs with iOS-platform patterns: `UICollectionView` for scalable rosters, KVO/Combine for active-speaker observation, CallKit for OS-level multi-party reporting. For SDK-level semantics (capacity, bandwidth, moderator actions) read `cometchat-native-calls/references/group-calls.md` first — same SDK, identical contracts.

---

## Signaling architecture — meeting-message broadcast, NOT call ringing

**Critical to read first.** Group calls do NOT use the Ringing channel (`CometChat.initiateCall` → `onIncomingCallReceived`). That channel is **1:1 user calls only**. The kit broadcasts a **custom message of type `"meeting"`** to the group; receivers see a "Join meeting" card in their `CometChatMessageList` (kit) or need an explicit `MessageListener.onCustomMessageReceived` (custom UI).

This applies identically on iOS as on web/RN/Android/Flutter — the same Chat SDK semantic is in play. The kit's `CometChatUI` group surface auto-renders meeting cards; custom Swift/SwiftUI call surfaces need the explicit listener.

```swift
import CometChatSDK

let listener = MessageListener()
listener.onCustomMessageReceived = { customMessage in
    guard customMessage.category == .custom else { return }
    guard customMessage.type == "meeting" else { return }

    let customData = customMessage.customData as? [String: Any] ?? [:]
    let sessionID = (customData["sessionId"] as? String) ?? customMessage.receiverUid
    let callTypeRaw = (customData["callType"] as? String) ?? "video"
    let callType: CallType = callTypeRaw == "audio" ? .audio : .video
    let fromUid = customMessage.sender.uid
    let groupGuid = customMessage.receiverUid

    DispatchQueue.main.async {
        // Present your custom "incoming meeting" UI:
        // - banner / toast with "Join" CTA
        // - or full-screen incoming-meeting view controller
        // Tapping Join → navigate to OngoingCallViewController(sessionID:)
    }
}
CometChat.addMessageListener("APP_ROOT_GROUP_MEETING_LISTENER", listener)
```

| Channel | 1:1 user calls | Group calls |
|---|---|---|
| Signaling API (caller) | `CometChat.initiateCall(call:)` | `CometChat.sendCustomMessage(customMessage:)` with type="meeting" |
| Receiver event | `CallListener.onIncomingCallReceived` | `MessageListener.onCustomMessageReceived` (category=.custom + type="meeting") |
| Session ID | server-generated unique per call | group's GUID (persistent) |
| CallKit ring | yes — report via `CXProvider.reportNewIncomingCall` | no — meeting message lands in chat; manual CallKit interception only |
| Auto-cancel timeout | yes (45s default) | no — meeting persists in chat history |

### CallKit and group calls

Because group meeting events come through the message channel (not the call channel), CallKit does NOT auto-ring for incoming group meetings the way it does for 1:1 calls. If you want CallKit-style ringing for groups, you must:

1. Configure your push provider to deliver the meeting message as a VoIP push (PushKit), not a regular APNs push.
2. Intercept the VoIP push in `PKPushRegistryDelegate`, parse the meeting payload, and call `CXProvider.reportNewIncomingCall(...)` with a synthesized `CallKit` UUID and metadata.

The CometChat dashboard's PushKit provider doesn't auto-route meeting messages to VoIP push by default — you'd need a server-side webhook that re-routes meeting messages. Not built-in.

---

## Initiating a group call

```swift
import CometChatSDK

func initiateGroupCall(guid: String, isVideo: Bool) async throws -> Call {
  let group = try await fetchGroup(guid)
  let callType: CallType = isVideo ? .video : .audio   // CallType has no .voice
  let call = Call(receiverId: group.guid, callType: callType, receiverType: .group)

  return try await withCheckedThrowingContinuation { cont in
    CometChat.initiateCall(call: call,
      onSuccess: { initiated in cont.resume(returning: initiated) },
      onError: { error in cont.resume(throwing: error) })
  }
}
```

Receiver type is `.group` — anyone in the group can `acceptCall` until the call ends.

---

## Roster as `UICollectionView`

Multi-party rosters scale poorly with `UIStackView`. Use `UICollectionView` with a `UICollectionViewDiffableDataSource` for smooth roster updates:

```swift
import UIKit
import CometChatCallsSDK

final class ParticipantRosterController: NSObject, UICollectionViewDelegateFlowLayout {
  enum Section { case main }
  typealias DataSource = UICollectionViewDiffableDataSource<Section, Participant>
  typealias Snapshot = NSDiffableDataSourceSnapshot<Section, Participant>

  private let collectionView: UICollectionView
  private lazy var dataSource = makeDataSource()
  private var participants: [Participant] = []

  init(collectionView: UICollectionView) {
    self.collectionView = collectionView
    super.init()
    collectionView.delegate = self
  }

  func update(participants: [Participant]) {
    self.participants = participants
    var snapshot = Snapshot()
    snapshot.appendSections([.main])
    snapshot.appendItems(participants)
    dataSource.apply(snapshot, animatingDifferences: true)
  }

  private func makeDataSource() -> DataSource {
    let registration = UICollectionView.CellRegistration<ParticipantCell, Participant> { cell, _, p in
      cell.configure(with: p)
    }
    return DataSource(collectionView: collectionView) { cv, indexPath, p in
      cv.dequeueConfiguredReusableCell(using: registration, for: indexPath, item: p)
    }
  }
}
```

Diffable data source means roster updates animate cleanly without cell-recreation thrashing. Rule of thumb: 25-participant rosters render at 60fps on iPhone 12+.

---

## Participant-roster observation

> **The iOS Calls SDK v5 has NO active-speaker callback.** `CallsEventsDelegate` exposes no `onActiveSpeakerUpdated` (and no `onUserListUpdated`). If you want an active-speaker spotlight on iOS, the SDK won't drive it — use the SDK's built-in spotlight mode instead (set via `CallSettingsBuilder.setMode(.spotlight)` — the typed `DisplayModes` enum, swiftinterface:175/281), which the SDK lays out internally.

For a custom roster, observe the participant callbacks that DO exist — use the TYPED forms `onUserJoined(rtcUser:)`, `onUserLeft(rtcUser:)`, `onUserListChanged(rtcUsers:)` (swiftinterface:35,38,41). They deliver `RTCUser` objects (swiftinterface:139 — `uid`, `avatar`, `name`, `jwt`, `resource`), so read typed properties instead of parsing dictionaries. The `NSDictionary`/`NSArray` forms are DEPRECATED.

```swift
import CometChatCallsSDK

final class CallStateObserver: NSObject, ObservableObject, CallsEventsDelegate {
  @Published var participants: [RTCUser] = []

  // swiftinterface:41 onUserListChanged(rtcUsers: [RTCUser])
  func onUserListChanged(rtcUsers: [RTCUser]) {
    DispatchQueue.main.async {
      self.participants = rtcUsers
    }
  }
}
```

Wire it via `CallSettingsBuilder.setDelegate(self)` or `CometChatCalls.addCallEventListener(observerId:delegate:)`.

`@Published` works in both SwiftUI (via `@StateObject`) and UIKit (via Combine subscriptions). Pick one path; don't mix.

---

## SwiftUI spotlight layout

```swift
struct GroupCallView: View {
  @StateObject private var state = CallStateObserver()

  var body: some View {
    VStack(spacing: 8) {
      if let speaker = activeSpeaker {
        ParticipantTile(participant: speaker)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }

      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(others) { p in
            ParticipantTile(participant: p)
              .frame(width: 100, height: 130)
          }
        }
        .padding(.horizontal)
      }
      .frame(height: 140)
    }
  }

  private var activeSpeaker: Participant? {
    if let uid = state.activeSpeakerUid {
      return state.participants.first { $0.uid == uid }
    }
    return state.participants.first
  }

  private var others: [Participant] {
    let speaker = activeSpeaker
    return state.participants.filter { $0.uid != speaker?.uid && $0.uid != localUid }
  }

  private var localUid: String { CometChat.getLoggedInUser()?.uid ?? "" }
}
```

The `Identifiable` conformance on `Participant` (with `id = uid`) is what makes `ForEach` reuse cells across roster updates. Without it, every update destroys + recreates every tile — same bug as RN/Angular.

---

## Moderator actions — not in the Calls SDK

> **There are NO in-call moderator APIs on the iOS Calls SDK v5.** `CometChatCalls` has no `muteUser(uid:)` and no `removeUser(uid:)` (verified against the `CometChatCallsSDK` swiftinterface). Do not scaffold these — they won't compile.

If you need remote mute / kick semantics, route them through the **Chat SDK group APIs** (e.g. `CometChat.kickGroupMember` / `banGroupMember`) or the **REST API** for group membership, and treat "muted" as app-level state you broadcast over a custom/transient message and apply locally. The Calls SDK is not involved in moderation.

---

## Capacity error handling

`CallsEventsDelegate` has NO `onError` callback. Capacity / membership errors surface from the `onError` closures of `generateToken` and `startSession` as a `CometChatCallException` — handle them there:

```swift
final class GroupCallViewController: UIViewController {
  func handleStartError(_ error: CometChatCallException?) {
    DispatchQueue.main.async { [weak self] in
      switch error?.errorCode {
      case "ERR_CALL_FULL":
        self?.showAlert(title: "Call is full",
                        message: "This meeting has reached its participant limit.")
      case "ERR_NOT_GROUP_MEMBER":
        self?.showAlert(title: "Not a member",
                        message: "You're not a member of this group.")
      default:
        self?.showAlert(title: "Call error", message: error?.errorDescription ?? "Unknown error")
      }
    }
  }
  // Pass handleStartError to the onError of generateToken / startSession.

  private func showAlert(title: String, message: String) {
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "OK", style: .default))
    present(alert, animated: true)
  }
}
```

`DispatchQueue.main.async` wraps the UI update — listener fires on a background queue.

---

## CallKit and group calls

CallKit was designed for 1:1 — its `CXCallUpdate` model has a single `remoteHandle`. Group calls don't fit cleanly. Two practical patterns:

### A — Report group calls as a single "meeting" call

```swift
let update = CXCallUpdate()
update.remoteHandle = CXHandle(type: .generic, value: group.guid)
update.localizedCallerName = "Meeting: \(group.name)"
update.hasVideo = isVideo
update.supportsHolding = false
update.supportsGrouping = false       // CallKit "group" means call merging, not multi-party
update.supportsUngrouping = false
provider.reportNewIncomingCall(with: callUUID, update: update) { _ in }
```

The user sees "Incoming meeting call from <Group Name>" in CallKit's lock-screen UI. No participant detail — that's in your app's UI after they accept.

### B — Skip CallKit for group calls

Some apps treat group calls as a foreground-only experience and skip CallKit reporting entirely. Trade-off: no lock-screen ring → users miss meeting invitations. Only viable if your audience is reliably foregrounded (corporate apps with predictable usage).

The skill defaults to pattern A.

---

## Battery + low-power mode

iOS broadcasts `NSProcessInfoPowerStateDidChangeNotification` when the user enables Low Power Mode. Auto-downgrade video:

```swift
NotificationCenter.default.addObserver(
  self,
  selector: #selector(powerStateChanged),
  name: NSNotification.Name.NSProcessInfoPowerStateDidChange,
  object: nil)

@objc func powerStateChanged() {
  if ProcessInfo.processInfo.isLowPowerModeEnabled && callActive {
    CometChatCalls.videoPaused(true)   // NOT pauseVideo; synchronous
    DispatchQueue.main.async {
      self.showBanner("Video paused — Low Power Mode")
    }
  }
}
```

Same pattern for `UIDevice.current.batteryLevel` (`isBatteryMonitoringEnabled = true` first), but Low Power Mode is the more reliable signal.

---

## Joining an in-progress call

```swift
func checkActiveGroupCall(guid: String) async -> Call? {
  guard let active = try? await fetchActiveCall() else { return nil }
  guard active.receiverType == .group, active.receiverUid == guid else { return nil }
  return active
}
```

Render a "Join meeting" button on the group screen if there's an active call:

```swift
struct GroupDetailView: View {
  @State private var activeCall: Call?

  var body: some View {
    VStack {
      if let call = activeCall {
        Button("Join meeting") {
          Task { await join(call: call) }
        }
        .buttonStyle(.borderedProminent)
      }
      // ... rest of group detail
    }
    .task {
      activeCall = await checkActiveGroupCall(guid: group.guid)
    }
  }
}
```

---

## Anti-patterns

1. **Roster updates without `Identifiable` (or `IndexPath` reuse identifier)**. Cells thrash on every update; video tracks die with them.
2. **No active-speaker debounce.** Spotlight tile jitters at 5+ Hz.
3. **`UIAlertController` action sheet on iPad without `popoverPresentationController`.** Crash.
4. **Moderator buttons rendered without scope check.** Backend rejects but UI is misleading.
5. **No `DispatchQueue.main.async` wrapping** SDK callbacks. UI updates skipped.
6. **Skipping CallKit for group calls without a lock-screen ring fallback.** Missed meetings.
7. **CallKit `supportsGrouping = true`.** That's CallKit's call-merging feature; doesn't mean multi-party. Set to false.

---

## Verification checklist

- [ ] `Participant` conforms to `Identifiable` with `id = uid`
- [ ] `UICollectionViewDiffableDataSource` for UIKit OR `ForEach` with stable IDs for SwiftUI
- [ ] Active-speaker debounced ≥500ms via Timer or Combine `.debounce`
- [ ] All SDK callbacks dispatched to `DispatchQueue.main.async`
- [ ] Moderator buttons gated on `group.scope == "admin" || == "moderator"`
- [ ] iPad action sheets configure `popoverPresentationController`
- [ ] `ERR_CALL_FULL` and `ERR_NOT_GROUP_MEMBER` produce user-facing alerts
- [ ] Low Power Mode observer auto-pauses video
- [ ] CallKit pattern: meeting reported as `localizedCallerName: "Meeting: <Group Name>"` (or skipped intentionally)
- [ ] Active-call check on group screen entry; "Join meeting" button rendered when active

---

## Pointers

- `cometchat-native-calls/references/group-calls.md` — sister reference (SDK semantics, capacity, bandwidth scaling)
- `references/callkit-and-pushkit.md` — CallKit reporting pattern; group-call adaptation above
- `references/custom-ui.md` — UICollectionView roster integration with WebRTC views
- `cometchat-ios-calls` SKILL.md — base hard rules
