// ── Credlance MIS · Financial Statement Engine ──────────────────────────────
// P&L (Ind AS Schedule III) · Balance Sheet · Cash Flow (Indirect Method)
// Phase 2 · FY 2025-26 · All figures in ₹ Lakhs

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const FY_MONTHS     = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const CURR_FY_LABEL = '2025-26';
const PREV_FY_LABEL = '2024-25';

function fyMonthLabel(i) {
  return FY_MONTHS[i] + '-' + (i >= 9 ? '26' : '25');
}

// ── Number Formatting ─────────────────────────────────────────────────────
function inr(val, dec = 2) {
  if (val == null || isNaN(val)) return '—';
  const abs   = Math.abs(val);
  const str   = abs.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return val < 0 ? `(${str})` : str;
}

function pctFmt(val) {
  if (val == null || !isFinite(val)) return '—';
  return (val > 0 ? '+' : '') + val.toFixed(1) + '%';
}

function varPct(actual, base) {
  if (!base || base === 0) return null;
  return ((actual - base) / Math.abs(base)) * 100;
}

// Variance CSS class: for income items positive = good, for expense items negative = good
function varClass(val, isExpense) {
  if (val == null || !isFinite(val)) return '';
  const good = isExpense ? val < 0 : val > 0;
  return good ? 'good' : 'bad';
}

// Trend arrow based on month-over-month direction (income items: higher = up good)
function trendArrow(currVal, prevVal, isExpense) {
  if (currVal == null || prevVal == null) return '';
  const diff = currVal - prevVal;
  if (Math.abs(diff) < 0.01) return '<span class="trend-flat">→</span>';
  const good = isExpense ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? '↑' : '↓';
  return `<span class="trend-${good ? 'good' : 'bad'}">${arrow}</span>`;
}

// ── Demo Data ─────────────────────────────────────────────────────────────
// Realistic figures for a mid-size Indian professional-services firm
// FY 2025-26: April 2025 – March 2026 | all values in ₹ Lakhs
function generateDemoData() {

  const A = {   // Actuals (FY 2025-26)
    revenue_ops:    [42.0, 45.0, 48.0, 46.0, 52.0, 56.0, 54.0, 58.0, 62.0, 65.0, 68.0, 72.0],
    other_income:   [1.20, 0.80, 1.00, 1.50, 0.90, 1.10, 1.30, 0.70, 1.40, 0.80, 1.20, 1.50],
    direct_costs:   [12.6, 13.5, 14.4, 13.8, 15.6, 16.8, 16.2, 17.4, 18.6, 19.5, 20.4, 21.6],
    employee_costs: [10.5, 10.5, 11.0, 11.0, 11.5, 11.5, 12.0, 12.0, 12.5, 12.5, 13.0, 13.0],
    finance_costs:  [1.20, 1.20, 1.20, 1.10, 1.10, 1.10, 1.00, 1.00, 1.00, 0.90, 0.90, 0.90],
    depreciation:   [1.50, 1.50, 1.50, 1.50, 1.50, 1.60, 1.60, 1.60, 1.60, 1.60, 1.70, 1.70],
    other_expenses: [5.00, 5.20, 5.50, 5.30, 5.80, 6.20, 6.00, 6.40, 6.80, 7.00, 7.20, 7.50],
    current_tax:    [2.80, 3.10, 3.40, 3.20, 3.80, 4.20, 4.00, 4.40, 4.80, 5.00, 5.30, 5.70],
    deferred_tax:   [0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10],
  };

  const B = {   // Budget (FY 2025-26)
    revenue_ops:    [45.0, 48.0, 50.0, 50.0, 55.0, 60.0, 58.0, 62.0, 65.0, 68.0, 70.0, 75.0],
    other_income:   [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    direct_costs:   [13.5, 14.4, 15.0, 15.0, 16.5, 18.0, 17.4, 18.6, 19.5, 20.4, 21.0, 22.5],
    employee_costs: [10.5, 10.5, 10.5, 10.5, 11.0, 11.0, 11.5, 11.5, 12.0, 12.0, 12.5, 12.5],
    finance_costs:  [1.20, 1.20, 1.20, 1.20, 1.10, 1.10, 1.00, 1.00, 1.00, 1.00, 0.90, 0.90],
    depreciation:   [1.50, 1.50, 1.50, 1.50, 1.50, 1.60, 1.60, 1.60, 1.60, 1.60, 1.70, 1.70],
    other_expenses: [5.50, 5.70, 5.80, 5.80, 6.20, 6.60, 6.50, 6.80, 7.00, 7.20, 7.40, 7.80],
    current_tax:    [3.10, 3.40, 3.50, 3.50, 4.00, 4.50, 4.30, 4.70, 5.00, 5.20, 5.50, 5.80],
    deferred_tax:   [0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10],
  };

  const P = {   // Prior Year Actuals (FY 2024-25)
    revenue_ops:    [36.0, 39.0, 42.0, 40.0, 45.0, 49.0, 47.0, 51.0, 54.0, 57.0, 59.0, 63.0],
    other_income:   [0.80, 0.60, 0.90, 0.70, 0.80, 1.00, 0.90, 0.80, 1.10, 0.70, 1.00, 1.20],
    direct_costs:   [11.2, 12.1, 13.0, 12.4, 14.0, 15.2, 14.6, 15.8, 16.7, 17.7, 18.3, 19.5],
    employee_costs: [9.50, 9.50, 9.80, 9.80, 10.0, 10.0, 10.5, 10.5, 11.0, 11.0, 11.5, 11.5],
    finance_costs:  [1.50, 1.50, 1.50, 1.40, 1.40, 1.40, 1.30, 1.30, 1.20, 1.20, 1.10, 1.10],
    depreciation:   [1.40, 1.40, 1.40, 1.40, 1.40, 1.50, 1.50, 1.50, 1.50, 1.50, 1.50, 1.50],
    other_expenses: [4.50, 4.70, 5.00, 4.80, 5.20, 5.60, 5.40, 5.80, 6.10, 6.30, 6.50, 6.80],
    current_tax:    [2.30, 2.50, 2.70, 2.60, 3.00, 3.30, 3.10, 3.50, 3.70, 4.00, 4.10, 4.50],
    deferred_tax:   [0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10],
  };

  // Compute monthly PAT for each dataset
  function derivePAT(d) {
    return d.revenue_ops.map((_, i) => {
      const inc = d.revenue_ops[i] + d.other_income[i];
      const exp = d.direct_costs[i] + d.employee_costs[i] + d.finance_costs[i]
                + d.depreciation[i] + d.other_expenses[i];
      const pbt = inc - exp;
      return pbt - d.current_tax[i] - d.deferred_tax[i];
    });
  }
  A.pat_arr = derivePAT(A);
  B.pat_arr = derivePAT(B);
  P.pat_arr = derivePAT(P);

  // ── Opening Balance Sheet (March 31, 2025) in ₹ Lakhs ──
  const OPENING = {
    share_capital:        100.0,
    retained_earnings:    450.0,
    lt_borrowings:        120.0,
    dt_liability:          15.0,
    st_borrowings:         80.0,
    trade_payables:        55.0,
    other_cl:              30.0,
    provisions:            10.0,
    net_fixed_assets:     280.0,
    lt_investments:        60.0,
    trade_receivables:    180.0,
    cash:                  90.0,
    other_current_assets: 250.0,
  };

  // ── Build month-end Balance Sheets ──
  const bsMonths = [];
  let re  = OPENING.retained_earnings;
  let nfa = OPENING.net_fixed_assets;
  let ltb = OPENING.lt_borrowings;
  let stb = OPENING.st_borrowings;

  for (let i = 0; i < 12; i++) {
    re  += A.pat_arr[i];
    nfa -= A.depreciation[i];
    ltb  = Math.max(0, ltb - 1.5);   // scheduled LT repayment 1.5L/month
    stb  = Math.max(0, stb - 0.8);   // scheduled ST reduction

    const tp   = +(A.direct_costs[i] * 0.55).toFixed(2);       // ~16-day DPO
    const tr   = +(A.revenue_ops[i] * 1.10).toFixed(2);         // ~33-day DSO
    const oca  = +(OPENING.other_current_assets * (1 - i * 0.008)).toFixed(2);

    const total_equity = OPENING.share_capital + re;
    const total_ncl    = ltb + OPENING.dt_liability;
    const total_cl     = stb + tp + OPENING.other_cl + OPENING.provisions;
    const total_le     = total_equity + total_ncl + total_cl;

    const non_cash     = nfa + OPENING.lt_investments + tr + oca;
    const cash         = Math.max(5, +(total_le - non_cash).toFixed(2));

    bsMonths.push({
      share_capital: OPENING.share_capital, retained_earnings: re,
      lt_borrowings: ltb, dt_liability: OPENING.dt_liability,
      st_borrowings: stb, trade_payables: tp,
      other_cl: OPENING.other_cl, provisions: OPENING.provisions,
      net_fixed_assets: nfa, lt_investments: OPENING.lt_investments,
      trade_receivables: tr, cash, other_current_assets: oca,
    });
  }

  return { actual: A, budget: B, prior_year: P, bs: bsMonths, opening_bs: OPENING };
}

// ── Data Loading ──────────────────────────────────────────────────────────
function loadFinancialData() {
  const client = sessionStorage.getItem('credlance_client')
              || localStorage.getItem('credlance_active_client') || '';

  if (!client) {
    const d = generateDemoData(); d._mode = 'demo'; return d;
  }

  const tbRaw  = localStorage.getItem(`credlance_data_${client}_trial_balance`);
  const budRaw = localStorage.getItem(`credlance_data_${client}_budget`);

  if (!tbRaw) {
    const d = generateDemoData(); d._mode = 'demo'; return d;
  }

  try {
    // Tracer-based mapping stub — will be extended in a later version
    const d = generateDemoData();
    d._mode = 'demo_with_data';
    d._clientNote = 'Data uploaded. Tracer-based TB mapping will be wired in Phase 8.';
    return d;
  } catch (e) {
    const d = generateDemoData(); d._mode = 'demo'; return d;
  }
}

// ── P&L Computation ───────────────────────────────────────────────────────
function computePL(data, monthIdx, ytd) {
  function slice(arr) {
    if (!arr) return 0;
    return ytd
      ? arr.slice(0, monthIdx + 1).reduce((s, v) => s + (v || 0), 0)
      : (arr[monthIdx] || 0);
  }

  function build(d) {
    const revenue_ops    = slice(d.revenue_ops);
    const other_income   = slice(d.other_income);
    const total_income   = revenue_ops + other_income;
    const direct_costs   = slice(d.direct_costs);
    const employee_costs = slice(d.employee_costs);
    const finance_costs  = slice(d.finance_costs);
    const depreciation   = slice(d.depreciation);
    const other_expenses = slice(d.other_expenses);
    const total_expenses = direct_costs + employee_costs + finance_costs + depreciation + other_expenses;
    const gross_profit   = revenue_ops - direct_costs;
    const gross_margin   = revenue_ops ? (gross_profit / revenue_ops) * 100 : 0;
    const ebitda         = total_income - direct_costs - employee_costs - other_expenses;
    const ebitda_margin  = total_income ? (ebitda / total_income) * 100 : 0;
    const ebit           = ebitda - depreciation;
    const pbt            = total_income - total_expenses;
    const current_tax    = slice(d.current_tax);
    const deferred_tax   = slice(d.deferred_tax);
    const total_tax      = current_tax + deferred_tax;
    const pat            = pbt - total_tax;
    const pat_margin     = total_income ? (pat / total_income) * 100 : 0;
    return {
      revenue_ops, other_income, total_income,
      direct_costs, employee_costs, finance_costs, depreciation, other_expenses,
      total_expenses, gross_profit, gross_margin,
      ebitda, ebitda_margin, ebit, pbt,
      current_tax, deferred_tax, total_tax, pat, pat_margin,
    };
  }

  return { actual: build(data.actual), budget: build(data.budget), py: build(data.prior_year) };
}

// ── Balance Sheet Computation ─────────────────────────────────────────────
function computeBS(data, monthIdx) {
  function expand(bs) {
    const total_equity = bs.share_capital + bs.retained_earnings;
    const total_ncl    = bs.lt_borrowings + bs.dt_liability;
    const total_cl     = bs.st_borrowings + bs.trade_payables + bs.other_cl + bs.provisions;
    const total_nca    = bs.net_fixed_assets + bs.lt_investments;
    const total_ca     = bs.trade_receivables + bs.cash + bs.other_current_assets;
    return {
      ...bs, total_equity, total_ncl, total_cl,
      total_le: total_equity + total_ncl + total_cl,
      total_nca, total_ca,
      total_assets: total_nca + total_ca,
    };
  }

  const curr = expand(data.bs[monthIdx]);
  const prevRaw = monthIdx > 0 ? data.bs[monthIdx - 1] : data.opening_bs;
  const prev = expand(prevRaw);

  // ── Balance Sheet integrity check ──────────────────────────────────────
  // Assets must equal Liabilities + Equity (Schedule III identity)
  const _bsCheck = {
    assetsTotal:     +curr.total_assets.toFixed(2),
    liabEquityTotal: +curr.total_le.toFixed(2),
    delta:           +(curr.total_assets - curr.total_le).toFixed(2),
    balanced:        Math.abs(curr.total_assets - curr.total_le) < 0.05,
  };

  return { curr, prev, _bsCheck };
}

// ── Cash Flow Computation (Indirect Method) ───────────────────────────────
function computeCF(data, monthIdx, ytd) {
  function slice(arr) {
    if (!arr) return 0;
    return ytd
      ? arr.slice(0, monthIdx + 1).reduce((s, v) => s + (v || 0), 0)
      : (arr[monthIdx] || 0);
  }

  const A   = data.actual;
  const obs = data.opening_bs;
  const bs  = data.bs;

  // P&L items
  const revenue_ops    = slice(A.revenue_ops);
  const other_income   = slice(A.other_income);
  const direct_costs   = slice(A.direct_costs);
  const employee_costs = slice(A.employee_costs);
  const finance_costs  = slice(A.finance_costs);
  const depreciation   = slice(A.depreciation);
  const other_expenses = slice(A.other_expenses);
  const current_tax    = slice(A.current_tax);
  const deferred_tax   = slice(A.deferred_tax);
  const total_income   = revenue_ops + other_income;
  const total_exp      = direct_costs + employee_costs + finance_costs + depreciation + other_expenses;
  const pbt            = total_income - total_exp;
  const pat            = pbt - current_tax - deferred_tax;

  // Working capital changes
  const startBS = ytd ? obs : (monthIdx > 0 ? bs[monthIdx - 1] : obs);
  const endBS   = bs[monthIdx];

  const delta_ar  = -(endBS.trade_receivables - startBS.trade_receivables);
  const delta_oca = -(endBS.other_current_assets - startBS.other_current_assets);
  const delta_tp  =   endBS.trade_payables - startBS.trade_payables;
  const delta_ocl =   endBS.other_cl - startBS.other_cl;

  const cash_from_ops_pre_tax = pbt + depreciation + finance_costs
                               + delta_ar + delta_oca + delta_tp + delta_ocl;
  const taxes_paid     = current_tax;
  const net_cash_ops   = cash_from_ops_pre_tax - taxes_paid;

  // Investing (demo: nil capex)
  const capex          = 0;
  const asset_disposal = 0;
  const invest_change  = 0;
  const net_cash_inv   = -(capex) + asset_disposal + invest_change;

  // Financing
  const ltb_start      = ytd ? obs.lt_borrowings : startBS.lt_borrowings;
  const ltb_end        = endBS.lt_borrowings;
  const stb_start      = ytd ? obs.st_borrowings : startBS.st_borrowings;
  const stb_end        = endBS.st_borrowings;

  const ltb_repayment  = ltb_start - ltb_end;    // positive = repaid
  const stb_change     = stb_end - stb_start;     // negative = repaid
  const fin_costs_paid = -finance_costs;
  const net_cash_fin   = -ltb_repayment + stb_change + fin_costs_paid;

  const net_change     = net_cash_ops + net_cash_inv + net_cash_fin;
  const opening_cash   = ytd ? obs.cash : startBS.cash;
  const closing_cash   = endBS.cash;  // use actual BS cash

  return {
    pbt, pat, depreciation, finance_costs, deferred_tax,
    delta_ar, delta_oca, delta_tp, delta_ocl,
    cash_from_ops_pre_tax, taxes_paid, net_cash_ops,
    capex, asset_disposal, invest_change, net_cash_inv,
    ltb_repayment, stb_change, fin_costs_paid, net_cash_fin,
    net_change, opening_cash, closing_cash,
  };
}

// ── Key Financial Ratios ──────────────────────────────────────────────────
// (Phase 3 prep — called by financials.html ratios section)
function computeRatios(data, monthIdx) {
  const bs    = computeBS(data, monthIdx);
  const pl    = computePL(data, monthIdx, false);   // single-month P&L
  const plYTD = computePL(data, monthIdx, true);    // YTD P&L for annualisation

  const c  = bs.curr;
  const A  = pl.actual;
  const AY = plYTD.actual;

  // Annualise YTD figures (multiply by 12/(months elapsed))
  const months = monthIdx + 1;
  const annFactor = 12 / months;
  const annRev    = AY.revenue_ops    * annFactor;
  const annEBITDA = AY.ebitda         * annFactor;
  const annEBIT   = AY.ebit           * annFactor;
  const annPAT    = AY.pat            * annFactor;
  const annFinCst = AY.finance_costs  * annFactor;
  const annDep    = AY.depreciation   * annFactor;

  const current_ratio    = c.total_cl     ? c.total_ca / c.total_cl            : null;
  const quick_ratio      = c.total_cl     ? (c.trade_receivables + c.cash) / c.total_cl : null;
  const de_ratio         = c.total_equity ? (c.lt_borrowings + c.st_borrowings) / c.total_equity : null;
  const interest_cov     = annFinCst      ? annEBIT / annFinCst                : null;
  const gross_margin     = AY.revenue_ops ? (AY.gross_profit / AY.revenue_ops) * 100 : null;
  const ebitda_margin    = AY.total_income? (AY.ebitda / AY.total_income) * 100: null;
  const net_margin       = AY.total_income? (AY.pat / AY.total_income) * 100   : null;
  const roe              = c.total_equity ? (annPAT / c.total_equity) * 100    : null;
  const roce             = (c.total_equity + c.lt_borrowings)
                           ? (annEBIT / (c.total_equity + c.lt_borrowings)) * 100 : null;
  const asset_turnover   = c.total_assets ? annRev / c.total_assets            : null;
  const debtor_days      = annRev / 365   ? (c.trade_receivables / (annRev / 365)) : null;
  const creditor_days    = AY.direct_costs * annFactor / 365
                           ? (c.trade_payables / (AY.direct_costs * annFactor / 365)) : null;
  const inventory_days   = 0; // services company — no inventory
  const ccc              = debtor_days != null && creditor_days != null
                           ? debtor_days - creditor_days : null;
  const dscr             = (annFinCst + (c.lt_borrowings / 5)) // assume 5-yr tenor
                           ? (annEBITDA / (annFinCst + (c.lt_borrowings / 5))) : null;

  return {
    current_ratio, quick_ratio, de_ratio, interest_cov,
    gross_margin, ebitda_margin, net_margin,
    roe, roce, asset_turnover,
    debtor_days, creditor_days, inventory_days, ccc, dscr,
  };
}

// RAG thresholds for Indian SMEs
const RATIO_META = {
  current_ratio:   { label: 'Current Ratio',           unit: 'x',  high: [1.5, 1.2], isHighGood: true },
  quick_ratio:     { label: 'Quick Ratio',              unit: 'x',  high: [1.0, 0.8], isHighGood: true },
  de_ratio:        { label: 'Debt / Equity',            unit: 'x',  high: [1.5, 2.5], isHighGood: false },
  interest_cov:    { label: 'Interest Coverage',        unit: 'x',  high: [3.0, 1.5], isHighGood: true },
  gross_margin:    { label: 'Gross Margin',             unit: '%',  high: [30, 20],   isHighGood: true },
  ebitda_margin:   { label: 'EBITDA Margin',            unit: '%',  high: [20, 10],   isHighGood: true },
  net_margin:      { label: 'Net Profit Margin',        unit: '%',  high: [12, 6],    isHighGood: true },
  roe:             { label: 'Return on Equity',         unit: '%',  high: [15, 8],    isHighGood: true },
  roce:            { label: 'Return on Cap. Employed',  unit: '%',  high: [12, 6],    isHighGood: true },
  asset_turnover:  { label: 'Asset Turnover',           unit: 'x',  high: [1.0, 0.5], isHighGood: true },
  debtor_days:     { label: 'Debtor Days (DSO)',        unit: 'd',  high: [45, 75],   isHighGood: false },
  creditor_days:   { label: 'Creditor Days (DPO)',      unit: 'd',  high: [30, 60],   isHighGood: true },
  ccc:             { label: 'Cash Conversion Cycle',    unit: 'd',  high: [30, 60],   isHighGood: false },
  dscr:            { label: 'Debt Service Coverage',    unit: 'x',  high: [2.0, 1.2], isHighGood: true },
};

function ragStatus(key, val) {
  if (val == null || !isFinite(val)) return 'grey';
  const m = RATIO_META[key];
  if (!m) return 'grey';
  const [g, a] = m.high;   // green threshold, amber threshold
  if (m.isHighGood) {
    return val >= g ? 'green' : val >= a ? 'amber' : 'red';
  } else {
    return val <= g ? 'green' : val <= a ? 'amber' : 'red';
  }
}

function fmtRatio(key, val) {
  if (val == null || !isFinite(val)) return '—';
  const m = RATIO_META[key];
  if (!m) return val.toFixed(2);
  if (m.unit === '%') return val.toFixed(1) + '%';
  if (m.unit === 'd') return Math.round(val) + ' d';
  return val.toFixed(2) + 'x';
}
