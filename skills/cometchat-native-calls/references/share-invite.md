# Share invite on React Native

Same SDK API as web. RN-specific: use the platform's native share sheet via `Share.share()` (built into RN) or `react-native-share` for richer options.

**Canonical docs:** https://www.cometchat.com/docs/calls/react-native/share-invite
**Read first:** `cometchat-react-calls/references/share-invite.md` — deep-link routing rule + dialog UX.

---

## Hard rule: deep-link routing

Same rule as web. Configure your app's URL scheme + universal/app links so `https://yourapp.com/call/:sessionId` opens the app:

```tsx
// App.tsx — react-navigation linking config
const linking = {
  prefixes: ["https://yourapp.com", "yourapp://"],
  config: {
    screens: {
      Call: "call/:sessionId",
    },
  },
};

<NavigationContainer linking={linking}>
  {/* ... */}
</NavigationContainer>
```

iOS: configure Associated Domains entitlement.
Android: add `<intent-filter>` with `android:autoVerify="true"` to `AndroidManifest.xml`.

Without these, share-invite URLs land in browser, not the app.

---

## SDK API

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-react-native";

// SessionSettings OBJECT field — there is NO setHideShareInviteButton builder method:
const callSettings = {
  hideShareInviteButton: false,
};

useEffect(() => {
  const handler = () => shareCallInvite(sessionId);
  // addEventListener returns the unsubscribe fn — call it on cleanup.
  const off = CometChatCalls.addEventListener("onShareInviteButtonClicked", handler);
  return () => off();
}, [sessionId]);
```

---

## Native share sheet

RN ships `Share` from `react-native`:

```tsx
import { Share, Platform } from "react-native";

async function shareCallInvite(sessionId: string) {
  const url = `https://yourapp.com/call/${sessionId}`;
  const message = "I'm on a call — tap to join.";

  try {
    const result = await Share.share({
      url: Platform.OS === "ios" ? url : undefined,  // iOS prefers `url`
      message: Platform.OS === "android" ? `${message}\n${url}` : message,
      title: "Join my call",  // Android only
    });

    if (result.action === Share.dismissedAction) {
      // User cancelled — silent
    }
  } catch (err) {
    console.warn("Share failed", err);
  }
}
```

`Share.share` opens iOS UIActivityViewController and Android's chooser intent. For both: pass `url` on iOS (separate field), append URL to `message` on Android (the `url` field is iOS-only).

---

## Clipboard fallback

```tsx
import Clipboard from "@react-native-clipboard/clipboard";
import { Alert } from "react-native";

async function copyLink(url: string) {
  Clipboard.setString(url);
  Alert.alert("Copied", "Call link copied to clipboard");
}
```

Most apps don't need this — `Share.share` always succeeds, even if no targets are available it shows the system "no apps installed" toast. Clipboard is a nice-to-have alongside the share sheet, not a fallback.

---

## react-native-share for richer UX

For per-channel buttons (just WhatsApp, just SMS, etc.):

```tsx
import Share from "react-native-share";

await Share.shareSingle({
  social: Share.Social.WHATSAPP,
  message: "Join my call",
  url: callLink,
});
```

Use only if your UX requires it. Native share sheet is usually enough.

---

## Anti-patterns

Web sister rules apply, plus RN-specific:

1. **Setting `url` on Android Share.share.** Android ignores it; URL doesn't appear in shared content. Concat to `message` instead.
2. **No deep-link config.** URL opens in browser → web fallback or 404.
3. **Sharing without `await`.** Caller doesn't know if the user cancelled, success messaging fires for cancelled shares.

---

## Verification checklist

- [ ] `react-navigation` `linking` config maps `/call/:sessionId`
- [ ] Universal links (iOS) + auto-verified app links (Android) configured
- [ ] `Share.share` URL field passed on iOS, concat'd to message on Android
- [ ] Listener cleaned up on unmount
- [ ] Real-device smoke: share via WhatsApp/Messages → tap → opens your app at the call

---

## Pointers

- `cometchat-react-calls/references/share-invite.md` — sister
- `cometchat-native-calls` SKILL.md
- Canonical docs: https://www.cometchat.com/docs/calls/react-native/share-invite
