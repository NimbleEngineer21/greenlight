import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { calcSummary, calcMonthlySavings, calcSavingsRate, fmt, fmtDate, fmtQty } from "../lib/calculations.js";
import { calcHomeCosts, calcCarCosts, calcDownPayment, calcTotalCashNeeded, calcLiquidationAnalysis, calcPurchaseReadinessStatus, loanTypeForCategory } from "../lib/purchasePlanner.js";
import { calcPointsCost } from "../lib/mortgageCalc.js";
import { projectCashPosition, calcReadinessDate } from "../lib/readiness.js";
import { RETIREMENT_ACCOUNT_TYPES } from "../data/defaults.js";
import { colors, SIGNAL_COLORS } from "../theme.js";

const NOW_MS = Date.now(); // module-level: stable across renders, day-precision is fine

function savingsRateColor(rate) {
  if (rate >= 0.2) return colors.green;
  if (rate >= 0.1) return colors.amber;
  return colors.red;
}
const labelSt = { fontSize: 13, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5 };
const ctaBtnStyle = {
  background: colors.bgButton, border: `1px solid ${colors.borderAccent}`, color: colors.blue,
  padding: "10px 20px", borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 15,
  fontWeight: 600, cursor: "pointer",
};

export default function Dashboard({ state, prices, setPrice, updateState }) {
  const c = useMemo(() => calcSummary(state, prices), [state, prices]);
  const monthly = useMemo(() => calcMonthlySavings(state.cashFlow), [state.cashFlow]);
  const navigate = useNavigate();

  const purchase = useMemo(() => state.purchase || {}, [state.purchase]);

  const projections = useMemo(
    () => purchase.category ? projectCashPosition(state, prices, 60) : null,
    [state, prices, purchase.category],
  );

  const statusCashNeeded = useMemo(() => {
    if (!purchase.category) return null;
    const isHome = purchase.category === "home";
    const price = isHome ? (purchase.homePrice || 0) : (purchase.carPrice || 0);
    if (price <= 0) return null;
    const dp = isHome
      ? calcDownPayment(price, purchase.downPaymentPercent || 20)
      : { amount: purchase.carDownPayment || 0 };
    const costs = isHome
      ? calcHomeCosts(price, purchase.closingCostOverrides, purchase.closingCostPaid)
      : calcCarCosts(price, purchase.carCostOverrides, purchase.carCostPaid);
    const pc = isHome
      ? calcPointsCost(price - dp.amount, state.mortgage?.pointsBought || 0, state.mortgage?.pointCostPercent || 1)
      : 0;
    return calcTotalCashNeeded(dp.amount, costs.unpaidTotal, pc);
  }, [purchase, state.mortgage]);

  const statusLiquidation = useMemo(
    () => statusCashNeeded ? calcLiquidationAnalysis(statusCashNeeded.total, c) : null,
    [statusCashNeeded, c],
  );

  const statusResult = useMemo(
    () => calcPurchaseReadinessStatus(purchase, state.readiness, {
      cashNeeded: statusCashNeeded,
      liquidation: statusLiquidation,
      monthlyExpenses: monthly.monthlyExpenses,
      projections,
    }),
    [purchase, state.readiness, statusCashNeeded, statusLiquidation, monthly.monthlyExpenses, projections],
  );

  const savingsRate = useMemo(
    () => calcSavingsRate(monthly.monthlyIncome, monthly.monthlyExpenses),
    [monthly.monthlyIncome, monthly.monthlyExpenses],
  );

  const statusColor = statusResult
    ? (SIGNAL_COLORS[statusResult.status] || colors.dim)
    : null;

  const exportDaysSince = useMemo(() => {
    if (!state.lastExportDate) return null;
    const last = new Date(state.lastExportDate + "T12:00:00");
    if (isNaN(last.getTime())) return null;
    return Math.floor((NOW_MS - last.getTime()) / 864e5);
  }, [state.lastExportDate]);

  const activatePlanning = (category) => {
    if (updateState) {
      updateState(prev => ({
        ...prev,
        purchase: { ...prev.purchase, category, loanType: loanTypeForCategory(category), takingLoan: true },
      }));
      navigate("/purchase");
    }
  };

  return (
    <div>
      {/* Summary Bar — top-level totals */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ background: `linear-gradient(135deg, ${colors.bgGradientStart}, ${colors.bgGradientEnd})`, border: statusColor ? `2px solid ${statusColor}66` : `2px solid ${colors.borderAccent}`, borderRadius: 10, padding: 20, boxShadow: statusColor ? `0 0 18px ${statusColor}33` : "none" }}>
          {(statusResult || savingsRate !== null) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              {statusResult && <StatusPill label={statusResult.badgeLabel} color={statusColor} />}
              {!statusResult && savingsRate !== null && (
                <StatusPill
                  label={`SAVING ${Math.round(savingsRate * 100)}%`}
                  color={savingsRateColor(savingsRate)}
                />
              )}
            </div>
          )}
          <div className="gl-summary-bar" style={{ gap: 18, textAlign: "center" }}>
            {[
              { l: "Gross Value", v: c.totalGross, clr: colors.dim, sz: 26 },
              { l: "Fees + Penalties + Tax", v: -(c.totalFees + c.tax + c.retirement.deductions), clr: colors.red, sz: 24 },
              { l: "Income − Expenses", v: c.cashFlow.net, clr: c.cashFlow.net >= 0 ? colors.green : colors.red, sz: 24 },
              { l: `NET CASH · ${fmtDate(c.sellDate)}`, v: c.totalLiquid, clr: colors.green, sz: 35 },
            ].map((t, i) => (
              <div key={i}>
                <div style={labelSt}>{t.l}</div>
                <div style={{ fontSize: t.sz, fontWeight: 700, color: t.clr, marginTop: 5 }}>{fmt(t.v)}</div>
              </div>
            ))}
          </div>
        </div>
        {statusResult && statusResult.status !== "green" && (
          <ReadinessProgressBar progress={statusResult.progress} color={statusColor} />
        )}
      </div>

      {/* Cash Flow Cards */}
      <div className="gl-cards-4" style={{ marginBottom: 18 }}>
        {[
          { l: "Paychecks", s: `${c.cashFlow.pays} × $${state.cashFlow.paycheckAmount.toLocaleString()}`, v: c.cashFlow.payTotal, clr: colors.green },
          { l: "Expenses", s: `${c.cashFlow.mortgageCount} months`, v: -c.cashFlow.expTotal, clr: colors.red },
          { l: "Obligations", s: "One-time", v: -c.cashFlow.obTotal, clr: colors.red },
          { l: "Net Cash Flow", s: fmtDate(c.sellDate), v: c.cashFlow.net, clr: c.cashFlow.net >= 0 ? colors.green : colors.red },
        ].map((b, i) => (
          <div key={i} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={labelSt}>{b.l}</div>
            <div style={{ fontSize: 14, color: colors.dim, marginTop: 3 }}>{b.s}</div>
            <div style={{ fontSize: 23, fontWeight: 700, color: b.clr, marginTop: 5 }}>{fmt(b.v)}</div>
          </div>
        ))}
      </div>

      {/* Monthly Savings Trajectory */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "14px 18px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={labelSt}>Monthly Trajectory</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: monthly.monthlySavings >= 0 ? colors.green : colors.red, marginTop: 4 }}>
            {monthly.monthlySavings >= 0 ? "+" : ""}{fmt(monthly.monthlySavings)}<span style={{ fontSize: 14, color: colors.dim, fontWeight: 400 }}>/mo</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 26, fontSize: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: colors.dim, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>Income</div>
            <div style={{ color: colors.green, fontWeight: 600 }}>{fmt(monthly.monthlyIncome)}<span style={{ color: colors.dim, fontWeight: 400 }}>/mo</span></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: colors.dim, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>Expenses</div>
            <div style={{ color: colors.red, fontWeight: 600 }}>{fmt(monthly.monthlyExpenses)}<span style={{ color: colors.dim, fontWeight: 400 }}>/mo</span></div>
          </div>
        </div>
      </div>

      {/* Asset Table */}
      <div className="gl-table-wrap" style={{ overflowX: "auto", marginBottom: 18 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
          <thead>
            <tr style={{ background: colors.bgHeader, borderBottom: `2px solid ${colors.border}` }}>
              {["Platform", "Asset", "Qty", "Price", "Gross", "Basis", "Gain/Loss", "Fees", "Net", ""].map(h => (
                <th key={h} style={{
                  padding: "10px 8px", textAlign: h === "Platform" || h === "Asset" ? "left" : "right",
                  color: colors.dim, fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Cash accounts */}
            {(state.cashAccounts || []).map((ca) => (
              <tr key={ca.id} style={{ borderBottom: "1px solid #0e1620" }}>
                <td style={{ padding: "8px" }}>{ca.platform}</td>
                <td>{ca.name}</td>
                <td colSpan={2} style={{ textAlign: "right", color: colors.dim }}>—</td>
                <td style={{ textAlign: "right", color: colors.green }}>{fmt(ca.balance)}</td>
                <td colSpan={3} style={{ textAlign: "right", color: colors.dim }}>—</td>
                <td style={{ textAlign: "right" }}>{fmt(ca.balance)}</td>
                <td style={{ textAlign: "right", color: colors.dim, fontSize: 13 }}>Cash</td>
              </tr>
            ))}

            {/* Assets */}
            {c.rows.map((a, i) => {
              const hasPrice = a.price > 0 || a.priceKey === null;
              const glColor = a.gainLoss > 0.01 ? colors.green : a.gainLoss < -0.01 ? colors.red : colors.dim;
              return (
                <tr key={a.id || i} style={{ borderBottom: "1px solid #0e1620", background: i % 2 ? colors.bgAlt : "transparent" }}>
                  <td style={{ padding: "8px", color: colors.dim, fontSize: 14 }}>{a.platform}</td>
                  <td>
                    {a.name}
                    {a.notes && <span title={a.notes} style={{ marginLeft: 4, fontSize: 12, color: colors.amber, cursor: "help", verticalAlign: "super" }}>★</span>}
                  </td>
                  <td style={{ textAlign: "right", color: colors.dim, fontSize: 14 }}>{a.priceKey === null ? "—" : fmtQty(a.quantity)}</td>
                  <td style={{ textAlign: "right" }}>
                    {a.priceKey === null ? "—" : (
                      <input type="number" step="any" value={prices[a.priceKey] ?? ""}
                        onChange={e => setPrice(a.priceKey, e.target.value)} placeholder="0"
                        style={{
                          width: 100, background: hasPrice ? colors.bgInput : "#1a1200",
                          border: `1px solid ${hasPrice ? colors.border : colors.amber}`,
                          color: colors.blue, textAlign: "right", padding: "3px 6px", borderRadius: 4,
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 14,
                        }}
                      />
                    )}
                  </td>
                  <td style={{ textAlign: "right", color: hasPrice ? colors.text : colors.dim }}>{fmt(a.gross)}</td>
                  <td style={{ textAlign: "right", color: colors.blue }}>{fmt(a.costBasis)}</td>
                  <td style={{ textAlign: "right", color: glColor, fontWeight: 600 }}>{fmt(a.gainLoss)}</td>
                  <td style={{ textAlign: "right", color: colors.dim, fontSize: 14 }}>{a.fee > 0.005 ? fmt(a.fee) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmt(a.net)}</td>
                  <td style={{ textAlign: "right", fontSize: 13, color: a.lt === true ? colors.green : a.lt === false ? colors.amber : colors.dim }}>
                    {a.lt === true ? "LT" : a.lt === false ? "ST" : "—"}
                  </td>
                </tr>
              );
            })}

            {/* Retirement account rows */}
            {state.retirement?.enabled && (c.retirement.accounts || []).map((acct, i) => (
              <tr key={acct.id || i} style={{ borderBottom: "1px solid #0e1620", background: colors.bgAlt }}>
                <td style={{ padding: "8px" }}>{acct.platform}</td>
                <td>{RETIREMENT_ACCOUNT_TYPES[acct.accountType] || acct.accountType}</td>
                <td colSpan={2} style={{ textAlign: "right", color: colors.dim, fontSize: 13 }}>
                  {Math.round((state.retirement.penaltyRate + state.retirement.taxRate + state.retirement.stateTaxRate) * 100)}%
                  {(acct.accountType === "roth_401k" || acct.accountType === "roth_ira") ? " (earnings)" : ""}
                </td>
                <td style={{ textAlign: "right" }}>{fmt(acct.balance)}</td>
                <td style={{ textAlign: "right", color: colors.red }}>{fmt(acct.deductions)}</td>
                <td style={{ textAlign: "right", color: colors.red }}>{fmt(-acct.deductions)}</td>
                <td style={{ textAlign: "right", color: colors.dim }}>—</td>
                <td style={{ textAlign: "right", color: colors.green, fontWeight: 600 }}>{fmt(acct.net)}</td>
                <td style={{ textAlign: "right", fontSize: 13, color: colors.dim }}>Ret</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Readiness Widget — only when planning is active */}
      {state.purchase?.category && <ReadinessWidget state={state} projections={projections} statusResult={statusResult} cashNeeded={statusCashNeeded} monthlyExpenses={monthly.monthlyExpenses} />}

      {/* Planning CTA */}
      {!state.purchase?.category && (
        <div style={{
          background: `linear-gradient(135deg, #0d1a2a, #0a1f35)`, border: `1px solid ${colors.borderAccent}`,
          borderRadius: 10, padding: "20px 26px", marginBottom: 18,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: colors.text }}>Planning a major purchase?</div>
            <div style={{ fontSize: 14, color: colors.dim, marginTop: 4 }}>
              Unlock mortgage calculators, closing cost estimates, lender comparison, and readiness projections.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => activatePlanning("home")} style={ctaBtnStyle}>Home</button>
            <button onClick={() => activatePlanning("vehicle")} style={ctaBtnStyle}>Car</button>
          </div>
        </div>
      )}

      {/* Export Reminder */}
      {exportDaysSince != null && exportDaysSince >= 30 && (
        <div style={{
          background: "rgba(245, 158, 11, 0.06)", borderLeft: `3px solid ${colors.amber}`,
          borderRadius: 4, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: colors.text,
        }}>
          Last backup was <strong style={{ color: colors.amber }}>{exportDaysSince} days ago</strong>.
          <span style={{ color: colors.dim }}> Export your data in Settings to keep it safe.</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ fontSize: 13, color: colors.footerDim, textAlign: "right" }}>
        Losses net before tax · Auto-refresh 15m
      </div>
    </div>
  );
}

function ReadinessWidget({ state, projections, statusResult, cashNeeded, monthlyExpenses }) {
  const purchase = state.purchase || {};
  const isHome = purchase.category === "home";
  const readiness = state.readiness || {};

  const reserveAmount = (readiness.reserveMonths || 6) * monthlyExpenses;
  const targetTotal = (cashNeeded?.total || 0) + reserveAmount;

  const readinessDate = useMemo(
    () => projections ? calcReadinessDate(projections, targetTotal) : null,
    [projections, targetTotal],
  );

  const isReady = readinessDate && readinessDate.month === 0;
  const label = isHome ? "Home purchase" : "Car purchase";
  const signalColor = statusResult
    ? (SIGNAL_COLORS[statusResult.status] || colors.dim)
    : isReady ? colors.green
    : readinessDate && readinessDate.month <= 12 ? colors.amber
    : colors.red;

  return (
    <Link to="/readiness" style={{ textDecoration: "none" }}>
      <div style={{
        background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: 8, padding: "14px 18px", marginBottom: 18,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        cursor: "pointer", transition: "border-color 0.2s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = colors.borderAccent}
        onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            display: "inline-block", width: 10, height: 10, borderRadius: "50%",
            background: signalColor, boxShadow: `0 0 8px ${signalColor}`,
          }} />
          <div>
            <div style={{ fontSize: 13, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: signalColor, marginTop: 2 }}>
              {isReady
                ? "Ready now"
                : readinessDate
                  ? `Ready in ~${readinessDate.month} months`
                  : "Not reachable in 5 years"}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: colors.dim }}>Target</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>{fmt(targetTotal)}</div>
        </div>
      </div>
    </Link>
  );
}

function StatusPill({ label, color }) {
  return (
    <span style={{
      background: `${color}22`, border: `1px solid ${color}55`,
      color, borderRadius: 20, padding: "3px 10px", fontSize: 11,
      fontWeight: 700, letterSpacing: 1.5,
    }}>
      {label}
    </span>
  );
}

function ReadinessProgressBar({ progress, color }) {
  return (
    <div style={{ height: 4, background: colors.bgButton, borderRadius: "0 0 10px 10px" }}>
      <div style={{
        height: "100%", width: `${Math.round(progress * 100)}%`,
        background: color, borderRadius: "0 0 10px 10px", transition: "width 0.3s ease",
      }} />
    </div>
  );
}
