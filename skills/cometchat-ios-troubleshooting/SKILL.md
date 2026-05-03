---
name: cometchat-ios-troubleshooting
description: "Diagnose and fix common CometChat iOS integration issues — build errors, runtime errors, and debugging techniques."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; iOS 13+"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios troubleshooting debugging errors fixes"
---

## Purpose

This skill helps diagnose and fix common issues when integrating CometChat iOS UI Kit. It covers build errors, runtime errors, and debugging techniques.

---

## 1. Build Errors

### "No such module 'CometChatUIKitSwift'"

**Cause:** SDK not installed or not linked properly.

**Solutions:**

**CocoaPods:**
```bash
# Clean and reinstall
cd /path/to/your/project
rm -rf Pods Podfile.lock
pod install --repo-update

# Open workspace (not project!)
open YourApp.xcworkspace
```

**Swift Package Manager:**
1. In Xcode, go to File → Packages → Reset Package Caches
2. File → Packages → Resolve Package Versions
3. Clean build folder: Cmd + Shift + K
4. Build again

**Check Podfile:**
```ruby
platform :ios, '13.0'
use_frameworks!

target 'YourApp' do
  pod 'CometChatUIKitSwift', '~> 5.1'
end
```

---

### "No such module 'CometChatSDK'"

**Cause:** Core SDK not installed alongside UI Kit.

**Solution:** The UI Kit should include the SDK automatically. If not:

```ruby
# Podfile
pod 'CometChatUIKitSwift', '~> 5.1'
pod 'CometChatSDK', '~> 4.0'  # Add explicitly if needed
```

---

### "No such module 'CometChatCallsSDK'"

**Cause:** Calls SDK not installed but code references it.

**Solutions:**

1. **If you need calls:**
```ruby
# Podfile
pod 'CometChatCallsSDK', '~> 4.0'
```

2. **If you don't need calls:**
Wrap call-related code in conditional compilation:
```swift
#if canImport(CometChatCallsSDK)
import CometChatCallsSDK
// Call-related code here
#endif
```

---

### "Value of type 'CometChatException' has no member 'localizedDescription'"

**Cause:** Using wrong property for error description.

**Solution:** Use `errorDescription` instead of `localizedDescription`:

```swift
case .onError(let error):
    print(error.errorDescription)
    print(error.errorCode)
```

`CometChatException` has:
- `errorDescription` — human-readable error message
- `errorCode` — error code string
- `details` — optional dictionary with additional info

---

### "'CometChatException' is not convertible to 'any Error'"

**Cause:** Trying to use `CometChatException` with Swift's `Result<T, Error>` type.

**Solution:** `CometChatException` does NOT conform to Swift's `Error` protocol. Don't use `Result<T, Error>` with CometChat callbacks. Instead, use direct callbacks:

```swift
// ❌ WRONG - Don't use Result<T, Error>
func login(completion: @escaping (Result<User, Error>) -> Void) {
    CometChatUIKit.login(uid: uid) { result in
        switch result {
        case .success(let user):
            completion(.success(user))
        case .onError(let error):
            completion(.failure(error))  // ERROR: CometChatException is not Error
        }
    }
}

// ✅ CORRECT - Use CometChatException directly
func login(completion: @escaping (User?, CometChatException?) -> Void) {
    CometChatUIKit.login(uid: uid) { result in
        switch result {
        case .success(let user):
            completion(user, nil)
        case .onError(let error):
            completion(nil, error)
        @unknown default:
            completion(nil, nil)
        }
    }
}
```

---

### "Cannot find 'CometChatConversationsWithMessages' in scope" or "Cannot find 'CometChatMessages' in scope"

**Cause:** Neither class exists in the kit. They look like "pre-built composite UIViewControllers" but are NOT exported from `CometChatUIKitSwift`. Older docs and AI-generated guides sometimes claim they exist.

**Solution:** Compose your own `MessagesVC` from the real building blocks (`CometChatMessageHeader` + `CometChatMessageList` + `CometChatMessageComposer`). The pattern is the same one the kit's sample app uses (`SampleApp/View Controllers/CometChat Components/MessagesVC.swift`).

```swift
import CometChatUIKitSwift
import CometChatSDK

let conversations = CometChatConversations()
let navController = UINavigationController(rootViewController: conversations)

conversations.set(onItemClick: { [weak navController] conversation, _ in
    let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer
    if let group = conversation.conversationWith as? Group {
        messagesVC.set(group: group)
    } else if let user = conversation.conversationWith as? User {
        messagesVC.set(user: user)
    }
    navController?.pushViewController(messagesVC, animated: true)
})
```

See `cometchat-ios-components` § 13 ("Custom MessagesVC Implementation") for the full `MessagesVC` source.

---

### "Cannot find 'CometChatCallLogs' in scope"

**Cause:** `CometChatCallLogs` requires `CometChatCallsSDK` which is not installed.

**Solutions:**

1. **Install the Calls SDK:**
```ruby
# Podfile
pod 'CometChatCallsSDK', '~> 4.0'
```

2. **Or wrap in conditional compilation:**
```swift
#if canImport(CometChatCallsSDK)
let callLogs = CometChatCallLogs()
#else
// Show placeholder or hide calls tab
#endif
```

---

### "Duplicate symbols" or "Multiple commands produce"

**Cause:** Conflicting dependencies or duplicate frameworks.

**Solutions:**

1. **Clean derived data:**
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```

2. **Check for duplicate pods:**
```bash
pod deintegrate
pod install
```

3. **Check Build Phases:**
   - Go to Target → Build Phases → Link Binary With Libraries
   - Remove any duplicate frameworks

---

### "The iOS deployment target is set to X.X, but the range of supported deployment target versions is Y.Y to Z.Z"

**Cause:** Minimum iOS version mismatch.

**Solution:**

1. Update your project's deployment target to iOS 13.0 or higher
2. Update Podfile:
```ruby
platform :ios, '13.0'
```

3. Run:
```bash
pod install
```

---

### "Sandbox: rsync.samba denied"

**Cause:** Xcode sandbox permission issue (common in Xcode 15+).

**Solution:**

1. Disable User Script Sandboxing in Build Settings:
   - Select your app target
   - Go to Build Settings
   - Search for "User Script Sandboxing"
   - Set **ENABLE_USER_SCRIPT_SANDBOXING** to **No**

2. Or add to your `Podfile`:
```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
end
```

3. Then run:
```bash
pod install
```

4. Clean and rebuild:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```

---

### "Framework not found" during archive

**Cause:** Framework search paths issue.

**Solution:**

1. Go to Target → Build Settings
2. Search for "Framework Search Paths"
3. Add: `$(inherited)` and `$(PROJECT_DIR)/Pods`
4. Set "Build Active Architecture Only" to No for Release

---

## 2. Runtime Errors

### "CometChat is not initialized"

**Cause:** Trying to use CometChat before initialization completes.

**Solution:**

```swift
// ❌ Wrong - using before init completes
CometChatUIKit(uiKitSettings: settings) { _ in }
let conversations = CometChatConversations()  // Too early!

// ✅ Correct - wait for completion
CometChatUIKit(uiKitSettings: settings) { result in
    switch result {
    case .success:
        DispatchQueue.main.async {
            let conversations = CometChatConversations()
            // Now safe to use
        }
    case .failure(let error):
        print("Init failed: \(error)")
    }
}
```

---

### "Invalid App ID" or "App not found"

**Cause:** Wrong App ID or region.

**Solutions:**

1. Verify App ID in CometChat Dashboard
2. Check region matches (us, eu, or in)
3. Ensure no extra spaces in credentials

```swift
let uiKitSettings = UIKitSettings()
    .set(appID: "YOUR_APP_ID")  // No spaces!
    .set(region: "us")           // Lowercase
    .build()
```

---

### "Invalid Auth Key"

**Cause:** Wrong or expired Auth Key.

**Solutions:**

1. Get fresh Auth Key from Dashboard → API & Auth Keys
2. Use the correct key type (Auth Key, not REST API Key)
3. Check for copy/paste errors

---

### "User not found" or "UID not found"

**Cause:** Trying to login with a UID that doesn't exist.

**Solutions:**

1. **Use pre-created test users:**
   - `cometchat-uid-1` through `cometchat-uid-5`

2. **Create user first:**
```swift
let user = User(uid: "new-user-123", name: "John Doe")
CometChatUIKit.create(user: user) { result in
    switch result {
    case .success(let user):
        // Now login
        CometChatUIKit.login(uid: user.uid ?? "") { _ in }
    case .onError(let error):
        print("Create failed: \(error)")
    }
}
```

---

### "Already logged in"

**Cause:** Calling login when user is already logged in.

**Solution:**

```swift
// Check for existing session first
if let currentUser = CometChatUIKit.getLoggedInUser() {
    print("Already logged in as: \(currentUser.name ?? "")")
    // Proceed to chat UI
} else {
    // Login
    CometChatUIKit.login(uid: "user-123") { _ in }
}
```

---

### Blank/Empty Conversation List

**Cause:** No conversations exist for the logged-in user.

**Solutions:**

1. **Send a test message:**
   - Go to CometChat Dashboard → Users
   - Select another user
   - Send a message to your logged-in user

2. **Check user is logged in:**
```swift
if let user = CometChatUIKit.getLoggedInUser() {
    print("Logged in as: \(user.uid ?? "")")
} else {
    print("Not logged in!")
}
```

3. **Check for errors:**
```swift
let conversations = CometChatConversations()
conversations.onError = { error in
    print("Error loading conversations: \(error.errorDescription ?? "")")
}
conversations.onEmpty = {
    print("No conversations found")
}
```

---

### Messages Not Sending

**Cause:** Various issues with message sending.

**Solutions:**

1. **Check user/group is set:**
```swift
let composer = CometChatMessageComposer()
composer.set(user: user)  // Must be set!
```

2. **Check for errors:**
```swift
composer.onError = { error in
    print("Composer error: \(error.errorDescription ?? "")")
}
```

3. **Verify network connection:**
```swift
import Network

let monitor = NWPathMonitor()
monitor.pathUpdateHandler = { path in
    if path.status == .satisfied {
        print("Connected")
    } else {
        print("No connection")
    }
}
monitor.start(queue: DispatchQueue.global())
```

---

### Push Notifications Not Working

**Cause:** Multiple possible issues.

**Checklist:**

1. **Physical device?** Push doesn't work on simulator

2. **Permissions granted?**
```swift
UNUserNotificationCenter.current().getNotificationSettings { settings in
    print("Authorization status: \(settings.authorizationStatus.rawValue)")
}
```

3. **Token registered?**
```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    print("APNs Token: \(token)")
    
    // Register with CometChat
    CometChat.registerTokenForPushNotification(token: token, settings: ["voip": false]) { success in
        print("Token registered: \(success)")
    } onError: { error in
        print("Token registration failed: \(error?.errorDescription ?? "")")
    }
}
```

4. **Certificate uploaded?** Check Dashboard → Notifications → Push Notifications

5. **Correct environment?** Development vs Production certificate must match

---

### Calls Not Working

**Cause:** Missing SDK or permissions.

**Checklist:**

1. **CometChatCallsSDK installed?**
```ruby
pod 'CometChatCallsSDK', '~> 4.0'
```

2. **Permissions in Info.plist?**
```xml
<key>NSCameraUsageDescription</key>
<string>Camera access for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access for calls</string>
```

3. **Background modes enabled?**
   - Audio, AirPlay, and Picture in Picture
   - Voice over IP

4. **Testing on real device?** Calls don't work on simulator

---

### Memory Warnings / Crashes

**Cause:** Memory leaks or retain cycles.

**Solutions:**

1. **Use weak references in closures:**
```swift
conversations.onItemClick = { [weak self] conversation, _ in
    self?.openMessages(for: conversation)
}
```

2. **Remove listeners when done:**
```swift
override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    CometChatMessageEvents.removeListener("my-listener")
}
```

3. **Profile with Instruments:**
   - Product → Profile → Leaks
   - Look for CometChat-related leaks

---

### UI Not Updating

**Cause:** Updates happening on background thread.

**Solution:**

```swift
// Always update UI on main thread
CometChatUIKit.login(uid: "user-123") { result in
    DispatchQueue.main.async {
        switch result {
        case .success:
            self.showConversations()
        case .onError(let error):
            self.showError(error)
        }
    }
}
```

---

## 3. Debugging Techniques

### Enable CometChat Logging

```swift
// Add before initialization
CometChat.setLogLevel(.debug)
```

### Check Connection Status

```swift
CometChat.addConnectionListener("debug-listener", self)

extension YourClass: CometChatConnectionDelegate {
    func connected() {
        print("✅ CometChat connected")
    }
    
    func connecting() {
        print("🔄 CometChat connecting...")
    }
    
    func disconnected() {
        print("❌ CometChat disconnected")
    }
}
```

### Monitor Message Events

```swift
class DebugMessageListener: CometChatMessageDelegate {
    
    func onTextMessageReceived(textMessage: TextMessage) {
        print("📩 Text message received: \(textMessage.text ?? "")")
    }
    
    func onMediaMessageReceived(mediaMessage: MediaMessage) {
        print("📎 Media message received: \(mediaMessage.messageType)")
    }
    
    func onMessageDeleted(message: BaseMessage) {
        print("🗑 Message deleted: \(message.id)")
    }
}

CometChat.addMessageListener("debug-messages", DebugMessageListener())
```

### Network Debugging

Use Charles Proxy or Proxyman to inspect CometChat API calls:

1. Install Charles Proxy
2. Enable SSL Proxying for `*.cometchat.io`
3. Install Charles certificate on device/simulator
4. Monitor requests and responses

### Xcode Debugging

**Breakpoints:**
- Set breakpoints in CometChat callbacks
- Use symbolic breakpoints for CometChat methods

**Console:**
```swift
// Print current state
print("User: \(CometChatUIKit.getLoggedInUser()?.uid ?? "none")")
print("Initialized: \(CometChatManager.shared.isInitialized)")
```

---

## 4. Common Error Codes

| Code | Description | Solution |
|---|---|---|
| `ERR_UID_NOT_FOUND` | User doesn't exist | Create user first |
| `ERR_ALREADY_LOGGED_IN` | User already logged in | Check session before login |
| `ERR_NOT_LOGGED_IN` | No active session | Login first |
| `AUTH_ERR_AUTH_TOKEN_NOT_FOUND` | Invalid auth token | Generate new token |
| `ERR_INVALID_APP_ID` | Wrong App ID | Verify in dashboard |
| `ERR_INVALID_API_KEY` | Wrong API/Auth Key | Get correct key from dashboard |
| `ERR_BLOCKED_BY_EXTENSION` | Blocked by extension | Check extension settings |
| `ERR_RATE_LIMIT_EXCEEDED` | Too many requests | Implement rate limiting |
| `ERR_WEBSOCKET_CONNECTION_FAILED` | Connection failed | Check network, retry |

---

## 5. Performance Issues

### Slow Conversation Loading

**Solutions:**

1. **Limit initial fetch:**
```swift
let conversations = CometChatConversations()
conversations.set(conversationsRequestBuilder: ConversationsRequest.ConversationsRequestBuilder()
    .set(limit: 20)  // Reduce initial load
)
```

2. **Enable pagination:**
Conversations automatically paginate. Ensure you're not fetching all at once.

### Slow Message Loading

**Solutions:**

1. **Limit message fetch:**
```swift
let messageList = CometChatMessageList()
messageList.set(messagesRequestBuilder: MessagesRequest.MessageRequestBuilder()
    .set(uid: user.uid ?? "")
    .set(limit: 30)  // Reduce initial load
)
```

2. **Hide unnecessary features:**
```swift
messageList.hideReceipts = true  // If not needed
messageList.hideAvatar = true    // If not needed
```

### High Memory Usage

**Solutions:**

1. **Release unused view controllers:**
```swift
// Don't keep strong references to dismissed VCs
```

2. **Clear image cache if needed:**
```swift
// CometChat handles image caching internally
// But you can clear URLCache if needed
URLCache.shared.removeAllCachedResponses()
```

---

## 6. SwiftUI-Specific Issues

### View Not Updating

**Cause:** SwiftUI not detecting state changes.

**Solution:**

```swift
struct ChatView: View {
    @State private var selectedConversation: Conversation?
    
    var body: some View {
        ConversationsWrapper(selectedConversation: $selectedConversation)
            .onChange(of: selectedConversation) { newValue in
                // Handle selection
            }
    }
}

struct ConversationsWrapper: UIViewControllerRepresentable {
    @Binding var selectedConversation: Conversation?
    
    func makeUIViewController(context: Context) -> CometChatConversations {
        let vc = CometChatConversations()
        vc.onItemClick = { conversation, _ in
            selectedConversation = conversation
        }
        return vc
    }
    
    func updateUIViewController(_ uiViewController: CometChatConversations, context: Context) {
        // Handle updates if needed
    }
}
```

### Navigation Issues

**Cause:** Mixing UIKit navigation with SwiftUI.

**Solution:**

```swift
struct ChatNavigationView: View {
    @State private var path = NavigationPath()
    
    var body: some View {
        NavigationStack(path: $path) {
            ConversationsView(onSelect: { conversation in
                path.append(conversation)
            })
            .navigationDestination(for: Conversation.self) { conversation in
                MessagesView(conversation: conversation)
            }
        }
    }
}
```

---

## 7. Quick Fixes Checklist

When something isn't working:

1. [ ] **Clean build:** Cmd + Shift + K
2. [ ] **Delete derived data:** `rm -rf ~/Library/Developer/Xcode/DerivedData`
3. [ ] **Reinstall pods:** `pod deintegrate && pod install`
4. [ ] **Check credentials:** App ID, Auth Key, Region
5. [ ] **Check user exists:** Use test users or create first
6. [ ] **Check network:** Device has internet connection
7. [ ] **Check permissions:** Camera, microphone, notifications
8. [ ] **Check main thread:** UI updates on main thread
9. [ ] **Check completion handlers:** Wait for async operations
10. [ ] **Enable logging:** `CometChat.setLogLevel(.debug)`

---

## 8. Theming Errors

### "Value of type 'MessageBubbleStyle' has no member 'outgoingBackgroundColor'"

**Cause:** Incorrect property access for message bubble styles.

**Solution:** Message bubble styles use separate `.incoming` and `.outgoing` style objects, not combined properties:

```swift
// ✅ CORRECT - Use separate incoming/outgoing styles
CometChatMessageBubble.style.outgoing.backgroundColor = CometChatTheme.primaryColor
CometChatMessageBubble.style.incoming.backgroundColor = CometChatTheme.neutralColor300

// For text colors within bubbles
CometChatMessageBubble.style.outgoing.textBubbleStyle.textColor = .white
CometChatMessageBubble.style.incoming.textBubbleStyle.textColor = CometChatTheme.textColorPrimary
```

---

### "Value of type 'ConversationsStyle' has no member 'titleColor'"

**Cause:** Using incorrect property names for component styles.

**Solution:** Check the actual property names in the style struct:

```swift
// ✅ CORRECT ConversationsStyle properties
CometChatConversations.style.listItemTitleTextColor = CometChatTheme.textColorPrimary
CometChatConversations.style.listItemTitleFont = CometChatTypography.Heading4.medium
CometChatConversations.style.listItemSubTitleTextColor = CometChatTheme.textColorSecondary
CometChatConversations.style.listItemSubTitleFont = CometChatTypography.Body.regular
```

---

### "Value of type 'MessageComposerStyle' has no member 'inputBackgroundColor'"

**Cause:** Using incorrect property names for composer style.

**Solution:** Use the correct property names:

```swift
// ✅ CORRECT MessageComposerStyle properties
CometChatMessageComposer.style.composeBoxBackgroundColor = CometChatTheme.backgroundColor01
CometChatMessageComposer.style.composeBoxBorderColor = CometChatTheme.borderColorDefault
CometChatMessageComposer.style.placeHolderTextColor = CometChatTheme.textColorTertiary
CometChatMessageComposer.style.textFiledColor = CometChatTheme.textColorPrimary
CometChatMessageComposer.style.activeSendButtonImageBackgroundColor = CometChatTheme.primaryColor
```

---

### "Value of type 'BadgeStyle' has no member 'cornerRadius'" (type mismatch)

**Cause:** `BadgeStyle.cornerRadius` is `CometChatCornerStyle?`, not a simple value.

**Solution:**

```swift
// ✅ CORRECT - cornerRadius is optional CometChatCornerStyle
CometChatBadge.style.cornerRadius = CometChatCornerStyle(cornerRadius: 8)
// or nil for default pill shape
CometChatBadge.style.cornerRadius = nil
```

---

### "Cannot assign value of type 'UIColor' to type 'CGColor'"

**Cause:** `BadgeStyle.borderColor` is `CGColor`, not `UIColor`.

**Solution:**

```swift
// ✅ CORRECT - use .cgColor
CometChatBadge.style.borderColor = UIColor.clear.cgColor
CometChatBadge.style.borderColor = UIColor.white.cgColor
```

---

### Theme Changes Not Applying

**Cause:** Theme configured after UI is already displayed.

**Solution:** Configure theme before showing any CometChat UI:

```swift
// In AppDelegate or App init, BEFORE showing any CometChat views
func configureTheme() {
    CometChatTheme.primaryColor = UIColor.systemBlue
    CometChatTheme.backgroundColor01 = UIColor.systemBackground
    // ... other theme settings
}

// Call this before CometChatUIKit.init()
configureTheme()
```

---

### "Type 'CometChatSpacing' has no member 'Spacing1'" or similar

**Cause:** Using incorrect property access for spacing values.

**Solution:** `CometChatSpacing` uses nested classes, not direct properties:

```swift
// ✅ CORRECT - Use nested class syntax
CometChatSpacing.Spacing.s1 = 4
CometChatSpacing.Spacing.s2 = 8
CometChatSpacing.Padding.p1 = 4
CometChatSpacing.Padding.p2 = 8
CometChatSpacing.Radius.r1 = 4
CometChatSpacing.Radius.r2 = 8
CometChatSpacing.Radius.rMax = 1000
CometChatSpacing.Margin.m1 = 4
```

---

### "Cannot infer type of closure parameter" or "Cannot infer contextual base"

**Cause:** Missing type annotations in closures for custom views.

**Solution:** Always provide explicit type annotations for closure parameters:

```swift
import CometChatSDK

// ✅ CORRECT - Explicit type annotation
users.set(subtitle: { (user: User?) -> UIView in
    let label = UILabel()
    if user?.status == .online {
        label.text = "Online"
        label.textColor = .systemGreen
    } else {
        label.text = "Offline"
        label.textColor = .gray
    }
    return label
})
```

Note: Use `set(subtitle:)` method, not direct property assignment. The `User` type is from `CometChatSDK`.

---

### "Value of type 'CometChatUsers' has no member 'subtitleView'"

**Cause:** Using wrong property name.

**Solution:** `CometChatUsers` uses `subtitle`, not `subtitleView`:

```swift
// ✅ CORRECT
users.set(subtitle: { (user: User?) -> UIView in
    // Return custom view
})

// Different components use different names:
// - CometChatUsers: set(subtitle:)
// - CometChatConversations: set(subtitleView:)
// - CometChatMessageHeader: set(subtitleView:)
```

---

## 10. Getting Help

### CometChat Resources

- **Documentation:** https://www.cometchat.com/docs/ios-uikit
- **GitHub Issues:** https://github.com/cometchat/cometchat-uikit-ios/issues
- **Support:** https://www.cometchat.com/support

### Information to Include in Bug Reports

1. CometChatUIKitSwift version
2. iOS version
3. Xcode version
4. Device (simulator or physical)
5. Error message / stack trace
6. Steps to reproduce
7. Relevant code snippets

