# CometChat Calls iOS SDK v4 → v5 migration

`CometChatCallsSDK` v5 is a drop-in upgrade for v4 — bump the SwiftPM/CocoaPods version, your existing call code still compiles. Migrate to v5 APIs for granular events + simpler init.

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/migration-guide-v5

---

## Step 1 — Bump the SDK

**SwiftPM:** Update the `CometChatCallsSDK` package version pin to `5.0.0` or higher.

**CocoaPods:**
```ruby
# Podfile
pod 'CometChatCallsSDK', '~> 5.0'
```

```bash
pod install --repo-update
```

---

## Step 2 — Migrate init to plain struct

```diff
- let callAppSettings = CallAppSettings.Builder()
-   .setAppId("APP_ID")
-   .setRegion("REGION")
-   .build()
- CometChatCalls.init(with: callAppSettings) { error in
-   // ...
- }

+ let settings = CallAppSettings(appId: "APP_ID", region: "REGION")
+ try await CometChatCalls.init(with: settings)
```

V5 ships async/await. The completion-handler form still works for backwards compat.

---

## Step 3 — Add Calls SDK login

```swift
// After CometChat.login() resolves with a User:
let authToken = user.authToken
try await CometChatCalls.login(authToken: authToken)
```

After this, `generateToken()` and `joinSession()` no longer need an authToken parameter.

---

## Step 4 — Migrate session settings

```diff
- let callSettings = CallSettings.Builder()
-   .setSessionType(.video)
-   .startWithAudioMuted(false)
-   .showRecordingButton(true)
-   .build()

+ let sessionSettings = SessionSettings(
+   sessionType: .video,
+   startAudioMuted: false,
+   hideRecordingButton: false,    // INVERTED — was showRecordingButton(true)
+   layout: .tile
+ )
```

---

## Step 5 — Migrate events to delegates / closures

```diff
- // v4: implementing CometChatCallsEventsListener with all callbacks
- class MyCallEvents: CometChatCallsEventsListener {
-   func onCallEnded() { /* ... */ }
-   func onUserJoined(user: User) { /* ... */ }
-   func onUserLeft(user: User) { /* ... */ }
-   func onError(error: Error) { /* ... */ }
- }

+ // v5: granular subscriptions
+ let unsub1 = CometChatCalls.addEventListener(.sessionLeft) { _ in /* ... */ }
+ let unsub2 = CometChatCalls.addEventListener(.participantJoined) { participant in /* ... */ }
+ let unsub3 = CometChatCalls.addEventListener(.participantLeft) { participant in /* ... */ }
+
+ // Cleanup
+ deinit { unsub1(); unsub2(); unsub3() }
```

---

## Step 6 — Method renames

```diff
// session lifecycle — receiver changed from CometChatCalls (static) to CallSession.shared (singleton)
- CometChatCalls.endSession()
+ CallSession.shared.leaveSession()

- CometChatCalls.muteAudio(true)
+ CallSession.shared.muteAudio()
- CometChatCalls.muteAudio(false)
+ CallSession.shared.unmuteAudio()

- CometChatCalls.startScreenShare()
+ CallSession.shared.startScreenShare()

// layout stays static on CometChatCalls
- CometChatCalls.setMode(mode)
+ CometChatCalls.setLayout(layout)
```

**Hold onto the `CallSession.shared` singleton** — most in-call APIs (mute, video, screen-share, layout-events, leave) live on it, not on `CometChatCalls`. Same shift the Android SDK did in v5; if you've been writing call code against v4's static-method-everything pattern, this is the biggest re-org.

---

## Verification checklist

- [ ] Podfile / Package.swift updated
- [ ] `pod install --repo-update` (CocoaPods) or SwiftPM resolved cleanly
- [ ] `CometChatCalls.login(authToken:)` called after `CometChat.login`
- [ ] CallSettings.Builder replaced with `SessionSettings` struct
- [ ] CometChatCallsEventsListener replaced with `addEventListener`
- [ ] Method renames applied
- [ ] PushKit + CallKit integration still works (no v5 changes there)
- [ ] Real-device smoke: incoming call from iPhone → answer → mute → end

---

## Pointers

- Canonical migration: https://www.cometchat.com/docs/calls/ios/migration-guide-v5
- `cometchat-ios-calls/SKILL.md` — seven hard rules (still apply post-v5)
- `cometchat-ios-calls/references/server-apns-pushkit.md` — PushKit setup (unchanged in v5)
