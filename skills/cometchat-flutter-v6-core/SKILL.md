---
name: cometchat-flutter-v6-core
description: >
  Use when writing any code that uses cometchat_chat_uikit. Contains hard rules that prevent
  silent failures, crashes, and subtle bugs. Covers CometChatUIKit.init, login, logout,
  UIKitSettings, UIKitSettingsBuilder, listener lifecycle, theme caching, Scaffold
  resizeToAvoidBottomInset, subscriptionType, region, muid preservation, and the
  Clean Architecture + BLoC component pattern. Also use when seeing errors like
  "Authentication null", "APP ID null", ERR_ALREADY_LOGGED_IN, or StateError from
  uninitialized ServiceLocator. Make sure to use this skill for any CometChat Flutter
  UIKit code, even simple widget usage.
license: "MIT"
compatibility: "cometchat_chat_uikit ^6.0.0-beta2; flutter_bloc ^8.1.0"
allowed-tools: "shell, file-read, file-search, file-list, grep"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter core rules init login logout lifecycle"
---

# CometChat Flutter UIKit — Core Rules

Non-negotiable constraints for all CometChat UIKit code. Violating these causes silent failures or crashes.

## Rule: INIT_FIRST

`CometChatUIKit.init()` must complete before any login, component usage, or SDK call.

```dart
// ✅ CORRECT
final settings = (UIKitSettingsBuilder()
      ..appId = 'APP_ID'
      ..region = 'us'
      ..authKey = 'AUTH_KEY'
      ..subscriptionType = CometChatSubscriptionType.allUsers)
    .build();

await CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) => debugPrint('Init done'),
  onError: (e) => debugPrint('Init failed: ${e.message}'),
);

// ❌ WRONG — login before init completes
CometChatUIKit.init(uiKitSettings: settings);
CometChatUIKit.login('uid'); // Race condition
```

## Rule: AUTH_CHECK_AFTER_INIT

After `CometChatUIKit.init()` completes (in its `onSuccess`), the static field `CometChatUIKit.loggedInUser` is already populated if a cached session exists. Use this synchronous check — do NOT call `CometChat.getLoggedInUser()` separately.

```dart
// ✅ CORRECT — synchronous check after init completes
CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) {
    final hasUser = CometChatUIKit.loggedInUser != null;
    // Route to home or login based on hasUser
  },
);

// ❌ WRONG — separate async getLoggedInUser call after init
CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) {
    CometChat.getLoggedInUser(
      onSuccess: (user) { ... },  // Unreliable when no session exists
      onError: (e) { ... },
    );
  },
);
```

The `init()` method internally calls `getLoggedInUser()` and sets `CometChatUIKit.loggedInUser` before firing `onSuccess`. Calling it again is redundant and the callback-based version can silently fail when no session exists (the SDK logs "Please log in to CometChat before calling this method" and neither callback fires consistently).

This also applies to `login()` and `loginWithAuthToken()` — all three populate `CometChatUIKit.loggedInUser` before calling `onSuccess`.

```dart
// ❌ ALSO WRONG — async getLoggedInUser after init (redundant native bridge round-trip)
CometChatUIKit.init(
  uiKitSettings: settings,
  onSuccess: (_) async {
    final user = await CometChatUIKit.getLoggedInUser(); // Unnecessary!
    if (user != null) { ... }
  },
);

// ❌ ALSO WRONG — raw SDK getLoggedInUser (bypasses UIKit, unreliable)
User? existingUser = await CometChat.getLoggedInUser();
```

## Rule: SCAFFOLD_NO_RESIZE

Any `Scaffold` containing `CometChatMessageComposer` MUST set `resizeToAvoidBottomInset: false`. The composer handles keyboard spacing internally via `SliverSpacing`. Leaving it `true` causes double-compensation and layout jumps.

```dart
// ✅ CORRECT
Scaffold(
  resizeToAvoidBottomInset: false,
  body: Column(
    children: [
      Expanded(child: CometChatMessageList(user: user)),
      CometChatMessageComposer(user: user),
    ],
  ),
)

// ❌ WRONG — default is true, causes double keyboard compensation
Scaffold(
  body: Column(
    children: [
      Expanded(child: CometChatMessageList(user: user)),
      CometChatMessageComposer(user: user),
    ],
  ),
)
```

## Rule: LISTENER_LIFECYCLE

SDK listeners MUST be registered with a unique ID in `initState()` and removed with the same ID in `dispose()`. Forgetting removal causes duplicate events and memory leaks.

```dart
// ✅ CORRECT
class _MyScreenState extends State<MyScreen> with MessageListener {
  late final String _listenerId;

  @override
  void initState() {
    super.initState();
    _listenerId = 'my_screen_${DateTime.now().millisecondsSinceEpoch}';
    CometChat.addMessageListener(_listenerId, this);
  }

  @override
  void dispose() {
    CometChat.removeMessageListener(_listenerId);
    super.dispose();
  }
}

// ❌ WRONG — hardcoded ID causes collisions; missing dispose removal
class _MyScreenState extends State<MyScreen> with MessageListener {
  @override
  void initState() {
    super.initState();
    CometChat.addMessageListener('messages', this); // Collision!
  }
  // Missing dispose → listener leaks
}
```

## Rule: THEME_CACHE

Cache theme values in `didChangeDependencies()` with a `_themeInitialized` flag. Never call `CometChatThemeHelper.getColorPalette(context)` in `build()` — during keyboard animation, `MediaQuery` changes trigger rebuilds, and each lookup does expensive InheritedWidget traversal (44-95ms instead of <16ms).

```dart
// ✅ CORRECT — Hybrid pattern
class _MyWidgetState extends State<MyWidget> {
  late CometChatColorPalette _colorPalette;
  late CometChatSpacing _spacing;
  late CometChatTypography _typography;
  bool _themeInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_themeInitialized) {
      _colorPalette = CometChatThemeHelper.getColorPalette(context);
      _spacing = CometChatThemeHelper.getSpacing(context);
      _typography = CometChatThemeHelper.getTypography(context);
      _themeInitialized = true;
    }
  }
}

// ❌ WRONG — lookup in build causes jank
@override
Widget build(BuildContext context) {
  final colors = CometChatThemeHelper.getColorPalette(context); // Expensive!
  return Container(color: colors.primary);
}
```

## Rule: SUBSCRIPTION_TYPE_REQUIRED

Omitting `subscriptionType` in `UIKitSettingsBuilder` silently disables all presence events (online/offline, typing indicators). No error is thrown.

```dart
// ✅ CORRECT
UIKitSettingsBuilder()
  ..subscriptionType = CometChatSubscriptionType.allUsers

// ❌ WRONG — no error, but presence events never fire
UIKitSettingsBuilder()
  ..appId = 'APP_ID'
  ..region = 'us'
```

## Rule: REGION_LOWERCASE

Region must be a lowercase string. The SDK validates against `['us', 'eu', 'in']`.

```dart
// ✅ CORRECT
..region = 'us'

// ❌ WRONG — throws ERR_INVALID_REGION
..region = 'US'
```

## Rule: SERVICE_LOCATOR_INIT

Each component's `ServiceLocator.instance.setup()` must be called before creating its BLoC. The UIKit widgets do this automatically, but if you create BLoCs manually:

```dart
// ✅ CORRECT
ConversationsServiceLocator.instance.setup();
final bloc = ConversationsBloc(
  getLoggedInUserUseCase: ConversationsServiceLocator.instance.getLoggedInUserUseCase,
  // ...
);

// ❌ WRONG — StateError: not initialized
final bloc = ConversationsBloc(
  getLoggedInUserUseCase: ConversationsServiceLocator.instance.getLoggedInUserUseCase,
);
```

## Rule: MUID_PRESERVATION

When sending messages, the SDK may return an empty `muid` in the success callback. The UIKit preserves the original `muid` for pending→sent deduplication. If you handle `ccMessageSent` events, compare by `muid` first, then `id`.

## Pattern: Callback → Async Bridge

The CometChat SDK uses callback-based APIs (`onSuccess`/`onError`). Wrap them with `Completer` for async/await:

```dart
import 'dart:async';

Future<User> loginAsync(String uid) {
  final completer = Completer<User>();
  CometChatUIKit.login(uid,
    onSuccess: (user) => completer.complete(user),
    onError: (e) => completer.completeError(e),
  );
  return completer.future;
}

// Usage
try {
  final user = await loginAsync('user123');
} on CometChatException catch (e) {
  debugPrint('Login failed: ${e.message}');
}
```

This pattern is used internally by the UIKit's repository layer. Use it when calling SDK methods directly outside UIKit components.

## Component Architecture Pattern

Every component follows this structure:

```
{component}/
├── bloc/
│   ├── {component}_bloc.dart      # Extends Bloc<Event, State>, registers SDK listeners
│   ├── {component}_event.dart     # Equatable events
│   └── {component}_state.dart     # Equatable state with copyWith
├── domain/
│   ├── usecases/                  # One class per operation
│   └── repositories/              # Abstract interface
├── data/
│   ├── repositories/              # Impl delegates to datasource
│   └── datasources/               # SDK calls
├── di/
│   └── {component}_service_locator.dart  # Singleton, setup() method
└── widgets/                       # UI, uses BlocConsumer/BlocBuilder
```

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Widget | `CometChat{Name}` | `CometChatConversations` |
| BLoC | `{Name}Bloc` | `ConversationsBloc` |
| Event | `{Verb}{Name}` | `LoadConversations`, `MessageReceived` |
| State | `{Name}State` | `ConversationsLoaded`, `MessageListState` |
| Repository | `{Name}Repository` / `{Name}RepositoryImpl` | `ConversationsRepository` |
| Use Case | `{Verb}{Name}UseCase` | `GetConversationsUseCase` |
| Service Locator | `{Name}ServiceLocator` | `ConversationsServiceLocator` |
| Style | `CometChat{Name}Style` | `CometChatConversationsStyle` |

## Checklist — Every CometChat Screen

- [ ] `CometChatUIKit.init()` called before any usage
- [ ] Auth check uses `CometChatUIKit.loggedInUser` after init, not `CometChat.getLoggedInUser()`
- [ ] `subscriptionType` set in UIKitSettingsBuilder
- [ ] `region` is lowercase
- [ ] Scaffold has `resizeToAvoidBottomInset: false` if composer is present
- [ ] Theme cached in `didChangeDependencies()`, not `build()`
- [ ] SDK listeners registered with unique ID, removed in `dispose()`
- [ ] Colors from `CometChatThemeHelper`, never hardcoded

## Visual Builder integration

> **⚠ The Visual Builder emits V5-shaped code.** The canonical builder repo at the `chat_builder/` directory inside the Flutter Visual Builder ZIP (download from https://preview.cometchat.com/downloads/cometchat-builder-flutter.zip) uses `cometchat_chat_uikit: ^5.2.12` + `cometchat_calls_uikit: ^5.0.13` — the **V5** Flutter UI Kit packages. There is no V6-native Visual Builder canonical from vendor side yet ([F22 finding, 2026-05-22](https://github.com/cometchat/cometchat-skills/issues)). When a V6 project picks the Visually path, the copied `chat_builder/` path-dep brings V5 deps in transitively — your V6 host app code is untouched, but the Visual-Builder-emitted screens are V5-flavored. Treat as transitional until vendor publishes a V6 canonical. V6 customers preferring a single-version dep tree should use the In-code path.
>
> The recipe below is identical to what `cometchat-flutter-v5-core` §"Visual Builder integration" prescribes (both reference the same canonical). This page kept for V6 customers who still hit the Visually flow.

When the dispatcher's Step 3.1 sets `customize=visual` and the platform resolves to `flutter`, skills runs **`cometchat builder export --platform flutter`** — a single CLI command that downloads the canonical static template ZIP from `preview.cometchat.com/downloads/cometchat-builder-flutter.zip`, fetches the per-builder settings JSON, applies F3 + F10 missing-field defaults, and writes the entire `chat_builder/` package to `--output` (default: `chat_builder/`).

The `chat_builder/` directory is wired **as a path dependency** in the customer's project — it owns the entire chat surface (conversations, messages, users, groups, calls). The customer's app initializes settings and launches a screen via `ChatBuilder.launchBuilder(context)` or `ChatBuilder.launchMessages(...)`.

This is intentionally a heavier copy than iOS (Pod) / Android (Gradle plugin) — the Flutter builder package is not yet published to pub.dev.

### 1. Run `cometchat builder export`

```bash
cometchat builder export --platform flutter --json
```

Defaults to `--output chat_builder/`. The command writes the entire canonical `chat_builder/` Dart package (~50 files: `lib/`, `assets/`, `android/`, `ios/`, `pubspec.yaml`) — verbatim from the canonical ZIP — and patches `chat_builder/assets/sample_app/cometchat-builder-settings.json` with the **envelope-shape JSON** `{ builderId, name, settings: {...} }` (F3 + F10 defaults injected: `mentionAll: true`, `inAppSounds: { incomingMessageSound: true, outgoingMessageSound: true }`). No SKILLS-AUTO-GENERATED sentinel (JSON forbids `//` comments).

`BuilderSettingsHelper.loadFromAsset()` reads this exported settings file at runtime.

Resync = re-run the same command with `--force` (full re-download + replace). See `cometchat-core` §11.6 for the resync contract.

#### F56 + F57 + F58 — known canonical-ZIP rough edges (re-apply after every export)

Three issues live in the upstream canonical `chat_builder/` Dart package (verified 2026-05-25 against `preview.cometchat.com/downloads/cometchat-builder-flutter.zip`). Vendor-side fixes pending; agent must work around them on **every** `builder export` (first emit AND every resync, since `--force` re-overwrites the patches):

**F56 — Wrong asset path in `api_services.dart`**

`chat_builder/lib/services/api_services.dart` line ~41:

```dart
// Canonical (broken):
await loadJsonFromAssets('assets/chat_builder/sample_data.json');

// Agent must patch to:
await loadJsonFromAssets('assets/sample_app/sample_data.json');
```

The canonical references `assets/chat_builder/sample_data.json` — a path that doesn't exist in the customer's host app after the standard `cp -r chat_builder/assets/ assets/` copy. The actual file lands at `assets/sample_app/sample_data.json`. Without this patch, the login screen's "default users" list silently falls back to empty and customers see an empty user picker.

**F57 — F56 patch is overwritten on every resync**

`builder export --platform flutter --force` re-copies the canonical's `api_services.dart` verbatim — re-introducing the wrong path. Agent must re-apply the F56 patch after every resync. This is a known re-apply task; document it in the customer-facing summary so they know "the agent will need to patch this each time the dashboard settings change".

**F58 — Asset copy is additive, not idempotent**

The standard prescription `cp -r chat_builder/assets/ assets/` is additive — files removed from the canonical (e.g., a deprecated icon) stay in the customer's `assets/` directory because cp doesn't delete. On resync, use `rsync -a --delete chat_builder/assets/ assets/` instead, OR `rm -rf assets/ && cp -r chat_builder/assets/ assets/` first.

**Tracking**: a single vendor ticket bundles F22 (V5-shaped canonical), F56 (wrong asset path), F57 (resync overwrite of F56 fix), F48 lineage (font paths in earlier Android-ZIP iterations) — see CometChat Linear for the consolidated upstream-fix request. v4.3.0 ships with the agent-side workarounds documented above; a future release picks up the upstream fixes when they land.

### Files skills writes (after `builder export`)

| Path | Content |
|---|---|
| `lib/cometchat/cometchat_app.dart` | Thin `StatefulWidget` that initializes the kit then exposes a launch trigger calling `ChatBuilder.launchBuilder(context)` |
| `lib/cometchat/secrets.dart` | Credentials class (`Secrets.appId / region / authKey`) populated by Step 2c, added to `.gitignore` |

### Files patched

| Path | Patch |
|---|---|
| `pubspec.yaml` | Add `chat_builder: { path: ./chat_builder }` to dependencies. Add `assets/` + `assets/sample_app/` to `flutter.assets`. Add font families `arial / inter / roboto / times New Roman` exactly as defined in `chat_builder/pubspec.yaml` |
| `lib/main.dart` | Insert `WidgetsFlutterBinding.ensureInitialized()` + `await BuilderSettingsHelper.loadFromAsset()` before `runApp()` |
| `ios/Podfile` | `platform :ios, '13.0'` (raise if lower) |
| `android/app/build.gradle.kts` | `ndkVersion = "27.0.12077973"`, `minSdk = 24` (raise if lower) |
| `android/gradle.properties` | **Non-negotiable:** append `android.enableJetifier=true`. CometChat Chat SDK transitively pulls `com.android.support:support-compat:26.1.0` which collides with `androidx.core:core` — without Jetifier the build fails with `Duplicate class android.support.v4.os.ResultReceiver` etc. Same root cause as `cometchat-android-v6-core` §1.3a — Flutter's Android side has identical exposure. Validated 2026-05-19 on smoke test |
| `android/app/src/main/AndroidManifest.xml` + `ios/Runner/Info.plist` | `RECORD_AUDIO` / `CAMERA` permissions + `NSMicrophoneUsageDescription` / `NSCameraUsageDescription` if any call feature is enabled |

### Init flow (lib/main.dart)

```dart
import 'package:flutter/material.dart';
import 'package:chat_builder/builder/builder_settings_helper.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await BuilderSettingsHelper.loadFromAsset();
  runApp(const MyApp());
}
```

`BuilderSettingsHelper.loadFromAsset()` reads `chat_builder/assets/cometchat-builder-settings.json` and populates the in-memory settings the `ChatBuilder.*` screens consume. Standard `CometChatUIKit.init(uiKitSettings: ...)` (see this file's `INIT_FIRST` rule) is still required and runs before any chat surface mounts — the wrapper below handles that.

### The wrapper template

```dart
// lib/cometchat/cometchat_app.dart
import 'package:flutter/material.dart';
import 'package:chat_builder/builder/chat_builder.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

import 'secrets.dart';

/// Top-level chat surface emitted by the Visual Builder Visually path.
/// The `chat_builder` package owns the UI; this widget bootstraps UI Kit init
/// then renders a launch trigger. Step 3c placement decides where this widget
/// mounts in the host app (a route, a tab, a dialog).
class CometChatApp extends StatefulWidget {
  const CometChatApp({super.key});

  @override
  State<CometChatApp> createState() => _CometChatAppState();
}

class _CometChatAppState extends State<CometChatApp> {
  bool _isReady = false;
  String? _initError;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  void _bootstrap() {
    final settings = (UIKitSettingsBuilder()
          ..appId = Secrets.appId
          ..region = Secrets.region
          ..authKey = Secrets.authKey
          ..subscriptionType = CometChatSubscriptionType.allUsers)
        .build();

    CometChatUIKit.init(
      uiKitSettings: settings,
      onSuccess: (_) => setState(() => _isReady = true),
      onError: (e) => setState(() => _initError = e.message),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_initError != null) {
      return Scaffold(body: Center(child: Text('CometChat init failed: $_initError')));
    }
    if (!_isReady) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Center(
        child: ElevatedButton(
          onPressed: () => ChatBuilder.launchBuilder(context),
          child: const Text('Open chat'),
        ),
      ),
    );
  }
}
```

`ChatBuilder.launchBuilder(context)` opens the builder's login / dashboard flow; once a user is logged in, the package's internal navigation handles conversations → messages.

For direct deep-links into a specific user or group thread (skipping the dashboard), use:

```dart
ChatBuilder.launchMessages(context: context, user: user);
ChatBuilder.launchMessages(context: context, group: group);
```

These are the two public entry points the `chat_builder` package exposes — see `chat_builder/lib/builder/chat_builder.dart` (inside the Flutter Visual Builder ZIP at https://preview.cometchat.com/downloads/cometchat-builder-flutter.zip).

`resizeToAvoidBottomInset: false` is non-negotiable on any `Scaffold` whose body chain reaches `CometChatMessageComposer` (see this file's `SCAFFOLD_NO_RESIZE` rule). The composer handles keyboard spacing internally.

### Calls + builder

If `CometChatBuilderSettings` reports any call feature enabled, the `chat_builder` package handles incoming/outgoing call surfaces internally (it ships its own call routes). External wiring still required:
1. Add `cometchat_calls_uikit` to `pubspec.yaml`
2. iOS `Info.plist` + Android `AndroidManifest.xml` permissions per `cometchat-flutter-v6-calls`
3. Apply the `navigatorKey: CallNavigationContext.navigatorKey` workaround documented in `cometchat-flutter-v6-calls` §1.7 (kit 6.0.0-beta2 requires this for incoming-call routing)
4. Push wiring — defer to `cometchat-flutter-v6-push` (audit-verified namespace `PNRegistry`, NOT `CometChatNotifications` — [[project_sdk_symbol_audit_2026_05_14]])
5. **Vendor blocker:** outgoing→in-call transition is broken on `cometchat_chat_uikit 6.0.0-beta2` ([[project_v6_flutter_calls_partial]]); Flutter V5 cohort is production-recommended until vendor fix lands

### What is NOT honored in v1

Skills emits a launch-button trigger, not the full multi-tab layout the `chat_builder` package's internal `Dashboard` provides. Customers get the dashboard once they tap "Open chat" — but the host-app surface is intentionally minimal so Step 3c placement (route, tab, dialog) can decide the mount shape. Theme color + typography + chat-feature toggles ARE honored via the embedded package. For deep customization beyond what the builder JSON allows, fall back to the code-driven path (see this file's standard placement pattern) and skip `chat_builder` entirely.
