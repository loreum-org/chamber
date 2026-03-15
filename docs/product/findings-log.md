# Product Findings Log

Chronological log of product review findings. Each entry includes category, description, location, recommendation, and priority.

---

## 2026-03-14

### [App UX] Debug Panel Visible in Production

**Type**: App UX

**Description**: Dashboard shows a debug info panel when config is invalid or errors occur. The panel exposes chain ID, registry address, loading states, and error messages. This is useful for development but clutters the UI and may confuse end users.

**Location**: `app/src/pages/Dashboard.tsx` (lines 83–102)

**Recommendation**: Gate debug panel behind a dev flag (e.g. `import.meta.env.DEV`) or move to a dedicated debug/settings page. Remove or collapse in production builds.

**Priority**: P2 (medium)

---

### [App UX] Hardcoded Etherscan Links

**Type**: App UX

**Description**: External links to block explorer use `etherscan.io` hardcoded. On Sepolia, localhost, or other chains, users are sent to mainnet explorer, which shows wrong or no data.

**Location**: `app/src/pages/ChamberDetail.tsx` (line 128), `app/src/pages/TransactionQueue.tsx` (line 404)

**Recommendation**: Use chain-aware block explorer URLs (e.g. via wagmi's `blockExplorers` or a helper that maps chainId to explorer base URL).

**Priority**: P1 (high)

---

### [Functionality] Deploy Agent Success Navigation Loses New Agent Address

**Type**: Issue

**Description**: After deploying an agent, the app navigates to `/` after 2 seconds. The new agent address is not passed or surfaced; user must find it via transaction receipt or block explorer.

**Location**: `app/src/pages/DeployAgent.tsx` (lines 36–37)

**Recommendation**: Pass agent address in navigation state or URL (e.g. `/agent/:address`) after deployment, or show a success modal with link to agent profile and copy button.

**Priority**: P1 (high)

---

### [UX] Delegation Requires Raw Token ID

**Type**: UX

**Description**: Delegation flow asks for "NFT Token ID" as a number input. Users may not know their NFT token ID; they typically think in terms of "my NFT" or wallet/ENS. No picker or NFT selector.

**Location**: `app/src/components/DelegationManager.tsx` (lines 228–237)

**Recommendation**: Add NFT selector that fetches user's NFTs from the chamber's membership contract and lets them pick by image/name. Fallback to manual token ID for power users.

**Priority**: P1 (high)

---

### [App UI] Layout Nav Missing Deploy Chamber

**Type**: App UI

**Description**: Main nav has "Chambers", "Deploy Agent", "Docs". "Deploy Chamber" is only reachable via Dashboard CTA or direct `/deploy`. Asymmetric prominence: Deploy Agent is in nav, Deploy Chamber is not.

**Location**: `app/src/components/Layout.tsx` (lines 6–10)

**Recommendation**: Add "Deploy Chamber" to nav, or a single "Deploy" dropdown with Chamber/Agent options, to balance primary actions.

**Priority**: P2 (medium)

---

### [Contract] Transaction Data Preview Truncated

**Type**: App UX

**Description**: Transaction data in queue is shown as `{data.slice(0, 66)}...` which cuts off most contract calls. Users cannot verify or decode what a transaction does before confirming.

**Location**: `app/src/pages/TransactionQueue.tsx` (lines 376–382)

**Recommendation**: Decode common selectors (transfer, approve, etc.) or integrate 4byte/abi decoder to show human-readable function name and args. Expandable raw hex for advanced users.

**Priority**: P1 (high)

---

### [Competitive] No Proposal Layer

**Type**: Competitive

**Description**: Chamber supports submit → confirm → execute for transactions but has no proposal layer (title, description, discussion, voting period). Competitors (Tally, Nouns) offer rich proposal UX. Chamber is closer to raw multisig.

**Location**: Product-level gap

**Recommendation**: Consider adding an optional proposal layer (on-chain or indexed off-chain) for structured governance. Could integrate with existing transaction queue.

**Priority**: P2 (medium)

---

### [Functionality] Sensor Hub / Agent Hub Not in App

**Type**: Issue

**Description**: Vision doc describes Sensor Hub (data ingestion) and Agent Hub (modular agents). Contracts and app implement Chamber, Board, Wallet, Agent, ValidationRegistry. No Sensor Hub or Agent Hub UI; agents are deployed but not managed as a "hub".

**Location**: `docs/protocol/vision.md`, `app/`

**Recommendation**: Align docs with current scope, or add roadmap for Sensor/Agent Hub. If future work, call out in overview as "planned" to set expectations.

**Priority**: P2 (medium)

---

### [App UX] Empty State for Non-Directors in Transaction Queue

**Type**: App UX

**Description**: Non-directors can view the transaction queue but see no clear explanation of why they can't confirm/execute. The "Director Access Required" message only appears in the New Transaction form, not when viewing pending txs.

**Location**: `app/src/pages/TransactionQueue.tsx`

**Recommendation**: When `userTokenId` is undefined and there are pending/ready transactions, show a brief banner: "You're not a director. Delegate shares to an NFT to participate in governance."

**Priority**: P3 (low)

---

### [Contract] Revoke Confirmation Not Exposed in UI

**Type**: App UX

**Description**: Chamber supports `revokeConfirmation(tokenId, transactionId)`. The Transaction Queue UI has Confirm and Execute but no Revoke button. Directors cannot undo a mistaken confirmation.

**Location**: `app/src/pages/TransactionQueue.tsx`, `Chamber.sol`

**Recommendation**: Add "Revoke" button for transactions the user has confirmed but not yet executed. Show only when `getConfirmation(userTokenId, txId)` is true.

**Priority**: P1 (high)

---

<!-- New entries appended below -->
