# In-call chat on Android V6

V5 has detailed in-call-chat reference; V6 adds Compose-specific UI patterns. The SDK API + group-as-session architecture is unchanged.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/in-call-chat
**Read first:** `cometchat-android-v5-calls/references/in-call-chat.md` — full Kotlin Views + Java SDK patterns + group setup.

---

## Compose ModalBottomSheet for in-call chat

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InCallChatSheet(
  sessionId: String,
  viewModel: InCallChatViewModel = viewModel(),
) {
  val state by viewModel.state.collectAsStateWithLifecycle()
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)

  if (state.open && state.group != null) {
    ModalBottomSheet(
      onDismissRequest = { viewModel.close() },
      sheetState = sheetState,
      shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
    ) {
      Column(modifier = Modifier
        .fillMaxWidth()
        .heightIn(min = 400.dp)
        .padding(16.dp)) {
        Text("Chat", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(8.dp))
        // Compose call's CometChatMessageList composable
        CometChatMessageList(
          group = state.group,
          modifier = Modifier.weight(1f),
        )
        CometChatMessageComposer(group = state.group)
      }
    }
  }
}
```

`Modifier.weight(1f)` makes the message list expand; composer pinned at bottom. Same minHeight:0 idea but Compose-flavored.

---

## ViewModel

```kotlin
data class InCallChatState(
  val open: Boolean = false,
  val unread: Int = 0,
  val group: Group? = null,
)

class InCallChatViewModel : ViewModel(), MessageListener {
  private val _state = MutableStateFlow(InCallChatState())
  val state: StateFlow<InCallChatState> = _state

  fun init(sessionId: String) {
    viewModelScope.launch {
      val group = ensureGroup(sessionId)
      _state.update { it.copy(group = group) }
      CometChat.addMessageListener("in-call-chat-$sessionId", this@InCallChatViewModel)
    }
  }

  override fun onTextMessageReceived(message: TextMessage) {
    if (_state.value.open) return
    if (message.receiverType != CometChatConstants.RECEIVER_TYPE_GROUP) return
    if (message.receiverUid != _state.value.group?.guid) return
    _state.update { it.copy(unread = it.unread + 1) }
    CometChatCalls.setChatButtonUnreadCount(_state.value.unread)
  }

  fun open() {
    _state.update { it.copy(open = true, unread = 0) }
    CometChatCalls.setChatButtonUnreadCount(0)
  }

  fun close() {
    _state.update { it.copy(open = false) }
  }

  override fun onCleared() {
    CometChat.removeMessageListener("in-call-chat-${_state.value.group?.guid}")
  }
}
```

---

## Triggering from SDK event

In your `CometChatCallsEventsListener` impl:

```kotlin
override fun onChatButtonClicked() {
  // Listener is on background thread — dispatch to UI
  Handler(Looper.getMainLooper()).post {
    inCallChatViewModel.open()
  }
}
```

---

## Anti-patterns

V5 sister rules apply, plus Compose-specific:

1. **`collectAsState()` instead of `collectAsStateWithLifecycle()`.** State updates while paused.
2. **No `Modifier.weight(1f)` on the message list.** Composer pushes off bottom (same flex-shrink trap).
3. **`ModalBottomSheet` without `skipPartiallyExpanded = false`.** Defaults to half-screen only; user can't drag to full.

---

## Verification checklist

- [ ] InCallChatViewModel uses StateFlow + collectAsStateWithLifecycle
- [ ] Message list has `Modifier.weight(1f)`
- [ ] ModalBottomSheet `skipPartiallyExpanded = false`
- [ ] Listener cleanup in `onCleared`
- [ ] Real-device smoke: 2 phones in call, message → badge → tap → see message

---

## Pointers

- `cometchat-android-v5-calls/references/in-call-chat.md` — V5 sister (Kotlin Views patterns)
- `cometchat-android-v6-calls` SKILL.md
- `cometchat-android-v6-calls/references/raise-hand.md` — Compose pattern sibling
- Canonical docs: https://www.cometchat.com/docs/calls/android/in-call-chat
