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
compatibility: "cometchat_chat_uikit ^6.0.1; flutter_bloc ^8.1.0. File-based init (CometChatUIKit.initFromSettings + project-root cometchat-settings.json — ENG-35866 Skills Telemetry) requires cometchat_chat_uikit >= 6.0.3; on older UIKit use the UIKitSettingsBuilder fallback."
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter core rules init login logout lifecycle"
---

# CometChat Flutter UIKit — Core Rules

> **Ground truth:** `cometchat_chat_uikit: ^6.0` (calls folded in; transitively `cometchat_sdk ^5` + `cometchat_calls_sdk ^5.0.2`) — the pub-cache package source + `docs/ui-kit/flutter`. **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify Dart symbols against the resolved package source before relying on them.

Non-negotiable constraints for all CometChat UIKit code. Violating these causes silent failures or crashes.

## Rule: INIT_FIRST

Init — `CometChatUIKit.initFromSettings()` (recommended) or the `CometChatUIKit.init(uiKitSettings: …)` fallback — must complete before any login, component usage, or SDK call.

### File-based init with `cometchat-settings.json` (recommended)

> **🚧 Version gate (ENG-35866 — Skills Telemetry).** `CometChatUIKit.initFromSettings()` ships in **`cometchat_chat_uikit` ≥ `6.0.3`** (which pulls `cometchat_sdk ^5.0.3` + `cometchat_calls_sdk ^5.0.2` transitively). It reads `cometchat-settings.json` via `rootBundle` and lets the SDK self-report `integrationSource`. On older UIKit the method does not exist — use the **`UIKitSettingsBuilder` fallback** below. If unsure of the installed version, use the fallback.

**Step 1 — create `cometchat-settings.json` at the project root.** Fill `appId` / `region` / `credentials.authKey` from the CLI `provision setup` output; leave everything else at the defaults below. These are the **same credentials** used everywhere else in the app — this file is the single source, so there's no second copy to keep in sync.

```json
{
  "appId": "APP_ID_HERE",
  "region": "us",
  "credentials": {
    "authKey": "AUTH_KEY_HERE"
  },
  "chatSDK": {
    "presenceSubscription": {
      "type": "ALL_USERS",
      "roles": []
    },
    "autoEstablishSocketConnection": true,
    "adminHost": null,
    "clientHost": null
  },
  "callsSDK": {
    "host": null,
    "adminHost": null,
    "clientHost": null,
    "callsHost": null
  },
  "uiKit": {
    "subscribePresenceForAllUsers": true
  }
}
```

**Step 2 — register it as a bundled asset in `pubspec.yaml`.** The SDK loads it with `rootBundle.loadString('cometchat-settings.json')`, so the asset key must be the bare filename — register it at the **root** (not nested under `assets/`, which would make the key `assets/cometchat-settings.json` and the lookup miss):

```yaml
flutter:
  assets:
    - assets/
    - cometchat-settings.json
```

- **Commit `cometchat-settings.json` — do not gitignore it** (the file is part of the integration). Its `authKey` is an **optional demo/POC credential**: a quick-start affordance so a PM or developer can see working chat *before* the backend auth-token flow is wired (that flow often waits on internal approvals). Because the file is committed to source control, treat the key as public — use a **dedicated demo CometChat app** (a committed key trips secret scanners and stays in git history; never reuse a production app's key). Switch to a server-minted `authToken` via `loginWithAuthToken` before production, where `authKey` must not ship.

**Step 3 — init in `main()`.** No `UIKitSettingsBuilder`, no config const — the SDK reads `cometchat-settings.json` itself:

```dart
import 'package:flutter/material.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // tier2-version-gated: initFromSettings ships in cometchat_chat_uikit >= 6.0.3 (ENG-35866).
  await CometChatUIKit.initFromSettings(
    onSuccess: (String successMessage) => debugPrint('Init done'),
    onError: (CometChatException e) => debugPrint('Init failed: ${e.message}'),
  );
  runApp(const MyApp());
}
```

### `UIKitSettingsBuilder` init (fallback — UIKit before `6.0.3`)

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

## Rule: SCAFFOLD_NO_RESIZE (version-aware — prose guidance, not a lint)

On `cometchat_chat_uikit ^6.0.1`, a `Scaffold` containing `CometChatMessageComposer` should use `resizeToAvoidBottomInset: true` (or omit it — `true` is Flutter's default). The composer clamps the native keyboard height to Flutter's `viewInsets` (kit fix **ENG-34434**), so `true` does NOT double-compensate. The kit sample app uses `true` (the messages screen defaults it; the thread screen sets it explicitly).

The old "must be `false`" rule was correct only for **pre-6.0.1** kits (before the clamp landed). On those versions `false` was the workaround for the double-compensation / layout-jump bug. If you see a double keyboard gap on a current kit, the fix is to upgrade to `^6.0.1` — not to set `false`.

```dart
// ✅ CORRECT on ^6.0.1 (true, or omit — true is the default)
Scaffold(
  resizeToAvoidBottomInset: true,
  body: Column(
    children: [
      Expanded(child: CometChatMessageList(user: user)),
      CometChatMessageComposer(user: user),
    ],
  ),
)

// ⚠ Only on PRE-6.0.1 kits — false was the stopgap before the ENG-34434 clamp.
//   On ^6.0.1 this is unnecessary; upgrade the kit instead.
Scaffold(
  resizeToAvoidBottomInset: false,
  body: Column(
    children: [
      Expanded(child: CometChatMessageList(user: user)),
      CometChatMessageComposer(user: user),
    ],
  ),
)
```

## Rule: ANDROID_MINSDK_26

**Set `minSdk = 26` in `android/app/build.gradle.kts` (In-code path too, not just Visual Builder).** `cometchat_chat_uikit: ^6.0.1` depends transitively on `cometchat_calls_sdk` (`>=5.0.2 <6.0.0`), which floors Android `minSdk` at **26**. A default `flutter create` app sets `minSdk` lower (Flutter's platform default), so `flutter build apk` fails with:

```
uses-sdk:minSdkVersion 21 cannot be smaller than version 26 declared in library [cometchat_calls_sdk]
```

`flutter analyze` does NOT catch this — it only surfaces at the APK/AAB build. Set it up front:

```kotlin
// android/app/build.gradle.kts
android { defaultConfig { minSdk = 26 } }
```

(Verified — real `flutter build apk --debug` against kit 6.0.1.)

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
- [ ] Scaffold hosting `CometChatMessageComposer` uses `resizeToAvoidBottomInset: true` (or omits it) on `^6.0.1` — the composer clamps to `viewInsets` (ENG-34434); `false` is only the pre-6.0.1 stopgap
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

Defaults to `--output chat_builder/`. The command writes the entire canonical `chat_builder/` Dart package (~50 files: `lib/`, `assets/`, `android/`, `ios/`, `pubspec.yaml`) — verbatim from the canonical ZIP — and patches `chat_builder/assets/sample_app/cometchat-builder-settings.json` with the **envelope-shape JSON** the CLI emits: `{ builderId, name, settings: {...} }` (F3 + F10 defaults injected: `mentionAll: true`, `inAppSounds: { incomingMessageSound: true, outgoingMessageSound: true }`). No SKILLS-AUTO-GENERATED sentinel (JSON forbids `//` comments).

> The CLI is the source of truth for the written shape. The vendor canonical's own checked-in `cometchat-builder-settings.json` carries only `{ builderId, settings }` (no top-level `name`) — `BuilderSettingsHelper.loadFromAsset()` reads only `builderId` + `settings` and **ignores any extra top-level keys**, so the CLI's additional `name` (and any other extras) are harmless.

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
| `pubspec.yaml` | Add `chat_builder: { path: ./chat_builder }` to dependencies. Add `assets/` + `assets/sample_app/` to `flutter.assets`. Add font families `arial / inter / roboto / times New Roman` exactly as defined in `chat_builder/pubspec.yaml`. **As a `path:` dependency the `chat_builder` package carries its own transitive deps** (`get`, `shared_preferences`, `http`, `toast`, `path_provider`, `permission_handler`, `intl` per `chat_builder/pubspec.yaml`) and pub resolves them automatically — you do NOT list them in the host app. Only if you vendor `chat_builder`'s Dart files directly into your app (instead of using the `path:` dep) must you add those seven to your own `dependencies` |
| `lib/main.dart` | Insert `WidgetsFlutterBinding.ensureInitialized()` + `await BuilderSettingsHelper.loadFromAsset()` before `runApp()` |
| `ios/Podfile` | `platform :ios, '13.0'` (raise if lower) |
| `android/app/build.gradle.kts` | `ndkVersion = "27.0.12077973"`, **`minSdk = 26`** (REQUIRED — `cometchat_chat_uikit 6.0.1` pulls `cometchat_calls_sdk` transitively, which floors `minSdk` at 26; a default `flutter create` sets it lower and `flutter build apk` then fails with "uses-sdk:minSdkVersion … cannot be smaller than version 26 declared in library [cometchat_calls_sdk]") |
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

`BuilderSettingsHelper.loadFromAsset()` reads `assets/sample_app/cometchat-builder-settings.json` and populates the in-memory settings the `ChatBuilder.*` screens consume. Standard `CometChatUIKit.init(uiKitSettings: ...)` (see this file's `INIT_FIRST` rule) is still required and runs before any chat surface mounts.

> **`runApp(const MyApp())` above assumes you keep `flutter create`'s default `MyApp` class.** If you instead use the **Recommended** root below (`CometChatBuilderRoot`), you've renamed/removed `MyApp` — so also **delete or update `test/widget_test.dart`** (the default test instantiates `MyApp()` and will otherwise fail `flutter analyze` with `The name 'MyApp' isn't a class`). Pick ONE root-widget name and keep main.dart + the test file consistent. (Verified 2026-06-14: this orphaned test was the only `flutter analyze` error on a clean builder-export wiring.)

> **Extensions + AI features are dashboard-enabled in V6 — do NOT add V5-style `..extensions` / `..aiFeature` / `..callingExtension` setters.** Those three `UIKitSettingsBuilder` fields exist in the **V5** kit (and the builder reference app is V5-shaped — `chat_builder` pins `cometchat_chat_uikit ^5.2.x`, so its `InitializeCometChat.init()` passes them). They were **removed in V6** — adding them does not compile against `cometchat_chat_uikit ^6.0.1`. In V6 the extension-backed builder features (polls, collaborative whiteboard/document, stickers, message translation, reactions) and AI features are turned on in the **CometChat dashboard** (the builder enables them server-side) and the kit auto-wires them; calling is enabled with `..enableCalls = true`. So the V6 `UIKitSettingsBuilder` needs only `appId`/`region`/`authKey`/`subscriptionType` (+ `enableCalls` for calls) — the builder JSON's feature flags render because the features are enabled on the app, not because of a builder setter.

### Recommended: mount `ChatBuilder.createApp()` as the root

The cleanest integration mirrors the canonical's own `lib/main.dart`, which mounts `ChatBuilder.createApp()` directly as the app root and lets the package own init, theming, and call-navigation wiring:

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:chat_builder/builder/chat_builder.dart';
import 'package:chat_builder/builder/builder_settings_helper.dart';
// ...plus the package's prefs/page-manager bootstrap if you vendor those files

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await BuilderSettingsHelper.loadFromAsset();
  runApp(const CometChatBuilderRoot());
}

class CometChatBuilderRoot extends StatelessWidget {
  const CometChatBuilderRoot({super.key});

  @override
  Widget build(BuildContext context) => ChatBuilder.createApp();
}
```

`ChatBuilder.createApp()` returns a `MaterialApp` that already wires (a) `CometChatColorPalette` as a `ThemeData` extension in BOTH light and dark themes — this is what actually applies the builder's brand color + text colors to the kit, and (b) `navigatorKey: CallNavigationContext.navigatorKey` so incoming-call routing works. Use this path when CometChat owns the whole chat surface.

### Alternative: a host-app wrapper (when you can't mount `createApp()` as root)

If the host app already owns its root `MaterialApp` and you must mount CometChat as a sub-surface (a route/tab/dialog), hand-roll a wrapper — but you are then responsible for replicating what `createApp()` does for you: the theme palette and the navigator key.

```dart
// lib/cometchat/cometchat_app.dart
import 'package:flutter/material.dart';
import 'package:chat_builder/builder/chat_builder.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';

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
    // V6: extensions + AI features are dashboard-enabled and auto-wire — there
    // are NO ..extensions / ..aiFeature / ..callingExtension setters (those are
    // V5; see callout above). Add ..enableCalls = true if you need calling.
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
    // The bare Scaffold below does NOT apply the builder's theme palette.
    // If this wrapper owns the MaterialApp, replicate the canonical's
    // ThemeData (both light + dark) and navigatorKey — see note below.
    return Scaffold(
      resizeToAvoidBottomInset: true,
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

If this wrapper (or the host app) supplies the root `MaterialApp`, theme color/typography are honored ONLY if you wire `CometChatColorPalette` as a `ThemeData` extension and set the navigator key — both UNCONDITIONALLY, exactly as the canonical's `ChatBuilder.createApp()` does (it sets both regardless of whether calls are enabled):

```dart
MaterialApp(
  theme: ThemeData(
    fontFamily: /* builder typography font */,
    extensions: [
      CometChatColorPalette(
        textPrimary: /* builder light primary text */,
        textSecondary: /* builder light secondary text */,
        primary: /* builder brand color */,
      ),
    ],
  ),
  darkTheme: ThemeData(
    fontFamily: /* builder typography font */,
    extensions: [
      CometChatColorPalette(
        textPrimary: /* builder dark primary text */,
        textSecondary: /* builder dark secondary text */,
        primary: /* builder brand color */,
      ),
    ],
  ),
  // UNCONDITIONAL — the canonical wires this in every MaterialApp it builds,
  // not just when calls are enabled. Incoming-call routing needs it (Bug 1),
  // and gating it behind "calls enabled" breaks call routing if a feature flag
  // is flipped on later in the dashboard without a code change.
  navigatorKey: CallNavigationContext.navigatorKey,
  home: /* your chat surface */,
)
```

`ChatBuilder.launchBuilder(context)` opens the builder's login / dashboard flow; once a user is logged in, the package's internal navigation handles conversations → messages.

For direct deep-links into a specific user or group thread (skipping the dashboard), use:

```dart
ChatBuilder.launchMessages(context: context, user: user);
ChatBuilder.launchMessages(context: context, group: group);
```

These are the two public entry points the `chat_builder` package exposes — see `chat_builder/lib/builder/chat_builder.dart` (inside the Flutter Visual Builder ZIP at https://preview.cometchat.com/downloads/cometchat-builder-flutter.zip).

On `^6.0.1`, any `Scaffold` whose body chain reaches `CometChatMessageComposer` should use `resizeToAvoidBottomInset: true` (or omit it — `true` is the default), because the composer clamps the keyboard height to `viewInsets` (ENG-34434). See this file's `SCAFFOLD_NO_RESIZE` rule — `false` is only the pre-6.0.1 stopgap.

### Calls + builder

If any `VoiceAndVideoCalling.*` flag is enabled in the builder settings (e.g. `VoiceAndVideoCalling.oneOnOneVoiceCalling` — there is NO `CometChatBuilderSettings` type; the canonical app uses plain static-field holders like `VoiceAndVideoCalling`/`CoreMessagingExperience` in `builder_settings.dart`), the `chat_builder` package handles incoming/outgoing call surfaces internally (it ships its own call routes). External wiring still required:
1. Add `cometchat_calls_uikit` to `pubspec.yaml`
2. iOS `Info.plist` + Android `AndroidManifest.xml` permissions per `cometchat-flutter-v6-calls`
3. `navigatorKey: CallNavigationContext.navigatorKey` on the root `MaterialApp` — kit 6.0.1 requires this for incoming-call routing (Bug 1; see `cometchat-flutter-v6-calls` §1.7). Note the canonical wires this **unconditionally** in `ChatBuilder.createApp()` (it does NOT gate on whether calls are enabled), and the "Alternative: host-app wrapper" guidance above does the same — so if you mounted `ChatBuilder.createApp()` or followed that MaterialApp template, this is already in place
4. Push wiring — defer to `cometchat-flutter-v6-push`. The real token-registration API is `CometChatNotifications.registerPushToken(PushPlatforms.FCM_FLUTTER_ANDROID, fcmToken: …)`; a class named `PNRegistry` does **not** exist anywhere in the SDK or UI Kit (verified against `cometchat_sdk/lib/notification/main/cometchat_notifications.dart` 2026-06-03 — supersedes the inverted [[project_sdk_symbol_audit_2026_05_14]] claim)
5. **6.0.1 GA status:** the beta2 outgoing→in-call transition bug is FIXED in 6.0.1 ([[project_v6_flutter_calls_partial]]). V6 calls now work end-to-end once the navigatorKey line in step 3 is in place — V5 is no longer required for calls.

### What is NOT honored in v1

Skills emits a launch-button trigger, not the full multi-tab layout the `chat_builder` package's internal `Dashboard` provides. Customers get the dashboard once they tap "Open chat" — but the host-app surface is intentionally minimal so Step 3c placement (route, tab, dialog) can decide the mount shape. Chat-feature toggles ARE honored via the builder JSON. **Theme color + typography are honored ONLY if the mounted root is `ChatBuilder.createApp()` (or a `MaterialApp` that replicates its `CometChatColorPalette` `ThemeData` extension + `fontFamily`)** — the bare-`Scaffold` wrapper above does NOT apply that palette, so on that path the kit falls back to default colors. See the "Alternative: host-app wrapper" guidance for the exact `ThemeData` wiring. For deep customization beyond what the builder JSON allows, fall back to the code-driven path (see this file's standard placement pattern) and skip `chat_builder` entirely.
