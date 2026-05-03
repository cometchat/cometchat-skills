---
name: cometchat-angular-components
description: "Component catalog for the CometChat Angular UI Kit v4 — HTML selector names, Angular Input bindings, Output events, slot templates, request builders, style objects, and composite components. Always loaded before writing <cometchat-*> HTML."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular components catalog props bindings events templates"
---

## Purpose

Teaches Claude every component the Angular UI Kit v4 exports, with the HTML selectors, Angular `[Input]` bindings, `(Output)` events, `ng-template` slot views, request builders, and style objects that actually exist. This is the authoritative reference — never invent component names or bindings; look them up here.

**Read `cometchat-angular-core` before this skill** — module imports, `CUSTOM_ELEMENTS_SCHEMA`, and init/login are prerequisites.

Ground truth: `docs/ui-kit/angular/components-overview`, per-component doc pages at `docs/ui-kit/angular/`, and `@cometchat/chat-uikit-angular@4.x` exports.

---

## How to use this catalog

Angular UI Kit components are Angular standalone components that render as custom HTML elements. Three patterns cover almost every use case:

| Pattern | Components | Use when |
|---|---|---|
| **Composite (quickest)** | `<cometchat-conversations-with-messages>` — renders a 3-panel layout (Conversations + Messages + Details) in one tag | Full-page route placements with **≥ 1024px** of horizontal space. The composite reserves room for a Details panel — in narrower containers (modals, sidebars, drawers) the Details slot stays empty and the layout looks broken. |
| **Two-pane (custom layout)** | `<cometchat-conversations>` + `<cometchat-messages>` side by side | Modal / dialog / sidebar / drawer placements (anywhere narrower than ~1024px). You wire the click handler from Conversations to set the active user/group on Messages. |
| **Granular (full control)** | `<cometchat-message-header>` + `<cometchat-message-list>` + `<cometchat-message-composer>` | Embedded chat surfaces with no inbox — e.g. a "Contact seller" modal that opens a 1:1 thread directly, or a per-page chat panel pinned to a specific user/group. |

**Data flow:** a list component calls the `[onItemClick]` Input callback with a `CometChat.Conversation` / `User` / `Group`. Extract the entity and pass it as `[user]` or `[group]` to the message components.

---

## Binding conventions (applies to every `<cometchat-*>` component)

| Binding type | Angular syntax | Example |
|---|---|---|
| **Input (data in)** | `[propName]="value"` | `[user]="selectedUser"` |
| **Input callback (`on*`)** | `[onXxx]="handlerFn"` | `[onItemClick]="onConvClick"` |
| **String literal** | `propName="string"` | `title="Chats"` |
| **Template slot** | `[slotName]="templateRef"` + `<ng-template #ref>` | `[listItemView]="customItem"` |
| **Style object** | `[componentStyle]="styleInstance"` | `[conversationsStyle]="myStyle"` |

> **Critical — `on*` props are `@Input()` callbacks, NOT `@Output()` events.** Use `[onItemClick]="myFn"` (square brackets), never `(onItemClick)="myFn($event)"` (round brackets). This applies to every `on*` prop across all CometChat components: `[onItemClick]`, `[onError]`, `[onSelect]`, `[onSendButtonClick]`, `[onAccept]`, `[onDecline]`, `[onVoiceCallClick]`, `[onVideoCallClick]`, etc.

---

## 1. Composite Components

### CometChatConversationsWithMessages

The fastest integration — renders a full inbox + message thread + details panel (3-panel layout) in one component. Handles routing between conversations and messages internally.

> **⚠️ Width requirement: ≥ 1024px.** This composite renders a 3-panel layout (Conversations + Messages + Details). Below ~1024px of available width, the Details panel stays empty and visible — the layout looks broken with whitespace where Details should be. **Do not use this composite inside a modal, dialog, drawer, or sidebar** unless the container is at least 1024px wide. Use the Two-pane pattern (`<cometchat-conversations>` + `<cometchat-messages>`) for narrower placements (see § *Two-pane modal layout* in `cometchat-angular-placement`).

```html
<!-- app.component.html — full-page route placement only -->
<cometchat-conversations-with-messages></cometchat-conversations-with-messages>
```

```typescript
// app.module.ts
import { CometChatConversationsWithMessages } from "@cometchat/chat-uikit-angular";
@NgModule({ imports: [CometChatConversationsWithMessages], schemas: [CUSTOM_ELEMENTS_SCHEMA] })
```

Key inputs: `[conversationsWithMessagesStyle]`, `[messagesConfiguration]`, `[conversationsConfiguration]`.

### CometChatUsersWithMessages

Renders a users list + message thread.

```html
<cometchat-users-with-messages></cometchat-users-with-messages>
```

### CometChatGroupsWithMessages

Renders a groups list + message thread.

```html
<cometchat-groups-with-messages></cometchat-groups-with-messages>
```

---

## 2. Lists

### CometChatConversations

Scrollable list of recent conversations (user + group).

```html
<cometchat-conversations
  [conversationsRequestBuilder]="conversationsRequestBuilder"
  [onItemClick]="handleConvClick"
  [onError]="handleError"
  title="Chats"
  [hideReceipt]="false"
  [hideSeparator]="false"
  [disableUsersPresence]="false"
></cometchat-conversations>
```

```typescript
import { Component } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({ /* ... */ })
export class AppComponent {
  conversationsRequestBuilder = new CometChat.ConversationsRequestBuilder().setLimit(20);

  handleConvClick = (conversation: CometChat.Conversation): void => {
    const entity = conversation.getConversationWith();
    const type = conversation.getConversationType();
    // navigate or set selectedUser / selectedGroup
  };

  handleError = (error: CometChat.CometChatException): void => {
    console.error(error);
  };
}
```

Key inputs: `[conversationsRequestBuilder]`, `[onItemClick]`, `[onSelect]`, `[onError]`, `title`, `[hideReceipt]`, `[hideSeparator]`, `[disableUsersPresence]`, `[disableTyping]`, `[disableMentions]`, `[activeConversation]`, `[listItemView]`, `[menu]`, `[options]`, `[textFormatters]`, `[conversationsStyle]`, `[avatarStyle]`, `[statusIndicatorStyle]`, `[badgeStyle]`, `[dateStyle]`, `[listItemStyle]`.

### CometChatUsers

```html
<cometchat-users
  [usersRequestBuilder]="usersRequestBuilder"
  [onItemClick]="handleUserClick"
  [hideStatus]="false"
  [hideSearch]="false"
></cometchat-users>
```

Key inputs: `[usersRequestBuilder]`, `[onItemClick]`, `[onSelect]`, `[onError]`, `title`, `[hideStatus]`, `[hideSearch]`, `[listItemView]`, `[menu]`, `[options]`, `[usersStyle]`, `[avatarStyle]`, `[statusIndicatorStyle]`, `[listItemStyle]`.

### CometChatGroups

```html
<cometchat-groups
  [groupsRequestBuilder]="groupsRequestBuilder"
  [onItemClick]="handleGroupClick"
></cometchat-groups>
```

Key inputs: `[groupsRequestBuilder]`, `[onItemClick]`, `[onSelect]`, `[onError]`, `title`, `[hideSearch]`, `[listItemView]`, `[menu]`, `[options]`, `[groupsStyle]`, `[avatarStyle]`, `[listItemStyle]`.

### CometChatGroupMembers

```html
<cometchat-group-members
  [group]="selectedGroup"
  [groupMemberRequestBuilder]="memberRequestBuilder"
  [onItemClick]="handleMemberClick"
  [options]="getMemberOptions"
></cometchat-group-members>
```

Key inputs: `[group]` (**required** — pass a `CometChat.Group` instance), `[groupMemberRequestBuilder]`, `[onItemClick]`, `[onBack]`, `[onClose]`, `[options]`, `[groupMembersStyle]`, `[hideSearch]`, `[selectionMode]`, `[disableUsersPresence]`.

---

## 3. Messages

### CometChatMessages

Composite message view — header + list + composer in one component.

```html
<cometchat-messages
  [user]="selectedUser"
  [messageHeaderConfiguration]="headerConfig"
  [messageListConfiguration]="listConfig"
  [messageComposerConfiguration]="composerConfig"
></cometchat-messages>
```

Key inputs: `[user]` OR `[group]` (one required), `[messageHeaderConfiguration]`, `[messageListConfiguration]`, `[messageComposerConfiguration]`, `[messagesStyle]`.

### CometChatMessageHeader

```html
<cometchat-message-header
  [user]="selectedUser"
  [onBack]="handleBack"
  [hideBackButton]="false"
  [menu]="menuTemplate"
></cometchat-message-header>
```

Key inputs: `[user]` OR `[group]`, `[onBack]`, `[hideBackButton]`, `[menu]`, `[subtitleView]`, `[listItemView]`, `[messageHeaderStyle]`, `[avatarStyle]`, `[statusIndicatorStyle]`, `[disableUsersPresence]`, `[disableTyping]`.

> **Note:** `[hideVideoCallButton]` and `[hideVoiceCallButton]` do **not** exist on `<cometchat-message-header>`. Those inputs live on `<cometchat-call-buttons>`. To hide call buttons from the header, simply omit `<cometchat-call-buttons>` from the `[menu]` slot.

### CometChatMessageList

Scrollable message feed. Handles reactions, receipts, mentions, threads, and media.

```html
<cometchat-message-list
  [user]="selectedUser"
  [messagesRequestBuilder]="messagesRequestBuilder"
  [hideReceipt]="false"
  [disableReactions]="false"
  [textFormatters]="textFormatters"
  [templates]="messageTemplates"
  [onThreadRepliesClick]="openThread"
  [onError]="handleError"
></cometchat-message-list>
```

Key inputs: `[user]` OR `[group]`, `[parentMessageId]` (for thread replies), `[messagesRequestBuilder]`, `[textFormatters]`, `[templates]`, `[hideReceipt]`, `[disableReactions]`, `[disableSoundForMessages]`, `[disableMentions]`, `[hideError]`, `[hideDateSeparator]`, `[onThreadRepliesClick]` (Input callback — use `[onThreadRepliesClick]="handler"` not `(onThreadRepliesClick)`), `[onError]` (Input callback), `[emptyStateView]`, `[errorStateView]`, `[loadingStateView]`, `[messageListStyle]`, `[reactionsConfiguration]`, `[messageInformationConfiguration]`.

> **Important — all `on*` props are `@Input()` callbacks, not `@Output()` events.** Use `[onThreadRepliesClick]="myFn"` (square brackets), never `(onThreadRepliesClick)="myFn($event)"` (round brackets). The same applies to `[onError]`.

> **Note:** `[hideReplyInThreadOption]`, `[hideReceipts]`, `[hideReactions]`, `[hideReplyOption]`, `[hideEditMessageOption]`, `[hideDeleteMessageOption]`, `[hideTranslateMessageOption]` do **not** exist in the Angular v4 UIKit. Use `[disableReactions]` to disable reactions. Message action options (edit, delete, translate, thread) are controlled via the `[options]` callback or `[templates]` — not individual hide inputs.

### CometChatMessageComposer

Rich text input. Attachments, mentions, voice notes, sticker picker.

```html
<cometchat-message-composer
  [user]="selectedUser"
  placeholderText="Type a message..."
  [textFormatters]="textFormatters"
  [attachmentOptions]="attachmentOptions"
  [onSendButtonClick]="handleSend"
  [onError]="handleError"
  [auxilaryButtonView]="auxButtonTemplate"
></cometchat-message-composer>
```

Key inputs: `[user]` OR `[group]`, `[parentMessageId]` (for thread composer), `placeholderText`, `[textFormatters]`, `[attachmentOptions]`, `[auxilaryButtonView]` (**note spelling: one `i` — `auxilary` not `auxiliary`**), `[headerView]`, `[sendButtonView]`, `[onSendButtonClick]` (Input callback), `[onError]` (Input callback), `[onTextChange]` (Input callback), `[disableMentions]`, `[disableSoundForMessages]`, `[messageComposerStyle]`.

> **Important — all `on*` props are `@Input()` callbacks, not `@Output()` events.** Use `[onSendButtonClick]="myFn"` (square brackets), never `(onSendButtonClick)="myFn($event)"` (round brackets). The same applies to `[onError]` and `[onTextChange]`.

---

## 4. Calling (separate SDK)

Call components require `@cometchat/calls-sdk-javascript` to be installed. Do not import these if the calls SDK isn't in the project.

### CometChatCallButtons

Voice + video call initiators. Drop into the message header's `[menu]` slot.

```html
<cometchat-call-buttons
  [user]="selectedUser"
  [onVoiceCallClick]="handleVoiceCall"
  [onVideoCallClick]="handleVideoCall"
></cometchat-call-buttons>
```

> **All `on*` props are `@Input()` callbacks.** Use `[onVoiceCallClick]="myFn"` (square brackets), never `(onVoiceCallClick)="myFn($event)"` (round brackets).

Key inputs: `[user]` OR `[group]`, `[onVoiceCallClick]` (Input callback), `[onVideoCallClick]` (Input callback), `[onError]` (Input callback), `[callButtonsStyle]`.

### CometChatIncomingCall

Incoming call notification. Render at the app root so it's visible on any route.

```html
<cometchat-incoming-call
  [call]="incomingCall"
  [onAccept]="handleAccept"
  [onDecline]="handleDecline"
></cometchat-incoming-call>
```

> **All `on*` props are `@Input()` callbacks.** Use `[onAccept]="myFn"` (square brackets), never `(onAccept)="myFn($event)"` (round brackets).

Key inputs: `[call]`, `[onAccept]` (Input callback), `[onDecline]` (Input callback), `[onError]` (Input callback), `[incomingCallStyle]`, `[avatarStyle]`.

### CometChatOutgoingCall

Ringing screen after initiating a call.

```html
<cometchat-outgoing-call
  [call]="outgoingCall"
  [onCloseClicked]="handleClose"
></cometchat-outgoing-call>
```

> Input name is `[onCloseClicked]` (with `d` at the end), not `onCloseClick`. It is an `@Input()` callback — use square brackets.

Key inputs: `[call]`, `[onCloseClicked]` (Input callback), `[onError]` (Input callback), `[outgoingCallStyle]`, `[avatarStyle]`.

### CometChatOngoingCall

In-call UI — tiles, controls, mute, end-call.

```html
<cometchat-ongoing-call
  [sessionID]="session.sessionId"
  [onError]="handleError"
></cometchat-ongoing-call>
```

Key inputs: `[sessionID]`, `[onError]` (Input callback), `[ongoingCallStyle]`, `[callSettingsBuilder]`.

> **`(onCallEnded)` does not exist** on this component — there is no `@Output()` for call end. To detect when a call ends, subscribe to `CometChatCallEvents.ccCallEnded` from the event bus instead:
> ```typescript
> import { CometChatCallEvents } from "@cometchat/chat-uikit-angular";
> CometChatCallEvents.ccCallEnded.subscribe(() => {
>   // call ended — navigate away or update state
> });
> ```

### CometChatCallLogs

Scrollable call history.

```html
<cometchat-call-logs
  [onItemClick]="openCallDetails"
></cometchat-call-logs>
```

> **`[onItemClick]` is an `@Input()` callback** — use square brackets, not round brackets.

---

## 5. Search

The Angular v4 UIKit does **not** export a standalone `<cometchat-search>` Angular module. Search is built into the list components via the `[hideSearch]` input:

```html
<!-- Built-in search bar on conversations list -->
<cometchat-conversations [hideSearch]="false"></cometchat-conversations>

<!-- Built-in search bar on users list -->
<cometchat-users [hideSearch]="false"></cometchat-users>

<!-- Built-in search bar on groups list -->
<cometchat-groups [hideSearch]="false"></cometchat-groups>
```

> **Hard rule — never roll your own search.** Use `[hideSearch]="false"` on the list components. Do NOT build custom `<input>` search bars — they bypass the SDK's pagination and highlighting.

---

## 5b. Details, contacts, and group management

### CometChatDetails

Unified details panel — handles both users and groups automatically. Shows profile, status, block/unblock, group members, leave group, and more in one component. **Prefer this over building custom detail panels.**

```html
<cometchat-details
  [user]="selectedUser"
  [group]="selectedGroup"
  style="height:100%;display:block;"
></cometchat-details>
```

Key inputs: `[user]` OR `[group]`, `[onClose]`.

### CometChatContacts

User + group picker for starting new conversations. Renders a searchable list of users and groups. Use as a "New Chat" overlay.

```html
<cometchat-contacts
  [onItemClick]="handleContactClick"
  [onClose]="closeContacts"
  style="height:100%;display:block;"
></cometchat-contacts>
```

Key inputs: `[onItemClick]`, `[onClose]`.

### CometChatAddMembers

Add members to an existing group.

```html
<cometchat-add-members [group]="selectedGroup"></cometchat-add-members>
```

### CometChatBannedMembers

List and unban banned members of a group.

```html
<cometchat-banned-members [group]="selectedGroup"></cometchat-banned-members>
```

### CometChatTransferOwnership

Transfer group ownership to another member.

```html
<cometchat-transfer-ownership [group]="selectedGroup"></cometchat-transfer-ownership>
```

### CometChatCreateGroup

Dialog for creating a new group.

```html
<cometchat-create-group></cometchat-create-group>
```

> **Not in Angular v4:** `CometChatNewChat`, `CometChatBlockedUsers`, `CometChatSearchBar`, `CometChatThreadHeader` (standalone), `CometChatCompactMessageComposer` — these are React v6 UIKit only. Use `<cometchat-contacts>` for new chat, `<cometchat-details>` for block/unblock, and `<cometchat-threaded-messages>` for threads.

---

## 5c. Thread header

### CometChatThreadHeader (via `<cometchat-threaded-messages>`)

The Angular UI Kit exposes threaded messages via the `<cometchat-threaded-messages>` composite component, which includes the thread header, scoped message list, and scoped composer in one tag.

```html
<cometchat-threaded-messages
  [parentMessage]="threadParentMessage"
  [user]="selectedUser"
  [group]="selectedGroup"
  [onClose]="closeThread"
></cometchat-threaded-messages>
```

> **`[onClose]` is an `@Input()` callback** — use square brackets, not round brackets.

For fully manual stitching (separate list + composer with `[parentMessageId]`), see `cometchat-angular-placement` § threading pattern.

---

## 6. Atoms (primitives for custom composition)

Building blocks used inside `ng-template` slot overrides or custom components.

| Selector | Purpose |
|---|---|
| `<cometchat-avatar>` | Circular avatar. `[image]`, `[name]` (initials fallback), `[avatarStyle]` |
| `<cometchat-badge>` | Unread count badge. `[count]`, `[badgeStyle]` |
| `<cometchat-status-indicator>` | Online/offline dot. `[status]`, `[statusIndicatorStyle]` |
| `<cometchat-list-item>` | Standard row — leading + title/subtitle + trailing. `[listItemStyle]` |
| `<cometchat-date>` | Relative-time date pill. `[timestamp]`, `[pattern]`, `[dateStyle]` |
| `<cometchat-button>` | Icon button. `[iconURL]`, `[buttonStyle]`, `(click)` |
| `<cometchat-loader>` | Loading spinner. `[iconURL]`, `[loaderStyle]` |
| `<cometchat-confirm-dialog>` | Confirm/cancel dialog. `[title]`, `[messageText]`, `[onConfirm]`, `[onCancel]` |
| `<cometchat-emoji-keyboard>` | Full emoji picker. `[onEmojiClick]` |

> **Note:** Atom components (`cometchat-avatar`, `cometchat-status-indicator`, `cometchat-badge`) are LitElement web components — they are NOT Angular standalone modules. Do NOT import them in `@NgModule` imports. They are registered automatically via `CUSTOM_ELEMENTS_SCHEMA` and used directly in templates.

> **Not in public exports:** `<cometchat-reactions>` and `<cometchat-reaction-list>` are used internally by the message list. Do not instantiate them directly.

---

## 6b. Text formatters

These are not components — they are formatter classes that customize how text renders in message bubbles. Import from `@cometchat/uikit-shared` and pass via `[textFormatters]` on both `<cometchat-message-list>` and `<cometchat-message-composer>`.

| Class | Purpose |
|---|---|
| `CometChatTextFormatter` | Abstract base class — extend to build custom formatters |
| `CometChatMentionsFormatter` | Renders @mentions with styling + suggestion popover |
| `CometChatUrlsFormatter` | Auto-links URLs. Requires regex patterns in constructor |

```typescript
import {
  CometChatMentionsFormatter,
  CometChatUrlsFormatter,
} from "@cometchat/uikit-shared";

textFormatters = [
  new CometChatMentionsFormatter(),
  new CometChatUrlsFormatter([
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi,
  ]),
];
```

**Always pass the same array to both list and composer** — if they differ, sent and received messages render differently.

> **Note:** `CometChatMarkdownFormatter`, `CometChatRichTextFormatter`, and `CometChatTextHighlightFormatter` are React v6 UIKit only — they do not exist in the Angular v4 UIKit. To add custom text rendering patterns in Angular, extend `CometChatTextFormatter` directly (see `cometchat-angular-customization` § Tier 3a).

---

## 7. Infrastructure (static classes + event bus)

### CometChatUIKit

Static class — init + login + logout.

| Method | Purpose |
|---|---|
| `CometChatUIKit.init(settings)` | Initialize. Must resolve before any component renders. |
| `CometChatUIKit.login({ uid })` | Log in (dev mode). Takes an object. |
| `CometChatUIKit.login({ authToken })` | Log in with a server-minted token (production). |
| `CometChatUIKit.getLoggedinUser()` | Returns current `CometChat.User` or `null` (Promise). |
| `CometChatUIKit.logout()` | Log out + clear session. |

### CometChatConversationEvents / CometChatMessageEvents / CometChatGroupEvents / CometChatUserEvents

Angular event bus — RxJS `Subject`-based. Subscribe in `ngOnInit`, unsubscribe in `ngOnDestroy`.

```typescript
import { Subscription } from "rxjs";
import { CometChatConversationEvents } from "@cometchat/chat-uikit-angular";

export class MyComponent implements OnInit, OnDestroy {
  private ccConversationDeleted!: Subscription;

  ngOnInit(): void {
    this.ccConversationDeleted =
      CometChatConversationEvents.ccConversationDeleted.subscribe(
        (conversation: CometChat.Conversation) => {
          // handle deletion
        }
      );
  }

  ngOnDestroy(): void {
    this.ccConversationDeleted?.unsubscribe();
  }
}
```

Available event streams:
- `CometChatConversationEvents`: `ccConversationDeleted`, `ccUpdateConversation`
- `CometChatMessageEvents`: `ccMessageSent`, `ccMessageEdited`, `ccMessageDeleted`, `ccMessageRead`, `ccLiveReaction`
- `CometChatGroupEvents`: `ccGroupCreated`, `ccGroupDeleted`, `ccGroupLeft`, `ccGroupMemberScopeChanged`, `ccGroupMemberKicked`, `ccGroupMemberBanned`, `ccGroupMemberJoined`, `ccGroupMemberAdded`, `ccOwnershipChanged`
- `CometChatUserEvents`: `ccUserBlocked`, `ccUserUnblocked`

**Always unsubscribe in `ngOnDestroy`.** Angular components can be destroyed and re-created on navigation; leaked subscriptions cause duplicate event handling.

### CometChatThemeService

Injected service for palette control. See `cometchat-angular-core` § 6 and `cometchat-angular-theming`.

---

## 8. Style objects

Each component accepts a typed style object. Import from `@cometchat/uikit-shared` or `@cometchat/chat-uikit-angular`.

```typescript
import {
  ConversationsStyle,
  MessagesStyle,
  MessageListStyle,
  MessageComposerStyle,
  MessageHeaderStyle,
  UsersStyle,
  GroupsStyle,
  GroupMembersStyle,
  AvatarStyle,
  BadgeStyle,
  StatusIndicatorStyle,
  ListItemStyle,
  DateStyle,
  BackdropStyle,
  ConfirmDialogStyle,
  LoaderStyle,
  CallLogsStyle,
} from "@cometchat/uikit-shared";
// or from "@cometchat/chat-uikit-angular" — both re-export the same types
```

Common style properties (all optional):

```typescript
const conversationsStyle = new ConversationsStyle({
  width: "100%",
  height: "100%",
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  background: "#ffffff",
  titleTextFont: "600 18px Inter",
  titleTextColor: "#141414",
  lastMessageTextColor: "#727272",
  onlineStatusColor: "#09C26F",
});
```

---

## 9. ng-template slot views

Custom views are passed as Angular `TemplateRef` via `ng-template`. The template receives the entity as an implicit context variable.

```html
<!-- In the component template -->
<cometchat-conversations
  [listItemView]="customListItem"
></cometchat-conversations>

<ng-template #customListItem let-conversation>
  <div class="custom-item">
    <span>{{ conversation.getConversationWith().getName() }}</span>
  </div>
</ng-template>
```

```typescript
// In the component class
import { ViewChild, TemplateRef } from "@angular/core";

@Component({ /* ... */ })
export class AppComponent {
  @ViewChild("customListItem") customListItem!: TemplateRef<any>;
}
```

Common slot inputs per component:

| Component | Slot inputs |
|---|---|
| `<cometchat-conversations>` | `[listItemView]`, `[menu]`, `[loadingStateView]`, `[errorStateView]`, `[emptyStateView]` |
| `<cometchat-message-header>` | `[menu]`, `[subtitleView]` |
| `<cometchat-message-list>` | `[emptyStateView]`, `[errorStateView]`, `[loadingStateView]` |
| `<cometchat-message-composer>` | `[auxilaryButtonView]`, `[headerView]`, `[sendButtonView]` |
| `<cometchat-users>` | `[listItemView]`, `[menu]`, `[loadingStateView]`, `[errorStateView]`, `[emptyStateView]` |
| `<cometchat-groups>` | `[listItemView]`, `[menu]`, `[loadingStateView]`, `[errorStateView]`, `[emptyStateView]` |

---

## 10. Request builders

Pass request builders to filter what data loads. Import builder classes from `@cometchat/chat-sdk-javascript`.

```typescript
import { CometChat } from "@cometchat/chat-sdk-javascript";

// Filter conversations
conversationsRequestBuilder = new CometChat.ConversationsRequestBuilder()
  .setLimit(20)
  .setConversationType(CometChat.RECEIVER_TYPE.USER);

// Filter users
usersRequestBuilder = new CometChat.UsersRequestBuilder()
  .setLimit(30)
  .setStatus("online");

// Filter messages
messagesRequestBuilder = new CometChat.MessagesRequestBuilder()
  .setUID(this.selectedUser.getUid())
  .setLimit(30)
  .setCategories(["message"]);
```

---

## 11. Threading — wiring `[onThreadRepliesClick]`

The Angular v4 UIKit does **not** have a `[hideReplyInThreadOption]` input. The "Reply in Thread" option in the message action menu is always present when threads are supported by the kit.

To wire a thread panel, pass `[onThreadRepliesClick]` as an **Input callback** (square brackets) on `<cometchat-message-list>`:

```html
<cometchat-message-list
  [user]="selectedUser"
  [onThreadRepliesClick]="openThread"
></cometchat-message-list>
```

```typescript
// The callback receives { message, view } — extract the message:
openThread = (payload: any): void => {
  const msg = payload?.message ?? payload;
  this.threadMessage = msg;
  this.showThreadPanel = true;
};
```

Then render the thread panel using `<cometchat-threaded-messages>` or a manual scoped list + composer with `[parentMessageId]`.

---

## 12. Common prop-finding recipe

When a user's request isn't obviously covered, check in this order:

1. **Named component in this catalog fits?** ("show call history" → `<cometchat-call-logs>`)
2. **A `[hide*]` / visibility input?** ("disable reactions" → `[disableReactions]="true"`, "hide receipt" → `[hideReceipt]="true"`)
3. **A `[*View]` / `[*Template]` slot?** ("customize the header title" → `[subtitleView]="myTemplate"`)
4. **A `[*RequestBuilder]`?** ("filter conversations" → `[conversationsRequestBuilder]`)
5. **`[textFormatters]` + `[templates]`** for message-rendering customization
6. **`CometChatConversationEvents` / `CometChatMessageEvents`** for cross-component communication
7. **Only then** escalate to `cometchat-angular-customization` § Tier 4 (DataSource decorators)

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Always read first — init, login, module setup |
| `cometchat-angular-components` | This skill — any time you write `<cometchat-*>` HTML |
| `cometchat-angular-placement` | Deciding WHERE components go (route / sidebar / modal / tab) |
| `cometchat-angular-customization` | `[textFormatters]`, `[templates]`, custom slot views, event bus |
| `cometchat-angular-features` | Adding calls, extensions, AI |
| `cometchat-angular-theming` | `[*Style]` not enough — need app-wide color / typography changes |
| `cometchat-angular-production` | `login({ authToken })` setup |
| `cometchat-angular-troubleshooting` | `<cometchat-*>` renders nothing or throws at runtime |
