---
name: cometchat-ios-placement
description: "WHERE to put CometChat in your iOS app — navigation patterns, tab bars, modals, and embedded views."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; iOS 13+"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios placement navigation tabs modal patterns"
---

## Purpose

This skill teaches WHERE to place CometChat components in your iOS app. It covers navigation patterns, tab bar integration, modal presentations, and embedded views for different use cases.

---

## 1. Navigation Stack Pattern

The most common pattern for messaging apps. Push conversations onto a navigation stack.

### Basic Navigation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  UINavigationController                                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  CometChatConversations                                 ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  Conversation 1                                     │││
│  │  │  Conversation 2  ──────────────────────────────────►│││
│  │  │  Conversation 3                                     │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MessagesViewController (pushed)                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  CometChatMessageHeader                                 ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  CometChatMessageList                                   ││
│  │                                                         ││
│  │                                                         ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  CometChatMessageComposer                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Implementation (UIKit)

```swift
// SceneDelegate.swift
func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = (scene as? UIWindowScene) else { return }
    
    let window = UIWindow(windowScene: windowScene)
    
    // Create conversations list
    let conversations = CometChatConversations()
    conversations.set(onItemClick: { [weak conversations] conversation, _ in
        let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
        if let user = conversation.conversationWith as? User {
            messagesVC.set(user: user)
        } else if let group = conversation.conversationWith as? Group {
            messagesVC.set(group: group)
        }
        conversations?.navigationController?.pushViewController(messagesVC, animated: true)
    })
    
    // Wrap in navigation controller
    let navController = UINavigationController(rootViewController: conversations)
    
    window.rootViewController = navController
    self.window = window
    window.makeKeyAndVisible()
}
```

### Implementation (SwiftUI)

```swift
import SwiftUI
import CometChatUIKitSwift
import CometChatSDK

struct ChatNavigationView: View {
    @State private var selectedConversation: Conversation?
    @State private var showMessages = false
    
    var body: some View {
        NavigationStack {
            ConversationsListView(selectedConversation: $selectedConversation)
                .navigationDestination(isPresented: $showMessages) {
                    if let conversation = selectedConversation {
                        MessagesView(conversation: conversation)
                    }
                }
                .onChange(of: selectedConversation) { newValue in
                    showMessages = newValue != nil
                }
        }
    }
}

struct ConversationsListView: UIViewControllerRepresentable {
    @Binding var selectedConversation: Conversation?
    
    func makeUIViewController(context: Context) -> CometChatConversations {
        let conversations = CometChatConversations()
        conversations.onItemClick = { conversation, _ in
            selectedConversation = conversation
        }
        return conversations
    }
    
    func updateUIViewController(_ uiViewController: CometChatConversations, context: Context) {}
}
```

---

## 2. Tab Bar Pattern

For apps where chat is one of several main features.

### Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    Content Area                             │
│                                                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐              │
│  │Home │  │Chats│  │Users│  │Groups│ │Calls│              │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation (UIKit)

```swift
import UIKit
import CometChatUIKitSwift
import CometChatSDK

class MainTabBarController: UITabBarController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupTabs()
    }
    
    private func setupTabs() {
        // Home tab (your existing content)
        let homeVC = HomeViewController()
        homeVC.tabBarItem = UITabBarItem(
            title: "Home",
            image: UIImage(systemName: "house"),
            selectedImage: UIImage(systemName: "house.fill")
        )
        
        // Chats tab
        let chatsVC = createChatsTab()
        let chatsNav = UINavigationController(rootViewController: chatsVC)
        chatsNav.tabBarItem = UITabBarItem(
            title: "Chats",
            image: UIImage(systemName: "message"),
            selectedImage: UIImage(systemName: "message.fill")
        )
        
        // Users tab
        let usersVC = CometChatUsers()
        usersVC.set(onItemClick: { [weak self] user, _ in
            self?.openMessages(with: user)
        })
        let usersNav = UINavigationController(rootViewController: usersVC)
        usersNav.tabBarItem = UITabBarItem(
            title: "Users",
            image: UIImage(systemName: "person.2"),
            selectedImage: UIImage(systemName: "person.2.fill")
        )
        
        // Groups tab
        let groupsVC = CometChatGroups()
        groupsVC.set(onItemClick: { [weak self] group, _ in
            self?.openMessages(with: group)
        })
        let groupsNav = UINavigationController(rootViewController: groupsVC)
        groupsNav.tabBarItem = UITabBarItem(
            title: "Groups",
            image: UIImage(systemName: "person.3"),
            selectedImage: UIImage(systemName: "person.3.fill")
        )
        
        var tabs: [UIViewController] = [
            UINavigationController(rootViewController: homeVC),
            chatsNav,
            usersNav,
            groupsNav
        ]
        
        // Calls tab - only available if CometChatCallsSDK is installed
        #if canImport(CometChatCallsSDK)
        let callsVC = CometChatCallLogs()
        let callsNav = UINavigationController(rootViewController: callsVC)
        callsNav.tabBarItem = UITabBarItem(
            title: "Calls",
            image: UIImage(systemName: "phone"),
            selectedImage: UIImage(systemName: "phone.fill")
        )
        tabs.append(callsNav)
        #endif
        
        viewControllers = tabs
    }
    
    private func createChatsTab() -> CometChatConversations {
        let conversations = CometChatConversations()
        conversations.set(onItemClick: { [weak self] conversation, _ in
            if let user = conversation.conversationWith as? User {
                self?.openMessages(with: user)
            } else if let group = conversation.conversationWith as? Group {
                self?.openMessages(with: group)
            }
        })
        return conversations
    }
    
    private func openMessages(with user: User) {
        let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
        messagesVC.set(user: user)
        messagesVC.hidesBottomBarWhenPushed = true
        
        if let navController = selectedViewController as? UINavigationController {
            navController.pushViewController(messagesVC, animated: true)
        }
    }
    
    private func openMessages(with group: Group) {
        let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
        messagesVC.set(group: group)
        messagesVC.hidesBottomBarWhenPushed = true
        
        if let navController = selectedViewController as? UINavigationController {
            navController.pushViewController(messagesVC, animated: true)
        }
    }
}
```

### Implementation (SwiftUI)

```swift
struct MainTabView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house")
                }
                .tag(0)
            
            ChatNavigationView()
                .tabItem {
                    Label("Chats", systemImage: "message")
                }
                .tag(1)
            
            UsersNavigationView()
                .tabItem {
                    Label("Users", systemImage: "person.2")
                }
                .tag(2)
            
            GroupsNavigationView()
                .tabItem {
                    Label("Groups", systemImage: "person.3")
                }
                .tag(3)
            
            CallsNavigationView()
                .tabItem {
                    Label("Calls", systemImage: "phone")
                }
                .tag(4)
        }
    }
}
```

---

## 3. Modal Presentation Pattern

For apps where chat is a secondary feature, presented modally.

### Modal Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Your App Content                                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Product Details                                        ││
│  │                                                         ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  [Chat with Seller]  ◄─────────────────────────────│││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (modal presentation)
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [X]  Chat with John                                    ││
│  ├─────────────────────────────────────────────────────────┤│
│  │                                                         ││
│  │  Messages                                               ││
│  │                                                         ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Composer                                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Implementation (UIKit)

```swift
class ProductDetailViewController: UIViewController {
    
    var sellerUID: String?
    
    @IBAction func chatWithSellerTapped(_ sender: UIButton) {
        guard let sellerUID = sellerUID else { return }
        
        // Fetch the seller user
        CometChat.getUser(UID: sellerUID) { [weak self] user in
            guard let user = user else { return }
            
            DispatchQueue.main.async {
                let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
                messagesVC.set(user: user)
                
                let navController = UINavigationController(rootViewController: messagesVC)
                navController.modalPresentationStyle = .pageSheet
                
                // Add close button
                messagesVC.navigationItem.leftBarButtonItem = UIBarButtonItem(
                    barButtonSystemItem: .close,
                    target: self,
                    action: #selector(self?.dismissChat)
                )
                
                self?.present(navController, animated: true)
            }
        } onError: { error in
            print("Error fetching user: \(error?.errorDescription ?? "")")
        }
    }
    
    @objc private func dismissChat() {
        dismiss(animated: true)
    }
}
```

### Implementation (SwiftUI)

```swift
struct ProductDetailView: View {
    let sellerUID: String
    @State private var showChat = false
    @State private var seller: User?
    
    var body: some View {
        VStack {
            // Product details...
            
            Button("Chat with Seller") {
                fetchSellerAndShowChat()
            }
            .buttonStyle(.borderedProminent)
        }
        .sheet(isPresented: $showChat) {
            if let seller = seller {
                NavigationStack {
                    MessagesView(user: seller)
                        .toolbar {
                            ToolbarItem(placement: .navigationBarLeading) {
                                Button("Close") {
                                    showChat = false
                                }
                            }
                        }
                }
            }
        }
    }
    
    private func fetchSellerAndShowChat() {
        CometChat.getUser(UID: sellerUID) { user in
            DispatchQueue.main.async {
                self.seller = user
                self.showChat = true
            }
        } onError: { error in
            print("Error: \(error?.errorDescription ?? "")")
        }
    }
}
```

---

## 4. Floating Button Pattern

For support chat or quick access to messages.

### Floating Button Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Your App Content                                           │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│                                                     ┌─────┐ │
│                                                     │ 💬  │ │
│                                                     └─────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Implementation (UIKit)

```swift
class FloatingChatButton: UIButton {
    
    private var unreadCount: Int = 0 {
        didSet {
            updateBadge()
        }
    }
    
    private lazy var badgeLabel: UILabel = {
        let label = UILabel()
        label.backgroundColor = .systemRed
        label.textColor = .white
        label.font = .systemFont(ofSize: 12, weight: .bold)
        label.textAlignment = .center
        label.layer.cornerRadius = 10
        label.clipsToBounds = true
        label.isHidden = true
        return label
    }()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupButton()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupButton()
    }
    
    private func setupButton() {
        backgroundColor = .systemBlue
        layer.cornerRadius = 28
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 4)
        layer.shadowRadius = 8
        layer.shadowOpacity = 0.3
        
        setImage(UIImage(systemName: "message.fill"), for: .normal)
        tintColor = .white
        
        addSubview(badgeLabel)
        badgeLabel.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            badgeLabel.topAnchor.constraint(equalTo: topAnchor, constant: -5),
            badgeLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: 5),
            badgeLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 20),
            badgeLabel.heightAnchor.constraint(equalToConstant: 20)
        ])
    }
    
    private func updateBadge() {
        badgeLabel.isHidden = unreadCount == 0
        badgeLabel.text = unreadCount > 99 ? "99+" : "\(unreadCount)"
    }
    
    func setUnreadCount(_ count: Int) {
        unreadCount = count
    }
}

// Usage in a view controller
class MainViewController: UIViewController {
    
    private lazy var chatButton: FloatingChatButton = {
        let button = FloatingChatButton()
        button.addTarget(self, action: #selector(openChat), for: .touchUpInside)
        return button
    }()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupFloatingButton()
    }
    
    private func setupFloatingButton() {
        view.addSubview(chatButton)
        chatButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            chatButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            chatButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            chatButton.widthAnchor.constraint(equalToConstant: 56),
            chatButton.heightAnchor.constraint(equalToConstant: 56)
        ])
    }
    
    @objc private func openChat() {
        let conversations = CometChatConversations()
        conversations.set(onItemClick: { [weak self] conversation, _ in
            let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
            if let user = conversation.conversationWith as? User {
                messagesVC.set(user: user)
            } else if let group = conversation.conversationWith as? Group {
                messagesVC.set(group: group)
            }
            conversations.navigationController?.pushViewController(messagesVC, animated: true)
        })
        
        let navController = UINavigationController(rootViewController: conversations)
        navController.modalPresentationStyle = .pageSheet
        
        conversations.navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(dismissChat)
        )
        
        present(navController, animated: true)
    }
    
    @objc private func dismissChat() {
        dismiss(animated: true)
    }
}
```

---

## 5. Split View Pattern (iPad)

For iPad apps with master-detail layout.

### Split View Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────┐  ┌─────────────────────────────────────────────┐│
│  │  Conversations          │  │  Messages                                   ││
│  │  ┌─────────────────────┐│  │  ┌─────────────────────────────────────────┐││
│  │  │  John Doe           ││  │  │  Header                                 │││
│  │  │  Jane Smith  ◄──────┼┼──┼──┤─────────────────────────────────────────│││
│  │  │  Team Chat          ││  │  │  Message List                           │││
│  │  │                     ││  │  │                                         │││
│  │  │                     ││  │  │                                         │││
│  │  │                     ││  │  ├─────────────────────────────────────────┤││
│  │  │                     ││  │  │  Composer                               │││
│  │  └─────────────────────┘│  │  └─────────────────────────────────────────┘││
│  └─────────────────────────┘  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation (UIKit)

```swift
class ChatSplitViewController: UISplitViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        preferredDisplayMode = .oneBesideSecondary
        preferredSplitBehavior = .tile
        
        // Primary: Conversations
        let conversations = CometChatConversations()
        conversations.set(onItemClick: { [weak self] conversation, _ in
            self?.showMessages(for: conversation)
        })
        let primaryNav = UINavigationController(rootViewController: conversations)
        
        // Secondary: Empty state or messages
        let emptyVC = EmptyStateViewController()
        let secondaryNav = UINavigationController(rootViewController: emptyVC)
        
        viewControllers = [primaryNav, secondaryNav]
    }
    
    private func showMessages(for conversation: Conversation) {
        let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer; see cometchat-ios-components § 12
        
        if let user = conversation.conversationWith as? User {
            messagesVC.set(user: user)
        } else if let group = conversation.conversationWith as? Group {
            messagesVC.set(group: group)
        }
        
        let secondaryNav = UINavigationController(rootViewController: messagesVC)
        showDetailViewController(secondaryNav, sender: self)
    }
}

class EmptyStateViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        
        let label = UILabel()
        label.text = "Select a conversation"
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        
        view.addSubview(label)
        label.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
}
```

---

## 6. Embedded View Pattern

For embedding chat in a portion of the screen.

### Embedded Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Your App Header                                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Your Content                                           ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Embedded Chat (CometChatMessageList + Composer)        ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Implementation (UIKit)

```swift
class EmbeddedChatViewController: UIViewController {
    
    private var supportUser: User?
    
    private lazy var chatContainer: UIView = {
        let view = UIView()
        view.backgroundColor = .systemBackground
        view.layer.cornerRadius = 12
        view.clipsToBounds = true
        return view
    }()
    
    private lazy var messageList = CometChatMessageList()
    private lazy var messageComposer = CometChatMessageComposer()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        fetchSupportUser()
    }
    
    private func setupUI() {
        view.addSubview(chatContainer)
        chatContainer.translatesAutoresizingMaskIntoConstraints = false
        
        chatContainer.addSubview(messageList)
        chatContainer.addSubview(messageComposer)
        
        messageList.translatesAutoresizingMaskIntoConstraints = false
        messageComposer.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            // Chat container takes bottom half of screen
            chatContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            chatContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            chatContainer.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            chatContainer.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.4),
            
            // Message list
            messageList.topAnchor.constraint(equalTo: chatContainer.topAnchor),
            messageList.leadingAnchor.constraint(equalTo: chatContainer.leadingAnchor),
            messageList.trailingAnchor.constraint(equalTo: chatContainer.trailingAnchor),
            messageList.bottomAnchor.constraint(equalTo: messageComposer.topAnchor),
            
            // Composer
            messageComposer.leadingAnchor.constraint(equalTo: chatContainer.leadingAnchor),
            messageComposer.trailingAnchor.constraint(equalTo: chatContainer.trailingAnchor),
            messageComposer.bottomAnchor.constraint(equalTo: chatContainer.bottomAnchor)
        ])
    }
    
    private func fetchSupportUser() {
        CometChat.getUser(UID: "support-agent") { [weak self] user in
            guard let user = user else { return }
            DispatchQueue.main.async {
                self?.supportUser = user
                self?.messageList.set(user: user)
                self?.messageComposer.set(user: user)
            }
        } onError: { error in
            print("Error: \(error?.errorDescription ?? "")")
        }
    }
}
```

---

## Best Practices

1. **Always wrap in UINavigationController** when presenting CometChat view controllers
2. **Hide tab bar when pushing messages** using `hidesBottomBarWhenPushed = true`
3. **Handle keyboard properly** — CometChat components handle this automatically
4. **Support both orientations** — components adapt to orientation changes
5. **Test on iPad** — use split view for better iPad experience
6. **Handle deep links** — navigate to specific conversations from push notifications
