---
name: cometchat-angular-placement
description: "Where to put chat in an Angular UI Kit v5 app — Route-based, Sidebar, Modal/Dialog, Tab-based, and Embedded placements. Each maps to standalone-component composition (no composites, no NgModule) with Angular Router / Material wiring."
license: "MIT"
compatibility: "Angular >=17 <22; @cometchat/chat-uikit-angular ^5.0"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular placement routing sidebar modal tabs embedded layout standalone v5"
---

> **Ground truth:** `@cometchat/chat-uikit-angular@5.x` standalone components + `docs/ui-kit/angular`. **Official docs:** https://www.cometchat.com/docs/ui-kit/angular/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify symbols against the installed package/source before relying on them.

## Purpose

The five canonical placement patterns for chat in an Angular app, each as **v5 standalone-component composition**. Read `cometchat-angular-core` (setup) + `cometchat-angular-components` (catalog) first.

**v5 has no composite components.** There is no `<cometchat-conversations-with-messages>` — every layout composes the individual standalone components (`<cometchat-conversations>` + `<cometchat-message-header>` / `-message-list>` / `-message-composer>`). Import each component class into the host standalone component's `imports: []`. No NgModule, no `CUSTOM_ELEMENTS_SCHEMA`.

---

## "What are you building?" — placement recommendation

| User intent | Recommended placement | Experience |
|---|---|---|
| Messaging app (WhatsApp / Telegram style) | **Route-based** — `/conversations` → `/messages/:uid` | Full-page chat |
| SaaS / marketplace with chat as a feature | **Sidebar** — persistent panel alongside main content | Split-pane |
| Support app or focused 1-to-1 | **Route-based (single thread)** — straight into one chat | Single thread |
| Full messaging hub with calls / users / groups | **Tab-based** — Chats / Users / Groups / Calls tabs | Tabbed messenger |
| Occasional chat overlay from a non-chat screen | **Modal/Dialog** — Angular Material `MatDialog` / CDK overlay | Modal |
| Chat embedded inside an existing page section | **Embedded** — components inside a parent layout | Inline |

---

## Visual reference

```
1. Route-based (full page)        2. Sidebar (split-pane)
┌───────────────────────────┐     ┌────────────┬────────────────┐
│ ← Hiking Group        ⋮   │     │ Convos     │ ← Group    ⋮   │
├───────────────────────────┤     │ ───────────│ ───────────────│
│        (messages)         │     │ Hiking     │   (messages)   │
├───────────────────────────┤     │ Alice      │ ───────────────│
│ +  Type a message…    ▶   │     │ Bob        │ Type message ▶ │
└───────────────────────────┘     └────────────┴────────────────┘

3. Modal/Dialog            4. Tab-based              5. Embedded
┌──────────────────┐       ┌────────────────────┐   ┌──────────────────────┐
│ Chat w/ Alice  ✕ │       │ Chats Users Groups │   │ Product details      │
├──────────────────┤       ├────────────────────┤   ├──────────────────────┤
│   (messages)     │       │  (active tab)      │   │ Chat with seller     │
│ Type message  ▶  │       │                    │   │ [header/list/composer]│
└──────────────────┘       └────────────────────┘   └──────────────────────┘
```

All five compose the same primitives — only the container/routing differs.

---

## A shared two-pane chat component

Most placements reuse one composed chat surface. Define it once as a standalone component:

```typescript
// chat-pane.component.ts
import { Component, Input } from "@angular/core";
import {
  CometChatMessageHeaderComponent,
  CometChatMessageListComponent,
  CometChatMessageComposerComponent,
} from "@cometchat/chat-uikit-angular";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Component({
  selector: "app-chat-pane",
  standalone: true,
  imports: [
    CometChatMessageHeaderComponent,
    CometChatMessageListComponent,
    CometChatMessageComposerComponent,
  ],
  template: `
    <ng-container *ngIf="user || group; else empty">
      <cometchat-message-header [user]="user" [group]="group"></cometchat-message-header>
      <cometchat-message-list   [user]="user" [group]="group"></cometchat-message-list>
      <cometchat-message-composer [user]="user" [group]="group"></cometchat-message-composer>
    </ng-container>
    <ng-template #empty><div class="empty">Select a conversation</div></ng-template>`,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    cometchat-message-header, cometchat-message-composer { flex-shrink: 0; }
    cometchat-message-list { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  `],
})
export class ChatPaneComponent {
  @Input() user?: CometChat.User;
  @Input() group?: CometChat.Group;
}
```

### Two ways to drive the active conversation (both verified against the kit source)

`<cometchat-message-header>` / `-message-list>` / `-message-composer>` each expose optional `@Input() user?` and `@Input() group?`. They also inject the kit's `ChatStateService` (exported from `@cometchat/chat-uikit-angular`) and auto-subscribe to its `activeUser()` / `activeGroup()` signals when no input is bound. So:

- **State-service mode (canonical V5 default — what the docs and sample app use).** Render the three message components with **no `[user]`/`[group]` bindings**. When `<cometchat-conversations>` has **no `(itemClick)` handler bound**, clicking a row auto-calls `ChatStateService.setActiveConversation(conv)`, which the message components react to. You only read state for layout gating, e.g. `@if (chatState.activeUser() || chatState.activeGroup())`. To drive it yourself (a thread route, a deep link), call `chatState.setActiveUser(user)` / `setActiveGroup(group)` — these are mutually exclusive (setting one clears the other).
- **Props mode (explicit control).** Pass **`user` XOR `group`** down as inputs (shown in `app-chat-pane` above). Use this when you bind your own `(itemClick)` handler and route/own the selection — see the next note.

The `app-chat-pane` above uses props mode so it's reusable across routes/modals/embeds. For a single-host sidebar that matches the docs verbatim, drop the inputs and let `ChatStateService` wire it.

> **Load-bearing kit behavior:** `<cometchat-conversations>` only auto-sets `ChatStateService` *when `(itemClick)` is not observed*. The source is literally `if (this.itemClick.observed) { this.itemClick.emit(conv); } else { this.chatStateService.setActiveConversation(conv); }`. **The moment you bind `(itemClick)`, the auto-wiring stops** — you must then drive the view yourself (props, `chatState.setActive*`, or `router.navigate`). `<cometchat-users>` / `<cometchat-groups>` behave the same way with `setActiveUser` / `setActiveGroup`.

The kit's `<cometchat-*>` elements are `display: inline` by default, so the list won't flex or scroll without the host contract above. Two things are load-bearing: (1) the host is a flex column with `height: 100%`, and (2) each custom element is itself made a flex column — `cometchat-message-list` needs `flex: 1; min-height: 0; overflow: hidden` (the `min-height: 0` is what lets it shrink and scroll inside the flex parent; omit it and the list overflows instead of scrolling). The app's `index.html`/global styles must also set `html, body { height: 100% }` so the `height: 100%` chain has a root to resolve against.

---

## 1. Route-based placement

Two routes: a conversation list and a thread. Lazy-load both as standalone components.

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: "conversations", loadComponent: () =>
      import("./conversations-page.component").then(m => m.ConversationsPageComponent) },
  { path: "messages/:uid", loadComponent: () =>
      import("./messages-page.component").then(m => m.MessagesPageComponent) },
];
```

```typescript
// conversations-page.component.ts
@Component({
  standalone: true,
  imports: [CometChatConversationsComponent],
  template: `<cometchat-conversations (itemClick)="open($event)"></cometchat-conversations>`,
})
export class ConversationsPageComponent {
  constructor(private router: Router) {}
  open(c: CometChat.Conversation) {
    const e = c.getConversationWith();
    if (e instanceof CometChat.User) this.router.navigate(["/messages", e.getUid()]);
  }
}
```

`messages-page.component.ts` reads `:uid`, resolves the `CometChat.User` (via `CometChat.getUser(uid)`), and renders `<app-chat-pane [user]="user">`.

Binding `(itemClick)` here is deliberate: it suppresses the kit's auto-`setActiveConversation` (you want a navigation, not an in-place swap) and hands you the conversation to route with. The thread page then uses props mode (or calls `chatState.setActiveUser`) since the list and the thread live on different routes.

---

## 2. Sidebar placement (split-pane)

One standalone component, conversations on the left, the chat surface on the right. This is the layout the docs and the kit's own sample app (`cometchat-home` → `cometchat-selector` + `cometchat-messages`) ship — both use **state-service mode**.

**Recommended — state-service auto-wiring (docs/sample-app verbatim).** No `(itemClick)`, no inputs, no manual reassignment. `<cometchat-conversations>` auto-sets `ChatStateService` on click and the message components auto-subscribe. Import `inject` from `@angular/core` and `ChatStateService` + the four component classes from `@cometchat/chat-uikit-angular`:

```typescript
@Component({
  selector: "app-chat-sidebar",
  standalone: true,
  imports: [
    CometChatConversationsComponent,
    CometChatMessageHeaderComponent,
    CometChatMessageListComponent,
    CometChatMessageComposerComponent,
  ],
  template: `
    <div class="split">
      <aside><cometchat-conversations></cometchat-conversations></aside>
      <main>
        @if (chatState.activeUser() || chatState.activeGroup()) {
          <cometchat-message-header></cometchat-message-header>
          <cometchat-message-list></cometchat-message-list>
          <cometchat-message-composer></cometchat-message-composer>
        } @else {
          <div class="empty">Select a conversation</div>
        }
      </main>
    </div>`,
  styles: [`
    .split { display: flex; height: 100%; }
    aside { width: 320px; flex-shrink: 0; border-right: 1px solid var(--cometchat-border-color-light); overflow: hidden; display: flex; flex-direction: column; }
    aside cometchat-conversations { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
    main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    main cometchat-message-header, main cometchat-message-composer { flex-shrink: 0; }
    main cometchat-message-list { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  `],
})
export class ChatSidebarComponent {
  chatState = inject(ChatStateService);
}
```

**Alternative — props mode (explicit control).** Bind `(itemClick)` and drive `app-chat-pane` yourself. Binding `(itemClick)` suppresses the auto-wiring (see the load-bearing note above), so you own the selection:

```typescript
@Component({
  selector: "app-chat-sidebar",
  standalone: true,
  imports: [CometChatConversationsComponent, ChatPaneComponent],
  template: `
    <div class="split">
      <aside><cometchat-conversations (itemClick)="select($event)"></cometchat-conversations></aside>
      <main><app-chat-pane [user]="activeUser" [group]="activeGroup"></app-chat-pane></main>
    </div>`,
  styles: [`.split{display:flex;height:100%} aside{width:320px;flex-shrink:0;border-right:1px solid var(--cometchat-border-color-light)} main{flex:1;min-width:0}`],
})
export class ChatSidebarComponent {
  activeUser?: CometChat.User; activeGroup?: CometChat.Group;
  select(c: CometChat.Conversation) {
    const e = c.getConversationWith();
    // reassign (new ref) so OnPush hosts update
    if (e instanceof CometChat.User)  { this.activeUser = e; this.activeGroup = undefined; }
    if (e instanceof CometChat.Group) { this.activeGroup = e; this.activeUser = undefined; }
  }
}
```

---

## 3. Modal/Dialog placement (Angular Material)

Render the composed chat pane inside a `MatDialog`. **Never a composite** — there isn't one, and a 3-panel composite wouldn't fit a modal anyway.

```typescript
// open from any component:
this.dialog.open(ChatDialogComponent, { width: "420px", height: "640px", data: { user } });

// chat-dialog.component.ts
@Component({
  standalone: true,
  imports: [ChatPaneComponent],
  template: `<app-chat-pane [user]="data.user"></app-chat-pane>`,
})
export class ChatDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { user: CometChat.User }) {}
}
```

(For an inbox-in-modal, drop `<cometchat-conversations>` above the pane in a two-pane dialog body.)

---

## 4. Tab-based placement

A standalone shell with Material tabs (or your own) over Conversations / Users / Groups / Call Logs.

```typescript
@Component({
  standalone: true,
  imports: [MatTabsModule, CometChatConversationsComponent, CometChatUsersComponent,
            CometChatGroupsComponent, CometChatCallLogsComponent, ChatPaneComponent],
  template: `
    <mat-tab-group>
      <mat-tab label="Chats"><div class="tab-pane"><cometchat-conversations (itemClick)="select($event)"></cometchat-conversations></div></mat-tab>
      <mat-tab label="Users"><div class="tab-pane"><cometchat-users (itemClick)="selectUser($event)"></cometchat-users></div></mat-tab>
      <mat-tab label="Groups"><div class="tab-pane"><cometchat-groups (itemClick)="selectGroup($event)"></cometchat-groups></div></mat-tab>
      <mat-tab label="Calls"><div class="tab-pane"><cometchat-call-logs></cometchat-call-logs></div></mat-tab>
    </mat-tab-group>`,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    mat-tab-group { flex: 1; min-height: 0; }
    .tab-pane { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .tab-pane > * { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  `],
})
export class ChatTabsComponent { /* select handlers route to a thread or open the pane */ }
```

`MatTabsModule` is a standalone-importable Angular Material module — add it to `imports: []` alongside the CometChat components.

Selection wiring is the same trade-off as the sidebar. If you want the kit to auto-route a click into the active conversation (the docs' tab example does this), **drop the `(itemClick)` handlers** — `<cometchat-conversations>` auto-calls `setActiveConversation` and `<cometchat-users>` auto-calls `setActiveUser`, then mount the message components in a side/center pane gated on `chatState.activeUser()`/`activeGroup()`. Bind `(itemClick)` only when you want to route to a separate page or otherwise own the selection.

The list components inside each `<mat-tab>` need the same flex-host treatment as the chat pane — a Material tab body has no implicit height, so without a flex `.tab-pane` wrapper (and the elements made `flex: 1; min-height: 0; overflow: hidden`) the inline `<cometchat-*>` lists collapse to zero height and won't scroll.

---

## 5. Embedded placement

Drop `<app-chat-pane>` (or the raw header/list/composer) inside an existing page, scoped to a known user/group.

```typescript
@Component({
  standalone: true,
  imports: [ChatPaneComponent],
  template: `
    <section class="product">…product details…</section>
    <section class="seller-chat" style="height:480px">
      <h3>Chat with seller</h3>
      <app-chat-pane [user]="seller"></app-chat-pane>
    </section>`,
})
export class ProductPageComponent { seller!: CometChat.User; }
```

Give the embedded container an explicit height — the message list fills its parent.

---

## Hard rules

1. **No composites in v5.** `<cometchat-conversations-with-messages>` / `-users-with-messages>` / `-groups-with-messages>` do not exist — compose `<cometchat-conversations>` + the message components. (If you've seen these in v4 docs, they were removed.)
2. **No `CUSTOM_ELEMENTS_SCHEMA`, no NgModule** — import each component class into the host standalone component's `imports: []`.
3. **Drive the active chat one of two ways — don't mix them on the same surface.** Either (a) **state-service mode** (canonical V5 default): no `[user]`/`[group]`, no `(itemClick)` — `<cometchat-conversations>`/`-users>`/`-groups>` auto-call `ChatStateService.setActive*` and the message components auto-subscribe; gate layout on `chatState.activeUser()`/`activeGroup()`. Or (b) **props mode**: pass `user` XOR `group` on header/list/composer (reassign a new reference on change so OnPush hosts re-render). **Binding `(itemClick)` suppresses the auto-wiring** (kit source: `itemClick.observed ? emit : setActiveConversation`) — once bound, you own selection via props, `chatState.setActive*`, or routing.
4. **Give chat containers an explicit height AND make the custom elements flex.** The kit's `<cometchat-*>` elements are `display: inline` by default — they will not flex or scroll on their own. The host must be a flex column with a resolvable `height: 100%` (so set `html, body { height: 100% }` globally), and each element must itself be `display: flex; flex-direction: column`. `cometchat-message-list` needs `flex: 1; min-height: 0; overflow: hidden` — without `min-height: 0` it overflows the viewport instead of scrolling; header/composer take `flex-shrink: 0`. With no height or no element-flex, the list collapses or fails to scroll.
5. **Lazy-load full-page chat routes** via `loadComponent` so the kit bundle isn't in the initial chunk.
6. **Brand/theme via CSS variables** (`--cometchat-*`) — see `cometchat-angular-theming`, not a theme service.

## Skill routing reference
- `cometchat-angular-core` — setup, init, login, `ChatStateService` lifecycle
- `cometchat-angular-components` — component catalog + bindings (`@Input user/group`, `itemClick`)
- `cometchat-angular-patterns` — routing, guards, lazy loading, NgZone, SSR
- `cometchat-angular-theming` — CSS-variable theming
