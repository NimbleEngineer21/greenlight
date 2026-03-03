import { describe, it, expect } from "vitest";
import { STATE_TAXES, NO_TAX_STATES, getStateTax, calcStateTax, getStateRate } from "../stateTaxes.js";

describe("STATE_TAXES data", () => {
  it("has entries for all 50 states + DC", () => {
    expect(Object.keys(STATE_TAXES).length).toBe(51);
  });

  it("every entry has a name and type", () => {
    for (const [code, info] of Object.entries(STATE_TAXES)) {
      expect(info.name, `${code} missing name`).toBeTruthy();
      expect(["none", "flat", "progressive"], `${code} bad type`).toContain(info.type);
    }
  });

  it("flat states have a rate", () => {
    for (const [code, info] of Object.entries(STATE_TAXES)) {
      if (info.type === "flat") {
        expect(info.rate, `${code} missing rate`).toBeGreaterThan(0);
        expect(info.rate, `${code} rate > 1`).toBeLessThan(1);
      }
    }
  });

  it("progressive states have bracket arrays with ascending floors", () => {
    for (const [code, info] of Object.entries(STATE_TAXES)) {
      if (info.type === "progressive") {
        expect(info.brackets, `${code} missing brackets`).toBeDefined();
        expect(info.brackets.length, `${code} empty brackets`).toBeGreaterThan(0);
        for (let i = 1; i < info.brackets.length; i++) {
          expect(info.brackets[i].floor, `${code} bracket ${i} floor`)
            .toBeGreaterThanOrEqual(info.brackets[i - 1].ceiling);
        }
      }
    }
  });

  it("bracket floors match previous ceilings (no gaps)", () => {
    for (const [code, info] of Object.entries(STATE_TAXES)) {
      if (info.type === "progressive") {
        for (let i = 1; i < info.brackets.length; i++) {
          expect(info.brackets[i].floor, `${code} gap at bracket ${i}`)
            .toBe(info.brackets[i - 1].ceiling);
        }
      }
    }
  });

  it("last bracket always has Infinity ceiling", () => {
    for (const [code, info] of Object.entries(STATE_TAXES)) {
      if (info.type === "progressive") {
        const last = info.brackets[info.brackets.length - 1];
        expect(last.ceiling, `${code} last bracket not Infinity`).toBe(Infinity);
      }
    }
  });

  it("mfjBrackets have ascending floors and Infinity ceiling when present", () => {
    for (const [code, info] of Object.entries(STATE_TAXES)) {
      if (info.mfjBrackets) {
        expect(info.mfjBrackets.length, `${code} empty mfjBrackets`).toBeGreaterThan(0);
        for (let i = 1; i < info.mfjBrackets.length; i++) {
          expect(info.mfjBrackets[i].floor, `${code} mfj bracket ${i} floor`)
            .toBe(info.mfjBrackets[i - 1].ceiling);
        }
        const last = info.mfjBrackets[info.mfjBrackets.length - 1];
        expect(last.ceiling, `${code} mfj last bracket not Infinity`).toBe(Infinity);
      }
    }
  });

  it("mfjBrackets have valid rates between 0 and 1", () => {
    for (const [code, info] of Object.entries(STATE_TAXES)) {
      if (info.mfjBrackets) {
        for (const bracket of info.mfjBrackets) {
          expect(bracket.rate, `${code} mfj invalid rate`).toBeGreaterThanOrEqual(0);
          expect(bracket.rate, `${code} mfj rate > 1`).toBeLessThan(1);
        }
      }
    }
  });
});

describe("NO_TAX_STATES", () => {
  const expected = ["AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY"];

  it("contains the 9 no-income-tax states", () => {
    expect(NO_TAX_STATES.sort()).toEqual(expected.sort());
  });
});

describe("getStateTax", () => {
  it("returns config for known states", () => {
    expect(getStateTax("CA").type).toBe("progressive");
    expect(getStateTax("FL").type).toBe("none");
    expect(getStateTax("IL").type).toBe("flat");
  });

  it("falls back to none for unknown codes", () => {
    expect(getStateTax("XX").type).toBe("none");
  });
});

describe("calcStateTax", () => {
  it("returns 0 for no-tax states", () => {
    expect(calcStateTax("FL", 100000)).toBe(0);
    expect(calcStateTax("TX", 500000)).toBe(0);
    expect(calcStateTax("WA", 250000)).toBe(0);
  });

  it("calculates flat tax correctly", () => {
    // Illinois: 4.95% flat
    expect(calcStateTax("IL", 100000)).toBeCloseTo(4950, 2);
  });

  it("calculates progressive tax correctly for California", () => {
    // CA at $50,000 (2026 brackets):
    // $11,079 * 1% = $110.79
    // ($26,264 - $11,079) * 2% = $303.70
    // ($41,452 - $26,264) * 4% = $607.52
    // ($50,000 - $41,452) * 6% = $512.88
    const tax = calcStateTax("CA", 50000);
    const expected = 11079 * 0.01 + (26264 - 11079) * 0.02 + (41452 - 26264) * 0.04 + (50000 - 41452) * 0.06;
    expect(tax).toBeCloseTo(expected, 2);
  });

  it("returns 0 for negative income", () => {
    expect(calcStateTax("IL", -5000)).toBe(0);
  });

  it("returns 0 for zero income", () => {
    expect(calcStateTax("CA", 0)).toBe(0);
  });

  it("calculates New York tax correctly", () => {
    // NY at $50,000 (2026 brackets):
    // $8,500 * 3.9% = $331.50
    // ($11,700 - $8,500) * 4.4% = $140.80
    // ($13,900 - $11,700) * 5.15% = $113.30
    // ($50,000 - $13,900) * 5.4% = $1,949.40
    const tax = calcStateTax("NY", 50000);
    const expected = 8500 * 0.039 + (11700 - 8500) * 0.044 + (13900 - 11700) * 0.0515 + (50000 - 13900) * 0.054;
    expect(tax).toBeCloseTo(expected, 2);
  });

  it("uses MFJ brackets when filing status is mfj", () => {
    // AL single at $5,000: $500*2% + $2500*4% + $2000*5% = $210
    // AL MFJ at $5,000: $1000*2% + $4000*4% = $180
    const single = calcStateTax("AL", 5000, "single");
    const mfj = calcStateTax("AL", 5000, "mfj");
    expect(single).toBeCloseTo(500 * 0.02 + 2500 * 0.04 + 2000 * 0.05, 2);
    expect(mfj).toBeCloseTo(1000 * 0.02 + 4000 * 0.04, 2);
    expect(mfj).toBeLessThan(single);
  });

  it("falls back to single brackets when no mfjBrackets exist", () => {
    // Delaware has no mfjBrackets — MFJ should use single brackets
    expect(calcStateTax("DE", 50000, "mfj")).toBe(calcStateTax("DE", 50000, "single"));
  });
});

describe("getStateRate", () => {
  it("returns zeros for no-tax states", () => {
    const rate = getStateRate("FL", 100000);
    expect(rate.effective).toBe(0);
    expect(rate.marginal).toBe(0);
  });

  it("returns same rate for flat states", () => {
    const rate = getStateRate("IL", 100000);
    expect(rate.effective).toBe(0.0495);
    expect(rate.marginal).toBe(0.0495);
  });

  it("returns different effective vs marginal for progressive states", () => {
    const rate = getStateRate("CA", 100000);
    expect(rate.marginal).toBeGreaterThan(rate.effective);
    expect(rate.marginal).toBe(0.093); // 9.3% bracket at $72,724-$371,479
  });

  it("uses MFJ brackets for marginal rate", () => {
    // MN single at $50K: marginal = 6.8% ($33,310-$109,430 bracket)
    // MN MFJ at $50K: marginal = 5.35% ($0-$48,700 bracket)... wait $50K > $48,700, so marginal = 6.8%
    // Let's use $45K: MN MFJ at $45K: marginal = 5.35% (still in first bracket $0-$48,700)
    // MN single at $45K: marginal = 6.8% (in $33,310-$109,430 bracket)
    const single = getStateRate("MN", 45000, "single");
    const mfj = getStateRate("MN", 45000, "mfj");
    expect(single.marginal).toBe(0.068);
    expect(mfj.marginal).toBe(0.0535);
  });
});
