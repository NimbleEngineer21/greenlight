import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePayPalCSV, applyPayPalAnnotations } from "../../parsers/paypal.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a crypto-detail CSV (has Cryptocurrency + Amount columns).
 */
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

/**
 * Build a full-history CSV (no Cryptocurrency/Amount columns — PayPal's actual export).
 * Uses 4-digit year dates: MM/DD/YYYY.
 */
function buildFullHistoryCSV(rows) {
  const header = "Date,Time,TimeZone,Name,Type,Status,Currency,Amount,Fees,Total,Exchange Rate,Receipt ID,Balance,Transaction ID,Item Title";
  const lines = rows.map(r => [
    r.date ?? "10/10/2025",
    r.time ?? "12:00:00",
    r.tz ?? "PST",
    r.name ?? "PayPal Inc.",
    r.type ?? "Cryptocurrency",
    r.status ?? "Completed",
    r.currency ?? "USD",
    r.amount ?? "-100.00",
    r.fees ?? "-1.00",
    r.total ?? "-100.00",
    r.exchangeRate ?? "",
    r.receiptId ?? "",
    r.balance ?? "-100.00",
    r.txId ?? "TX123",
    r.itemTitle ?? "",
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

// ─── Full-history format tests ────────────────────────────────────────────────

describe("parsePayPalCSV — full-history format (needsAnnotation)", () => {
  it("returns needsAnnotation: true and pendingRows when no Cryptocurrency column", () => {
    const csv = buildFullHistoryCSV([{ amount: "-500.00", txId: "TX001" }]);
    const result = parsePayPalCSV(csv);

    expect(result.needsAnnotation).toBe(true);
    expect(Array.isArray(result.pendingRows)).toBe(true);
    expect(result.assets).toBeUndefined();
  });

  it("pendingRow has correct structure with ISO date, numeric amountUSD, empty symbol/quantity", () => {
    const csv = buildFullHistoryCSV([{ date: "10/10/2025", amount: "-1522.50", fees: "-22.50", txId: "TX001" }]);
    const { pendingRows } = parsePayPalCSV(csv);

    expect(pendingRows).toHaveLength(1);
    const row = pendingRows[0];
    expect(row.date).toBe("2025-10-10");
    expect(row.amountUSD).toBeCloseTo(1522.50, 2);
    expect(row.fees).toBeCloseTo(22.50, 2);
    expect(row.txId).toBe("TX001");
    expect(row.symbol).toBe("");
    expect(row.quantity).toBe("");
  });

  it("converts 4-digit year MM/DD/YYYY dates to ISO format", () => {
    const csv = buildFullHistoryCSV([{ date: "01/11/2026", amount: "-153.00" }]);
    const { pendingRows } = parsePayPalCSV(csv);

    expect(pendingRows[0].date).toBe("2026-01-11");
  });

  it("strips thousands separators from Amount", () => {
    const csv = buildFullHistoryCSV([{ amount: '"-1,522.50"', fees: '"-22.50"' }]);
    const { pendingRows } = parsePayPalCSV(csv);

    expect(pendingRows[0].amountUSD).toBeCloseTo(1522.50, 2);
  });

  it("filters out non-Cryptocurrency rows", () => {
    const csv = buildFullHistoryCSV([
      { type: "Cryptocurrency", amount: "-100.00" },
      { type: "PreApproved Payment Bill User Payment", amount: "-34.24" },
      { type: "General Payment", amount: "-55.99" },
    ]);
    const { pendingRows } = parsePayPalCSV(csv);

    expect(pendingRows).toHaveLength(1);
  });

  it("filters out non-Completed rows", () => {
    const csv = buildFullHistoryCSV([
      { type: "Cryptocurrency", status: "Completed", amount: "-100.00" },
      { type: "Cryptocurrency", status: "Pending", amount: "-100.00" },
    ]);
    const { pendingRows } = parsePayPalCSV(csv);

    expect(pendingRows).toHaveLength(1);
  });
});

// ─── applyPayPalAnnotations tests ─────────────────────────────────────────────

describe("applyPayPalAnnotations", () => {
  it("aggregates multiple rows for the same symbol", () => {
    const rows = [
      { date: "2025-10-10", amountUSD: 1522.50, symbol: "ETH", quantity: "0.36" },
      { date: "2025-10-25", amountUSD: 509.00,  symbol: "ETH", quantity: "0.15" },
    ];
    const { assets } = applyPayPalAnnotations(rows);

    expect(assets).toHaveLength(1);
    expect(assets[0].symbol).toBe("ETH");
    expect(assets[0].quantity).toBeCloseTo(0.51, 6);
    expect(assets[0].costBasis).toBeCloseTo(2031.50, 2);
  });

  it("produces separate assets for different symbols", () => {
    const rows = [
      { date: "2025-10-10", amountUSD: 1522.50, symbol: "ETH", quantity: "0.36" },
      { date: "2025-10-10", amountUSD: 763.50,  symbol: "BTC", quantity: "0.008" },
    ];
    const { assets } = applyPayPalAnnotations(rows);

    expect(assets).toHaveLength(2);
    expect(assets.find(a => a.symbol === "ETH")).toBeDefined();
    expect(assets.find(a => a.symbol === "BTC")).toBeDefined();
  });

  it("uses the earliest date as acquisitionDate", () => {
    const rows = [
      { date: "2025-11-14", amountUSD: 509.00, symbol: "ETH", quantity: "0.15" },
      { date: "2025-10-10", amountUSD: 1522.50, symbol: "ETH", quantity: "0.36" },
    ];
    const { assets } = applyPayPalAnnotations(rows);

    expect(assets[0].acquisitionDate).toBe("2025-10-10");
  });

  it("normalises symbol to uppercase", () => {
    const rows = [{ date: "2025-10-10", amountUSD: 100, symbol: "eth", quantity: "0.1" }];
    const { assets } = applyPayPalAnnotations(rows);

    expect(assets[0].symbol).toBe("ETH");
    expect(assets[0].priceKey).toBe("eth");
  });

  it("skips rows with missing symbol or non-positive quantity", () => {
    const rows = [
      { date: "2025-10-10", amountUSD: 100, symbol: "",    quantity: "0.1" },
      { date: "2025-10-10", amountUSD: 100, symbol: "BTC", quantity: "0" },
      { date: "2025-10-10", amountUSD: 100, symbol: "BTC", quantity: "-1" },
      { date: "2025-10-10", amountUSD: 200, symbol: "ETH", quantity: "0.5" },
    ];
    const { assets } = applyPayPalAnnotations(rows);

    expect(assets).toHaveLength(1);
    expect(assets[0].symbol).toBe("ETH");
  });

  it("returns correct asset metadata", () => {
    const rows = [{ date: "2025-10-10", amountUSD: 1522.50, symbol: "ETH", quantity: "0.36" }];
    const { assets } = applyPayPalAnnotations(rows);

    expect(assets[0].platform).toBe("PayPal");
    expect(assets[0].holdingType).toBe("crypto");
    expect(assets[0].feeType).toBe("none");
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

describe.skipIf(!dataExists)("parsePayPalCSV — real full-history file", () => {
  it("returns needsAnnotation with 11 pending crypto rows", () => {
    const text = readFileSync(join(DATA_DIR, "paypal_full_history.csv"), "utf8");
    const result = parsePayPalCSV(text);

    expect(result.needsAnnotation).toBe(true);
    expect(result.pendingRows).toHaveLength(11);
  });

  it("each pending row has ISO date, numeric amountUSD, and empty symbol/quantity", () => {
    const text = readFileSync(join(DATA_DIR, "paypal_full_history.csv"), "utf8");
    const { pendingRows } = parsePayPalCSV(text);

    for (const row of pendingRows) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.amountUSD).toBe("number");
      expect(row.amountUSD).toBeGreaterThan(0);
      expect(row.symbol).toBe("");
      expect(row.quantity).toBe("");
    }
  });

  it("first pending row is the 10/10/2025 ETH buy of $1,522.50", () => {
    const text = readFileSync(join(DATA_DIR, "paypal_full_history.csv"), "utf8");
    const { pendingRows } = parsePayPalCSV(text);

    expect(pendingRows[0].date).toBe("2025-10-10");
    expect(pendingRows[0].amountUSD).toBeCloseTo(1522.50, 2);
    expect(pendingRows[0].txId).toBe("1LA55463YP007210S");
  });

  it("total USD across all pending rows matches sum of all crypto purchases", () => {
    const text = readFileSync(join(DATA_DIR, "paypal_full_history.csv"), "utf8");
    const { pendingRows } = parsePayPalCSV(text);

    // 1522.50 + 763.50 + 509 + 254.50 + 305.40 + 305.40 + 509 + 102 + 204 + 153 + 204
    const total = pendingRows.reduce((sum, r) => sum + r.amountUSD, 0);
    expect(total).toBeCloseTo(4832.30, 1);
  });
});
