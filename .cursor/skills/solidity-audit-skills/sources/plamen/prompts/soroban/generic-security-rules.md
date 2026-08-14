# Generic Security Rules - Soroban

> **Usage**: Analysis agents and depth agents reference these rules during Soroban smart contract analysis.
> These rules cover ALL Soroban contracts regardless of type. Rules R1-R16 are adapted from EVM/Solana equivalents. Rules SB1-SB12 are Soroban-specific.

---

## Rule R1: Cross-Contract Return Validation (adapted from EVM/Solana R1)

**Pattern**: Any `invoke_contract` or `try_invoke_contract` call that modifies remote state or returns data
**Check**: After cross-contract invocation, are returned values validated? Is trap vs Result handled correctly?

| Mismatch Type | Example | Impact |
|---------------|---------|--------|
| Unchecked return value | `env.invoke_contract(...)` return ignored | Missed error condition, accounting desync |
| Trap propagation | `invoke_contract` panics inside callee | VM trap unwinds entire transaction unexpectedly |
| `try_invoke_contract` ignored error | `let _ = env.try_invoke_contract(...)` | Failure silently treated as success |
| Type mismatch on return | Callee returns `i128`, caller expects `u128` | Negative balance interpreted as large positive |
| Reentrancy via cross-contract | Callee calls back into caller before state committed | State invariant violated mid-execution |

**Action**: For every `invoke_contract` call: (1) check the return value is validated, (2) confirm `try_invoke_contract` is used where the caller should handle errors gracefully, (3) verify state is committed before the call if reentrancy is possible, (4) confirm the returned type matches the declared interface in `contractimport!`.

---

## Rule R2: Function Preconditions Are Griefable (adapted from Solana R2)

**Pattern**: Any function with preconditions based on externally-manipulable state
**Check**: Can external actors manipulate state to make the precondition fail or succeed at the wrong time?

This includes:
- Keeper/bot-driven functions with balance-dependent preconditions
- Permissionless functions with oracle-dependent thresholds
- Any function reading token balances that can be donated to

**Direction 2 - Admin action impacts on user functions**: For every admin function that modifies a parameter used in user-facing function preconditions:
- Can an admin parameter change retroactively affect users in active positions?
- Does the parameter change take effect immediately on pending operations?

**Soroban-specific vectors**:
- **Token donation**: Anyone can transfer SAC/SEP-41 tokens to a contract address; balance-based preconditions become attacker-controlled
- **Account creation timing**: Stellar account creation is explicit; a contract expecting a pre-existing account may fail if the account is created late or not at all
- **Ledger sequence griefing**: Operations requiring specific sequence numbers (e.g., offer management) can be front-run on Stellar's public mempool
- **TTL-based gate circumvention**: A precondition that checks whether a Persistent entry exists can be bypassed if an attacker extends the TTL of a deliberately-created entry before the check

**Action**: For every function with a precondition, identify whether the precondition state can be manipulated by: (1) direct token transfer (unsolicited), (2) cross-contract invocation in the same transaction, (3) SAC/XLM donation, (4) ledger-timing attacks.

---

## Rule R3: Transfer Side Effects (adapted from Solana R3)

**Pattern**: Any SEP-41 token transfer or SAC (Stellar Asset Contract) transfer
**Check**: Does the transfer trigger side effects or account for allowance expiry?

| Transfer Type | Side Effect | Check |
|--------------|-------------|-------|
| SAC (native Stellar asset) | Stellar protocol rules apply (trustline checks, authorization flags) | Trustline must exist; asset may be auth-required |
| SEP-41 custom token | Implementation-defined hooks possible | Verify token contract is trusted; check for reentrant callbacks |
| `transfer_from` with allowance | Allowance stored in Temporary storage — may expire | Check TTL on allowance entry before consuming |
| XLM (native) transfer | `env.transfer_account_stellar_asset(...)` bypasses SEP-41 | Ensure accounting is consistent with SEP-41 balance |
| Clawback-enabled asset | Issuer can reclaim tokens post-transfer | Vault balance may decrease without protocol action |

**Mandatory check**: For every token the protocol handles:
- [ ] Is it a SAC (native Stellar asset) or a custom SEP-41 token?
- [ ] If SAC: are trustlines and authorization flags accounted for?
- [ ] If SEP-41: is the token contract trusted? Can it call back into this contract?
- [ ] If using `transfer_from`: is the allowance stored in Temporary storage with an adequate TTL?
- [ ] Is the asset clawback-enabled by the issuer?

---

## Rule R4: Uncertainty Handling - Adversarial Assumption
**CONTESTED is a TRIGGER, not a TERMINAL state.**

When marking any finding as CONTESTED:
1. **Enumerate** all plausible external behaviors
2. **Assess** severity for each scenario
3. **Escalate** if ANY scenario results in HIGH/CRITICAL
4. **Default** to WORST-CASE severity until production behavior verified

**Soroban-specific uncertainty sources**:
- **Upgradeable contracts**: Unknown future behavior if `update_current_contract_wasm` authority is active
- **External contract imports**: `contractimport!`-based calls assume a stable ABI; callee may be upgraded
- **Archived Persistent entries**: A Persistent entry that has been archived returns as if absent — callee behavior under this condition may be undocumented

---

## Rule R5: Combinatorial Impact Analysis (adapted from EVM/Solana R5)

**Pattern**: Protocol manages N similar entities (vaults, pools, positions, etc.)
**Check**: Cumulative impact across all entities + Soroban resource limit constraints

**Soroban-specific**: Operations across N entities may exceed per-transaction instruction budgets. Check:
- If N is unbounded: does iterating all entities fit within a single transaction's CPU/memory budget?
- If not: is the protocol designed for partial processing? What is the impact of partial-only execution?
- N × dust donation > threshold → griefing vector (each donation is independently cheap on Stellar)

---

## Rule R6: Semi-Trusted Role Bidirectional Analysis
For any automated role (keepers, bots, operators, oracles):

**Direction 1**: How can ROLE harm USERS?
- Timing attacks (Stellar ledger close every ~5s)
- Parameter manipulation (e.g., setting fee above user expectation)
- Omission (failing to extend TTL, causing data archival before users can act)

**Direction 2**: How can USERS exploit ROLE?
- Front-run predictable keeper actions on Stellar's public mempool
- Grief preconditions to block keeper execution
- Force keeper into suboptimal decisions (e.g., force liquidation trigger)

---

## Rule R7: External Protocol Integration (adapted from EVM R7)

**Pattern**: Protocol uses `contractimport!` to call external Soroban contracts
**Check**: Dependency staleness, ABI version mismatch, behavior assumptions

| Risk | Description | Check |
|------|-------------|-------|
| Unversioned import | `contractimport!` without a pinned WASM hash | Upstream contract may change ABI or behavior after upgrade |
| Type mismatch post-upgrade | Callee function signature changed, caller compiled against old type | Runtime `ScVal` conversion panic or silent data corruption |
| Behavioral assumption | Caller assumes callee emits specific events or writes specific storage | Callee upgrade removes behavior; caller logic breaks silently |
| No version probe | No on-chain version check before invocation | Caller proceeds with stale assumptions |

**Action**: For each `contractimport!` declaration: (1) verify the import is pinned to a specific WASM hash or version, (2) check that callee upgrade paths are governed or time-locked, (3) identify any behavioral assumptions encoded in the caller that are not enforced on-chain.

---

## Rule R8: Cached Parameters / Stored External State (adapted from EVM/Solana R8)

**Pattern**: Operation spans multiple transactions with cached initial state, OR contract stores a snapshot of external state in Persistent/Temporary storage
**Check**: Can parameters change between operation start and completion? Can stored state expire (archival)?

**Soroban-specific additions**:
- **TTL expiry on cached state**: A value stored in Persistent storage becomes archived after TTL. If the contract reads it without checking for expiry, the SDK returns a `None` / missing key — the caller may misinterpret this as "uninitialized" and re-initialize with a default value, overwriting real state
- **Temporary storage expiry**: Allowances, nonces, and session state stored in Temporary storage expire after the TTL ledgers. Any multi-step operation that spans more ledgers than the Temporary TTL will find the state gone on step 2
- **Ledger-keyed snapshots**: State stored with a ledger sequence key (e.g., price at ledger N) may be consumed after the ledger it was valid for, producing stale arithmetic
- **Cross-invocation external state**: External contract state (balance, admin, config) read in one invocation and stored locally is stale by the time the next transaction runs

**Action**: For every multi-step operation AND for every value stored in Temporary or Persistent storage, verify: (1) TTL is extended before each consumption, (2) the consumer checks for key absence before assuming a stale default, (3) cached external state is re-validated at each subsequent use.

---

## Rule R9: Arithmetic Precision - Integer-Only Math (adapted from EVM R9)

**Pattern**: Any arithmetic involving amounts, rates, prices, or shares
**Check**: Integer division truncation, scaling factor consistency, i128 range

**Soroban-specific**: Soroban runs Rust compiled to WASM with NO floating-point math. All arithmetic is integer (`i128`/`u128`/`u64`). Division always truncates toward zero.

| Issue | Example | Impact |
|-------|---------|--------|
| Division before multiplication | `(a / b) * c` instead of `(a * c) / b` | Precision loss; dust stays in contract |
| Inconsistent scaling factors | One path uses `1e7` (Stellar standard), another uses `1e18` | Orders-of-magnitude pricing error |
| i128 sign assumption | `i128` used for amount; negative value from `transfer_from` goes undetected | Attacker receives tokens without deduction |
| Overflow before check | `a * b` where both are `i128` near MAX/2 | Wraps silently if `overflow-checks` is off (see SB4) |
| Dust accumulation | Repeated rounding in user's favor | Protocol insolvency over time |

**Action**: For every arithmetic expression involving amounts: (1) verify multiplication before division, (2) confirm all scaling factors are consistent with Stellar's 7-decimal convention (`1e7`), (3) check that `i128` values from external sources are range-validated before use, (4) verify `overflow-checks = true` is set in `Cargo.toml` (see SB4).

---

## Rule R10: Worst-State Severity Calibration
**Soroban-specific parameters for worst-state analysis**:
- Max contract WASM size: 64KB (compressed)
- Max instance storage entries: no hard limit, but shared ~64KB across all entries
- Max Persistent entry size: varies by network config (typically several KB)
- Ledger close time: ~5–6 seconds
- Max TTL: configurable per network (typically ~1 year in ledgers)
- XLM balance minimum: 1 XLM base reserve + 0.5 XLM per subentry

Use worst-state parameters: peak TVL, maximum number of concurrent users, minimum TTL before archival, maximum allowed WASM size.

---

## Rule R11: Unsolicited Token Transfer Impact (adapted from Solana R11)

**Pattern**: Protocol reads token balances or XLM balances
**Check**: What happens if tokens or XLM arrive unsolicited?

**Soroban-specific vectors**:
- **SAC token transfer**: Anyone can transfer a Stellar asset to any account with a trustline — no contract function call needed
- **XLM native transfer**: XLM can be sent to any Stellar account; the contract's XLM balance increases without any contract function being invoked
- **Custom SEP-41 transfer**: Any holder can call `transfer(sender, contract_address, amount)` on a SEP-41 token without the contract's consent

**5-Dimension Analysis** (Soroban-adapted):
1. **Transferability**: Can tokens/XLM be sent without calling contract functions? (YES for all Stellar assets)
2. **Accounting**: Does contract read `token.balance(env.current_contract_address())` directly? If so, donation inflates the reading
3. **Operation Blocking**: Does an inflated balance prevent operations (e.g., max-cap checks)?
4. **Collection Growth**: Does unsolicited receipt trigger a new storage entry (Temporary or Persistent)?
5. **Side Effects**: Does the SEP-41 token's `transfer` implementation call back into this contract?

---

## Rule R12: Exhaustive Enabler Enumeration
For EACH dangerous precondition state, fill the 5-actor-category table. Soroban-specific paths per category:
1. **External attacker**: Permissionless contract calls, unsolicited SAC/SEP-41/XLM transfers, direct `invoke_contract` composition
2. **Semi-trusted role**: Keeper/operator acting within permissions but with adversarial timing or omission
3. **Natural operation**: Reward accrual, user deposits/withdrawals, ledger TTL expiry causing archival
4. **External event**: Upstream contract upgrade, governance parameter change, oracle staleness, Stellar network upgrade
5. **User action sequence**: Normal usage creating edge states via sequential operations across ledgers

---

## Rule R13: User Impact Evaluation - Anti-Normalization
5-question test for any finding marked "by design":
1. **Who is harmed** by this design gap?
2. **Can affected users avoid** the harm?
3. **Is the gap documented** in protocol docs?
4. **Could the protocol achieve the same goal** without this gap?
5. **Does the function fulfill its stated purpose completely?**

**Soroban-specific "by design" patterns to challenge**:
- "Users must extend TTL themselves" — true, but does the protocol provide a way to do so? If not, this is a protocol gap.
- "Archived data is recoverable via fee" — true on Stellar, but recovery requires the original entry value to be known off-chain; verify the protocol stores it durably.
- "Contract is upgradeable, admin can fix it" — upgradeability is a trust assumption; assess admin risk and upgrade governance separately.

---

## Rule R14: Cross-Variable Invariant - Storage Type Consistency (adapted from EVM R14)

**Pattern**: State spanning multiple storage entries that must maintain a relationship
**Check**: Can any function break the invariant? Are related variables stored in the same or compatible storage types?

**Soroban-specific**: State is stored in three TTL-tiered storage types (Temporary, Persistent, Instance). Cross-storage-type invariants are particularly fragile because entries can expire independently.

| Risk | Example | Impact |
|------|---------|--------|
| Related entries in different TTL tiers | Total supply in Instance, user balance in Persistent | User balance expires and disappears; total supply overstates |
| Invariant broken by independent expiry | `total = sum(user_balances)` where some user_balances expire | Total becomes greater than actual sum |
| Constraint coherence | `max_borrow` and `min_collateral` independently settable by admin | Admin can set combination that makes all positions immediately undercollateralized |
| Setter regression | `set_max_fee(new_fee)` where `new_fee < accumulated_fees_owed` | Underflow when paying out accumulated fees |

**Action**: For every pair of storage entries that must maintain a mathematical relationship: (1) verify both entries are in the same storage tier (or that inter-tier relationships are explicitly handled), (2) check that admin setters validate new values against accumulated state, (3) verify the relationship holds after any combination of independent TTL expiry.

---

## Rule R15: Flash Loan / Atomic Transaction Precondition Manipulation (adapted from Solana R15)

**Pattern**: Any function precondition that depends on state manipulable within a single Stellar transaction
**Check**: Can the precondition be satisfied/bypassed via operation composition in one transaction?

**Soroban note**: Stellar transactions are atomic multi-operation bundles. Multiple contract invocations can be composed in one transaction:
1. Operation 1: Call lending protocol to borrow tokens
2. Operation 2: Manipulate target contract state (inflate balance, move oracle)
3. Operation 3: Extract value from target contract
4. Operation 4: Repay lending protocol

Any lending protocol on Stellar is a potential flash loan source — no special flash loan interface is required.

**Action**: For every function with a balance/oracle/threshold precondition, check if multi-operation atomic composition within one Stellar transaction can satisfy the precondition and extract value before repayment.

---

## Rule R16: Oracle Integrity - Soroban Adaptation (adapted from Solana R16)

**Pattern**: Any contract logic that consumes external price or rate data
**Check**: Is oracle data validated for all failure modes?

| Check | Description | Soroban Implementation |
|-------|-------------|------------------------|
| Staleness | Price update timestamp vs current ledger | `env.ledger().timestamp()` vs stored `updated_at`; flag if gap > max_staleness |
| Price > 0 | Zero price causes division trap or free tokens | `require!(price > 0, Error::InvalidPrice)` |
| Exponent/decimals | Oracle may return raw value + exponent separately | Verify consistent decimal normalization across all use sites |
| Feed account verification | Oracle contract address validated against a hardcoded constant | Do NOT accept oracle contract address from user input |
| Fallback behavior | What happens if oracle `invoke_contract` traps? | `try_invoke_contract` with error branch that reverts or uses circuit breaker |
| Round completeness | Oracle round may be in-progress | Check that the round is finalized before consuming the value |

**Additional oracle checks** (apply to all oracle types in Soroban):
- **Timestamp monotonicity**: If users or keepers supply price data for pull-based oracles, verify the new update timestamp >= previously stored timestamp. Without this, an attacker can supply an older price within the accepted staleness window.
- **Hardcoded stablecoin pricing**: Does the contract skip oracle lookup for any asset and hardcode its price? All assets require dynamic pricing — stablecoins depeg.
- **Chained feed deviation**: If derived prices require multiple feeds (e.g., token/XLM via token/USD + XLM/USD), sum individual deviation thresholds. If total exceeds liquidation margin → FINDING.
- **Argument order verification**: For every function that receives multiple price/rate values (e.g., live price and TWAP, spot and average, bid and ask), confirm parameters are passed in the correct order to comparison and arithmetic functions. Swapped argument order in a subtraction (e.g., `twap - live` vs `live - twap`) causes underflow and protocol-wide DoS during directional price movement. (Source: Halborn Normal Finance AMM audit — CRITICAL severity from parameter swap.)

---

## Rule SB1: Missing require_auth (Soroban-Specific)

**Pattern**: Any function that modifies state on behalf of an address, moves tokens, or changes permissions
**Check**: Is `address.require_auth()` called for the address whose assets or permissions are affected?

```rust
// VULNERABLE: no auth check before modifying user balance
pub fn withdraw(env: Env, user: Address, amount: i128) {
    let balance: i128 = env.storage().persistent().get(&user).unwrap_or(0);
    env.storage().persistent().set(&user, &(balance - amount));
    // token transfer happens here — anyone can call this for any user
}

// SAFE: require_auth enforces the user signed the transaction
pub fn withdraw(env: Env, user: Address, amount: i128) {
    user.require_auth();
    let balance: i128 = env.storage().persistent().get(&user).unwrap_or(0);
    env.storage().persistent().set(&user, &(balance - amount));
}
```

| Missed Case | Impact |
|-------------|--------|
| Admin function with no `admin.require_auth()` | Anyone can call admin functions |
| `transfer_from`-equivalent without caller auth | Anyone can drain another user's approved balance |
| State change affecting a third-party address | Attacker manipulates victim state without consent |
| require_auth on wrong address | `caller.require_auth()` instead of `user.require_auth()` allows any caller to act as any user |

**Action**: For every function: (1) identify all addresses whose state or assets are modified, (2) verify `address.require_auth()` is called for each such address, (3) confirm the auth is called on the AFFECTED address, not the caller address.

---

## Rule SB2: Storage Type Misuse (Soroban-Specific)

**Pattern**: Data stored in a Soroban storage tier that does not match its required durability or size profile
**Check**: Is the storage type appropriate for the data's lifetime and size?

| Storage Type | Behavior | Correct Use | Misuse Example | Impact |
|-------------|---------|-------------|----------------|--------|
| `Temporary` | Expires after TTL; NOT archivable; permanently deleted | Session state, nonces, short-lived approvals | Storing user balances in Temporary | Balance permanently deleted after TTL — user loses funds |
| `Persistent` | Expires after TTL; archivable and restorable | User balances, positions, long-lived state | Storing unbounded maps in Persistent (per-entry key) | Each user entry has its own TTL; orphaned entries accumulate |
| `Instance` | Shared TTL with contract instance; ~64KB total | Contract config, admin address, global state | Storing growing Vec or Map in Instance | Instance storage fills up → contract becomes unusable (DoS) |

**Action**: For every storage write: (1) verify Temporary is never used for funds or permanent protocol state, (2) verify Instance storage does not grow unboundedly, (3) verify Persistent storage entries representing user balances have TTL extended on activity.

---

## Rule SB3: TTL Neglect (Soroban-Specific)

**Pattern**: Contract stores Persistent or Instance data without extending TTL
**Check**: Are `extend_ttl` calls present for all critical storage entries?

```rust
// VULNERABLE: Persistent entry written but TTL never extended
pub fn stake(env: Env, user: Address, amount: i128) {
    user.require_auth();
    let key = DataKey::Stake(user.clone());
    env.storage().persistent().set(&key, &amount);
    // No extend_ttl — stake will be archived after min_ttl ledgers
}

// SAFE: TTL extended after write (and on read in get_stake)
pub fn stake(env: Env, user: Address, amount: i128) {
    user.require_auth();
    let key = DataKey::Stake(user.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage().persistent().extend_ttl(&key, MIN_TTL, MAX_TTL);
}
```

| Risk | Description | Severity |
|------|-------------|----------|
| User balance archived | User's balance entry expires; reads return None → treated as zero | High (fund loss) |
| Config/admin archived | Contract config expires; protocol becomes misconfigured | Critical |
| Nonce archived | Auth nonce entry expires; replay attack becomes possible | High |
| TTL extension missing on read | Frequently-read data not refreshed; TTL drains | Medium |

**Action**: For every Persistent and Instance storage write: (1) verify `extend_ttl` is called after the write, (2) verify `extend_ttl` is called on read paths for entries that may go stale between writes, (3) verify the MIN_TTL and MAX_TTL values are appropriate for the protocol's expected usage frequency.

---

## Rule SB4: Overflow-Checks Flag (Soroban-Specific)

**Pattern**: Soroban contract compiled without `overflow-checks = true` in `[profile.release]`
**Check**: Is `overflow-checks = true` set in `Cargo.toml` for the release profile?

```toml
# VULNERABLE: default release profile — overflow wraps silently in Wasm
[profile.release]
opt-level = "z"
# overflow-checks not set → defaults to false in release builds

# SAFE: overflow panics are preserved in Wasm
[profile.release]
opt-level = "z"
overflow-checks = true
```

Rust's debug builds panic on overflow by default. Release builds (used for Soroban Wasm compilation) wrap silently unless `overflow-checks = true` is explicitly set. This means an overflow that would be caught in testing becomes a silent, exploitable wrap in production.

**Impact**: An attacker can cause integer overflow in an unchecked release build to: wrap a large balance to a small one (draining the protocol), wrap an addition to produce a negative i128 (triggering underflow in dependent code), or bypass a check that relies on a sum being within bounds.

**Action**: Read `Cargo.toml` for the audited project. If `overflow-checks = true` is absent from `[profile.release]`, this is a CONFIRMED finding. Check every arithmetic path for exploitable overflow vectors.

---

## Rule SB5: Unprotected Contract Upgrade (Soroban-Specific)

**Pattern**: Contract exposes `update_current_contract_wasm` without sufficient access control
**Check**: Is `require_auth` for an admin address called before every contract upgrade?

```rust
// VULNERABLE: any caller can replace the contract Wasm
pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}

// SAFE: admin must authorize the upgrade
pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}
```

| Check | Description |
|-------|-------------|
| Missing require_auth | Anyone can upgrade the contract |
| Admin address in mutable storage | Admin can be changed before upgrade to bypass intended governance |
| No timelock | Upgrade takes effect immediately with no delay for user exit |
| Upgrade to arbitrary hash | No on-chain verification of new Wasm; admin can introduce malicious code |

**Action**: For every contract with an upgrade function: (1) verify admin `require_auth` is called, (2) verify the admin address is stored in immutable or well-governed storage, (3) note whether a timelock or governance delay is present (absence is a finding at minimum Informational, High if TVL is significant).

---

## Rule SB6: Unsafe Unwrap/Expect (Soroban-Specific)

**Pattern**: Use of `.unwrap()` or `.expect()` on `Option` or `Result` types in contract logic
**Check**: Does the unwrap occur on a value that can legitimately be absent or erroneous in production?

```rust
// VULNERABLE: causes VM trap if key is missing (e.g., after TTL expiry)
let balance: i128 = env.storage().persistent().get(&user).unwrap();

// SAFE: handle absence explicitly
let balance: i128 = env.storage().persistent().get(&user).unwrap_or(0);
// OR if absence is truly unexpected:
let balance: i128 = env.storage().persistent().get(&user)
    .ok_or(Error::UserNotFound)
    .unwrap_or_else(|e| panic_with_error!(env, e));
```

| Scenario | Consequence of Trap |
|----------|-------------------|
| Storage key absent after TTL expiry | Transaction fails with VM trap; user cannot access funds |
| `try_invoke_contract` error unwrapped | Cross-contract error becomes unrecoverable trap |
| `Option::None` from arithmetic edge case | DoS for all users who trigger the edge case |
| Trap in keeper/bot-called function | Keeper fails silently; time-sensitive operation never executes |

**Action**: Enumerate every `.unwrap()` and `.expect()` call. For each one: (1) identify whether the `None`/`Err` case is reachable in production (including after TTL expiry), (2) if reachable, replace with `unwrap_or`, `unwrap_or_else`, or `panic_with_error!(env, Error::X)` for user-facing errors.

---

## Rule SB7: Authorization Tree Propagation (Soroban-Specific)

**Pattern**: Contract calls a sub-contract on behalf of a user; the sub-contract requires auth from the user
**Check**: Is the authorization correctly propagated through the call tree?

```rust
// VULNERABLE: outer contract requires user auth but does NOT propagate it
// Inner contract's require_auth for `user` will FAIL unless explicitly authorized
pub fn compound(env: Env, user: Address, vault_id: u32) {
    user.require_auth();
    // This call invokes vault_contract.withdraw(user, ...) which calls user.require_auth() internally
    // But user's auth is NOT automatically available in the sub-call — it must be declared
    env.invoke_contract::<()>(&vault_contract, &Symbol::new(&env, "withdraw"), args);
}

// SAFE: use require_auth_for_args to declare what sub-invocations the auth covers
pub fn compound(env: Env, user: Address, vault_id: u32) {
    user.require_auth_for_args((vault_id,).into_val(&env));
    // Now user's auth is valid for the specific sub-invocation matching these args
}
```

**Soroban auth model**: Authorization in Soroban is not "ambient" — a `require_auth` in a sub-contract call is NOT automatically satisfied by an outer `require_auth`. The caller must explicitly declare the authorization scope using `require_auth_for_args` or the Soroban auth framework's call tree propagation.

**Action**: For every contract that makes cross-contract calls on behalf of a user address: (1) verify the auth scope covers the sub-invocation, (2) check that `require_auth_for_args` correctly specifies the sub-call arguments, (3) verify that the auth tree cannot be widened by an attacker supplying additional arguments.

---

## Rule SB8: Instance Storage Bounds (Soroban-Specific)

**Pattern**: Contract stores a `Vec`, `Map`, or other growing collection in Instance storage
**Check**: Is the collection bounded? Can an attacker cause it to grow past the ~64KB Instance storage limit?

```rust
// VULNERABLE: Vec in Instance storage grows with each user registration
pub fn register(env: Env, user: Address) {
    let mut users: Vec<Address> = env.storage().instance()
        .get(&DataKey::Users).unwrap_or(Vec::new(&env));
    users.push_back(user);
    env.storage().instance().set(&DataKey::Users, &users);
    // After ~1000 users the instance storage serializes > 64KB → all contract calls fail
}

// SAFE: use Persistent storage with per-user keys for unbounded sets
pub fn register(env: Env, user: Address) {
    env.storage().persistent().set(&DataKey::UserRegistered(user.clone()), &true);
    env.storage().persistent().extend_ttl(&DataKey::UserRegistered(user), MIN_TTL, MAX_TTL);
}
```

Instance storage is shared across ALL entries under a single contract instance. The combined serialized size of all instance entries must stay under the network-configured limit (~64KB on Mainnet). A single unbounded collection can fill this limit, making the contract permanently non-functional.

**Action**: For every Instance storage write: (1) identify whether the value is a collection (Vec, Map, Bytes) that grows with user activity, (2) if yes, flag as a potential DoS vector, (3) verify there is an enforced maximum size or that the data should be migrated to per-key Persistent storage.

---

## Rule SB9: Approve Race Condition (Soroban-Specific)

**Pattern**: SEP-41 `approve()` used to update an existing allowance
**Check**: Is the allowance update subject to a race condition? Does the allowance TTL align with expected usage timing?

```rust
// RACE CONDITION: spender can front-run the update and spend both the old and new allowance
// User calls approve(spender, old_amount) initially
// User sees old_amount is wrong, calls approve(spender, new_amount)
// Spender sees the new approve TX in mempool, front-runs:
//   1. spend(old_amount)  ← drains old allowance before it's overwritten
//   2. (approve TX lands, sets new_amount)
//   3. spend(new_amount)  ← drains new allowance
// Total spend = old_amount + new_amount (attacker extracted double)

// SAFE: use approve(spender, 0) first, then approve(spender, new_amount)
// OR use increase_allowance / decrease_allowance if available
```

**Soroban-specific TTL risk**: SEP-41 allowances are stored in Temporary storage with a `live_until_ledger` expiry. An allowance may expire between the `approve` call and the `transfer_from` call if:
- The user set a short expiry (e.g., 1 ledger)
- The spender delays consuming the allowance
- Network congestion causes the consuming transaction to land after the expiry

**Action**: For every SEP-41 `approve` integration: (1) flag race condition risk if the protocol updates allowances by overwriting (not incrementing), (2) verify the `live_until_ledger` value is set to a reasonable future ledger, (3) verify the consuming side checks for zero/expired allowance before failing with a confusing error.

---

## Rule SB10: Panic Without Error Context (Soroban-Specific)

**Pattern**: Bare `panic!()` macro used instead of `panic_with_error!(env, Error::Variant)`
**Check**: Does the contract use the Soroban error framework for all failure conditions?

```rust
// VULNERABLE: bare panic produces opaque error; breaks fuzzing and test assertions
pub fn withdraw(env: Env, user: Address, amount: i128) {
    user.require_auth();
    let balance = get_balance(&env, &user);
    if balance < amount {
        panic!("insufficient balance");  // ← opaque, not inspectable
    }
}

// SAFE: use panic_with_error! for structured errors
#[contracterror]
pub enum Error {
    InsufficientBalance = 1,
    Unauthorized = 2,
}

pub fn withdraw(env: Env, user: Address, amount: i128) {
    user.require_auth();
    let balance = get_balance(&env, &user);
    if balance < amount {
        panic_with_error!(env, Error::InsufficientBalance);
    }
}
```

| Risk | Description |
|------|-------------|
| Opaque errors | `panic!()` produces no error code; callers cannot distinguish failure modes |
| Broken fuzz testing | Fuzzing frameworks cannot classify bare panics as expected vs unexpected errors |
| Missing `#[contracterror]` | Error enum not annotated → not exported in contract ABI → clients cannot parse errors |
| Unlabeled panics in dependencies | `unwrap()` / `expect()` in library code produce bare panics indistinguishable from intentional panics |

**Action**: Enumerate all `panic!()` calls. For each one: (1) verify whether it represents an expected error condition (should use `panic_with_error!`) or a genuine programming invariant violation (may remain as panic), (2) confirm all user-facing error paths use `#[contracterror]`-annotated enums.

---

## Rule SB11: PRNG Misuse (Soroban-Specific)

**Pattern**: `env.prng()` used for security-sensitive randomness (selection, secret generation, commit-reveal)
**Check**: Is the PRNG output used in a context where predictability creates an attack vector?

```rust
// VULNERABLE: PRNG seeded from ledger-observable data — predictable to validators
pub fn select_winner(env: Env) -> Address {
    let participants: Vec<Address> = env.storage().instance().get(&DataKey::Participants).unwrap();
    let index = env.prng().u64_in_range(0..participants.len() as u64);
    participants.get(index as u32).unwrap()
}
```

Soroban's `env.prng()` is a deterministic PRNG seeded from the ledger's randomness beacon. It is NOT cryptographically secure against a validator or sophisticated observer who can predict or influence the seed. Stellar's randomness beacon is not commit-reveal resistant.

| Unsafe Use | Safe Alternative |
|-----------|-----------------|
| Winner/recipient selection from a pool | VRF-based commit-reveal via external oracle |
| Secret/nonce generation | Use deterministic derivation from user-supplied secret, not PRNG |
| Shuffle ordering for distribution | Documented as non-secure; use off-chain randomness with on-chain commit |
| One-time pad or encryption key | Never use contract PRNG for cryptographic keys |

**Action**: For every `env.prng()` call: (1) identify the security consequence if the output is predictable, (2) flag any use where predictability allows an attacker to gain an unfair advantage or forge a secret, (3) document whether the protocol's stated security model accounts for PRNG predictability.

---

## Rule SB12: Stale Contract Import (Soroban-Specific)

**Pattern**: `contractimport!` macro used to import an external contract's client without version pinning
**Check**: Is the imported WASM hash pinned? What happens if the dependency is upgraded?

```rust
// VULNERABLE: imports type definitions from a Wasm file at compile time
// If the dependency Wasm changes (upgrade), the compiled client types are stale
mod token {
    contractimport!(file = "../../target/wasm32-unknown-unknown/release/token.wasm");
}
// After token.wasm is upgraded to add a parameter to transfer(), this client silently
// passes the wrong number of arguments → runtime error or silent mismatch

// SAFER: pin the dependency to a specific published WASM hash and verify on-chain
// OR use the standardized SEP-41 interface instead of importing a specific Wasm
```

| Risk | Description | Impact |
|------|-------------|--------|
| Unversioned local path import | Wasm file changes without caller recompile | ABI mismatch; runtime trap |
| No on-chain hash verification | Deployed callee may differ from the compiled Wasm used during development | Caller calls a function that doesn't exist |
| Trusting caller-supplied contract address | Caller passes a contract address; protocol assumes it matches the imported interface | Attacker passes malicious contract that mimics the interface |
| Interface drift | Standard like SEP-41 evolves; pin to a specific version | Breaking change silently accepted |

**Action**: For every `contractimport!` declaration: (1) check whether the imported file path is a locally-built artifact (risk: changes without recompile) or a pinned published hash, (2) verify whether the calling contract validates the callee contract address against a hardcoded constant, (3) flag any case where the callee address is user-supplied without on-chain validation.

---

## Evidence Source Tags - Soroban

| Tag | Description | Valid for REFUTED? |
|-----|-------------|-------------------|
| [PROD-ONCHAIN] | Read from production Stellar account / contract storage on-chain | YES |
| [PROD-SOURCE] | Verified source from Stellar Expert / Soroban contract source verification | YES |
| [PROD-FORK] | Tested on a local fork with mainnet contract state | YES |
| [CODE] | From audited codebase source | YES |
| [MOCK] | From mock/test setup | **NO** |
| [EXT-UNV] | External, unverified | **NO** |
| [DOC] | From documentation only | **NO** |

---

## Rule SB13: SDK Version Known Vulnerability Cross-Reference

**Pattern**: Any Soroban contract with `soroban-sdk` dependency
**Check**: Cross-reference the SDK version in Cargo.toml against known CVEs

| CVE / Advisory | Affected Versions | Impact | Detection Pattern |
|---------------|-------------------|--------|------------------|
| CVE-2026-26267 (Critical) | soroban-sdk-macros < 22.0.10, < 23.5.2, < 25.1.1 | `#[contractimpl]` generates calls to inherent functions instead of trait functions when names collide — trait security checks silently bypassed | Grep for `impl Trait for Contract` + `impl Contract` with matching fn names |
| GHSA-96xm-fv9w-pf3f (Moderate) | soroban-sdk < 22.0.9, < 23.5.1, < 25.0.2 | `Bytes::slice`, `Vec::slice`, `Prng::gen_range` overflow when `overflow-checks = false` | Check SDK version + SB4 overflow-checks flag |
| GHSA-PM4J-7R4Q-CCG8 (Low) | soroban-env-host < 26.0.0 | Storage key conversion flag stuck after `Val` to `ScVal` failure — subsequent MuxedAddress conversions fail | Check soroban-env-host version in Cargo.lock |

**Action**: (1) Read SDK version from Cargo.toml/Cargo.lock. (2) If version falls in affected range → flag as finding with upgrade recommendation. (3) For CVE-2026-26267 specifically: grep for any `impl` block on the contract type that defines a function with the same name as a function in a trait `impl` — this is the bypass vector even on patched versions if the code pattern exists.

---

## Rule SB14: Unrestricted Storage Key Derivation

**Pattern**: `env.storage().{type}().set()` where the storage key incorporates user-supplied input
**Check**: Can a caller control the storage key used in a write operation?

| Risk Pattern | Example | Impact |
|-------------|---------|--------|
| User-controlled DataKey variant field | `DataKey::UserData(user_supplied_key)` where key is not validated | Attacker overwrites arbitrary contract state |
| Direct Address as key without auth | `storage.set(&attacker_address, &value)` without `require_auth(&attacker_address)` | Attacker writes to other users' storage slots |
| Enum variant collision | Two DataKey variants that serialize to the same bytes | Silent data corruption |

**Action**: For every `env.storage().*.set()` call, trace the key parameter back to its source. If any component of the key is caller-controlled, verify (1) `require_auth` gates the write, (2) the key is bound to the authenticated address, (3) no variant collision is possible.

---

## Rule SB15: Unrestricted transfer_from Source Address

**Pattern**: `token.transfer_from(spender, from, to, amount)` where `from` is caller-supplied
**Check**: Can the caller specify an arbitrary `from` address in `transfer_from`?

| Risk Pattern | Example | Impact |
|-------------|---------|--------|
| User-supplied `from` without validation | `token.transfer_from(&env.current_contract_address(), &user_from, &to, &amount)` | Drain any address that has approved the contract |
| Allowance not checked against caller | Contract acts as spender for any `from` address | Unauthorized fund transfers |

**Action**: For every `transfer_from` call: (1) verify `from` is either hardcoded or derived from authenticated caller, (2) verify the allowance was granted specifically for this operation, (3) if the contract is the spender, verify it only transfers from addresses that explicitly authorized this specific action via `require_auth`.

---

## Rule SB16: Transaction Footprint Contention Griefing

**Pattern**: Public functions that read/write widely-shared ledger entries
**Check**: Can an attacker submit cheap transactions that contend with the same footprint, degrading throughput?

Soroban transactions with overlapping footprints (reading/writing the same ledger entries) execute sequentially. An attacker who knows a contract's footprint can flood cheap contending transactions to delay legitimate operations.

| Risk Pattern | Example | Impact |
|-------------|---------|--------|
| Global state in hot path | Single Instance storage entry read by every function | All contract calls serialize through one entry |
| Time-sensitive operations | Liquidation, auction settlement, oracle update | Attacker delays critical operations by contending footprint |
| Predictable footprint | Contract reads same Persistent entries for every user | Attacker submits min-cost transactions reading same entries |

**Action**: (1) Identify all ledger entries in the contract's read/write footprint for critical functions. (2) If a time-sensitive function shares footprint entries with a permissionless function, flag as griefing risk. (3) Check if the protocol can mitigate via per-user storage keys (reducing shared footprint) or priority fee requirements.

---

## Rule SB17: Transaction Resource Budget Exhaustion (Soroban-Specific)

**Pattern**: Functions that loop over user-controlled collections (reserves, positions, collateral types, oracle feeds)
**Check**: Can a user grow their position across enough entries that a single transaction exceeds Stellar's per-transaction resource limits (~40 read ledger entries, CPU/memory budgets)?

| Risk Pattern | Example | Impact |
|-------------|---------|--------|
| Liquidation iterates all user reserves | User deposits/borrows across N assets → liquidation reads N×(reserve + oracle + token) entries | Liquidation reverts on resource limit → user immune to liquidation → bad debt |
| Account position loops over all reserves | Health factor check reads every enabled reserve | Borrow/withdraw reverts when user has too many reserves enabled |
| Oracle queries per asset | Each reserve requires oracle price → TWAP reads multiple price records | N reserves × M price records per feed exceeds read budget |

**Action**: (1) For each function with a user-reserve loop, compute: `max_reads = reserves_in_position × reads_per_reserve`. (2) Compare against Stellar's resource limits. (3) If `max_reads` can exceed the limit under user control → flag as LIQUIDATION_RESOURCE_DOS. (4) Check if the protocol enforces a max-reserves-per-user cap that keeps the budget within limits.

---

## Enforcement Mechanisms

### Devil's Advocate FORCING
"could/might" language → MUST pursue to conclusion. Hedged language is a signal that analysis is incomplete. Replace with a definitive YES/NO after tracing the path.

### CONTESTED Triggers Production Fetch
CONTESTED findings require production verification via Stellar Horizon / Soroban RPC or CLI. A finding that remains CONTESTED without production data is a coverage gap.

### REFUTED Priority Chain Analysis
Chain analyzer must search ALL findings for enablers before accepting REFUTED. A REFUTED finding may become PARTIAL or CONFIRMED when another finding creates its missing precondition.

### Cross-Validation Before REFUTED
REFUTED verdict requires state evidence (on-chain data, source code proof). If state evidence is unavailable → verdict is CONTESTED, not REFUTED.

### Safe Patterns — Do Not Flag

The following patterns are known-safe in standard Soroban usage. Do NOT report them as findings **unless the guard is incomplete, incorrectly positioned, or the specific instance deviates from the safe form described**.

| Pattern | Why It's Safe | Flag Only If |
|---------|--------------|-------------|
| `address.require_auth()` at function entry | Soroban native authorization enforcement | The auth is called on the wrong address, or is missing for a state-modifying path |
| `env.storage().persistent().extend_ttl(...)` after every write | Standard TTL maintenance pattern | The MIN_TTL is too short for expected usage, or extend_ttl is missing on a read path that consumes the entry |
| `overflow-checks = true` in `[profile.release]` | Prevents silent integer wrapping in Wasm | The flag is absent (see SB4), or `wrapping_*` methods are used deliberately in critical value paths |
| Protocol-favoring rounding (truncation toward zero for user withdrawals) | Standard DeFi practice — protocol takes dust | Rounding is inconsistent across paired operations, or rounding compounds to material amounts |
| Two-step admin transfer (propose + accept) | Prevents accidental transfer to wrong address | Only one step exists, or acceptance has no `require_auth` for the new admin |
| `contractimport!` with SEP-41 standard interface | Standard token interface is stable | The contract also passes caller-supplied token addresses without validating against a known-good set |

**Important**: "Safe pattern detected" is NOT a reason to skip analysis of the surrounding code.

### Evidence Source Enforcement
[MOCK], [EXT-UNV], and [DOC] evidence CANNOT support a REFUTED verdict for findings involving external contract behavior or on-chain state. Only [PROD-ONCHAIN], [PROD-SOURCE], [PROD-FORK], or [CODE] evidence (direct source reading of the external contract) qualifies.
