# In-call chat on web

Text messaging during a video/voice call. SDK provides the chat button in the control panel + events; the actual chat UI is yours to build (the kit's existing `<CometChatMessageList>` + `<CometChatMessageComposer>` work great here).

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/in-call-chat
**Use it for:** classroom side chat, team meeting links/notes, customer support secondary channel, AV-impaired participant text fallback.

---

## SDK API

```ts
const settings = new CometChatCalls.CallSettingsBuilder()
  .setSessionID(sessionId)
  .hideChatButton(false)               // show the kit's built-in chat button
  .build();

CometChatCalls.addEventListener("onChatButtonClicked", () => {
  // Open your chat panel
  setChatOpen(true);
});

// Update unread badge
CometChatCalls.setChatButtonUnreadCount(5);
CometChatCalls.setChatButtonUnreadCount(0);   // clear
```

The button + badge live on the SDK's control panel. Your job is to render the chat UI when the button is tapped.

---

## Architecture: group-as-session

The recommended pattern: use a CometChat **group** keyed to the call session. Every participant joins the group when they join the call; messages flow through the group's normal CometChat Chat SDK channel. When the call ends, the group either persists (logged history) or is deleted (ephemeral).

```ts
import { CometChat } from "@cometchat/chat-sdk-javascript";

async function ensureCallGroup(sessionId: string): Promise<CometChat.Group> {
  // Try to get existing
  try {
    return await CometChat.getGroup(sessionId);
  } catch {
    // Create
    const group = new CometChat.Group(
      sessionId,                    // GUID == session ID
      `Call ${sessionId}`,          // display name
      CometChat.GROUP_TYPE.PUBLIC,  // anyone in the call can join
    );
    return await CometChat.createGroup(group);
  }
}

async function joinCallGroup(sessionId: string): Promise<void> {
  await CometChat.joinGroup(sessionId, CometChat.GROUP_TYPE.PUBLIC, "");
}
```

Wire this into your call-start flow: after `startSession` succeeds, `joinCallGroup`.

---

## Chat panel UI

```tsx
import { useState, useEffect } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";
import {
  CometChatMessageList,
  CometChatMessageComposer,
} from "@cometchat/chat-uikit-react";

interface InCallChatPanelProps {
  sessionId: string;
}

function InCallChatPanel({ sessionId }: InCallChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [group, setGroup] = useState<CometChat.Group>();

  // Listen for the SDK's button click
  useEffect(() => {
    const handler = () => setOpen(true);
    CometChatCalls.addEventListener("onChatButtonClicked", handler);
    return () => CometChatCalls.removeEventListener("onChatButtonClicked", handler);
  }, []);

  // Resolve the group object for the message list
  useEffect(() => {
    CometChat.getGroup(sessionId).then(setGroup).catch(() => {});
  }, [sessionId]);

  // Track unread when panel is closed
  useEffect(() => {
    const listenerId = `in-call-chat-${sessionId}`;
    const messageListener = new CometChat.MessageListener({
      onTextMessageReceived: (msg: CometChat.TextMessage) => {
        if (
          msg.getReceiverType() === CometChat.RECEIVER_TYPE.GROUP &&
          msg.getReceiverId() === sessionId &&
          !open
        ) {
          setUnread((u) => {
            const next = u + 1;
            CometChatCalls.setChatButtonUnreadCount(next);
            return next;
          });
        }
      },
    });
    CometChat.addMessageListener(listenerId, messageListener);
    return () => CometChat.removeMessageListener(listenerId);
  }, [sessionId, open]);

  // Clear badge on open
  useEffect(() => {
    if (open) {
      setUnread(0);
      CometChatCalls.setChatButtonUnreadCount(0);
    }
  }, [open]);

  if (!open || !group) return null;

  return (
    <div
      role="dialog"
      aria-label="In-call chat"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: 360,
        background: "var(--cometchat-background-color-01)",
        borderLeft: "1px solid var(--cometchat-border-color-light)",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
      }}
    >
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cometchat-border-color-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Chat</strong>
        <button onClick={() => setOpen(false)} aria-label="Close chat">×</button>
      </div>
      {/* The flex-1 + minHeight:0 dance applies here too — long chat → composer would push down */}
      <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        <CometChatMessageList group={group} hideReplyInThreadOption />
      </div>
      <div style={{ flex: "0 0 auto" }}>
        <CometChatMessageComposer group={group} />
      </div>
    </div>
  );
}
```

The flex-1 + minHeight:0 + wrap-each-component pattern from `cometchat-react-patterns` rule 6a applies inside the chat panel too.

---

## Compact UX patterns

For 1:1 calls or small groups, an in-call chat panel is overkill. Two lighter patterns:

### A — Floating message strip (top of call)

Show only the latest message inline; tap to open full chat. Minimal UI for "just the gist."

### B — System-toast on each message

`onTextMessageReceived` → toast at top of call. Auto-dismiss after 4s. No persistent panel.

The full panel pattern above is for 5+-person calls or when chat is a load-bearing part of the experience (e.g. classroom Q&A).

---

## Anti-patterns

1. **Polling for unread count.** SDK's `setChatButtonUnreadCount` is push-based; respond to message events.
2. **Chat panel grows past viewport on long sessions.** flex-shrink trap (see `cometchat-react-patterns` rule 6a).
3. **Forgetting to clear the unread badge on panel open.** User opens, sees "12 new" badge that doesn't update — looks broken.
4. **Persisting the call group forever.** For ephemeral calls (consultations, support), delete the group on call end. Hosts of recurring meetings keep groups.
5. **Sending messages without auth.** Make sure CometChat.login resolved before joining the group. Race conditions on early call accept.
6. **Reusing one chat-panel instance across multiple calls.** Group reference goes stale. Re-mount per call.

---

## Verification checklist

- [ ] `hideChatButton: false` in CallSettings
- [ ] `onChatButtonClicked` listener opens the panel
- [ ] CometChat group created/resolved with sessionId as GUID
- [ ] Local user joins the group on call start
- [ ] Unread badge updates from `onTextMessageReceived` only when panel closed
- [ ] Badge cleared on panel open
- [ ] Chat panel uses flex-1 + minHeight:0 + wrap-each-component pattern
- [ ] `role="dialog"` + `aria-label` on the panel container
- [ ] Cleanup: remove message + chat-button listeners on call end
- [ ] Browser smoke: 2 tabs in call, send message from A → unread badge in B → tap → message visible

---

## Pointers

- `cometchat-react-calls` SKILL.md
- `cometchat-react-patterns` — minHeight:0 rule 6a (applies to in-call chat panel)
- `references/group-calls.md` — group call architecture
- `cometchat-android-v5-calls/references/in-call-chat.md` — Android V5 sibling reference
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/in-call-chat
