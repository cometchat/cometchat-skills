---
name: cometchat-android-v6-testing
description: "CometChat Android UIKit v6 testing — unit testing ViewModels, Compose UI testing, Espresso, Maestro, and CI configuration"
license: "MIT"
compatibility: "Android 9.0+ (API 28); Kotlin 1.9+; com.cometchat:chatuikit-compose-android:6.x / com.cometchat:chatuikit-kotlin-android:6.x"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat, android, testing, junit, kotest, compose-testing, espresso, maestro"
---

> **Companion skills:** cometchat-android-v6-extensions (ViewModel/DataSource architecture), cometchat-android-v6-compose-components, cometchat-android-v6-kotlin-components

## Purpose

Test CometChat UIKit v6 components and ViewModels — unit tests for the shared core module, Compose UI tests, Espresso tests for Views, and end-to-end tests with Maestro.

## Use this skill when

- Writing unit tests for CometChat ViewModels
- Writing Compose UI tests for CometChat components
- Writing Espresso tests for Kotlin Views components
- Setting up Maestro flows for end-to-end testing
- Configuring CI for CometChat test suites

## Do not use this skill when

- Debugging runtime issues (use `cometchat-android-v6-troubleshooting`)
- Working with component APIs (use `cometchat-*-components`)

## 1. Test Dependencies

From `chatuikit-compose/build.gradle.kts`:

```kotlin
dependencies {
    // Unit testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.kotest:kotest-runner-junit5:5.x")
    testImplementation("io.kotest:kotest-assertions-core:5.x")
    testImplementation("io.kotest:kotest-property:5.x")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.x")
    testImplementation("androidx.arch.core:core-testing:2.x")
    testImplementation("androidx.lifecycle:lifecycle-runtime-testing:2.x")
    testImplementation("org.mockito:mockito-core:5.x")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.x")

    // Android instrumented testing
    androidTestImplementation("androidx.test.ext:junit:1.x")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.x")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.x.x"))

    // Debug-only Compose tooling
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
```

Enable JUnit Platform for Kotest:

```kotlin
android {
    testOptions {
        unitTests.all {
            it.useJUnitPlatform()
        }
    }
}
```

## 2. Unit Testing ViewModels

ViewModels live in `chatuikit-core` and are shared across both stacks. Test them with coroutines-test and Mockito:

```kotlin
import kotlinx.coroutines.test.runTest
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class CometChatConversationsViewModelTest {

    @Test
    fun `loadConversations emits success state`() = runTest {
        val mockDataSource = mock<ConversationListDataSource>()
        // Setup mock responses...

        val viewModel = CometChatConversationsViewModel(/* inject mocks */)

        // Collect state and assert
        viewModel.uiState.test {
            val state = awaitItem()
            // Assert state is success with expected data
        }
    }
}
```

### 2.1 Testing Events

```kotlin
import com.cometchat.uikit.core.events.CometChatEvents
import com.cometchat.uikit.core.events.CometChatMessageEvent

@Test
fun `emitting message event is received by collector`() = runTest {
    val events = mutableListOf<CometChatMessageEvent>()

    val job = launch {
        CometChatEvents.messageEvents.collect { events.add(it) }
    }

    CometChatEvents.emitMessageEventSync(
        CometChatMessageEvent.MessageSent(mockMessage, MessageStatus.SUCCESS)
    )

    advanceUntilIdle()
    assertEquals(1, events.size)
    job.cancel()
}
```

## 3. Compose UI Testing

```kotlin
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick

class CometChatConversationsTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun conversationsList_displaysTitle() {
        composeTestRule.setContent {
            CometChatTheme {
                CometChatConversations()
            }
        }

        // Assert UI elements
        composeTestRule.onNodeWithText("Chats").assertExists()
    }

    @Test
    fun conversationItem_clickNavigates() {
        var clickedConversation: Conversation? = null

        composeTestRule.setContent {
            CometChatTheme {
                CometChatConversations(
                    onItemClick = { clickedConversation = it }
                )
            }
        }

        // Interact and assert
        // composeTestRule.onNodeWithText("User Name").performClick()
        // assertNotNull(clickedConversation)
    }
}
```

## 4. Espresso Testing (Kotlin Views)

```kotlin
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.rules.ActivityScenarioRule

class ConversationsActivityTest {

    @get:Rule
    val activityRule = ActivityScenarioRule(ConversationsActivity::class.java)

    @Test
    fun conversationsList_isDisplayed() {
        onView(withId(R.id.conversations))
            .check(matches(isDisplayed()))
    }
}
```

## 5. Property-Based Testing with Kotest

The project uses Kotest for property-based tests (e.g., `MessageAdapterPropertyTest.kt`):

```kotlin
import io.kotest.core.spec.style.FunSpec
import io.kotest.property.forAll
import io.kotest.property.Arb
import io.kotest.property.arbitrary.string

class BubbleFactoryKeyTest : FunSpec({

    test("factory key format is always category_type") {
        forAll(Arb.string(1..20), Arb.string(1..20)) { category, type ->
            val key = BubbleFactory.getKey(category, type)
            key == "${category}_${type}"
        }
    }
})
```

## 6. Maestro End-to-End Testing

The `master-app-jetpack/ai-testing/` directory contains Maestro test configurations:

```yaml
# maestro/login_flow.yaml
appId: com.example.jetpackuikit
---
- launchApp
- tapOn: "Login"
- inputText: "superhero1"
- tapOn: "Submit"
- assertVisible: "Chats"
```

Run with:

```bash
maestro test maestro/login_flow.yaml
```

## 7. CI Configuration

### 7.1 GitHub Actions

```yaml
name: Test
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - run: ./gradlew testDebugUnitTest

  instrumented-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 34
          script: ./gradlew connectedDebugAndroidTest
```

## 8. Test Organization

| Test Type | Location | Framework | What to Test |
|---|---|---|---|
| Unit tests | `chatuikit-core/src/test/` | JUnit + Kotest + Mockito | ViewModels, DataSources, Repositories, Events |
| Unit tests | `chatuikit-compose/src/test/` | JUnit + Kotest | BubbleFactory, style resolution |
| Compose UI tests | `chatuikit-compose/src/androidTest/` | Compose Test | Component rendering, interactions |
| Views UI tests | `chatuikit-kotlin/src/androidTest/` | Espresso | Component rendering, interactions |
| E2E tests | `master-app-*/ai-testing/` | Maestro | Full user flows |

## Hard rules

- ALWAYS use `CometChatTheme {}` wrapper in Compose test `setContent` blocks — components depend on CompositionLocal values
- Use `runTest` from `kotlinx-coroutines-test` for testing coroutines and SharedFlow
- Use `useJUnitPlatform()` in test options for Kotest compatibility
- Mock DataSources and Repositories when unit testing ViewModels — do NOT make real SDK calls in tests
- CometChat SDK must NOT be initialized in unit tests — mock all SDK interactions
- For Compose UI tests, use `createComposeRule()` not `createAndroidComposeRule()` unless you need Activity context
