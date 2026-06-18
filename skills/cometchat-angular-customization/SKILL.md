---
name: cometchat-angular-customization
description: "Customize the CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) without forking — four-tier model: Angular @Input slot views → request builders → text formatters + message-action options + per-type bubble views → event bus. Standalone components, ng-template slots, no NgModule, no DataSource."
license: "MIT"
compatibility: "Angular >=17 <22; @cometchat/chat-uikit-angular ^5.0"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular customization v5 formatters events templates ng-template slot-views options standalone"
---

## Purpose

Teaches Claude how to change the behaviour or appearance of the CometChat **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`) **without modifying the kit itself**. Four tiers, from cheapest to deepest:

```
Tier 1 — Slot views (@Input ng-template)   (95% of asks solved here)
Tier 2 — RequestBuilder                     (filter what data loads)
Tier 3 — Formatters + message-action options + per-type bubble views
Tier 4 — Event bus                          (react to kit activity)
```

**Always try Tier 1 first.** Escalate only when the tier can't do what the user wants.

**Read `cometchat-angular-core` first, then `cometchat-angular-components`.** The component catalog is the source of truth for the exact `@Input` slot-view names, `@Output` events, and request-builder inputs that this skill builds on. Never invent a binding — if it isn't in the catalog or the bundled `.d.ts`, it doesn't exist.

Ground truth: `@cometchat/chat-uikit-angular@5.0.2` bundled types (`node_modules/@cometchat/chat-uikit-angular/types/cometchat-chat-uikit-angular.d.ts`) + `docs/ui-kit/angular`. Verify any non-obvious symbol against the installed `.d.ts` before relying on it. **Official docs:** https://www.cometchat.com/docs/ui-kit/angular/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).

---

## v5 reset — what is NOT here (if you've seen the v4 Angular kit)

v5 is a clean break from the v4 (NgModule, Angular 12–15) customization model. These v4 symbols are **gone** — do not import or reference them:

| v4 symbol (phantom in v5) | v5 replacement |
|---|---|
| `CometChatMessageTemplate` | per-type bubble views via `MessageBubbleConfigService.setBubbleView(type, partMap)`, **or** the `bubbleFooterView` / `appendView` slot inputs (Tier 3c) |
| `DataSource` / `DataSourceDecorator` / `ChatConfigurator` | request builders (Tier 2) + the `MessageBubbleConfigService` / `CometChatTemplatesService` injected services |
| `templates` @Input on `<cometchat-message-list>` | **does not exist** — use `optionsOverride` / `additionalOptions` for actions and `MessageBubbleConfigService` for bubbles |
| `CometChatTextFormatter` v4 API (`setRegexPatterns`, `getFormattedText(input)`, `getOriginalText(input)`) | v5 API: abstract `id`, `getRegex()`, `format(text)`, optional `shouldFormat(text, msg)`, `priority` |
| `CometChatUrlsFormatter` (plural) | `CometChatUrlFormatter` (singular) |
| `@cometchat/uikit-shared` imports | everything imports from `@cometchat/chat-uikit-angular` |

Everything in this skill imports from **`@cometchat/chat-uikit-angular`** (formatters, event classes, services) or **`@cometchat/chat-sdk-javascript`** (the `CometChat` namespace + request builders). There is no `uikit-shared` in v5.

> **Verified absent in the Angular kit (v5.0.2 source):** `CometChatMessageTemplate`, `getDataSource`, `ChatConfigurator`, `DataSourceDecorator`, and `getAllMessageTemplates` do **not** exist anywhere in `projects/cometchat-uikit/src/lib` (grep over the entire library returns no matches outside specs). The web/React kit's `new CometChat.MessageTemplate(...)` / `getDataSource().getAllMessageTemplates()` pattern has **no Angular equivalent** — custom bubbles go exclusively through `MessageBubbleConfigService.setBubbleView` (Tier 3c) and message-action overrides through the `additionalOptions` / `optionsOverride` `@Input`s (Tier 3b). Do not port the React DataSource recipe here.

---

## Four-tier triage — pick the right tier before writing any code

**Start with Tier 1 every time.** The Angular UI Kit follows an "inputs over components" philosophy — most additions are `@Input` bindings on already-mounted standalone components, not new components or custom code.

### Quick task → input lookup

Before escalating, check whether an existing component `@Input` already does what you need (all verified in `cometchat-angular-components`):

| User asks for | Likely `@Input` on which component |
|---|---|
| Search bar on the conversation list | `[showSearchBar]="true"` on `<cometchat-conversations>` |
| Filter conversations | `[conversationsRequestBuilder]` on `<cometchat-conversations>` |
| Filter messages | `[messagesRequestBuilder]` on `<cometchat-message-list>` |
| Filter users / groups | `[usersRequestBuilder]` / `[groupsRequestBuilder]` |
| Custom empty state | `[emptyView]` on list / message components |
| Custom error UI | `[errorView]` |
| Custom loading UI | `[loadingView]` |
| Custom list row | `[itemView]` (or `[leadingView]`/`[titleView]`/`[subtitleView]`/`[trailingView]`) on list components |
| Custom header subtitle | `[subtitleView]` on `<cometchat-message-header>` |
| Hide receipts | `[hideReceipts]="true"` on `<cometchat-message-list>` |
| Disable a message action | the matching `[hide*Option]` flag (e.g. `[hideEditMessageOption]`) on `<cometchat-message-list>` |
| Disable mentions | `[disableMentions]="true"` on `<cometchat-message-composer>` |
| Custom send button | `[sendButtonView]` on `<cometchat-message-composer>` |
| Click handler on conversation | `(itemClick)` `@Output` on `<cometchat-conversations>` |
| Active conversation highlight | `[activeConversation]` on `<cometchat-conversations>` |

> **v5 hide flags ARE real on the message list** (unlike the old v4 kit, where most didn't exist). `<cometchat-message-list>` exposes `hideReplyInThreadOption`, `hideTranslateMessageOption`, `hideEditMessageOption`, `hideDeleteMessageOption`, `hideReactionOption`, `hideCopyMessageOption`, `hideMessageInfoOption`, `hideReplyOption`, `hideMessagePrivatelyOption`, `hideFlagMessageOption`, `hideReceipts`, `hideDateSeparator`, `hideAvatar`, and more. Prefer a `[hide*]` flag over `optionsOverride` when you just want to remove a built-in action. Confirm the exact flag in `cometchat-angular-components`.

If a matching input exists, **add the binding and stop**. No new components, no custom CSS, no new files.

| If they want to... | Use Tier | Cost |
|---|---|---|
| Hide a feature / built-in action | Tier 1 — `[hide*]` / `[hide*Option]` input | 1 line of HTML |
| Replace a subsection (header, list row, empty/error/loading state, bubble footer) | Tier 1 — `[*View]` slot + `<ng-template>` | 1 template |
| Filter what loads (only online users, joined groups, tagged conversations) | Tier 2 — `[*RequestBuilder]` | 1 builder |
| Change how URLs / mentions / hashtags render inline | Tier 3a — `[textFormatters]` | Subclass of `CometChatTextFormatter` |
| Add / remove / reorder message-action menu items | Tier 3b — `[additionalOptions]` / `[optionsOverride]` | `CometChatActionsIcon[]` |
| Render a custom view for a message type's bubble | Tier 3c — `MessageBubbleConfigService.setBubbleView` **or** `[bubbleFooterView]` / `[appendView]` | 1 template + 1 service call |
| React to kit activity (message sent, group left, conversation deleted) | Tier 4 — `CometChat*Events` | RxJS subscription |

Start low. If an ask fits Tier 1 but you jumped to Tier 3, you've written 50 lines that one `[*View]` binding could have replaced.

---

## Tier 1 — Slot views (`@Input` `ng-template`)

Every v5 list / message component exposes named slot-view `@Input`s that take a **`TemplateRef`**. In Angular you bind a `#ref` `<ng-template>` to the slot: `[itemView]="myTemplate"`. The kit passes the relevant item to the template via its `let-` context.

> **Get the slot names right.** They are component-specific. The list components (`<cometchat-conversations>`, `<cometchat-users>`, `<cometchat-groups>`, `<cometchat-group-members>`) expose: `headerView`, `menuView`, `loadingView`, `emptyView`, `errorView`, `itemView`, `leadingView`, `titleView`, `subtitleView`, `trailingView` (conversations also has `searchView`). The message list exposes a different set: `headerView`, `footerView`, `emptyView`, `errorView`, `loadingView`, `bubbleFooterView`, `appendView`. Always confirm per component in `cometchat-angular-components`.

### 1a. Replace a list row

```typescript
// app-conversations.component.ts
import { Component } from "@angular/core";
import { CometChatConversationsComponent } from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { DatePipe } from "@angular/common";

@Component({
  selector: "app-conversations",
  standalone: true,
  imports: [CometChatConversationsComponent, DatePipe],
  template: `
    <cometchat-conversations [itemView]="customItem">
    </cometchat-conversations>

    <ng-template #customItem let-conversation>
      <div class="custom-item">
        <span class="name">{{ conversation?.getConversationWith()?.getName() }}</span>
        <span class="time">{{ conversation?.getLastMessage()?.getSentAt() * 1000 | date: 'shortTime' }}</span>
      </div>
    </ng-template>`,
})
export class AppConversationsComponent {}
```

The `<ng-template>` lives **inside** the same component's template, right after the kit component — Angular resolves the `#customItem` reference and hands the `TemplateRef` to the `[itemView]` `@Input`. No `@ViewChild` is required when the template is declared inline like this.

### 1b. Replace the message-header subtitle

```html
<cometchat-message-header [user]="selectedUser" [subtitleView]="customSubtitle">
</cometchat-message-header>

<ng-template #customSubtitle let-user>
  <span style="color: var(--cometchat-success-color); font-size: 12px;">
    {{ user?.getStatus() === 'online' ? 'Online now' : 'Offline' }}
  </span>
</ng-template>
```

### 1c. Custom empty / error / loading state

```html
<cometchat-users [emptyView]="noUsers" [loadingView]="spinner">
</cometchat-users>

<ng-template #noUsers><div class="empty">No teammates yet.</div></ng-template>
<ng-template #spinner><div class="loading">Loading…</div></ng-template>
```

Keep any custom CSS to layout glue and consume `--cometchat-*` variables for colour / spacing / radius — see `cometchat-angular-theming`.

---

## Tier 2 — RequestBuilder filtering

For "show a subset of X", use the matching `[*RequestBuilder]` `@Input`. The builders live on the **chat SDK** `CometChat` namespace. Never post-filter in-render with `*ngIf`.

```typescript
import { CometChat } from "@cometchat/chat-sdk-javascript";

// Only conversations tagged "premium", users only
conversationsRequestBuilder = new CometChat.ConversationsRequestBuilder()
  .setLimit(20)
  .setTags(["premium"])
  .setConversationType("user");

// Only online users, exclude blocked
usersRequestBuilder = new CometChat.UsersRequestBuilder()
  .setLimit(30)
  .setStatus(CometChat.USER_STATUS.ONLINE)
  .hideBlockedUsers(true);

// Only groups you've joined
groupsRequestBuilder = new CometChat.GroupsRequestBuilder()
  .setLimit(30)
  .joinedOnly(true);

// Message list — exclude action/system messages
messagesRequestBuilder = new CometChat.MessagesRequestBuilder()
  .setLimit(30)
  .setCategories(["message"]);
```

```html
<cometchat-conversations [conversationsRequestBuilder]="conversationsRequestBuilder">
</cometchat-conversations>
```

> Construct request builders **once** (as class properties), not inside a getter or `ngOnInit` that re-runs — a new builder instance on every change-detection pass forces the list to refetch. Confirm exact builder method names against the chat SDK; they are SDK-side, not kit-side.

---

## Tier 3 — Formatters + message-action options + per-type bubble views

### 3a. Text formatters — inline text patterns

`[textFormatters]` is an `@Input` on `<cometchat-message-list>`, `<cometchat-message-composer>`, and `<cometchat-message-information>`, taking an array of `CometChatTextFormatter` instances.

**Built-in formatters** (all exported from `@cometchat/chat-uikit-angular`, all zero-arg constructors): `CometChatMentionsFormatter`, `CometChatUrlFormatter`, `CometChatEmojiFormatter`, `CometChatMarkdownFormatter`. (`CometChatTextFormatter` is the abstract base — you can't instantiate it directly.)

```typescript
import {
  CometChatMentionsFormatter,
  CometChatUrlFormatter,
  CometChatEmojiFormatter,
} from "@cometchat/chat-uikit-angular";

textFormatters = [
  new CometChatMentionsFormatter(),
  new CometChatUrlFormatter(),
  new CometChatEmojiFormatter(),
];
```

```html
<cometchat-message-list [user]="selectedUser" [textFormatters]="textFormatters">
</cometchat-message-list>
<cometchat-message-composer [user]="selectedUser" [textFormatters]="textFormatters">
</cometchat-message-composer>
```

**⚠️ Pass the same `textFormatters` array to both list and composer.** If they differ, text renders differently while typing vs. after send.

**Custom formatter — the v5 API.** Extend `CometChatTextFormatter` and implement the abstract members. This is **different from v4** — there is no `setTrackingCharacter` / `setRegexPatterns` / `getFormattedText(input)` here. v5 requires: a readonly `id`, `getRegex()`, and `format(text)`; optionally override `shouldFormat()` and set `priority` (lower runs earlier; default 100).

```typescript
// hashtag-formatter.ts
import { CometChatTextFormatter } from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

export class HashtagFormatter extends CometChatTextFormatter {
  readonly id = "hashtag-formatter";
  override priority = 90;

  getRegex(): RegExp {
    return /\B#(\w+)\b/g;
  }

  format(text: string): string {
    this.originalText = text ?? "";
    this.formattedText = this.originalText.replace(
      this.getRegex(),
      '<span style="color: var(--cometchat-primary-color); font-weight: 600;">#$1</span>'
    );
    return this.formattedText;
  }

  // Optional — skip very short messages
  override shouldFormat(text: string, _message?: CometChat.BaseMessage): boolean {
    return !!text && text.length > 1;
  }
}
```

```typescript
import { HashtagFormatter } from "./hashtag-formatter";
import { CometChatMentionsFormatter, CometChatUrlFormatter } from "@cometchat/chat-uikit-angular";

textFormatters = [
  new CometChatMentionsFormatter(),
  new CometChatUrlFormatter(),
  new HashtagFormatter(),
];
```

> Construct formatter instances **once** at class level (as a property), not in `ngOnInit` or a getter. Recreating them every change-detection cycle drops their internal `originalText` / `formattedText` / metadata state.

### 3b. Message-action menu — `additionalOptions` / `optionsOverride`

To **add** items to the per-message action menu, pass `CometChatActionsIcon[]` to `[additionalOptions]`. To **add / remove / reorder** items with full control, pass an `[optionsOverride]` callback `(message, defaultOptions) => CometChatActionsIcon[]`.

> **There is no `getMessageOptions` override point in the Angular kit** (unlike the web/React DataSource path). `getMessageOptions` exists only as an *internal* component method (`components/cometchat-message-list/cometchat-message-list.component.ts:398` → `cometchat-message-list.option-builders.ts`); the public override surface is the two `@Input`s below. Verified `@Input() additionalOptions: CometChatActionsIcon[]` (`cometchat-message-list.component.ts:174`) and `@Input() optionsOverride?: (message: CometChat.BaseMessage, defaultOptions: CometChatActionsIcon[]) => CometChatActionsIcon[]` (`cometchat-message-list.component.ts:175-178`). `CometChatActionsIcon` is exported from `@cometchat/chat-uikit-angular` (`modals/index.ts:9`) with constructor `{ id: string; title: string; iconURL: string; onClick: (id: number) => void }` (`modals/CometChatActionsIcon.ts`). A "Forward"-style action is built exactly this way — push a `CometChatActionsIcon` into `additionalOptions` (or reorder inside `optionsOverride`).

```typescript
import { CometChatActionsIcon } from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

// Add a "Pin" action to every message's menu
additionalOptions: CometChatActionsIcon[] = [
  new CometChatActionsIcon({
    id: "pin",
    title: "Pin",
    iconURL: "assets/pin.svg",
    onClick: (id: number) => {
      // your pin handler — `id` is the message id
    },
  }),
];

// Or rewrite the whole option set per message
optionsOverride = (
  message: CometChat.BaseMessage,
  defaultOptions: CometChatActionsIcon[]
): CometChatActionsIcon[] => {
  // e.g. drop the default options for system messages
  if (message.getCategory() === "action") return [];
  return [...defaultOptions, ...this.additionalOptions];
};
```

```html
<cometchat-message-list
  [user]="selectedUser"
  [additionalOptions]="additionalOptions"
  [optionsOverride]="optionsOverride">
</cometchat-message-list>
```

> To merely **hide** a built-in action, prefer the Tier 1 `[hide*Option]` flag — it's a single boolean and survives kit upgrades better than reconstructing the option array.

### 3c. Custom bubble views per message type

v5 has **no `CometChatMessageTemplate` and no `templates` @Input**. Two supported paths:

**(i) Slot inputs on the message list** — for an extra row under existing bubbles, use `[bubbleFooterView]` (per-bubble footer) or `[appendView]` (after the bubble). Cheapest; no service.

```html
<cometchat-message-list [user]="selectedUser" [bubbleFooterView]="myFooter">
</cometchat-message-list>

<ng-template #myFooter let-message>
  <small class="bubble-meta">{{ message?.getId() }}</small>
</ng-template>
```

**(ii) `MessageBubbleConfigService`** — to replace a *part* of a specific message type's bubble globally (content, header, footer, etc.), inject the service and call `setBubbleView(messageTypeKey, partMap)`. `partMap` is a `BubblePartMap` whose keys are `bubbleView` / `contentView` / `bottomView` / `footerView` / `leadingView` / `headerView` / `statusInfoView` / `replyView` / `threadView`, each a `TemplateRef` (verified `BubblePartMap` in `@cometchat/chat-uikit-angular` — `services/message-bubble-config.types.ts:30-40`).

> **⚠️ The `messageTypeKey` is `"{type}_{category}"`, NOT just the type.** The kit builds its lookup key as `` `${message.getType()}_${message.getCategory()}` `` (`components/cometchat-message-bubble/cometchat-message-bubble.component.ts:322` → consumed in `getEffectiveView` at line 332). A custom message sent with `type: "poll"` has category `"custom"` (`CometChat.CATEGORY_CUSTOM`), so its key is **`"poll_custom"`** — passing just `"poll"` silently never matches and your view never renders. The kit's own internal map confirms this format (`meeting_custom`, `extension_poll_custom`, … at lines 55-75). Built-in standard types follow the same rule: text is `"text_message"`, image is `"image_message"` (service docstring `message-bubble-config.service.ts:46-58`).

```typescript
import { Component, AfterViewInit, ViewChild, TemplateRef, inject } from "@angular/core";
import {
  CometChatMessageListComponent,
  MessageBubbleConfigService,
} from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-chat",
  standalone: true,
  imports: [CometChatMessageListComponent],
  template: `
    <cometchat-message-list [user]="selectedUser"></cometchat-message-list>

    <ng-template #pollContent let-message>
      <div class="poll-card">{{ message?.getCustomData()?.question }}</div>
    </ng-template>`,
})
export class AppChatComponent implements AfterViewInit {
  private bubbleConfig = inject(MessageBubbleConfigService);
  @ViewChild("pollContent") pollContent!: TemplateRef<any>;

  ngAfterViewInit(): void {
    // Replace only the content area of the "poll" custom message type.
    // KEY = `${type}_${category}` → a custom message of type "poll" is category
    // "custom", so the key is "poll_custom" (NOT "poll" — that would never match).
    this.bubbleConfig.setBubbleView("poll_custom", { contentView: this.pollContent });
  }
}
```

`MessageBubbleConfigService` is `providedIn: 'root'`, so the config applies to every message list in the app. Call `setBubbleView` once (in `ngAfterViewInit`, after the `@ViewChild` template refs resolve). To render a genuinely new custom message type, register its `contentView` (above) **and send it through the kit** (next subsection) — not the raw SDK.

### 3d. Sending a custom message type — use the UIKit path, not the raw SDK

When you create a brand-new message type (`type: "poll"`, `"location"`, …), send it with **`CometChatUIKit.sendCustomMessage(...)`**, never the raw `CometChat.sendCustomMessage(...)`. The UIKit wrapper sets `muid`, stamps the logged-in user as sender, and emits `ccMessageSent` — which is what makes the message **append** to the open list immediately. The raw SDK call skips all three, producing the two classic failures: *"Cannot determine message recipient"* (no proper sender/receiver wiring) and the realtime bubble **replacing an existing message** instead of appending (no `muid` for dedup).

```typescript
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

const receiverId = this.selectedUser.getUid();          // or group.getGuid()
const receiverType = CometChat.RECEIVER_TYPE.USER;       // or .GROUP
const custom = new CometChat.CustomMessage(
  receiverId,
  receiverType,
  "poll",                                                // matches the contentView type
  { question: "Lunch?", options: ["Yes", "No"] }
);

// ✅ kit path — sets muid + sender, emits ccMessageSent → list appends
await CometChatUIKit.sendCustomMessage(custom);

// ❌ raw SDK — no muid/sender/event → "Cannot determine recipient" + realtime replace
// await CometChat.sendCustomMessage(custom);
```

Verified: `static sendCustomMessage(message: CometChat.CustomMessage): Promise<CometChat.BaseMessage>` on `CometChatUIKit` (`cometchat-uikit.ts:251`, exported from `@cometchat/chat-uikit-angular`). `CometChat.CustomMessage` has a variadic constructor (`...args: any[]`, `chat-sdk-javascript` `dist/type/lib/models/CustomMessage.d.ts:13`); the canonical 4-arg form is `(receiverId, receiverType, type, customData)`.

### 3e. Custom attachment (composer) options — the `[attachmentOptions]` input is APPENDED to the defaults

`<cometchat-message-composer>` exposes `@Input() attachmentOptions?: CometChatMessageComposerAction[]` (verified `components/cometchat-message-composer/cometchat-message-composer.component.ts:137`). **In Angular v5 this is additive, NOT a replace** — the composer first builds the default menu (image / video / audio / file / polls / collaborative doc / whiteboard, each gated by its `hide*` flag), then **appends** your options: `if ((self.attachmentOptions?.length ?? 0) > 0) o.push(...self.attachmentOptions)` (verified `cometchat-message-composer.lifecycle-utils.ts:108`). So you pass **only your custom option(s)** and the defaults are preserved automatically — do NOT reconstruct the defaults yourself.

> ⚠️ This differs from the **React** kit, where the composer's `attachmentOptions` prop genuinely **replaces** the list (there you must seed from `getDataSource().getAttachmentOptions(...)`). Don't cross-port React's seed-the-defaults pattern to Angular — here it would duplicate every default option.

`CometChatMessageComposerAction` is exported from `@cometchat/chat-uikit-angular` (`modals/index.ts:11`); its constructor takes `Partial<CometChatMessageComposerAction>` with fields `id`, `iconURL`, `title?`, `onClick: (() => void) | null` (`modals/CometChatMessageComposerAction.ts`).

```html
<!-- ✅ "Send Location" is ADDED after the default photo/video/file/poll options -->
<cometchat-message-composer [attachmentOptions]="[locationOption]">
</cometchat-message-composer>
```

```typescript
import { CometChatMessageComposerAction } from "@cometchat/chat-uikit-angular";

// Pass ONLY your custom option — the kit keeps its defaults and appends this.
locationOption = new CometChatMessageComposerAction({
  id: "location",
  title: "Send Location",
  iconURL: "assets/location.svg",
  onClick: () => this.shareLocation(),
});
```

To only *remove* built-in options (the common ask), do **not** touch `attachmentOptions` — use the dedicated boolean inputs, which preserve everything else: `[hideImageAttachmentOption]`, `[hideVideoAttachmentOption]`, `[hideAudioAttachmentOption]`, `[hideFileAttachmentOption]`, `[hidePollsOption]`, `[hideCollaborativeDocumentOption]`, `[hideCollaborativeWhiteboardOption]`. All verified as `@Input`s on `CometChatMessageComposerComponent` (`components/cometchat-message-composer/cometchat-message-composer.component.ts:139-140`).

---

## Tier 4 — Event bus (RxJS subscriptions)

Subscribe to the kit's static event classes so your own code reacts to activity inside the UI Kit. All event classes are exported from `@cometchat/chat-uikit-angular` and expose `Subject`s you `.subscribe()` to.

```typescript
import { Component, OnInit, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import {
  CometChatMessageEvents,
  CometChatConversationEvents,
  CometChatGroupEvents,
} from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({ selector: "app-root", standalone: true, template: `...` })
export class AppComponent implements OnInit, OnDestroy {
  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      // payload is IMessages: { message, status, parentMessageId? }
      CometChatMessageEvents.ccMessageSent.subscribe(({ message, status }) => {
        // analytics.track("message_sent", { id: message.getId(), status });
      }),
      CometChatConversationEvents.ccConversationDeleted.subscribe(
        (conversation: CometChat.Conversation) => {
          // remove from local cache
        }
      ),
      CometChatGroupEvents.ccGroupLeft.subscribe((payload) => {
        // payload is IGroupLeft
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
```

**Always unsubscribe in `ngOnDestroy`.** Angular components are destroyed on navigation; leaked subscriptions fire handlers twice. (Each event class also exposes typed `on*(cb, destroyRef?)` helpers — e.g. `CometChatMessageEvents.onMessageSent(cb, destroyRef)` — that auto-clean up when you pass a `DestroyRef`; use those if you prefer not to track `Subscription`s manually.)

### Available event streams (verified subjects)

| Event class | Key subjects |
|---|---|
| `CometChatMessageEvents` | `ccMessageSent`, `ccMessageEdited`, `ccMessageDeleted`, `ccMessageRead`, `ccReplyToMessage`, `ccMessageTranslated` (+ low-level `onTextMessageReceived`, `onTypingStarted`, `onMessageReactionAdded`, …) |
| `CometChatConversationEvents` | `ccConversationDeleted`, `ccUpdateConversation` |
| `CometChatGroupEvents` | `ccGroupCreated`, `ccGroupDeleted`, `ccGroupMemberJoined`, `ccGroupLeft`, `ccGroupMemberAdded`, `ccGroupMemberScopeChanged`, `ccGroupMemberKicked`, `ccGroupMemberBanned`, `ccGroupMemberUnbanned`, `ccOwnershipChanged` |
| `CometChatUserEvents` | `ccUserBlocked`, `ccUserUnblocked` |
| `CometChatUIEvents` | `ccActiveChatChanged`, `ccOpenChat`, `ccShowOngoingCall`, `ccShowPanel`/`ccHidePanel`, `ccShowModal`/`ccHideModal`, `ccComposeMessage`, … |
| `CometChatCallEvents` | call lifecycle subjects (see `cometchat-angular-calls`) |

Confirm the exact subject name and payload type in the bundled `.d.ts` before subscribing — some carry typed interfaces (`IMessages`, `IGroupLeft`, `IGroupMemberJoined`, `IActiveChatChanged`, …), not raw SDK objects.

---

## Services / state-management layer

The kit ships a set of injectable services (verified in `projects/cometchat-uikit/src/lib/services/`, all exported from `@cometchat/chat-uikit-angular`). Most are `providedIn: 'root'` singletons; you `inject()` them and read **signals** (snapshot, template-friendly) or **`$` Observables** (RxJS). This is the seam below the `@Input` tiers above — use it for app-wide state and cross-component coordination, not per-instance tweaks.

### `ChatStateService` — the active-chat single source of truth

`providedIn: 'root'`. Holds the currently active `CometChat.User` / `CometChat.Group` / `CometChat.Conversation` and enforces **mutual exclusivity**: setting a user clears the active group and vice versa. The kit's list components (`<cometchat-conversations>`, `<cometchat-users>`, `<cometchat-groups>`) call its setters on selection, and the message components subscribe to it — so in the **service-based** wiring you place components in the template and they sync automatically with no `(itemClick)` plumbing.

Each piece of state is exposed **both** as a readonly signal and as an `$` Observable:

```typescript
import { Component, inject } from "@angular/core";
import { ChatStateService } from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({
  selector: "app-chat",
  standalone: true,
  template: `
    <cometchat-conversations></cometchat-conversations>
    @if (chatState.activeUser() || chatState.activeGroup()) {
      <cometchat-message-header></cometchat-message-header>
      <cometchat-message-list></cometchat-message-list>
      <cometchat-message-composer></cometchat-message-composer>
    }
  `,
})
export class ChatComponent {
  chatState = inject(ChatStateService);

  // signals (snapshot / template): activeUser(), activeGroup(), activeConversation()
  // observables: activeUser$, activeGroup$, activeConversation$  (subscribe in TS)
  // setters:     setActiveUser(u) | setActiveGroup(g) | setActiveConversation(c)
  // snapshots:   getActiveUser() | getActiveGroup() | getActiveChatEntity()
  // teardown:    clearActiveChat()  ← call on logout / ngOnDestroy
}
```

`setActiveConversation(c)` extracts the `User` or `Group` from the conversation and delegates to the right setter. Use the **props-based** alternative (`[user]` / `[group]` `@Input`s, Tier 1 wiring) instead of the service for multi-panel layouts where each panel needs independent state.

> **Don't scope `ChatStateService`** in a component's `providers: []` — it is intentionally an app-wide singleton; a local copy breaks cross-component sync. Use props for isolated panels instead.

### The customization services — concise reference

All exported from `@cometchat/chat-uikit-angular`; `inject()` them. The two **search** services are `@Injectable()` (component-provided, not root) — they back the search components and you rarely inject them directly. The rest are `providedIn: 'root'`.

| Service | One-liner | Key members (verified) |
|---|---|---|
| `MessageBubbleConfigService` | Per-type / global bubble part overrides (Tier 3c) | `setBubbleView(type, partMap)`, `setGlobalView(part, ref)`, `setGlobalViews(map)`, `setMessageTemplates(record)`, `getView(type, part)`, `clearType(type)`, `clearAll()`; `configVersion` signal + `configChanged$` |
| `FormatterConfigService` | App-wide default text formatters (the `[textFormatters]` of Tier 3a, set once globally) | `getDefaultFormatters()`, `setDefaultFormatters(fmts)`, `addFormatters(fmts)`, `getFormattersWithContext(user?, alignment?)`, `resetToDefaults()` |
| `CometChatTemplatesService` | SDK-wide loading / empty / error / item templates for **all** list components at once | `setSharedTemplates(t)` (all lists) + per-component `setConversationTemplates` / `setUserTemplates` / `setGroupTemplates` / `setGroupMemberTemplates` / `setCallLogTemplates` / `setMessageListTemplates` / `setSearchTemplates`; each has matching `get*` / `clear*`; `clearAllTemplates()`. Every section also exposes a `*Templates` signal + `*Templates$` Observable. Priority: component `@Input` > component-service > shared > default |
| `RichTextEditorService` | Drives the rich-text composer (bold/italic/lists/links/mentions) | `createEditor(config?, el?)`, `destroyEditor(e)`, `toggleBold/Italic/Underline/Strikethrough/Code/CodeBlock/Blockquote/OrderedList/BulletList(e)`, `setLink(e, url, text?)`, `insertMention(e, id, label, n)`, `getHTML(e)` / `getText(e)` / `getTextWithMentionFormat(e)`, `undo/redo(e)`; `formatState` signal |
| `SearchConversationsService` | Backs conversation search — query + live-listener state | `search(keyword, filters, builder?)`, `loadMore()`, `attachListeners(user)` / `detachListeners()`, `reset()`; `conversations`, `fetchState`, `hasMoreResults`, `typingIndicatorMap` signals |
| `SearchMessagesService` | Backs message search | `search(keyword, filters, uid?, guid?, builder?, alwaysShowSeeMore?)`, `loadMore()`, `reset()`; `messages`, `fetchState`, `hasMoreResults` signals |

`FormatterConfigService`, `MessageBubbleConfigService`, `CometChatTemplatesService`, and `RichTextEditorService` are the four services you *can* deliberately re-provide in a component's `providers: []` to scope a customization to one subtree (e.g. a thread panel with minimal styling) without touching the global singleton — they cross-link directly to the formatter (Tier 3a), bubble (Tier 3c), and slot-template (Tier 1) work above.

> **Read signals in templates, subscribe to `$` Observables in TS.** Don't call `.subscribe()` on a signal or invoke an Observable like a function — they are distinct APIs on the same state.

---

## Recipes (common asks → right tier)

### "Filter the conversation list to just premium users"
**Tier 2** — `[conversationsRequestBuilder]` with `.setTags(["premium"])`.

### "Custom empty state for the users list"
**Tier 1** — `[emptyView]` slot on `<cometchat-users>`.

### "Custom row for conversations"
**Tier 1** — `[itemView]` slot on `<cometchat-conversations>`.

### "Highlight hashtags in messages"
**Tier 3a** — subclass `CometChatTextFormatter` (`id` + `getRegex()` + `format()`), pass it in `textFormatters` to list AND composer.

### "Add a 'Pin message' action to the menu"
**Tier 3b** — push a `CometChatActionsIcon` into `[additionalOptions]`.

### "Remove the Translate action"
**Tier 1** — `[hideTranslateMessageOption]="true"` on `<cometchat-message-list>`.

### "Render a custom card for our 'poll' message type"
**Tier 3c** — `MessageBubbleConfigService.setBubbleView("poll_custom", { contentView: tmplRef })`. The key is `"{type}_{category}"` — a `type: "poll"` custom message is category `custom`, so the key is `poll_custom`, not `poll`.

### "When a message is sent, log it to analytics"
**Tier 4** — `CometChatMessageEvents.ccMessageSent.subscribe(({ message }) => …)`.

### "When a group is deleted, navigate away"
**Tier 4** — `CometChatGroupEvents.ccGroupDeleted.subscribe(group => router.navigate([...]))`.

### "Sync the active conversation across my own components"
**Services** — `inject(ChatStateService)`; read `activeUser()` / `activeGroup()` signals (or `activeUser$` / `activeGroup$`), set with `setActiveConversation(c)`, clear with `clearActiveChat()`.

### "Apply one branded empty/loading state to every list at once"
**Services** — `CometChatTemplatesService.setSharedTemplates({ loadingView, emptyView })`; override a single list with `setUserTemplates(...)` etc.

---

## Anti-patterns

1. **Don't reach for v4 symbols.** `CometChatMessageTemplate`, `DataSource`, `DataSourceDecorator`, `ChatConfigurator`, `CometChatThemeService`, `CometChatUrlsFormatter` (plural), and the v4 `CometChatTextFormatter` API are all **phantom in v5**. They will fail to import.

2. **Don't expect a `templates` @Input on `<cometchat-message-list>`.** It doesn't exist in v5. Custom bubbles go through `MessageBubbleConfigService.setBubbleView` or the `bubbleFooterView` / `appendView` slots.

3. **Don't write the v4 formatter shape.** v5 formatters need `id` + `getRegex()` + `format(text)` — not `setTrackingCharacter` / `setRegexPatterns` / `getFormattedText(input)`.

4. **Don't pass different `textFormatters` arrays** to the list and the composer — text will render inconsistently.

5. **Don't post-filter a list after render.** For "only online users", use Tier 2 `usersRequestBuilder.setStatus(...)`; don't fetch everyone and hide rows with `*ngIf`.

6. **Don't construct formatters or request builders inside a getter / `ngOnInit` that re-runs.** Build them once as class properties — recreating them per change-detection cycle drops formatter state or forces list refetches.

7. **Don't forget `ngOnDestroy` unsubscribe** (or pass a `DestroyRef` to the `on*` helpers). Leaked subscriptions double-fire after navigation.

8. **Don't add `CUSTOM_ELEMENTS_SCHEMA`** — v5 components are real Angular standalone components; import the class into `imports: []`.

9. **Don't fork or patch `@cometchat/chat-uikit-angular`.** Every customization here is achievable via Tiers 1–4. Forking breaks on kit upgrades.

10. **Don't escalate past Tier 1 without checking the catalog.** A `[hide*]` flag or a `[*View]` slot solves most asks in one line.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Init / login / standalone setup — read first |
| `cometchat-angular-components` | The `@Input`/`@Output`/slot-view reference these tiers build on |
| `cometchat-angular-placement` | Where to put the customized components |
| `cometchat-angular-theming` | App-wide colour / typography via CSS variables |
| `cometchat-angular-features` | Out-of-the-box features (calls, extensions, AI) |
| `cometchat-angular-customization` | This skill — four-tier triage + formatters / options / bubble views / events |
| `cometchat-angular-production` | When customization depends on production auth |
| `cometchat-angular-troubleshooting` | Formatter doesn't apply, slot renders nothing, listener fires twice |

## Sound (in-app message + call sounds)

Sound is a customization sub-dimension. The UI Kit plays incoming/outgoing message + call sounds via `CometChatSoundManager` — mute it, swap custom audio, or play a specific sound. The full API + recipe lives in **`cometchat-angular-theming`** (Sound section). Verify the access path against the installed kit before relying on it.
