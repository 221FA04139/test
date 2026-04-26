/* ── Form.js — Quick Entry Form & Opening Balances ───────────────────────── */

const Form = (() => {
  let selectedType = 'Income';

  const CAT_MAP = window._CATEGORIES || {};

  function init() {
    const dateEl = document.getElementById('f-date');
    if (dateEl) dateEl.value = todayISO();

    loadOpeningBalances();
    populateSettingsCategoryParent();
  }

  function selectType(type) {
    selectedType = type;
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    const toAccRow = document.getElementById('f-to-account-row');
    if (toAccRow) toAccRow.classList.toggle('hidden', type !== 'Transfer');
  }

  function onCategoryChange() {
    const cat = document.getElementById('f-category').value;
    const subcatEl = document.getElementById('f-subcat');
    subcatEl.innerHTML = '';

    const subs = CAT_MAP[cat] || [];
    if (subs.length === 0) {
      subcatEl.innerHTML = '<option value="">— none —</option>';
    } else {
      subcatEl.innerHTML = '<option value="">— select sub-category —</option>' +
        subs.map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
    }
  }

  async function submit(e) {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    const spinner = document.getElementById('save-spinner');

    const amount = parseFloat(document.getElementById('f-amount').value);
    if (!amount || amount <= 0) {
      App.toast('Enter a valid amount', 'error');
      return;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');

    const payload = {
      type: selectedType,
      date: document.getElementById('f-date').value,
      amount: amount,
      account: document.getElementById('f-account').value,
      category: document.getElementById('f-category').value,
      subcat: document.getElementById('f-subcat').value,
      description: document.getElementById('f-description').value.trim(),
      ref: document.getElementById('f-ref').value.trim(),
      to_account: selectedType === 'Transfer'
        ? (document.getElementById('f-to-account')?.value || '')
        : '',
    };

    try {
      await App.api('POST', '/api/transactions', payload);
      App.toast('Transaction saved ✓', 'success');
      resetForm();
      App.refreshTopBar();
      if (App.currentTab === 'dashboard') App.loadDashboard();
      if (App.currentTab === 'transactions') Transactions.load(1);
    } catch (err) {
      App.toast(err.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  }

  function resetForm() {
    document.getElementById('f-amount').value = '';
    document.getElementById('f-description').value = '';
    document.getElementById('f-ref').value = '';
    document.getElementById('f-amount').focus();
  }

  function prefill(t) {
    selectType(t.type);
    document.getElementById('f-account').value = t.account || '';
    document.getElementById('f-category').value = t.category || '';
    onCategoryChange();
    setTimeout(() => {
      const subcatEl = document.getElementById('f-subcat');
      if (subcatEl && t.subcat) subcatEl.value = t.subcat;
    }, 0);
    document.getElementById('f-description').value = t.description || '';
    document.getElementById('f-amount').value = t.amount || '';
    document.getElementById('f-ref').value = t.ref || '';
    const toAccEl = document.getElementById('f-to-account');
    if (toAccEl) toAccEl.value = t.to_account || '';
    document.getElementById('f-amount').focus();
    document.getElementById('f-amount').select();
  }

  async function loadOpeningBalances() {
    try {
      const data = await App.api('GET', '/api/opening-balances');
      const balances = data.opening_balances || [];

      const sideInputs = document.querySelectorAll('.ob-input');
      const settingsInputs = document.querySelectorAll('.s-ob-input');

      balances.forEach(({ account, balance }) => {
        sideInputs.forEach(inp => {
          if (inp.dataset.account === account) inp.value = balance || 0;
        });
        settingsInputs.forEach(inp => {
          if (inp.dataset.account === account) inp.value = balance || 0;
        });
      });
    } catch (_) {}
  }

  async function saveOpeningBalances(e) {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('[data-account]');
    const balances = {};
    inputs.forEach(inp => { balances[inp.dataset.account] = parseFloat(inp.value) || 0; });

    try {
      await App.api('POST', '/api/opening-balances', { balances });
      App.toast('Opening balances saved ✓', 'success');
      if (App.currentTab === 'dashboard') App.loadDashboard();
    } catch (err) {
      App.toast(err.message || 'Save failed', 'error');
    }
  }

  function populateSettingsCategoryParent() {
    const sel = document.getElementById('s-cat-parent');
    if (!sel) return;
    Object.keys(CAT_MAP).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      sel.appendChild(opt);
    });
  }

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  return { init, selectType, onCategoryChange, submit, saveOpeningBalances, prefill };
})();
