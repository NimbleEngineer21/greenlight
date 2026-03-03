import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseTransamericaFundHoldings,
  parseTransamericaSourceBalance,
  parseTransamericaCSV,
} from "../../parsers/transamerica.js";

// ─── Inline fixture tests (always run) ───────────────────────────────────────

const FUND_HOLDINGS_CSV = `Fund Name,Percentage,Balance,Number of Units,Unit Value
State Street U.S. Bd Index Ret Acct,10.00%,$1000.00,100.000000,10.000000
Vanguard Target 2055,90.00%,$9000.00,900.000000,10.000000`;

const SOURCE_BALANCE_CSV = `Source Name,Total Balance,Vested Percentage,Vested Balance
Employee Pre-Tax,$6000.00,100.00%,$6000.00
Employee Roth 401(k),$2000.00,100.00%,$2000.00
Employer Safe Harbor Match,$2000.00,100.00%,$2000.00`;

describe("parseTransamericaFundHoldings — inline fixtures", () => {
  it("parses fund holdings into objects with required fields", () => {
    const { holdings, warnings } = parseTransamericaFundHoldings(FUND_HOLDINGS_CSV);
    expect(holdings).toHaveLength(2);
    expect(warnings).toHaveLength(0);
    expect(holdings[0].fundName).toBe("State Street U.S. Bd Index Ret Acct");
    expect(holdings[0].balance).toBeCloseTo(1000, 2);
    expect(holdings[0].units).toBeCloseTo(100, 4);
  });

  it("total balance sums correctly", () => {
    const { holdings } = parseTransamericaFundHoldings(FUND_HOLDINGS_CSV);
    const total = holdings.reduce((s, h) => s + h.balance, 0);
    expect(total).toBeCloseTo(10000, 2);
  });

  it("throws TypeError when passed non-string input", () => {
    expect(() => parseTransamericaFundHoldings(null)).toThrow(TypeError);
  });
});

describe("parseTransamericaSourceBalance — inline fixtures", () => {
  it("maps known source names to correct accountType keys", () => {
    const { accounts, warnings } = parseTransamericaSourceBalance(SOURCE_BALANCE_CSV);
    expect(accounts).toHaveLength(3);
    expect(warnings).toHaveLength(0);

    const pretax = accounts.find(a => a.accountType === "pretax_401k");
    const roth = accounts.find(a => a.accountType === "roth_401k");
    const sh = accounts.find(a => a.accountType === "safe_harbor");

    expect(pretax?.balance).toBeCloseTo(6000, 2);
    expect(roth?.balance).toBeCloseTo(2000, 2);
    expect(sh?.balance).toBeCloseTo(2000, 2);
  });

  it("unrecognized source name gets accountType 'unknown' and emits a warning", () => {
    const csv = `Source Name,Total Balance,Vested Percentage,Vested Balance\nEmployer Pension,$10000.00,100.00%,$10000.00`;
    const { accounts, warnings } = parseTransamericaSourceBalance(csv);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].accountType).toBe("unknown");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/unrecognized source type/i);
    expect(warnings[0]).toMatch(/Employer Pension/);
  });

  it("rows with null vested balance are skipped", () => {
    const csv = `Source Name,Total Balance,Vested Percentage,Vested Balance\nEmployee Pre-Tax,$5000.00,50.00%,`;
    const { accounts } = parseTransamericaSourceBalance(csv);
    expect(accounts).toHaveLength(0);
  });

  it("throws TypeError when passed non-string input", () => {
    expect(() => parseTransamericaSourceBalance(null)).toThrow(TypeError);
  });
});

describe("parseTransamericaCSV — inline fixtures", () => {
  it("auto-detects both file types by header and returns populated results", () => {
    const files = [
      { name: "fund-holdings.csv", text: FUND_HOLDINGS_CSV },
      { name: "source-balance.csv", text: SOURCE_BALANCE_CSV },
    ];
    const { retirementAccounts, fundHoldings, warnings } = parseTransamericaCSV(files);
    expect(retirementAccounts).toHaveLength(3);
    expect(fundHoldings).toHaveLength(2);
    expect(warnings).toHaveLength(0);
  });

  it("works with only source-balance.csv uploaded", () => {
    const files = [{ name: "source-balance.csv", text: SOURCE_BALANCE_CSV }];
    const { retirementAccounts, fundHoldings, warnings } = parseTransamericaCSV(files);
    expect(retirementAccounts).toHaveLength(3);
    expect(fundHoldings).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("warns when only fund-holdings.csv is uploaded (no account breakdown to import)", () => {
    const files = [{ name: "fund-holdings.csv", text: FUND_HOLDINGS_CSV }];
    const { retirementAccounts, warnings } = parseTransamericaCSV(files);
    expect(retirementAccounts).toHaveLength(0);
    expect(warnings.some(w => /source-balance/i.test(w))).toBe(true);
  });

  it("warns on unrecognized file format", () => {
    const files = [{ name: "random.csv", text: "col1,col2\nval1,val2" }];
    const { warnings } = parseTransamericaCSV(files);
    expect(warnings.some(w => w.includes("random.csv"))).toBe(true);
  });

  it("propagates unknown-source warnings from sub-parser", () => {
    const csv = `Source Name,Total Balance,Vested Percentage,Vested Balance\nEmployer Pension,$10000.00,100.00%,$10000.00`;
    const files = [{ name: "source-balance.csv", text: csv }];
    const { retirementAccounts, warnings } = parseTransamericaCSV(files);
    expect(retirementAccounts[0].accountType).toBe("unknown");
    expect(warnings.some(w => /unrecognized source type/i.test(w))).toBe(true);
  });
});

// ─── Real-data tests (skip if data directory not present) ─────────────────────

const DATA_DIR = join(process.cwd(), "data/user_az/transamerica");
const dataExists = existsSync(DATA_DIR);

describe.skipIf(!dataExists)("parseTransamerica — real data files", () => {
  it("fund-holdings: total balance is approximately $70,015", () => {
    const csv = readFileSync(join(DATA_DIR, "fund-holdings.csv"), "utf8");
    const { holdings } = parseTransamericaFundHoldings(csv);
    const total = holdings.reduce((s, h) => s + h.balance, 0);
    expect(total).toBeCloseTo(70015.61, 0);
  });

  it("source-balance: maps all 3 sources and produces no warnings", () => {
    const csv = readFileSync(join(DATA_DIR, "source-balance.csv"), "utf8");
    const { accounts, warnings } = parseTransamericaSourceBalance(csv);
    expect(accounts).toHaveLength(3);
    expect(warnings).toHaveLength(0);
    expect(accounts.find(a => a.accountType === "pretax_401k")?.balance).toBeCloseTo(36150.43, 2);
    expect(accounts.find(a => a.accountType === "roth_401k")?.balance).toBeCloseTo(9704.62, 2);
    expect(accounts.find(a => a.accountType === "safe_harbor")?.balance).toBeCloseTo(24160.56, 2);
  });

  it("source total matches fund holdings total", () => {
    const { accounts } = parseTransamericaSourceBalance(
      readFileSync(join(DATA_DIR, "source-balance.csv"), "utf8"),
    );
    const { holdings } = parseTransamericaFundHoldings(
      readFileSync(join(DATA_DIR, "fund-holdings.csv"), "utf8"),
    );
    const sourceTotal = accounts.reduce((s, a) => s + a.balance, 0);
    const fundTotal = holdings.reduce((s, h) => s + h.balance, 0);
    expect(sourceTotal).toBeCloseTo(fundTotal, 0);
  });
});
