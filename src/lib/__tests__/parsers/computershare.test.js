import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseComputerShareCSV } from "../../parsers/computershare.js";

// ─── Inline fixture tests (always run) ───────────────────────────────────────

const MINIMAL_CSV = `"Transactions"
"Summary"
"Company","Holding","Name","HIN"
"GAMESTOP CORP","CLASS A COMMON","Test User","C***1234"

"Share Lot Details"
"Transaction Type","Original Date","Original Price","Shares","Type","Cost Basis","Gain (loss)","Adjustment Reason","Adjustment Date","Original price","Shares","Type","Original Cost Basis"
"STOCK SPLIT","1/27/2021","","9","Covered","$625.4775","$0.00","","","","0","Covered","$0.00"
"DTC STOCK WITHDRAWALS (DRS)","4/20/2021","","4","Covered","$161.25","$0.00","CORP ACTION","7/21/2022","$0.00","47","Covered","$0.00"
"Total *","","","13","","$786.7275","","","","","","",""`;

const WARRANT_CSV = `"Transactions"
"Summary"
"Company","Holding","Name","HIN"
"GAMESTOP CORP","WARRANT","Test User","C***1234"

"Share Lot Details"
"Transaction Type","Original Date","Original Price","Shares","Type","Cost Basis","Gain (loss)","Adjustment Reason","Adjustment Date","Original price","Shares","Type","Original Cost Basis"
"WARRANT DIVIDEND","7/22/2022","","3","Covered","$45.00","$0.00","","","","0","Covered","$0.00"`;

describe("parseComputerShareCSV — inline fixtures", () => {
  it("parses a minimal CLASS A COMMON CSV and returns lots", () => {
    const lots = parseComputerShareCSV(MINIMAL_CSV, "test.csv");
    expect(lots.length).toBe(2);
    expect(lots[0].holdingType).toBe("CLASS A COMMON");
    expect(lots[0].shares).toBe(9);
    expect(lots[0].costBasis).toBeCloseTo(625.4775, 4);
    expect(lots[0].date).toBe("2021-01-27");
    expect(lots[0].source).toBe("test.csv");
  });

  it("detects WARRANT holdingType from Summary section", () => {
    const lots = parseComputerShareCSV(WARRANT_CSV, "warrant.csv");
    expect(lots.length).toBe(1);
    expect(lots[0].holdingType).toBe("WARRANT");
    expect(lots[0].shares).toBe(3);
  });

  it("skips footer rows containing asterisks in Transaction Type", () => {
    const csvWithFooter = MINIMAL_CSV.replace(
      '"Total","","","13"',
      '"Total *","","","13"',
    );
    const lots = parseComputerShareCSV(csvWithFooter, "test.csv");
    expect(lots.every(l => !l.transactionType.includes("*"))).toBe(true);
  });

  it("returns empty array when no Share Lot Details section found", () => {
    expect(parseComputerShareCSV("some,random,csv", "empty.csv")).toEqual([]);
  });

  it("strips BOM from input", () => {
    const lots = parseComputerShareCSV("\uFEFF" + MINIMAL_CSV, "bom.csv");
    expect(lots.length).toBe(2);
  });
});

// ─── Real-data tests (skip if data directory not present) ─────────────────────

const DATA_DIR = join(process.cwd(), "data/user_az/computershare");
const dataExists = existsSync(DATA_DIR);

const CSV_FILES = [
  "AZ__Transactions-01-Mar-2026-16-58-49.csv",
  "AZ__Transactions-01-Mar-2026-16-59-32.csv",
  "AZ__Transactions-01-Mar-2026-16-59-42.csv",
  "AZ__Transactions-01-Mar-2026-16-59-53.csv",
];

describe.skipIf(!dataExists)("parseComputerShareCSV — real data files", () => {
  it("parses the first CSV and returns lots with shares, cost basis, and valid dates", () => {
    const csv = readFileSync(join(DATA_DIR, CSV_FILES[0]), "utf8");
    const lots = parseComputerShareCSV(csv, CSV_FILES[0]);
    expect(lots.length).toBeGreaterThan(0);
    const lot = lots[0];
    expect(lot.shares).toBeGreaterThan(0);
    expect(lot.costBasis).toBeGreaterThanOrEqual(0);
    expect(lot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("aggregates all 4 CSV files to reasonable share and cost totals", () => {
    const allLots = CSV_FILES.flatMap(filename =>
      parseComputerShareCSV(readFileSync(join(DATA_DIR, filename), "utf8"), filename),
    );
    expect(allLots.length).toBeGreaterThan(0);
    expect(allLots.reduce((s, l) => s + l.shares, 0)).toBeGreaterThan(100);
    expect(allLots.reduce((s, l) => s + l.costBasis, 0)).toBeGreaterThan(1000);
  });
});
