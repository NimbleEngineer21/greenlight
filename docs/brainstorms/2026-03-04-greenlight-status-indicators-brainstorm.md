---
title: GreenLight Status Indicators & Dashboard Visual Refresh
topic: purchase-readiness-colors
date: 2026-03-04
---

# GreenLight Status Indicators & Dashboard Visual Refresh

## What We're Building

A dynamic color system that makes the GreenLight dashboard feel alive. The top summary card shifts color and shows a status badge based on purchase readiness. When no purchase is planned, a savings rate indicator gives ongoing feedback. A progress bar tracks how close the user is to their green threshold. The name "GreenLight" becomes literal — users actively work toward getting the card to glow green.

## Why This Approach

The app already does the hard math (readiness projections, liquidation analysis, surplus/shortfall). The gap is surfacing that analysis viscerally on first glance. Currently it's buried in the Purchase Planning page. Bringing it to the top card makes the whole app feel cohesive — every number on the dashboard connects to the big question: "Am I ready?"

## Key Decisions

### 1. Summary Card Treatment
**Both** card background/border shift color AND a labeled status badge appears.
- Card: subtle glow + tinted border (e.g. `rgba(34, 197, 94, 0.12)` bg + `colors.green` border at 40% opacity)
- Badge: pill label like `READY`, `CLOSE`, `SAVING`, `SHORTFALL -$14k`
- No purchase: shows savings rate badge (e.g. `SAVING 23%`) colored by rate tier

### 2. No-Purchase State
Savings rate indicator: `(income − expenses − obligations) / income × 100`
- ≥ 20% → green (`SAVING 23%`)
- 10–19% → amber (`SAVING 14%`)
- < 10% → red (`SAVING 4%`) or dim if no income data

### 3. Home Purchase Thresholds

| Status | Condition |
|--------|-----------|
| 🟢 GREEN | `available ≥ cashNeeded + max(homePrice × 10%, reserveMonths × monthlyExpenses)` |
| 🟡 YELLOW | `available ≥ cashNeeded` (covers down payment + closing costs, no buffer) |
| 🔴 RED | `available < cashNeeded` |

- `cashNeeded` = down payment + closing costs (already computed by `calcTotalCashNeeded`)
- `reserveMonths` = existing setting (default 6)
- `monthlyExpenses` = existing `expTotal + obTotal` from cash flow

### 4. Vehicle Purchase Thresholds

| Status | Condition |
|--------|-----------|
| 🟢 GREEN | `available ≥ carCashNeeded + annualMaintenance` |
| 🟡 YELLOW | `available ≥ carCashNeeded` (can buy, no maintenance buffer) |
| 🔴 RED | `available < carCashNeeded` |

- `annualMaintenance` = `carPrice × 0.015` by default, user-adjustable field on purchase form
- Yellow also triggers if post-purchase monthly cash flow (including new car payment) would go negative

### 5. Progress Bar
- Lives directly below (or inside) the summary card
- Shows `currentAvailable / greenThreshold × 100` as a fill bar
- Color matches current status tier
- Label: `"$312k of $385k needed for GREEN"` or `"68% to goal"`
- Only shown when a purchase is planned

### 6. Status Badge Labels

| State | Badge Text | Color |
|-------|-----------|-------|
| No purchase, saving rate ≥ 20% | `SAVING 23%` | green |
| No purchase, saving rate 10-19% | `SAVING 14%` | amber |
| No purchase, saving rate < 10% | `SAVING 4%` | red |
| Purchase, fully green | `READY` | green |
| Purchase, yellow | `ALMOST` | amber |
| Purchase, red + shortfall | `SHORTFALL -$14k` | red |
| Purchase, red + reachable | `~8 MOS AWAY` | amber (uses existing readiness date) |

## Math Verification Notes

The existing `calcLiquidationAnalysis` already handles:
- `totalAvailable` = cash + net asset proceeds + retirement (w/ penalties) + projected cash flow contribution
- `surplus` / `shortfall` relative to `cashNeeded.total`

New additions needed:
- `emergencyBuffer` = `max(homePrice × 0.10, reserveMonths × monthlyExpenses)` → new output from planner
- `greenThreshold` = `cashNeeded.total + emergencyBuffer` → drives progress bar denominator
- `purchaseReadinessStatus` = `"green" | "yellow" | "red"` → pure function, testable
- For vehicles: add `annualMaintenance` field to `DEFAULT_PURCHASE`, derive from `carPrice × 0.015`

## New Fields Required

In `DEFAULT_PURCHASE` (schema bump):
```js
carMaintenanceAnnual: null,  // null = use derived (carPrice * 0.015), number = override
```

## Scope

**In scope:**
- Summary card color + badge (dashboard)
- Progress bar toward green threshold
- Savings rate badge for no-purchase state
- New `purchaseReadinessStatus` pure function with tests
- Vehicle maintenance field + derived default
- Math verification: ensure all three tiers produce correct results with real data

**Out of scope (future):**
- Monthly net worth snapshots / sparklines
- Milestone celebrations
- What-if scenario panel

## Resolved Questions

1. **Multiple purchases**: worst-case drives the dashboard card color (most critical purchase)
2. **Badge text**: `~N MOS AWAY` if reachable within 24 months via projections, otherwise `SHORTFALL -$Xk`
3. **Progress bar timeline**: yes, show the projected readiness date when available
