// ── Credlance MIS · AI Financial Analyzer ────────────────────────────────
// 5-Module analysis engine producing structured findings
// Phase 7 · All figures in ₹ Lakhs · Ind AS / IGAAP standards

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────
const TEMPLATES_LIST = ['trial_balance','budget','sales_register','ar_ageing','ap_ageing','employee_cost'];

// Finding severity levels (used as CSS classes and sort keys)
const SEV = { RED: 0, AMBER: 1, ADVISORY: 2, POSITIVE: 3, INFO: 4 };

// ── Number helpers ────────────────────────────────────────────────────────
function fmt(v, dec=1) {
  if (v == null || isNaN(v)) return '—';
  const abs = Math.abs(v);
  const s   = abs.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return v < 0 ? `(${s})` : s;
}
function pctStr(v, dec=1) {
  if (v == null || !isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(dec) + '%';
}
function pctAbs(v, dec=1) {
  if (v == null || !isFinite(v)) return '—';
  return v.toFixed(dec) + '%';
}
function varPct(actual, base) {
  if (!base || base === 0) return null;
  return (actual - base) / Math.abs(base) * 100;
}
function fyLabel(i) {
  const m = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
  return m[i] + '-' + (i >= 9 ? '26' : '25');
}

// ── Core P&L builder (single month or YTD) ────────────────────────────────
function buildPL(d, monthIdx, ytd) {
  function s(arr) {
    if (!arr) return 0;
    return ytd
      ? arr.slice(0, monthIdx + 1).reduce((a, v) => a + (v || 0), 0)
      : (arr[monthIdx] || 0);
  }
  const rev    = s(d.revenue_ops);
  const oth    = s(d.other_income);
  const dc     = s(d.direct_costs);
  const ec     = s(d.employee_costs);
  const fc     = s(d.finance_costs);
  const dep    = s(d.depreciation);
  const oe     = s(d.other_expenses);
  const ct     = s(d.current_tax);
  const dft    = s(d.deferred_tax);
  const gp     = rev - dc;
  const ebitda = gp - ec - oe;
  const ebit   = ebitda - dep;
  const pbt    = ebit - fc + oth;
  const pat    = pbt - ct - dft;
  return { rev, oth, dc, ec, fc, dep, oe, ct, dft, gp, ebitda, ebit, pbt, pat };
}

// ── Ratio calculator (single-month point-in-time) ─────────────────────────
function calcRatios(data, monthIdx) {
  const A  = data.actual;
  const bs = data.bs[monthIdx];
  const pl = buildPL(A, monthIdx, false);

  const ca          = bs.trade_receivables + bs.cash + bs.other_current_assets;
  const cl          = bs.st_borrowings + bs.trade_payables + bs.other_cl + bs.provisions;
  const quickAssets = bs.cash + bs.trade_receivables;
  const totalDebt   = bs.lt_borrowings + bs.st_borrowings;
  const equity      = bs.share_capital + bs.retained_earnings;
  const totalAssets = bs.net_fixed_assets + bs.lt_investments + bs.trade_receivables
                    + bs.cash + bs.other_current_assets;
  const nfa         = bs.net_fixed_assets;

  const currentRatio  = cl > 0   ? ca / cl          : null;
  const quickRatio    = cl > 0   ? quickAssets / cl  : null;
  const deRatio       = equity > 0 ? totalDebt / equity : null;
  const interestCover = pl.fc > 0   ? pl.ebit / pl.fc   : null;
  const grossMargin   = pl.rev > 0  ? pl.gp / pl.rev * 100 : null;
  const ebitdaMargin  = pl.rev > 0  ? pl.ebitda / pl.rev * 100 : null;
  const netMargin     = pl.rev > 0  ? pl.pat / pl.rev * 100 : null;
  const roe           = equity > 0  ? pl.pat * 12 / equity * 100 : null;
  const roce          = (equity + totalDebt) > 0 ? pl.ebit * 12 / (equity + totalDebt) * 100 : null;
  const assetTurnover = totalAssets > 0 ? pl.rev * 12 / totalAssets : null;
  const debtorDays    = pl.rev > 0   ? bs.trade_receivables / pl.rev * 30 : null;
  const creditorDays  = pl.dc > 0    ? bs.trade_payables / pl.dc * 30 : null;
  const ccc           = (debtorDays != null && creditorDays != null) ? debtorDays - creditorDays : null;
  const ltToCA        = ca > 0       ? bs.lt_borrowings / ca : null; // LT funds funding CA (funding structure)
  const dscr          = (pl.fc + 1.5) > 0 ? (pl.ebitda) / (pl.fc + 1.5) : null; // 1.5 = monthly LT repayment

  return {
    currentRatio, quickRatio, deRatio, interestCover,
    grossMargin, ebitdaMargin, netMargin,
    roe, roce, assetTurnover,
    debtorDays, creditorDays, ccc,
    ltToCA, dscr,
    // raw BS for further use
    _bs: bs, _pl: pl, _equity: equity, _totalDebt: totalDebt, _nfa: nfa,
    _totalAssets: totalAssets, _ca: ca, _cl: cl,
  };
}

// ── Previous month ratios for trend ───────────────────────────────────────
function calcPrevRatios(data, monthIdx) {
  if (monthIdx === 0) return null;
  return calcRatios(data, monthIdx - 1);
}

// ═════════════════════════════════════════════════════════════════════════
// MODULE 1 — FUNDING STRUCTURE
// Checks: NFA funded by LT sources? CA > CL? D/E and interest cover
// ═════════════════════════════════════════════════════════════════════════
function analyseModule1(data, monthIdx) {
  const r   = calcRatios(data, monthIdx);
  const bs  = r._bs;
  const findings = [];

  // 1a. Short-term funds financing long-term assets
  const ltSources = bs.share_capital + (data.bs[monthIdx]?.retained_earnings || 0) + bs.lt_borrowings;
  const nfaFunded = ltSources - r._nfa;
  if (nfaFunded < 0) {
    findings.push({
      sev: SEV.RED,
      module: 'Funding Structure',
      title: 'Short-Term Funds Financing Fixed Assets',
      detail: `Net Fixed Assets (₹${fmt(r._nfa)}L) exceed long-term funding sources (Equity + LT Borrowings = ₹${fmt(ltSources)}L) by ₹${fmt(Math.abs(nfaFunded))}L. Short-term liabilities are being used to fund long-term assets — a classic maturity mismatch and a significant liquidity risk.`,
      action: 'Arrange long-term financing (term loan or equity) to fund fixed assets. Avoid rollover dependence on short-term credit for capital assets.',
    });
  } else {
    findings.push({
      sev: SEV.POSITIVE,
      module: 'Funding Structure',
      title: 'Fixed Assets Funded by Long-Term Sources',
      detail: `Long-term sources (₹${fmt(ltSources)}L) adequately cover Net Fixed Assets (₹${fmt(r._nfa)}L) with a surplus of ₹${fmt(nfaFunded)}L available for working capital support.`,
      action: null,
    });
  }

  // 1b. Current Ratio
  if (r.currentRatio !== null) {
    if (r.currentRatio < 1.0) {
      findings.push({
        sev: SEV.RED,
        module: 'Funding Structure',
        title: `Current Ratio Below 1.0x — Liquidity Crisis Risk`,
        detail: `Current Ratio is ${r.currentRatio.toFixed(2)}x (CA ₹${fmt(r._ca)}L vs CL ₹${fmt(r._cl)}L). The company cannot cover current liabilities with current assets, indicating immediate liquidity pressure.`,
        action: 'Expedite collections, defer discretionary capex, and negotiate payable extensions. Explore short-term credit facilities with caution.',
      });
    } else if (r.currentRatio < 1.5) {
      findings.push({
        sev: SEV.AMBER,
        module: 'Funding Structure',
        title: `Current Ratio Below Comfort Threshold (${r.currentRatio.toFixed(2)}x)`,
        detail: `Current Ratio of ${r.currentRatio.toFixed(2)}x is below the recommended 1.5x for Indian SMEs. Working capital headroom is limited.`,
        action: 'Monitor weekly cash flow. Improve debtor collections and review credit terms with major clients.',
      });
    } else {
      findings.push({
        sev: SEV.POSITIVE,
        module: 'Funding Structure',
        title: `Healthy Current Ratio (${r.currentRatio.toFixed(2)}x)`,
        detail: `Current Ratio of ${r.currentRatio.toFixed(2)}x is above the 1.5x threshold, indicating comfortable short-term liquidity.`,
        action: null,
      });
    }
  }

  // 1c. D/E Ratio
  if (r.deRatio !== null) {
    if (r.deRatio > 2.0) {
      findings.push({
        sev: SEV.RED,
        module: 'Funding Structure',
        title: `High Leverage — D/E Ratio ${r.deRatio.toFixed(2)}x`,
        detail: `Debt-to-Equity of ${r.deRatio.toFixed(2)}x indicates the business is heavily debt-financed (Total Debt ₹${fmt(r._totalDebt)}L vs Equity ₹${fmt(r._equity)}L). This increases financial risk and limits future borrowing capacity.`,
        action: 'Prioritise debt repayment from operating cash flows. Avoid further debt until D/E drops below 1.5x.',
      });
    } else if (r.deRatio > 1.0) {
      findings.push({
        sev: SEV.AMBER,
        module: 'Funding Structure',
        title: `Elevated Leverage — D/E Ratio ${r.deRatio.toFixed(2)}x`,
        detail: `D/E of ${r.deRatio.toFixed(2)}x is above 1.0x. Leverage is manageable but warrants monitoring, especially if earnings decline.`,
        action: 'Maintain a debt repayment schedule and avoid incremental borrowing for non-critical purposes.',
      });
    }
  }

  // 1d. Interest Cover
  if (r.interestCover !== null) {
    if (r.interestCover < 1.5) {
      findings.push({
        sev: SEV.RED,
        module: 'Funding Structure',
        title: `Insufficient Interest Cover (${r.interestCover.toFixed(1)}x)`,
        detail: `EBIT (₹${fmt(r._pl.ebit)}L) covers finance costs (₹${fmt(r._pl.fc)}L) only ${r.interestCover.toFixed(1)}x. Any earnings decline could impair debt servicing.`,
        action: 'Review debt quantum and refinancing options. Prioritise revenue growth and operating cost reduction to expand EBIT.',
      });
    } else if (r.interestCover < 3.0) {
      findings.push({
        sev: SEV.AMBER,
        module: 'Funding Structure',
        title: `Interest Cover Below 3x (${r.interestCover.toFixed(1)}x)`,
        detail: `Interest cover of ${r.interestCover.toFixed(1)}x is below the preferred 3x threshold for Indian SMEs. Debt servicing buffer is thin.`,
        action: 'Build EBITDA headroom before taking on additional debt obligations.',
      });
    }
  }

  return findings;
}

// ═════════════════════════════════════════════════════════════════════════
// MODULE 2 — P&L LINE ITEM VARIANCE (Three-Axis)
// Actual vs Budget, Actual vs Prior Year, Month-on-Month trend
// ═════════════════════════════════════════════════════════════════════════
function analyseModule2(data, monthIdx, ytd) {
  const A   = buildPL(data.actual,     monthIdx, ytd);
  const B   = buildPL(data.budget,     monthIdx, ytd);
  const P   = buildPL(data.prior_year, monthIdx, ytd);
  const findings = [];
  const period = ytd ? `YTD (Apr–${fyLabel(monthIdx)})` : fyLabel(monthIdx);

  // Line items to analyse: [key, label, isExpense]
  const lines = [
    { key: 'rev',    label: 'Revenue',          isExpense: false, aVal: A.rev,    bVal: B.rev,    pVal: P.rev    },
    { key: 'dc',     label: 'Direct Costs',     isExpense: true,  aVal: A.dc,     bVal: B.dc,     pVal: P.dc     },
    { key: 'ec',     label: 'Employee Costs',   isExpense: true,  aVal: A.ec,     bVal: B.ec,     pVal: P.ec     },
    { key: 'oe',     label: 'Other Expenses',   isExpense: true,  aVal: A.oe,     bVal: B.oe,     pVal: P.oe     },
    { key: 'fc',     label: 'Finance Costs',    isExpense: true,  aVal: A.fc,     bVal: B.fc,     pVal: P.fc     },
    { key: 'dep',    label: 'Depreciation',     isExpense: true,  aVal: A.dep,    bVal: B.dep,    pVal: P.dep    },
    { key: 'ebitda', label: 'EBITDA',           isExpense: false, aVal: A.ebitda, bVal: B.ebitda, pVal: P.ebitda },
    { key: 'pat',    label: 'PAT',              isExpense: false, aVal: A.pat,    bVal: B.pat,    pVal: P.pat    },
  ];

  lines.forEach(({ key, label, isExpense, aVal, bVal, pVal }) => {
    const vsBud = varPct(aVal, bVal);
    const vsPY  = varPct(aVal, pVal);
    if (vsBud == null && vsPY == null) return;

    // For expenses: over budget = unfavourable (positive variance = bad)
    // For income:   under budget = unfavourable (negative variance = bad)
    const overBudget     = isExpense ? (vsBud > 0) : (vsBud < 0);
    const overBudgetAmt  = Math.abs(aVal - bVal);
    const overBudgetPct  = Math.abs(vsBud || 0);
    const vsYrDir        = isExpense ? (vsPY > 0) : (vsPY > 0); // both: higher = up vs PY

    // Threshold logic per spec:
    // >15% over budget AND >20% up vs PY → RED
    // Within budget but >25% up vs PY    → ADVISORY
    // Within budget and within 15% of PY → SUMMARY NOTE (INFO)
    // Special: Finance Costs — any increase vs PY flagged AMBER
    // Special: Employee Costs — headcount-driven increases require narrative
    // Special: Revenue decline regardless of budget → separate module

    let sev = null; let detail = ''; let action = '';

    if (key === 'fc') {
      // Finance costs: any YoY increase = AMBER concern
      if (vsPY != null && vsPY > 5) {
        sev = SEV.AMBER;
        detail = `Finance Costs are ₹${fmt(aVal)}L (${period}), up ${pctStr(vsPY)} vs prior year (₹${fmt(pVal)}L). Rising interest burden may reflect increased borrowings or rate hikes.`;
        action = 'Review loan portfolio — check if new debt was taken for productive purposes. Explore refinancing at lower rates if possible.';
      } else if (vsPY != null && vsPY < -5) {
        sev = SEV.POSITIVE;
        detail = `Finance Costs have reduced ${pctStr(vsPY)} vs prior year, reflecting disciplined debt repayment or better rates.`;
      }

    } else if (key === 'ec') {
      // Employee costs: over budget by >10% warrants note
      if (overBudget && overBudgetPct > 10) {
        sev = SEV.AMBER;
        detail = `Employee Costs (₹${fmt(aVal)}L) are ${pctStr(vsBud)} vs budget (₹${fmt(bVal)}L) for ${period}. Incremental spend of ₹${fmt(overBudgetAmt)}L above plan. This may reflect unplanned hiring, increments, or contract staff.`;
        action = 'Reconcile headcount movement with HR records. Confirm whether incremental hires are revenue-generating. Review variable pay accruals.';
      } else if (vsPY != null && vsPY > 20) {
        sev = SEV.ADVISORY;
        detail = `Employee Costs are up ${pctStr(vsPY)} vs prior year despite being within budget. This significant YoY increase warrants a headcount and compensation review.`;
        action = 'Prepare headcount reconciliation (opening vs closing, departures, new hires) and validate compensation structure changes.';
      }

    } else if (key === 'rev') {
      // Revenue handled primarily in Module 3; add a summary here
      if (overBudget && overBudgetPct > 15) {
        sev = SEV.AMBER;
        detail = `Revenue (₹${fmt(aVal)}L) is ${pctStr(vsBud)} below budget (₹${fmt(bVal)}L) — a shortfall of ₹${fmt(overBudgetAmt)}L for ${period}.`;
        action = 'Review pipeline conversion rates and client onboarding delays. See Revenue Quality module for detailed analysis.';
      } else if (!overBudget && vsBud != null && Math.abs(vsBud) < 5) {
        sev = SEV.POSITIVE;
        detail = `Revenue of ₹${fmt(aVal)}L is within 5% of budget (₹${fmt(bVal)}L) — strong budget adherence.`;
      }

    } else {
      // General line items
      if (overBudget && overBudgetPct > 15 && vsPY != null && Math.abs(vsPY) > 20) {
        sev = SEV.RED;
        detail = `${label} (₹${fmt(aVal)}L) is ${pctStr(vsBud)} ${isExpense ? 'over' : 'below'} budget AND ${pctStr(vsPY)} vs prior year. Both axes indicate a material adverse movement of ₹${fmt(overBudgetAmt)}L above plan.`;
        action = `Investigate root cause of ${label} escalation. Obtain supporting invoices/schedules. Determine if one-time or structural. Implement corrective controls.`;
      } else if (overBudget && overBudgetPct > 15) {
        sev = SEV.AMBER;
        detail = `${label} (₹${fmt(aVal)}L) is ${pctStr(vsBud)} ${isExpense ? 'over' : 'below'} budget (₹${fmt(bVal)}L) for ${period} — a variance of ₹${fmt(overBudgetAmt)}L.`;
        action = `Review ${label} line — obtain invoice-level detail and confirm whether spend is authorised and recurring.`;
      } else if (!overBudget && vsPY != null && (isExpense ? vsPY > 25 : vsPY < -25)) {
        sev = SEV.ADVISORY;
        detail = `${label} (₹${fmt(aVal)}L) is within budget but ${pctStr(vsPY)} vs prior year — a significant YoY movement despite budget adherence.`;
        action = `Validate whether the ${label} increase vs prior year is structural or episodic. Check if budget was set too high as a contingency.`;
      } else if (!overBudget && (vsPY == null || Math.abs(vsPY) < 15)) {
        sev = SEV.INFO;
        detail = `${label}: Actual ₹${fmt(aVal)}L | Budget ₹${fmt(bVal)}L (${pctStr(vsBud)}) | Prior Year ₹${fmt(pVal)}L (${pctStr(vsPY)}) — within normal parameters.`;
      }
    }

    if (sev != null && sev !== SEV.INFO) {
      findings.push({ sev, module: 'P&L Variance', title: `${label} — ${period}`, detail, action });
    }
    // Always add a summary note for key P&L lines even if INFO
    if (sev === SEV.INFO && ['ebitda','pat'].includes(key)) {
      findings.push({ sev: SEV.INFO, module: 'P&L Summary', title: `${label} in Line`, detail, action: null });
    }
  });

  return findings;
}

// ═════════════════════════════════════════════════════════════════════════
// MODULE 3 — REVENUE QUALITY
// Decline, below budget, margin erosion, concentration risk
// ═════════════════════════════════════════════════════════════════════════
function analyseModule3(data, monthIdx, ytd) {
  const A   = buildPL(data.actual,     monthIdx, ytd);
  const B   = buildPL(data.budget,     monthIdx, ytd);
  const P   = buildPL(data.prior_year, monthIdx, ytd);
  const findings = [];
  const period = ytd ? `YTD (Apr–${fyLabel(monthIdx)})` : fyLabel(monthIdx);

  const revVsBud = varPct(A.rev, B.rev);
  const revVsPY  = varPct(A.rev, P.rev);
  const gmAct    = A.rev > 0 ? A.gp / A.rev * 100 : null;
  const gmBud    = B.rev > 0 ? B.gp / B.rev * 100 : null;
  const gmPY     = P.rev > 0 ? P.gp / P.rev * 100 : null;

  // Revenue decline vs PY → RED
  if (revVsPY != null && revVsPY < -5) {
    findings.push({
      sev: SEV.RED,
      module: 'Revenue Quality',
      title: `Revenue Decline vs Prior Year (${pctStr(revVsPY)})`,
      detail: `Revenue of ₹${fmt(A.rev)}L for ${period} is ${pctStr(revVsPY)} below prior year (₹${fmt(P.rev)}L). This represents a loss of ₹${fmt(Math.abs(A.rev - P.rev))}L.`,
      action: 'Analyse client-wise revenue movement. Identify churned clients, reduced scope, or pricing pressure. Assess pipeline coverage for recovery.',
    });
  }

  // Below budget → AMBER
  if (revVsBud != null && revVsBud < -10) {
    findings.push({
      sev: SEV.AMBER,
      module: 'Revenue Quality',
      title: `Revenue Below Budget (${pctStr(revVsBud)})`,
      detail: `Revenue of ₹${fmt(A.rev)}L is ${pctStr(revVsBud)} below budget (₹${fmt(B.rev)}L) — a shortfall of ₹${fmt(Math.abs(A.rev - B.rev))}L for ${period}.`,
      action: 'Review sales pipeline. Check whether project delays, billing cycles, or client onboarding slippages are causing the shortfall.',
    });
  }

  // Revenue growth but margin decline → AMBER
  if (revVsPY != null && revVsPY > 0 && gmAct != null && gmPY != null && (gmAct - gmPY) < -3) {
    findings.push({
      sev: SEV.AMBER,
      module: 'Revenue Quality',
      title: `Revenue Growth with Gross Margin Erosion`,
      detail: `Revenue grew ${pctStr(revVsPY)} vs prior year, but Gross Margin declined from ${pctAbs(gmPY)} to ${pctAbs(gmAct)} — a compression of ${(gmPY - gmAct).toFixed(1)} percentage points. Growth appears to be coming at a cost.`,
      action: 'Identify which clients or service lines have lower margins. Review pricing strategy and direct cost composition for new vs existing work.',
    });
  }

  // Revenue in line with budget and growing → POSITIVE
  if (revVsBud != null && revVsBud >= -5 && revVsPY != null && revVsPY > 5) {
    findings.push({
      sev: SEV.POSITIVE,
      module: 'Revenue Quality',
      title: `Strong Revenue Performance`,
      detail: `Revenue of ₹${fmt(A.rev)}L is within budget (${pctStr(revVsBud)}) and up ${pctStr(revVsPY)} vs prior year — demonstrating healthy top-line momentum.`,
      action: null,
    });
  }

  // Gross margin assessment
  if (gmAct != null) {
    if (gmAct < 40) {
      findings.push({
        sev: SEV.RED,
        module: 'Revenue Quality',
        title: `Low Gross Margin (${pctAbs(gmAct)})`,
        detail: `Gross Margin of ${pctAbs(gmAct)} (₹${fmt(A.gp)}L on ₹${fmt(A.rev)}L revenue) is below the 40% warning threshold for professional services. Direct cost intensity is high.`,
        action: 'Conduct a direct cost audit. Review sub-contractor usage, material costs, and scope creep on fixed-fee engagements.',
      });
    } else if (gmAct < 55) {
      findings.push({
        sev: SEV.ADVISORY,
        module: 'Revenue Quality',
        title: `Gross Margin Below Target (${pctAbs(gmAct)})`,
        detail: `Gross Margin of ${pctAbs(gmAct)} is below the 55% target for professional services. Room for improvement through pricing or direct cost optimisation.`,
        action: 'Identify the top 3 direct cost items and assess reduction potential. Review client profitability at engagement level.',
      });
    } else {
      findings.push({
        sev: SEV.POSITIVE,
        module: 'Revenue Quality',
        title: `Healthy Gross Margin (${pctAbs(gmAct)})`,
        detail: `Gross Margin of ${pctAbs(gmAct)} (₹${fmt(A.gp)}L) is above the 55% threshold — the business retains strong value from revenue.`,
        action: null,
      });
    }
  }

  // EBITDA margin
  const ebitdaM = A.rev > 0 ? A.ebitda / A.rev * 100 : null;
  if (ebitdaM != null) {
    if (ebitdaM < 10) {
      findings.push({
        sev: SEV.RED,
        module: 'Revenue Quality',
        title: `EBITDA Margin Critically Low (${pctAbs(ebitdaM)})`,
        detail: `EBITDA of ₹${fmt(A.ebitda)}L represents only ${pctAbs(ebitdaM)} of revenue — insufficient to comfortably service debt, capex, and tax obligations.`,
        action: 'Immediate operating cost rationalisation required. Focus on the top two opex lines (Employee + Other Expenses) for short-term reduction.',
      });
    } else if (ebitdaM >= 25) {
      findings.push({
        sev: SEV.POSITIVE,
        module: 'Revenue Quality',
        title: `Strong EBITDA Margin (${pctAbs(ebitdaM)})`,
        detail: `EBITDA Margin of ${pctAbs(ebitdaM)} (₹${fmt(A.ebitda)}L) is healthy and provides good coverage for debt service, capex, and taxes.`,
        action: null,
      });
    }
  }

  return findings;
}

// ═════════════════════════════════════════════════════════════════════════
// MODULE 4 — RATIO CHANGE NARRATIVE
// Direction, reason, impact, action for each ratio vs prior month
// ═════════════════════════════════════════════════════════════════════════
function analyseModule4(data, monthIdx) {
  const curr = calcRatios(data, monthIdx);
  const prev = calcPrevRatios(data, monthIdx);
  const findings = [];

  const ratioMeta = [
    { key: 'currentRatio',  label: 'Current Ratio',   unit: 'x', higherBetter: true,  redBelow: 1.0,  ambBelow: 1.5  },
    { key: 'quickRatio',    label: 'Quick Ratio',      unit: 'x', higherBetter: true,  redBelow: 0.7,  ambBelow: 1.0  },
    { key: 'deRatio',       label: 'D/E Ratio',        unit: 'x', higherBetter: false, redAbove: 2.0,  ambAbove: 1.0  },
    { key: 'interestCover', label: 'Interest Cover',   unit: 'x', higherBetter: true,  redBelow: 1.5,  ambBelow: 3.0  },
    { key: 'grossMargin',   label: 'Gross Margin',     unit: '%', higherBetter: true,  redBelow: 40,   ambBelow: 55   },
    { key: 'ebitdaMargin',  label: 'EBITDA Margin',    unit: '%', higherBetter: true,  redBelow: 10,   ambBelow: 18   },
    { key: 'netMargin',     label: 'Net Margin',       unit: '%', higherBetter: true,  redBelow: 3,    ambBelow: 6    },
    { key: 'roe',           label: 'ROE (annualised)', unit: '%', higherBetter: true,  redBelow: 5,    ambBelow: 10   },
    { key: 'debtorDays',    label: 'Debtor Days (DSO)',unit: 'd', higherBetter: false, redAbove: 60,   ambAbove: 45   },
    { key: 'creditorDays',  label: 'Creditor Days (DPO)',unit:'d',higherBetter: true,  redBelow: 15,   ambBelow: 20   },
    { key: 'ccc',           label: 'Cash Conv. Cycle', unit: 'd', higherBetter: false, redAbove: 60,   ambAbove: 45   },
    { key: 'dscr',          label: 'DSCR',             unit: 'x', higherBetter: true,  redBelow: 1.25, ambBelow: 1.75 },
  ];

  ratioMeta.forEach(m => {
    const cVal = curr[m.key];
    const pVal = prev ? prev[m.key] : null;
    if (cVal == null || !isFinite(cVal)) return;

    // RAG for current value
    let rag;
    if (m.higherBetter) {
      rag = cVal >= (m.ambBelow || 999) ? 'GREEN'
          : cVal >= (m.redBelow || 0)   ? 'AMBER' : 'RED';
    } else {
      rag = cVal <= (m.ambAbove || 0)   ? 'GREEN'
          : cVal <= (m.redAbove || 999)  ? 'AMBER' : 'RED';
    }

    // Movement vs prior month
    let movement = '';
    if (pVal != null && isFinite(pVal)) {
      const delta = cVal - pVal;
      const improved = m.higherBetter ? delta > 0 : delta < 0;
      if (Math.abs(delta) > 0.01) {
        const dir = delta > 0 ? '▲' : '▼';
        movement = ` ${dir} ${Math.abs(delta).toFixed(m.unit === '%' ? 1 : 2)}${m.unit} vs prior month`;
        if (!improved && (rag === 'RED' || rag === 'AMBER')) {
          // Deteriorating ratio in red/amber zone → include as finding
          findings.push({
            sev: rag === 'RED' ? SEV.AMBER : SEV.ADVISORY,
            module: 'Ratio Trend',
            title: `${m.label} Deteriorating (${cVal.toFixed(m.unit === '%' || m.unit === 'd' ? 1 : 2)}${m.unit}${movement})`,
            detail: `${m.label} moved from ${pVal.toFixed(2)}${m.unit} to ${cVal.toFixed(2)}${m.unit} — a ${m.higherBetter ? 'decline' : 'increase'} of ${Math.abs(delta).toFixed(2)}${m.unit}. Current value is in the ${rag} zone.`,
            action: getRatioAction(m.key, rag, cVal),
          });
        }
      }
    }

    // Always include RED ratios as findings even without MoM comparison
    if (rag === 'RED' && !findings.find(f => f.title.includes(m.label))) {
      findings.push({
        sev: SEV.RED,
        module: 'Ratio Alert',
        title: `${m.label} in Red Zone (${cVal.toFixed(m.unit === 'd' ? 0 : 2)}${m.unit})`,
        detail: `${m.label} of ${cVal.toFixed(2)}${m.unit} is below/above the acceptable threshold — indicates ${getRatioRisk(m.key)}.`,
        action: getRatioAction(m.key, 'RED', cVal),
      });
    }
  });

  // Positive ratio summary
  const greenRatios = ratioMeta.filter(m => {
    const v = curr[m.key];
    if (v == null || !isFinite(v)) return false;
    if (m.higherBetter) return v >= (m.ambBelow || 999);
    return v <= (m.ambAbove || 0);
  });
  if (greenRatios.length >= 6) {
    findings.push({
      sev: SEV.POSITIVE,
      module: 'Ratio Summary',
      title: `${greenRatios.length} of ${ratioMeta.length} Ratios in Healthy Range`,
      detail: `Green ratios: ${greenRatios.map(m => m.label).join(', ')}.`,
      action: null,
    });
  }

  return findings;
}

function getRatioRisk(key) {
  const risks = {
    currentRatio:  'immediate liquidity pressure', quickRatio: 'inability to meet urgent payables without selling inventory',
    deRatio:       'high financial leverage and bankruptcy risk', interestCover: 'inability to service debt from earnings',
    grossMargin:   'insufficient value retention from revenue', ebitdaMargin: 'weak operating profitability',
    netMargin:     'thin bottom-line profitability', roe: 'poor return on shareholder equity',
    debtorDays:    'slow collections and cash flow strain', creditorDays: 'paying suppliers too quickly — lost float',
    ccc:           'long cash conversion cycle — capital locked in operations', dscr: 'inadequate coverage of debt repayment obligations',
  };
  return risks[key] || 'adverse financial condition';
}

function getRatioAction(key, rag, val) {
  const actions = {
    currentRatio:  'Accelerate debtor collections, reduce inventory holding, and avoid discretionary capex until ratio exceeds 1.5x.',
    quickRatio:    'Improve cash position through faster collections. Avoid over-reliance on inventory for liquidity.',
    deRatio:       'Channel operating cash flow to debt repayment. Avoid incremental borrowings. Target D/E below 1.0x over 18 months.',
    interestCover: 'Review loan book. Explore refinancing at lower rates. Focus on EBIT improvement through revenue growth and cost containment.',
    grossMargin:   'Audit direct costs at engagement level. Review sub-contractor and material costs. Consider selective price increases.',
    ebitdaMargin:  'Review the two largest opex line items (Employee + Other Expenses) for reduction opportunities. Evaluate fixed cost leverage.',
    netMargin:     'Review the full P&L — target EBITDA improvement of at least 3-5% to flow through to PAT.',
    roe:           'Improve PAT or reduce unproductive equity (retained earnings deployed in non-earning assets).',
    debtorDays:    'Implement collection escalation for accounts >30 days. Review credit terms for new clients. Consider TDS-adjusted billing.',
    creditorDays:  'Negotiate extended payment terms with key suppliers (target 30-45 days). Avoid early payment discounts unless rate is attractive.',
    ccc:           'Tackle both DSO (faster collections) and DPO (slower payments). A 15-day improvement in CCC can release 0.5x monthly revenue in cash.',
    dscr:          'Ensure EBITDA is sufficient to cover all debt service (principal + interest). Consider restructuring loan tenure to reduce monthly burden.',
  };
  return actions[key] || 'Investigate root cause and implement corrective measures.';
}

// ═════════════════════════════════════════════════════════════════════════
// MODULE 5 — WORKING CAPITAL CYCLE NARRATIVE
// CCC, DSO, DPO with qualitative commentary
// ═════════════════════════════════════════════════════════════════════════
function analyseModule5(data, monthIdx) {
  const r    = calcRatios(data, monthIdx);
  const prev = calcPrevRatios(data, monthIdx);
  const findings = [];

  const dso = r.debtorDays;
  const dpo = r.creditorDays;
  const ccc = r.ccc;

  if (dso == null || dpo == null || ccc == null) return findings;

  const prevDSO = prev?.debtorDays;
  const prevDPO = prev?.creditorDays;
  const prevCCC = prev?.ccc;

  // CCC summary finding
  const ccMoM = (prevCCC != null) ? (ccc - prevCCC) : null;
  const ccDir = ccMoM != null ? (ccMoM < 0 ? 'improved' : 'worsened') : '';
  findings.push({
    sev: ccc > 60 ? SEV.RED : ccc > 45 ? SEV.AMBER : SEV.POSITIVE,
    module: 'Working Capital',
    title: `Cash Conversion Cycle: ${Math.round(ccc)} Days${ccMoM != null ? ` (${ccDir} by ${Math.abs(ccMoM).toFixed(0)}d MoM)` : ''}`,
    detail: `DSO: ${Math.round(dso)}d | DPO: ${Math.round(dpo)}d | CCC: ${Math.round(ccc)}d. `
          + (ccc > 60 ? `A CCC above 60 days means significant working capital is tied up in operations. At current revenue levels, this represents approximately ₹${fmt(data.actual.revenue_ops[monthIdx] * ccc / 30, 0)}L of locked capital.`
          : ccc > 45 ? `CCC is in the watch zone. Targeted improvement of 10-15 days could free up ₹${fmt(data.actual.revenue_ops[monthIdx] * 15 / 30, 0)}L in working capital.`
          : `Healthy CCC indicates efficient working capital management.`),
    action: ccc > 45
      ? `Target: Reduce DSO by 7-10 days through stricter collections. Extend DPO by 5-7 days through supplier negotiations. Combined impact: ~₹${fmt(data.actual.revenue_ops[monthIdx] * 15 / 30, 0)}L of freed capital.`
      : null,
  });

  // DSO specific
  if (dso > 45) {
    findings.push({
      sev: dso > 60 ? SEV.RED : SEV.AMBER,
      module: 'Working Capital',
      title: `High Debtor Days — DSO ${Math.round(dso)} Days`,
      detail: `Debtors (₹${fmt(r._bs.trade_receivables)}L) are outstanding for an average of ${Math.round(dso)} days. This is above the 45-day threshold for professional services with standard 30-day terms. TDS recoveries may also be stuck in the system.`,
      action: 'Initiate a collection campaign for accounts >30 days. Review standard credit terms — consider moving to 21-day payment terms for new contracts.',
    });
  }

  // DPO specific
  if (dpo < 20) {
    findings.push({
      sev: SEV.ADVISORY,
      module: 'Working Capital',
      title: `Low Creditor Days — DPO ${Math.round(dpo)} Days (Paying Too Early)`,
      detail: `Trade Payables (₹${fmt(r._bs.trade_payables)}L) represent only ${Math.round(dpo)} days of purchases. The company is paying suppliers faster than optimal, losing the benefit of supplier credit float.`,
      action: 'Renegotiate supplier payment terms to 30-45 days. Retain cash in the business longer — this is an interest-free financing opportunity.',
    });
  } else if (dpo > 60) {
    findings.push({
      sev: SEV.AMBER,
      module: 'Working Capital',
      title: `High Creditor Days — DPO ${Math.round(dpo)} Days (Payable Stress Risk)`,
      detail: `DPO of ${Math.round(dpo)} days may indicate the company is delaying payments beyond agreed terms, which can damage supplier relationships and credit ratings.`,
      action: 'Review AP ledger for overdue payables. Prioritise critical suppliers. Develop a catch-up plan.',
    });
  }

  return findings;
}

// ═════════════════════════════════════════════════════════════════════════
// MASTER ANALYSER — runs all 5 modules and assembles the report
// ═════════════════════════════════════════════════════════════════════════
function runAnalysis(data, monthIdx, ytd) {
  const allFindings = [
    ...analyseModule1(data, monthIdx),
    ...analyseModule2(data, monthIdx, ytd),
    ...analyseModule3(data, monthIdx, ytd),
    ...analyseModule4(data, monthIdx),
    ...analyseModule5(data, monthIdx),
  ];

  // Group by severity
  const reds      = allFindings.filter(f => f.sev === SEV.RED);
  const ambers    = allFindings.filter(f => f.sev === SEV.AMBER);
  const advisories = allFindings.filter(f => f.sev === SEV.ADVISORY);
  const positives = allFindings.filter(f => f.sev === SEV.POSITIVE);
  const infos     = allFindings.filter(f => f.sev === SEV.INFO);

  // Executive summary
  const summaryLines = [];
  if (reds.length > 0)       summaryLines.push(`${reds.length} critical issue${reds.length > 1 ? 's' : ''} requiring immediate attention`);
  if (ambers.length > 0)     summaryLines.push(`${ambers.length} concern${ambers.length > 1 ? 's' : ''} to monitor`);
  if (advisories.length > 0) summaryLines.push(`${advisories.length} advisory item${advisories.length > 1 ? 's' : ''}`);
  if (positives.length > 0)  summaryLines.push(`${positives.length} positive indicator${positives.length > 1 ? 's' : ''}`);

  // Prioritised action plan
  const actionPlan = [...reds, ...ambers, ...advisories]
    .filter(f => f.action)
    .map((f, i) => ({ rank: i + 1, title: f.title, action: f.action, sev: f.sev }));

  return {
    monthIdx, ytd,
    period: ytd ? `YTD Apr–${fyLabel(monthIdx)}` : fyLabel(monthIdx),
    summary: summaryLines,
    reds, ambers, advisories, positives, infos,
    actionPlan,
    generatedAt: new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' }),
    all: allFindings,
  };
}
