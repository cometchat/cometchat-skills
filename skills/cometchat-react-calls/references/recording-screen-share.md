# Recording + screen sharing on web

Both features ship with the Calls SDK; both have web-specific gotchas the kit's defaults don't handle.

---

## Recording

### Server-side: enable in the dashboard first

Recording is a paid feature gated by your CometChat plan. Enable it in **Dashboard → Chat & Messaging → Calls → Recording**. Without that, the client-side flag below is a no-op.

### Client-side: opt-in per session

```ts
// SessionSettings object passed to joinSession(token, settings, container).
// These are object fields — NOT CallSettingsBuilder methods (the v4 builder had
// enableRecording/setShowRecordingButton; v5 uses the object below).
const settings = {
  sessionType: 'VIDEO',          // 'VOICE' for audio-only (replaces setIsAudioOnly)
  autoStartRecording: true,      // ← server starts recording when the session begins
  hideRecordingButton: false,    // ← keep the user-toggleable Record button visible
};
```

Two fields, two behaviors:

- `autoStartRecording: true` — recording starts the moment the session begins. Server-side flag.
- `hideRecordingButton: false` — exposes a "Record" toggle in the default control panel. User decides when to start/stop. Custom-UI code must wire its own button (`CometChatCalls.startRecording()` / `stopRecording()` — there is no `toggleRecording()`; track state yourself and call the right one).

**Compliance note:** in some jurisdictions you must notify all participants before recording starts. The default kit UI shows a small "Recording" indicator; if you're using custom UI, you must render this yourself. The skill's verification checklist flags this.

### Recording lifecycle events

```ts
// v5 uses the static event bus; addEventListener returns an unsubscribe fn.
const offStarted = CometChatCalls.addEventListener("onRecordingStarted", () => {
  // server confirmed recording is active
});
const offStopped = CometChatCalls.addEventListener("onRecordingStopped", () => {
  // server stopped — file will appear in dashboard within ~30 seconds
});
// Cleanup when the call ends: offStarted(); offStopped();
//
// NOTE: there is no `onRecordingFailed` event on the v5 bus (and no
// onRecordingFailed member on OngoingCallListener). Plan-limit / storage-quota
// failures surface as a rejection from generateToken/joinSession or a server
// error — handle those, not a dedicated recording-failed callback.
```

### Where the recordings go

CometChat hosts the file. It appears in **Dashboard → Calls → Recordings** with a download link. The skill points users at the dashboard path; there is no client-side download API.

---

## Screen sharing

### Two roles: presenter + viewer

- **Presenter** (the user sharing their screen) — calls `CometChatCalls.startScreenSharing()`; the SDK handles `getDisplayMedia` + signaling internally
- **Viewer** (everyone else) — sees the presenter's screen as another video tile, no special API call needed

Browser support: Chrome/Edge (full), Firefox (full), Safari 13+ (full). On mobile browsers, `getDisplayMedia` is supported on iOS 16+ Safari and recent Android Chrome.

### Presenter — start sharing

```ts
async function startScreenShare() {
  try {
    CometChatCalls.startScreenSharing();
    // SDK handled getDisplayMedia + signaling; UI updates via onScreenShareStarted
  } catch (err: unknown) {
    if ((err as Error).name === "NotAllowedError") {
      // user clicked "Cancel" on the picker — no error UI needed
      return;
    }
    setError("Couldn't start screen share");
  }
}
```

Stop sharing:

```ts
CometChatCalls.stopScreenSharing();
```

The browser also fires its own "Stop sharing" button (the system overlay Chrome shows during a screen-share). The SDK listens for this too; `onScreenShareStopped` fires either way.

### Viewer — listen for screen-share events

```ts
// The v5 bus callbacks take NO arguments — they're notifications, not stream
// handoffs. The SDK renders the presenter's screen as a tile in its own layout;
// you don't receive a MediaStream to attach yourself (that was the v4 model).
const offStart = CometChatCalls.addEventListener("onScreenShareStarted", () => {
  setSomeoneSharing(true);
});
const offStop = CometChatCalls.addEventListener("onScreenShareStopped", () => {
  setSomeoneSharing(false);
});
// Cleanup: offStart(); offStop();
```

The SDK composes the screen-share tile alongside the camera tiles automatically. (Truly hand-rendering the shared stream requires the deprecated `OngoingCallListener` + `startSession` track-level path — see `custom-ui.md`.)

### Audio passthrough during screen share

By default, `getDisplayMedia` captures video only. To capture system audio (for sharing a video with sound), pass `audio: true`:

```ts
// Browser-level API — the SDK's startScreenSharing wraps this internally
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true,
});
```

Browser support is uneven — Chrome desktop has it; Firefox does not; Safari has it for tab capture but not full-screen.

The Calls SDK's `startScreenSharing()` does NOT request audio by default. If you need audio passthrough, use the lower-level `getDisplayMedia` API directly + pipe the audio track via a custom track-add hook (covered in `custom-ui.md`).

---

## Combining recording + screen-share

Server-side recording captures the active video composition, including screen-share when a participant is sharing. The recording file is one MP4 with the layout the kit was rendering at the time.

If you're using custom UI, the recording captures what the SDK sends to the server — not your custom DOM. The composition is determined by the SDK's internal layout, not your CSS.

---

## Browser permissions for screen-share

Like `getUserMedia`, `getDisplayMedia` requires HTTPS or `localhost`. It also requires an active user gesture (click/tap) — you cannot start it from a `useEffect` or timer. The skill scaffolds the API call inside an onClick handler.

System-level: macOS 10.15+ asks the user once to grant Chrome/Safari/Firefox permission to record the screen (System Preferences → Security & Privacy → Screen Recording). If the user denies, `getDisplayMedia` throws `NotAllowedError` with no remediation path inside the browser — surface a "Open System Preferences" instruction.

---

## Cleanup

Both recording and screen-share are part of the call session. `CometChatCalls.leaveSession()` stops both automatically. Custom UI must NOT separately call `getTracks().forEach(t => t.stop())` on the SDK's screen-share stream — the SDK owns it. Stop only the streams YOUR code created (e.g. local preview).
