---
name: behavioral-state-analysis
description: Token-efficient smart contract security auditing via Behavioral State Analysis (BSA). Scopes analysis to contract type, runs only relevant threat engines, and uses tiered output depth. Use for auditing smart contracts, security reviews, or DeFi threat modeling.
---

# Behavioral State Analysis (BSA)

Audit smart contracts by extracting behavioral intent, then systematically breaking it across security dimensions.

## When to Use

- Smart contract security audits
- DeFi protocol threat modeling (DEXs, lending, staking, vaults)
- Cross-contract attack surface analysis
- Vulnerability prioritization with confidence scoring

## When NOT to Use

- Pure context building (use audit-context-building)
- Entry point identification only (use entry-point-analyzer)
- Single-dimension only (use semantic-guard-analysis or state-invariant-detection)

## Token Budget Rules

**Follow these strictly to avoid context exhaustion:**

1. **Be terse.** Use bullet points and tables, not prose. No filler sentences.
2. **Smart scope first.** Classify the contract type in Phase 1, then run ONLY relevant engines in Phase 2 (see engine selection matrix below).
3. **Tiered output depth:**
   - Critical/High findings → full detail + PoC code
   - Medium findings → root cause + exploit scenario (no PoC)
   - Low/Info findings → one-line description only
4. **No redundant analysis.** If a dimension has no attack surface (e.g., no value flows = skip ETE), say "N/A" and move on.
5. **Cap Phase 1 output** to ≤30 lines per contract. List invariants and states, skip verbose specification documents.
6. **PoC generation** only for Critical and High severity findings. For others, describe the exploit path in ≤3 steps.
7. **Combine phases in output** — don't repeat findings across phases. Each finding appears once with all metadata inline.

## Pipeline

### Phase 1: Behavioral Decomposition (keep brief)

Extract intent from code and docs. Output per contract:

```
Contract: <Name>
Type: <DeFi/Token/Governance/NFT/Utility/Proxy>
States: [list]
Key Invariants (≤5):
  - <invariant>
Privileged Roles: [list]
Value Entry/Exit Points: [list or "none"]
```

**Then select engines:**

| Contract Type | Run ETE | Run ACTE | Run SITE |
|--------------|---------|----------|----------|
| DeFi (DEX/lending/vault/staking) | Yes | Yes | Yes |
| Token (ERC20/721/1155) | Yes | Lite | Lite |
| Governance/DAO | Lite | Yes | Yes |
| NFT marketplace | Yes | Yes | Lite |
| Utility/Library | No | Lite | Lite |
| Proxy/Upgradeable | No | Yes | Yes |

**Lite** = check only the top-priority item for that engine (see below).

### Phase 2: Threat Modeling (selected engines only)

Run only the engines selected above. For each engine, analyze in this priority order — stop if contract surface is exhausted:

**Economic Threat Engine (ETE):**
1. Value flow tracing — where can value enter/leave? Any sinks or circular flows?
2. Economic invariant verification — does `deposits == withdrawals + balance` hold?
3. Incentive analysis — any rational actor exploits (MEV, sandwich, griefing)?

**Access Control Threat Engine (ACTE):**
1. Unprotected privileged functions — any admin/owner actions callable by anyone?
2. Role escalation paths — can `User → [actions] → Admin`?
3. msg.sender vs tx.origin confusion; signature replay

**State Integrity Threat Engine (SITE):**
1. Non-atomic state updates — partial updates before external calls?
2. Sequence vulnerabilities — initialization bypass, unexpected call ordering?
3. Cross-contract stale data or reentrancy vectors

**Lite mode** = run only item #1 from that engine's list.

### Phase 3: Exploit Verification

For each hypothesis from Phase 2:
- Build attack sequence (≤5 steps)
- For Critical/High: generate minimal Foundry/Hardhat PoC (keep code short — test the specific vuln, not a full test suite)
- Quantify impact: Critical (all funds/system) | High (significant loss/privesc) | Medium (griefing/DOS) | Low (info/best practice)

### Phase 4: Score & Prioritize

Score: `Confidence = (Evidence × Feasibility × Impact) / FP_Rate`

| Factor | 1.0 | 0.7 | 0.4 | 0.1 |
|--------|-----|-----|-----|-----|
| Evidence | Concrete path, no deps | Specific state needed | Pattern-based | Heuristic |
| Feasibility | PoC confirmed | Achievable state | External conditions | Infeasible |

Impact: 5=total loss, 4=partial loss, 3=griefing, 2=info leak, 1=best practice
FP_Rate: 0.05 (known pattern) → 0.15 (moderate) → 0.40 (weak) → 0.60 (heuristic)

**Prioritization:** Report findings ≥10% confidence. Never suppress Impact ≥4.

## Finding Format (use for every finding)

```
### [F-N] Title
Severity: Critical|High|Medium|Low  |  Confidence: X%
Location: contract.sol#L10-L25, functionName()
Root Cause: <1-2 sentences>
Exploit: <numbered steps, ≤5>
Impact: <1 sentence with quantified risk>
Fix: <code diff or 1-2 sentence recommendation>
PoC: <only for Critical/High — minimal test code>
```

## Advanced Checks (run only if relevant to contract type)

- **Cross-contract:** Map external call chains `A→B→C`, test transitive trust
- **Time-based:** `block.timestamp` manipulation, expired signatures, replay
- **Upgradeable:** Storage collisions, re-initialization, migration atomicity

## Mindset

- "Standard function" → can behave non-standardly in context
- "Admin is trusted" → model admin compromise, check excessive powers
- "Known pattern" → novel interactions in specific contexts
- "Small value" → compounds; griefing scales
- "Trusted external contract" → trust boundaries shift; verify actual code
