# Adding calls to an existing chat integration (web)

You already have CometChat chat working (`@cometchat/chat-sdk-javascript` + `@cometchat/chat-uikit-react`). This guide adds calling on top with minimum disruption.

**Read first:** `cometchat-react-calls/SKILL.md` — the seven hard rules. They apply whether you're starting fresh or migrating.

---

## Pre-flight

Confirm what's already in place:

```bash
# Should show chat SDK + UI Kit
grep -E '"@cometchat/(chat-sdk|chat-uikit)' package.json

# Should NOT yet show calls SDK
grep -E '"@cometchat/calls-sdk' package.json
```

If you already have `@cometchat/calls-sdk-javascript` installed, you're not migrating — re-running `/cometchat-calls` will integrate calls features (recording, share-invite, etc.) one at a time.

---

## Step 1 — Install the calls SDK

```bash
npm install @cometchat/calls-sdk-javascript@5
```

This is a pure additive change. The chat SDK is unaffected.

---

## Step 2 — Add calls init AFTER chat init

The seven hard rules: chat must init before calls. If your existing init looks like:

```ts
// src/cometchat-init.ts
import { CometChat } from "@cometchat/chat-sdk-javascript";

const settings = new CometChat.AppSettingsBuilder()
  .subscribePresenceForAllUsers()
  .setRegion(REGION)
  .build();

await CometChat.init(APP_ID, settings);
```

Append the calls init:

```ts
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

const settings = new CometChat.AppSettingsBuilder()
  .subscribePresenceForAllUsers()
  .setRegion(REGION)
  .build();

await CometChat.init(APP_ID, settings);

// NEW — calls init AFTER chat init
await CometChatCalls.init({ appId: APP_ID, region: REGION });
```

---

## Step 3 — Add Calls SDK login after chat login

Wherever you call `CometChat.login(uid, authKey)` (or your auth-token equivalent), add:

```ts
const user = await CometChat.login(uid, authKey);
const authToken = user.getAuthToken();
await CometChatCalls.login(authToken);
```

If you use server-minted auth tokens (production hygiene — see `cometchat-production`), the same auth token works for both SDKs.

---

## Step 4 — Mount IncomingCall at the app root

Add `CometChatIncomingCall` somewhere that's always rendered (the root layout, app shell, or a portal):

```tsx
// src/App.tsx (or your root layout)
import { CometChatIncomingCall } from "@cometchat/chat-uikit-react";

function App() {
  return (
    <>
      <YourExistingRoutes />
      <CometChatIncomingCall />
    </>
  );
}
```

This component listens for incoming-call events and renders the accept/reject UI. **Without it, your users won't see incoming calls.**

---

## Step 5 — Add call buttons to existing chat surfaces

If you're rendering `CometChatMessageHeader` (the per-conversation header), call buttons appear automatically once the calls SDK is initialized. **You don't add anything for this** — the UI Kit detects the calls SDK and wires the buttons.

Verify by opening any 1:1 chat — voice + video icons should appear in the header.

---

## Step 6 — (Optional) Custom call surface

If you want a custom call experience instead of the kit's default UI, see `cometchat-react-calls/SKILL.md` Step 4 for the dispatcher pattern.

---

## Verification checklist

- [ ] `@cometchat/calls-sdk-javascript@^5` in package.json
- [ ] Calls SDK init runs AFTER chat SDK init
- [ ] `CometChatCalls.login(authToken)` runs AFTER `CometChat.login`
- [ ] `CometChatIncomingCall` mounted at app root
- [ ] Call buttons visible in CometChatMessageHeader
- [ ] Run `cometchat verify --calls` — should pass all 20 checks
- [ ] Smoke test: 2 tabs (different users), call from one, ringing in the other

---

## Common pitfalls when migrating

1. **Calls init before chat init.** Calls SDK throws "App not initialized." Order matters.
2. **Forgetting `CometChatCalls.login`.** Token-mint endpoints fail with 401.
3. **Mounting `CometChatIncomingCall` per-route.** Missed when user is on a non-chat route. Mount at root.
4. **Hand-rolling call UI before installing the SDK.** Easy to skip the seven hard rules. Use the kit's components first; customize after a working baseline.

---

## Pointers

- `cometchat-react-calls/SKILL.md` — full architecture + seven hard rules
- `cometchat-react-calls/references/recording.md` etc. — feature-specific add-ons
- `cometchat verify --calls` — automated check (see `cometchat-cli`)
