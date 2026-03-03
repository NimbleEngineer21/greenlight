import Papa from "papaparse";

// Returns null for unparseable values (e.g. Fidelity's "--" for unavailable cost basis).
function parseDollar(str) {
  if (typeof str !== "string" || str.trim() === "") return null;
  const cleaned = str.replace(/[$,+%]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "--") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function parseFidelityCSV(csvText) {
  if (typeof csvText !== "string") {
    throw new Error("Fidelity parser received no file content — try re-uploading the CSV.");
  }

  const text = csvText.replace(/^\uFEFF/, "");
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });

  // FieldMismatch errors on Fidelity's trailing disclaimer rows are expected and harmless.
  // Surface any other error types (Quotes, Delimiter) as warnings.
  const warnings = result.errors
    .filter(e => e.type !== "FieldMismatch")
    .map(e => `CSV parse warning at row ${e.row}: ${e.message}`);

  const assets = [];
  const cashPositions = [];

  for (const row of result.data) {
    const acct = (row["Account Number"] || "").trim();
    const symbol = (row["Symbol"] || "").trim();
    if (!acct || !symbol) continue;

    const accountName = (row["Account Name"] || "").trim();
    const description = (row["Description"] || "").trim();
    const quantity = parseFloat((row["Quantity"] || "").trim()) || 0;

    // Money market / cash positions: symbol ends with ** or no quantity
    if (symbol.includes("**") || quantity === 0) {
      const value = parseDollar(row["Current Value"]);
      if (value != null && value > 0) {
        cashPositions.push({ name: description, symbol: symbol.replace(/\*+$/, ""), value, accountName });
      }
      continue;
    }

    const rawCostBasis = parseDollar(row["Cost Basis Total"]);
    if (rawCostBasis == null) {
      warnings.push(`${symbol}: cost basis unavailable ("${row["Cost Basis Total"] || "empty"}") — imported as $0, verify manually.`);
    }

    assets.push({
      platform: "Fidelity",
      name: description,
      symbol,
      quantity,
      costBasis: rawCostBasis ?? 0,
      acquisitionDate: "",
      priceKey: symbol.toLowerCase(),
      feeType: "fidelity",
      holdingType: "stock",
      notes: accountName ? `Account: ${accountName}` : "",
    });
  }

  return { assets, cashPositions, warnings };
}
