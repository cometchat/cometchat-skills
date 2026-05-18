# Call layouts on web (React)

CometChat Calls SDK ships three layout modes: TILE (grid), SIDEBAR (main speaker + filmstrip), SPOTLIGHT (active speaker hero). Each participant picks their own layout — the choice is local, not session-wide.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/call-layouts

---

## Available layouts

| Layout | What it shows | Best for |
|--------|---------------|----------|
| `TILE` | Equally-sized grid tiles | Group meetings, equal participation |
| `SIDEBAR` | Main speaker, others in sidebar | Presentations, webinars |
| `SPOTLIGHT` | Hero active speaker, small thumbnails | 1:1 calls, focused discussions |

Default layout: kit picks based on participant count (`SPOTLIGHT` for 1:1, `TILE` for groups). Override only when your UX requires it.

---

## Set initial layout

Pass `layout` into call settings when joining:

```tsx
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

const callSettings = {
  layout: "TILE", // or "SIDEBAR" | "SPOTLIGHT"
  // ... rest of your CallSettings
};

await CometChatCalls.joinSession(callToken, callSettings, containerEl);
```

Use the constants instead of string literals to avoid typos:

```tsx
const layouts = CometChatCalls.constants.LAYOUT;
// layouts.TILE === "TILE"
// layouts.SIDEBAR === "SIDEBAR"
// layouts.SPOTLIGHT === "SPOTLIGHT"
```

---

## Change layout during a call

```tsx
function LayoutSwitcher() {
  const [layout, setLayout] = useState<"TILE" | "SIDEBAR" | "SPOTLIGHT">("TILE");

  function handleChange(next: typeof layout) {
    CometChatCalls.setLayout(next);
    setLayout(next);
  }

  return (
    <div role="radiogroup" aria-label="Call layout">
      {(["TILE", "SIDEBAR", "SPOTLIGHT"] as const).map((opt) => (
        <button
          key={opt}
          role="radio"
          aria-checked={layout === opt}
          onClick={() => handleChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
```

`setLayout` is local — only the caller's view changes. Other participants stay on whatever layout they had.

---

## Listen for layout changes

The kit fires `onCallLayoutChanged` when the user picks a different layout via the kit's built-in switcher. Listen so your custom controls stay in sync:

```tsx
useEffect(() => {
  const handler = (newLayout: string) => {
    setLayout(newLayout as typeof layout);
  };
  CometChatCalls.addEventListener("onCallLayoutChanged", handler);
  return () => {
    CometChatCalls.removeEventListener("onCallLayoutChanged", handler);
  };
}, []);
```

---

## Hide the kit's layout switcher

If you ship your own layout UI:

```tsx
const callSettings = {
  hideChangeLayoutButton: true,
  // ... rest
};
```

Or to suppress layout changing entirely (locked layout):

```tsx
// hide the button AND don't ship your own switcher
const callSettings = { hideChangeLayoutButton: true, layout: "TILE" };
```

---

## When to lock a layout

Lock to `SPOTLIGHT`:
- Telehealth provider/patient calls (focus on faces)
- 1:1 sales/demo calls
- Coaching sessions

Lock to `TILE`:
- Standups, retros, team meetings (everyone equally visible)
- Classroom or training calls

Lock to `SIDEBAR`:
- Webinars (presenter dominant)
- Live broadcasts with fixed roles

For general meetings: don't lock. Let users pick.

---

## Anti-patterns

1. **Calling `setLayout` before `joinSession` resolves.** Throws — the call surface isn't bound yet. Set the initial layout via `callSettings.layout` instead.
2. **Storing layout in URL or shared state.** Layout is per-participant local. Sharing it via URL/Firestore causes layout flicker as multiple peers fight to set it.
3. **String literals everywhere.** Use `CometChatCalls.constants.LAYOUT` so typos surface at autocomplete time, not runtime.
4. **Forgetting `removeEventListener` on unmount.** Listener accumulates across calls → `setLayout` fires N times.
5. **Custom switcher AND kit's switcher both visible.** Confusing. Set `hideChangeLayoutButton: true` if you ship your own.

---

## Verification checklist

- [ ] Initial layout passed via `callSettings.layout`
- [ ] `setLayout` only called after `joinSession` resolves
- [ ] `onCallLayoutChanged` listener cleaned up on unmount
- [ ] Layout constants used instead of string literals
- [ ] Smoke test: 3-person call, each participant picks different layout, nobody else's view changes

---

## Pointers

- `cometchat-react-calls/SKILL.md` — call surface architecture
- `cometchat-react-calls/references/recording.md` — sister cross-cutting concern
- `cometchat-react-calls/references/in-call-chat.md` — chat panel sits beside layout
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/call-layouts
