# Server-side Web Push VAPID for Angular

The Web Push server template, VAPID setup, and Service Worker code from the React canonical reference apply identically to Angular — the server doesn't care which client framework rendered the page.

**Canonical docs:** https://datatracker.ietf.org/doc/html/rfc8030
**Read first:** `cometchat-react-calls/references/server-web-push-vapid.md` — full Node + Python templates, hard rules, sw.js receiver.

---

## Angular-specific delta: Service Worker registration

Angular has its own SW story (`@angular/service-worker` for the Angular SW + `ngsw-config.json`). For Web Push receiving a CometChat call, you typically want a **separate** SW (`/public/sw.js`) for push events — using the Angular SW for both routing your app's offline cache AND CometChat call pushes mixes concerns.

```ts
// app.config.ts or app.module.ts
import { provideServiceWorker } from "@angular/service-worker";

bootstrapApplication(AppComponent, {
  providers: [
    provideServiceWorker("ngsw-worker.js", { enabled: environment.production }),
    // ...
  ],
});

// In a CallPushService:
@Injectable({ providedIn: "root" })
export class CallPushService {
  async register(currentUserUid: string): Promise<void> {
    if (!("serviceWorker" in navigator)) return;
    // Register the call-specific worker
    const reg = await navigator.serviceWorker.register("/sw-call.js", { scope: "/" });
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(environment.vapidPublicKey),
    });
    await this.api.registerWebPushSubscription(currentUserUid, sub.toJSON());
  }

  private urlBase64ToUint8Array(b64: string): Uint8Array {
    const padding = "=".repeat((4 - (b64.length % 4)) % 4);
    const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
  }
}
```

`/public/sw-call.js` is identical to the React canonical reference — the call-specific worker doesn't depend on Angular.

---

## NgZone re-entry for in-app ringer

When the Service Worker `postMessage`s the open client (so an in-app ringer can fire alongside the OS notification), Angular's change detection won't pick up state updates from outside the zone. Wrap:

```ts
@Injectable({ providedIn: "root" })
export class IncomingCallService {
  readonly incoming$ = new BehaviorSubject<IncomingCallPayload | null>(null);

  constructor(private zone: NgZone) {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "incoming_call") {
        this.zone.run(() => this.incoming$.next(event.data));
      }
    });
  }
}
```

---

## Anti-patterns

React sister rules apply, plus Angular-specific:

1. **Mixing Angular SW (`ngsw-worker.js`) + push handlers.** Angular SW's update mechanism can disable push subscriptions on update. Use a separate SW for call pushes.
2. **No `NgZone.run` on `serviceWorker.message` listeners.** OnPush components don't update.
3. **Importing VAPID public key from a non-public env var.** Use `environment.ts` (compile-time inlined for browser).

---

## Verification checklist

- [ ] Server template: see canonical react reference
- [ ] Separate `sw-call.js` registered alongside Angular SW
- [ ] `NgZone.run` wraps the `message` handler
- [ ] VAPID public key in `environment.ts`
- [ ] Browser smoke: 2 tabs (one minimized), caller dials, recipient minimized tab gets notification

---

## Pointers

- `cometchat-react-calls/references/server-web-push-vapid.md` — canonical (full server + sw.js)
- `cometchat-angular-calls` SKILL.md
- `references/ngzone-and-async-callbacks.md`
