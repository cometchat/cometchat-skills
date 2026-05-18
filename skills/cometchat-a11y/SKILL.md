---
name: cometchat-a11y
description: Accessibility (a11y) for CometChat UI Kit integrations across all families — React, React Native, Angular, Android (V5/V6), iOS, Flutter. Covers WCAG 2.1 AA targets, keyboard navigation in chat, screen reader announcements (live regions for new messages), color contrast, focus management on call screens, motion-reduction support, and the cross-family checks that catch the common production a11y bugs. Cross-family — applies wherever the agent is checking accessibility.
license: "MIT"
compatibility: "All CometChat UI Kit families v4.x / v5.x / v6.x"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat a11y accessibility wcag aa keyboard screen-reader voiceover talkback aria live-region focus-management contrast prefers-reduced-motion cross-family"
---

## Purpose

Accessibility for CometChat integrations. Out-of-the-box, the UI Kit components are mostly accessible — the kit's own buttons, inputs, and lists ship with semantic markup. Production gaps appear in the wiring **around** the kit: custom call surfaces, navigation, focus management on screen transitions, and contrast in custom themes.

Target: **WCAG 2.1 AA**. The skill writes code that meets this baseline.

---

## The five gaps that trip integrations (any family)

1. **Color contrast in custom themes.** A brand color picked for "looks nice in the brand book" may be 3.2:1 against the text — fails AA's 4.5:1 minimum.
2. **Focus management on chat screen entry.** Tab/screen reader user lands on the chat screen but focus stays on the previous trigger button. They have to manually navigate into the message list every time.
3. **No live region announcement for new messages.** Screen reader users don't know a new message arrived unless they navigate the message list and hear the new item.
4. **Keyboard-only users can't navigate the conversation list.** Click handlers bound to `<div>` instead of `<button>` skip keyboard events.
5. **Reduced-motion users see decorative animations.** Typing-indicator dots, message bubble entrance animations, transition effects — should respect `prefers-reduced-motion`.

This skill addresses each one across families.

---

## 1. Color contrast — the theme audit

CometChat themes are CSS variables (web/RN) or color tokens (native/Flutter). Override a single color and you might fail AA.

### Web / Angular — CSS variable contrast check

```ts
// scripts/check-contrast.ts (run in CI or as a one-shot)
function contrastRatio(hex1: string, hex2: string): number {
  const luminance = (hex: string) => {
    const rgb = hex.match(/\w\w/g)!.map(c => parseInt(c, 16) / 255).map(c =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Pull the values from your CSS variables
const fg = getComputedStyle(document.documentElement).getPropertyValue("--cometchat-text-color").trim();
const bg = getComputedStyle(document.documentElement).getPropertyValue("--cometchat-background-color").trim();
const ratio = contrastRatio(fg, bg);
if (ratio < 4.5) {
  console.warn(`Text/background contrast ${ratio.toFixed(2)}:1 fails WCAG AA (need ≥4.5:1)`);
}
```

In CI, add this to your test suite. The skill writes a starter version into `tests/a11y/contrast.test.ts`.

### React Native / native / Flutter — manual audit at theme-design time

Use a contrast-checker tool (browser extensions, https://webaim.org/resources/contrastchecker/) on the theme tokens before shipping. There's no runtime DOM to audit on native.

The kit's default theme tokens pass AA. Custom palettes need the audit.

**Common fail:** brand purple #6750A4 against white background = 6.6:1 (passes). Same purple against `#F0F0F0` light gray = 5.7:1 (passes). Same purple against `#999999` muted gray = 2.8:1 (FAILS). Watch for muted backgrounds in dark-mode toggles, secondary buttons, and "subtle" surfaces.

---

## 2. Focus management on chat screen entry

When the user navigates to a chat screen (clicked a conversation, opened the chat tab, accepted a deep link), focus should land on a meaningful control — usually the message composer or the latest message.

### React (web)

```tsx
import { useEffect, useRef } from "react";

export function ChatScreen() {
  const composerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // After mount + animations, focus the composer
    const timer = setTimeout(() => {
      composerRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <CometChatMessageHeader />
      <CometChatMessageList />
      <CometChatMessageComposer ref={composerRef} />
    </div>
  );
}
```

The kit's `CometChatMessageComposer` accepts a forwarded ref in v6; if not, query for the input via `composerRef.current?.querySelector("input, [contenteditable]")?.focus()`.

### React Native

```tsx
import { useRef, useEffect } from "react";
import { findNodeHandle, AccessibilityInfo } from "react-native";

export function ChatScreen() {
  const composerRef = useRef(null);

  useEffect(() => {
    const handle = findNodeHandle(composerRef.current);
    if (handle) {
      AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, []);

  return (
    <View>
      <CometChatMessageHeader />
      <CometChatMessageList />
      <CometChatMessageComposer ref={composerRef} />
    </View>
  );
}
```

### Angular

```ts
@Component({...})
export class ChatComponent implements AfterViewInit {
  @ViewChild("composer") composer!: ElementRef;

  ngAfterViewInit() {
    setTimeout(() => this.composer.nativeElement.focus(), 100);
  }
}
```

### Native Android (Kotlin)

```kotlin
override fun onResume() {
  super.onResume()
  composerView.requestFocus()
  composerView.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_FOCUSED)
}
```

### Native iOS (Swift)

```swift
override func viewDidAppear(_ animated: Bool) {
  super.viewDidAppear(animated)
  UIAccessibility.post(notification: .screenChanged, argument: composerView)
}
```

### Flutter

```dart
final FocusNode _composerFocus = FocusNode();

@override
void initState() {
  super.initState();
  WidgetsBinding.instance.addPostFrameCallback((_) {
    _composerFocus.requestFocus();
  });
}

// Then on the composer widget: focusNode: _composerFocus
```

---

## 3. Live region for new messages

Screen reader users need an audible announcement when a new message arrives — otherwise they have to navigate to the message list and re-read it.

### Web / Angular — ARIA live region

```html
<!-- A visually-hidden region that screen readers announce -->
<div
  aria-live="polite"
  aria-atomic="true"
  style="position: absolute; left: -9999px; height: 1px; width: 1px; overflow: hidden;"
  id="message-announcer"></div>
```

```ts
// Listen for new messages and announce
import { CometChat } from "@cometchat/chat-sdk-javascript";

const listenerId = "a11y-message-announcer";
CometChat.addMessageListener(listenerId, new CometChat.MessageListener({
  onTextMessageReceived: (msg: CometChat.TextMessage) => {
    const senderName = msg.getSender().getName();
    const text = msg.getText();
    const region = document.getElementById("message-announcer");
    if (region) {
      // Clearing first ensures the same text re-announces
      region.textContent = "";
      setTimeout(() => {
        region.textContent = `New message from ${senderName}: ${text}`;
      }, 100);
    }
  },
}));
```

`aria-live="polite"` waits for the user to finish speaking before announcing. Use `aria-live="assertive"` only for urgent messages (like incoming calls) — too aggressive for chat.

### React Native

```ts
import { AccessibilityInfo } from "react-native";

CometChat.addMessageListener(listenerId, new CometChat.MessageListener({
  onTextMessageReceived: (msg) => {
    const text = `New message from ${msg.getSender().getName()}: ${msg.getText()}`;
    AccessibilityInfo.announceForAccessibility(text);
  },
}));
```

### Native Android / iOS / Flutter

Each platform has an equivalent — Android `View.announceForAccessibility(text)`, iOS `UIAccessibility.post(notification: .announcement, argument: text)`, Flutter `SemanticsService.announce(text, TextDirection.ltr)`. Same shape; the SDK callback is the trigger.

---

## 4. Keyboard navigation

The kit's components are keyboard-accessible by default. Custom wrapping is what breaks it.

### Anti-pattern — `<div onClick>` for clickable items

```tsx
// ✗ WRONG — keyboard users can't activate
<div onClick={() => openConversation(c)}>{c.name}</div>

// ✓ RIGHT — `<button>` is keyboard + screen-reader native
<button onClick={() => openConversation(c)}>{c.name}</button>

// ✓ ALSO RIGHT — div with explicit ARIA + keyboard handlers
<div
  role="button"
  tabIndex={0}
  onClick={() => openConversation(c)}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openConversation(c);
    }
  }}
>
  {c.name}
</div>
```

### Skip links

For long conversation lists, add a skip-to-message-composer link:

```html
<a href="#message-composer" class="skip-link">Skip to message composer</a>
```

```css
.skip-link {
  position: absolute;
  left: -9999px;
  z-index: 999;
}
.skip-link:focus {
  left: 0;
  top: 0;
  background: white;
  padding: 8px;
}
```

The kit's components already include skip links where applicable; custom wrapping should preserve them.

### Keyboard shortcuts

For productivity apps:

```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // Cmd/Ctrl + K → focus search
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      searchRef.current?.focus();
    }
    // Escape → close any open thread / modal
    if (e.key === "Escape") {
      closeOpenThread();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

Document the shortcuts in your in-app help — discoverability matters.

---

## 5. Reduced motion

Animations help most users; they cause physical discomfort or distraction for users with vestibular disorders, ADHD, or who simply prefer less movement. WCAG 2.1 AA requires honoring the OS preference.

### Web / Angular — CSS

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable kit animations + your custom ones */
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### React Native

```ts
import { AccessibilityInfo } from "react-native";

const [reduceMotion, setReduceMotion] = useState(false);

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
  return () => sub.remove();
}, []);

// In animations
<Animated.View
  style={{
    transform: [{ scale: reduceMotion ? 1 : animatedValue }],
  }}
/>
```

### Native iOS

```swift
let reduceMotion = UIAccessibility.isReduceMotionEnabled
if !reduceMotion {
  UIView.animate(withDuration: 0.3) { ... }
} else {
  // Apply final state without animation
}
```

### Native Android

```kotlin
val reduceMotion = Settings.Global.getFloat(
  contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1.0f
) == 0.0f
```

### Flutter

```dart
final reduceMotion = MediaQuery.of(context).disableAnimations;
```

The skill defaults to wrapping the typing indicator + message-bubble entrance animations in reduce-motion guards. Other kit animations need similar treatment if you've customized them.

---

## Calls a11y

Calls have specific a11y considerations beyond chat:

1. **Focus on call screen entry → end-call button.** Avoids accidental hangup but ensures the user can quickly exit.
2. **Announce incoming calls.** Live region (web/RN) or `UIAccessibility.post(.announcement)` (iOS) — "Incoming call from Alice."
3. **Mute/end button labels.** "Mute microphone" not just "Mute" — clarify what's being toggled.
4. **No flashing — recording indicator uses dot, not strobe.** WCAG 2.3 forbids more than 3 flashes/sec to prevent seizures.
5. **Caption support if recording.** Production calling apps with live captioning hook in via the platform's speech-recognition API and overlay text on the call screen.

---

## Testing — automated + manual

### Web automated

```bash
npm install --save-dev @axe-core/playwright
```

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("chat screen passes axe AA", async ({ page }) => {
  await page.goto("/messages");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
});
```

### Native automated

iOS: Xcode → Accessibility Inspector → Audit. Android: Accessibility Scanner app on a real device.

### Manual

- **Keyboard-only navigation** — unplug your mouse, complete a full chat flow. Tab through every control.
- **VoiceOver (iOS) / TalkBack (Android) / NVDA (Windows) / VoiceOver (macOS)** — listen to the kit; verify announcements make sense.
- **Browser zoom 200%** — kit should remain usable at 200% zoom on a 1280×720 viewport (WCAG 1.4.10 reflow).

---

## Anti-patterns

1. **Custom themes without a contrast audit.** Brand colors silently fail AA.
2. **`<div onClick>` for clickable items.** Keyboard users can't activate.
3. **No live region for new messages.** Screen reader users miss messages.
4. **Auto-playing video on call screen.** Some users browse with autoplay disabled — kit handles this; custom UI must too.
5. **Focus stays on the trigger button after opening chat.** User has to manually re-navigate.
6. **Ignoring `prefers-reduced-motion`.** Vestibular-disorder users get disoriented.
7. **`aria-live="assertive"` for chat messages.** Interrupts the user mid-sentence; reserve for genuinely urgent (incoming call).
8. **Skipping label specificity.** "Mute" alone is ambiguous; "Mute microphone" / "Unmute microphone" is clear.
9. **Color-only signals.** "Read" status as just a checkmark color — add a visible text label for color-blind users.
10. **No test coverage for a11y.** Regressions slip in. Automate the easy checks (axe-core); manual-test the rest per release.

---

## Verification checklist

**Cross-family:**
- [ ] Custom theme passes AA contrast (4.5:1 text, 3:1 large text + UI components)
- [ ] Focus lands on a meaningful control on chat screen entry
- [ ] Live region / accessibility announcement on new message receive
- [ ] No `<div onClick>` patterns — buttons are buttons
- [ ] `prefers-reduced-motion` / `isReduceMotionEnabled` honored for animations
- [ ] Mute/end/camera labels are specific (not just "Mute")
- [ ] Incoming-call announcement (`assertive` live region OR platform announcement API)
- [ ] No flashing > 3 Hz (recording dot uses fade, not strobe)

**Web/Angular:**
- [ ] axe-core / Playwright a11y test in CI; passes WCAG AA tags
- [ ] `<html lang="...">` set to current locale (consumes `cometchat-i18n` skill output)
- [ ] Skip-to-composer link present
- [ ] Browser zoom 200% smoke test

**Native (Android/iOS/Flutter):**
- [ ] TalkBack / VoiceOver smoke test on a real device
- [ ] Reduced motion preference observed (`UIAccessibility.isReduceMotionEnabled`, etc.)
- [ ] Focus restored on screen pop (not just push)
- [ ] Touch targets ≥ 44×44 pt (iOS) / 48×48 dp (Android) — kit defaults pass; custom UI must too

---

## Pointers

- `cometchat-i18n` — sister skill; `<html lang>` and screen-reader pronunciation of translated strings depend on locale set correctly
- `cometchat-{family}-customization` — when customizing kit components, preserve their built-in a11y attributes
- `cometchat-{family}-troubleshooting` — when a11y tools report issues that look kit-internal
- WCAG 2.1 AA reference — https://www.w3.org/WAI/WCAG21/quickref/?levels=aa
- Material Design accessibility — https://m3.material.io/foundations/accessible-design
- Apple HIG accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility
