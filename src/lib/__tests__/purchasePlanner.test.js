import { describe, it, expect } from "vitest";
import {
  calcHomeCosts,
  calcCarCosts,
  calcDownPayment,
  calcTotalCashNeeded,
  calcLiquidationAnalysis,
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

  it("returns canAfford=true when surplus", () => {
    const summary = makeSummary(20000, 80000, 5000, 10000, 5000);
    // Available: 20k + (80k - 5k) + 10k + 5k = 110k
    const result = calcLiquidationAnalysis(90000, summary);
    expect(result.canAfford).toBe(true);
    expect(result.surplus).toBe(20000);
    expect(result.shortfall).toBe(0);
  });

  it("returns canAfford=false when shortfall", () => {
    const summary = makeSummary(5000, 20000, 3000, 0, 2000);
    // Available: 5k + (20k - 3k) + 0 + 2k = 24k
    const result = calcLiquidationAnalysis(50000, summary);
    expect(result.canAfford).toBe(false);
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
    expect(result.canAfford).toBe(false);
    expect(result.totalAvailable).toBe(0);
    expect(result.shortfall).toBe(10000);
  });

  it("handles sparse summary without NaN propagation", () => {
    // Simulate summary with missing nested properties
    const sparse = { cashTotal: 5000 };
    const result = calcLiquidationAnalysis(10000, sparse);
    expect(result.canAfford).toBe(false);
    expect(result.totalAvailable).toBe(5000);
    expect(Number.isNaN(result.totalAvailable)).toBe(false);
    expect(Number.isNaN(result.shortfall)).toBe(false);
    expect(result.cashContribution).toBe(5000);
    expect(result.assetContribution).toBe(0);
    expect(result.retirementContribution).toBe(0);
    expect(result.cashFlowContribution).toBe(0);
  });
});
