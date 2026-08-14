---
name: "cosmos-sdk-module-safety"
description: "L1 trigger - audits Cosmos-SDK / CometBFT modules for consensus non-determinism, unmetered ABCI hooks, signer/state mismatches, module-account bookkeeping breaks, sdk.Dec rounding, ABCI-path panics, unregistered Msg handlers, and fee/gas overflow."
---

# Injectable Skill: Cosmos-SDK / CometBFT Module Safety

> **L1 trigger**: `L1_PATTERN=true` AND `COSMOS_SDK` (cosmos-sdk / cometbft / tendermint / `x/` modules detected)
> **Inject Into**: `depth-consensus-invariant`, `depth-state-trace`
> **Language**: Go (Cosmos-SDK)
> **Finding prefix**: `[COS-N]`
> **Status**: v0.1

## Orchestrator Decomposition Guide

- Sections 1, 2, 6, 7: depth-consensus-invariant (determinism, ABCI-hook metering, ABCI panics, Msg routing — all chain-halt / safety class)
- Sections 3, 4, 5, 8: depth-state-trace (signer/state authority, module-account invariant, Dec rounding, fee/gas overflow — all accounting / authorization class)
- A single bug can span both lenses; record it once and cross-reference.

## When This Skill Activates

Recon classifies the target as a Cosmos-SDK / CometBFT application chain or module set (`go.mod` requires `cosmossdk.io/...`, `github.com/cosmos/cosmos-sdk`, `github.com/cometbft/cometbft`, `github.com/tendermint/tendermint`, or the tree has `x/<module>/keeper`, `x/<module>/types`, `abci.go`, `module.go`). Cosmos app-chain bugs are predominantly **consensus-halting** (every validator must compute byte-identical state) and **accounting** (module accounts must reconcile) — both are in scope for Plamen L1 audits. Severity baseline is Medium; chain-halt / fork and fund-loss classes upgrade to High/Critical per `docs/l1-mode/severity-matrix.md`.

A Cosmos state-transition path is any code reachable from a `Msg` handler (`msgServer` methods), `BeginBlock`, `EndBlock`, `InitGenesis`, `EndBlocker`, `PreBlocker`, or an AnteHandler/PostHandler that mutates committed state. Everything in those paths runs on **every validator** and MUST be deterministic and panic-safe.

## 1. Non-Determinism in State-Transition Paths

**Check**: No state-transition path may depend on per-node, wall-clock, or unordered data. Two honest validators replaying the same block MUST compute the same app hash; any divergence forks or halts the chain.

**Methodology**:
1. From `caller_map.md` / `function_summary.md`, enumerate every function reachable from a `Msg` handler, `BeginBlock(er)`, `EndBlock(er)`, `PreBlocker`, `InitGenesis`, or Ante/Post handler. These are the consensus-critical set.
2. For each, grep / inspect for non-deterministic sources:
   - **Map-range iteration without sort**: `for k := range <map>` or `for k, v := range <map>` where iteration order affects writes, accumulation order, or emitted state. Go randomizes map iteration order per process. Fix pattern is a sorted key slice (`maps.Keys` + `slices.Sort`) before ranging. Flag any range-over-map in the consensus set that feeds a state write or running total.
   - **Wall clock**: `time.Now()`, `time.Since(`, `time.Tick`, `os.Getenv` — block time must come from `ctx.BlockTime()` / `ctx.BlockHeader().Time`, never the OS clock.
   - **Randomness**: `math/rand`, `crypto/rand`, `rand.Intn`, unseeded or per-node-seeded RNG in a handler.
   - **Floating point**: `float32` / `float64` arithmetic, `math.Pow`, `math.Sqrt` on consensus values — float results are not guaranteed bit-identical across platforms; use `sdkmath.LegacyDec` / `big.Int`.
   - **`unsafe.`**, `reflect`-driven ordering, goroutines/channels whose completion order affects state, and `select` over multiple ready channels.
3. For each hit, confirm the value actually feeds committed state (app hash). A non-deterministic value used only for a log line is not a finding; one used for a balance, a winner selection, an iteration order over payouts, or an emitted event consumed by light clients is.

Tag: `[COS-NONDET:{source}:{file}:{line}→{state-effect}]`

## 2. Unmetered BeginBlock / EndBlock Hooks

**Check**: ABCI hooks (`BeginBlock`, `EndBlock`, `BeginBlocker`, `EndBlocker`, `PreBlocker`) run every block with no per-message gas meter bounding them. An unbounded or super-linear loop over state that an attacker can grow turns block production into a DoS / liveness failure.

**Methodology**:
1. Locate every `BeginBlock(er)` / `EndBlock(er)` / `PreBlocker` (grep `func.*BeginBlock`, `func.*EndBlock`, `module.go`, `abci.go`).
2. Inside each, walk loops. Flag:
   - Iteration over a `GetAll*` / `IterateAll*` / full-store iterator whose element count grows with user actions (e.g. all unbonding entries, all open orders, all proposals, all accounts) with no cap per block.
   - Nested loops over growing state (O(n²)) — e.g. for each validator, for each delegation.
   - `len(slice)` / iterator length driven by attacker-controlled creation (an attacker spams cheap objects; the hook then iterates all of them every block).
3. Confirm the absence of a per-block work cap (a `maxPerBlock` limit, a paginated queue drained N-at-a-time, or a time-bounded window). Absence with attacker-growable input is the finding.

Tag: `[COS-ABCI-UNMETERED:{hook}:{file}:{line}:{growth-driver}]`

## 3. GetSigners vs State-Modifying Field Mismatch

**Check**: A `Msg` may only mutate state owned by an account that is in its authenticated signer set. If a handler writes a field (owner, recipient, admin, target address) that is NOT derived from `msg.GetSigners()` (or the SDK-validated signer), an attacker can act on behalf of, or against, another account.

**Methodology**:
1. For each proto `Msg` type, find its `GetSigners()` (generated or hand-written) and record the signer-deriving field(s) (commonly `Creator`, `Sender`, `FromAddress`, `Authority`).
2. From `state_write_map.md`, list every field the corresponding `msgServer` handler writes or whose owner it changes.
3. Cross-check: every account/address the handler treats as authorized MUST be in the signer set. Flag when:
   - The handler reads an address from a message field NOT in `GetSigners()` and then debits/credits/reassigns it.
   - The handler trusts a stored object's `owner` without checking it equals a signer.
   - An `Authority`/governance gate is declared but the handler never compares the signer to it.
4. For `x/authz`-style delegated execution, verify the grant is checked for the exact `Msg` type and granter.

Tag: `[COS-SIGNER-MISMATCH:{msg}:{written-field}:{file}:{line}]`

## 4. Module-Account Bookkeeping Invariant

**Check**: For every module that holds funds, `sum(per-user balances / deposits / shares tracked in module state) == bankKeeper.GetBalance(moduleAccount, denom)` must hold after each block. Direct bank sends that bypass the module's own accounting break this silently.

**Methodology**:
1. Identify module accounts (`authtypes.NewModuleAddress`, `GetModuleAccount`, `RegisterModuleAccount`, permissions `Minter`/`Burner`/`Staking`).
2. Enumerate every credit/debit path: `bankKeeper.SendCoinsFromAccountToModule`, `SendCoinsFromModuleToAccount`, `MintCoins`, `BurnCoins`, and any **direct** `bankKeeper.SendCoins(...)` touching a module address.
3. Flag direct `SendCoins` / `SendCoinsFromModuleToModule` that move module funds WITHOUT a paired update to the module's internal ledger (the per-user mapping the module uses to compute who is owed what).
4. Verify (or recommend) a registered `InvariantRoute` (`RegisterInvariants`) asserting `sum(internal) == moduleBalance`. Absence of the invariant plus a bypassing send path is the finding.
5. Check mint/burn symmetry: every `MintCoins` that increases supply must have an accounting record; every `BurnCoins` must decrement the corresponding internal claim.

Tag: `[COS-MODACCT-INVARIANT:{module}:{bypass-path}:{file}:{line}]`

## 5. sdk.Dec / LegacyDec Rounding Non-Associativity

**Check**: `sdkmath.LegacyDec` (`sdk.Dec`) operations lose precision; the order of chained `Quo`/`Mul` changes the result, and rounding must always favor the protocol (never the user) to prevent dust extraction or under-collateralization.

**Methodology**:
1. Grep for chained decimal math: `.Quo(`, `.Mul(`, `.QuoInt(`, `.MulInt(`, `.QuoTruncate(`, `.MulTruncate(`, `.RoundInt(`, `.TruncateInt(`.
2. For each `(a Quo b) Mul c` (or `Mul`-then-`Quo`), check whether reordering changes the rounded result and whether the chosen order favors the user (e.g. rounding a withdrawal UP or a deposit-share DOWN). User-favorable rounding in a value-bearing path is a finding.
3. Verify rounding-direction consistency between paired operations: deposit→shares and shares→withdraw must round in protocol-favorable opposite directions so `withdraw(deposit(x)) <= x`.
4. Boundary-fuzz: substitute edge denoms (1 base unit, very large supply, dust amounts) and small exchange rates; precision loss is largest at extremes. Recommend a property test asserting the no-free-value invariant.

Tag: `[COS-DEC-ROUNDING:{op-chain}:{file}:{line}:{who-favored}]`

## 6. ABCI / Consensus-Path Panics

**Check**: A panic in `DeliverTx` (a `Msg` handler), `BeginBlock`, `EndBlock`, or `PreBlocker` is not a graceful tx failure — it can crash validators or, depending on recovery placement, cause inconsistent rollback and a chain halt. Handler errors must be returned as `error`, not raised as `panic`.

**Methodology**:
1. In the consensus set (Section 1 step 1), grep for `panic(`, `.MustMarshal`, `Must*(` helpers, unchecked array/slice indexing on message-controlled length, integer division by a message-controlled denominator, type assertions `.(T)` without the `, ok` form, and `sdk.NewCoins(...)`/`coins.Add(...)`/`total.Add(...)` over **unsorted or unvalidated** denoms (which panics on duplicate/invalid denom).
2. For each, trace whether the input can be attacker-controlled (a `Msg` field, a peer-supplied value, a genesis import). Attacker-reachable panic in a handler = at least a tx-griefing finding; in BeginBlock/EndBlock = liveness / chain-halt class.
3. Distinguish: panics in `BeginBlock`/`EndBlock` are the most severe (no per-tx recovery boundary). A panic recovered by the baseapp tx middleware that still corrupts a cached store before recovery is also a finding.
4. Verify `ValidateBasic` actually rejects the input class that would otherwise panic later (stateless validation is the correct place to bound lengths/denoms).

Tag: `[COS-ABCI-PANIC:{path}:{panic-site}:{file}:{line}]`

## 7. Missing / Unregistered Msg Handlers

**Check**: A proto `Msg` type with no route or no registered service handler silently fails (the tx is accepted into a block but the state change never happens, or it is rejected in a way that diverges from the spec). Every declared `Msg*` must be wired to exactly one handler.

**Methodology**:
1. Enumerate every `Msg*` RPC from the proto / `tx.pb.go` `MsgServer` interface (and any legacy `sdk.Msg` types).
2. Cross-check registration: `RegisterMsgServer` / `_Msg_serviceDesc`, `RegisterServices`, legacy `NewHandler` switch arms, and `RegisterLegacyAminoCodec` / `RegisterInterfaces` for the concrete type.
3. Flag any `Msg*` with no `msgServer` method, no route arm, or unregistered concrete type → the message is unhandled / un-decodable.
4. Also flag the inverse mismatch: a handler that exists but whose `Msg` type is not registered in the interface registry (decoding fails) — and duplicate routes (two arms for one type).

Tag: `[COS-MSG-UNROUTED:{msg-type}:{registration-gap}]`

## 8. Fee / Gas uint64 Overflow

**Check**: Fee and gas arithmetic on `uint64` (`baseFee * gasUsed`, refund computations, gas-price multiplication) can overflow and wrap, producing a near-zero fee, a refund larger than the escrowed amount, or an out-of-bounds gas grant.

**Methodology**:
1. Grep for `uint64` multiplication/addition in fee/gas paths: `GasUsed`, `GasWanted`, `gasPrice`, `baseFee`, `Fee.Amount`, AnteHandler fee deduction, refund/`ConsumeGas` accounting.
2. For each `a * b` / `a + b` on `uint64` where either operand is message- or block-controlled, check for an overflow guard (use of `sdkmath.Int` / `big.Int`, or an explicit `math.MaxUint64 / b` pre-check).
3. Verify refund <= escrowed: a refund computed by subtraction must guard against underflow (refund > paid).
4. Recommend migrating value-bearing fee/gas math to `sdkmath.Int` (arbitrary precision) rather than raw `uint64`.

Tag: `[COS-FEE-OVERFLOW:{op}:{file}:{line}]`

## Bounded Reads

**MANDATORY — do not bulk-read large source files (context-collapse risk).** Drive analysis from the Go SCIP bake graph artifacts first, then open individual symbols on demand:

- Read `caller_map.md`, `callee_map.md`, `state_write_map.md`, and `function_summary.md` (produced by the Go SCIP bake) to build the consensus-critical reachability set and the per-field writer set **without** reading whole modules.
- Open an individual source symbol (one function / one `keeper` method) ON-DEMAND only when a graph artifact flags it — never read an entire `x/<module>` tree or a multi-thousand-line file in one go.
- If a needed symbol is not in the graph artifacts, grep for the specific function/identifier and read only the matched span plus a few lines of context.
- Write enumerations (consensus set, signer map, module-account paths) to small scratchpad notes; do not hold whole files in context.

## Output schema

- **Layer**: consensus (Sections 1, 2, 6, 7) / state (Sections 3, 4, 5, 8)
- **Bug class**: non-determinism / unmetered-abci / signer-mismatch / module-account-invariant / dec-rounding / abci-panic / msg-unrouted / fee-overflow
- **Finding prefix**: `[COS-N]`
- **Preferred evidence tags**: `[FUZZ-PASS]` (proptest/Go fuzz on the handler or Dec math) > `[NON-DET-PASS]` (replay differential showing divergent app hash) > `[CODE-TRACE]`
- **Severity baseline**: Medium; upgrade to High/Critical for chain-halt / fork (Sections 1, 2, 6) or fund loss (Sections 4, 5, 8); see `docs/l1-mode/severity-matrix.md`

## Known bug exemplars

> Illustrative bug CLASSES only — methodology finds these generically, the names are public-incident exemplars, not protocol targets.

1. **Go map-iteration non-determinism class** — ranging over a Go map in a handler / BeginBlock and using iteration order to write state or accumulate a total. Because Go randomizes map order per process, validators diverge → app-hash mismatch → chain halt. Multiple Cosmos chains have shipped and patched this class. **Catch point**: Section 1 map-range check.
2. **ICS-23 / Merkle proof-gap class (Dragonberry-class)** — a missing or malformed membership/non-membership proof check lets a forged value pass verification. (Cross-chain proof verification primarily lives in the `light-client-proof-verification` skill; this skill flags the Cosmos-side `Msg`/keeper entry points that consume such proofs and the signer/authority gating around them.) **Catch point**: Sections 3 and 6 (entry-point authority + panic-safety on proof inputs).
3. **Module-account drain class** — a keeper that pays out via direct `bankKeeper.SendCoins` from the module account without decrementing the per-user ledger, so `sum(internal) > moduleBalance` and later claimants are bricked, or the inverse over-issuance. **Catch point**: Section 4.
4. **Unmetered EndBlock loop class** — iterating all of an attacker-growable collection (open orders, unbonding queue) every block with no cap, so cheap spam linearly inflates block time. **Catch point**: Section 2.
5. **AnteHandler fee-overflow class** — `gasPrice * gasWanted` overflowing `uint64` to a tiny fee, defeating fee-market DoS protection. **Catch point**: Section 8.

## Fallback

If the SCIP graph artifacts are unavailable or incomplete:
- List `x/*/keeper/*.go`, `x/*/abci.go`, `x/*/module.go`, and `app/app.go`.
- Grep for `func.*BeginBlock`, `func.*EndBlock`, `func.*PreBlocker` (consensus hooks).
- Grep `for .* := range ` and intersect with handler/hook files (non-determinism candidates).
- Grep `GetSigners`, `SendCoins`, `MintCoins`, `BurnCoins`, `panic(`, `.Quo(`, `.Mul(`, `RegisterMsgServer`, `RegisterServices`.
- Read `proto/**/tx.proto` for the full `Msg` service to enumerate handlers for Section 7.

## Cross-references

- Related: `consensus-safety-invariants` (general non-determinism / state-transition completeness), `go-concurrency-safety` (Go map / goroutine hazards), `light-client-proof-verification` (ICS-23 / Merkle proof soundness), `validator-lifecycle-and-slashing` (x/staking, x/slashing lifecycle), `dependency-audit-nodeclient` (cosmos-sdk / cometbft version CVEs).
- Consumed by: `depth-consensus-invariant`, `depth-state-trace`
- Severity: `docs/l1-mode/severity-matrix.md`
