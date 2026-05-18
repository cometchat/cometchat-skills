# In-call chat on iOS

Same SDK shape as web. iOS-specific: `UISheetPresentationController` for the chat sheet (iOS 15+) + AVAudioSession ducking when keyboard is open.

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/in-call-chat
**Read first:** `cometchat-react-calls/references/in-call-chat.md` — group-as-session architecture + anti-patterns.

---

## SDK API

```swift
import CometChatCallsSDK
import CometChatSDK

let settings = CallSettingsBuilder()
  .setSessionType(.video)
  .setHideChatButton(false)
  .build()

// Chat button event — implement in your CometChatCallsEventsListener
func onChatButtonClicked() {
  DispatchQueue.main.async {
    self.presentChatSheet()
  }
}

// Unread badge
CometChatCalls.setChatButtonUnreadCount(5)
CometChatCalls.setChatButtonUnreadCount(0)
```

---

## Sheet presentation (iOS 15+)

```swift
import UIKit

class CallViewController: UIViewController {
  func presentChatSheet() {
    let chatVC = InCallChatViewController(sessionId: sessionId)
    let nav = UINavigationController(rootViewController: chatVC)

    if #available(iOS 15.0, *) {
      if let sheet = nav.sheetPresentationController {
        sheet.detents = [.medium(), .large()]
        sheet.prefersGrabberVisible = true
        sheet.preferredCornerRadius = 16
      }
    }

    present(nav, animated: true)
  }
}
```

`.detents = [.medium(), .large()]` is iOS 15+'s pull-up sheet API. Matches the BottomSheet UX from RN/Flutter.

---

## InCallChatViewController

```swift
class InCallChatViewController: UIViewController {
  let sessionId: String
  private var group: Group?
  private var listenerId: String!

  init(sessionId: String) {
    self.sessionId = sessionId
    super.init(nibName: nil, bundle: nil)
    self.title = "Chat"
  }
  required init?(coder: NSCoder) { fatalError() }

  override func viewDidLoad() {
    super.viewDidLoad()
    listenerId = "in-call-chat-\(sessionId)"

    Task {
      do {
        group = try await ensureGroup(sessionId: sessionId)
        try await joinGroup(sessionId: sessionId)
        await MainActor.run {
          self.embedMessageList()
        }
      } catch {
        print("Failed to set up in-call chat:", error)
      }
    }
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    // Clear badge on close
    CometChatCalls.setChatButtonUnreadCount(0)
  }

  private func embedMessageList() {
    guard let group = group else { return }
    // The kit's CometChatMessageList is a UIViewController
    let messageList = CometChatMessageList()
    messageList.group = group
    addChild(messageList)
    view.addSubview(messageList.view)
    // ... AutoLayout pinning to fill view
    messageList.didMove(toParent: self)

    // Composer
    let composer = CometChatMessageComposer()
    composer.group = group
    addChild(composer)
    view.addSubview(composer.view)
    // ... AutoLayout pinning to bottom
    composer.didMove(toParent: self)
  }
}

func ensureGroup(sessionId: String) async throws -> Group {
  do {
    return try await fetchGroup(sessionId)   // CometChat.getGroup wrapper
  } catch {
    let group = Group(guid: sessionId, name: "Call \(sessionId)", groupType: .public, password: "")
    return try await createGroup(group)
  }
}
```

---

## Audio ducking when keyboard opens

iOS auto-ducks call audio when the system keyboard opens (the kit handles this). For custom UI you may want to maintain unducked audio for the whole call — explicit override:

```swift
NotificationCenter.default.addObserver(
  forName: UIResponder.keyboardWillShowNotification,
  object: nil, queue: .main
) { _ in
  // Re-assert non-ducking audio category
  try? AVAudioSession.sharedInstance().setCategory(
    .playAndRecord,
    mode: .voiceChat,
    options: [.allowBluetooth, .defaultToSpeaker]
  )
}
```

Most apps don't need this; the kit's defaults are sensible. Override only if user testing surfaces the audio ducking as confusing.

---

## Anti-patterns

Web sister rules apply, plus iOS-specific:

1. **`UIAlertController` instead of sheet for in-call chat.** Wrong UX — `UIAlertController` is for confirmations, not extended UIs.
2. **`present(nav, animated: true)` from background queue.** Crash. Always main queue (covered by `DispatchQueue.main.async` in `onChatButtonClicked`).
3. **Mutating `group` from background.** `group` updates must be on main; `Task { @MainActor in ... }` or `DispatchQueue.main.async`.
4. **Forgetting `dismiss(animated: true)` on call end.** Sheet stays up over the post-call screen — looks broken.

---

## Verification checklist

- [ ] `setHideChatButton(false)` in CallSettings
- [ ] `onChatButtonClicked` presents the chat sheet on main queue
- [ ] `UISheetPresentationController` with `[.medium(), .large()]` detents (iOS 15+)
- [ ] `CometChatMessageList` + `CometChatMessageComposer` embedded as child VCs
- [ ] Sheet dismissed on call end
- [ ] Real-device smoke: 2 iPhones in call, send message → badge in other
- [ ] Sheet drag-down dismisses cleanly
- [ ] Lock-screen smoke: backgrounded → return → chat sheet still visible if open

---

## Pointers

- `cometchat-react-calls/references/in-call-chat.md` — sister web reference (group-as-session pattern)
- `cometchat-ios-calls` SKILL.md — the seven hard rules
- `references/swiftui-uikit-hosting.md` — embedding SwiftUI sheets
- Canonical docs: https://www.cometchat.com/docs/calls/ios/in-call-chat
