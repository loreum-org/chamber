# product/mockups — Loreum UX mockups

Static, high-fidelity HTML mockups of what the Loreum app and ecosystem should
look like under the revised plan: Ethereum mainnet first, LORE owned by a
timelocked mint gate, and multichain kept behind the Phase 2 gate.

Open `index.html` in a browser. There is no build step. Pages load IBM Plex
from Google Fonts and share `assets/app.css`.

## Why these exist

They turn the multichain strategy review and the chamber repo plan into
screens the team can react to before building. Each page has numbered design
notes that cite the plan tasks it implements (for example `M-15`, `I-10`,
`P-19`).

- Review: TeamShared file "Loreum Multichain Strategy Review" (Loreum project)
- Plan: TeamShared task "Chamber repo plan: mainnet-first roadmap (M0–M3)",
  including the subtask "UX mockups: Loreum app and ecosystem surfaces"

## Files

| Group | Pages |
|---|---|
| App · governance (M1) | `app-overview`, `app-board`, `app-queue`, `app-proposal`, `app-session-keys`, `app-migrate`, `app-indexer-states` |
| Supply authority & safety (M1) | `app-supply-authority`, `app-guardian`, `app-handoff-preflight` |
| Phase 2 previews (gated) | `p2-multichain-treasury`, `p2-cross-chain-proposal`, `p2-bridge-template` |
| Ecosystem | `eco-landing`, `eco-explorers`, `eco-trust` |
| Internal | `ops-gate-dashboard` |
| Scaffolding | `_shell.html` (page template), `_mock-data.md` (shared data), `assets/app.css` |

## Rules the mockups follow

- **Design system:** Chamber Design System v1.0 (epic #258): IBM Plex Sans/Mono,
  weights 300/400/600, one functional accent (#4A2F8F), depth by surface
  layering, the authority chain (seat → owner → session key) as the signature
  element, and destructive actions as a ghost button plus a typed confirmation.
  The Explorers site is the exception: it's a bold, art-forward showcase.
- **Reads:** all display state comes from chamber-indexer, with a freshness chip
  in the top bar. RPC is used only at transaction time (simulate/preflight,
  write, receipt).
- **Scope:** no cut features (operator staking, 15–30 s bridging, solver
  auctions, natural-language signing). Phase 2 screens carry a "gated" ribbon.
- **Honesty:** no "audited" claims except clearly marked placeholders on
  post-audit screens.

## Mock data

`_mock-data.md` holds every name, number, address and date. Addresses marked
*illustrative* are placeholders, not deployments.
