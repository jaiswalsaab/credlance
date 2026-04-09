// ── Credlance MIS · Key Financial Ratios Engine ──────────────────────────────
// Phase 3 · Sparklines, Ratio Detail, Formula Explanations
// All ratios computed from financials.js (computeRatios, RATIO_META, ragStatus, fmtRatio)

'use strict';

// ── Sparkline Data Generator ──────────────────────────────────────────────────
// Returns last N months of ratio values (up to monthIdx, capped at 6)
function generateRatioHistory(data, monthIdx, months) {
  months = months || 6;
  const result = {};
  const startIdx = Math.max(0, monthIdx - months + 1);
  const labels = [];

  // Initialise arrays
  Object.keys(RATIO_META).forEach(k => { result[k] = []; });

  for (let i = startIdx; i <= monthIdx; i++) {
    labels.push(fyMonthLabel(i));
    const r = computeRatios(data, i);
    Object.keys(RATIO_META).forEach(k => {
      result[k].push(r[k]);
    });
  }
  result._labels = labels;
  return result;
}

// ── SVG Sparkline Renderer ────────────────────────────────────────────────────
// points: array of numbers (null-safe), rag: 'green'|'amber'|'red'|'grey'
// Returns inline SVG string (80×30)
function drawSparkline(points, rag, isHighGood) {
  const W = 80, H = 28, PAD = 2;

  const valid = points.filter(v => v != null && isFinite(v));
  if (valid.length < 2) {
    return `<svg width="${W}" height="${H}" style="opacity:.3"><text x="${W/2}" y="${H/2+4}" text-anchor="middle" font-size="9" fill="#64748b">—</text></svg>`;
  }

  let min = Math.min(...valid);
  let max = Math.max(...valid);
  if (min === max) { min = min * 0.95; max = max * 1.05; }
  const range = max - min || 1;

  const n = points.length;
  const xs = points.map((_, i) => PAD + (i / (n - 1)) * (W - 2 * PAD));
  const ys = points.map(v => {
    if (v == null || !isFinite(v)) return H / 2;
    // invert Y: higher value = lower Y coordinate (SVG top-left origin)
    return PAD + (1 - (v - min) / range) * (H - 2 * PAD);
  });

  // Colour by RAG
  const colorMap = { green: '#10b981', amber: '#f59e0b', red: '#ef4444', grey: '#64748b' };
  const stroke = colorMap[rag] || '#64748b';
  const fillId = `spk-${Math.random().toString(36).slice(2, 7)}`;

  // Build polyline points string
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');

  // Area fill path (under the sparkline)
  const areaPath = [
    `M ${xs[0].toFixed(1)},${ys[0].toFixed(1)}`,
    ...xs.slice(1).map((x, i) => `L ${x.toFixed(1)},${ys[i + 1].toFixed(1)}`),
    `L ${xs[n - 1].toFixed(1)},${H}`,
    `L ${xs[0].toFixed(1)},${H}`,
    'Z',
  ].join(' ');

  // Trend direction arrow for last segment
  const lastVal = points[n - 1];
  const prevVal = n >= 2 ? points[n - 2] : null;
  let trendIndicator = '';
  if (lastVal != null && prevVal != null && isFinite(lastVal) && isFinite(prevVal)) {
    const diff = lastVal - prevVal;
    if (Math.abs(diff) > 0.001) {
      const up = diff > 0;
      const goodUp = isHighGood ? up : !up;
      const arrowColor = goodUp ? '#10b981' : '#ef4444';
      const arrowChar = up ? '▲' : '▼';
      trendIndicator = `<text x="${W - 2}" y="${H - 1}" text-anchor="end" font-size="7" fill="${arrowColor}">${arrowChar}</text>`;
    }
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">
    <defs>
      <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${stroke}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#${fillId})"/>
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${xs[n-1].toFixed(1)}" cy="${ys[n-1].toFixed(1)}" r="2.5" fill="${stroke}"/>
    ${trendIndicator}
  </svg>`;
}

// ── Ratio Formula & Explanation Metadata ─────────────────────────────────────
const RATIO_DETAIL = {
  current_ratio: {
    formula: 'Current Assets ÷ Current Liabilities',
    what: 'Measures ability to cover short-term obligations with short-term assets.',
    good_sign: 'Above 1.5x — company can comfortably meet near-term dues.',
    bad_sign: 'Below 1.2x — liquidity stress; may struggle to pay suppliers/lenders on time.',
    action: {
      green: 'Monitor and maintain. Consider deploying excess liquidity productively.',
      amber: 'Review payment cycles. Consider renegotiating credit terms with suppliers.',
      red: 'Urgent: assess working capital gap. May need short-term credit line or accelerate collections.',
    },
  },
  quick_ratio: {
    formula: '(Trade Receivables + Cash) ÷ Current Liabilities',
    what: 'Stricter liquidity test — excludes inventory and other less-liquid assets.',
    good_sign: 'Above 1.0x — immediate obligations can be met without selling inventory.',
    bad_sign: 'Below 0.8x — cash squeeze likely; over-reliance on slow-moving assets.',
    action: {
      green: 'Healthy. Focus on maintaining DSO within targets.',
      amber: 'Speed up collections; delay non-critical discretionary spend.',
      red: 'Critical: review all outflows. Prioritise receivables collection immediately.',
    },
  },
  de_ratio: {
    formula: '(Long-term Borrowings + Short-term Borrowings) ÷ Total Equity',
    what: "Shows leverage — how much of the business is financed by debt vs. owners' funds.",
    good_sign: 'Below 1.5x — prudent leverage for Indian SMEs.',
    bad_sign: 'Above 2.5x — high dependence on debt; vulnerable to rate hikes and lender calls.',
    action: {
      green: 'Well-capitalised. Debt capacity exists for growth financing.',
      amber: 'Limit new borrowings. Focus on equity build-up through retained profits.',
      red: 'Deleverage plan required. Consider equity infusion or non-core asset disposal.',
    },
  },
  interest_cov: {
    formula: 'EBIT ÷ Finance Costs (annualised)',
    what: 'How many times operating profit covers interest expense.',
    good_sign: 'Above 3.0x — earnings comfortably service debt.',
    bad_sign: 'Below 1.5x — earnings barely cover interest; risk of default if profits dip.',
    action: {
      green: 'Strong debt servicing capacity.',
      amber: 'Avoid taking on incremental debt until EBIT improves.',
      red: 'Seek restructuring of high-cost debt. Evaluate renegotiation with lenders.',
    },
  },
  gross_margin: {
    formula: '(Revenue from Operations − Direct Costs) ÷ Revenue from Operations × 100',
    what: 'Profitability after direct costs (material/subcontracting) before overheads.',
    good_sign: 'Above 30% for professional-services firms — healthy pricing power.',
    bad_sign: 'Below 20% — pricing pressure or rising input costs are compressing margins.',
    action: {
      green: 'Maintain pricing discipline. Review direct cost contracts annually.',
      amber: 'Identify cost pass-through opportunities. Review low-margin clients.',
      red: 'Pricing renegotiation urgent. Audit direct cost line items for leakage.',
    },
  },
  ebitda_margin: {
    formula: '(Revenue + Other Income − Direct Costs − Employee Costs − Other Expenses) ÷ Total Income × 100',
    what: 'Operating profitability before interest, tax, depreciation — a true operating efficiency metric.',
    good_sign: 'Above 20% — strong operating model for Indian professional services.',
    bad_sign: 'Below 10% — overhead structure is too heavy relative to revenue.',
    action: {
      green: 'Robust operating margins. Scale revenue without proportional cost increase.',
      amber: 'Review overhead cost structure. Challenge discretionary spend.',
      red: 'Operational restructuring needed. Map every cost centre to revenue driver.',
    },
  },
  net_margin: {
    formula: 'PAT ÷ Total Income × 100',
    what: 'Bottom-line profitability after all costs and taxes.',
    good_sign: 'Above 12% — company is efficiently converting revenue to profit.',
    bad_sign: 'Below 6% — thin cushion; vulnerable to any revenue or cost shock.',
    action: {
      green: 'Good bottom-line health. Consider investing back for growth.',
      amber: 'Review tax efficiency and finance cost structure.',
      red: 'Profitability turnaround plan needed. Assess unprofitable cost centres.',
    },
  },
  roe: {
    formula: 'PAT (annualised) ÷ Total Equity × 100',
    what: 'Returns generated on shareholders\' investment.',
    good_sign: 'Above 15% — creating meaningful value for equity holders.',
    bad_sign: 'Below 8% — equity is not being deployed efficiently.',
    action: {
      green: 'Strong returns. Continue investing in profitable growth.',
      amber: 'Review asset allocation. Idle equity may need to be redeployed.',
      red: 'Capital allocation review required. Consider restructuring equity base.',
    },
  },
  roce: {
    formula: 'EBIT (annualised) ÷ (Equity + Long-term Borrowings) × 100',
    what: 'Returns on total capital deployed (equity + long-term debt).',
    good_sign: 'Above 12% — capital is earning above typical cost of capital.',
    bad_sign: 'Below 6% — business is creating value slower than cost of capital.',
    action: {
      green: 'Capital efficiency is strong. Maintain asset-light model.',
      amber: 'Identify and divest underperforming assets or divisions.',
      red: 'Strategic review required. ROCE below cost of capital destroys value.',
    },
  },
  asset_turnover: {
    formula: 'Revenue from Operations (annualised) ÷ Total Assets',
    what: 'Revenue generated per rupee of assets — a measure of asset efficiency.',
    good_sign: 'Above 1.0x — assets are being used productively.',
    bad_sign: 'Below 0.5x — significant underutilisation of assets.',
    action: {
      green: 'Efficient asset base. Look for further scaling opportunities.',
      amber: 'Review fixed asset utilisation rates.',
      red: 'Asset monetisation or redeployment strategy needed.',
    },
  },
  debtor_days: {
    formula: 'Trade Receivables ÷ (Revenue / 365)',
    what: 'Average days to collect payment from customers (DSO).',
    good_sign: 'Below 45 days — collections are timely.',
    bad_sign: 'Above 75 days — clients are stretching payment; cash locked in receivables.',
    action: {
      green: 'Good collection hygiene. Maintain invoice discipline.',
      amber: 'Issue payment reminders. Consider early-payment incentives.',
      red: 'Collections crisis. Escalate overdue accounts. Review credit policy.',
    },
  },
  creditor_days: {
    formula: 'Trade Payables ÷ (Direct Costs / 365)',
    what: 'Average days taken to pay suppliers (DPO).',
    good_sign: '30–60 days — balanced payment terms with suppliers.',
    bad_sign: 'Below 15 days — paying too quickly (free cash flow hit) or above 75 days — strain on supplier relationships.',
    action: {
      green: 'Balanced payable position. Negotiate minor extensions if cash-tight.',
      amber: 'Align payment terms with collections cycle.',
      red: 'Review supplier agreements. Avoid damaging key supplier relationships.',
    },
  },
  ccc: {
    formula: 'Debtor Days − Creditor Days (for services firm without inventory)',
    what: 'Cash Conversion Cycle — days from paying suppliers to collecting from customers. Lower is better.',
    good_sign: 'Below 30 days — cash is recycled quickly.',
    bad_sign: 'Above 60 days — working capital locked for long period.',
    action: {
      green: 'Efficient working capital cycle. Preserve this advantage.',
      amber: 'Focus on reducing DSO or modestly extending DPO.',
      red: 'Working capital crisis risk. Immediate receivables push and payables extension needed.',
    },
  },
  dscr: {
    formula: 'EBITDA (annualised) ÷ (Finance Costs + LT Loan Instalment)',
    what: 'Debt Service Coverage Ratio — measures ability to service all debt obligations from operating cash.',
    good_sign: 'Above 2.0x — strong debt servicing capacity; lenders comfortable.',
    bad_sign: 'Below 1.2x — barely servicing debt; covenant breach risk.',
    action: {
      green: 'Comfortable debt service. Eligible for growth financing.',
      amber: 'Maintain EBITDA levels. Avoid discretionary borrowings.',
      red: 'Covenant risk. Engage lenders proactively. Explore loan restructuring.',
    },
  },
};

// ── Build Ratio Card with Sparkline ──────────────────────────────────────────
// Generates enhanced HTML for a single ratio card including sparkline
function buildRatioCard(key, val, rag, sparkPoints, meta, detail) {
  const fmt   = fmtRatio(key, val);
  const spkSvg = drawSparkline(sparkPoints, rag, meta.isHighGood);

  let bench = '';
  if (meta.isHighGood) {
    bench = `Green ≥ ${meta.high[0]}${meta.unit} · Amber ≥ ${meta.high[1]}${meta.unit}`;
  } else {
    bench = `Green ≤ ${meta.high[0]}${meta.unit} · Amber ≤ ${meta.high[1]}${meta.unit}`;
  }

  return `<div class="ratio-card ${rag}" onclick="openRatioDetail('${key}')" style="cursor:pointer">
    <div class="rc-label">${meta.label}</div>
    <div class="rc-main-row">
      <div class="rc-val">${fmt}</div>
      <div class="rc-sparkline">${spkSvg}</div>
    </div>
    <div class="rc-bench"><span class="rag-dot ${rag}"></span>${bench}</div>
  </div>`;
}

// ── Ratio Detail Modal HTML ───────────────────────────────────────────────────
// Build the full detail modal markup (injected once into DOM)
function buildRatioDetailModal() {
  return `
  <div id="ratio-modal-overlay" onclick="closeRatioDetail(event)" style="
    display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;
    align-items:center;justify-content:center;padding:20px">
    <div id="ratio-modal" onclick="event.stopPropagation()" style="
      background:#111827;border:1px solid #1e293b;border-radius:14px;
      max-width:520px;width:100%;padding:28px;position:relative;
      max-height:85vh;overflow-y:auto">
      <button onclick="closeRatioDetail()" style="
        position:absolute;top:16px;right:16px;background:none;border:none;
        color:#64748b;font-size:20px;cursor:pointer;line-height:1">×</button>
      <div id="ratio-modal-content"></div>
    </div>
  </div>`;
}

// ── Populate and Open Ratio Detail Modal ──────────────────────────────────────
function openRatioDetail(key) {
  const ratios = computeRatios(window._RATIO_DATA || DATA, window._RATIO_MONTH_IDX || 0);
  const history = window._RATIO_HISTORY || {};
  const val  = ratios[key];
  const rag  = ragStatus(key, val);
  const meta = RATIO_META[key];
  const det  = RATIO_DETAIL[key] || {};
  const fmt  = fmtRatio(key, val);

  const colorMap = { green: '#10b981', amber: '#f59e0b', red: '#ef4444', grey: '#64748b' };
  const ragColor = colorMap[rag];
  const ragLabel = { green: '✅ Green — Within Target', amber: '🟡 Amber — Monitor Closely', red: '🔴 Red — Action Required', grey: '⚪ N/A' }[rag];

  // Build sparkline for modal (wider version)
  const sparkPts = (history[key] || []);
  const labels   = history._labels || [];
  const sparkSvg = buildDetailSparkline(sparkPts, rag, meta.isHighGood, labels);

  const actionText = (det.action && det.action[rag]) ? det.action[rag] : 'Monitor regularly.';
  const goodSign   = det.good_sign  || '—';
  const badSign    = det.bad_sign   || '—';

  const html = `
    <div style="margin-bottom:18px">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${meta.label}</div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="font-size:40px;font-weight:800;color:${ragColor}">${fmt}</div>
        <div style="padding:4px 12px;background:${ragColor}22;color:${ragColor};border-radius:20px;font-size:12px;font-weight:600;border:1px solid ${ragColor}44">${ragLabel}</div>
      </div>
    </div>

    <div style="background:#0b0f1a;border-radius:10px;padding:14px;margin-bottom:16px">
      ${sparkSvg}
      <div style="font-size:10px;color:#64748b;text-align:center;margin-top:6px">Last ${sparkPts.length} months trend</div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Formula</div>
      <div style="font-size:13px;color:#00d4aa;font-family:monospace;background:#0b0f1a;padding:8px 12px;border-radius:6px;border-left:3px solid #00d4aa44">${det.formula || '—'}</div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">What it measures</div>
      <div style="font-size:13px;color:#e2e8f0;line-height:1.5">${det.what || '—'}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:#10b98111;border:1px solid #10b98133;border-radius:8px;padding:12px">
        <div style="font-size:10px;color:#10b981;font-weight:700;margin-bottom:4px">✓ HEALTHY SIGN</div>
        <div style="font-size:12px;color:#e2e8f0;line-height:1.4">${goodSign}</div>
      </div>
      <div style="background:#ef444411;border:1px solid #ef444433;border-radius:8px;padding:12px">
        <div style="font-size:10px;color:#ef4444;font-weight:700;margin-bottom:4px">⚠ WARNING SIGN</div>
        <div style="font-size:12px;color:#e2e8f0;line-height:1.4">${badSign}</div>
      </div>
    </div>

    <div style="background:${ragColor}11;border:1px solid ${ragColor}33;border-radius:8px;padding:14px">
      <div style="font-size:10px;color:${ragColor};font-weight:700;margin-bottom:5px">📋 RECOMMENDED ACTION</div>
      <div style="font-size:13px;color:#e2e8f0;line-height:1.5">${actionText}</div>
    </div>

    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #1e293b;display:flex;justify-content:space-between;font-size:11px;color:#64748b">
      <span>Benchmark: ${meta.isHighGood ? '≥' : '≤'} ${meta.high[0]}${meta.unit} = Green · ${meta.isHighGood ? '≥' : '≤'} ${meta.high[1]}${meta.unit} = Amber</span>
      <span>Indian SME calibrated</span>
    </div>`;

  const modal = document.getElementById('ratio-modal-content');
  if (modal) {
    modal.innerHTML = html;
    document.getElementById('ratio-modal-overlay').style.display = 'flex';
  }
}

function closeRatioDetail(e) {
  if (e && e.target !== document.getElementById('ratio-modal-overlay')) return;
  const overlay = document.getElementById('ratio-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

// Wider sparkline for the detail modal (full width, taller)
function buildDetailSparkline(points, rag, isHighGood, labels) {
  const W = 460, H = 70, PAD = 4;

  const valid = points.filter(v => v != null && isFinite(v));
  if (valid.length < 2) {
    return `<svg width="100%" height="${H}" style="opacity:.3"><text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-size="12">Insufficient data</text></svg>`;
  }

  let min = Math.min(...valid);
  let max = Math.max(...valid);
  if (min === max) { min = min * 0.95; max = max * 1.05; }
  const range = max - min || 1;

  const n = points.length;
  const xs = points.map((_, i) => PAD + (i / (n - 1)) * (W - 2 * PAD));
  const ys = points.map(v => {
    if (v == null || !isFinite(v)) return H / 2;
    return PAD + (1 - (v - min) / range) * (H - 2 * PAD - 18); // leave space for labels
  });

  const colorMap = { green: '#10b981', amber: '#f59e0b', red: '#ef4444', grey: '#64748b' };
  const stroke = colorMap[rag] || '#64748b';
  const fillId = `dspk-${Math.random().toString(36).slice(2, 7)}`;

  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const areaPath = [
    `M ${xs[0].toFixed(1)},${ys[0].toFixed(1)}`,
    ...xs.slice(1).map((x, i) => `L ${x.toFixed(1)},${ys[i + 1].toFixed(1)}`),
    `L ${xs[n - 1].toFixed(1)},${H - 18}`,
    `L ${xs[0].toFixed(1)},${H - 18}`,
    'Z',
  ].join(' ');

  // Dot + value labels
  const dots = xs.map((x, i) => {
    const y = ys[i];
    const v = points[i];
    const label = v != null && isFinite(v) ? fmtRatio(Object.keys(RATIO_META).find(k => true), v) : '—';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${stroke}"/>`;
  }).join('');

  // Month labels at bottom
  const monthLabels = xs.map((x, i) => {
    const lbl = labels[i] || `M${i+1}`;
    return `<text x="${x.toFixed(1)}" y="${H - 2}" text-anchor="middle" font-size="9" fill="#64748b">${lbl}</text>`;
  }).join('');

  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">
    <defs>
      <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${stroke}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#${fillId})"/>
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${monthLabels}
  </svg>`;
}

// ── Enhanced Ratio Renderer ───────────────────────────────────────────────────
// Drop-in replacement for renderRatios() in financials.html
// Requires _RATIO_DATA, _RATIO_MONTH_IDX, _RATIO_HISTORY to be set on window
function renderRatiosEnhanced(monthIdx) {
  const data    = window._RATIO_DATA || (typeof DATA !== 'undefined' ? DATA : null);
  if (!data) return;

  window._RATIO_MONTH_IDX = monthIdx;
  window._RATIO_DATA      = data;

  const history = generateRatioHistory(data, monthIdx, 6);
  window._RATIO_HISTORY   = history;

  const ratios  = computeRatios(data, monthIdx);
  const grid    = document.getElementById('ratios-grid');
  if (!grid) return;

  const cards = Object.entries(RATIO_META).map(([key, meta]) => {
    const val        = ratios[key];
    const rag        = ragStatus(key, val);
    const sparkPts   = history[key] || [];
    return buildRatioCard(key, val, rag, sparkPts, meta, RATIO_DETAIL[key]);
  });

  grid.innerHTML = cards.join('');

  // Ensure modal is injected
  if (!document.getElementById('ratio-modal-overlay')) {
    document.body.insertAdjacentHTML('beforeend', buildRatioDetailModal());
  }
}

// ── Ratio Summary Stats ───────────────────────────────────────────────────────
// Returns {green, amber, red, grey} counts for dashboard tiles
function ratioSummaryStats(monthIdx) {
  const data   = window._RATIO_DATA || (typeof DATA !== 'undefined' ? DATA : null);
  if (!data) return { green: 0, amber: 0, red: 0, grey: 0 };
  const ratios = computeRatios(data, monthIdx);
  const counts = { green: 0, amber: 0, red: 0, grey: 0 };
  Object.keys(RATIO_META).forEach(k => {
    const rag = ragStatus(k, ratios[k]);
    counts[rag] = (counts[rag] || 0) + 1;
  });
  return counts;
}
