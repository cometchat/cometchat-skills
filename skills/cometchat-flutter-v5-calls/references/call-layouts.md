# Call layouts on Flutter V5 (GetX)

Same three layouts (TILE/SIDEBAR/SPOTLIGHT). Flutter-specific: `SegmentedButton` is the cross-platform native picker (Material 3); GetX wraps the SDK layout in an `Rx` for reactive UI.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/call-layouts
**Read first:** `cometchat-react-calls/references/call-layouts.md` — layout matrix.

---

## SDK API

`setLayout` is an **instance method on the `CallSession` singleton** (`cometchat_calls_sdk-5.0.2` `src/call_session.dart:394`), and the layout enum is `LayoutType { tile, sidebar, spotlight }` (`src/enums/layout_type.dart`) — there is no `CallLayout` type and no static `CometChatCalls.setLayout`.

```dart
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

// Initial layout via the (non-deprecated) SessionSettingsBuilder
final settings = (SessionSettingsBuilder()
      ..setLayout(LayoutType.tile)         // session_settings.dart:179
      ..hideChangeLayoutButton(false))     // :293
    .build();

// Mid-call switch — instance method on the session singleton
CallSession.getInstance()?.setLayout(LayoutType.spotlight);  // call_session.dart:394

// Listen — implement LayoutListeners, attach via the layoutListener setter
// (CallSession.getInstance()?.layoutListener = myLayoutListener; call_session.dart:98).
@override
void onCallLayoutChanged(LayoutType layout) {  // layout_listeners.dart:9
  Get.find<CallLayoutController>().layout.value = layout;
}
```

---

## GetX controller

```dart
class CallLayoutController extends GetxController {
  final layout = LayoutType.tile.obs;

  void set(LayoutType next) {
    CallSession.getInstance()?.setLayout(next);
    layout.value = next;
  }
}
```

---

## SegmentedButton switcher

```dart
class LayoutSwitcher extends StatelessWidget {
  const LayoutSwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<CallLayoutController>();
    return Obx(() => SegmentedButton<LayoutType>(
      segments: const [
        ButtonSegment(value: LayoutType.tile, label: Text('Tile')),
        ButtonSegment(value: LayoutType.sidebar, label: Text('Sidebar')),
        ButtonSegment(value: LayoutType.spotlight, label: Text('Spotlight')),
      ],
      selected: {ctrl.layout.value},
      onSelectionChanged: (set) {
        if (set.isNotEmpty) ctrl.set(set.first);
      },
    ));
  }
}
```

`Obx` rebuilds when `layout` changes; the switcher stays in sync if the kit's switcher fires `onCallLayoutChanged`.

---

## Anti-patterns

Web sister rules apply, plus Flutter-specific:

1. **`DropdownButton` instead of `SegmentedButton`.** Hides the options. `SegmentedButton` is Material 3's radio-group equivalent.
2. **`StatefulWidget` with `setState` instead of GetX `Rx`.** Multiple components (toolbar, header) can't share layout state — GetX `Rx` solves it.
3. **Forgetting `Obx` wrapper.** UI doesn't react to changes from the kit's switcher.

---

## Verification checklist

- [ ] `CallLayoutController` registered (via `Get.put` at call start)
- [ ] `SegmentedButton` wrapped in `Obx`
- [ ] `onCallLayoutChanged` updates the controller
- [ ] Initial layout via `setLayout` on builder
- [ ] Real-device smoke: switcher cycles all 3 on Android + iOS

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — sister
- `cometchat-flutter-v5-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/call-layouts
