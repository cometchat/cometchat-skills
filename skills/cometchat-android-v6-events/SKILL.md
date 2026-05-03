---
name: cometchat-android-v6-events
description: "CometChat Android UIKit v6 event system — SharedFlow-based reactive event bus for messages, calls, users, groups, conversations, and UI events"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-core-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, events, sharedflow, kotlin-flow, reactive"
---

> **Companion skills:** cometchat-android-v6-core (init/login), cometchat-android-v6-kotlin-customization, cometchat-android-v6-compose-customization

## Purpose

Subscribe to and emit CometChat events using the v6 Kotlin SharedFlow-based event bus. This replaces the v5 Java listener interface pattern with a reactive, type-safe system built on `kotlinx.coroutines.flow.SharedFlow`.

## Use this skill when

- Listening for message sent/received/edited/deleted events
- Listening for call accepted/rejected/ended events
- Listening for user or group membership changes
- Listening for conversation updates
- Listening for UI events (custom UI position events)
- Emitting custom events to trigger UI updates

## Do not use this skill when

- Setting up the SDK (use `cometchat-android-v6-core`)
- Working with CometChat SDK-level listeners (`CometChat.addMessageListener`) — those are separate from UIKit events

## 1. Event Bus Architecture

`CometChatEvents` is a singleton object in `com.cometchat.uikit.core.events` that manages 6 event flows:

```kotlin
import com.cometchat.uikit.core.events.CometChatEvents

// 6 event flows — all are SharedFlow<T>
CometChatEvents.messageEvents       // SharedFlow<CometChatMessageEvent>
CometChatEvents.callEvents          // SharedFlow<CometChatCallEvent>
CometChatEvents.userEvents          // SharedFlow<CometChatUserEvent>
CometChatEvents.groupEvents         // SharedFlow<CometChatGroupEvent>
CometChatEvents.conversationEvents  // SharedFlow<CometChatConversationEvent>
CometChatEvents.uiEvents            // SharedFlow<CometChatUIEvent>
```

Each flow uses:
- `replay = 0` — no replay of past events to new subscribers
- `BufferOverflow.DROP_OLDEST` — drops oldest events when buffer is full
- Buffer capacities: messages=64, groups=32, users/conversations/ui=16, calls=8

## 2. Subscribing to Events

### 2.1 In a ViewModel or CoroutineScope

```kotlin
import com.cometchat.uikit.core.events.*
import kotlinx.coroutines.launch

// In a ViewModel
viewModelScope.launch {
    CometChatEvents.messageEvents.collect { event ->
        when (event) {
            is CometChatMessageEvent.MessageSent -> {
                val message = event.message
                val status = event.status // IN_PROGRESS, SUCCESS, or ERROR
            }
            is CometChatMessageEvent.MessageEdited -> {
                val editedMessage = event.message
            }
            is CometChatMessageEvent.MessageDeleted -> {
                val deletedMessage = event.message
            }
            // handle other message events...
            else -> {}
        }
    }
}
```

### 2.2 In Jetpack Compose

```kotlin
import androidx.compose.runtime.LaunchedEffect
import com.cometchat.uikit.core.events.*

@Composable
fun ChatScreen() {
    LaunchedEffect(Unit) {
        CometChatEvents.callEvents.collect { event ->
            when (event) {
                is CometChatCallEvent.CallAccepted -> {
                    // Navigate to ongoing call screen
                }
                is CometChatCallEvent.CallRejected -> {
                    // Dismiss call UI
                }
                else -> {}
            }
        }
    }
}
```

### 2.3 In an Activity or Application class

```kotlin
private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    scope.launch {
        CometChatEvents.callEvents.collect { event ->
            when (event) {
                is CometChatCallEvent.CallAccepted -> { /* ... */ }
                is CometChatCallEvent.CallRejected -> { /* ... */ }
                else -> {}
            }
        }
    }
}

override fun onDestroy() {
    super.onDestroy()
    scope.cancel() // Always cancel to avoid leaks
}
```

## 3. Emitting Events

```kotlin
// Emit a message event
CometChatEvents.emitMessageEvent(
    CometChatMessageEvent.MessageSent(message, MessageStatus.SUCCESS)
)

// Emit a call event
CometChatEvents.emitCallEvent(
    CometChatCallEvent.CallRejected(call)
)

// Emit a user event
CometChatEvents.emitUserEvent(event)

// Emit a group event
CometChatEvents.emitGroupEvent(event)

// Emit a conversation event
CometChatEvents.emitConversationEvent(event)

// Emit a UI event
CometChatEvents.emitUIEvent(event)
```

All emit functions are thread-safe — they launch on `Dispatchers.Default` internally.

## 4. Event Types Reference

### 4.1 CometChatMessageEvent (sealed class)

| Event | Properties | When emitted |
|---|---|---|
| `MessageSent` | `message: BaseMessage`, `status: MessageStatus` | Text/media/custom message sent (IN_PROGRESS → SUCCESS or ERROR) |
| `MessageEdited` | `message: BaseMessage` | Message edited |
| `MessageDeleted` | `message: BaseMessage` | Message deleted |

`MessageStatus` enum: `IN_PROGRESS`, `SUCCESS`, `ERROR`

### 4.2 CometChatCallEvent (sealed class)

| Event | Properties | When emitted |
|---|---|---|
| `CallAccepted` | `call: Call` | Incoming call accepted |
| `CallRejected` | `call: Call` | Call rejected |

### 4.3 CometChatUserEvent (sealed class)

User-related events (block, unblock, etc.)

### 4.4 CometChatGroupEvent (sealed class)

Group membership events (member added, removed, scope changed, etc.)

### 4.5 CometChatConversationEvent (sealed class)

Conversation-level events (conversation deleted, etc.)

### 4.6 CometChatUIEvent (sealed class)

UI-level events including `CustomUIPosition` for custom view positioning.

## 5. Migration from v5

| v5 Pattern | v6 Pattern |
|---|---|
| `CometChatMessageEvents.addListener(id, listener)` | `CometChatEvents.messageEvents.collect { }` |
| `CometChatCallEvents.addListener(id, listener)` | `CometChatEvents.callEvents.collect { }` |
| `listener.onTextMessageSent(message)` | `is CometChatMessageEvent.MessageSent` |
| `removeListener(id)` | Cancel the coroutine scope |
| Java interface callbacks | Kotlin sealed class + when expression |

## Hard rules

- NEVER collect flows on `Dispatchers.Default` for UI updates — switch to `Dispatchers.Main` or use `viewModelScope` / `lifecycleScope`
- ALWAYS cancel coroutine scopes when the component is destroyed to avoid memory leaks
- Events are emitted on `Dispatchers.Default` — the subscriber is responsible for thread switching
- Buffer overflow uses `DROP_OLDEST` — high-frequency events may be dropped if the subscriber is slow
- Do NOT confuse UIKit events (`CometChatEvents`) with SDK-level listeners (`CometChat.addMessageListener`) — they are separate systems
- `CometChatUIKit.sendTextMessage()` / `sendMediaMessage()` / `sendCustomMessage()` automatically emit message events — do not double-emit
