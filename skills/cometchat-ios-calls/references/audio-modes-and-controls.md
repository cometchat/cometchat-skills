# iOS — Audio Modes + Custom Control Panel

Verified against `CometChatCallsSDK` 5.x (`callssdk.swiftinterface`).

## 1. Audio modes (speaker / earpiece / Bluetooth)

The SDK reports the available audio routes via the `CallsEventsDelegate` as typed `CallAudioMode` objects (swiftinterface:133 — `mode: String`, `isSelected: Bool`), and lets you switch programmatically by passing a `CallAudioMode`.

```swift
import CometChatCallsSDK

// Observe available routes + current selection (typed form).
// swiftinterface:44 onAudioModeChanged(mode: [CallAudioMode])
func onAudioModeChanged(mode: [CallAudioMode]) {
    self.audioRoutes = mode   // each has .mode (e.g. "SPEAKER") and .isSelected
}

// Switch route with a typed CallAudioMode — the current setter.
// swiftinterface:234 CometChatCalls.setAudioMode(_ audioMode: CallAudioMode)
CometChatCalls.setAudioMode(CallAudioMode(mode: "SPEAKER", isSelected: true))
```

Note the kit's default in-call UI already shows an audio-mode button; you only need the above for a **custom** control surface (or to drive routing yourself).

Verified against `CometChatCallsSDK` swiftinterface: the typed `CallsEventsDelegate.onAudioModeChanged(mode: [CallAudioMode])` (swiftinterface:44) and `CometChatCalls.setAudioMode(_ audioMode: CallAudioMode)` (swiftinterface:234) are the CURRENT API. The string forms — `onAudioModeChanged(audioModeList: NSArray)` (swiftinterface:43) and `setAudioMode(mode: String)` (swiftinterface:235) — are DEPRECATED.

## 2. Custom control panel (hide built-in buttons)

There is no separate "panel" object — you compose a custom control bar by **disabling the kit's default buttons** on the `CallSettingsBuilder`, then rendering your own controls (wired to `audioMuted(_:)`, `videoPaused(_:)`, `switchCamera()`, `endSession()`, etc. from the main skill):

```swift
let settings = CallSettingsBuilder()
  .setEndCallButtonDisable(true)
  .setMuteAudioButtonDisable(true)
  .setPauseVideoButtonDisable(true)
  .setSwitchCameraButtonDisable(true)
  .setAudioModeButtonDisable(true)
  .setShowRecordingButton(false)
  .build()
// then overlay your own SwiftUI/UIKit control bar on the call container
```

Verified (on `CallSettingsBuilder`): `setEndCallButtonDisable`, `setMuteAudioButtonDisable`, `setPauseVideoButtonDisable`, `setSwitchCameraButtonDisable`, `setAudioModeButtonDisable`, `setShowRecordingButton` — all `(Bool) -> Self`.

> **Not supported on iOS** (no SDK symbol — do not author): Virtual Background, and local screen-share **initiation** (receive-only). See the main skill's resolution note.
