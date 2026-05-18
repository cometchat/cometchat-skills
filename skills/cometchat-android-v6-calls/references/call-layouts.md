# Call layouts on Android V6 (Compose)

Same SDK API as V5; V6 adds Compose-native `SegmentedButton` for the switcher.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/call-layouts
**Read first:** `cometchat-android-v5-calls/references/call-layouts.md` — full Java/Kotlin SDK API.

---

## ViewModel

```kotlin
class CallLayoutViewModel : ViewModel() {
  private val _layout = MutableStateFlow(CometChatCallsConstants.LAYOUT_TILE)
  val layout: StateFlow<String> = _layout

  fun set(next: String) {
    CometChatCalls.setLayout(next)
    _layout.value = next
  }

  fun onSDKChanged(next: String) {
    _layout.value = next  // already updated by kit's switcher
  }
}

// Wire from CometChatCallsEventsListener:
override fun onCallLayoutChanged(layout: String) {
  Handler(Looper.getMainLooper()).post {
    callLayoutViewModel.onSDKChanged(layout)
  }
}
```

---

## Compose switcher (SingleChoiceSegmentedButtonRow)

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LayoutSwitcher(viewModel: CallLayoutViewModel = viewModel()) {
  val layout by viewModel.layout.collectAsStateWithLifecycle()

  val options = listOf(
    CometChatCallsConstants.LAYOUT_TILE to "Tile",
    CometChatCallsConstants.LAYOUT_SIDEBAR to "Sidebar",
    CometChatCallsConstants.LAYOUT_SPOTLIGHT to "Spotlight",
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

- [ ] `CallLayoutViewModel` exposes `StateFlow<String>`
- [ ] `SingleChoiceSegmentedButtonRow` wraps the layout options
- [ ] `collectAsStateWithLifecycle` (not `collectAsState`)
- [ ] `onCallLayoutChanged` syncs the ViewModel on main thread
- [ ] Real-device smoke: cycles all 3, survives rotation

---

## Pointers

- `cometchat-android-v5-calls/references/call-layouts.md` — V5 sister (Views patterns)
- `cometchat-android-v6-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/android/call-layouts
