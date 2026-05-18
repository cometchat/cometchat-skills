# Picture-in-Picture on Angular

Same browser APIs as React (Video PiP + Document PiP) — the SDK and underlying primitives are identical because Angular wraps the JS Calls SDK. For API-level details, browser support, and the Document PiP path, read `cometchat-react-calls/references/picture-in-picture.md` first. This reference covers Angular-specific wiring.

---

## Video PiP — Angular component pattern

```ts
// components/pip-button/pip-button.component.ts
@Component({
  selector: "app-pip-button",
  template: `
    <button (click)="togglePip()" [disabled]="!supported" *ngIf="supported">
      {{ inPip ? "Exit PiP" : "Enter PiP" }}
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipButtonComponent implements OnInit, OnDestroy {
  @Input() videoRef!: ElementRef<HTMLVideoElement>;
  inPip = false;
  supported = typeof document !== "undefined" && document.pictureInPictureEnabled;

  private enterListener?: () => void;
  private leaveListener?: () => void;

  constructor(private zone: NgZone, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    if (!this.videoRef?.nativeElement) return;
    const video = this.videoRef.nativeElement;

    this.enterListener = () => this.zone.run(() => { this.inPip = true; this.cd.markForCheck(); });
    this.leaveListener = () => this.zone.run(() => { this.inPip = false; this.cd.markForCheck(); });

    video.addEventListener("enterpictureinpicture", this.enterListener);
    video.addEventListener("leavepictureinpicture", this.leaveListener);
  }

  ngOnDestroy() {
    const video = this.videoRef?.nativeElement;
    if (!video) return;
    if (this.enterListener) video.removeEventListener("enterpictureinpicture", this.enterListener);
    if (this.leaveListener) video.removeEventListener("leavepictureinpicture", this.leaveListener);
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
  }

  async togglePip() {
    if (!this.videoRef?.nativeElement) return;
    if (this.inPip) {
      await document.exitPictureInPicture();
    } else {
      try {
        await this.videoRef.nativeElement.requestPictureInPicture();
      } catch (err) {
        console.warn("PiP request failed:", err);
      }
    }
  }
}
```

The `@Input() videoRef` is the parent's `<video>` element via `@ViewChild`. NgZone wraps the events so OnPush components re-render correctly.

Usage in the call screen:

```ts
@Component({
  selector: "app-ongoing-call",
  template: `
    <video #remoteVideo autoplay playsinline [class.hidden]="inPip"></video>
    <app-pip-button [videoRef]="remoteVideo"></app-pip-button>
  `,
  styles: [`
    .hidden { visibility: hidden; }
  `],
})
export class OngoingCallComponent {
  @ViewChild("remoteVideo") remoteVideo!: ElementRef<HTMLVideoElement>;
  inPip = false;
}
```

---

## Document PiP — Angular host element transfer

Document PiP lets you put arbitrary HTML in a floating window, including a full Angular component subtree. The challenge: detaching + re-attaching a DOM node mid-Angular-lifecycle.

```ts
// services/document-pip.service.ts
import { Injectable, NgZone, RendererFactory2, Renderer2 } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DocumentPipService {
  private pipWindow: Window | null = null;
  private renderer: Renderer2;

  constructor(private zone: NgZone, private rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  get supported(): boolean {
    return typeof window !== "undefined" && "documentPictureInPicture" in window;
  }

  async openWindow(content: HTMLElement, options: { width?: number; height?: number } = {}): Promise<Window | null> {
    if (!this.supported) return null;

    this.pipWindow = await (window as unknown as {
      documentPictureInPicture: { requestWindow: (o: object) => Promise<Window> };
    }).documentPictureInPicture.requestWindow({
      width: options.width ?? 360,
      height: options.height ?? 480,
    });

    // Copy stylesheets so kit + Angular Material styles work in the PiP window
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const cssText = Array.from(sheet.cssRules ?? []).map(r => r.cssText).join("\n");
        const style = this.pipWindow.document.createElement("style");
        style.textContent = cssText;
        this.pipWindow.document.head.appendChild(style);
      } catch {
        if (sheet.href) {
          const link = this.pipWindow.document.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href;
          this.pipWindow.document.head.appendChild(link);
        }
      }
    }

    this.pipWindow.document.body.appendChild(content);

    return this.pipWindow;
  }

  closeWindow() {
    if (this.pipWindow) {
      this.pipWindow.close();
      this.pipWindow = null;
    }
  }
}
```

Then in the call component:

```ts
@Component({
  // ...
  template: `
    <div #callRoot class="call-root">
      <video #remoteVideo autoplay playsinline></video>
      <app-control-panel></app-control-panel>
    </div>
  `,
})
export class OngoingCallComponent {
  @ViewChild("callRoot", { static: true }) callRoot!: ElementRef<HTMLElement>;

  constructor(private docPip: DocumentPipService, private zone: NgZone) {}

  async enterDocumentPip() {
    const pipWin = await this.docPip.openWindow(this.callRoot.nativeElement);
    if (!pipWin) return;

    pipWin.addEventListener("pagehide", () => {
      this.zone.run(() => {
        // Restore the call-root back to the original mount point
        const host = document.getElementById("call-host");
        if (host && this.callRoot.nativeElement) {
          host.appendChild(this.callRoot.nativeElement);
        }
      });
    });
  }
}
```

When you transfer the DOM node into the PiP window, Angular's change detection still works because the node is the same. Click handlers, OnPush updates, NgZone events all continue functioning across the window boundary. This is the magic of Document PiP.

---

## Auto-PiP on tab/window backgrounding

```ts
@Component({...})
export class OngoingCallComponent implements OnInit, OnDestroy {
  private visibilitySub?: Subscription;

  ngOnInit() {
    if (!document.pictureInPictureEnabled) return;
    this.visibilitySub = fromEvent(document, "visibilitychange").subscribe(() => {
      if (document.visibilityState === "hidden" && this.callActive) {
        this.zone.run(() => {
          this.remoteVideo.nativeElement.requestPictureInPicture().catch(() => {});
        });
      }
    });
  }

  ngOnDestroy() {
    this.visibilitySub?.unsubscribe();
  }
}
```

Same caveats as React — Safari rejects auto-PiP from non-user-gesture contexts in some versions. Test on real Safari before relying on this.

---

## Auto-leave on hangup

```ts
async endCall() {
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  }
  this.docPip.closeWindow();

  CometChatCalls.leaveSession();   // v5 canonical (endSession is a deprecated shim)
  // ...rest of cleanup
}
```

---

## SSR considerations (Angular Universal)

Document and Video PiP both reference `document.pictureInPictureEnabled` and `window.documentPictureInPicture`. Both are browser-only — guard:

```ts
import { isPlatformBrowser } from "@angular/common";

constructor(@Inject(PLATFORM_ID) private platformId: object) {}

get supported() {
  return isPlatformBrowser(this.platformId)
    && typeof document !== "undefined"
    && document.pictureInPictureEnabled;
}
```

Without this, SSR build crashes at boot.

---

## Anti-patterns

1. **`requestPictureInPicture()` from `ngOnInit`.** Browsers reject — needs user gesture. `(click)` is the trigger.
2. **Skipping `NgZone.run`** for PiP enter/leave events. OnPush components don't re-render.
3. **Document PiP without copying stylesheets.** PiP window unstyled.
4. **Forgetting `pagehide` cleanup** when user closes the PiP window via system X. DOM node stays detached; controls broken.
5. **No SSR guard.** Universal build crashes.
6. **Two separate video elements** (one for normal, one for PiP). Use one `<video>` and `[class.hidden]` it.
7. **Auto-PiP in `ngOnInit` with no user-gesture context.** Safari rejects.

---

## Verification checklist

- [ ] PiP button feature-detects `document.pictureInPictureEnabled`
- [ ] Button hidden / disabled when unsupported
- [ ] PiP request from `(click)`, not `ngOnInit`
- [ ] `enterpictureinpicture` / `leavepictureinpicture` listeners wrapped in NgZone
- [ ] OnPush components call `markForCheck()` after PiP state change
- [ ] In-page video hidden while PiP active
- [ ] Hangup path calls `document.exitPictureInPicture()` if active
- [ ] Document PiP path closes window via `docPip.closeWindow()`
- [ ] SSR builds: `isPlatformBrowser` guards
- [ ] Real-browser smoke: Chrome (both APIs) + Safari (Video PiP) + Firefox (Video PiP)

---

## Pointers

- `cometchat-react-calls/references/picture-in-picture.md` — sister reference (browser API details, Document PiP semantics, browser support)
- `references/custom-ui.md` — Angular custom call UI (PiP integration via @ViewChild on the video element)
- `references/lazy-loading-pitfalls.md` — eager loading + SSR guards
- `cometchat-angular-calls` SKILL.md — base hard rules
