---
name: cometchat-ios-features
description: "Feature catalog for CometChat iOS UI Kit — calls, reactions, polls, stickers, AI features, and extensions."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; iOS 13+"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios features calls reactions polls ai stickers extensions"
---

> **Ground truth:** `CometChatUIKitSwift ~> 5` + `packages/registry/v6/features/catalog.json`. (Official docs linked below.) Verify symbols against the installed package/source before relying on them.

## Purpose

> **Canonical public feature-availability matrix:** [Features & Extensions Guide](https://www.cometchat.com/docs/fundamentals/features-and-extensions-guide) — the authoritative source for which integration method (UI Kit / UI Kit Builder / Widget Builder / SDK) supports each feature + dashboard setup + whether code is required. It **outranks the local `catalog.json` snapshot on conflict**; consult it (WebFetch or docs MCP) for any availability decision.


This skill documents all features available in CometChat iOS UI Kit v5 — voice/video calls, reactions, polls, stickers, AI features, and extensions. Use this to understand what's available and how to enable/configure each feature.

### Feature categories — what work each needs

Classify the feature by the product's 5-category "work needed" model before enabling: **Core (zero-setup)** — out of the box (typing, reactions) · **Builder-enabled** — Dashboard API + UI Kit Builder toggle (polls) · **Config-only** — Dashboard API, automatic (link preview) · **Config + settings** — Dashboard API + extra settings/keys, no code (smart replies) · **SDK-integrated** — Dashboard API + **custom client code** (Bitly). **Key rule:** only SDK-integrated features need client code, and **the implementation lives in the docs** — `cometchat features info <id> --json` shows what's needed (`auto_wired_in_uikit: false` ⇒ the toggle alone won't render it; fetch + adapt the doc code, don't hand-roll). Don't assume "enabled = visible" for dashboard extensions.

**Honest-automation boundary:** standard **extensions** (polls, stickers, link-preview, message-translation, etc.) are enabled with a real dashboard API call via `cometchat apply-feature <id> --app-id <your-app-id>` — never tell the user to toggle them manually. But **third-party dashboard-only features** (Giphy, Stipop, Tenor, Chatwoot, Intercom, Disappearing Messages, Message Shortcuts) return `manual-action-required`: they need *your* third-party credentials and **cannot be automated** — state that. **Call recording is a paid plan add-on** (contact CometChat support; no toggle/CLI) — never claim it was enabled (see §1 Voice & Video Calls).

---

## 1. Voice & Video Calls

### Prerequisites

Add the CometChat Calls SDK to your project:

**CocoaPods:**
```ruby
pod 'CometChatCallsSDK', '~> 5.0'
```

**Swift Package Manager:**
```
https://github.com/cometchat/calls-sdk-ios
```

### Required Permissions

Add to `Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is required for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access is required for voice and video calls</string>
```

### Enable Background Modes

In Xcode → Target → Signing & Capabilities → Background Modes:
- ✅ Audio, AirPlay, and Picture in Picture
- ✅ Voice over IP

### Call Buttons

Add call buttons to your message header:

```swift
let messageHeader = CometChatMessageHeader()
messageHeader.set(user: user)

// Call buttons are shown by default when CometChatCallsSDK is available
// To hide them:
messageHeader.hideVideoCallButton = true
messageHeader.hideVoiceCallButton = true
```

### Standalone Call Buttons

```swift
// CometChatCallButtons requires explicit width/height at init — no zero-arg init.
let callButtons = CometChatCallButtons(width: 80, height: 32)
callButtons.set(user: user)

// Or for group calls
callButtons.set(group: group)

// Customize
callButtons.hideVideoCallButton = false
callButtons.hideVoiceCallButton = false
```

### Initiating Calls Programmatically

```swift
import CometChatSDK

// Voice call to user
let call = Call(receiverId: user.uid ?? "", callType: .audio, receiverType: .user)
CometChat.initiateCall(call: call) { call in
    print("Call initiated: \(call?.sessionID ?? "")")
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}

// Video call to user
let videoCall = Call(receiverId: user.uid ?? "", callType: .video, receiverType: .user)
CometChat.initiateCall(call: videoCall) { call in
    print("Video call initiated")
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}

// Group call
let groupCall = Call(receiverId: group.guid ?? "", callType: .video, receiverType: .group)
CometChat.initiateCall(call: groupCall) { call in
    print("Group call initiated")
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}
```

### Handling Incoming Calls

CometChat UI Kit automatically handles incoming calls when properly configured. The `CometChatIncomingCall` view controller is presented automatically.

For custom handling:

```swift
import CometChatSDK

class CallListener: CometChatCallDelegate {
    
    func onIncomingCallReceived(incomingCall: Call?, error: CometChatException?) {
        guard let call = incomingCall else { return }
        
        DispatchQueue.main.async {
            let incomingCallVC = CometChatIncomingCall()
            incomingCallVC.set(call: call)
            incomingCallVC.modalPresentationStyle = .fullScreen
            
            // Present from root view controller
            UIApplication.shared.windows.first?.rootViewController?.present(
                incomingCallVC,
                animated: true
            )
        }
    }
    
    func onOutgoingCallAccepted(acceptedCall: Call?, error: CometChatException?) {
        print("Call accepted")
    }
    
    func onOutgoingCallRejected(rejectedCall: Call?, error: CometChatException?) {
        print("Call rejected")
    }
    
    func onIncomingCallCancelled(canceledCall: Call?, error: CometChatException?) {
        print("Call cancelled")
    }
}

// Register listener
CometChat.addCallListener("call-listener", CallListener())
```

### Call Settings Builder

Customize call behavior:

```swift
#if canImport(CometChatCallsSDK)
import CometChatCallsSDK

let callSettings = CallSettingsBuilder()
    .setIsAudioOnly(false)                    // Video call
    .setDefaultAudioMode("SPEAKER")           // "SPEAKER" or "EARPIECE"
    .setShowSwitchToVideoCall(true)           // Allow switching to video
    // Button visibility uses inverted setXxxButtonDisable(Bool), NOT setShowXxxButton:
    .setEndCallButtonDisable(false)
    .setMuteAudioButtonDisable(false)
    .setPauseVideoButtonDisable(false)
    .setSwitchCameraButtonDisable(false)
    .setAudioModeButtonDisable(false)
    .setStartAudioMuted(false)        // not setStartWithAudioMuted
    .setStartVideoMuted(false)        // not setStartWithVideoMuted
    .build()

let outgoingCall = CometChatOutgoingCall()
outgoingCall.set(call: call)
outgoingCall.set(callSettingsBuilder: callSettings)
#endif
```

### Call Logs

Display call history:

```swift
let callLogs = CometChatCallLogs()
callLogs.set(onItemClick: { callLog in
    // Handle call log tap - maybe initiate a new call
    // (the closure receives the tapped call log as `Any`)
    print("Call log tapped: \(callLog)")
})
navigationController?.pushViewController(callLogs, animated: true)
```

---

## 2. Message Reactions

Reactions are enabled by default in CometChat UI Kit v5.

### Enable/Disable Reactions

```swift
let messageList = CometChatMessageList()
messageList.set(user: user)

// Hide reaction option from message menu
messageList.hideReactionOption = true
```

### Reaction Events

```swift
class ReactionListener: CometChatMessageEventListener {
    
    // ReactionEvent.reaction is a `Reaction?` OBJECT, not a String. The
    // emoji/uid/messageId live on that nested Reaction; the event itself
    // carries parentMessageId/conversationId/receiverId (there is NO `message`
    // or `reactedBy` property on ReactionEvent).
    func onMessageReactionAdded(reactionEvent: ReactionEvent) {
        print("Reaction added: \(reactionEvent.reaction?.reaction ?? "")")
        print("By user: \(reactionEvent.reaction?.uid ?? "")")
        print("On message: \(reactionEvent.reaction?.messageId ?? 0)")
    }
    
    func onMessageReactionRemoved(reactionEvent: ReactionEvent) {
        print("Reaction removed: \(reactionEvent.reaction?.reaction ?? "")")
    }
}

CometChatMessageEvents.addListener("reaction-listener", ReactionListener())
```

### Custom Reaction Set

```swift
// Configure available reactions
let messageList = CometChatMessageList()

// The reaction set is configured through the data source
// See cometchat-ios-customization skill for DataSource customization
```

---

## 3. Polls

Polls allow users to create and vote on questions.

### Enable Polls Extension

```bash
cometchat apply-feature polls --app-id <your-app-id>
```

Once enabled, the poll creation option appears in the attachment menu.

### Create Poll Programmatically

```swift
import CometChatSDK

// Create poll data
let pollData: [String: Any] = [
    "question": "What's your favorite programming language?",
    "options": ["Swift", "Kotlin", "JavaScript", "Python"]
]

// Create custom message with poll type
// CustomMessage has no customType: init — pass the type via the trailing type: label
let pollMessage = CustomMessage(
    receiverUid: user.uid ?? "",
    receiverType: .user,
    customData: pollData,
    type: "extension_poll"
)

CometChat.sendCustomMessage(message: pollMessage) { message in
    print("Poll sent: \(message.id)")
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}
```

### Poll Bubble Customization

```swift
// Polls render via the `CometChatPollsBubble` view (note the plural — there is no
// `CometChatPollBubble`). Its `style` is an INSTANCE property of type `PollBubbleStyle`
// (NOT a static), so you cannot assign `CometChatPollsBubble.style.x = …`.
// To restyle the poll bubble, build a `PollBubbleStyle`, then apply it inside a custom
// message template's bubble view (see cometchat-ios-customization → message templates):
let pollStyle = PollBubbleStyle()
pollStyle.backgroundColor = .secondarySystemBackground
// …set the PollBubbleStyle properties you need, then pass the styled
// CometChatPollsBubble instance from your template's bubbleView closure.
```

---

## 4. Stickers

Stickers provide a fun way to express emotions.

### Enable Stickers

```bash
cometchat apply-feature stickers --app-id <your-app-id>
```

Once enabled, the sticker button appears in the message composer.

### Hide Stickers

```swift
let messageComposer = CometChatMessageComposer()
messageComposer.set(user: user)
messageComposer.hideStickersButton = true
```

### Custom Sticker Packs

Sticker packs are managed through the CometChat Dashboard:
1. Go to CometChat Dashboard
2. Navigate to Extensions → Stickers
3. Add custom sticker packs

---

## 5. AI Features

CometChat provides AI-powered features for enhanced chat experiences.

### Prerequisites — enable each AI feature via the CLI

iOS projects don't run `cometchat apply` (no `.cometchat/state.json`), so call the CLI in stateless mode with `--app-id`. AI features need an OpenAI key the first time:

```bash
cometchat apply-feature smart-replies --app-id <your-app-id> --openai-key sk-...
cometchat apply-feature conversation-summary --app-id <your-app-id>
cometchat apply-feature conversation-starter --app-id <your-app-id>
```

The OpenAI key is stored on the app once. Subsequent ai-feature applies don't need `--openai-key` repeated. Requires `cometchat auth login` once per machine.

Get an OpenAI key at https://platform.openai.com/api-keys.
4. Configure your AI provider (OpenAI, etc.)

### AI Conversation Starter

Suggests conversation starters for new chats:

```swift
let conversationStarter = CometChatAIConversationStarter()

// Set AI message options
conversationStarter.set(aiMessageOptions: [
    "How can I help you today?",
    "What brings you here?",
    "Tell me about your project"
])

// Handle selection
conversationStarter.onMessageClicked { selectedReply in
    print("Selected: \(selectedReply)")
    // Send the selected message
}

// Show loading state
conversationStarter.showLoadingView()

// Hide loading state
conversationStarter.hideLoadingView()

// Show error state
conversationStarter.show(error: true)
```

### AI Smart Replies

Suggests quick replies based on conversation context:

```swift
// Smart replies are automatically shown in the message composer
// when enabled in the dashboard

// To customize the smart replies view:
let messageComposer = CometChatMessageComposer()
messageComposer.set(user: user)

// Smart replies appear above the composer when available
```

### AI Conversation Summary

Generates a summary of the conversation:

```swift
// Conversation summary is available through the AI extension
// Enable in CometChat Dashboard → AI → Conversation Summary

// The summary can be accessed through the message header menu
// or programmatically:

// Get conversation summary
CometChat.getConversationSummary(
    receiverId: user.uid ?? "",
    receiverType: .user
) { summary in
    print("Summary: \(summary)")
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}
```

### AI Assistant / Bot

Create AI-powered chat bots:

```swift
// AI Bots are configured in CometChat Dashboard
// They appear as regular users in the chat

// To start a conversation with an AI bot:
let botUID = "ai-assistant"  // Your bot's UID from dashboard

CometChat.getUser(UID: botUID) { bot in
    guard let bot = bot else { return }
    
    let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer
    messagesVC.set(user: bot)
    // Present the messages view
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}
```

### AI Assistant Bubble Style

```swift
CometChatAIAssistantBubble.style.backgroundColor = .secondarySystemBackground
CometChatAIAssistantBubble.style.textColor = .label
CometChatAIAssistantBubble.style.textFont = CometChatTypography.Body.regular
CometChatAIAssistantBubble.style.borderColor = .separator
CometChatAIAssistantBubble.style.borderWidth = 1
CometChatAIAssistantBubble.style.cornerRadius = CometChatCornerStyle(cornerRadius: 12)
```

---

## 6. Link Preview

Automatically generates previews for URLs shared in messages.

### Enable/Disable Link Preview

Link preview is enabled by default.

```swift
// Link previews are handled automatically
// No additional configuration needed
```

### Link Preview Style

```swift
// Customize link preview appearance
// Link previews use the standard message bubble styling
```

---

## 7. Message Translation

Translate messages to different languages.

### Enable Translation

```bash
cometchat apply-feature message-translation --app-id <your-app-id>
```

### Translate a Message

```swift
// Translation option appears in message menu when enabled
// Users can tap "Translate" to see the translated version

// Programmatic translation: there is NO `CometChat.translateMessage(...)`
// method. Message translation is an extension — invoke it via callExtension
// against the message-translation slug:
CometChat.callExtension(
    slug: "message-translation",
    type: .post,
    endPoint: "v2/translate",
    body: [
        "msgId": textMessage.id,
        "text": textMessage.text,
        "languages": ["es"]   // target languages
    ]
) { response in
    // response is [String: Any]? — read the translated text from the
    // extension payload (see the message-translation extension docs).
    print("Translation response: \(response ?? [:])")
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}
```

---

## 8. Collaborative Features

### Collaborative Whiteboard

Real-time whiteboard for drawing and collaboration:

```bash
# Enable Collaborative Whiteboard via CLI:
cometchat apply-feature collaborative-whiteboard --app-id <your-app-id>
```

```swift
// Whiteboard option appears in attachment menu
// Opens a shared whiteboard session
```

### Collaborative Document

Real-time document editing:

```bash
# Enable Collaborative Document via CLI:
cometchat apply-feature collaborative-document --app-id <your-app-id>
```

```swift
// Document option appears in attachment menu
// Opens a shared document session
```

---

## 9. Typing Indicators

Show when users are typing.

### Enable/Disable Typing Indicators

```swift
let messageComposer = CometChatMessageComposer()
messageComposer.set(user: user)

// Disable sending typing events
messageComposer.disableTypingEvents = true

// Typing indicators in message list
let messageList = CometChatMessageList()
messageList.set(user: user)
// Typing indicators are shown automatically
```

### Listen for Typing Events

```swift
class TypingListener: CometChatMessageDelegate {
    
    func onTypingStarted(_ typingIndicator: TypingIndicator) {
        print("\(typingIndicator.sender?.name ?? "") is typing...")
    }
    
    func onTypingEnded(_ typingIndicator: TypingIndicator) {
        print("\(typingIndicator.sender?.name ?? "") stopped typing")
    }
}

CometChat.addMessageListener("typing-listener", TypingListener())
```

---

## 10. Read Receipts

Show message delivery and read status.

### Enable/Disable Read Receipts

```swift
let messageList = CometChatMessageList()
messageList.set(user: user)

// Hide read receipts
messageList.hideReceipts = true

// In conversations list
let conversations = CometChatConversations()
conversations.hideReceipts = true
```

### Receipt Status

- **Sent** — Message sent to server
- **Delivered** — Message delivered to recipient's device
- **Read** — Message read by recipient

---

## 11. Threaded Messages

Reply to specific messages in threads.

### Enable/Disable Threads

```swift
let messageList = CometChatMessageList()
messageList.set(user: user)

// Hide thread reply option
messageList.hideReplyInThreadOption = true
```

### Open Thread View

```swift
// Thread replies are handled automatically
// Tapping "Reply in thread" opens the thread view

// Programmatic thread access:
messageList.onThreadRepliesClick = { message, template in
    // Custom thread handling
    print("Thread for message: \(message.id)")
}
```

---

## 12. Voice Recording

Record and send voice messages.

### Enable/Disable Voice Recording

```swift
let messageComposer = CometChatMessageComposer()
messageComposer.set(user: user)

// Hide voice recording button
messageComposer.hideVoiceRecordingButton = true
```

### Required Permission

Add to `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access is required for voice messages</string>
```

---

## 13. Live Reactions

Send animated reactions that appear on screen. Live reactions are enabled by default and handled automatically by the SDK.

### Listen for Live Reactions

```swift
class LiveReactionListener: CometChatMessageEventListener {
    
    func ccLiveReaction(reaction: TransientMessage) {
        print("Live reaction received: \(reaction.data)")
        // Show animation on screen
    }
}

CometChatMessageEvents.addListener("live-reaction-listener", LiveReactionListener())
```

---

## 14. Profanity Filter / Data Masking

Filter inappropriate content and mask sensitive data.

### Enable in Dashboard

1. Go to CometChat Dashboard
2. Navigate to Extensions → Profanity Filter
3. Configure blocked words and masking rules

### How It Works

- Messages containing blocked words are automatically filtered
- Sensitive data (credit cards, SSN, etc.) can be masked
- Works on both sent and received messages

---

## 15. Thumbnail Generation

Automatically generates thumbnails for images and videos.

### How It Works

- Thumbnails are generated automatically for media messages
- Displayed in conversation list and message list
- Full media loads on tap

---

## Feature Availability Matrix

| Feature | Requires SDK | Dashboard Config | Default |
|---|---|---|---|
| Voice/Video Calls | CometChatCallsSDK | No | Enabled* |
| Reactions | No | No | Enabled |
| Polls | No | Yes | Enabled |
| Stickers | No | Yes | Enabled |
| AI Features | No | Yes | Disabled |
| Link Preview | No | Yes | Enabled |
| Translation | No | Yes | Disabled |
| Whiteboard | No | Yes | Disabled |
| Collaborative Doc | No | Yes | Disabled |
| Typing Indicators | No | No | Enabled |
| Read Receipts | No | No | Enabled |
| Threaded Messages | No | No | Enabled |
| Voice Recording | No | No | Enabled |
| Live Reactions | No | No | Enabled |
| Profanity Filter | No | Yes | Disabled |

*Calls require CometChatCallsSDK to be installed

---

## Best Practices

1. **Enable only needed features** — Disable unused features to reduce complexity
2. **Configure in Dashboard first** — Most features require Dashboard configuration
3. **Test on real devices** — Calls and voice recording require physical devices
4. **Handle permissions gracefully** — Request permissions before using camera/microphone
5. **Monitor usage** — AI features may have usage limits based on your plan

