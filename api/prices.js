// Live price + FX proxy via Yahoo Finance (keyless, free).
// POST body: { stocks: ["AAPL"], crypto: ["BTC"], egx: ["COMI"], fx: ["AED","EGP"] }
// Returns:   { prices: {...}, fxRates: {...}, fetchedAt: "<iso>", errors: [] }

// Yahoo throttles datacenter IPs on query1; query2 is used as a fallback host.
const YF_HOSTS = [
  "https://query1.finance.yahoo.com/v8/finance/chart/",
  "https://query2.finance.yahoo.com/v8/finance/chart/",
];

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
