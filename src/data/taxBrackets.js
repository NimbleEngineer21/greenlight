// Federal tax brackets by year and filing status
//
// 2025 brackets: IRS Rev. Proc. 2024-40
//   https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025
// 2026 brackets: projected with ~2.8% inflation adjustment per CPI trends
// LTCG brackets: IRS Topic 409 / Schedule D
//   https://www.irs.gov/taxtopics/tc409
// NIIT: IRC §1411 — 3.8% on net investment income above AGI threshold
//   https://www.irs.gov/individuals/net-investment-income-tax

export const FEDERAL_BRACKETS = {
  2025: {
    single: {
      standardDeduction: 15700,
      brackets: [
        { floor: 0, ceiling: 11925, rate: 0.10 },
        { floor: 11925, ceiling: 48475, rate: 0.12 },
        { floor: 48475, ceiling: 103350, rate: 0.22 },
        { floor: 103350, ceiling: 197300, rate: 0.24 },
        { floor: 197300, ceiling: 250525, rate: 0.32 },
        { floor: 250525, ceiling: 626350, rate: 0.35 },
        { floor: 626350, ceiling: Infinity, rate: 0.37 },
      ],
      ltcgBrackets: [
        { floor: 0, ceiling: 48350, rate: 0 },
        { floor: 48350, ceiling: 533400, rate: 0.15 },
        { floor: 533400, ceiling: Infinity, rate: 0.20 },
      ],
      niitThreshold: 200000,
    },
    mfj: {
      standardDeduction: 31400,
      brackets: [
        { floor: 0, ceiling: 23850, rate: 0.10 },
        { floor: 23850, ceiling: 96950, rate: 0.12 },
        { floor: 96950, ceiling: 206700, rate: 0.22 },
        { floor: 206700, ceiling: 394600, rate: 0.24 },
        { floor: 394600, ceiling: 501050, rate: 0.32 },
        { floor: 501050, ceiling: 751600, rate: 0.35 },
        { floor: 751600, ceiling: Infinity, rate: 0.37 },
      ],
      ltcgBrackets: [
        { floor: 0, ceiling: 96700, rate: 0 },
        { floor: 96700, ceiling: 600050, rate: 0.15 },
        { floor: 600050, ceiling: Infinity, rate: 0.20 },
      ],
      niitThreshold: 250000,
    },
    mfs: {
      standardDeduction: 15700,
      brackets: [
        { floor: 0, ceiling: 11925, rate: 0.10 },
        { floor: 11925, ceiling: 48475, rate: 0.12 },
        { floor: 48475, ceiling: 103350, rate: 0.22 },
        { floor: 103350, ceiling: 197300, rate: 0.24 },
        { floor: 197300, ceiling: 250525, rate: 0.32 },
        { floor: 250525, ceiling: 375800, rate: 0.35 },
        { floor: 375800, ceiling: Infinity, rate: 0.37 },
      ],
      ltcgBrackets: [
        { floor: 0, ceiling: 48350, rate: 0 },
        { floor: 48350, ceiling: 300025, rate: 0.15 },
        { floor: 300025, ceiling: Infinity, rate: 0.20 },
      ],
      niitThreshold: 125000,
    },
    hoh: {
      standardDeduction: 23500,
      brackets: [
        { floor: 0, ceiling: 17000, rate: 0.10 },
        { floor: 17000, ceiling: 64850, rate: 0.12 },
        { floor: 64850, ceiling: 103350, rate: 0.22 },
        { floor: 103350, ceiling: 197300, rate: 0.24 },
        { floor: 197300, ceiling: 250500, rate: 0.32 },
        { floor: 250500, ceiling: 626350, rate: 0.35 },
        { floor: 626350, ceiling: Infinity, rate: 0.37 },
      ],
      ltcgBrackets: [
        { floor: 0, ceiling: 64750, rate: 0 },
        { floor: 64750, ceiling: 566700, rate: 0.15 },
        { floor: 566700, ceiling: Infinity, rate: 0.20 },
      ],
      niitThreshold: 200000,
    },
  },
  2026: {
    single: {
      standardDeduction: 16150,
      brackets: [
        { floor: 0, ceiling: 12250, rate: 0.10 },
        { floor: 12250, ceiling: 49825, rate: 0.12 },
        { floor: 49825, ceiling: 106250, rate: 0.22 },
        { floor: 106250, ceiling: 202850, rate: 0.24 },
        { floor: 202850, ceiling: 257550, rate: 0.32 },
        { floor: 257550, ceiling: 643900, rate: 0.35 },
        { floor: 643900, ceiling: Infinity, rate: 0.37 },
      ],
      ltcgBrackets: [
        { floor: 0, ceiling: 49700, rate: 0 },
        { floor: 49700, ceiling: 548350, rate: 0.15 },
        { floor: 548350, ceiling: Infinity, rate: 0.20 },
      ],
      niitThreshold: 200000,
    },
    mfj: {
      standardDeduction: 32300,
      brackets: [
        { floor: 0, ceiling: 24500, rate: 0.10 },
        { floor: 24500, ceiling: 99700, rate: 0.12 },
        { floor: 99700, ceiling: 212500, rate: 0.22 },
        { floor: 212500, ceiling: 405700, rate: 0.24 },
        { floor: 405700, ceiling: 515100, rate: 0.32 },
        { floor: 515100, ceiling: 772750, rate: 0.35 },
        { floor: 772750, ceiling: Infinity, rate: 0.37 },
      ],
      ltcgBrackets: [
        { floor: 0, ceiling: 99400, rate: 0 },
        { floor: 99400, ceiling: 616850, rate: 0.15 },
        { floor: 616850, ceiling: Infinity, rate: 0.20 },
      ],
      niitThreshold: 250000,
    },
    mfs: {
      standardDeduction: 16150,
      brackets: [
        { floor: 0, ceiling: 12250, rate: 0.10 },
        { floor: 12250, ceiling: 49825, rate: 0.12 },
        { floor: 49825, ceiling: 106250, rate: 0.22 },
        { floor: 106250, ceiling: 202850, rate: 0.24 },
        { floor: 202850, ceiling: 257550, rate: 0.32 },
        { floor: 257550, ceiling: 386375, rate: 0.35 },
        { floor: 386375, ceiling: Infinity, rate: 0.37 },
      ],
      ltcgBrackets: [
        { floor: 0, ceiling: 49700, rate: 0 },
        { floor: 49700, ceiling: 308425, rate: 0.15 },
        { floor: 308425, ceiling: Infinity, rate: 0.20 },
      ],
      niitThreshold: 125000,
    },
    hoh: {
      standardDeduction: 24150,
      brackets: [
        { floor: 0, ceiling: 17475, rate: 0.10 },
        { floor: 17475, ceiling: 66700, rate: 0.12 },
        { floor: 66700, ceiling: 106250, rate: 0.22 },
        { floor: 106250, ceiling: 202850, rate: 0.24 },
        { floor: 202850, ceiling: 257550, rate: 0.32 },
        { floor: 257550, ceiling: 643900, rate: 0.35 },
        { floor: 643900, ceiling: Infinity, rate: 0.37 },
      ],
      ltcgBrackets: [
        { floor: 0, ceiling: 66550, rate: 0 },
        { floor: 66550, ceiling: 582600, rate: 0.15 },
        { floor: 582600, ceiling: Infinity, rate: 0.20 },
      ],
      niitThreshold: 200000,
    },
  },
};

// NIIT rate is constant at 3.8%
export const NIIT_RATE = 0.038;

// Get bracket config for a given year and filing status, with fallback
export function getBrackets(year, filingStatus) {
  const yearData = FEDERAL_BRACKETS[year] || FEDERAL_BRACKETS[2026];
  return yearData[filingStatus] || yearData.mfj;
}
