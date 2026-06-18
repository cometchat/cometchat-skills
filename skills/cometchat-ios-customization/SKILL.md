---
name: cometchat-ios-customization
description: "Customize CometChat iOS UI Kit beyond theming — custom views, message templates, text formatters, and event handling."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; iOS 13+"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios customization templates formatters events"
---

> **Ground truth:** `CometChatUIKitSwift ~> 5` (+ `CometChatCallsSDK ~> 5`) — Pods/SPM `.swiftinterface` + `ui-kit/ios`. **Official docs:** https://www.cometchat.com/docs/ui-kit/ios/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

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
    
    // CometChatConversationOption.init takes NO `id`; the click handler is the
    // `onClick` initializer parameter (not a settable property) and its closure is
    // (User?, Int, CometChatConversationOption, UIViewController?) -> Void.
    // Pin conversation
    let pinOption = CometChatConversationOption(
        title: "Pin",
        titleColor: nil,
        icon: UIImage(systemName: "pin.fill"),
        titleFont: nil,
        iconTint: .white,
        backgroundColor: .systemYellow,
        onClick: { user, index, option, controller in
            print("Pin conversation")
        }
    )
    options.append(pinOption)
    
    // Mute conversation
    let muteOption = CometChatConversationOption(
        title: "Mute",
        titleColor: nil,
        icon: UIImage(systemName: "bell.slash.fill"),
        titleFont: nil,
        iconTint: .white,
        backgroundColor: .systemGray,
        onClick: { user, index, option, controller in
            print("Mute conversation")
        }
    )
    options.append(muteOption)
    
    // Delete conversation
    let deleteOption = CometChatConversationOption(
        title: "Delete",
        titleColor: nil,
        icon: UIImage(systemName: "trash.fill"),
        titleFont: nil,
        iconTint: .white,
        backgroundColor: .systemRed,
        onClick: { user, index, option, controller in
            print("Delete conversation")
        }
    )
    options.append(deleteOption)
    
    return options
})
```

### Add Options (Keep Default + Add Custom)

```swift
conversations.add(options: { (conversation: Conversation?) -> [CometChatConversationOption] in
    let archiveOption = CometChatConversationOption(
        title: "Archive",
        titleColor: nil,
        icon: UIImage(systemName: "archivebox.fill"),
        titleFont: nil,
        iconTint: .white,
        backgroundColor: .systemPurple,
        onClick: { user, index, option, controller in
            print("Archive conversation")
        }
    )
    
    return [archiveOption]
})
```

---

## 3. Custom Message Templates

### Creating a Custom Message Template

> ⚠️ **`CometChatMessageTemplate` is a `struct` with ONE memberwise initializer** — there is NO `CometChatMessageTemplate(type:category:)` convenience init, and the label order is **`category` first, then `type`**. The init requires ALL of these labels: `category:type:contentView:bubbleView:headerView:footerView:bottomView:options:` (the trailing `statusInfoView:` / `replyView:` default to `nil`). Pass `nil` for any view closure you don't need — you cannot omit the label. Verified: `CometChatMessageTemplate.swift:25-47`.

```swift
let messageList = CometChatMessageList()

// Get default templates — the argument is required (pass nil for defaults).
// Starting from this list (not []) keeps every built-in bubble.
// CometChatUIKit.getDataSource() → CometChatUIKit.swift:287; getAllMessageTemplates(additionalConfiguration:) → DataSource.swift:63
var templates = CometChatUIKit.getDataSource().getAllMessageTemplates(additionalConfiguration: nil)

// Create custom template for a specific message type.
// ALL labels below are required by the only initializer (CometChatMessageTemplate.swift:25).
// `category` comes BEFORE `type`. Each view closure is (BaseMessage?, MessageBubbleAlignment, UIViewController?) -> UIView?.
let customTemplate = CometChatMessageTemplate(
    category: "custom",
    type: "custom_poll",

    // Custom content view — the inner bubble content
    contentView: { message, alignment, controller in
        guard let customMessage = message as? CustomMessage,
              let data = customMessage.customData else {
            return UIView()
        }
        let pollView = PollBubbleView()
        pollView.configure(with: data)
        return pollView
    },

    // Custom bubble view (wraps content). alignment is MessageBubbleAlignment (.left/.right/.center — UIKitConstants.swift:85).
    bubbleView: { message, alignment, controller in
        let bubble = UIView()
        bubble.backgroundColor = alignment == .right
            ? CometChatTheme.primaryColor.withAlphaComponent(0.1)
            : UIColor.secondarySystemBackground
        bubble.layer.cornerRadius = 12
        return bubble
    },

    // Custom header view (above the bubble)
    headerView: { message, alignment, controller in
        let label = UILabel()
        label.text = "📊 Poll"
        label.font = .boldSystemFont(ofSize: 12)
        label.textColor = .secondaryLabel
        return label
    },

    // Custom footer view (below the bubble)
    footerView: { message, alignment, controller in
        let label = UILabel()
        label.text = "Tap to vote"
        label.font = .systemFont(ofSize: 11)
        label.textColor = .tertiaryLabel
        return label
    },

    // bottomView — pass nil if unused (label still required)
    bottomView: nil,

    // Custom options (long press menu). Closure is (BaseMessage?, Group?, UIViewController?) -> [CometChatMessageOption]?
    options: { message, group, controller in
        let viewResultsOption = CometChatMessageOption(
            id: "view_results",
            title: "View Results",
            icon: UIImage(systemName: "chart.bar.fill"),
            onItemClick: { message in
                // Show poll results — closure receives the BaseMessage? only
            }
        )
        return [viewResultsOption]
    }
)

// APPEND to the default templates (do NOT start from []) so every built-in bubble survives.
templates.append(customTemplate)

// set(templates:) → CometChatMessageList + Properties.swift:54 (replaces the list, so we passed the merged array).
// add(templates:) (line 63) merges into the existing list if you prefer.
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
    
    func ccGroupMemberKicked(action: ActionMessage, kickedUser: User, kickedBy: User, kickedFrom: Group) {
        print("Member kicked from group")
    }
    
    func ccGroupMemberBanned(action: ActionMessage, bannedUser: User, bannedBy: User, bannedFrom: Group) {
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
    
    func onCallInitiated(call: Call) {   // CometChatCallEventListener has onCallInitiated, not ccCallInitiated
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
// ConversationRequestBuilder exposes setConversationType(conversationType:), not set(conversationType:)
conversations.set(conversationsRequestBuilder: ConversationRequest.ConversationRequestBuilder()
    .setConversationType(conversationType: .user)
    .set(limit: 30)
)
```

> Note: `ConversationRequestBuilder` has no tags filter — its only methods are `set(limit:)`, `setConversationType(conversationType:)`, and `build()`. To filter by tags, fetch and filter the resulting conversations client-side.

### Filter Messages

```swift
let messageList = CometChatMessageList()

// Only show text and image messages
messageList.set(messagesRequestBuilder: MessagesRequest.MessageRequestBuilder()
    .set(uid: user.uid ?? "")
    .set(types: [MessageTypeConstants.text, MessageTypeConstants.image])
    .set(limit: 30)
)

// Only show messages from a specific time range
let startDate = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
messageList.set(messagesRequestBuilder: MessagesRequest.MessageRequestBuilder()
    .set(uid: user.uid ?? "")
    .set(timeStamp: Int(startDate.timeIntervalSince1970))
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

> ⚠️ **REGISTRATION IS THE CATCH.** `DataSourceDecorator` is public (DataSourceDecorator.swift:12), but the only mechanism that installs a decorator — `ChatConfigurator.enable { ... }` — is **internal to CometChatUIKitSwift**. `ChatConfigurator` shows up in the public module interface (`uikit.swiftinterface:8591`) as a class with **no public members** (only `deinit`); its `enable`/`getDataSource` statics are NOT public. The kit's own extensions (Polls/Stickers/etc.) call `ChatConfigurator.enable` from *inside* the module via `ExtensionDataSource.addExtension()`, but **app code cannot call it**. So a hand-rolled `DataSourceDecorator` subclass compiles but **has no public way to be registered** in this kit version.
>
> **Use the public component-level setters instead** for the common cases:
> - **Attachment options** → `CometChatMessageComposer.set(attachmentOptions:)` (§7a below). Public. Verified `CometChatMessageComposer + Properties.swift:44`.
> - **Custom message type / override a built-in bubble / per-type long-press options** → build a `CometChatMessageTemplate` and apply it with `CometChatMessageList.set(templates:)` / `add(templates:)` (§3 and §7b). Public. Verified `CometChatMessageList + Properties.swift:54,63`.
> - **Message long-press options**: there is **NO** `set(options:)`/`add(options:)` for *message* options on `CometChatMessageList` (only Conversations/Users/Groups/GroupMembers/CallLogs expose those). Message options are customized **only through a template's `options` closure** (§7b).
>
> The decorator subclass below is documented for completeness / for code that lives inside a kit fork — its method signatures are the source of truth for the protocol — but prefer the component setters above for app integration.

### 7a. Add a composer attachment option (public path)

`set(attachmentOptions:)` REPLACES the attachment list with whatever the closure returns — there is no public "super" list at the composer level, so to keep the built-in photo/video/file actions you must construct them yourself or accept that only your returned actions show. The closure is `(User?, Group?, UIViewController?) -> [CometChatMessageComposerAction]`.

```swift
let composer = CometChatMessageComposer()

composer.set(attachmentOptions: { user, group, controller in
    // NOTE: returning ONLY this array hides the default attachments.
    // Re-add any defaults you still want here.
    let location = CometChatMessageComposerAction(
        id: "location",
        text: "Send Location",
        startIcon: UIImage(systemName: "location.fill"),
        startIconTint: CometChatTheme.iconColorPrimary,
        textColor: CometChatTheme.textColorPrimary,
        textFont: CometChatTypography.Body.regular,
        onActionClick: { /* present location picker, then send (see §8) */ }
    )
    return [location]
})
```

### 7b. Override a built-in type's bubble / add per-type options (public path)

To replace the content view of a built-in type (e.g. text) — or attach a custom long-press option to it — start from the default template for that type, rebuild it with your closures, and apply via `add(templates:)`. `CometChatMessageTemplate` is a struct, so you create a NEW one (you cannot mutate a `let` from `getAllMessageTemplates`); copy `category`/`type` from the default and supply the closures you want.

```swift
let messageList = CometChatMessageList()

// Built-in text type identifiers (CometChatSDK constants):
//   category = "message", type = "text"  (matches MessagesDataSource.getTextMessageTemplate → "message"/"text")
let overriddenText = CometChatMessageTemplate(
    category: "message",
    type: "text",
    contentView: { message, alignment, controller in        // ← override the bubble content
        let label = UILabel()
        label.numberOfLines = 0
        label.text = (message as? TextMessage)?.text
        label.textColor = alignment == .right ? .white : .label
        return label
    },
    bubbleView: nil, headerView: nil, footerView: nil, bottomView: nil,
    options: { message, group, controller in                // ← add a long-press option to text bubbles
        let star = CometChatMessageOption(
            id: "star",
            title: "Star",
            icon: UIImage(systemName: "star.fill"),
            onItemClick: { msg in print("starred \(msg?.id ?? 0)") }
        )
        return [star]
    }
)

// add(templates:) MERGES by "category_type" key — it overwrites the default text template
// with ours and leaves every OTHER built-in bubble intact (CometChatMessageList + Properties.swift:63).
messageList.add(templates: [overriddenText])
```

### 7c. Decorator signatures (reference — registration is internal)

```swift
class CustomDataSource: DataSourceDecorator {
    
    // ⚠️ Signature MUST match the protocol exactly — it takes `additionalConfiguration:`.
    // Omitting the parameter does NOT override the kit method; your templates never appear.
    override func getAllMessageTemplates(
        additionalConfiguration: AdditionalConfiguration?
    ) -> [CometChatMessageTemplate] {
        // Call super to KEEP every default template (text/image/video/file/…).
        var templates = super.getAllMessageTemplates(additionalConfiguration: additionalConfiguration)
        
        // Append — never replace the array, or all default bubbles disappear.
        // ⚠️ Same init rule as §3: `category` first, then `type`, and ALL view-closure labels
        // are required (pass nil). NO `CometChatMessageTemplate(type:category:)` shorthand exists.
        let customTemplate = CometChatMessageTemplate(
            category: "custom",
            type: "custom_type",
            contentView: { message, alignment, controller in UIView() },
            bubbleView: nil, headerView: nil, footerView: nil, bottomView: nil, options: nil
        )
        templates.append(customTemplate)
        
        return templates
    }

    // Add a composer attachment option WITHOUT wiping the defaults (photo/video/file/…).
    // Same rule: start from super's list, then append.
    // ⚠️ `additionalConfiguration: AdditionalConfiguration` is REQUIRED with NO default value
    // in the protocol (DataSource.swift:74) and the decorator (DataSourceDecorator.swift:24).
    // Do NOT add `= AdditionalConfiguration()` here — match the signature exactly.
    override func getAttachmentOptions(
        controller: UIViewController,
        user: User?,
        group: Group?,
        id: [String: Any]?,
        additionalConfiguration: AdditionalConfiguration
    ) -> [CometChatMessageComposerAction]? {
        var options = super.getAttachmentOptions(
            controller: controller, user: user, group: group,
            id: id, additionalConfiguration: additionalConfiguration
        ) ?? []
        // ⚠️ There is NO zero-arg `CometChatMessageComposerAction()` init. The only
        // initializer requires id/text/startIcon/startIconTint/textColor/textFont
        // (endIcon, tints, colors, border, onActionClick all default).
        // Verified: CometChatMessageComposerAction.swift:28-56.
        let location = CometChatMessageComposerAction(
            id: "location",
            text: "Send Location",
            startIcon: UIImage(systemName: "location.fill"),
            startIconTint: CometChatTheme.iconColorPrimary,
            textColor: CometChatTheme.textColorPrimary,
            textFont: CometChatTypography.Body.regular,
            onActionClick: { /* present location picker, then send (see §8) */ }
        )
        options.append(location)
        return options
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
    
    // ⚠️ `additionalConfiguration: AdditionalConfiguration` is REQUIRED (no default) on this
    // method too — omitting it means you DON'T override the protocol method and your option
    // never appears. Verified: DataSource.swift:67, DataSourceDecorator.swift:36.
    override func getMessageOptions(
        loggedInUser: User,
        messageObject: BaseMessage,
        controller: UIViewController?,
        group: Group?,
        additionalConfiguration: AdditionalConfiguration
    ) -> [CometChatMessageOption]? {
        var options = super.getMessageOptions(
            loggedInUser: loggedInUser,
            messageObject: messageObject,
            controller: controller,
            group: group,
            additionalConfiguration: additionalConfiguration
        ) ?? []
        
        // Add custom option. ⚠️ The click handler is `onItemClick: (BaseMessage?) -> Void`
        // — there is NO `onClick` property and NO 4-arg closure. Set it via the initializer
        // (it's a struct; `onItemClick` is the only callback). Verified: CometChatMessageOption.swift:30,33-45.
        let customOption = CometChatMessageOption(
            id: "custom_action",
            title: "Custom Action",
            icon: UIImage(systemName: "star.fill"),
            onItemClick: { message in
                print("Custom action triggered for \(message?.id ?? 0)")
            }
        )
        options.append(customOption)
        
        return options
    }
}

// ⚠️ NO PUBLIC REGISTRATION. The only installer, `ChatConfigurator.enable { dataSource in
//    return CustomDataSource(dataSource: dataSource) }`, is INTERNAL to CometChatUIKitSwift
//    and does NOT compile from app code (ChatConfigurator exposes no public members —
//    uikit.swiftinterface:8591). Subclassing `ExtensionDataSource` does not help either: its
//    base `addExtension()` is empty and the only way to make it do anything is to call the same
//    internal `ChatConfigurator.enable` from inside it.
// → For app integration, use the public component setters in §7a / §7b instead.
//   (This decorator block stands only as the authoritative signature reference, and works
//    for code compiled INSIDE a kit fork.)
```

---

## 8. Sending a Custom Message — use the UIKit path, not the raw SDK

A custom `contentView`/template only renders messages of that `type`; you still have to **send** one. Use **`CometChatUIKit.sendCustomMessage(message:)`**, not `CometChat.sendCustomMessage(...)`. The UIKit wrapper stamps `muid` + sender and fires the `ccMessageSent` event, which is what makes the new bubble **append** to the open list. The raw SDK call skips those, giving the two classic failures: a "cannot determine recipient" state and the realtime message **replacing** an existing bubble instead of appending (no `muid` for dedup).

```swift
// Build with the receiver set — receiverUid + .user (or a guid + .group)
let custom = CustomMessage(
    receiverUid: selectedUser.uid,
    receiverType: .user,                 // CometChat.ReceiverType
    customData: ["question": "Lunch?", "options": ["Yes", "No"]],
    type: "custom_poll"                  // MUST match the template/contentView type
)

// ✅ kit path — sets muid + sender, emits ccMessageSent → list appends
CometChatUIKit.sendCustomMessage(message: custom)

// ❌ raw SDK — no muid/sender/event → recipient error + realtime replace
// CometChat.sendCustomMessage(message: custom, onSuccess: { _ in }, onError: { _ in })
```

Verified: `CustomMessage(receiverUid:receiverType:customData:type:)` (CometChatSDK) and static `CometChatUIKit.sendCustomMessage(message:)` (CometChatUIKitSwift).

---

## Best Practices

1. **Keep custom views lightweight** — Complex views affect scroll performance
2. **Reuse views when possible** — Use cell reuse patterns
3. **Handle all message types** — Don't forget edge cases
4. **Test with real data** — Use actual conversations for testing
5. **Clean up listeners** — Remove event listeners when views are deallocated
6. **Use weak references** — Avoid retain cycles in closures

## Sound (in-app message + call sounds)

Sound is a customization sub-dimension. The UI Kit plays incoming/outgoing message + call sounds via `CometChatSoundManager` — mute it, swap custom audio, or play a specific sound. The full API + recipe lives in **`cometchat-ios-theming`** (Sound section). Verify the access path against the installed kit before relying on it.
