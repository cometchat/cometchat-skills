---
name: cometchat-flutter-v5-customization
description: "Use when customizing CometChat Flutter UIKit v5 beyond props — custom bubbles, templates, DataSource decorators, slot views, formatters."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_uikit_shared ^5.2.3"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 customization templates datasource decorator bubbles formatters"
---

> **Ground truth:** `cometchat_chat_uikit: ^5.2` (legacy/maintenance-only; calls via raw `cometchat_calls_sdk ^5.0.2`) — pub-cache source + `ui-kit/flutter/v5`. **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/v5/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

# CometChat Flutter UIKit v5 — Customization

Four tiers of customization, from simple to deep.

## Tier 1: Props

Pass props directly to components:

```dart
CometChatMessageList(
  user: user,
  hideEditMessageOption: true,
  hideReactionOption: true,
  receiptsVisibility: false,
)
```

## Tier 2: Slot Views

Replace specific UI sections via callback props:

```dart
CometChatConversations(
  subtitleView: (context, conversation) {
    final lastMessage = conversation.lastMessage;
    if (lastMessage is TextMessage) {
      return Text(lastMessage.text, maxLines: 1, overflow: TextOverflow.ellipsis);
    }
    return null; // Falls back to default
  },
  trailingView: (conversation) {
    return Badge(count: conversation.unreadMessageCount);
  },
)

CometChatMessageHeader(
  listItemView: (group, user, context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Thread", style: TextStyle(fontWeight: FontWeight.bold)),
        Text(user?.name ?? group?.name ?? ""),
      ],
    );
  },
)
```

Available slot views per component:
- `CometChatConversations`: `subtitleView`, `listItemView`, `trailingView`, `leadingView`, `titleView`
- `CometChatMessageHeader`: `subtitleView`, `listItemView`, `trailingView`, `titleView`
- `CometChatMessageList`: `headerView`, `footerView`, `loadingStateView`, `emptyStateView`, `errorStateView`
- `CometChatUsers`: `subtitleView`, `listItemView`, `leadingView`, `titleView`, `trailingView`
- `CometChatGroups`: `subtitleView`, `listItemView`, `leadingView`, `titleView`, `trailingView`

## Tier 3: Text Formatters

Custom text formatters transform how message text is displayed:

```dart
CometChatMessageList(
  textFormatters: [
    CometChatEmailFormatter(),
    CometChatPhoneNumberFormatter(),
    CometChatUrlFormatter(),
    CometChatMentionsFormatter(
      user: user,
      group: group,
      onMentionTap: (mention, mentionedUser, {message}) {
        // Navigate to user's chat
      },
    ),
  ],
)
```

Built-in formatters:
- `CometChatEmailFormatter` — makes emails tappable
- `CometChatPhoneNumberFormatter` — makes phone numbers tappable
- `CometChatUrlFormatter` — makes URLs tappable
- `CometChatMentionsFormatter` — handles @mentions with tap callbacks

Pass the same formatters to both `CometChatMessageList` and `CometChatMessageComposer` for consistency.

## Tier 4: DataSource Decorator Pattern

The deepest customization level. `ChatConfigurator` uses a decorator pattern with `MessagesDataSource` as the base:

```
ChatConfigurator
  └── DataSource (interface)
      └── MessagesDataSource (default implementation)
          └── ExtensionDecorator (wraps and overrides)
```

### How extensions use it

Each extension (polls, stickers, link preview, etc.) has a decorator:

```dart
// Example: PollsExtensionDecorator wraps the DataSource
class PollsExtensionDecorator extends DataSourceDecorator {
  PollsExtensionDecorator(DataSource dataSource) : super(dataSource);

  @override
  List<CometChatMessageTemplate> getAllMessageTemplates() {
    // Add poll template to existing templates
    return [...super.getAllMessageTemplates(), _getPollTemplate()];
  }
}
```

Extensions are registered via `UIKitSettingsBuilder`:

```dart
final settings = (UIKitSettingsBuilder()
  ..extensions = CometChatUIKitChatExtensions.getDefaultExtensions()
  ..aiFeature = CometChatUIKitChatAIFeatures.getDefaultAiFeatures()
).build();
```

### Available extensions

| Extension | Decorator | What it adds |
|-----------|-----------|-------------|
| Polls | `PollsExtensionDecorator` | Poll creation + voting bubble |
| Stickers | `StickersExtensionDecorator` | Sticker keyboard + bubble |
| Link Preview | `LinkPreviewExtensionDecorator` | URL preview cards |
| Message Translation | `MessageExtensionTranslationDecorator` | Translate option |
| Image Moderation | `ImageModerationExtensionDecorator` | NSFW filter |
| Collaborative Document | `CollaborativeDocumentExtensionDecorator` | Shared doc |
| Collaborative Whiteboard | `CollaborativeWhiteBoardExtensionDecorator` | Shared whiteboard |
| Thumbnail Generation | `ThumbnailGenerationExtensionDecorator` | Image thumbnails |

> **Naming gotchas (kit-side inconsistencies)** — two decorator class names break the `[Feature]ExtensionDecorator` convention used by the other six. Use these exact spellings when subclassing or importing:
> - `CollaborativeWhiteBoardExtensionDecorator` — capital **B** in `WhiteBoard` (matches the kit's typo; lowercase `b` will not resolve).
> - `MessageExtensionTranslationDecorator` — token order is **inverted**; the public wrapper is `MessageTranslationExtension`, but the decorator itself uses `MessageExtensionTranslation`.

### CometChatCallingExtension

The calling extension also uses this pattern:

```dart
class CometChatCallingExtension extends ExtensionsDataSource {
  @override
  void addExtension() {
    ChatConfigurator.enable((dataSource) =>
        CallingExtensionDecorator(dataSource, configuration: configuration));
  }
}
```

## Message Templates

`CometChatMessageTemplate` defines how a message type is rendered:

```dart
CometChatMessageList(
  // ✅ APPEND with addTemplate — keeps every default bubble (text/image/video/file/…)
  addTemplate: [
    CometChatMessageTemplate(
      type: 'custom_type',
      category: 'custom',
      contentView: (message, context, alignment) {
        return Container(
          child: Text('Custom bubble: ${message.id}'),
        );
      },
    ),
  ],
)
```

> **Use `addTemplate`, not `templates`, to add a type.** The `templates:` prop **replaces the entire set** — passing `templates: [myTemplate]` makes every default bubble (text, image, video, audio, file, …) stop rendering. `addTemplate:` layers your template on top of the defaults. Only reach for `templates:` when you deliberately want to redefine the whole list.

> `contentView` also accepts an optional named `{AdditionalConfigurations? additionalConfigurations}` arg if your custom bubble needs access to additional config passed down from the parent.

### Custom attachment options — append via a DataSourceDecorator (super), don't replace

The composer's `attachmentOptions` builder returns the **whole** menu (a `ComposerActionsBuilder` — `(context, user, group, id)`), so returning `[myAction]` wipes photo/video/audio/file. The kit's own extensions add options by overriding `DataSource.getAttachmentOptions` and calling `super` first — do the same:

```dart
class MyDataSource extends DataSourceDecorator {
  MyDataSource(DataSource ds) : super(ds);

  @override
  List<CometChatMessageComposerAction> getAttachmentOptions(
    BuildContext context, Map<String, dynamic>? id,
    AdditionalConfigurations? additionalConfigurations,
  ) {
    final actions = super.getAttachmentOptions(context, id, additionalConfigurations); // defaults
    actions.add(CometChatMessageComposerAction(
      id: 'location', title: 'Send Location',
      onItemClick: (ctx, user, group) { /* pick + send (below) */ },
    ));
    return actions; // appended — defaults preserved
  }
}
```

### Sending a custom message — use the UIKit path, not the raw SDK

```dart
final message = CustomMessage(
  receiverUid: user.uid,
  receiverType: ReceiverTypeConstants.user,   // or .group
  type: 'custom_type',                        // matches the template type
  customData: {'lat': 19.07, 'lng': 72.87},
);
// ✅ kit path — sets muid + sender, emits ccMessageSent → list appends
await CometChatUIKit.sendCustomMessage(message);
// ❌ await CometChat.sendCustomMessage(message);  // recipient error + realtime replace
```

### Override an existing type's bubble

To swap the content of a **built-in** type (e.g. text), **do NOT use `addTemplate:`** — a built-in collision passed via `addTemplate:` is silently dropped (the list controller backfills only *null* slots, and the default's `contentView`/`options` are already non-null; source: `chat_uikit/.../message_list/cometchat_message_list_controller.dart:571-613`). `addTemplate:` is for brand-NEW custom types only.

To override a built-in, **seed the full default set, modify the matching template in place, and pass the whole list via `templates:`** (the prop that defines the list's template set — passing the complete set guarantees no other built-in bubble is dropped). `contentView`'s full signature is `(BaseMessage, BuildContext, BubbleAlignment, {AdditionalConfigurations? additionalConfigurations})`.

```dart
final templates = CometChatUIKit.getDataSource().getAllMessageTemplates();
for (final t in templates) {
  if (t.type == MessageTypeConstants.text &&
      t.category == MessageCategoryConstants.message) {
    t.contentView = (message, context, alignment, {additionalConfigurations}) {
      return Container(
        padding: const EdgeInsets.all(8),
        child: Text(message is TextMessage ? message.text : ''),
      );
    };
  }
}

CometChatMessageList(user: user, templates: templates) // full set → no built-in dropped
```

### Message option — add a long-press action (Forward-style)

Two verified routes:

**A. Per-list, via the template's `options` callback.** The template's `options` signature is `(User loggedInUser, BaseMessage messageObject, BuildContext context, Group? group, AdditionalConfigurations? additionalConfigurations)` and returns `List<CometChatMessageOption>?`. Because this overrides a **built-in** type's `options`, use the same seed-the-full-set + `templates:` pattern as the bubble override above (NOT `addTemplate:`, which would be dropped). Seed each option list from the default `getMessageOptions` to **append** rather than replace:

```dart
final templates = CometChatUIKit.getDataSource().getAllMessageTemplates();
for (final t in templates) {
  if (t.type == MessageTypeConstants.text &&
      t.category == MessageCategoryConstants.message) {
    t.options = (loggedInUser, message, context, group, additionalConfigurations) {
      final defaults = CometChatUIKit.getDataSource().getMessageOptions(
        loggedInUser, message, context, group, additionalConfigurations);
      defaults.add(CometChatMessageOption(
        id: 'forward',
        title: 'Forward',
        icon: const Icon(Icons.forward, size: 24),
        onItemClick: (BaseMessage msg, CometChatMessageListControllerProtocol state) {
          // forward msg
        },
      ));
      return defaults; // appended — default options preserved
    };
  }
}

CometChatMessageList(user: user, templates: templates)
```

**B. App-wide, via a `DataSourceDecorator`.** Override `getMessageOptions` and call `super` first (same shape the kit's own extensions use):

```dart
class MyDataSource extends DataSourceDecorator {
  MyDataSource(DataSource ds) : super(ds);

  @override
  List<CometChatMessageOption> getMessageOptions(
    User loggedInUser, BaseMessage messageObject, BuildContext context,
    Group? group, AdditionalConfigurations? additionalConfigurations,
  ) {
    final options = super.getMessageOptions(
      loggedInUser, messageObject, context, group, additionalConfigurations);
    options.add(CometChatMessageOption(
      id: 'forward', title: 'Forward',
      onItemClick: (msg, state) { /* forward */ },
    ));
    return options; // appended — defaults preserved
  }
}
// register: ChatConfigurator.enable((ds) => MyDataSource(ds));
```

> `CometChatMessageOption.onItemClick` is `(BaseMessage message, CometChatMessageListControllerProtocol state)` — **not** the bare `Function()` used by `CometChatOption` (conversations/header). Don't mix the two models.

Verified (v5): `CometChatMessageList.addTemplate` + `.templates` (chat_uikit/.../message_list/cometchat_message_list.dart:108,55), `CometChatMessageTemplate({required type, required category, bubbleView, headerView, contentView, footerView, bottomView, statusInfoView, threadView, replyView, options})` (shared_uikit/.../models/cometchat_message_template.dart:21; `contentView` 3-arg + `{AdditionalConfigurations?}`, `options` 5 positional), `DataSourceDecorator.getAttachmentOptions(BuildContext, Map?, AdditionalConfigurations?)` + `.getMessageOptions(User, BaseMessage, BuildContext, Group?, AdditionalConfigurations?)` (shared_uikit/.../framework/data_source_decorator.dart:47,122 — both delegate to wrapped `dataSource`, so `super.x()` is correct), `ChatConfigurator.enable(DataSource Function(DataSource))` + `CometChatUIKit.getDataSource()` (shared_uikit/.../framework/chat_configurator.dart:14, cometchat_ui_kit.dart:713), `CometChatMessageOption(id:, title:, icon:, onItemClick:(BaseMessage,CometChatMessageListControllerProtocol), messageOptionSheetStyle:)` (shared_uikit/.../models/cometchat_message_option.dart:21), `CometChatMessageComposerAction(id:, title:, icon:, style:, onItemClick:(BuildContext,User?,Group?))` (shared_uikit/.../models/cometchat_message_composer_action.dart:23), `CometChatUIKit.sendCustomMessage(CustomMessage)`, `CustomMessage(receiverUid:, receiverType:, type:, customData:)`.

## Options Menu Customization

Add or replace long-press options on conversations, users, groups:

```dart
CometChatConversations(
  // Replace all options
  setOptions: (conversation, controller, context) {
    return [CometChatOption(id: 'pin', title: 'Pin', onClick: () { ... })];
  },
  // Add to existing options
  addOptions: (conversation, controller, context) {
    return [CometChatOption(id: 'archive', title: 'Archive', onClick: () { ... })];
  },
)
```

## Header Options (Messages)

```dart
CometChatMessageHeader(
  options: (user, group, context) {
    return [
      CometChatOption(
        id: 'user-info',
        title: 'User Info',
        iconWidget: Icon(Icons.info_outline),
        onClick: () { ... },
      ),
      CometChatOption(
        id: 'search',
        title: 'Search',
        iconWidget: Icon(Icons.search),
        onClick: () { ... },
      ),
    ];
  },
)
```

## Checklist — Customization

- [ ] Start with props (Tier 1) before going deeper
- [ ] Slot views return `null` to fall back to default rendering
- [ ] Text formatters consistent between MessageList and Composer
- [ ] Extensions registered via `UIKitSettingsBuilder.extensions`
- [ ] Custom templates specify `type` and `category`

## Sound (in-app message + call sounds)

The V5 UI Kit surfaces `CometChatSoundManager` for incoming/outgoing message + call sounds (mute / custom audio). **V5 is legacy/maintenance-only** — V6 is the current cohort. For call sounds see this family's `-calls` skill; verify the `CometChatSoundManager` API against the installed kit before relying on it.
