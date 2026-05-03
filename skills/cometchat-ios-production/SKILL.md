---
name: cometchat-ios-production
description: "Production-ready CometChat iOS setup — server-side auth tokens, security best practices, and deployment checklist."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; iOS 13+"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios production auth tokens security deployment"
---

## Purpose

This skill teaches how to prepare your CometChat iOS integration for production. It covers replacing development Auth Keys with server-side auth tokens, security best practices, and a deployment checklist.

---

## 1. Development vs Production Authentication

### Development Mode (Auth Key)

In development, you use the Auth Key directly in your app:

```swift
// ⚠️ DEVELOPMENT ONLY — Never ship this to production
CometChatUIKit.login(uid: "user-123") { result in
    // ...
}
```

**Problems with Auth Key in production:**
- Auth Key is embedded in your app binary
- Anyone can decompile your app and extract it
- Attackers can impersonate any user
- No server-side validation of user identity

### Production Mode (Auth Token)

In production, your server generates short-lived auth tokens:

```
┌─────────────┐     1. Login      ┌─────────────┐
│   iOS App   │ ───────────────► │ Your Server │
└─────────────┘                   └─────────────┘
       │                                │
       │                                │ 2. Verify user
       │                                │    Generate token
       │                                ▼
       │                         ┌─────────────┐
       │                         │  CometChat  │
       │                         │    API      │
       │                         └─────────────┘
       │                                │
       │     3. Return auth token       │
       │ ◄──────────────────────────────┘
       │
       │ 4. Login with token
       ▼
┌─────────────┐
│  CometChat  │
│     SDK     │
└─────────────┘
```

---

## 2. Server-Side Token Generation

### Your Server Endpoint

Create an endpoint that:
1. Authenticates the user (your existing auth system)
2. Calls CometChat API to generate an auth token
3. Returns the token to the iOS app

**Example (Node.js/Express):**

```javascript
const express = require('express');
const axios = require('axios');

const app = express();

const COMETCHAT_APP_ID = process.env.COMETCHAT_APP_ID;
const COMETCHAT_API_KEY = process.env.COMETCHAT_API_KEY;  // REST API Key
const COMETCHAT_REGION = process.env.COMETCHAT_REGION;

app.post('/api/cometchat/token', async (req, res) => {
    try {
        // 1. Verify the user is authenticated (your auth system)
        const userId = req.user.id;  // From your auth middleware
        
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // 2. Generate CometChat auth token
        const response = await axios.post(
            `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3/users/${userId}/auth_tokens`,
            {},
            {
                headers: {
                    'apiKey': COMETCHAT_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        // 3. Return the token
        res.json({
            authToken: response.data.data.authToken
        });
        
    } catch (error) {
        console.error('CometChat token error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});
```

**Example (Python/Flask):**

```python
from flask import Flask, jsonify, request
import requests
import os

app = Flask(__name__)

COMETCHAT_APP_ID = os.environ.get('COMETCHAT_APP_ID')
COMETCHAT_API_KEY = os.environ.get('COMETCHAT_API_KEY')
COMETCHAT_REGION = os.environ.get('COMETCHAT_REGION')

@app.route('/api/cometchat/token', methods=['POST'])
def get_cometchat_token():
    # 1. Verify user is authenticated (your auth system)
    user_id = request.user.id  # From your auth middleware
    
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # 2. Generate CometChat auth token
    url = f'https://{COMETCHAT_APP_ID}.api-{COMETCHAT_REGION}.cometchat.io/v3/users/{user_id}/auth_tokens'
    
    headers = {
        'apiKey': COMETCHAT_API_KEY,
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        return jsonify({'authToken': data['data']['authToken']})
    else:
        return jsonify({'error': 'Failed to generate token'}), 500
```

### CometChat REST API Reference

**Create Auth Token:**
```
POST https://{appId}.api-{region}.cometchat.io/v3/users/{uid}/auth_tokens

Headers:
  apiKey: YOUR_REST_API_KEY
  Content-Type: application/json

Response:
{
  "data": {
    "uid": "user-123",
    "authToken": "user-123_abc123xyz..."
  }
}
```

**Create User (if needed):**
```
POST https://{appId}.api-{region}.cometchat.io/v3/users

Headers:
  apiKey: YOUR_REST_API_KEY
  Content-Type: application/json

Body:
{
  "uid": "user-123",
  "name": "John Doe",
  "avatar": "https://example.com/avatar.jpg"
}
```

---

## 3. iOS Implementation

### CometChatManager for Production

```swift
import Foundation
import CometChatUIKitSwift
import CometChatSDK

final class CometChatManager {
    
    static let shared = CometChatManager()
    
    private(set) var isInitialized = false
    private(set) var currentUser: User?
    
    private init() {}
    
    // MARK: - Initialization (No Auth Key needed)
    
    func initialize(completion: @escaping (Result<Bool, Error>) -> Void) {
        guard !isInitialized else {
            completion(.success(true))
            return
        }
        
        // Note: No authKey in production!
        let uiKitSettings = UIKitSettings()
            .set(appID: AppConfig.cometChatAppID)
            .set(region: AppConfig.cometChatRegion)
            .subscribePresenceForAllUsers()
            .build()
        
        CometChatUIKit(uiKitSettings: uiKitSettings) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let success):
                    self?.isInitialized = success
                    self?.currentUser = CometChatUIKit.getLoggedInUser()
                    completion(.success(success))
                case .failure(let error):
                    completion(.failure(error))
                }
            }
        }
    }
    
    // MARK: - Production Login
    
    func login(completion: @escaping (Result<User, Error>) -> Void) {
        guard isInitialized else {
            completion(.failure(CometChatError.notInitialized))
            return
        }
        
        // Check for existing session
        if let user = CometChatUIKit.getLoggedInUser() {
            currentUser = user
            completion(.success(user))
            return
        }
        
        // Fetch auth token from your server
        fetchAuthToken { [weak self] result in
            switch result {
            case .success(let authToken):
                self?.loginWithToken(authToken, completion: completion)
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
    
    private func fetchAuthToken(completion: @escaping (Result<String, Error>) -> Void) {
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/api/cometchat/token") else {
            completion(.failure(CometChatError.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add your auth header (e.g., JWT token)
        if let authToken = AuthManager.shared.accessToken {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(CometChatError.noData))
                return
            }
            
            do {
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                if let authToken = json?["authToken"] as? String {
                    completion(.success(authToken))
                } else {
                    completion(.failure(CometChatError.invalidResponse))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    private func loginWithToken(_ authToken: String, completion: @escaping (Result<User, Error>) -> Void) {
        CometChatUIKit.login(authToken: authToken) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let user):
                    self?.currentUser = user
                    completion(.success(user))
                case .onError(let error):
                    completion(.failure(error))
                }
            }
        }
    }
    
    // MARK: - Logout
    
    func logout(completion: @escaping (Result<Void, Error>) -> Void) {
        guard let user = currentUser else {
            completion(.success(()))
            return
        }
        
        CometChatUIKit.logout(user: user) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    self?.currentUser = nil
                    completion(.success(()))
                case .onError(let error):
                    completion(.failure(error))
                }
            }
        }
    }
}

// MARK: - Errors

enum CometChatError: LocalizedError {
    case notInitialized
    case invalidURL
    case noData
    case invalidResponse
    
    var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "CometChat is not initialized"
        case .invalidURL:
            return "Invalid API URL"
        case .noData:
            return "No data received from server"
        case .invalidResponse:
            return "Invalid response from server"
        }
    }
}
```

### App Configuration

```swift
// AppConfig.swift
import Foundation

struct AppConfig {
    
    // CometChat
    static let cometChatAppID: String = {
        guard let appID = Bundle.main.object(forInfoDictionaryKey: "CometChatAppID") as? String else {
            fatalError("CometChatAppID not found in Info.plist")
        }
        return appID
    }()
    
    static let cometChatRegion: String = {
        guard let region = Bundle.main.object(forInfoDictionaryKey: "CometChatRegion") as? String else {
            fatalError("CometChatRegion not found in Info.plist")
        }
        return region
    }()
    
    // Your API
    static let apiBaseURL: String = {
        #if DEBUG
        return "https://api-staging.yourapp.com"
        #else
        return "https://api.yourapp.com"
        #endif
    }()
}
```

### Info.plist Configuration

```xml
<key>CometChatAppID</key>
<string>$(COMETCHAT_APP_ID)</string>
<key>CometChatRegion</key>
<string>$(COMETCHAT_REGION)</string>
```

### xcconfig Files

**Debug.xcconfig:**
```
COMETCHAT_APP_ID = your_app_id
COMETCHAT_REGION = us
```

**Release.xcconfig:**
```
COMETCHAT_APP_ID = your_app_id
COMETCHAT_REGION = us
```

---

## 4. User Provisioning

### Create Users on Your Server

When a user signs up in your app, create them in CometChat:

```javascript
// On your server - user registration endpoint
app.post('/api/register', async (req, res) => {
    const { email, password, name } = req.body;
    
    // 1. Create user in your database
    const user = await createUserInDatabase({ email, password, name });
    
    // 2. Create user in CometChat
    await axios.post(
        `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3/users`,
        {
            uid: user.id,
            name: user.name,
            avatar: user.avatarUrl
        },
        {
            headers: {
                'apiKey': COMETCHAT_API_KEY,
                'Content-Type': 'application/json'
            }
        }
    );
    
    res.json({ success: true, userId: user.id });
});
```

### Update User Profile

When user updates their profile:

```javascript
app.put('/api/profile', async (req, res) => {
    const { name, avatar } = req.body;
    const userId = req.user.id;
    
    // 1. Update in your database
    await updateUserInDatabase(userId, { name, avatar });
    
    // 2. Update in CometChat
    await axios.put(
        `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3/users/${userId}`,
        { name, avatar },
        {
            headers: {
                'apiKey': COMETCHAT_API_KEY,
                'Content-Type': 'application/json'
            }
        }
    );
    
    res.json({ success: true });
});
```

---

## 5. Security Best Practices

### Never Expose API Keys

❌ **Wrong:**
```swift
// Never do this!
let apiKey = "abc123xyz"  // Hardcoded in app
```

✅ **Correct:**
```swift
// API keys stay on your server
// iOS app only receives short-lived auth tokens
```

### Validate User Identity

Always verify user identity on your server before generating tokens:

```javascript
app.post('/api/cometchat/token', authenticateMiddleware, async (req, res) => {
    // authenticateMiddleware verifies the user's JWT/session
    const userId = req.user.id;  // Verified user ID
    
    // Generate token only for verified users
    // ...
});
```

### Use HTTPS

Always use HTTPS for API communication:

```swift
// ✅ Correct
let url = URL(string: "https://api.yourapp.com/api/cometchat/token")

// ❌ Wrong
let url = URL(string: "http://api.yourapp.com/api/cometchat/token")
```

### Token Expiration

Auth tokens have a default expiration. Handle token refresh:

```swift
func handleTokenExpired() {
    // Clear current session
    CometChatManager.shared.logout { _ in
        // Re-login to get new token
        CometChatManager.shared.login { result in
            switch result {
            case .success:
                print("Re-authenticated successfully")
            case .failure(let error):
                print("Re-authentication failed: \(error)")
                // Navigate to login screen
            }
        }
    }
}
```

### App Transport Security

Ensure ATS is properly configured in `Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>
```

---

## 6. Error Handling

### Handle Authentication Errors

```swift
func handleCometChatError(_ error: Error) {
    if let cometChatError = error as? CometChatException {
        switch cometChatError.errorCode {
        case "ERR_UID_NOT_FOUND":
            // User doesn't exist in CometChat
            // Create user on your server, then retry
            createUserAndRetry()
            
        case "AUTH_ERR_AUTH_TOKEN_NOT_FOUND":
            // Invalid or expired token
            refreshTokenAndRetry()
            
        case "ERR_NOT_LOGGED_IN":
            // User not logged in
            navigateToLogin()
            
        default:
            showError(cometChatError.errorDescription ?? "Unknown error")
        }
    }
}
```

### Retry Logic

```swift
func loginWithRetry(maxAttempts: Int = 3, completion: @escaping (Result<User, Error>) -> Void) {
    var attempts = 0
    
    func attempt() {
        attempts += 1
        
        CometChatManager.shared.login { result in
            switch result {
            case .success(let user):
                completion(.success(user))
            case .failure(let error):
                if attempts < maxAttempts {
                    // Wait and retry
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        attempt()
                    }
                } else {
                    completion(.failure(error))
                }
            }
        }
    }
    
    attempt()
}
```

---

## 7. Deployment Checklist

### Before Submitting to App Store

- [ ] **Remove Auth Key from code** — Use server-side tokens only
- [ ] **Configure production API URL** — Point to production server
- [ ] **Test with production CometChat app** — Create separate prod app in dashboard
- [ ] **Enable required extensions** — Polls, stickers, AI features in dashboard
- [ ] **Configure push notifications** — Upload APNs certificate to dashboard
- [ ] **Test on real devices** — Calls and push don't work on simulator
- [ ] **Review Info.plist permissions** — Camera, microphone, notifications
- [ ] **Test logout flow** — Ensure clean session termination
- [ ] **Test offline behavior** — App should handle network issues gracefully
- [ ] **Review error messages** — User-friendly error handling

### CometChat Dashboard Configuration

- [ ] **Create production app** — Separate from development
- [ ] **Configure webhooks** — If using server-side events
- [ ] **Set up push notifications** — APNs certificate uploaded
- [ ] **Enable required extensions** — Only what you need
- [ ] **Configure AI features** — If using AI capabilities
- [ ] **Review rate limits** — Understand your plan limits
- [ ] **Set up monitoring** — Enable analytics and logging

### Server Configuration

- [ ] **Secure API keys** — Store in environment variables
- [ ] **Implement rate limiting** — Prevent abuse
- [ ] **Add request validation** — Validate all inputs
- [ ] **Set up logging** — Monitor token generation
- [ ] **Configure CORS** — If using web clients too
- [ ] **Test error scenarios** — Handle CometChat API failures

---

## 8. Monitoring and Analytics

### Track CometChat Events

```swift
// Listen for connection state
CometChat.addConnectionListener("connection-listener", self)

extension YourClass: CometChatConnectionDelegate {
    func connected() {
        Analytics.track("cometchat_connected")
    }
    
    func connecting() {
        Analytics.track("cometchat_connecting")
    }
    
    func disconnected() {
        Analytics.track("cometchat_disconnected")
    }
}
```

### Track Message Events

```swift
class AnalyticsListener: CometChatMessageEventListener {
    
    func ccMessageSent(message: BaseMessage, status: MessageStatus) {
        if status == .success {
            Analytics.track("message_sent", properties: [
                "type": message.messageType.rawValue,
                "receiver_type": message.receiverType.rawValue
            ])
        }
    }
}

CometChatMessageEvents.addListener("analytics", AnalyticsListener())
```

---

## 9. Common Production Issues

| Issue | Cause | Solution |
|---|---|---|
| "User not found" | User not created in CometChat | Create user via REST API before login |
| "Invalid auth token" | Token expired or malformed | Generate new token from server |
| "Rate limit exceeded" | Too many API calls | Implement caching and rate limiting |
| Push not working | Certificate mismatch | Verify APNs cert matches environment |
| Calls failing | Missing SDK or permissions | Add CometChatCallsSDK and permissions |

---

## Summary

**Development → Production Migration:**

1. Remove Auth Key from iOS app
2. Create server endpoint for token generation
3. Update iOS app to fetch tokens from your server
4. Create users in CometChat when they register
5. Test thoroughly before release
6. Monitor and handle errors gracefully

