import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const MARKETS = [
  { id: "egx", name: "EGX (Egypt)", currency: "EGP", flag: "🇪🇬" },
  { id: "adx", name: "ADX (Abu Dhabi)", currency: "AED", flag: "🇦🇪" },
  { id: "us", name: "US Market", currency: "USD", flag: "🇺🇸" },
  { id: "crypto", name: "Crypto (Binance)", currency: "USDT", flag: "₿" },
];

const BUCKET_OPTIONS = ["Swing (3d-2mo)", "Long-Term (up to 1yr)", "Flexible"];

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const formatNum = (n, dec = 2) => {
  if (n === null || n === undefined || isNaN(n)) return "0.00";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

const formatDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const timeAgo = (iso) => {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// Markets we cannot auto-fetch — these stay manual. Yahoo covers US/crypto/FX reliably.
// EGX is excluded: Yahoo only resolves some EGX tickers and its prices diverge from the broker.
const MANUAL_MARKETS = ["egx", "adx"];

const DEFAULT_FX = { USD: 1, USDT: 1, EGP: 0.0196, AED: 0.2723 };
const STORAGE_KEY = "portfolio-tracker-v6";
const THEME_KEY = "portfolio-theme-v1";

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
  } catch (e) { console.error("Supabase load error:", e); }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

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

const SEED_DATA = {
  transactions: [
    { id: "us-buy-rklb", market: "us", type: "buy", ticker: "RKLB", qty: 1.51097, price: 70.4, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Rocket Lab", currency: "USD" },
    { id: "us-buy-net", market: "us", type: "buy", ticker: "NET", qty: 0.55, price: 185.99, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Cloudflare", currency: "USD" },
    { id: "us-buy-nvda", market: "us", type: "buy", ticker: "NVDA", qty: 0.8, price: 188, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "NVIDIA", currency: "USD" },
    { id: "us-buy-panw", market: "us", type: "buy", ticker: "PANW", qty: 1, price: 162, date: "2026-04-15", bucket: "Swing (3d-2mo)", notes: "Palo Alto Networks", currency: "USD" },
    { id: "us-buy-elv", market: "us", type: "buy", ticker: "ELV", qty: 0.30375, price: 317.06, date: "2026-04-01", bucket: "Long-Term (up to 1yr)", notes: "Elevance Health", currency: "USD" },
    { id: "us-buy-rklb2", market: "us", type: "buy", ticker: "RKLB", qty: 1.4589, price: 70.4, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "RKLB — sold portion", currency: "USD" },
    { id: "us-sell-rklb1", market: "us", type: "sell", ticker: "RKLB", qty: 0.4837, price: 83.49, date: "2026-04-16", bucket: "Swing (3d-2mo)", notes: "Partial sell — $40.39", currency: "USD" },
    { id: "us-sell-rklb2", market: "us", type: "sell", ticker: "RKLB", qty: 0.9752, price: 83.49, date: "2026-04-16", bucket: "Swing (3d-2mo)", notes: "Partial sell — $81.42", currency: "USD" },
    { id: "us-buy-hal", market: "us", type: "buy", ticker: "HAL", qty: 1, price: 114.32, date: "2026-04-13", bucket: "Swing (3d-2mo)", notes: "Halliburton — closed", currency: "USD" },
    { id: "us-sell-hal", market: "us", type: "sell", ticker: "HAL", qty: 1, price: 114.58, date: "2026-04-16", bucket: "Swing (3d-2mo)", notes: "Halliburton — sold", currency: "USD" },
    { id: "egx-buy-comi", market: "egx", type: "buy", ticker: "COMI", qty: 76, price: 121.7, date: "2026-04-01", bucket: "Long-Term (up to 1yr)", notes: "Commercial International Bank", currency: "EGP" },
    { id: "egx-buy-cff", market: "egx", type: "buy", ticker: "CFF", qty: 453, price: 18, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "CI Capital Holding", currency: "EGP" },
    { id: "egx-buy-csag", market: "egx", type: "buy", ticker: "CSAG", qty: 239, price: 27.85, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Channel & Suez Agricultural", currency: "EGP" },
    { id: "egx-buy-abr", market: "egx", type: "buy", ticker: "ABR", qty: 130, price: 189.87, date: "2026-04-01", bucket: "Long-Term (up to 1yr)", notes: "Bareeq Fund", currency: "EGP" },
    { id: "egx-buy-bsb", market: "egx", type: "buy", ticker: "BSB", qty: 5138, price: 1.86, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Beltone Securities Brokerage", currency: "EGP" },
    { id: "egx-buy-amoc", market: "egx", type: "buy", ticker: "AMOC", qty: 750, price: 8.9, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Alexandria Mineral Oils Co", currency: "EGP" },
    { id: "egx-buy-tmgh", market: "egx", type: "buy", ticker: "TMGH", qty: 135, price: 86.54, date: "2026-04-16", bucket: "Swing (3d-2mo)", notes: "Talaat Moustafa Group", currency: "EGP" },
    { id: "egx-buy-cti", market: "egx", type: "buy", ticker: "CTI", qty: 201, price: 16.89, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "CI Capital Investment Banking", currency: "EGP" },
    { id: "egx-buy-bco", market: "egx", type: "buy", ticker: "BCO", qty: 3499, price: 1.43, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Beltone Financial", currency: "EGP" },
    { id: "egx-buy-mcqe", market: "egx", type: "buy", ticker: "MCQE", qty: 1, price: 2371.44, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "MCQE — closed trade", currency: "EGP" },
    { id: "egx-sell-mcqe", market: "egx", type: "sell", ticker: "MCQE", qty: 1, price: 3358.78, date: "2026-04-14", bucket: "Swing (3d-2mo)", notes: "MCQE — sold +987 EGP profit", currency: "EGP" },
    { id: "egx-buy-oras", market: "egx", type: "buy", ticker: "ORAS", qty: 1, price: 4020.34, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Orascom — closed trade", currency: "EGP" },
    { id: "egx-sell-oras", market: "egx", type: "sell", ticker: "ORAS", qty: 1, price: 5689.87, date: "2026-04-09", bucket: "Swing (3d-2mo)", notes: "Orascom — sold +1,670 EGP profit", currency: "EGP" },
    { id: "adx-buy-adsb", market: "adx", type: "buy", ticker: "ADSB", qty: 120, price: 7.213, date: "2026-04-08", bucket: "Swing (3d-2mo)", notes: "Abu Dhabi Ship Building", currency: "AED" },
    { id: "adx-buy-aldar", market: "adx", type: "buy", ticker: "ALDAR", qty: 140, price: 8.514, date: "2026-04-17", bucket: "Swing (3d-2mo)", notes: "Aldar Properties", currency: "AED" },
    { id: "adx-buy-turki", market: "adx", type: "buy", ticker: "TURKI", qty: 1, price: 800.84, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Turki — closed trade", currency: "AED" },
    { id: "adx-sell-turki", market: "adx", type: "sell", ticker: "TURKI", qty: 1, price: 830.47, date: "2026-04-10", bucket: "Swing (3d-2mo)", notes: "Turki — sold +30 AED profit", currency: "AED" },
    { id: "adx-buy-dana", market: "adx", type: "buy", ticker: "DANA", qty: 1, price: 1113.71, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Dana Gas — closed trade", currency: "AED" },
    { id: "adx-sell-dana", market: "adx", type: "sell", ticker: "DANA", qty: 1, price: 1155.05, date: "2026-04-08", bucket: "Swing (3d-2mo)", notes: "Dana Gas — sold +41 AED profit", currency: "AED" },
    { id: "adx-buy-presight", market: "adx", type: "buy", ticker: "PRESIGHT", qty: 1, price: 585.98, date: "2026-04-01", bucket: "Swing (3d-2mo)", notes: "Presight AI — closed trade", currency: "AED" },
    { id: "adx-sell-presight", market: "adx", type: "sell", ticker: "PRESIGHT", qty: 1, price: 608.74, date: "2026-04-08", bucket: "Swing (3d-2mo)", notes: "Presight AI — sold +23 AED profit", currency: "AED" },
  ],
  topups: [
    { id: "topup-us", market: "us", type: "deposit", amount: 1000, date: "2026-04-01", notes: "Initial investment — Dow Jones", currency: "USD" },
    { id: "topup-egx", market: "egx", type: "deposit", amount: 100000, date: "2026-04-01", notes: "Initial investment — EGX", currency: "EGP" },
    { id: "topup-egx-div", market: "egx", type: "deposit", amount: 433.20, date: "2026-04-15", notes: "COMI Dividends", currency: "EGP" },
    { id: "topup-adx", market: "adx", type: "deposit", amount: 3672, date: "2026-04-01", notes: "Initial investment — ADX", currency: "AED" },
  ],
  fxRates: DEFAULT_FX,
  currentPrices: {
    "us:RKLB": "82.93", "us:NET": "196.82", "us:NVDA": "198.34",
    "us:PANW": "165.84", "us:ELV": "316.87",
    "egx:COMI": "140.00", "egx:CFF": "19.67", "egx:CSAG": "30.26",
    "egx:ABR": "199.92", "egx:BSB": "1.906", "egx:AMOC": "8.25",
    "egx:TMGH": "86.50", "egx:CTI": "16.84", "egx:BCO": "1.42",
    "adx:ADSB": "7.29", "adx:ALDAR": "8.50",
  },
  stockCards: {},
  watchList: [],
  holdingBuckets: {},
};

const INITIAL_DATA = { transactions: [], topups: [], fxRates: DEFAULT_FX, currentPrices: {}, stockCards: {}, watchList: [], holdingBuckets: {} };

// ─── Mackenzy Colour Standard ───
const DARK = {
  mainBg:    "#0b0f1c",
  surfaceBg: "#111827",
  cardBg:    "#141e33",
  border:    "#1e2d4a",
  divider:   "#162038",
  text:      "#f0f2f8",
  textSub:   "#8fa0c8",
  textMuted: "#5a6888",
  textDim:   "#3d4e6a",
  gold:      "#d4a030",
  goldSoft:  "rgba(212,160,48,0.16)",
  green:     "#22c55e",
  greenSoft: "rgba(34,197,94,0.15)",
  red:       "#ef4444",
  redSoft:   "rgba(239,68,68,0.15)",
  inputBg:   "#0b0f1c",
  purple:    "#a78bfa",
};

const LIGHT = {
  mainBg:    "#f4f7ff",
  surfaceBg: "#eaeff9",
  cardBg:    "#ffffff",
  border:    "#c5d0e8",
  divider:   "#d8e3f5",
  text:      "#0b0f1c",
  textSub:   "#243560",
  textMuted: "#4a5e8a",
  textDim:   "#7888b0",
  gold:      "#9a7000",
  goldSoft:  "rgba(154,112,0,0.12)",
  green:     "#15803d",
  greenSoft: "rgba(21,128,61,0.12)",
  red:       "#b91c1c",
  redSoft:   "rgba(185,28,28,0.12)",
  inputBg:   "#ffffff",
  purple:    "#6d28d9",
};

// ─── Style Factories ───
const mkInput = (T) => ({
  width: "100%", padding: "9px 12px", background: T.inputBg,
  border: `1px solid ${T.border}`, borderRadius: 7, color: T.text,
  fontSize: 14, outline: "none", boxSizing: "border-box",
  fontFamily: "'DM Sans', sans-serif",
});
const mkSelect = (T) => ({ ...mkInput(T), appearance: "auto" });
const mkBtnPrimary = (T) => ({
  padding: "10px 20px",
  background: T === DARK ? T.gold : T.text,
  color: T === DARK ? T.mainBg : "#f0f2f8",
  border: "none", borderRadius: 7, fontSize: 14, fontWeight: 600,
  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
});
const mkBtnSecondary = (T) => ({
  padding: "10px 20px", background: T.surfaceBg, color: T.textSub,
  border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontWeight: 500,
  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
});

// ─── Modal ───
function Modal({ open, onClose, title, children, T, maxWidth = 520, zIndex = 1000 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.cardBg, border: `1px solid ${T.border}`,
        borderRadius: 12, width: "100%", maxWidth,
        maxHeight: "85vh", overflow: "auto",
        boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: T.textMuted,
            fontSize: 20, cursor: "pointer", padding: "0 4px",
          }}>✕</button>
        </div>
        <div style={{ padding: "18px 22px" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Form Field ───
function Field({ label, children, T }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: T.textMuted, marginBottom: 5, fontWeight: 500, letterSpacing: "0.3px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Add Transaction Modal ───
function AddTransactionModal({ open, onClose, onSave, T }) {
  const [form, setForm] = useState({
    market: "us", type: "buy", ticker: "", qty: "", price: "",
    date: new Date().toISOString().split("T")[0], bucket: "Swing (3d-2mo)", notes: "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const market = MARKETS.find(m => m.id === form.market);
  const IS = mkInput(T), SS = mkSelect(T), BP = mkBtnPrimary(T), BSS = mkBtnSecondary(T);

  const handleSave = () => {
    if (!form.ticker || !form.qty || !form.price) return;
    onSave({
      id: genId(), market: form.market, type: form.type,
      ticker: form.ticker.toUpperCase(), qty: parseFloat(form.qty),
      price: parseFloat(form.price), date: form.date,
      bucket: form.bucket, notes: form.notes, currency: market.currency,
    });
    setForm({ market: "us", type: "buy", ticker: "", qty: "", price: "", date: new Date().toISOString().split("T")[0], bucket: "Swing (3d-2mo)", notes: "" });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction" T={T}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Market" T={T}>
          <select style={SS} value={form.market} onChange={e => set("market", e.target.value)}>
            {MARKETS.map(m => <option key={m.id} value={m.id}>{m.flag} {m.name}</option>)}
          </select>
        </Field>
        <Field label="Type" T={T}>
          <select style={SS} value={form.type} onChange={e => set("type", e.target.value)}>
            <option value="buy">🟢 Buy</option>
            <option value="sell">🔴 Sell</option>
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Ticker / Symbol" T={T}>
          <input style={IS} placeholder="e.g. AAPL, BTC" value={form.ticker} onChange={e => set("ticker", e.target.value)} />
        </Field>
        <Field label="Date" T={T}>
          <input style={IS} type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Quantity" T={T}>
          <input style={IS} type="number" step="any" placeholder="0" value={form.qty} onChange={e => set("qty", e.target.value)} />
        </Field>
        <Field label={`Price (${market?.currency})`} T={T}>
          <input style={IS} type="number" step="any" placeholder="0.00" value={form.price} onChange={e => set("price", e.target.value)} />
        </Field>
      </div>
      <Field label="Bucket" T={T}>
        <select style={SS} value={form.bucket} onChange={e => set("bucket", e.target.value)}>
          {BUCKET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </Field>
      <Field label="Notes (optional)" T={T}>
        <input style={IS} placeholder="Entry thesis, target, stop-loss..." value={form.notes} onChange={e => set("notes", e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button style={BSS} onClick={onClose}>Cancel</button>
        <button style={BP} onClick={handleSave}>Save Transaction</button>
      </div>
    </Modal>
  );
}

// ─── Add Top-Up Modal ───
function AddTopupModal({ open, onClose, onSave, T }) {
  const [form, setForm] = useState({
    market: "us", amount: "", type: "deposit",
    date: new Date().toISOString().split("T")[0], notes: "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const market = MARKETS.find(m => m.id === form.market);
  const IS = mkInput(T), SS = mkSelect(T), BP = mkBtnPrimary(T), BSS = mkBtnSecondary(T);

  const handleSave = () => {
    if (!form.amount) return;
    onSave({
      id: genId(), market: form.market, type: form.type,
      amount: parseFloat(form.amount), date: form.date,
      notes: form.notes, currency: market.currency,
    });
    setForm({ market: "us", amount: "", type: "deposit", date: new Date().toISOString().split("T")[0], notes: "" });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Wallet Deposit / Withdrawal" T={T}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Market" T={T}>
          <select style={SS} value={form.market} onChange={e => set("market", e.target.value)}>
            {MARKETS.map(m => <option key={m.id} value={m.id}>{m.flag} {m.name}</option>)}
          </select>
        </Field>
        <Field label="Type" T={T}>
          <select style={SS} value={form.type} onChange={e => set("type", e.target.value)}>
            <option value="deposit">⬆ Deposit</option>
            <option value="withdrawal">⬇ Withdrawal</option>
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label={`Amount (${market?.currency})`} T={T}>
          <input style={IS} type="number" step="any" placeholder="0.00" value={form.amount} onChange={e => set("amount", e.target.value)} />
        </Field>
        <Field label="Date" T={T}>
          <input style={IS} type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        </Field>
      </div>
      <Field label="Notes (optional)" T={T}>
        <input style={IS} placeholder="Source, purpose..." value={form.notes} onChange={e => set("notes", e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button style={BSS} onClick={onClose}>Cancel</button>
        <button style={BP} onClick={handleSave}>Save</button>
      </div>
    </Modal>
  );
}

// ─── Update Price Modal ───
function UpdatePriceModal({ open, onClose, holdings, currentPrices, onSave, T }) {
  const [prices, setPrices] = useState({});
  useEffect(() => { if (open) setPrices({ ...currentPrices }); }, [open]);
  const IS = mkInput(T), BP = mkBtnPrimary(T), BSS = mkBtnSecondary(T);
  const handleSave = () => { onSave(prices); onClose(); };

  return (
    <Modal open={open} onClose={onClose} title="Update Current Prices" T={T}>
      <p style={{ fontSize: 13, color: T.textMuted, marginTop: 0, marginBottom: 16 }}>
        Enter latest prices so your P&L updates. You can also ask me in chat for a price check.
      </p>
      {holdings.map(h => {
        const mkt = MARKETS.find(m => m.id === h.market);
        const key = `${h.market}:${h.ticker}`;
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ width: 28, textAlign: "center" }}>{mkt?.flag}</span>
            <span style={{ width: 80, fontWeight: 600, color: T.text, fontSize: 14 }}>{h.ticker}</span>
            <input
              style={{ ...IS, width: 130 }}
              type="number" step="any"
              placeholder={`${mkt?.currency}`}
              value={prices[key] ?? ""}
              onChange={e => setPrices(p => ({ ...p, [key]: e.target.value }))}
            />
            <span style={{ fontSize: 12, color: T.textDim }}>{mkt?.currency}</span>
          </div>
        );
      })}
      {holdings.length === 0 && <p style={{ color: T.textMuted, fontSize: 13 }}>No open positions to price.</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
        <button style={BSS} onClick={onClose}>Cancel</button>
        <button style={BP} onClick={handleSave}>Save Prices</button>
      </div>
    </Modal>
  );
}

// ─── FX Rates Modal ───
function FxRatesModal({ open, onClose, fxRates, onSave, T }) {
  const [rates, setRates] = useState({});
  useEffect(() => { if (open) setRates({ ...fxRates }); }, [open]);
  const IS = mkInput(T), BP = mkBtnPrimary(T), BSS = mkBtnSecondary(T);
  const handleSave = () => {
    const parsed = {};
    Object.entries(rates).forEach(([k, v]) => { parsed[k] = parseFloat(v) || 0; });
    onSave(parsed); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="FX Rates to USD" T={T}>
      <p style={{ fontSize: 13, color: T.textMuted, marginTop: 0, marginBottom: 16 }}>
        Set exchange rates for portfolio-wide USD conversion.
      </p>
      {Object.entries(rates).filter(([k]) => k !== "USD").map(([cur, val]) => (
        <div key={cur} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ width: 55, fontWeight: 600, color: T.text, fontSize: 14 }}>1 {cur}</span>
          <span style={{ color: T.textMuted }}>=</span>
          <input style={{ ...IS, width: 130 }} type="number" step="any" value={val}
            onChange={e => setRates(p => ({ ...p, [cur]: e.target.value }))} />
          <span style={{ fontSize: 12, color: T.textDim }}>USD</span>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
        <button style={BSS} onClick={onClose}>Cancel</button>
        <button style={BP} onClick={handleSave}>Save Rates</button>
      </div>
    </Modal>
  );
}

// ─── Confirm Modal ───
function ConfirmModal({ open, onClose, onConfirm, message, T }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Confirm" T={T}>
      <p style={{ color: T.textSub, fontSize: 14, marginTop: 0 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
        <button style={mkBtnSecondary(T)} onClick={onClose}>Cancel</button>
        <button style={{ ...mkBtnPrimary(T), background: T.red, color: "#fff" }} onClick={onConfirm}>Delete</button>
      </div>
    </Modal>
  );
}

// ─── Stat Card ───
function StatCard({ label, value, sub, accent, T }) {
  return (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: "16px 18px", flex: "1 1 200px", minWidth: 170,
    }}>
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500, marginBottom: 6, letterSpacing: "0.4px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || T.text, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Theme Toggle Button ───
function ThemeToggle({ dark, onToggle, T }) {
  return (
    <button onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 13px", borderRadius: 20,
      background: T.surfaceBg, border: `1px solid ${T.border}`,
      color: T.textSub, cursor: "pointer", fontSize: 12, fontWeight: 500,
      fontFamily: "'DM Sans', sans-serif",
      transition: "all 0.2s",
    }}>
      <span style={{ fontSize: 14 }}>{dark ? "☀️" : "🌙"}</span>
      {dark ? "Light" : "Dark"}
    </button>
  );
}

// ─── Login Modal ───
function LoginModal({ T }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const IS = mkInput(T);
  const BP = mkBtnPrimary(T);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
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
            <div style={{ position: "relative" }}>
              <input style={{ ...IS, paddingRight: 64 }} type={showPassword ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, color: T.textMuted, padding: 4,
                }}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          {error && <p style={{ color: T.red, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
          <button style={{ ...BP, width: "100%", marginTop: 4, opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }} type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

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

// ─── Parse Investment Hub Text ───
function parseInvestmentHubText(text) {
  if (!text || !text.trim()) return {};
  const result = {};
  const t1 = text.match(/(?:T1|Target\s*1|target\s*price\s*1)\s*[:\s]\s*\$?([\d,]+(?:\.\d+)?)/i);
  if (t1) result.t1 = parseFloat(t1[1].replace(/,/g, ""));
  const t2 = text.match(/(?:T2|Target\s*2|target\s*price\s*2)\s*[:\s]\s*\$?([\d,]+(?:\.\d+)?)/i);
  if (t2) result.t2 = parseFloat(t2[1].replace(/,/g, ""));
  const sl = text.match(/(?:SL|Stop\s*[Ll]oss|stop-loss)\s*[:\s]\s*\$?([\d,]+(?:\.\d+)?)/i);
  if (sl) result.stopLoss = parseFloat(sl[1].replace(/,/g, ""));
  const kpiPatterns = [
    { label: "P/E Ratio",      re: /P\/E(?:\s+ratio)?[:\s]+([\d.]+)/i },
    { label: "Revenue Growth", re: /revenue\s+growth[:\s]+([\d.]+%?)/i },
    { label: "EPS",            re: /EPS[:\s]+\$?([\d.]+)/i },
    { label: "Debt/Equity",    re: /debt[/\s-]+equity[:\s]+([\d.]+)/i },
    { label: "Profit Margin",  re: /profit\s+margin[:\s]+([\d.]+%?)/i },
  ];
  const kpis = [];
  kpiPatterns.forEach(({ label, re }) => {
    const m = text.match(re);
    if (m) kpis.push({ label, value: m[1] });
  });
  if (kpis.length > 0) result.kpis = kpis;
  const bullets = [...text.matchAll(/^[ \t]*[-•*]\s+(.+)$/gm)].map(m => ({ text: m[1].trim(), date: "" }));
  if (bullets.length > 0) result.news = bullets.slice(0, 5);
  return result;
}

// ─── Import Suggestions Modal ───
function ImportSuggestionsModal({ open, onClose, onImport, T }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [selected, setSelected] = useState({});
  const IS = mkInput(T), BP = mkBtnPrimary(T), BSS = mkBtnSecondary(T);

  const handleParse = () => {
    const result = parseInvestmentHubText(text);
    setParsed(result);
    const sel = {};
    Object.keys(result).forEach(k => { sel[k] = true; });
    setSelected(sel);
  };

  const handleApply = () => {
    const toApply = {};
    Object.entries(selected).forEach(([k, v]) => {
      if (v && parsed[k] !== undefined) toApply[k] = parsed[k];
    });
    onImport(toApply);
    setText(""); setParsed(null); setSelected({});
    onClose();
  };

  const fieldLabels = { t1: "Target 1 (T1)", t2: "Target 2 (T2)", stopLoss: "Stop Loss", kpis: "Company KPIs", news: "News", notes: "Notes" };

  return (
    <Modal open={open} onClose={onClose} title="Import from Investment Hub" T={T} maxWidth={540} zIndex={1100}>
      <p style={{ fontSize: 13, color: T.textMuted, margin: "0 0 12px" }}>
        Paste recommendations from your Investment Hub conversation below.
      </p>
      <textarea
        style={{ ...IS, height: 120, resize: "vertical", marginBottom: 10 }}
        placeholder={"Paste Claude's recommendation text here — e.g. 'T1: $95, T2: $115, SL: $62'"}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <button style={{ ...BSS, fontSize: 12, marginBottom: 14 }} onClick={handleParse}>Parse Text</button>

      {parsed && (
        <div style={{ background: T.surfaceBg, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Detected Fields</div>
          {Object.keys(parsed).length === 0 ? (
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>No fields detected. Try using T1:, T2:, SL: labels.</p>
          ) : Object.entries(parsed).map(([k, v]) => (
            <label key={k} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={!!selected[k]} onChange={e => setSelected(p => ({ ...p, [k]: e.target.checked }))} style={{ marginTop: 2 }} />
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{fieldLabels[k] || k}: </span>
                <span style={{ fontSize: 12, color: T.textSub }}>
                  {Array.isArray(v) ? v.map(item => item.text || JSON.stringify(item)).join(", ") : String(v)}
                </span>
              </div>
            </label>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={BSS} onClick={onClose}>Cancel</button>
        <button
          style={{ ...BP, opacity: !parsed || Object.keys(parsed).length === 0 ? 0.5 : 1 }}
          onClick={handleApply}
          disabled={!parsed || Object.keys(parsed).length === 0}
        >Apply as Suggestions</button>
      </div>
    </Modal>
  );
}

// ─── Watch List Add Modal ───
function WatchListAddModal({ open, onClose, onSave, T }) {
  const [form, setForm] = useState({ market: "us", ticker: "", name: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const IS = mkInput(T), SS = mkSelect(T), BP = mkBtnPrimary(T), BSS = mkBtnSecondary(T);

  const handleSave = () => {
    if (!form.ticker) return;
    onSave({
      id: genId(), market: form.market, ticker: form.ticker.toUpperCase(), name: form.name,
      t1: null, t2: null, stopLoss: null, strategy: "", thesis: "",
      kpis: [
        { label: "P/E Ratio", value: "" }, { label: "Revenue Growth", value: "" },
        { label: "EPS", value: "" }, { label: "Debt/Equity", value: "" },
        { label: "Profit Margin", value: "" },
      ],
      events: [], news: [], dividends: [], notes: "", pendingSuggestions: null,
    });
    setForm({ market: "us", ticker: "", name: "" });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to Watch List" T={T}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Market" T={T}>
          <select style={SS} value={form.market} onChange={e => set("market", e.target.value)}>
            {MARKETS.map(m => <option key={m.id} value={m.id}>{m.flag} {m.name}</option>)}
          </select>
        </Field>
        <Field label="Ticker / Symbol" T={T}>
          <input style={IS} placeholder="e.g. AAPL" value={form.ticker} onChange={e => set("ticker", e.target.value)} />
        </Field>
      </div>
      <Field label="Company Name (optional)" T={T}>
        <input style={IS} placeholder="e.g. Apple Inc." value={form.name} onChange={e => set("name", e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button style={BSS} onClick={onClose}>Cancel</button>
        <button style={BP} onClick={handleSave}>Add to Watch List</button>
      </div>
    </Modal>
  );
}

// ─── Stock Card Modal ───
function StockCardModal({ open, onClose, holding, cardData, onSave, onSavePrice, T }) {
  const DEFAULT_KPIS = [
    { label: "P/E Ratio", value: "" }, { label: "Revenue Growth", value: "" },
    { label: "EPS", value: "" }, { label: "Debt/Equity", value: "" },
    { label: "Profit Margin", value: "" },
  ];

  const [form, setForm] = useState(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (open) {
      const d = cardData || {};
      setForm({
        t1: d.t1 != null ? d.t1 : "",
        t2: d.t2 != null ? d.t2 : "",
        stopLoss: d.stopLoss != null ? d.stopLoss : "",
        currentPrice: holding?.currentPrice != null ? String(holding.currentPrice) : "",
        strategy: d.strategy || "",
        thesis: d.thesis || "",
        kpis: d.kpis?.length ? d.kpis : DEFAULT_KPIS,
        events: d.events || [],
        news: d.news || [],
        dividends: d.dividends || [],
        notes: d.notes || "",
        pendingSuggestions: d.pendingSuggestions || null,
      });
    }
  }, [open, cardData]);

  if (!open || !form) return null;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const acceptSuggestion = (field) => {
    set(field, form.pendingSuggestions[field]);
    const sugg = { ...form.pendingSuggestions };
    delete sugg[field];
    set("pendingSuggestions", Object.keys(sugg).length ? sugg : null);
  };

  const dismissSuggestion = (field) => {
    const sugg = { ...form.pendingSuggestions };
    delete sugg[field];
    set("pendingSuggestions", Object.keys(sugg).length ? sugg : null);
  };

  const acceptAll = () => {
    const s = form.pendingSuggestions;
    if (!s) return;
    const updates = {};
    ["t1", "t2", "stopLoss", "kpis", "events", "news", "notes"].forEach(f => {
      if (s[f] !== undefined) updates[f] = s[f];
    });
    setForm(p => ({ ...p, ...updates, pendingSuggestions: null }));
  };

  const handleImport = (suggestions) => {
    setForm(p => ({ ...p, pendingSuggestions: { ...(p.pendingSuggestions || {}), ...suggestions } }));
  };

  const handleSave = () => {
    const toSave = {
      ...form,
      t1: form.t1 !== "" && form.t1 !== null ? (parseFloat(form.t1) || null) : null,
      t2: form.t2 !== "" && form.t2 !== null ? (parseFloat(form.t2) || null) : null,
      stopLoss: form.stopLoss !== "" && form.stopLoss !== null ? (parseFloat(form.stopLoss) || null) : null,
    };
    onSave(toSave);
    if (holding && MANUAL_MARKETS.includes(holding.market) && form.currentPrice !== "") {
      const parsed = parseFloat(form.currentPrice);
      if (!isNaN(parsed) && parsed > 0) onSavePrice?.(`${holding.market}:${holding.ticker}`, parsed);
    }
    onClose();
  };

  const IS = mkInput(T), BP = mkBtnPrimary(T), BSS = mkBtnSecondary(T);
  const mkt = MARKETS.find(m => m.id === (holding?.market || cardData?.market));
  const ticker = holding?.ticker || cardData?.ticker || "";

  const SuggBadge = ({ field }) => {
    if (!form.pendingSuggestions?.[field]) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, padding: "4px 8px", background: T.goldSoft, borderRadius: 5, border: `1px solid ${T.gold}44` }}>
        <span style={{ fontSize: 11, color: T.gold, flex: 1 }}>Suggested: {form.pendingSuggestions[field]}</span>
        <button onClick={() => acceptSuggestion(field)} style={{ fontSize: 10, background: T.gold, color: T.mainBg, border: "none", borderRadius: 3, padding: "1px 7px", cursor: "pointer", fontWeight: 700 }}>✓</button>
        <button onClick={() => dismissSuggestion(field)} style={{ fontSize: 11, background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: "0 2px" }}>✕</button>
      </div>
    );
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={`${mkt?.flag || ""} ${ticker} — Stock Card`} T={T} maxWidth={900}>
        {form.pendingSuggestions && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: T.goldSoft, borderRadius: 7, border: `1px solid ${T.gold}44`, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: T.gold }}>⚡ Pending suggestions from Investment Hub</span>
            <button onClick={acceptAll} style={{ ...BP, fontSize: 11, padding: "4px 12px" }}>Accept All</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left column */}
          <div>
            {holding && (
              <div style={{ background: T.surfaceBg, borderRadius: 8, padding: 14, marginBottom: 16, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Position</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>Current Price</div>
                    {MANUAL_MARKETS.includes(holding.market) ? (
                      <input
                        style={{ ...IS, marginTop: 2, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", padding: "4px 8px" }}
                        type="number" step="any" placeholder="Enter price…"
                        value={form.currentPrice}
                        onChange={e => set("currentPrice", e.target.value)}
                      />
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>
                        {holding.currentPrice != null ? formatNum(holding.currentPrice) : "—"}
                        <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4 }}>auto</span>
                      </div>
                    )}
                  </div>
                  {[
                    ["Qty", formatNum(holding.qty, holding.qty < 1 ? 6 : 2)],
                    ["Avg Cost", `${formatNum(holding.avgCost)} ${holding.currency}`],
                    ["Value", holding.currentValue != null ? formatNum(holding.currentValue) : formatNum(holding.costBasis)],
                    ["Unrealized P&L", holding.unrealizedPL != null ? `${holding.unrealizedPL >= 0 ? "+" : ""}${formatNum(holding.unrealizedPL)}` : "—"],
                    ["P&L %", holding.unrealizedPct != null ? `${holding.unrealizedPct >= 0 ? "+" : ""}${formatNum(holding.unrealizedPct, 1)}%` : "—"],
                    ["Bucket", holding.bucket],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{k}</div>
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: (k === "Unrealized P&L" || k === "P&L %")
                          ? (holding.unrealizedPL != null ? (holding.unrealizedPL >= 0 ? T.green : T.red) : T.textSub)
                          : T.text,
                        fontFamily: k !== "Bucket" ? "'JetBrains Mono', monospace" : "inherit",
                      }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Trading Plan</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[{ label: "Target 1 (T1)", field: "t1" }, { label: "Target 2 (T2)", field: "t2" }, { label: "Stop Loss", field: "stopLoss" }].map(({ label, field }) => (
                <div key={field}>
                  <Field label={label} T={T}>
                    <input style={IS} type="number" step="any" placeholder="—" value={form[field]} onChange={e => set(field, e.target.value)} />
                  </Field>
                  <SuggBadge field={field} />
                </div>
              ))}
            </div>

            {(() => {
              const t1v = parseFloat(form.t1);
              const slv = parseFloat(form.stopLoss);
              const cur = holding?.currentPrice;
              if (t1v && slv && cur && t1v > cur && cur > slv) {
                const reward = t1v - cur;
                const risk = cur - slv;
                const rr = (reward / risk).toFixed(2);
                const color = parseFloat(rr) >= 2 ? T.green : parseFloat(rr) >= 1 ? T.gold : T.red;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "8px 12px", background: T.surfaceBg, borderRadius: 6, border: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>R:R</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>1 : {rr}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>
                      ↑ +{formatNum(reward)} &nbsp;/&nbsp; ↓ −{formatNum(risk)}
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            <Field label="Strategy" T={T}>
              <input style={IS} placeholder="Swing, Long-term, Value..." value={form.strategy} onChange={e => set("strategy", e.target.value)} />
            </Field>
            <Field label="Investment Thesis" T={T}>
              <textarea style={{ ...IS, height: 80, resize: "vertical" }} placeholder="Why you hold this position..." value={form.thesis} onChange={e => set("thesis", e.target.value)} />
            </Field>
          </div>

          {/* Right column */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Company KPIs</div>
            <div style={{ background: T.surfaceBg, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`, marginBottom: 14 }}>
              {form.kpis.map((kpi, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: i < form.kpis.length - 1 ? 8 : 0 }}>
                  <input style={{ ...IS, fontSize: 12 }} placeholder="Metric" value={kpi.label}
                    onChange={e => { const k = [...form.kpis]; k[i] = { ...k[i], label: e.target.value }; set("kpis", k); }} />
                  <input style={{ ...IS, fontSize: 12 }} placeholder="Value" value={kpi.value}
                    onChange={e => { const k = [...form.kpis]; k[i] = { ...k[i], value: e.target.value }; set("kpis", k); }} />
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Upcoming Events</div>
            <div style={{ background: T.surfaceBg, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`, marginBottom: 14 }}>
              {form.events.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input style={{ ...IS, width: 130, fontSize: 12 }} type="date" value={ev.date}
                    onChange={e => { const evs = [...form.events]; evs[i] = { ...evs[i], date: e.target.value }; set("events", evs); }} />
                  <input style={{ ...IS, flex: 1, fontSize: 12 }} placeholder="Description" value={ev.label}
                    onChange={e => { const evs = [...form.events]; evs[i] = { ...evs[i], label: e.target.value }; set("events", evs); }} />
                  <button onClick={() => set("events", form.events.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 16, padding: "0 2px", flexShrink: 0 }}>✕</button>
                </div>
              ))}
              <button onClick={() => set("events", [...form.events, { date: "", label: "" }])}
                style={{ fontSize: 12, color: T.gold, background: "none", border: `1px dashed ${T.gold}66`, borderRadius: 5, padding: "4px 10px", cursor: "pointer", width: "100%", marginTop: form.events.length ? 4 : 0 }}>
                + Add Event
              </button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>News & Updates</div>
            <div style={{ background: T.surfaceBg, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`, marginBottom: 14 }}>
              {form.news.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input style={{ ...IS, flex: 1, fontSize: 12 }} placeholder="Headline" value={item.text}
                    onChange={e => { const n = [...form.news]; n[i] = { ...n[i], text: e.target.value }; set("news", n); }} />
                  <input style={{ ...IS, width: 120, fontSize: 12 }} type="date" value={item.date}
                    onChange={e => { const n = [...form.news]; n[i] = { ...n[i], date: e.target.value }; set("news", n); }} />
                  <button onClick={() => set("news", form.news.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 16, padding: "0 2px", flexShrink: 0 }}>✕</button>
                </div>
              ))}
              <button onClick={() => set("news", [...form.news, { text: "", date: "" }])}
                style={{ fontSize: 12, color: T.gold, background: "none", border: `1px dashed ${T.gold}66`, borderRadius: 5, padding: "4px 10px", cursor: "pointer", width: "100%", marginTop: form.news.length ? 4 : 0 }}>
                + Add News
              </button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Notes</div>
            <textarea style={{ ...IS, height: 68, resize: "vertical" }} placeholder="Additional notes..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
          <button style={{ ...BSS, fontSize: 12 }} onClick={() => setShowImport(true)}>⬇ Import from Investment Hub</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={BSS} onClick={onClose}>Cancel</button>
            <button style={BP} onClick={handleSave}>Save Card</button>
          </div>
        </div>
      </Modal>
      <ImportSuggestionsModal open={showImport} onClose={() => setShowImport(false)} onImport={handleImport} T={T} />
    </>
  );
}

// ─── Data Import Modal ───
function DataImportModal({ open, onClose, onImport, T }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const IS = mkInput(T), BP = mkBtnPrimary(T), BSS = mkBtnSecondary(T);

  const handleImport = () => {
    setError("");
    try {
      const parsed = JSON.parse(text.trim());
      if (!Array.isArray(parsed.transactions)) { setError("Invalid data: missing transactions array."); return; }
      onImport(parsed);
      setText("");
      onClose();
    } catch {
      setError("Invalid JSON — make sure you copied the full output from Investment Hub.");
    }
  };

  return (
    <Modal open={open} onClose={() => { setText(""); setError(""); onClose(); }} title="Import Portfolio Data" T={T} maxWidth={560}>
      <p style={{ fontSize: 13, color: T.textMuted, margin: "0 0 10px" }}>
        Paste the JSON you got from your Investment Hub conversation below.
      </p>
      <textarea
        style={{ ...IS, height: 220, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
        placeholder='{ "transactions": [...], "topups": [...], ... }'
        value={text}
        onChange={e => { setText(e.target.value); setError(""); }}
      />
      {error && <p style={{ color: "#e74c3c", fontSize: 12, margin: "6px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button style={BSS} onClick={() => { setText(""); setError(""); onClose(); }}>Cancel</button>
        <button style={BP} onClick={handleImport}>Load Data</button>
      </div>
    </Modal>
  );
}

// ─── Main App ───
export default function PortfolioTracker() {
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) !== "light"; } catch { return true; }
  });
  const T = dark ? DARK : LIGHT;

  const [tab, setTab] = useState("dashboard");
  const [showTxModal, setShowTxModal] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showFxModal, setShowFxModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [marketFilter, setMarketFilter] = useState("all");
  const [showLogin, setShowLogin] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced");
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showWatchAddModal, setShowWatchAddModal] = useState(false);
  const [holdingsSort, setHoldingsSort] = useState({ col: "value", dir: "desc" });
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [showDataImport, setShowDataImport] = useState(false);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
  };

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) setShowLogin(true);
      const d = await loadData();
      if (d) {
        if (!d.stockCards) d.stockCards = {};
        if (!d.watchList) d.watchList = [];
        if (!d.holdingBuckets) d.holdingBuckets = {};
      }
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

  const persist = useCallback(async (newData) => {
    setData(newData);
    setSyncStatus("syncing");
    const result = await saveData(newData);
    setSyncStatus(result);
  }, []);

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

  const addTransaction = (tx) => persist({ ...data, transactions: [...data.transactions, tx] });
  const addTopup = (t) => persist({ ...data, topups: [...data.topups, t] });
  const deleteTransaction = (id) => persist({ ...data, transactions: data.transactions.filter(t => t.id !== id) });
  const deleteTopup = (id) => persist({ ...data, topups: data.topups.filter(t => t.id !== id) });
  const updatePrices = (p) => {
    // Stamp every price the user actually changed so manual (EGX/ADX) staleness can be shown.
    const now = new Date().toISOString();
    const edited = { ...(data.priceEditedAt || {}) };
    Object.keys(p).forEach(k => { if (p[k] !== (data.currentPrices || {})[k]) edited[k] = now; });
    persist({ ...data, currentPrices: p, priceEditedAt: edited });
  };
  const updateFx = (r) => persist({ ...data, fxRates: { ...data.fxRates, ...r } });
  const saveStockCard = (key, updates) => persist({ ...data, stockCards: { ...(data.stockCards || {}), [key]: { ...(data.stockCards?.[key] || {}), ...updates } } });
  const saveWatchItem = (id, updates) => persist({ ...data, watchList: (data.watchList || []).map(w => w.id === id ? { ...w, ...updates } : w) });
  const addWatchItem = (item) => persist({ ...data, watchList: [...(data.watchList || []), item] });
  const deleteWatchItem = (id) => persist({ ...data, watchList: (data.watchList || []).filter(w => w.id !== id) });
  const saveHoldingBucket = (key, bucket) => persist({ ...data, holdingBuckets: { ...(data.holdingBuckets || {}), [key]: bucket } });

  // ─── Computed Analytics ───
  const analytics = useMemo(() => {
    const fx = data.fxRates || DEFAULT_FX;
    const txns = data.transactions || [];
    const tops = data.topups || [];
    const prices = data.currentPrices || {};

    const holdingMap = {};
    txns.forEach(tx => {
      const key = `${tx.market}:${tx.ticker}`;
      if (!holdingMap[key]) holdingMap[key] = { market: tx.market, ticker: tx.ticker, qty: 0, costBasis: 0, realized: 0, currency: tx.currency, bucket: tx.bucket };
      if (tx.type === "buy") {
        holdingMap[key].costBasis += tx.qty * tx.price;
        holdingMap[key].qty += tx.qty;
      } else {
        const avgCost = holdingMap[key].qty > 0 ? holdingMap[key].costBasis / holdingMap[key].qty : 0;
        holdingMap[key].realized += (tx.price - avgCost) * tx.qty;
        holdingMap[key].costBasis -= avgCost * tx.qty;
        holdingMap[key].qty -= tx.qty;
      }
    });

    const holdingBuckets = data.holdingBuckets || {};
    const holdings = Object.values(holdingMap).filter(h => h.qty > 0.0001);
    holdings.forEach(h => {
      const key = `${h.market}:${h.ticker}`;
      if (holdingBuckets[key]) h.bucket = holdingBuckets[key];
      const cp = parseFloat(prices[key]);
      h.currentPrice = isNaN(cp) ? null : cp;
      h.currentValue = h.currentPrice !== null ? h.qty * h.currentPrice : null;
      h.unrealizedPL = h.currentValue !== null ? h.currentValue - h.costBasis : null;
      h.unrealizedPct = h.costBasis > 0 && h.unrealizedPL !== null ? (h.unrealizedPL / h.costBasis) * 100 : null;
      h.avgCost = h.qty > 0 ? h.costBasis / h.qty : 0;
    });

    const closed = Object.values(holdingMap).filter(h => h.qty <= 0.0001 && h.realized !== 0);

    const marketStats = {};
    MARKETS.forEach(m => {
      const mTops = tops.filter(t => t.market === m.id);
      const deposits = mTops.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
      const withdrawals = mTops.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);
      const walletBalance = deposits - withdrawals;
      const mHoldings = holdings.filter(h => h.market === m.id);
      const investedLocal = mHoldings.reduce((s, h) => s + h.costBasis, 0);
      const valueLocal = mHoldings.reduce((s, h) => s + (h.currentValue ?? h.costBasis), 0);
      const realizedLocal = Object.values(holdingMap).filter(h => h.market === m.id).reduce((s, h) => s + h.realized, 0);
      const unrealizedLocal = mHoldings.reduce((s, h) => s + (h.unrealizedPL ?? 0), 0);
      const rate = fx[m.currency] || 1;
      const totalBought = txns.filter(t => t.market === m.id && t.type === "buy").reduce((s, t) => s + t.qty * t.price, 0);
      const totalSold = txns.filter(t => t.market === m.id && t.type === "sell").reduce((s, t) => s + t.qty * t.price, 0);
      const cashLocal = walletBalance - totalBought + totalSold;
      marketStats[m.id] = {
        deposits, withdrawals, walletBalance,
        invested: investedLocal, value: valueLocal,
        realized: realizedLocal, unrealized: unrealizedLocal,
        cash: cashLocal, holdings: mHoldings.length,
        investedUSD: investedLocal * rate, valueUSD: valueLocal * rate,
        realizedUSD: realizedLocal * rate, unrealizedUSD: unrealizedLocal * rate,
        cashUSD: cashLocal * rate, walletUSD: walletBalance * rate,
        currency: m.currency,
      };
    });

    const totalInvestedUSD = Object.values(marketStats).reduce((s, m) => s + m.investedUSD, 0);
    const totalValueUSD = Object.values(marketStats).reduce((s, m) => s + m.valueUSD, 0);
    const totalRealizedUSD = Object.values(marketStats).reduce((s, m) => s + m.realizedUSD, 0);
    const totalUnrealizedUSD = Object.values(marketStats).reduce((s, m) => s + m.unrealizedUSD, 0);
    const totalCashUSD = Object.values(marketStats).reduce((s, m) => s + m.cashUSD, 0);
    const totalDepositsUSD = Object.values(marketStats).reduce((s, m) => s + m.walletUSD, 0);

    const bucketAlloc = {};
    BUCKET_OPTIONS.forEach(b => { bucketAlloc[b] = 0; });
    holdings.forEach(h => {
      const rate = fx[h.currency] || 1;
      const val = (h.currentValue ?? h.costBasis) * rate;
      if (bucketAlloc[h.bucket] !== undefined) bucketAlloc[h.bucket] += val;
    });

    return { holdings, closed, marketStats, totalInvestedUSD, totalValueUSD, totalRealizedUSD, totalUnrealizedUSD, totalCashUSD, totalDepositsUSD, bucketAlloc };
  }, [data]);

  // ─── Live Price + FX Auto-Fetch (via Netlify Function proxy) ───
  const refreshPrices = async () => {
    if (fetchingPrices) return;
    const open = analytics.holdings.filter(h => h.qty > 0.0001);
    const stocks = [...new Set(open.filter(h => h.market === "us").map(h => h.ticker))];
    const crypto = [...new Set(open.filter(h => h.market === "crypto").map(h => h.ticker))];
    const fx = ["AED", "EGP"];
    setFetchingPrices(true);
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stocks, crypto, fx }),
      });
      if (!res.ok) throw new Error(`Price service returned ${res.status} — run "netlify dev" locally or check Netlify function logs`);
      const out = await res.json();
      // Also refresh upcoming stock events (next earnings) for US holdings. Best-effort, silent.
      let stockEvents = data.stockEvents || {};
      if (stocks.length) {
        try {
          const evRes = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stocks }),
          });
          const ev = await evRes.json().catch(() => null);
          if (ev) stockEvents = { ...stockEvents, ...(ev.stockEvents || {}) };
        } catch { /* keep existing events */ }
      }
      persist({
        ...data,
        currentPrices: { ...data.currentPrices, ...(out.prices || {}) },
        fxRates: { ...data.fxRates, ...(out.fxRates || {}) },
        stockEvents,
        priceMeta: { lastFetchedAt: out.fetchedAt || new Date().toISOString(), errors: out.errors || [] },
      });
    } catch (e) {
      persist({ ...data, priceMeta: { lastFetchedAt: data.priceMeta?.lastFetchedAt || null, errors: [e.message || "Network error — could not reach price service"] } });
    } finally {
      setFetchingPrices(false);
    }
  };

  // Fetch upcoming stock events (next earnings) for US holdings. Runs independently of price
  // staleness so earnings populate even when prices are already fresh. Sets a visible eventMeta.
  const fetchEvents = async () => {
    const open = analytics.holdings.filter(h => h.qty > 0.0001);
    const stocks = [...new Set(open.filter(h => h.market === "us").map(h => h.ticker))];
    if (stocks.length === 0) return;
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stocks }),
      });
      const ev = await res.json().catch(() => null);
      if (ev) persist({ ...data, stockEvents: { ...(data.stockEvents || {}), ...(ev.stockEvents || {}) } });
    } catch { /* silent */ }
  };

  // Auto-fetch once after data loads, only if cached prices are older than 10 minutes.
  const didAutoFetch = useRef(false);
  useEffect(() => {
    if (loading || didAutoFetch.current) return;
    didAutoFetch.current = true;
    const last = data.priceMeta?.lastFetchedAt;
    const lastDate = last ? new Date(last).toDateString() : null;
    const stale = !last || lastDate !== new Date().toDateString() || (Date.now() - new Date(last).getTime() > 4 * 60 * 60 * 1000);
    if (stale) refreshPrices();
    fetchEvents();
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (showLogin) return <LoginModal T={T} />;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.mainBg, color: T.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
        Loading portfolio...
      </div>
    );
  }

  const totalPL = analytics.totalUnrealizedUSD + analytics.totalRealizedUSD;
  const plColor = totalPL >= 0 ? T.green : T.red;
  const portfolioValue = analytics.totalValueUSD + analytics.totalCashUSD;

  const filteredTx = marketFilter === "all" ? data.transactions : data.transactions.filter(t => t.market === marketFilter);
  const filteredTopups = marketFilter === "all" ? data.topups : data.topups.filter(t => t.market === marketFilter);

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "◉" },
    { id: "holdings", label: "Holdings", icon: "◈" },
    { id: "cards", label: "Stock Cards", icon: "⊞" },
    { id: "transactions", label: "Transactions", icon: "⟳" },
    { id: "wallets", label: "Wallets", icon: "◇" },
  ];

  const SS = mkSelect(T);
  const BP = mkBtnPrimary(T);
  const BSS = mkBtnSecondary(T);
  const BUCKET_COLORS = [T.gold, T === DARK ? "#f59e0b" : "#c07800", T.purple];

  return (
    <div style={{
      minHeight: "100vh", background: T.mainBg, color: T.text,
      fontFamily: "'DM Sans', sans-serif", fontSize: 14,
      transition: "background 0.2s, color 0.2s",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "16px 22px", borderBottom: `1px solid ${T.divider}`,
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        background: T.cardBg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px", color: T.text }}>Portfolio Tracker</h1>
            <span style={{ fontSize: 11, color: T.textMuted }}>EGX · ADX · US · Crypto</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <SyncStatus status={syncStatus} T={T} />
          <span style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>
            {fetchingPrices ? "fetching prices…" : `prices ${timeAgo(data.priceMeta?.lastFetchedAt)}`}
          </span>
          <button
            style={{ ...BSS, fontSize: 12, padding: "7px 14px", opacity: fetchingPrices ? 0.6 : 1 }}
            disabled={fetchingPrices}
            onClick={refreshPrices}
          >{fetchingPrices ? "⏳ Refreshing" : "🔄 Refresh"}</button>
          <ThemeToggle dark={dark} onToggle={toggleTheme} T={T} />
          <button style={{ ...BSS, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowFxModal(true)}>💱 FX Rates</button>
          <button style={{ ...BSS, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowPriceModal(true)}>📈 Update Prices</button>
          <button style={{ ...BP, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowTopupModal(true)}>💰 Deposit</button>
          <button style={{ ...BP, fontSize: 12, padding: "7px 14px", background: T.green, color: "#fff" }} onClick={() => setShowTxModal(true)}>＋ Trade</button>
        </div>
      </div>

      {/* Price fetch error bar */}
      {data.priceMeta?.errors?.length > 0 && (
        <div style={{
          padding: "8px 22px", background: T.red, color: "#fff",
          fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          ⚠ Price update issue: {data.priceMeta.errors[0]}{data.priceMeta.errors.length > 1 ? ` (+${data.priceMeta.errors.length - 1} more)` : ""}
        </div>
      )}

      {/* Next upcoming earnings across holdings */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10);
        const next = Object.entries(data.stockEvents || {})
          .filter(([, v]) => v?.earnings && v.earnings >= today)
          .sort((a, b) => a[1].earnings.localeCompare(b[1].earnings))[0];
        if (!next) return null;
        const ticker = next[0].split(":")[1];
        return (
          <div style={{
            padding: "6px 22px", background: T.goldSoft, color: T.gold,
            fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}>
            📅 Next up: {ticker} earnings {next[1].earnings}{next[1].earningsEstimated ? " (est)" : ""}
          </div>
        );
      })()}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, borderBottom: `1px solid ${T.divider}`,
        padding: "0 22px", overflowX: "auto", background: T.cardBg,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "12px 18px", background: "none", border: "none",
            borderBottom: tab === t.id ? `2px solid ${T.gold}` : "2px solid transparent",
            color: tab === t.id ? T.text : T.textMuted,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select
          style={{ ...SS, width: "auto", fontSize: 12, padding: "6px 10px", margin: "6px 0" }}
          value={marketFilter}
          onChange={e => setMarketFilter(e.target.value)}
        >
          <option value="all">All Markets</option>
          {MARKETS.map(m => <option key={m.id} value={m.id}>{m.flag} {m.name}</option>)}
        </select>
      </div>

      <div style={{ padding: "20px 22px", maxWidth: 1200 }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab === "dashboard" && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
              <StatCard label="Portfolio Value (USD)" value={`$${formatNum(portfolioValue)}`} T={T} />
              <StatCard label="Total Invested (USD)" value={`$${formatNum(analytics.totalInvestedUSD)}`} T={T} />
              <StatCard
                label="Total P&L"
                value={`${totalPL >= 0 ? "+" : ""}$${formatNum(totalPL)}`}
                accent={plColor}
                sub={analytics.totalInvestedUSD > 0 ? `${totalPL >= 0 ? "+" : ""}${formatNum((totalPL / analytics.totalInvestedUSD) * 100)}%` : ""}
                T={T}
              />
              <StatCard label="Cash Available" value={`$${formatNum(analytics.totalCashUSD)}`} accent={T.gold} T={T} />
            </div>

            {/* Market Breakdown */}
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, marginBottom: 12, letterSpacing: "0.6px", textTransform: "uppercase" }}>Market Breakdown</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 24 }}>
              {MARKETS.map(m => {
                const s = analytics.marketStats[m.id];
                const mPL = s.realized + s.unrealized;
                return (
                  <div key={m.id} style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 20 }}>{m.flag}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>{m.currency}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        ["Invested", formatNum(s.invested)],
                        ["Value", formatNum(s.value)],
                        ["P&L", `${mPL >= 0 ? "+" : ""}${formatNum(mPL)}`],
                        ["Cash", formatNum(s.cash)],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{k}</div>
                          <div style={{
                            fontSize: 14, fontWeight: 600,
                            color: k === "P&L" ? (mPL >= 0 ? T.green : T.red) : T.text,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: T.textMuted }}>{s.holdings} open position{s.holdings !== 1 ? "s" : ""}</div>
                  </div>
                );
              })}
            </div>

            {/* Bucket Allocation */}
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, marginBottom: 12, letterSpacing: "0.6px", textTransform: "uppercase" }}>Strategy Allocation (USD)</h3>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
              {BUCKET_OPTIONS.map((b, i) => {
                const val = analytics.bucketAlloc[b] || 0;
                const pct = portfolioValue > 0 ? (val / portfolioValue) * 100 : 0;
                return (
                  <div key={b} style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 18px", flex: "1 1 180px" }}>
                    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>{b}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: BUCKET_COLORS[i], fontFamily: "'JetBrains Mono', monospace" }}>
                      ${formatNum(val)}
                    </div>
                    <div style={{ marginTop: 6, height: 4, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: BUCKET_COLORS[i], borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{formatNum(pct, 1)}% of portfolio</div>
                  </div>
                );
              })}
            </div>

            {/* Copy for Claude */}
            <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>📋 Copy Summary for Claude</div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 10px 0" }}>Click below to copy your portfolio summary, then paste it in your Investment Analysis Hub project chat.</p>
              <button style={{ ...BP, fontSize: 12, padding: "8px 16px" }} onClick={() => {
                let summary = `# My Portfolio Snapshot (${new Date().toLocaleDateString("en-GB")})\n\n`;
                summary += `**Portfolio Value:** $${formatNum(portfolioValue)} USD\n`;
                summary += `**Total Invested:** $${formatNum(analytics.totalInvestedUSD)} USD\n`;
                summary += `**Total P&L:** ${totalPL >= 0 ? "+" : ""}$${formatNum(totalPL)} USD\n`;
                summary += `**Cash:** $${formatNum(analytics.totalCashUSD)} USD\n\n`;
                summary += `## Open Positions\n\n`;
                MARKETS.forEach(m => {
                  const hs = analytics.holdings.filter(h => h.market === m.id);
                  if (hs.length === 0) return;
                  summary += `### ${m.flag} ${m.name} (${m.currency})\n`;
                  hs.forEach(h => {
                    summary += `- **${h.ticker}**: ${h.qty} units @ avg ${formatNum(h.avgCost)} ${h.currency}`;
                    if (h.currentPrice !== null) summary += ` | Current: ${formatNum(h.currentPrice)} | P&L: ${h.unrealizedPL >= 0 ? "+" : ""}${formatNum(h.unrealizedPL)} (${h.unrealizedPct >= 0 ? "+" : ""}${formatNum(h.unrealizedPct, 1)}%)`;
                    summary += ` [${h.bucket}]\n`;
                  });
                  summary += "\n";
                });
                summary += `## FX Rates\n`;
                Object.entries(data.fxRates).filter(([k]) => k !== "USD").forEach(([k, v]) => {
                  summary += `- 1 ${k} = ${v} USD\n`;
                });
                navigator.clipboard.writeText(summary);
                alert("Portfolio summary copied to clipboard!");
              }}>
                Copy Portfolio Summary
              </button>
            </div>
          </>
        )}

        {/* ═══ HOLDINGS ═══ */}
        {tab === "holdings" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: T.textMuted }}>
                {fetchingPrices ? "fetching prices…" : `US/Crypto: ${timeAgo(data.priceMeta?.lastFetchedAt)}`}
              </span>
              <button
                style={{ ...BSS, fontSize: 12, padding: "6px 14px", opacity: fetchingPrices ? 0.6 : 1 }}
                disabled={fetchingPrices}
                onClick={refreshPrices}
              >{fetchingPrices ? "⏳ Refreshing…" : "🔄 Refresh Prices"}</button>
            </div>
            {analytics.holdings.filter(h => marketFilter === "all" || h.market === marketFilter).length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: T.textMuted }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                <div>No open positions yet. Add a trade to get started.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {[
                        { key: "market", label: "Market" }, { key: "ticker", label: "Ticker" },
                        { key: "qty", label: "Qty" }, { key: "avgCost", label: "Avg Cost" },
                        { key: "current", label: "Current" }, { key: "value", label: "Value" },
                        { key: "pl", label: "P&L" }, { key: "plPct", label: "P&L %" },
                        { key: "plUSD", label: "P&L (USD)" },
                        { key: "bucket", label: "Bucket" },
                      ].map(({ key, label }) => (
                        <th key={key}
                          onClick={() => key !== "bucket" && key !== "plUSD" && setHoldingsSort(s => ({ col: key, dir: s.col === key && s.dir === "desc" ? "asc" : "desc" }))}
                          style={{
                            textAlign: "left", padding: "10px 12px", fontSize: 11,
                            color: holdingsSort.col === key ? T.gold : T.textMuted,
                            fontWeight: 600, borderBottom: `1px solid ${T.border}`,
                            textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap",
                            cursor: key !== "bucket" && key !== "plUSD" ? "pointer" : "default", userSelect: "none",
                          }}>
                          {label}{key !== "bucket" && key !== "plUSD" && holdingsSort.col === key && <span style={{ marginLeft: 4 }}>{holdingsSort.dir === "asc" ? "↑" : "↓"}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.holdings
                      .filter(h => marketFilter === "all" || h.market === marketFilter)
                      .slice()
                      .sort((a, b) => {
                        const { col, dir } = holdingsSort;
                        let av, bv;
                        if (col === "ticker") { av = a.ticker; bv = b.ticker; }
                        else if (col === "market") { av = a.market; bv = b.market; }
                        else if (col === "qty") { av = a.qty; bv = b.qty; }
                        else if (col === "avgCost") { av = a.avgCost; bv = b.avgCost; }
                        else if (col === "current") { av = a.currentPrice ?? -Infinity; bv = b.currentPrice ?? -Infinity; }
                        else if (col === "pl") { av = a.unrealizedPL ?? -Infinity; bv = b.unrealizedPL ?? -Infinity; }
                        else if (col === "plPct") { av = a.unrealizedPct ?? -Infinity; bv = b.unrealizedPct ?? -Infinity; }
                        else { av = a.currentValue ?? a.costBasis; bv = b.currentValue ?? b.costBasis; }
                        if (typeof av === "string") return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
                        return dir === "asc" ? av - bv : bv - av;
                      })
                      .map(h => {
                        const mkt = MARKETS.find(m => m.id === h.market);
                        return (
                          <tr key={`${h.market}:${h.ticker}`}
                            style={{ borderBottom: `1px solid ${T.divider}`, cursor: "pointer" }}
                            onClick={() => { setSelectedCard({ type: "holding", key: `${h.market}:${h.ticker}` }); setShowCardModal(true); }}
                            onMouseEnter={e => e.currentTarget.style.background = T.surfaceBg}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: T.text }}>{mkt?.flag} {mkt?.id.toUpperCase()}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: T.text }}>
                              {h.ticker}
                              {data.stockEvents?.[`${h.market}:${h.ticker}`]?.earnings && (
                                <span style={{ display: "block", marginTop: 3, fontSize: 10, fontWeight: 600, color: T.gold, fontFamily: "system-ui, sans-serif" }}>
                                  📅 {data.stockEvents[`${h.market}:${h.ticker}`].earnings}{data.stockEvents[`${h.market}:${h.ticker}`].earningsEstimated ? " (est)" : ""}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: T.textSub }}>{formatNum(h.qty, h.qty < 1 ? 6 : 2)}</td>
                            <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: T.textSub }}>{formatNum(h.avgCost)}</td>
                            <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: h.currentPrice !== null ? T.text : T.textMuted }}>
                              {h.currentPrice !== null ? formatNum(h.currentPrice) : "—"}
                              {MANUAL_MARKETS.includes(h.market) && (
                                <span title="No live feed for this market — price is entered manually" style={{
                                  display: "block", marginTop: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.3px",
                                  textTransform: "uppercase", color: T.red, fontFamily: "system-ui, sans-serif",
                                }}>
                                  ● manual · {timeAgo(data.priceEditedAt?.[`${h.market}:${h.ticker}`])}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: T.text }}>
                              {h.currentValue !== null ? formatNum(h.currentValue) : formatNum(h.costBasis)}
                            </td>
                            <td style={{
                              padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                              color: h.unrealizedPL !== null ? (h.unrealizedPL >= 0 ? T.green : T.red) : T.textMuted,
                            }}>
                              {h.unrealizedPL !== null ? `${h.unrealizedPL >= 0 ? "+" : ""}${formatNum(h.unrealizedPL)}` : "—"}
                            </td>
                            <td style={{
                              padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                              color: h.unrealizedPct !== null ? (h.unrealizedPct >= 0 ? T.green : T.red) : T.textMuted,
                            }}>
                              {h.unrealizedPct !== null ? `${h.unrealizedPct >= 0 ? "+" : ""}${formatNum(h.unrealizedPct, 1)}%` : "—"}
                            </td>
                            {(() => {
                              const mktCur = MARKETS.find(m => m.id === h.market)?.currency;
                              const fx = (data.fxRates?.[mktCur] ?? DEFAULT_FX[mktCur] ?? 1);
                              const plUSD = h.unrealizedPL !== null ? h.unrealizedPL * fx : null;
                              return (
                                <td style={{
                                  padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 12,
                                  color: plUSD !== null ? (plUSD >= 0 ? T.green : T.red) : T.textMuted,
                                }}>
                                  {plUSD !== null ? `${plUSD >= 0 ? "+" : ""}$${formatNum(Math.abs(plUSD))}` : "—"}
                                </td>
                              );
                            })()}
                            <td style={{ padding: "6px 12px" }} onClick={e => e.stopPropagation()}>
                              <select
                                value={data.holdingBuckets?.[`${h.market}:${h.ticker}`] || h.bucket}
                                onChange={e => saveHoldingBucket(`${h.market}:${h.ticker}`, e.target.value)}
                                style={{
                                  background: T.surfaceBg, border: `1px solid ${T.border}`,
                                  color: T.textMuted, fontSize: 11, borderRadius: 4,
                                  padding: "3px 6px", cursor: "pointer",
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                {BUCKET_OPTIONS.map(b => (
                                  <option key={b} value={b}>
                                    {b === "Swing (3d-2mo)" ? "Swing" : b === "Long-Term (up to 1yr)" ? "LT" : "Flex"}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══ STOCK CARDS ═══ */}
        {tab === "cards" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.textMuted, letterSpacing: "0.6px", textTransform: "uppercase" }}>
                Holdings ({analytics.holdings.filter(h => marketFilter === "all" || h.market === marketFilter).length})
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...BSS, fontSize: 12, padding: "7px 14px" }} onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                  alert("Full portfolio data copied as JSON!\n\nPaste it in your Investment Hub and ask:\n\"Update my portfolio with this data.\"");
                }}>📤 Export JSON</button>
                <button style={{ ...BSS, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowDataImport(true)}>📥 Import JSON</button>
              </div>
            </div>

            {analytics.holdings.filter(h => marketFilter === "all" || h.market === marketFilter).length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted }}>No open positions{marketFilter !== "all" ? " in this market" : ""}. Add a trade to get started.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 32 }}>
                {analytics.holdings.filter(h => marketFilter === "all" || h.market === marketFilter).map(h => {
                  const key = `${h.market}:${h.ticker}`;
                  const card = data.stockCards?.[key] || {};
                  const mkt = MARKETS.find(m => m.id === h.market);
                  const plPos = h.unrealizedPL != null && h.unrealizedPL >= 0;
                  return (
                    <div key={key}
                      onClick={() => { setSelectedCard({ type: "holding", key }); setShowCardModal(true); }}
                      style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = T.gold}
                      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 16 }}>{mkt?.flag}</span>
                          <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: T.text, fontSize: 15 }}>{h.ticker}</span>
                        </div>
                        {h.unrealizedPct != null && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: plPos ? T.green : T.red, background: plPos ? T.greenSoft : T.redSoft, padding: "2px 7px", borderRadius: 4 }}>
                            {h.unrealizedPct >= 0 ? "+" : ""}{formatNum(h.unrealizedPct, 1)}%
                          </span>
                        )}
                      </div>
                      {(card.t1 || card.t2 || card.stopLoss) && (
                        <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
                          {card.t1 && <span style={{ fontSize: 11, color: T.gold, background: T.goldSoft, padding: "1px 6px", borderRadius: 3 }}>T1 {card.t1}</span>}
                          {card.t2 && <span style={{ fontSize: 11, color: T.gold, background: T.goldSoft, padding: "1px 6px", borderRadius: 3 }}>T2 {card.t2}</span>}
                          {card.stopLoss && <span style={{ fontSize: 11, color: T.red, background: T.redSoft, padding: "1px 6px", borderRadius: 3 }}>SL {card.stopLoss}</span>}
                        </div>
                      )}
                      {data.stockEvents?.[key]?.earnings && (
                        <div style={{ fontSize: 11, color: T.gold, marginBottom: 6 }}>
                          📅 Earnings {data.stockEvents[key].earnings}{data.stockEvents[key].earningsEstimated ? " (est)" : ""}
                        </div>
                      )}
                      {card.notes
                        ? <p style={{ fontSize: 12, color: T.textMuted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.notes}</p>
                        : <p style={{ fontSize: 12, color: T.textDim, margin: 0 }}>Click to add card details</p>
                      }
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.textMuted, letterSpacing: "0.6px", textTransform: "uppercase" }}>
                Watch List ({(data.watchList || []).filter(w => marketFilter === "all" || w.market === marketFilter).length})
              </h3>
              <button style={{ ...BP, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowWatchAddModal(true)}>+ Add to Watch List</button>
            </div>

            {(data.watchList || []).filter(w => marketFilter === "all" || w.market === marketFilter).length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted, border: `2px dashed ${T.border}`, borderRadius: 10 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>👁</div>
                <div>{(data.watchList || []).length === 0 ? "Watch List is empty. Add stocks you are tracking." : "No watch list entries for this market."}</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {(data.watchList || []).filter(w => marketFilter === "all" || w.market === marketFilter).map(w => {
                  const mkt = MARKETS.find(m => m.id === w.market);
                  return (
                    <div key={w.id}
                      onClick={() => { setSelectedCard({ type: "watch", id: w.id }); setShowCardModal(true); }}
                      style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = T.gold}
                      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 16 }}>{mkt?.flag}</span>
                          <div>
                            <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: T.text, fontSize: 15 }}>{w.ticker}</span>
                            {w.name && <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 6 }}>{w.name}</span>}
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteWatchItem(w.id); }} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 13, padding: "0 2px" }}>🗑</button>
                      </div>
                      {(w.t1 || w.t2 || w.stopLoss) && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {w.t1 && <span style={{ fontSize: 11, color: T.gold, background: T.goldSoft, padding: "1px 6px", borderRadius: 3 }}>T1 {w.t1}</span>}
                          {w.t2 && <span style={{ fontSize: 11, color: T.gold, background: T.goldSoft, padding: "1px 6px", borderRadius: 3 }}>T2 {w.t2}</span>}
                          {w.stopLoss && <span style={{ fontSize: 11, color: T.red, background: T.redSoft, padding: "1px 6px", borderRadius: 3 }}>SL {w.stopLoss}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ TRANSACTIONS ═══ */}
        {tab === "transactions" && (
          <>
            {filteredTx.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: T.textMuted }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                <div>No transactions yet. Click "+ Trade" to add one.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Date", "Market", "Type", "Ticker", "Qty", "Price", "Total", "Bucket", "Notes", ""].map(h => (
                        <th key={h} style={{
                          textAlign: "left", padding: "10px 12px", fontSize: 11,
                          color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}`,
                          textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date)).map(tx => {
                      const mkt = MARKETS.find(m => m.id === tx.market);
                      return (
                        <tr key={tx.id} style={{ borderBottom: `1px solid ${T.divider}` }}>
                          <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontSize: 13, color: T.textSub }}>{formatDate(tx.date)}</td>
                          <td style={{ padding: "10px 12px" }}>{mkt?.flag}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                              background: tx.type === "buy" ? T.greenSoft : T.redSoft,
                              color: tx.type === "buy" ? T.green : T.red,
                            }}>
                              {tx.type.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: T.text }}>{tx.ticker}</td>
                          <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: T.textSub }}>{formatNum(tx.qty, tx.qty < 1 ? 6 : 2)}</td>
                          <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: T.textSub }}>{formatNum(tx.price)}</td>
                          <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: T.text }}>
                            {formatNum(tx.qty * tx.price)} {tx.currency}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>{tx.bucket}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.notes}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <button onClick={() => setDeleteTarget({ type: "tx", id: tx.id })} style={{
                              background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, padding: "2px 6px",
                            }}>🗑</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══ WALLETS ═══ */}
        {tab === "wallets" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
              {MARKETS.filter(m => marketFilter === "all" || m.id === marketFilter).map(m => {
                const s = analytics.marketStats[m.id];
                return (
                  <div key={m.id} style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 22 }}>{m.flag}</span>
                      <span style={{ fontWeight: 600, color: T.text }}>{m.name}</span>
                    </div>
                    {[
                      ["Total Deposits", formatNum(s.deposits)],
                      ["Withdrawals", formatNum(s.withdrawals)],
                      ["Net Funded", formatNum(s.walletBalance)],
                      ["In Positions", formatNum(s.invested)],
                      ["Cash Available", formatNum(s.cash)],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.divider}` }}>
                        <span style={{ fontSize: 13, color: T.textMuted }}>{k}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: T.textSub }}>{v} {m.currency}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, marginBottom: 12, letterSpacing: "0.6px", textTransform: "uppercase" }}>Deposit / Withdrawal History</h3>
            {filteredTopups.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted }}>No wallet transactions yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Date", "Market", "Type", "Amount", "Notes", ""].map(h => (
                        <th key={h} style={{
                          textAlign: "left", padding: "10px 12px", fontSize: 11,
                          color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}`,
                          textTransform: "uppercase", letterSpacing: "0.5px",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredTopups].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => {
                      const mkt = MARKETS.find(m => m.id === t.market);
                      return (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${T.divider}` }}>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: T.textSub }}>{formatDate(t.date)}</td>
                          <td style={{ padding: "10px 12px", color: T.text }}>{mkt?.flag} {mkt?.id.toUpperCase()}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                              background: t.type === "deposit" ? T.goldSoft : T.redSoft,
                              color: t.type === "deposit" ? T.gold : T.red,
                            }}>
                              {t.type === "deposit" ? "⬆ DEPOSIT" : "⬇ WITHDRAWAL"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: T.text }}>
                            {formatNum(t.amount)} {t.currency}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>{t.notes}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <button onClick={() => setDeleteTarget({ type: "topup", id: t.id })} style={{
                              background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, padding: "2px 6px",
                            }}>🗑</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AddTransactionModal open={showTxModal} onClose={() => setShowTxModal(false)} onSave={addTransaction} T={T} />
      <AddTopupModal open={showTopupModal} onClose={() => setShowTopupModal(false)} onSave={addTopup} T={T} />
      <UpdatePriceModal open={showPriceModal} onClose={() => setShowPriceModal(false)}
        holdings={analytics.holdings} currentPrices={data.currentPrices} onSave={updatePrices} T={T} />
      <FxRatesModal open={showFxModal} onClose={() => setShowFxModal(false)} fxRates={data.fxRates} onSave={updateFx} T={T} />
      <DataImportModal open={showDataImport} onClose={() => setShowDataImport(false)} onImport={d => persist({ ...INITIAL_DATA, ...d })} T={T} />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        message="Are you sure you want to delete this entry? This cannot be undone."
        T={T}
        onConfirm={() => {
          if (deleteTarget.type === "tx") deleteTransaction(deleteTarget.id);
          else deleteTopup(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
      <StockCardModal
        open={showCardModal}
        onClose={() => { setShowCardModal(false); setSelectedCard(null); }}
        holding={selectedCard?.type === "holding" ? analytics.holdings.find(h => `${h.market}:${h.ticker}` === selectedCard.key) : null}
        cardData={
          selectedCard?.type === "holding"
            ? (data.stockCards?.[selectedCard.key] || {})
            : selectedCard?.type === "watch"
              ? ((data.watchList || []).find(w => w.id === selectedCard.id) || {})
              : {}
        }
        onSave={(formData) => {
          if (selectedCard?.type === "holding") saveStockCard(selectedCard.key, formData);
          else if (selectedCard?.type === "watch") saveWatchItem(selectedCard.id, formData);
        }}
        onSavePrice={(key, price) => {
          const now = new Date().toISOString();
          persist({ ...data, currentPrices: { ...data.currentPrices, [key]: String(price) }, priceEditedAt: { ...(data.priceEditedAt || {}), [key]: now } });
        }}
        T={T}
      />
      <WatchListAddModal open={showWatchAddModal} onClose={() => setShowWatchAddModal(false)} onSave={addWatchItem} T={T} />
    </div>
  );
}
