# Calls SDK v4 → v5 migration (React Native)

`@cometchat/calls-sdk-react-native@5` is a drop-in replacement for v4. Same migration shape as web; RN deltas focus on the native modules that calls SDK depends on.

**Read first:** `cometchat-react-calls/references/migration-v4-to-v5.md` — canonical step-by-step (init, login, settings, events, methods).

---

## Step 1 — Bump the package + native modules

```bash
npm install @cometchat/calls-sdk-react-native@5
cd ios && pod install
```

If you upgraded `react-native-webrtc` along with the calls SDK, run:

```bash
# iOS
cd ios && rm -rf Pods Podfile.lock && pod install
# Android (Gradle handles it on next build)
```

---

## Step 2 — Verify native dependencies are still valid

Calls SDK v5 doesn't change the native module list, but versions matter. Check `package.json`:

```json
{
  "dependencies": {
    "@cometchat/calls-sdk-react-native": "^5.0.0",
    "react-native-webrtc": ">=124",
    "react-native-incall-manager": ">=4",
    "react-native-callstats": ">=3",
    "@react-native-community/netinfo": "*"
  }
}
```

If any of these are stale, calls may fail silently with WebRTC negotiation errors.

---

## Migration steps (same as web)

1. Migrate init to plain object
2. Add `CometChatCalls.login(uid, authKey)` after `CometChat.login` (UID-based; the auth-token form is `CometChatCalls.loginWithAuthToken(authToken)` — verified against calls-sdk-react-native `skills/setup` + `skills/migration-v4-to-v5`)
3. Replace `CallSettingsBuilder` with plain `sessionSettings` object — **watch inverted booleans** (`show*` → `hide*`)
4. Replace `OngoingCallListener` with `addEventListener` calls
5. Rename methods: `endSession` → `leaveSession`; `setMode('DEFAULT')` → the `sessionSettings.layout: 'SIDEBAR'` prop (DEFAULT maps to SIDEBAR). An imperative `CometChatCalls.setLayout('TILE' | 'SIDEBAR' | 'SPOTLIGHT')` does exist for runtime layout changes (calls-sdk-react-native `skills/custom-ui`). **RN has no imperative `joinSession`/`startSession`** — on RN the session is the declarative `<CometChatCalls.Component callToken={...} />` primitive (mint the token with `CometChatCalls.generateToken(sessionId)` and render the Component). There is no start/join method to call.
6. Cleanup: `addEventListener` returns an unsubscribe — call it on unmount

---

## Verification checklist

- [ ] All canonical steps from `cometchat-react-calls/references/migration-v4-to-v5.md`
- [ ] `pod install` re-run after upgrade
- [ ] Native modules at compatible versions
- [ ] Real-device test: 2 phones (iOS + Android), incoming call, mute, screen-share, end
- [ ] CallKeep + VoipPushNotification still register tokens correctly
- [ ] Background incoming call (recipient app killed) still rings

---

## Pointers

- Canonical migration: `cometchat-react-calls/references/migration-v4-to-v5.md`
- `cometchat-native-calls/SKILL.md` — RN seven hard rules
- https://www.cometchat.com/docs/calls/react-native/migration-guide-v5
