# Group calls — broadcast meeting pattern (Android V5)

Group calls in CometChat use a **different signaling channel than 1:1 user calls**. The Ringing flow (`CometChat.initiateCall` → `onIncomingCallReceived` on peer) is **1:1 user only**. For groups, the kit broadcasts a **custom message of type `"meeting"`** to the group; receivers see a "Join meeting" card in `CometChatMessageList` (kit) or need an explicit `MessageListener.onCustomMessageReceived` (custom UI).

By-design kit behavior. Same semantic across all CometChat kits — confirmed against the React Native kit source 2026-05-15.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/group-calls

---

## Architecture

```
Caller (uidA, member of groupX)        CometChat                Receivers (members of groupX)
  │                                       │                              │
  │ CometChatCallButtons sends a          │                              │
  │ CustomMessage(GUID, GROUP, "meeting", │                              │
  │   { callType, sessionId })            │                              │
  ├──────────────────────────────────────>│                              │
  │                                       │ onCustomMessageReceived      │
  │                                       ├─────────────────────────────>│
  │                                       │                              │
  │ caller mounts CometChatOngoingCallActivity                            │
  │ with sessionID = groupGuid            │  receiver taps Join          │
  │                                       │  → joinSession(GUID)         │
  ├──────────────────────────────────────>│ <─────────────────────────── │
  │            ───── WebRTC session active (sessionId = group GUID) ─────│
```

| Channel | 1:1 user calls | Group calls |
|---|---|---|
| Signaling | `CometChat.initiateCall(call, callback)` | `CometChat.sendCustomMessage(message, callback)` (type="meeting") |
| Receiver event | `CallListener.onIncomingCallReceived` | `MessageListener.onCustomMessageReceived` |
| Session ID | server-generated unique | group's GUID (persistent) |
| Ring/decline | yes — `acceptCall` / `rejectCall` | no — receivers join or ignore |
| Auto-cancel timeout | yes (45s default) | no — meeting persists in chat history |

---

## Hard rules

1. **Group calls broadcast a custom message; they do NOT use the call listener.** Custom UI with only `CometChat.addCallListener` receives NOTHING for group meetings.
2. **Session ID = group GUID.** Persistent, not auto-cancelled.
3. **Joining = `CometChatCalls.joinSession(sessionId, sessionSettings, container, CallbackListener)`** — single-call shape (token generation internal). `startSession` is a deprecated v4 shim; use `joinSession`.
4. **No `CometChat.endCall(sessionId)` for groups** — meeting messages have no call entity. Local `CallSession.getInstance().leaveSession()` only.
5. **ConnectionService / VoIP push for group meetings is NOT built-in.** The CometChat dashboard's push provider routes meeting messages as regular FCM notifications, not as `ACTION_CALL`. Customers wanting ConnectionService-ring for group meetings must intercept the FCM data payload, construct a `Connection` manually, and route into telecom.

---

## Caller side — kit-based

```kotlin
// Inside a chat surface, e.g. inside CometChatMessageHeader:
val callButtons = CometChatCallButtons(this)
callButtons.setGroup(group)
// Tapping voice/video automatically:
// - sends CustomMessage(GUID, GROUP, "meeting", { callType, sessionId })
// - opens CometChatOngoingCallActivity with sessionID = group.guid
```

No additional code on the caller side. The kit signs the user up for the WebRTC session immediately.

## Caller side — custom UI

```kotlin
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.models.CustomMessage
import com.cometchat.chat.constants.CometChatConstants
import org.json.JSONObject

fun startGroupCall(groupGuid: String, callType: String /* "audio" | "video" */) {
    val sessionId = groupGuid
    val customData = JSONObject().apply {
        put("callType", callType)
        put("sessionId", sessionId)
    }

    val meetingMessage = CustomMessage(
        groupGuid,
        CometChatConstants.RECEIVER_TYPE_GROUP,
        "meeting",
        customData,
    ).apply {
        category = CometChatConstants.CATEGORY_CUSTOM
        metadata = JSONObject().apply {
            put("incrementUnreadCount", true)
            put("pushNotification", "meeting")
            put("callType", callType)
            put("sessionId", sessionId)
        }
    }

    CometChat.sendCustomMessage(meetingMessage, object : CometChat.CallbackListener<CustomMessage>() {
        override fun onSuccess(p0: CustomMessage) {
            // Caller navigates to OngoingCallActivity with sessionId
            CometChatOngoingCallActivity.launch(this@CallerActivity, sessionId, callType)
        }
        override fun onError(p0: CometChatException) { /* surface error */ }
    })
}
```

---

## Receiver side — kit-based (auto-renders meeting card)

If your group's chat surface uses `CometChatMessageList`, the kit renders the meeting `CustomMessage` as a "Join meeting" card. Tap → kit calls `getRTCToken` + opens `CometChatOngoingCallActivity` with `sessionID = group.guid`.

```kotlin
val messageList = CometChatMessageList(this)
messageList.setGroup(group)
// Meeting cards render automatically.
```

## Receiver side — custom UI (Kotlin Views / Compose — needs MessageListener)

```kotlin
private val GROUP_MEETING_LISTENER_ID = "APP_ROOT_GROUP_MEETING_LISTENER"

CometChat.addMessageListener(GROUP_MEETING_LISTENER_ID, object : CometChat.MessageListener() {
    override fun onCustomMessageReceived(msg: CustomMessage) {
        if (msg.category != CometChatConstants.CATEGORY_CUSTOM) return
        if (msg.type != "meeting") return

        val customData = msg.customData ?: return
        val sessionId = customData.optString("sessionId", msg.receiverUid)
        val callType = customData.optString("callType", "video")
        val fromUid = msg.sender.uid
        val groupGuid = msg.receiverUid

        // Switch to main thread for UI work
        runOnUiThread {
            // Show your custom incoming-meeting UI:
            // - notification with "Join" action
            // - or in-app banner / full-screen activity
        }
    }
})

// Tear down in onDestroy:
override fun onDestroy() {
    super.onDestroy()
    CometChat.removeMessageListener(GROUP_MEETING_LISTENER_ID)
}
```

Register in your `Application` class or main `Activity` AFTER login — same lifecycle constraint as the 1:1 `CallListener`.

---

## Edge cases

### Late joining

Meeting messages persist in chat history. Tapping the card joins the live session — works even hours later, until everyone has left.

### Cancelling / leaving

Each participant leaves independently. No "cancel meeting" — the message stays in history.

```kotlin
CallSession.getInstance().leaveSession()
// NO CometChat.endCall — meetings have no call entity
```

### Push notifications

The meeting `CustomMessage` carries `metadata.pushNotification = "meeting"`. CometChat's push system delivers it as a regular FCM notification. To get ConnectionService-ringing for meetings, intercept the FCM data payload in `FirebaseMessagingService.onMessageReceived` and route to `TelecomManager` manually. Not auto-wired.

### Mixed cohorts

If one side uses the kit (auto-renders meeting card in `CometChatMessageList`) and the other uses custom Activity-based UI (no message listener), the custom side receives nothing. Both sides must align on listener strategy.

---

## Anti-patterns

1. **Only `CometChat.addCallListener` registered, expecting group calls to ring.** Won't fire. Add a `MessageListener` too.
2. **`CometChat.endCall(sessionId)` after a group hangup.** No call entity exists — API errors. Use `CallSession.getInstance().leaveSession()` locally only.
3. **`<CometChatIncomingCall>` overlay activity expected for group meetings.** It only listens to 1:1 channel.
4. **Treating sessionId as ephemeral.** It IS the group's GUID. Persistent.
5. **Sending `CustomMessage` without `metadata.pushNotification = "meeting"`.** Offline group members won't get any push.
6. **Registering the `MessageListener` before login.** The SDK silently drops listeners registered pre-login. Wire AFTER login, as part of `CometChat.login`'s callback or `addCallListener` lifecycle.

---

## Verification checklist

- [ ] If using kit caller: `CometChatCallButtons.setGroup(group)` + voice/video tap initiates the meeting message
- [ ] If using custom caller: `CometChat.sendCustomMessage` called with `type="meeting"`, `category=CATEGORY_CUSTOM`, `customData={callType, sessionId: groupGuid}`, `metadata.pushNotification="meeting"`
- [ ] If using kit receiver: `CometChatMessageList` renders the meeting card with a "Join" CTA
- [ ] If using custom receiver UI: `CometChat.addMessageListener` registered + filters `category==CATEGORY_CUSTOM && type=="meeting"`
- [ ] Listener registered AFTER login, NOT before
- [ ] On hangup: `CallSession.getInstance().leaveSession()` (NOT `CometChat.endCall`)
- [ ] Late-joining works
- [ ] FCM data payload routed to ConnectionService manually if OS-ring for meetings is desired

---

## Pointers

- `ringing-integration.md` — 1:1 user calls (different signaling channel)
- `cometchat-android-v5-calls/SKILL.md` rules — V5 hard rules (calls-sdk-android peer dep, etc.)
- Canonical docs: https://www.cometchat.com/docs/calls/android/group-calls
- Reference impl (cross-platform semantic): `cometchat-react-calls/references/group-calls.md`
