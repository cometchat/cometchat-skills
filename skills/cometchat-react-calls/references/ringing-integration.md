# Ringing — call signaling with custom UI (web)

The Ringing flow uses the **Chat SDK's call entity** for signaling (initiate / ring / accept / reject / cancel) and the **Calls SDK** for the actual WebRTC session. This is the right pattern when you want a custom incoming-call UI on top of CometChat's signaling — not the kit's prebuilt `CometChatIncomingCall`.

**Three calling modes — pick the right one:**

| Mode | Driver | When to use |
|---|---|---|
| **Standard** | UI Kit (`CometChatCallButtons` + `CometChatIncomingCall`) | 80% case — chat-driven calls with prebuilt UI |
| **Ringing (this doc)** | Chat SDK call entity + Calls SDK session | Custom incoming/outgoing call UI on top of CometChat signaling |
| **Call Session** (see `call-session.md`) | Calls SDK `joinSession` directly | Meeting-room URLs, scheduled calls, no ringing |

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/ringing

---

## Architecture

```
Caller                              CometChat                       Recipient
  │                                     │                                │
  │ CometChat.initiateCall(call)        │                                │
  ├────────────────────────────────────>│                                │
  │                                     │ onIncomingCallReceived         │
  │                                     ├───────────────────────────────>│
  │                                     │                                │
  │                                     │     CometChat.acceptCall(sid)  │
  │                                     │<───────────────────────────────│
  │ onOutgoingCallAccepted              │                                │
  │<────────────────────────────────────┤                                │
  │                                     │                                │
  │  CometChatCalls.joinSession(token)  │  CometChatCalls.joinSession(token)
  ├────────────────────────────────────>│<───────────────────────────────│
  │              ───── WebRTC session active ─────                       │
```

The Chat SDK is the signaling channel; the Calls SDK is the media channel. Same sessionId binds them.

---

## Hard rules

1. **Both SDKs must be initialized** — `CometChat.init` for signaling, `CometChatCalls.init` for media. Sequential, in that order.
2. **`addCallListener` must be live BEFORE you start receiving calls.** Add it on app start, after login. Otherwise incoming-call events are missed.
3. **`CometChatCalls.joinSession` happens AFTER `CometChat.acceptCall` resolves** — accepting tells the backend you're ready; joining the session enters WebRTC. Reversing this fires media before the chat-side state agrees.
4. **End the call on BOTH SDKs.** `CometChatCalls.leaveSession()` for media, `CometChat.endCall(sessionId)` for the chat-side call record. Skipping either leaves a zombie.
5. **Listen for `onCallEndedMessageReceived`** for the case where the OTHER party ended. Without it, your UI keeps showing "in-call" while the session is dead.
6. **Custom timeout (default 45s)** — `CometChat.initiateCall(call, 60)` sets ringing duration. After timeout, the backend auto-cancels and the recipient stops seeing the call.

---

## Initiate (caller side)

```ts
import { CometChat } from "@cometchat/chat-sdk-javascript";

async function initiateCall(receiverUid: string, callType: "audio" | "video" = "video") {
  const call = new CometChat.Call(
    receiverUid,
    callType === "video" ? CometChat.CALL_TYPE.VIDEO : CometChat.CALL_TYPE.AUDIO,
    CometChat.RECEIVER_TYPE.USER,
  );
  // Optional: 60-second ring timeout (default 45)
  const outgoingCall = await CometChat.initiateCall(call, 60);
  showOutgoingCallScreen(outgoingCall);
  return outgoingCall;
}
```

For **group calls**, change `RECEIVER_TYPE` to `CometChat.RECEIVER_TYPE.GROUP` and use the group GUID. Only group members get the ring.

---

## Listen for events (recipient + caller)

```tsx
import { useEffect } from "react";

const LISTENER_ID = "app-call-listener";

export function useCometChatCallListener() {
  useEffect(() => {
    CometChat.addCallListener(
      LISTENER_ID,
      new CometChat.CallListener({
        onIncomingCallReceived: (call) => {
          // Show your custom incoming-call UI
          showIncomingCallScreen(call);
        },
        onOutgoingCallAccepted: (acceptedCall) => {
          // Other party accepted — start the session
          hideOutgoingCallScreen();
          startCallSession(acceptedCall.getSessionId());
        },
        onOutgoingCallRejected: (rejectedCall) => {
          hideOutgoingCallScreen();
          // Optional: toast "User declined"
        },
        onIncomingCallCancelled: (cancelledCall) => {
          // Caller hung up before you accepted
          hideIncomingCallScreen();
        },
        onCallEndedMessageReceived: (endedCall) => {
          // Other party ended the active session
          teardownCallUI();
        },
      }),
    );
    return () => CometChat.removeCallListener(LISTENER_ID);
  }, []);
}
```

Mount this hook at app root (e.g. in `App.tsx`) so listeners survive route changes — the same reasoning as for `<CometChatIncomingCall />`.

---

## Accept (recipient side)

```ts
async function acceptIncomingCall(call: CometChat.Call) {
  const accepted = await CometChat.acceptCall(call.getSessionId());
  hideIncomingCallScreen();
  startCallSession(accepted.getSessionId());
}
```

---

## Reject (recipient side)

```ts
async function rejectIncomingCall(call: CometChat.Call) {
  await CometChat.rejectCall(
    call.getSessionId(),
    CometChat.CALL_STATUS.REJECTED,
  );
  hideIncomingCallScreen();
}
```

---

## Cancel outgoing (caller side, before recipient answers)

```ts
async function cancelOutgoingCall(call: CometChat.Call) {
  await CometChat.rejectCall(
    call.getSessionId(),
    CometChat.CALL_STATUS.CANCELLED,
  );
  hideOutgoingCallScreen();
}
```

`rejectCall` is the same API for both recipient-rejecting and caller-cancelling — the `CALL_STATUS` enum distinguishes intent.

---

## Start the session (both parties, after accept)

```tsx
async function startCallSession(sessionId: string) {
  const container = document.getElementById("call-container")!;
  const tokenResult = await CometChatCalls.generateToken(sessionId);

  await CometChatCalls.joinSession(
    tokenResult.token,
    { sessionType: "VIDEO", layout: "TILE" },
    container,
  );

  // Listen for session end (you ended it OR connection lost)
  const unsub = CometChatCalls.addEventListener("onSessionLeft", () => {
    endCall(sessionId);
    unsub();
  });
}
```

The container element must exist in the DOM **before** calling `joinSession`. In React, render a div with `id="call-container"` inside your call screen component, and call `startCallSession` from `useEffect`.

---

## End the call

```ts
async function endCall(sessionId: string) {
  CometChatCalls.leaveSession();
  await CometChat.endCall(sessionId);
  teardownCallUI();
}
```

---

## Custom incoming-call UI

```tsx
function IncomingCallScreen({ call, onAccept, onReject }: Props) {
  const caller = call.getCallInitiator();
  return (
    <div role="alertdialog" aria-labelledby="incoming-title" className="incoming-call-overlay">
      <div className="card">
        <img src={caller.getAvatar()} alt="" />
        <h3 id="incoming-title">{caller.getName()}</h3>
        <p>Incoming {call.getType()} call</p>
        <div className="actions">
          <button onClick={onReject} className="reject" aria-label="Decline call">Decline</button>
          <button onClick={onAccept} className="accept" aria-label="Accept call">Accept</button>
        </div>
      </div>
      <audio src="/sounds/ringtone.mp3" autoPlay loop />
    </div>
  );
}
```

`role="alertdialog"` is the right ARIA role — interrupting modal that requires user action. `<audio autoPlay loop>` plays ringtone; pause it on accept/reject in the parent.

---

## Anti-patterns

1. **`addCallListener` inside the chat route component.** Listener tears down on route change → calls received while user is on home screen are silently dropped.
2. **Calling `joinSession` before `acceptCall` resolves.** Race — recipient enters WebRTC before backend marks the call as "ongoing." Caller's `onOutgoingCallAccepted` may never fire.
3. **Forgetting to `removeCallListener` on unmount.** Multiple listeners → events fire N times. Causes "double accept" toasts.
4. **No `onCallEndedMessageReceived` handler.** The other party ends the call → your UI stays "in-call" → user has to refresh.
5. **Using `endCall` on the chat SDK without `leaveSession` on the calls SDK.** Camera light stays on; mic stays hot. The flex-shrink trap of calls.
6. **Mounting `CometChatIncomingCall` (kit) AND custom listener AT THE SAME TIME.** Both fire — you get duplicate incoming-call UIs. Pick one mode per app.
7. **`CometChat.initiateCall` without timeout when phone-ringing UX is the goal.** Default 45s is fine; if your UX rings longer, override explicitly so the recipient sees consistent UI.

---

## Verification checklist

- [ ] Both SDKs initialized in order (`CometChat.init` → `CometChatCalls.init`)
- [ ] `addCallListener` registered at app root (survives route changes)
- [ ] `removeCallListener` on unmount
- [ ] `acceptCall` precedes `joinSession`
- [ ] `endCall` (chat) AND `leaveSession` (calls) both fire on hangup
- [ ] `onCallEndedMessageReceived` tears down UI when other party ends
- [ ] `onIncomingCallCancelled` tears down UI when caller cancels mid-ring
- [ ] Custom UI: `role="alertdialog"`, ringtone audio, accept/decline buttons with aria-labels
- [ ] Smoke: 2 tabs, caller initiates → recipient sees custom incoming UI → accept → both join session → either ends → both UIs dismiss

---

## Pointers

- `cometchat-react-calls/SKILL.md` — architecture + seven hard rules
- `cometchat-react-calls/references/call-session.md` — Mode 3 (joinSession with no ringing)
- `cometchat-react-calls/references/in-call-chat.md` — chat panel during a call
- `cometchat-react-calls/references/recording.md` — recording mid-call
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/ringing
