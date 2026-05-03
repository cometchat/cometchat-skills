---
name: cometchat-ios-push
description: "Set up push notifications for CometChat iOS apps — APNs configuration, token registration, and notification handling."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; iOS 13+"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios push notifications apns"
---

## Purpose

This skill teaches how to set up push notifications for CometChat iOS apps, including APNs configuration, token registration, and handling incoming notifications.

---

## 1. Prerequisites

Before setting up push notifications:

1. **Apple Developer Account** — Required for APNs certificates
2. **CometChat Dashboard Access** — To configure push notification settings
3. **Physical iOS Device** — Push notifications don't work on simulators

---

## 2. APNs Certificate Setup

### Step 1: Create APNs Key (Recommended)

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles** → **Keys**
3. Click **+** to create a new key
4. Enter a name (e.g., "CometChat Push Key")
5. Enable **Apple Push Notifications service (APNs)**
6. Click **Continue** → **Register**
7. Download the `.p8` file (you can only download it once!)
8. Note the **Key ID** and your **Team ID**

### Step 2: Configure CometChat Dashboard

1. Go to [CometChat Dashboard](https://app.cometchat.com)
2. Select your app
3. Navigate to **Notifications** → **Push Notifications**
4. Select **iOS** tab
5. Upload your `.p8` file
6. Enter your **Key ID** and **Team ID**
7. Select the environment (Development/Production)
8. Save the configuration

---

## 3. Xcode Project Configuration

### Enable Push Notifications Capability

1. Open your project in Xcode
2. Select your target
3. Go to **Signing & Capabilities**
4. Click **+ Capability**
5. Add **Push Notifications**
6. Add **Background Modes** and enable:
   - Remote notifications
   - Voice over IP (if using calls)

### Update Info.plist

Add the following to your `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
    <string>voip</string>
</array>
```

---

## 4. Code Implementation

### AppDelegate Setup

```swift
import UIKit
import UserNotifications
import CometChatUIKitSwift
import CometChatSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        // Initialize CometChat
        initializeCometChat()
        
        // Request notification permissions
        requestNotificationPermission()
        
        // Register for remote notifications
        application.registerForRemoteNotifications()
        
        return true
    }
    
    private func initializeCometChat() {
        let uiKitSettings = UIKitSettings()
            .set(appID: "YOUR_APP_ID")
            .set(authKey: "YOUR_AUTH_KEY")
            .set(region: "us")
            .subscribePresenceForAllUsers()
            .build()
        
        CometChatUIKit(uiKitSettings: uiKitSettings) { result in
            switch result {
            case .success:
                print("CometChat initialized")
            case .failure(let error):
                print("CometChat init failed: \(error)")
            }
        }
    }
    
    private func requestNotificationPermission() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("Notification permission granted")
            } else if let error = error {
                print("Notification permission error: \(error)")
            }
        }
    }
    
    // MARK: - Remote Notification Registration
    
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("APNs Device Token: \(token)")
        
        // Register token with CometChat
        registerPushToken(token)
    }
    
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Failed to register for remote notifications: \(error)")
    }
    
    private func registerPushToken(_ token: String) {
        CometChat.registerTokenForPushNotification(
            token: token,
            settings: ["voip": false]
        ) { success in
            print("Push token registered: \(success)")
        } onError: { error in
            print("Push token registration failed: \(error?.errorDescription ?? "")")
        }
    }
    
    // MARK: - Handle Incoming Notifications
    
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        print("Received remote notification: \(userInfo)")
        
        // Handle CometChat notification
        if let messageData = userInfo["message"] as? [String: Any] {
            handleCometChatNotification(messageData)
        }
        
        completionHandler(.newData)
    }
    
    private func handleCometChatNotification(_ data: [String: Any]) {
        // Parse notification data
        guard let type = data["type"] as? String else { return }
        
        switch type {
        case "chat":
            handleChatNotification(data)
        case "call":
            handleCallNotification(data)
        default:
            print("Unknown notification type: \(type)")
        }
    }
    
    private func handleChatNotification(_ data: [String: Any]) {
        // Extract sender info
        guard let senderUID = data["sender"] as? String else { return }
        
        // Navigate to conversation
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .openConversation,
                object: nil,
                userInfo: ["uid": senderUID]
            )
        }
    }
    
    private func handleCallNotification(_ data: [String: Any]) {
        // Handle incoming call notification
        print("Incoming call notification")
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate: UNUserNotificationCenterDelegate {
    
    // Handle notification when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
    
    // Handle notification tap
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        
        if let messageData = userInfo["message"] as? [String: Any] {
            handleCometChatNotification(messageData)
        }
        
        completionHandler()
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let openConversation = Notification.Name("openConversation")
}
```

### Handle Notification Navigation

```swift
class MainViewController: UIViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Listen for notification navigation
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleOpenConversation(_:)),
            name: .openConversation,
            object: nil
        )
    }
    
    @objc private func handleOpenConversation(_ notification: Notification) {
        guard let uid = notification.userInfo?["uid"] as? String else { return }
        
        // Fetch user and open conversation
        CometChat.getUser(UID: uid) { [weak self] user in
            guard let user = user else { return }
            
            DispatchQueue.main.async {
                let messagesVC = MessagesVC()  // your own VC composing CometChatMessageHeader + List + Composer
                messagesVC.set(user: user)
                self?.navigationController?.pushViewController(messagesVC, animated: true)
            }
        } onError: { error in
            print("Error fetching user: \(error?.errorDescription ?? "")")
        }
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
```

---

## 5. VoIP Push Notifications (for Calls)

### Import PushKit

```swift
import PushKit
```

### Register for VoIP

```swift
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var voipRegistry: PKPushRegistry?
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        // ... other setup ...
        
        // Register for VoIP push
        registerForVoIPPush()
        
        return true
    }
    
    private func registerForVoIPPush() {
        voipRegistry = PKPushRegistry(queue: .main)
        voipRegistry?.delegate = self
        voipRegistry?.desiredPushTypes = [.voIP]
    }
}

// MARK: - PKPushRegistryDelegate

extension AppDelegate: PKPushRegistryDelegate {
    
    func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        let token = pushCredentials.token.map { String(format: "%02.2hhx", $0) }.joined()
        print("VoIP Token: \(token)")
        
        // Register VoIP token with CometChat
        CometChat.registerTokenForPushNotification(
            token: token,
            settings: ["voip": true]
        ) { success in
            print("VoIP token registered: \(success)")
        } onError: { error in
            print("VoIP token registration failed: \(error?.errorDescription ?? "")")
        }
    }
    
    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        print("Received VoIP push: \(payload.dictionaryPayload)")
        
        // Handle incoming call
        if let callData = payload.dictionaryPayload["call"] as? [String: Any] {
            handleIncomingCall(callData)
        }
        
        completion()
    }
    
    private func handleIncomingCall(_ data: [String: Any]) {
        // Show incoming call UI
        // This should use CallKit for proper iOS call handling
    }
}
```

---

## 6. UIKitSettings with Push Tokens

You can also pass tokens during initialization:

```swift
let uiKitSettings = UIKitSettings()
    .set(appID: "YOUR_APP_ID")
    .set(authKey: "YOUR_AUTH_KEY")
    .set(region: "us")
    .set(deviceToken: apnsToken)      // APNs token
    .set(voipToken: voipToken)        // VoIP token
    .subscribePresenceForAllUsers()
    .build()

CometChatUIKit(uiKitSettings: uiKitSettings) { result in
    // ...
}
```

---

## 7. Notification Service Extension

For rich notifications with images and custom content:

### Create Extension

1. In Xcode, go to **File** → **New** → **Target**
2. Select **Notification Service Extension**
3. Name it (e.g., "NotificationService")

### Implement Extension

```swift
// NotificationService.swift
import UserNotifications

class NotificationService: UNNotificationServiceExtension {
    
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
    
    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }
        
        // Customize notification content
        if let messageData = request.content.userInfo["message"] as? [String: Any] {
            customizeNotification(bestAttemptContent, with: messageData)
        }
        
        contentHandler(bestAttemptContent)
    }
    
    private func customizeNotification(
        _ content: UNMutableNotificationContent,
        with data: [String: Any]
    ) {
        // Set title from sender name
        if let senderName = data["senderName"] as? String {
            content.title = senderName
        }
        
        // Set body from message
        if let messageText = data["text"] as? String {
            content.body = messageText
        }
        
        // Add image attachment if available
        if let imageURL = data["imageURL"] as? String,
           let url = URL(string: imageURL) {
            downloadAndAttachImage(url, to: content)
        }
    }
    
    private func downloadAndAttachImage(_ url: URL, to content: UNMutableNotificationContent) {
        let task = URLSession.shared.downloadTask(with: url) { localURL, _, error in
            guard let localURL = localURL, error == nil else { return }
            
            let tempDir = FileManager.default.temporaryDirectory
            let tempFile = tempDir.appendingPathComponent(UUID().uuidString + ".jpg")
            
            try? FileManager.default.moveItem(at: localURL, to: tempFile)
            
            if let attachment = try? UNNotificationAttachment(identifier: "image", url: tempFile) {
                content.attachments = [attachment]
            }
            
            self.contentHandler?(content)
        }
        task.resume()
    }
    
    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
}
```

---

## 8. Badge Count Management

### Update Badge Count

```swift
// Set badge count
UIApplication.shared.applicationIconBadgeNumber = unreadCount

// Clear badge count
UIApplication.shared.applicationIconBadgeNumber = 0
```

### Sync with CometChat Unread Count

```swift
func updateBadgeCount() {
    CometChat.getUnreadMessageCount { userUnread, groupUnread in
        var totalUnread = 0
        
        for (_, count) in userUnread {
            totalUnread += count as? Int ?? 0
        }
        
        for (_, count) in groupUnread {
            totalUnread += count as? Int ?? 0
        }
        
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = totalUnread
        }
    } onError: { error in
        print("Error getting unread count: \(error?.errorDescription ?? "")")
    }
}
```

---

## 9. Testing Push Notifications

### Using Terminal

```bash
# Test APNs push (requires authentication)
curl -v \
  --header "apns-topic: com.yourapp.bundleid" \
  --header "apns-push-type: alert" \
  --header "authorization: bearer $JWT_TOKEN" \
  --data '{"aps":{"alert":"Test message"}}' \
  --http2 \
  https://api.push.apple.com/3/device/$DEVICE_TOKEN
```

### Using CometChat Dashboard

1. Go to CometChat Dashboard
2. Navigate to **Users**
3. Select a user
4. Click **Send Push Notification**
5. Enter a test message
6. Send

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Token not registering | Ensure device is physical, not simulator |
| Notifications not received | Check APNs certificate in dashboard |
| Badge not updating | Check notification permissions |
| VoIP not working | Ensure VoIP capability is enabled |
| Notifications delayed | Check APNs environment (dev vs prod) |

---

## Best Practices

1. **Always request permission** before registering for notifications
2. **Handle token refresh** — tokens can change
3. **Test on real devices** — simulators don't support push
4. **Use Notification Service Extension** for rich notifications
5. **Implement proper deep linking** for notification taps
6. **Clear badge count** when user opens the app
7. **Handle both foreground and background** notifications
