---
title: "Flexible Import — Research & QA"
type: research
date: 2026-03-03
status: planned
---

# Flexible Import — Research & QA

## Overview

The custom CSV import flow (Phase 8) uses heuristic column detection and a manual mapping fallback.
Before treating it as reliable, we need to understand the full range of real-world export formats,
identify where the heuristics break down, and establish a QA strategy that covers the long tail
of permutations without requiring a dedicated fixture file for every brokerage.

This phase is primarily **research and hardening** — no new user-visible features unless the
research reveals a clear gap worth filling.

## Background

Phase 8 shipped:
- `src/lib/parsers/custom.js` — `detectColumnMappings` (regex heuristics) + `applyColumnMapping`
- `CustomColumnMapper` component in `Import.jsx` — manual override UI shown when auto-detection
  produces an incomplete mapping
- `ParsedPreview` component — shows first 5 rows with mapped columns highlighted

The open question from Phase 8: *"there can be so many permutations"* — we don't yet know how
well the heuristics perform against real brokerage exports outside the ones we've already parsed.

## Research Questions

### 1. What formats exist in the wild?

Audit common brokerage CSV exports for column naming conventions:

- **Schwab** — Portfolio positions, transaction history
- **Vanguard** — Holdings export, transaction history
- **E*Trade / Morgan Stanley** — Positions download
- **TD Ameritrade / Schwab (legacy)** — Positions CSV
- **Robinhood** — Account statement CSV
- **Interactive Brokers** — Activity statements (complex multi-section format)
- **Coinbase** — Transaction history CSV
- **Webull** — Positions / order history

For each: identify header names for symbol, quantity, cost basis, acquisition date, and price.
Map them to `COLUMN_HEURISTICS` patterns and note gaps.

### 2. Where do the current heuristics fail?

Run `detectColumnMappings` against collected headers and identify:
- Headers that should match but don't (false negatives)
- Headers that match the wrong field (false positives)
- Fields that are frequently absent (e.g., acquisition date missing from most position exports)
- Multi-word or hyphenated variants not covered (e.g., "Avg. Cost Basis", "Mkt Value")

### 3. What does the manual mapping UX need?

The `CustomColumnMapper` UI was built without user testing. Research:
- Is the column-assignment dropdown discoverable without instruction?
- What happens when a user uploads a CSV with 20+ columns — is the mapper overwhelming?
- Should unmapped required fields (symbol, quantity) be visually flagged as errors vs. warnings?
- Is a 5-row preview sufficient, or do users need to scroll to spot data quality issues?

### 4. How should ambiguous mappings be handled?

Current behavior: first matching header wins, silently. Edge cases to resolve:
- Two columns both match `symbol` (e.g., "Symbol" and "Ticker" both present) — warn user?
- Cost basis column present but all values are `--` or `N/A` (Robinhood, some Coinbase exports)
- Quantity column has mixed units (shares vs. fractional shares vs. face value for bonds)
- Date column present but format is non-ISO (e.g., `Jan 15, 2024`, `15/01/2024`)

### 5. What is the right testing strategy?

Options to evaluate:

**A. Fixture-per-brokerage** — collect one sanitized export per brokerage, commit to
`data/fixtures/custom/`, test with `describe.skipIf`. Simple but requires ongoing maintenance
as brokerages change their export formats.

**B. Synthetic header corpus** — build a table of `{ broker, field, headerVariant }` tuples,
test `detectColumnMappings` against all of them in a single parameterized test. Fast, CI-safe,
but doesn't test full parse pipeline.

**C. Snapshot testing** — run each fixture through the full pipeline, snapshot the output.
Catches regressions but snapshots can drift.

**Recommendation (to be confirmed by research):** B for heuristic unit tests + A for integration
smoke tests with `describe.skipIf` guards (following the Phase 8 pattern).

## Tasks

- [ ] Collect header names from 6–8 major brokerages (public docs, community samples, own exports)
- [ ] Map collected headers against current `COLUMN_HEURISTICS`; document gaps
- [ ] Identify the 3–5 highest-impact heuristic additions (cover the most users)
- [ ] Document edge cases for cost basis and date parsing (missing values, non-ISO dates, dashes)
- [ ] Manual QA: upload a re-ordered CSV through the import UI; verify auto-detection and
  manual override flow end-to-end
- [ ] Manual QA: upload a CSV where auto-detection partially fails; verify mapper prompts
  correctly and skipped rows warning surfaces
- [ ] Evaluate testing strategy (A/B/C above); write recommendation
- [ ] Propose heuristic improvements as concrete regex additions to `COLUMN_HEURISTICS`
- [ ] Propose any UX changes to `CustomColumnMapper` (if research reveals gaps)

## Out of Scope

- Parsing IRS 1099-B forms (PDF/complex table format — separate effort)
- Interactive Brokers activity statements (multi-section non-standard CSV — needs own parser)
- Automatic format detection without user confirmation (trust but verify — always show preview)
- Server-side parsing (app is client-only SPA)

## Success Criteria

- `detectColumnMappings` correctly identifies symbol + quantity for ≥6 of 8 audited brokerages
  without any manual override
- All heuristic additions are covered by parameterized unit tests in `custom.test.js`
- Manual QA checklist completed and documented
- Any discovered UX gaps have corresponding issues or are folded into Phase 9 (if documentation
  phase is still open) or a follow-up task
