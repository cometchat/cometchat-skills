# Idle timeout on Android V5

SDK API: SessionSettingsBuilder setter + listener event. ViewModel + StateFlow pattern (cf. `references/raise-hand.md`). Material AlertDialog or BottomSheet for the prompt.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/idle-timeout
**Read first:** `cometchat-react-calls/references/idle-timeout.md` — settings + archetype timeouts.

---

## SDK API

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.model.SessionType

val settings = CometChatCalls.SessionSettingsBuilder()
  .setSessionType(SessionType.VIDEO)
  .setIdleTimeoutPeriod(60)   // SECONDS (= 60s). single setter — no before/after-prompt pair. default 300
  .build()
```

> **⚠ Unit footgun — Android takes SECONDS, not milliseconds.** `setIdleTimeoutPeriod(int)` is in **seconds** (default `300` = 5 min; docs: calls/android/idle-timeout). This differs from the **web / React Native / Angular** Calls SDK, whose `SessionSettings.idleTimeoutPeriodBeforePrompt/AfterPrompt` are in **milliseconds**. Copying a web value like `60000` here sets a ~16.7-hour timeout, not 60 seconds. Use `60` for one minute.

Listener — `onSessionTimedOut()` lives on `SessionStatusListener` in v5.
Register on the `CallSession` instance from `joinSession`'s `onSuccess`:

```kotlin
import com.cometchat.calls.listeners.SessionStatusListener

callSession.addSessionStatusListener(this, object : SessionStatusListener() {
  override fun onSessionTimedOut() {
    // Runs on background thread — dispatch to main
    runOnUiThread {
      Toast.makeText(this@CallActivity, "Call ended due to inactivity", Toast.LENGTH_LONG).show()
      finish()  // or NavController.popBackStack()
    }
  }
})
```

---

## ViewModel pattern

```kotlin
data class CallUiState(val timedOut: Boolean = false)

class CallViewModel : ViewModel() {
  private val _state = MutableStateFlow(CallUiState())
  val state: StateFlow<CallUiState> = _state

  fun onSessionTimedOut() {
    _state.update { it.copy(timedOut = true) }
  }
}

// Activity collects:
lifecycleScope.launch {
  repeatOnLifecycle(Lifecycle.State.STARTED) {
    viewModel.state.collect { state ->
      if (state.timedOut) {
        showIdleTimeoutToast()
        finish()
      }
    }
  }
}
```

The bridge is the listener calling `viewModel.onSessionTimedOut()` (cf. raise-hand.md ViewModel pattern).

---

## Prompt UI — Material AlertDialog

```kotlin
fun showIdlePrompt(onStay: () -> Unit, onEnd: () -> Unit) {
  MaterialAlertDialogBuilder(this)
    .setTitle("Still there?")
    .setMessage("You're alone in this call. It'll end in 60 seconds.")
    .setCancelable(false)
    .setPositiveButton("Stay") { _, _ -> onStay() }
    .setNegativeButton("End now") { _, _ -> onEnd() }
    .show()
}
```

`setCancelable(false)` prevents back-button dismiss; user must explicitly choose.

---

## Anti-patterns

Web sister rules + Android-specific:

1. **`Toast.makeText` from background thread.** Crashes — must be on main. `runOnUiThread { ... }` or `lifecycleScope.launch { ... }`.
2. **Dialog without `setCancelable(false)`.** Back-button dismisses; the timer keeps running and disconnects without user response.
3. **Listener attached to a Fragment that's been replaced.** Idle timeout fires after fragment destroyed → IllegalStateException. Detach listener in `onDestroyView`.

---

## Verification checklist

- [ ] SessionSettingsBuilder sets the idle period via `setIdleTimeoutPeriod(...)`
- [ ] `onSessionTimedOut` dispatches to main thread (`runOnUiThread` or coroutine)
- [ ] Dialog uses `setCancelable(false)`
- [ ] Listener attached in `onCreate`/`onResume`, detached in matching teardown
- [ ] Real-device smoke: 2 phones in call, hangup → other shows prompt after delay

---

## Pointers

- `cometchat-react-calls/references/idle-timeout.md` — sister reference
- `cometchat-android-v5-calls` SKILL.md
- `references/raise-hand.md` — ViewModel + StateFlow sibling pattern
- Canonical docs: https://www.cometchat.com/docs/calls/android/idle-timeout
