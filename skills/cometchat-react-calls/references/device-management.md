# Device management on web

Camera / mic / speaker enumeration + switching mid-call. SDK exposes `getAudioInputDevices()` / `getVideoInputDevices()` / `getAudioOutputDevices()` plus `setAudioInputDevice(deviceId)` etc. Browser handles the underlying `navigator.mediaDevices.enumerateDevices()` plumbing.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/device-management
**Use it for:** "I'm on AirPods, switch from laptop mic"; "this monitor's webcam is bad, use the external one"; pre-call device picker; in-call settings menu.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

// Enumerate — these getters are SYNCHRONOUS (they return arrays, not promises;
// do NOT `await` them).
const mics = CometChatCalls.getAudioInputDevices();
const speakers = CometChatCalls.getAudioOutputDevices();
const cameras = CometChatCalls.getVideoInputDevices();

// Currently selected
const currentMic = CometChatCalls.getCurrentAudioInputDevice();

// Switch (mid-call OK) — also synchronous, return void.
CometChatCalls.setAudioInputDevice(deviceId);
CometChatCalls.setAudioOutputDevice(deviceId);
CometChatCalls.setVideoInputDevice(deviceId);

// Listen for device changes (user plugs in headphones, etc.). The valid event
// keys are onAudioInputDevicesChanged / onAudioOutputDevicesChanged /
// onVideoInputDevicesChanged (there is NO "onAudioModesUpdated"). addEventListener
// returns an unsubscribe function — there is no removeEventListener.
const off = CometChatCalls.addEventListener("onAudioInputDevicesChanged", (devices) => {
  // re-enumerate; show toast "AirPods connected"
});
// later: off();
```

Each device is a standard `MediaDeviceInfo` (the SDK types are `AudioInputDevice = MediaDeviceInfo & { kind: 'audioinput' }`, etc.). The fields you use:
```ts
// deviceId: string   ← the ID you pass to setAudioInputDevice() (NOT `id`)
// label:    string   ← "Built-in Microphone" / "AirPods Pro" (empty until mic permission granted)
// kind:     'audioinput' | 'videoinput' | 'audiooutput'
```

---

## Pre-call device picker

```tsx
import { useEffect, useState } from "react";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

function DevicePicker({ onConfirm }: { onConfirm: () => void }) {
  // Devices are MediaDeviceInfo objects — use `deviceId`, NOT `id`.
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>();
  const [selectedCamera, setSelectedCamera] = useState<string>();
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>();

  useEffect(() => {
    async function load() {
      // Devices have empty labels until permission is granted; trigger getUserMedia first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        // permission denied — labels will be empty; offer settings link
      }

      // These getters are SYNCHRONOUS — no await / Promise.all needed.
      const m = CometChatCalls.getAudioInputDevices();
      const c = CometChatCalls.getVideoInputDevices();
      const s = CometChatCalls.getAudioOutputDevices();
      setMics(m); setCameras(c); setSpeakers(s);

      setSelectedMic(CometChatCalls.getCurrentAudioInputDevice()?.deviceId ?? m[0]?.deviceId);
      setSelectedCamera(CometChatCalls.getCurrentVideoInputDevice()?.deviceId ?? c[0]?.deviceId);
      setSelectedSpeaker(CometChatCalls.getCurrentAudioOutputDevice()?.deviceId ?? s[0]?.deviceId);
    }
    load();
  }, []);

  function confirm() {
    // setters are synchronous, return void
    if (selectedMic) CometChatCalls.setAudioInputDevice(selectedMic);
    if (selectedCamera) CometChatCalls.setVideoInputDevice(selectedCamera);
    if (selectedSpeaker) CometChatCalls.setAudioOutputDevice(selectedSpeaker);
    onConfirm();
  }

  return (
    <form>
      <label>
        Microphone
        <select value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)}>
          {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>)}
        </select>
      </label>
      <label>
        Camera
        <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
          {cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>)}
        </select>
      </label>
      <label>
        Speaker
        <select value={selectedSpeaker} onChange={(e) => setSelectedSpeaker(e.target.value)}>
          {speakers.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 6)}`}</option>)}
        </select>
      </label>
      <button type="button" onClick={confirm}>Join call</button>
    </form>
  );
}
```

**Empty labels gotcha:** browsers return empty `label` strings until permission is granted. Trigger `getUserMedia` once before enumerating to populate labels.

---

## Hot-swap during a call (settings menu)

```tsx
function InCallDeviceSettings() {
  const [showMenu, setShowMenu] = useState(false);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (!showMenu) return;
    // getAudioInputDevices() is synchronous — returns an array, no .then().
    setMics(CometChatCalls.getAudioInputDevices());

    // addEventListener returns an unsubscribe fn — call it to clean up
    // (there is no removeEventListener on the SDK).
    const off = CometChatCalls.addEventListener("onAudioInputDevicesChanged", () => {
      setMics(CometChatCalls.getAudioInputDevices());
    });
    return () => off();
  }, [showMenu]);

  function selectMic(id: string) {
    CometChatCalls.setAudioInputDevice(id);   // synchronous, returns void
    setShowMenu(false);
  }

  return (
    <div>
      <button onClick={() => setShowMenu(s => !s)}>Mic ▾</button>
      {showMenu && (
        <ul role="menu">
          {mics.map(d => (
            <li key={d.deviceId}>
              <button role="menuitem" onClick={() => selectMic(d.deviceId)}>{d.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`onAudioInputDevicesChanged` (and `onAudioOutputDevicesChanged` / `onVideoInputDevicesChanged`) fire when the user plugs in headphones, AirPods connect, etc. Re-enumerate on the event.

---

## Bluetooth / AirPods routing

Browsers expose Bluetooth speakers in `getAudioOutputDevices()`. Selecting one calls `HTMLMediaElement.setSinkId()` under the hood — works in Chrome/Edge/Firefox, NOT in Safari (Safari uses system audio routing only).

```ts
// Detect Safari (limited device-output support)
const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
if (safari) {
  // Hide speaker selection; show "Use system audio" hint
}
```

---

## Anti-patterns

1. **Calling `getAudioInputDevices` before requesting permission.** Returns devices with empty `label` strings — UI shows "undefined" or empty entries.
2. **Caching device list.** Devices change (plug/unplug). Re-enumerate on every menu open AND on `onAudioInputDevicesChanged`.
3. **Hardcoding the first device as default.** Browsers may sort differently (built-in vs USB). Read `getCurrent*Device` first; only fall back to first if no current selection.
4. **Switching speakers in Safari.** `setAudioOutputDevice` silently fails. Detect Safari and hide the speaker picker (or show a "iOS uses system routing" tooltip).
5. **No listener cleanup on unmount.** Event accumulates listeners on remount; spam every device change.

---

## Verification checklist

- [ ] Permission requested before enumeration (empty-label fix)
- [ ] `getCurrent*Device()` used as default in pickers
- [ ] `onAudioInputDevicesChanged` listener for hot-swap detection (unsubscribe via the returned fn)
- [ ] Listener cleanup on unmount
- [ ] Safari speaker picker hidden / fallback message
- [ ] Browser smoke: plug/unplug headphones during call, picker updates
- [ ] AirPods smoke: connect AirPods → "AirPods" appears in mic + speaker lists
- [ ] Multi-camera smoke: USB webcam + built-in, switch between

---

## Pointers

- `cometchat-react-calls` SKILL.md — the seven hard rules
- `references/custom-ui.md` — full custom call UI integration
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/device-management
