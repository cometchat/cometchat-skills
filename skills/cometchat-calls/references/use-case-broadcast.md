# Use case — Broadcast / Webinar

A presenter (or panel) addresses a large audience. Most attendees have audio + video off; a small set of presenters are visible. Q&A via raise-hand. Optional broadcast to YouTube/RTMP via server-side bridge.

**Examples:** Town halls, all-hands, product launches, conference sessions.

**Scale note:** CometChat Calls SDK supports up to ~50 simultaneous video streams per call (varies by plan). For 100+ broadcast use cases, consider streaming-protocol bridges (RTMP push to YouTube/Twitch) where most attendees consume via streaming, not bidirectional WebRTC.

---

## End-to-end flow

```
1. Presenter creates a "Broadcast" group (CometChat group keyed to event ID)
   ↓
2. Server pre-creates the group with presenters as moderators
   ↓
3. Attendees join the group (group is public OR password-gated for paid events)
   ↓
4. Event time: presenter starts call → attendees auto-join (no incoming-call ring)
   ↓
5. By default: all attendees mic + camera OFF
   Presenter has mic + camera ON
   ↓
6. Q&A: attendee taps "Raise hand" → presenter sees → presenter unmutes them
   ↓
7. Server-side: optional RTMP push streams the call to YouTube Live / Twitch / a CDN
   ↓
8. Presenter ends call → recording uploaded → notification + replay link sent to all attendees
```

---

## Recommended call settings

```ts
const settings = {
  layout: "SIDEBAR",                     // Presenter dominant
  hideChangeLayoutButton: true,           // Don't let attendees change

  hideRecordingButton: false,             // Presenter records
  startRecordingOnCallStart: true,        // Always record broadcasts (replay value)

  hideScreenShareButton: false,           // For slides
  hideVirtualBackgroundButton: false,

  hideChatButton: false,                  // Q&A overflow + reactions
  hideShareInviteButton: false,           // Encourage sharing

  hideRaiseHandButton: false,             // Critical for Q&A

  // Attendee-side: mic + camera off by default
  joinWithMutedAudio: true,
  joinWithMutedVideo: true,

  callIdleTime: 0,                        // Disable idle timeout — events run long
};
```

Presenters override `joinWithMutedAudio/Video: false` in their flow.

---

## Roles + permissions

In the CometChat group, set scopes:

```ts
// Server-side, when creating the broadcast group:
await cometchatApi.createGroup({
  guid: `event-${eventId}`,
  members: [
    { uid: presenterUid, scope: "admin" },
    ...coPresenterUids.map((uid) => ({ uid, scope: "moderator" })),
    // Attendees added on join (or batch-added pre-event for paid)
  ],
});
```

Then enforce role-based UI:

```tsx
function CallControls({ groupGuid, currentUserUid }: Props) {
  const role = useUserRoleInGroup(groupGuid, currentUserUid);
  const isPresenter = role === "admin" || role === "moderator";

  return (
    <div>
      {isPresenter && <RecordingButton />}
      {isPresenter && <ScreenShareButton />}
      {!isPresenter && <RaiseHandButton />}
      {/* Attendees see a stripped-down toolbar */}
    </div>
  );
}
```

---

## Raise-hand → unmute flow

```tsx
// Presenter's view: see attendees with raised hands, tap to unmute
function PresenterRaisedHandsList() {
  const [raised, setRaised] = useState<RaisedHand[]>([]);

  useEffect(() => {
    CometChatCalls.addEventListener("onParticipantHandRaised", (event: RaisedHand) => {
      setRaised((prev) => [...prev, event]);
    });
    CometChatCalls.addEventListener("onParticipantHandLowered", (event: RaisedHand) => {
      setRaised((prev) => prev.filter((p) => p.uid !== event.uid));
    });
  }, []);

  function unmuteParticipant(uid: string) {
    // Send a custom message asking participant to unmute themselves
    // (CometChat doesn't support force-unmute — privacy)
    CometChat.sendCustomMessage(/* type: 'unmute_request', target: uid */);
    // Optimistically lower their hand
    CometChatCalls.lowerParticipantHand(uid);
  }

  return (
    <ul>
      {raised.map((p) => (
        <li key={p.uid}>
          {p.name}
          <button onClick={() => unmuteParticipant(p.uid)}>Allow to speak</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## RTMP bridge for streaming

For broadcasts beyond CometChat's WebRTC capacity, server-side RTMP push:

```js
// Server-side: when broadcast starts, spin up an RTMP bridge that joins
// the call as a "viewer" and pushes the composited stream to YouTube Live.
// Use a service like Daily.co's RTMP-out, AWS IVS, or roll your own with
// FFmpeg + headless Chrome.
//
// CometChat does not ship an RTMP bridge — this is application infrastructure.
async function startRtmpBridge(eventId: string, rtmpUrl: string) {
  await rtmpBridgeService.start({
    sessionId: eventId,
    rtmpDestination: rtmpUrl,
    // Bridge joins with a service-account UID
    serviceAccountUid: `bridge-${eventId}`,
  });
}
```

---

## Anti-patterns

1. **No `joinWithMutedAudio: true` for attendees.** 50 people unmuted at once = chaos.
2. **No role differentiation.** Attendees can record / kick / share-invite → vandalism.
3. **Same SDK call for 200+ attendees.** WebRTC degrades. Use RTMP bridge for large audiences.
4. **No idle timeout disable.** Default 30min idle ends a 60min event mid-Q&A.
5. **Recording broadcasted to YouTube without disclosure.** GDPR / CCPA: attendees must know they're being recorded for public distribution.
6. **No pre-event check.** Presenter joins 5min before, mic doesn't work, panic. Have a "tech check" room they can join 30min ahead.

---

## Verification checklist

- [ ] Group created server-side with presenter as admin
- [ ] Attendees join muted (audio + video)
- [ ] Layout locked to SIDEBAR
- [ ] Recording auto-on
- [ ] Idle timeout disabled
- [ ] Raise-hand → presenter approval flow wired
- [ ] Role-based UI (presenter sees recording/screenshare; attendees see raise-hand)
- [ ] RTMP bridge for 100+ attendees
- [ ] GDPR/CCPA recording notice in attendee-facing copy
- [ ] Tech check room available pre-event

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — raise-hand reference
- `cometchat-react-calls/references/recording.md` — recording reference
- `cometchat-react-calls/references/screen-sharing.md` — for slides
- `cometchat-react-calls/references/call-layouts.md` — SIDEBAR layout
- `cometchat-react/SKILL.md` — group scope + admin patterns
