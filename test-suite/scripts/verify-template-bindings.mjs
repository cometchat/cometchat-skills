#!/usr/bin/env node
/**
 * verify-template-bindings.mjs — Tier-2b: validate Angular TEMPLATE bindings in
 * ```html skill fences against the installed kit's component declarations.
 *
 *   node test-suite/scripts/verify-template-bindings.mjs --family angular-v5 \
 *     --project test-suite/typecheck/angular-v5
 *
 * WHY THIS EXISTS
 * typecheck-fences.mjs only extracts ```ts/```tsx fences, because that is all
 * `tsc` can check. In React that is sufficient — component usage lives in .tsx
 * and bad props fail the compile. In ANGULAR component usage lives in the
 * TEMPLATE, so the half of the surface most likely to be wrong was checked by
 * nothing at all.
 *
 * Concretely: `<cometchat-conversations (ccConversationClicked)="...">` shipped
 * in cometchat-angular-v5-core and passed lint + catalog + fences, all green.
 * The real output is `itemClick`; `ccConversationClicked` is a React-ism. An
 * unknown output binding in Angular fails SILENTLY — no error, the handler just
 * never fires — so this is exactly the class of defect a human review misses.
 *
 * Validating a template properly needs Angular's own compiler (ngtsc with
 * strictTemplates), which needs a real component + imports[] + a build — far too
 * heavy for illustrative fragments. This does the targeted 90%: every
 * <cometchat-*> element's selector must exist, and every [input] / (output)
 * bound on it must be declared by that component.
 *
 * Reads the kit's ɵɵComponentDeclaration entries (selector + input/output maps),
 * so it is always in sync with the installed version — no committed artifact to
 * drift. Needs the pinned kit installed (same precondition as verify:fences);
 * hard-exits 2 when absent so it can never pass vacuously.
 *
 * Exit: 0 clean · 1 unknown selector/binding · 2 bad invocation or kit missing.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };

// RULES.md §22 — no literal family key; resolve from families.json (by review key OR
// catalog key, so --family angular-v5 and --family web-angular-v5 both work).
const FAM_DATA = JSON.parse(readFileSync(
  join(ROOT, ".claude/skills/cometchat-skill-reviewer/tools/families.json"), "utf8")).families;
// RULES.md §22: no literal family key, not even as a default — the caller names the family
const FAMILY = arg("--family");
if (!FAMILY) { console.error("--family is required (see families.json)"); process.exit(2); }
const PROJECT = arg("--project", `test-suite/typecheck/${FAMILY}`);
const _f = FAM_DATA[FAMILY] || Object.values(FAM_DATA).find(
  (f) => (f.catalog || "").replace(/^catalog\//, "").replace(/\.json$/, "") === FAMILY);
if (!_f) { console.error(`unknown --family: ${FAMILY}`); process.exit(2); }
if (!_f.kitPackage || !_f.skillDirPattern) {
  console.log(`⏭  verify-template-bindings [${FAMILY}]: family declares no kitPackage/skillDirPattern — skipped`);
  process.exit(0);
}
const fam = {
  skillDir: new RegExp(_f.skillDirPattern),
  kit: `node_modules/${_f.kitPackage}`,
  // @cometchat/chat-uikit-angular -> types/cometchat-chat-uikit-angular.d.ts
  dts: `types/${_f.kitPackage.replace(/^@/, "").replace("/", "-")}.d.ts`,
};

const dtsPath = join(ROOT, PROJECT, fam.kit, fam.dts);
if (!existsSync(dtsPath)) {
  console.error(`kit not installed: ${dtsPath}`);
  console.error(`run: npm run verify:fences:${FAMILY}:setup`);
  process.exit(2);
}

// ── the oracle: selector → { inputs, outputs } from ɵɵComponentDeclaration ────
const dts = readFileSync(dtsPath, "utf8");
const DECL = /ɵɵComponentDeclaration<\s*(\w+),\s*"([^"]+)",\s*[^,]+,\s*\{([\s\S]*?)\},\s*\{([\s\S]*?)\},\s*never/g;
const bySelector = new Map();
for (const m of dts.matchAll(DECL)) {
  const inputs = new Set([...m[3].matchAll(/"([\w$]+)"\s*:/g)].map((x) => x[1]));
  // outputs are  "prop": "publicAlias"  — the ALIAS is what a template binds
  const outputs = new Set([...m[4].matchAll(/"([\w$]+)"\s*:\s*"([\w$]+)"/g)].map((x) => x[2]));
  bySelector.set(m[2], { cls: m[1], inputs, outputs });
}
if (bySelector.size === 0) { console.error("parsed 0 component declarations — the .d.ts shape changed; fix DECL"); process.exit(2); }

// ── collect ```html fences from this family's skills ──────────────────────────
const SKILLS_DIR = join(ROOT, "skills");
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) files.push(p);
  }
};
for (const d of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (d.isDirectory() && fam.skillDir.test(d.name)) walk(join(SKILLS_DIR, d.name));
}

// Angular syntax that is NOT a component binding — structural directives, refs,
// two-way sugar, animations, and plain HTML attributes.
const SKIP_ATTR = /^(\*|#|@|\[\(|class$|style$|id$|hidden$|title$|role$|aria-|data-|ng)/;

let unknownSelector = 0, unknownBinding = 0, checkedEls = 0, checkedBindings = 0;
const problems = [];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const fence of src.matchAll(/```html\n([\s\S]*?)```/g)) {
    for (const el of fence[1].matchAll(/<(cometchat-[a-z0-9-]+)([^>]*)>/g)) {
      const [, selector, attrsRaw] = el;
      const decl = bySelector.get(selector);
      checkedEls++;
      if (!decl) {
        unknownSelector++;
        problems.push(`${f.replace(ROOT + "/", "")}: <${selector}> is not a component in the installed kit`);
        continue;
      }
      for (const a of attrsRaw.matchAll(/(\[?\(?[\w$.-]+\)?\]?)\s*=\s*"/g)) {
        const raw = a[1];
        if (SKIP_ATTR.test(raw)) continue;
        const isOut = raw.startsWith("(") && raw.endsWith(")");
        const isIn = raw.startsWith("[") && raw.endsWith("]");
        if (!isOut && !isIn) continue;             // plain static attribute
        const name = raw.slice(1, -1);
        checkedBindings++;
        const ok = isOut ? decl.outputs.has(name) : decl.inputs.has(name);
        if (!ok) {
          unknownBinding++;
          const kind = isOut ? "output" : "input";
          const near = [...(isOut ? decl.outputs : decl.inputs)]
            .filter((n) => n.toLowerCase().includes(name.toLowerCase().replace(/^cc/, "").slice(0, 5)))
            .slice(0, 4);
          problems.push(
            `${f.replace(ROOT + "/", "")}: <${selector}> has no ${kind} "${name}"` +
            (near.length ? `  — did you mean: ${near.join(", ")}?` : "")
          );
        }
      }
    }
  }
}

console.log(`verify-template-bindings [${FAMILY}]: ${bySelector.size} component declaration(s) · ${files.length} skill file(s) · ${checkedEls} element(s) · ${checkedBindings} binding(s) checked`);
if (problems.length === 0) {
  console.log(`\n✅ Tier-2b: every <cometchat-*> selector exists and every [input]/(output) is declared by that component.`);
  process.exit(0);
}
console.log(`\n❌ ${problems.length} template-binding problem(s) — these fail SILENTLY at runtime in Angular:`);
for (const p of problems) console.log(`  ${p}`);
process.exit(1);
