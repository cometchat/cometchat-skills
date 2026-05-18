# Server-side push routing for Flutter V6 (iOS PushKit + Android FCM)

V6 uses the same server templates and platform plugins as V5. The only V6-specific delta is wrapping token registration in a Bloc.

**Canonical docs:**
- iOS: `cometchat-ios-calls/references/server-apns-pushkit.md`
- Android: `cometchat-android-v5-calls/references/server-fcm-voip.md`
- Read first: `cometchat-flutter-v5-calls/references/server-push-bridge.md` — Flutter token registration patterns.

---

## Bloc-style token registration

```dart
class CallPushBloc extends Bloc<CallPushEvent, CallPushState> {
  CallPushBloc({required this.api}) : super(const CallPushState.idle()) {
    on<RegisterTokens>(_onRegister);
  }
  final Api api;

  Future<void> _onRegister(RegisterTokens event, Emitter<CallPushState> emit) async {
    emit(const CallPushState.registering());
    try {
      if (Platform.isIOS) {
        final voip = FlutterVoipPushKit();
        voip.onTokenRefresh.listen((token) {
          api.registerCallToken(uid: event.uid, platform: 'ios-voip', token: token);
        });
        await voip.configure();
      } else if (Platform.isAndroid) {
        final messaging = FirebaseMessaging.instance;
        await messaging.requestPermission();
        final token = await messaging.getToken();
        if (token != null) {
          await api.registerCallToken(uid: event.uid, platform: 'android-fcm', token: token);
        }
        messaging.onTokenRefresh.listen((t) {
          api.registerCallToken(uid: event.uid, platform: 'android-fcm', token: t);
        });
      }
      emit(const CallPushState.registered());
    } catch (err) {
      emit(CallPushState.failed(err.toString()));
    }
  }
}
```

Dispatch after login completes:

```dart
BlocListener<AuthBloc, AuthState>(
  listener: (context, state) {
    if (state is Authenticated) {
      context.read<CallPushBloc>().add(RegisterTokens(uid: state.uid));
    }
  },
  child: const CallSurface(),
);
```

---

## Server-side: unchanged from V5

Identical to V5 — same APNs PushKit + FCM HTTP v1 templates.

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **Registering pushes in `main()` before MultiBlocProvider.** No bloc available; can't dispatch.
2. **Adding `RegisterTokens` from `BlocBuilder`.** BlocBuilder is for UI rebuilds. Use `BlocListener` for one-shot side effects.

---

## Verification checklist

- [ ] `CallPushBloc` provided above the auth flow
- [ ] BlocListener triggers `RegisterTokens` post-login
- [ ] Server templates wired (see V5 sister)
- [ ] Real-device smoke: both iOS and Android ring

---

## Pointers

- `cometchat-flutter-v5-calls/references/server-push-bridge.md` — V5 sister (token registration patterns)
- `cometchat-ios-calls/references/server-apns-pushkit.md` — iOS canonical
- `cometchat-android-v5-calls/references/server-fcm-voip.md` — Android canonical
- `cometchat-flutter-v6-calls` SKILL.md
