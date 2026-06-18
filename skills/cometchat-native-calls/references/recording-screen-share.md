# Recording + screen-share on React Native

Both features live in the Calls SDK; both have RN-specific gotchas the kit's defaults don't handle. Sister of `cometchat-react-calls/references/recording-screen-share.md` — same SDK semantics, different platform plumbing for screen capture.

---

## Recording

### Server-side: dashboard gate

Recording is a paid feature on most CometChat plans. Enable in **Dashboard → Chat & Messaging → Calls → Recording**. The client-side flag below is a no-op without it.

### Client-side: opt-in per session

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

// Audio vs video + recording are SessionSettings OBJECT fields (v5), not builder methods.
// enableRecording()/setShowRecordingButton() do not exist on the v5 RN SDK.
const sessionSettings = {
  sessionType: "VIDEO",       // "VIDEO" | "AUDIO" — replaces the v4 setIsAudioOnlyCall builder
  autoStartRecording: true,   // server starts recording when the session begins
  hideRecordingButton: false, // show the in-call recording toggle (kit's default UI)
};
```

### Recording lifecycle events

`CometChatCalls.OngoingCallListener` is still re-exported but is the v4-era path — **@deprecated, prefer `CometChatCalls.addEventListener(...)`** (which returns an unsubscribe fn). Only `onRecordingStarted` / `onRecordingStopped` exist; there is no `onRecordingFailed`.

```ts
// Preferred (v5): addEventListener returns the unsubscribe fn.
const offStarted = CometChatCalls.addEventListener("onRecordingStarted", () => {
  // Update UI — show a "REC" indicator (compliance requirement in some jurisdictions)
  setRecording(true);
});
const offStopped = CometChatCalls.addEventListener("onRecordingStopped", () => {
  setRecording(false);
});
// cleanup: offStarted(); offStopped();
// NOTE: there is no onRecordingFailed event in the v5 RN SDK — do not listen for it.
```

### REC indicator (compliance)

In some regions, you must visually notify all participants when recording is active. The kit's default `CometChatOngoingCall` shows a small "Recording" badge. Custom UI must render this:

```tsx
{recording && (
  <View style={styles.recBadge}>
    <Text style={styles.recDot}>●</Text>
    <Text style={styles.recLabel}>REC</Text>
  </View>
)}
```

Don't omit this — the legal exposure is real (CCPA, GDPR, two-party-consent US states).

### Where the recordings go

CometChat hosts the file. It appears in **Dashboard → Calls → Recordings** with a download link. There is no client-side download API — the file isn't exposed to the device for security/compliance reasons.

For programmatic access:

```ts
// Server-side — your backend with the dashboard bearer token
const res = await fetch(
  `https://${region}.api-management.cometchat.io/v3/apps/${appId}/recordings`,
  { headers: { Authorization: `Bearer ${dashboardToken}` } },
);
const recordings = await res.json();
```

The skill points users at this REST endpoint; it doesn't generate client code (recordings shouldn't be downloadable from the device).

---

## Screen sharing

**Initiating a screen share from React Native is NOT supported.** Per the docs (`docs/calls/react-native/screen-sharing.mdx`): RN devices can only **view** screen shares started by participants on other platforms (web/desktop). There is no `startScreenSharing()` / `stopScreenSharing()` / `CometChatCalls.startScreenShare()` API on RN, no iOS Broadcast Extension flow, and no Android MediaProjection flow exposed by this SDK. Do not write screen-share-initiation code for RN.

### Viewer — receive / view a screen share

When a participant shares their screen from another platform, the kit's default `CometChatOngoingCall` UI auto-renders the screen-share tile (it switches to Sidebar layout automatically). Listen for screen-share events only to drive custom UI.

Two receive-path event channels exist (verified against the calls-sdk-react-native clone `skills/event-listeners/SKILL.md`):

```ts
// Participant events — fire with the remote participant who shared:
const offStart = CometChatCalls.addEventListener("onParticipantStartedScreenShare", (participant) => {
  setScreenSharePresenter(participant.name);
});
const offStop = CometChatCalls.addEventListener("onParticipantStoppedScreenShare", () => {
  setScreenSharePresenter(null);
});
// cleanup: offStart(); offStop();

// Media-event channel (received from a web participant), no payload:
CometChatCalls.addEventListener("onScreenShareStarted", () => { /* show screen-share tile */ });
CometChatCalls.addEventListener("onScreenShareStopped", () => { /* restore prior layout */ });
```

Custom-UI viewer composition:

```tsx
function CustomCallView() {
  const [screenSharePresenter, setScreenSharePresenter] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  return (
    <View style={styles.container}>
      {screenSharePresenter ? (
        <ScreenShareView presenterUid={screenSharePresenter} />
      ) : (
        <ParticipantTilesGrid participants={participants} />
      )}
    </View>
  );
}
```

When someone shares their screen, switch the layout to "screen share + participant strip"; switch back when they stop.

---

## Recording + screen-share together

Server-side recording captures whatever video composition the SFU is forwarding. When a (web/desktop) participant is screen-sharing, the recording shows their screen. When they stop, it switches back to the camera composition.

You don't compose this client-side — the server handles it. Custom UI just needs to render the screen-share track when present (receive path).

---

## Anti-patterns

1. **Trying to INITIATE a screen share from RN.** Not supported — there is no `startScreenSharing()`, iOS Broadcast Extension flow, or Android MediaProjection flow on this SDK. RN can only view shares from other platforms.
2. **No "REC" indicator in custom UI.** Compliance violation in two-party-consent jurisdictions.
3. **Trying to download recordings from the device.** They live on CometChat's servers. Use the dashboard or REST API.
4. **`autoStartRecording: true` without dashboard gate.** SessionSettings flag silently no-ops; user thinks recording is active when it isn't.
5. **Not handling the screen-share-stopped event in custom UI.** Layout doesn't switch back; viewer sees the last screen-share frame frozen.

---

## Verification checklist

**Recording:**
- [ ] Dashboard gate enabled (Recording feature on the plan)
- [ ] `autoStartRecording: true` in the SessionSettings object (NOT a builder method)
- [ ] `onRecordingStarted` / `onRecordingStopped` listeners wired via `addEventListener`
- [ ] "REC" indicator visible to all participants when active

**Screen share (RN = VIEW-only; initiation not supported):**
- [ ] Custom UI: layout switches to screen-share view on `onParticipantStartedScreenShare` / `onScreenShareStarted`
- [ ] Custom UI: layout switches back on `onParticipantStoppedScreenShare` / `onScreenShareStopped`

**Real-device smoke:**
- [ ] A web/desktop participant starts a screen share → it renders on the RN device
- [ ] That participant stops sharing → RN view returns to camera composition smoothly
- [ ] Recording starts, "REC" shows, recording appears in dashboard within ~30 seconds

---

## Pointers

- `references/custom-ui.md` — building custom call surfaces with screen-share viewer
- `references/group-calls.md` — group calls + screen share interplay (one share at a time)
- `references/voip-push-end-to-end.md` — push payloads
- `cometchat-native-calls` SKILL.md — base hard rules
- `cometchat-react-calls/references/recording-screen-share.md` — sister web reference (same SDK semantics)
