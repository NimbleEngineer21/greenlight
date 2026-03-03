import { useMemo } from "react";
import { colors, styles } from "../theme.js";
import { calcCashFlow, fmt, fmtDate } from "../lib/calculations.js";

export default function Projections({ state, updateState }) {
  const sellDate = state.sellDate || "2026-04-17";
  const cf = useMemo(() => calcCashFlow(sellDate, state.cashFlow), [sellDate, state.cashFlow]);

  const inputStyle = styles.input;

  const updateCashFlow = (key, value) => {
    updateState(prev => ({ ...prev, cashFlow: { ...prev.cashFlow, [key]: value } }));
  };

  const addExpense = () => {
    const exp = { id: crypto.randomUUID(), name: "", amount: 0, frequency: "monthly", dayOfMonth: 1, startDate: sellDate };
    updateState(prev => ({ ...prev, cashFlow: { ...prev.cashFlow, expenses: [...(prev.cashFlow.expenses || []), exp] } }));
  };

  const updateExpense = (id, key, value) => {
    updateState(prev => ({
      ...prev,
      cashFlow: {
        ...prev.cashFlow,
        expenses: prev.cashFlow.expenses.map(e => e.id === id ? { ...e, [key]: value } : e),
      },
    }));
  };

  const removeExpense = (id) => {
    updateState(prev => ({
      ...prev,
      cashFlow: { ...prev.cashFlow, expenses: prev.cashFlow.expenses.filter(e => e.id !== id) },
    }));
  };

  const addObligation = () => {
    const ob = { id: crypto.randomUUID(), name: "", amount: 0, dueDate: sellDate, isPaid: false };
    updateState(prev => ({ ...prev, cashFlow: { ...prev.cashFlow, oneTimeObligations: [...(prev.cashFlow.oneTimeObligations || []), ob] } }));
  };

  const updateObligation = (id, key, value) => {
    updateState(prev => ({
      ...prev,
      cashFlow: {
        ...prev.cashFlow,
        oneTimeObligations: prev.cashFlow.oneTimeObligations.map(o => o.id === id ? { ...o, [key]: value } : o),
      },
    }));
  };

  const removeObligation = (id) => {
    updateState(prev => ({
      ...prev,
      cashFlow: { ...prev.cashFlow, oneTimeObligations: prev.cashFlow.oneTimeObligations.filter(o => o.id !== id) },
    }));
  };

  const labelStyle = { fontSize: 13, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 };
  const btnStyle = styles.btn;

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1 }}>CASH FLOW & PROJECTIONS</h2>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { l: "Paychecks", s: `${cf.pays} × $${state.cashFlow.paycheckAmount?.toLocaleString() || 0}`, v: cf.payTotal, clr: colors.green },
          { l: "Expenses", s: `${cf.mortgageCount} occurrences`, v: -cf.expTotal, clr: colors.red },
          { l: "Obligations", s: "One-time due", v: -cf.obTotal, clr: colors.red },
          { l: "Net Cash Flow", s: `by ${fmtDate(sellDate)}`, v: cf.net, clr: cf.net >= 0 ? colors.green : colors.red },
        ].map((b, i) => (
          <div key={i} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5 }}>{b.l}</div>
            <div style={{ fontSize: 11, color: colors.dim, marginTop: 2 }}>{b.s}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: b.clr, marginTop: 4 }}>{fmt(b.v)}</div>
          </div>
        ))}
      </div>

      {/* Paycheck config */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontWeight: 600 }}>Paycheck Config</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Amount</label>
            <input type="number" step="0.01" value={state.cashFlow.paycheckAmount}
              onChange={e => updateCashFlow("paycheckAmount", parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Frequency</label>
            <select value={state.cashFlow.paycheckFrequency} onChange={e => updateCashFlow("paycheckFrequency", e.target.value)} style={inputStyle}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>First Pay Date</label>
            <input type="date" value={state.cashFlow.firstPayDate} onChange={e => updateCashFlow("firstPayDate", e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Recurring Expenses */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Recurring Expenses</div>
          <button onClick={addExpense} style={{ ...btnStyle, color: colors.green }}>+ Add</button>
        </div>
        {(state.cashFlow.expenses || []).map(exp => (
          <div key={exp.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={exp.name} onChange={e => updateExpense(exp.id, "name", e.target.value)} style={inputStyle} placeholder="Mortgage" />
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <input type="number" step="0.01" value={exp.amount} onChange={e => updateExpense(exp.id, "amount", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Frequency</label>
              <select value={exp.frequency} onChange={e => updateExpense(exp.id, "frequency", e.target.value)} style={inputStyle}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={exp.startDate} onChange={e => updateExpense(exp.id, "startDate", e.target.value)} style={inputStyle} />
            </div>
            <button onClick={() => removeExpense(exp.id)} style={{ ...btnStyle, color: colors.red, padding: "5px 10px" }}>×</button>
          </div>
        ))}
        {(state.cashFlow.expenses || []).length === 0 && (
          <div style={{ fontSize: 12, color: colors.dim, padding: 8 }}>No recurring expenses.</div>
        )}
      </div>

      {/* One-time Obligations */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>One-Time Obligations</div>
          <button onClick={addObligation} style={{ ...btnStyle, color: colors.green }}>+ Add</button>
        </div>
        {(state.cashFlow.oneTimeObligations || []).map(ob => (
          <div key={ob.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={ob.name} onChange={e => updateObligation(ob.id, "name", e.target.value)} style={inputStyle} placeholder="2025 Tax Bill" />
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <input type="number" step="0.01" value={ob.amount} onChange={e => updateObligation(ob.id, "amount", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" value={ob.dueDate} onChange={e => updateObligation(ob.id, "dueDate", e.target.value)} style={inputStyle} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: ob.isPaid ? colors.green : colors.dim, cursor: "pointer", paddingBottom: 4 }}>
              <input type="checkbox" checked={ob.isPaid} onChange={e => updateObligation(ob.id, "isPaid", e.target.checked)} style={{ accentColor: colors.blue }} />
              Paid
            </label>
            <button onClick={() => removeObligation(ob.id)} style={{ ...btnStyle, color: colors.red, padding: "5px 10px" }}>×</button>
          </div>
        ))}
        {(state.cashFlow.oneTimeObligations || []).length === 0 && (
          <div style={{ fontSize: 12, color: colors.dim, padding: 8 }}>No one-time obligations.</div>
        )}
      </div>

      {/* Retirement summary — editing moved to Assets page */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Retirement (Early Withdrawal)</div>
          <div style={{ fontSize: 10, color: colors.dim }}>Manage accounts in Assets →</div>
        </div>
        <div style={{ fontSize: 12, color: colors.dim, padding: 8 }}>
          {state.retirement?.enabled
            ? `${(state.retirement.accounts || []).length} account(s) configured — see Assets for details and editing.`
            : "Not included in liquidation. Enable in Assets."}
        </div>
      </div>
    </div>
  );
}
