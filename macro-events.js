// US macro market events, curated from official 2026 calendars:
//   Federal Reserve FOMC (rate decision / Powell press conference / dot plot),
//   BLS CPI + Employment Situation (NFP), BEA Personal Income & Outlays (Core PCE).
// Forward-looking; the calendar sync skips past dates. Regenerate ~yearly.
// Dates are the US release day (ET). GDP-advance, ISM Manufacturing PMI and Retail Sales
// are not yet included — append when their official 2026 dates are confirmed.

export const MACRO_EVENTS = [
  { type: "FOMC", title: "FOMC Rate Decision", date: "2026-01-28", impact: 5 },
  { type: "FOMC", title: "FOMC Rate Decision", date: "2026-03-18", impact: 5 },
  { type: "FOMC", title: "FOMC Rate Decision", date: "2026-04-29", impact: 5 },
  { type: "FOMC", title: "FOMC Rate Decision", date: "2026-06-17", impact: 5 },
  { type: "FOMC", title: "FOMC Rate Decision", date: "2026-07-29", impact: 5 },
  { type: "FOMC", title: "FOMC Rate Decision", date: "2026-09-16", impact: 5 },
  { type: "FOMC", title: "FOMC Rate Decision", date: "2026-10-28", impact: 5 },
  { type: "FOMC", title: "FOMC Rate Decision", date: "2026-12-09", impact: 5 },

  { type: "FOMC_PRESSER", title: "Fed Chair Press Conference (Powell)", date: "2026-01-28", impact: 5 },
  { type: "FOMC_PRESSER", title: "Fed Chair Press Conference (Powell)", date: "2026-03-18", impact: 5 },
  { type: "FOMC_PRESSER", title: "Fed Chair Press Conference (Powell)", date: "2026-04-29", impact: 5 },
  { type: "FOMC_PRESSER", title: "Fed Chair Press Conference (Powell)", date: "2026-06-17", impact: 5 },
  { type: "FOMC_PRESSER", title: "Fed Chair Press Conference (Powell)", date: "2026-07-29", impact: 5 },
  { type: "FOMC_PRESSER", title: "Fed Chair Press Conference (Powell)", date: "2026-09-16", impact: 5 },
  { type: "FOMC_PRESSER", title: "Fed Chair Press Conference (Powell)", date: "2026-10-28", impact: 5 },
  { type: "FOMC_PRESSER", title: "Fed Chair Press Conference (Powell)", date: "2026-12-09", impact: 5 },

  { type: "SEP", title: "Summary of Economic Projections (Dot Plot)", date: "2026-03-18", impact: 5 },
  { type: "SEP", title: "Summary of Economic Projections (Dot Plot)", date: "2026-06-17", impact: 5 },
  { type: "SEP", title: "Summary of Economic Projections (Dot Plot)", date: "2026-09-16", impact: 5 },
  { type: "SEP", title: "Summary of Economic Projections (Dot Plot)", date: "2026-12-09", impact: 5 },

  { type: "CPI", title: "CPI Inflation Report", date: "2026-01-13", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-02-13", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-03-11", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-04-10", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-05-12", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-06-10", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-07-14", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-08-12", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-09-11", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-10-14", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-11-10", impact: 5 },
  { type: "CPI", title: "CPI Inflation Report", date: "2026-12-10", impact: 5 },

  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-01-09", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-02-11", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-03-06", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-04-03", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-05-08", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-06-05", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-07-02", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-08-07", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-09-04", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-10-02", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-11-06", impact: 5 },
  { type: "NFP", title: "Non-Farm Payrolls (Jobs Report)", date: "2026-12-04", impact: 5 },

  { type: "PCE", title: "Core PCE Inflation (Personal Income & Outlays)", date: "2026-08-04", impact: 4 },
  { type: "PCE", title: "Core PCE Inflation (Personal Income & Outlays)", date: "2026-09-03", impact: 4 },
  { type: "PCE", title: "Core PCE Inflation (Personal Income & Outlays)", date: "2026-10-06", impact: 4 },
  { type: "PCE", title: "Core PCE Inflation (Personal Income & Outlays)", date: "2026-11-04", impact: 4 },
  { type: "PCE", title: "Core PCE Inflation (Personal Income & Outlays)", date: "2026-12-02", impact: 4 },
];
