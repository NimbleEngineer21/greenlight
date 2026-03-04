import Papa from "papaparse";

/**
 * Parse a PayPal transaction history CSV export.
 *
 * PayPal produces two distinct CSV formats:
 *
 * 1. "Full history" — the standard Activity export. Has `Type: "Cryptocurrency"`
 *    rows but OMITS which crypto was purchased and how many units. Only the USD
 *    outflow is present. Detected by the absence of a `Cryptocurrency` header.
 *    Returns { needsAnnotation: true, pendingRows } so the UI can collect the
 *    missing Symbol and Units from the user before aggregating.
 *
 * 2. "Crypto detail" — a manually prepared or filtered export that includes
 *    `Cryptocurrency` and a separate `Amount` (units) column. Detected by the
 *    presence of the `Cryptocurrency` header. Aggregates directly into assets.
 *
 * Cost basis: the USD `Amount (USD)` / `Amount` column already includes fees,
 * so fees are embedded in cost basis and the separate `Fees` column is
 * informational only.
 */
export function parsePayPalCSV(text) {
  if (typeof text !== "string") return { assets: [], warnings: ["Input must be a string."] };
  const cleaned = text.replace(/^\uFEFF/, "");
  const { data: rows, errors } = Papa.parse(cleaned, {
    header: true,
    skipEmptyLines: true,
  });

  const warnings = errors
    .filter(e => e.type !== "FieldMismatch")
    .map(e => `CSV warning at row ${e.row}: ${e.message}`);

  if (rows.length === 0) return { assets: [], warnings };

  const headers = Object.keys(rows[0]);
  const hasCryptoColumn = headers.includes("Cryptocurrency");

  if (hasCryptoColumn) {
    return { assets: aggregateCryptoRows(rows), warnings };
  } else {
    return { needsAnnotation: true, pendingRows: extractPendingRows(rows), warnings };
  }
}

/**
 * After the user annotates a full-history export (filling in Symbol and
 * quantity for each row), aggregate into asset positions.
 *
 * @param {Array<{date, amountUSD, symbol, quantity}>} annotatedRows
 * @returns {{ assets: Array }}
 */
export function applyPayPalAnnotations(annotatedRows) {
  const holdings = {};

  for (const row of annotatedRows) {
    const symbol = (row.symbol || "").trim().toUpperCase();
    const quantity = Number.parseFloat(String(row.quantity).replaceAll(",", "")) || 0;
    if (!symbol || quantity <= 0) continue;

    if (!holdings[symbol]) {
      holdings[symbol] = { quantity: 0, costBasis: 0, firstDate: null };
    }
    const h = holdings[symbol];
    h.quantity += quantity;
    h.costBasis += Math.abs(row.amountUSD);
    if (!h.firstDate || row.date < h.firstDate) h.firstDate = row.date;
  }

  return {
    assets: Object.entries(holdings)
      .filter(([, h]) => h.quantity > 1e-8)
      .map(([sym, h]) => ({
        platform: "PayPal",
        name: sym,
        symbol: sym,
        quantity: Math.round(h.quantity * 1e8) / 1e8,
        costBasis: Math.round(h.costBasis * 100) / 100,
        acquisitionDate: h.firstDate || "",
        priceKey: sym.toLowerCase(),
        feeType: "none",
        holdingType: "crypto",
        notes: "Imported from PayPal crypto CSV",
      })),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Aggregate rows from a crypto-detail CSV (has Cryptocurrency + Amount columns).
 */
function aggregateCryptoRows(rows) {
  const holdings = {};

  for (const row of rows) {
    if (row["Type"] !== "Cryptocurrency") continue;
    if (row["Status"] !== "Completed") continue;

    const symbol = (row["Cryptocurrency"] || "").trim();
    if (!symbol) continue;

    const amountUSD = Number.parseFloat((row["Amount (USD)"] || "0").replaceAll(",", ""));
    const cryptoAmt = Number.parseFloat((row["Amount"] || "0").replaceAll(",", ""));
    if (!Number.isFinite(amountUSD) || !Number.isFinite(cryptoAmt)) continue;

    const dateStr = parsePayPalDate(row["Date"] || "");

    if (!holdings[symbol]) {
      holdings[symbol] = { quantity: 0, costBasis: 0, firstDate: null };
    }
    const h = holdings[symbol];

    if (amountUSD < 0) {
      h.quantity += cryptoAmt;
      h.costBasis += Math.abs(amountUSD);
      if (!h.firstDate || dateStr < h.firstDate) h.firstDate = dateStr;
    } else if (amountUSD > 0 && cryptoAmt < 0) {
      // Sell: proportional cost basis reduction
      const sold = Math.abs(cryptoAmt);
      if (h.quantity > 0) {
        const remaining = Math.max(0, h.quantity - sold);
        h.costBasis = h.costBasis * (remaining / h.quantity);
        h.quantity = remaining;
      }
    }
  }

  return Object.entries(holdings)
    .filter(([, h]) => h.quantity > 1e-8)
    .map(([sym, h]) => ({
      platform: "PayPal",
      name: sym,
      symbol: sym,
      quantity: Math.round(h.quantity * 1e8) / 1e8,
      costBasis: Math.round(h.costBasis * 100) / 100,
      acquisitionDate: h.firstDate || "",
      priceKey: sym.toLowerCase(),
      feeType: "none",
      holdingType: "crypto",
      notes: "Imported from PayPal crypto CSV",
    }));
}

/**
 * Extract crypto purchase rows from a full-history CSV for user annotation.
 * Returns one object per row with the known fields pre-filled.
 */
function extractPendingRows(rows) {
  return rows
    .filter(r => {
      if (r["Type"] !== "Cryptocurrency" || r["Status"] !== "Completed") return false;
      const amt = Number.parseFloat((r["Amount"] || "0").replaceAll(",", ""));
      return amt < 0; // buys only — PayPal records crypto purchases as negative USD
    })
    .map(r => {
      const amountUSD = Number.parseFloat((r["Amount"] || "0").replaceAll(",", ""));
      const fees = Number.parseFloat((r["Fees"] || "0").replaceAll(",", ""));
      return {
        date: parsePayPalDate(r["Date"] || ""),
        amountUSD: Math.abs(amountUSD),    // total USD paid (fees already included)
        fees: Math.abs(fees),
        txId: r["Transaction ID"] || "",
        // Filled in by user:
        symbol: "",
        quantity: "",
      };
    });
}

/**
 * Convert PayPal date strings to ISO YYYY-MM-DD.
 * Handles both 2-digit years (M/D/YY) and 4-digit years (MM/DD/YYYY).
 */
function parsePayPalDate(str) {
  const parts = str.trim().replaceAll('"', "").split("/");
  if (parts.length !== 3) return "";
  const [m, d, y] = parts;
  const year = y.length === 2 ? 2000 + Number.parseInt(y, 10) : Number.parseInt(y, 10);
  if (!Number.isFinite(year)) return "";
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
