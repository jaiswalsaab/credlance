// ── Credlance MIS Upload Handler ──
// SheetJS-based parser for all 6 data templates

const TEMPLATES = [
  {
    id: 'trial_balance',
    name: 'Trial Balance',
    icon: '⚖️',
    desc: 'Month-end trial balance with TB codes and Tracer mapping',
    sheet: 'TB',
    requiredCols: ['TB Code', 'Account Name', 'Closing Balance']
  },
  {
    id: 'budget',
    name: 'Budget',
    icon: '🎯',
    desc: 'Monthly budget by line item (April–March FY)',
    sheet: 'Budget',
    requiredCols: ['Line Item', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
  },
  {
    id: 'sales_register',
    name: 'Sales Register',
    icon: '🧾',
    desc: 'Invoice-level: date, client, amount, GST, TDS',
    sheet: 'Sales',
    requiredCols: ['Invoice Date', 'Client Name', 'Invoice Amount', 'GST Amount', 'TDS Amount']
  },
  {
    id: 'ar_ageing',
    name: 'AR Ageing',
    icon: '📥',
    desc: 'Debtor-wise: 0-30, 31-60, 61-90, 90+ days buckets',
    sheet: 'AR Ageing',
    requiredCols: ['Debtor Name', '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days']
  },
  {
    id: 'ap_ageing',
    name: 'AP Ageing',
    icon: '📤',
    desc: 'Creditor-wise: 0-30, 31-60, 61-90, 90+ days buckets',
    sheet: 'AP Ageing',
    requiredCols: ['Creditor Name', '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days']
  },
  {
    id: 'employee_cost',
    name: 'Employee Cost',
    icon: '👥',
    desc: 'Headcount + cost by department',
    sheet: 'Employee Cost',
    requiredCols: ['Department', 'Headcount', 'Gross Salary', 'PF & ESI', 'Other Benefits', 'Total Cost']
  }
];

function getActiveClient() {
  return sessionStorage.getItem('credlance_client') ||
         localStorage.getItem('credlance_active_client') || 'default';
}

function storageKey(templateId) {
  return `credlance_data_${getActiveClient()}_${templateId}`;
}

function initUploadUI() {
  const body = document.getElementById('upload-body');
  if (!body) return;

  const client = getActiveClient();

  body.innerHTML = `
    <p style="color:var(--muted);font-size:13px;margin-bottom:20px;">
      Active client: <strong style="color:var(--accent)">${client || 'None selected'}</strong>
      &nbsp;·&nbsp; Upload one or more Excel files below.
      <a href="#" onclick="downloadAllTemplates()" style="color:var(--accent);margin-left:8px;">⬇ Download all templates</a>
    </p>
    <div id="upload-grid" style="display:grid;gap:12px;">
      ${TEMPLATES.map(t => `
        <div class="upload-row" id="row-${t.id}" style="
          background:var(--bg);border:1px solid var(--border);border-radius:10px;
          padding:14px 16px;display:flex;align-items:center;gap:14px;
        ">
          <div style="font-size:24px">${t.icon}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600">${t.name}</div>
            <div style="font-size:12px;color:var(--muted)">${t.desc}</div>
          </div>
          <div class="upload-status" id="status-${t.id}" style="font-size:12px;color:var(--muted)">
            ${localStorage.getItem(storageKey(t.id)) ? '✅ Loaded' : '— Not uploaded'}
          </div>
          <label style="cursor:pointer">
            <input type="file" accept=".xlsx,.xls" style="display:none"
              onchange="handleFileUpload(event,'${t.id}')" />
            <span style="
              padding:6px 14px;background:var(--surface2);border:1px solid var(--border);
              border-radius:6px;font-size:12px;color:var(--text);cursor:pointer;
              transition:all 0.2s;
            " onmouseover="this.style.borderColor='var(--accent)'"
               onmouseout="this.style.borderColor='var(--border)'">Upload</span>
          </label>
        </div>
      `).join('')}
    </div>
    <div id="upload-log" style="margin-top:16px;font-size:12px;color:var(--muted);max-height:120px;overflow-y:auto;"></div>
  `;
}

function handleFileUpload(event, templateId) {
  const file = event.target.files[0];
  if (!file) return;

  const tpl = TEMPLATES.find(t => t.id === templateId);
  const statusEl = document.getElementById(`status-${templateId}`);
  const logEl = document.getElementById('upload-log');

  statusEl.textContent = '⏳ Parsing...';
  statusEl.style.color = 'var(--amber)';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      // Load SheetJS dynamically if not available
      if (typeof XLSX === 'undefined') {
        logError(logEl, 'SheetJS not loaded. Please use the page with CDN access.');
        statusEl.textContent = '❌ Error';
        statusEl.style.color = 'var(--red)';
        return;
      }

      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });

      // Try the expected sheet name first, then first sheet
      let ws = wb.Sheets[tpl.sheet] || wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('No sheets found in file');

      const json = XLSX.utils.sheet_to_json(ws, { defval: null });

      if (json.length === 0) throw new Error('Sheet appears empty');

      // Store parsed data
      const payload = {
        template: templateId,
        client: getActiveClient(),
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        rows: json
      };

      localStorage.setItem(storageKey(templateId), JSON.stringify(payload));
      // Update last-upload timestamp for this client (used by admin panel + status panel)
      const client = getActiveClient();
      if (client) {
        localStorage.setItem(`credlance_data_${client}_last_upload`, new Date().toISOString());
      }

      statusEl.textContent = `✅ ${json.length} rows`;
      statusEl.style.color = 'var(--green)';
      logEl.innerHTML = `<span style="color:var(--green)">✓ ${tpl.name}: ${json.length} rows imported from "${file.name}"</span><br>` + logEl.innerHTML;

    } catch (err) {
      statusEl.textContent = '❌ Error';
      statusEl.style.color = 'var(--red)';
      logEl.innerHTML = `<span style="color:var(--red)">✗ ${tpl.name}: ${err.message}</span><br>` + logEl.innerHTML;
    }
  };
  reader.readAsArrayBuffer(file);
}

function logError(el, msg) {
  if (el) el.innerHTML = `<span style="color:var(--red)">✗ ${msg}</span><br>` + el.innerHTML;
}

// Helper to load data back out
function getTemplateData(templateId) {
  const raw = localStorage.getItem(storageKey(templateId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Download template stubs (CSV-based since we can't generate XLSX client-side without a library)
function downloadTemplate(templateId) {
  const tpl = TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return;

  // Use template files in /templates/ folder
  const link = document.createElement('a');
  link.href = `templates/${templateId}.xlsx`;
  link.download = `Credlance_${tpl.name.replace(/\s/g, '_')}_Template.xlsx`;
  link.click();
}

function downloadAllTemplates() {
  TEMPLATES.forEach((t, i) => {
    setTimeout(() => downloadTemplate(t.id), i * 500);
  });
}
