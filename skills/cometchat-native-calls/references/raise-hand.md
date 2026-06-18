# Raise hand on React Native

Same SDK API as web (`@cometchat/calls-sdk-react-native` exposes the same calls). The difference is the UI surface — native components instead of HTML, RN re-renders with state, no `aria-pressed` (use `accessibilityState` instead).

**Canonical docs:** https://www.cometchat.com/docs/calls/react-native/raise-hand
**Read first:** `cometchat-react-calls/references/raise-hand.md` — the integration shape and anti-patterns are identical; this reference covers RN-specific wiring.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

CometChatCalls.raiseHand();
CometChatCalls.lowerHand();

// addEventListener returns an unsubscribe function — capture it, call it in cleanup.
const off = CometChatCalls.addEventListener("onParticipantHandRaised", (p) => { ... });
// later: off();

// Button visibility is a SessionSettings OBJECT field, not a builder method:
const settings = {
  hideRaiseHandButton: true,
};
```

---

## RN-specific UX patterns

### Toggle button (TouchableOpacity)

```tsx
import { useState } from "react";
import { TouchableOpacity, Text, AccessibilityInfo } from "react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

function RaiseHandButton() {
  const [raised, setRaised] = useState(false);

  function toggle() {
    if (raised) {
      CometChatCalls.lowerHand();
      setRaised(false);
      AccessibilityInfo.announceForAccessibility("Hand lowered");
    } else {
      CometChatCalls.raiseHand();
      setRaised(true);
      AccessibilityInfo.announceForAccessibility("Hand raised");
    }
  }

  return (
    <TouchableOpacity
      onPress={toggle}
      accessibilityRole="button"
      accessibilityState={{ selected: raised }}
      accessibilityLabel={raised ? "Lower hand" : "Raise hand"}
      style={{
        padding: 12,
        borderRadius: 32,
        backgroundColor: raised ? "#FFD60A" : "rgba(255,255,255,0.2)",
      }}
    >
      <Text style={{ color: raised ? "#000" : "#FFF" }}>
        ✋ {raised ? "Lower" : "Raise"}
      </Text>
    </TouchableOpacity>
  );
}
```

`AccessibilityInfo.announceForAccessibility` is the RN equivalent of web's `aria-live` regions — TalkBack / VoiceOver pick up the announcement. This is the canonical RN a11y pattern (cf. `cometchat-a11y`).

### Raised-hands roster (BottomSheet pattern)

For a host's "raised hands" list, the natural RN UX is a bottom sheet rather than a permanent sidebar (vertical phone screens are tight on horizontal real estate):

```tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

interface RaisedParticipant { uid: string; name: string; raisedAt: number; }

function RaisedHandsSheet() {
  const sheetRef = useRef<BottomSheet>(null);
  const [raised, setRaised] = useState<Map<string, RaisedParticipant>>(new Map());

  useEffect(() => {
    const onRaised = (p: { uid: string; name: string }) => {
      setRaised(prev => new Map(prev).set(p.uid, { ...p, raisedAt: Date.now() }));
      // Auto-expand the sheet on first hand raised
      if (raised.size === 0) sheetRef.current?.snapToIndex(1);
    };
    const onLowered = (p: { uid: string }) => {
      setRaised(prev => {
        const next = new Map(prev);
        next.delete(p.uid);
        return next;
      });
    };

    // addEventListener returns an unsubscribe fn; collect them and call on cleanup.
    const offRaised = CometChatCalls.addEventListener("onParticipantHandRaised", onRaised);
    const offLowered = CometChatCalls.addEventListener("onParticipantHandLowered", onLowered);
    return () => {
      offRaised();
      offLowered();
    };
  }, [raised.size]);

  const sorted = Array.from(raised.values()).sort((a, b) => a.raisedAt - b.raisedAt);

  return (
    <BottomSheet ref={sheetRef} snapPoints={["10%", "40%"]} index={raised.size > 0 ? 1 : 0}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontWeight: "600", marginBottom: 8 }}>
          Raised hands ({raised.size})
        </Text>
        <FlatList
          data={sorted}
          keyExtractor={(p) => p.uid}
          renderItem={({ item }) => (
            <Text style={{ paddingVertical: 6 }}>
              ✋ {item.name}
            </Text>
          )}
        />
      </View>
    </BottomSheet>
  );
}
```

`@gorhom/bottom-sheet` is the canonical RN bottom-sheet library; if you've already integrated CometChat the kit's setup includes its peer deps (`react-native-gesture-handler`, `react-native-reanimated`).

### Toast for the host

```tsx
import Toast from "react-native-toast-message";

useEffect(() => {
  const onRaised = (p: { name: string }) => {
    Toast.show({
      type: "info",
      text1: `${p.name} raised their hand`,
      visibilityTime: 4000,
      position: "top",
    });
  };
  const off = CometChatCalls.addEventListener("onParticipantHandRaised", onRaised);
  return () => off();
}, []);
```

---

## When to gate raise-hand UI

Same rule as web: hide for 1:1 calls. Gate on participant count:

```tsx
const showRaiseHand = participants.length > 2;
return showRaiseHand ? <RaiseHandButton /> : null;
```

---

## Anti-patterns

Same shape as web (cf. sister reference) plus RN-specific:

1. **Forgetting `accessibilityRole="button"`.** TouchableOpacity defaults to "image" or no role — TalkBack reads it wrong. Always set the role.
2. **`Toast.show` from inside the SDK callback without UI-thread guarantee.** Toast lib usually handles this, but if you use a custom toast, wrap in `requestAnimationFrame` or check that the call from the SDK callback is on the JS thread.
3. **BottomSheet with a single snap-point.** Use 2 snaps so users can collapse without dismissing entirely.
4. **Animating the raise-hand badge with Reanimated `withSpring`** in a video-call context. CPU-intensive; can stutter the WebRTC pipeline. Use `withTiming` with short durations or skip the animation.

---

## Verification checklist

- [ ] `raiseHand()` / `lowerHand()` wired to your toggle button
- [ ] Both event listeners registered + cleaned up
- [ ] `accessibilityState`, `accessibilityRole`, `accessibilityLabel` on the toggle button
- [ ] `AccessibilityInfo.announceForAccessibility` on state change
- [ ] Roster sorted by `raisedAt` ascending
- [ ] `hideRaiseHandButton: true` in CallSettings if custom UI
- [ ] Real-device smoke: 3 devices in same call, hand-raise from 2 → host's BottomSheet shows both
- [ ] iOS device: VoiceOver announces "Hand raised" / "Hand lowered"
- [ ] Android device: TalkBack announces same
- [ ] Visual at 360×640 (small Android phone) — button + sheet still legible

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — sister reference (same SDK, web-flavored UI)
- `cometchat-native-calls` SKILL.md — the seven hard rules
- `references/group-calls.md` — group call architecture
- `references/custom-ui.md` — RN custom call UI
- `cometchat-a11y` — RN announcement patterns
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/raise-hand
