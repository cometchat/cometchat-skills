---
name: cometchat-android-v5-core
description: "Foundational rules for CometChat Android UI Kit v5. Initialization, login, UIKitSettings builder, dependency setup, and anti-patterns. Read this first."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat android core rules initialization login builder patterns"
---

> **Companion skills:** `cometchat-android-v5-components` provides the component
> catalog (what exists); `cometchat-android-v5-placement` covers where to put
> chat in your app; `cometchat-android-v5-theming` covers visual customization.

## Purpose

This is the foundational skill for every CometChat Android UI Kit v5 integration. It teaches how CometChat works on Android — initialization, login, the UIKitSettings builder, Gradle dependency setup, manifest permissions, and the anti-patterns that silently break integrations.

**Read this skill first, before any component or placement skill.**

---

## Use this skill when

- Setting up CometChat in a new Android project
- Initializing the SDK (`CometChatUIKit.init`)
- Logging in / logging out users
- Configuring `UIKitSettings` via the builder
- Adding Gradle dependencies
- Debugging init or login failures
- "How do I set up CometChat?"
- "CometChat isn't initializing"

## Do not use this skill when

- Customizing component appearance → use `cometchat-android-v5-theming`
- Adding a specific feature (calls, reactions) → use `cometchat-android-v5-features`
- Writing custom message templates → use `cometchat-android-v5-customization`
- Diagnosing runtime crashes → use `cometchat-android-v5-troubleshooting`

---

## 1. Gradle Dependencies

Add the CometChat UI Kit dependency to your app-level `build.gradle`:

```groovy
dependencies {
    implementation 'com.cometchat:chat-uikit-android:5.+'
}
```

The UI Kit transitively pulls in the CometChat Chat SDK. For voice/video calling, add the calling SDK separately:

```groovy
dependencies {
    implementation 'com.cometchat:chat-uikit-android:5.+'
    implementation 'com.cometchat:calls-sdk-android:4.+'  // optional — only for calls
}
```

Ensure your project-level `build.gradle` includes the CometChat Maven repository:

```groovy
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url "https://dl.cloudsmith.io/public/cometchat/cometchat/maven/" }
    }
}
```

**Min SDK:** 24 (Android 7.0). **Compile SDK:** 34+. **Java:** 8+. **Kotlin:** 1.8+.

> **⚠️ Important:** Always use the published Maven artifact (`com.cometchat:chat-uikit-android:5.+`). Never use `implementation project(':chatuikit')` or other local module references — those are only for CometChat's own internal development. The Chat SDK (`com.cometchat:chat-sdk-android`) is transitively included by the UI Kit, so you do not need to add it separately.

### 1a. AndroidX + Jetifier (REQUIRED — non-negotiable)

The CometChat Chat SDK transitively depends on the legacy `com.android.support:support-compat` library. Modern Android Studio projects (Arctic Fox+) default to `androidx.core` instead. Without Jetifier, Gradle sees the same classes (`android.support.v4.os.ResultReceiver`, etc.) declared in both libraries and fails the build with:

```
Duplicate class android.support.v4.os.ResultReceiver$1 found in modules
  core-1.16.0.aar -> core-1.16.0-runtime (androidx.core:core:1.16.0)
  and support-compat-26.1.0.aar -> support-compat-26.1.0-runtime
  (com.android.support:support-compat:26.1.0)
```

**Add these two lines to `gradle.properties` at the project root** before any UI Kit code is wired in:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

Both are **mandatory**. Jetifier rewrites the legacy `android.support.*` references in the CometChat SDK's transitive deps to their `androidx.*` equivalents at build time, so the duplicate-class error doesn't happen.

A freshly-created Android Studio project usually has `android.useAndroidX=true` already (Arctic Fox+) but **Jetifier is OFF by default** since it's deprecated in newer SDK landscapes. The CometChat V5 SDK still needs it. If `gradle.properties` doesn't have either line, append both. If it has `useAndroidX=true` but no Jetifier line, add the Jetifier line. Idempotent.

---

## 2. Initialization

CometChat must be initialized exactly once before any UI component is used. Initialization is asynchronous and must complete fully before mounting any `CometChat*` view.

### The UIKitSettingsBuilder

**Java:**
```java
import com.cometchat.chatuikit.shared.cometchatuikit.CometChatUIKit;
import com.cometchat.chatuikit.shared.cometchatuikit.UIKitSettings;

UIKitSettings uiKitSettings = new UIKitSettings.UIKitSettingsBuilder()
    .setAppId(APP_ID)           // Required. String from the CometChat dashboard.
    .setRegion(REGION)          // Required. "us", "eu", "in", etc.
    .setAuthKey(AUTH_KEY)       // Required for dev mode. Omit in production.
    .subscribePresenceForAllUsers()  // Optional — enables online/offline indicators.
    .build();
```

**Kotlin:**
```kotlin
import com.cometchat.chatuikit.shared.cometchatuikit.CometChatUIKit
import com.cometchat.chatuikit.shared.cometchatuikit.UIKitSettings

val uiKitSettings = UIKitSettings.UIKitSettingsBuilder()
    .setAppId(APP_ID)
    .setRegion(REGION)
    .setAuthKey(AUTH_KEY)
    .subscribePresenceForAllUsers()
    .build()
```

### UIKitSettingsBuilder — full method reference

| Method | Type | Description |
|---|---|---|
| `setAppId(String)` | Required | CometChat App ID from the dashboard |
| `setRegion(String)` | Required | Region: `"us"`, `"eu"`, `"in"` |
| `setAuthKey(String)` | Dev only | Auth Key for client-side login. Omit in production. |
| `subscribePresenceForAllUsers()` | Optional | Subscribe to presence for all users |
| `subscribePresenceForFriends()` | Optional | Subscribe to presence for friends only |
| `subscribePresenceForRoles(List<String>)` | Optional | Subscribe to presence for specific roles |
| `setAutoEstablishSocketConnection(Boolean)` | Optional | Auto-connect WebSocket. Default: `true` |
| `setAIFeatures(List<AIExtensionDataSource>)` | Optional | Custom AI features list. Default: built-in AI features |
| `setExtensions(List<ExtensionsDataSource>)` | Optional | Custom extensions list. Default: built-in extensions |
| `setDateTimeFormatterCallback(DateTimeFormatterCallback)` | Optional | Custom date/time formatting |
| `overrideAdminHost(String)` | Advanced | Override admin API host |
| `overrideClientHost(String)` | Advanced | Override client API host |

### Init call

**Java:**
```java
CometChatUIKit.init(context, uiKitSettings, new CometChat.CallbackListener<String>() {
    @Override
    public void onSuccess(String s) {
        // SDK initialized — safe to login and use components
    }

    @Override
    public void onError(CometChatException e) {
        // Handle init failure
    }
});
```

**Kotlin:**
```kotlin
CometChatUIKit.init(context, uiKitSettings, object : CometChat.CallbackListener<String>() {
    override fun onSuccess(s: String) {
        // SDK initialized — safe to login and use components
    }

    override fun onError(e: CometChatException) {
        // Handle init failure
    }
})
```

### Init must happen once

Call `CometChatUIKit.init()` in your `Application.onCreate()` or your launcher `Activity.onCreate()`. Use `CometChatUIKit.isSDKInitialized()` to guard against double-init:

**Java:**
```java
if (!CometChatUIKit.isSDKInitialized()) {
    CometChatUIKit.init(this, uiKitSettings, new CometChat.CallbackListener<String>() {
        @Override
        public void onSuccess(String s) {
            // proceed to login
        }

        @Override
        public void onError(CometChatException e) {
            // show error
        }
    });
}
```

---

## 3. Login

### Development mode

Use `CometChatUIKit.login(uid, callback)` with a test UID. Every new CometChat app comes with five pre-created test users: `cometchat-uid-1` through `cometchat-uid-5`.

**Java:**
```java
if (CometChatUIKit.getLoggedInUser() == null) {
    CometChatUIKit.login("cometchat-uid-1", new CometChat.CallbackListener<User>() {
        @Override
        public void onSuccess(User user) {
            // Navigate to chat screen
        }

        @Override
        public void onError(CometChatException e) {
            // Handle login failure
        }
    });
}
```

**Kotlin:**
```kotlin
if (CometChatUIKit.getLoggedInUser() == null) {
    CometChatUIKit.login("cometchat-uid-1", object : CometChat.CallbackListener<User>() {
        override fun onSuccess(user: User) {
            // Navigate to chat screen
        }

        override fun onError(e: CometChatException) {
            // Handle login failure
        }
    })
}
```

### Production mode

Use `CometChatUIKit.loginWithAuthToken(token, callback)` with a token obtained from your backend. The backend generates the token using the CometChat REST API with your REST API Key (not the client-side Auth Key).

**Java:**
```java
CometChatUIKit.loginWithAuthToken(authToken, new CometChat.CallbackListener<User>() {
    @Override
    public void onSuccess(User user) {
        // Navigate to chat screen
    }

    @Override
    public void onError(CometChatException e) {
        // Handle login failure
    }
});
```

### Getting the current logged-in user

```java
User currentUser = CometChatUIKit.getLoggedInUser();
if (currentUser != null) {
    String uid = currentUser.getUid();
}
```

### Logout

**Java:**
```java
CometChatUIKit.logout(new CometChat.CallbackListener<String>() {
    @Override
    public void onSuccess(String s) {
        // Navigate to login screen
    }

    @Override
    public void onError(CometChatException e) {
        // Handle logout failure
    }
});
```

### Create user (dev mode only)

```java
User user = new User();
user.setUid("user-123");
user.setName("John Doe");

CometChatUIKit.createUser(user, new CometChat.CallbackListener<User>() {
    @Override
    public void onSuccess(User user) { }

    @Override
    public void onError(CometChatException e) { }
});
```

---

## 4. CometChatUIKit — full public API

| Method | Signature | Description |
|---|---|---|
| `init` | `static void init(Context, UIKitSettings, CallbackListener<String>)` | Initialize the SDK |
| `login` | `static void login(String uid, CallbackListener<User>)` | Login with UID (dev mode) |
| `loginWithAuthToken` | `static void loginWithAuthToken(String token, CallbackListener<User>)` | Login with auth token (production) |
| `logout` | `static void logout(CallbackListener<String>)` | Logout current user |
| `getLoggedInUser` | `static User getLoggedInUser()` | Get current logged-in user (null if none) |
| `isSDKInitialized` | `static boolean isSDKInitialized()` | Check if SDK is initialized |
| `createUser` | `static void createUser(User, CallbackListener<User>)` | Create a new user (dev mode) |
| `sendTextMessage` | `static void sendTextMessage(TextMessage, CallbackListener<TextMessage>)` | Send a text message |
| `sendMediaMessage` | `static void sendMediaMessage(MediaMessage, CallbackListener<MediaMessage>)` | Send a media message |
| `sendCustomMessage` | `static void sendCustomMessage(CustomMessage, CallbackListener<CustomMessage>)` | Send a custom message |
| `sendFormMessage` | `static void sendFormMessage(FormMessage, boolean, CallbackListener<FormMessage>)` | Send a form message |
| `sendSchedulerMessage` | `static void sendSchedulerMessage(SchedulerMessage, boolean, CallbackListener<SchedulerMessage>)` | Send a scheduler message |

---

## 5. Manifest Permissions

Add these to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- For media messages -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />

<!-- For voice notes and calls -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />

<!-- For push notifications (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

## 5b. App Theme Requirement

CometChat UI Kit v5 ships its own theme (`CometChatTheme.DayNight`) which itself inherits from `Theme.MaterialComponents.DayNight.NoActionBar` (Material 2 — see the kit's own `chatuikit/src/main/res/values/themes.xml`). Your app's theme **must** inherit from `CometChatTheme.DayNight` so the kit's attribute set is in scope. Using `Theme.AppCompat.*` (which lacks Material attributes the kit relies on) leads to attribute-resolution failures at inflate time.

**Recommended — use CometChat's built-in theme as parent:**
```xml
<!-- res/values/themes.xml -->
<style name="AppTheme" parent="CometChatTheme.DayNight">
    <!-- Your customizations -->
    <item name="colorPrimary">@color/your_brand_color</item>
</style>
```

**Do NOT inherit from `Theme.AppCompat.*`** — it doesn't pull in the Material attributes the UI Kit reads at inflate time, and you'll see `UnsupportedOperationException: Failed to resolve attribute`. Inheriting directly from `Theme.MaterialComponents.*` works at runtime but you lose the kit's preconfigured color tokens — prefer `CometChatTheme.DayNight` so both the kit's defaults and your overrides apply cleanly.

> **Material 2 vs Material 3.** The kit currently parents on Material 2 (`Theme.MaterialComponents.DayNight.NoActionBar`). Do NOT switch to `Theme.Material3.*` as your app theme parent — the kit's resource attrs are resolved against the Material 2 namespace; mixing in Material 3 leaves some attributes undefined and triggers the same `UnsupportedOperationException` at inflate.

---

## 6. Typical init + login flow (complete example)

This is the pattern used in the sample apps. Place it in your launcher Activity:

**Java:**
```java
public class SplashActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        UIKitSettings uiKitSettings = new UIKitSettings.UIKitSettingsBuilder()
            .setAppId("YOUR_APP_ID")
            .setRegion("us")
            .setAuthKey("YOUR_AUTH_KEY")
            .subscribePresenceForAllUsers()
            .build();

        CometChatUIKit.init(this, uiKitSettings, new CometChat.CallbackListener<String>() {
            @Override
            public void onSuccess(String s) {
                if (CometChatUIKit.getLoggedInUser() != null) {
                    startActivity(new Intent(SplashActivity.this, HomeActivity.class));
                    finish();
                } else {
                    startActivity(new Intent(SplashActivity.this, LoginActivity.class));
                    finish();
                }
            }

            @Override
            public void onError(CometChatException e) {
                Toast.makeText(SplashActivity.this, "Init failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}
```

**Kotlin:**
```kotlin
class SplashActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val uiKitSettings = UIKitSettings.UIKitSettingsBuilder()
            .setAppId("YOUR_APP_ID")
            .setRegion("us")
            .setAuthKey("YOUR_AUTH_KEY")
            .subscribePresenceForAllUsers()
            .build()

        CometChatUIKit.init(this, uiKitSettings, object : CometChat.CallbackListener<String>() {
            override fun onSuccess(s: String) {
                if (CometChatUIKit.getLoggedInUser() != null) {
                    startActivity(Intent(this@SplashActivity, HomeActivity::class.java))
                } else {
                    startActivity(Intent(this@SplashActivity, LoginActivity::class.java))
                }
                finish()
            }

            override fun onError(e: CometChatException) {
                Toast.makeText(this@SplashActivity, "Init failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        })
    }
}
```

---

## 7. Anti-patterns

| Anti-pattern | Why it breaks | Fix |
|---|---|---|
| Calling `login()` before `init()` completes | SDK not ready, login silently fails or throws | Always call `login()` inside `init()`'s `onSuccess` |
| Double `init()` calls | Wastes resources, can cause race conditions | Guard with `CometChatUIKit.isSDKInitialized()` |
| Hardcoding Auth Key in production | Anyone can decompile your APK and login as any user | Use `loginWithAuthToken()` with server-minted tokens |
| Using UI components before login | Components require a logged-in user to fetch data | Always verify `getLoggedInUser() != null` before showing chat UI |
| Missing INTERNET permission | SDK can't reach CometChat servers | Add `<uses-permission android:name="android.permission.INTERNET" />` |
| Wrong region string | SDK connects to wrong datacenter, gets 404s | Use exact region from dashboard: `"us"`, `"eu"`, `"in"` |
| Calling `init()` in every Activity | Redundant, wastes network calls | Call once in `Application.onCreate()` or launcher Activity |
| Using `Theme.AppCompat.*` or `Theme.Material3.*` as app theme | The kit's attrs are resolved against Material 2 (which `CometChatTheme.DayNight` inherits from); mixing namespaces fails with `UnsupportedOperationException` at inflate time | Inherit from `CometChatTheme.DayNight` |
| Using `implementation project(':chatuikit')` for the UI Kit dependency | Local module references only work inside CometChat's own monorepo; external apps can't resolve the module | Use `implementation 'com.cometchat:chat-uikit-android:5.+'` from the CometChat Maven repository |
| Forgetting `android.useAndroidX=true` + `android.enableJetifier=true` in `gradle.properties` | CometChat SDK's transitive `com.android.support` deps collide with the project's `androidx.core` → "Duplicate class android.support.v4.os.ResultReceiver$1" build failure | See § 1a — both lines mandatory in every greenfield Android Studio integration |

---

## Hard rules

- **Init once, login once.** `CometChatUIKit.init()` must be called exactly once before any UI component is used. `login()` must be called inside `init()`'s `onSuccess`.
- **Always check `getLoggedInUser()`.** Before navigating to any chat screen, verify the user is logged in.
- **Never hardcode Auth Key in production.** Use `loginWithAuthToken()` with server-side token generation.
- **INTERNET permission is mandatory.** Without it, the SDK silently fails.
- **All UI components require a logged-in user.** Mounting `CometChatConversations`, `CometChatMessageList`, etc. without a logged-in user results in empty views or crashes.
- **App theme must inherit from `CometChatTheme.DayNight`.** The kit itself parents on `Theme.MaterialComponents.DayNight.NoActionBar` (Material 2). Inheriting from `Theme.AppCompat.*` or `Theme.Material3.*` triggers `UnsupportedOperationException: Failed to resolve attribute` at inflate time.
- **Always use the published Maven artifact for dependencies, never local project modules.** Use `implementation 'com.cometchat:chat-uikit-android:5.+'` — never `implementation project(':chatuikit')`. Local module references only apply to CometChat's own internal sample apps. External apps must always depend on the published artifact from the CometChat Maven repository.
- **`gradle.properties` MUST contain `android.useAndroidX=true` AND `android.enableJetifier=true`.** Both lines, no exceptions. The CometChat V5 Android SDK transitively depends on the legacy `com.android.support:support-compat`. Without Jetifier rewriting those references to `androidx.*` at build time, Gradle hits "Duplicate class android.support.v4.os.ResultReceiver$1" and the build fails. Modern Android Studio scaffolds set `useAndroidX=true` by default but leave Jetifier off — the integration must add the Jetifier line. Idempotent — if both lines are already present, no change.
