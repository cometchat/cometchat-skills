# Device management on Angular

Same JS SDK as web. Angular wraps device-list state in a service with RxJS observables.

**Canonical docs:** https://www.cometchat.com/docs/calls/javascript/device-management
**Read first:** `cometchat-react-calls/references/device-management.md` — pre-call picker + empty-label gotcha.

---

## Service-driven device lists

```ts
import { Injectable, NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

interface MediaDevice { id: string; label: string; }

@Injectable({ providedIn: "root" })
export class CallDevicesService {
  readonly mics$ = new BehaviorSubject<MediaDevice[]>([]);
  readonly cameras$ = new BehaviorSubject<MediaDevice[]>([]);
  readonly speakers$ = new BehaviorSubject<MediaDevice[]>([]);

  constructor(private zone: NgZone) {
    CometChatCalls.addEventListener("onAudioModesUpdated", () => {
      this.zone.run(() => this.refresh());
    });
  }

  async ensurePermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(t => t.stop());      // immediately release; we just wanted permission
    } catch {
      // permission denied
    }
  }

  async refresh(): Promise<void> {
    const [mics, cameras, speakers] = await Promise.all([
      CometChatCalls.getAudioInputDevices(),
      CometChatCalls.getVideoInputDevices(),
      CometChatCalls.getAudioOutputDevices(),
    ]);
    this.mics$.next(mics);
    this.cameras$.next(cameras);
    this.speakers$.next(speakers);
  }

  async selectMic(id: string): Promise<void> {
    await CometChatCalls.setAudioInputDevice(id);
  }
  async selectCamera(id: string): Promise<void> {
    await CometChatCalls.setVideoInputDevice(id);
  }
  async selectSpeaker(id: string): Promise<void> {
    await CometChatCalls.setAudioOutputDevice(id);
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
          <option *ngFor="let d of mics$ | async" [value]="d.id">
            {{ d.label || ('Mic ' + d.id.substring(0, 6)) }}
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
    await this.devices.ensurePermission();
    await this.devices.refresh();
  }

  async confirm() {
    if (this.selectedMic) await this.devices.selectMic(this.selectedMic);
    if (this.selectedCamera) await this.devices.selectCamera(this.selectedCamera);
    if (this.selectedSpeaker) await this.devices.selectSpeaker(this.selectedSpeaker);
  }
}
```

---

## Anti-patterns

Web sister rules apply, plus Angular-specific:

1. **No `NgZone.run` wrap on `onAudioModesUpdated`.** BehaviorSubject emits but UI doesn't update with OnPush.
2. **Service NOT provided in `root`.** Lazy-loaded → device events miss.
3. **`async pipe` not used.** Manual `subscribe` without `unsubscribe` leaks.

---

## Verification checklist

- [ ] `CallDevicesService` provided in root
- [ ] `NgZone.run` wraps the device-update event
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
