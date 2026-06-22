---
name: cometchat-native-calls
description: CometChat Calls SDK integration for React Native (Expo managed + bare CLI). Covers @cometchat/calls-sdk-react-native install, dual-SDK init, native module linking (iOS pods, Android Gradle), VoIP push via react-native-callkeep + react-native-voip-push-notification + @react-native-firebase/messaging, CallKit on iOS / ConnectionService on Android, foreground service correctness on Android 14+, gesture handler + reanimated peer deps, Expo-specific config plugins, and additive-vs-standalone modes.
license: "MIT"
compatibility: "React Native >= 0.70 (>= 0.72 recommended), Expo SDK >= 49 (managed) / bare RN CLI; @cometchat/calls-sdk-react-native ^4.x; @cometchat/chat-sdk-react-native ^4.x; @cometchat/chat-uikit-react-native ^5.x (additive mode)"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat react-native calls voice video webrtc expo bare-rn callkeep voip-push pushkit callkit connectionservice fcm gesture-handler"
---

## Purpose

Production-grade voice + video calling for React Native (Expo managed + bare CLI). Loaded by `cometchat-calls` when `framework` is `expo` or `react-native`. Operates in two modes:

- **Standalone** — calls is the product. Chat SDK (signaling) + Calls SDK (WebRTC) + your own RN screens. **VoIP push is mandatory** — same rule as native iOS / Android.
- **Additive** — calls layered onto an existing CometChat React Native UI Kit integration. Adds call buttons inline, mounts `CometChatIncomingCall` at app root.

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-native-core` — Chat SDK init, login, env conventions, gesture handler peer-dep rules
- Framework path: `cometchat-native-expo-patterns` (managed) OR `cometchat-native-bare-patterns` (CLI)

**Ground truth:**
- SDK source — `calls-sdk-react-native-5/package/`
- Sample app — `calls-sdk-react-native-5/sample-apps/cometchat-calls-sample-app-react-native/`
- Public docs — https://www.cometchat.com/docs/calls/react-native/overview

---

## 1. Hard rules — RN specialization

### 1.0 Calls SDK login — only the STANDALONE/raw-SDK path needs it

> ✅ **The additive UI-Kit path does NOT call `CometChatCalls.login`.** When calls are layered onto the RN UI Kit (the common case — `<CometChatIncomingCall>` at root + the auto call buttons in `CometChatMessageHeader`, calling extension enabled at `CometChatUIKit.init`), the kit chains the Calls-SDK auth off `CometChatUIKit.login` for you. **The canonical RN SampleApp wires calls end-to-end (incoming/outgoing/ongoing) with ZERO `CometChatCalls.login`** (verified across `examples/SampleApp` + `SampleAppWithPushNotifications`; the kit's `CometChatUIKit.login` only runs `CometChat.login`). Don't add it on the UI-Kit path — it's redundant.

**`await CometChatCalls.login(uid, AUTH_KEY)` is required ONLY on the STANDALONE / raw-Calls-SDK path** (§4a/§4b — no UI Kit; you call `CometChatCalls.generateToken` / render a custom call surface directly). There the Calls SDK has its own auth state: after `CometChat.login(uid, AUTH_KEY)` succeeds, also call `await CometChatCalls.login(uid, AUTH_KEY)` — without it the first raw calls API throws **"auth token cannot be null"**. (No imperative `joinSession` on RN — see rule below.)

```ts
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

// ✓ RIGHT — chat login first, then calls login
await CometChat.login(uid, AUTH_KEY);
try {
  const callUser = await CometChatCalls.login(uid, AUTH_KEY);  // dev mode
  // OR for production:
  // const callUser = await CometChatCalls.loginWithAuthToken(authToken);
} catch (e) {
  // surface to user — common cause: typo in app id / auth key
}
```

**Surprises that bite on real devices:**
- The Chat SDK persists login across launches via AsyncStorage; the **Calls SDK does NOT**. Even if `CometChat.getLoggedinUser()` returns a non-null user on cold start, call `CometChatCalls.login` again before any calls API works.
- A single-arg `CometChatCalls.login(uid)` overload exists for re-login when the SDK has cached auth — default to the (uid, AUTH_KEY) form for dev to avoid foot-guns.
- Login errors surface as Promise rejections — wrap in try/catch.

### 1.1 Dual-SDK contract

Same shape as web. `@cometchat/chat-sdk-react-native` initiates ringing; `@cometchat/calls-sdk-react-native` runs the WebRTC session. Both packages.

```ts
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

// Chat SDK — initiate
const outgoing = new CometChat.Call(receiverUid, CometChat.CALL_TYPE.VIDEO, CometChat.RECEIVER_TYPE.USER);
const initiated = await CometChat.initiateCall(outgoing);

// Calls SDK — generate the token (v5 takes only sessionId; auth is internal after login).
const { token: callToken } = await CometChatCalls.generateToken(initiated.getSessionId());

// On RN, session/join is rendered via the SDK's declarative Component.
// There is NO imperative joinSession(token, settings, viewRef) on RN — the
// Component IS the call surface. With the kit, <CometChatOngoingCall />
// wraps this internally. For custom UI, render <CometChatCalls.Component
// callToken={callToken} /> directly. See references/custom-ui.md.
```

### 1.2 VoIP push — react-native-callkeep + platform-specific push

VoIP push on RN is the highest-effort piece. The standard production stack:

- **`react-native-callkeep`** — bridges CallKit (iOS) + ConnectionService (Android). Single API for "report incoming call to OS"
- **`react-native-voip-push-notification`** — iOS PushKit token registration + payload delivery
- **`@react-native-firebase/messaging`** — Android FCM high-priority data messages
- **Server side** — your push server must split iOS sends to PushKit (VoIP cert) and Android sends to FCM with `priority: "high"` and a `data` payload (NOT `notification`, which ConnectionService can't intercept)

The skill scaffolds all four pieces in standalone mode. Additive mode prompts before adding (it's substantial).

### 1.3 Foreground service — same Android 14+ rules as native

When the call is active on Android, an ongoing-call foreground service must run. `react-native-callkeep` handles registration but the app's `AndroidManifest.xml` must declare:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
<uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE" />
```

Same silent-crash failure mode as native Android (cf. `cometchat-android-v5-calls` rule 1.3).

For Expo managed, these go into `app.json` `expo.android.permissions` AND require a config plugin (`react-native-callkeep`'s plugin) to merge into the generated `AndroidManifest.xml` during prebuild. Bare RN can edit the manifest directly.

### 1.4 Server-minted auth tokens

Same — `cometchat-native-production` covers it.

### 1.5 Hangup cleanup — RTCPeerConnection + audio session

Combined web + iOS rules. RN's WebRTC bridge wraps both:

```ts
function endCall() {
  CometChatCalls.leaveSession();            // v5 canonical (endSession is a deprecated shim)
  RNCallKeep.endCall(callUUID);             // tells CallKit/ConnectionService the call ended

  // iOS: matching audio session deactivation happens inside callkeep
  // Android: foreground service stop happens inside callkeep
}
```

Skipping `RNCallKeep.endCall` leaves the system call UI stuck (lock-screen card persists, OS thinks there's an active call). Common bug.

### 1.6 Permissions

Required:

- iOS `Info.plist` — `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` (same as native)
- Android — runtime requests via `PermissionsAndroid.requestMultiple` for `RECORD_AUDIO`, `CAMERA`, `POST_NOTIFICATIONS` (Android 13+)
- Expo managed — declare in `app.json` `expo.ios.infoPlist` and `expo.android.permissions`; the prebuild merges into native manifests

### 1.7 IncomingCall + OutgoingCall + OngoingCall — full event-listener wiring

`<CometChatIncomingCall />`, `<CometChatOutgoingCall />`, and `<CometChatOngoingCall />` are **NOT auto-mounted by each other**. The parent component must register both `CometChat.addCallListener` (SDK socket) and `CometChatUIEventHandler.addCallListener` (UI events fired by `<CometChatCallButtons>` / `<CometChatMessageHeader>`), then conditionally render whichever overlay matches current state. Validated 2026-05-26 on Pixel 3 + `@cometchat/chat-uikit-react-native@5.3.5`.

Mount this wiring inside the root navigator OR in the App.tsx wrapper, ABOVE all stacks/tabs — calls only ring on screens where the listener exists.

```tsx
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";
import {
  CometChatIncomingCall,
  CometChatOutgoingCall,
  CometChatOngoingCall,
  CometChatUIEventHandler,
} from "@cometchat/chat-uikit-react-native";
import { StyleSheet, View } from "react-native";

const CALL_LISTENER_ID = "app-call-listener";

function CallSurfaces() {
  const [outgoingCall, setOutgoingCall] = useState<CometChat.Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<CometChat.Call | null>(null);
  const [ongoingCall, setOngoingCall] = useState<CometChat.Call | null>(null);

  useEffect(() => {
    // SDK socket — incoming + outgoing-rejected
    CometChat.addCallListener(
      CALL_LISTENER_ID,
      new CometChat.CallListener({
        onIncomingCallReceived: (call: CometChat.Call) => setIncomingCall(call),
        onIncomingCallCancelled: () => setIncomingCall(null),
        onOutgoingCallAccepted: () => {},
        onOutgoingCallRejected: () => setOutgoingCall(null),
      })
    );
    // UI events fired by the kit's CallButtons / MessageHeader on tap
    CometChatUIEventHandler.addCallListener(CALL_LISTENER_ID, {
      ccOutgoingCall: ({ call }) => setOutgoingCall(call),
      ccCallEnded: () => {
        setOutgoingCall(null);
        setIncomingCall(null);
        setOngoingCall(null);
      },
      ccShowOngoingCall: ({ call }) => setOngoingCall(call),
    });
    // Mid-call drops (peer left, network loss, server close) do NOT come through the
    // Chat-SDK/UI-Kit channels above — they fire on the Calls SDK session events (v5).
    // For a STANDALONE custom call surface, also register (clone skills/event-listeners):
    //   const offLeft   = CometChatCalls.addEventListener('onSessionLeft',     () => { /* reset state */ });
    //   const offClosed = CometChatCalls.addEventListener('onConnectionClosed', () => { /* reset state */ });
    //   // addEventListener returns an unsubscribe fn — call offLeft()/offClosed() on cleanup.
    // (Additive mode using the kit's <CometChatOngoingCall> handles this internally.)
    return () => {
      CometChat.removeCallListener(CALL_LISTENER_ID);
      CometChatUIEventHandler.removeCallListener(CALL_LISTENER_ID);
    };
  }, []);

  return (
    <>
      {incomingCall && <View style={StyleSheet.absoluteFill}><CometChatIncomingCall call={incomingCall} onDecline={() => setIncomingCall(null)} /></View>}{/* onDecline is REQUIRED on the RN kit's CometChatIncomingCall (onAccept/onError optional) */}
      {outgoingCall && <View style={StyleSheet.absoluteFill}><CometChatOutgoingCall call={outgoingCall} /></View>}
      {/* CometChatOngoingCall has NO `call` prop — it takes sessionID (required) + callSettingsBuilder (required) + onError? (verified vs uikit-react-native-v5 CometChatOngoingCall.tsx). CometChatIncomingCall/OutgoingCall DO take `call`. */}
      {ongoingCall && <View style={StyleSheet.absoluteFill}><CometChatOngoingCall sessionID={ongoingCall.getSessionId()} callSettingsBuilder={new CometChatCalls.CallSettingsBuilder().setIsAudioOnlyCall(ongoingCall.getType() === "audio")} /></View>}
    </>
  );
}
```

> **Don't skip the `ccOutgoingCall` listener.** Without it, tapping the video/voice button in `<CometChatMessageHeader>` triggers the call at the SDK level (WebRTC, camera, audio init) but no overlay UI ever mounts — the user sees nothing change after the tap. This was [[project_v4_3_f75_rn_call_ui_missing]] — F75.

In standalone mode, CallKit/ConnectionService own the foreground UI; `<CometChatIncomingCall />` is not used. Instead, a `react-native-callkeep` event listener at app root reports new calls to the OS.

### 1.8 Three canonical provider/scaffold patterns (non-negotiable)

Validated across 4 RN cohorts on 2026-05-14. Each bug silently breaks integration in a different way; each fix is one line. Future scaffolds MUST emit all three.

**1.8.a — `getLoggedInUser()` throws on no-session; always `.catch(() => null)`.**

```ts
// ❌ Throws "User not found" on every fresh launch → init fails → app stuck
const existing = await CometChatUIKit.getLoggedInUser();
if (existing) return;

// ✅
const existing = await CometChatUIKit.getLoggedInUser().catch(() => null);
if (existing) return;
```

The RN SDK treats "no logged-in user" as a thrown error (not `null`), unlike the web SDK. Without the catch, every fresh launch aborts before reaching `login()`.

**1.8.b — Render `e.message`, not `String(e)`.**

```ts
// ❌ Most CometChat SDK errors are plain objects, not Error subclasses
// → setError(String(e)) shows "[object Object]" on screen
catch (e) {
  setError(String(e));
}

// ✅
catch (e) {
  initialized = false; // let hot-reload retry
  const msg = e instanceof Error ? e.message : JSON.stringify(e);
  setError(msg);
}
```

Hiding the underlying error from the user is the single biggest debugging-time-sink in this stack. Always render `e.message` (or `JSON.stringify(e)` as fallback) so the actionable text reaches the screen.

**1.8.c — DO NOT pass `onAccept` to `<CometChatIncomingCall>`.**

```tsx
// ❌ Short-circuits the kit's internal acceptCall + OngoingCall transition.
// Symptom: callee taps Accept; caller's outgoing screen stays on "Calling…"
// indefinitely; the call connects at server level but UI never transitions.
<CometChatIncomingCall call={call} onAccept={(c) => navigate('OngoingCall', ...)} ... />

// ✅ Let the kit own the accept path; only handle decline + error
<CometChatIncomingCall
  call={call}
  onDecline={() => setCallReceived(false)}
  onError={() => setCallReceived(false)}
/>
```

The kit calls `CometChat.acceptCall` internally and pushes its own OngoingCall surface. Providing `onAccept` replaces that behavior with the caller's function — typically incomplete, never matches what the kit does.

**Also recommended** — guard creds at init time so undefined `@env`/`process.env.EXPO_PUBLIC_*` values surface as actionable errors:

```ts
if (!appId || !region) {
  throw new Error(
    `Missing CometChat credentials at init time: appId=${JSON.stringify(appId)}, region=${JSON.stringify(region)}. ` +
    `Check .env defines COMETCHAT_APP_ID/COMETCHAT_REGION/COMETCHAT_AUTH_KEY ` +
    `and restart Metro with cache wipe.`,
  );
}
```

Without this guard, undefined env values produce opaque `TypeError: undefined is not a function` from deep inside the SDK — the most expensive failure mode of a typo'd env name.

---

## 2. Setup

### Bare RN CLI

```bash
npm install @cometchat/chat-sdk-react-native@^4 @cometchat/calls-sdk-react-native@^5
npm install react-native-callkeep react-native-voip-push-notification @react-native-firebase/app @react-native-firebase/messaging
npm install react-native-webrtc           # Calls SDK peer dep
npm install react-native-gesture-handler react-native-reanimated  # already installed if using UI Kit
```

**iOS — four hardening steps before `pod install`** (validated 2026-05-14 on Apple Silicon, iOS 26.5 sim):

1. **`USE_FRAMEWORKS=static pod install`** — required for WebRTC + CometChat pods. Default dynamic linkage silently produces a binary that can't load WebRTC at runtime. Set in shell rc or invoke every time:

   ```bash
   cd ios && USE_FRAMEWORKS=static pod install && cd ..
   # Subsequent builds:
   USE_FRAMEWORKS=static npx react-native run-ios
   ```

2. **Remove `EXCLUDED_ARCHS arm64 i386` from `ios/Podfile`** (Apple Silicon). RN templates often add this Intel-era workaround to the post-install hook; on Apple Silicon it blocks `react-native-webrtc`/`JitsiWebRTC` arm64 slices from linking against the simulator. Delete the line:

   ```ruby
   # ❌ Remove this from post_install on Apple Silicon
   config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64 i386'
   ```

3. **`ios/Info.plist`** — minimum set for calls:

   ```xml
   <key>NSCameraUsageDescription</key>
   <string>Camera access for video calls</string>
   <key>NSMicrophoneUsageDescription</key>
   <string>Microphone access for voice and video calls</string>
   <key>NSBluetoothAlwaysUsageDescription</key>
   <string>Bluetooth access for using headsets during calls</string>
   <key>UIBackgroundModes</key>
   <array>
     <string>audio</string>
     <string>voip</string>
     <string>remote-notification</string>
   </array>
   ```

   `UIBackgroundModes: audio` is the load-bearing one for call-audio survival when the app backgrounds; without it, audio cuts the instant the app loses foreground. `NSBluetoothAlways` prevents a crash when the user connects a Bluetooth headset mid-call.

4. **`ios/.xcode.env.local` NODE_BINARY** — point at a stable Homebrew Node path, not an nvm path that may have been cleaned up:

   ```bash
   # ios/.xcode.env.local
   export NODE_BINARY=/opt/homebrew/opt/node@20/bin/node
   ```

   nvm paths in `~/.nvm/versions/node/v20.x.y/bin/node` go stale when nvm prunes — Xcode build fails with `node: command not found`. Homebrew `/opt/homebrew/opt/node@20/bin/node` is symlinked to whatever node@20.x is currently installed; survives `brew upgrade`.

**iOS-on-RN works even where iOS V5 NATIVE is blocked.** The native iOS V5 cohort is gated upstream by a Cloudsmith 404 on `cometchat-calls-ios`. The RN-on-iOS path links a different WebRTC surface (`react-native-webrtc` + `JitsiWebRTC` pod transitives), so customers on RN + iOS are NOT blocked by the native cohort's vendor issue.

**Android — manifest permissions** (rule 1.3 + 1.6), Firebase config (`google-services.json` in `android/app/`), service registration:

```xml
<service
  android:name="io.wazo.callkeep.RNCallKeepBackgroundMessagingService"
  android:foregroundServiceType="phoneCall|microphone|camera"
  android:exported="false" />
```

### Expo managed

Calls SDK requires native modules — Expo managed CANNOT run it without a custom dev client. The skill detects the project mode:

- **Managed + has `expo-dev-client`**: scaffolds config plugins for callkeep/firebase/voip-push, regenerates native projects, builds dev client
- **Managed without dev client**: prompts the user — calls require either ejecting to bare or adding `expo-dev-client`
- **EAS Build**: configures `eas.json` profiles + build commands

Expo Go (the public dev client) cannot run calls. The skill states this clearly and refuses to scaffold without a dev client.

#### ⚠️ Real build-time landmines on Expo SDK 54 + chat-uikit-react-native 5.3.x (validated 2026-05-14, 4 cohorts)

A previous version of this doc listed three "Expo SDK 54 build traps" (document-picker removal, react-native-worklets install, NDK override). Re-validation on 2026-05-14 across **expo-new, expo-existing, rn-new, rn-existing** showed **none of those three fired** on the current combo (`chat-uikit-react-native@5.3.5` + `calls-sdk-react-native@5.0.0`/`4.4.1` + Expo SDK 54). Removed. The real landmines on this combo are different:

1. **`@cometchat/calls-lib-webrtc` is Cloudsmith-only, NOT on npm.** `npm install @cometchat/calls-lib-webrtc` returns 404. The package lives on CometChat's Cloudsmith registry. Use the tarball URL:

   ```bash
   npm install --legacy-peer-deps \
     'https://dl.cloudsmith.io/public/cometchat/cometchat/raw/files/cometchat-calls-lib-webrtc-346a46ff.tgz'
   ```

   The exact revision hash may roll forward — check the Cloudsmith page for the current version. Without this, runtime fails when the WebRTC layer initializes.

2. **`--legacy-peer-deps` silently strips peer deps the kit needs at runtime.** chat-uikit-react-native does not declare all its transitive runtime peers in `peerDependencies` (kit + calls SDK together pull in `expo-linking`, `expo-constants`, `expo-asset`, `expo-font` via expo-router, plus `valibot`, `zustand`, `@xmldom/xmldom`, `abab`, `promise.allsettled`, `text-encoding`, `react-native-url-polyfill`, `react-native-performance`). With `--legacy-peer-deps`, npm skips them. Each one bites on first bundle as `Unable to resolve module ...`. Reinstall them explicitly:

   ```bash
   # Bare RN
   npm install --legacy-peer-deps \
     valibot zustand @xmldom/xmldom abab promise.allsettled text-encoding \
     react-native-url-polyfill react-native-performance

   # Expo (resolves to SDK-compatible versions)
   npx expo install \
     expo-linking expo-constants expo-asset expo-font \
     -- --legacy-peer-deps
   ```

3. **`expo.extra` (app.json) caches on the Expo dev client manifest.** Edits to `app.json → expo.extra` after `expo prebuild` do NOT reload to the device — `Constants.expoConfig.extra` keeps reading the prebuild-time snapshot. For dev iteration on credentials, EITHER hardcode in `src/config/*.ts` (Metro hot-bundles source changes) OR run `expo prebuild --clean && expo run:android` after every `app.json → extra` change.

4. **`react-native start` does NOT run `adb reverse` (bare RN only).** Only `react-native run-android` sets `adb reverse tcp:8081 tcp:8081`. When you restart Metro standalone (e.g. after `.env` changes), the device loses port-forwarding and shows "unable to load scripts." Fix:

   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

5. **`react-native-dotenv` needs Metro `--reset-cache` after `.env` changes (bare RN only).** The babel plugin processes `.env` at compile time, not runtime. Workflow:

   ```bash
   pkill -9 -f "react-native start"
   npx react-native start --reset-cache
   adb reverse tcp:8081 tcp:8081
   adb shell am force-stop com.<package> && adb shell monkey -p com.<package> -c android.intent.category.LAUNCHER 1
   ```

### Init

```ts
// cometchat/init.ts
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

let initialized = false;

export async function initCometChat() {
  if (initialized) return;

  const appSettings = new CometChat.AppSettingsBuilder()
    .subscribePresenceForAllUsers()
    .setRegion(process.env.EXPO_PUBLIC_COMETCHAT_REGION!)
    .build();

  await CometChat.init(process.env.EXPO_PUBLIC_COMETCHAT_APP_ID!, appSettings);

  // Calls SDK init takes a FLAT object — there is no CallAppSettingsBuilder in v5 RN.
  await CometChatCalls.init({
    appId: process.env.EXPO_PUBLIC_COMETCHAT_APP_ID!,
    region: process.env.EXPO_PUBLIC_COMETCHAT_REGION!,
    authKey: process.env.EXPO_PUBLIC_COMETCHAT_AUTH_KEY!,
  });

  initialized = true;
}
```

(Bare RN uses `react-native-dotenv` and `@env` imports instead of `process.env.EXPO_PUBLIC_*` — see `cometchat-native-bare-patterns`.)

---

## 3. Components catalog

### Calls SDK primitives

Same names + shapes as the JavaScript SDK (Section 3 of `cometchat-react-calls`). RN-relevant session helpers include `switchCamera()`, `setAudioMode(mode)`, `muteAudio()`/`unmuteAudio()`, `pauseVideo()`/`resumeVideo()` — see the SDK's custom-ui reference. (Web-only helpers like device enumeration and virtual background are not available on RN.)

### UI Kit views (additive mode — `@cometchat/chat-uikit-react-native`)

| Component | Purpose |
|---|---|
| `<CometChatCallButtons user={u} group={g} />` | Voice + video icon row (typically inside `CometChatMessageHeader`). **Group + user semantics differ** — see callout below |
| `<CometChatIncomingCall />` | Root-mounted; renders ringing UI for incoming call (controlled by parent state — see §1.7) |
| `<CometChatOutgoingCall />` | Root-mounted; renders "Calling…" UI for outgoing call (controlled by parent state — see §1.7) |
| `<CometChatOngoingCall />` | Root-mounted; renders active in-call view (controlled by parent state — see §1.7) |
| `<CometChatCallLogs onItemClick={fn} />` | History |

#### ⚠️ Group calls use message-based join, not the ringing channel (validated 2026-05-15)

`<CometChatCallButtons group={group} />` does NOT call `CometChat.initiateCall` like the 1:1 user variant does. Source: `node_modules/@cometchat/chat-uikit-react-native/src/calls/CometChatCallButtons/CometChatCallButtons.tsx:138-201`.

| Surface | What `<CometChatCallButtons>` does |
|---|---|
| `user={u}` | `CometChat.initiateCall(call)` → standard Ringing flow → `onIncomingCallReceived` fires on peer's `CallListener` |
| `group={g}` | `CometChat.sendCustomMessage(meetingMessage)` → meeting-card message in the group; caller jumps straight to in-call surface |

**Implication for receivers:**
- **Other kit-based clients** (apps using `<CometChatMessageList />` to render group messages) — get the "Join meeting" card rendered automatically; tap to join. No additional plumbing.
- **Custom-UI clients** (apps that render their own message list, or no list at all) — receive NOTHING on the `CallListener` channel for group calls. To handle group meetings, add a `CometChat.addMessageListener` and check for the custom meeting type:

   ```ts
   CometChat.addMessageListener('GROUP_MEETING_LISTENER', new CometChat.MessageListener({
     onCustomMessageReceived: (msg) => {
       if (msg.getCategory() === CometChat.CATEGORY_CUSTOM && msg.getType() === 'meeting') {
         const sessionId = (msg.getCustomData() as any)?.sessionId;
         const callType = (msg.getCustomData() as any)?.callType;  // "audio" | "video"
         // Show your own "incoming group call" UI; tap to navigate to ongoing-call with sessionId
       }
     },
   }));
   ```

This semantic is the same across all CometChat kits (React, Angular, native iOS, native Android, Flutter) — group calls broadcast via custom message, NOT the ringing channel. Document loudly because the symptom (group-call recipient sees nothing) looks like a bug but is by design.

---

## 4. Standalone integration

When `product === "voice-video"` and there is no existing UI Kit.

**Split by calling mode — these are two different shapes:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

Calls SDK ONLY. NO Chat SDK. Matches `calls-sdk-react-native-5/sample-apps/cometchat-calls-sample-app-react-native/`.

> **⚠️ Idle timeout is in MILLISECONDS on React Native (the "instant exit on join" footgun).** Like the web SDK, the RN calls SDK's `SessionSettings` idle fields are **milliseconds, not seconds** (`calls-sdk-react-native/skills/session-settings`: `idleTimeoutPeriodBeforePrompt: 60000` ms). Setting `idleTimeoutPeriodBeforePrompt: 180` thinking "180s" means **180 ms** → the "Are you still there?" prompt fires and the session exits a fraction of a second after you join alone. Use ms: `{ idleTimeoutPeriodBeforePrompt: 180_000, idleTimeoutPeriodAfterPrompt: 60_000 }` (defaults 60_000 / 120_000). The timer only counts down when you're the **only** participant, so a solo test triggers it fastest. (Native Android/iOS/Flutter calls SDKs use **seconds** for `setIdleTimeoutPeriod`, default 300 — RN/web are the ms outliers.)

**MANDATORY install set (MUST run BEFORE scaffolding files — bundle will fail with `Unable to resolve module <name>` for each one missing):**

```bash
# Bare RN — session-only mode (all version pins are load-bearing, see notes below)
npm install --legacy-peer-deps \
  '@cometchat/calls-sdk-react-native@^5.0.0' \
  'https://dl.cloudsmith.io/public/cometchat/cometchat/raw/files/cometchat-calls-lib-webrtc-346a46ff.tgz' \
  'react-native-webrtc@^124.0.0' \
  'react-native-permissions@^5.0.0' \
  'react-native-safe-area-context@^5.0.0' \
  '@react-native-async-storage/async-storage@^2.2.0' \
  '@xmldom/xmldom@^0.8.11' \
  'react-native-svg@^15.0.0' \
  'react-native-background-timer@^2.4.1' \
  'react-native-performance@^5.1.0' \
  'react-native-url-polyfill@^2.0.0' \
  'valibot@^1.2.0' \
  'zustand@^5.0.0' \
  'text-encoding@^0.7.0' \
  'abab@^2.0.6' \
  'promise.allsettled@^1.0.7'

# The Cloudsmith tarball sometimes silently skips on the same install line as
# other packages — re-run it on its own if it's missing afterwards:
[ -d node_modules/@cometchat/calls-lib-webrtc ] || \
  npm install --save --force \
    'https://dl.cloudsmith.io/public/cometchat/cometchat/raw/files/cometchat-calls-lib-webrtc-346a46ff.tgz'
```

**Critical version pins** — empirically validated 2026-05-15 (test #3, RN bare on Pixel 3 + RN 0.85):

| Pin | Why |
|---|---|
| `@react-native-async-storage/async-storage@^2.2.0` | v3.x splits Android native code into a separate Maven artifact (`org.asyncstorage.shared_storage:storage-android:1.0.0`) that isn't widely published. Gradle fails with `Could not find org.asyncstorage.shared_storage:...`. Pin to ^2.2.0 (self-contained Android). |
| `@xmldom/xmldom@^0.8.11` | The Calls SDK's polyfill (`dist/polyfills/browser.js`) assumes the xmldom 0.8 prototype shape. v0.9.x reorganized the prototype chain; runtime crashes with `Cannot set property 'innerHTML' of undefined` during polyfill init. Pin to ^0.8.11 (matches SDK's declared peer range). |
| `react-native-webrtc@^124.0.0` | Older versions don't support React Native 0.74+ Fabric. |
| `valibot@^1.2.0` / `zustand@^5.0.0` | SDK declares these specific majors; minor upgrades have been API-stable but pin to the declared range to avoid surprises. |

**Metro config patch: route the calls SDK to its .mjs entry.** `@cometchat/calls-sdk-react-native@5.0.0` ships a broken CJS bundle at `dist/index.js` — line 1 is `import "./polyfills"` (ESM syntax inside a CJS file). Metro can't parse it; the import returns `undefined` and crashes at runtime as `Cannot read property 'CometChatCalls' of undefined` in your `init.ts`. The `dist/index.mjs` is correctly formed. Patch `metro.config.js`:

```js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@cometchat/calls-sdk-react-native') {
        return {
          filePath: path.resolve(
            __dirname,
            'node_modules/@cometchat/calls-sdk-react-native/dist/index.mjs',
          ),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

After patching, **`npx react-native start --reset-cache`** to clear Metro's resolver cache, then `run-android` / `run-ios`. Customer-found 2026-05-15 (test #3).

**11 peer deps total** — derived empirically (test #3, 2026-05-15) by parsing the SDK's actual bundle imports (`node_modules/@cometchat/calls-sdk-react-native/dist/index.js` + `dist/polyfills/*.js`). Every one is a real bundle-time or runtime requirement. The npm CLI `--legacy-peer-deps` flag silently strips them, so they must be listed explicitly.

**Failure-mode breakdown:**

| Missing peer | Symptom |
|---|---|
| `@react-native-async-storage/async-storage` | `Unable to resolve module @react-native-async-storage/async-storage` at first bundle |
| `react-native-svg` | `Unable to resolve module react-native-svg` at first bundle |
| `react-native-background-timer` | `Unable to resolve module react-native-background-timer` (polyfills/browser.js) |
| `valibot`, `zustand`, `react-native-webrtc` | Same — bundle-time imports in SDK index |
| `@xmldom/xmldom`, `abab`, `promise.allsettled` | Same — polyfills/browser.js DOM + Promise polyfills |
| `text-encoding`, `react-native-url-polyfill`, `react-native-performance` | Runtime — used inside SDK init code paths |

**Also: DO NOT install `@cometchat/chat-sdk-react-native` in session-only mode.** Dead weight in source (never imported, never initialized) AND it transitively pulls async-storage which conflicts with our own peer-dep management.

Verify checks: `rn_webrtc_peers` (11-peer presence) + `no_chat_sdk_in_session_only` (Chat SDK absence).

The skill then scaffolds:

1. **`cometchat/init.ts`** — `CometChatCalls.init({ appId, region, authKey })` ONLY. No `CometChat.init`, no `CometChat.login`. Pass `authKey` at init so `CometChatCalls.login(uid)` needs no second arg.
2. **`screens/JoinSession.tsx`** — UID picker + Start/Join meeting + state machine (`inMeeting && callToken`).
3. **`screens/CallRoom.tsx`** — Renders `<CometChatCalls.Component callToken={callToken} />` inside `SafeAreaView`. `onConnectionClosed` listener resets state. See `references/call-session.md`.
4. **No VoIP push** — session mode is link-driven, not ringing-driven. No `react-native-callkeep`, no PushKit, no FCM data messages.
5. **Native config** — Camera + microphone permissions only.

**Why no Chat SDK / no VoIP push:** session mode never initiates a call entity. Customers tap a meeting link, the app generates a token, joins the session. There's nothing to "ring." Initializing both SDKs + the VoIP-push stack adds substantial complexity for zero benefit.

### 4b. Standalone — Ringing mode (CallKeep + CallKit/ConnectionService + Incoming/Outgoing/Ongoing kit)

Dual-SDK: Chat SDK signaling channel + Calls SDK media channel. The skill scaffolds:

1. **`cometchat/init.ts`** — Chat SDK + Calls SDK init (sequential).
2. **`cometchat/CometChatProvider.tsx`** — Provider with init+login gate.
3. **`hooks/useCallKeep.ts`** — Sets up `react-native-callkeep`, registers event listeners (didReceiveStartCallAction, answerCall, endCall).
4. **`services/voipPush.ts`** — Combines `react-native-voip-push-notification` (iOS) + `@react-native-firebase/messaging` (Android). Handles incoming-call payloads → `RNCallKeep.displayIncomingCall(...)`.
5. **`screens/ProfileScreen.tsx`** (or wherever the call trigger lives) — Voice + video buttons.
6. **`screens/OngoingCallScreen.tsx`** — Hosts call surface via `<CometChatCalls.Component />` OR custom UI overlay. Implements rule 1.5 cleanup (`CometChatCalls.leaveSession()` + `RNCallKeep.endCall(callUUID)`).
7. **`screens/CallLogsScreen.tsx`** — Paginated history.
8. **Native config** — Info.plist, AndroidManifest.xml, Firebase setup, capabilities.
9. **Server-side push docs** — describes the VoIP cert + FCM key requirements; cannot automate.

## 5. Additive integration

When `cometchat-native-core` integration already exists. The skill:

1. Adds `@cometchat/calls-sdk-react-native` + the four push deps.
2. Patches `cometchat/init.ts` to add `CometChatCalls.init` after `CometChat.init`.
3. Mounts `<CometChatIncomingCall />` at app root (rule 1.7).
4. Wires `CometChatMessageHeader` call buttons (auto-rendered when `user` prop is set).
5. VoIP push: opt-in (asks user — substantial native config).
6. Adds a `CallLogsScreen` to the existing navigator if the user picked "dedicated screen".

## 6. Anti-patterns

1. **Using Expo Go for calls.** Calls require native modules that Expo Go can't load. Either eject or use a dev client. The skill refuses to scaffold against Expo Go.
2. **Skipping `cd ios && pod install`** after install. Symbols missing → "Native module CometChatCalls is null" runtime error. Bare RN only.
3. **Mounting `<CometChatIncomingCall />` inside a stack/tab navigator.** Loses the listener on stack push. Mount in App.tsx above the navigator (rule 1.7).
4. **Forgetting `RNCallKeep.endCall`** in the hangup path. CallKit/ConnectionService thinks the call is still active; lock-screen UI gets stuck.
5. **Sending Android push as `notification` instead of `data`.** ConnectionService cannot intercept `notification` payloads. Server must send `data: { type: "incoming_call", sessionId: "..." }` with `priority: "high"`.
6. **Missing Firebase `google-services.json`** for Android. Builds fail at compile time but the error is buried in Gradle output.
7. **Mixing `react-native-callkeep` v4 with RN <0.70.** Older RN versions need callkeep v3.x; the skill checks RN version.
8. **Passing `onAccept` to `<CometChatIncomingCall>`** (rule 1.8.c). Short-circuits the kit's internal `acceptCall` + OngoingCall transition — callee's UI moves but caller stays on "Calling…" indefinitely. Only handle `onDecline` + `onError`; let the kit own the accept path.
9. **`setError(String(e))` in catch blocks** (rule 1.8.b). Most SDK errors aren't `Error` subclasses → screen shows `[object Object]`. Use `e instanceof Error ? e.message : JSON.stringify(e)`.
10. **`await CometChatUIKit.getLoggedInUser()` without `.catch(() => null)`** (rule 1.8.a). RN SDK throws "User not found" on no-session — kills init before login can run.
11. **`pod install` without `USE_FRAMEWORKS=static`.** Default dynamic linkage produces a binary that can't load WebRTC at runtime. iOS only.
12. **`EXCLUDED_ARCHS = 'arm64 i386'` in Podfile post_install on Apple Silicon.** Intel-era workaround that breaks arm64 simulator linking for WebRTC pods. Remove on Apple Silicon hosts.
13. **`react-native start` followed by app reload without `adb reverse tcp:8081 tcp:8081`.** Only `run-android` sets the port forward; standalone Metro restart loses it. Symptom: "unable to load scripts." Bare RN only.
14. **Editing `.env` and expecting Metro hot-reload to pick it up.** `react-native-dotenv` is a babel-time plugin — `.env` changes need Metro `--reset-cache`. Bare RN only.
15. **Installing CometChat deps with `--legacy-peer-deps` and expecting all transitive peers to land.** npm silently skips peers — install `valibot`, `zustand`, `@xmldom/xmldom`, `abab`, `promise.allsettled`, `text-encoding`, `react-native-url-polyfill`, `react-native-performance`, plus Expo's `expo-linking`/`expo-constants`/`expo-asset`/`expo-font` explicitly. See §2 setup landmines.
16. **`npm install @cometchat/calls-lib-webrtc`.** Returns 404 — package is Cloudsmith-only. Use the `https://dl.cloudsmith.io/...` tarball URL.

## 7. Verification checklist

**Static:**

- [ ] All seven packages: chat-sdk-react-native, calls-sdk-react-native, callkeep, voip-push-notification, firebase/app, firebase/messaging, webrtc
- [ ] `@cometchat/calls-lib-webrtc` installed via Cloudsmith tarball (not npm — npm returns 404)
- [ ] iOS: `Info.plist` has UIBackgroundModes (audio + voip + remote-notification) + camera/mic/Bluetooth strings (rule 1.6 + §2 setup)
- [ ] iOS: PushKit token registration in App.tsx (or a hook called from there)
- [ ] iOS: `USE_FRAMEWORKS=static` used for `pod install`
- [ ] iOS (Apple Silicon): no `EXCLUDED_ARCHS = 'arm64 i386'` in Podfile post_install
- [ ] iOS: `.xcode.env.local` NODE_BINARY points at stable Homebrew node path
- [ ] Android: manifest has all four FOREGROUND_SERVICE_* permissions + MANAGE_OWN_CALLS + BIND_TELECOM_CONNECTION_SERVICE
- [ ] Android: `google-services.json` in `android/app/`
- [ ] Android: callkeep service registered with correct `foregroundServiceType`
- [ ] CometChatIncomingCall mounted at App.tsx (additive mode), no `onAccept` prop (rule 1.8.c)
- [ ] CometChatUIKit.getLoggedInUser called with `.catch(() => null)` (rule 1.8.a)
- [ ] Error rendering uses `e.message` not `String(e)` (rule 1.8.b)
- [ ] Env-var guard: provider throws actionable error when appId/region undefined (rule 1.8.c "Also recommended")
- [ ] Hangup path includes `leaveSession()` (v5-canonical; `endSession` is a deprecated shim) + `RNCallKeep.endCall`
- [ ] Module-level `initialized` flag

**Runtime (real devices, both platforms):**

- [ ] iOS — terminated app, lock screen rings on incoming call
- [ ] iOS — answer from lock screen → opens app, joins ongoing call
- [ ] Android — terminated app, ConnectionService rings (full-screen heads-up) on incoming call
- [ ] Android — answer from notification → opens app, joins ongoing call
- [ ] Both — outgoing call connects, two-way audio + video
- [ ] Both — hangup releases camera + mic, no lingering system call UI
- [ ] Both — Android 14+: ongoing-call notification visible, doesn't get killed by swipe
- [ ] Expo: only on dev client / standalone build, not Expo Go

## 8. Pointers

- `cometchat-native-core` — provider, init, gesture handler peer deps
- `cometchat-native-{expo,bare}-patterns` — pod install, gesture handler, dev client setup
- `cometchat-native-components` — full UI Kit catalog (additive mode)
- `cometchat-native-push` — APNs + FCM for chat (overlap with VoIP push but distinct paths — chat push is APNs/FCM standard, VoIP push is PushKit/FCM data-message)
- `cometchat-native-production` — server-minted tokens
- `cometchat-native-troubleshooting` — Metro cache, pod install failures, privacy manifest, gesture handler conflicts
