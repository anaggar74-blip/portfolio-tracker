// Live price + FX proxy via Twelve Data (free tier).
// Holds TWELVEDATA_API_KEY server-side so it is never exposed to the browser.
// POST body: { stocks: ["RKLB"], crypto: ["BTC"], fx: ["AED","EGP"] }
// Returns:   { prices: { "us:RKLB": "82.9", "crypto:BTC": "..." },
//              fxRates: { AED: 0.27, EGP: 0.0196, USDT: 1 },
//              fetchedAt: "<iso>", errors: [] }
// EGX/ADX are never fetched here — they stay manual in the app.

const TD_PRICE = "https://api.twelvedata.com/price";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const reply = (payload) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(payload) });

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ errors: ["Method not allowed"] }) };
  }

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return reply({ prices: {}, fxRates: {}, fetchedAt: null, errors: ["TWELVEDATA_API_KEY not configured"] });
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const stocks = Array.isArray(body.stocks) ? body.stocks : [];
  const crypto = Array.isArray(body.crypto) ? body.crypto : [];
  const fx = Array.isArray(body.fx) ? body.fx : [];

  // Map each requested item to a Twelve Data symbol, remembering how to file the result back.
  const map = [];
  stocks.forEach(t => map.push({ symbol: t, kind: "stock", ticker: t }));
  crypto.forEach(t => map.push({ symbol: `${t}/USD`, kind: "crypto", ticker: t }));
  fx.forEach(c => map.push({ symbol: `${c}/USD`, kind: "fx", ticker: c }));

  const prices = {};
  const fxRates = { USDT: 1 };
  const errors = [];

  if (map.length === 0) {
    return reply({ prices, fxRates, fetchedAt: new Date().toISOString(), errors });
  }

  const symbols = map.map(m => m.symbol).join(",");
  let json;
  try {
    const res = await fetch(`${TD_PRICE}?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`);
    json = await res.json();
  } catch (e) {
    return reply({ prices, fxRates, fetchedAt: null, errors: ["Fetch failed: " + e.message] });
  }

  // A whole-request failure (e.g. rate limit) comes back as a flat error object.
  if (json && json.status === "error") {
    return reply({ prices, fxRates, fetchedAt: null, errors: [json.message || "Twelve Data error"] });
  }

  // Single symbol -> { price }; multiple -> { "SYM": { price } | { code, message, status } }.
  const single = map.length === 1;
  for (const m of map) {
    const entry = single ? json : (json ? json[m.symbol] : undefined);
    const num = entry ? Number(entry.price) : NaN;
    if (!entry || entry.price === undefined || !isFinite(num)) {
      errors.push(`${m.symbol}: ${(entry && entry.message) || "no data"}`);
      continue;
    }
    if (m.kind === "fx") fxRates[m.ticker] = num;
    else prices[`${m.kind === "crypto" ? "crypto" : "us"}:${m.ticker}`] = String(num);
  }

  return reply({ prices, fxRates, fetchedAt: new Date().toISOString(), errors });
}
