# Group calls (meetings) on React Native

1:1 calls are most of what apps need. Group calls — multi-party meetings with 3-N participants — have a different set of failure modes: capacity limits, network bandwidth scaling, active-speaker UI, roster management, moderation (mute-all, kick), and capacity warnings. This reference covers them.

The Calls SDK supports group calls natively; the kit's `CometChatOngoingCall` component handles up to ~10 participants well. Beyond that, custom UI (`references/custom-ui.md`) becomes necessary.

---

## Signaling architecture — meeting-message broadcast, NOT call ringing

**Critical to read first.** Group calls do NOT use the Ringing channel (`CometChat.initiateCall` → `onIncomingCallReceived`). That channel is **1:1 user calls only**. The kit broadcasts a **custom message of type `"meeting"`** to the group; receivers see a "Join meeting" card in their `<CometChatMessageList />` (kit) or need an explicit `onCustomMessageReceived` listener (custom UI).

Confirmed against kit source 2026-05-15: `node_modules/@cometchat/chat-uikit-react-native/src/calls/CometChatCallButtons/CometChatCallButtons.tsx:138-201`.

```
Caller (uid-A, member of group-X)        CometChat                Receivers (members of group-X)
  │                                          │                              │
  │ <CometChatCallButtons group={x}>         │                              │
  │ → CometChatUIKit.sendCustomMessage(      │                              │
  │     CustomMessage(GUID, GROUP,           │                              │
  │       "meeting",                         │                              │
  │       { callType, sessionId }))          │                              │
  ├─────────────────────────────────────────>│                              │
  │                                          │ onCustomMessageReceived      │
  │                                          ├─────────────────────────────>│ (each receiver's
  │                                          │                              │  MessageListener)
  │                                          │                              │
  │ caller mounts <CometChatOngoingCall      │   receiver taps "Join"       │
  │   sessionID={GUID} />                    │   → joinSession(GUID)        │
  │                                          │ <─────────────────────────── │
  │            ───── WebRTC session active (sessionId = group GUID) ─────   │
```

| Channel | 1:1 user calls | Group calls |
|---|---|---|
| Signaling API | `CometChat.initiateCall(call)` | `CometChat.sendCustomMessage(meetingMessage)` |
| Receiver event | `CallListener.onIncomingCallReceived` | `MessageListener.onCustomMessageReceived` (category=CATEGORY_CUSTOM + type="meeting") |
| Session ID | server-generated unique per call | the group's GUID (persistent) |
| Ring/decline | yes — `acceptCall` / `rejectCall` | no — receivers join or ignore |
| Auto-cancel timeout | yes (45s default) | no — meeting persists in chat history |

**Implication for custom-UI receivers:** if your app doesn't render `<CometChatMessageList group={g}>` (the kit auto-renders meeting cards there), you must register your OWN `MessageListener`:

```ts
import { CometChat } from "@cometchat/chat-sdk-react-native";

CometChat.addMessageListener(
  "APP_ROOT_GROUP_MEETING_LISTENER",
  new CometChat.MessageListener({
    onCustomMessageReceived: (msg: CometChat.CustomMessage) => {
      if (msg.getCategory() !== CometChat.CATEGORY_CUSTOM) return;
      if (msg.getType() !== "meeting") return;
      const customData = msg.getCustomData() as { callType?: "audio" | "video"; sessionId?: string };
      const sessionId = customData.sessionId ?? msg.getReceiverId();
      const callType = customData.callType ?? "video";
      // Show YOUR custom incoming-meeting UI (toast, badge, or full screen)
    },
  }),
);
```

**Implication for the `<CometChatIncomingCall />` overlay:** it does NOT fire for group meetings. It only listens on the 1:1 call channel. Custom UI for "incoming group meeting" must be built on top of `onCustomMessageReceived`.

This semantic surfaced on 2026-05-15 when Pixel 3 (kit-based RN) → Angular (custom UI) was tested; Angular received nothing because it only registered `addCallListener`. By design, not a bug.

---

## Initiating a group call

Group calls are tied to a CometChat group — the SDK uses the group's GUID as the session ID:

```ts
import { CometChat } from "@cometchat/chat-sdk-react-native";

const group = await CometChat.getGroup(guid);

// initiate a video call to the group
const call = new CometChat.Call(group.getGuid(), CometChat.CALL_TYPE.VIDEO, CometChat.RECEIVER_TYPE.GROUP);
const initiated = await CometChat.initiateCall(call);

// All currently-online group members receive an incoming-call notification
```

Different from 1:1: the receiver is the GROUP, not a single user. Anyone in the group can join via `acceptCall` until the call ends.

---

## Capacity limits

CometChat plan-driven. Common ceilings:

| Plan | Max participants per call |
|---|---|
| Free | 5 |
| Developer | 10 |
| Production | 25 |
| Enterprise | configurable up to 100 |

The SDK doesn't reject calls at capacity — it just stops admitting new joiners. In v5, observe the roster via `addEventListener('onParticipantListChanged', ...)` (returns the full list, not a delta — clone `skills/event-listeners`) and surface the ceiling to the user:

```ts
const MAX_PARTICIPANTS = 25; // your plan's ceiling
const off = CometChatCalls.addEventListener(
  "onParticipantListChanged",
  (participants: Array<{ uid: string; name: string }>) => {
    if (participants.length >= MAX_PARTICIPANTS) {
      Alert.alert("Call is full", "This meeting has reached its participant limit.");
    }
  },
);
// cleanup: off();
```

---

## Roster — who's in the call

```ts
// v5: addEventListener('onParticipantListChanged', ...) — the v4 OngoingCallListener.onUserListUpdated
// is deprecated (clone skills/event-listeners + skills/migration-v4-to-v5 mapping).
const off = CometChatCalls.addEventListener(
  "onParticipantListChanged",
  (users: Array<{ uid: string; name: string; avatar?: string }>) => {
    // Re-render the participant strip
    setParticipants(users);
  },
);
// cleanup: off();
```

Fires whenever a participant joins or leaves. The roster includes the local user — filter them out of the "remote participants" UI:

```ts
const localUid = CometChat.getLoggedinUser()?.getUid();
const remoteParticipants = users.filter((u) => u.uid !== localUid);
```

---

## Active speaker detection

The SDK fires `onDominantSpeakerChanged` when the dominant audio source changes (there is no `onActiveSpeakerUpdated` event). Prefer `addEventListener` (returns an unsubscribe fn); `OngoingCallListener` is the @deprecated v4 path:

```ts
const off = CometChatCalls.addEventListener("onDominantSpeakerChanged", (uid: string) => {
  setActiveSpeakerUid(uid);
});
// cleanup: off();
```

Use this to drive a "spotlight" layout — large tile for the active speaker, small thumbnails for the rest:

```tsx
function SpotlightLayout({ participants, activeSpeakerUid }: Props) {
  const speaker = participants.find((p) => p.uid === activeSpeakerUid) ?? participants[0];
  const others = participants.filter((p) => p.uid !== speaker?.uid);

  return (
    <View style={styles.spotlight}>
      <ParticipantTile participant={speaker} large />
      <ScrollView horizontal>
        {others.map((p) => (
          <ParticipantTile key={p.uid} participant={p} small />
        ))}
      </ScrollView>
    </View>
  );
}
```

**Throttle re-layout** — `onDominantSpeakerChanged` can fire multiple times per second in a noisy room. Debounce the layout swap to ~500ms minimum, otherwise tiles jitter.

---

## Mute-all / kick / raise hand — moderator actions

These require the local user to be a group **owner** or **moderator** (CometChat group scopes):

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

// Mute a specific participant. The method is muteParticipant(participantId) — synchronous,
// returns void. There is NO muteUser()/removeUser() on the RN SDK.
function muteParticipant(participantId: string) {
  CometChatCalls.muteParticipant(participantId);
}

// Mute everyone except local user
function muteAll() {
  for (const p of participants) {
    if (p.uid === localUid) continue;
    CometChatCalls.muteParticipant(p.uid);
  }
}

// NOTE: there is NO "kick / remove participant" API on the RN Calls SDK.
// Removal must be done via the Chat SDK group management (e.g. CometChat.kickGroupMember),
// which removes them from the group — not a per-call eject.

// Local user "raises hand" — signals to moderator (synchronous, returns void)
function raiseHand() {
  CometChatCalls.raiseHand();
}
```

**Permission check** — call these only if the local user has moderator scope:

```ts
const localScope = group.getScope();        // "admin" | "moderator" | "participant"
const canModerate = localScope === "admin" || localScope === "moderator";
```

Don't render mute-all/kick buttons for non-moderators.

---

## Bandwidth scaling — quality vs participant count

WebRTC mesh topology (every peer connects to every other peer) doesn't scale. CometChat uses an SFU (Selective Forwarding Unit) for group calls — your client uploads one stream, downloads N streams.

Practical bandwidth (per local user, video on):

| Participants | Upload | Download |
|---|---|---|
| 2 | 1 Mbps | 1 Mbps |
| 5 | 1 Mbps | 5 Mbps |
| 10 | 1 Mbps | 10 Mbps |
| 25 | 1 Mbps | 25 Mbps |

Mobile networks struggle past 10. The skill recommends:

- Cap default participant count at 10 for mobile-only audiences
- Auto-disable video for participants beyond the spotlight + 4 most-recent speakers (custom UI)
- Switch to audio-only mode if the device's battery drops below 20% (`expo-battery` or custom native module)

```ts
// auto-downgrade to audio-only on low battery
import * as Battery from "expo-battery";

const level = await Battery.getBatteryLevelAsync();
if (level < 0.2) {
  CometChatCalls.pauseVideo();   // no-arg; resumeVideo() to resume (synchronous, returns void)
  Alert.alert("Battery saver", "Video paused to save battery.");
}
```

---

## Joining a group call already in progress

If User A starts the call and the group has 5 members, the other 4 receive an incoming-call notification. But what about User B who logs in DURING the call?

The CometChat backend stores active call state. A joining user can query:

```ts
const ongoing = await CometChat.getActiveCall();
if (ongoing && ongoing.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP) {
  // Show "Join meeting" button — call is in progress
}
```

Use this to render a "Join meeting" button on the group screen during an active call. The kit's `CometChatMessageHeader` does this automatically when the group has an active call.

---

## Anti-patterns

1. **Rendering tiles for every participant.** At 25 people, you have 25 `<RTCView />` instances; that's where RN's bridge starts choking. Render the active speaker + max 6 thumbnails.
2. **Updating layout on every `onDominantSpeakerChanged`.** Debounce to 500ms minimum.
3. **Allowing non-moderators to call `muteParticipant`.** Only owners/moderators should see the button. (Per-call "kick" doesn't exist on the RN SDK — see above.)
4. **No bandwidth warning.** A user on cellular joining a 10-person call burns their data plan in minutes. Show a "Switch to audio-only" prompt at the threshold.
5. **Forgetting to filter local user from the roster.** "Speaking with myself" tile.
6. **Initiating group calls without group membership check.** Non-members get "ERR_NOT_GROUP_MEMBER" silently.

---

## Verification checklist

- [ ] Active-speaker handler debounced (≥500ms)
- [ ] Roster filters out local user
- [ ] Moderator buttons hidden for non-moderator scopes
- [ ] Capacity error surfaces in UI when join fails
- [ ] Bandwidth warning at participant count threshold (configurable)
- [ ] Battery-saver downgrade hook (optional, recommended)
- [ ] `getActiveCall()` checked on group screen mount
- [ ] Maximum N tiles rendered (clamp + overflow indicator: "+5 more")
- [ ] Real-device smoke: 5+ participants on real cellular network for 5+ minutes

---

## Pointers

- `references/custom-ui.md` — building custom multi-tile layouts on the SDK
- `references/recording-screen-share.md` — recording group calls (server-side composition handles the layout)
- `references/voip-push-end-to-end.md` — push for group call invitations
- `cometchat-native-calls` SKILL.md — base hard rules
