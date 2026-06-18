---
name: cometchat-flutter-v6-messages
description: >
  Use when implementing the messages screen with CometChat Flutter UIKit v6. Covers
  CometChatMessageList, CometChatMessageComposer, CometChatMessageHeader, MessageListBloc,
  MessageComposerBloc, SliverSpacing, keyboard-aware spacing, rich text toolbar,
  CometChatTextBubble, CometChatImageBubble, CometChatVideoBubble, CometChatAudioBubble,
  CometChatFileBubble, CometChatMessageBubble, bubble factories, message templates,
  send message, edit message, delete message, reply, thread, reactions, receipts,
  typing indicators, mentions, markdown formatting, text formatters, scroll to bottom,
  unread messages, mark as read, goToMessageId, message options, swipe to reply,
  smart replies, conversation starters, or resizeToAvoidBottomInset. Also use when
  the user asks about building a chat screen, message input, or message display.
license: "MIT"
compatibility: "cometchat_chat_uikit ^6.0.1; flutter_bloc ^8.1.0"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter messages composer header bubbles keyboard rich-text"
---

> **Ground truth:** `cometchat_chat_uikit: ^6.0` — pub-cache source + `ui-kit/flutter`. **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

# CometChat Flutter UIKit — Messages

The messages screen is composed of three components: `CometChatMessageHeader`, `CometChatMessageList`, and `CometChatMessageComposer`.

## Complete Messages Screen

```dart
final colorPalette = CometChatThemeHelper.getColorPalette(context);
Scaffold(
  resizeToAvoidBottomInset: true, // matches sample app; composer clamps to viewInsets (ENG-34434)
  appBar: CometChatMessageHeader(
    user: user,
    group: group,
    onBack: () => Navigator.pop(context),
  ),
  body: SafeArea(
    top: false, // Header is the appBar — top inset already handled; keep bottom inset
    child: Container(
      color: colorPalette.background3,
      child: Column(
        children: [
          Expanded(
            child: CometChatMessageList(
              user: user,
              group: group,
              textFormatters: [
                CometChatMentionsFormatter(user: user, group: group),
                MarkdownTextFormatter(),
                CometChatUrlFormatter(),
                CometChatPhoneNumberFormatter(),
                CometChatEmailFormatter(),
              ],
            ),
          ),
          CometChatMessageComposer(
            user: user,
            group: group,
            textFormatters: [
              CometChatMentionsFormatter(user: user, group: group),
              MarkdownTextFormatter(),
              CometChatUrlFormatter(),
              CometChatPhoneNumberFormatter(),
              CometChatEmailFormatter(),
            ],
          ),
        ],
      ),
    ),
  ),
)
```

## CometChatMessageList

Displays messages with `SliverAnimatedList`, O(1) lookups, and keyboard-aware spacing.

### Key Props

| Prop | Type | Purpose |
|------|------|---------|
| `user` / `group` | `User?` / `Group?` | Target conversation (one required) |
| `goToMessageId` | `int?` | Jump to specific message on load |
| `startFromUnreadMessages` | `bool` | Start from unread position |
| `hideDeletedMessages` | `bool` | Hide deleted message placeholders |
| `disableReceipts` | `bool` | Hide read/delivered receipts |
| `disableReactions` | `bool` | Hide reaction bar |
| `enableSwipeToReply` | `bool` | Swipe gesture for reply |
| `hideDateSeparator` | `bool` | Hide date headers |
| `textFormatters` | `List<CometChatTextFormatter>` | Formatters for message text |
| `onThreadRepliesClick` | `Function(BaseMessage, BuildContext, {template})` | Thread navigation callback |
| `messagesRequestBuilder` | `MessagesRequestBuilder?` | Customize the underlying message query (see below) |

### MessagesRequestBuilder — customizing the message query

`CometChatMessageList` accepts a `messagesRequestBuilder` prop that lets you customize the underlying SDK request — page size, filters, search, etc. The class lives in the Chat SDK (`package:cometchat_sdk/cometchat_sdk.dart`) and exposes 30+ fluent setters. Common setters:

| Setter | Purpose |
|--------|---------|
| `setLimit(int)` | Page size (default 30, max 100) |
| `setTypes(List<String>)` | Restrict to message types (e.g. `['text', 'image']`) |
| `setCategories(List<String>)` | Restrict to categories (e.g. `['message', 'custom']`) |
| `setHideMessagesFromBlockedUsers(bool)` | Drop messages from blocked users |
| `setSearchKeyword(String)` | Server-side keyword search |
| `setTags(List<String>)` | Filter by message tags |
| `setHasAttachments(bool)` | Only messages with file attachments |
| `setHasLinks(bool)` | Only messages containing links |
| `setHideReplies(bool)` | Exclude threaded replies from the main list |
| `setHideDeleted(bool)` | Exclude deleted messages |
| `setHideQuotedMessages(bool)` | Exclude quoted-reply messages |
| `setUpdatedAfter(DateTime)` | Only messages updated after this DateTime |
| `setUpdatesOnly(bool)` | Return only updates, not new messages |
| `setParentMessageId(int)` | Fetch a thread's replies |
| `setMentionedUIDs(List<String>)` | Messages mentioning specific users |
| `setHasMentions(bool)` | Only messages with any mention |

Example — limit to 30, hide messages from blocked users, restrict to text + image:

```dart
CometChatMessageList(
  user: user,
  messagesRequestBuilder: MessagesRequestBuilder()
    ..setLimit(30)
    ..setHideMessagesFromBlockedUsers(true)
    ..setTypes(['text', 'image']),
)
```

### MessageListBloc Events

| Event | Purpose |
|-------|---------|
| `LoadMessages(conversationWith, conversationType)` | Initial load |
| `LoadOlderMessages` | Scroll up pagination |
| `LoadNewerMessages` | Scroll down pagination |
| `MessageReceived(message)` | Real-time incoming message |
| `MessageEdited(message)` | Real-time edit |
| `MessageDeleted(message)` | Real-time delete |
| `JumpToMessage(messageId)` | Scroll to specific message |
| `MarkMessageAsRead(message)` | Mark as read |
| `MarkMessageAsUnread(message)` | Mark as unread |

### MessageListState

```dart
MessageListState(
  status: MessageListStatus.loaded,  // initial, loading, loaded, empty, error
  messages: [...],
  isLoadingOlder: false,
  isLoadingNewer: false,
  hasMoreOlder: true,
  hasMoreNewer: false,
  unreadCount: 5,
  unreadMessageAnchor: message,
)
```

## CometChatMessageComposer

Rich text input with formatting toolbar, attachments, mentions, and audio recording.

### Key Props

| Prop | Type | Purpose |
|------|------|---------|
| `user` / `group` | `User?` / `Group?` | Target conversation |
| `disableTypingEvents` | `bool` | Stop sending typing indicators |
| `hideVoiceRecordingButton` | `bool` | Hide audio recorder |
| `hideSendButton` | `bool` | Hide send button |
| `hideAttachmentButton` | `bool` | Hide attachment picker |
| `hideStickersButton` | `bool` | Hide sticker panel |
| `disableMentions` | `bool` | Disable @mentions |
| `hideBottomSafeArea` | `bool` | Hide bottom safe area padding |
| `textFormatters` | `List<CometChatTextFormatter>` | Text formatters |

### Rich Text Formatting

The composer uses a WYSIWYG system (not the clean architecture module):
- `RichTextEditingController` — span tracking, markdown rendering, format application
- `SegmentComposerController` — multi-segment (normal text + code blocks)
- Toolbar buttons dispatch through `cometchat_message_composer.dart`

### buildWhen Optimization

The composer uses `buildWhen` to prevent rebuilds during keyboard animation:
```dart
BlocConsumer<MessageComposerBloc, MessageComposerState>(
  buildWhen: (previous, current) =>
      previous.isEditMode != current.isEditMode ||
      previous.isReplyMode != current.isReplyMode ||
      previous.isRecordingMode != current.isRecordingMode,
  // ...
)
```

The actual filter in `cometchat_message_composer.dart` also covers `editMessage` / `replyMessage` target changes and panel transitions (`headerPanel`, `footerPanel`, `previewPanel`, `lockedBottomPadding`, `isActiveStreaming`). The snippet above shows the three primary mode flags for brevity — if you subclass or wrap the composer, copy the full predicate from `cometchat_message_composer.dart` so edit/reply targets and panels also trigger rebuilds.

## CometChatMessageHeader

Shows user/group info, typing indicators, and optional call buttons.

```dart
CometChatMessageHeader(
  user: user,
  group: group,
  onBack: () => Navigator.pop(context),
  hideVideoCallButton: false,
  hideVoiceCallButton: false,
  usersStatusVisibility: true,
  trailingView: (user, group, ctx) => [
    IconButton(icon: Icon(Icons.info_outline), onPressed: () { /* ... */ }),
  ],
  messageHeaderStyle: CometChatMessageHeaderStyle(
    backgroundColor: colorPalette.background1,
  ),
)
```

## Keyboard-Aware Spacing

The composer coordinates with the keyboard internally — it tracks the native keyboard height and **clamps it to Flutter's `viewInsets`** (kit fix ENG-34434) so it does NOT add its own inset on top of the Scaffold's. The list's spacing then reacts to the same `viewInsets`:
- At bottom: keyboard pushes list up (normal behavior)
- Scrolled up: list stays still, only composer moves
- Safe area: only added when keyboard is closed

Because of that clamp, **set `resizeToAvoidBottomInset: true`** (or omit it — `true` is the Scaffold default), which is exactly what the kit's official sample app does (`messages_screen.dart` omits it → defaults `true`; `thread_screen.dart` sets it `true` explicitly).

> Version note: on kits **before ENG-34434 (pre-6.0.1)** the composer did NOT clamp, so `true` double-compensated and `false` was the workaround. On `^6.0.1` (what this skill targets) `true` is correct. If you ever see a double keyboard gap, you're on an older kit — upgrade, or set `false` as a stopgap.

## Message Bubbles

| Type | Widget | Key Features |
|------|--------|--------------|
| Text | `CometChatTextBubble` | Rich text, links, markdown |
| Image | `CometChatImageBubble` | Local/network, GIF, HEIC fallback |
| Video | `CometChatVideoBubble` | Thumbnail, play overlay |
| Audio | `CometChatAudioBubble` | Waveform, play/pause, duration |
| File | `CometChatFileBubble` | Type icon, download, size |
| Deleted | `CometChatDeletedBubble` | "Message was deleted" |

All bubble widgets accept optional `colorPalette`, `spacing`, `typography` params for the hybrid theme caching pattern.

## Sending Messages

```dart
// Text message
await CometChatUIKit.sendTextMessage(
  TextMessage(
    text: 'Hello!',
    receiverUid: user.uid,
    receiverType: ReceiverTypeConstants.user,
  ),
);

// Media message
await CometChatUIKit.sendMediaMessage(
  MediaMessage(
    file: '/path/to/image.jpg',
    type: MessageTypeConstants.image,
    receiverUid: user.uid,
    receiverType: ReceiverTypeConstants.user,
  ),
);

// Custom message
await CometChatUIKit.sendCustomMessage(
  CustomMessage(
    type: 'location',
    receiverUid: user.uid,
    receiverType: ReceiverTypeConstants.user,
    customData: {'latitude': 37.7749, 'longitude': -122.4194},
  ),
);
```

## Thread Replies

```dart
CometChatMessageList(
  onThreadRepliesClick: (message, ctx, {template}) {
    final colorPalette = CometChatThemeHelper.getColorPalette(context);
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => Scaffold(
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          child: Container(
            color: colorPalette.background3,
            child: Column(
              children: [
                CometChatThreadedHeader(
                  parentMessage: message,
                  loggedInUser: CometChatUIKit.loggedInUser!,
                ),
                Expanded(child: CometChatMessageList(
                  user: user, group: group,
                  parentMessageId: message.id,
                  // Scope the list to this thread only: exclude the parent and
                  // request just the replies for message.id.
                  withParent: false,
                  messagesRequestBuilder: MessagesRequestBuilder()
                    ..parentMessageId = message.id,
                )),
                CometChatMessageComposer(
                  user: user, group: group,
                  parentMessageId: message.id,
                ),
              ],
            ),
          ),
        ),
      ),
    ));
  },
)
```

## Gotchas

- Use `resizeToAvoidBottomInset: true` (or omit — it's the default), matching the kit sample app. On `^6.0.1` the composer clamps the keyboard height to Flutter's `viewInsets` (ENG-34434), so `true` does NOT double-compensate. Only on pre-6.0.1 kits did `true` cause a double keyboard gap (where `false` was the workaround) — if you see that gap, upgrade the kit.
- `textFormatters` should be the same list for both `CometChatMessageList` and `CometChatMessageComposer` to ensure consistent rendering.
- The rich text system has 3 implementations but only WYSIWYG is active at runtime. Bug fixes go in `rich_text_editing_controller.dart`, not the clean architecture module.
- `goToMessageId` loads messages around that ID, not from the beginning. The list may not have older messages loaded.
- Keep mutable `_user`/`_group` copies in your State class and update them from SDK listeners. Passing `widget.user`/`widget.group` directly means stale data after block/kick events.
- The CometChat SDK has an `Action` class (a `BaseMessage` subclass used in group events like kick/ban/scope-change). It conflicts with Flutter's built-in `Action` widget. If your messages screen uses SDK listener mixins that reference `Action`, use an import alias:
  ```dart
  import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart' as cc;
  // Then use: cc.Action instead of Action
  ```
  This is especially common when mixing `GroupListener` into a messages screen State class.

## Anti-Patterns

```dart
// ❌ WRONG — list not wrapped in Expanded (unbounded height → won't scroll / overflow)
Scaffold(
  body: Column(children: [
    CometChatMessageList(user: user),          // needs Expanded
    CometChatMessageComposer(user: user),
  ]),
)

// ✅ CORRECT — both messages and thread screens (matches the kit sample app)
Scaffold(
  resizeToAvoidBottomInset: true, // (or omit — true is the default; composer clamps to viewInsets, ENG-34434)
  body: Column(children: [
    Expanded(child: CometChatMessageList(user: user)),
    CometChatMessageComposer(user: user),
  ]),
)
```

```dart
// ❌ WRONG — passing immutable widget params to UIKit components
CometChatMessageList(user: widget.user) // Stale after block/unblock

// ✅ CORRECT — mutable state copy
late User? _user = widget.user;
// Update _user from SDK listeners
CometChatMessageList(user: _user)
```

```dart
// ❌ WRONG — different formatters for list and composer
CometChatMessageList(textFormatters: [MarkdownTextFormatter()])
CometChatMessageComposer(textFormatters: []) // Inconsistent rendering

// ✅ CORRECT — same formatters
final formatters = [CometChatMentionsFormatter(user: user), MarkdownTextFormatter()];
CometChatMessageList(textFormatters: formatters)
CometChatMessageComposer(textFormatters: formatters)
```

## Checklist

- [ ] Scaffold has `resizeToAvoidBottomInset: true` (or omitted — default; matches the sample app)
- [ ] Both list and composer have matching `textFormatters`
- [ ] Mutable `_user`/`_group` state copies, not `widget.user`/`widget.group`
- [ ] `onThreadRepliesClick` navigates to thread screen with `parentMessageId`
- [ ] Thread screen Scaffold also uses `resizeToAvoidBottomInset: true` (same as messages screen)
- [ ] SDK listeners update `_user`/`_group` for block/kick/scope changes
- [ ] Colors from `CometChatThemeHelper`, cached in `didChangeDependencies()`
- [ ] If using SDK listener mixins with `Action`, import UIKit `as cc` to avoid Flutter name conflict
