# Share invite on Flutter V5 (GetX)

Same SDK API. Flutter-specific: `share_plus` package wraps both iOS UIActivityViewController and Android Intent.ACTION_SEND under one cross-platform API.

**Canonical docs:** https://www.cometchat.com/docs/calls/flutter/share-invite
**Read first:** `cometchat-react-calls/references/share-invite.md` — deep-link rule, dialog UX.

---

## Dependencies

```yaml
dependencies:
  share_plus: ^10.0.0
  uni_links: ^0.5.1   # for deep-link handling
```

---

## Hard rule: deep-link routing

Configure both platforms:

**iOS** (`ios/Runner/Info.plist`):
```xml
<key>com.apple.developer.associated-domains</key>
<array><string>applinks:yourapp.com</string></array>
```
Plus apple-app-site-association on your domain (see iOS reference).

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<activity android:name=".MainActivity" ...>
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https"
          android:host="yourapp.com"
          android:pathPrefix="/call" />
  </intent-filter>
</activity>
```

Plus the corresponding `assetlinks.json` on your domain.

Handle in app:
```dart
void initDeepLinks() {
  uriLinkStream.listen((Uri? uri) {
    if (uri == null) return;
    if (uri.pathSegments.length >= 2 && uri.pathSegments[0] == 'call') {
      final sessionId = uri.pathSegments[1];
      Get.toNamed('/call/$sessionId');
    }
  });
}
```

---

## SDK API

```dart
final settings = CallSettingsBuilder()
  ..setHideShareInviteButton(false);

@override
void onShareInviteButtonClicked() {
  Get.find<ShareInviteController>().share(sessionId);
}
```

---

## share_plus

```dart
import 'package:share_plus/share_plus.dart';

class ShareInviteController extends GetxController {
  Future<void> share(String sessionId) async {
    final url = 'https://yourapp.com/call/$sessionId';
    final result = await Share.share(
      "I'm on a call — tap to join.\n$url",
      subject: 'Join my call',  // Android: title; iOS: ignored
    );

    if (result.status == ShareResultStatus.success) {
      // logged + maybe haptic feedback
    }
    // dismissed/unavailable: silent
  }
}
```

`Share.share` opens iOS UIActivityViewController on iOS and the Android chooser on Android. The same call works on both.

---

## iPad popover anchor

`share_plus` requires a source rect on iPad:

```dart
final box = context.findRenderObject() as RenderBox?;
await Share.share(
  text,
  sharePositionOrigin: box != null ? box.localToGlobal(Offset.zero) & box.size : null,
);
```

Pass `sharePositionOrigin` from the button's render box. Without it, share sheet crashes on iPad.

---

## Anti-patterns

Web sister rules apply, plus Flutter-specific:

1. **Calling `Share.share` without iPad anchor.** Crash on iPad in production.
2. **Hard-coding URL.** Use `dotenv` or `--dart-define=APP_URL=...`.
3. **No deep-link config for both platforms.** Only iOS works (or only Android), not both — partial UX.

---

## Verification checklist

- [ ] `share_plus` installed
- [ ] Associated Domains (iOS) + auto-verified app links (Android) configured
- [ ] `assetlinks.json` + `apple-app-site-association` hosted
- [ ] `Share.share` called with `sharePositionOrigin` for iPad
- [ ] App URL via env, not hard-coded
- [ ] Real-device smoke: share via Messages on iOS, WhatsApp on Android → opens app

---

## Pointers

- `cometchat-react-calls/references/share-invite.md` — sister
- `cometchat-flutter-v5-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/flutter/share-invite
