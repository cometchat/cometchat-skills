# Call session — joinSession, no ringing (Flutter V5 / GetX, 5.x Calls SDK)

Server-generated sessionId, both parties enter it. Built on the **5.x** Calls SDK (`cometchat_calls_sdk ^5.0.2`) added as a **direct** dependency (NOT pulled via `cometchat_calls_uikit`, which would bring 4.x). This is the canonical SDK API surface for all the V5 calls references.

**Read first:** `cometchat-react-calls/references/call-session.md` — full architecture (sessionId strategies, server-side authorization, token generation). Then come back here for the Flutter-specific shape.

> **5.x SHAPE.** Lifecycle is **static on `CometChatCalls`** (`init`/`login`/`loginWithAuthToken`/`generateCallToken`/`joinSession`/`getLoggedInUser` — `src/plugin/cometchatcalls.dart`). In-call controls are **instance methods on the `CallSession` singleton** via `CallSession.getInstance()` (`src/call_session.dart`). Settings use `SessionSettingsBuilder` (`src/builder/session_settings.dart`). Events arrive through the **5 split listeners** in `src/listener/`. Substrate of record: `~/.pub-cache/hosted/pub.dev/cometchat_calls_sdk-5.0.2/lib/`.

---

## Hard rules (Flutter-specific overrides on top of the cross-platform rules)

1. **One step: `joinSession({sessionId:, sessionSettings:, onSuccess:, onError:})`** (`cometchatcalls.dart:735`). Provide EITHER `sessionId:` (the SDK mints the call token internally using the cached auth token) OR a pre-minted `callToken:` — not both. `onSuccess` hands back a `Widget?` you render. There is no `generateToken` + `startSession` two-step in the primary 5.x path (those are `@Deprecated` v4-compat shims, `cometchatcalls.dart:449,621`).
2. **`SessionSettingsBuilder` is the settings shape** (`builder/session_settings.dart:126`). e.g. `(SessionSettingsBuilder()..setTitle('Meeting')..startAudioMuted(false)..startVideoPaused(false)).build()`. `CallSettingsBuilder` is `@Deprecated` (`builder/call_settings.dart:209`).
3. **Implement the split listeners and register them on `CallSession.getInstance()`** inside `joinSession`'s `onSuccess` (the singleton is non-null only after the session is created). `SessionStatusListeners` (`addSessionStatusListener`, `call_session.dart:66`) carries `onSessionJoined`/`onSessionLeft`/`onConnectionClosed`/`onSessionTimedOut`/`onConnectionLost`/`onConnectionRestored`. Remove via `removeSessionStatusListener` in `dispose`. Do NOT use the single `CometChatCallsEventsListener` (`@Deprecated`).
4. **`CometChatOngoingCallService.launch()` + `.abort()`** (`services/ongoing_call_service.dart:33,51`) manage the platform foreground service. `launch()` after the session starts; `abort()` inside the guarded `_navigateBack()` helper (fires exactly once on the first termination event).
5. **Render the returned widget with `SizedBox.expand(child: videoWidget)`.** Anything that constrains it (Padding, undersized Container) clips the call UI.
6. **Log the Calls SDK in before joining.** `joinSession`/`generateCallToken` use the cached auth token from `CometChatCalls.loginWithAuthToken(...)` (or `CometChatCalls.login(...)`). Source that token with the static `await CometChat.getUserAuthToken()` (there is no `User.getAuthToken()` instance method).

---

## Dependencies

```yaml
dependencies:
  cometchat_calls_sdk: ^5.0.2
  cometchat_chat_sdk: ^4.0.0   # signaling + source of the auth token
  permission_handler: ^11.0.0
  uni_links: ^0.5.1
```

---

## Call screen (StatefulWidget + SessionStatusListeners)

```dart
import 'package:cometchat_calls_sdk/cometchat_calls_sdk.dart';
import 'package:cometchat_sdk/cometchat_sdk.dart';
import 'package:flutter/material.dart';

class CallScreen extends StatefulWidget {
  const CallScreen({super.key, required this.sessionId});
  final String sessionId;

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen>
    implements SessionStatusListeners {
  Widget? _videoContainer;
  bool _isLoading = true;
  bool _hasError = false;
  String? _errorMessage;
  bool _isLeavingSession = false;
  CallSession? _session;

  @override
  void initState() {
    super.initState();
    _startCall();
  }

  @override
  void dispose() {
    _session?.removeSessionStatusListener(this);
    CometChatOngoingCallService.abort();
    super.dispose();
  }

  Future<void> _startCall() async {
    // Ensure the Calls SDK is logged in (caches the auth token used below).
    final authToken = await CometChat.getUserAuthToken();
    if (authToken != null) {
      CometChatCalls.loginWithAuthToken(   // cometchatcalls.dart:316
        authToken: authToken,
        onSuccess: (_) => _join(),
        onError: (CometChatCallsException e) => _fail(e.message),
      );
    } else {
      _join(); // already logged in via CometChatCalls.login earlier
    }
  }

  void _join() {
    final settings = (SessionSettingsBuilder()
          ..setTitle('CometChat Meeting')   // session_settings.dart:155
          ..startAudioMuted(false)          // :173
          ..startVideoPaused(false))        // :167
        .build();

    CometChatCalls.joinSession(             // cometchatcalls.dart:735
      sessionId: widget.sessionId,          // SDK mints the call token internally
      sessionSettings: settings,
      onSuccess: (Widget? videoWidget) {
        if (!mounted) return;
        // Register split listeners now that the session exists.
        _session = CallSession.getInstance();          // call_session.dart:36
        _session?.addSessionStatusListener(this);       // :66
        CometChatOngoingCallService.launch();           // ongoing_call_service.dart:33
        setState(() {
          _videoContainer = videoWidget;
          _isLoading = false;
          _hasError = false;
        });
      },
      onError: (CometChatCallsException error) => _fail(error.message),
    );
  }

  void _fail(String? msg) {
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _hasError = true;
      _errorMessage = msg ?? 'Failed to join session';
    });
  }

  void _navigateBack() {
    // ONE guarded path for all termination events (onSessionLeft +
    // onConnectionClosed + onSessionTimedOut). The 5.x SDK fires several in
    // sequence on hangup; without the guard a second pop crashes with
    // `Bad state: No element`.
    if (_isLeavingSession) return;
    if (!mounted) return;
    if (!Navigator.of(context).canPop()) return;
    _isLeavingSession = true;
    CometChatOngoingCallService.abort();
    Navigator.of(context).pop();
  }

  // --- SessionStatusListeners (session_status_listeners.dart) ---

  @override
  void onSessionJoined() {}

  @override
  void onSessionLeft() => _navigateBack();

  @override
  void onConnectionClosed() => _navigateBack();

  @override
  void onSessionTimedOut() => _navigateBack();

  @override
  void onConnectionLost() {}

  @override
  void onConnectionRestored() {}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      resizeToAvoidBottomInset: false,
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

- **Single-step `joinSession`** instead of `generateToken` + `startSession` — the 5.x primary path joins in one call; the call widget arrives via `joinSession`'s `onSuccess`.
- **`SessionSettingsBuilder`** instead of `CallSettingsBuilder` — the latter is `@Deprecated` in 5.0.2.
- **`SessionStatusListeners` registered on `CallSession.getInstance()`** instead of one `CometChatCallsEventsListener` on `CometChatCalls` — 5.x splits events across 5 listeners attached to the session singleton.
- **`CallSession.getInstance()?.leaveSession()`** for teardown (`call_session.dart:272`) — the static `CometChatCalls.endSession` exists (`cometchatcalls.dart:676`) but is `@Deprecated` and just delegates here.
- **`CometChatOngoingCallService.launch()/abort()`** — required for foreground-service correctness on Android 14+.
- **`SizedBox.expand`** — the SDK's returned widget must fill its parent.

---

## Ending the call from a button

```dart
ElevatedButton(
  onPressed: () async {
    await CallSession.getInstance()?.leaveSession();  // call_session.dart:272
    // onSessionLeft then funnels through _navigateBack().
  },
  child: const Text('Leave'),
)
```

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

Runtime request before `_startCall`:
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

1. **Using `CallSettingsBuilder()` / `CallSettings(...)` instead of `SessionSettingsBuilder()`.** `CallSettingsBuilder` is `@Deprecated` in 5.0.2.
2. **`CometChatCalls.startSession` / `generateToken` two-step.** Those are `@Deprecated` v4-compat shims. Use `joinSession` with `sessionId:` (or `callToken:`).
3. **Single `CometChatCallsEventsListener`.** `@Deprecated` in 5.0.2. Use the 5 split listeners on `CallSession.getInstance()`.
4. **Registering listeners before `joinSession.onSuccess`.** `CallSession.getInstance()` is null until the session is created — register inside `onSuccess`.
5. **`CometChatOngoingCallController` / `CometChatOngoingCallView`.** These do not exist in the Calls SDK. Render the `Widget?` from `onSuccess`.
6. **Skipping `CometChatOngoingCallService.abort()` in cleanup paths.** Android foreground-service notification persists after the call ends.
7. **Rendering the returned widget inside a constrained `Container`.** Clips. Use `SizedBox.expand`.
8. **No `mounted` check before `Navigator.pop`.** Async callback fires after dispose → exception.
9. **Popping the navigator from each termination event independently.** Crashes with `Bad state: No element` on the second pop. Funnel all termination events through ONE guarded `_navigateBack()`.

---

## Verification checklist

- [ ] `joinSession(sessionId:, sessionSettings:, onSuccess:, onError:)` — NOT `generateToken`/`startSession`
- [ ] Settings built via `SessionSettingsBuilder()`, not `CallSettingsBuilder` / `CallSettings(...)`
- [ ] `SessionStatusListeners` implemented and registered on `CallSession.getInstance()` inside `onSuccess`; removed in `dispose`
- [ ] Calls SDK logged in (`loginWithAuthToken` / `login`) before `joinSession`
- [ ] Returned widget rendered via `SizedBox.expand(child: _videoContainer)`
- [ ] `CometChatOngoingCallService.launch()` after `onSuccess`; `.abort()` in EVERY termination path
- [ ] `mounted` check before `Navigator.pop`
- [ ] Single guarded `_navigateBack()` handles ALL termination events
- [ ] Teardown uses `CallSession.getInstance()?.leaveSession()`
- [ ] iOS `Info.plist` + Android `AndroidManifest.xml` permissions configured
- [ ] Real-device smoke: tap meeting link → app opens at /meet → joins → video flows → leave → notification clears

---

## Pointers

- `cometchat-react-calls/references/call-session.md` — cross-platform architecture
- `cometchat-flutter-v5-calls/SKILL.md` — Flutter V5 / GetX seven hard rules (5.x Calls SDK)
- `cometchat-flutter-v5-calls/references/share-invite.md` — deep-link config
- `cometchat-flutter-v6-calls/references/call-session.md` — V6 (Bloc) sibling on the SAME 5.0.2 SDK
- Substrate of record: `~/.pub-cache/hosted/pub.dev/cometchat_calls_sdk-5.0.2/lib/src/plugin/cometchatcalls.dart` + `src/call_session.dart`
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/join-session
```