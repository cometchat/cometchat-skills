---
name: cometchat-flutter-v6-customization
description: >
  Customize CometChat Flutter UIKit v6 beyond defaults — four tiers: props/view slots,
  request builders, text formatters + message templates, and BubbleFactory/DataSource.
  Use when the user wants custom bubbles, custom headers, custom list items, custom
  message actions, or custom message types.
license: "MIT"
compatibility: "cometchat_chat_uikit ^6.0.1"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter customization bubbles templates formatters datasource"
---

> **Ground truth:** `cometchat_chat_uikit: ^6.0` — pub-cache source + `ui-kit/flutter`. **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

# CometChat Flutter UIKit v6 — Customization Guide

Four tiers of customization, from lightest to deepest.

## 1. Four-Tier Customization Model

| Tier | Mechanism | Scope | When to Use |
|------|-----------|-------|-------------|
| 1 | Props & View Slots | Per-component UI overrides | Custom list items, subtitles, trailing widgets, headers |
| 2 | Request Builders | Data filtering & pagination | Filter conversations, users, groups, messages, group members |
| 3 | Text Formatters & Message Templates | Message rendering & actions | Custom text styling, custom long-press options, custom bubble slots |
| 4 | BubbleFactory & DataSource | New message types | Location bubbles, poll bubbles, any custom `category_type` |

Start at Tier 1. Move deeper only when the lighter tier can't solve the problem.

## 2. Tier 1: Props & View Slots

Every list-based component exposes view slot callbacks that let you replace individual parts of each list item without rebuilding the entire widget.

### CometChatConversations

```dart
CometChatConversations(
  // Replace the entire list item
  listItemView: (Conversation conversation) => MyCustomConversationTile(conversation),

  // Replace individual slots
  subtitleView: (BuildContext context, Conversation conversation) {
    final last = conversation.lastMessage;
    final preview = last is TextMessage ? last.text : '';
    return Text(preview);
  },
  trailingView: (Conversation conversation) =>
      Icon(Icons.chevron_right),
  leadingView: (BuildContext context, Conversation conversation) =>
      CircleAvatar(child: Text(conversation.conversationWith?.name?[0] ?? '')),
  titleView: (BuildContext context, Conversation conversation) =>
      Text(conversation.conversationWith?.name ?? '', style: TextStyle(fontWeight: FontWeight.bold)),

  // State views
  emptyStateView: (context) => Center(child: Text('No conversations yet')),
  errorStateView: (context) => Center(child: Text('Something went wrong')),
  loadingStateView: (context) => Center(child: CircularProgressIndicator()),
)
```

### CometChatUsers

```dart
CometChatUsers(
  listItemView: (User user) => MyCustomUserTile(user),
  subtitleView: (BuildContext context, User user) => Text(user.status ?? ''),
  trailingView: (BuildContext context, User user) => Icon(Icons.message),
  leadingView: (BuildContext context, User user) => CometChatAvatar(name: user.name),
  titleView: (BuildContext context, User user) => Text(user.name),
)
```

### CometChatGroups

```dart
CometChatGroups(
  listItemView: (Group group) => MyCustomGroupTile(group),
  subtitleView: (BuildContext context, Group group) =>
      Text('${group.membersCount} members'),
  trailingView: (BuildContext context, Group group) => Icon(Icons.arrow_forward),
  leadingView: (BuildContext context, Group group) => CometChatAvatar(name: group.name),
  titleView: (BuildContext context, Group group) => Text(group.name),
)
```

### CometChatMessageHeader

```dart
CometChatMessageHeader(
  user: user,
  group: group,
  subtitleView: (Group? group, User? user, BuildContext context) =>
      Text('Custom subtitle'),
  trailingView: (User? user, Group? group, BuildContext context) => [
    IconButton(icon: Icon(Icons.search), onPressed: () {}),
    IconButton(icon: Icon(Icons.info_outline), onPressed: () {}),
  ],
  listItemView: (Group? group, User? user, BuildContext context) =>
      MyCustomHeaderWidget(user: user, group: group),
  titleView: null, // use default
  leadingStateView: null, // use default
)
```

### CometChatMessageList

```dart
CometChatMessageList(
  user: user,
  group: group,
  headerView: (context, {user, group, parentMessageId}) => MyCustomListHeader(),
  footerView: (context, {user, group, parentMessageId}) => MyCustomListFooter(),
  emptyStateView: (context) => Center(child: Text('Start a conversation')),
  emptyChatGreetingView: (context) => WelcomeWidget(),
  loadingStateView: (context) => ShimmerList(),
  errorStateView: (context) => RetryWidget(),
)
```

### CometChatMessageComposer

```dart
CometChatMessageComposer(
  user: user,
  group: group,
  headerView: (context, user, group, id) => ReplyPreviewBanner(),
  footerView: (context, user, group, id) => SuggestedActionsBar(),
  auxiliaryButtonView: (context, user, group, id) =>
      IconButton(icon: Icon(Icons.gif), onPressed: () {}),
  secondaryButtonView: (context, user, group, id) =>
      IconButton(icon: Icon(Icons.attach_file), onPressed: () {}),
  sendButtonView: Icon(Icons.send, color: Colors.blue),
)
```

## 3. Tier 2: Request Builders

Override the SDK request builder to control what data is fetched.

### ConversationsRequestBuilder

```dart
CometChatConversations(
  conversationsRequestBuilder: ConversationsRequestBuilder()
    ..limit = 30
    ..conversationType = ConversationType.user // only 1-on-1 chats
    ..withTags = true
    ..tags = ['vip'],
)
```

### MessagesRequestBuilder

```dart
CometChatMessageList(
  user: user,
  messagesRequestBuilder: MessagesRequestBuilder()
    ..uid = user.uid
    ..limit = 50
    ..hideDeleted = true
    ..searchKeyword = 'invoice'
    ..categories = [MessageCategoryConstants.message]
    ..types = [MessageTypeConstants.text, MessageTypeConstants.image],
)
```

### UsersRequestBuilder

```dart
CometChatUsers(
  usersRequestBuilder: UsersRequestBuilder()
    ..limit = 30
    ..friendsOnly = true
    ..searchKeyword = 'john'
    ..roles = ['admin', 'moderator'],
)
```

### GroupsRequestBuilder

```dart
CometChatGroups(
  groupsRequestBuilder: GroupsRequestBuilder()
    ..limit = 30
    ..joinedOnly = true
    ..searchKeyword = 'team'
    ..withTags = true
    ..tags = ['project-alpha'],
)
```

### GroupMembersRequestBuilder

```dart
CometChatGroupMembers(
  group: group,
  groupMembersRequestBuilder: GroupMembersRequestBuilder(group.guid)
    ..limit = 30
    ..scopes = [CometChatMemberScope.admin, CometChatMemberScope.moderator],
)
```

## 4. Tier 3: Text Formatters & Message Templates

### Text Formatters

`CometChatTextFormatter` is the abstract base class. Subclass it to create custom text styling in both the message list and the composer.

Built-in formatters:

| Formatter | Purpose |
|-----------|---------|
| `CometChatMentionsFormatter` | @mention users with suggestion list |
| `MarkdownTextFormatter` | Bold, italic, strikethrough, code, links, lists |
| `CometChatUrlFormatter` | Clickable URLs |
| `CometChatPhoneNumberFormatter` | Clickable phone numbers |
| `CometChatEmailFormatter` | Clickable email addresses |

Key properties on `CometChatTextFormatter`:

```dart
abstract class CometChatTextFormatter implements Formatter {
  String? trackingCharacter;       // e.g. '@' for mentions
  RegExp? pattern;                 // regex to match in text
  Function(String?)? onSearch;     // called when tracking character typed
  bool? showLoadingIndicator;
  BaseMessage? message;
  User? user;
  Group? group;
  StreamSink<List<SuggestionListItem>>? suggestionListEventSink;

  void init();
  void handlePreMessageSend(BuildContext context, BaseMessage baseMessage);
  void onScrollToBottom(TextEditingController textEditingController);
  void onChange(TextEditingController textEditingController, String previousText);

  List<AttributedText> buildInputFieldText({...});
  List<AttributedText> getAttributedText(String text, BuildContext context, BubbleAlignment? alignment, {...});
  TextStyle getMessageBubbleTextStyle(BuildContext context, BubbleAlignment? alignment, {bool forConversation = false});
  TextStyle getMessageInputTextStyle(BuildContext context);
}
```

Pass the same formatters to both list and composer:

```dart
final formatters = [
  CometChatMentionsFormatter(user: user, group: group),
  MarkdownTextFormatter(),
  CometChatUrlFormatter(),
  CometChatPhoneNumberFormatter(),
  CometChatEmailFormatter(),
];

CometChatMessageList(user: user, textFormatters: formatters)
CometChatMessageComposer(user: user, textFormatters: formatters)
```

### Message Templates

`CometChatMessageTemplate` controls how a message type renders in the bubble and what long-press options appear.

```dart
class CometChatMessageTemplate {
  CometChatMessageTemplate({
    required this.type,       // e.g. 'text', 'image', or 'location'
    required this.category,   // e.g. 'message' or 'custom'
    this.bubbleView,          // replaces the ENTIRE bubble
    this.headerView,          // top of bubble (sender name area)
    this.contentView,         // main content area
    this.footerView,          // below statusInfoView
    this.bottomView,          // below contentView
    this.statusInfoView,      // receipts/time area
    this.threadView,          // thread reply indicator
    this.replyView,           // quoted-reply preview area (3-arg builder, NO additionalConfigurations)
    this.options,             // long-press menu options
  });
}

// `replyView` exists on BOTH CometChatMessageTemplate (template-level, signature
// `(BaseMessage, BuildContext, BubbleAlignment)`) AND on CometChatMessageBubble
// (the widget slot). Verified: only the clean_architecture template is exported
// (shared_ui/src/clean_architecture/data/models/cometchat_message_template.dart:79)
// — the legacy shared_ui/src/models/ copy without replyView is NOT exported.
```

Override templates on `CometChatMessageList`:

```dart
CometChatMessageList(
  user: user,
  // Replace all templates
  templates: [
    CometChatMessageTemplate(
      type: MessageTypeConstants.text,
      category: MessageCategoryConstants.message,
      contentView: (message, context, alignment, {additionalConfigurations}) =>
          MyCustomTextContent(message: message),
      options: (loggedInUser, message, context, group, additionalConfigurations) => [
        CometChatMessageOption(
          id: 'bookmark',
          title: 'Bookmark',
          icon: Icon(Icons.bookmark_border, size: 24),
          onItemClick: (message, state) {
            // handle bookmark
          },
        ),
      ],
    ),
  ],
  // Or add templates alongside defaults
  addTemplate: [
    CometChatMessageTemplate(
      type: 'location',
      category: 'custom',
      contentView: (message, context, alignment, {additionalConfigurations}) =>
          LocationBubbleContent(message: message as CustomMessage),
    ),
  ],
)
```

`CometChatMessageOption` model:

```dart
CometChatMessageOption(
  id: 'pin',                    // unique identifier
  title: 'Pin Message',         // display text
  icon: Icon(Icons.push_pin),   // leading icon
  onItemClick: (BaseMessage message, CometChatMessageListControllerProtocol state) {
    // your action
  },
  messageOptionSheetStyle: CometChatMessageOptionSheetStyle(...),
)
```

### Custom attachment options — the builder REPLACES, so spread the defaults

`CometChatMessageComposer.attachmentOptions` is a `ComposerActionsBuilder` — `List<CometChatMessageComposerAction> Function(BuildContext, User?, Group?, Map<String,dynamic>? id)`. **Whatever list you return becomes the entire menu**; there is no merge. To add one option while keeping photo/video/audio/file/poll, seed the list from `ComposerAttachmentUtils.getAttachmentOptions(...)`.

> ⚠️ **`ComposerAttachmentUtils` is NOT exported from the package barrel** (`cometchat_chat_uikit.dart`) — verified by `dart analyze` against published `cometchat_chat_uikit 6.0.1`. The normal `import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';` does **not** expose it; you must add a **deep import** of the internal path:
> ```dart
> import 'package:cometchat_chat_uikit/chat_ui/src/message_composer/utils/composer_attachment_utils.dart';
> ```
> This is an internal (`src/`) path — it works on 6.0.1 but is not part of the public API contract, so it may move across patch versions. There is no public accessor for the default attachment list in V6; this deep import is the only way to seed the defaults.

```dart
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_chat_uikit/chat_ui/src/message_composer/utils/composer_attachment_utils.dart'; // ComposerAttachmentUtils (not barrel-exported)

CometChatMessageComposer(
  attachmentOptions: (context, user, group, id) => [
    ...ComposerAttachmentUtils.getAttachmentOptions(context, id, null), // defaults
    CometChatMessageComposerAction(
      id: 'location',
      title: 'Send Location',
      onItemClick: (ctx, u, g) { /* pick + send (below) */ },
    ),
  ],
)
```

```dart
// ❌ returns ONLY your option — every default attachment disappears
attachmentOptions: (context, user, group, id) => [locationAction],
```

### Sending a custom message — use the UIKit path, not the raw SDK

A `contentView`/`BubbleFactory` only renders the type; send the message with **`CometChatUIKit.sendCustomMessage(...)`**, not `CometChat.sendCustomMessage(...)`. The UIKit wrapper sets `muid` + sender and fires `ccMessageSent`, which makes the new bubble **append** to the open list. The raw SDK call skips those, giving a recipient error and a realtime bubble that **replaces** an existing one (no `muid` dedup).

```dart
final message = CustomMessage(
  receiverUid: user.uid,
  receiverType: ReceiverTypeConstants.user,   // or .group
  type: 'location',                           // matches the template type
  customData: {'lat': 19.07, 'lng': 72.87},
);
// ✅ kit path — sets muid + sender, emits ccMessageSent → list appends
await CometChatUIKit.sendCustomMessage(message);
// ❌ await CometChat.sendCustomMessage(message);  // recipient error + realtime replace
```

Verified (v6, `dart analyze` vs published 6.0.1): `ComposerAttachmentUtils.getAttachmentOptions(BuildContext, Map?, AdditionalConfigurations?)` (composer_attachment_utils.dart:254 — **NOT barrel-exported; requires the deep import above**), `CometChatUIKit.sendCustomMessage(CustomMessage)`, `CustomMessage(receiverUid:, receiverType:, type:, customData:)`, `CometChatMessageComposerAction(id:, title:, icon:, style:, onItemClick:(BuildContext,User?,Group?))` (cometchat_message_composer_action.dart:23), `CometChatMessageOption(id:, title:, icon:, onItemClick:(BaseMessage,CometChatMessageListControllerProtocol), messageOptionSheetStyle:)` (cometchat_message_option.dart:21), `CometChatMessageTemplate({required type, required category, bubbleView, headerView, contentView, footerView, bottomView, statusInfoView, threadView, replyView, options})` (clean_architecture/data/models/cometchat_message_template.dart:23), `CometChatMessageList(templates:, addTemplate:)` (chat_ui/.../message_list/widgets/cometchat_message_list.dart:46-47).

## 5. Tier 4: BubbleFactory & DataSource

### BubbleFactory

The deepest customization for rendering message content. Each factory handles one `category_type` key.

```dart
/// Abstract factory — one per message type.
abstract class BubbleFactory<T extends BaseMessage> {
  Widget build(
    BuildContext context,
    T message,
    BubbleAlignment alignment, {
    CometChatColorPalette? colorPalette,
    CometChatTypography? typography,
    CometChatSpacing? spacing,
  });

  /// Returns "category_type" key, or "deleted" for deleted messages.
  static String getFactoryKey(BaseMessage message);

  /// Creates a key from category + type strings.
  static String createKey(String category, String type) => '${category}_$type';
}
```

### DefaultBubbleFactories

The built-in registry:

```dart
class DefaultBubbleFactories {
  static Map<String, BubbleFactory> getDefaults({
    List<CometChatTextFormatter>? textFormatters,
    CometChatTextBubbleStyle? incomingTextStyle,
    CometChatTextBubbleStyle? outgoingTextStyle,
    CometChatImageBubbleStyle? imageStyle,
    CometChatVideoBubbleStyle? videoStyle,
    CometChatAudioBubbleStyle? audioStyle,
    CometChatFileBubbleStyle? fileStyle,
  });
}
```

Default keys registered:
- `message_text` → `TextBubbleFactory`
- `message_image` → `ImageBubbleFactory`
- `message_video` → `VideoBubbleFactory`
- `message_audio` → `AudioBubbleFactory`
- `message_file` → `FileBubbleFactory`
- `deleted` → `DeletedBubbleFactory`

### Creating a Custom BubbleFactory

Example: a location message bubble.

```dart
class LocationBubbleFactory extends BubbleFactory<CustomMessage> {
  @override
  Widget build(
    BuildContext context,
    CustomMessage message,
    BubbleAlignment alignment, {
    CometChatColorPalette? colorPalette,
    CometChatTypography? typography,
    CometChatSpacing? spacing,
  }) {
    final data = message.customData;
    final lat = data?['latitude'] as double? ?? 0;
    final lng = data?['longitude'] as double? ?? 0;

    return GestureDetector(
      onTap: () => _openMap(lat, lng),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.network(
            'https://maps.googleapis.com/maps/api/staticmap?center=$lat,$lng&zoom=15&size=300x200&key=YOUR_KEY',
            width: 240,
            height: 160,
            fit: BoxFit.cover,
          ),
          Padding(
            padding: EdgeInsets.all(spacing?.padding2 ?? 8),
            child: Text(
              '📍 $lat, $lng',
              style: typography?.body?.regular,
            ),
          ),
        ],
      ),
    );
  }
}
```

### Registering Custom Factories

Merge your custom factories with the defaults using `CometChatMessageTemplate.addTemplate` on the message list, or by providing a custom `templates` list that includes a `contentView` for your custom type.

`CometChatMessageBubble` is a pure slot widget — it accepts pre-built `contentView`, `headerView`, `footerView`, `replyView`, `threadView`, `bottomView`, `statusInfoView`, and `leadingView` widgets. It does NOT resolve message types via a factory registry; factory resolution happens one layer up, inside `CometChatMessageList`, which picks the right template based on `category_type` and invokes that template's `contentView` builder.

```dart
// Using addTemplate to register a custom type alongside defaults
CometChatMessageList(
  user: user,
  addTemplate: [
    CometChatMessageTemplate(
      type: 'location',
      category: 'custom',
      contentView: (message, context, alignment, {additionalConfigurations}) {
        final factory = LocationBubbleFactory();
        return factory.build(context, message as CustomMessage, alignment);
      },
    ),
  ],
)
```

### DataSource Pattern

> **V6 ≠ V5 here.** V6 has **no** `ChatConfigurator`, `DataSource`/`DataSourceDecorator`, `ExtensionsDataSource`, `CometChatUIKit.getDataSource()`, or `getAllMessageTemplates()` override-and-register flow — that GetX-era framework is **V5-only** (verified absent in the v6 clone). In V6 you merge custom templates with the widget-level `addTemplate:` prop and customize data fetching by supplying a custom BLoC. Don't carry the V5 decorator recipe over.

Each component follows Clean Architecture with its own data source layer. The data sources abstract SDK calls behind interfaces:

```dart
// Example: ConversationsRemoteDataSource (full real interface)
abstract class ConversationsRemoteDataSource {
  Future<List<Conversation>> getConversations({int limit = 30, String? fromId});
  Future<Conversation?> getConversation(String conversationWith, String conversationType);
  Future<void> deleteConversation(String conversationWith, String conversationType);
  Future<void> markMessageAsRead(BaseMessage message);
  Future<Conversation?> updateConversation(BaseMessage message);
}

class ConversationsRemoteDataSourceImpl implements ConversationsRemoteDataSource {
  // Delegates to CometChat SDK — must implement ALL five methods above.
}
```

To customize data fetching, provide a custom BLoC instance:

```dart
CometChatConversations(
  conversationsBloc: MyCustomConversationsBloc(),
)

CometChatUsers(
  usersBloc: MyCustomUsersBloc(),
)

CometChatGroups(
  groupsBloc: MyCustomGroupsBloc(),
)

CometChatMessageList(
  messageListBloc: MyCustomMessageListBloc(),
)
```

## 6. Style Overrides

Every component has a `CometChat{Component}Style` class that extends `ThemeExtension`. Styles use a `merge()` pattern — your overrides layer on top of theme defaults.

### Pattern

```dart
@immutable
class CometChatTextBubbleStyle extends ThemeExtension<CometChatTextBubbleStyle> {
  const CometChatTextBubbleStyle({
    this.textStyle,
    this.textColor,
    this.backgroundColor,
    this.border,
    this.borderRadius,
    this.messageBubbleAvatarStyle,
    this.messageBubbleDateStyle,
    this.messageBubbleBackgroundImage,
    this.senderNameTextStyle,
    this.messageReceiptStyle,
    // ...
  });

  // Factory to get theme-registered instance
  static CometChatTextBubbleStyle of(BuildContext context) => const CometChatTextBubbleStyle();

  // Merge your overrides on top of theme defaults
  CometChatTextBubbleStyle merge(CometChatTextBubbleStyle? style);

  // copyWith for selective overrides
  CometChatTextBubbleStyle copyWith({...});
}
```

### Usage

```dart
CometChatConversations(
  conversationsStyle: CometChatConversationsStyle(
    backgroundColor: Colors.grey[100],
    titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
  ),
)

CometChatMessageHeader(
  user: user,
  messageHeaderStyle: CometChatMessageHeaderStyle(
    backgroundColor: colorPalette.background1,
  ),
)

CometChatMessageList(
  user: user,
  style: CometChatMessageListStyle(
    backgroundColor: Colors.white,
  ),
)

CometChatMessageComposer(
  user: user,
  messageComposerStyle: CometChatMessageComposerStyle(
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.circular(24),
  ),
)
```

### Theme Caching

For performance, parent widgets cache theme lookups in `didChangeDependencies()` and pass them to children via optional `colorPalette`, `spacing`, `typography` params. This avoids expensive `CometChatThemeHelper` lookups during keyboard animation rebuilds.

```dart
// Parent caches once
late CometChatColorPalette _colorPalette;
bool _themeInitialized = false;

@override
void didChangeDependencies() {
  super.didChangeDependencies();
  if (!_themeInitialized) {
    _colorPalette = CometChatThemeHelper.getColorPalette(context);
    _themeInitialized = true;
  }
}

// Pass to children — CometChatMessageBubble exposes colorPalette + spacing only
CometChatMessageBubble(
  colorPalette: _colorPalette,  // pre-cached, zero lookups in child
  spacing: _spacing,
  // For typography, read CometChatThemeHelper.getTypography(context) in the
  // parent and use it directly inside the slot widgets you pass in.
)
```

## 7. Anti-Patterns

```dart
// ❌ WRONG — different formatters for list and composer
CometChatMessageList(textFormatters: [MarkdownTextFormatter()])
CometChatMessageComposer(textFormatters: []) // inconsistent rendering

// ✅ CORRECT — same formatter list
final formatters = [CometChatMentionsFormatter(user: user), MarkdownTextFormatter()];
CometChatMessageList(textFormatters: formatters)
CometChatMessageComposer(textFormatters: formatters)
```

```dart
// ❌ WRONG — calling CometChatThemeHelper in build() of a frequently-rebuilt widget
@override
Widget build(BuildContext context) {
  final colorPalette = CometChatThemeHelper.getColorPalette(context); // expensive every rebuild
  return Container(color: colorPalette.primary);
}

// ✅ CORRECT — cache in didChangeDependencies, use _themeInitialized flag
```

```dart
// ❌ WRONG — overriding templates without providing options (loses default long-press menu)
CometChatMessageList(
  templates: [
    CometChatMessageTemplate(
      type: MessageTypeConstants.text,
      category: MessageCategoryConstants.message,
      contentView: (msg, ctx, align, {additionalConfigurations}) => Text(msg is TextMessage ? msg.text : ''),
      // options: null — no long-press menu at all!
    ),
  ],
)

// ✅ CORRECT — use addTemplate to add new types, or include options when overriding templates
```

```dart
// ❌ WRONG — creating a BubbleFactory that ignores the colorPalette/spacing params
class BadFactory extends BubbleFactory<CustomMessage> {
  @override
  Widget build(BuildContext context, CustomMessage message, BubbleAlignment alignment, {
    CometChatColorPalette? colorPalette,
    CometChatTypography? typography,
    CometChatSpacing? spacing,
  }) {
    return Container(color: Colors.blue); // hardcoded color, ignores theme
  }
}

// ✅ CORRECT — use the passed theme values
return Container(color: colorPalette?.primary ?? Colors.blue);
```

```dart
// ✅ CORRECT on ^6.0.1 — true (or omit; true is the default). The composer
//   clamps the keyboard height to viewInsets (kit fix ENG-34434), so true does
//   NOT double-compensate.
Scaffold(
  resizeToAvoidBottomInset: true,
  body: Column(children: [
    Expanded(child: CometChatMessageList(user: user)),
    CometChatMessageComposer(user: user),
  ]),
)

// ⚠ PRE-6.0.1 ONLY — false was the stopgap before the clamp landed. On ^6.0.1
//   this is unnecessary; if you still see a double keyboard gap, upgrade the kit.
Scaffold(
  resizeToAvoidBottomInset: false,
  body: Column(children: [
    Expanded(child: CometChatMessageList(user: user)),
    CometChatMessageComposer(user: user),
  ]),
)
```

## 8. Checklist

- [ ] Start at Tier 1 (props/view slots) before going deeper
- [ ] Same `textFormatters` list passed to both `CometChatMessageList` and `CometChatMessageComposer`
- [ ] Use `addTemplate` to add new message types alongside defaults (don't replace `templates` unless intentional)
- [ ] Custom `BubbleFactory.build()` uses the passed `colorPalette`/`typography`/`spacing` params, not hardcoded values
- [ ] Style overrides use `merge()` pattern, not constructor replacement
- [ ] Theme lookups cached in `didChangeDependencies()` with `_themeInitialized` flag
- [ ] `Scaffold` containing `CometChatMessageComposer` uses `resizeToAvoidBottomInset: true` (or omits it) on `^6.0.1` — composer clamps to `viewInsets` (ENG-34434); `false` is only the pre-6.0.1 stopgap
- [ ] Custom `CometChatMessageOption.onItemClick` handles both `BaseMessage` and the controller protocol
- [ ] Request builders set `limit` to a reasonable value (default 30–50)
- [ ] Mutable `_user`/`_group` state copies passed to UIKit components, not `widget.user`/`widget.group`

## Sound (in-app message + call sounds)

Sound is a customization sub-dimension. The UI Kit plays incoming/outgoing message + call sounds via `CometChatSoundManager` — mute it, swap custom audio, or play a specific sound. The full API + recipe lives in **`cometchat-flutter-v6-theming`** (Sound section). Verify the access path against the installed kit before relying on it.
