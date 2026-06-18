# Idle timeout on Angular

Same SDK API as web. Angular-specific delta: NgZone wrap on the timeout event + Angular Material dialog or custom modal for the prompt.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/idle-timeout
**Read first:** `cometchat-react-calls/references/idle-timeout.md` — settings + archetype timeouts + custom prompt pattern.

---

## SDK API

The idle timeout is configured on the **`SessionSettings` object** passed to
`joinSession(callToken, sessionSettings, container)`, NOT on the builder.

- The builder (`CallSettingsBuilder`) has a single `setIdleTimeoutPeriod(ms)` method — there is
  no `setIdleTimeoutPeriodBeforePrompt` / `setIdleTimeoutPeriodAfterPrompt` on it.
- The before/after split exists ONLY as `SessionSettings` object fields:
  `idleTimeoutPeriodBeforePrompt` and `idleTimeoutPeriodAfterPrompt`.
- There is no `setSessionID()` on the builder — the session is identified by the call token
  produced via `CometChatCalls.generateToken(sessionId, authToken)`.

```ts
// 1. token carries the session id
const { token } = await CometChatCalls.generateToken(sessionId, authToken);

// 2. idle timeout lives on the SessionSettings object
const sessionSettings = {
  sessionType: "VIDEO",
  idleTimeoutPeriodBeforePrompt: 60_000,
  idleTimeoutPeriodAfterPrompt: 120_000,
} as const;

// addEventListener returns an unsubscribe fn — capture it (there is no removeEventListener).
const off = CometChatCalls.addEventListener("onSessionTimedOut", () => {
  this.zone.run(() => {
    this.router.navigate(["/"]);
    this.snackBar.open("Call ended due to inactivity", "Dismiss", { duration: 5000 });
  });
});

await CometChatCalls.joinSession(token, sessionSettings, container);
// later: off();
```

`NgZone.run` wrap is mandatory — without it, the navigation + snackbar don't fire because the SDK callback is outside Angular's zone.

---

## Service-level wiring

```ts
// services/idle-timeout.service.ts
import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

@Injectable({ providedIn: "root" })
export class IdleTimeoutService {
  // addEventListener returns the unsubscribe fn — there is no CometChatCalls.removeEventListener.
  private off?: () => void;

  constructor(
    private zone: NgZone,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  attachToCallSession() {
    this.off = CometChatCalls.addEventListener("onSessionTimedOut", () => {
      this.zone.run(() => {
        this.router.navigate(["/"]);
        this.snackBar.open("Call ended due to inactivity", "Dismiss", { duration: 5000 });
      });
    });
  }

  detach() {
    this.off?.();
    this.off = undefined;
  }
}
```

Call `attachToCallSession()` from the OngoingCallComponent's `ngOnInit`, `detach()` from `ngOnDestroy`.

---

## Custom prompt — Angular Material Dialog

```ts
import { MatDialog } from "@angular/material/dialog";
import { Component } from "@angular/core";

@Component({
  template: `
    <h2 mat-dialog-title>Still there?</h2>
    <mat-dialog-content>
      You're alone in this call. It'll end in 60 seconds.
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button [mat-dialog-close]="'stay'">Stay</button>
      <button mat-button color="warn" [mat-dialog-close]="'end'">End now</button>
    </mat-dialog-actions>
  `,
})
export class IdleTimeoutDialogComponent {}

// Use:
@Component({ /* ... */ })
export class OngoingCallComponent {
  constructor(private dialog: MatDialog) {}

  showIdlePrompt() {
    const ref = this.dialog.open(IdleTimeoutDialogComponent, {
      disableClose: true,
      ariaLabel: "Idle timeout warning",
    });
    ref.afterClosed().subscribe(result => {
      if (result === "end") {
        CometChatCalls.leaveSession();   // v5 canonical (endSession is deprecated)
      }
      // 'stay' → reset your custom timer (see Pattern A in web ref)
    });
  }
}
```

`disableClose: true` prevents the user from dismissing via Esc/backdrop — they must explicitly choose. `ariaLabel` for screen readers.

---

## Anti-patterns

Web sister reference rules apply, plus Angular-specific:

1. **No `NgZone.run` wrap on the listener.** Navigation + snackbar fire silently because change detection doesn't trigger.
2. **`MatDialog` opened from `setTimeout` callback** without zone wrap. Dialog opens but template doesn't render.
3. **Subscription leaks** — `dialog.afterClosed()` returns an Observable; if you don't unsubscribe (or use `take(1)` / `first()`), it leaks across calls.
4. **Service NOT provided in `root`.** Lazy-loaded → listener attaches late.

---

## Verification checklist

- [ ] `IdleTimeoutService` provided in root
- [ ] Listener wraps in `NgZone.run`
- [ ] Service `attachToCallSession()` called from OngoingCall `ngOnInit`
- [ ] Service `detach()` called from `ngOnDestroy`
- [ ] Dialog uses `disableClose: true` + `ariaLabel`
- [ ] `dialog.afterClosed()` subscription doesn't leak (use `first()` or unsubscribe)
- [ ] Browser smoke: 2 tabs in call, hangup one → other shows snackbar after configured delay

---

## Pointers

- `cometchat-react-calls/references/idle-timeout.md` — sister reference
- `cometchat-angular-calls` SKILL.md
- `references/ngzone-and-async-callbacks.md` — NgZone primer
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/idle-timeout
