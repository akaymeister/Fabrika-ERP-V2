const errEl = () => document.getElementById('adminErr');

function t(key) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key);
  }
  return key;
}

function toUpperTrClient(s) {
  return String(s || '').toLocaleUpperCase('tr-TR');
}

function apiErr(data, fallbackKey) {
  const d = data && typeof data === 'object' ? data : null;
  if (d && window.i18n && typeof window.i18n.apiErrorText === 'function') {
    if (d.messageKey || d.message) {
      return window.i18n.apiErrorText(d);
    }
  }
  if (d && d.message) {
    return d.message;
  }
  return t(fallbackKey);
}

function showError(msg) {
  const e = errEl();
  e.textContent = msg;
  e.style.display = 'block';
}
function clearError() {
  const e = errEl();
  e.style.display = 'none';
  e.textContent = '';
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

let catalog = [];
let roles = [];
let users = [];

function fillRoleSelects() {
  const nr = document.getElementById('newRole');
  const rs = document.getElementById('roleSelect');
  const opt = (el) => {
    if (!el) return;
    el.innerHTML = '';
    for (const r of roles) {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = `${r.name} (${r.slug})`;
      el.appendChild(o);
    }
  };
  opt(nr);
  opt(rs);
}

function fillUserSelectExtra() {
  const u = document.getElementById('userSelectExtra');
  if (!u) return;
  u.innerHTML = '';
  for (const us of users) {
    const o = document.createElement('option');
    o.value = us.id;
    o.textContent = `${us.username} — ${us.full_name}`;
    u.appendChild(o);
  }
}

function roleOptionsHtml(selectedId) {
  return roles
    .map(
      (r) =>
        `<option value="${r.id}" ${Number(selectedId) === Number(r.id) ? 'selected' : ''}>${esc(r.name)}</option>`
    )
    .join('');
}

function renderUserTable() {
  const body = document.getElementById('userTableBody');
  if (!body) return;
  body.innerHTML = users
    .map(
      (u) => `<tr>
    <td>${u.id}</td>
    <td><strong>${esc(u.username)}</strong></td>
    <td class="display-upper">${esc(u.full_name)}</td>
    <td>
      <select class="js-user-role" data-id="${u.id}" style="min-width: 140px; font-size: 13px">${roleOptionsHtml(u.role_id)}</select>
      <div><code style="font-size: 11px; color: #64748b">${esc(u.role_slug)}</code></div>
    </td>
    <td>${u.is_active ? t('admin.user.yes') : t('admin.user.no')}</td>
    <td class="user-actions">
      <button type="button" class="secondary-btn" data-act="active" data-id="${u.id}" data-active="${u.is_active}">${u.is_active ? t('admin.user.deactivate') : t('admin.user.activate')}</button>
      <button type="button" class="secondary-btn" data-act="pass" data-id="${u.id}">${t('admin.user.password')}</button>
    </td>
  </tr>`
    )
    .join('');
  body.querySelectorAll('select.js-user-role').forEach((sel) => {
    sel.addEventListener('change', () => onRoleChange(+sel.getAttribute('data-id'), +sel.value));
  });
  body.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = +btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      if (act === 'active') onToggleActive(id, +btn.getAttribute('data-active') === 1);
      if (act === 'pass') onResetPassword(id);
    });
  });
}

async function onRoleChange(id, newRoleId) {
  clearError();
  const { res, data } = await api(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ role_id: newRoleId }),
  });
  if (!res) return;
  if (!res.ok) {
    showError(apiErr(data, 'api.error.role_change'));
    await loadUsers();
    return;
  }
  await loadUsers();
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function onToggleActive(id, currentlyActive) {
  clearError();
  const { res, data } = await api(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: currentlyActive ? 0 : 1 }),
  });
  if (!res) return;
  if (!res.ok) {
    showError(apiErr(data, 'api.error.toggle_failed'));
    return;
  }
  await loadUsers();
}

async function onResetPassword(id) {
  clearError();
  const p = window.prompt(t('admin.promptPass'));
  if (p == null) return;
  if (p.length < 4) {
    showError(t('api.admin.new_password_short'));
    return;
  }
  const { res, data } = await api(`/api/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword: p }),
  });
  if (!res) return;
  if (!res.ok) {
    showError(apiErr(data, 'api.error.reset_failed'));
    return;
  }
  window.alert(t('admin.alert.passOk'));
}

function renderCheckboxes(containerId, checkedIds) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const set = new Set(checkedIds);
  c.innerHTML = catalog
    .map(
      (p) => `<label class="perm-item">
    <input type="checkbox" value="${p.id}" ${set.has(p.id) ? 'checked' : ''} />
    <span><strong>${esc(p.name)}</strong><code>${esc(p.perm_key)}</code></span>
  </label>`
    )
    .join('');
}

function getCheckedIds(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return [];
  return [...c.querySelectorAll('input[type=checkbox]:checked')].map((i) => +i.value);
}

async function loadUsers() {
  const r = await api('/api/admin/users');
  if (!r) return;
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.error.load_users'));
    return;
  }
  users = r.data.users || [];
  renderUserTable();
  fillUserSelectExtra();
}

async function loadCatalog() {
  const r = await api('/api/admin/permissions');
  if (!r) return;
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.error.load_catalog'));
    return;
  }
  catalog = r.data.permissions || [];
}

async function loadRoles() {
  const r = await api('/api/admin/roles');
  if (!r) return;
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.error.load_roles'));
    return;
  }
  roles = r.data.roles || [];
  fillRoleSelects();
}

async function loadRolePerms() {
  const select = document.getElementById('roleSelect');
  const id = +select.value;
  if (!id) return;
  const r = await api(`/api/admin/roles/${id}/permissions`);
  if (!r) return;
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.error.load_role_perms'));
    return;
  }
  renderCheckboxes('rolePermList', r.data.permissionIds || []);
}

async function loadUserExtra() {
  const select = document.getElementById('userSelectExtra');
  const id = +select.value;
  if (!id) return;
  const r = await api(`/api/admin/users/${id}/permissions`);
  if (!r) return;
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.error.load_user_perms'));
    return;
  }
  renderCheckboxes('userPermList', r.data.permissionIds || []);
}

async function init() {
  if (window.i18n) {
    await window.i18n.loadDict(window.i18n.getLang());
    window.i18n.apply(document);
  }
  if (typeof window.initAdminPageNav === 'function') {
    await window.initAdminPageNav('admin');
  }
  const me = await api('/api/auth/me');
  if (!me || !me.res.ok) return;
  const u = me.data.user;
  if (u?.role?.slug !== 'super_admin' && !u?.isSuperAdmin) {
    window.location.href = '/';
    return;
  }
  clearError();
  await loadCatalog();
  await loadRoles();
  await loadUsers();
  const rs = document.getElementById('roleSelect');
  if (rs?.value) {
    await loadRolePerms();
  } else {
    renderCheckboxes('rolePermList', []);
  }
  const ux = document.getElementById('userSelectExtra');
  if (ux && ux.options.length) {
    ux.value = ux.options[0].value;
    await loadUserExtra();
  } else {
    renderCheckboxes('userPermList', []);
  }

  document.getElementById('roleSelect')?.addEventListener('change', () => {
    clearError();
    loadRolePerms();
  });
  document.getElementById('userSelectExtra')?.addEventListener('change', () => {
    clearError();
    loadUserExtra();
  });
  document.getElementById('btnSaveRolePerms')?.addEventListener('click', async () => {
    clearError();
    const id = +document.getElementById('roleSelect').value;
    const ids = getCheckedIds('rolePermList');
    const { res, data } = await api(`/api/admin/roles/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds: ids }),
    });
    if (!res) return;
    if (!res.ok) {
      showError(apiErr(data, 'api.error.save_failed'));
      return;
    }
    window.alert(t('admin.alert.rolePermsOk'));
  });
  document.getElementById('btnSaveUserPerms')?.addEventListener('click', async () => {
    clearError();
    const id = +document.getElementById('userSelectExtra').value;
    const ids = getCheckedIds('userPermList');
    const { res, data } = await api(`/api/admin/users/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds: ids }),
    });
    if (!res) return;
    if (!res.ok) {
      showError(apiErr(data, 'api.error.save_failed'));
      return;
    }
    window.alert(t('admin.alert.userPermsOk'));
  });
  document.getElementById('newFullname')?.addEventListener('blur', function () {
    this.value = toUpperTrClient(this.value);
  });
  document.getElementById('formNewUser')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const body = {
      username: document.getElementById('newUsername').value.trim(),
      full_name: toUpperTrClient(document.getElementById('newFullname').value.trim()),
      email: document.getElementById('newEmail').value.trim() || null,
      role_id: +document.getElementById('newRole').value,
      password: document.getElementById('newPass').value,
    };
    const { res, data } = await api('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
    if (!res) return;
    if (!res.ok) {
      showError(apiErr(data, 'api.error.create_failed'));
      return;
    }
    document.getElementById('formNewUser').reset();
    await loadUsers();
    window.alert(t('admin.alert.userCreated'));
  });
  document.getElementById('btnOpenNew')?.addEventListener('click', () => {
    document.getElementById('newUsername')?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  async function loadSysSettings() {
    const r = await api('/api/admin/settings');
    if (!r?.res?.ok) {
      return;
    }
    const s = r.data.settings || {};
    const c = document.getElementById('defaultCurrency');
    const l = document.getElementById('defaultLocale');
    const p = document.getElementById('projectCodePrefix');
    if (c) {
      c.value = s.default_currency || 'UZS';
    }
    if (l) {
      l.value = s.default_locale || 'tr';
    }
    if (p) {
      p.value = s.project_code_prefix || 'PRJ';
    }
  }
  await loadSysSettings();
  document.getElementById('btnSaveSettings')?.addEventListener('click', async () => {
    const { res, data } = await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        defaultCurrency: document.getElementById('defaultCurrency')?.value?.trim().toUpperCase(),
        defaultLocale: document.getElementById('defaultLocale')?.value?.trim().toLowerCase(),
        projectCodePrefix: document.getElementById('projectCodePrefix')?.value,
      }),
    });
    const m = document.getElementById('setMsg');
    if (!res) {
      return;
    }
    if (res.ok) {
      if (m) {
        m.textContent = t('admin.settingsSaved');
        m.style.display = 'block';
      }
    } else {
      showError(apiErr(data, 'api.error.settings_failed'));
    }
  });
}

init().catch((e) => {
  showError(e.message || 'Yükleme hatası');
});
