# Device management on Android V6

V6 inherits the V5 SDK API for device management — `CallSession.muteAudio()` / `pauseVideo()` / `setAudioMode()` / camera flip. V5 has detailed audio-controls + video-controls references; this V6 reference covers the Compose-specific UI patterns.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/device-management
**Read first:**
- `cometchat-android-v5-calls/references/audio-controls.md` — full audio control SDK API (carries over)
- `cometchat-android-v5-calls/references/video-controls.md` — camera flip + pause/resume

---

## Compose toggle controls

```kotlin
@Composable
fun CallControls(viewModel: CallControlsViewModel = viewModel()) {
  val state by viewModel.state.collectAsStateWithLifecycle()

  Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
    IconButton(onClick = { viewModel.toggleMic() }) {
      Icon(
        imageVector = if (state.micMuted) Icons.Filled.MicOff else Icons.Filled.Mic,
        contentDescription = if (state.micMuted) "Unmute microphone" else "Mute microphone",
        tint = if (state.micMuted) Color.Red else Color.White,
      )
    }

    IconButton(onClick = { viewModel.toggleCamera() }) {
      Icon(
        imageVector = if (state.cameraOff) Icons.Filled.VideocamOff else Icons.Filled.Videocam,
        contentDescription = if (state.cameraOff) "Turn on camera" else "Turn off camera",
        tint = if (state.cameraOff) Color.Red else Color.White,
      )
    }

    IconButton(onClick = { viewModel.flipCamera() }) {
      Icon(
        imageVector = Icons.Filled.FlipCameraIos,
        contentDescription = "Flip camera",
        tint = Color.White,
      )
    }

    IconButton(onClick = { viewModel.toggleSpeaker() }) {
      Icon(
        imageVector = when (state.audioMode) {
          AudioMode.SPEAKER -> Icons.Filled.VolumeUp
          AudioMode.EARPIECE -> Icons.Filled.PhoneInTalk
          AudioMode.BLUETOOTH -> Icons.Filled.Bluetooth
        },
        contentDescription = "Audio output: ${state.audioMode.name}",
        tint = Color.White,
      )
    }
  }
}
```

---

## ViewModel

```kotlin
data class CallControlsState(
  val micMuted: Boolean = false,
  val cameraOff: Boolean = false,
  val audioMode: AudioMode = AudioMode.SPEAKER,
)

class CallControlsViewModel : ViewModel() {
  private val _state = MutableStateFlow(CallControlsState())
  val state: StateFlow<CallControlsState> = _state

  fun toggleMic() {
    val callSession = CallSession.getInstance()
    if (_state.value.micMuted) {
      callSession.unMuteAudio()
    } else {
      callSession.muteAudio()
    }
    _state.update { it.copy(micMuted = !it.micMuted) }
  }

  fun toggleCamera() {
    val callSession = CallSession.getInstance()
    if (_state.value.cameraOff) {
      callSession.resumeVideo()
    } else {
      callSession.pauseVideo()
    }
    _state.update { it.copy(cameraOff = !it.cameraOff) }
  }

  fun flipCamera() {
    val callSession = CallSession.getInstance()
    val newFacing = if (callSession.currentCameraFacing == CameraFacing.FRONT) {
      CameraFacing.BACK
    } else {
      CameraFacing.FRONT
    }
    callSession.switchCamera(newFacing)
  }

  fun toggleSpeaker() {
    val callSession = CallSession.getInstance()
    val nextMode = when (_state.value.audioMode) {
      AudioMode.SPEAKER -> AudioMode.EARPIECE
      AudioMode.EARPIECE -> AudioMode.SPEAKER
      AudioMode.BLUETOOTH -> AudioMode.SPEAKER
    }
    callSession.setAudioMode(nextMode)
    _state.update { it.copy(audioMode = nextMode) }
  }
}
```

---

## Bluetooth audio routing

V6 still uses the V5 SDK's `MediaEventsListener` for audio mode change detection:

```kotlin
class CallControlsViewModel : ViewModel(), MediaEventsListener {
  init {
    CallSession.getInstance().addMediaEventsListener("controls", this)
  }

  override fun onAudioModeUpdated(mode: AudioMode) {
    _state.update { it.copy(audioMode = mode) }
  }

  override fun onCleared() {
    CallSession.getInstance().removeMediaEventsListener("controls")
  }
  // ... other MediaEventsListener methods
}
```

When the user connects Bluetooth headphones mid-call, `onAudioModeUpdated(BLUETOOTH)` fires. Update the UI button accordingly.

---

## Anti-patterns

V5 audio-controls + video-controls references list the SDK-level anti-patterns; V6 Compose-specific:

1. **`Icons.Filled.MicOff` without `tint`.** Default tint is theme-dependent; on dark call surfaces, the icon may be invisible.
2. **`collectAsState()` instead of `collectAsStateWithLifecycle()`.** State updates run while paused; CPU waste.
3. **Camera flip without checking current facing.** SDK's `switchCamera()` (no arg) toggles, but `switchCamera(CameraFacing)` requires explicit value. Use the explicit-arg form for clarity.

---

## Verification checklist

- [ ] ViewModel uses `StateFlow` + `collectAsStateWithLifecycle()`
- [ ] All toggle buttons have `contentDescription` (a11y)
- [ ] `MediaEventsListener` registered with stable ID
- [ ] Listener cleaned up in `onCleared()`
- [ ] Real-device smoke: mute / camera / flip / speaker all work
- [ ] Bluetooth smoke: connect headphones → audio mode icon updates

---

## Pointers

- `cometchat-android-v5-calls/references/audio-controls.md` — full audio SDK API (mute/audio mode)
- `cometchat-android-v5-calls/references/video-controls.md` — camera pause/resume/flip
- `cometchat-android-v6-calls` SKILL.md
- `cometchat-android-v6-calls/references/raise-hand.md` — Compose pattern sibling
- Canonical docs: https://www.cometchat.com/docs/calls/android/device-management
