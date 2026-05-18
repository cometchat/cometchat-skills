# Recording + screen-share on Angular

Angular wraps the same JS Calls SDK as React; SDK semantics are identical. For SDK-level details (recording flag, lifecycle events, screen-share via `getDisplayMedia`, browser support) read `cometchat-react-calls/references/recording-screen-share.md` first. This reference is the Angular-specific wiring.

---

## Recording — opt-in per session

Same `CallSettingsBuilder` flag as web:

```ts
// services/call.service.ts
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

@Injectable({ providedIn: "root" })
export class CallService {
  buildSettings(sessionId: string, opts: { recording?: boolean; isAudioOnly?: boolean }) {
    return new CometChatCalls.CallSettingsBuilder()
      .setSessionID(sessionId)
      .setIsAudioOnly(opts.isAudioOnly ?? false)
      .enableRecording(opts.recording ?? false)
      .setShowRecordingButton(opts.recording ?? false)
      .build();
  }
}
```

Toggle the recording prompt for the user via a settings input passed into your call screen component.

---

## REC indicator (compliance)

Wrap the lifecycle listener via NgZone — same rule as everywhere else in Angular calls:

```ts
@Component({
  selector: "app-rec-badge",
  template: `
    <div class="rec-badge" *ngIf="recording">
      <span class="rec-dot">●</span>
      <span class="rec-label">REC</span>
    </div>
  `,
  styles: [`
    .rec-badge { position: absolute; top: 16px; left: 16px; display: flex; align-items: center; gap: 4px;
                 background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; }
    .rec-dot { color: #ff3b30; animation: blink 1s infinite; }
    @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.4; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecBadgeComponent {
  @Input() recording = false;
}
```

In the parent component:

```ts
ngOnInit() {
  const listener = new CometChatCalls.OngoingCallListener({
    onRecordingStarted: () => {
      this.zone.run(() => { this.recording = true; this.cd.markForCheck(); });
    },
    onRecordingStopped: () => {
      this.zone.run(() => { this.recording = false; this.cd.markForCheck(); });
    },
    onRecordingFailed: (error: { message: string }) => {
      this.zone.run(() => {
        this.snackBar.open(`Recording failed: ${error.message}`, "Dismiss", { duration: 5000 });
      });
    },
  });
  // ... build settings, startSession ...
}
```

Compliance reminder: in two-party-consent jurisdictions (parts of the US, much of the EU under GDPR Art. 6/7), the REC indicator is legally required for active recording. Don't omit it.

---

## Screen sharing — Angular composition

Browser `getDisplayMedia` — same as web. Angular wraps the user-gesture-required call in a click handler:

```ts
@Component({
  selector: "app-screen-share-button",
  template: `
    <button (click)="onClick()" [disabled]="!supported" [class.active]="sharing">
      {{ sharing ? "Stop sharing" : "Share screen" }}
    </button>
    <div class="hint" *ngIf="!supported">
      Screen sharing not supported in this browser.
    </div>
  `,
})
export class ScreenShareButtonComponent {
  @Output() shareStarted = new EventEmitter<void>();
  @Output() shareEnded = new EventEmitter<void>();
  sharing = false;
  supported = typeof navigator !== "undefined" && "mediaDevices" in navigator && "getDisplayMedia" in navigator.mediaDevices;

  async onClick() {
    if (!this.supported) return;
    if (this.sharing) {
      await CometChatCalls.endScreenShare();
      this.sharing = false;
      this.shareEnded.emit();
    } else {
      try {
        await CometChatCalls.startScreenShare();
        this.sharing = true;
        this.shareStarted.emit();
      } catch (err) {
        if ((err as Error).name === "NotAllowedError") return;     // user canceled
        console.warn("Screen share failed:", err);
      }
    }
  }
}
```

The `(click)` handler is in response to a real user gesture — browsers accept the `getDisplayMedia` permission request.

---

## Screen-share viewer composition

When another participant shares, render their screen track in a dedicated tile:

```ts
@Component({
  selector: "app-screen-share-view",
  template: `
    <div class="screen-share-tile">
      <video #screenVideo autoplay playsinline></video>
      <div class="presenter-badge">{{ presenterName }} is sharing their screen</div>
    </div>
  `,
})
export class ScreenShareViewComponent implements AfterViewInit {
  @Input() stream!: MediaStream;
  @Input() presenterName = "Someone";
  @ViewChild("screenVideo") videoRef!: ElementRef<HTMLVideoElement>;

  ngAfterViewInit() {
    if (this.videoRef?.nativeElement && this.stream) {
      this.videoRef.nativeElement.srcObject = this.stream;
    }
  }
}
```

Listen for screen-share events at the parent component level and pass the stream down:

```ts
ngOnInit() {
  const listener = new CometChatCalls.OngoingCallListener({
    onScreenShareStarted: (presenterUid: string, stream: MediaStream) => {
      this.zone.run(() => {
        this.screenSharePresenterUid = presenterUid;
        this.screenShareStream = stream;
        this.cd.markForCheck();
      });
    },
    onScreenShareEnded: () => {
      this.zone.run(() => {
        this.screenSharePresenterUid = null;
        this.screenShareStream = null;
        this.cd.markForCheck();
      });
    },
  });
}
```

---

## Layout switch — main view vs screen share

When someone shares, the main view should switch from "participant grid" to "screen share + thumbnails":

```html
<ng-container *ngIf="screenShareStream; else gridView">
  <app-screen-share-view [stream]="screenShareStream" [presenterName]="presenterName"></app-screen-share-view>
  <div class="thumbnail-strip">
    <app-participant-tile *ngFor="let p of participants; trackBy: trackByUid" [participant]="p" size="small"></app-participant-tile>
  </div>
</ng-container>

<ng-template #gridView>
  <div class="participant-grid">
    <app-participant-tile *ngFor="let p of participants; trackBy: trackByUid" [participant]="p" size="medium"></app-participant-tile>
  </div>
</ng-template>
```

Cleanly transitions via Angular's structural directive. No animation by default — add `@angular/animations` if you want a smooth swap.

---

## Recording download — server-side only

Same as web/RN — recordings live on CometChat's servers. To list/retrieve programmatically, use the dashboard REST API from your own backend (NEVER from Angular client code; the dashboard bearer token must not ship to clients).

Server-side proxy pattern:

```ts
// Your backend (Node + Express)
app.get("/api/recordings", requireAuth, async (req, res) => {
  const recordings = await fetch(
    `https://${region}.api-management.cometchat.io/v3/apps/${appId}/recordings`,
    { headers: { Authorization: `Bearer ${process.env.DASHBOARD_BEARER}` } },
  ).then(r => r.json());
  res.json(recordings);
});
```

Then the Angular service hits your own backend:

```ts
@Injectable({ providedIn: "root" })
export class RecordingsService {
  constructor(private http: HttpClient) {}
  list() {
    return this.http.get<Recording[]>("/api/recordings");
  }
}
```

The skill scaffolds this proxy layer for projects with a backend; for serverless-only projects, points users at the dashboard UI for recording retrieval.

---

## Anti-patterns

1. **Calling `startScreenShare()` from a non-click handler.** Browsers reject — must be in a user-gesture stack. `(click)` works; `ngOnInit` doesn't.
2. **No NgZone wrap on `onRecordingStarted` / `onScreenShareStarted`.** UI doesn't update.
3. **Hardcoding the dashboard bearer token in `environment.ts`** to fetch recordings. Wrong — bearer is server-only. Always proxy.
4. **No "REC" indicator.** Compliance violation.
5. **Re-render thumbnails on every roster update** without `trackBy`. Tiles flicker; tracks die.
6. **`getDisplayMedia` polyfilled with screen-recording-extension stubs** in old browsers. Don't — feature detect and disable the button instead.

---

## Verification checklist

- [ ] `enableRecording(true)` opt-in via parent input (not always-on)
- [ ] REC indicator visible to all participants when active
- [ ] Recording lifecycle handlers wrapped in `NgZone.run` + `cd.markForCheck()`
- [ ] Screen-share button feature-detects `getDisplayMedia`
- [ ] Screen-share button triggered from `(click)`, not `ngOnInit`
- [ ] `onScreenShareStarted` / `onScreenShareEnded` wrapped in NgZone
- [ ] Layout swap renders screen-share view + thumbnail strip
- [ ] `trackBy` on `*ngFor` for participant tiles
- [ ] Recordings retrieved via server-side proxy, NOT direct dashboard API call from Angular

---

## Pointers

- `cometchat-react-calls/references/recording-screen-share.md` — sister reference (SDK details + browser semantics)
- `references/ngzone-and-async-callbacks.md` — NgZone wrapping rules
- `references/group-calls.md` — group calls + screen share interplay
- `cometchat-angular-calls` SKILL.md — base hard rules
