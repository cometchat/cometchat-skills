---
name: cometchat-native-testing
description: "Testing patterns for CometChat React Native — Jest + React Native Testing Library setup, mocking the UI Kit + SDK, testing custom bubbles / headers / composer actions, snapshot pitfalls, E2E with Detox vs Maestro, and CI integration. Covers what to test vs what to skip."
license: "MIT"
compatibility: "Node.js >=18; React Native >=0.70; @cometchat/chat-uikit-react-native ^5; Jest ^29; @testing-library/react-native ^12"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "cometchat react-native testing jest rnt detox maestro ci"
---

## Purpose

Teaches Claude how to write and run tests against a CometChat React Native integration. Covers:

- Unit / component tests with Jest + React Native Testing Library (RNTL)
- How to mock `@cometchat/chat-uikit-react-native` and `@cometchat/chat-sdk-react-native` (both pull in native modules that fail in Node's jest-expo / jest-react-native environments)
- Testing custom bubbles, headers, composer actions, empty states
- Snapshot testing pitfalls specific to theme-driven components
- E2E with Detox (iOS + Android native drivers) vs Maestro (declarative YAML)
- Which tests catch real regressions vs which are flaky churn

Ground truth: `@cometchat/chat-uikit-react-native@5.3.3`'s example jest config (`examples/SampleAppWithPushNotifications/jest.config.js`) and the standard RN testing toolkit docs (callstack.github.io/react-native-testing-library, wix.github.io/Detox, maestro.mobile.dev).

---

## 1. What to test, what to skip

Not every test is worth the maintenance cost. A few rules of thumb:

**Worth testing:**
- Custom components you wrote (custom bubble, custom header, empty-state view)
- Navigation logic triggered by CometChat events (push tap → deep-link)
- Message render logic with text formatters
- Your provider chain wires correctly (four-wrapper order, init called, login called)
- Production auth token refresh + retry logic
- User-ID mapping (Firebase UID → CometChat UID)

**Skip:**
- UI Kit internals — that's the UI Kit's responsibility. Testing `<CometChatConversations>` renders a list is testing CometChat's code.
- Realtime delivery (A sends, B receives) — requires real servers; flaky and slow; use manual QA or E2E with real accounts.
- Presence / typing indicators — race-prone, depend on socket state.
- Snapshot tests of CometChat components — theme changes, UI Kit updates, and `cometchat-native-theming` edits all churn the snapshots with no real signal.
- Native module calls (camera, picker) — Jest's mocks already return stubs; testing them verifies the mock, not the integration.

The golden rule: if the test fails because **your code** changed, it's valuable. If it fails because **the UI Kit updated** or **a network blip happened**, it's churn.

---

## 2. Toolchain

| Layer | Tool | Why |
|---|---|---|
| Unit + component tests | Jest + `@testing-library/react-native` | The RN default. Preset handles metro module resolution. |
| Mocking | Jest `moduleNameMapper` + manual mocks | UI Kit imports native modules — can't run real components in a Node env. |
| Snapshot | Jest's built-in | Use sparingly — see §7 |
| E2E | Maestro OR Detox | See §10 for tradeoff |
| CI | GitHub Actions / EAS / Bitrise | §11 |

Install:
```bash
# Bare RN
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native \
  react-test-renderer @types/jest

# Expo
npx expo install --dev jest-expo @testing-library/react-native @testing-library/jest-native \
  react-test-renderer
```

`jest-expo` wraps `react-native` preset with Expo-specific module resolution (handles `expo-modules-core`, `expo-router`, etc.).

---

## 3. Jest config

**Bare RN** — `jest.config.js`:
```js
module.exports = {
  preset: "react-native",
  setupFilesAfterEach: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(?:react-native|@react-native|@react-navigation|" +
      "@cometchat/chat-uikit-react-native|@cometchat/chat-sdk-react-native|" +
      "react-native-.+|@notifee/react-native)/)",
  ],
  moduleNameMapper: {
    "^@cometchat/chat-uikit-react-native$": "<rootDir>/__mocks__/cometchat-uikit.ts",
    "^@cometchat/chat-sdk-react-native$": "<rootDir>/__mocks__/cometchat-sdk.ts",
  },
};
```

**Expo** — `jest.config.js`:
```js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEach: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(?:(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|" +
      "@expo-google-fonts/.*|react-navigation|@react-navigation/.*|" +
      "@cometchat/chat-uikit-react-native|@cometchat/chat-sdk-react-native|" +
      "@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)/)",
  ],
  moduleNameMapper: {
    "^@cometchat/chat-uikit-react-native$": "<rootDir>/__mocks__/cometchat-uikit.ts",
    "^@cometchat/chat-sdk-react-native$": "<rootDir>/__mocks__/cometchat-sdk.ts",
  },
};
```

**`transformIgnorePatterns` matters.** By default Jest doesn't transform anything under `node_modules`, but CometChat ships ES module source. Without the pattern, Jest errors with `SyntaxError: Unexpected token 'export'`. The UI Kit + SDK names must be in the allow list.

---

## 4. Global setup — `jest.setup.ts`

```ts
import "@testing-library/jest-native/extend-expect";

// Silence RN's "AnimatedValue" warning noise in tests
jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper");

// Mock native modules that the UI Kit pulls in
jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native/Libraries/Components/View/View");
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    State: {},
    Directions: {},
  };
});

// react-native-reanimated is NOT a peer dep of the kit. Only add this
// mock if your app installs reanimated for its own animation needs.
// jest.mock("react-native-reanimated", () =>
//   require("react-native-reanimated/mock"),
// );

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Silence console.warn from legacy components in tests — re-enable locally if debugging
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    /componentWill|Unable to find|act\(\)/i.test(args[0])
  ) {
    return;
  }
  originalWarn(...args);
};
```

---

## 5. Mocking the UI Kit

The UI Kit's top-level components (`CometChatConversations`, `CometChatMessageList`, etc.) wire socket listeners, call native modules, and render FlatLists with async data. Rendering them in Jest is more effort than value.

**Strategy: mock them as transparent Views that forward children.** This lets your tests verify your integration (are the right props being passed? does the right component mount in the right screen?) without pulling in the real implementation.

`__mocks__/cometchat-uikit.ts`:
```ts
import React from "react";
import { View } from "react-native";

const passThrough = (name: string) =>
  React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    const { children, ...rest } = props as { children?: React.ReactNode };
    return (
      <View ref={ref as never} testID={name} {...rest}>
        {children}
      </View>
    );
  });

export const CometChatUIKit = {
  init: jest.fn(async () => undefined),
  login: jest.fn(async () => ({ getUid: () => "cometchat-uid-1" })),
  logout: jest.fn(async () => undefined),
  getLoggedInUser: jest.fn(async () => ({ getUid: () => "cometchat-uid-1" })),
};

// NOTE: the v5 RN UI Kit does NOT export `UIKitSettingsBuilder` — `init()` takes
// a flat `UIKitSettings` object. No mock needed for a builder that doesn't exist.

export const CometChatThemeProvider = passThrough("CometChatThemeProvider");
export const CometChatI18nProvider = passThrough("CometChatI18nProvider");
export const CometChatConversations = passThrough("CometChatConversations");
export const CometChatMessageList = passThrough("CometChatMessageList");
export const CometChatMessageComposer = passThrough("CometChatMessageComposer");
export const CometChatMessageHeader = passThrough("CometChatMessageHeader");
export const CometChatUsers = passThrough("CometChatUsers");
export const CometChatGroups = passThrough("CometChatGroups");
export const CometChatIncomingCall = passThrough("CometChatIncomingCall");
export const CometChatOutgoingCall = passThrough("CometChatOutgoingCall");

export const CometChatUIEventHandler = {
  addUIListener: jest.fn(),
  removeListener: jest.fn(),
};
export const CometChatUIEvents = {};

export const useTheme = () => ({
  color: {
    primary: "#6852D6",
    background1: "#FFFFFF",
    textPrimary: "#141414",
  },
  typography: {
    heading1: { fontFamily: "System", fontSize: 28 },
    body1: { fontFamily: "System", fontSize: 16 },
  },
});
```

`__mocks__/cometchat-sdk.ts`:
```ts
export const CometChat = {
  getUser: jest.fn(async (uid: string) => ({ getUid: () => uid, getName: () => "Test User" })),
  getGroup: jest.fn(async (guid: string) => ({ getGuid: () => guid, getName: () => "Test Group" })),
  addMessageListener: jest.fn(),
  removeMessageListener: jest.fn(),
};

export const CometChatNotifications = {
  PushPlatforms: {
    FCM_REACT_NATIVE_ANDROID: "fcm-android",
    FCM_REACT_NATIVE_IOS: "fcm-ios",
    APNS_REACT_NATIVE_DEVICE: "apns-device",
    APNS_REACT_NATIVE_VOIP: "apns-voip",
  },
  registerPushToken: jest.fn(async () => ({ success: true })),
  unregisterPushToken: jest.fn(async () => ({ success: true })),
};
```

Every real `<CometChatMessageList>` in your code renders as `<View testID="CometChatMessageList">` in tests. You can assert on `testID` + the props you passed.

---

## 6. Testing a custom component

Example — a custom chat screen that renders `<CometChatMessageList>` for a specific user:

```tsx
// src/screens/MessagesScreen.tsx
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { CometChatMessageList } from "@cometchat/chat-uikit-react-native";
import { useEffect, useState } from "react";

export function MessagesScreen({ uid }: { uid: string }) {
  const [user, setUser] = useState<CometChat.User | null>(null);

  useEffect(() => {
    CometChat.getUser(uid).then(setUser);
  }, [uid]);

  if (!user) return null;

  return <CometChatMessageList user={user} hideReplyInThreadOption />;
}
```

Test:
```tsx
// src/screens/__tests__/MessagesScreen.test.tsx
import { render, waitFor } from "@testing-library/react-native";
import { CometChat } from "@cometchat/chat-sdk-react-native";
import { MessagesScreen } from "../MessagesScreen";

test("fetches user then renders MessageList", async () => {
  const { getByTestId, queryByTestId } = render(<MessagesScreen uid="alice" />);

  // Before fetch resolves — nothing rendered
  expect(queryByTestId("CometChatMessageList")).toBeNull();

  // After fetch resolves — list renders with user prop
  await waitFor(() => expect(getByTestId("CometChatMessageList")).toBeTruthy());

  expect(CometChat.getUser).toHaveBeenCalledWith("alice");
});

test("passes hideReplyInThreadOption to MessageList", async () => {
  const { findByTestId } = render(<MessagesScreen uid="alice" />);
  const list = await findByTestId("CometChatMessageList");

  // The mocked component stored props on the View — check them
  expect(list.props.hideReplyInThreadOption).toBe(true);
});
```

The second test is the valuable one — it guards the mandatory `hideReplyInThreadOption` flag (hard rule §4 in `cometchat-native-core`) against a future refactor dropping it.

---

## 7. Snapshot testing — use sparingly

**Do snapshot:**
- Pure presentational components with no UI Kit dependency
- Custom bubble renderers with fixed inputs
- Data transforms (message → display string)

**Don't snapshot:**
- Anything wrapped in `CometChatThemeProvider` — a token change churns snapshots with no regression meaning.
- Components rendering UI Kit internals — even with mocks, prop churn from UI Kit updates churns your snapshots.
- Navigators / full screens — too many variables.

```tsx
// Good — isolated, theme-free
test("formatTimestamp(1700000000000) matches snapshot", () => {
  expect(formatTimestamp(1_700_000_000_000)).toMatchInlineSnapshot(`"Tue, 14 Nov 2023"`);
});
```

If a snapshot test churns on every UI Kit update, delete it — it's net-negative.

---

## 8. Testing the provider chain

The four-wrapper chain (hard rule §3 in `cometchat-native-core`) is one of the most common regressions AI edits introduce. Test that all four wrappers render:

```tsx
// src/App.test.tsx
import { render } from "@testing-library/react-native";
import App from "./App";

test("App mounts all four CometChat wrappers", () => {
  const { getByTestId } = render(<App />);

  // The mocked wrappers each render a View with testID matching their name
  expect(getByTestId("CometChatThemeProvider")).toBeTruthy();
  // Note: GestureHandlerRootView and SafeAreaProvider are pass-through Views
  // without distinct testIDs in our setup, so assert via presence of children
  // OR extend the mock in jest.setup.ts to add testIDs.
});
```

For the `GestureHandlerRootView` + `SafeAreaProvider` assertion, extend their mocks in `jest.setup.ts` to add `testID`:

```ts
jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return {
    GestureHandlerRootView: (props: any) =>
      require("react").createElement(View, { ...props, testID: "GestureHandlerRootView" }),
    // ...
  };
});
```

---

## 9. Testing login lifecycle

The `ensureLoggedIn` helper (hard rule §2 in `cometchat-native-core`) must handle concurrent calls safely:

```tsx
// src/providers/__tests__/CometChatProvider.test.tsx
import { CometChatUIKit } from "@cometchat/chat-uikit-react-native";
import { ensureLoggedIn } from "../CometChatProvider";

beforeEach(() => {
  jest.clearAllMocks();
});

test("concurrent ensureLoggedIn calls only invoke login once", async () => {
  (CometChatUIKit.getLoggedInUser as jest.Mock).mockResolvedValue(null);

  const results = await Promise.all([
    ensureLoggedIn("alice"),
    ensureLoggedIn("alice"),
    ensureLoggedIn("alice"),
  ]);

  expect(CometChatUIKit.login).toHaveBeenCalledTimes(1);
});

test("already-logged-in skips login entirely", async () => {
  (CometChatUIKit.getLoggedInUser as jest.Mock).mockResolvedValue({
    getUid: () => "alice",
  });

  await ensureLoggedIn("alice");

  expect(CometChatUIKit.login).not.toHaveBeenCalled();
});
```

These two tests catch the most common `ensureLoggedIn` breakages — dropping the module-level promise guard, or forgetting the `getLoggedInUser` short-circuit.

---

## 10. E2E — Detox vs Maestro

Two choices for end-to-end. Different philosophies.

| | Detox | Maestro |
|---|---|---|
| Config | Native drivers (iOS + Android). `.detoxrc.js`. | YAML flows. Single binary. |
| Language | JavaScript / TypeScript | YAML |
| Setup | Heavy — Xcode build, Detox CLI, Jest runner | Light — brew install, run CLI |
| CI | Slow (full native build each run) | Fast (reuses install) |
| Speed | Flaky in CI, reliable locally | Fast, stable |
| iOS + Android parity | Yes | Yes |
| Cloud runs | No native cloud support | Maestro Cloud (paid) |
| Learning curve | Steep if you don't know RN internals | Low |

**Recommendation: Maestro for most teams.** Flows are readable, runs in seconds, CI-friendly. Detox makes sense if you have existing Jest infrastructure and want E2E to live in the same runner.

### Maestro flow (recommended)

`.maestro/chat-happy-path.yaml`:
```yaml
appId: com.yourapp.mobile
---
- launchApp
- tapOn: "Login"
- inputText: "cometchat-uid-1"
- tapOn: "Continue"
- assertVisible: "Messages"
- tapOn: "Messages"
- assertVisible: "Conversations"
- tapOn: id: "conversation-cometchat-uid-2"
- inputText: "Hello from Maestro"
- tapOn: id: "send-button"
- assertVisible: "Hello from Maestro"
```

Run:
```bash
maestro test .maestro/chat-happy-path.yaml
```

Needs your RN `<CometChatMessageComposer>` to expose `testID="send-button"` — the UI Kit supports this via the `sendButtonStyle` slot or via a Custom view template.

### Detox

`.detoxrc.js` (abbreviated):
```js
module.exports = {
  testRunner: { args: { $0: "jest", config: "e2e/jest.config.js" } },
  apps: {
    "ios.debug": {
      type: "ios.app",
      binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/YourApp.app",
    },
  },
  devices: { simulator: { type: "ios.simulator", device: { type: "iPhone 15" } } },
  configurations: {
    "ios.sim.debug": { device: "simulator", app: "ios.debug" },
  },
};
```

Test:
```ts
// e2e/chat.test.ts
describe("chat flow", () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it("sends a message", async () => {
    await element(by.text("Login")).tap();
    await element(by.id("uid-input")).typeText("cometchat-uid-1");
    await element(by.text("Continue")).tap();
    await element(by.text("Messages")).tap();
    await element(by.id("conversation-cometchat-uid-2")).tap();
    await element(by.id("message-input")).typeText("Hello from Detox");
    await element(by.id("send-button")).tap();
    await expect(element(by.text("Hello from Detox"))).toBeVisible();
  });
});
```

Detox needs a native dev build first (`detox build --configuration ios.sim.debug`) — slow in CI.

### What NOT to E2E

- Login with a real auth provider (Firebase / Clerk). Mock the auth callback or use a test account with a fixed password.
- Real push delivery. Fire via a CI-only fake push tool, or skip entirely.
- Group calls with real peers. Use two simulators only if Detox/Maestro supports it (both do, but flaky).

---

## 11. CI integration

### GitHub Actions — Jest on every push

`.github/workflows/test.yml`:
```yaml
name: test
on: [push, pull_request]
jobs:
  jest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test -- --ci --coverage
```

### Maestro in CI

Maestro runs on macOS runners (iOS) or Linux runners with Android emulators. The `mobile-dev-inc/action-maestro-cloud` action simplifies it:

```yaml
  e2e:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - name: Build iOS
        run: |
          cd ios
          pod install
          xcodebuild -workspace YourApp.xcworkspace -scheme YourApp \
            -sdk iphonesimulator -configuration Debug \
            -derivedDataPath build
      - name: Run Maestro flows
        uses: mobile-dev-inc/action-maestro-cloud@v1
        with:
          api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
          app-file: ios/build/Build/Products/Debug-iphonesimulator/YourApp.app
          workspace: .maestro
```

### EAS + Expo

If you're on EAS, `eas build --profile preview` followed by `maestro test` against the preview build works for CI smoke tests. EAS Test (paid) orchestrates Maestro runs across multiple devices.

---

## 12. Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `SyntaxError: Unexpected token 'export'` | Jest not transforming a UI Kit or SDK file | Add package name to `transformIgnorePatterns` allow list |
| `TypeError: Cannot read properties of undefined (reading 'Directions')` | Gesture handler native module missing | Mock in `jest.setup.ts` (see §4) |
| Tests hang for 30s+ | Real WebSocket or fetch not mocked | Add `jest.useFakeTimers()` + mock `fetch` |
| Snapshot fails after no code change | Theme token update churned output | Either delete the snapshot (§7) or run `--updateSnapshot` |
| `useInsertionEffect must not schedule updates` warning | React Navigation dev warning, harmless in tests | Silence in `jest.setup.ts` (see §4) |
| `Could not find React Testing Library matchers` | `@testing-library/jest-native` not extended | `import "@testing-library/jest-native/extend-expect"` in setup |
| Maestro "app not installed" | Bundle ID mismatch or simulator not booted | `xcrun simctl boot "iPhone 15"`, verify `appId` in YAML |
| Detox "Cannot find element" | `testID` not set on UI Kit component | Add via slot view template or custom view; don't rely on text matching |

---

## 13. Hard rules

- **Mock the UI Kit and SDK in every test file.** Running real components in Node fails on native modules and wastes CI time even when it works.
- **Don't test what the UI Kit already tests.** You're responsible for YOUR code — bubbles, headers, navigation, auth mapping. UI Kit internals are CometChat's job.
- **Skip realtime and presence.** They require real servers and produce flaky suites. Use manual QA or E2E with real test accounts.
- **Assert on `testID` and prop values, not on pixel output.** Theme changes, font metrics, and platform differences all churn pixel-level assertions.
- **Keep snapshot tests scoped.** Use for pure data transforms and isolated presentational code. Never snapshot a full screen.
- **E2E tests run against a dev build, not Jest.** Don't try to test real CometChat flow in Jest — it belongs in Detox/Maestro.

---

## 14. Skill routing

| This skill | Covers |
|---|---|
| `cometchat-native-testing` (this) | Jest + RNTL setup, mocking UI Kit + SDK, component / provider / login tests, Detox vs Maestro for E2E, CI |
| `cometchat-native-core` | The provider chain + login concurrency patterns you're testing |
| `cometchat-native-components` | Component catalog — what props to assert in tests |
| `cometchat-native-customization` | DataSource decorators + custom views — test per §6 |
| `cometchat-native-push` | Push tests (mock `CometChatNotifications`); E2E tap-to-deep-link needs a real device |
| `cometchat-native-troubleshooting` | Metro cache / pod install / native module errors (often surface first in a CI run) |
