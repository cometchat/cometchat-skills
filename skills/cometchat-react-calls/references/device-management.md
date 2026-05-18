# Device management on web

Camera / mic / speaker enumeration + switching mid-call. SDK exposes `getAudioInputDevices()` / `getVideoInputDevices()` / `getAudioOutputDevices()` plus `setAudioInputDevice(deviceId)` etc. Browser handles the underlying `navigator.mediaDevices.enumerateDevices()` plumbing.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/device-management
**Use it for:** "I'm on AirPods, switch from laptop mic"; "this monitor's webcam is bad, use the external one"; pre-call device picker; in-call settings menu.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

// Enumerate
const mics = await CometChatCalls.getAudioInputDevices();
const speakers = await CometChatCalls.getAudioOutputDevices();
const cameras = await CometChatCalls.getVideoInputDevices();

// Currently selected
const currentMic = CometChatCalls.getCurrentAudioInputDevice();

// Switch (mid-call OK)
await CometChatCalls.setAudioInputDevice(deviceId);
await CometChatCalls.setAudioOutputDevice(deviceId);
await CometChatCalls.setVideoInputDevice(deviceId);

// Listen for device changes (user plugs in headphones, etc.)
CometChatCalls.addEventListener("onAudioModesUpdated", (devices) => {
  // re-enumerate; show toast "AirPods connected"
});
```

Each device looks like:
```ts
interface MediaDevice {
  id: string;          // browser-assigned ID
  label: string;       // "Built-in Microphone", "AirPods Pro"
  // ... other fields per browser
}
```

---

## Pre-call device picker

```tsx
import { useEffect, useState } from "react";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

interface MediaDevice { id: string; label: string; }

function DevicePicker({ onConfirm }: { onConfirm: () => void }) {
  const [mics, setMics] = useState<MediaDevice[]>([]);
  const [cameras, setCameras] = useState<MediaDevice[]>([]);
  const [speakers, setSpeakers] = useState<MediaDevice[]>([]);
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

      const [m, c, s] = await Promise.all([
        CometChatCalls.getAudioInputDevices(),
        CometChatCalls.getVideoInputDevices(),
        CometChatCalls.getAudioOutputDevices(),
      ]);
      setMics(m); setCameras(c); setSpeakers(s);

      setSelectedMic(CometChatCalls.getCurrentAudioInputDevice()?.id ?? m[0]?.id);
      setSelectedCamera(CometChatCalls.getCurrentVideoInputDevice()?.id ?? c[0]?.id);
      setSelectedSpeaker(CometChatCalls.getCurrentAudioOutputDevice()?.id ?? s[0]?.id);
    }
    load();
  }, []);

  async function confirm() {
    if (selectedMic) await CometChatCalls.setAudioInputDevice(selectedMic);
    if (selectedCamera) await CometChatCalls.setVideoInputDevice(selectedCamera);
    if (selectedSpeaker) await CometChatCalls.setAudioOutputDevice(selectedSpeaker);
    onConfirm();
  }

  return (
    <form>
      <label>
        Microphone
        <select value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)}>
          {mics.map(d => <option key={d.id} value={d.id}>{d.label || `Mic ${d.id.slice(0, 6)}`}</option>)}
        </select>
      </label>
      <label>
        Camera
        <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
          {cameras.map(d => <option key={d.id} value={d.id}>{d.label || `Camera ${d.id.slice(0, 6)}`}</option>)}
        </select>
      </label>
      <label>
        Speaker
        <select value={selectedSpeaker} onChange={(e) => setSelectedSpeaker(e.target.value)}>
          {speakers.map(d => <option key={d.id} value={d.id}>{d.label || `Speaker ${d.id.slice(0, 6)}`}</option>)}
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
  const [mics, setMics] = useState<MediaDevice[]>([]);

  useEffect(() => {
    if (!showMenu) return;
    CometChatCalls.getAudioInputDevices().then(setMics);
    
    const onModesUpdated = () => {
      CometChatCalls.getAudioInputDevices().then(setMics);
    };
    CometChatCalls.addEventListener("onAudioModesUpdated", onModesUpdated);
    return () => CometChatCalls.removeEventListener("onAudioModesUpdated", onModesUpdated);
  }, [showMenu]);

  async function selectMic(id: string) {
    await CometChatCalls.setAudioInputDevice(id);
    setShowMenu(false);
  }

  return (
    <div>
      <button onClick={() => setShowMenu(s => !s)}>Mic ▾</button>
      {showMenu && (
        <ul role="menu">
          {mics.map(d => (
            <li key={d.id}>
              <button role="menuitem" onClick={() => selectMic(d.id)}>{d.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`onAudioModesUpdated` fires when the user plugs in headphones, AirPods connect, etc. Re-enumerate on the event.

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
2. **Caching device list.** Devices change (plug/unplug). Re-enumerate on every menu open AND on `onAudioModesUpdated`.
3. **Hardcoding the first device as default.** Browsers may sort differently (built-in vs USB). Read `getCurrent*Device` first; only fall back to first if no current selection.
4. **Switching speakers in Safari.** `setAudioOutputDevice` silently fails. Detect Safari and hide the speaker picker (or show a "iOS uses system routing" tooltip).
5. **No listener cleanup on unmount.** Event accumulates listeners on remount; spam every device change.

---

## Verification checklist

- [ ] Permission requested before enumeration (empty-label fix)
- [ ] `getCurrent*Device()` used as default in pickers
- [ ] `onAudioModesUpdated` listener for hot-swap detection
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
