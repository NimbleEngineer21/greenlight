import { describe, it, expect } from "vitest";
import { parseFidelityCSV } from "../fidelity.js";

const HDR = `Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Today's Gain/Loss Dollar,Today's Gain/Loss Percent,Total Gain/Loss Dollar,Total Gain/Loss Percent,Percent Of Account,Cost Basis Total,Average Cost Basis,Type`;

const SAMPLE_CSV = `${HDR}
Z09502754,Individual - TOD,FZFXX**,HELD IN MONEY MARKET,,,,$108.02,,,,,0.30%,,,Cash,
Z09502754,Individual - TOD,QQQ,INVESCO QQQ TR UNIT SER 1,34,$606.07,-$1.22,$20606.38,-$41.48,-0.21%,+$6510.26,+46.18%,57.53%,$14096.12,$414.59,Cash,
Z09502754,Individual - TOD,VOO,VANGUARD INDEX FUNDS S&P 500 ETF USD,24,$629.39,-$1.65,$15105.36,-$39.60,-0.27%,+$3610.14,+31.40%,42.17%,$11495.22,$478.97,Cash,

"The data and information in this spreadsheet is provided to you solely for your use."

"Brokerage services are provided by Fidelity Brokerage Services LLC."

"Date downloaded Mar-02-2026 at 10:46 a.m ET"`;

describe("parseFidelityCSV", () => {
  it("parses equity positions with correct fields", () => {
    const { assets } = parseFidelityCSV(SAMPLE_CSV);
    expect(assets).toHaveLength(2);

    const qqq = assets[0];
    expect(qqq.symbol).toBe("QQQ");
    expect(qqq.name).toBe("INVESCO QQQ TR UNIT SER 1");
    expect(qqq.quantity).toBe(34);
    expect(qqq.costBasis).toBe(14096.12);
    expect(qqq.platform).toBe("Fidelity");
    expect(qqq.feeType).toBe("fidelity");
    expect(qqq.holdingType).toBe("stock");
    expect(qqq.priceKey).toBe("qqq");
    // acquisitionDate is always empty — Fidelity positions exports don't include lot dates
    expect(qqq.acquisitionDate).toBe("");
  });

  it("identifies money market as cash position", () => {
    const { cashPositions } = parseFidelityCSV(SAMPLE_CSV);
    expect(cashPositions).toHaveLength(1);
    expect(cashPositions[0].symbol).toBe("FZFXX");
    expect(cashPositions[0].value).toBe(108.02);
    expect(cashPositions[0].accountName).toBe("Individual - TOD");
  });

  it("puts accountName in notes field, not as a top-level asset property", () => {
    const { assets } = parseFidelityCSV(SAMPLE_CSV);
    expect(assets[0].notes).toBe("Account: Individual - TOD");
    expect(assets[0]).not.toHaveProperty("accountName");
  });

  it("skips disclaimer rows without emitting them as assets or errors", () => {
    const csvWithLongDisclaimer = SAMPLE_CSV +
      `\n"The data and information in this spreadsheet is provided to you solely for your use and is not for distribution. The spreadsheet is provided for informational purposes only."`;
    const { assets, cashPositions } = parseFidelityCSV(csvWithLongDisclaimer);
    expect(assets).toHaveLength(2);
    expect(cashPositions).toHaveLength(1);
  });

  it("handles dollar values with $ + - prefixes", () => {
    const csv = `${HDR}
X123,IRA,AAPL,APPLE INC,10,$200.00,+$5.00,$2000.00,+$50.00,+2.56%,+$500.00,+33.33%,100.00%,$1500.00,$150.00,Cash,`;
    const { assets } = parseFidelityCSV(csv);
    expect(assets[0].costBasis).toBe(1500);
    expect(assets[0].quantity).toBe(10);
  });

  it("treats '--' cost basis as 0 and emits a warning", () => {
    const csv = `${HDR}
X123,IRA,VTI,VANGUARD TOTAL MARKET,20,$250.00,,,$5000.00,,,,,--,,Cash,`;
    const { assets, warnings } = parseFidelityCSV(csv);
    expect(assets[0].costBasis).toBe(0);
    expect(warnings.some(w => w.includes("VTI") && w.includes("cost basis unavailable"))).toBe(true);
  });

  it("treats empty cost basis as 0 and emits a warning", () => {
    const csv = `${HDR}
X123,IRA,VTI,VANGUARD TOTAL MARKET,20,$250.00,,,$5000.00,,,,,,,Cash,`;
    const { assets, warnings } = parseFidelityCSV(csv);
    expect(assets[0].costBasis).toBe(0);
    expect(warnings.some(w => w.includes("VTI") && w.includes("cost basis unavailable"))).toBe(true);
  });

  it("emits separate assets for the same symbol across multiple accounts", () => {
    const csv = `${HDR}
A111,Individual - TOD,QQQ,INVESCO QQQ,10,$600.00,,,$6000.00,,,,,,,$5000.00,$500.00,Cash,
B222,Roth IRA,QQQ,INVESCO QQQ,5,$600.00,,,$3000.00,,,,,,,$2500.00,$500.00,Cash,`;
    const { assets } = parseFidelityCSV(csv);
    expect(assets).toHaveLength(2);
    expect(assets[0].notes).toBe("Account: Individual - TOD");
    expect(assets[1].notes).toBe("Account: Roth IRA");
    expect(assets[0].quantity).toBe(10);
    expect(assets[1].quantity).toBe(5);
  });

  it("returns empty assets and a cash position when all rows are money market", () => {
    const csv = `${HDR}
Z123,Individual - TOD,FZFXX**,MONEY MARKET,,,,$5000.00,,,,,,,,,Cash,
Z123,Individual - TOD,SPAXX**,GOVT MM,,,,$1000.00,,,,,,,,,Cash,`;
    const { assets, cashPositions } = parseFidelityCSV(csv);
    expect(assets).toHaveLength(0);
    expect(cashPositions).toHaveLength(2);
  });

  it("returns empty arrays for empty input", () => {
    const { assets, cashPositions } = parseFidelityCSV("");
    expect(assets).toHaveLength(0);
    expect(cashPositions).toHaveLength(0);
  });

  it("returns empty arrays for header-only input", () => {
    const { assets, cashPositions } = parseFidelityCSV(`${HDR}\n`);
    expect(assets).toHaveLength(0);
    expect(cashPositions).toHaveLength(0);
  });

  it("handles BOM-prefixed input", () => {
    const { assets } = parseFidelityCSV("\uFEFF" + SAMPLE_CSV);
    expect(assets).toHaveLength(2);
  });

  it("throws a descriptive error when called with non-string input", () => {
    expect(() => parseFidelityCSV(null)).toThrow("Fidelity parser received no file content");
    expect(() => parseFidelityCSV(undefined)).toThrow("Fidelity parser received no file content");
  });
});
