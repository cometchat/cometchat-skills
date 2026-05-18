# Raise hand on web

Lets participants signal they want to speak without interrupting the current speaker. The SDK ships first-party support — four method calls, two events, one settings flag. No custom signaling needed.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/raise-hand
**Use it for:** classrooms, large group calls, town halls, any call with > ~5 participants where verbal turn-taking gets messy.

---

## SDK API (web Calls SDK)

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

// Local user raises hand
CometChatCalls.raiseHand();

// Local user lowers hand
CometChatCalls.lowerHand();

// Subscribe to other participants' hand state
CometChatCalls.addEventListener("onParticipantHandRaised", (participant) => {
  // participant.uid, participant.name available
});

CometChatCalls.addEventListener("onParticipantHandLowered", (participant) => {
  // ...
});
```

The SDK ships a built-in raise-hand button in the default control panel. Hide it via call settings if you're rolling custom UI:

```ts
const callSettings = new CometChatCalls.CallSettingsBuilder()
  .setSessionID(sessionId)
  .hideRaiseHandButton(true)         // suppress the SDK's button — your UI takes over
  .build();
```

---

## When to use built-in vs custom

| Scenario | Use |
|---|---|
| Default kit UI is fine; just want raise-hand | Built-in (don't pass `hideRaiseHandButton`) |
| Custom call UI (your own control panel) | Custom — call `raiseHand()` / `lowerHand()` from your buttons |
| Need different host vs participant UI | Custom — query group scope, render different controls |
| Need raise-hand list (host sees who's raised) | Custom — maintain local Map<uid, raisedAt> via the listeners |

---

## Custom raise-hand UX — three pieces

### 1. Local participant button (toggle)

```tsx
import { useState } from "react";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

function RaiseHandButton() {
  const [raised, setRaised] = useState(false);

  function toggle() {
    if (raised) {
      CometChatCalls.lowerHand();
      setRaised(false);
    } else {
      CometChatCalls.raiseHand();
      setRaised(true);
    }
  }

  return (
    <button onClick={toggle} aria-pressed={raised}>
      {raised ? "✋ Lower" : "✋ Raise hand"}
    </button>
  );
}
```

Visual hint: render the icon with `aria-pressed={raised}` so screen readers announce the toggle state. (See `cometchat-a11y` for the broader rule.)

### 2. Raised-hands roster (host view)

```tsx
import { useEffect, useState } from "react";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

interface RaisedParticipant { uid: string; name: string; raisedAt: number; }

function RaisedHandsList() {
  const [raised, setRaised] = useState<Map<string, RaisedParticipant>>(new Map());

  useEffect(() => {
    const onRaised = (p: { uid: string; name: string }) => {
      setRaised(prev => {
        const next = new Map(prev);
        next.set(p.uid, { ...p, raisedAt: Date.now() });
        return next;
      });
    };
    const onLowered = (p: { uid: string }) => {
      setRaised(prev => {
        const next = new Map(prev);
        next.delete(p.uid);
        return next;
      });
    };

    CometChatCalls.addEventListener("onParticipantHandRaised", onRaised);
    CometChatCalls.addEventListener("onParticipantHandLowered", onLowered);

    return () => {
      CometChatCalls.removeEventListener("onParticipantHandRaised", onRaised);
      CometChatCalls.removeEventListener("onParticipantHandLowered", onLowered);
    };
  }, []);

  // Sort oldest-first — fairness queue
  const sorted = Array.from(raised.values()).sort((a, b) => a.raisedAt - b.raisedAt);
  if (sorted.length === 0) return null;

  return (
    <ul aria-label="Raised hands queue">
      {sorted.map(p => (
        <li key={p.uid}>
          ✋ {p.name} <span style={{ color: "#888" }}>{secondsAgo(p.raisedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function secondsAgo(t: number) { return `${Math.round((Date.now() - t) / 1000)}s ago`; }
```

Sort by `raisedAt` ascending = first-raised-first-called, which feels fair to participants. Don't sort alphabetically.

### 3. Toast notification for the host

```tsx
useEffect(() => {
  const onRaised = (p: { name: string }) => {
    toast.info(`${p.name} raised their hand`, { duration: 4000 });
  };
  CometChatCalls.addEventListener("onParticipantHandRaised", onRaised);
  return () => CometChatCalls.removeEventListener("onParticipantHandRaised", onRaised);
}, []);
```

Use `aria-live="polite"` on the toast region so screen readers announce — same a11y pattern as new-message announcements (cf. `cometchat-a11y`).

---

## Lower-by-host pattern

The SDK exposes `lowerHand()` only for the local user. To let a host lower someone else's hand, you need a moderator action via the participant-management API:

```ts
// Host action — requires moderator/admin scope on the group
async function lowerParticipantHand(uid: string) {
  // SDK doesn't expose remoteLowerHand directly. Two options:
  // A) Send a custom message to the participant; their client lowers itself
  // B) Use the moderator mute/kick API as the boundary

  // Option A: lightweight, requires the participant's client to listen
  await CometChat.sendCustomMessage(new CometChat.CustomMessage(
    uid, CometChat.RECEIVER_TYPE.USER, "lower_hand", {}
  ));
}
```

On the receiving side:

```ts
CometChat.addMessageListener("raise-hand-control", new CometChat.MessageListener({
  onCustomMessageReceived: (msg) => {
    if (msg.getType() === "lower_hand") {
      CometChatCalls.lowerHand();
    }
  },
}));
```

This is application-level signaling, not SDK-built-in. Document the contract in your team's call protocols.

---

## Hide button on rendered surfaces

If using the kit's `<CometChatOngoingCall />` and want raise-hand off entirely (e.g. 1:1 calls don't need it):

```tsx
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

const settings = new CometChatCalls.CallSettingsBuilder()
  .setSessionID(sessionId)
  .hideRaiseHandButton(true)
  .build();
```

For 1:1 calls, default to hidden. For group calls > 5 participants, default to shown.

---

## Anti-patterns

1. **Polling for raised-hand state.** The SDK fires events on change — listen, don't poll. Polling burns CPU.
2. **Sorting raised-hands alphabetically.** First-raised-first-called is the fair queue. Sort by `raisedAt` ascending.
3. **Auto-lowering hands after a timer.** Some people raise their hand and wait. Letting the SDK manage state means the participant lowers when called or via their own button.
4. **Showing raise-hand button in 1:1 calls.** Visually noisy and pointless. Gate on `participantCount > 2`.
5. **Skipping the listener cleanup in `useEffect`'s return.** Stacked listeners fire multiple times when the component re-mounts — duplicate toasts, duplicate roster entries.
6. **Treating "hand raised" as a permission grant.** Raise-hand is a request, not a mute override. The host still has to unmute the participant separately.

---

## Verification checklist

- [ ] `raiseHand()` / `lowerHand()` calls in your code (not just relying on the SDK button)
- [ ] Both `onParticipantHandRaised` and `onParticipantHandLowered` listeners registered
- [ ] Listeners cleaned up in component unmount (return from `useEffect`)
- [ ] Roster sorted by `raisedAt` ascending
- [ ] `hideRaiseHandButton: true` in call settings IF custom UI is used (otherwise duplicates)
- [ ] Toast / badge UI uses `aria-live="polite"` (a11y)
- [ ] Browser smoke: 3 tabs, hand-raise from 2 of them, host's roster shows both in raise-order
- [ ] Lower-hand smoke: tab A raises, lowers, host's roster updates without page refresh

---

## Pointers

- `cometchat-react-calls` SKILL.md — the seven hard rules (still apply for raise-hand UI)
- `references/group-calls.md` — group call architecture (raise-hand is a group-call feature)
- `references/custom-ui.md` — custom call UI patterns
- `cometchat-a11y` — toast announcements for raised-hand events
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/raise-hand
- For deeper SDK reference (other event types, presenter-mode interplay): query the docs MCP at `https://www.cometchat.com/docs/mcp`
