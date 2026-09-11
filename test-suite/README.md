# test-suite — the pack's safety net (deterministic verification)

This is the **safety-net layer** of the pack (brain = `skills/`, hands = `bin/` CLI,
materials = catalog/features/contracts/registry, safety-net = this). Every gate here
is machine-computed and runs in CI (`.github/workflows/verify.yml`) so a bad skill
**cannot merge** — verification is no longer local/on-demand.

Scope today: **React v7 UI Kit** (`web-v7`). The scripts are family-agnostic (they
read `peers.yaml` + the catalog), so when the skill-creator stands up a new family it
gets its own `verify:fences:<family>` wiring by copying the `web-v7` typecheck project.

## The gates (cheapest → most expensive)

| Tier | Script | What it proves | Network? |
|---|---|---|---|
| **0 — lint** | `scripts/lint-skills.mjs` | frontmatter + dir/name parity + companion block + peers.yaml routing + router present | no |
| **1 — catalog** | `scripts/verify-catalog.mjs` | every `CometChat*` symbol in a code fence exists in `catalogs/web-v7.json` (anti-hallucination); shipped catalog matches the reviewer's G0 oracle (drift guard) | no |
| **2 — fences** | `scripts/typecheck-fences.mjs` | every `@cometchat`-importing fence compiles against the **pinned** kit (`typecheck/web-v7/`) — catches method/signature/import drift | installs pinned kit |
| **3 — smoke** | reviewer `tools/run-feature.mjs` + `smoke-runner.mjs` | the emitted component renders & works in a live headless browser | needs creds |
| **done** | reviewer `tools/predicate.mjs` | the recorded review is complete (`GLOBAL_DONE`) — release gate | no |

## Run locally

```bash
npm run verify                 # Tier-0 + Tier-1 + predicate (fast, no network — run anywhere)
npm run lint:skills            # Tier-0 only
npm run verify:catalog         # Tier-1 only
npm run verify:fences:web-v7   # Tier-2 — needs the pinned kit: npm --prefix test-suite/typecheck/web-v7 ci
npm run verify:ci              # everything Tier-0..2 + predicate (what CI runs)
npm run catalog:refresh        # regenerate catalogs/web-v7.json from the installed kit (oracle refresh)
```

## Catalog = single source of truth

`catalogs/web-v7.json` (405 public symbols, exports-only) is the shipped Tier-1
oracle. `catalog:refresh` regenerates it from the installed kit via the skill-creator's
`build-catalog.mjs`. `verify-catalog.mjs` fails if it drifts from the reviewer's copy
at `.claude/skills/cometchat-skill-reviewer/tools/catalog/web-v7.json` — keep both in
sync by re-running the refresh (this is the AUDIT-008/012 failure mode, gated).

## Keeping the Tier-2 pins honest

`typecheck/web-v7/package.json` pins the kit majors. They MUST track
`peers.yaml` (web-v7) and `cometchat-react-app/package.json`. The scheduled
`catalog-refresh.yml` workflow re-derives the catalog on a cadence so the oracle
can't rot against new SDK minors.

## Why Tier-2 fences is in `verify:ci` but NOT default `verify` (AUDIT-030)

Deliberate. `verify:fences:web-v7` type-checks against the **real pinned kit**, so it
needs `typecheck/web-v7/node_modules/@cometchat` present. That is **not** installed by a
plain root `npm install`: the fixture's `node_modules` is git-ignored, is not in the
published `files` allowlist (only its `package.json` + `tsconfig.json` ship), and there is
no `postinstall`/`prepare` hook. CI installs it as a **separate explicit step** right
before the gate (`.github/workflows/test.yml`: `npm --prefix test-suite/typecheck/web-v7
install` → `npm run verify:fences:web-v7`).

If the kit is absent, `typecheck-fences.mjs` **hard-exits code 2** (`typecheck-fences.mjs`
~L46). So promoting it into default `verify` would make `verify` **fail in every clean
checkout** that hasn't run the extra fixture install — breaking the "fast, no network, run
anywhere" contract of `verify` above. To keep that contract, fences stays in `verify:ci`
(where CI guarantees the install) and the default `verify` stays install-free.

**Owner CI-cost decision (open):** if you WANT the TS6133/kit-drift class caught locally in
default `verify` too, the price is making the fixture install part of `verify` (either an
`npm --prefix test-suite/typecheck/web-v7 ci` prestep, a root `postinstall` that installs
it, or vendoring the kit) — i.e. `verify` gains a network/install cost and is no longer
"run anywhere offline". That is a product/CI trade-off, not a safe silent change, so it is
left to the owner. To run fences locally today: `npm --prefix test-suite/typecheck/web-v7
ci && npm run verify:fences:web-v7` (or just `npm run verify:ci`).
