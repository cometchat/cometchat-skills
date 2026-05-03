---
name: cometchat-flutter-v5-customization
description: "Use when customizing CometChat Flutter UIKit v5 beyond props — custom bubbles, templates, DataSource decorators, slot views, formatters."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_uikit_shared ^5.2.3"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 customization templates datasource decorator bubbles formatters"
---

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
- `CometChatMessageHeader`: `subtitleView`, `listItemView`, `trailingView`
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
| Message Translation | `MessageTranslationExtensionDecorator` | Translate option |
| Image Moderation | `ImageModerationExtensionDecorator` | NSFW filter |
| Collaborative Document | `CollaborativeDocumentExtensionDecorator` | Shared doc |
| Collaborative Whiteboard | `CollaborativeWhiteboardExtensionDecorator` | Shared whiteboard |
| Thumbnail Generation | `ThumbnailGenerationExtensionDecorator` | Image thumbnails |

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
  templates: [
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
