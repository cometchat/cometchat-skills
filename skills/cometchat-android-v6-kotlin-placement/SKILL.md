---
name: cometchat-android-v6-kotlin-placement
description: "CometChat Android UIKit v6 Kotlin Views placement — Activity, Fragment, BottomSheet, Tab, and Intent navigation patterns"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-kotlin-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.1"
  tags: "cometchat, android, kotlin-views, placement, activity, fragment, navigation, tabs"
---

> **Ground truth:** `com.cometchat:chatuikit-kotlin-android:6.x` Views + `docs/ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

> **Companion skills:** cometchat-android-v6-compose-placement (Compose equivalent), cometchat-android-v6-kotlin-components, cometchat-android-v6-kotlin-theming

## Purpose

Place CometChat Kotlin Views components into Activities, Fragments, BottomSheets, and Tab layouts. Patterns derived from `sample-app-kotlin`.

## Use this skill when

- Adding CometChat Views to an Activity or Fragment
- Setting up Intent-based navigation between chat screens
- Building a tabbed layout with Conversations, Users, Groups, Calls tabs
- Showing CometChat components in BottomSheets or Dialogs

## Do not use this skill when

- Working with Compose placement (use `cometchat-android-v6-compose-placement`)
- Looking up component APIs (use `cometchat-android-v6-kotlin-components`)

## 1. Activity-Based Placement

### 1.1 Conversations Activity

```kotlin
class ConversationsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val conversations = CometChatConversations(this)
        conversations.setOnItemClick { conversation ->
            val intent = Intent(this, MessagesActivity::class.java)
            // Pass user or group via intent extras
            startActivity(intent)
        }
        setContentView(conversations)
    }
}
```

### 1.2 Messages Activity

Pattern from `sample-app-kotlin/.../ui/messages/MessagesActivity.kt`:

```kotlin
class MessagesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_messages)

        // Pad the root for the status/navigation bars (root has fitsSystemWindows="true").
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.parent_view)) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, 0)
            insets
        }

        val header = findViewById<CometChatMessageHeader>(R.id.messageHeader)
        val messageList = findViewById<CometChatMessageList>(R.id.messageList)
        val composer = findViewById<CometChatMessageComposer>(R.id.messageComposer)

        // Show + wire the back button (the kit does not finish the Activity for you).
        header.setBackButtonVisibility(View.VISIBLE)
        header.setOnBackPress { finish() }

        // Set user or group
        header.setUser(user)
        messageList.setUser(user)
        composer.setUser(user)

        // For groups:
        // header.setGroup(group)
        // messageList.setGroup(group)
        // composer.setGroup(group)
    }
}
```

XML layout — the root carries `android:fitsSystemWindows="true"` (so the inset listener above receives system-bar insets) and `?attr/cometchatBackgroundColor1`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/parent_view"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="?attr/cometchatBackgroundColor1"
    android:fitsSystemWindows="true"
    android:orientation="vertical">

    <com.cometchat.uikit.kotlin.presentation.messageheader.ui.CometChatMessageHeader
        android:id="@+id/messageHeader"
        android:layout_width="match_parent"
        android:layout_height="wrap_content" />

    <com.cometchat.uikit.kotlin.presentation.messagelist.ui.CometChatMessageList
        android:id="@+id/messageList"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1" />

    <com.cometchat.uikit.kotlin.presentation.messagecomposer.ui.CometChatMessageComposer
        android:id="@+id/messageComposer"
        android:layout_width="match_parent"
        android:layout_height="wrap_content" />

</LinearLayout>
```

## 2. Fragment-Based Placement

```kotlin
class ConversationsFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val conversations = CometChatConversations(requireContext())
        conversations.setOnItemClick { conversation ->
            // Navigate using FragmentManager or Navigation Component
        }
        return conversations
    }
}
```

## 3. Tabbed Layout with ViewPager2

```kotlin
class HomeActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)

        val tabLayout = findViewById<TabLayout>(R.id.tabLayout)
        val viewPager = findViewById<ViewPager2>(R.id.viewPager)

        viewPager.adapter = object : FragmentStateAdapter(this) {
            override fun getItemCount() = 4
            override fun createFragment(position: Int): Fragment = when (position) {
                0 -> ConversationsFragment()
                1 -> UsersFragment()
                2 -> GroupsFragment()
                3 -> CallLogsFragment()
                else -> ConversationsFragment()
            }
        }

        TabLayoutMediator(tabLayout, viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Chats"
                1 -> "Users"
                2 -> "Groups"
                3 -> "Calls"
                else -> ""
            }
        }.attach()
    }
}
```

## 4. BottomSheet Placement

```kotlin
// Show message info in a BottomSheet
val bottomSheet = CometChatMessageInformationBottomSheet.newInstance(message)
bottomSheet.show(supportFragmentManager, "messageInfo")
```

For custom BottomSheets:

```kotlin
class ReactionsBottomSheet : BottomSheetDialogFragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val reactionList = CometChatReactionList(requireContext())
        reactionList.setBaseMessage(message)
        return reactionList
    }
}
```

## 5. Dialog Placement

`CometChatFlagMessageDialog` is a regular Android `Dialog` (NOT a `DialogFragment`). The message is passed at construction; there is no `setMessage` setter and no `show(fm, tag)` overload.

```kotlin
// Flag/report message dialog
val dialog = CometChatFlagMessageDialog(this, message)  // (context, BaseMessage)
dialog.show()
```

## 6. App Flow Pattern

Pattern from `sample-app-kotlin/.../ui/home/HomeActivity.kt` — a single Activity hosts the chat flow via Fragment transactions:

```kotlin
class AppFlowActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_app_flow)

        // Start with conversations
        supportFragmentManager.beginTransaction()
            .replace(R.id.container, ConversationsFragment())
            .commit()
    }

    fun navigateToMessages(user: User) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.container, MessagesFragment.newInstance(user))
            .addToBackStack(null)
            .commit()
    }
}
```

## Activity theme — REQUIRED parent

V6 Kotlin Views components (`CometChatConversations`, `CometChatMessageList`, etc.) extend Material Components widgets (`MaterialCardView`, `MaterialButton`) and reference kit-specific theme attributes (`?attr/cometchatPrimaryColor`, `?attr/cometchatBackgroundColor01`, etc.). The kit ships its own pre-configured theme that supplies every required attribute.

**Inherit your Activity theme from `CometChatTheme.DayNight`** (or `CometChatTheme.Light` / `CometChatTheme.Dark` for fixed-mode apps). Edit `app/src/main/res/values/themes.xml`:

```xml
<resources>
    <style name="Theme.YourApp" parent="CometChatTheme.DayNight" />
</resources>
```

Do **not** use any of these as the parent — they all crash at component inflation:

- `Theme.AppCompat.*` — missing Material Components style attrs (`MaterialCardView` rejects with `IllegalArgumentException: requires Theme.MaterialComponents (or descendant)`)
- `Theme.MaterialComponents.*.Bridge` — Bridge variants drop Material widget defaults (`MaterialButton` fails with `Failed to resolve attribute at index N`)
- `Theme.MaterialComponents.*` (without the kit) — has Material attrs but missing `cometchat*` attrs (same `Failed to resolve attribute` crash)
- `Theme.Material3.*` — Material 3 attrs don't satisfy the kit's MaterialComponents-based widgets
- `android:Theme.Material.*` — predates AppCompat; AppCompatActivity rejects it

`CometChatTheme.DayNight` itself parents `Theme.MaterialComponents.DayNight.NoActionBar`, so it remains AppCompat-compatible while supplying every `cometchat*` attr the components reference.

To brand-customize colors, override `cometchat*` attrs in your Activity theme (see `cometchat-android-v6-kotlin-theming`), or call `CometChatTheme.setPrimaryColor(...)` programmatically.

## Hard rules

- ALWAYS set the user or group on messaging components (`setUser()` / `setGroup()`) before the component is displayed
- Activity theme MUST inherit from `CometChatTheme.DayNight` / `.Light` / `.Dark` (see "Activity theme" section above) — vague guidance about "include CometChat attrs" is insufficient; use the kit's pre-configured theme
- Ongoing calls MUST use `CometChatOngoingCallActivity.launchOngoingCallActivity(context, ...)` (in `com.cometchat.uikit.kotlin.presentation.ongoingcall.ui`) — they need a separate Activity for proper lifecycle / PiP management. `CometChatCallActivity` (in `com.cometchat.uikit.kotlin.calls`) handles outgoing/incoming/conference launches via `launchOutgoingCallScreen` / `launchIncomingCallScreen` / `launchConferenceCallScreen` — it has no `launchOngoingCallActivity` method.
- When passing User/Group between Activities, serialize the UID/GUID and re-fetch, or use a shared cache — do NOT pass full SDK objects via Intent extras
- Use `AppCompatActivity` (not plain `Activity`) to ensure proper theme attribute resolution
