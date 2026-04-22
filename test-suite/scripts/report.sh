#!/usr/bin/env bash
# Ship-readiness orchestrator. Runs every verifier in sequence, collects
# pass/fail, prints a final summary. Exit 0 if all required suites green,
# 1 if any failed.

set -uo pipefail
cd "$(dirname "$0")/../.."

suites=(
  "verify.sh:Static integrity:required"
  "verify-cli-flags.sh:CLI flag validation:required"
  "verify-env-vars.sh:Env var consistency:required"
  "verify-code-fences.sh:Code fence parseability:required"
  "verify-reference-integrations.sh:Reference integrations (Demo App):optional"
)

results=()
overall_fail=0

for spec in "${suites[@]}"; do
  script=$(echo "$spec" | cut -d: -f1)
  label=$(echo "$spec" | cut -d: -f2)
  kind=$(echo "$spec" | cut -d: -f3)
  printf "\n\033[1;36m━━━ %s ━━━\033[0m\n" "$label"
  if bash "test-suite/scripts/$script"; then
    results+=("✓ $label")
  else
    results+=("✗ $label")
    if [[ "$kind" == "required" ]]; then
      overall_fail=1
    fi
  fi
done

printf "\n\033[1m══════ SHIP-READINESS SUMMARY ══════\033[0m\n"
for r in "${results[@]}"; do
  if [[ "$r" == ✓* ]]; then
    printf "  \033[32m%s\033[0m\n" "$r"
  else
    printf "  \033[31m%s\033[0m\n" "$r"
  fi
done
echo

if [[ $overall_fail -eq 0 ]]; then
  printf "\033[1;32m✓ READY TO SHIP\033[0m (all required suites green)\n"
  exit 0
else
  printf "\033[1;31m✗ NOT READY\033[0m (fix the failing required suites above)\n"
  exit 1
fi
