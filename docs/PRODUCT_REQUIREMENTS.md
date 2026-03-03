# GreenLight — Product Requirements Document

## Vision

A financial planning tool that starts with what you already know and adds complexity only when
you ask for it. The goal is to answer one question: **"When does all the math turn green?"** —
when do your assets, income, and obligations align to make a major purchase or life decision
financially viable?

## UX Philosophy

**Progressive disclosure across 4 layers:**

1. **Dashboard** — net position at a glance, no configuration required
2. **Cash flow** — add income and expenses to see month-by-month runway
3. **Tax-aware** — configure tax situation to get accurate after-tax numbers
4. **Purchase-ready** — model a specific purchase with full cost breakdown and readiness timeline

Users can stop at any layer. A user who just wants to track asset values doesn't need to configure
tax brackets. A user planning a home purchase can go all the way to lender comparison.

## User Personas

**Alex — Individual Investor**
- Holds stocks across ComputerShare and crypto across Gemini
- Wants to know the current value of their whole portfolio in one place
- Cares about tax implications of selling — short-term vs. long-term gains
- Doesn't trust online finance apps with their data

**Sam — Home Buyer**
- Actively saving for a down payment
- Needs to understand the true total cost of buying (not just the list price)
- Wants to compare mortgage lenders and understand the PMI break-even timeline
- Is deciding which assets to liquidate and in what order

**Jordan — Privacy-First User**
- Skeptical of cloud-connected financial tools
- Wants to self-host or run locally
- Values transparency: source-available code they can read and audit

## Feature Inventory

### Implemented

| Feature | Description | Location |
| --- | --- | --- |
| Asset tracking | Track stocks, crypto, warrants, cash positions | Assets page |
| Live prices | Auto-fetch from Yahoo Finance, Gemini, CoinGecko | All pages |
| Price overrides | Manual price entry for any asset | Dashboard |
| Cash accounts | Track bank/savings account balances | Cash Accounts page |
| Retirement accounts | Track 401(k)/IRA balances by source type | — (imported via Transamerica) |
| Progressive tax engine | Federal + all 50 states, LTCG stacking, NIIT | Tax section |
| Flat tax mode | Manual rate override for quick estimates | Tax section |
| Cash flow projections | Paycheck, recurring expenses, one-time obligations | Projections page |
| Home purchase planner | Full cost breakdown: down payment, closing, PMI | Purchase Planning |
| Vehicle purchase planner | Down payment, dealer fees, financing | Purchase Planning |
| Mortgage calculator | Amortization, monthly payment, PMI timeline | Loans page |
| Points buy-down | Opportunity-cost-adjusted break-even analysis | Loans page |
| Lender comparison | Side-by-side APR and total cost comparison | Lender Compare page |
| Conforming loan limits | FHFA limits by ZIP code → county | Loans page |
| Readiness projection | Month-by-month savings trajectory to purchase date | Readiness page |
| ComputerShare import | Parse CSV transaction files, per-lot cost basis | Import page |
| Gemini import | Parse XLSX transaction history, FIFO cost basis | Import page |
| Fidelity import | Parse portfolio positions CSV | Import page |
| Transamerica import | Parse fund-holdings + source-balance CSVs | Import page |
| Custom CSV import | Heuristic column detection + manual mapping | Import page |
| Encrypted backup | AES-256-GCM export with password | Settings page |
| Plain JSON backup | Transparent unencrypted export | Settings page |
| Import/restore | Restore from backup file (encrypted or plain) | Settings page |
| Setup wizard | First-run onboarding flow | Auto-shown on first visit |
| Seed example data | Populate with realistic demo data | Settings page |
| Provider detection | Dev-mode: detect and offer to import local data files | Banner (dev only) |
| SEO / llms.txt | Meta tags, sitemap, robots.txt, llms.txt | Static files |

### Planned

| Feature | Description | Phase |
| --- | --- | --- |
| Flexible import QA | Audit brokerage CSV formats, harden heuristics | Phase 10 |
| Additional brokerages | Schwab, Vanguard, E*Trade, Robinhood | Future |
| Lot-level detail | Individual purchase lot tracking and FIFO/LIFO selection | Future |
| Price history charts | Visual chart of asset value over time | Future |

## Non-Functional Requirements

### Performance

- Initial page load: < 2s on a modern connection (no server-side rendering needed)
- Price fetch: completes within 5s for all sources; gracefully degrades on partial failure
- localStorage read/write: synchronous, < 50ms for typical state sizes
- All calculations: synchronous, complete in < 100ms for up to 1,000 assets

### Privacy

- Zero telemetry — no analytics, no error tracking, no usage data sent anywhere
- All data stored client-side (localStorage + IndexedDB) — never transmitted
- External API calls limited to price data (no user data included in requests)
- Encrypted backup uses AES-256-GCM with PBKDF2 key derivation (100,000 iterations)

### Browser Support

- Target: Chrome 120+, Firefox 120+, Safari 17+, Edge 120+
- Requires: `localStorage`, `IndexedDB`, `crypto.subtle`, `fetch`, ES2022 modules
- No IE11 support

### Accessibility

- Keyboard navigable layout
- Sufficient color contrast ratios (dark theme)
- No reliance on color alone for meaning (green/red values always paired with +/- sign)

### Reliability

- Works fully offline once loaded (price fetches fail gracefully)
- State is never lost: all writes go to localStorage immediately
- Encrypted backup is the primary data safety mechanism (users should export regularly)
- Schema migration protects existing data when the app is updated

## Data Model Summary

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full annotated state schema.

**Top-level state keys:**

| Key | Type | Purpose |
| --- | --- | --- |
| `schemaVersion` | number | Migration version guard |
| `setupComplete` | boolean | Setup wizard completed |
| `assets` | Asset[] | Investment assets |
| `cashAccounts` | CashAccount[] | Bank/savings balances |
| `retirement` | RetirementConfig | 401(k)/IRA account data |
| `taxConfig` | TaxConfig | Filing status, state, rates |
| `platforms` | PlatformMap | Per-platform fee configuration |
| `cashFlow` | CashFlowConfig | Paycheck + expenses |
| `priceOverrides` | Record<string, number> | Manual price overrides |
| `sellDate` | string | Target sale date for tax classification |
| `purchase` | PurchaseConfig | Home or vehicle purchase plan |
| `mortgage` | MortgageConfig | Loan terms for purchase |
| `autoLoan` | AutoLoanConfig | Auto loan terms |
| `lenders` | Lender[] | Mortgage lender comparison entries |
| `readiness` | ReadinessConfig | Projection growth rates |
| `capitalSales` | CapitalSale[] | Manual capital gain entries |
| `dateOfBirth` | { month, year } | For early withdrawal penalty |
