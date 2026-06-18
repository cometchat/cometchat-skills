---
name: cometchat-angular-push
description: Push notifications for CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) — web push via Firebase Cloud Messaging (FCM) + the CometChat Notifications API. Covers dashboard FCM provider setup, the firebase-messaging-sw.js service worker, Notification permission, getting the FCM token, registering it with CometChatNotifications.registerPushToken + PushPlatforms.FCM_WEB AFTER login, an Angular PushService, environment config, foreground vs background handling, click-through routing, and logout cleanup.
license: "MIT"
compatibility: "Angular >=17 <22; @cometchat/chat-uikit-angular ^5.0; @cometchat/chat-sdk-javascript ^4.1"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular web push notifications fcm firebase service-worker registerPushToken PushPlatforms notifications-api standalone v5"
---

## Purpose

Web push for CometChat **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`). On the web, CometChat push runs through **Firebase Cloud Messaging (FCM)** plus the **CometChat Notifications API** — CometChat hosts the send path. You do NOT build your own push server or webhook for the basic flow: configure an FCM provider in the CometChat dashboard, register the browser's FCM token with `CometChatNotifications.registerPushToken(...)`, and CometChat delivers a push whenever a message arrives for that user.

This is the v5 (standalone, Angular 17–21) rewrite. The previous v4 skill used `@angular/service-worker` + `SwPush` + a self-hosted VAPID web-push server + a CometChat webhook. **That hand-rolled path is replaced** — v5 uses FCM end-to-end through the CometChat Notifications API, which is the documented, supported web-push path.

**Read these skills first:**
- `cometchat-angular-core` — `UIKitSettingsBuilder` init, Promise-based `login(uid)` (bare string), `loggedInUser$`, environment config. Push registration hangs off the same login lifecycle.
- `cometchat-react-push` is the React sibling for the *self-hosted* Web Push model; the FCM + `CometChatNotifications` plumbing in THIS skill is the shared web SDK API and is the recommended path for both. Where they differ, this skill wins for Angular.
- `cometchat-angular-production` — server-minted auth tokens (push registration is tied to the logged-in auth token).

**Ground truth (verify before relying on any symbol):** **Official docs:** https://www.cometchat.com/docs/notifications/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).
- Chat SDK types: `node_modules/@cometchat/chat-sdk-javascript/CometChat.d.ts` — `CometChatNotifications`, `PushPlatforms`.
- FCM (web): https://firebase.google.com/docs/cloud-messaging/js/client
- CometChat dashboard → **Notifications** → **Push Notifications** (FCM provider config).

> The Chat SDK is `@cometchat/chat-sdk-javascript@^4.1`. The web push API documented below is its **real** notification API — `CometChatNotifications.registerPushToken`, `PushPlatforms.FCM_WEB`, `CometChatNotifications.unregisterPushToken`. Do not substitute mobile-only symbols (APNs, FCM_ANDROID, etc.) — the only web platform enum value is `FCM_WEB`.

---

## 1. Architecture

```
Browser (your Angular app)
  ├── Firebase JS SDK (firebase/messaging)  — gets the FCM registration token
  ├── firebase-messaging-sw.js              — service worker; receives background push
  └── Notification permission               — granted by the user

CometChat backend
  ├── FCM provider config (server key / service account)  ← set in dashboard
  └── Notifications service — sends an FCM push to the user's registered token(s)
                              whenever a message arrives for them

Your Angular code
  └── After login → get FCM token → CometChatNotifications.registerPushToken(token, FCM_WEB)
```

You own: the Firebase project, the service worker file, the permission prompt, token registration after login, and token cleanup on logout. CometChat owns the actual send. No self-hosted push server, no VAPID web-push library, no CometChat webhook for the basic flow.

---

## 2. Dashboard — enable the FCM push provider (one-time)

In the CometChat dashboard:

1. **Notifications** → **Push Notifications** → enable.
2. Add a **provider** of type **FCM**.
3. Supply your Firebase credentials. Modern FCM (HTTP v1) wants the **service-account JSON** (from Firebase Console → Project settings → Service accounts → Generate new private key). Older configs accept the legacy **Server Key** + **Sender ID** (Cloud Messaging tab). Match whatever the dashboard's FCM form currently asks for.
4. Note the **Provider ID** you assign (default is `default`). You pass this same string as the third arg to `registerPushToken` if you used a non-default provider.

The Firebase **web app config** (`apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`) and the **VAPID key pair** (Firebase Console → Cloud Messaging → Web configuration → "Web Push certificates") are client-side — they go in `environment.ts` (§4). The service-account JSON / Server Key is **server-side only** — it lives in the CometChat dashboard, never in your Angular bundle.

---

## 3. Install Firebase + add the service worker

```bash
npm install firebase
```

> Do **not** use `@angular/service-worker` / `SwPush` for CometChat web push — FCM ships its own service worker contract (`firebase-messaging-sw.js`) and the Firebase JS SDK manages the token. The v4 `ngsw` path is gone.

### `src/firebase-messaging-sw.js`

This file MUST be served from the origin root (`/firebase-messaging-sw.js`) — `firebase.messaging()` registers it by that exact path. Add it as an Angular asset so the build copies it to the output root.

```js
// src/firebase-messaging-sw.js
// Loaded by the browser as a service worker — runs OUTSIDE Angular.
// Use the compat builds; ES module imports are not available in classic SWs.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
});

const messaging = firebase.messaging();

// Background handler — fires when the tab is closed/backgrounded.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? payload.data?.senderName ?? "New message";
  self.registration.showNotification(title, {
    body: payload.notification?.body ?? payload.data?.text ?? "",
    icon: payload.notification?.icon ?? "/assets/chat-icon.png",
    tag: payload.data?.conversationId,          // dedupe per conversation
    data: payload.data ?? {},                   // carried into notificationclick
  });
});

// Click-through — focus an open tab or open a new one, deep-linking to the thread.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.receiverType === "group"
    ? `/messages/group/${data.conversationId}`
    : `/messages/user/${data.sender}`;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) { w.focus(); w.postMessage({ type: "open_conversation", ...data }); return; }
      }
      return clients.openWindow(url);
    })
  );
});
```

> The `payload.data` keys (`conversationId`, `sender`, `receiverType`, `text`, `senderName`) are whatever CometChat's FCM payload carries — confirm the exact field names against a real push in DevTools → Application → Service Workers, and adjust. Do not assume; CometChat's data-payload shape is the source of truth.

### Register the SW file as an Angular asset

`angular.json` → `projects.<app>.architect.build.options.assets` (alongside the mandatory CometChat assets glob from `cometchat-angular-core` §2):

```json
{ "glob": "firebase-messaging-sw.js", "input": "src", "output": "/" }
```

Build output then serves it at `/firebase-messaging-sw.js`. Verify after `ng build` that the file is at the dist root, not under `assets/`.

---

## 4. Environment config

Angular has no `process.env`. The Firebase web config + VAPID key live in `src/environments/environment.ts` (these are publishable client values — `apiKey` here is a Firebase identifier, not a secret):

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  cometchat: {
    appId: "YOUR_APP_ID",
    region: "us",                 // "us" | "eu" | "in"
    authKey: "YOUR_AUTH_KEY",     // dev only
  },
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID",
    vapidKey: "YOUR_WEB_PUSH_CERTIFICATE_KEY_PAIR",   // FCM → Web configuration
  },
  // Provider ID set in the dashboard (§2). Omit / "default" if you didn't change it.
  cometchatPushProviderId: "default",
};
```

Keep the same shape in `environment.prod.ts`. The CometChat **REST API Key** and the Firebase **service-account JSON** never appear in any `src/` file — Angular ships `src/` to the client.

---

## 5. PushService — get the FCM token and register it

```typescript
// src/app/services/push.service.ts
import { Injectable, Inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { Router } from "@angular/router";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken, Messaging } from "firebase/messaging";
import { CometChatNotifications } from "@cometchat/chat-sdk-javascript";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class PushService {
  private messaging: Messaging | null = null;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    if (!isPlatformBrowser(this.platformId)) return;       // SSR / prerender guard
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    const app = initializeApp(environment.firebase);
    this.messaging = getMessaging(app);

    // Foreground messages: the SW background handler does NOT fire while the tab
    // is focused. Decide your own UX here (toast, in-app banner, or a manual
    // Notification). Don't double-notify.
    onMessage(this.messaging, (payload) => {
      // e.g. show an in-app toast; skip an OS notification if the chat is focused.
      console.debug("Foreground push:", payload);
    });

    // SW → app messages from notificationclick (deep-link into the thread).
    navigator.serviceWorker?.addEventListener("message", (event: MessageEvent) => {
      const d = event.data;
      if (d?.type === "open_conversation") {
        const url = d.receiverType === "group"
          ? `/messages/group/${d.conversationId}`
          : `/messages/user/${d.sender}`;
        this.router.navigateByUrl(url);
      }
    });
  }

  /** Call AFTER CometChatUIKit.login(uid) resolves. Must be user-gesture-initiated
   *  (Notification.requestPermission requires it on most browsers). */
  async register(): Promise<void> {
    if (!this.messaging) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;                  // user declined — bail quietly

    // The Firebase SDK registers /firebase-messaging-sw.js itself; pass the
    // VAPID key from the FCM Web configuration.
    const fcmToken = await getToken(this.messaging, { vapidKey: environment.firebase.vapidKey });
    if (!fcmToken) return;

    // The ONE call that wires the browser into CometChat's push pipeline.
    await CometChatNotifications.registerPushToken(
      fcmToken,
      CometChatNotifications.PushPlatforms.FCM_WEB,   // = "fcm_web" — the only web value
      environment.cometchatPushProviderId,                     // optional; defaults to "default"
    );
  }

  /** Call BEFORE CometChatUIKit.logout(). Order matters — registration is tied
   *  to the current auth token, which logout invalidates. */
  async unregister(): Promise<void> {
    if (!this.messaging) return;
    try {
      await CometChatNotifications.unregisterPushToken();   // clears CometChat-side
    } finally {
      await deleteToken(this.messaging).catch(() => {});              // clears the FCM token too
    }
  }
}
```

**API notes (verified against the v5 Chat SDK `.d.ts`):**
- `CometChatNotifications.registerPushToken(pushToken: string, platform: PushPlatforms, providerId?: string): Promise<string>` — registers the FCM token against the **current logged-in auth token**. Third arg is optional and defaults to `"default"`.
- `PushPlatforms.FCM_WEB = "fcm_web"` — the **only** web platform value in the enum. There is no web APNs/Android variant.
- `CometChatNotifications.unregisterPushToken(): Promise<string>` — unregisters the token for the current auth token. Takes **no arguments**.
- Both are static members of the **top-level** `CometChatNotifications` class — import it directly: `import { CometChatNotifications } from "@cometchat/chat-sdk-javascript"`. It is NOT nested under the `CometChat` namespace (there is no `CometChat.CometChatNotifications`).
- `PushPlatforms` is itself a top-level export of the SDK; the enum is also re-exposed as a static on the class (`CometChatNotifications.PushPlatforms`). Either `PushPlatforms.FCM_WEB` (with a top-level import) or `CometChatNotifications.PushPlatforms.FCM_WEB` is valid — both resolve to `"fcm_web"`.

> Legacy note: the SDK also exposes the deprecated `CometChat.registerTokenForPushNotification(token, settings?)`. It predates the Notifications service. Do **not** use it for new v5 integrations — `CometChatNotifications.registerPushToken` is the current API.

---

## 6. Wire into the login lifecycle

Registration MUST happen **after** `login(uid)` resolves — `registerPushToken` binds the token to the live auth token. (See `cometchat-angular-core` §3–§4 for the init → login order; init resolves in `main.ts` before `bootstrapApplication` — the v5 canonical path; `APP_INITIALIZER` is an alternative — and login happens in your auth service / route guard.)

```typescript
// src/app/services/auth.service.ts
import { Injectable } from "@angular/core";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { PushService } from "./push.service";

@Injectable({ providedIn: "root" })
export class AuthService {
  constructor(private push: PushService) {}

  async login(uid: string): Promise<void> {
    const existing = CometChatUIKit.getLoggedInUser();      // sync getter, capital "In"
    if (!existing) {
      await CometChatUIKit.login(uid);                      // bare string in v5
    }
    // Push is opt-in + gesture-gated — do NOT auto-register here.
    // Call this.push.register() from a button click (see §7).
  }

  async logout(): Promise<void> {
    await this.push.unregister();                           // CRITICAL: before logout
    await CometChatUIKit.logout();
  }
}
```

---

## 7. "Enable notifications" button (gesture requirement)

`Notification.requestPermission()` must be called from a user gesture on most browsers — calling it from `ngOnInit` is silently rejected. Wire `register()` to a click:

```typescript
// src/app/components/enable-push.component.ts
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PushService } from "../services/push.service";
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-enable-push",
  standalone: true,
  imports: [CommonModule],
  template: `
    <button *ngIf="!enabled" (click)="enable()">Enable notifications</button>
  `,
})
export class EnablePushComponent {
  enabled = Notification.permission === "granted";

  constructor(private push: PushService) {}

  async enable(): Promise<void> {
    if (!CometChatUIKit.getLoggedInUser()) return;          // must be logged in first
    await this.push.register();
    this.enabled = Notification.permission === "granted";
  }
}
```

Mount it in the chat header, a settings page, or a one-time onboarding card.

---

## 8. Foreground vs background

- **Background / tab closed:** `onBackgroundMessage` in `firebase-messaging-sw.js` fires; you call `showNotification` (§3).
- **Foreground / tab focused:** the SW handler does **not** fire. `onMessage` in `PushService` fires instead (§5). Show an in-app toast/banner, or skip entirely if the relevant conversation is already on screen — never both, or the user sees a duplicate. CometChat's UI Kit already updates the message list live when the tab is focused, so a silent foreground handler is often the right call.

---

## 9. Notification permission states

`Notification.permission` is `"default"` (not yet asked), `"granted"`, or `"denied"`. Once `"denied"`, you cannot re-prompt programmatically — the user must change it in browser site settings. Reflect this in the UI: show the enable button only when `permission === "default"`, and a "notifications blocked — enable in browser settings" hint when `"denied"`.

---

## 10. HTTPS requirement

Service Workers, the Push API, and FCM all require **HTTPS** (or `http://localhost` for dev). On a LAN IP or plain `http://`, `getToken` and SW registration fail. Use `ng serve` (localhost is allowed) or `ng serve --ssl` for HTTPS-in-dev. Production hosts (Vercel / Netlify / Cloudflare Pages / Firebase Hosting) are HTTPS by default.

---

## 11. SSR / prerender (Angular Universal)

If the app uses SSR or prerendering, every Firebase/Notification touch must be browser-guarded — the `PushService` constructor already short-circuits with `isPlatformBrowser` (§5). Without it, `initializeApp` / `navigator.serviceWorker` throw `ReferenceError` at server boot. Keep all `firebase/messaging` access behind that guard; never call `register()` from server-rendered code paths.

---

## 12. Anti-patterns

1. **Registering the token before login resolves.** `registerPushToken` ties the token to the current auth token — call it only after `CometChatUIKit.login(uid)` succeeds.
2. **Calling `Notification.requestPermission()` from `ngOnInit`.** Browsers reject permission requests not tied to a user gesture. Use a clicked button (§7).
3. **Using `@angular/service-worker` / `SwPush`.** That was the v4 path. v5 web push uses Firebase's own `firebase-messaging-sw.js` + the FCM token — the two SW systems conflict if both register.
4. **Inventing platform enum values.** The only web value is `PushPlatforms.FCM_WEB` (`"fcm_web"`). There is no `FCM_ANDROID`/`APNS` for web.
5. **Using the deprecated `registerTokenForPushNotification`.** It predates the Notifications service; use `CometChatNotifications.registerPushToken`.
6. **Putting the Firebase service-account JSON / CometChat REST API Key in `environment.ts`.** Those are server-only (dashboard). The Firebase web config + VAPID key are the only push values that belong client-side.
7. **Serving `firebase-messaging-sw.js` from `/assets/`.** It must be at the origin root (`/firebase-messaging-sw.js`) or Firebase can't register it.
8. **Not unregistering on logout.** The previous user keeps receiving pushes. Call `unregisterPushToken()` (+ `deleteToken`) before `CometChatUIKit.logout()`.
9. **Double-notifying in the foreground.** `onMessage` and the SW `onBackgroundMessage` are mutually exclusive by tab focus — don't manually `showNotification` from foreground on top of the SW.
10. **No SSR guard in a Universal app.** `initializeApp` at server boot throws. Guard with `isPlatformBrowser`.

---

## 13. Verification checklist

- [ ] Dashboard: **Notifications → Push Notifications** enabled with an **FCM** provider; service-account JSON (or Server Key) supplied server-side
- [ ] `firebase` installed; `firebase-messaging-sw.js` in `src/`, registered as an Angular asset, served at `/firebase-messaging-sw.js` after build
- [ ] Firebase web config + VAPID key in `environment.ts`; service-account JSON / REST API Key NOT in any `src/` file
- [ ] `PushService` guards on `isPlatformBrowser` + `"serviceWorker" in navigator`
- [ ] `Notification.requestPermission()` fired from a user gesture (button), not `ngOnInit`
- [ ] FCM token fetched via `getToken(messaging, { vapidKey })`
- [ ] Token registered with `CometChatNotifications.registerPushToken(token, PushPlatforms.FCM_WEB, providerId)` **after** `login(uid)` resolves
- [ ] `onMessage` foreground handler defined; does not double-notify with the SW
- [ ] `onBackgroundMessage` + `notificationclick` in the SW deep-link to the conversation
- [ ] Logout calls `unregisterPushToken()` (+ `deleteToken`) BEFORE `CometChatUIKit.logout()`
- [ ] HTTPS or localhost only
- [ ] SSR projects keep all `firebase/messaging` access behind the browser guard

---

## 14. Pointers

- `cometchat-angular-core` — init → login order, `loggedInUser$`, environment config
- `cometchat-angular-production` — server-minted auth tokens (registration binds to the auth token)
- `cometchat-react-push` — sibling web-push concepts (self-hosted Web Push model; FCM + Notifications API here is the shared, recommended SDK path)
- `cometchat-angular-troubleshooting` — SW registration / FCM token debugging
