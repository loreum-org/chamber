---
name: "bls-aggregation-audit"
description: "L1 trigger - audits BLS signature aggregation: subgroup check, rogue-key attack defense, aggregation order, signing-domain separation."
---

# Injectable Skill: BLS Aggregation Audit

> **L1 trigger**: `L1_PATTERN=true` AND (`bls/` OR `blst` OR `milagro` OR `pairing` OR `aggregate_signature` OR `proof_of_possession` detected in recon subsystem map)
> **Inject Into**: `depth-consensus-invariant` or `depth-external`
> **Language**: Go, Rust, occasionally C
> **Finding prefix**: `[BLS-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Sections 1, 2: depth-consensus-invariant (protocol-level BLS use)
- Section 3: depth-external (library interface, FFI)
- Section 4: depth-edge-case (boundary inputs)

## When This Skill Activates

Recon identifies BLS12-381 signature use, typically in: Ethereum beacon chain, Filecoin, Celo, Chia, Aptos, or any aggregated-signature consensus. BLS is subtle: textbook descriptions assume defenses (subgroup check, rogue-key defense) that implementations often forget.

## 1. Library Fingerprinting

Identify the BLS library:

| Library | Language | Canonical use |
|---|---|---|
| `blst` | C with Go/Rust bindings | Lighthouse, Prysm, Teku |
| `milagro-crypto` | C | Older clients |
| `arkworks` | Rust | Aptos, some academic |
| `celo-bls-zexe` | Rust | Celo |
| `py_ecc` | Python | Reference implementations |
| hand-rolled pairing | Various | Red flag — usually wrong |

A hand-rolled pairing implementation is a near-certain bug source. Flag it for intensive review.

## 2. Subgroup Check

BLS signatures live in a subgroup of an elliptic curve group. An attacker can provide a curve point that is valid on the curve but outside the subgroup, leading to signature verification forgeries.

**Check**:
- Is every **received** signature / public key checked for subgroup membership before use?
- In `blst`, the function is `blst_p1_in_g1` / `blst_p2_in_g2`
- In `arkworks`, there are `is_in_correct_subgroup_assuming_on_curve` helpers
- Protocol-level: when a signature is received from a peer, is subgroup-checked BEFORE aggregation with trusted signatures?
- Aggregation without subgroup check: combining a valid sig with a subgroup-invalid sig can corrupt the aggregate

Tag: `[BLS-SUBGROUP:{loc}:{checked}]`

**Known exemplar class**: the `blst` library had a historical subgroup-check advisory; check upgrade logs.

## 3. Rogue-Key Attack (Proof of Possession)

Rogue-key attack: attacker registers a public key that is the difference of a target's key and the attacker's, then signs a message that verifies as signed by both.

**Defenses**:
- **Proof of Possession (PoP)**: requires each public key to come with a self-signature of the key. Ethereum beacon chain uses this.
- **Hash-to-point including signer**: if the message hash includes the signer's public key, rogue-key is defeated

**Check**:
- For every public key registration / deposit path, is PoP verified?
- Is PoP using a distinct domain separator from normal signatures? (Required — otherwise PoP can be forged from a normal sig.)

Tag: `[BLS-ROGUE-KEY:{defense}:{status}]`

## 4. Signing Domain Separation

BLS signatures must include a **domain tag** in the hash-to-point step. This prevents a signature from one protocol being replayed in another.

**Check**:
- List all message types signed (attestation, proposal, slashing, sync committee, PoP, ...)
- Each must have a distinct domain tag
- Domain tags must be **hardcoded constants**, not computed from user input
- Domain tags must be consistent across client implementations

Tag: `[BLS-DOMAIN:{message-type}:{tag}]`

## 5. Aggregation Correctness

### 5a. Aggregation algebra
- Sum of signatures = signature of sum (for BLS). Implementation must use curve addition correctly.
- Aggregation of zero signatures is the identity element. Is this handled? Some libraries crash.
- Aggregation of signatures on different messages requires a different verification formula (individual verification, not batch).

### 5b. Order independence
Signature aggregation must be commutative. If the verification result depends on insertion order, that's a bug (and a non-determinism source).

### 5c. Duplicate handling
If the same signature is aggregated twice, the result doubles. Is this intended? In beacon chain, double-counting an attestation is a slashing condition.

**Check**: Does the aggregation code deduplicate? Does it track which validators have already contributed?

Tag: `[BLS-AGG:{issue}]`

## 6. Hash-to-Curve

The hash-to-curve step (RFC 9380) has multiple valid implementations with subtle differences. Inconsistency across clients is a consensus bug.

**Check**:
- Which hash-to-curve variant is used? SSWU? Icart?
- Is the DST (domain separation tag) exactly as specified in the protocol?
- Is cofactor clearing applied?

## 7. FFI Safety

Most BLS libraries are C (blst). Calling C from Go or Rust via FFI is a common bug source:

**Check**:
- Every `unsafe` block around blst calls: is the pointer valid? Length correct?
- Are buffers properly sized for blst's output?
- Are errors from blst propagated, or silently ignored?
- Is the calling convention correct? (blst's go bindings vs raw cgo)

Tag: `[BLS-FFI:{issue}]`

## 8. Boundary conditions

| State | Test | Expected | Observed |
|---|---|---|---|
| Zero signature | identity-like bytes | spec-defined rejection | |
| Zero public key | identity-like bytes | rejected | |
| Subgroup-invalid sig | on-curve but wrong subgroup | rejected | |
| Empty aggregation | aggregate of zero sigs | identity or error | |
| Duplicate in aggregate | same sig twice | spec-defined | |
| Max validator aggregation | aggregate of all validators | no integer overflow in count | |
| Domain tag swap | attestation sig used as proposal sig | rejected | |

## 9. Output schema

- **Layer**: crypto
- **Bug class**: subgroup / rogue-key / domain-sep / aggregation / hash-to-curve / ffi-safety
- **Preferred evidence tags**: `[CONFORMANCE-PASS]` (test vectors) > `[DIFF-PASS]` (against reference) > `[LSP-TRACE]`
- **Severity baseline**: Critical for subgroup/rogue-key; High for domain-sep; Medium for aggregation boundary

## 10. Known bug exemplars (v0.2 — Round 4 verified)

1. **Eth2 subgroup-check requirement (milagro_bls / blst)** — pairing operation is undefined on points outside the prime-order subgroup of G1/G2. Omitting subgroup check breaks strong unforgeability. Eth2 specs explicitly mandate the check for signatures during verification and public keys during deserialization — because early implementations routinely forgot. [eth2book BLS chapter](https://eth2book.info/latest/part2/building_blocks/signatures/); [milagro_bls](https://github.com/sigp/milagro_bls). **Skill catch point**: Section 2 — the #1 real-world BLS bug class.

2. **BLS rogue-key attack (class-wide)** — if attacker publishes `pk_attack = pk_hash_of_honest_sigs − pk_honest`, they can unilaterally produce valid "aggregate" signatures without cooperation. Mitigated by Proof-of-Possession at registration OR by message-augmentation (MsgAug scheme from BLS IETF draft). [Rogue Key Attack writeup](https://medium.com/@coolcottontail/rogue-key-attack-in-bls-signature-and-harmony-security-eac1ea2370ee); [IETF BLS draft](https://www.ietf.org/archive/id/draft-irtf-cfrg-bls-signature-05.html). **Skill catch point**: Section 3 — the #2 real-world BLS bug class.

3. **Aumasson Eth2 beacon client security review (35+ issues)** — comprehensive security review of early beacon chain implementations. Found multiple subgroup check omissions, domain separation misconfigurations, and aggregation-order assumptions. [Security Review of Ethereum Beacon Clients](https://www.aumasson.jp/data/papers/eth2sec.pdf). **Skill catch point**: methodology is lifted from this review — the skill is essentially a distillation of the review's checklist.

4. **Avalanche RFC6979 nonce-determinism disputed report (coingeek, 2022)** — ava-labs/avalanchego used a Decred library for RFC6979 deterministic signing; researcher James Edwards reported private-key-forgery concerns (disputed by Ava Labs). Whether or not the specific claim holds, the class is real. [coingeek report](https://coingeek.com/researcher-publishes-ava-labs-avalanche-zero-day-vulnerability-says-entire-protocol-compromised/). **Skill catch point**: Section 7 (FFI safety) + dependency-audit — audit the full signing-library dependency chain, check CVE history, verify deterministic-nonce generation doesn't leak secret bits.

### Methodology nuance from Round 4 (subgroup + rogue-key are the #1 and #2 real classes)

**Reorder Sections 2 and 3 to reflect priority**: subgroup check omission and rogue-key are the two most common real-world BLS failures. Every BLS verifier audit should START with these two checks, not end with them.

## 11. Fallback if primitives unavailable

- Find BLS library import: `import "github.com/supranational/blst"` or similar
- Read every call site
- Check every signature-verification function for subgroup check presence
- Grep for `DOMAIN_SEPARATION`, `DOMAIN_`, `DST`

## Cross-references

- Related: `consensus-safety-invariants` (fork-choice uses aggregated attestations), `light-client-proof-verification` (validator set signing)
- Consumed by: `depth-consensus-invariant`, `depth-external`
- Severity: `docs/l1-mode/severity-matrix.md`
