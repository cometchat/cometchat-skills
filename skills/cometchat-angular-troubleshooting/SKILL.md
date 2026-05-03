---
name: cometchat-angular-troubleshooting
description: "Diagnose CometChat Angular UI Kit v4 integration failures — init/login, CUSTOM_ELEMENTS_SCHEMA, assets config, module imports, height/layout issues, Angular Universal SSR, v3-to-v4 upgrade, and production auth errors."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular troubleshooting schema assets module height ssr upgrade"
---

## Purpose

Teaches Claude how to diagnose and fix CometChat Angular UI Kit v4 integration failures. Covers every category of failure across NgModule and standalone component setups, with an up-front triage flow so Claude asks the right questions before assuming a fix.

**Read `cometchat-angular-core` first** — most "why doesn't this work" issues trace to the init/login/module setup explained there.

Ground truth: `docs/ui-kit/angular/troubleshooting`, `docs/ui-kit/angular/getting-started`, and first-hand failure modes from real integrations.

---

## 1. Triage — read project state before guessing

When the user reports a problem, gather facts before proposing a fix.

### 1a. Is `CUSTOM_ELEMENTS_SCHEMA` in every module that uses `<cometchat-*>` tags?

```bash
grep -r "CUSTOM_ELEMENTS_SCHEMA" src/
```

If missing from any module or standalone component that uses `<cometchat-*>` tags, Angular throws "Unknown element" errors. Every module/component needs it independently.

### 1b. Are the assets configured in `angular.json`?

```bash
grep -A5 '"assets"' angular.json | grep cometchat
```

If missing, icons render as broken images. The required entry:
```json
{ "glob": "**/*", "input": "./node_modules/@cometchat/chat-uikit-angular/assets/", "output": "assets/" }
```

### 1c. Is init complete before any `<cometchat-*>` component renders?

```bash
grep -n "CometChatUIKit.init\|isReady\|APP_INITIALIZER" src/app/app.component.ts
```

Look for the init promise + `isReady` flag or `APP_INITIALIZER`. Components rendered before init completes produce blank output.

### 1d. Is `UIKitSettingsBuilder` used (not a flat object)?

```bash
grep -n "UIKitSettingsBuilder\|CometChatUIKit.init" src/
```

Angular requires `UIKitSettingsBuilder` from `@cometchat/uikit-shared`. A flat object passed to `init()` fails silently or throws a type error.

### 1e. Are CometChat components imported in the module?

```bash
grep -n "CometChatConversations\|CometChatMessages\|CometChatMessageList" src/app/app.module.ts
```

Every `<cometchat-*>` component must be imported in the module (or standalone component) where it's used.

### 1f. Is `BrowserAnimationsModule` imported?

```bash
grep "BrowserAnimationsModule" src/app/app.module.ts
```

Missing `BrowserAnimationsModule` causes runtime errors in components that use Angular animations.

---

## 2. Symptom → fix lookup tables

### 2a. Initialization + login

| Symptom | Likely cause | Fix |
|---|---|---|
| Components render nothing after login | `init()` not awaited before mount | Use `*ngIf="isReady"` on the container; set `isReady = true` after init + login resolve |
| Blank screen, no errors | Component rendered before init completed | Gate with `*ngIf="isReady"` |
| `getLoggedinUser()` returns `null` | Login not called or session expired | Call `CometChatUIKit.login({ uid })` after init resolves |
| Login fails: "UID not found" | User doesn't exist in CometChat | Create via dashboard, SDK, or REST API. For dev, use `cometchat-uid-1` through `cometchat-uid-5` |
| `CometChatUIKit.init()` fails silently | Invalid `APP_ID` / `REGION` / `AUTH_KEY` | Re-verify from dashboard → your app → Credentials |
| `UIKitSettingsBuilder is not a constructor` | Imported from wrong package | Import from `@cometchat/uikit-shared`, not `@cometchat/chat-uikit-angular` |
| Production build exposes Auth Key | Using `authKey` in `environment.prod.ts` | Switch to server-minted auth tokens. See `cometchat-angular-production` |

### 2b. Module / schema errors

| Symptom | Likely cause | Fix |
|---|---|---|
| `'cometchat-conversations' is not a known element` | Missing `CUSTOM_ELEMENTS_SCHEMA` | Add `schemas: [CUSTOM_ELEMENTS_SCHEMA]` to the module or standalone component |
| `'cometchat-conversations' is not a known element` (even with schema) | Component not imported in the module | Import `CometChatConversations` from `@cometchat/chat-uikit-angular` in the module's `imports` array |
| `Can't bind to 'user' since it isn't a known property` | Component not imported | Same fix — import the component in the module |
| `NullInjectorError: No provider for CometChatThemeService` | `CometChatThemeService` not available | It's `providedIn: 'root'` — ensure `AppModule` is the root module. If using standalone bootstrap, ensure `provideAnimations()` is in providers. |
| `BrowserAnimationsModule` error | Missing animation module | Add `BrowserAnimationsModule` to `AppModule` imports |

### 2c. Assets / icons

| Symptom | Likely cause | Fix |
|---|---|---|
| Icons show as broken images (404) | Missing assets config in `angular.json` | Add the glob entry for `@cometchat/chat-uikit-angular/assets/` to `build.options.assets` |
| Icons broken only in production build | Assets config present but `outputPath` differs | Verify the `output` path in the assets config matches your production output directory |
| Icons broken after `ng build` | Assets not copied during build | Run `ng build` again after adding the assets config; check `dist/assets/` for the icon files |

### 2d. Layout / height issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Conversation list / message list renders empty | Container has no bounded height | Wrap in `<div style="height: 100vh;">` or `<div style="flex: 1; overflow: hidden;">` |
| Components collapse to zero height | Parent is a `display: block` with no height | Use `display: flex; flex-direction: column; height: 100vh` on the parent |
| Message list doesn't scroll | Container doesn't have `overflow: hidden` | Add `overflow: hidden` to the message list's container; the component handles its own internal scroll |
| Chat dialog too small | Angular Material dialog has no explicit size | Set `width` and `height` on the dialog container or pass `{ width: '480px', height: '600px' }` to `MatDialog.open()` |
| Sidebar chat panel has no height | Sidenav content has no height constraint | Add `height: 100%` or `height: 100vh` to the sidenav content |

### 2e. Angular Router integration

| Symptom | Likely cause | Fix |
|---|---|---|
| Chat route shows blank | CometChat init not complete when route activates | Use `APP_INITIALIZER` or a route guard that waits for init |
| `window.location.reload()` after login breaks routing | Anti-pattern — reload destroys Angular state | Use `this.router.navigate(['/chat'])` instead |
| Lazy-loaded chat module fails to init | `CometChatUIKit.init()` called inside the lazy module | Move init to `APP_INITIALIZER` at the root level |
| Route guard `canActivate` always returns false | `getLoggedinUser()` called before init | Ensure init completes before the guard runs (use `APP_INITIALIZER`) |

### 2f. Theming

| Symptom | Likely cause | Fix |
|---|---|---|
| Theme overrides don't apply | `setPrimary()` called in `ngOnInit` instead of constructor | Move to constructor — palette must be set before first render |
| Dark mode doesn't switch | `setMode()` called once but not reactive | Call `setMode()` again when the user toggles; the service is reactive |
| Custom color shows as default | Color not a valid CSS color string | Use valid CSS color values (`#hex`, `rgb()`, named colors) |
| `[conversationsStyle]` input has no effect | Style object not instantiated with `new ConversationsStyle({...})` | Use `new ConversationsStyle({...})` — don't pass a plain object |

### 2g. Components

| Symptom | Likely cause | Fix |
|---|---|---|
| Slot view (`[listItemView]`, `[subtitleView]`, etc.) renders nothing | `@ViewChild` reference not resolved yet | Ensure `@ViewChild` is accessed after `ngAfterViewInit`, not `ngOnInit` |
| `[onItemClick]` callback not firing | Wrong binding syntax — using round brackets | Use `[onItemClick]="myFn"` (square brackets, Input callback), never `(onItemClick)="myFn($event)"` (round brackets) |
| `[user]` input has no effect | Passing a UID string instead of `CometChat.User` instance | `await CometChat.getUser(uid)` first, pass the resolved object |
| Conversations list empty but data exists | Wrong request builder filters | Check `[conversationsRequestBuilder]` filters (tags, types, limits) |
| "Reply in Thread" option does nothing | Thread panel not wired | Wire `[onThreadRepliesClick]="myFn"` on `<cometchat-message-list>` and render a thread panel — see `cometchat-angular-components` § 11 |
| `[onError]` callback fires with "not initialized" | Component rendered before init | Gate with `*ngIf="isReady"` |

### 2h. Calling

| Symptom | Likely cause | Fix |
|---|---|---|
| Call buttons missing | `@cometchat/calls-sdk-javascript` not installed | `npm install @cometchat/calls-sdk-javascript` + rebuild |
| Incoming call UI doesn't show | `<cometchat-incoming-call>` not mounted or listener not registered | Register `CometChat.addCallListener(...)` in `AppComponent.ngOnInit` and mount `<cometchat-incoming-call>` at the app root |
| Call listener fires twice | Listener registered in a component that gets destroyed and re-created | Move listener registration to `AppComponent` (root, never destroyed) |

### 2i. Extensions

| Symptom | Likely cause | Fix |
|---|---|---|
| Polls option missing from composer | Extension not enabled in dashboard | `cometchat features enable polls --json` or toggle in dashboard → Features |
| Extension enabled but UI doesn't appear | Cached session — hard reload needed | Stop `ng serve`, clear browser cache, restart |
| Extension says enabled but `auto_wired_in_uikit: false` | Needs `.setExtensions([...])` on `UIKitSettingsBuilder` | Add `new PollsExtension()` etc. to the builder — see `cometchat-angular-features` § 2 |

### 2j. Production / auth tokens

| Symptom | Likely cause | Fix |
|---|---|---|
| `login({ authToken })` fails: "user does not exist" | User not created in CometChat before token mint | Create user server-side via REST API on your signup flow. See `cometchat-angular-production` § 6 |
| Token endpoint returns 401 | Backend auth check failing | Verify `Authorization: Bearer <jwt>` header is attached to the Angular `HttpClient` request |
| 429 rate limit on token endpoint | Minting tokens too often (e.g. per component init) | Cache client-side, reuse until expiry |
| `CometChatUIKit.loginWithAuthToken` not found | Wrong API name | It's `CometChatUIKit.login({ authToken })` — same method as dev, different key |

### 2k. SSR / Angular Universal

| Symptom | Likely cause | Fix |
|---|---|---|
| `window is not defined` during SSR | CometChat uses browser APIs | Guard with `isPlatformBrowser(platformId)` — see `cometchat-angular-patterns` § 7 |
| `document is not defined` during SSR | Same cause | Same fix |
| Components render on server but throw | CometChat components use browser APIs | Wrap `<cometchat-*>` tags with `*ngIf="isBrowser"` |

---

## 3. Deep dives on common failures

### 3a. "The most common 'why is my chat blank' bug"

CometChat components fill 100% of their parent's height. If the parent has no bounded height, the components render at 0px and look empty.

Diagnostic:

```bash
# Check the parent container of the CometChat component
grep -B5 "cometchat-message-list\|cometchat-conversations" src/app/**/*.html
```

Look for the component's parent. One of these must be true:
- Parent has `height: 100vh` or `height: 100%`
- Parent is a flex column with the component getting `flex: 1`
- Parent has an explicit `height: Npx`

Broken example:
```html
<!-- ✗ WRONG — div has no height -->
<div>
  <cometchat-message-list [user]="selectedUser"></cometchat-message-list>
</div>
```

Fixed:
```html
<!-- ✓ RIGHT -->
<div style="height: 100vh; display: flex; flex-direction: column;">
  <cometchat-message-list
    [user]="selectedUser"
    style="flex: 1; overflow: hidden;"
  ></cometchat-message-list>
</div>
```

### 3b. "Unknown element" errors for `<cometchat-*>` tags

Two separate fixes are both required:

1. **Import the component** in the module's `imports` array:
   ```typescript
   import { CometChatConversations } from "@cometchat/chat-uikit-angular";
   @NgModule({ imports: [CometChatConversations] })
   ```

2. **Add `CUSTOM_ELEMENTS_SCHEMA`** to the module's `schemas`:
   ```typescript
   import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
   @NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })
   ```

Both are required. Missing either one produces the "Unknown element" error.

### 3c. Components render before init completes

The most reliable fix is `APP_INITIALIZER` (see `cometchat-angular-patterns` § 1). If not using `APP_INITIALIZER`, use `*ngIf="isReady"`:

```typescript
// app.component.ts
isReady = false;

ngOnInit(): void {
  CometChatUIKit.init(settings)
    .then(() => CometChatUIKit.getLoggedinUser())
    .then((user) => user || CometChatUIKit.login({ uid: "cometchat-uid-1" }))
    .then(() => (this.isReady = true))
    .catch(console.error);
}
```

```html
<!-- app.component.html -->
<ng-container *ngIf="isReady">
  <router-outlet></router-outlet>
</ng-container>
```

---

## 4. v3 → v4 upgrade gotchas

If the user is upgrading from `@cometchat/chat-uikit-angular@3`, these are the common breakages.

| v3 | v4 | Notes |
|---|---|---|
| `CometChatTheme` class | `CometChatThemeService` (Angular DI) | Theme is now an injectable service |
| `CometChatConversationsWithMessages` composite | Still available but configuration API changed | Check `[conversationsConfiguration]` + `[messagesConfiguration]` props |
| `theme` prop on components | Theme via `CometChatThemeService` only | Per-component theme prop removed |
| `onClick` callback names | `onItemClick` callback names | Renamed for consistency |
| `CometChat.login(uid, authKey)` | `CometChatUIKit.login({ uid })` | Object-form argument |
| Flat settings object | `UIKitSettingsBuilder` | Builder pattern required |

### Upgrade sequence

```bash
# 1. Update the main kit
npm install @cometchat/chat-uikit-angular@latest

# 2. Update peer packages
npm install @cometchat/uikit-elements@latest @cometchat/uikit-resources@latest @cometchat/uikit-shared@latest

# 3. Replace flat settings object with UIKitSettingsBuilder
# 4. Replace CometChatTheme class with CometChatThemeService injection
# 5. Rename onClick → onItemClick throughout templates
# 6. Add CUSTOM_ELEMENTS_SCHEMA to all modules (new requirement in v4)
# 7. Add assets config to angular.json (new requirement in v4)
# 8. Rebuild + test
```

---

## 5. Escalation — when the above doesn't solve it

1. **Read the raw error.** Angular errors are usually specific — "Can't bind to 'user'" is different from "NullInjectorError".
2. **Check the browser console + Angular DevTools.** Angular DevTools shows the component tree and change detection state.
3. **Search the upstream docs MCP** (`cometchat-docs` if installed).
4. **If the issue is a kit bug**, file at https://github.com/cometchat/cometchat-uikit-angular/issues with a minimal repro.

---

## 6. Hard rules (diagnostic best-practice)

1. **Don't assume — triage first.** § 1 gets the schema, assets, init state, and module imports before proposing a fix.
2. **Don't suggest "try reinstalling node_modules" as a first step.** Check the schema, assets config, and module imports first.
3. **When recommending a rebuild, say why + what to rebuild.** "`ng build` after adding assets config" is more useful than "try rebuilding."
4. **Never guess a fix that requires code changes without first gathering facts.**

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Most "doesn't work" bugs trace back here — init/login/module setup |
| `cometchat-angular-components` | Wrong input / slot view / request builder |
| `cometchat-angular-placement` | Blank chat / bounded-height issues |
| `cometchat-angular-patterns` | Route guard, lazy loading, SSR, APP_INITIALIZER |
| `cometchat-angular-theming` | Theme not applying, dark mode not switching |
| `cometchat-angular-features` | Calls don't work, extension UI missing after enable |
| `cometchat-angular-customization` | Formatter not rendering, listener not firing, template not showing |
| `cometchat-angular-production` | 401 on token fetch, user-does-not-exist on login |
| `cometchat-angular-troubleshooting` | This skill — cross-category diagnosis + v3→v4 upgrade |
