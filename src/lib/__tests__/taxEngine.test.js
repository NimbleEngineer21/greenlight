import { describe, it, expect } from "vitest";
import {
  calcOrdinaryIncomeTax,
  calcLTCGTax,
  calcNIIT,
  calcCapitalGainsTax,
  calcTaxSummary,
} from "../taxEngine.js";

describe("calcOrdinaryIncomeTax", () => {
  it("computes 10% bracket only for low income (single, 2025)", () => {
    const result = calcOrdinaryIncomeTax(10000, 2025, "single");
    expect(result.tax).toBeCloseTo(1000, 2); // 10000 * 0.10
    expect(result.marginalRate).toBe(0.10);
  });

  it("computes across two brackets (single, 2025)", () => {
    // $20,000 taxable: $11,925 at 10% + $8,075 at 12%
    const result = calcOrdinaryIncomeTax(20000, 2025, "single");
    expect(result.tax).toBeCloseTo(11925 * 0.10 + 8075 * 0.12, 2);
    expect(result.marginalRate).toBe(0.12);
  });

  it("computes correct tax for MFJ at $100,000 (2025)", () => {
    // $23,850 at 10% + ($96,950 - $23,850) at 12% + ($100,000 - $96,950) at 22%
    const result = calcOrdinaryIncomeTax(100000, 2025, "mfj");
    const expected = 23850 * 0.10 + (96950 - 23850) * 0.12 + (100000 - 96950) * 0.22;
    expect(result.tax).toBeCloseTo(expected, 2);
    expect(result.marginalRate).toBe(0.22);
  });

  it("returns zero tax for zero income", () => {
    const result = calcOrdinaryIncomeTax(0, 2025, "single");
    expect(result.tax).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it("handles all filing statuses without error", () => {
    for (const status of ["single", "mfj", "mfs", "hoh"]) {
      const result = calcOrdinaryIncomeTax(50000, 2025, status);
      expect(result.tax).toBeGreaterThan(0);
      expect(result.bracketBreakdown.length).toBeGreaterThan(0);
    }
  });

  it("uses 2026 brackets when specified", () => {
    const r2025 = calcOrdinaryIncomeTax(50000, 2025, "single");
    const r2026 = calcOrdinaryIncomeTax(50000, 2026, "single");
    // Different bracket thresholds should produce different tax
    expect(r2025.tax).not.toBe(r2026.tax);
  });

  it("falls back to 2026 for unknown year", () => {
    const r2030 = calcOrdinaryIncomeTax(50000, 2030, "single");
    const r2026 = calcOrdinaryIncomeTax(50000, 2026, "single");
    expect(r2030.tax).toBe(r2026.tax);
  });

  // IRS Publication example validation:
  // Single filer, $50,000 taxable income (2025)
  // $11,925 * 10% = $1,192.50
  // ($48,475 - $11,925) * 12% = $4,386.00
  // ($50,000 - $48,475) * 22% = $335.50
  // Total = $5,914.00
  it("matches IRS example: single filer at $50,000 (2025)", () => {
    const result = calcOrdinaryIncomeTax(50000, 2025, "single");
    expect(result.tax).toBeCloseTo(5914, 0);
  });
});

describe("calcLTCGTax", () => {
  it("returns 0% rate for LTCG within 0% bracket (single, 2025)", () => {
    // Single filer, $30,000 ordinary income, $10,000 LTCG
    // Stack: ordinary fills up to $30k, LTCG from $30k to $40k
    // 0% bracket ceiling is $48,350 — all LTCG at 0%
    const result = calcLTCGTax(10000, 30000, 2025, "single");
    expect(result.tax).toBe(0);
  });

  it("applies 15% rate when LTCG stacks above 0% threshold", () => {
    // Single, $40,000 ordinary, $20,000 LTCG
    // Stack: $40k to $48,350 at 0% ($8,350), $48,350 to $60,000 at 15% ($11,650)
    const result = calcLTCGTax(20000, 40000, 2025, "single");
    const expected = 8350 * 0 + 11650 * 0.15;
    expect(result.tax).toBeCloseTo(expected, 2);
  });

  it("applies 20% rate for high earners", () => {
    // Single, $500,000 ordinary, $100,000 LTCG
    // Stack starts at $500k, 15% bracket ceiling is $533,400
    // $500k to $533,400 at 15% = $33,400 * 0.15
    // $533,400 to $600,000 at 20% = $66,600 * 0.20
    const result = calcLTCGTax(100000, 500000, 2025, "single");
    const expected = 33400 * 0.15 + 66600 * 0.20;
    expect(result.tax).toBeCloseTo(expected, 2);
  });

  it("returns zero for zero LTCG", () => {
    const result = calcLTCGTax(0, 100000, 2025, "single");
    expect(result.tax).toBe(0);
  });

  it("returns zero for negative LTCG", () => {
    const result = calcLTCGTax(-5000, 100000, 2025, "single");
    expect(result.tax).toBe(0);
  });

  it("uses MFJ brackets correctly", () => {
    // MFJ: 0% up to $96,700
    const result = calcLTCGTax(50000, 40000, 2025, "mfj");
    // Stack: $40k to $90k — all within 0% bracket ($96,700 ceiling)
    expect(result.tax).toBeCloseTo(0, 2);
    expect(result.tax).toBe(0);
  });
});

describe("calcNIIT", () => {
  it("returns 0 when AGI is below threshold", () => {
    const result = calcNIIT(50000, 180000, 2025, "single");
    expect(result).toBe(0); // threshold is $200,000 for single
  });

  it("applies 3.8% on the lesser of investment income or excess AGI", () => {
    // Single, $50,000 investment income, AGI $220,000
    // Excess: $220,000 - $200,000 = $20,000
    // NIIT: min($50,000, $20,000) * 3.8% = $760
    const result = calcNIIT(50000, 220000, 2025, "single");
    expect(result).toBeCloseTo(760, 2);
  });

  it("caps NIIT at investment income when excess > investment income", () => {
    // Single, $10,000 investment income, AGI $300,000
    // Excess: $100,000, but investment income is only $10,000
    // NIIT: $10,000 * 3.8% = $380
    const result = calcNIIT(10000, 300000, 2025, "single");
    expect(result).toBeCloseTo(380, 2);
  });

  it("uses MFJ threshold of $250,000", () => {
    const result = calcNIIT(50000, 240000, 2025, "mfj");
    expect(result).toBe(0); // below $250k threshold

    const result2 = calcNIIT(50000, 270000, 2025, "mfj");
    expect(result2).toBeCloseTo(20000 * 0.038, 2); // $20k excess
  });

  it("uses MFS threshold of $125,000", () => {
    const result = calcNIIT(30000, 140000, 2025, "mfs");
    expect(result).toBeCloseTo(15000 * 0.038, 2); // $15k excess
  });
});

describe("calcCapitalGainsTax", () => {
  it("returns zero tax on net loss", () => {
    const result = calcCapitalGainsTax({
      ltGains: 5000, ltLosses: -10000, stGains: 0, stLosses: 0,
      ordinaryIncome: 100000, year: 2025, filingStatus: "single", stateCode: "FL",
    });
    expect(result.totalTax).toBe(0);
    expect(result.deductible).toBe(3000); // $3k cap loss deduction
  });

  it("caps deductible at $3,000", () => {
    const result = calcCapitalGainsTax({
      ltGains: 0, ltLosses: -50000, stGains: 0, stLosses: 0,
      ordinaryIncome: 100000, year: 2025, filingStatus: "single", stateCode: "FL",
    });
    expect(result.deductible).toBe(3000);
  });

  it("taxes LT and ST separately when both are positive", () => {
    const result = calcCapitalGainsTax({
      ltGains: 10000, ltLosses: 0, stGains: 10000, stLosses: 0,
      ordinaryIncome: 100000, year: 2025, filingStatus: "single", stateCode: "FL",
    });
    expect(result.ltcgTax).toBeGreaterThan(0);
    expect(result.stcgTax).toBeGreaterThan(0);
    expect(result.federalTax).toBe(result.ltcgTax + result.stcgTax);
  });

  it("nets LT losses against ST gains", () => {
    const result = calcCapitalGainsTax({
      ltGains: 0, ltLosses: -5000, stGains: 10000, stLosses: 0,
      ordinaryIncome: 100000, year: 2025, filingStatus: "single", stateCode: "FL",
    });
    // Net ST should be taxed on $5,000 (10k - 5k offset)
    expect(result.ltcgTax).toBe(0);
    expect(result.stcgTax).toBeGreaterThan(0);
  });

  it("nets ST losses against LT gains", () => {
    const result = calcCapitalGainsTax({
      ltGains: 10000, ltLosses: 0, stGains: 0, stLosses: -5000,
      ordinaryIncome: 100000, year: 2025, filingStatus: "single", stateCode: "FL",
    });
    // Remaining LT should be taxed on $5,000 (10k - 5k offset)
    expect(result.stcgTax).toBe(0);
    expect(result.ltcgTax).toBeGreaterThan(0);
  });

  it("includes state tax for taxable states", () => {
    const resultFL = calcCapitalGainsTax({
      ltGains: 50000, ltLosses: 0, stGains: 0, stLosses: 0,
      ordinaryIncome: 100000, year: 2025, filingStatus: "single", stateCode: "FL",
    });
    const resultCA = calcCapitalGainsTax({
      ltGains: 50000, ltLosses: 0, stGains: 0, stLosses: 0,
      ordinaryIncome: 100000, year: 2025, filingStatus: "single", stateCode: "CA",
    });
    expect(resultFL.stateTax).toBe(0);
    expect(resultCA.stateTax).toBeGreaterThan(0);
    expect(resultCA.totalTax).toBeGreaterThan(resultFL.totalTax);
  });

  it("includes NIIT when AGI exceeds threshold", () => {
    const result = calcCapitalGainsTax({
      ltGains: 100000, ltLosses: 0, stGains: 0, stLosses: 0,
      ordinaryIncome: 200000, year: 2025, filingStatus: "single", stateCode: "FL",
    });
    // AGI = $300,000 > $200,000 threshold. NIIT applies.
    expect(result.niit).toBeGreaterThan(0);
  });

  it("does not apply NIIT when AGI below threshold", () => {
    const result = calcCapitalGainsTax({
      ltGains: 10000, ltLosses: 0, stGains: 0, stLosses: 0,
      ordinaryIncome: 100000, year: 2025, filingStatus: "single", stateCode: "FL",
    });
    // AGI = $110,000 < $200,000 threshold
    expect(result.niit).toBe(0);
  });
});

describe("calcTaxSummary", () => {
  it("returns complete tax summary structure", () => {
    const result = calcTaxSummary({
      ordinaryIncome: 100000, ltGains: 10000, ltLosses: 0, stGains: 5000, stLosses: 0,
      year: 2025, filingStatus: "mfj", stateCode: "FL",
    });
    expect(result).toHaveProperty("standardDeduction");
    expect(result).toHaveProperty("taxableOrdinaryIncome");
    expect(result).toHaveProperty("ordinaryTax");
    expect(result).toHaveProperty("capGains");
    expect(result).toHaveProperty("totalFederalTax");
    expect(result).toHaveProperty("totalStateTax");
    expect(result).toHaveProperty("totalTax");
  });

  it("applies standard deduction correctly", () => {
    const result = calcTaxSummary({
      ordinaryIncome: 100000, ltGains: 0, ltLosses: 0, stGains: 0, stLosses: 0,
      year: 2025, filingStatus: "mfj", stateCode: "FL",
    });
    // MFJ standard deduction is $31,400
    expect(result.standardDeduction).toBe(31400);
    expect(result.taxableOrdinaryIncome).toBe(68600);
  });

  it("does not produce negative taxable income", () => {
    const result = calcTaxSummary({
      ordinaryIncome: 10000, ltGains: 0, ltLosses: 0, stGains: 0, stLosses: 0,
      year: 2025, filingStatus: "mfj", stateCode: "FL",
    });
    expect(result.taxableOrdinaryIncome).toBe(0);
  });
});
