---
name: "light-client-proof-verification"
description: "L1 trigger - audits light client and cross-chain proof verification: Merkle proof soundness, ICS-23 subkey handling (Dragonberry class), state root checks, message integrity."
---

# Injectable Skill: Light Client Proof Verification

> **L1 trigger**: `L1_PATTERN=true` AND (`light_client/` OR `ics23/` OR `merkle/` OR `proof/` OR `verify_proof` OR `verify_root` OR `validate_path` OR `merkle_tree` OR `state_root` OR `trie_proof` OR `ibc/` OR `beacon-api-client/` detected in recon subsystem map)
> **Inject Into**: `depth-consensus-invariant` or `depth-external`
> **Language**: Go and Rust
> **Finding prefix**: `[LC-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Sections 1, 2: depth-consensus-invariant (proof soundness)
- Section 3: depth-external (cross-chain assumptions)
- Section 4: depth-edge-case (boundary + adversarial inputs)

## When This Skill Activates

Recon identifies light-client or cross-chain proof verification code. This skill is the most consequential for cross-chain bridges and IBC-adjacent code because a proof-verification bug can allow forged state to be accepted as canonical — the Dragonberry class.

## 1. Proof Format Fingerprinting

Identify the exact proof format used:

| Format | Identifier | Notable pitfalls |
|---|---|---|
| **Merkle-Patricia Trie (MPT)** | Ethereum state proofs, `eth_getProof` | RLP decode edge cases; extension/branch collision |
| **IAVL+** | Cosmos SDK `x/store` | Left-right ordering; ICS-23 subkey encoding |
| **Sparse Merkle Tree (SMT)** | Aptos, Sui, Celestia | Empty-leaf handling; default hash values |
| **Verkle** | Future Ethereum | KZG commitment; opening soundness |
| **SSZ proofs** | Ethereum Beacon chain | Generalized index encoding |
| **ICS-23** | IBC light clients | Generic proof spec; multiple backends |

Write the format into the finding header.

## 2. Soundness Checks Per Format

### 2a. Merkle-Patricia Trie (Ethereum state proof)
- **RLP decode strictness**: does the decoder reject non-canonical RLP encodings? Leading zeros, empty-byte integers, overlong encodings?
- **Hash pre-image check**: the proof path hashes must chain correctly from leaf to root
- **Key encoding**: the MPT key is nibbled (4-bit). Off-by-one in nibble-decoding is a classic bug class.
- **Leaf vs extension vs branch disambiguation**: node type encoded in first byte of value; must be checked before use

Tag: `[MPT:{defect}]`

### 2b. IAVL+ and ICS-23 (Cosmos)
- **Subkey handling**: an ICS-23 `NonExistenceProof` needs the left+right neighbors. **Dragonberry root cause**: the check did not forbid the subkey from being a prefix of a real key, allowing forgery.
- **Left/right monotonicity**: in a non-existence proof, left key < query < right key must be strictly enforced
- **Leaf-op vs inner-op ordering**: ICS-23 specs the op order; a decoder that accepts reordered ops is vulnerable
- **Root hash binding**: the proof root must match the block's state root, not just any known root

Tag: `[ICS23:{defect}]`

**Known exemplar**: Cosmos SDK Dragonberry (Oct 2022) — [Verichains writeup](https://blog.verichains.io/p/vsa-2022-103-cosmos-sdk-forging-membership). Subkey suffix forgery allowed forged membership proofs. Patched in Cosmos SDK 0.45.9 / 0.46.3.

### 2c. Sparse Merkle Tree
- **Default hash**: empty leaves hash to a specific value. Is this enforced? Can an attacker supply a different "empty" value?
- **Bit-walk correctness**: key bits index into left/right children. Off-by-one at the last bit is a known bug class.

### 2d. SSZ / Generalized indices
- **GIndex arithmetic**: the generalized index encodes tree position. Incorrect arithmetic accepts proofs for the wrong leaf.
- **Multi-proof batch**: verify each leaf independently does not skip any intermediate node

### 2f. Binary Merkle path primitives (`validate_path`, `validate_chunk`)

For custom Merkle helpers, do not stop at "hashes are recomputed." Build a
field-by-field proof-soundness table:

| Check | Required invariant | Evidence |
|---|---|---|
| Leaf binding | The supplied leaf/value hash is compared to the target leaf, not only folded into a path | |
| Target offset | `target_offset` / index selects the left-right walk and is range-checked | |
| Proof length | number of siblings equals expected tree depth, or the verifier rejects | |
| Operator correctness | all acceptance conditions use the intended boolean connective (`&&` vs `||`) | |
| Root binding | final computed root equals the trusted root for the same block/header/context | |
| Empty/singleton tree | zero-node and one-node cases are explicitly defined | |

Mandatory procedure:

1. Locate every `validate_path`, `verify_path`, `validate_chunk`,
   `verify_chunk`, `calculate_root`, and `hash_leaf` function.
2. For each verifier, write the exact predicate that returns `true`.
3. Try these adversarial proofs: wrong leaf with valid sibling path, correct
   leaf with too-short proof, proof for adjacent `target_offset`, empty proof,
   and a proof where only one side of a compound condition holds.
4. If the verifier accepts any case where the leaf, path length, offset, or
   root is not bound, emit a finding even if another caller performs a partial
   check. The primitive itself is load-bearing.

Tag: `[MERKLE-PATH:{leaf|length|offset|operator|root}]`

## 3. Root Binding

The proof is only as good as the root it verifies against.

1. Where does the verified root come from? Block header? Light-client state? Trusted setup?
2. Is the root **freshness** bounded? A stale root can be used to verify a stale state; a recent root cannot prove historical state
3. For cross-chain proofs: the root is provided by a validator signature (Tendermint) or a fraud-proof challenge (optimistic rollup). What's the trust model?
4. **Replay**: can the same proof be replayed against a different root to deceive a different chain?

Tag: `[ROOT-BIND:{source}:{freshness-bound}]`

## 4. Cross-Chain Message Integrity

For protocols that accept cross-chain messages (IBC, LayerZero, Wormhole, CCIP):

1. **Source chain identifier**: is the sender chain ID part of the signed payload? Replay across chains possible if not.
2. **Destination chain identifier**: is the destination included? Or is a message from chain A to B replayable as A to C?
3. **Nonce / sequence**: is every message nonce unique and monotonic?
4. **Channel binding**: is the message bound to a specific channel/port/endpoint?
5. **Timeout**: is there a timeout after which the message is rejected?

Tag: `[X-CHAIN-MSG:{binding}:{gap}]`

## 5. Validator Set Trust

For light clients that track validator sets:

- **Initial trust**: how is the initial validator set established? Genesis? Hardcoded? User-configured?
- **Update frequency**: how often is the validator set updated? How is the update proof verified?
- **Trust period**: after how long is a validator set considered expired?
- **Unbonding period vs trust period**: trust period must be strictly less than the unbonding period, or a slashed validator can still sign a fraudulent proof. **Historical Cosmos vulnerability class.**

Tag: `[VSET-TRUST:{param}:{issue}]`

## 6. Boundary conditions

| State | Test | Expected | Observed |
|---|---|---|---|
| Empty proof | proof with no inner nodes | rejected | |
| Proof for empty key | key = "" | rejected or spec-defined | |
| Proof with root mismatch | correct proof, wrong root | rejected | |
| Proof replay across chains | same proof, different src chain ID | rejected | |
| Stale root | root from N+1 trust periods ago | rejected | |
| Subkey prefix | query is a prefix of a real key | handled per spec (Dragonberry!) | |
| Zero-length value | leaf value is empty | handled per spec | |

## 7. Output schema

- **Layer**: cross-chain / light-client
- **Bug class**: proof-soundness / root-binding / cross-chain-binding / validator-set-trust
- **Preferred evidence tags**: `[CONFORMANCE-PASS]` (test vectors from spec) > `[DIFF-PASS]` (against reference impl) > `[LSP-TRACE]`
- **Severity baseline**: Critical if fund-loss path exists; High for chain-reorg enabler; Medium for information disclosure

## 8. Known bug exemplars (v0.2 — Round 4 verified)

1. **IBC Dragonberry — ICS-23 membership proof forgery (October 2022)** — the ICS-23 spec lacked soundness guarantees for leaf/inner node prefix/suffix length validation. Verichains showed that a malicious user could forge a membership proof and double-spend assets across every IBC-enabled Cosmos chain. [Verichains VSA-2022-103](https://blog.verichains.io/p/vsa-2022-103-cosmos-sdk-forging-membership); [Cosmos forum retrospective](https://forum.cosmos.network/t/ibc-security-advisory-dragonberry/7702). **Adjacent impact**: The BNB Chain bridge lost **>$100M in October 2022** to a nearby IAVL proof verification flaw in a non-maintained library. [Halborn writeup](https://www.halborn.com/blog/post/explained-the-bnb-chain-hack-october-2022). **Skill catch point**: Section 2b — every length field in the proof must be bounds-checked; subkey/partial-key attacks must not bypass the leaf check.

2. **Ghost in the Block — SSZ deserialization ghost regions (September 2024, Asymmetric Research)** — `SignedBeaconBlockDeneb.UnmarshalSSZ` in the `fastssz` library validated that offsets were mutually coherent but did NOT assert contiguity. Attacker could insert 8-byte ghost regions between objects without changing hash-tree-root. Lighthouse correctly rejected with `OffsetSkipsVariableBytes(568)`; Prysm accepted. [Ghost in the Block writeup](https://blog.asymmetric.re/ghost-in-the-block-ethereum-consensus-vulnerability/) (published Sept 19, 2024). **Skill catch point**: new methodology nuance below — **contiguity is not coherence**.

3. **Tendermint lite-client bisection skip-verification safety gap** — bisection is unsafe without counterfactual slashing. A malicious 1/3+ validator set in a skipped interval can forge a header the light client will accept. Mitigated by witness-comparison detector. [tendermint/tendermint #3244](https://github.com/tendermint/tendermint/issues/3244). **Skill catch point**: Section 5 — for skip/jump verification, security depends on slashing-accountability, not honest majority at target height.

4. **Cosmos IBC Dragonberry retrospective (October 2022)** — patched in ibc-go v1.1.5 / v2.0.3 / v3.2.2 + cosmos-sdk 0.45.9 / 0.46.3 after coordinated disclosure. The ICS-23 library consumed by **every** IBC chain had a single shared bug. [Cosmos forum retrospective](https://forum.cosmos.network/t/cosmos-sdk-ibc-vulnerability-retrospective-security-advisories-dragonberry-and-elderflower-october-2022/8735). **Skill catch point**: dependency-audit-nodeclient + light-client intersection; shared crypto libraries create multi-chain blast radius.

### Critical methodology addition from Round 4 (SSZ contiguity + length fields)

**Insert as new Section 2e**: **Contiguity ≠ coherence**. For any structured deserializer with offset fields:

1. Offsets must be strictly increasing (monotonic check)
2. `offset[i+1] == offset[i] + length[i]` for every `i` (**contiguity check**)
3. `total_bytes_consumed == buffer_length` at end of parse (no trailing bytes)
4. No interstitial regions (no offset gap >= 1 byte between consecutive objects)
5. **Differential round-trip**: re-encode the parsed structure and assert the result equals the original bytes. If not, there are multiple encodings of the same semantic object — forgery vector.

For any Merkle proof verifier (regardless of format): **every length field in the proof spec is a structural constraint**. Enumerate all length fields in the proof spec; assert each is bounds-checked.

Tag: `[PROOF-CONTIGUITY:{format}:{field}]`

## 9. Fallback if primitives unavailable

- Locate `VerifyProof`, `verify_membership`, `check_proof` functions
- Read the function step by step
- Cross-reference against the proof spec document

## Cross-references

- Related: `consensus-safety-invariants`, `bls-aggregation-audit` (validator set signing)
- Consumed by: `depth-consensus-invariant`, `depth-external`
- Severity: `docs/l1-mode/severity-matrix.md`
