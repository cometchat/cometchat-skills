# Share invite on web (React)

Let participants share the call link with others. The kit ships a share-invite button (hidden by default); your app intercepts the click and runs the platform's native share UI.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/share-invite

---

## Hard rule: deep-link routing must work BEFORE you ship share-invite

A share button that copies a URL nobody can open is worse than no share button. Verify your app's `/call/:sessionId` route handles all four states:

1. **User logged in, in-app** → join call directly
2. **User logged in, fresh tab** → restore session, join call
3. **User logged out** → login, then redirect to call
4. **User doesn't have account** → signup flow with `?invite=...` query param

Build the deep-link route first, then turn on the share button.

---

## Show the kit's share button

```tsx
const callSettings = {
  hideShareInviteButton: false,
  // ... rest
};
```

---

## Handle the click

```tsx
useEffect(() => {
  const handler = () => shareCallInvite(sessionId);
  CometChatCalls.addEventListener("onShareInviteButtonClicked", handler);
  return () => {
    CometChatCalls.removeEventListener("onShareInviteButtonClicked", handler);
  };
}, [sessionId]);
```

---

## Native Web Share API + clipboard fallback

```tsx
async function shareCallInvite(sessionId: string) {
  const url = `https://yourapp.com/call/${sessionId}`;
  const shareData = {
    title: "Join my call",
    text: "I'm on a call — tap to join.",
    url,
  };

  if (navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      // User cancelled — that's fine, no toast needed
      if ((err as Error).name !== "AbortError") {
        console.warn("Share failed", err);
      }
    }
    return;
  }

  // Fallback: clipboard
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copied to clipboard");
  } catch {
    // Clipboard API requires user gesture + secure context (https) — must always have a manual fallback
    promptManualCopy(url);
  }
}
```

`navigator.share` is iOS Safari + Android Chrome + recent desktop Chrome. `navigator.clipboard.writeText` is everywhere modern but **only works in secure contexts (https)** — localhost is fine; non-https staging hosts will throw.

---

## Custom share dialog (when you want more control)

```tsx
function ShareDialog({ sessionId, onClose }: Props) {
  const url = `https://yourapp.com/call/${sessionId}`;
  return (
    <dialog open className="share-dialog" role="dialog" aria-label="Share call invite">
      <button onClick={() => navigator.clipboard.writeText(url)}>Copy link</button>
      <a href={`mailto:?subject=Join%20my%20call&body=${encodeURIComponent(url)}`}>Email</a>
      <a href={`sms:?body=${encodeURIComponent(url)}`}>SMS</a>
      <button onClick={onClose}>Close</button>
    </dialog>
  );
}
```

`mailto:` opens default email client; `sms:` opens default SMS app on mobile (no-op on most desktops). Both are universal — no provider lock-in.

---

## QR code for in-person sharing

For "share to the person sitting next to you" UX, a QR is faster than a link:

```tsx
import QRCode from "qrcode.react";

function CallQR({ sessionId }: { sessionId: string }) {
  const url = `https://yourapp.com/call/${sessionId}`;
  return (
    <div>
      <QRCode value={url} size={192} />
      <p>{url}</p>
    </div>
  );
}
```

---

## Anti-patterns

1. **Sharing the raw `sessionId` instead of a deep link.** Recipients can't open it.
2. **Wiring share before the deep-link route works.** Recipients click → 404.
3. **`navigator.clipboard.writeText` without a manual-copy fallback.** Fails in non-https contexts (e.g., embedded iframes, dev tunnels).
4. **Showing "Link copied!" toast even when share was cancelled.** `AbortError` is the user dismissing the share sheet — silent.
5. **Forgetting `removeEventListener` on unmount.** Listener accumulates → multiple share sheets per click.
6. **Hard-coding `https://yourapp.com`.** Use `window.location.origin` or `import.meta.env.VITE_APP_URL`.

---

## Server-side: deep links + auth bridge

If invitee isn't logged in, `https://yourapp.com/call/SESSION_ID` should redirect them through login THEN to the call. Pattern:

```ts
// pages/call/[sessionId].tsx (Next.js example)
export async function getServerSideProps({ params, req }) {
  const session = await getSession(req);
  if (!session) {
    return {
      redirect: {
        destination: `/login?next=/call/${params.sessionId}`,
        permanent: false,
      },
    };
  }
  return { props: { sessionId: params.sessionId } };
}
```

For invitees without an account, send them to `/signup?invite=SESSION_ID` and store the pending invite in `localStorage` until signup completes.

---

## Verification checklist

- [ ] Deep-link route `/call/:sessionId` works in 4 states (logged in / logged out / no account / fresh tab)
- [ ] `hideShareInviteButton: false` in CallSettings
- [ ] `onShareInviteButtonClicked` listener cleaned up on unmount
- [ ] `navigator.share` used when available; clipboard fallback; manual-copy fallback for non-https
- [ ] AbortError silenced
- [ ] App URL not hard-coded — read from env
- [ ] Smoke: copy link → paste in incognito → can join call

---

## Pointers

- `cometchat-react-calls/SKILL.md` — call architecture
- `cometchat-react-calls/references/in-call-chat.md` — sister cross-cutting concern
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/share-invite
