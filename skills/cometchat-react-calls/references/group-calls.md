# Group calls — broadcast meeting pattern (web)

Group calls in CometChat use a **different signaling channel than 1:1 user calls**. The Ringing flow (Chat SDK `initiateCall` → `onIncomingCallReceived` on peer) fires for **1:1 user calls only**. For groups, the kit broadcasts a **custom message** of type `meeting` to the group; receivers see a "Join meeting" card in their message list (kit-based) OR need an explicit message listener (custom UI).

This is by-design kit behavior — not a bug. Documented across all platform kits.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/group-calls

---

## Architecture

```
Caller (uid-A, member of group-X)        CometChat                Receivers (all other members of group-X)
  │                                          │                              │
  │ <CometChatCallButtons group={x}>         │                              │
  │ → CometChatUIKit.sendCustomMessage(      │                              │
  │     CustomMessage(GUID, GROUP,           │                              │
  │       "meeting",                         │                              │
  │       { callType, sessionId }))          │                              │
  ├─────────────────────────────────────────>│                              │
  │                                          │ onCustomMessageReceived      │
  │                                          ├─────────────────────────────>│ (each member's
  │                                          │                              │  MessageListener
  │                                          │                              │  fires if they're
  │                                          │                              │  in the group)
  │                                          │                              │
  │ caller jumps straight to OngoingCall     │                              │
  │ (joins session GUID directly)            │   receiver taps "Join"       │
  │                                          │   → joinSession(GUID)        │
  │  CometChatCalls.joinSession(token, GUID) │ <─────────────────────────── │
  ├─────────────────────────────────────────>│                              │
  │            ───── WebRTC session active (sessionId = group GUID) ─────   │
```

Key contrast with 1:1 ringing:

| Channel | 1:1 user calls | Group calls |
|---|---|---|
| Signaling API | `CometChat.initiateCall(call)` | `CometChatUIKit.sendCustomMessage(meetingMessage)` |
| Receiver event | `CallListener.onIncomingCallReceived` | `MessageListener.onCustomMessageReceived` (category=CATEGORY_CUSTOM + type="meeting") |
| Session ID | server-generated unique per call | the group's GUID |
| Ring/decline semantics | yes — `acceptCall` / `rejectCall` | no — receivers just tap to join (or ignore) |
| Auto-cancel timeout | yes (45s default) | no — meeting card persists in chat history |

---

## Hard rules

1. **Group calls broadcast a custom message; they do NOT use the call listener.** If your custom UI only registers `addCallListener`, group-call recipients will see NOTHING. Add a `MessageListener` that handles `category === CATEGORY_CUSTOM && type === 'meeting'`.
2. **The session ID equals the group's GUID** — not a generated unique ID like 1:1 calls. Anyone with the GUID can join the session at any time (it's persistent, not auto-cancelled).
3. **Anyone can join, including after the meeting started.** Late joiners are normal — the WebRTC session is open until all participants leave. UI must handle "joining an already-active meeting" as a valid state.
4. **Joining = `CometChatCalls.joinSession(token, sessionSettings, container)` with sessionId set to the group GUID.** Same `generateToken(sessionId)` step as 1:1 ringing — auth is internal after `CometChatCalls.login()`.
5. **No `CometChat.endCall(sessionId)` on the chat side for groups** — the meeting message is the persistent record, not a call entity. Each participant just calls `CometChatCalls.leaveSession()` when they hang up.
6. **`onCallEndedMessageReceived` does NOT fire for group sessions.** The session persists as long as anyone's in it. Use `CometChatCalls.OngoingCallListener.onCallEnded` to detect when YOUR client's session ends.

---

## Caller side — kit-based

If you're using `<CometChatMessageHeader>` + `<CometChatCallButtons>`, the kit handles everything:

```tsx
import { CometChatCallButtons } from "@cometchat/chat-uikit-react";

<CometChatCallButtons group={group} />
```

Tapping voice/video automatically:
1. Sends a `CustomMessage` of type `meeting` to the group
2. Opens `<CometChatOutgoingCall>` UI (which transitions to `<CometChatOngoingCall>`)
3. Joins the WebRTC session with `sessionId = group.getGuid()`

No additional code on the caller side.

## Caller side — custom UI

If you don't use kit components and want full control:

```ts
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

async function startGroupCall(guid: string, callType: "audio" | "video") {
  const loggedInUser = await CometChat.getLoggedInUser();
  if (!loggedInUser) throw new Error("Not logged in");

  // 1. Broadcast the meeting message to the group
  const sessionId = guid;  // group GUID becomes the session ID
  const customData = { callType, sessionId };
  const meetingMessage = new CometChat.CustomMessage(
    guid,
    CometChat.RECEIVER_TYPE.GROUP,
    "meeting",
    customData,
  );
  meetingMessage.setCategory(CometChat.CATEGORY_CUSTOM);
  meetingMessage.setMetadata({
    incrementUnreadCount: true,
    pushNotification: "meeting",
    ...customData,
  });
  await CometChat.sendCustomMessage(meetingMessage);

  // 2. Generate a call token + join the session
  const authToken = loggedInUser.getAuthToken();
  const { token: callToken } = await CometChatCalls.generateToken(sessionId);

  const callSettings = new CometChatCalls.CallSettingsBuilder()
    .setIsAudioOnlyCall(callType === "audio")
    .enableDefaultLayout(true)
    .setCallListener(
      new CometChatCalls.OngoingCallListener({
        onCallEnded: () => { /* hangup UI */ },
        onError: (err) => { /* show error */ },
      }),
    )
    .build();

  // 3. Mount the WebRTC view into your container element
  await CometChatCalls.joinSession(callToken, callSettings, containerElement);
}
```

The `meeting` message lands in the group's chat history immediately; other members get `onCustomMessageReceived` if they have a listener.

---

## Receiver side — kit-based (auto-renders meeting card)

If your app uses `<CometChatMessageList />` to render the group's messages, the kit auto-renders the meeting message as a **"Join meeting" card** with a tap target. No additional code needed:

```tsx
<CometChatMessageList group={group} />
```

When a user taps the meeting card, the kit:
1. Calls `CometChatCalls.generateToken(sessionId, authToken)`
2. Opens `<CometChatOngoingCall>` with `sessionID={group.getGuid()}`
3. Joins the WebRTC session

The receiver is now in the same WebRTC session as the caller (and any other members who joined).

## Receiver side — custom UI (needs a message listener)

If you DON'T use `<CometChatMessageList />` — e.g. you have a custom chat surface, OR you want incoming-meeting notifications globally — register a `MessageListener` and handle the meeting message yourself:

```ts
import { CometChat } from "@cometchat/chat-sdk-javascript";

const GROUP_MEETING_LISTENER_ID = "APP_GROUP_MEETING_LISTENER";

CometChat.addMessageListener(
  GROUP_MEETING_LISTENER_ID,
  new CometChat.MessageListener({
    onCustomMessageReceived: (msg: CometChat.CustomMessage) => {
      if (msg.getCategory() !== CometChat.CATEGORY_CUSTOM) return;
      if (msg.getType() !== "meeting") return;

      const customData = msg.getCustomData() as { callType?: "audio" | "video"; sessionId?: string };
      const sessionId = customData.sessionId ?? msg.getReceiverId();
      const callType = customData.callType ?? "video";
      const fromUid = msg.getSender().getUid();
      const groupGuid = msg.getReceiverId();

      // Show YOUR group-call incoming UI here
      // (e.g. toast notification with "Join" button, badge on the group, etc.)
      showIncomingGroupCallUI({ sessionId, callType, fromUid, groupGuid });
    },
  }),
);

// On hangup or logout:
CometChat.removeMessageListener(GROUP_MEETING_LISTENER_ID);
```

Tap-to-join from your custom UI:

```ts
async function joinGroupCall(sessionId: string, callType: "audio" | "video", container: HTMLElement) {
  const loggedInUser = await CometChat.getLoggedInUser();
  const authToken = loggedInUser!.getAuthToken();
  const { token: callToken } = await CometChatCalls.generateToken(sessionId);

  const callSettings = new CometChatCalls.CallSettingsBuilder()
    .setIsAudioOnlyCall(callType === "audio")
    .enableDefaultLayout(true)
    .setCallListener(
      new CometChatCalls.OngoingCallListener({
        onCallEnded: () => { /* hangup UI */ },
      }),
    )
    .build();

  await CometChatCalls.joinSession(callToken, callSettings, container);
}
```

No `acceptCall` step — receivers just join the session. The meeting message remains in the chat history regardless of who joins.

---

## Edge cases

### Late joining

A meeting can be active for an hour before a member opens the app. The custom message persists in chat history; tapping the card joins the live session.

**UI implication:** the meeting card should reflect live state. Listen for `MessageListener.onCustomMessageReceived` to add new cards; poll or use presence to know if the session is currently active. There's no built-in "meeting is live" signal — apps typically render the card with a "Join meeting" CTA regardless and let the WebRTC layer fail gracefully if everyone has left.

### Cancelling / leaving

There's no "cancel the meeting" — the meeting message is permanent in chat history. Each participant leaves independently:

```ts
CometChatCalls.leaveSession();   // your local WebRTC session (v5 — endSession() is deprecated)
// No CometChat.endCall — meetings don't have a call entity.
```

If you want to mark a meeting as "ended" UX-wise, send a follow-up message (e.g. another custom message of type `meeting_ended`) and have the receiver UI update its cards based on it. Not built into the SDK.

### Push notifications

The meeting `CustomMessage` carries `metadata.pushNotification = "meeting"`. The CometChat push system can route this to a "meeting started in your group" push. Configure on the dashboard side under Notifications → Push Notification.

### Missed meetings

Since meetings don't ring, there's no "missed call" entity. If you want missed-meeting UI, derive it from message history: list meeting messages where the current user has NOT joined the session.

---

## Anti-patterns

1. **Registering only `addCallListener` and expecting group calls to ring.** They won't. Group calls fire `onCustomMessageReceived`, not `onIncomingCallReceived`. Always add both listeners if you support both 1:1 and group calling.
2. **Treating `sessionId` as ephemeral for groups.** It's the group GUID — persistent. Don't generate a new sessionId per group call; the kit uses the GUID intentionally so all joiners hit the same WebRTC session.
3. **Calling `CometChat.endCall(sessionId)` after a group hangup.** Meetings have no call entity to end; the API returns an error. Use `CometChatCalls.leaveSession()` (local) only.
4. **Using `acceptCall` / `rejectCall` on the meeting message.** Those only work on 1:1 call entities. For meetings, you just join (no accept) or ignore (no reject).
5. **Assuming all group members ring simultaneously.** Only members with an active `MessageListener` get `onCustomMessageReceived`. Offline members see the meeting card when they next open the group.
6. **Sending the meeting message without `metadata.pushNotification`.** Offline members won't get a push. The kit handles this for you when you use `<CometChatCallButtons>`; if you're building custom, copy the metadata pattern in §"Caller side — custom UI".

---

## Verification checklist

- [ ] If using kit components: `<CometChatCallButtons group={g}>` renders + tap initiates a meeting message
- [ ] If using custom caller UI: `CometChat.sendCustomMessage` is called with `type: "meeting"`, `category: CATEGORY_CUSTOM`, `customData: { callType, sessionId: groupGuid }`
- [ ] If using kit receiver: `<CometChatMessageList group={g}>` renders the meeting card with a "Join" button
- [ ] If using custom receiver: `addMessageListener` registers `onCustomMessageReceived` and filters by category + type
- [ ] On hangup, `CometChatCalls.leaveSession()` is called (NOT `CometChat.endCall`)
- [ ] Late-joining works — open app while meeting is live; tap card; join session
- [ ] Push notifications fire for offline group members (server-side configured)
- [ ] Both listeners (`addCallListener` + `addMessageListener`) wired if app supports both 1:1 and group calls

---

## Pointers

- `ringing-integration.md` — the 1:1 user-call flow (different channel — call listener, not message listener)
- `call-session.md` — pure session-mode (URL-based, no chat-side signaling at all)
- `cometchat-react-calls/SKILL.md` rule 1.7 — IncomingCall mount (1:1 only; group calls don't use this)
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/group-calls
- Kit source (verified 2026-05-15): `node_modules/@cometchat/chat-uikit-react-native/src/calls/CometChatCallButtons/CometChatCallButtons.tsx:138-201`
