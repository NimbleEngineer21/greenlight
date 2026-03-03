import { useState } from "react";
import { colors, styles } from "../theme.js";
import { fmt } from "../lib/calculations.js";

export default function CashAccounts({ state, updateState }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ platform: "", name: "", balance: 0 });

  const accounts = state.cashAccounts || [];
  const total = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  const startAdd = () => {
    setForm({ platform: "", name: "", balance: 0 });
    setEditing("new");
  };

  const startEdit = (account) => {
    setForm({ ...account });
    setEditing(account.id);
  };

  const save = () => {
    if (editing === "new") {
      const newAccount = { ...form, id: crypto.randomUUID() };
      updateState(prev => ({ ...prev, cashAccounts: [...(prev.cashAccounts || []), newAccount] }));
    } else {
      updateState(prev => ({
        ...prev,
        cashAccounts: prev.cashAccounts.map(a => a.id === editing ? { ...form } : a),
      }));
    }
    setEditing(null);
  };

  const remove = (id) => {
    updateState(prev => ({ ...prev, cashAccounts: prev.cashAccounts.filter(a => a.id !== id) }));
  };

  const inputStyle = styles.input;
  const btnStyle = styles.btn;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1 }}>CASH ACCOUNTS</h2>
        <button onClick={startAdd} style={{ ...btnStyle, color: colors.green }}>+ Add Account</button>
      </div>

      {editing && (
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: colors.dim, marginBottom: 8, fontWeight: 600 }}>{editing === "new" ? "ADD ACCOUNT" : "EDIT ACCOUNT"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 }}>Platform</label>
              <input value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
                placeholder="NGFCU" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 }}>Account Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Checking" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 }}>Balance</label>
              <input type="number" step="0.01" value={form.balance}
                onChange={e => setForm(p => ({ ...p, balance: parseFloat(e.target.value) || 0 }))}
                style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={save} style={{ ...btnStyle, color: colors.green }}>Save</button>
            <button onClick={() => setEditing(null)} style={btnStyle}>Cancel</button>
          </div>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
        <thead>
          <tr style={{ background: colors.bgHeader, borderBottom: `2px solid ${colors.border}` }}>
            {["Platform", "Account", "Balance", ""].map(h => (
              <th key={h} style={{
                padding: "10px 8px", textAlign: h === "Balance" ? "right" : "left",
                color: colors.dim, fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: 1,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a, i) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #0e1620", background: i % 2 ? colors.bgAlt : "transparent" }}>
              <td style={{ padding: "6px 8px" }}>{a.platform}</td>
              <td>{a.name}</td>
              <td style={{ textAlign: "right", color: colors.green, fontWeight: 600 }}>{fmt(a.balance)}</td>
              <td style={{ textAlign: "right" }}>
                <button onClick={() => startEdit(a)} style={{ ...btnStyle, fontSize: 9, padding: "2px 6px", marginRight: 4 }}>Edit</button>
                <button onClick={() => remove(a.id)} style={{ ...btnStyle, fontSize: 9, padding: "2px 6px", color: colors.red }}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${colors.border}` }}>
            <td colSpan={2} style={{ padding: "8px", fontWeight: 700, fontSize: 12 }}>TOTAL</td>
            <td style={{ textAlign: "right", fontWeight: 700, color: colors.green, fontSize: 15 }}>{fmt(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      {accounts.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: colors.dim }}>
          No cash accounts yet. Click "+ Add Account" to add one.
        </div>
      )}
    </div>
  );
}
