---
name: cometchat-android-v6-compose-customization
description: "CometChat Android UIKit v6 Compose customization — BubbleFactory interface, slot lambdas, @Immutable style classes, and per-slot overrides"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, compose, customization, bubble-factory, slots, style"
---

> **Ground truth:** `com.cometchat:chatuikit-{compose,kotlin}-android:6.x` (+ `calls-sdk-android:5.x`) — resolved AAR (javap) + `ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

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

### 1.7 Custom attachment options (Scenario 3) — pass the `attachmentOptions` parameter

A `BubbleFactory` only *renders* a custom type; to let users *create* one you usually add a composer attachment action. On Compose the canonical path is the **`attachmentOptions` parameter** on `CometChatMessageComposer` — a `List<CometChatMessageComposerAction>` whose contents are added **after** the built-in options.

```kotlin
CometChatMessageComposer(
    user = user,
    attachmentOptions = listOf(
        CometChatMessageComposerAction(
            id = "location",
            title = "Send Location",
            icon = R.drawable.ic_location,
            onClick = OnClick { /* pick + send (see 1.8) */ }
        )
    )
)
```

**Append is automatic — your list does NOT replace the defaults.** Internally the composable calls `composerViewModel.setAttachmentOptions(attachmentOptions)` (`CometChatMessageComposer.kt:431-432`), which sets only the *custom* options list (`_customAttachmentOptions`). The defaults (camera/image/video/audio/document/poll/collab-doc/collab-whiteboard) are rebuilt every time by `getDefaultAttachmentOptions(...)` and your custom options are concatenated at the end (`CometChatMessageComposerViewModel.kt:646-649`). There is no "wipe defaults" footgun here — `setAttachmentOptions` despite its name does NOT drop the built-ins.

> Hide a built-in instead with the composer's `hide*Option` flags (e.g. `hidePollOption = true`), which flip the `_show*Option` visibility checked inside `getDefaultAttachmentOptions`.

If you hold a `CometChatMessageComposerViewModel` directly (advanced), `addAttachmentOption(action)` appends one custom option and `setAttachmentOptions(list)` replaces the custom list — both verified at `CometChatMessageComposerViewModel.kt:657 / :666`. The built-in option IDs are constants on `CometChatMessageComposerAction` (`ID_CAMERA`, `ID_IMAGE`, `ID_VIDEO`, `ID_AUDIO`, `ID_DOCUMENT`, `ID_POLL`, `ID_COLLABORATIVE_DOCUMENT`, `ID_COLLABORATIVE_WHITEBOARD` — `CometChatMessageComposerAction.kt:42-49`).

### 1.8 Sending a custom message — use the UIKit path, not the raw SDK

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

Verified (v6 core/compose): `CometChatMessageComposer(attachmentOptions = …)` param (`CometChatMessageComposer.kt:338`), `CometChatMessageComposerViewModel.addAttachmentOption / setAttachmentOptions / getDefaultAttachmentOptions` (`:657 / :666 / :547`), `CometChatUIKit.sendCustomMessage(CustomMessage, CallbackListener)` (`CometChatUIKit.kt:472`).

### 1.9 Override an EXISTING type's bubble (Scenario 2)

To replace the rendering of a built-in type (e.g. text or image), register a `BubbleFactory` whose `getCategory()`/`getType()` **match the built-in identifiers**. Built-in types are NOT pre-seeded as factory entries — the bubble falls back to `InternalContentRenderer` only when no factory matches a `"category_type"` key (`CometChatMessageBubble.kt:155` "Falls back to InternalContentRenderer if no factory is provided"). So a matching factory simply takes priority over the internal default.

```kotlin
import com.cometchat.chat.constants.CometChatConstants

class MyTextBubbleFactory : BubbleFactory {
    override fun getCategory(): String = CometChatConstants.CATEGORY_MESSAGE   // "message"
    override fun getType(): String = CometChatConstants.MESSAGE_TYPE_TEXT      // "text"

    override fun getContentView(
        message: BaseMessage,
        alignment: UIKitConstants.MessageBubbleAlignment,
        style: CometChatMessageBubbleStyle,
        textFormatters: List<CometChatTextFormatter>
    ): @Composable () -> Unit = {
        MyCustomTextContent(message as TextMessage)   // only the content area
    }
    // …or override getBubbleView() to replace the whole bubble (see 1.3)
}

CometChatMessageList(user = user, bubbleFactories = listOf(MyTextBubbleFactory()))
```

This is still additive at the list level: registering a `message_text` factory only overrides text bubbles; image/video/custom types keep their internal rendering. Use `getContentView()` for content-only override, `getBubbleView()` for full-bubble replacement.

### 1.10 Add a long-press message option (Scenario 4 — Forward-style)

`CometChatMessageList` exposes two lambda parameters for the long-press option sheet (`CometChatMessageList.kt:577-598`):

| Param | Type | Semantics |
|---|---|---|
| `addOptions` | `((BaseMessage) -> List<CometChatMessageOption>)?` | **Append** after the defaults |
| `options` | `((BaseMessage) -> List<CometChatMessageOption>?)?` | **Replace** all defaults (takes precedence over `addOptions`; return `null` to keep defaults) |
| `onMessageOptionClick` | `((BaseMessage, optionId: String, optionName: String) -> Unit)?` | Click handler |

Use `addOptions` for a Forward-style action so the built-in Reply/Copy/Edit/Delete survive:

```kotlin
import com.cometchat.uikit.core.domain.model.CometChatMessageOption

CometChatMessageList(
    user = user,
    addOptions = { message ->            // ✅ appended to defaults
        listOf(
            CometChatMessageOption(
                id = "forward",
                title = "Forward",
                icon = R.drawable.ic_forward,
                onClick = { /* open forward picker for `message` */ }
            )
        )
    }
    // ❌ options = { listOf(forward) }   // would DROP reply/copy/edit/delete
)
```

`CometChatMessageOption(id, title, titleColor, icon, iconTintColor, …, onClick)` is a data class at `CometChatMessageOption.kt:21`. Resolution order is verified in `CometChatMessageListViewModel.resolveMessageOptions` (`:817-827`): `setOptions` result wins if non-null, else `defaultOptions + addOptions`.

### 1.11 MessageTemplate via the DataSource (docs-taught alternative to BubbleFactory)

> ⚠️ **Verify before using — symbols not found in the GA v6 Compose source.** `CometChatUIKit.getDataSource()`, `getMessageTemplates()`, `CometChatMessageTemplate`, and a `templates` parameter on the Compose `CometChatMessageList` appear in the Android **docs** but are **absent from the verified `com.cometchat.uikit.compose` GA source** (they're the legacy `com.cometchat.chatuikit` v5-shaped API; the Compose list only exposes `bubbleFactories`). Treat this section as a docs reference that may not compile against your installed v6 kit — **prefer `BubbleFactory` (the confirmed v6-native path) for all new code.**

The `BubbleFactory` / slot-lambda surface above is the primary v6 customization path. The Android docs also teach a **`MessageTemplate`** path through the data source ([message-template](https://www.cometchat.com/docs/ui-kit/android/v6/message-template)) — fetch the existing templates, mutate the one you want, then re-apply (append, never replace with a single-item list):

```kotlin
// 1. fetch existing templates from the data source
val templates = CometChatUIKit.getDataSource()
    .getMessageTemplates(additionParameter)   // pass the list's additionParameter
    .toMutableList()

// 2. mutate the template you want (or create a new one for a custom type)
templates.find { it.type == UIKitConstants.MessageType.TEXT }
    ?.setContentView { baseMessage, alignment ->
        Text(text = (baseMessage as? TextMessage)?.text ?: "")
    }
// new custom type:
val contact = CometChatMessageTemplate().apply {
    setType("contact"); setCategory(UIKitConstants.MessageCategory.CUSTOM)
    setContentView { baseMessage, _ -> /* custom composable */ }
}
templates.add(contact)

// 3. re-apply — Compose passes the list to CometChatMessageList
CometChatMessageList(user = user, templates = templates)
```

Compose templates expose lambda slot setters (`setContentView`, `setHeaderView`, `setFooterView`, `setBottomView`, `setStatusInfoView`, `setBubbleView`, `setOptions`) mirroring §2's slots. Prefer `BubbleFactory` for new code; use `getMessageTemplates(...)` when you want to start from the kit's defaults and tweak one type. (This overlaps the custom-message topic.)

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

## Text formatters (inline mentions / URLs / custom tokens)

Style/transform message text inline by passing `textFormatters` to the composer/list. The kit ships `CometChatMentionsFormatter` + `CometChatRichTextFormatter` (subclasses of the abstract `CometChatTextFormatter`) in `com.cometchat.uikit.compose.presentation.shared.formatters`. Default behavior (a mentions formatter) applies when you pass nothing — so to ADD a custom one, include the defaults too.

```kotlin
import com.cometchat.uikit.compose.presentation.shared.formatters.CometChatMentionsFormatter
import com.cometchat.uikit.compose.presentation.shared.formatters.CometChatTextFormatter

CometChatMessageComposer(
    user = user,
    textFormatters = listOf(CometChatMentionsFormatter(context) /* , YourFormatter(context) */),
)
// CometChatMessageList also takes textFormatters: List<CometChatTextFormatter>.
```

For a custom @/#/! token: subclass `CometChatTextFormatter(trackingCharacter)` and implement its `search()` + view hooks (see the kit's `formatters/` source + the per-platform docs).

## Hard rules

- BubbleFactory is an `interface` — implement it, don't extend an abstract class
- `getCategory()` and `getType()` are REQUIRED — they identify which message type the factory handles
- When `getBubbleView()` returns non-null, ALL other slot methods are ignored for that message type
- Slot lambda parameters on `CometChatMessageList` override BubbleFactory slot methods — use lambdas for cross-type overrides, factories for per-type overrides
- Style classes must use `Companion.default()` factory — the data class constructor requires ALL parameters
- Do NOT confuse BubbleFactory (UI rendering) with DataSource (data fetching) — they are separate layers

## Sound (in-app message + call sounds)

Sound is a customization sub-dimension. The UI Kit plays incoming/outgoing message + call sounds via `CometChatSoundManager` — mute it, swap custom audio, or play a specific sound. The full API + recipe lives in **`cometchat-android-v6-compose-theming`** (Sound section). Verify the access path against the installed kit before relying on it.
