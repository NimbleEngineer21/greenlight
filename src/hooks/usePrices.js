import { useState, useEffect, useCallback, useMemo } from "react";
import { GEMINI_TICKERS, YAHOO_TICKERS, COINGECKO_TICKERS } from "../data/defaults.js";
import { cachePriceSnapshots, purgeOldPrices } from "../lib/db.js";

// Build a reverse lookup: "BTCUSD" → "btc" for the Gemini pricefeed response
const GEMINI_PAIR_TO_KEY = Object.fromEntries(
  Object.entries(GEMINI_TICKERS).map(([key, pair]) => [pair, key])
);

// Fetch a single stock price: Yahoo first, then Finnhub fallback.
// Finnhub requires a free API token — without one, the fallback is non-functional.
async function fetchStockPrice(symbol) {
  try {
    const r = await fetch(`/api/yahoo/v8/finance/chart/${symbol}?range=1d&interval=1d`);
    if (r.ok) {
      const data = await r.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price != null) return { price: parseFloat(price), source: "yahoo" };
    }
  } catch (err) {
    console.warn(`[GreenLight] Yahoo Finance failed for ${symbol}:`, err.message);
  }

  // Finnhub fallback — requires token query param or X-Finnhub-Token header.
  // Currently non-functional without a configured token.
  try {
    const r = await fetch(`/api/finnhub/api/v1/quote?symbol=${symbol.replace("-WT", "")}`);
    if (r.ok) {
      const data = await r.json();
      if (data?.c > 0) return { price: parseFloat(data.c), source: "finnhub" };
    }
  } catch (err) {
    console.warn(`[GreenLight] Finnhub fallback failed for ${symbol}:`, err.message);
  }

  return null;
}

export function usePrices(priceOverrides = {}) {
  const [prices, setPrices] = useState({ ...priceOverrides });
  const [lastFetch, setLastFetch] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState(null);

  const fetchPrices = useCallback(async () => {
    setFetching(true);
    setFetchErr(null);
    const newPrices = {};
    const priceSources = {};
    const failedTickers = [];

    // 1. Fetch all crypto prices from Gemini in a single batch call.
    // The pricefeed endpoint returns all pairs; we filter to only those in GEMINI_TICKERS.
    try {
      const r = await fetch("https://api.gemini.com/v1/pricefeed");
      if (r.ok) {
        const data = await r.json();
        for (const item of data) {
          const key = GEMINI_PAIR_TO_KEY[item.pair];
          if (key) {
            const parsed = parseFloat(item.price);
            if (!isNaN(parsed) && parsed > 0) {
              newPrices[key] = parsed;
              priceSources[key] = "gemini";
            }
          }
        }
      } else {
        Object.keys(GEMINI_TICKERS).forEach(k => failedTickers.push(`${k}(Gemini)`));
      }
    } catch (err) {
      console.warn("[GreenLight] Gemini pricefeed failed:", err.message);
      Object.keys(GEMINI_TICKERS).forEach(k => failedTickers.push(`${k}(Gemini)`));
    }

    // 2. Fetch non-Gemini crypto from CoinGecko (public API, no key required; rate-limited ~30 req/min)
    const geckoIds = Object.values(COINGECKO_TICKERS).join(",");
    if (geckoIds) {
      try {
        const r = await fetch(`/api/coingecko/api/v3/simple/price?ids=${geckoIds}&vs_currencies=usd`);
        if (r.ok) {
          const data = await r.json();
          for (const [key, geckoId] of Object.entries(COINGECKO_TICKERS)) {
            if (data[geckoId]?.usd != null) {
              newPrices[key] = parseFloat(data[geckoId].usd);
              priceSources[key] = "coingecko";
            } else {
              failedTickers.push(`${key}(CoinGecko)`);
            }
          }
        } else {
          Object.keys(COINGECKO_TICKERS).forEach(k => failedTickers.push(`${k}(CoinGecko)`));
        }
      } catch (err) {
        console.warn("[GreenLight] CoinGecko failed:", err.message);
        Object.keys(COINGECKO_TICKERS).forEach(k => failedTickers.push(`${k}(CoinGecko)`));
      }
    }

    // 3. Fetch stock prices (Yahoo Finance with Finnhub fallback)
    for (const [key, symbol] of Object.entries(YAHOO_TICKERS)) {
      const result = await fetchStockPrice(symbol);
      if (result) {
        newPrices[key] = result.price;
        priceSources[key] = result.source;
      } else {
        failedTickers.push(`${key}(Yahoo+Finnhub)`);
      }
    }

    setPrices(prev => ({ ...prev, ...newPrices }));
    setLastFetch(new Date());
    if (failedTickers.length > 0) {
      setFetchErr(`${failedTickers.length} unavailable: ${failedTickers.join(", ")}`);
    }
    setFetching(false);

    // Cache today's prices in IndexedDB and purge old entries
    cachePriceSnapshots(newPrices, priceSources).catch(err => {
      console.warn("[GreenLight] Failed to cache prices to IndexedDB:", err.message);
    });
    purgeOldPrices(90).catch(err => {
      console.warn("[GreenLight] Failed to purge old prices:", err.message);
    });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(fetchPrices, 0);
    const iv = setInterval(fetchPrices, 15 * 60 * 1000);
    return () => { clearTimeout(timeout); clearInterval(iv); };
  }, [fetchPrices]);

  const setPrice = useCallback((key, value) => {
    setPrices(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  }, []);

  // Overrides always take priority over fetched/manual prices
  const mergedPrices = useMemo(() => ({ ...prices, ...priceOverrides }), [prices, priceOverrides]);

  return { prices: mergedPrices, lastFetch, fetching, fetchErr, setPrice, refresh: fetchPrices };
}
