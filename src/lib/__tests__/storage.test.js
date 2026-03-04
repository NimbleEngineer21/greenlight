import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { migrateState, validateImport, importState } from "../storage.js";
import { encryptData } from "../crypto.js";
import { SCHEMA_VERSION } from "../../data/defaults.js";

describe("migrateState", () => {
  it("returns the same state object when version matches current", () => {
    const state = { schemaVersion: SCHEMA_VERSION, purchase: { category: "home" } };
    expect(migrateState(state)).toBe(state);
  });

  it("resets to defaults for empty/unrecognizable state", () => {
    const result = migrateState({});
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Array.isArray(result.assets)).toBe(true);
  });

  it("fresh defaults include dateOfBirth field", () => {
    const result = migrateState({});
    expect(result.dateOfBirth).toEqual({ month: "", year: "" });
  });

  it("resets unknown older versions to defaults", () => {
    const result = migrateState({ schemaVersion: 0, assets: [], purchase: {} });
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Array.isArray(result.assets)).toBe(true);
  });

  it("returns future-versioned state as-is", () => {
    const future = { schemaVersion: SCHEMA_VERSION + 1, assets: [{ name: "X" }] };
    const result = migrateState(future);
    expect(result).toBe(future);
  });
});

describe("validateImport", () => {
  it("accepts a valid GreenLight backup", () => {
    expect(() => validateImport({
      schemaVersion: SCHEMA_VERSION,
      assets: [{ name: "GME", symbol: "GME", quantity: 100 }],
      cashAccounts: [],
    })).not.toThrow();
  });

  it("accepts old backups without schemaVersion if they have data", () => {
    expect(() => validateImport({ assets: [{ name: "GME", symbol: "GME" }] })).not.toThrow();
  });

  it("rejects non-object inputs", () => {
    expect(() => validateImport(null)).toThrow("JSON object");
    expect(() => validateImport("hello")).toThrow("JSON object");
    expect(() => validateImport([1, 2])).toThrow("array");
    expect(() => validateImport(42)).toThrow("JSON object");
  });

  it("rejects objects that don't look like GreenLight data", () => {
    expect(() => validateImport({ foo: "bar" })).toThrow("doesn't look like a GreenLight backup");
  });

  it("rejects invalid schemaVersion", () => {
    expect(() => validateImport({ schemaVersion: -1 })).toThrow("Invalid schemaVersion");
    expect(() => validateImport({ schemaVersion: "ten" })).toThrow("Invalid schemaVersion");
  });

  it("rejects backups from a much newer version", () => {
    expect(() => validateImport({ schemaVersion: SCHEMA_VERSION + 10 })).toThrow("newer version");
  });

  it("allows slightly newer schemaVersion (forward-compat window)", () => {
    expect(() => validateImport({ schemaVersion: SCHEMA_VERSION + 3 })).not.toThrow();
  });

  it("rejects non-array assets", () => {
    expect(() => validateImport({ schemaVersion: 1, assets: "not-array" })).toThrow('"assets" must be an array');
  });

  it("rejects assets missing name and symbol", () => {
    expect(() => validateImport({
      schemaVersion: 1,
      assets: [{ quantity: 5 }],
    })).toThrow("assets[0] missing both name and symbol");
  });

  it("rejects non-number quantity in assets", () => {
    expect(() => validateImport({
      schemaVersion: 1,
      assets: [{ name: "GME", quantity: "five" }],
    })).toThrow("assets[0] quantity must be a number");
  });

  it("rejects non-array retirement.accounts", () => {
    expect(() => validateImport({
      schemaVersion: 1,
      retirement: { accounts: "bad" },
    })).toThrow("retirement.accounts must be an array");
  });
});

describe("importState", () => {
  const stored = {};

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      setItem: (k, v) => { stored[k] = v; },
      getItem: (k) => stored[k] ?? null,
      removeItem: (k) => { delete stored[k]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.keys(stored).forEach(k => delete stored[k]);
  });

  it("throws user-friendly error on invalid JSON", async () => {
    await expect(importState("not json")).rejects.toThrow("not valid JSON");
  });

  it("throws when encrypted file has no password", async () => {
    const envelope = { format: "greenlight-encrypted-v1", salt: "x", iv: "y", payload: "z" };
    await expect(importState(JSON.stringify(envelope))).rejects.toThrow("password is required");
  });

  it("imports plain JSON backup successfully", async () => {
    const backup = JSON.stringify({ schemaVersion: SCHEMA_VERSION, assets: [], cashAccounts: [] });
    const result = await importState(backup);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("decrypts and imports encrypted backup end-to-end", async () => {
    const data = { schemaVersion: SCHEMA_VERSION, assets: [], cashAccounts: [] };
    const envelope = await encryptData(data, "my-secret");
    const result = await importState(JSON.stringify(envelope), "my-secret");
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("throws on encrypted backup with wrong password", async () => {
    const data = { schemaVersion: SCHEMA_VERSION, assets: [] };
    const envelope = await encryptData(data, "correct");
    await expect(importState(JSON.stringify(envelope), "wrong")).rejects.toThrow("Wrong password");
  });
});
