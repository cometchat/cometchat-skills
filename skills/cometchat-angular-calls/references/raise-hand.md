# Raise hand on Angular

Same SDK API as web (`@cometchat/calls-sdk-javascript`). Angular-specific wiring: NgZone wrap on listeners, RxJS Subject for the raised-hands roster, OnPush + markForCheck.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/raise-hand
**Read first:** `cometchat-react-calls/references/raise-hand.md` — integration shape + anti-patterns are identical; this reference is the Angular-specific wiring.

---

## SDK API (same as web)

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

CometChatCalls.raiseHand();
CometChatCalls.lowerHand();
```

---

## Angular wiring — service-driven roster

Centralize raise-hand state in a service so any component can subscribe:

```ts
// services/raise-hand.service.ts
import { Injectable, NgZone, OnDestroy } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

interface RaisedParticipant { uid: string; name: string; raisedAt: number; }

@Injectable({ providedIn: "root" })
export class RaiseHandService implements OnDestroy {
  private readonly raised = new Map<string, RaisedParticipant>();
  readonly raised$ = new BehaviorSubject<RaisedParticipant[]>([]);

  private onRaised = (p: { uid: string; name: string }) => {
    this.zone.run(() => {
      this.raised.set(p.uid, { ...p, raisedAt: Date.now() });
      this.emit();
    });
  };

  private onLowered = (p: { uid: string }) => {
    this.zone.run(() => {
      this.raised.delete(p.uid);
      this.emit();
    });
  };

  // addEventListener returns an unsubscribe fn — there is NO CometChatCalls.removeEventListener.
  private offs: Array<() => void> = [];

  constructor(private zone: NgZone) {
    this.offs.push(
      CometChatCalls.addEventListener("onParticipantHandRaised", this.onRaised),
      CometChatCalls.addEventListener("onParticipantHandLowered", this.onLowered),
    );
  }

  ngOnDestroy() {
    this.offs.forEach(off => off());
    this.offs = [];
  }

  raise() { CometChatCalls.raiseHand(); }
  lower() { CometChatCalls.lowerHand(); }

  private emit() {
    const sorted = Array.from(this.raised.values()).sort((a, b) => a.raisedAt - b.raisedAt);
    this.raised$.next(sorted);
  }
}
```

The `NgZone.run` wrapping is the canonical Angular rule (see `references/ngzone-and-async-callbacks.md`) — without it, `BehaviorSubject.next` doesn't trigger change detection in OnPush components.

---

## Toggle button component

```ts
@Component({
  selector: "app-raise-hand-button",
  template: `
    <button
      (click)="toggle()"
      [class.active]="raised"
      [attr.aria-pressed]="raised"
      [attr.aria-label]="raised ? 'Lower hand' : 'Raise hand'"
    >
      ✋ {{ raised ? "Lower" : "Raise" }}
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RaiseHandButtonComponent {
  raised = false;
  constructor(private svc: RaiseHandService, private cd: ChangeDetectorRef) {}

  toggle() {
    if (this.raised) this.svc.lower();
    else this.svc.raise();
    this.raised = !this.raised;
    this.cd.markForCheck();
  }
}
```

---

## Roster component (host view)

```ts
@Component({
  selector: "app-raised-hands-list",
  template: `
    <div *ngIf="(raised$ | async) as list">
      <ul *ngIf="list.length > 0" aria-label="Raised hands queue">
        <li *ngFor="let p of list; trackBy: trackByUid">
          ✋ {{ p.name }} <span class="ago">{{ secondsAgo(p.raisedAt) }}</span>
        </li>
      </ul>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RaisedHandsListComponent {
  raised$ = this.svc.raised$;
  constructor(private svc: RaiseHandService) {}
  trackByUid(_: number, p: RaisedParticipant) { return p.uid; }
  secondsAgo(t: number) { return `${Math.round((Date.now() - t) / 1000)}s ago`; }
}
```

`trackByUid` is critical — without it, Angular re-renders every list item on every emit, which is bad for FlatList-style smooth scroll.

---

## Anti-patterns

Same shape as web sister reference, plus Angular-specific:

1. **Service NOT provided in `root`.** If raise-hand service is provided in a feature module, it instantiates on lazy-load — listeners attach late. Provide in root so it boots with the app.
2. **Skipping `markForCheck` with OnPush.** Service emits, component doesn't re-render.
3. **Forgetting `ngOnDestroy` cleanup.** Service is `providedIn: "root"` so it lives forever, but the listeners would survive across logout/re-login. Reset on `CometChatUIKit.logout`.
4. **`*ngFor` without `trackBy`.** Re-renders thrash; tile state lost.

---

## Verification checklist

- [ ] `RaiseHandService` provided in root
- [ ] `NgZone.run` wraps both listener callbacks
- [ ] `BehaviorSubject` emits sorted-by-raisedAt list
- [ ] Toggle button has `aria-pressed` + `aria-label`
- [ ] Roster uses `trackBy: trackByUid`
- [ ] OnPush components call `markForCheck()` on state change
- [ ] Listeners cleaned up in `ngOnDestroy`
- [ ] `hideRaiseHandButton: true` in CallSettings if using custom UI
- [ ] Browser smoke: 3 tabs in same call → host's roster updates with markForCheck

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — sister reference
- `references/ngzone-and-async-callbacks.md` — NgZone primer
- `references/group-calls.md` — group call architecture in Angular
- `cometchat-a11y` — `aria-pressed` + screen reader announcements
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/raise-hand
