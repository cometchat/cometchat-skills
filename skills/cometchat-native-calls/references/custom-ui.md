# Custom call UI on React Native

Two paths:

1. **Style the kit's `<CometChatOngoingCall />`** — pass style props. Cheapest. Path-of-least-resistance for 80% of apps.
2. **Render `<CometChatCalls.Component callToken={...} />` with the SDK's default-UI elements hidden, then overlay your own controls.** This is the canonical RN custom-UI path — the SDK's Component handles WebRTC + tile rendering; your code controls the chrome.

This reference covers path 2.

> **Note on raw WebRTC bypass:** Earlier versions of this skill suggested using `react-native-webrtc`'s `<RTCView />` directly with `CometChatCalls.startSession`. That API does NOT exist on RN session mode — the SDK exposes only the declarative `<CometChatCalls.Component>` primitive. The example below shows the supported pattern.

---

## Architecture

```
Your screen component
├── <RTCView /> for local user (preview + during call)
├── <RTCView /> for remote participant(s)
├── Custom control panel (mute / camera / end / switch)
└── Custom layout (Stack / Modal / etc.)
```

`react-native-webrtc` ships `<RTCView />` — a native view that renders a `MediaStream` directly. The Calls SDK pipes streams to it through events.

---

## Required peer deps for custom UI

```bash
npm install react-native-webrtc react-native-incall-manager
```

`react-native-incall-manager` handles audio routing (speaker vs earpiece, Bluetooth, AirPods) — without it, voice calls default to earpiece-only and the user can't switch to speaker.

---

## Custom OngoingCallScreen

```tsx
import { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { RTCView, MediaStream } from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";
import { ControlPanel } from "./ControlPanel";

interface Props {
  sessionId: string;
  authToken: string;
  isAudioOnly: boolean;
  onCallEnded: () => void;
}

export function CustomOngoingCallScreen({ sessionId, authToken, isAudioOnly, onCallEnded }: Props) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const [callToken, setCallToken] = useState<string | null>(null);

  useEffect(() => {
    InCallManager.start({ media: isAudioOnly ? "audio" : "video" });
    if (!isAudioOnly) InCallManager.setForceSpeakerphoneOn(true);

    // Subscribe to lifecycle events. Use the v5 addEventListener API,
    // not the deprecated OngoingCallListener.
    const offClosed = CometChatCalls.addEventListener("onConnectionClosed", () => {
      cleanup();
      onCallEnded();
    });

    // Mint a fresh token for this session (v5 — generateToken takes only sessionId).
    CometChatCalls.generateToken(sessionId).then(({ token }) => {
      setCallToken(token);
    });

    return () => {
      offClosed();
      cleanup();
    };

    function cleanup() {
      InCallManager.stop();
      // leaveSession is v5 canonical (endSession is a deprecated shim).
      CometChatCalls.leaveSession();
    }
  }, [sessionId, isAudioOnly, onCallEnded]);

  return (
    <View style={styles.container}>
      {!isAudioOnly && remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          objectFit="cover"
          style={styles.remoteVideo}
        />
      )}
      {!isAudioOnly && localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          objectFit="cover"
          style={styles.localVideo}
        />
      )}
      <ControlPanel
        muted={muted}
        cameraOff={cameraOff}
        onToggleMute={() => {
          // No-arg methods: muteAudio() / unmuteAudio() (no boolean param).
          if (muted) CometChatCalls.unmuteAudio();
          else CometChatCalls.muteAudio();
          setMuted(!muted);
        }}
        onToggleCamera={() => {
          // No-arg methods: pauseVideo() / resumeVideo() (no boolean param).
          if (cameraOff) CometChatCalls.resumeVideo();
          else CometChatCalls.pauseVideo();
          setCameraOff(!cameraOff);
        }}
        onSwitchCamera={() => CometChatCalls.switchCamera()}
        onEnd={() => {
          // leaveSession is v5 canonical (endSession is a deprecated shim).
          CometChatCalls.leaveSession();
          onCallEnded();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  localVideo: { position: "absolute", top: 60, right: 20, width: 120, height: 160, borderRadius: 8 },
});
```

`react-native-webrtc`'s `<RTCView />` requires `streamURL`, not the `MediaStream` directly — call `.toURL()`.

---

## Control panel

```tsx
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

interface Props {
  muted: boolean;
  cameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onEnd: () => void;
}

export function ControlPanel({ muted, cameraOff, onToggleMute, onToggleCamera, onSwitchCamera, onEnd }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onToggleMute} style={styles.btn}>
        <Text>{muted ? "Unmute" : "Mute"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggleCamera} style={styles.btn}>
        <Text>{cameraOff ? "Cam on" : "Cam off"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSwitchCamera} style={styles.btn}>
        <Text>Flip</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onEnd} style={[styles.btn, styles.endBtn]}>
        <Text style={styles.endText}>End</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around" },
  btn: { backgroundColor: "rgba(255,255,255,0.2)", padding: 16, borderRadius: 32 },
  endBtn: { backgroundColor: "red" },
  endText: { color: "white" },
});
```

---

## Audio routing — InCallManager

The most-overlooked piece of custom RN call UI:

```ts
// On call start
InCallManager.start({ media: "video" });           // audio routed to speaker by default for video
InCallManager.setForceSpeakerphoneOn(true);

// User toggles speaker
function toggleSpeaker(on: boolean) {
  InCallManager.setForceSpeakerphoneOn(on);
}

// On call end
InCallManager.stop();                              // CRITICAL — restores normal audio routing
```

Without `InCallManager.stop()`, the app's other audio (music, video) routes through the call audio path until the user's device reboots. Particularly bad for podcast/music apps that have a chat screen.

---

## Active speaker detection (custom layout polish)

For multi-party calls where you want to highlight whoever's speaking:

The event is `onDominantSpeakerChanged` (there is no `onActiveSpeakerUpdated`). Use `addEventListener` (returns an unsubscribe fn) — `OngoingCallListener` is the @deprecated v4 path:

```ts
const off = CometChatCalls.addEventListener("onDominantSpeakerChanged", (uid: string) => {
  setActiveSpeakerUid(uid);
  // Re-layout: move that uid's tile to a larger position
});
// cleanup: off();
```

Not all SDK versions emit this event reliably; verify with the version you're on before relying on it.

---

## Picture-in-picture (Android only)

Android supports system PiP; iOS supports it for video calls but requires CallKit integration (out of scope for custom UI).

```ts
import { Platform } from "react-native";
import { enterPictureInPictureMode } from "react-native-webrtc";   // helper if available
// or use a native module — varies by RN version

function enterPip() {
  if (Platform.OS !== "android") return;
  // call your native bridge here
}
```

The SKILL.md's verification checklist doesn't require PiP — it's an enhancement, not a hard rule.

---

## When NOT to go custom

Same calculus as web:

- 80% of apps are fine with the kit's default `<CometChatOngoingCall />`
- Custom code is yours to maintain across SDK upgrades
- Recording / screen-share / participant management have their own SDK plumbing — covered in the kit components for free, manual in custom

The dispatcher asks before scaffolding custom and defaults to "no — use kit."
