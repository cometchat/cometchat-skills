---
name: cometchat-flutter-v6-placement
description: >
  Use when deciding WHERE to put CometChat in a Flutter app. Covers placement patterns:
  tab-based home (IndexedStack), Navigator.push messages screen, modal/bottom sheet chat,
  thread overlay, embedded panel, and floating widget. Includes Scaffold configuration,
  resizeToAvoidBottomInset, SafeArea, and keyboard-aware spacing patterns.
  Triggers on "add chat to my app", "where to put chat", "messages screen layout",
  "tab bar with chat", "chat in modal", "chat in drawer", "embedded chat",
  "Scaffold layout", or "keyboard handling".
license: "MIT"
compatibility: "cometchat_chat_uikit ^6.0.1; flutter >=2.5.0"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter placement route modal drawer tabs scaffold keyboard layout"
---

> **Ground truth:** `cometchat_chat_uikit: ^6.0` widgets + `docs/ui-kit/flutter`. **Official docs:** https://www.cometchat.com/docs/ui-kit/flutter/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

# CometChat Flutter UIKit — Placement

WHERE to put CometChat in your Flutter app. Five patterns, each with complete code.

**Before using this skill:**
- Read `cometchat-flutter-v6-core` for init, login, and rules
- Read `cometchat-flutter-v6-components` for component names and props (when available)

---

## Placement Recommendation

| User intent | Recommended pattern | Components |
|-------------|-------------------|------------|
| Messaging app | Tab-based home (full screen) | IndexedStack + CometChatConversations + Messages screen |
| Marketplace / platform | Navigator.push from product page | Single-thread messages screen |
| SaaS / dashboard | Modal or bottom sheet | CometChatConversations in BottomSheet |
| Social / community | Tab-based home with calls | IndexedStack + Conversations + CallLogs + Users + Groups |
| Support / helpdesk | Floating action button → modal | FAB + showModalBottomSheet |
| Just exploring | Replace home page | CometChatConversations as Scaffold body |

---

## Pattern 1: Tab-Based Home (Most Common)

BottomNavigationBar with IndexedStack to preserve tab state. This is what master_app uses.

```dart
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          // Tab 0: Conversations
          CometChatConversations(
            hideAppbar: true,
            onItemTap: (conversation) => _openChat(context, conversation),
          ),
          // Tab 1: Call Logs
          CometChatCallLogs(hideAppbar: true),
          // Tab 2: Users
          CometChatUsers(
            hideAppbar: true,
            onItemTap: (_, user) => _pushMessages(context, user: user),
          ),
          // Tab 3: Groups
          CometChatGroups(
            hideAppbar: true,
            onItemTap: (_, group) => _pushMessages(context, group: group),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.chat_outlined), label: 'Chats'),
          BottomNavigationBarItem(icon: Icon(Icons.call_outlined), label: 'Calls'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Users'),
          BottomNavigationBarItem(icon: Icon(Icons.people_outline), label: 'Groups'),
        ],
      ),
    );
  }

  void _openChat(BuildContext context, Conversation conversation) {
    final user = conversation.conversationWith is User
        ? conversation.conversationWith as User : null;
    final group = conversation.conversationWith is Group
        ? conversation.conversationWith as Group : null;
    _pushMessages(context, user: user, group: group);
  }

  void _pushMessages(BuildContext context, {User? user, Group? group}) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => MessagesScreen(user: user, group: group),
    ));
  }
}
```

**Key details:**
- `IndexedStack` keeps all tabs alive — no re-fetch when switching tabs
- `hideAppbar: true` on all components — the parent Scaffold provides the AppBar
- `onItemTap` extracts `User`/`Group` from `conversation.conversationWith`
- Protected groups need a join/password screen before navigating to messages

---

## Pattern 2: Messages Screen (Navigator.push)

The standard messages screen pushed from any conversation/user/group tap.

```dart
class MessagesScreen extends StatefulWidget {
  final User? user;
  final Group? group;
  const MessagesScreen({super.key, this.user, this.group})
      : assert(user != null || group != null);
  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  late User? _user;
  late Group? _group;

  @override
  void initState() {
    super.initState();
    _user = widget.user;   // Mutable copy — updated by SDK listeners
    _group = widget.group;
  }

  @override
  Widget build(BuildContext context) {
    final colorPalette = CometChatThemeHelper.getColorPalette(context);
    return Scaffold(
      resizeToAvoidBottomInset: true, // matches sample app; composer clamps to viewInsets (ENG-34434)
      appBar: CometChatMessageHeader(
        user: _user,
        group: _group,
        onBack: () => Navigator.pop(context),
      ),
      body: SafeArea(
        top: false, // Header is the appBar — top inset already handled; keep bottom inset
        child: Container(
          color: colorPalette.background3,
          child: Column(
            children: [
              Expanded(child: CometChatMessageList(user: _user, group: _group)),
              CometChatMessageComposer(user: _user, group: _group),
            ],
          ),
        ),
      ),
    );
  }
}
```

### Critical Scaffold Rules

1. `resizeToAvoidBottomInset: true` (or omit — `true` is the Scaffold default) — matches the kit sample app (`messages_screen.dart` defaults it; `thread_screen.dart` sets it `true`). The composer clamps the native keyboard height to Flutter's `viewInsets` (kit fix ENG-34434), so `true` does NOT double-compensate on `^6.0.1`. (Pre-6.0.1 kits double-compensated with `true`; `false` was the old workaround — if you see a double keyboard gap, upgrade the kit.)
2. `SafeArea(top: false)` wrapping `Container(color: colorPalette.background3, ...)` — the header is the `appBar`, so the top inset is already handled; keep the bottom inset. The `background3` container gives the list/composer the correct surface color.
3. Mutable `_user`/`_group` — Keep mutable copies in State, not `widget.user`/`widget.group`. Update from SDK listeners for block/kick/scope changes.

---

## Pattern 3: Thread Screen

Thread replies pushed from `onThreadRepliesClick`. Same Scaffold rules apply.

```dart
class ThreadScreen extends StatelessWidget {
  final User? user;
  final Group? group;
  final BaseMessage message;
  final CometChatMessageTemplate? template;

  const ThreadScreen({
    super.key, this.user, this.group,
    required this.message, this.template,
  });

  @override
  Widget build(BuildContext context) {
    final colorPalette = CometChatThemeHelper.getColorPalette(context);
    return Scaffold(
      resizeToAvoidBottomInset: true, // same as messages screen
      appBar: CometChatMessageHeader(
        user: user, group: group,
        onBack: () => Navigator.pop(context),
      ),
      body: SafeArea(
        child: Container(
          color: colorPalette.background3,
          child: Column(
            children: [
              CometChatThreadedHeader(
                parentMessage: message,
                loggedInUser: CometChatUIKit.loggedInUser!,
                template: template,
              ),
              Expanded(
                child: CometChatMessageList(
                  user: user, group: group,
                  parentMessageId: message.id,
                  // Scope the list to this thread only: exclude the parent and
                  // request just the replies for message.id.
                  withParent: false,
                  messagesRequestBuilder: MessagesRequestBuilder()
                    ..parentMessageId = message.id,
                  hideReplyInThreadOption: true,
                ),
              ),
              CometChatMessageComposer(
                user: user, group: group,
                parentMessageId: message.id,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

Wire it from the messages screen:
```dart
CometChatMessageList(
  onThreadRepliesClick: (message, ctx, {template}) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => ThreadScreen(
        user: _user, group: _group,
        message: message, template: template,
      ),
    ));
  },
)
```

---

## Pattern 4: Modal / Bottom Sheet Chat

Quick chat access from any screen without full navigation.

```dart
void _openChatModal(BuildContext context, User user) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.85,
      child: Scaffold(
        resizeToAvoidBottomInset: true, // same rule applies to the inner Scaffold
        appBar: CometChatMessageHeader(
          user: user,
          onBack: () => Navigator.pop(context),
        ),
        body: Column(
          children: [
            Expanded(child: CometChatMessageList(user: user)),
            CometChatMessageComposer(user: user),
          ],
        ),
      ),
    ),
  );
}
```

**Key details:**
- `isScrollControlled: true` — allows the sheet to be taller than half screen
- `useSafeArea: true` — respects notch/status bar
- Inner `Scaffold` uses `resizeToAvoidBottomInset: true` (same as the messages screen)
- Use `MediaQuery.sizeOf(context)` not `MediaQuery.of(context).size`

---

## Pattern 5: Embedded Panel

Chat embedded alongside other content (e.g., split view on tablets).

```dart
class SplitView extends StatelessWidget {
  final User user;
  const SplitView({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Row(
        children: [
          // Left: your app content
          Expanded(flex: 3, child: YourProductPage()),
          // Right: embedded chat
          Expanded(
            flex: 2,
            child: Column(
              children: [
                CometChatMessageHeader(user: user),
                Expanded(child: CometChatMessageList(user: user)),
                CometChatMessageComposer(user: user),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## Pattern 6: Floating Action Button → Chat

```dart
Scaffold(
  body: YourMainContent(),
  floatingActionButton: FloatingActionButton(
    onPressed: () => _openChatModal(context, supportUser),
    child: const Icon(Icons.chat),
  ),
)
```

---

## Incoming Calls — Global Placement

Incoming call handling MUST be at the app root level, not per-screen. **`VoipCallHandler` does NOT exist as a public symbol** (it appears only in comments inside `call_event_service.dart` and `ongoing_call_bloc.dart`). The canonical V6 root-mount API is `CometChatUIKit.init` + `MaterialApp(navigatorKey: CallNavigationContext.navigatorKey)`:

```dart
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart' show CallNavigationContext;
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await CometChatUIKit.init(
    uiKitSettings: (UIKitSettingsBuilder()
      ..appId = APP_ID
      ..region = REGION
      ..authKey = AUTH_KEY
      ..subscriptionType = CometChatSubscriptionType.allUsers
      ..enableCalls = true)
      .build(),
  );
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: CallNavigationContext.navigatorKey, // ← Bug 1 fix per project_v6_flutter_calls_partial; even 6.0.1 sample omits this
      home: HomeScreen(),
    );
  }
}
```

See `cometchat-flutter-v6-calls` §1.7 for full root-mount details. CallEventService mounts `IncomingCallOverlay` automatically when `enableCalls=true`.

---

## Anti-Patterns

```dart
// ❌ WRONG — CometChatMessageList not wrapped in Expanded (unbounded → won't scroll)
Scaffold(
  body: Column(children: [
    CometChatMessageList(user: user),   // needs Expanded inside a Column
    CometChatMessageComposer(user: user),
  ]),
)

// ❌ WRONG — passing widget.user directly (stale after block/kick)
CometChatMessageList(user: widget.user)

// ❌ WRONG — incoming call handler only on messages screen
// Calls ring on ALL screens, not just the one with call buttons

// ❌ WRONG — navigating to messages without extracting user/group
onItemTap: (conv) => Navigator.push(context, MaterialPageRoute(
  builder: (_) => MessagesScreen(conversation: conv), // Wrong!
))

// ✅ CORRECT — extract user/group from conversation
onItemTap: (conv) {
  final user = conv.conversationWith is User ? conv.conversationWith as User : null;
  final group = conv.conversationWith is Group ? conv.conversationWith as Group : null;
  Navigator.push(context, MaterialPageRoute(
    builder: (_) => MessagesScreen(user: user, group: group),
  ));
}
```

---

## Checklist

- [ ] `resizeToAvoidBottomInset: true` (or omitted — default) on Scaffolds with `CometChatMessageComposer`
- [ ] `SafeArea(top: false)` wrapping `Container(color: colorPalette.background3, ...)` for the message screen body
- [ ] Mutable `_user`/`_group` state copies, not `widget.user`/`widget.group`
- [ ] `onItemTap` extracts `User`/`Group` from `conversation.conversationWith`
- [ ] Protected groups handled (check `group.hasJoined` and `group.type`)
- [ ] Incoming call handler mounted at app root level
- [ ] Thread screen also uses `resizeToAvoidBottomInset: true`
- [ ] `hideAppbar: true` when parent provides its own AppBar
- [ ] `IndexedStack` used for tab-based home (preserves tab state)
