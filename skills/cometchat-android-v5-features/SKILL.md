---
name: cometchat-android-v5-features
description: "Add features (calls, reactions, polls, file sharing, AI, etc.) to an already-integrated CometChat project. Routes to the right sub-flow based on feature type."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat android features extensions calls reactions polls ai-features"
---

> **Companion skills:** `cometchat-android-v5-core` covers initialization;
> `cometchat-android-v5-customization` covers deeper component customization;
> `cometchat-android-v5-extensions` covers the extension architecture.

## Purpose

This skill teaches how CometChat features are structured and what work is required to enable each one. Most features require zero code — they are either already built into the UI Kit, toggled via the `cometchat apply-feature` CLI (extensions + AI features), or activated by adding a dependency (calls).

---

## Use this skill when

- "Add reactions to my chat"
- "Add video calling"
- "Enable polls"
- "Add file sharing"
- "Enable smart replies"

## Do not use this skill when

- Customizing how a feature looks → use `cometchat-android-v5-customization`
- Setting up the initial integration → use `cometchat-android-v5-core`

---

## 1. Feature types

| Type | What it means | Action required |
|---|---|---|
| Type 1 — Default | Built into the UI Kit at compile time | None — already there |
| Type 2a — Extension | Backend extension, pure boolean toggle | `cometchat apply-feature <id> --app-id <X>` (CLI hits dashboard API) |
| Type 2b — AI feature | Backend AI feature requiring an OpenAI key | `cometchat apply-feature <id> --app-id <X> --openai-key sk-...` |
| Type 2c — Dashboard-only | Third-party API key / multi-field config (Giphy, Stipop, Tenor, Chatwoot, Intercom) | Open https://app.cometchat.com → Extensions → configure |
| Type 3 — Package-install | Requires a separate SDK dependency | Add Gradle dependency |
| Type 4 — Component-toggle | Hide/show via `setHide*` / `disable*` methods on the relevant component | Call the setter on the component instance (see catalog) |

---

## 2. Type 1 — Default features (already enabled)

| Feature | Component | Notes |
|---|---|---|
| Text messaging | `CometChatMessageComposer` + `CometChatMessageList` | Core feature |
| Media sharing (image/video/audio/file) | `CometChatMessageComposer` | Attachment button |
| Read receipts | `CometChatMessageList` | `setReceiptsVisibility()` |
| Typing indicators | `CometChatMessageList` + `CometChatConversations` | Auto-enabled |
| User presence (online/offline) | `CometChatConversations`, `CometChatUsers` | Requires `subscribePresenceForAllUsers()` in init |
| Reactions | `CometChatMessageList` | Long-press message → react |
| Mentions (@user, @all) | `CometChatMessageComposer` | Type `@` to trigger |
| Threaded conversations | `CometChatMessageList` | `setReplyInThreadOptionVisibility()` |
| Quoted replies | `CometChatMessageList` | Swipe to reply |
| Edit/delete messages | `CometChatMessageList` | Long-press options |
| Group chat | All components | Use `setGroup()` instead of `setUser()` |
| Report message | `CometChatMessageList` | Long-press → Report |
| Search | `CometChatSearch` | Standalone component |

---

## 3. Type 2 — Backend toggle features (no code needed)

Android projects don't run `cometchat apply`, so call the CLI in stateless mode with `--app-id`:

```bash
# Pure boolean extensions:
cometchat apply-feature polls --app-id <your-app-id>
cometchat apply-feature stickers --app-id <your-app-id>

# AI features (require OpenAI key):
cometchat apply-feature smart-replies --app-id <your-app-id> --openai-key sk-...
cometchat apply-feature conversation-summary --app-id <your-app-id>
cometchat apply-feature conversation-starter --app-id <your-app-id>
```

Requires `cometchat auth login` once per machine.

**Extensions (CLI-toggleable — pure boolean):**
- User Engagement: Polls, Message Translation, Reminders
- Collaboration: Collaborative Document, Collaborative Whiteboard
- Security: Disappearing Messages, E2E Encryption (Enterprise)
- Moderation: Profanity Filter, Image Moderation, Data Masking, Sentiment Analysis, XSS Filter

**AI Features (CLI-toggleable — needs `--openai-key`):**
Conversation Starter, Conversation Summary, Smart Reply

**Dashboard-only (third-party config — open https://app.cometchat.com → Extensions):**
Stickers (Stipop), Giphy, Tenor, Chatwoot, Intercom — these require API keys / webhooks the user must enter manually.

---

## 4. Type 3 — Package-install features

### Voice/Video Calling

Add the calling SDK:

```groovy
implementation 'com.cometchat:calls-sdk-android:4.+'
```

The UI Kit auto-detects the calling SDK and enables call buttons in `CometChatMessageHeader`. No additional code needed — `CometChatIncomingCall`, `CometChatOutgoingCall`, and `CometChatOngoingCall` activate automatically.

Configure call buttons visibility:

```java
CometChatMessageHeader header = findViewById(R.id.header);
header.setVoiceCallButtonVisibility(View.VISIBLE);
header.setVideoCallButtonVisibility(View.VISIBLE);
```

---

## Hard rules

- **Don't write code for Type 1 features.** They're already there. Tell the user where to find them.
- **Don't write code for Type 2a/2b features.** Run `cometchat apply-feature <id> --app-id <X>` (extension) or `... --openai-key sk-...` (ai-feature). The CLI flips the dashboard toggle via API. Never tell the user to "open the dashboard and toggle X" for an extension or ai-feature — that's what the CLI does.
- **For Type 2c (dashboard-only) features**, the CLI cannot automate (third-party keys / multi-field config). Walk the user through the dashboard path returned by `cometchat apply-feature <id>`'s `manual-action-required` response.
- **For Type 3 (calls), just add the Gradle dependency.** The UI Kit handles the rest.
- **Always run `cometchat apply-feature <id>` first** for extensions and AI features. If the user reports a "missing feature," it's almost always an unflipped toggle the CLI can fix in one call.
