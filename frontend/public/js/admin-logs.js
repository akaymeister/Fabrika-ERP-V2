function t(key, vars) {
  let s = key;
  if (window.i18n && typeof window.i18n.t === 'function') {
    s = window.i18n.t(key);
    if (!s || s === key) s = key;
  }
  if (vars && typeof s === 'string') {
    Object.keys(vars).forEach((k) => {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
    });
  }
  return s;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(msg) {
  const e = document.getElementById('adminErr');
  if (!e) return;
  e.textContent = msg || '';
  e.classList.toggle('is-hidden', !msg);
}

function apiErr(data, fallbackKey) {
  const d = data && typeof data === 'object' ? data : null;
  if (d && window.i18n && typeof window.i18n.apiErrorText === 'function') {
    return window.i18n.apiErrorText(d);
  }
  if (d && d.message) return d.message;
  return t(fallbackKey);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = '/login.html';
    return null;
  }
  if (res.status === 403) {
    window.location.href = '/';
    return null;
  }
  return { res, data };
}

const state = { page: 1, pageSize: 50, totalPages: 0 };

function getFilters() {
  const q = (id) => document.getElementById(id);
  const p = new URLSearchParams();
  const from = q('logFilterFrom')?.value;
  const to = q('logFilterTo')?.value;
  const userId = q('logFilterUserId')?.value;
  const username = q('logFilterUsername')?.value?.trim();
  const module_name = q('logFilterModule')?.value;
  const action_type = q('logFilterAction')?.value;
  const table_name = q('logFilterTable')?.value?.trim();
  const record_id = q('logFilterRecordId')?.value?.trim();
  const descQ = q('logFilterQ')?.value?.trim();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  if (userId) p.set('userId', userId);
  if (username) p.set('username', username);
  if (module_name) p.set('module_name', module_name);
  if (action_type) p.set('action_type', action_type);
  if (table_name) p.set('table_name', table_name);
  if (record_id) p.set('record_id', record_id);
  if (descQ) p.set('q', descQ);
  p.set('page', String(state.page));
  p.set('pageSize', String(state.pageSize));
  return p;
}

function fillSelect(id, values) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">—</option>';
  for (const v of values || []) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  }
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

async function loadMeta() {
  const r = await api('/api/admin/activity-logs/meta');
  if (!r) return;
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.admin.logs.table_missing'));
    return;
  }
  fillSelect('logFilterModule', r.data.moduleNames || []);
  fillSelect('logFilterAction', r.data.actionTypes || []);
}

function renderPagination() {
  const info = document.getElementById('logPaginationInfo');
  const btns = document.getElementById('logPaginationBtns');
  if (info) {
    info.textContent = t('admin.logs.pagination', {
      total: state.total || 0,
      page: state.page,
      totalPages: state.totalPages || 1,
    });
  }
  if (!btns) return;
  btns.innerHTML = '';
  const maxBtn = Math.min(state.totalPages || 1, 7);
  for (let i = 1; i <= maxBtn; i += 1) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `admin-users-page-btn${i === state.page ? ' active' : ''}`;
    b.textContent = String(i);
    b.addEventListener('click', () => {
      state.page = i;
      loadList();
    });
    btns.appendChild(b);
  }
}

function formatJsonField(v) {
  if (v == null) return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return v;
    }
  }
  return String(v);
}

async function openDetail(id) {
  const r = await api(`/api/admin/activity-logs/${id}`);
  if (!r || !r.res.ok) {
    showError(apiErr(r?.data, 'api.admin.logs.detail_failed'));
    return;
  }
  const item = r.data.item || {};
  const dlg = document.getElementById('logDetailDialog');
  const meta = document.getElementById('logDetailMeta');
  const oldEl = document.getElementById('logDetailOld');
  const newEl = document.getElementById('logDetailNew');
  if (meta) {
    meta.textContent = [
      `#${item.id}`,
      item.created_at,
      item.username || '-',
      item.module_name,
      item.action_type,
      item.table_name,
      item.record_id,
      item.description || '',
    ].join('\n');
  }
  if (oldEl) oldEl.textContent = formatJsonField(item.old_data);
  if (newEl) newEl.textContent = formatJsonField(item.new_data);
  if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
}

function renderTable(items) {
  const body = document.getElementById('logTableBody');
  const empty = document.getElementById('logEmpty');
  if (!body) return;
  if (!items || !items.length) {
    body.innerHTML = '';
    empty?.classList.remove('is-hidden');
    return;
  }
  empty?.classList.add('is-hidden');
  body.innerHTML = items
    .map(
      (row) => `<tr>
        <td>${esc(row.created_at)}</td>
        <td>${esc(row.full_name || row.username || '-')}</td>
        <td>${esc(row.module_name)}</td>
        <td>${esc(row.action_type)}</td>
        <td>${esc(row.table_name || '-')}</td>
        <td>${esc(row.record_id || '-')}</td>
        <td class="admin-logs-desc">${esc(row.description || '')}</td>
        <td class="app-table-col-action">
          <button type="button" class="btn btn-secondary btn-sm js-log-detail" data-id="${row.id}">${esc(t('admin.logs.view'))}</button>
        </td>
      </tr>`
    )
    .join('');
}

async function loadList() {
  showError('');
  const qs = getFilters().toString();
  const r = await api(`/api/admin/activity-logs?${qs}`);
  if (!r) return;
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.admin.logs.list_failed'));
    return;
  }
  state.total = r.data.total || 0;
  state.totalPages = r.data.totalPages || 0;
  state.page = r.data.page || 1;
  renderTable(r.data.items || []);
  renderPagination();
}

function resetFilters() {
  ['logFilterFrom', 'logFilterTo', 'logFilterUserId', 'logFilterUsername', 'logFilterTable', 'logFilterRecordId', 'logFilterQ'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    }
  );
  const mod = document.getElementById('logFilterModule');
  const act = document.getElementById('logFilterAction');
  if (mod) mod.value = '';
  if (act) act.value = '';
  state.page = 1;
}

async function init() {
  if (window.i18n) {
    await window.i18n.loadDict(window.i18n.getLang());
    window.i18n.apply(document);
  }
  if (typeof window.initGlobalNavigation === 'function') {
    await window.initGlobalNavigation('admin');
  }
  if (typeof window.initAdminPageNav === 'function') {
    await window.initAdminPageNav('logs');
  }
  const me = await api('/api/auth/me');
  if (!me || !me.res.ok) return;
  const u = me.data.user;
  if (u?.role?.slug !== 'super_admin' && !u?.isSuperAdmin) {
    window.location.href = '/';
    return;
  }

  document.getElementById('btnLogFilter')?.addEventListener('click', () => {
    state.page = 1;
    loadList();
  });
  document.getElementById('btnLogReset')?.addEventListener('click', () => {
    resetFilters();
    loadList();
  });
  document.getElementById('logTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.js-log-detail');
    if (!btn) return;
    openDetail(btn.getAttribute('data-id'));
  });
  document.getElementById('btnLogDetailClose')?.addEventListener('click', () => {
    document.getElementById('logDetailDialog')?.close();
  });

  await loadMeta();
  await loadList();
}

init().catch((e) => showError(e.message || t('api.error.unknown')));
