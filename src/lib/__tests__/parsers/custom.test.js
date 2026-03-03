import { describe, it, expect } from "vitest";
import { detectColumnMappings, applyColumnMapping } from "../../parsers/custom.js";

describe("detectColumnMappings", () => {
  it("detects standard header names", () => {
    const mapping = detectColumnMappings(["Symbol", "Shares", "Cost Basis Total", "Date"]);
    expect(mapping.symbol).toBe("Symbol");
    expect(mapping.quantity).toBe("Shares");
    expect(mapping.costBasis).toBe("Cost Basis Total");
    expect(mapping.acquisitionDate).toBe("Date");
  });

  it("detects alternate header spellings (case-insensitive)", () => {
    const mapping = detectColumnMappings(["TICKER", "qty", "avg cost", "purchase date"]);
    expect(mapping.symbol).toBe("TICKER");
    expect(mapping.quantity).toBe("qty");
    expect(mapping.costBasis).toBe("avg cost");
    expect(mapping.acquisitionDate).toBe("purchase date");
  });

  it("detects Transamerica-style headers", () => {
    const mapping = detectColumnMappings(["Fund Name", "Number of Units", "Unit Value"]);
    expect(mapping.name).toBe("Fund Name");
    expect(mapping.quantity).toBe("Number of Units");
    expect(mapping.price).toBe("Unit Value");
  });

  it("returns empty object for unrecognized headers", () => {
    const mapping = detectColumnMappings(["col_a", "col_b", "col_c"]);
    expect(Object.keys(mapping)).toHaveLength(0);
  });

  it("picks the first matching header per field", () => {
    // Both "Symbol" and "Ticker" match the symbol heuristic — first wins
    const mapping = detectColumnMappings(["Symbol", "Ticker"]);
    expect(mapping.symbol).toBe("Symbol");
  });
});

describe("applyColumnMapping", () => {
  const rows = [
    { Ticker: "AAPL", Shares: "10", "Cost Basis": "$1500.00", "Purchase Date": "2023-01-15", Name: "Apple Inc" },
    { Ticker: "GOOG", Shares: "5",  "Cost Basis": "$8000.00", "Purchase Date": "2023-03-01", Name: "Alphabet Inc" },
    { Ticker: "",     Shares: "3",  "Cost Basis": "$100.00",  "Purchase Date": "", Name: "" },   // no symbol — dropped
    { Ticker: "MSFT", Shares: "0",  "Cost Basis": "$0.00",    "Purchase Date": "", Name: "" },   // zero qty — dropped
    { Ticker: "TSLA", Shares: "-1", "Cost Basis": "$500.00",  "Purchase Date": "", Name: "" },   // negative qty — dropped
  ];

  const mapping = {
    symbol: "Ticker",
    quantity: "Shares",
    costBasis: "Cost Basis",
    acquisitionDate: "Purchase Date",
    name: "Name",
  };

  it("produces assets for valid rows only", () => {
    const { assets, droppedRows } = applyColumnMapping(rows, mapping);
    expect(assets).toHaveLength(2);
    expect(droppedRows).toBe(3);
  });

  it("parses numeric fields correctly", () => {
    const { assets } = applyColumnMapping(rows, mapping);
    expect(assets[0].symbol).toBe("AAPL");
    expect(assets[0].quantity).toBe(10);
    expect(assets[0].costBasis).toBeCloseTo(1500, 2);
    expect(assets[0].acquisitionDate).toBe("2023-01-15");
    expect(assets[0].name).toBe("Apple Inc");
  });

  it("falls back to symbol when name column is unmapped", () => {
    const { assets } = applyColumnMapping(
      [{ Ticker: "XYZ", Shares: "1", "Cost Basis": "0" }],
      { symbol: "Ticker", quantity: "Shares" },
    );
    expect(assets[0].name).toBe("XYZ");
  });

  it("treats unmapped costBasis as 0 (not NaN)", () => {
    const { assets } = applyColumnMapping(
      [{ Ticker: "XYZ", Shares: "5" }],
      { symbol: "Ticker", quantity: "Shares" },
    );
    expect(assets[0].costBasis).toBe(0);
  });

  it("returns droppedRows=0 and all assets when every row is valid", () => {
    const { assets, droppedRows } = applyColumnMapping(
      [{ S: "A", Q: "1" }, { S: "B", Q: "2" }],
      { symbol: "S", quantity: "Q" },
    );
    expect(assets).toHaveLength(2);
    expect(droppedRows).toBe(0);
  });

  it("returns empty assets and full droppedRows when all rows are invalid", () => {
    const { assets, droppedRows } = applyColumnMapping(
      [{ S: "", Q: "1" }, { S: "X", Q: "0" }],
      { symbol: "S", quantity: "Q" },
    );
    expect(assets).toHaveLength(0);
    expect(droppedRows).toBe(2);
  });
});
