# GreenLight — Architecture

## Stack

| Layer | Technology | Version |
| --- | --- | --- |
| UI framework | React | 19 |
| Build tool | Vite | 8 |
| Router | React Router | 7 |
| CSV parsing | PapaParse | 5 |
| XLSX parsing | SheetJS (xlsx) | 0.18 |
| IndexedDB ORM | Dexie | 4 |
| Language | JavaScript (no TypeScript) | ES2022+ |
| Test runner | Vitest | 4 |
| Linter | ESLint | 9 (flat config) |
| Production server | nginx (via Docker) | alpine |

## Project Layout

```
src/
  App.jsx                  # Root component, routing, top-level hooks
  App.css                  # Minimal global resets
  theme.js                 # Design tokens: colors, fonts, shared styles
  main.jsx                 # React root mount
  components/              # Reusable UI components
    Layout.jsx             # Shell: sidebar nav, date pickers, price status
  pages/                   # Route-level page components
    Dashboard.jsx          # Net position, cash flow, asset breakdown
    Assets.jsx             # Asset list management
    Import.jsx             # Brokerage import, custom CSV
    CashAccounts.jsx       # Cash account management
    Projections.jsx        # Income/expense cash flow
    PurchasePlanning.jsx   # Home + vehicle purchase cost
    LoansCalc.jsx          # Amortization, PMI, points buy-down
    LenderCompare.jsx      # Multi-lender comparison
    Readiness.jsx          # Financial readiness projections
    Settings.jsx           # Tax config, backup/restore
    SetupWizard.jsx        # First-run onboarding
  hooks/
    useStorage.js          # localStorage state management
    usePrices.js           # Live price fetching + IndexedDB caching
    useZipLookup.js        # ZIP code → county for conforming loan limits
  lib/                     # Pure calculation layer (no side effects)
    calculations.js        # Net position, asset value, lot aggregation
    taxEngine.js           # Progressive tax math, LTCG stacking, NIIT
    mortgageCalc.js        # Amortization, PMI, points break-even
    purchasePlanner.js     # Purchase cost breakdown, liquidation analysis
    readiness.js           # Readiness projection math
    loanLimits.js          # FHFA conforming limit lookup
    storage.js             # localStorage load/save/export/import
    crypto.js              # AES-256-GCM encrypt/decrypt
    db.js                  # Dexie IndexedDB schema + helpers
    fred.js                # FRED API client (mortgage rates)
    zipLookup.js           # ZIP → county data
    parsers/               # Brokerage CSV/XLSX parsers
      computershare.js
      gemini.js
      fidelity.js
      transamerica.js
      custom.js            # Heuristic column detection for unknown CSVs
  data/
    defaults.js            # Default state, schema version, seeded example
    providers.js           # Provider registry for Import page
    conformingLimits.js    # Generated FHFA data (do not edit directly)
  __tests__/               # Vitest test files
    parsers/               # Parser unit tests
```

## Data Flow

```
User input / file upload
        ↓
  useStorage() hook          ← loads/saves localStorage["greenlight"]
        ↓
  React state (state object) → calculation functions (pure)
        ↓                              ↓
  usePrices() hook            taxEngine, mortgageCalc, purchasePlanner,
  (live price fetch)          calculations, readiness
        ↓                              ↓
  IndexedDB price cache       Derived values passed as props
        ↓
  Components render results
```

## Storage Layers

### localStorage (`"greenlight"`)

All app state is stored as a single JSON blob under the key `"greenlight"`. Loaded on startup by
`useStorage()` in `src/hooks/useStorage.js`, persisted on every state update via `saveState()`.

**State schema (v1):**

```js
{
  schemaVersion: 1,
  setupComplete: boolean,

  // Investment assets (stocks, crypto, warrants)
  assets: [{
    id: string,             // crypto.randomUUID()
    platform: string,       // "ComputerShare", "Gemini", etc.
    name: string,
    symbol: string,
    quantity: number,
    costBasis: number,      // total cost basis in USD
    acquisitionDate: string | null,  // ISO date "YYYY-MM-DD"
    priceKey: string | null,         // key into prices object
    feeType: string,        // "cs" | "gem" | "pp" | "none"
    holdingType: string,    // "stock" | "crypto" | "warrant" | "cash"
    notes: string,
    importSource: string,
  }],

  // Cash and savings accounts
  cashAccounts: [{
    id: string,
    platform: string,       // bank/institution name
    name: string,           // account name
    balance: number,
  }],

  // Retirement accounts (401k, IRA)
  retirement: {
    enabled: boolean,
    penaltyRate: number,    // early withdrawal penalty (default 0.10)
    taxRate: number,        // marginal rate for withdrawal (default 0.24)
    stateTaxRate: number,
    accounts: [{
      id: string,
      accountType: string,  // "pretax_401k" | "roth_401k" | "trad_ira" | "roth_ira" | "safe_harbor" | "unknown"
      platform: string,
      balance: number,
      contributions: number,
      notes: string,
    }],
  },

  // Tax configuration
  taxConfig: {
    taxMode: "progressive" | "flat",
    taxYear: number,
    filingStatus: "single" | "mfj" | "mfs" | "hoh",
    yourW2: number,
    spouseW2: number,
    combinedW2: number,
    state: string,          // two-letter state code, e.g. "CA"
    // Flat-mode overrides:
    ltcgRate: number,
    stcgRate: number,
    niitRate: number,
    niitApplies: boolean,
    standardDeduction: number,
  },

  // Platform fee config
  platforms: {
    [key: string]: { name: string, feePerShare?: number, flatFee?: number, feePercent?: number }
  },

  // Cash flow: income and recurring expenses
  cashFlow: {
    paycheckAmount: number,
    paycheckFrequency: "biweekly" | "semimonthly" | "monthly" | "weekly",
    firstPayDate: string,   // ISO date
    expenses: [{
      id: string,
      name: string,
      amount: number,
      frequency: string,
      dayOfMonth: number,
      startDate: string,
    }],
    oneTimeObligations: [{
      id: string,
      name: string,
      amount: number,
      dueDate: string,
      isPaid: boolean,
    }],
  },

  // Manual price overrides (symbol key → price)
  priceOverrides: { [priceKey: string]: number },

  // Target sell date for LTCG/STCG classification
  sellDate: string,         // ISO date

  // Purchase planning
  purchase: {
    category: "home" | "vehicle" | null,
    description: string,
    targetPurchaseDate: string,
    takingLoan: boolean,
    loanType: "mortgage" | "auto",
    homePrice: number,
    downPaymentPercent: number,
    zipCode: string,
    closingCostOverrides: object,
    closingCostPaid: object,
    carPrice: number,
    carDownPayment: number,
  },

  // Mortgage configuration
  mortgage: {
    termYears: number,
    ratePercent: number,
    propertyTax: number,
    homeInsurance: number,
    hoaDues: number,
    pmiRate: number,
    pointsBought: number,
    pointCostPercent: number,
    pointRateReduction: number,
    expectedStayYears: number,
    opportunityCostRate: number,
    jumboSpreadPercent: number,
  },

  // Auto loan configuration
  autoLoan: {
    ratePercent: number,
    termMonths: number,
    tradeInValue: number,
  },

  // Mortgage lender comparison entries
  lenders: [{ id, name, ratePercent, points, fees, ... }],

  // Readiness projection settings
  readiness: {
    reserveMonths: number,
    incomeGrowthRate: number,
    assetAppreciationRate: number,
  },

  // Manual capital sales for tax estimation
  capitalSales: [{ id, symbol, proceeds, costBasis, date, holdingPeriod }],

  // User date of birth (for early withdrawal penalty calculation)
  dateOfBirth: { month: string, year: string },

  lastExportDate: string | null,
}
```

### IndexedDB (via Dexie)

Used for larger datasets that don't belong in the 5MB localStorage limit:

- **`priceSnapshots`** — daily price history for all tracked assets, keyed by date + priceKey.
  Purged after 90 days. Used to show historical price charts and for cost basis validation.
- **`mortgageRates`** — cached FRED mortgage rate series (30yr and 15yr weekly data).

The full IndexedDB contents are included in encrypted/plain backup exports and restored on import.

## Calculation Layer

All financial math lives in `src/lib/` as **pure functions** — no DOM access, no fetch calls,
no side effects. This makes them independently testable.

| Module | What it computes |
| --- | --- |
| `calculations.js` | Net position, asset values, lot aggregation, platform totals |
| `taxEngine.js` | Progressive federal + state tax, LTCG stacking, NIIT, filing status |
| `mortgageCalc.js` | Monthly payment, amortization, PMI, points break-even, opportunity cost |
| `purchasePlanner.js` | Purchase cost breakdown, closing costs, liquidation sequence |
| `readiness.js` | Month-by-month readiness projection with income growth and asset appreciation |
| `loanLimits.js` | FHFA conforming loan limit lookup by state + county |

## Price Fetching

`usePrices()` in `src/hooks/usePrices.js` fetches prices on mount and every 15 minutes:

1. **Crypto** — Gemini public pricefeed (`https://api.gemini.com/v1/pricefeed`) — batch, no key
2. **Additional crypto** — CoinGecko simple price API — no key, rate-limited
3. **Stocks** — Yahoo Finance (via `/api/yahoo` proxy) — no key required
4. **Stock fallback** — Finnhub (via `/api/finnhub` proxy) — currently unauthenticated

Fetched prices are cached to IndexedDB via `cachePriceSnapshots()` and merged with manual
`priceOverrides` from state (overrides always win).

## API Proxies

All external API calls are routed through same-origin proxies to avoid CORS issues and keep
API keys off the client.

**Development** (`vite.config.js`):
```
/api/yahoo/*     → https://query1.finance.yahoo.com/*
/api/coingecko/* → https://api.coingecko.com/*
/api/finnhub/*   → https://finnhub.io/*
/api/fred/*      → https://api.stlouisfed.org/*
```

**Production** (nginx in Dockerfile): same routes configured as `proxy_pass` directives.

## Design System

All design tokens live in `src/theme.js` — the "Mission Control" dark theme:

- Colors: `colors.bg`, `colors.surface`, `colors.text`, `colors.accent`, `colors.green`, etc.
- Typography: `fonts.mono` (primary UI font), `fonts.sans`
- Shared styles: `card`, `button`, `input`, `label` style objects

Components import from `theme.js`, not from CSS files. Inline styles only — no CSS modules,
no Tailwind, no CSS-in-JS library.

## Parser Contract

Each brokerage parser module exports one or more named functions following this pattern:

```js
// Simple parsers (assets/lots)
export function parseXxxCSV(csvText, filename) {
  // Returns: array of lot/asset objects
  // Throws: TypeError if csvText is not a string
}

// Complex parsers (multiple output types)
export function parseXxxCSV(files) {
  // files: [{ name: string, text: string }]
  // Returns: { retirementAccounts, fundHoldings, warnings }
}
```

Sub-parsers that use PapaParse return `{ data, warnings }` so callers can surface parse errors.
PapaParse `FieldMismatch` errors are filtered out (expected for Transamerica's wide-format CSVs).

## Build & Deploy

**Development:**
```bash
npm run dev    # Vite HMR server on :5173
```

**Production:**
```bash
npm run build  # Vite → dist/
# or
docker build -t greenlight .
docker run -p 8080:80 greenlight
```

The Docker build is a two-stage build: Node 20 Alpine builds the static files, then nginx Alpine
serves them with the API proxy routes pre-configured. No server-side runtime in production.

## Schema Migration

`src/lib/storage.js` `migrateState()` is called on every load. Currently resets to defaults on
version mismatch (simple but safe). Adding new state fields requires:

1. Add field with default value to `createDefaultState()` in `src/data/defaults.js`
2. Bump `SCHEMA_VERSION`
3. Add migration logic in `migrateState()` to carry forward data from the previous version
