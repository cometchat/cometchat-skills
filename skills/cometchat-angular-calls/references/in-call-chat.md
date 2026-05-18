# In-call chat on Angular

Same SDK API as web. Angular wraps panel state in a service + uses Angular Material's `MatSidenav` for the side-drawer chat panel pattern.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/in-call-chat
**Read first:** `cometchat-react-calls/references/in-call-chat.md` — group-as-session architecture, anti-patterns.

---

## SDK + service

```ts
import { Injectable, NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Injectable({ providedIn: "root" })
export class InCallChatService {
  readonly open$ = new BehaviorSubject<boolean>(false);
  readonly unread$ = new BehaviorSubject<number>(0);

  constructor(private zone: NgZone) {
    CometChatCalls.addEventListener("onChatButtonClicked", () => {
      this.zone.run(() => this.open$.next(true));
    });
  }

  async ensureGroup(sessionId: string): Promise<CometChat.Group> {
    try {
      return await CometChat.getGroup(sessionId);
    } catch {
      const group = new CometChat.Group(sessionId, `Call ${sessionId}`, CometChat.GROUP_TYPE.PUBLIC);
      return await CometChat.createGroup(group);
    }
  }

  async joinGroup(sessionId: string): Promise<void> {
    await CometChat.joinGroup(sessionId, CometChat.GROUP_TYPE.PUBLIC, "");
  }

  trackUnread(sessionId: string): void {
    const listenerId = `in-call-chat-${sessionId}`;
    const listener = new CometChat.MessageListener({
      onTextMessageReceived: (msg: CometChat.TextMessage) => {
        if (
          msg.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP &&
          msg.getReceiverId() === sessionId &&
          !this.open$.value
        ) {
          this.zone.run(() => {
            const next = this.unread$.value + 1;
            this.unread$.next(next);
            CometChatCalls.setChatButtonUnreadCount(next);
          });
        }
      },
    });
    CometChat.addMessageListener(listenerId, listener);
  }

  open(): void {
    this.open$.next(true);
    this.unread$.next(0);
    CometChatCalls.setChatButtonUnreadCount(0);
  }

  close(): void {
    this.open$.next(false);
  }
}
```

---

## Panel component (MatSidenav)

```ts
@Component({
  selector: "app-in-call-chat",
  template: `
    <mat-sidenav-container [hasBackdrop]="false">
      <mat-sidenav
        #drawer
        position="end"
        mode="side"
        [opened]="open$ | async"
        (closed)="svc.close()"
        role="dialog"
        aria-label="In-call chat"
      >
        <ng-container *ngIf="group">
          <cometchat-message-list [group]="group" [hideReplyInThreadOption]="true"></cometchat-message-list>
          <cometchat-message-composer [group]="group"></cometchat-message-composer>
        </ng-container>
      </mat-sidenav>
      <mat-sidenav-content>
        <!-- call surface goes here -->
        <ng-content></ng-content>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class InCallChatComponent implements OnInit {
  @Input() sessionId!: string;
  open$ = this.svc.open$;
  group?: CometChat.Group;

  constructor(public svc: InCallChatService) {}

  async ngOnInit() {
    this.group = await this.svc.ensureGroup(this.sessionId);
    this.svc.trackUnread(this.sessionId);
  }
}
```

`mode="side"` makes the drawer slide out without an overlay backdrop — call view stays visible. `[hasBackdrop]="false"` doubles down.

---

## Anti-patterns

Web sister rules apply, plus Angular-specific:

1. **No `NgZone.run` wrap on `onChatButtonClicked`.** Drawer doesn't open in OnPush components.
2. **`MatSidenav` `mode="over"`.** Backdrop blocks the call. Use `mode="side"`.
3. **Service NOT in `root`.** Lazy module → button events miss.

---

## Verification checklist

- [ ] `InCallChatService` provided in root
- [ ] `NgZone.run` wraps the chat-button event
- [ ] `MatSidenav` uses `mode="side"` + `hasBackdrop="false"`
- [ ] Group resolved on `ngOnInit`
- [ ] Unread badge updates via service, clears on open
- [ ] Browser smoke: 2 tabs, chat works, unread badge increments

---

## Pointers

- `cometchat-react-calls/references/in-call-chat.md` — sister web reference
- `cometchat-angular-calls` SKILL.md
- `references/ngzone-and-async-callbacks.md`
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/in-call-chat
