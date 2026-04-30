# Chamber Protocol Intent and Spec Extraction

## System Overview

The Chamber protocol is enterprise treasury infrastructure for organizations. Chambers function as corporate entities with an elected board of directors who oversee fiduciary operations and approve transactions through multi-signature governance.

## Key Claims

### 1. Governance Model
- NFT holders can delegate voting power to tokenIds through a market-driven selection process
- Top N delegated tokenIds become "directors" with transaction approval rights
- Directors must prove NFT ownership and follow EIP-1271 for smart contract wallets

### 2. Transaction Management
- Multi-signature wallet with quorum-based approvals (51% + 1 of directors)
- Batch transaction support for efficiency
- Revocable confirmations and secure execution with reentrancy protection

### 3. Delegation System
- Double-entry bookkeeping for delegation tracking
- Immediate withdrawal capabilities
- Circuit breaker pattern for emergency pauses
- Maximum delegation limits enforced

### 4. Security Properties
- ERC-4626 vault with virtual shares to prevent inflation attacks
- Upgradeable via UUPS proxy with ProxyAdmin governance
- Reentrancy protection and input validation
- Delegation constraints on token movements

## Critical Flows

### 1. Initialization Flow
```
Deploy Chamber → Initialize with ERC20/ERC721 → Set initial seats → Ready for delegation
```

### 2. Delegation Flow
```
User deposits ERC20 → Receives Chamber shares → Delegates to tokenId → Updates board ranking → May become director
```

### 3. Transaction Flow
```
Director submits transaction → Other directors confirm → When quorum reached → Execute transaction → Funds move
```

### 4. Seat Update Flow
```
Director proposes new seat count → Other directors support → After 7 days → Execute if quorum maintained
```

### 5. Upgrade Flow
```
Directors submit upgrade transaction → Confirm via multisig → Execute upgradeImplementation call
```

## Trust Assumptions

### External Dependencies
- **ERC20 Token**: Assumed non-malicious, standard compliant
- **ERC721 Token**: Assumed non-malicious, ownership queries work correctly
- **ProxyAdmin**: Chamber controls its own proxy admin after deployment

### Internal Assumptions
- **NFT Ownership**: `ownerOf()` calls are authoritative and don't revert unexpectedly
- **Director Integrity**: Directors won't collude to drain funds
- **Quorum Security**: 51%+1 threshold prevents single points of failure
- **Delegation Limits**: Users won't delegate more than they can cover

## Critical Invariants

1. **Balance Integrity**: `balanceOf(user) >= totalDelegatedAmount(user)` always
2. **Board Consistency**: Top N delegates are always the directors
3. **Quorum Enforcement**: Transactions require >51% director confirmations to execute
4. **Share Protection**: ERC-4626 virtual shares prevent inflation attacks
5. **Delegation Accounting**: Total delegated amounts tracked accurately across all users

## Attack Surface

### High-Risk Areas
- **Delegation manipulation**: Over-delegation, circular delegations, flash loan attacks
- **Board takeover**: Sybil attacks on NFT ownership, delegation frontrunning
- **Transaction execution**: Reentrancy, insufficient confirmations, invalid targets
- **Upgrade mechanism**: Proxy admin compromise, storage collision risks

### Economic Considerations
- **MEV Opportunities**: Delegation frontrunning, transaction ordering
- **Griefing Attacks**: Excessive transaction submissions, confirmation spam
- **Centralization Risks**: Large holders dominating governance

## Assumptions and Risks

### Dangerous Assumptions
1. **NFT Security**: Assumes NFT contract doesn't allow duplicate tokenIds or burned token transfers
2. **EIP-1271 Implementation**: Smart contract directors implement signature validation correctly
3. **ERC20/ERC721 Standards**: External tokens follow standards and don't have unusual transfer behaviors
4. **ProxyAdmin Security**: Registry properly transfers ownership to Chamber after deployment

### Systemic Risks
1. **Governance Capture**: Single entity acquiring majority NFT ownership
2. **Economic Attacks**: Flash loans to manipulate delegation rankings
3. **Upgrade Risks**: Malicious upgrades if governance is compromised
4. **External Token Risks**: Underlying ERC20/ERC721 contracts being compromised