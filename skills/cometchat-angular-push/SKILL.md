---
name: cometchat-angular-push
description: Push notifications for CometChat Angular UI Kit v4 in Angular 12-15 projects. Web doesn't have native push — covers @angular/service-worker setup, ngsw-config.json, SwPush subscription, server-side webhook to send pushes, click-through routing via Angular Router, Angular Universal SSR considerations, and HTTPS requirements.
license: "MIT"
compatibility: "Angular 12-15 (LTS focus on 15); @angular/service-worker (matched to Angular major); Web Push API (Chrome 50+, Firefox 44+, Edge 17+, Safari 16+ desktop, Safari 16.4+ iOS PWA-only); HTTPS required"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular web push notifications service-worker swpush ngsw vapid universal ssr"
---

## Purpose

Web Push for Angular CometChat integrations. Angular's `@angular/service-worker` package provides `SwPush` — a thin wrapper over the Push API — that integrates with Angular's DI tree and Router, so it's the recommended path over hand-rolled Service Workers.

**Read these other skills first:**
- `cometchat-angular-core` — UIKitSettingsBuilder, login order
- `cometchat-angular-patterns` — module setup
- `cometchat-react-push` — same Web Push spec, React-flavored explanation; shared concepts (VAPID, server-side webhook, iOS PWA caveat) covered there in depth

**Ground truth:**
- `@angular/service-worker` — https://angular.io/guide/service-worker-intro
- `SwPush` API — https://angular.io/api/service-worker/SwPush
- Web Push spec — https://datatracker.ietf.org/doc/html/rfc8030

---

## 1. Architecture (same as web)

Same shape as `cometchat-react-push`: client SW + push server + CometChat webhook. Angular's `SwPush` is the client-side primitive; everything else is the same.

---

## 2. Add @angular/service-worker

```bash
ng add @angular/service-worker
```

This:
- Adds `@angular/service-worker` to dependencies
- Creates `ngsw-config.json` at project root
- Imports `ServiceWorkerModule.register('ngsw-worker.js', ...)` in `AppModule`
- Sets `serviceWorker: true` in `angular.json` build options

Verify in `app.module.ts`:

```ts
@NgModule({
  imports: [
    BrowserModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),                              // SW disabled in dev mode by default
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
})
export class AppModule {}
```

---

## 3. ngsw-config.json — minimal config for chat push

The default config caches assets for offline-first PWAs. For chat push, you mostly need the data-sources for live API calls:

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": {
        "files": ["/favicon.ico", "/index.html", "/manifest.webmanifest", "/*.css", "/*.js"]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": ["/assets/**", "/*.(svg|cur|jpg|jpeg|png|apng|webp|avif|gif|otf|ttf|woff|woff2)"]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "cometchat-api",
      "urls": ["https://api-*.cometchat.io/**"],
      "cacheConfig": {
        "maxSize": 100,
        "maxAge": "0d",
        "strategy": "freshness"
      }
    }
  ]
}
```

**Don't cache CometChat API responses** — they're real-time. The freshness strategy with `maxAge: "0d"` effectively disables caching.

---

## 4. SwPush registration

```ts
// services/push.service.ts
import { Injectable } from "@angular/core";
import { SwPush } from "@angular/service-worker";
import { Router } from "@angular/router";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class PushService {
  constructor(private swPush: SwPush, private router: Router) {
    // Listen for notification clicks — fired when user taps a push notification
    this.swPush.notificationClicks.subscribe(({ notification }) => {
      const data = notification.data;
      const targetUrl = data.receiverType === "group"
        ? `/messages/group/${data.conversationId}`
        : `/messages/user/${data.senderUid}`;
      this.router.navigateByUrl(targetUrl);
    });
  }

  async subscribe(uid: string): Promise<void> {
    if (!this.swPush.isEnabled) {
      console.warn("SwPush not enabled — Service Worker not registered or not supported");
      return;
    }

    try {
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: environment.vapidPublic,
      });

      // Send to YOUR push server, keyed by uid
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, subscription }),
      });
    } catch (err) {
      // User denied permission, or push not supported
      console.warn("Web Push subscription failed:", err);
    }
  }

  async unsubscribe(uid: string): Promise<void> {
    if (!this.swPush.isEnabled) return;
    const subscription = await this.swPush.subscription.toPromise();
    if (!subscription) return;

    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, subscription }),
    });
    await this.swPush.unsubscribe();
  }
}
```

**Permission gesture rule:** `requestSubscription` triggers the browser's permission prompt. Browsers require this in response to a user gesture (click). Don't call this from `OnInit` — wire it to a button click.

---

## 5. Wire into the auth flow

```ts
// services/auth.service.ts (or wherever login happens)
import { PushService } from "./push.service";

@Injectable({ providedIn: "root" })
export class AuthService {
  constructor(private pushService: PushService) {}

  async loginAndEnableChat(uid: string): Promise<void> {
    await CometChatUIKit.login(uid);
    // Don't auto-subscribe to push — let the user opt in via a button
  }

  async logout(uid: string): Promise<void> {
    await this.pushService.unsubscribe(uid);     // CRITICAL — clean up before SDK logout
    await CometChatUIKit.logout();
  }
}
```

---

## 6. "Enable notifications" button

```ts
// components/notification-prompt.component.ts
@Component({
  selector: "app-notification-prompt",
  template: `
    <button (click)="enable()" *ngIf="!enabled">
      Enable notifications
    </button>
  `,
})
export class NotificationPromptComponent {
  enabled = false;

  constructor(private pushService: PushService, private auth: AuthService) {}

  async enable() {
    const user = await CometChatUIKit.getLoggedInUser();
    if (!user) return;
    await this.pushService.subscribe(user.uid);
    this.enabled = true;
  }
}
```

Mount this somewhere visible — chat header, settings page, or a one-time onboarding card.

---

## 7. Service Worker push event handler

`@angular/service-worker` ships its own `ngsw-worker.js` that handles push events automatically — when a push arrives, it calls `ServiceWorkerRegistration.showNotification` with the push payload.

**However**, the default behavior shows the entire payload as the notification body. For chat, you want a custom UI: sender name as title, preview as body, conversation tag for dedup.

Two paths:

### Path A — Use the payload shape `ngsw-worker.js` expects

The Angular SW expects this payload shape:

```json
{
  "notification": {
    "title": "Alice",
    "body": "Hi there",
    "icon": "/avatars/alice.png",
    "tag": "chat-conversation-123",
    "data": {
      "conversationId": "conversation-123",
      "senderUid": "cometchat-uid-1",
      "receiverType": "user"
    }
  }
}
```

Your push server sends this exact shape. `ngsw-worker.js` extracts `notification` and shows it.

### Path B — Custom Service Worker

If you need behavior beyond what Angular's SW provides (e.g. checking if the chat tab is focused before notifying), eject from `ngsw-worker.js` and write a custom SW. Heavier maintenance — only needed for advanced cases.

---

## 8. Server-side push send

Same shape as `cometchat-react-push` Section 6. Different payload shape — Angular SW expects the wrapped `{ notification: {...} }` form:

```ts
const payload = JSON.stringify({
  notification: {
    title: sender.name,
    body: truncate(data.text, 80),
    icon: sender.avatar ?? "/icons/chat.png",
    tag: `chat-${receiver}`,
    data: {
      conversationId: receiver,
      senderUid: sender.uid,
      receiverType: data.entityType,
    },
  },
});
```

The webhook setup, signature verification, and dead-subscription cleanup are identical to the React version.

---

## 9. CometChat webhook setup

Same as `cometchat-react-push` Section 7 — configure in CometChat dashboard, point at your push server, copy the signing secret.

---

## 10. Angular Universal (SSR) considerations

If your app uses Angular Universal:

```ts
// services/push.service.ts
import { isPlatformBrowser } from "@angular/common";
import { Inject, PLATFORM_ID } from "@angular/core";

@Injectable({ providedIn: "root" })
export class PushService {
  constructor(
    private swPush: SwPush,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    if (!isPlatformBrowser(this.platformId)) return;        // skip on server
    this.swPush.notificationClicks.subscribe(/* ... */);
  }

  async subscribe(uid: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.swPush.isEnabled) return;
    // ...
  }
}
```

Without these guards, the SSR build crashes at boot with `ReferenceError: ServiceWorkerRegistration is not defined`.

`@angular/service-worker` itself ships with SSR-safe stubs, but downstream code that touches `swPush.subscription` etc. needs guards.

---

## 11. iOS Safari 16.4+ PWA-only caveat

Same as `cometchat-react-push` Section 9 — iOS Web Push works ONLY for sites added to the Home Screen as PWAs. Angular CLI generates `manifest.webmanifest` automatically when you `ng add @angular/pwa`; verify it's present and correct:

```json
{
  "name": "Your App",
  "short_name": "YourApp",
  "theme_color": "#1976d2",
  "background_color": "#fafafa",
  "display": "standalone",
  "start_url": "/",
  "icons": [/* ... */]
}
```

iOS users must use Safari → Share → "Add to Home Screen" once for Web Push to work.

---

## 12. HTTPS requirement

Service Workers + Push API both require HTTPS (or `localhost`). `ng serve --ssl` works for local HTTPS dev.

For production: Vercel / Netlify / Cloudflare Pages / Firebase Hosting all default to HTTPS.

---

## 13. Build + deploy

`@angular/service-worker` generates `ngsw-worker.js` at build time:

```bash
ng build --configuration production
```

Output: `dist/your-app/ngsw-worker.js` + `dist/your-app/ngsw.json` (the SW config baked in).

Deploy these files alongside `index.html`. The SW updates automatically when `ngsw.json` changes (a hash of all included assets); users get the new SW on next page load.

---

## 14. Anti-patterns

1. **Calling `swPush.requestSubscription()` from `ngOnInit`.** Browsers reject permission requests not tied to user gestures. Wire to a button click.
2. **Subscribing on `OnInit` of a lazy module.** Lazy modules instantiate after navigation; user has already missed pushes during navigation. Subscribe in eager AppModule.
3. **Sending the Auth Key in push payloads.** Visible in the Service Worker. Use the user's UID as a key into your server.
4. **Skipping the SSR guard** in Angular Universal projects. SSR boot crashes.
5. **Not unsubscribing on logout.** Previous user keeps getting notifications for the new user's messages.
6. **Hardcoding the VAPID public key in `environment.ts`.** It's not secret (it's "public"), but rotate-able is better — read from runtime config.
7. **Using `*ngIf="enabled"` based on a local boolean** instead of `swPush.subscription` observable. Multi-tab scenarios get out of sync.

---

## 15. Verification checklist

- [ ] `@angular/service-worker` installed via `ng add`
- [ ] `ngsw-config.json` exists and excludes CometChat API from caching
- [ ] `ServiceWorkerModule.register('ngsw-worker.js', { enabled: !isDevMode() })` in AppModule
- [ ] `PushService` injects `SwPush`
- [ ] `swPush.notificationClicks.subscribe` routes to the conversation
- [ ] VAPID public key in `environment.ts`; private key in server env (NOT client)
- [ ] Subscribe via a user-clicked button, not OnInit
- [ ] Subscription registered AFTER login resolves
- [ ] Logout unsubscribes BEFORE `CometChatUIKit.logout()`
- [ ] Server sends `{ notification: {...} }` payload shape (Angular SW format)
- [ ] CometChat dashboard webhook configured + signature verified
- [ ] HTTPS or localhost only
- [ ] `manifest.webmanifest` present for iOS PWA support
- [ ] Angular Universal: `isPlatformBrowser` guards in PushService

---

## 16. Pointers

- `cometchat-react-push` — sister skill; covers VAPID, server-side webhook, iOS PWA caveat in depth
- `cometchat-angular-core` — login order
- `cometchat-angular-patterns` — module setup, lazy loading
- `cometchat-angular-troubleshooting` — SW registration debugging, ngsw issues
