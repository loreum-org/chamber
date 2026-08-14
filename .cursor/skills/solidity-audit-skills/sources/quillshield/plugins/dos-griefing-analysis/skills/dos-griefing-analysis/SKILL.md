---
name: dos-griefing-analysis
description: Detects Denial of Service and griefing vulnerabilities in smart contracts. Covers unbounded loop DoS, block gas limit exhaustion, external call failure DoS, insufficient gas griefing (63/64 rule), storage bloat attacks, timestamp griefing, self-destruct force-feeding, and push vs pull payment pattern analysis. Use when auditing contracts with batch operations, loops over user data, reward distribution, dividend systems, or any logic that depends on address(this).balance or iterates over growing collections.
---

# DoS & Griefing Analysis

Detect vulnerabilities that allow attackers to **make contracts unusable** (Denial of Service) or **harm other users at low cost** (griefing). These attacks don't steal funds directly but can permanently brick contracts or block critical operations.

## When to Use

- Auditing contracts with loops over dynamic arrays or mappings
- Reviewing batch operations (airdrops, reward distribution, liquidation)
- Analyzing contracts that rely on `address(this).balance` for logic
- Verifying that individual user failures don't block system-wide operations
- Checking for gas-based attack vectors (insufficient gas, storage bloat)

## When NOT to Use

- Direct fund theft analysis (use behavioral-state-analysis)
- Access control consistency (use semantic-guard-analysis)
- Reentrancy detection (use reentrancy-pattern-analysis)

## Seven DoS & Griefing Vulnerability Classes

### Class 1: Unbounded Loop DoS

Loops that iterate over collections that grow with contract usage. As the collection grows, gas cost increases until the function exceeds the block gas limit and becomes permanently uncallable.

```solidity
// VULNERABLE: Loop over all users — grows forever
address[] public allUsers;

function distributeRewards() external {
    for (uint i = 0; i < allUsers.length; i++) {
        // If allUsers has 10,000+ entries, this exceeds block gas limit
        token.transfer(allUsers[i], calculateReward(allUsers[i]));
    }
}

// SAFE: Paginated processing
function distributeRewards(uint256 startIndex, uint256 batchSize) external {
    uint256 end = min(startIndex + batchSize, allUsers.length);
    for (uint i = startIndex; i < end; i++) {
        token.transfer(allUsers[i], calculateReward(allUsers[i]));
    }
}

// SAFER: Pull pattern
mapping(address => uint256) public pendingRewards;

function claimReward() external {
    uint256 reward = pendingRewards[msg.sender];
    pendingRewards[msg.sender] = 0;
    token.transfer(msg.sender, reward);
}
```

**Detection:**

```
For each loop in the contract:
  1. What determines the loop bound?
     - Fixed constant → SAFE
     - Constructor parameter → SAFE (if reasonable)
     - Dynamic array length → POTENTIALLY VULNERABLE
     - Mapping iteration → VULNERABLE (can't iterate mappings, but workaround arrays are vulnerable)
  2. Can the loop bound grow with contract usage?
  3. What is the gas cost per iteration?
  4. At what size does total gas exceed 30M? (block gas limit)

If loop_bound is unbounded AND gas_per_iteration > 30M / estimated_max_users:
  → UNBOUNDED LOOP DOS
```

### Class 2: External Call Failure DoS

A single failed external call in a batch operation blocks all other operations.

```solidity
// VULNERABLE: One blacklisted user blocks ALL distributions
function distributeToAll(address[] calldata users, uint256[] calldata amounts) external {
    for (uint i = 0; i < users.length; i++) {
        // If users[5] is USDC-blacklisted, this reverts for ALL users
        require(token.transfer(users[i], amounts[i]), "Transfer failed");
    }
}

// SAFE: Handle failures individually
function distributeToAll(address[] calldata users, uint256[] calldata amounts) external {
    for (uint i = 0; i < users.length; i++) {
        try IERC20(token).transfer(users[i], amounts[i]) returns (bool success) {
            if (!success) emit TransferFailed(users[i], amounts[i]);
        } catch {
            emit TransferFailed(users[i], amounts[i]);
        }
    }
}
```

**Detection:**

```
For each loop containing external calls:
  1. Does a failed call revert the entire transaction? (require/revert)
  2. Is there try/catch or success-check-and-skip?
  3. Can any single address/user cause the call to fail?
     - Blacklisted address
     - Contract that reverts in receive()
     - Address that runs out of gas
  If yes → EXTERNAL CALL FAILURE DOS
```

### Class 3: Insufficient Gas Griefing (63/64 Rule)

EIP-150's 63/64 rule: when making an external call, only 63/64 of remaining gas is forwarded. An attacker can supply just enough gas for the outer function to succeed while the inner call fails.

```solidity
// VULNERABLE: Relayer pattern without gas check
function executeMetaTx(address target, bytes calldata data) external {
    // Attacker (relayer) provides just enough gas for this function
    // but NOT enough for target.call(data) to succeed
    (bool success, ) = target.call(data);
    // success = false (ran out of gas), but function doesn't revert!

    // Mark meta-tx as executed even though it failed
    executedTxs[txHash] = true; // Meta-tx permanently "used" but never executed
}

// SAFE: Verify sufficient gas and check success
function executeMetaTx(address target, bytes calldata data, uint256 gasLimit) external {
    require(gasleft() >= gasLimit * 64 / 63 + 5000, "Insufficient gas");
    (bool success, ) = target.call{gas: gasLimit}(data);
    require(success, "Execution failed");
}
```

**Detection:**

```
For each function that makes external calls:
  1. Does the function check the success of the call?
  2. If success is not required, does failure cause permanent state changes?
  3. Is the function called by untrusted relayers?
  4. Is there a minimum gas check before the external call?

  If no success check AND permanent state change on failure:
    → INSUFFICIENT GAS GRIEFING
```

### Class 4: Storage Bloat Attack

An attacker fills storage arrays/mappings to increase gas costs for other users.

```solidity
// VULNERABLE: Anyone can add entries, increasing gas for iteration
mapping(address => address[]) public userTokens;

function addToken(address token) external {
    userTokens[msg.sender].push(token);
    // No limit on how many tokens a user can add
    // Functions that iterate userTokens[user] become expensive
}

function getUserValue(address user) external view returns (uint256) {
    uint256 total = 0;
    for (uint i = 0; i < userTokens[user].length; i++) {
        // Gas cost grows linearly with array size
        total += getTokenBalance(user, userTokens[user][i]);
    }
    return total;
}
```

**Detection:**

```
For each dynamic array or mapping that grows via public/external functions:
  1. Is there a size limit?
  2. Is there a cost to adding entries (economic deterrent)?
  3. Is the array iterated in any function?
  4. Can a non-owner add entries for other users?

  If unlimited growth AND iteration exists → STORAGE BLOAT DOS
```

### Class 5: Timestamp Griefing

Attackers make minimal actions (e.g., 1 wei deposit) to reset timing mechanisms.

```solidity
// VULNERABLE: Any deposit resets withdrawal timer
function deposit() external payable {
    balances[msg.sender] += msg.value;
    lastDepositTime[msg.sender] = block.timestamp; // Reset timer
}

function withdraw() external {
    require(block.timestamp >= lastDepositTime[msg.sender] + LOCK_PERIOD, "Locked");
    // Attacker deposits 1 wei to reset victim's lock period
    // (if deposit function can set lastDepositTime for another user)
    // Or griefs themselves by resetting their own lock with 1 wei deposits
}
```

**Detection:**

```
For each timestamp-dependent mechanism (locks, cooldowns, vesting):
  1. Can the timestamp be reset by a minimal-cost action?
  2. Can the reset action be performed by someone other than the affected user?
  3. Does the reset block a valuable operation (withdrawal, claim)?

  If minimal cost reset AND blocks valuable operation → TIMESTAMP GRIEFING
```

### Class 6: Self-Destruct Force-Feeding

An attacker can force-send ETH to any contract via `selfdestruct`, bypassing receive/fallback functions. This breaks contracts that rely on `address(this).balance` for accounting.

```solidity
// VULNERABLE: Relies on address(this).balance for logic
function isFullyFunded() public view returns (bool) {
    return address(this).balance >= targetAmount;
    // Attacker can selfdestruct another contract to force-send ETH
    // Prematurely triggering "fully funded" state
}

// VULNERABLE: Uses balance for invariant
function withdraw() external {
    require(address(this).balance == totalDeposits, "Balance mismatch");
    // Force-fed ETH breaks this equality — function permanently DOSed
}

// SAFE: Track deposits internally, don't rely on balance
uint256 public totalDeposits;

function isFullyFunded() public view returns (bool) {
    return totalDeposits >= targetAmount; // Uses internal tracking
}
```

**Detection:**

```
For each use of address(this).balance:
  1. Is it used in a strict equality check (==)?
     → CRITICAL: force-fed ETH breaks equality permanently
  2. Is it used as an accounting variable?
     → HIGH: force-fed ETH inflates perceived balance
  3. Is it used for informational purposes only?
     → LOW: no security impact

  Flag all strict equality checks on address(this).balance as CRITICAL DoS
```

### Class 7: Block Stuffing

Attackers fill entire blocks with high-gas transactions to prevent time-sensitive operations from executing.

```solidity
// VULNERABLE: Time-sensitive operation without extended window
function finalizeLiquidation(uint256 id) external {
    require(block.timestamp >= liquidations[id].deadline, "Not ready");
    require(block.timestamp <= liquidations[id].deadline + 1 hours, "Expired");
    // Attacker stuffs blocks for 1 hour to prevent finalization
}

// SAFE: Reasonable window or no upper bound
function finalizeLiquidation(uint256 id) external {
    require(block.timestamp >= liquidations[id].deadline, "Not ready");
    // No upper bound — can be finalized anytime after deadline
}
```

## Workflow

```
Task Progress:
- [ ] Step 1: Find all loops and determine if bounds are dynamic/growing
- [ ] Step 2: Identify all batch operations with external calls
- [ ] Step 3: Check for insufficient gas griefing in relayer/meta-tx patterns
- [ ] Step 4: Find growing storage structures without size limits
- [ ] Step 5: Check for timestamp/cooldown reset griefing
- [ ] Step 6: Find all address(this).balance usage, especially equality checks
- [ ] Step 7: Identify time-sensitive operations vulnerable to block stuffing
- [ ] Step 8: Score findings and generate report
```

## Output Format

```markdown
## DoS & Griefing Analysis Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Category:** [Unbounded Loop | External Call DoS | Gas Griefing | Storage Bloat | Timestamp Grief | Force-Feed | Block Stuffing]
**Severity:** [CRITICAL | HIGH | MEDIUM]

**Issue:**
[Description of the DoS or griefing vulnerability]

**Growth Analysis:**
  Current users/entries: [N]
  Gas per iteration: [X gas]
  Block gas limit: 30,000,000
  Max iterations before DoS: [30M / X]
  Estimated time to DoS: [based on growth rate]

**Attack Scenario:**
1. [Step-by-step griefing or DoS attack]

**Cost to Attacker:** [gas cost, deposit required, etc.]
**Impact on Victims:** [permanent DoS, delayed operations, lost funds]

**Recommendation:**
[Pagination, pull pattern, size limits, internal accounting, etc.]
```

## Quick Detection Checklist

- [ ] Do any loops iterate over arrays that grow with contract usage?
- [ ] Do batch operations handle individual failures gracefully (try/catch)?
- [ ] Do relayer/meta-tx functions verify gas sufficiency and call success?
- [ ] Do growing storage structures have maximum size limits?
- [ ] Can timing mechanisms (locks, cooldowns) be reset at minimal cost?
- [ ] Does any logic use `address(this).balance` in a strict equality check?
- [ ] Are time-sensitive operations given reasonable execution windows?
- [ ] Do payment distributions use pull pattern instead of push?

For DoS pattern details, see [{baseDir}/references/dos-patterns.md]({baseDir}/references/dos-patterns.md).
For gas griefing vectors, see [{baseDir}/references/gas-griefing-vectors.md]({baseDir}/references/gas-griefing-vectors.md).

## Rationalizations to Reject

- "The array will never get that large" → Growth is often exponential; what's 100 today is 10,000 next month
- "Gas limits will increase" → Block gas limit increases are slow and unpredictable; don't depend on future changes
- "Nobody would pay to stuff blocks" → Block stuffing cost is often less than the value of the operation being blocked
- "The attacker gains nothing" → Griefing attacks are about harming others, not profiting; competitors and malicious actors exist
- "We can always migrate" → Migration with locked funds or broken state is extremely difficult
- "selfdestruct is being deprecated" → EIP-6780 limits selfdestruct but force-feeding is still possible during contract creation
