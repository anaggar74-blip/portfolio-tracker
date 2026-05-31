# Supabase Sync — Design Spec
Date: 2026-06-01

## Overview

Add Supabase as a cloud persistence layer to the portfolio tracker. The app currently stores all state in `localStorage`. This spec adds Supabase as a background sync target so the same data is available on both laptop and phone, with full offline support.

## Requirements

- Single user (no multi-user, no user-switching)
- Works offline — localStorage is always the primary read/write store
- Syncs to Supabase in the background when online
- Real data visible on every device after a page load
- No data loss in any offline/failure scenario

## Approach

**Option A — localStorage-first with background Supabase sync.** localStorage handles all reads and writes instantly. Every save also fires an async Supabase upsert. On load, if online, Supabase is fetched first to pull in changes from other devices. Last-write-wins is acceptable for a single user.

## Supabase Table

Table name: `portfolio_data`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | primary key, default `gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users`, unique |
| `data` | jsonb | the full state blob |
| `updated_at` | timestamptz | default `now()` |

The `data` column stores the existing shape verbatim:
```json
{
  "transactions": [...],
  "topups": [...],
  "fxRates": { "USD": 1, "USDT": 1, "EGP": 0.0196, "AED": 0.2723 },
  "currentPrices": { "market:TICKER": "price" }
}
```

Row Level Security policies:
- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `auth.uid() = user_id`
- `UPDATE`: `auth.uid() = user_id`

## Auth

Supabase email/password authentication. The user logs in once per device; the session is persisted automatically by the Supabase client. A `LoginModal` component is shown only when no active session is found (first visit on a new device). Once logged in, the modal is never shown again unless the session expires.

No sign-up flow — the single account is created once in the Supabase dashboard.

## Data Flow

### On app load (`loadData`)
1. Check for active Supabase session.
2. If no session → show `LoginModal`; after login, continue from step 3.
3. If online → fetch `portfolio_data` row for `auth.uid()`.
   - On success → write to localStorage, return data.
   - On failure → fall back to localStorage.
4. If offline → use localStorage directly.

### On every state change (`saveData`)
1. Write to localStorage immediately (synchronous, no user-visible delay).
2. Fire async Supabase upsert in the background.
   - On success → set sync status to `synced`.
   - On failure → set sync status to `offline`; register a `window` `online` event listener to retry.

### Reconnect handling
When `window` fires `online`, flush the latest localStorage state to Supabase and clear the pending flag.

## New Components

### `LoginModal`
- Email + password inputs, submit button.
- Uses Supabase `signInWithPassword`.
- Matches existing Mackenzy colour scheme (inline styles using `T` theme prop).
- Shown full-screen with a semi-transparent overlay.
- No "forgot password" or "sign up" — single account only.

### `SyncStatus` pill
- Displayed in the top bar, right side.
- Three states:

| State | Label | Colour |
|---|---|---|
| `synced` | Synced ✓ | `T.green` |
| `syncing` | Syncing… | `T.gold` |
| `offline` | Offline | `T.gold` |

## Error Handling

| Scenario | Behaviour |
|---|---|
| Supabase unreachable on load | Fall back to localStorage; show Offline pill |
| Supabase write fails | Keep localStorage; retry on `online` event |
| Session expired | Show `LoginModal`; localStorage data preserved |
| First load, no localStorage, offline | App loads with empty state (existing behaviour) |
| Supabase and localStorage conflict | Supabase wins on load; localStorage wins when offline |

## Dependencies

- `@supabase/supabase-js` — added to `package.json`
- Supabase project URL and anon key — stored as Vite env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in `.env.local` (not committed) and in Netlify environment variables for the deployed build.

## Files Changed

| File | Change |
|---|---|
| `package.json` | add `@supabase/supabase-js` |
| `.env.local` | new — Supabase URL + anon key (gitignored) |
| `.gitignore` | ensure `.env.local` is ignored |
| `portfolio_tracker.jsx` | update `loadData`, `saveData`, add `LoginModal`, `SyncStatus`, auth init `useEffect` |

No new files beyond `.env.local`. All logic stays in `portfolio_tracker.jsx`.

## Out of Scope

- Real-time push sync (Supabase Realtime subscriptions) — can be added later
- Conflict merging — last-write-wins is sufficient for single user
- Sign-up flow — account created once in Supabase dashboard
