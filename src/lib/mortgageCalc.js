// Mortgage calculation engine — pure functions, no side effects
// All rates are percentages (e.g., 6.5 means 6.5%), converted internally

/**
 * Monthly principal + interest payment (standard amortization formula).
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calcMonthlyPI(principal, annualRatePercent, termYears) {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(annualRatePercent) || !Number.isFinite(termYears) || termYears <= 0) return 0;
  const n = termYears * 12;
  if (annualRatePercent === 0) return principal / n;
  const r = annualRatePercent / 100 / 12;
  const factor = Math.pow(1 + r, n);
  return principal * (r * factor) / (factor - 1);
}

/**
 * Full amortization schedule — month-by-month breakdown.
 * Returns array of { month, payment, principalPart, interestPart, balance }
 */
export function calcAmortizationSchedule(principal, annualRatePercent, termYears) {
  if (!Number.isFinite(principal) || principal <= 0) return [];
  if (!Number.isFinite(termYears) || termYears <= 0) return [];
  const n = termYears * 12;
  const payment = calcMonthlyPI(principal, annualRatePercent, termYears);
  const r = annualRatePercent / 100 / 12;
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= n; month++) {
    const interestPart = balance * r;
    let principalPart = payment - interestPart;
    // Final month: zero out balance exactly to avoid floating-point dust
    if (month === n) {
      principalPart = balance;
    }
    balance = Math.max(0, balance - principalPart);
    schedule.push({
      month,
      payment: month === n ? principalPart + interestPart : payment,
      principalPart,
      interestPart,
      balance,
    });
  }
  return schedule;
}

/**
 * Monthly PMI amount. PMI = loanAmount * (pmiRatePercent / 100) / 12
 * Returns 0 if pmiRate is 0 or not provided.
 */
export function calcPMI(loanAmount, pmiRatePercent) {
  if (!pmiRatePercent || pmiRatePercent <= 0) return 0;
  return loanAmount * (pmiRatePercent / 100) / 12;
}

/**
 * Month number when PMI drops off (LTV reaches 78% per Homeowners Protection Act).
 * Returns 0 if no PMI needed (initial LTV already at or below 78%).
 * Returns 0 if schedule is empty or homePrice is 0.
 */
export function calcPMIDropoffMonth(schedule, homePrice) {
  if (!schedule.length || !homePrice) return 0;
  // Check if initial LTV already <= 78% (no PMI needed)
  const initialLTV = schedule[0].balance / homePrice;
  if (initialLTV <= 0.78) return 0;

  for (const row of schedule) {
    const ltv = row.balance / homePrice;
    if (ltv <= 0.78) return row.month;
  }
  return 0;
}

/**
 * Total monthly housing payment breakdown.
 * Returns { pi, propertyTax, homeInsurance, hoa, pmi, total }
 */
export function calcTotalMonthly({ pi, propertyTax, homeInsurance, hoa, pmi }) {
  const tax = (propertyTax || 0) / 12;
  const ins = (homeInsurance || 0) / 12;
  const hoaMonthly = hoa || 0;
  const pmiMonthly = pmi || 0;
  return {
    pi,
    propertyTax: tax,
    homeInsurance: ins,
    hoa: hoaMonthly,
    pmi: pmiMonthly,
    total: pi + tax + ins + hoaMonthly + pmiMonthly,
  };
}

/**
 * Dollar cost of buying N discount points.
 * Each point costs costPercent% of the loan amount.
 */
export function calcPointsCost(loanAmount, points, costPercentPerPoint = 1) {
  return loanAmount * points * (costPercentPerPoint / 100);
}

/**
 * Effective rate after buying points.
 * Each point reduces rate by reductionPerPoint percentage points.
 */
export function calcRateAfterPoints(baseRatePercent, points, reductionPerPoint = 0.25) {
  return Math.max(0, baseRatePercent - points * reductionPerPoint);
}

/**
 * Break-even analysis for buying points.
 * Simple: pointsCost / monthlySavings
 * Adjusted: accounts for opportunity cost of the points money invested elsewhere
 *
 * @param {number} pointsCost - Dollar cost of points
 * @param {number} monthlySavings - Monthly payment reduction from points
 * @param {number} opportunityRatePercent - Annual return rate on alternative investment (default 7%)
 * @returns {{ simpleMonths, adjustedMonths, monthlySavings, pointsCost }}
 */
export function calcPointsBreakEven(pointsCost, monthlySavings, opportunityRatePercent = 7) {
  if (monthlySavings <= 0 || pointsCost <= 0) {
    return { simpleMonths: Infinity, adjustedMonths: Infinity, monthlySavings, pointsCost };
  }

  const simpleMonths = Math.ceil(pointsCost / monthlySavings);

  // Adjusted: the points cost grows at the opportunity rate (compound), while monthly
  // savings accumulate linearly (not reinvested). Conservative model — if savings were
  // also invested, break-even would be shorter.
  const monthlyReturn = Math.pow(1 + opportunityRatePercent / 100, 1 / 12) - 1;
  let adjustedMonths = Infinity;
  for (let m = 1; m <= 600; m++) { // cap at 50 years
    const cumulativeSavings = monthlySavings * m;
    const foregoneValue = pointsCost * Math.pow(1 + monthlyReturn, m);
    if (cumulativeSavings >= foregoneValue) {
      adjustedMonths = m;
      break;
    }
  }

  return { simpleMonths, adjustedMonths, monthlySavings, pointsCost };
}

/**
 * Buy-down recommendation signal based on break-even vs expected stay.
 * green: adjusted break-even <= 60% of stay (clear win)
 * yellow: 60-100% of stay (marginal)
 * red: > stay or Infinity (don't buy down)
 */
export function calcBuyDownSignal(adjustedBreakEvenMonths, expectedStayYears) {
  const stayMonths = expectedStayYears * 12;
  if (adjustedBreakEvenMonths === Infinity || adjustedBreakEvenMonths > stayMonths) {
    return { signal: "red", label: "Skip the buy-down, invest instead" };
  }
  if (adjustedBreakEvenMonths <= stayMonths * 0.6) {
    return { signal: "green", label: "Buy down the rate" };
  }
  return { signal: "yellow", label: "Marginal \u2014 depends on priorities" };
}

/**
 * Monthly payment for a generic loan (auto, personal, etc.) using term in months.
 * Delegates to calcMonthlyPI with termMonths / 12.
 */
export function calcMonthlyPayment(principal, annualRatePercent, termMonths) {
  if (!Number.isFinite(termMonths) || termMonths <= 0) return 0;
  return calcMonthlyPI(principal, annualRatePercent, termMonths / 12);
}

/**
 * Auto loan summary — total interest, total cost, monthly payment.
 * @param {number} vehiclePrice
 * @param {number} downPayment
 * @param {number} tradeInValue
 * @param {number} annualRatePercent
 * @param {number} termMonths
 * @returns {{ loanAmount, monthlyPayment, totalInterest, totalCost }}
 */
export function calcAutoLoanSummary(vehiclePrice, downPayment, tradeInValue, annualRatePercent, termMonths) {
  const loanAmount = Math.max(0, vehiclePrice - downPayment - tradeInValue);
  const monthlyPayment = calcMonthlyPayment(loanAmount, annualRatePercent, termMonths);
  const totalCost = monthlyPayment * termMonths;
  const totalInterest = Math.max(0, totalCost - loanAmount);
  return { loanAmount, monthlyPayment, totalInterest, totalCost };
}

/**
 * Compare multiple lenders side by side.
 * Ranks by total cost over the expected stay period.
 *
 * @param {Array<{name, ratePercent, points?, closingCredits?, originationFee?}>} lenders
 * @param {number} loanAmount
 * @param {number} termYears
 * @param {number} expectedStayYears
 * @param {number} opportunityRatePercent
 * @returns {Array<{...lender, monthlyPI, adjustedRate, pointsCost, upfrontCost, totalAt(years), totalAt5yr, totalAt10yr, totalAt30yr, breakEven, buyDown}>}
 */
export function compareLenders(lenders, loanAmount, termYears = 30, expectedStayYears = 10, opportunityRatePercent = 7) {
  if (!lenders?.length) return [];

  const results = lenders.map(lender => {
    const adjustedRate = calcRateAfterPoints(lender.ratePercent, lender.points || 0);
    const monthlyPI = calcMonthlyPI(loanAmount, adjustedRate, termYears);
    const pointsCost = calcPointsCost(loanAmount, lender.points || 0);

    // Monthly with no-points baseline for break-even
    const baseMonthly = calcMonthlyPI(loanAmount, lender.ratePercent, termYears);
    const monthlySavings = baseMonthly - monthlyPI;

    const hasPoints = (lender.points || 0) > 0;

    const breakEven = hasPoints
      ? calcPointsBreakEven(pointsCost, monthlySavings, opportunityRatePercent)
      : { simpleMonths: 0, adjustedMonths: 0, monthlySavings: 0, pointsCost: 0 };

    const buyDown = hasPoints
      ? calcBuyDownSignal(breakEven.adjustedMonths, expectedStayYears)
      : { signal: "green", label: "No points" };

    // Upfront costs: points + origination - credits
    const upfrontCost = pointsCost + (lender.originationFee || 0) - (lender.closingCredits || 0);

    // Total cost at various horizons
    const totalAt = (years) => upfrontCost + monthlyPI * Math.min(years, termYears) * 12;

    return {
      ...lender,
      adjustedRate,
      monthlyPI,
      pointsCost,
      upfrontCost,
      totalAt,
      totalAtStay: totalAt(expectedStayYears || 10),
      totalAt5yr: totalAt(5),
      totalAt10yr: totalAt(10),
      totalAt30yr: totalAt(termYears),
      breakEven,
      buyDown,
    };
  });

  // Rank by total cost at expected stay
  results.sort((a, b) => a.totalAtStay - b.totalAtStay);

  return results;
}
