import { useMemo } from "react";
import { Link } from "react-router-dom";
import { colors, styles } from "../theme.js";
import { fmt, calcSummary } from "../lib/calculations.js";
import { calcHomeCosts, calcCarCosts, calcDownPayment, calcTotalCashNeeded, calcLiquidationAnalysis, loanTypeForCategory } from "../lib/purchasePlanner.js";
import { calcPointsCost } from "../lib/mortgageCalc.js";
import { detectJumbo } from "../lib/loanLimits.js";
import { track } from "../lib/analytics.js";

const makeUpdater = (updateState, section) => (key, val) => {
  updateState(prev => ({ ...prev, [section]: { ...prev[section], [key]: val } }));
};

export default function PurchasePlanning({ state, updateState, prices }) {
  const purchase = state.purchase || {};
  const mortgage = state.mortgage || {};
  const category = purchase.category;
  const isHome = category === "home";
  const isVehicle = category === "vehicle";

  const updatePurchase = makeUpdater(updateState, "purchase");

  const setCategory = (cat) => {
    updateState(prev => ({
      ...prev,
      purchase: { ...prev.purchase, category: cat, loanType: loanTypeForCategory(cat), takingLoan: true },
    }));
    track("planning_mode_switch", { category: cat });
  };

  // Price + down payment
  const price = isHome ? (purchase.homePrice || 0) : (purchase.carPrice || 0);

  const downPayment = useMemo(() => {
    if (isHome) return calcDownPayment(price, purchase.downPaymentPercent || 20);
    return { amount: purchase.carDownPayment || 0, percent: price > 0 ? ((purchase.carDownPayment || 0) / price * 100) : 0, isOverridden: false };
  }, [isHome, price, purchase.downPaymentPercent, purchase.carDownPayment]);

  // Cost calculations (for total cash needed — costs display moves to Loans page)
  const costs = useMemo(() => {
    if (!category) return { items: [], subtotal: 0, paidTotal: 0, unpaidTotal: 0 };
    if (isHome) return calcHomeCosts(price, purchase.closingCostOverrides || {}, purchase.closingCostPaid || {});
    return calcCarCosts(price, purchase.carCostOverrides || {}, purchase.carCostPaid || {});
  }, [category, isHome, price, purchase.closingCostOverrides, purchase.closingCostPaid, purchase.carCostOverrides, purchase.carCostPaid]);

  const pointsCost = useMemo(
    () => isHome ? calcPointsCost(price - downPayment.amount, mortgage.pointsBought || 0, mortgage.pointCostPercent || 1) : 0,
    [isHome, price, downPayment.amount, mortgage.pointsBought, mortgage.pointCostPercent],
  );

  const cashNeeded = useMemo(
    () => purchase.takingLoan
      ? calcTotalCashNeeded(downPayment.amount, costs.unpaidTotal, pointsCost)
      : calcTotalCashNeeded(price, costs.unpaidTotal, 0),
    [purchase.takingLoan, downPayment.amount, price, costs.unpaidTotal, pointsCost],
  );

  // Liquidation analysis
  const summary = useMemo(() => calcSummary(state, prices), [state, prices]);
  const liquidation = useMemo(
    () => calcLiquidationAnalysis(cashNeeded.total, summary),
    [cashNeeded.total, summary],
  );

  if (!category) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: colors.textBright, marginBottom: 12 }}>
          Purchase Planning
        </div>
        <div style={{ color: colors.dim, fontSize: 14, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
          Activate purchase planning from the Dashboard by clicking "Planning a major purchase?" to get started.
        </div>
      </div>
    );
  }

  const affordColor = liquidation.canAfford
    ? (liquidation.surplus > cashNeeded.total * 0.1 ? colors.green : colors.amber)
    : colors.red;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1 }}>
          PURCHASE PLANNING
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setCategory("home")}
            style={{ ...styles.btn, color: isHome ? colors.green : colors.dim, borderColor: isHome ? colors.green : colors.border }}
          >
            Home
          </button>
          <button
            onClick={() => setCategory("vehicle")}
            style={{ ...styles.btn, color: isVehicle ? colors.green : colors.dim, borderColor: isVehicle ? colors.green : colors.border }}
          >
            Car
          </button>
        </div>
      </div>

      {/* What Are You Buying? */}
      <div style={styles.cardSection}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 10, letterSpacing: 1.5 }}>
          {isHome ? "HOME PURCHASE" : "VEHICLE PURCHASE"}
        </div>

        {/* Description + Target Date */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={styles.labelCompact}>Description (optional)</div>
            <input
              type="text"
              value={purchase.description || ""}
              onChange={e => updatePurchase("description", e.target.value)}
              placeholder={isHome ? "e.g., 3BR/2BA ranch in Chapel Hill" : "e.g., 2024 Toyota RAV4 Hybrid"}
              style={{ ...styles.input, width: "100%" }}
            />
          </div>
          <div>
            <div style={styles.labelCompact}>Target closing date</div>
            <input
              type="date"
              value={purchase.targetPurchaseDate || ""}
              onChange={e => updatePurchase("targetPurchaseDate", e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        {/* Price + Down Payment */}
        <div style={{ display: "grid", gridTemplateColumns: isHome ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <div style={styles.labelCompact}>{isHome ? "Home Price" : "Vehicle Price"}</div>
            <input
              type="number" step="1000"
              value={price || ""}
              onChange={e => updatePurchase(isHome ? "homePrice" : "carPrice", parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
          {isHome ? (
            <>
              <div>
                <div style={styles.labelCompact}>Down Payment %</div>
                <input
                  type="number" step="1" min="0" max="100"
                  value={purchase.downPaymentPercent ?? 20}
                  onChange={e => updatePurchase("downPaymentPercent", parseFloat(e.target.value) || 0)}
                  style={styles.input}
                />
              </div>
              <div>
                <div style={styles.labelCompact}>Down Payment $</div>
                <div style={{ ...styles.input, background: colors.bgAlt, display: "flex", alignItems: "center" }}>
                  {fmt(downPayment.amount)}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div style={styles.labelCompact}>Down Payment $</div>
              <input
                type="number" step="100"
                value={purchase.carDownPayment ?? 0}
                onChange={e => updatePurchase("carDownPayment", parseFloat(e.target.value) || 0)}
                style={styles.input}
              />
            </div>
          )}
        </div>

        {isVehicle && (
          <div style={{ marginTop: 12 }}>
            <div style={styles.labelCompact}>Annual Maintenance Estimate</div>
            <input
              type="number" step="100"
              value={purchase.carMaintenanceAnnual ?? ""}
              placeholder={`$${Math.round(purchase.carMaintenanceAnnual ?? (price * 0.015))} (auto)`}
              onChange={e => updatePurchase("carMaintenanceAnnual", e.target.value === "" ? null : Number(e.target.value))}
              style={styles.input}
            />
            <div style={{ fontSize: 12, color: colors.dim, marginTop: 4 }}>
              Leave blank to use auto-derived (vehicle price × 1.5%). Used for the green readiness threshold.
            </div>
          </div>
        )}
      </div>

      {/* Will You Take a Loan? */}
      <div style={styles.cardSection}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 10, letterSpacing: 1.5 }}>
          FINANCING
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: purchase.takingLoan ? 14 : 0 }}>
          <div style={styles.labelCompact}>Taking a loan?</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => updatePurchase("takingLoan", true)}
              style={{
                ...styles.btn, fontSize: 12, padding: "4px 12px",
                color: purchase.takingLoan ? colors.green : colors.dim,
                borderColor: purchase.takingLoan ? colors.green : colors.border,
              }}
            >
              Yes
            </button>
            <button
              onClick={() => updatePurchase("takingLoan", false)}
              style={{
                ...styles.btn, fontSize: 12, padding: "4px 12px",
                color: !purchase.takingLoan ? colors.green : colors.dim,
                borderColor: !purchase.takingLoan ? colors.green : colors.border,
              }}
            >
              No
            </button>
          </div>
        </div>

        {purchase.takingLoan && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={styles.labelCompact}>Loan Type</div>
                <div style={{ ...styles.input, background: colors.bgAlt, display: "flex", alignItems: "center" }}>
                  {isHome ? "Mortgage" : "Auto Loan"}
                </div>
              </div>
              <div>
                <div style={styles.labelCompact}>Financing %</div>
                <div style={{ ...styles.input, background: colors.bgAlt, display: "flex", alignItems: "center" }}>
                  {isHome
                    ? (100 - (purchase.downPaymentPercent || 20)).toFixed(0)
                    : (price > 0 ? Math.max(0, (price - (purchase.carDownPayment || 0)) / price * 100).toFixed(0) : 0)}%
                </div>
              </div>
            </div>

            {/* Jumbo Notice */}
            {isHome && (() => {
              const zip = purchase.zipCode;
              if (!zip || zip.length !== 5) return null;
              const loanAmt = price - downPayment.amount;
              const jumbo = detectJumbo(loanAmt, zip);
              if (!jumbo.isJumbo) return null;
              return (
                <div style={{
                  background: "rgba(245, 158, 11, 0.06)", borderLeft: `3px solid ${colors.amber}`,
                  borderRadius: 6, padding: 12, marginBottom: 12, fontSize: 13, color: colors.text,
                }}>
                  Loan exceeds the {fmt(jumbo.conformingLimit)} conforming limit by {fmt(jumbo.overage)}.
                  Consider increasing the down payment on the Loans page.
                </div>
              );
            })()}

            <Link to="/loans" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              color: colors.blue, fontSize: 13, textDecoration: "none",
            }}>
              Configure loan details & closing costs →
            </Link>
          </div>
        )}
      </div>

      {/* Total Cash Needed Summary */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.card} 0%, ${colors.gradientDark} 100%)`,
        border: `1px solid ${colors.borderAccent}`,
        borderRadius: 8, padding: 18, marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 12, letterSpacing: 1.5 }}>
          TOTAL CASH NEEDED
        </div>
        <div style={{ display: "grid", gridTemplateColumns: purchase.takingLoan && isHome && pointsCost > 0 ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>{purchase.takingLoan ? "Down Payment" : "Purchase Price"}</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(cashNeeded.downPayment)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>{isHome ? "Closing Costs" : "Purchase Costs"}</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(cashNeeded.closingCosts)}</div>
          </div>
          {purchase.takingLoan && isHome && pointsCost > 0 && (
            <div style={{ textAlign: "center" }}>
              <div style={styles.labelCompact}>Points</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(cashNeeded.pointsCost)}</div>
            </div>
          )}
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Total</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: colors.green }}>{fmt(cashNeeded.total)}</div>
          </div>
        </div>
      </div>

      {/* Liquidation Analysis — Can You Afford It? */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 12, letterSpacing: 1.5 }}>
          CAN YOU AFFORD IT?
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Cash</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(liquidation.cashContribution)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Asset Proceeds</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(liquidation.assetContribution)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Cash Flow</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(liquidation.cashFlowContribution)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Retirement</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(liquidation.retirementContribution)}</div>
          </div>
        </div>

        <div style={{
          borderTop: `2px solid ${colors.border}`, paddingTop: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={styles.labelCompact}>Total Available</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(liquidation.totalAvailable)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={styles.labelCompact}>{liquidation.canAfford ? "Surplus" : "Shortfall"}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: affordColor }}>
              {liquidation.canAfford ? fmt(liquidation.surplus) : `(${fmt(liquidation.shortfall).replace("$", "")})`}
            </div>
          </div>
        </div>

        {!liquidation.canAfford && (
          <div style={{ fontSize: 13, color: colors.amber, marginTop: 10 }}>
            You need {fmt(liquidation.shortfall)} more to cover this purchase at current asset values.
          </div>
        )}
      </div>
    </div>
  );
}
