---
name: cometchat-calls
description: Entry-point for adding CometChat Voice & Video Calling to any React, React Native, Angular, native Android, native iOS, or Flutter project. Detects the framework, picks standalone (calls-only) vs additive (calls on top of existing chat) mode, and routes to the per-family calls skill. Invoked by the top-level `cometchat` dispatcher when `product === "voice-video"` or `chat-messaging+voice-video`, and directly when the user asks for calls explicitly.
license: "MIT"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat calls voice video webrtc dispatcher react react-native angular android ios flutter callkit pushkit voip"
---

## Use this skill when

- The top-level `cometchat` dispatcher's Step 3.0 routes here because `product === "voice-video"` or `chat-messaging+voice-video`
- The user explicitly asks for calling: *"add calls"*, *"add video calling"*, *"add voice calls"*, *"set up call screen"*, *"integrate calls SDK"*, *"add CallKit"*
- The user is iterating on an existing chat integration and picks *"Add calling"* from the iteration menu (Step 7 of `cometchat`)

This is the **entry point for every calls integration**. Do NOT invoke per-family `cometchat-{family}-calls` skills directly — this dispatcher detects the family, picks the integration mode (standalone vs additive), and routes to the right skill with the right preconditions.

**Supported families:**

| Family | Per-family skill | Calls SDK package | Stable today? |
|---|---|---|---|
| **Web** (React / Next.js / React Router / Astro) | `cometchat-react-calls` | `@cometchat/calls-sdk-javascript` | Yes |
| **React Native** (Expo + bare) | `cometchat-native-calls` | `@cometchat/calls-sdk-react-native` | Yes |
| **Angular** (12–15) | `cometchat-angular-calls` | `@cometchat/calls-sdk-javascript` | Yes |
| **Android** (V5 stable) | `cometchat-android-v5-calls` | `com.cometchat:calls-sdk-android:5.x` (Cloudsmith) | Yes — production-ready |
| **Android** (V6 beta) | `cometchat-android-v6-calls` | Calls fold into `chatuikit-{compose,kotlin}-android:6.x` for V6 | Beta |
| **iOS** (V5 stable) | `cometchat-ios-calls` | `CometChatCallsSDK` (SPM / CocoaPods) | Yes |
| **Flutter** (V5 stable) | `cometchat-flutter-v5-calls` (already exists) | `cometchat_calls_sdk` (Cloudsmith) | Yes |
| **Flutter** (V6 beta) | `cometchat-flutter-v6-calls` (already exists) | Calls fold into `cometchat_chat_uikit:^6.0.0-beta2` | Beta |

> **Status:** This dispatcher is the v4.1 entry point. Per-family skill stubs are scaffolded and being filled in. Flutter v5/v6 calls skills already exist from v4.0.0 and will be audited and brought into the same shape; the other six are being authored against `~/Downloads/calls-sdk/calls-sdk-{android,ios,javascript,react-native}-5/` as ground truth (Android ships 17 pre-authored sub-skills folded into `cometchat-android-v5-calls/references/`).

## Why a separate calls dispatcher

The chat dispatcher (`cometchat/SKILL.md`) assumes the user is adding a chat surface — its placement vocabulary, component catalog, framework skills, and verification checklist are all chat-shaped. Calls is a different surface area:

| Concern | Chat dispatcher | Calls dispatcher (this skill) |
|---|---|---|
| Packages | `chat-uikit-*` + `chat-sdk-*` | `chat-sdk-*` + `calls-sdk-*` (no UI Kit in standalone mode) |
| Init | Chat SDK init + login | Chat SDK init + login + Calls SDK `CallAppSettings` (the dual-SDK contract) |
| Placement question | "Where does **chat** live?" | "Where does the **call trigger** live?" + "Where do call logs live?" |
| Components | Conversations, MessageList, Composer, Users, Groups | CallButtons, IncomingCall, OutgoingCall, OngoingCall, CallLogs |
| `IncomingCall` mount | At chat surface (rings while user is chatting) | **At app root** — always-rendering, listens app-wide |
| VoIP push (mobile) | Optional add-on | **Mandatory** in standalone mode — calls without ringing isn't a product |
| Background lifecycle | N/A unless calls feature added | **Required** — Android foreground service / iOS CallKit + PushKit |

The two dispatchers share `cometchat-{family}-core` (init + login + env + theme tokens) but diverge on everything else.

## How v4.1 calls integration works

Same conversational model as the chat dispatcher — detect, gather, plan, write, verify — but with a calls lens.

### Steps

#### Step 1 — Detect family + mode

If the user came from the top-level `cometchat` dispatcher, framework + credentials are already in `.cometchat/config.json`. **Skip detection** and read:

```bash
npx @cometchat/skills-cli config show --json
```

If invoked directly (e.g. user typed *"add calls to my app"*), run:

```bash
npx @cometchat/skills-cli detect --json
```

Same family detection as the chat dispatcher (`reactjs`, `nextjs`, `react-router`, `astro`, `expo`, `react-native`, `angular`, `android`, `flutter`, `ios`).

**Pick the integration mode** by looking at the project state:

| Signal | Mode | What runs |
|---|---|---|
| `.cometchat/state.json` exists with chat surfaces wired | **Additive** — calls layered onto existing chat | Per-family `-calls` skill in additive section. Patches the existing provider to mount `IncomingCall` at root. Adds call buttons inline on chat surfaces. Optional VoIP push. |
| `.cometchat/state.json` does NOT exist (or has no chat surfaces) AND `product === "voice-video"` | **Standalone** — calls is the product | Per-family `-calls` skill in standalone section. No chat UI Kit. CallButtons + IncomingCall + OngoingCall + CallLogs. VoIP push **wired**, not optional. `/calls` route or platform equivalent for call logs. |
| Neither — user wants calls but it's ambiguous | **Ask** | AskUserQuestion: *"Are you adding calling alongside an existing chat integration, or building a calling-first app?"* |

#### Step 2 — Verify credentials

Calls reuses Chat SDK credentials. If `.env` (web/RN), `local.properties` (Android), `Secrets.swift` (iOS), `lib/cometchat_config.dart` (Flutter), or `src/environments/environment.ts` (Angular) already has `appId` / `region` / `authKey`, **skip credential setup**.

If credentials are missing, hand back to `cometchat/SKILL.md` Step 2 — credential provisioning is the same regardless of product. Do not duplicate the auth flow here.

#### Step 3 — Gather calls-specific requirements

##### Step 3.0 — Calling mode (Ringing vs Session) ★

This is the first calls-specific question. The Calls SDK supports two fundamentally different UX shapes — pick before anything else, because the rest of Step 3 + the per-family scaffold differ.

**Resolve in priority order:**

**1. Infer ONLY from explicit signals.** Don't default to either mode. The user must clearly indicate one of the two flavors before you skip the prompt:

| User said something like… | Mode |
|---|---|
| "1:1 call", "user to user call", "phone call", "ring my friend", "call a contact", "FaceTime-like", "WhatsApp-style call" | **Ringing** |
| "group call between friends", "conference call up to N people" (small group, one initiator who rings) | **Ringing** |
| "meeting", "Google Meet", "Zoom-like", "scheduled meeting", "join with a link", "meeting room", "conference room", "webinar", "town hall", "virtual classroom" | **Session** |
| "huddle" (Slack-style — instant join from a channel) | **Session** |
| **Just "calls", "calling", "integrate calls", "add calls", "set up calling", "voice/video calls"** with NO further context about ringing-vs-meeting | **AMBIGUOUS — ASK (do NOT default)** |
| Mixed signals ("calls and meetings", "phone calls or video conferencing") | **AMBIGUOUS — ASK** |

The bottom rows are the load-bearing ones. **Generic phrases like "integrate calls" or "I want calling in my app" are NOT a signal for Ringing — they're a signal that the user hasn't told you yet.** Ask.

If you DO have a clear signal, confirm with one line so the user can redirect:
> "Got it — setting up Ringing (1:1 / group calls with an incoming-call screen). If you wanted meeting-room URLs instead, say so and I'll switch."

**2. Use Tier 4 use-case context if available.** Use-cases telegraph the mode:

| Use case | Mode |
|---|---|
| Telehealth provider/patient (1:1 visit) | Ringing |
| Marketplace buyer ↔ seller | Ringing |
| Customer support (agent ↔ customer) | Ringing |
| Broadcast / webinar / town hall | Session |
| Team huddle / standup | Session |

**3. Only if you can't tell** — ask. Use this prompt **verbatim** — do NOT rephrase, do NOT swap options. Option 1 is "Session"; option 2 is "Ringing":

- **question:** "What kind of calling experience are you building?"
- **header:** "Calling mode"
- **multiSelect:** false
- **options (display in this exact order — Session FIRST, Ringing SECOND):**
  1. label: "Session — meeting / conference room", description: "Multiple users join the same session by ID or link. No ringing. Like Google Meet, Zoom, or a Slack huddle. Examples: scheduled meetings, webinars, team huddles, classroom calls."
  2. label: "Ringing — 1:1 or group calls", description: "One user calls another (or a small group). Recipient's device rings; they accept or decline. Like a phone call. Examples: WhatsApp, FaceTime, in-app voice/video calls between contacts."

> **Strict-order rule:** render option 1 above option 2. Do not reorder. Session-first is standardized across CometChat product surfaces.

Map to mode value:
- "Ringing" → `mode === "ringing"`
- "Session" → `mode === "session"`

This drives which per-family reference loads at Step 6:

| Mode | Reference (per-family) | Reference (Android V5) |
|---|---|---|
| `ringing` | `cometchat-{family}-calls/references/ringing-integration.md` | `cometchat-android-v5-calls/references/ringing-integration.md` |
| `session` | `cometchat-{family}-calls/references/call-session.md` | `cometchat-android-v5-calls/references/join-session.md` |

> **Note on the kit's prebuilt UI ("Standard" mode in earlier docs):** the UI Kit's `<CometChatCallButtons />` + `<CometChatIncomingCall />` + `<CometChatOngoingCall />` are a kit-provided implementation of **Ringing**, not a third mode. If the user picks Ringing AND wants the kit's prebuilt UI (most common), the per-family scaffold uses kit components and treats the ringing reference as the architectural ground-truth. If they want custom UI on top of the chat-SDK signaling, the ringing reference is the implementation guide.

> **⚠️ Group calls do NOT use the Ringing channel** (validated 2026-05-15, applies to all kits). The kit's `<CometChatCallButtons group={g}>` sends a **custom meeting message** to the group via `CometChat.sendCustomMessage` with `type: "meeting"`, NOT `CometChat.initiateCall`. Other group members receive the meeting card in `<CometChatMessageList />` (kit-based receivers) OR a `MessageListener.onCustomMessageReceived` with `category: CATEGORY_CUSTOM` + `type: "meeting"` (custom-UI receivers). The `CallListener.onIncomingCallReceived` channel only fires for 1:1 user calls. If the user wants group calls, load `references/group-calls.md` IN ADDITION TO ringing-integration.md — group has its own architecture even though customers think of it as "ringing for groups."

##### Step 3.1 — Call trigger placement (where the call starts from)

Different from the chat dispatcher's Step 3a archetype question. Ask placement-intent on the **calls surface**:

Ask the user (preserve the structured shape — `question`/`header`/`multiSelect`/`options[].label`/`options[].description`):
- **question:** "How should users start a call in your app?"
- **header:** "Call trigger"
- **multiSelect:** false
- **options** (the option set differs by mode — show only the rows matching `mode` from Step 3.0):

  **If `mode === "ringing"`** — show these:
  1. label: "Call button on user/contact profile", description: "Voice + video buttons next to a user's name. Best for marketplaces, social, dating, healthcare."
  2. label: "Always-on '/calls' route", description: "Dedicated calls page with a 'Start a call' picker and call history. Best for telehealth, virtual events, contact centers."
  3. label: "Embedded in chat surface", description: "Call buttons in the chat header — voice + video next to message threads. Best for apps that already have chat. (Additive mode only.)"
  4. label: "Floating widget", description: "Always-visible call bubble — like Zoom's floating window. Best for support / sales tools."

  **If `mode === "session"`** — show these instead:
  1. label: "Meeting link route ('/meet/:sessionId')", description: "Shareable URLs that anyone with the link can join. Best for scheduled meetings, webinars, classrooms."
  2. label: "Channel-bound huddle", description: "Session keyed to a chat channel/group ID — anyone in the channel can join the active huddle. Best for team collab apps."
  3. label: "Lobby / waiting-room route", description: "User lands on a waiting screen, host admits. Best for telehealth, customer support."
  4. label: "Custom — I'll wire it myself", description: "Just give me the SDK glue. I'll decide the surface."

The chosen option drives which per-family `-calls` skill section to load and what to scaffold.

**Then ask about call logs separately** — call logs are usually a different surface from the trigger:

- **question:** "Where should call history live?"
- **header:** "Call logs"
- **options:**
  1. label: "Dedicated /calls route (or screen)", description: "Recommended — full call history, filterable, jump to caller's profile."
  2. label: "Inside the call trigger surface", description: "Compact list under the call button. Best when call volume is low."
  3. label: "Don't show call history", description: "Skip — calls just happen, no log surface."

#### Step 4 — Detect mandatory mobile prerequisites

For mobile families (`android`, `ios`, `expo`, `react-native`, `flutter`), VoIP push is **non-negotiable in standalone mode** — without it, missed calls don't ring. Detect what's already wired so the per-family `-calls` skill knows what to add and what to skip:

**Android:**
- Firebase Cloud Messaging — look for `google-services.json` in `app/` and `id("com.google.gms.google-services")` in `app/build.gradle{.kts}`
- Service registration — look for `<service android:name=".YourFirebaseMessagingService" ...>` in `AndroidManifest.xml`
- ConnectionService — look for `android.permission.MANAGE_OWN_CALLS` and `BIND_TELECOM_CONNECTION_SERVICE` in `AndroidManifest.xml`
- Foreground service type — look for `<service android:foregroundServiceType="phoneCall|microphone|camera">` (Android 14+ silently crashes without `phoneCall`)

**iOS:**
- CallKit — look for `import CallKit` and a `CXProvider` configured somewhere in source
- PushKit — look for `import PushKit` and a `PKPushRegistry` listener (VoIP push token registration)
- Capabilities — look for `Background Modes` with `voip` + `audio` + `remote-notification` in `Info.plist` and `entitlements`
- Microphone + camera Info.plist usage strings

**React Native:**
- `react-native-callkeep` (CallKit + ConnectionService bridge) in `package.json`
- `@react-native-firebase/messaging` (Android) and a `PushNotificationIOS` setup
- `react-native-voip-push-notification` for iOS VoIP push tokens

**Flutter:**
- `flutter_callkit_incoming` in `pubspec.yaml`, OR a platform-channel bridge to native CallKit/ConnectionService
- `firebase_messaging` for FCM
- Native `Info.plist` and `AndroidManifest.xml` entries (Flutter doesn't auto-add these)

Surface what's wired and what's missing. The per-family `-calls` skill writes the missing pieces — it never assumes they're already there.

#### Step 5 — Show the plan and get approval

Before writing anything, show the user exactly:
- Which packages will be installed
- Which files will be created vs modified vs left alone
- Where the call trigger will land (with the file path)
- Where call logs will land (or "skipped" if option 3 above)
- For mobile: what VoIP push artifacts will be added (FCM service, CallKit provider, foreground service registration, manifest permissions, Info.plist entries)
- What the user must do manually that the skill can't (Android: enable FCM in Firebase console; iOS: add VoIP Services certificate to App Store Connect; Flutter: bump `minSdkVersion` if below platform floor)

Wait for explicit approval. Then load the per-family `-calls` skill and run its scaffold.

#### Step 6 — Hand off to the per-family skill

Load the matching skill from your context:

| Detected family | Skill to load |
|---|---|
| `reactjs` / `nextjs` / `react-router` / `astro` | `cometchat-react-calls` |
| `expo` / `react-native` | `cometchat-native-calls` |
| `angular` | `cometchat-angular-calls` |
| `android` + `android_version === "v5"` | `cometchat-android-v5-calls` |
| `android` + `android_version === "v6"` | `cometchat-android-v6-calls` |
| `flutter` + `flutter_version === "v5"` | `cometchat-flutter-v5-calls` (existing) |
| `flutter` + `flutter_version === "v6"` | `cometchat-flutter-v6-calls` (existing) |
| `ios` | `cometchat-ios-calls` |

Pass the gathered context: **`mode`** (`ringing` | `session` from Step 3.0), **standalone vs additive** (Step 1), **trigger placement** (Step 3.1), log placement, mobile prereqs status.

The per-family skill loads the matching mode reference as its primary blueprint:

| `mode` | Reference loaded inside the per-family skill |
|---|---|
| `ringing` (1:1 user calls) | `references/ringing-integration.md` (Android V5: same name) |
| `session` (meeting-room URLs, no chat-side signaling) | `references/call-session.md` (Android V5: `references/join-session.md`) |

**Additionally** — if `groupCalls === true` in the gathered context (the user mentioned "group calls", "team meetings", "huddles", or selected `group` as a call target in Step 3.1), **ALSO load `references/group-calls.md` from the per-family skill**. Group calls use a different signaling channel than 1:1 ringing — they broadcast a custom `"meeting"` message instead of `CometChat.initiateCall`. Loading only `ringing-integration.md` produces code that works for 1:1 but silently breaks for groups on custom-UI receivers. The `group-calls.md` reference exists for all 8 families. See the Step 3.0 disclosure above for the underlying semantic.

The per-family skill writes code; this dispatcher does not.

If the per-family skill isn't loaded into the agent's context (i.e. the user installed `@cometchat/skills` before v4.1 and never re-ran `npx @cometchat/skills add --family <family>`), tell the user once:

> "I just installed the {family} calls skill into your workspace. Please re-run `/cometchat-calls` to continue — your config is saved in `.cometchat/config.json`, so the next run picks up at code generation without re-asking the placement questions."

Same hot-reload constraint as the chat dispatcher: agents snapshot the skill set at session start and don't reload mid-session. Continuing this session would mean writing calls code from training memory — which the per-family skill explicitly forbids.

#### Step 7 — Verify

After the per-family skill writes code, run:

```bash
npx @cometchat/skills-cli verify --calls --json
```

(Verifier flag `--calls` is added in CLI 2.4.0 alongside this dispatcher; it checks for the dual-SDK init, IncomingCall root mount, VoIP push wiring on mobile, and the call trigger / logs placements the user picked.)

If verify passes, drop the user into the iteration menu — same shape as the chat dispatcher's Step 7, with calls-specific options:

- Add a feature (recording, screen sharing, PiP, in-call chat, custom UI)
- Customize call screen / participant list / control panel
- Set up production auth (server-minted tokens, no Auth Key in calls flow)
- Run diagnostics

## Hard rules (every per-family `-calls` skill must enforce these)

These are the production-grade non-negotiables. The dispatcher checks them in Step 5's plan and the per-family skill is responsible for writing them:

1. **Dual-SDK contract.** Chat SDK does `initiateCall` (sends a `MessageType.CALL`); Calls SDK does `joinSession`. They are NOT interchangeable. The Android skill leads with this — agents trained on multi-platform CometChat data will conflate `com.cometchat.chat.core.Call` with `com.cometchat.chat.models.Call` and write code that compiles but silently breaks.
2. **VoIP push wired in standalone mode, not documented.** CallKit + PushKit (iOS), ConnectionService + FCM high-priority (Android), `react-native-callkeep` (RN), `flutter_callkit_incoming` (Flutter). Documentation isn't enough — without working push, missed calls don't ring.
3. **Foreground / background lifecycle correct.** Android 14+ silently crashes on wrong `foregroundServiceType` for ongoing calls; iOS requires CallKit reporting for background audio. Belongs in the `-calls` skill body, not a "see also" reference.
4. **Server-minted auth tokens for the calls path.** Production calls flows must use auth tokens, never Auth Key. The skill detects existing token endpoints (same way the chat dispatcher does) and uses `loginWithAuthToken()`.
5. **Cleanup on hangup.** Camera-light-stays-on / mic-stays-hot is the canonical "looks fine in dev, fails review" bug. Every per-family skill includes the explicit teardown checklist.
6. **Permissions with rationale.** Microphone, camera, screen-record (where supported), notifications. All four, all with usage strings.
7. **`IncomingCall` mounted at app root in standalone mode.** Not at the chat surface — calls is the whole product, the listener has to be alive everywhere.

## Anti-patterns

1. **Don't try to add `apply-feature calls` from this dispatcher.** That CLI command is the v4 chat-flow path — it returns the npm install command and that's it. This dispatcher does the actual integration end-to-end. If the user is in `chat-messaging+voice-video` mode, the chat flow already ran; just enter additive mode here. Never call `apply-feature calls` from inside this skill.
2. **Don't load `cometchat-components` or `cometchat-placement` (the chat catalogs).** Those are chat-shaped. The per-family `-calls` skill has its own component list (CallButtons, IncomingCall, OutgoingCall, OngoingCall, CallLogs) and its own placement vocabulary (call trigger, log surface, root listener). Loading the chat catalogs leaks chat assumptions into calls code.
3. **Don't ask the chat archetype question** ("Messaging app / Marketplace / SaaS / …"). That taxonomy is for *where chat lives*. Calls placement is *where the call trigger lives* + *where logs live* + *whether VoIP push is mandatory*. Different vocabulary, different recommendations.
4. **Don't skip VoIP push in standalone mode** even if the user says "I'll add it later." Calls without ringing isn't a product. The dispatcher refuses standalone-mode scaffold without VoIP push wired (or at minimum scaffolded with a clear TODO and red-banner warning in the call screen).
5. **Don't mix V5 and V6 cohorts** (Android, Flutter). The Calls SDK coordinates differ — V5 Android ships `calls-sdk-android` as a separate Cloudsmith dep; V6 folds calls into the unified `chatuikit-{compose,kotlin}-android` package. Same for Flutter. Read `android_version` / `flutter_version` from `.cometchat/config.json` and route to the matching cohort skill.

## Ground truth references

Per-family `-calls` skills cite from these sources. The dispatcher itself doesn't write code; the per-family skills do. References listed here so a future audit can verify which SDK signatures the skills target.

- **Android V5:** `~/Downloads/calls-sdk/calls-sdk-android-5/` — pre-authored 17-skill pack at `skills/`, dispatcher at `AGENTS.md`. Folded into `cometchat-android-v5-calls/references/{recording,screen-sharing,picture-in-picture,background-handling,voip-calling,audio-controls,video-controls,participant-management,custom-ui,in-call-chat,call-logs,session-settings,event-listeners,join-session,ringing-integration,setup}.md`.
- **iOS V5:** `~/Downloads/calls-sdk/calls-sdk-ios-5/sample-apps/` — sample-app code as ground truth (no pre-authored skill pack).
- **JavaScript (web):** `~/Downloads/calls-sdk/calls-sdk-javascript-5/sample-apps/` — sample-app code as ground truth.
- **React Native:** `~/Downloads/calls-sdk/calls-sdk-react-native-5/sample-apps/` — sample-app code as ground truth.
- **Flutter:** `~/Downloads/calls-sdk/calls-sdk-flutter-5/sample-apps/` + existing `cometchat-flutter-v5-calls` and `cometchat-flutter-v6-calls` skills (audited against the SDK).
- **Angular:** Same JS Calls SDK (`@cometchat/calls-sdk-javascript`) wrapped in Angular Inputs/Outputs. Sample-app code from `~/Downloads/calls-sdk/calls-sdk-javascript-5/` plus existing `cometchat-angular-features` calls section.

## Three calling modes — pick the right one (Tier 1.8 + 1.9)

CometChat supports three distinct calling workflows. Route the user to the matching per-family reference:

| Mode | Driver | When to use | Per-family ref |
|---|---|---|---|
| **Standard** | UI Kit (`CometChatCallButtons` + `CometChatIncomingCall`) | 80% case — chat-driven calls with prebuilt UI | covered in per-family `SKILL.md` |
| **Ringing** | Chat SDK call entity + Calls SDK session | Custom incoming/outgoing call UI on top of CometChat signaling | `references/ringing-integration.md` |
| **Call Session** | Calls SDK `joinSession` directly (no ringing) | Meeting-room URLs, scheduled calls, conference rooms | `references/call-session.md` |

Standard is the default unless the user explicitly says "custom incoming call UI" (→ Ringing) or "meeting link / join with sessionId" (→ Call Session). The Tier 4 use-cases telegraph which mode they want — broadcast + team huddles use Call Session; telehealth + marketplace + support use Standard or Ringing.

## Use-case integration patterns (Tier 4)

If the user describes their product clearly, route to the matching use-case reference for opinionated CallSettings + UX + compliance callouts:

- **Telehealth / virtual visits** → `references/use-case-telehealth.md` — provider/patient flow, two-party consent recording, waiting room, HIPAA notes
- **Marketplace (buyer ↔ seller)** → `references/use-case-marketplace.md` — opaque UIDs, time-bounded access, anti-fraud heuristics
- **Customer support / help desk** → `references/use-case-support.md` — agent queue, auto-record for QA, post-call CSAT
- **Broadcast / webinar / town hall** → `references/use-case-broadcast.md` — locked SIDEBAR, mute-by-default attendees, raise-hand Q&A, RTMP bridge for 100+
- **Team huddle / standup / collab** → `references/use-case-team.md` — TILE layout, opt-in join, recording auto-posted to channel

Each use-case doc covers end-to-end flow + recommended `CallSettings` + role-based UI + verification checklist. Apply on top of the per-family `-calls` skill, don't duplicate the architecture work.

## Migration playbooks

For customers upgrading or layering calls on top of an existing chat install, every per-family calls skill ships:

- `references/migration-v4-to-v5.md` — Calls SDK v4 → v5 (drop-in replacement; v5 APIs unlock granular event listeners + simpler init)
- `references/add-calls-to-existing-chat.md` — additive integration on top of an existing chat surface (init order, login order, IncomingCall mounting, server push setup)

Cite the right family. The web reference (`cometchat-react-calls`) is canonical for migration-v4-to-v5 — sister docs in other families add only family-specific deltas.

## Server-side push templates (Tier 3)

VoIP push wiring is platform-specific. Three canonical templates ship under per-family `references/`:

- iOS APNs PushKit (.p8 token auth) — `cometchat-ios-calls/references/server-apns-pushkit.md`
- Android FCM HTTP v1 (data-only, priority HIGH) — `cometchat-android-v5-calls/references/server-fcm-voip.md` (V6 sister with Compose IncomingCallActivity)
- Web Push VAPID (best-effort browser ringing) — `cometchat-react-calls/references/server-web-push-vapid.md` (Angular sister)

Hybrid platforms (RN, Flutter) ship `references/server-push-bridge.md` that routes to the right canonical by `Platform.OS` / `Platform.is{iOS,Android}`.

## What this dispatcher does NOT cover

- **The actual code.** Per-family `-calls` skills write the integration. This dispatcher routes.
- **AI-Agent or BYO-Agent flows.** Different surface entirely; out of scope. The top-level `cometchat` dispatcher's Step 3.0 routes those to docs.
- **Moderation features for calls** (recording-with-consent prompts, profanity filter on in-call chat, etc.). Same status as the chat dispatcher — moderation is dashboard-only.
- **Call analytics dashboards** — the CometChat dashboard surfaces these, no integration work needed.

## Pointer back to chat dispatcher

If the user invoked `/cometchat-calls` directly but the project has no integration at all yet (no `.cometchat/config.json`, no chat surfaces), and they pick the **additive** mode by mistake, redirect:

> "Looks like you don't have CometChat integrated yet. For a calling-first app, that's fine — I'll run the standalone calls flow now. If you want chat alongside, run `/cometchat` first to set up chat, then come back to add calls."

Don't auto-route to `cometchat/SKILL.md` from here — it's the user's call (no pun intended) which surface is primary.
