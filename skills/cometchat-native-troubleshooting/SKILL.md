---
name: cometchat-native-troubleshooting
description: "Diagnose CometChat React Native UI Kit integration failures — init/login, gesture handler, pod install, iOS privacy manifest, Android Maven, Metro cache, permissions, calls, extensions, v4-to-v5 upgrade. For push-specific symptoms see cometchat-native-push § 12."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native troubleshooting metro pods permissions upgrade"
---

## Purpose

Teaches Claude how to diagnose and fix CometChat React Native integration failures. Covers every category of failure I've seen across Expo + bare RN, with an up-front triage flow so Claude asks the right questions before assuming a fix.

**Read `cometchat-native-core` first** — most "why doesn't this work" issues trace to the init/login/wrapper chain explained there.

Ground truth: `docs/ui-kit/react-native/troubleshooting.mdx`, `apple-privacy-manifest-guide.mdx`, `upgrading-from-v4.mdx`, and first-hand failure modes from real integrations.

---

## 1. Triage — read project state before guessing

When the user reports a problem, gather facts before proposing a fix. Ask + run these first:

### 1a. Which framework?

```bash
# Expo or bare?
grep -E '"expo":|"expo-router":' package.json
ls -d ios android 2>/dev/null   # bare RN has these dirs at root
ls app.json app.config.js 2>/dev/null
```

- `expo` in dependencies + no `ios/android` folders → **Expo managed** → route to `cometchat-native-expo-patterns`
- `ios/` + `android/` folders at root → **bare RN** → route to `cometchat-native-bare-patterns`
- Both (`expo` + `ios/android`) → bare-after-prebuild. Treat as bare.

### 1b. Is the wrapper chain correct?

```bash
# Confirm four wrappers in entry file
grep -E "GestureHandlerRootView|SafeAreaProvider|CometChatThemeProvider|CometChatProvider" \
  App.tsx index.js index.ts app/_layout.tsx 2>/dev/null
```

If any are missing, that's almost certainly the cause. See `cometchat-native-core` § 3.

### 1c. Is `react-native-gesture-handler` imported first?

```bash
# Must be line 1 (or 2 with a shebang) of entry
head -5 index.js index.ts App.tsx app/_layout.tsx 2>/dev/null
```

If the import is missing or below React, swipe gestures and bottom sheets silently break — often only in release builds.

### 1d. Is init complete before login?

```bash
grep -A 10 "CometChatUIKit.init" src/providers/CometChatProvider.tsx 2>/dev/null
```

Look for the init-then-login sequence with an `await` or module-level `initialized` flag. Fire-and-forget init is a common cause of "components don't render."

### 1e. Pod install state (iOS)

```bash
ls ios/Pods/ | head -5 2>/dev/null       # should list dozens of pods
cat ios/Podfile.lock | head -3 2>/dev/null
```

If `ios/Pods/` is missing or sparse, native modules aren't linked. `cd ios && pod install && cd ..` is the fix.

### 1f. Package deps

```bash
# Check the full UI Kit peer-dep set is installed
for dep in \
  @cometchat/chat-sdk-react-native \
  @cometchat/chat-uikit-react-native \
  react-native-gesture-handler \
  react-native-safe-area-context \
  react-native-svg \
  @react-native-async-storage/async-storage; do
  node -e "try{require.resolve('$dep'); console.log('✓ $dep')}catch(e){console.log('✗ MISSING: $dep')}"
done
```

Missing peer deps → install + `pod install` (bare) or `expo install` (Expo) + rebuild.

---

## 2. Symptom → fix lookup tables

Quick-reference tables. Work through in order; if none match, drop into § 3 deep-dives.

### 2a. Initialization + login

| Symptom | Likely cause | Fix |
|---|---|---|
| `CometChatUIKit.init()` fails silently | Invalid `APP_ID` / `REGION` / `AUTH_KEY` | Re-verify from dashboard → your app → Credentials |
| Components render nothing after login | `init()` not awaited before mount | Use the provider pattern from `cometchat-native-core` § 6 with `isReady` gating |
| Blank screen, no errors | Component mounted before init completed | Conditionally render: `if (!isReady) return null` |
| `getLoggedInUser()` returns `null` | Login not called or session expired | Call `CometChatUIKit.login({ uid })` after init resolves |
| Login fails: "UID not found" | User doesn't exist in CometChat | Create via dashboard, SDK, or REST API. For dev, use `cometchat-uid-1` through `cometchat-uid-5` (pre-seeded) |
| "Please wait until the previous login request ends" | `login()` called concurrently (React StrictMode double-mount / navigation remount) | Use the `ensureLoggedIn` module-level promise guard from `cometchat-native-core` § 2 |
| `sendTextMessage()` fails | Not logged in or invalid receiver | Verify `getLoggedInUser()` returns a user + receiver user/group object exists |
| Production build exposes Auth Key | Using `authKey` in production | Switch to server-minted auth tokens via `login({ authToken })`. See `cometchat-native-production` |

### 2b. Gesture handler + wrapper chain

| Symptom | Likely cause | Fix |
|---|---|---|
| Composer swipe gestures not working | `import "react-native-gesture-handler"` not at TOP of entry file | Move to line 1 of `index.js` / `index.ts` / Expo Router's `app/_layout.tsx` |
| BottomSheet doesn't open on swipe | Missing `GestureHandlerRootView` wrapper | Wrap at app root with `<GestureHandlerRootView style={{ flex: 1 }}>` |
| Content overlaps status bar / home indicator | Missing `SafeAreaProvider` | Wrap inside `GestureHandlerRootView` with `<SafeAreaProvider>` |
| Theme tokens return undefined | Missing `CometChatThemeProvider` | Add wrapper. See `cometchat-native-core` § 3 for the full chain |
| "Couldn't find SafeArea context" error | `SafeAreaView` used outside `SafeAreaProvider` | Add `SafeAreaProvider` at root, or use plain `View` inside chat screens |
| Release build: swipe/gesture broken, dev build fine | `react-native-gesture-handler` not line 1 (some bundlers defer it) | Move to line 1 unconditionally |

### 2c. iOS build failures

| Symptom | Likely cause | Fix |
|---|---|---|
| `No such module 'RNGestureHandler'` | Pods not installed | `cd ios && pod install && cd ..` + rebuild |
| `Undefined symbol: _OBJC_CLASS_$_RNCAsyncStorage` | Pods out of sync after `npm install` | `cd ios && pod install && cd ..` |
| `TurboModuleRegistry.getEnforcing(...)` crash at runtime | Native module not linked | `cd ios && pod install && cd ..` + reset Metro cache (`--reset-cache`) |
| App Store rejection `ITMS-91053` | Missing Apple Privacy Manifest | Add `ios/<App>/PrivacyInfo.xcprivacy` with 4 API types. See `cometchat-native-bare-patterns` § 2c |
| Simulator build fails: "arm64 excluded" | Architecture mismatch on Apple Silicon | Add `EXCLUDED_ARCHS[sdk=iphonesimulator*]` post_install in Podfile. See `cometchat-native-features` § 3c |
| Camera/mic permission dialog doesn't appear | Missing `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` | Add to `ios/<App>/Info.plist` (bare) or `app.json` `ios.infoPlist` (Expo) |
| iOS build fails: "deployment target too low" | Calls SDK needs 12+ | Set `IPHONEOS_DEPLOYMENT_TARGET = '12.0'` in Podfile post_install |
| Expo Go crashes: "Main module field cannot be resolved" | Expo Go doesn't support native modules | Use dev builds: `npx expo run:ios` or `eas build --profile development` |

### 2d. Android build failures

| Symptom | Likely cause | Fix |
|---|---|---|
| `Could not find :react-native-async-storage_async-storage:` | Local Maven repo entry missing | Add to `android/build.gradle` `allprojects.repositories` — see `cometchat-native-bare-patterns` § 3b |
| Build crashes on launch | `compileSdkVersion` too low | Set `compileSdkVersion` to 33+ and `minSdkVersion` to 24+ in `android/app/build.gradle` |
| "Permission denied" when picking photos | Missing Android permissions | Add `READ_MEDIA_IMAGES` (API 33+) or `READ_EXTERNAL_STORAGE` (API ≤32) to `AndroidManifest.xml` |
| "Camera permission denied" | Missing permission in manifest or runtime denial | Add `CAMERA` to `AndroidManifest.xml` + verify runtime-grant flow |
| Gradle sync fails after `npm install` | Native module autolinking stale | `cd android && ./gradlew clean && cd ..` then rebuild |
| `Unable to delete file: ...node_modules/...` | Metro lockfile on Windows (if cross-OS) | Restart Metro + IDE |

### 2e. Metro / JS runtime

| Symptom | Likely cause | Fix |
|---|---|---|
| "Unable to resolve module ..." for a dep that IS installed | Metro cache stale | Stop Metro, run with `--reset-cache`: `npx react-native start --reset-cache` or `npx expo start --clear` |
| Fast Refresh doesn't pick up new deps | Native dep change (requires rebuild) | Restart Metro + rebuild (iOS/Android) |
| "Maximum update depth exceeded" after theme change | Theme object recreated each render | Define theme at module scope or in `useMemo(() => ..., [])` |
| App crashes on first JS load | Entry file error (syntax or import order) | Check `index.js` — `react-native-gesture-handler` should be line 1 |

### 2f. Theming

| Symptom | Likely cause | Fix |
|---|---|---|
| Theme overrides don't apply | Missing `CometChatThemeProvider` wrapper | Add at app root. See `cometchat-native-theming` § 2 |
| Dark mode doesn't switch when system toggled | `mode` hardcoded to `"light"` / `"dark"` | Omit the `mode` field to follow system |
| Custom color shows as fallback | Color not a hex string | Use `#RRGGBB` format. `rgb()` / named colors / `hsl()` break the extendedPrimary auto-derivation |
| Custom font shows system default (iOS) / crashes (Android) | Font not loaded before render | Gate the provider on font loading (Expo `useFonts` or bare `react-native-asset`) |
| Icon color not changing via `imageStyle` | Only `tintColor`, `height`, `width` work on default SVG icons | Use `tintColor`. Other props are ignored for built-in icons |
| `useTheme()` returns undefined | Called outside `CometChatThemeProvider` | Ensure the component is a descendant of the provider |

### 2g. Components

| Symptom | Likely cause | Fix |
|---|---|---|
| Slot view (`TitleView`, `LeadingView`, etc.) renders nothing | Slot returned `null` / `undefined` | Slot must return valid JSX |
| Empty message list despite sent messages | `user` vs `group` prop mixed up | Pass exactly one of `user` OR `group` — never both, never neither |
| "Reply in Thread" option does nothing when tapped | Thread panel not wired | Set `hideReplyInThreadOption` (see `cometchat-native-components` § 11) OR wire a thread panel (§ 2b) |
| `onItemPress` callback not firing | Wrong prop name (RN uses `Press` not `Click`) | It's `onItemPress`, not `onItemClick` — web and RN diverge here |
| Conversations list empty but data exists | Wrong request builder | Check `conversationsRequestBuilder` filters (tags, types) |
| List components collapse to zero height | Container has no bounded height | Wrap in `<View style={{ flex: 1 }}>` or explicit `height: N`. See `cometchat-native-placement` Hard rule #8 |
| Component renders but data never loads | User/group passed as UID string instead of `CometChat.User`/`Group` instance | `await CometChat.getUser(uid)` first, pass the resolved object |

### 2h. Calling

| Symptom | Likely cause | Fix |
|---|---|---|
| Call buttons missing from MessageHeader | `@cometchat/calls-sdk-react-native` not installed | Install + rebuild. See `cometchat-native-features` § 3 |
| Incoming call UI doesn't show | `CometChatIncomingCall` not mounted or listener not registered | Register `CometChat.addCallListener(...)` and mount `<CometChatIncomingCall>` at app root |
| Call connects but no audio/video | Missing Podfile settings or Android SDK versions | Check `IPHONEOS_DEPLOYMENT_TARGET = 12.0` + Android `minSdkVersion = 24` |
| WebRTC errors on load | Missing peer deps | Install `react-native-webrtc` + `@react-native-community/netinfo` + `react-native-background-timer` + `react-native-callstats` |
| Call crashes on Android after accept | Permissions denied at runtime | Request `RECORD_AUDIO` + `CAMERA` runtime permissions before call |
| `onIncomingCallReceived` silent | Listener registered before login completes | Register the listener INSIDE the `useEffect` that runs after login |

### 2i. Extensions

| Symptom | Likely cause | Fix |
|---|---|---|
| Polls option missing from composer | Extension not enabled in dashboard | `cometchat features enable polls --json` or toggle in dashboard → Features |
| Stickers not rendering | Sticker extension not enabled | Same as above — enable via CLI |
| Extension enabled but UI doesn't appear | Cached session — hard reload needed | Stop Metro, clear cache (`--reset-cache`), rebuild |
| Extension says enabled but `auto_wired_in_uikit: false` | Needs `extensions` field on `CometChatUIKit.init({ ... })` | Add `extensions: [new StickersExtension(), ...]` to the init settings — see `cometchat-native-features` § 2 |
| Message translation "Translate" option missing | Extension not enabled | Enable `MessageTranslation` via CLI / dashboard |

### 2j. AI features

| Symptom | Likely cause | Fix |
|---|---|---|
| AI suggestions don't appear | AI feature not enabled in dashboard | Enable via dashboard → AI → individual feature |
| Smart Replies not showing | Smart Replies extension off | Enable via CLI: `cometchat features enable smart-replies` |
| Conversation Starter missing | Feature off + no conversation context | Enable feature + ensure chat has at least one previous message |

### 2k. Localization

| Symptom | Likely cause | Fix |
|---|---|---|
| UI text not translated | Language code mismatch | Use full codes like `en-US`, not short `en` |
| Auto-detection not working | `react-native-localize` missing | Install: `npm install react-native-localize` + pod install |
| Custom translations not applied | Missing `CometChatI18nProvider` | Wrap app inside `CometChatThemeProvider` with `<CometChatI18nProvider>` |

### 2l. Events

| Symptom | Likely cause | Fix |
|---|---|---|
| Listener doesn't fire | Wrong event name | Check `docs/events.mdx` for exact event names (e.g., `ccMessageSent` not `onMessageSent`) |
| Listener fires twice | Duplicate registration (common with hot reload / remount) | Remove in `useEffect` cleanup: `return () => CometChatUIEventHandler.removeMessageListener(id)` |
| Listener ID collision | Hardcoded ID reused across components | Use a unique constant per component: `const LISTENER_ID = "APP_SCREEN_LISTENER"` |
| Call events not received | `CometChat.addCallListener` registered before login | Move registration into `useEffect` after login completes |

### 2m. Production / auth tokens

| Symptom | Likely cause | Fix |
|---|---|---|
| `login({ authToken })` fails: "user does not exist" | User not created in CometChat before token mint | Create user server-side via REST API on your signup flow. See `cometchat-native-production` § 6 |
| Token endpoint returns 401 | Backend auth check failing | Verify `Authorization: Bearer <jwt>` header is attached to the fetch |
| 429 rate limit on token endpoint | Minting tokens too often (e.g. per screen mount) | Cache client-side, reuse until expiry. See `cometchat-native-production` § 10 |
| SDK disconnects after a few hours | Token expired | Wire `onDisconnected` listener to re-fetch + re-login. See `cometchat-native-production` § 5c |
| `CometChatUIKit.loginWithAuthToken` not found | Wrong API name | It's `CometChatUIKit.login({ authToken })` — same method as dev, different key |

---

## 3. Deep dives on common failures

### 3a. "The most common 'why is my chat blank' bug"

CometChat components fill 100% of their parent's height. If the parent has no bounded height, the components render at 0px and look empty.

Diagnostic:

```bash
grep -B5 -A5 "CometChatMessageList\|CometChatConversations" src/**/*.tsx | grep -B2 -A2 "style"
```

Look for the message list's parent. One of these must be true:

- Parent has `flex: 1`
- Parent has an explicit `height: N`
- Parent is a flex column with the list getting `flex: 1`

Broken example:
```tsx
<ScrollView>
  <CometChatMessageList user={user} />   {/* ← ScrollView doesn't constrain height */}
</ScrollView>
```

Fixed:
```tsx
<View style={{ flex: 1 }}>
  <CometChatMessageList user={user} hideReplyInThreadOption />
</View>
```

### 3b. Apple Privacy Manifest rejection (`ITMS-91053`)

Apple's App Store Connect rejects RN apps that use certain APIs without declaring them in `PrivacyInfo.xcprivacy`. The CometChat kit (through React Native + `react-native-video`) triggers 4 of these APIs.

Full manifest content is in `cometchat-native-bare-patterns` § 2c. Required reason codes:

| API | Code |
|---|---|
| FileTimestamp | `C617.1` |
| UserDefaults | `CA92.1` |
| SystemBootTime | `35F9.1` |
| DiskSpace | `E174.1` |

If the user's rejection email lists OTHER API categories, their app uses additional Apple APIs through other SDKs (analytics, crash reporters, etc.). Add those codes too — the CometChat-specific 4 aren't exhaustive for all apps.

After updating:
1. `cd ios && pod install && cd ..`
2. Rebuild the archive
3. Resubmit

### 3c. Metro cache issues (post-dep-install "not found" errors)

Happens when you `npm install` a native module and Metro's bundler still has the old module graph cached.

```bash
# Full reset
watchman watch-del-all 2>/dev/null          # watchman (if installed)
rm -rf $TMPDIR/metro-*                       # Metro cache on macOS
rm -rf $TMPDIR/haste-map-*                   # Haste cache on macOS
rm -rf node_modules
npm install
cd ios && pod install && cd ..               # iOS only
npx react-native start --reset-cache         # bare
# OR for Expo:
npx expo start --clear
```

If the error persists after a clean cache + pod install, the native module isn't autolinked. Check `react-native.config.js` for exclusions.

### 3d. "App crashes on first launch" — entry file order

`index.js` MUST have `import "react-native-gesture-handler"` as line 1. Not line 2. Not after a `// comment`. Not after a `"use strict"`. Literally line 1.

Wrong:
```js
import React from "react";              // ← line 1
import "react-native-gesture-handler";  // ← line 2 — TOO LATE
```

Right:
```js
import "react-native-gesture-handler";  // ← line 1
import React from "react";
```

For Expo Router, the same rule applies to `app/_layout.tsx`.

### 3e. Push notification issues

Push setup is covered end-to-end in `cometchat-native-push`. That skill
has:

- § 3 APNs p8 setup (Apple Developer portal)
- § 4 FCM setup (Firebase project + service account)
- § 5 CometChat dashboard provider upload (dev + prod for iOS)
- § 7 Client registration with `CometChatNotifications.registerPushToken(token, platform, providerId)` (the correct API — not `CometChat.registerTokenForPushNotification`)
- § 9 Foreground display + tap-to-deep-link handlers
- § 12 Troubleshooting table mapping symptoms to fixes (production APNs cert missing, token registered before login, Expo Go can't receive push, etc.)

When diagnosing a push issue, route the user to `cometchat-native-push § 12`
rather than re-triaging here.

---

## 4. v4 → v5 upgrade gotchas

If the user is upgrading from `@cometchat/chat-uikit-react-native@4`, these are the common breakages. Full migration guide: `docs/upgrading-from-v4.mdx`.

| v4 | v5 | Notes |
|---|---|---|
| `CometChatContext` provider | `CometChatThemeProvider` + `CometChatI18nProvider` | Split into theme + i18n providers |
| `<CometChatConversationsWithMessages>` composite | `<CometChatConversations>` + navigate to separate screen | Composite component removed; use two-screen navigation pattern |
| `theme` prop on components | Theme via `CometChatThemeProvider` only | Per-component theme prop removed |
| `Palette` object | Color tokens under `theme.color` | Renamed + restructured |
| `onClick` callback names | `onPress` callback names | React Native convention |
| `CometChat.login(uid, authKey)` | `CometChatUIKit.login({ uid })` | Object-form argument |
| Native deps in `peerDependencies` | Must explicitly install peer deps | See `cometchat-native-core` § 9 |
| Single NPM package for calls | Separate `@cometchat/calls-sdk-react-native` package | Calls broken out |

### Upgrade sequence

```bash
# 1. Update the main kit
npm install @cometchat/chat-uikit-react-native@latest

# 2. Install the full peer-dep set (v5 doesn't auto-install them like v4 did)
npm install @cometchat/chat-sdk-react-native \
  @react-native-async-storage/async-storage \
  @react-native-clipboard/clipboard \
  @react-native-community/datetimepicker \
  react-native-gesture-handler react-native-localize \
  react-native-safe-area-context react-native-svg \
  react-native-video dayjs punycode

# 3. iOS
cd ios && pod install && cd ..

# 4. Android — add the local Maven repo for async-storage
#    (see cometchat-native-bare-patterns § 3b)

# 5. Entry file — add `import "react-native-gesture-handler"` as line 1
#    (new requirement in v5)

# 6. Replace `<CometChatContext>` with the 4-wrapper chain
#    (see cometchat-native-core § 3)

# 7. Split composite components — e.g. `<CometChatConversationsWithMessages>`
#    becomes two screens with navigation

# 8. Rename `onClick*` → `onPress*` throughout

# 9. Replace `Palette` → theme tokens

# 10. Rebuild + test
```

---

## 5. Escalation — when the above doesn't solve it

If none of the lookup tables or deep dives apply:

1. **Read the raw error.** RN errors are usually specific ("Module 'X' not found in app 'Y'" is different from "TurboModuleRegistry.getEnforcing").
2. **Check the dev console + native logs.** For iOS: Xcode → View → Debug Area → Activate Console. For Android: `adb logcat | grep -E "cometchat|CometChat|ReactNative"`.
3. **Search the upstream docs MCP** (`cometchat-docs` if installed).
4. **Search the sample app** (`examples/SampleApp/` or `examples/SampleAppExpo/`) for a working version of the pattern the user is trying.
5. **If the issue is a kit bug**, file at https://github.com/cometchat/cometchat-uikit-react-native/issues with a minimal repro.

---

## 6. Hard rules (diagnostic best-practice)

1. **Don't assume — triage first.** § 1 gets the framework, wrapper chain, pod state, and dep list before proposing a fix. A "I don't see messages" could be 10 different things.
2. **Don't suggest "try reinstalling node_modules" as a first step.** It's rarely the actual fix and it takes minutes; check the entry file, wrapper chain, and pod state first.
3. **Always verify against the ground-truth doc** (`troubleshooting.mdx`). If a user's symptom matches a table row, use the doc's fix verbatim — don't paraphrase.
4. **Never guess a fix that requires code changes without first gathering facts.** Changing code based on a wrong hypothesis wastes user time.
5. **When recommending a rebuild, say why + what to rebuild.** "pod install + rebuild iOS" is more useful than "try rebuilding."
6. **If a symptom matches the Apple Privacy Manifest rejection, always paste the full 4-code XML.** Don't describe it; show it.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Most "doesn't work" bugs trace back here — init/login/wrapper chain |
| `cometchat-native-components` | Wrong prop / slot view / request builder |
| `cometchat-native-placement` | Blank chat / bounded-height issues |
| `cometchat-native-expo-patterns` | Expo-specific build errors (dev client required, `expo install`) |
| `cometchat-native-bare-patterns` | Bare RN build errors (pod install, Android Maven, privacy manifest) |
| `cometchat-native-theming` | Theme not applying, dark mode not switching, font not loading |
| `cometchat-native-features` | Calls don't work, extension UI missing after enable |
| `cometchat-native-customization` | Formatter not rendering, listener not firing, template not showing |
| `cometchat-native-production` | 401 on token fetch, user-does-not-exist on login |
| `cometchat-native-troubleshooting` | This skill — cross-category diagnosis + v4→v5 upgrade |
