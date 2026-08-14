---
name: omega-repo-hygiene-sweep
description: Run the repository-level pass that opens an audit — dependency pinning and advisories, licensing and copyright compliance, test coverage and CI, compiler and linter warnings, language version policy, dead code, visibility, event indexing, custom errors, and documentation drift. Produces the General section of the report. Use at the start of any audit, before reading contract logic, or when writing up repo-wide findings.
---

# Repo Hygiene Sweep

The repository-level pass, covering everything that is not about a specific
contract's logic. It produces the report's **General** section — findings
numbered `G1`, `G2`, `G3`… ahead of any per-file section.

Run it **first**, in parallel with the build, before reading any logic. Three
reasons: it is cheap and mostly mechanical; it clears the low-severity volume
out of the way so the logic review is not interrupted by it; and it is a
remarkably good predictor of how much to trust the code you are about to read.
A repo with failing tests, unpinned dependencies and compiler warnings is
telling you where its other defects will be.

Where the repo's overall state is poor enough to be a finding in its own right,
file it as one — mixed build systems, absent developer documentation, no
reproducible setup. A single "general state of the repository" finding is more
useful than ten fragments.

---

## Dependencies

**Pin everything.** Solidity dependencies, JS/Python packages, and the compiler
version. The reasoning generalises across ecosystems:

> Unpinned dependencies make builds unpredictable, and make it easier for a
> compromised new package version to enter the build.

Grade the severity by how loose the pin is. A caret range is bad; **pointing at
a git branch or unreleased ref is worse than a loose semver range** and is worth
escalating, because the referenced code can change without any version signal at
all.

Include the compiler: a floating pragma (`^0.8.0`) means the deployed bytecode
depends on whoever compiled it.

**Run the dependency advisory audit and act on it.** Cite advisories by
identifier (GHSA/CVE) and name the affected package and version range. An
advisory against a *Solidity* dependency is materially different from one
against a build-time JS tool — separate them rather than reporting a raw
vulnerability count.

**Remove unused dependencies**, and move build-only ones to dev dependencies.

**No `draft-` or alpha code in production.** Interfaces and semantics of draft
standards change, and a `draft-` prefix is the author telling you not to rely on
it yet.

## Licensing and copyright

Rigorously checked here and rated up to **medium** — this is the item most audit
checklists omit entirely.

The recurring violation: code adapted from a permissively-licensed project with
the original copyright notice stripped and the adapter's own claimed instead.
MIT permits republishing; it *requires* preserving the copyright and permission
notice. Claiming copyright over someone else's code is the part that is
categorically not permitted, and it is worth stating in exactly those terms.

The full check:

- `LICENSE` file present, with the complete licence text
- Copyright **claimed** for the project's own code — its absence is a finding,
  because claiming authorship is a precondition for granting any rights onward
- SPDX identifier on every file, and every identifier **valid**
- One consistent licence across the repo, or documented exceptions. A repo
  carrying several mutually incompatible identifiers plus a different one in
  `package.json` is a finding regardless of which is intended
- Every vendored or adapted file retains its upstream notice and licence text
- Licence compatibility checked — a copyleft-derived file cannot be relicensed
  permissively

## Tests and CI

Check the whole chain, not just the headline number:

- **Tests pass.** Failing tests in the repo or in CI.
- **Coverage measured and adequate.** Name the uncovered paths that matter
  rather than quoting a percentage — an uncovered admin function is not
  equivalent to an uncovered redemption path.
- **Coverage runs in CI**, not only locally.
- **The tooling actually works.** Coverage or gas-report commands that error,
  coverage configuration pointing at contracts that no longer exist, tests that
  pass normally but fail under instrumentation. A broken measurement is worse
  than no measurement because it is reported as a pass.
- **CI exists and is green.**
- **Claimed formal verification is real.** Specs that do not run, or that assert
  nothing meaningful, are a finding — the claim carries weight it has not
  earned.

## Compiler, linter, language version

- **Zero compiler warnings.** Each one either indicates a defect or trains
  reviewers to ignore the channel.
- **Zero linter warnings**, and a valid linter configuration.
- **Current, deliberate, pinned language version.** The point is a considered
  choice, not novelty: name the target version and the reason.
- **The repo compiles in its documented configuration**, from a clean checkout.
- **One build system.** Mixed toolchains produce divergent artifacts.

## Dead and duplicated code

Report these with the *reason*, not as style:

> Remove unused code, and avoid leaving code which is not properly implemented,
> to avoid mistakenly calling it in the future.

- Unused variables, imports, functions, constants, parameters, events
- Leftover `TODO` markers and commented-out logic
- Duplicated blocks across functions or contracts

**Duplication is not merely cosmetic**, and this is the argument that makes the
finding land: copies drift. When two near-identical functions exist, one gets a
fix and the other does not, or the two acquire subtly different guards. Where
you find duplication, **diff the copies** — the divergence is frequently a real
finding, and near-identical entry points with non-identical authorization are a
high-severity shape (see `omega-ordering-and-approval-races`, Shape 3).

Likewise, when findings in one contract apply verbatim to its near-twin, say so
by reference rather than duplicating the writeup.

## Interfaces, visibility, events, errors

- **Contracts inherit the interfaces they declare.** The point is not
  documentation — inheritance makes interface/implementation drift a *compile
  error* rather than a silent integration break.
- **`external` over `public`** where never called internally.
- **Custom errors over revert strings.**
- **Events emitted on every state change, with relevant parameters indexed.**
  Two commonly missed cases: initialization, which sets the initial values
  silently, and constructor-set parameters that have an `Updated` event for
  every later change but none for the first.
- **`immutable` / `constant`** where the value never changes after construction.
- **Explicit visibility** on state variables.

## Documentation and configuration

- **Docs match the code.** Where a docstring describes narrower behaviour than
  the implementation permits, that is not a documentation bug — it is evidence
  of a **logic bug**, because the docstring records the intended invariant.
  Escalate rather than filing it as a typo.
- **Specifications complete and unambiguous**, with ambiguities listed.
- **README instructions work from a clean checkout** — including prerequisites
  the author has locally and did not document.
- **Deployment scripts are tested** and run against a local network.
- **Comments are not misleading.** A stale comment is worse than none.

## Roles and configuration hygiene

Borderline between hygiene and trust modelling; file in General:

- **Enumerate every privileged role** and what each can do. Over-complex
  permission models are a finding on their own — complexity that cannot be
  reasoned about cannot be audited.
- **Parameter setters have sanity bounds, value limits and change delays.**
- **Ownership is 2-step** (`Ownable2Step`-style accept), and held by a multisig
  with a non-trivial threshold rather than an EOA.
- **Prefer the audited standard implementation** over a hand-rolled equivalent —
  access control, pausing, vesting, math. Rolling your own is a finding even
  when the implementation looks correct.

---

## Output

Number `G1…Gn` in the **General** section, before per-file sections. Most land
at `low` or `info`.

**Escalate to `medium`** for: licensing violations, unpinned or
advisory-affected dependencies, and anything making the delivered artifact
non-reproducible.

Keep each finding to one line of mechanism plus one line of recommendation.
This section should be fast to read and fast to fix; padding it obscures the
findings that matter.

---

## Checklist

- [ ] All dependencies pinned to released versions — not git refs, not ranges
- [ ] Compiler pragma locked; version current and deliberate
- [ ] Advisory audit run; advisories cited by ID; Solidity deps separated from
      build tooling
- [ ] Unused dependencies removed; no `draft-`/alpha code in production
- [ ] `LICENSE` present with full text; SPDX on every file and valid; single
      consistent policy
- [ ] Copyright claimed for own code; upstream notices preserved on vendored code
- [ ] Licence compatibility checked
- [ ] Tests pass; coverage measured, adequate, in CI; tooling verified working
- [ ] CI exists and is green; claimed formal verification actually runs
- [ ] Zero compiler warnings; zero linter warnings
- [ ] Compiles from clean checkout in documented configuration; one build system
- [ ] No unused variables, imports, functions, constants, parameters; no TODOs
- [ ] Duplication noted — **and the copies diffed for divergence**
- [ ] Contracts inherit their declared interfaces
- [ ] `external` vs `public`; explicit state visibility; `immutable`/`constant`
- [ ] Custom errors; events on every state change including initialization,
      parameters indexed
- [ ] Docs, docstrings and comments match the code — narrower docstrings
      escalated as logic bugs
- [ ] README works from clean checkout; deploy scripts tested
- [ ] Privileged roles enumerated; setters bounded and delayed; ownership 2-step
      and multisig-held; standard implementations preferred over hand-rolled
