# Call layouts on iOS

Same three layouts (TILE/SIDEBAR/SPOTLIGHT). iOS-specific: `UISegmentedControl` is the native pattern for the switcher; layout selection persists across the app via `UserDefaults`.

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/call-layouts
**Read first:** `cometchat-react-calls/references/call-layouts.md` — layout matrix.

---

## SDK API

```swift
import CometChatCallsSDK

let settings = CallSettingsBuilder()
  .setSessionType(.video)
  .setLayout(.tile)        // .tile | .sidebar | .spotlight
  .setHideChangeLayoutButton(false)
  .build()

// Mid-call switch
CometChatCalls.setLayout(.spotlight)

// Listen
class CallEvents: CometChatCallsEventsListener {
  func onCallLayoutChanged(layout: CallLayout) {
    DispatchQueue.main.async {
      // Update UI
    }
  }
}
```

---

## SwiftUI switcher

```swift
import SwiftUI

enum CallLayoutPicker: String, CaseIterable, Identifiable {
  case tile = "Tile"
  case sidebar = "Sidebar"
  case spotlight = "Spotlight"
  var id: String { rawValue }

  var sdkLayout: CallLayout {
    switch self {
    case .tile: return .tile
    case .sidebar: return .sidebar
    case .spotlight: return .spotlight
    }
  }
}

struct LayoutSwitcher: View {
  @State private var selection: CallLayoutPicker = .tile

  var body: some View {
    Picker("Layout", selection: $selection) {
      ForEach(CallLayoutPicker.allCases) { opt in
        Text(opt.rawValue).tag(opt)
      }
    }
    .pickerStyle(.segmented)
    .accessibilityLabel("Call layout")
    .onChange(of: selection) { _, new in
      CometChatCalls.setLayout(new.sdkLayout)
    }
  }
}
```

`Picker(.segmented)` renders as `UISegmentedControl`, which is the iOS-native expected pattern for radio-group selection.

---

## Persisting the user's preference

```swift
extension UserDefaults {
  var preferredCallLayout: CallLayout {
    get {
      switch string(forKey: "preferredCallLayout") {
      case "sidebar": return .sidebar
      case "spotlight": return .spotlight
      default: return .tile
      }
    }
    set {
      let str: String = {
        switch newValue {
        case .tile: return "tile"
        case .sidebar: return "sidebar"
        case .spotlight: return "spotlight"
        @unknown default: return "tile"
        }
      }()
      set(str, forKey: "preferredCallLayout")
    }
  }
}

// In your CallViewController:
let settings = CallSettingsBuilder()
  .setLayout(UserDefaults.standard.preferredCallLayout)
  .build()
```

---

## Anti-patterns

Web sister rules apply, plus iOS-specific:

1. **`Picker(.menu)` instead of `.segmented`.** Wrong UX — menu hides the options, segmented shows them. For 3 options, segmented is the iOS norm.
2. **`onChange` on background queue.** Crash. SwiftUI's `onChange` is on main but if you bridge through Combine make sure to `.receive(on: DispatchQueue.main)`.
3. **Forgetting to `.accessibilityLabel`.** VoiceOver announces "Picker" with no context.

---

## Verification checklist

- [ ] Initial layout via `setLayout` on builder
- [ ] SwiftUI `Picker(.segmented)` for switcher
- [ ] Layout listener implemented in `CometChatCallsEventsListener`
- [ ] User preference persisted via `UserDefaults` if desired
- [ ] Real-device smoke: switcher cycles all 3, persists across calls

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — sister
- `cometchat-ios-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/ios/call-layouts
