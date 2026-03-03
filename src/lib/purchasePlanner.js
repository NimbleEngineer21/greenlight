// Purchase cost calculation — home closing costs, car costs, liquidation analysis
import { HOME_CLOSING_DEFAULTS } from "../data/closingCosts.js";
import { CAR_PURCHASE_DEFAULTS } from "../data/carCosts.js";

/**
 * Loan type for a given purchase category.
 * @param {"home"|"vehicle"} category
 * @returns {"mortgage"|"auto"}
 */
export function loanTypeForCategory(category) {
  return category === "home" ? "mortgage" : "auto";
}

/**
 * Compute itemized home closing costs.
 * @param {number} homePrice
 * @param {Object} overrides - { [key]: number } user amount overrides
 * @param {Object} paid - { [key]: true } which costs are already paid
 * @returns {{ items: Array<{key, label, amount, isOverridden, isPaid, isPercent}>, subtotal, paidTotal, unpaidTotal }}
 */
export function calcHomeCosts(homePrice, overrides = {}, paid = {}) {
  return calcCosts(HOME_CLOSING_DEFAULTS, homePrice, overrides, paid);
}

/**
 * Compute itemized car purchase costs.
 * @param {number} carPrice
 * @param {Object} overrides
 * @param {Object} paid
 * @returns {{ items, subtotal, paidTotal, unpaidTotal }}
 */
export function calcCarCosts(carPrice, overrides = {}, paid = {}) {
  return calcCosts(CAR_PURCHASE_DEFAULTS, carPrice, overrides, paid);
}

function calcCosts(defaults, price, overrides, paid) {
  const items = defaults.map(item => {
    const isOverridden = overrides[item.key] != null;
    const amount = isOverridden
      ? overrides[item.key]
      : item.percentOfPrice
        ? price * item.defaultPercent
        : item.default;
    return {
      key: item.key,
      label: item.label,
      amount: amount || 0,
      isOverridden,
      isPaid: !!paid[item.key],
      isPercent: !!item.percentOfPrice,
      range: item.range,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const paidTotal = items.filter(i => i.isPaid).reduce((s, i) => s + i.amount, 0);
  const unpaidTotal = subtotal - paidTotal;

  return { items, subtotal, paidTotal, unpaidTotal };
}

/**
 * Calculate down payment.
 * @param {number} price
 * @param {number} percent - e.g., 20 for 20%
 * @param {number|null} override - flat dollar override (null = use percent)
 * @returns {{ amount, percent, isOverridden }}
 */
export function calcDownPayment(price, percent, override = null) {
  if (override != null && override > 0) {
    return { amount: override, percent: price > 0 ? (override / price) * 100 : 0, isOverridden: true };
  }
  return { amount: price * (percent / 100), percent, isOverridden: false };
}

/**
 * Total cash still needed at closing (excludes already-paid costs).
 * @param {number} downPayment
 * @param {number} unpaidClosingCosts - from calcHomeCosts/calcCarCosts .unpaidTotal
 * @param {number} pointsCost - from mortgage points (0 if none)
 * @returns {{ downPayment, closingCosts, pointsCost, total }}
 */
export function calcTotalCashNeeded(downPayment, unpaidClosingCosts, pointsCost = 0) {
  return {
    downPayment,
    closingCosts: unpaidClosingCosts,
    pointsCost,
    total: downPayment + unpaidClosingCosts + pointsCost,
  };
}

/**
 * Liquidation analysis — can the user afford the purchase with current assets?
 * Uses calcSummary output to determine available cash from all sources.
 *
 * @param {number} cashNeeded - total cash needed from calcTotalCashNeeded
 * @param {Object} summary - result of calcSummary(state, prices)
 * @returns {{ canAfford, surplus, shortfall, cashContribution, assetContribution, retirementContribution, cashFlowContribution, totalAvailable }}
 */
export function calcLiquidationAnalysis(cashNeeded, summary) {
  const cashAvailable = summary.cashTotal || 0;
  // Net asset proceeds after fees and tax
  const assetProceeds = Math.max(0, (summary.totalNetProceeds || 0) - (summary.tax || 0));
  const retirementNet = summary.retirement?.net || 0;
  // Cash flow between now and sell date
  const cashFlowNet = summary.cashFlow?.net || 0;

  const totalAvailable = cashAvailable + assetProceeds + retirementNet + cashFlowNet;
  const surplus = totalAvailable - cashNeeded;

  return {
    canAfford: surplus >= 0,
    surplus: Math.max(0, surplus),
    shortfall: Math.max(0, -surplus),
    cashContribution: cashAvailable,
    assetContribution: assetProceeds,
    retirementContribution: retirementNet,
    cashFlowContribution: cashFlowNet,
    totalAvailable,
  };
}
