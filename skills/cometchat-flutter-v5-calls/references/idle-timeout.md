# Idle timeout on Flutter V5 (GetX-based)

Same SDK API. Flutter-specific: `CallSettingsBuilder` setter API + `showDialog` / overlay for the prompt.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/idle-timeout
**Read first:** `cometchat-react-calls/references/idle-timeout.md` — settings + archetype timeouts.

---

## SDK API

```dart
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

final settings = CallSettingsBuilder()
  ..setIdleTimeoutPeriodBeforePrompt = 60000
  ..setIdleTimeoutPeriodAfterPrompt = 120000;
final builtSettings = settings.build();
```

Listener — implement on the GetX controller (cf. `references/raise-hand.md`):

```dart
class CallController extends GetxController implements CometChatCallsEventsListener {
  @override
  void onSessionTimedOut() {
    Get.snackbar('Call ended', 'You were inactive for too long');
    Get.until((route) => route.isFirst);  // pop to home
  }
  // ... other handlers
}
```

---

## Custom prompt — showDialog

```dart
Future<void> showIdleTimeoutPrompt(BuildContext context) async {
  final result = await showDialog<String>(
    context: context,
    barrierDismissible: false,  // prevent tap-outside dismiss
    builder: (ctx) => AlertDialog(
      title: const Text('Still there?'),
      content: const Text("You're alone in this call. It'll end in 60 seconds."),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, 'end'),
          child: const Text('End now', style: TextStyle(color: Colors.red)),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, 'stay'),
          child: const Text('Stay'),
        ),
      ],
    ),
  );

  if (result == 'end') {
    // CometChatCalls.endSession() does NOT exist on Flutter — use the CallSession instance.
    await CallSession.getInstance().leaveSession();
  } else {
    // 'stay' or null — reset custom timer
  }
}
```

`barrierDismissible: false` prevents accidental dismiss; user must explicitly pick.

---

## Anti-patterns

Web sister rules apply, plus Flutter-specific:

1. **`Get.dialog` from inside a non-context method** without a captured BuildContext. Dialog opens but has no theme/context — looks broken.
2. **`Navigator.pop` with no result.** Subsequent code can't differentiate stay vs end. Always pass result.
3. **Showing prompt while ongoing-call view is being disposed.** Race condition. Check `mounted` before showing.

---

## Verification checklist

- [ ] CallSettingsBuilder sets both idle periods
- [ ] `onSessionTimedOut` snackbar + nav cleanup
- [ ] Dialog `barrierDismissible: false`
- [ ] `mounted` check before showing prompt
- [ ] Real-device smoke: 2 devices, hangup one → prompt fires + nav home after timeout

---

## Pointers

- `cometchat-react-calls/references/idle-timeout.md` — sister reference
- `cometchat-flutter-v5-calls` SKILL.md
- `cometchat-flutter-v5-calls/references/raise-hand.md` — sibling V5 GetX pattern
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/idle-timeout
