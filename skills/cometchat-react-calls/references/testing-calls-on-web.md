# Testing calls on web

Calls are the hardest CometChat surface to unit-test because they touch native browser APIs (`getUserMedia`, `RTCPeerConnection`) that don't exist in jsdom. Three layers, three strategies:

1. **Unit tests** — mock the entire Calls SDK; assert your code calls the right methods in the right order.
2. **Component tests** — Vitest + React Testing Library; mock `getUserMedia` and `RTCPeerConnection`; assert your custom UI renders correctly given mocked SDK events.
3. **E2E tests** — Playwright with the headless WebRTC flag; real two-tab call between two test users.

This reference covers all three. For chat-side testing patterns, see `cometchat-react-testing` (sibling skill).

---

## 1. Unit tests — mock the SDK module

Vitest's `vi.mock` with a hoisted factory:

```ts
// __tests__/CallButton.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CometChatCalls } from "@cometchat/calls-sdk-javascript";
import { CallButton } from "../src/components/CallButton";

vi.mock("@cometchat/chat-sdk-javascript", () => ({
  CometChat: {
    initiateCall: vi.fn().mockResolvedValue({ getSessionId: () => "session-123" }),
    Call: vi.fn((uid, type, recv) => ({ uid, type, recv })),
    CALL_TYPE: { VOICE: "voice", VIDEO: "video" },
    RECEIVER_TYPE: { USER: "user" },
  },
}));

vi.mock("@cometchat/calls-sdk-javascript", () => ({
  CometChatCalls: {
    init: vi.fn(),
    generateToken: vi.fn().mockResolvedValue({ token: "rtc-token" }),
    startSession: vi.fn(),
    endSession: vi.fn(),
    CallSettingsBuilder: class {
      setSessionID() { return this; }
      setIsAudioOnly() { return this; }
      enableDefaultLayout() { return this; }
      build() { return {}; }
    },
  },
}));

beforeEach(() => vi.clearAllMocks());

describe("CallButton", () => {
  it("initiates a video call when video button clicked", async () => {
    const { CometChat } = await import("@cometchat/chat-sdk-javascript");
    render(<CallButton user={{ uid: "alice" }} />);

    await fireEvent.click(screen.getByLabelText("Start video call"));

    expect(CometChat.initiateCall).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "alice", type: "video" }),
    );
  });
});
```

---

## 2. Component tests — mock `getUserMedia` + `RTCPeerConnection`

For tests that exercise your custom UI's reaction to track-arrived events:

```ts
// vitest.setup.ts
import { vi } from "vitest";

beforeAll(() => {
  // jsdom doesn't have navigator.mediaDevices — polyfill it
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [
          { kind: "audio", stop: vi.fn() },
          { kind: "video", stop: vi.fn() },
        ],
      }),
      getDisplayMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  });

  // Polyfill RTCPeerConnection
  (global as Record<string, unknown>).RTCPeerConnection = class {
    addTrack = vi.fn();
    addEventListener = vi.fn();
    createOffer = vi.fn().mockResolvedValue({ sdp: "fake-offer", type: "offer" });
    createAnswer = vi.fn().mockResolvedValue({ sdp: "fake-answer", type: "answer" });
    setLocalDescription = vi.fn();
    setRemoteDescription = vi.fn();
    close = vi.fn();
  };
});
```

Reference this in `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    environment: "jsdom",
  },
});
```

---

## 3. E2E tests — Playwright with WebRTC enabled

Playwright supports real WebRTC in headless mode with the right Chromium flag:

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  use: {
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",          // auto-grants getUserMedia
        "--use-fake-device-for-media-stream",      // synthetic camera (animated pattern)
        "--allow-running-insecure-content",
      ],
    },
  },
});
```

Then a two-page test exercises the full call flow:

```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, uid: string) {
  await page.goto("/");
  await page.evaluate((uid) => localStorage.setItem("cc-test-uid", uid), uid);
  await page.reload();
  await expect(page.getByTestId("logged-in-banner")).toBeVisible();
}

test("alice calls bob; bob answers; both see two-way video", async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await login(alice, "cometchat-uid-1");
  await login(bob, "cometchat-uid-2");

  // Alice clicks call on Bob's profile
  await alice.goto("/users/cometchat-uid-2");
  await alice.getByLabel("Start video call").click();

  // Bob's IncomingCall overlay appears
  await expect(bob.getByText("Incoming call from")).toBeVisible({ timeout: 10_000 });
  await bob.getByRole("button", { name: "Accept" }).click();

  // Both see the ongoing-call view
  await expect(alice.getByTestId("ongoing-call")).toBeVisible();
  await expect(bob.getByTestId("ongoing-call")).toBeVisible();

  // Verify two video elements are playing (synthetic streams)
  const aliceVideos = await alice.locator("video").count();
  expect(aliceVideos).toBeGreaterThanOrEqual(2);   // local + remote

  // Hangup
  await alice.getByRole("button", { name: "End" }).click();
  await expect(alice.getByTestId("ongoing-call")).not.toBeVisible();
  await expect(bob.getByTestId("ongoing-call")).not.toBeVisible();
});
```

**Synthetic stream gotcha:** the `--use-fake-device-for-media-stream` flag makes Chrome stream a green-and-blue animated pattern. Real cameras / mics are NOT used, so you cannot assert "this video shows the user's face." You CAN assert "two video elements with `srcObject` set," which is what 90% of tests need.

---

## CI gotchas

- **Linux GPU + WebRTC:** GitHub Actions Ubuntu runners have headless Chrome but no GPU. Pass `--disable-gpu` if you see WebRTC errors about GPU process crash; the synthetic stream still works.
- **Test isolation:** real CometChat App ID + Auth Key in CI. Use a dedicated test app (Dashboard → New App → "ci-tests"); don't reuse production credentials.
- **Rate limits:** the CometChat backend rate-limits `initiateCall` per user. Tests that loop call/hangup quickly hit limits; throttle to ~5 calls/minute per test UID or rotate UIDs (`cometchat-uid-1` through `cometchat-uid-5` are pre-seeded).
- **Cleanup:** kill any active calls between tests via `CometChatCalls.leaveSession()` in afterEach. Stale sessions cause the next test's `initiateCall` to fail.

---

## What NOT to mock

- **Don't mock `useEffect` cleanup.** It's where rule 1.3's track-stop happens; mocking hides bugs in the cleanup path.
- **Don't mock `navigator.mediaDevices` to return synchronous values.** Real APIs are async; mocks should be too, otherwise you mask race conditions in your real code.
- **Don't mock the kit components themselves** (`<CometChatIncomingCall />` etc.) for unit tests — they're tested by CometChat. Mock the SDK that the kit calls.
