# Picture-in-Picture on web

Web has two PiP APIs, used for different things:

1. **Video PiP** (`HTMLVideoElement.requestPictureInPicture()`) — lets a single `<video>` element float in a system-managed window above all browser tabs. Standard since Chrome 70 / Safari 13 / Firefox 71. Fine for one remote participant.

2. **Document PiP** (`window.documentPictureInPicture.requestWindow()`) — lets you put arbitrary HTML (custom call UI with controls, multi-tile grid, roster) in a floating window. Chrome 116+ only. Falls back gracefully where unsupported.

This reference covers both, plus when to pick which.

---

## When to use Video PiP vs Document PiP

| Scenario | Pick |
|---|---|
| 1:1 call, just want the remote face floating while user works | Video PiP |
| Multi-party call, want the active speaker + a small roster floating | Document PiP if Chrome 116+, else fall back to Video PiP |
| Want call controls (mute/end) visible in the PiP window | Document PiP only — Video PiP doesn't allow custom controls |
| Cross-browser support including Safari + Firefox | Video PiP (with fallback when neither works) |

The skill defaults to Video PiP for cross-browser compatibility; Document PiP is opt-in for Chromium-only apps.

---

## Video PiP — the simple path

```tsx
// CustomOngoingCallView.tsx — extends the version in references/custom-ui.md
const remoteVideoRef = useRef<HTMLVideoElement>(null);
const [pipActive, setPipActive] = useState(false);

async function enterPiP() {
  const video = remoteVideoRef.current;
  if (!video) return;
  if (!document.pictureInPictureEnabled) {
    setError("Picture-in-Picture isn't supported in this browser");
    return;
  }
  try {
    await video.requestPictureInPicture();
    setPipActive(true);
  } catch (err) {
    // user denied, video not yet playing, etc.
    console.warn("PiP request failed:", err);
  }
}

useEffect(() => {
  const video = remoteVideoRef.current;
  if (!video) return;
  const onEnter = () => setPipActive(true);
  const onLeave = () => setPipActive(false);
  video.addEventListener("enterpictureinpicture", onEnter);
  video.addEventListener("leavepictureinpicture", onLeave);
  return () => {
    video.removeEventListener("enterpictureinpicture", onEnter);
    video.removeEventListener("leavepictureinpicture", onLeave);
  };
}, []);
```

The `<video>` element keeps playing — PiP doesn't pause or remount. CSS doesn't apply (the OS owns the floating window). Hide the in-page video when PiP is active to avoid the "two videos playing" UX:

```tsx
<video
  ref={remoteVideoRef}
  autoPlay
  playsInline
  style={{ display: pipActive ? "none" : "block" }}
/>
```

---

## Document PiP — the rich path (Chrome 116+)

```tsx
const [pipWindow, setPipWindow] = useState<Window | null>(null);

async function enterDocumentPiP() {
  // Feature detect
  if (!("documentPictureInPicture" in window)) {
    return enterPiP();      // fall through to video PiP
  }

  const pipWin = await (window as unknown as {
    documentPictureInPicture: { requestWindow: (opts: { width: number; height: number }) => Promise<Window> };
  }).documentPictureInPicture.requestWindow({
    width: 360,
    height: 480,
  });

  // Copy the call container into the PiP window
  const container = document.getElementById("ongoing-call-root");
  if (container) {
    pipWin.document.body.appendChild(container);
  }

  // PiP window has its own document — copy stylesheets so kit styling works
  for (const styleSheet of Array.from(document.styleSheets)) {
    try {
      const cssRules = Array.from(styleSheet.cssRules ?? []).map((r) => r.cssText).join("\n");
      const style = pipWin.document.createElement("style");
      style.textContent = cssRules;
      pipWin.document.head.appendChild(style);
    } catch {
      // cross-origin stylesheets throw — copy <link> href instead
      if (styleSheet.href) {
        const link = pipWin.document.createElement("link");
        link.rel = "stylesheet";
        link.href = styleSheet.href;
        pipWin.document.head.appendChild(link);
      }
    }
  }

  // When the user closes the PiP window (system X button), restore the container
  pipWin.addEventListener("pagehide", () => {
    const restored = pipWin.document.getElementById("ongoing-call-root");
    if (restored && document.getElementById("call-host")) {
      document.getElementById("call-host")!.appendChild(restored);
    }
    setPipWindow(null);
  });

  setPipWindow(pipWin);
}
```

The `container` keeps its event handlers and React fiber attached — clicking "End" inside the PiP window still calls your React handlers. This is the magic of Document PiP that single-video PiP doesn't give you.

**Caveat:** stylesheets are copied at PiP-open time. If you change the theme mid-PiP (light/dark toggle), styles in the PiP window go stale. Add a `MutationObserver` or just don't allow theme switching while PiP is active.

---

## Browser support matrix

| Browser | Video PiP | Document PiP |
|---|---|---|
| Chrome 70+ desktop | ✓ | Chrome 116+ |
| Edge 79+ desktop | ✓ | Edge 116+ |
| Safari 13+ desktop | ✓ | ✗ (no plans yet) |
| Firefox 71+ desktop | ✓ (custom toggle UI, not standard API) | ✗ |
| Chrome mobile (Android) | ✓ system-PiP equivalent | ✗ |
| Safari iOS | iPad: ✓; iPhone: limited | ✗ |

Feature-detect both. Don't render the "Enter PiP" button when neither is supported.

```tsx
const canVideoPiP = typeof document !== "undefined" && document.pictureInPictureEnabled;
const canDocPiP = typeof window !== "undefined" && "documentPictureInPicture" in window;
const showPipButton = canVideoPiP || canDocPiP;
```

---

## Auto-enter PiP on tab switch

A "tab visibility" pattern many call UX teams want — auto-enter PiP when the user switches away from the call tab:

```tsx
useEffect(() => {
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden" && remoteVideoRef.current) {
      remoteVideoRef.current.requestPictureInPicture().catch(() => {});
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => document.removeEventListener("visibilitychange", onVisibilityChange);
}, []);
```

Browsers reject auto-PiP requests not tied to user gestures in some contexts (Safari is strictest). Use `await navigator.mediaSession.setActionHandler("enterpictureinpicture", ...)` for a cleaner API where supported.

---

## Auto-leave PiP on hangup

When the call ends, exit PiP cleanly:

```tsx
function endCall() {
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture();
  }
  if (pipWindow) {
    pipWindow.close();
    setPipWindow(null);
  }
  CometChatCalls.leaveSession();
  // ...rest of cleanup
}
```

Without this, the PiP window stays floating after the call ends, showing a frozen frame.

---

## PiP + custom UI integration

If you're using `enableDefaultLayout(true)` (kit-rendered call UI), PiP works on the kit's internal `<video>` element. Reach into it via:

```ts
const callContainer = document.getElementById("calls-container");
const video = callContainer?.querySelector("video");   // kit renders one or more
if (video instanceof HTMLVideoElement) {
  await video.requestPictureInPicture();
}
```

Brittle — kit DOM structure can change between versions. Custom UI (Document PiP path above) is more stable.

---

## Anti-patterns

1. **Calling `requestPictureInPicture()` from `useEffect` on mount.** Browsers reject — must be in response to user gesture. Wire to a button.
2. **Forgetting to hide the in-page `<video>` while PiP is active.** Two videos play, audio doubles, layout breaks.
3. **Document PiP without copying stylesheets.** PiP window renders unstyled; user sees raw HTML.
4. **Not exiting PiP on hangup.** Frozen frame floats after call ends.
5. **Document PiP detection via `'documentPictureInPicture' in document`.** It's on `window`, not `document`. Common typo.
6. **Auto-PiP on every visibility change, including page reload.** User reloads → unintended PiP. Gate on call active + user-initiated focus loss.

---

## Verification checklist

- [ ] PiP button only renders if `document.pictureInPictureEnabled` OR `'documentPictureInPicture' in window`
- [ ] PiP request triggered from a click handler, not `useEffect`
- [ ] In-page video hidden while PiP active (or repositioned)
- [ ] `enterpictureinpicture` / `leavepictureinpicture` listeners update local state
- [ ] Hangup path calls `document.exitPictureInPicture()` if active
- [ ] Document PiP path copies stylesheets to the PiP window's document
- [ ] Document PiP path restores the container to the main window on `pagehide`
- [ ] Real-browser smoke: Chrome desktop (both APIs) + Safari desktop (Video PiP) + Firefox (Video PiP)

---

## Pointers

- Custom UI integration: `references/custom-ui.md`
- Kit-default layout: kit handles internal video PiP via the kit's own controls
- Document PiP spec: https://wicg.github.io/document-picture-in-picture/
- `cometchat-react-calls` SKILL.md — base hard rules
