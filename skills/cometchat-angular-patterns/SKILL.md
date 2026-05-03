---
name: cometchat-angular-patterns
description: "Angular-specific integration patterns for CometChat UI Kit v4 — lazy loading, route guards, Angular Router integration, APP_INITIALIZER setup, standalone vs NgModule, and SSR/Universal considerations."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular patterns routing lazy-loading guards app-initializer standalone ssr"
---

## Purpose

Teaches Claude Angular-specific integration patterns for CometChat — how to wire init into Angular's bootstrap lifecycle, lazy-load the chat module, protect chat routes with guards, handle SSR/Universal, and integrate with Angular Material. Assumes a working base integration (see `cometchat-angular-core` + `cometchat-angular-placement`).

**Read `cometchat-angular-core` and `cometchat-angular-placement` first** — this skill builds on top of the base integration.

Ground truth: `docs/ui-kit/angular/getting-started`, Angular Router docs, `@cometchat/chat-uikit-angular@4.x` exports.

---

## 1. APP_INITIALIZER pattern (production-grade init)

For production apps, use Angular's `APP_INITIALIZER` token to ensure CometChat is initialized before the app renders any component. This is cleaner than calling `init()` in `AppComponent.ngOnInit()`.

```typescript
// cometchat-init.service.ts
import { Injectable } from "@angular/core";
import { UIKitSettingsBuilder } from "@cometchat/uikit-shared";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { environment } from "../environments/environment";

@Injectable({ providedIn: "root" })
export class CometChatInitService {
  private initialized = false;

  initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    const settings = new UIKitSettingsBuilder()
      .setAppId(environment.cometchat.appId)
      .setRegion(environment.cometchat.region)
      .setAuthKey(environment.cometchat.authKey)
      .subscribePresenceForAllUsers()
      .build();

    return CometChatUIKit.init(settings).then(() => {
      this.initialized = true;
    });
  }
}
```

```typescript
// app.module.ts
import { APP_INITIALIZER, NgModule } from "@angular/core";
import { CometChatInitService } from "./cometchat-init.service";

export function initCometChat(service: CometChatInitService): () => Promise<void> {
  return () => service.initialize();
}

@NgModule({
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initCometChat,
      deps: [CometChatInitService],
      multi: true,
    },
  ],
})
export class AppModule {}
```

With `APP_INITIALIZER`, Angular waits for the init promise to resolve before bootstrapping the root component. No `*ngIf="isReady"` guard needed on the root template.

**⚠️ `APP_INITIALIZER` blocks the entire app bootstrap.** If CometChat init fails (network error, wrong credentials), the app never renders. Add error handling:

```typescript
initialize(): Promise<void> {
  return CometChatUIKit.init(settings).then(() => {
    this.initialized = true;
  }).catch((err) => {
    console.error("CometChat init failed:", err);
    // Don't re-throw — let the app render and show an error state
  });
}
```

---

## 2. Route guard for authenticated chat

Protect chat routes so only logged-in users can access them.

```typescript
// cometchat-auth.guard.ts
import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";

@Injectable({ providedIn: "root" })
export class CometChatAuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): Promise<boolean> {
    return CometChatUIKit.getLoggedinUser().then((user) => {
      if (user) return true;
      this.router.navigate(["/login"]);
      return false;
    });
  }
}
```

```typescript
// app-routing.module.ts
import { CometChatAuthGuard } from "./cometchat-auth.guard";

export const routes: Routes = [
  {
    path: "chat",
    canActivate: [CometChatAuthGuard],
    loadChildren: () => import("./chat/chat.module").then((m) => m.ChatModule),
  },
  { path: "login", component: LoginComponent },
];
```

---

## 3. Lazy loading the chat module

For apps where chat is a secondary feature, lazy-load the CometChat module to keep the initial bundle small.

```typescript
// chat/chat.module.ts
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { CommonModule } from "@angular/common";
import {
  CometChatConversations,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
} from "@cometchat/chat-uikit-angular";
import { ConversationsComponent } from "./conversations/conversations.component";
import { MessagesComponent } from "./messages/messages.component";

const routes: Routes = [
  { path: "", component: ConversationsComponent },
  { path: "messages/user/:uid", component: MessagesComponent },
  { path: "messages/group/:guid", component: MessagesComponent },
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    CometChatConversations,
    CometChatMessageHeader,
    CometChatMessageList,
    CometChatMessageComposer,
  ],
  declarations: [ConversationsComponent, MessagesComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ChatModule {}
```

```typescript
// app-routing.module.ts
export const routes: Routes = [
  {
    path: "chat",
    loadChildren: () => import("./chat/chat.module").then((m) => m.ChatModule),
  },
];
```

**⚠️ CometChat init must still happen at the app root level**, not inside the lazy-loaded module. The `APP_INITIALIZER` pattern (§ 1) or `AppComponent.ngOnInit()` ensures init completes before the lazy module loads.

---

## Standalone components with Angular Router (Angular 14+)

For apps using standalone components (no NgModule), wire routing directly:

```typescript
// main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { provideAnimations } from "@angular/platform-browser/animations";
import { APP_INITIALIZER } from "@angular/core";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";
import { CometChatInitService } from "./app/cometchat-init.service";

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    {
      provide: APP_INITIALIZER,
      useFactory: (service: CometChatInitService) => () => service.initialize(),
      deps: [CometChatInitService],
      multi: true,
    },
  ],
});
```

```typescript
// app.routes.ts
import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "chat",
    loadComponent: () =>
      import("./chat/conversations.component").then((m) => m.ConversationsComponent),
  },
  {
    path: "messages/user/:uid",
    loadComponent: () =>
      import("./chat/messages.component").then((m) => m.MessagesComponent),
  },
];
```

---

## 5. Login flow integration

Wire CometChat login to your app's existing auth flow.

### Pattern A — Login on app startup (dev mode)

```typescript
// app.component.ts
import { Component, OnInit } from "@angular/core";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";

@Component({ selector: "app-root", templateUrl: "./app.component.html" })
export class AppComponent implements OnInit {
  isReady = false;

  ngOnInit(): void {
    // CometChat.init() already called via APP_INITIALIZER
    CometChatUIKit.getLoggedinUser()
      .then((user) => {
        if (!user) {
          return CometChatUIKit.login({ uid: "cometchat-uid-1" });
        }
        return user;
      })
      .then(() => (this.isReady = true))
      .catch(console.error);
  }
}
```

### Pattern B — Login after your app's auth (production)

```typescript
// auth.service.ts
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { environment } from "../environments/environment";

@Injectable({ providedIn: "root" })
export class AuthService {
  constructor(private http: HttpClient) {}

  loginWithCometChat(appJwt: string): Promise<void> {
    // 1. Fetch CometChat auth token from your backend
    return this.http
      .post<{ authToken: string }>(environment.cometchat.tokenEndpoint, {}, {
        headers: { Authorization: `Bearer ${appJwt}` },
      })
      .toPromise()
      .then((response) => {
        // 2. Login with the auth token
        return CometChatUIKit.login({ authToken: response!.authToken });
      })
      .then(() => {
        // 3. CometChat session established
      });
  }

  logout(): Promise<void> {
    return CometChatUIKit.logout();
  }
}
```

---

## 6. Angular Material integration

CometChat works alongside Angular Material. Common integration points:

### Theming coexistence

CometChat uses its own `CometChatThemeService` — it does NOT read from Angular Material's theme. Set both independently:

```typescript
// app.component.ts
import { Component } from "@angular/core";
import { CometChatThemeService } from "@cometchat/chat-uikit-angular";

@Component({ selector: "app-root", templateUrl: "./app.component.html" })
export class AppComponent {
  constructor(private cometChatTheme: CometChatThemeService) {
    // Set CometChat palette to match your Material theme's primary color
    cometChatTheme.theme.palette.setPrimary({ light: "#6200EE", dark: "#BB86FC" });
    cometChatTheme.theme.palette.setMode("light");
  }
}
```

### MatSidenav + CometChat sidebar

```html
<!-- app.component.html -->
<mat-sidenav-container style="height: 100vh;">
  <mat-sidenav mode="side" opened style="width: 320px;">
    <cometchat-conversations
      [onItemClick]="handleConvClick"
      style="height: 100%;"
    ></cometchat-conversations>
  </mat-sidenav>
  <mat-sidenav-content style="display: flex; flex-direction: column;">
    <cometchat-message-header [user]="selectedUser" [hideBackButton]="true"></cometchat-message-header>
    <cometchat-message-list [user]="selectedUser" style="flex: 1; overflow: hidden;"></cometchat-message-list>
    <cometchat-message-composer [user]="selectedUser"></cometchat-message-composer>
  </mat-sidenav-content>
</mat-sidenav-container>
```

---

## 7. SSR / Angular Universal considerations

CometChat's UI Kit uses browser APIs (`window`, `document`, `localStorage`) that are not available in Node.js during SSR. If the project uses Angular Universal:

```typescript
// cometchat-init.service.ts
import { isPlatformBrowser } from "@angular/common";
import { PLATFORM_ID, Inject } from "@angular/core";

@Injectable({ providedIn: "root" })
export class CometChatInitService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  initialize(): Promise<void> {
    // Skip CometChat init on the server
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }
    // ... normal init
  }
}
```

```typescript
// In any component that renders CometChat components:
@Component({
  template: `
    <ng-container *ngIf="isBrowser">
      <cometchat-conversations></cometchat-conversations>
    </ng-container>
  `,
})
export class ChatComponent {
  isBrowser: boolean;
  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
}
```

**⚠️ CometChat components must not render during SSR.** They use browser APIs that throw in Node.js. Always guard with `isPlatformBrowser()`.

---

## 8. Change detection optimization

CometChat components use Angular's default change detection. For performance-sensitive apps using `OnPush`:

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <cometchat-conversations
      [onItemClick]="handleConvClick"
    ></cometchat-conversations>
  `,
})
export class ChatComponent {
  constructor(private cdr: ChangeDetectorRef) {}

  handleConvClick = (conversation: CometChat.Conversation): void => {
    // Update component state
    this.selectedConversation = conversation;
    // Trigger change detection manually when using OnPush
    this.cdr.markForCheck();
  };
}
```

CometChat components themselves use default change detection internally — `OnPush` on the parent component is fine as long as you call `markForCheck()` after updating state from CometChat callbacks.

---

## 9. Anti-patterns

1. **Do NOT call `CometChatUIKit.init()` inside a lazy-loaded module.** Init must complete before any `<cometchat-*>` component renders. Use `APP_INITIALIZER` at the root level.

2. **Do NOT use `ChangeDetectionStrategy.OnPush` without calling `markForCheck()` after CometChat callbacks.** CometChat callbacks run outside Angular's zone — without `markForCheck()`, the view won't update.

3. **Do NOT import CometChat components in `AppModule` if they're only used in a lazy-loaded feature module.** Import them in the feature module to keep the initial bundle small.

4. **Do NOT skip `isPlatformBrowser()` guard in SSR apps.** CometChat uses browser APIs that crash in Node.js.

5. **Do NOT use `window.location.reload()` after login.** This is a common pattern in CometChat examples but it's an anti-pattern in Angular — use Angular Router navigation instead.

6. **Do NOT forget `CUSTOM_ELEMENTS_SCHEMA` in every module/component that uses `<cometchat-*>` tags.** Each standalone component and each NgModule needs it independently.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Init, login, module setup — always first |
| `cometchat-angular-components` | Component prop reference |
| `cometchat-angular-placement` | Where to put chat (route / sidebar / modal / tab) |
| `cometchat-angular-patterns` | This skill — Angular-specific wiring (guards, lazy loading, SSR) |
| `cometchat-angular-theming` | CometChatThemeService + palette |
| `cometchat-angular-features` | Calls, extensions, AI |
| `cometchat-angular-customization` | Custom slot views, formatters, event bus |
| `cometchat-angular-production` | Server-minted auth tokens |
| `cometchat-angular-troubleshooting` | Build errors, runtime failures, SSR crashes |
