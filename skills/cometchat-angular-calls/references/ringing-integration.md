# Ringing — call signaling with custom UI (Angular)

Same SDK API as web. Angular-specific deltas: NgZone-wrapped listener callbacks, BehaviorSubject-driven incoming/outgoing call state, root-level CallSignalingService.

**Read first:** `cometchat-react-calls/references/ringing-integration.md` — full architecture, hard rules, anti-patterns.

---

## CallSignalingService

```ts
import { Injectable, NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

@Injectable({ providedIn: "root" })
export class CallSignalingService {
  readonly incoming$ = new BehaviorSubject<CometChat.Call | null>(null);
  readonly outgoing$ = new BehaviorSubject<CometChat.Call | null>(null);
  readonly active$ = new BehaviorSubject<string | null>(null);  // sessionId

  private readonly listenerId = "app-call-signaling";

  constructor(private zone: NgZone) {
    CometChat.addCallListener(
      this.listenerId,
      new CometChat.CallListener({
        onIncomingCallReceived: (call) => this.zone.run(() => this.incoming$.next(call)),
        onOutgoingCallAccepted: (call) => this.zone.run(() => {
          this.outgoing$.next(null);
          this.active$.next(call.getSessionId());
        }),
        onOutgoingCallRejected: () => this.zone.run(() => this.outgoing$.next(null)),
        onIncomingCallCancelled: () => this.zone.run(() => this.incoming$.next(null)),
        onCallEndedMessageReceived: () => this.zone.run(() => {
          this.incoming$.next(null);
          this.outgoing$.next(null);
          this.active$.next(null);
        }),
      }),
    );
  }

  ngOnDestroy(): void {
    CometChat.removeCallListener(this.listenerId);
  }

  async initiate(receiverUid: string, type: "audio" | "video" = "video"): Promise<void> {
    const call = new CometChat.Call(
      receiverUid,
      type === "video" ? CometChat.CALL_TYPE.VIDEO : CometChat.CALL_TYPE.AUDIO,
      CometChat.RECEIVER_TYPE.USER,
    );
    const outgoing = await CometChat.initiateCall(call, 60);
    this.outgoing$.next(outgoing);
  }

  async accept(call: CometChat.Call): Promise<void> {
    const accepted = await CometChat.acceptCall(call.getSessionId());
    this.incoming$.next(null);
    this.active$.next(accepted.getSessionId());
  }

  async reject(call: CometChat.Call): Promise<void> {
    await CometChat.rejectCall(call.getSessionId(), CometChat.CALL_STATUS.REJECTED);
    this.incoming$.next(null);
  }

  async cancel(call: CometChat.Call): Promise<void> {
    await CometChat.rejectCall(call.getSessionId(), CometChat.CALL_STATUS.CANCELLED);
    this.outgoing$.next(null);
  }
}
```

---

## Incoming-call component

```ts
@Component({
  selector: "app-incoming-call",
  template: `
    <ng-container *ngIf="incoming$ | async as call">
      <div role="alertdialog" aria-labelledby="incoming-title" class="incoming-call-overlay">
        <h3 id="incoming-title">{{ call.getCallInitiator().getName() }}</h3>
        <p>Incoming {{ call.getType() }} call</p>
        <button (click)="svc.reject(call)" class="reject" aria-label="Decline call">Decline</button>
        <button (click)="svc.accept(call)" class="accept" aria-label="Accept call">Accept</button>
        <audio src="/assets/ringtone.mp3" autoplay loop></audio>
      </div>
    </ng-container>
  `,
})
export class IncomingCallComponent {
  incoming$ = this.svc.incoming$;
  constructor(public svc: CallSignalingService) {}
}
```

Mount in `app.component.html` (root) so it survives router changes.

---

## Anti-patterns

Web sister rules apply, plus Angular-specific:

1. **Not `providedIn: "root"`.** Service registered per-module → multiple instances → duplicate listeners.
2. **Skipping `NgZone.run`.** OnPush components don't update; UI feels stuck.
3. **`(click)` handlers calling SDK methods directly.** Bypass the service → state desyncs.

---

## Verification checklist

- [ ] `CallSignalingService` is `providedIn: "root"`
- [ ] All callbacks wrapped in `NgZone.run`
- [ ] `IncomingCallComponent` mounted in `app.component.html`, not a route
- [ ] `removeCallListener` in `ngOnDestroy`
- [ ] Smoke: 2 tabs, caller initiates, recipient sees alertdialog, accept opens session

---

## Pointers

- `cometchat-react-calls/references/ringing-integration.md` — canonical
- `cometchat-angular-calls/SKILL.md`
- `references/ngzone-and-async-callbacks.md`
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/ringing
