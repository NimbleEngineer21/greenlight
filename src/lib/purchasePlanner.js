// Purchase cost calculation — home closing costs, car costs, liquidation analysis
import { HOME_CLOSING_DEFAULTS } from "../data/closingCosts.js";
import { CAR_PURCHASE_DEFAULTS } from "../data/carCosts.js";
import { calcReadinessDate } from "./readiness.js";

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

// ─── Private helpers ──────────────────────────────────────────────────────────

function fmtShortfall(n) {
  const abs = Math.abs(n);
  if (abs < 1000) return `SHORTFALL -$${Math.round(abs)}`;
  return `SHORTFALL -$${Math.round(abs / 1000)}k`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

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

/**
 * Determine purchase readiness status and progress toward the green threshold.
 *
 * @param {object} purchase - state.purchase
 * @param {object} readiness - state.readiness
 * @param {{ cashNeeded, liquidation, monthlyExpenses, projections }} ctx
 *   cashNeeded     — result of calcTotalCashNeeded()
 *   liquidation    — result of calcLiquidationAnalysis()
 *   monthlyExpenses — from calcMonthlySavings().monthlyExpenses
 *   projections    — result of projectCashPosition() for ~N MOS AWAY badge, or null
 * @returns {{ status, greenThreshold, yellowThreshold, progress, badgeLabel } | null}
 *   Returns null when category is null or price is 0 (unconfigured)
 */
export function calcPurchaseReadinessStatus(purchase, readiness, {
  cashNeeded, liquidation, monthlyExpenses, projections,
}) {
  const { category, homePrice, carPrice, carMaintenanceAnnual } = purchase;
  const { reserveMonths = 6 } = readiness || {};

  if (!category) return null;
  if (category === "home" && homePrice <= 0) return null;
  if (category === "vehicle" && carPrice <= 0) return null;

  if (!cashNeeded || !liquidation) return null;
  const totalAvailable = liquidation.totalAvailable;
  const cashTotal = cashNeeded.total;

  let greenThreshold, yellowThreshold;
  if (category === "home") {
    const emergencyBuffer = Math.max(homePrice * 0.1, reserveMonths * monthlyExpenses);
    greenThreshold = cashTotal + emergencyBuffer;
    yellowThreshold = cashTotal;
  } else {
    const annualMaintenance = carMaintenanceAnnual ?? (carPrice * 0.015);
    greenThreshold = cashTotal + annualMaintenance;
    yellowThreshold = cashTotal;
  }

  if (greenThreshold <= 0) {
    return { status: "green", greenThreshold, yellowThreshold, progress: 1, badgeLabel: "READY" };
  }

  let status;
  if (totalAvailable >= greenThreshold) {
    status = "green";
  } else if (totalAvailable >= yellowThreshold) {
    status = "yellow";
  } else {
    status = "red";
  }

  const progress = Math.min(1, totalAvailable / greenThreshold);

  let badgeLabel;
  if (status === "green") {
    badgeLabel = "READY";
  } else if (status === "yellow") {
    badgeLabel = "ALMOST";
  } else {
    const readinessDate = projections ? calcReadinessDate(projections, greenThreshold) : null;
    if (readinessDate && readinessDate.month > 0) {
      badgeLabel = `~${readinessDate.month} MOS AWAY`;
    } else {
      badgeLabel = fmtShortfall(totalAvailable - greenThreshold);
    }
  }

  return { status, greenThreshold, yellowThreshold, progress, badgeLabel };
}
