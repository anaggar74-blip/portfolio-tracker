// Sync stock earnings + macro market events into a Google Calendar named "Stocks",
// with a 2-day-before popup reminder. Idempotent: each event has a deterministic
// iCalUID, so re-running updates in place instead of duplicating.
//
// POST body (from the app): { stockEvents: { "us:AAPL": { earnings, earningsEstimated } } }
// Cron (no body): syncs macro events only (no holdings context server-side).
//
// Requires server-side env vars (NOT VITE_):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//   GOOGLE_CALENDAR_ID (optional; otherwise the "Stocks" calendar is found/created by name)

import { MACRO_EVENTS } from "../macro-events.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

const GCAL = "https://www.googleapis.com/calendar/v3";
const REMINDER_MIN = 2 * 24 * 60; // 2 days

function nextDay(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const todayISO = () => new Date().toISOString().slice(0, 10);

async function getAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Missing Google env vars (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`token refresh failed: ${json.error || res.status} ${json.error_description || ""}`);
  return json.access_token;
}

async function resolveCalendarId(token) {
  if (process.env.GOOGLE_CALENDAR_ID) return process.env.GOOGLE_CALENDAR_ID;
  const auth = { Authorization: `Bearer ${token}` };
  const list = await (await fetch(`${GCAL}/users/me/calendarList`, { headers: auth })).json();
  const found = (list.items || []).find(c => c.summary === "Stocks");
  if (found) return found.id;
  const created = await (await fetch(`${GCAL}/calendars`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: "Stocks", timeZone: "America/New_York" }),
  })).json();
  if (!created.id) throw new Error("could not create 'Stocks' calendar");
  return created.id;
}

// Build the event list (future-dated only).
function buildEvents(stockEvents) {
  const today = todayISO();
  const out = [];
  MACRO_EVENTS.forEach(e => {
    if (e.date < today) return;
    out.push({
      uid: `macro-${e.type}-${e.date.replace(/-/g, "")}@ptracker`,
      summary: e.title,
      date: e.date,
      description: `US macro event · impact ${e.impact}/5`,
    });
  });
  Object.entries(stockEvents || {}).forEach(([key, v]) => {
    if (!v?.earnings || v.earnings < today) return;
    const ticker = key.split(":")[1];
    out.push({
      uid: `earnings-${ticker}-${v.earnings.replace(/-/g, "")}@ptracker`,
      summary: `${ticker} Earnings${v.earningsEstimated ? " (est)" : ""}`,
      date: v.earnings,
      description: `${ticker} next earnings report${v.earningsEstimated ? " (estimated date)" : ""}`,
    });
  });
  return out;
}

async function importEvent(token, calId, ev) {
  const body = {
    iCalUID: ev.uid,
    summary: ev.summary,
    description: ev.description,
    start: { date: ev.date },
    end: { date: nextDay(ev.date) },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: REMINDER_MIN }] },
    transparency: "transparent",
  };
  const res = await fetch(`${GCAL}/calendars/${encodeURIComponent(calId)}/events/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${ev.uid}: ${res.status} ${t.slice(0, 120)}`);
  }
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(204).end();

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const stockEvents = body?.stockEvents || {};

  try {
    const token = await getAccessToken();
    const calId = await resolveCalendarId(token);
    const events = buildEvents(stockEvents);

    let synced = 0;
    const errors = [];
    // Serialize to stay well within Google rate limits.
    for (const ev of events) {
      try { await importEvent(token, calId, ev); synced++; }
      catch (e) { errors.push(e.message); }
    }
    return res.status(200).json({ calendarId: calId, total: events.length, synced, errors, at: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message || "sync failed" });
  }
}
