---
name: cometchat-angular-features
description: "Feature catalog for Angular — calls (separate SDK), extensions (polls / stickers / translation / link preview / collaborative doc / whiteboard), AI features (smart replies / conversation summary / conversation starter), AI agent. Six-bucket taxonomy: default / extension / ai-feature / dashboard-only / package-install / component-swap."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular features calls extensions ai polls stickers"
---

## Purpose

Teaches Claude how to add features on top of a working CometChat Angular integration. Classifies each feature into one of four types and gives the correct recipe for each.

**Read `cometchat-angular-core` + `cometchat-angular-components` + `cometchat-angular-patterns` first** — a base integration must already exist before features layer on.

Ground truth: `docs/ui-kit/angular/core-features`, `docs/ui-kit/angular/calling-integration`, `docs/ui-kit/angular/extensions`, `docs/ui-kit/angular/guide-ai-agent`, and `@cometchat/chat-uikit-angular@4.x` exports.

---

## 1. Feature taxonomy

Every CometChat feature falls into exactly one of four categories:

| Category | What it means | Example features | How to enable |
|---|---|---|---|
| **Default** | Already on — no action needed. Shipped with the kit's base components. | Instant messaging, typing indicators, read receipts, reactions, replies, @mentions, media upload, edit/delete, message info | Just render `<cometchat-message-header>` + `<cometchat-message-list>` + `<cometchat-message-composer>` |
| **Extension** | Boolean backend toggle. CLI flips it via the dashboard API. UI Kit auto-wires once enabled. | Polls, stickers, message translation, link preview, collaborative doc/whiteboard, thumbnail generation | `cometchat apply-feature <id> --app-id <X>` → hard-reload |
| **AI feature** | Backend AI toggle that requires an OpenAI API key. CLI sets the key + flips the toggle. | Smart replies, conversation summary, conversation starter | `cometchat apply-feature smart-replies --app-id <X> --openai-key sk-…` |
| **Dashboard-only** | Third-party API key / multi-field config the user has to supply. CLI cannot automate. | Giphy, Stipop, Tenor, Chatwoot, Intercom, Disappearing Messages, Message Shortcuts | Open https://app.cometchat.com → Extensions |
| **Package-install** | Install an additional npm package. The UI Kit auto-detects the package on next init. | Voice + video calls (`@cometchat/calls-sdk-javascript`) | `npm install ...` → rebuild |
| **Component-swap** | Replace or wrap a UI Kit component with a customized version. | Custom text formatter, custom message templates, AI Agent chat history | Write a new component + pass via Angular input |

---

## 2. Enabling extension and AI features (`apply-feature`)

Angular projects don't go through `cometchat apply` (no `.cometchat/state.json`), so always pass `--app-id <id>` explicitly. The CLI hits the dashboard API using the bearer from `cometchat auth login`.

### Extension features

```bash
cometchat apply-feature polls --app-id <your-app-id>
cometchat apply-feature link-preview --app-id <your-app-id>
```

### AI features (smart replies, conversation summary, conversation starter)

These need an OpenAI API key on the app. The CLI sets the key + flips the toggle in one call:

```bash
cometchat apply-feature smart-replies --app-id <your-app-id> --openai-key sk-...
```

The key is stored on the app once, so subsequent ai-feature applies don't need `--openai-key` repeated. Get one at https://platform.openai.com/api-keys.

### Response shapes

- `"status": "applied"` → done. Hard-reload the Angular dev server.
- `"status": "already-applied"` → already in the desired state.
- `"status": "auth-required"` → `cometchat auth login` first.
- `"status": "openai-key-required"` → re-run with `--openai-key sk-…`.
- `"status": "manual-action-required"` → dashboard-only feature (Giphy, Stipop, Tenor, Chatwoot, Intercom, message-shortcuts, disappearing-messages). Surface `next_steps` verbatim — these need third-party config.
- `"status": "error"` → surface `next_steps`.

### Dashboard fallback

Only when the CLI returns `error` or isn't available:
1. https://app.cometchat.com → your app
2. Chat & Messaging → Features
3. Find the extension by name → flip Status ON
4. Hard-reload the Angular app (`ng serve` restart or browser refresh)

### What each toggle does

| Extension | UI surface when enabled |
|---|---|
| Polls | Polls option in `<cometchat-message-composer>`'s attachment menu |
| Stickers | Sticker picker in the composer |
| Smart replies | Chip suggestions above the composer input after an incoming message |
| Message translation | "Translate" option in the message long-press menu |
| Link preview | Rich-card bubble for URLs in the message list |
| Collaborative document | Option in composer's attachment menu; opens a shared doc on click |
| Collaborative whiteboard | Option in composer's attachment menu; opens a shared canvas |
| Thumbnail generation | Image / video bubbles show thumbnails instead of full-size downloads |

### Gotcha — `auto_wired_in_uikit: false`

A minority of extensions need extra wiring via the `extensions` field on `UIKitSettingsBuilder`. The CLI flags this in its success response:

```json
{
  "status": "enabled",
  "name": "stickers",
  "auto_wired_in_uikit": false,
  "next_steps": ["Pass the extension via the extensions field on UIKitSettingsBuilder"]
}
```

If `auto_wired_in_uikit` is `false`, import the matching `ExtensionsDataSource` and pass it via `.setExtensions()` on the builder:

```typescript
import { UIKitSettingsBuilder } from "@cometchat/uikit-shared";
import { StickersExtension, PollsExtension } from "@cometchat/chat-uikit-angular";

const settings = new UIKitSettingsBuilder()
  .setAppId(APP_ID)
  .setRegion(REGION)
  .setAuthKey(AUTH_KEY)
  .setExtensions([new StickersExtension(), new PollsExtension()])
  .build();
```

---

## 3. Calls (package-install)

Calls require the separate `@cometchat/calls-sdk-javascript` package.

### 3a — Install the calls SDK

```bash
npm install @cometchat/calls-sdk-javascript
```

No native peer deps needed for web (unlike React Native). Rebuild the Angular app after installing.

### 3b — Register the call listener at the app root

The incoming-call UI only shows up if you've registered a listener. Add this to `AppComponent`:

```typescript
// app.component.ts
import { Component, OnInit, OnDestroy } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatIncomingCall } from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-root",
  template: `
    <router-outlet></router-outlet>
    <cometchat-incoming-call
      *ngIf="incomingCall"
      [call]="incomingCall"
      [onAccept]="handleAccept"
      [onDecline]="handleDecline"
    ></cometchat-incoming-call>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  incomingCall: CometChat.Call | null = null;
  private readonly LISTENER_ID = "APP_CALL_LISTENER";

  ngOnInit(): void {
    CometChat.addCallListener(
      this.LISTENER_ID,
      new CometChat.CallListener({
        onIncomingCallReceived: (call: CometChat.Call) => {
          this.incomingCall = call;
        },
        onOutgoingCallAccepted: () => {
          // navigate to ongoing-call route
        },
        onOutgoingCallRejected: () => {
          this.incomingCall = null;
        },
        onIncomingCallCancelled: () => {
          this.incomingCall = null;
        },
        onCallEndedMessageReceived: () => {
          this.incomingCall = null;
        },
      })
    );
  }

  ngOnDestroy(): void {
    CometChat.removeCallListener(this.LISTENER_ID);
  }

  handleAccept = (call: CometChat.Call): void => {
    this.incomingCall = null;
    // navigate to /ongoing-call
  };

  handleDecline = (): void => {
    this.incomingCall = null;
  };
}
```

### 3c — Call buttons in the message header

Once the calls SDK is installed, add `<cometchat-call-buttons>` to the message header's `[menu]` slot:

```html
<!-- messages.component.html -->
<cometchat-message-header
  [user]="selectedUser"
  [menu]="callButtonsTemplate"
></cometchat-message-header>

<ng-template #callButtonsTemplate>
  <cometchat-call-buttons
    [user]="selectedUser"
    [onVoiceCallClick]="handleVoiceCall"
    [onVideoCallClick]="handleVideoCall"
  ></cometchat-call-buttons>
</ng-template>
```

### 3d — Ongoing call

Mount `<cometchat-ongoing-call>` with the session ID. To detect when the call ends, subscribe to `CometChatCallEvents.ccCallEnded` from the event bus — there is no `(onCallEnded)` output on the component:

```typescript
// ongoing-call.component.ts
import { CometChatCallEvents } from "@cometchat/chat-uikit-angular";

@Component({
  selector: "app-ongoing-call",
  standalone: true,
  imports: [CometChatOngoingCall],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <cometchat-ongoing-call
      [sessionID]="sessionId"
    ></cometchat-ongoing-call>
  `,
})
export class OngoingCallComponent implements OnInit, OnDestroy {
  sessionId = "";
  private callEndedSub: any;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.queryParamMap.get("sessionId") ?? "";
    // Subscribe to call-ended event via the event bus
    this.callEndedSub = (CometChatCallEvents.ccCallEnded as any).subscribe(() => {
      this.router.navigate(["/conversations"]);
    });
  }

  ngOnDestroy(): void {
    this.callEndedSub?.unsubscribe();
  }
}
```

### 3e — Call logs

```html
<cometchat-call-logs
  [onItemClick]="openCallDetails"
></cometchat-call-logs>
```

> **`[onItemClick]` is an `@Input()` callback** — use square brackets, not round brackets.

---

## 4. AI Agent (dashboard setup required)

### 4a — Dashboard setup

1. https://app.cometchat.com → your app → AI → Agents
2. Create a new agent (name, system prompt, model)
3. Assign a UID to the agent (e.g. `ai-support-agent`)

Once the agent exists, users can message it like any other user.

### 4b — Chatting with the AI agent

The Angular v4 UIKit does **not** ship a dedicated AI assistant component (`<cometchat-ai-assistant-chat-history>` is React v6 only). To chat with an AI agent, use the standard message components targeted at the agent's UID:

```typescript
// Fetch the AI agent as a CometChat.User
CometChat.getUser("ai-support-agent").then((agentUser) => {
  this.aiAgent = agentUser;
});
```

```html
<!-- Standard message view pointed at the AI agent UID -->
<cometchat-message-header [user]="aiAgent"></cometchat-message-header>
<cometchat-message-list [user]="aiAgent"></cometchat-message-list>
<cometchat-message-composer [user]="aiAgent"></cometchat-message-composer>
```

Smart Replies, Conversation Starter, and Conversation Summary AI features surface automatically in the composer and message list once enabled in the dashboard — no extra component needed.

---

## 5b. Deep patterns for three most-requested features

### Calls — custom call listener

After installing `@cometchat/calls-sdk-javascript`, call buttons auto-appear. For custom call state handling:

```typescript
// In AppComponent — register once at the root
CometChat.addCallListener(
  "APP_CALL_LISTENER",
  new CometChat.CallListener({
    onIncomingCallReceived: (call: CometChat.Call) => { this.incomingCall = call; },
    onOutgoingCallAccepted: (call: CometChat.Call) => {
      this.outgoingCall = null;
      this.ongoingSessionId = call.getSessionId();
    },
    onOutgoingCallRejected: () => { this.outgoingCall = null; },
    onIncomingCallCancelled: () => { this.incomingCall = null; },
    onCallEndedMessageReceived: () => {
      this.incomingCall = null;
      this.outgoingCall = null;
      this.ongoingSessionId = null;
    },
  })
);
```

### Smart replies — reading extension metadata

After enabling Smart Replies in the dashboard, the UI Kit auto-renders chips above the composer. For a custom UI, read the metadata from the incoming message:

```typescript
// In a message event subscription or custom message template:
const metadata = message.getMetadata() as Record<string, any>;
const smartReply = metadata?.['@injected']?.['extensions']?.['smart-reply'];

if (smartReply) {
  const replies = [
    smartReply.reply_positive,
    smartReply.reply_neutral,
    smartReply.reply_negative,
  ].filter(Boolean);
  // Render reply chips
}
```

### Presence — live online/offline status in custom UI

Presence indicators are built into `<cometchat-conversations>`, `<cometchat-users>`, and `<cometchat-group-members>` automatically. For custom UI that needs live status:

```typescript
import { Component, OnInit, OnDestroy, Input } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({
  selector: "app-user-status",
  template: `<span [style.color]="isOnline ? '#09C26F' : '#a1a1a1'">
    {{ isOnline ? 'Online' : 'Offline' }}
  </span>`,
})
export class UserStatusComponent implements OnInit, OnDestroy {
  @Input() uid!: string;
  isOnline = false;
  private readonly LISTENER_ID = `presence-${Date.now()}`;

  ngOnInit(): void {
    // Fetch initial state
    CometChat.getUser(this.uid).then((u) => {
      this.isOnline = u.getStatus() === "online";
    });

    // Subscribe to live changes
    CometChat.addUserListener(
      this.LISTENER_ID,
      new CometChat.UserListener({
        onUserOnline: (user: CometChat.User) => {
          if (user.getUid() === this.uid) this.isOnline = true;
        },
        onUserOffline: (user: CometChat.User) => {
          if (user.getUid() === this.uid) this.isOnline = false;
        },
      })
    );
  }

  ngOnDestroy(): void {
    CometChat.removeUserListener(this.LISTENER_ID);
  }
}
```

---

The following work from day 1 without any feature-enabling step:

- **Instant messaging** (text, with real-time delivery)
- **Media sharing** (images, video, audio, files)
- **Read receipts** (single tick = sent, double tick = delivered, blue = read)
- **Typing indicators**
- **@mentions** (requires `CometChatMentionsFormatter` in `[textFormatters]`)
- **Reactions** (click any message to add emoji reaction)
- **Replies** (click → Reply)
- **Edit / delete** own messages
- **Message info** — sender sees delivery + read timestamps per-recipient
- **Voice messages** (record + send from composer)
- **Search** (`[hideSearch]="false"` on `<cometchat-conversations>`, `<cometchat-users>`, `<cometchat-groups>`)
- **Group management** (create via `<cometchat-create-group>`, add members, leave, transfer ownership)

---

## 6. Finding a feature's category quickly

When a user asks for a feature, use this flow:

1. **Is it in the core-features list (§ 5)?** → Already works. Confirm no `[hide*]` input is turning it off.
2. **Is it voice / video / call history?** → Calls (§ 3). Package install.
3. **Is it polls, stickers, message translation, link preview, collaborative doc / whiteboard, thumbnails?** → Extension (§ 2). Run `cometchat apply-feature <id> --app-id <X>`.
3a. **Is it smart replies, conversation summary, or conversation starter?** → AI feature (§ 2). Run `cometchat apply-feature <id> --app-id <X> --openai-key sk-...`.
3b. **Is it Giphy / Stipop / Tenor / Chatwoot / Intercom / Disappearing Messages / Message Shortcuts?** → Dashboard-only (§ 2). User must enter third-party config in https://app.cometchat.com → Extensions.
4. **Is it AI agent?** → § 4.
5. **Is it custom text formatting, custom message templates, custom slot views, custom theme?** → This is **customization**, not a feature. Route to `cometchat-angular-customization` or `cometchat-angular-theming`.
6. **Not on this list?** → Check `docs/ui-kit/angular/guide-overview` + the kit's exports. If still nothing, tell the user the feature isn't in the UI Kit; they may need to build it with the SDK directly.

---

## 7. Anti-patterns

1. **Do NOT speculatively install the calls SDK.** Install only after the user says they want calls.

2. **Do NOT enable extensions your app doesn't use.** Each enabled extension adds data-fetching overhead.

3. **Do NOT wire the call listener per-component.** It should be once, at the app root (`AppComponent`). Per-component registration causes missed incoming calls when the user navigates away.

4. **Do NOT forget to unsubscribe / remove listeners in `ngOnDestroy`.** Angular components are destroyed on navigation — leaked listeners cause duplicate event handling.

5. **Do NOT reference AI tools or streaming APIs from memory.** These APIs change across UIKit minor versions. Query the docs MCP before generating code.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Init / login / module setup |
| `cometchat-angular-components` | Component prop reference (for `<cometchat-call-buttons>`, `<cometchat-ongoing-call>`, etc.) |
| `cometchat-angular-placement` | Where the ongoing-call route, call-logs tab, AI chat route go |
| `cometchat-angular-features` | This skill — which features exist + how to enable each |
| `cometchat-angular-theming` | Theming call buttons, reaction colors, extension UI colors |
| `cometchat-angular-customization` | Custom text formatters, custom message templates, event bus |
| `cometchat-angular-production` | Production auth tokens (prerequisite for AI agent in prod) |
| `cometchat-angular-troubleshooting` | Extension not showing after enabling, call permissions denied |
