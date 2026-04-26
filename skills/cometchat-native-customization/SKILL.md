---
name: cometchat-native-customization
description: "Customize the CometChat React Native UI Kit without forking — four-tier model: props → request builders → text formatters + message templates → DataSource decorators + event bus."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native customization formatters events datasource templates"
---

## Purpose

Teaches Claude how to change the behavior or appearance of the React Native UI Kit **without modifying the kit itself**. Four tiers, from cheapest to deepest:

```
Tier 1 — Props            (95% of asks solved here)
Tier 2 — RequestBuilder   (filter what data loads)
Tier 3 — Formatters + Templates   (change how text / messages render)
Tier 4 — DataSource decorators + Events  (last resort, powerful)
```

**Always try Tier 1 first.** Escalate only when the tier can't do what the user wants.

**Read `cometchat-native-components` first** — the catalog is the source of truth for prop names, slot views, and event listener names that this skill builds on.

Ground truth: `docs/ui-kit/react-native/custom-text-formatter-guide.mdx`, `mentions-formatter-guide.mdx`, `shortcut-formatter-guide.mdx`, `url-formatter-guide.mdx`, `events.mdx`, `methods.mdx`, `property-changes.mdx`, and the kit's source at `packages/ChatUiKit/src/shared/formatters/` and `packages/ChatUiKit/src/shared/events/`.

---

## Four-tier triage — pick the right tier before writing any code

When a user says "I want X" for a CometChat component:

| If they want to... | Use Tier | Cost |
|---|---|---|
| Hide a feature (thread option, receipts, edit, etc.) | Tier 1 — `hide*` / `*Visibility` props | 1 line of JSX |
| Customize a subsection (header title, subtitle, avatar, empty state) | Tier 1 — `<Slot>View` prop | 1 component |
| Filter what loads (only show online users, exclude blocked, include tags) | Tier 2 — `*RequestBuilder` | 1 builder |
| Change how URLs / mentions / hashtags / emojis render inline | Tier 3 — `textFormatters` | Subclass of `CometChatTextFormatter` |
| Render a custom message type (custom bubble, custom interactive msg) | Tier 3 — `templates` + `CometChatMessageTemplate` | 1 template + 1 renderer |
| React to events from another component ("they deleted a message, now reload my view") | Tier 4 — `CometChatUIEventHandler` | Listener |
| Rewrite how data flows through the kit (custom conversation sorting, override user-fetch logic) | Tier 4 — `DataSourceDecorator` | Class extension |

If a user's ask fits Tier 1 but you jumped to Tier 3, you've written 50 lines that a 1-line prop could have replaced. Start low.

---

## Tier 1 — Props (hide / slot views / styles)

`cometchat-native-components` is the full catalog. Three prop families cover most customization:

### 1a. `hide*` / `*Visibility` flags

Turn features off with a single prop:

```tsx
<CometChatMessageList
  user={selectedUser}
  hideReplyInThreadOption     // already mandatory — see components § 11
  hideReceipts
  hideReactions={false}
  hideTranslateMessageOption
  hideMessagePrivatelyOption
  hideReplyOption={false}
/>
```

Full list of `hide*` props per component: `cometchat-native-components`. Check there before writing custom code.

### 1b. `<Slot>View` props — replace a section

Every component has PascalCase slot props for replacing named sections of its default UI:

```tsx
<CometChatMessageHeader
  user={selectedUser}
  TitleView={(user, group) => <Text style={styles.customTitle}>{user?.getName()}</Text>}
  SubtitleView={(user, group) => <OnlineStatus user={user} />}
  LeadingView={(user, group) => <CustomAvatar user={user} />}
  TrailingView={(user, group) => <CustomActions user={user} />}
  AuxiliaryButtonView={(user, group) => <CometChatCallButtons user={user} group={group} />}
/>
```

Slot functions receive the same data the default view would have (typically `user`, `group`, or a single entity). They return RN JSX.

**For custom views that should match the theme**, use `useTheme()`:

```tsx
import { useTheme } from "@cometchat/chat-uikit-react-native";

function CustomTitle({ user }: any) {
  const theme = useTheme();
  return (
    <Text style={{
      color: theme.color.textPrimary,
      fontFamily: theme.typography.heading3.fontFamily,
      fontSize: theme.typography.heading3.fontSize,
    }}>
      {user?.getName()}
    </Text>
  );
}
```

See `cometchat-native-theming` § 8 for more on `useTheme()`.

### 1c. `style={{ ... }}` prop — nested styling

Each component accepts a nested-object `style` prop (see `cometchat-native-components` § 13):

```tsx
<CometChatConversations
  style={{
    containerStyle: { backgroundColor: "#FAFAFA" },
    itemStyle: {
      avatarStyle: { containerStyle: { borderRadius: 8 } },
    },
  }}
/>
```

Prefer theme-level changes (via `cometchat-native-theming`) for app-wide color shifts; use `style={{}}` only for one-off overrides on a single component instance.

---

## Tier 2 — RequestBuilder filtering

For "I want to show a subset of X", use the matching `*RequestBuilder`. Never post-filter in-render.

```tsx
import { CometChat } from "@cometchat/chat-sdk-react-native";

// Only conversations in a specific tag group
<CometChatConversations
  conversationsRequestBuilder={
    new CometChat.ConversationsRequestBuilder()
      .setLimit(20)
      .setUserTags(["premium"])
      .setConversationType(CometChat.RECEIVER_TYPE.USER)
  }
/>

// Only online users, exclude blocked
<CometChatUsers
  usersRequestBuilder={
    new CometChat.UsersRequestBuilder()
      .setLimit(30)
      .setStatus("online")
      .setSearchKeyword("")
      .friendsOnly(false)
  }
/>

// Only groups you've joined
<CometChatGroups
  groupsRequestBuilder={
    new CometChat.GroupsRequestBuilder()
      .setLimit(30)
      .joinedOnly(true)
  }
/>

// Message list — exclude system messages
<CometChatMessageList
  user={user}
  messageRequestBuilder={
    new CometChat.MessagesRequestBuilder()
      .setUID(user.getUid())
      .setLimit(30)
      .setCategories(["message"])   // exclude "call", "action"
      .hideReplies(false)
  }
  hideReplyInThreadOption
/>
```

Each request builder is chainable. The `@cometchat/chat-sdk-react-native` exports the builder classes — import them from the SDK, not the UI Kit.

### Finding the right method

Request builder methods are documented at `cometchat.com/docs/sdk/react-native` (or query the docs MCP). Common ones:

| Builder | Useful methods |
|---|---|
| `ConversationsRequestBuilder` | `.setLimit(n)`, `.setUserTags([...])`, `.setGroupTags([...])`, `.setConversationType(type)`, `.withTags(true)`, `.withUserAndGroupTags(true)` |
| `UsersRequestBuilder` | `.setLimit(n)`, `.setStatus("online")`, `.setSearchKeyword(str)`, `.friendsOnly(bool)`, `.setTags([...])`, `.setUIDs([...])`, `.hideBlockedUsers(bool)` |
| `GroupsRequestBuilder` | `.setLimit(n)`, `.setSearchKeyword(str)`, `.joinedOnly(bool)`, `.setTags([...])`, `.setGroupTypes([...])` |
| `MessagesRequestBuilder` | `.setUID(uid)` / `.setGUID(guid)`, `.setLimit(n)`, `.setCategories([...])`, `.setTypes([...])`, `.hideReplies(bool)`, `.setTags([...])`, `.setParentMessageId(id)` |
| `GroupMembersRequestBuilder` | `.setLimit(n)`, `.setSearchKeyword(str)`, `.setScopes([...])` |

---

## Tier 3 — Text formatters + message templates

For "change how text or messages render", Tier 3 is the right level. Two sub-patterns:

### 3a. Custom text formatter — inline text patterns

`CometChatTextFormatter` is an abstract base class for matching inline text patterns (hashtags, keywords, emoji shortcodes, custom tags) and replacing them with custom JSX.

```tsx
import {
  CometChatTextFormatter,
  SuggestionItem,
} from "@cometchat/chat-uikit-react-native";
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { Text, View, StyleSheet } from "react-native";

class HashtagFormatter extends CometChatTextFormatter {
  constructor() {
    super();
    this.setTrackingCharacter("#");              // optional — triggers suggestion list
    this.setRegexPatterns([/\B#(\w+)\b/g]);       // all matches get formatted
  }

  // Called for each bubble's text; return string | JSX
  getFormattedText(
    inputText: string | null | React.ReactNode,
  ): string | React.ReactNode {
    if (typeof inputText !== "string") return inputText;
    const parts = inputText.split(/(\B#\w+\b)/g);
    return (
      <Text>
        {parts.map((part, i) =>
          part.match(/^#\w+$/)
            ? <Text key={i} style={styles.hashtag} onPress={() => openHashtag(part)}>{part}</Text>
            : <Text key={i}>{part}</Text>,
        )}
      </Text>
    );
  }

  // Optional — called before a message is sent. Transform the outgoing message.
  handlePreMessageSend(message: CometChat.TextMessage): CometChat.TextMessage {
    // e.g. attach the list of hashtags to the message metadata
    return message;
  }

  // Optional — for suggestion-list support (triggered by `#`)
  search(searchKey: string): void {
    // Fetch matching hashtags from your backend, then:
    // this.setSearchData([{ id: "tag1", title: "#typescript" }]);
  }
}

const styles = StyleSheet.create({
  hashtag: { color: "#2563EB", fontWeight: "600" },
});
```

Register the formatter by passing it to both `CometChatMessageList` and `CometChatMessageComposer`:

```tsx
const formatters = [
  new CometChatMentionsFormatter(),   // keep the built-in ones
  new CometChatUrlsFormatter(),
  new HashtagFormatter(),             // add yours
];

<CometChatMessageList
  user={selectedUser}
  textFormatters={formatters}
  hideReplyInThreadOption
/>
<CometChatMessageComposer
  user={selectedUser}
  textFormatters={formatters}
/>
```

### 3b. Custom message template — entire custom bubble

For rendering a totally custom message type (interactive cards, scheduling, forms), use `CometChatMessageTemplate`.

```tsx
import {
  CometChatMessageTemplate,
  CometChatUiKitConstants,
} from "@cometchat/chat-uikit-react-native";

const pollTemplate = new CometChatMessageTemplate({
  type: "poll",
  category: CometChatUiKitConstants.MessageCategoryConstants.custom,
  ContentView: (message, alignment) => (
    <PollBubble message={message} alignment={alignment} />
  ),
  BottomView: (message, alignment) => (
    <PollVoteCounts message={message} />
  ),
  options: (loggedInUser, message, group) => [
    /* CometChatMessageOption[] — custom long-press menu items */
  ],
});

<CometChatMessageList
  user={selectedUser}
  templates={[pollTemplate, ...defaultTemplates]}   // merge with defaults
  hideReplyInThreadOption
/>
```

Getting the default templates to merge with:

```tsx
import { ChatConfigurator } from "@cometchat/chat-uikit-react-native";
const defaults = ChatConfigurator.getDataSource().getAllMessageTemplates();
<CometChatMessageList templates={[pollTemplate, ...defaults]} />
```

### When to use text formatter vs message template

| Use formatter (Tier 3a) | Use template (Tier 3b) |
|---|---|
| Change how TEXT inside a bubble renders (hashtags, URLs, mentions, emoji shortcodes) | Render a completely different bubble body |
| Content is still a `TextMessage` | Content is a custom message type (sent via `CometChat.sendCustomMessage`) |
| Doesn't need its own long-press options | Needs custom message options (vote, claim, accept, etc.) |

---

## Tier 4 — DataSource decorators + event bus

When Tiers 1-3 can't do it, you're modifying how data flows through the UI Kit. Two mechanisms:

### 4a. Event bus — `CometChatUIEventHandler`

Subscribe to events that UI Kit components emit so your own code can react.

```tsx
import { CometChatUIEventHandler } from "@cometchat/chat-uikit-react-native";
import { useEffect } from "react";

function AppScreen() {
  useEffect(() => {
    const listenerId = "APP_MESSAGE_LISTENER";

    CometChatUIEventHandler.addMessageListener(listenerId, {
      ccMessageSent: ({ message, status }) => {
        // status === "inProgress" | "sent"
        analytics.track("message_sent", { id: message.getId() });
      },
      ccMessageEdited: ({ message }) => { /* ... */ },
      ccMessageDeleted: ({ message }) => { /* ... */ },
      ccMessageRead: ({ message }) => { /* ... */ },
      ccLiveReaction: ({ reaction }) => { /* ... */ },
    });

    return () => CometChatUIEventHandler.removeMessageListener(listenerId);
  }, []);

  return /* ... */;
}
```

### Event listener API reference

| Listener | Use when... |
|---|---|
| `addMessageListener` | reacting to any message-related event (sent, edited, deleted, read, reactions) |
| `addConversationListener` | reacting to conversation-level events (`ccConversationDeleted`, `ccUpdateConversation`) |
| `addUserListener` | reacting to user actions (`ccUserBlocked`, `ccUserUnblocked`) |
| `addGroupListener` | reacting to group lifecycle (`ccGroupCreated`, `ccGroupDeleted`, `ccGroupLeft`, `ccGroupMemberScopeChanged`, `ccGroupMemberKicked`, `ccGroupMemberBanned`, `ccGroupMemberJoined`, `ccGroupMemberAdded`, `ccOwnershipChanged`, etc.) |
| `addCallListener` | reacting to call events (`onIncomingCallAccepted`, `onCallEnded`, `onCallInitiated`, etc.) |

Every pair has a matching `remove*Listener(id)` — **always call it in the cleanup of your `useEffect`** to avoid duplicate listeners on re-render.

**Listener ID uniqueness matters.** Use a constant per component/feature. Colliding IDs cause only the latest-registered listener to fire.

### 4b. DataSource decorators

`DataSourceDecorator` and `MessageDataSource` wrap the kit's internal data source to override specific methods without forking the whole kit.

When to reach for this: overriding how user data is fetched, how conversations are sorted, adding custom message metadata to every sent message, intercepting attachment uploads.

Minimum pattern:

```tsx
import {
  DataSource,
  DataSourceDecorator,
  ChatConfigurator,
} from "@cometchat/chat-uikit-react-native";

class MyDataSource extends DataSourceDecorator {
  constructor(source: DataSource) {
    super(source);
  }

  // Override only the method you want to change
  getConversationsRequestBuilder() {
    const builder = super.getConversationsRequestBuilder();
    builder.setUserAndGroupTags(true);
    return builder;
  }

  getMessageTemplate() {
    const defaults = super.getMessageTemplate();
    return [myCustomTemplate, ...defaults];
  }
}

// Register the decorator before init — wraps the default data source
ChatConfigurator.dataSource = new MyDataSource(ChatConfigurator.getDataSource());
await CometChatUIKit.init(settings);
```

**This is an escape hatch, not a first tool.** If you find yourself reaching for Tier 4, re-check whether Tier 1 (props) or Tier 3 (templates) could have solved it. Templates + slot views cover most "custom behavior" asks.

### 4c. Extensions datasource (for extension-like deep behavior)

`ExtensionsDataSource` is the base class for registering an extension-shaped chunk of behavior (its own composer action + its own bubble + its own data handling) — this is what `PollsExtension`, `StickersExtension`, etc. extend internally. You'd only subclass this if you're shipping a reusable feature module across apps.

For a single app, use `DataSourceDecorator` instead.

---

## 5. Sample app reference (when Tiers 1–4 don't have what you need)

If none of Tiers 1–4 covered the user's request, **don't immediately conclude they need custom code**. The RN UI Kit ships two reference sample apps that compose multiple kit components into common chat UX patterns that aren't shipped as named exports:

> Bare RN: https://github.com/cometchat/cometchat-uikit-react-native/tree/v5/examples/SampleApp
>
> Expo:    https://github.com/cometchat/cometchat-uikit-react-native/tree/v5/examples/SampleAppExpo

(Use the branch matching your installed UI-Kit major version — confirm via `package.json`. If the user is on v5, use `v5`; for v6 use `v6`. The folder layout is identical between the two flavors — `src/components`, `src/screens`, `src/utils` — so the same lookup table works for both.)

Examples that look like "missing components" but are in the sample app:

| User asks for | Sample app reference path |
|---|---|
| User / group details screen | `examples/SampleApp(Expo)/src/components/CometChatDetails/` (`CometChatUserDetails.tsx` + group-details inline in the home screen) |
| Threaded messages screen layout | `examples/SampleApp(Expo)/src/components/CometChatDetails/CometChatThreadedMessages.tsx` |
| Top-level chat shell (tabs + screens + drawer) | `examples/SampleApp(Expo)/src/components/CometChatHome/` + `App.tsx` |
| Multi-tab chat (Chats / Calls / Users / Groups) | `examples/SampleApp(Expo)/src/components/CometChatTabs/` |
| New conversation modal with user/group picker | `examples/SampleApp(Expo)/src/components/CometChatNewChat/` |
| Search screen (conversations + messages) | `examples/SampleApp(Expo)/src/components/CometChatSearch/` |
| Call log details / history / recordings | `examples/SampleApp(Expo)/src/components/CometChatCallLog/` |
| App-state / active-chat React context | `examples/SampleApp(Expo)/src/context/AppContext.tsx` |

**Discovery commands (works against either repo flavor):**

```bash
# List the sample app's components directory via the GitHub API (bare RN)
curl -s "https://api.github.com/repos/cometchat/cometchat-uikit-react-native/contents/examples/SampleApp/src/components?ref=v5" \
  | grep -oE '"name":\s*"[^"]+"' | head -30

# Same, for Expo
curl -s "https://api.github.com/repos/cometchat/cometchat-uikit-react-native/contents/examples/SampleAppExpo/src/components?ref=v5" \
  | grep -oE '"name":\s*"[^"]+"' | head -30

# Fetch a specific component file directly
curl -s "https://raw.githubusercontent.com/cometchat/cometchat-uikit-react-native/v5/examples/SampleApp/src/components/CometChatDetails/CometChatUserDetails.tsx"
```

You can also use `WebFetch` on the URLs above. The docs MCP does NOT index the sample apps — fetch them from GitHub directly.

**If you find a matching reference implementation:**

1. Read the `.tsx` file. Note: RN sample-app components use `StyleSheet.create({...})` blocks colocated in the same file (no separate stylesheet file like the web sample app — RN doesn't have CSS).
2. Mirror the sample's file/folder structure in the user's project, e.g. `src/cometchat/CometChatDetails/CometChatUserDetails.tsx`. Don't rename, don't simplify the structure — match it exactly so future patches against the sample apply cleanly.
3. Adapt navigation: SampleApp uses React Navigation; if the user is on Expo Router, swap `navigation.navigate(...)` → `router.push(...)` and `useRoute()` → `useLocalSearchParams()`. Everything else carries over.
4. The kit's `useTheme()` hook works identically inside copied sample components — keep the calls intact rather than hardcoding colors.

---

## 6. Recipes (common customization asks → right tier)

### "Filter the conversation list to just premium users"
**Tier 2** — `conversationsRequestBuilder` with `.setUserTags(["premium"])`.

### "Custom empty state for the users list"
**Tier 1** — `EmptyStateView` slot prop on `CometChatUsers`.

### "Custom message bubble for incoming messages only"
**Tier 3b** — `CometChatMessageTemplate` with a `ContentView` that branches on `alignment === "receive"`. Or simpler — **Tier 1** `messageListStyles.receiveBubbleStyle` in the theme (see `cometchat-native-theming` § 6).

### "Show a custom view when the user types @"
**Tier 3a** — subclass `CometChatMentionsFormatter` (or extend `CometChatTextFormatter`), implement `search(key)` + `setSearchData([...])` with your own suggestion source.

### "When a message is sent, log it to our analytics"
**Tier 4a** — `CometChatUIEventHandler.addMessageListener` with `ccMessageSent` handler.

### "When a group is deleted, remove it from my local cache + navigate away"
**Tier 4a** — `addGroupListener` with `ccGroupDeleted` handler.

### "Render custom avatars for all users based on their department"
**Tier 1** — `LeadingView` slot on `CometChatConversations` + `CometChatUsers` + `CometChatMessageHeader`.

### "Disable the file attachment option"
**Tier 1** — filter the `attachmentOptions` prop on `CometChatMessageComposer`:

```tsx
<CometChatMessageComposer
  user={user}
  attachmentOptions={(user, group) => {
    const defaults = /* default actions from ChatConfigurator */;
    return defaults.filter((opt) => opt.id !== "attachment-file");
  }}
/>
```

### "Show only message types that contain the word 'urgent'"
**Tier 2** — `messageRequestBuilder` with `.setSearchKeyword("urgent")`.

### "Custom message type: a 'ping' message"
**Tier 3b** — create a `CometChatMessageTemplate` with `category: "custom"` + `type: "ping"`, render a custom `ContentView`, send via `CometChat.sendCustomMessage`.

### "Completely replace the kit's conversation-loading logic"
**Tier 4b** — `DataSourceDecorator` overriding `getConversationsRequestBuilder()` + possibly wrapping the fetch itself. Rare. Try Tier 2 first.

---

## 6. Anti-patterns

1. **Don't hand-roll a bubble when a template will do.** `CometChatMessageTemplate` (Tier 3b) gives you full control over rendering + options without losing theming, reactions, typing, receipts.

2. **Don't post-filter a list's data after render.** If you want "only online users," use Tier 2 `usersRequestBuilder.setStatus("online")` — don't fetch everyone then hide rows.

3. **Don't forget to remove listeners in `useEffect` cleanup.** RN re-renders on every navigation can register duplicate listeners; each fires your handler once per registration.

4. **Don't collide listener IDs.** Use `APP_MESSAGE_LISTENER` or `${componentName}_MESSAGE_LISTENER` — constant, unique. Colliding IDs silently drop earlier registrations.

5. **Don't put `CometChatTextFormatter` instances in component state.** Construct them once at module scope (or in a `useMemo`); re-creating them on every render loses the internal suggestion state.

6. **Don't fork or patch `@cometchat/chat-uikit-react-native` directly.** Every customization should be possible via Tiers 1-4. Forking breaks on kit upgrades.

7. **Don't reach for Tier 4 before trying 1-3.** DataSource decorators are powerful but fragile to kit internal changes. Props, request builders, and templates are stable surface area.

8. **Don't change component behavior via monkey-patching (e.g., `Component.defaultProps = ...`).** Use the actual prop API. Monkey-patching is broken by design in React 19+.

---

## 7. Wiring a custom formatter end-to-end (full working example)

Say the user wants `:emoji:` shortcodes (e.g., `:smile:` → 😀):

```tsx
// 1. Define the formatter — module scope, constructed once
import { CometChatTextFormatter } from "@cometchat/chat-uikit-react-native";
import { Text } from "react-native";

const EMOJI_MAP: Record<string, string> = {
  ":smile:": "😀", ":heart:": "❤️", ":thumbsup:": "👍", ":fire:": "🔥",
};

class EmojiShortcodeFormatter extends CometChatTextFormatter {
  constructor() {
    super();
    this.setRegexPatterns([/:[a-z_]+:/g]);
  }

  getFormattedText(input: string | null | React.ReactNode) {
    if (typeof input !== "string") return input;
    const parts = input.split(/(:[a-z_]+:)/g);
    return (
      <Text>
        {parts.map((p, i) =>
          EMOJI_MAP[p] ? <Text key={i}>{EMOJI_MAP[p]}</Text> : <Text key={i}>{p}</Text>,
        )}
      </Text>
    );
  }
}

// 2. Build the formatters array at module scope
import { CometChatMentionsFormatter, CometChatUrlsFormatter } from "@cometchat/chat-uikit-react-native";
export const TEXT_FORMATTERS = [
  new CometChatMentionsFormatter(),
  new CometChatUrlsFormatter(),
  new EmojiShortcodeFormatter(),
];

// 3. Wire into list + composer (same array — must match)
import { TEXT_FORMATTERS } from "./formatters";
<CometChatMessageList user={user} textFormatters={TEXT_FORMATTERS} hideReplyInThreadOption />
<CometChatMessageComposer user={user} textFormatters={TEXT_FORMATTERS} />
```

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-native-core` | Init / login / provider chain |
| `cometchat-native-components` | Prop reference — which `hide*`, `<Slot>View`, `*RequestBuilder` is available (prerequisite for Tiers 1–2) |
| `cometchat-native-placement` | Where to put the customized components |
| `cometchat-native-theming` | App-wide color / typography / dark mode — Tier 1 alternative to `style={{}}` |
| `cometchat-native-features` | Which out-of-the-box features exist (so you know what needs customizing vs. what's already there) |
| `cometchat-native-customization` | This skill — four-tier triage + custom formatters / templates / DataSource / events |
| `cometchat-native-production` | When customization depends on production auth (token refresh, user-ID mapping) |
| `cometchat-native-troubleshooting` | Formatter doesn't apply, listener fires twice, slot view renders nothing, template not showing |
