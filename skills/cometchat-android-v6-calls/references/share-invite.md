# Share invite on Android V6 (Compose)

Same SDK + Intent pattern as V5; Compose adds an idiomatic LocalContext-based share trigger and ViewModel state for in-flight indication.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/share-invite
**Read first:** `cometchat-android-v5-calls/references/share-invite.md` — App Links setup + Intent.createChooser pattern.

---

## ViewModel

```kotlin
class ShareInviteViewModel : ViewModel() {
  private val _sharing = MutableStateFlow(false)
  val sharing: StateFlow<Boolean> = _sharing

  fun share(context: Context, sessionId: String) {
    if (_sharing.value) return
    _sharing.value = true
    try {
      val url = "https://yourapp.com/call/$sessionId"
      val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "Join my call")
        putExtra(Intent.EXTRA_TEXT, "I'm on a call — tap to join.\n$url")
      }
      context.startActivity(Intent.createChooser(intent, "Share call invite"))
    } finally {
      _sharing.value = false
    }
  }
}
```

`Context` is short-lived per call — pass via composable arg, don't keep in the ViewModel field.

---

## Compose share button

```kotlin
@Composable
fun ShareInviteButton(
  sessionId: String,
  viewModel: ShareInviteViewModel = viewModel(),
) {
  val context = LocalContext.current
  val sharing by viewModel.sharing.collectAsStateWithLifecycle()

  IconButton(
    onClick = { viewModel.share(context, sessionId) },
    enabled = !sharing,
  ) {
    if (sharing) {
      CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
    } else {
      Icon(Icons.Default.Share, contentDescription = "Share invite")
    }
  }
}
```

---

## Bridge from SDK event

```kotlin
override fun onShareInviteButtonClicked() {
  val ctx = activityRef.get() ?: return
  Handler(Looper.getMainLooper()).post {
    shareInviteViewModel.share(ctx, sessionId)
  }
}
```

`activityRef` should be a `WeakReference<Activity>` set when the call starts and cleared in onPause/onDestroy.

---

## Anti-patterns

V5 sister rules apply, plus Compose-specific:

1. **Storing `Context` in ViewModel field.** Leak after rotation; ViewModels survive config changes but Activities don't.
2. **`collectAsState()` instead of `collectAsStateWithLifecycle()`.** Wasted work while paused.
3. **Strong activity reference in CallsEventsListener.** Use `WeakReference` or pass via `LocalContext.current` from the composable.

---

## Verification checklist

- [ ] `Context` passed via composable arg, not stored in ViewModel
- [ ] `WeakReference<Activity>` for SDK callback bridge
- [ ] `collectAsStateWithLifecycle` for sharing state
- [ ] `Intent.createChooser` (not raw ACTION_SEND)
- [ ] App URL via `BuildConfig.APP_URL`
- [ ] Real-device smoke: same as V5

---

## Pointers

- `cometchat-android-v5-calls/references/share-invite.md` — V5 sister (Views patterns)
- `cometchat-android-v6-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/android/share-invite
