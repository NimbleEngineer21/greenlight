import { useState } from "react";
import { colors, fonts, styles } from "../theme.js";
import { DEFAULT_TAX_CONFIG } from "../data/defaults.js";
import { STATE_TAXES } from "../data/stateTaxes.js";
import { loanTypeForCategory } from "../lib/purchasePlanner.js";
import { track } from "../lib/analytics.js";

const PLACEHOLDER_INCOMES = ["1,850.00", "2,475.00", "3,200.00", "4,100.00", "5,250.00", "5,800.00"];
const PLACEHOLDER_BANKS = ["National Bank", "First Credit Union", "City Savings", "Valley Federal", "Metro Bank"];
const PLACEHOLDER_ACCOUNTS = ["Checking", "Savings", "Money Market"];
const PLACEHOLDER_EXPENSES = ["Mortgage", "Car Note", "Internet", "Electric", "Streaming", "Insurance", "Groceries", "Phone"];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const STATE_CODES = ["", ...Object.keys(STATE_TAXES).sort()];

const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "income", label: "Income" },
  { key: "cash", label: "Cash & Savings" },
  { key: "expenses", label: "Expenses" },
  { key: "obligations", label: "Cash Events" },
  { key: "tax", label: "Tax & Date" },
  { key: "warning", label: "Your Data" },
  { key: "planning", label: "Planning" },
];

export default function SetupWizard({ updateState }) {
  const [step, setStep] = useState(0);
  const [hasExpenses, setHasExpenses] = useState(null);   // null = not answered, true/false
  const [hasObligations, setHasObligations] = useState(null);
  const [draft, setDraft] = useState({
    paycheckAmount: 0,
    paycheckFrequency: "biweekly",
    firstPayDate: "",
    expenses: [],
    cashAccounts: [],
    oneTimeObligations: [],
    capitalSales: [],
    taxConfig: { ...DEFAULT_TAX_CONFIG },
    sellDate: new Date().toISOString().slice(0, 10),
    purchaseCategory: null,
    dateOfBirth: { month: "", year: "" },
  });

  const [placeholders] = useState(() => ({
    income: pickRandom(PLACEHOLDER_INCOMES),
    bank: pickRandom(PLACEHOLDER_BANKS),
    account: pickRandom(PLACEHOLDER_ACCOUNTS),
  }));

  const update = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const updateTax = (key, value) => {
    setDraft(prev => {
      const next = { ...prev.taxConfig, [key]: value };
      if (key === "yourW2" || key === "spouseW2") {
        next.combinedW2 = (next.yourW2 || 0) + (next.spouseW2 || 0);
      }
      if (key === "filingStatus") {
        if (value === "mfj") {
          next.standardDeduction = 31400;
          next.combinedW2 = (next.yourW2 || 0) + (next.spouseW2 || 0);
        } else {
          next.standardDeduction = 15700;
          next.combinedW2 = next.yourW2 || 0;
        }
      }
      return { ...prev, taxConfig: next };
    });
  };

  const handleFinish = () => {
    const tc = draft.taxConfig;
    const combinedW2 = tc.filingStatus === "mfj"
      ? (tc.yourW2 || 0) + (tc.spouseW2 || 0)
      : (tc.yourW2 || 0);

    const cat = draft.purchaseCategory;
    updateState(prev => ({
      ...prev,
      setupComplete: true,
      lastExportDate: new Date().toISOString().slice(0, 10),
      sellDate: draft.sellDate,
      cashFlow: {
        ...prev.cashFlow,
        paycheckAmount: draft.paycheckAmount,
        paycheckFrequency: draft.paycheckFrequency,
        firstPayDate: draft.firstPayDate,
        expenses: draft.expenses,
        oneTimeObligations: draft.oneTimeObligations,
      },
      cashAccounts: draft.cashAccounts,
      capitalSales: draft.capitalSales,
      dateOfBirth: draft.dateOfBirth,
      taxConfig: { ...prev.taxConfig, ...draft.taxConfig, combinedW2 },
      purchase: cat
        ? { ...prev.purchase, category: cat, loanType: loanTypeForCategory(cat), takingLoan: true }
        : prev.purchase,
    }));
    track("wizard_complete", { planning_mode: cat || "none" });
  };

  const handleSkip = () => {
    updateState(prev => ({ ...prev, setupComplete: true, lastExportDate: new Date().toISOString().slice(0, 10) }));
    track("wizard_skip", { at_step: step });
  };

  // Skip optional steps when user answers "No"
  const goNext = () => {
    let next = step + 1;
    // Skip expenses detail if user said no
    if (STEPS[next]?.key === "expenses" && hasExpenses === false) next++;
    // Skip obligations detail if user said no
    if (STEPS[next]?.key === "obligations" && hasObligations === false) next++;
    setStep(next);
  };

  const goBack = () => {
    let prev = step - 1;
    if (STEPS[prev]?.key === "obligations" && hasObligations === false) prev--;
    if (STEPS[prev]?.key === "expenses" && hasExpenses === false) prev--;
    setStep(Math.max(0, prev));
  };

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const inputStyle = styles.input;
  const labelStyle = { fontSize: 12, color: colors.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, display: "block" };
  const btnStyle = { ...styles.btn, padding: "10px 26px", fontSize: 15 };
  const addBtnStyle = { ...styles.btn, color: colors.green, fontSize: 13, padding: "5px 16px" };
  const removeBtnStyle = { ...addBtnStyle, color: colors.red, alignSelf: "center", marginTop: 18 };

  return (
    <div style={{
      fontFamily: fonts.mono, background: colors.bg, color: colors.text,
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 780, padding: 26 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.green, letterSpacing: 3 }}>GREENLIGHT</div>
          <div style={{ fontSize: 13, color: colors.dim, marginTop: 5 }}>Knowing exactly when all the math turns green.</div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div key={s.key} onClick={() => setStep(i)} style={{ flex: 1, textAlign: "center", cursor: "pointer" }}>
              <div style={{
                height: 3, borderRadius: 2, marginBottom: 4,
                background: i <= step ? colors.blue : colors.border,
                transition: "background 0.2s",
              }} />
              <div style={{ fontSize: 8, color: i <= step ? colors.blue : colors.dim, letterSpacing: 1 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
          {currentStep.key === "welcome" && <WelcomeStep />}
          {currentStep.key === "income" && (
            <IncomeStep draft={draft} update={update} inputStyle={inputStyle} labelStyle={labelStyle} placeholders={placeholders} />
          )}
          {currentStep.key === "cash" && (
            <CashStep draft={draft} setDraft={setDraft} inputStyle={inputStyle} labelStyle={labelStyle} addBtnStyle={addBtnStyle} removeBtnStyle={removeBtnStyle} placeholders={placeholders} />
          )}
          {currentStep.key === "expenses" && (
            <OptionalGateStep
              answered={hasExpenses}
              onAnswer={(val) => {
                setHasExpenses(val);
                if (!val) goNext();
                else if (draft.expenses.length === 0)
                  setDraft(prev => ({ ...prev, expenses: [{ id: crypto.randomUUID(), name: "", amount: 0, frequency: "monthly", startDate: "" }] }));
              }}
              question="Do you have recurring expenses to track?"
              hint="Mortgage, rent, utilities, subscriptions, etc."
            >
              <ExpensesStep draft={draft} setDraft={setDraft} inputStyle={inputStyle} labelStyle={labelStyle} addBtnStyle={addBtnStyle} removeBtnStyle={removeBtnStyle} />
            </OptionalGateStep>
          )}
          {currentStep.key === "obligations" && (
            <OptionalGateStep
              answered={hasObligations}
              onAnswer={(val) => {
                setHasObligations(val);
                if (!val) goNext();
                else if (draft.oneTimeObligations.length === 0)
                  setDraft(prev => ({ ...prev, oneTimeObligations: [{ id: crypto.randomUUID(), name: "", amount: 0, dueDate: "", isPaid: false }] }));
              }}
              question="Do you have upcoming one-time cash events?"
              hint="One-time payments, tax bills, or assets you plan to sell before your target date."
            >
              <ObligationsStep draft={draft} setDraft={setDraft} inputStyle={inputStyle} labelStyle={labelStyle} addBtnStyle={addBtnStyle} removeBtnStyle={removeBtnStyle} />
            </OptionalGateStep>
          )}
          {currentStep.key === "tax" && (
            <TaxDateStep draft={draft} update={update} updateTax={updateTax} inputStyle={inputStyle} labelStyle={labelStyle}
              updateDOB={(key, val) => setDraft(prev => ({ ...prev, dateOfBirth: { ...prev.dateOfBirth, [key]: val } }))}
            />
          )}
          {currentStep.key === "warning" && <DataWarningStep />}
          {currentStep.key === "planning" && (
            <PlanningStep selected={draft.purchaseCategory} onSelect={cat => update("purchaseCategory", cat)} />
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={goBack}
            disabled={step === 0}
            style={{ ...btnStyle, opacity: step === 0 ? 0.3 : 1 }}
          >
            Back
          </button>

          <button
            onClick={handleSkip}
            style={{ background: "none", border: "none", color: colors.dim, fontFamily: fonts.mono, fontSize: 10, cursor: "pointer", textDecoration: "underline" }}
          >
            Skip Setup
          </button>

          {!isLast ? (
            <button onClick={goNext} style={btnStyle}>Next</button>
          ) : (
            <button onClick={handleFinish} style={{ ...btnStyle, color: colors.green, fontWeight: 600 }}>
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionalGateStep({ answered, onAnswer, question, hint, children }) {
  if (answered !== true) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 6 }}>{question}</div>
        <div style={{ fontSize: 12, color: colors.dim, marginBottom: 20 }}>{hint}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={() => onAnswer(true)}
            style={{ ...styles.btn, padding: "10px 30px", fontSize: 15, color: colors.green, borderColor: colors.green }}
          >
            Yes
          </button>
          <button
            onClick={() => onAnswer(false)}
            style={{ ...styles.btn, padding: "10px 30px", fontSize: 15 }}
          >
            No, skip
          </button>
        </div>
      </div>
    );
  }
  return children;
}

function IncomeStep({ draft, update, inputStyle, labelStyle, placeholders }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: colors.blue, marginBottom: 12 }}>PAYCHECK INFORMATION</div>
      <div style={{ fontSize: 10, color: colors.dim, marginBottom: 16 }}>
        Enter your take-home pay details to project income before your target date.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Take-Home Amount</label>
          <input type="number" step="0.01" value={draft.paycheckAmount || ""}
            onChange={e => update("paycheckAmount", parseFloat(e.target.value) || 0)}
            placeholder={placeholders.income} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Frequency</label>
          <select value={draft.paycheckFrequency} onChange={e => update("paycheckFrequency", e.target.value)} style={inputStyle}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>First Pay Date</label>
          <input type="date" value={draft.firstPayDate}
            onChange={e => update("firstPayDate", e.target.value)} style={inputStyle} />
        </div>
      </div>
    </div>
  );
}

function CashStep({ draft, setDraft, inputStyle, labelStyle, addBtnStyle, removeBtnStyle, placeholders }) {
  const add = () => {
    setDraft(prev => ({
      ...prev,
      cashAccounts: [...prev.cashAccounts, { id: crypto.randomUUID(), platform: "", name: "", balance: 0 }],
    }));
  };
  const remove = (id) => {
    setDraft(prev => ({ ...prev, cashAccounts: prev.cashAccounts.filter(a => a.id !== id) }));
  };
  const set = (id, key, value) => {
    setDraft(prev => ({
      ...prev,
      cashAccounts: prev.cashAccounts.map(a => a.id === id ? { ...a, [key]: value } : a),
    }));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.blue }}>CASH & SAVINGS</div>
          <div style={{ fontSize: 10, color: colors.dim, marginTop: 2 }}>Bank accounts, savings, checking balances.</div>
        </div>
        <button onClick={add} style={addBtnStyle}>+ Add</button>
      </div>
      {draft.cashAccounts.map((acct, idx) => (
        <div key={acct.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, marginBottom: 8, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Platform / Bank</label>
            <input value={acct.platform} onChange={e => set(acct.id, "platform", e.target.value)}
              placeholder={idx === 0 ? placeholders.bank : ""} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Account Name</label>
            <input value={acct.name} onChange={e => set(acct.id, "name", e.target.value)}
              placeholder={PLACEHOLDER_ACCOUNTS[idx] || ""} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Balance</label>
            <input type="number" step="0.01" value={acct.balance || ""} onChange={e => set(acct.id, "balance", parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <button onClick={() => remove(acct.id)} style={removeBtnStyle}>x</button>
        </div>
      ))}
      {draft.cashAccounts.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, color: colors.dim, fontSize: 10 }}>
          No accounts yet. Click "+ Add" to add your bank accounts.
        </div>
      )}
    </div>
  );
}

function ExpensesStep({ draft, setDraft, inputStyle, labelStyle, addBtnStyle, removeBtnStyle }) {
  const [lastAddedId, setLastAddedId] = useState(() => draft.expenses.length === 1 ? draft.expenses[0].id : null);
  const add = () => {
    const newId = crypto.randomUUID();
    setDraft(prev => ({
      ...prev,
      expenses: [...prev.expenses, { id: newId, name: "", amount: 0, frequency: "monthly", startDate: "" }],
    }));
    setLastAddedId(newId);
  };
  const remove = (id) => {
    setDraft(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
  };
  const set = (id, key, value) => {
    setDraft(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === id ? { ...e, [key]: value } : e),
    }));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.blue }}>RECURRING EXPENSES</div>
          <div style={{ fontSize: 10, color: colors.dim, marginTop: 2 }}>Mortgage, rent, utilities, subscriptions, etc.</div>
        </div>
        <button onClick={add} style={addBtnStyle}>+ Add</button>
      </div>
      {draft.expenses.map((exp, idx) => (
        <div key={exp.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 6, marginBottom: 8, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input value={exp.name} onChange={e => set(exp.id, "name", e.target.value)}
              placeholder={PLACEHOLDER_EXPENSES[idx] || ""} style={inputStyle} autoFocus={exp.id === lastAddedId} />
          </div>
          <div>
            <label style={labelStyle}>Amount</label>
            <input type="number" step="0.01" value={exp.amount || ""} onChange={e => set(exp.id, "amount", parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Frequency</label>
            <select value={exp.frequency} onChange={e => set(exp.id, "frequency", e.target.value)} style={inputStyle}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input type="date" value={exp.startDate} onChange={e => set(exp.id, "startDate", e.target.value)} style={inputStyle} />
          </div>
          <button onClick={() => remove(exp.id)} style={removeBtnStyle}>x</button>
        </div>
      ))}
      {draft.expenses.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, color: colors.dim, fontSize: 10 }}>
          No expenses yet. Click "+ Add" to add recurring expenses.
        </div>
      )}
    </div>
  );
}

function ObligationsStep({ draft, setDraft, inputStyle, labelStyle, addBtnStyle, removeBtnStyle }) {
  const [lastObId, setLastObId] = useState(() => draft.oneTimeObligations.length === 1 ? draft.oneTimeObligations[0].id : null);
  const [lastSaleId, setLastSaleId] = useState(null);

  const addOb = () => {
    const newId = crypto.randomUUID();
    setDraft(prev => ({
      ...prev,
      oneTimeObligations: [...prev.oneTimeObligations, { id: newId, name: "", amount: 0, dueDate: "", isPaid: false }],
    }));
    setLastObId(newId);
  };
  const removeOb = (id) => {
    setDraft(prev => ({ ...prev, oneTimeObligations: prev.oneTimeObligations.filter(o => o.id !== id) }));
  };
  const setOb = (id, key, value) => {
    setDraft(prev => ({
      ...prev,
      oneTimeObligations: prev.oneTimeObligations.map(o => o.id === id ? { ...o, [key]: value } : o),
    }));
  };

  const addSale = () => {
    const newId = crypto.randomUUID();
    setDraft(prev => ({
      ...prev,
      capitalSales: [...prev.capitalSales, { id: newId, name: "", expectedAmount: 0, costBasis: 0, expectedDate: "", isLongTerm: true }],
    }));
    setLastSaleId(newId);
  };
  const removeSale = (id) => {
    setDraft(prev => ({ ...prev, capitalSales: prev.capitalSales.filter(s => s.id !== id) }));
  };
  const setSale = (id, key, value) => {
    setDraft(prev => ({
      ...prev,
      capitalSales: prev.capitalSales.map(s => s.id === id ? { ...s, [key]: value } : s),
    }));
  };

  return (
    <div>
      {/* One-time obligations */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.blue }}>ONE-TIME PAYMENTS</div>
          <div style={{ fontSize: 10, color: colors.dim, marginTop: 2 }}>Tax bills, large payments, or debts due before your target date.</div>
        </div>
        <button onClick={addOb} style={addBtnStyle}>+ Add</button>
      </div>
      {draft.oneTimeObligations.map(ob => (
        <div key={ob.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, marginBottom: 8, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input value={ob.name} onChange={e => setOb(ob.id, "name", e.target.value)}
              placeholder="2025 Federal Tax Bill" style={inputStyle} autoFocus={ob.id === lastObId} />
          </div>
          <div>
            <label style={labelStyle}>Amount</label>
            <input type="number" step="0.01" value={ob.amount || ""} onChange={e => setOb(ob.id, "amount", parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={ob.dueDate} onChange={e => setOb(ob.id, "dueDate", e.target.value)} style={inputStyle} />
          </div>
          <button onClick={() => removeOb(ob.id)} style={removeBtnStyle}>x</button>
        </div>
      ))}
      {draft.oneTimeObligations.length === 0 && (
        <div style={{ textAlign: "center", padding: "10px 0 16px", color: colors.dim, fontSize: 10 }}>
          No one-time payments yet. Click "+ Add" to add any.
        </div>
      )}

      {/* Planned asset sales */}
      <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 8, paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: colors.blue }}>PLANNED ASSET SALES</div>
            <div style={{ fontSize: 10, color: colors.dim, marginTop: 2 }}>Vehicles, electronics, or other assets you plan to sell.</div>
          </div>
          <button onClick={addSale} style={addBtnStyle}>+ Add</button>
        </div>
        {draft.capitalSales.map(sale => (
          <div key={sale.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto", gap: 6, marginBottom: 8, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Description</label>
              <input value={sale.name} onChange={e => setSale(sale.id, "name", e.target.value)}
                placeholder="2019 Honda Civic" style={inputStyle} autoFocus={sale.id === lastSaleId} />
            </div>
            <div>
              <label style={labelStyle}>Sale Price</label>
              <input type="number" step="0.01" value={sale.expectedAmount || ""} onChange={e => setSale(sale.id, "expectedAmount", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cost Basis</label>
              <input type="number" step="0.01" value={sale.costBasis || ""} onChange={e => setSale(sale.id, "costBasis", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Sale Date</label>
              <input type="date" value={sale.expectedDate} onChange={e => setSale(sale.id, "expectedDate", e.target.value)} style={inputStyle} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: sale.isLongTerm ? colors.green : colors.amber, cursor: "pointer", paddingBottom: 4 }}>
              <input type="checkbox" checked={sale.isLongTerm} onChange={e => setSale(sale.id, "isLongTerm", e.target.checked)} style={{ accentColor: colors.blue }} />
              {sale.isLongTerm ? "LT" : "ST"}
            </label>
            <button onClick={() => removeSale(sale.id)} style={removeBtnStyle}>x</button>
          </div>
        ))}
        {draft.capitalSales.length === 0 && (
          <div style={{ textAlign: "center", padding: "10px 0 4px", color: colors.dim, fontSize: 10 }}>
            No planned sales. Click "+ Add" if you plan to sell any assets.
          </div>
        )}
      </div>
    </div>
  );
}

function TaxDateStep({ draft, update, updateTax, updateDOB, inputStyle, labelStyle }) {
  const isMFJ = draft.taxConfig.filingStatus === "mfj";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: colors.blue, marginBottom: 4 }}>TAX & LIQUIDATION DATE</div>
      <div style={{ fontSize: 10, color: colors.dim, marginBottom: 16 }}>
        GreenLight uses progressive tax brackets automatically. You can fine-tune rates in Settings later.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Filing Status</label>
          <select value={draft.taxConfig.filingStatus} onChange={e => updateTax("filingStatus", e.target.value)} style={inputStyle}>
            <option value="single">Single</option>
            <option value="mfj">Married Filing Jointly</option>
            <option value="mfs">Married Filing Separately</option>
            <option value="hoh">Head of Household</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>State</label>
          <select value={draft.taxConfig.state} onChange={e => updateTax("state", e.target.value)} style={inputStyle}>
            <option value="">-- Select State --</option>
            {STATE_CODES.filter(c => c).map(code => (
              <option key={code} value={code}>{code} — {STATE_TAXES[code]?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Liquidation Date</label>
          <input type="date" value={draft.sellDate} min={today}
            onChange={e => update("sellDate", e.target.value)} style={inputStyle} />
          <div style={{ fontSize: 8, color: colors.dim, marginTop: 2 }}>When do you plan to sell or liquidate?</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMFJ ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
        {isMFJ ? (
          <>
            <div>
              <label style={labelStyle}>Your W-2 Income</label>
              <input type="number" step="1000" value={draft.taxConfig.yourW2 || ""}
                onChange={e => updateTax("yourW2", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Spouse W-2 Income</label>
              <input type="number" step="1000" value={draft.taxConfig.spouseW2 || ""}
                onChange={e => updateTax("spouseW2", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
          </>
        ) : (
          <div>
            <label style={labelStyle}>W-2 Income</label>
            <input type="number" step="1000" value={draft.taxConfig.yourW2 || ""}
              onChange={e => updateTax("yourW2", parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
        )}
        <div>
          <label style={labelStyle}>Standard Deduction</label>
          <input type="number" step="100" value={draft.taxConfig.standardDeduction || ""}
            onChange={e => updateTax("standardDeduction", parseFloat(e.target.value) || 0)} style={inputStyle} />
          <div style={{ fontSize: 8, color: colors.dim, marginTop: 2 }}>{isMFJ ? "$31,400 for MFJ (2025)" : "$15,700 for single (2025)"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Birth Month</label>
          <select value={draft.dateOfBirth.month} onChange={e => updateDOB("month", e.target.value)} style={inputStyle}>
            <option value="">-- Month --</option>
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
              <option key={i + 1} value={String(i + 1)}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Birth Year</label>
          <input type="number" value={draft.dateOfBirth.year} onChange={e => updateDOB("year", e.target.value)}
            placeholder="1990" style={inputStyle} />
        </div>
      </div>
      <div style={{ fontSize: 8, color: colors.dim, marginTop: 4 }}>
        Used to calculate early-withdrawal penalties and retirement eligibility.
      </div>
    </div>
  );
}

function DataWarningStep() {
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⚠</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: colors.amber, marginBottom: 10 }}>
        Your data lives in this browser only
      </div>
      <div style={{ fontSize: 13, color: colors.dim, lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
        GreenLight stores everything in your browser's local storage.
        There is no server, no account, and no automatic backup.
      </div>
      <div style={{
        background: colors.bgInput, border: `1px solid ${colors.border}`,
        borderRadius: 6, padding: 14, marginTop: 16, maxWidth: 480, margin: "16px auto 0",
        fontSize: 12, color: colors.text, lineHeight: 1.6,
      }}>
        Use <strong style={{ color: colors.blue }}>Settings → Export</strong> regularly to back up your data.
        Clearing browser data, switching browsers, or using incognito mode will erase everything.
      </div>
      <div style={{ maxWidth: 480, margin: "14px auto 0", fontSize: 11, color: colors.dim, lineHeight: 1.6 }}>
        GreenLight calculates tax estimates and financial projections for personal planning purposes only —
        not tax or legal advice. Always consult a qualified professional before making significant financial decisions.
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{
        display: "inline-block", width: 12, height: 12, borderRadius: "50%",
        background: colors.green, boxShadow: `0 0 10px ${colors.green}`,
        marginBottom: 14,
      }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 10 }}>
        Free, open-source financial planning.
      </div>
      <div style={{ fontSize: 13, color: colors.dim, lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
        All your data lives in your browser — nothing is sent to a server. No account needed.
      </div>
      <div style={{
        background: colors.bgInput, border: `1px solid ${colors.border}`,
        borderRadius: 6, padding: 14, marginTop: 16, maxWidth: 460, margin: "16px auto 0",
        fontSize: 12, color: colors.text, lineHeight: 1.6,
      }}>
        Want full control?{" "}
        <a href="https://github.com/NimbleEngineer21/greenlight" target="_blank" rel="noopener noreferrer"
          style={{ color: colors.blue, textDecoration: "underline" }}>
          Run it locally
        </a>{" "}
        from the source code — or self-host for your household.
      </div>
    </div>
  );
}

function PlanningStep({ selected, onSelect }) {
  const options = [
    { key: "home", label: "Home", desc: "Mortgage, closing costs, lender comparison" },
    { key: "vehicle", label: "Car", desc: "Auto loan, purchase costs, lender comparison" },
    { key: null, label: "Not right now", desc: "You can activate this later from the Dashboard" },
  ];

  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
        Are you planning a major purchase?
      </div>
      <div style={{ fontSize: 12, color: colors.dim, marginBottom: 20 }}>
        This unlocks loan calculators, cost estimates, and readiness projections.
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {options.map(opt => (
          <button
            key={opt.key ?? "none"}
            onClick={() => onSelect(opt.key)}
            style={{
              ...styles.btn,
              padding: "14px 24px",
              fontSize: 14,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              minWidth: 140,
              color: selected === opt.key ? colors.green : colors.dim,
              borderColor: selected === opt.key ? colors.green : colors.border,
            }}
          >
            <span style={{ fontWeight: 600 }}>{opt.label}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
