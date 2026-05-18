# CometChat Calls Flutter SDK v4 → v5 migration

`cometchat_calls_uikit: ^5.0.15` is the v5 calls package for Flutter — drop-in replacement for the v4 calls SDK.

**Important:** This migrates the **Calls SDK** (v4 → v5), not the UI Kit cohort (V5 GetX → V6 Bloc, which is `cometchat-flutter-v6-migration`). You can be on UI Kit V5 + Calls SDK v5 — they version independently.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/migration-guide-v5

---

## Step 1 — Bump pubspec

```yaml
# pubspec.yaml
dependencies:
  cometchat_calls_uikit: ^5.0.15
```

```bash
flutter pub get
cd ios && pod install     # if you have iOS
```

---

## Step 2 — Migrate init

```diff
- final callSettings = CallAppSettingsBuilder()
-   ..setAppId('APP_ID')
-   ..setRegion('REGION');
- await CometChatCalls.init(callSettings);

+ final settings = CallAppSettings(appId: 'APP_ID', region: 'REGION');
+ await CometChatCalls.init(settings);
```

---

## Step 3 — Add Calls SDK login

```dart
// After CometChat.login completes
final user = (await CometChatUIKit.getLoggedInUser())!;
final authToken = user.authToken;
await CometChatCalls.login(authToken: authToken);
```

---

## Step 4 — Migrate session settings

```diff
- final callSettings = CallSettingsBuilder()
-   ..setSessionType(SessionType.video)
-   ..startWithAudioMuted(false)
-   ..showRecordingButton(true);

+ final sessionSettings = SessionSettings(
+   sessionType: SessionType.video,
+   startAudioMuted: false,
+   hideRecordingButton: false,    // INVERTED
+   layout: CallLayout.tile,
+ );
```

---

## Step 5 — Migrate listener to event subscriptions

```diff
- class MyEvents implements CometChatCallsEventsListener {
-   @override
-   void onCallEnded() { /* ... */ }
-   @override
-   void onUserJoined(User user) { /* ... */ }
-   // ...
- }
- CometChatCalls.addCallsEventsListener('id', MyEvents());

+ final unsub1 = CometChatCalls.addEventListener(CallEvent.sessionLeft, () { /* ... */ });
+ final unsub2 = CometChatCalls.addEventListener(CallEvent.participantJoined, (participant) { /* ... */ });
+ final unsub3 = CometChatCalls.addEventListener(CallEvent.participantLeft, (participant) { /* ... */ });
+
+ @override
+ void dispose() {
+   unsub1.call();
+   unsub2.call();
+   unsub3.call();
+   super.dispose();
+ }
```

---

## Step 6 — Method renames + receiver shift

v5 moved most call-control APIs from static methods on `CometChatCalls` to **instance methods on `CallSession`** (the singleton fetched via `CallSession.getInstance()`). The static `endSession()` is preserved as a deprecated shim — the others were removed.

```diff
// session lifecycle — receiver changes from CometChatCalls (static) to CallSession (singleton)
- CometChatCalls.endSession()
+ await CallSession.getInstance()?.leaveSession()

// media controls — same receiver shift
- CometChatCalls.muteAudio(true)
+ CallSession.getInstance()?.muteAudio()
- CometChatCalls.muteAudio(false)
+ CallSession.getInstance()?.unmuteAudio()

- CometChatCalls.startScreenShare()
+ CallSession.getInstance()?.startScreenShare()

// layout stays static
- CometChatCalls.setMode(mode)
+ CometChatCalls.setLayout(layout)
```

**`CallSession.getInstance()` returns `CallSession?` (nullable)** — null when there's no active session. Use `?.` to safely chain; calling on null is a no-op.

---

## Step 7 — GetX state preservation

If you're using GetX controllers around the calls (per `cometchat-flutter-v5-calls/SKILL.md`), the state shape doesn't change — only the underlying SDK calls. Sample diff in a GetX controller:

```diff
  class CallController extends GetxController {
    void startCall(String sessionId) async {
-     await CometChatCalls.startSession(sessionId, settings: callSettings);
+     await CometChatCalls.joinSession(sessionId, settings: sessionSettings);
    }

    void endCall() async {
-     CometChatCalls.endSession();
+     await CallSession.getInstance()?.leaveSession();
    }
  }
```

---

## Verification checklist

- [ ] `pubspec.yaml` lists `cometchat_calls_uikit: ^5.0.15` (or higher)
- [ ] `flutter pub get` + `pod install` succeed
- [ ] `CometChatCalls.login(authToken:)` called after `CometChat.login`
- [ ] CallSettingsBuilder replaced with `SessionSettings`
- [ ] CometChatCallsEventsListener replaced with `addEventListener`
- [ ] Method renames applied
- [ ] GetX controllers updated to v5 method names
- [ ] Real-device smoke: iOS + Android, incoming/outgoing/mute/screenshare

---

## Pointers

- Canonical migration: https://www.cometchat.com/docs/calls/flutter/migration-guide-v5
- `cometchat-flutter-v5-calls/SKILL.md` — Flutter calls architecture (GetX patterns)
- `cometchat-flutter-v6-calls/` — V6 cohort (Bloc); V6 starts on Calls SDK v5 — no migration needed
