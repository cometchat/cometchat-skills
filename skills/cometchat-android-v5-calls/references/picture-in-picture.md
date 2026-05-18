---
name: picture-in-picture
description: Enable Picture-in-Picture mode for calls. Use when implementing PiP, floating call window, auto-PiP on home press, or PiP layout events. Triggers on "picture in picture", "PiP", "pip mode", "floating window".
inclusion: manual
---

# CometChat Calls SDK v5 — Picture-in-Picture

## Overview

PiP lets users continue calls in a floating window while using other apps. Your app manages Android's PiP APIs; the Calls SDK adjusts the call UI layout to fit the smaller window.

## Prerequisites

- Android 8.0+ (API 26+)
- Active call session

## Key Imports

```kotlin
import android.app.PictureInPictureParams
import android.util.Rational
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.LayoutListener
import com.cometchat.calls.model.LayoutType
```

## Implementation

### Manifest Configuration

```xml
<activity
    android:name=".CallActivity"
    android:supportsPictureInPicture="true"
    android:configChanges="screenSize|smallestScreenSize|screenLayout|orientation" />
```

### Enable/Disable PiP Layout

```kotlin
val callSession = CallSession.getInstance()

// Tell SDK to adjust UI for PiP
callSession.enablePictureInPictureLayout()

// Restore full UI
callSession.disablePictureInPictureLayout()
```

### Auto-Enter PiP on Home Press

```kotlin
override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (CallSession.getInstance().isSessionActive) {
        enterPictureInPictureMode(
            PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
        )
        CallSession.getInstance().enablePictureInPictureLayout()
    }
}
```

### Handle PiP Mode Changes

```kotlin
override fun onPictureInPictureModeChanged(isInPiPMode: Boolean, config: Configuration) {
    super.onPictureInPictureModeChanged(isInPiPMode, config)
    if (isInPiPMode) {
        CallSession.getInstance().enablePictureInPictureLayout()
    } else {
        CallSession.getInstance().disablePictureInPictureLayout()
    }
}
```

### Listen for PiP Events

```kotlin
callSession.addLayoutListener(this, object : LayoutListener() {
    override fun onPictureInPictureLayoutEnabled() {
        // Hide custom overlays/controls
    }
    override fun onPictureInPictureLayoutDisabled() {
        // Show custom overlays/controls
    }
    override fun onCallLayoutChanged(layoutType: LayoutType) {}
    override fun onParticipantListVisible() {}
    override fun onParticipantListHidden() {}
})
```

## Gotchas

- The SDK only adjusts the **call UI layout** — your app must call `enterPictureInPictureMode()` itself
- `configChanges` in manifest prevents activity restart during PiP transitions
- PiP has no effect on Android < 8.0
- Hide custom controls in PiP mode — they won't be usable in the small window
- Use `isSessionActive` check before entering PiP to avoid errors

## Sample App Reference

- `CallActivity.kt` — Call activity that could be extended with PiP support
