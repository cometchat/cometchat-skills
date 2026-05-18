# Call session — joinSession with no ringing (web)

The Call Session flow uses **only the Calls SDK**. Both parties enter a known `sessionId` directly via `CometChatCalls.joinSession` — no Chat SDK call entity, no ringing, no incoming-call notification. This is the right pattern for **scheduled meetings, conference rooms, and shareable meeting links**.

**Three calling modes — pick the right one:**

| Mode | Driver | When to use |
|---|---|---|
| **Standard** | UI Kit (`CometChatCallButtons`) | 80% case — chat-driven calls with prebuilt UI |
| **Ringing** (see `ringing-integration.md`) | Chat SDK call entity + Calls SDK session | Custom incoming/outgoing call UI on top of CometChat signaling |
| **Call Session (this doc)** | Calls SDK `joinSession` directly | Meeting-room URLs, scheduled calls, no ringing |

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/join-session

---

## When this is the right mode

- "Join meeting" link sent in calendar invite
- Conference rooms — same sessionId for repeated meetings
- Webinars / town halls (combined with Tier 4 broadcast use-case)
- Team huddles — sessionId derived from the team channel ID
- Office hours — fixed sessionId, anyone can join during hours

If your UX has *one party initiating and another being notified*, you want **Ringing**, not Call Session.

---

## Hard rules

1. **All participants need the same `sessionId`.** Generate it server-side; share via your app's existing channels (chat custom message, email link, push notification).
2. **`generateToken(sessionId)` is per-user, per-session.** Each participant generates their own token; the token embeds the user's identity. Don't share tokens between users.
3. **The container element must exist before `joinSession` runs AND must have measurable, viewport-anchored dimensions.** Use `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh` (matches the upstream sample), OR explicit pixel dimensions. Flex-derived sizing inside nested layouts has produced "container exists but iframe renders at 0×0 → no video" in customer integrations. The SDK measures the container at the moment `joinSession` is called.
4. **`CometChatCalls.login(uid)` must run before `generateToken`.** Otherwise `ERROR_AUTH_TOKEN_MISSING`. Pass `authKey` once at `CometChatCalls.init({appId, region, authKey})` time so `login(uid)` needs no second arg — matches the sample app pattern.
5. **`joinSession` returns an object with `error`** — check it. Don't assume a resolved Promise = success.
6. **No `CometChat.endCall` needed** — Call Session has no chat-side call entity. Just `CometChatCalls.leaveSession`.
7. **For session-only integrations, the Chat SDK is OPTIONAL.** The upstream sample app uses ONLY the Calls SDK — no `CometChat.init` / `CometChat.login` anywhere. Keep the dual-SDK contract for additive (chat + calls) integrations; drop the Chat SDK entirely for standalone session-mode (calls-only meeting-room UX).
8. **Pass an empty settings object `{}` and let the SDK pick defaults** unless you have a specific reason to override. Explicit values like `{ sessionType: "VIDEO", layout: "TILE", ... }` are technically valid per the type defs but have caused unexplained rendering issues in some version combinations — the sample app uses `{}`.

---

## SessionId generation strategy

Pick ONE strategy and stick with it across your app:

| Strategy | Example sessionId | Use when |
|---|---|---|
| **UUID per meeting** | `uuid-v4-string` | One-off meetings, calendar invites |
| **Stable per resource** | `team-${teamId}` or `appt-${appointmentId}` | Recurring meetings, persistent rooms |
| **Time-bucketed** | `office-hours-${dateYYYYMMDD}` | Drop-in events |

Generate server-side so you can store metadata (start time, allowed participants, expiry) and authorize joins.

---

## Token generation

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

async function getCallToken(sessionId: string): Promise<string> {
  const result = await CometChatCalls.generateToken(sessionId);
  if (!result?.token) throw new Error("Token generation failed");
  return result.token;
}
```

Each user calls this with the SAME `sessionId` but gets a token tied to their own identity. The token is short-lived (typically 5 min); don't cache aggressively.

---

## Join session

This pattern mirrors the upstream sample exactly: `/Users/swapnil/Downloads/calls-sdk/calls-sdk-javascript-5/sample-apps/cometchat-calls-sample-app-react/src/pages/join-session/JoinSession.tsx`. Customer-validated against the v5 SDK as the known-good shape.

```tsx
import { useEffect, useRef, useState } from "react";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

function CallRoom({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inMeeting, setInMeeting] = useState(false);

  // Auto-join once we have a sessionId. The state flip gates joinSession
  // away from StrictMode's mount-phase double-effect (which raced
  // leaveSession against an in-flight joinSession in prior versions).
  useEffect(() => {
    if (sessionId) setInMeeting(true);
  }, [sessionId]);

  // Reset state when the SDK reports the connection closed (peer left,
  // network died, user clicked the in-iframe Leave button).
  useEffect(() => {
    const off = CometChatCalls.addEventListener("onConnectionClosed", () => {
      setInMeeting(false);
    });
    return () => off();
  }, []);

  // The actual join happens in an effect that depends on `inMeeting` —
  // the container ref is guaranteed populated because the <div> renders
  // on every status, not behind a conditional.
  useEffect(() => {
    if (!inMeeting || !sessionId) return;

    CometChatCalls.generateToken(sessionId).then(({ token }) => {
      if (containerRef.current) {
        // Empty settings = SDK defaults (matches sample app).
        // The third arg is the container element; the SDK draws into it.
        CometChatCalls.joinSession(token, {}, containerRef.current);
      }
    });

    return () => {
      try {
        CometChatCalls.leaveSession();
      } catch {
        // ignore — not joined or already left
      }
    };
  }, [inMeeting, sessionId]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}
```

**Why this shape (not the obvious alternatives):**

- **`position: fixed; 100vw × 100vh`** instead of flex-sizing — gives the SDK a deterministic, viewport-anchored container the moment `joinSession` measures it. Customer integrations using `flex: 1` + `minHeight: 400` reported "container visible but iframe renders at 0×0 → no video" in some browser × React-version combinations. Match the sample exactly.
- **Empty `{}` settings** instead of explicit `{ sessionType, layout, ... }` — both are type-valid, but the sample's `{}` is the empirically-validated combination. Override only when you have a specific reason.
- **`onConnectionClosed`** instead of `onSessionLeft` — fires on ANY session termination (peer left, network dropped, in-iframe Leave clicked), which is what most customers actually want for cleanup. `onSessionLeft` is narrower.
- **State-flag gating** (`inMeeting`) instead of `joinedRef` — the state flip puts `joinSession` in a state-triggered effect (which StrictMode doesn't double-run), avoiding the join↔leave race entirely.

---

## Sharing the meeting link

Sample URL pattern: `https://yourapp.com/meet/${sessionId}`

```tsx
function StartMeetingButton() {
  async function start() {
    // Server generates a unique sessionId, returns the meeting URL
    const { sessionId, url } = await api.createMeeting();
    // Copy to clipboard or open share sheet (see share-invite.md)
    await navigator.clipboard.writeText(url);
    // Navigate the host to the call room
    window.location.href = `/meet/${sessionId}`;
  }
  return <button onClick={start}>Start meeting</button>;
}
```

For end-to-end share UX (deep linking, login redirect, etc.), see `share-invite.md`.

---

## Authorization (server-side)

Don't trust client-side `joinSession`. Your server should gate `generateToken` requests:

```ts
// Server-side route called by the client BEFORE generateToken
app.post("/api/meetings/:sessionId/authorize", async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.session.userId;

  const meeting = await db.getMeeting(sessionId);
  if (!meeting) return res.status(404).json({ error: "Meeting not found" });
  if (meeting.expiresAt < Date.now()) return res.status(410).json({ error: "Meeting expired" });
  if (meeting.allowList && !meeting.allowList.includes(userId)) {
    return res.status(403).json({ error: "Not authorized" });
  }

  res.json({ ok: true });
});
```

Client-side flow: call `/authorize` → if 200, call `generateToken` → joinSession. Skipping authorization lets anyone with a sessionId join.

---

## Anti-patterns

1. **Sharing one user's token with another user.** Tokens are user-bound; each participant calls `generateToken` with their own auth.
2. **Caching tokens across sessions.** Tokens are session-bound and short-lived. Generate fresh each join.
3. **Calling `joinSession` before the container element renders.** `joinSession` mounts UI into the element — if it's null, you get a runtime error.
4. **`joinedRef` boolean guard for StrictMode.** The cleanup function races against an in-flight `joinSession` and fires `leaveSession` before join completes — observed as "session connects then immediately leaves." Use the state-flag pattern shown above instead.
5. **Flex-derived container sizing.** `flex: 1`, `height: 100%`, or `position: absolute; inset: 0` inside a nested flex parent can produce a measurable-looking container that renders the SDK iframe at 0×0 in some combinations. **Use `position: fixed; width: 100vw; height: 100vh`** — matches the sample app.
6. **Explicit `{ sessionType, layout, ... }` settings.** Type-valid but has caused unexplained black-tile-on-local-preview behaviour in customer integrations. The sample app uses `{}` and lets the SDK pick defaults.
7. **No `error` check on the `joinSession` result.** It returns `{data, error}` not a thrown error — Promise resolves on validation failure too.
8. **Mixing Ringing + Call Session in one route.** If you accept a ringing call AND mount a Call Session room with the same sessionId, both try to join — undefined behavior.
9. **No expiry / authorization on sessionIds.** Anyone with the URL can join forever. Always server-side gate.
10. **Initializing Chat SDK for a session-only integration.** Wastes time and adds two extra failure modes (Chat init failure, Chat login race) for zero benefit — session mode never touches the Chat SDK call entity. Drop `CometChat.init` / `CometChat.login` entirely for standalone session apps; keep them only for additive (chat + calls) integrations.
11. **`CometChatCalls.getLoggedInUser().getUid()`.** Runtime crash: `existing.getUid is not a function`. The Calls SDK's `getLoggedInUser()` returns a plain `User_2` interface (`{ uid, name, avatar, ... }`), NOT the Chat SDK's `User` class. Access the uid as a property: `existing.uid`. Same applies to `.name`, `.avatar` — all plain properties. The `.getUid()` / `.getName()` / `.getAvatar()` getters belong to Chat SDK's `User` class, which session-only code does not import.

---

## Verification checklist

- [ ] Server generates sessionIds; client doesn't mint them
- [ ] `/authorize` endpoint gates `generateToken`
- [ ] Tokens generated fresh per join (no caching)
- [ ] Container element rendered before `joinSession` runs
- [ ] Container uses `position: fixed; width: 100vw; height: 100vh` (sample-app pattern), NOT flex-derived sizing
- [ ] StrictMode handled via state-flag gating (not `joinedRef`) — see anti-pattern #4
- [ ] Settings passed as empty `{}`, not explicit `{ sessionType, layout, ... }`
- [ ] `result.error` checked
- [ ] `onConnectionClosed` listener handles session end (not just `onSessionLeft`)
- [ ] `leaveSession` runs on unmount even if user closed tab
- [ ] **Standalone session-only:** no `CometChat.init` / `CometChat.login` — Calls SDK alone
- [ ] **Additive (chat + calls):** dual-SDK contract preserved (Chat first, then Calls)
- [ ] Smoke: 2 tabs, both navigate to `/meet/${sessionId}` → both join → media flows → either leaves → other sees them gone

---

## Pointers

- `cometchat-react-calls/SKILL.md` — architecture
- `cometchat-react-calls/references/ringing-integration.md` — Mode 2 (ringing)
- `cometchat-react-calls/references/share-invite.md` — meeting-link sharing
- `cometchat-calls/references/use-case-broadcast.md` — broadcast pattern uses Call Session
- `cometchat-calls/references/use-case-team.md` — team huddles use Call Session
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/join-session
