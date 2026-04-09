// ── Credlance MIS · Report Exporter ──────────────────────────────────────
// Generates a printable, self-contained HTML report with Credlance branding
// Phase 7 · Called by analyzer.html → exportReport() → generateHTMLReport()

'use strict';

function generateHTMLReport(report, data) {
  const FY_M = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
  function fyL(i) { return FY_M[i] + '-' + (i >= 9 ? '26' : '25'); }

  // ── P&L snapshot for the report header ────────────────────────────────
  function buildPLSnap(d, i, ytd) {
    function s(arr) {
      return ytd ? arr.slice(0, i+1).reduce((a,v)=>a+(v||0),0) : (arr[i]||0);
    }
    const rev = s(d.revenue_ops); const dc = s(d.direct_costs);
    const ec  = s(d.employee_costs); const oe = s(d.other_expenses);
    const fc  = s(d.finance_costs); const dep = s(d.depreciation);
    const oth = s(d.other_income);
    const ct  = s(d.current_tax); const dft = s(d.deferred_tax);
    const gp  = rev - dc; const ebitda = gp - ec - oe;
    const ebit = ebitda - dep; const pbt = ebit - fc + oth;
    const pat  = pbt - ct - dft;
    return { rev, gp, ebitda, pat,
      gmP: rev>0?gp/rev*100:null, emP: rev>0?ebitda/rev*100:null, nmP: rev>0?pat/rev*100:null };
  }

  function inrF(v, d=1) {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v);
    const s = a.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (v < 0 ? '(' : '') + '₹' + s + 'L' + (v < 0 ? ')' : '');
  }
  function pF(v) { if (v == null || !isFinite(v)) return '—'; return v.toFixed(1) + '%'; }

  const snap = buildPLSnap(data.actual, report.monthIdx, report.ytd);
  const client = sessionStorage?.getItem('credlance_client')
              || localStorage?.getItem('credlance_active_client') || 'Demo Client';

  // ── Severity helpers for report ────────────────────────────────────────
  function sevLabel(sev) {
    return ['🔴 Red Flag','🟠 Concern','🟡 Advisory','✅ Positive','📋 Note'][sev] || '📋 Note';
  }
  function sevColor(sev) {
    return ['#ef4444','#f59e0b','#fb923c','#22c55e','#6b7280'][sev] || '#6b7280';
  }
  function sevBg(sev) {
    return ['rgba(239,68,68,.08)','rgba(245,158,11,.08)','rgba(251,146,60,.06)','rgba(34,197,94,.06)','rgba(107,114,128,.05)'][sev] || 'transparent';
  }

  // ── Build findings HTML ────────────────────────────────────────────────
  function findingsHTML(findings, title, icon) {
    if (!findings.length) return '';
    const items = findings.map(f => `
      <div style="margin-bottom:14px;border-radius:8px;border:1px solid ${sevColor(f.sev)}33;background:${sevBg(f.sev)};padding:14px 16px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font-size:11px;font-weight:700;color:${sevColor(f.sev)};background:${sevColor(f.sev)}22;padding:2px 8px;border-radius:4px">${sevLabel(f.sev)}</span>
          <span style="font-size:12px;color:#888;background:#1a2233;padding:2px 7px;border-radius:3px">${f.module}</span>
        </div>
        <div style="font-size:14px;font-weight:600;color:#e2e8f0;margin-bottom:6px">${f.title}</div>
        <div style="font-size:13px;color:#9ca3af;line-height:1.7;margin-bottom:${f.action ? '10px' : '0'}">${f.detail}</div>
        ${f.action ? `<div style="border-left:3px solid #00d4aa;padding:8px 12px;background:#111827;border-radius:0 5px 5px 0;font-size:12px;color:#e2e8f0;line-height:1.6"><strong style="color:#00d4aa">💡 Action: </strong>${f.action}</div>` : ''}
      </div>
    `).join('');
    return `
      <div style="margin-bottom:22px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1f2d45">
          <h2 style="font-size:15px;font-weight:700;color:#e2e8f0">${icon} ${title}</h2>
          <span style="font-size:11px;color:#6b7280;background:#1a2233;border-radius:20px;padding:2px 9px">${findings.length}</span>
        </div>
        ${items}
      </div>
    `;
  }

  // ── Action plan table ──────────────────────────────────────────────────
  function actionPlanHTML(plan) {
    if (!plan.length) return '';
    const rows = plan.slice(0, 10).map((item, i) => {
      const c = sevColor(item.sev);
      return `<tr style="border-bottom:1px solid #1f2d45">
        <td style="padding:10px 12px;text-align:center">
          <span style="width:26px;height:26px;border-radius:50%;background:${c}22;color:${c};font-weight:700;font-size:12px;display:inline-flex;align-items:center;justify-content:center">${i+1}</span>
        </td>
        <td style="padding:10px 12px;font-weight:600;color:#e2e8f0;font-size:13px">${item.title}</td>
        <td style="padding:10px 12px;color:#9ca3af;font-size:12px;line-height:1.6">${item.action}</td>
      </tr>`;
    }).join('');
    return `
      <div style="margin-bottom:22px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1f2d45">
          <h2 style="font-size:15px;font-weight:700;color:#e2e8f0">📋 Prioritised Action Plan</h2>
          <span style="font-size:11px;color:#6b7280;background:#1a2233;border-radius:20px;padding:2px 9px">Top ${Math.min(plan.length,10)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#111827;border:1px solid #1f2d45;border-radius:8px;overflow:hidden">
          <thead><tr style="background:#1a2233">
            <th style="padding:9px 12px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.5px;text-align:center;width:40px">#</th>
            <th style="padding:9px 12px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.5px;text-align:left">Issue</th>
            <th style="padding:9px 12px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.5px;text-align:left">Recommended Action</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ── Ratio findings ────────────────────────────────────────────────────
  const ratioFindings = report.ambers.filter(f => f.module === 'Ratio Trend')
    .concat(report.reds.filter(f => f.module === 'Ratio Alert'));
  const nonRatioReds   = report.reds.filter(f => f.module !== 'Ratio Alert');
  const nonRatioAmbers = report.ambers.filter(f => f.module !== 'Ratio Trend');

  // ── Assemble the full HTML page ────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Credlance MIS · Financial Analysis Report · ${report.period}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0b0f1a; color: #e2e8f0; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; padding: 32px; max-width: 900px; margin: 0 auto; }
  @media print {
    body { background: #fff; color: #1a1a1a; padding: 20px; }
    .no-print { display: none !important; }
    .finding-card { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- Cover / Header -->
<div style="border:1px solid #1f2d45;border-radius:14px;padding:28px 32px;margin-bottom:28px;background:linear-gradient(135deg,rgba(0,212,170,.06),rgba(0,153,255,.04))">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div>
      <div style="font-size:22px;font-weight:800;color:#00d4aa;letter-spacing:-.5px">Credlance MIS</div>
      <div style="font-size:28px;font-weight:700;color:#e2e8f0;margin-top:4px">Financial Analysis Report</div>
      <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap">
        <span style="font-size:13px;color:#6b7280">Client: <strong style="color:#e2e8f0">${client}</strong></span>
        <span style="font-size:13px;color:#6b7280">Period: <strong style="color:#e2e8f0">${report.period}</strong></span>
        <span style="font-size:13px;color:#6b7280">Generated: <strong style="color:#e2e8f0">${report.generatedAt}</strong></span>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      ${report.reds.length ? `<span style="background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700">🔴 ${report.reds.length} Red Flag${report.reds.length>1?'s':''}</span>` : ''}
      ${report.ambers.length ? `<span style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700">🟠 ${report.ambers.length} Concern${report.ambers.length>1?'s':''}</span>` : ''}
      ${report.positives.length ? `<span style="background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.25);padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700">✅ ${report.positives.length} Positive${report.positives.length>1?'s':''}</span>` : ''}
    </div>
  </div>
</div>

<!-- Key Metrics Strip -->
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px">
  ${[
    { label: 'Revenue', val: inrF(snap.rev), sub: report.period },
    { label: 'Gross Margin', val: pF(snap.gmP), sub: `₹${inrF(snap.gp)} GP` },
    { label: 'EBITDA Margin', val: pF(snap.emP), sub: `₹${inrF(snap.ebitda)} EBITDA` },
    { label: 'PAT Margin', val: pF(snap.nmP), sub: `₹${inrF(snap.pat)} PAT` },
  ].map(k => `
    <div style="background:#111827;border:1px solid #1f2d45;border-radius:10px;padding:14px 16px">
      <div style="font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:.6px;margin-bottom:5px">${k.label}</div>
      <div style="font-size:22px;font-weight:700;color:#e2e8f0">${k.val}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:3px">${k.sub}</div>
    </div>
  `).join('')}
</div>

<!-- Executive Summary -->
<div style="background:linear-gradient(135deg,rgba(0,212,170,.07),rgba(0,153,255,.05));border:1px solid rgba(0,212,170,.2);border-radius:10px;padding:18px 20px;margin-bottom:24px">
  <div style="font-size:14px;font-weight:700;color:#00d4aa;margin-bottom:8px">📊 Executive Summary</div>
  <div style="font-size:13px;color:#9ca3af;line-height:1.7">
    ${report.reds.length === 0
      ? `The business is in a healthy overall position for ${report.period}. Key financials are tracking within acceptable parameters.`
      : `Immediate management attention is required on ${report.reds.length} critical issue${report.reds.length>1?'s':''} identified. The most pressing concern${report.reds.length>1?'s are':' is'}: <strong style="color:#e2e8f0">${report.reds.slice(0,2).map(f=>f.title).join('</strong> and <strong style="color:#e2e8f0">')}</strong>.`
    }
    ${report.positives.length > 0 ? ` On the positive side, the business demonstrates strength in ${report.positives.slice(0,2).map(f=>f.title.replace(/[()0-9.x%]/g,'').trim()).join(' and ')}.` : ''}
  </div>
</div>

<!-- Sections in order: Red → Amber → Advisory → Ratio → Positive → Action Plan -->
${findingsHTML(nonRatioReds,    'Red Flags — Immediate Action Required', '🔴')}
${findingsHTML(nonRatioAmbers,  'Concerns — Monitor Closely',           '🟠')}
${findingsHTML(report.advisories,'Advisories',                          '🟡')}
${findingsHTML(ratioFindings,   'Ratio Commentary',                     '📊')}
${findingsHTML(report.positives,'Positives',                            '✅')}
${actionPlanHTML(report.actionPlan)}

<!-- Footer -->
<div style="text-align:center;padding:20px 0;border-top:1px solid #1f2d45;font-size:11px;color:#6b7280">
  Confidential · Credlance MIS Dashboard · ${report.generatedAt} · ${report.all.length} findings across 5 analysis modules
</div>

<div class="no-print" style="text-align:center;padding:16px;margin-top:8px">
  <button onclick="window.print()" style="background:#00d4aa;color:#000;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="background:transparent;border:1px solid #1f2d45;color:#6b7280;border-radius:8px;padding:10px 18px;font-size:13px;cursor:pointer;margin-left:10px">Close</button>
</div>

</body>
</html>`;

  // Open in a new tab
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    // Fallback: download as file
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `Credlance_Analysis_${report.period.replace(/[^a-zA-Z0-9-]/g,'_')}_${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
