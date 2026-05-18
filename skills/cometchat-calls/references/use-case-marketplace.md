# Use case — Marketplace (buyer ↔ seller)

A peer-to-peer marketplace where buyers and sellers communicate before/during a transaction. The shape: time-bounded chat between matched users, optional 1:1 video for product walkthroughs, communications archived for dispute resolution, identity controls so neither party can recontact post-transaction without going through the platform.

**Examples:** OfferUp, Airbnb host/guest messaging, eBay seller-buyer chat with video, Etsy custom-order discussions.

---

## End-to-end flow

```
1. Buyer expresses interest in a listing
   → Server creates a CometChat group with both buyer + seller
   → Group lives only for the duration of the deal (auto-archive after N days)
   ↓
2. Either party can initiate text chat in the group
   ↓
3. (Optional) Either party can initiate a video call to walk through the product
   → Identity is hidden — call shows "Buyer" or "Seller", not real names
   ↓
4. Transaction closes (purchase confirmed / canceled)
   → Group is locked: read-only for both parties, archived for dispute resolution
   ↓
5. After dispute window (90 days typical), group is hard-deleted
```

---

## Identity protection

Don't expose real names/emails through the SDK. Use **opaque UIDs** that resolve to display strings only via your auth-gated lookup:

```ts
// On the server, when creating the deal group:
await cometchatApi.createGroup({
  guid: `deal-${dealId}`,
  members: [
    { uid: `buyer-${buyerId}`, scope: "participant" },
    { uid: `seller-${sellerId}`, scope: "participant" },
  ],
  metadata: {
    dealId,
    expiresAt: Date.now() + 90 * 86400_000,
  },
});

// Client-side: when CometChat returns a UID, resolve display name via your API
function resolveDisplayName(uid: string, viewerRole: "buyer" | "seller"): string {
  // Only show "Seller" / "Buyer" — not real name
  if (uid.startsWith("seller-")) return viewerRole === "buyer" ? "Seller" : "You";
  if (uid.startsWith("buyer-")) return viewerRole === "seller" ? "Buyer" : "You";
  return "Unknown";
}
```

---

## Recommended call settings

```ts
const settings = {
  layout: "SPOTLIGHT",                   // 1:1 focus
  hideChangeLayoutButton: true,

  hideRecordingButton: true,              // No platform-side recording — privacy + dispute via chat archive
  hideShareInviteButton: true,            // Buyer ↔ seller only — don't allow inviting
  hideScreenShareButton: false,           // Useful for "show me the actual condition"
  hideVirtualBackgroundButton: false,     // Privacy — most people are in their home
  hideChatButton: false,                  // For sharing photos/details mid-call

  hideRaiseHandButton: true,
  callIdleTime: 600,                      // 10min idle = end (sometimes deals die)
};
```

---

## Time-bounded access

After the deal closes (or expires), revoke access without deleting history:

```ts
// Server-side, when transaction closes:
await cometchatApi.updateGroup({
  guid: `deal-${dealId}`,
  metadata: {
    status: "closed",
    closedAt: Date.now(),
  },
});
// Lock by switching group to "private" with no joinable handle
await cometchatApi.kickMembers({ guid, uids: [/* all participants */] });
```

Or — if your dispute window allows — keep them in the group as **read-only** by checking `metadata.status` client-side and disabling composer:

```tsx
function DealMessageComposer({ group }: Props) {
  const isClosed = group.metadata?.status === "closed";
  return (
    <CometChatMessageComposer group={group} disabled={isClosed} />
    // (Disable shows the input greyed out with explanation)
  );
}
```

---

## Anti-patterns

1. **Using real user UIDs in CometChat.** Real names leak via SDK events. Always use opaque IDs.
2. **Allowing share-invite.** Bypasses identity controls — a savvy user shares the call link to a third party (their lawyer, advocate, etc.). Lock down to invitees only.
3. **No expiration.** Old deals' groups pile up. Use `metadata.expiresAt` + nightly cron to delete.
4. **Recording calls.** Liability risk — neither party gave consent + you may not be the legal data controller for their home interiors.
5. **Cross-platform message routing without checks.** Customer says "find me on WhatsApp" → links pasted in chat → bypass your platform's protection. Run profanity-filter + URL-detection extensions; flag attempts.

---

## Anti-fraud heuristics

```ts
// Hook into message-sent events
CometChat.addMessageListener("antifraud", new CometChat.MessageListener({
  onTextMessageReceived: (msg) => {
    const text = msg.getText();
    // Off-platform routing attempts
    const offPlatform = /\b(whatsapp|telegram|signal|wechat|email|@gmail|@yahoo)\b/i;
    // Wire-fraud red flags
    const wireFraud = /\b(western union|moneygram|gift card|crypto|bitcoin|wire transfer)\b/i;
    if (offPlatform.test(text) || wireFraud.test(text)) {
      // Quietly flag for review — don't tip the user that you're watching
      api.flagMessage({ messageId: msg.getId(), reasons: { offPlatform: offPlatform.test(text), wireFraud: wireFraud.test(text) }});
    }
  },
}));
```

---

## Verification checklist

- [ ] Opaque UIDs used (no real names in CometChat)
- [ ] Display names resolved via auth-gated API
- [ ] `hideShareInviteButton: true`
- [ ] No platform-side recording
- [ ] Group `metadata.expiresAt` set + nightly archive job
- [ ] Anti-fraud message listener wired
- [ ] Profanity filter + URL detection extensions enabled
- [ ] Call settings: SPOTLIGHT layout, idle 10min

---

## Pointers

- `cometchat-react-calls/references/screen-sharing.md` — for product walkthrough
- `cometchat-react-extensions` — profanity-filter + URL-detection
- `cometchat-production` — server-minted auth tokens (don't leak the auth key in client)
- `cometchat-react/SKILL.md` — group + message UX
