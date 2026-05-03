---
name: cometchat-native-bare-patterns
description: "Integration patterns for bare React Native CLI projects — pod install, Info.plist + AndroidManifest permissions, Apple privacy manifest, native module linking, Metro config."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.77; @cometchat/chat-uikit-react-native ^5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native bare cli pods native-modules privacy-manifest"
---

## Purpose

Teaches Claude how to integrate CometChat into a bare React Native CLI project. Covers:

- Installing the full peer-dependency set + native-module autolinking
- `pod install` cadence for iOS
- Editing `ios/<AppName>/Info.plist` for iOS permissions
- Editing `android/app/src/main/AndroidManifest.xml` for Android permissions
- Android-specific async-storage Maven repo gotcha
- **Apple privacy manifest** (`ios/<AppName>/PrivacyInfo.xcprivacy`) — required for App Store compliance
- Wiring `index.js` + `App.tsx` with the provider chain

**Read `cometchat-native-core` first** (init/login/wrapper chain + anti-patterns), then `cometchat-native-components`, then `cometchat-native-placement`.

Ground truth: `docs/ui-kit/react-native/react-native-cli-integration.mdx`, `apple-privacy-manifest-guide.mdx`, `react-native-conversation.mdx` + `react-native-one-to-one-chat.mdx` + `react-native-tab-based-chat.mdx`, and `examples/SampleApp/`.

---

## Use this skill when

- Project has `ios/` and `android/` folders at the root
- `package.json` `main` is `index.js` (classic RN entry)
- No `expo` in `package.json` dependencies
- User says "React Native CLI", "bare RN", "ejected Expo", or "custom native modules"

**Do NOT use this skill when:**
- Project has `expo` in dependencies + `app.json`/`app.config.js` → use `cometchat-native-expo-patterns`
- Project is Expo that's prebuilt into `ios/` + `android/` folders → this can go either way. If the user's workflow is "I edit app.json and run `expo prebuild`", stay on expo-patterns. If they've fully committed to bare (deleted `app.json`, edit `Info.plist` directly), this skill applies.

---

## Prerequisites

- Xcode 15+ for iOS (required for Apple privacy manifest)
- Android Studio with SDK 34+
- CocoaPods installed (`brew install cocoapods` on macOS)
- `react-native-cli` or `@react-native-community/cli` usable via `npx`
- React Native **>=0.77** — older versions may work but are not officially supported by the UI Kit

---

## Step 1 — Install dependencies

```bash
# Core SDK + UI Kit
npm install @cometchat/chat-sdk-react-native
npm install @cometchat/chat-uikit-react-native

# Required peer deps (natively linked)
npm install \
  @react-native-async-storage/async-storage \
  @react-native-clipboard/clipboard \
  @react-native-community/datetimepicker \
  react-native-gesture-handler \
  react-native-localize \
  react-native-safe-area-context \
  react-native-svg \
  react-native-video

# dayjs + punycode — no native code but required
npm install dayjs punycode
```

Bare RN uses autolinking, so no `react-native link` step is needed. Just confirm everything installed cleanly — if `npm install` errored mid-way, native modules won't be wired up correctly.

### Optional — calling SDK

Only if the user's flow includes voice / video calls:

```bash
npm install \
  @cometchat/calls-sdk-react-native \
  @react-native-community/netinfo \
  react-native-background-timer \
  react-native-callstats \
  react-native-webrtc
```

WebRTC bloats the binary. Skip until the user actually wants calls.

---

## Step 2 — iOS: pod install + Info.plist + PrivacyInfo

### 2a. Pod install

After **every** `npm install` of a native module (including the initial install above), run:

```bash
cd ios && pod install && cd ..
```

Without this, Xcode will fail to build with "module not found" errors for native classes. The warning signs:

- `No such module 'RNGestureHandler'` during build
- `Undefined symbol: _OBJC_CLASS_$_RNCAsyncStorage` during linking
- Build succeeds but runtime crash: "TurboModuleRegistry.getEnforcing(...): 'RNAsyncStorage' could not be found"

If pod install fails, see `cometchat-native-troubleshooting` § iOS pod install failures.

### 2b. Info.plist permissions

Open `ios/<AppName>/Info.plist` and add:

```xml
<key>NSCameraUsageDescription</key>
<string>Allow camera access to send photos and make video calls</string>

<key>NSMicrophoneUsageDescription</key>
<string>Allow microphone access to send voice messages and make calls</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Allow photo library access to send photos</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Allow saving photos from chat to your library</string>
```

**Permission-string best practice**: the `Usage` strings show in the system prompt when iOS asks the user for permission — write them as user-facing copy, not developer notes. `"Camera access for video calls"` is fine; `"for media upload"` isn't a real reason a user would accept.

**Merge, don't replace.** The user may have existing permission strings for other libraries — add only what's missing, don't wipe the file.

### 2c. Apple Privacy Manifest — `PrivacyInfo.xcprivacy`

**Required for App Store submission since iOS SDK 17 / Xcode 15.** If it's missing or incomplete, App Store Connect rejects the upload.

Create `ios/<AppName>/PrivacyInfo.xcprivacy` with this exact content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>C617.1</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>35F9.1</string>
            </array>
        </dict>
    </array>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyTracking</key>
    <false/>
</dict>
</plist>
```

These 3 reason codes match what the kit's own `examples/SampleApp/ios/SampleApp/PrivacyInfo.xcprivacy` ships:

| API category | Reason code | What it's for |
|---|---|---|
| `NSPrivacyAccessedAPICategoryFileTimestamp` | `C617.1` | File-modified timestamps (RN bundler) |
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` | AsyncStorage (UserDefaults backend on iOS) |
| `NSPrivacyAccessedAPICategorySystemBootTime` | `35F9.1` | Uptime for scheduling (RN + video cache) |

> **Optional fourth entry:** if your app does explicit free-space checks before media uploads, add `NSPrivacyAccessedAPICategoryDiskSpace` / `E174.1` too. The kit's sample doesn't ship this entry, so it isn't required for a default integration.

After adding:

1. Open `ios/<AppName>.xcworkspace` in Xcode
2. Right-click the app folder in the navigator → "Add Files to \"\<AppName\>\""
3. Select `PrivacyInfo.xcprivacy` — make sure "Add to targets: \<AppName\>" is checked
4. Rebuild

**If the user already has a `PrivacyInfo.xcprivacy`**, merge the 4 API types into their existing `NSPrivacyAccessedAPITypes` array — don't replace the whole file.

### 2d. Install pods after Info.plist / PrivacyInfo changes

```bash
cd ios && pod install && cd ..
```

---

## Step 3 — Android: AndroidManifest + Maven repo

### 3a. AndroidManifest permissions

Open `android/app/src/main/AndroidManifest.xml` and add inside `<manifest>` (before `<application>`):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Android 12 and below -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />

<!-- Android 13+ (API 33+) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
```

**Merge, don't replace.** Keep the user's existing permissions for other libraries.

### 3b. Android: async-storage Maven repo (REQUIRED)

`@react-native-async-storage/async-storage` v3+ ships a **local Maven artifact** that autolinking can't find by default. Without this fix, `./gradlew assembleDebug` fails with:

```
Could not find :react-native-async-storage_async-storage: on any of the paths.
```

Add the local Maven repo to `android/build.gradle`:

```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
        // Required for @react-native-async-storage/async-storage v3+
        maven {
            url = uri(project(":react-native-async-storage_async-storage").file("local_repo"))
        }
    }
}
```

Without this fix, the whole Android build fails early. This is a UI Kit-specific gotcha because the kit pins async-storage v3+.

### 3c. Android: Metro config for custom fonts or assets (if applicable)

If the project uses custom icon fonts or bundled assets, confirm `react-native.config.js` includes:

```js
module.exports = {
  assets: ["./src/assets/fonts/"],   // only if the user has custom fonts
};
```

Run `npx react-native-asset` to link. Not required for the UI Kit itself — only relevant if the user extends with custom icons.

---

## Step 4 — Wire `index.js` + `App.tsx` with the provider chain

### 4a. `index.js` — gesture handler FIRST

```js
// index.js
import "react-native-gesture-handler";   // MUST be the first import
import { AppRegistry } from "react-native";
import App from "./App";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);
```

**The `react-native-gesture-handler` import must be line 1.** Not line 2. Not after React. Without it, swipe gestures on the composer and bottom sheets silently break — often only in release builds, which makes it hard to catch during development.

### 4b. `App.tsx` — provider wrapper chain

```tsx
// App.tsx
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CometChatThemeProvider } from "@cometchat/chat-uikit-react-native";
import { CometChatProvider } from "./src/providers/CometChatProvider";
import { AppNavigator } from "./src/navigation/AppNavigator";
import Config from "react-native-config";  // or read from an env source

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CometChatThemeProvider>
          <CometChatProvider
            appId={Config.COMETCHAT_APP_ID!}
            region={Config.COMETCHAT_REGION!}
            authKey={Config.COMETCHAT_AUTH_KEY!}
            uid="cometchat-uid-1"   // dev mode only
          >
            <AppNavigator />
          </CometChatProvider>
        </CometChatThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

The `CometChatProvider` itself lives in `src/providers/CometChatProvider.tsx` per `cometchat-native-core` § 6 — reuse that implementation.

---

## Step 5 — Env vars

Bare RN has no built-in env var system. Pick one:

### Option A — `react-native-config` (most common)

```bash
npm install react-native-config
cd ios && pod install && cd ..
```

Create `.env` at project root:

```
COMETCHAT_APP_ID=your_app_id
COMETCHAT_REGION=us
COMETCHAT_AUTH_KEY=your_auth_key
```

Read via:

```tsx
import Config from "react-native-config";
const appId = Config.COMETCHAT_APP_ID;
```

**iOS post-setup**: Xcode needs to know about the `.env` file. Either use `react-native-config`'s Xcode build-phase script (documented in its README) or create a `.xcconfig` file. Without this, `Config.*` returns `undefined` on iOS.

### Option B — `babel-plugin-dotenv-import`

Simpler but less mature. Only if the user's already picked this.

### Option C — hardcoded constants (NEVER for production)

For a quick dev-mode proof-of-concept only, just declare the values as constants in a dedicated config file:

```ts
// src/config/cometchat.ts
export const CONFIG = {
  APP_ID: "YOUR_APP_ID",
  REGION: "us",
  AUTH_KEY: "YOUR_AUTH_KEY",
};
```

Add `src/config/cometchat.ts` to `.gitignore`. Obviously do not commit real credentials.

### Never put `REST_API_KEY` in the client

The REST API key is server-only. Production user management + auth token minting happens on a backend you control — see `cometchat-native-production`.

---

## Step 6 — Run + verify

### First run

```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

First build takes several minutes. Subsequent runs with the Metro bundler already running are fast.

### Verify

1. `npx tsc --noEmit` — TypeScript check
2. Open the chat screen in the simulator
3. Tap the composer — keyboard should open smoothly
4. Tap the "+" attachment button — action sheet should slide up (gesture handler)
5. Send a message — it should appear immediately

If any of these fail, see `cometchat-native-troubleshooting`.

### Re-run cadence

| Change | Command |
|---|---|
| JSX / TS changes | Fast Refresh handles it; `r` in Metro to reload |
| Added / removed a dep without native code | Restart Metro |
| Added / removed a native module | `cd ios && pod install && cd ..` then run-ios |
| Changed `Info.plist` | `run-ios` (Xcode picks up changes) |
| Changed `AndroidManifest.xml` | `run-android` |
| Changed `android/build.gradle` | `./gradlew clean` then `run-android` |

---

## Hard rules

1. **`pod install` is mandatory after every native dep change.** Missing this → build fails with "module not found" or crashes at runtime with "TurboModuleRegistry could not find X".

2. **`import "react-native-gesture-handler"` is the FIRST line of `index.js`.** Before React. Before any other import. Missing → swipe gestures silently break (often only in release builds).

3. **Android requires the local Maven repo entry** for `@react-native-async-storage/async-storage` v3+ (see § 3b). Without it, the Android build fails at the assembly step.

4. **The Apple Privacy Manifest is required for App Store submission.** Skip it and your app gets rejected. Either create `PrivacyInfo.xcprivacy` (§ 2c) or merge the 4 API types into an existing one.

5. **Merge permissions into `Info.plist` and `AndroidManifest.xml`, don't replace.** Wiping out the user's existing permissions breaks their other features.

6. **The four-wrapper chain is at the app root (`App.tsx`), not per-screen.** Re-wrapping per screen causes duplicate init + login, dropped WebSockets, and a 2-3 second flicker on first mount.

7. **`REST_API_KEY` is never in the client.** Use an external backend for token minting — see `cometchat-native-production`.

8. **Every `<CometChatMessageList>` must include `hideReplyInThreadOption`** unless you're wiring a full thread panel (see `cometchat-native-placement` § Hard rule 5).

---

## Common questions

**Q: "TurboModuleRegistry.getEnforcing(...): 'RNAsyncStorage' could not be found"**
Forgot `pod install`. Run `cd ios && pod install && cd ..` then rebuild.

**Q: Android build fails with "Could not find :react-native-async-storage_async-storage:"**
See § 3b — add the local Maven repo entry to `android/build.gradle`.

**Q: App Store rejected the build with "ITMS-91053: Missing API declaration"**
Apple Privacy Manifest is incomplete. Use the full 4-API-type declaration in § 2c.

**Q: Composer swipe gestures don't work in production**
`import "react-native-gesture-handler"` isn't the first line of `index.js`. Move it above all other imports.

**Q: `CometChatUIKit.login({uid: "..."})` resolves but components don't render**
You're probably rendering before `init()` completes. Gate rendering on `CometChatProvider`'s `isReady` state — see `cometchat-native-core` § 6.

**Q: I want to support Expo AND bare in the same codebase**
Use Expo + `npx expo prebuild` to generate native projects on demand. Stay on `cometchat-native-expo-patterns`.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Init / login / wrapper chain / anti-patterns |
| `cometchat-native-components` | Component prop reference |
| `cometchat-native-placement` | Where chat goes (stack / tabs / modal / bottom sheet / embedded) |
| `cometchat-native-expo-patterns` | Expo managed workflow |
| `cometchat-native-bare-patterns` | This skill — bare RN CLI |
| `cometchat-native-features` | Calls, extensions, AI |
| `cometchat-native-theming` | Theme customization |
| `cometchat-native-customization` | Text formatters, events, custom views |
| `cometchat-native-production` | Server-side auth tokens + user management |
| `cometchat-native-troubleshooting` | pod install fails, build errors, missing modules, privacy manifest rejection |
