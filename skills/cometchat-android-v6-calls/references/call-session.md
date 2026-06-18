# Call session — joinSession with no ringing (Android V6 / Compose)

V6 uses the same SDK (`com.cometchat.calls-sdk-android`) as V5. The canonical SDK API surface is documented in the V5 sister; this file documents only the Compose-specific delta (bridging `AndroidView` to the SDK's `RelativeLayout` container).

**Read first:**
- `cometchat-android-v5-calls/references/call-session.md` — canonical SDK API (single-call `joinSession`, `SessionSettingsBuilder`, `SessionStatusListener`, `CometChatOngoingCallService`)
- `cometchat-react-calls/references/call-session.md` — cross-platform architecture

**Source of truth:** `calls-sdk-android-5/samples/sample-app/src/main/kotlin/com/cometchat/samplecalls/ui/activity/CallActivity.kt` (no Compose-specific upstream sample exists; the SDK surface is identical).

---

## Hard rules

All V5 rules apply (single-call `joinSession(sessionId, settings, container, callback)`, `CometChatCalls.SessionSettingsBuilder()`, `SessionStatusListener` on the `CallSession` instance, `CometChatOngoingCallService.launch/abort`, runtime permissions, no Chat SDK for session-only). The V6 Compose-specific deltas:

1. **`AndroidView` with `remember`-stable factory** to host the SDK's `RelativeLayout` container. The factory MUST be wrapped in `remember { }` — re-creating the layout on every recomposition flickers / re-joins the session.
2. **`LaunchedEffect(sessionId)` to fire `joinSession` once**, not in a Composable body. Composable bodies re-run on recomposition; the SDK would join multiple times.
3. **`DisposableEffect` for cleanup**, NOT `LaunchedEffect`'s cleanup lambda. `LaunchedEffect`'s cleanup fires on key change too, not just final dispose. `DisposableEffect.onDispose` is the correct teardown hook.
4. **State observation via `mutableStateOf` set from listener callbacks** — the listener callbacks must hop to `Main` dispatcher (or use `runOnUiThread` from a hosting activity ref) before touching Compose state.

---

## Compose CallRoom

```kotlin
@Composable
fun CallRoom(sessionId: String, onLeft: () -> Unit) {
  val context = LocalContext.current
  val activity = context as Activity
  val containerRef = remember { mutableStateOf<RelativeLayout?>(null) }
  val joined = remember { mutableStateOf(false) }
  val callSession = remember { mutableStateOf<CallSession?>(null) }

  AndroidView(
    factory = { ctx ->
      RelativeLayout(ctx).apply {
        layoutParams = ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT)
        setBackgroundColor(android.graphics.Color.BLACK)
        containerRef.value = this
      }
    },
    modifier = Modifier.fillMaxSize(),
  )

  LaunchedEffect(sessionId) {
    if (joined.value) return@LaunchedEffect
    val container = containerRef.value ?: return@LaunchedEffect
    joined.value = true

    val sessionSettings = CometChatCalls.SessionSettingsBuilder()
      .setTitle("CometChat Meeting")
      .startVideoPaused(false)
      .startAudioMuted(false)
      .build()

    CometChatCalls.joinSession(
      sessionId,
      sessionSettings,
      container,
      object : CometChatCalls.CallbackListener<CallSession>() {
        override fun onSuccess(session: CallSession) {
          callSession.value = session

          // Single guarded termination handler — the v5 Calls SDK fires
          // onSessionLeft + onConnectionClosed in sequence on every hangup.
          // Without the guard, abort() + onLeft() fire 3 times (wasteful;
          // can race the composable's exit transition).
          val isTerminating = mutableStateOf(false)
          fun handleTermination() {
            if (isTerminating.value) return
            isTerminating.value = true
            activity.runOnUiThread {
              CometChatOngoingCallService.abort(activity)
              onLeft()
            }
          }

          session.addSessionStatusListener(activity, object : SessionStatusListener() {
            override fun onSessionJoined() {
              CometChatOngoingCallService.launch(activity)
            }

            override fun onSessionLeft() = handleTermination()
            override fun onConnectionClosed() = handleTermination()
            override fun onSessionTimedOut() = handleTermination()

            override fun onConnectionLost() {}
            override fun onConnectionRestored() {}
          })

          session.addButtonClickListener(activity, object : ButtonClickListener() {
            override fun onLeaveSessionButtonClicked() {
              val active = CallSession.getInstance()
              if (active.isSessionActive) active.leaveSession()
              // The listener chain calls handleTermination().
            }
          })
        }

        override fun onError(e: CometChatException) {
          activity.runOnUiThread {
            Toast.makeText(activity, "Failed to join: ${e.message}", Toast.LENGTH_LONG).show()
            onLeft()
          }
        }
      }
    )
  }

  DisposableEffect(sessionId) {
    onDispose {
      val active = CallSession.getInstance()
      if (active.isSessionActive) active.leaveSession()
      CometChatOngoingCallService.abort(activity)
    }
  }
}
```

**Why this shape:**

- **`AndroidView` factory wrapped in `remember`** — Compose otherwise re-creates the `RelativeLayout` on every recomposition; the SDK's video tile dies along with it.
- **`LaunchedEffect(sessionId)` for the join call** — Composable body re-runs on every recomposition; `LaunchedEffect` runs once per key. The `joined` guard handles configuration changes (rotation re-keys the effect).
- **`runOnUiThread` inside listener callbacks** — SDK callbacks fire on background threads; touching Compose state from them throws without the dispatcher hop.
- **`DisposableEffect.onDispose` for `leaveSession`** — `LaunchedEffect`'s cleanup runs on key change too. `DisposableEffect.onDispose` only runs when the composable actually leaves composition.

---

## Anti-patterns

V5 sister rules apply, plus V6 Compose-specific:

1. **`AndroidView` without `remember { }` around the layout reference.** Each recomposition creates a new layout → call surface flickers, joinSession orphans previous container.
2. **`leaveSession()` in `LaunchedEffect`'s cleanup lambda.** Fires on every key change, not just dispose. Use `DisposableEffect.onDispose`.
3. **Skipping the `joined` guard.** Configuration changes (rotation) re-run `LaunchedEffect` with the same key (StrictMode-like behavior in dev); guard prevents double-join.
4. **Touching `mutableStateOf` from listener callbacks without `runOnUiThread`.** Compose state isn't thread-safe; race conditions corrupt state.
5. **Putting `joinSession` directly in the Composable body** (not in `LaunchedEffect`). Recomposition re-runs the call → multiple sessions.

---

## Verification checklist

V5 checklist applies, plus Compose-specific:

- [ ] `AndroidView` factory creates `RelativeLayout` once, stored via `remember { mutableStateOf<RelativeLayout?>(null) }`
- [ ] `joinSession` fired inside `LaunchedEffect(sessionId)`, NOT in Composable body
- [ ] `joined` flag guards re-entry on rotation / key re-trigger
- [ ] `DisposableEffect.onDispose` calls `leaveSession` + `CometChatOngoingCallService.abort`
- [ ] Listener callbacks use `activity.runOnUiThread { ... }` before touching Compose state
- [ ] `onSessionLeft`, `onConnectionClosed`, `onSessionTimedOut` ALL fire the `onLeft` callback
- [ ] **Standalone session-only:** no chat-sdk-android dependency
- [ ] Real-device smoke: rotation doesn't double-join, dispose tears down cleanly, foreground-service notification clears

---

## Pointers

- `cometchat-android-v5-calls/references/call-session.md` — canonical SDK API + Views patterns
- `cometchat-android-v6-calls/SKILL.md` — V6 Compose architecture (W1–W5 workarounds for the kit)
- `cometchat-android-v6-calls/references/share-invite.md` — App Links config
- Upstream Android sample — `calls-sdk-android-5/samples/sample-app/src/main/kotlin/com/cometchat/samplecalls/ui/activity/CallActivity.kt`
- Canonical docs: https://www.cometchat.com/docs/calls/android/join-session
