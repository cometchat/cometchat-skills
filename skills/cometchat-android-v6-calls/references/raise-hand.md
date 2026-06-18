# Raise hand on Android V6 (Compose + Kotlin Views)

V6 ships the same SDK API as V5 with two key delta: (1) Compose-first surface for new code, Kotlin Views still supported; (2) ViewModel + `collectAsStateWithLifecycle` is the canonical state-binding shape rather than manual `repeatOnLifecycle`.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/raise-hand
**Read first:** `cometchat-android-v5-calls/references/raise-hand.md` — the SDK API + ViewModel pattern is shared; this reference covers V6's Compose layer.

---

## SDK API (same as V5)

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.CometChatCallsEventsListener
import com.cometchat.calls.model.Participant

// raiseHand / lowerHand are instance methods on the CallSession singleton.
CallSession.getInstance().raiseHand()
CallSession.getInstance().lowerHand()

// SessionSettingsBuilder has only () and (Activity) constructors — no (context, container) form.
val settings = SessionSettingsBuilder(activity)  // or no-arg SessionSettingsBuilder()
  .setSessionType(SessionType.VIDEO)
  .hideRaiseHandButton(true)
  .build()
```

ViewModel + `StateFlow` pattern is identical to V5 (cf. sister reference). The Compose-specific delta is the UI layer.

---

## Compose toggle button

```kotlin
@Composable
fun RaiseHandButton(viewModel: RaiseHandViewModel = viewModel()) {
  val state by viewModel.state.collectAsStateWithLifecycle()
  val context = LocalContext.current

  // Announce a11y on state change
  LaunchedEffect(state.localRaised) {
    val accessibilityManager = context.getSystemService(Context.ACCESSIBILITY_SERVICE)
      as AccessibilityManager
    if (accessibilityManager.isEnabled) {
      val announcement = if (state.localRaised) "Hand raised" else "Hand lowered"
      val event = AccessibilityEvent.obtain(AccessibilityEvent.TYPE_ANNOUNCEMENT)
      event.text.add(announcement)
      accessibilityManager.sendAccessibilityEvent(event)
    }
  }

  IconButton(
    onClick = { viewModel.toggle() },
    modifier = Modifier
      .semantics {
        role = Role.Button
        selected = state.localRaised
        contentDescription = if (state.localRaised) "Lower hand" else "Raise hand"
      }
      .background(
        color = if (state.localRaised) Color(0xFFFFD60A) else Color.White.copy(alpha = 0.2f),
        shape = CircleShape,
      )
      .padding(12.dp),
  ) {
    Icon(
      imageVector = if (state.localRaised) Icons.Filled.PanTool else Icons.Outlined.PanTool,
      contentDescription = null,
      tint = if (state.localRaised) Color.Black else Color.White,
    )
  }
}
```

`collectAsStateWithLifecycle()` (from `androidx.lifecycle.compose:lifecycle-viewmodel-compose`) is the replacement for V5's manual `repeatOnLifecycle` — it pauses collection automatically when the Composable's lifecycle drops below STARTED.

`semantics { ... }` is Compose's accessibility primitive — `role`, `selected`, `contentDescription` map to Android's TalkBack model.

---

## Compose raised-hands sheet

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RaisedHandsSheet(viewModel: RaiseHandViewModel = viewModel()) {
  val state by viewModel.state.collectAsStateWithLifecycle()
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)

  if (state.raised.isNotEmpty()) {
    ModalBottomSheet(
      onDismissRequest = { /* host control */ },
      sheetState = sheetState,
    ) {
      Column(modifier = Modifier.padding(16.dp)) {
        Text(
          text = "Raised hands (${state.raised.size})",
          style = MaterialTheme.typography.titleMedium,
        )
        Spacer(modifier = Modifier.height(8.dp))
        LazyColumn {
          items(state.raised, key = { it.uid }) { p ->
            ListItem(
              leadingContent = { Text("✋", fontSize = 20.sp) },
              headlineContent = { Text(p.name) },
              supportingContent = {
                Text(
                  "${(System.currentTimeMillis() - p.raisedAt) / 1000}s ago",
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
              },
            )
          }
        }
      }
    }
  }
}
```

`ModalBottomSheet` is Material 3 — the V6 default. `key = { it.uid }` on `LazyColumn.items` is critical (same as `trackBy` on the web/Angular side) — without it, every state change re-renders every item from scratch.

---

## Wiring inside a CometChat call screen

Whether the project uses Compose or Kotlin Views for the call surface affects where the button + sheet land. V6 supports both surfaces (cf. `cometchat-android-v6-calls` SKILL.md).

**Compose surface:**

```kotlin
@Composable
fun CallScreen() {
  Box(modifier = Modifier.fillMaxSize()) {
    // CometChat call surface (composable from chatuikit-compose-android)
    CometChatOngoingCall(modifier = Modifier.fillMaxSize())

    // Custom raise-hand overlay
    Box(modifier = Modifier
      .align(Alignment.BottomEnd)
      .padding(20.dp)
    ) {
      RaiseHandButton()
    }

    RaisedHandsSheet()
  }
}
```

**Kotlin Views surface (XML layouts):** use the V5 `MaterialButton`-based pattern from the sister reference. The ViewModel + StateFlow plumbing is identical.

---

## Anti-patterns

V5 sister reference rules apply, plus V6 Compose-specific:

1. **Forgetting `key = { it.uid }` on `LazyColumn.items`.** Without it, scrolling becomes jittery as items re-mount.
2. **Using `collectAsState()` instead of `collectAsStateWithLifecycle()`.** The former doesn't pause on lifecycle pause; burns CPU during background.
3. **`LaunchedEffect(state.localRaised)` firing the announcement on initial composition.** First render counts as a state change; if you don't want an announcement on screen open, gate on `if (state.localRaised) ... else ...` semantics with prior tracking.
4. **Mixing Compose state (`mutableStateOf`) with StateFlow.** Pick one source of truth — StateFlow with `collectAsStateWithLifecycle` is the V6 recommended path.
5. **Custom raise-hand button without the `semantics { selected = ... }`.** TalkBack reads "button" but doesn't announce selection state.

---

## Verification checklist

- [ ] `RaiseHandViewModel` uses `StateFlow` for state
- [ ] Compose components use `collectAsStateWithLifecycle()` (not `collectAsState()`)
- [ ] `LazyColumn.items` uses `key = { it.uid }`
- [ ] Toggle has `semantics { role, selected, contentDescription }`
- [ ] Accessibility announcement on state change via AccessibilityManager
- [ ] `hideRaiseHandButton(true)` in SessionSettingsBuilder if custom UI
- [ ] Compose surface: button mounted via `Box.align` overlay, doesn't shift CometChat call view
- [ ] Real-device smoke: 3 Android phones, 2 raise → host's sheet shows both, sorted by time
- [ ] TalkBack smoke: announces "Hand raised" / "Hand lowered" on toggle

---

## Pointers

- `cometchat-android-v5-calls/references/raise-hand.md` — V5 sister reference (Kotlin Views + StateFlow)
- `cometchat-android-v6-calls` SKILL.md — V6 hard rules + Compose vs Views split
- `cometchat-android-v6-calls/references/group-calls.md` (when authored) — group call composition patterns
- `cometchat-a11y` — Android Compose semantics + TalkBack
- Canonical docs: https://www.cometchat.com/docs/calls/android/raise-hand
