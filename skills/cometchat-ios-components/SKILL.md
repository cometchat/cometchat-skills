---
name: cometchat-ios-components
description: "Complete catalog of CometChat iOS UI Kit v5 components with correct usage patterns from official documentation."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; CometChatSDK ^4; iOS 13+"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios swift components catalog reference ui-kit"
---

## Purpose

This is the single source of truth for CometChat iOS UI Kit v5 component names, properties, and usage patterns. All examples are based on official CometChat documentation.

All components are imported from `CometChatUIKitSwift`. All SDK types are imported from `CometChatSDK`.

---

## 1. CometChatConversations

A `UIViewController` that displays a scrollable list of the logged-in user's conversations.

**Usage:**
```swift
import CometChatUIKitSwift
import CometChatSDK

let conversationsVC = CometChatConversations()
let navController = UINavigationController(rootViewController: conversationsVC)

conversationsVC.set(onItemClick: { [weak navController] conversation, indexPath in
    let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
    if let group = conversation.conversationWith as? Group {
        messagesVC.set(group: group)
    } else if let user = conversation.conversationWith as? User {
        messagesVC.set(user: user)
    }
    navController?.pushViewController(messagesVC, animated: true)
})
```

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `style` | `ConversationsStyle` | Visual styling |
| `hideReceipts` | `Bool` | Hide message read receipts |
| `hideUserStatus` | `Bool` | Hide online/offline status |
| `disableTyping` | `Bool` | Disable typing indicators |
| `disableSoundForMessages` | `Bool` | Disable message sounds |

**Callbacks:**
| Callback | Method | Description |
|---|---|---|
| `onItemClick` | `set(onItemClick:)` | Conversation tapped |
| `onItemLongClick` | `set(onItemLongClick:)` | Conversation long-pressed |
| `onError` | `set(onError:)` | Error occurred |
| `onEmpty` | `set(onEmpty:)` | List is empty |
| `onLoad` | `set(onLoad:)` | Conversations loaded |

---

## 2. CometChatUsers

A `UIViewController` that displays a list of users.

**Usage:**
```swift
let usersVC = CometChatUsers()
let usersNav = UINavigationController(rootViewController: usersVC)

usersVC.set(onItemClick: { [weak usersNav] user, indexPath in
    let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
    messagesVC.set(user: user)
    usersNav?.pushViewController(messagesVC, animated: true)
})
```

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `style` | `UsersStyle` | Visual styling |
| `hideSearch` | `Bool` | Hide the built-in search bar (inherited from `CometChatListBase`; default `true`) |
| `hideUserStatus` | `Bool` | Hide online/offline indicator |
| `selectionMode` | `SelectionMode` | `.none`, `.single`, `.multiple` |

**Callbacks:**
| Callback | Method | Description |
|---|---|---|
| `onItemClick` | `set(onItemClick:)` | User tapped |
| `onSelection` | `set(onSelection:)` | Selection changed |
| `onError` | `set(onError:)` | Error occurred |

**Custom Subtitle View:**
```swift
import CometChatSDK

let usersVC = CometChatUsers()

// Custom subtitle with explicit type annotation
usersVC.set(subtitle: { (user: User?) -> UIView in
    let label = UILabel()
    label.font = .systemFont(ofSize: 13)
    if user?.status == .online {
        label.text = "Online"
        label.textColor = .systemGreen
    } else {
        label.text = "Offline"
        label.textColor = .secondaryLabel
    }
    return label
})
```

**Custom Request Builder:**
```swift
let usersVC = CometChatUsers()
usersVC.set(userRequestBuilder: UsersRequest.UsersRequestBuilder()
    .set(limit: 30)
    .set(searchKeyword: "john")
)
```

---

## 3. CometChatGroups

A `UIViewController` that displays a list of groups.

**Usage:**
```swift
let groupsVC = CometChatGroups()
let groupsNav = UINavigationController(rootViewController: groupsVC)

groupsVC.set(onItemClick: { [weak groupsNav] group, indexPath in
    let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
    messagesVC.set(group: group)
    groupsNav?.pushViewController(messagesVC, animated: true)
})
```

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `style` | `GroupsStyle` | Visual styling |
| `hideSearch` | `Bool` | Hide the built-in search bar (inherited from `CometChatListBase`; default `true`) |
| `selectionMode` | `SelectionMode` | `.none`, `.single`, `.multiple` |

**Callbacks:**
| Callback | Method | Description |
|---|---|---|
| `onItemClick` | `set(onItemClick:)` | Group tapped |
| `onSelection` | `set(onSelection:)` | Selection changed |
| `onError` | `set(onError:)` | Error occurred |

---

## 4. CometChatMessageHeader

A `UIView` that displays user/group info and back button at the top of a message view.

**Usage:**
```swift
private lazy var headerView: CometChatMessageHeader = {
    let view = CometChatMessageHeader()
    view.translatesAutoresizingMaskIntoConstraints = false
    if let user = user {
        view.set(user: user)
    } else if let group = group {
        view.set(group: group)
    }
    view.set(controller: self)
    return view
}()
```

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `style` | `MessageHeaderStyle` | Visual styling |
| `hideBackButton` | `Bool` | Hide back button |
| `hideVideoCallButton` | `Bool` | Hide video call button |
| `hideVoiceCallButton` | `Bool` | Hide voice call button |

**Important:** Always call `view.set(controller: self)` to enable navigation.

---

## 5. CometChatMessageList

A `UIView` that displays messages with real-time updates.

**Usage:**
```swift
private lazy var messageListView: CometChatMessageList = {
    let listView = CometChatMessageList()
    listView.translatesAutoresizingMaskIntoConstraints = false
    if let user = user {
        listView.set(user: user)
    } else if let group = group {
        listView.set(group: group)
    }
    listView.set(controller: self)
    return listView
}()
```

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `style` | `MessageListStyle` | Visual styling |
| `hideReceipts` | `Bool` | Hide read receipts |
| `hideDateSeparator` | `Bool` | Hide date separators |
| `hideAvatar` | `Bool` | Hide sender avatars |
| `scrollToBottomOnNewMessages` | `Bool` | Auto-scroll on new messages |
| `messageAlignment` | `MessageListAlignment` | `.standard` or `.leftAligned` |

**Important:** Always call `listView.set(controller: self)` for proper functionality.

---

## 6. CometChatMessageComposer

A `UIView` for composing and sending messages.

**Usage:**
```swift
private lazy var composerView: CometChatMessageComposer = {
    let composer = CometChatMessageComposer()
    composer.translatesAutoresizingMaskIntoConstraints = false
    if let user = user {
        composer.set(user: user)
    } else if let group = group {
        composer.set(group: group)
    }
    composer.set(controller: self)
    return composer
}()
```

**Key Properties:**
| Property | Type | Description |
|---|---|---|
| `style` | `MessageComposerStyle` | Visual styling |
| `placeholderText` | `String` | Placeholder text |
| `hideVoiceRecordingButton` | `Bool` | Hide voice recording button |
| `hideAttachmentButton` | `Bool` | Hide attachment button |
| `hideStickersButton` | `Bool` | Hide stickers button |

**Important:** Always call `composer.set(controller: self)` for proper functionality.

---

## 7. CometChatCallLogs

A `UIViewController` that displays call history.

**Requires:** `CometChatCallsSDK`

**Usage:**
```swift
#if canImport(CometChatCallsSDK)
let callLogsVC = CometChatCallLogs()
let callLogsNav = UINavigationController(rootViewController: callLogsVC)
#endif
```

---

## 8. CometChatGroupMembers

A `UIViewController` that displays members of a specific group.

**Usage:**
```swift
// CometChatGroupMembers has a zero-arg initializer; pass the group via
// `set(group:)`. There is no `CometChatGroupMembers(group:)` initializer.
let groupMembers = CometChatGroupMembers()
groupMembers.set(group: group)
navigationController?.pushViewController(groupMembers, animated: true)
```

---

## 9. User / Group details — build your own VC

There is **no `CometChatDetails` view controller exported by the kit.** The sample app builds a details screen by composing avatar, list rows, and action sheets directly. Follow the same pattern in your app — `SampleApp/View Controllers/DetailsPage/UserDetailsViewController.swift` is a reasonable starting point to copy.

---

## 10. CometChatUIKit

Static class for initialization and authentication.

**Initialization:**
```swift
let uikitSettings = UIKitSettings()
    .set(appID: "APP_ID")
    .set(region: "REGION")
    .set(authKey: "AUTH_KEY")
    .subscribePresenceForAllUsers()
    .build()

// Init takes a `UIKitSettings` and a `Result<Bool, Error>` completion.
// Both `CometChatUIKit(uiKitSettings: ...) { ... }` (constructor form)
// and `CometChatUIKit.init(uiKitSettings: ...) { ... }` (explicit `.init`
// call) compile to the same thing in Swift; the kit's sample apps use
// the `.init` form, so don't be alarmed if you see both. See
// cometchat-ios-core § 2 for the recommended singleton pattern.
CometChatUIKit(uiKitSettings: uikitSettings) { result in
    switch result {
    case .success:
        debugPrint("CometChat initialized")
    case .failure(let error):
        debugPrint("Init failed: \(error.localizedDescription)")
    }
}
```

**Login:**
```swift
CometChatUIKit.login(uid: "cometchat-uid-1") { result in
    switch result {
    case .success(let user):
        print("Login successful: \(user.name ?? "")")
    case .onError(let error):
        print("Login failed: \(error.errorDescription)")
    @unknown default:
        break
    }
}
```

**Logout:**
```swift
if let currentUser = CometChat.getLoggedInUser() {
    CometChatUIKit.logout(user: currentUser) { result in
        switch result {
        case .success:
            print("Logged out successfully")
        case .onError(let error):
            print("Logout failed: \(error.errorDescription)")
        @unknown default:
            break
        }
    }
}
```

---

## 11. Composing a chat screen — `MessagesVC`

The kit does **not** ship a `CometChatMessages` or `CometChatConversationsWithMessages` view controller. The standard pattern (and what the sample app uses) is to compose `CometChatMessageHeader` + `CometChatMessageList` + `CometChatMessageComposer` inside your own `UIViewController`. See § 12 below for the full implementation — it's ~50 lines and gives you full control over navigation and lifecycle.

If you previously read about a "pre-built `CometChatMessages` UIViewController" in older docs or AI-generated guides, that was incorrect. Always build your own `MessagesVC` as shown in § 12 (or copy `SampleApp/View Controllers/CometChat Components/MessagesVC.swift` from the kit's sample app).

---

## 12. Custom MessagesVC Implementation

If you need more control over the messaging UI, create a custom view controller that combines header, list, and composer:

```swift
import UIKit
import CometChatSDK
import CometChatUIKitSwift

class MessagesVC: UIViewController {
    
    // MARK: - Properties
    var user: User?
    var group: Group?
    
    // MARK: - UI Components
    private lazy var headerView: CometChatMessageHeader = {
        let view = CometChatMessageHeader()
        view.translatesAutoresizingMaskIntoConstraints = false
        if let user = user {
            view.set(user: user)
        } else if let group = group {
            view.set(group: group)
        }
        view.set(controller: self)
        return view
    }()
    
    private lazy var messageListView: CometChatMessageList = {
        let listView = CometChatMessageList()
        listView.translatesAutoresizingMaskIntoConstraints = false
        if let user = user {
            listView.set(user: user)
        } else if let group = group {
            listView.set(group: group)
        }
        listView.set(controller: self)
        return listView
    }()
    
    private lazy var composerView: CometChatMessageComposer = {
        let composer = CometChatMessageComposer()
        composer.translatesAutoresizingMaskIntoConstraints = false
        if let user = user {
            composer.set(user: user)
        } else if let group = group {
            composer.set(group: group)
        }
        composer.set(controller: self)
        return composer
    }()
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        setupLayout()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        navigationController?.setNavigationBarHidden(false, animated: true)
    }
    
    // MARK: - Setup
    private func configureView() {
        view.backgroundColor = .systemBackground
        navigationController?.setNavigationBarHidden(true, animated: false)
    }
    
    private func setupLayout() {
        [headerView, messageListView, composerView].forEach { view.addSubview($0) }
        
        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 50),
            
            messageListView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            messageListView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            messageListView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            messageListView.bottomAnchor.constraint(equalTo: composerView.topAnchor),
            
            composerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            composerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            composerView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
    }
}
```

---

## 14. Complete Tab-Based Chat App

Full implementation of a tabbed chat app with Chats, Calls, Users, and Groups:

```swift
import UIKit
import CometChatUIKitSwift
import CometChatSDK

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        let uikitSettings = UIKitSettings()
            .set(appID: "APP_ID")
            .set(region: "REGION")
            .set(authKey: "AUTH_KEY")
            .subscribePresenceForAllUsers()
            .build()

        CometChatUIKit.init(uiKitSettings: uikitSettings) { result in
            switch result {
            case .success:
                CometChatUIKit.login(uid: "cometchat-uid-1") { loginResult in
                    switch loginResult {
                    case .success:
                        DispatchQueue.main.async {
                            self.setupTabbedView(windowScene: windowScene)
                        }
                    case .onError(let error):
                        print("Login failed: \(error.errorDescription)")
                    @unknown default:
                        break
                    }
                }
            case .failure(let error):
                print("Init failed: \(error)")
            }
        }
    }

    func setupTabbedView(windowScene: UIWindowScene) {
        let tabBarController = UITabBarController()
        tabBarController.tabBar.backgroundColor = .white
        
        // Conversations Tab
        let conversationsVC = CometChatConversations()
        let conversationsNav = UINavigationController(rootViewController: conversationsVC)
        conversationsVC.tabBarItem = UITabBarItem(
            title: "CHATS",
            image: UIImage(systemName: "message.fill"),
            tag: 0
        )
        
        conversationsVC.set(onItemClick: { [weak conversationsNav] conversation, indexPath in
            let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
            if let group = conversation.conversationWith as? Group {
                messagesVC.set(group: group)
            } else if let user = conversation.conversationWith as? User {
                messagesVC.set(user: user)
            }
            messagesVC.hidesBottomBarWhenPushed = true
            conversationsNav?.pushViewController(messagesVC, animated: true)
        })
        
        // Call Logs Tab
        #if canImport(CometChatCallsSDK)
        let callLogsVC = CometChatCallLogs()
        let callLogsNav = UINavigationController(rootViewController: callLogsVC)
        callLogsVC.tabBarItem = UITabBarItem(
            title: "CALLS",
            image: UIImage(systemName: "phone.fill"),
            tag: 1
        )
        #endif
        
        // Users Tab
        let usersVC = CometChatUsers()
        let usersNav = UINavigationController(rootViewController: usersVC)
        usersVC.tabBarItem = UITabBarItem(
            title: "USERS",
            image: UIImage(systemName: "person.2.fill"),
            tag: 2
        )
        
        usersVC.set(onItemClick: { [weak usersNav] user, indexPath in
            let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
            messagesVC.set(user: user)
            messagesVC.hidesBottomBarWhenPushed = true
            usersNav?.pushViewController(messagesVC, animated: true)
        })
        
        // Groups Tab
        let groupsVC = CometChatGroups()
        let groupsNav = UINavigationController(rootViewController: groupsVC)
        groupsVC.tabBarItem = UITabBarItem(
            title: "GROUPS",
            image: UIImage(systemName: "person.3.fill"),
            tag: 3
        )
        
        groupsVC.set(onItemClick: { [weak groupsNav] group, indexPath in
            let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
            messagesVC.set(group: group)
            messagesVC.hidesBottomBarWhenPushed = true
            groupsNav?.pushViewController(messagesVC, animated: true)
        })
        
        #if canImport(CometChatCallsSDK)
        tabBarController.viewControllers = [conversationsNav, callLogsNav, usersNav, groupsNav]
        #else
        tabBarController.viewControllers = [conversationsNav, usersNav, groupsNav]
        #endif
        
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = tabBarController
        window?.makeKeyAndVisible()
    }
}
```

---

## 15. Shared UI Components

### CometChatAvatar
```swift
let avatar = CometChatAvatar()
avatar.setAvatar(avatarUrl: user.avatar ?? "", with: user.name)
```

### CometChatBadge
```swift
let badge = CometChatBadge()
badge.set(count: 5)
```

### CometChatStatusIndicator
```swift
let statusIndicator = CometChatStatusIndicator()
statusIndicator.set(status: .online)
```

---

## 16. AI Components

### CometChatAIConversationStarter
Displays AI-suggested conversation starters.

### CometChatAISmartReply
Displays AI-suggested quick replies.

### CometChatAIConversationSummary
Displays AI-generated conversation summary.

---

## 17. Extensions

### CometChatPollsBubble
Renders poll messages.

### CometChatStickerKeyboard
Sticker picker keyboard.

### CometChatLinkPreviewBubble
Renders URL link previews.

---

## 18. SwiftUI Integration

Wrap UIKit components for SwiftUI:

```swift
import SwiftUI
import CometChatUIKitSwift
import CometChatSDK

struct ConversationsView: UIViewControllerRepresentable {
    @Binding var selectedConversation: Conversation?
    
    func makeUIViewController(context: Context) -> UINavigationController {
        let conversationsVC = CometChatConversations()
        conversationsVC.set(onItemClick: { conversation, _ in
            selectedConversation = conversation
        })
        return UINavigationController(rootViewController: conversationsVC)
    }
    
    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}
}
```
