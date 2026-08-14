---
name: "p2p-dos-and-eclipse"
description: "L1 trigger - audits peer-to-peer networking for DoS vectors (resource exhaustion, amplification), eclipse attack susceptibility, and discovery table poisoning (Kademlia/devp2p)."
---

# Injectable Skill: P2P DoS and Eclipse Attacks

> **L1 trigger**: `L1_PATTERN=true` AND (`p2p/` OR `network/` OR `discovery/` OR `libp2p` OR `devp2p` OR `enr` OR `discv5` detected in recon subsystem map)
> **Inject Into**: `depth-network-surface`
> **Language**: Go and Rust
> **Finding prefix**: `[P2P-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Sections 1, 2: depth-network-surface (attack surface + DoS)
- Section 3: depth-state-trace (peer table state)
- Section 4: depth-edge-case (boundary/adversarial peer states)

## When This Skill Activates

Recon identifies a P2P subsystem. Most attacks in this class are out-of-scope for typical bounty programs but are **in scope for Plamen audits** — firms like Sigma Prime and OpenZeppelin explicitly cover them. Severity downgrades to Low/Info when the exploit only eclipses a single node (see severity-matrix.md); upgrades when reachable by arbitrary peers and amplifies across the network.

## 1. Attack Surface Enumeration (Entry Points)

Every P2P subsystem has a finite set of entry points for remote adversary bytes. Enumerate them using LSP `workspace/symbol` and ast-grep:

| Entry point type | How to find | Example functions |
|---|---|---|
| **Message handlers** | Trait/interface impl names ending in `Handler`, `Service`, `Listener` | `handleGetBlockHeaders`, `on_new_pooled_transaction_hashes` |
| **Decoders** | Functions taking `&[u8]` or `Reader` and returning protocol types | `decode_enr`, `rlp_decode` |
| **Connection accepters** | TCP/QUIC listener accept loops | `acceptLoop`, `handle_connection` |
| **Discovery responders** | UDP packet handlers for discovery protocol | `handleDiscv5Packet`, `process_find_node` |
| **Gossip handlers** | Pubsub topic subscribers | `process_gossip_message` |

Write the enumeration into `scratchpad/p2p_surface.md` before proceeding.

## 2. DoS Classes to Check per Entry Point

### 2a. Asymmetric processing cost
Attacker sends N bytes, node does O(N²) or O(N*log(N)) work. Classic example: decompression bombs, hash-map insertion of attacker-chosen keys (hash DoS), large RLP lists.

**Check**:
- For each decoder, is there a **max size limit** before parsing begins?
- For each list/vector field, is there a **max element count** enforced?
- For each recursive decoder, is there a **max recursion depth**?
- For each hash-map insert of attacker-controlled data, is the map key pre-hashed or is a SipHash-random-keyed map used?

Tag: `[P2P-ASYMMETRIC:{loc}:{input-size}→{work-cost}]`

### 2b. Unbounded memory growth
Handlers that buffer or queue indefinitely.

**Check**:
- Every channel/queue: does it have a bounded capacity? What happens on overflow — block, drop, or OOM?
- Every `append` / `Vec::push` in a loop that can be driven by adversary: is there a bound?
- Every peer-keyed map (peer → state): is there an eviction policy when size > threshold?

Tag: `[P2P-UNBOUNDED:{structure}:{growth-driver}]`

### 2c. Unbounded CPU: infinite loops or pathological inputs
Handlers that can loop forever or spend minutes on malicious input.

**Check**:
- Every `for` loop in a handler: what bounds termination? Attacker-controlled?
- Regex with catastrophic backtracking (if any regex is used on peer input)
- Crypto operations on unvalidated length inputs

Tag: `[P2P-CPU:{loc}:{termination-condition}]`

### 2d. Connection slot exhaustion
Attacker opens N connections with M peers, filling the connection table.

**Check**:
- What is the max inbound connection limit? (Geth: 50, Bitcoin: 125)
- Is there a per-IP limit? Per-/24-subnet limit? Per-ASN limit?
- How long can a half-open (TCP SYN + no handshake) connection hold a slot?
- Does the node prioritize connections from diverse IP ranges?
- **Outbound bootstrap handshake cap**: when a joining node receives a peer list from a bootnode, does it cap the number of addresses it attempts to handshake in parallel? Without a cap, a malicious bootnode (or a peer-list response with N>>peer-table-size) forces the joiner to exhaust file descriptors / memory / connection slots during startup. Verify both the per-bootstrap response cap AND the in-flight handshake concurrency limit.

Tag: `[P2P-SLOTS:{limit}:{diversification}]`, `[P2P-BOOTSTRAP-FLOOD:{cap-or-unbounded}]`

### 2e. Amplification
Attacker sends small message, node sends large response — used to DDoS third parties.

**Check**:
- For every request-response pair, compare input size vs output size
- Discovery protocols (UDP) are especially dangerous — no handshake, easy spoofing
- Is source-address validation (rate-limited ENR responses, etc.) in place?

Tag: `[P2P-AMPLIFY:{request-bytes}→{response-bytes}]`

### 2g. Re-gossip dedup discipline (echo-chamber amplification)

For each gossip handler that RECEIVES data and then FORWARDS it to other peers (re-gossip), trace the dedup path. This is a separate concern from 2a (single-message cost) — it covers network-multiplication attacks.

**Check**:
- Is there a "recent-seen" or "recent-valid" cache that BLOCKS re-broadcast on duplicates?
- Is the cache check BEFORE the broadcast spawn / `.send()` call, not after?
- Is the cache key the message hash (not the message contents, which an attacker can mutate while preserving semantics)?
- Is the cache populated AFTER signature/validity verification, not before? Recording-as-seen pre-verification creates a "seen-cache poisoning" primitive: an attacker injects an invalid item with a valid ID, the cache records it, the legitimate version from honest peers is then dropped as "already seen".
- For each handler, walk the order of operations: `verify_signature` → `record_seen` → `broadcast`. Any other order is a finding.

**Fail mode**: an N-peer network re-gossips each message O(N²) times, saturating bandwidth in an "echo chamber" pattern. NEAR / Tendermint / Geth have all had variants of this bug. Combined with seen-cache poisoning, an attacker can both flood the network AND censor legitimate items.

Tag: `[P2P-AMPLIFY:re-gossip-dedup:{file}:{line}]` and `[P2P-CACHE-POISON:record-before-verify:{file}:{line}]`

### 2h. Sequential broadcast vs parallel broadcast

Many P2P implementations naively use `for peer in active_peers { client.send(peer, msg).await; }` to broadcast. Each peer's response time blocks the next. A single slow peer (intentional or not) delays the entire broadcast cycle.

**Check**:
- For each broadcast loop, identify whether peers are processed sequentially with `.await` or in parallel with `tokio::join_all` / `FuturesUnordered` / `select!`.
- For sequential broadcast loops, calculate worst-case wall-clock: `peer_count × per-peer-timeout`. If this exceeds block time, propagation is broken under adversarial peer growth.
- Cap the total broadcast peer count to a constant (e.g., 200 randomly sampled peers); rely on gossip amplification for full propagation.

Tag: `[P2P-CPU:sequential-broadcast:{loc}]`

## 3. Eclipse Attack Vectors

An eclipse attack isolates a target node by monopolizing its peer table entries.

### 3a. Peer table structure
- Identify the peer table data structure (Kademlia k-buckets, flat table, discovery v5 ENR table)
- For each bucket, what is the k value and eviction policy?
- Is peer selection **stratified by IP/ASN diversity**, or purely by XOR distance?

### 3b. Peer ID generation cost
- How expensive is it to produce a peer ID that lands in a target bucket?
- Ethereum discovery v5: node ID = hash(public key). Generating thousands of node IDs is cheap.
- Some protocols require proof-of-work for peer IDs; most don't.
- Is there a rate limit on accepting new peer announcements?

### 3c. Bootstrap / rejoin vulnerability
On restart, the node uses a static bootstrap list, then populates its peer table from responses. If an attacker can intercept or outrun the bootstrap response, they control the initial peer set.

**Check**: What bootnodes are used? Are they hardcoded or configurable? What happens if all bootnodes are unreachable?

### 3d. ENR/record poisoning
Discovery v5 uses signed ENRs. Can an attacker poison a victim's ENR cache with malicious entries?

**Check**: ENR signature verification on every incoming record. ENR seqnum monotonic update.

Tag: `[ECLIPSE:{vector}:{countermeasure-state}]`

**Known exemplar class**: devp2p issue #109 (Ethereum discv5 eclipse concerns); academic low-resource eclipse attacks on older Geth.

## 4. Peer Scoring and Banning

Most clients have a peer scoring system: peers that misbehave (send invalid data, stall, equivocate) accumulate negative score and get banned.

### Patterns to flag
- **Integer overflow in score**: if score is `i32`, repeatedly adding -MAX causes wrap. Geth has historically had integer-overflow issues in peer scoring.
- **Permanent ban on transient fault**: banning on a single protocol error can be exploited to deny service to honest peers via spoofed errors
- **Asymmetric scoring**: does good behavior recover lost score? If not, a single bad day permanently bans a good peer
- **Scoring based on attacker-controlled timing**: if score updates on every packet and attacker can drive packet rate, scoring becomes attacker-controlled

Tag: `[P2P-SCORE:{vulnerability-class}]`

## 5. Gossip / Pubsub

If the protocol uses gossipsub or similar pubsub:

- **Message deduplication**: is there a seen-cache? How large? What TTL? Can it be exhausted?
- **Topic validation**: are topic names validated before subscribing? Can an attacker force the node to subscribe to an expensive topic?
- **Mesh sizing**: mesh degree (D, D_low, D_high) — are these enforced? Can an attacker manipulate mesh composition?
- **Message size**: max message size in the pubsub layer vs the application layer — mismatch is a DoS vector

Tag: `[GOSSIP:{param}:{value-or-unbounded}]`

## 6. Output schema

- **Layer**: network
- **Bug class**: asymmetric-cost / unbounded-resource / slot-exhaustion / amplification / eclipse / peer-score / gossip
- **Preferred evidence tags**: `[FUZZ-PASS]` (D2PFuzz or libfuzzer on decoder) > `[LSP-TRACE]` > `[CODE-TRACE]`
- **Severity baseline**: Medium by default; upgrade to High if network-wide amplification; downgrade to Low/Info if single-node eclipse only

## 7. Known bug exemplars (v0.2 — Round 4 verified)

1. **NEAR `Signature::verify` pre-auth handshake panic (December 2023)** — **$150,000 bounty**. In SECP256K1 branch of `Signature::verify()`, `Message::from_slice(data).expect("32 bytes")` panics when payload > 32 bytes; `RecoveryId::from_i32().unwrap()` panics on recovery byte > 3. **A single crafted Tier1Handshake/Tier2Handshake message kills any node.** Pre-auth = any peer can do it. Fixed PR #10385 (commit `e0f0da5c3dde29122e956dfd905811890de9a570`). [Zellic Web3 Ping of Death](https://www.zellic.io/blog/near-protocol-bug/). **Skill catch point**: pre-auth panic check — for every handshake / pre-auth message handler, trace every `.unwrap()`, `.expect()`, `panic!()`, slice index, conversion. Assert graceful error return for all input classes.

2. **Marcus-Heilman low-resource Ethereum eclipse (2018)** — Geth's Kademlia discovery table could be monopolized by an attacker with only 2 IPs. Fixed in geth 1.8 (Feb 2018). [Low-Resource Eclipse Attacks on Ethereum](https://eprint.iacr.org/2018/236.pdf). **Skill catch point**: Section 3a — bucket eviction policy, IP/ASN stratification, rate-limit on new peer announcements.

3. **D2PFuzz differential p2p bugs across 5 clients (IEEE 2025)** — network-layer differential fuzzer found **15 unique bugs, 12 previously unknown** by mutating DevP2P messages and diffing responses across geth, erigon, reth, besu, nethermind. [Network-Layer Differential Fuzzing for Ethereum](https://www.researchgate.net/publication/399104426_Network-Layer_Differential_Fuzzing_for_Ethereum). **Skill catch point**: Section 1 — enumerate every DevP2P message type; verify response semantics against spec for valid / malformed / boundary / timing inputs; compare against ≥2 other client responses.

4. **Henningsen "false friends" Ethereum eclipse (2019)** — follow-up to Marcus-Heilman. Geth's peer-eviction policy could be gamed with valid-looking false-friend nodes. [Eclipsing Ethereum Peers with False Friends](https://arxiv.org/pdf/1908.10141). **Skill catch point**: Section 4 — audit peer scoring for monotonicity; new peers from unknown sources must not displace established trusted peers.

5. **Geth CVE-2025-24883 RLPx handshake crash** — all-zero secp256k1 public key accepted without subgroup validation. Single malicious peer crashes any node. [GHSA-q26p-9cq4-7fc2](https://github.com/ethereum/go-ethereum/security/advisories/GHSA-q26p-9cq4-7fc2). **Skill catch point**: cryptographic handshake inputs must be validated as on-curve AND in-subgroup BEFORE any math operation. (Shared with `bls-aggregation-audit` Section 2.)

### Critical methodology addition from Round 4 (pre-auth panic = single-packet node kill)

**Insert as new Section 2f (highest priority)**: **Pre-auth message handlers are the hottest P2P surface.** Every panic in a pre-auth path is a single-packet node-kill primitive. Methodology:

- List every message handler reachable before authentication/handshake completion
- For each, ast-grep or manual-read: `.unwrap()`, `.expect(`, `panic!(`, slice indexing `[i]`, type assertion `.(T)` without `ok`, `unreachable!()`, integer division
- Every one of these is a finding until proven bounded (e.g., a length check earlier in the call chain)

Tag: `[P2P-PANIC-PREAUTH:{handler}:{panic-site}]`

## 2i. Peer Scoring Symmetry Audit

Peer scoring only works if rewards AND penalties are both applied. A one-sided system lets malicious peers farm reputation without consequence. This section forces enumeration.

**Required artifact**: write `{SCRATCHPAD}/peer_scoring_symmetry.md`:

```markdown
# Peer Scoring Symmetry: {protocol_name}

| Event | Reward path | Penalty path | Symmetric? |
|---|---|---|---|
| Successful block delivery | score.rs:L42 +1 | — | **ASYMMETRIC** |
| Invalid block response | — | score.rs:L78 -5 | OK |
| Health check failure | — | — | **MISSING** |
| /get_data served | +1 | — | **FARMABLE** |
```

**Methodology**:
1. Find the peer scoring module (`peer_score`, `reputation`, `scoring`).
2. Enumerate EVERY event type the scoring system knows about — extract from the enum/struct mapping events to score deltas, not from memory.
3. For each event, find BOTH reward and penalty paths. Missing either → **ASYMMETRIC** finding.
4. `check_health` specifically: does it decrement on HTTP errors / timeouts, or only on explicit `Ok(false)`? A no-op on failure is a finding.
5. Verify failure-class coverage: "only InvalidData triggers penalty" while "BlockPool" or other validation failures are silent → finding.
6. Data request endpoints (`/get_data`, `request_blocks`): if the success path increments score with no rate limit or deduplication → **FARMABLE** finding.
7. Asymmetric scoring is always at least Medium severity.

Tag: `[PEER-SCORE-ASYMMETRIC:{event}]`, `[PEER-SCORE-FARMABLE:{event}]`, `[PEER-SCORE-NO-PENALTY:{failure_class}]`

## 8. Fallback if primitives unavailable

- List files under `p2p/` and `discovery/`
- Grep for `handleRLP`, `decode_rlp`, `handle_message` function definitions
- Check for explicit size limits: grep `MaxSize`, `MAX_`, `limit`
- Read the bootstrap node list

## Cross-references

- Related: `mempool-asymmetric-dos`, `consensus-safety-invariants` (equivocation detection interacts with peer scoring)
- Consumed by: `depth-network-surface`
- Severity: `docs/l1-mode/severity-matrix.md`
