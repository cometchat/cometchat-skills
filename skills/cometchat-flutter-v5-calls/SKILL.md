---
name: cometchat-flutter-v5-calls
description: "Use when working with CometChat Flutter UIKit v5 call components. Triggers on CometChatCallButtons, CometChatIncomingCall, CometChatOutgoingCall, CometChatOngoingCall, CometChatCallLogs, calling."
license: "MIT"
compatibility: "cometchat_calls_uikit ^5.0.15; cometchat_calls_sdk ^4.2.2; cometchat_sdk ^4.1.2"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat flutter v5 calls voice video incoming outgoing ongoing logs"
---

# CometChat Flutter UIKit v5 — Calls

Components and utilities for voice/video calling.

## Package Structure

Calls are in a **separate package**: `cometchat_calls_uikit`.

```yaml
dependencies:
  cometchat_calls_uikit: ^5.0.15
```

Import everything from:
```dart
import 'package:cometchat_calls_uikit/cometchat_calls_uikit.dart';
```

This re-exports `cometchat_uikit_shared`, `cometchat_sdk`, and `cometchat_calls_sdk`.

## Rule: CALLS_INIT_ORDER

Chat SDK must be initialized BEFORE Calls SDK. The calling extension handles this automatically when configured via `UIKitSettingsBuilder.callingExtension`.

```dart
// ✅ CORRECT — enable calling via UIKitSettings
final settings = (UIKitSettingsBuilder()
      ..appId = 'APP_ID'
      ..region = 'us'
      ..authKey = 'AUTH_KEY'
      ..subscriptionType = CometChatSubscriptionType.allUsers
      ..callingExtension = CometChatCallingExtension())
    .build();

CometChatUIKit.init(uiKitSettings: settings);
```

`CometChatCallingExtension` extends `ExtensionsDataSource` and uses `ChatConfigurator.enable()` to register the calling decorator.

## Rule: CALL_NAVIGATION_CONTEXT

`CallNavigationContext.navigatorKey` must be set on `MaterialApp` for call overlays to navigate:

```dart
MaterialApp(
  navigatorKey: CallNavigationContext.navigatorKey,
)
```

## CometChatCallButtons

Voice and video call buttons for a user or group.

```dart
CometChatCallButtons(user: user)
CometChatCallButtons(group: group, hideVoiceCallButton: true)
```

Key props: `user`, `group`, `callButtonsStyle`, `hideVoiceCallButton`, `hideVideoCallButton`, `outgoingCallConfiguration`, `callSettingsBuilder`, `onError`.

## CometChatCallLogs

Call history list.

```dart
CometChatCallLogs(
  onItemClick: (callLog) {
    // CometChatCallLogDetails is NOT a UIKit export — copy the
    // sample-app pattern from `sample_app/lib/call_log_details/` into
    // your own project and route to it here.
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => YourCallLogDetailsScreen(callLog: callLog),
    ));
  },
)
```

Key props: `callLogsRequestBuilder`, `callLogsStyle`, `onItemClick`, `listItemView`, `subTitleView`, `trailingView`, `onError`.

## CometChatIncomingCall / CometChatOutgoingCall / CometChatOngoingCall

These are typically managed automatically by `CometChatCallingExtension`. Manual usage is rare.

- `CometChatIncomingCall(call: call, onAccept: (BuildContext, Call)? ..., onDecline: (BuildContext, Call)? ...)` — callbacks take `(BuildContext, Call)`, NOT `(Call)` alone.
- `CometChatOutgoingCall(call: returnedCall, user: user OR group: group, onCancelled: (BuildContext, Call)? ...)` — takes the active `Call` object plus the `User` or `Group` it's directed at. The `call:` param holds the result of `CometChatUIKitCalls.initiateCall(...)`. Callbacks are `(BuildContext, Call)?`, NOT `(Call)?` alone.
- `CometChatOngoingCall(callSettingsBuilder: ..., sessionId: ...)`

## Call Flow — Outgoing

1. User taps call button → `CometChatUIKitCalls.initiateCall(call)`
2. `CometChatOutgoingCall` screen pushed
3. Recipient accepts → `CometChatOngoingCall` replaces outgoing
4. Call ends → screens pop back

## Call Flow — Incoming

1. `CometChatCallingExtension` listens via SDK listener
2. `CometChatIncomingCall` overlay displayed via `CallNavigationContext.navigatorKey`
3. Accept → `CometChatUIKitCalls.acceptCall(sessionId)` → `CometChatOngoingCall`
4. Decline → `CometChatUIKitCalls.rejectCall(sessionId, status)`

## Incoming Call Handling (Global)

Handle incoming calls at the app level (dashboard/home), not per-screen:

```dart
class _DashboardState extends State<Dashboard>
    with CallListener, CometChatCallEventListener {

  @override
  void initState() {
    super.initState();
    _listenerId = 'calls_${DateTime.now().millisecondsSinceEpoch}';
    CometChat.addCallListener(_listenerId, this);
    CometChatCallEvents.addCallEventsListener(_listenerId, this);
  }

  @override
  void dispose() {
    CometChat.removeCallListener(_listenerId);
    CometChatCallEvents.removeCallEventsListener(_listenerId);
    super.dispose();
  }

  @override
  void onIncomingCallReceived(Call call) {
    // Handle incoming call globally
  }
}
```

## Permissions

Request camera and microphone permissions before calls:

```dart
await [Permission.camera, Permission.microphone].request();
```

## Golden Path — Enable Calling

```dart
// 1. Configure calling extension
final settings = (UIKitSettingsBuilder()
      ..appId = 'APP_ID'
      ..region = 'us'
      ..authKey = 'AUTH_KEY'
      ..subscriptionType = CometChatSubscriptionType.allUsers
      ..callingExtension = CometChatCallingExtension())
    .build();

// 2. Init
CometChatUIKit.init(uiKitSettings: settings);

// 3. Set navigator key
MaterialApp(navigatorKey: CallNavigationContext.navigatorKey)

// 4. Call buttons appear automatically in CometChatMessageHeader
```

## Anti-Patterns

```dart
// ❌ WRONG — forgetting navigatorKey
MaterialApp(/* missing navigatorKey */)

// ❌ WRONG — not enabling calling extension
UIKitSettingsBuilder()..appId = 'APP_ID'..region = 'us'
// Missing: ..callingExtension = CometChatCallingExtension()

// ❌ WRONG — handling incoming calls per-screen instead of globally
```

## Checklist — Calls

- [ ] `CometChatCallingExtension()` set on `UIKitSettingsBuilder.callingExtension`
- [ ] `CallNavigationContext.navigatorKey` set on `MaterialApp.navigatorKey`
- [ ] Incoming call handling is global (dashboard level)
- [ ] Camera/microphone permissions requested
- [ ] Import from `package:cometchat_calls_uikit/cometchat_calls_uikit.dart`
