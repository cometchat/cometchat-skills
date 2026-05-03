---
name: cometchat-ios-core
description: "Shared rules for CometChat iOS UI Kit v5. Always loaded alongside placement skills. Read this first."
license: "MIT"
compatibility: "iOS 13+; Swift 5.0+; CometChatUIKitSwift ^5; CometChatSDK ^4"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios swift core rules initialization patterns"
---

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
https://github.com/cometchat/cometchat-calls-sdk-ios
```

Or add to `Package.swift`:
```swift
dependencies: [
    .package(url: "https://github.com/cometchat/cometchat-uikit-ios", from: "5.0.0"),
    // Optional: Add calls SDK for voice/video
    // .package(url: "https://github.com/cometchat/cometchat-calls-sdk-ios", from: "4.0.0")
]
```

### GitHub Repositories

| Package | Repository | Description |
|---------|------------|-------------|
| UI Kit | https://github.com/cometchat/cometchat-uikit-ios | Ready-to-use UI components |
| Chat SDK | https://github.com/cometchat/chat-sdk-ios | Core messaging SDK |
| Calls SDK | https://github.com/cometchat/cometchat-calls-sdk-ios | Voice & video calling |
| Sample App | https://github.com/cometchat/cometchat-sample-app-ios | Sample implementation |

---

## 2. Initialization

CometChat must be initialized exactly once before any UI component is used. Initialization is asynchronous and must complete fully before mounting any `CometChat*` view controller.

### UIKitSettings Builder

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
error.details          // [String: Any]? - additional details
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

// Avatar style — cornerRadius is a CGFloat on a CometChatCornerStyle,
// NOT a `.circle` enum case. Use a value larger than half the avatar
// dimension for a circular look.
CometChatAvatar.style.backgroundColor = .systemGray5
CometChatAvatar.style.cornerRadius = CometChatCornerStyle(cornerRadius: 100)
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
pod 'CometChatCallsSDK', '~> 4.0'
```

The UI Kit automatically detects and enables calling features when the Calls SDK is present.
