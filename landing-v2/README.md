# landing-v2 — standalone landing page + blog

Static, self-contained HTML (no build step). Ported from the landing-page v2 work done in
`#danny` (Sept 29 – Oct 1, 2026): research-backed copy, governance-attack resistance section,
regulatory positioning, liquid-delegation messaging, and the standalone blog.

## Contents

- `index.html` — Loreum landing page v2 (hero, mission, regulatory challenge, attack resistance,
  regulatory future, how it works, autonomous architecture, why Chamber Protocol, latest updates, CTA)
- `blog/index.html` — blog index
- `blog/how-governance-attacks-happen.html` — "How Governance Attacks Happen: A Technical Deep Dive"
- `blog/governance-national-security.html` — "Governance as National Security"
- `blog/when-ai-agents-govern.html` — "When AI Agents Govern"
- `blog/inside-chamber-protocol.html` — "Inside Chamber Protocol"
- `governance-calculator.html` — Governance Power Calculator (p5.js interactive)

## Notes

- All pages are standalone; fonts/CDN assets load from Google Fonts and cdn.loreum.org.
- Blog posts cross-link within `blog/`; nav links back to `../index.html`.
- The React landing page under `landing/` remains the deployable app; this folder is the
  static v2 design for review.
