// State income tax rules for all 50 states + DC
//
// Sources:
//   Tax Foundation — State Individual Income Tax Rates and Brackets, 2026
//   https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/
//   data/tax/2026-State-Income-Tax-Rates-and-Brackets.csv
//
// Categories: "none" (no income tax), "flat" (single rate), "progressive" (bracketed)
// Progressive brackets include single filer (brackets) and MFJ (mfjBrackets) where they differ.

export const STATE_TAXES = {
  AL: { name: "Alabama", type: "progressive", brackets: [
    { floor: 0, ceiling: 500, rate: 0.02 },
    { floor: 500, ceiling: 3000, rate: 0.04 },
    { floor: 3000, ceiling: Infinity, rate: 0.05 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 1000, rate: 0.02 },
    { floor: 1000, ceiling: 6000, rate: 0.04 },
    { floor: 6000, ceiling: Infinity, rate: 0.05 },
  ]},
  AK: { name: "Alaska", type: "none" },
  AZ: { name: "Arizona", type: "flat", rate: 0.025 },
  AR: { name: "Arkansas", type: "progressive", brackets: [
    { floor: 0, ceiling: 4600, rate: 0.02 },
    { floor: 4600, ceiling: Infinity, rate: 0.039 },
  ]},
  CA: { name: "California", type: "progressive", brackets: [
    { floor: 0, ceiling: 11079, rate: 0.01 },
    { floor: 11079, ceiling: 26264, rate: 0.02 },
    { floor: 26264, ceiling: 41452, rate: 0.04 },
    { floor: 41452, ceiling: 57542, rate: 0.06 },
    { floor: 57542, ceiling: 72724, rate: 0.08 },
    { floor: 72724, ceiling: 371479, rate: 0.093 },
    { floor: 371479, ceiling: 445771, rate: 0.103 },
    { floor: 445771, ceiling: 742953, rate: 0.113 },
    { floor: 742953, ceiling: 1000000, rate: 0.123 },
    { floor: 1000000, ceiling: Infinity, rate: 0.133 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 22158, rate: 0.01 },
    { floor: 22158, ceiling: 52528, rate: 0.02 },
    { floor: 52528, ceiling: 82904, rate: 0.04 },
    { floor: 82904, ceiling: 115084, rate: 0.06 },
    { floor: 115084, ceiling: 145448, rate: 0.08 },
    { floor: 145448, ceiling: 742958, rate: 0.093 },
    { floor: 742958, ceiling: 891542, rate: 0.103 },
    { floor: 891542, ceiling: 1000000, rate: 0.113 },
    { floor: 1000000, ceiling: 1485906, rate: 0.123 },
    { floor: 1485906, ceiling: Infinity, rate: 0.133 },
  ]},
  CO: { name: "Colorado", type: "flat", rate: 0.044 },
  CT: { name: "Connecticut", type: "progressive", brackets: [
    { floor: 0, ceiling: 10000, rate: 0.02 },
    { floor: 10000, ceiling: 50000, rate: 0.045 },
    { floor: 50000, ceiling: 100000, rate: 0.055 },
    { floor: 100000, ceiling: 200000, rate: 0.06 },
    { floor: 200000, ceiling: 250000, rate: 0.065 },
    { floor: 250000, ceiling: 500000, rate: 0.069 },
    { floor: 500000, ceiling: Infinity, rate: 0.0699 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 20000, rate: 0.02 },
    { floor: 20000, ceiling: 100000, rate: 0.045 },
    { floor: 100000, ceiling: 200000, rate: 0.055 },
    { floor: 200000, ceiling: 400000, rate: 0.06 },
    { floor: 400000, ceiling: 500000, rate: 0.065 },
    { floor: 500000, ceiling: 1000000, rate: 0.069 },
    { floor: 1000000, ceiling: Infinity, rate: 0.0699 },
  ]},
  DE: { name: "Delaware", type: "progressive", brackets: [
    { floor: 0, ceiling: 2000, rate: 0.0 },
    { floor: 2000, ceiling: 5000, rate: 0.022 },
    { floor: 5000, ceiling: 10000, rate: 0.039 },
    { floor: 10000, ceiling: 20000, rate: 0.048 },
    { floor: 20000, ceiling: 25000, rate: 0.052 },
    { floor: 25000, ceiling: 60000, rate: 0.0555 },
    { floor: 60000, ceiling: Infinity, rate: 0.066 },
  ]},
  FL: { name: "Florida", type: "none" },
  GA: { name: "Georgia", type: "flat", rate: 0.0519 },
  HI: { name: "Hawaii", type: "progressive", brackets: [
    { floor: 0, ceiling: 9600, rate: 0.014 },
    { floor: 9600, ceiling: 14400, rate: 0.032 },
    { floor: 14400, ceiling: 19200, rate: 0.055 },
    { floor: 19200, ceiling: 24000, rate: 0.064 },
    { floor: 24000, ceiling: 36000, rate: 0.068 },
    { floor: 36000, ceiling: 48000, rate: 0.072 },
    { floor: 48000, ceiling: 125000, rate: 0.076 },
    { floor: 125000, ceiling: 175000, rate: 0.079 },
    { floor: 175000, ceiling: 225000, rate: 0.0825 },
    { floor: 225000, ceiling: 275000, rate: 0.09 },
    { floor: 275000, ceiling: 325000, rate: 0.10 },
    { floor: 325000, ceiling: Infinity, rate: 0.11 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 19200, rate: 0.014 },
    { floor: 19200, ceiling: 28800, rate: 0.032 },
    { floor: 28800, ceiling: 38400, rate: 0.055 },
    { floor: 38400, ceiling: 48000, rate: 0.064 },
    { floor: 48000, ceiling: 72000, rate: 0.068 },
    { floor: 72000, ceiling: 96000, rate: 0.072 },
    { floor: 96000, ceiling: 250000, rate: 0.076 },
    { floor: 250000, ceiling: 350000, rate: 0.079 },
    { floor: 350000, ceiling: 450000, rate: 0.0825 },
    { floor: 450000, ceiling: 550000, rate: 0.09 },
    { floor: 550000, ceiling: 650000, rate: 0.10 },
    { floor: 650000, ceiling: Infinity, rate: 0.11 },
  ]},
  ID: { name: "Idaho", type: "progressive", brackets: [
    { floor: 0, ceiling: 4811, rate: 0.0 },
    { floor: 4811, ceiling: Infinity, rate: 0.053 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 9622, rate: 0.0 },
    { floor: 9622, ceiling: Infinity, rate: 0.053 },
  ]},
  IL: { name: "Illinois", type: "flat", rate: 0.0495 },
  IN: { name: "Indiana", type: "flat", rate: 0.0295 },
  IA: { name: "Iowa", type: "flat", rate: 0.038 },
  KS: { name: "Kansas", type: "progressive", brackets: [
    { floor: 0, ceiling: 23000, rate: 0.052 },
    { floor: 23000, ceiling: Infinity, rate: 0.0558 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 46000, rate: 0.052 },
    { floor: 46000, ceiling: Infinity, rate: 0.0558 },
  ]},
  KY: { name: "Kentucky", type: "flat", rate: 0.035 },
  LA: { name: "Louisiana", type: "flat", rate: 0.03 },
  ME: { name: "Maine", type: "progressive", brackets: [
    { floor: 0, ceiling: 27399, rate: 0.058 },
    { floor: 27399, ceiling: 64849, rate: 0.0675 },
    { floor: 64849, ceiling: Infinity, rate: 0.0715 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 54849, rate: 0.058 },
    { floor: 54849, ceiling: 129749, rate: 0.0675 },
    { floor: 129749, ceiling: Infinity, rate: 0.0715 },
  ]},
  MD: { name: "Maryland", type: "progressive", brackets: [
    { floor: 0, ceiling: 1000, rate: 0.02 },
    { floor: 1000, ceiling: 2000, rate: 0.03 },
    { floor: 2000, ceiling: 3000, rate: 0.04 },
    { floor: 3000, ceiling: 100000, rate: 0.0475 },
    { floor: 100000, ceiling: 125000, rate: 0.05 },
    { floor: 125000, ceiling: 150000, rate: 0.0525 },
    { floor: 150000, ceiling: 250000, rate: 0.055 },
    { floor: 250000, ceiling: 500000, rate: 0.0575 },
    { floor: 500000, ceiling: 1000000, rate: 0.0625 },
    { floor: 1000000, ceiling: Infinity, rate: 0.065 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 1000, rate: 0.02 },
    { floor: 1000, ceiling: 2000, rate: 0.03 },
    { floor: 2000, ceiling: 3000, rate: 0.04 },
    { floor: 3000, ceiling: 150000, rate: 0.0475 },
    { floor: 150000, ceiling: 175000, rate: 0.05 },
    { floor: 175000, ceiling: 225000, rate: 0.0525 },
    { floor: 225000, ceiling: 300000, rate: 0.055 },
    { floor: 300000, ceiling: 600000, rate: 0.0575 },
    { floor: 600000, ceiling: 1200000, rate: 0.0625 },
    { floor: 1200000, ceiling: Infinity, rate: 0.065 },
  ]},
  MA: { name: "Massachusetts", type: "progressive", brackets: [
    { floor: 0, ceiling: 1083150, rate: 0.05 },
    { floor: 1083150, ceiling: Infinity, rate: 0.09 },
  ]},
  MI: { name: "Michigan", type: "flat", rate: 0.0425 },
  MN: { name: "Minnesota", type: "progressive", brackets: [
    { floor: 0, ceiling: 33310, rate: 0.0535 },
    { floor: 33310, ceiling: 109430, rate: 0.068 },
    { floor: 109430, ceiling: 203150, rate: 0.0785 },
    { floor: 203150, ceiling: Infinity, rate: 0.0985 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 48700, rate: 0.0535 },
    { floor: 48700, ceiling: 193480, rate: 0.068 },
    { floor: 193480, ceiling: 337930, rate: 0.0785 },
    { floor: 337930, ceiling: Infinity, rate: 0.0985 },
  ]},
  MS: { name: "Mississippi", type: "progressive", brackets: [
    { floor: 0, ceiling: 10000, rate: 0.0 },
    { floor: 10000, ceiling: Infinity, rate: 0.04 },
  ]},
  MO: { name: "Missouri", type: "progressive", brackets: [
    { floor: 0, ceiling: 1348, rate: 0.0 },
    { floor: 1348, ceiling: 2696, rate: 0.02 },
    { floor: 2696, ceiling: 4044, rate: 0.025 },
    { floor: 4044, ceiling: 5392, rate: 0.03 },
    { floor: 5392, ceiling: 6740, rate: 0.035 },
    { floor: 6740, ceiling: 8088, rate: 0.04 },
    { floor: 8088, ceiling: 9436, rate: 0.045 },
    { floor: 9436, ceiling: Infinity, rate: 0.047 },
  ]},
  MT: { name: "Montana", type: "progressive", brackets: [
    { floor: 0, ceiling: 47500, rate: 0.047 },
    { floor: 47500, ceiling: Infinity, rate: 0.0565 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 95000, rate: 0.047 },
    { floor: 95000, ceiling: Infinity, rate: 0.0565 },
  ]},
  NE: { name: "Nebraska", type: "progressive", brackets: [
    { floor: 0, ceiling: 4130, rate: 0.0246 },
    { floor: 4130, ceiling: 24760, rate: 0.0351 },
    { floor: 24760, ceiling: Infinity, rate: 0.0455 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 8250, rate: 0.0246 },
    { floor: 8250, ceiling: 49530, rate: 0.0351 },
    { floor: 49530, ceiling: Infinity, rate: 0.0455 },
  ]},
  NV: { name: "Nevada", type: "none" },
  NH: { name: "New Hampshire", type: "none" },
  NJ: { name: "New Jersey", type: "progressive", brackets: [
    { floor: 0, ceiling: 20000, rate: 0.014 },
    { floor: 20000, ceiling: 35000, rate: 0.0175 },
    { floor: 35000, ceiling: 40000, rate: 0.035 },
    { floor: 40000, ceiling: 75000, rate: 0.0553 },
    { floor: 75000, ceiling: 500000, rate: 0.0637 },
    { floor: 500000, ceiling: 1000000, rate: 0.0897 },
    { floor: 1000000, ceiling: Infinity, rate: 0.1075 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 20000, rate: 0.014 },
    { floor: 20000, ceiling: 50000, rate: 0.0175 },
    { floor: 50000, ceiling: 70000, rate: 0.0245 },
    { floor: 70000, ceiling: 80000, rate: 0.035 },
    { floor: 80000, ceiling: 150000, rate: 0.0553 },
    { floor: 150000, ceiling: 500000, rate: 0.0637 },
    { floor: 500000, ceiling: 1000000, rate: 0.0897 },
    { floor: 1000000, ceiling: Infinity, rate: 0.1075 },
  ]},
  NM: { name: "New Mexico", type: "progressive", brackets: [
    { floor: 0, ceiling: 5500, rate: 0.015 },
    { floor: 5500, ceiling: 16500, rate: 0.032 },
    { floor: 16500, ceiling: 33500, rate: 0.043 },
    { floor: 33500, ceiling: 66500, rate: 0.047 },
    { floor: 66500, ceiling: 210000, rate: 0.049 },
    { floor: 210000, ceiling: Infinity, rate: 0.059 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 8000, rate: 0.015 },
    { floor: 8000, ceiling: 25000, rate: 0.032 },
    { floor: 25000, ceiling: 50000, rate: 0.043 },
    { floor: 50000, ceiling: 100000, rate: 0.047 },
    { floor: 100000, ceiling: 315000, rate: 0.049 },
    { floor: 315000, ceiling: Infinity, rate: 0.059 },
  ]},
  NY: { name: "New York", type: "progressive", brackets: [
    { floor: 0, ceiling: 8500, rate: 0.039 },
    { floor: 8500, ceiling: 11700, rate: 0.044 },
    { floor: 11700, ceiling: 13900, rate: 0.0515 },
    { floor: 13900, ceiling: 80650, rate: 0.054 },
    { floor: 80650, ceiling: 215400, rate: 0.059 },
    { floor: 215400, ceiling: 1077550, rate: 0.0685 },
    { floor: 1077550, ceiling: 5000000, rate: 0.0965 },
    { floor: 5000000, ceiling: 25000000, rate: 0.103 },
    { floor: 25000000, ceiling: Infinity, rate: 0.109 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 17150, rate: 0.039 },
    { floor: 17150, ceiling: 23600, rate: 0.044 },
    { floor: 23600, ceiling: 27900, rate: 0.0515 },
    { floor: 27900, ceiling: 161550, rate: 0.054 },
    { floor: 161550, ceiling: 323200, rate: 0.059 },
    { floor: 323200, ceiling: 2155350, rate: 0.0685 },
    { floor: 2155350, ceiling: 5000000, rate: 0.0965 },
    { floor: 5000000, ceiling: 25000000, rate: 0.103 },
    { floor: 25000000, ceiling: Infinity, rate: 0.109 },
  ]},
  NC: { name: "North Carolina", type: "flat", rate: 0.0399 },
  ND: { name: "North Dakota", type: "progressive", brackets: [
    { floor: 0, ceiling: 48475, rate: 0.0 },
    { floor: 48475, ceiling: 244825, rate: 0.0195 },
    { floor: 244825, ceiling: Infinity, rate: 0.025 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 80975, rate: 0.0 },
    { floor: 80975, ceiling: 298075, rate: 0.0195 },
    { floor: 298075, ceiling: Infinity, rate: 0.025 },
  ]},
  OH: { name: "Ohio", type: "progressive", brackets: [
    { floor: 0, ceiling: 26050, rate: 0.0 },
    { floor: 26050, ceiling: Infinity, rate: 0.0275 },
  ]},
  OK: { name: "Oklahoma", type: "progressive", brackets: [
    { floor: 0, ceiling: 3750, rate: 0.0 },
    { floor: 3750, ceiling: 4900, rate: 0.025 },
    { floor: 4900, ceiling: 7200, rate: 0.035 },
    { floor: 7200, ceiling: Infinity, rate: 0.045 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 7500, rate: 0.0 },
    { floor: 7500, ceiling: 9800, rate: 0.025 },
    { floor: 9800, ceiling: 14400, rate: 0.035 },
    { floor: 14400, ceiling: Infinity, rate: 0.045 },
  ]},
  OR: { name: "Oregon", type: "progressive", brackets: [
    { floor: 0, ceiling: 4550, rate: 0.0475 },
    { floor: 4550, ceiling: 11400, rate: 0.0675 },
    { floor: 11400, ceiling: 125000, rate: 0.0875 },
    { floor: 125000, ceiling: Infinity, rate: 0.099 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 9100, rate: 0.0475 },
    { floor: 9100, ceiling: 22800, rate: 0.0675 },
    { floor: 22800, ceiling: 250000, rate: 0.0875 },
    { floor: 250000, ceiling: Infinity, rate: 0.099 },
  ]},
  PA: { name: "Pennsylvania", type: "flat", rate: 0.0307 },
  RI: { name: "Rhode Island", type: "progressive", brackets: [
    { floor: 0, ceiling: 82050, rate: 0.0375 },
    { floor: 82050, ceiling: 186450, rate: 0.0475 },
    { floor: 186450, ceiling: Infinity, rate: 0.0599 },
  ]},
  SC: { name: "South Carolina", type: "progressive", brackets: [
    { floor: 0, ceiling: 3640, rate: 0.0 },
    { floor: 3640, ceiling: 18230, rate: 0.03 },
    { floor: 18230, ceiling: Infinity, rate: 0.06 },
  ]},
  SD: { name: "South Dakota", type: "none" },
  TN: { name: "Tennessee", type: "none" },
  TX: { name: "Texas", type: "none" },
  UT: { name: "Utah", type: "flat", rate: 0.045 },
  VT: { name: "Vermont", type: "progressive", brackets: [
    { floor: 0, ceiling: 49400, rate: 0.0335 },
    { floor: 49400, ceiling: 119700, rate: 0.066 },
    { floor: 119700, ceiling: 249700, rate: 0.076 },
    { floor: 249700, ceiling: Infinity, rate: 0.0875 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 82500, rate: 0.0335 },
    { floor: 82500, ceiling: 199450, rate: 0.066 },
    { floor: 199450, ceiling: 304000, rate: 0.076 },
    { floor: 304000, ceiling: Infinity, rate: 0.0875 },
  ]},
  VA: { name: "Virginia", type: "progressive", brackets: [
    { floor: 0, ceiling: 3000, rate: 0.02 },
    { floor: 3000, ceiling: 5000, rate: 0.03 },
    { floor: 5000, ceiling: 17000, rate: 0.05 },
    { floor: 17000, ceiling: Infinity, rate: 0.0575 },
  ]},
  // Washington taxes capital gains only (7%/9%), not ordinary income.
  // The $278K exemption applies to capital gains. Modeled as "none" for
  // ordinary income; capital gains tax would need separate handling.
  WA: { name: "Washington", type: "none" },
  WV: { name: "West Virginia", type: "progressive", brackets: [
    { floor: 0, ceiling: 10000, rate: 0.0222 },
    { floor: 10000, ceiling: 25000, rate: 0.0296 },
    { floor: 25000, ceiling: 40000, rate: 0.0333 },
    { floor: 40000, ceiling: 60000, rate: 0.0444 },
    { floor: 60000, ceiling: Infinity, rate: 0.0482 },
  ]},
  WI: { name: "Wisconsin", type: "progressive", brackets: [
    { floor: 0, ceiling: 15110, rate: 0.035 },
    { floor: 15110, ceiling: 51950, rate: 0.044 },
    { floor: 51950, ceiling: 332720, rate: 0.053 },
    { floor: 332720, ceiling: Infinity, rate: 0.0765 },
  ], mfjBrackets: [
    { floor: 0, ceiling: 20150, rate: 0.035 },
    { floor: 20150, ceiling: 69260, rate: 0.044 },
    { floor: 69260, ceiling: 443630, rate: 0.053 },
    { floor: 443630, ceiling: Infinity, rate: 0.0765 },
  ]},
  WY: { name: "Wyoming", type: "none" },
  DC: { name: "District of Columbia", type: "progressive", brackets: [
    { floor: 0, ceiling: 10000, rate: 0.04 },
    { floor: 10000, ceiling: 40000, rate: 0.06 },
    { floor: 40000, ceiling: 60000, rate: 0.065 },
    { floor: 60000, ceiling: 250000, rate: 0.085 },
    { floor: 250000, ceiling: 500000, rate: 0.0925 },
    { floor: 500000, ceiling: 1000000, rate: 0.0975 },
    { floor: 1000000, ceiling: Infinity, rate: 0.1075 },
  ]},
};

// States with no income tax (convenience list for UI)
export const NO_TAX_STATES = Object.entries(STATE_TAXES)
  .filter(([, v]) => v.type === "none")
  .map(([k]) => k);

// Get state tax config, falls back to { type: "none" } for unknown codes
export function getStateTax(stateCode) {
  return STATE_TAXES[stateCode] || { name: stateCode, type: "none" };
}

// Calculate state tax on taxable income
export function calcStateTax(stateCode, taxableIncome, filingStatus = "single") {
  const config = getStateTax(stateCode);
  if (config.type === "none") return 0;
  if (config.type === "flat") return Math.max(0, taxableIncome) * config.rate;

  // Progressive — use MFJ brackets when applicable
  const brackets = (filingStatus === "mfj" && config.mfjBrackets) ? config.mfjBrackets : config.brackets;
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.floor) break;
    const taxable = Math.min(taxableIncome, bracket.ceiling) - bracket.floor;
    tax += taxable * bracket.rate;
  }
  return tax;
}

// Get the effective/marginal rate for display
export function getStateRate(stateCode, taxableIncome, filingStatus = "single") {
  const config = getStateTax(stateCode);
  if (config.type === "none") return { effective: 0, marginal: 0 };
  if (config.type === "flat") return { effective: config.rate, marginal: config.rate };

  const tax = calcStateTax(stateCode, taxableIncome, filingStatus);
  const effective = taxableIncome > 0 ? tax / taxableIncome : 0;

  const brackets = (filingStatus === "mfj" && config.mfjBrackets) ? config.mfjBrackets : config.brackets;
  let marginal = 0;
  for (const bracket of brackets) {
    if (taxableIncome > bracket.floor) marginal = bracket.rate;
  }

  return { effective, marginal };
}
