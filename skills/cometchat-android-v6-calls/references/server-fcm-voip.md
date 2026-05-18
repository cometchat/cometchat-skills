# Server-side FCM HTTP v1 for Android V6 VoIP push

V5 has the canonical server template; V6 adds Compose-specific receiver patterns. The FCM payload + HTTP v1 API are unchanged from V5.

**Canonical docs:** https://firebase.google.com/docs/cloud-messaging/migrate-v1
**Read first:** `cometchat-android-v5-calls/references/server-fcm-voip.md` — full Node + Python templates, hard rules, webhook shape.

---

## V6 receiver-side delta

V5 patterns work on V6 (Compose calls bundle into chatuikit-{compose,kotlin}-android, but the FCM data-message reception is in a regular Service so Compose doesn't change anything there). One V6 nicety: surface the incoming-call UI through a Compose Activity that's launched in the foreground.

```kotlin
class VoipMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    if (data["type"] != "incoming_call") return

    // V6: launch IncomingCallActivity (a Compose Activity) directly when the
    // app is in the foreground; otherwise route through ConnectionService
    // for the OS-level UI.
    val isAppInForeground = ProcessLifecycleOwner.get().lifecycle.currentState
      .isAtLeast(Lifecycle.State.STARTED)

    if (isAppInForeground) {
      val intent = Intent(this, IncomingCallActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        putExtra("sessionId", data["sessionId"])
        putExtra("callerName", data["callerName"])
        putExtra("callType", data["callType"])
      }
      startActivity(intent)
    } else {
      // V5 ConnectionService path — see V5 sister doc
      val telecom = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
      // ... addNewIncomingCall flow
    }
  }
}
```

---

## Compose IncomingCallActivity (V6 specific)

```kotlin
class IncomingCallActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Allow showing over lock screen
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val keyguard = getSystemService(KEYGUARD_SERVICE) as KeyguardManager
      keyguard.requestDismissKeyguard(this, null)
    } else {
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }

    val sessionId = intent.getStringExtra("sessionId") ?: return finish()
    val callerName = intent.getStringExtra("callerName") ?: ""
    val callType = intent.getStringExtra("callType") ?: "audio"

    setContent {
      AppTheme {
        IncomingCallScreen(
          callerName = callerName,
          callType = callType,
          onAccept = {
            // Hand off to the kit's call surface
            val callIntent = Intent(this, ActiveCallActivity::class.java).apply {
              putExtra("sessionId", sessionId)
            }
            startActivity(callIntent)
            finish()
          },
          onReject = {
            // Notify CometChat backend
            CometChat.rejectCall(sessionId, ...)
            finish()
          },
        )
      }
    }
  }
}
```

Key V6 deltas vs V5:
- `setShowWhenLocked(true)` instead of `FLAG_SHOW_WHEN_LOCKED` (V5 uses the deprecated flag)
- `setContent { ... }` for Compose UI vs XML layout
- Compose Activity transitions are smoother — no XML inflation lag

---

## Anti-patterns

V5 sister rules apply, plus V6-specific:

1. **Calling `setContent` before `setShowWhenLocked`.** UI flashes briefly before the keyguard layer applies.
2. **Forgetting `requestDismissKeyguard`.** Lock screen still shows behind your call UI.
3. **Mixing `IncomingCallActivity` (foreground path) and `ConnectionService` (background path).** Pick the right one based on app state — V6 still benefits from V5's ConnectionService path for true background.

---

## Verification checklist

- [ ] V5 server template (Node/Python) — see V5 sister
- [ ] FCM data message lands at `VoipMessagingService.onMessageReceived` regardless of app state
- [ ] Foreground: `IncomingCallActivity` launches with show-when-locked
- [ ] Background/killed: ConnectionService path surfaces OS-level UI
- [ ] Real-device smoke: 3 cohorts (foreground, backgrounded, killed) all ring

---

## Pointers

- `cometchat-android-v5-calls/references/server-fcm-voip.md` — V5 sister (canonical server template)
- `cometchat-android-v6-calls/SKILL.md` — V6 architecture
- `cometchat-android-v6-calls/references/incoming-call-overlay.md` — Compose overlay patterns
- FCM HTTP v1: https://firebase.google.com/docs/cloud-messaging/migrate-v1
