---
name: "rust-unsafe-audit"
description: "L1 supplement - audits Rust-specific hazards: unsafe blocks, uninitialized memory, Send/Sync violations, panic safety in hot paths, drop order, FFI."
---

# Injectable Skill: Rust Unsafe Audit

> **L1 trigger**: `L1_PATTERN=true` AND target language = Rust
> **Inject Into**: Every L1 depth agent working on Rust code, in addition to the main skill
> **Finding prefix**: `[RS-N]`
> **Status**: v0.1 draft, Round 4 exemplars pending

## When This Skill Activates

Supplement to the main L1 skills when the target is written in Rust. Rust's safe subset prevents most memory safety bugs by default, but node clients use `unsafe` for performance (crypto, serialization), `panic!` for unrecoverable states, and FFI (blst, rocksdb, librocksdb-sys). Each is a bug class.

## 1. Unsafe Block Audit

Every `unsafe` block is a memory-safety assertion by the author: "I guarantee this is safe." The audit must verify that guarantee.

**Detection**:
- `cargo-geiger` counts unsafe per crate (cross-platform)
- Ast-grep `unsafe { $$ }` and `unsafe fn $NAME` and `unsafe impl`
- For each, read the surrounding safety comment (Rust convention: `// SAFETY: ...` comment should justify the unsafe)

**Checklist per unsafe block**:
- Pointer deref: is the pointer non-null? Aligned? Pointing to valid memory of the right type and lifetime?
- Type transmutation: is the layout guaranteed? (`#[repr(C)]`, `#[repr(transparent)]`)
- FFI call: are the C function's preconditions documented and met?
- Raw integer-to-pointer: is this actually sound, or just "works on current compiler"?

Tag: `[RS-UNSAFE:{loc}:{category}]`

## 2. Uninitialized Memory

Rust allows uninitialized memory via `MaybeUninit` or `mem::uninitialized` (deprecated). Reading uninitialized memory is Undefined Behavior.

**Detection**:
- Grep `MaybeUninit`, `mem::uninitialized`
- For each, verify the memory is initialized before `assume_init()` is called
- `MaybeUninit::zeroed()` for non-zeroable types is UB

Tag: `[RS-UNINIT:{loc}]`

## 3. Send / Sync Violations

`Send` allows a type to be transferred between threads; `Sync` allows shared references across threads. Manually implementing them (`unsafe impl Send for T`) is an assertion.

**Detection**:
- `unsafe impl Send for X` / `unsafe impl Sync for X`
- For each, ask: is the type actually thread-safe, or is this a compile-time workaround?
- `Rc<T>` in an async context: `Rc` is not `Send`, only `Arc` is

Tag: `[RS-SEND-SYNC:{type}:{justification}]`

## 4. Panic Safety

Panics in Rust unwind the stack by default. In a consensus-critical hot path, a panic kills the node. Exception: `panic = "abort"` in Cargo.toml makes panics immediately terminate the process.

**Detection**:
- `.unwrap()` on user-input-derived values: if the input is attacker-controlled, panic is reachable
- `.expect("...")` same
- `arr[i]` indexing on attacker-controlled `i`
- Integer division where denominator is attacker-controlled
- `assert!` / `assert_eq!` in hot paths with assertion on untrusted data

Tag: `[RS-PANIC:{loc}:{input-source}]`

**Rule of thumb**: any function that parses peer/RPC input must not `.unwrap()` or panic-index. Use `?` and `Result` throughout.

## 5. Drop Order and RAII

Rust's Drop trait runs deterministically when a value goes out of scope. Bugs:
- Drop order in structs is field-declaration order — reorder fields and RAII semantics change
- Circular references via `Rc` / `Arc` prevent drop
- Panic during drop is double-panic → abort

**Detection**:
- Every `impl Drop for X`: is the drop logic panic-safe?
- `Arc<Mutex<T>>` cycles: are there weak references breaking cycles?

Tag: `[RS-DROP:{issue}]`

## 6. FFI Correctness

Most L1 Rust clients call C libraries: `blst` (BLS), `rocksdb-sys` (storage), `libsecp256k1-sys` (signatures).

**Detection**:
- Every `extern "C"` call site
- Check the C function signature vs the Rust binding
- Buffer passed to C: length correctly communicated?
- Return code from C: checked for errors?
- Memory allocated by C: freed using the C allocator (not Rust's)?

Tag: `[RS-FFI:{function}:{issue}]`

## 6a. C FFI type size platform portability (LP64 vs LLP64)

When binding to C / C++ / CUDA / HIP via FFI (`extern "C"`, `bindgen`, hand-written headers, `*.cu` / `*.hip` files), audit every C integer type use. C type sizes differ between platforms:

| C type | Linux/macOS (LP64) | Windows MSVC (LLP64) | Safe? |
|---|---|---|---|
| `unsigned long` / `long` | 64 bits | **32 bits** | NO — silent truncation on Windows |
| `unsigned long long` / `long long` | 64 bits | 64 bits | YES |
| `int` / `unsigned int` | 32 bits | 32 bits | YES |
| `size_t` / `uintptr_t` | pointer-width | pointer-width | YES (verify) |
| `uint64_t` / `int64_t` (`<stdint.h>`) | 64 bits | 64 bits | YES — preferred |

**Check**:
- Grep every `.h` / `.c` / `.cpp` / `.cu` / `.hip` file in scope for `unsigned long` and `long` declarations
- For each, replace with a fixed-width type (`uint32_t`, `uint64_t`) AND verify the corresponding Rust binding uses `c_uint` / `c_ulong` consistently with the actual C type after replacement
- `c_ulong` in Rust IS the platform-native unsigned long, so it has the same problem on Windows — fixed-width on both sides is the only safe answer
- For CUDA kernels: device-side `unsigned long` follows the host platform's ABI on most compilers, so Windows MSVC builds will silently truncate

**Fail mode**: 64-bit values (chunk offsets, partition hashes, block heights) silently truncated to 32 bits on Windows builds, producing different consensus output from Linux builds → silent network split between operators on different platforms.

Tag: `[RS-FFI:c-type-portability:{file}:{line}]`

## 6b. Database transaction commit-before-check

Many Rust DB wrappers (mdbx-rs, sled, rocksdb) provide an `update`-style helper that runs a closure inside a transaction and commits afterwards. A common bug pattern: the wrapper commits the transaction unconditionally before checking whether the closure returned `Ok` or `Err`.

**Check**:
- For every `update_*` / `transact_*` / `with_txn_mut` helper, read the implementation
- Verify the closure result is matched BEFORE the `txn.commit()` call
- The correct pattern is: `let result = closure(&mut txn); match result { Ok(v) => txn.commit()?, Err(e) => txn.abort()?; return Err(e); }`
- The wrong pattern is: `let result = closure(&mut txn); txn.commit()?; return result;`
- Also flag third-party wrappers (custom `DbExt::update_eyre` traits) where the same pattern appears in user code

**Fail mode**: a failed business-logic closure result still commits its partial database mutations, violating transactional integrity. State and error logs disagree.

Tag: `[RS-DB:commit-before-check:{file}:{line}]`

## 7. Integer Overflow

Rust panics on debug overflow, wraps on release (unless `checked_*` / `wrapping_*` / `overflow-checks=true` in profile).

**Detection**:
- In consensus / fee / stake math: prefer `checked_add`, `checked_mul`, etc.
- `wrapping_*` usage: is wrapping actually the intended semantic?
- `as` casts across integer sizes: are they truncating?

Tag: `[RS-OVERFLOW:{loc}:{op}]`

## 8. Async Pitfalls

- Holding a mutex (`std::sync::Mutex`) across an `await` point is a deadlock risk (the future can be re-polled on another thread)
- `tokio::spawn` without joining: fire-and-forget tasks can leak
- `.await` inside a synchronous lock: use `tokio::sync::Mutex` instead

### 8a. Cancellation safety in `tokio::select!`

`tokio::select!` drops the not-chosen branch's future. If that branch was mid-critical-section (partial write to peer-state, half-appended to mempool, mid-decrement of a semaphore), the drop leaves state torn. Flag every `tokio::select!` where a branch mutates shared state without holding the mutation inside an async block that owns its guards. Tokio docs' "Cancellation safety" note applies: `tokio::io::AsyncReadExt::read` is cancel-safe; `read_exact` is not. Any non-cancel-safe future inside a `select!` is a correctness bug.

Tag: `[RS-ASYNC:cancel-unsafe:{file}:{line}]`.

### 8b. Missing `Send` bounds across `.await`

A future is `Send` only if every value it holds across an `.await` is `Send`. Holding a `Rc<T>`, a raw pointer, or a `MutexGuard<!Send>` across an `.await` silently pins the future to one thread and defeats the work-stealing scheduler (or fails to compile if the executor requires `Send`). Grep `!Send` types in async functions and verify they are dropped before the first `.await`.

Tag: `[RS-ASYNC:non-send-across-await:{file}:{line}]`.

### 8c. `tokio::time::timeout` does NOT cancel inner work

`timeout(d, f).await` only stops awaiting `f` — the spawned task behind `f` keeps running unless explicitly cancelled via a `CancellationToken` or abort handle. Requests that "timed out" at the caller still consume server resources to completion. In L1 RPC / gossip handlers this is a DoS amplifier: attacker sends N slow requests, each caller times out at 5s, but the server keeps all N tasks alive for the full work.

Tag: `[RS-ASYNC:timeout-without-cancel:{file}:{line}]`.

### 8d. Pin projection unsoundness

Manually implementing `Future` and projecting `Pin<&mut Self>` to `&mut Field` requires either `#[pin_project]` or hand-written unsafe that respects structural pinning. Bare `&mut self.inner_fut` after `self: Pin<&mut Self>` is UB if `inner_fut` is `!Unpin`.

Tag: `[RS-ASYNC:pin-projection-ub:{file}:{line}]`.

Tag (catchall): `[RS-ASYNC:{loc}:{issue}]`

## 6c. FFI / Raw Pointer Alignment

Primitive types have alignment requirements (`u32`: 4, `u64`: 8, `u128`: 16). Writing through a raw pointer cast from `*mut u8` to `*mut u64` is **undefined behavior** unless the source pointer is aligned to the target type. CUDA/SIMD/zero-copy deserialization paths hit this constantly.

**Methodology**:
1. Find every `*mut T` / `*const T` / `&mut [u8]` → `&mut [U]` cast in FFI-adjacent or zero-copy code (CUDA kernels, C FFI, `bytemuck`, `zerocopy`, `transmute`, `ptr::write`, `ptr::read`)
2. For each cast, check whether the source buffer's alignment is statically provable:
   - Stack buffers of `[u8; N]` are NOT aligned to `u64`/`u128` by default
   - `Vec<u8>` is 1-byte aligned; not sufficient for SIMD load
   - `#[repr(align(N))]` or `AlignedVec` gives a static guarantee
3. For CUDA kernels specifically: `char*` → `uint64_t*` writes on per-thread stack memory are a common alignment landmine
4. The test: can you construct an input where the pointer is odd-aligned? If yes → UB finding

**Common failures**:
- CUDA entropy chunk writes: thread-local `char buf[32]` cast to `uint64_t*` without alignment guarantee
- `bytemuck::cast_slice_mut` used without checking source alignment (panics in debug, silent UB in release if `check_cast` is disabled)
- `transmute::<&[u8], &[u32]>` with no alignment assertion
- `ptr::copy_nonoverlapping` at byte offsets that are not multiples of the target type size

Tag: `[RS-ALIGNMENT:{cast-site}:{src-type}→{dst-type}]`. Severity: Medium by default, upgrade to High if the UB is reachable from untrusted input.

## Output schema

- **Language**: Rust
- **Bug class prefix**: `RS-`

## Known bug exemplars (v0.2 — Round 4 verified)

1. **NEAR `Signature::verify` pre-auth panic ($150,000 bounty, Zellic, December 2023)** — `Message::from_slice(data).expect("32 bytes")` and `RecoveryId::from_i32().unwrap()` in a pre-authentication handshake message handler. **A single crafted p2p packet kills any node.** Fixed in PR #10385 (commit `e0f0da5c3dde29122e956dfd905811890de9a570`). [Zellic writeup](https://www.zellic.io/blog/near-protocol-bug/). **Skill catch point**: Section 4 (panic safety). This is the canonical "unwrap in pre-auth handler" bug.

2. **Academic study of real-world Rust memory-safety bugs (Songlh et al.)** — systematic study identifying three bug classes: (1) automatic memory reclaim, (2) unsound function, (3) unsound generic/trait. [Understanding Memory and Thread Safety Practices and Issues in Real-World Rust Programs](https://songlh.github.io/paper/rust-study.pdf). **Skill catch point**: Section 1 — for every `unsafe` block, document: (a) invariant the block assumes, (b) caller-side obligations, (c) test that violates each invariant by input mutation.

3. **cargo-audit blind spots** — cargo-audit only reports RustSec-tracked advisories; crates like `ring`, `mio`, `crossbeam` with heavy unsafe need manual review regardless of audit score. [Rust Vulnerability Scanning: What cargo audit Misses](https://www.geekwala.com/blog/securing-rust-dependencies-2026). **Skill catch point**: run cargo-audit AND produce an unsafe-density report (`cargo-geiger`). Any crate with >X% unsafe lines in the dep tree gets manual review regardless of audit score.

### Canonical check

**The NEAR pattern** — `.unwrap()` / `.expect()` / `panic!()` in any code reachable from network input — is the single most common Rust L1 bug and deserves a dedicated automated sweep. Grep every module reachable from p2p message deserialization and flag every panic-prone call as a finding until proven bounded.

## Cross-references

- Supplements all L1 skills when target = Rust
- Related: `bls-aggregation-audit` (FFI to blst), `execution-client-hardening` (revm unsafe blocks)
