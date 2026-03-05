// Purchase readiness projection engine
// Projects cash position forward month-by-month to determine when available
// funds meet a target purchase amount. Default: 0% growth (pure linear).

import { calcSummary, calcMonthlySavings, isLongTerm } from "./calculations.js";

/**
 * Project cash position forward month-by-month.
 *
 * Starts with current liquid position (cash + net asset value after fees/tax)
 * and adds net monthly savings each month. Optionally compounds income and
 * asset appreciation if rates > 0.
 *
 * @param {Object} state - Full app state
 * @param {Object} prices - Current price map
 * @param {number} monthsForward - How many months to project (default 60)
 * @returns {Array<{ month, date, cashPosition, assetValue, totalAvailable }>}
 */
export function projectCashPosition(state, prices, monthsForward = 60) {
  const readiness = state.readiness || {};
  const incomeGrowthRate = readiness.incomeGrowthRate || 0;
  const assetAppreciationRate = readiness.assetAppreciationRate || 0;

  const monthly = calcMonthlySavings(state.cashFlow);
  const baseSavings = monthly.monthlySavings;

  // Current snapshot: cash + net liquidation value at current sell date
  const summary = calcSummary(state, prices);
  const currentCash = summary.cashTotal;
  const currentNetProceeds = Math.max(0, summary.totalNetProceeds - summary.tax);
  const now = new Date();
  const projections = [];
  let cumulativeSavings = 0;
  let assetMultiplier = 1;

  for (let m = 0; m <= monthsForward; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const dateStr = date.toISOString().slice(0, 7); // YYYY-MM

    // Income growth compounds monthly
    const savingsThisMonth = m === 0
      ? 0
      : baseSavings * Math.pow(1 + incomeGrowthRate / 100 / 12, m);
    cumulativeSavings += savingsThisMonth;

    // Asset appreciation compounds monthly
    if (m > 0 && assetAppreciationRate > 0) {
      assetMultiplier *= (1 + assetAppreciationRate / 100 / 12);
    }

    // Recalculate LT/ST at the projected date to capture tax savings
    const futureDate = date.toISOString().slice(0, 10);
    const futureState = { ...state, sellDate: futureDate };
    const futureSummary = calcSummary(futureState, prices);
    const futureNetProceeds = Math.max(0, futureSummary.totalNetProceeds - futureSummary.tax);
    const futureRetirement = futureSummary.retirement.net;

    const assetValue = (futureNetProceeds + futureRetirement) * assetMultiplier;
    const cashPosition = currentCash + cumulativeSavings;
    const totalAvailable = cashPosition + assetValue;

    projections.push({
      month: m,
      date: dateStr,
      cashPosition: Math.round(cashPosition * 100) / 100,
      assetValue: Math.round(assetValue * 100) / 100,
      totalAvailable: Math.round(totalAvailable * 100) / 100,
      taxSavingsFromLT: m === 0 ? 0 : Math.round((futureNetProceeds - currentNetProceeds) * 100) / 100,
    });
  }

  return projections;
}

/**
 * Find the first month where totalAvailable >= targetCashNeeded.
 * Returns { month, date } or null if never reached within the projection.
 */
export function calcReadinessDate(projections, targetCashNeeded) {
  if (!targetCashNeeded || targetCashNeeded <= 0) return { month: 0, date: projections[0]?.date };
  for (const p of projections) {
    if (p.totalAvailable >= targetCashNeeded) {
      return { month: p.month, date: p.date };
    }
  }
  return null; // not reachable within projection horizon
}

/**
 * For each short-term asset, calculate the date it becomes long-term and
 * the dollar savings from waiting (difference in tax at LT vs ST rate).
 *
 * @param {Array} assets - state.assets
 * @param {Object} prices - current price map
 * @param {Object} taxConfig - state.taxConfig
 * @returns {Array<{ name, symbol, acquisitionDate, ltDate, daysUntilLT, gainLoss, stTax, ltTax, savings }>}
 */
export function calcSTtoLTSavings(assets, prices, taxConfig) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const results = [];

  for (const asset of (assets || [])) {
    if (!asset.acquisitionDate) continue;

    // Check if currently short-term
    if (isLongTerm(asset.acquisitionDate, today)) continue;

    const acq = new Date(asset.acquisitionDate + "T12:00:00");
    const ltDate = new Date(acq.getTime() + 365.25 * 864e5 + 864e5); // +1 day past 1 year
    const daysUntilLT = Math.max(0, Math.ceil((ltDate.getTime() - today.getTime()) / 864e5));

    const price = asset.priceKey ? (prices[asset.priceKey] || 0) : 0;
    const gross = asset.priceKey === null ? asset.costBasis : asset.quantity * price;
    const gainLoss = gross - asset.costBasis;

    // Only relevant if there's a gain (losses don't benefit from LT rate)
    if (gainLoss <= 0) continue;

    // Estimate tax difference using effective rates from taxConfig
    let stRate, ltRate;
    if (taxConfig.taxMode === "progressive") {
      // Use approximate marginal rates — exact would need full bracket recalc
      // For the purpose of this estimate, use the standard rates for the income level
      stRate = 0.24 + 0.038; // ordinary income marginal + NIIT
      ltRate = 0.15 + 0.038; // LTCG + NIIT
    } else {
      stRate = (taxConfig.stcgRate || 0.24) + (taxConfig.niitApplies ? (taxConfig.niitRate || 0.038) : 0);
      ltRate = (taxConfig.ltcgRate || 0.15) + (taxConfig.niitApplies ? (taxConfig.niitRate || 0.038) : 0);
    }

    const stTax = gainLoss * stRate;
    const ltTax = gainLoss * ltRate;
    const savings = stTax - ltTax;

    results.push({
      name: asset.name,
      symbol: asset.symbol,
      acquisitionDate: asset.acquisitionDate,
      ltDate: ltDate.toISOString().slice(0, 10),
      daysUntilLT,
      gainLoss: Math.round(gainLoss * 100) / 100,
      stTax: Math.round(stTax * 100) / 100,
      ltTax: Math.round(ltTax * 100) / 100,
      savings: Math.round(savings * 100) / 100,
    });
  }

  // Sort by LT date (soonest first)
  results.sort((a, b) => a.daysUntilLT - b.daysUntilLT);
  return results;
}
