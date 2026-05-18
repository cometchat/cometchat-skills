# Call layouts on Android V5 (Views)

Same three layouts (TILE/SIDEBAR/SPOTLIGHT). Android V5 uses Java/Kotlin builders + `MaterialButtonToggleGroup` for the switcher (Material Components for Android).

**Canonical docs:** https://www.cometchat.com/docs/calls/android/call-layouts
**Read first:** `cometchat-react-calls/references/call-layouts.md` — layout matrix + when to lock.

---

## SDK API

```kotlin
import com.cometchat.calls.constants.CometChatCallsConstants
import com.cometchat.calls.core.CallSettingsBuilder
import com.cometchat.calls.core.CometChatCalls

val settings = CallSettingsBuilder(activity)
  .setSessionType(CometChatCallsConstants.SESSION_TYPE_VIDEO)
  .setLayout(CometChatCallsConstants.LAYOUT_TILE)        // _TILE | _SIDEBAR | _SPOTLIGHT
  .setHideChangeLayoutButton(false)
  .build()

// Mid-call switch
CometChatCalls.setLayout(CometChatCallsConstants.LAYOUT_SPOTLIGHT)

// Listen
val callsEventListener = object : CometChatCallsEventsListener {
  override fun onCallLayoutChanged(layout: String) {
    activity.runOnUiThread {
      // Update segmented button state
    }
  }
}
```

---

## XML — MaterialButtonToggleGroup

```xml
<com.google.android.material.button.MaterialButtonToggleGroup
    android:id="@+id/layoutToggle"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    app:singleSelection="true"
    app:selectionRequired="true"
    android:contentDescription="@string/call_layout">

  <com.google.android.material.button.MaterialButton
      android:id="@+id/layoutTile"
      style="@style/Widget.Material3.Button.OutlinedButton"
      android:text="@string/layout_tile" />

  <com.google.android.material.button.MaterialButton
      android:id="@+id/layoutSidebar"
      style="@style/Widget.Material3.Button.OutlinedButton"
      android:text="@string/layout_sidebar" />

  <com.google.android.material.button.MaterialButton
      android:id="@+id/layoutSpotlight"
      style="@style/Widget.Material3.Button.OutlinedButton"
      android:text="@string/layout_spotlight" />
</com.google.android.material.button.MaterialButtonToggleGroup>
```

---

## Wire-up in Activity

```kotlin
binding.layoutToggle.addOnButtonCheckedListener { _, checkedId, isChecked ->
  if (!isChecked) return@addOnButtonCheckedListener

  val layout = when (checkedId) {
    R.id.layoutTile -> CometChatCallsConstants.LAYOUT_TILE
    R.id.layoutSidebar -> CometChatCallsConstants.LAYOUT_SIDEBAR
    R.id.layoutSpotlight -> CometChatCallsConstants.LAYOUT_SPOTLIGHT
    else -> return@addOnButtonCheckedListener
  }
  CometChatCalls.setLayout(layout)
}

// Sync from kit's switcher
override fun onCallLayoutChanged(layout: String) {
  runOnUiThread {
    val id = when (layout) {
      CometChatCallsConstants.LAYOUT_TILE -> R.id.layoutTile
      CometChatCallsConstants.LAYOUT_SIDEBAR -> R.id.layoutSidebar
      CometChatCallsConstants.LAYOUT_SPOTLIGHT -> R.id.layoutSpotlight
      else -> return@runOnUiThread
    }
    binding.layoutToggle.check(id)
  }
}
```

---

## Anti-patterns

Web sister rules apply, plus Android-specific:

1. **`Spinner` instead of `MaterialButtonToggleGroup`.** Spinner hides options; toggle group is the radio-group native pattern in Material.
2. **`onCheckedChange` without `isChecked` guard.** Fires twice (once for unchecked, once for checked) — spurious `setLayout` calls.
3. **Forgetting `runOnUiThread` in the listener.** Crash on view updates from background thread.

---

## Verification checklist

- [ ] Initial layout via `setLayout` on builder
- [ ] `MaterialButtonToggleGroup` with `singleSelection="true"`
- [ ] `addOnButtonCheckedListener` guards on `isChecked`
- [ ] `onCallLayoutChanged` updates toggle group on UI thread
- [ ] Real-device smoke: switcher cycles all 3, kit's switcher syncs custom UI

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — sister
- `cometchat-android-v5-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/android/call-layouts
