# Device management on Angular

Same JS SDK as web. Angular wraps device-list state in a service with RxJS observables.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/device-management
**Read first:** `cometchat-react-calls/references/device-management.md` — pre-call picker + empty-label gotcha.

---

## Service-driven device lists

```ts
import { Injectable, NgZone, OnDestroy } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

// SDK returns standard DOM MediaDeviceInfo objects — use `.deviceId`, NOT `.id`.

@Injectable({ providedIn: "root" })
export class CallDevicesService implements OnDestroy {
  readonly mics$ = new BehaviorSubject<MediaDeviceInfo[]>([]);
  readonly cameras$ = new BehaviorSubject<MediaDeviceInfo[]>([]);
  readonly speakers$ = new BehaviorSubject<MediaDeviceInfo[]>([]);

  // addEventListener returns an unsubscribe fn — there is NO CometChatCalls.removeEventListener.
  private offs: Array<() => void> = [];

  constructor(private zone: NgZone) {
    // Valid device-change event keys (plural = full updated list):
    this.offs.push(
      CometChatCalls.addEventListener("onAudioInputDevicesChanged", () => {
        this.zone.run(() => this.refresh());
      }),
      CometChatCalls.addEventListener("onAudioOutputDevicesChanged", () => {
        this.zone.run(() => this.refresh());
      }),
      CometChatCalls.addEventListener("onVideoInputDevicesChanged", () => {
        this.zone.run(() => this.refresh());
      }),
    );
  }

  async ensurePermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(t => t.stop());      // immediately release; we just wanted permission
    } catch {
      // permission denied
    }
  }

  // Device getters are SYNCHRONOUS — they return arrays, not Promises. No await / Promise.all.
  refresh(): void {
    this.mics$.next(CometChatCalls.getAudioInputDevices());
    this.cameras$.next(CometChatCalls.getVideoInputDevices());
    this.speakers$.next(CometChatCalls.getAudioOutputDevices());
  }

  // Setters are SYNCHRONOUS void — no await. They take the deviceId string.
  selectMic(deviceId: string): void {
    CometChatCalls.setAudioInputDevice(deviceId);
  }
  selectCamera(deviceId: string): void {
    CometChatCalls.setVideoInputDevice(deviceId);
  }
  selectSpeaker(deviceId: string): void {
    CometChatCalls.setAudioOutputDevice(deviceId);
  }

  ngOnDestroy(): void {
    this.offs.forEach(off => off());   // call the captured unsubscribe fns
    this.offs = [];
  }
}
```

---

## Picker component

```ts
@Component({
  selector: "app-device-picker",
  template: `
    <form (ngSubmit)="confirm()">
      <label>Microphone
        <select [(ngModel)]="selectedMic" name="mic">
          <option *ngFor="let d of mics$ | async" [value]="d.deviceId">
            {{ d.label || ('Mic ' + d.deviceId.substring(0, 6)) }}
          </option>
        </select>
      </label>
      <!-- camera + speaker selects same pattern -->
      <button type="submit">Join call</button>
    </form>
  `,
})
export class DevicePickerComponent implements OnInit {
  mics$ = this.devices.mics$;
  cameras$ = this.devices.cameras$;
  speakers$ = this.devices.speakers$;
  selectedMic = "";
  selectedCamera = "";
  selectedSpeaker = "";

  constructor(private devices: CallDevicesService) {}

  async ngOnInit() {
    await this.devices.ensurePermission();   // getUserMedia IS async
    this.devices.refresh();                  // device list reads are sync
  }

  confirm() {
    if (this.selectedMic) this.devices.selectMic(this.selectedMic);
    if (this.selectedCamera) this.devices.selectCamera(this.selectedCamera);
    if (this.selectedSpeaker) this.devices.selectSpeaker(this.selectedSpeaker);
  }
}
```

---

## Anti-patterns

Web sister rules apply, plus Angular-specific:

1. **No `NgZone.run` wrap on the device-change events.** BehaviorSubject emits but UI doesn't update with OnPush.
2. **Service NOT provided in `root`.** Lazy-loaded → device events miss.
3. **`async pipe` not used.** Manual `subscribe` without `unsubscribe` leaks.
4. **`await`-ing the device getters/setters.** They are synchronous (`getAudioInputDevices()` returns `MediaDeviceInfo[]`; setters return `void`). `await` on them is a no-op that masks the real (sync) signature.
5. **Reading `device.id`.** The SDK returns DOM `MediaDeviceInfo` — the identifier is `device.deviceId`.
6. **Expecting `CometChatCalls.removeEventListener`.** It does not exist. `addEventListener` returns a `() => void`; capture and call it to clean up.

---

## Verification checklist

- [ ] `CallDevicesService` provided in root
- [ ] `NgZone.run` wraps the device-update events (`onAudioInputDevicesChanged` / `onAudioOutputDevicesChanged` / `onVideoInputDevicesChanged`)
- [ ] Listener unsubscribe fns captured and called in `ngOnDestroy` (no `removeEventListener`)
- [ ] Device getters/setters called WITHOUT `await` (they are sync); options use `device.deviceId`
- [ ] Picker uses `async` pipe (not manual subscribe)
- [ ] `ensurePermission()` called before `refresh()` (empty-label fix)
- [ ] Browser smoke: plug/unplug headphones during call → list updates
- [ ] Safari smoke: speaker picker hidden (Safari limitation)

---

## Pointers

- `cometchat-react-calls/references/device-management.md` — sister web reference
- `cometchat-angular-calls` SKILL.md
- `references/ngzone-and-async-callbacks.md` — NgZone primer
- Canonical docs: https://www.cometchat.com/docs/calls/javascript/device-management
