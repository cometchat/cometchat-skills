# Use case — Team / Standup / Collaboration

Internal team meetings — standup, sprint review, retro, ad-hoc collaboration. The shape: 2–15 participants, all with mic + video on, TILE layout for equal visibility, screen-share for shared docs, in-call chat for links, optional recording for absent teammates.

**Examples:** Slack huddles, Microsoft Teams meetings, internal company calls.

---

## End-to-end flow

```
1. A user creates or joins a team channel (CometChat group already exists for the team)
   ↓
2. Anyone in the group can start a call → all members get a "huddle started" notification
   ↓
3. Members join voluntarily (no incoming-call ring — opt-in)
   ↓
4. Mic + camera ON by default (it's a team meeting, not a webinar)
   ↓
5. (Optional) Anyone can record; absent members get the link in the channel
   ↓
6. Screen-share + in-call chat for collaboration
   ↓
7. Last person leaves → call ends → optional recording posted to channel
```

---

## Recommended call settings

```ts
const settings = {
  layout: "TILE",                        // Equal visibility — team meetings
  hideChangeLayoutButton: false,          // Let users pick (some prefer SPOTLIGHT)

  hideRecordingButton: false,             // Anyone can record; team norms decide
  startRecordingOnCallStart: false,

  hideScreenShareButton: false,           // Critical
  hideVirtualBackgroundButton: false,

  hideChatButton: false,                  // Side-chat for links
  hideShareInviteButton: false,           // Pull others in mid-call

  hideRaiseHandButton: false,             // For larger team meetings (10+)

  callIdleTime: 1800,                     // 30min — meetings can have lulls
};
```

---

## "Huddle started" notification

```ts
// When someone starts a call in a team group, fire a custom message
// so other members see "🟢 Huddle started by Sarah" in the channel.
async function startHuddle(group: CometChat.Group) {
  // 1. Initiate the call
  const session = await CometChatCalls.startSession({
    sessionId: `huddle-${group.guid}-${Date.now()}`,
    participants: [...group.memberUids],
  });

  // 2. Post a custom message in the chat group
  const customMessage = new CometChat.CustomMessage(
    group.guid,
    CometChat.RECEIVER_TYPE.GROUP,
    "huddle_started",
    {
      sessionId: session.sessionId,
      startedBy: currentUserUid,
      startedAt: Date.now(),
    },
  );
  await CometChat.sendCustomMessage(customMessage);
}
```

Render in the chat list:

```tsx
function HuddleStartedBubble({ message }: Props) {
  const data = message.getCustomData();
  return (
    <div role="alert" className="huddle-bubble">
      <p>🟢 Huddle started by {resolveUserName(data.startedBy)}</p>
      <button onClick={() => joinHuddle(data.sessionId)}>Join</button>
    </div>
  );
}
```

---

## Recording → channel post

When the call ends and a recording was made, auto-post a link to the channel:

```ts
// Server-side: triggered by CometChat call-ended webhook
app.post("/webhooks/call", async (req, res) => {
  if (req.body.trigger === "call_ended" && req.body.data.recordingUrl) {
    const { sessionId, recordingUrl } = req.body.data;
    const groupGuid = sessionId.split("-").slice(0, 2).join("-").replace("huddle-", "");

    // Post a custom message in the team's chat group
    await cometchatApi.sendCustomMessage({
      receiver: groupGuid,
      receiverType: "group",
      type: "huddle_recording",
      data: {
        recordingUrl,
        durationSeconds: req.body.data.durationSeconds,
      },
    });
  }
  res.status(200).end();
});
```

---

## Anti-patterns

1. **Force-ringing all team members.** Annoying — they might be focused. Use channel notification + opt-in join.
2. **No screen-share quality config.** Default screen-share is 720p; for code review, bump to 1080p (`screenShareQuality: 'high'`).
3. **Idle timeout too short.** Standup runs 35min, idle of 600s ends it during a debate. Use 1800s (30min).
4. **Recording auto-on without team norms.** Some teams hate being recorded; surprise recording = trust hit. Default off; let team decide.
5. **No way to invite outside team mid-call.** Sometimes you need to pull in a designer or PM. Don't hide share-invite for team calls.
6. **Persistent sessions.** A "huddle" session that lasts forever bills forever. Auto-end when last person leaves.

---

## Auto-end on empty

```ts
// Subscribe to participant-left events; when count hits 0, end session
let participantCount = 0;
CometChatCalls.addEventListener("onParticipantJoined", () => participantCount++);
CometChatCalls.addEventListener("onParticipantLeft", () => {
  participantCount--;
  if (participantCount === 0) {
    CometChatCalls.endSession();
  }
});
```

---

## Verification checklist

- [ ] Mic + camera ON by default for joiners
- [ ] Layout TILE, but switchable
- [ ] Idle timeout 30min
- [ ] "Huddle started" custom message + Join button in channel
- [ ] Recording optional (not auto-on)
- [ ] Recording auto-posted to channel as link if made
- [ ] Auto-end when last participant leaves
- [ ] Share-invite available for pulling in non-team members

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — TILE layout
- `cometchat-react-calls/references/in-call-chat.md` — side chat
- `cometchat-react-calls/references/screen-sharing.md` — for shared docs
- `cometchat-react/SKILL.md` — group + custom message patterns
