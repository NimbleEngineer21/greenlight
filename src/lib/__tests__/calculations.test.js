import { describe, it, expect } from "vitest";
import {
  isLongTerm, calcFee, paychecksBefore, expensesBefore,
  obligationsBefore, calcRetirementNet, calcSummary,
  calcMonthlySavings, calcSavingsRate, fmt, fmtQty,
} from "../calculations.js";

describe("isLongTerm", () => {
  it("returns true for >365 days", () => {
    expect(isLongTerm("2024-01-01", "2025-01-02")).toBe(true);
  });

  it("returns false for <365 days", () => {
    expect(isLongTerm("2025-01-01", "2025-06-01")).toBe(false);
  });

  it("returns null for missing acquisition date", () => {
    expect(isLongTerm(null, "2025-06-01")).toBeNull();
  });

  it("handles Date object as sell date", () => {
    expect(isLongTerm("2024-01-01", new Date("2025-01-02T12:00:00"))).toBe(true);
  });
});

describe("calcFee", () => {
  const platforms = {
    cs: { name: "ComputerShare", feePerShare: 0.10, flatFee: 10, feePercent: 0 },
    gem: { name: "Gemini", feePerShare: 0, flatFee: 0, feePercent: 0.015 },
    combo: { name: "Combo", feePerShare: 0.05, flatFee: 5, feePercent: 0.01 },
  };

  it("calculates per-share fee + flat fee", () => {
    const asset = { quantity: 100, feeType: "cs" };
    expect(calcFee(asset, 5000, platforms)).toBe(100 * 0.10 + 10);
  });

  it("calculates percentage fee", () => {
    const asset = { quantity: 1, feeType: "gem" };
    expect(calcFee(asset, 10000, platforms)).toBe(150);
  });

  it("calculates combined per-share + flat + percentage fee", () => {
    const asset = { quantity: 200, feeType: "combo" };
    // 200 * 0.05 + 5 + 0.01 * 8000 = 10 + 5 + 80 = 95
    expect(calcFee(asset, 8000, platforms)).toBe(95);
  });

  it("handles undefined quantity without NaN", () => {
    const asset = { feeType: "cs" };
    expect(calcFee(asset, 5000, platforms)).toBe(10); // 0 * 0.10 + 10 + 0 * 5000
  });

  it("returns 0 for feeType none", () => {
    expect(calcFee({ feeType: "none" }, 5000, platforms)).toBe(0);
  });

  it("returns 0 for missing feeType", () => {
    expect(calcFee({}, 5000, platforms)).toBe(0);
  });

  it("returns 0 for unknown platform", () => {
    expect(calcFee({ feeType: "unknown" }, 5000, platforms)).toBe(0);
  });
});

describe("paychecksBefore", () => {
  const beforeAll = "2026-02-01"; // _today before all test dates

  it("counts biweekly paychecks correctly", () => {
    const config = { paycheckAmount: 5000, firstPayDate: "2026-03-06", paycheckFrequency: "biweekly" };
    const count = paychecksBefore("2026-04-04", config, beforeAll);
    expect(count).toBe(3); // 3/6, 3/20, 4/3
  });

  it("counts weekly paychecks", () => {
    const config = { paycheckAmount: 1000, firstPayDate: "2026-03-01", paycheckFrequency: "weekly" };
    const count = paychecksBefore("2026-03-16", config, beforeAll);
    expect(count).toBe(3); // 3/1, 3/8, 3/15
  });

  it("returns 0 when no paycheck info", () => {
    expect(paychecksBefore("2026-04-01", {})).toBe(0);
    expect(paychecksBefore("2026-04-01", { paycheckAmount: 0 })).toBe(0);
  });

  it("skips past paychecks already reflected in cash balance", () => {
    const config = { paycheckAmount: 5000, firstPayDate: "2026-02-01", paycheckFrequency: "biweekly" };
    // With _today = 3/10, past paychecks (2/1, 2/15, 3/1) are skipped
    // Only 3/15, 3/29 counted through 4/1
    const count = paychecksBefore("2026-04-01", config, "2026-03-10");
    expect(count).toBe(2); // 3/15, 3/29
  });
});

describe("expensesBefore", () => {
  const beforeAll = "2025-12-01"; // _today before all test dates

  it("calculates monthly expenses", () => {
    const expenses = [{ amount: 1000, frequency: "monthly", startDate: "2026-01-01" }];
    // Jan, Feb, Mar = 3 months
    const total = expensesBefore("2026-03-15", expenses, beforeAll);
    expect(total).toBe(3000);
  });

  it("calculates weekly expenses", () => {
    const expenses = [{ amount: 100, frequency: "weekly", startDate: "2026-03-01" }];
    const total = expensesBefore("2026-03-16", expenses, beforeAll);
    expect(total).toBe(300); // 3/1, 3/8, 3/15
  });

  it("calculates biweekly expenses", () => {
    const expenses = [{ amount: 200, frequency: "biweekly", startDate: "2026-03-01" }];
    const total = expensesBefore("2026-03-16", expenses, beforeAll);
    expect(total).toBe(400); // 3/1, 3/15
  });

  it("handles multiple expenses of different frequencies", () => {
    const expenses = [
      { amount: 1000, frequency: "monthly", startDate: "2026-03-01" },
      { amount: 50, frequency: "weekly", startDate: "2026-03-01" },
    ];
    const total = expensesBefore("2026-03-16", expenses, beforeAll);
    // Monthly: 1 (3/1), Weekly: 3 (3/1, 3/8, 3/15)
    expect(total).toBe(1000 + 150);
  });

  it("returns 0 for empty expenses", () => {
    expect(expensesBefore("2026-04-01", [])).toBe(0);
  });

  it("skips past expenses already reflected in cash balance", () => {
    const expenses = [{ amount: 1679, frequency: "monthly", startDate: "2026-01-01" }];
    // With _today = 3/3, Jan and Feb payments are past (already paid).
    // Only Mar (3/1 is past → next is Apr) wait — 3/1 < 3/3, so advance to 4/1.
    // Sell date 4/18: only 4/1 counted = 1 occurrence
    const total = expensesBefore("2026-04-18", expenses, "2026-03-03");
    expect(total).toBe(1679); // only April payment
  });
});

describe("obligationsBefore", () => {
  it("sums unpaid obligations before sell date", () => {
    const obs = [
      { amount: 3000, dueDate: "2026-04-15", isPaid: false },
      { amount: 500, dueDate: "2026-05-01", isPaid: false },
    ];
    expect(obligationsBefore("2026-04-20", obs)).toBe(3000);
  });

  it("excludes paid obligations", () => {
    const obs = [
      { amount: 3000, dueDate: "2026-04-15", isPaid: true },
    ];
    expect(obligationsBefore("2026-04-20", obs)).toBe(0);
  });
});

describe("calcRetirementNet", () => {
  it("returns zeros when disabled", () => {
    const result = calcRetirementNet({ enabled: false });
    expect(result.gross).toBe(0);
    expect(result.net).toBe(0);
  });

  it("taxes full balance for pre-tax 401k", () => {
    const result = calcRetirementNet({
      enabled: true, penaltyRate: 0.10, taxRate: 0.24, stateTaxRate: 0,
      accounts: [{ accountType: "pretax_401k", balance: 10000, contributions: 0 }],
    });
    expect(result.accounts[0].penalty).toBe(1000);
    expect(result.accounts[0].tax).toBe(2400);
    expect(result.accounts[0].net).toBe(6600);
  });

  it("only taxes earnings for Roth accounts", () => {
    const result = calcRetirementNet({
      enabled: true, penaltyRate: 0.10, taxRate: 0.24, stateTaxRate: 0,
      accounts: [{ accountType: "roth_401k", balance: 20000, contributions: 15000 }],
    });
    // Earnings = $5,000
    expect(result.accounts[0].penalty).toBe(500);
    expect(result.accounts[0].tax).toBe(1200);
    expect(result.accounts[0].net).toBe(18300);
  });

  it("handles Roth with no earnings (contributions >= balance)", () => {
    const result = calcRetirementNet({
      enabled: true, penaltyRate: 0.10, taxRate: 0.24, stateTaxRate: 0,
      accounts: [{ accountType: "roth_ira", balance: 10000, contributions: 12000 }],
    });
    expect(result.accounts[0].penalty).toBe(0);
    expect(result.accounts[0].tax).toBe(0);
    expect(result.accounts[0].net).toBe(10000);
  });
});

describe("calcSummary", () => {
  const baseState = {
    sellDate: "2026-04-17",
    assets: [],
    cashAccounts: [{ id: "c1", balance: 10000 }],
    retirement: { enabled: false },
    taxConfig: {
      taxMode: "flat",
      filingStatus: "mfj", combinedW2: 100000, state: "FL",
      ltcgRate: 0.15, stcgRate: 0.24, niitRate: 0.038, niitApplies: false,
      standardDeduction: 31400,
    },
    platforms: { gem: { name: "Gemini", feePerShare: 0, flatFee: 0, feePercent: 0.015 } },
    cashFlow: {
      paycheckAmount: 5000, firstPayDate: "2026-03-06", paycheckFrequency: "biweekly",
      expenses: [], oneTimeObligations: [],
    },
  };

  it("returns correct cash total", () => {
    const result = calcSummary(baseState, {});
    expect(result.cashTotal).toBe(10000);
  });

  it("returns taxDetail when taxMode is progressive", () => {
    const state = {
      ...baseState,
      taxConfig: { ...baseState.taxConfig, taxMode: "progressive", taxYear: 2025 },
      assets: [{
        id: "a1", quantity: 10, costBasis: 1000, acquisitionDate: "2024-01-01",
        priceKey: "test", feeType: "none",
      }],
    };
    const result = calcSummary(state, { test: 200 });
    expect(result.taxDetail).not.toBeNull();
    expect(result.taxDetail).toHaveProperty("ltcgTax");
    expect(result.taxDetail).toHaveProperty("niit");
    expect(result.taxDetail).toHaveProperty("stateTax");
  });

  it("returns null taxDetail in flat mode", () => {
    const result = calcSummary(baseState, {});
    expect(result.taxDetail).toBeNull();
  });

  it("computes gains correctly for an asset", () => {
    const state = {
      ...baseState,
      assets: [{
        id: "a1", quantity: 100, costBasis: 5000, acquisitionDate: "2024-01-01",
        priceKey: "test", feeType: "gem",
      }],
    };
    const result = calcSummary(state, { test: 100 });
    // Gross = 100 * 100 = $10,000
    // Fee = $10,000 * 0.015 = $150
    // GainLoss = $10,000 - $5,000 = $5,000
    expect(result.rows[0].gross).toBe(10000);
    expect(result.rows[0].fee).toBeCloseTo(150, 2);
    expect(result.rows[0].gainLoss).toBe(5000);
    expect(result.rows[0].lt).toBe(true); // 2024 acquisition → LT by 2026
  });
});

describe("formatting helpers", () => {
  describe("fmt", () => {
    it("formats positive numbers with $ prefix", () => {
      expect(fmt(1234.56)).toBe("$1,234.56");
    });

    it("formats negative numbers with parentheses", () => {
      expect(fmt(-1234.56)).toBe("(1,234.56)");
    });

    it("returns em dash for null", () => {
      expect(fmt(null)).toBe("\u2014");
    });

    it("formats zero as $0.00", () => {
      expect(fmt(0)).toBe("$0.00");
    });
  });

  describe("fmtQty", () => {
    it("formats tiny quantities with 8 decimal places", () => {
      expect(fmtQty(0.00012345)).toBe("0.00012345");
    });

    it("formats sub-1 with 6 decimal places", () => {
      expect(fmtQty(0.123456)).toBe("0.123456");
    });

    it("formats medium quantities with 2 decimal places", () => {
      expect(fmtQty(42.5)).toBe("42.50");
    });

    it("formats millions with M suffix", () => {
      expect(fmtQty(2500000)).toBe("2.5M");
    });
  });
});

describe("calcMonthlySavings", () => {
  it("calculates monthly savings for biweekly paycheck and monthly expense", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 5000,
      paycheckFrequency: "biweekly",
      expenses: [{ amount: 2000, frequency: "monthly", startDate: "2026-01-01" }],
    });
    expect(result.monthlyIncome).toBeCloseTo(5000 * 26 / 12, 2);
    expect(result.monthlyExpenses).toBe(2000);
    expect(result.monthlySavings).toBeCloseTo(5000 * 26 / 12 - 2000, 2);
  });

  it("calculates monthly savings for weekly paycheck", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 1000,
      paycheckFrequency: "weekly",
      expenses: [],
    });
    expect(result.monthlyIncome).toBeCloseTo(1000 * 52 / 12, 2);
    expect(result.monthlyExpenses).toBe(0);
    expect(result.monthlySavings).toBeCloseTo(1000 * 52 / 12, 2);
  });

  it("calculates monthly savings for monthly paycheck", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 8000,
      paycheckFrequency: "monthly",
      expenses: [{ amount: 3000, frequency: "monthly", startDate: "2026-01-01" }],
    });
    expect(result.monthlyIncome).toBe(8000);
    expect(result.monthlyExpenses).toBe(3000);
    expect(result.monthlySavings).toBe(5000);
  });

  it("handles weekly expenses", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 10000,
      paycheckFrequency: "monthly",
      expenses: [{ amount: 100, frequency: "weekly", startDate: "2026-01-01" }],
    });
    expect(result.monthlyExpenses).toBeCloseTo(100 * 52 / 12, 2);
  });

  it("handles biweekly expenses", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 10000,
      paycheckFrequency: "monthly",
      expenses: [{ amount: 500, frequency: "biweekly", startDate: "2026-01-01" }],
    });
    expect(result.monthlyExpenses).toBeCloseTo(500 * 26 / 12, 2);
  });

  it("handles multiple expenses of different frequencies", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 5000,
      paycheckFrequency: "biweekly",
      expenses: [
        { amount: 2000, frequency: "monthly", startDate: "2026-01-01" },
        { amount: 100, frequency: "weekly", startDate: "2026-01-01" },
      ],
    });
    const expectedExpenses = 2000 + (100 * 52 / 12);
    expect(result.monthlyExpenses).toBeCloseTo(expectedExpenses, 2);
  });

  it("returns zero income when no paycheck amount", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 0,
      paycheckFrequency: "biweekly",
      expenses: [],
    });
    expect(result.monthlyIncome).toBe(0);
    expect(result.monthlySavings).toBe(0);
  });

  it("handles empty/undefined expenses", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 5000,
      paycheckFrequency: "monthly",
      expenses: undefined,
    });
    expect(result.monthlyExpenses).toBe(0);
    expect(result.monthlySavings).toBe(5000);
  });

  it("returns negative savings when expenses exceed income", () => {
    const result = calcMonthlySavings({
      paycheckAmount: 3000,
      paycheckFrequency: "monthly",
      expenses: [{ amount: 5000, frequency: "monthly", startDate: "2026-01-01" }],
    });
    expect(result.monthlySavings).toBe(-2000);
  });
});

describe("calcSavingsRate", () => {
  it("returns null when income is 0", () => {
    expect(calcSavingsRate(0, 2000)).toBeNull();
  });

  it("returns correct ratio (income 5000, expenses 3500 → 0.30)", () => {
    expect(calcSavingsRate(5000, 3500)).toBeCloseTo(0.3, 10);
  });

  it("returns negative rate when expenses exceed income", () => {
    expect(calcSavingsRate(3000, 4000)).toBeCloseTo(-1 / 3, 10);
  });
});
