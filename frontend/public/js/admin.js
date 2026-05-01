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
  if (!e) return;
  e.textContent = msg;
  e.style.display = 'block';
}
function clearError() {
  const e = errEl();
  if (!e) return;
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

function secondsToHuman(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}sa ${m}dk`;
  if (m > 0) return `${m}dk ${r}sn`;
  return `${r}sn`;
}

function showTunnelMsg(message) {
  const el = document.getElementById('tunnelMsg');
  if (!el) return;
  el.textContent = message || '';
  el.style.display = message ? 'block' : 'none';
}

function setTunnelLastCheck(ok) {
  const el = document.getElementById('tunnelLastCheck');
  if (!el) return;
  if (!ok) {
    el.textContent = 'Son kontrol: başarısız';
    return;
  }
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `Son kontrol: ${hh}:${mm}:${ss}`;
}

function renderTunnelStatus(tunnel) {
  const statusEl = document.getElementById('tunnelStatus');
  const remEl = document.getElementById('tunnelRemaining');
  const urlEl = document.getElementById('tunnelUrl');
  if (statusEl) statusEl.value = tunnel?.isOpen ? t('admin.tunnel.open') : t('admin.tunnel.closed');
  if (remEl) remEl.value = tunnel?.isOpen ? secondsToHuman(tunnel?.remainingSeconds) : '-';
  if (urlEl) urlEl.value = tunnel?.publicUrl || '';
}

let catalog = [];
let roles = [];
let permissionSubjects = [];
let users = [];
const SYSTEM_ROLE_SLUGS = new Set(['super_admin', 'admin']);

function fillRoleSelects() {
  const nr = document.getElementById('newRole');
  const rs = document.getElementById('roleSelect');
  if (nr) {
    nr.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = t('admin.newUser.rolePlaceholder');
    nr.appendChild(placeholder);
    for (const s of permissionSubjects) {
      if (s.type !== 'system_role') continue;
      const slug = String(s.code || '').toLowerCase();
      if (!SYSTEM_ROLE_SLUGS.has(slug)) continue;
      const o = document.createElement('option');
      o.value = `${s.type}:${s.id}`;
      o.textContent = `${s.name} (${s.code})`;
      nr.appendChild(o);
    }
  }
  if (rs) {
    rs.innerHTML = '';
    for (const s of permissionSubjects) {
      const o = document.createElement('option');
      o.value = `${s.type}:${s.id}`;
      const prefix = s.type === 'system_role' ? 'Sistem Rolu' : 'IK Pozisyonu';
      const code = s.code ? ` (${s.code})` : '';
      o.textContent = `${prefix}: ${s.name}${code}`;
      rs.appendChild(o);
    }
  }
}

async function loadUnlinkedEmployeesForNewUser() {
  const sel = document.getElementById('newEmployee');
  if (!sel) return;
  const r = await api('/api/admin/employees/unlinked');
  if (!r || !r.res.ok) {
    showError(apiErr(r?.data, 'api.error.load_unlinked_employees'));
    return;
  }
  const list = r.data.employees || [];
  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = t('admin.newUser.employeePlaceholder');
  sel.appendChild(placeholder);
  for (const e of list) {
    const o = document.createElement('option');
    o.value = String(e.id);
    const dept = e.department_name ? ` — ${e.department_name}` : '';
    const pos = e.position_name ? ` / ${e.position_name}` : '';
    const name = [e.first_name, e.last_name].filter(Boolean).join(' ').trim() || e.full_name || '';
    const no = e.employee_no ? `${e.employee_no} - ` : '';
    o.textContent = `${no}${name}${dept}${pos}`;
    sel.appendChild(o);
  }
}

function syncNewUserAccountFields() {
  const kind = document.querySelector('input[name="newAccountKind"]:checked')?.value || 'system';
  const roleEl = document.getElementById('newRole');
  const empEl = document.getElementById('newEmployee');
  const roleRow = document.getElementById('newUserSystemRow');
  const empRow = document.getElementById('newUserEmployeeRow');
  if (!roleEl || !empEl) return;
  if (kind === 'system') {
    if (roleRow) roleRow.style.display = '';
    if (empRow) empRow.style.display = 'none';
    roleEl.required = true;
    empEl.required = false;
    empEl.disabled = true;
    roleEl.disabled = false;
  } else {
    if (roleRow) roleRow.style.display = 'none';
    if (empRow) empRow.style.display = '';
    roleEl.required = false;
    empEl.required = true;
    empEl.disabled = false;
    roleEl.disabled = true;
  }
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

function userSelectedSubjectValue(user) {
  const roleSlug = String(user?.role_slug || '').toLowerCase();
  if (SYSTEM_ROLE_SLUGS.has(roleSlug)) {
    const rid = Number(user?.role_id);
    if (Number.isFinite(rid) && rid > 0) return `system_role:${rid}`;
  }
  const posId = Number(user?.employee_position_id);
  if (Number.isFinite(posId) && posId > 0) return `hr_position:${posId}`;
  return '';
}

function userSubjectMetaText(user) {
  const roleSlug = String(user?.role_slug || '').toLowerCase();
  const roleName = user?.role_name || roleSlug || '-';
  const posName = user?.employee_position_name || '-';
  return `system=${roleName}; position=${posName}`;
}

function legacyRoleWarnHtml(user) {
  const roleSlug = String(user?.role_slug || '').toLowerCase();
  if (SYSTEM_ROLE_SLUGS.has(roleSlug)) return '';
  return '<div class="admin-users-legacy-warn">Legacy rol algılandı (eski model).</div>';
}

function userSubjectOptionsHtml(user) {
  const selected = userSelectedSubjectValue(user);
  const options = [];
  for (const s of permissionSubjects) {
    const value = `${s.type}:${s.id}`;
    const prefix = s.type === 'system_role' ? 'Sistem Rolu' : 'IK Pozisyonu';
    const code = s.code ? ` (${s.code})` : '';
    options.push(
      `<option value="${value}" ${value === selected ? 'selected' : ''}>${esc(prefix)}: ${esc(s.name)}${esc(code)}</option>`
    );
  }
  if (!selected) {
    options.unshift('<option value="" selected disabled>Secim yapin</option>');
  }
  return options.join('');
}

function renderUserTable() {
  const body = document.getElementById('userTableBody');
  if (!body) return;
  body.innerHTML = users
    .map(
      (u) => `<tr>
    <td title="${esc(u.username)}">
      <div class="admin-user-name-cell">
        <span class="admin-user-avatar">${esc(String(u.username || '?').slice(0, 2).toUpperCase())}</span>
        <strong>${esc(u.username)}</strong>
      </div>
    </td>
    <td class="display-upper" title="${esc(u.full_name)}">${esc(u.full_name)}</td>
    <td title="${esc(u.email || '')}">${esc(u.email || '-')}</td>
    <td>
      <div class="admin-role-wrap">
        <select class="js-user-role app-select admin-users-role-select" data-id="${u.id}">${userSubjectOptionsHtml(u)}</select>
        <div><code class="admin-role-meta-code">${esc(userSubjectMetaText(u))}</code></div>
      </div>
      ${legacyRoleWarnHtml(u)}
    </td>
    <td><span class="admin-status-badge ${u.is_active ? 'is-active' : 'is-passive'}">${u.is_active ? 'Aktif' : 'Pasif'}</span></td>
    <td class="user-actions app-table-col-action">
      <div class="app-action-bar admin-users-actions">
      <button type="button" class="secondary-btn admin-action-btn app-button app-button-secondary" data-act="active" data-id="${u.id}" data-active="${Number(u.is_active) ? 1 : 0}" title="${u.is_active ? t('admin.user.deactivate') : t('admin.user.activate')}">👁</button>
      <button type="button" class="secondary-btn admin-action-btn app-button app-button-secondary" data-act="pass" data-id="${u.id}" title="${t('admin.user.password')}">✎</button>
      </div>
    </td>
  </tr>`
    )
    .join('');
}

function bindUserTableDelegation() {
  const body = document.getElementById('userTableBody');
  if (!body || body.dataset.bound === '1') return;
  body.dataset.bound = '1';
  body.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const sel = target.closest('select.js-user-role[data-id]');
    if (!sel || !body.contains(sel)) return;
    onRoleChange(+sel.getAttribute('data-id'), String(sel.value || ''));
  });
  body.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('button[data-act][data-id]');
    if (!btn || !body.contains(btn)) return;
    const id = +btn.getAttribute('data-id');
    const act = btn.getAttribute('data-act');
    if (act === 'active') onToggleActive(id, +btn.getAttribute('data-active') === 1);
    if (act === 'pass') onResetPassword(id);
  });
}

async function onRoleChange(id, newRoleId) {
  clearError();
  const [subjectType, subjectIdRaw] = String(newRoleId || '').split(':');
  const subjectId = Number(subjectIdRaw);
  if (!subjectType || !Number.isFinite(subjectId) || subjectId < 1) {
    showError('Gecersiz yetki konusu secimi');
    await loadUsers();
    return;
  }
  const { res, data } = await api(`/api/admin/users/${id}/permission-subject`, {
    method: 'PATCH',
    body: JSON.stringify({ subject_type: subjectType, subject_id: subjectId }),
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
  const totalEl = document.getElementById('totalUsersCount');
  if (totalEl) totalEl.textContent = String(users.length);
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

function getSelectedPermissionSubject() {
  const select = document.getElementById('roleSelect');
  const raw = String(select?.value || '');
  const [type, idRaw] = raw.split(':');
  const id = Number(idRaw);
  if (!type || !Number.isFinite(id) || id < 1) return null;
  return { type, id };
}

async function loadPermissionSubjects() {
  const r = await api('/api/admin/permission-subjects');
  if (!r) return;
  if (!r.res.ok) {
    showError(apiErr(r.data, 'api.error.load_roles'));
    return;
  }
  permissionSubjects = r.data.subjects || [];
  fillRoleSelects();
}

async function loadRolePerms() {
  const subject = getSelectedPermissionSubject();
  if (!subject) {
    renderCheckboxes('rolePermList', []);
    return;
  }
  const r = await api(`/api/admin/permission-subjects/${subject.type}/${subject.id}/permissions`);
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
  if (typeof window.initGlobalNavigation === 'function') {
    await window.initGlobalNavigation('admin');
  }
  if (typeof window.initAdminPageNav === 'function') {
    const activeKey = (document.body && document.body.dataset && document.body.dataset.adminNav) || 'home';
    await window.initAdminPageNav(activeKey);
  }
  const me = await api('/api/auth/me');
  if (!me || !me.res.ok) return;
  const u = me.data.user;
  if (u?.role?.slug !== 'super_admin' && !u?.isSuperAdmin) {
    window.location.href = '/';
    return;
  }
  const isSuperAdmin = !!(u?.role?.slug === 'super_admin' || u?.isSuperAdmin);
  const userNameEl = document.getElementById('adminUserName');
  const userRoleEl = document.getElementById('adminUserRole');
  const userAvatarEl = document.getElementById('adminUserAvatar');
  if (userNameEl) userNameEl.textContent = u?.fullName || u?.username || '-';
  if (userRoleEl) userRoleEl.textContent = u?.role?.name || u?.role?.slug || '-';
  if (userAvatarEl) {
    const name = String(u?.fullName || u?.username || 'U').trim();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0].toUpperCase())
      .join('');
    userAvatarEl.textContent = initials || 'U';
  }
  if (isSuperAdmin) {
    const tunnelCard = document.getElementById('tunnelCard');
    if (tunnelCard) tunnelCard.style.display = '';
  }
  clearError();
  bindUserTableDelegation();
  await loadCatalog();
  await loadPermissionSubjects();
  document.querySelectorAll('input[name="newAccountKind"]').forEach((inp) => {
    inp.addEventListener('change', () => {
      clearError();
      syncNewUserAccountFields();
    });
  });
  if (document.getElementById('newEmployee')) {
    await loadUnlinkedEmployeesForNewUser();
    syncNewUserAccountFields();
  }
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
    const subject = getSelectedPermissionSubject();
    if (!subject) return;
    const ids = getCheckedIds('rolePermList');
    const { res, data } = await api(`/api/admin/permission-subjects/${subject.type}/${subject.id}/permissions`, {
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
    const kind = document.querySelector('input[name="newAccountKind"]:checked')?.value || 'system';
    let role_assignment_type;
    let role_assignment_id;
    if (kind === 'system') {
      const rawRole = String(document.getElementById('newRole')?.value || '');
      const [t0, idRaw] = rawRole.split(':');
      role_assignment_type = t0;
      role_assignment_id = +idRaw;
      if (role_assignment_type !== 'system_role' || !Number.isFinite(role_assignment_id) || role_assignment_id < 1) {
        showError(t('admin.newUser.validationSystemRole'));
        return;
      }
    } else {
      role_assignment_type = 'employee';
      role_assignment_id = +document.getElementById('newEmployee')?.value;
      if (!Number.isFinite(role_assignment_id) || role_assignment_id < 1) {
        showError(t('admin.newUser.validationEmployee'));
        return;
      }
    }
    const body = {
      username: document.getElementById('newUsername').value.trim(),
      full_name: toUpperTrClient(document.getElementById('newFullname').value.trim()),
      email: document.getElementById('newEmail').value.trim() || null,
      role_assignment_type,
      role_assignment_id,
      password: document.getElementById('newPass').value,
    };
    const { res, data } = await api('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
    if (!res) return;
    if (!res.ok) {
      showError(apiErr(data, 'api.error.create_failed'));
      return;
    }
    document.getElementById('formNewUser').reset();
    const sysRadio = document.querySelector('input[name="newAccountKind"][value="system"]');
    if (sysRadio) sysRadio.checked = true;
    syncNewUserAccountFields();
    await loadUnlinkedEmployeesForNewUser();
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
  document.getElementById('logoutBtnMenu')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  const userMenuBtn = document.getElementById('adminUserMenuBtn');
  const userMenu = document.getElementById('adminUserMenu');
  function closeUserMenu() {
    if (!userMenu || !userMenuBtn) return;
    userMenu.hidden = true;
    userMenuBtn.setAttribute('aria-expanded', 'false');
  }
  function openUserMenu() {
    if (!userMenu || !userMenuBtn) return;
    userMenu.hidden = false;
    userMenuBtn.setAttribute('aria-expanded', 'true');
  }
  userMenuBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!userMenu) return;
    if (userMenu.hidden) openUserMenu();
    else closeUserMenu();
  });
  document.addEventListener('click', (e) => {
    if (!userMenu || !userMenuBtn || userMenu.hidden) return;
    const target = e.target;
    if (target instanceof Node && (userMenu.contains(target) || userMenuBtn.contains(target))) return;
    closeUserMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUserMenu();
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

  let tunnelPoll = null;
  async function loadTunnelStatus() {
    const r = await api('/api/admin/tunnel/status');
    if (!r?.res) {
      setTunnelLastCheck(false);
      return;
    }
    if (!r.res.ok) {
      showTunnelMsg(apiErr(r.data, 'api.error.unknown'));
      setTunnelLastCheck(false);
      return;
    }
    showTunnelMsg('');
    renderTunnelStatus(r.data.tunnel || {});
    setTunnelLastCheck(true);
  }

  async function startTunnelFor(hours) {
    showTunnelMsg('');
    const r = await api('/api/admin/tunnel/start', {
      method: 'POST',
      body: JSON.stringify({ hours }),
    });
    if (!r?.res) return;
    if (!r.res.ok) {
      showTunnelMsg(apiErr(r.data, 'api.admin.tunnel_start_failed'));
      return;
    }
    renderTunnelStatus(r.data.tunnel || {});
  }

  async function stopTunnelNow() {
    showTunnelMsg('');
    const r = await api('/api/admin/tunnel/stop', { method: 'POST' });
    if (!r?.res) return;
    if (!r.res.ok) {
      showTunnelMsg(apiErr(r.data, 'api.admin.tunnel_stop_failed'));
      return;
    }
    renderTunnelStatus(r.data.tunnel || {});
  }

  document.getElementById('btnTunnel1h')?.addEventListener('click', () => startTunnelFor(1));
  document.getElementById('btnTunnel4h')?.addEventListener('click', () => startTunnelFor(4));
  document.getElementById('btnTunnel8h')?.addEventListener('click', () => startTunnelFor(8));
  document.getElementById('btnTunnelStop')?.addEventListener('click', stopTunnelNow);
  document.getElementById('btnTunnelCopy')?.addEventListener('click', async () => {
    const url = document.getElementById('tunnelUrl')?.value || '';
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      window.appNotify?.success?.(t('admin.tunnel.copied'));
    } catch (_) {
      window.prompt('Linki kopyalayın', url);
    }
  });
  await loadTunnelStatus();
  tunnelPoll = setInterval(loadTunnelStatus, 15000);
  window.addEventListener('beforeunload', () => {
    if (tunnelPoll) clearInterval(tunnelPoll);
  });
}

init().catch((e) => {
  showError(e.message || 'Yükleme hatası');
});
