---
name: cometchat-ios-testing
description: Testing patterns for CometChat iOS UI Kit v5 in Swift / SwiftUI / UIKit projects. Covers XCTest setup, mocking CometChatSDK + CometChatUIKitSwift via protocols, snapshot testing with iOSSnapshotTestCase, async/await test helpers, UI testing for full chat flows on simulators, and CI on Xcode Cloud / GitHub Actions.
license: "MIT"
compatibility: "Xcode 15+, Swift 5.9+, iOS 13+ deployment target; XCTest (built-in); SnapshotTesting >= 1.15 (Pointfree); CometChatUIKitSwift ~> 5.1"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat ios testing xctest swift uikit swiftui mocking snapshot async-await ui-tests xcode-cloud github-actions"
---

## Purpose

Testing patterns for iOS CometChat integrations. XCTest (built-in) for unit + integration; SnapshotTesting (Pointfree) for visual regression; XCUITest for full-flow UI tests on the simulator.

**Read these other skills first:**
- `cometchat-ios-core` — init, login, Secrets pattern
- `cometchat-ios-components` — what each VC does (tests assert against this)
- `cometchat-ios-calls/references/callkit-and-pushkit.md` — CallKit testing strategy (different from chat)

**Ground truth:** **Official docs:** https://www.cometchat.com/docs/ui-kit/ios/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).
- XCTest — https://developer.apple.com/documentation/xctest
- SnapshotTesting — https://github.com/pointfreeco/swift-snapshot-testing

---

## 1. Test target structure

A typical iOS project has three targets:

| Target | When |
|---|---|
| `YourApp` | Production code |
| `YourAppTests` | Unit + integration tests (XCTest) |
| `YourAppUITests` | UI tests (XCUITest, runs on simulator) |

The skill writes to `YourAppTests` for most assertions; `YourAppUITests` for full flows.

---

## 2. Mocking the SDK via protocols

The CometChat SDKs are class-based with static methods (`CometChat.init`, `CometChat.login`). Hard to mock directly. **Wrap them in protocols you own:**

```swift
// Protocols/CometChatService.swift
import CometChatSDK

// CometChatException does NOT conform to Swift's Error, so a throwing
// continuation can't resume with it directly — bridge it through this.
struct CometChatTestError: Error { let message: String }

protocol CometChatServiceProtocol {
  func initialize(appId: String, region: String) async throws
  func login(uid: String, authKey: String) async throws -> User
  func logout() async throws
  func getLoggedInUser() -> User?
  func sendMessage(_ message: TextMessage) async throws -> TextMessage
}

// Production implementation
final class CometChatService: CometChatServiceProtocol {
  func initialize(appId: String, region: String) async throws {
    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      let settings = AppSettings.AppSettingsBuilder()
        .subscribePresenceForAllUsers()
        .setRegion(region: region)
        .build()
      CometChat.init(appId: appId, appSettings: settings, onSuccess: { _ in
        cont.resume()
      }, onError: { error in
        cont.resume(throwing: CometChatTestError(message: error.errorDescription))
      })
    }
  }

  func login(uid: String, authKey: String) async throws -> User {
    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<User, Error>) in
      CometChat.login(UID: uid, authKey: authKey, onSuccess: { cont.resume(returning: $0) },
                      onError: { cont.resume(throwing: CometChatTestError(message: $0.errorDescription)) })
    }
  }

  // ... etc
}
```

Inject the protocol via DI:

```swift
final class ChatViewController: UIViewController {
  private let service: CometChatServiceProtocol

  init(service: CometChatServiceProtocol = CometChatService()) {
    self.service = service
    super.init(nibName: nil, bundle: nil)
  }
  required init?(coder: NSCoder) { fatalError() }
}
```

Test with a mock:

```swift
// Tests/CometChatServiceMock.swift
final class CometChatServiceMock: CometChatServiceProtocol {
  var initializeCallCount = 0
  var initializeError: Error?
  var loginUser: User?
  var loginError: Error?

  func initialize(appId: String, region: String) async throws {
    initializeCallCount += 1
    if let error = initializeError { throw error }
  }

  func login(uid: String, authKey: String) async throws -> User {
    if let error = loginError { throw error }
    return loginUser ?? User(uid: uid, name: "Test User")
  }

  func logout() async throws {}
  func getLoggedInUser() -> User? { loginUser }
  func sendMessage(_ message: TextMessage) async throws -> TextMessage { message }
}
```

---

## 3. XCTest patterns

### Async/await tests

```swift
import XCTest
@testable import YourApp

final class ChatViewControllerTests: XCTestCase {
  func testInitializeRunsBeforeLogin() async throws {
    let mock = CometChatServiceMock()
    let vc = ChatViewController(service: mock)

    await vc.bootstrapCometChat()

    XCTAssertEqual(mock.initializeCallCount, 1)
    XCTAssertNotNil(vc.currentUser)
  }

  func testLoginFailureSurfacesError() async throws {
    let mock = CometChatServiceMock()
    mock.loginError = NSError(domain: "Test", code: 401, userInfo: [NSLocalizedDescriptionKey: "Unauthorized"])

    let vc = ChatViewController(service: mock)
    await vc.bootstrapCometChat()

    XCTAssertEqual(vc.errorMessage, "Unauthorized")
    XCTAssertEqual(vc.errorLabel?.textColor, .red)            // skill rule: error UI must be visible
  }
}
```

### Expectation-based tests (legacy / non-async code)

```swift
func testMessageSendFiresCallback() {
  let expectation = expectation(description: "message sent")

  let mock = CometChatServiceMock()
  let vc = ChatViewController(service: mock)
  vc.send(message: "Hello") { _ in
    expectation.fulfill()
  }

  wait(for: [expectation], timeout: 1.0)
}
```

For SDK callback-based code, prefer wrapping in protocol + async/await per Section 2; this pattern is for legacy code only.

---

## 4. SwiftUI view tests

```swift
import SwiftUI
import XCTest
@testable import YourApp

@MainActor
final class ProfileViewTests: XCTestCase {
  func testCallButtonInvokesService() throws {
    let mock = CallServiceMock()
    let view = ProfileView(user: testUser(), callService: mock)

    let host = UIHostingController(rootView: view)
    host.loadViewIfNeeded()

    // Hard to interact with SwiftUI views from XCTest directly — use ViewInspector or UI tests
    // For most behavioral tests, prefer XCUITest (Section 6)
  }
}
```

Pure SwiftUI testing is hard; pragmatic choice is to keep most tests at the service / view-model layer and put view assertions in UI tests.

### ViewInspector (third-party)

For SwiftUI views you do want to inspect from XCTest, install `ViewInspector`:

```swift
import ViewInspector

func testProfileShowsUserName() throws {
  let user = testUser()
  let view = ProfileView(user: user)
  let text = try view.inspect().find(text: user.name)
  XCTAssertNotNil(text)
}
```

Adds a runtime dep. Not strictly necessary if you have UI tests.

---

## 5. Snapshot testing

```bash
# Package.swift dependency
.package(url: "https://github.com/pointfreeco/swift-snapshot-testing.git", from: "1.15.0")
```

```swift
import SnapshotTesting
import XCTest
@testable import YourApp

final class ChatViewSnapshotTests: XCTestCase {
  func testEmptyChatView() {
    let view = ChatView(messages: [])
    let host = UIHostingController(rootView: view)
    assertSnapshot(matching: host, as: .image(on: .iPhone13))
  }

  func testChatViewWithMessages() {
    let messages = [
      TextMessage(receiverUid: "alice", text: "Hi", receiverType: .user),
      TextMessage(receiverUid: "bob", text: "Hey", receiverType: .user),
    ]
    let view = ChatView(messages: messages)
    let host = UIHostingController(rootView: view)
    assertSnapshot(matching: host, as: .image(on: .iPhone13))
  }
}
```

First run creates the reference image; subsequent runs diff against it. Commit the `__Snapshots__` directory.

**Gotcha:** snapshot tests are sensitive to font rendering — if CI uses a different macOS version than dev, snapshots won't match. Pin runners to a known version.

---

## 6. UI tests (XCUITest)

```swift
import XCTest

final class ChatUITests: XCTestCase {
  override func setUp() {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["UI_TEST_MODE"] = "1"
    app.launchEnvironment["TEST_UID"] = "cometchat-uid-1"
    app.launch()
  }

  func testLoginAndSeeConversations() {
    let app = XCUIApplication()
    XCTAssertTrue(app.staticTexts["Welcome"].waitForExistence(timeout: 10))
    app.buttons["Messages"].tap()
    XCTAssertTrue(app.staticTexts["Conversations"].waitForExistence(timeout: 10))
  }

  func testSendMessage() {
    let app = XCUIApplication()
    app.buttons["Messages"].tap()
    app.buttons["cometchat-uid-2"].tap()

    let composer = app.textFields["Type a message"]
    composer.tap()
    composer.typeText("Hello from UI test")
    app.buttons["Send"].tap()

    XCTAssertTrue(app.staticTexts["Hello from UI test"].waitForExistence(timeout: 5))
  }
}
```

**`UI_TEST_MODE` flag:** in production code, check this env var and skip animations / use shorter timeouts:

```swift
if ProcessInfo.processInfo.environment["UI_TEST_MODE"] == "1" {
  UIView.setAnimationsEnabled(false)
}
```

**Test users:** UI tests need real login. Use the dev `cometchat-uid-1` through `cometchat-uid-5`; never use production credentials.

---

## 7. CI configuration

### GitHub Actions

```yaml
name: tests
on: [push, pull_request]

jobs:
  unit:
    runs-on: macos-13                              # pin macOS version for snapshot stability
    steps:
      - uses: actions/checkout@v4
      - run: |
          xcodebuild test \
            -scheme YourApp \
            -destination "platform=iOS Simulator,name=iPhone 15,OS=17.0" \
            -only-testing:YourAppTests \
            COMETCHAT_TEST_APP_ID="${{ secrets.TEST_COMETCHAT_APP_ID }}" \
            COMETCHAT_TEST_REGION="${{ secrets.TEST_COMETCHAT_REGION }}" \
            COMETCHAT_TEST_AUTH_KEY="${{ secrets.TEST_COMETCHAT_AUTH_KEY }}"

  ui:
    runs-on: macos-13
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - run: |
          xcodebuild test \
            -scheme YourApp \
            -destination "platform=iOS Simulator,name=iPhone 15,OS=17.0" \
            -only-testing:YourAppUITests \
            COMETCHAT_TEST_APP_ID="${{ secrets.TEST_COMETCHAT_APP_ID }}"
```

### Xcode Cloud

Configure in App Store Connect → Xcode Cloud. Use the same env var convention; Xcode Cloud injects them into `xcodebuild` automatically.

---

## 8. Anti-patterns

1. **Mocking CometChat directly** (without the protocol wrapper). The static methods aren't swappable; you'd need OCMock and method swizzling. The protocol wrapper is cleaner.
2. **Using real WebSocket connections** in unit tests. They're flaky on CI. Mock the service layer.
3. **Snapshot tests on a Mac with system font preference different from CI.** Pin macOS + Xcode versions.
4. **Hardcoding `cometchat-uid-1` strings** across many tests. Centralize via a `TestUsers` enum so renames are one-edit.
5. **Skipping `continueAfterFailure = false`** in UI tests. Default UI tests continue running after a failure, hiding root causes in cascade failures.
6. **Storing test credentials in `Secrets.swift`.** Use env vars passed via `xcodebuild` and read via `ProcessInfo.processInfo.environment["..."]` in test bundles only.

## 9. Verification checklist

- [ ] `CometChatServiceProtocol` (or similar) wrapping the SDK; production VCs use it via DI
- [ ] Mock implementation in `Tests/Mocks/`
- [ ] At least one test for "init resolves before VC is functional"
- [ ] At least one test for "error UI shows on init/login failure"
- [ ] Snapshot tests for at least the empty + populated states of chat surfaces
- [ ] At least one UI test for login + see conversations
- [ ] Test target uses dedicated CometChat test App ID via env vars (not Secrets.swift)
- [ ] CI pinned to macOS + Xcode versions
- [ ] No `continueAfterFailure = true` in UI tests

## 10. Pointers

- `cometchat-ios-calls/references/callkit-and-pushkit.md` — calls + CallKit testing
- `cometchat-ios-core` — init, login, Secrets patterns the tests assert against
- `cometchat-ios-troubleshooting` — when tests pass but production breaks
