# Ringing — call signaling with custom UI (iOS)

iOS-specific deltas: PushKit + CallKit are mandatory for backgrounded ring delivery; foreground ringing uses the Chat SDK's `CometChatCallDelegate` (NOT the Calls SDK's `CallsEventsDelegate`); AVAudioSession routing.

**Read first:** `cometchat-react-calls/references/ringing-integration.md` — full architecture, hard rules.

---

## SDK API

```swift
import CometChatSDK
import CometChatCallsSDK

let call = Call(receiverId: receiverUid, callType: .video, receiverType: .user)
CometChat.initiateCall(call: call, onSuccess: { outgoing in
  self.showOutgoingCallScreen(outgoing)
}, onError: { err in
  print("Initiate failed:", err)
})
```

---

## Foreground listener

Ringing/signaling events live on the Chat SDK's `CometChatCallDelegate` (its callbacks take TWO params: the call and an error). Implement it and register at app start with the positional `CometChat.addCallListener(_:_:)`:

```swift
class AppCallListener: NSObject, CometChatCallDelegate {
  func onIncomingCallReceived(incomingCall: Call?, error: CometChatException?) {
    guard let call = incomingCall else { return }
    DispatchQueue.main.async { showIncomingCallScreen(call) }
  }
  func onOutgoingCallAccepted(acceptedCall: Call?, error: CometChatException?) {
    guard let call = acceptedCall else { return }
    DispatchQueue.main.async { startCallSession(sessionId: call.sessionId) }
  }
  func onIncomingCallCancelled(canceledCall: Call?, error: CometChatException?) {
    DispatchQueue.main.async { dismissIncomingCallScreen() }
  }
  func onOutgoingCallRejected(rejectedCall: Call?, error: CometChatException?) {
    DispatchQueue.main.async { dismissOutgoingCallScreen() }
  }
  func onCallEndedMessageReceived(endedCall: Call?, error: CometChatException?) {
    DispatchQueue.main.async { teardownCallUI() }
  }
}

CometChat.addCallListener("app", AppCallListener())   // positional labels
```

Add this in `AppDelegate.didFinishLaunchingWithOptions` AFTER `CometChat.init` succeeds.

---

## Backgrounded ring — PushKit + CallKit (mandatory)

iOS requires PushKit + CallKit for ring delivery when the app is backgrounded or killed. The foreground listener does NOT fire in those states. See `cometchat-ios-calls/references/server-apns-pushkit.md` for the server template.

PushKit delegate flow:
1. `pushRegistry(_:didReceiveIncomingPushWith:for:completion:)` fires
2. Within ~5s, call `CXProvider.reportNewIncomingCall(with:update:)` — Apple revokes VoIP entitlement after 3 missed reports
3. CallKit shows the system incoming-call UI
4. User taps Accept → `provider(_:perform:CXAnswerCallAction)` fires → start CometChat session

---

## SwiftUI incoming-call screen

```swift
struct IncomingCallScreen: View {
  let call: Call
  let onAccept: () -> Void
  let onReject: () -> Void

  var body: some View {
    ZStack {
      Color.black.opacity(0.85).ignoresSafeArea()
      VStack(spacing: 24) {
        AsyncImage(url: URL(string: call.callInitiator?.avatar ?? ""))
          .frame(width: 120, height: 120)
          .clipShape(Circle())
        Text(call.callInitiator?.name ?? "Unknown")
          .font(.title)
        Text("Incoming \(call.type.rawValue) call")
          .foregroundStyle(.secondary)
        HStack(spacing: 32) {
          Button(action: onReject) {
            Image(systemName: "phone.down.fill")
              .padding(20)
              .background(Color.red, in: Circle())
              .foregroundStyle(.white)
          }
          .accessibilityLabel("Decline call")
          Button(action: onAccept) {
            Image(systemName: "phone.fill")
              .padding(20)
              .background(Color.green, in: Circle())
              .foregroundStyle(.white)
          }
          .accessibilityLabel("Accept call")
        }
      }
      .foregroundStyle(.white)
    }
  }
}
```

For backgrounded ring, CallKit's UI takes over — your SwiftUI screen only fires for foreground rings.

---

## Anti-patterns

Web sister rules apply, plus iOS-specific:

1. **Listener registered before `CometChat.init`.** Crash. Always register after init's success block.
2. **Skipping PushKit + CallKit.** Backgrounded calls don't ring. Apple may also revoke VoIP entitlement if you ship with `pushType: .voIP` registered but no CallKit reporting.
3. **Updating UI from listener callback's thread.** SDK fires off main; always `DispatchQueue.main.async` for UI updates.
4. **Playing AVAudioPlayer ringtone during CallKit ring.** CallKit plays system ringtone; double-up is jarring.

---

## Verification checklist

- [ ] Foreground listener registered after `CometChat.init` resolves
- [ ] PushKit registry initialized + .p8 key configured
- [ ] CallKit `CXProvider.reportNewIncomingCall` fires within 5s of push
- [ ] All listener callbacks dispatch to main queue
- [ ] `removeCallListener` in app teardown
- [ ] Real-device smoke: foreground ring, backgrounded ring (push), killed-app ring (push) all surface UI

---

## Pointers

- `cometchat-react-calls/references/ringing-integration.md` — canonical
- `cometchat-ios-calls/SKILL.md` — seven hard rules
- `cometchat-ios-calls/references/server-apns-pushkit.md` — PushKit server-side
- `cometchat-ios-calls/references/callkit-and-pushkit.md` — CallKit details
- Canonical docs: https://www.cometchat.com/docs/calls/ios/ringing
