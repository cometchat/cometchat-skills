---
name: cometchat-android-v6-compose-placement
description: "CometChat Android UIKit v6 Compose placement — setContent, Compose Navigation, Dialog, BottomSheet, and Tab patterns"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, compose, navigation, placement, screens, tabs"
---

> **Companion skills:** cometchat-android-v6-kotlin-placement (Views equivalent), cometchat-android-v6-compose-components, cometchat-android-v6-compose-theming

## Purpose

Place CometChat Compose components into app screens using Compose Navigation, Dialogs, BottomSheets, and Tab layouts. Patterns derived from `master-app-jetpack`.

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
        setContent {
            CometChatTheme {
                CometChatConversations(
                    onItemClick = { conversation -> /* navigate */ }
                )
            }
        }
    }
}
```

## 2. Compose Navigation

Pattern from `master-app-jetpack/navigation/NavGraph.kt`:

```kotlin
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    CometChatTheme {
        NavHost(navController = navController, startDestination = "conversations") {

            composable("conversations") {
                CometChatConversations(
                    onItemClick = { conversation ->
                        // Pass conversation ID or user/group via route
                        navController.navigate("chat/${conversation.conversationId}")
                    }
                )
            }

            composable("chat/{conversationId}") { backStackEntry ->
                val conversationId = backStackEntry.arguments?.getString("conversationId")
                // Resolve user or group from conversationId, then:
                Column {
                    CometChatMessageHeader(user = resolvedUser)
                    CometChatMessageList(
                        user = resolvedUser,
                        modifier = Modifier.weight(1f)
                    )
                    CometChatMessageComposer(user = resolvedUser)
                }
            }

            composable("users") {
                CometChatUsers(
                    onItemClick = { user ->
                        navController.navigate("chat/user_${user.uid}")
                    }
                )
            }

            composable("groups") {
                CometChatGroups(
                    onItemClick = { group ->
                        navController.navigate("chat/group_${group.guid}")
                    }
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

From `master-app-jetpack/Application.kt` — incoming calls are shown as an overlay using StateFlow:

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
- When passing User/Group objects between screens, use a cache or resolver pattern (like `master-app-jetpack/navigation/EntityCache.kt`) — do NOT serialize full objects in navigation routes
