---
name: cometchat-angular-calls
description: CometChat Calls SDK integration for Angular 12-15 apps. Wraps the @cometchat/calls-sdk-javascript SDK in Angular service + component patterns. Covers dual-SDK init via APP_INITIALIZER, the Angular UI Kit's <cometchat-call-buttons> / <cometchat-incoming-call> / <cometchat-ongoing-call> / <cometchat-call-logs> selectors, getRTCToken, getUserMedia handling, route-guard placement, NgZone correctness for SDK callbacks, and additive-vs-standalone modes.
license: "MIT"
compatibility: "Angular 12-15 (LTS focus on 15); @cometchat/calls-sdk-javascript ^4.x; @cometchat/chat-sdk-javascript ^4.x; @cometchat/chat-uikit-angular ^4.x (additive mode)"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular calls voice video webrtc app-initializer ngzone uikit-angular calls-sdk-javascript getrtc-token call-buttons incoming-call ongoing-call call-logs"
---

## Purpose

Production-grade voice + video calling for Angular 12-15 apps. Loaded by `cometchat-calls` when `framework === "angular"`. Operates in two modes:

- **Standalone** — calls is the product. `@cometchat/chat-sdk-javascript` (signaling) + `@cometchat/calls-sdk-javascript` (WebRTC) wrapped in Angular services. Custom call screens.
- **Additive** — calls layered onto an existing CometChat Angular UI Kit integration. Adds `<cometchat-call-buttons>` inline, mounts `<cometchat-incoming-call>` at the root of `AppComponent`.

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-angular-core` — `UIKitSettingsBuilder`, `APP_INITIALIZER` init pattern, login order, `environment.ts` credentials
- `cometchat-angular-patterns` — lazy loading, route guards, standalone-vs-NgModule integration

**Ground truth:**
- SDK source — `~/Downloads/calls-sdk/calls-sdk-javascript-5/package/`
- Angular sample app — `~/Downloads/calls-sdk/calls-sdk-javascript-5/sample-apps/cometchat-calls-sample-app-angular/`
- Existing skill — `cometchat-angular-features` (calls section will move into here)
- Public docs — https://www.cometchat.com/docs/calls/javascript/overview (Angular wrapper docs are sparse — sample app is canonical)

---

## 1. Hard rules — Angular specialization

### 1.0 Calls SDK login is its own step (v5+)

Angular uses the same JS SDKs as React. The v5 Calls SDK has its own auth state, separate from the Chat SDK. After `CometChat.login(uid, AUTH_KEY)` succeeds, you MUST also call `await CometChatCalls.login(uid, AUTH_KEY)` — without it, the FIRST calls API call throws **"auth token cannot be null"**.

```ts
// auth.service.ts
import { Injectable } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

@Injectable({ providedIn: "root" })
export class AuthService {
  async login(uid: string): Promise<void> {
    await CometChat.login(uid, environment.cometchatAuthKey);
    // v5 Calls SDK requires a separate login. Don't skip.
    await CometChatCalls.login(uid, environment.cometchatAuthKey);
    // Production: await CometChatCalls.loginWithAuthToken(authTokenFromBackend);
  }
}
```

**Surprises:**
- The Chat SDK persists login via localStorage; the **Calls SDK does NOT** across page reloads in Angular (it stores its session in localStorage too, but state can drift). Always check `CometChatCalls.getLoggedInUser()` on app bootstrap and re-login if null.
- Run the login inside an Angular zone — if you bypass `NgZone` and the login resolves from a Web Worker context (rare), change detection won't fire downstream. Default `await` in a service method is fine.

### 1.1 Dual-SDK contract

Same web shape, wrapped in services:

```ts
// call-init.service.ts
import { Injectable } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class CallInitService {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Chat SDK — required for ringing
    const appSettings = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(environment.cometchat.region)
      .build();
    await CometChat.init(environment.cometchat.appId, appSettings);

    // Calls SDK — WebRTC session
    const callAppSettings = new CometChatCalls.CallAppSettingsBuilder()
      .setAppId(environment.cometchat.appId)
      .setRegion(environment.cometchat.region)
      .build();
    CometChatCalls.init(callAppSettings);

    this.initialized = true;
  }
}
```

Wired via `APP_INITIALIZER` in `app.module.ts`:

```ts
{
  provide: APP_INITIALIZER,
  useFactory: (svc: CallInitService) => () => svc.init(),
  deps: [CallInitService],
  multi: true,
}
```

### 1.2 VoIP push — N/A on Angular web (same as React)

Same as `cometchat-react-calls` rule 1.2 — browsers don't have VoIP push. Web Push (Service Worker + `Notification`) is opt-in fallback.

### 1.3 Lifecycle — `getUserMedia` cleanup

Same as web. Custom WebRTC surfaces must `getTracks().forEach(t => t.stop())` on hangup. The `<cometchat-ongoing-call>` selector handles it for additive mode.

### 1.4 Server-minted auth tokens

`cometchat-angular-production` covers this. Production calls use `CometChat.login(authToken)`, not `CometChat.login(uid, authKey)`.

### 1.5 Hangup cleanup — see rule 1.3 + zone consistency

When a Calls SDK callback fires outside Angular's zone, the UI doesn't update. Standard fix:

```ts
import { NgZone } from "@angular/core";

export class OngoingCallComponent {
  constructor(private zone: NgZone) {}

  ngOnInit() {
    CometChatCalls.joinSession(token, settings, container);  // v5 canonical (startSession is a deprecated shim)

    // Wrap any UI-mutating callback in NgZone.run
    callListener.onCallEnded = () => {
      this.zone.run(() => {
        this.callEnded = true;
        this.cleanup();
      });
    };
  }

  cleanup() {
    CometChatCalls.leaveSession();
    this.stream?.getTracks().forEach(t => t.stop());
  }
}
```

Without `NgZone.run`, change detection doesn't fire and the UI looks frozen until the next user interaction.

**⚠️ Where does the WebRTC `#callContainer` live? Two valid patterns; pick one explicitly.**

The container `<div>` must exist in the DOM when `CometChatCalls.joinSession(token, settings, container)` runs. Angular's `@if` (or `*ngIf`) gates this — get the gate wrong and the call surface never renders. Two patterns work; the second is recommended for new code:

#### Pattern A — Single-component, gated by `@if (phase === 'ongoing')`

The container lives inside the same component that owns call state. Race: after `phase.set('ongoing')`, the next microtask runs BEFORE Angular's zone-driven render, so `@ViewChild` is still null. Use a **full task tick**, not a microtask:

```ts
this.phase.set('ongoing');

// ❌ WRONG — microtask runs before Angular renders the @if block
// await Promise.resolve();

// ✅ RIGHT — full task tick gives Angular's change detector time to mount the container
await new Promise((r) => setTimeout(r, 0));

const container = this.callContainer?.nativeElement;
if (!container) throw new Error('Call container not ready.');
await CometChatCalls.joinSession(callToken, callSettings, container);
```

Validated 2026-05-13 against a Next.js peer.

#### Pattern B — Separate `OngoingCallComponent`, parent-conditional mount (RECOMMENDED)

The container lives in its own component, and the **parent** decides whether to instantiate that component (not an inner `@if` inside the child template). This sidesteps the race entirely:

```html
<!-- app.component.html — parent gates the whole overlay component -->
<router-outlet />

@if (state.isInCall()) {
  <app-ongoing-call />
}
@if (state.isIncoming()) {
  <app-incoming-call-overlay />
}
```

```html
<!-- ongoing-call.component.html — NO inner @if, container always exists when this component is mounted -->
<div class="oc-shell">
  <div #callContainer class="oc-container"></div>
  <button (click)="endCall()">End call</button>
</div>
```

```ts
// ongoing-call.component.ts
@Component({ /* ... */, changeDetection: ChangeDetectionStrategy.OnPush })
export class OngoingCallComponent implements AfterViewInit, OnDestroy {
  @ViewChild('callContainer', { static: true })
  private callContainer!: ElementRef<HTMLDivElement>;

  protected readonly state = inject(CallStateService);

  async ngAfterViewInit(): Promise<void> {
    // No setTimeout(0) needed — the component is only instantiated when
    // the parent's @if (state.isInCall()) flips true. The @ViewChild is
    // guaranteed resolved by the time ngAfterViewInit fires.
    await this.state.startWebRtcSession(this.callContainer.nativeElement);
  }

  ngOnDestroy(): void {
    this.state.endWebRtcSessionOnly();
  }
}
```

**Why Pattern B is race-free:** the component is only INSTANTIATED when `state.isInCall()` becomes true. `ngAfterViewInit` fires after the view tree is built, by which point `#callContainer` exists. No `setTimeout 0` workaround needed.

**Anti-pattern caught 2026-05-14:** mounting `<app-ongoing-call />` unconditionally with `@if (state.isInCall())` INSIDE the child template. `{static: true}` becomes a lie — the element isn't in the DOM at view-init on first mount → `ngAfterViewInit` throws `TypeError: Cannot read properties of undefined (reading 'nativeElement')` → `provideAppInitializer` rejects → bootstrap "completes with error" but the app still renders with stale initial signals.

### 1.6 Permissions — browser handles `getUserMedia`

Same as web. Surface `NotAllowedError` and `NotFoundError` to a clear UI message. HTTPS required (or localhost).

### 1.7 IncomingCall mounted at app root

`<cometchat-incoming-call>` belongs in `AppComponent`'s template, ABOVE `<router-outlet>`:

```html
<!-- app.component.html -->
<cometchat-incoming-call></cometchat-incoming-call>
<router-outlet></router-outlet>
```

Inside a feature-module template means the listener disappears on route change → calls only ring when that route is active. Same canonical bug as React.

For lazy-loaded features that include calls, the dispatcher in `cometchat-angular-patterns` shows the eager-load-only pattern for the calls module.

**⚠️ Mixed-stack receiver inconsistency (validated 2026-05-15).** If your Angular app is the RECEIVER in a mixed-stack scenario (mobile kit-based caller → Angular custom UI receiver), confirm a **single active session per UID** before relying on `onIncomingCallReceived`. Symptom: server records the incoming call (visible in REST `GET /users/{uid}/calls`), but the listener never fires on the active Angular tab — typically because a stale session for the same UID elsewhere is eating the call-delivery routing. Workaround:

```bash
# Evict all sessions for the receiver UID before testing
curl -X DELETE 'https://<APP_ID>.api-<REGION>.cometchat.io/v3/users/<uid>/auth_tokens' \
  -H 'appId: <APP_ID>' \
  -H 'apiKey: <REST_API_KEY>'
```

Then hard-refresh the Angular tab so a fresh login mints a clean token. The reverse direction (Angular caller → mobile receiver) works without this workaround. Tracked for v4.3 investigation; full context in `project_pixel_to_angular_ringing_inconsistency` memory entry.

### 1.8 Signals required for cross-service state under OnPush

Validated 2026-05-14 on Angular 21.2.0. Single biggest "looks-correct-but-fails-silently" bug in this stack.

```ts
// ❌ Plain property — captured at component construction. With OnPush, the
//    template re-reads the captured value only when an explicit re-render
//    happens. If the service sets it later, the template stays stuck on
//    the initial value forever.
@Injectable({ providedIn: 'root' })
export class CallInitService {
  loggedInUid: string | null = null;
  async init() { /* ... */ this.loggedInUid = 'cometchat-uid-5'; }
}

// In a component with OnPush, this looks reactive but isn't:
protected readonly loggedInUid = this.callInit.loggedInUid;
// Template: {{ loggedInUid ?? 'connecting…' }}   → stuck on "connecting…" forever

// ✅ Signal — reactive readers re-render on .set()
@Injectable({ providedIn: 'root' })
export class CallInitService {
  readonly loggedInUid = signal<string | null>(null);
  async init() { /* ... */ this.loggedInUid.set('cometchat-uid-5'); }
}

// In the component (still OnPush):
protected readonly loggedInUid = this.callInit.loggedInUid;
// Template: {{ loggedInUid() ?? 'connecting…' }}   → updates within the next microtask
```

**Rule:** ANY service state that the template observes MUST be a signal (or an observable consumed via the `async` pipe / `toSignal`). Plain properties don't trigger OnPush change detection from outside the component's input/event surface.

Cross-service state set during `provideAppInitializer` is the classic case — by the time the component is constructed, the service property may or may not be set, and even if it isn't yet, a later `.set()` would never reach the template under OnPush.

### 1.9 `provideAppInitializer` failures are silent — surface them in the UI

Modern Angular bootstrap "completes" even when `provideAppInitializer` throws — the error logs to `console.error` and the app still mounts in a partial state. Visible symptom: UI renders but cross-service state is stuck at initial values.

Best practice — make init errors visible:

```ts
@Injectable({ providedIn: 'root' })
export class CallInitService {
  readonly loggedInUid = signal<string | null>(null);
  readonly initError = signal<string | null>(null);
  readonly initStep = signal<string>('not-started');

  async init(): Promise<void> {
    try {
      this.initStep.set('chat-init');
      await CometChat.init(/* ... */);

      this.initStep.set('calls-init');
      await CometChatCalls.init(/* ... */);

      this.initStep.set('chat-login');
      await CometChat.login(/* ... */);

      this.initStep.set('calls-login');
      // ERR_ALREADY_LOGGED_IN is common on HMR — tolerate it
      try {
        await CometChatCalls.login(/* ... */);
      } catch (e: any) {
        const code = e?.code ?? e?.message ?? '';
        if (!/already/i.test(String(code))) throw e;
        console.warn('[CallInitService] calls.login non-fatal:', e);
      }

      this.loggedInUid.set(uid);
      this.initStep.set('ready');
    } catch (e: any) {
      const msg = e?.message ?? e?.code ?? JSON.stringify(e);
      console.error('[CallInitService] init failed at step', this.initStep(), e);
      this.initError.set(`Failed at "${this.initStep()}": ${msg}`);
      throw e;  // re-throw so APP_INITIALIZER still logs the failure
    }
  }
}
```

Then render `initError` in the root template:

```html
@if (initError(); as err) {
  <div class="init-error">Init failed: {{ err }}</div>
}
```

Without this surface, a single bug deep in init causes the dev to spend 20+ minutes guessing where the failure is. Validated 2026-05-14 — the `initStep` instrumentation immediately revealed an `ngAfterViewInit` ViewChild bug that had previously looked like a "stuck on connecting" without any clue.

### 1.10 `ERR_ALREADY_LOGGED_IN` on HMR is non-fatal

`CometChatCalls.login` is intolerant of re-login during dev HMR cycles. Wrap in a tolerant catch that only re-throws non-"already" errors (see 1.9 code above). The chat-side session survives HMR, so the calls session can ride on it.

---

## 2. Setup

### Install

```bash
npm install @cometchat/chat-sdk-javascript @cometchat/calls-sdk-javascript
# additive mode: @cometchat/chat-uikit-angular is already installed
```

### `app.module.ts` (NgModule path)

```ts
import { NgModule, APP_INITIALIZER, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { CometChatUIKitModule } from "@cometchat/chat-uikit-angular";   // additive mode
import { CallInitService } from "./services/call-init.service";

@NgModule({
  imports: [
    CometChatUIKitModule,                     // additive mode only
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (svc: CallInitService) => () => svc.init(),
      deps: [CallInitService],
      multi: true,
    },
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],          // required by UI Kit selectors
})
export class AppModule {}
```

### Standalone components (Angular 14+)

```ts
// main.ts
bootstrapApplication(AppComponent, {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (svc: CallInitService) => () => svc.init(),
      deps: [CallInitService],
      multi: true,
    },
  ],
});
```

The standalone-component path skips `CometChatUIKitModule` — instead, individual standalone selectors are imported per-component.

---

## 3. Components catalog

### Calls SDK primitives (used in standalone or custom components)

Same shape as `cometchat-react-calls` Section 3 — `CometChatCalls.init`, `generateToken(sessionId)` (single arg in v5; auth is internal after login), `joinSession(token, settings, htmlElement)` (v5 canonical; `startSession` is a deprecated shim), `leaveSession()` (v5 canonical; `endSession()` is deprecated), `CallSettingsBuilder`, etc. The audit-verified API surface is documented in `cometchat-react-calls` and applies unchanged in Angular (same JS SDK).

### UI Kit selectors (additive mode — `@cometchat/chat-uikit-angular`)

| Selector | Purpose |
|---|---|
| `<cometchat-call-buttons [user]="u">` | Voice + video buttons (typically inside `<cometchat-message-header>`) |
| `<cometchat-incoming-call>` | Root-mounted listener |
| `<cometchat-outgoing-call>` | Auto-mounted on initiate |
| `<cometchat-ongoing-call>` | Active call view |
| `<cometchat-call-logs (itemClick)="onLogClick($event)">` | Paginated history |

`CUSTOM_ELEMENTS_SCHEMA` (or full module imports) must be in the consuming module — same rule as the chat selectors.

---

## 4. Standalone integration

When `product === "voice-video"` and there is no existing UI Kit.

**Split by calling mode — these are two different shapes:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

Calls SDK ONLY. NO Chat SDK. Matches the upstream sample at `~/Downloads/calls-sdk/calls-sdk-javascript-5/sample-apps/cometchat-calls-sample-app-angular/`. The skill scaffolds:

1. **`services/call-init.service.ts`** — `CometChatCalls.init({ appId, region, authKey })` ONLY. No `CometChat.init`. Exposed via `provideAppInitializer`. Pass `authKey` at init time so `CometChatCalls.login(uid)` needs no second arg.
2. **`pages/join-session/join-session.component.ts`** — UID picker (dev mode) + "Start meeting" / "Join meeting" + the meeting-room container (`@if (inMeeting()) { <div class="meeting-container" #meetingContainer></div> }`). Container CSS: `position: fixed; width: 100vw; height: 100vh`. `CometChatCalls.joinSession(token, {}, container.nativeElement)` with empty settings. See `references/call-session.md` for the full canonical pattern.
3. **Routing** — `/meet/:sessionId` route registered with `data: { reuseRoute: false }`.
4. **`environment.ts`** — credentials block.
5. **HTTPS check** — warns if dev server is HTTP non-localhost.

**Why no Chat SDK:** session mode never touches the Chat SDK call entity. Initializing both SDKs adds two failure modes (Chat init, Chat login race) for zero benefit. The upstream Angular sample confirms this — it never imports `@cometchat/chat-sdk-javascript`.

### 4b. Standalone — Ringing mode (CallButtons + Incoming/Outgoing/Ongoing kit selectors)

Dual-SDK: Chat SDK signaling channel + Calls SDK media channel. The skill scaffolds:

1. **`services/call-init.service.ts`** — Chat SDK + Calls SDK init (sequential), exposed via `APP_INITIALIZER`.
2. **`components/call-button/call-button.component.ts`** — Voice + video buttons, `[user]` input, emits `(callInitiated)`.
3. **`pages/ongoing-call/ongoing-call.component.ts`** — `(deactivate)` route guard cleans up if user navigates away mid-call. WebRTC view via direct `CometChatCalls.joinSession`. Rule 1.5 cleanup.
4. **`pages/call-logs/call-logs.component.ts`** — `/calls` route, paginated via `CallLogRequestBuilder`.
5. **`AppComponent` template** — `<cometchat-incoming-call>` (or a custom incoming-call equivalent in standalone mode) above `<router-outlet>`.
6. **Routing** — `/calls` and `/ongoing-call/:sessionId` routes registered in `app-routing.module.ts`.
7. **`environment.ts`** — credentials block (rule from `cometchat-angular-core`).
8. **Optional Web Push** — Service Worker registration via `@angular/service-worker` if user opts in.

## 5. Additive integration

When `cometchat-angular-core` integration already exists. The skill:

1. Adds `@cometchat/calls-sdk-javascript`.
2. Patches existing `init.service.ts` (or whatever the project named it) to add `CometChatCalls.init` after `CometChat.init`.
3. Adds `<cometchat-incoming-call>` to `AppComponent` template (rule 1.7).
4. Wires `<cometchat-call-buttons [user]="user">` inside the existing message-header template if not already present (often auto-rendered by `<cometchat-message-header>` when `[user]` is set).
5. Optionally adds a `/calls` route for `<cometchat-call-logs>`.

## 6. Anti-patterns

1. **Initializing in a feature module's `ngOnInit`** instead of `APP_INITIALIZER` / `provideAppInitializer`. The chat SDK auth context isn't ready when the component tries to use it. APP_INITIALIZER blocks bootstrap until init succeeds.
2. **Mounting `<cometchat-incoming-call>` inside a feature module's component.** Disappears on route change. Mount in AppComponent (rule 1.7).
3. **Skipping `NgZone.run` for SDK callbacks.** UI doesn't update on call-end. Rule 1.5.
4. **Skipping `CUSTOM_ELEMENTS_SCHEMA`.** Selectors render but Angular logs "is not a known element" errors and breaks zone-aware bindings.
5. **Using `CometChatCalls.joinSession` without `await CometChatCalls.generateToken`** — same anti-pattern as React.
6. **Lazy-loading the calls module.** Calls must be initialized at bootstrap; lazy-loading defers init past the point where calls might already be coming in. Eager-load anything that imports `CallInitService`.
7. **Running over HTTP non-localhost.** `getUserMedia` denies; `ng serve` is HTTPS-capable via `--ssl`.
8. **Plain properties on services consumed by OnPush components** (rule 1.8). Captured-at-construction state stays stuck on the initial value forever. Use signals.
9. **Inner `@if (state.isInCall())` inside the ongoing-call component's own template** (rule 1.5 Pattern B anti-pattern). Makes `{static: true}` `@ViewChild('callContainer')` a lie — `ngAfterViewInit` reads `undefined.nativeElement`. Gate at the parent.
10. **Letting `provideAppInitializer` failures bubble silently** (rule 1.9). App mounts in a half-initialized state; UI looks like it's "stuck connecting." Always surface an `initError` signal in the UI.
11. **Failing on `ERR_ALREADY_LOGGED_IN`** during HMR (rule 1.10). Common during dev; wrap `CometChatCalls.login` in a tolerant catch.

## 7. Verification checklist

**Static:**

- [ ] `@cometchat/chat-sdk-javascript` and `@cometchat/calls-sdk-javascript` in `package.json`
- [ ] `APP_INITIALIZER` / `provideAppInitializer` registered in `app.module.ts` or `app.config.ts`
- [ ] `CallInitService.init` calls Chat SDK init then Calls SDK init (sequential)
- [ ] `CallInitService.loggedInUid` is a `signal<string | null>` (NOT a plain property) — rule 1.8
- [ ] `CallInitService` exposes `initError: signal<string | null>` and the root template renders it — rule 1.9
- [ ] `CometChatCalls.login` wrapped in tolerant catch for `ERR_ALREADY_LOGGED_IN` — rule 1.10
- [ ] `CUSTOM_ELEMENTS_SCHEMA` in the consuming module
- [ ] `<cometchat-incoming-call>` in AppComponent template above `<router-outlet>` (or split-component Pattern B per rule 1.5 — `@if (state.isInCall())` / `@if (state.isIncoming())` parent-conditional mount)
- [ ] All SDK callbacks that mutate UI are wrapped in `NgZone.run`
- [ ] Hangup path includes `CometChatCalls.leaveSession()` + track stops
- [ ] `environment.ts` has `cometchat: { appId, region, authKey }` (dev) or token-endpoint config (prod)
- [ ] Module-level `initialized` flag in CallInitService
- [ ] Node version ≥ 20.19 or ≥ 22.12 (Angular CLI 21+ requirement)

**Runtime (browser):**

- [ ] Outgoing call connects, two-way audio + video
- [ ] Incoming call rings on a separate route within the same app
- [ ] Camera light off within 2 seconds of hangup
- [ ] Route navigation during call cleanly disconnects (deactivate guard runs)
- [ ] HTTPS or localhost only

## 8. Pointers

- `cometchat-angular-core` — UIKitSettingsBuilder, APP_INITIALIZER pattern, environment.ts
- `cometchat-angular-components` — full UI Kit selector catalog (additive mode)
- `cometchat-angular-patterns` — lazy loading, route guards, standalone-vs-NgModule
- `cometchat-angular-production` — server-minted tokens, external-backend recipes (Express/Hono/Firebase/Vercel)
- `cometchat-angular-troubleshooting` — CUSTOM_ELEMENTS_SCHEMA, zone issues, SSR/Universal
