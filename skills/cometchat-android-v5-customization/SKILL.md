---
name: cometchat-android-v5-customization
description: "Customize CometChat components beyond theming — custom message templates, DataSource decorators, event listeners, and custom view slots."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat android customization custom-view message-template datasource events"
---

> **Ground truth:** `com.cometchat:chat-uikit-android:5.x` (legacy/maintenance-only; +`calls-sdk-android:5.x`) — resolved AAR (javap) + `ui-kit/android`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

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

> **Prefer the decorator (§3) for anything app-wide.** The per-list `setTemplates(...)` shown here only affects the one `CometChatMessageList` you call it on. To register a custom type, override a built-in bubble, add an attachment, or add a long-press option **everywhere**, use the four `DataSourceDecorator` recipes in §3 — that is the pattern the kit's own extensions use.

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

// Apply to message list — APPEND to defaults, never replace.
// ❌ messageList.setTemplates(Collections.singletonList(template));  // wipes ALL default bubbles
List<CometChatMessageTemplate> templates =
    CometChatUIKit.getDataSource().getMessageTemplates(new AdditionParameter());
templates.add(template);                 // keep text/image/video/file/… + add yours
messageList.setTemplates(templates);
```

> **The #1 custom-bubble mistake:** `setTemplates(singletonList(myTemplate))` replaces the entire template set, so every default bubble (text, image, video, audio, file, …) stops rendering. Always seed the list from `CometChatUIKit.getDataSource().getMessageTemplates(new AdditionParameter())` and `add()` your template — or register a `DataSourceDecorator` (§3) so the append applies app-wide.

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

// APPEND to defaults — don't replace.
// ❌ messageList.setTemplates(listOf(template))  // wipes ALL default bubbles
val templates = CometChatUIKit.getDataSource().getMessageTemplates(AdditionParameter())
templates.add(template)
messageList.setTemplates(templates)
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

Custom actions in the message long-press menu. `CometChatMessageOption extends CometChatOption`. Verified constructor (`CometChatMessageOption.java:43`):

```java
public CometChatMessageOption(@NotNull String id, @NotNull String title, @ColorInt int icon, OnClick onClick)
```

**Java:**
```java
CometChatMessageOption option = new CometChatMessageOption(
    "bookmark",                    // unique ID
    "Bookmark",                    // title
    R.drawable.ic_bookmark,        // icon — see note below
    () -> {                        // onClick (com.cometchat.chatuikit.shared.interfaces.OnClick)
        // Handle bookmark action
    }
);
```

> **Icon-param quirk:** the 4-arg constructor's third param is annotated `@ColorInt int icon`, but the kit's own decorators pass a **drawable** resource here (e.g. `MessageTranslationDecorator.java:53` passes `R.drawable.cometchat_ic_translate`). Pass your `R.drawable.*` id — the annotation is misleading, the runtime treats it as a drawable. The 7-arg constructor (`CometChatMessageOption.java:58`) adds `titleColor`, `iconTintColor`, `titleAppearance` if you need styling.

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

### The four customization scenarios (all via the decorator)

The canonical Android V5 extension surface is the `DataSource` chain. The four most common requests each map to **one overridden method** on your `DataSourceDecorator`. Every override **must call `super.*` first** and append — returning a fresh list/template wipes the kit's defaults. These are the exact methods + signatures the kit's own extensions use; cited file:line for each.

#### Scenario 1 — Register a custom message type (new bubble)

Override `getMessageTemplates(...)` and append a `CometChatMessageTemplate` whose `setCategory(...)` is `UIKitConstants.MessageCategory.CUSTOM` and whose `setType(...)` is your custom type string. Render its bubble with `setContentView(MessagesViewHolderListener)`. This mirrors `PollsExtensionDecorator.getMessageTemplates` (`PollsExtensionDecorator.java:82-86`) + `getPollTemplate` (`PollsExtensionDecorator.java:220-309`).

**Java:**
```java
@Override
public List<CometChatMessageTemplate> getMessageTemplates(@NonNull AdditionParameter additionParameter) {
    List<CometChatMessageTemplate> templates = super.getMessageTemplates(additionParameter); // keep defaults
    templates.add(getLocationTemplate(additionParameter));
    return templates;
}

private CometChatMessageTemplate getLocationTemplate(@NonNull AdditionParameter additionParameter) {
    return new CometChatMessageTemplate()
        .setCategory(UIKitConstants.MessageCategory.CUSTOM)   // CUSTOM, not MESSAGE
        .setType("location")                                  // your custom type
        // setOptions: Function3<Context, BaseMessage, Group, List<CometChatMessageOption>>
        .setOptions((context, baseMessage, group) ->
            ChatConfigurator.getDataSource().getCommonOptions(context, baseMessage, group, additionParameter))
        .setContentView(new MessagesViewHolderListener() {
            @Override
            public View createView(Context context, CometChatMessageBubble messageBubble,
                                   UIKitConstants.MessageBubbleAlignment alignment) {
                return LayoutInflater.from(context).inflate(R.layout.custom_location_bubble, null);
            }
            @Override
            public void bindView(Context context, View createdView, BaseMessage message,
                                 UIKitConstants.MessageBubbleAlignment alignment,
                                 RecyclerView.ViewHolder holder, List<BaseMessage> messageList, int position) {
                // bind from (CustomMessage) message customData
            }
        });
}
```

> You usually also want the type to count as a known type: override `getDefaultMessageTypes(...)` / `getDefaultMessageCategories(...)` and append your type / `MessageCategory.CUSTOM` (Polls does exactly this — `PollsExtensionDecorator.java:171-186`).

#### Scenario 2 — Override an existing built-in type's bubble

Do **not** rebuild the template list. Override the per-type template getter and mutate the template returned by `super`. The verified getters on `DataSource` are `getTextTemplate(AdditionParameter)`, `getImageTemplate`, `getVideoTemplate`, `getAudioTemplate`, `getFileTemplate` (`DataSource.java:230-244`), plus the lookup `getMessageTemplate(String category, String type, AdditionParameter)` (`DataSource.java:260`). The decorator forwards each to the wrapped source (`DataSourceDecorator.java:598`, `:652`), so call `super` then re-skin only the slot you want.

**Java:**
```java
@Override
public CometChatMessageTemplate getTextTemplate(@NonNull AdditionParameter additionParameter) {
    CometChatMessageTemplate template = super.getTextTemplate(additionParameter); // keeps type/category/options
    template.setContentView(new MessagesViewHolderListener() {                    // swap only the content slot
        @Override
        public View createView(Context context, CometChatMessageBubble messageBubble,
                               UIKitConstants.MessageBubbleAlignment alignment) {
            return LayoutInflater.from(context).inflate(R.layout.my_text_bubble, null);
        }
        @Override
        public void bindView(Context context, View createdView, BaseMessage message,
                             UIKitConstants.MessageBubbleAlignment alignment,
                             RecyclerView.ViewHolder holder, List<BaseMessage> messageList, int position) {
            ((TextView) createdView.findViewById(R.id.body)).setText(((TextMessage) message).getText());
        }
    });
    return template;
}
```

> `setContentView`/`setBubbleView`/`setHeaderView`/`setBottomView`/`setStatusInfoView`/`setFooterView`/`setReplyView` all take a `MessagesViewHolderListener` and return the template (`CometChatMessageTemplate.java:79-202`) — pick the slot you need. Overriding `getTextTemplate` reskins **every** text bubble app-wide while preserving its default options/category/type.

#### Scenario 3 — Add a composer attachment option

Override `getAttachmentOptions(...)`, call `super`, and append a `CometChatMessageComposerAction` (a builder — `setId/setTitle/setIcon/setOnClick`, `CometChatMessageComposerAction.java:46-127`). This is exactly `PollsExtensionDecorator.getAttachmentOptions` (`PollsExtensionDecorator.java:88-168`).

**Java:**
```java
@Override
public List<CometChatMessageComposerAction> getAttachmentOptions(Context context, User user,
        Group group, HashMap<String, String> idMap, @NonNull AdditionParameter additionParameter) {
    List<CometChatMessageComposerAction> options =
        super.getAttachmentOptions(context, user, group, idMap, additionParameter); // keep camera/gallery/file/poll/…
    options.add(new CometChatMessageComposerAction()
        .setId("location")
        .setTitle("Send Location")
        .setIcon(R.drawable.ic_location)
        .setOnClick(() -> { /* pick + send (see below) */ }));
    return options;
}
```

#### Scenario 4 — Add a message long-press option (Forward-style)

Override the **per-type** option getter — `getTextMessageOptions`, `getImageMessageOptions`, `getVideoMessageOptions`, `getAudioMessageOptions`, or `getFileMessageOptions` (`DataSource.java:49-108`) — call `super`, then append a `CometChatMessageOption`. This is exactly `MessageTranslationDecorator.getTextMessageOptions` (`MessageTranslationDecorator.java:44-59`).

**Java:**
```java
@Override
public List<CometChatMessageOption> getTextMessageOptions(Context context,
        BaseMessage baseMessage, Group group, @NonNull AdditionParameter additionParameter) {
    List<CometChatMessageOption> options =
        super.getTextMessageOptions(context, baseMessage, group, additionParameter); // keep reply/copy/edit/delete/…
    if (baseMessage != null && baseMessage.getDeletedAt() == 0) {
        options.add(new CometChatMessageOption(
            "forward", "Forward", R.drawable.ic_forward, () -> { /* forward baseMessage */ }));
    }
    return options;
}
```

> `getMessageOptions(...)` (`DataSource.java:271`) is the **aggregate** dispatcher the kit calls per message; it routes to the per-type getters above. To add an option to *one* message type, override that type's getter (as above). Override `getMessageOptions` only when you want the option on **every** message type at once.

> **Append rule (all four):** an override that returns a fresh `new ArrayList<>()` instead of starting from `super.*` wipes every default (bubbles, attachments, or options). Always seed from `super`.

Register the decorator app-wide via `ChatConfigurator.enable(...)` (§"Register via ChatConfigurator" above) — it accepts `Function1<DataSource, DataSource>` (`ChatConfigurator.java:39`). For a packaged two-class extension (registrar + decorator), see `cometchat-android-v5-extensions`.

### Sending a custom message — use the UIKit path, not the raw SDK

```java
CustomMessage message = new CustomMessage(
    receiverId, CometChatConstants.RECEIVER_TYPE_USER,   // or RECEIVER_TYPE_GROUP
    "location",                                          // matches the template type
    customData);                                         // JSONObject
// ✅ kit path — sets muid + sender, fires ccMessageSent → list APPENDS
CometChatUIKit.sendCustomMessage(message, new CometChat.CallbackListener<CustomMessage>() {
    @Override public void onSuccess(CustomMessage m) { }
    @Override public void onError(CometChatException e) { }
});
// ❌ CometChat.sendCustomMessage(...) — no muid/sender/event → recipient error + realtime replace
```

Verified against kit source (chat-uikit-android 5.x):
- `CometChatUIKit.getDataSource()`, `ChatConfigurator.getDataSource()` / `ChatConfigurator.enable(Function1<DataSource,DataSource>)` (`ChatConfigurator.java:39,55`)
- `DataSource.getMessageTemplates(AdditionParameter)` (`DataSource.java:248`); per-type template getters `getTextTemplate/getImageTemplate/getVideoTemplate/getAudioTemplate/getFileTemplate(AdditionParameter)` (`DataSource.java:230-244`); lookup `getMessageTemplate(String category, String type, AdditionParameter)` (`DataSource.java:260`)
- Per-type option getters `getTextMessageOptions/getImageMessageOptions/getVideoMessageOptions/getAudioMessageOptions/getFileMessageOptions(Context, BaseMessage, Group, AdditionParameter)` (`DataSource.java:49-108`); aggregate `getMessageOptions(...)` (`DataSource.java:271`)
- `DataSource.getAttachmentOptions(Context, User, Group, HashMap, AdditionParameter)` (`DataSource.java:286`)
- `CometChatMessageTemplate` setters `setType/setCategory(String)`, `setOptions(Function3<Context,BaseMessage,Group,List<CometChatMessageOption>>)`, `setContentView/setBubbleView/setHeaderView/setBottomView/setStatusInfoView/setFooterView/setReplyView(MessagesViewHolderListener)` (`CometChatMessageTemplate.java:79-237`)
- `CometChatMessageComposerAction` builder `setId/setTitle/setIcon/setOnClick(...)` (`CometChatMessageComposerAction.java:46-127`); `CometChatMessageOption(String,String,int,OnClick)` (`CometChatMessageOption.java:43`)
- `MessagesViewHolderListener.createView(...)` + `bindView(...)` (`MessagesViewHolderListener.java:18-26`)
- `CometChatUIKit.sendCustomMessage(CustomMessage, CallbackListener)`
- Canonical reference decorators: `PollsExtensionDecorator.java` (template + attachment), `MessageTranslationDecorator.java` (message option)

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

## Sound (in-app message + call sounds)

The V5 UI Kit surfaces `CometChatSoundManager` for incoming/outgoing message + call sounds (mute / custom audio). **V5 is legacy/maintenance-only** — V6 is the current cohort. For call sounds see this family's `-calls` skill; verify the `CometChatSoundManager` API against the installed kit before relying on it.
