# In-call chat on iOS

> **The iOS Calls SDK v5 has NO in-call chat button.** There is no `setHideChatButton` on `CallSettingsBuilder`, no `onChatButtonClicked` callback on `CallsEventsDelegate`, and no `CometChatCalls.setChatButtonUnreadCount(_:)`. None of these symbols exist — do not emit them.

In-call chat is therefore an **app-level composition**, not an SDK feature: you add your OWN chat button to your call UI, and present a sheet hosting the kit's `CometChatMessageList` + `CometChatMessageComposer` over a group keyed to the call's session ID. The Calls SDK is not involved.

**Canonical docs:** https://www.cometchat.com/docs/calls/ios/in-call-chat
**Read first:** `cometchat-react-calls/references/in-call-chat.md` — group-as-session architecture + anti-patterns.

---

## Your own chat button (the SDK provides none)

Add a button to your call control panel and present the sheet yourself. Track unread count in your own state (from a `CometChat.addMessageListener` on the session group) — there is no SDK badge API.

```swift
import CometChatSDK

// In your call UIViewController:
let chatButton = UIButton(type: .system)
chatButton.addAction(UIAction { [weak self] _ in
  self?.presentChatSheet()        // present on main; you're already on main here
}, for: .touchUpInside)

// Unread badge: maintain your own count from a message listener on the session group,
// and update chatButton's badge view. There is no CometChatCalls.setChatButtonUnreadCount.
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
    // Clear YOUR unread count on close (no SDK badge API exists).
    NotificationCenter.default.post(name: .inCallChatClosed, object: nil)
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

1. **Wiring `setHideChatButton` / `onChatButtonClicked` / `setChatButtonUnreadCount`.** None exist on iOS v5. Present your own button + sheet; track unread in your own state.
2. **`present(nav, animated: true)` from background queue.** Crash. Always main queue.
3. **Mutating `group` from background.** `group` updates must be on main; `Task { @MainActor in ... }` or `DispatchQueue.main.async`.
4. **Forgetting `dismiss(animated: true)` on call end.** Sheet stays up over the post-call screen — looks broken.

---

## Verification checklist

- [ ] Your OWN chat button presents the sheet (no `setHideChatButton`/`onChatButtonClicked`/`setChatButtonUnreadCount` — none exist)
- [ ] Sheet presented on main queue
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
