---
name: cometchat-android-v5-production
description: "Production readiness for CometChat Android — server-side token auth, user management CRUD, ProGuard rules, and security checklist."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat android production auth token security user-management proguard"
---

> **Companion skills:** `cometchat-android-v5-core` covers dev-mode login;
> `cometchat-android-v5-push` covers push notification setup for production.

## Purpose

This skill covers hardening a CometChat Android integration for production: replacing client-side Auth Key with server-side token generation, user management CRUD, ProGuard/R8 rules, and security best practices.

---

## Use this skill when

- "Set up production auth"
- "Replace Auth Key with tokens"
- "ProGuard is breaking CometChat"
- "How do I create CometChat users from my backend?"

## Do not use this skill when

- Setting up dev-mode login → use `cometchat-android-v5-core`
- Adding features → use `cometchat-android-v5-features`

---

## 1. Why production auth matters

In dev mode, `CometChatUIKit.login(uid)` uses the Auth Key embedded in your app. Anyone can decompile the APK, extract the key, and login as ANY user. Production deployments MUST use server-side token generation.

## 2. Token auth flow

```
Client → Your Server → CometChat REST API → auth token → Client
Client calls CometChatUIKit.loginWithAuthToken(token)
```

Your server calls: `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens`
with headers: `appId`, `apiKey` (REST API Key, NOT Auth Key).

## 3. Client-side implementation

**Java:**
```java
// Fetch token from YOUR backend
String token = fetchTokenFromYourServer(currentUserId);

CometChatUIKit.loginWithAuthToken(token, new CometChat.CallbackListener<User>() {
    @Override
    public void onSuccess(User user) {
        // Navigate to chat
    }
    @Override
    public void onError(CometChatException e) {
        // Handle error
    }
});
```

## 4. ProGuard/R8 rules

Add to `proguard-rules.pro`:

```
-keep class com.cometchat.** { *; }
-keep class com.cometchat.chatuikit.** { *; }
-dontwarn com.cometchat.**
```

## 5. Security checklist

- [ ] Auth Key removed from client code
- [ ] REST API Key stored server-side only
- [ ] `loginWithAuthToken()` used instead of `login(uid)`
- [ ] ProGuard rules added
- [ ] Network security config allows CometChat domains
- [ ] Push token unregistered on logout

---

## Hard rules

- **Never ship Auth Key in production APKs.** Use `loginWithAuthToken()`.
- **REST API Key ≠ Auth Key.** REST API Key is server-only. Auth Key is client-side dev-only.
- **Add ProGuard keep rules.** R8 can strip CometChat classes needed at runtime.
