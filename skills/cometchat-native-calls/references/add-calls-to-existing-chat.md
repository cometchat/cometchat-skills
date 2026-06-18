# Adding calls to an existing chat integration (React Native)

Same shape as web (install SDK, init after chat, add IncomingCall) plus RN-specific work: native modules, CallKeep, VoIP push, foreground service permissions.

**Read first:** `cometchat-react-calls/references/add-calls-to-existing-chat.md` — canonical web steps.
**See also:** `cometchat-native-calls/SKILL.md` — RN seven hard rules.

---

## Pre-flight

```bash
grep -E '"@cometchat/(chat-sdk|chat-uikit)-react-native' package.json
```

Confirm chat SDK + UI Kit RN are present.

---

## Step 1 — Install calls SDK + native peers

```bash
npm install @cometchat/calls-sdk-react-native@5 \
  react-native-webrtc \
  react-native-incall-manager \
  react-native-callstats \
  react-native-callkeep \
  react-native-voip-push-notification \
  @react-native-firebase/messaging \
  @react-native-community/netinfo

cd ios && pod install && cd ..
```

Each native module has its own setup — review the `cometchat-native-calls` SKILL Step 2 for the full list.

---

## Step 2 — iOS: Info.plist + entitlements

```xml
<!-- ios/<App>/Info.plist -->
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
  <string>remote-notification</string>
</array>
<key>NSCameraUsageDescription</key>
<string>Camera access is required for video calls.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access is required for calls.</string>
```

Enable **Push Notifications** + **Background Modes** (Audio, Voice over IP) in your Xcode target → Signing & Capabilities.

---

## Step 3 — Android: manifest + permissions

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA"/>
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS"/>

<application ...>
  <service
    android:name="io.wazo.callkeep.RNCallKeepBackgroundMessagingService"
    android:foregroundServiceType="microphone|camera"
    android:exported="false" />
</application>
```

`foregroundServiceType` is **mandatory on Android 14+** — the rule is: a foreground service that uses mic/camera must declare those types or the OS kills it.

---

## Step 4 — Init order (chat → calls)

Same pattern as web. In your existing `cometchat-init.ts`:

```ts
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

await CometChat.init(APP_ID, settings);
await CometChatCalls.init({ appId: APP_ID, region: REGION });

// Later, after CometChat.login:
await CometChatCalls.loginWithAuthToken(authToken);
```

---

## Step 5 — Mount IncomingCall at root

```tsx
// App.tsx
import { CometChatIncomingCall } from "@cometchat/chat-uikit-react-native";

function App() {
  return (
    <NavigationContainer>
      <RootNavigator />
      <CometChatIncomingCall />   {/* Sibling of NavigationContainer's content */}
    </NavigationContainer>
  );
}
```

---

## Step 6 — CallKeep + VoIP push setup

```tsx
import RNCallKeep from "react-native-callkeep";
import VoipPushNotification from "react-native-voip-push-notification";
import { Platform } from "react-native";

const callKeepOptions = {
  ios: {
    appName: "Your App",
    supportsVideo: true,
    maximumCallGroups: "1",
    maximumCallsPerCallGroup: "1",
  },
  android: {
    alertTitle: "Permissions required",
    alertDescription: "This app needs phone permissions to display incoming calls.",
    cancelButton: "Cancel",
    okButton: "OK",
    additionalPermissions: [],
    foregroundService: {
      channelId: "your-app-call-channel",
      channelName: "Calls",
      notificationTitle: "Active call",
      notificationIcon: "ic_launcher",
    },
  },
};

await RNCallKeep.setup(callKeepOptions);
RNCallKeep.setAvailable(true);

// iOS PushKit
if (Platform.OS === "ios") {
  VoipPushNotification.addEventListener("register", async (token) => {
    await api.registerCallToken({ uid: currentUserUid, platform: "ios-voip", token });
  });
  VoipPushNotification.registerVoipToken();
}
```

See `cometchat-native-calls/references/server-push-bridge.md` for the server side.

---

## Step 7 — Wire hangup teardown

When a call ends, both `CometChat` and `CometChatCalls` need cleanup:

```ts
async function endCall() {
  CometChatCalls.leaveSession();   // calls SDK
  await CometChat.endCall(sessionId);  // chat SDK call record
  RNCallKeep.endCall(callKeepUuid);    // OS-level UI dismissal
}
```

Skipping any of these leaves zombies — call still showing in the OS as "active" or chat-side call record stuck in "ongoing."

---

## Verification checklist

- [ ] All native peer packages in package.json
- [ ] `pod install` succeeded (no module-not-found at link time)
- [ ] Info.plist + AndroidManifest permissions in place
- [ ] `foregroundServiceType` declared (Android 14+)
- [ ] Calls init AFTER chat init
- [ ] `CometChatCalls.loginWithAuthToken(authToken)` after chat login
- [ ] CallKeep `setup` runs on app start (post-login)
- [ ] VoIP token registration triggered on iOS
- [ ] FCM token registration triggered on Android
- [ ] `CometChatIncomingCall` mounted at root
- [ ] Hangup teardown calls all 3: `CometChatCalls.leaveSession`, `CometChat.endCall`, `RNCallKeep.endCall`
- [ ] Real-device smoke: backgrounded incoming call rings on lock screen
- [ ] Run `cometchat verify --calls` — should pass all 20 checks

---

## Pointers

- `cometchat-react-calls/references/add-calls-to-existing-chat.md` — canonical (web, no native modules)
- `cometchat-native-calls/SKILL.md` — RN seven hard rules
- `cometchat-native-calls/references/server-push-bridge.md` — server-side push routing
