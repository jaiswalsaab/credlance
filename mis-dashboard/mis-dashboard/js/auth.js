// ── Credlance MIS Auth ──
// Master password: credlance2025
// Per-client passwords stored in localStorage

const MASTER_PASS = 'credlance2025';

function doLogin() {
  const clientInput = document.getElementById('login-client').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');

  // Master login (admin / no client)
  if (!clientInput || clientInput.toLowerCase() === 'admin') {
    if (pass === MASTER_PASS) {
      sessionStorage.setItem('credlance_auth', 'master');
      sessionStorage.setItem('credlance_role', 'admin');
      document.getElementById('login-overlay').style.display = 'none';
      refreshClientList();
      return;
    } else {
      errorEl.style.display = 'block';
      return;
    }
  }

  // Client login — check master pass OR per-client password
  const clientPassKey = `credlance_client_pass_${clientInput}`;
  const clientPass = localStorage.getItem(clientPassKey);

  if (pass === MASTER_PASS || (clientPass && pass === clientPass)) {
    sessionStorage.setItem('credlance_auth', 'client');
    sessionStorage.setItem('credlance_role', clientPass ? 'client' : 'admin');
    sessionStorage.setItem('credlance_client', clientInput);
    localStorage.setItem('credlance_active_client', clientInput);

    // Ensure client exists in list
    const clients = JSON.parse(localStorage.getItem('credlance_clients') || '[]');
    if (!clients.includes(clientInput)) {
      clients.push(clientInput);
      localStorage.setItem('credlance_clients', JSON.stringify(clients));
    }

    document.getElementById('login-overlay').style.display = 'none';
    refreshClientList();
    return;
  }

  errorEl.style.display = 'block';
}

function doLogout() {
  sessionStorage.clear();
  location.reload();
}

// Returns true if a valid session exists; false otherwise.
// Call on page load in non-index pages to gate access.
function checkAuth() {
  return !!sessionStorage.getItem('credlance_auth');
}

// Returns true only if the current session has admin/master role.
function checkAdminAuth() {
  const role = sessionStorage.getItem('credlance_role');
  return role === 'admin';
}

// Helper: get all clients from localStorage
function getClients() {
  return JSON.parse(localStorage.getItem('credlance_clients') || '[]');
}

// Helper: save client list to localStorage
function saveClients(list) {
  localStorage.setItem('credlance_clients', JSON.stringify(list));
}

// Helper: get per-client password (null if none set)
function getClientPass(name) {
  return localStorage.getItem(`credlance_client_pass_${name}`);
}

// Helper: set per-client password
function setClientPass(name, pass) {
  if (pass) {
    localStorage.setItem(`credlance_client_pass_${name}`, pass);
  } else {
    localStorage.removeItem(`credlance_client_pass_${name}`);
  }
}

// Helper: delete all data for a client
function deleteClientData(name) {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`credlance_data_${name}_`)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem(`credlance_client_pass_${name}`);
}

// Helper: get data summary flags for a client
function getClientDataSummary(name) {
  const templates = ['trial_balance','budget','sales_register','ar_ageing','ap_ageing','employee_cost'];
  const present = templates.filter(t => !!localStorage.getItem(`credlance_data_${name}_${t}`));
  const lastUpload = localStorage.getItem(`credlance_data_${name}_last_upload`);
  return { present, missing: templates.filter(t => !present.includes(t)), lastUpload };
}

// Allow Enter key on password field
document.addEventListener('DOMContentLoaded', () => {
  const passEl = document.getElementById('login-pass');
  if (passEl) {
    passEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  }
  const clientEl = document.getElementById('login-client');
  if (clientEl) {
    clientEl.addEventListener('keydown', e => { if (e.key === 'Enter') passEl && passEl.focus(); });
  }

  // Auto-login check
  const auth = sessionStorage.getItem('credlance_auth');
  if (auth) {
    document.getElementById('login-overlay').style.display = 'none';
    if (typeof refreshClientList === 'function') refreshClientList();
  }
});
