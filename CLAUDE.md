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

This is a single-page React app built with Vite, deployed to Netlify.

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

There is no live price feed. Prices are entered manually via the "Update Prices" modal and stored in `currentPrices`. Holdings without a price show `—` for P&L.

### Deployment

Netlify reads `netlify.toml`: build command is `npm run build`, publish dir is `dist/`.

## Behavioral Guidelines

These principles reduce coding mistakes and rewrites:

**1. Think Before Coding** — State assumptions explicitly. If uncertain, ask. Surface confusion and present tradeoffs rather than making silent assumptions about unclear requirements.

**2. Simplicity First** — Minimum code that solves the problem. Nothing speculative. Avoid unrequested features, premature abstractions, or unnecessary error handling. Ask: would a senior engineer consider this overcomplicated?

**3. Surgical Changes** — Touch only what you must. Clean up only your own mess. When editing existing code, preserve surrounding style and only remove code that your specific changes orphaned — don't refactor unrelated sections.

**4. Goal-Driven Execution** — Define success criteria. Loop until verified. Transform vague tasks into measurable objectives with clear verification steps before implementation.
