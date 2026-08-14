---
name: "peer-scoring-correctness"
description: "L1 trigger - audits peer reputation and scoring logic for symmetry, farming resistance, and penalty coverage."
---

# Injectable Skill: Peer Scoring Correctness

> **L1 trigger**: `P2P` flag AND (`score_peer`, `peer_score`, `reputation`, `misbehavior`, `ban_peer`, `peer_scoring` detected)
> **Inject Into**: `depth-network-surface`
> **Language**: Go and Rust
> **Finding prefix**: `[PSC-N]`

## 1. Reward / Penalty Symmetry

Enumerate all score increments and all score decrements. For every reward path,
identify the matching penalty path and ask whether a malicious peer can gain
trust faster than it can lose it.

Tag: `[PEER-SCORE:SYMMETRY]`

**Required full-leg matrix**: Do not stop after the first scoring bug. Build a
complete table of every score mutation and every peer-performance observation:

| Leg | Event / endpoint | Reward? | Penalty? | Error classes penalized | Can attacker farm? |
|---|---|---|---|---|---|
| block validation | valid / invalid block | | | | |
| block pool / orphan handling | unknown parent, invalid data, timeout | | | | |
| health check | HTTP 200, non-200, timeout, parse error | | | | |
| data/chunk request | delivery success, delivery fail, no response | | | | |
| gossip | valid message, invalid message, duplicate, re-gossip | | | | |
| bootstrap / peer list | useful peer, bogus peer, stale address | | | | |

Every blank `Penalty?` for a harmful event is a candidate finding. Every blank
`Can attacker farm?` for a reward event is incomplete analysis.

## 2. Penalty Coverage

Build a failure-mode table and verify every harmful action has a score impact:

| Failure mode | Penalized? | Immediate? | Resettable? |
|---|---|---|---|
| Invalid block / tx | | | |
| Timeout / stall | | | |
| Malformed gossip | | | |
| Health-check failure | | | |
| Excessive requests | | | |
| Non-response / timeout | | | |
| Non-200 HTTP response | | | |
| Delivery failure after accepted request | | | |
| Invalid block held in cache / orphan pool | | | |
| Stale peer address update | | | |

Tag: `[PEER-SCORE:COVERAGE]`

## 3. Farming / Free-Riding

Check whether peers can cheaply farm score via ping loops, `get_data` style
requests, acknowledgements without contribution, or reconnect-based resets.
Quantify attacker cost versus defender work.

For each positive score path, identify the cost the peer actually pays. A peer
must not gain score for:
- returning any HTTP 200 when the requested data was not delivered;
- responding to health checks without serving blocks/chunks;
- causing the victim to fetch data from the attacker while the attacker withholds
  useful data;
- reconnecting to clear a negative history and immediately earning fresh rewards.

Tag: `[PEER-SCORE:FARMING]`

## 3b. Direction and Sign Sanity

For every `increase_score`, `decrease_score`, `reward`, `penalize`, or raw
`score +=/-=` site, verify the sign matches the semantic event. Common miss:
error branches log failure but do not call the penalty path, or non-200
responses are treated as success because transport completed.

Tag: `[PEER-SCORE:DIRECTION:{file}:{line}]`

## 4. Reset and Persistence Semantics

- Does disconnect/reconnect reset score?
- Is score keyed by peer ID, IP, ENR, or connection object?
- Can bans be bypassed by cheap identity rotation?
- Are penalties persisted across restart?

Tag: `[PEER-SCORE:RESET]`

## 5. Selection Stability

Trace where score affects sync-source selection, top-peer preference, or
bandwidth allocation. A manipulable score that changes any of those choices is
an enabler finding even if the scoring bug alone is not terminal.

Tag: `[PEER-SCORE:SELECTION]`

## 6. Output Requirement

Always include the full-leg matrix in the output, even when every row is SAFE.
If a row is not applicable, write `N/A` and cite the file/line proving the
protocol does not implement that leg. Missing rows are treated as incomplete
peer-scoring coverage.
