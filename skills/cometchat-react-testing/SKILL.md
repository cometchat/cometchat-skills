---
name: cometchat-react-testing
description: Testing patterns for CometChat React UI Kit v6 in Vite / Next.js / React Router / Astro projects. Covers Vitest + React Testing Library setup, mocking @cometchat/chat-sdk-javascript and @cometchat/chat-uikit-react, Playwright e2e for full chat flows, the chat-specific assertions (init resolves before render, error UI visible, no Auth Key in test files, css-variables.css imported once), and CI configuration. Sister skill of cometchat-react-calls/references/testing-calls-on-web.md.
license: "MIT"
compatibility: "React >= 18, Vitest >= 1, Vite >= 5, @testing-library/react >= 14, Playwright >= 1.40; @cometchat/chat-uikit-react ^6.x"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat react testing vitest react-testing-library playwright e2e mocking jsdom websocket nextjs astro"
---

## Purpose

Test recipes for CometChat React UI Kit integrations. Three layers — unit, component, e2e — three different mocking strategies. This skill writes the configuration and the canonical assertions; real test bodies are app-specific.

**Read these other skills first:**
- `cometchat-core` — init, login, provider patterns the tests assert against
- `cometchat-{react,nextjs,react-router,astro}-patterns` — framework-specific render gates
- `cometchat-react-calls/references/testing-calls-on-web.md` — the calls-specific testing patterns (this skill is for chat)

**Ground truth:**
- Vitest docs — https://vitest.dev/
- React Testing Library — https://testing-library.com/docs/react-testing-library/intro
- Playwright — https://playwright.dev/

---

## 1. Vitest setup

### Install

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,                                    // skip CSS imports — we test behavior, not styles
    exclude: ["**/node_modules/**", "**/e2e/**"],  // e2e runs separately under Playwright
  },
});
```

### `vitest.setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
import { vi, beforeAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// jsdom doesn't have WebSocket — polyfill if any test code reaches that far
if (!("WebSocket" in globalThis)) {
  (globalThis as Record<string, unknown>).WebSocket = class FakeWS {
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

// Polyfill matchMedia for component tests using responsive UI Kit components
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});
```

---

## 2. Mocking the SDK

### Hoisted module mock

```ts
// __tests__/mocks/cometchat.ts
import { vi } from "vitest";

export const mockUser = { uid: "cometchat-uid-1", name: "Alice" };

vi.mock("@cometchat/chat-sdk-javascript", () => ({
  CometChat: {
    init: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue(mockUser),
    logout: vi.fn().mockResolvedValue(true),
    getLoggedinUser: vi.fn().mockResolvedValue(mockUser),
    addMessageListener: vi.fn(),
    removeMessageListener: vi.fn(),
    AppSettingsBuilder: class {
      subscribePresenceForAllUsers() { return this; }
      setRegion() { return this; }
      build() { return {}; }
    },
    REGION: { US: "us", EU: "eu", IN: "in" },
  },
}));

vi.mock("@cometchat/chat-uikit-react", () => ({
  CometChatUIKit: {
    init: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue(mockUser),
    getLoggedinUser: vi.fn().mockResolvedValue(mockUser),
  },
  UIKitSettingsBuilder: class {
    setAppId() { return this; }
    setRegion() { return this; }
    setAuthKey() { return this; }
    subscribePresenceForAllUsers() { return this; }
    build() { return {}; }
  },
  CometChatConversations: () => null,
  CometChatMessageList: () => null,
  CometChatMessageHeader: () => null,
  CometChatMessageComposer: () => null,
  CometChatUsers: () => null,
  CometChatGroups: () => null,
  CometChatIncomingCall: () => null,
  CometChatThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
```

Import this from any test file:

```ts
import "./mocks/cometchat";
```

### Per-test override

Override specific behaviors:

```ts
import { CometChat } from "@cometchat/chat-sdk-javascript";

it("shows error when login fails", async () => {
  vi.mocked(CometChat.login).mockRejectedValueOnce(new Error("401 Unauthorized"));
  render(<CometChatProvider />);
  await screen.findByText(/login failed/i);
});
```

---

## 3. Component-test assertions

### Init resolves before children render

```tsx
import { render, screen } from "@testing-library/react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatProvider } from "../src/cometchat/CometChatProvider";

it("does not render children until login resolves", async () => {
  let resolveLogin: (user: unknown) => void = () => {};
  vi.mocked(CometChat.login).mockImplementation(() =>
    new Promise((resolve) => { resolveLogin = resolve; })
  );

  render(
    <CometChatProvider>
      <div data-testid="children">app contents</div>
    </CometChatProvider>
  );

  // Children should NOT be present yet
  expect(screen.queryByTestId("children")).not.toBeInTheDocument();

  // Resolve login
  resolveLogin({ uid: "cometchat-uid-1" });

  await screen.findByTestId("children");
});
```

### Error UI visible on init failure

```tsx
it("renders red error UI when init fails", async () => {
  vi.mocked(CometChat.init).mockRejectedValueOnce(new Error("Network down"));

  render(<CometChatProvider><div>app</div></CometChatProvider>);

  const error = await screen.findByText(/network down/i);
  expect(error).toBeInTheDocument();
  // The skill's rule: errors must be visible in red — assert color
  expect(error.closest("[style*='color']")).toHaveStyle("color: red");
});
```

### No Auth Key in test files

A meta-test that runs against the project's source:

```ts
import { readFileSync } from "node:fs";
import { glob } from "glob";

it("no Auth Key hardcoded in source files", async () => {
  const files = await glob("src/**/*.{ts,tsx,js,jsx}");
  const hexKeyPattern = /[a-f0-9]{32,}/;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(hexKeyPattern);
    if (matches) {
      // Allow comment / env var name mentions
      const lines = content.split("\n");
      const realHits = lines.filter(line =>
        hexKeyPattern.test(line) && !line.trim().startsWith("//") && !line.includes("AUTH_KEY")
      );
      expect(realHits, `Possible Auth Key in ${file}: ${realHits.join("\n")}`).toHaveLength(0);
    }
  }
});
```

### `css-variables.css` imported exactly once

```ts
it("css-variables.css imported exactly once", async () => {
  const files = await glob("src/**/*.{ts,tsx,css}");
  let count = 0;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    if (content.includes("@cometchat/chat-uikit-react/css-variables.css")) {
      count++;
    }
  }

  expect(count).toBe(1);
});
```

---

## 4. Playwright e2e

### Install

```bash
npm install -D @playwright/test
npx playwright install
```

### `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: devices["Desktop Chrome"] },
    { name: "firefox",  use: devices["Desktop Firefox"] },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
```

### Two-page chat smoke test

```ts
import { test, expect, type Page } from "@playwright/test";

async function loginAs(page: Page, uid: string) {
  await page.goto("/");
  await page.evaluate((uid) => localStorage.setItem("cc-test-uid", uid), uid);
  await page.reload();
  await expect(page.getByText("Welcome")).toBeVisible({ timeout: 10_000 });
}

test("two users send messages back and forth", async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await loginAs(alice, "cometchat-uid-1");
  await loginAs(bob, "cometchat-uid-2");

  await alice.goto("/messages");
  await alice.getByRole("button", { name: "cometchat-uid-2" }).click();
  await alice.getByPlaceholder("Type a message").fill("Hello Bob");
  await alice.getByRole("button", { name: "Send" }).click();

  await bob.goto("/messages");
  await bob.getByRole("button", { name: "cometchat-uid-1" }).click();
  await expect(bob.getByText("Hello Bob")).toBeVisible({ timeout: 10_000 });
});
```

The 10-second timeout is generous — message delivery via WebSocket is usually <500ms but CI hosts have variable latency.

### Test users

CometChat dev mode pre-seeds five test users (`cometchat-uid-1` through `cometchat-uid-5`). Use them in e2e — never create new users in the test app via `Auth Key` flows that leak credentials.

---

## 5. CI configuration

### GitHub Actions

```yaml
name: tests
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run test               # Vitest
        env:
          # Test app credentials — never your prod app
          VITE_COMETCHAT_APP_ID:    ${{ secrets.TEST_COMETCHAT_APP_ID }}
          VITE_COMETCHAT_REGION:    ${{ secrets.TEST_COMETCHAT_REGION }}
          VITE_COMETCHAT_AUTH_KEY:  ${{ secrets.TEST_COMETCHAT_AUTH_KEY }}

  e2e:
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium firefox
      - run: npm run test:e2e
        env:
          VITE_COMETCHAT_APP_ID:    ${{ secrets.TEST_COMETCHAT_APP_ID }}
          VITE_COMETCHAT_REGION:    ${{ secrets.TEST_COMETCHAT_REGION }}
          VITE_COMETCHAT_AUTH_KEY:  ${{ secrets.TEST_COMETCHAT_AUTH_KEY }}
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

**Critical:** use a **dedicated test app** (Dashboard → New App → "ci-tests") for CI. Never share with production. Rotate Auth Key if a CI log accidentally captures it.

---

## 6. Anti-patterns

1. **Mocking `<CometChatConversations />`** with a real implementation. Tests pass because your mock works; production breaks because the real component doesn't. Mock as `() => null` and test the wiring around it.
2. **Skipping `cleanup()` between tests.** State leaks between tests; flakes appear. Always run `afterEach(cleanup)`.
3. **Asserting on internal CSS classes** like `.cc-message-list__bubble`. Brittle to UI Kit upgrades. Assert on text/role/test-id instead.
4. **Hardcoding the Auth Key** in test files. Even if the test app is throwaway, code grep eventually exposes it. Use env vars + GitHub secrets.
5. **Running e2e against the same app as dev.** Test data piles up in your dashboard. Separate apps.
6. **Skipping the "init resolves before render" assertion.** Catches the most common production bug — a component that mounts before login finishes and throws. Worth its weight every time.

## 7. Verification checklist

- [ ] `vitest.config.ts` with `environment: "jsdom"`
- [ ] `vitest.setup.ts` with cleanup + matchMedia polyfill
- [ ] Hoisted SDK mock module (don't repeat per-test)
- [ ] At least one test for "init resolves before children render"
- [ ] At least one test for "error UI visible on init failure"
- [ ] Meta-test: no Auth Key in source
- [ ] Meta-test: css-variables.css imported once
- [ ] Playwright config + at least one two-page chat smoke
- [ ] CI config separates unit + e2e, uses dedicated test app credentials
- [ ] No `.skip()` / `.only()` left in committed test files

## 8. Pointers

- `cometchat-react-calls/references/testing-calls-on-web.md` — calls-specific testing patterns
- `cometchat-core` — init/login patterns the tests assert against
- `cometchat-troubleshooting` — when tests pass but the integration is still broken
