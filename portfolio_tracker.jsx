import { useState, useEffect, useCallback, useMemo } from "react";

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

const DEFAULT_FX = { USD: 1, USDT: 1, EGP: 0.0196, AED: 0.2723 };
const STORAGE_KEY = "portfolio-tracker-v6";
const THEME_KEY = "portfolio-theme-v1";

async function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.error("Save failed:", e); }
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
};

const INITIAL_DATA = { transactions: [], topups: [], fxRates: DEFAULT_FX, currentPrices: {} };

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
function Modal({ open, onClose, title, children, T }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.cardBg, border: `1px solid ${T.border}`,
        borderRadius: 12, width: "100%", maxWidth: 520,
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

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
  };

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

  const persist = useCallback((newData) => {
    setData(newData);
    saveData(newData);
  }, []);

  const addTransaction = (tx) => persist({ ...data, transactions: [...data.transactions, tx] });
  const addTopup = (t) => persist({ ...data, topups: [...data.topups, t] });
  const deleteTransaction = (id) => persist({ ...data, transactions: data.transactions.filter(t => t.id !== id) });
  const deleteTopup = (id) => persist({ ...data, topups: data.topups.filter(t => t.id !== id) });
  const updatePrices = (p) => persist({ ...data, currentPrices: p });
  const updateFx = (r) => persist({ ...data, fxRates: { ...data.fxRates, ...r } });

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

    const holdings = Object.values(holdingMap).filter(h => h.qty > 0.0001);
    holdings.forEach(h => {
      const key = `${h.market}:${h.ticker}`;
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
          <ThemeToggle dark={dark} onToggle={toggleTheme} T={T} />
          <button style={{ ...BSS, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowFxModal(true)}>💱 FX Rates</button>
          <button style={{ ...BSS, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowPriceModal(true)}>📈 Update Prices</button>
          <button style={{ ...BP, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowTopupModal(true)}>💰 Deposit</button>
          <button style={{ ...BP, fontSize: 12, padding: "7px 14px", background: T.green, color: "#fff" }} onClick={() => setShowTxModal(true)}>＋ Trade</button>
        </div>
      </div>

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
                      {["Market", "Ticker", "Qty", "Avg Cost", "Current", "Value", "P&L", "P&L %", "Bucket"].map(h => (
                        <th key={h} style={{
                          textAlign: "left", padding: "10px 12px", fontSize: 11,
                          color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}`,
                          textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.holdings
                      .filter(h => marketFilter === "all" || h.market === marketFilter)
                      .sort((a, b) => (b.currentValue ?? b.costBasis) - (a.currentValue ?? a.costBasis))
                      .map(h => {
                        const mkt = MARKETS.find(m => m.id === h.market);
                        return (
                          <tr key={`${h.market}:${h.ticker}`} style={{ borderBottom: `1px solid ${T.divider}` }}>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: T.text }}>{mkt?.flag} {mkt?.id.toUpperCase()}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: T.text }}>{h.ticker}</td>
                            <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: T.textSub }}>{formatNum(h.qty, h.qty < 1 ? 6 : 2)}</td>
                            <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: T.textSub }}>{formatNum(h.avgCost)}</td>
                            <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: h.currentPrice !== null ? T.text : T.textMuted }}>
                              {h.currentPrice !== null ? formatNum(h.currentPrice) : "—"}
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
                            <td style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>{h.bucket}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
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
    </div>
  );
}
