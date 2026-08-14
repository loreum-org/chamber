---
name: "cross-chain-timing"
description: "Trigger Pattern stellar_bridge|soroban_bridge|horizon|anchor_protocol|bridge|cross_chain|relay|wormhole|allbridge|debridge|axelar|LayerZero|sequence|emitter - Inject Into Breadth agents, depth-external"
---

# CROSS_CHAIN_TIMING Skill (Soroban)

> **Trigger Pattern**: `stellar_bridge|soroban_bridge|horizon|anchor_protocol|bridge|cross_chain|relay|wormhole|allbridge|debridge|axelar|LayerZero|sequence|emitter`
> **Inject Into**: Breadth agents, depth-external
> **Finding prefix**: `[CCT-N]`
> **Rules referenced**: R1, R2, R4, R8, R10, R16

Covers: cross-chain message verification, timing asymmetry between Stellar/Soroban and other chains, Stellar anchor (fiat on/off-ramp) integration risks, nonce/sequence replay protection, and cross-chain price relay staleness.

Stellar's SCP consensus achieves finality in approximately 3-5 seconds per ledger close — significantly faster than Ethereum (~12 min for high-confidence finality) and most rollups (10-60 min), but slower than Solana. **Key distinction from EVM chains**: There is NO mempool reordering on Stellar; once a transaction is included in a closed ledger it is final with no rollback risk. This changes the timing attack surface: there is no front-running at the consensus level, but there IS a meaningful finality asymmetry between Stellar and slower chains.

**No MEV / validator manipulation**: Stellar's federated quorum (SCP) has no block-ordering incentive for validators. Timing attacks on Soroban therefore target cross-chain relay windows, not intra-chain ordering.

---

## Step 1: Identify Cross-Chain Messaging Infrastructure

Find all cross-chain messaging calls and infrastructure:

| # | Bridge/Protocol | Direction | Soroban Call | Remote Chain | Message Type |
|---|----------------|-----------|-------------|-------------|-------------|
| 1 | {Wormhole/Allbridge/Axelar/custom Stellar anchor} | {Soroban->Remote / Remote->Soroban} | {contract function name} | {Ethereum/Polygon/etc.} | {token transfer / state sync / price relay / governance} |

### Stellar Anchor Integration (fiat on/off-ramp)
If a Stellar SEP-6/SEP-24/SEP-31 anchor is detected:

| Component | Contract Function | SEP Standard | Purpose | Location |
|-----------|-----------------|-------------|---------|----------|
| Deposit callback | {fn name} | SEP-6/SEP-24 | Accept fiat-anchored asset | {file:line} |
| Withdrawal request | {fn name} | SEP-6/SEP-24 | Initiate fiat withdrawal | {file:line} |
| Compliance check | {fn name} | SEP-12 | KYC/AML gating | {file:line} |
| Transfer settlement | {fn name} | SEP-31 | Cross-border payment | {file:line} |

Anchor integration introduces a **trusted off-chain actor** (the anchor server). Enumerate what the Soroban contract trusts the anchor to report and what state it changes based on that report.

### Wormhole / Generic VAA Bridge Inventory (if detected)
| Component | Soroban Function / Storage Key | Purpose | Location |
|-----------|-------------------------------|---------|----------|
| VAA verification | {fn name} | Guardian signature check | {file:line} |
| Message posting | {fn name} | Emit from Stellar | {file:line} |
| Sequence/nonce tracking | {storage key} | Replay prevention | {file:line} |
| Emitter address record | {storage key} | Source chain identity | {file:line} |

---

## Step 2: Cross-Chain Message Verification Audit

For EACH inbound cross-chain message consumed by the contract:

### 2a. VAA / Signed Message Verification Checklist

| # | Check | Status | Location | Notes |
|---|-------|--------|----------|-------|
| 1 | Guardian/relayer signature count meets quorum | YES/NO | {line} | Minimum signers required? |
| 2 | Guardian/signer set is current (not expired / revoked) | YES/NO | {line} | Old signer set may be compromised |
| 3 | Source chain ID validated | YES/NO | {line} | Reject messages from unexpected chains |
| 4 | Source contract/emitter address validated | YES/NO | {line} | Reject messages from unexpected senders |
| 5 | Sequence number / nonce replay check | YES/NO | {line} | Each message processed exactly once |
| 6 | Message freshness (ledger sequence or timestamp bound) | YES/NO | {line} | Stale messages rejected? |
| 7 | Payload format / magic bytes validated | YES/NO | {line} | Malformed payload handling |
| 8 | Verifier contract address itself validated | YES/NO | {line} | Prevents fake verifier substitution |

**Critical**: Missing checks 1-5 = **CRITICAL** (arbitrary cross-chain message injection). Missing checks 6-8 = **HIGH** (message quality/integrity issues).

### 2b. Stellar Anchor Callback Verification

If the protocol relies on a Stellar anchor to report off-chain fiat events:

| # | Check | Status | Location | Notes |
|---|-------|--------|----------|-------|
| 1 | Anchor server identity validated (authorized address list) | YES/NO | {line} | |
| 2 | Deposit amount matches anchor report vs on-chain asset balance | YES/NO | {line} | |
| 3 | Replay prevention on anchor callbacks | YES/NO | {line} | Can same event be replayed? |
| 4 | Anchor callback rejects events older than N ledgers | YES/NO | {line} | Max staleness threshold? |
| 5 | What happens if anchor server goes offline? | {describe} | {line} | User funds trapped? |

---

## Step 3: Timing Window Analysis

### 3a. Finality Asymmetry Model

| Chain | Ledger/Block Time | Practical Finality | Protocol Assumes |
|-------|------------------|-------------------|-----------------|
| Stellar/Soroban | ~5s per ledger close | ~5-10s (SCP — immediate after close) | {which level?} |
| {Remote Chain} | {time} | {time} | {which level?} |
| **Asymmetry Window** | - | - | **{max delay between chains}** |

**Critical question**: When Soroban processes a message about remote chain state, how old can that state be? Compute: `max_staleness = remote_finality + bridge_relay_delay + stellar_processing_time`

**No MEV nuance**: Because Stellar has no mempool, the attacker cannot front-run a pending relay transaction. However, they CAN front-run the relay by observing the source chain and submitting a Soroban transaction in the next ledger before the relay bot does — because Soroban transactions in the same ledger are ordered deterministically by fee but submitted permissionlessly.

### 3b. Stale State Usage Trace

For each piece of state synced cross-chain:

| State Variable | Source Chain | Sync Trigger | Max Staleness | Soroban Functions Using It | Fresh Required? |
|----------------|-------------|-------------|--------------|---------------------------|----------------|
| {state} | {chain} | {event/periodic/manual relay} | {time estimate} | {list contract functions} | YES/NO |

For each dependent function on Soroban:
- Is fresh state required or is stale acceptable?
- What decisions are made with potentially stale data?
- Can an attacker exploit the staleness window between relay submissions?

### 3c. Soroban-to-Remote Timing Attack

```
1. Attacker acts on Soroban (visible after ~5s ledger close — FINAL, no reorg)
2. Soroban event/message picked up by bridge relay (begins relay to remote chain)
3. TIMING WINDOW: Remote chain does not yet know about Soroban action
4. Attacker acts on remote chain using pre-Soroban-action state
5. Bridge relay arrives on remote chain — state updates
6. Attacker profited from acting on both chains during the asymmetry window
```

**Stellar-specific note**: Because Soroban finality is hard (no reorgs), the attacker can be confident the Soroban action is settled before acting on the remote chain, making the attack more reliable than on probabilistic chains.

### 3d. Remote-to-Soroban Timing Attack

```
1. State changes on remote chain (e.g., price moves, governance action, token mint)
2. Bridge relay begins (latency: {estimate})
3. TIMING WINDOW: Soroban still uses old remote state
4. Attacker submits Soroban transaction in next available ledger using stale remote state
5. Bridge relay arrives on Soroban — state updates
6. Attacker profited from Soroban action with stale state
```

---

## Step 4: Stellar Asset Trustline Requirements

Cross-chain token operations on Stellar/Soroban have trustline prerequisites with no EVM analogue:

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Destination account has trustline for incoming asset? | YES/NO | Without trustline the transfer fails; who creates it? |
| 2 | What happens if destination trustline limit is full? | {revert/skip/queue} | Transfers above limit are rejected by Stellar |
| 3 | Can attacker fill recipient trustline limit to block delivery? | YES/NO | Grief via spam transfers up to limit |
| 4 | Are Soroban contract token accounts (via SAC) separate from classic trustlines? | YES/NO | Stellar Asset Contract balances do not use classic trustlines |
| 5 | Is there a recovery mechanism for failed deliveries? | YES/NO | Lost funds if no recovery path |
| 6 | Does the contract create trustlines on behalf of users (requires sponsorship)? | YES/NO | Who pays the reserve? |

**Stellar-specific**: The Stellar base reserve (currently 0.5 XLM per trustline entry) means creating trustlines has a cost. Contracts that auto-create trustlines may be drained of their XLM reserve by an attacker triggering many trustline creations.

---

## Step 5: Nonce and Sequence Management

| # | Check | Status | Location | Notes |
|---|-------|--------|----------|-------|
| 1 | Replay protection exists | YES/NO | {line} | Method: {storage key per message / counter / hash set} |
| 2 | Replay check is BEFORE state changes | YES/NO | {line} | If after: partial replay possible |
| 3 | Out-of-order messages handled | YES/NO | {line} | Strict ordering vs any-order |
| 4 | Sequence gaps handled | YES/NO | {line} | What if message N+1 arrives before N? |
| 5 | Storage entry for replay protection subject to TTL expiry? | YES/NO | {line} | Instance/Persistent TTL — if entry expires, replayed message accepted |
| 6 | Double-spend across chains | YES/NO | {line} | Same asset spent on both chains during relay window |

**Soroban-specific replay concern**: Soroban storage entries have TTLs (`instance`, `persistent`, `temporary`). If replay-protection nonces are stored in `temporary` or `instance` storage with insufficient TTL, they may expire and a replayed old message would be accepted. **All replay-protection entries MUST use `Persistent` storage with extended TTL.**

---

## Step 6: Cross-Chain Price Relay Audit

If oracle prices are relayed cross-chain to Soroban:

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Price freshness validated on Soroban side (ledger sequence or timestamp) | YES/NO | Max acceptable age? |
| 2 | Price source authenticated (relay authorized address) | YES/NO | Can a fake price be relayed? |
| 3 | Price deviation bounds enforced | YES/NO | Max delta from last known price? |
| 4 | Fallback if relay is delayed / relay bot offline | YES/NO | What happens to price-dependent operations? |
| 5 | Source chain price is spot (manipulable) vs TWAP (resistant) | {spot/TWAP} | TWAP window length? |

**Staleness calculation**: `relay_staleness = source_price_age + bridge_latency + stellar_ledger_processing`

**No flash loan price manipulation on Stellar itself**: Stellar's DEX (SDEX / AMM) does not support flash loans natively, and Soroban flash loan patterns are protocol-specific. However, prices relayed FROM Ethereum via bridge can be manipulated on the source chain before relaying. Apply Rule 16 (Oracle Integrity).

---

## Step 7: Quantify Arbitrage Viability

```
1. Attacker monitors {SOURCE_CHAIN} for state changes at {MONITOR_POINT}
2. State change triggers sync message (latency window opens: {LATENCY_ESTIMATE})
3. Attacker submits Soroban transaction in next ledger using stale {STALE_STATE}
4. Bridge relay arrives on Soroban; state updates
5. Profit = {PROFIT_FORMULA}
6. Cost = bridge_fees + Stellar_tx_fees (very low, ~0.00001 XLM base) + capital_lockup_cost
7. Viable if: profit > cost AND repeatable
```

**Stellar cost model**: Stellar transaction fees are extremely low (100 stroops = 0.00001 XLM base fee). Soroban resource fees add compute/memory costs but are typically fractions of a cent. The primary cost is bridge fees and capital lockup, NOT gas. Small-margin attacks are viable.

---

## Key Questions (must answer all)

1. What is the realistic sync latency for {BRIDGE_PROTOCOL}? (cite documentation or relay bot config)
2. Can an attacker observe the remote chain and submit a Soroban transaction in the next ledger before the relay bot? (5s window per ledger)
3. What is the maximum state change during normal operation within the sync window?
4. Is this attack repeatable or one-time?
5. Are replay-protection nonces stored in Persistent storage with sufficient TTL to outlast the attack window?
6. Is replay protection complete (covers all message types, all source chains)?
7. Do trustline requirements create griefing or blocking vectors for cross-chain token delivery?
8. Are cross-chain prices validated for freshness AND deviation bounds?
9. For Stellar anchor integrations: what happens if the anchor server becomes unresponsive?

---

## Common False Positives

- **Monotonic state**: If synced state only increases, arbitrage may not be profitable in both directions
- **Negligible delta**: If max delta during sync window is <0.1%, may not be economically viable after bridge fees
- **Persistent nonces with long TTL**: Replay protection is adequate if nonces are Persistent with TTL >> relay latency
- **SAC isolation**: Stellar Asset Contract (SAC) token balances in Soroban contracts are isolated from classic Stellar trustline limits — trustline griefing does not apply to SAC-denominated operations
- **Bridge-level protections**: Some bridges enforce rate limiting or value caps that bound exploitation

---

## Instantiation Parameters

```
{CONTRACTS}           - Soroban contracts to analyze
{BRIDGE_PROTOCOL}     - Specific bridge (Wormhole, Allbridge, Axelar, Stellar anchor, custom)
{SYNC_POINT}          - Contract function where cross-chain state is consumed
{DEPENDENT_FUNCTIONS} - Functions that read synced state
{SOURCE_CHAIN}        - Chain where state originates
{MONITOR_POINT}       - What attacker monitors on source chain
{EXPLOIT_FUNCTION}    - Soroban function attacker calls
{STALE_STATE}         - Specific state that becomes stale
{LATENCY_ESTIMATE}    - Realistic bridge relay latency
```

---

## Output Schema

| Field | Required | Description |
|-------|----------|-------------|
| bridge_inventory | yes | All cross-chain messaging infrastructure |
| verification_audit | yes | Message verification completeness |
| timing_windows | yes | Asymmetry windows with duration estimates |
| trustline_requirements | yes | Recipient trustline requirements and failure modes |
| replay_protection | yes | Nonce/sequence management and TTL assessment |
| price_relay_audit | if applicable | Cross-chain price freshness and manipulation risk |
| arbitrage_viability | yes | Quantified attack profitability or NOT_VIABLE |
| finding | yes | CONFIRMED / REFUTED / CONTESTED |
| evidence | yes | Code locations with line numbers |
| step_execution | yes | Status for each step |

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Identify Cross-Chain Messaging Infrastructure | YES | | |
| 2. Cross-Chain Message Verification Audit | YES | | |
| 3. Timing Window Analysis (both directions) | YES | | |
| 4. Stellar Asset Trustline Requirements | YES | | |
| 5. Nonce and Sequence Management + TTL check | YES | | |
| 6. Cross-Chain Price Relay Audit | IF price relay detected | | |
| 7. Quantify Arbitrage Viability | YES | | |

### Cross-Reference Markers

**After Step 2**: If message verification is incomplete -> immediate finding, do not wait for timing analysis.

**After Step 3**: Feed timing windows to TEMPORAL_PARAMETER_STALENESS skill for parameters cached across chain boundaries.

**After Step 4**: If trustline creation can fail or be griefed -> cross-reference with economic design analysis for stranded asset risk.

**After Step 5**: If replay-protection nonces use `temporary` or `instance` storage -> mandatory HIGH finding for TTL expiry replay vector.

**After Step 6**: Feed price staleness findings to ORACLE_ANALYSIS if applicable.
