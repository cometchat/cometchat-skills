# Raise hand on iOS — NOT supported on the iOS Calls SDK v5

**Raise-hand is not available on the iOS `CometChatCallsSDK` v5.** Do not emit any of these — none of them exist on the SDK:

- `CometChatCalls.raiseHand()` / `CometChatCalls.lowerHand()`
- `onParticipantHandRaised` / `onParticipantHandLowered` (no such `CallsEventsDelegate` callbacks)
- any `setShowRaiseHandButton` / `enableRaiseHand` builder flag

The `CallsEventsDelegate` surface in v5 (verified against `CometChatCallsSDK` swiftinterface:29-54) is: `onSessionTimeout()`, `onCallEnded()`, `onCallEndButtonPressed()`, plus the participant/media events in BOTH a current TYPED form and a DEPRECATED `NSDictionary`/`NSArray` form — `onUserJoined(rtcUser:)`, `onUserLeft(rtcUser:)`, `onUserListChanged(rtcUsers:)`, `onAudioModeChanged(mode:)`, `onUserMuted(rtcMutedUser:)`, `onRecordingToggled(recordingInfo:)`, `onCallSwitchedToVideo(callSwitchedInfo:)`. Prefer the typed forms (`RTCUser`, `RTCMutedUser`, `RTCRecordingInfo`, `CallSwitchRequestInfo`, `CallAudioMode`). There is NO hand-raise event of any spelling.

## If a customer asks for raise-hand on iOS

There is no SDK affordance to wire. The options are:

1. **Build it out-of-band over the Chat SDK.** Send a custom message / transient message (e.g. `TransientMessage` or a typed `CustomMessage`) from the raising user, and have each client render a hand badge from those messages. This is app-level state the Calls SDK is not involved in.
2. **Defer to web/Android** if the meeting must have first-class raise-hand and those platforms support it.
3. **Wait for vendor support** — track the CometChat iOS Calls SDK release notes.

Do NOT scaffold a `CometChatCalls.raiseHand()` call path; it will not compile.

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — web raise-hand (the feature shape, where it IS supported)
- `cometchat-ios-calls` SKILL.md — base hard rules
