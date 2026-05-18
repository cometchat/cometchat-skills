# Ringing — call signaling with custom UI (React Native)

Same SDK shape as web; RN-specific deltas: navigation-aware listener mount, CallKeep + VoIP push for backgrounded ring delivery, audio file paths via require.

**Read first:** `cometchat-react-calls/references/ringing-integration.md` — full architecture, hard rules, web reference.

---

## SDK API

```ts
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

const call = new CometChat.Call(
  receiverUid,
  CometChat.CALL_TYPE.VIDEO,
  CometChat.RECEIVER_TYPE.USER,
);
const outgoingCall = await CometChat.initiateCall(call, 60);
```

---

## Listener mount: at NavigationContainer root, NOT inside a screen

```tsx
// App.tsx — sibling of NavigationContainer's content
import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";

export default function App() {
  useCometChatCallListener();
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

function useCometChatCallListener() {
  useEffect(() => {
    CometChat.addCallListener("app", new CometChat.CallListener({
      onIncomingCallReceived: (call) => navigationRef.current?.navigate("IncomingCall", { call }),
      onOutgoingCallAccepted: (call) => navigationRef.current?.navigate("ActiveCall", { sessionId: call.getSessionId() }),
      onIncomingCallCancelled: () => navigationRef.current?.goBack(),
      onOutgoingCallRejected: () => navigationRef.current?.goBack(),
      onCallEndedMessageReceived: () => navigationRef.current?.popToTop(),
    }));
    return () => CometChat.removeCallListener("app");
  }, []);
}
```

Use a `navigationRef` (per `@react-navigation/native` docs) so listener callbacks can navigate without prop-drilling.

---

## Backgrounded ring delivery — VoIP push is the bridge

When the app is backgrounded or killed, `addCallListener` doesn't fire — the JS bundle isn't running. **VoIP push** wakes the app + surfaces the ring via CallKit (iOS) / ConnectionService (Android). On accept, route the user to the same screen the foreground listener would.

Wire VoIP push per `cometchat-native-calls/references/server-push-bridge.md`. Server fires push → CallKeep shows OS-level UI → user taps Accept → app launches/foregrounds → call session starts.

---

## Ringtone via expo-av or react-native-sound

```tsx
import { Audio } from "expo-av";  // Expo
// OR: import Sound from "react-native-sound";

let ringtoneSound: Audio.Sound | null = null;

async function playRingtone() {
  ringtoneSound = new Audio.Sound();
  await ringtoneSound.loadAsync(require("../assets/ringtone.mp3"));
  await ringtoneSound.setIsLoopingAsync(true);
  await ringtoneSound.playAsync();
}

async function stopRingtone() {
  await ringtoneSound?.stopAsync();
  await ringtoneSound?.unloadAsync();
  ringtoneSound = null;
}
```

For backgrounded ring, **don't** play ringtone from JS — CallKit/ConnectionService plays the system ringtone. JS-side ringtone is for in-foreground ringing only.

---

## Anti-patterns

Web sister rules apply, plus RN-specific:

1. **`addCallListener` inside a screen component.** Listener tears down on screen unmount → backgrounded calls miss.
2. **Expecting `addCallListener` to fire when app is killed.** It doesn't — VoIP push is the only way. If you skipped VoIP push, your "background ring" doesn't work.
3. **Playing JS ringtone during a CallKit/ConnectionService ring.** Two ringtones at once. Suppress JS-side when OS UI is active.

---

## Verification checklist

- [ ] Listener registered at NavigationContainer level
- [ ] navigationRef wired (forwards refs from listener callbacks)
- [ ] VoIP push registered for backgrounded ring delivery
- [ ] Ringtone plays in foreground only (suppressed when CallKit/ConnectionService active)
- [ ] Real-device smoke: 2 phones, foreground ring, backgrounded ring, killed-app ring all work

---

## Pointers

- `cometchat-react-calls/references/ringing-integration.md` — canonical (architecture + hard rules)
- `cometchat-native-calls/SKILL.md` — RN seven hard rules
- `cometchat-native-calls/references/server-push-bridge.md` — VoIP push for backgrounded ring
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/ringing
