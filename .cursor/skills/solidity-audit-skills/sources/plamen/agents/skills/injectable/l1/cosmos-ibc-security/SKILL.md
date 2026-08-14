---
name: "cosmos-ibc-security"
description: "L1 trigger - audits IBC / ibc-go cross-chain entry points for ICS-23 / Merkle proof gaps, ordered-channel sequence integrity, escrow burn<->mint synchronization, light-client version downgrade, and timeout/ack handler reentrancy."
---

# Injectable Skill: Cosmos IBC Security

> **L1 trigger**: `L1_PATTERN=true` AND `IBC` (ibc-go / `/ibc/` / ics23 / IBC channels detected)
> **Inject Into**: `depth-consensus-invariant`, `depth-external`
> **Language**: Go (Cosmos-SDK / ibc-go)
> **Finding prefix**: `[IBC-N]`
> **Status**: v0.1

## Orchestrator Decomposition Guide

- Sections 1, 4: depth-external (cross-chain proof / version trust boundary — the bytes that cross the chain boundary)
- Sections 2, 3, 5: depth-consensus-invariant (channel sequence, escrow accounting, handler reentrancy — all chain-state / safety class)
- A single bug can span both lenses; record it once and cross-reference.

## When This Skill Activates

Recon detects an IBC integration: `go.mod` requires `github.com/cosmos/ibc-go/...`, the tree has an `/ibc/` subtree, an `ics23` / `23-commitment` / `02-client` / `04-channel` path, or IBC application modules (`OnRecvPacket`, `OnAcknowledgementPacket`, `OnTimeoutPacket`, `IBCModule` impls). IBC is the trust boundary where bytes from a *foreign* chain enter local state via a verified proof — proof-verification gaps and packet-handler bugs are the highest-severity class here (forged value acceptance, fund theft, chain halt). Severity baseline is Medium; proof-bypass / fund-loss / chain-halt classes upgrade to High/Critical per `docs/l1-mode/severity-matrix.md`.

An IBC entry path is any code reachable from `OnRecvPacket`, `OnAcknowledgementPacket`, `OnTimeoutPacket`, `OnChanOpenInit/Try/Ack/Confirm`, `OnChanCloseInit/Confirm`, a relayer-submitted `MsgRecvPacket` / `MsgAcknowledgement` / `MsgTimeout` / `MsgUpdateClient`, or any keeper method consuming a commitment proof. Everything in those paths consumes attacker-influenceable bytes (the relayer is untrusted; the counterparty chain may be malicious) and MUST verify proofs against the correct path/prefix before acting.

## 1. Merkle / ICS-23 Proof Verification

**Check**: Every consumption of a cross-chain value must verify a full membership (or non-membership) proof against the counterparty's committed root, using the **correct commitment path PREFIX** and validating the **emitter / source** is the expected chain/channel. A proof verified against the wrong path, with a missing prefix, or without binding the value to the expected source, lets a forged value pass (ICS-23 / Dragonberry-class).

**Methodology**:
1. From `caller_map.md` / `callee_map.md` / `function_summary.md`, enumerate every call to `VerifyMembership`, `VerifyNonMembership`, `VerifyProof`, `ics23.VerifyMembership`, `commitment.VerifyMembership`, or any keeper method that takes a `proof []byte` / `MerklePath` / `MerkleProof` argument.
2. For each, confirm ALL of:
   - The proof type matches intent: a *presence* claim uses membership, an *absence* claim (e.g. "this receipt was NOT written", non-receipt-based timeout) uses **non-membership** — a membership check substituted for non-membership (or vice versa) is a finding.
   - The commitment path is built from the **full prefix** (`commitmenttypes.NewMerklePath` with the client's stored prefix / `GetCommitmentPrefix()`), not a bare key or a hardcoded/empty prefix.
   - The value bound into the proof is the value the handler then acts on (no "verify proof of X, then act on Y").
   - The proof is verified against the **client state for the expected counterparty** (correct `clientID` / connection / channel), so a value committed by a *different* chain cannot be replayed in.
3. Flag any `VerifyProof` / `VerifyMembership` call with no full path/prefix construction, with no emitter==expected-chain (clientID/channel) binding, or where membership/non-membership is mismatched to the claim.

Tag: `[IBC-PROOF-GAP:{call}:{file}:{line}:{missing:prefix|emitter|membership-kind}]`

## 2. Channel Sequence Integrity

**Check**: For an **ORDERED** channel, packet sequences must be processed contiguously and monotonically — sequence `n+1` must not be delivered before `n`, and a delivered sequence must not be re-delivered. For **UNORDERED** channels, the receipt store must prevent replay. Missing seq-gap / monotonicity handling lets packets be skipped, reordered, or replayed.

**Methodology**:
1. Identify the channel ordering (`channeltypes.ORDERED` / `UNORDERED`) for each in-scope channel/module and how the handler branches on it.
2. For ORDERED channels: locate the `nextSequenceRecv` (and `nextSequenceSend`/`nextSequenceAck`) read/increment. Confirm `OnRecvPacket` rejects any packet whose sequence != the expected next, and that the counter increments by exactly one. Flag a missing contiguity check or an increment that can skip/gap.
3. For UNORDERED channels: confirm a per-packet receipt (`SetPacketReceipt` / `GetPacketReceipt` / `HasPacketReceipt`) blocks replay before any state effect.
4. Verify timeout and close paths keep the sequence bookkeeping consistent (a timed-out ordered packet must close the channel or advance state per spec — a silent gap is a finding).

Tag: `[IBC-SEQ:{channel-kind}:{file}:{line}:{gap|replay|nonmonotonic}]`

## 3. Escrow Burn <-> Mint Synchronization

**Check**: In transfer-style IBC apps, the source chain escrows (or burns) on send and the sink chain mints a voucher on recv; on the return path the voucher is burned and the escrow released. These must be atomic and balanced: `burnAmt <= escrowBal`, every mint on the sink corresponds to an escrow on the source, and a refund (timeout/failed-ack) returns exactly the escrowed amount. An overburn, a mint without a paired escrow record, or a desync between escrow ledger and module balance leaks or destroys funds.

**Methodology**:
1. Locate the escrow/voucher accounting: escrow module address (`GetEscrowAddress`), `MintCoins`/`BurnCoins` on the transfer module, and the per-channel/denom escrow tracking (`SetTotalEscrowForDenom` / `GetTotalEscrowForDenom` or equivalent ledger).
2. For the **send** path: confirm escrow (or burn) updates the tracked escrow total and that the amount escrowed equals the amount committed in the packet.
3. For the **recv** path: confirm the mint amount equals the packet amount and is bound to the verified packet (cannot mint without a successfully verified `OnRecvPacket`).
4. For the **return / refund** path (timeout + failed acknowledgement): confirm the refund/unescrow amount == the originally escrowed amount, that it is paid at most once per packet, and that `burnAmt <= escrowBal` (no overburn beyond what is tracked).
5. Flag: overburn (`Burn` not guarded by `<= escrowBal`), mint with no paired escrow/proof, double-refund on both timeout and ack, or an escrow-ledger update that can drift from `bankKeeper.GetBalance(escrowAddr, denom)`.

Tag: `[IBC-ESCROW-DESYNC:{path}:{file}:{line}:{overburn|unpaired-mint|double-refund|ledger-drift}]`

## 4. Light-Client Version Negotiation / Downgrade

**Check**: Channel/connection handshake and client updates must reject versions, client types, or feature sets **below the supported minimum**. Silently accepting a mismatched or downgraded version opens a channel under weaker (or attacker-chosen) semantics — e.g. accepting an ORDERED request as UNORDERED, an unsupported app version, or a deprecated/weaker client type.

**Methodology**:
1. In `OnChanOpenInit/Try/Ack/Confirm`, locate the version string / feature negotiation (`channeltypes.Version`, `ValidateChannelParams`, app `Version` checks, `metadata` JSON for middleware like ICS-29 fee, ICA).
2. Confirm each handshake step **rejects** (returns error) when the proposed version is unsupported, below the minimum, or empty — rather than defaulting to "open anyway" or silently substituting a default.
3. For client creation/update (`MsgCreateClient` / `MsgUpdateClient`), confirm the client type is on an allow-list and that a downgrade (replacing a stronger client with a weaker one, or accepting a consensus state with a regressed height/version) is rejected.
4. Flag any handshake/version path that opens the channel/connection on a mismatch, or that picks a default version when the counterparty's is unsupported.

Tag: `[IBC-VERSION-DOWNGRADE:{handshake-step}:{file}:{line}]`

## 5. Timeout / Ack Handler Reentrancy + CEI

**Check**: `OnTimeoutPacket` and `OnAcknowledgementPacket` (and `OnRecvPacket`) must complete their own state mutations (refund the escrow, clear the commitment, advance bookkeeping) **before** invoking external callbacks, middleware, or hooks that can re-enter the IBC stack. A handler that calls out (a contract callback, a downstream module hook, a token send to an arbitrary address) before flushing its state can be re-entered and made to double-refund, double-mint, or skip cleanup (Checks-Effects-Interactions violation).

**Methodology**:
1. For each `OnTimeoutPacket` / `OnAcknowledgementPacket` / `OnRecvPacket` (and middleware wrappers like callbacks/ICS-29 fee/ICA), order the operations: state reads, the commitment/receipt clear, the escrow/balance update, and any external interaction (callback into another module, `bankKeeper` send to a user-controlled address, sub-message dispatch).
2. Confirm the commitment is cleared and the escrow/refund ledger is updated **before** the external call (effects before interactions). Flag any external callback or arbitrary-address transfer that runs while the packet commitment / refund flag is still in the pre-flush state — that is a reenter-before-flush window.
3. Specifically check refund idempotency: a re-entrant or replayed timeout/ack must not refund twice (a "refunded" flag / cleared commitment must gate it, set before the external call).
4. For callback middleware, confirm a malicious or reverting callback cannot leave the escrow/commitment in an inconsistent half-updated state.

Tag: `[IBC-REENTRANCY:{handler}:{file}:{line}:{cei-violation|double-refund-window}]`

## Bounded Reads

**MANDATORY — do not bulk-read large source files (context-collapse risk).** Drive analysis from the Go SCIP bake graph artifacts first, then open individual symbols on demand:

- Read `caller_map.md`, `callee_map.md`, `state_write_map.md`, and `function_summary.md` (produced by the Go SCIP bake) to build the IBC entry-point reachability set (packet handlers, handshake callbacks, proof-consuming keepers) and the per-field writer set (escrow ledger, sequence counters, receipts) **without** reading whole modules.
- Open an individual source symbol (one packet handler / one keeper method / one proof-verify call site) ON-DEMAND only when a graph artifact flags it — never read an entire `ibc/` or `x/<app>` tree or a multi-thousand-line file in one go.
- If a needed symbol is not in the graph artifacts, grep for the specific identifier (`OnRecvPacket`, `VerifyMembership`, `GetEscrowAddress`, `nextSequenceRecv`) and read only the matched span plus a few lines of context.
- Write enumerations (packet-handler set, proof-verify call sites, escrow paths) to small scratchpad notes; do not hold whole files in context.

## Output schema

- **Layer**: external (Sections 1, 4) / consensus (Sections 2, 3, 5)
- **Bug class**: proof-gap / channel-sequence / escrow-desync / version-downgrade / handler-reentrancy
- **Finding prefix**: `[IBC-N]`
- **Preferred evidence tags**: `[FUZZ-PASS]` (proptest / Go fuzz on the packet handler or proof verifier) > `[NON-DET-PASS]` (replay differential) > `[CODE-TRACE]`
- **Severity baseline**: Medium; upgrade to High/Critical for proof bypass / forged-value acceptance (Section 1), fund loss (Section 3), or chain halt; see `docs/l1-mode/severity-matrix.md`

## Known bug exemplars

> Illustrative bug CLASSES only — methodology finds these generically, the names are public-incident exemplars, not protocol targets.

1. **ICS-23 / Merkle proof-gap class (Dragonberry-class)** — a membership/non-membership proof check that verifies against the wrong path/prefix, omits the emitter/source binding, or substitutes membership for non-membership, so a forged cross-chain value passes verification. **Catch point**: Section 1.
2. **IAVL range-proof class** — a range / non-existence proof over an ordered store that does not bind the queried key to the proven gap (left/right neighbor mismatch), letting an absent key appear present or vice versa. **Catch point**: Section 1 (non-membership / proof-type correctness).
3. **Ordered-channel sequence-gap class** — an ORDERED-channel recv path that does not enforce contiguous monotonic `nextSequenceRecv`, allowing packets to be skipped or reordered. **Catch point**: Section 2.
4. **Escrow overburn / desync class** — a transfer-app burn/refund path that does not guard `burnAmt <= escrowBal` or double-refunds on both timeout and failed-ack, draining or destroying escrowed funds. **Catch point**: Section 3.
5. **Handler reenter-before-flush class** — a timeout/ack handler that calls an external callback or sends to a user-controlled address before clearing the packet commitment / refund flag, enabling a double-refund re-entrancy window. **Catch point**: Section 5.

## Fallback

If the SCIP graph artifacts are unavailable or incomplete:
- List `ibc/**/*.go`, `x/*/ibc_module.go`, `x/*/keeper/*.go`, and any `02-client` / `04-channel` / `23-commitment` paths.
- Grep for packet handlers: `func.*OnRecvPacket`, `func.*OnAcknowledgementPacket`, `func.*OnTimeoutPacket`, `func.*OnChanOpen`.
- Grep for proof verification: `VerifyMembership`, `VerifyNonMembership`, `VerifyProof`, `MerklePath`, `GetCommitmentPrefix`.
- Grep for sequence / receipt bookkeeping: `nextSequenceRecv`, `SetPacketReceipt`, `GetPacketReceipt`, `channeltypes.ORDERED`.
- Grep for escrow accounting: `GetEscrowAddress`, `MintCoins`, `BurnCoins`, `TotalEscrowForDenom`.
- Grep for version negotiation: `OnChanOpenInit`, `channeltypes.Version`, `ValidateChannelParams`, `MsgUpdateClient`.

## Cross-references

- Related: `cosmos-sdk-module-safety` (Cosmos-SDK / CometBFT module entry-point authority, signer mismatch, ABCI panic-safety around proof inputs), `light-client-proof-verification` (general ICS-23 / Merkle proof soundness across all L1 targets).
- Consumed by: `depth-consensus-invariant`, `depth-external`
- Severity: `docs/l1-mode/severity-matrix.md`
