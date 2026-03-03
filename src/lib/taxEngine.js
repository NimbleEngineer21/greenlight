// Progressive tax engine — replaces flat-rate capital gains tax with bracket-aware computation
// Uses "stacking method": ordinary income fills lower brackets, capital gains sit on top

import { getBrackets, NIIT_RATE } from "../data/taxBrackets.js";
import { calcStateTax, getStateRate } from "../data/stateTaxes.js";

/**
 * Compute progressive tax on ordinary income through brackets.
 * Returns { tax, effectiveRate, marginalRate, bracketBreakdown }
 */
export function calcOrdinaryIncomeTax(taxableIncome, year, filingStatus) {
  const config = getBrackets(year, filingStatus);
  let tax = 0;
  const breakdown = [];

  for (const bracket of config.brackets) {
    if (taxableIncome <= bracket.floor) break;
    const taxable = Math.min(taxableIncome, bracket.ceiling) - bracket.floor;
    const bracketTax = taxable * bracket.rate;
    tax += bracketTax;
    breakdown.push({ ...bracket, taxable, tax: bracketTax });
  }

  return {
    tax,
    effectiveRate: taxableIncome > 0 ? tax / taxableIncome : 0,
    marginalRate: breakdown.length > 0 ? breakdown[breakdown.length - 1].rate : 0,
    bracketBreakdown: breakdown,
  };
}

/**
 * Compute LTCG tax using the stacking method.
 * Ordinary income occupies lower brackets; LTCG "stacks" on top.
 * Returns { tax, effectiveRate, marginalRate }
 */
export function calcLTCGTax(ltcgAmount, ordinaryIncome, year, filingStatus) {
  if (ltcgAmount <= 0) return { tax: 0, effectiveRate: 0, marginalRate: 0 };

  const config = getBrackets(year, filingStatus);
  const ltcgBrackets = config.ltcgBrackets;

  // LTCG sits on top of ordinary income in the bracket stack
  const stackBottom = Math.max(0, ordinaryIncome);
  const stackTop = stackBottom + ltcgAmount;

  let tax = 0;
  for (const bracket of ltcgBrackets) {
    if (stackTop <= bracket.floor) break;
    if (stackBottom >= bracket.ceiling) continue;

    const effectiveFloor = Math.max(stackBottom, bracket.floor);
    const effectiveCeiling = Math.min(stackTop, bracket.ceiling);
    const taxable = effectiveCeiling - effectiveFloor;
    tax += taxable * bracket.rate;
  }

  return {
    tax,
    effectiveRate: ltcgAmount > 0 ? tax / ltcgAmount : 0,
    marginalRate: (() => {
      for (let i = ltcgBrackets.length - 1; i >= 0; i--) {
        if (stackTop > ltcgBrackets[i].floor) return ltcgBrackets[i].rate;
      }
      return 0;
    })(),
  };
}

/**
 * Compute NIIT (Net Investment Income Tax) — 3.8% on investment income
 * above the AGI threshold for the filing status.
 */
export function calcNIIT(investmentIncome, agi, year, filingStatus) {
  const config = getBrackets(year, filingStatus);
  const excess = agi - config.niitThreshold;
  if (excess <= 0) return 0;
  // NIIT applies to the lesser of: net investment income or AGI excess
  return Math.min(investmentIncome, excess) * NIIT_RATE;
}

/**
 * Full capital gains tax computation with netting rules.
 *
 * Takes the same gain/loss breakdown as calcSummary and returns
 * a complete tax result including federal + state + NIIT.
 *
 * @param {Object} params
 * @param {number} params.ltGains - Total long-term gains (positive)
 * @param {number} params.ltLosses - Total long-term losses (negative)
 * @param {number} params.stGains - Total short-term gains (positive)
 * @param {number} params.stLosses - Total short-term losses (negative)
 * @param {number} params.ordinaryIncome - W-2 + other ordinary income (pre-deduction)
 * @param {number} params.year - Tax year
 * @param {string} params.filingStatus - "single", "mfj", "mfs", "hoh"
 * @param {string} params.stateCode - Two-letter state code
 */
export function calcCapitalGainsTax({
  ltGains, ltLosses, stGains, stLosses,
  ordinaryIncome, year, filingStatus, stateCode,
}) {
  const config = getBrackets(year, filingStatus);

  // Step 1: Net within each category
  const netLT = ltGains + ltLosses;
  const netST = stGains + stLosses;
  const totalNetGainLoss = netLT + netST;

  // Step 2: Determine taxable income after standard deduction
  const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - config.standardDeduction);

  // Step 3: Calculate tax based on netting rules
  let federalTax = 0;
  let ltcgTaxResult = { tax: 0, effectiveRate: 0, marginalRate: 0 };
  let stcgTax = 0;
  let deductible = 0;

  if (totalNetGainLoss <= 0) {
    // Net loss — no cap gains tax. Up to $3,000 deductible against ordinary income.
    deductible = Math.min(3000, Math.abs(totalNetGainLoss));
    federalTax = 0;
  } else if (netLT >= 0 && netST >= 0) {
    // Both categories are net gains — tax each at its own rate
    ltcgTaxResult = calcLTCGTax(netLT, taxableOrdinaryIncome, year, filingStatus);
    // Short-term gains taxed as ordinary income at marginal rate
    stcgTax = calcSTCGTax(netST, taxableOrdinaryIncome, year, filingStatus);
    federalTax = ltcgTaxResult.tax + stcgTax;
  } else if (netLT < 0) {
    // LT losses offset ST gains first
    const remainingST = Math.max(0, netST + netLT);
    stcgTax = calcSTCGTax(remainingST, taxableOrdinaryIncome, year, filingStatus);
    federalTax = stcgTax;
  } else {
    // ST losses offset LT gains first
    const remainingLT = Math.max(0, netLT + netST);
    ltcgTaxResult = calcLTCGTax(remainingLT, taxableOrdinaryIncome, year, filingStatus);
    federalTax = ltcgTaxResult.tax;
  }

  // Step 4: NIIT
  const agi = ordinaryIncome + Math.max(0, totalNetGainLoss);
  const investmentIncome = Math.max(0, totalNetGainLoss);
  const niit = calcNIIT(investmentIncome, agi, year, filingStatus);

  // Step 5: State tax on capital gains (most states tax at ordinary income rates)
  const stateTaxOnGains = totalNetGainLoss > 0
    ? calcStateTax(stateCode, totalNetGainLoss, filingStatus)
    : 0;

  const totalTax = federalTax + niit + stateTaxOnGains;

  return {
    federalTax,
    ltcgTax: ltcgTaxResult.tax,
    ltcgEffectiveRate: ltcgTaxResult.effectiveRate,
    ltcgMarginalRate: ltcgTaxResult.marginalRate,
    stcgTax,
    niit,
    stateTax: stateTaxOnGains,
    totalTax,
    deductible,
    netLT,
    netST,
    totalNetGainLoss,
  };
}

/**
 * Compute STCG tax — short-term gains are taxed as ordinary income.
 * We find the marginal rate by "stacking" STCG on top of ordinary income.
 */
function calcSTCGTax(stcgAmount, taxableOrdinaryIncome, year, filingStatus) {
  if (stcgAmount <= 0) return 0;
  const config = getBrackets(year, filingStatus);

  // Tax on ordinary income alone
  let taxWithout = 0;
  for (const bracket of config.brackets) {
    if (taxableOrdinaryIncome <= bracket.floor) break;
    const taxable = Math.min(taxableOrdinaryIncome, bracket.ceiling) - bracket.floor;
    taxWithout += taxable * bracket.rate;
  }

  // Tax on ordinary income + STCG
  const combined = taxableOrdinaryIncome + stcgAmount;
  let taxWith = 0;
  for (const bracket of config.brackets) {
    if (combined <= bracket.floor) break;
    const taxable = Math.min(combined, bracket.ceiling) - bracket.floor;
    taxWith += taxable * bracket.rate;
  }

  return taxWith - taxWithout;
}

/**
 * Compute full tax picture for display — federal ordinary + cap gains + state.
 * Used by Dashboard to show bracket info.
 */
export function calcTaxSummary({
  ordinaryIncome, ltGains, ltLosses, stGains, stLosses,
  year, filingStatus, stateCode,
}) {
  const config = getBrackets(year, filingStatus);
  const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - config.standardDeduction);

  // Federal ordinary income tax
  const ordinaryTax = calcOrdinaryIncomeTax(taxableOrdinaryIncome, year, filingStatus);

  // Capital gains tax
  const capGains = calcCapitalGainsTax({
    ltGains, ltLosses, stGains, stLosses,
    ordinaryIncome, year, filingStatus, stateCode,
  });

  // State tax on ordinary income
  const stateOrdinaryTax = calcStateTax(stateCode, taxableOrdinaryIncome, filingStatus);
  const stateRates = getStateRate(stateCode, taxableOrdinaryIncome, filingStatus);

  return {
    standardDeduction: config.standardDeduction,
    taxableOrdinaryIncome,
    ordinaryTax,
    capGains,
    stateOrdinaryTax,
    stateEffectiveRate: stateRates.effective,
    stateMarginalRate: stateRates.marginal,
    totalFederalTax: ordinaryTax.tax + capGains.federalTax + capGains.niit,
    totalStateTax: stateOrdinaryTax + capGains.stateTax,
    totalTax: ordinaryTax.tax + capGains.totalTax + stateOrdinaryTax,
  };
}
