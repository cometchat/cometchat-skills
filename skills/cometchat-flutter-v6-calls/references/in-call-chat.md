# In-call chat on Flutter V6 (Bloc)

Same SDK shape; Bloc-driven open/unread state.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/in-call-chat
**Read first:** `cometchat-flutter-v5-calls/references/in-call-chat.md` — sheet pattern + group-as-session helper.

---

## State + bloc

```dart
class InCallChatState extends Equatable {
  final bool open;
  final int unread;
  final Group? group;
  const InCallChatState({this.open = false, this.unread = 0, this.group});
  InCallChatState copyWith({bool? open, int? unread, Group? group}) =>
    InCallChatState(open: open ?? this.open, unread: unread ?? this.unread, group: group ?? this.group);
  @override List<Object?> get props => [open, unread, group?.guid];
}

abstract class InCallChatEvent {}
class InitChat extends InCallChatEvent { final String sessionId; InitChat(this.sessionId); }
class OpenChat extends InCallChatEvent {}
class CloseChat extends InCallChatEvent {}
class _MessageReceived extends InCallChatEvent {}

class InCallChatBloc extends Bloc<InCallChatEvent, InCallChatState> {
  InCallChatBloc() : super(const InCallChatState()) {
    on<InitChat>(_onInit);
    on<OpenChat>(_onOpen);
    on<CloseChat>(_onClose);
    on<_MessageReceived>(_onReceived);
  }

  Future<void> _onInit(InitChat event, Emitter<InCallChatState> emit) async {
    final group = await ensureCallGroup(event.sessionId);
    emit(state.copyWith(group: group));
  }

  void _onOpen(OpenChat event, Emitter<InCallChatState> emit) {
    emit(state.copyWith(open: true, unread: 0));
    // setChatButtonUnreadCount is an instance method on CallSession
    // (cometchat_calls_sdk-5.0.2 src/call_session.dart:489), not static.
    CallSession.getInstance()?.setChatButtonUnreadCount(0);
  }

  void _onClose(OpenChat event, Emitter<InCallChatState> emit) {
    emit(state.copyWith(open: false));
  }

  void _onReceived(_MessageReceived event, Emitter<InCallChatState> emit) {
    if (state.open) return;
    final next = state.unread + 1;
    emit(state.copyWith(unread: next));
    CallSession.getInstance()?.setChatButtonUnreadCount(next);
  }
}
```

---

## Triggering open from SDK event

`onChatButtonClicked()` is on `ButtonClickListeners` (v5 split listener), registered via `CallSession.getInstance()?.addButtonClickListener(...)` — NOT the deprecated `CometChatCallsEventsListener`:

```dart
// class ... implements ButtonClickListeners
@override
void onChatButtonClicked() {
  context.read<InCallChatBloc>().add(OpenChat());
}
```

---

## Sheet UI

Same `showModalBottomSheet` shape as V5. Use `BlocSelector` to react to `state.open`:

```dart
BlocListener<InCallChatBloc, InCallChatState>(
  listenWhen: (prev, curr) => !prev.open && curr.open,
  listener: (context, state) {
    if (state.group == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      barrierColor: Colors.transparent,
      builder: (_) => InCallChatPanel(group: state.group!),
    ).whenComplete(() {
      context.read<InCallChatBloc>().add(CloseChat());
    });
  },
  child: /* call surface */,
)
```

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **`BlocBuilder` instead of `BlocListener` for opening the sheet.** BlocBuilder is for rebuilding UI; sheet-open is a one-shot side effect → BlocListener.
2. **`listenWhen` omitted.** Sheet opens on every state change.

---

## Verification checklist

- [ ] InCallChatBloc with `InitChat`, `OpenChat`, `CloseChat`, `_MessageReceived` events
- [ ] BlocListener with `listenWhen` for the open transition
- [ ] `showModalBottomSheet.whenComplete` dispatches `CloseChat`
- [ ] Real-device smoke: same as V5

---

## Pointers

- `cometchat-flutter-v5-calls/references/in-call-chat.md` — V5 sister (sheet pattern)
- `cometchat-flutter-v6-calls` SKILL.md
- `cometchat-flutter-v6-calls/references/raise-hand.md` — Bloc bridge sibling
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/in-call-chat
