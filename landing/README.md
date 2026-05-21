# Loreum landing site

Marketing site for [loreum.org](https://loreum.org) (React + Vite).

## Development

```bash
cd landing
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). **Do not** open `index.html` directly in the browser — that skips Vite and causes MIME errors on `/src/main.tsx`.

## Production build

```bash
npm run build
npm run preview   # serves dist/ locally
```

After `build`, `dist/index.html` must reference bundled files under `/assets/`, **not** `/src/main.tsx`. If you see a MIME error for `main.tsx` in production, the host is serving **source** files instead of **`dist/`**.

## Deploy

| Platform | Settings |
|----------|----------|
| **Vercel** | Root: `landing`, uses `vercel.json` |
| **Netlify** | Base: `landing`, publish: `dist`, uses `netlify.toml` |
| **Railway** | Root: `landing`, uses `railway.toml` — build then `serve dist` |

Always run `npm run build` before deploy. Publish the **`dist`** folder only.

## Troubleshooting console messages

| Message | Cause |
|---------|--------|
| `Failed to load module script … MIME type "text/plain" … main.tsx` | Static host serving dev `index.html` or raw `.tsx` files. Fix: deploy **`dist`** after `npm run build`, or use `npm run dev` locally. |
| `SES Removing unpermitted intrinsics` / `lockdown-install.js` | Usually a **browser extension** (e.g. MetaMask), not this repo. Safe to ignore if the app loads. |
| `listener indicated an asynchronous response… message channel closed` | Usually a **browser extension** (Chrome). Not from landing code. |
