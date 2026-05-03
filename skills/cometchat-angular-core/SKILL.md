---
name: cometchat-angular-core
description: "Foundational rules for CometChat Angular UI Kit v4 integration — UIKitSettingsBuilder init pattern, login order, CometChatThemeService, environment config via src/environments/environment.ts, and anti-patterns that break real Angular apps."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular typescript core init login uikit-wb-source environment provider"
---

## Purpose

This is the foundational skill for every CometChat Angular UI Kit v4 integration using the shared `uikit-wb-source` internally. It teaches Claude HOW CometChat works in Angular — initialization order, UIKitSettingsBuilder pattern, login, environment config, module imports, and the anti-patterns that break real apps.

**Supported Angular versions: 12, 13, 14, and 15.** Angular 16+ (Signals / standalone-first) is not covered by this skill set.

**Read this skill first, before any placement or patterns skill.**

Ground truth: `docs/ui-kit/angular/getting-started`, `docs/ui-kit/angular/methods`, `@cometchat/chat-uikit-angular@4.x` exports, `@cometchat/uikit-shared` exports, `@cometchat/uikit-resources` exports.

---

## 1. The init-login-render order

CometChat Angular has exactly one valid lifecycle:

```
CometChatUIKit.init(UIKitSettings)  →  CometChatUIKit.login({ uid })  →  render <cometchat-*> components
```

Breaking this order produces a blank component, a "CometChat is not initialized" console error, or a hung login. No exceptions.

### UIKitSettingsBuilder — the Angular init pattern

The Angular UI Kit uses `UIKitSettingsBuilder` from `@cometchat/uikit-shared` (unlike React Native which uses a flat object). Always use the builder:

```typescript
import { UIKitSettingsBuilder } from "@cometchat/uikit-shared";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { environment } from "../environments/environment";

const UIKitSettings = new UIKitSettingsBuilder()
  .setAppId(environment.cometchat.appId)
  .setRegion(environment.cometchat.region)
  .setAuthKey(environment.cometchat.authKey)   // dev only — omit in production
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(UIKitSettings)
  .then(() => {
    console.log("CometChat initialized");
    // Now safe to call login
  })
  .catch(console.error);
```

**⚠️ `UIKitSettingsBuilder` is the Angular pattern.** Unlike React Native (which uses a flat object), Angular's UI Kit requires the builder chain. Passing a plain object to `CometChatUIKit.init()` will fail silently or throw a type error.

### Init must happen once, before the app bootstraps

The correct place is `app.component.ts`'s `ngOnInit` or a dedicated `AppInitService` called from `APP_INITIALIZER`. Do NOT call `init()` inside a lazy-loaded module or a component that mounts after routing — by then, components that depend on CometChat may already be rendering.

```typescript
// app.component.ts
import { Component, OnInit } from "@angular/core";
import { UIKitSettingsBuilder } from "@cometchat/uikit-shared";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { environment } from "../environments/environment";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit {
  isReady = false;

  ngOnInit(): void {
    const settings = new UIKitSettingsBuilder()
      .setAppId(environment.cometchat.appId)
      .setRegion(environment.cometchat.region)
      .setAuthKey(environment.cometchat.authKey)
      .subscribePresenceForAllUsers()
      .build();

    CometChatUIKit.init(settings)
      .then(() => CometChatUIKit.getLoggedinUser())
      .then((user) => {
        if (!user) {
          return CometChatUIKit.login({ uid: "cometchat-uid-1" });
        }
        return user;
      })
      .then(() => {
        this.isReady = true;
      })
      .catch(console.error);
  }
}
```

```html
<!-- app.component.html -->
<ng-container *ngIf="isReady">
  <router-outlet></router-outlet>
</ng-container>
```

Gate the router outlet (or any CometChat component) on `isReady`. Rendering `<cometchat-*>` before init + login completes produces blank components.

---

## 2. Login

### Development mode

```typescript
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";

CometChatUIKit.getLoggedinUser().then((user) => {
  if (!user) {
    CometChatUIKit.login({ uid: "cometchat-uid-1" })
      .then((loggedInUser) => {
        console.log("Login successful:", loggedInUser);
      })
      .catch(console.error);
  }
});
```

Every new CometChat app ships 5 pre-seeded test users — `cometchat-uid-1` through `cometchat-uid-5`. Use one for development.

**⚠️ `login()` takes an object `{ uid: "..." }`, not a bare string.** Passing `"cometchat-uid-1"` directly throws a type error in TypeScript and silently fails in JavaScript.

### Getting the current logged-in user

Two getters exist for different contexts:

```typescript
// Async — use inside the init/login flow or APP_INITIALIZER
const user = await CometChatUIKit.getLoggedinUser();  // note lowercase 'i' in 'in'
const myUid = user?.getUid();

// Sync — use in guards, components, and anywhere after login completes
import { CometChatUIKitLoginListener } from "@cometchat/chat-uikit-angular";
const user = CometChatUIKitLoginListener.getLoggedInUser();  // note capital 'I' in 'In'
const myUid = user?.getUid();
```

**Default to the sync version** in components and route guards — by the time they run, login is already complete. Use the async version only inside the init/login flow itself.

**Never hardcode a UID** to identify the logged-in user in app logic. Always use one of these getters — in production the UID comes from your auth system, not a test string.

### Production mode

Use `CometChatUIKit.login({ authToken: "..." })` with a token from your backend. The backend generates the token with the CometChat REST API using the server-only **REST API Key**. See `cometchat-angular-production` for the server-side token endpoint patterns.

### Logout

```typescript
CometChatUIKit.logout().then(() => {
  // Navigate to login page
});
```

---

## 3. Module setup (mandatory)

Angular requires explicit module imports. Every CometChat component must be imported in the module where it's used.

### AppModule setup

```typescript
// app.module.ts
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import {
  CometChatConversationsWithMessages,
  CometChatConversations,
  CometChatMessages,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
  CometChatUsers,
  CometChatGroups,
} from "@cometchat/chat-uikit-angular";
import { AppComponent } from "./app.component";

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    // Import only the CometChat components you use
    CometChatConversationsWithMessages,
    CometChatConversations,
    CometChatMessages,
    CometChatMessageHeader,
    CometChatMessageList,
    CometChatMessageComposer,
    CometChatUsers,
    CometChatGroups,
  ],
  declarations: [AppComponent],
  providers: [],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],  // Required for web components
})
export class AppModule {}
```

**⚠️ `CUSTOM_ELEMENTS_SCHEMA` is required.** Without it, Angular throws "Unknown element" errors for every `<cometchat-*>` tag. Add it to every module that uses CometChat components.

### Standalone component setup (Angular 14+)

```typescript
// chat.component.ts
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { CometChatConversations } from "@cometchat/chat-uikit-angular";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-chat",
  standalone: true,
  imports: [CommonModule, CometChatConversations],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<cometchat-conversations></cometchat-conversations>`,
})
export class ChatComponent {}
```

---

## 4. Assets configuration (mandatory)

The Angular UI Kit ships icon assets that must be linked in `angular.json`. Without this, icons render as broken images.

```json
// angular.json — inside build.options.assets
"assets": [
  "src/favicon.ico",
  "src/assets",
  {
    "glob": "**/*",
    "input": "./node_modules/@cometchat/chat-uikit-angular/assets/",
    "output": "assets/"
  }
]
```

**⚠️ Missing assets config = broken icons throughout the UI Kit.** This is the most commonly missed setup step. Always verify `angular.json` before debugging icon issues.

---

## 5. Environment variables

Angular does not use `.env` files or `process.env`. Configuration lives in `src/environments/environment.ts` (TypeScript constant objects).

### Environment file structure

```typescript
// src/environments/environment.ts  (development)
export const environment = {
  production: false,
  cometchat: {
    appId: "YOUR_APP_ID",
    region: "us",           // "us" | "eu" | "in"
    authKey: "YOUR_AUTH_KEY",  // dev only — never in production builds
  },
};
```

```typescript
// src/environments/environment.prod.ts  (production)
export const environment = {
  production: true,
  cometchat: {
    appId: "YOUR_APP_ID",
    region: "us",
    // No authKey in production — use server-minted auth tokens
    tokenEndpoint: "https://api.yourapp.com/cometchat-token",
  },
};
```

**⚠️ Never put `REST_API_KEY` in any environment file.** Angular bundles `environment.ts` into the client-side JavaScript. The REST API Key is server-only — it lives in your backend's environment variables, never in the Angular app.

### Using environment values

```typescript
import { environment } from "../environments/environment";

// In your component or service:
const appId = environment.cometchat.appId;
```

Angular's build system automatically swaps `environment.ts` for `environment.prod.ts` when building with `--configuration production`.

---

## 6. CometChatThemeService

The Angular UI Kit uses `CometChatThemeService` (injected via Angular's DI) to control the palette. Inject it in your root component's constructor.

```typescript
import { Component } from "@angular/core";
import { CometChatThemeService } from "@cometchat/chat-uikit-angular";

@Component({ selector: "app-root", templateUrl: "./app.component.html" })
export class AppComponent {
  constructor(private themeService: CometChatThemeService) {
    // Set mode: "light" | "dark"
    themeService.theme.palette.setMode("light");
    // Set primary brand color
    themeService.theme.palette.setPrimary({ light: "#6851D6", dark: "#6851D6" });
  }
}
```

`CometChatThemeService` is a singleton provided at the root level — inject it once in `AppComponent` and the theme applies globally. See `cometchat-angular-theming` for the full token reference.

---

## 7. Package installation

```bash
npm install @cometchat/chat-uikit-angular
npm install @cometchat/uikit-elements @cometchat/uikit-resources @cometchat/uikit-shared
```

The UI Kit depends on `@cometchat/chat-sdk-javascript` (installed automatically as a peer dep). Do NOT install `@cometchat/chat-sdk-javascript` separately unless you need a specific version — let the UI Kit manage it.

### Peer dependencies

```bash
# Required for Angular animations (used by some UI Kit components)
npm install @angular/animations
```

Ensure `BrowserAnimationsModule` is imported in `AppModule` (see § 3).

---

## 8. Anti-patterns

1. **Do NOT call `CometChatUIKit.init()` inside a lazy-loaded module.** Init must complete before any `<cometchat-*>` component renders. Lazy-loaded modules mount after routing, which is too late.

2. **Do NOT use a flat settings object with `CometChatUIKit.init()`.** Angular requires `UIKitSettingsBuilder` from `@cometchat/uikit-shared`. The flat-object pattern is React Native only.

3. **Do NOT omit `CUSTOM_ELEMENTS_SCHEMA` from the module.** Every module that declares a component using `<cometchat-*>` tags needs it.

4. **Do NOT skip the assets config in `angular.json`.** Icons will be broken without it.

5. **Do NOT put `authKey` in `environment.prod.ts`.** Use server-minted auth tokens in production. See `cometchat-angular-production`.

6. **Do NOT render `<cometchat-*>` components before `isReady`.** Gate on the init + login promise resolving. Use `*ngIf="isReady"` on the container.

7. **Do NOT call `login()` with a bare string.** It takes `{ uid: "..." }` or `{ authToken: "..." }`.

8. **Do NOT import `@cometchat/chat-sdk-javascript` directly** unless you need SDK-level access (e.g., `CometChat.getUser(uid)`). The UI Kit re-exports the SDK's `CometChat` namespace — import from `@cometchat/chat-sdk-javascript` only when you need the raw SDK.

9. **Do NOT forget `BrowserAnimationsModule`** in `AppModule`. Some UI Kit components use Angular animations; missing this module causes runtime errors.

10. **Do NOT bundle `REST_API_KEY` in any Angular file.** Angular bundles everything in `src/` into the client JavaScript. Server-only keys belong on your backend.

---

## 9. i18n, RTL, and accessibility

### i18n (translations)

The Angular UI Kit ships `CometChatLocalize` for built-in translations (~40 languages). Initialize it once alongside `CometChatUIKit.init()`:

```typescript
import { CometChatLocalize } from "@cometchat/chat-uikit-angular";

// In AppComponent.ngOnInit, after init resolves:
CometChatLocalize.init("es"); // "fr", "de", "ar", "hi", etc.
```

To override specific strings, pass a resources object as the second positional argument:

```typescript
CometChatLocalize.init("en", {
  en: {
    "type a message": "Write your message…",
  },
});
```

### RTL (right-to-left)

The UI Kit reads `dir="rtl"` from the document root. Set it in `index.html` or toggle it dynamically:

```html
<!-- index.html -->
<html dir="rtl" lang="ar">
```

```typescript
// Toggle dynamically:
document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
```

CometChat components flip automatically — no CometChat-specific config needed.

### Accessibility

Default components ship with `aria-label` on icon-only buttons, `role="listbox"` on lists, and keyboard navigation (`Tab`, `Enter`, `Esc`). When writing custom `ng-template` slot views:

1. **Icon-only buttons** — add `aria-label="<verb>"` (e.g. `aria-label="Send message"`)
2. **Custom list items** — keep `role="option"` + `aria-selected` on the wrapper
3. **Color overrides** — verify text contrast ≥ 4.5:1 against background

---

## 10. Docs MCP (recommended, not required)

The CometChat docs MCP gives runtime access to the most current Angular UI Kit docs. Install:

```bash
claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp
```

Use the MCP to verify prop names, callback signatures, theme token names, or error message meanings before writing any non-obvious code.

---

## Skill routing reference

| Skill | When to load |
|---|---|
| `cometchat-angular-core` | Always — before any integration code |
| `cometchat-angular-components` | Always — before writing any `<cometchat-*>` HTML |
| `cometchat-angular-placement` | When integrating — for placement patterns |
| `cometchat-angular-patterns` | For Angular-specific routing and module wiring |
| `cometchat-angular-theming` | When customizing colors, dark mode, typography |
| `cometchat-angular-features` | When adding calls, extensions, AI |
| `cometchat-angular-customization` | When customizing components (slot views, formatters, builders) |
| `cometchat-angular-production` | When setting up server-side auth + user management |
| `cometchat-angular-troubleshooting` | When diagnosing build errors, runtime failures |
