---
name: cometchat-angular-calls
description: CometChat Calls integration for Angular UI Kit v5 (@cometchat/chat-uikit-angular@5). Covers enabling calling via UIKitSettingsBuilder().setCallingEnabled(true), the kit's standalone call components (<cometchat-call-buttons>, <cometchat-incoming-call>, <cometchat-outgoing-call>, <cometchat-ongoing-call>, <cometchat-call-logs>), the @Input-callback-vs-@Output binding split, app-wide incoming-call mounting, the @cometchat/calls-sdk-javascript@^5 peer dep, NgZone correctness, getUserMedia handling, and additive-vs-standalone modes.
license: "MIT"
compatibility: "Angular >=17 <22 (standalone APIs); @cometchat/chat-uikit-angular ^5.0 (5.0.2 verified); @cometchat/calls-sdk-javascript ^5.0 (calls peer); @cometchat/chat-sdk-javascript ^4.1"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular calls voice video webrtc uikit-angular v5 standalone-components setCallingEnabled call-buttons incoming-call outgoing-call ongoing-call call-logs ngzone calls-sdk-javascript"
---

## Purpose

Production-grade voice + video calling for **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`) apps. Loaded by `cometchat-calls` when `framework === "angular"`. Operates in two modes:

- **Additive** — calls layered onto an existing CometChat Angular UI Kit v5 chat integration. Enable calling on the `UIKitSettingsBuilder`, drop `<cometchat-call-buttons>` next to a user/group, and mount `<cometchat-incoming-call>` at the root of `AppComponent` so calls ring app-wide.
- **Standalone** — calls is the product, no chat surface. Same kit init + calling enabled, plus the call components (`<cometchat-ongoing-call>`, `<cometchat-call-logs>`, custom button screens) without `<cometchat-conversations>` / `<cometchat-message-*>`.

**v5 is standalone-component-based and targets Angular 17–21.** Import each call component *class* into the consuming standalone component's `imports: []` — there is no NgModule and **no `CUSTOM_ELEMENTS_SCHEMA`** (that was a v4 mental model; v5 components are real Angular components).

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-angular-core` — `UIKitSettingsBuilder` init, `APP_INITIALIZER` pattern, `login(uid)` (bare string), `loggedInUser$`, `environment.ts`
- `cometchat-angular-components` — full call-component binding tables (the `@Input`-callback-vs-`@Output` split)
- `cometchat-angular-patterns` — standalone wiring, route guards, NgZone, change detection

**Ground truth:**
- Kit types — `@cometchat/chat-uikit-angular@5.0.2` → `node_modules/@cometchat/chat-uikit-angular/types/cometchat-chat-uikit-angular.d.ts`. Verify any non-obvious symbol against the installed `.d.ts` before relying on it.
- Calls SDK — `@cometchat/calls-sdk-javascript@^5` (same underlying JS SDK as the React kit; the `CometChatUIKitCalls` namespace ships from this package)
- Public docs — https://www.cometchat.com/docs/ui-kit/angular and https://www.cometchat.com/docs/calls/javascript/overview

---

## 1. How calling works in Angular UI Kit v5

### 1.0 The kit owns calls init — you enable it on the builder

This is the single biggest difference from the old v4 calls skill. In v5 you do **not** hand-wire `CometChatCalls.init` / `CometChatCalls.login` for the kit path. You **enable calling on the `UIKitSettingsBuilder`** and the kit initializes the Calls SDK for you after `CometChatUIKit.login()` resolves.

```typescript
import { UIKitSettingsBuilder, CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { environment } from "../environments/environment";

const settings = new UIKitSettingsBuilder()
  .setAppId(environment.cometchat.appId)
  .setRegion(environment.cometchat.region)        // "us" | "eu" | "in"
  .setAuthKey(environment.cometchat.authKey)       // dev only — omit in production
  .subscribePresenceForAllUsers()
  .setCallingEnabled(true)                         // ← turns calling on (verified builder method)
  .build();

await CometChatUIKit.init(settings);
// ... later, after login:
await CometChatUIKit.login("cometchat-uid-1");     // kit initializes the Calls SDK internally
```

- `setCallingEnabled(true)` is a real `UIKitSettingsBuilder` method (verified in the kit `.d.ts`). It is **off by default** — without it the call components render disabled and `CometChatUIKit.isCallingEnabled()` returns `false`.
- After login, confirm with `CometChatUIKit.isCallingEnabled()` (static, returns `boolean`) before rendering call UI on a custom screen.
- **Optional advanced config:** to override the Calls SDK app settings, build a `CometChatUIKitCalls.CallAppSettingsBuilder()` and pass it via `.setCallAppSettings(callAppSettings)`. `CometChatUIKitCalls` is re-exported by the UI Kit — import it from `@cometchat/chat-uikit-angular` (the kit wraps the optional `@cometchat/calls-sdk-javascript` dependency; the calls SDK itself exports `CometChatCalls`, not `CometChatUIKitCalls`):

  ```typescript
  import { CometChatUIKitCalls } from "@cometchat/chat-uikit-angular";

  const callAppSettings = new CometChatUIKitCalls.CallAppSettingsBuilder()
    .setAppId(environment.cometchat.appId)
    .setRegion(environment.cometchat.region)
    .build();

  const settings = new UIKitSettingsBuilder()
    .setAppId(environment.cometchat.appId)
    .setRegion(environment.cometchat.region)
    .setCallingEnabled(true)
    .setCallAppSettings(callAppSettings)   // optional — kit builds defaults from appId+region if omitted
    .build();
  ```

  Most integrations do not need `setCallAppSettings` — `setCallingEnabled(true)` is enough; the kit derives defaults from `appId` + `region`.

### 1.1 The calls peer dependency

The Calls SDK is a **separate peer dependency** you must install yourself — the kit declares it as a peer but does not bundle it:

```bash
npm install @cometchat/calls-sdk-javascript@^5
```

Without it, `setCallingEnabled(true)` fails at runtime when the kit tries to load `CometChatUIKitCalls` — symptom: "Cannot find module @cometchat/calls-sdk-javascript" or call components that never connect.

### 1.2 VoIP push — N/A on Angular web (same as React)

Browsers don't have VoIP push. A closed tab cannot ring. Web Push (Service Worker + `Notification` API) is an opt-in fallback to nudge the user to an open tab; it does not bypass tab/page-load. Production web calls UX typically pairs with email/SMS fallback for missed calls.

### 1.3 Lifecycle — `getUserMedia` cleanup

Browsers don't release the camera/mic until tracks are stopped. The kit's `<cometchat-ongoing-call>` handles this internally — when the component is destroyed (`ngOnDestroy` ends the session). If you build a **custom** WebRTC surface with the raw Calls SDK (§4c), you must `getTracks().forEach(t => t.stop())` on hangup yourself.

### 1.4 Server-minted auth tokens (production)

Production login uses `CometChatUIKit.loginWithAuthToken(tokenFromBackend)` — see `cometchat-angular-core` §4 and `cometchat-angular-production`. Because the kit owns calls init/login, the same auth-token login covers calls too on the kit path; there is no separate calls token step. (Raw-SDK custom surfaces in §4c that talk to `CometChatCalls` directly mint a session token via `CometChatCalls.generateToken(sessionId)`.)

### 1.5 NgZone correctness for SDK callbacks

When a Calls SDK or Chat SDK callback fires outside Angular's zone, change detection doesn't run and the UI looks frozen until the next user interaction. The kit components run their own handlers inside the zone, but **any handler you write** (e.g. an `onAccept` callback, a raw `CometChat.addCallListener` listener, or the `error` `@Output`) that mutates component state should be safe under change detection. Two correct approaches:

```typescript
import { NgZone, ChangeDetectorRef } from "@angular/core";

// Approach A — wrap UI-mutating work in NgZone.run
constructor(private zone: NgZone) {}

handleAccept = (call: CometChat.Call) => {
  this.zone.run(() => {
    this.activeSessionId = call.getSessionId();
    this.inCall = true;
  });
};

// Approach B (recommended for new code) — use signals; reactive readers
// re-render regardless of which zone the .set() ran in.
readonly inCall = signal(false);
handleAccept = (call: CometChat.Call) => { this.inCall.set(true); };
```

**Rule:** any service/component state a template observes under `OnPush` MUST be a `signal` (or an observable via the `async` pipe / `toSignal`). A plain property set from outside the component's input/event surface never triggers `OnPush` change detection — the template stays stuck on the initial value forever. See `cometchat-angular-patterns` for the full signals-vs-plain-property rule.

### 1.6 Permissions — the browser handles `getUserMedia`

The browser prompts for camera/mic automatically when the Calls SDK starts media. Surface `NotAllowedError` (denied) and `NotFoundError` (no device) to a clear message via the `error` `@Output` / `onError` callback. **HTTPS is required** (or `localhost`) — `getUserMedia` returns `NotAllowedError` over plain HTTP. `ng serve --ssl` for local HTTPS.

### 1.7 `<cometchat-incoming-call>` mounted at app root

For calls to ring on **every** route, `<cometchat-incoming-call>` must live in a component that **stays mounted across navigation** — `AppComponent` (above `<router-outlet>`) is the simplest place. A **persistent authenticated shell** works equally well: the canonical Angular sample mounts it in its post-login home/shell component (`cometchat-home.component.html`), not literally in `AppComponent`. The rule is "lives in a host that outlives route changes," not "must be AppComponent specifically." Below uses `AppComponent` as the no-shell default:

```html
<!-- app.component.html -->
<cometchat-incoming-call></cometchat-incoming-call>
<router-outlet></router-outlet>
```

```typescript
// app.component.ts — import the class into imports: []
import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { CometChatIncomingCallComponent } from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, CometChatIncomingCallComponent],
  templateUrl: "./app.component.html",
})
export class AppComponent {}
```

Mounting it inside a feature-route component means the listener disappears on navigation → calls only ring while that route is active. That is the canonical "calls don't ring" bug. For lazy-loaded features, keep the incoming-call mount in the eagerly-loaded `AppComponent`, not the lazy chunk.

### 1.8 The `@Input`-callback vs `@Output` binding split (the #1 Angular-v5 calls trap)

The call components expose accept/decline/error as **`@Input` callback props** (functions passed *into* the component), NOT `@Output` events — but several also expose `@Output` `EventEmitter`s for observing. Bind the form that exists for what you need:

```html
<!-- ✓ accept/decline/error are @Input CALLBACK props — pass a function reference -->
<cometchat-incoming-call
  [onAccept]="handleAccept"
  [onDecline]="handleDecline"
  [onError]="handleError">
</cometchat-incoming-call>

<!-- ✓ the SAME component also exposes @Outputs for observation -->
<cometchat-incoming-call
  (callAccepted)="onAccepted($event)"
  (callDeclined)="onDeclined($event)"
  (error)="onErr($event)">
</cometchat-incoming-call>
```

- `[onAccept]="handleAccept"` binds an `@Input` — `handleAccept` is a **function reference** (do NOT call it: `[onAccept]="handleAccept()"` is wrong). Prefer the `@Input` callbacks for accept/decline because they carry the kit's built-in call handling.
- `(callAccepted)="onAccepted($event)"` binds an `@Output` — use `$event` and these for pure observation.
- **Don't cross them:** binding `(onAccept)` (as if it were an output) or `[callAccepted]` (as if it were an input) silently does nothing.

See `cometchat-angular-components` for the exact per-component split.

---

## 2. Setup

### Install

```bash
# additive mode: @cometchat/chat-uikit-angular@^5 is already installed.
# Always add the calls peer:
npm install @cometchat/calls-sdk-javascript@^5
```

The chat SDK (`@cometchat/chat-sdk-javascript@^4.1`) and `dompurify@^3` are pulled in by the kit's peers. Do **not** install `@cometchat/uikit-shared` / `-elements` / `-resources` — they don't exist in v5.

### Enable calling at init (standalone bootstrap, Angular 17+)

```typescript
// main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { APP_INITIALIZER } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideAnimations } from "@angular/platform-browser/animations";
import { UIKitSettingsBuilder, CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";
import { environment } from "./environments/environment";

function initCometChat() {
  return () => {
    const settings = new UIKitSettingsBuilder()
      .setAppId(environment.cometchat.appId)
      .setRegion(environment.cometchat.region)
      .setAuthKey(environment.cometchat.authKey)   // dev only
      .subscribePresenceForAllUsers()
      .setCallingEnabled(true)                      // ← enable calls
      .build();
    return CometChatUIKit.init(settings);           // return Promise so bootstrap waits
  };
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    { provide: APP_INITIALIZER, useFactory: initCometChat, multi: true },
  ],
});
```

Login (dev user or production token) then runs in a route guard / auth service after init resolves — see `cometchat-angular-core` §4. The kit initializes the Calls SDK on login when `setCallingEnabled(true)` was set.

> NgModule app (not yet migrated to standalone)? You can still import these standalone component classes into an `@NgModule({ imports: [...] })`. You still do **not** need `CUSTOM_ELEMENTS_SCHEMA`.

### Assets

Calls icons come from the same kit asset bundle as chat — confirm the `angular.json` assets glob from `cometchat-angular-core` §2 is present, or call buttons render without icons.

---

## 3. Call components catalog

All are **standalone** — import the `*Component` class into the consuming component's `imports: []`. Selectors and bindings below are verified against `@cometchat/chat-uikit-angular@5.0.2` types.

| Class (import into `imports: []`) | Selector | Key bindings |
|---|---|---|
| `CometChatCallButtonsComponent` | `<cometchat-call-buttons>` | `@Input`: `user`, `group`, `callSettingsBuilder`, `hideVoiceCallButton`, `hideVideoCallButton`, `hideOverlays`, `outgoingCallDisableSoundForCalls`, `outgoingCallCustomSoundForCalls` · `@Input` callbacks: `onVoiceCallClick`, `onVideoCallClick`, `onError` · `@Output`: `error` |
| `CometChatIncomingCallComponent` | `<cometchat-incoming-call>` | `@Input`: `call`, `disableSoundForCalls`, `customSoundForCalls` · `@Input` callbacks: `onAccept`, `onDecline`, `onError` · `@Output`: `callAccepted`, `callDeclined`, `error` |
| `CometChatOutgoingCallComponent` | `<cometchat-outgoing-call>` | `@Input`: `call`, `disableSoundForCalls`, `customSoundForCalls` · `@Input` callback: `onError` · `@Output`: `callCanceled`, `error` |
| `CometChatOngoingCallComponent` | `<cometchat-ongoing-call>` | `@Input`: `sessionID`, `callSettingsBuilder`, `callWorkflow`, `isAudioOnly` · `@Input` callback: `onError` · `@Output`: `callEnded`, `error` |
| `CometChatCallLogsComponent` | `<cometchat-call-logs>` | `@Input`: `activeCall`, `callLogRequestBuilder`, `callSettingsBuilder`, `showScrollbar`, `callInitiatedDateTimeFormat`, `menuView`, plus template overrides (`itemView`, `leadingView`, `titleView`, `subtitleView`, `trailingView`, `loadingView`, `emptyView`, `errorView`) · `@Input` callback: `onError` · `@Output`: `itemClick`, `callButtonClicked` |

Notes:
- `callSettingsBuilder` is typed `typeof CometChatUIKitCalls.CallSettingsBuilder` — pass the **unbuilt builder instance** if you customize it; the kit calls `.build()` internally. Most integrations omit it and let the kit build defaults.
- **⚠️ Idle timeout is in MILLISECONDS** (Angular uses `@cometchat/calls-sdk-javascript` — the web family). The `SessionSettings` idle fields are **ms, not seconds**: `idleTimeoutPeriodBeforePrompt: 180` means **180 ms**, so a solo session shows the "Are you still there?" prompt and exits almost instantly on join. Use ms — `{ idleTimeoutPeriodBeforePrompt: 180_000, idleTimeoutPeriodAfterPrompt: 60_000 }` (the JS SDK defaults are 60_000 / 120_000; some docs surfaces list 180_000 for the before-prompt — either is fine; the load-bearing point is ms-not-seconds). The timer only runs while you're the **sole** participant. (Native Android/iOS/Flutter use **seconds** here — Angular/web/RN are the ms outliers.)
- `callWorkflow` on `<cometchat-ongoing-call>` is the `CallWorkflow` enum: `CallWorkflow.defaultCalling` (Chat-SDK signaling, the default) or `CallWorkflow.directCalling` (Calls-SDK direct). Import `CallWorkflow` from `@cometchat/chat-uikit-angular`.
- `<cometchat-message-header>` auto-renders call buttons when a `user`/`group` is set (it has its own `hideVoiceCallButton` / `hideVideoCallButton` / `voiceCallClick` / `videoCallClick`). Don't add a second `<cometchat-call-buttons>` next to it — see anti-pattern 2.
- **HMR/dev-server caveat (non-fatal):** on a Vite/webpack hot reload you may see `ERR_ALREADY_LOGGED_IN` in the console — the kit re-runs its calling init against a still-live session. It's harmless; a full page refresh clears it. Do NOT add retry/teardown logic to "fix" it.
- **Known interop issue — kit caller → custom-UI Angular receiver:** when a kit-initiated 1:1 call rings an Angular app that renders its OWN receiver UI (raw `CometChat.addCallListener`), `onIncomingCallReceived` may not fire (the server routes, but the listener stays silent — suspected stale-session/mixed-version interop). Reverse direction (Angular kit caller → kit receiver) is reliable. If you build a custom receiver surface, verify the listener attaches BEFORE any call can arrive, and prefer the kit's `<cometchat-incoming-call>` over a hand-rolled receiver until this is resolved.

---

## 4. Integration shapes

### 4a. Additive — calls on top of an existing v5 chat integration (most common)

When `cometchat-angular-core` chat is already wired. The skill:

1. Installs `@cometchat/calls-sdk-javascript@^5`.
2. Adds `.setCallingEnabled(true)` to the existing `UIKitSettingsBuilder` chain (rule 1.0). Optionally `.setCallAppSettings(...)`.
3. Mounts `<cometchat-incoming-call>` in `AppComponent` above `<router-outlet>` (rule 1.7) and imports `CometChatIncomingCallComponent`.
4. Lets `<cometchat-message-header>` render the call buttons automatically (a `user`/`group` is already bound on the messages screen), OR — on a custom contact/profile screen with no message header — drops a standalone `<cometchat-call-buttons [user]="user">`.
5. Optionally adds a `/calls` route hosting `<cometchat-call-logs>`.

```typescript
// contact-actions.component.ts (custom screen, no message header)
import { Component, Input } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCallButtonsComponent } from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-contact-actions",
  standalone: true,
  imports: [CometChatCallButtonsComponent],
  template: `
    <cometchat-call-buttons
      [user]="user"
      [onError]="handleError">
    </cometchat-call-buttons>
  `,
})
export class ContactActionsComponent {
  @Input() user!: CometChat.User;
  handleError = (e: CometChat.CometChatException) => console.error("call error", e);
}
```

### 4b. Standalone — calls is the product (no chat surface)

Same kit init + `setCallingEnabled(true)`, but no `<cometchat-conversations>` / `<cometchat-message-*>`. The skill scaffolds:

1. **Init + login** via `APP_INITIALIZER` with `setCallingEnabled(true)` (§2).
2. **A user-picker / contact screen** rendering `<cometchat-call-buttons [user]="selectedUser">` to start a call.
3. **`<cometchat-incoming-call>` in `AppComponent`** above `<router-outlet>` so the device rings (rule 1.7).
4. **`<cometchat-outgoing-call>`** is rendered by the kit's calling flow on initiate; you typically don't mount it manually unless driving a fully custom flow.
5. **A `/calls` route** with `<cometchat-call-logs (itemClick)="onLog($event)">` for history.
6. **`environment.ts`** credentials block (from `cometchat-angular-core`).
7. **HTTPS check** — warn if the dev server is HTTP non-localhost.

The kit's incoming/outgoing/ongoing components handle the WebRTC surface end-to-end; you do not call `joinSession` yourself on this path.

### 4c. Custom call screen with the raw Calls SDK (advanced)

Only when the user explicitly wants a fully custom in-call UI (custom controls/layout) instead of the kit's `<cometchat-ongoing-call>`. This uses the raw `@cometchat/calls-sdk-javascript` API directly — the **same JS Calls SDK surface documented in `cometchat-react-calls` §3** (`CometChat.initiateCall` for signaling, then `CometChatCalls.generateToken(sessionId)` → `CometChatCalls.joinSession(token, settings, htmlElement)` → `CometChatCalls.leaveSession()`). Angular specifics:

- The container `<div>` must be in the DOM with **non-zero dimensions** when `joinSession` runs. Gate it correctly:
  - **Preferred:** put the container in its own component and let the **parent** decide (via `@if`) whether to instantiate it. `ngAfterViewInit` then fires with the `@ViewChild` resolved — no `setTimeout(0)` needed.
  - If the container lives in the same component gated by an inner `@if (inCall())`, a microtask runs before Angular renders the block, so a `@ViewChild` read is still null — use a **full task tick** (`await new Promise(r => setTimeout(r, 0))`) before reading `nativeElement`.
- Wrap any Calls-SDK callback that mutates UI in `NgZone.run` (or drive state through signals) — rule 1.5.
- On hangup: `CometChatCalls.leaveSession()` then stop any custom `MediaStream` tracks (rule 1.3).
- Audio-only voice calls: set the Chat-SDK call type to audio for signaling AND `setIsAudioOnlyCall(true)` on the Calls-SDK `CallSettingsBuilder` used for `joinSession` — see `cometchat-react-calls` §4c.

Do NOT invent token-mint helpers: the v5 method is `CometChatCalls.generateToken(sessionId)` — auth is internal after login (the signature is `generateToken(sessionId, authToken?)`, but the optional second arg is only for explicit-token flows; omit it on the post-login path). There is no `getRTCToken` in v5.

---

## 5. Anti-patterns

1. **Forgetting `.setCallingEnabled(true)`.** Call components render but stay disabled; `CometChatUIKit.isCallingEnabled()` is `false`. (rule 1.0)
2. **Adding `<cometchat-call-buttons>` next to `<cometchat-message-header>`.** The header already renders call buttons when a `user`/`group` is bound — you get a duplicate set. Use the header's own `hideVoiceCallButton`/`hideVideoCallButton` or its `voiceCallClick`/`videoCallClick` instead. (rule 1.8 / §3)
3. **Skipping the `@cometchat/calls-sdk-javascript@^5` peer install.** Runtime "cannot find module" / calls never connect. (rule 1.1)
4. **Adding `CUSTOM_ELEMENTS_SCHEMA`.** v5 components are real Angular components — the schema is unnecessary and signals a v4 mental model. Import the `*Component` class into `imports: []` instead.
5. **Mounting `<cometchat-incoming-call>` inside a feature-route component.** Disappears on navigation; calls only ring on that route. Mount in `AppComponent`. (rule 1.7)
6. **Binding a call `@Input` callback as an `@Output`** (`(onAccept)`) **or an `@Output` as an `@Input`** (`[callAccepted]`). Silently does nothing — bind the form that exists. (rule 1.8)
7. **Calling the callback in the template** (`[onAccept]="handleAccept()"`). Pass a **reference** (`[onAccept]="handleAccept"`).
8. **Plain properties on `OnPush` components/services consumed by the template.** State set from outside the input/event surface never triggers change detection. Use signals. (rule 1.5)
9. **Manually calling `CometChatCalls.init`/`CometChatCalls.login` for the kit path.** The kit owns calls init when `setCallingEnabled(true)` is set — don't double-init. Manual `CometChatCalls.*` is only for the raw-SDK custom surface (§4c). (rule 1.0)
10. **Running over HTTP (non-localhost).** `getUserMedia` denies. Use HTTPS or `localhost` (`ng serve --ssl`). (rule 1.6)
11. **Init inside a lazy-loaded route.** Init must complete before any `<cometchat-*>` renders and before a call can arrive. Use `APP_INITIALIZER` (or gate on an `isReady` flag) — see `cometchat-angular-core` §3.

---

## 6. Verification checklist

**Static:**

- [ ] `@cometchat/calls-sdk-javascript@^5` in `package.json` (calls peer)
- [ ] `@cometchat/chat-uikit-angular@^5` in `package.json`
- [ ] `.setCallingEnabled(true)` on the `UIKitSettingsBuilder` chain
- [ ] `<cometchat-incoming-call>` in `AppComponent` template above `<router-outlet>`, and `CometChatIncomingCallComponent` in `AppComponent`'s `imports: []`
- [ ] Each call component class imported into the consuming standalone component's `imports: []` (no `CUSTOM_ELEMENTS_SCHEMA`)
- [ ] accept/decline/error bound as `@Input` callbacks (`[onAccept]="fn"`), or `@Output`s (`(callAccepted)="fn($event)"`) — the correct form per `cometchat-angular-components`
- [ ] Callback inputs pass a function **reference**, not a call (`[onAccept]="handleAccept"`)
- [ ] No second `<cometchat-call-buttons>` next to a `<cometchat-message-header>` that already shows them
- [ ] Init via `APP_INITIALIZER` (not a lazy route); `<cometchat-*>` gated until init+login resolve
- [ ] Template-observed state under `OnPush` is a `signal` / `async` pipe (not a plain property)
- [ ] `environment.ts` has `cometchat: { appId, region, authKey }` (dev) or token-endpoint config (prod)
- [ ] (§4c only) hangup path calls `CometChatCalls.leaveSession()` + stops custom `MediaStream` tracks
- [ ] Node version ≥ 20.19 or ≥ 22.12 (Angular CLI 17+ requirement)

**Runtime (browser):**

- [ ] Outgoing call connects, two-way audio + video
- [ ] Incoming call rings on a separate route within the same app
- [ ] Camera light off within ~2 seconds of hangup
- [ ] Route navigation during a call cleanly disconnects
- [ ] HTTPS or localhost only — `getUserMedia` works

## 7. Pointers

- `references/virtual-background.md` — blur / custom image / clear (web-only)
- `cometchat-angular-core` — `UIKitSettingsBuilder`, init/login order, `environment.ts`, theming
- `cometchat-angular-components` — full call-component binding tables (the `@Input`-callback-vs-`@Output` split)
- `cometchat-angular-patterns` — standalone wiring, route guards, NgZone, signals-under-OnPush
- `cometchat-angular-production` — server-minted auth tokens, user management
- `cometchat-angular-troubleshooting` — runtime failures, zone issues, SSR/Universal
- `cometchat-react-calls` — raw JS Calls SDK API surface (shared underlying SDK; §4c custom-surface reference)
