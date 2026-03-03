---
title: "Import System: Silent Failures and Untestable Logic"
date: 2026-03-03
problem_type:
  - silent-failure
  - test-failure
  - logic-error
severity: high
component: import
tags:
  - error-handling
  - testing
  - import-feature
  - papaparse
  - test-fixtures
  - csv-parsing
related_files:
  - src/lib/parsers/transamerica.js
  - src/lib/parsers/custom.js
  - src/data/providers.js
  - src/pages/Import.jsx
  - src/lib/__tests__/parsers/computershare.test.js
  - src/lib/__tests__/parsers/gemini.test.js
  - src/lib/__tests__/parsers/transamerica.test.js
  - src/lib/__tests__/parsers/custom.test.js
---

## Problem

During Phase 8 (parser verification + flexible import), a PR review discovered seven categories of
silent failure across the new Transamerica parser, the custom CSV flow, and the import confirmation
handler. Tests also failed CI because they depended on gitignored local data files. Core parsing
logic was embedded inside `Import.jsx` — a React component — making it impossible to unit test.

## Symptoms

- Import appeared to succeed (toast shown) even when `updateState` threw an exception
- Unknown Transamerica account types were silently mapped to `pretax_401k` instead of warning
- PapaParse errors in both Transamerica sub-parsers and the custom CSV flow were silently discarded
- `confirmImport` showed a success toast even when only fund-holdings (nothing saveable) were uploaded
- `handleFiles` catch block swallowed the error message: `setError("Failed to parse the file")`
- All real-data tests failed in CI because `data/user_*` is gitignored
- `detectColumnMappings` and `applyColumnMapping` lived in `Import.jsx` — no unit tests possible

## Root Cause

Several independent issues compounded each other:

1. **Optimistic fallback in `normalizeSourceType`** — function returned `"pretax_401k"` as a
   catch-all instead of `null`, so unrecognized account types were silently mislabeled.

2. **PapaParse errors never checked** — both `parseTransamericaFundHoldings` and
   `parseTransamericaSourceBalance` called `Papa.parse()` but never read `result.errors`. The
   custom CSV flow had the same issue.

3. **`confirmImport` had no try-catch** — `updateState` is a React state setter that can throw;
   any failure silently left state half-updated while showing a success toast.

4. **"Nothing to save" guard was missing** — Transamerica fund-holdings alone produce no saveable
   state; uploading only that file showed a false-success toast.

5. **Hardcoded platform string** — retirement dedup used `"Transamerica"` literally instead of
   `parsed.platform`, making the check brittle for future providers.

6. **Test files required local data** — every test used `readFileSync` on `data/user_*` paths
   that are gitignored, so all tests were effectively skipped in CI.

7. **Parsing logic embedded in a component** — `detectColumnMappings` and `applyColumnMapping`
   lived in `Import.jsx`, making them untestable without mounting the component.

## Fix A — `normalizeSourceType` returns `null` on no match

**Before:**
```js
function normalizeSourceType(name) {
  const lower = (name || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(SOURCE_TYPE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "pretax_401k";  // ← silent fallback; wrong for unknown types
}
```

**After:**
```js
function normalizeSourceType(name) {
  const lower = (name || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(SOURCE_TYPE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;  // ← caller warns and uses "unknown"
}

// In parseTransamericaSourceBalance:
const accountType = normalizeSourceType(sourceName);
if (accountType === null) {
  warnings.push(
    `Unrecognized source type "${sourceName}" — imported as "unknown". ` +
    `Verify the account type manually before using retirement projections.`,
  );
}
accounts.push({ accountType: accountType ?? "unknown", ... });
```

## Fix B — Sub-parsers return `{ data, warnings }` and check PapaParse errors

**Before:**
```js
export function parseTransamericaFundHoldings(csvText) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  // result.errors never checked
  const holdings = [];
  for (const row of result.data) { ... }
  return holdings;  // plain array
}
```

**After:**
```js
export function parseTransamericaFundHoldings(csvText) {
  if (typeof csvText !== "string") {
    throw new TypeError("Transamerica fund-holdings parser received no file content.");
  }
  const text = csvText.replace(/^\uFEFF/, "");
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });

  const warnings = result.errors
    .filter(e => e.type !== "FieldMismatch")   // FieldMismatch is benign in Transamerica CSVs
    .map(e => `fund-holdings CSV warning at row ${e.row}: ${e.message}`);

  const holdings = [];
  for (const row of result.data) { ... }
  return { holdings, warnings };  // ← structured return
}
```

The same pattern applies to `parseTransamericaSourceBalance` → `{ accounts, warnings }`.
`parseTransamericaCSV` aggregates warnings from both sub-parsers with `warnings.push(...r.warnings)`.

## Fix C — `confirmImport` wrapped in try-catch with fundHoldings-only guard

**Before:**
```js
const confirmImport = useCallback(() => {
  if (!parsed) return;
  updateState(prev => { ... });
  setParsed(null);
  setToast(true);  // always fires, even on exception
}, [parsed, updateState]);
```

**After:**
```js
const confirmImport = useCallback(() => {
  if (!parsed) return;
  const hasRetirement = parsed.retirementAccounts?.length > 0;
  const hasAssets = parsed.assets?.length > 0;
  const hasCash = parsed.cashPositions?.length > 0;
  if (!hasRetirement && !hasAssets && !hasCash) {
    setError("Nothing to import — upload source-balance.csv to import Transamerica account data.");
    return;
  }
  try {
    updateState(prev => { ... });
    setParsed(null);
    setToast(true);
  } catch (e) {
    console.error("[GreenLight] confirmImport failed:", e);
    setError(`Import failed while saving data. Your existing data has not been changed. Error: ${e.message}`);
  }
}, [parsed, updateState]);
```

## Fix D — `parsed.platform` instead of hardcoded `"Transamerica"`

**Before:**
```js
const withoutOld = (prev.retirement?.accounts || []).filter(
  a => a.platform !== "Transamerica",
);
```

**After:**
```js
const withoutOld = (prev.retirement?.accounts || []).filter(
  a => a.platform !== parsed.platform,
);
```

## Fix E — `handleFiles` catch propagates `e.message`

**Before:**
```js
} catch (e) {
  setError("Failed to parse the file. Check the format and try again.");
}
```

**After:**
```js
} catch (e) {
  const hint = PROVIDERS[platform]?.hint ?? "";
  setError(`Failed to parse the file. ${hint} Error: ${e.message}`);
}
```

## Fix F — Extracted parsing logic to `src/lib/parsers/custom.js`

`detectColumnMappings` and `applyColumnMapping` were extracted from `Import.jsx` into a pure
module with no React dependency. `applyColumnMapping` was updated to return `{ assets, droppedRows }`
so callers can surface the count:

```js
// src/lib/parsers/custom.js
export function applyColumnMapping(rows, mapping) {
  const assets = [];
  let droppedRows = 0;
  for (const row of rows) {
    const symbol = (row[mapping.symbol] || "").trim();
    if (!symbol) { droppedRows++; continue; }
    const quantity = Number.parseFloat(...) || 0;
    if (quantity <= 0) { droppedRows++; continue; }
    assets.push({ ... });
  }
  return { assets, droppedRows };
}

// Import.jsx consumer:
const { assets, droppedRows } = applyCustomMapping(rows, customMapping);
if (droppedRows > 0) {
  setWarning(`${droppedRows} row(s) skipped — missing symbol or zero quantity.`);
}
```

## Fix G — CI-safe test architecture

**Before (breaks CI):**
```js
const csv = readFileSync("data/user_az/computershare/AZ__Transactions.csv", "utf8");
const lots = parseComputerShareCSV(csv);
expect(lots.length).toBeGreaterThan(0);  // always skipped in CI — file not committed
```

**After (two-tier approach):**
```js
// Tier 1: Inline fixtures — ALWAYS run
const MINIMAL_CSV = `"Transactions"\n"Summary"\n...`;

describe("parseComputerShareCSV — inline fixtures", () => {
  it("parses a minimal CLASS A COMMON CSV", () => {
    const lots = parseComputerShareCSV(MINIMAL_CSV, "test.csv");
    expect(lots.length).toBe(2);
  });
});

// Tier 2: Real data — skip gracefully if not present
const DATA_DIR = join(process.cwd(), "data/user_az/computershare");
const dataExists = existsSync(DATA_DIR);

describe.skipIf(!dataExists)("parseComputerShareCSV — real data files", () => {
  it("parses all 4 CSVs", () => { ... });
});
```

For binary formats (Gemini XLSX), build synthetic fixtures in memory:
```js
function buildGeminiXLSX(rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "transaction_history");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
```

## Prevention Checklists

### New Parser Checklist

- [ ] Check `typeof input !== "string"` and throw `TypeError` — never silently return `[]`
- [ ] Strip BOM: `text.replace(/^\uFEFF/, "")`
- [ ] After `Papa.parse()`, filter `result.errors` for non-`FieldMismatch` errors and surface them as warnings
- [ ] Return `{ data, warnings }`, not a plain array — callers must be able to see parse warnings
- [ ] Any "normalize/map" function that can fail must return `null` on no-match, never a silent default
- [ ] Write inline fixture tests with hardcoded CSV strings (no file I/O) — these must pass in CI

### Import Flow UI Checklist

- [ ] `confirmImport` (or any save handler) must be wrapped in try-catch; show the error to the user on failure — never show a success toast when an exception is thrown
- [ ] Check what is actually saveable before confirming — guard against "nothing to save" states
- [ ] Use `parsed.platform` (or equivalent dynamic value) for dedup, never a hardcoded string
- [ ] All catch blocks must include `e.message` in the user-visible error
- [ ] Any logic that can be unit-tested independently must live outside the component (in `src/lib/`)

## Cross-references

- [`src/lib/parsers/transamerica.js`](../../src/lib/parsers/transamerica.js) — fixed parser
- [`src/lib/parsers/custom.js`](../../src/lib/parsers/custom.js) — extracted column-detection logic
- [`src/data/providers.js`](../../src/data/providers.js) — single source of truth for provider metadata
- [`src/pages/Import.jsx`](../../src/pages/Import.jsx) — fixed confirmation flow
- [`src/lib/__tests__/parsers/`](../../src/lib/__tests__/parsers/) — inline fixture test suite
- Related pattern: `loadState()` catch in `src/lib/storage.js` (pre-existing, no logging — future cleanup)
