---
name: cometchat-native-features
description: "Feature catalog for React Native — calls (separate SDK + WebRTC), extensions (polls / stickers / translation / link preview / collaborative doc / whiteboard / smart replies), AI agent, in-call chat. When to toggle, install, or swap."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native features calls extensions ai"
---

## Purpose

Teaches Claude how to add features on top of a working CometChat React Native integration. Classifies each feature into one of four types and gives the correct recipe for each.

**Read `cometchat-native-core` + `cometchat-native-components` + (`cometchat-native-expo-patterns` or `cometchat-native-bare-patterns`) first** — a base integration must already exist before features layer on.

Ground truth: `docs/ui-kit/react-native/core-features.mdx`, `calling-integration.mdx`, `call-*.mdx`, `incoming-call.mdx`, `outgoing-call.mdx`, `extensions.mdx`, `guide-ai-agent.mdx`, `ai-assistant-chat-history.mdx`, and `@cometchat/chat-uikit-react-native@5.3.3` exports.

---

## 1. Feature taxonomy

Every CometChat feature falls into exactly one of four categories. The category determines the recipe:

| Category | What it means | Example features | How to enable |
|---|---|---|---|
| **Default** | Already on — no action needed. Shipped with the kit's base components. | Instant messaging, typing indicators, read receipts, reactions on messages, replies, @mentions, media upload, edit/delete, message info | Just render `CometChatMessageHeader` + `CometChatMessageList` + `CometChatMessageComposer` |
| **Extension** | Pure boolean backend toggle. CLI flips it via the dashboard API; UI Kit auto-wires the feature once enabled. | Polls, stickers, message translation, link previews, collaborative whiteboard, collaborative document, thumbnail generation | `cometchat apply-feature <id>` → hard-reload the app |
| **AI feature** | Backend AI toggle that requires an OpenAI API key on the app. CLI sets the key + flips the toggle in one call. | Smart replies, conversation summary, conversation starter | `cometchat apply-feature smart-replies --openai-key sk-…` |
| **Package-install** | Install an additional npm package + maybe native peer deps. The UI Kit auto-detects the package on next init. | Voice + video calls (`@cometchat/calls-sdk-react-native`) | `npm install ...` → pod install (iOS) → rebuild |
| **Component-swap** | Replace or wrap a UI Kit component with a customized version. | Custom text formatter (emoji shortcuts, custom tags), custom message templates, AI Agent chat history | Write a new component + pass via prop |

Reminder — don't confuse these with **customization** (per-skill-coverage under `cometchat-native-customization`). This skill is "add a feature that CometChat ships"; customization is "change how an existing feature looks or behaves".

---

## 2. Enabling extension and AI features (`apply-feature`)

Most extensions (polls, stickers, translation, link preview, collaborative doc/whiteboard, thumbnails) are pure boolean toggles. Use the CLI:

### Extension features

```bash
cometchat apply-feature polls --json
cometchat apply-feature link-preview --json
```

The CLI reads the app ID from `.cometchat/state.json` (RN goes through `cometchat apply`), or pass `--app-id` explicitly. Bearer is from the OS keychain (`cometchat auth login` once per machine).

### AI features (smart replies, conversation summary, conversation starter)

These need an OpenAI API key. The CLI sets the key + flips the toggle in one call:

```bash
cometchat apply-feature smart-replies --openai-key sk-...
```

Once any AI feature is enabled the key is stored on the app, so subsequent ai-feature applies don't need `--openai-key` repeated.

Get an OpenAI key at https://platform.openai.com/api-keys.

### Response shapes (`--json`)

- `"status": "applied"` → done. Hard-reload (stop Metro + restart + rebuild if on iOS).
- `"status": "already-applied"` → already in the desired state.
- `"status": "auth-required"` → `cometchat auth login` first.
- `"status": "openai-key-required"` → re-run with `--openai-key sk-…`.
- `"status": "manual-action-required"` → dashboard-only feature (Giphy, Stipop, Tenor, Chatwoot, Intercom, message-shortcuts, disappearing-messages). Surface the `next_steps` verbatim — these need third-party config the user has to provide manually.
- `"status": "error"` → surface `next_steps` — includes the dashboard URL as a fallback.

### Dashboard fallback

Only when the CLI returns `error` or isn't available:
1. https://app.cometchat.com → your app
2. Chat & Messaging → Features
3. Find the extension by name → flip Status ON
4. Hard-reload the RN app

### What each toggle does

| Extension | UI surface when enabled |
|---|---|
| Polls | Polls option in `CometChatMessageComposer`'s attachment Action Sheet |
| Stickers | Sticker picker in the composer |
| Smart replies | Chip suggestions above the composer input after an incoming message |
| Message translation | "Translate" option in the message long-press menu |
| Link preview | Rich-card bubble for URLs in the message list |
| Collaborative document | Option in composer's Action Sheet; opens a shared doc on tap |
| Collaborative whiteboard | Option in composer's Action Sheet; opens a shared canvas |
| Thumbnail generation | Image / video bubbles show thumbnails instead of full-size downloads |

### Gotcha — `auto_wired_in_uikit: false`

A minority of extensions need extra wiring via the `extensions` field on `CometChatUIKit.init()`. The CLI flags this in its success response:

```json
{
  "status": "enabled",
  "name": "stickers",
  "auto_wired_in_uikit": false,
  "next_steps": [
    "Pass the extension via the `extensions` field on CometChatUIKit.init({ ... })"
  ]
}
```

If `auto_wired_in_uikit` is `false`, import the matching `ExtensionsDataSource` from `@cometchat/chat-uikit-react-native` and pass it via the flat `extensions` field:

```tsx
import {
  CometChatUIKit,
  StickersExtension,
  PollsExtension,
} from "@cometchat/chat-uikit-react-native";

await CometChatUIKit.init({
  appId: APP_ID,
  region: REGION,
  authKey: AUTH_KEY,
  subscriptionType: "ALL_USERS",
  extensions: [new StickersExtension(), new PollsExtension()],   // ← new
});
```

Query the docs MCP for the exact extension class name if you don't remember it — `extensions.mdx` lists all of them.

---

## 3. Calls (package-install)

Calls are the biggest "add a feature" step. They require the separate `@cometchat/calls-sdk-react-native` package, additional peer native modules (WebRTC + netinfo + background-timer + callstats), and app-side listener setup.

### 3a — Install the calls SDK + peer deps

**Expo (managed workflow)**:

```bash
npm install @cometchat/calls-sdk-react-native
npx expo install \
  @react-native-community/netinfo \
  react-native-background-timer \
  react-native-callstats \
  react-native-webrtc
npx expo prebuild --clean
```

**Bare RN**:

```bash
npm install \
  @cometchat/calls-sdk-react-native \
  @react-native-community/netinfo \
  react-native-background-timer \
  react-native-callstats \
  react-native-webrtc
cd ios && pod install && cd ..
```

### 3b — Platform permissions (if not already from core integration)

**iOS** — `ios/<App>/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access for voice and video calls</string>
```

**Android** — `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 3c — iOS deployment target + build settings

Calls SDK requires iOS 12+ and specific Podfile flags. Add to `ios/Podfile`:

```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '12.0'
      config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64 i386'
      config.build_settings['ENABLE_BITCODE'] = 'NO'
    end
  end
end
```

Android (`android/app/build.gradle`):

```groovy
android {
    compileSdkVersion 33
    defaultConfig {
        minSdkVersion 24
        targetSdkVersion 33
    }
}
```

### 3d — Register the call listener at app root

The incoming-call UI only shows up if you've registered a listener to pick up call events. Add this once at the app root (typically in `App.tsx` or Expo Router's `_layout.tsx`):

```tsx
import React, { useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatIncomingCall } from "@cometchat/chat-uikit-react-native";

function CallEventsProvider({ children }: { children: React.ReactNode }) {
  const [callReceived, setCallReceived] = useState(false);
  const incomingCall = useRef<CometChat.Call | null>(null);
  const LISTENER_ID = "APP_CALL_LISTENER";

  useEffect(() => {
    CometChat.addCallListener(
      LISTENER_ID,
      new CometChat.CallListener({
        onIncomingCallReceived: (call) => {
          incomingCall.current = call;
          setCallReceived(true);
        },
        onOutgoingCallAccepted: (call) => {
          // navigate to the ongoing-call screen
        },
        onOutgoingCallRejected: () => {
          incomingCall.current = null;
          setCallReceived(false);
        },
        onIncomingCallCancelled: () => {
          incomingCall.current = null;
          setCallReceived(false);
        },
        onCallEndedMessageReceived: () => {
          incomingCall.current = null;
          setCallReceived(false);
        },
      })
    );
    return () => CometChat.removeCallListener(LISTENER_ID);
  }, []);

  return (
    <>
      {children}
      {callReceived && incomingCall.current && (
        <CometChatIncomingCall
          call={incomingCall.current}
          onAccept={() => { /* navigate to ongoing-call screen */ }}
          onDecline={() => setCallReceived(false)}
        />
      )}
    </>
  );
}
```

Wrap the app (inside the existing provider chain, below `CometChatProvider`):

```tsx
<CometChatProvider ...>
  <CallEventsProvider>
    <AppNavigator />
  </CallEventsProvider>
</CometChatProvider>
```

### 3e — Call buttons in the message header

Once the calls SDK is installed, `CometChatMessageHeader` auto-renders voice + video call buttons. To customize (e.g., hide one):

```tsx
<CometChatMessageHeader
  user={selectedUser}
  hideVoiceCallButton={false}
  hideVideoCallButton={false}
  AuxiliaryButtonView={(user, group) => (
    <CometChatCallButtons
      user={user}
      group={group}
      onVoiceCallPress={(session) => navigation.navigate("OngoingCall", { session })}
      onVideoCallPress={(session) => navigation.navigate("OngoingCall", { session })}
    />
  )}
/>
```

### 3f — Ongoing call screen

Navigate to a dedicated screen that hosts `CometChatOngoingCall` when a call connects:

```tsx
// OngoingCallScreen.tsx
import { CometChatOngoingCall } from "@cometchat/chat-uikit-react-native";

export function OngoingCallScreen({ route, navigation }: any) {
  const { session } = route.params;
  return (
    <CometChatOngoingCall
      sessionID={session.sessionId}
      callType={session.type}   // "audio" | "video"
      onCallEnded={() => navigation.goBack()}
    />
  );
}
```

### 3g — Call logs

A history view of past calls. Typically one tab in a tab-based layout (see `cometchat-native-placement` § 2):

```tsx
import { CometChatCallLogs } from "@cometchat/chat-uikit-react-native";

export function CallLogsScreen() {
  return <CometChatCallLogs onItemPress={(callLog) => openCallDetails(callLog)} />;
}
```

### 3h — Verifying calls work

1. Rebuild the app after adding the calls SDK (Expo: `expo run:ios` / `run:android`; bare: `npx react-native run-ios` / `run-android`)
2. Log in as one user on device A, another on device B
3. On device A, tap the voice or video call icon in the message header
4. Device B should show `CometChatIncomingCall` within a few seconds
5. Accept on B → both devices transition to `CometChatOngoingCall`

If incoming calls don't show: listener not registered, or the listener ID collides. See `cometchat-native-troubleshooting`.

### 3i — Testing calls in CI

Real WebRTC calls can't run in Jest or Maestro — they need two real
devices plus a TURN server. What you CAN test:

- **Call button renders** — mount `CometChatMessageHeader` with a user
  prop and assert the call `testID` is present (requires the calls SDK
  import to not crash; mock `@cometchat/calls-sdk-react-native` in
  your jest setup).
- **Call listener registration** — spy on `CometChat.addCallListener`
  from the SDK mock and assert your `registerCallListener()` fires
  exactly once per mount.
- **Incoming-call UI** — render `<CometChatIncomingCall call={mockCall} />`
  with a stubbed `CometChat.Call` object; assert accept/reject buttons
  are wired.

See `cometchat-native-testing § 5` for the SDK mock shape (includes a
`addCallListener` / `removeCallListener` stub) and § 10 for why actual
call E2E belongs in manual QA, not Detox/Maestro.

---

## 4. In-call chat (optional, during-call feature)

During an active call, users can chat without leaving the call UI. This is a toggle on the ongoing-call component:

```tsx
<CometChatOngoingCall
  sessionID={session.sessionId}
  callType={session.type}
  callSettingsBuilder={/* ... with enableInCallChat(true) */}
  onCallEnded={() => navigation.goBack()}
/>
```

In-call chat adds a collapsible chat panel to the call screen. Participants see messages for the duration of the call.

---

## 5. AI Agent (component-swap + dashboard)

The AI Agent integration adds an AI-powered conversational assistant to your app. Two parts:

### 5a — Dashboard setup

1. https://app.cometchat.com → your app → AI → Agents
2. Create a new agent (name, system prompt, model)
3. Assign a UID to the agent (e.g. `ai-support-agent`)

Once the agent exists in the dashboard, users can message it like any other user.

### 5b — Optional: AI Assistant Chat History UI

The UI Kit exports `CometChatAIAssistantChatHistory` for apps that want a dedicated AI-chat entry point (distinct from a regular chat with a human user). This component shows past AI conversations and a "New chat" trigger.

```tsx
import { CometChatAIAssistantChatHistory } from "@cometchat/chat-uikit-react-native";

export function AIChatScreen({ navigation }: any) {
  return (
    <CometChatAIAssistantChatHistory
      user={loggedInUser}
      onMessageClicked={(message) => navigation.navigate("AIChat", { message })}
      onNewChatButtonClick={() => navigation.navigate("AIChat", { new: true })}
    />
  );
}
```

The actual AI-chat screen is a regular `CometChatMessageHeader` + `MessageList` + `Composer` composition targeted at the AI agent's UID.

### 5c — AI features beyond the basic agent

See `ai-assistant-chat-history.mdx` and `guide-ai-agent.mdx` in the docs for:
- Multi-tool agents (tools registered via `setAIAssistantTools()`)
- Streaming responses (handled automatically via `CometChatAIAssistantMessageBubble`)
- Agent memory and persona

These are advanced topics — query the docs MCP for the current API if the user wants any of them.

### 5d — Smart replies (custom chip UI)

Smart replies is an `ai-feature`. Enable with one CLI call (the first time also sets the OpenAI key on the app):

```bash
cometchat apply-feature smart-replies --openai-key sk-...
```

After enabling, no code changes are required — `CometChatMessageComposer` automatically renders suggested replies as chips above the input.

For a custom UI — e.g. inline chips inside a custom bubble, only on certain conversation types, or styled to match your design system — read the extension data straight off the incoming message and render your own chips:

```tsx
import { TouchableOpacity, View, Text } from "react-native";
import { CometChat } from "@cometchat/chat-sdk-react-native";

interface SmartReply {
  reply_positive?: string;
  reply_neutral?: string;
  reply_negative?: string;
}

export function SmartReplyChips({
  message,
  onPick,
}: {
  message: CometChat.BaseMessage;
  onPick: (text: string) => void;
}) {
  const metadata = message.getMetadata() as Record<string, unknown> | undefined;
  const extensions = (metadata?.["@injected"] as Record<string, unknown>)?.["extensions"] as
    | Record<string, unknown>
    | undefined;
  const smartReply = extensions?.["smart-reply"] as SmartReply | undefined;
  if (!smartReply) return null;

  const replies = [
    smartReply.reply_positive,
    smartReply.reply_neutral,
    smartReply.reply_negative,
  ].filter(Boolean) as string[];

  return (
    <View style={{ flexDirection: "row", gap: 8, padding: 8 }}>
      {replies.map((r) => (
        <TouchableOpacity
          key={r}
          onPress={() => onPick(r)}
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#EAEAEA" }}
        >
          <Text>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

Smart replies are **server-generated** — the AI runs on CometChat's backend and attaches results to messages via the `@injected.extensions.smart-reply` metadata path. Your code just reads it.

**Common gotchas:**
- Replies only appear on incoming messages (the recipient's view), not outgoing. The dashboard generates them when the message lands.
- The metadata path is nested under `@injected.extensions.smart-reply` — not at the top level. Wrong path = `undefined`.
- If the user disables smart replies in the dashboard later, your custom UI silently shows nothing (the metadata key is just absent). Add a fallback if "no chip" feels broken.

---

## 6. Core features (no new code, no new install)

The following are shipped by default in every CometChat integration — they work from day 1 without any feature-enabling step. Mention them to users who ask "what do I get out of the box?":

- **Instant messaging** (text, with real-time delivery)
- **Media sharing** (images, video, audio, files)
- **Read receipts** (single tick = sent, double tick = delivered, blue = read)
- **Typing indicators**
- **@mentions** (requires `CometChatMentionsFormatter` in `textFormatters`, already in default config)
- **Reactions** (long-press any message to add emoji reaction)
- **Replies** (swipe or long-press → Reply)
- **Edit / delete** own messages
- **Message info** — sender sees delivery + read timestamps per-recipient
- **Mark as unread**
- **Voice messages** (record + send from composer)
- **Search** (`CometChatSearch` component — scoped or global)
- **Group management** (create, add members, leave, mute, transfer ownership)

If a user reports "X isn't working" for a core feature, it's likely a props issue (e.g., `hideReceipts={true}` accidentally set) or a dashboard setting, not a missing feature.

### 6a — Presence (online / offline) in custom UI

Presence indicators appear automatically on avatars in `CometChatConversations`, `CometChatUsers`, and `CometChatGroupMembers` — no setup. For custom UI that needs a specific user's status — e.g. a "Sold by Aria Chen · online now" label on a product screen — subscribe with the SDK directly:

```tsx
import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-react-native";

export function useUserPresence(uid: string): "online" | "offline" | "unknown" {
  const [status, setStatus] = useState<"online" | "offline" | "unknown">("unknown");

  useEffect(() => {
    let cancelled = false;

    // 1. Initial fetch
    CometChat.getUser(uid).then((u) => {
      if (cancelled) return;
      setStatus(u.getStatus() === "online" ? "online" : "offline");
    });

    // 2. Live updates
    const listenerId = `presence-${uid}`;
    CometChat.addUserListener(
      listenerId,
      new CometChat.UserListener({
        onUserOnline: (user: CometChat.User) => {
          if (user.getUid() === uid) setStatus("online");
        },
        onUserOffline: (user: CometChat.User) => {
          if (user.getUid() === uid) setStatus("offline");
        },
      }),
    );

    return () => {
      cancelled = true;
      CometChat.removeUserListener(listenerId);
    };
  }, [uid]);

  return status;
}
```

Use it: `const status = useUserPresence(product.sellerUid);`

**Common gotchas:**
- Presence events only fire for users the current user has interacted with (existing conversation, shared group, etc.). For arbitrary UIDs with no prior interaction, you may need to poll `CometChat.getUser(uid)` instead.
- `getStatus()` returns `"online"` or `"offline"` only. For a "last seen 5 min ago" label use `getLastActiveAt()` (UNIX timestamp).
- "Last seen" timestamps are **disabled by default on free-tier apps**. Enable in dashboard → Settings → Chat → Last Seen.
- Don't forget the cleanup — `removeUserListener` on unmount, or you'll leak listeners across screen re-renders.

---

## 7. Finding a feature's category quickly

When a user asks for a feature, use this flow:

1. **Is it in the core-features list (§ 6)?** → Already works. Confirm no `hide*` prop is turning it off.
2. **Is it voice / video / call history?** → Calls (§ 3). Package install.
3. **Is it polls, stickers, message translation, link preview, collaborative doc / whiteboard, thumbnails?** → Extension (§ 2). Run `cometchat apply-feature <id>`.
3a. **Is it smart replies, conversation summary, or conversation starter?** → AI feature (§ 2). Run `cometchat apply-feature <id> --openai-key sk-...`.
3b. **Is it Giphy / Stipop / Tenor / Chatwoot / Intercom / Disappearing Messages / Message Shortcuts?** → Dashboard-only (§ 2). User must enter third-party config in https://app.cometchat.com → Extensions.
4. **Is it AI agent?** → § 5.
5. **Is it custom text formatting, custom message templates, custom slot views, custom theme?** → This is **customization**, not a feature. Route to `cometchat-native-customization` or `cometchat-native-theming`.
6. **Not on this list?** → Check `docs/ui-kit/react-native/guide-overview.mdx` + the kit's `src/index.ts` exports. If still nothing, tell the user the feature isn't in the UI Kit; they may need to build it with the SDK directly.

---

## 8. Anti-patterns

1. **Do NOT speculatively install the calls SDK.** WebRTC bloats the app binary by several MB. Install only after the user says they want calls.

2. **Do NOT enable extensions your app doesn't use.** Each enabled extension adds data-fetching overhead and surface area for UI glitches. Turn on what the user asks for.

3. **Do NOT modify UI Kit source to add a feature.** If the feature isn't in the default + extension + calls list, build on top (custom template, custom slot view) — don't fork the kit.

4. **Do NOT wire the call listener per-screen.** It should be once, at the app root. Per-screen registration causes missed incoming calls when the user isn't on the registering screen.

5. **Do NOT skip the `cometchat features enable` step if the CLI is available.** Telling the user to visit the dashboard when the CLI could have flipped the toggle for them is worse UX.

6. **Do NOT forget `pod install` + rebuild after installing calls SDK.** The WebRTC native module won't load otherwise.

7. **Do NOT reference AI tools, streaming, or agent memory from memory.** These APIs change across UIKit minor versions. Query the docs MCP before generating code.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Init / login / provider chain |
| `cometchat-native-components` | Component prop reference (for `CometChatCallButtons`, `CometChatOngoingCall`, etc.) |
| `cometchat-native-placement` | Where the ongoing-call screen, call-logs tab, AI chat screen go |
| `cometchat-native-expo-patterns` | Expo-specific calls SDK setup (`expo prebuild`) |
| `cometchat-native-bare-patterns` | Bare RN calls SDK setup (Podfile flags, deployment target) |
| `cometchat-native-features` | This skill — which features exist + how to enable each |
| `cometchat-native-theming` | Theming call buttons, reaction colors, extension UI colors |
| `cometchat-native-customization` | Custom text formatters, custom message templates, event bus |
| `cometchat-native-push` | Push for calls uses a separate VoIP channel (`APNS_REACT_NATIVE_VOIP`) — see push § 7 |
| `cometchat-native-testing` | Mocking the calls SDK + incoming-call UI tests — see § 3i |
| `cometchat-native-production` | Production auth tokens (no feature concern, but the prerequisite for AI agent in prod) |
| `cometchat-native-troubleshooting` | Incoming call not ringing, extension not showing after enabling, call permissions denied |
