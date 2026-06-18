---
name: cometchat-angular-troubleshooting
description: "Diagnose CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) integration failures — peer-dep / Angular-version mismatch, standalone-import 'is not a known element', init-before-render race, assets config, height/layout, NgZone change-detection, CSS-variable theming, SSR 'window is not defined', and production auth-token errors."
license: "MIT"
compatibility: "Angular >=17 <22; @cometchat/chat-uikit-angular ^5.0; @cometchat/chat-sdk-javascript ^4.1"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular troubleshooting v5 standalone peer-deps assets height ssr ngzone css-variables auth-token"
---

## Purpose

Teaches Claude how to diagnose and fix CometChat **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`) integration failures. This is a symptom → cause → fix reference. v5 is **standalone-component-based, Angular 17–21** — there is no NgModule and no `CUSTOM_ELEMENTS_SCHEMA`. If you find yourself reaching for either, you are applying a v4 mental model.

**Read `cometchat-angular-core` first** — most "why doesn't this work" issues trace to the init / login / standalone-import order explained there.

Ground truth: `@cometchat/chat-uikit-angular@5.0.2` bundled types (`node_modules/@cometchat/chat-uikit-angular/types/cometchat-chat-uikit-angular.d.ts`), `docs/ui-kit/angular`, and first-hand failure modes from real v5 integrations. Verify any non-obvious symbol against the installed `.d.ts` before relying on it. **Official docs:** https://www.cometchat.com/docs/ui-kit/angular/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).

---

## 1. Triage — read project state before guessing

When the user reports a problem, gather facts before proposing a fix.

### 1a. Does the installed Angular version satisfy the kit's peer range?

```bash
node -e "console.log(require('@angular/core/package.json').version)"
npm ls @cometchat/chat-uikit-angular
```

UI Kit v5 declares `@angular/core` / `@angular/common` peers of `>=17.0.0 <22.0.0`. On Angular ≤16 the install warns (or errors under strict peers) and standalone-component imports fail at build time. Fix: upgrade Angular to 17–21.

### 1b. Are the assets configured in `angular.json`?

```bash
grep -A5 '"assets"' angular.json | grep cometchat
```

If missing, icons render as broken images. The required entry under `projects.<app>.architect.build.options.assets`:
```json
{ "glob": "**/*", "input": "./node_modules/@cometchat/chat-uikit-angular/src/lib/assets", "output": "assets/" }
```

### 1c. Is init complete before any `<cometchat-*>` component renders?

```bash
grep -rn "CometChatUIKit.init\|APP_INITIALIZER\|isReady" src/
```

Look for the init Promise resolved in `main.ts` before `bootstrapApplication(...)` (the v5 canonical — see `cometchat-angular-core` §3 / `cometchat-angular-patterns`), or wired into an `APP_INITIALIZER` factory (the alternative), or an `isReady` flag set after the init+login chain resolves. Components rendered before init completes produce blank output or a "CometChat is not initialized" console error.

### 1d. Is `UIKitSettingsBuilder` used (not a flat object), imported from the right package?

```bash
grep -rn "UIKitSettingsBuilder\|CometChatUIKit.init\|uikit-shared" src/
```

In v5 `UIKitSettingsBuilder` is exported from **`@cometchat/chat-uikit-angular`**. If you see an import from `@cometchat/uikit-shared` / `-elements` / `-resources`, that's a v4 package set that does not exist in v5 — it will fail to resolve. A flat object passed to `init()` (instead of a built `UIKitSettings`) also fails.

### 1e. Are the CometChat component classes imported into the standalone component that renders them?

```bash
# v5 exports class names with the `Component` suffix; selectors do not carry it.
grep -rnE "CometChat(Conversations|MessageList|MessageHeader|MessageComposer|Users|Groups|GroupMembers|CallButtons|IncomingCall|OutgoingCall|OngoingCall|CallLogs)Component" src/
```

Every `<cometchat-*>` tag requires its `*Component` class in the host **standalone component's** `imports: []`. There is no module to register them in, and no schema.

### 1f. Are the peer SDKs installed at the right major?

```bash
npm ls @cometchat/chat-sdk-javascript @cometchat/calls-sdk-javascript dompurify
```

Chat SDK must be `^4.1`, `dompurify` `^3` (both auto-pulled by npm 7+). Calls features additionally require `@cometchat/calls-sdk-javascript@^5` — installed explicitly.

---

## 2. Symptom → cause → fix lookup tables

### 2a. Install / peer-dependency / version

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm install` warns `ERESOLVE`/peer conflict on `@angular/core` | Angular ≤16 against v5's `>=17 <22` peer range | Upgrade Angular to 17–21 (the kit requires it) |
| `Cannot find module '@cometchat/uikit-shared'` (or `-elements`/`-resources`) | v4 package set referenced in v5 | Delete those imports — everything is in `@cometchat/chat-uikit-angular`. Import `UIKitSettingsBuilder` from there |
| Type error: kit components not recognized after install | Angular version too old for the kit's standalone API surface | Confirm Angular 17–21 (§1a) |
| Calls components present but calling never starts | `@cometchat/calls-sdk-javascript` not installed | `npm install @cometchat/calls-sdk-javascript@^5` + rebuild. See `cometchat-angular-calls` |

### 2b. "is not a known element" / template binding errors

| Symptom | Likely cause | Fix |
|---|---|---|
| `'cometchat-conversations' is not a known element` | The `*Component` class isn't in the host standalone component's `imports: []` | Import e.g. `CometChatConversationsComponent` from `@cometchat/chat-uikit-angular` into `imports: []`. (v5 does **not** use `CUSTOM_ELEMENTS_SCHEMA` — that was the v4 fix and is wrong here.) |
| `Can't bind to 'user' since it isn't a known property of 'cometchat-message-list'` | Same root cause — class not imported, so Angular treats the tag as an unknown element | Same fix: add the matching `*Component` to `imports: []` |
| Selector still unknown after adding `CUSTOM_ELEMENTS_SCHEMA` | Schema silences the error but the real component never loads → blank render | Remove the schema; import the class instead |
| `<cometchat-conversations-with-messages>` unknown | Composite removed in v5 | Compose `cometchat-conversations` + `cometchat-message-header`/`-list`/`-composer` yourself — see `cometchat-angular-placement` |

### 2c. Initialization + login

| Symptom | Likely cause | Fix |
|---|---|---|
| Components render nothing, no error | Rendered before `init()` resolved | Resolve `init()` in `main.ts` before `bootstrapApplication` (canonical), or block with an `APP_INITIALIZER` factory, or gate the container with `*ngIf="isReady"` set after init+login resolve |
| "CometChat is not initialized" in console | `<cometchat-*>` mounted before `init()` | Same as above — init must complete first |
| `getLoggedInUser()` returns `null` | Login never called, or session expired | Call `CometChatUIKit.login("cometchat-uid-1")` after init resolves |
| Login fails: "UID not found" | User doesn't exist in this app | Create via dashboard / SDK / REST API. Dev users `cometchat-uid-1` … `cometchat-uid-5` are pre-seeded in every new app |
| `login({ uid })` rejected / type error | v4 object-form argument | v5 takes a **bare string**: `CometChatUIKit.login("cometchat-uid-1")` |
| `CometChatUIKit.init()` fails silently | Invalid `appId` / `region` / `authKey` | Re-verify from dashboard → your app → Credentials |
| `TS2532: Object is possibly 'undefined'` on `CometChatUIKit.init(settings).then(...)` | v5 `init()` returns `Promise<InitResult> \| undefined`, so `.then()` on it fails strict-null type-check | Coalesce before chaining: `(CometChatUIKit.init(settings) ?? Promise.resolve()).then(...).catch(...)`. See `cometchat-angular-core`. |
| `ERR_ALREADY_LOGGED_IN` after a hot-reload (HMR) in dev | HMR re-runs the init/login effect while a session already exists | **Non-fatal** — guard it: check `CometChatUIKit.getLoggedInUser()` first and skip `login()` if a user is already present. Safe to ignore in dev; doesn't occur on a fresh load. |
| `CometChatUIKitLoginListener` is undefined / import fails | Phantom in v5 | Use `CometChatUIKit.getLoggedInUser()` (sync), `getLoggedinUser()` (async), or `loggedInUser$` (observable) |
| Production build ships the Auth Key | `authKey` in `environment.prod.ts` | Drop it; use server-minted auth tokens via `loginWithAuthToken(...)`. See `cometchat-angular-production` |

### 2d. Assets / icons

| Symptom | Likely cause | Fix |
|---|---|---|
| Icons show as broken images (404) | Missing assets glob in `angular.json` | Add the `@cometchat/chat-uikit-angular/src/lib/assets` entry to `build.options.assets` (§1b) |
| Icons broken only in production build | `output` path doesn't match prod output dir | Verify the `output` value resolves under your production `outputPath` |
| Icons still 404 after editing `angular.json` | Dev server cached the old config | Restart `ng serve` — `angular.json` is read at startup, not hot-reloaded |

### 2e. Layout / height

| Symptom | Likely cause | Fix |
|---|---|---|
| Conversation/message list renders empty | Container has no bounded height **and/or** the `<cometchat-*>` element wasn't made a flex column | The kit's `<cometchat-*>` elements are `display: inline` by default — they won't flex or fill on their own. Give the host a resolvable `height` (set `html, body { height: 100% }` globally so a `height: 100%` chain has a root), make the host `display: flex; flex-direction: column`, and make the element itself `display: flex; flex-direction: column`. See `cometchat-angular-placement` |
| Components collapse to 0 height | Parent is `display: block` with no height, or the inline custom element wasn't given `flex`/`display` | Use `display: flex; flex-direction: column; height: 100vh` (or `height: 100%`) on the parent; make the `<cometchat-*>` element `display: flex; flex-direction: column` |
| Message list doesn't scroll (overflows the viewport instead) | `min-height: 0` missing — a flex child defaults to `min-height: auto`, so it grows past the parent instead of scrolling inside it | Set `flex: 1; min-height: 0; overflow: hidden` on `cometchat-message-list`. The `min-height: 0` is the load-bearing part that lets the element shrink and scroll internally. See `cometchat-angular-placement` |
| Chat dialog too small | `MatDialog` opened with no size | Pass `{ width: '480px', height: '600px' }` to `MatDialog.open()` |
| Sidenav chat panel has no height | Sidenav content unconstrained | Add `height: 100%` / `height: 100vh` to the sidenav content |

### 2f. Change detection / NgZone

| Symptom | Likely cause | Fix |
|---|---|---|
| View doesn't update after an SDK callback (message arrives, presence flips) | SDK callbacks fire outside Angular's zone, so change detection never runs | Re-enter the zone: inject `NgZone` and wrap the state update in `this.zone.run(() => …)`, or `ChangeDetectorRef.detectChanges()`. See `cometchat-angular-patterns` |
| `loggedInUser$` subscription updates the field but template is stale | Same — emission may be outside the zone, and `OnPush` won't re-check | Use the `async` pipe (`loggedInUser$ | async`) so Angular tracks the subscription, or `cdr.markForCheck()` in the subscribe callback |
| `OnPush` component shows stale CometChat state | `OnPush` only re-checks on input change / event / observable | Drive the view from an observable via `async` pipe, or call `markForCheck()` after mutating state |

### 2g. Theming — CSS variables

| Symptom | Likely cause | Fix |
|---|---|---|
| No CometChat styling at all — components render unstyled / raw | `css-variables.css` never imported | Add it to the **`angular.json` → `build.options.styles` array** with the full path `node_modules/@cometchat/chat-uikit-angular/styles/css-variables.css` — NOT via a package-specifier `@import` in `styles.css` (that form fails the real `ng build` on Angular 17+/esbuild with "the path … is not exported by package", since the `exports` map only exposes `.`). The full `node_modules/...` path bypasses the exports map. See `cometchat-angular-core` §Assets and `cometchat-angular-theming`. |
| `Cannot find name 'CometChatThemeService'` / no provider | Phantom in v5 — there is no theme service | Theme with CSS variables; switch mode via `CometChatUIKit.themeMode = 'dark'`. See `cometchat-angular-theming` |
| `--cometchat-*` overrides have no effect | Declared inside a component with default `ViewEncapsulation` (Emulated) — scoped away from the kit's elements | Put global tokens in `styles.css` under `:root` (or scope under `.cometchat` for kit-only overrides), or use `::ng-deep` / `ViewEncapsulation.None` for component-scoped overrides |
| Component-level override (e.g. `.cometchat-conversations`) ignored | Selector missing the `.cometchat` parent scope | Scope under `.cometchat` — use `.cometchat .cometchat-conversations`, not the bare class. Kit class names aren't version-stable — verify the actual class in DevTools per version rather than memorizing it. |
| Dark mode doesn't switch | `themeMode` set once and never re-applied, or `data-theme="dark"` not on the wrapper | Re-assign `CometChatUIKit.themeMode` on the user's toggle (and ensure `data-theme="dark"` is set on the `.cometchat` wrapper / document element) |
| Custom color ignored | Not a valid CSS color string | Use `#hex` / `rgb()` / named colors |

### 2h. Components / bindings

| Symptom | Likely cause | Fix |
|---|---|---|
| Slot template (`[itemView]`, `[subtitleView]`, …) renders nothing | `@ViewChild`/`TemplateRef` accessed too early | Read it in `ngAfterViewInit`, not `ngOnInit` |
| Click/selection callback never fires | Bound as an `@Output` event when the kit expects an `@Input` callback (or vice-versa) | Match the binding to the kit's declaration — `@Input` callback uses `[onItemClick]="myFn"`; an `@Output` uses `(itemClick)="handler($event)"`. Confirm per-component in `cometchat-angular-components` |
| Clicking a conversation/user/group does nothing — list won't open a chat | `<cometchat-conversations>` auto-wiring expected, but the active chat surface isn't gated on `ChatStateService` (state-service mode), or props were never reassigned (props mode) | With no `(itemClick)` bound, the kit auto-calls `ChatStateService.setActiveConversation` (kit source: `itemClick.observed ? emit : setActiveConversation`) — gate your message pane on `chatState.activeUser()`/`activeGroup()`. If you bind `(itemClick)`, the auto-wiring is **suppressed** and you must drive selection yourself (props / `chatState.setActive*` / routing). See `cometchat-angular-placement` |
| `[user]` input has no effect | Passed a UID string instead of a `CometChat.User` | `const u = await CometChat.getUser(uid)` then pass `u` |
| Conversations list empty but data exists | Over-restrictive request builder | Check `[conversationsRequestBuilder]` filters (tags, types, limits) |

### 2i. Calling

| Symptom | Likely cause | Fix |
|---|---|---|
| Call buttons / call UI inert | `@cometchat/calls-sdk-javascript@^5` not installed, or calling not enabled | Install the peer; `new UIKitSettingsBuilder().setCallingEnabled(true)`. See `cometchat-angular-calls` |
| Incoming-call UI never shows | `<cometchat-incoming-call>` not mounted at app root, or its listener lives in a component that gets destroyed | Mount `<cometchat-incoming-call>` once in `AppComponent` (never destroyed) |
| Call listener fires twice | Listener registered in a re-created component | Register once at the app root |
| Camera/mic never prompts | `getUserMedia` blocked — insecure origin or denied permission | Serve over `https://` or `localhost`; check the browser site-permission for camera/mic |

### 2j. Production / auth tokens

| Symptom | Likely cause | Fix |
|---|---|---|
| `loginWithAuthToken(token)` fails: "user does not exist" | User not created in CometChat before minting the token | Create the user server-side via REST API in your signup flow. See `cometchat-angular-production` |
| Token endpoint returns 401 | Backend auth failing | Verify `Authorization: Bearer <jwt>` is attached to the `HttpClient` request |
| 429 on token endpoint | Minting too often (e.g. per component init) | Cache the token client-side, reuse until expiry |
| `loginWithAuthToken` "not a function" | Wrong API name | The v5 method is `CometChatUIKit.loginWithAuthToken(token)` (bare token string) |

### 2k. SSR / Angular Universal

| Symptom | Likely cause | Fix |
|---|---|---|
| `window is not defined` during SSR / prerender | The kit + SDK use browser-only APIs | Guard init/login with `isPlatformBrowser(this.platformId)`; only run CometChat in the browser. See `cometchat-angular-patterns` |
| `document is not defined` during SSR | Same cause | Same guard |
| `<cometchat-*>` errors on the server | Components touch browser APIs at render | Gate the tags with `*ngIf="isBrowser"`, where `isBrowser = isPlatformBrowser(platformId)` |

---

## 3. Deep dives on common failures

### 3a. "is not a known element" — the v5 standalone-import fix

v5 components are **standalone Angular components** (not generic web components). The fix is to import the component **class** into the host standalone component's `imports: []` — never `CUSTOM_ELEMENTS_SCHEMA`:

```typescript
import { Component } from "@angular/core";
import { CometChatConversationsComponent } from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-chat",
  standalone: true,
  imports: [CometChatConversationsComponent],   // ← register the class you render
  template: `<cometchat-conversations></cometchat-conversations>`,
})
export class ChatComponent {}
```

- The class carries the `Component` suffix (`CometChatConversationsComponent`); the selector does not (`<cometchat-conversations>`).
- Import only the components you actually use.
- If you add `CUSTOM_ELEMENTS_SCHEMA`, Angular stops complaining but the real component never instantiates — you get a blank render instead of an error. Remove it and import the class.
- On a not-yet-migrated NgModule app, standalone classes can go into `@NgModule({ imports: [...] })` — still no schema.

### 3b. The most common "why is my chat blank" bug — inline elements + bounded height

The kit's `<cometchat-*>` elements are **`display: inline` by default** — they do not flex, fill, or scroll on their own. Two things are load-bearing: (1) the host is a flex column with a resolvable height, and (2) each custom element is itself made a flex column. A parent with no bounded height — or an element left inline — renders the list at 0px or makes it overflow instead of scroll.

```bash
grep -rB5 "cometchat-message-list\|cometchat-conversations" src/app
```

Broken:
```html
<!-- ✗ div has no height; element left inline -->
<div>
  <cometchat-message-list [user]="selectedUser"></cometchat-message-list>
</div>
```

Fixed:
```html
<!-- ✓ host is a flex column with height; element made a flex column with min-height: 0 -->
<div style="height: 100vh; display: flex; flex-direction: column;">
  <cometchat-message-list
    [user]="selectedUser"
    style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;"
  ></cometchat-message-list>
</div>
```

- `min-height: 0` is the part everyone forgets: a flex child defaults to `min-height: auto`, so without it the list grows past the parent and overflows the viewport instead of scrolling internally.
- The `height: 100%` chain needs a root — set `html, body { height: 100% }` in global styles, otherwise `height: 100%` resolves against an auto-height ancestor and collapses.
- See `cometchat-angular-placement` for the full sidebar / two-pane / Material-tab host contracts.

### 3c. Components render before init completes

Most reliable fix — resolve `CometChatUIKit.init(...)` in `main.ts` **before** `bootstrapApplication(...)` so nothing mounts until the SDK is ready (the v5 canonical — see `cometchat-angular-core` §3 and `cometchat-angular-patterns`):

```typescript
// main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { UIKitSettingsBuilder, CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { environment } from "./environments/environment";
import { App } from "./app/app";
import { appConfig } from "./app/app.config";

const settings = new UIKitSettingsBuilder()
  .setAppId(environment.cometchat.appId)
  .setRegion(environment.cometchat.region)
  .setAuthKey(environment.cometchat.authKey)
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(settings)
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error("CometChat init failed:", err));
```

Alternative — block bootstrap with an `APP_INITIALIZER` factory that returns the init Promise (Angular waits for it before mounting):

```typescript
// providers: [{ provide: APP_INITIALIZER, useFactory: () => () => CometChatUIKit.init(settings), multi: true }]
```

If you don't want to block bootstrap, init in `AppComponent.ngOnInit()` and gate the outlet:

```typescript
isReady = false;

ngOnInit(): void {
  const settings = /* UIKitSettingsBuilder … .build() */;
  CometChatUIKit.init(settings)
    .then(() => CometChatUIKit.getLoggedinUser())
    .then((user) => user || CometChatUIKit.login("cometchat-uid-1"))  // bare string
    .then(() => (this.isReady = true))
    .catch(console.error);
}
```

```html
<ng-container *ngIf="isReady">
  <router-outlet></router-outlet>
</ng-container>
```

### 3d. View not updating after an SDK callback (NgZone)

CometChat SDK listeners fire outside Angular's zone, so a field you mutate in a callback won't trigger change detection. Re-enter the zone (or prefer the `async` pipe over `loggedInUser$`):

```typescript
import { NgZone } from "@angular/core";

constructor(private zone: NgZone) {}

// inside an SDK listener callback:
this.zone.run(() => {
  this.latestMessage = message;   // now change detection runs
});
```

Idiomatic alternative — bind the observable directly so Angular owns the subscription:

```html
<span *ngIf="uiKit.loggedInUser$ | async as user">{{ user.getName() }}</span>
```

### 3e. `ng build` warns "Module '@cometchat/chat-sdk-javascript' … is not ESM" — benign

A successful `ng build` emits a **CommonJS-interop optimization-bailout WARNING** for `@cometchat/chat-sdk-javascript` (the chat SDK is published as CommonJS, not ESM). This is **harmless** — the build still exits 0 and the kit works. Do NOT try to "fix" it by switching SDK imports around. If you want to silence it, add the package to `angular.json` → `architect.build.options.allowedCommonJsDependencies`:

```json
"allowedCommonJsDependencies": ["@cometchat/chat-sdk-javascript"]
```

(Verified 2026-06-14: fresh Angular 21 + `@cometchat/chat-uikit-angular@5.0.2` build succeeds with only this warning.)

---

## 4. Escalation — when the above doesn't solve it

1. **Read the raw error.** "is not a known element" (missing standalone import) is a different problem from "NullInjectorError" (DI) or "window is not defined" (SSR).
2. **Check the browser console + Angular DevTools.** DevTools shows the component tree and change-detection state — useful for the NgZone class of bugs.
3. **Confirm versions:** Angular 17–21, `@cometchat/chat-uikit-angular@^5`, `@cometchat/chat-sdk-javascript@^4.1`, and `@cometchat/calls-sdk-javascript@^5` for calls.
4. **Search the upstream docs MCP** (`cometchat-docs` if installed) for prop/event/error meanings.
5. **If it's a kit bug**, file at https://github.com/cometchat/cometchat-uikit-angular/issues with a minimal standalone-component repro.

---

## 5. Hard rules (diagnostic best-practice)

1. **Triage first (§1):** Angular version, assets config, init/render order, standalone imports, peer SDKs — before proposing a fix.
2. **Never suggest `CUSTOM_ELEMENTS_SCHEMA`** for an unknown `<cometchat-*>` element — the v5 fix is importing the `*Component` class into `imports: []`.
3. **Never suggest `CometChatThemeService`, `CometChatUIKitLoginListener`, `login({ uid })`, or `@cometchat/uikit-shared`** — all are v4 and absent in v5.
4. **Don't lead with "reinstall node_modules."** Check version/peers, assets, init order, and imports first.
5. **When recommending a rebuild/restart, say what and why** — e.g. "restart `ng serve` after editing `angular.json` (read at startup)."
6. **Don't propose code changes before gathering facts.**

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Most "doesn't work" bugs trace here — init/login/standalone setup |
| `cometchat-angular-components` | Wrong input / `@Input`-callback vs `@Output` / slot template / request builder |
| `cometchat-angular-placement` | Blank chat / bounded-height / two-pane composition |
| `cometchat-angular-patterns` | Standalone wiring, route guard, lazy loading, SSR guard, NgZone |
| `cometchat-angular-theming` | CSS variables not applying, dark mode, ViewEncapsulation |
| `cometchat-angular-features` | Extension UI missing after enable |
| `cometchat-angular-calls` | Calls don't start, incoming-call UI, calls-sdk peer |
| `cometchat-angular-customization` | Formatter not rendering, listener not firing, template not showing |
| `cometchat-angular-production` | 401 on token fetch, user-does-not-exist on token login |
| `cometchat-angular-troubleshooting` | This skill — cross-category v5 diagnosis |
