# Calls SDK v4 → v5 migration (web)

CometChat Calls SDK v5 is a **drop-in replacement** for v4 — bump the package, your existing code keeps working through deprecation shims. Migrate to v5 APIs to get granular event listeners, simpler init, and strongly-typed enums.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/migration-guide-v5

---

## Step 1 — Bump the package

```bash
npm install @cometchat/calls-sdk-javascript@5
```

If you're using CometChat UI Kits, this is enough — the kit's calls integration uses the v4 deprecated layer. **You can ship to production at this step** and migrate v5 APIs incrementally.

---

## Step 2 — Migrate init (optional but cleaner)

```diff
- const callAppSettings = new CometChatCalls.CallAppSettingsBuilder()
-   .setAppId("APP_ID")
-   .setRegion("REGION")
-   .build();
- await CometChatCalls.init(callAppSettings);

+ await CometChatCalls.init({ appId: "APP_ID", region: "REGION" });
```

---

## Step 3 — Add `login()` after Chat SDK login

v5 introduces a dedicated Calls SDK auth step. After the user logs into the Chat SDK, call:

```ts
const authToken = (await CometChat.getLoggedinUser())!.getAuthToken();
await CometChatCalls.login(authToken);
```

After this, `generateToken()` and `joinSession()` no longer need an authToken parameter.

---

## Step 4 — Migrate session settings to plain object

```diff
- const callSettings = new CometChatCalls.CallSettingsBuilder()
-   .setIsAudioOnlyCall(true)
-   .showRecordingButton(true)
-   .startWithAudioMuted(false)
-   .build();

+ const sessionSettings = {
+   sessionType: "VOICE",       // was setIsAudioOnlyCall(true)
+   hideRecordingButton: false,  // was showRecordingButton(true) — INVERTED
+   startAudioMuted: false,
+   layout: "TILE",
+ };
```

**Watch out:** the boolean logic is **inverted** for many settings (v4 `show*` → v5 `hide*`). Search-and-replace doesn't work — review each manually.

---

## Step 5 — Migrate events to granular listeners

```diff
- const callSettings = new CometChatCalls.CallSettingsBuilder()
-   .setCallListener(new CometChatCalls.OngoingCallListener({
-     onCallEnded: () => { /* ... */ },
-     onUserJoined: (user) => { /* ... */ },
-     onUserLeft: (user) => { /* ... */ },
-     onError: (error) => { /* ... */ },
-   }))
-   .build();

+ const unsub1 = CometChatCalls.addEventListener("onSessionLeft", () => { /* ... */ });
+ const unsub2 = CometChatCalls.addEventListener("onParticipantJoined", (p) => { /* ... */ });
+ const unsub3 = CometChatCalls.addEventListener("onParticipantLeft", (p) => { /* ... */ });
+ // Errors now come back via Promise rejection from joinSession() etc.
+
+ // Cleanup
+ return () => { unsub1(); unsub2(); unsub3(); };
```

**Event-name mapping (most common):**

| v4 | v5 |
|---|---|
| `onCallEnded` | `onSessionLeft` |
| `onCallEndButtonPressed` | `onLeaveSessionButtonClicked` |
| `onUserJoined(user)` | `onParticipantJoined(participant)` |
| `onUserLeft(user)` | `onParticipantLeft(participant)` |
| `onUserListUpdated(list)` | `onParticipantListChanged(list)` |
| `onUserMuted(info)` | `onParticipantAudioMuted(participant)` |
| `onRecordingToggled(info)` | `onRecordingStarted` / `onRecordingStopped` |

---

## Step 6 — Migrate session control method names

```diff
- CometChatCalls.endSession()
+ CometChatCalls.leaveSession()

- CometChatCalls.muteAudio(true)
+ CometChatCalls.muteAudio()
- CometChatCalls.muteAudio(false)
+ CometChatCalls.unmuteAudio()

- CometChatCalls.pauseVideo(true)
+ CometChatCalls.pauseVideo()
- CometChatCalls.pauseVideo(false)
+ CometChatCalls.resumeVideo()

- CometChatCalls.setMode(mode)
+ CometChatCalls.setLayout(layout)

- CometChatCalls.startScreenShare()
+ CometChatCalls.startScreenSharing()

- CometChatCalls.enterPIPMode()
+ CometChatCalls.enablePictureInPictureLayout()
```

---

## Step 7 — `startSession` → `joinSession`

```diff
- CometChatCalls.generateToken(sessionId, authToken).then((token) => {
-   CometChatCalls.startSession(token, callSettings, container);
- });

+ CometChatCalls.generateToken(sessionId).then((token) => {
+   CometChatCalls.joinSession(token, sessionSettings, container);
+ });
+
+ // Or — pass the sessionId directly (no manual token mint):
+ CometChatCalls.joinSession(sessionId, sessionSettings, container);
```

---

## Removed methods (no v5 replacement)

- `CometChatCalls.switchToVideoCall()` — start a fresh session with `sessionType: "VIDEO"` instead
- `CometChatCalls.getCallDetails()` — track session state via events

---

## Verification checklist

- [ ] `package.json` lists `@cometchat/calls-sdk-javascript@^5`
- [ ] `await CometChatCalls.login(authToken)` called after `CometChat.login`
- [ ] `OngoingCallListener` removed; granular `addEventListener` calls in place with cleanup
- [ ] `startSession` replaced with `joinSession`
- [ ] `endSession` replaced with `leaveSession`
- [ ] Inverted booleans audited (show* → hide* with `!`)
- [ ] No use of removed methods (`switchToVideoCall`, `getCallDetails`)
- [ ] Existing call flows tested end-to-end (incoming, accept, mute, screen-share, end)

---

## Pointers

- Canonical migration guide: https://www.cometchat.com/docs/calls/javascript/migration-guide-v5
- `cometchat-react-calls/SKILL.md` — current architecture (v5)
- `cometchat-react-calls/references/call-layouts.md` — layout enum migration
- `cometchat-react-calls/references/recording.md` — recording events migration
