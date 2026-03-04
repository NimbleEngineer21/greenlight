import { useState, useMemo } from "react";
import { colors, styles } from "../theme.js";
import { fmt } from "../lib/calculations.js";
import { calcDownPayment } from "../lib/purchasePlanner.js";
import { compareLenders } from "../lib/mortgageCalc.js";
import { detectJumbo } from "../lib/loanLimits.js";
import { track } from "../lib/analytics.js";
import LenderCard from "../components/LenderCard.jsx";

const EMPTY_LENDER = { name: "", ratePercent: 6.5, points: 0, closingCredits: 0, originationFee: 0 };

export default function LenderCompare({ state, updateState }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_LENDER });

  const purchase = state.purchase || {};
  const mortgage = state.mortgage || {};
  const autoLoan = state.autoLoan || {};
  const category = purchase.category;
  const isMortgage = purchase.loanType === "mortgage";

  // Loan parameters based on type
  const termYears = isMortgage ? (mortgage.termYears || 30) : ((autoLoan.termMonths || 60) / 12);
  const expectedStay = isMortgage ? (mortgage.expectedStayYears || 10) : termYears;
  const oppRate = mortgage.opportunityCostRate || 7;

  const loanAmount = useMemo(() => {
    if (isMortgage) {
      const homePrice = purchase.homePrice || 0;
      const dp = calcDownPayment(homePrice, purchase.downPaymentPercent || 20);
      return homePrice - dp.amount;
    }
    const carPrice = purchase.carPrice || 0;
    const down = purchase.carDownPayment || 0;
    const tradeIn = autoLoan.tradeInValue || 0;
    return Math.max(0, carPrice - down - tradeIn);
  }, [isMortgage, purchase.homePrice, purchase.downPaymentPercent, purchase.carPrice, purchase.carDownPayment, autoLoan.tradeInValue]);

  // Time horizons for comparison table
  const horizons = useMemo(() => isMortgage
    ? [
        { label: "Total @ 5yr", years: 5 },
        { label: "Total @ 10yr", years: 10 },
        { label: `Total @ ${mortgage.termYears || 30}yr`, years: mortgage.termYears || 30 },
      ]
    : [
        { label: "Total @ 3yr", years: 3 },
        { label: "Total @ 5yr", years: 5 },
        { label: `Total @ ${((autoLoan.termMonths || 60) / 12).toFixed(0)}yr`, years: (autoLoan.termMonths || 60) / 12 },
      ],
    [isMortgage, mortgage.termYears, autoLoan.termMonths],
  );

  const ranked = useMemo(
    () => compareLenders(state.lenders || [], loanAmount, termYears, expectedStay, oppRate),
    [state.lenders, loanAmount, termYears, expectedStay, oppRate],
  );

  const startAdd = () => {
    setForm({ ...EMPTY_LENDER, ratePercent: isMortgage ? 6.5 : 7.0 });
    setEditing("new");
  };

  const startEdit = (lender) => {
    setForm({ ...EMPTY_LENDER, ...lender });
    setEditing(lender.id);
  };

  const save = () => {
    if (editing === "new") {
      const newLender = { ...form, id: crypto.randomUUID() };
      updateState(prev => ({ ...prev, lenders: [...(prev.lenders || []), newLender] }));
      track("loan_compare", { action: "add" });
    } else {
      updateState(prev => ({
        ...prev,
        lenders: prev.lenders.map(l => l.id === editing ? { ...l, ...form } : l),
      }));
    }
    setEditing(null);
  };

  const remove = (id) => {
    updateState(prev => ({ ...prev, lenders: prev.lenders.filter(l => l.id !== id) }));
  };

  if (!category || !purchase.takingLoan) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: colors.textBright, marginBottom: 12 }}>Lender Comparison</div>
        <div style={{ color: colors.dim, fontSize: 14 }}>
          {!category
            ? "Activate purchase planning from the Dashboard to use this tool."
            : "Enable loan financing on the Purchase page to compare lenders."}
        </div>
      </div>
    );
  }

  const termLabel = isMortgage ? `${mortgage.termYears || 30}-year` : `${autoLoan.termMonths || 60}-month`;
  const typeLabel = isMortgage ? "mortgage" : "auto loan";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1 }}>
          LENDER COMPARISON
        </h2>
        <button onClick={startAdd} style={{ ...styles.btn, color: colors.green }}>+ Add Lender</button>
      </div>

      {/* Context */}
      <div style={{ fontSize: 12, color: colors.dim, marginBottom: 14 }}>
        Comparing {typeLabel} on {fmt(loanAmount)} loan, {termLabel} term
        {isMortgage && `, ${expectedStay}-year expected stay, ${oppRate}% opportunity cost`}
      </div>

      {/* Jumbo Warning Banner — mortgage only */}
      {isMortgage && (() => {
        const zip = purchase.zipCode;
        if (!zip || zip.length !== 5) return null;
        const jumbo = detectJumbo(loanAmount, zip);
        if (!jumbo.isJumbo) return null;
        return (
          <div style={{
            background: "rgba(245, 158, 11, 0.08)", borderLeft: `3px solid ${colors.amber}`,
            borderRadius: 6, padding: 12, marginBottom: 14, fontSize: 13, color: colors.text,
          }}>
            <span style={{ fontWeight: 600, color: colors.amber }}>Jumbo loan</span> — {fmt(jumbo.overage)} above
            the {fmt(jumbo.conformingLimit)} conforming limit. Ensure lender rates reflect jumbo pricing
            (typical premium: 0.25–0.50%).
          </div>
        );
      })()}

      {/* Add/Edit Form */}
      {editing && (
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 8, letterSpacing: 1 }}>
            {editing === "new" ? "ADD LENDER" : "EDIT LENDER"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMortgage ? "2fr 1fr 1fr 1fr 1fr" : "2fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={styles.labelCompact}>Lender Name</div>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder={isMortgage ? "First National Bank" : "Capital One Auto"}
                style={styles.input}
              />
            </div>
            <div>
              <div style={styles.labelCompact}>Rate %</div>
              <input
                type="number" step="0.125"
                value={form.ratePercent}
                onChange={e => setForm(p => ({ ...p, ratePercent: parseFloat(e.target.value) || 0 }))}
                style={styles.input}
              />
            </div>
            {isMortgage && (
              <>
                <div>
                  <div style={styles.labelCompact}>Points</div>
                  <input
                    type="number" step="0.5" min="0" max="4"
                    value={form.points}
                    onChange={e => setForm(p => ({ ...p, points: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                  />
                </div>
                <div>
                  <div style={styles.labelCompact}>Closing Credits $</div>
                  <input
                    type="number" step="100"
                    value={form.closingCredits}
                    onChange={e => setForm(p => ({ ...p, closingCredits: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                  />
                </div>
              </>
            )}
            <div>
              <div style={styles.labelCompact}>Origination Fee $</div>
              <input
                type="number" step="100"
                value={form.originationFee}
                onChange={e => setForm(p => ({ ...p, originationFee: parseFloat(e.target.value) || 0 }))}
                style={styles.input}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={save} style={{ ...styles.btn, color: colors.green }}>Save</button>
            <button onClick={() => setEditing(null)} style={styles.btn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Lender Cards */}
      {ranked.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }} className="gl-cards-2">
          {ranked.map((lender, i) => (
            <LenderCard
              key={lender.id}
              lender={lender}
              isBest={i === 0}
              onEdit={() => startEdit(lender)}
              onRemove={() => remove(lender.id)}
            />
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {ranked.length >= 2 && (
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 10, letterSpacing: 1.5 }}>
            SIDE-BY-SIDE COMPARISON
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                  <th style={{ ...styles.labelCompact, padding: "6px 8px", textAlign: "left" }}>Metric</th>
                  {ranked.map((l, i) => (
                    <th key={l.id} style={{ ...styles.labelCompact, padding: "6px 8px", textAlign: "right", color: i === 0 ? colors.green : colors.dim }}>
                      {l.name || `Lender ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Rate", fn: l => `${l.adjustedRate?.toFixed(3)}%` },
                  { label: "Monthly P&I", fn: l => fmt(l.monthlyPI), valFn: l => l.monthlyPI },
                  { label: "Upfront Cost", fn: l => fmt(l.upfrontCost), valFn: l => l.upfrontCost },
                  ...horizons.map(h => ({
                    label: h.label, fn: l => fmt(l.totalAt(h.years)), valFn: l => l.totalAt(h.years),
                  })),
                ].map(row => {
                  const bestVal = row.valFn ? Math.min(...ranked.map(l => row.valFn(l))) : null;
                  return (
                    <tr key={row.label} style={{ borderBottom: `1px solid #0e1620` }}>
                      <td style={{ padding: "6px 8px", color: colors.dim }}>{row.label}</td>
                      {ranked.map(l => {
                        const isBestInRow = row.valFn && row.valFn(l) === bestVal;
                        return (
                          <td key={l.id} style={{
                            padding: "6px 8px", textAlign: "right",
                            color: isBestInRow ? colors.green : colors.text,
                            fontWeight: isBestInRow ? 600 : 400,
                          }}>
                            {row.fn(l)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(state.lenders || []).length === 0 && !editing && (
        <div style={{ textAlign: "center", padding: 40, color: colors.dim }}>
          No lenders added yet. Click "+ Add Lender" to start comparing.
        </div>
      )}
    </div>
  );
}
