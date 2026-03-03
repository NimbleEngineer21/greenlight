import * as XLSX from "xlsx";

export function parseGeminiXLSX(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  // Find the transactions sheet
  const sheetName = workbook.SheetNames.find(
    n => n.toLowerCase().includes("history") || n.toLowerCase().includes("transaction")
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) return { assets: [], trades: [] };

  // Gemini uses a wide format with per-currency columns:
  // "BTC Amount BTC", "Fee (BTC) BTC", "BTC Balance BTC", etc.
  // Discover currencies from headers matching "{SYM} Amount {SYM}" pattern
  const headers = Object.keys(rows[0]);
  const currencies = new Set();
  for (const h of headers) {
    const m = h.match(/^(\w+) Amount \1$/);
    if (m && m[1] !== "USD") currencies.add(m[1]);
  }

  // Track holdings per currency
  const holdings = {};
  for (const sym of currencies) {
    holdings[sym] = { quantity: 0, costBasis: 0, firstDate: null };
  }

  const trades = [];

  for (const row of rows) {
    const type = (row["Type"] || "").toString();
    const dateVal = row["Date"];
    // Handle both Date objects (from XLSX) and string dates
    let dateStr;
    if (dateVal instanceof Date) {
      dateStr = dateVal.toISOString().split("T")[0];
    } else if (typeof dateVal === "number") {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(dateVal);
      dateStr = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } else {
      dateStr = (dateVal || "").toString();
    }

    const usdAmount = parseFloat(row["USD Amount USD"]) || 0;
    const usdFee = parseFloat(row["Fee (USD) USD"]) || 0;

    for (const sym of currencies) {
      const amtKey = `${sym} Amount ${sym}`;
      const feeKey = `Fee (${sym}) ${sym}`;
      const cryptoAmt = parseFloat(row[amtKey]) || 0;
      const cryptoFee = parseFloat(row[feeKey]) || 0;

      if (cryptoAmt === 0) continue;

      const h = holdings[sym];

      if (type === "Buy" || type === "Credit") {
        // For Buy: crypto amount is positive, USD is negative
        // Net quantity after crypto fee deduction
        const qty = Math.abs(cryptoAmt) - Math.abs(cryptoFee);
        const cost = Math.abs(usdAmount) + Math.abs(usdFee);
        h.quantity += qty;
        h.costBasis += cost;
        if (!h.firstDate || dateStr < h.firstDate) h.firstDate = dateStr;
        trades.push({ type, symbol: sym, amount: qty, cost, fee: Math.abs(usdFee), date: dateStr });
      } else if (type === "Sell" || type === "Debit") {
        const qty = Math.abs(cryptoAmt);
        // FIFO: reduce cost basis proportionally
        if (h.quantity > 0) {
          const remaining = Math.max(0, h.quantity - qty);
          const ratio = remaining / h.quantity;
          h.costBasis *= ratio;
        }
        h.quantity -= qty;
        trades.push({ type, symbol: sym, amount: -qty, cost: usdAmount, fee: Math.abs(usdFee), date: dateStr });
      }
    }
  }

  // Convert to assets (only currencies with positive balances)
  const assets = Object.entries(holdings)
    .filter(([, h]) => h.quantity > 0.0000001)
    .map(([sym, h]) => ({
      platform: "Gemini",
      name: sym,
      symbol: sym,
      quantity: Math.round(h.quantity * 1e8) / 1e8,
      costBasis: Math.round(h.costBasis * 100) / 100,
      acquisitionDate: h.firstDate || "",
      priceKey: sym.toLowerCase(),
      feeType: "gem",
      holdingType: "crypto",
      notes: "Imported from Gemini XLSX",
    }));

  return { assets, trades };
}
