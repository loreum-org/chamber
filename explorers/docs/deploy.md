# Explorers — Deployment

## Platform

Explorers is hosted on **Railway** (same platform as `app/`), but as a
**separate project** with its own env vars and domain.

- **Production**: `explorers.loreum.org` → Railway service
- **Preview deploys**: automatic per-PR via Railway PR Environments

## Railway setup (one-time)

1. Create a new Railway project: `loreum-explorers`
2. Add a service, set **root directory** to `explorers/`
3. Connect the GitHub repo `loreum-org/chamber`
4. Enable **PR Environments** in project settings for preview deploys per PR
5. Set env vars in the Railway dashboard (see `.env.example` for the full list):
   - `VITE_WALLETCONNECT_PROJECT_ID` — **required** in production
   - `VITE_MAINNET_RPC_URL` — dedicated RPC endpoint recommended
   - `VITE_SEPOLIA_RPC_URL` — optional, falls back to public RPC
   - `VITE_LOREUM_NFT_MAINNET` / `VITE_LOREUM_NFT_SEPOLIA` — have defaults
6. Add custom domain `explorers.loreum.org` in the service settings

## DNS

After Railway assigns a domain, Chad adds this record in Route53:

| Type | Name | Value |
|------|------|-------|
| CNAME | explorers | `<railway-assigned-domain>` |

The exact CNAME target is shown in the Railway service's "Domains" tab after
adding `explorers.loreum.org` as a custom domain.

## Chain defaults

- **Production**: Mainnet is the default chain; Sepolia available via selector.
- **Preview / dev**: Same — mainnet default, Sepolia available.

## Do NOT

- Reuse `app/`'s Railway project or env vars.
- Point DNS yourself — that's Chad's step after the Railway domain is ready.
