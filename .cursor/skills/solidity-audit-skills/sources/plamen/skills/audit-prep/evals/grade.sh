#!/bin/bash
# Grade audit-prep eval output against assertions
# Usage: ./grade.sh <output_file> <eval_id>
#   output_file: concatenated agent outputs (agent-a + agent-b + agent-c)
#   eval_id: 1 (hardhat-small-project) or 2 (foundry-large-project)

OUTPUT="$1"
EVAL_ID="${2:-1}"
PASSED=0
FAILED=0
TOTAL=0

check() {
  local id="$1" desc="$2" result="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "pass" ]; then
    PASSED=$((PASSED + 1))
    printf '  \033[32mPASS\033[0m  %s — %s\n' "$id" "$desc"
  else
    FAILED=$((FAILED + 1))
    printf '  \033[31mFAIL\033[0m  %s — %s\n' "$id" "$desc"
  fi
}

echo ""
echo "=== Grading eval $EVAL_ID ==="
echo ""

# --- Common assertions (both evals) ---

# All 8 phases present
count=$(grep -c 'PHASE [1-8] |' "$OUTPUT" 2>/dev/null)
[ "$count" -ge 8 ] && check "format-all-phases" "All 8 phases reported" "pass" \
  || check "format-all-phases" "All 8 phases reported (got $count)" "fail"

# END markers
count=$(grep -c 'END PHASE' "$OUTPUT" 2>/dev/null)
[ "$count" -ge 8 ] && check "format-end-markers" "All END PHASE markers present" "pass" \
  || check "format-end-markers" "All END PHASE markers (got $count)" "fail"

# Every FAIL has desc: and fix:
fail_count=$(grep -c '^FAIL' "$OUTPUT" 2>/dev/null)
desc_count=$(grep -c '^desc:' "$OUTPUT" 2>/dev/null)
fix_count=$(grep -c '^fix:' "$OUTPUT" 2>/dev/null)
if [ "$fail_count" -gt 0 ] && [ "$desc_count" -ge "$fail_count" ] && [ "$fix_count" -ge "$fail_count" ]; then
  check "format-fail-has-fix" "Every FAIL has desc: and fix:" "pass"
else
  check "format-fail-has-fix" "FAIL/desc/fix mismatch ($fail_count/$desc_count/$fix_count)" "fail"
fi

# No vulnerability analysis
if grep -qi '\[H-0\|[M-0\|vulnerability\|exploit' "$OUTPUT" 2>/dev/null; then
  check "no-vuln-analysis" "No vulnerability analysis" "fail"
else
  check "no-vuln-analysis" "No vulnerability analysis" "pass"
fi

# Quick Wins present
if grep -q 'Quick Wins' "$OUTPUT" 2>/dev/null; then
  check "quick-wins" "Quick Wins section present" "pass"
else
  check "quick-wins" "Quick Wins section present" "fail"
fi

# Floating pragma flagged
if grep -q 'floating_pragma' "$OUTPUT" 2>/dev/null; then
  check "hygiene-floating-pragma" "Floating pragma flagged" "pass"
else
  check "hygiene-floating-pragma" "Floating pragma flagged" "fail"
fi

# Missing deploy scripts flagged
if grep -q 'deploy_scripts\|no_deploy_scripts' "$OUTPUT" 2>/dev/null; then
  check "deploy-missing" "Missing deploy scripts flagged" "pass"
else
  check "deploy-missing" "Missing deploy scripts flagged" "fail"
fi

# Missing trust model flagged
if grep -q 'no_trust_model' "$OUTPUT" 2>/dev/null; then
  check "docs-no-trust" "Missing trust model flagged" "pass"
else
  check "docs-no-trust" "Missing trust model flagged" "fail"
fi

# --- Eval-specific assertions ---

if [ "$EVAL_ID" = "1" ]; then
  # Hardhat detected
  if grep -q 'Hardhat' "$OUTPUT" 2>/dev/null; then
    check "detect-hardhat" "Framework detected as Hardhat" "pass"
  else
    check "detect-hardhat" "Framework detected as Hardhat" "fail"
  fi

  # 4 files
  if grep -q '4 files' "$OUTPUT" 2>/dev/null; then
    check "file-count" "In-scope file count is 4" "pass"
  else
    check "file-count" "In-scope file count is 4" "fail"
  fi

  # Coverage >= 80
  cov_score=$(grep 'PHASE 1.*SCORE:' "$OUTPUT" | grep -o 'SCORE: [0-9]*' | grep -o '[0-9]*' | head -1)
  [ -n "$cov_score" ] && [ "$cov_score" -ge 80 ] && check "coverage-high" "Phase 1 score >= 80 (got $cov_score)" "pass" \
    || check "coverage-high" "Phase 1 score >= 80 (got ${cov_score:-?})" "fail"

  # Best practices >= 90
  bp_score=$(grep 'PHASE 6.*SCORE:' "$OUTPUT" | grep -o 'SCORE: [0-9]*' | grep -o '[0-9]*' | head -1)
  [ -n "$bp_score" ] && [ "$bp_score" -ge 90 ] && check "practices-perfect" "Phase 6 score >= 90 (got $bp_score)" "pass" \
    || check "practices-perfect" "Phase 6 score >= 90 (got ${bp_score:-?})" "fail"

  # No standard override NatSpec flags
  if grep -A2 'PHASE 3' "$OUTPUT" | grep -qi 'ownerOf\|transferFrom\|getApproved\|isApprovedForAll' 2>/dev/null; then
    # Check if they're in FAIL lines specifically
    if grep 'FAIL.*missing_natspec.*ownerOf\|FAIL.*missing_natspec.*transferFrom\|FAIL.*missing_natspec.*getApproved\|FAIL.*missing_natspec.*isApprovedForAll' "$OUTPUT" 2>/dev/null; then
      check "no-standard-override-flags" "No flags for standard ERC overrides" "fail"
    else
      check "no-standard-override-flags" "No flags for standard ERC overrides" "pass"
    fi
  else
    check "no-standard-override-flags" "No flags for standard ERC overrides" "pass"
  fi

  # No fuzz penalty
  if grep 'FAIL.*no_fuzz.*-1[0-9]' "$OUTPUT" 2>/dev/null; then
    check "no-fuzz-penalty" "No deduction for missing fuzz" "fail"
  else
    check "no-fuzz-penalty" "No deduction for missing fuzz" "pass"
  fi

elif [ "$EVAL_ID" = "2" ]; then
  # Foundry detected
  if grep -q 'Foundry' "$OUTPUT" 2>/dev/null; then
    check "detect-foundry" "Framework detected as Foundry" "pass"
  else
    check "detect-foundry" "Framework detected as Foundry" "fail"
  fi

  # >= 35 files
  file_count=$(grep -o '[0-9]* files' "$OUTPUT" | grep -o '[0-9]*' | head -1)
  [ -n "$file_count" ] && [ "$file_count" -ge 35 ] && check "file-count-large" "File count >= 35 (got $file_count)" "pass" \
    || check "file-count-large" "File count >= 35 (got ${file_count:-?})" "fail"

  # Uninitialized submodules
  if grep -q 'uninit_submodule' "$OUTPUT" 2>/dev/null; then
    check "deps-uninit-submodules" "Uninitialized submodules flagged" "pass"
  else
    check "deps-uninit-submodules" "Uninitialized submodules flagged" "fail"
  fi

  # Missing emergency pause
  if grep -q 'no_emergency_pause' "$OUTPUT" 2>/dev/null; then
    check "practices-no-pause" "Missing emergency pause flagged" "pass"
  else
    check "practices-no-pause" "Missing emergency pause flagged" "fail"
  fi
fi

# --- Summary ---
echo ""
printf '=== Results: %d/%d passed ' "$PASSED" "$TOTAL"
if [ "$FAILED" -eq 0 ]; then
  printf '\033[32m(100%%)\033[0m'
else
  pct=$((PASSED * 100 / TOTAL))
  printf '\033[31m(%d%%)\033[0m' "$pct"
fi
echo " ==="
echo ""
