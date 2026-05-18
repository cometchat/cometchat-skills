# Group calls — broadcast meeting pattern (Android V6)

Group calls use a **different signaling channel than 1:1 user calls**. The Ringing flow (`CometChat.initiateCall` → `onIncomingCallReceived` on peer) is **1:1 user only**. For groups, the kit broadcasts a **custom message of type `"meeting"`** to the group; receivers see a "Join meeting" card in `CometChatMessageList` (kit) or need an explicit `MessageListener.onCustomMessageReceived` (custom UI).

By-design kit behavior — same semantic across all CometChat kits.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/group-calls

V6 specifics: this applies equally to Compose and Kotlin Views surfaces. Calls bundling into V6's chatuikit module doesn't change the signaling — the kit's `CometChatCallButtons` composable (or Views equivalent) sends the same meeting `CustomMessage` as V5.

---

## Architecture

```
Caller (uidA, member of groupX)        CometChat                Receivers (members of groupX)
  │                                       │                              │
  │ CometChatCallButtons sends            │                              │
  │ CustomMessage(GUID, GROUP, "meeting", │                              │
  │   { callType, sessionId })            │                              │
  ├──────────────────────────────────────>│                              │
  │                                       │ onCustomMessageReceived      │
  │                                       ├─────────────────────────────>│
  │  caller jumps to OngoingCall surface  │  receiver taps Join          │
  │     sessionId = groupGuid             │  → joinSession(GUID)         │
  ├──────────────────────────────────────>│ <─────────────────────────── │
  │            ───── WebRTC session active (sessionId = group GUID) ─────│
```

| Channel | 1:1 user calls | Group calls |
|---|---|---|
| Signaling | `CometChat.initiateCall(call, callback)` | `CometChat.sendCustomMessage(message, callback)` (type="meeting") |
| Receiver event | `CallListener.onIncomingCallReceived` | `MessageListener.onCustomMessageReceived` |
| Session ID | server-generated unique | group's GUID (persistent) |
| Ring/decline | yes — `acceptCall` / `rejectCall` | no — receivers join or ignore |

---

## Hard rules

1. **Group calls broadcast a custom message; they do NOT use the call listener.** Add a `MessageListener` for custom UI.
2. **Session ID = group GUID.** Persistent.
3. **V6's "five required workarounds" (W1–W5 in SKILL.md) apply to group calls too** — same calls-sdk-android peer dep, same `Call` constructor arg order, same stub classes. Group calls share the underlying WebRTC layer.
4. **No `CometChat.endCall` for groups.** Use `CallSession.getInstance().leaveSession()` only.

---

## Caller side — Compose (kit)

```kotlin
import com.cometchat.chatuikit.calls.callbuttons.CometChatCallButtons

@Composable
fun GroupHeader(group: Group) {
    Row {
        Text(group.name)
        // ⚠️ V6 W4 — DO NOT use CometChatCallButtons composable for 1:1 user
        // calls (broken in 6.0.0 — captures first-rendered user globally).
        // For groups, the composable's same bug may or may not apply; check
        // current chatuikit-compose-android version's release notes.
        CometChatCallButtons(group = group)
    }
}
```

The kit's `CometChatCallButtons(group = group)` composable sends the same `CustomMessage` of type `"meeting"` as the Kotlin Views variant. V6 W4 (the per-row state-capture bug) primarily affects the `user` prop variant; group-targeted use may be safer but verify against the installed version.

## Caller side — Kotlin Views (kit)

```kotlin
val callButtons = CometChatCallButtons(this).apply {
    setGroup(group)
}
```

Same behavior as V5.

## Caller side — custom UI

```kotlin
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.models.CustomMessage
import com.cometchat.chat.constants.CometChatConstants
import org.json.JSONObject

fun startGroupCall(groupGuid: String, callType: String) {
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
            // navigate to your OngoingCall composable / Activity with sessionId
        }
        override fun onError(p0: CometChatException) { /* surface */ }
    })
}
```

---

## Receiver side — kit-based (auto-renders meeting card)

`CometChatMessageList(group = group)` (Compose) or the Kotlin Views equivalent renders the meeting message as a "Join meeting" card.

## Receiver side — custom UI

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
        // Compose: state.update { it.copy(incomingMeeting = ...) }
        // Views: runOnUiThread { showIncomingMeetingDialog(...) }
    }
})

// Cleanup:
DisposableEffect(Unit) {
    onDispose { CometChat.removeMessageListener(GROUP_MEETING_LISTENER_ID) }
}
```

Wrap in `DisposableEffect` (Compose) or `onDestroy()` (Views).

---

## Edge cases

### Late joining

Meeting message persists in chat history. Tap to join — works hours after.

### V6 calls-sdk-android peer dep

Same W1 workaround applies to group calls — `com.cometchat:calls-sdk-android:5.0.+` must be an explicit peer dep in `app/build.gradle.kts`. Without it, group-call join fails the same way 1:1 join fails.

### Push notifications

Meeting `CustomMessage.metadata.pushNotification = "meeting"` — routed via regular FCM. No ConnectionService-ring out of the box.

---

## Anti-patterns

1. **Registering `CometChat.addCallListener` only — expecting group ringing.** Won't fire.
2. **Skipping the V6 W1–W5 workarounds for groups.** They apply equally — calls-sdk-android peer dep, annotations-java5 exclude, stub classes, Call constructor arg order, avoid V6 `CometChatCallButtons` composable per-row bug.
3. **`CometChat.endCall(sessionId)` after group hangup.** No call entity. Use `CallSession.getInstance().leaveSession()`.
4. **Treating sessionId as ephemeral.** It's the group GUID.

---

## Verification checklist

- [ ] V6 workarounds W1–W5 applied (calls-sdk-android peer dep + manifest etc. — see SKILL.md §"Five required workarounds")
- [ ] Kit caller: `CometChatCallButtons(group = ...)` / `setGroup(group)` initiates meeting message
- [ ] Custom caller: `CometChat.sendCustomMessage` with `type="meeting"`, `category=CATEGORY_CUSTOM`
- [ ] Kit receiver: `CometChatMessageList` renders meeting card
- [ ] Custom receiver: `addMessageListener` registered with category+type filter
- [ ] On hangup: `CallSession.getInstance().leaveSession()` only (no `endCall`)

---

## Pointers

- `cometchat-android-v6-calls/SKILL.md` §"Five required workarounds" — V6 build prerequisites
- `ringing-integration.md` — 1:1 user calls
- Canonical docs: https://www.cometchat.com/docs/calls/android/group-calls
- Cross-platform reference (semantic ground-truth): `cometchat-react-calls/references/group-calls.md`
