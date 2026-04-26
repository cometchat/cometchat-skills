---
name: cometchat-native-push
description: "Push notifications for React Native CometChat — APNs + FCM setup, dashboard provider configuration, client registration, token lifecycle, foreground display, background wake, tap-to-deep-link, and the Expo Go / APNs-environment traps that silently break production."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5; @cometchat/chat-sdk-react-native ^4; @react-native-firebase/messaging ^18"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native push notifications apns fcm firebase expo"
---

## Purpose

Teaches Claude how to add push notifications to a CometChat React Native integration — end-to-end, from Apple Developer / Google Cloud setup through CometChat dashboard provider configuration, client token registration, foreground/background handling, and tap-to-deep-link.

**Push is non-negotiable for production chat.** Without it, a backgrounded app never wakes when a message arrives. The user doesn't see the message, doesn't re-open the app, and stops using chat. This is THE feature that separates "works in demo" from "works in production."

Ground truth: `examples/SampleAppWithPushNotifications/` in `@cometchat/chat-uikit-react-native@5.3.3`, `docs/sdk/react-native/push-notification-setup.mdx`, and `https://www.cometchat.com/docs/notifications/push-integration`.

---

## 1. The moving pieces

Push spans four systems that must all agree:

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌────────┐
│ Apple /     │    │ CometChat   │    │ CometChat    │    │ RN     │
│ Google      │ →  │ Dashboard   │ →  │ server       │ →  │ client │
│ (APNs/FCM)  │    │ (providers) │    │ (via SDK)    │    │ (app)  │
└─────────────┘    └─────────────┘    └──────────────┘    └────────┘
 p8 key / JSON     Uploaded creds    Webhook on message   Displays notif
```

When user A sends a message to user B:
1. CometChat server receives the message
2. Looks up B's registered push tokens (client did this at login)
3. Sends a push via APNs (iOS) or FCM (Android) using the credentials the dashboard holds
4. B's device receives it, OS wakes the app (or fires foreground handler)
5. Notification displays; tap → app navigates to the conversation

All five steps must work. A broken step is almost always silent — no log, no error, just no notification. Debugging requires checking each layer.

---

## 2. Expo Go CANNOT receive push notifications

**This is the #1 support ticket from Expo users.** Expo Go is a prebuilt shell app without your custom native modules — it has no APNs entitlement, no FCM configuration, no way to receive your app's push.

**For push, Expo projects require a development build:**
```bash
npx expo install expo-dev-client
npx expo prebuild --clean   # generates ios/ + android/ with native configuration
eas build --profile development --platform ios       # or android
```

Open the resulting `.ipa` / `.apk` and run `npx expo start --dev-client`. This is the only Expo setup that can receive push.

If a user reports "I set everything up but no notifications arrive" and they're running Expo Go, that's the answer — no code fix will help.

---

## 3. APNs setup (iOS)

### 3a. Create an APNs Auth Key (p8)

Apple's two options for signing push — certificate (`.p12`) or auth key (`.p8`). Use `.p8`. It never expires, one key works for all your apps, and CometChat accepts the simpler key format.

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → **Keys** → "+"
2. Name it (e.g., "CometChat APNs"), check **Apple Push Notifications service (APNs)**, Continue, Register
3. **Download the `.p8` file** (one-time — Apple never lets you download it again)
4. Copy the **Key ID** (10-char alphanumeric, shown on the key page)
5. From the membership page, copy your **Team ID** (10-char alphanumeric, top-right)
6. Collect your app's **Bundle ID** (from `ios/<Name>.xcodeproj` → Targets → General)

You'll paste all four into the CometChat dashboard in §5.

### 3b. Enable Push Notifications capability in Xcode

```
Open ios/<Name>.xcworkspace
Select the project → Signing & Capabilities tab
Click "+ Capability" → "Push Notifications"
Click "+ Capability" → "Background Modes"
  In Background Modes, check:
    - Remote notifications
    - Voice over IP (only if integrating CometChat calls)
```

This writes `aps-environment` (development or production) into the entitlements file. Wrong environment is the #1 silent-failure in §10.

### 3c. Two environments — the TestFlight / App Store trap

APNs has two parallel networks:
- **Development** (`aps-environment: development`) — Xcode dev builds. Uses dev key paths.
- **Production** (`aps-environment: production`) — TestFlight, App Store, Ad-Hoc. Uses prod key paths.

The p8 auth key you generated in 3a works for **both** environments. But CometChat has to know which environment the token came from. If you upload the p8 only as "Development" in the dashboard, TestFlight builds silently fail — a token arrives from production APNs but the dashboard has no matching credentials.

**Fix:** upload the same p8 twice in the CometChat dashboard — once as Development provider, once as Production provider. Then register with the matching provider ID at runtime (§7).

---

## 4. FCM setup (Android)

### 4a. Create a Firebase project + service account

1. https://console.firebase.google.com → **Add project** → name it, continue through setup
2. **Project Settings** (gear icon) → **Service accounts** tab
3. **Generate new private key** → downloads a `.json` file with your server credentials

This JSON file is what CometChat's dashboard needs.

### 4b. Add Android app to Firebase + download google-services.json

1. Project Overview → **Add app** → Android
2. Enter your app's **package name** (from `android/app/build.gradle` → `applicationId`)
3. Download `google-services.json`
4. Place it at `android/app/google-services.json`
5. Add this line at the end of `android/app/build.gradle`:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```
6. In `android/build.gradle` under `buildscript.dependencies`:
   ```gradle
   classpath 'com.google.gms:google-services:4.4.2'
   ```

**Expo managed:** `google-services.json` goes in the project root, and you reference it in `app.json`:
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "plugins": ["@react-native-firebase/app", "@react-native-firebase/messaging"]
  }
}
```

### 4c. iOS Firebase config (if using firebase/messaging on iOS)

`react-native-firebase/messaging` wraps APNs under the hood on iOS, so the APNs setup in §3 is what actually powers iOS push. BUT Firebase expects a `GoogleService-Info.plist` even though it doesn't route iOS push through FCM:
1. Add iOS app in Firebase console (Project Overview → Add app → iOS)
2. Download `GoogleService-Info.plist`
3. Add it to `ios/<Name>/` via Xcode (Right-click project → Add Files)
4. In Expo: put it at project root and reference in `app.json`:
   ```json
   { "expo": { "ios": { "googleServicesFile": "./GoogleService-Info.plist" } } }
   ```

---

## 5. CometChat dashboard — upload credentials

https://app.cometchat.com → your app → **Notifications** → **Push Notifications**

### 5a. Add an APNs provider (per environment)

- **Add Provider** → choose APNs
- Provider name: `apns-dev` (or similar)
- Environment: **Development**
- Upload the `.p8` file from §3a
- Paste Key ID, Team ID, Bundle ID
- Save → copy the **Provider ID** string (you'll need it in §7)

Repeat for Production:
- Provider name: `apns-prod`
- Environment: **Production**
- Same p8, Key ID, Team ID, Bundle ID
- Save → copy the second Provider ID

If you skip the production provider, TestFlight / App Store builds will silently not receive push.

### 5b. Add an FCM provider

- **Add Provider** → choose FCM
- Provider name: `fcm-default`
- Upload the service account `.json` file from §4a
- Save → copy the Provider ID

### 5c. Cache the Provider IDs

You'll have 2-3 provider IDs. Store them in a config constant in your app:
```ts
// src/config/push.ts
export const PUSH_PROVIDERS = {
  fcm: "fcm-<hex-from-dashboard>",
  apnsDev: "apns-dev-<hex-from-dashboard>",
  apnsProd: "apns-prod-<hex-from-dashboard>",
};
```

At runtime (§7), you'll pick the right one based on platform + `__DEV__`.

---

## 6. Install client packages

### Bare React Native

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging \
  @notifee/react-native @react-native-community/push-notification-ios

cd ios && pod install && cd ..
```

- `@react-native-firebase/app` — initializes Firebase (reads GoogleService-Info.plist / google-services.json)
- `@react-native-firebase/messaging` — FCM on Android AND APNs on iOS (Firebase handles both)
- `@notifee/react-native` — local notification display (for foreground messages on Android; required because FCM data-only pushes don't auto-display)
- `@react-native-community/push-notification-ios` — iOS APNs device token retrieval + notification tap handling (`getInitialNotification`, `addEventListener`)

### Expo managed (dev build)

```bash
npx expo install @react-native-firebase/app @react-native-firebase/messaging \
  @notifee/react-native @react-native-community/push-notification-ios expo-dev-client
npx expo prebuild --clean
```

Then build a dev client (§2) and run `npx expo start --dev-client`.

**iOS permissions in `ios/<Name>/Info.plist`:** no changes needed for basic push.

**Android permissions in `android/app/src/main/AndroidManifest.xml`:**
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

For Expo managed, put permissions in `app.json`:
```json
{
  "expo": {
    "android": {
      "permissions": ["POST_NOTIFICATIONS", "WAKE_LOCK"]
    }
  }
}
```

---

## 7. Register the push token with CometChat

The canonical API — confirmed from `examples/SampleAppWithPushNotifications/src/utils/PushNotification.tsx`:

```ts
import { CometChatNotifications } from "@cometchat/chat-sdk-react-native";
```

`CometChatNotifications.PushPlatforms` enum values:

| Platform | Enum value |
|---|---|
| Android (FCM) | `FCM_REACT_NATIVE_ANDROID` |
| iOS (FCM — Firebase proxies APNs) | `FCM_REACT_NATIVE_IOS` |
| iOS (APNs direct, non-VoIP) | `APNS_REACT_NATIVE_DEVICE` |
| iOS (APNs VoIP — calls only) | `APNS_REACT_NATIVE_VOIP` |

Most apps use FCM on both platforms (simpler — Firebase handles the APNs dance). Only use `APNS_REACT_NATIVE_DEVICE` if you're registering the raw APNs device token without Firebase in between.

### 7a. Canonical register helper

```ts
// src/push/registerPushToken.ts
import { Platform } from "react-native";
import { CometChatNotifications } from "@cometchat/chat-sdk-react-native";
import { PUSH_PROVIDERS } from "../config/push";

export async function registerPushToken(token: string): Promise<void> {
  const platform =
    Platform.OS === "android"
      ? CometChatNotifications.PushPlatforms.FCM_REACT_NATIVE_ANDROID
      : CometChatNotifications.PushPlatforms.FCM_REACT_NATIVE_IOS;

  // Single FCM provider covers both platforms when using firebase/messaging.
  const providerId = PUSH_PROVIDERS.fcm;

  try {
    await CometChatNotifications.registerPushToken(token, platform, providerId);
  } catch (err) {
    console.error("[push] registerPushToken failed", err);
  }
}
```

### 7b. Fetch the FCM token and register (after login)

```ts
// src/push/bootstrap.ts
import messaging from "@react-native-firebase/messaging";
import { registerPushToken } from "./registerPushToken";

export async function bootstrapPushAfterLogin(): Promise<void> {
  await messaging().registerDeviceForRemoteMessages();
  const token = await messaging().getToken();
  await registerPushToken(token);

  // Re-register when the token rotates (rare but it happens — new install, app restore).
  messaging().onTokenRefresh(async (newToken) => {
    await registerPushToken(newToken);
  });
}
```

Call `bootstrapPushAfterLogin()` in the same effect that runs `CometChatUIKit.login()`. Order matters — the SDK needs a logged-in user to associate the token with.

### 7c. Unregister on logout

```ts
import { CometChatNotifications } from "@cometchat/chat-sdk-react-native";

export async function unregisterPushTokenOnLogout(): Promise<void> {
  try {
    await CometChatNotifications.unregisterPushToken();
  } catch (err) {
    console.error("[push] unregisterPushToken failed", err);
  }
}
```

Call this BEFORE `CometChatUIKit.logout()` — after logout the SDK can't resolve the user to unregister the token against.

If the user switches accounts without logging out (bad pattern, but it happens), re-register with the new user after login. CometChat auto-scopes push to the current user.

---

## 8. Permissions — ask early, handle deny gracefully

### iOS

iOS prompts the user on the first call to `messaging().requestPermission()`. Do it early in the onboarding flow (post-login is fine), not in the first render — a permission prompt on app open looks hostile.

```ts
import messaging from "@react-native-firebase/messaging";

async function requestIosPush(): Promise<boolean> {
  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}
```

### Android

Android 13+ requires the `POST_NOTIFICATIONS` runtime permission (prior versions grant it automatically from the manifest).

```ts
import { PermissionsAndroid, Platform } from "react-native";

async function requestAndroidPush(): Promise<boolean> {
  if (Platform.OS !== "android" || Platform.Version < 33) return true;
  const status = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return status === PermissionsAndroid.RESULTS.GRANTED;
}
```

### Handle deny

If the user denies, don't retry — it just shows the system "open Settings" prompt. Surface a small UI nudge in chat settings: "Enable push notifications — so you know when you get a message." Link to `Linking.openSettings()`.

---

## 9. Display, background, tap

### 9a. Foreground messages (Android)

FCM on Android delivers data-only pushes while the app is foregrounded — the OS does NOT display them automatically. You have to render a local notification with `@notifee/react-native`:

```ts
import messaging from "@react-native-firebase/messaging";
import notifee, { AndroidImportance } from "@notifee/react-native";

messaging().onMessage(async (remoteMessage) => {
  const { title, body } = remoteMessage.data ?? {};
  const channelId = await notifee.createChannel({
    id: "chat-messages",
    name: "Chat Messages",
    importance: AndroidImportance.HIGH,
  });
  await notifee.displayNotification({
    title: title ?? "New Message",
    body: body ?? "You received a new message.",
    android: { channelId, pressAction: { id: "default" } },
    data: remoteMessage.data, // preserved for tap handling
  });
});
```

iOS foregrounding behavior is configured by `messaging().setForegroundNotificationPresentationOptions(...)` — set it once at app startup. Default is "don't display" (iOS assumes the app handles it), so you must opt-in to badges/banners/sounds.

### 9b. Background / killed messages

OS-delivered, no code needed. The notification displays as an OS notification. Tap handling: see §9c.

### 9c. Tap to deep-link

Three scenarios to handle:

**iOS — app killed, tap opens the app:**
```ts
import PushNotificationIOS from "@react-native-community/push-notification-ios";

async function checkInitialNotificationIOS(): Promise<void> {
  const notification = await PushNotificationIOS.getInitialNotification();
  if (!notification) return;
  const data = notification.getData();
  navigateFromPayload(data);
}
```

**iOS — app in background, tap foregrounds:**
```ts
PushNotificationIOS.addEventListener("notification", (notification) => {
  const data = notification.getData();
  if (data.userInteraction === 1) {
    navigateFromPayload(data);
  }
  notification.finish(PushNotificationIOS.FetchResult.NoData);
});
```

**Android (via messaging):**
```ts
import messaging from "@react-native-firebase/messaging";

// App killed → tap → opens app
messaging().getInitialNotification().then((remoteMessage) => {
  if (remoteMessage?.data) navigateFromPayload(remoteMessage.data);
});

// App backgrounded → tap → foregrounds
messaging().onNotificationOpenedApp((remoteMessage) => {
  if (remoteMessage?.data) navigateFromPayload(remoteMessage.data);
});

// Foreground local notification (displayed via notifee in §9a) → tap
import notifee, { EventType } from "@notifee/react-native";
notifee.onForegroundEvent(({ type, detail }) => {
  if (type === EventType.PRESS) {
    navigateFromPayload(detail.notification?.data ?? {});
  }
});
```

### 9d. Payload → navigation

CometChat's push payload schema (confirmed from `examples/SampleAppWithPushNotifications/src/utils/helper.ts`):

```ts
{
  type: "chat",
  receiverType: "user" | "group",
  sender: "<uid>",
  receiver: "<uid-or-guid>",
  conversationId: "<compound-id>",
  unreadMessageCount: "<number-as-string>",
  title: "Alice",
  body: "Hey, you around?",
  senderAvatar: "<url>",
  tag: "<messageId>",
  message: "<JSON-stringified-full-message>",   // parse for parentId, id, etc.
}
```

Parse it into navigation params:

```ts
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { navigate } from "./NavigationService";   // createNavigationContainerRef wrapper

async function navigateFromPayload(data: Record<string, unknown>): Promise<void> {
  if (data.type !== "chat") return;

  let parentMessageId: string | undefined;
  if (typeof data.message === "string") {
    try {
      parentMessageId = JSON.parse(data.message).parentId;
    } catch {}
  }

  if (data.receiverType === "group" && typeof data.receiver === "string") {
    const group = await CometChat.getGroup(data.receiver);
    navigate("Messages", { group, ...(parentMessageId ? { parentMessageId } : {}) });
  } else if (data.receiverType === "user" && typeof data.sender === "string") {
    const user = await CometChat.getUser(data.sender);
    navigate("Messages", { user, ...(parentMessageId ? { parentMessageId } : {}) });
  }
}
```

Use React Navigation's `createNavigationContainerRef` so you can navigate from outside React (the tap handler fires before the component tree mounts on app launch):

```ts
// src/navigation/NavigationService.ts
import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: unknown): void {
  if (navigationRef.isReady()) navigationRef.navigate(name as never, params as never);
  else setTimeout(() => navigate(name, params), 100);   // wait for mount
}
```

In the root layout:
```tsx
<NavigationContainer ref={navigationRef}>…</NavigationContainer>
```

For Expo Router, use the `router` from `expo-router` inside the tap handler — no navigation ref needed, but check `router.canGoBack()` before pushing on cold start.

---

## 10. Badge count

CometChat sends `unreadMessageCount` in the payload. Set it on iOS via `PushNotificationIOS.setApplicationIconBadgeNumber(count)` inside the notification handler. On Android, Notifee's `setBadgeCount()` works on most launchers but is inconsistent (Samsung, Xiaomi have their own rules).

Reset badge to 0 when the user opens a conversation:
```ts
import { AppState, Platform } from "react-native";
import PushNotificationIOS from "@react-native-community/push-notification-ios";
import notifee from "@notifee/react-native";

function clearBadge(): void {
  if (Platform.OS === "ios") PushNotificationIOS.setApplicationIconBadgeNumber(0);
  else notifee.setBadgeCount(0);
}
```

---

## 11. Testing the push pipeline

End-to-end verification — run each step in order and stop at the first failure. Silent failures are the norm, so testing each layer separately is faster than chasing a black box.

1. **APNs alone** (iOS): In Firebase Console → Cloud Messaging → Send test message to your FCM token. If this arrives, Firebase + APNs are fine.
2. **FCM alone** (Android): Same as above — Firebase test message. If it arrives, FCM + `google-services.json` are fine.
3. **CometChat provider → device**: Send a message to the logged-in user from another user. If this fails but step 1/2 worked, the issue is in the CometChat dashboard provider config (wrong p8 environment, wrong bundle ID, expired service account).
4. **Tap deep-links correctly**: Put the app in background, send a message, tap the notification. App should land on the right conversation.
5. **TestFlight / App Store**: Build an archive, upload to TestFlight, install on a real device (NOT the simulator — iOS simulator cannot receive real APNs). Repeat step 3. This is where the "production APNs provider not uploaded" trap appears.

---

## 12. Troubleshooting — common silent failures

| Symptom | Likely cause | Fix |
|---|---|---|
| Dev works, TestFlight doesn't | Production APNs provider not uploaded OR `aps-environment` is still `development` in release build | Upload prod p8 provider (§5a). Check `ios/<Name>/<Name>.entitlements` has `aps-environment: production` for Release config |
| No iOS simulator notifications | Simulator can't receive real APNs | Use a real device |
| `requestPermission()` never prompts | Already denied — prompt won't re-show | `Linking.openSettings()` and tell user to toggle Notifications on |
| Token prints but no push arrives | Token registered BEFORE login | Call `registerPushToken` AFTER `CometChatUIKit.login` resolves |
| Android foreground: OS notif shows | FCM delivered as notification + data (CometChat sends data-only now); old app code | Update to firebase/messaging ≥18 — old versions force auto-display |
| Android foreground: nothing shows | No `onMessage` handler OR no notifee channel created | Add `messaging().onMessage` + `notifee.createChannel` (§9a) |
| "Default FirebaseApp is not initialized" | google-services.json missing or build plugin not applied | Re-check §4b. Clean build: `cd android && ./gradlew clean` |
| Notification tap doesn't navigate | NavigationContainer not ready when tap handler fires | Use the `setTimeout` retry pattern in `navigate()` (§9d) |
| Expo app receives nothing in Expo Go | Expo Go can't receive push | Build a dev client (§2) |
| Token refreshes but CometChat still uses old | `onTokenRefresh` listener not wired | Wire in `bootstrapPushAfterLogin` (§7b) |
| Works for User A but not User B after logout | `unregisterPushToken` not called on logout | Call BEFORE `logout()` (§7c) |
| iOS push arrives but `data` is empty | Payload is APS-only (no `content-available`) — CometChat default is correct; check if custom template stripped data | Check dashboard → Notifications → Template |

---

## 13. Hard rules

- **Register AFTER login.** The SDK needs a logged-in user to scope the token. Register before login and the token lands against "anonymous."
- **Unregister BEFORE logout.** The SDK needs to know the user to dissociate the token.
- **Call `onTokenRefresh`.** FCM rotates tokens. Missing the rotation means push stops working after a few weeks for some users.
- **Upload both APNs environments.** Dev + Production. Missing Production = silent TestFlight/App Store breakage.
- **Expo Go is a dead-end.** Build a dev client for push. No exceptions.
- **Don't auto-display on Android foreground.** Show a local notification via Notifee so the user sees the message.
- **Don't ship without testing on a real device.** iOS simulator doesn't receive real APNs.

---

## 14. Skill routing

| This skill | Covers |
|---|---|
| `cometchat-native-push` (this) | APNs + FCM + CometChat dashboard + client registration + tap handling |
| `cometchat-native-core` | Init, login, four-wrapper chain, login concurrency guard |
| `cometchat-native-features` | Calling SDK (`@cometchat/calls-sdk-react-native`) — push for VoIP is a separate channel (use `APNS_REACT_NATIVE_VOIP` + `react-native-voip-push-notification`) |
| `cometchat-native-production` | Server-minted auth tokens + user CRUD. Register push only after login; if using auth tokens, register after `login({ authToken })` |
| `cometchat-native-bare-patterns` | `pod install` + Xcode capability steps |
| `cometchat-native-expo-patterns` | `expo prebuild` + dev client setup |
| `cometchat-native-troubleshooting` | Metro cache, Podfile.lock, Android Maven. Push-specific symptoms are in §12 here |
