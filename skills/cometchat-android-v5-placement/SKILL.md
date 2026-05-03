---
name: cometchat-android-v5-placement
description: "Where to put CometChat in your Android app — Activity, Fragment, BottomSheet, Dialog, Tab, or embedded patterns."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat android placement activity fragment bottomsheet dialog tabs integration"
---

> **Companion skills:** `cometchat-android-v5-core` covers init and login;
> `cometchat-android-v5-components` provides the component catalog.

## Purpose

This skill teaches WHERE to put CometChat in an existing Android project. It covers six placement patterns: dedicated Activity, Fragment, BottomSheet, Dialog, Tab/ViewPager, and embedded view. Each pattern includes step-by-step instructions and code examples in both Java and Kotlin.

---

## Use this skill when

- Integrating CometChat into an existing Android app
- Deciding between Activity vs Fragment vs BottomSheet
- "Where should I put the chat screen?"
- "How do I add chat as a tab?"
- "How do I show chat in a bottom sheet?"

## Do not use this skill when

- Setting up init/login → use `cometchat-android-v5-core`
- Looking up component APIs → use `cometchat-android-v5-components`
- Customizing appearance → use `cometchat-android-v5-theming`

---

## 1. Placement recommendation

| User intent | Recommended placement | Why |
|---|---|---|
| Messaging app | Dedicated Activity with bottom tabs | Full-screen chat experience |
| Marketplace | Chat button → new Activity | Separate context from product browsing |
| SaaS / dashboard | Fragment in existing Activity | Chat alongside other features |
| Social / community | ViewPager + BottomNav tabs | Multi-section messenger |
| Support / helpdesk | BottomSheet overlay | Non-intrusive, dismissible |
| Quick reply | Dialog | Lightweight, modal |
| Embedded widget | View in existing layout | Inline chat within a screen |

---

## 2. Pattern A — Dedicated Activity

The simplest and most common pattern. A full-screen Activity for the message view.

**MessagesActivity layout (`activity_messages.xml`):**
```xml
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
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

**Java:**
```java
public class MessagesActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_messages);

        CometChatMessageHeader header = findViewById(R.id.header);
        CometChatMessageList messageList = findViewById(R.id.messageList);
        CometChatMessageComposer composer = findViewById(R.id.composer);

        String uid = getIntent().getStringExtra("uid");
        String guid = getIntent().getStringExtra("guid");

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
        } else if (guid != null) {
            CometChat.getGroup(guid, new CometChat.CallbackListener<Group>() {
                @Override
                public void onSuccess(Group group) {
                    header.setGroup(group);
                    messageList.setGroup(group);
                    composer.setGroup(group);
                }
                @Override
                public void onError(CometChatException e) { }
            });
        }

        header.setBackIconVisibility(View.VISIBLE);
        header.setOnBackPress(() -> finish());
    }
}
```

**Kotlin:**
```kotlin
class MessagesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_messages)

        val header = findViewById<CometChatMessageHeader>(R.id.header)
        val messageList = findViewById<CometChatMessageList>(R.id.messageList)
        val composer = findViewById<CometChatMessageComposer>(R.id.composer)

        val uid = intent.getStringExtra("uid")
        val guid = intent.getStringExtra("guid")

        when {
            uid != null -> CometChat.getUser(uid, object : CometChat.CallbackListener<User>() {
                override fun onSuccess(user: User) {
                    header.setUser(user)
                    messageList.setUser(user)
                    composer.setUser(user)
                }
                override fun onError(e: CometChatException) { }
            })
            guid != null -> CometChat.getGroup(guid, object : CometChat.CallbackListener<Group>() {
                override fun onSuccess(group: Group) {
                    header.setGroup(group)
                    messageList.setGroup(group)
                    composer.setGroup(group)
                }
                override fun onError(e: CometChatException) { }
            })
        }

        header.setBackIconVisibility(View.VISIBLE)
        header.setOnBackPress { finish() }
    }
}
```

---

## 3. Pattern B — Fragment

Embed chat in a Fragment within an existing Activity. Useful for SaaS apps or multi-pane layouts.

**Java:**
```java
public class ChatFragment extends Fragment {
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_chat, container, false);

        CometChatConversations conversations = view.findViewById(R.id.conversations);
        conversations.setOnItemClick((v, position, conversation) -> {
            // Navigate to messages — either replace fragment or start Activity
        });

        return view;
    }
}
```

**Kotlin:**
```kotlin
class ChatFragment : Fragment() {
    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = inflater.inflate(R.layout.fragment_chat, container, false)

        val conversations = view.findViewById<CometChatConversations>(R.id.conversations)
        conversations.setOnItemClick { v, position, conversation ->
            // Navigate to messages — either replace fragment or start Activity
        }

        return view
    }
}
```

---

## 4. Pattern C — BottomSheet

Show chat as a bottom sheet overlay. Good for support/helpdesk.

**Java:**
```java
BottomSheetDialog bottomSheet = new BottomSheetDialog(this);
View view = getLayoutInflater().inflate(R.layout.bottom_sheet_chat, null);

CometChatMessageList messageList = view.findViewById(R.id.messageList);
CometChatMessageComposer composer = view.findViewById(R.id.composer);

messageList.setUser(user);
composer.setUser(user);

bottomSheet.setContentView(view);
bottomSheet.show();
```

**Kotlin:**
```kotlin
val bottomSheet = BottomSheetDialog(this)
val view = layoutInflater.inflate(R.layout.bottom_sheet_chat, null)

val messageList = view.findViewById<CometChatMessageList>(R.id.messageList)
val composer = view.findViewById<CometChatMessageComposer>(R.id.composer)

messageList.setUser(user)
composer.setUser(user)

bottomSheet.setContentView(view)
bottomSheet.show()
```

---

## 5. Pattern D — Bottom Navigation Tabs

Full messenger with Conversations, Users, Groups, and Calls as tabs.

**Java:**
```java
binding.bottomNavigationView.setOnItemSelectedListener(item -> {
    Fragment fragment;
    int id = item.getItemId();
    if (id == R.id.nav_chats) {
        fragment = new ChatsFragment();      // Contains CometChatConversations
    } else if (id == R.id.nav_users) {
        fragment = new UsersFragment();      // Contains CometChatUsers
    } else if (id == R.id.nav_groups) {
        fragment = new GroupsFragment();     // Contains CometChatGroups
    } else if (id == R.id.nav_calls) {
        fragment = new CallsFragment();      // Contains CometChatCallLogs
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

- **Always set `User` or `Group` on message components.** `CometChatMessageList`, `CometChatMessageComposer`, and `CometChatMessageHeader` require either `setUser()` or `setGroup()` — never both, never neither.
- **Fetch the `User`/`Group` object before setting it.** Use `CometChat.getUser(uid)` or `CometChat.getGroup(guid)` — don't construct objects manually.
- **Set back icon visibility on `CometChatMessageHeader`.** The method is `setBackIconVisibility()`. Default is `GONE`. Set to `VISIBLE` when the user needs to navigate back.
- **Register the Activity in `AndroidManifest.xml`.** Every new Activity needs a manifest entry.
