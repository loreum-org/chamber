---
name: "rpc-surface-audit"
description: "L1 trigger - audits JSON-RPC and Engine API surfaces for authentication bypass, rate limiting, subscription buffer overflows, and method-specific DoS."
---

# Injectable Skill: RPC Surface Audit

> **L1 trigger**: `L1_PATTERN=true` AND (`rpc/` OR `jsonrpc` OR `engine_api` OR `eth/api` OR `websocket` OR `ipc` detected in recon subsystem map)
> **Inject Into**: `depth-network-surface`
> **Language**: Go and Rust
> **Finding prefix**: `[RPC-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## Orchestrator Decomposition Guide

- Section 1: depth-network-surface (attack surface)
- Section 2: depth-network-surface (auth + rate limit)
- Section 3: depth-state-trace (subscription state)
- Section 4: depth-edge-case (method boundaries)

## When This Skill Activates

Recon identifies an RPC subsystem. RPC is the most publicly exposed attack surface on any L1 node — typically unauthenticated (HTTP JSON-RPC, WebSocket) or semi-authenticated (Engine API with JWT). Even a Medium-severity bug here often upgrades to High because of permissionless reachability (see severity-matrix.md modifier).

## 1. Attack Surface Enumeration

Enumerate all RPC entry points via LSP `workspace/symbol` filtered by known method-registration patterns:

| Transport | Registration pattern | Example |
|---|---|---|
| **HTTP JSON-RPC** | `rpc.Register`, `httpServer.Handle`, `#[method(name=...)]` | `eth_*`, `debug_*`, `admin_*` |
| **WebSocket** | Same as HTTP + subscription handlers | `eth_subscribe` |
| **IPC** (unix socket) | Often same as HTTP | Geth `admin` namespace |
| **Engine API** | JWT-authenticated | `engine_newPayloadV*`, `engine_forkchoiceUpdatedV*` |
| **Prometheus metrics** | `/metrics` endpoint | often bound to all interfaces |
| **PPROF profiling** | `/debug/pprof/` (Go) | should NEVER be public |

Write the enumeration to `scratchpad/rpc_surface.md`.

## 2. Authentication and Namespace Gating

### 2a. Default exposure
- What namespaces are enabled by default on HTTP? (Geth: `eth`, `net`, `web3`. Not `admin`, `debug`, `personal`.)
- Is the default bind address localhost or 0.0.0.0?
- Is authentication required for any namespace?

### 2b. Dangerous namespaces
- `admin_*` — should never be exposed on HTTP; check the config validation
- `debug_*` — can expose internal state; check default
- `personal_*` — key management; deprecated in Geth but still present in forks
- `engine_*` — JWT-authenticated; check the JWT secret handling
- `miner_*` / `txpool_*` — varies by client

### 2c. CORS and origin checks
- Is the WebSocket origin-checked? (Yes in Geth; verify in forks)
- Are CORS headers tight? Default should be same-origin

### 2d. JWT handling (Engine API specifically)
- JWT secret rotation: what happens on secret change mid-operation?
- JWT `iat` claim: is clock drift tolerated? Excessive tolerance is a replay window
- JWT algorithm whitelisting: must be HS256 only; reject `alg=none` and key-confusion attacks

Tag: `[RPC-AUTH:{issue}]`

## 3. Rate Limiting and Resource Quotas

### 3a. Per-request cost tracking
Some RPC methods are cheap (`eth_blockNumber`), others are expensive (`eth_getLogs` with wide range, `debug_traceTransaction`). Is there a cost model that bounds work per request?

**Check**:
- For each expensive method, is there a **result size limit**? E.g., `eth_getLogs` with `max_logs_per_request`
- For each historical query, is there a **block range limit**? E.g., `eth_getLogs` with `fromBlock` → `toBlock` span
- For each trace method, is there a **trace depth** / **trace time** limit?

### 3b. Per-client rate limit
- Is there rate limiting by IP, by API key, by connection?
- What's the default burst + sustained rate?

### 3c. Total concurrent request cap
- Maximum simultaneous HTTP requests
- Maximum simultaneous WebSocket connections
- Maximum subscriptions per WebSocket connection

Tag: `[RPC-RATE:{scope}:{limit-or-unbounded}]`

## 3d. Outbound HTTP client timeout audit

The skill historically focused on incoming RPC. Audit OUTBOUND HTTP clients used by the node for peer fetches and inter-node API calls — they are a symmetric DoS vector.

**Check**:
- For each `reqwest::Client::builder()`, `awc::Client::builder()`, `hyper::Client::builder()`, and `http::Client::new()` site, verify `.timeout(...)` AND `.connect_timeout(...)` are set explicitly. The library defaults are NO timeout.
- For each `tokio::time::timeout` wrapper around an outbound call, verify the timeout bound is a constant (not derived from peer-controlled input).
- For Go: `http.Client{}` literal (zero value) has NO timeout — flag every site that constructs `http.Client` without setting `Timeout`. Also check `Transport.DialContext` for connect-timeout.
- **Fail mode**: an unresponsive remote peer can hang the calling task forever, blocking critical bootstrap, sync, or peer-handshake routines. Combined with peer-list flooding, an attacker can stall every honest node's startup.

Tag: `[RPC-CLIENT-NO-TIMEOUT:{file}:{line}]`

## 3e. JSON number precision for u64 fields

JavaScript clients (and many other dynamic languages) cannot represent integers above `2^53 - 1` precisely. L1 nodes that serialize `u64` fields as JSON numbers (not strings) will silently corrupt block heights, balances, gas values, and timestamps when consumed by JS clients.

**Check**:
- For each `serde::Serialize` impl on a struct exposed via RPC, find every `u64` / `u128` / `i64` / `i128` field
- Verify the serializer either uses `#[serde(with = "as_string")]` or a similar string-coercion attribute, OR that the field's max value provably fits in 53 bits
- For Go: check `json.Marshal` of `uint64` fields and `*hexutil.Uint64` wrappers (the latter is correct, the former is not)

Tag: `[RPC-JSON-PRECISION:{type}.{field}]`

## 3f. Success Return vs Side-Effect Completion

For each RPC handler, peer HTTP endpoint, and outbound API client wrapper that returns `Ok(())`, HTTP 2xx, a success JSON body, or increments peer score, verify that the underlying side effect completed first.

**Check**:
- A handler must not return success when validation failed, delivery failed, or the requested state transition was skipped.
- Outbound calls must propagate transport errors, non-2xx status, timeout, parse failure, and body-delivery failure before any success return or peer-score reward.
- For each `Ok(())`, `StatusCode::OK`, `HttpResponse::Ok`, or equivalent success path, trace the immediately preceding awaited call and ensure it is guarded by `?`, explicit error mapping, or a checked status branch.
- For Go, check `return nil` paths after `Do(req)`, `Write`, `Encode`, channel send, or peer delivery; success must be after the side effect, not before it.

Tag: `[RPC-OK-BEFORE-EFFECT:{file}:{line}]`

## 4. Subscription Buffer Overflows

WebSocket subscriptions are a classic DoS vector: slow consumer, fast producer.

**Check**:
- For each `eth_subscribe` type (newHeads, logs, newPendingTransactions, syncing), what is the outbound buffer depth per subscriber?
- When the buffer fills, does the server drop messages, kill the subscription, or block the producer?
- Can a slow consumer cause back-pressure on the chain head update path? (Very bad — affects consensus.)

Tag: `[RPC-SUB:{type}:{buffer-policy}]`

## 5. Per-Method Deep Checks

### 5a. `eth_getLogs`
- Block range validation
- Bloom filter efficiency on wide ranges
- Empty-log edge case
- Topic filter malformed input

### 5b. `debug_traceTransaction` / `debug_traceBlock`
- Opcode count bound
- Memory bound per trace
- Timeout per trace
- Tracer code injection (for custom tracers)

### 5c. `eth_call` / `eth_estimateGas`
- Gas cap per call
- State override safety (can caller manipulate state?)
- Call depth limit

### 5d. `eth_getProof`
- Proof size for a deeply nested account
- Empty account edge case

### 5e. `engine_newPayload` (Engine API)
- Payload validation: any panic path?
- State diff computation: unbounded?
- Concurrent newPayload races: handled?

## 6. Panic Surfaces

An RPC method that panics crashes the node. The Go standard library recovers in HTTP handlers by default, but custom dispatch may not.

**Check**:
- Is there a top-level `recover` / panic catcher?
- For each handler, trace panic paths: `panic!()`, `.unwrap()` on user input, integer division, out-of-bounds access
- For Rust: `.unwrap()` and `.expect()` on decoded user input are panic-on-attack

Tag: `[RPC-PANIC:{method}:{path}]`

## 6a. Admin-endpoint Exposure + Key/Secret Leakage

Privileged and operator-facing RPC surfaces are a distinct, high-value class from public read methods. The failure modes: an admin/debug namespace reachable without authentication, an expensive trace/debug method exposed without auth or rate limit, or a response body that echoes a secret (private key, JWT, mnemonic, node identity key).

**Bounded reads**: read SCIP graph artifacts (`caller_map.md`, `callee_map.md`, `state_write_map.md`, `function_summary.md`) to find privileged route registrations and their auth-gate callers; on-demand single-symbol source reads for the dispatcher and individual privileged handlers only; never bulk-read large files.

**Heuristics**:
1. Grep for privileged route names: `admin_*`, `debug_*`, `personal_*`, `miner_*`, `txpool_content`, `engine_*`, and registration of any handler whose name implies mutation (`setEtherbase`, `addPeer`, `removePeer`, `importRawKey`, `unlockAccount`, `startMining`, `stop`, `shutdown`, `nodeInfo`).
2. **Auth gate**: for EACH privileged handler, trace to its dispatcher and verify an authentication/authorization check runs BEFORE the handler body. A privileged method registered on the same HTTP listener as public methods, with no per-method gate, is a finding. Confirm the default `--http.api` / enabled-namespace list does NOT include privileged namespaces.
3. **Cost without auth**: any unauthenticated method that performs a trace, full-state walk, or unbounded historical scan (`debug_traceBlockByNumber`, custom `debug_*`) without a rate limit is a DoS finding even if it is "read-only".
4. **Secret in response**: grep handler return paths for fields named `private_key`, `secret`, `jwt`, `mnemonic`, `seed_phrase`, `keystore`, `enode` with embedded key material. Verify no handler serializes a secret into a JSON body, error message, or log line returned to the caller. `nodeInfo`/`enode` exposure of the node identity key is a finding.
5. **Bind address**: verify privileged transports (IPC for `admin`, Engine API) are not bound to `0.0.0.0` by default.

**Severity**: unauthenticated admin/key-management method reachable over HTTP is Critical (remote node takeover); unauthenticated expensive debug method is High (DoS); secret echoed in a response is Critical.

Tag: `[RPC-ADMIN-NOAUTH:{method}]`, `[RPC-SECRET-LEAK:{method}.{field}]`

## 7. Boundary conditions

| State | Test | Expected | Observed |
|---|---|---|---|
| Empty params | method with empty params | spec-defined (often error) | |
| Huge params | 10 MB of JSON in request | rejected before parsing | |
| Deeply nested JSON | 1000-level nesting | rejected (stack overflow guard) | |
| Unknown method | method not registered | error, not crash | |
| Concurrent duplicate sub | same subscription twice | spec-defined | |
| getLogs 10M blocks | wide range | rejected | |

## 8. Output schema

- **Layer**: rpc
- **Bug class**: auth-bypass / rate-limit-missing / subscription-dos / method-dos / panic-surface
- **Preferred evidence tags**: `[FUZZ-PASS]` > `[LSP-TRACE]` > `[CODE-TRACE]`
- **Severity baseline**: Medium-High. Panic-reachable-from-unauthenticated = High or Critical (permissionless node crash)

## 9. Known bug exemplars (v0.2 — Round 4 verified)

1. **Geth GraphQL DoS (CVE-2023-42319, GHSA-v9jh-j8px-98vq)** — with `--http --graphql` enabled, a crafted GraphQL query consumed memory and hung the daemon. Fixed in v1.13.5. [GHSA-v9jh-j8px-98vq](https://github.com/advisories/GHSA-v9jh-j8px-98vq). **Skill catch point**: Section 3a — every user-controlled query parser needs query depth cap, memory cap per request, total time cap, allocated-bytes cap.

2. **Geth CVE-2025-24883 p2p handshake invalid EC point** — RLPx handshake accepted an all-zero secp256k1 public key without validating it lies on the curve. ECDH math with the bogus point produced undefined behavior and DoS. [DailyCVE](https://dailycve.com/go-ethereum-denial-of-service-via-malicious-p2p-message-cve-2025-24883-moderate/). **Methodology nuance**: **the p2p handshake is part of the RPC attack surface**, not a separate domain. Any attacker-supplied curve point must be validated on-curve AND in prime-order subgroup before any math.

3. **Geth snap/1 trie-node nil-deref panic (CVE-2021-41173, GHSA-59hh-656j-3p7v)** — `trie.TryGetNode` returns nil for child of fullnode when path exhausted; caller dereferenced without a nil check → `origNode.cache()` panic. Any malicious snap peer could kill any node. [GHSA-59hh-656j-3p7v](https://github.com/ethereum/go-ethereum/security/advisories/GHSA-59hh-656j-3p7v). **Skill catch point**: Section 6 (Panic surfaces) — every p2p message handler must never panic. Each `.unwrap()`, nil-deref, panic-on-slice-index, uncovered switch is a finding.

4. **Engine API JWT replay / time-skew exploitation** — the Engine API spec allows ±60s iat window. Implementations that fail to enforce freshness allow JWT reuse across rotation boundaries. [execution-apis auth spec](https://github.com/ethereum/execution-apis/blob/main/src/engine/authentication.md). **Skill catch point**: Section 2d — hard iat window, no clock-jump tolerance, rotation-on-restart, no persistence across process boundaries.

### Methodology nuance from Round 4 (handshake is RPC surface)

**Add to Section 1**: The attack surface enumeration MUST include **p2p handshake and pre-auth message handlers**, not just JSON-RPC methods. CVE-2025-24883 was classified in the RPC surface because the handshake is the first code that touches untrusted input. Cross-reference with `p2p-dos-and-eclipse` Section 2f (pre-auth panic check).

## 10. Fallback if primitives unavailable

- Grep for `"eth_"` / `"debug_"` / `"admin_"` method names
- Find the dispatch table / method registration
- Read the top-level HTTP handler for auth gate

## Cross-references

- Related: `mempool-asymmetric-dos` (eth_sendRawTransaction is an insertion), `execution-client-hardening` (debug methods touch VM)
- Consumed by: `depth-network-surface`
- Severity: `docs/l1-mode/severity-matrix.md`
