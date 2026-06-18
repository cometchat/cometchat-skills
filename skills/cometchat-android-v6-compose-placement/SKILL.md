---
name: cometchat-android-v6-compose-placement
description: "CometChat Android UIKit v6 Compose placement — setContent, Compose Navigation, Dialog, BottomSheet, and Tab patterns"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, compose, navigation, placement, screens, tabs"
---

> **Ground truth:** `com.cometchat:chatuikit-compose-android:6.x` composables + `docs/ui-kit/android/v6`. **Official docs:** https://www.cometchat.com/docs/ui-kit/android/v6/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

> **Companion skills:** cometchat-android-v6-kotlin-placement (Views equivalent), cometchat-android-v6-compose-components, cometchat-android-v6-compose-theming

## Purpose

Place CometChat Compose components into app screens using Compose Navigation, Dialogs, BottomSheets, and Tab layouts. Patterns derived from `sample-app-compose`.

## Use this skill when

- Setting up Compose Navigation with CometChat screens
- Placing CometChat components in a NavHost
- Showing CometChat components in Dialogs or BottomSheets
- Building a tabbed layout with Conversations, Users, Groups, Calls tabs

## Do not use this skill when

- Working with Kotlin Views placement (use `cometchat-android-v6-kotlin-placement`)
- Looking up component APIs (use `cometchat-android-v6-compose-components`)

## 1. Basic setContent Placement

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Edge-to-edge enables drawing under the system bars; safeDrawingPadding
        // below puts CometChat content back inside the safe area.
        enableEdgeToEdge()
        setContent {
            CometChatTheme {
                Box(Modifier.fillMaxSize().safeDrawingPadding()) {
                    CometChatConversations(
                        onItemClick = { conversation -> /* navigate */ }
                    )
                }
            }
        }
    }
}
```

> ⚠️ **Always wrap CometChat composables in a `Modifier.safeDrawingPadding()` (or `systemBarsPadding()`) container when using edge-to-edge (ENG-35715).** Without it the kit's top app bar / composer is clipped under the status bar / navigation gesture area on modern Android (API 30+). The kit itself does NOT apply `WindowInsets` for you — that's the host's job. On XML host activities, the equivalent is `android:fitsSystemWindows="true"` on the root view (or per-fragment).

## 2. Compose Navigation

Pattern from `sample-app-compose/navigation/NavGraph.kt` + `messages/MessagesScreen.kt`.

> **Carry `userId` / `groupId` on the route — NOT `conversation.conversationId`.** A `conversationId` is the conversation's own identifier, not a UID/GUID; the kit components need a `User` or `Group` object. The sample resolves the route's `userId`/`groupId` back into a `User`/`Group` on the chat screen via `CometChat.getUser(...)` / `CometChat.getGroup(...)` inside a `LaunchedEffect`. `CometChatTheme {}` is applied once at the app root (see §1), so it is NOT re-wrapped here.

```kotlin
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "conversations") {

        composable("conversations") {
            CometChatConversations(
                onItemClick = { conversation ->
                    // Resolve the participant and pass the UID/GUID on the route —
                    // NOT conversation.conversationId.
                    when (val entity = conversation.conversationWith) {
                        is User -> navController.navigate("chat?userId=${entity.uid}")
                        is Group -> navController.navigate("chat?groupId=${entity.guid}")
                    }
                }
            )
        }

        composable(
            route = "chat?userId={userId}&groupId={groupId}",
            arguments = listOf(
                navArgument("userId") { type = NavType.StringType; nullable = true; defaultValue = null },
                navArgument("groupId") { type = NavType.StringType; nullable = true; defaultValue = null }
            )
        ) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId")
            val groupId = backStackEntry.arguments?.getString("groupId")
            ChatScreen(userId = userId, groupId = groupId, onBackPress = { navController.popBackStack() })
        }

        composable("users") {
            CometChatUsers(
                onItemClick = { user ->
                    navController.navigate("chat?userId=${user.uid}")
                }
            )
        }

        composable("groups") {
            CometChatGroups(
                onItemClick = { group ->
                    navController.navigate("chat?groupId=${group.guid}")
                }
            )
        }
    }
}
```

The chat screen re-fetches the `User`/`Group` from the route key, then composes the three pieces with `imePadding()` so the keyboard pushes the composer up (matches `MessagesScreen.kt`):

```kotlin
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.exceptions.CometChatException
import com.cometchat.chat.models.Group
import com.cometchat.chat.models.User

@Composable
fun ChatScreen(userId: String?, groupId: String?, onBackPress: () -> Unit) {
    var user by remember { mutableStateOf<User?>(null) }
    var group by remember { mutableStateOf<Group?>(null) }

    // Re-fetch the entity from the route key — routes carry IDs, not objects.
    LaunchedEffect(userId, groupId) {
        when {
            userId != null -> CometChat.getUser(userId, object : CometChat.CallbackListener<User>() {
                override fun onSuccess(fetched: User) { user = fetched; group = null }
                override fun onError(e: CometChatException) {}
            })
            groupId != null -> CometChat.getGroup(groupId, object : CometChat.CallbackListener<Group>() {
                override fun onSuccess(fetched: Group) { group = fetched; user = null }
                override fun onError(e: CometChatException) {}
            })
        }
    }

    if (user != null || group != null) {
        Scaffold(contentWindowInsets = WindowInsets.statusBars) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .consumeWindowInsets(paddingValues)
                    .navigationBarsPadding()
                    .imePadding()
            ) {
                CometChatMessageHeader(
                    modifier = Modifier.fillMaxWidth(),
                    user = user,
                    group = group,
                    hideBackButton = false,
                    onBackPress = onBackPress
                )
                CometChatMessageList(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    user = user,
                    group = group
                )
                CometChatMessageComposer(
                    modifier = Modifier.fillMaxWidth(),
                    user = user,
                    group = group
                )
            }
        }
    }
}
```

## 3. Tabbed Layout

```kotlin
@Composable
fun HomeScreen() {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Chats", "Users", "Groups", "Calls")

    CometChatTheme {
        Column {
            TabRow(selectedTabIndex = selectedTab) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(title) }
                    )
                }
            }

            when (selectedTab) {
                0 -> CometChatConversations(onItemClick = { /* navigate */ })
                1 -> CometChatUsers(onItemClick = { /* navigate */ })
                2 -> CometChatGroups(onItemClick = { /* navigate */ })
                3 -> CometChatCallLogs(onItemClick = { /* navigate */ })
            }
        }
    }
}
```

## 4. Dialog Placement

```kotlin
@Composable
fun ChatScreenWithInfo(message: BaseMessage) {
    var showInfo by remember { mutableStateOf(false) }

    if (showInfo) {
        Dialog(onDismissRequest = { showInfo = false }) {
            CometChatMessageInformation(message = message)
        }
    }
}
```

## 5. BottomSheet Placement

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreenWithReactions(message: BaseMessage) {
    var showReactions by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    if (showReactions) {
        ModalBottomSheet(
            onDismissRequest = { showReactions = false },
            sheetState = sheetState
        ) {
            CometChatReactionList(baseMessage = message)
        }
    }
}
```

## 6. Call Activity Launch

Ongoing calls use a dedicated Activity (not a composable screen):

```kotlin
import com.cometchat.uikit.compose.presentation.ongoingcall.ui.CometChatOngoingCallActivity
import com.cometchat.uikit.core.constants.UIKitConstants.CallWorkFlow

// Launch ongoing call
CometChatOngoingCallActivity.launchOngoingCallActivity(
    activity,           // Current Activity
    call.sessionId,     // Call session ID
    call.type,          // "audio" or "video"
    CallWorkFlow.DEFAULT,
    null,               // Custom CallSettingsBuilder (optional)
    null                // CometChatOngoingCallStyle (optional)
)
```

## 7. Incoming Call Overlay

> **Note on canonical references:** the **Compose** sample app (`sample-app-compose`) ships **without** calling enabled, so it has no incoming-call wiring to copy. The only canonical Android sample that wires incoming calls is the **Kotlin-Views** `sample-app-kotlin`, which adds `CometChatIncomingCall` to a programmatic `Snackbar` host after a `CometChat.addCallListener` fires (see `cometchat-android-v6-calls`). The Compose pattern below — register the call listener, push the `Call` into a `StateFlow`, render an overlay — is the idiomatic Compose adaptation of that same flow (you wire it yourself; it is not lifted verbatim from a sample file).

Incoming calls are shown as an overlay using a StateFlow you expose from the `Application` (register a `CometChat.addCallListener` that pushes incoming `Call`s into it):

```kotlin
// In Application class
private val _incomingCall = MutableStateFlow<Call?>(null)
val incomingCall: StateFlow<Call?> = _incomingCall.asStateFlow()

// In your root composable
val incomingCall by application.incomingCall.collectAsStateWithLifecycle()

incomingCall?.let { call ->
    CometChatIncomingCall(call = call)
}
```

## Hard rules

- ALWAYS wrap CometChat components in `CometChatTheme {}` at the top level — do not nest multiple `CometChatTheme` wrappers
- Place `CometChatTheme {}` OUTSIDE the `NavHost` so all screens share the same theme
- Ongoing calls MUST use `CometChatOngoingCallActivity` — they cannot be a composable screen (they need a separate Activity for PiP and lifecycle)
- When navigating to a chat, carry `userId`/`groupId` on the route and re-fetch the `User`/`Group` with `CometChat.getUser`/`CometChat.getGroup` on the chat screen (see §2) — do NOT serialize full objects, and do NOT pass `conversation.conversationId` (it is not a UID/GUID)
