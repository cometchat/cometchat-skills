# Lazy loading + calls in Angular — pitfalls

Calls have a tighter relationship with bootstrap than chat does. Lazy-loading the calls module breaks several invariants.

---

## The core problem

`APP_INITIALIZER` runs at app bootstrap, before any router activates. The Calls SDK init must complete BEFORE incoming calls can fire — otherwise the listener doesn't exist when the first call rings.

If you lazy-load the calls module:

```ts
// app-routing.module.ts
{ path: "calls", loadChildren: () => import("./calls/calls.module").then(m => m.CallsModule) }
```

Then `CallInitService` (which lives in `CallsModule`) doesn't exist at bootstrap. APP_INITIALIZER can't reference it. Two failure modes:

1. **Init never runs** — until the user navigates to `/calls`, the SDK is uninitialized. Incoming calls miss.
2. **Race condition** — user navigates to `/calls`, the lazy module loads, init runs, but a call had been incoming during the navigation gap. That call is lost.

---

## Fix: split the service from the component

Keep `CallInitService` in `AppModule` (eager). Keep the call UI components in `CallsModule` (lazy).

```ts
// app.module.ts (eager)
@NgModule({
  providers: [
    CallInitService,                              // EAGER — service is at bootstrap
    {
      provide: APP_INITIALIZER,
      useFactory: (svc: CallInitService) => () => svc.init(),
      deps: [CallInitService],
      multi: true,
    },
  ],
})
export class AppModule {}
```

```ts
// calls/calls.module.ts (lazy)
@NgModule({
  declarations: [
    OngoingCallComponent,
    CallLogsComponent,
    CallButtonComponent,
  ],
  imports: [
    RouterModule.forChild([
      { path: "ongoing/:id", component: OngoingCallComponent, canDeactivate: [CallDeactivateGuard] },
      { path: "logs", component: CallLogsComponent },
    ]),
  ],
})
export class CallsModule {}
```

The components reference `CallInitService` via DI; Angular finds it from the parent injector (AppModule).

---

## Pitfall 2: `<cometchat-incoming-call>` in a lazy module

Incoming calls must ring on every screen — not just `/calls`. Mounting `<cometchat-incoming-call>` inside `CallsModule`'s components means:

- User on `/dashboard` → no incoming-call listener → calls miss
- User navigates to `/calls/logs` → listener mounts → calls now ring
- User navigates back to `/dashboard` → listener unmounts → calls miss again

**Fix:** mount `<cometchat-incoming-call>` in `AppComponent`'s template (the root of the application, NOT in any feature module):

```html
<!-- app.component.html -->
<cometchat-incoming-call></cometchat-incoming-call>
<router-outlet></router-outlet>
```

`AppModule` must import enough of `@cometchat/chat-uikit-angular` to render this selector — usually `CometChatUIKitModule.forRoot({...})`. Schemas option `CUSTOM_ELEMENTS_SCHEMA` works too.

---

## Pitfall 3: standalone components + lazy-loaded calls

Angular 14+ standalone components don't have a parent `NgModule`. The DI tree is different — APP_INITIALIZER lives at the bootstrap providers level:

```ts
// main.ts
bootstrapApplication(AppComponent, {
  providers: [
    CallInitService,                           // root-provided — visible everywhere
    {
      provide: APP_INITIALIZER,
      useFactory: (svc: CallInitService) => () => svc.init(),
      deps: [CallInitService],
      multi: true,
    },
    provideRouter([
      // Lazy-loaded standalone routes
      { path: "calls/ongoing/:id", loadComponent: () => import("./calls/ongoing-call.component").then(m => m.OngoingCallComponent) },
    ]),
  ],
});
```

The lazy `loadComponent` works fine because `CallInitService` is at the root.

`<cometchat-incoming-call>` is a standalone component too:

```ts
// app.component.ts
import { CometChatIncomingCallComponent } from "@cometchat/chat-uikit-angular";

@Component({
  standalone: true,
  selector: "app-root",
  imports: [RouterOutlet, CometChatIncomingCallComponent],
  template: `
    <cometchat-incoming-call></cometchat-incoming-call>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {}
```

(Verify the export name in your installed `@cometchat/chat-uikit-angular` version — may differ between minor releases.)

---

## Pitfall 4: SSR (Angular Universal)

The Calls SDK uses browser-only APIs (`getUserMedia`, `RTCPeerConnection`). If your app uses Angular Universal, the calls service must NOT initialize on the server:

```ts
import { isPlatformBrowser } from "@angular/common";
import { Inject, PLATFORM_ID } from "@angular/core";

@Injectable({ providedIn: "root" })
export class CallInitService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  async init(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;        // skip on server
    // ... actual init
  }
}
```

Without this guard, the SSR build crashes with `ReferenceError: window is not defined` at boot.

---

## Pitfall 5: Multiple `APP_INITIALIZER`s

If your project already uses `APP_INITIALIZER` for chat init, calls init goes alongside — not as a replacement:

```ts
providers: [
  ChatInitService,
  CallInitService,
  {
    provide: APP_INITIALIZER,
    useFactory: (chat: ChatInitService) => () => chat.init(),
    deps: [ChatInitService],
    multi: true,                               // ← multi: true is critical
  },
  {
    provide: APP_INITIALIZER,
    useFactory: (calls: CallInitService) => () => calls.init(),
    deps: [CallInitService],
    multi: true,
  },
]
```

Both register; both run before bootstrap. They run in registration order — chat first, then calls (matches rule 1.1's chat-init-before-calls-init).

---

## Pitfall 6: Forgetting the route deactivate guard for ongoing calls

Without `CanDeactivate`, the user can route away mid-call and the call screen unmounts but the SDK session keeps running. Camera light stays on (rule 1.5 violation).

```ts
// calls-routing.module.ts
{ path: "ongoing/:id", component: OngoingCallComponent, canDeactivate: [CallDeactivateGuard] }
```

The guard is in `references/custom-ui.md`.

---

## Summary

| Place | What goes here |
|---|---|
| `AppModule` (eager) | `CallInitService`, `APP_INITIALIZER`, `<cometchat-incoming-call>` |
| `CallsModule` (lazy) | UI components (OngoingCall, CallLogs, CallButton), feature routes |
| App root template | `<cometchat-incoming-call>` mounted above `<router-outlet>` |
| Routes | `canDeactivate` guard on the ongoing-call route |
| SSR | `isPlatformBrowser` check inside init service |
