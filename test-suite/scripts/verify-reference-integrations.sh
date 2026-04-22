#!/usr/bin/env bash
# Validate the Demo App's reference integrations against what skills promise.
# Reference integrations live at /Users/swapnil/Downloads/Demo App/frontend-done-{1,2}.
# Skipped cleanly if the Demo App isn't present.

set -uo pipefail
cd "$(dirname "$0")/../.."

DEMO="/Users/swapnil/Downloads/Demo App"
pass=0; fail=0; skip=0
fail_lines=()
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; pass=$((pass+1)); }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail+1)); fail_lines+=("$1"); }
skp()  { printf "  \033[90m~\033[0m %s\n" "$1"; skip=$((skip+1)); }

if [[ ! -d "$DEMO" ]]; then
  skp "Demo App not found at $DEMO — skipping reference integration checks"
  echo
  printf "\033[1;90m~ %d checks skipped, %d passed, %d failed\033[0m\n" "$skip" "$pass" "$fail"
  exit 0
fi

# A reference integration must have:
#   - deps: @cometchat/chat-sdk-javascript ^4, @cometchat/chat-uikit-react ^6
#   - provider file: src/providers/CometChatProvider.tsx
#   - env file: .env with VITE_COMETCHAT_APP_ID + REGION + AUTH_KEY
#   - tsc --noEmit passes (only if node_modules installed)
#   - experience-specific component (done-1: ChatWidget.tsx, done-2: ChatDrawer.tsx)

check_project() {
  local name="$1"
  local expected_component="$2"
  local proj="$DEMO/$name"

  if [[ ! -d "$proj" ]]; then
    skp "$name: project directory missing"
    return
  fi

  # deps
  if node -e "
    const p = require('$proj/package.json');
    const d = p.dependencies || {};
    const missing = [];
    if (!d['@cometchat/chat-sdk-javascript']) missing.push('chat-sdk-javascript');
    if (!d['@cometchat/chat-uikit-react']) missing.push('chat-uikit-react');
    if (missing.length) { console.error(missing.join(',')); process.exit(1); }
  " 2>/tmp/refchk; then
    ok "$name: deps present"
  else
    bad "$name: missing deps — $(cat /tmp/refchk)"
  fi

  # provider
  if [[ -f "$proj/src/providers/CometChatProvider.tsx" ]]; then
    ok "$name: CometChatProvider.tsx"
  else
    bad "$name: missing src/providers/CometChatProvider.tsx"
  fi

  # provider references correct env var prefix
  if [[ -f "$proj/src/providers/CometChatProvider.tsx" ]]; then
    if grep -q 'import\.meta\.env\.VITE_COMETCHAT_APP_ID' "$proj/src/providers/CometChatProvider.tsx"; then
      ok "$name: provider uses VITE_COMETCHAT_APP_ID"
    else
      bad "$name: provider does not reference VITE_COMETCHAT_APP_ID"
    fi
  fi

  # env file shape
  if [[ -f "$proj/.env" ]]; then
    local have_all=1
    for v in VITE_COMETCHAT_APP_ID VITE_COMETCHAT_REGION VITE_COMETCHAT_AUTH_KEY; do
      grep -q "^$v=" "$proj/.env" || { have_all=0; bad "$name: .env missing $v"; }
    done
    [[ $have_all -eq 1 ]] && ok "$name: .env has all 3 expected vars"
  else
    bad "$name: .env missing"
  fi

  # CSS import
  if grep -rq "@cometchat/chat-uikit-react/css-variables.css" "$proj/src/" 2>/dev/null; then
    ok "$name: css-variables.css imported"
  else
    bad "$name: css-variables.css not imported anywhere in src/"
  fi

  # key CometChatUIKit API calls in provider
  if [[ -f "$proj/src/providers/CometChatProvider.tsx" ]]; then
    local missing_apis=()
    for api in 'CometChatUIKit.init' 'CometChatUIKit.login'; do
      grep -q "$api" "$proj/src/providers/CometChatProvider.tsx" || missing_apis+=("$api")
    done
    if [[ ${#missing_apis[@]} -eq 0 ]]; then
      ok "$name: provider calls init + login"
    else
      bad "$name: provider missing: ${missing_apis[*]}"
    fi
  fi

  # experience-specific component
  if [[ -f "$proj/src/components/$expected_component" ]]; then
    ok "$name: has $expected_component (experience-specific)"
  else
    bad "$name: missing expected component $expected_component"
  fi

  # tsc check (only if node_modules exist)
  if [[ -d "$proj/node_modules" ]]; then
    if ( cd "$proj" && npx -y tsc --noEmit -p . ) > /tmp/refchk-tsc 2>&1; then
      ok "$name: tsc --noEmit passes"
    else
      local errcount=$(grep -c 'error TS' /tmp/refchk-tsc || true)
      bad "$name: tsc --noEmit has $errcount errors (see /tmp/refchk-tsc)"
    fi
  else
    skp "$name: skipping tsc (no node_modules)"
  fi
}

printf "\n\033[1m── frontend-done-1 (experience 1: widget) ──\033[0m\n"
check_project "frontend-done-1" "ChatWidget.tsx"

printf "\n\033[1m── frontend-done-2 (experience 2: drawer) ──\033[0m\n"
check_project "frontend-done-2" "ChatDrawer.tsx"

echo
total=$((pass + fail))
if [[ $fail -eq 0 ]]; then
  printf "\033[1;32m✓ %d/%d reference checks passed (%d skipped)\033[0m\n" "$pass" "$total" "$skip"
  exit 0
else
  printf "\033[1;31m✗ %d/%d reference checks failed (%d skipped)\033[0m\n" "$fail" "$total" "$skip"
  printf "\nFailures:\n"
  for line in "${fail_lines[@]}"; do printf "  • %s\n" "$line"; done
  exit 1
fi
