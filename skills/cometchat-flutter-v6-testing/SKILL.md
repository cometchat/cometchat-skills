---
name: cometchat-flutter-v6-testing
description: Testing patterns for CometChat Flutter UIKit v6 (stable, Bloc-based). Covers flutter_test + bloc_test for Bloc unit tests, mocktail for SDK mocking, widget tests around the Bloc-driven CometChat widgets, integration_test for real-device flows, golden tests for theming, and CI on GitHub Actions / Codemagic. Sister skill of cometchat-flutter-v5-testing — the cohorts have different state-management primitives (GetX vs Bloc) so the patterns differ.
license: "MIT"
compatibility: "Flutter >= 2.5, Dart >= 3.0; flutter_test (built-in); bloc_test >= 9.0; mocktail >= 1.0; integration_test (built-in); cometchat_chat_uikit ^6.0.2"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat flutter v6 testing flutter-test bloc bloc-test mocktail widget-test integration-test golden-test ci codemagic"
---

## Purpose

Test recipes for Flutter UIKit v6 (stable, Bloc-based). Most of the v5 patterns carry over; the deltas are around state-management primitives (Bloc, not GetX) and the unified `cometchat_chat_uikit` package (calls bundled — see `cometchat-flutter-v6-calls`).

**Read these other skills first:**
- `cometchat-flutter-v6-core` — UIKitSettings, init/login order, hard rules
- `cometchat-flutter-v6-events` — Bloc-based event streams
- `cometchat-flutter-v5-testing` — patterns that aren't v6-specific (CI config, golden tests, mocktail intro) — read first if you haven't

**Ground truth:** **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).
- bloc_test — https://pub.dev/packages/bloc_test
- flutter_bloc — https://bloclibrary.dev/

---

## 1. The v5 → v6 testing delta

| Concern | v5 | v6 |
|---|---|---|
| State management | GetX | Bloc |
| DI in tests | `Get.reset()` between tests | Provide via `MultiBlocProvider` per test, or use `BlocProvider.value` with a mock |
| Calls package | `cometchat_calls_uikit` (separate) | bundled into `cometchat_chat_uikit` |
| Init order | `..callingExtension = CometChatCallingExtension()` on UIKitSettingsBuilder | `CometChatUIKitCalls.init` inside `CometChatUIKit.init` onSuccess |
| Listener IDs | Stable string for `addCallListener` | Bloc subscription, automatic cleanup |
| State persistence between tests | Get singletons leak — must reset | Bloc state is per-instance — no global reset, but providers must be re-created per test |

Most assertions stay the same; the wiring around them changes.

---

## 2. Mocktail + bloc_test setup

```yaml
# pubspec.yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  bloc_test: ^9.0.0
  mocktail: ^1.0.0
  integration_test:
    sdk: flutter
```

### Service abstraction

Same shape as v5 (see `cometchat-flutter-v5-testing/SKILL.md` Section 2):

```dart
// lib/services/cometchat_service.dart
abstract class CometChatService {
  Future<void> init();
  Future<User> login(String uid);
  Future<void> logout();
  User? getLoggedInUser();
  Stream<TextMessage> messageStream();
}

class CometChatServiceImpl implements CometChatService {
  @override
  Future<void> init() async {
    // Class is UIKitSettingsBuilder (constructor), NOT UIKitSettings.builder() (verified shared_uikit/lib/src/cometchat_ui_kit/ui_kit_settings.dart).
    final settings = (UIKitSettingsBuilder()
      ..appId = CometChatConfig.appId
      ..region = CometChatConfig.region
      ..authKey = CometChatConfig.authKey
      ..subscriptionType = CometChatSubscriptionType.allUsers)
      .build();

    await Future<void>.value();   // Real impl: completer-wrap CometChatUIKit.init
    // Then chain calls init in onSuccess (rule 1.1 from cometchat-flutter-v6-calls)
  }

  // ... rest
}
```

---

## 3. Bloc unit tests with bloc_test

```dart
// test/blocs/auth_bloc_test.dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:your_app/blocs/auth_bloc.dart';
import 'package:your_app/services/cometchat_service.dart';

class MockCometChatService extends Mock implements CometChatService {}
class FakeAuthEvent extends Fake implements AuthEvent {}

void main() {
  late MockCometChatService mockService;

  setUpAll(() {
    registerFallbackValue(FakeAuthEvent());
  });

  setUp(() {
    mockService = MockCometChatService();
  });

  blocTest<AuthBloc, AuthState>(
    'emits Authenticated when login succeeds',
    setUp: () {
      when(() => mockService.init()).thenAnswer((_) async {});
      when(() => mockService.login(any())).thenAnswer(
        (_) async => User(uid: 'cometchat-uid-1', name: 'Alice'),
      );
    },
    build: () => AuthBloc(service: mockService),
    act: (bloc) => bloc.add(LoginRequested(uid: 'cometchat-uid-1')),
    expect: () => [
      isA<AuthLoading>(),
      isA<Authenticated>(),
    ],
    verify: (_) {
      verify(() => mockService.init()).called(1);
      verify(() => mockService.login('cometchat-uid-1')).called(1);
    },
  );

  blocTest<AuthBloc, AuthState>(
    'emits AuthError when login fails',
    setUp: () {
      when(() => mockService.init()).thenAnswer((_) async {});
      when(() => mockService.login(any())).thenThrow(Exception('401 Unauthorized'));
    },
    build: () => AuthBloc(service: mockService),
    act: (bloc) => bloc.add(LoginRequested(uid: 'cometchat-uid-1')),
    expect: () => [
      isA<AuthLoading>(),
      predicate<AuthState>((s) => s is AuthError && s.message.contains('Unauthorized')),
    ],
  );
}
```

`bloc_test` handles the boilerplate of subscribing to the bloc, dispatching events, and asserting state sequence.

---

## 4. Widget tests with BlocProvider

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mocktail/mocktail.dart';
import 'package:your_app/screens/chat_screen.dart';
import 'package:your_app/blocs/auth_bloc.dart';

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}
class FakeAuthState extends Fake implements AuthState {}
class FakeAuthEvent extends Fake implements AuthEvent {}

void main() {
  setUpAll(() {
    registerFallbackValue(FakeAuthState());
    registerFallbackValue(FakeAuthEvent());
  });

  testWidgets('shows loading on AuthLoading state', (tester) async {
    final mockBloc = MockAuthBloc();
    when(() => mockBloc.state).thenReturn(AuthLoading());

    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider<AuthBloc>.value(
          value: mockBloc,
          child: ChatScreen(),
        ),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('shows error on AuthError state', (tester) async {
    final mockBloc = MockAuthBloc();
    when(() => mockBloc.state).thenReturn(AuthError(message: '401 Unauthorized'));

    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider<AuthBloc>.value(value: mockBloc, child: ChatScreen()),
      ),
    );

    expect(find.textContaining('Unauthorized'), findsOneWidget);
  });
}
```

`BlocProvider.value` is for tests; `BlocProvider(create: ...)` is for production.

---

## 5. Mocking the kit's call widgets

V6 calls widgets fire BLoC events internally. Mocking is the same pattern — wrap your custom call surfaces in service abstractions, mock at that layer.

For widgets like `<CometChatOngoingCall>` that you don't control, the strategy is the same as v5: replace at composition boundary or skip widget tests for them and rely on integration tests.

---

## 6. Integration tests (same as v5)

```dart
// integration_test/chat_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:your_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login and see conversations', (tester) async {
    app.main();
    await tester.pumpAndSettle(Duration(seconds: 10));

    expect(find.text('Welcome'), findsOneWidget);

    await tester.tap(find.text('Messages'));
    await tester.pumpAndSettle();

    expect(find.byType(ListTile), findsAtLeastNWidgets(1));
  });
}
```

Same shape as v5; the underlying SDK is different but the integration test contract is the same.

---

## 7. Golden tests (same as v5)

See `cometchat-flutter-v5-testing/SKILL.md` Section 6 — the patterns are identical. The kit's V6 themes use Material 3 by default; pin Flutter version to ensure golden stability.

---

## 8. Calls testing in v6

V6 bundles calls into `cometchat_chat_uikit`. Tests that touch calls:

```dart
blocTest<CallBloc, CallState>(
  'emits CallActive when initiateCall succeeds',
  setUp: () {
    when(() => mockService.initiateCall(any())).thenAnswer(
      (_) async => Call(sessionId: 'session-123'),
    );
  },
  build: () => CallBloc(service: mockService),
  act: (bloc) => bloc.add(InitiateCall(receiverUid: 'cometchat-uid-2')),
  expect: () => [isA<CallInitiating>(), isA<CallActive>()],
);
```

**The init order rule applies in tests too:** mock `init` to resolve before any `initiateCall`-related test runs. The simplest way is to wire init in your test's `setUpAll`:

```dart
setUpAll(() async {
  registerFallbackValue(FakeCallEvent());
  // If your AuthBloc init is shared, run it once here:
  // await mockAuthBloc.add(AppStarted());
});
```

For widget tests of call screens, see `cometchat-flutter-v6-calls` Section 7's verification checklist — the same checks belong in the test file:

- Was init called before the call screen mounted?
- Does the call screen show the WebRTC view after the session starts?
- Does hangup call `endSession` AND `Navigator.pop`?

---

## 9. Anti-patterns

1. **Reusing a single `MockBloc` across tests** without resetting. State leaks. Either re-create per test or use `tearDown(() => mockBloc.close())`.
2. **Skipping `registerFallbackValue` for events / states.** mocktail crashes the test runner without it; the error message is unclear.
3. **`Bloc` subclasses with side effects in their constructor.** Tests mount the bloc and side effects fire (e.g. real SDK init). Move side effects to event handlers, dispatch them explicitly in tests.
4. **`emit` checks that depend on equality.** Bloc states often have `Equatable` mixed in; if not, `expect: () => [SomeState()]` fails because two `SomeState()` instances aren't equal. Use `predicate<T>(...)` or verify via `isA<SomeState>()` + later assertions.
5. **Real `flutter_bloc` ChangeNotifierProvider in widget tests.** Mock the bloc directly via `BlocProvider.value(value: mockBloc)`.
6. **Skipping pump after state emit.** `bloc_test` handles state assertions, but widget tests need explicit `await tester.pump()` after the bloc emits or the rebuild won't happen.

## 10. Verification checklist

- [ ] `CometChatService` abstraction wrapping the SDK
- [ ] `MockCometChatService` and `MockAuthBloc` (`MockBloc<E, S>`) in test files
- [ ] `registerFallbackValue` calls in `setUpAll` for events + states
- [ ] At least one bloc_test for "AuthBloc emits Authenticated on successful login"
- [ ] At least one bloc_test for "AuthBloc emits AuthError on login failure"
- [ ] At least one widget test for "shows loading until login resolves"
- [ ] At least one widget test for "error UI on auth failure"
- [ ] Integration test for login + see conversations
- [ ] Calls integration test asserting init order rule (chat init → calls init → calls available)
- [ ] CI uses dedicated CometChat test app via `--dart-define`
- [ ] Flutter version pinned in CI

## 11. Pointers

- `cometchat-flutter-v6-core` — init/login order, hard rules
- `cometchat-flutter-v6-events` — Bloc event streams
- `cometchat-flutter-v6-calls` — calls integration; hard rules to assert in tests
- `cometchat-flutter-v6-troubleshooting` — when tests pass but production breaks
- `cometchat-flutter-v5-testing` — for shared patterns (CI, goldens, mocktail intro)
- `cometchat-flutter-v6-migration` — v5 → v6 migration recipes (test rewrites)
