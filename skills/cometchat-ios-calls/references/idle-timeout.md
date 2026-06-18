# Idle timeout on iOS

The iOS Calls SDK v5 has a real idle-timeout API. Set it on the builder with `setIdleTimeoutPeriod(_ value: Int) -> Self` (swiftinterface:289), and react to the timeout via the optional `CallsEventsDelegate.onSessionTimeout()` callback (swiftinterface:30). The SDK runs the timer; you do NOT hand-roll a client-side `Timer`. (If you want an "are you still there?" prompt BEFORE the SDK ends the session, you can still drive a softer client-side warning off participant events — but the timeout itself is the SDK's job.)

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/idle-timeout
**Read first:** `cometchat-react-calls/references/idle-timeout.md` — settings + archetype timeouts + Pattern A custom timer.

---

## SDK idle timeout — `setIdleTimeoutPeriod` + `onSessionTimeout`

Set the timeout (in seconds) on the builder, then react to the SDK's `onSessionTimeout()` callback. When it fires, report the end to CallKit and the SDK has already torn the session down:

```swift
import CometChatCallsSDK

let settings = CallSettingsBuilder()
  .setIdleTimeoutPeriod(120)        // swiftinterface:289 setIdleTimeoutPeriod(_ value: Int) -> Self
  .setDelegate(callListener)
  .build()
// ... generateToken → startSession(callToken:callSetting:view:) ...

class CallListener: NSObject, CallsEventsDelegate {
  // swiftinterface:30 — optional CallsEventsDelegate.onSessionTimeout()
  func onSessionTimeout() {
    DispatchQueue.main.async {
      // Report end to CallKit (rule 1.5 — hangup cleanup); SDK already ended the session.
      CallManager.shared.endCall(reason: .remoteEnded)
    }
  }
}
```

The `CallManager.shared.endCall(reason:)` call is critical — see `references/callkit-and-pushkit.md`. CallKit's call card persists on the lock screen unless you report the end.

---

## CallKit interaction — endCall reason

When your client-side timer fires, you must report the call end to CallKit. The reason matters for system UI:

```swift
let endReason: CXCallEndedReason = .remoteEnded
// Other options:
//   .failed           — error / network issue
//   .remoteEnded      — counterparty hung up
//   .unanswered       — incoming call not answered
//   .answeredElsewhere — answered on another device
//   .declinedElsewhere — declined on another device

provider.reportCall(
  with: callUUID,
  endedAt: Date(),
  reason: endReason,
)
```

Use `.remoteEnded` for idle timeout — it's the closest semantic match (the "remote" effectively ended the call by leaving). Don't use `.failed` (implies error; iOS shows a "call failed" UI).

Drive the reporting from your own timer's completion handler — there is no SDK callback to hang this off.

---

## Foreground/background gotcha

iOS suspends background JavaScript / WebRTC threads aggressively. If the user backgrounds the app, the call session may pause. The idle timer continues running in the SDK's tracking, but participant-leave events may queue until foreground.

Practical implication: idle timeout fires immediately on app return, even if the user only backgrounded for a few seconds. Same as RN.

If using CallKit (rule 1.7 in SKILL.md), the background-mode `voip` capability keeps the call alive — but participant tracking may still lag. Test the foreground transition.

---

## Custom prompt — SwiftUI

```swift
struct IdleTimeoutPrompt: View {
  let onStay: () -> Void
  let onEnd: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      Text("Still there?")
        .font(.headline)
      Text("You're alone in this call. It'll end in 60 seconds.")
        .multilineTextAlignment(.center)
        .foregroundColor(.secondary)
      HStack(spacing: 12) {
        Button("End now", role: .destructive, action: onEnd)
          .buttonStyle(.bordered)
        Button("Stay", action: onStay)
          .buttonStyle(.borderedProminent)
      }
    }
    .padding(24)
    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    .accessibilityElement(children: .contain)
    .accessibilityAddTraits(.isModal)
  }
}
```

Used as an overlay:

```swift
struct CallView: View {
  @State private var showIdlePrompt = false

  var body: some View {
    ZStack {
      // Call surface
      if showIdlePrompt {
        Color.black.opacity(0.5)
          .ignoresSafeArea()
          .onTapGesture { /* prevent dismiss on backdrop */ }
        IdleTimeoutPrompt(
          onStay: { showIdlePrompt = false; resetIdleTimer() },
          onEnd: { CometChatCalls.endSession() },
        )
      }
    }
  }
}
```

`accessibilityAddTraits(.isModal)` is the SwiftUI equivalent of web's `aria-modal="true"`. VoiceOver focus stays trapped within the prompt.

---

## UIKit pattern — UIAlertController

For UIKit projects, the simplest path is `UIAlertController`:

```swift
let alert = UIAlertController(
  title: "Still there?",
  message: "You're alone in this call. It'll end in 60 seconds.",
  preferredStyle: .alert,
)
alert.addAction(UIAlertAction(title: "Stay", style: .default) { _ in
  resetIdleTimer()
})
alert.addAction(UIAlertAction(title: "End now", style: .destructive) { _ in
  CometChatCalls.endSession()
})
alert.preferredAction = alert.actions.first  // make Stay the default
present(alert, animated: true)
```

`alert.preferredAction` makes "Stay" the default highlighted action — VoiceOver activates it on triple-click home button as the default response.

---

## Anti-patterns

Web sister reference rules apply, plus iOS-specific:

1. **Hand-rolling a `Timer` for the timeout itself.** The SDK has `setIdleTimeoutPeriod(_:)` (swiftinterface:289) + `onSessionTimeout()` (swiftinterface:30) — use them. Only a soft "still there?" warning prompt should be client-side.
2. **`onSessionTimeout` firing without reporting end to CallKit.** Lock-screen call card persists — user sees a stuck "ongoing call" until they manually end it.
3. **Using `.failed` reason for idle timeout end.** iOS shows "call failed" — wrong semantic. Use `.remoteEnded`.
4. **Custom prompt that doesn't dim background.** Calls UI keeps rendering behind the prompt; user can interact with controls and call ends prematurely.
5. **`UIAlertController` from background queue.** Crashes — must be on main. Wrap in `DispatchQueue.main.async`.

---

## Verification checklist

- [ ] Timeout set via `CallSettingsBuilder.setIdleTimeoutPeriod(_:)` (seconds) — no hand-rolled `Timer` for the timeout
- [ ] `onSessionTimeout()` delegate callback reports end to CallKit with `.remoteEnded` reason
- [ ] Custom prompt uses `accessibilityAddTraits(.isModal)` (SwiftUI) or `UIAlertController.preferredStyle = .alert`
- [ ] Backdrop dimmed; prevents accidental dismiss
- [ ] All UIKit alert presentations on main thread
- [ ] Real-device smoke: 2 iPhones in call, hangup from one → other shows prompt after configured delay
- [ ] Lock-screen smoke: when call times out, lock-screen card disappears (CallKit reported)

---

## Pointers

- `cometchat-react-calls/references/idle-timeout.md` — sister reference (settings, archetype timeouts)
- `cometchat-ios-calls` SKILL.md
- `references/callkit-and-pushkit.md` — CallKit reporting end
- `references/swiftui-uikit-hosting.md` — embedding SwiftUI prompts in UIKit nav
- Canonical docs: https://www.cometchat.com/docs/calls/ios/idle-timeout
