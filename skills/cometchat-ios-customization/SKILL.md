---
name: cometchat-ios-customization
description: "Customize CometChat iOS UI Kit beyond theming — custom views, message templates, text formatters, and event handling."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; iOS 13+"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios customization templates formatters events"
---

## Purpose

This skill teaches advanced customization of CometChat iOS UI Kit — custom views, message templates, text formatters, event listeners, and request builder filters.

---

## 1. Custom Views in CometChatConversations

### Custom List Item View

Replace the entire list item with a custom view:

```swift
let conversations = CometChatConversations()

conversations.set(listItemView: { (conversation: Conversation) -> UIView in
    let customView = UIView()
    customView.backgroundColor = .secondarySystemBackground
    
    let nameLabel = UILabel()
    nameLabel.font = .boldSystemFont(ofSize: 16)
    
    if let user = conversation.conversationWith as? User {
        nameLabel.text = user.name
    } else if let group = conversation.conversationWith as? Group {
        nameLabel.text = group.name
    }
    
    customView.addSubview(nameLabel)
    nameLabel.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
        nameLabel.leadingAnchor.constraint(equalTo: customView.leadingAnchor, constant: 16),
        nameLabel.centerYAnchor.constraint(equalTo: customView.centerYAnchor)
    ])
    
    return customView
})
```

### Custom Leading View (Avatar Area)

```swift
conversations.set(leadingView: { (conversation: Conversation) -> UIView in
    let avatarView = UIView()
    avatarView.backgroundColor = .systemBlue
    avatarView.layer.cornerRadius = 24
    
    let initialsLabel = UILabel()
    initialsLabel.textColor = .white
    initialsLabel.font = .boldSystemFont(ofSize: 14)
    initialsLabel.textAlignment = .center
    
    if let user = conversation.conversationWith as? User {
        initialsLabel.text = String(user.name?.prefix(2).uppercased() ?? "")
    } else if let group = conversation.conversationWith as? Group {
        initialsLabel.text = String(group.name?.prefix(2).uppercased() ?? "")
    }
    
    avatarView.addSubview(initialsLabel)
    initialsLabel.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
        initialsLabel.centerXAnchor.constraint(equalTo: avatarView.centerXAnchor),
        initialsLabel.centerYAnchor.constraint(equalTo: avatarView.centerYAnchor),
        avatarView.widthAnchor.constraint(equalToConstant: 48),
        avatarView.heightAnchor.constraint(equalToConstant: 48)
    ])
    
    return avatarView
})
```

### Custom Title View

```swift
conversations.set(titleView: { (conversation: Conversation) -> UIView in
    let stackView = UIStackView()
    stackView.axis = .horizontal
    stackView.spacing = 8
    
    let nameLabel = UILabel()
    nameLabel.font = .boldSystemFont(ofSize: 16)
    
    let verifiedBadge = UIImageView(image: UIImage(systemName: "checkmark.seal.fill"))
    verifiedBadge.tintColor = .systemBlue
    verifiedBadge.isHidden = true
    
    if let user = conversation.conversationWith as? User {
        nameLabel.text = user.name
        // Show badge for verified users (custom metadata)
        if let metadata = user.metadata, metadata["verified"] as? Bool == true {
            verifiedBadge.isHidden = false
        }
    } else if let group = conversation.conversationWith as? Group {
        nameLabel.text = group.name
    }
    
    stackView.addArrangedSubview(nameLabel)
    stackView.addArrangedSubview(verifiedBadge)
    
    return stackView
})
```

### Custom Subtitle View

```swift
conversations.set(subtitleView: { (conversation: Conversation) -> UIView in
    let label = UILabel()
    label.font = .systemFont(ofSize: 14)
    label.textColor = .secondaryLabel
    
    if let lastMessage = conversation.lastMessage as? TextMessage {
        label.text = lastMessage.text
    } else if let lastMessage = conversation.lastMessage as? MediaMessage {
        switch lastMessage.messageType {
        case .image:
            label.text = "📷 Photo"
        case .video:
            label.text = "🎥 Video"
        case .audio:
            label.text = "🎵 Audio"
        case .file:
            label.text = "📎 File"
        default:
            label.text = "Attachment"
        }
    } else {
        label.text = "No messages yet"
    }
    
    return label
})
```

### Custom Tail View

```swift
conversations.set(trailView: { (conversation: Conversation) -> UIView in
    let stackView = UIStackView()
    stackView.axis = .vertical
    stackView.alignment = .trailing
    stackView.spacing = 4
    
    // Time label
    let timeLabel = UILabel()
    timeLabel.font = .systemFont(ofSize: 12)
    timeLabel.textColor = .tertiaryLabel
    
    if let timestamp = conversation.lastMessage?.sentAt {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        timeLabel.text = formatter.string(from: date)
    }
    
    // Unread badge
    let badge = UILabel()
    badge.font = .boldSystemFont(ofSize: 12)
    badge.textColor = .white
    badge.backgroundColor = .systemBlue
    badge.textAlignment = .center
    badge.layer.cornerRadius = 10
    badge.clipsToBounds = true
    
    let unreadCount = conversation.unreadMessageCount
    badge.isHidden = unreadCount == 0
    badge.text = unreadCount > 99 ? "99+" : "\(unreadCount)"
    
    stackView.addArrangedSubview(timeLabel)
    stackView.addArrangedSubview(badge)
    
    NSLayoutConstraint.activate([
        badge.widthAnchor.constraint(greaterThanOrEqualToConstant: 20),
        badge.heightAnchor.constraint(equalToConstant: 20)
    ])
    
    return stackView
})
```

---

## 2. Custom Swipe Actions

### Custom Options

```swift
conversations.set(options: { (conversation: Conversation?) -> [CometChatConversationOption] in
    guard let conversation = conversation else { return [] }
    var options: [CometChatConversationOption] = []
    
    // Pin conversation
    let pinOption = CometChatConversationOption(
        id: "pin",
        title: "Pin",
        icon: UIImage(systemName: "pin.fill"),
        backgroundColor: .systemYellow,
        iconTint: .white
    )
    pinOption.onClick = { _, _, _, _ in
        // Handle pin action
        print("Pin conversation: \(conversation.conversationId ?? "")")
    }
    options.append(pinOption)
    
    // Mute conversation
    let muteOption = CometChatConversationOption(
        id: "mute",
        title: "Mute",
        icon: UIImage(systemName: "bell.slash.fill"),
        backgroundColor: .systemGray,
        iconTint: .white
    )
    muteOption.onClick = { _, _, _, _ in
        // Handle mute action
        print("Mute conversation: \(conversation.conversationId ?? "")")
    }
    options.append(muteOption)
    
    // Delete conversation
    let deleteOption = CometChatConversationOption(
        id: "delete",
        title: "Delete",
        icon: UIImage(systemName: "trash.fill"),
        backgroundColor: .systemRed,
        iconTint: .white
    )
    deleteOption.onClick = { _, _, _, _ in
        // Handle delete action
        print("Delete conversation: \(conversation.conversationId ?? "")")
    }
    options.append(deleteOption)
    
    return options
})
```

### Add Options (Keep Default + Add Custom)

```swift
conversations.add(options: { (conversation: Conversation?) -> [CometChatConversationOption] in
    let archiveOption = CometChatConversationOption(
        id: "archive",
        title: "Archive",
        icon: UIImage(systemName: "archivebox.fill"),
        backgroundColor: .systemPurple,
        iconTint: .white
    )
    archiveOption.onClick = { _, _, _, _ in
        print("Archive conversation")
    }
    
    return [archiveOption]
})
```

---

## 3. Custom Message Templates

### Creating a Custom Message Template

```swift
let messageList = CometChatMessageList()

// Get default templates
var templates = CometChatUIKit.getDataSource().getAllMessageTemplates()

// Create custom template for a specific message type
let customTemplate = CometChatMessageTemplate(
    type: "custom_poll",
    category: "custom"
)

// Custom content view
customTemplate.contentView = { message, alignment, controller in
    guard let customMessage = message as? CustomMessage,
          let data = customMessage.customData else {
        return UIView()
    }
    
    let pollView = PollBubbleView()
    pollView.configure(with: data)
    return pollView
}

// Custom header view (above the bubble)
customTemplate.headerView = { message, alignment, controller in
    let label = UILabel()
    label.text = "📊 Poll"
    label.font = .boldSystemFont(ofSize: 12)
    label.textColor = .secondaryLabel
    return label
}

// Custom footer view (below the bubble)
customTemplate.footerView = { message, alignment, controller in
    let label = UILabel()
    label.text = "Tap to vote"
    label.font = .systemFont(ofSize: 11)
    label.textColor = .tertiaryLabel
    return label
}

// Custom bubble view (wraps content)
customTemplate.bubbleView = { message, alignment, controller in
    let bubble = UIView()
    bubble.backgroundColor = alignment == .right 
        ? CometChatTheme.primaryColor.withAlphaComponent(0.1)
        : UIColor.secondarySystemBackground
    bubble.layer.cornerRadius = 12
    return bubble
}

// Custom options (long press menu)
customTemplate.options = { message, group, controller in
    let viewResultsOption = CometChatMessageOption(
        id: "view_results",
        title: "View Results",
        icon: UIImage(systemName: "chart.bar.fill")
    )
    viewResultsOption.onClick = { _, _, _, _ in
        // Show poll results
    }
    
    return [viewResultsOption]
}

templates.append(customTemplate)
messageList.set(templates: templates)
```

### Custom Poll Bubble View Example

```swift
class PollBubbleView: UIView {
    
    private let questionLabel = UILabel()
    private let optionsStack = UIStackView()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    private func setupUI() {
        questionLabel.font = .boldSystemFont(ofSize: 16)
        questionLabel.numberOfLines = 0
        
        optionsStack.axis = .vertical
        optionsStack.spacing = 8
        
        addSubview(questionLabel)
        addSubview(optionsStack)
        
        questionLabel.translatesAutoresizingMaskIntoConstraints = false
        optionsStack.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            questionLabel.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            questionLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            questionLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            
            optionsStack.topAnchor.constraint(equalTo: questionLabel.bottomAnchor, constant: 12),
            optionsStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            optionsStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            optionsStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12)
        ])
    }
    
    func configure(with data: [String: Any]) {
        questionLabel.text = data["question"] as? String
        
        optionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        
        if let options = data["options"] as? [String] {
            for option in options {
                let button = UIButton(type: .system)
                button.setTitle(option, for: .normal)
                button.backgroundColor = .systemGray5
                button.layer.cornerRadius = 8
                button.contentEdgeInsets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
                optionsStack.addArrangedSubview(button)
            }
        }
    }
}
```

---

## 4. Text Formatters

### Creating a Custom Text Formatter

```swift
class HashtagFormatter: CometChatTextFormatter {
    
    override func getRegex() -> String {
        return "#[a-zA-Z0-9_]+"
    }
    
    override func prepareMessageString(
        baseMessage: BaseMessage,
        regexString: String,
        alignment: MessageBubbleAlignment,
        formattingType: FormattingType
    ) -> NSAttributedString {
        
        guard let textMessage = baseMessage as? TextMessage,
              let text = textMessage.text else {
            return NSAttributedString()
        }
        
        let attributedString = NSMutableAttributedString(string: text)
        
        // Default text attributes
        let defaultAttributes: [NSAttributedString.Key: Any] = [
            .font: CometChatTypography.Body.regular,
            .foregroundColor: alignment == .right ? UIColor.white : UIColor.label
        ]
        attributedString.addAttributes(defaultAttributes, range: NSRange(location: 0, length: text.count))
        
        // Highlight hashtags
        let regex = try? NSRegularExpression(pattern: regexString, options: [])
        let matches = regex?.matches(in: text, options: [], range: NSRange(location: 0, length: text.count)) ?? []
        
        for match in matches {
            let hashtagAttributes: [NSAttributedString.Key: Any] = [
                .foregroundColor: UIColor.systemBlue,
                .font: CometChatTypography.Body.medium
            ]
            attributedString.addAttributes(hashtagAttributes, range: match.range)
        }
        
        return attributedString
    }
    
    override func onTextTapped(
        baseMessage: BaseMessage,
        tappedText: String,
        controller: UIViewController?
    ) {
        // Handle hashtag tap
        print("Hashtag tapped: \(tappedText)")
        // Navigate to hashtag search, etc.
    }
}

// Usage
let messageList = CometChatMessageList()
messageList.textFormatter = [
    CometChatMentionsFormatter(),  // Built-in mentions
    HashtagFormatter()              // Custom hashtags
]
```

### URL Formatter with Custom Preview

```swift
class CustomURLFormatter: CometChatTextFormatter {
    
    override func getRegex() -> String {
        return "https?://[^\\s]+"
    }
    
    override func prepareMessageString(
        baseMessage: BaseMessage,
        regexString: String,
        alignment: MessageBubbleAlignment,
        formattingType: FormattingType
    ) -> NSAttributedString {
        
        guard let textMessage = baseMessage as? TextMessage,
              let text = textMessage.text else {
            return NSAttributedString()
        }
        
        let attributedString = NSMutableAttributedString(string: text)
        
        let regex = try? NSRegularExpression(pattern: regexString, options: [])
        let matches = regex?.matches(in: text, options: [], range: NSRange(location: 0, length: text.count)) ?? []
        
        for match in matches {
            let urlAttributes: [NSAttributedString.Key: Any] = [
                .foregroundColor: UIColor.systemBlue,
                .underlineStyle: NSUnderlineStyle.single.rawValue
            ]
            attributedString.addAttributes(urlAttributes, range: match.range)
        }
        
        return attributedString
    }
    
    override func onTextTapped(
        baseMessage: BaseMessage,
        tappedText: String,
        controller: UIViewController?
    ) {
        if let url = URL(string: tappedText) {
            UIApplication.shared.open(url)
        }
    }
}
```

---

## 5. Event Listeners

### Message Events

```swift
import CometChatSDK

class MessageEventListener: CometChatMessageEventListener {
    
    func ccMessageSent(message: BaseMessage, status: MessageStatus) {
        switch status {
        case .inProgress:
            print("Message sending...")
        case .success:
            print("Message sent successfully")
        case .error:
            print("Message failed to send")
        }
    }
    
    func ccMessageEdited(message: BaseMessage, status: MessageStatus) {
        print("Message edited: \(message.id)")
    }
    
    func ccMessageDeleted(message: BaseMessage) {
        print("Message deleted: \(message.id)")
    }
    
    func ccMessageRead(message: BaseMessage) {
        print("Message read: \(message.id)")
    }
    
    func ccLiveReaction(reaction: TransientMessage) {
        print("Live reaction received")
    }
}

// Register listener
let listener = MessageEventListener()
CometChatMessageEvents.addListener("message-listener", listener)

// Remove listener when done
CometChatMessageEvents.removeListener("message-listener")
```

### User Events

```swift
class UserEventListener: CometChatUserEventListener {
    
    func ccUserBlocked(user: User) {
        print("User blocked: \(user.name ?? "")")
    }
    
    func ccUserUnblocked(user: User) {
        print("User unblocked: \(user.name ?? "")")
    }
}

// Register
CometChatUserEvents.addListener("user-listener", UserEventListener())
```

### Group Events

```swift
class GroupEventListener: CometChatGroupEventListener {
    
    func ccGroupCreated(group: Group) {
        print("Group created: \(group.name ?? "")")
    }
    
    func ccGroupDeleted(group: Group) {
        print("Group deleted: \(group.name ?? "")")
    }
    
    func ccGroupMemberAdded(messages: [ActionMessage], usersAdded: [User], groupAddedIn: Group, addedBy: User) {
        print("Members added to group")
    }
    
    func ccGroupMemberKicked(message: ActionMessage, kickedUser: User, kickedBy: User, kickedFrom: Group) {
        print("Member kicked from group")
    }
    
    func ccGroupMemberBanned(message: ActionMessage, bannedUser: User, bannedBy: User, bannedFrom: Group) {
        print("Member banned from group")
    }
    
    func ccOwnershipChanged(group: Group, newOwner: GroupMember) {
        print("Group ownership changed")
    }
}

// Register
CometChatGroupEvents.addListener("group-listener", GroupEventListener())
```

### Call Events

```swift
class CallEventListener: CometChatCallEventListener {
    
    func ccCallAccepted(call: Call) {
        print("Call accepted")
    }
    
    func ccCallRejected(call: Call) {
        print("Call rejected")
    }
    
    func ccCallEnded(call: Call) {
        print("Call ended")
    }
    
    func ccOutgoingCall(call: Call) {
        print("Outgoing call initiated")
    }
    
    func ccCallInitiated(call: Call) {
        print("Call initiated")
    }
}

// Register
CometChatCallEvents.addListener("call-listener", CallEventListener())
```

---

## 6. Request Builder Filters

### Filter Conversations

```swift
let conversations = CometChatConversations()

// Only show user conversations (no groups)
conversations.set(conversationsRequestBuilder: ConversationsRequest.ConversationsRequestBuilder()
    .set(conversationType: .user)
    .set(limit: 30)
)

// Only show conversations with specific tags
conversations.set(conversationsRequestBuilder: ConversationsRequest.ConversationsRequestBuilder()
    .set(tags: ["vip", "premium"])
    .set(limit: 30)
)
```

### Filter Messages

```swift
let messageList = CometChatMessageList()

// Only show text and image messages
messageList.set(messagesRequestBuilder: MessagesRequest.MessageRequestBuilder()
    .set(uid: user.uid ?? "")
    .set(types: [CometChatConstants.MessageType.text, CometChatConstants.MessageType.image])
    .set(limit: 30)
)

// Only show messages from a specific time range
let startDate = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
messageList.set(messagesRequestBuilder: MessagesRequest.MessageRequestBuilder()
    .set(uid: user.uid ?? "")
    .set(timestamp: Int(startDate.timeIntervalSince1970))
    .set(limit: 50)
)

// Hide deleted messages
messageList.set(messagesRequestBuilder: MessagesRequest.MessageRequestBuilder()
    .set(uid: user.uid ?? "")
    .hideDeletedMessages(hide: true)
    .set(limit: 30)
)
```

### Filter Users

```swift
let users = CometChatUsers()

// Only show users with specific role
users.set(usersRequestBuilder: UsersRequest.UsersRequestBuilder()
    .set(roles: ["admin", "moderator"])
    .set(limit: 30)
)

// Only show friends
users.set(usersRequestBuilder: UsersRequest.UsersRequestBuilder()
    .friendsOnly(true)
    .set(limit: 30)
)

// Search users
users.set(usersRequestBuilder: UsersRequest.UsersRequestBuilder()
    .set(searchKeyword: "john")
    .set(limit: 30)
)
```

### Filter Groups

```swift
let groups = CometChatGroups()

// Only show joined groups
groups.set(groupsRequestBuilder: GroupsRequest.GroupsRequestBuilder()
    .set(joinedOnly: true)
    .set(limit: 30)
)

// Only show public groups
groups.set(groupsRequestBuilder: GroupsRequest.GroupsRequestBuilder()
    .set(groupType: .public)
    .set(limit: 30)
)

// Search groups
groups.set(groupsRequestBuilder: GroupsRequest.GroupsRequestBuilder()
    .set(searchKeyWord: "team")
    .set(limit: 30)
)
```

---

## 7. DataSource Decorator Pattern

For advanced customization, use the DataSource decorator pattern:

```swift
class CustomDataSource: DataSourceDecorator {
    
    override func getAllMessageTemplates() -> [CometChatMessageTemplate] {
        var templates = super.getAllMessageTemplates()
        
        // Add custom template
        let customTemplate = CometChatMessageTemplate(type: "custom_type", category: "custom")
        templates.append(customTemplate)
        
        return templates
    }
    
    override func getAllMessageTypes() -> [String]? {
        var types = super.getAllMessageTypes() ?? []
        types.append("custom_type")
        return types
    }
    
    override func getAllMessageCategories() -> [String]? {
        var categories = super.getAllMessageCategories() ?? []
        categories.append("custom")
        return categories
    }
    
    override func getMessageOptions(
        loggedInUser: User,
        messageObject: BaseMessage,
        controller: UIViewController?,
        group: Group?
    ) -> [CometChatMessageOption]? {
        var options = super.getMessageOptions(
            loggedInUser: loggedInUser,
            messageObject: messageObject,
            controller: controller,
            group: group
        ) ?? []
        
        // Add custom option
        let customOption = CometChatMessageOption(
            id: "custom_action",
            title: "Custom Action",
            icon: UIImage(systemName: "star.fill")
        )
        customOption.onClick = { _, _, _, _ in
            print("Custom action triggered")
        }
        options.append(customOption)
        
        return options
    }
}

// Register custom data source
ChatConfigurator.enable { dataSource in
    return CustomDataSource(dataSource: dataSource)
}
```

---

## Best Practices

1. **Keep custom views lightweight** — Complex views affect scroll performance
2. **Reuse views when possible** — Use cell reuse patterns
3. **Handle all message types** — Don't forget edge cases
4. **Test with real data** — Use actual conversations for testing
5. **Clean up listeners** — Remove event listeners when views are deallocated
6. **Use weak references** — Avoid retain cycles in closures
