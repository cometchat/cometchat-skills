# Call layouts on React Native

Same SDK as web (TILE/SIDEBAR/SPOTLIGHT). RN-specific: layout switcher must be a touchable, not a `<button>`; orientation changes are common in mobile so layout-on-rotate is a real consideration.

**Canonical docs:** https://www.cometchat.com/docs/calls/react-native/call-layouts
**Read first:** `cometchat-react-calls/references/call-layouts.md` — layout matrix + when to lock.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

// Layout values are the bare string literals "TILE" | "SIDEBAR" | "SPOTLIGHT".
// There are NO top-level LAYOUT / SESSION_TYPE named exports — the SDK only exports
// CometChatCalls. (Constants that exist are namespaced statics:
// CometChatCalls.CALL_MODE.* and CometChatCalls.AUDIO_MODE.* — verified against
// calls-sdk-react-native skills/session-settings.)
// Session type is the sessionSettings.sessionType field ('VIDEO' | 'VOICE'), not an enum import.

// Mid-call switch — setLayout takes a bare string literal:
CometChatCalls.setLayout("SPOTLIGHT"); // "TILE" | "SIDEBAR" | "SPOTLIGHT"

// Listen
const off = CometChatCalls.addEventListener("onCallLayoutChanged", (layout) => {
  // ...
});
// later: off();  // addEventListener returns the unsubscribe fn

// Hide the kit's change-layout button: it's a SessionSettings OBJECT field
// (hideChangeLayoutButton), passed to <CometChatCalls.Component />, not a builder method.
```

---

## RN switcher component

```tsx
import { Pressable, View, Text, StyleSheet } from "react-native";
import { useState, useEffect } from "react";

const LAYOUTS = ["TILE", "SIDEBAR", "SPOTLIGHT"] as const;

export function LayoutSwitcher() {
  const [layout, setLayout] = useState<typeof LAYOUTS[number]>("TILE");

  useEffect(() => {
    const sub = (next: string) => setLayout(next as typeof LAYOUTS[number]);
    const off = CometChatCalls.addEventListener("onCallLayoutChanged", sub);
    return () => off();
  }, []);

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {LAYOUTS.map((opt) => (
        <Pressable
          key={opt}
          accessibilityRole="radio"
          accessibilityState={{ selected: layout === opt }}
          accessibilityLabel={`${opt} layout`}
          onPress={() => {
            CometChatCalls.setLayout(opt);
            setLayout(opt);
          }}
          style={[styles.btn, layout === opt && styles.btnActive]}
        >
          <Text>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

---

## Orientation-aware default

Most users prefer SPOTLIGHT in portrait (one big tile + small thumbnails) and TILE in landscape (grid uses width). Wire it via `useWindowDimensions`:

```tsx
import { useWindowDimensions } from "react-native";

function CallScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    CometChatCalls.setLayout(isLandscape ? "TILE" : "SPOTLIGHT");
  }, [isLandscape]);

  // ...
}
```

Only do this if user-testing shows orientation-change layout flips are desired. For most apps a stable layout is calmer.

---

## Anti-patterns

Web sister rules apply, plus RN-specific:

1. **`<TouchableHighlight>` without `accessibilityRole`.** TalkBack/VoiceOver can't announce the radio group.
2. **`Modal` for layout switcher.** Modal blocks the call surface — defeats in-call layout switching. Use bottom-sheet or inline pill.
3. **Re-rendering the call surface on layout change.** Causes flicker. The SDK's `setLayout` is internal-only — don't gate the surface JSX on layout state.

---

## Verification checklist

- [ ] Layout switched via `CometChatCalls.setLayout("…")` (bare string literal)
- [ ] Switcher uses `Pressable` with `accessibilityRole="radio"`
- [ ] Layout listener cleaned up on unmount
- [ ] Orientation change handled (or explicitly stable)
- [ ] Real-device smoke (iOS + Android): switcher cycles through all 3 layouts

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — sister
- `cometchat-native-calls` SKILL.md — seven hard rules
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/call-layouts
