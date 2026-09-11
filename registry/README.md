# registry — the materials index

`web-v7.json` is the machine-readable manifest that ties the pack's layers together
so tooling and distribution read **one** file instead of re-parsing five. It is
**generated** — never hand-edit it:

```bash
node test-suite/scripts/build-registry.mjs          # regenerate
node test-suite/scripts/build-registry.mjs --check  # CI: fail if stale
```

## The three-layer product split (restored from the legacy pack)

The v5 pivot kept the brain and the materials but had dropped the hands and the
safety-net. They are back:

| Layer | Where | Role |
|---|---|---|
| **Brain** | `skills/` | the task-shaped skills an agent loads on demand |
| **Hands** | `bin/cometchat-skills.mjs` | deterministic CLI — `detect`, `add`, `verify`, `catalog`, `doctor` (the steps an LLM should not improvise) |
| **Materials** | `test-suite/catalogs/`, `features.json`, `contracts.json`, `peers.yaml`, **this `registry/`** | the oracles the skills author against |
| **Safety-net** | `test-suite/`, `.github/workflows/`, the reviewer | the machine gates that block a bad skill from shipping |

`web-v7.json` indexes the materials for the React v7 family: kit/SDK coordinates,
catalog symbol count, feature/contract counts, and every skill with its version and
role (router vs skill). The `verified` flag mirrors `peers.yaml`.

> Provisioning/credentials (`auth login`, `provision setup`, `apply-feature`) are a
> SEPARATE published tool — `@cometchat/skills-cli` — invoked by the skills at
> integration time (see `skills/cometchat-react-v7-core/references/setup-credentials.md`).
> This pack's CLI (`@cometchat/skills`) is the skill-management + verification layer.
