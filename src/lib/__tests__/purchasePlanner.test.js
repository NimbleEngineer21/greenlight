import { describe, it, expect } from "vitest";
import {
  calcHomeCosts,
  calcCarCosts,
  calcDownPayment,
  calcTotalCashNeeded,
  calcLiquidationAnalysis,
  calcPurchaseReadinessStatus,
} from "../purchasePlanner.js";
import { HOME_CLOSING_DEFAULTS } from "../../data/closingCosts.js";
import { CAR_PURCHASE_DEFAULTS } from "../../data/carCosts.js";

describe("calcHomeCosts", () => {
  it("returns correct number of items", () => {
    const result = calcHomeCosts(350000);
    expect(result.items).toHaveLength(HOME_CLOSING_DEFAULTS.length);
  });

  it("computes percentage-based items from home price", () => {
    const result = calcHomeCosts(400000);
    const titleIns = result.items.find(i => i.key === "titleInsurance");
    // 0.5% of $400k = $2,000
    expect(titleIns.amount).toBeCloseTo(2000, 0);
    expect(titleIns.isPercent).toBe(true);
  });

  it("uses flat defaults for non-percentage items", () => {
    const result = calcHomeCosts(350000);
    const appraisal = result.items.find(i => i.key === "appraisal");
    expect(appraisal.amount).toBe(500);
    expect(appraisal.isPercent).toBeFalsy();
  });

  it("applies overrides", () => {
    const result = calcHomeCosts(350000, { appraisal: 700 });
    const appraisal = result.items.find(i => i.key === "appraisal");
    expect(appraisal.amount).toBe(700);
    expect(appraisal.isOverridden).toBe(true);
  });

  it("marks items as paid", () => {
    const result = calcHomeCosts(350000, {}, { appraisal: true, inspection: true });
    const appraisal = result.items.find(i => i.key === "appraisal");
    const inspection = result.items.find(i => i.key === "inspection");
    expect(appraisal.isPaid).toBe(true);
    expect(inspection.isPaid).toBe(true);
  });

  it("excludes paid items from unpaidTotal", () => {
    const allUnpaid = calcHomeCosts(350000);
    const withPaid = calcHomeCosts(350000, {}, { appraisal: true });
    expect(withPaid.unpaidTotal).toBe(allUnpaid.subtotal - 500);
    expect(withPaid.paidTotal).toBe(500);
    expect(withPaid.subtotal).toBe(allUnpaid.subtotal);
  });

  it("subtotal is sum of all items regardless of paid status", () => {
    const result = calcHomeCosts(350000, {}, { appraisal: true });
    const sum = result.items.reduce((s, i) => s + i.amount, 0);
    expect(result.subtotal).toBeCloseTo(sum, 2);
  });

  it("produces reasonable subtotal for typical home price", () => {
    const result = calcHomeCosts(350000);
    // Closing costs typically 2-5% of home price
    expect(result.subtotal).toBeGreaterThan(5000);
    expect(result.subtotal).toBeLessThan(25000);
  });
});

describe("calcCarCosts", () => {
  it("returns correct number of items", () => {
    const result = calcCarCosts(35000);
    expect(result.items).toHaveLength(CAR_PURCHASE_DEFAULTS.length);
  });

  it("computes sales tax from car price", () => {
    const result = calcCarCosts(35000);
    const tax = result.items.find(i => i.key === "salesTax");
    // 7% of $35k = $2,450
    expect(tax.amount).toBeCloseTo(2450, 0);
  });

  it("applies overrides", () => {
    const result = calcCarCosts(35000, { docFee: 300 });
    const doc = result.items.find(i => i.key === "docFee");
    expect(doc.amount).toBe(300);
    expect(doc.isOverridden).toBe(true);
  });

  it("respects paid flags", () => {
    const result = calcCarCosts(35000, {}, { titleReg: true });
    expect(result.paidTotal).toBe(400);
    expect(result.unpaidTotal).toBe(result.subtotal - 400);
  });
});

describe("calcDownPayment", () => {
  it("computes from percent", () => {
    const result = calcDownPayment(350000, 20);
    expect(result.amount).toBe(70000);
    expect(result.percent).toBe(20);
    expect(result.isOverridden).toBe(false);
  });

  it("uses flat override when provided", () => {
    const result = calcDownPayment(350000, 20, 50000);
    expect(result.amount).toBe(50000);
    expect(result.percent).toBeCloseTo(14.29, 1);
    expect(result.isOverridden).toBe(true);
  });

  it("ignores null override", () => {
    const result = calcDownPayment(350000, 20, null);
    expect(result.amount).toBe(70000);
    expect(result.isOverridden).toBe(false);
  });

  it("ignores zero override", () => {
    const result = calcDownPayment(350000, 20, 0);
    expect(result.amount).toBe(70000);
    expect(result.isOverridden).toBe(false);
  });
});

describe("calcTotalCashNeeded", () => {
  it("sums all components", () => {
    const result = calcTotalCashNeeded(70000, 12000, 5600);
    expect(result.total).toBe(87600);
    expect(result.downPayment).toBe(70000);
    expect(result.closingCosts).toBe(12000);
    expect(result.pointsCost).toBe(5600);
  });

  it("defaults pointsCost to 0", () => {
    const result = calcTotalCashNeeded(70000, 12000);
    expect(result.total).toBe(82000);
    expect(result.pointsCost).toBe(0);
  });
});

describe("calcLiquidationAnalysis", () => {
  const makeSummary = (cashTotal, netProceeds, tax, retNet, cfNet) => ({
    cashTotal,
    totalNetProceeds: netProceeds,
    tax,
    retirement: { net: retNet },
    cashFlow: { net: cfNet },
  });

  it("returns isCovered=true when surplus", () => {
    const summary = makeSummary(20000, 80000, 5000, 10000, 5000);
    // Available: 20k + (80k - 5k) + 10k + 5k = 110k
    const result = calcLiquidationAnalysis(90000, summary);
    expect(result.isCovered).toBe(true);
    expect(result.surplus).toBe(20000);
    expect(result.shortfall).toBe(0);
  });

  it("returns isCovered=false when shortfall", () => {
    const summary = makeSummary(5000, 20000, 3000, 0, 2000);
    // Available: 5k + (20k - 3k) + 0 + 2k = 24k
    const result = calcLiquidationAnalysis(50000, summary);
    expect(result.isCovered).toBe(false);
    expect(result.shortfall).toBe(26000);
    expect(result.surplus).toBe(0);
  });

  it("breakdown components add up to totalAvailable", () => {
    const summary = makeSummary(15000, 60000, 8000, 5000, 3000);
    const result = calcLiquidationAnalysis(50000, summary);
    const sum = result.cashContribution + result.assetContribution +
                result.retirementContribution + result.cashFlowContribution;
    expect(sum).toBeCloseTo(result.totalAvailable, 2);
  });

  it("handles zero values gracefully", () => {
    const summary = makeSummary(0, 0, 0, 0, 0);
    const result = calcLiquidationAnalysis(10000, summary);
    expect(result.isCovered).toBe(false);
    expect(result.totalAvailable).toBe(0);
    expect(result.shortfall).toBe(10000);
  });

  it("handles sparse summary without NaN propagation", () => {
    // Simulate summary with missing nested properties
    const sparse = { cashTotal: 5000 };
    const result = calcLiquidationAnalysis(10000, sparse);
    expect(result.isCovered).toBe(false);
    expect(result.totalAvailable).toBe(5000);
    expect(Number.isNaN(result.totalAvailable)).toBe(false);
    expect(Number.isNaN(result.shortfall)).toBe(false);
    expect(result.cashContribution).toBe(5000);
    expect(result.assetContribution).toBe(0);
    expect(result.retirementContribution).toBe(0);
    expect(result.cashFlowContribution).toBe(0);
  });
});

describe("calcPurchaseReadinessStatus", () => {
  // Home: cashNeeded.total = 82k, homePrice = 350k
  // emergencyBuffer = max(350k × 10%, 6 × 3000) = max(35k, 18k) = 35k
  // greenThreshold = 82k + 35k = 117k, yellowThreshold = 82k
  const homePurchase = { category: "home", homePrice: 350000, carPrice: 0, carMaintenanceAnnual: null };
  const readiness = { reserveMonths: 6 };
  const cashNeeded = { total: 82000 };
  const monthlyExpenses = 3000;
  const liq = (n) => ({ totalAvailable: n });

  it("home: returns green when totalAvailable >= greenThreshold", () => {
    const result = calcPurchaseReadinessStatus(homePurchase, readiness, {
      cashNeeded, liquidation: liq(120000), monthlyExpenses, projections: null,
    });
    expect(result.status).toBe("green");
    expect(result.badgeLabel).toBe("READY");
    expect(result.progress).toBe(1);
  });

  it("home: returns yellow when >= yellowThreshold but < greenThreshold", () => {
    const result = calcPurchaseReadinessStatus(homePurchase, readiness, {
      cashNeeded, liquidation: liq(90000), monthlyExpenses, projections: null,
    });
    expect(result.status).toBe("yellow");
    expect(result.badgeLabel).toBe("ALMOST");
  });

  it("home: returns red when < yellowThreshold", () => {
    const result = calcPurchaseReadinessStatus(homePurchase, readiness, {
      cashNeeded, liquidation: liq(70000), monthlyExpenses, projections: null,
    });
    expect(result.status).toBe("red");
  });

  it("home: emergency buffer uses max(10% of price, reserveMonths × expenses)", () => {
    // 350k × 10% = 35k; 6 × 3k = 18k → max = 35k
    const result = calcPurchaseReadinessStatus(homePurchase, readiness, {
      cashNeeded, liquidation: liq(0), monthlyExpenses, projections: null,
    });
    expect(result.greenThreshold).toBe(117000);
    expect(result.yellowThreshold).toBe(82000);
  });

  it("home: emergency buffer uses reserveMonths × expenses when larger", () => {
    // cheapHome 100k → 10% = 10k; 6 × 3k = 18k → max = 18k
    const cheapHome = { ...homePurchase, homePrice: 100000 };
    const result = calcPurchaseReadinessStatus(cheapHome, readiness, {
      cashNeeded, liquidation: liq(0), monthlyExpenses, projections: null,
    });
    expect(result.greenThreshold).toBe(100000); // 82k + 18k
  });

  it("vehicle: green/yellow/red with derived annualMaintenance", () => {
    // carPrice 40k → maintenance = 40k × 0.015 = 600
    // greenThreshold = 10k + 600 = 10600
    const veh = { category: "vehicle", homePrice: 0, carPrice: 40000, carMaintenanceAnnual: null };
    const result = calcPurchaseReadinessStatus(veh, readiness, {
      cashNeeded: { total: 10000 }, liquidation: liq(10700), monthlyExpenses, projections: null,
    });
    expect(result.status).toBe("green");
    expect(result.greenThreshold).toBeCloseTo(10600, 0);
  });

  it("vehicle: carMaintenanceAnnual override takes precedence over derived", () => {
    // override = 1200 → greenThreshold = 10k + 1200 = 11200
    const veh = { category: "vehicle", homePrice: 0, carPrice: 40000, carMaintenanceAnnual: 1200 };
    const result = calcPurchaseReadinessStatus(veh, readiness, {
      cashNeeded: { total: 10000 }, liquidation: liq(11300), monthlyExpenses, projections: null,
    });
    expect(result.greenThreshold).toBe(11200);
    expect(result.status).toBe("green");
  });

  it("returns null when category is null", () => {
    expect(calcPurchaseReadinessStatus(
      { ...homePurchase, category: null }, readiness,
      { cashNeeded, liquidation: liq(100000), monthlyExpenses, projections: null },
    )).toBeNull();
  });

  it("returns null when homePrice is 0", () => {
    expect(calcPurchaseReadinessStatus(
      { ...homePurchase, homePrice: 0 }, readiness,
      { cashNeeded, liquidation: liq(100000), monthlyExpenses, projections: null },
    )).toBeNull();
  });

  it("returns green immediately when greenThreshold <= 0", () => {
    // Contrived: cashNeeded.total negative makes greenThreshold ≤ 0
    const result = calcPurchaseReadinessStatus(homePurchase, readiness, {
      cashNeeded: { total: -500000 }, liquidation: liq(0), monthlyExpenses: 0, projections: null,
    });
    expect(result.status).toBe("green");
    expect(result.progress).toBe(1);
    expect(result.badgeLabel).toBe("READY");
  });

  it("progress is capped at 1.0 when over-funded", () => {
    const result = calcPurchaseReadinessStatus(homePurchase, readiness, {
      cashNeeded, liquidation: liq(500000), monthlyExpenses, projections: null,
    });
    expect(result.progress).toBe(1);
  });

  it("badge shows ~N MOS AWAY when projections reach greenThreshold", () => {
    // greenThreshold = 117k; starts at 80k (red), grows 15k/month — hits 117k at month 3
    const projections = Array.from({ length: 61 }, (_, i) => ({
      month: i, totalAvailable: 80000 + i * 15000,
    }));
    const result = calcPurchaseReadinessStatus(homePurchase, readiness, {
      cashNeeded, liquidation: liq(80000), monthlyExpenses, projections,
    });
    expect(result.status).toBe("red");
    expect(result.badgeLabel).toBe("~3 MOS AWAY");
  });

  it("badge shows SHORTFALL -$Xk when projections never reach greenThreshold", () => {
    // Always 50k — shortfall = 50k - 117k = -67k
    const projections = Array.from({ length: 61 }, (_, i) => ({
      month: i, totalAvailable: 50000,
    }));
    const result = calcPurchaseReadinessStatus(homePurchase, readiness, {
      cashNeeded, liquidation: liq(50000), monthlyExpenses, projections,
    });
    expect(result.status).toBe("red");
    expect(result.badgeLabel).toBe("SHORTFALL -$67k");
  });
});
