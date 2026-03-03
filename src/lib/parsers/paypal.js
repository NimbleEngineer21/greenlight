import Papa from "papaparse";

/**
 * Parse a PayPal crypto transaction history CSV export.
 *
 * PayPal's format is a transaction ledger (one row per event), not a position
 * snapshot. This parser aggregates all completed crypto transactions into one
 * asset entry per cryptocurrency with a total quantity and blended cost basis.
 *
 * Cost basis: PayPal's "Amount (USD)" is the total USD outflow including fees,
 * which is the correct IRS cost basis figure. The separate "Fees" column is
 * informational — it's already embedded in "Amount (USD)".
 *
 * Sells reduce holdings via proportional (FIFO-approximation) cost basis
 * reduction, identical to the Gemini parser.
 */
export function parsePayPalCSV(text) {
  const cleaned = text.replace(/^\uFEFF/, ""); // strip BOM if present
  const { data: rows, errors } = Papa.parse(cleaned, {
    header: true,
    skipEmptyLines: true,
  });

  const parseWarnings = errors
    .filter(e => e.type !== "FieldMismatch")
    .map(e => `CSV warning at row ${e.row}: ${e.message}`);

  // holdings[symbol] = { quantity, costBasis, firstDate }
  const holdings = {};

  for (const row of rows) {
    if (row["Type"] !== "Cryptocurrency") continue;
    if (row["Status"] !== "Completed") continue;

    const symbol = (row["Cryptocurrency"] || "").trim();
    if (!symbol) continue;

    // "Amount (USD)" is the total USD flow (negative = buy, positive = sell).
    // Contains commas for thousands: "-1,522.50"
    const amountUSD = parseFloat((row["Amount (USD)"] || "0").replace(/,/g, ""));
    // "Amount" is the crypto unit flow (positive = received, negative = sent)
    const cryptoAmt = parseFloat((row["Amount"] || "0").replace(/,/g, ""));

    if (!isFinite(amountUSD) || !isFinite(cryptoAmt)) continue;

    const dateStr = parsePayPalDate(row["Date"] || "");

    if (!holdings[symbol]) {
      holdings[symbol] = { quantity: 0, costBasis: 0, firstDate: null };
    }
    const h = holdings[symbol];

    if (amountUSD < 0) {
      // Buy: USD spent, crypto received
      h.quantity += cryptoAmt;
      h.costBasis += Math.abs(amountUSD);
      if (!h.firstDate || dateStr < h.firstDate) h.firstDate = dateStr;
    } else if (amountUSD > 0 && cryptoAmt < 0) {
      // Sell: crypto sent, USD received — reduce holdings proportionally
      const sold = Math.abs(cryptoAmt);
      if (h.quantity > 0) {
        const remaining = Math.max(0, h.quantity - sold);
        h.costBasis = h.costBasis * (remaining / h.quantity);
      }
      h.quantity = Math.max(0, h.quantity - sold);
    }
  }

  const assets = Object.entries(holdings)
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

  return { assets, warnings: parseWarnings };
}

/**
 * Convert PayPal's M/D/YY date format to ISO YYYY-MM-DD.
 * PayPal uses 2-digit years; assumes 2000s (25 → 2025).
 */
function parsePayPalDate(str) {
  const parts = str.split("/");
  if (parts.length !== 3) return str;
  const [m, d, y] = parts;
  const year = 2000 + parseInt(y, 10);
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
