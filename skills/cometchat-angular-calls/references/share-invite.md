# Share invite on Angular

Same SDK API as web. Angular-specific: wrap the share logic in a service so multiple call surfaces (full-screen, mini, post-call) can reuse it.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/share-invite
**Read first:** `cometchat-react-calls/references/share-invite.md` — deep-link rule, share dialog UX.

---

## ShareInviteService

```ts
import { Injectable, NgZone, Inject } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";
import { APP_CONFIG, AppConfig } from "../config";

@Injectable({ providedIn: "root" })
export class ShareInviteService {
  constructor(
    private snack: MatSnackBar,
    private zone: NgZone,
    @Inject(APP_CONFIG) private config: AppConfig,
  ) {}

  bind(sessionId: string): () => void {
    const handler = () => this.zone.run(() => this.share(sessionId));
    CometChatCalls.addEventListener("onShareInviteButtonClicked", handler);
    return () => CometChatCalls.removeEventListener("onShareInviteButtonClicked", handler);
  }

  async share(sessionId: string): Promise<void> {
    const url = `${this.config.appUrl}/call/${sessionId}`;
    const data = { title: "Join my call", text: "I'm on a call — tap to join.", url };

    if (navigator.share && navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      this.snack.open("Link copied to clipboard", undefined, { duration: 2000 });
    } catch {
      this.snack.open(`Copy this link: ${url}`, "OK", { duration: 8000 });
    }
  }
}
```

Inject `APP_CONFIG` (your standard token for env vars) so the URL isn't hard-coded.

---

## Use in a call component

```ts
@Component({ /* ... */ })
export class CallComponent implements OnInit, OnDestroy {
  @Input() sessionId!: string;
  private unbind?: () => void;

  constructor(private shareSvc: ShareInviteService) {}

  ngOnInit() {
    this.unbind = this.shareSvc.bind(this.sessionId);
  }

  ngOnDestroy() {
    this.unbind?.();
  }
}
```

---

## Pass the kit setting

```ts
const callSettings = new CallSettingsBuilder()
  .setHideShareInviteButton(false)
  .build();
```

---

## Anti-patterns

Web sister rules apply, plus Angular-specific:

1. **No `NgZone.run` wrap on the SDK callback.** `MatSnackBar.open` doesn't show in OnPush components.
2. **Service in feature module, not root.** Provider lifecycle desyncs with router.
3. **Hard-coded `https://yourapp.com`.** Use `APP_CONFIG` injection token.

---

## Verification checklist

- [ ] `ShareInviteService` provided in root
- [ ] App URL via `APP_CONFIG` (not hard-coded)
- [ ] `NgZone.run` wraps the callback
- [ ] Listener cleaned up in `ngOnDestroy`
- [ ] Browser smoke: copy link → paste in incognito → join call

---

## Pointers

- `cometchat-react-calls/references/share-invite.md` — sister
- `cometchat-angular-calls` SKILL.md
- `references/ngzone-and-async-callbacks.md`
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/share-invite
