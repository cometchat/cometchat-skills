---
name: cometchat-flutter-v5-testing
description: Testing patterns for CometChat Flutter UIKit v5 (GetX-based). Covers flutter_test (built-in), mocktail for SDK mocking, widget tests around CometChat widgets, integration_test for real-device flows, golden tests for theming, and CI on GitHub Actions / Codemagic. Sister skill of cometchat-flutter-v6-testing — the cohorts have different state-management primitives (GetX vs Bloc) so test patterns differ.
license: "MIT"
compatibility: "Flutter >= 2.5, Dart >= 2.17; flutter_test (built-in); mocktail >= 1.0; integration_test (built-in); cometchat_chat_uikit ^5.2; cometchat_calls_uikit ^5.0"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat flutter v5 testing flutter-test mocktail widget-test integration-test golden-test getx ci codemagic"
---

## Purpose

Test recipes for Flutter UIKit v5. Covers the GetX-flavored patterns; v6 (Bloc) has its own skill (`cometchat-flutter-v6-testing`).

**Read these other skills first:**
- `cometchat-flutter-v5-core` — UIKitSettingsBuilder, init/login order, GetX scope rules
- `cometchat-flutter-v5-events` — event subscription patterns the tests assert against

**Ground truth:** **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/v5/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).
- flutter_test — https://api.flutter.dev/flutter/flutter_test/flutter_test-library.html
- mocktail — https://pub.dev/packages/mocktail

---

## 1. Test layers

| Layer | Test runner | Speed | What it covers |
|---|---|---|---|
| Unit | `flutter test` (Dart VM) | Fastest | Pure Dart logic — services, models |
| Widget | `flutter test` (test environment) | Fast | Single widget, mocked dependencies |
| Integration | `flutter test integration_test/` (real device or simulator) | Slow | Full app flow, real SDK or mocked |
| Golden | `flutter test --update-goldens` then assert | Fast | Visual regression |

The skill writes all four; CI runs unit + widget + golden by default; integration runs on demand.

---

## 2. Mocking the SDK with mocktail

```yaml
# pubspec.yaml — dev dependencies
dev_dependencies:
  flutter_test:
    sdk: flutter
  mocktail: ^1.0.0
  integration_test:
    sdk: flutter
```

### Wrap the SDK in protocols (testable abstraction)

```dart
// lib/services/cometchat_service.dart
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

abstract class CometChatService {
  Future<void> init();
  Future<User> login(String uid);
  Future<void> logout();
  User? getLoggedInUser();
  Future<TextMessage> sendMessage(TextMessage message);
}

class CometChatServiceImpl implements CometChatService {
  @override
  Future<void> init() async {
    final settings = (UIKitSettingsBuilder()
          ..appId = CometChatConfig.appId
          ..region = CometChatConfig.region
          ..authKey = CometChatConfig.authKey
          ..subscriptionType = CometChatSubscriptionType.allUsers
          ..callingExtension = CometChatCallingExtension())
        .build();
    await CometChatUIKit.init(uiKitSettings: settings);
  }

  @override
  Future<User> login(String uid) async {
    final completer = Completer<User>();
    CometChatUIKit.login(uid, onSuccess: completer.complete, onError: completer.completeError);
    return completer.future;
  }

  @override
  Future<void> logout() async {
    final completer = Completer<void>();
    CometChatUIKit.logout(onSuccess: () => completer.complete(), onError: completer.completeError);
    return completer.future;
  }

  @override
  // Sync accessor → the static field. CometChatUIKit.getLoggedInUser() is async
  // (Future<User?>) and would not satisfy this `User?` signature.
  User? getLoggedInUser() => CometChatUIKit.loggedInUser;

  @override
  Future<TextMessage> sendMessage(TextMessage message) async {
    final completer = Completer<TextMessage>();
    // sendTextMessage takes message as positional, not named (verified cometchat_ui_kit.dart:357).
    CometChatUIKit.sendTextMessage(message, onSuccess: completer.complete, onError: completer.completeError);
    return completer.future;
  }
}
```

Inject via your DI / GetX scope:

```dart
final cometchatService = Get.put<CometChatService>(CometChatServiceImpl());
```

In tests, swap with a mock:

```dart
class MockCometChatService extends Mock implements CometChatService {}

setUp(() {
  Get.reset();
  final mock = MockCometChatService();
  when(() => mock.init()).thenAnswer((_) async {});
  when(() => mock.login(any())).thenAnswer((_) async => testUser);
  Get.put<CometChatService>(mock);
});

tearDown(() {
  Get.reset();
});
```

**`Get.reset()`** between tests is critical — GetX's singleton container persists across tests otherwise.

---

## 3. Widget tests

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:get/get.dart';
import 'package:your_app/screens/chat_screen.dart';
import 'package:your_app/services/cometchat_service.dart';

class MockCometChatService extends Mock implements CometChatService {}

void main() {
  late MockCometChatService mock;

  setUp(() {
    Get.reset();
    mock = MockCometChatService();
    when(() => mock.init()).thenAnswer((_) async {});
    when(() => mock.login(any())).thenAnswer((_) async => User(uid: 'cometchat-uid-1', name: 'Alice'));
    Get.put<CometChatService>(mock);
  });

  tearDown(() => Get.reset());

  testWidgets('shows loading until login resolves', (tester) async {
    final loginCompleter = Completer<User>();
    when(() => mock.login(any())).thenAnswer((_) => loginCompleter.future);

    await tester.pumpWidget(MaterialApp(home: ChatScreen()));
    await tester.pump();                                     // start the build

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // User constructor requires both uid AND name (verified User constructor in chat-sdk-flutter).
    loginCompleter.complete(User(uid: 'cometchat-uid-1', name: 'Alice'));
    await tester.pumpAndSettle();

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Conversations'), findsOneWidget);
  });

  testWidgets('shows error when login fails', (tester) async {
    when(() => mock.login(any())).thenThrow(Exception('401 Unauthorized'));

    await tester.pumpWidget(MaterialApp(home: ChatScreen()));
    await tester.pumpAndSettle();

    expect(find.textContaining('Unauthorized'), findsOneWidget);
  });
}
```

`pumpAndSettle()` waits for animations + Futures to complete.

---

## 4. Mocking CometChat widgets that ship with the kit

`CometChatConversations`, `CometChatMessageList`, etc. are real widgets that try to render against a real SDK during tests. Two strategies:

### Strategy A — Replace at the import level

If your widget composition is small (3-5 CometChat widgets), make them swappable:

```dart
// chat_screen.dart
class ChatScreen extends StatelessWidget {
  final WidgetBuilder conversationsBuilder;

  const ChatScreen({this.conversationsBuilder = _defaultConversations});

  static Widget _defaultConversations(BuildContext context) =>
      const CometChatConversations();

  @override
  Widget build(BuildContext context) => Scaffold(body: conversationsBuilder(context));
}

// In tests:
testWidgets('chat screen renders', (tester) async {
  await tester.pumpWidget(MaterialApp(
    home: ChatScreen(conversationsBuilder: (_) => const Text('mock convo list')),
  ));
  expect(find.text('mock convo list'), findsOneWidget);
});
```

### Strategy B — Skip widget tests, focus on service tests

For larger compositions, test the service layer (which is fully mockable) and rely on integration tests for widget assertions. Pragmatic for v5 because the kit's widgets aren't designed for unit testing.

---

## 5. Integration tests

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
    await tester.pumpAndSettle(Duration(seconds: 10));      // generous for real SDK init

    expect(find.text('Welcome'), findsOneWidget);

    await tester.tap(find.text('Messages'));
    await tester.pumpAndSettle();

    // Real SDK + real test app: assert that at least one conversation exists
    // (cometchat-uid-1 has pre-seeded conversations with uid-2..5)
    expect(find.byType(ListTile), findsAtLeastNWidgets(1));
  });
}
```

Run on a real device or simulator:

```bash
flutter test integration_test/chat_test.dart
```

For CI:

```bash
flutter test integration_test/chat_test.dart --device-id=emulator-5554
```

---

## 6. Golden tests

```dart
testWidgets('chat bubble renders correctly in light theme', (tester) async {
  await tester.pumpWidget(MaterialApp(
    theme: ThemeData.light(),
    home: Scaffold(
      body: ChatBubble(
        // TextMessage requires: text, receiverUid, type, receiverType + sender (User object).
        // senderUid is NOT a TextMessage constructor param — set via sender (User).
        message: TextMessage(
          text: 'Hello',
          receiverUid: 'bob',
          type: 'text',
          receiverType: 'user',
          sender: User(uid: 'alice', name: 'Alice'),
        ),
      ),
    ),
  ));

  await expectLater(
    find.byType(ChatBubble),
    matchesGoldenFile('goldens/chat_bubble_light.png'),
  );
});
```

First run:

```bash
flutter test --update-goldens
```

Commit the `goldens/` folder. Subsequent runs assert against it.

**Gotcha:** golden tests are pixel-perfect; small rendering differences between Flutter versions / OS versions cause failures. Pin Flutter SDK version in CI.

---

## 7. CI configuration

### GitHub Actions

```yaml
name: tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version: 3.16.0, channel: stable }
      - run: flutter pub get
      - run: flutter test
        env:
          COMETCHAT_TEST_APP_ID:    ${{ secrets.TEST_COMETCHAT_APP_ID }}
          COMETCHAT_TEST_REGION:    ${{ secrets.TEST_COMETCHAT_REGION }}
          COMETCHAT_TEST_AUTH_KEY:  ${{ secrets.TEST_COMETCHAT_AUTH_KEY }}

  integration:
    runs-on: macos-13
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version: 3.16.0, channel: stable }
      - uses: futureware-tech/simulator-action@v3
        with: { model: "iPhone 15", os: iOS, os_version: "17.0" }
      - run: flutter pub get
      - run: |
          flutter test integration_test/chat_test.dart \
            --dart-define=COMETCHAT_APP_ID=${{ secrets.TEST_COMETCHAT_APP_ID }} \
            --dart-define=COMETCHAT_REGION=${{ secrets.TEST_COMETCHAT_REGION }} \
            --dart-define=COMETCHAT_AUTH_KEY=${{ secrets.TEST_COMETCHAT_AUTH_KEY }}
```

### Codemagic

Codemagic is Flutter-native. Add a workflow:

```yaml
workflows:
  test:
    name: Flutter tests
    instance_type: mac_mini_m1
    scripts:
      - name: Get dependencies
        script: flutter pub get
      - name: Run tests
        script: flutter test
      - name: Run integration tests
        script: |
          flutter test integration_test/chat_test.dart \
            --dart-define=COMETCHAT_APP_ID=$COMETCHAT_APP_ID \
            ...
```

Codemagic's env vars come from the project settings UI.

---

## 8. Anti-patterns

1. **Skipping `Get.reset()`** between tests. GetX singletons persist across tests; "test 2 inherits test 1's state" flakes are common.
2. **Awaiting `pumpAndSettle()` with no timeout.** Real SDK calls can hang; tests timeout after 30s with no useful error. Pass `Duration(seconds: 10)` explicitly.
3. **Using `mocktail` without registering all dependencies.** `Get.put` requires every injected service; partial mocks crash with "not registered."
4. **Hardcoding the Auth Key in test files.** Use `--dart-define` flags. Same rule as production.
5. **Goldens that depend on system fonts.** They render differently on macOS vs Linux CI. Use `Roboto` (Material default) and pin Flutter SDK version.
6. **Real WebSocket calls in unit tests.** The CometChat SDK opens a WebSocket on init; if you call real `init` in a unit test, the test slows to seconds and may flake. Mock the service.

## 9. Verification checklist

- [ ] `CometChatService` abstraction (or similar) wrapping the SDK
- [ ] `MockCometChatService` in test setup; `Get.put<CometChatService>(mock)` per test
- [ ] `Get.reset()` in tearDown
- [ ] At least one widget test for "loading state until login resolves"
- [ ] At least one widget test for "error UI on init/login failure"
- [ ] Golden tests for at least one chat surface (light + dark theme)
- [ ] Integration test in `integration_test/` for the login + see conversations flow
- [ ] CI separates unit + integration; uses dedicated CometChat test app via `--dart-define`
- [ ] Flutter SDK version pinned in CI (no "channel: stable" alone)

## 10. Pointers

- `cometchat-flutter-v5-core` — UIKitSettingsBuilder, init/login order
- `cometchat-flutter-v5-events` — listener subscription patterns
- `cometchat-flutter-v5-troubleshooting` — when tests pass but production breaks
- `cometchat-flutter-v6-testing` — V6 patterns (Bloc-based; different)
