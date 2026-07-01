# Stock Events + Google Calendar Sync — Design

**Date:** 2026-07-01
**Status:** Approved (pending spec review)

## Goal

For every US equity holding, fetch upcoming major events (next earnings date, stock splits) and:

1. Display them inside the stock card in the app.
2. Sync them, plus a fixed set of macro market events, into a single Google Calendar named **"Stocks"**, with a notification reminder **2 days before** each event.

The calendar sync must be **free** and **automatic** (monthly refresh, no manual step).

## Scope

**In scope**
- Per-holding events: **next earnings date** and **stock splits**, for **US market holdings only** (`market === "us"`).
- Macro events (US market-moving), from a curated dates file: FOMC rate decision, Fed Chair press conference, Summary of Economic Projections (dot plot), CPI, Non-Farm Payrolls, Core PCE, GDP advance estimate, ISM Manufacturing PMI, Retail Sales. (Mega-cap corporate earnings are already covered per-holding.)
- In-app stock-card display of each US holding's next earnings + any split.
- One Google Calendar "Stocks" containing both stock and macro events.
- 2-day-before reminder on every event.
- Monthly automatic re-sync + on-demand manual sync.

**Out of scope**
- Events for EGX, ADX, crypto holdings (Yahoo has no earnings calendar for these; crypto has no earnings).
- Ex-dividend / dividend-pay events (explicitly not wanted).
- Two-way sync (calendar → app). One-way only (app → calendar).
- Any OAuth callback UI in the app (refresh token bootstrapped once, offline).

## Data Sources

### Stock events — Yahoo Finance (keyless)
`https://query1.finance.yahoo.com/v10/finance/quoteSummary/{SYMBOL}?modules=calendarEvents`
- `calendarEvents.earnings.earningsDate[]` → next earnings date (may be an estimated range until confirmed; when a range, use the earliest date and mark as estimated).
- Splits: sourced from `quoteSummary` split history / upcoming when present. Yahoo coverage of *upcoming* splits is spotty — include when present, no guarantee. Missing split data is not an error.
- Requires `User-Agent: Mozilla/5.0` header (same as existing price proxy).
- Missing earnings for a ticker → that holding contributes no event; not an error.

### Macro events — curated file (checked in)
`macro-events.json` at repo root. Shape:
```json
[
  { "type": "FOMC",   "title": "FOMC Rate Decision",        "date": "2026-01-28", "impact": 5 },
  { "type": "CPI",    "title": "CPI Release",               "date": "2026-01-13", "impact": 5 },
  { "type": "NFP",    "title": "Non-Farm Payrolls",         "date": "2026-01-09", "impact": 5 }
]
```
- Populated from the Federal Reserve FOMC calendar and the BLS release schedule, both published a full year in advance.
- Regenerated roughly once a year (or on request). Dates rarely move; this trades "live scraping" for reliability and zero runtime cost.
- The full event list (types, frequency, impact rating) is defined by the table in the original request; each row maps to one `type`.

## Components

### 1. `macro-events.json` (repo root)
Static curated dataset. Read by both `api/events.js` and `api/sync-calendar.js`.

### 2. `api/events.js` — GET (keyless, public)
- Input: query param or POST body listing US tickers (the app's current US holdings).
- Fetches each ticker's `calendarEvents` from Yahoo in parallel (`Promise.allSettled`), plus reads `macro-events.json`.
- Returns:
  ```json
  {
    "stockEvents": { "us:AAPL": { "earnings": "2026-02-05", "earningsEstimated": true, "split": null } },
    "macroEvents": [ { "type":"FOMC", "title":"...", "date":"2026-01-28", "impact":5 } ],
    "fetchedAt": "<iso>",
    "errors": []
  }
  ```
- Same CORS + error-shape conventions as the existing `api/prices.js`.
- Used by the app to render stock-card events. Does **not** touch Google.

### 3. `api/sync-calendar.js` — POST + cron (server-side, uses secrets)
- Builds the full event list: US-holding earnings/splits (via the same Yahoo logic) + macro events (from JSON).
  - The holdings list is the source of truth for which tickers to include. Passed in the request body (from the app) for the manual button; for the cron run, read from the persisted Supabase `portfolio_data` row (server-side), so the cron knows the current holdings without a browser.
- Authenticates to Google with a stored **refresh token** (OAuth as the calendar owner).
- Ensures a calendar named **"Stocks"** exists (create if missing); caches its calendarId in `GOOGLE_CALENDAR_ID` env once known.
- Upserts each event via `events.import` with a **deterministic `iCalUID`** so re-runs update in place and never duplicate. UID scheme:
  - Earnings: `earnings-{TICKER}-{YYYYMMDD}@ptracker`
  - Split: `split-{TICKER}-{YYYYMMDD}@ptracker`
  - Macro: `macro-{TYPE}-{YYYYMMDD}@ptracker`
- Each event: all-day, with `reminders.useDefault=false`, `overrides=[{ "method":"popup", "minutes":2880 }]` (2 days). Fires because the authenticated user owns the calendar.
- Removes stale future events it previously created but that are no longer in the current set (e.g., an earnings date that shifted quarters) — identified by the `@ptracker` UID namespace and a future date. Past events are left untouched.
- Returns `{ created, updated, deleted, errors[] }`.

### 4. Scheduling — `vercel.json` cron
- Add a monthly cron entry hitting `/api/sync-calendar`.
- Vercel Hobby free tier covers a monthly cron.

### 5. In-app stock card display
- On load (and after price refresh), the app calls `api/events.js` with its US tickers and stores results alongside `currentPrices`.
- Each US stock card renders a compact line: `Earnings: 2026-02-05 (est)` and, when present, `Split 10:1: 2026-06-10`. Unknown → omit the line (no noisy `—`).
- Add a **"Sync calendar"** button (near the existing Refresh button) that POSTs current US holdings to `api/sync-calendar` and surfaces the result/error in the same banner style as `priceMeta`.

## Secrets (Vercel server-side env — NOT `VITE_`)
| Name | Purpose |
|------|---------|
| `GOOGLE_CLIENT_ID` | OAuth client (Web) id |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Long-lived token, owner-scoped `calendar.events` |
| `GOOGLE_CALENDAR_ID` | Resolved id of the "Stocks" calendar (optional; function can resolve by name and cache) |

These are server-only (no `VITE_` prefix), so they are never shipped to the browser bundle. This is the first server-side secret in the project.

### One-time Google setup (documented, run once by the user)
1. Create a Google Cloud project; enable the Google Calendar API.
2. Create an OAuth client (type: Web / Desktop) → obtain client id + secret.
3. **Publish the OAuth consent screen to "Production"** (accept the one-time "unverified app" warning during auth). This is required so the refresh token does **not** expire after 7 days (which happens in "Testing" mode for the sensitive `calendar.events` scope).
4. Run a small local bootstrap script (provided) once: performs the OAuth flow, prints the refresh token.
5. Paste the four values into Vercel env vars; redeploy.

## Error Handling
- Yahoo unreachable / no earnings for a ticker → skip that ticker, add to `errors[]`, continue.
- Macro JSON parse error → surfaced in `errors[]`; sync proceeds with whatever parsed.
- Google auth failure (e.g., revoked/expired token) → return a clear error; app shows it in the banner so the user knows to re-bootstrap.
- Sync is idempotent, so a failed partial run is safe to re-run.

## Testing
- Unit: `macro-events.json` parses; event-builder produces stable `iCalUID`s for the same input (idempotency); estimated-earnings range collapses to earliest date.
- Manual: run `api/events.js` against real US tickers; confirm stock cards render earnings. Run `api/sync-calendar.js` in a dry-run mode (build event list, log, no write) before the first real write.
- Post-deploy: trigger a manual sync, confirm events appear in the "Stocks" calendar with a 2-day reminder, re-run and confirm **no duplicates**.

## Build Phases
- **Phase 1 (no Google):** `macro-events.json` + `api/events.js` + stock-card display. Delivers visible value with zero Google setup.
- **Phase 2 (Google):** one-time OAuth bootstrap + `api/sync-calendar.js` + `vercel.json` cron + "Sync calendar" button.

## Open Assumptions
- Yahoo `quoteSummary` remains keyless and stable (same risk profile as the existing price proxy; if it breaks, errors surface in the banner).
- The user completes the one-time Google Cloud setup and publishes the app to Production.
- Cron reads current holdings from the persisted Supabase row; the app writes holdings there already (existing behavior).
