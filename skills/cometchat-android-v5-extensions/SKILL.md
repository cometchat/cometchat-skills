---
name: cometchat-android-v5-extensions
description: "Extension architecture for CometChat Android — ExtensionsDataSource, decorators, built-in extensions, and how to create custom extensions."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat android extensions datasource decorator polls stickers collaborative"
---

> **Companion skills:** `cometchat-android-v5-customization` covers DataSource decorators;
> `cometchat-android-v5-features` covers the feature catalog.

## Purpose

This skill covers the CometChat extension architecture — how extensions plug into the UI Kit, the built-in extensions, and how to create custom ones.

---

## Use this skill when

- "How do extensions work?"
- "How do I add a custom extension?"
- "How do I disable an extension?"
- Working with `ExtensionsDataSource` or `ExtensionDecorator`

## Do not use this skill when

- Enabling a backend extension or AI feature → use `cometchat-android-v5-features` (which routes to `cometchat apply-feature <id> --app-id <X>`)
- Writing custom message templates → use `cometchat-android-v5-customization`

---

## 1. Extension architecture

Extensions are split into two class types:

- **Registrar** classes (e.g. `PollsExtension`, `StickerExtension`) — extend `ExtensionsDataSource`. These are what you pass to `setExtensions(...)` to enable a built-in extension.
- **Decorator** classes (e.g. `PollsExtensionDecorator`, `StickerExtensionDecorator`) — extend `DataSourceDecorator`. These are the runtime decorators that wrap the active `DataSource` chain. The kit creates them internally; you don't construct them directly.

```
ChatConfigurator.getDataSource()
    └── SmartRepliesExtensionDecorator   (created by SmartRepliesExtension)
        └── PollsExtensionDecorator      (created by PollsExtension)
            └── StickerExtensionDecorator (created by StickerExtension)
                └── MessagesDataSource (base)
```

## 2. Built-in extensions

| Extension | Package | What it adds |
|---|---|---|
| Polls | `com.cometchat.chatuikit.extensions.polls` | Poll creation and voting in messages |
| Stickers | `com.cometchat.chatuikit.extensions.sticker` | Sticker keyboard and sticker bubbles |
| Collaborative Document | `com.cometchat.chatuikit.extensions.collaborative` | Shared document editing |
| Collaborative Whiteboard | `com.cometchat.chatuikit.extensions.collaborative` | Shared whiteboard |
| Smart Replies | `com.cometchat.chatuikit.extensions.smartreplies` | AI-powered reply suggestions |
| Message Translation | `com.cometchat.chatuikit.extensions.messagetranslation` | Translate messages |
| Text Moderation | `com.cometchat.chatuikit.extensions.textmoderation` | Profanity filtering |
| Thumbnail Generation | `com.cometchat.chatuikit.extensions.thumbnailgeneration` | Image thumbnails |

## 3. Enabling/disabling extensions

Extensions are enabled by default. To customize which extensions are active, pass a custom list to `UIKitSettingsBuilder`:

```java
List<ExtensionsDataSource> extensions = new ArrayList<>();
extensions.add(new PollsExtension());            // registrar, NOT PollsExtensionDecorator
extensions.add(new StickerExtension());         // registrar, NOT StickerExtensionDecorator
extensions.add(new SmartRepliesExtension());
// Omit extensions you don't want

UIKitSettings settings = new UIKitSettings.UIKitSettingsBuilder()
    .setAppId(APP_ID)
    .setRegion(REGION)
    .setAuthKey(AUTH_KEY)
    .setExtensions(extensions)
    .build();
```

> **Why not `PollsExtensionDecorator`?** `*ExtensionDecorator` extends `DataSourceDecorator`, not `ExtensionsDataSource` — so it won't compile when added to a `List<ExtensionsDataSource>`. The kit's runtime decorator chain is built by the registrar's `enable()` method internally; you don't add decorators directly.

## 4. Creating a custom extension

A custom extension has TWO classes:

1. A **registrar** that extends `ExtensionsDataSource` (gets added to `setExtensions(...)`)
2. A **decorator** that extends `DataSourceDecorator` (created by the registrar via `ChatConfigurator.enable(...)`)

```java
// 1. Decorator — extends DataSourceDecorator, overrides per-message behavior
public class MyExtensionDecorator extends DataSourceDecorator {
    public MyExtensionDecorator(DataSource dataSource) {
        super(dataSource);
    }
    // Override methods to add custom behavior
}

// 2. Registrar — extends ExtensionsDataSource, exposes getExtensionId() and enable()
public class MyExtension extends ExtensionsDataSource {
    @Override
    public String getExtensionId() {
        return "my-custom-extension";
    }

    @Override
    public void enable() {
        ChatConfigurator.enable(dataSource -> new MyExtensionDecorator(dataSource));
    }
}

// Then add the registrar to UIKitSettings:
extensions.add(new MyExtension());
```

---

## Hard rules

- **Two classes per extension.** A registrar (`ExtensionsDataSource`, holds `getExtensionId()` + `enable()`) and a decorator (`DataSourceDecorator`, holds the per-message override). `setExtensions(...)` wants registrars; the chain builds decorators automatically.
- **Register after init.** `ChatConfigurator.enable()` must be called after `CometChatUIKit.init()` succeeds.
- **Backend extension toggle still applies.** Even if an extension is registered client-side, it needs to be enabled on the app's backend. Use `cometchat apply-feature <id> --app-id <X>` (the CLI hits the dashboard API). For dashboard-only extensions (Giphy / Stipop / Tenor / Chatwoot / Intercom — those needing third-party API keys), the user has to enter the third-party config in the dashboard manually.
