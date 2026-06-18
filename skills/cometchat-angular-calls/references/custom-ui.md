# Custom call UI in Angular

Same architecture as React + RN custom UI; Angular-specific because of NgZone, ContentChild, and ng-template.

---

## Two paths

1. **Style the kit's selectors** — pass Angular `[input]` props + content projection (`<ng-content select="...">`). Cheapest.
2. **Build your own component on the SDK** with your own `<video>` elements wrapped in Angular components. ⚠️ Two join APIs by settings type: **hybrid (hide-chrome)** → `SessionSettings` object + `joinSession`; **fully-custom (`enableDefaultLayout(false)`, own tiles)** → `CallSettingsBuilder` + the deprecated `startSession` (joinSession does NOT accept builder output). This reference shows the fully-custom path.

This reference covers path 2.

---

## Component skeleton

```ts
// ongoing-call.component.ts
import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

@Component({
  selector: "app-ongoing-call",
  template: `
    <div class="call-container">
      <video #remoteVideo autoplay playsinline class="remote-tile"></video>
      <video #localVideo autoplay playsinline muted class="local-tile"></video>
      <app-control-panel
        [muted]="muted"
        [cameraOff]="cameraOff"
        (toggleMute)="onToggleMute()"
        (toggleCamera)="onToggleCamera()"
        (switchCamera)="onSwitchCamera()"
        (end)="onEnd()"
      ></app-control-panel>
    </div>
  `,
  styles: [`
    .call-container { position: fixed; inset: 0; background: #000; }
    .remote-tile { width: 100%; height: 100%; object-fit: cover; }
    .local-tile { position: absolute; top: 60px; right: 20px; width: 120px; height: 160px; border-radius: 8px; }
  `],
})
export class OngoingCallComponent implements OnInit, OnDestroy {
  @ViewChild("localVideo") localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild("remoteVideo") remoteVideoRef!: ElementRef<HTMLVideoElement>;

  muted = false;
  cameraOff = false;

  private listener: unknown;

  constructor(private zone: NgZone) {}

  async ngOnInit() {
    // ⚠️ CometChatCalls.OngoingCallListener is @deprecated (use addEventListener).
    // It's only here because enableDefaultLayout(false) + startSession require it.
    this.listener = new CometChatCalls.OngoingCallListener({
      onUserListUpdated: (users: unknown) => {
        this.zone.run(() => { /* update roster */ });
      },
      onCallEnded: () => {
        this.zone.run(() => this.cleanup());
      },
      onCallEndButtonPressed: () => CometChatCalls.leaveSession(),
      onError: (err: unknown) => {
        this.zone.run(() => console.error("Call error:", err));
      },
    });

    // CallSettingsBuilder method names (verified vs calls-sdk-javascript@5):
    //   - NO .setSessionID() on the builder — sessionId flows via generateToken()
    //   - .setIsAudioOnlyCall(bool), not .setIsAudioOnly()
    //   - .setCallListener(listener), not .setCallEventListener()
    const settings = new CometChatCalls.CallSettingsBuilder()
      .setIsAudioOnlyCall(false)
      .enableDefaultLayout(false)
      .setCallListener(this.listener)
      .build();

    // generateToken takes ONLY sessionId. Auth is internal after CometChatCalls.login().
    const tokenRes = await CometChatCalls.generateToken(this.sessionId);
    // This fully-custom path uses enableDefaultLayout(false), which builds a CallSettings —
    // consumed ONLY by the deprecated startSession. joinSession takes a SessionSettings
    // OBJECT and will NOT accept CallSettingsBuilder output. startSession is the one place
    // the deprecated call is still required (enableDefaultLayout is builder-only).
    CometChatCalls.startSession(tokenRes.token, settings, this.callContainerRef.nativeElement);
  }

  ngOnDestroy() {
    this.cleanup();
  }

  onToggleMute() {
    this.muted = !this.muted;
    // No-arg methods — muteAudio(bool) ignores the arg. Use the explicit pair.
    this.muted ? CometChatCalls.muteAudio() : CometChatCalls.unmuteAudio();
  }

  onToggleCamera() {
    this.cameraOff = !this.cameraOff;
    this.cameraOff ? CometChatCalls.pauseVideo() : CometChatCalls.resumeVideo();
  }

  onSwitchCamera() {
    CometChatCalls.switchCamera();
  }

  onEnd() {
    CometChatCalls.leaveSession();
    this.cleanup();
  }

  private cleanup() {
    CometChatCalls.leaveSession();
    if (this.localVideoRef?.nativeElement) this.localVideoRef.nativeElement.srcObject = null;
    if (this.remoteVideoRef?.nativeElement) this.remoteVideoRef.nativeElement.srcObject = null;
  }

  // Inputs
  sessionId!: string;       // bind from route param or parent
}
```

NgZone.run wraps every SDK callback that mutates `this.*` (rule from `references/ngzone-and-async-callbacks.md`).

---

## Control panel as a child component

```ts
// control-panel.component.ts
import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
  selector: "app-control-panel",
  template: `
    <div class="row">
      <button (click)="toggleMute.emit()">{{ muted ? "Unmute" : "Mute" }}</button>
      <button (click)="toggleCamera.emit()">{{ cameraOff ? "Cam on" : "Cam off" }}</button>
      <button (click)="switchCamera.emit()">Flip</button>
      <button (click)="end.emit()" class="end">End</button>
    </div>
  `,
  styles: [`
    .row { position: absolute; bottom: 40px; left: 0; right: 0; display: flex; justify-content: space-around; }
    button { padding: 16px; border-radius: 32px; }
    .end { background: red; color: white; }
  `],
})
export class ControlPanelComponent {
  @Input() muted = false;
  @Input() cameraOff = false;
  @Output() toggleMute = new EventEmitter<void>();
  @Output() toggleCamera = new EventEmitter<void>();
  @Output() switchCamera = new EventEmitter<void>();
  @Output() end = new EventEmitter<void>();
}
```

---

## Local preview before the call connects

```ts
async ngOnInit() {
  // ... listener setup ...

  // Preview stream
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.localStream = stream;
    if (this.localVideoRef.nativeElement) {
      this.localVideoRef.nativeElement.srcObject = stream;
    }
  } catch (err) {
    if ((err as Error).name === "NotAllowedError") {
      this.zone.run(() => this.errorMessage = "Camera/mic permission denied");
    }
  }

  // Then start session — SDK takes over
  // ...
}

ngOnDestroy() {
  this.localStream?.getTracks().forEach(t => t.stop());   // CRITICAL — release tracks
  this.cleanup();
}
```

---

## Lazy loading custom call modules

If your project lazy-loads the calls feature (a `CallsModule` lazy-loaded at `/calls`), there's a gotcha:

The `cometchat-angular-core` skill says `APP_INITIALIZER` must run at bootstrap, before lazy-loaded routes. If your `CallInitService` is provided in `CallsModule` (lazy), `APP_INITIALIZER` can't depend on it — Angular hasn't loaded the module yet.

**Fix:** provide `CallInitService` in `AppModule` (eager), even if call components live in a lazy module. The service runs at boot; the components load on demand. This is documented further in `references/lazy-loading-pitfalls.md`.

---

## Route guard for active calls

If the user navigates away from the ongoing-call component mid-call, the call should end:

```ts
// can-deactivate.guard.ts
import { Injectable } from "@angular/core";
import { CanDeactivate } from "@angular/router";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";
import { OngoingCallComponent } from "./ongoing-call.component";

@Injectable({ providedIn: "root" })
export class CallDeactivateGuard implements CanDeactivate<OngoingCallComponent> {
  canDeactivate(component: OngoingCallComponent): boolean {
    if (!component.callActive) return true;
    const confirmed = window.confirm("End the active call?");
    if (confirmed) {
      CometChatCalls.leaveSession();
    }
    return confirmed;
  }
}
```

Register on the route:

```ts
{ path: "calls/ongoing/:id", component: OngoingCallComponent, canDeactivate: [CallDeactivateGuard] }
```

---

## When NOT to go custom in Angular

Same as React/RN — kit defaults cover 80%+. NgZone wrangling is real overhead; prefer styling props on `<cometchat-ongoing-call>` first. Custom is for design-system requirements that the kit's CSS variable overrides can't reach.
