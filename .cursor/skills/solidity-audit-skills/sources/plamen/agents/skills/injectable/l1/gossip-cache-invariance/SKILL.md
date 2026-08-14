---
name: "gossip-cache-invariance"
description: "L1 trigger - audits message and seen caches for write-after-validate ordering, eviction safety, and duplicate handling."
---

# Injectable Skill: Gossip Cache Invariance

> **L1 trigger**: `P2P` flag AND (`seen_cache`, `message_cache`, `tx_cache`, `gossipsub`, `pubsub`, `dedup`, `seen_chunks` detected)
> **Inject Into**: `depth-network-surface`, `depth-consensus-invariant`
> **Language**: Go and Rust
> **Finding prefix**: `[GCI-N]`

## 1. Write-After-Validate

For each attacker-controlled cache key, prove the ordering between cache write
and integrity/authenticity validation. Cache insertion before validation is a
poisoning primitive.

Tag: `[GOSSIP-CACHE:ORDER]`

## 2. Duplicate Handling

Check whether duplicate suppression is keyed on canonical content, the right
topic/partition, and enough sender identity. Look for cases where legitimate
messages are suppressed or malicious messages can be replayed after eviction.

Tag: `[GOSSIP-CACHE:DUPLICATES]`

## 3. Eviction Invariants

Under burst traffic or memory pressure:

- what gets evicted first?
- can attacker traffic evict honest messages before processing?
- can eviction reopen a previously rejected malicious message?

Tag: `[GOSSIP-CACHE:EVICTION]`

## 4. Cache Key Soundness

Verify the key includes the right tuple of topic / partition / chain / message
identity. Flag collisions where distinct messages alias to the same cache key.

Tag: `[GOSSIP-CACHE:KEY]`

## 5. Broken Safety Property

State the resulting invariant failure explicitly:

- valid message can be suppressed
- invalid message can block later valid message
- message can be processed repeatedly
- attacker can force honest work without progress

## 6. Cache-miss amplification

For each receive-and-rebroadcast path:

1. Does the handler consult a seen/validated cache before re-broadcast?
2. Is the cache key canonical, or can the attacker create many distinct IDs
   for effectively the same payload?
3. If the cache misses, does one inbound message cause fan-out to many peers?

If a cache miss multiplies traffic or work across peers, record it as an
amplification finding rather than a simple duplicate-handling bug.

Tag: `[GOSSIP-CACHE:AMPLIFICATION]`

## 7. Partition-poisoning under re-org

When a chunk / block / attestation cache is indexed by a property derived
from the canonical chain (slot, epoch, partition id, shard id), a reorg
can move the canonical chain underneath entries that are no longer valid
for the new chain but still satisfy the cache key.

Check:

1. When the canonical head changes, is the cache invalidated, re-keyed,
   or left stale?
2. Can an attacker deliberately produce two competing valid branches so
   that a later honest reader hits a poisoned cache entry from the
   non-canonical branch?
3. For storage / DA gossip: is the `{piece_id, partition_id}` tuple the
   full cache key, or is partition_id inferred from head and therefore
   mutable? If inferred, a reorg silently re-labels cached pieces.
4. For mempool / tx gossip: does the seen cache survive a reorg that
   re-opens a tx that was previously mined? If yes, the tx is permanently
   un-gossipable after the reorg — a targeted censorship primitive.
5. For fork-choice attestation caches: after a reorg, do previously-seen
   attestations still count toward weight in the new branch? If yes, the
   weight is double-counted; if no, honest votes are lost.

Tag: `[GOSSIP-CACHE:REORG-POISON:{cache}:{scenario}]`. Severity defaults
to High when the cache influences consensus weight or censors a legitimate
message class; Medium when it only amplifies work.
