---
name: in-call-chat
description: Add in-call messaging using CometChat Chat SDK and UI Kit. Use when implementing chat during calls, chat button, unread badge count, or group messaging linked to call session. Triggers on "in-call chat", "chat during call", "chat button", "in call messaging", "setChatButtonUnreadCount".
inclusion: manual
---

# CometChat Calls SDK v5 — In-Call Chat

## Overview

Add real-time text messaging during calls. Uses a CometChat Group (GUID = session ID) for chat. Requires Chat SDK + UI Kit alongside the Calls SDK.

## Prerequisites

- Calls SDK + Chat SDK + UI Kit integrated
- Dependencies:
  ```kotlin
  implementation("com.cometchat:chat-sdk-android:4.0.+")
  implementation("com.cometchat:calls-sdk-android:5.0.0-beta.2")
  implementation("com.cometchat:chat-uikit-android:4.+")
  ```

## Key Imports

```kotlin
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.ButtonClickListener
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.constants.CometChatConstants
import com.cometchat.chat.models.Group
```

## Implementation

### 1. Enable Chat Button

```kotlin
val sessionSettings = CometChatCalls.SessionSettingsBuilder()
    .hideChatButton(false)  // show chat button (hidden by default)
    .build()
```

### 2. Create/Join Chat Group

Use session ID as group GUID:

```kotlin
private fun setupChatGroup(sessionId: String, meetingName: String) {
    CometChat.getGroup(sessionId, object : CometChat.CallbackListener<Group>() {
        override fun onSuccess(group: Group) {
            if (!group.isJoined) {
                CometChat.joinGroup(sessionId, group.groupType, null, /* listener */)
            }
        }
        override fun onError(e: CometChatException) {
            if (e.code == "ERR_GUID_NOT_FOUND") {
                val group = Group(sessionId, meetingName, CometChatConstants.GROUP_TYPE_PUBLIC, null)
                CometChat.createGroup(group, /* listener */)
            }
        }
    })
}
```

### 3. Handle Chat Button Click

```kotlin
var unreadCount = 0

callSession.addButtonClickListener(this, object : ButtonClickListener() {
    override fun onChatButtonClicked() {
        unreadCount = 0
        callSession.setChatButtonUnreadCount(0)
        startActivity(Intent(this@CallActivity, ChatActivity::class.java).apply {
            putExtra("SESSION_ID", sessionId)
        })
    }
    // ... other overrides
})
```

### 4. Track Unread Messages

```kotlin
CometChat.addMessageListener(TAG, object : CometChat.MessageListener() {
    override fun onTextMessageReceived(textMessage: TextMessage) {
        val receiver = textMessage.receiver
        if (receiver is Group && receiver.guid == sessionId) {
            unreadCount++
            CallSession.getInstance().setChatButtonUnreadCount(unreadCount)
        }
    }
})

// Remove in onDestroy
override fun onDestroy() {
    CometChat.removeMessageListener(TAG)
    super.onDestroy()
}
```

### 5. Chat Activity (UI Kit)

```kotlin
class ChatActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)
        val sessionId = intent.getStringExtra("SESSION_ID") ?: return

        CometChat.getGroup(sessionId, object : CometChat.CallbackListener<Group>() {
            override fun onSuccess(group: Group) {
                findViewById<CometChatMessageList>(R.id.message_list).setGroup(group)
                findViewById<CometChatMessageComposer>(R.id.message_composer).setGroup(group)
                findViewById<CometChatMessageHeader>(R.id.message_header).setGroup(group)
            }
            override fun onError(e: CometChatException) {}
        })
    }
}
```

## Gotchas

- Chat button is **hidden by default** — use `.hideChatButton(false)` to show it
- The group GUID should match the session ID to link chat to the call
- `setChatButtonUnreadCount()` updates the badge on the built-in chat button
- Remove message listeners in `onDestroy()` to prevent leaks
- UI Kit components (`CometChatMessageList`, etc.) require the UI Kit dependency
- Create the group before or when joining the call — not after

## Sample App Reference

- `CallActivity.kt` — Session settings and button click listener setup
