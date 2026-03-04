import { useState, useMemo } from "react";
import { colors, styles } from "../theme.js";
import { createDefaultState } from "../data/defaults.js";
import { exportState, importState } from "../lib/storage.js";
import { getConsent, setConsent, track } from "../lib/analytics.js";
import { STATE_TAXES } from "../data/stateTaxes.js";
import { getBrackets } from "../data/taxBrackets.js";

export default function Settings({ state, updateState, replaceState }) {
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [newPlatformKey, setNewPlatformKey] = useState("");
  const [newPlatformName, setNewPlatformName] = useState("");
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [platformKeyError, setPlatformKeyError] = useState(null);
  const [newOverrideKey, setNewOverrideKey] = useState("");
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [overrideKeyError, setOverrideKeyError] = useState(null);

  // Encrypted export form state
  const [showExportForm, setShowExportForm] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("");
  const [exportPasswordError, setExportPasswordError] = useState(null);
  const [exportInProgress, setExportInProgress] = useState(false);

  // Encrypted import password form state
  const [pendingImportText, setPendingImportText] = useState(null);
  const [importPassword, setImportPassword] = useState("");
  const [importPasswordError, setImportPasswordError] = useState(null);
  const [importInProgress, setImportInProgress] = useState(false);

  const updateTax = (key, value) => {
    updateState(prev => ({ ...prev, taxConfig: { ...prev.taxConfig, [key]: value } }));
  };

  const updatePlatform = (platKey, field, value) => {
    updateState(prev => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [platKey]: { ...prev.platforms[platKey], [field]: value },
      },
    }));
  };

  const confirmAddPlatform = () => {
    const k = newPlatformKey.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!k) { setPlatformKeyError("Key is required."); return; }
    if (state.platforms[k]) { setPlatformKeyError(`Key "${k}" already exists.`); return; }
    updateState(prev => ({
      ...prev,
      platforms: { ...prev.platforms, [k]: { name: newPlatformName.trim(), feePerShare: 0, flatFee: 0, feePercent: 0 } },
    }));
    setNewPlatformKey("");
    setNewPlatformName("");
    setShowAddPlatform(false);
    setPlatformKeyError(null);
  };

  const confirmAddOverride = () => {
    const k = newOverrideKey.toLowerCase().trim();
    if (!k) { setOverrideKeyError("Key is required."); return; }
    if ((state.priceOverrides || {})[k] != null) { setOverrideKeyError(`"${k}" already has an override. Edit the existing value instead.`); return; }
    updateState(prev => ({ ...prev, priceOverrides: { ...prev.priceOverrides, [k]: 0 } }));
    setNewOverrideKey("");
    setShowAddOverride(false);
    setOverrideKeyError(null);
  };

  const removePlatform = (platKey) => {
    updateState(prev => {
      const { [platKey]: _, ...rest } = prev.platforms;
      return { ...prev, platforms: rest };
    });
  };

  const updateSellDate = (value) => {
    updateState(prev => ({ ...prev, sellDate: value }));
  };

  const handleExportPlain = async () => {
    setExportError(null);
    try {
      await exportState(state);
      updateState(prev => ({ ...prev, lastExportDate: new Date().toISOString().slice(0, 10) }));
      track("settings_export", { encrypted: false });
    } catch (err) {
      setExportError(err.message);
    }
  };

  const submitExport = async () => {
    if (!exportPassword) { setExportPasswordError("Password is required."); return; }
    if (exportPassword !== exportPasswordConfirm) { setExportPasswordError("Passwords do not match."); return; }
    setExportPasswordError(null);
    setExportInProgress(true);
    try {
      await exportState(state, exportPassword);
      updateState(prev => ({ ...prev, lastExportDate: new Date().toISOString().slice(0, 10) }));
      track("settings_export", { encrypted: true });
      setShowExportForm(false);
      setExportPassword("");
      setExportPasswordConfirm("");
    } catch (err) {
      setExportPasswordError(err.message);
      setExportError(err.message); // persist in global error area if user closes the form
    } finally {
      setExportInProgress(false);
    }
  };

  const handleFileSelected = async (e) => {
    setImportError(null);
    setImportSuccess(false);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    let text;
    try {
      text = await file.text();
    } catch (err) {
      setImportError(`Could not read the selected file: ${err.message}`);
      return;
    }
    // Detect encrypted files by content, not file extension
    let isEncrypted = false;
    try {
      isEncrypted = JSON.parse(text)?.format === "greenlight-encrypted-v1";
    } catch {
      // Not valid JSON — fall through; importState will surface a clear error
    }
    if (isEncrypted) {
      setPendingImportText(text);
      setImportPassword("");
      setImportPasswordError(null);
      return;
    }
    try {
      const imported = await importState(text);
      replaceState(imported);
      setImportSuccess(true);
      track("import_complete", { encrypted: false });
    } catch (err) {
      setImportError(err.message);
      track("import_fail", { encrypted: false });
    }
  };

  const submitImport = async () => {
    if (!importPassword) { setImportPasswordError("Password is required."); return; }
    setImportPasswordError(null);
    setImportInProgress(true);
    try {
      const imported = await importState(pendingImportText, importPassword);
      replaceState(imported);
      setImportSuccess(true);
      track("import_complete", { encrypted: true });
      setPendingImportText(null);
      setImportPassword("");
    } catch (err) {
      setImportPasswordError(err.message);
      track("import_fail", { encrypted: true });
    } finally {
      setImportInProgress(false);
    }
  };

  const handleReset = () => {
    if (confirm("Reset all data to defaults? This cannot be undone.")) {
      replaceState(createDefaultState());
      track("settings_reset");
    }
  };


  const labelStyle = { fontSize: 13, color: colors.dim, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 };
  const inputStyle = styles.input;
  const btnStyle = { ...styles.btn, padding: "8px 18px", fontSize: 15 };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1 }}>SETTINGS</h2>

      {/* Sell Date */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>Liquidation Date</div>
        <div style={{ maxWidth: 220 }}>
          <input type="date" value={state.sellDate} onChange={e => updateSellDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ fontSize: 11, color: colors.dim, marginTop: 6 }}>
          When you plan to sell assets. Drives LT/ST classification and cash flow projections.
        </div>
      </div>

      {/* Tax Configuration */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Tax Configuration</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["progressive", "flat"].map(mode => (
              <button key={mode} onClick={() => updateTax("taxMode", mode)} style={{
                ...btnStyle, fontSize: 10, padding: "3px 10px",
                background: state.taxConfig.taxMode === mode ? colors.blue : colors.bgButton,
                color: state.taxConfig.taxMode === mode ? "#000" : colors.dim,
                fontWeight: state.taxConfig.taxMode === mode ? 700 : 400,
              }}>
                {mode === "progressive" ? "Bracket" : "Flat"}
              </button>
            ))}
          </div>
        </div>

        <div className="gl-form-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div>
            <label style={labelStyle}>Filing Status</label>
            <select value={state.taxConfig.filingStatus} onChange={e => updateTax("filingStatus", e.target.value)} style={inputStyle}>
              <option value="single">Single</option>
              <option value="mfj">Married Filing Jointly</option>
              <option value="mfs">Married Filing Separately</option>
              <option value="hoh">Head of Household</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tax Year</label>
            <select value={state.taxConfig.taxYear || 2025} onChange={e => updateTax("taxYear", parseInt(e.target.value))} style={inputStyle}>
              <option value={2025}>2025</option>
              <option value={2026}>2026 (projected)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <select value={state.taxConfig.state} onChange={e => updateTax("state", e.target.value)} style={inputStyle}>
              {Object.entries(STATE_TAXES).map(([code, info]) => (
                <option key={code} value={code}>{code} — {info.name}{info.type === "none" ? " (no tax)" : ""}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="gl-form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <label style={labelStyle}>Combined W-2 Income</label>
            <input type="number" step="1000" value={state.taxConfig.combinedW2}
              onChange={e => updateTax("combinedW2", parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          {state.taxConfig.taxMode === "progressive" ? (
            <div style={{ display: "flex", alignItems: "end", paddingBottom: 4 }}>
              <div style={{ fontSize: 11, color: colors.dim }}>
                Std deduction: <span style={{ color: colors.text }}>${getBrackets(state.taxConfig.taxYear || 2025, state.taxConfig.filingStatus).standardDeduction.toLocaleString()}</span>
                <a href="https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025" target="_blank" rel="noopener noreferrer"
                  style={{ color: colors.blue, fontSize: 9, marginLeft: 4, textDecoration: "none", opacity: 0.7 }} title="IRS Rev. Proc. 2024-40">
                  source
                </a>
              </div>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Standard Deduction</label>
              <input type="number" step="100" value={state.taxConfig.standardDeduction}
                onChange={e => updateTax("standardDeduction", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
          )}
        </div>

        {state.taxConfig.taxMode === "progressive" && (() => {
          const config = getBrackets(state.taxConfig.taxYear || 2025, state.taxConfig.filingStatus);
          const stateInfo = STATE_TAXES[state.taxConfig.state];
          return (
            <div style={{ marginTop: 12, padding: 10, background: colors.bgAlt, borderRadius: 4, fontSize: 11 }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 14px" }}>
                <span style={{ color: colors.dim }}>Federal brackets:</span>
                <span style={{ color: colors.text }}>
                  {config.brackets.map(b => `${Math.round(b.rate * 100)}%`).join(" → ")}
                  <a href="https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025" target="_blank" rel="noopener noreferrer"
                    style={{ color: colors.blue, fontSize: 9, marginLeft: 4, textDecoration: "none", opacity: 0.7 }} title="IRS Rev. Proc. 2024-40">
                    source
                  </a>
                </span>
                <span style={{ color: colors.dim }}>LTCG brackets:</span>
                <span style={{ color: colors.text }}>
                  {config.ltcgBrackets.map(b => `${Math.round(b.rate * 100)}%`).join(" / ")}
                  <a href="https://www.irs.gov/taxtopics/tc409" target="_blank" rel="noopener noreferrer"
                    style={{ color: colors.blue, fontSize: 9, marginLeft: 4, textDecoration: "none", opacity: 0.7 }} title="IRS Topic 409">
                    source
                  </a>
                </span>
                <span style={{ color: colors.dim }}>NIIT:</span>
                <span style={{ color: colors.text }}>
                  3.8% above ${config.niitThreshold.toLocaleString()} AGI
                  <a href="https://www.irs.gov/individuals/net-investment-income-tax" target="_blank" rel="noopener noreferrer"
                    style={{ color: colors.blue, fontSize: 9, marginLeft: 4, textDecoration: "none", opacity: 0.7 }} title="IRS NIIT">
                    source
                  </a>
                </span>
                <span style={{ color: colors.dim }}>State ({state.taxConfig.state}):</span>
                <span style={{ color: stateInfo?.type === "none" ? colors.green : colors.text }}>
                  {stateInfo?.type === "none" ? "No income tax" :
                   stateInfo?.type === "flat" ? `${(stateInfo.rate * 100).toFixed(1)}% flat` :
                   stateInfo?.brackets ? `${stateInfo.brackets.map(b => `${(b.rate * 100).toFixed(1)}%`).join(" → ")} progressive` : "Select a state"}
                  <a href="https://taxfoundation.org/data/all/state/state-income-tax-rates-2025/" target="_blank" rel="noopener noreferrer"
                    style={{ color: colors.blue, fontSize: 9, marginLeft: 4, textDecoration: "none", opacity: 0.7 }} title="Tax Foundation 2025">
                    source
                  </a>
                </span>
              </div>
            </div>
          );
        })()}

        {state.taxConfig.taxMode === "flat" && (
          <div className="gl-form-4col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, marginTop: 12, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>LTCG Rate</label>
              <input type="number" step="0.01" value={state.taxConfig.ltcgRate}
                onChange={e => updateTax("ltcgRate", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>STCG Rate</label>
              <input type="number" step="0.01" value={state.taxConfig.stcgRate}
                onChange={e => updateTax("stcgRate", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>NIIT Rate</label>
              <input type="number" step="0.001" value={state.taxConfig.niitRate}
                onChange={e => updateTax("niitRate", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div style={{ paddingBottom: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: colors.dim, cursor: "pointer" }}>
                <input type="checkbox" checked={state.taxConfig.niitApplies}
                  onChange={e => updateTax("niitApplies", e.target.checked)} style={{ accentColor: colors.blue }} />
                NIIT Applies
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Platform Fees */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Platform Fees</div>
          {!showAddPlatform && (
            <button onClick={() => setShowAddPlatform(true)} style={{ ...btnStyle, color: colors.green, fontSize: 11 }}>+ Add Platform</button>
          )}
        </div>
        {Object.entries(state.platforms).map(([key, plat]) => (
          <div key={key} className="gl-platform-row" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={plat.name} onChange={e => updatePlatform(key, "name", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Fee/Share</label>
              <input type="number" step="0.01" value={plat.feePerShare ?? 0}
                onChange={e => updatePlatform(key, "feePerShare", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Flat Fee</label>
              <input type="number" step="1" value={plat.flatFee ?? 0}
                onChange={e => updatePlatform(key, "flatFee", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Fee %</label>
              <input type="number" step="0.001" value={plat.feePercent ?? 0}
                onChange={e => updatePlatform(key, "feePercent", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div style={{ fontSize: 11, color: colors.dim, paddingBottom: 6 }}>Key: {key}</div>
            <button onClick={() => removePlatform(key)} style={{ ...btnStyle, color: colors.red, fontSize: 11, padding: "5px 10px" }}>×</button>
          </div>
        ))}
        {showAddPlatform && (
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12, marginTop: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Key</label>
                <input
                  value={newPlatformKey}
                  onChange={e => { setNewPlatformKey(e.target.value); setPlatformKeyError(null); }}
                  onKeyDown={e => e.key === "Enter" && confirmAddPlatform()}
                  placeholder="e.g. fidelity"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  value={newPlatformName}
                  onChange={e => setNewPlatformName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && confirmAddPlatform()}
                  placeholder="e.g. Fidelity"
                  style={inputStyle}
                />
              </div>
              <button onClick={confirmAddPlatform} style={{ ...btnStyle, color: colors.green }}>Add</button>
              <button onClick={() => { setShowAddPlatform(false); setNewPlatformKey(""); setNewPlatformName(""); setPlatformKeyError(null); }} style={btnStyle}>Cancel</button>
            </div>
            {platformKeyError && <div style={{ fontSize: 11, color: colors.red, marginTop: 6 }}>{platformKeyError}</div>}
          </div>
        )}
      </div>

      {/* Price Overrides */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>Manual Price Overrides</div>
        <div style={{ fontSize: 11, color: colors.dim, marginBottom: 10 }}>
          Prices set here override fetched prices from Gemini and CoinGecko (crypto) and Yahoo Finance (stocks).
        </div>
        <div className="gl-price-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {Object.entries(state.priceOverrides || {}).map(([key, val]) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={labelStyle}>{key}</label>
                <button onClick={() => {
                  updateState(prev => {
                    const { [key]: _, ...rest } = prev.priceOverrides;
                    return { ...prev, priceOverrides: rest };
                  });
                }} style={{ background: "none", border: "none", color: colors.red, fontSize: 11, cursor: "pointer", padding: 0 }}>×</button>
              </div>
              <input type="number" step="0.01" value={val}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0;
                  updateState(prev => ({ ...prev, priceOverrides: { ...prev.priceOverrides, [key]: v } }));
                }}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          {showAddOverride ? (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={newOverrideKey}
                  onChange={e => { setNewOverrideKey(e.target.value); setOverrideKeyError(null); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") confirmAddOverride();
                    else if (e.key === "Escape") { setNewOverrideKey(""); setShowAddOverride(false); setOverrideKeyError(null); }
                  }}
                  placeholder="e.g. gme"
                  style={{ ...inputStyle, width: 120 }}
                  autoFocus
                />
                <button onClick={confirmAddOverride} style={{ ...btnStyle, fontSize: 11, color: colors.green }}>Add</button>
                <button onClick={() => { setNewOverrideKey(""); setShowAddOverride(false); setOverrideKeyError(null); }} style={{ ...btnStyle, fontSize: 11 }}>Cancel</button>
              </div>
              {overrideKeyError && <div style={{ fontSize: 11, color: colors.red, marginTop: 6 }}>{overrideKeyError}</div>}
            </div>
          ) : (
            <button onClick={() => setShowAddOverride(true)} style={{ ...btnStyle, fontSize: 11 }}>+ Add Override</button>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14 }}>
        <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontWeight: 600 }}>Data Management</div>

        {/* Storage usage */}
        <StorageMonitor />

        {/* Export reminder */}
        <ExportReminder lastExportDate={state.lastExportDate} />

        <div className="gl-data-buttons" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button
            onClick={() => { setShowExportForm(true); setExportPassword(""); setExportPasswordConfirm(""); setExportPasswordError(null); }}
            style={{ ...btnStyle, color: colors.green }}
          >
            Export Encrypted
          </button>
          <button onClick={handleExportPlain} style={btnStyle}>Export JSON</button>
          <label style={{ ...btnStyle, display: "inline-flex", alignItems: "center" }}>
            Import
            <input type="file" accept=".greenlight,.json" onChange={handleFileSelected} style={{ display: "none" }} />
          </label>
<button onClick={handleReset} style={{ ...btnStyle, color: colors.red }}>Reset to Defaults</button>
        </div>

        {showExportForm && (
          <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: colors.dim, marginBottom: 8 }}>
              Set a password to encrypt your backup.{" "}
              <strong style={{ color: colors.amber }}>This password is required to restore. There is no recovery option if lost.</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={e => { setExportPassword(e.target.value); setExportPasswordError(null); }}
                  onKeyDown={e => e.key === "Enter" && submitExport()}
                  placeholder="Enter password"
                  style={inputStyle}
                  autoFocus
                />
                {exportPassword && (() => {
                  const s = passwordStrength(exportPassword);
                  return (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ height: 3, background: colors.bgInput, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${s.pct}%`, background: s.color, transition: "width 0.2s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: s.color, marginTop: 2 }}>{s.label}</div>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  value={exportPasswordConfirm}
                  onChange={e => { setExportPasswordConfirm(e.target.value); setExportPasswordError(null); }}
                  onKeyDown={e => e.key === "Enter" && submitExport()}
                  placeholder="Confirm password"
                  style={inputStyle}
                />
              </div>
              <button onClick={submitExport} disabled={exportInProgress} style={{ ...btnStyle, color: colors.green }}>
                {exportInProgress ? "Encrypting…" : "Export"}
              </button>
              <button
                onClick={() => { setShowExportForm(false); setExportPassword(""); setExportPasswordConfirm(""); setExportPasswordError(null); }}
                disabled={exportInProgress}
                style={btnStyle}
              >
                Cancel
              </button>
            </div>
            {exportPasswordError && <div style={{ fontSize: 11, color: colors.red, marginTop: 6 }}>{exportPasswordError}</div>}
          </div>
        )}

        {pendingImportText && (
          <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: colors.dim, marginBottom: 8 }}>
              Encrypted backup detected. Enter the password to decrypt and import.
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={importPassword}
                  onChange={e => { setImportPassword(e.target.value); setImportPasswordError(null); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") submitImport();
                    else if (e.key === "Escape") { setPendingImportText(null); setImportPassword(""); setImportPasswordError(null); }
                  }}
                  placeholder="Enter backup password"
                  style={{ ...inputStyle, width: 220 }}
                  autoFocus
                />
              </div>
              <button onClick={submitImport} disabled={importInProgress} style={{ ...btnStyle, color: colors.green }}>
                {importInProgress ? "Decrypting…" : "Decrypt & Import"}
              </button>
              <button
                onClick={() => { setPendingImportText(null); setImportPassword(""); setImportPasswordError(null); }}
                disabled={importInProgress}
                style={btnStyle}
              >
                Cancel
              </button>
            </div>
            {importPasswordError && <div style={{ fontSize: 11, color: colors.red, marginTop: 6 }}>{importPasswordError}</div>}
          </div>
        )}

        {exportError && <div style={{ marginTop: 8, fontSize: 12, color: colors.red }}>Export failed: {exportError}</div>}
        {importError && <div style={{ marginTop: 8, fontSize: 12, color: colors.red }}>Import failed: {importError}</div>}
        {importSuccess && <div style={{ marginTop: 8, fontSize: 12, color: colors.green }}>Data imported successfully.</div>}
        <div style={{ marginTop: 12, fontSize: 11, color: colors.dim }}>
          Schema version: {state.schemaVersion || 1} · Data is stored in your browser's localStorage.
        </div>
      </div>

      {/* Analytics Preferences */}
      <AnalyticsPreferences btnStyle={btnStyle} />

      {/* Disclaimer */}
      <div style={{ marginTop: 20, fontSize: 11, color: colors.dim, lineHeight: 1.7, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
        GreenLight provides tax estimates and financial projections for personal planning purposes only —
        not tax or legal advice. The tax engine approximates liability using published brackets and standard
        deductions and does not account for all individual circumstances. Always consult a qualified tax or
        financial professional before making significant financial decisions.
      </div>
    </div>
  );
}

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", pct: 25, color: colors.red };
  if (score <= 3) return { label: "Fair", pct: 60, color: colors.amber };
  return { label: "Strong", pct: 100, color: colors.green };
}

const NOW_MS = Date.now(); // module-level: stable across renders, day-precision is fine

function StorageMonitor() {
  const LIMIT_BYTES = 5 * 1024 * 1024; // 5MB typical localStorage limit
  const WARN_BYTES = 3 * 1024 * 1024;  // warn at 3MB
  let usedBytes = 0;
  let measureFailed = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      usedBytes += (key.length + (localStorage.getItem(key) || "").length) * 2; // UTF-16
    }
  } catch (err) {
    measureFailed = true;
    console.warn("[GreenLight] Could not measure localStorage usage:", err.message);
  }

  if (measureFailed) {
    return (
      <div style={{ marginBottom: 12, fontSize: 10, color: colors.dim }}>
        Storage usage unavailable in this browser context.
      </div>
    );
  }

  const usedKB = (usedBytes / 1024).toFixed(0);
  const limitKB = (LIMIT_BYTES / 1024).toFixed(0);
  const pct = Math.min(100, (usedBytes / LIMIT_BYTES) * 100);
  const isWarning = usedBytes >= WARN_BYTES;
  const barColor = isWarning ? colors.amber : colors.blue;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: colors.dim, marginBottom: 4 }}>
        <span>localStorage Usage</span>
        <span style={{ color: isWarning ? colors.amber : colors.dim }}>{usedKB} KB / {limitKB} KB</span>
      </div>
      <div style={{ height: 6, background: colors.bgInput, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      {isWarning && (
        <div style={{ fontSize: 10, color: colors.amber, marginTop: 4 }}>
          Storage usage is high. Consider exporting and clearing old data.
        </div>
      )}
    </div>
  );
}

function AnalyticsPreferences({ btnStyle }) {
  const [consent, setLocal] = useState(() => getConsent());

  const handleToggle = () => {
    const next = consent === "accepted" ? "declined" : "accepted";
    const ok = setConsent(next);
    if (ok) setLocal(next);
  };

  const enabled = consent === "accepted";

  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginTop: 14 }}>
      <div style={{ fontSize: 11, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>Analytics Preferences</div>
      <div style={{ fontSize: 12, color: colors.dim, lineHeight: 1.6, marginBottom: 10 }}>
        GreenLight uses Umami to count page views and feature usage.
        No cookies, no personal data, no cross-site tracking.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: enabled ? colors.green : colors.dim }}>
          Status: <strong>{enabled ? "Enabled" : "Disabled"}</strong>
        </span>
        <button onClick={handleToggle} style={{ ...btnStyle, fontSize: 11 }}>
          {enabled ? "Disable analytics" : "Enable analytics"}
        </button>
      </div>
    </div>
  );
}

function ExportReminder({ lastExportDate }) {
  const daysSince = useMemo(() => {
    if (!lastExportDate) return null;
    const last = new Date(lastExportDate + "T12:00:00");
    if (isNaN(last.getTime())) return null;
    return Math.floor((NOW_MS - last.getTime()) / 864e5);
  }, [lastExportDate]);
  if (daysSince == null || daysSince < 30) return null;

  return (
    <div style={{
      background: "rgba(245, 158, 11, 0.06)", borderLeft: `3px solid ${colors.amber}`,
      borderRadius: 4, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: colors.text,
    }}>
      Last export was <strong style={{ color: colors.amber }}>{daysSince} days ago</strong>.
      Consider exporting a backup to protect your data.
    </div>
  );
}
