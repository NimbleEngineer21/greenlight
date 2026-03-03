import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePayPalCSV } from "../../parsers/paypal.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCSV(rows) {
  const header = "Date,Time,TimeZone,Name,Type,Status,Currency,Amount (USD),Fees,Total,Exchange Rate,Cryptocurrency,Amount,Transaction ID";
  const lines = rows.map(r => [
    r.date ?? "1/1/25",
    r.time ?? "12:00:00",
    r.tz ?? "PST",
    r.name ?? "PayPal Inc.",
    r.type ?? "Cryptocurrency",
    r.status ?? "Completed",
    r.currency ?? "USD",
    r.amountUSD ?? "-100",
    r.fees ?? "-1",
    r.total ?? "-100",
    r.exchangeRate ?? "50000",
    r.crypto ?? "BTC",
    r.amount ?? "0.002",
    r.txId ?? "TX123",
  ].join(","));
  return [header, ...lines].join("\n");
}

// ─── Inline fixture tests ─────────────────────────────────────────────────────

describe("parsePayPalCSV — inline fixtures", () => {
  it("returns empty assets for an empty CSV", () => {
    const csv = "Date,Time,TimeZone,Name,Type,Status,Currency,Amount (USD),Fees,Total,Exchange Rate,Cryptocurrency,Amount,Transaction ID\n";
    const { assets } = parsePayPalCSV(csv);
    expect(assets).toEqual([]);
  });

  it("parses a single buy and returns one asset", () => {
    const csv = buildCSV([{ crypto: "ETH", amount: "0.5", amountUSD: "-1500", fees: "-22.5", date: "10/10/25" }]);
    const { assets } = parsePayPalCSV(csv);

    expect(assets).toHaveLength(1);
    expect(assets[0].symbol).toBe("ETH");
    expect(assets[0].quantity).toBeCloseTo(0.5, 6);
    expect(assets[0].costBasis).toBeCloseTo(1500, 2);
    expect(assets[0].acquisitionDate).toBe("2025-10-10");
  });

  it("aggregates multiple buys of the same currency", () => {
    const csv = buildCSV([
      { crypto: "BTC", amount: "0.001", amountUSD: "-100", date: "1/1/25" },
      { crypto: "BTC", amount: "0.002", amountUSD: "-200", date: "2/1/25" },
    ]);
    const { assets } = parsePayPalCSV(csv);

    expect(assets).toHaveLength(1);
    expect(assets[0].symbol).toBe("BTC");
    expect(assets[0].quantity).toBeCloseTo(0.003, 6);
    expect(assets[0].costBasis).toBeCloseTo(300, 2);
  });

  it("produces separate assets for different currencies", () => {
    const csv = buildCSV([
      { crypto: "BTC", amount: "0.001", amountUSD: "-100" },
      { crypto: "ETH", amount: "0.1",   amountUSD: "-300" },
    ]);
    const { assets } = parsePayPalCSV(csv);

    expect(assets).toHaveLength(2);
    expect(assets.find(a => a.symbol === "BTC")).toBeDefined();
    expect(assets.find(a => a.symbol === "ETH")).toBeDefined();
  });

  it("uses the earliest buy date as acquisitionDate", () => {
    const csv = buildCSV([
      { crypto: "ETH", amount: "1", amountUSD: "-3000", date: "6/15/25" },
      { crypto: "ETH", amount: "1", amountUSD: "-3500", date: "3/1/25" },
    ]);
    const { assets } = parsePayPalCSV(csv);

    expect(assets[0].acquisitionDate).toBe("2025-03-01");
  });

  it("strips commas from Amount (USD) with thousands separators", () => {
    const csv = buildCSV([{ crypto: "ETH", amount: "0.36", amountUSD: '"-1,522.50"', fees: "-22.5" }]);
    const { assets } = parsePayPalCSV(csv);

    expect(assets[0].costBasis).toBeCloseTo(1522.5, 2);
  });

  it("skips rows where Type is not Cryptocurrency", () => {
    const csv = buildCSV([
      { type: "Payment", crypto: "BTC", amount: "0.001", amountUSD: "-100" },
    ]);
    const { assets } = parsePayPalCSV(csv);
    expect(assets).toHaveLength(0);
  });

  it("skips rows where Status is not Completed", () => {
    const csv = buildCSV([
      { status: "Pending", crypto: "BTC", amount: "0.001", amountUSD: "-100" },
    ]);
    const { assets } = parsePayPalCSV(csv);
    expect(assets).toHaveLength(0);
  });

  it("a sell reduces quantity and proportional cost basis", () => {
    const csv = buildCSV([
      { crypto: "BTC", amount: "1",   amountUSD: "-40000", date: "1/1/25" },
      { crypto: "BTC", amount: "-0.5", amountUSD: "25000",  date: "6/1/25" },
    ]);
    const { assets } = parsePayPalCSV(csv);

    expect(assets).toHaveLength(1);
    expect(assets[0].quantity).toBeCloseTo(0.5, 6);
    // Cost basis halved
    expect(assets[0].costBasis).toBeCloseTo(20000, 2);
  });

  it("a sell that exhausts the full position produces no asset", () => {
    const csv = buildCSV([
      { crypto: "BTC", amount: "1",  amountUSD: "-40000", date: "1/1/25" },
      { crypto: "BTC", amount: "-1", amountUSD: "45000",  date: "6/1/25" },
    ]);
    const { assets } = parsePayPalCSV(csv);
    expect(assets).toHaveLength(0);
  });

  it("returns correct asset metadata", () => {
    const csv = buildCSV([{ crypto: "ETH", amount: "2", amountUSD: "-6000" }]);
    const { assets } = parsePayPalCSV(csv);

    expect(assets[0].platform).toBe("PayPal");
    expect(assets[0].holdingType).toBe("crypto");
    expect(assets[0].priceKey).toBe("eth");
    expect(assets[0].feeType).toBe("none");
  });

  it("strips a UTF-8 BOM if present", () => {
    const csv = "\uFEFF" + buildCSV([{ crypto: "BTC", amount: "0.001", amountUSD: "-100" }]);
    const { assets } = parsePayPalCSV(csv);
    expect(assets).toHaveLength(1);
  });
});

// ─── Real data tests (skipped if data directory absent) ───────────────────────

const DATA_DIR = join(process.cwd(), "data/user_az/paypal");
const dataExists = existsSync(DATA_DIR);

describe.skipIf(!dataExists)("parsePayPalCSV — real data file", () => {
  it("parses the CSV and returns assets with required fields", () => {
    const text = readFileSync(join(DATA_DIR, "paypal_crypto_transactions.csv"), "utf8");
    const { assets } = parsePayPalCSV(text);

    expect(assets.length).toBeGreaterThan(0);

    for (const asset of assets) {
      expect(asset.platform).toBe("PayPal");
      expect(asset.quantity).toBeGreaterThan(0);
      expect(typeof asset.costBasis).toBe("number");
      expect(asset.costBasis).toBeGreaterThan(0);
      expect(asset.holdingType).toBe("crypto");
      expect(asset.acquisitionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("produces ETH and BTC positions from the real file", () => {
    const text = readFileSync(join(DATA_DIR, "paypal_crypto_transactions.csv"), "utf8");
    const { assets } = parsePayPalCSV(text);

    const symbols = assets.map(a => a.symbol);
    expect(symbols).toContain("ETH");
    expect(symbols).toContain("BTC");
  });

  it("cost basis for ETH and BTC matches expected totals from the CSV", () => {
    const text = readFileSync(join(DATA_DIR, "paypal_crypto_transactions.csv"), "utf8");
    const { assets } = parsePayPalCSV(text);

    const eth = assets.find(a => a.symbol === "ETH");
    const btc = assets.find(a => a.symbol === "BTC");

    // ETH buys: 1522.50 + 509 + 305.40 + 509 + 204 + 204 = 3253.90
    expect(eth.costBasis).toBeCloseTo(3253.90, 1);

    // BTC buys: 763.50 + 254.50 + 305.40 + 102 + 153 = 1578.40
    expect(btc.costBasis).toBeCloseTo(1578.40, 1);
  });
});
