---
name: external-call-safety
description: Detects unsafe external call patterns and token integration vulnerabilities in smart contracts. Covers unchecked call/delegatecall/staticcall return values, fee-on-transfer tokens, rebasing tokens, tokens with missing return values (USDT), ERC-777 callback risks, unsafe approve race conditions, return data bombs, gas stipend limitations, and push vs pull payment patterns. Use when auditing contracts that interact with external contracts, integrate arbitrary ERC20 tokens, distribute payments, or make low-level calls.
---

# External Call Safety

Detect vulnerabilities arising from **unsafe interactions with external contracts** and **non-standard token behaviors** that break protocol assumptions. Covers OWASP SC06 (Unchecked External Calls) plus the entire "weird ERC20" problem space.

## When to Use

- Auditing any contract that calls external contracts (token transfers, cross-contract interactions)
- Reviewing protocols that support arbitrary/user-supplied ERC20 tokens
- Analyzing ETH payment distribution logic (airdrops, reward distribution, refunds)
- Verifying low-level call safety (`call`, `delegatecall`, `staticcall`)
- When a protocol claims to support "any ERC20 token"

## When NOT to Use

- Reentrancy-specific analysis (use reentrancy-pattern-analysis — though there is overlap)
- Oracle/price feed analysis (use oracle-flashloan-analysis)
- Pure access control review (use semantic-guard-analysis)

## Part 1: External Call Safety

### Vulnerability Class 1: Unchecked Return Values

Low-level calls (`call`, `delegatecall`, `staticcall`) return a boolean indicating success. If unchecked, failed calls are silently ignored.

```solidity
// VULNERABLE: Return value not checked
function withdraw(uint256 amount) external {
    balances[msg.sender] -= amount;
    payable(msg.sender).call{value: amount}(""); // Can fail silently!
    // User's balance decreased but ETH not sent
}

// SAFE: Check return value
function withdraw(uint256 amount) external {
    balances[msg.sender] -= amount;
    (bool success, ) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
}
```

**Detection Algorithm:**

```
For each low-level call expression:
  1. Is the return value captured? (bool success, bytes memory data) = ...
  2. Is the success boolean checked? require(success) or if(!success) revert
  3. If not captured or not checked → UNCHECKED RETURN VALUE

Severity:
  - ETH transfer unchecked → CRITICAL (funds lost)
  - Token operation unchecked → HIGH (state desync)
  - Non-financial call unchecked → MEDIUM
```

### Vulnerability Class 2: Gas Stipend Limitations

```solidity
// DANGEROUS: transfer() and send() forward only 2300 gas
payable(recipient).transfer(amount); // Reverts if recipient needs > 2300 gas
payable(recipient).send(amount);     // Returns false, often unchecked

// SAFE: Use call() with gas
(bool success, ) = payable(recipient).call{value: amount}("");
require(success, "Transfer failed");
```

**Why 2300 gas is dangerous:**
- Contracts with `receive()` or `fallback()` that do more than emit an event will fail
- EIP-1884 changed `SLOAD` gas cost, breaking some existing contracts
- Multi-sig wallets and smart contract wallets often need more gas

### Vulnerability Class 3: Return Data Bomb

A malicious contract can return extremely large data to consume the caller's gas.

```solidity
// Vulnerable to return data bomb
(bool success, bytes memory data) = untrustedContract.call(calldata);
// If untrustedContract returns 1MB of data, copying it costs massive gas

// SAFE: Limit return data or ignore it
(bool success, ) = untrustedContract.call(calldata); // Ignore return data
// Or use assembly to limit return data size
```

### Vulnerability Class 4: Delegatecall to Untrusted Contract

```solidity
// CRITICAL: delegatecall executes untrusted code in OUR storage context
function execute(address target, bytes calldata data) external {
    target.delegatecall(data); // Untrusted code can overwrite ANY storage
}

// delegatecall should ONLY be used with trusted, immutable targets
```

## Part 2: Token Integration Safety ("Weird ERC20" Tokens)

### Issue 1: Fee-on-Transfer Tokens

Some tokens deduct a fee during `transfer()` and `transferFrom()`. The recipient receives less than the specified amount.

```solidity
// VULNERABLE: Assumes received amount equals input amount
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    balances[msg.sender] += amount; // Credits MORE than actually received!
}

// SAFE: Check actual balance change
function deposit(uint256 amount) external {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 balanceAfter = token.balanceOf(address(this));
    uint256 actualReceived = balanceAfter - balanceBefore;
    balances[msg.sender] += actualReceived; // Credits actual amount
}
```

**Known fee-on-transfer tokens:** STA, PAXG, USDT (fee currently 0 but can be activated), RFI/SAFEMOON forks.

### Issue 2: Rebasing Tokens

Rebasing tokens change all balances proportionally without transfers. Protocol's accounting desynchronizes from actual balances.

```solidity
// VULNERABLE: Stores absolute balance amounts
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    userDeposit[msg.sender] = amount; // After rebase, actual balance differs!
}

// Mitigation options:
// 1. Store shares instead of amounts
// 2. Wrap rebasing token (wstETH pattern)
// 3. Explicitly state: "rebasing tokens not supported"
```

**Known rebasing tokens:** stETH, AMPL, OHM, YAM, BASED.

### Issue 3: Missing Return Values

Some tokens don't return a boolean from `transfer()`/`transferFrom()`/`approve()`, breaking the ERC20 standard.

```solidity
// VULNERABLE: Assumes return value exists
bool success = token.transfer(recipient, amount); // Reverts if token returns nothing

// SAFE: Use SafeERC20
using SafeERC20 for IERC20;
token.safeTransfer(recipient, amount); // Handles missing return values
```

**Known tokens with missing returns:** USDT, BNB, OMG, KNC (legacy versions).

### Issue 4: Tokens with Callbacks (ERC-777)

ERC-777 tokens trigger `tokensToSend()` on the sender and `tokensReceived()` on the recipient during transfers, enabling reentrancy.

```
ERC-777 callback hooks:
  transfer() → calls tokensReceived() on recipient
  transferFrom() → calls tokensToSend() on sender, tokensReceived() on recipient
  send() → calls tokensToSend() on sender, tokensReceived() on recipient

ANY of these can re-enter the calling contract!
```

**Cross-reference:** See reentrancy-pattern-analysis for detailed ERC-777 reentrancy detection.

### Issue 5: Unsafe Approve Pattern

```solidity
// VULNERABLE: Approve race condition
token.approve(spender, newAmount);
// Between the approval TX and the spending TX, the spender can:
// 1. Spend the OLD allowance
// 2. Then spend the NEW allowance
// Total spent: oldAmount + newAmount (double spending)

// SAFE: Reset to zero first, or use increaseAllowance
token.approve(spender, 0); // Reset
token.approve(spender, newAmount); // Set new

// Or use SafeERC20
token.safeIncreaseAllowance(spender, amount);

// ALSO DANGEROUS: Some tokens (USDT) revert on non-zero to non-zero approve
token.approve(spender, newAmount); // REVERTS if current allowance != 0
// MUST reset to 0 first for USDT
```

### Issue 6: Tokens with Blacklists

Some tokens can blacklist addresses, causing transfers to/from those addresses to revert.

```solidity
// VULNERABLE: Assumes transfer always succeeds for valid amounts
function distribute(address[] calldata users, uint256[] calldata amounts) external {
    for (uint i = 0; i < users.length; i++) {
        token.transfer(users[i], amounts[i]); // Reverts if ANY user is blacklisted
        // Entire batch fails!
    }
}

// SAFE: Handle per-user failures
function distribute(address[] calldata users, uint256[] calldata amounts) external {
    for (uint i = 0; i < users.length; i++) {
        try IERC20(token).transfer(users[i], amounts[i]) {
            // Success
        } catch {
            // Log failure, skip this user, don't block others
        }
    }
}
```

**Known blacklist tokens:** USDC, USDT, TUSD.

### Issue 7: Tokens with Max Supply / Transfer Limits

Some tokens have maximum transfer amounts per transaction or maximum holding amounts per address.

```solidity
// Protocol may assume any amount can be transferred
// But some tokens: require(amount <= maxTransferAmount)
// This can brick protocols that batch large transfers
```

## Part 3: Payment Pattern Analysis

### Push vs Pull Pattern

```
PUSH (Dangerous):
  Contract sends funds TO recipients
  - Can fail if recipient is a contract that reverts
  - Can be DoS'd by one malicious recipient
  - Gas costs unpredictable

PULL (Safe):
  Recipients claim funds FROM contract
  - Each claim is independent
  - One user's failure doesn't affect others
  - Gas costs predictable per claim
```

**Detection:**

```
For each function that sends ETH or tokens to external addresses:
  If sending to user-supplied addresses in a loop → PUSH pattern
  If sending to individual addresses via claim function → PULL pattern
  PUSH pattern with untrusted recipients → HIGH risk of DoS
```

## Workflow

```
Task Progress:
- [ ] Step 1: Find all external calls (call, delegatecall, staticcall, transfer, send)
- [ ] Step 2: Verify return values are checked for all external calls
- [ ] Step 3: Identify all token interactions and classify token assumptions
- [ ] Step 4: Check for fee-on-transfer compatibility (balance before/after pattern)
- [ ] Step 5: Check for rebasing token compatibility
- [ ] Step 6: Verify SafeERC20 usage for tokens with missing return values
- [ ] Step 7: Check approve patterns for race conditions and USDT compatibility
- [ ] Step 8: Analyze payment distribution pattern (push vs pull)
- [ ] Step 9: Score findings and generate report
```

## Output Format

```markdown
## External Call Safety Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Category:** [Unchecked Return | Fee-on-Transfer | Rebasing | Missing Return | Callback | Approve Race | DoS]
**Severity:** [CRITICAL | HIGH | MEDIUM]

**Issue:**
[Description of the unsafe external call or token integration issue]

**Affected Tokens:**
[List of known tokens that trigger this issue, e.g., USDT, USDC, stETH]

**Vulnerable Code:**
[Code snippet]

**Attack Scenario:**
1. [Step-by-step exploitation]

**Recommendation:**
[Use SafeERC20, balance-before-after, pull pattern, etc.]
```

## Quick Detection Checklist

- [ ] Are ALL low-level `call` return values checked (`require(success)`)?
- [ ] Does the protocol use `SafeERC20` for all token interactions?
- [ ] Does the deposit function use balance-before-after pattern for fee-on-transfer tokens?
- [ ] Does the protocol explicitly handle or reject rebasing tokens?
- [ ] Does `approve()` reset to 0 before setting new allowance (USDT compatibility)?
- [ ] Are batch payment operations using pull pattern (not push)?
- [ ] Is `delegatecall` only used with trusted, immutable targets?
- [ ] Are return data sizes from untrusted contracts limited?
- [ ] Does the protocol handle token blacklisting gracefully?

For weird ERC20 catalog, see [{baseDir}/references/weird-erc20.md]({baseDir}/references/weird-erc20.md).
For call safety patterns, see [{baseDir}/references/call-safety-patterns.md]({baseDir}/references/call-safety-patterns.md).

## Rationalizations to Reject

- "We only support standard ERC20 tokens" → USDT is the most used token and it's non-standard (no return value, fee capability)
- "The call will always succeed" → Smart contract wallets, blacklisted addresses, and gas changes can cause failures
- "We trust the token contract" → Token contracts can be upgraded (proxies) or have hidden features
- "transfer() is safe enough" → 2300 gas stipend breaks with gas repricing EIPs; use call()
- "We checked the token before listing" → Fee-on-transfer can be toggled on after listing (USDT has this capability)
- "Rebasing tokens are rare" → stETH is one of the largest tokens by TVL
