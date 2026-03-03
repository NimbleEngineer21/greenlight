# GreenLight

> Know exactly when all the math turns green.

Free, privacy-first financial planning tool that runs entirely in your browser.
No account. No backend. No data leaves your device.

<!-- screenshot: add a screenshot or demo GIF here -->

## What It Does

- Track your complete financial picture: stocks, crypto, cash, and retirement accounts
- Accurate tax estimates using progressive federal brackets for all 50 states + DC
- Plan major purchases (home or vehicle) with detailed cost breakdowns
- Compare mortgage lenders with opportunity-cost-adjusted break-even analysis
- Project when you'll be financially ready for a purchase
- Import directly from ComputerShare, Gemini, Fidelity, and Transamerica

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+

### Run Locally

```bash
git clone https://github.com/NimbleEngineer21/greenlight.git
cd greenlight
npm install
npm run dev
# Open http://localhost:5173
```

### Docker

```bash
docker build -t greenlight .
docker run -p 8080:80 greenlight
# Open http://localhost:8080
```

## Privacy First

GreenLight stores **all** data in your browser — nothing is ever sent to a server:

| Storage               | What's stored                                          |
| --------------------- | ------------------------------------------------------ |
| `localStorage`        | App state: assets, tax config, purchase plan, settings |
| IndexedDB (via Dexie) | Price history cache, time-series data                  |

- No account required
- No analytics, no tracking, no cookies
- No backend server — the app is a static site with API proxies for live price feeds
- For maximum privacy, clone this repo and run it locally

## Supported Import Providers

| Provider      | Format                              | What's imported                              |
| ------------- | ----------------------------------- | -------------------------------------------- |
| ComputerShare | CSV (transaction history)           | Stock lots with per-lot cost basis and dates |
| Gemini        | XLSX (transaction history)          | Crypto positions with FIFO cost basis        |
| Fidelity      | CSV (portfolio positions)           | Brokerage holdings with cost basis           |
| Transamerica  | CSV (fund-holdings + source-balance)| 401(k) accounts by source type               |
| Any CSV       | Custom column mapping               | Heuristic detection + manual override        |

## Features

### Dashboard

- Net position summary with live prices
- Cash flow trajectory
- Asset breakdown by platform and type

### Tax Engine

- Progressive federal brackets (2025–2026)
- All 50 states + DC
- Long-term capital gains with LTCG stacking method
- Net Investment Income Tax (NIIT) auto-calculation
- 4 filing statuses: Single, MFJ, MFS, HOH
- Flat-rate override mode for quick estimates

### Purchase Planning

- Home purchase: down payment, closing costs, PMI analysis, property tax
- Vehicle purchase: down payment, dealer fees, financing
- Liquidation analysis: which assets to sell to fund the purchase
- Readiness projections: when will you have enough?

### Mortgage Tools

- Full amortization schedule
- Points buy-down with opportunity cost break-even
- PMI calculation and removal timeline
- Multi-lender comparison (APR, total cost, break-even)
- Conforming vs. jumbo loan detection (FHFA limits by county)

### Import & Data Management

- One-click import from supported brokerages
- Encrypted backup/restore (AES-256-GCM, password-protected)
- Plain JSON backup for transparency
- "Seed with example data" for exploration

## External Price Feeds

GreenLight fetches live prices automatically — no API keys required for basic use:

| Source        | What it provides                         | Key required?                                |
| ------------- | ---------------------------------------- | -------------------------------------------- |
| Gemini        | Crypto prices (BTC, ETH, and ~18 others) | No                                           |
| CoinGecko     | Additional crypto (POL/MATIC)            | No                                           |
| Yahoo Finance | Stock prices (proxied)                   | No                                           |
| Finnhub       | Stock price fallback                     | No (optional, improves fallback reliability) |
| FRED          | Live mortgage rates                      | No (optional; app works without it)          |

Prices refresh every 15 minutes and are cached in IndexedDB for 90 days.

## Development

```bash
npm run dev          # Dev server with HMR (localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm run lint         # ESLint
npm test             # Vitest — run all tests once
npm run test:watch   # Vitest — watch mode
npm run build:limits # Regenerate FHFA conforming loan limit data
```

### Using Your Own Financial Data (Local Dev)

Place your export files in `data/user_[initials]/[provider]/`:

```
data/
  user_jd/
    computershare/
      Transactions-2024.csv
    gemini/
      transaction_history.xlsx
    fidelity/
      Portfolio_Positions_Mar-01-2026.csv
    transamerica/
      fund-holdings.csv
      source-balance.csv
```

When running `npm run dev`, GreenLight will detect these files on startup and offer to import them.

### Adding a New Provider Parser

1. Create `src/lib/parsers/yourprovider.js` — export a `parseYourProviderCSV(text, filename)` function
2. Add the provider to `src/data/providers.js`
3. Handle the new platform in `src/pages/Import.jsx`
4. Add inline fixture tests in `src/lib/__tests__/parsers/yourprovider.test.js`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full parser contract.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details including the state schema,
data flow, and calculation layer design.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache License 2.0 with Commons Clause. Free for personal use; commercial resale is not permitted.
See [LICENSE](LICENSE) for full terms.

## Disclaimer

GreenLight provides tax estimates and financial projections for personal planning purposes only.
The tax engine approximates your liability using published federal and state brackets and standard
deductions — it does not account for all deductions, credits, AMT exposure, or other individual
circumstances that a CPA would consider.

This tool is not a substitute for professional tax or legal advice. Always verify numbers with a
qualified accountant or financial advisor before making significant financial decisions.
