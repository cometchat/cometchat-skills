#!/usr/bin/env node
/**
 * lint-skills.mjs — Tier-0 static integrity gate (dependency-free, no network).
 *
 * The cheapest CI gate: it proves each shipped skill is structurally shippable
 * BEFORE the more expensive catalog/compile tiers run. It fails the build on the
 * machine-checkable invariants a hand-authored or drifted skill breaks:
 *
 *   1. Frontmatter present with name / description / license / compatibility
 *      and metadata.version (we publish versioned skills).
 *   2. Frontmatter `name` === directory name (dir/name parity).
 *   3. Every non-core skill carries the "Companion skills" block pointing at core
 *      (BUILD-ORDER.md DRY mechanism — non-core must not restate core).
 *   4. Every skill dir maps to a routing entry: its capability slug is listed in
 *      peers.yaml under a peer's `skills:` (routing-as-data can't silently drift).
 *   5. The thin router `cometchat/SKILL.md` exists (the entry the pack advertises).
 *
 * Plus three PACK-LEVEL durability gates (retroactive hardening of past AUDIT fixes
 * that lived only as prose — the AUDIT-020→024 "correct-but-ungated silently regresses"
 * lesson applied to the CLASS, so a regression fails CI instead of shipping):
 *   A. AUDIT-025 — no broken per-theme CSS selector in any ```css fence: the descendant
 *      `[data-theme=…] .cometchat {` targets a `.cometchat` NESTED in a `[data-theme]`
 *      ancestor, but the provider puts both on ONE div, so it matches nothing (silent
 *      no-op). Scans FENCES only (prose/anti-patterns may quote the bad form to warn).
 *   B. AUDIT-018 — shipped RULES.md carries NO skill-authoring/CI artifacts (a customer's
 *      agent must never be nudged to test/CI the app it built). Blocklist of authoring-only
 *      artifact tokens (predicate.mjs / verify.yml / verify:ci / "run the gates" / …).
 *   C. AUDIT-013 — no NEW `[v7-verify]` provenance marker ships: the known-intentional
 *      carry-over markers are allowlisted; any ADDITIONAL one fails (a regressed/unverified
 *      claim can't ship silently).
 *   D. AUDIT-029 — the follow-OS-theme RECIPE stays taught: core/references/theming.md must
 *      keep the matchMedia('(prefers-color-scheme: dark)') + change-listener + theme/data-theme
 *      sync recipe (the only way to follow the OS since the kit has no theme="system", AUDIT-004).
 *      Gates that the how-to is TAUGHT — NOT that OS-follow is the product default (open decision).
 *
 * Scope: the react-v7 pack (skills/cometchat-react-v7-*). Family-agnostic — reads
 * peers.yaml, so a new family the skill-creator adds is linted automatically.
 *
 * Usage:  node test-suite/scripts/lint-skills.mjs [--json]
 * Exit:   0 all green · 1 one or more skills failed · 2 bad invocation.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS_DIR = join(ROOT, "skills");
const PEERS = join(ROOT, "peers.yaml");
const JSON_OUT = process.argv.includes("--json");

// ── minimal YAML-ish readers (no dep) ────────────────────────────────────────
function frontmatter(txt) {
  const m = txt.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}
const topKey = (b, k) => (b.match(new RegExp("^" + k + ":\\s*(.+)$", "m")) || [])[1];
const nestedKey = (b, k) => (b.match(new RegExp("^\\s+" + k + ":\\s*(.+)$", "m")) || [])[1];

// Bare, platform-NEUTRAL skills that carry NO <platform>-<major> segment
// (NAMING.md): the cross-family skills (a11y, i18n) authored once for every family,
// and the onboarding JOURNEY gate (the DISCOVER→UNDERSTAND→PLAN front door). These are
// named `cometchat-<slug>` and are routed via peers.yaml's `gate:` / top-level pointers
// (the entry router ALWAYS routes to the gate first), NOT via a peer's `skills:` list —
// so they must be recognized here instead of failing the per-platform grammar.
const CROSS_FAMILY_SLUGS = new Set(["a11y", "i18n", "onboarding"]);

// The gates grafted below were authored for the ANGULAR family + the shared skills. Other
// families are maintained elsewhere; applied pack-wide they turned this repo's 15
// pre-existing problems into 123 by firing on 40+ android/ios/flutter/rn skills. A gate we
// wrote must not fail a family we do not own — same scoping the token and fence gates need.
const OWNED_SKILL = (d) =>
  /^cometchat-angular-v5-/.test(d) || d === "cometchat" || d === "cometchat-onboarding";

// Parse the capability slugs each peer routes to (peers.yaml `skills: [...]`), plus the
// platform-neutral routing pointers (`gate:` and any bare cross-family targets).
function routedSlugs() {
  if (!existsSync(PEERS)) return { platforms: [], slugs: new Set(), neutral: new Set() };
  const y = readFileSync(PEERS, "utf8");
  const slugs = new Set();
  const neutral = new Set();
  const platforms = [];
  for (const m of y.matchAll(/^\s*-\s*platform:\s*(\S+)/gm)) platforms.push(m[1].trim());
  for (const m of y.matchAll(/^\s*skills:\s*\[([^\]]*)\]/gm)) {
    for (const s of m[1].split(",")) { const t = s.trim(); if (t) slugs.add(t); }
  }
  // `gate: cometchat-onboarding` (and any future bare cross-family pointer) → routed.
  const gate = (y.match(/^\s*gate:\s*(\S+)/m) || [])[1];
  if (gate) neutral.add(gate.trim());
  return { platforms, slugs, neutral };
}

// react-v7-core → {platform:"react", major:"v7", slug:"core"}
// android-v6-builder-settings → {platform:"android", major:"v6", slug:"builder-settings"}
//   (SKILL-INVENTORY sanctions HYPHENATED type slugs — the android extras `builder-settings`,
//    `events`, `extensions` — so the slug group allows internal hyphens, not just [a-z]+.)
// cometchat-onboarding / cometchat-a11y → {crossFamily:true, slug:"onboarding"}
// The sanctioned platforms, from NAMING.md. Longest FIRST so `react-native` is matched before
// `react` would swallow it. Anchoring on this list (rather than a bare [a-z]+ segment) is what
// lets a HYPHENATED platform exist at all.
// AUDIT-167: `js` is the headless web-JavaScript SDK leaf platform — the framework-agnostic SDK
// families that have no UI Kit and thus no `<framework>` platform (chat `core-v4` → the parked
// `cometchat-js-v4-sdk`; calls `calls-v5` → `cometchat-js-v5-calls`). NAMING.md line 9 lists it.
const PLATFORMS = ["react-native", "react", "angular", "android", "flutter", "ios", "js"];

// Previously: /^cometchat-([a-z]+)-(v\d+)-([a-z]+)$/ — which could not express React Native in
// THREE ways at once: [a-z]+ forbids the hyphen in `react-native`, the major was MANDATORY
// (NAMING.md: "included ONLY when two majors coexist for that platform"), and the slug forbade
// the hyphen in `expo-patterns` / `bare-patterns` (the two-patterns split SKILL-INVENTORY.md
// sanctions for react-native specifically). So every correctly-named RN skill was rejected.
// Same class as the six --family hardcodes (AUDIT-091/087): a rule written for one family.
function classify(dir) {
  const c = dir.match(/^cometchat-([a-z0-9]+)$/);
  if (c && CROSS_FAMILY_SLUGS.has(c[1])) return { crossFamily: true, slug: c[1] };
  for (const p of PLATFORMS) {
    let m = dir.match(new RegExp(`^cometchat-${p}-(v\\d+)-([a-z][a-z-]*)$`));
    if (m) return { platform: p, major: m[1], slug: m[2] };
    m = dir.match(new RegExp(`^cometchat-${p}-([a-z][a-z-]*)$`));
    if (m && !/^v\d+$/.test(m[1])) return { platform: p, major: null, slug: m[1] };
  }
  return null;
}

function lintSkill(dir, routed) {
  const errs = [];
  const file = join(SKILLS_DIR, dir, "SKILL.md");
  if (!existsSync(file)) return [`${dir}: missing SKILL.md`];
  const txt = readFileSync(file, "utf8");

  const b = frontmatter(txt);
  if (!b) return [`${dir}: missing YAML frontmatter block`];

  const name = (topKey(b, "name") || "").trim();
  if (!name) errs.push("frontmatter.name missing");
  else if (name !== dir) errs.push(`frontmatter.name "${name}" != dir "${dir}"`);
  if (!topKey(b, "description")) errs.push("frontmatter.description missing");
  if (!topKey(b, "license")) errs.push("frontmatter.license missing");
  if (!topKey(b, "compatibility")) errs.push("frontmatter.compatibility missing (version pins)");
  if (!nestedKey(b, "version")) errs.push("frontmatter.metadata.version missing");

  const cls = classify(dir);
  if (!cls) {
    errs.push(`name does not match the NAMING grammar cometchat-<platform>-<major>-<slug> (or a sanctioned bare cross-family/gate name)`);
  } else if (cls.crossFamily) {
    // Platform-NEUTRAL skill (a11y/i18n/onboarding): no per-platform Companion→core
    // block (the section spine OMITS it for cross-family types — its companion is
    // whichever family core the plan/context names). Routed via a neutral pointer
    // (peers.yaml `gate:` / entry), not a peer's `skills:` list.
    if (!routed.neutral.has(dir)) {
      errs.push(`cross-family skill "${dir}" not routed in peers.yaml (add it as gate: or a neutral pointer)`);
    }
  } else {
    // Companion block — required on every non-core per-platform skill (BUILD-ORDER DRY rule).
    // Exception: an `sdk` skill is the ENTRY/core of a HEADLESS family (self-contained init/login);
    // it needs a Companion→core block ONLY if that platform ALSO ships a UI-Kit `core` skill. A
    // standalone SDK family (e.g. cometchat-js-v4-sdk) has no core to reference — it IS the entry.
    const coreExists = existsSync(join(SKILLS_DIR, `cometchat-${cls.platform}-${cls.major}-core`));
    // `sdk` OR a `<artifact>-sdk` slug (calls-sdk): a platform can ship two headless entries — the
    // chat SDK (`cometchat-android-v5-sdk`) AND the calls SDK (`cometchat-android-v5-calls-sdk`) —
    // and the second cannot reuse the bare slug. Both are coreless entries (AUDIT: android-calls-v5).
    const isSdkEntry = cls.slug === "sdk" || cls.slug.endsWith("-sdk");
    const needsCompanion = cls.slug !== "core" && (!isSdkEntry || coreExists);
    if (needsCompanion) {
      // The core's name must be rebuilt from the parts that EXIST. Interpolating a null major
      // produced "cometchat-react-native-null-core", which can never match — so every non-core
      // skill in a single-major family failed this check no matter how correct its block was.
      const coreName = `cometchat-${cls.platform}${cls.major ? `-${cls.major}` : ""}-core`;
      const hasCompanion = /##\s*Companion skills/i.test(txt) && new RegExp(coreName).test(txt);
      if (!hasCompanion) errs.push("non-core skill missing the Companion-skills → core block");
    }
    // Routing-as-data: the slug must be declared in peers.yaml.
    if (!routed.slugs.has(cls.slug)) {
      errs.push(`slug "${cls.slug}" not routed in peers.yaml (add to a peer's skills: [...])`);
    }
  }
  return errs.map((e) => `${dir}: ${e}`);
}

// ── pack-level durability gates (retroactive hardening of prose-only AUDIT fixes) ──

// Recursively collect .md files under a dir (skills tree).
function mdFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) mdFiles(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

// Extract the bodies of ```css / ```scss fenced code blocks from a markdown string.
function cssFences(txt) {
  const blocks = [];
  const re = /```(?:css|scss)\b[^\n]*\n([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(txt))) blocks.push(m[1]);
  return blocks;
}

// GATE A (AUDIT-025): a per-theme override written as the DESCENDANT selector
// `[data-theme=…] .cometchat {` (or `.cometchat,`) matches nothing — the provider
// puts data-theme + .cometchat on ONE element. `.cometchat[data-theme=…]` (same
// element) and `[data-theme=…] .cometchat-<bem>` (kit internal descendant) are FINE.
// FENCE-ONLY so anti-patterns.md / prose can still quote the bad form to warn about it.
const BAD_THEME_SELECTOR =
  /\[data-theme\s*=\s*["']?[a-z]+["']?\s*\]\s+\.cometchat(?=[\s,{])/i;
function gateThemeSelector(files) {
  const errs = [];
  for (const f of files) {
    for (const css of cssFences(readFileSync(f, "utf8"))) {
      if (BAD_THEME_SELECTOR.test(css)) {
        errs.push(
          `${f.replace(ROOT + "/", "")}: broken per-theme selector in a css fence — ` +
          `\`[data-theme=…] .cometchat {…}\` matches nothing (data-theme + .cometchat are the SAME div). ` +
          `Use \`.cometchat[data-theme="dark"]\` (same element) or \`[data-theme="dark"] .cometchat-<bem>\` (kit internal). (AUDIT-025)`
        );
      }
    }
  }
  return errs;
}

// GATE B (AUDIT-018): the shipped RULES.md must be integration-only — it must NOT carry
// skill-authoring / CI artifacts (which read to a customer's agent as "test the app").
// Blocklist is artifact tokens that ONLY appear in authoring content — NOT generic words
// like "test"/"Playwright" (the shipped "do NOT test" rule legitimately uses those).
const RULES_FORBIDDEN = [
  "predicate.mjs", "verify.yml", "verify:ci", "verify:predicate",
  "smoke-runner", "run the gates", "CI-enforced", "CI-green",
  "reviewer smoke", "reviewer's runtime smoke", "shippability",
];
function gateShippedRules() {
  const errs = [];
  const rulesPath = join(ROOT, "RULES.md");
  if (!existsSync(rulesPath)) return [`RULES.md (shipped) missing`];
  const txt = readFileSync(rulesPath, "utf8").toLowerCase();
  for (const tok of RULES_FORBIDDEN) {
    if (txt.includes(tok.toLowerCase())) {
      errs.push(
        `RULES.md: contains authoring/CI artifact "${tok}" — the shipped RULES must be ` +
        `integration-only (no CI/authoring/reviewer content; a customer's agent must not be ` +
        `nudged to test the app it built). Authoring rules live in the factory references/RULES.md. (AUDIT-018)`
      );
    }
  }
  return errs;
}

// GATE C (AUDIT-013): no NEW `[v7-verify]` provenance marker ships. The known-intentional
// v6-carry-over markers are allowlisted by (file-relative-path : substring); any ADDITIONAL
// `[v7-verify]` in the shipped skills fails, so a regressed/unverified claim can't ship.
const V7VERIFY_ALLOW = [
  // path suffix ⇒ how many [v7-verify] markers are sanctioned in that file
  { path: "skills/cometchat-react-v7-core/SKILL.md", count: 1 },            // the Ground-truth callout DEFINING the marker
  { path: "skills/cometchat-react-v7-core/references/setup-credentials.md", count: 1 }, // initFromSettings carry-over
];
function gateV7VerifyMarkers(files) {
  const errs = [];
  for (const f of files) {
    const rel = f.replace(ROOT + "/", "");
    const n = (readFileSync(f, "utf8").match(/\[v7-verify\]/g) || []).length;
    if (n === 0) continue;
    const allow = V7VERIFY_ALLOW.find((a) => rel.endsWith(a.path));
    const allowed = allow ? allow.count : 0;
    if (n > allowed) {
      errs.push(
        `${rel}: ${n} [v7-verify] marker(s) but only ${allowed} allowlisted — a NEW unverified ` +
        `v6-carry-over marker cannot ship (verify it against v7 and remove the marker, or ` +
        `allowlist it in lint-skills.mjs with a reason). (AUDIT-013)`
      );
    }
  }
  return errs;
}

// GATE D (AUDIT-029): the follow-OS-theme RECIPE must stay TAUGHT. The kit has no
// theme="system" and never reads the OS (AUDIT-004), so following the OS light/dark
// setting is a host-side recipe: sync CometChatProvider's theme (→ the wrapper's
// data-theme) to window.matchMedia('(prefers-color-scheme: dark)') with a change
// listener. That how-to lives in core/references/theming.md as a standalone recipe.
// Because it's prose+a fenced hook (the AUDIT-020→026 "correct-but-ungated silently
// regresses" class), assert its load-bearing tokens are present so an edit can't quietly
// delete the recipe and leave only the "kit ignores the OS" pitfall with no fix.
// NOTE: this gates that the RECIPE is TAUGHT — it does NOT assert OS-follow is the
// product DEFAULT (that remains an OPEN product decision, AUDIT-004; see AUDIT.md).
const OS_THEME_RECIPE_FILE = "skills/cometchat-react-v7-core/references/theming.md";
const OS_THEME_REQUIRED = [
  { re: /matchMedia\s*[?.]*\s*\(\s*["']\(prefers-color-scheme:\s*dark\)["']\s*\)/i,
    what: "matchMedia('(prefers-color-scheme: dark)') detection" },
  { re: /addEventListener\s*\(\s*["']change["']/i,
    what: "a 'change' listener so it live-updates on OS theme flip" },
  { re: /data-theme|CometChatProvider[^\n]*theme=|theme=\{[^\n]*[Ss]ystem|useSystemTheme/i,
    what: "syncing the result to CometChatProvider's theme prop / data-theme" },
];
function gateOsThemeRecipe() {
  const p = join(ROOT, OS_THEME_RECIPE_FILE);
  if (!existsSync(p)) {
    return [`${OS_THEME_RECIPE_FILE}: missing — the follow-OS-theme recipe file is gone (AUDIT-029/004)`];
  }
  const txt = readFileSync(p, "utf8");
  const missing = OS_THEME_REQUIRED.filter((r) => !r.re.test(txt)).map((r) => r.what);
  if (missing.length) {
    return [
      `${OS_THEME_RECIPE_FILE}: the follow-OS-theme recipe lost — missing ${missing.map((m) => `[${m}]`).join(", ")}. ` +
      `The kit has no theme="system" (AUDIT-004), so this host-side matchMedia→data-theme recipe is the only way to follow the OS ` +
      `light/dark setting; it must stay taught. Restore the recipe (or update this gate if it moved). (AUDIT-029)`
    ];
  }
  return [];
}

// GATE E (AUDIT-084): the core INIT recipe must use `initFromSettings` (telemetry — the UI Kit/SDK
// persist integrationSource="ai-agent" ONLY on that path; the classic builder init does not). The
// reviewer's per-feature emit never includes init (harness-provided), so NO G0–G7 gate sees it — this
// static check is the only guard against a regression back to the classic init(). Framework-agnostic:
// every platform's <core>/references/lifecycle.md (+ core SKILL.md) that ships an init recipe must
// reference initFromSettings, and the canonical lifecycle recipe must not use the classic init(.
function gateInitTelemetry() {
  const errs = [];
  const coreDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.endsWith("-core"))
    .map((d) => d.name);
  for (const dir of coreDirs) {
    for (const rel of [`${dir}/references/lifecycle.md`, `${dir}/SKILL.md`]) {
      const p = join(SKILLS_DIR, rel);
      if (!existsSync(p)) continue;
      const txt = readFileSync(p, "utf8");
      if (!/CometChatUIKit\.init|initCometChat|CometChat\.init\(/.test(txt)) continue; // only files that show an init recipe
      if (!/initFromSettings/.test(txt)) {
        errs.push(
          `skills/${rel}: shows an init recipe but does NOT use initFromSettings — telemetry ` +
          `attribution (integrationSource="ai-agent") requires CometChatUIKit.initFromSettings / ` +
          `CometChat.initFromSettings, not the classic builder init. (AUDIT-084)`
        );
      }
    }
    const lc = join(SKILLS_DIR, `${dir}/references/lifecycle.md`);
    if (existsSync(lc) && /CometChatUIKit\.init\(/.test(readFileSync(lc, "utf8"))) {
      errs.push(
        `skills/${dir}/references/lifecycle.md: the baked init recipe uses the classic ` +
        `CometChatUIKit.init( — the default init must be initFromSettings (telemetry). (AUDIT-084)`
      );
    }
  }
  return errs;
}

// GATE F: every reference to one of the PACK'S OWN generated artifacts must resolve.
//
// The iOS skills told the agent to verify each symbol against `catalogs/ios-v5.json` — a path
// that does not exist anywhere (the catalog ships at test-suite/catalogs/ios-v5.json). Eight
// references across six files, and the pack's own anti-hallucination control therefore pointed
// at nothing: an agent told to "check the catalog before emitting a symbol" would find no
// catalog and carry on emitting. A control that silently no-ops is worse than no control,
// because the skill reads as if it is guarded.
//
// Scoped DELIBERATELY NARROWLY to repo-root artifact roots. A general "every path in a skill
// must exist" rule is unworkable: skills legitimately name paths in the USER'S project
// (.cometchat/config.json, src/vite-env.d.ts, node_modules/...) which are absent here by
// definition, and many intra-skill links are written relative to the skill root rather than the
// containing file. Both produce noise, and noise in a gate is how a gate gets ignored. These
// roots are unambiguous: they exist in this repo or they are a defect.
// Root-level oracles (`features.ios-v5.json`, `contracts.ios-v5.json`, `peers.yaml`) are matched
// too. The first version of this gate only knew directory-rooted paths, so a bare filename slipped
// through — which is exactly how the iOS feature/contract oracles ended up referenced by a skill
// while missing from package.json `files`.
const ARTIFACT_REF = /`((?:test-suite|registry|catalogs|golden|\.claude)\/[A-Za-z0-9_.\-/]+\.\w+|(?:features|contracts|peers)[A-Za-z0-9_.\-]*\.(?:json|yaml))`/g;

// Is a repo-relative path covered by package.json "files"? Directory entries cover their subtree.
function shipsInPackage(ref) {
  try {
    const allow = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).files || [];
    return allow.some((f) => ref === f || ref.startsWith(f.replace(/\/$/, "") + "/"));
  } catch { return true; }   // no package.json to judge against: do not invent a failure
}

// GATE G: every SHIPPED platform must be discoverable in the distribution metadata.
//
// Three separate defects in one pass were the same thing — metadata still describing a React-only
// pack after iOS shipped: marketplace.json's description and keywords, package.json's description,
// and finally package.json's keywords. Each was found by a human reading a different file. A
// platform nobody can search for is invisible however good its skills are, so this is checked
// rather than remembered.
//
// Keyed off peers.yaml, so onboarding a platform makes this fail until its metadata is updated —
// which is the moment it matters, not months later. Parked peers are exempt: they ship no skills.
function gatePlatformMetadata() {
  const errs = [];
  let peers = "";
  try { peers = readFileSync(PEERS, "utf8"); } catch { return []; }

  // platform blocks, minus parked ones
  const blocks = peers.split(/^\s*-\s*platform:/m).slice(1);
  const shipped = [];
  for (const b of blocks) {
    if (/^\s*parked:\s*true/m.test(b)) continue;
    const name = (b.match(/^\s*(\S+)/) || [])[1];
    if (name) shipped.push(name.trim());
  }
  if (!shipped.length) return [];

  const read = (rel) => { try { return JSON.parse(readFileSync(join(ROOT, rel), "utf8")); } catch { return null; } };
  const pkg = read("package.json");
  const mkt = read(".claude-plugin/marketplace.json");

  const check = (label, keywords, text) => {
    const hay = `${(keywords || []).join(" ")} ${text || ""}`.toLowerCase();
    for (const p of shipped) {
      if (!hay.includes(p.toLowerCase())) {
        errs.push(`${label}: ships a '${p}' platform (peers.yaml) but never names it — a platform absent from the distribution metadata cannot be found by anyone searching for it`);
      }
    }
  };
  if (pkg) check("package.json", pkg.keywords, pkg.description);
  if (mkt && mkt.plugins && mkt.plugins[0]) {
    const pl = mkt.plugins[0];
    check(".claude-plugin/marketplace.json", pl.keywords, `${mkt.description || ""} ${pl.description || ""}`);
  }
  return errs;
}

function gateArtifactRefs(files) {
  const errs = [];
  for (const f of files) {
    const txt = readFileSync(f, "utf8");
    for (const m of txt.matchAll(ARTIFACT_REF)) {
      const ref = m[1];
      if (!existsSync(join(ROOT, ref))) {
        errs.push(`${f.replace(ROOT + "/", "")}: references \`${ref}\`, which does not exist — ` +
                  `a skill pointing at a missing pack artifact silently no-ops the check it describes`);
      } else if (!shipsInPackage(ref)) {
        // EXISTING IS NOT ENOUGH — it has to reach the user. `features.ios-v5.json` and
        // `contracts.ios-v5.json` were present in the repo and named by a skill as its oracle, but
        // absent from package.json `files`, so an INSTALLED pack would not contain them: the skill
        // would point at an oracle that exists only on our machines. That is the same silent no-op
        // as a missing file, one step later in the pipeline.
        errs.push(`${f.replace(ROOT + "/", "")}: references \`${ref}\`, which exists but is NOT in ` +
                  `package.json "files" — it would not ship, so the reference dies on an installed pack`);
      }
    }
  }
  return errs;
}

// GATE F (AUDIT-085): SECTION-SPINE conformance — templates/_SECTION-SPINE.md fixes the
// heading set every shipped skill shares. Matched by PREFIX so a qualifying suffix stays
// legal (`## Common pitfalls (top 4 — …)`). `Prerequisites & install` is CONDITIONAL:
// required only when the skill ships its own `npm install` (restating core's is the DRY
// violation). `Common pitfalls` is n/a for troubleshooting, which is all symptom→fix.
function gateSectionSpine() {
  const errs = [];
  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && OWNED_SKILL(d.name) && d.name.startsWith("cometchat-"))
    .map((d) => d.name);
  for (const dir of dirs) {
    const f = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8");
    const h2 = [...txt.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    const has = (want) => h2.some((h) => h === want || h.startsWith(want + " ") || h.startsWith(want + "("));
    const isCore = dir.endsWith("-core");
    const isRouter = dir === "cometchat";
    const isJourney = dir === "cometchat-onboarding";
    if (isRouter || isJourney) continue;            // router + onboarding have their own shapes

    if (!isCore && !has("Companion skills")) errs.push(`${dir}: missing "## Companion skills" (spine; non-core)`);
    if (!has("Use this skill when") && !has("Use when")) errs.push(`${dir}: missing "## Use this skill when" (spine)`);
    if (!has("Verify it works")) errs.push(`${dir}: missing "## Verify it works" (spine)`);
    if (!dir.endsWith("-troubleshooting") && !has("Common pitfalls")) {
      errs.push(`${dir}: missing "## Common pitfalls" (spine; n/a only for troubleshooting)`);
    }
    // conditional: ships its own install command ⇒ must declare the section
    if (/^```bash\n[^`]*npm install /m.test(txt) && !has("Prerequisites & install")) {
      errs.push(`${dir}: ships an \`npm install\` but has no "## Prerequisites & install" (spine, conditional)`);
    }
  }
  return errs;
}


// GATE G: a preview-deploy DOCS_BASE is allowed (docs-maximal work happens against a
// Mintlify preview) but must carry a `SWAP-FOR-PROD` marker within 3 lines, so a release
// can grep for every one. Shipping an unlabelled preview URL 404s every fetch once the
// docs branch is deleted.
function gatePreviewDocsBase() {
  const errs = [];
  for (const f of mdFiles(SKILLS_DIR)) {
    if (!OWNED_SKILL((f.slice(SKILLS_DIR.length + 1).split('/')[0]))) continue;
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!/mintlify\.site/.test(line)) return;
      const near = lines.slice(Math.max(0, i - 1), i + 4).join("\n");
      if (!/SWAP-FOR-PROD/.test(near)) {
        errs.push(
          `${f.replace(ROOT + "/", "")}:${i + 1}: preview docs base (mintlify.site) with no ` +
          `SWAP-FOR-PROD marker within 3 lines — label it so it cannot ship unnoticed`
        );
      }
    });
  }
  return errs;
}


// GATE H (AUDIT-091): a features skill's description must cover its oracle's vocabulary.
// Under progressive disclosure the description is the only thing in context at routing
// time, so a feature with no lexical hook there is unreachable — the skill never loads and
// the agent hand-rolls what the product already ships. Lexical, not semantic: every feature
// id must contribute at least one word (>3 chars) present in the description.
function gateFeatureDescriptionCoverage() {
  const errs = [];
  for (const dir of readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && OWNED_SKILL(d.name) && /-features$/.test(d.name))
    .map((d) => d.name)) {
    const f = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8");
    const desc = ((txt.match(/^description:.*$/m) || [""])[0]).toLowerCase();
    const m = dir.match(/^cometchat-(.+)-features$/);
    if (!m) continue;
    // features.<platform>-<major>.json, or the unsuffixed react default
    const cand = [join(ROOT, `features.${m[1]}.json`), join(ROOT, "features.json")];
    const oraclePath = cand.find((p) => existsSync(p));
    if (!oraclePath) continue;
    let ids = [];
    try { ids = (JSON.parse(readFileSync(oraclePath, "utf8")).features || []).map((x) => x.id).filter(Boolean); }
    catch { continue; }
    const missing = ids.filter((id) => !id.split("-").filter((w) => w.length > 3).some((w) => desc.includes(w)));
    if (missing.length) {
      errs.push(
        `${dir}: ${missing.length}/${ids.length} feature(s) in ${oraclePath.replace(ROOT + "/", "")} have no lexical hook ` +
        `in the skill description, so the router cannot reach them: ${missing.slice(0, 8).join(", ")}` +
        (missing.length > 8 ? ` …+${missing.length - 8}` : "")
      );
    }
  }
  return errs;
}


// GATE I (AUDIT-092): every shipped family must be reachable through the shared skills.
// The router and onboarding are authored while one family is the only one that exists, so
// a second family can ship without ever being added to their routing prose — every other
// gate stays green because each skill is individually valid. A family is shipped if
// skills/cometchat-<family>-core exists; each shared skill must NAME that core. Structural
// on purpose: reading prose sentiment produced false positives.
function gateSharedSkillsRouteEveryFamily() {
  const errs = [];
  const shipped = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && OWNED_SKILL(d.name))
    .map((d) => (d.name.match(/^cometchat-(.+)-core$/) || [])[1])
    .filter(Boolean);
  if (shipped.length < 2) return errs;            // single-family pack: nothing to orphan
  for (const shared of ["cometchat", "cometchat-onboarding"]) {
    const f = join(SKILLS_DIR, shared, "SKILL.md");
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8");
    for (const fam of shipped) {
      if (!txt.includes(`cometchat-${fam}-core`)) {
        errs.push(`${shared}: never names \`cometchat-${fam}-core\`, so the shipped ${fam} family is unreachable through it`);
      }
    }
  }
  return errs;
}


// GATE J (AUDIT-093): field-proven facts that must not silently vanish. Each is one
// sentence a later edit could drop with every other gate still green — the recipe would
// still compile, pass the catalog, and fit the budget.
function gateFieldProvenFacts() {
  const errs = [];
  const MUST = [
    { file: "cometchat-angular-v5-features/references/custom-messages.md",
      needle: /\{type\}_\{category\}/,
      why: "the bubble key format — setBubbleView('location') is accepted silently, never matches, and renders \"This message type is not supported\"" },
    { file: "cometchat-angular-v5-placement/references/core-surface.md",
      needle: /getConversationType\(\)/,
      why: "(itemClick) emits a Conversation; duck-typing it sends every GROUP into the [user] slot -> 'getUid is not a function'" },
    { file: "cometchat-angular-v5-placement/SKILL.md",
      needle: /getConversationType\(\)/,
      why: "same discrimination bug, in the entry-level recipe" },
    { file: "cometchat-angular-v5-core/SKILL.md",
      needle: /Which user should the app log in as/,
      why: "the startup UID must be ASKED; a baked cometchat-uid-1 logs in nowhere on an app without seeded samples" },
    { file: "cometchat-angular-v5-core/SKILL.md",
      needle: /getConversationType\(\)/,
      why: "the GOLDEN PATH itself — the entry recipe an unscoped 'add chat' emits. It was guarded in placement/* but not here, so the one-slot [user] binding survived and shipped: 1:1 works, groups throw 'getUid is not a function' (contracts.angular-v5.json conversation-subject-discriminated)" },
    { file: "cometchat-angular-v5-components/SKILL.md",
      needle: /cometchat-avatar/,
      why: "the kit ships presentational atoms; without this the agent hand-rolls an <img> avatar" },
    { file: "cometchat-onboarding/references/calling-first.md",
      needle: /VoIP push/,
      why: "the ringing shape question must ALSO ask about delivery: 'one-on-one ringing' reads as WhatsApp, but the recipe is foreground-only — background/killed ringing is a separate VoIP-push build (FCM + ConnectionService + a real device). Asked after the plan, the limit cannot inform the choice (AUDIT-195)" },
    { file: "cometchat-onboarding/references/calling-first.md",
      needle: /background|backgrounded/,
      why: "the foreground-only limit must be stated at PLAN time; the foreground-only build passes every casual test (both apps open in dev) and fails first in the user's real world (AUDIT-195)" },
    { file: "cometchat-android-v5-calls-sdk/SKILL.md",
      needle: /getLoggedInUser\(\)\?\.uid == uid/,
      why: "the session guard must branch on IDENTITY: guarding login on `getLoggedInUser() != null` (the docs' own snippet) silently places calls as the PREVIOUS user on a shared/re-used device (AUDIT-194)" },
    { file: "cometchat-android-v5-calls-sdk/references/user-switch.md",
      needle: /isInitialized/,
      why: "logout leaves the Calls SDK de-initialized, so a user switch needs logout -> RE-INIT -> login; without the re-init generateToken fails with ERROR_COMETCHAT_CALLS_SDK_INIT, an error naming the wrong cause (AUDIT-194)" },
  ];
  for (const { file, needle, why } of MUST) {
    const f = join(SKILLS_DIR, file);
    if (!existsSync(f)) { errs.push(`${file}: missing (GATE J expects it)`); continue; }
    if (!needle.test(readFileSync(f, "utf8"))) {
      errs.push(`${file}: lost a field-proven fact — ${why}`);
    }
  }
  return errs;
}


// GATE K (AUDIT-094): every code-emitting skill must carry a docs route. A skill that
// emits code while naming no docs path leaves the installed bundle as the only place an
// agent can look — that is how node_modules excursions start. Satisfied by referencing
// docs-map.md / DOCS_BASE / a docs URL, or by declaring a labelled DOCS GAP.
function gateDocsRouteOrDeclaredGap() {
  const errs = [];
  const EXEMPT = new Set(["cometchat", "cometchat-onboarding"]);   // router + journey: emit no symbols
  for (const dir of readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && OWNED_SKILL(d.name) && !EXEMPT.has(d.name)).map((d) => d.name)) {
    const f = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(f)) continue;
    let txt = readFileSync(f, "utf8");
    for (const ref of ["references"]) {
      const rd = join(SKILLS_DIR, dir, ref);
      if (existsSync(rd)) for (const r of readdirSync(rd)) txt += readFileSync(join(rd, r), "utf8");
    }
    const hasRoute = /docs-map|DOCS_BASE|docs_topic/.test(txt);
    const declaresGap = /docs (?:have|do) no|not in the docs|no dedicated .{0,40}page|no testing page|DOCS GAP/i.test(txt);
    if (!hasRoute && !declaresGap) {
      errs.push(`${dir}: emits code but names no docs route (no docs-map / DOCS_BASE / docs_topic) and declares no DOCS GAP — the installed bundle becomes the only lookup path (RULES §20)`);
    }
  }
  return errs;
}


// GATE L (AUDIT-097): the six kit list components size their inner scroll region off the
// HOST element's height and never size themselves (verified vs the compiled 5.1.0 bundle).
// Bare in a flex column they default to min-height:auto, so they grow past the shell and
// get clipped instead of scrolling. Every occurrence in a layout recipe must carry
// class="cc-fill" — or another class defined in the SAME skill with both `flex:` and
// `min-height: 0`.
function gateLeafListsAreSized() {
  const errs = [];
  const NEEDS_FILL = ["cometchat-conversations", "cometchat-users", "cometchat-groups",
    "cometchat-call-logs", "cometchat-search", "cometchat-message-list"];
  for (const dir of readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && OWNED_SKILL(d.name) && /^cometchat-angular-v5-/.test(d.name)).map((d) => d.name)) {
    const files = [join(SKILLS_DIR, dir, "SKILL.md")];
    const rd = join(SKILLS_DIR, dir, "references");
    if (existsSync(rd)) for (const r of readdirSync(rd)) files.push(join(rd, r));
    const texts = files.filter(existsSync).map((f) => readFileSync(f, "utf8"));
    // classes defined ANYWHERE in this skill's files that carry both flex and
    // min-height: 0 — a reference file legitimately reuses a class the companion
    // SKILL.md or another reference defines ("Built on core-surface.md — the
    // shell is identical" is exactly this pattern, not a missing definition).
    const sizedClasses = new Set(
      texts.flatMap((txt) =>
        [...txt.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{[^}]*\}/gs)]
          .filter((m) => /flex\s*:/.test(m[0]) && /min-height\s*:\s*0/.test(m[0]))
          .map((m) => m[1])
      )
    );
    for (const f of files) {
      if (!existsSync(f)) continue;
      const txt = readFileSync(f, "utf8");
      // Only check INSIDE an html fence that is itself a shell/column layout (contains
      // cc-side/cc-main/cc-panel/cc-tabs). A snippet illustrating one prop in isolation —
      // e.g. formatters.md's `<cometchat-message-list [textFormatters]="…">` — is not
      // claiming to be a droppable layout and is correctly exempt.
      for (const fence of txt.matchAll(/```html\n([\s\S]*?)```/g)) {
        const block = fence[1];
        if (!/\bcc-(side|main|panel|tabs)\b/.test(block)) continue;
        // AUDIT-106: <cometchat-error-boundary> ships no :host rule (verified vs 5.1.0), so
        // wrapping the shell in it inserts an auto-height flex item that breaks a
        // `height: 100%` chain below it. Styled by ELEMENT here, not by class.
        if (/<cometchat-error-boundary\b/.test(block)) {
          const styled = texts.some((t) =>
            /cometchat-error-boundary\s*\{[^}]*\}/s.test(t) &&
            [...t.matchAll(/cometchat-error-boundary\s*\{([^}]*)\}/gs)]
              .some((m) => /flex\s*:/.test(m[1]) && /min-height\s*:\s*0/.test(m[1]))
          );
          if (!styled) {
            errs.push(`${dir}/${f.split("/").pop()}: <cometchat-error-boundary> wraps a shell layout but no \`cometchat-error-boundary { flex: …; min-height: 0 }\` rule is defined — the kit ships no :host sizing, so the height chain breaks under a routed \`height: 100%\` shell (AUDIT-106)`);
          }
        }
        for (const tag of NEEDS_FILL) {
          const re = new RegExp(`<${tag}\\b([^>]*)>`, "g");
          let m;
          while ((m = re.exec(block))) {
            const attrs = m[1];
            const classMatch = attrs.match(/class="([^"]*)"/);
            const classes = classMatch ? classMatch[1].split(/\s+/) : [];
            if (!classes.some((c) => sizedClasses.has(c))) {
              errs.push(`${dir}/${f.split("/").pop()}: <${tag}> inside a shell layout has no sized class (flex + min-height:0) — it will clip instead of scroll`);
            }
          }
        }
      }
    }
  }
  return errs;
}

// GATE M (AUDIT-106): a skill must route to docs for its OWN subject, not merely name some
// docs path — GATE K is satisfied by any docs-map mention, which a migration skill passes
// while carrying no route to the migration guide at all. Add future subject-specific skills
// to SUBJECT_ROUTES.
const SUBJECT_ROUTES = [
  { suffix: "-migration", needle: /migration-guide|migration-overview|migration-property-changes|\/upgrade/i,
    what: "a migration/upgrade docs path" },
];
function gateSubjectDocsRoute() {
  const errs = [];
  for (const dir of readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && OWNED_SKILL(d.name)).map((d) => d.name)) {
    const rule = SUBJECT_ROUTES.find((r) => dir.endsWith(r.suffix));
    if (!rule) continue;
    const f = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(f)) continue;
    // The route must be reachable from the skill itself OR from the docs-map it points at.
    let txt = readFileSync(f, "utf8");
    const rd = join(SKILLS_DIR, dir, "references");
    if (existsSync(rd)) for (const r of readdirSync(rd)) txt += readFileSync(join(rd, r), "utf8");
    const family = (dir.match(/^cometchat-(.+)-migration$/) || [])[1];
    const dm = family && join(SKILLS_DIR, `cometchat-${family}-core`, "references", "docs-map.md");
    const dmTxt = dm && existsSync(dm) ? readFileSync(dm, "utf8") : "";
    const inSkill = rule.needle.test(txt);
    const inDocsMap = rule.needle.test(dmTxt);
    if (!inSkill || !inDocsMap) {
      const where = !inSkill && !inDocsMap ? "its own files AND its family's docs-map.md"
        : !inSkill ? "its own files (SKILL.md + references/)"
        : "its family's core docs-map.md";
      errs.push(`${dir}: no ${rule.what} in ${where} — a subject-specific skill must route to ITS OWN docs, not only to the component docs-map (RULES §Fetch discipline; AUDIT-106)`);
    }
  }
  return errs;
}

// GATE N (AUDIT-107): the app-level `chat-experience` oracle must list every list component
// its family's grow-target recipe actually renders — an oracle listing fewer components than
// the recipe emits makes the agent drop a tab. Checked against the RECIPE, not the sibling
// family: families may diverge, but a family must not disagree with itself.
function gateChatExperienceMatchesRecipe() {
  const errs = [];
  const FAMILIES = [
    { features: "features.angular-v5.json", recipe: "cometchat-angular-v5-placement/references/combined-app.md",
      tags: { "cometchat-conversations": "CometChatConversationsComponent", "cometchat-users": "CometChatUsersComponent",
              "cometchat-groups": "CometChatGroupsComponent", "cometchat-call-logs": "CometChatCallLogsComponent" } },
  ];
  for (const fam of FAMILIES) {
    const fp = join(SKILLS_DIR, "..", fam.features);
    const rp = join(SKILLS_DIR, fam.recipe);
    if (!existsSync(fp) || !existsSync(rp)) continue;
    let feats;
    try { feats = JSON.parse(readFileSync(fp, "utf8")); } catch { continue; }
    const flat = Array.isArray(feats) ? feats : Object.values(feats).flat().filter((x) => x && x.id);
    const ce = flat.find((x) => x.id === "chat-experience");
    if (!ce) continue;
    const declared = new Set(ce.ui_components || []);
    const recipe = readFileSync(rp, "utf8");
    for (const [tag, cls] of Object.entries(fam.tags)) {
      // the recipe renders it (as an element) but the oracle omits it
      if (new RegExp(`<${tag}\\b`).test(recipe) && !declared.has(cls)) {
        errs.push(`${fam.features}: chat-experience omits ${cls}, but ${fam.recipe} renders <${tag}> — the app-level oracle must list every component its own grow-target recipe emits (AUDIT-107)`);
      }
    }
  }
  return errs;
}


// GATE Q (AUDIT-180): a skill may only tell an agent to run CLI commands that EXIST. The
// shipped dashboard CLI (@cometchat/skills-cli) has auth/provision/config/features — no
// `detect`. The skills pack CLI (@cometchat/skills) DOES ship `detect` (bin/cometchat-skills.mjs
// since v5.0.0, the authority for framework / UI Kit / version_conflict / existing_cometchat —
// RULES §3/§21), so its command set is DERIVED from the bin's dispatcher, never hard-coded: the
// hard-coded add/install list flagged the real `detect` as nonexistent. A bare `detect --json`
// that names no tool is still flagged (an agent can't tell which CLI to run). Applied pack-wide
// plus the shipped RULES.md (which the same agents read).
function packCliCommands() {
  try {
    const src = readFileSync(join(ROOT, "bin", "cometchat-skills.mjs"), "utf8");
    const cmds = [...src.slice(src.lastIndexOf("switch (CMD)")).matchAll(/case "([a-z][a-z-]*)":/g)].map((m) => m[1]);
    if (cmds.length) return new Set(cmds);
  } catch { /* fall through */ }
  return new Set(["add", "install", "detect"]);
}
function gateCliCommandsExist(files) {
  const errs = [];
  const CLI_OK = new Set(["auth", "provision", "config", "features"]);
  const PACK_OK = packCliCommands();
  const RE = /(@cometchat\/skills-cli(?:@\d+)?|@cometchat\/skills)\s+([a-z][a-z-]*)/g;
  const targets = [...files];
  const shippedRules = join(ROOT, "RULES.md");
  if (existsSync(shippedRules)) targets.push(shippedRules);
  for (const f of targets) {
    const rel = f.startsWith(SKILLS_DIR) ? f.slice(SKILLS_DIR.length + 1) : f.slice(ROOT.length + 1);
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      for (const m of line.matchAll(RE)) {
        const isCli = m[1].startsWith("@cometchat/skills-cli");
        const ok = isCli ? CLI_OK : PACK_OK;
        if (!ok.has(m[2])) {
          errs.push(`${rel}:${i + 1}: tells the agent to run \`${m[0]}\` — ${isCli ? "@cometchat/skills-cli" : "@cometchat/skills"} has no \`${m[2]}\` command (real: ${[...ok].join("/")}) (RULES §21)`);
        }
      }
      if (/\bdetect --json\b/.test(line) && !/@cometchat\/skills\s+detect --json\b/.test(line)) {
        errs.push(`${rel}:${i + 1}: references \`detect --json\` without naming the tool — write \`npx @cometchat/skills detect --json\` (the skills pack CLI; the dashboard CLI has no detect) (RULES §21)`);
      }
    });
  }
  return errs;
}

// GATE R (AUDIT-181): the shared skills' PLATFORM COVERAGE must match the shipped families.
// GATE I checks a shipped core is NAMED; this checks the journey can actually run for it:
// platforms.md needs a column per shipped family (else beat 1 is improvised), and the
// "not-yet-built" lists must not name a family that ships (a literal agent declines the user —
// onboarding listed Android/RN/Flutter/Angular as not-built after all four had shipped).
function gateSharedSkillsCoverShippedFamilies() {
  const errs = [];
  const LABEL = { react: "React", angular: "Angular", "react-native": "React Native", android: "Android", flutter: "Flutter", ios: "iOS" };
  const shipped = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => (d.name.match(/^cometchat-(.+)-core$/) || [])[1])
    .filter(Boolean)
    .map((fam) => ({ fam, label: LABEL[fam.replace(/-v\d+$/, "")] }))
    .filter((x) => x.label);
  if (shipped.length < 2) return errs;
  const onb = join(SKILLS_DIR, "cometchat-onboarding");
  const plat = join(onb, "references", "platforms.md");
  if (existsSync(plat)) {
    const txt = readFileSync(plat, "utf8");
    for (const { fam, label } of shipped) {
      if (!new RegExp(`\\|[^|\\n]*\\b${label}\\b[^|\\n]*\\|`).test(txt)) {
        errs.push(`cometchat-onboarding/references/platforms.md: no table column for the shipped ${fam} family ("${label}") — beat 1 gets improvised on that platform`);
      }
    }
  }
  for (const f of [join(onb, "SKILL.md"), join(onb, "references", "not-in-this-pack.md")]) {
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8");
    for (const m of txt.matchAll(/Not-yet-built core \([^)]*?peer — (.*?) today/g)) {
      for (const { fam, label } of shipped) {
        if (new RegExp(`\\b${label}\\b`).test(m[1])) {
          errs.push(`${f.slice(SKILLS_DIR.length + 1)}: lists the shipped ${fam} family ("${label}") as not-yet-built — a literal agent will decline that platform`);
        }
      }
    }
  }
  return errs;
}

function main() {
  if (!existsSync(SKILLS_DIR)) { console.error("no skills/ dir"); process.exit(2); }
  const routed = routedSlugs();
  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const routerOk = existsSync(join(SKILLS_DIR, "cometchat", "SKILL.md"));
  const allErrs = [];
  let checked = 0;
  for (const dir of dirs) {
    if (dir === "cometchat") continue; // the thin router, linted separately below
    checked++;
    allErrs.push(...lintSkill(dir, routed));
  }
  if (!routerOk) allErrs.push("cometchat/SKILL.md (thin router) missing");

  // Pack-level durability gates (AUDIT-025 / AUDIT-018 / AUDIT-013 / AUDIT-029).
  const allMd = mdFiles(SKILLS_DIR);
  allErrs.push(...gateThemeSelector(allMd));
  allErrs.push(...gateShippedRules());
  allErrs.push(...gateV7VerifyMarkers(allMd));
  allErrs.push(...gateOsThemeRecipe());
  allErrs.push(...gateInitTelemetry());
  allErrs.push(...gateSectionSpine());
  allErrs.push(...gatePreviewDocsBase());
  allErrs.push(...gateFeatureDescriptionCoverage());
  allErrs.push(...gateSharedSkillsRouteEveryFamily());
  allErrs.push(...gateFieldProvenFacts());
  allErrs.push(...gateDocsRouteOrDeclaredGap());
  allErrs.push(...gateLeafListsAreSized());
  allErrs.push(...gateSubjectDocsRoute());
  allErrs.push(...gateChatExperienceMatchesRecipe());
  allErrs.push(...gateArtifactRefs(allMd));
  allErrs.push(...gatePlatformMetadata());
  allErrs.push(...gateCliCommandsExist(allMd));
  allErrs.push(...gateSharedSkillsCoverShippedFamilies());

  const ok = allErrs.length === 0;
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok, checked, routerOk, errors: allErrs }, null, 0));
  } else if (ok) {
    console.log(`✅ lint-skills: ${checked} skill(s) valid; router present; ${routed.slugs.size} routed slug(s); pack durability gates green (theme-selector / shipped-RULES / v7-verify / os-theme-recipe / init-telemetry / artifact-refs / platform-metadata / section-spine / preview-docs-base / feature-description-coverage / shared-routes-every-family / field-proven-facts / docs-route / leaf-lists-sized / subject-docs-route / chat-experience-matches-recipe / cli-commands-exist / shared-skills-cover-shipped-families).`);
  } else {
    console.log(`❌ lint-skills: ${allErrs.length} problem(s) across ${checked} skill(s):`);
    for (const e of allErrs) console.log(`  - ${e}`);
  }
  process.exit(ok ? 0 : 1);
}

main();
