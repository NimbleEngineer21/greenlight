import Papa from "papaparse";

export function parseComputerShareCSV(csvText, filename = "") {
  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.split("\n");

  // Detect holding type from Summary section
  let holdingType = "CLASS A COMMON";
  for (const line of lines) {
    if (line.includes('"WARRANT"')) { holdingType = "WARRANT"; break; }
    if (line.includes('"CLASS A COMMON"')) { holdingType = "CLASS A COMMON"; break; }
  }

  // Find "Share Lot Details" section
  let lotStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Share Lot Details")) { lotStartIndex = i + 1; break; }
  }
  if (lotStartIndex < 0) return [];

  // Parse CSV from lot details onward
  const lotLines = lines.slice(lotStartIndex).join("\n");
  const result = Papa.parse(lotLines, { header: true, skipEmptyLines: true });

  const lots = [];
  for (const row of result.data) {
    const shares = parseFloat(row["Shares"]) || 0;
    if (shares === 0) continue;
    if (row["Transaction Type"]?.includes("*")) continue; // footer

    const costBasisStr = (row["Cost Basis"] || "").replace(/[$,]/g, "");
    const costBasis = parseFloat(costBasisStr) || 0;

    // Parse date MM/DD/YYYY → YYYY-MM-DD
    const dateStr = row["Original Date"] || "";
    const parts = dateStr.split("/");
    const isoDate = parts.length === 3
      ? `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`
      : "";

    lots.push({
      transactionType: row["Transaction Type"] || "",
      date: isoDate,
      shares,
      costBasis,
      holdingType,
      source: filename,
    });
  }

  return lots;
}
