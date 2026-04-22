#!/usr/bin/env bash
# Verify every `cometchat <subcmd>` invocation in skills uses real flags.
# Extracts commands from SKILL.md, runs --help on each subcommand, checks
# every --flag mentioned in docs is in the CLI's help output.

set -uo pipefail
cd "$(dirname "$0")/../.."

pass=0; fail=0
fail_lines=()
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass+1)); }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail+1)); fail_lines+=("$1"); }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }

# Extract unique (subcmd, flag) pairs from all SKILL.md files.
node -e "
  const fs = require('fs');
  const path = require('path');
  const pairs = new Map();  // key=subcmd+flag, val={subcmd,flag,files}
  for (const dir of fs.readdirSync('skills')) {
    const f = path.join('skills', dir, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    // Match: npx @cometchat/skills-cli[@latest] <subcmd> [subsubcmd] --flag ... --flag ...
    // Use a loose matcher that grabs command through a terminator (newline, backtick, pipe).
    const cmdRe = /npx\s+@cometchat\/skills-cli(?:@[\w.-]+)?\s+([a-z][a-z-]+(?:\s+[a-z][a-z-]+)?)([^\n\`|]*)/g;
    for (const m of txt.matchAll(cmdRe)) {
      const subcmd = m[1].trim();
      const tail = m[2];
      for (const fm of tail.matchAll(/(--[a-z][a-z-]+)/g)) {
        const flag = fm[1];
        const key = subcmd + ' ' + flag;
        if (!pairs.has(key)) pairs.set(key, { subcmd, flag, files: new Set() });
        pairs.get(key).files.add(dir);
      }
    }
  }
  const out = [...pairs.values()].map(p => ({
    subcmd: p.subcmd, flag: p.flag, files: [...p.files].sort(),
  }));
  fs.writeFileSync('/tmp/cli-flag-pairs.json', JSON.stringify(out, null, 2));
  console.log(out.length + ' unique (subcmd, flag) pairs');
"

# Group by subcmd, run --help once per subcmd, then scan each flag.
pairs_file=/tmp/cli-flag-pairs.json
subcmds=$(node -e "
  const p = JSON.parse(require('fs').readFileSync('$pairs_file', 'utf8'));
  console.log([...new Set(p.map(x => x.subcmd))].sort().join('\n'));
")

declare -A help_cache
declare -A help_unavailable

while IFS= read -r subcmd; do
  [[ -z "$subcmd" ]] && continue
  # Cache help output
  helpfile=/tmp/cli-help-$(echo "$subcmd" | tr ' /' '__').txt
  # Get help; some subcmds are two-word (e.g. "auth login")
  npx @cometchat/skills-cli $subcmd --help > "$helpfile" 2>&1 || true
  help_cache["$subcmd"]="$helpfile"
  # Some subcommands don't honor --help (e.g. `info` just runs itself
  # and outputs "not integrated in this project"). Detect that so we can
  # soft-skip flag checks instead of reporting false-positive failures.
  if ! grep -qiE 'usage:|flags:|options:|--help' "$helpfile"; then
    help_unavailable["$subcmd"]=1
  fi
done <<< "$subcmds"

# Now check every pair.
while IFS= read -r line; do
  subcmd=$(echo "$line" | cut -f1)
  flag=$(echo "$line" | cut -f2)
  files=$(echo "$line" | cut -f3)
  helpfile="${help_cache[$subcmd]:-}"
  if [[ -z "$helpfile" ]] || [[ ! -s "$helpfile" ]]; then
    bad "$subcmd $flag: could not fetch --help (files: $files)"
    continue
  fi
  # If --help fell through to command execution, we can't check flags.
  if [[ -n "${help_unavailable[$subcmd]:-}" ]]; then
    printf "  \033[90m~\033[0m %s %s: --help unavailable (cmd executes instead)\n" "$subcmd" "$flag"
    continue
  fi
  if grep -q -- "$flag" "$helpfile"; then
    ok "$subcmd $flag"
  else
    # Some flags are framework/universal meta like --json that appear in a global
    # flags section. Check with word-boundary too.
    if grep -qE "(^|\s)$flag(\s|$|,|=)" "$helpfile"; then
      ok "$subcmd $flag"
    else
      bad "$subcmd $flag: NOT in help (files: $files)"
    fi
  fi
done < <(node -e "
  const p = JSON.parse(require('fs').readFileSync('$pairs_file', 'utf8'));
  for (const x of p) console.log(x.subcmd + '\t' + x.flag + '\t' + x.files.join(','));
")

echo
total=$((pass + fail))
if [[ $fail -eq 0 ]]; then
  printf "\033[1;32m✓ %d/%d CLI flag checks passed\033[0m\n" "$pass" "$total"
  exit 0
else
  printf "\033[1;31m✗ %d/%d CLI flag checks failed\033[0m\n" "$fail" "$total"
  printf "\nFailures:\n"
  for line in "${fail_lines[@]}"; do printf "  • %s\n" "$line"; done
  exit 1
fi
