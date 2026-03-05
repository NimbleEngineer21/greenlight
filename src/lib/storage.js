import { createDefaultState, SCHEMA_VERSION } from "../data/defaults.js";
import { exportIndexedDB, importIndexedDB } from "./db.js";
import { encryptData, decryptData } from "./crypto.js";

const STORAGE_KEY = "greenlight";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return migrateState(parsed);
  } catch (err) {
    console.error("[GreenLight] Failed to load state:", err);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem("greenlight_backup", raw);
    } catch { /* best-effort backup */ }
    return createDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return createDefaultState();
}

export async function exportState(state, password) {
  if (!state) state = loadState();
  const backup = { ...state };
  try {
    const idbData = await exportIndexedDB();
    if (idbData) backup._indexedDB = idbData;
  } catch (err) {
    console.warn("[GreenLight] Could not include IndexedDB data in backup:", err.message);
  }
  const date = new Date().toISOString().slice(0, 10);
  let blob, filename;
  if (password) {
    const envelope = await encryptData(backup, password);
    blob = new Blob([JSON.stringify(envelope)], { type: "application/json" });
    filename = `greenlight-backup-${date}.greenlight`;
  } else {
    blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    filename = `greenlight-backup-${date}.json`;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importState(jsonString, password) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("This file is not valid JSON. Make sure you selected a GreenLight backup file (.json or .greenlight).");
  }
  let backup;
  if (parsed.format === "greenlight-encrypted-v1") {
    if (!password) throw new Error("This file is encrypted. A password is required to import it.");
    backup = await decryptData(parsed, password);
  } else {
    backup = parsed;
  }
  validateImport(backup);
  const idbData = backup._indexedDB;
  delete backup._indexedDB;
  const migrated = migrateState(backup);
  // Restore IndexedDB first — if it fails, localStorage is untouched
  if (idbData) {
    try {
      await importIndexedDB(idbData);
    } catch (err) {
      console.warn("[GreenLight] IndexedDB import failed, continuing with localStorage only:", err.message);
    }
  }
  saveState(migrated);
  return migrated;
}

/**
 * Validate imported JSON has the expected shape before migrating.
 * Throws descriptive errors for common problems.
 */
export function validateImport(obj) {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Import must be a JSON object, not " + (Array.isArray(obj) ? "an array" : typeof obj));
  }

  // Must have a schema version (any GreenLight export has one)
  if (obj.schemaVersion == null) {
    throw new Error("This doesn't look like a GreenLight backup (no schemaVersion found)");
  }

  // Schema version sanity check
  if (typeof obj.schemaVersion !== "number" || obj.schemaVersion < 1) {
    throw new Error(`Invalid schemaVersion: ${obj.schemaVersion}`);
  }
  if (obj.schemaVersion > SCHEMA_VERSION + 5) {
    throw new Error(`This backup is from a newer version (v${obj.schemaVersion}). Update GreenLight first.`);
  }

  // Validate array fields are actually arrays
  const arrayFields = ["assets", "cashAccounts", "lenders", "capitalSales"];
  for (const field of arrayFields) {
    if (obj[field] != null && !Array.isArray(obj[field])) {
      throw new Error(`"${field}" must be an array, got ${typeof obj[field]}`);
    }
  }

  // Validate assets have required fields
  if (Array.isArray(obj.assets)) {
    for (let i = 0; i < obj.assets.length; i++) {
      const a = obj.assets[i];
      if (typeof a !== "object" || a == null) {
        throw new Error(`assets[${i}] is not an object`);
      }
      if (!a.name && !a.symbol) {
        throw new Error(`assets[${i}] missing both name and symbol`);
      }
      if (a.quantity != null && typeof a.quantity !== "number") {
        throw new Error(`assets[${i}] quantity must be a number`);
      }
    }
  }

  // Validate retirement accounts if present
  const ret = obj.retirement;
  if (ret != null && typeof ret === "object") {
    if (ret.accounts != null && !Array.isArray(ret.accounts)) {
      throw new Error(`retirement.accounts must be an array`);
    }
  }
}

export function migrateState(state) {
  // Unrecognizable or empty state — reset to avoid partial state bugs
  if (state.schemaVersion == null && !Array.isArray(state.assets) && !Array.isArray(state.cashAccounts)) {
    return createDefaultState();
  }

  // Already current — return as-is (preserves object reference)
  if (state.schemaVersion === SCHEMA_VERSION) return state;

  // Future version — return as-is with warning
  if (state.schemaVersion > SCHEMA_VERSION) {
    console.warn(`[GreenLight] State has future schema v${state.schemaVersion} (current: ${SCHEMA_VERSION}). Returning as-is.`);
    return state;
  }

  let data = { ...state };

  // v1 → v2: add carMaintenanceAnnual to purchase
  if ((data.schemaVersion ?? 0) < 2) {
    if (data.purchase && data.purchase.carMaintenanceAnnual === undefined) {
      data.purchase = { ...data.purchase, carMaintenanceAnnual: null };
    }
    data.schemaVersion = 2;
  }

  // v2 → v3: normalize platform fee fields (all three always present)
  if (data.schemaVersion < 3) {
    if (data.platforms) {
      const migrated = {};
      for (const [key, plat] of Object.entries(data.platforms)) {
        migrated[key] = {
          name: plat.name,
          feePerShare: plat.feePerShare ?? 0,
          flatFee: plat.flatFee ?? 0,
          feePercent: plat.feePercent ?? 0,
        };
      }
      data.platforms = migrated;
    }
    data.schemaVersion = 3;
  }

  // v3 → v4: platform fees default empty (existing users keep theirs)
  if (data.schemaVersion < 4) {
    if (!data.platforms) data.platforms = {};
    data.schemaVersion = 4;
  }

  // v4 → v5: add spouse paycheck fields
  if (data.schemaVersion < 5) {
    if (data.cashFlow) {
      data.cashFlow = {
        ...data.cashFlow,
        spousePaycheckAmount: data.cashFlow.spousePaycheckAmount ?? 0,
        spousePaycheckFrequency: data.cashFlow.spousePaycheckFrequency ?? "biweekly",
        spouseFirstPayDate: data.cashFlow.spouseFirstPayDate ?? "",
      };
    }
    data.schemaVersion = 5;
  }

  // v5 → v6: add liquidationPercent to assets and retirement accounts
  if (data.schemaVersion < 6) {
    if (Array.isArray(data.assets)) {
      data.assets = data.assets.map(a => ({
        ...a,
        liquidationPercent: a.liquidationPercent ?? 100,
      }));
    }
    if (data.retirement?.accounts && Array.isArray(data.retirement.accounts)) {
      data.retirement = {
        ...data.retirement,
        accounts: data.retirement.accounts.map(a => ({
          ...a,
          liquidationPercent: a.liquidationPercent ?? 100,
        })),
      };
    }
    data.schemaVersion = 6;
  }

  return data;
}
