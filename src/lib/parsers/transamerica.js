import Papa from "papaparse";

function parseDollar(str) {
  if (typeof str !== "string" || str.trim() === "") return null;
  const cleaned = str.replace(/[$,%]/g, "").trim();
  if (!cleaned || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Map Transamerica source names to standard accountType keys.
// Returns null for unrecognized names so callers can warn instead of silently guessing.
const SOURCE_TYPE_MAP = {
  "employee pre-tax": "pretax_401k",
  "employee roth 401(k)": "roth_401k",
  "employer safe harbor match": "safe_harbor",
  "employer match": "safe_harbor",
  "employer profit sharing": "safe_harbor",
  "after-tax": "after_tax_401k",
};

function normalizeSourceType(name) {
  const lower = (name || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(SOURCE_TYPE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

/**
 * Parse Transamerica fund-holdings.csv
 * Returns { holdings, warnings }
 */
export function parseTransamericaFundHoldings(csvText) {
  if (typeof csvText !== "string") {
    throw new TypeError("Transamerica fund-holdings parser received no file content.");
  }

  const text = csvText.replace(/^\uFEFF/, "");
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });

  const warnings = result.errors
    .filter(e => e.type !== "FieldMismatch")
    .map(e => `fund-holdings CSV warning at row ${e.row}: ${e.message}`);

  const holdings = [];
  for (const row of result.data) {
    const fundName = (row["Fund Name"] || "").trim();
    if (!fundName) continue;

    const balance = parseDollar(row["Balance"]);
    const units = parseFloat((row["Number of Units"] || "").trim()) || 0;
    const unitValue = parseFloat((row["Unit Value"] || "").trim()) || 0;
    const percentage = parseDollar(row["Percentage"]);

    if (balance == null) continue;

    holdings.push({ fundName, percentage: percentage ?? 0, balance, units, unitValue });
  }

  return { holdings, warnings };
}

/**
 * Parse Transamerica source-balance.csv
 * Returns { accounts, warnings }
 */
export function parseTransamericaSourceBalance(csvText) {
  if (typeof csvText !== "string") {
    throw new TypeError("Transamerica source-balance parser received no file content.");
  }

  const text = csvText.replace(/^\uFEFF/, "");
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });

  const warnings = result.errors
    .filter(e => e.type !== "FieldMismatch")
    .map(e => `source-balance CSV warning at row ${e.row}: ${e.message}`);

  const accounts = [];
  for (const row of result.data) {
    const sourceName = (row["Source Name"] || "").trim();
    if (!sourceName) continue;

    const balance = parseDollar(row["Vested Balance"]);
    if (balance == null) continue;

    const accountType = normalizeSourceType(sourceName);
    if (accountType === null) {
      warnings.push(
        `Unrecognized source type "${sourceName}" — imported as "unknown". ` +
        `Verify the account type manually before using retirement projections.`,
      );
    }

    accounts.push({
      accountType: accountType ?? "unknown",
      platform: "Transamerica",
      balance,
      contributions: 0,
      notes: sourceName,
    });
  }

  return { accounts, warnings };
}

/**
 * Parse one or both Transamerica CSV files.
 * Pass whichever files were uploaded; detection is by header inspection.
 *
 * Returns: { retirementAccounts, fundHoldings, warnings }
 */
export function parseTransamericaCSV(files) {
  let retirementAccounts = [];
  let fundHoldings = [];
  const warnings = [];

  for (const { name, text } of files) {
    const firstLine = (text || "").split("\n")[0] || "";
    if (firstLine.includes("Source Name")) {
      const r = parseTransamericaSourceBalance(text);
      retirementAccounts = r.accounts;
      warnings.push(...r.warnings);
    } else if (firstLine.includes("Fund Name")) {
      const r = parseTransamericaFundHoldings(text);
      fundHoldings = r.holdings;
      warnings.push(...r.warnings);
    } else {
      warnings.push(`Unrecognized file format: ${name}`);
    }
  }

  if (retirementAccounts.length === 0 && fundHoldings.length > 0) {
    warnings.push(
      "Fund holdings display only — upload source-balance.csv to import account data.",
    );
  }

  return { retirementAccounts, fundHoldings, warnings };
}
