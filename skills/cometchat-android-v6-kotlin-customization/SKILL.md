---
name: cometchat-android-v6-kotlin-customization
description: "CometChat Android UIKit v6 Kotlin Views customization — BubbleFactory abstract class, BubbleViewProvider, style classes, and per-slot overrides"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-kotlin-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, kotlin-views, customization, bubble-factory, bubble-view-provider, style"
---

> **Ground truth:** `com.cometchat:chatuikit-{compose,kotlin}-android:6.x` (+ `calls-sdk-android:5.x`) — resolved AAR (javap) + `ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

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

### 1.8 Registering a factory is already additive — built-ins are NOT in the map

`CometChatMessageList` exposes exactly two factory APIs (`CometChatMessageList.kt:3376 / :3395`):

- `setBubbleFactories(factories: List<BubbleFactory>)` — sets the custom factory map
- `getBubbleFactories(): Map<String, BubbleFactory>` — returns an immutable copy

There is **NO** settable `bubbleFactories` property and **NO** `removeBubbleFactory(...)` on `CometChatMessageList` (`removeBubbleFactory` exists only on the internal `MessageAdapter`, `MessageAdapter.kt:1534` — not public API).

`setBubbleFactories` does NOT wipe built-in bubbles, because **built-in types are never stored as factory entries.** The adapter starts with an empty factory map (`MessageAdapter.kt:153` "The adapter starts with an empty bubbleFactories map"); when a message's `"category_type"` key has no factory, the bubble falls back to `InternalContentRenderer`. So passing only your custom factories is correct and safe:

```kotlin
messageList.setBubbleFactories(listOf(
    LocationBubbleFactory(),     // custom_location
    PaymentBubbleFactory()       // custom_payment
))
// text/image/video/etc. still render via InternalContentRenderer — untouched
```

`setBubbleFactories` replaces the *custom* factory set, so include every custom factory you want active in the single list. `BubbleFactory.getKey(category, type)` and `BubbleFactory.getFactoryKey(message)` (companion, `BubbleFactory.kt:441 / :425`) are still available if you need the key string.

### 1.9 Custom attachment options (Scenario 3)

`CometChatMessageComposer` exposes `addAttachmentOption(action)` (append one) and `setAttachmentOptions(list)` (set the custom list) — `CometChatMessageComposer.kt:4951 / :4930`, both delegate to the shared `CometChatMessageComposerViewModel`.

**Neither call drops the built-in options.** Both touch only the *custom* options list (`_customAttachmentOptions`); the defaults (camera/image/video/audio/document/poll/collab-doc/collab-whiteboard) are rebuilt every time by `getDefaultAttachmentOptions(...)` and the custom ones are appended at the end (`CometChatMessageComposerViewModel.kt:646-649`). So `setAttachmentOptions(listOf(location))` keeps the defaults too — it just replaces any *previously-set custom* options. Use `addAttachmentOption` to add one without disturbing other custom options:

```kotlin
val location = CometChatMessageComposerAction(
    id = "location",
    title = "Send Location",
    icon = R.drawable.ic_location,
    onClick = OnClick { /* pick + send (see 1.10) */ }
)
messageComposer.addAttachmentOption(location)        // appends one custom option
// setAttachmentOptions(listOf(location)) also keeps camera/image/etc. — it only resets the custom list
```

> To hide a built-in option, use the composer visibility setters (e.g. `setPollOptionVisibility(View.GONE)`), which flip the `_show*Option` flags `getDefaultAttachmentOptions` checks. The built-in IDs are constants on `CometChatMessageComposerAction` (`ID_CAMERA`…`ID_COLLABORATIVE_WHITEBOARD`, `CometChatMessageComposerAction.kt:42-49`).

### 1.10 Sending a custom message — use the UIKit path, not the raw SDK

```kotlin
val message = CustomMessage(
    receiverId,
    CometChatConstants.RECEIVER_TYPE_USER,   // or RECEIVER_TYPE_GROUP
    "location",                              // matches the BubbleFactory type
    customData                               // org.json.JSONObject
)
// ✅ kit path — sets muid + sender, fires ccMessageSent → list APPENDS
CometChatUIKit.sendCustomMessage(message, object : CometChat.CallbackListener<CustomMessage>() {
    override fun onSuccess(p0: CustomMessage) {}
    override fun onError(p0: CometChatException) {}
})
// ❌ CometChat.sendCustomMessage(...) — no muid/sender/event → recipient error + realtime replace
```

Verified (v6 Kotlin Views): `CometChatMessageList.setBubbleFactories(List) / getBubbleFactories(): Map` (`CometChatMessageList.kt:3376 / :3395`), `CometChatMessageComposer.addAttachmentOption / setAttachmentOptions` (`:4951 / :4930`), `CometChatUIKit.sendCustomMessage(CustomMessage, CallbackListener)` (`CometChatUIKit.kt:472`). Note: `messageList.bubbleFactories = …` (property) and `CometChatMessageList.removeBubbleFactory(...)` are NOT public — do not use.

### 1.11 Override an EXISTING type's bubble (Scenario 2)

To replace a built-in type's rendering, subclass `BubbleFactory` with `getCategory()`/`getType()` set to the built-in identifiers, then register it. As in §1.8, built-ins are not factory entries — a matching factory simply takes priority over `InternalContentRenderer`.

```kotlin
import com.cometchat.chat.constants.CometChatConstants

class MyTextBubbleFactory : BubbleFactory() {
    override fun getCategory(): String = CometChatConstants.CATEGORY_MESSAGE   // "message"
    override fun getType(): String = CometChatConstants.MESSAGE_TYPE_TEXT      // "text"

    override fun createContentView(context: Context): View = MyTextContentView(context)

    override fun bindContentView(
        view: View,
        message: BaseMessage,
        alignment: UIKitConstants.MessageBubbleAlignment,
        holder: RecyclerView.ViewHolder?,
        position: Int
    ) {
        (view as MyTextContentView).bind(message as TextMessage)
    }
    // …or override createBubbleView()/bindBubbleView() (see 1.3) to replace the whole bubble
}

messageList.setBubbleFactories(listOf(MyTextBubbleFactory()))
```

Only `message_text` is overridden; other types keep their internal rendering.

### 1.12 Add a long-press message option (Scenario 4 — Forward-style)

`CometChatMessageList` resolves the long-press option sheet through the shared view model. Two public setters control it (`CometChatMessageList.kt:3697 / :3709`):

- `setOptions(callback: (BaseMessage) -> List<CometChatMessageOption>?)` — **replaces** defaults when the callback returns non-null (return `null` to keep them); takes precedence over `addOptions`.
- `addOptions(callback: (BaseMessage) -> List<CometChatMessageOption>)` — **appends** after the defaults; invoked only when `setOptions` is unset or returns `null`.

Use `addOptions` so the built-in Reply/Copy/Edit/Delete survive:

```kotlin
import com.cometchat.uikit.core.domain.model.CometChatMessageOption

messageList.addOptions { message ->          // ✅ appended to defaults
    listOf(
        CometChatMessageOption(
            id = "forward",
            title = "Forward",
            icon = R.drawable.ic_forward,
            onClick = { /* open forward picker for `message` */ }
        )
    )
}
// ❌ messageList.setOptions { listOf(forward) }   // would DROP reply/copy/edit/delete
```

For the click handler use `setMessageOptionClickListener(MessageOptionClickListener)` (`CometChatMessageList.kt:3671`). Resolution order verified in `CometChatMessageListViewModel.resolveMessageOptions` (`:817-827`): `setOptions` non-null wins, else `defaultOptions + addOptions`. `CometChatMessageOption(id, title, …, onClick)` is a data class at `CometChatMessageOption.kt:21`.

### 1.13 MessageTemplate via the DataSource (docs-taught alternative to BubbleFactory)

> ⚠️ **Verify before using — symbols not found in the GA v6 Kotlin-Views source.** `CometChatUIKit.getDataSource()`, `getMessageTemplates()`, `CometChatMessageTemplate`, `setTemplates(...)`, and `MessagesViewHolderListener` appear in the Android **docs** but are **absent from the verified `com.cometchat.uikit.kotlin` / `chatuikit-core` GA source** (they're the legacy `com.cometchat.chatuikit` v5-shaped API). Treat this section as a docs reference that may not compile against your installed v6 kit — **prefer `BubbleFactory` / `BubbleViewProvider` (the confirmed v6-native path) for all new code.**

The `BubbleFactory` / `BubbleViewProvider` surface above is the primary v6 customization path. The Android docs also teach a **`MessageTemplate`** path through the data source ([message-template](https://www.cometchat.com/docs/ui-kit/android/v6/message-template)) — fetch the existing templates, mutate the one you want via the `MessagesViewHolderListener` create/bind pair, then re-apply with `setTemplates(...)` (append, never replace with a single-item list):

```kotlin
// 1. fetch existing templates from the data source
val templates = CometChatUIKit.getDataSource()
    .getMessageTemplates(messageList.additionParameter)
    .toMutableList()

// 2. mutate the matched template (or build a new one for a custom type)
templates.find { it.type == UIKitConstants.MessageType.TEXT }
    ?.setContentView(object : MessagesViewHolderListener() {
        override fun createView(context: Context, bubble: CometChatMessageBubble,
            alignment: UIKitConstants.MessageBubbleAlignment): View =
            LayoutInflater.from(context).inflate(R.layout.your_custom_layout, null)
        override fun bindView(context: Context, view: View, message: BaseMessage,
            alignment: UIKitConstants.MessageBubbleAlignment,
            viewHolder: RecyclerView.ViewHolder, list: List<BaseMessage>, i: Int) { /* bind */ }
    })
// new custom type:
val contact = CometChatMessageTemplate().apply {
    setType("contact"); setCategory(UIKitConstants.MessageCategory.CUSTOM)
    setContentView(/* MessagesViewHolderListener */)
}
templates.add(contact)

// 3. re-apply — Views uses setTemplates(...)
messageList.setTemplates(templates)
```

Views templates expose listener-based slot setters (`setContentView`, `setHeaderView`, `setFooterView`, `setBottomView`, `setStatusInfoView`, `setBubbleView`, `setOptions`) mirroring §1.4's slots. Prefer `BubbleFactory` for new code; use `getMessageTemplates(...)` + `setTemplates(...)` when you want to start from the kit's defaults and tweak one type. (This overlaps the custom-message topic.)

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

## Text formatters (inline mentions / URLs / custom tokens)

Style/transform message text inline via `setTextFormatters(...)` on the composer and message list. The kit ships `CometChatMentionsFormatter` + `CometChatRichTextFormatter` (subclasses of the abstract `CometChatTextFormatter`) in `com.cometchat.uikit.kotlin.shared.formatters`. To ADD a custom one, include the defaults too (a bare list replaces them).

```kotlin
import com.cometchat.uikit.kotlin.shared.formatters.CometChatMentionsFormatter
import com.cometchat.uikit.kotlin.shared.formatters.CometChatTextFormatter

val formatters = listOf<CometChatTextFormatter>(CometChatMentionsFormatter(context) /* , YourFormatter(context) */)
composer.setTextFormatters(formatters)      // fun setTextFormatters(List<CometChatTextFormatter>?)
messageList.setTextFormatters(formatters)
```

For a custom @/#/! token: subclass `CometChatTextFormatter(trackingCharacter)` and implement its `search()` + view hooks (the kit's `shared/formatters/README.md` shows the mentions example: `setMentionLimit` / `setMentionsType` / `setOnMentionClick` / `setMentionStyle`).

## Hard rules

- BubbleFactory is an `abstract class` — extend it with `BubbleFactory()`
- `create*()` methods are called WITHOUT a message — do NOT access message data in create methods
- `bind*()` methods receive the message — all message-specific logic goes here
- BubbleViewProvider overrides take precedence over BubbleFactory slot methods
- For per-type content customization, use BubbleFactory. For cross-type slot overrides, use BubbleViewProvider
- `onViewRecycled()` is critical for cleaning up image loads, animations, or media playback
- Do NOT confuse BubbleFactory (UI rendering) with DataSource (data fetching) — they are separate layers

## Sound (in-app message + call sounds)

Sound is a customization sub-dimension. The UI Kit plays incoming/outgoing message + call sounds via `CometChatSoundManager` — mute it, swap custom audio, or play a specific sound. The full API + recipe lives in **`cometchat-android-v6-kotlin-theming`** (Sound section). Verify the access path against the installed kit before relying on it.
