import { useState, useEffect, useMemo } from "react";
import { colors, styles, SIGNAL_COLORS, SIGNAL_BG } from "../theme.js";
import { fmt } from "../lib/calculations.js";
import { calcDownPayment, calcHomeCosts, calcCarCosts } from "../lib/purchasePlanner.js";
import {
  calcMonthlyPI, calcAmortizationSchedule, calcPMI, calcPMIDropoffMonth,
  calcTotalMonthly, calcPointsCost, calcRateAfterPoints, calcPointsBreakEven,
  calcBuyDownSignal, calcAutoLoanSummary,
} from "../lib/mortgageCalc.js";
import { detectJumbo, calcEffectiveRate } from "../lib/loanLimits.js";
import { getCachedMortgageRates } from "../lib/fred.js";
import { useZipLookup } from "../hooks/useZipLookup.js";
import AmortizationTable from "../components/AmortizationTable.jsx";
import RateChart from "../components/RateChart.jsx";
import ConformingStatus from "../components/ConformingStatus.jsx";
import CostBreakdown from "../components/CostBreakdown.jsx";

const makeUpdater = (updateState, section) => (key, val) => {
  updateState(prev => ({ ...prev, [section]: { ...prev[section], [key]: val } }));
};

export default function LoansCalc({ state, updateState }) {
  const purchase = state.purchase || {};
  const mortgage = state.mortgage || {};
  const autoLoan = state.autoLoan || {};
  const category = purchase.category;
  const loanType = purchase.loanType || (category === "home" ? "mortgage" : "auto");
  const isMortgage = loanType === "mortgage";

  const [rates, setRates] = useState([]);
  const [rateSeries, setRateSeries] = useState("MORTGAGE30US");
  const { lookup: zipLookup } = useZipLookup();

  useEffect(() => {
    if (isMortgage) {
      getCachedMortgageRates(rateSeries)
        .then(data => setRates(data || []))
        .catch(err => {
          console.error("[LoansCalc] Failed to load cached mortgage rates:", err);
          setRates([]);
        });
    }
  }, [isMortgage, rateSeries]);

  const updateMortgage = makeUpdater(updateState, "mortgage");
  const updateAutoLoan = makeUpdater(updateState, "autoLoan");
  const updatePurchase = makeUpdater(updateState, "purchase");

  // --- Cost breakdown handlers ---
  const onOverride = (key, val) => {
    const field = isMortgage ? "closingCostOverrides" : "carCostOverrides";
    updatePurchase(field, { ...(purchase[field] || {}), [key]: val });
  };
  const onTogglePaid = (key) => {
    const field = isMortgage ? "closingCostPaid" : "carCostPaid";
    const current = purchase[field] || {};
    const next = { ...current };
    if (next[key]) delete next[key]; else next[key] = true;
    updatePurchase(field, next);
  };

  if (!category || !purchase.takingLoan) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: colors.textBright, marginBottom: 12 }}>Loan Calculator</div>
        <div style={{ color: colors.dim, fontSize: 14 }}>
          {!category
            ? "Activate purchase planning from the Dashboard to use this tool."
            : "Enable loan financing on the Purchase page to configure loan details."}
        </div>
      </div>
    );
  }

  if (isMortgage) {
    return <MortgageView
      purchase={purchase} mortgage={mortgage} rates={rates} rateSeries={rateSeries}
      setRateSeries={setRateSeries} updateMortgage={updateMortgage} updatePurchase={updatePurchase}
      zipLookup={zipLookup} onOverride={onOverride} onTogglePaid={onTogglePaid}
    />;
  }

  return <AutoLoanView
    purchase={purchase} autoLoan={autoLoan}
    updateAutoLoan={updateAutoLoan}
    onOverride={onOverride} onTogglePaid={onTogglePaid}
  />;
}

// ─── Mortgage View ──────────────────────────────────────────────────────────

function MortgageView({
  purchase, mortgage, rates, rateSeries, setRateSeries,
  updateMortgage, updatePurchase, zipLookup, onOverride, onTogglePaid,
}) {
  const homePrice = purchase.homePrice || 0;
  const dp = calcDownPayment(homePrice, purchase.downPaymentPercent || 20);
  const loanAmount = homePrice - dp.amount;

  const rate = mortgage.ratePercent || 0;
  const term = mortgage.termYears || 30;
  const points = mortgage.pointsBought || 0;
  const jumboSpread = mortgage.jumboSpreadPercent ?? 0.25;

  const zipCode = purchase.zipCode || "";
  const zipInfo = zipLookup(zipCode);
  const hasZip = zipCode.length === 5;
  const hasZipInfo = !!zipInfo;
  const jumboInfo = useMemo(
    () => hasZip ? detectJumbo(loanAmount, zipCode, hasZipInfo) : null,
    [hasZip, loanAmount, zipCode, hasZipInfo],
  );

  const effectiveBaseRate = jumboInfo?.isJumbo
    ? calcEffectiveRate(rate, true, jumboSpread)
    : rate;
  const adjustedRate = calcRateAfterPoints(effectiveBaseRate, points, mortgage.pointRateReduction || 0.25);

  const pi = useMemo(() => calcMonthlyPI(loanAmount, adjustedRate, term), [loanAmount, adjustedRate, term]);
  const schedule = useMemo(() => calcAmortizationSchedule(loanAmount, adjustedRate, term), [loanAmount, adjustedRate, term]);

  const pmiMonthly = useMemo(
    () => dp.percent < 20 ? calcPMI(loanAmount, mortgage.pmiRate || 0) : 0,
    [dp.percent, loanAmount, mortgage.pmiRate],
  );
  const pmiDropoff = useMemo(
    () => pmiMonthly > 0 ? calcPMIDropoffMonth(schedule, homePrice) : 0,
    [pmiMonthly, schedule, homePrice],
  );

  const monthly = useMemo(() => calcTotalMonthly({
    pi, propertyTax: mortgage.propertyTax || 0, homeInsurance: mortgage.homeInsurance || 0,
    hoa: mortgage.hoaDues || 0, pmi: pmiMonthly,
  }), [pi, mortgage.propertyTax, mortgage.homeInsurance, mortgage.hoaDues, pmiMonthly]);

  const pointsCost = calcPointsCost(loanAmount, points, mortgage.pointCostPercent || 1);
  const basePI = calcMonthlyPI(loanAmount, effectiveBaseRate, term);
  const monthlySavings = basePI - pi;

  const breakEven = useMemo(
    () => points > 0
      ? calcPointsBreakEven(pointsCost, monthlySavings, mortgage.opportunityCostRate || 7)
      : null,
    [points, pointsCost, monthlySavings, mortgage.opportunityCostRate],
  );

  const buyDownSignal = breakEven
    ? calcBuyDownSignal(breakEven.adjustedMonths, mortgage.expectedStayYears || 10)
    : null;

  const latestFredRate = rates.length > 0 ? rates[rates.length - 1].value : null;

  const costs = useMemo(
    () => calcHomeCosts(homePrice, purchase.closingCostOverrides || {}, purchase.closingCostPaid || {}),
    [homePrice, purchase.closingCostOverrides, purchase.closingCostPaid],
  );

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1, marginBottom: 16 }}>
        MORTGAGE CALCULATOR
      </h2>

      {/* Loan Inputs */}
      <div style={styles.cardSection}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 10, letterSpacing: 1.5 }}>LOAN DETAILS</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
          <div>
            <div style={styles.labelCompact}>Loan Amount</div>
            <div style={{ ...styles.input, background: colors.bgAlt, display: "flex", alignItems: "center" }}>
              {fmt(loanAmount)}
            </div>
            <div style={{ fontSize: 10, color: colors.dim, marginTop: 2 }}>
              {fmt(homePrice)} - {fmt(dp.amount)} ({dp.percent.toFixed(0)}% down)
            </div>
          </div>
          <div>
            <div style={styles.labelCompact}>Term (years)</div>
            <select
              value={term}
              onChange={e => updateMortgage("termYears", Number.parseInt(e.target.value, 10) || 30)}
              style={{ ...styles.input, cursor: "pointer" }}
            >
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={30}>30</option>
            </select>
          </div>
          <div>
            <div style={styles.labelCompact}>Interest Rate %</div>
            <input
              type="number" step="0.125" min="0" max="20"
              value={rate || ""}
              onChange={e => updateMortgage("ratePercent", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
            {latestFredRate && (
              <div style={{ fontSize: 10, color: colors.dim, marginTop: 2 }}>
                Avg {rateSeries === "MORTGAGE30US" ? "30yr" : "15yr"}: {latestFredRate.toFixed(2)}%
              </div>
            )}
          </div>
          <div>
            <div style={styles.labelCompact}>PMI Rate %</div>
            <input
              type="number" step="0.1" min="0"
              value={mortgage.pmiRate ?? 0.5}
              onChange={e => updateMortgage("pmiRate", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div>
            <div style={styles.labelCompact}>Property Tax (annual)</div>
            <input
              type="number" step="100"
              value={mortgage.propertyTax ?? 3500}
              onChange={e => updateMortgage("propertyTax", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
          <div>
            <div style={styles.labelCompact}>Home Insurance (annual)</div>
            <input
              type="number" step="100"
              value={mortgage.homeInsurance ?? 1800}
              onChange={e => updateMortgage("homeInsurance", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
          <div>
            <div style={styles.labelCompact}>HOA (monthly)</div>
            <input
              type="number" step="10"
              value={mortgage.hoaDues ?? 0}
              onChange={e => updateMortgage("hoaDues", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
          <div>
            <div style={styles.labelCompact}>Expected Stay (years)</div>
            <input
              type="number" step="1" min="1" max="30"
              value={mortgage.expectedStayYears ?? 10}
              onChange={e => updateMortgage("expectedStayYears", Number.parseInt(e.target.value) || 10)}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {/* Conforming Loan Status */}
      <ConformingStatus
        zipCode={zipCode}
        loanAmount={loanAmount}
        homePrice={homePrice}
        currentDownPercent={purchase.downPaymentPercent || 20}
        baseRate={rate}
        termYears={term}
        jumboSpread={jumboSpread}
        zipInfo={zipInfo}
        onZipChange={val => updatePurchase("zipCode", val)}
        onSpreadChange={val => updateMortgage("jumboSpreadPercent", val)}
        onApplyConformingDown={pct => updatePurchase("downPaymentPercent", pct)}
      />

      {/* Rate Chart */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <button onClick={() => setRateSeries("MORTGAGE30US")}
            style={{ ...styles.btn, fontSize: 11, padding: "3px 8px", color: rateSeries === "MORTGAGE30US" ? colors.blue : colors.dim }}>
            30-Year
          </button>
          <button onClick={() => setRateSeries("MORTGAGE15US")}
            style={{ ...styles.btn, fontSize: 11, padding: "3px 8px", color: rateSeries === "MORTGAGE15US" ? colors.blue : colors.dim }}>
            15-Year
          </button>
        </div>
        <RateChart rates={rates} currentRate={adjustedRate} />
      </div>

      {/* Monthly Payment Breakdown */}
      <div style={styles.cardSection}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 12, letterSpacing: 1.5 }}>
          MONTHLY PAYMENT BREAKDOWN
        </div>

        <div style={{ display: "flex", height: 28, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
          {[
            { val: monthly.pi, color: colors.blue, label: "P&I" },
            { val: monthly.propertyTax, color: colors.barTax, label: "Tax" },
            { val: monthly.homeInsurance, color: colors.barInsurance, label: "Ins" },
            { val: monthly.hoa, color: colors.amberDim, label: "HOA" },
            { val: monthly.pmi, color: colors.redDim, label: "PMI" },
          ].filter(s => s.val > 0).map(s => (
            <div key={s.label} style={{
              flex: s.val / monthly.total, background: s.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 600, color: colors.text, minWidth: 30,
            }}>
              {s.label}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "P&I", val: monthly.pi, color: colors.blue },
            { label: "Property Tax", val: monthly.propertyTax },
            { label: "Insurance", val: monthly.homeInsurance },
            { label: "HOA", val: monthly.hoa },
            { label: "PMI", val: monthly.pmi, color: monthly.pmi > 0 ? colors.amber : colors.dim },
            { label: "TOTAL", val: monthly.total, color: colors.green, bold: true },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={styles.labelCompact}>{s.label}</div>
              <div style={{ fontSize: s.bold ? 18 : 14, fontWeight: s.bold ? 700 : 500, color: s.color || colors.text }}>
                {fmt(s.val)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PMI Analysis */}
      {pmiMonthly > 0 && (
        <div style={styles.cardSection}>
          <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 10, letterSpacing: 1.5 }}>PMI ANALYSIS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={styles.labelCompact}>Monthly PMI</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.amber }}>{fmt(pmiMonthly)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={styles.labelCompact}>Drops Off</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {pmiDropoff > 0
                  ? `Month ${pmiDropoff} (${(pmiDropoff / 12).toFixed(1)} yr)`
                  : "N/A"}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={styles.labelCompact}>Total PMI Paid</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.red }}>
                {fmt((pmiDropoff || 0) * pmiMonthly)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: colors.dim, marginTop: 8 }}>
            PMI auto-terminates when equity reaches 22% (78% LTV) per the Homeowners Protection Act.
          </div>
        </div>
      )}

      {dp.percent >= 20 && (
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8,
          padding: 14, marginBottom: 14, color: colors.green, fontSize: 14,
        }}>
          No PMI required — {dp.percent.toFixed(0)}% down payment (20%+ threshold met).
        </div>
      )}

      {/* Points Buy-Down Analysis */}
      <div style={styles.cardSection}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 10, letterSpacing: 1.5 }}>
          POINTS BUY-DOWN ANALYSIS
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={styles.labelCompact}>Points to Buy</div>
            <input
              type="number" step="0.5" min="0" max="4"
              value={points}
              onChange={e => updateMortgage("pointsBought", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
          <div>
            <div style={styles.labelCompact}>Opportunity Cost Rate %</div>
            <input
              type="number" step="0.5" min="0"
              value={mortgage.opportunityCostRate ?? 7}
              onChange={e => updateMortgage("opportunityCostRate", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
            <div style={{ fontSize: 10, color: colors.dim, marginTop: 2 }}>S&P 500 avg: ~7%</div>
          </div>
          <div>
            <div style={styles.labelCompact}>Adjusted Rate</div>
            <div style={{ ...styles.input, background: colors.bgAlt, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
              {adjustedRate.toFixed(3)}%
              {jumboInfo?.isJumbo && <span style={{ color: colors.amber, fontSize: 11 }}>(+{jumboSpread.toFixed(2)}% jumbo)</span>}
              {points > 0 && <span style={{ color: colors.green, fontSize: 11 }}>(-{(points * (mortgage.pointRateReduction || 0.25)).toFixed(3)}% pts)</span>}
            </div>
          </div>
        </div>

        {points > 0 && breakEven && (
          <div style={{
            background: SIGNAL_BG[buyDownSignal?.signal] || colors.bgAlt,
            borderLeft: `3px solid ${SIGNAL_COLORS[buyDownSignal?.signal] || colors.dim}`,
            borderRadius: 6, padding: 14,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 8 }}>
              <div>
                <div style={styles.labelCompact}>Points Cost</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(pointsCost)}</div>
              </div>
              <div>
                <div style={styles.labelCompact}>Monthly Savings</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.green }}>{fmt(monthlySavings)}</div>
              </div>
              <div>
                <div style={styles.labelCompact}>Simple Break-Even</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {breakEven.simpleMonths === Infinity ? "Never" : `${breakEven.simpleMonths} mo`}
                </div>
              </div>
              <div>
                <div style={styles.labelCompact}>Adjusted Break-Even</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {breakEven.adjustedMonths === Infinity
                    ? "Never"
                    : `${breakEven.adjustedMonths} mo (${(breakEven.adjustedMonths / 12).toFixed(1)} yr)`}
                </div>
              </div>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: SIGNAL_COLORS[buyDownSignal?.signal] || colors.dim,
            }}>
              {buyDownSignal?.label}
            </div>
            <div style={{ fontSize: 12, color: colors.dim, marginTop: 4 }}>
              Based on {mortgage.expectedStayYears || 10}-year expected stay and {mortgage.opportunityCostRate || 7}% alternative return.
            </div>
          </div>
        )}

        {points === 0 && (
          <div style={{ color: colors.dim, fontSize: 13 }}>
            Set points above 0 to see buy-down analysis.
          </div>
        )}
      </div>

      {/* Closing Costs */}
      <div style={{ marginBottom: 14 }}>
        <CostBreakdown
          items={costs.items}
          overrides={purchase.closingCostOverrides || {}}
          paid={purchase.closingCostPaid || {}}
          onOverride={onOverride}
          onTogglePaid={onTogglePaid}
          price={homePrice}
          title="CLOSING COSTS"
        />
      </div>

      {/* Amortization Table */}
      <AmortizationTable schedule={schedule} pmiDropoffMonth={pmiDropoff} monthlyPMI={pmiMonthly} />
    </div>
  );
}

// ─── Auto Loan View ─────────────────────────────────────────────────────────

function AutoLoanView({ purchase, autoLoan, updateAutoLoan, onOverride, onTogglePaid }) {
  const carPrice = purchase.carPrice || 0;
  const downPayment = purchase.carDownPayment || 0;
  const tradeIn = autoLoan.tradeInValue || 0;
  const rate = autoLoan.ratePercent || 0;
  const termMonths = autoLoan.termMonths || 60;

  const summary = useMemo(
    () => calcAutoLoanSummary(carPrice, downPayment, tradeIn, rate, termMonths),
    [carPrice, downPayment, tradeIn, rate, termMonths],
  );

  const costs = useMemo(
    () => calcCarCosts(carPrice, purchase.carCostOverrides || {}, purchase.carCostPaid || {}),
    [carPrice, purchase.carCostOverrides, purchase.carCostPaid],
  );

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1, marginBottom: 16 }}>
        AUTO LOAN CALCULATOR
      </h2>

      {/* Loan Inputs */}
      <div style={styles.cardSection}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 10, letterSpacing: 1.5 }}>LOAN DETAILS</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
          <div>
            <div style={styles.labelCompact}>Loan Amount</div>
            <div style={{ ...styles.input, background: colors.bgAlt, display: "flex", alignItems: "center" }}>
              {fmt(summary.loanAmount)}
            </div>
            <div style={{ fontSize: 10, color: colors.dim, marginTop: 2 }}>
              {fmt(carPrice)} - {fmt(downPayment)} down{tradeIn > 0 ? ` - ${fmt(tradeIn)} trade` : ""}
            </div>
          </div>
          <div>
            <div style={styles.labelCompact}>Term (months)</div>
            <select
              value={termMonths}
              onChange={e => updateAutoLoan("termMonths", Number.parseInt(e.target.value, 10) || 60)}
              style={{ ...styles.input, cursor: "pointer" }}
            >
              <option value={24}>24</option>
              <option value={36}>36</option>
              <option value={48}>48</option>
              <option value={60}>60</option>
              <option value={72}>72</option>
              <option value={84}>84</option>
            </select>
          </div>
          <div>
            <div style={styles.labelCompact}>Interest Rate %</div>
            <input
              type="number" step="0.25" min="0" max="30"
              value={rate || ""}
              onChange={e => updateAutoLoan("ratePercent", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
          <div>
            <div style={styles.labelCompact}>Trade-In Value</div>
            <input
              type="number" step="500"
              value={tradeIn || ""}
              onChange={e => updateAutoLoan("tradeInValue", Number.parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.card} 0%, ${colors.gradientDark} 100%)`,
        border: `1px solid ${colors.borderAccent}`,
        borderRadius: 8, padding: 18, marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 12, letterSpacing: 1.5 }}>
          PAYMENT SUMMARY
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Monthly Payment</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: colors.green }}>{fmt(summary.monthlyPayment)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Total Interest</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: colors.red }}>{fmt(summary.totalInterest)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Total Cost</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(summary.totalCost)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={styles.labelCompact}>Term</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{termMonths} mo ({(termMonths / 12).toFixed(1)} yr)</div>
          </div>
        </div>
      </div>

      {/* Purchase Costs */}
      <div style={{ marginBottom: 14 }}>
        <CostBreakdown
          items={costs.items}
          overrides={purchase.carCostOverrides || {}}
          paid={purchase.carCostPaid || {}}
          onOverride={onOverride}
          onTogglePaid={onTogglePaid}
          price={carPrice}
          title="PURCHASE COSTS"
        />
      </div>
    </div>
  );
}
