# Call layouts on Angular

Same SDK API as web. Angular wraps layout state in a service so multiple components (toolbar, sidebar, header) can stay in sync.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/call-layouts
**Read first:** `cometchat-react-calls/references/call-layouts.md` — layout matrix + when to lock.

---

## Layout service

```ts
import { Injectable, NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

export type CallLayout = "TILE" | "SIDEBAR" | "SPOTLIGHT";

@Injectable({ providedIn: "root" })
export class CallLayoutService {
  readonly layout$ = new BehaviorSubject<CallLayout>("TILE");

  constructor(private zone: NgZone) {
    CometChatCalls.addEventListener("onCallLayoutChanged", (next: string) => {
      this.zone.run(() => this.layout$.next(next as CallLayout));
    });
  }

  set(layout: CallLayout): void {
    CometChatCalls.setLayout(layout);
    this.layout$.next(layout);
  }
}
```

---

## Switcher component (mat-button-toggle-group)

```ts
@Component({
  selector: "app-layout-switcher",
  template: `
    <mat-button-toggle-group
      [value]="layout$ | async"
      (change)="onChange($event.value)"
      aria-label="Call layout"
    >
      <mat-button-toggle value="TILE" aria-label="Tile layout">Tile</mat-button-toggle>
      <mat-button-toggle value="SIDEBAR" aria-label="Sidebar layout">Sidebar</mat-button-toggle>
      <mat-button-toggle value="SPOTLIGHT" aria-label="Spotlight layout">Spotlight</mat-button-toggle>
    </mat-button-toggle-group>
  `,
})
export class LayoutSwitcherComponent {
  layout$ = this.svc.layout$;
  constructor(private svc: CallLayoutService) {}
  onChange(layout: CallLayout) {
    this.svc.set(layout);
  }
}
```

`mat-button-toggle-group` already wires up `role="radiogroup"` semantics — no extra ARIA needed.

---

## Pass initial via call settings

```ts
const callSettings = new CallSettingsBuilder()
  .setLayout("SPOTLIGHT")
  .setHideChangeLayoutButton(true)  // if you ship LayoutSwitcherComponent
  .build();

await CometChatCalls.joinSession(callToken, callSettings, container.nativeElement);
```

---

## Anti-patterns

Web sister rules apply, plus Angular-specific:

1. **No `NgZone.run` wrap on the SDK callback.** Layout changes via the kit's switcher don't update the toggle group in OnPush components.
2. **Service provided in a feature module instead of root.** Layout state resets when navigating away and back.
3. **`(click)` on each toggle setting layout individually.** `mat-button-toggle-group`'s `(change)` is the right hook — single source of truth.

---

## Verification checklist

- [ ] `CallLayoutService` provided in root
- [ ] `NgZone.run` wraps the SDK callback
- [ ] `mat-button-toggle-group` `(change)` calls `svc.set`
- [ ] Initial layout via `CallSettingsBuilder.setLayout`
- [ ] Browser smoke: 3 tabs, each picks a different layout, no cross-talk

---

## Pointers

- `cometchat-react-calls/references/call-layouts.md` — sister
- `cometchat-angular-calls` SKILL.md
- `references/ngzone-and-async-callbacks.md`
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/call-layouts
