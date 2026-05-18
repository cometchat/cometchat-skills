# Adding calls to an existing chat integration (Angular)

Same SDK as web; Angular-specific deltas: NgZone wrapping, NgModule registration, root-level CometChatIncomingCall mounting.

**Read first:** `cometchat-react-calls/references/add-calls-to-existing-chat.md` — canonical web steps.

---

## Step 1 — Install + init

```bash
npm install @cometchat/calls-sdk-javascript@5
```

Update your existing init (typically in an `AppInitService`):

```ts
@Injectable({ providedIn: "root" })
export class AppInitService {
  async init(): Promise<void> {
    const settings = new CometChat.AppSettingsBuilder().setRegion(env.REGION).build();
    await CometChat.init(env.APP_ID, settings);
    await CometChatCalls.init({ appId: env.APP_ID, region: env.REGION });
  }
}
```

---

## Step 2 — Login

In your auth service, after `CometChat.login`:

```ts
const user = await CometChat.login(uid, env.AUTH_KEY);
const authToken = user.getAuthToken();
await CometChatCalls.login(authToken);
```

---

## Step 3 — Mount IncomingCall at app root

```html
<!-- app.component.html -->
<router-outlet></router-outlet>
<cometchat-incoming-call></cometchat-incoming-call>
```

```ts
// app.module.ts (or standalone-component imports)
import { CometChatIncomingCall } from "@cometchat/chat-uikit-angular";

@NgModule({
  declarations: [AppComponent],
  imports: [CometChatIncomingCall, /* ... */],
})
export class AppModule {}
```

---

## Step 4 — NgZone wrap on calls events

If you subscribe to `CometChatCalls.addEventListener` outside the kit's components, wrap with `NgZone.run`:

```ts
@Injectable({ providedIn: "root" })
export class CallEventsService {
  constructor(private zone: NgZone) {
    CometChatCalls.addEventListener("onSessionLeft", () => {
      this.zone.run(() => this.onSessionLeft$.next());
    });
  }
}
```

---

## Verification checklist

- [ ] `@cometchat/calls-sdk-javascript@^5` in package.json
- [ ] Calls SDK init runs after chat SDK init in `AppInitService`
- [ ] `CometChatCalls.login(authToken)` after `CometChat.login`
- [ ] `<cometchat-incoming-call>` rendered at app root (sibling of `router-outlet`)
- [ ] All custom `addEventListener` callbacks wrapped in `NgZone.run`
- [ ] Run `cometchat verify --calls` — should pass

---

## Pointers

- `cometchat-react-calls/references/add-calls-to-existing-chat.md` — canonical
- `cometchat-angular-calls/SKILL.md`
- `references/ngzone-and-async-callbacks.md`
