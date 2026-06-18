# Call layouts on Android V5 (Views)

Same three layouts (TILE/SIDEBAR/SPOTLIGHT). Android V5 uses Java/Kotlin builders + `MaterialButtonToggleGroup` for the switcher (Material Components for Android).

**Canonical docs:** https://www.cometchat.com/docs/calls/android/call-layouts
**Read first:** `cometchat-react-calls/references/call-layouts.md` — layout matrix + when to lock.

---

## SDK API

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.listeners.LayoutListener
import com.cometchat.calls.model.SessionType
import com.cometchat.calls.model.LayoutType

val settings = CometChatCalls.SessionSettingsBuilder()
  .setSessionType(SessionType.VIDEO)
  .setLayout(LayoutType.TILE)        // TILE | SIDEBAR | SPOTLIGHT
  .hideChangeLayoutButton(false)
  .build()

// There is no static mid-call setter in v5. Layout is set at join via
// SessionSettingsBuilder.setLayout(...); to change it mid-call, re-join the
// session with a new SessionSettingsBuilder. Layout CHANGES are observed
// via LayoutListener.onCallLayoutChanged(layoutType) — register on the
// CallSession instance returned from joinSession's onSuccess callback.
callSession.addLayoutListener(this, object : LayoutListener() {
  override fun onCallLayoutChanged(layoutType: LayoutType) {
    activity.runOnUiThread {
      // Update segmented button state
    }
  }
})
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
    R.id.layoutTile -> LayoutType.TILE
    R.id.layoutSidebar -> LayoutType.SIDEBAR
    R.id.layoutSpotlight -> LayoutType.SPOTLIGHT
    else -> return@addOnButtonCheckedListener
  }
  // v5 has no static mid-call setter — re-join the session with new settings
  // to apply the chosen layout.
  val settings = CometChatCalls.SessionSettingsBuilder()
    .setSessionType(SessionType.VIDEO)
    .setLayout(layout)
    .build()
  // CometChatCalls.joinSession(sessionId, callToken, settings, ...) — see join-session.md
}

// Sync from kit's switcher — observed via LayoutListener.onCallLayoutChanged
override fun onCallLayoutChanged(layoutType: LayoutType) {
  runOnUiThread {
    val id = when (layoutType) {
      LayoutType.TILE -> R.id.layoutTile
      LayoutType.SIDEBAR -> R.id.layoutSidebar
      LayoutType.SPOTLIGHT -> R.id.layoutSpotlight
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

- [ ] Initial layout via `setLayout(LayoutType.X)` on `SessionSettingsBuilder`
- [ ] `MaterialButtonToggleGroup` with `singleSelection="true"`
- [ ] `addOnButtonCheckedListener` guards on `isChecked`
- [ ] `onCallLayoutChanged` updates toggle group on UI thread
- [ ] Real-device smoke: switcher cycles all 3, kit's switcher syncs custom UI

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — sister
- `cometchat-android-v5-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/android/call-layouts
