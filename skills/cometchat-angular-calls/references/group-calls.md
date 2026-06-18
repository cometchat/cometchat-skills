# Group calls (meetings) on Angular

Angular wraps the same JS Calls SDK as React/Vue/Svelte; the SDK semantics are identical. The wiring differences are Angular-specific: NgZone for dominant-speaker updates, `@Input` / `@Output` patterns for participant components, OnPush + `markForCheck` for roster changes.

> **v5 event note.** `CometChatCalls.OngoingCallListener` is `@deprecated` in calls-sdk-javascript v5 (use `CometChatCalls.addEventListener(...)`). It still works for roster events (`onUserJoined` / `onUserLeft` / `onUserListUpdated` / `onCallEnded` / `onError`), but there is **no `onActiveSpeakerUpdated` callback on the listener** — the dominant-speaker signal is only available as the `addEventListener` event key `onDominantSpeakerChanged`. The examples below use `addEventListener` for dominant speaker and may keep the listener for roster events.

For SDK-level semantics — capacity limits, bandwidth scaling, moderator actions — see `cometchat-native-calls/references/group-calls.md`. This reference covers the Angular-specific patterns.

---

## Signaling architecture — meeting-message broadcast, NOT call ringing

**Critical to read first.** Group calls do NOT use the Ringing channel (`CometChat.initiateCall` → `onIncomingCallReceived`). That channel is **1:1 user calls only**. The kit broadcasts a **custom message of type `"meeting"`** to the group; receivers see a "Join meeting" card in their `<cometchat-message-list />` (kit Angular components) or need an explicit `MessageListener.onCustomMessageReceived` (custom UI — the common Angular path since many Angular apps build custom call surfaces).

Confirmed 2026-05-15 by direct test: Pixel 3 (kit-based RN, group call initiated) → Angular custom-UI app at `localhost:4200` (uid-5 in same group) → Angular received NOTHING because it only registered `CometChat.addCallListener`. Adding `CometChat.addMessageListener` filtering for `category === CATEGORY_CUSTOM && type === 'meeting'` fixed it.

```
Caller (uid-A, member of group-X)        CometChat                Receivers (members of group-X)
  │                                          │                              │
  │ kit: <cometchat-call-buttons             │                              │
  │   [group]="g">                           │                              │
  │ — OR — custom Angular code:              │                              │
  │   CometChat.sendCustomMessage(           │                              │
  │     new CometChat.CustomMessage(         │                              │
  │       guid, GROUP, "meeting",            │                              │
  │       { callType, sessionId }))          │                              │
  ├─────────────────────────────────────────>│                              │
  │                                          │ onCustomMessageReceived      │
  │                                          ├─────────────────────────────>│ (each receiver's
  │                                          │                              │  MessageListener,
  │                                          │                              │  wrapped in NgZone.run)
  │            ───── WebRTC session active (sessionId = group GUID) ─────   │
```

| Channel | 1:1 user calls | Group calls |
|---|---|---|
| Signaling API (caller) | `CometChat.initiateCall(call)` | `CometChat.sendCustomMessage(meetingMessage)` with type="meeting" |
| Receiver event | `CallListener.onIncomingCallReceived` | `MessageListener.onCustomMessageReceived` (category=CATEGORY_CUSTOM + type="meeting") |
| Session ID | server-generated unique per call | the group's GUID (persistent) |
| Ring/decline semantics | yes — `CometChat.acceptCall` / `rejectCall` | no — receivers join or ignore |
| Auto-cancel timeout | yes (45s default) | no — meeting persists in chat history |

### Receiver — custom Angular UI: `CallStateService` extension

The canonical pattern in `cometchat-angular-calls/SKILL.md` puts call state in a `CallStateService`. Extend it with a `MessageListener` for group meetings:

```ts
// services/call-state.service.ts (extension)
import { Injectable, NgZone, inject, signal } from '@angular/core';
import { CometChat } from '@cometchat/chat-sdk-javascript';

const GROUP_MEETING_LISTENER_ID = 'app-root-group-meeting-listener';

@Injectable({ providedIn: 'root' })
export class CallStateService {
  private readonly zone = inject(NgZone);

  // existing signals: phase, statusMessage, errorMessage, incoming, ...
  readonly incomingMeeting = signal<{
    sessionId: string;
    callType: 'audio' | 'video';
    fromUid: string;
    groupGuid: string;
  } | null>(null);

  start(): void {
    // existing CometChat.addCallListener (1:1 user calls)
    // ...

    // NEW — addMessageListener for group meetings:
    CometChat.addMessageListener(
      GROUP_MEETING_LISTENER_ID,
      new CometChat.MessageListener({
        onCustomMessageReceived: (msg: any) => {
          if (msg.getCategory?.() !== CometChat.CATEGORY_CUSTOM) return;
          if (msg.getType?.() !== 'meeting') return;
          const customData = msg.getCustomData?.() ?? {};
          this.zone.run(() => {
            this.incomingMeeting.set({
              sessionId: customData.sessionId ?? msg.getReceiverId(),
              callType: customData.callType ?? 'video',
              fromUid: msg.getSender().getUid(),
              groupGuid: msg.getReceiverId(),
            });
          });
        },
      }),
    );
  }
}
```

Then in your root template (next to where the 1:1 incoming-call overlay lives):

```html
@if (state.incomingMeeting(); as meeting) {
  <app-incoming-meeting-overlay
    [meeting]="meeting"
    (joined)="state.acceptMeeting(meeting.sessionId, meeting.callType)"
    (dismissed)="state.incomingMeeting.set(null)"
  />
}
```

### Why this matters specifically for Angular

Angular apps disproportionately build custom call UI (raw SDK + their own component templates) rather than dropping in `<cometchat-call-buttons>` / `<cometchat-incoming-call>` selectors. The Angular UI Kit is less prevalent than React's UI Kit. So **most Angular customers hit this gap** if they only follow the 1:1 ringing-integration guidance.

The two listeners (`addCallListener` for user channel + `addMessageListener` for meeting channel) MUST coexist in any Angular app that supports both 1:1 and group calling. Wire both in `CallStateService.start()` and tear both down in `ngOnDestroy` / hangup.

---

## Initiating a group call

```ts
// services/group-call.service.ts
import { Injectable } from "@angular/core";
import { CometChat } from "@cometchat/chat-sdk-javascript";

@Injectable({ providedIn: "root" })
export class GroupCallService {
  async initiate(guid: string, callType: "voice" | "video"): Promise<unknown> {
    const group = await CometChat.getGroup(guid);
    const cometchatType = callType === "video"
      ? CometChat.CALL_TYPE.VIDEO
      : CometChat.CALL_TYPE.AUDIO;
    const call = new CometChat.Call(group.getGuid(), cometchatType, CometChat.RECEIVER_TYPE.GROUP);
    return CometChat.initiateCall(call);
  }
}
```

The receiver is the GROUP (`RECEIVER_TYPE.GROUP`) — anyone in the group can `acceptCall` until the call ends.

---

## Roster + active-speaker — NgZone-aware

The SDK's `OngoingCallListener` callbacks fire outside Angular's zone. Wrap with `NgZone.run` (general rule from `references/ngzone-and-async-callbacks.md`):

```ts
@Component({
  selector: "app-group-call",
  template: `
    <div class="spotlight">
      <app-participant-tile *ngIf="activeSpeaker" [participant]="activeSpeaker" [size]="'large'"></app-participant-tile>
    </div>
    <div class="strip">
      <app-participant-tile
        *ngFor="let p of others; trackBy: trackByUid"
        [participant]="p"
        [size]="'small'">
      </app-participant-tile>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupCallComponent implements OnInit, OnDestroy {
  participants: Participant[] = [];
  activeSpeaker: Participant | null = null;
  others: Participant[] = [];

  constructor(private zone: NgZone, private cd: ChangeDetectorRef) {}

  private offSpeaker?: () => void;

  ngOnInit() {
    // Roster via the (deprecated but functional) OngoingCallListener:
    const listener = new CometChatCalls.OngoingCallListener({
      onUserListUpdated: (users: Participant[]) => {
        this.zone.run(() => {
          this.participants = users;
          this.recomputeLayout();
          this.cd.markForCheck();        // OnPush — must mark
        });
      },
    });

    // Dominant speaker is NOT a listener callback — subscribe via addEventListener.
    // addEventListener returns an unsubscribe fn (there is no removeEventListener).
    this.offSpeaker = CometChatCalls.addEventListener(
      "onDominantSpeakerChanged",
      (participant: { uid: string }) => {
        this.zone.run(() => {
          // Debounce — see "Debouncing dominant-speaker" below
          this.scheduleSpeakerSwap(participant.uid);
        });
      },
    );
    // ... pass a SessionSettings object + call token to CometChatCalls.joinSession ...
  }

  ngOnDestroy() {
    this.offSpeaker?.();
  }

  trackByUid(_: number, p: Participant) {
    return p.uid;
  }

  private recomputeLayout() {
    const localUid = this.getLocalUid();
    const remote = this.participants.filter(p => p.uid !== localUid);
    this.activeSpeaker = remote.find(p => p.uid === this.activeSpeakerUid) ?? remote[0] ?? null;
    this.others = remote.filter(p => p.uid !== this.activeSpeaker?.uid);
  }

  private speakerSwapTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeSpeakerUid: string | null = null;
  private scheduleSpeakerSwap(uid: string) {
    if (this.speakerSwapTimeout) clearTimeout(this.speakerSwapTimeout);
    this.speakerSwapTimeout = setTimeout(() => {
      this.zone.run(() => {
        this.activeSpeakerUid = uid;
        this.recomputeLayout();
        this.cd.markForCheck();
      });
    }, 500);
  }
}
```

`trackByUid` is critical — without it, every roster update re-creates every tile, which destroys the WebRTC video track each time. The roster jitters and call quality degrades.

---

## Debouncing dominant-speaker

Same rule as RN — `onDominantSpeakerChanged` can fire many times per second in a noisy call. Debounce to 500ms minimum:

```ts
private speakerSwapTimeout: ReturnType<typeof setTimeout> | null = null;

scheduleSpeakerSwap(uid: string) {
  if (this.speakerSwapTimeout) clearTimeout(this.speakerSwapTimeout);
  this.speakerSwapTimeout = setTimeout(() => {
    this.zone.run(() => {
      this.activeSpeakerUid = uid;
      this.recomputeLayout();
      this.cd.markForCheck();
    });
  }, 500);
}
```

Or use RxJS:

```ts
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";

private speakerSubject = new Subject<string>();

ngOnInit() {
  this.speakerSubject.pipe(debounceTime(500)).subscribe((uid) => {
    this.zone.run(() => { this.activeSpeakerUid = uid; this.recomputeLayout(); this.cd.markForCheck(); });
  });

  // Dominant speaker comes from addEventListener, not the listener object:
  this.offSpeaker = CometChatCalls.addEventListener(
    "onDominantSpeakerChanged",
    (participant: { uid: string }) => this.speakerSubject.next(participant.uid),
  );
}
```

---

## Moderator actions — guarded by group scope

The v5 SDK exposes **`CometChatCalls.muteParticipant(participantId)`** (sync, void) — there is
no `muteUser` / `removeUser`. **There is NO kick/remove-participant API in the JS Calls SDK** —
removal must be done at the chat layer (e.g. `CometChat.kickGroupMember`), not via the Calls SDK.

```ts
// In your component or a CallControlsService
muteParticipant(participantId: string) {
  if (!this.canModerate()) return;
  CometChatCalls.muteParticipant(participantId);   // sync, void — no await
}

muteAll() {
  if (!this.canModerate()) return;
  for (const p of this.others) {
    CometChatCalls.muteParticipant(p.uid);
  }
}

// NOTE: no kick/remove API exists in @cometchat/calls-sdk-javascript.
// To eject someone, remove them from the group via the Chat SDK
// (CometChat.kickGroupMember(...)) — they then lose access to the session.

private canModerate(): boolean {
  const scope = this.group?.getScope();
  return scope === "admin" || scope === "moderator";
}
```

Hide the moderator-only buttons in the template:

```html
<div *ngIf="canModerate()" class="moderator-controls">
  <button (click)="muteAll()">Mute all</button>
  <button (click)="muteParticipant(p.uid)" *ngFor="let p of others">Mute</button>
</div>
```

---

## Capacity-error handling

```ts
const listener = new CometChatCalls.OngoingCallListener({
  onError: (error: { code: string; message: string }) => {
    this.zone.run(() => {
      if (error.code === "ERR_CALL_FULL") {
        this.snackBar.open("This meeting is full.", "Dismiss", { duration: 5000 });
      } else if (error.code === "ERR_NOT_GROUP_MEMBER") {
        this.snackBar.open("You're not a member of this group.", "Dismiss", { duration: 5000 });
      } else {
        this.snackBar.open(`Call error: ${error.message}`, "Dismiss", { duration: 5000 });
      }
    });
  },
});
```

Material's `MatSnackBar` is the canonical Angular surface for transient errors — pick whatever the project uses.

---

## Bandwidth + battery — auto-downgrade to audio-only

Angular doesn't have a first-party battery API, but `BatteryManager` works in browsers (deprecated but functional in Chrome/Edge):

```ts
async observeBattery() {
  if ("getBattery" in navigator) {
    const battery = await (navigator as unknown as { getBattery: () => Promise<{ level: number; addEventListener: (e: string, h: () => void) => void }> }).getBattery();

    const check = () => {
      if (battery.level < 0.2 && this.callActive) {
        this.zone.run(() => {
          CometChatCalls.pauseVideo();   // no-arg in v5 (pauses local video)
          this.snackBar.open("Video paused — low battery", "Dismiss", { duration: 5000 });
        });
      }
    };
    battery.addEventListener("levelchange", check);
    check();
  }
}
```

Firefox + Safari don't have `getBattery()` — gracefully skip. For mobile-web users, network-quality detection (Network Information API) is more reliable.

---

## Joining a group call already in progress

Angular `Resolver` for the group-detail route can pre-check active call state:

```ts
@Injectable({ providedIn: "root" })
export class GroupCallStateResolver implements Resolve<{ activeCall: unknown | null }> {
  async resolve(route: ActivatedRouteSnapshot): Promise<{ activeCall: unknown | null }> {
    const activeCall = await CometChat.getActiveCall();
    return {
      activeCall: activeCall && activeCall.getReceiverType() === "group"
        ? activeCall
        : null,
    };
  }
}
```

Wire on the route:

```ts
{
  path: "groups/:guid",
  component: GroupDetailComponent,
  resolve: { callState: GroupCallStateResolver },
}
```

In the component:

```ts
ngOnInit() {
  const callState = this.route.snapshot.data["callState"];
  if (callState.activeCall) {
    // Show "Join meeting" button
    this.activeCall = callState.activeCall;
  }
}
```

---

## Anti-patterns

1. **Roster updates without `trackByUid`** in `*ngFor`. Tiles re-create; video tracks die.
2. **Skipping `markForCheck`** with OnPush. Roster updates don't render.
3. **No debounce on dominant-speaker.** Tiles jitter at 5+ Hz.
4. **Moderator buttons rendered for non-moderators.** SDK rejects but UI is misleading.
   (Remember: only `muteParticipant` exists — there is no kick/remove in the Calls SDK.)
5. **`getBattery()` without feature detect.** Firefox/Safari throws.
6. **Leaving the call doesn't unsubscribe RxJS subjects.** Memory leak across multiple call sessions.
7. **Group call from a lazy-loaded module.** CallInitService must be eager (cf. `references/lazy-loading-pitfalls.md`).

---

## Verification checklist

- [ ] `*ngFor` over participants uses `trackBy: trackByUid`
- [ ] OnPush components call `cd.markForCheck()` on roster updates
- [ ] Dominant-speaker updates (via `addEventListener("onDominantSpeakerChanged", …)`) debounced ≥500ms
- [ ] All SDK callbacks wrapped in `zone.run`
- [ ] Moderator controls hidden for non-moderator scopes
- [ ] Capacity error handled (`ERR_CALL_FULL`) with user-facing snackbar
- [ ] Battery API feature-detected before use
- [ ] `Resolver` checks `getActiveCall()` on group route entry
- [ ] RxJS subscriptions cleaned up in `ngOnDestroy`

---

## Pointers

- `references/ngzone-and-async-callbacks.md` — NgZone primer
- `references/lazy-loading-pitfalls.md` — eager-load CallInitService rule
- `references/custom-ui.md` — multi-tile custom layouts
- `cometchat-native-calls/references/group-calls.md` — sister reference (same SDK, RN-flavored patterns; capacity/bandwidth/moderator actions covered there)
