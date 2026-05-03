---
name: cometchat-android-v6-compose-customization
description: "CometChat Android UIKit v6 Compose customization — BubbleFactory interface, slot lambdas, @Immutable style classes, and per-slot overrides"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, compose, customization, bubble-factory, slots, style"
---

> **Companion skills:** cometchat-android-v6-kotlin-customization (Views equivalent), cometchat-android-v6-compose-components, cometchat-android-v6-compose-theming, cometchat-android-v6-extensions (DataSource layer), cometchat-android-v6-events

## Purpose

Customize CometChat Compose components — override message bubble rendering with BubbleFactory, use slot lambda parameters for per-slot overrides, and apply @Immutable style classes. This is the v6 replacement for v5's DataSource/ChatConfigurator pattern.

## Use this skill when

- Creating custom message bubble rendering for specific message types
- Overriding individual bubble slots (avatar, header, footer, content, etc.)
- Applying custom styles to components
- Replacing the entire bubble layout for a message type

## Do not use this skill when

- Working with Kotlin Views customization (use `cometchat-android-v6-kotlin-customization`)
- Changing theme colors globally (use `cometchat-android-v6-compose-theming`)
- Extending the data layer (use `cometchat-android-v6-extensions`)

## 1. BubbleFactory (Message Bubble Customization)

`BubbleFactory` is an interface in `com.cometchat.uikit.compose.presentation.shared.messagebubble`. Each implementation handles a specific message type.

### 1.1 Creating a Custom BubbleFactory

```kotlin
import com.cometchat.uikit.compose.presentation.shared.messagebubble.BubbleFactory
import com.cometchat.chat.constants.CometChatConstants
import com.cometchat.chat.models.BaseMessage
import com.cometchat.uikit.core.constants.UIKitConstants.MessageBubbleAlignment

class LocationBubbleFactory : BubbleFactory {

    override fun getCategory(): String = CometChatConstants.CATEGORY_CUSTOM
    override fun getType(): String = "location"

    override fun getContentView(
        message: BaseMessage,
        alignment: MessageBubbleAlignment,
        style: CometChatMessageBubbleStyle,
        textFormatters: List<CometChatTextFormatter>
    ): @Composable () -> Unit = {
        // Your custom content composable
        val metadata = message.metadata
        val lat = metadata?.optDouble("latitude") ?: 0.0
        val lng = metadata?.optDouble("longitude") ?: 0.0
        LocationMapView(latitude = lat, longitude = lng)
    }
}
```

### 1.2 Registering BubbleFactories

```kotlin
CometChatMessageList(
    user = user,
    bubbleFactories = listOf(
        LocationBubbleFactory(),
        PaymentBubbleFactory()
    )
)
```

The list is converted to a map keyed by `"category_type"` internally via `toFactoryMap()`.

### 1.3 Complete Bubble Replacement

Override `getBubbleView()` to replace the ENTIRE bubble (all slots):

```kotlin
class CustomBubbleFactory : BubbleFactory {
    override fun getCategory(): String = "custom"
    override fun getType(): String = "payment"

    override fun getBubbleView(
        message: BaseMessage,
        alignment: MessageBubbleAlignment
    ): (@Composable () -> Unit)? = {
        // Complete custom bubble — no header, footer, avatar, etc.
        PaymentCard(message = message, alignment = alignment)
    }
}
```

When `getBubbleView()` returns non-null, all other slot methods are ignored.

### 1.4 Slot Methods

All return `(@Composable () -> Unit)?` — return `null` to use defaults:

| Method | Slot | Parameters |
|---|---|---|
| `getContentView()` | Main content | `message, alignment, style, textFormatters` |
| `getLeadingView()` | Avatar | `message, alignment, style` |
| `getHeaderView()` | Sender name | `message, alignment, style, showTime` |
| `getReplyView()` | Reply preview | `message, alignment, style` |
| `getBottomView()` | Moderation | `message, alignment, style, hideModerationView` |
| `getStatusInfoView()` | Timestamp/receipts | `message, alignment, style, showTime` |
| `getThreadView()` | Thread indicator | `message, alignment, style, onThreadRepliesClick` |
| `getFooterView()` | Reactions | `message, alignment, style, onReactionClick, onReactionLongClick, onAddMoreReactionsClick` |

### 1.5 Style Override

```kotlin
override fun getBubbleStyle(
    message: BaseMessage,
    alignment: MessageBubbleAlignment
): CometChatMessageBubbleStyle? {
    return CometChatMessageBubbleStyle(
        backgroundColor = Color(0xFFE8F5E9),
        cornerRadius = 16.dp
    )
}
```

Factory style is the highest priority in the 3-tier style chain.

### 1.6 Lifecycle

```kotlin
override fun onDispose(message: BaseMessage) {
    // Clean up resources when bubble leaves composition
}
```

## 2. Slot Lambda Parameters (Per-Slot Overrides)

Override individual slots across ALL message types directly on `CometChatMessageList`:

```kotlin
CometChatMessageList(
    user = user,

    // Custom avatar for all messages
    leadingView = { message, alignment ->
        if (alignment == MessageAlignment.LEFT) {
            AsyncImage(
                model = message.sender?.avatar,
                contentDescription = null,
                modifier = Modifier.size(32.dp).clip(CircleShape)
            )
        }
    },

    // Custom timestamp for all messages
    statusInfoView = { message, alignment ->
        Text(
            text = formatTime(message.sentAt),
            style = CometChatTheme.typography.caption1Regular,
            color = CometChatTheme.colorScheme.textColorTertiary
        )
    },

    // Custom footer for all messages
    footerView = { message, alignment ->
        // Custom reactions display
        ReactionsRow(message = message)
    }
)
```

### 2.1 All Slot Parameters

| Parameter | Type | Slot |
|---|---|---|
| `leadingView` | `@Composable (BaseMessage, MessageAlignment) -> Unit` | Avatar |
| `headerView` | `@Composable (BaseMessage, MessageAlignment) -> Unit` | Sender name |
| `replyView` | `@Composable (BaseMessage, MessageAlignment) -> Unit` | Reply preview |
| `contentView` | `@Composable (BaseMessage, MessageAlignment) -> Unit` | Main content |
| `bottomView` | `@Composable (BaseMessage, MessageAlignment) -> Unit` | Moderation |
| `statusInfoView` | `@Composable (BaseMessage, MessageAlignment) -> Unit` | Timestamp/receipts |
| `threadView` | `@Composable (BaseMessage, MessageAlignment) -> Unit` | Thread indicator |
| `footerView` | `@Composable (BaseMessage, MessageAlignment) -> Unit` | Reactions |

### 2.2 Priority Order

For each slot, the resolution order is:
1. Explicit slot lambda parameter (highest priority)
2. BubbleFactory slot method
3. Internal default rendering

## 3. Style Classes

### 3.1 Using Style Classes

```kotlin
CometChatConversations(
    style = CometChatConversationsStyle.default(
        backgroundColor = Color(0xFFF5F5F5),
        titleTextColor = Color.Black,
        titleTextStyle = CometChatTheme.typography.heading1Bold,
        separatorColor = Color.LightGray,
        itemStyle = CometChatConversationListItemStyle.default(
            titleTextColor = Color.DarkGray
        )
    )
)
```

### 3.2 Style Class Pattern

All style classes follow this pattern:

```kotlin
@Immutable
data class CometChatConversationsStyle(
    val backgroundColor: Color,
    val titleTextColor: Color,
    val titleTextStyle: TextStyle,
    // ... many properties
) {
    companion object {
        @Composable
        fun default(
            backgroundColor: Color = CometChatTheme.colorScheme.backgroundColor1,
            titleTextColor: Color = CometChatTheme.colorScheme.textColorPrimary,
            // ... defaults from CometChatTheme
        ): CometChatConversationsStyle = CometChatConversationsStyle(/* ... */)
    }
}
```

Use `Companion.default()` with named parameter overrides — never call the data class constructor directly.

### 3.3 Nested Styles

Some styles contain nested style classes:

```kotlin
CometChatConversationsStyle.default(
    itemStyle = CometChatConversationListItemStyle.default(/* ... */),
    popupMenuStyle = CometChatPopupMenuStyle.default(/* ... */),
    emptyStateStyle = CometChatEmptyStateStyle.default(/* ... */),
    errorStateStyle = CometChatErrorStateStyle.default(/* ... */),
    loadingStateStyle = CometChatLoadingStateStyle.default(/* ... */),
    dialogStyle = CometChatDialogStyle.default(/* ... */)
)
```

## 4. Custom State Views

```kotlin
CometChatMessageList(
    user = user,
    loadingView = { CircularProgressIndicator() },
    emptyView = { Text("No messages yet") },
    errorView = { Text("Something went wrong") }
)
```

## 5. v5 → v6 Migration

| v5 Pattern | v6 Pattern |
|---|---|
| `ChatConfigurator.enable(decorator)` | `CometChatMessageList(bubbleFactories = listOf(...))` |
| DataSource template methods | BubbleFactory slot methods |
| Global decorator chain | Per-component factory registration |
| No bubble replacement | `getBubbleView()` for complete replacement |
| Theme-level styling only | Per-factory `getBubbleStyle()` |

## Hard rules

- BubbleFactory is an `interface` — implement it, don't extend an abstract class
- `getCategory()` and `getType()` are REQUIRED — they identify which message type the factory handles
- When `getBubbleView()` returns non-null, ALL other slot methods are ignored for that message type
- Slot lambda parameters on `CometChatMessageList` override BubbleFactory slot methods — use lambdas for cross-type overrides, factories for per-type overrides
- Style classes must use `Companion.default()` factory — the data class constructor requires ALL parameters
- Do NOT confuse BubbleFactory (UI rendering) with DataSource (data fetching) — they are separate layers
