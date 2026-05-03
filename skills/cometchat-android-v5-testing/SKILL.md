---
name: cometchat-android-v5-testing
description: "Testing patterns for CometChat Android — JUnit + Mockito setup, mocking the SDK, Espresso UI tests, E2E with Maestro, and CI integration."
license: "MIT"
compatibility: "Android 7.0+; Java 8+; Kotlin 1.8+; com.cometchat:chat-uikit-android:5.x; JUnit 4 (kit sample apps); Mockito/MockK"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat android testing junit espresso maestro mockito ci"
---

> **Companion skills:** `cometchat-android-v5-core` covers init/login patterns you're testing;
> `cometchat-android-v5-components` covers component APIs to assert against.

## Purpose

This skill teaches how to write and run tests against a CometChat Android integration. Covers unit tests with JUnit + Mockito/MockK, UI tests with Espresso, E2E with Maestro, and CI integration.

---

## Use this skill when

- "Add tests for my CometChat integration"
- "How do I mock CometChat in tests?"
- "Set up E2E testing"
- "CI pipeline for chat tests"

## Do not use this skill when

- Setting up the integration → use `cometchat-android-v5-core`
- Diagnosing runtime issues → use `cometchat-android-v5-troubleshooting`

---

## 1. What to test vs what to skip

**Worth testing:**
- Custom components you wrote (custom bubbles, headers, empty states)
- Navigation logic triggered by CometChat events (push tap → deep-link)
- Init/login lifecycle (init before login, already-logged-in skip)
- Production auth token refresh logic
- User-ID mapping (your auth system → CometChat UID)

**Skip:**
- UIKit internals — that's CometChat's responsibility
- Realtime delivery (A sends, B receives) — requires real servers, flaky
- Presence/typing indicators — race-prone
- Snapshot tests of CometChat components — theme changes churn them

**Golden rule:** if the test fails because YOUR code changed, it's valuable. If it fails because the UIKit updated, it's churn.

---

## 2. Toolchain

| Layer | Tool | Why |
|---|---|---|
| Unit tests | JUnit 4 + Mockito / MockK | Standard Android unit testing |
| Component tests | Robolectric | Run Android component tests without emulator |
| UI tests | Espresso | Android's native UI testing framework |
| E2E | Maestro | Declarative YAML flows, fast, stable |
| CI | GitHub Actions / Bitrise | Automated test runs |

---

## 3. Mocking the CometChat SDK

**Java (Mockito):**
```java
@RunWith(MockitoJUnitRunner.class)
public class ChatViewModelTest {
    @Test
    public void testLoginCallsInit() {
        try (MockedStatic<CometChatUIKit> mocked = mockStatic(CometChatUIKit.class)) {
            mocked.when(CometChatUIKit::getLoggedInUser).thenReturn(null);
            mocked.when(CometChatUIKit::isSDKInitialized).thenReturn(true);

            // Test your ViewModel or helper that calls login
            // Verify init was called before login
        }
    }
}
```

**Kotlin (MockK):**
```kotlin
@Test
fun `already logged in skips login`() {
    mockkStatic(CometChatUIKit::class)
    every { CometChatUIKit.getLoggedInUser() } returns mockk<User>()

    // Your code should skip login
    verify(exactly = 0) { CometChatUIKit.login(any(), any()) }

    unmockkAll()
}
```

---

## 4. Espresso UI tests

```java
@RunWith(AndroidJUnit4.class)
public class MessagesActivityTest {
    @Rule
    public ActivityScenarioRule<MessagesActivity> rule =
        new ActivityScenarioRule<>(MessagesActivity.class);

    @Test
    public void messageListIsDisplayed() {
        onView(withId(R.id.messageList)).check(matches(isDisplayed()));
    }

    @Test
    public void composerIsDisplayed() {
        onView(withId(R.id.composer)).check(matches(isDisplayed()));
    }
}
```

---

## 5. E2E with Maestro

`.maestro/chat-happy-path.yaml`:
```yaml
appId: com.yourapp.android
---
- launchApp
- tapOn: "Login"
- inputText: "cometchat-uid-1"
- tapOn: "Continue"
- assertVisible: "Chats"
- tapOn:
    id: "conversations"
    index: 0
- assertVisible: "Type a message"
- inputText: "Hello from Maestro"
- tapOn:
    id: "send_button"
- assertVisible: "Hello from Maestro"
```

Run: `maestro test .maestro/chat-happy-path.yaml`

---

## 6. CI integration

```yaml
# .github/workflows/test.yml
name: test
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: 17
          distribution: temurin
      - run: ./gradlew test
```

---

## 7. Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `NoClassDefFoundError: CometChat` | SDK not mocked | Add Mockito/MockK mock for static methods |
| Espresso test hangs | Async CometChat operation | Register `IdlingResource` |
| Tests pass locally, fail on CI | Emulator not booted | Pin emulator API level in CI |
| `IllegalStateException: not initialized` | `init()` not called in test setup | Mock `isSDKInitialized()` to return `true` |

---

## Hard rules

- **Mock the SDK in every unit test.** Running real CometChat requires network + servers.
- **Don't test UIKit internals.** You're responsible for YOUR code.
- **Skip realtime tests.** They require real servers and produce flaky suites.
- **Assert on view IDs and state, not pixels.** Theme changes churn pixel assertions.
- **E2E runs on emulator/device, not JUnit.** Don't test real CometChat flow in unit tests.
