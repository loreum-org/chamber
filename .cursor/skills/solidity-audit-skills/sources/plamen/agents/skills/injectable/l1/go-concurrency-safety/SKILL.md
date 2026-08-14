---
name: "go-concurrency-safety"
description: "L1 supplement - audits Go-specific concurrency hazards in node client code: map iteration non-determinism, goroutine leaks, mutex ordering, panic boundaries, context cancellation."
---

# Injectable Skill: Go Concurrency Safety

> **L1 trigger**: `L1_PATTERN=true` AND target language = Go
> **Inject Into**: Every L1 depth agent working on Go code, in addition to the main skill
> **Finding prefix**: `[GO-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## When This Skill Activates

Supplement to the main L1 skills when the target is written in Go. It codifies the Go-specific traps that turn otherwise-correct logic into production bugs. These are drawn from the Cosmos-SDK, Geth, Erigon, and CometBFT bug histories.

## 1. Map Iteration Non-Determinism

Go maps iterate in **unspecified order**. Production bug class: any consensus computation that ranges over a `map[K]V` and uses the order in its output will produce different results on different nodes.

**Detection**:
- Ast-grep `for $_, $_ := range $MAP` where `$MAP` is declared as `map[...]...`
- For each hit in a consensus-critical path, check if the iteration result affects any stored state, signed message, or hash input

**Fix pattern**:
```go
keys := make([]string, 0, len(m))
for k := range m {
    keys = append(keys, k)
}
sort.Strings(keys)
for _, k := range keys {
    v := m[k]
    // use (k, v)
}
```

**Alternative**: use `btree` or `sort.SliceStable` on a converted slice.

Tag: `[GO-MAP-ITER:{loc}:{consumer}]`

## 2. Goroutine Leaks

Goroutines that are started but never terminated. Over hours/days, a leak accumulates and eventually OOMs the node.

**Common patterns**:
- Goroutine blocked on `<-ch` where the sender path can return without sending
- Goroutine blocked on `http.Get` / network call without context timeout
- Goroutine in a `for` loop without a cancellation check
- Goroutine spawned inside a handler that outlives the handler's parent context

**Detection**:
- Ast-grep `go $FUNC(...)` / `go func() { ... }()`
- For each, trace the function body: is there a termination condition? Is it guaranteed to fire?
- Check every `select` inside: does it have a `case <-ctx.Done()`?

Tag: `[GO-GOROUTINE-LEAK:{spawn-loc}:{blocked-on}]`

## 3. Mutex Deadlock Risk

Locking order inversions cause deadlocks. In node clients, locks are often acquired across subsystem boundaries (consensus holds lock A, calls into p2p which acquires lock B; p2p holds lock B, calls into consensus which acquires lock A → deadlock).

**Detection**:
- For every function that acquires 2+ mutexes (directly or via called functions), determine the lock order
- Look for lock order inversions across the same two locks
- Look for `Lock` / `Unlock` pairs with an early return that skips Unlock (prefer `defer Unlock`)

Tag: `[GO-LOCK-ORDER:{lock-a}:{lock-b}:{inversion-site}]`

## 4. Channel Send on Closed Channel

Sending on a closed channel panics. In Go, closing a channel you don't own is usually wrong.

**Detection**:
- Every `close(ch)`: who owns `ch`? Can another goroutine send on it after close?
- `for _, x := range ch` pattern: correct consumer side; check producer side always closes exactly once

Tag: `[GO-CLOSED-CHAN:{loc}]`

## 5. Panic Boundaries

A goroutine panic crashes the whole process (unless recovered). In RPC handlers, HTTP middleware typically recovers; in background workers, often not.

**Detection**:
- For each `go func()` in background code: is the first line `defer func() { recover() }`?
- For each handler that calls user input-parsing code: is there a recover boundary?
- `panic()` in consensus code: should never happen; any `panic` inside the consensus package is a bug

Tag: `[GO-PANIC:{loc}:{recovered}]`

## 6. Context Cancellation Propagation

The `context.Context` pattern propagates cancellation. Every long-running operation should accept a context and check it.

**Detection**:
- Every function in a hot path that does I/O: does it take `ctx` and honor cancellation?
- Every goroutine in a pool: does it use the pool's context for shutdown?
- `context.Background()` in production code is a smell — usually should be a child of a longer-lived context

Tag: `[GO-CTX:{loc}:{missing-propagation}]`

## 7. `defer` Gotchas

- `defer` in a loop: the deferred function runs when the outer function returns, not when the loop iteration ends. Can accumulate.
- `defer` with captured variables: closure captures by reference; variables may have changed by the time defer runs.
- `defer f(x)` evaluates `x` at defer time; `defer func() { f(x) }()` evaluates at call time.

Tag: `[GO-DEFER:{loc}:{issue}]`

## 8. Integer Overflow

Go doesn't panic on integer overflow (wraps silently). In consensus math, this is dangerous.

**Detection**:
- Every `+`, `*`, `-` on `uint64` / `int64` in consensus/fee/stake computation
- Use `math.AddUint64` or explicit overflow checks
- `big.Int` is safer for unbounded arithmetic

Tag: `[GO-OVERFLOW:{loc}:{type}]`

## Output schema

- **Language**: Go
- **Bug class prefix**: `GO-`
- **Preferred evidence tags**: Same as parent skill

## Known bug exemplars (v0.2 — Round 4 verified)

1. **btcd signed-int transaction version (CVE-2024-34478)** — transaction version treated as signed int instead of unsigned, combined with a data race in the consensus-rule check. Chain split and fund loss possible. [Snyk advisory](https://security.snyk.io/vuln/SNYK-GOLANG-GITHUBCOMBTCSUITEBTCDBLOCKCHAIN-6808762). **Skill catch point**: Section 8 (integer overflow) + `go test -race`. Every signed/unsigned mismatch on a consensus-relevant field is a finding.

2. **Geth concurrent map iteration and map write panic (issue #17750)** — map accessed from multiple goroutines without sync; Go runtime panics with `fatal error: concurrent map iteration and map write`. [go-ethereum #17750](https://github.com/ethereum/go-ethereum/issues/17750). **Skill catch point**: Section 3 — for every map field on a struct shared across goroutines, verify it is protected by `sync.Map`, `sync.RWMutex`, or channel serialization.

3. **Cosmos SDK map iteration determinism (EPIC #13039)** — class-wide issue across multiple modules. Go's runtime intentionally randomizes `range m` for `map[K]V`, making every state-machine iteration over a map a potential chain-halt vector. [EPIC #13039](https://github.com/cosmos/cosmos-sdk/issues/13039). **Skill catch point**: Section 1 — mandatory check.

4. **Aptos 10/18/23 HashMap regression** — performance refactor replaced a deterministic map with Rust `HashMap`; since Aptos uses Move VM written in Rust, this is a Rust concurrency bug by mechanism but the same class applies to Go. Referenced in `consensus-safety-invariants` skill.

### Runtime-gate additional check

**Always run** `go test -race ./...` and `go vet ./...` as part of the language-specific scanner. Race detector findings on consensus-relevant types (state, block, validator-set) are automatic High-severity candidates.

## Cross-references

- Supplements all L1 skills when target = Go
- Primary consumer: any depth agent on Go code
