import { useMemo } from "react";
import { colors, styles } from "../theme.js";
import { fmt, calcMonthlySavings } from "../lib/calculations.js";
import { calcHomeCosts, calcCarCosts, calcDownPayment, calcTotalCashNeeded } from "../lib/purchasePlanner.js";
import { calcPointsCost } from "../lib/mortgageCalc.js";
import { projectCashPosition, calcReadinessDate, calcSTtoLTSavings } from "../lib/readiness.js";
import ReadinessTimeline from "../components/ReadinessTimeline.jsx";

const cardSt = styles.card;

export default function Readiness({ state, updateState, prices }) {
  const readiness = state.readiness || {};
  const purchase = state.purchase || {};
  const mortgage = state.mortgage || {};
  const isHome = purchase.category === "home";

  // Calculate target cash needed (matches PurchasePlanning.jsx logic)
  const price = isHome ? (purchase.homePrice || 0) : (purchase.carPrice || 0);
  const dp = useMemo(() => {
    if (isHome) return calcDownPayment(price, purchase.downPaymentPercent || 20);
    return { amount: purchase.carDownPayment || 0, percent: price > 0 ? ((purchase.carDownPayment || 0) / price * 100) : 0 };
  }, [isHome, price, purchase.downPaymentPercent, purchase.carDownPayment]);

  const costs = useMemo(() => {
    if (isHome) return calcHomeCosts(price, purchase.closingCostOverrides, purchase.closingCostPaid);
    return calcCarCosts(price, purchase.carCostOverrides, purchase.carCostPaid);
  }, [isHome, price, purchase.closingCostOverrides, purchase.closingCostPaid, purchase.carCostOverrides, purchase.carCostPaid]);

  const pointsCost = useMemo(
    () => isHome ? calcPointsCost(price - dp.amount, mortgage.pointsBought || 0, mortgage.pointCostPercent || 1) : 0,
    [isHome, price, dp.amount, mortgage.pointsBought, mortgage.pointCostPercent],
  );

  const cashNeeded = useMemo(
    () => purchase.takingLoan
      ? calcTotalCashNeeded(dp.amount, costs.unpaidTotal, pointsCost)
      : calcTotalCashNeeded(price, costs.unpaidTotal, 0),
    [purchase.takingLoan, dp.amount, price, costs.unpaidTotal, pointsCost],
  );

  // Reserve amount
  const monthly = useMemo(() => calcMonthlySavings(state.cashFlow), [state.cashFlow]);
  const reserveAmount = (readiness.reserveMonths || 6) * monthly.monthlyExpenses;
  const targetTotal = cashNeeded.total + reserveAmount;

  // Projections
  const projections = useMemo(
    () => projectCashPosition(state, prices, 60),
    [state, prices],
  );

  const readinessDate = useMemo(
    () => calcReadinessDate(projections, targetTotal),
    [projections, targetTotal],
  );

  const currentAvailable = projections[0]?.totalAvailable || 0;
  const gap = targetTotal - currentAvailable;
  const isReady = gap <= 0;

  // ST→LT savings
  const stltSavings = useMemo(
    () => calcSTtoLTSavings(state.assets, prices, state.taxConfig),
    [state.assets, prices, state.taxConfig],
  );

  // Target purchase date → month offset
  const targetPurchaseDate = purchase.targetPurchaseDate || "";
  const targetMonth = useMemo(() => {
    if (!targetPurchaseDate) return null;
    const target = new Date(targetPurchaseDate + "T12:00:00");
    const now = new Date();
    return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth());
  }, [targetPurchaseDate]);

  // Timeline markers
  const markers = useMemo(() => {
    const m = [];
    if (targetMonth != null && targetMonth <= 60) {
      m.push({ month: targetMonth, label: "Target", type: "target" });
    }
    for (const s of stltSavings) {
      const ltMonth = Math.ceil(s.daysUntilLT / 30);
      if (ltMonth <= 60) m.push({ month: ltMonth, label: `${s.symbol} → LT`, type: "ltDate" });
    }
    for (const ob of (state.cashFlow.oneTimeObligations || [])) {
      if (ob.isPaid) continue;
      const due = new Date(ob.dueDate + "T12:00:00");
      const now = new Date();
      const monthsAway = Math.max(0, (due.getFullYear() - now.getFullYear()) * 12 + due.getMonth() - now.getMonth());
      if (monthsAway <= 60) m.push({ month: monthsAway, label: ob.name, type: "obligation" });
    }
    return m;
  }, [targetMonth, stltSavings, state.cashFlow.oneTimeObligations]);

  const signal = isReady ? "green"
    : readinessDate && readinessDate.month <= 12 ? "amber"
    : "red";

  // "What if" handlers
  const setReadiness = (key, val) => {
    updateState(prev => ({
      ...prev,
      readiness: { ...prev.readiness, [key]: val },
    }));
  };

  if (!purchase.category) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: colors.textBright, marginBottom: 12 }}>Purchase Readiness</div>
        <div style={{ color: colors.dim }}>Activate purchase planning from the Dashboard to use readiness projections.</div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={styles.pageTitle}>Purchase Readiness</h1>

      {/* Hero: You need / You have / Gap */}
      <div style={{
        ...cardSt,
        marginTop: 16, marginBottom: 18,
        background: `linear-gradient(135deg, ${colors.bgGradientStart}, ${colors.bgGradientEnd})`,
        border: `2px solid ${isReady ? colors.green : colors.borderAccent}`,
      }}>
        <div className="gl-cards-3" style={{ gap: 24, textAlign: "center" }}>
          <div>
            <div style={styles.labelCompact}>You Need</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colors.text, marginTop: 4 }}>{fmt(targetTotal)}</div>
            <div style={{ fontSize: 12, color: colors.dim, marginTop: 2 }}>
              {fmt(cashNeeded.total)} purchase + {fmt(reserveAmount)} reserves
            </div>
          </div>
          <div>
            <div style={styles.labelCompact}>You Have</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colors.blue, marginTop: 4 }}>{fmt(currentAvailable)}</div>
            <div style={{ fontSize: 12, color: colors.dim, marginTop: 2 }}>
              Cash + assets after fees & tax
            </div>
          </div>
          <div>
            <div style={styles.labelCompact}>{isReady ? "Surplus" : "Gap"}</div>
            <div style={{
              fontSize: 28, fontWeight: 700, marginTop: 4,
              color: isReady ? colors.green : colors.red,
            }}>
              {isReady ? fmt(Math.abs(gap)) : fmt(gap)}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: isReady ? colors.green : colors.amber }}>
              {isReady
                ? "Funds available"
                : readinessDate
                  ? `Estimated by ${readinessDate.date}`
                  : "Not estimated within 5 years"}
            </div>
            {targetPurchaseDate && !isReady && readinessDate && targetMonth != null && (
              <div style={{ fontSize: 12, color: readinessDate.month <= targetMonth ? colors.green : colors.red, marginTop: 4 }}>
                {readinessDate.month <= targetMonth
                  ? `On track for ${targetPurchaseDate} target`
                  : `${readinessDate.month - targetMonth} months behind target`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ ...cardSt, marginBottom: 18 }}>
        <div style={{ ...styles.sectionTitle, marginBottom: 8 }}>TIMELINE</div>
        <ReadinessTimeline
          readinessMonth={readinessDate?.month || null}
          totalMonths={60}
          markers={markers}
          signal={signal}
        />
      </div>

      {/* Projection Table + What-if side by side */}
      <div className="gl-cards-2" style={{ gap: 12, marginBottom: 18, alignItems: "start" }}>
        {/* Monthly Projection */}
        <div style={cardSt}>
          <div style={{ ...styles.sectionTitle, marginBottom: 10 }}>MONTHLY PROJECTION</div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  {["Month", "Date", "Cash", "Assets", "Total"].map(h => (
                    <th key={h} style={{
                      padding: "6px 8px", textAlign: h === "Month" || h === "Date" ? "left" : "right",
                      color: colors.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1,
                      position: "sticky", top: 0, background: colors.card,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projections.filter((_, i) => i % 3 === 0 || i <= 6).map(p => {
                  const meetsTarget = p.totalAvailable >= targetTotal;
                  return (
                    <tr key={p.month} style={{
                      borderBottom: `1px solid ${colors.border}`,
                      background: meetsTarget ? colors.greenGlow : "transparent",
                    }}>
                      <td style={{ padding: "5px 8px", color: colors.dim }}>{p.month}</td>
                      <td style={{ padding: "5px 8px" }}>{p.date}</td>
                      <td style={{ textAlign: "right", color: colors.text }}>{fmt(p.cashPosition)}</td>
                      <td style={{ textAlign: "right", color: colors.blue }}>{fmt(p.assetValue)}</td>
                      <td style={{
                        textAlign: "right", fontWeight: 600,
                        color: meetsTarget ? colors.green : colors.text,
                      }}>{fmt(p.totalAvailable)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* What-if Controls */}
        <div>
          <div style={cardSt}>
            <div style={{ ...styles.sectionTitle, marginBottom: 12 }}>WHAT IF</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={styles.labelCompact}>Income growth rate (%/year)</div>
                <input
                  type="number" step="0.5" min="0" max="50"
                  value={readiness.incomeGrowthRate || 0}
                  onChange={e => setReadiness("incomeGrowthRate", parseFloat(e.target.value) || 0)}
                  style={styles.input}
                />
                <div style={{ fontSize: 11, color: colors.dim, marginTop: 2 }}>
                  0% = no growth assumption (conservative)
                </div>
              </div>
              <div>
                <div style={styles.labelCompact}>Asset appreciation rate (%/year)</div>
                <input
                  type="number" step="0.5" min="0" max="50"
                  value={readiness.assetAppreciationRate || 0}
                  onChange={e => setReadiness("assetAppreciationRate", parseFloat(e.target.value) || 0)}
                  style={styles.input}
                />
                <div style={{ fontSize: 11, color: colors.dim, marginTop: 2 }}>
                  0% = flat asset values (no speculation)
                </div>
              </div>
              <div>
                <div style={styles.labelCompact}>Reserve months</div>
                <input
                  type="number" step="1" min="0" max="24"
                  value={readiness.reserveMonths ?? 6}
                  onChange={e => setReadiness("reserveMonths", parseInt(e.target.value) || 0)}
                  style={styles.input}
                />
                <div style={{ fontSize: 11, color: colors.dim, marginTop: 2 }}>
                  Months of expenses kept as emergency fund ({fmt(monthly.monthlyExpenses)}/mo)
                </div>
              </div>
            </div>
          </div>

          {/* Cash Needed Breakdown */}
          <div style={{ ...cardSt, marginTop: 12 }}>
            <div style={{ ...styles.sectionTitle, marginBottom: 10 }}>CASH NEEDED BREAKDOWN</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 16px", fontSize: 14 }}>
              <span style={{ color: colors.dim }}>Down payment:</span>
              <span style={{ textAlign: "right" }}>{fmt(cashNeeded.downPayment)}</span>
              <span style={{ color: colors.dim }}>Closing costs:</span>
              <span style={{ textAlign: "right" }}>{fmt(cashNeeded.closingCosts)}</span>
              {cashNeeded.pointsCost > 0 && (
                <>
                  <span style={{ color: colors.dim }}>Points:</span>
                  <span style={{ textAlign: "right" }}>{fmt(cashNeeded.pointsCost)}</span>
                </>
              )}
              <span style={{ color: colors.dim }}>Reserves ({readiness.reserveMonths || 6} mo):</span>
              <span style={{ textAlign: "right" }}>{fmt(reserveAmount)}</span>
              <div style={{ gridColumn: "1/3", borderTop: `1px solid ${colors.border}`, margin: "4px 0" }} />
              <span style={{ color: colors.textBright, fontWeight: 700 }}>Total:</span>
              <span style={{ textAlign: "right", fontWeight: 700, color: colors.textBright, fontSize: 16 }}>{fmt(targetTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ST → LT Tax Savings */}
      {stltSavings.length > 0 && (
        <div style={{ ...cardSt, marginBottom: 18 }}>
          <div style={{ ...styles.sectionTitle, marginBottom: 10 }}>
            ST → LT TAX SAVINGS (WAITING BENEFITS)
          </div>
          <div style={{ fontSize: 12, color: colors.dim, marginBottom: 10 }}>
            These short-term assets become long-term on the dates below, reducing tax by ~9% on gains.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {["Asset", "LT Date", "Days", "Gain", "ST Tax", "LT Tax", "Savings"].map(h => (
                  <th key={h} style={{
                    padding: "6px 8px", textAlign: h === "Asset" ? "left" : "right",
                    color: colors.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stltSavings.map((s, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: "5px 8px" }}>{s.name}</td>
                  <td style={{ textAlign: "right" }}>{s.ltDate}</td>
                  <td style={{ textAlign: "right", color: s.daysUntilLT <= 90 ? colors.green : colors.dim }}>{s.daysUntilLT}d</td>
                  <td style={{ textAlign: "right", color: colors.green }}>{fmt(s.gainLoss)}</td>
                  <td style={{ textAlign: "right", color: colors.red }}>{fmt(s.stTax)}</td>
                  <td style={{ textAlign: "right", color: colors.amber }}>{fmt(s.ltTax)}</td>
                  <td style={{ textAlign: "right", color: colors.green, fontWeight: 600 }}>{fmt(s.savings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ fontSize: 12, color: colors.footerDim, textAlign: "right" }}>
        Estimates use current prices and tax rates · For illustration only · Growth assumptions are opt-in
      </div>
    </div>
  );
}
