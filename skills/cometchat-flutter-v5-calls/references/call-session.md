# Call session — joinSession with no ringing (Flutter V5 / GetX)

Server-generated sessionId, both parties enter it. Customer-validated against `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/cometchat-calls-sample-app-flutter/lib/screens/call_screen.dart`.

**Read first:** `cometchat-react-calls/references/call-session.md` — full architecture (sessionId strategies, server-side authorization, token generation). Then come back here for the Flutter-specific shape.

---

## Hard rules (Flutter-specific overrides on top of the cross-platform rules)

1. **`CometChatCalls.joinSession(sessionId:, sessionSettings:, onSuccess:, onError:)` uses CALLBACKS, not Futures.** `onSuccess` receives a `Widget?` you must render. There is NO controller-based API in the Calls SDK; do not invent one.
2. **`SessionSettingsBuilder` is the canonical settings shape.** `SessionSettingsBuilder().setTitle().startVideoPaused(false).startAudioMuted(false).build()`. NOT `CallSettings(sessionType:, layout:)` — that is a chat-side type. The sample uses the Builder pattern.
3. **Implement `SessionStatusListeners`** for lifecycle events: `onSessionJoined`, `onSessionLeft`, `onConnectionClosed`, `onConnectionLost`, `onConnectionRestored`, `onSessionTimedOut`. Register via `CallSession.getInstance().addSessionStatusListener(this)` AFTER `onSuccess` fires.
3a. **Funnel ALL termination paths through a single guarded `_navigateBack()` helper.** The v5 Calls SDK fires 3 termination listeners in sequence on every hangup: `onLeaveSessionButtonClicked` → `onSessionLeft` → `onConnectionClosed`. If each one pops the navigator independently, the second pop crashes with `Bad state: No element` because the route is already gone. The upstream sample at `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/cometchat-calls-sample-app-flutter/lib/screens/call_screen.dart` has the unguarded multi-pop pattern — it happens to work there because of timing differences but is fragile. **Always use a single guarded helper**:
```dart
bool _isLeavingSession = false;

void _navigateBack() {
  if (_isLeavingSession) return;
  if (!mounted) return;
  if (!Navigator.of(context).canPop()) return;
  _isLeavingSession = true;
  CometChatOngoingCallService.abort();
  Navigator.of(context).pop();
}

@override
void onSessionLeft() => _navigateBack();
@override
void onConnectionClosed() => _navigateBack();
@override
void onSessionTimedOut() => _navigateBack();

@override
void onLeaveSessionButtonClicked() {
  // Trigger the leave; the listener chain calls _navigateBack().
  _callSession?.leaveSession();
}
```
4. **`CometChatOngoingCallService.launch()` + `CometChatOngoingCallService.abort()`** manage the platform foreground service. Call `launch()` after `onSessionJoined`; call `abort()` inside the `_navigateBack()` helper (so it fires exactly once on the first termination event).
5. **Render the returned widget with `SizedBox.expand(child: videoWidget)`.** Anything that constrains the widget (Padding, Container with explicit width/height smaller than viewport) clips the call UI.
6. **For standalone session-only integrations, the Chat SDK is OPTIONAL.** The upstream Flutter sample only uses `cometchat_calls_sdk`. Keep dual-SDK only for additive (chat + calls) integrations.

---

## Dependencies

```yaml
dependencies:
  cometchat_calls_sdk: ^5.0.0
  permission_handler: ^11.0.0
  uni_links: ^0.5.1
```

For standalone session-only, you do NOT need `cometchat_chat_sdk`.

---

## Call screen (StatefulWidget + SessionStatusListeners)

```dart
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';
import 'package:flutter/material.dart';

class CallScreen extends StatefulWidget {
  const CallScreen({super.key, required this.sessionId});
  final String sessionId;

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen>
    implements SessionStatusListeners, ButtonClickListeners {
  Widget? _videoContainer;
  bool _isLoading = true;
  bool _hasError = false;
  String? _errorMessage;
  bool _isLeavingSession = false;
  CallSession? _callSession;

  @override
  void initState() {
    super.initState();
    _joinSession();
  }

  @override
  void dispose() {
    _unregisterListeners();
    CometChatOngoingCallService.abort();
    super.dispose();
  }

  void _joinSession() {
    final sessionSettings = (SessionSettingsBuilder()
          .setTitle('CometChat Meeting')
          .startVideoPaused(false)
          .startAudioMuted(false))
        .build();

    CometChatCalls.joinSession(
      sessionId: widget.sessionId,
      sessionSettings: sessionSettings,
      onSuccess: (Widget? videoWidget) {
        if (!mounted) return;
        setState(() {
          _videoContainer = videoWidget;
          _isLoading = false;
          _hasError = false;
        });
        _registerListeners();
        CometChatOngoingCallService.launch();
      },
      onError: (CometChatCallsException error) {
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _hasError = true;
          _errorMessage = error.message ?? 'Failed to join session';
        });
      },
    );
  }

  void _registerListeners() {
    _callSession = CallSession.getInstance();
    _callSession?.addSessionStatusListener(this);
    _callSession?.addButtonClickListener(this);
  }

  void _unregisterListeners() {
    _callSession?.removeSessionStatusListener(this);
    _callSession?.removeButtonClickListener(this);
  }

  void _navigateBack() {
    // ONE guarded path for all termination events (onSessionLeft +
    // onConnectionClosed + onSessionTimedOut + post-leaveSession).
    // The SDK fires multiple termination listeners in sequence; without
    // this guard, the second pop crashes with `Bad state: No element`.
    if (_isLeavingSession) return;
    if (!mounted) return;
    if (!Navigator.of(context).canPop()) return;
    _isLeavingSession = true;
    CometChatOngoingCallService.abort();
    Navigator.of(context).pop();
  }

  // --- SessionStatusListeners ---

  @override
  void onSessionJoined() {
    CometChatOngoingCallService.launch();
  }

  // All termination events funnel through ONE guarded _navigateBack().
  // SDK fires onSessionLeft + onConnectionClosed in sequence on every
  // hangup; unguarded pops crash with `Bad state: No element`.
  @override
  void onSessionLeft() => _navigateBack();

  @override
  void onConnectionClosed() => _navigateBack();

  @override
  void onSessionTimedOut() => _navigateBack();

  @override
  void onConnectionLost() {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection lost')),
      );
    }
  }

  @override
  void onConnectionRestored() {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection restored')),
      );
    }
  }

  // --- ButtonClickListeners (stub the ones you don't customize) ---

  @override
  void onLeaveSessionButtonClicked() {
    // Trigger leave; the listener chain calls _navigateBack().
    _callSession?.leaveSession();
  }

  @override
  void onChangeLayoutButtonClicked() {}
  @override
  void onChatButtonClicked() {}
  @override
  void onParticipantListButtonClicked() {}
  @override
  void onRaiseHandButtonClicked() {}
  @override
  void onRecordingToggleButtonClicked() {}
  @override
  void onShareInviteButtonClicked() {}
  @override
  void onSwitchCameraButtonClicked() {}
  @override
  void onToggleAudioButtonClicked() {}
  @override
  void onToggleVideoButtonClicked() {}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Colors.deepPurple));
    }
    if (_hasError) {
      return Center(child: Text(_errorMessage ?? 'Error', style: const TextStyle(color: Colors.white)));
    }
    if (_videoContainer != null) {
      return SizedBox.expand(child: _videoContainer);
    }
    return const SizedBox.shrink();
  }
}
```

**Why this shape:**

- **Callback API** (`onSuccess`, `onError`) instead of `Future` — `joinSession` returns void; the widget arrives via `onSuccess`. Awaiting it does nothing useful.
- **`SessionSettingsBuilder`** instead of `CallSettings` — `CallSettings` is the chat-side type for ringing-mode call entities; `SessionSettingsBuilder` is what session-mode actually accepts.
- **`SessionStatusListeners` interface implementation** instead of stream subscriptions — register against `CallSession.getInstance()` after `onSuccess`. Returns nothing; cleanup via `removeSessionStatusListener` in `dispose`.
- **`CometChatOngoingCallService.launch()/abort()`** — required for foreground-service correctness on Android 14+. Without `abort()` the service notification persists after the call ends.
- **`SizedBox.expand`** — the SDK's returned widget must fill its parent. Constraining it (Container with width/height, Padding) clips the call surface.

---

## Permissions (Android `AndroidManifest.xml` + iOS `Info.plist`)

Android:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
```

iOS:
```xml
<key>NSCameraUsageDescription</key>
<string>Camera is needed for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone is needed for calls</string>
```

Runtime request before `_joinSession`:
```dart
await Permission.camera.request();
await Permission.microphone.request();
```

---

## Deep-link routing (uni_links)

```dart
void initDeepLinks() {
  uriLinkStream.listen((Uri? uri) {
    if (uri == null) return;
    if (uri.pathSegments.length >= 2 && uri.pathSegments[0] == 'meet') {
      final sessionId = uri.pathSegments[1];
      Get.toNamed('/meet/$sessionId');
    }
  });
}
```

See `cometchat-flutter-v5-calls/references/share-invite.md` for full deep-link config.

---

## Anti-patterns

1. **Using `CallSettings(sessionType:, layout:)` instead of `SessionSettingsBuilder()`.** `CallSettings` is the chat-side entity type, not the session-mode settings shape. Wrong type → joinSession rejects.
2. **`CometChatOngoingCallController` / `CometChatOngoingCallView`.** These do not exist in the Calls SDK. Prior versions of this skill cited them — they are NOT part of the public Flutter Calls SDK API.
3. **Awaiting `CometChatCalls.joinSession(...)`** as if it returns a `Future<Widget>`. It returns void; widget arrives via `onSuccess`.
4. **Skipping `CometChatOngoingCallService.abort()` in cleanup paths.** Android foreground-service notification persists after the call ends; user sees "Ongoing call" with no way to clear it.
5. **Rendering the returned widget inside a constrained `Container`.** Clips to that size. Use `SizedBox.expand`.
6. **No `mounted` check before `Navigator.pop`.** Async callback fires after dispose → exception.
7. **`StatelessWidget` for the call screen.** Can't track `_isLeavingSession` flag or listener references → double leave / leaked listeners.
8. **Popping the navigator from each termination listener independently.** Crashes with `Bad state: No element` on the second pop because the route is already gone. The SDK fires 3 termination events in sequence (`onLeaveSessionButtonClicked` → `onSessionLeft` → `onConnectionClosed`). Funnel them through ONE guarded `_navigateBack()` helper that checks `_isLeavingSession` + `mounted` + `canPop()`. Customer-found 2026-05-17 (Flutter v5 cohort hangup crash).
8. **Initializing Chat SDK for a session-only integration.** Wastes time and adds two extra failure modes. Drop `CometChat.init` / `CometChat.login` entirely for standalone session apps.

---

## Verification checklist

- [ ] `joinSession` called with `sessionId:`, `sessionSettings:`, `onSuccess:`, `onError:` — NOT `callToken:`, `callSettings:`, `controller:`
- [ ] Settings built via `SessionSettingsBuilder()`, not `CallSettings`
- [ ] `SessionStatusListeners` interface implemented and registered against `CallSession.getInstance()` in `onSuccess`
- [ ] Returned widget rendered via `SizedBox.expand(child: _videoContainer)`
- [ ] `CometChatOngoingCallService.launch()` called after `onSessionJoined`
- [ ] `CometChatOngoingCallService.abort()` called in EVERY termination path (dispose, onSessionLeft, onConnectionClosed, onSessionTimedOut, error)
- [ ] Listeners removed in `dispose` (avoid leaks)
- [ ] `mounted` check before `Navigator.pop`
- [ ] Single guarded `_navigateBack()` helper handles ALL termination events (no per-listener pops)
- [ ] iOS `Info.plist` + Android `AndroidManifest.xml` permissions configured
- [ ] **Standalone session-only:** no `cometchat_chat_sdk` dependency — Calls SDK alone
- [ ] **Additive (chat + calls):** dual-SDK contract preserved (Chat first, then Calls)
- [ ] Real-device smoke: tap meeting link → app opens at /meet → joins → video flows → leave → notification clears

---

## Pointers

- `cometchat-react-calls/references/call-session.md` — cross-platform architecture
- `cometchat-flutter-v5-calls/SKILL.md` — Flutter V5 / GetX seven hard rules
- `cometchat-flutter-v5-calls/references/share-invite.md` — deep-link config
- Upstream Flutter sample — `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/cometchat-calls-sample-app-flutter/lib/screens/call_screen.dart`
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/join-session
