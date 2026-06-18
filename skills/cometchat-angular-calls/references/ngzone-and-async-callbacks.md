# NgZone + async SDK callbacks — the Angular calls gotcha

Angular's change detection runs inside `NgZone`. Callbacks that fire *outside* NgZone don't trigger change detection — UI doesn't update. The Calls SDK fires lots of callbacks from native bridges (WebRTC, browser MediaStream events), and those bridges escape the zone.

If your custom call UI seems "frozen" — call ends but the screen stays — this is almost always the cause.

---

## Symptom

```ts
// OngoingCallComponent
ngOnInit() {
  CometChatCalls.joinSession(token, settings, container);  // v5 canonical (startSession is a deprecated shim)

  // This callback is registered with the SDK, which is registered with WebRTC,
  // which is a native browser API outside Angular's zone
  callListener.onCallEnded = () => {
    this.callEnded = true;       // ← variable updates
    this.cleanup();              // ← runs
    // BUT: change detection doesn't fire. The template doesn't re-render.
    // User sees: "End" button still showing, no "Call ended" message.
  };
}
```

---

## Fix

Wrap the callback body in `NgZone.run`:

```ts
import { NgZone } from "@angular/core";

constructor(private zone: NgZone) {}

ngOnInit() {
  // ...
  callListener.onCallEnded = () => {
    this.zone.run(() => {
      this.callEnded = true;
      this.cleanup();
    });
  };
}
```

Now change detection runs after the variable updates; template re-renders.

---

## Which callbacks need NgZone.run?

All Calls SDK event listeners. The kit's own components handle this internally; custom code that subscribes to the SDK directly does NOT.

Conservative rule: **wrap every callback that mutates UI state** in `zone.run`.

> `CometChatCalls.OngoingCallListener` is `@deprecated` in calls-sdk-javascript v5 (prefer `CometChatCalls.addEventListener(...)`); the listener pattern below still works and is shown here because this reference is about NgZone-wrapping. Note that the dominant-speaker signal is NOT a listener callback — subscribe to it via `addEventListener("onDominantSpeakerChanged", …)` (also wrap that handler in `zone.run`).

```ts
const listener = new CometChatCalls.OngoingCallListener({
  onUserListUpdated: (userList) => {
    this.zone.run(() => { this.participants = userList; });
  },
  onCallEnded: () => {
    this.zone.run(() => { this.callEnded = true; this.cleanup(); });
  },
  onError: (err) => {
    this.zone.run(() => { this.errorMessage = err.message; });
  },
});

// Dominant speaker is an addEventListener event key, not a listener callback:
const offSpeaker = CometChatCalls.addEventListener("onDominantSpeakerChanged", (p) => {
  this.zone.run(() => { this.activeSpeakerUid = p.uid; });
});
```

If a callback only triggers a side effect (logging, analytics) without UI changes, NgZone.run is not strictly required — but harmless.

---

## Alternative: ChangeDetectorRef.detectChanges

If you want to avoid NgZone for performance reasons (zone.run is cheap but adds overhead in hot paths), use `ChangeDetectorRef.detectChanges`:

```ts
import { ChangeDetectorRef } from "@angular/core";

constructor(private cd: ChangeDetectorRef) {}

ngOnInit() {
  callListener.onCallEnded = () => {
    this.callEnded = true;
    this.cleanup();
    this.cd.detectChanges();   // run change detection just for this component subtree
  };
}
```

Pros: scoped to the component (NgZone is global).
Cons: if you have parent component bindings that depend on this state, they don't update. Use NgZone.run for cross-component state changes.

For 95% of cases, NgZone.run is the right answer.

---

## Async/await inside callbacks

If your callback is `async`, wrap the whole function:

```ts
callListener.onCallEnded = async () => {
  await this.zone.run(async () => {
    await this.savePostCallAnalytics();
    this.callEnded = true;
    this.cleanup();
  });
};
```

Or simpler — use a plain method and let zone.js patch async automatically:

```ts
callListener.onCallEnded = () => {
  this.zone.run(() => this.handleCallEnded());
};

private async handleCallEnded() {
  await this.savePostCallAnalytics();
  this.callEnded = true;
  this.cleanup();
}
```

Inside `handleCallEnded`, change detection fires automatically because zone.js patches `await`.

---

## How to detect this bug

Add a debug log inside the callback. If the log fires but the UI doesn't update, you're outside zone:

```ts
callListener.onCallEnded = () => {
  console.log("[debug] onCallEnded fired", new Date().toISOString());
  this.callEnded = true;
};
```

If "fired" appears in console but the template still shows the call as active, wrap in zone.run.

---

## OnPush change detection

If your component uses `ChangeDetectionStrategy.OnPush`, NgZone.run alone isn't enough — OnPush only re-renders on `@Input` changes or explicit markForCheck. Combine:

```ts
import { ChangeDetectionStrategy, ChangeDetectorRef } from "@angular/core";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OngoingCallComponent {
  constructor(private zone: NgZone, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    callListener.onCallEnded = () => {
      this.zone.run(() => {
        this.callEnded = true;
        this.cd.markForCheck();
      });
    };
  }
}
```

---

## When the kit fires NgZone-correctly

The CometChat Angular UI Kit (`@cometchat/chat-uikit-angular`) handles this internally. If you only use `<cometchat-incoming-call>`, `<cometchat-ongoing-call>`, etc. — no manual NgZone needed. The bug only bites when you write custom subscriptions to `CometChatCalls.*` callbacks.
