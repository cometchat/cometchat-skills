# Idle timeout on React Native

Same SDK API as web — `idleTimeoutPeriodBeforePrompt` + `idleTimeoutPeriodAfterPrompt` are SessionSettings **object fields** (ms), `onSessionTimedOut` event. RN-specific deltas are background-handling integration (call doesn't time out while the app is foregrounded; needs special handling in background) and the alert UI surface.

**Canonical docs:** https://www.cometchat.com/docs/calls/react-native/idle-timeout
**Read first:** `cometchat-react-calls/references/idle-timeout.md` — settings shape + recommended timeouts per archetype + custom prompt pattern.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

// SessionSettings OBJECT fields (ms) — NOT builder methods:
const settings = {
  idleTimeoutPeriodBeforePrompt: 60_000,
  idleTimeoutPeriodAfterPrompt: 120_000,
};

CometChatCalls.addEventListener("onSessionTimedOut", () => {
  navigation.navigate("Home");
  Alert.alert("Call ended", "You were inactive for too long");
});
```

---

## RN-specific: app state + idle interaction

**Background gotcha:** when the user backgrounds your app while the call is active, the idle timer keeps running. From the user's perspective, they backgrounded for 30s and came back to a "you've been timed out" screen. Bad UX.

Pause the timer when the app backgrounds:

```ts
import { AppState } from "react-native";

useEffect(() => {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      // App came back to foreground — reset alone-since timer
      // (Without SDK API to pause; reconfigure call settings is the workaround)
    } else if (state === "background") {
      // Pause your custom timer (Pattern A in the web ref)
    }
  });
  return () => sub.remove();
}, []);
```

If you're using the kit's default idle prompt UI, this is harder — kit doesn't expose a "pause timer" API. Use Pattern B from the web ref (long SDK timeouts + custom prompt + custom timer that respects AppState).

---

## Custom prompt — Alert vs Modal

`Alert.alert` is OS-native but blocks the call UI fully:

```ts
useEffect(() => {
  if (!showPrompt) return;
  const subscription = Alert.alert(
    "Still there?",
    "You're alone in this call. It'll end in 60 seconds.",
    [
      { text: "Stay", onPress: dismiss, style: "cancel" },
      { text: "End now", onPress: () => CometChatCalls.leaveSession(), style: "destructive" },
    ],
    { cancelable: false },
  );
}, [showPrompt]);
```

`Modal` lets you keep the call surface visible:

```tsx
<Modal
  visible={showPrompt}
  transparent
  animationType="fade"
  onRequestClose={dismiss}
>
  <View style={styles.overlay}>
    <View style={styles.dialog} accessible accessibilityRole="alert">
      <Text style={styles.title}>Still there?</Text>
      <Text>You're alone in this call. It'll end in 60 seconds.</Text>
      <View style={styles.row}>
        <TouchableOpacity onPress={dismiss}><Text>Stay</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => CometChatCalls.leaveSession()}>
          <Text style={{ color: "red" }}>End now</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

`accessibilityRole="alert"` is the RN equivalent of web's `role="alertdialog"`. TalkBack / VoiceOver pause to announce.

---

## Anti-patterns

Web sister reference rules apply, plus RN-specific:

1. **Idle timer running during background.** User backgrounds, comes back to "timed out." Pause via AppState listener.
2. **Using `Alert.alert` inside `useEffect`.** Blocks the call surface; can stack multiple alerts on rapid state changes. Use `Modal` for in-call UI.
3. **Forgetting `Modal` `accessible accessibilityRole="alert"`.** Screen readers miss the announcement.

---

## Verification checklist

- [ ] CallSettings sets both idle periods
- [ ] `onSessionTimedOut` navigates user away cleanly
- [ ] Custom prompt uses `Modal` with `accessibilityRole="alert"`, OR `Alert.alert` for OS-native
- [ ] AppState listener pauses custom timer on `background`
- [ ] Real-device smoke: backgroound app for 30s, return → call still active (timer paused correctly)
- [ ] Real-device smoke: 2 devices, hangup from one → timer fires on the other after configured delay

---

## Pointers

- `cometchat-react-calls/references/idle-timeout.md` — sister reference (settings, archetype timeouts, custom prompt pattern)
- `cometchat-native-calls` SKILL.md
- `references/voip-push-end-to-end.md` — interaction with VoIP push (background-mode call activation)
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/idle-timeout
