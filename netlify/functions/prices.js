// Live price + FX proxy via Yahoo Finance (keyless, free, no per-minute credit cap).
// POST body: { stocks: ["AAPL"], crypto: ["BTC"], egx: ["COMI"], fx: ["AED","EGP"] }
// Returns:   { prices: { "us:AAPL": "298.01", "crypto:BTC": "...", "egx:COMI": "..." },
//              fxRates: { AED: 0.2723, EGP: 0.0201, USDT: 1 },
//              fetchedAt: "<iso>", errors: [] }
// Yahoo covers US, crypto, FX and EGX (Cairo, .CA). ADX is not on Yahoo — it stays manual in the app.

// Yahoo throttles datacenter IPs on query1; query2 is used as a fallback host.
const YF_HOSTS = [
  "https://query1.finance.yahoo.com/v8/finance/chart/",
  "https://query2.finance.yahoo.com/v8/finance/chart/",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const reply = (payload) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(payload) });

// Map an app holding to its Yahoo symbol.
function yahooSymbol(kind, ticker) {
  if (kind === "crypto") return `${ticker}-USD`;
  if (kind === "egx") return `${ticker}.CA`;
  if (kind === "fx") return `${ticker}USD=X`;
  return ticker; // us
}

async function fetchHost(host, symbol) {
  const url = `${host}${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  // Abort each request so a stalled symbol can never hang the whole function
  // (a hang gets the connection killed by the platform → "Failed to fetch" on the client).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
    });
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (price === undefined || price === null) {
      throw new Error(String(json?.chart?.error?.code || res.status));
    }
    return Number(price);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOne(symbol) {
  let lastErr;
  for (const host of YF_HOSTS) {
    try {
      return await fetchHost(host, symbol);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("no data");
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ errors: ["Method not allowed"] }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const arr = (v) => (Array.isArray(v) ? v : []);

  // Build the work list, remembering how to file each result back.
  const map = [];
  arr(body.stocks).forEach(t => map.push({ kind: "stock", ticker: t, symbol: yahooSymbol("stock", t) }));
  arr(body.crypto).forEach(t => map.push({ kind: "crypto", ticker: t, symbol: yahooSymbol("crypto", t) }));
  arr(body.egx).forEach(t => map.push({ kind: "egx", ticker: t, symbol: yahooSymbol("egx", t) }));
  arr(body.fx).forEach(c => map.push({ kind: "fx", ticker: c, symbol: yahooSymbol("fx", c) }));

  const prices = {};
  const fxRates = { USDT: 1 };
  const errors = [];

  if (map.length === 0) {
    return reply({ prices, fxRates, fetchedAt: new Date().toISOString(), errors });
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

  return reply({ prices, fxRates, fetchedAt: new Date().toISOString(), errors });
}
