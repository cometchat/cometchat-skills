# Adding calls to an existing chat integration (Android V6 / Compose)

V6 calls are **bundled** into `chatuikit-{compose,kotlin}-android:6.x` — there's no separate calls SDK to install. To turn calls on, call `.enableCalling()` on your UIKit settings.

**Read first:** `cometchat-android-v6-calls/SKILL.md` — V6 architecture.

---

## Step 1 — Verify chat-uikit cohort

```kotlin
// app/build.gradle.kts
dependencies {
  implementation("com.cometchat:chatuikit-compose-android:6.+")
  // (or chatuikit-kotlin-android for Views)
}
```

If you're on `chatuikit-android` v5 or `calls-sdk-android` separately, this is the wrong family — see `cometchat-android-v5-calls/references/add-calls-to-existing-chat.md`.

---

## Step 2 — Enable calling on UIKit

Find your existing UIKit init (typically in `Application.onCreate` or `MainActivity.onCreate`):

```kotlin
val uikitSettings = UIKitSettings.Builder()
  .setAppId(APP_ID)
  .setRegion(REGION)
  .setAuthKey(AUTH_KEY)   // OR .subscribePresenceForAllUsers() etc.
  .enableCalling()         // NEW — adds calls
  .build()

CometChatUIKit.init(this, uikitSettings, /* callback */)
```

That's the entire migration for V6. The bundled calls SDK initializes when chat init succeeds.

---

## Step 3 — Permissions + manifest

Same as V5 (see V5 sister doc). V6 doesn't change permission requirements.

---

## Step 4 — Mount CometChatIncomingCall

In Compose:

```kotlin
@Composable
fun AppRoot() {
  Box(modifier = Modifier.fillMaxSize()) {
    AppContent()
    CometChatIncomingCall()  // overlay on top — handles incoming call UI
  }
}
```

In Views (Kotlin XML):

```xml
<!-- activity_main.xml -->
<FrameLayout ...>
  <fragment android:id="@+id/main_content" .../>
  <com.cometchat.chatuikit.calls.incomingcall.CometChatIncomingCall
    android:layout_width="match_parent"
    android:layout_height="match_parent"/>
</FrameLayout>
```

---

## Step 5 — FCM VoIP push

Same as V5 (see `cometchat-android-v5-calls/references/server-fcm-voip.md`). V6 adds a Compose-friendly `IncomingCallActivity` pattern — see `cometchat-android-v6-calls/references/server-fcm-voip.md`.

---

## Verification checklist

- [ ] `chatuikit-compose-android:6.+` (or `chatuikit-kotlin-android:6.+`) in app deps
- [ ] `.enableCalling()` chained into UIKitSettings.Builder
- [ ] Manifest permissions same as V5
- [ ] `CometChatIncomingCall` mounted (Compose overlay or Views FrameLayout)
- [ ] FCM token registration wired
- [ ] Run `cometchat verify --calls` — `v6_enable_calling` should pass

---

## Pointers

- `cometchat-android-v5-calls/references/add-calls-to-existing-chat.md` — V5 sister (separate calls SDK)
- `cometchat-android-v6-calls/SKILL.md`
- `cometchat-android-v6-calls/references/server-fcm-voip.md` — Compose-flavored server FCM
