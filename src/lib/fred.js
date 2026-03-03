import { cacheMortgageRates, getMortgageRates } from "./db.js";

const FRED_SERIES_IDS = ["MORTGAGE30US", "MORTGAGE15US"];

// Fetch mortgage rate series from FRED API (proxied).
// Free API key required — passed as param by caller.
// NOTE: The API key is included in the URL query string (FRED API limitation).
// It will be visible in browser devtools and nginx access logs.
async function fetchFredSeries(seriesId, apiKey) {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const startDate = twoYearsAgo.toISOString().slice(0, 10);

  const url = `/api/fred/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startDate}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FRED ${seriesId}: ${r.status}`);
  const data = await r.json();
  return (data.observations || []).map(obs => ({
    date: obs.date,
    value: obs.value,
  }));
}

// Fetch and cache both 30yr and 15yr mortgage rates
export async function refreshMortgageRates(apiKey) {
  if (!apiKey) return { error: "No FRED API key configured" };

  const results = {};
  for (const seriesId of FRED_SERIES_IDS) {
    try {
      const observations = await fetchFredSeries(seriesId, apiKey);
      await cacheMortgageRates(seriesId, observations);
      results[seriesId] = observations.length;
    } catch (err) {
      results[seriesId] = { error: err.message };
    }
  }
  return results;
}

// Get cached rates (no API call — reads from IndexedDB)
export async function getCachedMortgageRates(seriesId = "MORTGAGE30US") {
  return getMortgageRates(seriesId);
}

export { FRED_SERIES_IDS };
