# Calls SDK v4 → v5 migration (Angular)

Angular ships the same `@cometchat/calls-sdk-javascript` as React/Vue, so the migration steps are identical. Angular-specific deltas: NgZone wrapping for the new event listeners.

**Read first:** `cometchat-react-calls/references/migration-v4-to-v5.md` — full step-by-step (init, login, settings, events, methods).

---

## Step 1 — Bump the package

```bash
npm install @cometchat/calls-sdk-javascript@5
```

---

## Angular-specific delta: NgZone for new event listeners

When migrating from `OngoingCallListener` to `addEventListener`, Angular needs `NgZone.run` to update OnPush components — listeners fire outside Angular's zone:

```ts
@Injectable({ providedIn: "root" })
export class CallEventService {
  constructor(private zone: NgZone) {
    // v4 — listener was inside CometChatCalls.OngoingCallListener; if your
    // current code already wraps callbacks with NgZone.run, keep that.
    // v5 — addEventListener fires outside zone:
    CometChatCalls.addEventListener("onSessionLeft", () => {
      this.zone.run(() => this.onSessionLeft$.next());
    });
    CometChatCalls.addEventListener("onParticipantJoined", (p) => {
      this.zone.run(() => this.participantJoined$.next(p));
    });
  }
}
```

If you skip the `NgZone.run` wrap, OnPush components don't re-render when call state changes.

---

## Verification checklist

- [ ] All v5 event listeners wrapped in `NgZone.run`
- [ ] All sister checks from the canonical migration guide

---

## Pointers

- Canonical migration: `cometchat-react-calls/references/migration-v4-to-v5.md`
- Canonical Web Push event handling: `references/ngzone-and-async-callbacks.md`
- https://www.cometchat.com/docs/calls/javascript/migration-guide-v5
