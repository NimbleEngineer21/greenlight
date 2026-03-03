// All financial math extracted from App.jsx — preserves identical calculation logic
import { calcCapitalGainsTax } from "./taxEngine.js";

export function isLongTerm(acquisitionDate, sellDate) {
  if (!acquisitionDate) return null;
  const acq = new Date(acquisitionDate + "T12:00:00");
  const sell = typeof sellDate === "string" ? new Date(sellDate + "T12:00:00") : sellDate;
  return (sell.getTime() - acq.getTime()) > 365.25 * 864e5;
}

export function calcFee(asset, grossValue, platforms) {
  const ft = asset.feeType;
  if (ft === "none" || !ft) return 0;
  const plat = platforms[ft];
  if (!plat) return 0;
  if (plat.feePerShare != null) return asset.quantity * plat.feePerShare + (plat.flatFee || 0);
  if (plat.feePercent != null) return grossValue * plat.feePercent;
  return 0;
}

export function paychecksBefore(sellDate, cashFlowConfig) {
  const { paycheckAmount, firstPayDate, paycheckFrequency } = cashFlowConfig;
  if (!paycheckAmount || !firstPayDate) return 0;
  const interval = paycheckFrequency === "weekly" ? 7 : paycheckFrequency === "monthly" ? 30 : 14;
  let count = 0;
  let t = new Date(firstPayDate + "T12:00:00");
  const sell = typeof sellDate === "string" ? new Date(sellDate + "T12:00:00") : sellDate;
  while (t <= sell) {
    count++;
    t = new Date(t.getTime() + interval * 864e5);
  }
  return count;
}

export function expensesBefore(sellDate, expenses) {
  const sell = typeof sellDate === "string" ? new Date(sellDate + "T12:00:00") : sellDate;
  let total = 0;
  for (const exp of expenses) {
    if (exp.frequency === "monthly") {
      let d = new Date(exp.startDate + "T12:00:00");
      while (d <= sell) {
        total += exp.amount;
        d.setMonth(d.getMonth() + 1);
      }
    } else if (exp.frequency === "biweekly" || exp.frequency === "weekly") {
      const interval = exp.frequency === "weekly" ? 7 : 14;
      let d = new Date(exp.startDate + "T12:00:00");
      while (d <= sell) {
        total += exp.amount;
        d = new Date(d.getTime() + interval * 864e5);
      }
    }
  }
  return total;
}

export function obligationsBefore(sellDate, obligations) {
  const sell = typeof sellDate === "string" ? new Date(sellDate + "T12:00:00") : sellDate;
  let total = 0;
  for (const ob of obligations) {
    if (ob.isPaid) continue;
    const due = new Date(ob.dueDate + "T12:00:00");
    if (due <= sell) total += ob.amount;
  }
  return total;
}

export function calcCashFlow(sellDate, cashFlowConfig) {
  const pays = paychecksBefore(sellDate, cashFlowConfig);
  const payTotal = pays * cashFlowConfig.paycheckAmount;
  const expTotal = expensesBefore(sellDate, cashFlowConfig.expenses || []);
  const obTotal = obligationsBefore(sellDate, cashFlowConfig.oneTimeObligations || []);
  const mortgageCount = cashFlowConfig.expenses?.length > 0
    ? (() => {
        let count = 0;
        const sell = typeof sellDate === "string" ? new Date(sellDate + "T12:00:00") : sellDate;
        for (const exp of cashFlowConfig.expenses) {
          if (exp.frequency === "monthly") {
            let d = new Date(exp.startDate + "T12:00:00");
            while (d <= sell) { count++; d.setMonth(d.getMonth() + 1); }
          }
        }
        return count;
      })()
    : 0;
  return { pays, payTotal, expTotal, obTotal, mortgageCount, net: payTotal - expTotal - obTotal };
}

export function calcRetirementNet(retirement) {
  if (!retirement?.enabled) return { gross: 0, deductions: 0, net: 0, accounts: [] };

  const accounts = retirement.accounts || [];
  const { penaltyRate, taxRate, stateTaxRate } = retirement;
  const incomeTaxRate = taxRate + stateTaxRate;

  let totalGross = 0, totalDeductions = 0;
  const accountResults = [];

  for (const acct of accounts) {
    const { accountType, balance, contributions = 0 } = acct;
    let penalty = 0, tax = 0;

    if (accountType === "roth_401k" || accountType === "roth_ira") {
      // Roth: only earnings (balance - contributions) are penalized and taxed
      const earnings = Math.max(0, balance - contributions);
      penalty = earnings * penaltyRate;
      tax = earnings * incomeTaxRate;
    } else {
      // Pre-tax 401k, Traditional IRA, Safe Harbor, Unknown: full balance
      penalty = balance * penaltyRate;
      tax = balance * incomeTaxRate;
    }

    const deductions = penalty + tax;
    totalGross += balance;
    totalDeductions += deductions;

    accountResults.push({
      ...acct, penalty, tax, deductions, net: balance - deductions,
    });
  }

  return { gross: totalGross, deductions: totalDeductions, net: totalGross - totalDeductions, accounts: accountResults };
}

export function calcSummary(state, prices) {
  const sellDate = state.sellDate || "2026-04-17";
  const sell = new Date(sellDate + "T12:00:00");
  const { taxConfig, platforms, retirement } = state;

  // Cash flow
  const cf = calcCashFlow(sellDate, state.cashFlow);

  // Cash accounts total
  const cashTotal = (state.cashAccounts || []).reduce((s, c) => s + (c.balance || 0), 0);

  // Per-asset calculations
  let ltGains = 0, ltLosses = 0, stGains = 0, stLosses = 0, totalFees = 0, totalNetProceeds = 0;

  const rows = (state.assets || []).map(asset => {
    const price = asset.priceKey ? (prices[asset.priceKey] || 0) : 0;
    const gross = asset.priceKey === null ? asset.costBasis : asset.quantity * price;
    const fee = calcFee(asset, gross, platforms);
    const net = gross - fee;
    const gainLoss = gross - asset.costBasis;
    const lt = isLongTerm(asset.acquisitionDate, sell);

    totalFees += fee;
    totalNetProceeds += net;

    if (lt === true) { gainLoss > 0 ? ltGains += gainLoss : ltLosses += gainLoss; }
    else if (lt === false) { gainLoss > 0 ? stGains += gainLoss : stLosses += gainLoss; }

    return { ...asset, price, gross, fee, net, gainLoss, lt };
  });

  // Planned capital sales (vehicles, property, etc.)
  let capitalSaleProceeds = 0;
  for (const sale of (state.capitalSales || [])) {
    const gainLoss = (sale.expectedAmount || 0) - (sale.costBasis || 0);
    capitalSaleProceeds += sale.expectedAmount || 0;
    if (sale.isLongTerm) {
      gainLoss > 0 ? ltGains += gainLoss : ltLosses += gainLoss;
    } else {
      gainLoss > 0 ? stGains += gainLoss : stLosses += gainLoss;
    }
  }

  // Capital gains tax netting
  const netLT = ltGains + ltLosses;
  const netST = stGains + stLosses;
  const totalNetGainLoss = netLT + netST;

  let tax = 0;
  let deductible = 0;
  let taxDetail = null;

  if (taxConfig.taxMode === "progressive") {
    // Progressive bracket-based computation
    const result = calcCapitalGainsTax({
      ltGains, ltLosses, stGains, stLosses,
      ordinaryIncome: taxConfig.combinedW2 || 0,
      year: taxConfig.taxYear || 2025,
      filingStatus: taxConfig.filingStatus || "mfj",
      stateCode: taxConfig.state || "FL",
    });
    tax = result.totalTax;
    deductible = result.deductible;
    taxDetail = result;
  } else {
    // Legacy flat-rate computation
    if (totalNetGainLoss > 0) {
      const ltRate = taxConfig.ltcgRate + (taxConfig.niitApplies ? taxConfig.niitRate : 0);
      const stRate = taxConfig.stcgRate + (taxConfig.niitApplies ? taxConfig.niitRate : 0);
      if (netLT >= 0 && netST >= 0) {
        tax = netLT * ltRate + netST * stRate;
      } else if (netLT < 0) {
        tax = Math.max(0, netST + netLT) * stRate;
      } else {
        tax = Math.max(0, netLT + netST) * ltRate;
      }
    }
    deductible = totalNetGainLoss < 0 ? Math.min(3000, Math.abs(totalNetGainLoss)) : 0;
  }

  // Retirement
  const ret = calcRetirementNet(retirement);

  // Totals
  const totalLiquid = cashTotal + totalNetProceeds + capitalSaleProceeds + ret.net + cf.net - tax;
  const totalGross = cashTotal + rows.reduce((s, r) => s + r.gross, 0) + capitalSaleProceeds + ret.gross + cf.net;

  return {
    rows, cashTotal, totalNetProceeds, capitalSaleProceeds, totalFees,
    ltGains, ltLosses, stGains, stLosses, netLT, netST, totalNetGainLoss,
    tax, deductible, taxDetail, retirement: ret, cashFlow: cf,
    totalLiquid, totalGross, sellDate,
  };
}

export function calcMonthlySavings(cashFlowConfig) {
  const { paycheckAmount, paycheckFrequency, expenses } = cashFlowConfig;
  let monthlyIncome = 0;
  if (paycheckAmount) {
    if (paycheckFrequency === "weekly") monthlyIncome = paycheckAmount * 52 / 12;
    else if (paycheckFrequency === "biweekly") monthlyIncome = paycheckAmount * 26 / 12;
    else monthlyIncome = paycheckAmount; // monthly
  }
  let monthlyExpenses = 0;
  for (const exp of (expenses || [])) {
    if (exp.frequency === "weekly") monthlyExpenses += exp.amount * 52 / 12;
    else if (exp.frequency === "biweekly") monthlyExpenses += exp.amount * 26 / 12;
    else monthlyExpenses += exp.amount; // monthly
  }
  return { monthlyIncome, monthlyExpenses, monthlySavings: monthlyIncome - monthlyExpenses };
}

// Formatting helpers
export function fmt(n) {
  if (n == null) return "\u2014";
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < -0.005 ? `(${s})` : `$${s}`;
}

export function fmtDate(d) {
  const date = typeof d === "string" ? new Date(d + "T12:00:00") : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtQty(q) {
  if (q < 0.001) return q.toFixed(8);
  if (q < 1) return q.toFixed(6);
  if (q < 100) return q.toFixed(2);
  if (q > 1e6) return (q / 1e6).toFixed(1) + "M";
  return q.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
