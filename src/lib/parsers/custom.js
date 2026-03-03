// Heuristic column detection for unknown CSV formats.
// Maps common header name variations to canonical field names.
export const COLUMN_HEURISTICS = {
  symbol: [/^sym(bol)?$/i, /^ticker$/i, /^security$/i, /^stock$/i],
  name: [/^(fund\s*)?name$/i, /^description$/i, /^security\s*name$/i],
  quantity: [/^(num(ber)?\s*of\s*)?(shares|units)$/i, /^qty$/i, /^quantity$/i],
  costBasis: [/^cost\s*basis(?:\s*total)?$/i, /^avg\s*cost$/i, /^purchase\s*price$/i, /^book\s*value$/i],
  acquisitionDate: [/^(acquisition|purchase|trade)\s*date$/i, /^date\s*(acquired|purchased)?$/i, /^date$/i],
  price: [/^(last|current|market)\s*price$/i, /^price$/i, /^unit\s*value$/i],
};

/**
 * Scan CSV headers and return auto-detected column mappings.
 * Each returned key maps to the first header that matches its heuristic patterns.
 */
export function detectColumnMappings(headers) {
  const mappings = {};
  for (const [field, patterns] of Object.entries(COLUMN_HEURISTICS)) {
    for (const header of headers) {
      if (patterns.some(p => p.test(header.trim()))) {
        mappings[field] = header;
        break;
      }
    }
  }
  return mappings;
}

/**
 * Apply a column mapping to parsed CSV rows and return assets.
 * Returns { assets, droppedRows } — droppedRows counts rows skipped due to
 * missing symbol or non-positive quantity, so callers can warn the user.
 */
export function applyColumnMapping(rows, mapping) {
  const assets = [];
  let droppedRows = 0;

  for (const row of rows) {
    const symbol = (row[mapping.symbol] || "").trim();
    if (!symbol) { droppedRows++; continue; }

    const quantityRaw = (row[mapping.quantity] || "").replaceAll(",", "").trim();
    const quantity = Number.parseFloat(quantityRaw) || 0;
    if (quantity <= 0) { droppedRows++; continue; }

    const costBasisRaw = (row[mapping.costBasis] || "").replaceAll(/[$,]/g, "").trim();
    const costBasis = Number.parseFloat(costBasisRaw) || 0;

    const name = (row[mapping.name] || symbol).trim();
    const acquisitionDate = (row[mapping.acquisitionDate] || "").trim();

    assets.push({
      platform: "Custom CSV",
      name,
      symbol,
      quantity,
      costBasis,
      acquisitionDate,
      priceKey: symbol.toLowerCase(),
      feeType: "none",
      holdingType: "stock",
      notes: "Imported from custom CSV",
    });
  }

  return { assets, droppedRows };
}
