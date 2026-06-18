# In-call chat on React Native

Same SDK API as web. RN-specific: BottomSheet panel UX (matches mobile patterns) + `Keyboard.dismiss()` lifecycle awareness when entering call.

**Canonical docs:** https://www.cometchat.com/docs/calls/react-native/in-call-chat
**Read first:** `cometchat-react-calls/references/in-call-chat.md` — group-as-session architecture + UX patterns + the four anti-patterns.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

// SessionSettings OBJECT field, not a builder method:
const settings = {
  hideChatButton: false,
};

// addEventListener returns the unsubscribe fn — call it on cleanup.
const off = CometChatCalls.addEventListener("onChatButtonClicked", () => setOpen(true));
// later: off();
CometChatCalls.setChatButtonUnreadCount(5);
```

Same as web. The group-as-session pattern (using a group with GUID == sessionID) carries over.

---

## BottomSheet panel — RN canonical UX

```tsx
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useRef, useEffect, useState } from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";
import {
  CometChatMessageList,
  CometChatMessageComposer,
} from "@cometchat/chat-uikit-react-native";

interface Props { sessionId: string; }

function InCallChatSheet({ sessionId }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const [group, setGroup] = useState<CometChat.Group>();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const handler = () => sheetRef.current?.snapToIndex(1);
    const off = CometChatCalls.addEventListener("onChatButtonClicked", handler);
    return () => off();
  }, []);

  useEffect(() => {
    CometChat.getGroup(sessionId).then(setGroup).catch(() => {});
  }, [sessionId]);

  // Track unread + clear on open (same logic as web; cite sister)
  // ...

  if (!group) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["10%", "75%"]}
      index={-1}                                 // start closed
      onChange={(i) => {
        if (i >= 1) {
          setUnread(0);
          CometChatCalls.setChatButtonUnreadCount(0);
        }
      }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        {/* flex-1 + minHeight:0 wrap pattern still applies on RN */}
        <View style={{ flex: 1, minHeight: 0 }}>
          <CometChatMessageList group={group} hideReplyInThreadOption />
        </View>
        <CometChatMessageComposer group={group} />
      </BottomSheetView>
    </BottomSheet>
  );
}
```

`@gorhom/bottom-sheet` is already a peer dep of the kit when RN calls are integrated (via `react-native-gesture-handler` + `react-native-reanimated`).

---

## Keyboard handling

When the chat sheet opens, the user types — keyboard appears, pushes call surface up. Two options:

### A — Use `KeyboardAvoidingView`

```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  style={{ flex: 1 }}
>
  <BottomSheet ...>
    {/* ... */}
  </BottomSheet>
</KeyboardAvoidingView>
```

### B — Use `keyboardVerticalOffset` from BottomSheet

Most BottomSheet libs have explicit keyboard handling. `@gorhom/bottom-sheet` v4+ ships `keyboardBehavior` and `keyboardBlurBehavior` options.

Critical: ensure the call's WebRTC video doesn't reflow when keyboard opens (already covered by `resizeToAvoidBottomInset: false` rule for iOS; on Android use `android:windowSoftInputMode="adjustNothing"` in the manifest for the call activity).

---

## Anti-patterns

Web sister rules apply, plus RN-specific:

1. **Default `windowSoftInputMode="adjustResize"`** on Android. Keyboard appears, the entire screen resizes — call's WebRTC view squishes, looks broken.
2. **`@gorhom/bottom-sheet` outside `GestureHandlerRootView`.** Sheet doesn't respond to drag gestures. Wrap your app's root in `GestureHandlerRootView` (also a kit requirement; see `cometchat-native-calls` SKILL.md).
3. **Chat sheet fullscreen by default.** Hides the call view; participants can't see who's talking. Default to ~30% snap, expand on demand.

---

## Verification checklist

- [ ] `@gorhom/bottom-sheet` in deps
- [ ] `GestureHandlerRootView` wraps the app
- [ ] BottomSheet has 2+ snap points (peek + expanded)
- [ ] AndroidManifest: call activity has `windowSoftInputMode="adjustNothing"` or `"adjustPan"`
- [ ] iOS Scaffold: `resizeToAvoidBottomInset: false` (RN's equivalent: KeyboardAvoidingView with right behavior)
- [ ] Real-device smoke: keyboard opens during chat, call view doesn't reflow
- [ ] Real-device smoke: 2 devices in call, send message from one → badge appears in other

---

## Pointers

- `cometchat-react-calls/references/in-call-chat.md` — sister web reference (group-as-session pattern)
- `cometchat-native-calls` SKILL.md — the seven hard rules
- `cometchat-android-v5-calls/references/in-call-chat.md` — Android V5 sibling
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/in-call-chat
