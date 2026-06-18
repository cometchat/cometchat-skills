# Raise hand on Android V5 (Java + Kotlin Views)

Native CometChat Calls SDK for Android. The shape mirrors web (raise/lower + listener events + button-hide flag); Android-specific is the listener attachment lifecycle (Activity/Fragment) + accessibility via `View.announceForAccessibility`.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/raise-hand
**Read first:** `cometchat-react-calls/references/raise-hand.md` — UX shape + anti-patterns.

---

## SDK API

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.core.CallSession
import com.cometchat.calls.listeners.ParticipantEventListener
import com.cometchat.calls.model.Participant
import com.cometchat.calls.model.SessionType

// Local user — raiseHand / lowerHand are instance methods on the CallSession singleton.
CallSession.getInstance().raiseHand()
CallSession.getInstance().lowerHand()

// Listener — raise/lower hand are participant events in v5.
// Register on the CallSession instance from joinSession's onSuccess callback.
callSession.addParticipantEventListener(this, object : ParticipantEventListener() {
  override fun onParticipantHandRaised(participant: Participant) {
    // participant.uid, participant.name
  }

  override fun onParticipantHandLowered(participant: Participant) {
    // ...
  }
  // ... other participant event handlers
})

// Settings flag
val settings = CometChatCalls.SessionSettingsBuilder()
  .setSessionType(SessionType.VIDEO)
  .hideRaiseHandButton(true)
  .build()
```

For **Java**:

```java
CallSession.getInstance().raiseHand();
CallSession.getInstance().lowerHand();

callSession.addParticipantEventListener(this, new ParticipantEventListener() {
  @Override
  public void onParticipantHandRaised(Participant participant) { /* ... */ }

  @Override
  public void onParticipantHandLowered(Participant participant) { /* ... */ }
  // ...
});
```

---

## Lifecycle: where to attach the listener

For a single-Activity call surface:

```kotlin
class CallActivity : AppCompatActivity() {

  private lateinit var raiseHandViewModel: RaiseHandViewModel
  private val callListener = object : ParticipantEventListener() {
    override fun onParticipantHandRaised(p: Participant) {
      raiseHandViewModel.onRaised(p)
    }
    override fun onParticipantHandLowered(p: Participant) {
      raiseHandViewModel.onLowered(p)
    }
    // ...
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    raiseHandViewModel = ViewModelProvider(this)[RaiseHandViewModel::class.java]
    // Register on the CallSession instance (from joinSession's onSuccess) when
    // the session starts: callSession.addParticipantEventListener(this, callListener)
    // (rule 1.7 in cometchat-android-v5-calls). Listeners are lifecycle-aware.
  }

  override fun onDestroy() {
    super.onDestroy()
    // Listeners are lifecycle-aware (bound to the Activity passed as the first
    // arg) and auto-removed on destroy; otherwise leaveSession() tears them down.
  }
}
```

For Fragment-hosted calls, attach in `onViewCreated`, detach in `onDestroyView`.

---

## ViewModel pattern (Kotlin coroutines + StateFlow)

```kotlin
data class RaisedParticipant(val uid: String, val name: String, val raisedAt: Long)

data class RaiseHandUiState(
  val localRaised: Boolean = false,
  val raised: List<RaisedParticipant> = emptyList(),
)

class RaiseHandViewModel : ViewModel() {
  private val _state = MutableStateFlow(RaiseHandUiState())
  val state: StateFlow<RaiseHandUiState> = _state

  fun toggle() {
    if (_state.value.localRaised) {
      CallSession.getInstance().lowerHand()
    } else {
      CallSession.getInstance().raiseHand()
    }
    _state.update { it.copy(localRaised = !it.localRaised) }
  }

  fun onRaised(p: Participant) {
    val entry = RaisedParticipant(p.uid, p.name, System.currentTimeMillis())
    _state.update { state ->
      val next = state.raised.filter { it.uid != p.uid } + entry
      state.copy(raised = next.sortedBy { it.raisedAt })
    }
  }

  fun onLowered(p: Participant) {
    _state.update { state ->
      state.copy(raised = state.raised.filter { it.uid != p.uid })
    }
  }
}
```

`StateFlow` is the canonical Android single-source-of-truth pattern. Activities collect via `viewLifecycleOwner.lifecycleScope.launch` + `repeatOnLifecycle(STARTED)`.

---

## Toggle button

```kotlin
class RaiseHandButton @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : MaterialButton(context, attrs) {

  init {
    setOnClickListener {
      val raised = (tag as? Boolean) ?: false
      tag = !raised
      // VM toggle handled by Activity wiring — see below
    }
  }

  fun bind(viewModel: RaiseHandViewModel, lifecycleOwner: LifecycleOwner) {
    setOnClickListener {
      viewModel.toggle()
    }

    lifecycleOwner.lifecycleScope.launch {
      lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.state.collect { state ->
          text = if (state.localRaised) "Lower" else "Raise"
          icon = ContextCompat.getDrawable(context,
            if (state.localRaised) R.drawable.ic_hand_raised_filled
            else R.drawable.ic_hand_raised)
          contentDescription = if (state.localRaised) "Lower hand" else "Raise hand"
          // a11y announcement on state change
          announceForAccessibility(if (state.localRaised) "Hand raised" else "Hand lowered")
          isSelected = state.localRaised
        }
      }
    }
  }
}
```

`announceForAccessibility` is the Android equivalent of web's `aria-live` and iOS's `UIAccessibility.post(.announcement, ...)`. TalkBack picks it up.

---

## Raised-hands BottomSheet

```kotlin
class RaisedHandsBottomSheet : BottomSheetDialogFragment() {

  private val viewModel: RaiseHandViewModel by activityViewModels()

  override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
    val view = inflater.inflate(R.layout.bottomsheet_raised_hands, container, false)
    val recyclerView = view.findViewById<RecyclerView>(R.id.raised_hands_list)
    val adapter = RaisedHandsAdapter()
    recyclerView.adapter = adapter

    viewLifecycleOwner.lifecycleScope.launch {
      viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.state.collect { state ->
          adapter.submitList(state.raised)
        }
      }
    }

    return view
  }
}
```

Use `BottomSheetDialogFragment` from `com.google.android.material.bottomsheet` — the canonical Material Design pattern for raised-hands roster on phones.

---

## Anti-patterns

Web sister reference rules apply, plus Android-specific:

1. **Listener in `init { }` of an Activity.** Activity init runs before `onCreate`; SDK might not be ready. Attach in `onCreate` or later.
2. **Skipping `repeatOnLifecycle(STARTED)`.** Without it, `StateFlow.collect` runs even when Activity is paused — burns CPU during background.
3. **Forgetting `lifecycleScope`.** Detached coroutines leak across activity destruction.
4. **`MutableStateFlow.value = ...` from background thread without `_state.update`.** Race conditions on the list. Always use `update { ... }` for atomic state transitions.
5. **`announceForAccessibility` from `setOnClickListener`** before the visual state has changed. Order matters — update the View first, then announce.

---

## Verification checklist

- [ ] `RaiseHandViewModel` uses `StateFlow` (not LiveData) for the call state
- [ ] `ParticipantEventListener` attached on the `CallSession` at session start (lifecycle-aware; also torn down by `leaveSession()`)
- [ ] `repeatOnLifecycle(Lifecycle.State.STARTED)` wraps every collect
- [ ] Toggle button has `contentDescription` + `isSelected` set
- [ ] `announceForAccessibility` on state change
- [ ] `hideRaiseHandButton(true)` in SessionSettingsBuilder if custom UI
- [ ] BottomSheetDialogFragment for raised-hands roster (phones) OR side panel (tablets)
- [ ] Real-device smoke: 3 Android phones in same call, 2 raise → host's sheet shows both
- [ ] TalkBack smoke: hand raise + lower announces correctly

---

## Pointers

- `cometchat-react-calls/references/raise-hand.md` — sister reference (UX shape)
- `cometchat-android-v5-calls` SKILL.md — V5 hard rules
- `references/participant-management.md` — group call moderation patterns
- `references/custom-ui.md` — Android custom call UI
- Canonical docs: https://www.cometchat.com/docs/calls/android/raise-hand
- For V6 (Compose / Kotlin Views split): `cometchat-android-v6-calls/references/raise-hand.md`
