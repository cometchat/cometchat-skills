---
name: cometchat-react-calls
description: CometChat Calls SDK integration for web React apps (Vite, CRA, Next.js, React Router, Astro). Covers @cometchat/calls-sdk-javascript install, dual-SDK init (Chat SDK + Calls SDK), getRTCToken, the kit's CometChatIncomingCall / CometChatOutgoingCall / CometChatOngoingCall components, CallButtons composition, getUserMedia permissions, browser TURN/STUN handling, and additive-vs-standalone modes.
license: "MIT"
compatibility: "React >= 18, Next.js >= 13, React Router v6/v7, Astro >= 4; @cometchat/calls-sdk-javascript ^5 (v5.0.0 stable shipped; pin to `@5` because the npm `latest` dist-tag still points at v4.2.6 — see §Install); @cometchat/chat-sdk-javascript ^4.x; @cometchat/chat-uikit-react ^6.x (additive mode)"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat react calls voice video webrtc nextjs react-router astro getRTCToken getusermedia browser-permissions vite cra"
---

## ⚠️ STOP — mandatory precondition before any code

**Before writing one line of code, you MUST resolve `mode = ringing | session`.** This decides which entire integration shape you scaffold — they don't share UI, navigation, or surface.

| `mode` | Surface shape | Reference |
|---|---|---|
| `ringing` | `CometChatIncomingCall` at root + `CometChatCallButtons` near a user / contact / message header. Recipient's screen rings on incoming call. | `references/ringing-integration.md` |
| `session` | `/meet/:sessionId` route (or equivalent) + `CometChatCalls.joinSession` on a container `<div>`. No ringing — both parties enter the same session ID. | `references/call-session.md` |

**How to resolve mode (in order):**

1. **Check `.cometchat/config.json` for `mode`** — if set by the `cometchat-calls` dispatcher's Step 3.0, trust it.
2. **Infer from the user's words** — see `cometchat-calls/SKILL.md` Step 3.0 inference table. Confirm in one line: *"Got it — setting up Ringing. Say so if you wanted meeting-room URLs instead."*
3. **If still ambiguous (e.g. user said only "integrate calls" with no qualifier) — ASK before scaffolding.** Don't default to ringing. Use this prompt **verbatim** — preserve the order, the labels, and the descriptions exactly. Do NOT rephrase. Do NOT swap options. Option 1 is "Session"; option 2 is "Ringing":

   - **question:** "What kind of calling experience are you building?"
   - **header:** "Calling mode"
   - **multiSelect:** false
   - **options (display in this exact order — Session FIRST, Ringing SECOND):**
     1. label: "Session — meeting / conference room", description: "Multiple users join the same session by ID or link. No ringing. Like Google Meet, Zoom, or a Slack huddle."
     2. label: "Ringing — 1:1 or group calls", description: "One user calls another (or a small group). Recipient's device rings; they accept or decline. Like FaceTime or WhatsApp calls."

   > **Strict-order rule:** the agent's UI primitive must render option 1 above the option 2. Do not let auto-mode classifiers or your own bias reorder them. Session is shown first because the dashboard team has standardized on this order across CometChat product surfaces; consistency matters more than any subjective "first option" preference.

**Do not write `CometChatCallButtons` / `CometChatIncomingCall` / `CometChatOngoingCall` code without a confirmed `mode === "ringing"`.** Those components are the kit's implementation of ringing; using them silently locks the integration into ringing-shape even if the user wanted a meeting-room flow.

---

## ⚠️ Call container — must have non-zero dimensions when joinSession fires

The Calls SDK measures the container `<div>` **synchronously** when `joinSession` runs and throws `Container dimensions and number of tiles must be positive` if width or height is 0. This is the calls equivalent of the chat-layout flex-shrink trap.

**Common bug — `h-full` on a flex child resolves to 0:**

```tsx
// ✗ WRONG — `h-full` is `height: 100%`, but the parent's height is auto
//   so 100% of auto = 0. SDK crashes.
<section className="flex-1">
  <div ref={containerRef} className="h-full w-full" />
</section>
```

**Fix — use a flex chain with `min-h-0` and an explicit fallback:**

```tsx
// ✓ RIGHT — section is a flex column with min-h-0 (so it can shrink), the
//   container uses flex-1 to claim remaining space, plus an explicit
//   `minHeight` safety net for very short viewports.
<section className="relative flex flex-1 min-h-0">
  <div
    ref={containerRef}
    className="flex-1 w-full"
    style={{ minHeight: 400 }}
  />
</section>
```

If you can't use flex (e.g. fixed-height modal), just give the container explicit pixels:

```tsx
<div
  ref={containerRef}
  style={{ width: "100%", height: "calc(100vh - 100px)" }}
/>
```

`minHeight: 0` matters specifically for parent flex containers that house the call container — without it, a flex-column ancestor whose content overflows defaults to `min-height: auto` and the call surface gets squeezed to zero. This is the same trap as `cometchat-react-patterns`'s chat-layout rule, applied to calls.

---

## ⚠️ Next.js / SSR — mandatory bundler config

Both SDKs ship code that **breaks Next.js's SSR pass**:

- `@cometchat/chat-sdk-javascript` references `window` at module load time
- `@cometchat/calls-sdk-javascript` (v5) imports Node built-ins (`fs`, `path`) gated by a runtime check that the bundler still tries to statically resolve

`"use client"` alone does NOT fix this — Next.js evaluates client components during the initial SSR pass for hydration. You need to defer the SDK imports so they only execute in the browser.

**For Next.js (App Router or Pages Router), apply ALL of these:**

1. **Switch dev/build to webpack** in `package.json` scripts (Turbopack's `fs`/`path` aliasing is fragile in Next 16):
   ```json
   {
     "scripts": {
       "dev": "next dev --webpack",
       "build": "next build --webpack",
       "start": "next start"
     }
   }
   ```

2. **Add a webpack `fs` fallback** in `next.config.ts`:
   ```ts
   import type { NextConfig } from "next";
   const nextConfig: NextConfig = {
     webpack: (config, { isServer }) => {
       if (!isServer) {
         config.resolve = config.resolve || {};
         config.resolve.fallback = {
           ...(config.resolve.fallback || {}),
           fs: false,
           path: false,
         };
       }
       return config;
     },
   };
   export default nextConfig;
   ```

3. **Wrap the CometChatProvider in `next/dynamic({ ssr: false })`** — create a small client wrapper and use it from a server-component layout:
   ```tsx
   // app/_components/CometChatGate.tsx
   "use client";
   import dynamic from "next/dynamic";
   import type { ReactNode } from "react";

   const CometChatProvider = dynamic(
     () => import("@/cometchat/CometChatProvider").then((m) => m.CometChatProvider),
     { ssr: false, loading: () => <div>Loading…</div> },
   );

   export function CometChatGate({ children }: { children: ReactNode }) {
     return <CometChatProvider>{children}</CometChatProvider>;
   }
   ```

   **⚠️ Provider placement for Ringing mode — mount at app root, not on a sub-route layout.** If the CometChatProvider registers a global `CallListener` for incoming calls (which it should — see "Ringing mode listener" below), it MUST be mounted in the root layout (`app/layout.tsx`). Mounting it on a sub-route layout like `app/meet/layout.tsx` means the listener is only armed while the user is browsing under that sub-route — incoming calls land silently when they're on the home page or any other route, and the caller sees a timeout/rejection.

   ```tsx
   // app/layout.tsx (server component, root layout)
   import { CometChatGate } from "./_components/CometChatGate";
   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <html><body>
         <CometChatGate>{children}</CometChatGate>
       </body></html>
     );
   }
   ```

   For Session-only mode (no ringing — both parties navigate to a shared `/meet/:id` URL), the sub-route layout is fine — listener isn't load-bearing.

   **Ringing mode listener** — inside `CometChatProvider`, after login:
   ```ts
   const { CometChat } = await import("@cometchat/chat-sdk-javascript");
   CometChat.addCallListener("ringing-listener", new CometChat.CallListener({
     onIncomingCallReceived: async (call: any) => {
       const accepted = await CometChat.acceptCall(call.getSessionId());
       router.push(`/meet/${encodeURIComponent(accepted.getSessionId())}`);
     },
     onOutgoingCallAccepted: (call: any) => {
       router.push(`/meet/${encodeURIComponent(call.getSessionId())}`);
     },
     onOutgoingCallRejected: (call: any) => { /* show toast */ },
     onIncomingCallCancelled: (call: any) => { /* dismiss any UI */ },
   }));
   ```
   The `/meet/:sessionId` page handles `joinSession`. Validated end-to-end against Pixel 3 V6 Android peer on 2026-05-12.

4. **Lazy-load the SDKs inside `init.ts`** — replace top-level static imports with `await import(...)` inside the init/login functions. The provider is gated by step 3, but `init.ts` is shared with any page that uses CometChatCalls directly, so belt-and-braces it:
   ```ts
   let chatModule: typeof import("@cometchat/chat-sdk-javascript") | null = null;
   let callsModule: typeof import("@cometchat/calls-sdk-javascript") | null = null;

   async function loadSdks() {
     if (!chatModule) chatModule = await import("@cometchat/chat-sdk-javascript");
     if (!callsModule) callsModule = await import("@cometchat/calls-sdk-javascript");
     return { CometChat: chatModule.CometChat, CometChatCalls: callsModule.CometChatCalls };
   }
   ```

5. **No top-level SDK imports in any page that's reachable via App Router routing.** Inside `useEffect` handlers, dynamic-import the SDK:
   ```tsx
   useEffect(() => {
     let CallsSdk: typeof import("@cometchat/calls-sdk-javascript").CometChatCalls | null = null;
     (async () => {
       const mod = await import("@cometchat/calls-sdk-javascript");
       CallsSdk = mod.CometChatCalls;
       // ... use CallsSdk
     })();
     return () => {
       try { CallsSdk?.leaveSession(); } catch { /* noop */ }
     };
   }, []);
   ```

Skipping any of these reproduces the failure mode: the route 500s with either `Module not found: Can't resolve 'fs'` or `ReferenceError: window is not defined`. Verified empirically against Next.js 16.2.6 + Calls SDK 5.0.0-beta.2.

For Vite / React Router / Astro, none of this applies — those bundlers don't pre-evaluate client modules.

---

## Purpose

Production-grade voice + video calling for React-family web apps. Loaded by `cometchat-calls` when `framework` is one of `reactjs`, `nextjs`, `react-router`, or `astro`. Operates in two modes:

- **Standalone** — calls is the product. `@cometchat/chat-sdk-javascript` (signaling) + `@cometchat/calls-sdk-javascript` (WebRTC) + a small set of UI Kit call components. No `CometChatConversations` / `CometChatMessageList` / etc.
- **Additive** — calls layered onto an existing CometChat React UI Kit integration. Adds call buttons inline, mounts `CometChatIncomingCall` at app root.

**Read these other skills first:**
- `cometchat-calls` — dispatcher (modes, hard rules, anti-patterns)
- `cometchat-core` — Chat SDK init, login, env-var prefix per framework, SSR safety
- Framework-specific patterns: `cometchat-react-patterns` / `cometchat-nextjs-patterns` / `cometchat-react-router-patterns` / `cometchat-astro-patterns`

**Ground truth:**
- SDK source — `~/Downloads/calls-sdk/calls-sdk-javascript-5/package/`
- Sample apps — `~/Downloads/calls-sdk/calls-sdk-javascript-5/sample-apps/{react,vue,angular,svelte,ionic}/`
- Public docs — https://www.cometchat.com/docs/calls/javascript/overview

---

## 1. The seven hard rules — web specialization

### 1.1 Dual-SDK contract

`@cometchat/chat-sdk-javascript` for ringing; `@cometchat/calls-sdk-javascript` for the WebRTC session. They are separate npm packages.

```ts
// ✓ RIGHT — initiate ringing (Chat SDK)
import { CometChat } from "@cometchat/chat-sdk-javascript";

const outgoing = new CometChat.Call(receiverUid, CometChat.CALL_TYPE.VIDEO, CometChat.RECEIVER_TYPE.USER);
const initiated = await CometChat.initiateCall(outgoing);
// initiated.getSessionId() — the ID the Calls SDK will join
```

```ts
// ✓ RIGHT — join WebRTC session (Calls SDK v5)
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

// v5 — plain SessionSettings object, no Builder
const sessionSettings = {
  sessionType: "VIDEO",   // or "VOICE"
  layout: "TILE",
};

// v5 — generateToken takes ONLY sessionId (Calls SDK has its own auth state
// after CometChatCalls.login(); no authToken arg needed).
const tokenRes = await CometChatCalls.generateToken(sessionId);

// htmlElement is REQUIRED — pass the DOM container the SDK should draw into
const container = document.getElementById("ongoing-call-root")!;
const result = await CometChatCalls.joinSession(tokenRes.token, sessionSettings, container);
if (result?.error) {
  console.error("joinSession failed:", result.error);
}
```

The two-`Call`-classes problem from Android does NOT exist on JS — there's only one `CometChat.Call` constructor. But the dual-SDK split still trips up agents trained on the chat-only docs.

### 1.2 VoIP push — N/A on web (browsers don't have VoIP push)

The mandatory-VoIP-push rule from mobile families does not apply to web. Browsers cannot ring a closed tab. The standalone-mode equivalent is **Web Push notifications** (Service Worker + `Notification` API + push subscriptions) — useful for nudging the user to a tab where the call screen is open, but they do not bypass tab/page-load.

The skill scaffolds Web Push as an opt-in (asks user); it is not strictly required. Production calls UX on web typically pairs with email/SMS fallback for missed calls, not VoIP.

### 1.3 Lifecycle — `getUserMedia` cleanup

Web's equivalent of Android's foreground-service correctness is `MediaStream` track cleanup. Browsers don't release the camera/mic until tracks are explicitly stopped. The kit handles this for `<CometChatOngoingCall />`, but custom WebRTC surfaces (Section 4) must do:

```ts
function endCall() {
  // 1. End the Calls SDK session — releases the kit's internal stream
  CometChatCalls.leaveSession();   // v5 — was endSession() in v4 (still works as a deprecated shim)

  // 2. If you grabbed a custom MediaStream (preview, screen-share), stop tracks
  customStream?.getTracks().forEach(t => t.stop());
  customStream = null;

  // 3. Detach video elements
  if (videoEl.current) videoEl.current.srcObject = null;
}
```

Skipping this leaves the camera light on until the tab is closed. Same canonical bug as iOS rule 1.5.

### 1.4 Server-minted auth tokens for production

In v5 the Calls SDK has **its own login step** — it no longer piggybacks on the Chat SDK's auth context implicitly. After `CometChat.login()` resolves on the chat side, call **`CometChatCalls.login(uid, apiKey)`** for dev or **`CometChatCalls.loginWithAuthToken(authToken)`** for production. The auth token is the same token your backend mints via the CometChat Create-Auth-Token API; the Calls SDK and Chat SDK accept it interchangeably.

```ts
// Dev
await CometChatCalls.login(uid, import.meta.env.VITE_COMETCHAT_API_KEY);

// Production (server-minted token)
await CometChatCalls.loginWithAuthToken(authTokenFromBackend);
```

`cometchat-production` (web) covers the token-endpoint pattern.

### 1.5 Hangup cleanup — see rule 1.3

### 1.6 Permissions — `getUserMedia` prompts

The browser handles the runtime permission prompt automatically when the Calls SDK calls `getUserMedia`. The integration must:

- Surface a `try/catch` around `startSession` to handle `NotAllowedError` (user denied)
- Surface `NotFoundError` (no camera/mic on device — common on desktops with no webcam)
- Render a clear in-app explanation BEFORE the browser prompts, so users know what they're agreeing to (browsers ignore this in autoplay/iframe contexts but it improves grant rates)

There are no manifest-level permission declarations on web. HTTPS is required — the skill detects `localhost` (allowed) vs other origins (must be HTTPS) and warns if the dev server is HTTP.

### 1.7 IncomingCall mounted at app root

`<CometChatIncomingCall />` (additive mode) or a Service-Worker-driven web-push handler (standalone mode) must mount above the route boundary so calls fire on every page.

```tsx
// app/layout.tsx (Next.js App Router) or App.tsx (Vite/CRA)
<CometChatProvider>
  <CometChatIncomingCall />   {/* renders nothing when no call active; listens app-wide */}
  <Routes>...</Routes>
</CometChatProvider>
```

Mounting it inside a route component means it disappears on navigation — calls only ring on the screen where it's mounted. That's the canonical "calls don't work" bug on web.

---

## 2. Setup

### Install

Calls SDK v5.0.0 stable shipped but the npm `latest` dist-tag still points at v4.2.6 (legacy). **Always pin to `@5` (or a specific `^5.0.0` version)** — `npm install @cometchat/calls-sdk-javascript` (no tag) resolves to v4.2.6, which is the previous generation. `@beta` is also published but pins to an older 5.0.0-beta.2 — prefer `@5` to get the latest stable 5.x.

```bash
# v5 stable (current — pulls 5.0.0 or newer 5.x)
npm install @cometchat/chat-sdk-javascript @cometchat/calls-sdk-javascript@5
# additive mode: @cometchat/chat-uikit-react is already installed
```

The kit (`@cometchat/chat-uikit-react@^6.x`) was built against the v4 calls API but Calls SDK v5 ships v4 deprecated-method shims that delegate to v5 implementations — so the kit's `CometChatCallButtons` / `CometChatIncomingCall` / `CometChatOngoingCall` keep working when you swap v4 for v5. Custom call surfaces should use v5 APIs directly.

### Init order (web — v5)

```tsx
// cometchat/init.ts
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

let initialized = false;

export async function initCometChat() {
  if (initialized) return;

  // 1. Chat SDK init (signaling)
  const appSettings = new CometChat.AppSettingsBuilder()
    .subscribePresenceForAllUsers()
    .setRegion(import.meta.env.VITE_COMETCHAT_REGION)  // adjust for framework
    .build();
  await CometChat.init(import.meta.env.VITE_COMETCHAT_APP_ID, appSettings);

  // 2. Calls SDK init (WebRTC) — v5 takes a plain object and returns {success, error}
  const callsInit = await CometChatCalls.init({
    appId: import.meta.env.VITE_COMETCHAT_APP_ID,
    region: import.meta.env.VITE_COMETCHAT_REGION,
  });
  if (!callsInit?.success) {
    throw new Error(`CometChatCalls.init failed: ${JSON.stringify(callsInit?.error)}`);
  }

  initialized = true;
}

// After your existing CometChat.login(uid, apiKey) call, login the Calls SDK too.
// In v5 the Calls SDK has its own auth state; this step is mandatory.
export async function loginCometChat(uid: string) {
  await CometChat.login(uid, import.meta.env.VITE_COMETCHAT_AUTH_KEY);

  // v5 — Calls SDK login. Either form is fine; loginWithAuthToken is for production.
  if (!CometChatCalls.getLoggedInUser()) {
    await CometChatCalls.login(uid, import.meta.env.VITE_COMETCHAT_API_KEY);
    // OR: await CometChatCalls.loginWithAuthToken(serverMintedToken);
  }
}
```

The module-level `initialized` flag prevents StrictMode double-init in React 18+ dev mode. The `getLoggedInUser()` guard prevents re-login on hot reload.

### Framework-specific env prefixes (already covered by `cometchat-core`)

| Framework | Env prefix |
|---|---|
| Vite (reactjs / react-router) | `VITE_` |
| CRA | `REACT_APP_` |
| Next.js | `NEXT_PUBLIC_` |
| Astro | `PUBLIC_` |

### SSR safety

CometChat Calls SDK is browser-only — `window`, `MediaStream`, `RTCPeerConnection`, `navigator.mediaDevices`. Calls components must NOT render server-side:

- **Next.js App Router:** add `"use client"` to the file containing call components
- **Next.js Pages Router:** dynamic-import with `ssr: false`
- **React Router:** lazy + `<Suspense>` + `if (typeof window === "undefined") return null` guard in the component
- **Astro:** `client:only="react"` on the call component island

---

## 3. Components catalog

### Calls SDK primitives — v5 (used in standalone or wherever you build custom UI)

| Class / function | Purpose |
|---|---|
| `CometChatCalls.init({ appId, region })` | One-time init. Returns `Promise<{ success, error }>` — check `.success`. |
| `CometChatCalls.login(uid, apiKey)` | Dev-mode login. Returns the logged-in `User`. |
| `CometChatCalls.loginWithAuthToken(authToken)` | Production login with server-minted token. |
| `CometChatCalls.getLoggedInUser()` | Returns a plain `{ uid, name, avatar?, status?, ... }` object or `null`. Access `.uid` as a PROPERTY (not `.getUid()` — that method belongs to the Chat SDK's `User` class, which session-only code does not import). Use to guard against double-login: `if (existing && existing.uid === uid) return existing;` |
| `CometChatCalls.logout()` | Clears Calls SDK auth state. |
| `CometChatCalls.generateToken(sessionId)` | Mint a session-scoped RTC token. **Single arg** — auth is implicit after `login()`. |
| `CometChatCalls.joinSession(callToken, sessionSettings, htmlElement)` | Join the WebRTC session — `htmlElement` is required. Returns `{ data, error }`. |
| `CometChatCalls.leaveSession()` | End + cleanup. Returns `void`. |
| `CometChatCalls.addEventListener(eventName, handler)` | Granular event subscription — replaces v4's monolithic `OngoingCallListener`. Returns an unsubscribe function. |
| `CometChatCalls.setLayout(layout)` | `"TILE"` / `"SIDEBAR"` / `"SPOTLIGHT"`. Per-participant. |
| `CometChatCalls.constants.LAYOUT` | Layout enum for type-safety. |

**v4 → v5 method mapping** (the deprecated v4 method names below all still work in v5 as shims that delegate to v5 implementations — your kit's v6 code is unaffected):

| v4 (deprecated) | v5 |
|---|---|
| `init(new CallAppSettingsBuilder().setAppId(...).build())` | `init({ appId, region })` |
| `generateToken(sid, authToken)` | `generateToken(sid)` (after `login()`) |
| `startSession(token, settings, el)` | `joinSession(token, settings, el)` |
| `endSession()` | `leaveSession()` |
| `setMode(mode)` | `setLayout(layout)` |
| `OngoingCallListener` (single object) | `addEventListener(name, handler)` (granular) |
| `enterPIPMode()` | `enablePictureInPictureLayout()` |

See `references/migration-v4-to-v5.md` for the full migration guide.

### UI Kit components (additive mode — `@cometchat/chat-uikit-react`)

| Component | Purpose |
|---|---|
| `<CometChatCallButtons user={u} />` | Voice + video icon row, drop into any header |
| `<CometChatIncomingCall />` | Root-mounted; renders nothing when no call active |
| `<CometChatOutgoingCall />` | Auto-mounted by IncomingCall on initiateCall |
| `<CometChatOngoingCall />` | Active call view; hosts the WebRTC element |
| `<CometChatCallLogs onItemClick={fn} />` | Paginated history |

In standalone mode, you can compose just `<CometChatOngoingCall />` + `<CometChatCallLogs />` from the UI Kit even without using `CometChatConversations` etc. — the kit's calls components don't depend on its conversation components.

---

## 4. Standalone integration

When `product === "voice-video"` and there is no existing chat UI integration.

**Split by calling mode — these are two different shapes:**

### 4a. Standalone — Session mode (meeting-room UX, no ringing)

Calls SDK ONLY. NO Chat SDK. Matches the upstream sample at `~/Downloads/calls-sdk/calls-sdk-javascript-5/sample-apps/cometchat-calls-sample-app-react/`. The skill scaffolds:

1. **`cometchat/init.ts`** — `CometChatCalls.init({ appId, region, authKey })` ONLY. No `CometChat.init`, no `CometChat.login`. Pass `authKey` at init time so subsequent `CometChatCalls.login(uid)` calls need no second arg.
2. **`cometchat/CometChatProvider.tsx`** — Runs Calls SDK init on mount, exposes `loggedInUser` via `CometChatCalls.getLoggedInUser()`, gates children on success.
3. **`pages/Home.tsx`** — UID picker (dev mode) + "Start meeting" (mints UUID, navigates to `/meet/:id`) + "Join meeting" (paste sessionId).
4. **`pages/CallRoom.tsx`** — `/meet/:sessionId` route. Container is `position: fixed; width: 100vw; height: 100vh`. `CometChatCalls.joinSession(token, {}, container)` with empty settings. See `references/call-session.md` for the canonical pattern.
5. **HTTPS check** — warns if dev server is HTTP non-localhost.

**Why no Chat SDK:** session mode never touches the Chat SDK call entity. Initializing both SDKs adds two failure modes (Chat init, Chat login race) for zero benefit. The upstream sample confirms this — it never imports `@cometchat/chat-sdk-javascript`.

### 4b. Standalone — Ringing mode (CallButtons + Incoming/Outgoing/Ongoing kit components)

Dual-SDK: Chat SDK signaling channel + Calls SDK media channel. The skill scaffolds:

1. **`cometchat/init.ts`** — Chat SDK + Calls SDK init (sequential), module-level guard.
2. **`cometchat/CometChatProvider.tsx`** — React provider, runs init+login on mount, gates children on success.
3. **`components/CallButton.tsx`** — Voice + video buttons next to a user (your existing user listing / profile page).
4. **`/calls` route or screen** — Renders `<CometChatCallLogs />` for history. (Path depends on framework — `app/calls/page.tsx` for Next.js App Router, `routes/calls.tsx` for React Router, etc.)
5. **`OngoingCallView.tsx`** — Custom WebRTC view OR delegates to `<CometChatOngoingCall />`. Implements rule 1.3 cleanup.
6. **Provider mounts `<CometChatIncomingCall />`** at the layout root (rule 1.7).
7. **Optional Web Push** — Service Worker registration + push subscription endpoint, if the user opts in.
8. **HTTPS check** — warns if dev server is HTTP non-localhost.

## 5. Additive integration

When `cometchat-core` integration already exists. The skill:

1. Adds `@cometchat/calls-sdk-javascript@5` to `package.json` (v5.0.0 stable — see Install section).
2. Patches `cometchat/init.ts` to call `CometChatCalls.init({...})` after `CometChat.init` AND to call `CometChatCalls.login(uid, apiKey)` after `CometChat.login` (v5 — separate auth).
3. Mounts `<CometChatIncomingCall />` at the layout root next to existing components (rule 1.7).
4. Adds `<CometChatCallButtons user={user} />` inline on selected screens — usually inside `<CometChatMessageHeader />` (the kit auto-renders it there if a `user` prop is set).
5. Adds a `/calls` route for `<CometChatCallLogs />` if the user picked the "dedicated route" option.

## 6. Anti-patterns

1. **Mounting `<CometChatIncomingCall />` inside a route component.** Disappears on navigation. Mount above the route boundary in the layout (rule 1.7).
2. **Initializing both SDKs in parallel.** `CometChatCalls.init` requires the Chat SDK's app-id context; calling them with `Promise.all` causes intermittent "auth context null" errors. Sequence: chat init → calls init.
3. **Skipping the `initialized` guard.** React StrictMode renders effects twice in dev — without the guard, you get duplicate listeners and double-init warnings.
4. **Forgetting `getTracks().forEach(t => t.stop())` on custom streams.** Camera light stays on until tab close. Rule 1.3.
5. **Embedding `<CometChatOngoingCall />` in an `<iframe>` without `allow="camera; microphone"`.** Browsers silently deny `getUserMedia`. The skill detects iframe contexts and writes the allow list.
6. **Calling `joinSession` (v5) before `CometChatCalls.login()` resolves.** `generateToken` 401s — no Calls SDK auth state. Sequence: `CometChatCalls.init` → `CometChatCalls.login` → `generateToken` → `joinSession`.
7. **Installing `@cometchat/calls-sdk-javascript` without a version pin.** Resolves to v4.2.6 (the `latest` dist-tag) instead of v5.0.0. The kit's v4 deprecated-method shims live INSIDE v5 — picking up plain v4 means you don't get them. Always `@5` (recommended) or pin a specific `^5.0.0` version. `@beta` is also valid but pins to an older `5.0.0-beta.2`.
7. **Running over HTTP (non-localhost).** `getUserMedia` returns `NotAllowedError`. The skill warns; user must use HTTPS or `localhost`.

## 7. Verification checklist

**Static:**

- [ ] Both `@cometchat/chat-sdk-javascript` and `@cometchat/calls-sdk-javascript@5` (v5 stable) in `package.json`
- [ ] `CometChatCalls.login(uid, apiKey)` is called after `CometChat.login` (v5 separate auth)
- [ ] Init order: chat init → calls init (sequential, not parallel)
- [ ] `<CometChatIncomingCall />` mounted at layout root (additive mode)
- [ ] Cleanup path stops MediaStream tracks + ends Calls SDK session
- [ ] Framework-correct SSR guard (`"use client"` / `ssr: false` / `client:only`)
- [ ] Env vars use the framework-correct prefix
- [ ] Module-level `initialized` flag for StrictMode safety

**Runtime (browser):**

- [ ] Outgoing call connects, two-way audio + video
- [ ] Incoming call rings on a separate page within the same SPA
- [ ] Camera light off within 2 seconds of hangup
- [ ] Tab refresh during call cleanly disconnects (no orphaned session)
- [ ] HTTPS or localhost only — `getUserMedia` works
- [ ] Multi-tab: closing one tab doesn't end the call in another tab

## 8. Pointers

- `cometchat-core` — provider pattern, init guard, login order
- `cometchat-components` — full UI Kit catalog (additive mode)
- `cometchat-{nextjs,react,react-router,astro}-patterns` — framework-specific SSR guards, route placement
- `cometchat-production` — server-minted tokens, security
- `cometchat-troubleshooting` — common web failure modes (HTTPS, iframe permissions, StrictMode double-init)
