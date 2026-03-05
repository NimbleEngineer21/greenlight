/**
 * Conforming loan limit analysis — pure functions.
 *
 * Determines whether a mortgage is "jumbo" (exceeds the county-level FHFA
 * conforming loan limit) and calculates the rate/payment impact.
 */

import { getConformingLimit } from "../data/conformingLimits.js";
export { BASELINE_LIMIT } from "../data/conformingLimits.js";
import { calcMonthlyPI } from "./mortgageCalc.js";
export const DEFAULT_JUMBO_PREMIUM = 0.25; // percentage points above conforming rate

/**
 * Detect whether a loan is jumbo for a given zip code.
 * @param {number} loanAmount
 * @param {string|number} zipCode
 * @param {boolean} zipIsValid - whether the zip was found in the lookup data
 * @returns {{ isJumbo: boolean, conformingLimit: number, overage: number, zipFound: boolean }}
 */
export function detectJumbo(loanAmount, zipCode, zipIsValid = true) {
  const limit = getConformingLimit(zipCode);
  const overage = Math.max(0, loanAmount - limit);
  return {
    isJumbo: loanAmount > limit,
    conformingLimit: limit,
    loanAmount,
    overage,
    zipFound: zipIsValid,
  };
}

/**
 * Calculate the effective interest rate including jumbo premium.
 * @param {number} baseRatePercent - conforming market rate
 * @param {boolean} isJumbo
 * @param {number} [jumboSpreadPercent=0.25]
 * @returns {number}
 */
export function calcEffectiveRate(baseRatePercent, isJumbo, jumboSpreadPercent = DEFAULT_JUMBO_PREMIUM) {
  if (!isJumbo) return baseRatePercent;
  return baseRatePercent + jumboSpreadPercent;
}

/**
 * Calculate the down payment needed to stay under the conforming limit.
 * Returns null if the loan is already conforming.
 * @param {number} homePrice
 * @param {number} conformingLimit
 * @param {number} currentDownPercent
 * @returns {{ requiredDownPercent: number, requiredDownAmount: number, additionalDown: number } | null}
 */
export function calcConformingDown(homePrice, conformingLimit, currentDownPercent) {
  if (!homePrice || homePrice <= 0 || !conformingLimit) return null;

  const currentDown = homePrice * (currentDownPercent / 100);
  const currentLoan = homePrice - currentDown;
  if (currentLoan <= conformingLimit) return null;

  const requiredDown = homePrice - conformingLimit;
  const requiredDownPercent = Math.ceil((requiredDown / homePrice) * 1000) / 10; // round up to 0.1%

  return {
    requiredDownPercent,
    requiredDownAmount: requiredDown,
    additionalDown: requiredDown - currentDown,
  };
}

/**
 * Calculate the monthly payment impact of the jumbo rate premium.
 * @param {number} loanAmount
 * @param {number} baseRatePercent
 * @param {number} termYears
 * @param {number} [jumboSpreadPercent=0.25]
 * @returns {{ conformingPayment: number, jumboPayment: number, monthlyDiff: number, lifetimeDiff: number }}
 */
export function calcJumboImpact(loanAmount, baseRatePercent, termYears, jumboSpreadPercent = DEFAULT_JUMBO_PREMIUM) {
  const conformingPayment = calcMonthlyPI(loanAmount, baseRatePercent, termYears);
  const jumboPayment = calcMonthlyPI(loanAmount, baseRatePercent + jumboSpreadPercent, termYears);
  const monthlyDiff = jumboPayment - conformingPayment;

  return {
    conformingPayment,
    jumboPayment,
    monthlyDiff,
    lifetimeDiff: monthlyDiff * termYears * 12,
  };
}
