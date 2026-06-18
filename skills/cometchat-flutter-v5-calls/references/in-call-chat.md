# In-call chat on Flutter V5 (GetX)

Same SDK shape. Flutter-specific: `showModalBottomSheet` with `isScrollControlled: true` for the panel + `MediaQuery.viewInsets` for keyboard handling.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/in-call-chat
**Read first:** `cometchat-react-calls/references/in-call-chat.md` — group-as-session architecture.

---

## SDK API

```dart
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

// Wire chat button visibility via the (non-deprecated) SessionSettingsBuilder
final settings = (SessionSettingsBuilder()
      ..hideChatButton(false))   // session_settings.dart:299
    .build();

// The chat-button tap arrives on ButtonClickListeners (src/listener/button_click_listeners.dart:34),
// registered via CallSession.getInstance()?.addButtonClickListener(...) (call_session.dart:90):
@override
void onChatButtonClicked() {
  Get.find<CallController>().openChat();
}

// Unread badge — INSTANCE method on the session singleton (call_session.dart:489):
CallSession.getInstance()?.setChatButtonUnreadCount(5);
```

---

## Group-as-session helper

```dart
Future<Group> ensureCallGroup(String sessionId) async {
  try {
    return await CometChatGroups.getGroup(sessionId);
  } catch (_) {
    final group = Group(
      guid: sessionId,
      name: 'Call $sessionId',
      type: GroupTypeConstants.public,
    );
    return await CometChatGroups.createGroup(group);
  }
}
```

---

## Modal bottom sheet panel

```dart
class CallController extends GetxController {
  final unread = 0.obs;
  Group? group;

  Future<void> initChat(String sessionId) async {
    group = await ensureCallGroup(sessionId);
    // Track unread...
  }

  void openChat() {
    if (group == null) return;
    Get.bottomSheet(
      InCallChatPanel(group: group!),
      isScrollControlled: true,           // allow full-height
      barrierColor: Colors.transparent,   // call view stays visible
      enableDrag: true,
    );
    unread.value = 0;
    CallSession.getInstance()?.setChatButtonUnreadCount(0);
  }
}

class InCallChatPanel extends StatelessWidget {
  final Group group;
  const InCallChatPanel({super.key, required this.group});

  @override
  Widget build(BuildContext context) {
    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboardHeight),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.7,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          children: [
            const ListTile(title: Text('Chat')),
            Expanded(child: CometChatMessageList(group: group)),
            CometChatMessageComposer(group: group),
          ],
        ),
      ),
    );
  }
}
```

`MediaQuery.viewInsets.bottom` accounts for keyboard height; the sheet pushes up correctly when typing.

---

## Anti-patterns

Web sister rules apply, plus Flutter-specific:

1. **`Get.bottomSheet` without `isScrollControlled: true`.** Sheet capped at half-screen, can't expand for full chat.
2. **`barrierColor: Colors.black54`.** Default dim; call view obscured. Use `Colors.transparent` for in-call.
3. **`Expanded` direct children of `Column` without considering composer height.** Padding via `MediaQuery.viewInsets` handles it cleanly.

---

## Verification checklist

- [ ] `SessionSettingsBuilder()..hideChatButton(false)`
- [ ] `onChatButtonClicked` (ButtonClickListeners, registered on `CallSession.getInstance()`) opens bottom sheet
- [ ] `Get.bottomSheet` uses `isScrollControlled: true` + transparent barrier
- [ ] `MediaQuery.viewInsets.bottom` padding for keyboard
- [ ] Group resolved before opening sheet
- [ ] Real-device smoke: keyboard opens during chat, sheet adjusts

---

## Pointers

- `cometchat-react-calls/references/in-call-chat.md` — sister
- `cometchat-flutter-v5-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/in-call-chat
