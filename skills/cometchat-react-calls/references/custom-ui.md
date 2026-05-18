# Custom call UI on web

When the kit's default `<CometChatOngoingCall />` doesn't fit your app's design system, drop down to the Calls SDK directly. Two escalation paths:

1. **Style the kit's component** — pass style props / CSS variable overrides. Cheapest. Covers most cases.
2. **Build your own surface on the SDK** — use `CometChatCalls.joinSession(token, settings, container)` directly with your own DOM container. Maximum control. The kit doesn't render anything; you do. (`startSession` is a deprecated v4 shim — use `joinSession`.)

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
      onAudioModesUpdated: (audioModes: unknown[]) => {
        // available mic / speaker devices
      },
      onCallSwitchedToVideo: (call: unknown) => {
        // remote upgraded the call from voice to video
      },
      onMediaDeviceListUpdated: (devices: unknown) => {
        // user plugged in headphones, etc.
      },
    });

    const settings = new CometChatCalls.CallSettingsBuilder()
      .setSessionID(sessionId)
      .setIsAudioOnly(false)
      .enableDefaultLayout(false)            // ← key: we render the UI ourselves
      .setCallEventListener(callListener)
      .build();

    // v5 generateToken takes ONLY sessionId — authToken is internal after CometChatCalls.login().
    CometChatCalls.generateToken(sessionId).then((tokenRes) => {
      // htmlElement is REQUIRED — pass a container the SDK can draw into.
      // With custom UI you typically render your own <video> elements; the
      // container can be hidden but must still be a real DOM node.
      const container = document.getElementById("calls-container")!;
      // joinSession is the v5 canonical — startSession is a deprecated shim.
      CometChatCalls.joinSession(tokenRes.token, settings, container);
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
        onMute={() => CometChatCalls.muteAudio(true)}
        onUnmute={() => CometChatCalls.muteAudio(false)}
        onCameraOff={() => CometChatCalls.pauseVideo(true)}
        onCameraOn={() => CometChatCalls.pauseVideo(false)}
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

The SDK methods (`muteAudio`, `pauseVideo`, `switchCamera`) propagate to all participants via the SDK's signaling — you don't manage track state yourself.

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

- **Spotlight** — one large remote tile + small thumbnails for others. Track which user is speaking (`onActiveSpeakerUpdated` event in some SDK builds) and swap the spotlight.
- **Grid** — CSS grid with auto-fit columns, 1-N participant tiles equally sized.
- **Picture-in-picture** — small floating remote video that survives navigation. Mount it in a portal at the layout root (similar to `<CometChatIncomingCall />`).

---

## When to NOT go custom

- Default kit UI works for 80% of apps; custom is a real engineering investment.
- Recording / screen-share / participant-management features require deeper SDK plumbing — `references/recording-screen-share.md` covers them but custom-UI authors must wire all of them themselves.
- Kit components handle accessibility (keyboard nav, ARIA roles, focus traps) — custom must replicate.
- The kit is updated when CometChat ships breaking SDK changes; custom code is yours to migrate.

The dispatcher asks the user whether to go custom (defaults to "no — use kit") and only loads this reference when they say yes.
