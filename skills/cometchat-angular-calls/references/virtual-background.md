# Virtual Background (Angular)

Angular calls run on the same `@cometchat/calls-sdk-javascript@5` as React — reached via the kit's `CometChatUIKitCalls` alias (exported from `@cometchat/chat-uikit-angular`). Web supports virtual background; native iOS/Android do not.

## A. Built-in setting (recommended)

Turn on the kit's own Virtual Background control via the call settings builder — it renders the blur/image/clear picker inside the call UI:

```ts
import { CometChatUIKitCalls } from "@cometchat/chat-uikit-angular";

const settings = new CometChatUIKitCalls.CallSettingsBuilder()
  .enableDefaultLayout(true)
  .showVirtualBackgroundSetting(true)   // built-in VB control
  .build();
// pass the UNBUILT builder to <cometchat-ongoing-call [callSettingsBuilder]="…"> per §3
```

## B. Apply programmatically (custom surface)

```ts
CometChatUIKitCalls.setVirtualBackgroundBlurLevel(50);             // blur 0–100
CometChatUIKitCalls.setVirtualBackgroundImage("https://…/bg.jpg"); // custom image
CometChatUIKitCalls.clearVirtualBackground();                       // remove
```

Run these from a method on your call component (e.g. a toolbar button handler); under OnPush, mutating component state in the handler is fine — use signals for any state you render (see §1.5).

Verified: `CallSettingsBuilder.showVirtualBackgroundSetting(boolean)`, static `setVirtualBackgroundBlurLevel(number)` / `setVirtualBackgroundImage(string)` / `clearVirtualBackground()` (deprecated aliases: `setBackgroundBlur`/`setBackgroundImage`).
