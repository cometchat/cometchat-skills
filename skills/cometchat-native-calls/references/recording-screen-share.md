# Recording + screen-share on React Native

Both features live in the Calls SDK; both have RN-specific gotchas the kit's defaults don't handle. Sister of `cometchat-react-calls/references/recording-screen-share.md` — same SDK semantics, different platform plumbing for screen capture.

---

## Recording

### Server-side: dashboard gate

Recording is a paid feature on most CometChat plans. Enable in **Dashboard → Chat & Messaging → Calls → Recording**. The client-side flag below is a no-op without it.

### Client-side: opt-in per session

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

const settings = new CometChatCalls.CallSettingsBuilder()
  .setSessionID(sessionId)
  .setIsAudioOnly(false)
  .enableRecording(true)              // server starts recording when session begins
  .setShowRecordingButton(true)       // user can toggle mid-call (with kit's default UI)
  .build();
```

### Recording lifecycle events

```ts
const listener = new CometChatCalls.OngoingCallListener({
  onRecordingStarted: () => {
    // Update UI — show a "REC" indicator (compliance requirement in some jurisdictions)
    setRecording(true);
  },
  onRecordingStopped: () => {
    setRecording(false);
  },
  onRecordingFailed: (error) => {
    // Surface to UI — usually plan limits or storage quota
    Alert.alert("Recording failed", error.message);
  },
});
```

### REC indicator (compliance)

In some regions, you must visually notify all participants when recording is active. The kit's default `CometChatOngoingCall` shows a small "Recording" badge. Custom UI must render this:

```tsx
{recording && (
  <View style={styles.recBadge}>
    <Text style={styles.recDot}>●</Text>
    <Text style={styles.recLabel}>REC</Text>
  </View>
)}
```

Don't omit this — the legal exposure is real (CCPA, GDPR, two-party-consent US states).

### Where the recordings go

CometChat hosts the file. It appears in **Dashboard → Calls → Recordings** with a download link. There is no client-side download API — the file isn't exposed to the device for security/compliance reasons.

For programmatic access:

```ts
// Server-side — your backend with the dashboard bearer token
const res = await fetch(
  `https://${region}.api-management.cometchat.io/v3/apps/${appId}/recordings`,
  { headers: { Authorization: `Bearer ${dashboardToken}` } },
);
const recordings = await res.json();
```

The skill points users at this REST endpoint; it doesn't generate client code (recordings shouldn't be downloadable from the device).

---

## Screen sharing

Screen capture on RN is platform-specific. iOS uses an iOS Broadcast Extension (separate target); Android uses MediaProjection. Both are exposed by `react-native-webrtc` ≥ 119, which is a peer of the Calls SDK.

### Presenter — start sharing

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

async function startScreenShare() {
  try {
    await CometChatCalls.startScreenShare();
  } catch (err) {
    if ((err as Error).message.includes("permission")) {
      Alert.alert("Screen recording permission denied");
      return;
    }
    Alert.alert("Couldn't start screen share");
  }
}

async function endScreenShare() {
  await CometChatCalls.endScreenShare();
}
```

### iOS — Broadcast Extension target setup

iOS screen capture requires a separate target in Xcode (a "Broadcast Upload Extension"). The skill walks the user through this manual setup:

1. Xcode → File → New → Target → **Broadcast Upload Extension**
2. Name: `YourAppBroadcastExtension`
3. Bundle ID: `com.yourapp.YourAppBroadcastExtension`
4. Group: `group.com.yourapp.broadcast` (App Group — both targets must opt into this)
5. Add the App Group capability to BOTH the main target AND the extension
6. Replace the extension's `SampleHandler.swift` with the WebRTC bridge stub `react-native-webrtc` provides
7. Add `RPSystemBroadcastPickerView` to your call screen so the user can start/stop sharing via the system UI

The Broadcast Extension picker UI:

```tsx
// CallScreen.tsx
import { Platform, requireNativeComponent } from "react-native";

const BroadcastPickerView = Platform.OS === "ios"
  ? requireNativeComponent<{ preferredExtension: string }>("RPSystemBroadcastPickerView")
  : null;

export function CallScreen() {
  return (
    <View>
      {/* ... call UI ... */}
      {Platform.OS === "ios" && BroadcastPickerView && (
        <BroadcastPickerView preferredExtension="com.yourapp.YourAppBroadcastExtension" />
      )}
    </View>
  );
}
```

The picker renders as a small system-styled button. iOS doesn't allow custom UI for screen-share initiation — must use this picker.

### Android — MediaProjection setup

Android is simpler. Add the permission to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />   <!-- Android 14+ -->
```

The screen-share service needs `foregroundServiceType="mediaProjection"`:

```xml
<service
  android:name="com.cometchat.calls.ScreenShareService"
  android:foregroundServiceType="mediaProjection"
  android:exported="false" />
```

`react-native-webrtc` registers this internally; verify it's in the merged manifest.

The MediaProjection consent prompt is system-rendered — when `startScreenShare()` is called, Android shows "Start recording or casting with YourApp?". User accepts → screen share begins.

### Viewer — receive screen share

```ts
const listener = new CometChatCalls.OngoingCallListener({
  onScreenShareStarted: (presenterUid: string) => {
    // The kit's default UI auto-renders the screen-share tile.
    // Custom UI: query the SDK for the screen-share track and pipe into <RTCView />
    setScreenSharePresenter(presenterUid);
  },
  onScreenShareEnded: () => {
    setScreenSharePresenter(null);
  },
});
```

Custom-UI viewer composition:

```tsx
function CustomCallView() {
  const [screenSharePresenter, setScreenSharePresenter] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  return (
    <View style={styles.container}>
      {screenSharePresenter ? (
        <ScreenShareView presenterUid={screenSharePresenter} />
      ) : (
        <ParticipantTilesGrid participants={participants} />
      )}
    </View>
  );
}
```

When someone shares their screen, switch the layout to "screen share + participant strip"; switch back when they stop.

---

## Combining recording + screen-share

Server-side recording captures whatever video composition the SFU is forwarding. When a participant is screen-sharing, the recording shows their screen. When they stop, it switches back to the camera composition.

You don't compose this client-side — the server handles it. Custom UI just needs to render the screen-share track when present.

---

## iOS App Group setup (Broadcast Extension data passing)

The iOS Broadcast Extension runs in a separate process from your main app. To share state (the call's session ID, auth context, etc.):

```
Both targets in Xcode:
  Signing & Capabilities → + Capability → App Groups
  Add: group.com.yourapp.broadcast
```

In the main app, write to the shared group container:

```swift
// AppDelegate or CometChat init code (RN bridges this)
let userDefaults = UserDefaults(suiteName: "group.com.yourapp.broadcast")
userDefaults?.set(currentSessionID, forKey: "cometchat.sessionID")
userDefaults?.set(currentAuthToken, forKey: "cometchat.authToken")
```

In the Broadcast Extension (`SampleHandler.swift`):

```swift
override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
  let userDefaults = UserDefaults(suiteName: "group.com.yourapp.broadcast")
  guard let sessionID = userDefaults?.string(forKey: "cometchat.sessionID"),
        let authToken = userDefaults?.string(forKey: "cometchat.authToken") else {
    finishBroadcastWithError(NSError(domain: "CometChat", code: 1, userInfo: nil))
    return
  }
  // Initialize the WebRTC bridge with these credentials
  // (react-native-webrtc handles the heavy lifting)
}
```

Without the App Group, the extension can't see the main app's CometChat state — screen capture starts but can't deliver to the call session.

---

## Anti-patterns

1. **iOS without Broadcast Extension** target. Compiles and runs, but `startScreenShare()` returns a "no broadcast extension found" error. Manual Xcode step is required.
2. **Mismatched App Group identifiers** between targets. Extension can't read the session ID; screen share fails silently.
3. **Android without `FOREGROUND_SERVICE_MEDIA_PROJECTION` permission** on Android 14+. Service starts → silent crash → screen share dies.
4. **No "REC" indicator in custom UI.** Compliance violation in two-party-consent jurisdictions.
5. **Trying to download recordings from the device.** They live on CometChat's servers. Use the dashboard or REST API.
6. **`enableRecording(true)` without dashboard gate.** Client flag silently no-ops; user thinks recording is active when it isn't.
7. **Not handling `onScreenShareEnded` in custom UI.** Layout doesn't switch back; viewer sees the last screen-share frame frozen.

---

## Verification checklist

**Recording:**
- [ ] Dashboard gate enabled (Recording feature on the plan)
- [ ] `enableRecording(true)` on `CallSettingsBuilder`
- [ ] `onRecordingStarted` / `onRecordingStopped` listeners wired
- [ ] "REC" indicator visible to all participants when active
- [ ] `onRecordingFailed` surfaces to UI

**Screen share:**
- [ ] iOS: Broadcast Extension target created in Xcode
- [ ] iOS: App Group capability on BOTH main + extension targets, matching identifiers
- [ ] iOS: `RPSystemBroadcastPickerView` rendered in call screen
- [ ] Android: `FOREGROUND_SERVICE_MEDIA_PROJECTION` permission in manifest
- [ ] Android: ScreenShareService registered with `foregroundServiceType="mediaProjection"`
- [ ] Custom UI: layout switches to screen-share view on `onScreenShareStarted`
- [ ] Custom UI: layout switches back on `onScreenShareEnded`

**Real-device smoke:**
- [ ] iOS: tap broadcast picker → consent → screen share visible to other participants
- [ ] Android: tap "Share screen" → MediaProjection prompt → screen share begins
- [ ] Both: end screen share returns to camera view smoothly
- [ ] Both: recording starts, "REC" shows, recording appears in dashboard within ~30 seconds

---

## Pointers

- `references/custom-ui.md` — building custom call surfaces with screen-share viewer
- `references/group-calls.md` — group calls + screen share interplay (one share at a time)
- `references/voip-push-end-to-end.md` — push payloads
- `cometchat-native-calls` SKILL.md — base hard rules
- `cometchat-react-calls/references/recording-screen-share.md` — sister web reference (same SDK semantics)
