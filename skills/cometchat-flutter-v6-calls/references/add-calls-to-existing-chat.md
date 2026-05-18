# Adding calls to an existing chat integration (Flutter V6 / Bloc)

V6 calls are **bundled** into `cometchat_chat_uikit: ^6.0.0-beta2` — no separate calls package. Toggle on by enabling calling in the UIKit settings.

**Read first:** `cometchat-flutter-v6-calls/SKILL.md` — V6 architecture (Bloc).

---

## Step 1 — Verify chat-uikit cohort

```yaml
# pubspec.yaml
dependencies:
  cometchat_chat_uikit: ^6.0.0-beta2   # V6 — calls bundled
```

If you see `cometchat_calls_uikit` separately listed, you're on V5 cohort — see `cometchat-flutter-v5-calls/references/add-calls-to-existing-chat.md`.

---

## Step 2 — Enable calling on UIKit init

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final settings = UIKitSettingsBuilder()
    ..setAppId(APP_ID)
    ..setRegion(REGION)
    ..enableCalling();         // NEW

  await CometChatUIKit.init(uiKitSettings: settings.build());
  runApp(const MyApp());
}
```

That's the entire migration. Calls init internally when chat init succeeds.

---

## Step 3 — iOS + Android native config

Same as V5 (see V5 sister doc) — Info.plist + permissions + ConnectionService don't change between cohorts.

---

## Step 4 — Mount CometChatIncomingCall

```dart
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Stack(
        children: [
          BlocProvider(
            create: (_) => AuthBloc()..add(LoginRequested()),
            child: const AppRoot(),
          ),
          const CometChatIncomingCall(),
        ],
      ),
    );
  }
}
```

---

## Step 5 — Bloc-wrapped login + push registration

```dart
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({required this.api}) : super(const AuthState.initial()) {
    on<LoginRequested>(_onLogin);
  }

  Future<void> _onLogin(LoginRequested event, Emitter<AuthState> emit) async {
    try {
      final user = await CometChatUIKit.login(uid: event.uid, authKey: AUTH_KEY);
      // No separate CometChatCalls.login in V6 — bundled
      emit(AuthState.authenticated(user));

      // Register VoIP push tokens after login
      await context.read<CallPushBloc>().add(RegisterTokens(uid: user.uid));
    } catch (e) {
      emit(AuthState.failed(e.toString()));
    }
  }
}
```

(See `cometchat-flutter-v6-calls/references/server-push-bridge.md` for the CallPushBloc pattern.)

---

## Step 6 — Hangup teardown via Bloc

```dart
class CallBloc extends Bloc<CallEvent, CallState> {
  CallBloc() : super(const CallState.idle()) {
    on<EndCall>(_onEndCall);
  }

  Future<void> _onEndCall(EndCall event, Emitter<CallState> emit) async {
    CometChatCalls.leaveSession();
    await CometChat.endCall(event.sessionId);
    // V6's bundled flow: no additional FlutterCallkitIncoming step;
    // the kit handles it
    emit(const CallState.ended());
  }
}
```

---

## Verification checklist

- [ ] `cometchat_chat_uikit: ^6.0.0-beta2` (or higher V6) in pubspec
- [ ] `..enableCalling()` chained in UIKitSettingsBuilder
- [ ] Native config (iOS + Android) same as V5
- [ ] `CometChatIncomingCall` sibling-overlay at root
- [ ] VoIP push registration via CallPushBloc post-login
- [ ] Run `cometchat verify --calls` — should pass

---

## Pointers

- `cometchat-flutter-v5-calls/references/add-calls-to-existing-chat.md` — V5 sister (separate calls package)
- `cometchat-flutter-v6-calls/SKILL.md` — V6 Bloc patterns
- `cometchat-flutter-v6-calls/references/server-push-bridge.md`
