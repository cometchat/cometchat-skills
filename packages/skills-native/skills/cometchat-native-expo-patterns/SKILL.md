---
name: cometchat-native-expo-patterns
description: "Integration patterns for Expo managed workflow — app.json config, permissions, gesture handler setup, env vars, Expo Router file-based routing subsection."
license: "MIT"
compatibility: "Node.js >=18; Expo SDK >=50; @cometchat/chat-uikit-react-native ^5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native expo managed expo-router"
---

## Purpose

Teaches Claude how to integrate CometChat into an Expo managed workflow project. Covers:

- Installing the full peer-dependency set (not just the UI Kit)
- Configuring `app.json` permissions for iOS + Android
- Wiring the provider chain in `App.tsx` with all four wrappers
- Optional calling SDK setup
- Env vars via `expo-constants` or `.env`
- **Expo Router subsection** (file-based routing)
- Prebuild + run cadence

**Read `cometchat-native-core` first** (init/login/wrapper chain + anti-patterns), then `cometchat-native-components` (prop reference), then `cometchat-native-placement` (where chat goes).

Ground truth: `docs/ui-kit/react-native/expo-integration.mdx`, `expo-conversation.mdx`, `expo-one-to-one-chat.mdx`, `expo-tab-based-chat.mdx`, and `examples/SampleAppExpo/`.

---

## Use this skill when

- Project has `expo` in `package.json` dependencies
- `app.json` / `app.config.js` exists at the root
- `package.json` `main` field references `expo` (e.g. `"main": "index.js"` with an Expo-style entry)
- The user says "Expo", "Expo Router", "managed workflow", or "EAS"

**Do NOT use this skill when:**
- The project has an `ios/` + `android/` folder at the root (that's bare RN → use `cometchat-native-bare-patterns`)
- The user says "bare React Native", "React Native CLI", or "ejected"

---

## Hard prerequisite — Expo Go is NOT supported

The CometChat UI Kit depends on native modules that can't be shimmed. This means:

- **Expo Go won't load your app** — you'll see "Main module field cannot be resolved" or similar
- You must build a **development client** (`eas build --profile development` or `expo run:ios` / `expo run:android`)
- Or install in a plain Expo simulator via prebuild

The first build can take 5-15 minutes. Subsequent runs are fast via the dev client.

Before integrating, confirm the user has either:
- `eas-cli` installed and an EAS account, OR
- Xcode + Android Studio for local prebuilds

If neither, stop and ask them to set one up. Don't waste their time installing packages that won't run.

---

## Step 1 — Install dependencies

The UI Kit has a long peer-dep tail. Install them all in one shot so Expo's resolver doesn't miss a native module during prebuild:

```bash
# Core SDK + UI Kit
npm install @cometchat/chat-sdk-react-native
npm install @cometchat/chat-uikit-react-native

# Required peer deps (all natively-linked)
npx expo install \
  @react-native-async-storage/async-storage \
  @react-native-clipboard/clipboard \
  @react-native-community/datetimepicker \
  react-native-gesture-handler \
  react-native-localize \
  react-native-safe-area-context \
  react-native-svg \
  react-native-video

# dayjs + punycode — no native code but required by the kit
npm install dayjs punycode
```

**Why `npx expo install` for the natively-linked deps?** `expo install` picks versions compatible with the project's Expo SDK. Using `npm install` directly can land incompatible versions that break prebuild.

### Optional — calling SDK

If the user's flow includes voice / video calls (the `cometchat-native-features` skill's § Calls gates this):

```bash
npm install @cometchat/calls-sdk-react-native
npx expo install \
  @react-native-community/netinfo \
  react-native-background-timer \
  react-native-callstats \
  react-native-webrtc
```

Skip these until the user actually wants calls. Adding WebRTC to an Expo project bloats the prebuild and requires extra permissions — don't speculatively enable it.

---

## Step 2 — Configure app.json

Add iOS + Android permissions so the kit's attachments, camera, mic, and media features work. Merge into existing `expo.ios.infoPlist` / `expo.android.permissions` — do not replace anything the user already has.

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Allow camera access to send photos and make video calls",
        "NSMicrophoneUsageDescription": "Allow microphone access to send voice messages and make calls",
        "NSPhotoLibraryUsageDescription": "Allow photo library access to send photos",
        "NSPhotoLibraryAddUsageDescription": "Allow saving photos from chat to your library"
      }
    },
    "android": {
      "permissions": [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.VIBRATE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO"
      ]
    }
  }
}
```

**Permission-string best practice**: the iOS `Usage` strings show in the system prompt when iOS asks the user for permission — write them as user-facing copy, not developer notes. `"Camera access for video calls"` is fine; `"for media upload"` isn't a real reason a user would accept.

### If the project uses `app.config.js` or `app.config.ts`

Merge the same fields into the exported config. Don't switch the project from JS to JSON unless the user asks — respect their setup.

---

## Step 3 — Wire the provider chain in App.tsx

Expo projects use the same four-wrapper chain as bare RN (see `cometchat-native-core` § 3). The difference is the entry file — Expo uses `App.tsx` (or `index.ts` + `registerRootComponent`) rather than bare's `index.js` + `AppRegistry`.

```tsx
// App.tsx
import "react-native-gesture-handler";   // MUST be the first import
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CometChatThemeProvider } from "@cometchat/chat-uikit-react-native";
import { CometChatProvider } from "./src/providers/CometChatProvider";
import { AppNavigator } from "./src/navigation/AppNavigator";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CometChatThemeProvider>
          <CometChatProvider
            appId={extra.COMETCHAT_APP_ID}
            region={extra.COMETCHAT_REGION}
            authKey={extra.COMETCHAT_AUTH_KEY}
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

The `CometChatProvider` itself is defined per `cometchat-native-core` § 6 — reuse that implementation; don't invent another one.

### `import "react-native-gesture-handler"` must be first

Even before React. Expo's entry-file hot reload otherwise loses the gesture handler patch and the composer / bottom-sheet gestures silently disable.

```ts
// At the top of App.tsx:
import "react-native-gesture-handler";
// THEN everything else
import React from "react";
```

---

## Step 4 — Env vars

Two options; pick one based on what the project already uses.

### Option A — `app.json extra` + `expo-constants` (simple, recommended)

```json
{
  "expo": {
    "extra": {
      "COMETCHAT_APP_ID": "YOUR_APP_ID",
      "COMETCHAT_REGION": "us",
      "COMETCHAT_AUTH_KEY": "YOUR_AUTH_KEY"
    }
  }
}
```

Read via `expo-constants`:

```tsx
import Constants from "expo-constants";
const { COMETCHAT_APP_ID, COMETCHAT_REGION, COMETCHAT_AUTH_KEY } = Constants.expoConfig?.extra ?? {};
```

**Warning**: these values end up in the client bundle. Never put `REST_API_KEY` or any server-side secret in `expo.extra` — use a backend (see `cometchat-native-production`).

### Option B — `.env` + `expo-dotenv` / SDK-native `.env` support

Expo SDK 50+ supports `.env` out of the box via `EXPO_PUBLIC_*` prefix:

```
# .env
EXPO_PUBLIC_COMETCHAT_APP_ID=your_app_id
EXPO_PUBLIC_COMETCHAT_REGION=us
EXPO_PUBLIC_COMETCHAT_AUTH_KEY=your_auth_key
```

Read directly via `process.env.EXPO_PUBLIC_COMETCHAT_APP_ID` anywhere in your app. Any variable WITHOUT the `EXPO_PUBLIC_` prefix is ONLY available in `app.config.js` / server scripts, not bundled — useful for REST API keys in backend-only code.

### Which to choose

- If the project already has `.env` — **Option B**.
- If the project hasn't set up env vars at all — **Option A** (one file, no prefix rules).
- Never mix both for the same variable — pick one place.

---

## Step 5 — Expo Router subsection

Expo Router is a file-based alternative to `@react-navigation/*`. If the project has `app/` instead of (or alongside) `src/screens/`, they're using Expo Router.

Detect Expo Router by checking `package.json` for `expo-router` in dependencies, and `app.json` for the `"expo-router"` plugin.

### 5a — Router entry (`app/_layout.tsx`)

In Expo Router, the `app/_layout.tsx` file is the root layout — wrap the provider chain here instead of in `App.tsx`.

```tsx
// app/_layout.tsx
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CometChatThemeProvider } from "@cometchat/chat-uikit-react-native";
import { CometChatProvider } from "../src/providers/CometChatProvider";
import { Slot } from "expo-router";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CometChatThemeProvider>
          <CometChatProvider
            appId={extra.COMETCHAT_APP_ID}
            region={extra.COMETCHAT_REGION}
            authKey={extra.COMETCHAT_AUTH_KEY}
            uid="cometchat-uid-1"
          >
            <Slot />   {/* Expo Router renders child routes here */}
          </CometChatProvider>
        </CometChatThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### 5b — Conversations + message route

```
app/
  _layout.tsx          ← provider chain (above)
  index.tsx            ← home (could be the conversations list)
  messages/
    [uid].tsx          ← dynamic route, one chat per uid
```

```tsx
// app/index.tsx
import { CometChatConversations, CometChatUiKitConstants } from "@cometchat/chat-uikit-react-native";
import { router } from "expo-router";

export default function Home() {
  return (
    <CometChatConversations
      onItemPress={(conversation) => {
        const entity = conversation.getConversationWith();
        const type = conversation.getConversationType();
        if (type === CometChatUiKitConstants.ConversationTypeConstants.user) {
          router.push(`/messages/${(entity as any).getUid()}`);
        } else {
          router.push(`/messages/group-${(entity as any).getGuid()}`);
        }
      }}
    />
  );
}
```

```tsx
// app/messages/[uid].tsx
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { CometChat } from "@cometchat/chat-sdk-react-native";
import {
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
} from "@cometchat/chat-uikit-react-native";

export default function ChatScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [user, setUser] = useState<CometChat.User | null>(null);

  useEffect(() => {
    if (!uid) return;
    // Simple UID routing; group routing encodes differently in the index example above
    CometChat.getUser(uid).then(setUser).catch(() => setUser(null));
  }, [uid]);

  if (!user) return null;

  return (
    <View style={{ flex: 1 }}>
      <CometChatMessageHeader user={user} onBack={() => router.back()} showBackButton />
      <CometChatMessageList user={user} hideReplyInThreadOption />
      <CometChatMessageComposer user={user} />
    </View>
  );
}
```

### 5c — Tabs in Expo Router (if the project uses them)

```
app/
  _layout.tsx
  (tabs)/
    _layout.tsx        ← Tabs layout
    chats.tsx
    users.tsx
    groups.tsx
    calls.tsx
  messages/
    [uid].tsx
```

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="chats" options={{ title: "Chats" }} />
      <Tabs.Screen name="users" options={{ title: "Users" }} />
      <Tabs.Screen name="groups" options={{ title: "Groups" }} />
      <Tabs.Screen name="calls" options={{ title: "Calls" }} />
    </Tabs>
  );
}
```

Each tab file renders a single list component (`CometChatConversations`, `CometChatUsers`, etc. — see `cometchat-native-placement` § 2 Bottom tab for the component choices) and pushes to `/messages/[uid]` on press.

### Expo Router gotchas

- **`unstable_settings`** in `_layout.tsx` can break deep linking if set incorrectly. Leave it alone unless you know you need it.
- **Navigation between stack + tabs**: `router.push("/messages/abc")` works from a tab. `router.back()` returns to the tab. No extra configuration needed.
- **Search params**: use `useLocalSearchParams()` (not `useSearchParams()` — that's web-only).

---

## Step 6 — Prebuild + run

Before the first run, Expo needs to generate native projects:

```bash
npx expo prebuild
```

Then run on the platform:

```bash
# iOS (requires Xcode)
npx expo run:ios

# Android (requires Android Studio)
npx expo run:android

# Or EAS for cloud builds
eas build --profile development --platform ios
```

Subsequent runs use `npx expo start` with the dev client — no rebuild needed unless native deps change.

**When to rebuild vs. reload:**
- Changed JS / JSX / TSX → no rebuild, just `r` to reload or save in Fast Refresh
- Added / removed a native dependency → `npx expo prebuild --clean && npx expo run:ios`
- Changed `app.json` permissions or plugins → `npx expo prebuild --clean`

---

## Step 7 — Verify integration

```bash
npx tsc --noEmit    # TypeScript check
```

Then in the running app:

1. Open the chat screen you wired
2. Check that the keyboard opens when you tap the composer (gesture handler working)
3. Tap the "+" attachment button — the action sheet should slide up (bottom sheet working)
4. Send a message — it should appear immediately

If any of these don't work, see `cometchat-native-troubleshooting`.

---

## Hard rules

1. **No Expo Go.** The user's project must use development builds. Detect early and tell the user if they're on Expo Go.
2. **`import "react-native-gesture-handler"` is the first line of the entry file** (`App.tsx` or `app/_layout.tsx` for Expo Router). Not second. Not after any React import.
3. **Install all peer deps via `npx expo install`**, not `npm install`, for native modules. Expo's resolver picks SDK-compatible versions.
4. **Never commit `REST_API_KEY`** (or any server-side secret) to `app.json extra` — it ends up in the client bundle. Use a server endpoint (see `cometchat-native-production`).
5. **Merge permissions into `app.json`, don't replace.** The user may already have permissions for other libraries; wipe them out and their other features break.
6. **`npx expo prebuild --clean` after changing `app.json` permissions or adding native deps.** Without it, iOS + Android see the old config.
7. **Every `<CometChatMessageList>` must include `hideReplyInThreadOption`** unless you're also wiring a full thread panel (see `cometchat-native-placement` § Hard rule 5).
8. **The four-wrapper chain goes at the app root**, not per-screen (see `cometchat-native-core` § 3). For Expo Router, that's `app/_layout.tsx`. For plain Expo, that's `App.tsx`.

---

## Common questions

**Q: Can I use `npx create-expo-app --template tabs`?**
Yes — the tabs template already has Expo Router set up. Just add the provider chain in `app/_layout.tsx` per § 5a and replace a tab's content with a CometChat component.

**Q: Can I use SDK ≤49?**
Expo SDK 49 may work but the CometChat peer deps target 50+ conventions. If the user is stuck on an older SDK, ask them to upgrade — or fall back to bare RN via `npx expo prebuild` + `cometchat-native-bare-patterns`.

**Q: I'm seeing "Main module field cannot be resolved" when opening Expo Go.**
That's the "Expo Go doesn't support native modules" error. Build a dev client: `eas build --profile development` or `npx expo run:ios`.

**Q: My app crashes on first push-notification receive.**
Push notifications need additional setup (APNs + FCM + maybe `expo-notifications`). Out of scope for this skill — see `cometchat-native-troubleshooting` § Push notifications.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Init / login / wrapper chain / anti-patterns |
| `cometchat-native-components` | Component prop reference |
| `cometchat-native-placement` | Where chat goes (stack / tabs / modal / bottom sheet / embedded) |
| `cometchat-native-expo-patterns` | This skill — Expo managed workflow specifics |
| `cometchat-native-bare-patterns` | Bare RN (pod install, native modules, privacy manifest) |
| `cometchat-native-features` | Calls, extensions, AI |
| `cometchat-native-theming` | Theme customization |
| `cometchat-native-customization` | Text formatters, events, custom views |
| `cometchat-native-production` | Server-side auth tokens + user management |
| `cometchat-native-troubleshooting` | Prebuild failures, Expo Go errors, keyboard issues, blank chat |
