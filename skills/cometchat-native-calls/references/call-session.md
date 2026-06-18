# Call session — joinSession with no ringing (React Native)

Server-generated sessionId, both parties enter it; RN uses a **declarative `<CometChatCalls.Component>` render primitive**, NOT the imperative `joinSession(token, settings, container)` web pattern. Customer-validated against `calls-sdk-react-native-5/sample-apps/cometchat-calls-sample-app-react-native/src/pages/join-session/JoinSession.tsx`.

**Read first:** `cometchat-react-calls/references/call-session.md` — full architecture (sessionId strategies, server-side authorization, token generation). Then come back here for the RN-specific render shape.

---

## Hard rules (RN-specific overrides on top of the cross-platform rules)

1. **Render path, not imperative call.** RN's session mode uses `<CometChatCalls.Component callToken={token} />` — a React Native component that handles native rendering, permissions, and lifecycle internally. Do NOT call `CometChatCalls.joinSession(token, settings, viewRef)` — that is the web SDK shape and does not exist on RN session mode.
2. **State machine: `inMeeting` + `callToken`.** First effect generates the token when `inMeeting && sessionId` flips true; the component renders the call surface only when BOTH `inMeeting && callToken` are set.
3. **`onConnectionClosed`** is the cleanup event, not `onSessionLeft`. Fires on ANY termination.
4. **`CometChatCalls.init({ appId, region, authKey })`** — pass `authKey` at init time so `CometChatCalls.login(uid)` needs no second arg. Matches the sample.
5. **For standalone session-only integrations, the Chat SDK is OPTIONAL.** The upstream RN sample never imports `@cometchat/chat-sdk-react-native`. Keep dual-SDK only for additive (chat + calls) integrations.
6. **Permissions must be requested before mounting `<CometChatCalls.Component>`.** RN does not have browser auto-prompts; iOS Info.plist + Android manifest entries are necessary but not sufficient — you must `request()` at runtime via `react-native-permissions` or `PermissionsAndroid`.

---

## Component pattern (signals-style state + render switch)

```tsx
import { useState, useEffect } from 'react';
import { View, SafeAreaView } from 'react-native';
import { CometChatCalls } from '@cometchat/calls-sdk-react-native';

function CallRoom({ sessionId }: { sessionId: string }) {
  const [inMeeting, setInMeeting] = useState(false);
  const [callToken, setCallToken] = useState<string | null>(null);

  // Auto-join once we have a sessionId.
  useEffect(() => {
    if (sessionId) setInMeeting(true);
  }, [sessionId]);

  // Generate token when we flip into the meeting.
  useEffect(() => {
    if (inMeeting && sessionId) {
      CometChatCalls.generateToken(sessionId).then(({ token }) => {
        setCallToken(token);
      });
    }
  }, [inMeeting, sessionId]);

  // Reset state when the SDK reports the connection closed.
  useEffect(() => {
    const off = CometChatCalls.addEventListener('onConnectionClosed', () => {
      setInMeeting(false);
      setCallToken(null);
    });
    return () => off();
  }, []);

  if (inMeeting && callToken) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#141414' }}>
        <CometChatCalls.Component callToken={callToken} />
      </SafeAreaView>
    );
  }

  return null; // or your pre-call lobby UI
}
```

**Why this shape:**

- **`<CometChatCalls.Component callToken={...} />`** — the SDK's native React Native component handles the entire WebRTC lifecycle (peer connection, layout, controls, leave button). You don't pass settings; you don't manage a ref. The component IS the call surface.
- **`inMeeting && callToken` two-state gate** — token generation is async; rendering the call component before the token exists shows an empty call surface. Gate on both.
- **`onConnectionClosed`** — fires on ANY termination (peer left, network died, user hit the SDK's Leave button). Reset state on this, not on a separate `onSessionLeft`.
- **Container is `SafeAreaView`, not a `View` with measurable dimensions.** The Component sizes itself; wrapping in a non-flex container clips the call UI.

---

## Init + login (Calls SDK only, no Chat SDK for session-only)

```tsx
// App.tsx — or wherever you bootstrap
import { CometChatCalls } from '@cometchat/calls-sdk-react-native';

useEffect(() => {
  CometChatCalls.init({
    appId: APP_ID,
    region: REGION,
    authKey: AUTH_KEY,
  }).then(({ error }) => {
    if (error) console.error('Calls init failed', error);
  });
}, []);

// Login screen
CometChatCalls.login(uid).then((user) => {
  // user is the logged-in User_2; navigate to JoinSession
});
```

---

## Deep-link routing for meeting URLs

Configure `react-navigation`'s `linking`:

```tsx
const linking = {
  prefixes: ['https://yourapp.com', 'yourapp://'],
  config: {
    screens: {
      CallRoom: 'meet/:sessionId',
    },
  },
};

<NavigationContainer linking={linking}>...</NavigationContainer>
```

- **iOS:** enable Associated Domains entitlement (`applinks:yourapp.com`).
- **Android:** add `<intent-filter android:autoVerify="true">` to `AndroidManifest.xml` for the meet path.

See `share-invite.md` for full deep-link config.

---

## Permission request before joining

RN does not have browser auto-prompts. Request explicitly before flipping `inMeeting`:

```ts
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform } from 'react-native';

async function ensureCallPermissions() {
  const cam = await request(
    Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA,
  );
  const mic = await request(
    Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO,
  );
  if (cam !== RESULTS.GRANTED || mic !== RESULTS.GRANTED) {
    throw new Error('Camera/microphone permission denied');
  }
}
```

iOS `Info.plist`: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`. Android `AndroidManifest.xml`: `<uses-permission android:name="android.permission.CAMERA" />`, `<uses-permission android:name="android.permission.RECORD_AUDIO" />`.

---

## Anti-patterns

1. **Calling `CometChatCalls.joinSession(token, settings, viewRef)`.** That is the WEB SDK shape; RN session mode does not have this method. Use `<CometChatCalls.Component callToken={...} />` instead.
2. **Passing settings as a second arg anywhere.** RN session mode does not take settings — the component picks defaults.
3. **Rendering `<CometChatCalls.Component>` before the token resolves.** Empty call surface; user thinks the app is broken. Gate on `inMeeting && callToken`.
4. **Skipping the permission request.** First mount of the call component crashes when iOS asks for camera/mic if `NSCameraUsageDescription` is missing; on Android, the surface mounts but media stays muted.
5. **No `onConnectionClosed` listener.** User taps the SDK's in-call Leave button → media stops but `inMeeting` stays true → can't navigate away cleanly.
6. **Initializing Chat SDK for a session-only integration.** Wastes time and adds two extra failure modes. Drop `CometChat.init` / `CometChat.login` entirely for standalone session apps.
7. **Wrapping `<CometChatCalls.Component>` in a non-flex container.** Call UI clips to 0×0. Use `SafeAreaView` with `flex: 1` or a `View` with `flex: 1`.

---

## Verification checklist

- [ ] Container is `SafeAreaView` or `View` with `flex: 1`
- [ ] Render path uses `<CometChatCalls.Component callToken={callToken} />`, NOT `joinSession(token, settings, viewRef)`
- [ ] Gate on `inMeeting && callToken` (both, not either)
- [ ] `onConnectionClosed` listener resets both `inMeeting` and `callToken` to false/null
- [ ] Camera + microphone permissions requested at runtime BEFORE flipping `inMeeting`
- [ ] iOS `Info.plist` has `NSCameraUsageDescription` + `NSMicrophoneUsageDescription`
- [ ] Android `AndroidManifest.xml` has `CAMERA` + `RECORD_AUDIO` permissions
- [ ] Deep-link config + native intent filters in place
- [ ] **Standalone session-only:** no `CometChat.init` / `CometChat.login` — Calls SDK alone
- [ ] **Additive (chat + calls):** dual-SDK contract preserved (Chat first, then Calls)
- [ ] Real-device smoke: tap meeting link in WhatsApp → app opens at `/meet/:sessionId` → call component mounts → media flows

---

## Pointers

- `cometchat-react-calls/references/call-session.md` — cross-platform architecture (sessionId strategies, server authorization)
- `cometchat-native-calls/SKILL.md` — RN seven hard rules
- `cometchat-native-calls/references/share-invite.md` — deep-link config
- Upstream RN sample — `calls-sdk-react-native-5/sample-apps/cometchat-calls-sample-app-react-native/src/pages/join-session/JoinSession.tsx`
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/join-session
