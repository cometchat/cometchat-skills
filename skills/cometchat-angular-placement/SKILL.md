---
name: cometchat-angular-placement
description: "Where to put chat in an Angular app — Route-based, Sidebar, Modal/Dialog, Tab-based, and Embedded placements. Maps each to CometChat component composition with Angular Router wiring and layout patterns."
license: "MIT"
compatibility: "Angular >=12 <=15; @cometchat/chat-uikit-angular ^4; @cometchat/chat-sdk-javascript ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory, AskUserQuestion"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat angular placement routing sidebar modal tabs embedded layout"
---

## Purpose

Teaches Claude the five canonical placement patterns for putting chat inside an Angular app. Each pattern specifies:

1. Which CometChat components to compose
2. How to wire the placement into Angular Router or Angular Material
3. Layout gotchas (flex containers, height constraints, z-index)
4. When to choose this placement over the alternatives

**Read `cometchat-angular-core` and `cometchat-angular-components` before this skill** — the init/login lifecycle and component catalog are prerequisites.

Ground truth: `docs/ui-kit/angular/getting-started`, `docs/ui-kit/angular/multi-tab-chat-ui-guide`, and `@cometchat/chat-uikit-angular@4.x` composite components.

---

## "What are you building?" — placement recommendation

| User intent | Recommended placement | Experience |
|---|---|---|
| Messaging app (WhatsApp / Telegram style) | **Route-based** — `/conversations` → `/messages/:uid` | Full-page chat inside the app |
| SaaS / marketplace with chat as a feature | **Sidebar** — persistent chat panel alongside main content | Split-pane layout |
| Support app or focused 1-to-1 | **Route-based (single thread)** — no conversation list, go straight into one chat | Single thread |
| Full messaging hub with calls / users / groups | **Tab-based** — Chats / Users / Groups / Calls tabs | Tab-based messenger |
| Occasional chat overlay from a non-chat screen | **Modal/Dialog** — Angular Material `MatDialog` or CDK overlay | Modal |
| Chat embedded inside an existing page section | **Embedded** — CometChat components inside a parent layout | Inline |

---

## Visual reference — five Angular placement patterns

### 1. Route-based (full page)

```
┌─────────────────────────────────────────┐
│ ← Hiking Group                    ⋮     │  ← cometchat-message-header
├─────────────────────────────────────────┤
│                                         │
│              (messages)                 │  ← cometchat-message-list
│                                         │
├─────────────────────────────────────────┤
│ +  Type a message...               ▶    │  ← cometchat-message-composer
└─────────────────────────────────────────┘
```

### 2. Sidebar (split-pane)

```
┌──────────────┬──────────────────────────┐
│ Conversations│ ← Hiking Group      ⋮    │
│ ─────────────│ ─────────────────────────│
│ Hiking Group │                          │
│ Alice        │      (messages)          │
│ Bob          │                          │
│              │ ─────────────────────────│
│              │ Type a message...    ▶   │
└──────────────┴──────────────────────────┘
```

### 3. Modal/Dialog

```
              ┌──────────────────────┐
              │ Chat with Alice   ✕  │
              ├──────────────────────┤
              │                      │
              │     (messages)       │
              │                      │
              ├──────────────────────┤
              │ Type message...  ▶   │
              └──────────────────────┘
  (page content dimmed behind)
```

### 4. Tab-based

```
┌─────────────────────────────────────────┐
│  Chats  Users  Groups  Calls            │  ← tab bar
├─────────────────────────────────────────┤
│                                         │
│         (active tab content)            │
│                                         │
└─────────────────────────────────────────┘
```

### 5. Embedded (inside an existing page)

```
┌─────────────────────────────────────────┐
│ Product details                         │
│ [product image + specs]                 │
├─────────────────────────────────────────┤
│ Chat with seller                        │
│ ┌─────────────────────────────────────┐ │
│ │ cometchat-message-header            │ │
│ │ cometchat-message-list              │ │  ← embedded chat
│ │ cometchat-message-composer          │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 1. Route-based placement

The most common pattern — chat lives in its own route, navigated via Angular Router.

### Pattern A — Conversations list → Messages (two routes)

```typescript
// app-routing.module.ts
import { Routes } from "@angular/router";
import { ConversationsComponent } from "./conversations/conversations.component";
import { MessagesComponent } from "./messages/messages.component";

export const routes: Routes = [
  { path: "conversations", component: ConversationsComponent },
  { path: "messages/user/:uid", component: MessagesComponent },
  { path: "messages/group/:guid", component: MessagesComponent },
  { path: "", redirectTo: "conversations", pathMatch: "full" },
];
```

```typescript
// conversations.component.ts
import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatConversations } from "@cometchat/chat-uikit-angular";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-conversations",
  standalone: true,
  imports: [CometChatConversations],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div style="height: 100vh; display: flex; flex-direction: column;">
      <cometchat-conversations
        [onItemClick]="handleConvClick"
        style="flex: 1; overflow: hidden;"
      ></cometchat-conversations>
    </div>
  `,
})
export class ConversationsComponent {
  constructor(private router: Router) {}

  handleConvClick = (conversation: CometChat.Conversation): void => {
    const entity = conversation.getConversationWith();
    const type = conversation.getConversationType();
    if (type === "user") {
      this.router.navigate(["/messages/user", (entity as CometChat.User).getUid()]);
    } else {
      this.router.navigate(["/messages/group", (entity as CometChat.Group).getGuid()]);
    }
  };
}
```

```typescript
// messages.component.ts
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import {
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
} from "@cometchat/chat-uikit-angular";
import { CommonModule } from "@angular/common";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-messages",
  standalone: true,
  imports: [CommonModule, CometChatMessageHeader, CometChatMessageList, CometChatMessageComposer],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div style="height: 100vh; display: flex; flex-direction: column;">
      <cometchat-message-header
        [user]="selectedUser"
        [group]="selectedGroup"
        [onBack]="goBack"
        [hideBackButton]="false"
      ></cometchat-message-header>
      <cometchat-message-list
        [user]="selectedUser"
        [group]="selectedGroup"
        style="flex: 1; overflow: hidden;"
      ></cometchat-message-list>
      <cometchat-message-composer
        [user]="selectedUser"
        [group]="selectedGroup"
      ></cometchat-message-composer>
    </div>
  `,
})
export class MessagesComponent implements OnInit {
  selectedUser: CometChat.User | undefined;
  selectedGroup: CometChat.Group | undefined;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    const uid = this.route.snapshot.paramMap.get("uid");
    const guid = this.route.snapshot.paramMap.get("guid");

    if (uid) {
      CometChat.getUser(uid).then((user) => (this.selectedUser = user));
    } else if (guid) {
      CometChat.getGroup(guid).then((group) => (this.selectedGroup = group));
    }
  }

  goBack = (): void => {
    this.router.navigate(["/conversations"]);
  };
}
```

### Pattern B — Single thread (no conversation list)

For support chat, marketplace "Contact seller", or any focused 1-to-1 where the target is known in advance.

```typescript
// support-chat.component.ts
@Component({
  selector: "app-support-chat",
  standalone: true,
  imports: [CommonModule, CometChatMessageHeader, CometChatMessageList, CometChatMessageComposer],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div *ngIf="agent; else loading" style="height: 100vh; display: flex; flex-direction: column;">
      <cometchat-message-header [user]="agent"></cometchat-message-header>
      <cometchat-message-list
        [user]="agent"
        style="flex: 1; overflow: hidden;"
      ></cometchat-message-list>
      <cometchat-message-composer [user]="agent"></cometchat-message-composer>
    </div>
    <ng-template #loading><p>Connecting to support...</p></ng-template>
  `,
})
export class SupportChatComponent implements OnInit {
  agent: CometChat.User | undefined;

  ngOnInit(): void {
    CometChat.getUser("support-agent-uid").then((user) => (this.agent = user));
  }
}
```

---

## 2. Sidebar placement (split-pane)

For SaaS apps where chat is a persistent panel alongside main content.

```typescript
// chat-layout.component.ts
@Component({
  selector: "app-chat-layout",
  standalone: true,
  imports: [
    CommonModule,
    CometChatConversations,
    CometChatMessageHeader,
    CometChatMessageList,
    CometChatMessageComposer,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div style="display: flex; height: 100vh; overflow: hidden;">
      <!-- Sidebar: conversation list -->
      <div style="width: 320px; flex-shrink: 0; border-right: 1px solid #e8e8e8; overflow: hidden;">
        <cometchat-conversations
          [onItemClick]="handleConvClick"
          [activeConversation]="activeConversation"
          style="height: 100%;"
        ></cometchat-conversations>
      </div>

      <!-- Main: message thread -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
        <ng-container *ngIf="selectedUser || selectedGroup; else placeholder">
          <cometchat-message-header
            [user]="selectedUser"
            [group]="selectedGroup"
            [hideBackButton]="true"
          ></cometchat-message-header>
          <cometchat-message-list
            [user]="selectedUser"
            [group]="selectedGroup"
            style="flex: 1; overflow: hidden;"
          ></cometchat-message-list>
          <cometchat-message-composer
            [user]="selectedUser"
            [group]="selectedGroup"
          ></cometchat-message-composer>
        </ng-container>
        <ng-template #placeholder>
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: #727272;">
            Select a conversation to start chatting
          </div>
        </ng-template>
      </div>
    </div>
  `,
})
export class ChatLayoutComponent {
  selectedUser: CometChat.User | undefined;
  selectedGroup: CometChat.Group | undefined;
  activeConversation: CometChat.Conversation | undefined;

  handleConvClick = (conversation: CometChat.Conversation): void => {
    this.activeConversation = conversation;
    const entity = conversation.getConversationWith();
    if (entity instanceof CometChat.User) {
      this.selectedUser = entity;
      this.selectedGroup = undefined;
    } else {
      this.selectedGroup = entity as CometChat.Group;
      this.selectedUser = undefined;
    }
  };
}
```

### Sidebar layout notes

- The sidebar container needs `overflow: hidden` — `<cometchat-conversations>` fills 100% of its parent.
- The message area needs `flex: 1; overflow: hidden` so the list fills the remaining space.
- Pass `[activeConversation]` to `<cometchat-conversations>` to highlight the selected row.
- `[hideBackButton]="true"` on the header since there's no navigation to go back to.

---

## 3. Modal/Dialog placement

For occasional chat that doesn't belong in the primary navigation. Use Angular Material `MatDialog` or Angular CDK overlay.

### ⚠️ Critical — never use `<cometchat-conversations-with-messages>` in a modal

The composite renders a 3-panel layout (Conversations + Messages + Details) and needs **≥ 1024px** of horizontal space. Modals are typically 480–960px wide; the Details panel ends up as empty whitespace and the layout looks broken (one column unused, X close button orphaned). Use the **Two-pane** pattern (Pattern A0) for inbox-in-modal, or the **Granular** 1:1 pattern (Pattern A) for "Contact seller"-style direct chat.

### Pattern A0 — Inbox in modal (Two-pane: Conversations + Messages)

For "click → open a modal showing the user's inbox + selected thread" (Slack-in-a-popup style).

```typescript
// inbox-modal.component.ts
import { Component, OnInit } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import {
  CometChatConversations,
  CometChatMessages,
} from "@cometchat/chat-uikit-angular";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-inbox-modal",
  standalone: true,
  imports: [CommonModule, CometChatConversations, CometChatMessages],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div style="display: flex; width: 800px; height: 600px;">
      <cometchat-conversations
        style="flex: 0 0 320px; border-right: 1px solid #e5e7eb;"
        [activeConversation]="activeConversation"
        [onItemClick]="onConversationClick"
      ></cometchat-conversations>
      <cometchat-messages
        *ngIf="activeUser || activeGroup; else empty"
        [user]="activeUser"
        [group]="activeGroup"
        style="flex: 1 1 auto;"
      ></cometchat-messages>
      <ng-template #empty>
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: #9ca3af;">
          Select a conversation
        </div>
      </ng-template>
    </div>
  `,
})
export class InboxModalComponent {
  activeConversation: CometChat.Conversation | null = null;
  activeUser: CometChat.User | null = null;
  activeGroup: CometChat.Group | null = null;

  constructor(public dialogRef: MatDialogRef<InboxModalComponent>) {}

  onConversationClick = (conv: CometChat.Conversation): void => {
    this.activeConversation = conv;
    const target = conv.getConversationWith();
    if (target instanceof CometChat.User) {
      this.activeUser = target;
      this.activeGroup = null;
    } else {
      this.activeGroup = target as CometChat.Group;
      this.activeUser = null;
    }
  };
}
```

```typescript
// Trigger:
this.dialog.open(InboxModalComponent, { panelClass: "inbox-dialog" });
```

Why this works in modal sizing where the composite doesn't:
- **No third panel** — Conversations (left) + Messages (right) consumes the entire dialog width.
- **Explicit flex sizing** — Conversations is fixed-width (`flex: 0 0 320px`), Messages takes the rest (`flex: 1 1 auto`). No empty whitespace.
- **Empty state handled** — `*ngIf` shows a "Select a conversation" placeholder until the user clicks one.

### Pattern A — Angular Material MatDialog (recommended)

```typescript
// chat-dialog.component.ts
import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import {
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
} from "@cometchat/chat-uikit-angular";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-chat-dialog",
  standalone: true,
  imports: [CometChatMessageHeader, CometChatMessageList, CometChatMessageComposer],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div style="width: 480px; height: 600px; display: flex; flex-direction: column;">
      <cometchat-message-header
        [user]="data.user"
        [onBack]="close"
        [hideBackButton]="false"
      ></cometchat-message-header>
      <cometchat-message-list
        [user]="data.user"
        style="flex: 1; overflow: hidden;"
      ></cometchat-message-list>
      <cometchat-message-composer [user]="data.user"></cometchat-message-composer>
    </div>
  `,
})
export class ChatDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ChatDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user: CometChat.User }
  ) {}

  close = (): void => this.dialogRef.close();
}
```

```typescript
// Trigger from any component:
import { MatDialog } from "@angular/material/dialog";

@Component({ /* ... */ })
export class ProductComponent {
  constructor(private dialog: MatDialog) {}

  openChat(sellerUid: string): void {
    CometChat.getUser(sellerUid).then((user) => {
      this.dialog.open(ChatDialogComponent, {
        data: { user },
        panelClass: "chat-dialog",
        disableClose: false,
      });
    });
  }
}
```

### Pattern B — Angular CDK Overlay (no Material dependency)

```typescript
import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";

@Component({ /* ... */ })
export class TriggerComponent {
  private overlayRef: OverlayRef | null = null;

  constructor(private overlay: Overlay) {}

  openChat(): void {
    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
    });
    const portal = new ComponentPortal(ChatDialogComponent);
    this.overlayRef.attach(portal);
    this.overlayRef.backdropClick().subscribe(() => this.overlayRef?.dispose());
  }
}
```

---

## 4. Tab-based placement

For full-featured messengers with distinct entry points per content type. Use Angular Material `MatTabGroup` or a custom tab bar.

```typescript
// chat-tabs.component.ts
import { Component } from "@angular/core";
import { MatTabsModule } from "@angular/material/tabs";
import {
  CometChatConversations,
  CometChatUsers,
  CometChatGroups,
  CometChatCallLogs,
} from "@cometchat/chat-uikit-angular";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-chat-tabs",
  standalone: true,
  imports: [MatTabsModule, CometChatConversations, CometChatUsers, CometChatGroups, CometChatCallLogs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <mat-tab-group style="height: 100vh;" animationDuration="0ms">
      <mat-tab label="Chats">
        <cometchat-conversations
          [onItemClick]="handleConvClick"
          style="height: calc(100vh - 48px);"
        ></cometchat-conversations>
      </mat-tab>
      <mat-tab label="Users">
        <cometchat-users
          [onItemClick]="handleUserClick"
          style="height: calc(100vh - 48px);"
        ></cometchat-users>
      </mat-tab>
      <mat-tab label="Groups">
        <cometchat-groups
          [onItemClick]="handleGroupClick"
          style="height: calc(100vh - 48px);"
        ></cometchat-groups>
      </mat-tab>
      <mat-tab label="Calls">
        <cometchat-call-logs
          style="height: calc(100vh - 48px);"
        ></cometchat-call-logs>
      </mat-tab>
    </mat-tab-group>
  `,
})
export class ChatTabsComponent {
  handleConvClick = (conversation: CometChat.Conversation): void => { /* navigate */ };
  handleUserClick = (user: CometChat.User): void => { /* navigate */ };
  handleGroupClick = (group: CometChat.Group): void => { /* navigate */ };
}
```

### Tab wiring notes

- `animationDuration="0ms"` prevents the tab content from fading in/out, which can cause CometChat components to re-initialize.
- Each tab's content needs an explicit height — `calc(100vh - 48px)` subtracts the tab bar height (48px for Material default).
- For the **Calls** tab, `<cometchat-call-logs>` only works when `@cometchat/calls-sdk-javascript` is installed. Omit the Calls tab if the project doesn't use calling.

---

## 5. Embedded placement

Chat inside an existing page section, not its own route.

```typescript
// product-detail.component.ts
@Component({
  selector: "app-product-detail",
  standalone: true,
  imports: [
    CommonModule,
    CometChatMessageHeader,
    CometChatMessageList,
    CometChatMessageComposer,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="product-page">
      <div class="product-info">
        <!-- product details -->
      </div>

      <div class="chat-section">
        <h3>Chat with seller</h3>
        <div style="height: 480px; display: flex; flex-direction: column; border: 1px solid #e8e8e8; border-radius: 8px; overflow: hidden;">
          <ng-container *ngIf="seller; else loadingChat">
            <cometchat-message-header
              [user]="seller"
              [hideBackButton]="true"
            ></cometchat-message-header>
            <cometchat-message-list
              [user]="seller"
              style="flex: 1; overflow: hidden;"
            ></cometchat-message-list>
            <cometchat-message-composer [user]="seller"></cometchat-message-composer>
          </ng-container>
          <ng-template #loadingChat>
            <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
              Loading chat...
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
})
export class ProductDetailComponent implements OnInit {
  seller: CometChat.User | undefined;

  ngOnInit(): void {
    CometChat.getUser(this.product.sellerUid).then((user) => (this.seller = user));
  }
}
```

### Embedded gotchas

- **Fixed height required.** CometChat components fill 100% of their parent. Without a bounded height (`height: 480px` or `flex: 1` inside a flex container), the list collapses to zero height and renders empty.
- **Overflow hidden on the container.** The inner components have their own scroll — the outer container must not scroll over them.
- Usually the embedded pattern is the wrong default — prefer a Modal trigger from a button on the page, which gives users a dedicated surface for chatting.

---

## Hard rules

These apply to ALL placement patterns.

1. **NEVER modify the project's existing router without reading it first.** Understand what's there before adding routes or outlets. Don't replace a user's navigation structure unless they explicitly chose "demo mode."

2. **ALWAYS give CometChat containers a bounded height.** Components fill 100% of their parent. If the parent has no bounded height, components collapse to zero height and look empty. Use `height: 100vh`, `height: calc(100vh - Npx)`, or `flex: 1` inside a flex column.

3. **Pass either `[user]` or `[group]`, never both.** Passing both causes runtime errors. Branch in the template based on which one is set.

4. **Resolve user / group before rendering.** The `[user]` and `[group]` inputs expect `CometChat.User` and `CometChat.Group` instances — not bare UID strings. Fetch via `CometChat.getUser(uid)` / `CometChat.getGroup(guid)` in `ngOnInit` and gate the render on the resolved object with `*ngIf`.

5. **Wire `[onThreadRepliesClick]` if you want threads**, or leave it unwired to keep the thread option hidden. The `[onThreadRepliesClick]` input is an `@Input()` callback — use `[onThreadRepliesClick]="myFn"` (square brackets). See `cometchat-angular-components` § 11 for the full threading pattern.

6. **For modal placements, set an explicit width and height on the dialog container.** Angular Material dialogs don't constrain their content by default — without explicit dimensions, CometChat components may render at 0px.

6a. **Never use `<cometchat-conversations-with-messages>` (or `<cometchat-users-with-messages>` / `<cometchat-groups-with-messages>`) inside a modal, dialog, drawer, or sidebar.** These composites render a 3-panel layout (List + Messages + Details) and need ≥ 1024px of horizontal space. In a 480–960px modal, the Details panel ends up as empty whitespace and the layout looks broken. Use the Two-pane pattern (`<cometchat-conversations>` + `<cometchat-messages>`, see § 3 Pattern A0) for inbox-in-modal, or the Granular pattern (`<cometchat-message-header>` + `-message-list>` + `-message-composer>`, see § 3 Pattern A) for 1:1 chat.

7. **For sidebar placements, use `overflow: hidden` on both the sidebar and message area containers.** CometChat components have internal scroll; the outer containers must not add a second scroll layer.

8. **Never animate a CometChat-containing container with CSS `transform`.** `transform` creates a new stacking context, which reparents `position: fixed` overlays (emoji picker, action sheet, reactions popover) and makes them misalign. Animate `left` / `right` / `top` / `bottom` offsets instead.

---

## Skill routing reference

| Skill | When to route |
|---|---|
| `cometchat-angular-core` | Always first — init, login, module setup |
| `cometchat-angular-components` | For component prop details — always |
| `cometchat-angular-placement` | This skill — picking + wiring a placement |
| `cometchat-angular-patterns` | Angular-specific routing, lazy loading, guards |
| `cometchat-angular-theming` | Customize colors / typography / dark mode |
| `cometchat-angular-features` | Calls, extensions, AI — the "add a feature" flow |
| `cometchat-angular-customization` | Custom slot views, text formatters, events |
| `cometchat-angular-production` | Server-side auth tokens |
| `cometchat-angular-troubleshooting` | Blank chat / height issues / dialog sizing |
