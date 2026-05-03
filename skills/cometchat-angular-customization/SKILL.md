---
name: cometchat-angular-customization
description: "Customize the CometChat Angular UI Kit without forking — four-tier model: Angular inputs → request builders → text formatters + message templates → DataSource decorators + event bus."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular customization formatters events datasource templates ng-template"
---

## Purpose

Teaches Claude how to change the behavior or appearance of the Angular UI Kit **without modifying the kit itself**. Four tiers, from cheapest to deepest:

```
Tier 1 — Angular inputs     (95% of asks solved here)
Tier 2 — RequestBuilder     (filter what data loads)
Tier 3 — Formatters + Templates   (change how text / messages render)
Tier 4 — DataSource decorators + Events  (last resort, powerful)
```

**Always try Tier 1 first.** Escalate only when the tier can't do what the user wants.

**Read `cometchat-angular-components` first** — the catalog is the source of truth for input names, slot templates, and event names that this skill builds on.

Ground truth: `docs/ui-kit/angular/custom-text-formatter-guide`, `docs/ui-kit/angular/events`, `docs/ui-kit/angular/methods`, and the kit's source.

---

## Four-tier triage — pick the right tier before writing any code

**Start with Tier 1 every time.** The Angular UI Kit follows a "inputs over components" philosophy — most additions are inputs on already-mounted components, not new components or custom code.

### Quick task → input lookup

Before escalating to any tier, check if an existing component input already does what you need:

| User asks for | Likely input on which component |
|---|---|
| Search bar | `[hideSearch]="false"` on `<cometchat-conversations>`, `<cometchat-users>`, `<cometchat-groups>` |
| Filter conversations | `[conversationsRequestBuilder]` on `<cometchat-conversations>` |
| Filter messages | `[messagesRequestBuilder]` on `<cometchat-message-list>` |
| Filter users / groups | `[usersRequestBuilder]` / `[groupsRequestBuilder]` |
| Custom empty state | `[emptyStateView]` on list components |
| Custom error UI | `[errorStateView]` |
| Custom loading UI | `[loadingStateView]` |
| Custom list item | `[listItemView]` on `<cometchat-conversations>`, `<cometchat-users>`, `<cometchat-groups>` |
| Custom header subtitle | `[subtitleView]` on `<cometchat-message-header>` |
| Custom header menu | `[menu]` on `<cometchat-message-header>` |
| Hide receipts | `[hideReceipt]="true"` on `<cometchat-message-list>` |
| Disable reactions | `[disableReactions]="true"` on `<cometchat-message-list>` |
| Disable mentions | `[disableMentions]="true"` on `<cometchat-message-composer>` |
| Custom send button | `[sendButtonView]` on `<cometchat-message-composer>` |
| Custom attachment options | `[attachmentOptions]` on `<cometchat-message-composer>` |
| Click handler on conversation | `[onItemClick]` on `<cometchat-conversations>` |
| Active conversation highlight | `[activeConversation]` on `<cometchat-conversations>` |

> **Note:** `[hideReactions]`, `[hideReplyInThreadOption]`, `[hideEditMessageOption]`, `[hideDeleteMessageOption]`, `[hideTranslateMessageOption]` do **not** exist in the Angular v4 UIKit. Use `[disableReactions]` for reactions. Message action options are controlled via the `[options]` callback or `[templates]` prop.

If a matching input exists, **add the input and stop**. No new components, no custom CSS, no new files.

| If they want to... | Use Tier | Cost |
|---|---|---|
| Hide a feature (thread option, receipts, edit, etc.) | Tier 1 — `[hide*]` inputs | 1 line of HTML |
| Customize a subsection (header subtitle, list item, empty state) | Tier 1 — `[*View]` / `[*Template]` slot | 1 `ng-template` |
| Filter what loads (only show online users, exclude blocked, include tags) | Tier 2 — `[*RequestBuilder]` | 1 builder |
| Change how URLs / mentions / hashtags / emojis render inline | Tier 3 — `[textFormatters]` | Subclass of `CometChatTextFormatter` |
| Render a custom message type (custom bubble, custom interactive msg) | Tier 3 — `[templates]` + `CometChatMessageTemplate` | 1 template + 1 component |
| React to events from another component | Tier 4 — `CometChatConversationEvents` / `CometChatMessageEvents` | RxJS subscription |
| Rewrite how data flows through the kit | Tier 4 — `DataSourceDecorator` | Class extension |

If a user's ask fits Tier 1 but you jumped to Tier 3, you've written 50 lines that a 1-line input could have replaced. Start low.

---

## Tier 1 — Angular inputs (hide / slot views / styles)

### 1a. `[hide*]` inputs

Turn features off with a single input binding:

```html
<cometchat-message-list
  [user]="selectedUser"
  [hideReceipt]="true"
  [disableReactions]="false"
  [disableSoundForMessages]="false"
></cometchat-message-list>
```

Real hide/disable inputs on `<cometchat-message-list>`: `[hideReceipt]`, `[hideError]`, `[hideDateSeparator]`, `[disableReactions]`, `[disableSoundForMessages]`, `[disableMentions]`.

Full list of inputs per component: `cometchat-angular-components`. Check there before writing custom code.

### 1b. `ng-template` slot views — replace a section

Every component has slot inputs for replacing named sections of its default UI. Pass an `ng-template` reference:

```html
<cometchat-conversations
  [listItemView]="customListItem"
></cometchat-conversations>

<ng-template #customListItem let-conversation>
  <div class="custom-item">
    <span class="name">{{ conversation.getConversationWith().getName() }}</span>
    <span class="time">{{ conversation.getLastMessage()?.getSentAt() | date:'shortTime' }}</span>
  </div>
</ng-template>
```

```typescript
import { ViewChild, TemplateRef } from "@angular/core";

@Component({ /* ... */ })
export class AppComponent {
  @ViewChild("customListItem") customListItem!: TemplateRef<any>;
}
```

For the message header's subtitle:

```html
<cometchat-message-header
  [user]="selectedUser"
  [subtitleView]="customSubtitle"
></cometchat-message-header>

<ng-template #customSubtitle let-user>
  <span style="color: #09C26F; font-size: 12px;">
    {{ user?.getStatus() === 'online' ? 'Online' : 'Offline' }}
  </span>
</ng-template>
```

### 1c. `[*Style]` inputs — per-component styling

See `cometchat-angular-theming` § 4 for the full style object reference. Use `[*Style]` for one-off overrides on a single component instance.

---

## Tier 2 — RequestBuilder filtering

For "I want to show a subset of X", use the matching `[*RequestBuilder]`. Never post-filter in-render.

```typescript
import { CometChat } from "@cometchat/chat-sdk-javascript";

// Only conversations in a specific tag group
conversationsRequestBuilder = new CometChat.ConversationsRequestBuilder()
  .setLimit(20)
  .setUserTags(["premium"])
  .setConversationType(CometChat.RECEIVER_TYPE.USER);

// Only online users, exclude blocked
usersRequestBuilder = new CometChat.UsersRequestBuilder()
  .setLimit(30)
  .setStatus("online")
  .hideBlockedUsers(true);

// Only groups you've joined
groupsRequestBuilder = new CometChat.GroupsRequestBuilder()
  .setLimit(30)
  .joinedOnly(true);

// Message list — exclude system messages
messagesRequestBuilder = new CometChat.MessagesRequestBuilder()
  .setUID(this.selectedUser.getUid())
  .setLimit(30)
  .setCategories(["message"]);
```

---

## Tier 3 — Text formatters + message templates

### 3a. Custom text formatter — inline text patterns

`CometChatTextFormatter` is an abstract base class for matching inline text patterns and replacing them with custom HTML.

```typescript
// hashtag-formatter.ts
import { CometChatTextFormatter } from "@cometchat/uikit-shared";

export class HashtagFormatter extends CometChatTextFormatter {
  constructor() {
    super();
    this.setTrackingCharacter("#");
    this.setRegexPatterns([/\B#(\w+)\b/g]);
    this.setRegexToReplaceFormatting([/#(\w+)/g]);
  }

  override getFormattedText(inputText: string): string {
    if (!inputText) return "";
    return inputText.replace(
      /\B#(\w+)\b/g,
      '<span style="color: #6851D6; font-weight: 600;">#$1</span>'
    );
  }

  override getOriginalText(inputText: string): string {
    if (!inputText) return "";
    return inputText.replace(/<span[^>]*>(#\w+)<\/span>/g, "$1");
  }
}
```

Register by passing to both `<cometchat-message-list>` and `<cometchat-message-composer>`:

```typescript
// In your component:
import { HashtagFormatter } from "./hashtag-formatter";
import { CometChatMentionsFormatter, CometChatUrlsFormatter } from "@cometchat/uikit-shared";

textFormatters = [
  new CometChatMentionsFormatter(),
  new CometChatUrlsFormatter([
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi,
  ]),
  new HashtagFormatter(),
];
```

```html
<cometchat-message-list
  [user]="selectedUser"
  [textFormatters]="textFormatters"
></cometchat-message-list>
<cometchat-message-composer
  [user]="selectedUser"
  [textFormatters]="textFormatters"
></cometchat-message-composer>
```

**⚠️ Pass the same `textFormatters` array to both list and composer.** If they differ, messages look different when sent vs. received.

### 3b. Custom message template — entire custom bubble

For rendering a totally custom message type, use `CometChatMessageTemplate`.

```typescript
// In your component:
import { CometChatMessageTemplate } from "@cometchat/uikit-shared";
import { ChatConfigurator } from "@cometchat/chat-uikit-angular";

// Get default templates to merge with
const defaultTemplates = ChatConfigurator.getDataSource().getAllMessageTemplates();

// Create a custom template for a "poll" message type
const pollTemplate = new CometChatMessageTemplate({
  type: "poll",
  category: "custom",
  ContentView: (message: CometChat.BaseMessage, alignment: string) => {
    // Return an Angular component reference or HTML string
    // For Angular, use a ViewContainerRef approach or pass a component factory
    return null; // implement with your Angular component
  },
});

messageTemplates = [pollTemplate, ...defaultTemplates];
```

```html
<cometchat-message-list
  [user]="selectedUser"
  [templates]="messageTemplates"
></cometchat-message-list>
```

---

## Tier 4 — Event bus + DataSource decorators

### 4a. Event bus — RxJS subscriptions

Subscribe to events that UI Kit components emit so your own code can react.

```typescript
import { Component, OnInit, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import {
  CometChatMessageEvents,
  CometChatConversationEvents,
  CometChatGroupEvents,
} from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({ /* ... */ })
export class AppComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(
      CometChatMessageEvents.ccMessageSent.subscribe(
        ({ message, status }: { message: CometChat.BaseMessage; status: string }) => {
          if (status === "sent") {
            // analytics.track("message_sent", { id: message.getId() });
          }
        }
      ),
      CometChatConversationEvents.ccConversationDeleted.subscribe(
        (conversation: CometChat.Conversation) => {
          // Remove from local cache
        }
      ),
      CometChatGroupEvents.ccGroupLeft.subscribe(
        ({ userLeft, leftGroup }: any) => {
          // Handle group leave
        }
      )
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
```

**Always unsubscribe in `ngOnDestroy`.** Angular components are destroyed on navigation — leaked subscriptions cause duplicate event handling.

### Available event streams

| Event class | Key events |
|---|---|
| `CometChatMessageEvents` | `ccMessageSent`, `ccMessageEdited`, `ccMessageDeleted`, `ccMessageRead`, `ccLiveReaction` |
| `CometChatConversationEvents` | `ccConversationDeleted`, `ccUpdateConversation` |
| `CometChatGroupEvents` | `ccGroupCreated`, `ccGroupDeleted`, `ccGroupLeft`, `ccGroupMemberScopeChanged`, `ccGroupMemberKicked`, `ccGroupMemberBanned`, `ccGroupMemberJoined`, `ccGroupMemberAdded`, `ccOwnershipChanged` |
| `CometChatUserEvents` | `ccUserBlocked`, `ccUserUnblocked` |

### 4b. DataSource decorators

`DataSourceDecorator` wraps the kit's internal data source to override specific methods without forking the whole kit.

```typescript
import {
  DataSource,
  DataSourceDecorator,
  ChatConfigurator,
} from "@cometchat/chat-uikit-angular";

class MyDataSource extends DataSourceDecorator {
  constructor(source: DataSource) {
    super(source);
  }

  // Override only the method you want to change
  override getConversationsRequestBuilder() {
    const builder = super.getConversationsRequestBuilder();
    builder.setUserAndGroupTags(true);
    return builder;
  }
}

// Register before init — wraps the default data source
ChatConfigurator.dataSource = new MyDataSource(ChatConfigurator.getDataSource());
// Then call CometChatUIKit.init(settings)
```

**This is an escape hatch, not a first tool.** Re-check whether Tier 1 (inputs) or Tier 3 (templates) could have solved it before reaching for Tier 4.

---

## 5. Recipes (common customization asks → right tier)

### "Filter the conversation list to just premium users"
**Tier 2** — `[conversationsRequestBuilder]` with `.setUserTags(["premium"])`.

### "Custom empty state for the users list"
**Tier 1** — `[emptyStateView]` slot input on `<cometchat-users>`.

### "Custom list item for conversations"
**Tier 1** — `[listItemView]` slot input on `<cometchat-conversations>`.

### "Show a custom view when the user types @"
**Tier 3a** — subclass `CometChatMentionsFormatter`, implement `search(key)` with your own suggestion source.

### "When a message is sent, log it to our analytics"
**Tier 4a** — `CometChatMessageEvents.ccMessageSent.subscribe(...)`.

### "When a group is deleted, navigate away"
**Tier 4a** — `CometChatGroupEvents.ccGroupDeleted.subscribe(...)`.

### "Render custom avatars for all users based on their department"
**Tier 1** — `[listItemView]` slot on `<cometchat-conversations>` + `<cometchat-users>`.

### "Disable the file attachment option"
**Tier 1** — filter the `[attachmentOptions]` input on `<cometchat-message-composer>`.

### "Custom message type: a 'ping' message"
**Tier 3b** — create a `CometChatMessageTemplate` with `category: "custom"` + `type: "ping"`, render a custom Angular component, send via `CometChat.sendCustomMessage`.

---

## 6. Anti-patterns

1. **Don't hand-roll a bubble when a template will do.** `CometChatMessageTemplate` (Tier 3b) gives you full control over rendering + options without losing theming, reactions, typing, receipts.

2. **Don't post-filter a list's data after render.** If you want "only online users," use Tier 2 `usersRequestBuilder.setStatus("online")` — don't fetch everyone then hide rows with `*ngIf`.

3. **Don't forget to unsubscribe in `ngOnDestroy`.** Angular components are destroyed on navigation; leaked subscriptions cause duplicate event handling.

4. **Don't put `CometChatTextFormatter` instances in component state that gets recreated.** Construct them once at class level (as a property, not in `ngOnInit`); re-creating them on every change detection cycle loses the internal suggestion state.

5. **Don't fork or patch `@cometchat/chat-uikit-angular` directly.** Every customization should be possible via Tiers 1-4. Forking breaks on kit upgrades.

6. **Don't reach for Tier 4 before trying 1-3.** DataSource decorators are powerful but fragile to kit internal changes. Inputs, request builders, and templates are stable surface area.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Init / login / module setup |
| `cometchat-angular-components` | Input reference — which `[hide*]`, `[*View]`, `[*RequestBuilder]` is available |
| `cometchat-angular-placement` | Where to put the customized components |
| `cometchat-angular-theming` | App-wide color / typography — Tier 1 alternative to `[*Style]` |
| `cometchat-angular-features` | Which out-of-the-box features exist |
| `cometchat-angular-customization` | This skill — four-tier triage + custom formatters / templates / DataSource / events |
| `cometchat-angular-production` | When customization depends on production auth |
| `cometchat-angular-troubleshooting` | Formatter doesn't apply, listener fires twice, slot view renders nothing |
