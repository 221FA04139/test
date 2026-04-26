/* ── app.js — Main application logic ────────────────────────────────────── */

'use strict';

// ── Shared utilities ────────────────────────────────────────────────────────

function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || '';
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtRupee(amount) {
  amount = parseFloat(amount) || 0;
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const [intPart, dec] = abs.toFixed(2).split('.');
  let formatted = '';
  const s = intPart;
  if (s.length <= 3) {
    formatted = s;
  } else {
    formatted = s.slice(-3);
    let rest = s.slice(0, -3);
    while (rest.length > 2) {
      formatted = rest.slice(-2) + ',' + formatted;
      rest = rest.slice(0, -2);
    }
    formatted = rest + ',' + formatted;
  }
  return (isNeg ? '-' : '') + '₹' + formatted + '.' + dec;
}

function colorAmount(amount, type) {
  const f = fmtRupee(amount);
  if (type === 'Income') return `<span class="green mono">${f}</span>`;
  if (type === 'Expense') return `<span class="red mono">${f}</span>`;
  return `<span class="gold mono">${f}</span>`;
}

function typeBadge(type) {
  const cls = { Income: 'badge-income', Expense: 'badge-expense', Transfer: 'badge-transfer' }[type] || '';
  return `<span class="type-badge ${cls}">${escHtml(type)}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ── API wrapper ─────────────────────────────────────────────────────────────

async function apiCall(method, url, data = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
  };
  if (data && method !== 'GET') opts.body = JSON.stringify(data);

  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({ error: 'Invalid response' }));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// ── App namespace ───────────────────────────────────────────────────────────

const App = (() => {
  let currentTab = 'dashboard';
  let _confirmCallback = null;

  function api(method, url, data) {
    return apiCall(method, url, data);
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  function toast(msg, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${escHtml(msg)}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  // ── Confirm dialog ─────────────────────────────────────────────────────────
  function confirm(msg, callback) {
    _confirmCallback = callback;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-overlay').classList.remove('hidden');
  }

  function confirmOk() {
    document.getElementById('confirm-overlay').classList.add('hidden');
    if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
  }

  function confirmCancel() {
    document.getElementById('confirm-overlay').classList.add('hidden');
    _confirmCallback = null;
  }

  // ── Sidebar toggle ─────────────────────────────────────────────────────────
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      const isOpen = sidebar.classList.contains('open');
      sidebar.classList.toggle('open', !isOpen);
      let backdrop = document.getElementById('sidebar-backdrop');
      if (!isOpen) {
        if (!backdrop) {
          backdrop = document.createElement('div');
          backdrop.id = 'sidebar-backdrop';
          backdrop.className = 'sidebar-backdrop';
          backdrop.onclick = toggleSidebar;
          document.body.appendChild(backdrop);
        }
        backdrop.classList.add('visible');
      } else {
        backdrop && backdrop.classList.remove('visible');
      }
    } else {
      const isCollapsed = sidebar.classList.contains('collapsed');
      sidebar.classList.toggle('collapsed', !isCollapsed);
      main.classList.toggle('full-width', !isCollapsed);
    }
  }

  // ── Tab switching ──────────────────────────────────────────────────────────
  function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.bnav-btn[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.id !== `tab-${tab}`);
    });

    if (tab === 'dashboard') loadDashboard();
    if (tab === 'transactions') Transactions.load(1);
    if (tab === 'accounts') loadAccountsTab();
    if (tab === 'settings') loadSettingsTab();
  }

  // ── Top bar ────────────────────────────────────────────────────────────────
  function initTopBar() {
    const dateEl = document.getElementById('top-date');
    if (dateEl) {
      const now = new Date();
      const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('en-IN', opts);
    }
    // Top bar stats are populated by loadDashboard() — no separate fetch here
  }

  // refreshTopBar accepts pre-fetched data to avoid a redundant API call when
  // called from loadDashboard(). When called standalone (after save/edit/delete)
  // it fetches fresh data itself.
  async function refreshTopBar(data = null) {
    try {
      const d = data || await api('GET', '/api/dashboard');
      const { count, net } = d.today;
      const entriesEl = document.getElementById('top-entries');
      const netEl = document.getElementById('top-net');
      if (entriesEl) entriesEl.textContent = count;
      if (netEl) {
        netEl.textContent = fmtRupee(net);
        netEl.className = 'top-stat-value mono ' + (net >= 0 ? 'green' : 'red');
      }
    } catch (_) {}
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  async function loadDashboard() {
    try {
      const data = await api('GET', '/api/dashboard');

      setKpi('kpi-income',   data.all_time.income,   'green');
      setKpi('kpi-expense',  data.all_time.expense,  'red');
      setKpi('kpi-net',      data.all_time.net,      data.all_time.net >= 0 ? 'green' : 'red');
      setKpi('kpi-m-income', data.this_month.income, 'green');
      setKpi('kpi-m-expense',data.this_month.expense,'red');
      document.getElementById('kpi-today').textContent = data.today.count;

      renderAccountGrid(data.account_balances);
      renderCatGrid(data.category_pnl);
      Charts.update(data);

      // Reuse already-fetched data for top bar — no second API call
      refreshTopBar(data);

    } catch (err) {
      toast('Failed to load dashboard', 'error');
    }
  }

  function setKpi(id, amount, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = fmtRupee(amount);
    el.className = `kpi-value mono ${colorClass}`;
  }

  function renderAccountGrid(accounts) {
    const container = document.getElementById('account-grid');
    if (!container) return;
    container.innerHTML = accounts.map(a => {
      const balClass = a.balance >= 0 ? 'green' : 'red';
      return `
        <div class="account-card" onclick="App.filterByAccount('${escHtml(a.account)}')">
          <div class="account-name">${escHtml(a.account)}</div>
          <div class="account-balance ${balClass}">${fmtRupee(a.balance)}</div>
          <div class="account-meta">
            In: <span class="green">${fmtRupee(a.total_in)}</span>
            &nbsp;Out: <span class="red">${fmtRupee(a.total_out)}</span>
          </div>
        </div>`;
    }).join('');
  }

  function renderCatGrid(cats) {
    const container = document.getElementById('cat-grid');
    if (!container) return;
    container.innerHTML = cats.map(c => {
      const netClass = c.net >= 0 ? 'green' : 'red';
      return `
        <div class="cat-card">
          <div class="cat-name">${escHtml(c.category)}</div>
          <div class="cat-row"><span>Income</span><span class="green mono">${fmtRupee(c.income)}</span></div>
          <div class="cat-row"><span>Expense</span><span class="red mono">${fmtRupee(c.expense)}</span></div>
          <div class="cat-net ${netClass} mono">Net: ${fmtRupee(c.net)}</div>
        </div>`;
    }).join('') || '<div class="loading-placeholder">No data yet.</div>';
  }

  function filterByAccount(account) {
    switchTab('transactions');
    setTimeout(() => {
      const sel = document.getElementById('tx-filter-account');
      if (sel) { sel.value = account; Transactions.load(1); }
    }, 100);
  }

  // ── Accounts tab ───────────────────────────────────────────────────────────
  async function loadAccountsTab() {
    const container = document.getElementById('accounts-list');
    if (!container) return;
    container.innerHTML = '<div class="loading-placeholder">Loading…</div>';

    try {
      // Single batch call instead of 12 individual requests
      const [dashData, recentMap] = await Promise.all([
        api('GET', '/api/dashboard'),
        api('GET', '/api/accounts/recent-transactions'),
      ]);
      const accs = dashData.account_balances;

      container.innerHTML = '<div class="acc-detail-grid">' +
        accs.map(a => {
          const balClass = a.balance >= 0 ? 'green' : 'red';
          const txs = (recentMap[a.account] || []).slice(0, 5);
          const miniRows = txs.length === 0
            ? '<div class="loading-placeholder">No transactions yet.</div>'
            : txs.map(t => `
                <div class="acc-mini-tx">
                  <div class="acc-mini-tx-left">${fmtDate(t.date)} · ${escHtml(t.category)}</div>
                  <div>${colorAmount(t.amount, t.type)}</div>
                </div>`).join('');

          return `
            <div class="acc-detail-card">
              <div class="acc-detail-name">${escHtml(a.account)}</div>
              <div class="acc-stats">
                <div class="acc-stat">
                  <div class="acc-stat-label">Opening Balance</div>
                  <div class="acc-stat-value mono">${fmtRupee(a.opening)}</div>
                </div>
                <div class="acc-stat">
                  <div class="acc-stat-label">Total In</div>
                  <div class="acc-stat-value green mono">${fmtRupee(a.total_in)}</div>
                </div>
                <div class="acc-stat">
                  <div class="acc-stat-label">Total Out</div>
                  <div class="acc-stat-value red mono">${fmtRupee(a.total_out)}</div>
                </div>
                <div class="acc-stat acc-stat-balance">
                  <div class="acc-stat-label">Current Balance</div>
                  <div class="acc-stat-value ${balClass} mono">${fmtRupee(a.balance)}</div>
                </div>
              </div>
              <div class="acc-mini-txs">
                <div class="acc-mini-tx-title">Recent Transactions</div>
                ${miniRows}
              </div>
              <button class="acc-view-all" onclick="App.filterByAccount('${escHtml(a.account)}')">View all →</button>
            </div>`;
        }).join('') + '</div>';

    } catch (err) {
      container.innerHTML = `<div class="loading-placeholder">Error: ${escHtml(err.message)}</div>`;
    }
  }

  // ── Settings tab ───────────────────────────────────────────────────────────
  async function loadSettingsTab() {
    try {
      const data = await api('GET', '/api/db-status');
      const el = document.getElementById('db-status');
      if (el) el.textContent = data.status === 'connected' ? `Connected (${data.transaction_count} txns)` : 'Error';
    } catch (_) {}
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportExcel() {
    window.location.href = '/api/export/excel';
    toast('Preparing Excel export…', 'info');
  }

  function exportCsv() {
    window.location.href = '/api/export/csv';
    toast('Preparing CSV export…', 'info');
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  function initKeyboard() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('entry-form')?.dispatchEvent(new Event('submit'));
      }
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    initTopBar();
    initKeyboard();
    Form.init();
    loadDashboard();
    checkMobileLayout();
    window.addEventListener('resize', checkMobileLayout);
  }

  function checkMobileLayout() {
    const isMobile = window.innerWidth <= 768;
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    if (!isMobile) {
      sidebar.classList.remove('open');
      main.classList.remove('full-width');
      const backdrop = document.getElementById('sidebar-backdrop');
      backdrop && backdrop.classList.remove('visible');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    api,
    toast,
    confirm,
    confirmOk,
    confirmCancel,
    toggleSidebar,
    switchTab,
    refreshTopBar,
    loadDashboard,
    filterByAccount,
    exportExcel,
    exportCsv,
    get currentTab() { return currentTab; },
  };
})();

// ── Transactions namespace ───────────────────────────────────────────────────

const Transactions = (() => {
  let currentPage = 1;
  let totalPages = 1;
  let editingId = null;
  let searchTimer = null;
  let _txCache = {};

  function getFilters() {
    return {
      search:    document.getElementById('tx-search')?.value.trim() || '',
      type:      document.getElementById('tx-filter-type')?.value || '',
      account:   document.getElementById('tx-filter-account')?.value || '',
      category:  document.getElementById('tx-filter-category')?.value || '',
      month:     document.getElementById('tx-filter-month')?.value || '',
      from_date: document.getElementById('tx-filter-from')?.value || '',
      to_date:   document.getElementById('tx-filter-to')?.value || '',
    };
  }

  function buildUrl(page) {
    const f = getFilters();
    const params = new URLSearchParams({ page });
    if (f.search)     params.set('search', f.search);
    if (f.type)       params.set('type', f.type);
    if (f.account)    params.set('account', f.account);
    if (f.category)   params.set('category', f.category);
    if (f.month)      params.set('month', f.month);
    if (f.from_date)  params.set('from_date', f.from_date);
    if (f.to_date)    params.set('to_date', f.to_date);
    return `/api/transactions?${params}`;
  }

  async function load(page = 1) {
    currentPage = page;
    const tbody = document.getElementById('tx-tbody');
    const countEl = document.getElementById('tx-count');
    tbody.innerHTML = '<tr><td colspan="9" class="loading-placeholder">Loading…</td></tr>';

    try {
      const data = await App.api('GET', buildUrl(page));
      const txs = data.transactions || [];
      totalPages = data.pages || 1;

      // Cache transactions for duplicate feature
      _txCache = {};
      txs.forEach(t => { _txCache[t.id] = t; });

      if (countEl) countEl.textContent = `${data.total} transaction${data.total === 1 ? '' : 's'}`;

      if (txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-placeholder">No transactions found.</td></tr>';
        renderPagination(0, 0);
        return;
      }

      tbody.innerHTML = txs.map(t => buildRow(t)).join('');
      renderPagination(page, totalPages);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="loading-placeholder">Error: ${escHtml(err.message)}</td></tr>`;
    }
  }

  function buildRow(t) {
    // For Transfer rows, show "From → To" in the account cell
    const accountDisplay = (t.type === 'Transfer' && t.to_account)
      ? `${escHtml(t.account)}<br><small class="transfer-arrow">→ ${escHtml(t.to_account)}</small>`
      : escHtml(t.account);

    return `
      <tr id="row-${t.id}" data-id="${t.id}" data-to-account="${escHtml(t.to_account || '')}">
        <td>${fmtDate(t.date)}</td>
        <td>${typeBadge(t.type)}</td>
        <td>${accountDisplay}</td>
        <td>${escHtml(t.category)}</td>
        <td>${escHtml(t.subcat)}</td>
        <td>${escHtml(t.description)}</td>
        <td class="num-col">${colorAmount(t.amount, t.type)}</td>
        <td>${escHtml(t.ref)}</td>
        <td>
          <button class="action-btn" onclick="Transactions.duplicate(${t.id})" title="Duplicate">⧉</button>
          <button class="action-btn" onclick="Transactions.startEdit(${t.id})" title="Edit">✏️</button>
          <button class="action-btn del" onclick="Transactions.del(${t.id})" title="Delete">🗑</button>
        </td>
      </tr>`;
  }

  function duplicate(id) {
    const t = _txCache[id];
    if (!t) return;
    Form.prefill(t);
    App.toast('Prefilled from row — edit and save', 'info');
  }

  function startEdit(id) {
    if (editingId && editingId !== id) cancelEdit();

    const row = document.getElementById(`row-${id}`);
    if (!row) return;
    editingId = id;

    const cells = row.querySelectorAll('td');
    // Parse date from dd/mm/yyyy back to yyyy-mm-dd
    const dateParts = cells[0].textContent.trim().split('/');
    const currentDate = dateParts.length === 3
      ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
      : todayISO();
    const currentType = cells[1].querySelector('.type-badge')?.textContent?.trim() || 'Expense';
    // Account cell may have "From\n→ To" — take only the first line
    const currentAccount = cells[2].firstChild?.textContent?.trim() || cells[2].textContent.trim();
    const currentToAccount = row.dataset.toAccount || '';
    const currentCategory = cells[3].textContent.trim();
    const currentSubcat = cells[4].textContent.trim();
    const currentDesc = cells[5].textContent.trim();
    // Strip ₹ and commas but preserve numeric value; handle negative sign
    const rawAmt = cells[6].textContent.replace(/[₹,]/g, '').trim();
    const currentAmount = parseFloat(rawAmt.replace(/[^\d.-]/g, '')) || '';
    const currentRef = cells[7].textContent.trim();

    const ACCS = window._ACCOUNTS || [];
    const CAT_MAP = window._CATEGORIES || {};

    const accountOpts = ACCS.map(a =>
      `<option value="${escHtml(a)}" ${a === currentAccount ? 'selected' : ''}>${escHtml(a)}</option>`
    ).join('');
    const toAccountOpts = ACCS.map(a =>
      `<option value="${escHtml(a)}" ${a === currentToAccount ? 'selected' : ''}>${escHtml(a)}</option>`
    ).join('');
    const typeOpts = ['Income', 'Expense', 'Transfer'].map(t =>
      `<option ${t === currentType ? 'selected' : ''}>${t}</option>`
    ).join('');
    const catOpts = Object.keys(CAT_MAP).map(c =>
      `<option value="${escHtml(c)}" ${c === currentCategory ? 'selected' : ''}>${escHtml(c)}</option>`
    ).join('');

    const subs = CAT_MAP[currentCategory] || [];
    const subcatOpts = ['', ...subs].map(s =>
      `<option value="${escHtml(s)}" ${s === currentSubcat ? 'selected' : ''}>${s || '— none —'}</option>`
    ).join('');

    const isTransfer = currentType === 'Transfer';

    row.classList.add('editing');
    row.innerHTML = `
      <td><input type="date" class="form-input" id="ei-date" value="${escHtml(currentDate)}"></td>
      <td>
        <select class="form-input" id="ei-type" onchange="Transactions.onEditTypeChange()">
          ${typeOpts}
        </select>
      </td>
      <td>
        <select class="form-input" id="ei-account">${accountOpts}</select>
        <div id="ei-to-account-wrap" style="display:${isTransfer ? 'flex' : 'none'};align-items:center;gap:4px;margin-top:4px">
          <span style="color:var(--muted);font-size:0.75rem">→ To</span>
          <select class="form-input" id="ei-to-account">
            <option value="">—</option>${toAccountOpts}
          </select>
        </div>
      </td>
      <td>
        <select class="form-input" id="ei-category" onchange="Transactions.onEditCatChange()">
          <option value="">—</option>${catOpts}
        </select>
      </td>
      <td><select class="form-input" id="ei-subcat">${subcatOpts}</select></td>
      <td><input type="text" class="form-input" id="ei-desc" value="${escHtml(currentDesc)}"></td>
      <td class="num-col">
        <div class="amount-wrap" style="min-width:110px">
          <span class="amount-prefix">₹</span>
          <input type="number" class="form-input amount-input" id="ei-amount" value="${currentAmount}" step="0.01" min="0.01">
        </div>
      </td>
      <td><input type="text" class="form-input" id="ei-ref" value="${escHtml(currentRef)}"></td>
      <td>
        <button class="action-btn save-inline" onclick="Transactions.saveEdit(${id})" title="Save">✓</button>
        <button class="action-btn cancel-inline" onclick="Transactions.cancelEdit()" title="Cancel">✕</button>
      </td>`;
  }

  function onEditTypeChange() {
    const type = document.getElementById('ei-type')?.value;
    const wrap = document.getElementById('ei-to-account-wrap');
    if (wrap) wrap.style.display = type === 'Transfer' ? 'flex' : 'none';
  }

  function onEditCatChange() {
    const cat = document.getElementById('ei-category')?.value || '';
    const subs = (window._CATEGORIES || {})[cat] || [];
    const el = document.getElementById('ei-subcat');
    if (el) {
      el.innerHTML = ['', ...subs].map(s =>
        `<option value="${escHtml(s)}">${s || '— none —'}</option>`
      ).join('');
    }
  }

  async function saveEdit(id) {
    const payload = {
      date:        document.getElementById('ei-date')?.value,
      type:        document.getElementById('ei-type')?.value,
      account:     document.getElementById('ei-account')?.value,
      to_account:  document.getElementById('ei-to-account')?.value || '',
      category:    document.getElementById('ei-category')?.value,
      subcat:      document.getElementById('ei-subcat')?.value,
      description: document.getElementById('ei-desc')?.value.trim(),
      amount:      parseFloat(document.getElementById('ei-amount')?.value),
      ref:         document.getElementById('ei-ref')?.value.trim(),
    };

    if (!payload.amount || payload.amount <= 0) {
      App.toast('Enter a valid amount', 'error');
      return;
    }

    try {
      const data = await App.api('PUT', `/api/transactions/${id}`, payload);
      editingId = null;
      const row = document.getElementById(`row-${id}`);
      if (row) {
        row.classList.remove('editing');
        row.outerHTML = buildRow(data.transaction);
      }
      App.toast('Transaction updated ✓', 'success');
      App.refreshTopBar();
    } catch (err) {
      App.toast(err.message || 'Update failed', 'error');
    }
  }

  function cancelEdit() {
    if (!editingId) return;
    editingId = null;
    load(currentPage);
  }

  function del(id) {
    App.confirm('Delete this transaction? (Soft delete — can be recovered)', async () => {
      try {
        await App.api('DELETE', `/api/transactions/${id}`);
        App.toast('Transaction deleted', 'success');
        load(currentPage);
        App.refreshTopBar();
      } catch (err) {
        App.toast(err.message || 'Delete failed', 'error');
      }
    });
  }

  function clearFilters() {
    ['tx-search', 'tx-filter-type', 'tx-filter-account', 'tx-filter-category',
     'tx-filter-month', 'tx-filter-from', 'tx-filter-to'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    load(1);
  }

  function onSearchChange() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => load(1), 400);
  }

  function renderPagination(page, pages) {
    const container = document.getElementById('tx-pagination');
    if (!container) return;
    if (pages <= 1) { container.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="Transactions.load(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Prev</button>`;
    html += `<span style="color:var(--muted);font-size:0.82rem">Page ${page} of ${pages}</span>`;
    html += `<button class="page-btn" onclick="Transactions.load(${page + 1})" ${page >= pages ? 'disabled' : ''}>Next →</button>`;
    container.innerHTML = html;
  }

  return {
    load, duplicate, startEdit, onEditTypeChange, onEditCatChange,
    saveEdit, cancelEdit, del, clearFilters, onSearchChange,
  };
})();

// ── Reports namespace ────────────────────────────────────────────────────────

const Reports = (() => {
  let lastFromDate = '';
  let lastToDate = '';

  function setRange(range) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed
    let from, to;

    const pad = n => String(n).padStart(2, '0');
    const iso = (yr, mo, dy) => `${yr}-${pad(mo)}-${pad(dy)}`;

    if (range === 'this-month') {
      from = iso(y, m + 1, 1);
      to = iso(y, m + 1, new Date(y, m + 1, 0).getDate());
    } else if (range === 'last-month') {
      const lm = m === 0 ? 12 : m;
      const ly = m === 0 ? y - 1 : y;
      from = iso(ly, lm, 1);
      to = iso(ly, lm, new Date(ly, lm, 0).getDate());
    } else if (range === 'this-quarter') {
      const qStart = Math.floor(m / 3) * 3;
      from = iso(y, qStart + 1, 1);
      const qEnd = qStart + 2;
      to = iso(y, qEnd + 1, new Date(y, qEnd + 1, 0).getDate());
    } else if (range === 'this-year') {
      from = iso(y, 1, 1);
      to = iso(y, 12, 31);
    }

    if (from && to) {
      document.getElementById('rpt-from').value = from;
      document.getElementById('rpt-to').value = to;
      generate();
    }
  }

  async function generate() {
    const fromDate = document.getElementById('rpt-from')?.value;
    const toDate = document.getElementById('rpt-to')?.value;

    if (!fromDate || !toDate) {
      App.toast('Select both from and to dates', 'error');
      return;
    }

    if (fromDate > toDate) {
      App.toast('From date must be before to date', 'error');
      return;
    }

    lastFromDate = fromDate;
    lastToDate = toDate;

    const container = document.getElementById('report-output');
    container.innerHTML = '<div class="loading-placeholder">Generating report…</div>';

    try {
      const data = await App.api('GET', `/api/report?from_date=${fromDate}&to_date=${toDate}`);
      renderReport(data);
      document.getElementById('rpt-export-btn').style.display = 'inline-flex';
    } catch (err) {
      container.innerHTML = `<div class="loading-placeholder">Error: ${escHtml(err.message)}</div>`;
    }
  }

  function renderReport(data) {
    const s = data.summary;
    const netClass = s.net >= 0 ? 'green' : 'red';

    const catRows = (data.category_breakdown || []).map(c => `
      <tr>
        <td>${escHtml(c.category)}</td>
        <td class="num green mono">${fmtRupee(c.income)}</td>
        <td class="num red mono">${fmtRupee(c.expense)}</td>
        <td class="num ${c.net >= 0 ? 'green' : 'red'} mono">${fmtRupee(c.net)}</td>
      </tr>`).join('');

    const accRows = (data.account_breakdown || []).map(a => `
      <tr>
        <td>${escHtml(a.account)}</td>
        <td class="num green mono">${fmtRupee(a.income)}</td>
        <td class="num red mono">${fmtRupee(a.expense)}</td>
      </tr>`).join('');

    const topRows = (data.top_transactions || []).map(t => `
      <tr>
        <td>${fmtDate(t.date)}</td>
        <td>${typeBadge(t.type)}</td>
        <td>${escHtml(t.account)}</td>
        <td>${escHtml(t.category)}</td>
        <td class="num">${colorAmount(t.amount, t.type)}</td>
        <td>${escHtml(t.description)}</td>
      </tr>`).join('');

    document.getElementById('report-output').innerHTML = `
      <div class="report-card">
        <h3>Summary — ${data.from_date} to ${data.to_date}</h3>
        <div class="report-summary-grid">
          <div class="rpt-kpi">
            <div class="rpt-kpi-label">Total Income</div>
            <div class="rpt-kpi-value green">${fmtRupee(s.total_income)}</div>
          </div>
          <div class="rpt-kpi">
            <div class="rpt-kpi-label">Total Expense</div>
            <div class="rpt-kpi-value red">${fmtRupee(s.total_expense)}</div>
          </div>
          <div class="rpt-kpi">
            <div class="rpt-kpi-label">Net</div>
            <div class="rpt-kpi-value ${netClass}">${fmtRupee(s.net)}</div>
          </div>
          <div class="rpt-kpi">
            <div class="rpt-kpi-label">Transactions</div>
            <div class="rpt-kpi-value accent">${s.transaction_count}</div>
          </div>
        </div>
      </div>

      <div class="report-card">
        <h3>Category Breakdown</h3>
        <table class="rpt-table">
          <thead><tr><th>Category</th><th class="num">Income</th><th class="num">Expense</th><th class="num">Net</th></tr></thead>
          <tbody>${catRows || '<tr><td colspan="4" class="loading-placeholder">No data.</td></tr>'}</tbody>
        </table>
      </div>

      <div class="report-card">
        <h3>Account Breakdown</h3>
        <table class="rpt-table">
          <thead><tr><th>Account</th><th class="num">Income</th><th class="num">Expense</th></tr></thead>
          <tbody>${accRows || '<tr><td colspan="3" class="loading-placeholder">No data.</td></tr>'}</tbody>
        </table>
      </div>

      <div class="report-card">
        <h3>Top 10 Transactions</h3>
        <table class="rpt-table">
          <thead><tr><th>Date</th><th>Type</th><th>Account</th><th>Category</th><th class="num">Amount</th><th>Description</th></tr></thead>
          <tbody>${topRows || '<tr><td colspan="6" class="loading-placeholder">No data.</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function exportExcel() {
    if (!lastFromDate || !lastToDate) return;
    window.location.href = `/api/export/report?from_date=${lastFromDate}&to_date=${lastToDate}`;
    App.toast('Preparing report Excel…', 'info');
  }

  return { generate, setRange, exportExcel };
})();

// ── Settings namespace ───────────────────────────────────────────────────────

const Settings = (() => {

  async function changePassword(e) {
    e.preventDefault();
    const cur = document.getElementById('s-cur-pw').value;
    const nw  = document.getElementById('s-new-pw').value;
    const cnf = document.getElementById('s-confirm-pw').value;

    if (nw !== cnf) { App.toast('Passwords do not match', 'error'); return; }
    if (nw.length < 6) { App.toast('Password must be at least 6 characters', 'error'); return; }

    try {
      await App.api('POST', '/api/change-password', { current_password: cur, new_password: nw });
      App.toast('Password changed successfully ✓', 'success');
      e.target.reset();
    } catch (err) {
      App.toast(err.message || 'Failed to change password', 'error');
    }
  }

  async function saveOB(e) {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('[data-account]');
    const balances = {};
    inputs.forEach(inp => { balances[inp.dataset.account] = parseFloat(inp.value) || 0; });

    try {
      await App.api('POST', '/api/opening-balances', { balances });
      App.toast('Opening balances saved ✓', 'success');
    } catch (err) {
      App.toast(err.message || 'Save failed', 'error');
    }
  }

  async function addCategory(e) {
    e.preventDefault();
    const name = document.getElementById('s-cat-name').value.trim();
    const parentName = document.getElementById('s-cat-parent').value;

    if (!name) { App.toast('Enter a category name', 'error'); return; }

    try {
      let parent_id = null;
      if (parentName) {
        const cats = await App.api('GET', '/api/categories');
        const parent = (cats.categories || []).find(c => c.name === parentName);
        if (parent) parent_id = parent.id;
      }
      await App.api('POST', '/api/categories', { name, parent_id });
      App.toast(`Category "${name}" added ✓`, 'success');
      document.getElementById('s-cat-name').value = '';
    } catch (err) {
      App.toast(err.message || 'Failed to add category', 'error');
    }
  }

  return { changePassword, saveOB, addCategory };
})();
