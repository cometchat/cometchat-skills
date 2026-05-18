# Call layouts on Flutter V6 (Bloc)

Same SDK shape; Bloc-driven layout state.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/call-layouts
**Read first:** `cometchat-flutter-v5-calls/references/call-layouts.md` — SegmentedButton pattern + SDK API.

---

## Cubit (single-state, no events overhead)

A layout switcher is a great fit for a Cubit since it has only one piece of state with simple updates.

```dart
class CallLayoutCubit extends Cubit<CallLayout> {
  CallLayoutCubit() : super(CallLayout.tile);

  void set(CallLayout next) {
    CometChatCalls.setLayout(next);
    emit(next);
  }

  void onSDKChanged(CallLayout next) {
    emit(next);  // already changed by kit's switcher; just sync
  }
}
```

Hook the SDK event:

```dart
@override
void onCallLayoutChanged(CallLayout layout) {
  context.read<CallLayoutCubit>().onSDKChanged(layout);
}
```

---

## Switcher widget

```dart
class LayoutSwitcher extends StatelessWidget {
  const LayoutSwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CallLayoutCubit, CallLayout>(
      builder: (context, layout) => SegmentedButton<CallLayout>(
        segments: const [
          ButtonSegment(value: CallLayout.tile, label: Text('Tile')),
          ButtonSegment(value: CallLayout.sidebar, label: Text('Sidebar')),
          ButtonSegment(value: CallLayout.spotlight, label: Text('Spotlight')),
        ],
        selected: {layout},
        onSelectionChanged: (set) {
          if (set.isNotEmpty) {
            context.read<CallLayoutCubit>().set(set.first);
          }
        },
      ),
    );
  }
}
```

---

## Provide the cubit at call start

```dart
BlocProvider<CallLayoutCubit>(
  create: (_) => CallLayoutCubit(),
  child: const CallScreen(),
);
```

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **Using a full Bloc when Cubit fits.** Layout switcher is one-state-update — Cubit avoids the events boilerplate.
2. **`BlocListener` for switcher rebuild.** Use `BlocBuilder` — switcher *is* a UI that depends on state, not a side-effect.

---

## Verification checklist

- [ ] `CallLayoutCubit` provided above the call screen
- [ ] `BlocBuilder` wraps the switcher
- [ ] `onCallLayoutChanged` syncs the cubit
- [ ] Real-device smoke: switcher cycles all 3 on Android + iOS

---

## Pointers

- `cometchat-flutter-v5-calls/references/call-layouts.md` — V5 sister (GetX)
- `cometchat-flutter-v6-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/call-layouts
