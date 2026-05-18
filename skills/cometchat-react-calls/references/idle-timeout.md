# Idle timeout on web

Auto-ends calls where the local user is the only remaining participant. Two timers: a "you're alone, are you still there?" prompt fires after the first interval, then the session ends if the user doesn't respond before the second interval. SDK first-party — just two settings keys + one event.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/idle-timeout
**Use it for:** any group call (preventing zombie sessions when everyone else hangs up), waiting rooms (auto-close empty rooms), classroom calls (instructor's screen doesn't stay live overnight).

---

## SDK API

```ts
const settings = new CometChatCalls.CallSettingsBuilder()
  .setSessionID(sessionId)
  .setIdleTimeoutPeriodBeforePrompt(60_000)   // 60s — first warning fires
  .setIdleTimeoutPeriodAfterPrompt(120_000)   // 120s — session ends if no response
  .build();

CometChatCalls.addEventListener("onSessionTimedOut", () => {
  // Navigate away, show "session ended" UI
});
```

| Setting | Default | Min | Use case |
|---|---|---|---|
| `idleTimeoutPeriodBeforePrompt` | 60_000 (60s) | 0 (immediate) | Time alone before the "still there?" prompt |
| `idleTimeoutPeriodAfterPrompt` | 120_000 (120s) | 60_000 (60s) | Grace period after the prompt before forced disconnect |

The SDK shows the prompt overlay automatically (kit's default UI). For custom UI you handle the prompt yourself.

---

## Recommended timeouts per app archetype

| App | Before-prompt | After-prompt | Why |
|---|---|---|---|
| Marketplace 1:1 | 30s | 60s | Buyers lose interest fast; reclaim resources |
| Telehealth (provider waiting) | 5min | 5min | Patients run late; don't punish them |
| Classroom / instructor | 10min | 10min | Instructor may step away; don't interrupt class |
| Internal team meeting | 60s | 120s | Default — meetings end abruptly anyway |
| Customer support | 30s | 60s | Agent moves to next ticket; reclaim |

---

## Custom prompt UI (when default isn't enough)

The kit's default prompt is functional but plain. Custom UI uses `enableDefaultLayout(false)` + listens for the prompt internally — though the SDK doesn't expose a direct "prompt fired" event. Two patterns:

### Pattern A — Track time-since-alone yourself

```tsx
import { useEffect, useRef, useState } from "react";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

function useIdleTimeoutPrompt({
  beforePromptMs = 60_000,
  afterPromptMs = 120_000,
}: { beforePromptMs?: number; afterPromptMs?: number; }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const aloneSinceRef = useRef<number | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const listener = new CometChatCalls.OngoingCallListener({
      onUserListUpdated: (users: { uid: string }[]) => {
        const localUid = CometChat.getLoggedinUser()?.getUid();
        const remoteCount = users.filter(u => u.uid !== localUid).length;

        if (remoteCount === 0 && aloneSinceRef.current === null) {
          // Just became alone
          aloneSinceRef.current = Date.now();
          promptTimerRef.current = setTimeout(() => {
            setShowPrompt(true);
            sessionTimerRef.current = setTimeout(() => {
              CometChatCalls.leaveSession();
            }, afterPromptMs);
          }, beforePromptMs);
        } else if (remoteCount > 0) {
          // Someone joined — clear timers
          aloneSinceRef.current = null;
          if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
          if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
          setShowPrompt(false);
        }
      },
    });

    // Attach listener... (see custom-ui.md for the full setup)

    return () => {
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, [beforePromptMs, afterPromptMs]);

  function dismiss() {
    setShowPrompt(false);
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    aloneSinceRef.current = null;
  }

  return { showPrompt, dismiss };
}
```

Usage:

```tsx
function CustomCallView() {
  const { showPrompt, dismiss } = useIdleTimeoutPrompt({
    beforePromptMs: 30_000,
    afterPromptMs: 60_000,
  });

  return (
    <>
      {/* call UI */}
      {showPrompt && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
          <h2 id="idle-title">Still there?</h2>
          <p>You're alone in this call. It'll end in 60 seconds.</p>
          <button onClick={dismiss}>Stay</button>
          <button onClick={() => CometChatCalls.leaveSession()}>End now</button>
        </div>
      )}
    </>
  );
}
```

### Pattern B — Long timeouts + custom prompt only

```ts
const settings = new CometChatCalls.CallSettingsBuilder()
  .setIdleTimeoutPeriodBeforePrompt(86_400_000)   // 24 hours — effectively disabled
  .setIdleTimeoutPeriodAfterPrompt(86_400_000)
  .build();
```

Then implement your own timeout via Pattern A. Useful when you want UX-customized prompts instead of the SDK's default overlay.

---

## Anti-patterns

1. **`idleTimeoutPeriodAfterPrompt < 60_000` (60s).** SDK rejects values below 60s. Setting it lower silently fails — the SDK uses 60s instead.
2. **Disabling idle timeout entirely** by setting both timers to `Infinity`. Sessions hang forever, server-side resources leak, billing dings you. Always set a reasonable upper bound.
3. **Showing the prompt at the same time as call notifications/banners.** Stacks on top of incoming-message notifications. Z-index conflicts. Render the idle prompt at the highest z-level for the call surface.
4. **Auto-ending without a goodbye animation.** Jarring. Fade-out the call surface over 500ms before disconnecting.
5. **Prompt UI without `role="alertdialog"`.** Screen readers don't pause to announce; user gets disconnected mid-listen. Use `role="alertdialog"` + `aria-modal="true"`.
6. **Restarting `aloneSinceRef.current` on EVERY participant change.** Want to track "alone since" only when transitioning from N>0 to 0. Don't reset when participants join/leave while still N>0.

---

## Verification checklist

- [ ] `setIdleTimeoutPeriodBeforePrompt` + `setIdleTimeoutPeriodAfterPrompt` set on CallSettings
- [ ] After-prompt period ≥ 60_000 (60s)
- [ ] `onSessionTimedOut` event handler navigates away cleanly (not just `console.log`)
- [ ] Custom prompt UI uses `role="alertdialog"` + `aria-modal="true"`
- [ ] Custom prompt has both "Stay" and "End now" buttons
- [ ] Timer cleanup in `useEffect` return — no leaked setTimeout
- [ ] Browser smoke: 2 tabs in call, close tab B, watch tab A's timer fire (set short timeouts for testing)
- [ ] After-prompt smoke: dismiss the prompt → timer clears → no auto-disconnect

---

## Pointers

- `cometchat-react-calls` SKILL.md — the seven hard rules
- `references/group-calls.md` — group call architecture (idle-timeout matters most for groups)
- `references/custom-ui.md` — custom call UI integration
- `cometchat-a11y` — `role="alertdialog"` patterns
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/idle-timeout
