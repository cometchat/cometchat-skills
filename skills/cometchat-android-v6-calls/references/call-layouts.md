# Call layouts on Android V6 (Compose)

Same SDK API as V5; V6 adds Compose-native `SegmentedButton` for the switcher.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/call-layouts
**Read first:** `cometchat-android-v5-calls/references/call-layouts.md` — full Java/Kotlin SDK API.

---

## ViewModel

Layout is the `LayoutType` enum (`TILE` / `SIDEBAR` / `SPOTLIGHT`) — there is no `CometChatCallsConstants.LAYOUT_*` and `setLayout` is an instance method on the `CallSession` singleton (not a static on `CometChatCalls`).

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.LayoutListener
import com.cometchat.calls.model.LayoutType

class CallLayoutViewModel : ViewModel() {
  private val _layout = MutableStateFlow(LayoutType.TILE)
  val layout: StateFlow<LayoutType> = _layout

  fun set(next: LayoutType) {
    CallSession.getInstance().setLayout(next)
    _layout.value = next
  }

  fun onSDKChanged(next: LayoutType) {
    _layout.value = next  // already updated by kit's switcher
  }
}

// Register a LayoutListener via CallSession.addLayoutListener(lifecycleOwner, ...).
// onCallLayoutChanged is a LayoutListener member (NOT a CometChatCallsEventsListener one).
CallSession.getInstance().addLayoutListener(lifecycleOwner, object : LayoutListener() {
  override fun onCallLayoutChanged(layout: LayoutType) {
    Handler(Looper.getMainLooper()).post {
      callLayoutViewModel.onSDKChanged(layout)
    }
  }
})
```

---

## Compose switcher (SingleChoiceSegmentedButtonRow)

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LayoutSwitcher(viewModel: CallLayoutViewModel = viewModel()) {
  val layout by viewModel.layout.collectAsStateWithLifecycle()

  val options = listOf(
    LayoutType.TILE to "Tile",
    LayoutType.SIDEBAR to "Sidebar",
    LayoutType.SPOTLIGHT to "Spotlight",
  )

  SingleChoiceSegmentedButtonRow {
    options.forEachIndexed { index, (value, label) ->
      SegmentedButton(
        selected = layout == value,
        onClick = { viewModel.set(value) },
        shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
      ) {
        Text(label)
      }
    }
  }
}
```

---

## Anti-patterns

V5 sister rules apply, plus Compose-specific:

1. **`collectAsState()` instead of `collectAsStateWithLifecycle()`.** State updates while paused → wasted work.
2. **`Row` of `OutlinedButton`s instead of `SegmentedButton`.** Visually similar but missing the radio-group accessibility semantics; TalkBack announces it as 3 separate buttons.
3. **Calling `setLayout` directly from the composable.** Move it to ViewModel — survives config changes.

---

## Verification checklist

- [ ] `CallLayoutViewModel` exposes `StateFlow<LayoutType>`
- [ ] `SingleChoiceSegmentedButtonRow` wraps the layout options
- [ ] `collectAsStateWithLifecycle` (not `collectAsState`)
- [ ] `LayoutListener.onCallLayoutChanged` (registered via `addLayoutListener`) syncs the ViewModel on main thread
- [ ] Real-device smoke: cycles all 3, survives rotation

---

## Pointers

- `cometchat-android-v5-calls/references/call-layouts.md` — V5 sister (Views patterns)
- `cometchat-android-v6-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/android/call-layouts
