#!/usr/bin/env bash
# Static integrity harness for cometchat-skills.
# No LLM-in-loop. Deterministic checks only.

set -uo pipefail
cd "$(dirname "$0")/../.."
REPO="$PWD"

pass=0
fail=0
fail_lines=()

ok()      { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass+1)); }
bad()     { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail+1)); fail_lines+=("$1"); }
section() { printf "\n\033[1m── %s ──\033[0m\n" "$1"; }

# ── 1. Frontmatter validity ─────────────────────────────────────────────────
section "Frontmatter validity"
for d in skills/*/; do
  name=$(basename "$d")
  md="${d}SKILL.md"
  if [[ ! -f "$md" ]]; then
    bad "$name: missing SKILL.md"
    continue
  fi
  result=$(node -e "
    const fs = require('fs');
    const txt = fs.readFileSync(process.argv[1], 'utf8');
    const m = txt.match(/^---\n([\s\S]*?)\n---/);
    if (!m) { console.log('no frontmatter block'); process.exit(1); }
    const body = m[1];
    const get = (k) => (body.match(new RegExp('^' + k + ':\\\\s*(.+)\$', 'm')) || [])[1];
    const missing = [];
    if (!get('name')) missing.push('name');
    if (!get('description')) missing.push('description');
    if (!get('license')) missing.push('license');
    const ver = (body.match(/^\\s+version:\\s*\"([^\"]+)\"/m) || [])[1];
    if (!ver) missing.push('metadata.version');
    if (missing.length) { console.log('missing: ' + missing.join(', ')); process.exit(1); }
    const declaredName = (get('name') || '').trim();
    if (declaredName !== process.argv[2]) {
      console.log('name mismatch: frontmatter says \"' + declaredName + '\", dir is \"' + process.argv[2] + '\"');
      process.exit(1);
    }
  " "$md" "$name" 2>&1)
  if [[ $? -eq 0 ]]; then ok "$name"; else bad "$name: $result"; fi
done

# ── 2. install.js ↔ skills/ parity ──────────────────────────────────────────
section "install.js ↔ skills/ parity"
install_names=$(node -e "
  const fs = require('fs');
  const c = fs.readFileSync('bin/install.js', 'utf8');
  const names = [...c.matchAll(/name:\s*\"([^\"]+)\"/g)].map(m => m[1]);
  console.log(names.sort().join('\n'));
")
disk_names=$(ls skills/ | sort)
if diff <(echo "$install_names") <(echo "$disk_names") > /tmp/verify-parity.diff 2>&1; then
  ok "install.js registers every on-disk skill (and vice versa)"
else
  bad "parity mismatch:\n$(cat /tmp/verify-parity.diff)"
fi

# ── 3. Intra-skill reference resolution ─────────────────────────────────────
section "Intra-skill references"
ref_result=$(node -e "
  const fs = require('fs');
  const path = require('path');
  const installTxt = fs.readFileSync('bin/install.js', 'utf8');
  const known = new Set([...installTxt.matchAll(/name:\s*\"([^\"]+)\"/g)].map(m => m[1]));
  // Only match backtick-quoted tokens AND enforce the 'skill' phrasing OR
  // that the token is a known non-skill idiom. This is the idiomatic form
  // (\`cometchat-production\` skill) so it cleanly separates skill refs from
  // CSS vars / BEM classes / URL paths / npm package names.
  const allow = /^cometchat-(uid-\d+|docs|skills-cli|skills|resources|chat|chat-uikit|chat-uikit-react|chat-sdk|chat-sdk-javascript|chat-widget)\$/;
  const bad = [];
  for (const dir of fs.readdirSync('skills')) {
    const f = path.join('skills', dir, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    // Match \`cometchat-xxx\` only (backticked), deduped.
    const tokens = new Set(
      [...txt.matchAll(/\`(cometchat-[a-z][a-z0-9-]+)\`/g)].map(m => m[1])
    );
    for (const tok of tokens) {
      if (known.has(tok)) continue;
      if (allow.test(tok)) continue;
      bad.push(dir + ' references unknown skill: \`' + tok + '\`');
    }
  }
  if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
" 2>&1)
if [[ $? -eq 0 ]]; then
  ok "all cometchat-* references resolve to known skills or allowed npm/MCP names"
else
  bad "dangling references:\n$ref_result"
fi

# ── 4. install.js --list succeeds ──────────────────────────────────────────
section "install.js --list"
if node bin/install.js add --list > /tmp/verify-list.out 2>&1; then
  count=$(grep -cE '^  cometchat' /tmp/verify-list.out || true)
  ok "--list prints $count skills (exit 0)"
else
  bad "install.js add --list failed (exit $?): $(tail -5 /tmp/verify-list.out)"
fi

# ── 5. install.js add --ide <each IDE> into tmp dir ────────────────────────
section "install.js add --ide <each IDE>"
tmpdir=$(mktemp -d -t cometchat-verify-XXXXXX)
expected_count=$(node -e "
  const c = require('fs').readFileSync('bin/install.js','utf8');
  console.log([...c.matchAll(/name:\s*\"[^\"]+\"/g)].length);
")
for ide in claude cursor kiro copilot; do
  sub="$tmpdir/$ide"
  mkdir -p "$sub"
  ( cd "$sub" && node "$REPO/bin/install.js" add --ide "$ide" > "$sub/.out" 2>&1 )
  rc=$?
  if [[ $rc -ne 0 ]]; then
    bad "ide=$ide: install exit $rc — $(tail -3 "$sub/.out")"
    continue
  fi
  case "$ide" in
    claude)  target="$sub/.claude/skills"  ;;
    cursor)  target="$sub/.cursor/skills"  ;;
    kiro)    target="$sub/.kiro/skills"    ;;
    copilot) target="$sub/.github/copilot-instructions.md" ;;
  esac
  if [[ "$ide" == "copilot" ]]; then
    if [[ -f "$target" ]]; then
      bytes=$(wc -c < "$target" | tr -d ' ')
      ok "ide=$ide: bundle at $target ($bytes bytes)"
    else
      bad "ide=$ide: copilot-instructions.md not created"
    fi
  else
    if [[ -d "$target" ]]; then
      got=$(ls "$target" | wc -l | tr -d ' ')
      if [[ "$got" == "$expected_count" ]]; then
        ok "ide=$ide: $got/$expected_count skills installed"
      else
        bad "ide=$ide: installed $got skills, expected $expected_count"
      fi
    else
      bad "ide=$ide: target dir $target missing"
    fi
  fi
done
rm -rf "$tmpdir"

# ── Summary ────────────────────────────────────────────────────────────────
echo
total=$((pass + fail))
if [[ $fail -eq 0 ]]; then
  printf "\033[1;32m✓ %d/%d checks passed\033[0m\n" "$pass" "$total"
  exit 0
else
  printf "\033[1;31m✗ %d/%d checks failed\033[0m\n" "$fail" "$total"
  printf "\nFailures:\n"
  for line in "${fail_lines[@]}"; do
    printf "  • %s\n" "$line"
  done
  exit 1
fi
