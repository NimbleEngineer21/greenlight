# GreenLight — Project Brief

## What It Is

GreenLight is a free, privacy-first financial planning tool that runs entirely in your browser.
It tracks investments, projects cash flow, models major purchases, and tells you exactly when
all the math turns green — when you have enough to buy the house, the car, or retire early.

No account. No backend. No data leaves your device.

## Who It's For

- **Individual investors** managing their own stock and crypto portfolios across multiple platforms
- **Home buyers** planning a purchase and trying to understand the true cost — down payment,
  closing costs, PMI, and break-even on rate buy-downs
- **Privacy-conscious users** who don't trust financial apps with their data and would rather
  run the math themselves on their own machine

## Core Philosophy

**Privacy first.** All data lives in your browser's localStorage and IndexedDB. The only
network calls are to fetch live prices (Yahoo Finance, Gemini, CoinGecko) — all proxied through
the same origin, no third-party trackers.

**Progressive disclosure.** The app starts with what you already know (assets, income, expenses)
and adds complexity only when you ask for it. You don't have to configure 50 fields to get a
useful answer.

**Accurate math.** The tax engine uses real progressive bracket math for all 50 states + DC,
not flat-rate approximations. The mortgage calculator includes opportunity cost, PMI timelines,
and points buy-down break-even. The numbers are ones you could show a financial advisor.

**Import from real exports.** GreenLight parses actual CSV and XLSX exports from ComputerShare,
Gemini, Fidelity, and Transamerica — so your data comes from the source of truth, not manual entry.

## What Makes It Different

| Feature | GreenLight | Typical finance apps |
| --- | --- | --- |
| Account required | No | Yes |
| Data leaves your device | Never | Always |
| Self-hostable | Yes (Docker) | Rarely |
| Source-available | Yes | Rarely |
| Real tax math | 50 states, progressive | Flat rate estimates |
| Import from brokerage | CSV/XLSX, direct | Plaid/OAuth only |
| Encrypted backup | AES-256-GCM | Proprietary |

## Current Status

**Production-ready for personal use.** The app has been used to track a real multi-platform
portfolio through multiple phases of development. All core features are complete:

- Asset tracking with live prices
- Full tax engine (federal + all states)
- Purchase planning (home + vehicle)
- Mortgage tools (amortization, lender comparison, PMI)
- Readiness projections
- Import from 4 brokerages + custom CSV
- Encrypted backup/restore
