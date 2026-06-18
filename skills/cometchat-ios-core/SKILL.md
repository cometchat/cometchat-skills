---
name: cometchat-ios-core
description: "Shared rules for CometChat iOS UI Kit v5. Always loaded alongside placement skills. Read this first."
license: "MIT"
compatibility: "iOS 13+; Swift 5.0+; CometChatUIKitSwift ^5; CometChatSDK ^4"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios swift core rules initialization patterns"
---

> **Ground truth:** `CometChatUIKitSwift ~> 5` + `CometChatSDK ~> 4` (+ `CometChatCallsSDK ~> 5`) — the installed Pods / SPM `.swiftinterface` + `docs/ui-kit/ios`. **Official docs:** https://www.cometchat.com/docs/ui-kit/ios/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP). Verify Swift symbols/labels against the `.swiftinterface` before relying on them.

## Purpose

This is the foundational skill for every CometChat iOS UI Kit v5 integration. It teaches HOW CometChat works on iOS — initialization, login, the manager pattern, and anti-patterns — so you can write project-appropriate code instead of relying on templates.

**Read this skill first, before any placement or component skill.**

---

## 1. Installation

### 0. First — confirm a dependency manifest exists (or create one)

A freshly-created Xcode project (`File → New → App` from the GUI) ships **no `Podfile`, no `Package.swift`, and no Swift Package Manager refs in `*.xcodeproj/project.pbxproj`**. Before touching any of the integration code below, you MUST establish a dependency-management mechanism — otherwise `import CometChatUIKitSwift` will hit `Unable to resolve module dependency: 'CometChatSDK'` at the first build attempt and the entire integration is dead on arrival.

**Detection:**

```bash
ls Podfile Package.swift 2>/dev/null
grep -l "XCRemoteSwiftPackageReference\|repositoryURL.*cometchat" *.xcodeproj/project.pbxproj 2>/dev/null
```

If all three return empty → **fresh Xcode project, no dep manager**. Pick one and set it up before continuing:

**Option A — CocoaPods (most common, easiest to script):**

```bash
cd <project-root>
cat > Podfile <<'POD'
platform :ios, '13.0'
use_frameworks!

target 'YourAppTargetName' do
  pod 'CometChatUIKitSwift', '~> 5.1'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
end
POD
pod install
```

After `pod install`, work from `YourApp.xcworkspace` (NOT `.xcodeproj`) — CocoaPods rewires the workspace to include the Pods project.

**Option B — Swift Package Manager (no Podfile, no `.xcworkspace`):**

The user must add the package via Xcode's GUI (the SPM dependency lives in `*.xcodeproj/project.pbxproj` and there's no clean CLI tooling to edit that file safely). Print these instructions verbatim:

> 1. Open `<YourApp>.xcodeproj` in Xcode
> 2. **File → Add Package Dependencies…**
> 3. Paste URL: `https://github.com/cometchat/cometchat-uikit-ios`
> 4. **Add Package** → keep "Up to Next Major Version" defaults → **Add Package** again
> 5. Confirm `CometChatUIKitSwift` appears under your app target's *Frameworks, Libraries, and Embedded Content*

**Then verify the package landed:**

```bash
grep -E "cometchat-uikit-ios|CometChatUIKitSwift" *.xcodeproj/project.pbxproj | head -2
```

If grep returns matches, the SPM dep is in. If it doesn't, the user didn't complete step 4 in Xcode — surface that explicitly and stop until they have.

**HARD STOP if neither option is in place.** Do not write `import CometChatUIKitSwift` into any Swift file until either `pod install` completes successfully or the SPM grep above returns matches. Skipping this step produces an integration that compiles only after the user does extra setup work — a worse outcome than asking them up-front.

### CocoaPods (full reference — only if you skipped Option A above)

Add to your `Podfile`:

```ruby
platform :ios, '13.0'
use_frameworks!

target 'YourApp' do
  pod 'CometChatUIKitSwift', '~> 5.1'
end
```

Then run:
```bash
pod install
```

**Important: Disable User Script Sandboxing (Xcode 15+)**

After running `pod install`, you must disable user script sandboxing in your project's Build Settings:

1. Open your `.xcworkspace` file
2. Select your app target
3. Go to **Build Settings**
4. Search for "User Script Sandboxing"
5. Set **ENABLE_USER_SCRIPT_SANDBOXING** to **No**

Or add this to your `Podfile` to do it automatically:

```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
end
```

### Swift Package Manager

Add the package URL in Xcode (File → Add Package Dependencies):

**CometChat UI Kit (includes SDK):**
```
https://github.com/cometchat/cometchat-uikit-ios
```

**CometChat SDK only (if needed separately):**
```
https://github.com/cometchat/chat-sdk-ios
```

**CometChat Calls SDK (for voice/video calls):**
```
https://github.com/cometchat/calls-sdk-ios
```

Or add to `Package.swift`:
```swift
dependencies: [
    .package(url: "https://github.com/cometchat/cometchat-uikit-ios", from: "5.0.0"),
    // Optional: Add calls SDK for voice/video
    // .package(url: "https://github.com/cometchat/calls-sdk-ios", from: "5.0.0")  // requires iOS 16+
]
```

### GitHub Repositories

| Package | Repository | Description |
|---------|------------|-------------|
| UI Kit | https://github.com/cometchat/cometchat-uikit-ios | Ready-to-use UI components |
| Chat SDK | https://github.com/cometchat/chat-sdk-ios | Core messaging SDK |
| Calls SDK | https://github.com/cometchat/calls-sdk-ios | Voice & video calling |
| Sample App | https://github.com/cometchat/cometchat-sample-app-ios | Sample implementation |

---

## 2. Initialization

CometChat must be initialized exactly once before any UI component is used. Initialization is asynchronous and must complete fully before mounting any `CometChat*` view controller.

### File-based init with `cometchat-settings.json` (recommended)

> **Version requirement (ENG-35866 — Skills Telemetry).** `CometChatUIKit.initFromSettings(completion:)` reads a bundled `cometchat-settings.json` and lets the SDK self-report `integrationSource = "ai-agent"` to `/user_sessions`. It ships GA in **`CometChatUIKitSwift >= 5.1.15`** (public CocoaPods + SPM; pulls `CometChatSDK 4.1.x`). The `~> 5.1` Pod range / `from: "5.0.0"` SPM range below already resolve it. On an older UI Kit (`< 5.1.15`) the method does not exist — use the **`UIKitSettings` builder fallback** below.

Unlike the web/RN kits, the iOS `initFromSettings` takes **no settings argument** — it reads the file straight from the app bundle, so the file must be added to the target's **Copy Bundle Resources**.

**Step 1 — create `cometchat-settings.json`** and add it to the app target (`File → Add Files…`, *and* confirm it appears under *Build Phases → Copy Bundle Resources*). Fill `appId` / `region` / `credentials.authKey`; leave the rest at the defaults:

```json
{
  "appId": "APP_ID_HERE",
  "region": "us",
  "credentials": {
    "authKey": "AUTH_KEY_HERE"
  },
  "chatSDK": {
    "presenceSubscription": {
      "type": "ALL_USERS",
      "roles": []
    },
    "autoEstablishSocketConnection": true,
    "adminHost": null,
    "clientHost": null
  },
  "callsSDK": {
    "host": null,
    "adminHost": null,
    "clientHost": null,
    "callsHost": null
  },
  "uiKit": {
    "subscribePresenceForAllUsers": true
  }
}
```

**Step 2 — init (no builder, no args — the SDK reads the bundled file):**

```swift
// initFromSettings ships GA in CometChatUIKitSwift >= 5.1.15 (ENG-35866)
import CometChatUIKitSwift

CometChatUIKit.initFromSettings { success, error in
    if let error = error {
        print("CometChat init failed: \(error.errorCode) — \(error.errorDescription)")
        return
    }
    print("CometChat initialized")
    // then: CometChatUIKit.login(uid:) — see §3
}
```

- If init throws `cometchat-settings.json not found`, the file isn't in **Copy Bundle Resources** — add it there (adding it to the project navigator alone is not enough).
- **Do NOT gitignore `cometchat-settings.json`.** The dev-mode `authKey` ships in the app bundle either way; production uses server-minted auth tokens.

### UIKitSettings Builder (fallback — UI Kit before file-based init)

```swift
import CometChatUIKitSwift

let uiKitSettings = UIKitSettings()
    .set(appID: "YOUR_APP_ID")
    .set(authKey: "YOUR_AUTH_KEY")  // Required for dev mode
    .set(region: "us")               // "us", "eu", or "in"
    .subscribePresenceForAllUsers()  // Enable online/offline indicators
    .build()
```

### Init must happen once

Use a singleton manager to prevent double-init:

```swift
import CometChatUIKitSwift
import CometChatSDK

final class CometChatManager {
    static let shared = CometChatManager()
    
    private var isInitialized = false
    private var initializationError: Error?
    
    private init() {}
    
    func initialize(
        appID: String,
        authKey: String,
        region: String,
        completion: @escaping (Result<Bool, Error>) -> Void
    ) {
        guard !isInitialized else {
            completion(.success(true))
            return
        }
        
        let uiKitSettings = UIKitSettings()
            .set(appID: appID)
            .set(authKey: authKey)
            .set(region: region)
            .subscribePresenceForAllUsers()
            .build()
        
        CometChatUIKit(uiKitSettings: uiKitSettings) { result in
            switch result {
            case .success(let success):
                self.isInitialized = success
                completion(.success(success))
            case .failure(let error):
                self.initializationError = error
                completion(.failure(error))
            }
        }
    }
}
```

### Init in AppDelegate (UIKit apps)

> **Scene-based app (the modern Xcode default — has a `SceneDelegate.swift`)?** Init in `scene(_:willConnectTo:)` instead — that's the canonical pattern the reference app uses (see "Init code — SceneDelegate (canonical)" below). The `didFinishLaunchingWithOptions` example here is correct for the **SDK init call itself** (it needs no window), but scene-based apps that load settings + apply theme + set the root view controller in one pass should do all of it in `scene(_:willConnectTo:)`, where the window/scene exists. Use this AppDelegate form only for apps with no SceneDelegate.

```swift
import UIKit
import CometChatUIKitSwift

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        CometChatManager.shared.initialize(
            appID: "YOUR_APP_ID",
            authKey: "YOUR_AUTH_KEY",
            region: "us"
        ) { result in
            switch result {
            case .success:
                print("CometChat initialized successfully")
            case .failure(let error):
                print("CometChat initialization failed: \(error)")
            }
        }
        
        return true
    }
}
```

### Init in App struct (SwiftUI apps)

```swift
import SwiftUI
import CometChatUIKitSwift

@main
struct YourApp: App {
    
    init() {
        CometChatManager.shared.initialize(
            appID: "YOUR_APP_ID",
            authKey: "YOUR_AUTH_KEY",
            region: "us"
        ) { result in
            switch result {
            case .success:
                print("CometChat initialized successfully")
            case .failure(let error):
                print("CometChat initialization failed: \(error)")
            }
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

---

## 3. Login

### Development mode

Use `CometChatUIKit.login(uid:)` with a test UID. Every new CometChat app comes with five pre-created test users: `cometchat-uid-1` through `cometchat-uid-5`.

**Important:** The login callback uses `.success` and `.onError` cases, NOT Swift's standard `Result` type.

```swift
CometChatUIKit.login(uid: "cometchat-uid-1") { result in
    switch result {
    case .success(let user):
        print("Logged in as: \(user.name ?? "")")
        // Proceed to chat UI
    case .onError(let error):
        print("Login failed: \(error.errorDescription)")
    @unknown default:
        break
    }
}
```

### Production mode

Use `CometChatUIKit.login(authToken:)` with a token obtained from your backend:

```swift
CometChatUIKit.login(authToken: authToken) { result in
    switch result {
    case .success(let user):
        print("Logged in as: \(user.name ?? "")")
    case .onError(let error):
        print("Login failed: \(error.errorDescription)")
    @unknown default:
        break
    }
}
```

### Getting the current logged-in user

```swift
// Synchronous — use when you know init is complete
if let currentUser = CometChatUIKit.getLoggedInUser() {
    print("Logged in as: \(currentUser.name ?? "")")
}
```

### Logout

```swift
if let currentUser = CometChat.getLoggedInUser() {
    CometChatUIKit.logout(user: currentUser) { result in
        switch result {
        case .success:
            print("Logged out successfully")
        case .onError(let error):
            print("Logout failed: \(error.errorDescription)")
        @unknown default:
            break
        }
    }
}
```

---

## 3.1 Error Handling

CometChat uses `CometChatException` for errors. **Important:** Use `errorDescription` property, NOT `localizedDescription`.

### CometChatException Properties

```swift
// CometChatException has these properties:
error.errorCode        // String - error code like "ERR_UID_NOT_FOUND"
error.errorDescription // String - human-readable description
// NOTE: CometChatException exposes ONLY errorCode + errorDescription.
// There is no `details` property — don't reference one.
```

### Correct Error Handling

```swift
CometChatUIKit.login(uid: "user-123") { result in
    switch result {
    case .success(let user):
        print("Logged in: \(user.name ?? "")")
    case .onError(let error):
        print("Error: \(error.errorDescription)")
        print("Code: \(error.errorCode)")
    }
}
```

### Error Handling in Closures

```swift
// For onError closures where error might be optional:
CometChat.getUser(UID: "user-123") { user in
    print("User: \(user?.name ?? "")")
} onError: { error in
    // error is CometChatException? (optional)
    print("Error: \(error?.errorDescription ?? "Unknown error")")
}

// For ApiStatus enum results:
CometChatUIKit.create(user: newUser) { result in
    switch result {
    case .success(let user):
        print("Created: \(user.name ?? "")")
    case .onError(let error):
        // error is CometChatException (non-optional)
        print("Error: \(error.errorDescription)")
    }
}
```

### Common Error Codes

| Code | Description |
|---|---|
| `ERR_UID_NOT_FOUND` | User doesn't exist |
| `ERR_ALREADY_LOGGED_IN` | User already logged in |
| `ERR_NOT_LOGGED_IN` | No active session |
| `AUTH_ERR_AUTH_TOKEN_NOT_FOUND` | Invalid auth token |
| `ERR_INVALID_APP_ID` | Wrong App ID |
| `ERR_INVALID_API_KEY` | Wrong API/Auth Key |

---

## 4. Credentials Management

### Using a Constants file (Development)

```swift
// Constants.swift
struct CometChatConstants {
    static let appID = "YOUR_APP_ID"
    static let authKey = "YOUR_AUTH_KEY"
    static let region = "us"
}
```

**Important:** Add `Constants.swift` to `.gitignore` for production apps.

### Using Info.plist

Add keys to your `Info.plist`:
```xml
<key>CometChatAppID</key>
<string>YOUR_APP_ID</string>
<key>CometChatAuthKey</key>
<string>YOUR_AUTH_KEY</string>
<key>CometChatRegion</key>
<string>us</string>
```

Read them in code:
```swift
guard let appID = Bundle.main.object(forInfoDictionaryKey: "CometChatAppID") as? String,
      let authKey = Bundle.main.object(forInfoDictionaryKey: "CometChatAuthKey") as? String,
      let region = Bundle.main.object(forInfoDictionaryKey: "CometChatRegion") as? String else {
    fatalError("CometChat credentials not found in Info.plist")
}
```

### Using xcconfig files (Recommended for production)

Create `Debug.xcconfig` and `Release.xcconfig`:
```
// Debug.xcconfig
COMETCHAT_APP_ID = your_app_id
COMETCHAT_AUTH_KEY = your_auth_key
COMETCHAT_REGION = us
```

Reference in `Info.plist`:
```xml
<key>CometChatAppID</key>
<string>$(COMETCHAT_APP_ID)</string>
```

---

## 5. The Manager Pattern

The recommended pattern for iOS is a singleton manager that handles initialization, login state, and provides a clean API for the rest of the app.

### Complete CometChatManager

**Important:** `CometChatException` does NOT conform to Swift's `Error` protocol. Use `CometChatException` directly in your callbacks, not `Result<T, Error>`.

```swift
import Foundation
import CometChatUIKitSwift
import CometChatSDK

final class CometChatManager {
    
    // MARK: - Singleton
    static let shared = CometChatManager()
    
    // MARK: - State
    private(set) var isInitialized = false
    private(set) var currentUser: User?
    
    // MARK: - Callbacks
    var onLoginStateChanged: ((User?) -> Void)?
    
    private init() {}
    
    // MARK: - Initialization
    func initialize(
        appID: String,
        authKey: String,
        region: String,
        completion: @escaping (Bool, CometChatException?) -> Void
    ) {
        guard !isInitialized else {
            completion(true, nil)
            return
        }
        
        let uiKitSettings = UIKitSettings()
            .set(appID: appID)
            .set(authKey: authKey)
            .set(region: region)
            .subscribePresenceForAllUsers()
            .build()
        
        CometChatUIKit.init(uiKitSettings: uiKitSettings) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let success):
                    self?.isInitialized = success
                    self?.currentUser = CometChatUIKit.getLoggedInUser()
                    completion(success, nil)
                case .failure(let error):
                    completion(false, error as? CometChatException)
                }
            }
        }
    }
    
    // MARK: - Login with UID (Development)
    func login(uid: String, completion: @escaping (User?, CometChatException?) -> Void) {
        guard isInitialized else {
            print("CometChat not initialized")
            completion(nil, nil)
            return
        }
        
        if let user = currentUser {
            completion(user, nil)
            return
        }
        
        CometChatUIKit.login(uid: uid) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let user):
                    self?.currentUser = user
                    self?.onLoginStateChanged?(user)
                    completion(user, nil)
                case .onError(let error):
                    completion(nil, error)
                @unknown default:
                    completion(nil, nil)
                }
            }
        }
    }
    
    // MARK: - Login with Auth Token (Production)
    func loginWithToken(_ authToken: String, completion: @escaping (User?, CometChatException?) -> Void) {
        guard isInitialized else {
            print("CometChat not initialized")
            completion(nil, nil)
            return
        }
        
        CometChatUIKit.login(authToken: authToken) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let user):
                    self?.currentUser = user
                    self?.onLoginStateChanged?(user)
                    completion(user, nil)
                case .onError(let error):
                    completion(nil, error)
                @unknown default:
                    completion(nil, nil)
                }
            }
        }
    }
    
    // MARK: - Logout
    func logout(completion: @escaping (Bool, CometChatException?) -> Void) {
        guard let user = currentUser else {
            completion(true, nil)
            return
        }
        
        CometChatUIKit.logout(user: user) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    self?.currentUser = nil
                    self?.onLoginStateChanged?(nil)
                    completion(true, nil)
                case .onError(let error):
                    completion(false, error)
                @unknown default:
                    completion(false, nil)
                }
            }
        }
    }
}
```

### Usage Example

```swift
// Initialize
CometChatManager.shared.initialize(
    appID: "YOUR_APP_ID",
    authKey: "YOUR_AUTH_KEY",
    region: "us"
) { success, error in
    if success {
        print("Initialized successfully")
    } else if let error = error {
        print("Init failed: \(error.errorDescription)")
    }
}

// Login
CometChatManager.shared.login(uid: "cometchat-uid-1") { user, error in
    if let user = user {
        print("Logged in as: \(user.name ?? "")")
        // Show chat UI
    } else if let error = error {
        print("Login failed: \(error.errorDescription)")
    }
}

// Logout
CometChatManager.shared.logout { success, error in
    if success {
        print("Logged out")
    } else if let error = error {
        print("Logout failed: \(error.errorDescription)")
    }
}
```

---

## 6. Theming

### Global Theme Configuration

CometChat iOS UI Kit uses `CometChatTheme` for styling. Configure it before showing any UI:

```swift
// Set primary color
CometChatTheme.primaryColor = UIColor.systemBlue

// Set background colors
CometChatTheme.backgroundColor01 = UIColor.systemBackground
CometChatTheme.backgroundColor02 = UIColor.secondarySystemBackground

// Set text colors
CometChatTheme.textColorPrimary = UIColor.label
CometChatTheme.textColorSecondary = UIColor.secondaryLabel
```

### Component-Level Styling

Each component has a static `style` property:

```swift
// Conversations list style
CometChatConversations.style.backgroundColor = .systemBackground
CometChatConversations.style.titleColor = .label

// Message list style
CometChatMessageList.style.backgroundColor = .systemBackground

// Avatar style — cornerRadius is a CometChatCornerStyle. Its only value-
// taking init is the labeled designated init (the bare
// `CometChatCornerStyle(cornerRadius:)` belongs to the sibling
// CometChatCorner struct and will NOT compile here). Pass a value larger
// than half the avatar dimension for a circular look.
CometChatAvatar.style.backgroundColor = .systemGray5
CometChatAvatar.style.cornerRadius = CometChatCornerStyle(
    topLeft: true, topRight: true, bottomLeft: true, bottomRight: true,
    cornerRadius: 100
)
```

### Dark Mode Support

CometChat automatically supports dark mode when using system colors:

```swift
CometChatTheme.primaryColor = UIColor { traitCollection in
    traitCollection.userInterfaceStyle == .dark 
        ? UIColor.systemBlue 
        : UIColor.blue
}
```

---

## 7. Localization

CometChat iOS UI Kit supports 20+ languages out of the box. The language is automatically detected from the device settings.

### Supported Languages

Arabic, Chinese (Simplified), Chinese (Traditional), Dutch, English, French, German, Hindi, Hungarian, Japanese, Korean, Lithuanian, Malay, Portuguese, Russian, Spanish, Swedish, Turkish

### Setting locale

`CometChatLocalize` is a `Bundle` subclass that swaps the kit's `.lproj` lookup at runtime. The public API is locale-only:

```swift
CometChatLocalize.set(locale: .english)        // enum value
CometChatLocalize.set(locale: "fr")            // raw string
```

There is no `CometChatLocalize.set(key:value:)` for ad-hoc key overrides — to customize specific strings, override them in your app's `Localizable.strings` file (the kit reads through the standard bundle lookup chain).

---

## 8. Anti-patterns

These are specific things NOT to do. Each one causes real bugs.

1. **Do NOT call `CometChatUIKit.init()` multiple times.** Init should happen once in AppDelegate or App init. Multiple init calls cause undefined behavior.

2. **Do NOT show CometChat UI before init completes.** Components assume the SDK is initialized. Showing UI before init finishes causes crashes.

3. **Do NOT hardcode Auth Key in production code.** The auth key is a secret. Use environment variables or xcconfig files. Use auth tokens in production.

4. **Do NOT ignore the completion handler.** Init and login are async. Always handle the completion to know when it's safe to proceed.

5. **Do NOT create multiple instances of CometChatManager.** Use the singleton pattern. Multiple managers cause state inconsistencies.

6. **Do NOT call login while another login is in progress.** Check `currentUser` first. Concurrent login calls cause errors.

7. **Do NOT forget to handle logout.** When your app's user logs out, call `CometChatManager.shared.logout()` to clear the CometChat session.

8. **Do NOT ignore memory management.** CometChat view controllers should be properly deallocated. Avoid retain cycles with closures.

9. **Do NOT block the main thread.** All CometChat callbacks are on the main thread. Don't do heavy work in callbacks.

10. **Do NOT invent component names.** CometChat exports specific components with specific names. Check the `cometchat-ios-components` skill before writing any code.

---

## 9. SDK Types Reference

Common types from `CometChatSDK`:

```swift
import CometChatSDK

// User — represents a chat user
let user: User

// Group — represents a chat group
let group: Group

// Conversation — wraps User or Group
let conversation: Conversation

// BaseMessage — base class for all messages
let message: BaseMessage

// TextMessage — a text message
let textMessage: TextMessage

// MediaMessage — image, video, audio, file
let mediaMessage: MediaMessage

// CustomMessage — custom data message
let customMessage: CustomMessage
```

### Getting entities

```swift
// Get a user by UID
CometChat.getUser(UID: "user-uid") { user in
    print("User: \(user?.name ?? "")")
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}

// Get a group by GUID
CometChat.getGroup(GUID: "group-guid") { group in
    print("Group: \(group?.name ?? "")")
} onError: { error in
    print("Error: \(error?.errorDescription ?? "")")
}
```

---

## 10. Package Dependencies

Every CometChat iOS integration requires:

```ruby
# Podfile
pod 'CometChatUIKitSwift', '~> 5.1'
```

This automatically includes:
- `CometChatSDK` — Core SDK with types and methods
- UI components and views
- Localization resources
- Asset bundles

### Optional: Calling SDK

For voice/video calls, add:

```ruby
pod 'CometChatCallsSDK', '~> 5.0'   # requires iOS 16+ deployment target
```

The UI Kit automatically detects and enables calling features when the Calls SDK is present.

## Visual Builder integration

When the dispatcher's Step 3.1 sets `customize=visual` and the platform resolves to `ios`, skills runs **`cometchat builder export --platform ios`** — a single CLI command that downloads the canonical static template ZIP from `preview.cometchat.com/downloads/cometchat-builder-ios.zip`, fetches the per-builder settings JSON, applies F3 + F10 missing-field defaults, and writes 3 files to `--output` (default: `CometChat/`):

- `MessagesVC.swift` — verbatim view controller composing header + list + composer
- `ThreadedMessagesVC.swift` — verbatim helper VC (imported by MessagesVC)
- `cometchat-builder-settings.json` — **envelope-shape JSON** `{ builderId, settings: {...} }` (the iOS canonical has no top-level `name`; `CometChatBuilderSettings.loadFromJSON()` reads only `settings.*`) (no sentinel — JSON forbids `//` comments)

> ℹ️ **Version-history note (ENG-35337) — RESOLVED end-to-end; `pod 'CometChatBuilder'` (1.1.2) builds AND launches.** A freshly-exported iOS builder ZIP was built end-to-end (`pod 'CometChatBuilder'` unversioned → resolves 1.1.2, with CometChatUIKitSwift 5.1.13 / CometChatSDK 4.1.3 / CometChatCallsSDK 5.0.0) → **`BUILD SUCCEEDED`**, then **installed + launched clean on a physical iPhone** (verified 2026-06-17 — the earlier sim-only `EXCLUDED_ARCHS` quirk was an environment issue, not a project defect). The current `ThreadedMessagesVC.swift` no longer reads `CometChatBuilderSettings.shared.layout.compactMessageComposer` (grep-confirmed absent), so the older compile failure is gone — do NOT pin `> 1.1.2` (a `1.1.3` may not exist; pinning it would break `pod install`). **Only if** you have an OLDER export whose `ThreadedMessagesVC.swift` still references `.layout.compactMessageComposer` and you hit `"value of type 'Layout' has no member 'compactMessageComposer'"`, re-export from the dashboard (preferred) or pin a newer `CometChatBuilder` if one is published.

### 1. Run `cometchat builder export`

```bash
cometchat builder export --platform ios --json
```

Defaults to `--output CometChat/`. Adjust the output if the customer's project uses a different chat-surface group name (e.g. `--output Chat/` for projects that use a `Chat` group).

`CometChatBuilderSettings.loadFromJSON()` looks for the envelope shape — handing it the raw settings blob causes `CometChatBuilderSettings.shared` to fall back to defaults silently (no error logged). The CLI always writes the envelope, so this trap is closed.

Resync = re-run the same command with `--force`. See `cometchat-core` §11.6 for the resync contract.

### 2. Files skills writes (after `builder export`)

| Path | Content |
|---|---|
| `CometChat/CometChatApp.swift` | **Optional, SwiftUI-host only.** Skills-authored convenience wrapper that mounts `CometChatConversations` + pushes `MessagesVC` on tap. Feature flags read from `CometChatBuilderSettings.shared`. Skills emits this — not from the ZIP. The canonical (reference-app) entry is the UIKit SceneDelegate → `FrameworkManager` → `HomeScreenViewController` path, not this wrapper. |

### Files patched

| Path | Patch |
|---|---|
| `Podfile` | Add `pod 'CometChatBuilder', '> 1.1.2'` (the canonical pod surfacing `CometChatBuilderSettings.shared` + `loadFromJSON()`; **pin `> 1.1.2`** — ≤1.1.2 lacks `Layout.compactMessageComposer` and fails to compile, see the build-breaker caveat above). Add `pod 'CometChatUIKitSwift', '~> 5.1'` if not already declared. SPM equivalent: `.package(url: "https://github.com/cometchat/cometchat-builder-ios", from: "1.1.3")` |
| `SceneDelegate.swift` (UIKit — canonical) / `App.swift` (SwiftUI — alternative) | Add `CometChatBuilderSettings.loadFromJSON()` + theme application + `CometChatUIKit.init(uiKitSettings:)`. **For scene-based apps (the reference app and any project with a `SceneDelegate`), init in `scene(_:willConnectTo:)` — NOT in `AppDelegate.didFinishLaunchingWithOptions`** (that runs before the scene/window exists). See init code below |
| App target | Toggle `cometchat-builder-settings.json` for **target membership** in Xcode (else `loadFromJSON()` silently returns defaults) |
| Entry view — root `UIViewController` (UIKit) / `ContentView.swift` (SwiftUI) | Mount the chat surface per Step 3c placement (modal sheet, push-navigation destination, tab item, or embedded view) |
| `Info.plist` | `NSMicrophoneUsageDescription` + `NSCameraUsageDescription` if `CometChatBuilderSettings.shared.callFeatures` has any enabled feature |

### Init code — SceneDelegate (canonical)

The reference app (`CometChatBuilderSwift`) is **pure UIKit, scene-based**: `@main AppDelegate` does nothing but vend the scene configuration, and `SceneDelegate.scene(_:willConnectTo:)` calls into a `FrameworkManager.initialize(with:completion:)` helper that loads settings → applies theme → inits the kit. Mirror that — do **not** init in `AppDelegate.didFinishLaunchingWithOptions` for a scene-based app (the window/scene doesn't exist yet there).

```swift
// SceneDelegate.swift
import UIKit
import CometChatBuilder

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard (scene as? UIWindowScene) != nil else { return }
        FrameworkManager.initialize(with: scene) {
            print("Framework initialized ✅")
        }
    }
}
```

```swift
// FrameworkManager.swift — load settings → applyTheme → init kit
import UIKit
import CometChatUIKitSwift
import CometChatSDK
import CometChatBuilder

enum FrameworkManager {
    static func initialize(with scene: UIScene, completion: @escaping () -> Void) {
        // 1. Load builder settings from bundled JSON
        CometChatBuilderSettings.loadFromJSON()

        // 2. Apply builder theme tokens to the kit's global theme
        applyTheme()

        // 3. Standard UI Kit init (this file's §2 — credentials from Secrets.swift)
        let settings = UIKitSettings()
            .set(appID: Secrets.appID)
            .set(authKey: Secrets.authKey)
            .set(region: Secrets.region)
            .subscribePresenceForAllUsers()
            .build()
        CometChatUIKit.init(uiKitSettings: settings) { _ in
            // set the root view controller on `scene` here, then:
            completion()
        }
    }

    static func applyTheme() {
        let color = CometChatBuilderSettings.shared.style.color
        CometChatTheme.primaryColor = UIColor.dynamicColor(
            lightModeColor: UIColor(hex: color.brandColor),
            darkModeColor: UIColor(hex: color.brandColor)
        )
        CometChatTheme.textColorPrimary = UIColor.dynamicColor(
            lightModeColor: UIColor(hex: color.primaryTextLight),
            darkModeColor: UIColor(hex: color.primaryTextDark)
        )
        CometChatTheme.textColorSecondary = UIColor.dynamicColor(
            lightModeColor: UIColor(hex: color.secondaryTextLight),
            darkModeColor: UIColor(hex: color.secondaryTextDark)
        )
        // ⚠️ Map the builder's raw font label to a registered PostScript name
        // BEFORE handing it to setFont — passing the raw value (e.g. "Roboto")
        // does NOT resolve to a real font and silently falls back to the system font.
        let rawFont = CometChatBuilderSettings.shared.style.typography.font
        CometChatTypography.setFont(name: fontName(rawFont) ?? "")
    }

    /// Resolves a builder font label to its registered PostScript name.
    /// (Verbatim from the reference app's FrameworkManager.fontName.)
    static func fontName(_ name: String) -> String? {
        switch name.lowercased() {
        case "times new roman": return "TimesNewRomanPSMT"
        case "arial":           return "ArialMT"
        case "roboto":          return "Roboto-Regular"
        case "inter":           return "Inter-Regular"
        default:                return "\(name.capitalized)-Regular"
        }
    }
}
```

> **Font trap (D4).** `style.typography.font` in the builder JSON is a human label like `"Roboto"` or `"Arial"` — **not** a PostScript font name. Passing it straight to `CometChatTypography.setFont(name:)` (e.g. `setFont(name: settings.style.typography.font)`) silently fails to load the font. Always route it through the `fontName(_:)` lookup above (or otherwise resolve to a registered PostScript name, and register any custom `.ttf`/`.otf` in `Info.plist` under `UIAppFonts`).

`loadFromJSON()` reads `cometchat-builder-settings.json` from the main bundle. If the file isn't a target member (Xcode → file inspector → Target Membership), `CometChatBuilderSettings.shared` silently falls back to defaults — this is the #1 integration bug. Sanity-check by printing `CometChatBuilderSettings.shared.style.color.brandColor` after `loadFromJSON()`.

### The wrapper template (SwiftUI convenience — optional)

`CometChatApp.swift` below is a **skills-authored convenience wrapper** for teams who want to mount the chat surface inside a SwiftUI hierarchy. It is **not** the canonical entry point — the reference app is pure UIKit and routes from `SceneDelegate` → `FrameworkManager` → `HomeScreenViewController` (a `UITabBarController`). For UIKit projects, prefer the SceneDelegate path above and mount `CometChatConversations()` / `HomeScreenViewController` directly; use this SwiftUI wrapper only when the host app is SwiftUI.

```swift
// CometChat/CometChatApp.swift  — skills-authored SwiftUI convenience wrapper (NOT the canonical app)
import SwiftUI
import UIKit
import CometChatBuilder
import CometChatUIKitSwift
import CometChatSDK

/// SwiftUI convenience wrapper around the chat surface (skills-authored, not from the ZIP).
/// Master/detail SwiftUI host: `CometChatConversations` at root, `MessagesVC` pushed on tap.
/// Feature visibility flags are read from `CometChatBuilderSettings.shared`.
public struct CometChatApp: View {
    public init() {}
    public var body: some View {
        ConversationsContainer().ignoresSafeArea()
    }
}

private struct ConversationsContainer: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UINavigationController {
        let conversationsVC = CometChatConversations()
        let core = CometChatBuilderSettings.shared.chatFeatures.coreMessagingExperience
        conversationsVC.hideUserStatus = !core.userAndFriendsPresence
        conversationsVC.hideReceipts = !core.messageDeliveryAndReadReceipts

        let nav = UINavigationController(rootViewController: conversationsVC)
        conversationsVC.set(onItemClick: { [weak nav] conversation, _ in
            let vc = MessagesVC()
            // Qualify with CometChatSDK. — this file imports SwiftUI, which also
            // exports a `Group` type, so a bare `Group` is "ambiguous for type lookup"
            // and won't compile. (User is unambiguous but qualified here for parity.)
            if let user = conversation.conversationWith as? CometChatSDK.User { vc.user = user }
            else if let group = conversation.conversationWith as? CometChatSDK.Group { vc.group = group }
            nav?.pushViewController(vc, animated: true)
        })
        return nav
    }
    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}
}

private extension UIColor {
    convenience init?(hex: String) {
        let s = hex.replacingOccurrences(of: "#", with: "")
        guard s.count == 6, let rgb = UInt32(s, radix: 16) else { return nil }
        self.init(red: CGFloat((rgb >> 16) & 0xFF) / 255,
                  green: CGFloat((rgb >> 8) & 0xFF) / 255,
                  blue: CGFloat(rgb & 0xFF) / 255,
                  alpha: 1)
    }
    static func dynamicColor(lightModeColor: UIColor?, darkModeColor: UIColor?) -> UIColor {
        UIColor { traits in
            (traits.userInterfaceStyle == .dark ? darkModeColor : lightModeColor) ?? UIColor.label
        }
    }
}
```

`MessagesVC.swift` is **copied verbatim** from `CometChatBuilderSwift/BuilderApp/View Controllers/CometChat Components/MessagesVC.swift` (inside the Ios Visual Builder ZIP at https://preview.cometchat.com/downloads/cometchat-builder-ios.zip). It composes header + list + composer in a `UIViewController` and wires reaction / thread / typing per `CometChatBuilderSettings.shared.chatFeatures.*`. Do not hand-roll this — the canonical file is the reference.

`Secrets.swift` is the credentials enum (`enum Secrets { static let appID = "..."; static let region = "..."; static let authKey = "..." }`) populated by Step 2c provision. Added to `.gitignore`. (Note: this is the convention for integrating into the user's OWN app. The dashboard-exported **reference builder app** instead ships `AppConstants.swift` — a `public class AppConstants` with mutable `APP_ID`/`AUTH_KEY`/`REGION` statics persisted to `UserDefaults` + a `ChangeAppCredentialsVC` for runtime entry; verified 2026-06-14 against a real exported ZIP. If you're editing the exported app directly, set creds in `AppConstants.swift`.)

**UIKit (canonical) vs SwiftUI hosts.** The reference app is **pure UIKit**: `FrameworkManager.setRootViewController(...)` (called from the init `completion:` above) sets either `UINavigationController(rootViewController: HomeScreenViewController())` or a `SplitViewController` on iPad — see `CometChatBuilderSwift/BuilderApp/SceneDelegate.swift` + `FrameworkManager.swift` + `View Controllers/HomeScreenViewController.swift` (inside the Ios Visual Builder ZIP at https://preview.cometchat.com/downloads/cometchat-builder-ios.zip). The `CometChatApp` SwiftUI wrapper above is the alternative for SwiftUI-hosted apps; it wraps the same `CometChatConversations` surface in a `UIViewControllerRepresentable`.

### Calls + builder

If `CometChatBuilderSettings.shared.callFeatures` has any enabled feature:
1. Init Calls SDK at the same site as UI Kit (see `cometchat-ios-calls`)
2. Mount `CometChatIncomingCall` at app root (SwiftUI App's `WindowGroup` root, or UIKit's `keyWindow.rootViewController` overlay — the builder repo's `BuilderApplication`-equivalent pattern in `SceneDelegate.swift` is the reference)
3. PushKit + CallKit wiring — defer to `cometchat-ios-push`

### What is NOT honored in v1

The builder repo's `HomeScreenViewController` is a `UITabBarController` with up to 4 tabs (Chats / Calls / Users / Groups) driven by `CometChatBuilderSettings.shared.layout.tabs`. Skills' thin wrapper emits a single conversations surface, not the tabbed shape. Theme color + typography + chat-feature toggles ARE honored. To get the tabbed shape, copy `HomeScreenViewController.swift` from the builder repo instead of the wrapper template above.
