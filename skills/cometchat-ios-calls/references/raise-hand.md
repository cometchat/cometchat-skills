# Raise hand on iOS

Native CometChatCallsSDK exposes the same conceptual API as the JS SDK — `raiseHand()` / `lowerHand()` plus delegate callbacks. The wow piece is wiring it into UIKit / SwiftUI cleanly + the system-level UX (CallKit doesn't show raised-hand state on the lock screen, so the in-app surface is the canonical place).

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/raise-hand
**Read first:** `cometchat-react-calls/references/raise-hand.md` — UX shape + anti-patterns are identical; this reference is the iOS-specific Swift wiring.

---

## SDK API

```swift
import CometChatCallsSDK

// Local user
CometChatCalls.raiseHand()
CometChatCalls.lowerHand()

// Listener — set via the call event listener attached at session start
class CallListener: NSObject, CometChatCallsEventsListener {
  func onParticipantHandRaised(_ participant: Participant) {
    // participant.uid, participant.name
  }
  func onParticipantHandLowered(_ participant: Participant) {
    // ...
  }
}

// Settings flag
let settings = CallSettingsBuilder()
  .setSessionType(.video)
  .hideRaiseHandButton(true)
  .build()
```

---

## SwiftUI integration — observable state holder

```swift
import SwiftUI
import Combine
import CometChatCallsSDK

struct RaisedParticipant: Identifiable {
  let id: String         // uid
  let name: String
  let raisedAt: Date
}

final class RaiseHandState: ObservableObject {
  @Published var localRaised: Bool = false
  @Published var raised: [RaisedParticipant] = []

  func toggle() {
    if localRaised {
      CometChatCalls.lowerHand()
    } else {
      CometChatCalls.raiseHand()
    }
    localRaised.toggle()
  }

  func handle(participantRaised p: Participant) {
    DispatchQueue.main.async {
      let entry = RaisedParticipant(id: p.uid, name: p.name, raisedAt: Date())
      self.raised.removeAll { $0.id == p.uid }
      self.raised.append(entry)
      self.raised.sort { $0.raisedAt < $1.raisedAt }
    }
  }

  func handle(participantLowered p: Participant) {
    DispatchQueue.main.async {
      self.raised.removeAll { $0.id == p.uid }
    }
  }
}
```

`DispatchQueue.main.async` wraps SDK callbacks — same rule as elsewhere in iOS calls integrations (cf. `references/group-calls.md`). Without it, `@Published` updates from a background queue cause UI thread warnings + skipped re-renders.

---

## Toggle button (SwiftUI)

```swift
struct RaiseHandButton: View {
  @ObservedObject var state: RaiseHandState

  var body: some View {
    Button(action: state.toggle) {
      Label(state.localRaised ? "Lower" : "Raise hand",
            systemImage: state.localRaised ? "hand.raised.fill" : "hand.raised")
    }
    .buttonStyle(.bordered)
    .tint(state.localRaised ? .yellow : .white)
    .accessibilityLabel(state.localRaised ? "Lower hand" : "Raise hand")
    .accessibilityAddTraits(state.localRaised ? .isSelected : [])
    .onChange(of: state.localRaised) { newValue in
      UIAccessibility.post(notification: .announcement, argument:
        newValue ? "Hand raised" : "Hand lowered")
    }
  }
}
```

`UIAccessibility.post(.announcement, ...)` is the iOS equivalent of web's `aria-live` and RN's `AccessibilityInfo.announceForAccessibility`. VoiceOver picks it up.

---

## Raised-hands sheet (SwiftUI)

```swift
struct RaisedHandsSheet: View {
  @ObservedObject var state: RaiseHandState

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Raised hands (\(state.raised.count))")
        .font(.headline)
      if state.raised.isEmpty {
        Text("No hands raised").foregroundColor(.secondary)
      } else {
        ForEach(state.raised) { p in
          HStack {
            Text("✋").font(.title2)
            Text(p.name).font(.body)
            Spacer()
            Text(secondsAgo(p.raisedAt))
              .font(.caption)
              .foregroundColor(.secondary)
          }
          .padding(.vertical, 4)
        }
      }
    }
    .padding()
    .presentationDetents([.fraction(0.3), .medium])
  }

  func secondsAgo(_ t: Date) -> String {
    "\(Int(Date().timeIntervalSince(t)))s ago"
  }
}
```

`.presentationDetents([.fraction(0.3), .medium])` is iOS 16+ — gives the user two snap heights, matching the BottomSheet pattern from RN.

---

## UIKit pattern

For UIKit projects (the kit's default surface):

```swift
class CallViewController: UIViewController {
  private let state = RaiseHandState()

  override func viewDidLoad() {
    super.viewDidLoad()
    // ... attach state to call event listener at session start
  }

  @objc private func raiseHandTapped() {
    state.toggle()
    // Update the UIBarButtonItem appearance
    raiseHandButton.image = UIImage(systemName: state.localRaised ? "hand.raised.fill" : "hand.raised")
    raiseHandButton.tintColor = state.localRaised ? .systemYellow : .label
  }

  func presentRaisedHandsSheet() {
    let host = UIHostingController(rootView: RaisedHandsSheet(state: state))
    if #available(iOS 15.0, *) {
      host.sheetPresentationController?.detents = [.medium(), .large()]
    }
    present(host, animated: true)
  }
}
```

`UIHostingController(rootView:)` lets you embed a SwiftUI sheet in a UIKit nav stack. `sheetPresentationController.detents` is the iOS 15+ pull-up sheet API.

---

## Toast announcement for the host

iOS has no native toast — use `UNUserNotificationCenter` for an in-call banner-style notification, OR a custom view:

```swift
extension RaiseHandState {
  func showRaisedNotification(for p: Participant) {
    let banner = UIView()
    banner.backgroundColor = .systemYellow.withAlphaComponent(0.95)
    let label = UILabel()
    label.text = "✋ \(p.name) raised their hand"
    label.textColor = .black
    label.font = .systemFont(ofSize: 14, weight: .medium)
    // ...add to view, animate down from top, dismiss after 4s
  }
}
```

Or use a third-party lib like `NotificationBannerSwift`. Custom is fine; just don't use `UNUserNotificationCenter` (which is system-level and feels out of place for in-call signals).

---

## Anti-patterns

Web sister reference rules apply, plus iOS-specific:

1. **`@Published` updates from non-main queue.** SwiftUI warns "publishing changes from background threads is not allowed." Always wrap SDK callbacks in `DispatchQueue.main.async`.
2. **Forgetting `accessibilityAddTraits(.isSelected)` on the toggle button.** VoiceOver doesn't announce "selected" state without it.
3. **Using `UNUserNotificationCenter`** for in-call raise-hand alerts. System-level; feels wrong. Use a custom banner.
4. **`removeAll { $0.id == p.uid }` then `append` without sort.** When a participant raises again after lowering, position in queue should reset to "now"; current code already does the right thing, but easy to break by reordering operations.

---

## Verification checklist

- [ ] `RaiseHandState` is an `ObservableObject`
- [ ] All SDK callbacks wrap in `DispatchQueue.main.async`
- [ ] Toggle button has `accessibilityLabel` + `accessibilityAddTraits(.isSelected)` when raised
- [ ] `UIAccessibility.post(.announcement, ...)` on toggle
- [ ] Raised-hands list sorted by `raisedAt` ascending
- [ ] `hideRaiseHandButton: true` in CallSettings if custom UI
- [ ] Real-device smoke: 3 iPhones in same call, host sees both raised
- [ ] VoiceOver smoke: enable VoiceOver, raise hand, hear "Hand raised" announcement

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — sister reference (UX shape)
- `cometchat-ios-calls` SKILL.md — the seven hard rules
- `references/group-calls.md` — group call iOS architecture
- `references/swiftui-uikit-hosting.md` — embedding SwiftUI sheets in UIKit
- `cometchat-a11y` — UIAccessibility patterns
- Canonical docs: https://www.cometchat.com/docs/calls/ios/raise-hand
