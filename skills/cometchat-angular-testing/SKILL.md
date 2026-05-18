---
name: cometchat-angular-testing
description: Testing patterns for CometChat Angular UI Kit v4 in Angular 12-15 projects. Covers Karma (default Angular test runner) and Jest (jest-preset-angular alternative), TestBed configuration with CometChatUIKitModule mocking, NgZone-aware async assertions, Cypress for e2e flows with WebSocket waits, and CI configuration. Sister skill of cometchat-angular-calls/references for the calls-specific testing patterns.
license: "MIT"
compatibility: "Angular 12-15 (LTS focus on 15); Karma + Jasmine (default) OR Jest + jest-preset-angular; Cypress >= 13; @cometchat/chat-uikit-angular ^4.x"
allowed-tools: "shell, file-read, file-search, file-list, ask-user"
metadata:
  author: "CometChat"
  version: "4.0.0"
  tags: "cometchat angular testing karma jest cypress testbed ngzone async fakeasync changedetection mocking"
---

## Purpose

Test recipes for CometChat Angular UI Kit integrations. Covers both Angular runners (Karma — default; Jest — preferred by many teams), TestBed patterns specific to NgZone-driven components, and Cypress for full e2e.

**Read these other skills first:**
- `cometchat-angular-core` — init service, APP_INITIALIZER pattern
- `cometchat-angular-patterns` — module setup, lazy loading
- `cometchat-angular-calls/references/ngzone-and-async-callbacks.md` — NgZone primer (carries over to test patterns)

**Ground truth:**
- Angular testing — https://angular.io/guide/testing
- jest-preset-angular — https://github.com/thymikee/jest-preset-angular
- Cypress for Angular — https://docs.cypress.io/guides/component-testing/angular/overview

---

## 1. Karma vs Jest — pick one

| Criterion | Karma (default) | Jest |
|---|---|---|
| Comes with `ng new` | ✓ | ✗ (manual setup) |
| Speed | Slower (real browser) | Faster (jsdom) |
| Real browser parity | Higher | Lower (no real CSS, no real layout) |
| Snapshot testing | Possible (jasmine-jest-snapshot) | First-class |
| CI complexity | Need ChromeHeadless | Pure Node |

The skill defaults to Karma if the project already uses it, Jest if greenfield.

### Karma setup (default Angular)

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
  setupFilesAfterEach: ["<rootDir>/setup-jest.ts"],
  globalSetup: "jest-preset-angular/global-setup",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/cypress/"],
};
```

`setup-jest.ts`:

```ts
import "jest-preset-angular/setup-jest";
```

`angular.json` test command becomes `ng test --code-coverage`.

---

## 2. TestBed setup with CometChat module

```ts
// chat.component.spec.ts
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ChatComponent } from "./chat.component";
import { CometChatInitService } from "../services/cometchat-init.service";

describe("ChatComponent", () => {
  let fixture: ComponentFixture<ChatComponent>;
  let component: ChatComponent;
  let initService: jasmine.SpyObj<CometChatInitService>;

  beforeEach(async () => {
    initService = jasmine.createSpyObj("CometChatInitService", ["init", "login"]);
    initService.init.and.returnValue(Promise.resolve());
    initService.login.and.returnValue(Promise.resolve({ uid: "cometchat-uid-1" }));

    await TestBed.configureTestingModule({
      declarations: [ChatComponent],
      providers: [
        { provide: CometChatInitService, useValue: initService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],          // critical — UI Kit selectors
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
  });

  it("calls init on construction", () => {
    fixture.detectChanges();
    expect(initService.init).toHaveBeenCalled();
  });
});
```

`CUSTOM_ELEMENTS_SCHEMA` makes the test ignore unknown elements (the `<cometchat-*>` selectors in templates). Without it, every test fails with "is not a known element."

---

## 3. NgZone + fakeAsync for SDK callbacks

The Calls SDK fires callbacks outside Angular's zone (cf. `cometchat-angular-calls/references/ngzone-and-async-callbacks.md`). Tests for components subscribing to those callbacks need `fakeAsync` + `tick`:

```ts
import { fakeAsync, tick } from "@angular/core/testing";

it("renders error when SDK fails", fakeAsync(() => {
  initService.login.and.returnValue(Promise.reject(new Error("401 Unauthorized")));

  fixture.detectChanges();
  tick();                                          // flush pending promises
  fixture.detectChanges();                         // re-render after state change

  const errorEl = fixture.nativeElement.querySelector(".error-message");
  expect(errorEl.textContent).toContain("401");
}));
```

For SDK callbacks dispatched via `setTimeout` or `requestAnimationFrame`, `tick(N)` advances by N ms.

---

## 4. Mocking `@cometchat/chat-uikit-angular`

The UI Kit is heavy — full module imports inflate test bundles and trigger zone-related warnings in jsdom. Mock at the module level:

```ts
// __mocks__/cometchat-uikit-angular.ts
import { Component, NgModule, NO_ERRORS_SCHEMA } from "@angular/core";

@Component({ selector: "cometchat-conversations", template: "<div>conversations</div>" })
export class CometChatConversationsStub {}

@Component({ selector: "cometchat-message-list", template: "<div>message-list</div>" })
export class CometChatMessageListStub {}

@Component({ selector: "cometchat-message-composer", template: "<div>composer</div>" })
export class CometChatMessageComposerStub {}

@Component({ selector: "cometchat-message-header", template: "<div>header</div>" })
export class CometChatMessageHeaderStub {}

@NgModule({
  declarations: [
    CometChatConversationsStub,
    CometChatMessageListStub,
    CometChatMessageComposerStub,
    CometChatMessageHeaderStub,
  ],
  exports: [
    CometChatConversationsStub,
    CometChatMessageListStub,
    CometChatMessageComposerStub,
    CometChatMessageHeaderStub,
  ],
})
export class CometChatUIKitModuleStub {}
```

In a test:

```ts
await TestBed.configureTestingModule({
  declarations: [ChatComponent],
  imports: [CometChatUIKitModuleStub],
  providers: [/* ... */],
}).compileComponents();
```

For Jest, alias the module path:

```js
// jest.config.js
moduleNameMapper: {
  "^@cometchat/chat-uikit-angular$": "<rootDir>/__mocks__/cometchat-uikit-angular.ts",
}
```

For Karma, less straightforward — typically you import the stub module directly in the test file and let TypeScript's structural typing handle it.

---

## 5. Standalone components (Angular 14+)

```ts
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ChatComponent } from "./chat.component";

describe("ChatComponent (standalone)", () => {
  let fixture: ComponentFixture<ChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatComponent],                   // standalone components imported, not declared
      providers: [{ provide: CometChatInitService, useValue: { init: () => Promise.resolve() } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
  });
});
```

---

## 6. Cypress e2e

### Install

```bash
npm install -D cypress
npx cypress open                                  # generates cypress/ scaffold
```

### `cypress.config.ts`

```ts
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.E2E_BASE_URL ?? "http://localhost:4200",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    defaultCommandTimeout: 10_000,                // generous for WebSocket-driven assertions
  },
});
```

### Two-window chat smoke

Cypress doesn't natively support multi-window tests. Workaround: open a second browser context via Playwright OR test with two iframes. Most teams use Playwright for cross-window tests — keep Cypress for single-window smoke.

```ts
// cypress/e2e/chat.cy.ts
describe("chat smoke", () => {
  it("logs in and sees the conversation list", () => {
    cy.visit("/");
    cy.window().then((win) => {
      win.localStorage.setItem("cc-test-uid", "cometchat-uid-1");
    });
    cy.reload();

    cy.contains("Welcome").should("be.visible");
    cy.visit("/messages");
    cy.contains("Conversations", { timeout: 10_000 }).should("be.visible");
  });

  it("sends a message and sees it in the thread", () => {
    cy.visit("/messages");
    cy.contains("cometchat-uid-2").click();
    cy.get("input[placeholder='Type a message']").type("Hello");
    cy.contains("Send").click();
    cy.contains("Hello", { timeout: 5_000 }).should("be.visible");
  });
});
```

For two-user tests, prefer Playwright — see `cometchat-react-testing/SKILL.md`.

---

## 7. Anti-patterns

1. **Skipping `CUSTOM_ELEMENTS_SCHEMA`** in TestBed. Every test fails with "is not a known element" for `<cometchat-*>` selectors.
2. **Using `ngOnInit()` directly in tests.** Always go through `fixture.detectChanges()` so Angular's lifecycle runs the way it does in production.
3. **Mocking `CometChat.init`** with a synchronous return value. Real init returns a Promise; sync mocks mask race conditions in your code.
4. **`async` test bodies without `await`** on the assertion. The test passes (trivially) because the assertion never ran. Use `fakeAsync` + `tick` or proper `await fixture.whenStable()`.
5. **Hardcoding test user UIDs** in templates. Use a service injection so tests can override.
6. **Running Karma in CI without `--watch=false --browsers=ChromeHeadless`.** Default `ng test` watches forever; CI hangs.

## 8. CI configuration

```yaml
# .github/workflows/test.yml
name: tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci

      # Karma
      - run: npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage
      # OR Jest
      # - run: npm run test -- --ci --coverage

      - run: npx cypress run
        env:
          E2E_BASE_URL: http://localhost:4200
          # ng serve in background:
          # - run: npx concurrently "ng serve" "wait-on http://localhost:4200 && npx cypress run"
```

Use a dedicated test CometChat App ID in CI — never share with production.

---

## 9. Verification checklist

- [ ] `karma.conf.js` (Angular default) OR `jest.config.js` (Jest path) configured
- [ ] At least one test using `CUSTOM_ELEMENTS_SCHEMA` for components that render `<cometchat-*>`
- [ ] At least one test asserting "init runs and resolves before component is usable"
- [ ] At least one test asserting "error state renders when SDK throws"
- [ ] `CometChatInitService` mocked, not the real one
- [ ] No hardcoded App ID / Auth Key in test files
- [ ] CI runs unit + e2e separately with dedicated test app credentials
- [ ] `--watch=false` flag in CI Karma command (otherwise hangs)

## 10. Pointers

- `cometchat-angular-calls/references/ngzone-and-async-callbacks.md` — calls testing
- `cometchat-angular-core` — init service to mock against
- `cometchat-angular-troubleshooting` — common test failures
