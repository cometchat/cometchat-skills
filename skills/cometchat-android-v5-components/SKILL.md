---
name: cometchat-android-v5-components
description: "Complete catalog of CometChat Android UI Kit v5 components. Reference before writing integration code — never invent component names."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat android components catalog reference ui-kit views"
---

> **Companion skills:** `cometchat-android-v5-core` covers initialization and login;
> `cometchat-android-v5-placement` covers where to put these components;
> `cometchat-android-v5-customization` covers how to modify component behavior.

## Purpose

This is the single source of truth for CometChat Android UI Kit v5 component names, key methods, and usage. **Check this catalog before writing any CometChat view code.** If a component is not listed here, it does not exist in the UI Kit.

All components extend `MaterialCardView` and can be used in XML layouts or created programmatically. They follow a consistent pattern: set a `User` or `Group` object, configure visibility/style via setters, and attach callbacks for user interactions.


---

## Use this skill when

- Writing code that uses any `CometChat*` view
- Looking up component names, methods, or XML attributes
- Composing multiple components together (e.g., message header + list + composer)
- "What components does CometChat have?"
- "How do I use CometChatConversations?"

## Do not use this skill when

- Setting up init/login → use `cometchat-android-v5-core`
- Customizing themes/colors → use `cometchat-android-v5-theming`
- Writing custom message templates → use `cometchat-android-v5-customization`

---

## 1. Core messaging components

These are the components you use to build a chat experience. Most integrations use some combination of these.

### CometChatConversations

Renders a scrollable list of the logged-in user's conversations (both 1:1 and group).

**Key methods:**

| Method | Type | Description |
|---|---|---|
| `setOnItemClick(OnItemClick<Conversation>)` | Callback | Called when user taps a conversation |
| `setSelectionMode(UIKitConstants.SelectionMode)` | Config | `NONE`, `SINGLE`, `MULTIPLE` |
| `setSearchBoxVisibility(int)` | Visibility | Show/hide the search bar |
| `setUserStatusVisibility(int)` | Visibility | Show/hide online status indicators |
| `setReceiptsVisibility(int)` | Visibility | Show/hide read receipts |
| `setDeleteConversationOptionVisibility(int)` | Visibility | Show/hide delete option on swipe |
| `setBackIconVisibility(int)` | Visibility | Show/hide back button |
| `setOnError(OnError)` | Callback | Error handler |
| `setOnLoad(OnLoad<Conversation>)` | Callback | Called when conversations are loaded |
| `setOnEmpty(OnEmpty)` | Callback | Called when list is empty |

**XML usage:**
```xml
<com.cometchat.chatuikit.conversations.CometChatConversations
    android:id="@+id/conversations"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

**Java:**
```java
CometChatConversations conversations = findViewById(R.id.conversations);
conversations.setOnItemClick((view, position, conversation) -> {
    // Navigate to message screen with conversation.getConversationWith()
});
```

**Kotlin:**
```kotlin
val conversations = findViewById<CometChatConversations>(R.id.conversations)
conversations.setOnItemClick { view, position, conversation ->
    // Navigate to message screen with conversation.conversationWith
}
```

---

### CometChatMessageList

Renders messages for a specific user or group conversation. The main chat area.

**Key methods:**

| Method | Type | Description |
|---|---|---|
| `setUser(User)` | Config | Show messages with this user (mutually exclusive with `setGroup`) |
| `setGroup(Group)` | Config | Show messages in this group (mutually exclusive with `setUser`) |
| `setParentMessage(long)` | Config | If set, shows only thread replies (note: list takes the parent ID as `long` via `setParentMessage`, NOT `setParentMessageId`) |
| `setOnThreadRepliesClick(ThreadReplyClick)` | Callback | Called when "Reply in Thread" is tapped |
| `setOnError(OnError)` | Callback | Error handler |
| `setOnLoad(OnLoad<BaseMessage>)` | Callback | Called when messages are loaded |
| `setReplyInThreadOptionVisibility(int)` | Visibility | Show/hide thread reply option |
| `setReplyOptionVisibility(int)` | Visibility | Show/hide reply option |
| `setCopyMessageOptionVisibility(int)` | Visibility | Show/hide copy option |
| `setEditMessageOptionVisibility(int)` | Visibility | Show/hide edit option |
| `setDeleteMessageOptionVisibility(int)` | Visibility | Show/hide delete option |
| `setReceiptsVisibility(int)` | Visibility | Show/hide read receipts |
| `setAvatarVisibility(int)` | Visibility | Show/hide sender avatars |
| `setTextFormatters(List<CometChatTextFormatter>)` | Config | Custom text formatters |
| `setTemplates(List<CometChatMessageTemplate>)` | Config | Custom message bubble templates |

**Java:**
```java
CometChatMessageList messageList = findViewById(R.id.messageList);
messageList.setUser(user);  // or messageList.setGroup(group);
```

**Kotlin:**
```kotlin
val messageList = findViewById<CometChatMessageList>(R.id.messageList)
messageList.setUser(user)  // or messageList.setGroup(group)
```

---

### CometChatMessageComposer

A text input with send button, attachment options, emoji, and voice note support. Sends messages to the specified user or group.

**Key methods:**

| Method | Type | Description |
|---|---|---|
| `setUser(User)` | Config | Send messages to this user |
| `setGroup(Group)` | Config | Send messages to this group |
| `setParentMessageId(long)` | Config | Thread mode — sends replies to this message |
| `setOnSendButtonClick(SendButtonClick)` | Callback | Custom send button handler |
| `setOnError(OnError)` | Callback | Error handler |
| `setAttachmentButtonVisibility(int)` | Visibility | Show/hide attachment button |
| `setVoiceNoteButtonVisibility(int)` | Visibility | Show/hide voice note button |
| `setSendButtonVisibility(int)` | Visibility | Show/hide send button |
| `setHeaderView(View)` | Custom view | Custom view above the composer |
| `setFooterView(View)` | Custom view | Custom view below the composer |
| `setAuxiliaryButtonView(View)` | Custom view | Custom auxiliary button (takes a plain `View`) |
| `disableTypingEvents(boolean)` | Config | Disable typing indicators (note: no `set` prefix) |
| `setDisableMentions(boolean)` | Config | Disable @mentions |

**Java:**
```java
CometChatMessageComposer composer = findViewById(R.id.composer);
composer.setUser(user);  // or composer.setGroup(group);
```

**Kotlin:**
```kotlin
val composer = findViewById<CometChatMessageComposer>(R.id.composer)
composer.setUser(user)  // or composer.setGroup(group)
```

---

### CometChatMessageHeader

Displays the name, avatar, and status of the user or group at the top of a message view.

**Key methods:**

| Method | Type | Description |
|---|---|---|
| `setUser(User)` | Config | Show header for this user |
| `setGroup(Group)` | Config | Show header for this group |
| `setBackIconVisibility(int)` | Visibility | Show/hide back button |
| `setOnBackPress(OnBackPress)` | Callback | Back button handler |
| `setUserStatusVisibility(int)` | Visibility | Show/hide online status |
| `setVideoCallButtonVisibility(int)` | Visibility | Show/hide video call button |
| `setVoiceCallButtonVisibility(int)` | Visibility | Show/hide voice call button |
| `setSubtitleView(Function3)` | Custom view | Custom subtitle view |
| `setTrailingView(Function3)` | Custom view | Custom trailing view |
| `setLeadingView(Function3)` | Custom view | Custom leading view |

**Java:**
```java
CometChatMessageHeader header = findViewById(R.id.header);
header.setUser(user);
header.setBackIconVisibility(View.VISIBLE);
header.setOnBackPress(() -> finish());
```

**Kotlin:**
```kotlin
val header = findViewById<CometChatMessageHeader>(R.id.header)
header.setUser(user)
header.setBackIconVisibility(View.VISIBLE)
header.setOnBackPress { finish() }
```

---

## 2. List components

### CometChatUsers

Renders a scrollable list of users with alphabetical sticky headers.

**Key methods:**

| Method | Type | Description |
|---|---|---|
| `setOnItemClick(OnItemClick<User>)` | Callback | Called when user taps a user |
| `setSelectionMode(UIKitConstants.SelectionMode)` | Config | `NONE`, `SINGLE`, `MULTIPLE` |
| `setSearchBoxVisibility(int)` | Visibility | Show/hide search bar |
| `setUserStatusVisibility(int)` | Visibility | Show/hide online status |
| `setOnSelection(OnSelection<User>)` | Callback | Called when selection changes |

### CometChatGroups

Renders a scrollable list of groups.

**Key methods:**

| Method | Type | Description |
|---|---|---|
| `setOnItemClick(OnItemClick<Group>)` | Callback | Called when user taps a group |
| `setSelectionMode(UIKitConstants.SelectionMode)` | Config | `NONE`, `SINGLE`, `MULTIPLE` |
| `setSearchBoxVisibility(int)` | Visibility | Show/hide search bar |
| `setOnSelection(OnSelection<Group>)` | Callback | Called when selection changes |

### CometChatGroupMembers

Renders the member list for a specific group.

**Key methods:**

| Method | Type | Description |
|---|---|---|
| `setGroup(Group)` | Config | Required — the group to show members for |
| `setOnItemClick(OnItemClick<GroupMember>)` | Callback | Called when user taps a member |
| `setSelectionMode(UIKitConstants.SelectionMode)` | Config | `NONE`, `SINGLE`, `MULTIPLE` |

---

## 3. Call components

### CometChatCallLogs

Renders a list of past calls with duration, type, and timestamp.

### CometChatIncomingCall

Incoming call notification banner with accept/reject buttons. Typically added to your root Activity layout.

### CometChatOutgoingCall

Outgoing call screen with ringing indicator.

### CometChatOngoingCall

Active call view (video/audio, controls).

---

## 4. Other components

### CometChatSearch

Search component for finding conversations and messages.

### CometChatReactionList

Full reaction list showing who reacted with which emoji.

### CometChatThreadHeader

Thread header with parent message preview and reply count.

---

## 5. Shared views (building blocks)

These are lower-level views used inside the main components:

| View | Description |
|---|---|
| `CometChatAvatar` | User/group avatar (image + fallback initials) |
| `CometChatBadge` | Unread count badge |
| `CometChatStatusIndicator` | Online/offline status dot |
| `CometChatMessageReceipt` | Message delivery/read receipt icons |
| `CometChatDate` | Formatted date display |
| `CometChatMessageBubble` | Message bubble container |
| `CometChatEmojiKeyboard` | Emoji picker grid |
| `CometChatConfirmDialog` | Confirmation dialog |
| `CometChatPopupMenu` | Context menu / popup menu |

---

## 6. Composition patterns

### Two-pane chat (conversation list + message view)

The most common pattern — conversation list on one side, active chat on the other. On phones, this is typically two Activities or Fragments with navigation between them.

**Java:**
```java
// In ConversationsFragment or Activity
CometChatConversations conversations = findViewById(R.id.conversations);
conversations.setOnItemClick((view, position, conversation) -> {
    Intent intent = new Intent(this, MessagesActivity.class);
    if (conversation.getConversationType().equals("user")) {
        intent.putExtra("uid", ((User) conversation.getConversationWith()).getUid());
    } else {
        intent.putExtra("guid", ((Group) conversation.getConversationWith()).getGuid());
    }
    startActivity(intent);
});

// In MessagesActivity
CometChatMessageHeader header = findViewById(R.id.header);
CometChatMessageList messageList = findViewById(R.id.messageList);
CometChatMessageComposer composer = findViewById(R.id.composer);

String uid = getIntent().getStringExtra("uid");
if (uid != null) {
    CometChat.getUser(uid, new CometChat.CallbackListener<User>() {
        @Override
        public void onSuccess(User user) {
            header.setUser(user);
            messageList.setUser(user);
            composer.setUser(user);
        }

        @Override
        public void onError(CometChatException e) { }
    });
}
```

**Kotlin:**
```kotlin
// In ConversationsFragment or Activity
val conversations = findViewById<CometChatConversations>(R.id.conversations)
conversations.setOnItemClick { view, position, conversation ->
    val intent = Intent(this, MessagesActivity::class.java)
    when (conversation.conversationType) {
        "user" -> intent.putExtra("uid", (conversation.conversationWith as User).uid)
        "group" -> intent.putExtra("guid", (conversation.conversationWith as Group).guid)
    }
    startActivity(intent)
}

// In MessagesActivity
val header = findViewById<CometChatMessageHeader>(R.id.header)
val messageList = findViewById<CometChatMessageList>(R.id.messageList)
val composer = findViewById<CometChatMessageComposer>(R.id.composer)

val uid = intent.getStringExtra("uid")
uid?.let {
    CometChat.getUser(it, object : CometChat.CallbackListener<User>() {
        override fun onSuccess(user: User) {
            header.setUser(user)
            messageList.setUser(user)
            composer.setUser(user)
        }
        override fun onError(e: CometChatException) { }
    })
}
```

### Messages Activity XML layout

```xml
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <com.cometchat.chatuikit.messageheader.CometChatMessageHeader
        android:id="@+id/header"
        android:layout_width="match_parent"
        android:layout_height="wrap_content" />

    <com.cometchat.chatuikit.messagelist.CometChatMessageList
        android:id="@+id/messageList"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1" />

    <com.cometchat.chatuikit.messagecomposer.CometChatMessageComposer
        android:id="@+id/composer"
        android:layout_width="match_parent"
        android:layout_height="wrap_content" />

</LinearLayout>
```

### Bottom navigation with tabs (Conversations + Users + Groups + Calls)

```java
// In HomeActivity — switch fragments based on bottom nav selection
binding.bottomNavigationView.setOnItemSelectedListener(item -> {
    Fragment fragment;
    if (item.getItemId() == R.id.nav_chats) {
        fragment = new ChatsFragment();
    } else if (item.getItemId() == R.id.nav_users) {
        fragment = new UsersFragment();
    } else if (item.getItemId() == R.id.nav_groups) {
        fragment = new GroupsFragment();
    } else if (item.getItemId() == R.id.nav_calls) {
        fragment = new CallsFragment();
    } else {
        return false;
    }
    getSupportFragmentManager().beginTransaction()
        .replace(R.id.fragment_container, fragment)
        .commit();
    return true;
});
```

---

## Hard rules

- **Never invent component names.** If it's not in this catalog, it doesn't exist.
- **`setUser()` and `setGroup()` are mutually exclusive.** Set one or the other, never both.
- **Components require a logged-in user.** Always verify `CometChatUIKit.getLoggedInUser() != null` before mounting.
- **All components extend `MaterialCardView`.** They can be used in XML or created programmatically.
- **Thread mode** — `CometChatMessageList.setParentMessage(long)` (no `Id` suffix on the list) and `CometChatMessageComposer.setParentMessageId(long)`. Both must point to the same parent message ID. Without them, the list and composer show the main conversation, not the thread.
