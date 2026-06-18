---
name: cometchat-native-components
description: "Component catalog for the CometChat React Native UI Kit v5 — names, props, slot views, request builders, hide flags, style shape. Always loaded before writing CometChat* JSX."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native components catalog props"
---

## Purpose

Teaches Claude every component the React Native UI Kit exports, with the props, callback signatures, slot views, request builders, and style shapes that actually exist. This is the authoritative reference — never invent component names or props from memory; look them up here.

**Read this skill before writing any `<CometChat*>` JSX.**

Ground truth: `packages/ChatUiKit/src/index.ts` from the UI Kit source + `docs/ui-kit/react-native/components-overview.mdx` + per-component doc pages. **Official docs:** https://www.cometchat.com/docs/ui-kit/react-native/components-overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).

---

## How to use this catalog

The React Native UI Kit is a set of independent components that you compose into chat layouts. Three patterns cover almost every use case:

> ⛔ **Only the components in THIS catalog exist — do not invent or recall names from v4/older memory.** Before emitting ANY `CometChat*` component, confirm it's in this catalog; if it's not here, it doesn't exist (→ unresolved-import build failure). **There is no all-in-one component:** the v4 composites `CometChatConversationsWithMessages`, `CometChatUsersWithMessages`, `CometChatGroupsWithMessages`, the `CometChatMessages` composite, and the `CometChatUI` god-component are all **absent in this RN kit** (verified against its exports) — compose the panes yourself per the table below. This is the #1 v4-memory hallucination.

| Pattern | Components |
|---|---|
| **Two-pane** (inbox) | `CometChatConversations` + `CometChatMessageHeader` + `CometChatMessageList` + `CometChatMessageComposer` |
| **Single thread** (1-to-1) | `CometChatMessageHeader` + `CometChatMessageList` + `CometChatMessageComposer` (with a resolved `user` or `group`) |
| **Tab-based messenger** | `CometChatConversations` + `CometChatUsers` + `CometChatGroups` + `CometChatCallLogs` in a bottom-tab bar |

**Data flow** (identical across all 3): a list component emits a `CometChat.Conversation` / `User` / `Group` via `onItemPress`. Extract the entity (`conversation.getConversationWith()` for conversations) and pass it as a prop to the header / list / composer.

All components share the same API surface — see § Prop conventions.

---

## Prop conventions (applies to every `<CometChat*>` component)

Four prop families you'll see across the catalog:

| Family | Shape | Example |
|---|---|---|
| **Callback** | `on<Event>={(param) => void}` | `onItemPress={(conv) => ...}` • `onError={(err) => ...}` • `onSendButtonPress={(msg) => ...}` |
| **Request builder** | `<entity>RequestBuilder={new CometChat.<Entity>RequestBuilder()}` | `conversationsRequestBuilder={new CometChat.ConversationsRequestBuilder().setLimit(20)}` |
| **Hide / visibility toggle** | `hide<Feature>={boolean}` \| `<feature>Visibility={boolean}` | `receiptsVisibility={true}` • `hideReplyInThreadOption={true}` |
| **View slot (replace a section)** | `<Slot>View={(params) => JSX}` — **PascalCase**, returns JSX | `TitleView={({ user, group }) => <MyTitle />}` • `LeadingView={({ user, group }) => <MyAvatar />}` |
| **Style** | `style={{ containerStyle: {}, itemStyle: { ... } }}` | see § 14 Style shape |

**On-events take positional args, not an event object.** `onItemPress={(conversation) => ...}` receives the `CometChat.Conversation` directly — no `event.target`.

**Slot views are capitalized**: `TitleView`, `SubtitleView`, `LeadingView`, `TrailingView`, `EmptyView`, `ErrorView`, `LoadingView`, `AuxiliaryButtonView`, `ItemView`. Each slot function receives a **single destructured object** — typically `({ user, group }) => JSX` — NOT positional `(user, group)` args.

**Style is nested objects.** Top-level `style` accepts `containerStyle` (outermost wrapper) then component-specific keys. Each inner style is a regular React Native `StyleSheet` object.

---

## 1. Lists

All four list components take a request builder, an `onItemPress` callback, `on<List>LongPress` for long-press, and `style={}`.

### CometChatConversations

Scrollable list of recent conversations (both user and group).

```tsx
import { CometChatConversations } from "@cometchat/chat-uikit-react-native";
import { CometChat } from "@cometchat/chat-sdk-react-native";

<CometChatConversations
  conversationsRequestBuilder={
    new CometChat.ConversationsRequestBuilder().setLimit(20)
  }
  onItemPress={(conversation) => {
    const entity = conversation.getConversationWith();   // User | Group
    const type = conversation.getConversationType();      // "user" | "group"
    // navigate / open panel with `entity`
  }}
  onError={(err) => console.error(err)}
  hideHeader={false}
  receiptsVisibility={true}
  style={{ containerStyle: { backgroundColor: "#fff" } }}
/>
```

Key props: `conversationsRequestBuilder`, `onItemPress`, `onItemLongPress`, `onError`, `onEmpty`, `receiptsVisibility` (default `true`), `hideHeader`, `showSearchBar` (default `false`), `TitleView`, `SubtitleView`, `LeadingView`, `TrailingView`, `EmptyView`, `ErrorView`, `LoadingView`, `style`.

### CometChatUsers

```tsx
<CometChatUsers
  usersRequestBuilder={new CometChat.UsersRequestBuilder().setLimit(30)}
  onItemPress={(user) => openChatWith(user)}
  searchKeyword=""
  usersStatusVisibility={true}
/>
```

Key props: `usersRequestBuilder`, `onItemPress`, `onError`, `onEmpty`, `searchKeyword`, `usersStatusVisibility` (default `true`), `LeadingView`, `TitleView`, `SubtitleView`, `EmptyView`, `ErrorView`, `LoadingView`, `style`.

### CometChatGroups

```tsx
<CometChatGroups
  groupsRequestBuilder={
    new CometChat.GroupsRequestBuilder().setLimit(30).joinedOnly(true)
  }
  onItemPress={(group) => openGroupChat(group)}
/>
```

Key props: same shape as Users, with `groupsRequestBuilder` instead — plus a `hideSearch` flag (Groups has one; Users does not). Slot views are `EmptyView` / `ErrorView` / `LoadingView`.

### CometChatGroupMembers

```tsx
<CometChatGroupMembers
  group={selectedGroup}
  groupMemberRequestBuilder={
    new CometChat.GroupMembersRequestBuilder(selectedGroup.getGuid()).setLimit(30)
  }
  onItemPress={(member) => openMemberDetails(member)}
  hideKickMemberOption={false}
  hideBanMemberOption={false}
/>
```

Key props: `group` (**required** — pass a `CometChat.Group` instance), `groupMemberRequestBuilder`, `onItemPress`, `onError` (no args — `() => void`), `showBackButton` (toggle the back button; there is no `onBack` prop), `hideKickMemberOption`, `hideBanMemberOption`, `hideScopeChangeOption`, slot views for each row section, `style`.

---

## 2. Messages

### CometChatMessageHeader

```tsx
<CometChatMessageHeader
  user={selectedUser}            // OR group — never both
  showBackButton={true}
  onBack={() => navigation.goBack()}
  AuxiliaryButtonView={({ user, group }) => <CometChatCallButtons user={user} group={group} />}
  TitleView={({ user, group }) => <CustomTitle />}
  SubtitleView={({ user, group }) => <CustomSubtitle />}
/>
```

Key props: `user` OR `group` (one required), `showBackButton` (default `false`), `hideVideoCallButton`, `hideVoiceCallButton`, `onBack`, `TitleView`, `SubtitleView`, `LeadingView`, `TrailingView`, `AuxiliaryButtonView`, `ItemView`, `style`. All slot views take a single object — `({ user, group }) => JSX`, NOT positional `(user, group)`.

### CometChatMessageList

Scrollable message feed. Handles reactions, receipts, mentions, threads, and media out of the box.

```tsx
<CometChatMessageList
  user={selectedUser}
  messageRequestBuilder={
    new CometChat.MessagesRequestBuilder()
      .setUID(selectedUser.getUid())
      .setLimit(30)
  }
  hideReplyInThreadOption={true}       // SEE HARD RULE § 12
  receiptsVisibility={true}
  onThreadRepliesPress={(message, bubbleView) => openThreadPanel(message)}
  onError={(err) => console.error(err)}
  EmptyView={() => <Text>No messages yet</Text>}
  style={{ containerStyle: { backgroundColor: "#fff" } }}
/>
```

Key props: `user` OR `group`, `parentMessageId` (for thread replies), `messageRequestBuilder`, `goToMessageId` (scroll-to-message), `searchKeyword` (highlight in bubbles), `textFormatters`, `templates` (custom message type rendering — `CometChatMessageTemplate[]`), `hideReplyInThreadOption` **see hard rule § 12**, `receiptsVisibility` (default `true`), `hideReactionOption`, `hideReplyOption`, `hideEditMessageOption`, `hideDeleteMessageOption`, `hideTranslateMessageOption`, `hideMessagePrivatelyOption`, `hideCopyMessageOption`, `hideMessageInfoOption`, `hideFlagMessageOption`, `hideShareMessageOption`, `dateSeparatorPattern` (there is no `hideDateSeparator` flag), `onThreadRepliesPress`, `onError`, `EmptyView` / `ErrorView` / `LoadingView`, `style`.

### CometChatMessageComposer

Rich text input. Attachments, mentions, voice notes, sticker picker, reaction keyboard.

```tsx
<CometChatMessageComposer
  user={selectedUser}
  initialComposertext="Type a message..."
  keyboardAvoidingViewProps={Platform.OS === "android" ? {} : { behavior: "padding" }}
  onSendButtonPress={(message) => console.log("sent", message)}
  onError={(err) => console.error(err)}
  disableMentions={false}
  textFormatters={[
    new CometChatMentionsFormatter(),
    new CometChatUrlsFormatter(),
  ]}
  AuxiliaryButtonView={({ user, group }) => <CustomAuxButton />}
  attachmentOptions={({ user, group }) => [ /* CometChatMessageComposerAction[] */ ]}
/>
```

Key props: `user` OR `group`, `parentMessageId` (for thread composer), `initialComposertext`, `keyboardAvoidingViewProps`, `onSendButtonPress`, `onError`, `onTextChange`, `disableMentions`, `disableSoundForOutgoingMessages`, `textFormatters`, `attachmentOptions` (single-object `({ user, group }) =>`), `HeaderView`, `AuxiliaryButtonView`, `SendButtonView`, `style`.

**Keyboard avoidance is the composer's job.** The kit composer owns it via `keyboardAvoidingViewProps` — do **not** wrap Header/List/Composer in an external `KeyboardAvoidingView` (the kit sample app does not). Pass `{ behavior: "padding" }` on iOS, `{}` on Android (Android relies on the manifest's `android:windowSoftInputMode="adjustResize"`).

### CometChatCompactMessageComposer

Compact variant for small screens. Auto-expanding input, rich-text, attachments.

```tsx
<CometChatCompactMessageComposer
  user={selectedUser}
  enableRichTextEditor={true}
  onSendButtonPress={(message) => {}}
/>
```

Use this instead of `CometChatMessageComposer` in drawers, widgets, or embedded placements. Same prop family — but note the placeholder prop here is `placeHolderText` (capital H), distinct from the standard composer's `initialComposertext`.

### CometChatThreadHeader

Header for a threaded reply view — parent message + reply count + close.

```tsx
<CometChatThreadHeader
  parentMessage={threadParent}
  replyCountVisibility={true}
/>
```

Key props: `parentMessage` (**required** — a `CometChat.BaseMessage`), `template` (`CometChatMessageTemplate`), `replyCountVisibility` (default `true`), `style`. There is no `onClose` prop — drive the panel's visibility from the parent's own state (see the threading composition below).

**Threading composition:**

```tsx
// In the main message list, capture a thread-open request
<CometChatMessageList
  user={selectedUser}
  onThreadRepliesPress={(message) => setThreadMessage(message)}
/>

// When a thread is open, render the thread panel
{threadMessage && (
  <>
    <CometChatThreadHeader
      parentMessage={threadMessage}
    />
    <CometChatMessageList
      user={selectedUser}
      parentMessageId={threadMessage.getId()}
    />
    <CometChatMessageComposer
      user={selectedUser}
      parentMessageId={threadMessage.getId()}
    />
  </>
)}
```

---

## 3. Calling (separate SDK)

Call components live in `@cometchat/chat-uikit-react-native` but **require `@cometchat/calls-sdk-react-native` to be installed** to work. Don't import any of these if the calls SDK isn't in the project.

### CometChatCallButtons

Voice + video call initiators. Drop into `AuxiliaryButtonView` on `CometChatMessageHeader` for phone + camera icons next to a user's name.

```tsx
<CometChatCallButtons
  user={selectedUser}
  hideVideoCallButton={false}
  hideVoiceCallButton={false}
  onError={(err) => console.error(err)}
/>
```

Key props: `user` OR `group`, `hideVideoCallButton`, `hideVoiceCallButton`, `callSettingsBuilder`, `onError`. There are no `onVoiceCallPress` / `onVideoCallPress` props — the kit initiates the call and emits the outgoing-call event itself (see `cometchat-native-features` §3d for wiring the resulting overlay).

### CometChatIncomingCall

Incoming call notification. **Parent-controlled — must be conditionally rendered when an incoming-call event fires on `CometChat.addCallListener`'s `onIncomingCallReceived`.** Render at the app root so it's visible on any screen.

> **DO NOT pass `onAccept`** — it short-circuits the kit's internal `acceptCall` + transition to `<CometChatOngoingCall>`. The kit fires `ccShowOngoingCall` after acceptance; let the parent's `CometChatUIEventHandler.addCallListener` mount the ongoing surface. Only handle `onDecline` + `onError`. See `cometchat-native-calls` §1.8.c and full wiring in `cometchat-native-features` §3d.

```tsx
<CometChatIncomingCall
  call={incomingCall}
  onDecline={() => setIncomingCall(null)}
  onError={() => setIncomingCall(null)}
  disableSoundForCalls={false}
/>
```

### CometChatOutgoingCall

Ringing-while-calling screen. **Parent-controlled — NOT auto-mounted by `CometChatIncomingCall` or by tapping the call button.** To make the call button in `<CometChatMessageHeader>` actually mount this overlay, register `CometChatUIEventHandler.addCallListener` and listen for `ccOutgoingCall`. Full wiring template in `cometchat-native-features` §3d.

```tsx
<CometChatOutgoingCall
  call={outgoingCall}
  onEndCallButtonPressed={(call) => {}}
/>
```

### CometChatOngoingCall

In-call UI — tiles, controls, mute, end-call. **Parent-controlled — NOT auto-mounted.** Mount when `CometChatUIEventHandler.addCallListener`'s `ccShowOngoingCall` event fires (kit emits this after `acceptCall` succeeds OR when the caller's outgoing call is accepted by the peer). Full wiring in `cometchat-native-features` §3d.

```tsx
<CometChatOngoingCall
  sessionID={session.sessionId}
  callSettingsBuilder={callSettingsBuilder}   // REQUIRED — a CometChatCalls.CallSettingsBuilder
/>
```

### CometChatCallLogs

Scrollable call history.

```tsx
<CometChatCallLogs
  callLogRequestBuilder={/* CallLogRequest builder from calls-sdk */}
  onItemPress={(callLog) => openCallDetails(callLog)}
/>
```

### CometChatMeetCallBubble

Call-event message bubble. Auto-picked up by the message list — you don't render it manually.

**Wiring**: requires `CallingExtension` to be initialized before `CometChatUIKit.init` (handled by the calls-sdk auto-init), and `<CometChatIncomingCall>` mounted at the app root. See `cometchat-native-features` § Calls.

---

## 4. AI

### CometChatAIAssistantChatHistory

AI assistant conversation history UI.

```tsx
<CometChatAIAssistantChatHistory
  user={loggedInUser}
  onMessageClicked={(message) => openChat(message)}
  onNewChatButtonClick={() => startNewChat()}
/>
```

Separate dashboard setup required to enable AI agents. See `cometchat-native-features` § AI agent.

---

## 5. Search

### CometChatSearch

Full-featured search across conversations + messages + users + groups. Scoped to a user/group when passed a target.

```tsx
<CometChatSearch
  uid={selectedUser?.getUid()}      // optional — scope to one user's chat
  guid={selectedGroup?.getGuid()}   // optional — scope to one group
  onBack={() => setShowSearch(false)}
  onConversationClicked={(conv, searchKeyword) => openConversation(conv)}
  onMessageClicked={(msg, searchKeyword) => scrollToMessage(msg)}
/>
```

Key props: `uid` / `guid` (scope), `searchKeyword`, `onBack`, `onConversationClicked` (`(conversation, searchKeyword?) => void`), `onMessageClicked` (`(message, searchKeyword?) => void`), `searchIn` (`CometChatSearchScope[]` — controls which categories are searched; there are no per-category `hide*` flags or `onUserPress` / `onGroupPress` callbacks), `style`.

Mount it from your own UI (e.g. a search button in your screen's app bar) — `CometChatMessageHeader` does not expose a search callback.

> **Hard rule — never roll your own search.** Any request involving
> "search", "find messages", "search conversations", or "search across
> conversations" MUST use `<CometChatSearch>` (or `hideSearch={false}`
> on `CometChatConversations` for a basic name filter). Do NOT build
> custom `TextInput` search bars, hand-rolled result lists, or filter
> UIs — they bypass the SDK's pagination, highlighting, and dual-scope
> matching that ship with the built-in component.

---

## 6. Notifications

### CometChatNotificationFeed

In-app notification feed UI — a full-screen, scrollable list of campaign/promotional notifications, each rendered as a native card (via `@cometchat/cards-react-native`). Handles fetching, pagination (infinite scroll), category filter chips, timestamp grouping, real-time WebSocket updates, pull-to-refresh, and read/delivered/engagement reporting automatically.

> **NOT push configuration.** This renders the in-app feed of received notifications. It does NOT set up push delivery (FCM/APNs token registration, dashboard providers, background wake). For that, see `cometchat-native-push`.

```tsx
<CometChatNotificationFeed
  showBackButton={true}
  onBackPress={() => navigation.goBack()}
  onItemClick={(item) => openDetail(item)}
  onActionClick={(item, action) => {
    const { type, params, elementId } = action; // e.g. type "openUrl" → params.url
  }}
  notificationFeedRequestBuilder={
    new CometChat.NotificationFeedRequestBuilder().setLimit(30).build()
  }
/>
```

Drop it into a screen/navigation destination — it manages its own data, state, and listeners; you only handle navigation callbacks. Renders with zero props (`<CometChatNotificationFeed />`) given an initialized SDK + logged-in user.

Key props: `title` (default `"Notifications"`), `showHeader` (default `true`), `showBackButton` (default `false`), `showFilterChips` (default `true`), `scrollToItemId` (deep-link to one item), `notificationFeedRequestBuilder` (`CometChat.NotificationFeedRequestBuilder`), `notificationCategoriesRequestBuilder` (`CometChat.NotificationCategoriesRequestBuilder`), `onItemClick` (`(feedItem) => void`), `onActionClick` (`(feedItem, action: { type, params, elementId }) => void`), `onError` (`(error: CometChat.CometChatException) => void`), `onBackPress` (`() => void`), `cardThemeMode` (`"auto" | "light" | "dark"`, default `"auto"`), `cardThemeOverride`, `style`. Slot views are `HeaderView` / `EmptyView` / `ErrorView` / `LoadingView` (each `() => JSX.Element`).

---

## 7. Atoms (primitives for custom composition)

Building blocks the higher-level components use internally. Use inside `<Slot>View` overrides or custom screens.

| Component | Purpose |
|---|---|
| `CometChatAvatar` | Circular / rounded avatar. `image`, `name` (initials fallback), `backgroundColor`, `size` |
| `CometChatBadge` | Small pill badge — unread count, typing indicator, labels |
| `CometChatStatusIndicator` | Online/offline dot. `status`, `borderColor` |
| `CometChatListItem` | Standard row — leading view + title/subtitle + trailing view |
| `CometChatDate` | Relative-time date pill. `timestamp`, `pattern` |
| `CometChatBottomSheet` | Modal sheet from bottom. Imperative `show()` / `hide()` via ref |
| `CometChatActionSheet` | iOS-style action-sheet list |
| `CometChatConfirmDialog` | Standard confirm / cancel dialog |
| `CometChatReportDialog` | Report-user dialog |
| `CometChatEmojiKeyboard` | Full emoji picker |
| `CometChatMediaRecorder` | Voice-note recorder UI |
| `CometChatInlineAudioRecorder` | Inline variant used inside the composer |
| `CometChatReactions` | Reaction-bar UI |
| `CometChatReactionList` | Full reaction-list popup |
| `CometChatQuickReactions` | Quick reactions prompt (long-press) |
| `CometChatMessagePreview` | Reply-quote preview in the composer |

All atoms take `style={}` in the same nested-object shape.

---

## 8. Bubbles

The message list renders bubbles automatically based on message type. Use them directly only when you need a custom bubble template.

| Bubble | Renders |
|---|---|
| `CometChatTextBubble` | Text messages |
| `CometChatImageBubble` | Image messages |
| `CometChatAudioBubble` | Audio clip messages |
| `CometChatVideoBubble` | Video messages |
| `CometChatFileBubble` | File attachments |
| `CometChatMeetCallBubble` | Call event marker (auto) |

Extension-provided bubbles (only present if the extension is registered):

| Bubble | Extension |
|---|---|
| `CometChatStickerBubble` | Stickers |
| `LinkPreviewBubble` | Link previews |
| `MessageTranslationBubble` | Translation inline |
| `CometChatCollaborativeDocumentBubble` | Collab doc |
| `CometChatCollaborativeWhiteBoardBubble` | Collab whiteboard |

---

## 9. Formatters (custom text rendering)

Pass via `CometChatMessageList.textFormatters` or the composer's same prop.

| Formatter | Transforms |
|---|---|
| `CometChatMentionsFormatter` | `@uid` → linked mention bubble |
| `CometChatUrlsFormatter` | URLs → tappable links |
| `CometChatRichTextFormatter` | Markdown-ish `**bold**`, `*italic*`, `__underline__`, inline code |
| `CometChatTextFormatter` | Base class — extend for custom formatters |

```tsx
<CometChatMessageList
  user={selectedUser}
  textFormatters={[
    new CometChatMentionsFormatter(),
    new CometChatUrlsFormatter(),
    new CometChatRichTextFormatter(),
  ]}
/>
```

See `cometchat-native-customization` for the `extends CometChatTextFormatter` recipe.

---

## 10. Infrastructure (static classes + event bus)

### CometChatUIKit

Static class — init + login + logout + send.

| Method | Purpose |
|---|---|
| `CometChatUIKit.init(settings)` | Initialize. Must resolve before any component renders. |
| `CometChatUIKit.login({ uid })` | Log in (dev mode). **Takes an object**, not `login("...")`. |
| `CometChatUIKit.login({ authToken })` | Log in with a server-minted token (production). Same method as dev, different arg. |
| `CometChatUIKit.getLoggedInUser()` | Returns the current `CometChat.User` (Promise). **Throws `code: "NOT_FOUND"` when there is no session** — wrap in try/catch (see core §2). |
| `CometChatUIKit.logout()` | Log out + clear session. |
| `CometChatUIKit.sendCustomMessage(msg)` | Send custom message (used by calling, extensions). |
| `CometChatUIKit.uiKitSettings` | Read back the settings passed to `init()`. |

### UIKitSettings (flat object passed to `init`)

The v5 RN UI Kit's `init()` takes a flat `UIKitSettings` object — there is **no** `UIKitSettingsBuilder` on RN (that's a web-kit pattern). See `cometchat-native-core` § 1.

### CometChatUIEventHandler

Event bus. Subscribe to UI events emitted by components.

```tsx
import { CometChatUIEventHandler } from "@cometchat/chat-uikit-react-native";

const listenerId = "MY_LISTENER_" + Date.now();

CometChatUIEventHandler.addMessageListener(listenerId, {
  ccMessageSent: ({ message }) => { /* ... */ },
  ccMessageEdited: ({ message }) => { /* ... */ },
  ccMessageDeleted: ({ message }) => { /* ... */ },
});

// Cleanup:
CometChatUIEventHandler.removeMessageListener(listenerId);
```

Also: `addConversationListener`, `addGroupListener`, `addUserListener`, `addCallListener` (all paired with `remove*Listener`).

### CometChatMessageTemplate + CometChatMessageOption

- **`CometChatMessageTemplate`**: register a custom message type. Pass via `templates` prop on `CometChatMessageList`.
- **`CometChatMessageOption`**: override or extend long-press options on a message.

See `cometchat-native-customization` for recipes.

### CometChatSoundManager

```tsx
import { CometChatSoundManager } from "@cometchat/chat-uikit-react-native";
CometChatSoundManager.play("incomingMessage");   // string key; SoundOutput is a static member of CometChatSoundManager, not a named export
```

### DataSource / DataSourceDecorator / MessageDataSource / ExtensionsDataSource / ChatConfigurator

Lower-level extension points for deep customization. `cometchat-native-customization` § Tier 4 covers when to use these instead of props.

---

## 11. Extensions (opt-in)

Extensions add message types + features that are toggled on the app's backend (via `cometchat apply-feature <id>` for boolean extensions and AI features, or via the dashboard for third-party-key extensions like Giphy / Stipop). Each ships its own bubble + composer action. Register via the `extensions` field on `CometChatUIKit.init({ ... })`.

| Extension | Adds |
|---|---|
| `PollsExtension` | `CometChatCreatePoll` composer action + vote-tracking bubble |
| `StickersExtension` | Sticker picker + `CometChatStickerBubble` |
| `LinkPreviewExtension` | `LinkPreviewBubble` for rich link cards |
| `MessageTranslationExtension` | Per-message translate option |
| `CollaborativeDocumentExtension` | Shared-doc composer action + bubble |
| `CollaborativeWhiteboardExtension` | Shared-whiteboard composer action + bubble |
| `ThumbnailGenerationExtension` | Auto-thumbnails for image attachments |

See `cometchat-native-features` for the per-extension recipe — most are pure boolean (`cometchat apply-feature <id>`); the AI ones need `--openai-key sk-...`; Giphy / Stipop / Tenor / Chatwoot / Intercom need third-party config in the dashboard.

---

## 12. Hard rule — `hideReplyInThreadOption` is mandatory on every MessageList

**Every `<CometChatMessageList>` MUST include `hideReplyInThreadOption`** unless the integration also wires a full thread panel (`CometChatThreadHeader` + scoped `CometChatMessageList` with `parentMessageId` + scoped `CometChatMessageComposer` with `parentMessageId`).

The kit's default (`hideReplyInThreadOption: false`) puts a "Reply in Thread" entry in the message action menu that silently does nothing when no panel is wired. In drawer / widget / modal / stack-screen integrations without a thread panel, the option is a dead click.

Every example in this catalog includes the flag for a reason — keep it. The only place you can omit it is inside a full thread-panel composition (see § 2 Threading).

---

## 13. Common prop-finding recipe

When a user's request isn't obviously covered, check in this order before writing custom code:

1. **Named component in this catalog fits?** ("show call history" → `CometChatCallLogs`).
2. **A `hide*` / visibility prop?** ("hide receipts" → `receiptsVisibility={false}`, not custom bubbles).
3. **A `<Slot>View` prop?** ("customize the header title" → `TitleView={({ user, group }) => <MyTitle />}`, not a wholesale header replacement).
4. **A `*RequestBuilder`?** ("filter conversations" → `conversationsRequestBuilder` with `.setUserTags([...])`, not post-render filtering).
5. **`textFormatters` + `templates`** for message-rendering customization.
6. **`CometChatUIEventHandler`** for cross-component communication.
7. **Only then** escalate to `cometchat-native-customization` § Tier 4 (DataSource decorators, ChatConfigurator).

Never hand-roll a bubble, a header, or a list when the kit ships one — you'll miss theming, reactions, typing indicators, receipts, and cross-framework behavior the built-ins handle.

---

## 14. Style shape reference

Every style prop follows a nested-object shape. Pass `style={}` for no customization; override only the keys you care about.

```tsx
<CometChatMessageList
  style={{
    containerStyle: { backgroundColor: "#fff", flex: 1 },
    headerStyle: { titleStyle: { color: "#000" } },
    avatarStyle: { containerStyle: { borderRadius: 8 } },
    dateStyle: { textStyle: { fontSize: 10 } },
  }}
/>
```

Common style keys across components:

- `containerStyle` — outermost wrapper
- `itemStyle` — individual list rows
- `headerStyle`, `titleStyle`, `subtitleStyle`
- `avatarStyle`, `badgeStyle`, `statusIndicatorStyle`
- `bubbleStyle` (message list), `composerStyle` (composer)
- `emptyStateStyle`, `errorStateStyle`, `loadingStateStyle`

Theme-level tokens (`primary`, `textPrimary`, etc.) propagate via `CometChatThemeProvider` — prefer overriding theme tokens for app-wide changes and `style={}` only for per-component tweaks. See `cometchat-native-theming`.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Always read first — init, login, provider chain |
| `cometchat-native-components` | This skill — any time you write `<CometChat*>` JSX |
| `cometchat-native-placement` | Deciding WHERE components go (stack / tabs / modal / sheet) |
| `cometchat-native-customization` | `textFormatters`, `templates`, custom slot views, event bus |
| `cometchat-native-features` | Adding calls, extensions, AI |
| `cometchat-native-theming` | `style={}` not enough — need app-wide color / typography changes |
| `cometchat-native-production` | `login({ authToken })` setup |
| `cometchat-native-troubleshooting` | `<CometChat*>` renders nothing or throws at runtime |
