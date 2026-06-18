---
name: cometchat-angular-testing
description: Testing patterns for CometChat Angular UI Kit v5 (@cometchat/chat-uikit-angular@5) in Angular 17–21 projects. Covers Jasmine/Karma (default) and Jest, Angular TestBed for STANDALONE components (imports[] not declarations[]), mocking the static CometChatUIKit kit API (init/login/getLoggedInUser/getLoggedinUser/loginWithAuthToken/logout) and the loggedInUser$ observable, fakeAsync/tick for Promise-based login, stubbing the kit's standalone <cometchat-*> components, Playwright/Cypress e2e, and CI. Mirrors cometchat-react-testing for the mocking philosophy.
license: "MIT"
compatibility: "Angular >=17 <22; @cometchat/chat-uikit-angular ^5.0; Jasmine + Karma (default ng test) OR Jest + jest-preset-angular; Playwright >= 1.40 OR Cypress >= 13"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular testing jasmine karma jest testbed standalone fakeasync tick ngzone playwright cypress e2e mocking v5"
---

## Purpose

Test recipes for CometChat **Angular UI Kit v5** (`@cometchat/chat-uikit-angular@5`) integrations. Three layers — unit, component, e2e — three different mocking strategies. This skill writes the configuration and the canonical assertions; real test bodies are app-specific.

v5 is **standalone-component-based** (Angular 17–21). That changes how you test, versus the old v4 NgModule kit: standalone components go in TestBed's `imports`, **never** `declarations`; and v5 components are real Angular components, so the old `CUSTOM_ELEMENTS_SCHEMA` crutch is **not** how you handle `<cometchat-*>` selectors — you stub the component classes instead.

**Read these other skills first:**
- `cometchat-angular-core` — the `init → login → render` order, the static `CometChatUIKit` API, and `loggedInUser$`. The tests below assert against exactly those.
- `cometchat-angular-patterns` — standalone wiring, NgZone, change detection.
- `cometchat-angular-calls` — for the calls-specific testing patterns (this skill is for chat).

**Ground truth:** **Official docs:** https://www.cometchat.com/docs/ui-kit/angular/overview · **Docs MCP:** `claude mcp add --transport http cometchat-docs https://www.cometchat.com/docs/mcp` (or fetch the URL directly without MCP).
- Installed kit types — `node_modules/@cometchat/chat-uikit-angular/types/cometchat-chat-uikit-angular.d.ts`. Verify any non-obvious symbol here before relying on it.
- Angular testing — https://angular.dev/guide/testing
- jest-preset-angular — https://github.com/thymikee/jest-preset-angular
- Playwright — https://playwright.dev/ · Cypress — https://docs.cypress.io/

---

## 1. Jasmine/Karma vs Jest — pick one

| Criterion | Jasmine + Karma (default) | Jest |
|---|---|---|
| Comes with `ng new` | ✓ | ✗ (manual setup) |
| Speed | Slower (real browser) | Faster (jsdom) |
| Real browser parity | Higher | Lower (no real CSS / layout) |
| Snapshot testing | Awkward | First-class |
| CI complexity | Needs ChromeHeadless | Pure Node |

Default to Jasmine/Karma if the project already uses it (every `ng new` through Angular 19 scaffolds it); use Jest if the team has already adopted it. The TestBed assertions in this skill are runner-agnostic — only the spy syntax differs (`jasmine.createSpyObj` / `spyOn` vs `jest.fn()` / `jest.spyOn`).

> **Note (Angular 20+ / vitest):** Angular 20 ships an experimental **vitest** test runner, and the CometChat Angular kit's own test suite runs on vitest + `@analogjs/vitest-angular` (jsdom). If the consumer project already uses vitest, the same TestBed code below applies verbatim — spies become `vi.fn()` / `vi.spyOn(...).mockResolvedValue(...)`, and module mocks use `vi.mock("@cometchat/chat-uikit-angular", ...)`. The standalone `imports: [Component]` model is identical regardless of runner.

### Jasmine/Karma setup (default Angular)

Already configured by `ng new`. The skill writes test files only.

### Jest setup

```bash
npm install -D jest @types/jest jest-preset-angular @angular-builders/jest
ng add @angular-builders/jest
```

`jest.config.js`:

```js
module.exports = {
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/setup-jest.ts"],
  globalSetup: "jest-preset-angular/global-setup",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/cypress/", "/e2e/"],
};
```

`setup-jest.ts`:

```ts
import "jest-preset-angular/setup-jest";
```

---

## 2. Mocking the kit — `spyOn` the static `CometChatUIKit` methods

The cardinal rule (same as the React testing skill): **mock the static kit API; never hit the network in a unit/component test.** `CometChatUIKit.init` / `login` open a real WebSocket and call CometChat's backend — un-mocked, your tests are slow, flaky, and dependent on a live app.

The v5 kit surface you mock (verified against the installed `.d.ts`):

| Symbol | Shape | Notes |
|---|---|---|
| `CometChatUIKit.init(settings)` | `Promise<InitResult> \| undefined` | async — mock with `Promise.resolve(...)` |
| `CometChatUIKit.login(uid)` | `Promise<CometChat.User>` | **bare string uid**, not `{ uid }` |
| `CometChatUIKit.loginWithAuthToken(token)` | `Promise<CometChat.User>` | production token path |
| `CometChatUIKit.getLoggedInUser()` | `CometChat.User \| null` | **sync** getter (capital "In") |
| `CometChatUIKit.getLoggedinUser()` | `Promise<CometChat.User \| null>` | **async** getter (lowercase "in") |
| `CometChatUIKit.loggedInUser$` | observable | reactive current-user stream |
| `CometChatUIKit.logout()` | `Promise<LogoutResult>` | |

Get the casing right: `getLoggedInUser()` is synchronous and returns immediately; `getLoggedinUser()` returns a Promise. They are different methods — mocking the wrong one is a silent no-op that masks bugs.

### Jasmine/Karma — `spyOn` the statics

```ts
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { of } from "rxjs";

export const mockUser = { getUid: () => "cometchat-uid-1", getName: () => "Alice" } as any;

export function spyOnCometChatUIKit() {
  spyOn(CometChatUIKit, "init").and.resolveTo({} as any);
  spyOn(CometChatUIKit, "login").and.resolveTo(mockUser);
  spyOn(CometChatUIKit, "loginWithAuthToken").and.resolveTo(mockUser);
  spyOn(CometChatUIKit, "getLoggedInUser").and.returnValue(mockUser);     // sync
  spyOn(CometChatUIKit, "getLoggedinUser").and.resolveTo(mockUser);       // async
  spyOn(CometChatUIKit, "logout").and.resolveTo({} as any);
  // loggedInUser$ is a static property, not a method — redefine it:
  Object.defineProperty(CometChatUIKit, "loggedInUser$", {
    value: of(mockUser), configurable: true,
  });
}
```

`.and.resolveTo(x)` is Jasmine sugar for `.and.returnValue(Promise.resolve(x))`. Call `spyOnCometChatUIKit()` in `beforeEach` **before** `fixture.detectChanges()`.

### Jest — `jest.spyOn`

```ts
import { CometChatUIKit } from "@cometchat/chat-uikit-angular";
import { of } from "rxjs";

export const mockUser = { getUid: () => "cometchat-uid-1", getName: () => "Alice" } as any;

export function spyOnCometChatUIKit() {
  jest.spyOn(CometChatUIKit, "init").mockResolvedValue({} as any);
  jest.spyOn(CometChatUIKit, "login").mockResolvedValue(mockUser);
  jest.spyOn(CometChatUIKit, "loginWithAuthToken").mockResolvedValue(mockUser);
  jest.spyOn(CometChatUIKit, "getLoggedInUser").mockReturnValue(mockUser); // sync
  jest.spyOn(CometChatUIKit, "getLoggedinUser").mockResolvedValue(mockUser); // async
  jest.spyOn(CometChatUIKit, "logout").mockResolvedValue({} as any);
  Object.defineProperty(CometChatUIKit, "loggedInUser$", {
    value: of(mockUser), configurable: true,
  });
}
```

### Per-test override

```ts
it("shows error when login fails", fakeAsync(() => {
  // Jasmine: re-stub for this test
  (CometChatUIKit.login as jasmine.Spy).and.rejectWith(new Error("401 Unauthorized"));
  // Jest equivalent: .mockRejectedValueOnce(new Error("401 Unauthorized"))

  fixture.detectChanges();
  tick();
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector(".error-message").textContent)
    .toContain("401");
}));
```

> If your app wraps the kit in a `CometChatInitService` (the `cometchat-angular-core` `APP_INITIALIZER` pattern), you can instead provide a fake service via `{ provide: CometChatInitService, useValue: spy }` and skip spying the statics. Either is valid — spy the layer your component actually depends on. Don't do both; it's redundant and confusing.

---

## 3. TestBed for STANDALONE components — `imports`, not `declarations`

v5 integration components are **standalone**. So is the component under test (it imports the kit classes into its own `imports: []`). In TestBed, a standalone component goes in **`imports`**:

```ts
// chat.component.spec.ts
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ChatComponent } from "./chat.component";
import { spyOnCometChatUIKit } from "./testing/cometchat-spies";

describe("ChatComponent", () => {
  let fixture: ComponentFixture<ChatComponent>;
  let component: ChatComponent;

  beforeEach(async () => {
    spyOnCometChatUIKit();

    await TestBed.configureTestingModule({
      imports: [ChatComponent],   // ← standalone component goes in imports, NOT declarations
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
  });

  it("creates", () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });
});
```

Putting a standalone component in `declarations` throws `Component ... is standalone, and cannot be declared in an NgModule. Use imports instead.` — there is no `CUSTOM_ELEMENTS_SCHEMA` workaround here, and you should not reach for one: that was the v4 NgModule mental model.

---

## 4. Stub the kit's `<cometchat-*>` components

`ChatComponent`'s template renders, say, `<cometchat-conversations>`. The real `CometChatConversationsComponent` reaches into the SDK on init — exactly the network access you're mocking away. Replace it with a lightweight stub via `TestBed.overrideComponent`:

```ts
import { Component } from "@angular/core";
import {
  CometChatConversationsComponent,
  CometChatMessageListComponent,
  CometChatMessageComposerComponent,
  CometChatMessageHeaderComponent,
} from "@cometchat/chat-uikit-angular";

// A stub that reuses the real selector but renders nothing real.
@Component({ selector: "cometchat-conversations", standalone: true, template: "" })
class CometChatConversationsStub {}

@Component({ selector: "cometchat-message-list", standalone: true, template: "" })
class CometChatMessageListStub {}

@Component({ selector: "cometchat-message-composer", standalone: true, template: "" })
class CometChatMessageComposerStub {}

@Component({ selector: "cometchat-message-header", standalone: true, template: "" })
class CometChatMessageHeaderStub {}

beforeEach(async () => {
  spyOnCometChatUIKit();

  await TestBed.configureTestingModule({
    imports: [ChatComponent],
  })
    // swap each real kit component for its stub
    .overrideComponent(ChatComponent, {
      remove: {
        imports: [
          CometChatConversationsComponent,
          CometChatMessageListComponent,
          CometChatMessageComposerComponent,
          CometChatMessageHeaderComponent,
        ],
      },
      add: {
        imports: [
          CometChatConversationsStub,
          CometChatMessageListStub,
          CometChatMessageComposerStub,
          CometChatMessageHeaderStub,
        ],
      },
    })
    .compileComponents();

  fixture = TestBed.createComponent(ChatComponent);
});
```

The stub keeps the same selector (`cometchat-conversations`), so the template still compiles and renders — but nothing hits the SDK. This is the Angular analogue of the React skill's `CometChatConversations: () => null` module mock.

Component class names (verified against the v5 `.d.ts`) carry the **`Component`** suffix; the HTML selectors do **not**:

| Class (import / override) | Selector (template / stub) |
|---|---|
| `CometChatConversationsComponent` | `<cometchat-conversations>` |
| `CometChatMessageListComponent` | `<cometchat-message-list>` |
| `CometChatMessageComposerComponent` | `<cometchat-message-composer>` |
| `CometChatMessageHeaderComponent` | `<cometchat-message-header>` |
| `CometChatUsersComponent` | `<cometchat-users>` |
| `CometChatGroupsComponent` | `<cometchat-groups>` |
| `CometChatIncomingCallComponent` | `<cometchat-incoming-call>` |

See `cometchat-angular-components` for the full catalog. Never invent a selector — confirm it in the `.d.ts`.

---

## 5. `fakeAsync` + `tick` for the Promise-based lifecycle

`init()` and `login()` are Promises. A component that gates its UI on them (`*ngIf="ready"`) only flips after those resolve. In tests, flush them with `fakeAsync` + `tick()`:

```ts
import { fakeAsync, tick } from "@angular/core/testing";

it("logs in then becomes ready", fakeAsync(() => {
  fixture.detectChanges();   // triggers ngOnInit → init/login Promise chain
  tick();                    // flush microtasks (the resolved Promises)
  fixture.detectChanges();   // re-render now that ready === true

  expect(CometChatUIKit.login).toHaveBeenCalledWith("cometchat-uid-1");  // bare string
  expect(fixture.nativeElement.querySelector("cometchat-conversations")).toBeTruthy();
}));
```

### Init resolves before children render (the highest-value test)

Mirrors the React skill's "does not render children until login resolves" — catches the single most common production bug, a `<cometchat-*>` mounting before login finishes.

```ts
it("does not render chat UI until login resolves", fakeAsync(() => {
  let resolveLogin!: (u: unknown) => void;
  (CometChatUIKit.login as jasmine.Spy).and.returnValue(
    new Promise((res) => { resolveLogin = res; })
  );

  fixture.detectChanges();
  tick();
  fixture.detectChanges();

  // login still pending → chat UI gated off
  expect(fixture.nativeElement.querySelector("cometchat-conversations")).toBeNull();

  resolveLogin({ uid: "cometchat-uid-1" });
  tick();
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector("cometchat-conversations")).toBeTruthy();
}));
```

> If the component's promise chain schedules work via `setTimeout` / `requestAnimationFrame` (common when bridging SDK callbacks back into Angular's zone — see `cometchat-angular-patterns`), advance the virtual clock with `tick(N)` for N ms. As an alternative to `fakeAsync`, an `async` test with `await fixture.whenStable()` works too — but never write an `async` test body whose assertion isn't awaited (it passes trivially).

### Asserting on `loggedInUser$`

```ts
it("exposes the current user from loggedInUser$", fakeAsync(() => {
  fixture.detectChanges();
  tick();
  expect(component.currentUser?.getUid()).toBe("cometchat-uid-1");
}));
```

---

## 6. Meta-tests against source (mirror the React skill)

### No Auth Key hardcoded in source

The Auth Key belongs in `src/environments/environment.ts` (dev) and never in production builds. A meta-test catches accidental inlining anywhere:

```ts
import { readFileSync } from "node:fs";
import { globSync } from "glob";   // glob v9+ named export (NOT `sync as glob`, removed in v10)

it("no Auth Key hardcoded outside environment files", () => {
  const files = globSync("src/**/*.{ts,html}");
  const hexKey = /[a-f0-9]{32,}/;

  for (const file of files) {
    if (/environments\//.test(file)) continue;          // env files are the allowed home (dev)
    const offenders = readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => hexKey.test(l) && !l.trim().startsWith("//") && !/AUTH_KEY/i.test(l));
    expect(offenders, `Possible Auth Key in ${file}:\n${offenders.join("\n")}`).toHaveLength(0);
  }
});
```

### Kit assets are wired in `angular.json`

The single most-missed v5 setup step is the assets glob (missing it = broken icons everywhere). Assert it once:

```ts
it("angular.json copies the CometChat kit assets", () => {
  const cfg = readFileSync("angular.json", "utf8");
  expect(cfg).toContain("@cometchat/chat-uikit-angular/src/lib/assets");
});
```

### No `CUSTOM_ELEMENTS_SCHEMA` for CometChat (v4 smell)

```ts
it("does not use CUSTOM_ELEMENTS_SCHEMA in component specs/sources", () => {
  const files = globSync("src/**/*.ts");
  for (const file of files) {
    const c = readFileSync(file, "utf8");
    if (c.includes("@cometchat/chat-uikit-angular") && c.includes("CUSTOM_ELEMENTS_SCHEMA")) {
      throw new Error(`${file}: v5 components are standalone — drop CUSTOM_ELEMENTS_SCHEMA`);
    }
  }
  expect(true).toBe(true);
});
```

---

## 7. Production token endpoint — `HttpTestingController`

Only if your app fetches an auth token from your backend before `loginWithAuthToken`. Test the HTTP call with `HttpTestingController`; still spy `loginWithAuthToken` so nothing hits CometChat:

```ts
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting, HttpTestingController } from "@angular/common/http/testing";

describe("TokenAuthService", () => {
  let http: HttpTestingController;
  let service: TokenAuthService;

  beforeEach(() => {
    spyOnCometChatUIKit();
    TestBed.configureTestingModule({
      // Angular 17+ : provider functions, NOT the deprecated HttpClientTestingModule
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TokenAuthService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TokenAuthService);
  });

  afterEach(() => http.verify());

  it("fetches a token then logs in with it", fakeAsync(() => {
    service.loginCurrentUser("cometchat-uid-1");

    const req = http.expectOne("https://api.yourapp.com/cometchat-token");
    expect(req.request.method).toBe("POST");
    req.flush({ authToken: "AUTH_TOKEN_123" });

    tick();
    expect(CometChatUIKit.loginWithAuthToken).toHaveBeenCalledWith("AUTH_TOKEN_123");
  }));
});
```

---

## 8. E2E — Playwright (preferred) or Cypress

### Playwright (preferred for two-user flows)

```bash
npm install -D @playwright/test
npx playwright install
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4200",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: devices["Desktop Chrome"] },
    { name: "firefox",  use: devices["Desktop Firefox"] },
  ],
  webServer: {
    command: "npm start",                 // ng serve on :4200
    url: "http://localhost:4200",
    reuseExistingServer: !process.env.CI,
  },
});
```

Two-page chat smoke (real backend — e2e is the layer where the network IS the thing under test):

```ts
import { test, expect, type Page } from "@playwright/test";

async function loginAs(page: Page, uid: string) {
  await page.goto("/");
  await page.evaluate((u) => localStorage.setItem("cc-test-uid", u), uid);
  await page.reload();
  await expect(page.getByText(/welcome|conversations/i)).toBeVisible({ timeout: 10_000 });
}

test("two users message back and forth", async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob   = await (await browser.newContext()).newPage();

  await loginAs(alice, "cometchat-uid-1");
  await loginAs(bob, "cometchat-uid-2");

  await alice.goto("/messages");
  await alice.getByText("cometchat-uid-2").click();
  await alice.getByPlaceholder(/type a message/i).fill("Hello Bob");
  await alice.getByPlaceholder(/type a message/i).press("Enter");

  await bob.goto("/messages");
  await bob.getByText("cometchat-uid-1").click();
  await expect(bob.getByText("Hello Bob")).toBeVisible({ timeout: 10_000 });
});
```

The 10-second timeout is generous — WebSocket delivery is usually <500ms, but CI hosts have variable latency.

### Cypress (single-window smoke)

```bash
npm install -D cypress
npx cypress open
```

`cypress.config.ts`:

```ts
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.E2E_BASE_URL ?? "http://localhost:4200",
    specPattern: "cypress/e2e/**/*.cy.ts",
    defaultCommandTimeout: 10_000,        // generous for WebSocket-driven assertions
  },
});
```

```ts
// cypress/e2e/chat.cy.ts
describe("chat smoke", () => {
  it("logs in and sees the conversation list", () => {
    cy.visit("/");
    cy.window().then((w) => w.localStorage.setItem("cc-test-uid", "cometchat-uid-1"));
    cy.reload();
    cy.contains(/welcome|conversations/i, { timeout: 10_000 }).should("be.visible");
  });
});
```

Cypress can't drive two browser contexts in one test — for two-user flows use Playwright.

### Test users

Every CometChat app ships 5 pre-seeded users (`cometchat-uid-1` … `cometchat-uid-5`) — use them in e2e. Never create users via Auth-Key flows that leak credentials into test code.

---

## 9. CI configuration

```yaml
# .github/workflows/test.yml
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
      # Jasmine/Karma — MUST disable watch or CI hangs forever:
      - run: npm test -- --watch=false --browsers=ChromeHeadless --code-coverage
      # OR Jest:
      # - run: npm test -- --ci --coverage

  e2e:
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium firefox
      - run: npx playwright test                  # webServer block boots `ng serve`
        env:
          E2E_BASE_URL: http://localhost:4200
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/ }
```

**Critical:** use a **dedicated test CometChat app** (Dashboard → New App → "ci-tests") for e2e — never share with production. Rotate the Auth Key if a CI log ever captures it. Unit/component tests need no credentials at all (the kit is fully mocked).

---

## 10. Anti-patterns (mocks that pass tests but mask production)

1. **Putting a standalone component in `declarations`.** v5 components (and your component-under-test) are standalone — they go in `imports`. `declarations` throws at compile time.
2. **Reaching for `CUSTOM_ELEMENTS_SCHEMA` to silence `<cometchat-*>` "not a known element".** That was the v4 NgModule pattern. In v5 you either import the real component or override it with a stub (§4) — the schema masks genuine template typos.
3. **Stubbing a kit component with a *real-ish* implementation.** Your stub passes; the real `CometChatConversationsComponent` behaves differently in prod. Keep stubs inert (`template: ""`) and test the wiring around them — same caution as the React skill's `() => null`.
4. **Mocking `CometChatUIKit.init` / `login` with a synchronous value.** They return Promises; a sync mock hides the race conditions in your gating logic. Always resolve a Promise (`.and.resolveTo` / `.mockResolvedValue`).
5. **Spying the wrong getter.** `getLoggedInUser()` is sync, `getLoggedinUser()` is async — spy the one your component calls, or the spy is a silent no-op.
6. **`async` test body without awaiting the assertion.** Passes trivially. Use `fakeAsync` + `tick`, or `await fixture.whenStable()`.
7. **Asserting on internal kit CSS classes** (`.cc-message-list__bubble`). Brittle across kit upgrades — assert on text, role, selector presence, or test-id.
8. **Calling `ngOnInit()` directly** instead of `fixture.detectChanges()`. Bypasses Angular's lifecycle; tests diverge from production behavior.
9. **Running Karma in CI without `--watch=false`.** Default `ng test` watches forever; the job hangs.
10. **Hardcoding the Auth Key in test files.** Even a throwaway app's key leaks via code grep. Use environment files / CI secrets.
11. **Running e2e against the dev/prod app.** Test data piles up. Separate app.

---

## 11. Verification checklist

- [ ] Runner chosen: Jasmine/Karma (default) OR Jest (`jest.config.js` + `setup-jest.ts`)
- [ ] Component-under-test placed in TestBed `imports` (standalone), never `declarations`
- [ ] `CometChatUIKit` statics spied (`init`/`login`/`getLoggedInUser`/`getLoggedinUser`/`loginWithAuthToken`/`logout`) — Promises resolved, not sync values
- [ ] Kit `<cometchat-*>` components stubbed via `overrideComponent` (no SDK access in unit tests)
- [ ] At least one `fakeAsync`/`tick` test for "init+login resolves before chat UI renders"
- [ ] At least one test for "error state renders when `login` rejects"
- [ ] No `CUSTOM_ELEMENTS_SCHEMA` anywhere CometChat is imported
- [ ] Meta-test: no Auth Key hardcoded outside `environment.*`
- [ ] Meta-test: `angular.json` copies the kit `assets/` glob
- [ ] Playwright (or Cypress) config + at least one chat smoke; two-user smoke uses Playwright
- [ ] CI runs unit + e2e separately; Karma uses `--watch=false`; e2e uses a dedicated test app
- [ ] No `.only` / `fit` / `fdescribe` / `xit` left in committed tests

## 12. Pointers

- `cometchat-angular-core` — the init/login order and `CometChatUIKit` API the tests assert against
- `cometchat-angular-components` — verified selectors + class names for stubs
- `cometchat-angular-calls` — calls-specific testing (NgZone, getUserMedia, call components)
- `cometchat-angular-troubleshooting` — when tests pass but the integration is still broken
- `cometchat-react-testing` — the sister skill; same mocking philosophy
