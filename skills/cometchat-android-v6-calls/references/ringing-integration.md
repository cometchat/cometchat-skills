# Ringing — call signaling with custom UI (Android V6 / Compose)

V5 has the canonical Android ringing reference. V6 keeps the same SDK API; only the UI layer changes (Compose vs XML Views).

**Read first:**
- `cometchat-android-v5-calls/references/ringing-integration.md` — canonical Android (full SDK flow)
- `cometchat-react-calls/references/ringing-integration.md` — architecture + hard rules

---

## ViewModel

```kotlin
data class CallSignalingState(
  val incoming: Call? = null,
  val outgoing: Call? = null,
  val activeSessionId: String? = null,
)

class CallSignalingViewModel : ViewModel(), CometChat.CallListener {
  private val _state = MutableStateFlow(CallSignalingState())
  val state: StateFlow<CallSignalingState> = _state

  init {
    CometChat.addCallListener("app", this)
  }

  override fun onIncomingCallReceived(call: Call) {
    Handler(Looper.getMainLooper()).post {
      _state.update { it.copy(incoming = call) }
    }
  }

  override fun onOutgoingCallAccepted(call: Call) {
    Handler(Looper.getMainLooper()).post {
      _state.update { it.copy(outgoing = null, activeSessionId = call.sessionId) }
    }
  }

  override fun onOutgoingCallRejected(call: Call) {
    Handler(Looper.getMainLooper()).post {
      _state.update { it.copy(outgoing = null) }
    }
  }

  override fun onIncomingCallCancelled(call: Call) {
    Handler(Looper.getMainLooper()).post {
      _state.update { it.copy(incoming = null) }
    }
  }

  override fun onCallEndedMessageReceived(call: Call) {
    Handler(Looper.getMainLooper()).post {
      _state.update { CallSignalingState() }
    }
  }

  fun initiate(receiverUid: String, type: String) {
    val call = Call(receiverUid, type, CometChatConstants.RECEIVER_TYPE_USER)
    CometChat.initiateCall(call, object : CometChat.CallbackListener<Call>() {
      override fun onSuccess(outgoing: Call) {
        _state.update { it.copy(outgoing = outgoing) }
      }
      override fun onError(e: CometChatException) { Log.e("App", "Initiate failed", e) }
    })
  }

  fun accept(call: Call) {
    CometChat.acceptCall(call.sessionId, object : CometChat.CallbackListener<Call>() {
      override fun onSuccess(accepted: Call) {
        _state.update { it.copy(incoming = null, activeSessionId = accepted.sessionId) }
      }
      override fun onError(e: CometChatException) {}
    })
  }

  fun reject(call: Call) {
    CometChat.rejectCall(call.sessionId, CometChatConstants.CALL_STATUS_REJECTED, null)
    _state.update { it.copy(incoming = null) }
  }

  override fun onCleared() {
    CometChat.removeCallListener("app")
  }
}
```

---

## Compose incoming-call overlay

```kotlin
@Composable
fun CallSignalingOverlay(viewModel: CallSignalingViewModel = viewModel()) {
  val state by viewModel.state.collectAsStateWithLifecycle()

  state.incoming?.let { call ->
    Dialog(onDismissRequest = { viewModel.reject(call) }) {
      Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color.Black.copy(alpha = 0.85f),
      ) {
        Column(
          modifier = Modifier.fillMaxSize(),
          horizontalAlignment = Alignment.CenterHorizontally,
          verticalArrangement = Arrangement.Center,
        ) {
          AsyncImage(
            model = call.callInitiator?.avatar,
            contentDescription = null,
            modifier = Modifier.size(120.dp).clip(CircleShape),
          )
          Spacer(Modifier.height(16.dp))
          Text(
            call.callInitiator?.name ?: "Unknown",
            style = MaterialTheme.typography.titleLarge,
            color = Color.White,
          )
          Text("Incoming ${call.type} call", color = Color.White.copy(alpha = 0.7f))
          Spacer(Modifier.height(32.dp))
          Row(horizontalArrangement = Arrangement.spacedBy(32.dp)) {
            FloatingActionButton(
              onClick = { viewModel.reject(call) },
              containerColor = Color.Red,
              modifier = Modifier.semantics { contentDescription = "Decline call" },
            ) { Icon(Icons.Default.CallEnd, contentDescription = null, tint = Color.White) }
            FloatingActionButton(
              onClick = { viewModel.accept(call) },
              containerColor = Color.Green,
              modifier = Modifier.semantics { contentDescription = "Accept call" },
            ) { Icon(Icons.Default.Call, contentDescription = null, tint = Color.White) }
          }
        }
      }
    }
  }
}
```

Mount above your nav graph in `MainActivity.setContent` so it surfaces over any screen.

---

## Backgrounded ring — ConnectionService + FCM (mandatory)

The Compose overlay only fires when the app is foreground. For backgrounded/killed-app ring delivery, FCM data-message → ConnectionService → OS-level UI. See `cometchat-android-v6-calls/references/server-fcm-voip.md`.

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **`collectAsState()` instead of `collectAsStateWithLifecycle()`.** State updates while paused.
2. **Listener registered in a Composable.** Disposes on recomposition; use a ViewModel or Application-scoped class.
3. **Forgetting `Handler(Looper.getMainLooper()).post`.** SDK fires off main thread; StateFlow updates from background are fine but Compose recompositions need main.

---

## Verification checklist

- [ ] ViewModel implements `CometChat.CallListener` and registers in init
- [ ] `onCleared` calls `removeCallListener`
- [ ] All state updates dispatched to main thread
- [ ] `Dialog`-based overlay mounts above nav graph in MainActivity
- [ ] FCM + ConnectionService handles backgrounded ring (V5 sister)
- [ ] Real-device smoke: foreground + backgrounded + killed-app ring

---

## Pointers

- `cometchat-android-v5-calls/references/ringing-integration.md` — canonical Android (V5 Views patterns)
- `cometchat-android-v6-calls/SKILL.md` — V6 architecture
- `cometchat-android-v6-calls/references/server-fcm-voip.md` — Compose IncomingCallActivity for backgrounded ring
- Canonical docs: https://www.cometchat.com/docs/calls/android/ringing
