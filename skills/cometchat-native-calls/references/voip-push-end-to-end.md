# VoIP push end-to-end on React Native

The hardest piece of RN calls. This reference is the canonical implementation — the SKILL.md sketches it; here is the code.

Stack:

- **`react-native-callkeep`** — bridges CallKit (iOS) + ConnectionService (Android). One Dart-side API: "ring this device with this caller name."
- **`react-native-voip-push-notification`** — iOS PushKit token registration and payload delivery
- **`@react-native-firebase/messaging`** — Android FCM data messages
- **Server-side** — your push server splits sends: PushKit (VoIP cert) for iOS, FCM with `priority: "high"` and `data` payload for Android

---

## iOS — PushKit + CallKit

### Install + native config

```bash
npm install react-native-callkeep react-native-voip-push-notification
cd ios && pod install && cd ..
```

In Xcode (manual steps the skill documents but cannot automate):

1. Capabilities → Background Modes → enable: **Audio, AirPlay, and Picture in Picture** + **Voice over IP** + **Remote notifications**
2. Capabilities → Push Notifications → ensure enabled
3. Apple Developer portal → Certificates → create a **VoIP Services** certificate for your bundle ID (separate from the standard APNs cert)
4. Upload the `.p12` to your push server

### Info.plist

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
  <string>voip</string>
  <string>remote-notification</string>
</array>
<key>NSMicrophoneUsageDescription</key>
<string>So you can talk during voice and video calls.</string>
<key>NSCameraUsageDescription</key>
<string>So you can be seen during video calls.</string>
```

### Register PushKit + CallKit at app launch

```tsx
// App.tsx
import { useEffect } from "react";
import VoipPushNotification from "react-native-voip-push-notification";
import RNCallKeep from "react-native-callkeep";
import { Platform } from "react-native";

const callKeepOptions = {
  ios: {
    appName: "YourApp",
    supportsVideo: true,
    maximumCallGroups: 1,
    maximumCallsPerCallGroup: 1,
  },
  android: {
    alertTitle: "Permissions required",
    alertDescription: "This app needs to access your phone calling system to ring you on incoming calls",
    cancelButton: "Cancel",
    okButton: "OK",
    foregroundService: {
      channelId: "com.yourapp.calls",
      channelName: "Calls",
      notificationTitle: "Call in progress",
      notificationIcon: "ic_launcher",
    },
  },
};

export function App() {
  useEffect(() => {
    RNCallKeep.setup(callKeepOptions).then(() => {
      RNCallKeep.setAvailable(true);
    });

    if (Platform.OS === "ios") {
      // Register PushKit listener — iOS will call onRegister with the VoIP token
      VoipPushNotification.addEventListener("register", (token) => {
        // Send this token to your server, keyed by the logged-in CometChat UID
        sendVoipTokenToServer(token);
      });

      // Incoming VoIP push payload arrives — IMMEDIATELY report to CallKit
      VoipPushNotification.addEventListener("notification", (notification) => {
        const { sessionId, callerName, callerUid } = notification.data;
        // CRITICAL: this MUST happen within ~5s of payload delivery or iOS terminates the app
        RNCallKeep.displayIncomingCall(
          sessionId,                  // unique call UUID
          callerUid,                  // handle
          callerName,                 // localized caller name
          "generic",                  // handle type
          true,                       // hasVideo
        );
      });

      VoipPushNotification.registerVoipToken();
    }

    if (Platform.OS === "android") {
      setupAndroidVoipPush();
    }

    return () => {
      VoipPushNotification.removeEventListener("register");
      VoipPushNotification.removeEventListener("notification");
    };
  }, []);

  // CallKit answer/end events — wire them to CometChat Calls SDK
  useEffect(() => {
    RNCallKeep.addEventListener("answerCall", async ({ callUUID }) => {
      // sessionId === callUUID we passed to displayIncomingCall.
      // Accept lives on the CHAT SDK (CometChat.acceptCall), NOT CometChatCalls —
      // the Calls SDK has no acceptCall; calling it crashes at answer time.
      await CometChat.acceptCall(callUUID);
      navigate("OngoingCall", { sessionId: callUUID });
    });

    RNCallKeep.addEventListener("endCall", async ({ callUUID }) => {
      await CometChatCalls.leaveSession();
    });

    return () => {
      RNCallKeep.removeEventListener("answerCall");
      RNCallKeep.removeEventListener("endCall");
    };
  }, []);

  return /* ...your nav... */;
}
```

**5-second rule:** Apple terminates apps that delay `RNCallKeep.displayIncomingCall` more than ~5 seconds after PushKit delivery. Do not `await` async work before the call — display first, then do the rest from inside the answer handler.

---

## Android — FCM data messages + ConnectionService

### Install + native config

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
cd ios && pod install && cd ..    # iOS link for firebase even if you don't use iOS messaging
```

Place `google-services.json` (downloaded from Firebase console) at `android/app/google-services.json`.

In `android/build.gradle`:

```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
  }
}
```

In `android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'
```

### AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
<uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE" tools:ignore="ProtectedPermissions" />

<!-- Android 14+ -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />

<application>
  <service
    android:name="io.wazo.callkeep.RNCallKeepBackgroundMessagingService"
    android:foregroundServiceType="phoneCall|microphone|camera"
    android:exported="false" />
</application>
```

The `tools` namespace must be declared on `<manifest>`: `xmlns:tools="http://schemas.android.com/tools"`.

### Register FCM + handle data messages

```ts
import messaging from "@react-native-firebase/messaging";
import RNCallKeep from "react-native-callkeep";

async function setupAndroidVoipPush() {
  await messaging().requestPermission();
  const token = await messaging().getToken();
  await sendFcmTokenToServer(token);

  // Foreground messages — when app is open
  messaging().onMessage(async (remoteMessage) => {
    if (remoteMessage.data?.type === "incoming_call") {
      handleIncomingCallPayload(remoteMessage.data);
    }
  });

  // Background / killed app — registered in index.js (see below)
}

function handleIncomingCallPayload(data: Record<string, string>) {
  RNCallKeep.displayIncomingCall(
    data.sessionId,
    data.callerUid,
    data.callerName,
    "generic",
    true,
  );
}
```

### Background handler — must be in index.js, NOT a component

```ts
// index.js (top of file, before AppRegistry.registerComponent)
import messaging from "@react-native-firebase/messaging";
import RNCallKeep from "react-native-callkeep";

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  if (remoteMessage.data?.type === "incoming_call") {
    RNCallKeep.displayIncomingCall(
      remoteMessage.data.sessionId,
      remoteMessage.data.callerUid,
      remoteMessage.data.callerName,
      "generic",
      true,
    );
  }
});
```

Background handler must register in `index.js` so it's invoked when the JS engine boots in background-headless mode.

---

## Server-side push payload shape

Your push server gets the call event from CometChat (via webhook) and dispatches:

### iOS payload (PushKit — sent via APNs with `apns-push-type: voip`)

```json
{
  "aps": {
    "content-available": 1
  },
  "data": {
    "sessionId": "session-abc-123",
    "callerName": "Alice",
    "callerUid": "cometchat-uid-1",
    "callType": "video"
  }
}
```

Send to the **VoIP-specific** APNs endpoint with the VoIP cert. Standard APNs cert won't work.

### Android payload (FCM data message)

```json
{
  "to": "<receiver-fcm-token>",
  "priority": "high",
  "data": {
    "type": "incoming_call",
    "sessionId": "session-abc-123",
    "callerName": "Alice",
    "callerUid": "cometchat-uid-1",
    "callType": "video"
  }
}
```

**`data` not `notification`.** ConnectionService cannot intercept `notification` payloads — they go to the system tray. Only `data` payloads invoke the background handler.

`priority: "high"` is required. Without it, FCM may delay delivery by minutes — too slow to ring.

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| iOS: incoming call doesn't ring on lock screen | VoIP cert not uploaded to push server, or not matched to bundle ID | Verify cert in Apple Dev portal; rotate if expired |
| iOS: app crashes ~5s after PushKit delivery | Async work before `displayIncomingCall` | Display first, then do the rest in the answer handler |
| iOS: PushKit token never registers | Background Modes capability missing | Re-check Xcode capabilities; uninstall + reinstall app to retrigger registration |
| Android: incoming call shows as a regular notification (not heads-up) | Sent as `notification` instead of `data` | Server must use FCM `data` payload exclusively |
| Android: incoming call delayed by minutes | `priority` missing or `"normal"` | Server must set `priority: "high"` |
| Android 14+: app crashes on call start | Wrong `foregroundServiceType` | Must include `phoneCall` (silent crash with `microphone\|camera` only) |
| Android: ConnectionService not invoked | `MANAGE_OWN_CALLS` permission denied at runtime | Show rationale dialog and re-request |
| Both: lock-screen UI stuck after call ends | Missing `RNCallKeep.endCall` in hangup path | Add `RNCallKeep.endCall(callUUID)` to the cleanup |

---

## Testing VoIP push (without a server)

The hardest part of dev is iterating without a real push server. Two workarounds:

1. **Trigger CallKit directly without push** — call `RNCallKeep.displayIncomingCall(...)` from a debug button in your app. Bypasses the server entirely. Useful for testing the in-app flow.
2. **Use Firebase Console "Send test message"** — send a one-off FCM `data` payload to a specific token. Does NOT support PushKit — iOS still needs a real VoIP push server.

For real end-to-end tests, you need a push server. The skill scaffolds a tiny Express example (`server/push.example.ts`) that the user runs locally; it's documented but not tested in CI because real APNs/FCM requires real certs.
