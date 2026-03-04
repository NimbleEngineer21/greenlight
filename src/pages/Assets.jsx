import React, { useState, useMemo } from "react";
import { colors, styles } from "../theme.js";
import { calcSummary, calcRetirementNet, fmt, fmtQty } from "../lib/calculations.js";
import { RETIREMENT_ACCOUNT_TYPES, uuid } from "../data/defaults.js";

const EMPTY_ASSET = {
  platform: "", name: "", symbol: "", quantity: 0, costBasis: 0,
  acquisitionDate: "", priceKey: "", feeType: "gem", holdingType: "crypto", notes: "",
};

const labelSt = { fontSize: 13, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5 };
const gridDivider = { gridColumn: "1/3", borderTop: `1px solid ${colors.border}`, margin: "5px 0" };
const sourceLink = { color: colors.blue, fontSize: 12, marginLeft: 5, textDecoration: "none", opacity: 0.7 };

const isRoth = (type) => type === "roth_401k" || type === "roth_ira";

export default function Assets({ state, updateState, prices }) {
  const [editing, setEditing] = useState(null); // asset id or "new"
  const [form, setForm] = useState({ ...EMPTY_ASSET });
  const [sortBy, setSortBy] = useState("platform");

  const c = useMemo(() => calcSummary(state, prices), [state, prices]);
  const ret = useMemo(() => calcRetirementNet(state.retirement), [state.retirement]);

  // Capital sales handlers
  const addCapitalSale = () => {
    const sale = { id: uuid(), name: "", expectedAmount: 0, costBasis: 0, expectedDate: "", isLongTerm: true };
    updateState(prev => ({ ...prev, capitalSales: [...(prev.capitalSales || []), sale] }));
  };
  const updateCapitalSale = (id, key, value) => {
    updateState(prev => ({ ...prev, capitalSales: (prev.capitalSales || []).map(s => s.id === id ? { ...s, [key]: value } : s) }));
  };
  const removeCapitalSale = (id) => {
    updateState(prev => ({ ...prev, capitalSales: (prev.capitalSales || []).filter(s => s.id !== id) }));
  };

  // Retirement handlers
  const updateRetirement = (key, value) => {
    updateState(prev => ({ ...prev, retirement: { ...prev.retirement, [key]: value } }));
  };
  const addRetirementAccount = () => {
    const acct = { id: uuid(), accountType: "pretax_401k", platform: "", balance: 0, contributions: 0 };
    updateState(prev => ({ ...prev, retirement: { ...prev.retirement, accounts: [...(prev.retirement.accounts || []), acct] } }));
  };
  const updateRetirementAccount = (id, key, value) => {
    updateState(prev => ({
      ...prev,
      retirement: { ...prev.retirement, accounts: prev.retirement.accounts.map(a => a.id === id ? { ...a, [key]: value } : a) },
    }));
  };
  const removeRetirementAccount = (id) => {
    updateState(prev => ({ ...prev, retirement: { ...prev.retirement, accounts: prev.retirement.accounts.filter(a => a.id !== id) } }));
  };

  const assets = [...(state.assets || [])].sort((a, b) => {
    if (sortBy === "platform") return a.platform.localeCompare(b.platform);
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "value") return (b.quantity * (prices[b.priceKey] || 0)) - (a.quantity * (prices[a.priceKey] || 0));
    if (sortBy === "gainLoss") {
      const aGL = (a.quantity * (prices[a.priceKey] || 0)) - a.costBasis;
      const bGL = (b.quantity * (prices[b.priceKey] || 0)) - b.costBasis;
      return bGL - aGL;
    }
    return 0;
  });

  const startAdd = () => {
    setForm({ ...EMPTY_ASSET });
    setEditing("new");
  };

  const startEdit = (asset) => {
    setForm({ ...asset });
    setEditing(asset.id);
  };

  const save = () => {
    if (editing === "new") {
      const newAsset = { ...form, id: uuid() };
      updateState(prev => ({ ...prev, assets: [...(prev.assets || []), newAsset] }));
    } else {
      updateState(prev => ({
        ...prev,
        assets: prev.assets.map(a => a.id === editing ? { ...form } : a),
      }));
    }
    setEditing(null);
  };

  const remove = (id) => {
    updateState(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) }));
  };

  const inputStyle = styles.input;
  const btnStyle = styles.btn;

  return (
    <div>
      {/* Tax + Fees panels (moved from Dashboard) */}
      <div className="gl-cards-2" style={{ gap: 12, marginBottom: 18 }}>
        {/* Cap Gains Netting */}
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18 }}>
          <div style={{ ...labelSt, marginBottom: 10 }}>Cap Gains Tax Netting</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 18px", fontSize: 15 }}>
            <span style={{ color: colors.dim }}>LT Gains:</span><span style={{ textAlign: "right", color: colors.green }}>{fmt(c.ltGains)}</span>
            <span style={{ color: colors.dim }}>LT Losses:</span><span style={{ textAlign: "right", color: colors.red }}>{fmt(c.ltLosses)}</span>
            <span style={{ color: colors.dim, fontWeight: 700 }}>Net LT:</span><span style={{ textAlign: "right", color: c.netLT >= 0 ? colors.green : colors.red, fontWeight: 700 }}>{fmt(c.netLT)}</span>
            <span style={{ color: colors.dim }}>ST Gains:</span><span style={{ textAlign: "right", color: colors.green }}>{fmt(c.stGains)}</span>
            <span style={{ color: colors.dim }}>ST Losses:</span><span style={{ textAlign: "right", color: colors.red }}>{fmt(c.stLosses)}</span>
            <span style={{ color: colors.dim, fontWeight: 700 }}>Net ST:</span><span style={{ textAlign: "right", color: c.netST >= 0 ? colors.green : colors.red, fontWeight: 700 }}>{fmt(c.netST)}</span>
            <div style={gridDivider} />
            <span style={{ color: colors.dim }}>Net Gain/Loss:</span><span style={{ textAlign: "right", color: c.totalNetGainLoss >= 0 ? colors.green : colors.red, fontWeight: 700, fontSize: 18 }}>{fmt(c.totalNetGainLoss)}</span>

            {c.taxDetail ? (
              <>
                <span style={{ color: colors.dim }}>LTCG Tax:</span>
                <span style={{ textAlign: "right", color: c.taxDetail.ltcgTax > 0 ? colors.red : colors.dim }}>
                  {fmt(c.taxDetail.ltcgTax)}
                  {c.taxDetail.ltcgMarginalRate > 0 && <span style={{ fontSize: 12, color: colors.dim, marginLeft: 4 }}>@{Math.round(c.taxDetail.ltcgMarginalRate * 100)}%</span>}
                </span>
                <span style={{ color: colors.dim }}>STCG Tax:</span>
                <span style={{ textAlign: "right", color: c.taxDetail.stcgTax > 0 ? colors.red : colors.dim }}>{fmt(c.taxDetail.stcgTax)}</span>
                <span style={{ color: colors.dim }}>NIIT:</span>
                <span style={{ textAlign: "right", color: c.taxDetail.niit > 0 ? colors.red : colors.dim }}>
                  {fmt(c.taxDetail.niit)}
                  <a href="https://www.irs.gov/individuals/net-investment-income-tax" target="_blank" rel="noopener noreferrer"
                    style={{ color: colors.blue, fontSize: 11, marginLeft: 4, textDecoration: "none", opacity: 0.6 }} title="IRS NIIT">?</a>
                </span>
                <span style={{ color: colors.dim }}>State Tax:</span>
                <span style={{ textAlign: "right", color: c.taxDetail.stateTax > 0 ? colors.red : colors.green }}>{fmt(c.taxDetail.stateTax)}</span>
                <div style={{ ...gridDivider, margin: "3px 0" }} />
                <span style={{ color: colors.dim, fontWeight: 700 }}>Total Tax:</span>
                <span style={{ textAlign: "right", color: c.tax > 0 ? colors.red : colors.green, fontWeight: 700, fontSize: 18 }}>{fmt(c.tax)}</span>
              </>
            ) : (
              <>
                <span style={{ color: colors.dim }}>Cap Gains Tax:</span>
                <span style={{ textAlign: "right", color: c.tax > 0 ? colors.red : colors.green, fontWeight: 700, fontSize: 18 }}>{fmt(c.tax)}</span>
              </>
            )}
            {c.totalNetGainLoss < 0 && (
              <span style={{ gridColumn: "1/3", fontSize: 14, color: colors.green, marginTop: 4 }}>
                Net loss — $0 tax. ${c.deductible.toLocaleString()} deductible vs ordinary income.
              </span>
            )}
          </div>
        </div>

        {/* Rates & Fees */}
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18 }}>
          <div style={{ ...labelSt, marginBottom: 10 }}>Rates & Fees</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 18px", fontSize: 15 }}>
            {c.taxDetail ? (
              <>
                <span style={{ color: colors.dim }}>Mode:</span>
                <span style={{ textAlign: "right" }}>
                  Progressive ({state.taxConfig.taxYear || 2025})
                  <a href="https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025" target="_blank" rel="noopener noreferrer"
                    style={sourceLink} title="IRS Rev. Proc. 2024-40">source</a>
                </span>
                <span style={{ color: colors.dim }}>LTCG Rate:</span>
                <span style={{ textAlign: "right" }}>
                  {c.taxDetail.ltcgMarginalRate > 0 ? `${Math.round(c.taxDetail.ltcgMarginalRate * 100)}% marginal` : "0%"}
                  {c.taxDetail.ltcgEffectiveRate > 0 && ` (${(c.taxDetail.ltcgEffectiveRate * 100).toFixed(1)}% eff)`}
                </span>
              </>
            ) : (
              <>
                <span style={{ color: colors.dim }}>LT Rate:</span><span style={{ textAlign: "right" }}>{Math.round(state.taxConfig.ltcgRate * 100)}% + {state.taxConfig.niitRate * 100}% NIIT = {Math.round((state.taxConfig.ltcgRate + state.taxConfig.niitRate) * 1000) / 10}%</span>
                <span style={{ color: colors.dim }}>ST Rate:</span><span style={{ textAlign: "right" }}>{Math.round(state.taxConfig.stcgRate * 100)}% + {state.taxConfig.niitRate * 100}% NIIT = {Math.round((state.taxConfig.stcgRate + state.taxConfig.niitRate) * 1000) / 10}%</span>
              </>
            )}
            <span style={{ color: colors.dim }}>Retirement:</span><span style={{ textAlign: "right" }}>
              {state.retirement?.enabled ? `${Math.round(state.retirement.penaltyRate * 100)}% penalty + ${Math.round(state.retirement.taxRate * 100)}% tax` : "Excluded"}
            </span>
            <span style={{ color: colors.dim }}>State ({state.taxConfig.state || "N/A"}):</span>
            <span style={{ textAlign: "right", color: c.taxDetail?.stateTax > 0 ? colors.text : colors.green }}>
              {c.taxDetail ? (c.taxDetail.stateTax > 0 ? fmt(c.taxDetail.stateTax) : "No tax") : "0%"}
              <a href="https://taxfoundation.org/data/all/state/state-income-tax-rates-2025/" target="_blank" rel="noopener noreferrer"
                style={sourceLink} title="Tax Foundation 2025">source</a>
            </span>
            <div style={gridDivider} />
            <span style={{ color: colors.dim }}>Sell Fees Total:</span><span style={{ textAlign: "right", color: colors.red }}>{fmt(c.totalFees)}</span>
            {Object.entries(state.platforms).map(([key, plat]) => (
              <React.Fragment key={key}>
                <span style={{ color: colors.dim, fontSize: 14 }}>{plat.name}:</span>
                <span style={{ textAlign: "right", fontSize: 14 }}>
                  {plat.feePerShare != null ? `$${plat.feePerShare}/sh + $${plat.flatFee} bulk` : `${(plat.feePercent * 100).toFixed(1)}%`}
                </span>
              </React.Fragment>
            ))}
            <div style={gridDivider} />
            <span style={{ color: colors.amber, fontSize: 14 }}>★ = $0 cost basis</span>
            <span style={{ textAlign: "right", fontSize: 14, color: colors.amber }}>CC rewards — full sale is gain</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1 }}>ASSETS</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ ...inputStyle, width: "auto" }}>
            <option value="platform">Sort: Platform</option>
            <option value="name">Sort: Name</option>
            <option value="value">Sort: Value</option>
            <option value="gainLoss">Sort: Gain/Loss</option>
          </select>
          <button onClick={startAdd} style={{ ...btnStyle, color: colors.green }}>+ Add Asset</button>
        </div>
      </div>

      {/* Edit/Add form */}
      {editing && (
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: colors.dim, marginBottom: 8, fontWeight: 600 }}>{editing === "new" ? "ADD ASSET" : "EDIT ASSET"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { k: "platform", l: "Platform", ph: "ComputerShare" },
              { k: "name", l: "Name", ph: "GME" },
              { k: "symbol", l: "Symbol", ph: "GME" },
              { k: "priceKey", l: "Price Key", ph: "gme (Gemini ticker)" },
              { k: "quantity", l: "Quantity", ph: "520", type: "number" },
              { k: "costBasis", l: "Cost Basis", ph: "22185.58", type: "number" },
              { k: "acquisitionDate", l: "Acquisition Date", type: "date" },
              { k: "feeType", l: "Fee Type", select: true, options: Object.entries(state.platforms).map(([k, v]) => ({ value: k, label: v.name })).concat([{ value: "none", label: "None" }]) },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 }}>{f.l}</label>
                {f.select ? (
                  <select value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} style={inputStyle}>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type={f.type || "text"} step="any" value={form[f.k]} placeholder={f.ph}
                    onChange={e => setForm(p => ({ ...p, [f.k]: f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 }}>Notes</label>
              <input value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} placeholder="Optional notes" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={save} style={{ ...btnStyle, color: colors.green }}>Save</button>
            <button onClick={() => setEditing(null)} style={btnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {/* Asset table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
        <thead>
          <tr style={{ background: colors.bgHeader, borderBottom: `2px solid ${colors.border}` }}>
            {["Platform", "Name", "Symbol", "Qty", "Cost Basis", "Price", "Value", "Gain/Loss", "Fee Type", "LT/ST", ""].map(h => (
              <th key={h} style={{
                padding: "10px 8px", textAlign: ["Platform", "Name", "Symbol", "Fee Type"].includes(h) ? "left" : "right",
                color: colors.dim, fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: 1,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((a, i) => {
            const price = a.priceKey ? (prices[a.priceKey] || 0) : 0;
            const value = a.priceKey === null ? a.costBasis : a.quantity * price;
            const gl = value - a.costBasis;
            return (
              <tr key={a.id} style={{ borderBottom: "1px solid #0e1620", background: i % 2 ? colors.bgAlt : "transparent" }}>
                <td style={{ padding: "5px", color: colors.dim }}>{a.platform}</td>
                <td>{a.name}{a.notes && <span title={a.notes} style={{ marginLeft: 3, fontSize: 7, color: colors.amber, cursor: "help", verticalAlign: "super" }}>★</span>}</td>
                <td style={{ color: colors.dim }}>{a.symbol}</td>
                <td style={{ textAlign: "right", color: colors.dim }}>{fmtQty(a.quantity)}</td>
                <td style={{ textAlign: "right", color: colors.blue }}>{fmt(a.costBasis)}</td>
                <td style={{ textAlign: "right" }}>{a.priceKey === null ? "—" : fmt(price)}</td>
                <td style={{ textAlign: "right" }}>{fmt(value)}</td>
                <td style={{ textAlign: "right", color: gl > 0 ? colors.green : gl < 0 ? colors.red : colors.dim, fontWeight: 600 }}>{fmt(gl)}</td>
                <td style={{ color: colors.dim }}>{state.platforms[a.feeType]?.name || a.feeType}</td>
                <td style={{ textAlign: "right", fontSize: 8 }}>
                  {a.acquisitionDate ? (
                    new Date(a.acquisitionDate + "T12:00:00") < new Date(new Date(state.sellDate + "T12:00:00").getTime() - 365.25 * 864e5)
                      ? <span style={{ color: colors.green }}>LT</span>
                      : <span style={{ color: colors.amber }}>ST</span>
                  ) : "—"}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => startEdit(a)} style={{ ...btnStyle, fontSize: 9, padding: "2px 6px", marginRight: 4 }}>Edit</button>
                  <button onClick={() => remove(a.id)} style={{ ...btnStyle, fontSize: 9, padding: "2px 6px", color: colors.red }}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {assets.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: colors.dim }}>
          No assets yet. Click "+ Add Asset" or go to Import to upload CSV/XLSX files.
        </div>
      )}

      {/* Planned Asset Sales */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Planned Asset Sales</div>
          <button onClick={addCapitalSale} style={{ ...btnStyle, color: colors.green }}>+ Add</button>
        </div>
        {(state.capitalSales || []).map(sale => {
          const gainLoss = sale.expectedAmount - sale.costBasis;
          return (
            <div key={sale.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
              <div>
                <label style={labelSt}>Description</label>
                <input value={sale.name} onChange={e => updateCapitalSale(sale.id, "name", e.target.value)} style={inputStyle} placeholder="2019 Honda Civic" />
              </div>
              <div>
                <label style={labelSt}>Sale Price</label>
                <input type="number" step="0.01" value={sale.expectedAmount} onChange={e => updateCapitalSale(sale.id, "expectedAmount", parseFloat(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={labelSt}>Cost Basis</label>
                <input type="number" step="0.01" value={sale.costBasis} onChange={e => updateCapitalSale(sale.id, "costBasis", parseFloat(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={labelSt}>Sale Date</label>
                <input type="date" value={sale.expectedDate} onChange={e => updateCapitalSale(sale.id, "expectedDate", e.target.value)} style={inputStyle} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: sale.isLongTerm ? colors.green : colors.amber, cursor: "pointer", paddingBottom: 4 }}>
                <input type="checkbox" checked={sale.isLongTerm} onChange={e => updateCapitalSale(sale.id, "isLongTerm", e.target.checked)} style={{ accentColor: colors.blue }} />
                {sale.isLongTerm ? "LT" : "ST"}
              </label>
              <button onClick={() => removeCapitalSale(sale.id)} style={{ ...btnStyle, color: colors.red, padding: "5px 10px" }}>×</button>
              {(sale.expectedAmount > 0 || sale.costBasis > 0) && (
                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: gainLoss >= 0 ? colors.green : colors.red, paddingLeft: 4, marginTop: -4, marginBottom: 4 }}>
                  {gainLoss >= 0 ? "Gain" : "Loss"}: {fmt(gainLoss)} ({sale.isLongTerm ? "long-term" : "short-term"})
                </div>
              )}
            </div>
          );
        })}
        {(state.capitalSales || []).length === 0 && (
          <div style={{ fontSize: 12, color: colors.dim, padding: 8 }}>No planned asset sales. Add sales like vehicles or property you expect to sell.</div>
        )}
      </div>

      {/* Retirement Accounts */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Retirement Accounts</div>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: colors.dim, cursor: "pointer" }}>
            <input type="checkbox" checked={state.retirement?.enabled ?? false}
              onChange={e => updateRetirement("enabled", e.target.checked)} style={{ accentColor: colors.blue }} />
            Include in liquidation
          </label>
        </div>
        {state.retirement?.enabled && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Early Withdrawal Penalty</label>
                <input type="number" step="0.01" value={state.retirement.penaltyRate}
                  onChange={e => updateRetirement("penaltyRate", parseFloat(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={labelSt}>Federal Tax Rate</label>
                <input type="number" step="0.01" value={state.retirement.taxRate}
                  onChange={e => updateRetirement("taxRate", parseFloat(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={labelSt}>State Tax Rate</label>
                <input type="number" step="0.01" value={state.retirement.stateTaxRate}
                  onChange={e => updateRetirement("stateTaxRate", parseFloat(e.target.value) || 0)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 }}>Accounts</div>
              <button onClick={addRetirementAccount} style={{ ...btnStyle, color: colors.green }}>+ Add Account</button>
            </div>

            {(state.retirement.accounts || []).map(acct => (
              <div key={acct.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                <div>
                  <label style={labelSt}>Account Type</label>
                  <select value={acct.accountType} onChange={e => updateRetirementAccount(acct.id, "accountType", e.target.value)} style={inputStyle}>
                    {Object.entries(RETIREMENT_ACCOUNT_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Platform</label>
                  <input value={acct.platform} onChange={e => updateRetirementAccount(acct.id, "platform", e.target.value)}
                    placeholder="Empower" style={inputStyle} />
                </div>
                <div>
                  <label style={labelSt}>Balance</label>
                  <input type="number" step="0.01" value={acct.balance}
                    onChange={e => updateRetirementAccount(acct.id, "balance", parseFloat(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelSt}>{isRoth(acct.accountType) ? "Contributions" : "Contributions (N/A)"}</label>
                  <input type="number" step="0.01" value={acct.contributions}
                    onChange={e => updateRetirementAccount(acct.id, "contributions", parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, opacity: isRoth(acct.accountType) ? 1 : 0.4 }}
                    disabled={!isRoth(acct.accountType)}
                  />
                </div>
                <button onClick={() => removeRetirementAccount(acct.id)} style={{ ...btnStyle, color: colors.red, padding: "5px 10px" }}>×</button>
              </div>
            ))}

            {(state.retirement.accounts || []).length === 0 && (
              <div style={{ fontSize: 12, color: colors.dim, padding: 8 }}>No retirement accounts. Click "+ Add Account" to add one.</div>
            )}

            {ret.accounts.length > 0 && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Account", "Balance", "Penalty", "Tax", "Net"].map(h => (
                        <th key={h} style={{ padding: "4px 6px", textAlign: h === "Account" ? "left" : "right", color: colors.dim, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ret.accounts.map(acct => (
                      <tr key={acct.id}>
                        <td style={{ padding: "4px 6px" }}>{RETIREMENT_ACCOUNT_TYPES[acct.accountType]}{acct.platform ? ` (${acct.platform})` : ""}</td>
                        <td style={{ textAlign: "right" }}>{fmt(acct.balance)}</td>
                        <td style={{ textAlign: "right", color: colors.red }}>{fmt(-acct.penalty)}</td>
                        <td style={{ textAlign: "right", color: colors.red }}>{fmt(-acct.tax)}</td>
                        <td style={{ textAlign: "right", color: colors.green, fontWeight: 600 }}>{fmt(acct.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td style={{ padding: "6px", fontWeight: 700 }}>TOTAL</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(ret.gross)}</td>
                      <td />
                      <td style={{ textAlign: "right", fontWeight: 700, color: colors.red }}>{fmt(-ret.deductions)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: colors.green, fontSize: 14 }}>{fmt(ret.net)}</td>
                    </tr>
                  </tfoot>
                </table>
                <div style={{ fontSize: 11, color: colors.dim, marginTop: 6 }}>
                  Roth accounts: only earnings (balance − contributions) are penalized and taxed.
                  "Don't Know" uses conservative full-balance calculation.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
