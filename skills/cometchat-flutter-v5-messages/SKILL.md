---
name: cometchat-flutter-v5-messages
description: "Use when working with CometChat Flutter UIKit v5 message components. Triggers on CometChatMessageList, CometChatMessageComposer, CometChatCompactMessageComposer, CometChatMessageHeader, threads."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_uikit_shared ^5.2.3"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 messages list composer header bubbles threads compact"
---

# CometChat Flutter UIKit v5 — Messages

Components for displaying, sending, and managing messages.

## CometChatMessageList

Displays messages in a conversation.

### Key Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `user` | `User?` | — | User for 1-on-1 chat (one of user/group required) |
| `group` | `Group?` | — | Group for group chat |
| `messagesRequestBuilder` | `MessagesRequestBuilder?` | — | Custom message fetch builder |
| `style` | `CometChatMessageListStyle?` | — | Visual styling |
| `alignment` | `ChatAlignment` | `standard` | `standard` or `leftAligned` |
| `onThreadRepliesClick` | `ThreadRepliesClick?` | — | Thread reply tap callback |
| `templates` | `List<CometChatMessageTemplate>?` | — | Custom message templates |
| `textFormatters` | `List<CometChatTextFormatter>?` | — | Custom text formatters |
| `receiptsVisibility` | `bool` | `true` | Show read receipts |
| `avatarVisibility` | `bool` | `true` | Show avatars |
| `disableReactions` | `bool` | `false` | Disable reactions |
| `disableMentions` | `bool?` | — | Disable @mentions |
| `messageId` | `int?` | — | Scroll to specific message |
| `startFromUnreadMessages` | `bool` | `false` | Start from unread |
| `showMarkAsUnreadOption` | `bool` | `false` | Show mark-as-unread option |
| `enableSmartReplies` | `bool` | `false` | Enable AI smart replies |
| `enableConversationStarters` | `bool` | `false` | Enable conversation starters |
| `generateConversationSummary` | `bool` | `false` | Generate AI summary |
| `hideEditMessageOption` | `bool` | `false` | Hide edit option |
| `hideDeleteMessageOption` | `bool` | `false` | Hide delete option |
| `hideReplyInThreadOption` | `bool` | `false` | Hide reply-in-thread |
| `hideThreadView` | `bool?` | — | Hide thread view entirely |
| `hideReactionOption` | `bool` | `false` | Hide reaction option |
| `hideTranslateMessageOption` | `bool` | `false` | Hide translate option |
| `hideMessagePrivatelyOption` | `bool` | `false` | Hide private message option |
| `hideMessageInfoOption` | `bool` | `false` | Hide message info |
| `hideFlagOption` | `bool` | `false` | Hide flag/report option |
| `loadingStateView` | `WidgetBuilder?` | — | Custom loading state |
| `emptyStateView` | `WidgetBuilder?` | — | Custom empty state |
| `errorStateView` | `WidgetBuilder?` | — | Custom error state |

### Usage

```dart
CometChatMessageList(
  user: user,
  textFormatters: [
    CometChatEmailFormatter(),
    CometChatPhoneNumberFormatter(),
    CometChatUrlFormatter(),
    CometChatMentionsFormatter(user: user),
  ],
  receiptsVisibility: true,
  hideReplyInThreadOption: false,
  hideEditMessageOption: false,
  hideDeleteMessageOption: false,
)
```

## CometChatMessageComposer

Full-featured message input with attachments, voice recording, mentions, and AI features.

### Key Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `user` | `User?` | — | Target user (one of user/group required) |
| `group` | `Group?` | — | Target group |
| `messageComposerStyle` | `CometChatMessageComposerStyle?` | — | Visual styling |
| `parentMessageId` | `int` | `0` | Thread parent message ID |
| `placeholderText` | `String?` | — | Input placeholder |
| `textFormatters` | `List<CometChatTextFormatter>?` | — | Text formatters |
| `disableTypingEvents` | `bool` | `false` | Disable typing indicators |
| `disableMentions` | `bool?` | — | Disable @mentions |
| `disableMentionAll` | `bool` | `false` | Disable @all mentions |
| `hideVoiceRecordingButton` | `bool?` | — | Hide voice recording |
| `hideAttachmentButton` | `bool?` | — | Hide attachment button |
| `hideSendButton` | `bool?` | — | Hide send button |
| `hideStickersButton` | `bool?` | — | Hide stickers |
| `hideImageAttachmentOption` | `bool?` | — | Hide image attachment |
| `hideVideoAttachmentOption` | `bool?` | — | Hide video attachment |
| `hideAudioAttachmentOption` | `bool?` | — | Hide audio attachment |
| `hideFileAttachmentOption` | `bool?` | — | Hide file attachment |
| `hidePollsOption` | `bool?` | — | Hide polls |
| `hideCollaborativeDocumentOption` | `bool?` | — | Hide collaborative doc |
| `hideCollaborativeWhiteboardOption` | `bool?` | — | Hide whiteboard |
| `hideTakePhotoOption` | `bool?` | — | Hide take photo |
| `onSendButtonTap` | `Function?` | — | Custom send handler |
| `onError` | `OnError?` | — | Error callback |

## CometChatCompactMessageComposer

Compact variant with rounded pill-shaped input, inline rich text toolbar, and modern minimal aesthetic. Use it explicitly in your widget tree when you want this look — there is no global `Layout` toggle that swaps composers automatically.

### Props unique to Compact (not in regular composer)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `compactMessageComposerStyle` | `CometChatCompactMessageComposerStyle?` | — | Visual styling |
| `enableRichTextFormatting` | `bool` | `true` | Enable rich text (master switch) |
| `showRichTextFormattingOptions` | `bool` | `true` | Show toolbar above composer |
| `showTextSelectionMenuItems` | `bool` | `true` | Formatting in text selection menu |
| `hideRichTextFormattingOptions` | `Set<FormatType>?` | — | Hide specific format types |
| `richTextToolbarStyle` | `CometChatRichTextToolbarStyle?` | — | Toolbar styling |
| `enterKeyBehavior` | `EnterKeyBehavior` | `newLine` | Enter key: `sendMessage` or `newLine` |

All other props (user, group, parentMessageId, hide* options, textFormatters, etc.) are the same as `CometChatMessageComposer`.

### Usage

```dart
// ✅ CORRECT — compact composer with thread support
CometChatCompactMessageComposer(
  user: user,
  parentMessageId: parentMessage.id,
  disableTypingEvents: false,
  disableMentions: false,
  hideVoiceRecordingButton: false,
)
```

## CometChatMessageHeader

Displays user/group info. Implements `PreferredSizeWidget` for use as `appBar`.

### Key Props

| Prop | Type | Description |
|------|------|-------------|
| `user` | `User?` | User to display |
| `group` | `Group?` | Group to display |
| `messageHeaderStyle` | `CometChatMessageHeaderStyle?` | Visual styling |
| `subtitleView` | `Widget? Function(Group?, User?, BuildContext)?` | Custom subtitle |
| `listItemView` | `Widget Function(Group?, User?, BuildContext)?` | Custom list item |
| `showBackButton` | `bool?` | Show back button (default: true) |
| `onBack` | `VoidCallback?` | Back button callback |
| `hideVideoCallButton` | `bool?` | Hide video call button |
| `hideVoiceCallButton` | `bool?` | Hide voice call button |
| `usersStatusVisibility` | `bool` | Show online status (default: true) |
| `options` | `Function(User?, Group?, BuildContext)?` | Custom header options menu |

## CometChatThreadedHeader

Displays the parent message for threaded conversations.

### Key Props

| Prop | Type | Description |
|------|------|-------------|
| `parentMessage` | `BaseMessage` | The parent message (required) |
| `loggedInUser` | `User` | Current logged-in user (NON-nullable; pass `CometChatUIKit.loggedInUser!`) |
| `template` | `CometChatMessageTemplate?` | Message template |
| `receiptsVisibility` | `bool?` | Show receipts |
| `height` | `double?` | Header height |
| `width` | `double?` | Header width |
| `messageActionView` | `Function(BaseMessage, BuildContext)?` | Builder for a custom action view in the header |
| `style` | `CometChatThreadedHeaderStyle?` | Visual style |
| `textFormatters` | `List<CometChatTextFormatter>?` | Custom text formatters |

### Threaded Messages Pattern

```dart
Scaffold(
  body: Column(
    children: [
      CometChatThreadedHeader(
        parentMessage: parentMessage,
        loggedInUser: CometChatUIKit.loggedInUser!,
      ),
      Expanded(
        child: CometChatMessageList(
          user: user,
          messagesRequestBuilder: MessagesRequestBuilder()
            ..parentMessageId = parentMessage.id,
        ),
      ),
      CometChatMessageComposer(
        user: user,
        parentMessageId: parentMessage.id,
      ),
    ],
  ),
)
```

## Sending Messages Programmatically

Use `CometChatUIKit` static methods (not `CometChat` directly) to ensure UIKit events fire:

```dart
// ✅ CORRECT
CometChatUIKit.sendTextMessage(message, onSuccess: ..., onError: ...);

// ❌ WRONG — bypasses UIKit events (ccMessageSent won't fire)
CometChat.sendMessage(message, onSuccess: ...);
```

## Golden Path — Messages Screen

```dart
class MessagesScreen extends StatelessWidget {
  final User? user;
  final Group? group;
  const MessagesScreen({super.key, this.user, this.group});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CometChatMessageHeader(
        user: user,
        group: group,
        onBack: () => Navigator.pop(context),
      ),
      body: Column(
        children: [
          Expanded(child: CometChatMessageList(user: user, group: group)),
          CometChatMessageComposer(user: user, group: group),
        ],
      ),
    );
  }
}
```

## Anti-Patterns

```dart
// ❌ WRONG — passing two NON-null targets at the same time
CometChatMessageList(user: aUser, group: aGroup) // ambiguous — kit ignores group
// ✅ At any moment, exactly one of user/group must be non-null.
// Passing both fields with one null (e.g. `user: user, group: null`) is fine
// and is what the chat-builder sample app does to switch between contexts.

// ❌ WRONG — using CometChat.sendMessage instead of CometChatUIKit
CometChat.sendMessage(message, onSuccess: ...);
```

## Checklist — Messages Screen

- [ ] Only one of `user` or `group` passed to each component
- [ ] Same `user`/`group` passed to Header, List, and Composer
- [ ] Thread replies use `parentMessageId` on both List and Composer
- [ ] Messages sent via `CometChatUIKit.sendTextMessage()`
