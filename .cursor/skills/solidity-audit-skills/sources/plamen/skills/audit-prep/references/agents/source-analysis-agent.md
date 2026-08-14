# Source Analysis Agent — Phases 3, 4 & 6

You have: project_dir, in-scope file list, and Grep + Read tools.

**CRITICAL: Do NOT read all source files at once. Use targeted Grep queries for each check.**

## Phase 3: NatSpec Documentation (10%)

### Step 1: Count documentable elements
Run these Greps on in-scope files (use the file list from your bundle):

a) Public/external functions:
   Pattern: `function\s+\w+[^;]*(public|external)`
   Count total matches.

b) Contracts/interfaces/libraries:
   Pattern: `(abstract\s+)?(contract|interface|library)\s+\w+`

c) Events:
   Pattern: `event\s+\w+`

d) Public state variables:
   Pattern: `\w+\s+public\s+\w+;`

### Step 2: Count NatSpec coverage
a) `@inheritdoc` count — these are fully documented:
   Pattern: `@inheritdoc`

b) `@notice` before functions:
   Pattern: `@notice`
   Count total. Compare against documentable elements from Step 1.

c) Contract-level `@title`:
   Pattern: `@title`

### Step 3: Spot-check gaps
Grep for functions WITHOUT preceding NatSpec:
- Pattern: `function\s+\w+` with -B5 context
- Scan results for functions not preceded by `///` or `/**` lines
- Only report the first 10 undocumented functions (cap findings)

**Skip standard overrides:** Do NOT flag functions that are simple overrides of well-known standards (ERC20, ERC721, ERC1155, ERC4626, etc.) like `ownerOf`, `balanceOf`, `transferFrom`, `approve`, `getApproved`, `isApprovedForAll`, `safeTransferFrom`, `tokenURI`, `supportsInterface`, `totalSupply`, `decimals`, `name`, `symbol`. These are self-explanatory from the standard — `@inheritdoc` or `@notice` is nice but not required. Only flag custom project-specific functions that lack documentation.

### Step 4: Stale @param detection
Grep for `@param` with -A3 context to get the function signature below.
Check that each @param name matches an actual parameter in the function.
Flag any @param that references a parameter not in the signature (copy-paste error).
Deduction: -5 each (cap -15)

### Step 5: Missing @return for named returns
Grep for functions with named return values: `returns\s*\(.*\w+\s+\w+`
For each, check if a matching `@return` tag exists above.
Deduction: -3 each (cap -15)

### Scoring
Score = round((documented / total_required) * 100)
Each undocumented public function: -3 (cap -60)
Each undocumented contract: -5 (cap -20)
Stale @param: -5 each (cap -15)
Missing @return for named returns: -3 each (cap -15)

### Output per finding:
```
FAIL | missing_natspec | -3 | src/Vault.sol:27
desc: deposit() missing @notice and @param tags
fix: Add /// @notice and /// @param above the function

FAIL | stale_param | -5 | src/Vault.sol:30
desc: @param amount documented but parameter is named _amount
fix: Change @param amount to @param _amount

FAIL | missing_return | -3 | src/Oracle.sol:15
desc: getPrice() has named return 'price' but no @return tag
fix: Add /// @return price The current price
```

## Phase 4: Code Hygiene (10%)

Run each Grep on in-scope source files:

### Check 1: TODO/FIXME/HACK/XXX
Pattern: `TODO|FIXME|HACK|XXX`
Deduction: -3 each (cap -30)
These indicate unfinished work — must be resolved before audit.

### Check 2: Console imports
Pattern: `console\.(sol|log|2)|import.*console`
Deduction: -15 if any found

### Check 3: Commented-out code
Pattern: `^\s*//\s*(function |if \(|for \(|while |return |require\(|emit )`
Count blocks of 3+ consecutive commented lines nearby.
Deduction: -2 per block (cap -20)

### Check 4: Floating pragma
Pattern: `pragma solidity \^`
Only in project-owned files (not lib/).
Deduction: -10 if any found

### Check 5: Inconsistent pragmas
Pattern: `pragma solidity`
Collect unique versions from project-owned files.
Deduction: -10 if more than one version

### Check 6: Test imports in source
Pattern: `forge-std|import.*Test` in src/ or contracts/ only.
Deduction: -10 if found

### Check 7: require() vs custom errors consistency
Grep for both patterns:
- `require\(` — count matches
- `revert\s+\w+Error|error\s+\w+` — count custom error declarations/usage
If BOTH patterns exist with significant usage (>3 of each), flag inconsistency.
Deduction: -5

### Check 8: Unused imports
Grep: `import\s+\{([^}]+)\}\s+from` to extract named imports.
For each imported symbol, Grep for its usage in the same file (excluding the import line).
If a symbol is imported but never used in the file, flag it.
Deduction: -2 each (cap -15)
Skip if >100 import statements across the project (too costly).

### Check 9: SPDX license identifiers
Pattern: `SPDX-License-Identifier`
Grep all in-scope files. Any file missing an SPDX header gets flagged.
Deduction: -2 each (cap -10)

### Check 10: Dead internal functions
Pattern: `function\s+_\w+.*internal`
For each match, Grep the function name across all project files.
If only 1 match (the definition), it's dead.
Deduction: -5 each (cap -15)
Skip if >40 internal functions (too many to check efficiently).

## Phase 6: Best Practices (15%)

Safety, access control, and upgradeable patterns ONLY. No gas.

### S1: Unsafe ERC20
Grep: `\.transfer\(|\.transferFrom\(|\.approve\(`
For each match, check the same file for `using SafeERC20 for` or `safeTransfer`.
Exclude: ETH transfers (`address.transfer`), Uniswap Currency type.
Deduction: -10 if unsafe ERC20 calls found without SafeERC20.

### S2: CEI violations
Grep: `\.call\{value:|\.call\(abi`
For each match, Read 30 lines of the containing function.
Check if storage writes (`=`, `push`, `pop`, `delete`, `+=`, `-=`) occur AFTER the external call within the same function.
Deduction: -15 per violation (cap -30).

### S3: Missing reentrancy guard
Grep functions with `external` modifier that also contain `.call{value:`.
Check if function has `nonReentrant` or `nonreentrant` modifier.
Deduction: -10 per missing guard (cap -20).

### S4: Missing events on state changes
Grep: `function.*(external|public)` with -A20 context.
In results, check for functions with storage writes but no `emit`.
Only flag functions modifying protocol parameters (not trivial getters/views).
Deduction: -3 each (cap -30).

### S5: Zero-address checks
Grep: `constructor|function\s+(set|update|change)\w+.*address`
Check for `!= address(0)` or `== address(0)` validation.
Only flag addresses controlling funds, ownership, or critical config.
Deduction: -3 each (cap -15).

### S6: ETH via transfer/send
Grep: `\.transfer\(|\.send\(` where the target is `address` (not ERC20).
Confirm by checking the variable type or context — `payable(addr).transfer(amt)`.
Deduction: -5 each.

### S7: Unchecked .call return
Grep: `\.call\{|\.call\(`
Check each for `(bool success` or return value handling.
Deduction: -10 per unchecked call.

### S8: Single-step ownership
Grep: `Ownable[^2]|import.*Ownable\.sol`
If found without Ownable2Step, flag it.
Deduction: -5.

### S9: No emergency pause (DeFi with user funds)
Grep: `deposit|stake|lock|withdraw` in function names.
If found, check for Pausable/pause mechanism.
Deduction: -10 if holding user funds without pause.

### S10: Oracle staleness
Grep: `latestRoundData|latestAnswer`
Check for `updatedAt` or `answeredInRound` validation nearby.
Deduction: -15 if oracle used without staleness check.

### Access Control

#### A1: Unguarded admin functions
Grep: `function.*(external|public)` that contain sensitive operations.
Sensitive = `owner`, `admin`, `withdraw`, `set.*Fee`, `set.*Rate`, `pause`, `upgrade`.
Check for: `onlyOwner`, `onlyRole`, `onlyAdmin`, `require(msg.sender`.
Deduction: -10 each (cap -30).

### Upgradeable (only if proxy detected)

First check: Grep for `Initializable|UUPSUpgradeable|TransparentProxy`.
If none found, skip entirely and output:
```
PASS | not_upgradeable
note: No proxy/upgradeable pattern detected — skipping upgrade checks
```

If found:
| Check | Grep for | Deduction |
|-------|----------|-----------|
| Missing initializer | `function initialize` without `initializer` modifier | -20 |
| Missing _disableInitializers | `constructor` without `_disableInitializers` | -20 |
| Missing onlyInitializing | `function _\w+Init` without `onlyInitializing` | -10 |
| No storage gaps | Missing `__gap` AND no ERC-7201 `@custom:storage-location` | -10 |
| Unprotected upgradeTo | `upgradeTo` without access control | -20 |

## Constraints
- Use Grep and Read ONLY — no Bash commands
- Do NOT read all source files at once — use targeted queries
- Do NOT perform vulnerability analysis or threat modeling
- Do NOT flag gas optimizations
- Output ONLY the structured PHASE/FAIL/PASS format
