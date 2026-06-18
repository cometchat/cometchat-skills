# Custom call UI on web

When the kit's default `<CometChatOngoingCall />` doesn't fit your app's design system, drop down to the Calls SDK directly. Two escalation paths:

1. **Style the kit's component** — pass style props / CSS variable overrides. Cheapest. Covers most cases.
2. **Build your own surface on the SDK** — drive the session directly with your own DOM container. Maximum control. The kit doesn't render anything; you do.

> ⚠️ **Two join APIs — pick by which settings type you build.** `joinSession(token, sessionSettings, container)` is the v5 canonical and takes a **`SessionSettings` object** (the `hide*` / `sessionType` / `layout` flags). It does **not** accept the output of `CallSettingsBuilder.build()` — those are incompatible types. The `CallSettingsBuilder` (with `enableDefaultLayout(false)`, `setCallListener`, etc.) produces a `CallSettings` consumed only by the **deprecated** `startSession(token, callSettings, container)`. So: **hybrid / hide-chrome custom UI → object + `joinSession`** (preferred); **fully-custom render-your-own-tiles (`enableDefaultLayout(false)`) → builder + `startSession`** (the one path where the deprecated call is still required, because `enableDefaultLayout` lives only on the builder).

This reference covers path 2 — full custom UI on the SDK. Path 1 is in the kit's component documentation (see `cometchat-customization`).

---

## Architecture

```
Your React component
├── Local user video (mic + camera preview)         ← <video> element + getUserMedia
├── Remote participant video tile(s)                ← <video> elements piped from Calls SDK
├── Custom control panel (mute, end, switch cam)    ← buttons calling SDK methods
└── Layout (full-screen / picture-in-picture / grid) ← your CSS
```

The Calls SDK gives you:

- A `RTCMultiConnection`-like internal connection it manages
- Track-add events (when a participant's track arrives)
- Track-remove events
- Methods to mute/unmute, switch camera, end session
- A `htmlElement` you pass to `startSession` — **required** — where the SDK draws the call surface. With `enableDefaultLayout(false)`, the SDK still uses this container for internal video elements; your custom UI overlays on top via absolute positioning, OR you keep the container hidden and use the listener events to drive your own `<video>` elements (advanced; see "Advanced — bypassing the SDK's container" below).

---

## Hooking into track events

```tsx
// CustomOngoingCallView.tsx
import { useEffect, useRef } from "react";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

interface Props {
  sessionId: string;
  authToken: string;
  onCallEnded: () => void;
}

export function CustomOngoingCallView({ sessionId, authToken, onCallEnded }: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // ⚠️ CometChatCalls.OngoingCallListener is @deprecated (use addEventListener).
    // It's only here because enableDefaultLayout(false) + startSession require it.
    const callListener = new CometChatCalls.OngoingCallListener({
      onUserListUpdated: (userList: unknown) => {
        // userList = current participants — re-render your custom roster
      },
      onCallEnded: () => {
        cleanup();
        onCallEnded();
      },
      onCallEndButtonPressed: () => {
        // User clicked YOUR end button — we still have to call endSession
        CometChatCalls.leaveSession();
      },
      onError: (error: unknown) => {
        console.error("Call error:", error);
      },
      onCallSwitchedToVideo: (call: unknown) => {
        // remote upgraded the call from voice to video
      },
      onMediaDeviceListUpdated: (devices: unknown) => {
        // user plugged in headphones, etc.
      },
    });

    // ⚠️ CallSettingsBuilder method names (verified against calls-sdk-javascript@5):
    //   - there is NO .setSessionID() on the builder — sessionId flows through
    //     generateToken(sessionId) below, NOT the builder
    //   - it's .setIsAudioOnlyCall(bool), not .setIsAudioOnly()
    //   - it's .setCallListener(listener), not .setCallEventListener()
    const settings = new CometChatCalls.CallSettingsBuilder()
      .setIsAudioOnlyCall(false)
      .enableDefaultLayout(false)            // ← key: we render the UI ourselves
      .setCallListener(callListener)
      .build();

    // v5 generateToken takes ONLY sessionId — authToken is internal after CometChatCalls.login().
    CometChatCalls.generateToken(sessionId).then((tokenRes) => {
      // htmlElement is REQUIRED — pass a container the SDK can draw into.
      // With custom UI you typically render your own <video> elements; the
      // container can be hidden but must still be a real DOM node.
      const container = document.getElementById("calls-container")!;
      // This example builds CallSettings via CallSettingsBuilder (enableDefaultLayout(false)),
      // so it MUST use startSession — joinSession only accepts a SessionSettings object,
      // not the builder's CallSettings output. startSession is deprecated but is the only
      // consumer of enableDefaultLayout(false)-style fully-custom settings.
      CometChatCalls.startSession(tokenRes.token, settings, container);
    });

    return () => cleanup();

    function cleanup() {
      // leaveSession is v5 canonical — endSession() is deprecated (still works as a shim).
      CometChatCalls.leaveSession();
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    }
  }, [sessionId, authToken, onCallEnded]);

  return (
    <div className="ongoing-call">
      <video ref={remoteVideoRef} autoPlay playsInline className="remote-tile" />
      <video ref={localVideoRef} autoPlay playsInline muted className="local-tile" />
      <ControlPanel
        onMute={() => CometChatCalls.muteAudio()}
        onUnmute={() => CometChatCalls.unmuteAudio()}
        onCameraOff={() => CometChatCalls.pauseVideo()}
        onCameraOn={() => CometChatCalls.resumeVideo()}
        onSwitchCamera={() => CometChatCalls.switchCamera()}
        onEnd={() => {
          CometChatCalls.leaveSession();
          onCallEnded();
        }}
      />
    </div>
  );
}
```

---

## Custom control panel — the canonical mute/end/camera buttons

```tsx
function ControlPanel(props: {
  onMute: () => void;
  onUnmute: () => void;
  onCameraOff: () => void;
  onCameraOn: () => void;
  onSwitchCamera: () => void;
  onEnd: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  return (
    <div className="control-panel">
      <button onClick={() => { muted ? props.onUnmute() : props.onMute(); setMuted(!muted); }}>
        {muted ? "Unmute" : "Mute"}
      </button>
      <button onClick={() => { cameraOff ? props.onCameraOn() : props.onCameraOff(); setCameraOff(!cameraOff); }}>
        {cameraOff ? "Camera on" : "Camera off"}
      </button>
      <button onClick={props.onSwitchCamera}>Switch camera</button>
      <button onClick={props.onEnd} className="end-call">End</button>
    </div>
  );
}
```

The SDK methods (`muteAudio`/`unmuteAudio`, `pauseVideo`/`resumeVideo`, `switchCamera`) propagate to all participants via the SDK's signaling — you don't manage track state yourself.

> ⚠️ **These are no-argument methods.** `muteAudio(): void` / `pauseVideo(): void` — there is NO boolean parameter. `CometChatCalls.muteAudio(false)` does **not** unmute (the arg is ignored — it still mutes). Use the explicit pair: `muteAudio()` / `unmuteAudio()` and `pauseVideo()` / `resumeVideo()`. (There is **no** `toggleAudio()` / `toggleVideo()` in the v5 SDK — track the muted/paused state yourself and call the matching method of the pair.)

> ⚠️ **Optimistic local state desyncs.** A control panel that only flips its own `useState` on click (as the example above does) will show a stale label whenever mute/camera/screen-share change from *outside* your bar — a join-muted call (`startAudioMuted`), the browser's own "Stop sharing" button, or another surface. Reconcile by subscribing to the SDK's media events and driving state from them: `onAudioMuted` / `onAudioUnMuted` / `onVideoPaused` / `onVideoResumed` / `onScreenShareStarted` / `onScreenShareStopped` / `onRecordingStarted` / `onRecordingStopped`. Seed the initial state from your join options so the first render is correct too.

---

## Two custom-panel models — and the `hideHeaderPanel` footgun

There are **two** ways to put your own controls on a call, and they are very different:

**Model A — fully custom (`enableDefaultLayout(false)`).** The SDK draws nothing; you render every tile, every button, the whole surface. That's the path above. It leans on **two deprecated V5 APIs** — `startSession` (the only consumer of builder-produced `CallSettings`) and the `CometChatCalls.OngoingCallListener` accessor (the SDK marks it `@deprecated → use addEventListener`) — because `enableDefaultLayout(false)` exists only on the builder and has no `SessionSettings`-object equivalent. Use it only when you truly must render your own video tiles, and accept owning a11y, recording/screen-share plumbing, and the eventual migration off these shims. **For everything else, prefer Model B — it's 100% current V5 (`joinSession` + object + `addEventListener`).**

**Model B — hybrid (keep the SDK layout, replace only the bottom bar).** Far cheaper and far more common. You keep the SDK's default layout but pass `SessionSettings` flags to `joinSession` to hide just the control bar, then render your own bar over it:

```ts
const settings = {
  sessionType: 'VIDEO',
  layout: 'TILE',
  hideControlPanel: true,   // ← hide ONLY the bottom control bar; render your own
  // hideHeaderPanel: true,  // ← ⚠️ DO NOT add this unless you mean it (see below)
};
await CometChatCalls.joinSession(token, settings, container);
```

> ⚠️ **`hideHeaderPanel: true` silently disables Virtual Background, In-Call Chat, and the Participant List.** Those three features live in the SDK's **header** panel, not the control bar. If you set `hideHeaderPanel: true` to "clean up" a custom-bar call, you remove them with no replacement — and there are **no plain `CometChatCalls` static methods** to rebuild VB or in-call chat in your own bar (VB is exposed only as call-session instance methods / action constants like `setBackgroundBlur`, not statics). So a custom *control* bar should hide only `hideControlPanel`; leave `hideHeaderPanel` false so VB / chat / participant-list stay reachable. Real customer bug, 2026-06: ticking a "custom control panel" option flipped both flags and made VB + chat vanish.

If you genuinely don't want the header either, you're back in Model A territory — own those features yourself.

### Participant count from a custom bar

Don't derive the roster from `onParticipantJoined` / `onParticipantLeft` increments — those fire only for participants who join/leave **after** you, so a counter seeded at 0 (or 1) **undercounts when you join a call already in progress**. Subscribe to the authoritative full-list event instead:

```ts
CometChatCalls.addEventListener('onParticipantListChanged', (list) =>
  setParticipants(Math.max(1, list.length)),  // list includes the local user
);
```

---

## Local preview (before the call connects)

For a "ringing" UI where the local user sees their own camera before the receiver picks up:

```tsx
useEffect(() => {
  let stream: MediaStream | null = null;
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((s) => {
    stream = s;
    if (localVideoRef.current) localVideoRef.current.srcObject = s;
  }).catch((err) => {
    if (err.name === "NotAllowedError") setError("Camera/mic permission denied");
    if (err.name === "NotFoundError") setError("No camera or mic on this device");
  });

  return () => {
    stream?.getTracks().forEach((t) => t.stop());     // CRITICAL — release tracks (rule 1.3)
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  };
}, []);
```

Once `startSession` runs, the SDK takes over the camera/mic — release your preview stream first or you'll have two consumers fighting over the device.

---

## Layout customization

The Calls SDK is layout-agnostic when `enableDefaultLayout(false)`. You compose remote tiles in any CSS layout:

- **Spotlight** — one large remote tile + small thumbnails for others. Track who's speaking via the `onDominantSpeakerChanged` event (NOT `onActiveSpeakerUpdated` — that name doesn't exist) and swap the spotlight.
- **Grid** — CSS grid with auto-fit columns, 1-N participant tiles equally sized.
- **Picture-in-picture** — small floating remote video that survives navigation. Mount it in a portal at the layout root (similar to `<CometChatIncomingCall />`).

---

## When to NOT go custom

- Default kit UI works for 80% of apps; custom is a real engineering investment.
- Recording / screen-share / participant-management features require deeper SDK plumbing — `references/recording-screen-share.md` covers them but custom-UI authors must wire all of them themselves.
- Kit components handle accessibility (keyboard nav, ARIA roles, focus traps) — custom must replicate.
- The kit is updated when CometChat ships breaking SDK changes; custom code is yours to migrate.

The dispatcher asks the user whether to go custom (defaults to "no — use kit") and only loads this reference when they say yes.
