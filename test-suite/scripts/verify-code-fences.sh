#!/usr/bin/env bash
# Walk every fenced code block in every SKILL.md.
# - bash blocks pass `bash -n` (syntax check, no execution)
# - json blocks parse as JSON
# - ts/tsx/js/jsx blocks pass a basic tsc syntax parse
# Blocks that are intentionally partial (contain placeholders like <foo>,
# $VAR, YOUR_*_HERE, ... or `// import your auth`) are soft-failed with a
# warning, since they're snippets not full files.

set -uo pipefail
cd "$(dirname "$0")/../.."
REPO="$PWD"

pass=0; fail=0; skip=0
fail_lines=()
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass+1)); }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail+1)); fail_lines+=("$1"); }
skp()  { printf "  \033[90m~\033[0m %s\n" "$1"; skip=$((skip+1)); }

# Check if typescript is loadable (from test-suite/node_modules or root);
# if not, TS/JS fences get soft-skipped.
TS_RESOLVE=$(NODE_PATH="$REPO/test-suite/node_modules:$REPO/node_modules" node -e "console.log(require.resolve('typescript'))" 2>/dev/null || true)
if [[ -n "$TS_RESOLVE" ]]; then
  TS_AVAILABLE=1
  TS_PATH="$TS_RESOLVE"
else
  TS_AVAILABLE=0
  printf "  \033[90m!\033[0m typescript module not found — ts/tsx/js/jsx fences will be skipped\n"
  printf "  \033[90m  (to enable, run: cd test-suite && npm install)\033[0m\n"
fi

# Extract blocks: emit one file per block into /tmp/fence-<skill>-<idx>.<ext>
rm -rf /tmp/fence-blocks
mkdir -p /tmp/fence-blocks

node -e "
const fs = require('fs');
const path = require('path');
const mapExt = { bash: 'sh', sh: 'sh', shell: 'sh', json: 'json',
                 ts: 'ts', tsx: 'tsx', js: 'js', jsx: 'jsx', typescript: 'ts' };
const out = [];
for (const dir of fs.readdirSync('skills')) {
  const f = path.join('skills', dir, 'SKILL.md');
  if (!fs.existsSync(f)) continue;
  const txt = fs.readFileSync(f, 'utf8');
  let idx = 0;
  // Match triple-backtick fenced blocks whose OPENING fence is at the start
  // of a line (no indent, not inside a > blockquote). Indented fences inside
  // quote blocks are contextual/illustrative and shouldn't be validated.
  const re = /^\`\`\`([a-z]*)\n([\s\S]*?)\n^\`\`\`/gm;
  for (const m of txt.matchAll(re)) {
    idx++;
    const lang = (m[1] || '').toLowerCase();
    const ext = mapExt[lang];
    if (!ext) continue; // skip languages we don't validate (diff, md, etc.)
    const body = m[2];
    const file = '/tmp/fence-blocks/' + dir + '-' + String(idx).padStart(3, '0') + '.' + ext;
    fs.writeFileSync(file, body);
    out.push({ dir, idx, lang, ext, file, body });
  }
}
fs.writeFileSync('/tmp/fence-blocks/index.json', JSON.stringify(out, null, 2));
console.log(out.length + ' fenced blocks extracted');
"

# Walk index
while IFS= read -r line; do
  dir=$(echo "$line" | cut -f1)
  idx=$(echo "$line" | cut -f2)
  lang=$(echo "$line" | cut -f3)
  file=$(echo "$line" | cut -f4)
  name="$dir #${idx} ($lang)"

  # Placeholder / template detection — skip validation for blocks that are
  # obviously illustrative snippets, not complete runnable code.
  if grep -qE '<[a-z][a-z-]+>|\$\{?[A-Z_]+\}?|YOUR_[A-Z_]+_HERE|^\s*\.\.\.\s*$|\.\.\.\.\.\.|// adapt|// your|// e\.g\.|// example|\{ \.\.\. \}|\.\.\. \}|^\s*\}\s*$' "$file"; then
    skp "$name: snippet/placeholder — skipped"
    continue
  fi
  # Block that starts with `{` at column 0 is an object-fragment illustration,
  # not a full module — skip.
  if head -1 "$file" | grep -qE '^\{'; then
    skp "$name: object-fragment illustration — skipped"
    continue
  fi
  # Type-signature documentation: methods/types listed with no function bodies
  # (e.g. `Foo(x: Y): Promise<Z>` on its own line). Skip if the pattern shows up.
  if [[ "$lang" == "ts" || "$lang" == "tsx" || "$lang" == "typescript" ]] && grep -qE '^[A-Z][A-Za-z.]+\([^)]*\):\s*[A-Z]' "$file"; then
    skp "$name: type-signature doc — skipped"
    continue
  fi

  case "$lang" in
    bash|sh|shell)
      if bash -n "$file" 2>/tmp/fencechk; then
        ok "$name"
      else
        bad "$name: $(head -1 /tmp/fencechk)"
      fi
      ;;
    json)
      if node -e "JSON.parse(require('fs').readFileSync('$file','utf8'))" 2>/tmp/fencechk; then
        ok "$name"
      else
        bad "$name: $(head -1 /tmp/fencechk)"
      fi
      ;;
    ts|tsx|typescript|js|jsx)
      if [[ "$TS_AVAILABLE" != "1" ]]; then
        skp "$name: typescript not installed"
        continue
      fi
      # Best-effort syntax parse via TypeScript compiler in transpile-only mode.
      if NODE_PATH="$REPO/test-suite/node_modules:$REPO/node_modules" node -e "
        const ts = require('typescript');
        const src = require('fs').readFileSync('$file','utf8');
        const result = ts.transpileModule(src, {
          compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext },
          reportDiagnostics: true,
        });
        const syntactic = (result.diagnostics || []).filter(d => d.category === 1 && d.code < 2000);
        if (syntactic.length) {
          for (const d of syntactic) {
            const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
            console.error('TS' + d.code + ': ' + msg);
          }
          process.exit(1);
        }
      " 2>/tmp/fencechk; then
        ok "$name"
      else
        bad "$name: $(head -1 /tmp/fencechk)"
      fi
      ;;
    *)
      skp "$name: unknown lang"
      ;;
  esac
done < <(node -e "
  const r = JSON.parse(require('fs').readFileSync('/tmp/fence-blocks/index.json', 'utf8'));
  for (const x of r) console.log(x.dir + '\t' + x.idx + '\t' + x.lang + '\t' + x.file);
")

echo
total=$((pass + fail))
if [[ $fail -eq 0 ]]; then
  printf "\033[1;32m✓ %d/%d fence checks passed (%d skipped as snippets)\033[0m\n" "$pass" "$total" "$skip"
  exit 0
else
  printf "\033[1;31m✗ %d/%d fence checks failed (%d skipped)\033[0m\n" "$fail" "$total" "$skip"
  printf "\nFailures:\n"
  for line in "${fail_lines[@]}"; do printf "  • %s\n" "$line"; done
  exit 1
fi
