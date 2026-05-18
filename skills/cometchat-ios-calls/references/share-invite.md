# Share invite on iOS

Same SDK API. iOS-specific: `UIActivityViewController` is the native share sheet (handles iMessage, Mail, AirDrop, third-party apps). Universal Links must be configured for the call link to deep into the app.

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/share-invite
**Read first:** `cometchat-react-calls/references/share-invite.md` — deep-link rule + share dialog UX.

---

## Hard rule: Universal Links + apple-app-site-association

For `https://yourapp.com/call/SESSION_ID` to open your app:

1. Add `Associated Domains` capability with `applinks:yourapp.com`
2. Host `apple-app-site-association` JSON at `https://yourapp.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAMID.com.yourapp.bundle",
      "paths": ["/call/*"]
    }]
  }
}
```

3. In `SceneDelegate` / `AppDelegate`, handle `NSUserActivity` with `activityType == NSUserActivityTypeBrowsingWeb`:

```swift
func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
  guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
        let url = userActivity.webpageURL,
        url.pathComponents.count >= 3,
        url.pathComponents[1] == "call" else { return }
  let sessionId = url.pathComponents[2]
  router.routeToCall(sessionId: sessionId)
}
```

Without these, share-invite URLs open in Safari instead of your app.

---

## SDK API

```swift
let settings = CallSettingsBuilder()
  .setHideShareInviteButton(false)
  .build()

class CallEvents: CometChatCallsEventsListener {
  func onShareInviteButtonClicked() {
    DispatchQueue.main.async {
      self.shareCallInvite()
    }
  }
}
```

---

## UIActivityViewController

```swift
extension CallViewController {
  func shareCallInvite() {
    let url = URL(string: "https://yourapp.com/call/\(sessionId)")!
    let title = "Join my call"
    let text = "I'm on a call — tap to join."

    let items: [Any] = [text, url]
    let activityVC = UIActivityViewController(
      activityItems: items,
      applicationActivities: nil
    )

    // Optional: exclude activities you don't want
    activityVC.excludedActivityTypes = [.assignToContact, .saveToCameraRoll]

    // iPad: must set source for popover
    if let popover = activityVC.popoverPresentationController {
      popover.sourceView = self.view
      popover.sourceRect = CGRect(
        x: self.view.bounds.midX,
        y: self.view.bounds.midY,
        width: 0,
        height: 0
      )
      popover.permittedArrowDirections = []
    }

    present(activityVC, animated: true)
  }
}
```

iOS auto-renders link preview if your URL has Open Graph tags + universal-link routing — the share sheet shows app icon + name + "Join my call" instead of a raw URL.

---

## SwiftUI ShareLink (iOS 16+)

If you build the share button yourself in SwiftUI:

```swift
import SwiftUI

struct CallShareButton: View {
  let sessionId: String

  var body: some View {
    let url = URL(string: "https://yourapp.com/call/\(sessionId)")!
    ShareLink(item: url, subject: Text("Join my call"), message: Text("I'm on a call — tap to join.")) {
      Label("Share invite", systemImage: "square.and.arrow.up")
    }
  }
}
```

---

## Anti-patterns

Web sister rules apply, plus iOS-specific:

1. **iPad without `popoverPresentationController.sourceView`.** Crashes on iPad — popover requires an anchor.
2. **`UIPasteboard.general.string = url.absoluteString` instead of UIActivityVC.** Skips iOS's curated share sheet — bad UX.
3. **Universal Links not configured.** Recipients tap link → opens Safari, not your app.
4. **`activityItems: [url]` without title text.** Recipients see just a URL, no context.
5. **Presenting from background queue.** Crash. Always main.

---

## Verification checklist

- [ ] Associated Domains entitlement added
- [ ] `apple-app-site-association` JSON hosted + reachable
- [ ] `NSUserActivity` continuation in SceneDelegate routes to call
- [ ] `UIActivityViewController` (UIKit) or `ShareLink` (SwiftUI 16+) used
- [ ] iPad popover anchored
- [ ] Real-device smoke: share via Messages → tap from another iPhone → opens your app at call

---

## Pointers

- `cometchat-react-calls/references/share-invite.md` — sister
- `cometchat-ios-calls` SKILL.md — seven hard rules
- `references/universal-links.md`
- Canonical docs: https://www.cometchat.com/docs/calls/ios/share-invite
