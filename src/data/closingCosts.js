// Default home closing cost items with typical ranges
// percentOfPrice items scale with purchase price; fixed items have a flat default
// Each item can be overridden by the user and marked as "paid" to exclude from remaining total

export const HOME_CLOSING_DEFAULTS = [
  { key: "appraisal",       label: "Appraisal Fee",            default: 500,  range: [300, 800] },
  { key: "inspection",      label: "Home Inspection",          default: 450,  range: [300, 600] },
  { key: "wdoInspection",   label: "WDO / Pest Inspection",   default: 100,  range: [50, 200] },
  { key: "titleSearch",     label: "Title Search",             default: 200,  range: [100, 400] },
  { key: "titleInsurance",  label: "Title Insurance",          default: null, range: [0.003, 0.006], percentOfPrice: true, defaultPercent: 0.005 },
  { key: "attorneyFees",    label: "Attorney / Closing Fees",  default: 1500, range: [800, 3000] },
  { key: "recording",       label: "Recording Fees",           default: 125,  range: [50, 250] },
  { key: "origination",     label: "Loan Origination Fee",     default: null, range: [0.005, 0.015], percentOfPrice: true, defaultPercent: 0.01 },
  { key: "survey",          label: "Property Survey",          default: 400,  range: [200, 800] },
  { key: "escrow",          label: "Escrow Reserve (2-3 mo)",  default: null, range: [0.003, 0.008], percentOfPrice: true, defaultPercent: 0.005 },
  { key: "homeWarranty",    label: "Home Warranty",            default: 600,  range: [300, 800] },
];
