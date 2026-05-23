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

const state = { page: 1, pageSize: 20, totalPages: 0, pollTimer: null };

function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function statusLabel(st) {
  if (st === 'running') return t('admin.backup.status.running');
  if (st === 'success') return t('admin.backup.status.success');
  if (st === 'failed') return t('admin.backup.status.failed');
  return esc(st);
}

function setRunningUi(running) {
  const btn = document.getElementById('btnBackupRun');
  const hint = document.getElementById('backupRunningHint');
  if (btn) btn.disabled = !!running;
  hint?.classList.toggle('is-hidden', !running);
}

function hasRunning(items) {
  return (items || []).some((r) => r.status === 'running');
}

function renderPagination() {
  const info = document.getElementById('backupPaginationInfo');
  const btns = document.getElementById('backupPaginationBtns');
  if (info) {
    info.textContent = t('admin.backup.pagination', {
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

function renderTable(items) {
  const body = document.getElementById('backupTableBody');
  const empty = document.getElementById('backupEmpty');
  if (!body) return;
  if (!items || !items.length) {
    body.innerHTML = '';
    empty?.classList.remove('is-hidden');
    return;
  }
  empty?.classList.add('is-hidden');
  body.innerHTML = items
    .map((row) => {
      const canDownload = row.status === 'success';
      const canDelete = row.status !== 'running';
      return `<tr>
        <td>${esc(row.started_at)}</td>
        <td>${esc(row.file_name)}</td>
        <td>${row.file_size_bytes != null ? esc(formatBytes(row.file_size_bytes)) : '—'}</td>
        <td>${esc(statusLabel(row.status))}${row.error_message ? `<br><small class="app-muted-text">${esc(row.error_message)}</small>` : ''}</td>
        <td>${esc(row.triggered_by_username || '-')}</td>
        <td class="app-table-col-action">
          <div class="app-action-bar">
            ${canDownload ? `<button type="button" class="btn btn-secondary btn-sm js-backup-dl" data-id="${row.id}">${esc(t('admin.backup.download'))}</button>` : ''}
            ${canDelete ? `<button type="button" class="btn btn-danger btn-sm js-backup-del" data-id="${row.id}">${esc(t('admin.backup.delete'))}</button>` : ''}
          </div>
        </td>
      </tr>`;
    })
    .join('');
}

function schedulePoll(items) {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  if (!hasRunning(items)) {
    setRunningUi(false);
    return;
  }
  setRunningUi(true);
  state.pollTimer = setInterval(() => loadList(true), 3000);
}

async function loadList(silent) {
  if (!silent) showError('');
  const p = new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize) });
  const r = await api(`/api/admin/backup/runs?${p}`);
  if (!r) return;
  if (!r.res.ok) {
    if (!silent) showError(apiErr(r.data, 'api.admin.backup.table_missing'));
    return;
  }
  state.total = r.data.total || 0;
  state.totalPages = r.data.totalPages || 0;
  state.page = r.data.page || 1;
  const items = r.data.items || [];
  renderTable(items);
  renderPagination();
  schedulePoll(items);
}

async function runBackup() {
  showError('');
  const includesUploads = !!document.getElementById('backupIncludeUploads')?.checked;
  const r = await api('/api/admin/backup/runs', {
    method: 'POST',
    body: JSON.stringify({ includesUploads }),
  });
  if (!r) return;
  if (r.res.status === 409) {
    showError(apiErr(r.data, 'api.admin.backup.busy'));
    return;
  }
  if (r.res.status === 503) {
    showError(apiErr(r.data, 'api.admin.backup.mysqldump_missing'));
    return;
  }
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.admin.backup.run_failed'));
    return;
  }
  setRunningUi(true);
  state.page = 1;
  await loadList(true);
}

async function downloadBackup(id) {
  const res = await fetch(`/api/admin/backup/runs/${id}/download`, { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return;
  }
  if (res.status === 403) {
    window.location.href = '/';
    return;
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    showError(apiErr(d, 'api.admin.backup.file_missing'));
    return;
  }
  const blob = await res.blob();
  const disp = res.headers.get('Content-Disposition') || '';
  const m = disp.match(/filename="?([^";]+)"?/i);
  const name = m ? m[1] : `backup-${id}.sql`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteBackup(id) {
  if (!window.confirm(t('admin.backup.confirmDelete'))) return;
  const r = await api(`/api/admin/backup/runs/${id}`, { method: 'DELETE' });
  if (!r || !r.res.ok) {
    showError(apiErr(r?.data, 'api.admin.backup.delete_failed'));
    return;
  }
  await loadList();
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
    await window.initAdminPageNav('backup');
  }
  const me = await api('/api/auth/me');
  if (!me || !me.res.ok) return;
  const u = me.data.user;
  if (u?.role?.slug !== 'super_admin' && !u?.isSuperAdmin) {
    window.location.href = '/';
    return;
  }

  const uploadsCb = document.getElementById('backupIncludeUploads');
  if (uploadsCb) uploadsCb.checked = false;

  document.getElementById('btnBackupRun')?.addEventListener('click', runBackup);
  document.getElementById('backupTableBody')?.addEventListener('click', (e) => {
    const dl = e.target.closest('.js-backup-dl');
    const del = e.target.closest('.js-backup-del');
    if (dl) downloadBackup(dl.getAttribute('data-id'));
    if (del) deleteBackup(del.getAttribute('data-id'));
  });

  await loadList();
}

init().catch((e) => showError(e.message || t('api.error.unknown')));
