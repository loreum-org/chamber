# Behavioral State Analysis (BSA)

Token-efficient smart contract security auditing that scopes analysis to what matters, runs only relevant threat engines, and uses tiered output depth to avoid context exhaustion.

## What It Does

1. **Extracts behavioral intent** — invariants, state machines, roles (kept brief)
2. **Smart-scopes threat engines** — classifies contract type, runs only relevant engines (ETE/ACTE/SITE)
3. **Tiered output** — full PoCs for Critical/High only; one-liners for Low/Info
4. **Bayesian confidence scoring** — mathematical prioritization of findings

## Token Efficiency

BSA is designed to complete full audits within a single context window:

- **Smart scoping**: A utility library skips the Economic Threat Engine entirely
- **Tiered depth**: Only Critical/High findings get PoC code generation
- **No redundancy**: Each finding appears once with all metadata inline
- **Compressed Phase 1**: ≤30 lines per contract instead of verbose spec documents
- **Reference files are optional**: Deep-dive checklists only loaded when needed

## When to Use

- Comprehensive smart contract security audit
- DeFi protocol threat modeling
- Cross-contract attack surface analysis
- Vulnerability prioritization

## Structure

```
behavioral-state-analysis/
├── skills/
│   └── behavioral-state-analysis/
│       ├── SKILL.md                          # Core methodology (token-optimized)
│       └── references/
│           ├── threat-engines.md             # Optional deep-dive checklists
│           └── confidence-scoring.md         # Optional scoring reference
├── .claude-plugin/
│   └── plugin.json
└── README.md
```

## Engine Selection Matrix

| Contract Type | ETE | ACTE | SITE |
|--------------|-----|------|------|
| DeFi (DEX/lending/vault/staking) | Full | Full | Full |
| Token (ERC20/721/1155) | Full | Lite | Lite |
| Governance/DAO | Lite | Full | Full |
| NFT marketplace | Full | Full | Lite |
| Utility/Library | Skip | Lite | Lite |
| Proxy/Upgradeable | Skip | Full | Full |
