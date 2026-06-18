# Call layouts on iOS

The iOS Calls SDK v5 exposes layout via the `DisplayModes` enum (swiftinterface:175 — `.default` / `.single` / `.spotlight`), passed ONCE at session start via `CallSettingsBuilder.setMode(_:)`. The current setter is `setMode(_ value: DisplayModes) -> Self` (swiftinterface:281); the `setMode(_ value: NSString)` string overload (swiftinterface:280) is DEPRECATED — prefer the typed enum. There is no `CallLayout` type, no runtime `setLayout`, no `setHideChangeLayoutButton`, and no `onCallLayoutChanged` callback. To change layout you must end and restart the session with a different `setMode`.

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/call-layouts

---

## SDK API

```swift
import CometChatCallsSDK

let settings = CallSettingsBuilder()
  .setIsAudioOnly(false)
  .setMode(.default)         // swiftinterface:281 setMode(_ value: DisplayModes) -> Self
  .build()
```

`setMode` takes a `DisplayModes` value:

| Value | Meaning |
|---|---|
| `.default` | Standard grid of participant tiles |
| `.single` | One participant fills the surface |
| `.spotlight` | Active speaker enlarged, others as a strip |

> **There is no runtime layout switch.** `CometChatCalls` has no `setLayout`/`setMode` instance/static method that re-lays-out a live session. `setMode(_:)` exists only on `CallSettingsBuilder` and only takes effect at `startSession`. If you need to offer a switcher, tear down and restart the session with new settings (expensive — most apps just pick one mode).

---

## Picking a layout at session start

```swift
// Read a persisted preference and map it to a DisplayModes value before startSession:
let stored = UserDefaults.standard.string(forKey: "preferredDisplayMode") ?? "default"
let mode: DisplayModes = {
  switch stored {
  case "single":    return .single
  case "spotlight": return .spotlight
  default:          return .default
  }
}()
let settings = CallSettingsBuilder()
  .setMode(mode)
  .build()
// ... generateToken → startSession(callToken:callSetting:view:) ...
```

A SwiftUI `Picker(.segmented)` over the three modes is a fine way to capture the preference BEFORE the call starts (on a pre-join screen). It cannot drive a live re-layout.

---

## Anti-patterns

1. **`CallLayout` / `.tile` / `.sidebar`.** Don't exist on iOS v5. `setMode` takes a `DisplayModes` value (`.default`/`.single`/`.spotlight`, swiftinterface:175). The deprecated `setMode(_ value: NSString)` string overload still exists but prefer the typed enum.
2. **`CometChatCalls.setLayout(...)` mid-call.** No such method. Layout is fixed at `startSession`.
3. **Implementing `onCallLayoutChanged` on the delegate.** Not a callback on `CallsEventsDelegate`. There is no layout-change event.
4. **`setHideChangeLayoutButton(_:)`.** Not a `CallSettingsBuilder` method.

---

## Verification checklist

- [ ] Layout set via `CallSettingsBuilder.setMode(_:)` with a `DisplayModes` value (`.default`/`.single`/`.spotlight`)
- [ ] No `CallLayout`, `.tile`, `.sidebar`, `setLayout`, `onCallLayoutChanged`, or `setHideChangeLayoutButton` anywhere
- [ ] Any preference UI captured BEFORE `startSession` (no live switch attempted)
- [ ] User preference persisted via `UserDefaults` if desired

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — sister (web exposes more layout control)
- `cometchat-ios-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/ios/call-layouts
