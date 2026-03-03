import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { parseGeminiXLSX } from "../../parsers/gemini.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal Gemini-format XLSX buffer from an array of row objects.
 * Gemini uses wide-format headers: "BTC Amount BTC", "Fee (BTC) BTC", etc.
 */
function buildGeminiXLSX(rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "transaction_history");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf;
}

// ─── Inline fixture tests (always run) ───────────────────────────────────────

describe("parseGeminiXLSX — inline fixtures", () => {
  it("returns empty assets and trades for a workbook with no transactions", () => {
    const buf = buildGeminiXLSX([{ Type: "", Date: "2024-01-01", "USD Amount USD": "" }]);
    const result = parseGeminiXLSX(buf);
    expect(result.assets).toEqual([]);
    expect(result.trades).toEqual([]);
  });

  it("Buy transaction increases quantity and cost basis", () => {
    const rows = [
      {
        Type: "Buy", Date: "2024-01-15",
        "BTC Amount BTC": 1, "Fee (BTC) BTC": 0.001,
        "USD Amount USD": -50000, "Fee (USD) USD": 25,
      },
    ];
    const { assets } = parseGeminiXLSX(buildGeminiXLSX(rows));

    expect(assets).toHaveLength(1);
    expect(assets[0].symbol).toBe("BTC");
    // qty = 1 - 0.001 (crypto fee deducted)
    expect(assets[0].quantity).toBeCloseTo(0.999, 3);
    // cost = |usdAmount| + |usdFee|
    expect(assets[0].costBasis).toBeCloseTo(50025, 2);
  });

  it("FIFO: Buy then partial Sell reduces quantity and cost basis proportionally", () => {
    const rows = [
      {
        Type: "Buy", Date: "2024-01-01",
        "BTC Amount BTC": 1, "Fee (BTC) BTC": 0,
        "USD Amount USD": -40000, "Fee (USD) USD": 0,
      },
      {
        Type: "Sell", Date: "2024-06-01",
        "BTC Amount BTC": -0.5, "Fee (BTC) BTC": 0,
        "USD Amount USD": 25000, "Fee (USD) USD": 0,
      },
    ];
    const { assets } = parseGeminiXLSX(buildGeminiXLSX(rows));

    expect(assets).toHaveLength(1);
    expect(assets[0].quantity).toBeCloseTo(0.5, 6);
    // After selling half, cost basis should be halved
    expect(assets[0].costBasis).toBeCloseTo(20000, 2);
  });

  it("Sell that exhausts entire position produces no asset entry", () => {
    const rows = [
      {
        Type: "Buy", Date: "2024-01-01",
        "BTC Amount BTC": 1, "Fee (BTC) BTC": 0,
        "USD Amount USD": -40000, "Fee (USD) USD": 0,
      },
      {
        Type: "Sell", Date: "2024-06-01",
        "BTC Amount BTC": -1, "Fee (BTC) BTC": 0,
        "USD Amount USD": 45000, "Fee (USD) USD": 0,
      },
    ];
    const { assets } = parseGeminiXLSX(buildGeminiXLSX(rows));
    expect(assets).toHaveLength(0);
  });

  it("Credit transaction is treated the same as Buy", () => {
    const rows = [
      {
        Type: "Credit", Date: "2024-02-01",
        "ETH Amount ETH": 2, "Fee (ETH) ETH": 0,
        "USD Amount USD": -6000, "Fee (USD) USD": 0,
      },
    ];
    const { assets } = parseGeminiXLSX(buildGeminiXLSX(rows));
    expect(assets).toHaveLength(1);
    expect(assets[0].symbol).toBe("ETH");
    expect(assets[0].quantity).toBeCloseTo(2.0, 6);
  });

  it("handles multiple currencies in the same workbook independently", () => {
    const rows = [
      {
        Type: "Buy", Date: "2024-01-01",
        "BTC Amount BTC": 0.5, "Fee (BTC) BTC": 0,
        "ETH Amount ETH": 0, "Fee (ETH) ETH": 0,
        "USD Amount USD": -25000, "Fee (USD) USD": 0,
      },
      {
        Type: "Buy", Date: "2024-01-02",
        "BTC Amount BTC": 0, "Fee (BTC) BTC": 0,
        "ETH Amount ETH": 3, "Fee (ETH) ETH": 0,
        "USD Amount USD": -9000, "Fee (USD) USD": 0,
      },
    ];
    const { assets } = parseGeminiXLSX(buildGeminiXLSX(rows));
    expect(assets).toHaveLength(2);
    const btc = assets.find(a => a.symbol === "BTC");
    const eth = assets.find(a => a.symbol === "ETH");
    expect(btc.quantity).toBeCloseTo(0.5, 6);
    expect(eth.quantity).toBeCloseTo(3.0, 6);
  });
});

// ─── Real-data tests (skip if data directory not present) ─────────────────────

const DATA_DIR = join(process.cwd(), "data/user_az/gemini");
const dataExists = existsSync(DATA_DIR);

describe.skipIf(!dataExists)("parseGeminiXLSX — real data files", () => {
  it("parses the XLSX and returns assets and trades with required fields", () => {
    const buffer = readFileSync(join(DATA_DIR, "AZ__transaction_history.xlsx"));
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const { assets, trades } = parseGeminiXLSX(arrayBuffer);

    expect(assets.length).toBeGreaterThan(0);
    expect(trades.length).toBeGreaterThan(0);

    for (const asset of assets) {
      expect(asset.platform).toBe("Gemini");
      expect(asset.quantity).toBeGreaterThan(0);
      expect(typeof asset.costBasis).toBe("number");
    }
    for (const trade of trades) {
      expect(trade).toHaveProperty("type");
      expect(trade).toHaveProperty("symbol");
      expect(trade).toHaveProperty("date");
    }
  });
});
