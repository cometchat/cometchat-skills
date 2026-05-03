---
name: cometchat-android-v6-kotlin-customization
description: "CometChat Android UIKit v6 Kotlin Views customization — BubbleFactory abstract class, BubbleViewProvider, style classes, and per-slot overrides"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, kotlin-views, customization, bubble-factory, bubble-view-provider, style"
---

> **Companion skills:** cometchat-android-v6-compose-customization (Compose equivalent), cometchat-android-v6-kotlin-components, cometchat-android-v6-kotlin-theming, cometchat-android-v6-extensions (DataSource layer), cometchat-android-v6-events

## Purpose

Customize CometChat Kotlin Views components — override message bubble rendering with BubbleFactory, use BubbleViewProvider for per-slot overrides, and apply style classes. This is the v6 replacement for v5's DataSource/ChatConfigurator pattern.

## Use this skill when

- Creating custom message bubble rendering for specific message types
- Overriding individual bubble slots (avatar, header, footer, content, etc.)
- Applying custom styles to components
- Replacing the entire bubble layout for a message type

## Do not use this skill when

- Working with Compose customization (use `cometchat-android-v6-compose-customization`)
- Changing theme colors globally (use `cometchat-android-v6-kotlin-theming`)
- Extending the data layer (use `cometchat-android-v6-extensions`)

## 1. BubbleFactory (Message Bubble Customization)

`BubbleFactory` is an abstract class in `com.cometchat.uikit.kotlin.presentation.shared.messagebubble`. Each subclass handles a specific message type.

### 1.1 Creating a Custom BubbleFactory

```kotlin
import com.cometchat.uikit.kotlin.presentation.shared.messagebubble.BubbleFactory
import com.cometchat.chat.constants.CometChatConstants
import com.cometchat.chat.models.BaseMessage
import com.cometchat.uikit.core.constants.UIKitConstants.MessageBubbleAlignment

class LocationBubbleFactory : BubbleFactory() {

    override fun getCategory(): String = CometChatConstants.CATEGORY_CUSTOM
    override fun getType(): String = "location"

    override fun createContentView(context: Context): View {
        // Called ONCE when ViewHolder is created — message NOT available here
        return LocationMapView(context)
    }

    override fun bindContentView(
        view: View,
        message: BaseMessage,
        alignment: MessageBubbleAlignment,
        holder: RecyclerView.ViewHolder?,
        position: Int
    ) {
        // Called EVERY TIME a message is displayed
        val mapView = view as LocationMapView
        val metadata = message.metadata
        mapView.setLocation(
            metadata?.optDouble("latitude") ?: 0.0,
            metadata?.optDouble("longitude") ?: 0.0
        )
    }
}
```

### 1.2 Registering BubbleFactories

```kotlin
val messageList = findViewById<CometChatMessageList>(R.id.messageList)
messageList.setBubbleFactories(listOf(
    LocationBubbleFactory(),
    PaymentBubbleFactory()
))
```

The list is converted to a map keyed by `"category_type"` internally.

### 1.3 Complete Bubble Replacement

Override `createBubbleView()` / `bindBubbleView()` to replace the ENTIRE bubble:

```kotlin
class CustomBubbleFactory : BubbleFactory() {
    override fun getCategory(): String = "custom"
    override fun getType(): String = "payment"

    override fun createBubbleView(context: Context): View? {
        // Return non-null to replace the entire CometChatMessageBubble
        return PaymentCardView(context)
    }

    override fun bindBubbleView(
        view: View,
        message: BaseMessage,
        alignment: MessageBubbleAlignment,
        holder: RecyclerView.ViewHolder?,
        position: Int
    ) {
        (view as PaymentCardView).bind(message)
    }
}
```

When `createBubbleView()` returns non-null, `createContentView()` and all other slot methods are ignored.

### 1.4 Slot Methods

All follow the create/bind pattern for RecyclerView efficiency:

| Create Method | Bind Method | Slot |
|---|---|---|
| `createContentView(ctx): View` | `bindContentView(view, msg, align, holder, pos)` | Main content |
| `createLeadingView(ctx): View?` | `bindLeadingView(view, msg, align)` | Avatar |
| `createHeaderView(ctx): View?` | `bindHeaderView(view, msg, align)` | Sender name |
| `createReplyView(ctx): View?` | `bindReplyView(view, msg, align)` | Reply preview |
| `createBottomView(ctx): View?` | `bindBottomView(view, msg, align)` | Reactions |
| `createStatusInfoView(ctx): View?` | `bindStatusInfoView(view, msg, align)` | Timestamp/receipts |
| `createThreadView(ctx): View?` | `bindThreadView(view, msg, align)` | Thread indicator |
| `createFooterView(ctx): View?` | `bindFooterView(view, msg, align)` | Footer |

**Critical:** `create*()` methods are called when the ViewHolder is created — the message is NOT available. All message-specific logic goes in `bind*()`.

### 1.5 Style Override

```kotlin
override fun getBubbleStyle(
    message: BaseMessage,
    alignment: MessageBubbleAlignment
): CometChatMessageBubbleStyle? {
    // Highest priority in the 3-tier style chain
    return CometChatMessageBubbleStyle(/* custom style */)
}
```

### 1.6 Lifecycle

```kotlin
override fun onViewRecycled(contentView: View) {
    // Clean up resources (image loads, animations, media playback)
}
```

### 1.7 Factory Key

```kotlin
// Get the factory key for a message
val key = BubbleFactory.getFactoryKey(message) // "category_type" or "deleted"

// Create a key manually
val key = BubbleFactory.getKey("custom", "location") // "custom_location"
```

## 2. BubbleViewProvider (Per-Slot Overrides)

`BubbleViewProvider` is a simpler interface for overriding individual slots across ALL message types.

### 2.1 Interface

```kotlin
interface BubbleViewProvider {
    fun createView(
        context: Context,
        message: BaseMessage,
        alignment: MessageBubbleAlignment
    ): View?

    fun bindView(
        view: View,
        message: BaseMessage,
        alignment: MessageBubbleAlignment
    )
}
```

### 2.2 Usage

```kotlin
val messageList = findViewById<CometChatMessageList>(R.id.messageList)

// Custom avatar for all messages
messageList.setLeadingViewProvider(object : BubbleViewProvider {
    override fun createView(
        context: Context,
        message: BaseMessage,
        alignment: MessageBubbleAlignment
    ): View? {
        return if (alignment == MessageBubbleAlignment.LEFT) {
            ImageView(context).apply {
                layoutParams = ViewGroup.LayoutParams(32.dp, 32.dp)
            }
        } else null
    }

    override fun bindView(
        view: View,
        message: BaseMessage,
        alignment: MessageBubbleAlignment
    ) {
        (view as ImageView).load(message.sender?.avatar)
    }
})
```

### 2.3 All Provider Setters

| Method | Slot |
|---|---|
| `setLeadingViewProvider(provider)` | Avatar |
| `setHeaderViewProvider(provider)` | Sender name |
| `setContentViewProvider(provider)` | Main content |
| `setReplyViewProvider(provider)` | Reply preview |
| `setBottomViewProvider(provider)` | Reactions |
| `setStatusInfoViewProvider(provider)` | Timestamp/receipts |
| `setThreadViewProvider(provider)` | Thread indicator |
| `setFooterViewProvider(provider)` | Footer |

### 2.4 Priority Order

For each slot:
1. Explicit `BubbleViewProvider` (highest priority)
2. `BubbleFactory` slot method
3. Internal default rendering

## 3. Component-Level Customization

### 3.1 Header/Footer Views on MessageList

```kotlin
// Custom header above the message list
messageList.setHeaderView(myCustomHeaderView)

// Custom footer below the message list
messageList.setFooterView(myCustomFooterView)
```

### 3.2 Style Classes

```kotlin
// Style classes resolve from XML attrs and CometChatTheme singleton
val style = CometChatMessageListStyle(/* properties */)
messageList.setStyle(style)
```

## 4. v5 → v6 Migration

| v5 Pattern | v6 Pattern |
|---|---|
| `ChatConfigurator.enable(decorator)` | `messageList.setBubbleFactories(listOf(...))` |
| DataSource template methods | BubbleFactory slot methods |
| Global decorator chain | Per-component factory registration |
| No bubble replacement | `createBubbleView()` for complete replacement |
| Theme-level styling only | Per-factory `getBubbleStyle()` |

## Hard rules

- BubbleFactory is an `abstract class` — extend it with `BubbleFactory()`
- `create*()` methods are called WITHOUT a message — do NOT access message data in create methods
- `bind*()` methods receive the message — all message-specific logic goes here
- BubbleViewProvider overrides take precedence over BubbleFactory slot methods
- For per-type content customization, use BubbleFactory. For cross-type slot overrides, use BubbleViewProvider
- `onViewRecycled()` is critical for cleaning up image loads, animations, or media playback
- Do NOT confuse BubbleFactory (UI rendering) with DataSource (data fetching) — they are separate layers
