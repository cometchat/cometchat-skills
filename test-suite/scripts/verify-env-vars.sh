#!/usr/bin/env bash
# Env var name consistency across skills.
# Canonical set: *_COMETCHAT_APP_ID, *_COMETCHAT_REGION, *_COMETCHAT_AUTH_KEY
# (server-only): COMETCHAT_REST_API_KEY, COMETCHAT_APP_ID, COMETCHAT_REGION
# Flags typos, missing variants, wrong prefixes per framework.

set -uo pipefail
cd "$(dirname "$0")/../.."

pass=0; fail=0
fail_lines=()
ok()  { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass+1)); }
bad() { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail+1)); fail_lines+=("$1"); }

node -e "
const fs = require('fs');
const path = require('path');

// Canonical env var suffixes (without prefix).
const canonical = new Set([
  'COMETCHAT_APP_ID',
  'COMETCHAT_REGION',
  'COMETCHAT_AUTH_KEY',        // client-side dev key
  'COMETCHAT_AUTH_TOKEN',       // server-side REST key (legacy name in pattern skills)
  'COMETCHAT_REST_API_KEY',     // server-side REST key (newer name in cometchat-production)
]);
// Valid prefixes
const prefixes = ['VITE_', 'PUBLIC_', 'NEXT_PUBLIC_', ''];

// Build the universe of valid env var names.
const valid = new Set();
for (const p of prefixes) for (const c of canonical) valid.add(p + c);

// Known typos we care about — map pattern → suggested correction.
const typoPatterns = [
  { re: /\bCOMETCHAT_APPID\b/, fix: 'COMETCHAT_APP_ID (underscore before ID)' },
  { re: /\bCOMETCHAT_REGION_ID\b/, fix: 'COMETCHAT_REGION (no _ID suffix)' },
  { re: /\bCOMETCHAT_AUTHKEY\b/, fix: 'COMETCHAT_AUTH_KEY (underscore before KEY)' },
  { re: /\bCOMETCHAT_APPKEY\b/, fix: 'COMETCHAT_AUTH_KEY (you probably meant AUTH_KEY)' },
  { re: /\bCOMETCHAT_RESTAPIKEY\b/, fix: 'COMETCHAT_REST_API_KEY (underscores)' },
  { re: /\bCOMETCHAT_REST_KEY\b/, fix: 'COMETCHAT_REST_API_KEY' },
  { re: /\bCOMETCHAT_APP_KEY\b/, fix: 'COMETCHAT_AUTH_KEY' },
];

// Framework → expected public prefix. Only applied to pattern skills
// (which contain code examples with env vars). The thin CLI-wrapper skills
// (cometchat-react-*) intentionally don't recite env var names — the CLI
// sets them and the dispatcher's Step 2d has the full table.
const frameworkPrefix = {
  'cometchat-react-patterns': 'VITE_',
  'cometchat-nextjs-patterns': 'NEXT_PUBLIC_',
  'cometchat-react-router-patterns': 'VITE_',
  'cometchat-astro-patterns': 'PUBLIC_',
};

const results = [];

for (const dir of fs.readdirSync('skills')) {
  const f = path.join('skills', dir, 'SKILL.md');
  if (!fs.existsSync(f)) continue;
  const txt = fs.readFileSync(f, 'utf8');

  // 1. Typo hunt
  for (const { re, fix } of typoPatterns) {
    const m = txt.match(re);
    if (m) {
      results.push({ status: 'fail', dir, msg: 'typo: ' + m[0] + ' → ' + fix });
    }
  }

  // 2. Collect all *COMETCHAT_* tokens
  const tokens = new Set(
    [...txt.matchAll(/\b((?:VITE_|PUBLIC_|NEXT_PUBLIC_)?COMETCHAT_[A-Z_]+)\b/g)].map(m => m[1])
  );

  // 3. Each must either be in valid set OR documented as the framework's prefix correction.
  for (const tok of tokens) {
    if (valid.has(tok)) continue;
    results.push({ status: 'fail', dir, msg: 'unknown env var: ' + tok });
  }

  // 4. Framework-specific: if this skill is a framework skill, it should mention its prefix.
  if (frameworkPrefix[dir]) {
    const wanted = frameworkPrefix[dir] + 'COMETCHAT_APP_ID';
    if (txt.includes(wanted)) {
      results.push({ status: 'pass', dir, msg: dir + ' uses correct prefix (' + frameworkPrefix[dir] + ')' });
    } else {
      results.push({ status: 'fail', dir, msg: dir + ' should reference ' + wanted + ' but does not' });
    }
  }
}

fs.writeFileSync('/tmp/verify-env.json', JSON.stringify(results, null, 2));
" 2>&1

while IFS= read -r line; do
  status=$(echo "$line" | cut -f1)
  msg=$(echo "$line" | cut -f2-)
  if [[ "$status" == "pass" ]]; then ok "$msg"; else bad "$msg"; fi
done < <(node -e "
  const r = JSON.parse(require('fs').readFileSync('/tmp/verify-env.json', 'utf8'));
  for (const x of r) console.log(x.status + '\t' + x.msg);
")

echo
total=$((pass + fail))
if [[ $fail -eq 0 ]]; then
  printf "\033[1;32m✓ %d/%d env var checks passed\033[0m\n" "$pass" "$total"
  exit 0
else
  printf "\033[1;31m✗ %d/%d env var checks failed\033[0m\n" "$fail" "$total"
  printf "\nFailures:\n"
  for line in "${fail_lines[@]}"; do printf "  • %s\n" "$line"; done
  exit 1
fi
