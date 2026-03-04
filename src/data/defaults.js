// Polyfill for browsers that lack crypto.randomUUID (e.g. DuckDuckGo on older Android)
export const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? () => crypto.randomUUID()
  : () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (+c ^ (Math.random() * 16 >> (+c / 4))).toString(16));

// Yahoo Finance ticker mappings for stocks/ETFs (proxied via /api/yahoo)
export const YAHOO_TICKERS = {
  gme: "GME",
  wgme: "GME-WT",
};

// Gemini public API ticker mappings
// Pricefeed returns pairs as uppercase (e.g., "BTCUSD")
export const GEMINI_TICKERS = {
  btc: "BTCUSD", eth: "ETHUSD", aave: "AAVEUSD", uni: "UNIUSD",
  yfi: "YFIUSD", pepe: "PEPEUSD", fet: "FETUSD", zrx: "ZRXUSD",
  sushi: "SUSHIUSD", api3: "API3USD", snx: "SNXUSD",
  doge: "DOGEUSD", link: "LINKUSD", grt: "GRTUSD", dot: "DOTUSD",
  storj: "STORJUSD", ankr: "ANKRUSD", crv: "CRVUSD",
};

// CoinGecko IDs for non-Gemini crypto (public API, no key required; rate-limited ~30 req/min)
export const COINGECKO_TICKERS = {
  pol: "polygon-ecosystem-token",
};

export const DEFAULT_PLATFORMS = {
  cs: { name: "ComputerShare", feePerShare: 0.10, flatFee: 10, feePercent: 0 },
  gem: { name: "Gemini", feePerShare: 0, flatFee: 0, feePercent: 0.015 },
  pp: { name: "Paypal", feePerShare: 0, flatFee: 0, feePercent: 0.02 },
  fidelity: { name: "Fidelity", feePerShare: 0, flatFee: 0, feePercent: 0 },
};

export const DEFAULT_TAX_CONFIG = {
  taxMode: "progressive",  // "progressive" (bracket-based) or "flat" (manual rates)
  taxYear: 2025,
  filingStatus: "single",
  yourW2: 0,
  spouseW2: 0,
  combinedW2: 0,
  state: "",
  // Flat-mode overrides (used when taxMode === "flat")
  ltcgRate: 0.15,
  stcgRate: 0.24,
  niitRate: 0.038,
  niitApplies: true,
  standardDeduction: 15700,
};

// Retirement account types and their tax treatment on early withdrawal
export const RETIREMENT_ACCOUNT_TYPES = {
  pretax_401k: "Pre-Tax 401(k)",
  roth_401k: "Roth 401(k)",
  trad_ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  safe_harbor: "Safe Harbor Match",
  unknown: "Don't Know (Conservative)",
};

export const DEFAULT_RETIREMENT = {
  enabled: true,
  penaltyRate: 0.10,
  taxRate: 0.24,
  stateTaxRate: 0,
  accounts: [],
};

export const DEFAULT_CASH_FLOW = {
  paycheckAmount: 5395.63,
  paycheckFrequency: "biweekly",
  firstPayDate: "2026-03-06",
  expenses: [
    { id: uuid(), name: "Mortgage", amount: 1679, frequency: "monthly", dayOfMonth: 1, startDate: "2026-04-01" },
  ],
  oneTimeObligations: [
    { id: uuid(), name: "2025 Federal Tax Bill", amount: 3600, dueDate: "2026-04-15", isPaid: false },
  ],
};

export const DEFAULT_PURCHASE = {
  category: null,          // "home" | "vehicle" (replaces top-level planningMode)
  description: "",         // What are you buying?
  targetPurchaseDate: "",  // When to close on the purchase (independent of sellDate)
  takingLoan: true,        // Will you finance this purchase?
  loanType: "mortgage",    // "mortgage" | "auto" (auto-set from category)
  homePrice: 350000,
  downPaymentPercent: 20,
  zipCode: "",
  closingCostOverrides: {},
  closingCostPaid: {},
  carPrice: 35000,
  carDownPayment: 5000,
  carCostOverrides: {},
  carCostPaid: {},
  carMaintenanceAnnual: null,  // null = derived (carPrice × 1.5%), number = user override
};

export const DEFAULT_MORTGAGE = {
  termYears: 30,
  ratePercent: 6.5,
  propertyTax: 3500,
  homeInsurance: 1800,
  hoaDues: 0,
  pmiRate: 0.5,
  pointsBought: 0,
  pointCostPercent: 1,
  pointRateReduction: 0.25,
  expectedStayYears: 10,
  opportunityCostRate: 7,
  jumboSpreadPercent: 0.25,
};

export const DEFAULT_AUTO_LOAN = {
  ratePercent: 6.5,
  termMonths: 60,
  tradeInValue: 0,
};

export const DEFAULT_READINESS = {
  reserveMonths: 6,
  incomeGrowthRate: 0,
  assetAppreciationRate: 0,
};

export const SCHEMA_VERSION = 1;

export function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    setupComplete: false,
    assets: [],
    cashAccounts: [],
    retirement: { ...DEFAULT_RETIREMENT },
    taxConfig: { ...DEFAULT_TAX_CONFIG },
    platforms: { ...DEFAULT_PLATFORMS },
    cashFlow: {
      ...DEFAULT_CASH_FLOW,
      expenses: DEFAULT_CASH_FLOW.expenses.map(e => ({ ...e, id: uuid() })),
      oneTimeObligations: DEFAULT_CASH_FLOW.oneTimeObligations.map(o => ({ ...o, id: uuid() })),
    },
    priceOverrides: {},
    sellDate: new Date().toISOString().slice(0, 10),
    lastExportDate: null,
    purchase: { ...DEFAULT_PURCHASE },
    mortgage: { ...DEFAULT_MORTGAGE },
    autoLoan: { ...DEFAULT_AUTO_LOAN },
    lenders: [],
    readiness: { ...DEFAULT_READINESS },
    capitalSales: [],
    dateOfBirth: { month: "", year: "" },
  };
}

// Example data for "Seed with example data" feature
export function createSeededState() {
  const state = createDefaultState();
  state.setupComplete = true;
  state.assets = [
    { id: uuid(), platform: "ComputerShare", name: "GME", symbol: "GME", quantity: 520, costBasis: 22185.58, acquisitionDate: "2021-01-27", priceKey: "gme", feeType: "cs", holdingType: "stock", notes: "184 lots from CSV", importSource: "computershare-csv" },
    { id: uuid(), platform: "ComputerShare", name: "WGME", symbol: "WGME", quantity: 52, costBasis: 2218.56, acquisitionDate: "2021-01-27", priceKey: "wgme", feeType: "cs", holdingType: "warrant", notes: "92 warrant lots from CSV", importSource: "computershare-csv" },
    { id: uuid(), platform: "Paypal", name: "Bitcoin", symbol: "BTC", quantity: 0.01442898, costBasis: 1550.00, acquisitionDate: "2025-11-01", priceKey: "btc", feeType: "pp", holdingType: "crypto" },
    { id: uuid(), platform: "Paypal", name: "Ethereum", symbol: "ETH", quantity: 0.85939078, costBasis: 3200.00, acquisitionDate: "2025-11-01", priceKey: "eth", feeType: "pp", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "USD Cash", symbol: "USD", quantity: 117.91, costBasis: 117.91, acquisitionDate: null, priceKey: null, feeType: "none", holdingType: "cash" },
    { id: uuid(), platform: "Gemini", name: "Ethereum", symbol: "ETH", quantity: 1.224585, costBasis: 732.40, acquisitionDate: "2021-06-01", priceKey: "eth", feeType: "gem", holdingType: "crypto", notes: "incl 0.156 ETH CC rewards @$0" },
    { id: uuid(), platform: "Gemini", name: "Bitcoin", symbol: "BTC", quantity: 0.02945881, costBasis: 579.18, acquisitionDate: "2019-06-01", priceKey: "btc", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "AAVE", symbol: "AAVE", quantity: 2.21707385, costBasis: 507.54, acquisitionDate: "2021-02-01", priceKey: "aave", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "UNI", symbol: "UNI", quantity: 29.979945, costBasis: 472.77, acquisitionDate: "2021-02-01", priceKey: "uni", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "YFI", symbol: "YFI", quantity: 0.021464, costBasis: 415.81, acquisitionDate: "2021-03-01", priceKey: "yfi", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "PEPE", symbol: "PEPE", quantity: 25331145.77, costBasis: 276.61, acquisitionDate: "2024-05-10", priceKey: "pepe", feeType: "gem", holdingType: "crypto", notes: "incl 2.4M CC rewards @$0" },
    { id: uuid(), platform: "Gemini", name: "FET", symbol: "FET", quantity: 951.227077, costBasis: 252.49, acquisitionDate: "2023-01-01", priceKey: "fet", feeType: "gem", holdingType: "crypto", notes: "incl 123.5 CC rewards @$0" },
    { id: uuid(), platform: "Gemini", name: "ZRX", symbol: "ZRX", quantity: 307.52384, costBasis: 140.02, acquisitionDate: "2021-06-01", priceKey: "zrx", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "SUSHI (LT)", symbol: "SUSHI", quantity: 136.1767, costBasis: 87.27, acquisitionDate: "2023-07-22", priceKey: "sushi", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "SUSHI (ST)", symbol: "SUSHI", quantity: 33.3952, costBasis: 20.82, acquisitionDate: "2025-07-04", priceKey: "sushi", feeType: "gem", holdingType: "crypto", notes: "Becomes LT after 7/4/2026" },
    { id: uuid(), platform: "Gemini", name: "POL", symbol: "POL", quantity: 116.298733, costBasis: 86.17, acquisitionDate: "2021-11-01", priceKey: "pol", feeType: "gem", holdingType: "crypto", notes: "Migrated from MATIC" },
    { id: uuid(), platform: "Gemini", name: "API3", symbol: "API3", quantity: 59.85606, costBasis: 79.01, acquisitionDate: "2022-09-01", priceKey: "api3", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "SNX", symbol: "SNX", quantity: 24.375748, costBasis: 57.01, acquisitionDate: "2021-06-01", priceKey: "snx", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "DOGE", symbol: "DOGE", quantity: 150.0, costBasis: 56.53, acquisitionDate: "2021-06-01", priceKey: "doge", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "LINK", symbol: "LINK", quantity: 2.0, costBasis: 51.57, acquisitionDate: "2021-06-01", priceKey: "link", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "GRT", symbol: "GRT", quantity: 275.625, costBasis: 44.10, acquisitionDate: "2021-06-01", priceKey: "grt", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "DOT", symbol: "DOT", quantity: 7.838241, costBasis: 43.01, acquisitionDate: "2021-06-01", priceKey: "dot", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "STORJ", symbol: "STORJ", quantity: 80.0, costBasis: 43.69, acquisitionDate: "2021-06-01", priceKey: "storj", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "ANKR", symbol: "ANKR", quantity: 533.359652, costBasis: 13.51, acquisitionDate: "2021-06-01", priceKey: "ankr", feeType: "gem", holdingType: "crypto" },
    { id: uuid(), platform: "Gemini", name: "CRV", symbol: "CRV", quantity: 64.214225, costBasis: 0, acquisitionDate: "2024-06-01", priceKey: "crv", feeType: "gem", holdingType: "crypto", notes: "100% CC rewards, $0 basis" },
  ];
  state.cashAccounts = [
    { id: uuid(), platform: "NGFCU", name: "Checking", balance: 1166 },
    { id: uuid(), platform: "NGFCU", name: "Savings", balance: 2706 },
    { id: uuid(), platform: "UFB Direct", name: "Savings 1", balance: 4712.72 },
    { id: uuid(), platform: "UFB Direct", name: "Savings 2", balance: 5829.38 },
  ];
  state.retirement = {
    enabled: true,
    penaltyRate: 0.10,
    taxRate: 0.24,
    stateTaxRate: 0,
    accounts: [
      { id: uuid(), accountType: "pretax_401k", platform: "Empower", balance: 35007.80, contributions: 0 },
      { id: uuid(), accountType: "roth_401k", platform: "Empower", balance: 20007.81, contributions: 15000 },
      { id: uuid(), accountType: "safe_harbor", platform: "Empower", balance: 15000, contributions: 0 },
    ],
  };
  state.priceOverrides = { gme: 24.03, wgme: 4.30 };
  return state;
}
