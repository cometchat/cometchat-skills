---
name: cometchat-angular-patterns
description: "Angular-specific integration patterns for CometChat UI Kit v5 (@cometchat/chat-uikit-angular@5) — standalone bootstrap with main.ts init-before-bootstrap, functional route guards (CanActivateFn), lazy standalone routes (loadComponent), NgZone correctness for SDK callbacks, OnPush change detection, and SSR/Angular-Universal considerations."
license: "MIT"
compatibility: "Angular 17–21 (standalone APIs); @cometchat/chat-uikit-angular ^5.0"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular patterns routing lazy guards standalone bootstrap ssr ngzone v5"
---

> **Ground truth:** `@cometchat/chat-uikit-angular@5.x` (+ `@cometchat/calls-sdk-javascript@^5`) — installed package types + `ui-kit/angular`. **Official docs:** https://www.cometchat.com/docs/ui-kit/angular/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

## Purpose

Angular-specific wiring for CometChat UI Kit **v5** — how to hook init into Angular's standalone bootstrap, lazy-load chat routes, guard them, keep SDK callbacks inside Angular's zone, and handle SSR. Assumes the base integration from `cometchat-angular-core` + components from `cometchat-angular-components`.

**v5 is standalone-first (Angular 17–21).** Everything below uses `bootstrapApplication` + `app.config.ts` + functional APIs. There is **no NgModule, no `AppModule`, no `declarations`, no `CUSTOM_ELEMENTS_SCHEMA`** — those are v4 patterns and must not appear in a v5 app.

---

## 1. Initialize in `main.ts` — before `bootstrapApplication`

The v5 canonical (matches the kit's own sample app and the docs): call `CometChatUIKit.init()` in `main.ts` and bootstrap the Angular app **inside the resolved init promise**. This guarantees the SDK is ready before any `<cometchat-*>` component can mount. `init()` is a static method, so it works fine outside Angular's DI context.

```typescript
// src/main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-angular";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import { environment } from "./environments/environment";

const settings = new UIKitSettingsBuilder()
  .setAppId(environment.cometchat.appId)
  .setRegion(environment.cometchat.region)
  .setAuthKey(environment.cometchat.authKey)
  .subscribePresenceForAllUsers()
  // .setCallingEnabled(true)   // uncomment + install @cometchat/calls-sdk-javascript for voice/video
  .build();

// `init(...)` is `Promise<InitResult> | undefined` (v5.0.2) — coalesce to a Promise so
// `.then`/`.catch` don't fail `tsc` strict (TS2532) on Angular 21.
(CometChatUIKit.init(settings) ?? Promise.resolve())
  .then(() => {
    bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
  })
  .catch((error) => {
    console.error("CometChat UIKit init failed:", error);
    // Still bootstrap so the app renders (it can show a "chat unavailable" state).
    bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
  });
```

```typescript
// src/app/app.config.ts — providers only; init does NOT live here
import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)],
};
```

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  cometchat: {
    appId: "APP_ID",     // Dashboard → Your App → Credentials
    region: "REGION",    // us | eu | in
    authKey: "AUTH_KEY", // dev/testing only — use Auth Tokens in production
  },
};
```

> Don't use `APP_INITIALIZER` for this. The kit's sample app and docs both init in `main.ts` and bootstrap inside `.then()` — that's the v5 canonical and avoids the DI-timing edge cases of an init factory provider. Always `.catch()` so a network/credential failure degrades gracefully instead of leaving a blank app.

---

## 2. Login + functional route guard

Init readies the SDK; **login** establishes the session. Guard chat routes with a functional `CanActivateFn` (the v17+ idiom — no class guard, no `Injectable`). This mirrors the sample app's `authGuard`:

```typescript
// src/app/guards/auth.guard.ts
import { CanActivateFn, Router } from "@angular/router";
import { inject } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  try {
    const user = await CometChat.getLoggedinUser();   // async; note lowercase 'in'
    if (user) return true;
    return router.createUrlTree(["/login"]);
  } catch {
    return router.createUrlTree(["/login"]);
  }
};
```

For dev convenience you can auto-login a seeded user instead of redirecting:

```typescript
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
// …inside the guard, when no user is found:
try {
  await CometChatUIKit.login("cometchat-uid-1");   // bare UID string in v5 — NOT login({ uid })
  return true;
} catch {
  return router.createUrlTree(["/login"]);
}
```

Two real session-check APIs exist; pick by context:
- `CometChat.getLoggedinUser()` / `CometChatUIKit.getLoggedinUser()` — **async** (returns `Promise<User | null>`, lowercase `in`). Use in guards/async flows. This is what the sample app guards use.
- `CometChatUIKit.getLoggedInUser()` — **sync** (returns `User | null`, capital `I`). Use inside components for a synchronous read after the session is known to exist.

```typescript
// src/app/app.routes.ts
import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth.guard";

export const routes: Routes = [
  {
    path: "chat",
    canActivate: [authGuard],
    // Lazy-load a standalone component — no NgModule, no loadChildren:
    loadComponent: () => import("./chat/chat.component").then((m) => m.ChatComponent),
  },
  { path: "", redirectTo: "chat", pathMatch: "full" },
];
```

---

## 3. Lazy-loaded standalone chat route

The chat surface is a standalone component that imports only the CometChat components it renders.

```typescript
// chat/chat.component.ts
import { Component } from "@angular/core";
import {
  CometChatConversationsComponent,
  CometChatMessageHeaderComponent,
  CometChatMessageListComponent,
  CometChatMessageComposerComponent,
} from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({
  selector: "app-chat",
  standalone: true,
  imports: [
    CometChatConversationsComponent,
    CometChatMessageHeaderComponent,
    CometChatMessageListComponent,
    CometChatMessageComposerComponent,
  ],
  templateUrl: "./chat.component.html",
})
export class ChatComponent {
  selectedUser?: CometChat.User;

  onConversation(conversation: CometChat.Conversation) {
    const entity = conversation.getConversationWith();
    if (entity instanceof CometChat.User) this.selectedUser = entity;
  }
}
```

`loadComponent` (not `loadChildren`) is the standalone way to lazy-load — there's no feature NgModule to point at.

---

## 4. NgZone — keep SDK callbacks inside Angular's zone

CometChat SDK callbacks (event listeners, Promise resolutions from non-Angular timers) can fire **outside** Angular's zone, so a view bound to the result won't update until the next tick. If a UI value set inside an SDK callback isn't refreshing, re-enter the zone:

```typescript
import { Component, NgZone } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({ /* … */ })
export class PresenceComponent {
  status = "offline";
  constructor(private zone: NgZone) {}

  ngOnInit() {
    CometChat.addUserListener("presence", new CometChat.UserListener({
      onUserOnline: (user: CometChat.User) =>
        this.zone.run(() => { this.status = "online"; }),   // ← re-enter zone
      onUserOffline: (user: CometChat.User) =>
        this.zone.run(() => { this.status = "offline"; }),
    }));
  }
}
```

The kit's own `<cometchat-*>` components handle this internally — you only need `zone.run()` for **your own** code that mutates view state inside an SDK callback. Prefer the kit's `@Output`s where they exist (they're already zone-correct). Alternatively, consume `CometChatUIKit.loggedInUser$` (an RxJS observable) with the `async` pipe — observables integrate with change detection cleanly.

---

## 5. OnPush change detection

CometChat components are heavy; if your host component uses `ChangeDetectionStrategy.OnPush`, pass **immutable** references — reassign `selectedUser`/`selectedGroup` (a new object) rather than mutating, so OnPush detects the change. Binding the same mutated object won't trigger a re-render. (This mirrors the React "new reference per update" rule.)

---

## 6. SSR / Angular Universal

CometChat is a **browser-only** SDK (WebSocket + IndexedDB + `window`). It must not run during server-side rendering. The recommended setup is `ng new --ssr false` (per the docs) — but if your app already uses `@angular/ssr`, keep CometChat off the server.

- **Don't** call `CometChatUIKit.init()` / render `<cometchat-*>` on the server. Because init lives in `main.ts` (§1), gate it on the platform — `main.ts` runs in both the browser and server entry under SSR:

```typescript
// src/main.ts (SSR-safe)
import { isPlatformBrowser } from "@angular/common";
import { PLATFORM_ID } from "@angular/core";

// bootstrap once, unconditionally:
function boot() {
  bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
}

if (typeof window === "undefined") {
  boot();                       // server render — skip CometChat init entirely
} else {
  (CometChatUIKit.init(settings) ?? Promise.resolve()).then(boot).catch((e) => { console.error(e); boot(); });
}
```

  (Inside Angular providers/components, use `isPlatformBrowser(inject(PLATFORM_ID))` for the same guard.)
- Lazy-load the chat route (`loadComponent`) so the kit's bundle never enters the server build's initial chunk.
- With `@angular/ssr`, render the chat route client-side only (it's behind the auth guard + browser check above).

---

## 7. Anti-patterns

1. **Don't use NgModule wiring** (`@NgModule`, `AppModule`, `declarations`, `forRoot`, `CUSTOM_ELEMENTS_SCHEMA`) — those are v4. v5 is standalone: `app.config.ts` providers + `imports: []` on standalone components.
2. **Don't put `CometChatUIKit.init()` in `APP_INITIALIZER`** — the v5 canonical inits in `main.ts` and bootstraps inside the resolved promise. `app.config.ts` carries providers only.
3. **Don't use a class `CanActivate` guard** when a functional `CanActivateFn` is cleaner (v17+). Match the standalone idiom — no `Injectable` guard class.
4. **Don't init on the server** — gate `main.ts` init on the platform (`typeof window`/`isPlatformBrowser`).
5. **Don't forget `zone.run()`** around view-state mutations inside raw SDK listener callbacks — or use `loggedInUser$` + `async` pipe.
6. **Don't `loadChildren` a chat NgModule** — there isn't one; `loadComponent` a standalone component.
7. **Don't call `login({ uid })`** — v5 takes a bare UID string (see `cometchat-angular-core`).

## Pointers
- `cometchat-angular-core` — init/login, standalone setup, env
- `cometchat-angular-components` — the component catalog
- `cometchat-angular-placement` — where to mount chat (route/modal/drawer)
- `cometchat-angular-production` — server-minted auth tokens
