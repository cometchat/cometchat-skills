---
name: cometchat-flutter-v5-users-groups
description: "Use when working with CometChat Flutter UIKit v5 user and group list components. Triggers on CometChatUsers, CometChatGroups, CometChatGroupMembers, CometChatChangeScope."
license: "MIT"
compatibility: "cometchat_chat_uikit ^5.2.14; cometchat_uikit_shared ^5.2.3"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 users groups members scope contacts"
---

# CometChat Flutter UIKit v5 — Users & Groups

Components for displaying and managing users, groups, and group members.

## CometChatUsers

Displays a list of users, sorted alphabetically.

### Key Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `usersRequestBuilder` | `UsersRequestBuilder?` | — | Custom fetch builder |
| `usersStyle` | `CometChatUsersStyle` | `const CometChatUsersStyle()` | Visual styling |
| `onItemTap` | `Function(BuildContext, User)?` | — | Tap callback (**includes BuildContext**) |
| `onItemLongPress` | `Function(BuildContext, User)?` | — | Long press callback |
| `subtitleView` | `Widget? Function(BuildContext, User)?` | — | Custom subtitle |
| `title` | `String?` | — | List title |
| `showBackButton` | `bool` | `true` | Show back button |
| `hideSearch` | `bool` | `false` | Hide search bar |
| `selectionMode` | `SelectionMode?` | — | Enable selection mode |
| `onSelection` | `Function(List<User>?, BuildContext)?` | — | Selection callback |
| `usersStatusVisibility` | `bool?` | `true` | Show online status |
| `hideAppbar` | `bool?` | `false` | Hide app bar |
| `appBarOptions` | `List<Widget> Function(BuildContext)?` | — | App bar trailing widgets |
| `controllerTag` | `String?` | — | Custom GetX controller tag |
| `stickyHeaderVisibility` | `bool?` | `false` | Show alphabetical headers |

### Usage

```dart
CometChatUsers(
  onItemTap: (context, user) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => MessagesScreen(user: user),
    ));
  },
)

// With custom request builder
CometChatUsers(
  usersRequestBuilder: UsersRequestBuilder()
    ..limit = 30
    ..friendsOnly = true,
)

// Filter by role (e.g., AI agents)
CometChatUsers(
  title: "Agents",
  usersRequestBuilder: UsersRequestBuilder()
    ..roles = [AIConstants.aiRole],
  onItemTap: (context, user) { ... },
)
```

## CometChatGroups

Displays a list of groups with type indicators.

### Key Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `groupsRequestBuilder` | `GroupsRequestBuilder?` | — | Custom fetch builder |
| `groupsStyle` | `CometChatGroupsStyle?` | — | Visual styling |
| `onItemTap` | `Function(BuildContext, Group)?` | — | Tap callback (**includes BuildContext**) |
| `onItemLongPress` | `Function(BuildContext, Group)?` | — | Long press callback |
| `subtitleView` | `Widget? Function(BuildContext, Group)?` | — | Custom subtitle |
| `title` | `String?` | — | List title |
| `showBackButton` | `bool` | `true` | Show back button |
| `hideSearch` | `bool` | `false` | Hide search bar |
| `selectionMode` | `SelectionMode?` | — | Enable selection mode |
| `groupTypeVisibility` | `bool` | `true` | Show group type icon |
| `hideAppbar` | `bool?` | `false` | Hide app bar |
| `appBarOptions` | `List<Widget> Function(BuildContext)?` | — | App bar trailing widgets |
| `controllerTag` | `String?` | — | Custom GetX controller tag |

### Usage

```dart
CometChatGroups(
  onItemTap: (context, group) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => MessagesScreen(group: group),
    ));
  },
)
```

## CometChatGroupMembers

Displays members of a specific group with role indicators.

```dart
CometChatGroupMembers(
  group: group,
  onItemTap: (member) {
    debugPrint('Tapped: ${member.name}, role: ${member.scope}');
  },
)
```

Key props: `group` (required), `groupMembersRequestBuilder`, `groupMembersStyle`, `subtitleView`, `trailingView`, `onItemTap` (`Function(GroupMember)?` — **no BuildContext**), `selectionMode`, `onSelection`.

## CometChatChangeScope

Widget for changing a group member's scope/role.

```dart
CometChatChangeScope(group: group, member: member)
```

## Callback Signature Differences

| Component | `onItemTap` signature |
|-----------|----------------------|
| `CometChatConversations` | `Function(Conversation)?` — **no BuildContext** |
| `CometChatUsers` | `Function(BuildContext, User)?` — **has BuildContext** |
| `CometChatGroups` | `Function(BuildContext, Group)?` — **has BuildContext** |
| `CometChatGroupMembers` | `Function(GroupMember)?` — **no BuildContext** |

This is a common source of confusion.

## Anti-Patterns

```dart
// ❌ WRONG — missing BuildContext in Users/Groups onItemTap
CometChatUsers(onItemTap: (user) { ... }) // Missing BuildContext!

// ✅ CORRECT
CometChatUsers(onItemTap: (context, user) { ... })
CometChatGroups(onItemTap: (context, group) { ... })
```

## Checklist — Users & Groups

- [ ] `onItemTap` callback signature includes `BuildContext` for Users/Groups
- [ ] Custom request builders set appropriate limits
- [ ] Let widgets manage their own GetX controller lifecycle
