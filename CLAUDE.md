# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

No linting or test suite is configured.

## Architecture

This is a single-page React app built with Vite, deployed to both Netlify and Vercel (same `dist/` build; each platform serves the price proxy at `/api/prices`).

**Entry point:** `src/main.jsx` → imports `PortfolioTracker` from `../portfolio_tracker.jsx`  
**Main file:** `portfolio_tracker.jsx` (root level) — the entire app lives here as one file.

`portfolio_tracker_1.jsx` and `portfolio_tracker_2.jsx` are legacy/archived versions.

### Data Model

All state persists to `localStorage` under key `portfolio-tracker-v6`. The shape is:

```js
{
  transactions: [{ id, market, type, ticker, qty, price, date, bucket, notes, currency }],
  topups:       [{ id, market, type, amount, date, notes, currency }],
  fxRates:      { USD: 1, USDT: 1, EGP: 0.0196, AED: 0.2723 },
  currentPrices: { "market:TICKER": "price" }
}
```

On first load with no stored data, `SEED_DATA` is written to localStorage as demo content.

### Markets & Currencies

Four markets are supported: `egx` (EGP), `adx` (AED), `us` (USD), `crypto` (USDT). FX rates convert all values to USD for portfolio-wide aggregation.

### Theme System (Mackenzy Colour Standard)

Two theme objects `DARK` and `LIGHT` define all colours. The active theme is passed as the prop `T` to every component — never access these objects directly in child components. Style factories (`mkInput(T)`, `mkSelect(T)`, `mkBtnPrimary(T)`, `mkBtnSecondary(T)`) produce inline style objects.

Theme preference persists to `localStorage` under key `portfolio-theme-v1`.

### Analytics (`useMemo` in `PortfolioTracker`)

P&L is computed by replaying transactions into a `holdingMap` keyed by `market:ticker`. Sells reduce qty and cost basis using the running average cost (not FIFO). Holdings with `qty ≤ 0.0001` are treated as closed positions. All analytics are derived from this single `useMemo` block — no separate state.

### Price Updates

**Auto-fetch (US, crypto, FX):** US stock prices, crypto prices, and FX rates (AED/EGP→USD; USDT pinned to 1) are fetched automatically from **Yahoo Finance** (keyless, free) through a serverless proxy. The proxy exists twice, identical in behaviour — `api/prices.js` (Vercel) and `netlify/functions/prices.js` (Netlify); `netlify.toml` redirects `/api/prices` → the Netlify function, so the client always POSTs to `/api/prices` regardless of host. No API key is involved (Yahoo's public `query1`/`query2` chart endpoints; each request has a 6s `AbortController` timeout and falls back across both hosts). The client calls it via `refreshPrices()` in `portfolio_tracker.jsx` (POST body `{ stocks, crypto, fx }`), which auto-runs once on load if cached prices are older than 10 minutes, and on demand via the top-bar **🔄 Refresh** button. Results merge into `currentPrices`/`fxRates` and persist (localStorage + Supabase). `priceMeta = { lastFetchedAt, errors }` tracks the last fetch; errors surface as a red banner.

**Manual (EGX, ADX):** `MANUAL_MARKETS = ["egx","adx"]`. `refreshPrices()` never requests EGX/ADX tickers (only `us`/`crypto`/`fx`), so these stay manual via the "Update Prices" modal. (The proxy *can* resolve EGX via Yahoo's `.CA` suffix, but the client does not use it.) Manual edits stamp `priceEditedAt[market:ticker]`, and these holdings show a red **● manual · Nd ago** badge in the holdings table. Auto-fetch never overwrites EGX/ADX values.

Holdings without a price show `—` for P&L.

### Supabase Sync

`@supabase/supabase-js` is used as a cloud persistence layer on top of `localStorage`. The client is initialised at module level using two Vite env vars:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Store these in `.env.local` (gitignored) for local dev and in the Netlify/Vercel site environment variables for production. The price proxy needs no key (Yahoo is keyless), so there are no server-side-only env vars.

**Data flow:**
- `loadData()` (async): checks for an active Supabase session → if online, fetches `portfolio_data` row and writes it to `localStorage` → falls back to `localStorage` on failure or offline.
- `saveData(payload)` (async): writes to `localStorage` synchronously, then fires a background Supabase upsert. Returns `"synced"` or `"offline"`. On failure, registers a `window online` listener to retry.

**Supabase table:** `portfolio_data` — columns `id` (uuid PK), `user_id` (uuid, unique, FK → `auth.users`), `data` (jsonb), `updated_at` (timestamptz). Row Level Security restricts all operations to `auth.uid() = user_id`.

**Auth:** Supabase email/password. The `LoginModal` component is shown full-screen when no active session is found. The single account is created once in the Supabase dashboard — there is no sign-up flow in the app.

**`SyncStatus` pill** in the top bar shows `synced` (green), `syncing…` (gold), or `offline` (gold) using `T.green` / `T.gold` theme colours.

### Deployment

**Netlify** reads `netlify.toml`: build `npm run build`, publish `dist/`, functions in `netlify/functions`; redirects map `/api/prices` → the prices function and add an SPA fallback to `index.html`.

**Vercel** reads `vercel.json`: `api/prices.js` is auto-served as a serverless function at `/api/prices`; the rewrite sends every non-`/api/` path to `index.html` for SPA routing. See `DEPLOY_VERCEL.md` for the full Vercel setup.

On either platform set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the site environment variables.

## Behavioral Guidelines

These principles reduce coding mistakes and rewrites:

**1. Think Before Coding** — State assumptions explicitly. If uncertain, ask. Surface confusion and present tradeoffs rather than making silent assumptions about unclear requirements.

**2. Simplicity First** — Minimum code that solves the problem. Nothing speculative. Avoid unrequested features, premature abstractions, or unnecessary error handling. Ask: would a senior engineer consider this overcomplicated?

**3. Surgical Changes** — Touch only what you must. Clean up only your own mess. When editing existing code, preserve surrounding style and only remove code that your specific changes orphaned — don't refactor unrelated sections.

**4. Goal-Driven Execution** — Define success criteria. Loop until verified. Transform vague tasks into measurable objectives with clear verification steps before implementation.
