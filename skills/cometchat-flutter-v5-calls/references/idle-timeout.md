# Idle timeout on Flutter V5 (GetX-based, 5.x Calls SDK)

Flutter-specific: `SessionSettingsBuilder` setter API + `showDialog` / overlay for the prompt.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/idle-timeout
**Read first:** `cometchat-react-calls/references/idle-timeout.md` — settings + archetype timeouts.

---

## SDK API

In 5.x the idle period is a single value (in **seconds**) on `SessionSettingsBuilder` — `setIdleTimeoutPeriod(int timeoutSeconds)` (`cometchat_calls_sdk-5.0.2` `src/builder/session_settings.dart:185`). There is no separate before/after-prompt split.

```dart
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';

final settings = (SessionSettingsBuilder()
      ..setIdleTimeoutPeriod(180))   // seconds — session_settings.dart:185
    .build();
```

Listener — implement `SessionStatusListeners` on the GetX controller (cf. `references/raise-hand.md`); `onSessionTimedOut` is `src/listener/session_status_listeners.dart:22`:

```dart
class CallController extends GetxController implements SessionStatusListeners {
  @override
  void onSessionTimedOut() {
    Get.snackbar('Call ended', 'You were inactive for too long');
    Get.until((route) => route.isFirst);  // pop to home
  }
  // ... other SessionStatusListeners handlers (no-ops or pass-through)
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
    // 5.x teardown: the CallSession INSTANCE leaveSession() (call_session.dart:272).
    // The static CometChatCalls.endSession exists but is @Deprecated.
    await CallSession.getInstance()?.leaveSession();
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

- [ ] `SessionSettingsBuilder()..setIdleTimeoutPeriod(seconds)` (single value, in seconds)
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
