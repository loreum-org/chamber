# Codex Backend: Known Limitations (BETA)

> **Status**: Claude Code is the default, fully-supported backend. The OpenAI
> [Codex CLI](https://github.com/openai/codex) (`codex exec`) is a
> **cost-saving BETA** added in v2.1.0. It works for full smart-contract and L1
> audits, but the caveats below are real and worth understanding before you
> rely on it for a high-value review.

This page consolidates the Codex caveats that are otherwise scattered across
[mcp-servers.md](mcp-servers.md), [usage.md](usage.md),
[updating.md](updating.md), and the [CHANGELOG](../CHANGELOG.md). Everything
here is derived from the shipped code and docs — nothing speculative.

For what Codex *does* support and how to install it, see
[architecture.md § Codex Backend](architecture.md#codex-backend-cost-saving-beta)
and the [README Codex section](../README.md#codex-cli-backend-beta--cost-saving).

---

## 1. Reduced agent fan-out vs Claude (recall implication)

The Claude backend supervises one PTY worker per output artifact for the
parallel discovery phases (breadth, depth, rescan). Codex invokes `codex exec`
directly — depth fans out as one `codex exec` per depth job (which fixes the
single-subprocess "never-cut-stub" halt), but the PTY worker-pool transport
itself is Claude-only.

Practically: the Claude PTY transport, its per-host transport preflight, and
the compaction-as-informational heartbeat are Claude-only paths. For the
broadest agent fan-out and the deepest recall, the Claude backend remains the
recommended choice — the README says as much: *"If you only have time to
install one, pick Claude Code."* Treat Codex as the cost-saving alternative,
not a recall-equivalent substitute.

## 2. MCP tools are partially disabled / wrapped on Codex

MCP runs natively on both backends, but two Codex-specific constraints apply
(`scripts/codex_adapter.py`):

- **`evm-chain-data` is disabled on Codex** due to an MCP protocol version
  mismatch — no on-chain ABI/state queries via that server when running under
  Codex.
- **Four Python MCP servers** (`slither-analyzer`, `unified-vuln-db`,
  `farofino`, `solana-fender`) are launched through
  `mcp-packages/schema-sanitizer.js`, which strips `oneOf`/`allOf` JSON-schema
  constructs that Codex rejects.

When an MCP-backed lane is unavailable, the affected phases fall back to
**WebSearch** (e.g. RAG validation searches `site:solodit.xyz`) or to
grep-based static analysis, exactly as they do on Claude when a key is missing
— the pipeline degrades gracefully rather than halting, but with less
historical-precedent and static-analysis coverage. See
[mcp-servers.md](mcp-servers.md) for the full server matrix.

## 3. MCP tool permissions cannot be pre-configured

Codex tool permissions are **interactive on first use** — you must select
"Always allow" on the first prompt per MCP server. They cannot be merged in
ahead of time the way Claude Code permissions are
(`plamen.py:_install_codex_adapter`). Plan for a few interactive approvals at
the start of your first Codex run.

## 4. Speculative model mapping with silent downgrade

Plamen's tier aliases (`opus` / `sonnet` / `haiku`) are mapped to Codex models
in `_CODEX_MODEL_MAP` (`scripts/plamen_types.py`):

| Plamen tier | Default Codex model | Override env var |
|-------------|--------------------|------------------|
| `opus` | `gpt-5.5` | `PLAMEN_CODEX_OPUS_MODEL` |
| `sonnet` | `gpt-5.4` | `PLAMEN_CODEX_SONNET_MODEL` |
| `haiku` | `gpt-5.4-mini` | `PLAMEN_CODEX_HAIKU_MODEL` |

Two things to know:

- These mappings are **speculative defaults** — if the named OpenAI models
  change or aren't available to your account, override them with the env vars
  above (or `PLAMEN_CODEX_FALLBACK_MODELS` for the fallback chain).
- `_resolve_codex_model_alias` **silently downgrades an unknown alias to the
  sonnet-tier model** rather than erroring. If you pass a model name the
  resolver doesn't recognize, you will quietly get the `sonnet` mapping instead
  of a hard failure — double-check the startup banner / model routing if cost
  or quality looks off.

## 5. ChatGPT-auth / usage-cap behavior

Codex usage-cap and ChatGPT-subscription quota errors arrive as
**natural-language prose, not structured error codes**. The driver detects
these and **auto-waits** (preserving state) instead of treating them as a phase
failure that retries into a halt (`scripts/plamen_driver.py`). A
`context-exceeded` condition is likewise recoverable rather than fatal.

This means a Codex audit on a capped ChatGPT subscription will pause and resume
rather than crash — but you are still subject to your ChatGPT/Codex account's
own auth and usage limits, which Plamen cannot raise.

## 6. `plamen compare` is Claude-only

The `plamen compare` command (diff two audit reports / post-mortem analysis)
runs `/plamen compare` inside a **Claude Code** session and requires `claude`
in PATH — it exits if `claude` is not found (`plamen.py:launch_claude`). There
is no Codex code path for `compare`. If you only have Codex installed, the
audit pipeline works but `compare` will not.

---

## See also

- [getting-started.md](getting-started.md) · [usage.md](usage.md) · [architecture.md](architecture.md) · [mcp-servers.md](mcp-servers.md) · [updating.md](updating.md)
