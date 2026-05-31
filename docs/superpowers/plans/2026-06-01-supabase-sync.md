# Supabase Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase as a background cloud sync layer so portfolio data persists across devices, with localStorage as the offline-first primary store.

**Architecture:** localStorage handles all reads/writes instantly (no perceived latency). Every save also fires an async Supabase upsert. On load, if a session exists and the device is online, Supabase is fetched first to pull in changes from other devices. Auth uses Supabase email/password; session persists across page loads.

**Tech Stack:** React 18, Vite, `@supabase/supabase-js` v2, Supabase hosted Postgres + Auth

---

## Task 1: Create Supabase project and table (manual steps)

**Files:** none (Supabase dashboard)

- [ ] **Step 1: Create a free Supabase project**

  Go to https://supabase.com, sign in, click "New project". Choose a name (e.g. `portfolio-tracker`), set a strong database password, pick the region closest to you. Wait for provisioning (~2 min).

- [ ] **Step 2: Create the `portfolio_data` table**

  In the Supabase dashboard → SQL Editor → New query. Paste and run:

  ```sql
  create table portfolio_data (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) not null unique,
    data jsonb not null default '{}',
    updated_at timestamptz default now() not null
  );

  alter table portfolio_data enable row level security;

  create policy "select own" on portfolio_data
    for select using (auth.uid() = user_id);

  create policy "insert own" on portfolio_data
    for insert with check (auth.uid() = user_id);

  create policy "update own" on portfolio_data
    for update using (auth.uid() = user_id);
  ```

- [ ] **Step 3: Create your user account**

  In the Supabase dashboard → Authentication → Users → "Invite user". Enter your email and a password. Confirm via the email link. This is the only account — no sign-up flow in the app.

- [ ] **Step 4: Note down your project credentials**

  In the dashboard → Settings → API. You need:
  - **Project URL** (looks like `https://xxxx.supabase.co`)
  - **anon public key** (long JWT string under "Project API keys")

---

## Task 2: Install dependency and create env files

**Files:**
- Modify: `package.json`
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Install `@supabase/supabase-js`**

  ```bash
  npm install @supabase/supabase-js
  ```

  Expected: `package.json` now lists `"@supabase/supabase-js": "^2.x.x"` in `dependencies`.

- [ ] **Step 2: Create `.env.local`**

  Create the file `c:\Users\Lenovo\Downloads\portifolio tracker\.env.local` with your actual credentials from Task 1 Step 4:

  ```
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```

- [ ] **Step 3: Create `.gitignore`**

  Create the file `c:\Users\Lenovo\Downloads\portifolio tracker\.gitignore`:

  ```
  node_modules/
  dist/
  .env.local
  .env*.local
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add .gitignore package.json package-lock.json
  git commit -m "feat: install @supabase/supabase-js and add gitignore"
  ```

---

## Task 3: Add Supabase client and update loadData / saveData

**Files:**
- Modify: `portfolio_tracker.jsx` — top of file, replacing the existing `loadData` and `saveData` functions (lines 29–39)

- [ ] **Step 1: Add the Supabase import and client at the top of `portfolio_tracker.jsx`**

  After the existing React import (line 1), add:

  ```js
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  ```

- [ ] **Step 2: Replace `loadData` (currently lines 29–34) with the Supabase-aware version**

  Remove:
  ```js
  async function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  ```

  Replace with:
  ```js
  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && navigator.onLine) {
        const { data: row, error } = await supabase
          .from("portfolio_data")
          .select("data")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!error && row) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(row.data));
          return row.data;
        }
      }
    } catch {}
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  ```

- [ ] **Step 3: Replace `saveData` (currently lines 36–39) with the Supabase-aware version**

  Remove:
  ```js
  async function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { console.error("Save failed:", e); }
  }
  ```

  Replace with:
  ```js
  async function saveData(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) { console.error("Save failed:", e); }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !navigator.onLine) return "offline";
      const { error } = await supabase
        .from("portfolio_data")
        .upsert(
          { user_id: session.user.id, data: payload, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      return error ? "offline" : "synced";
    } catch {
      return "offline";
    }
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add portfolio_tracker.jsx
  git commit -m "feat: add Supabase client, update loadData and saveData"
  ```

---

## Task 4: Add LoginModal component

**Files:**
- Modify: `portfolio_tracker.jsx` — add new component after the `ThemeToggle` component (after line 439)

- [ ] **Step 1: Add `LoginModal` component after `ThemeToggle` and before the `// ─── Main App ───` comment**

  ```jsx
  // ─── Login Modal ───
  function LoginModal({ T }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const IS = mkInput(T);
    const BP = mkBtnPrimary(T);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setBusy(false); }
    };

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: T.mainBg, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          background: T.cardBg, border: `1px solid ${T.border}`,
          borderRadius: 12, width: "100%", maxWidth: 360, padding: 28,
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text }}>Portfolio Tracker</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMuted }}>Sign in to sync your portfolio</p>
          </div>
          <form onSubmit={handleSubmit}>
            <Field label="Email" T={T}>
              <input style={IS} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoFocus />
            </Field>
            <Field label="Password" T={T}>
              <input style={IS} type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" />
            </Field>
            {error && <p style={{ color: T.red, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
            <button style={{ ...BP, width: "100%", marginTop: 4 }} type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add portfolio_tracker.jsx
  git commit -m "feat: add LoginModal component"
  ```

---

## Task 5: Add SyncStatus component

**Files:**
- Modify: `portfolio_tracker.jsx` — add after `LoginModal`

- [ ] **Step 1: Add `SyncStatus` component immediately after `LoginModal`**

  ```jsx
  // ─── Sync Status Pill ───
  function SyncStatus({ status, T }) {
    const cfg = {
      synced:  { label: "Synced ✓", color: T.green },
      syncing: { label: "Syncing…",  color: T.gold  },
      offline: { label: "Offline",   color: T.gold  },
    }[status] ?? { label: "Synced ✓", color: T.green };
    return (
      <div style={{
        padding: "5px 10px", borderRadius: 20,
        background: T.surfaceBg, border: `1px solid ${T.border}`,
        fontSize: 11, fontWeight: 600, color: cfg.color, letterSpacing: "0.3px",
      }}>
        {cfg.label}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add portfolio_tracker.jsx
  git commit -m "feat: add SyncStatus pill component"
  ```

---

## Task 6: Wire auth, syncStatus state, and reconnect into PortfolioTracker

**Files:**
- Modify: `portfolio_tracker.jsx` — inside `PortfolioTracker` component (starting at line 442)

- [ ] **Step 1: Add new state variables**

  In `PortfolioTracker`, after the existing state declarations (after line 456 `const [marketFilter, setMarketFilter] = useState("all");`), add:

  ```js
  const [showLogin, setShowLogin] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced");
  ```

- [ ] **Step 2: Replace the existing `useEffect` data-load (lines 464–474) with the new auth+load effect**

  Remove:
  ```js
  useEffect(() => {
    loadData().then(d => {
      if (d && d.transactions && d.transactions.length > 0) {
        setData(d);
      } else {
        setData(SEED_DATA);
        saveData(SEED_DATA);
      }
      setLoading(false);
    });
  }, []);
  ```

  Replace with:
  ```js
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) setShowLogin(true);
      const d = await loadData();
      if (d && d.transactions && d.transactions.length > 0) {
        setData(d);
      } else {
        setData(SEED_DATA);
        saveData(SEED_DATA).then(setSyncStatus);
      }
      setLoading(false);
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setShowLogin(false);
        const d = await loadData();
        const dataToUse = (d && d.transactions && d.transactions.length > 0) ? d : SEED_DATA;
        if (d && d.transactions && d.transactions.length > 0) setData(d);
        else setData(SEED_DATA);
        // Always push to Supabase after login so the row exists for other devices
        saveData(dataToUse).then(setSyncStatus);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  ```

- [ ] **Step 3: Update `persist` to be async and track sync status**

  Replace (lines 476–479):
  ```js
  const persist = useCallback((newData) => {
    setData(newData);
    saveData(newData);
  }, []);
  ```

  With:
  ```js
  const persist = useCallback(async (newData) => {
    setData(newData);
    setSyncStatus("syncing");
    const result = await saveData(newData);
    setSyncStatus(result);
  }, []);
  ```

- [ ] **Step 4: Add online-event reconnect handler**

  After the `persist` declaration, add a new `useEffect`:

  ```js
  useEffect(() => {
    const handleOnline = async () => {
      if (syncStatus !== "offline") return;
      setSyncStatus("syncing");
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { setSyncStatus("synced"); return; }
        const result = await saveData(JSON.parse(raw));
        setSyncStatus(result);
      } catch {
        setSyncStatus("offline");
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncStatus]);
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add portfolio_tracker.jsx
  git commit -m "feat: wire auth session, syncStatus state, and reconnect handler"
  ```

---

## Task 7: Add LoginModal and SyncStatus to JSX

**Files:**
- Modify: `portfolio_tracker.jsx` — the `return` block of `PortfolioTracker`

- [ ] **Step 1: Add early-return for login before the loading check**

  Find the loading early-return (around line 568):
  ```jsx
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.mainBg, color: T.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
        Loading portfolio...
      </div>
    );
  }
  ```

  Add a `showLogin` check **before** it:
  ```jsx
  if (showLogin) return <LoginModal T={T} />;
  ```

- [ ] **Step 2: Add `SyncStatus` pill to the header button group**

  Find the header's right-side button group (the `<div>` containing `<ThemeToggle ...>`). It currently starts:
  ```jsx
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <ThemeToggle dark={dark} onToggle={toggleTheme} T={T} />
  ```

  Add `<SyncStatus>` as the first child, before `<ThemeToggle>`:
  ```jsx
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <SyncStatus status={syncStatus} T={T} />
    <ThemeToggle dark={dark} onToggle={toggleTheme} T={T} />
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add portfolio_tracker.jsx
  git commit -m "feat: add LoginModal and SyncStatus to app JSX"
  ```

---

## Task 8: Configure Netlify environment variables and verify

**Files:** Netlify dashboard (manual), dev server test

- [ ] **Step 1: Add env vars to Netlify**

  In your Netlify dashboard → Site settings → Environment variables. Add:
  - `VITE_SUPABASE_URL` → your Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` → your anon key

  These mirror `.env.local` and are needed for the deployed build.

- [ ] **Step 2: Start the dev server and test the login flow**

  ```bash
  npm run dev
  ```

  Open http://localhost:5173. Expected:
  - Login modal appears (full screen, Mackenzy theme)
  - Enter your Supabase email + password → modal disappears, portfolio loads
  - "Synced ✓" pill appears in the header (green)

- [ ] **Step 3: Test offline behaviour**

  With the app loaded, open DevTools → Network → set to "Offline". Make a change (e.g. open FX Rates modal and save). Expected:
  - Pill shows "Offline" (gold)

  Switch back to "Online". Expected:
  - Pill briefly shows "Syncing…" then "Synced ✓"

- [ ] **Step 4: Test cross-device sync**

  Open the app in a second browser (or your phone). Log in with the same credentials. Expected:
  - The same portfolio data loads (from Supabase)

- [ ] **Step 5: Trigger a Netlify deploy**

  ```bash
  git push origin main
  ```

  Netlify will rebuild automatically. Confirm the deployed app also shows the login modal and syncs correctly.
