# Call session — joinSession with no ringing (Angular)

Same SDK API as web. This file mirrors the upstream Angular sample at `calls-sdk-javascript-5/sample-apps/cometchat-calls-sample-app-angular/src/app/pages/join-session/`. Customer-validated against the v5 SDK as the known-good shape.

**Read first:** `cometchat-react-calls/references/call-session.md` — full architecture (sessionId strategies, server-side authorization, token generation), then come back here for Angular specialization.

---

## Hard rules (Angular-specific overrides on top of the React-side rules)

1. **Use a signal for `inMeeting` state, `@if` to render the container, `viewChild` to read it.** This is the upstream sample's exact shape and avoids stale-template traps under OnPush change detection.
2. **Container CSS:** `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh`. Matches the sample. Flex-derived sizing inside nested route outlets has produced "iframe renders at 0×0 → no video" in customer integrations.
3. **Pass an empty `{}` settings object.** Explicit `{ sessionType: "VIDEO", layout: "TILE" }` is type-valid but the sample app uses `{}` — that's the empirically-validated combination.
4. **`onConnectionClosed`** is the cleanup event, not `onSessionLeft`. Fires on ANY termination (peer left, network died, in-iframe Leave button).
5. **NgZone.run around router navigation in the event listener.** SDK events fire outside Angular's zone; raw router calls won't trigger change detection.
6. **For standalone session-only integrations, the Chat SDK is OPTIONAL.** Use `CometChatCalls.init({appId, region, authKey})` + `CometChatCalls.login(uid)` alone. The upstream sample never imports `@cometchat/chat-sdk-javascript`. Keep dual-SDK only for additive (chat + calls) integrations.

---

## Component (signals + @if + viewChild)

```ts
import {
  Component, OnInit, OnDestroy,
  signal, viewChild, ElementRef, inject, NgZone,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CometChatCalls } from '@cometchat/calls-sdk-javascript';

@Component({
  selector: 'app-call-room',
  standalone: true,
  template: `
    @if (inMeeting()) {
      <div class="meeting-container" #meetingContainer></div>
    }
  `,
  styles: [`
    .meeting-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
    }
  `],
})
export class CallRoomComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private zone = inject(NgZone);

  sessionId = '';
  inMeeting = signal(false);

  // Signal-based viewChild — populated after the @if block renders.
  meetingContainer = viewChild<ElementRef<HTMLDivElement>>('meetingContainer');

  private cleanupEventListener?: () => void;

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';

    // Cleanup listener fires on ANY session termination (peer left,
    // network dropped, in-iframe Leave clicked). Reset state via NgZone
    // so OnPush change detection picks it up.
    this.cleanupEventListener = CometChatCalls.addEventListener(
      'onConnectionClosed',
      () => this.zone.run(() => {
        this.inMeeting.set(false);
        this.router.navigate(['/']);
      }),
    );

    if (this.sessionId) {
      this.startMeeting();
    }
  }

  ngOnDestroy(): void {
    this.cleanupEventListener?.();
    try {
      CometChatCalls.leaveSession();
    } catch {
      // ignore — not joined or already left
    }
  }

  private startMeeting(): void {
    this.inMeeting.set(true);

    // setTimeout(0) gives Angular one tick to render the @if block
    // so meetingContainer() is populated before joinSession measures it.
    setTimeout(() => {
      CometChatCalls.generateToken(this.sessionId).then(({ token }) => {
        const container = this.meetingContainer();
        if (container) {
          // Empty {} settings = SDK defaults (matches sample app).
          CometChatCalls.joinSession(token, {}, container.nativeElement);
        }
      });
    }, 0);
  }
}
```

**Why this shape (not the obvious alternatives):**

- **`@if (inMeeting())` + `viewChild`** instead of always-rendered container + `@ViewChild({ static: true })` — matches the upstream sample. The signal-based pattern works under OnPush change detection without `markForCheck()` ceremonies.
- **`position: fixed; 100vw × 100vh`** instead of `width: 100%; height: 100vh` — gives the SDK a deterministic viewport-anchored container. Flex-derived sizing inside route outlets has caused 0×0 iframe rendering.
- **Empty `{}` settings** — the sample's validated combination. Explicit `{ sessionType: "VIDEO", layout: "TILE" }` is type-valid but has produced unexplained rendering issues.
- **`onConnectionClosed`** — fires on ANY termination, not just user-initiated leave. More reliable for cleanup than `onSessionLeft`.
- **`setTimeout(0)` after `inMeeting.set(true)`** — gives Angular one change-detection tick to render the `@if` block, so `meetingContainer()` is populated when `joinSession` measures it. The upstream sample uses the same trick (see `startInstantMeeting`).
- **`NgZone.run` around router navigation in the listener** — SDK events fire outside Angular's zone; raw `router.navigate` won't trigger change detection. UI freezes despite URL changing.

---

## Route configuration

```ts
const routes: Routes = [
  { path: 'meet/:sessionId', component: CallRoomComponent, data: { reuseRoute: false } },
];
```

Read `sessionId` via `ActivatedRoute.snapshot.paramMap.get('sessionId')` in `ngOnInit`.

---

## Anti-patterns

1. **Always-rendered container with `@ViewChild({ static: true })`.** Works but doesn't match the sample app pattern and forces you to handle "not yet joined" rendering inside the SDK's iframe area. Use `@if` + `viewChild` signal instead.
2. **`@ViewChild({ static: false })` without compensating logic.** Container ref is undefined in `ngOnInit` — `joinSession` throws or no-ops.
3. **`width: 100%; height: 100vh` container.** Works in flat layouts; fails in nested route outlets or flex parents. Use `position: fixed` instead.
4. **Explicit `{ sessionType, layout, ... }` settings.** Type-valid but has caused unexplained black-tile-on-local-preview behaviour in customer integrations. Use `{}` and let the SDK pick defaults.
5. **`onSessionLeft` only.** Fires on graceful user leave but NOT on network drops or peer disconnects. Use `onConnectionClosed` for the cleanup path.
6. **Calling `startMeeting()` synchronously after `inMeeting.set(true)`.** The `@if` block hasn't rendered yet — `meetingContainer()` returns undefined. Wrap the `generateToken` + `joinSession` call in `setTimeout(0)` (or `afterNextRender` in Angular 16+).
7. **No `NgZone.run` around router navigation in event listeners.** SDK fires outside Angular's zone — change detection doesn't run, UI freezes.
8. **Component reused via `RouteReuseStrategy`.** Stale signal state → second navigation skips `joinSession`. Disable reuse for the call route.
9. **Initializing Chat SDK for a session-only integration.** Wastes time and adds two extra failure modes (Chat init, Chat login race). Drop `CometChat.init` / `CometChat.login` entirely for standalone session apps.

---

## Verification checklist

- [ ] Container uses `position: fixed; width: 100vw; height: 100vh` (sample-app pattern)
- [ ] Container rendered via `@if (inMeeting())`, read via `viewChild`
- [ ] Settings passed as empty `{}`, not explicit `{ sessionType, layout, ... }`
- [ ] `onConnectionClosed` listener handles session end (not just `onSessionLeft`)
- [ ] `NgZone.run` wraps router navigation in the event handler
- [ ] `setTimeout(0)` (or `afterNextRender`) gates `joinSession` until the `@if` block renders
- [ ] `leaveSession` called in `ngOnDestroy`
- [ ] Listener cleanup function called in `ngOnDestroy`
- [ ] Route has `data: { reuseRoute: false }` to prevent stale-component reuse
- [ ] **Standalone session-only:** no `CometChat.init` / `CometChat.login` — Calls SDK alone
- [ ] **Additive (chat + calls):** dual-SDK contract preserved (Chat first, then Calls)
- [ ] Browser smoke: 2 tabs, both navigate to `/meet/${sessionId}`, both join, media flows, either leaves → other sees onConnectionClosed

---

## Pointers

- `cometchat-react-calls/references/call-session.md` — full architecture (sessionId strategies, server-side authorization)
- `cometchat-angular-calls/SKILL.md` — Angular-specific dual-SDK init pattern
- `references/ngzone-and-async-callbacks.md` — why NgZone.run matters for SDK events
- Upstream Angular sample — `calls-sdk-javascript-5/sample-apps/cometchat-calls-sample-app-angular/src/app/pages/join-session/`
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/join-session
