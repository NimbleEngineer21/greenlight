import Dexie from "dexie";

let db;
try {
  db = new Dexie("GreenLightDB");
  db.version(1).stores({
    priceHistory:  "++id, ticker, date, [ticker+date]",
    mortgageRates: "++id, seriesId, date, [seriesId+date]",
    lots:          "++id, assetId, acquisitionDate",
  });
} catch (err) {
  console.error("[GreenLight] IndexedDB unavailable:", err.message);
  db = null;
}

// Cache prices for all tickers at once (called after each fetch cycle).
// sources is a { ticker: "gemini"|"coingecko"|"yahoo"|"finnhub" } map.
export async function cachePriceSnapshots(prices, sources = {}) {
  if (!db) return;
  const date = new Date().toISOString().slice(0, 10);
  const entries = Object.entries(prices)
    .filter(([, price]) => price > 0)
    .map(([ticker, price]) => ({ ticker, date, price, source: sources[ticker] || "unknown" }));

  if (entries.length === 0) return;

  // Atomic upsert: delete today's existing entries then bulk add within a transaction
  const tickers = entries.map(e => e.ticker);
  await db.transaction("rw", db.priceHistory, async () => {
    await db.priceHistory.where("date").equals(date)
      .filter(item => tickers.includes(item.ticker))
      .delete();
    await db.priceHistory.bulkAdd(entries);
  });
}

// Store mortgage rate data from FRED
export async function cacheMortgageRates(seriesId, observations) {
  if (!db) return;
  const entries = observations
    .filter(obs => obs.value !== ".")
    .map(obs => ({
      seriesId,
      date: obs.date,
      value: parseFloat(obs.value),
    }));

  if (entries.length === 0) return;

  // Delete existing entries for this series, then bulk add
  await db.transaction("rw", db.mortgageRates, async () => {
    await db.mortgageRates.where("seriesId").equals(seriesId).delete();
    await db.mortgageRates.bulkAdd(entries);
  });
}

// Get mortgage rates for a series
export async function getMortgageRates(seriesId) {
  if (!db) return [];
  return db.mortgageRates
    .where("seriesId")
    .equals(seriesId)
    .sortBy("date");
}

// Purge price history older than N days.
// Works because YYYY-MM-DD strings sort lexicographically in date order.
export async function purgeOldPrices(daysToKeep = 90) {
  if (!db) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  await db.priceHistory.where("date").below(cutoffStr).delete();
}

// Export all IndexedDB tables as plain arrays for backup
export async function exportIndexedDB() {
  if (!db) return null;
  const [priceHistory, mortgageRates, lots] = await Promise.all([
    db.priceHistory.toArray(),
    db.mortgageRates.toArray(),
    db.lots.toArray(),
  ]);
  // Strip auto-increment ids — they'll be regenerated on import
  const strip = (arr) => arr.map(row => { const { ...copy } = row; delete copy.id; return copy; });
  return {
    priceHistory: strip(priceHistory),
    mortgageRates: strip(mortgageRates),
    lots: strip(lots),
  };
}

// Import IndexedDB tables from a backup, replacing existing data
export async function importIndexedDB(data) {
  if (!db || !data) return;
  await db.transaction("rw", db.priceHistory, db.mortgageRates, db.lots, async () => {
    if (Array.isArray(data.priceHistory)) {
      await db.priceHistory.clear();
      await db.priceHistory.bulkAdd(data.priceHistory);
    }
    if (Array.isArray(data.mortgageRates)) {
      await db.mortgageRates.clear();
      await db.mortgageRates.bulkAdd(data.mortgageRates);
    }
    if (Array.isArray(data.lots)) {
      await db.lots.clear();
      await db.lots.bulkAdd(data.lots);
    }
  });
}

export { db };
