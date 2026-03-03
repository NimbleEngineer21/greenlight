import { describe, it, expect } from "vitest";
import { FEDERAL_BRACKETS, NIIT_RATE, getBrackets } from "../taxBrackets.js";

describe("FEDERAL_BRACKETS data integrity", () => {
  const years = [2025, 2026];
  const statuses = ["single", "mfj", "mfs", "hoh"];

  for (const year of years) {
    for (const status of statuses) {
      describe(`${year} / ${status}`, () => {
        const config = FEDERAL_BRACKETS[year][status];

        it("has standardDeduction", () => {
          expect(config.standardDeduction).toBeGreaterThan(0);
        });

        it("has 7 ordinary income brackets", () => {
          expect(config.brackets.length).toBe(7);
        });

        it("brackets start at 0 and end at Infinity", () => {
          expect(config.brackets[0].floor).toBe(0);
          expect(config.brackets[config.brackets.length - 1].ceiling).toBe(Infinity);
        });

        it("bracket floors match previous ceilings (no gaps)", () => {
          for (let i = 1; i < config.brackets.length; i++) {
            expect(config.brackets[i].floor).toBe(config.brackets[i - 1].ceiling);
          }
        });

        it("rates are ascending: 10% → 37%", () => {
          expect(config.brackets[0].rate).toBe(0.10);
          expect(config.brackets[config.brackets.length - 1].rate).toBe(0.37);
          for (let i = 1; i < config.brackets.length; i++) {
            expect(config.brackets[i].rate).toBeGreaterThan(config.brackets[i - 1].rate);
          }
        });

        it("has 3 LTCG brackets (0%, 15%, 20%)", () => {
          expect(config.ltcgBrackets.length).toBe(3);
          expect(config.ltcgBrackets[0].rate).toBe(0);
          expect(config.ltcgBrackets[1].rate).toBe(0.15);
          expect(config.ltcgBrackets[2].rate).toBe(0.20);
        });

        it("LTCG brackets have no gaps", () => {
          expect(config.ltcgBrackets[0].floor).toBe(0);
          for (let i = 1; i < config.ltcgBrackets.length; i++) {
            expect(config.ltcgBrackets[i].floor).toBe(config.ltcgBrackets[i - 1].ceiling);
          }
          expect(config.ltcgBrackets[config.ltcgBrackets.length - 1].ceiling).toBe(Infinity);
        });

        it("has niitThreshold", () => {
          expect(config.niitThreshold).toBeGreaterThan(0);
        });
      });
    }
  }

  it("MFJ brackets are roughly 2x single brackets", () => {
    const s = FEDERAL_BRACKETS[2025].single;
    const m = FEDERAL_BRACKETS[2025].mfj;
    // First bracket ceiling: single $11,925, MFJ $23,850 (exact 2x)
    expect(m.brackets[0].ceiling).toBe(s.brackets[0].ceiling * 2);
  });

  it("2026 brackets are higher than 2025 (inflation adjustment)", () => {
    const s25 = FEDERAL_BRACKETS[2025].single;
    const s26 = FEDERAL_BRACKETS[2026].single;
    expect(s26.standardDeduction).toBeGreaterThan(s25.standardDeduction);
    expect(s26.brackets[0].ceiling).toBeGreaterThan(s25.brackets[0].ceiling);
  });
});

describe("NIIT_RATE", () => {
  it("is 3.8%", () => {
    expect(NIIT_RATE).toBe(0.038);
  });
});

describe("getBrackets", () => {
  it("returns brackets for valid year and status", () => {
    const result = getBrackets(2025, "single");
    expect(result.standardDeduction).toBe(15700);
    expect(result.brackets.length).toBe(7);
  });

  it("falls back to 2026 for unknown year", () => {
    const result = getBrackets(2030, "single");
    const expected = getBrackets(2026, "single");
    expect(result).toEqual(expected);
  });

  it("falls back to MFJ for unknown filing status", () => {
    const result = getBrackets(2025, "unknown_status");
    const expected = getBrackets(2025, "mfj");
    expect(result).toEqual(expected);
  });

  it("NIIT thresholds: single $200k, MFJ $250k, MFS $125k", () => {
    expect(getBrackets(2025, "single").niitThreshold).toBe(200000);
    expect(getBrackets(2025, "mfj").niitThreshold).toBe(250000);
    expect(getBrackets(2025, "mfs").niitThreshold).toBe(125000);
    expect(getBrackets(2025, "hoh").niitThreshold).toBe(200000);
  });
});
