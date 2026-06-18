# CometChat Calls Flutter SDK v4 → v5 migration (raw SDK)

Moving the **Calls SDK** from 4.x to **`cometchat_calls_sdk ^5.0.2`** on the Flutter V5 (GetX) chat UI Kit — per the product decision that all families use the V5 calls SDK.

**Important:** This migrates the **Calls SDK** (4.x → 5.x), not the chat UI Kit cohort (V5 GetX → V6 Bloc, which is `cometchat-flutter-v6-migration`). The chat UI Kit stays on V5 GetX; only the calls layer changes.

> **Why you can't just bump `cometchat_calls_uikit`.** The latest `cometchat_calls_uikit` (5.0.16) still transitively pins `cometchat_calls_sdk ^4.2.2`, and its prebuilt call widgets (`CometChatCallButtons`/`CometChatIncomingCall`/`CometChatOutgoingCall`/`CometChatOngoingCall`) are compiled against the 4.x API. To run the 5.x calls SDK you **drop `cometchat_calls_uikit`** and integrate the **raw `cometchat_calls_sdk ^5.0.2`** directly with a custom call surface.

**Substrate of record:** `~/.pub-cache/hosted/pub.dev/cometchat_calls_sdk-5.0.2/lib/`
**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/migration-guide-v5

---

## Step 1 — Swap the dependency

```diff
  # pubspec.yaml
  dependencies:
    cometchat_chat_uikit: ^5.2.14     # chat UI Kit stays on V5 (GetX)
-   cometchat_calls_uikit: ^5.0.15    # 4.x-bound — remove
+   cometchat_calls_sdk: ^5.0.2       # raw 5.x calls SDK (direct dependency)
```

```bash
flutter pub get
cd ios && pod install     # if you have iOS
```

---

## Step 2 — Migrate init

`init` takes a `CallAppSettings` built via `CallAppSettingBuilder` (`src/builder/call_app_settings_request.dart:36`) and runs with `onSuccess`/`onError` callbacks (`cometchatcalls.dart:172`).

```diff
- final callSettings = CallAppSettingsBuilder()
-   ..setAppId('APP_ID')
-   ..setRegion('REGION');
- await CometChatCalls.init(callSettings);

+ final callAppSettings = (CallAppSettingBuilder()
+       ..appId = 'APP_ID'
+       ..region = 'REGION')
+     .build();
+ CometChatCalls.init(
+   callAppSettings,
+   onSuccess: (String s) {},
+   onError: (CometChatCallsException e) {},
+ );
```

---

## Step 3 — Add the 5.x Calls SDK login

4.x had no calls login (it took a per-call auth token). 5.x has its own login that caches the token internally (`cometchatcalls.dart:316`).

```dart
// After CometChat.login completes:
final authToken = await CometChat.getUserAuthToken();  // static; no User.getAuthToken() method
if (authToken != null) {
  CometChatCalls.loginWithAuthToken(
    authToken: authToken,
    onSuccess: (user) {},
    onError: (CometChatCallsException e) {},
  );
}
```

---

## Step 4 — Migrate session settings

`SessionSettingsBuilder` replaces `CallSettingsBuilder` (the latter is `@Deprecated`, `src/builder/call_settings.dart:209`). Methods are chainable / cascade setters (`src/builder/session_settings.dart`).

```diff
- final callSettings = (CallSettingsBuilder()
-   ..setSessionType(SessionType.video)
-   ..startWithAudioMuted(false)
-   ..showRecordingButton(true))
-   .build();

+ final sessionSettings = (SessionSettingsBuilder()
+       ..setType(SessionType.video)        // session_settings.dart:197
+       ..startAudioMuted(false)            // :173
+       ..startVideoPaused(false)           // :167
+       ..setLayout(LayoutType.tile)        // :179
+       ..hideRecordingButton(false))       // :227 (INVERTED sense vs show*)
+     .build();
```

---

## Step 5 — Migrate the listener to the 5 split listeners

The single `CometChatCallsEventsListener` is `@Deprecated` (`src/listener/cometchat_calls_events_listener.dart:16`). 5.x splits events across `SessionStatusListeners`, `ParticipantEventListeners`, `MediaEventListeners`, `ButtonClickListeners`, `LayoutListeners` — registered on `CallSession.getInstance()` (after `joinSession.onSuccess`).

```diff
- class MyEvents implements CometChatCallsEventsListener {
-   @override
-   void onCallEnded() { /* ... */ }
-   @override
-   void onUserJoined(RTCUser user) { /* ... */ }
-   // ...
- }
- CometChatCalls.addCallsEventListeners('id', MyEvents());

+ class MyEvents implements SessionStatusListeners, ParticipantEventListeners {
+   @override
+   void onSessionLeft() { /* was onCallEnded */ }       // session_status_listeners.dart:10
+   @override
+   void onParticipantJoined(Participant p) { /* was onUserJoined */ }  // participant_event_listeners.dart:12
+   @override
+   void onParticipantLeft(Participant p) { /* was onUserLeft */ }      // :15
+   // ... remaining interface methods (no-ops or pass-through)
+ }
+
+ // inside joinSession.onSuccess:
+ final events = MyEvents();
+ CallSession.getInstance()?.addSessionStatusListener(events);     // call_session.dart:66
+ CallSession.getInstance()?.addParticipantEventListener(events);  // :74
+
+ @override
+ void dispose() {
+   CallSession.getInstance()?.removeSessionStatusListener(events);
+   CallSession.getInstance()?.removeParticipantEventListener(events);
+   super.dispose();
+ }
```

---

## Step 6 — Start/join + control method renames + receiver shift

The two-step `generateToken` + `startSession` collapses into a single `joinSession` (`cometchatcalls.dart:735`). In-call controls move from static methods on `CometChatCalls` to **instance methods on `CallSession`** (the singleton via `CallSession.getInstance()`).

```diff
// start the session
- CometChatCalls.generateToken(sessionId, authToken, onSuccess: (t) {
-   CometChatCalls.startSession(t.token!, callSettings, onSuccess: (w) {}, onError: (e) {});
- }, onError: (e) {});
+ CometChatCalls.joinSession(
+   sessionId: sessionId,                 // SDK mints the call token internally
+   sessionSettings: sessionSettings,
+   onSuccess: (Widget? w) {},
+   onError: (CometChatCallsException e) {},
+ );

// teardown — receiver changes from CometChatCalls (static) to CallSession (singleton)
- CometChatCalls.endSession(onSuccess: (_) {}, onError: (e) {})
+ await CallSession.getInstance()?.leaveSession()            // call_session.dart:272

// media controls — same receiver shift, now no-arg
- CometChatCalls.muteAudio()
+ CallSession.getInstance()?.muteAudio()                     // call_session.dart:131
+ CallSession.getInstance()?.unMuteAudio()                   // :145
- CometChatCalls.pauseVideo() / resumeVideo()
+ CallSession.getInstance()?.pauseVideo() / resumeVideo()    // :168 / :182

// layout — also moves to the instance (NOT static in 5.x)
- CometChatCalls.setLayout(CallLayout.spotlight)
+ CallSession.getInstance()?.setLayout(LayoutType.spotlight) // :394
```

**`CallSession.getInstance()` returns `CallSession?` (nullable)** — null when there's no active session. Use `?.` to safely chain.

---

## Step 7 — GetX state preservation

If you use GetX controllers around the calls (per `cometchat-flutter-v5-calls/SKILL.md`), the state shape doesn't change — only the underlying SDK calls. Sample diff in a GetX controller:

```diff
  class CallController extends GetxController {
    void startCall(String sessionId) async {
-     await CometChatCalls.startSession(callToken, settings: callSettings);
+     CometChatCalls.joinSession(sessionId: sessionId, sessionSettings: sessionSettings,
+       onSuccess: (w) {}, onError: (e) {});
    }

    void endCall() async {
-     CometChatCalls.endSession();
+     await CallSession.getInstance()?.leaveSession();
    }
  }
```

---

## Verification checklist

- [ ] `pubspec.yaml` lists `cometchat_calls_sdk: ^5.0.2` and NO `cometchat_calls_uikit`
- [ ] `flutter pub get` + `pod install` succeed
- [ ] `CometChatCalls.loginWithAuthToken(authToken:)` called after `CometChat.login`
- [ ] `CallSettingsBuilder` replaced with `SessionSettingsBuilder`
- [ ] Single `CometChatCallsEventsListener` replaced with the 5 split listeners on `CallSession.getInstance()`
- [ ] `generateToken` + `startSession` collapsed into `joinSession(sessionId:, sessionSettings:, ...)`
- [ ] In-call controls + `leaveSession` moved to `CallSession.getInstance()?.X()`
- [ ] Prebuilt `cometchat_calls_uikit` call widgets removed; custom call surface in place
- [ ] Real-device smoke: iOS + Android, incoming/outgoing/mute/layout/leave

---

## Pointers

- Canonical migration: https://www.cometchat.com/docs/calls/flutter/migration-guide-v5
- `cometchat-flutter-v5-calls/SKILL.md` — Flutter calls architecture on the 5.x SDK (GetX patterns)
- `cometchat-flutter-v5-calls/references/call-session.md` — canonical 5.x SDK API surface
- `cometchat-flutter-v6-calls/` — V6 cohort (Bloc) on the SAME 5.0.2 calls SDK
```