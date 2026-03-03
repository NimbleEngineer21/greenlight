import { describe, it, expect } from "vitest";
import {
  calcMonthlyPI,
  calcAmortizationSchedule,
  calcPMI,
  calcPMIDropoffMonth,
  calcTotalMonthly,
  calcPointsCost,
  calcRateAfterPoints,
  calcPointsBreakEven,
  calcBuyDownSignal,
  compareLenders,
  calcMonthlyPayment,
  calcAutoLoanSummary,
} from "../mortgageCalc.js";

describe("calcMonthlyPI", () => {
  it("computes standard 30yr 6.5% payment on $280,000", () => {
    // Verified against Bankrate: ~$1,770.09
    expect(calcMonthlyPI(280000, 6.5, 30)).toBeCloseTo(1770.09, 0);
  });

  it("returns simple division when rate is 0", () => {
    expect(calcMonthlyPI(120000, 0, 30)).toBeCloseTo(333.33, 0);
  });

  it("computes 15yr payment correctly", () => {
    // $280k at 6.0% for 15yr → ~$2,362.69
    expect(calcMonthlyPI(280000, 6.0, 15)).toBeCloseTo(2362.69, 0);
  });

  it("returns 0 for zero or negative principal", () => {
    expect(calcMonthlyPI(0, 6.5, 30)).toBe(0);
    expect(calcMonthlyPI(-100, 6.5, 30)).toBe(0);
  });

  it("returns 0 for invalid inputs (NaN, undefined, zero term)", () => {
    expect(calcMonthlyPI(280000, 6.5, 0)).toBe(0);
    expect(calcMonthlyPI(280000, undefined, 30)).toBe(0);
    expect(calcMonthlyPI(280000, NaN, 30)).toBe(0);
    expect(calcMonthlyPI(NaN, 6.5, 30)).toBe(0);
    expect(calcMonthlyPI(280000, 6.5, -5)).toBe(0);
  });
});

describe("calcAmortizationSchedule", () => {
  it("produces correct number of rows for 30yr", () => {
    const sched = calcAmortizationSchedule(100000, 6.0, 30);
    expect(sched).toHaveLength(360);
  });

  it("produces correct number of rows for 15yr", () => {
    const sched = calcAmortizationSchedule(100000, 6.0, 15);
    expect(sched).toHaveLength(180);
  });

  it("final balance is approximately zero", () => {
    const sched = calcAmortizationSchedule(280000, 6.5, 30);
    expect(Math.abs(sched[359].balance)).toBeLessThan(0.01);
  });

  it("first month interest exceeds first month principal at typical rates", () => {
    const sched = calcAmortizationSchedule(200000, 6.5, 30);
    expect(sched[0].interestPart).toBeGreaterThan(sched[0].principalPart);
  });

  it("balance decreases monotonically", () => {
    const sched = calcAmortizationSchedule(100000, 5.0, 30);
    for (let i = 1; i < sched.length; i++) {
      expect(sched[i].balance).toBeLessThanOrEqual(sched[i - 1].balance);
    }
  });

  it("total principal paid equals original loan amount", () => {
    const sched = calcAmortizationSchedule(200000, 6.5, 30);
    const totalPrincipal = sched.reduce((s, r) => s + r.principalPart, 0);
    expect(totalPrincipal).toBeCloseTo(200000, 0);
  });

  it("handles 0% rate: all interest is zero, balance reaches zero", () => {
    const sched = calcAmortizationSchedule(120000, 0, 30);
    expect(sched).toHaveLength(360);
    expect(sched[0].interestPart).toBe(0);
    expect(sched[0].principalPart).toBeCloseTo(333.33, 0);
    expect(Math.abs(sched[359].balance)).toBeLessThan(0.01);
    // Every payment should be equal
    for (let i = 0; i < sched.length - 1; i++) {
      expect(sched[i].payment).toBeCloseTo(sched[i + 1].payment, 0);
    }
  });

  it("returns empty schedule for invalid inputs", () => {
    expect(calcAmortizationSchedule(100000, 6.5, 0)).toHaveLength(0);
    expect(calcAmortizationSchedule(0, 6.5, 30)).toHaveLength(0);
  });
});

describe("calcPMI", () => {
  it("computes monthly PMI at 0.5%", () => {
    // $280k * 0.5% / 12 = ~$116.67
    expect(calcPMI(280000, 0.5)).toBeCloseTo(116.67, 0);
  });

  it("returns 0 when rate is 0", () => {
    expect(calcPMI(280000, 0)).toBe(0);
  });

  it("returns 0 when rate is null", () => {
    expect(calcPMI(280000, null)).toBe(0);
  });
});

describe("calcPMIDropoffMonth", () => {
  it("returns 0 when initial LTV <= 78%", () => {
    // 25% down on $350k → $262.5k loan, LTV = 75% → no PMI
    const sched = calcAmortizationSchedule(262500, 6.5, 30);
    expect(calcPMIDropoffMonth(sched, 350000)).toBe(0);
  });

  it("returns a month number for 10% down", () => {
    // 10% down on $350k → $315k loan, LTV = 90%
    const sched = calcAmortizationSchedule(315000, 6.5, 30);
    const dropoff = calcPMIDropoffMonth(sched, 350000);
    expect(dropoff).toBeGreaterThan(0);
    expect(dropoff).toBeLessThan(360);
    // At dropoff, LTV should be <= 78%
    expect(sched[dropoff - 1].balance / 350000).toBeLessThanOrEqual(0.78);
  });

  it("returns 0 for empty schedule", () => {
    expect(calcPMIDropoffMonth([], 350000)).toBe(0);
  });

  it("returns 0 for zero homePrice", () => {
    const sched = calcAmortizationSchedule(280000, 6.5, 30);
    expect(calcPMIDropoffMonth(sched, 0)).toBe(0);
  });

  it("requires PMI for exactly 20% down (initial LTV 80% > 78% threshold)", () => {
    // 20% down → $280k loan on $350k, initial LTV = 80%
    // 80% > 78%, so PMI applies initially and drops off later
    const sched = calcAmortizationSchedule(280000, 6.5, 30);
    const dropoff = calcPMIDropoffMonth(sched, 350000);
    expect(dropoff).toBeGreaterThan(0);
  });
});

describe("calcTotalMonthly", () => {
  it("sums all components", () => {
    const result = calcTotalMonthly({
      pi: 1770, propertyTax: 3500, homeInsurance: 1800, hoa: 200, pmi: 117,
    });
    expect(result.pi).toBe(1770);
    expect(result.propertyTax).toBeCloseTo(291.67, 0);
    expect(result.homeInsurance).toBe(150);
    expect(result.hoa).toBe(200);
    expect(result.pmi).toBe(117);
    expect(result.total).toBeCloseTo(2528.67, 0);
  });

  it("handles zero/missing components", () => {
    const result = calcTotalMonthly({ pi: 1500, propertyTax: 0, homeInsurance: 0, hoa: 0, pmi: 0 });
    expect(result.total).toBe(1500);
  });
});

describe("calcPointsCost", () => {
  it("computes cost for 2 points at 1% each", () => {
    expect(calcPointsCost(280000, 2, 1)).toBe(5600);
  });

  it("returns 0 for 0 points", () => {
    expect(calcPointsCost(280000, 0, 1)).toBe(0);
  });
});

describe("calcRateAfterPoints", () => {
  it("reduces rate by 0.25% per point", () => {
    expect(calcRateAfterPoints(6.5, 2, 0.25)).toBeCloseTo(6.0, 4);
  });

  it("floors at 0%", () => {
    expect(calcRateAfterPoints(1.0, 10, 0.25)).toBe(0);
  });

  it("returns base rate for 0 points", () => {
    expect(calcRateAfterPoints(6.5, 0, 0.25)).toBe(6.5);
  });
});

describe("calcPointsBreakEven", () => {
  it("computes simple break-even as cost / savings", () => {
    const result = calcPointsBreakEven(5600, 90, 7);
    expect(result.simpleMonths).toBe(Math.ceil(5600 / 90));
  });

  it("adjusted break-even is longer than simple", () => {
    const result = calcPointsBreakEven(5600, 90, 7);
    expect(result.adjustedMonths).toBeGreaterThan(result.simpleMonths);
  });

  it("returns Infinity when monthlySavings <= 0", () => {
    const result = calcPointsBreakEven(5600, 0, 7);
    expect(result.simpleMonths).toBe(Infinity);
    expect(result.adjustedMonths).toBe(Infinity);
  });

  it("returns Infinity when pointsCost <= 0", () => {
    const result = calcPointsBreakEven(0, 90, 7);
    expect(result.simpleMonths).toBe(Infinity);
  });

  it("higher opportunity rate yields longer adjusted break-even", () => {
    // Use larger savings-to-cost ratio so both converge
    const low = calcPointsBreakEven(3000, 200, 4);
    const high = calcPointsBreakEven(3000, 200, 10);
    expect(low.adjustedMonths).toBeGreaterThan(low.simpleMonths);
    expect(high.adjustedMonths).toBeGreaterThan(low.adjustedMonths);
  });

  it("returns Infinity adjusted when savings can never outpace opportunity cost growth", () => {
    // $6K cost, $50/mo savings, 7%: exponential growth outpaces linear savings
    const result = calcPointsBreakEven(6000, 50, 7);
    expect(result.simpleMonths).toBe(120);
    expect(result.adjustedMonths).toBe(Infinity);
  });

  it("returns finite adjusted break-even for realistic savings", () => {
    // $3000 cost, $200/mo savings, 7%: savings outpace growth quickly
    const result = calcPointsBreakEven(3000, 200, 7);
    expect(result.simpleMonths).toBe(15);
    expect(result.adjustedMonths).toBeGreaterThan(15);
    expect(result.adjustedMonths).toBeLessThan(30);
  });
});

describe("calcBuyDownSignal", () => {
  it("returns green when adjusted < 60% of stay", () => {
    // 36 months adjusted, 10 year stay (120 months), 36/120 = 30%
    expect(calcBuyDownSignal(36, 10).signal).toBe("green");
  });

  it("returns yellow when adjusted 60-100% of stay", () => {
    // 80 months adjusted, 10 year stay (120 months), 80/120 = 67%
    expect(calcBuyDownSignal(80, 10).signal).toBe("yellow");
  });

  it("returns red when adjusted > stay", () => {
    // 150 months adjusted, 10 year stay (120 months)
    expect(calcBuyDownSignal(150, 10).signal).toBe("red");
  });

  it("returns red for Infinity", () => {
    expect(calcBuyDownSignal(Infinity, 10).signal).toBe("red");
  });

  it("boundary: exactly 60% is green, just above is yellow", () => {
    // 72 months = exactly 60% of 120 month stay → green (<=)
    expect(calcBuyDownSignal(72, 10).signal).toBe("green");
    // 73 months = 60.8% → yellow
    expect(calcBuyDownSignal(73, 10).signal).toBe("yellow");
  });
});

describe("compareLenders", () => {
  const lenders = [
    { id: "1", name: "Bank A", ratePercent: 6.75, points: 0, closingCredits: 0, originationFee: 1500 },
    { id: "2", name: "Bank B", ratePercent: 6.5, points: 1, closingCredits: 500, originationFee: 1000 },
    { id: "3", name: "Bank C", ratePercent: 7.0, points: 0, closingCredits: 2000, originationFee: 0 },
  ];

  it("returns results for all lenders", () => {
    const results = compareLenders(lenders, 280000, 30, 10, 7);
    expect(results).toHaveLength(3);
  });

  it("ranks lenders by total cost", () => {
    const results = compareLenders(lenders, 280000, 30, 10, 7);
    for (let i = 1; i < results.length; i++) {
      const costA = results[i - 1].upfrontCost + results[i - 1].monthlyPI * 10 * 12;
      const costB = results[i].upfrontCost + results[i].monthlyPI * 10 * 12;
      expect(costA).toBeLessThanOrEqual(costB);
    }
  });

  it("returns empty array for empty input", () => {
    expect(compareLenders([], 280000)).toEqual([]);
    expect(compareLenders(null, 280000)).toEqual([]);
  });

  it("computes adjusted rate correctly for lender with points", () => {
    const results = compareLenders(lenders, 280000, 30, 10, 7);
    const bankB = results.find(r => r.name === "Bank B");
    expect(bankB.adjustedRate).toBeCloseTo(6.25, 2);
  });
});

describe("calcMonthlyPayment", () => {
  it("delegates to calcMonthlyPI with months converted to years", () => {
    // 60 months = 5 years, $30,000 at 6.5%
    const monthly = calcMonthlyPayment(30000, 6.5, 60);
    const expected = calcMonthlyPI(30000, 6.5, 5);
    expect(monthly).toBeCloseTo(expected, 2);
  });

  it("returns 0 for zero or invalid term", () => {
    expect(calcMonthlyPayment(30000, 6.5, 0)).toBe(0);
    expect(calcMonthlyPayment(30000, 6.5, -12)).toBe(0);
  });
});

describe("calcAutoLoanSummary", () => {
  it("computes basic auto loan with down payment", () => {
    const result = calcAutoLoanSummary(35000, 5000, 0, 6.5, 60);
    expect(result.loanAmount).toBe(30000);
    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.totalCost).toBeCloseTo(result.monthlyPayment * 60, 2);
    expect(result.totalInterest).toBeCloseTo(result.totalCost - 30000, 2);
  });

  it("accounts for trade-in value", () => {
    const withTrade = calcAutoLoanSummary(35000, 5000, 3000, 6.5, 60);
    const withoutTrade = calcAutoLoanSummary(35000, 5000, 0, 6.5, 60);
    expect(withTrade.loanAmount).toBe(27000);
    expect(withTrade.monthlyPayment).toBeLessThan(withoutTrade.monthlyPayment);
  });

  it("returns 0 loan when down + trade >= price", () => {
    const result = calcAutoLoanSummary(35000, 20000, 20000, 6.5, 60);
    expect(result.loanAmount).toBe(0);
    expect(result.monthlyPayment).toBe(0);
  });

  it("shorter term means higher monthly but less total interest", () => {
    const short = calcAutoLoanSummary(30000, 0, 0, 6.5, 36);
    const long = calcAutoLoanSummary(30000, 0, 0, 6.5, 72);
    expect(short.monthlyPayment).toBeGreaterThan(long.monthlyPayment);
    expect(short.totalInterest).toBeLessThan(long.totalInterest);
  });
});
