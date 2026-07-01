// Upcoming stock events (next earnings date) for US holdings, via Yahoo Finance.
// Yahoo's quoteSummary needs a cookie + crumb (keyless, but not open like the chart endpoint).
// POST body: { stocks: ["AAPL","MSFT"] }
// Returns: { stockEvents: { "us:AAPL": { earnings, earningsEstimated } }, fetchedAt, errors }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Cache the cookie + crumb across warm invocations (they last a while).
let session = { cookie: "", crumb: "", at: 0 };

function parseCookies(setCookie) {
  if (!setCookie) return "";
  // Node fetch returns a single comma-joined string; split on the boundary before "name="
  return setCookie
    .split(/,(?=[^ ;,]+=)/)
    .map(c => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function ensureSession(force = false) {
  const fresh = session.crumb && Date.now() - session.at < 30 * 60 * 1000;
  if (fresh && !force) return session;
  const r1 = await fetch("https://finance.yahoo.com/quote/AAPL", { headers: { "User-Agent": UA } });
  const cookie = parseCookies(r1.headers.get("set-cookie"));
  const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  const crumb = (await r2.text()).trim();
  if (!crumb || crumb.includes("<")) throw new Error(`crumb fetch failed (${r2.status})`);
  session = { cookie, crumb, at: Date.now() };
  return session;
}

// Yahoo earnings dates arrive as unix seconds; when unconfirmed there are 2 (a range).
function pickEarnings(ce) {
  const arr = ce?.earnings?.earningsDate;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const secs = arr.map(x => x?.raw).filter(n => typeof n === "number").sort((a, b) => a - b);
  if (secs.length === 0) return null;
  return { date: new Date(secs[0] * 1000).toISOString().slice(0, 10), estimated: secs.length > 1 };
}

async function fetchEarnings(ticker) {
  const { cookie, crumb } = await ensureSession();
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents&crumb=${encodeURIComponent(crumb)}`;
  let res = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie } });
  if (res.status === 401) {
    // crumb went stale — refresh once and retry
    const s = await ensureSession(true);
    res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents&crumb=${encodeURIComponent(s.crumb)}`,
      { headers: { "User-Agent": UA, Cookie: s.cookie } }
    );
  }
  const json = await res.json();
  const ce = json?.quoteSummary?.result?.[0]?.calendarEvents;
  if (!ce) throw new Error(String(json?.quoteSummary?.error?.description || res.status));
  return pickEarnings(ce);
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ errors: ["Method not allowed"] });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const stocks = Array.isArray(body.stocks) ? [...new Set(body.stocks)] : [];

  const stockEvents = {};
  const errors = [];

  const results = await Promise.allSettled(stocks.map(fetchEarnings));
  results.forEach((r, i) => {
    const t = stocks[i];
    if (r.status !== "fulfilled") { errors.push(`${t}: ${r.reason?.message || "no data"}`); return; }
    if (r.value) stockEvents[`us:${t}`] = { earnings: r.value.date, earningsEstimated: r.value.estimated };
  });

  return res.status(200).json({ stockEvents, fetchedAt: new Date().toISOString(), errors });
}
