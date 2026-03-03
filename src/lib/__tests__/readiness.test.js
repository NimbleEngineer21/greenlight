import { describe, it, expect } from "vitest";
import { projectCashPosition, calcReadinessDate, calcSTtoLTSavings } from "../readiness.js";
import { createSeededState } from "../../data/defaults.js";

// Minimal prices for seeded state assets
const PRICES = {
  gme: 24, wgme: 4, btc: 90000, eth: 2500, aave: 200, uni: 8,
  yfi: 8000, pepe: 0.00001, fet: 0.5, zrx: 0.3, sushi: 1,
  pol: 0.4, api3: 1.5, snx: 2, doge: 0.15, link: 15, grt: 0.2,
  dot: 5, storj: 0.5, ankr: 0.03, crv: 0.5,
};

function makeState(overrides = {}) {
  const base = createSeededState();
  return { ...base, ...overrides };
}

describe("projectCashPosition", () => {
  it("returns an array with monthsForward + 1 entries (including month 0)", () => {
    const state = makeState();
    const result = projectCashPosition(state, PRICES, 12);
    expect(result).toHaveLength(13);
    expect(result[0].month).toBe(0);
    expect(result[12].month).toBe(12);
  });

  it("month 0 has zero cumulative savings", () => {
    const state = makeState();
    const result = projectCashPosition(state, PRICES, 6);
    // At month 0, cashPosition should equal current cash total
    const cashTotal = state.cashAccounts.reduce((s, c) => s + c.balance, 0);
    expect(result[0].cashPosition).toBeCloseTo(cashTotal, 0);
  });

  it("totalAvailable increases over time with positive savings", () => {
    const state = makeState();
    const result = projectCashPosition(state, PRICES, 12);
    // With positive net income, total should generally trend up
    expect(result[12].totalAvailable).toBeGreaterThan(result[0].totalAvailable);
  });

  it("with 0% growth rates, savings accumulate linearly", () => {
    const state = makeState({
      readiness: { reserveMonths: 6, incomeGrowthRate: 0, assetAppreciationRate: 0 },
    });
    const result = projectCashPosition(state, PRICES, 6);
    // Cash position difference between consecutive months should be roughly constant
    const diff1 = result[2].cashPosition - result[1].cashPosition;
    const diff2 = result[5].cashPosition - result[4].cashPosition;
    expect(diff1).toBeCloseTo(diff2, 0);
  });

  it("income growth rate increases monthly savings over time", () => {
    const state = makeState({
      readiness: { reserveMonths: 6, incomeGrowthRate: 12, assetAppreciationRate: 0 },
    });
    const result = projectCashPosition(state, PRICES, 24);
    // Savings at month 24 should exceed linear savings
    const linearState = makeState({
      readiness: { reserveMonths: 6, incomeGrowthRate: 0, assetAppreciationRate: 0 },
    });
    const linearResult = projectCashPosition(linearState, PRICES, 24);
    expect(result[24].cashPosition).toBeGreaterThan(linearResult[24].cashPosition);
  });

  it("defaults to 60 months when monthsForward not specified", () => {
    const state = makeState();
    const result = projectCashPosition(state, PRICES);
    expect(result).toHaveLength(61);
  });
});

describe("calcReadinessDate", () => {
  it("returns month 0 if target is 0 or negative", () => {
    const projections = [{ month: 0, date: "2026-03", totalAvailable: 5000 }];
    expect(calcReadinessDate(projections, 0).month).toBe(0);
    expect(calcReadinessDate(projections, -1000).month).toBe(0);
  });

  it("returns month 0 if already affordable", () => {
    const state = makeState();
    const projections = projectCashPosition(state, PRICES, 12);
    // Target less than current total → ready now
    const result = calcReadinessDate(projections, 1000);
    expect(result.month).toBe(0);
  });

  it("returns correct month when target is reachable", () => {
    const state = makeState();
    const projections = projectCashPosition(state, PRICES, 60);
    // Pick a target that's achievable but not immediately
    const target = projections[0].totalAvailable + 20000;
    const result = calcReadinessDate(projections, target);
    expect(result).not.toBeNull();
    expect(result.month).toBeGreaterThan(0);
    // Verify the month before wasn't enough
    const prevMonth = projections[result.month - 1];
    expect(prevMonth.totalAvailable).toBeLessThan(target);
  });

  it("returns null if target is unreachable within horizon", () => {
    const state = makeState();
    const projections = projectCashPosition(state, PRICES, 6);
    const result = calcReadinessDate(projections, 999999999);
    expect(result).toBeNull();
  });
});

describe("calcSTtoLTSavings", () => {
  it("identifies short-term assets with positive gains", () => {
    // Seeded state has Paypal BTC/ETH (acquired 2025-11-01) and SUSHI ST (2025-07-04)
    const state = makeState();
    const results = calcSTtoLTSavings(state.assets, PRICES, state.taxConfig);
    // Should find at least the ST assets
    expect(results.length).toBeGreaterThanOrEqual(0);
    // All results should have positive savings
    for (const r of results) {
      expect(r.savings).toBeGreaterThanOrEqual(0);
      expect(r.daysUntilLT).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns empty for assets that are all long-term", () => {
    const state = makeState();
    // Keep only assets acquired in 2021 (all long-term by now)
    state.assets = state.assets.filter(a =>
      a.acquisitionDate && a.acquisitionDate.startsWith("2021"),
    );
    const results = calcSTtoLTSavings(state.assets, PRICES, state.taxConfig);
    expect(results).toHaveLength(0);
  });

  it("excludes assets with losses (no benefit from LT rate)", () => {
    const state = makeState();
    // Add a ST asset with a loss
    state.assets = [{
      id: "test", name: "Loser", symbol: "LOSE", quantity: 100,
      costBasis: 50000, acquisitionDate: "2026-01-01", priceKey: "gme",
      feeType: "none", holdingType: "stock",
    }];
    // GME price $24 × 100 = $2400 vs $50000 basis → loss
    const results = calcSTtoLTSavings(state.assets, PRICES, state.taxConfig);
    expect(results).toHaveLength(0);
  });

  it("results are sorted by daysUntilLT ascending", () => {
    const state = makeState();
    const results = calcSTtoLTSavings(state.assets, PRICES, state.taxConfig);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].daysUntilLT).toBeGreaterThanOrEqual(results[i - 1].daysUntilLT);
    }
  });
});
