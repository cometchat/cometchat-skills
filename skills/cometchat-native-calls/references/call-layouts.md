# Call layouts on React Native

Same SDK as web (TILE/SIDEBAR/SPOTLIGHT). RN-specific: layout switcher must be a touchable, not a `<button>`; orientation changes are common in mobile so layout-on-rotate is a real consideration.

**Canonical docs:** https://www.cometchat.com/docs/calls/react-native/call-layouts
**Read first:** `cometchat-react-calls/references/call-layouts.md` — layout matrix + when to lock.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

const callSettings = new CallSettingsBuilder()
  .setSessionType(CometChatCalls.constants.SESSION_TYPE.VIDEO)
  .setLayout(CometChatCalls.constants.LAYOUT.TILE)
  .build();

// Mid-call switch
CometChatCalls.setLayout(CometChatCalls.constants.LAYOUT.SPOTLIGHT);

// Listen
CometChatCalls.addEventListener("onCallLayoutChanged", (layout) => {
  // ...
});

// Hide kit switcher
const settings2 = new CallSettingsBuilder()
  .setHideChangeLayoutButton(true)
  .build();
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
    CometChatCalls.addEventListener("onCallLayoutChanged", sub);
    return () => CometChatCalls.removeEventListener("onCallLayoutChanged", sub);
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

- [ ] Initial layout via `setLayout()` on the builder
- [ ] Switcher uses `Pressable` with `accessibilityRole="radio"`
- [ ] Layout listener cleaned up on unmount
- [ ] Orientation change handled (or explicitly stable)
- [ ] Real-device smoke (iOS + Android): switcher cycles through all 3 layouts

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — sister
- `cometchat-native-calls` SKILL.md — seven hard rules
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/call-layouts
