---
name: cometchat-angular-core
description: "Foundational rules for CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) — standalone-component setup, UIKitSettingsBuilder init, Promise-based login (bare uid string), loggedInUser$ observable, environment config, CSS-variable theming, and the anti-patterns that break real Angular apps. Read this first."
license: "MIT"
compatibility: "Angular >=17.0.0 <22.0.0 (standalone APIs); @cometchat/chat-uikit-angular ^5.0 (5.0.3 verified — file-based initFromSettings GA); @cometchat/chat-sdk-javascript ^4.1.11; @cometchat/calls-sdk-javascript ^5.0 (optional peer — calls only); dompurify ^3"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular typescript core init login standalone uikit environment provider v5"
---

## Purpose

Foundational skill for every CometChat **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`) integration. It teaches HOW CometChat works in Angular v5 — initialization order, the `UIKitSettingsBuilder` pattern, login, environment config, **standalone-component** wiring, and the anti-patterns that break real apps.

**Angular UI Kit v5 is standalone-component-based and requires Angular 17–21.** This is a hard requirement — the package's peer range is `@angular/core` / `@angular/common` `>=17.0.0 <22.0.0`. Projects on older Angular must upgrade before using UI Kit v5.

**Read this skill first, before any placement, components, or patterns skill.**

Ground truth: `@cometchat/chat-uikit-angular@5.0.3` kit source (`projects/cometchat-uikit/src/lib`) + `docs/ui-kit/angular`. **Official docs:** https://www.cometchat.com/docs/ui-kit/angular/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify any non-obvious symbol against the installed package types before relying on it.

---

## 2. Install

```bash
npm install @cometchat/chat-uikit-angular@^5
# Calls features only — also install the calls SDK peer:
npm install @cometchat/calls-sdk-javascript@^5
```

> ⚠️ **Angular 22 is NOT supported — pin the CLI to 21 when scaffolding (verified — real `npm install` ERESOLVE).** The kit's peer range is `@angular/core`/`@angular/common` `>=17.0.0 <22.0.0`. `npx @angular/cli@latest new …` now installs Angular **22**, so `npm install @cometchat/chat-uikit-angular@^5` then hard-fails with `ERESOLVE … peer @angular/common@">=17.0.0 <22.0.0"`. For a fresh project scaffold with a supported major: `npx -y @angular/cli@21 new <app> …` (Angular 17–21 all work). Existing projects on 22 must stay on the prior major until the kit widens its range.

> ⚠️ **`ng build` (production) fails the default bundle budget — raise it.** The kit's initial bundle is ~3.78 MB; Angular's default production `budgets` cap `initial` at 1 MB `maximumError`, so the literal `ng build` exits non-zero with `bundle initial exceeded maximum budget`. In `angular.json` raise (or remove) the `initial` budget — e.g. set `maximumError` to `5mb` — or build with `--configuration development` while iterating. This is a guaranteed failure otherwise; it is not a problem with your code.

The chat SDK (`@cometchat/chat-sdk-javascript@^4.1.8`), `dompurify@^3`, and (for calls only) the calls SDK are peer deps. `@cometchat/calls-sdk-javascript` is an **optional** peer — npm won't auto-install it; add it yourself when you need calling. There is **no** `@cometchat/uikit-shared` / `-elements` / `-resources` in v5 — do not install or import them.

### Stylesheet (mandatory — layout + tokens break without it)

Add the kit's CSS-variable stylesheet via `angular.json` → `...build.options.styles` (**use this form** — it's the one that builds):

```json
"styles": [
  "src/styles.css",
  "node_modules/@cometchat/chat-uikit-angular/styles/css-variables.css"
]
```

> ⚠️ **Do NOT use the `@import` package-specifier form on Angular 17+** (the default `@angular/build` esbuild builder). `@import '@cometchat/chat-uikit-angular/styles/css-variables.css';` fails the build — `Could not resolve … the path "./styles/css-variables.css" is not exported by package` — because the package `exports` map only exposes `.` and `./package.json`. The `angular.json` `styles` array above works because the full `node_modules/...` path bypasses the exports map. (Verified — real `ng build`.)

### Assets (mandatory — icons break without it)

`angular.json` → `projects.<app>.architect.build.options.assets`:

```json
{
  "glob": "**/*",
  "input": "node_modules/@cometchat/chat-uikit-angular/src/lib/assets",
  "output": "assets"
}
```

The kit ships its SVG icons under `src/lib/assets` in the published package — map that to `output: assets`. Missing this = broken icons throughout the kit. It's the most commonly missed step.

---

## 3. The init → login → render order

CometChat Angular has exactly one valid lifecycle:

```
CometChatUIKit.init(UIKitSettings)  →  CometChatUIKit.login(uid)  →  render <cometchat-*> components
```

Both `init()` and `login()` return **Promises**. Breaking this order produces a blank component, a "CometChat is not initialized" console error, or a hung login.

### File-based init with `cometchat-settings.json` (recommended where available)

> **Version requirement (ENG-35866 — Skills Telemetry).** `CometChatUIKit.initFromSettings(settings)` reads a `cometchat-settings.json` object and lets the SDK self-report `integrationSource = "ai-agent"`. It ships GA in **`@cometchat/chat-uikit-angular >= 5.0.3`** + **`@cometchat/chat-sdk-javascript >= 4.1.11`** (npm `latest`). On an older kit (`<= 5.0.2`) the method does not exist — only the `UIKitSettingsBuilder` + `init()` path below works (reporting `integrationSource = "manual"`); use that fallback. (The kit routes `initFromSettings` to the SDK's `CometChat.initFromSettings`, which stamps `ai-agent` — plain `init(settings)` does not; ENG-36203.)

**Step 1 — create `cometchat-settings.json` at the project root** (e.g. alongside `angular.json`). Fill `appId` / `region` / `credentials.authKey` from the CLI `provision setup` output; leave the rest at the defaults:

```json
{
  "appId": "APP_ID_HERE",
  "region": "us",
  "credentials": {
    "authKey": "AUTH_KEY_HERE"
  },
  "chatSDK": {
    "presenceSubscription": {
      "type": "ALL_USERS",
      "roles": []
    },
    "autoEstablishSocketConnection": true,
    "adminHost": null,
    "clientHost": null
  },
  "callsSDK": {
    "host": null,
    "adminHost": null,
    "clientHost": null,
    "callsHost": null
  },
  "uiKit": {
    "subscribePresenceForAllUsers": true
  }
}
```

**Step 2 — init in `main.ts` by importing the JSON.** Angular CLI projects have `resolveJsonModule: true` by default, so the import is type-safe:

```typescript
// main.ts — initFromSettings ships GA in @cometchat/chat-uikit-angular >= 5.0.3 (ENG-35866)
import { bootstrapApplication } from "@angular/platform-browser";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import cometchatSettings from "../cometchat-settings.json";

CometChatUIKit.initFromSettings(cometchatSettings)
  .then(() => bootstrapApplication(AppComponent, appConfig))
  .catch((err) => console.error("CometChat init failed:", err));
```

- **Commit `cometchat-settings.json` — do not gitignore it** (the file is part of the integration). Its `authKey` is an **optional demo/POC credential**: a quick-start affordance so a PM or developer can see working chat *before* the backend auth-token flow is wired (that flow often waits on internal approvals). Because the file is committed to source control, treat the key as public — use a **dedicated demo CometChat app** (a committed key trips secret scanners and stays in git history; never reuse a production app's key). Switch to a server-minted `authToken` via `loginWithAuthToken` before production, where `authKey` must not ship.

### UIKitSettingsBuilder — the init pattern (fallback — published kit; reports `manual`)

`UIKitSettingsBuilder` and `UIKitSettings` are exported from **`@cometchat/chat-uikit-angular`** (not `uikit-shared`, which no longer exists):

```typescript
import { UIKitSettingsBuilder, CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { environment } from "../environments/environment";

const settings = new UIKitSettingsBuilder()
  .setAppId(environment.cometchat.appId)
  .setRegion(environment.cometchat.region)          // "us" | "eu" | "in"
  .setAuthKey(environment.cometchat.authKey)        // dev only — omit in production
  .subscribePresenceForAllUsers()
  .build();

const initPromise = CometChatUIKit.init(settings);   // Promise<InitResult> | undefined
```

> `init()` returns `Promise<InitResult> | undefined` (it returns `undefined` if settings are missing/invalid). Guard for the `undefined` case rather than blindly `.then()`-ing the result.

Builder methods (verified against v5 `UIKitSettings.ts`): `setAppId`, `setRegion`, `setAuthKey`, `subscribePresenceForAllUsers`, `subscribePresenceForFriends`, `subscribePresenceForRoles(roles)`, `setRoles(roles)`, `setAutoEstablishSocketConnection(bool)`, `setAdminHost`, `setClientHost`, `setStorageMode`, `setCallingEnabled(bool)`, `setCallAppSettings`, `build()`.

### Init must run once, before any chat component renders

The canonical pattern (used by both the docs and the kit's own sample app) is to **init in `main.ts` and only bootstrap the Angular app once init resolves.** Do NOT init inside a lazily-loaded route that mounts after a `<cometchat-*>` component could already be on screen.

```typescript
// main.ts (Angular 17+ standalone bootstrap)
import { bootstrapApplication } from "@angular/platform-browser";
import { UIKitSettingsBuilder, CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import { environment } from "./environments/environment";

// Fail loud if environment.cometchat values are EMPTY (env block missing, or
// the wrong environment file picked at build). Note: this catches empty/unset
// only — a non-empty placeholder like "YOUR_APP_ID" is truthy and passes, so
// still paste real values. Otherwise empty creds surface later as a cryptic
// init failure. (audit P0-5)
const cc = environment.cometchat;
if (!cc?.appId || !cc?.region || !cc?.authKey) {
  throw new Error(
    "CometChat credentials are empty in environment.cometchat — fill appId/region/authKey " +
      "in src/environments/environment.ts (and environment.prod.ts).",
  );
}

const settings = new UIKitSettingsBuilder()
  .setAppId(cc.appId)
  .setRegion(cc.region)
  .setAuthKey(cc.authKey)
  .subscribePresenceForAllUsers()
  .build();

// `init(...)` is typed `Promise<InitResult> | undefined` in v5.0.2, so coalesce to a
// Promise before chaining — `init(settings)?.then(...).catch(...)` still leaves the
// `.catch` on a possibly-undefined value and fails `tsc` strict (TS2532) on Angular 21.
(CometChatUIKit.init(settings) ?? Promise.resolve())
  .then(() => {
    bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
  })
  .catch((err) => console.error("CometChat init failed:", err));
```

Bootstrapping only after init resolves means every component that mounts afterward can safely assume CometChat is initialized. Login (dev user or token) then happens in the root component / a route guard / an auth service — see §4.

> **Filename convention — modern CLI scaffolds differ from these examples.** Examples here use the classic `AppComponent` in `src/app/app.component.ts`. Angular CLI 17+ (and 21) scaffolds the root component as **`App`** in `src/app/app.ts` (no `.component` suffix), with `app.config.ts` + `app.routes.ts`. On a freshly-scaffolded project, import `App` (not `AppComponent`) from `./app/app` and adapt the filenames — the wiring is identical, only the names changed.

> **Alternative — `APP_INITIALIZER`:** if you prefer to bootstrap unconditionally and block on a DI provider, register an `APP_INITIALIZER` factory that returns the `CometChatUIKit.init(settings)` Promise. Angular blocks bootstrap until it resolves. Either way the rule holds: init must finish before any `<cometchat-*>` renders.

---

## 4. Login

### Development mode — `login(uid)` takes a BARE STRING

```typescript
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";

const user = await CometChatUIKit.getLoggedinUser();   // async getter → Promise<User | null>
if (!user) {
  await CometChatUIKit.login("cometchat-uid-1");        // ← bare string, NOT { uid: "..." }
}
```

> `login()` takes a **string** uid, not an object — its signature is `login(uid: string): Promise<CometChat.User>`. Passing `{ uid: "..." }` fails type-checking. (Token login is a separate method — see Production.)

Every new CometChat app ships 5 pre-seeded test users — `cometchat-uid-1` … `cometchat-uid-5`.

### Reading the current user — three options

```typescript
// 1. Sync getter — use in components, route guards, anywhere after login completes:
const user = CometChatUIKit.getLoggedInUser();      // User | null  (note capital "In")

// 2. Async getter — use inside the init/login flow:
const user = await CometChatUIKit.getLoggedinUser(); // Promise<User | null>  (note lowercase "in")

// 3. Reactive (idiomatic Angular) — react to login/logout in templates with the async pipe:
CometChatUIKit.loggedInUser$.subscribe(u => this.currentUser = u);
```

`CometChatUIKitLoginListener` exists only as an **internal** kit class — it is not exported from `@cometchat/chat-uikit-angular`'s public API and has no public `getLoggedInUser()`. Use the static getters or the `loggedInUser$` observable instead. Never hardcode a UID to identify the current user — in production it comes from your auth system.

### Production mode

```typescript
await CometChatUIKit.loginWithAuthToken(tokenFromYourBackend);
```

The backend mints the token via the CometChat REST API using the server-only **REST API Key**. See `cometchat-angular-production`.

### Logout

```typescript
await CometChatUIKit.logout();   // Promise<LogoutResult> — then navigate to your login route
```

---

## 5. Using components — standalone imports (no NgModule, no schema)

v5 components are **standalone Angular components**. Import the component *class* into the `imports: []` of whatever standalone component renders it. They are real Angular components (not generic web components), so **`CUSTOM_ELEMENTS_SCHEMA` is NOT needed** — and there is no NgModule to register.

```typescript
// chat.component.ts
import { Component } from "@angular/core";
import { CometChatConversationsComponent } from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-chat",
  standalone: true,
  imports: [CometChatConversationsComponent],   // import the class you use; no schema
  template: `<cometchat-conversations></cometchat-conversations>`,
})
export class ChatComponent {}
```

- Class names carry the **`Component`** suffix (`CometChatConversationsComponent`); the **HTML selectors do not** (`<cometchat-conversations>`).
- Import only the components you actually use.
- There is **no composite** `<cometchat-conversations-with-messages>` in v5 — build a two-pane layout by composing `cometchat-conversations` with `cometchat-message-header` / `-list` / `-composer` (see `cometchat-angular-placement`).

> Using an NgModule-based app (not yet migrated to standalone)? You can still add these standalone classes to an `@NgModule({ imports: [...] })` — standalone components are importable into NgModules. You still do **not** need `CUSTOM_ELEMENTS_SCHEMA`.

See `cometchat-angular-components` for the full catalog of selectors, `@Input`/`@Output` bindings, and slot templates.

---

## 6. Environment variables

Angular has no `.env` / `process.env`. Config lives in `src/environments/environment.ts`.

```typescript
// src/environments/environment.ts (development)
export const environment = {
  production: false,
  cometchat: {
    appId: "YOUR_APP_ID",
    region: "us",                 // "us" | "eu" | "in"
    authKey: "YOUR_AUTH_KEY",     // dev only — never in production builds
  },
};
```

```typescript
// src/environments/environment.prod.ts (production)
export const environment = {
  production: true,
  cometchat: {
    appId: "YOUR_APP_ID",
    region: "us",
    // No authKey in production — mint auth tokens server-side
    tokenEndpoint: "https://api.yourapp.com/cometchat-token",
  },
};
```

**Never put the REST API Key in any environment file.** Angular bundles `environment.ts` into client JS — the REST API Key is server-only.

---

## 7. Theming — CSS variables (no theme service)

v5 has **no `CometChatThemeService`** and no programmatic palette API. Theming is done with CSS custom properties (`--cometchat-*`), the same model as the React kit. Light/dark mode is a single setter:

```typescript
CometChatUIKit.themeMode = "dark";   // 'light' | 'dark'
```

```css
/* styles.css — override brand + tokens globally */
:root {
  --cometchat-primary-color: #6852D6;
}
```

See `cometchat-angular-theming` for the full CSS-variable token reference and dark-mode strategy. Do **not** reach for `CometChatThemeService` / `theme.palette.setPrimary()` — no such programmatic palette API exists; theming is CSS-variable only.

---

## 8. Anti-patterns

1. **Don't target Angular ≤16.** UI Kit v5's peer range is Angular 17–21 (`>=17.0.0 <22.0.0`). On older Angular, upgrade before integrating.
2. **Don't install or import `@cometchat/uikit-shared` / `-elements` / `-resources`.** They don't exist in the v5 dependency set — everything is in `@cometchat/chat-uikit-angular`.
3. **Don't add `CUSTOM_ELEMENTS_SCHEMA`** for CometChat components — they are real Angular components (not generic web components), so the schema is unnecessary.
4. **Don't call `login({ uid })`.** v5 takes a bare string: `login("cometchat-uid-1")`.
5. **Don't use `CometChatUIKitLoginListener`** — it's an internal class, not public API. Use `CometChatUIKit.getLoggedInUser()` / `getLoggedinUser()` / `loggedInUser$`.
6. **Don't use `CometChatThemeService`** — it doesn't exist in v5. Theme via CSS variables + `themeMode`.
7. **Don't reach for `<cometchat-conversations-with-messages>`** — removed in v5. Compose the layout from the individual components.
8. **Don't init inside a lazy-loaded route.** Init must complete before any `<cometchat-*>` renders — use `APP_INITIALIZER` or gate on an `isReady` flag.
9. **Don't render `<cometchat-*>` before init+login resolve.** Gate with `*ngIf`.
10. **Don't bundle the REST API Key** in any `src/` file — Angular ships `src/` to the client.

---

## 9. SDK access

For raw SDK calls (e.g. `CometChat.getUser(uid)`), import the `CometChat` namespace directly from the chat SDK peer dependency:

```typescript
import { CometChat } from "@cometchat/chat-sdk-javascript";
```

Use the kit's `CometChatUIKit.*` helpers (sendTextMessage, createUser, updateUser, etc.) when available — they emit the UI events the components listen for.

---

## 10. Docs MCP (recommended)

```bash
claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp
```

Use it to confirm prop names, event signatures, theme tokens, or error meanings before writing non-obvious code.

---

## 11. Visual Builder — not available for Angular

The dashboard's Visual Builder export ships ZIPs for React / React Native / iOS / Android / Flutter — there is **no Angular emitter**. On an Angular project the dispatcher auto-routes to the code-driven path (sets `customize=code`), skips the Visually-vs-In-code prompt, and continues with this skill + `cometchat-angular-{components,placement,patterns,theming}`. If a stale `customize=visual` carried over from another project, the dispatcher overwrites it to `code` (a `builder ... --platform angular` call would be rejected at the CLI). Theming is via CSS variables (§7), not a builder.

---

## Skill routing reference

| Skill | When to load |
|---|---|
| `cometchat-angular-core` | Always — before any integration code |
| `cometchat-angular-components` | Always — before writing any `<cometchat-*>` HTML |
| `cometchat-angular-placement` | When integrating — route / modal / drawer / embedded patterns |
| `cometchat-angular-patterns` | Standalone wiring, routing, NgZone, change detection |
| `cometchat-angular-theming` | CSS-variable theming, dark mode, typography |
| `cometchat-angular-features` | Calls, extensions, AI |
| `cometchat-angular-customization` | Slot templates, formatters, builders, events |
| `cometchat-angular-production` | Server-side auth tokens + user management |
| `cometchat-angular-troubleshooting` | Build errors, runtime failures, drift |
| `cometchat-angular-calls` | Voice/video calling |
| `cometchat-angular-push` | Push notifications |
| `cometchat-angular-testing` | Unit / component / E2E tests |
