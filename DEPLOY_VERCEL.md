# Deploy this project to Vercel

These are step-by-step instructions for an AI agent (or a human) to deploy this
app to **Vercel**. The project currently targets **Netlify**, so a few files
must be adapted. Follow every step in order.

## What this project is

- **Vite + React** single-page app. Build output goes to `dist/`.
- Build command: `npm run build`. Install: `npm install`.
- **One serverless function**: a price/FX proxy. It is currently written in
  **Netlify Functions** format at `netlify/functions/prices.js` and the client
  calls it at `/.netlify/functions/prices`.
- **Supabase** is used for auth + cloud sync via two public env vars.
- The price feed uses **keyless Yahoo Finance** — there is **no API key** to set
  for prices. Ignore any old mention of `TWELVEDATA_API_KEY`; it is unused.

---

## Step 1 — Convert the serverless function to Vercel format

Vercel serverless functions live in an `/api` folder and use the Node
`(req, res)` signature, not Netlify's `handler(event)`.

**Create a new file `api/prices.js`** with this content (it preserves the exact
same request/response shape the client expects):

```js
// Live price + FX proxy via Yahoo Finance (keyless, free).
// POST body: { stocks: ["AAPL"], crypto: ["BTC"], egx: ["COMI"], fx: ["AED","EGP"] }
// Returns:   { prices: {...}, fxRates: {...}, fetchedAt: "<iso>", errors: [] }

const YF = "https://query1.finance.yahoo.com/v8/finance/chart/";

function yahooSymbol(kind, ticker) {
  if (kind === "crypto") return `${ticker}-USD`;
  if (kind === "egx") return `${ticker}.CA`;
  if (kind === "fx") return `${ticker}USD=X`;
  return ticker; // us
}

async function fetchOne(symbol) {
  const url = `${YF}${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } });
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (price === undefined || price === null) {
    const code = json?.chart?.error?.code || res.status;
    throw new Error(String(code));
  }
  return Number(price);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ errors: ["Method not allowed"] });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const arr = (v) => (Array.isArray(v) ? v : []);

  const map = [];
  arr(body.stocks).forEach(t => map.push({ kind: "stock", ticker: t, symbol: yahooSymbol("stock", t) }));
  arr(body.crypto).forEach(t => map.push({ kind: "crypto", ticker: t, symbol: yahooSymbol("crypto", t) }));
  arr(body.egx).forEach(t => map.push({ kind: "egx", ticker: t, symbol: yahooSymbol("egx", t) }));
  arr(body.fx).forEach(c => map.push({ kind: "fx", ticker: c, symbol: yahooSymbol("fx", c) }));

  const prices = {};
  const fxRates = { USDT: 1 };
  const errors = [];

  if (map.length === 0) {
    return res.status(200).json({ prices, fxRates, fetchedAt: new Date().toISOString(), errors });
  }

  const results = await Promise.allSettled(map.map(m => fetchOne(m.symbol)));
  results.forEach((r, i) => {
    const m = map[i];
    if (r.status !== "fulfilled" || !isFinite(r.value)) {
      errors.push(`${m.symbol}: ${(r.reason && r.reason.message) || "no data"}`);
      return;
    }
    if (m.kind === "fx") fxRates[m.ticker] = r.value;
    else if (m.kind === "crypto") prices[`crypto:${m.ticker}`] = String(r.value);
    else if (m.kind === "egx") prices[`egx:${m.ticker}`] = String(r.value);
    else prices[`us:${m.ticker}`] = String(r.value);
  });

  return res.status(200).json({ prices, fxRates, fetchedAt: new Date().toISOString(), errors });
}
```

You may delete `netlify/functions/prices.js` and `netlify.toml`, or leave them —
Vercel ignores them. (Leaving them keeps Netlify working too.)

---

## Step 2 — Point the client at the Vercel endpoint

In `portfolio_tracker.jsx`, find the fetch call (around line 1203):

```js
const res = await fetch("/.netlify/functions/prices", {
```

Change the path to the Vercel function path:

```js
const res = await fetch("/api/prices", {
```

> Alternative (no code change): instead of editing the fetch, add a `vercel.json`
> rewrite so the old path still works:
> ```json
> { "rewrites": [{ "source": "/.netlify/functions/prices", "destination": "/api/prices" }] }
> ```
> Pick **one** approach — editing the fetch path is cleaner.

---

## Step 3 — Add SPA routing config (recommended)

So that client-side routes/refreshes resolve to `index.html`, create
`vercel.json` at the project root (merge with the rewrite above if you used it):

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

This sends every non-`/api` path to the SPA while leaving the serverless
function reachable.

---

## Step 4 — Deploy

### Option A — Vercel Dashboard (Git import)
1. Push the repo to GitHub/GitLab/Bitbucket (commit the changes from Steps 1–3).
2. Go to https://vercel.com/new and **Import** the repository.
3. Vercel auto-detects **Vite**. Confirm settings:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. Add Environment Variables (Step 5) **before** clicking Deploy.
5. Click **Deploy**.

### Option B — Vercel CLI
```bash
npm i -g vercel
vercel login
vercel            # first run links/creates the project (accept Vite defaults)
vercel --prod     # production deploy
```
Set env vars with `vercel env add` (Step 5) before `vercel --prod`, then redeploy.

---

## Step 5 — Environment variables (required)

Set these in **Vercel → Project → Settings → Environment Variables** for the
**Production** (and Preview, if desired) environments:

| Name | Value | Notes |
|------|-------|-------|
| `VITE_SUPABASE_URL` | your Supabase project URL | Public; baked into the client at build time. |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key | Public anon key only. |

- **Do NOT** set `TWELVEDATA_API_KEY` — the price feed is keyless now.
- `VITE_*` vars are read at **build time**, so after adding/changing them you
  must **redeploy** for them to take effect.
- Get the values from the existing Netlify site env vars or the Supabase
  dashboard (Project Settings → API).

---

## Step 6 — Verify after deploy

1. Open the deployed URL. The Supabase **login screen** should appear (full-page
   `LoginModal`). Log in with the existing account.
2. Click the top-bar **🔄 Refresh** button. Prices/FX should update and the
   error banner should stay hidden.
3. Directly test the function:
   ```bash
   curl -X POST https://<your-app>.vercel.app/api/prices \
     -H "Content-Type: application/json" \
     -d '{"stocks":["AAPL"],"crypto":["BTC"],"fx":["AED","EGP"]}'
   ```
   Expect JSON like `{ "prices": { "us:AAPL": "..." }, "fxRates": { ... }, "errors": [] }`.
4. Confirm sync: the **SyncStatus** pill in the top bar should read **synced**
   (green), proving the Supabase env vars are correct.

---

## Summary of changes the AI must make

1. **Add** `api/prices.js` (Vercel-format function — code above).
2. **Edit** `portfolio_tracker.jsx`: change fetch path to `/api/prices`.
3. **Add** `vercel.json` with the SPA rewrite.
4. **Set** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel.
5. **Deploy** and run the Step 6 verification.
