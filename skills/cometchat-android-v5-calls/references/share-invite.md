# Share invite on Android V5 (Views)

Same SDK API. Android-specific: `Intent.createChooser(ACTION_SEND)` is the native share sheet pattern; App Links must be configured for the call URL to deep-link.

**Canonical docs:** https://www.cometchat.com/docs/calls/android/share-invite
**Read first:** `cometchat-react-calls/references/share-invite.md` — deep-link rule + UX.

---

## Hard rule: App Links

Configure deep-link routing in `AndroidManifest.xml`:

```xml
<activity
  android:name=".MainActivity"
  android:launchMode="singleTask"
  android:exported="true">

  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
      android:scheme="https"
      android:host="yourapp.com"
      android:pathPrefix="/call" />
  </intent-filter>
</activity>
```

Host `assetlinks.json` at `https://yourapp.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourapp",
    "sha256_cert_fingerprints": ["AB:CD:EF:..."]
  }
}]
```

Handle in MainActivity:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  handleDeepLink(intent)
}

override fun onNewIntent(intent: Intent) {
  super.onNewIntent(intent)
  handleDeepLink(intent)
}

private fun handleDeepLink(intent: Intent?) {
  val data = intent?.data ?: return
  val segments = data.pathSegments
  if (segments.size >= 2 && segments[0] == "call") {
    val sessionId = segments[1]
    router.routeToCall(sessionId)
  }
}
```

---

## SDK API

```kotlin
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.calls.listeners.ButtonClickListener

val settings = CometChatCalls.SessionSettingsBuilder()
  .hideShareInviteButton(false)
  .build()

// onShareInviteButtonClicked() lives on ButtonClickListener in v5.
// Register on the CallSession instance from joinSession's onSuccess callback.
callSession.addButtonClickListener(activity, object : ButtonClickListener() {
  override fun onShareInviteButtonClicked() {
    activity.runOnUiThread {
      shareCallInvite(sessionId)
    }
  }
})
```

---

## Intent.createChooser

```kotlin
fun Activity.shareCallInvite(sessionId: String) {
  val url = "https://yourapp.com/call/$sessionId"
  val intent = Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_SUBJECT, "Join my call")
    putExtra(Intent.EXTRA_TEXT, "I'm on a call — tap to join.\n$url")
  }
  startActivity(Intent.createChooser(intent, "Share call invite"))
}
```

`Intent.createChooser` always shows the picker (even if a default is set) — important when invitees commonly use multiple apps (WhatsApp, SMS, email).

---

## Clipboard fallback

Some users prefer to copy the link explicitly:

```kotlin
fun Context.copyCallLink(sessionId: String) {
  val url = "https://yourapp.com/call/$sessionId"
  val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
  clipboard.setPrimaryClip(ClipData.newPlainText("Call link", url))

  // Android 13+ shows system toast automatically; older versions need explicit
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
    Toast.makeText(this, "Link copied", Toast.LENGTH_SHORT).show()
  }
}
```

---

## Anti-patterns

Web sister rules apply, plus Android-specific:

1. **`Intent.ACTION_SEND` without `Intent.createChooser`.** Default app gets used silently — user may want a different app.
2. **No `assetlinks.json` hosted.** App Links don't auto-verify, falls back to "Open with..." dialog.
3. **Hard-coded URL string.** Use `BuildConfig.APP_URL` set via Gradle build flavors.
4. **Copying URL to clipboard then showing manual toast on Android 13+.** Duplicate toast (system + manual).

---

## Verification checklist

- [ ] `<intent-filter>` with `autoVerify="true"` for `/call/*`
- [ ] `assetlinks.json` hosted + reachable
- [ ] `handleDeepLink` covers both `onCreate` and `onNewIntent`
- [ ] `Intent.createChooser` wraps the share intent
- [ ] App URL via `BuildConfig.APP_URL` (not hard-coded)
- [ ] Real-device smoke: share to WhatsApp → tap from another device → opens your app at the call

---

## Pointers

- `cometchat-react-calls/references/share-invite.md` — sister
- `cometchat-android-v5-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/android/share-invite
