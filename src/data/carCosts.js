// Default car purchase cost items with typical ranges
// percentOfPrice items scale with vehicle price; fixed items have a flat default

export const CAR_PURCHASE_DEFAULTS = [
  { key: "salesTax",    label: "Sales Tax",                default: null, range: [0.04, 0.10], percentOfPrice: true, defaultPercent: 0.07 },
  { key: "titleReg",    label: "Title & Registration",     default: 400,  range: [100, 1000] },
  { key: "docFee",      label: "Dealer Doc Fee",           default: 500,  range: [0, 800] },
  { key: "gapInsurance", label: "GAP Insurance (optional)", default: 0,    range: [0, 800] },
  { key: "extWarranty", label: "Ext. Warranty (optional)",  default: 0,    range: [0, 3000] },
];
