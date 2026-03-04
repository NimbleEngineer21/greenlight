import { useState, useCallback } from "react";
import Papa from "papaparse";
import { colors, styles } from "../theme.js";
import { parseComputerShareCSV } from "../lib/parsers/computershare.js";
import { parseGeminiXLSX } from "../lib/parsers/gemini.js";
import { parseFidelityCSV } from "../lib/parsers/fidelity.js";
import { parseTransamericaCSV } from "../lib/parsers/transamerica.js";
import { parsePayPalCSV, applyPayPalAnnotations } from "../lib/parsers/paypal.js";
import { detectColumnMappings, applyColumnMapping } from "../lib/parsers/custom.js";
import { PROVIDERS } from "../data/providers.js";
import { fmt, fmtQty } from "../lib/calculations.js";

const PLATFORM_OPTIONS = Object.entries(PROVIDERS).map(([value, p]) => ({ value, label: p.label }));

export default function Import({ updateState }) {
  const [platform, setPlatform] = useState("computershare");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState(false);

  // Custom CSV column mapping state
  const [customHeaders, setCustomHeaders] = useState([]);
  const [customRows, setCustomRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [showMapping, setShowMapping] = useState(false);

  // PayPal full-history annotation state
  const [paypalPendingRows, setPaypalPendingRows] = useState([]);
  const [showPaypalAnnotator, setShowPaypalAnnotator] = useState(false);

  const handleFiles = useCallback(async (files) => {
    setError(null);
    setParsed(null);
    setShowMapping(false);
    setShowPaypalAnnotator(false);
    const fileList = Array.from(files);
    try {
      if (platform === "computershare") {
        const csvFiles = fileList.filter(f => f.name.endsWith(".csv"));
        if (csvFiles.length === 0) { setError("Please upload CSV files for ComputerShare."); return; }
        const results = [];
        for (const file of csvFiles) {
          const text = await file.text();
          const lots = parseComputerShareCSV(text, file.name);
          results.push(...lots);
        }
        setParsed({ platform: "ComputerShare", lots: results, assets: aggregateLots(results) });
      } else if (platform === "gemini") {
        const xlsxFile = fileList.find(f => f.name.endsWith(".xlsx") || f.name.endsWith(".xls"));
        if (!xlsxFile) { setError("Please upload an XLSX file for Gemini."); return; }
        const buffer = await xlsxFile.arrayBuffer();
        const result = parseGeminiXLSX(buffer);
        setParsed({ platform: "Gemini", ...result });
      } else if (platform === "fidelity") {
        const csvFile = fileList.find(f => f.name.endsWith(".csv"));
        if (!csvFile) { setError("Please upload a CSV file for Fidelity."); return; }
        const text = await csvFile.text();
        const result = parseFidelityCSV(text);
        setParsed({ platform: "Fidelity", ...result });
      } else if (platform === "transamerica") {
        const csvFiles = fileList.filter(f => f.name.endsWith(".csv"));
        if (csvFiles.length === 0) { setError("Please upload CSV files for Transamerica."); return; }
        const namedFiles = [];
        for (const file of csvFiles) {
          const text = await file.text();
          namedFiles.push({ name: file.name, text });
        }
        const result = parseTransamericaCSV(namedFiles);
        setParsed({ platform: "Transamerica", ...result });
      } else if (platform === "paypal") {
        const csvFile = fileList.find(f => f.name.endsWith(".csv"));
        if (!csvFile) { setError("Please upload a CSV file for PayPal."); return; }
        const text = await csvFile.text();
        const result = parsePayPalCSV(text);
        if (result.needsAnnotation) {
          setPaypalPendingRows(result.pendingRows.map(r => ({ ...r })));
          setShowPaypalAnnotator(true);
        } else {
          setParsed({ platform: "PayPal", ...result });
        }
      } else if (platform === "custom") {
        const csvFile = fileList.find(f => f.name.endsWith(".csv"));
        if (!csvFile) { setError("Please upload a CSV file."); return; }
        const text = await csvFile.text();
        const cleaned = text.replace(/^\uFEFF/, "");
        const parseResult = Papa.parse(cleaned, { header: true, skipEmptyLines: true });
        const parseWarnings = parseResult.errors
          .filter(e => e.type !== "FieldMismatch")
          .map(e => `CSV warning at row ${e.row}: ${e.message}`);
        const headers = parseResult.meta.fields || [];
        if (headers.length === 0) { setError("Could not detect CSV headers."); return; }
        const detected = detectColumnMappings(headers);
        setCustomHeaders(headers);
        setCustomRows(parseResult.data);
        setColumnMapping(detected);
        setShowMapping(true);
        if (parseWarnings.length > 0) setError(parseWarnings.join(" · "));
      } else {
        setError(`Import for "${platform}" is not implemented.`);
      }
    } catch (e) {
      console.error("[GreenLight] Import parse failed:", e);
      const hint = PROVIDERS[platform]?.hint ?? "";
      setError(`Failed to parse the file. ${hint} Error: ${e.message}`);
    }
  }, [platform]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onFileInput = useCallback((e) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  const applyCustomMapping = useCallback(() => {
    if (!columnMapping.symbol || !columnMapping.quantity) {
      setError("Please map at least Symbol and Quantity columns.");
      return;
    }
    const { assets, droppedRows } = applyColumnMapping(customRows, columnMapping);
    if (assets.length === 0) {
      setError("No valid rows found after applying column mapping.");
      return;
    }
    const warnings = droppedRows > 0
      ? [`${droppedRows} row${droppedRows > 1 ? "s" : ""} skipped — missing symbol or non-positive quantity.`]
      : [];
    setParsed({ platform: "Custom CSV", assets, warnings });
    setShowMapping(false);
    setError(null);
  }, [columnMapping, customRows]);

  const confirmPaypalAnnotations = useCallback(() => {
    const { assets } = applyPayPalAnnotations(paypalPendingRows);
    if (assets.length === 0) {
      setError("No valid assets — fill in Symbol and Quantity for at least one row.");
      return;
    }
    setParsed({ platform: "PayPal", assets, warnings: [] });
    setShowPaypalAnnotator(false);
    setError(null);
  }, [paypalPendingRows]);

  const confirmImport = useCallback(() => {
    if (!parsed) return;

    // Guard: if the only content is fundHoldings with no accounts/assets, there's nothing to save
    const hasRetirement = parsed.retirementAccounts?.length > 0;
    const hasAssets = parsed.assets?.length > 0;
    const hasCash = parsed.cashPositions?.length > 0;
    if (!hasRetirement && !hasAssets && !hasCash) {
      setError(
        "Nothing to import — upload source-balance.csv to import Transamerica account data.",
      );
      return;
    }

    try {
      updateState(prev => {
        let next = { ...prev };

        if (hasRetirement) {
          const withoutOld = (prev.retirement?.accounts || []).filter(
            a => a.platform !== parsed.platform,
          );
          const newAccounts = parsed.retirementAccounts.map(a => ({
            ...a,
            id: crypto.randomUUID(),
          }));
          next = {
            ...next,
            retirement: {
              ...prev.retirement,
              accounts: [...withoutOld, ...newAccounts],
            },
          };
        }

        if (hasAssets) {
          const importSource = parsed.platform.toLowerCase().replace(/\s+/g, "-");
          const existingIds = new Set(
            (prev.assets || []).filter(a => a.importSource === importSource).map(a => a.id),
          );
          const withoutOld = (prev.assets || []).filter(a => !existingIds.has(a.id));
          const newAssets = parsed.assets.map(a => ({
            ...a,
            id: crypto.randomUUID(),
            importSource,
          }));
          next = { ...next, assets: [...withoutOld, ...newAssets] };
        }

        if (hasCash) {
          const importSource = parsed.platform.toLowerCase().replace(/\s+/g, "-");
          const cashAccounts = (prev.cashAccounts || []).filter(
            c => c.importSource !== importSource,
          );
          const newCash = parsed.cashPositions.map(c => ({
            id: crypto.randomUUID(),
            platform: c.accountName || parsed.platform,
            name: c.symbol,
            balance: c.value,
            importSource,
          }));
          next = { ...next, cashAccounts: [...cashAccounts, ...newCash] };
        }

        return next;
      });

      setParsed(null);
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch (e) {
      console.error("[GreenLight] confirmImport failed:", e);
      setError(
        `Import failed while saving data. Your existing data has not been changed. Error: ${e.message}`,
      );
    }
  }, [parsed, updateState]);

  const provider = PROVIDERS[platform];
  const btnStyle = { ...styles.btn, padding: "8px 18px", fontSize: 15 };

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1 }}>IMPORT DATA</h2>

      {toast && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: `1px solid ${colors.green}`, borderRadius: 6, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: colors.green }}>
          Import successful — data updated.
        </div>
      )}

      {/* Platform selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 11, color: colors.dim }}>PLATFORM:</label>
        {PLATFORM_OPTIONS.map(opt => (
          <label key={opt.value} style={{ fontSize: 12, color: platform === opt.value ? colors.blue : colors.dim, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <input type="radio" name="platform" value={opt.value} checked={platform === opt.value}
              onChange={() => { setPlatform(opt.value); setParsed(null); setError(null); setShowMapping(false); setShowPaypalAnnotator(false); setPaypalPendingRows([]); }}
              style={{ accentColor: colors.blue }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragOver ? colors.blue : colors.border}`,
          borderRadius: 8, padding: 40, textAlign: "center",
          background: dragOver ? colors.bgButton : colors.card,
          marginBottom: 16, cursor: "pointer",
          transition: "all 0.2s",
        }}
        onClick={() => document.getElementById("file-input").click()}
      >
        <div style={{ fontSize: 24, color: colors.dim, marginBottom: 8 }}>↑</div>
        <div style={{ fontSize: 13, color: colors.text }}>
          Drop {platform === "gemini" ? "XLSX" : "CSV"} files here or click to browse
        </div>
        <div style={{ fontSize: 11, color: colors.dim, marginTop: 4 }}>
          {provider?.hint}
        </div>
        <input
          id="file-input"
          type="file"
          multiple={provider?.multiple ?? false}
          accept={provider?.acceptAttr ?? ".csv"}
          onChange={onFileInput}
          style={{ display: "none" }}
        />
      </div>

      {error && (
        <div style={{ background: "#1a0000", border: `1px solid ${colors.red}`, borderRadius: 6, padding: 10, marginBottom: 16, fontSize: 11, color: colors.red }}>
          {error}
        </div>
      )}

      {/* Custom CSV column mapping UI */}
      {showMapping && (
        <CustomColumnMapper
          headers={customHeaders}
          previewRows={customRows.slice(0, 5)}
          mapping={columnMapping}
          onMappingChange={setColumnMapping}
          onApply={applyCustomMapping}
          onCancel={() => { setShowMapping(false); setCustomRows([]); setCustomHeaders([]); }}
        />
      )}

      {/* PayPal full-history annotation UI */}
      {showPaypalAnnotator && (
        <PayPalAnnotator
          rows={paypalPendingRows}
          onRowChange={(i, field, value) =>
            setPaypalPendingRows(prev => {
              const next = [...prev];
              next[i] = { ...next[i], [field]: value };
              return next;
            })
          }
          onConfirm={confirmPaypalAnnotations}
          onCancel={() => { setShowPaypalAnnotator(false); setPaypalPendingRows([]); }}
        />
      )}

      {/* Preview */}
      {parsed && (
        <ParsedPreview
          parsed={parsed}
          onConfirm={confirmImport}
          onCancel={() => setParsed(null)}
          btnStyle={btnStyle}
        />
      )}
    </div>
  );
}

function PayPalAnnotator({ rows, onRowChange, onConfirm, onCancel }) {
  const canConfirm = rows.some(r => r.symbol.trim() && parseFloat(r.quantity) > 0);

  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
        Annotate PayPal Crypto Transactions
      </div>
      <div style={{ fontSize: 11, color: colors.dim, marginBottom: 12 }}>
        PayPal&apos;s full transaction history doesn&apos;t include which cryptocurrency was purchased or how many units.
        Fill in <strong style={{ color: colors.text }}>Symbol</strong> and <strong style={{ color: colors.text }}>Units</strong> for each row — refer to the PayPal app or your confirmation emails.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
              {["Date", "USD Paid", "Fees", "Tx ID", "Symbol *", "Units *"].map(h => (
                <th key={h} style={{
                  padding: "5px 8px", textAlign: ["USD Paid", "Fees"].includes(h) ? "right" : "left",
                  color: colors.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid #0e1620`, background: i % 2 ? colors.bgAlt : "transparent" }}>
                <td style={{ padding: "5px 8px", color: colors.dim }}>{row.date}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: colors.blue }}>{fmt(row.amountUSD)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: colors.dim }}>{fmt(row.fees)}</td>
                <td style={{ padding: "5px 8px", color: colors.dim, fontSize: 10 }}>{row.txId}</td>
                <td style={{ padding: "3px 8px" }}>
                  <input
                    value={row.symbol}
                    onChange={e => onRowChange(i, "symbol", e.target.value.toUpperCase())}
                    placeholder="e.g. ETH"
                    style={{
                      width: 64, background: colors.bgButton, border: `1px solid ${row.symbol.trim() ? colors.blue : colors.border}`,
                      borderRadius: 4, padding: "4px 6px", fontSize: 12, color: colors.text, textTransform: "uppercase",
                    }}
                  />
                </td>
                <td style={{ padding: "3px 8px" }}>
                  <input
                    value={row.quantity}
                    onChange={e => onRowChange(i, "quantity", e.target.value)}
                    placeholder="0.000000"
                    style={{
                      width: 96, background: colors.bgButton, border: `1px solid ${parseFloat(row.quantity) > 0 ? colors.blue : colors.border}`,
                      borderRadius: 4, padding: "4px 6px", fontSize: 12, color: colors.text,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          style={{
            ...styles.btn, padding: "7px 16px", fontSize: 13,
            color: canConfirm ? colors.green : colors.dim,
            opacity: canConfirm ? 1 : 0.5,
          }}
        >
          Confirm Annotations
        </button>
        <button onClick={onCancel} style={{ ...styles.btn, padding: "7px 14px", fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function CustomColumnMapper({ headers, previewRows, mapping, onMappingChange, onApply, onCancel }) {
  const REQUIRED_FIELDS = ["symbol", "quantity"];
  const OPTIONAL_FIELDS = ["name", "costBasis", "acquisitionDate", "price"];
  const FIELD_LABELS = {
    symbol: "Symbol / Ticker *",
    quantity: "Quantity / Shares *",
    name: "Name / Description",
    costBasis: "Cost Basis",
    acquisitionDate: "Acquisition Date",
    price: "Current Price",
  };

  const canApply = REQUIRED_FIELDS.every(f => mapping[f]);

  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 10 }}>
        Map CSV Columns
      </div>
      <div style={{ fontSize: 11, color: colors.dim, marginBottom: 12 }}>
        We detected {headers.length} columns. Map them to the fields below (* required).
        Auto-detected mappings are pre-filled.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", marginBottom: 14 }}>
        {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(field => (
          <div key={field}>
            <label style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 3 }}>
              {FIELD_LABELS[field]}
            </label>
            <select
              value={mapping[field] || ""}
              onChange={e => onMappingChange(prev => ({ ...prev, [field]: e.target.value || undefined }))}
              style={{
                background: colors.bgButton, border: `1px solid ${colors.border}`,
                borderRadius: 4, padding: "5px 8px", fontSize: 12, color: colors.text, width: "100%",
              }}
            >
              <option value="">— not mapped —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div style={{ marginBottom: 12, overflowX: "auto" }}>
          <div style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Data Preview (first {previewRows.length} rows)
          </div>
          <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
            <thead>
              <tr>
                {headers.map(h => (
                  <th key={h} style={{
                    padding: "4px 8px", textAlign: "left", color: colors.dim,
                    fontSize: 10, borderBottom: `1px solid ${colors.border}`,
                    background: Object.values(mapping).includes(h) ? "rgba(59,130,246,0.08)" : "transparent",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i}>
                  {headers.map(h => (
                    <td key={h} style={{
                      padding: "3px 8px", color: colors.text, borderBottom: `1px solid #0e1620`,
                      background: Object.values(mapping).includes(h) ? "rgba(59,130,246,0.04)" : "transparent",
                    }}>{row[h] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onApply}
          disabled={!canApply}
          style={{
            ...styles.btn, padding: "7px 16px", fontSize: 13,
            color: canApply ? colors.green : colors.dim,
            opacity: canApply ? 1 : 0.5,
          }}
        >
          Apply Mapping
        </button>
        <button onClick={onCancel} style={{ ...styles.btn, padding: "7px 14px", fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ParsedPreview({ parsed, onConfirm, onCancel, btnStyle }) {
  const isRetirement = parsed.retirementAccounts?.length > 0;
  const hasAssets = parsed.assets?.length > 0;

  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1.5 }}>
            PARSED: {parsed.platform}
          </div>
          <div style={{ fontSize: 9, color: colors.dim, marginTop: 2 }}>
            {hasAssets && `${parsed.assets.length} assets${parsed.lots ? ` (${parsed.lots.length} lots)` : ""}`}
            {isRetirement && `${parsed.retirementAccounts.length} retirement accounts`}
            {parsed.fundHoldings?.length > 0 && ` · ${parsed.fundHoldings.length} fund holdings`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onConfirm} style={{ ...btnStyle, color: colors.green }}>Confirm Import</button>
          <button onClick={onCancel} style={btnStyle}>Cancel</button>
        </div>
      </div>

      {/* Asset table */}
      {hasAssets && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: isRetirement ? 12 : 0 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
              {["Name", "Symbol", "Quantity", "Cost Basis", "Acquired", "Fee Type", "Notes"].map(h => (
                <th key={h} style={{
                  padding: "6px", textAlign: ["Quantity", "Cost Basis"].includes(h) ? "right" : "left",
                  color: colors.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.assets.map((a, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #0e1620", background: i % 2 ? colors.bgAlt : "transparent" }}>
                <td style={{ padding: "5px" }}>{a.name}</td>
                <td style={{ color: colors.dim }}>{a.symbol}</td>
                <td style={{ textAlign: "right" }}>{fmtQty(a.quantity)}</td>
                <td style={{ textAlign: "right", color: colors.blue }}>{fmt(a.costBasis)}</td>
                <td style={{ color: colors.dim }}>{a.acquisitionDate || "—"}</td>
                <td style={{ color: colors.dim }}>{a.feeType}</td>
                <td style={{ color: colors.dim, fontSize: 9 }}>{a.notes || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Retirement accounts table */}
      {isRetirement && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
              {["Source", "Account Type", "Balance"].map(h => (
                <th key={h} style={{
                  padding: "6px", textAlign: h === "Balance" ? "right" : "left",
                  color: colors.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.retirementAccounts.map((a, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #0e1620", background: i % 2 ? colors.bgAlt : "transparent" }}>
                <td style={{ padding: "5px", color: colors.dim }}>{a.notes || a.platform}</td>
                <td style={{ color: colors.text }}>{a.accountType}</td>
                <td style={{ textAlign: "right", color: colors.blue }}>{fmt(a.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {parsed.warnings?.length > 0 && (
        <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(245,158,11,0.06)", borderLeft: `3px solid ${colors.amber}`, borderRadius: 4, fontSize: 11, color: colors.text }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: colors.amber }}>Parse warnings:</div>
          {parsed.warnings.map((w, i) => <div key={i} style={{ color: colors.dim }}>{w}</div>)}
        </div>
      )}

      {parsed.cashPositions?.length > 0 && (
        <div style={{ marginTop: 12, padding: "8px 10px", background: colors.bgAlt, borderRadius: 4, fontSize: 11, color: colors.dim }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Cash positions — will be added to Cash Accounts automatically on confirm:</div>
          {parsed.cashPositions.map((c, i) => (
            <div key={i}>{c.symbol} — {fmt(c.value)} ({c.accountName})</div>
          ))}
        </div>
      )}
    </div>
  );
}

function aggregateLots(lots) {
  const groups = {};
  for (const lot of lots) {
    const key = lot.holdingType;
    if (!groups[key]) {
      groups[key] = {
        platform: "ComputerShare",
        name: key === "WARRANT" ? "WGME" : "GME",
        symbol: key === "WARRANT" ? "WGME" : "GME",
        quantity: 0, costBasis: 0,
        acquisitionDate: lot.date,
        priceKey: key === "WARRANT" ? "wgme" : "gme",
        feeType: "cs",
        holdingType: key === "WARRANT" ? "warrant" : "stock",
        notes: "",
      };
    }
    groups[key].quantity += lot.shares;
    groups[key].costBasis += lot.costBasis;
    if (lot.date < groups[key].acquisitionDate) groups[key].acquisitionDate = lot.date;
  }
  for (const g of Object.values(groups)) {
    g.costBasis = Math.round(g.costBasis * 100) / 100;
    g.notes = `${lots.filter(l => l.holdingType === (g.holdingType === "warrant" ? "WARRANT" : "CLASS A COMMON")).length} lots from CSV`;
  }
  return Object.values(groups);
}
