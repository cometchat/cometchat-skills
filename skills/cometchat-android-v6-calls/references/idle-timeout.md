# Idle timeout on Android V6 (Compose + Kotlin Views)

Same SDK API as V5. V6-specific: Compose `AlertDialog` for new code, ViewModel + `collectAsStateWithLifecycle` (cf. `references/raise-hand.md` V6 sibling).

**Canonical docs:** https://www.cometchat.com/docs/calls/android/idle-timeout
**Read first:** `cometchat-android-v5-calls/references/idle-timeout.md` — V5 sister covers ViewModel pattern.

---

## SDK API (same as V5)

There is a single `setIdleTimeoutPeriod(int)` — there is no separate before/after-prompt pair. `SessionSettingsBuilder` has only `()` and `(Activity)` constructors (no `(context, container)` form).

```kotlin
val settings = SessionSettingsBuilder(activity)  // or no-arg SessionSettingsBuilder()
  .setSessionType(SessionType.VIDEO)
  .setIdleTimeoutPeriod(60)   // SECONDS (= 60s); default 300
  .build()
```

> **⚠ Unit footgun — Android takes SECONDS, not milliseconds.** `setIdleTimeoutPeriod(int)` is in **seconds** (default `300` = 5 min; docs: calls/android/idle-timeout). The **web / React Native / Angular** Calls SDK uses **milliseconds** for `SessionSettings.idleTimeoutPeriodBeforePrompt/AfterPrompt` — copying a web value like `60000` here is a ~16.7-hour timeout, not 60 seconds. Use `60` for one minute.

---

## Compose prompt

```kotlin
@Composable
fun IdleTimeoutPrompt(
  onStay: () -> Unit,
  onEnd: () -> Unit,
) {
  AlertDialog(
    onDismissRequest = { /* prevent backdrop dismiss */ },
    title = { Text("Still there?") },
    text = { Text("You're alone in this call. It'll end in 60 seconds.") },
    confirmButton = {
      Button(onClick = onStay) { Text("Stay") }
    },
    dismissButton = {
      TextButton(onClick = onEnd) {
        Text("End now", color = MaterialTheme.colorScheme.error)
      }
    },
  )
}
```

`onDismissRequest = { }` (empty) prevents backdrop dismiss — Compose's AlertDialog doesn't have a `setCancelable(false)` equivalent; you swallow the dismiss.

---

## Wiring in CallScreen

```kotlin
@Composable
fun CallScreen(viewModel: CallViewModel = viewModel()) {
  val state by viewModel.state.collectAsStateWithLifecycle()

  Box(modifier = Modifier.fillMaxSize()) {
    // CometChat call surface
    CometChatOngoingCall(modifier = Modifier.fillMaxSize())

    if (state.showIdlePrompt) {
      IdleTimeoutPrompt(
        onStay = { viewModel.dismissIdlePrompt() },
        onEnd = { CallSession.getInstance().leaveSession() },
      )
    }

    // Toast for actual timeout (after grace period)
    val context = LocalContext.current
    LaunchedEffect(state.timedOut) {
      if (state.timedOut) {
        Toast.makeText(context, "Call ended due to inactivity", Toast.LENGTH_LONG).show()
      }
    }
  }
}
```

`collectAsStateWithLifecycle()` (V6 pattern) replaces V5's manual `repeatOnLifecycle`.

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **`AlertDialog` with `onDismissRequest = { onEnd() }`.** Wrong — backdrop tap accidentally ends the call. Empty body or explicit no-op.
2. **`LaunchedEffect(state)` instead of `LaunchedEffect(state.timedOut)`.** Re-fires on every state change.

---

## Verification checklist

- [ ] SessionSettingsBuilder sets `setIdleTimeoutPeriod(int)`
- [ ] Compose AlertDialog `onDismissRequest = { }` (empty)
- [ ] `collectAsStateWithLifecycle()` for state binding
- [ ] LaunchedEffect on specific field, not whole state
- [ ] Real-device smoke: same as V5

---

## Pointers

- `cometchat-android-v5-calls/references/idle-timeout.md` — V5 sister
- `cometchat-android-v6-calls` SKILL.md
- `cometchat-android-v6-calls/references/raise-hand.md` — Compose pattern sibling
- Canonical docs: https://www.cometchat.com/docs/calls/android/idle-timeout
