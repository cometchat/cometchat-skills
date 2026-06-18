# Virtual Background (web)

Verified against `@cometchat/calls-sdk-javascript@5`. Web (React/Angular) is one of the few platforms that supports virtual background (native iOS/Android do not). Two ways to expose it:

## A. Let the kit show its built-in setting (additive / kit components)

Enable the kit's own Virtual Background button on the call settings builder — it renders a blur/image/clear picker inside the call UI, no custom code:

```ts
const settings = new CometChatCalls.CallSettingsBuilder()
  .enableDefaultLayout(true)
  .showVirtualBackgroundSetting(true)   // ← shows the built-in VB control
  .build();
```

To read the current state, call `getVirtualBackground()` on a built `CallSettings` instance — it's an **instance** method on `CallSettings` (`callSettings.getVirtualBackground(): VirtualBackground`), not a `CometChatCalls` static.

## B. Apply programmatically (custom call surface)

Three static methods on `CometChatCalls`, callable during an active session:

```ts
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";

CometChatCalls.setVirtualBackgroundBlurLevel(50);              // blur (0–100)
CometChatCalls.setVirtualBackgroundImage("https://…/bg.jpg");  // custom image
CometChatCalls.clearVirtualBackground();                        // remove
```

> The older `setBackgroundBlur()` / `setBackgroundImage()` names are **deprecated** — use the `setVirtualBackground*` forms above.

Verified (calls-sdk `index.d.ts`): `CallSettingsBuilder.showVirtualBackgroundSetting(boolean)`, instance `CallSettings.getVirtualBackground(): VirtualBackground`, and the statics `CometChatCalls.setVirtualBackgroundBlurLevel(number)` / `setVirtualBackgroundImage(string)` / `clearVirtualBackground()`.
