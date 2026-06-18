---
name: cometchat-angular-components
description: "Component catalog for the CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) — standalone <cometchat-*> selectors, verified @Input bindings, @Output events, @Input callback props, and template slot views. Always loaded before writing any <cometchat-*> HTML. Never invent selectors or bindings — look them up here."
license: "MIT"
compatibility: "Angular >=17 <22; @cometchat/chat-uikit-angular ^5.0"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular components catalog selectors inputs outputs standalone v5"
---

> **Ground truth:** `@cometchat/chat-uikit-angular@5.x` component catalog (installed package types) + `docs/ui-kit/angular`. **Official docs:** https://www.cometchat.com/docs/ui-kit/angular/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

# CometChat Angular UI Kit v5 — Component Catalog

Authoritative reference for every component you'll actually use. Verified against `@cometchat/chat-uikit-angular@5.0.2` bundled types. **Never invent a selector, `@Input`, or `@Output` — look it up here** (or grep `node_modules/@cometchat/chat-uikit-angular/types/cometchat-chat-uikit-angular.d.ts`).

Read `<cometchat-angular-core>` first.

## How v5 components work

- **Standalone.** Import the component **class** (with the `Component` suffix) into a standalone component's `imports: []`. No NgModule, no `CUSTOM_ELEMENTS_SCHEMA`.
- **Selector vs class:** the HTML selector has no suffix (`<cometchat-conversations>`); the class does (`CometChatConversationsComponent`).
- **No composites.** There is no `<cometchat-conversations-with-messages>` / `Contacts` in v5. Build layouts by composing components (see `<cometchat-angular-placement>`).

### Three binding mechanisms — get these right

| Mechanism | Syntax | Example |
|---|---|---|
| **`@Input`** (data + config + hide flags) | `[input]="value"` | `[user]="selectedUser"` |
| **`@Output`** (EventEmitter) | `(output)="handler($event)"` | `(itemClick)="onPick($event)"` |
| **`@Input` callback prop** (a function passed as input) | `[onCallback]="fnRef"` | `[onAccept]="handleAccept"` |
| **Slot view** (`@Input` of type `TemplateRef`/component) | `[slotView]="tmplRef"` | `[leadingView]="myTmpl"` |

> **The `@Output` vs `@Input`-callback distinction is the #1 Angular-v5 trap.** Most components use `@Output` EventEmitters (`(itemClick)`, `(error)`, `(callEnded)`). But the **call** components also expose **`@Input` callback props** (`onAccept`, `onDecline`, `onError`, `onVoiceCallClick`, …). And `<cometchat-incoming-call>` exposes **both** (`[onAccept]` input AND `(callAccepted)` output). Bind the one that exists — the tables below mark which is which.

```typescript
import { Component } from "@angular/core";
import { CometChatConversationsComponent } from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({
  selector: "app-conversations",
  standalone: true,
  imports: [CometChatConversationsComponent],
  template: `
    <cometchat-conversations
      [showSearchBar]="true"
      (itemClick)="onConversation($event)"
      (error)="onError($event)">
    </cometchat-conversations>`,
})
export class AppConversationsComponent {
  onConversation(conversation: CometChat.Conversation) { /* … */ }
  onError(e: CometChat.CometChatException) { /* … */ }
}
```

---

## List components

### CometChatConversationsComponent
Selector: `<cometchat-conversations>`

The conversation list. Drives the left pane of a chat layout.

- **Key `@Input`:** `conversationsRequestBuilder`, `activeConversation`, `selectionMode`, `options`, `showSearchBar`, `showScrollbar`, `lastMessageDateTimeFormat`, `textFormatters`, `disableSoundForMessages`, `customSoundForMessages`
- **Hide flags:** `hideReceipts`, `hideError`, `hideDeleteConversation`, `hideUserStatus`, `hideGroupType`, `disableDefaultContextMenu`
- **Slot views (`@Input`):** `headerView`, `menuView`, `loadingView`, `emptyView`, `errorView`, `searchView`, `itemView`, `leadingView`, `titleView`, `subtitleView`, `trailingView`
- **`@Output`:** `itemClick`, `select`, `error`, `searchBarClick`, `contextMenuOpen`, `contextMenuClose`, `scrollToTop`, `scrollToBottom`, `selectionChange`

### CometChatUsersComponent
Selector: `<cometchat-users>`

- **`@Input`:** `usersRequestBuilder`, `searchRequestBuilder`, `searchKeyword`, `activeUser`, `selectionMode`, `options`, `showSectionHeader`, `sectionHeaderKey`, `showScrollbar`, `showSelectedUsersPreview`
- **Hide flags:** `hideSearch`, `hideError`, `hideUserStatus`, `disableLoadingState`, `disableDefaultContextMenu`
- **Slots:** `headerView`, `menuView`, `loadingView`, `emptyView`, `errorView`, `itemView`, `leadingView`, `titleView`, `subtitleView`, `trailingView`
- **`@Output`:** `itemClick`, `select`, `error`, `empty`, `selectionChange`

### CometChatGroupsComponent
Selector: `<cometchat-groups>`

- **`@Input`:** `groupsRequestBuilder`, `searchRequestBuilder`, `activeGroup`, `selectionMode`, `options`, `showScrollbar`
- **Hide flags:** `hideSearch`, `hideError`, `hideGroupType`, `disableDefaultContextMenu`
- **Slots:** `headerView`, `menuView`, `loadingView`, `emptyView`, `errorView`, `itemView`, `leadingView`, `titleView`, `subtitleView`, `trailingView`
- **`@Output`:** `itemClick`, `select`, `error`, `selectionChange`

### CometChatGroupMembersComponent
Selector: `<cometchat-group-members>`

- **`@Input`:** `group` (required), `groupMemberRequestBuilder`, `searchRequestBuilder`, `searchKeyword`, `selectionMode`, `options`, `showScrollbar`
- **Hide flags:** `hideSearch`, `hideError`, `hideUserStatus`, `hideKickMemberOption`, `hideBanMemberOption`, `hideScopeChangeOption`, `disableLoadingState`, `disableDefaultContextMenu`
- **Slots:** `headerView`, `menuView`, `loadingView`, `errorView`, `emptyView`, `itemView`, `leadingView`, `titleView`, `subtitleView`, `trailingView`
- **`@Output`:** `error`, `itemClick`, `selectionChange`, `empty`

---

## Messaging components

### CometChatMessageHeaderComponent
Selector: `<cometchat-message-header>`

Header bar above the message list. Pass **`user` OR `group`** (mutually exclusive).

- **`@Input`:** `user`, `group`, `callSettingsBuilder`, `lastActiveAtDateTimeFormat`, `summaryGenerationMessageCount`, `enableAutoSummaryGeneration`
- **Show/hide:** `hideUserStatus`, `showBackButton`, `hideVoiceCallButton`, `hideVideoCallButton`, `showSearchOption`, `showConversationSummaryButton`
- **Slots:** `headerView`, `itemView`, `leadingView`, `titleView`, `subtitleView`, `trailingView`, `backButtonView`, `auxiliaryButtonView`
- **`@Output`:** `backClick`, `itemClick`, `searchClick`, `conversationSummaryClick`, `error`, `voiceCallClick`, `videoCallClick`

### CometChatMessageListComponent
Selector: `<cometchat-message-list>`

The message stream. Pass **`user` OR `group`** (and `parentMessageId` for threads).

- **Key `@Input`:** `user`, `group`, `parentMessageId`, `messagesRequestBuilder`, `reactionsRequestBuilder`, `textFormatters`, `messageAlignment`, `scrollToBottomOnNewMessages`, `goToMessageId`, `quickOptionsCount`, `additionalOptions`, `optionsOverride`
- **AI/replies:** `showConversationStarters`, `showSmartReplies`, `smartRepliesKeywords`, `smartRepliesDelayDuration`
- **Hide flags (many):** `hideReceipts`, `hideDateSeparator`, `hideStickyDate`, `hideAvatar`, `hideGroupActionMessages`, `hideError`, `hideReplyInThreadOption`, `hideTranslateMessageOption`, `hideEditMessageOption`, `hideDeleteMessageOption`, `hideReactionOption`, `hideMessagePrivatelyOption`, `hideCopyMessageOption`, `hideMessageInfoOption`, `hideReplyOption`, `hideTimestamp`, `hideModerationView`, `hideFlagMessageOption`, `showMarkAsUnreadOption`, `startFromUnreadMessages`, `disableInteraction`
- **Slots:** `headerView`, `footerView`, `emptyView`, `errorView`, `loadingView`, `bubbleFooterView`, `appendView`
- **`@Output`:** `error`, `threadRepliesClick`, `reactionClick`, `reactionListItemClick`, `smartReplyClick`, `conversationStarterClick`, `messagePrivatelyClick`, `replyClick`

### CometChatMessageComposerComponent
Selector: `<cometchat-message-composer>`

The input box. Pass **`user` OR `group`** (and `parentMessageId` for threads).

- **Key `@Input`:** `user`, `group`, `parentMessageId`, `placeholderText`, `initialComposerText`, `text`, `maxHeight`, `enterKeyBehavior`, `attachmentOptions`, `maxAttachments`, `allowedFileTypes`, `maxFileSize`, `layout`, `textFormatters`, `messageToEdit`, `messageToReply`, `mentionsUsersRequestBuilder`, `mentionsGroupMembersRequestBuilder`
- **Hide flags:** `hideAttachmentButton`, `hideImageAttachmentOption`, `hideVideoAttachmentOption`, `hideAudioAttachmentOption`, `hideFileAttachmentOption`, `hidePollsOption`, `hideCollaborativeDocumentOption`, `hideCollaborativeWhiteboardOption`, `hideEmojiKeyboardButton`, `hideVoiceRecordingButton`, `hideStickersButton`, `hideLiveReaction`, `hideSendButton`, `hideRichTextToolbar`, `disableMentions`, `disableMentionAll`, `disableTypingEvents`, `enableRichText`
- **Slots:** `headerView`, `footerView`, `sendButtonView`, `auxiliaryButtonView`, `secondaryButtonView`, `attachmentIconView`, `voiceRecordingIconView`, `emojiIconView`, `errorView`
- **`@Output`:** `textChange`, `sendButtonClick`, `error`, `closePreview`, `attachmentAdded`, `attachmentRemoved`, `mentionSelected`

### CometChatMessageInformationComponent
Selector: `<cometchat-message-information>`

- **`@Input`:** `message`, `dateTimeFormat`, `textFormatters`, `showScrollbar` · **`@Output`:** `closeClick`

### Threads — `<cometchat-thread-header>` / `<cometchat-thread-view>`
- `<cometchat-thread-header>`: `@Input` `parentMessage`, `replyCount` · `@Output` `closeClick`, `backClick`
- `<cometchat-thread-view>`: `@Input` `mode`, `replyCount`, `unreadReplyCount`, `parentMessage`, `announceOnOpen` · `@Output` `threadClick`, `closeClick`
- For a thread pane, render `<cometchat-message-list>` + `<cometchat-message-composer>` with the same `[parentMessageId]`.

### CometChatReactionsComponent
Selector: `<cometchat-reactions>`

- **`@Input`:** `message`, `alignment`, `reactionsRequestBuilder`, `hoverDebounceTime` · **`@Output`:** `reactionClick`, `reactionListItemClick`

### CometChatSearchComponent
Selector: `<cometchat-search>`

Unified conversation + message search.
- **Key `@Input`:** `searchIn`, `searchFilters`, `initialSearchFilter`, `defaultSearchText`, `uid`, `guid`, `conversationsRequestBuilder`, `messagesRequestBuilder`, `hideBackButton` (+ per-result slot views)
- **`@Output`:** `backClick`, `conversationClick`, `messageClick`, `searchError`

---

## Call components

> **Binding nuance:** call components use **`@Input` callback props** (`onAccept`, `onDecline`, `onError`, `onVoiceCallClick`, …) AND some `@Output` EventEmitters. Bind the form that exists per the tables. `<cometchat-incoming-call>` exposes both — prefer the `@Input` callbacks for accept/decline (they carry the kit's call handling) and use the `@Output`s for observing.

### CometChatCallButtonsComponent
Selector: `<cometchat-call-buttons>`

Voice/video buttons for a `user` or `group`. Drop into a header or contact row.
- **`@Input`:** `user`, `group`, `callSettingsBuilder`, `hideVoiceCallButton`, `hideVideoCallButton`, `hideOverlays`, `outgoingCallDisableSoundForCalls`, `outgoingCallCustomSoundForCalls`
- **`@Input` callbacks:** `onVoiceCallClick`, `onVideoCallClick`, `onError`
- **Slots:** `voiceCallButtonView`, `videoCallButtonView`
- **`@Output`:** `error`

### CometChatIncomingCallComponent
Selector: `<cometchat-incoming-call>`

Incoming-call banner/overlay. Mount app-wide (see calls skill).
- **`@Input`:** `call`, `disableSoundForCalls`, `customSoundForCalls`
- **`@Input` callbacks:** `onAccept`, `onDecline`, `onError`
- **Slots:** `itemView`, `titleView`, `subtitleView`, `leadingView`, `trailingView`, `acceptButtonView`, `declineButtonView`
- **`@Output`:** `callAccepted`, `callDeclined`, `error`

### CometChatOutgoingCallComponent
Selector: `<cometchat-outgoing-call>`

- **`@Input`:** `call`, `disableSoundForCalls`, `customSoundForCalls` · **`@Input` callback:** `onError` · **Slots:** `titleView`, `subtitleView`, `avatarView`, `cancelButtonView` · **`@Output`:** `callCanceled`, `error`

### CometChatOngoingCallComponent
Selector: `<cometchat-ongoing-call>`

The active WebRTC call surface.
- **`@Input`:** `sessionID`, `callSettingsBuilder`, `callWorkflow`, `isAudioOnly` · **`@Input` callback:** `onError` · **Slot:** `callScreenView` · **`@Output`:** `callEnded`, `error`

### CometChatCallLogsComponent
Selector: `<cometchat-call-logs>`

- **`@Input`:** `activeCall`, `callLogRequestBuilder`, `callSettingsBuilder`, `callInitiatedDateTimeFormat`, `showScrollbar` · **`@Input` callback:** `onError` · **Slots:** `menuView`, `itemView`, `leadingView`, `titleView`, `subtitleView`, `trailingView`, `loadingView`, `emptyView`, `errorView` · **`@Output`:** `itemClick`, `callButtonClicked`

---

## AI components

### CometChatConversationStarterComponent
`<cometchat-conversation-starter>` — `@Input` `user`, `group` · `@Output` `starterClick`

### CometChatConversationSummaryComponent
`<cometchat-conversation-summary>` — `@Input` `getConversationSummary`, `closeCallback`

### CometChatSmartRepliesComponent
`<cometchat-smart-replies>` — smart-reply chips

### CometChatAIAssistantChat
`<cometchat-ai-assistant-chat>` (+ `CometChatAIAssistantChatHistory` / `CometChatAIAssistantMessageBubble`) — AI assistant chat surfaces.

AI views are usually surfaced through `<cometchat-message-list>`'s `showSmartReplies` / `showConversationStarters` inputs and the header's summary button — see the `cometchat-angular-features` skill.

---

## Other exported components (selectors)

Building blocks + bubbles + dialogs you rarely instantiate directly (the list/message components compose them), but they're exported and available: `<cometchat-avatar>`, `<cometchat-button>`, `<cometchat-list-item>`, `<cometchat-date>`, `<cometchat-search-bar>`, `<cometchat-emoji-keyboard>`, `<cometchat-stickers-keyboard>`, `<cometchat-media-recorder>`, `<cometchat-reaction-list>`, `<cometchat-reaction-info>`, `<cometchat-create-poll>`, `<cometchat-fullscreen-viewer>`, `<cometchat-confirm-dialog>`, `<cometchat-flag-message-dialog>`, `<cometchat-change-scope>`, `<cometchat-context-menu>`, `<cometchat-popover>`, `<cometchat-toast>`, `<cometchat-typing-indicator>`, and the bubble set (`<cometchat-text-bubble>`, `-image-bubble`, `-video-bubble`, `-audio-bubble`, `-file-bubble`, `-call-bubble`, `-poll-bubble`, `-sticker-bubble`, `-collaborative-document-bubble`, `-collaborative-whiteboard-bubble`, `-action-bubble`, `-delete-bubble`, `-message-bubble`).

To confirm any of their bindings, grep the bundled `.d.ts` for `ɵɵComponentDeclaration<<Class>,` — the input/output names are in the type literal.

---

## Anti-patterns

1. **Don't invent bindings.** If a prop isn't in this catalog (or the `.d.ts`), it doesn't exist. v4 prop names frequently differ from v5.
2. **Don't bind a call `@Input` callback as an `@Output`** (or vice-versa). `[onAccept]="fn"` (input) vs `(callAccepted)="fn($event)"` (output) — use the one listed.
3. **Don't reach for a composite** (`<cometchat-conversations-with-messages>`) — removed in v5. Compose manually.
4. **Don't pass both `[user]` and `[group]`** to header/list/composer — they're mutually exclusive; pass exactly one.
5. **Don't add `CUSTOM_ELEMENTS_SCHEMA`** — v5 components are real Angular components; importing the class is enough.
6. **Don't forget to import the component class** into the standalone component's `imports: []` — otherwise the selector renders as an unknown element.

## Pointers
- `<cometchat-angular-core>` — setup, init, login
- `<cometchat-angular-placement>` — composing these into routes/modals/drawers
- `<cometchat-angular-customization>` — slot templates, formatters, options overrides
- `<cometchat-angular-calls>` — full call flow + incoming-call mounting
