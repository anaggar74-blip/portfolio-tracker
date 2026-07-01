// Upcoming stock events (next earnings date) for US holdings.
// Primary source: Yahoo Finance quoteSummary (needs a cookie + crumb).
// Fallback:       Nasdaq analyst earnings-date endpoint (keyless).
// Both are hit server-side from Vercel, whose datacenter IP Yahoo sometimes walls with
// a consent page — the fc.yahoo.com cookie avoids that, and Nasdaq covers the rest.
// POST body: { stocks: ["AAPL","MSFT"] }
// Returns: { stockEvents: { "us:AAPL": { earnings, earningsEstimated } }, fetchedAt, errors }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Cache cookie + crumb across warm invocations.
let session = { cookie: "", crumb: "", at: 0 };

function joinCookies(setCookie) {
  if (!setCookie) return "";
  return setCookie
    .split(/,(?=[^ ;,]+=)/)
    .map(c => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function ensureSession(force = false) {
  if (session.crumb && Date.now() - session.at < 30 * 60 * 1000 && !force) return session;
  // fc.yahoo.com hands out an A1 cookie without the consent wall that finance.yahoo.com shows to datacenter IPs.
  const r1 = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA } });
  const cookie = joinCookies(r1.headers.get("set-cookie"));
  const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  const crumb = (await r2.text()).trim();
  if (!cookie || !crumb || crumb.includes("<")) throw new Error(`session failed (crumb ${r2.status})`);
  session = { cookie, crumb, at: Date.now() };
  return session;
}

// Yahoo earnings dates are unix seconds; 2 entries = an unconfirmed range.
function pickYahoo(ce) {
  const arr = ce?.earnings?.earningsDate;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const secs = arr.map(x => x?.raw).filter(n => typeof n === "number").sort((a, b) => a - b);
  if (secs.length === 0) return null;
  return { date: new Date(secs[0] * 1000).toISOString().slice(0, 10), estimated: secs.length > 1 };
}

async function fromYahoo(ticker) {
  const s = await ensureSession();
  const call = c =>
    fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents&crumb=${encodeURIComponent(c.crumb)}`,
      { headers: { "User-Agent": UA, Cookie: c.cookie } });
  let res = await call(s);
  if (res.status === 401) res = await call(await ensureSession(true)); // stale crumb → refresh once
  const json = await res.json();
  const ce = json?.quoteSummary?.result?.[0]?.calendarEvents;
  if (!ce) throw new Error(`YF ${res.status}`);
  return pickYahoo(ce);
}

async function fromNasdaq(ticker) {
  const res = await fetch(`https://api.nasdaq.com/api/analyst/${encodeURIComponent(ticker)}/earnings-date`, {
    headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en-US" },
  });
  const json = await res.json().catch(() => null);
  const text = json?.data?.reportText || "";
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) throw new Error(`ND ${res.status}`);
  return { date: `${m[3]}-${m[1]}-${m[2]}`, estimated: /estimat/i.test(text) };
}

async function fetchEarnings(ticker) {
  try {
    const y = await fromYahoo(ticker);
    if (y) return y;
    throw new Error("YF no date");
  } catch (e1) {
    try {
      return await fromNasdaq(ticker);
    } catch (e2) {
      throw new Error(`${e1.message} / ${e2.message}`);
    }
  }
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
    else errors.push(`${t}: no earnings date`);
  });

  return res.status(200).json({ stockEvents, fetchedAt: new Date().toISOString(), errors });
}
