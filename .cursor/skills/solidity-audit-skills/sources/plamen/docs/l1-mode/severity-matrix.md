# L1 Mode Severity Matrix

> **Version**: v0.3 — Latent/bundle-incomplete calibration rules added
> **Scope**: All findings produced by `/plamen l1` mode
> **Reference**: Aligned with [Immunefi Vulnerability Severity Classification System v2.3](https://immunefi.com/immunefi-vulnerability-severity-classification-system-v2-3/) for Blockchain/DLT infrastructure.

## Why a new matrix

The smart-contract severity matrix in `rules/report-template.md` is built around impact categories like "direct fund loss" and "protocol breakage" that translate poorly to L1 infrastructure. An L1 node-client bug can produce consequences that are not in the DeFi vocabulary: a full network halt, a chain fork, an eclipse, a finality delay, a light-client bypass, a state sync poisoning. This matrix maps those consequences into Plamen's Critical/High/Medium/Low/Info tiers consistently.

L1 mode findings are graded by this matrix; smart-contract findings (including any DeFi contracts running on the L1 under audit) continue to use `report-template.md`.

## Impact categories

| Impact tier | Definition | Examples |
|---|---|---|
| **Critical** | Network cannot confirm new transactions; unintended chain split; direct loss of user funds via protocol-level mechanism; permanent freeze of >10% of staked funds; consensus failure leading to unrecoverable state | Consensus halt from non-determinism; successful double-spend via fork-choice flaw; crafted payload triggering divergence across ≥50% of network; direct fund drain via VM invariant break (Optimism OVM_ETH class) |
| **High** | Network-wide denial of service (not permanent); temporary freezing of funds or validator slashing; chain reorg enabler; light-client bypass allowing fraudulent state acceptance; node crash reachable by any peer | Amplified P2P DoS that takes down ≥10% of nodes; mempool asymmetric-cost attack forcing full eviction (DETER-class); light-client accepts invalid state proof; RPC endpoint panic crashing node |
| **Medium** | Single-node DoS (not network-wide); significant performance degradation under adversarial conditions; privilege escalation within a node; information disclosure; finality delay without halt; block-propagation slowdown | Malformed message locks one node; mempool exhaustion from a single peer; RPC method leaks sensitive internal state; validator can be slashed via crafted input without losing all stake |
| **Low** | Resource inefficiency; minor state inconsistencies; bugs requiring a trusted position (consensus-level stake, operator access); recoverable misbehavior; log/event correctness issues | Inefficient gossip causing bandwidth waste; metric counter incorrect; audit-log inconsistency; governance vote count off-by-one |
| **Informational** | Code hygiene; best-practice deviations; unused code; documentation mismatches; dead code | Missing error context; goroutine leak in test-only path; dead fork-choice branch; spec-vs-impl naming drift |

## Likelihood categories

| Likelihood tier | Definition | Examples |
|---|---|---|
| **High** | Permissionless exploit, no prerequisites, reachable by any network participant or RPC client | Any P2P peer can send the crafted message; any unauthenticated RPC client can trigger the bug |
| **Medium** | Requires specific conditions: particular mempool state, validator subset, epoch boundary, active sync, fork window | Attack needs a fresh sync; needs ≥1 validator to misbehave; requires a specific block range |
| **Low** | Complex setup, multiple stars must align, requires time-bounded race, or sustained adversarial position | Needs a controlled validator for 10+ epochs; needs a sustained eclipse; race with microsecond window; requires >1/3 Byzantine fraction to be already present |

## Base severity = Impact × Likelihood

| | Likelihood: High | Likelihood: Medium | Likelihood: Low |
|---|---|---|---|
| **Impact: Critical** | **Critical** | **High** | **High** |
| **Impact: High** | **High** | **High** | **Medium** |
| **Impact: Medium** | **Medium** | **Medium** | **Low** |
| **Impact: Low** | **Low** | **Low** | **Low** |
| **Impact: Info** | **Informational** | **Informational** | **Informational** |

Note the matrix is **stricter** than the smart-contract matrix for Critical impact + Medium/Low likelihood. This reflects the catastrophic nature of L1 infrastructure failures: a consensus halt remains a severe incident even if the exploit requires specific conditions, because the recovery cost (hard fork, rollback, manual intervention) scales with the blast radius, not the likelihood.

## Modifiers (applied after base matrix)

Modifiers shift the tier by ±1 and stack (floor: Informational, ceiling: Critical).

### Downgrades

| Modifier | Shift | Rationale |
|---|---|---|
| **Requires >1/3 Byzantine stake** | −1 tier | Attack path assumes ownership of consensus-level stake that would cost more than the bounty to acquire honestly |
| **Requires >2/3 Byzantine stake** | −2 tiers | Already-broken trust assumption; the protocol explicitly does not defend against this |
| **Requires fully-trusted role** (governance, emergency key, upgrade admin) | −1 tier (floor: Info) | Trust assumption is documented; attack is a governance concern, not a protocol bug |
| **DoS affects only attacker's own node or resources** | −1 tier (floor: Info) | Self-harm is not a security issue |
| **Testnet-only reachability** | −1 tier | Production impact is bounded; exploits may not port cleanly |
| **Requires on-chain-only observation** (no cross-boundary impact) | −1 tier | Limited to internal state; aligns with smart-contract matrix rule for view-only impact |

### Upgrades

| Modifier | Shift | Rationale |
|---|---|---|
| **Cross-chain or bridge surface with fund-loss path** | +1 tier | Bridges concentrate value and broadcast impact; a medium bug in a bridge is a high bug in practice |
| **Finality-strict chain (Casper FFG, Tendermint BFT, Aptos, Sui)** with finality-affecting bug | +1 tier | Finality violations are unrecoverable without hard fork or social consensus, unlike probabilistic-finality chains |
| **Attacker has source control** (forked client, validator operator, relay operator) | +1 tier | Attacker can modify client behavior on top of exploiting the bug; compound impact |
| **Permissionless exploit requires zero stake** | +1 tier if base ≥ Medium | Fully public attack surface; no economic friction |
| **Exploit reachable from an unauthenticated RPC endpoint** | +1 tier if base ≥ Medium | RPC is typically the most exposed attack surface |

## Immunefi verbatim classification (Round 4)

Source: [Immunefi Vulnerability Severity Classification System v2.3](https://immunefi.com/immunefi-vulnerability-severity-classification-system-v2-3/). These are the reference tier definitions Plamen aligns to.

### Critical (Level 4)

- Network not being able to confirm new transactions (total network shutdown)
- Unintended permanent chain split requiring hard fork (network partition requiring hard fork)
- Direct loss of funds
- Permanent freezing of funds (fix requires hard fork)

### High (Level 3)

- Unintended chain split (network partition)
- Temporary freezing of network transactions by delaying one block by ≥500% of average block time
- Causing network processing nodes to process transactions from the mempool beyond set parameters
- RPC API crash affecting projects with ≥25% of the market capitalization on top of the respective layer

### Medium (Level 2)

- Increasing network processing node resource consumption by at least 30% without brute force actions
- Shutdown of ≥30% of network processing nodes without brute force actions (does not shut down the network)
- Bug in the respective layer 0/1/2 network code resulting in unintended smart contract behavior with no concrete funds at direct risk

### Low (Level 1)

- Shutdown of >10% and <30% of network processing nodes without brute force actions
- Modification of transaction fees outside design parameters

### Bounty caps (observational)

- Critical Blockchain/DLT bugs typically capped at 10% of funds directly affected, with a USD 250,000 maximum on many programs.
- Exceptional programs exceed the cap: Optimism paid $2,000,042 for Saurik's SELFDESTRUCT; Polkadot/Frontier paid $1M for pwning.eth's truncation; Moonbeam paid $1M + $50k for the delegatecall bug; NEAR paid $150k for Zellic's "Ping of Death" pre-auth handshake panic.

### Explicit exclusions (Immunefi program-wide)

Typically **out-of-scope** for bounty payouts but **in-scope for Plamen audits** (report as Low / Info with a note):

- Basic economic / governance attacks (51% control, oracle data manipulation, liquidity gaming, Sybil)
- Theoretical-only bugs without a working PoC
- Bugs in testnets only
- Known issues documented in the release notes

## Plamen calibration adjustments (from Round 4)

Round 4 research on real bug outcomes informs these calibration decisions:

1. **Eclipse attacks default to Medium**, upgraded to High only if the attacker can reach ≥30% of nodes cheaply. Matches Immunefi treatment.
2. **Mempool asymmetric DoS (DETER / MemPurge class) maps to High** per the "process transactions beyond set parameters" Immunefi clause.
3. **RPC crash without chain impact is High only if** the affected client has ≥25% market share. Single-client RPC crashes on minority clients drop to Medium.
4. **"Brute force" language**: attacks requiring majority stake or >$X cost to execute are downgraded one tier. Plamen's Byzantine-stake modifier in the table above already encodes this.
5. **Single-client consensus violations** (where other clients continue validating) are High, not Critical. A Critical chain split requires the majority of clients to diverge. Example: the Prysm Fusaka bug (Dec 2025) was High because 9 other clients kept validating.
6. **Pre-auth panic is always High or Critical** on reachability grounds. The NEAR "Ping of Death" was rated CVSS 8.8 ($150k) because any network peer could kill any node with one packet.
7. **Latent dead-code findings are capped at High**. Code that exists but is not currently reachable in production (dead branches, `#[cfg]`-gated paths excluded from the build, `if false { ... }` blocks, behaviorally-equivalent dead implementations, e.g. a dead code path one refactor away from going live) may represent a structural defect, but it is NOT currently exploitable. A latent finding cannot be Critical unless a PoC demonstrates a realistic activation path within the audited commit. Document the activation precondition in the Severity rationale.
8. **Bundle-incomplete findings are PARTIAL by default**. A finding that flags one missing field in a multi-field validation bundle (e.g. "block.timestamp not validated") MUST cite the §3d Validation-Bundle artifact OR be marked PARTIAL until the full enumeration is performed. This prevents one-field-and-stop reporting.

## Severity rationale field

Every L1 finding MUST include a **Severity rationale** field that cites:

1. The impact cell (e.g., "Impact: High — network-wide DoS from single peer")
2. The likelihood cell (e.g., "Likelihood: Medium — requires peer to be connected during sync window")
3. Any modifiers applied (e.g., "+1 for unauthenticated RPC surface")
4. The resulting tier (e.g., "= High")

This makes grading auditable and makes disagreements mechanically resolvable in review.

## Change log

- **v0.3**: Extended "Plamen calibration adjustments" from six to eight rules — added rule 7 (latent dead-code findings capped at High absent a PoC'd activation path) and rule 8 (bundle-incomplete findings default to PARTIAL pending full field enumeration).
- **v0.2 — 2026-04-10**: Integrated Round 4 research. Replaced paraphrased Immunefi section with verbatim tier definitions from the v2.3 classification (Critical/High/Medium/Low). Added bounty cap observations with real payout data. Added "Plamen calibration adjustments" section codifying six rules learned from real bug outcomes (eclipse default, mempool DoS mapping, RPC crash gating on market share, brute-force language, single-client consensus bugs, pre-auth panic severity floor).
- **v0.1 — 2026-04-10**: Initial draft based on design.md Section 9 + known Immunefi classification shape.
