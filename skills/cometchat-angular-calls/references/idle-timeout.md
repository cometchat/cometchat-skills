# Idle timeout on Angular

Same SDK API as web. Angular-specific delta: NgZone wrap on the timeout event + Angular Material dialog or custom modal for the prompt.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/idle-timeout
**Read first:** `cometchat-react-calls/references/idle-timeout.md` — settings + archetype timeouts + custom prompt pattern.

---

## SDK API

```ts
const settings = new CometChatCalls.CallSettingsBuilder()
  .setSessionID(sessionId)
  .setIdleTimeoutPeriodBeforePrompt(60_000)
  .setIdleTimeoutPeriodAfterPrompt(120_000)
  .build();

CometChatCalls.addEventListener("onSessionTimedOut", () => {
  this.zone.run(() => {
    this.router.navigate(["/"]);
    this.snackBar.open("Call ended due to inactivity", "Dismiss", { duration: 5000 });
  });
});
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
  private listener?: () => void;

  constructor(
    private zone: NgZone,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  attachToCallSession() {
    this.listener = () => {
      this.zone.run(() => {
        this.router.navigate(["/"]);
        this.snackBar.open("Call ended due to inactivity", "Dismiss", { duration: 5000 });
      });
    };
    CometChatCalls.addEventListener("onSessionTimedOut", this.listener);
  }

  detach() {
    if (this.listener) {
      CometChatCalls.removeEventListener("onSessionTimedOut", this.listener);
      this.listener = undefined;
    }
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
