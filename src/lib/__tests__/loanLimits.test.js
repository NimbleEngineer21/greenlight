import { describe, it, expect } from "vitest";
import { getConformingLimit, BASELINE_LIMIT } from "../../data/conformingLimits.js";
import {
  detectJumbo, calcEffectiveRate, suggestConformingDown, calcJumboImpact,
  DEFAULT_JUMBO_PREMIUM,
} from "../loanLimits.js";

// ── getConformingLimit ───────────────────────────────────────────────────────

describe("getConformingLimit", () => {
  it("returns $1,209,750 for NYC metro (zip 10001)", () => {
    expect(getConformingLimit(10001)).toBe(1209750);
    expect(getConformingLimit("10001")).toBe(1209750);
  });

  it("returns $1,249,125 for LA County (zip 90210)", () => {
    expect(getConformingLimit(90210)).toBe(1249125);
  });

  it("returns baseline for Tallahassee FL (zip 32301)", () => {
    expect(getConformingLimit(32301)).toBe(BASELINE_LIMIT);
  });

  it("returns $1,249,125 for Alaska (zip 99501)", () => {
    expect(getConformingLimit(99501)).toBe(1249125);
  });

  it("returns $1,249,125 for Honolulu HI (zip 96813)", () => {
    expect(getConformingLimit(96813)).toBe(1249125);
  });

  it("returns $1,249,125 for DC (zip 20001)", () => {
    expect(getConformingLimit(20001)).toBe(1249125);
  });

  it("returns $977,500 for Fairfield CT (zip 06604)", () => {
    expect(getConformingLimit("06604")).toBe(977500);
  });

  it("returns $1,029,250 for Nashville TN (zip 37201)", () => {
    expect(getConformingLimit(37201)).toBe(1029250);
  });

  it("returns baseline for unknown zips", () => {
    expect(getConformingLimit(99999)).toBe(BASELINE_LIMIT);
    expect(getConformingLimit("abc")).toBe(BASELINE_LIMIT);
  });
});

// ── detectJumbo ──────────────────────────────────────────────────────────────

describe("detectJumbo", () => {
  it("returns not jumbo when loan is below limit", () => {
    const result = detectJumbo(700000, 32301);
    expect(result.isJumbo).toBe(false);
    expect(result.conformingLimit).toBe(BASELINE_LIMIT);
    expect(result.overage).toBe(0);
  });

  it("returns jumbo when loan exceeds limit", () => {
    const result = detectJumbo(900000, 32301);
    expect(result.isJumbo).toBe(true);
    expect(result.conformingLimit).toBe(BASELINE_LIMIT);
    expect(result.overage).toBe(900000 - BASELINE_LIMIT);
  });

  it("is not jumbo when loan equals limit exactly", () => {
    const result = detectJumbo(BASELINE_LIMIT, 32301);
    expect(result.isJumbo).toBe(false);
    expect(result.overage).toBe(0);
  });

  it("is jumbo by $1 when loan is 1 dollar over", () => {
    const result = detectJumbo(BASELINE_LIMIT + 1, 32301);
    expect(result.isJumbo).toBe(true);
    expect(result.overage).toBe(1);
  });

  it("uses high-cost limit for NYC zip", () => {
    const result = detectJumbo(1000000, 10001);
    expect(result.isJumbo).toBe(false); // 1M < 1,209,750
    expect(result.conformingLimit).toBe(1209750);
  });
});

// ── calcEffectiveRate ────────────────────────────────────────────────────────

describe("calcEffectiveRate", () => {
  it("returns base rate for conforming loan", () => {
    expect(calcEffectiveRate(6.5, false)).toBe(6.5);
    expect(calcEffectiveRate(6.5, false, 0.5)).toBe(6.5);
  });

  it("adds default 0.25% premium for jumbo", () => {
    expect(calcEffectiveRate(6.5, true)).toBe(6.75);
  });

  it("uses custom spread", () => {
    expect(calcEffectiveRate(6.5, true, 0.5)).toBe(7.0);
  });

  it("handles zero spread", () => {
    expect(calcEffectiveRate(6.5, true, 0)).toBe(6.5);
  });
});

// ── suggestConformingDown ────────────────────────────────────────────────────

describe("suggestConformingDown", () => {
  it("returns null when loan is already conforming", () => {
    // 500K home, 20% down = 400K loan, well under 832,750
    expect(suggestConformingDown(500000, BASELINE_LIMIT, 20)).toBeNull();
  });

  it("returns null when home price is below limit", () => {
    expect(suggestConformingDown(700000, BASELINE_LIMIT, 0)).toBeNull();
  });

  it("suggests increased down payment for jumbo loan", () => {
    // 1M home, 832,750 limit, 10% down = 900K loan (67,250 over limit)
    const result = suggestConformingDown(1000000, BASELINE_LIMIT, 10);
    expect(result).not.toBeNull();
    // Required down = 1M - 832,750 = 167,250 = 16.725% → rounds up to 16.8%
    expect(result.requiredDownPercent).toBeCloseTo(16.8, 0);
    expect(result.requiredDownAmount).toBe(167250);
    expect(result.additionalDown).toBe(167250 - 100000);
  });

  it("returns null for zero/invalid inputs", () => {
    expect(suggestConformingDown(0, BASELINE_LIMIT, 20)).toBeNull();
    expect(suggestConformingDown(-100, BASELINE_LIMIT, 20)).toBeNull();
  });
});

// ── calcJumboImpact ──────────────────────────────────────────────────────────

describe("calcJumboImpact", () => {
  it("calculates positive monthly difference", () => {
    const result = calcJumboImpact(800000, 6.5, 30, DEFAULT_JUMBO_PREMIUM);
    expect(result.jumboPayment).toBeGreaterThan(result.conformingPayment);
    expect(result.monthlyDiff).toBeGreaterThan(0);
  });

  it("lifetime difference = monthly * term * 12", () => {
    const result = calcJumboImpact(800000, 6.5, 30, 0.25);
    expect(result.lifetimeDiff).toBeCloseTo(result.monthlyDiff * 360, 2);
  });

  it("zero premium yields zero difference", () => {
    const result = calcJumboImpact(800000, 6.5, 30, 0);
    expect(result.monthlyDiff).toBe(0);
    expect(result.lifetimeDiff).toBe(0);
  });
});
