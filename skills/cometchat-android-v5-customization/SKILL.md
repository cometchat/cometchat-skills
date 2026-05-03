---
name: cometchat-android-v5-customization
description: "Customize CometChat components beyond theming — custom message templates, DataSource decorators, event listeners, and custom view slots."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, grepSearch"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat android customization custom-view message-template datasource events"
---

> **Companion skills:** `cometchat-android-v5-components` provides the component
> catalog; `cometchat-android-v5-theming` covers visual styling;
> `cometchat-android-v5-extensions` covers the extension architecture.

## Purpose

This skill teaches how to customize CometChat components beyond what theming provides. It covers custom message templates, the DataSource/DataSourceDecorator pattern, ChatConfigurator, event listeners, and custom view slots.

---

## Use this skill when

- "Customize the message list"
- "Add a custom message bubble"
- "Listen to message events"
- "Add a custom action to message options"
- "Filter conversations"

## Do not use this skill when

- Changing colors/fonts → use `cometchat-android-v5-theming`
- Enabling a packaged feature → use `cometchat-android-v5-features`
- Setting up init/login → use `cometchat-android-v5-core`

---

## 1. CometChatMessageTemplate

Templates define how message bubbles are rendered. Each template maps a message `type` + `category` to custom views.

**Java:**
```java
CometChatMessageTemplate template = new CometChatMessageTemplate()
    .setType(CometChatConstants.MESSAGE_TYPE_TEXT)
    .setCategory(CometChatConstants.CATEGORY_MESSAGE)
    .setContentView(new MessagesViewHolderListener() {
        @Override
        public View createView(Context context, CometChatMessageBubble messageBubble,
                               UIKitConstants.MessageBubbleAlignment alignment) {
            // Return your custom view
            return LayoutInflater.from(context).inflate(R.layout.custom_text_bubble, null);
        }

        @Override
        public void bindView(Context context, View createdView, BaseMessage message,
                             UIKitConstants.MessageBubbleAlignment alignment,
                             RecyclerView.ViewHolder holder, List<BaseMessage> messageList,
                             int position) {
            // Bind data to your custom view
            TextView textView = createdView.findViewById(R.id.customText);
            textView.setText(((TextMessage) message).getText());
        }
    })
    .setOptions((context, baseMessage, group) -> {
        // Return custom message options (long-press menu)
        List<CometChatMessageOption> options = new ArrayList<>();
        options.add(new CometChatMessageOption("custom_action", "Custom Action",
            R.drawable.ic_custom, () -> { /* handle click */ }));
        return options;
    });

// Apply to message list
messageList.setTemplates(Collections.singletonList(template));
```

**Kotlin:**
```kotlin
val template = CometChatMessageTemplate()
    .setType(CometChatConstants.MESSAGE_TYPE_TEXT)
    .setCategory(CometChatConstants.CATEGORY_MESSAGE)
    .setContentView(object : MessagesViewHolderListener() {
        override fun createView(context: Context, messageBubble: CometChatMessageBubble,
                                alignment: UIKitConstants.MessageBubbleAlignment): View {
            return LayoutInflater.from(context).inflate(R.layout.custom_text_bubble, null)
        }

        override fun bindView(context: Context, createdView: View, message: BaseMessage,
                              alignment: UIKitConstants.MessageBubbleAlignment,
                              holder: RecyclerView.ViewHolder, messageList: List<BaseMessage>,
                              position: Int) {
            val textView = createdView.findViewById<TextView>(R.id.customText)
            textView.text = (message as TextMessage).text
        }
    })
    .setOptions { context, baseMessage, group ->
        listOf(CometChatMessageOption("custom_action", "Custom Action",
            R.drawable.ic_custom) { /* handle click */ })
    }

messageList.setTemplates(listOf(template))
```

### Template view slots

| Slot | Method | Description |
|---|---|---|
| `bubbleView` | `setBubbleView(MessagesViewHolderListener)` | Entire message bubble |
| `headerView` | `setHeaderView(MessagesViewHolderListener)` | Above the bubble |
| `contentView` | `setContentView(MessagesViewHolderListener)` | Inside the bubble |
| `bottomView` | `setBottomView(MessagesViewHolderListener)` | Below the content, inside bubble |
| `footerView` | `setFooterView(MessagesViewHolderListener)` | Below the bubble |
| `statusInfoView` | `setStatusInfoView(MessagesViewHolderListener)` | Status info area |
| `replyView` | `setReplyView(MessagesViewHolderListener)` | Reply preview above bubble |

---

## 2. CometChatMessageOption

Custom actions in the message long-press menu.

**Java:**
```java
CometChatMessageOption option = new CometChatMessageOption(
    "bookmark",                    // unique ID
    "Bookmark",                    // title
    R.drawable.ic_bookmark,        // icon
    () -> {                        // onClick
        // Handle bookmark action
    }
);
```

---

## 3. DataSource and DataSourceDecorator

The `DataSource` interface defines how messages are rendered and what options are available. `DataSourceDecorator` wraps an existing DataSource to add or modify behavior without replacing it.

**Java:**
```java
public class CustomDataSource extends DataSourceDecorator {
    public CustomDataSource(DataSource dataSource) {
        super(dataSource);
    }

    @Override
    public List<CometChatMessageOption> getTextMessageOptions(Context context,
            BaseMessage baseMessage, Group group, AdditionParameter additionParameter) {
        List<CometChatMessageOption> options = super.getTextMessageOptions(context,
            baseMessage, group, additionParameter);
        // Add custom option
        options.add(new CometChatMessageOption("translate", "Translate",
            R.drawable.ic_translate, () -> { /* translate */ }));
        return options;
    }
}
```

**Kotlin:**
```kotlin
class CustomDataSource(dataSource: DataSource) : DataSourceDecorator(dataSource) {
    override fun getTextMessageOptions(context: Context, baseMessage: BaseMessage,
            group: Group?, additionParameter: AdditionParameter): List<CometChatMessageOption> {
        val options = super.getTextMessageOptions(context, baseMessage, group, additionParameter).toMutableList()
        options.add(CometChatMessageOption("translate", "Translate",
            R.drawable.ic_translate) { /* translate */ })
        return options
    }
}
```

### Register via ChatConfigurator

**Java:**
```java
ChatConfigurator.enable(dataSource -> new CustomDataSource(dataSource));
```

**Kotlin:**
```kotlin
ChatConfigurator.enable { dataSource -> CustomDataSource(dataSource) }
```

---

## 4. Event system

CometChat provides event classes for reacting to chat events. Register listeners with a unique tag.

### CometChatMessageEvents

**Java:**
```java
CometChatMessageEvents.addListener("unique-tag", new CometChatMessageEvents() {
    @Override
    public void ccMessageSent(BaseMessage baseMessage, int status) {
        // Message sent
    }

    @Override
    public void onTextMessageReceived(TextMessage textMessage) {
        // Text message received
    }

    @Override
    public void onMessageReactionAdded(ReactionEvent reactionEvent) {
        // Reaction added
    }
});

// Remove when done
CometChatMessageEvents.removeListener("unique-tag");
```

**Kotlin:**
```kotlin
CometChatMessageEvents.addListener("unique-tag", object : CometChatMessageEvents() {
    override fun ccMessageSent(baseMessage: BaseMessage, status: Int) {
        // Message sent
    }

    override fun onTextMessageReceived(textMessage: TextMessage) {
        // Text message received
    }

    override fun onMessageReactionAdded(reactionEvent: ReactionEvent) {
        // Reaction added
    }
})

// Remove when done
CometChatMessageEvents.removeListener("unique-tag")
```

### CometChatUserEvents

```java
CometChatUserEvents.addUserListener("unique-tag", new CometChatUserEvents() {
    @Override
    public void ccUserBlocked(User user) { }

    @Override
    public void ccUserUnblocked(User user) { }
});
```

### CometChatGroupEvents

```java
CometChatGroupEvents.addGroupListener("unique-tag", new CometChatGroupEvents() {
    @Override
    public void ccGroupCreated(Group group) { }
    @Override
    public void ccGroupDeleted(Group group) { }
    @Override
    public void ccGroupMemberJoined(User joinedUser, Group joinedGroup) { }
    @Override
    public void ccGroupMemberKicked(Action action, User kicked, User kickedBy, Group from) { }
    @Override
    public void ccGroupMemberBanned(Action action, User banned, User bannedBy, Group from) { }
});
```

### CometChatCallEvents

```java
CometChatCallEvents.addListener("unique-tag", new CometChatCallEvents() {
    @Override
    public void ccOutgoingCall(Call call) { }
    @Override
    public void ccCallAccepted(Call call) { }
    @Override
    public void ccCallRejected(Call call) { }
    @Override
    public void ccCallEnded(Call call) { }
});
```

---

## 5. Custom view slots on components

Most components support custom view injection via `Function3<Context, User, Group, View>`:

```java
CometChatMessageHeader header = findViewById(R.id.header);
header.setSubtitleView((context, user, group) -> {
    TextView subtitle = new TextView(context);
    if (user != null) {
        subtitle.setText(user.getStatus().equals("online") ? "Active now" : "Offline");
    }
    return subtitle;
});
```

---

## Hard rules

- **Always extend `DataSourceDecorator`, never implement `DataSource` directly.** The decorator preserves existing behavior.
- **Register `ChatConfigurator.enable()` AFTER `CometChatUIKit.init()` succeeds.** The configurator resets on init.
- **Always remove event listeners when the Activity/Fragment is destroyed.** Use `onDestroy()` or `onDestroyView()`.
- **Template view slots use `MessagesViewHolderListener`.** Implement both `createView()` and `bindView()`.
