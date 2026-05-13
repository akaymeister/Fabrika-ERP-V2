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

// "Sistem yöneticisi hesabı aç" akışında dropdown'da gösterilecek slug seti.
// Personel hesabı için staff otomatik atanır (formNewUser employee akışı).
// Legacy operasyonel roller (depocu, yonetici, satin_almaci) burada gösterilmez.
const SYSTEM_ADMIN_NEW_USER_SLUGS = new Set(['super_admin', 'admin']);

function isLegacySubject(subject) {
  if (!subject || subject.type !== 'system_role') return false;
  if (typeof subject.is_legacy === 'boolean') return subject.is_legacy;
  if (typeof subject.is_assignable === 'boolean') return !subject.is_assignable;
  return false;
}

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
      // Backend'in geri dönüşüne ek olarak frontend de güvenlik için filtreler:
      // sadece "Sistem yöneticisi hesabı" akışında super_admin / admin.
      if (isLegacySubject(s)) continue;
      if (!SYSTEM_ADMIN_NEW_USER_SLUGS.has(String(s.code || ''))) continue;
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
      const legacyTag = isLegacySubject(s) ? '[LEGACY ROLE] ' : '';
      o.textContent = `${legacyTag}${prefix}: ${s.name}${code}`;
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
  // Operasyonel yetki bir personele bağlıysa pozisyon önceliklidir; aksi halde sistem rolü gösterilir.
  const posId = Number(user?.employee_position_id);
  if (Number.isFinite(posId) && posId > 0) return `hr_position:${posId}`;
  const rid = Number(user?.role_id);
  if (Number.isFinite(rid) && rid > 0) return `system_role:${rid}`;
  return '';
}

function userSubjectMetaText(user) {
  const roleSlug = String(user?.role_slug || '').toLowerCase();
  const roleName = user?.role_name || roleSlug || '-';
  const posName = user?.employee_position_name || '-';
  return `system=${roleName}; position=${posName}`;
}

function legacyRoleWarnHtml(user) {
  // Kullanıcının mevcut role_slug'ı legacy operasyonel ise UI'da küçük bir uyarı bas:
  // yeni atama yapılamaz, izinleri pozisyondan akmaya geçilmesi tavsiye edilir.
  const slug = String(user?.role_slug || '').toLowerCase();
  const LEGACY = new Set(['depocu', 'yonetici', 'satin_almaci']);
  if (!LEGACY.has(slug)) return '';
  return `<div class="admin-role-legacy-warn" role="note">⚠ [LEGACY ROLE] ${esc(slug)} — Yeni atama yapılamaz. Operasyonel yetkiyi İK pozisyonu üzerinden verin.</div>`;
}

function userSubjectOptionsHtml(user) {
  const selected = userSelectedSubjectValue(user);
  const options = [];
  for (const s of permissionSubjects) {
    const value = `${s.type}:${s.id}`;
    const prefix = s.type === 'system_role' ? 'Sistem Rolu' : 'IK Pozisyonu';
    const code = s.code ? ` (${s.code})` : '';
    const legacy = isLegacySubject(s);
    // Legacy rol seçeneği yalnızca mevcut seçili değerse listede tutulur (kullanıcı
    // legacy rolünden çıkana kadar görünür kalsın); yeni atama için disabled.
    if (legacy && value !== selected) continue;
    const legacyTag = legacy ? '[LEGACY ROLE] ' : '';
    const disabledAttr = legacy ? ' disabled' : '';
    options.push(
      `<option value="${value}" ${value === selected ? 'selected' : ''}${disabledAttr}>${legacyTag}${esc(prefix)}: ${esc(s.name)}${esc(code)}</option>`
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

/**
 * Permission catalog'unu modül prefix'ine göre gruplar.
 * Sıra: purchasing → stock → hr → projects → system → other.
 * Her grup içinde 'module.*' anahtarları en üstte, kalanlar alfabetik.
 */
const PERM_GROUP_DEFS = [
  {
    id: 'purchasing',
    i18nKey: 'admin.perm.group.purchasing',
    fallback: 'SATINALMA',
    match: (k) => k.startsWith('purchasing.') || k.startsWith('module.purchasing'),
  },
  {
    id: 'stock',
    i18nKey: 'admin.perm.group.stock',
    fallback: 'STOK',
    match: (k) => k.startsWith('stock.') || k === 'module.stock',
  },
  {
    id: 'hr',
    i18nKey: 'admin.perm.group.hr',
    fallback: 'İK',
    match: (k) => k.startsWith('hr.') || k === 'module.hr',
  },
  {
    id: 'projects',
    i18nKey: 'admin.perm.group.projects',
    fallback: 'PROJE',
    match: (k) => k.startsWith('projects.') || k === 'module.projects',
  },
  {
    id: 'system',
    i18nKey: 'admin.perm.group.system',
    fallback: 'SİSTEM / YÖNETİM',
    match: (k) => k.startsWith('users.') || k.startsWith('roles.') || k.startsWith('admin.'),
  },
];
const PERM_GROUP_OTHER = { id: 'other', i18nKey: 'admin.perm.group.other', fallback: 'DİĞER' };

function groupPermissions(list) {
  const groups = PERM_GROUP_DEFS.map((g) => ({ ...g, items: [] }));
  const other = { ...PERM_GROUP_OTHER, items: [] };
  for (const p of list) {
    const key = String(p.perm_key || '');
    let placed = false;
    for (const g of groups) {
      if (g.match(key)) {
        g.items.push(p);
        placed = true;
        break;
      }
    }
    if (!placed) other.items.push(p);
  }
  const sortFn = (a, b) => {
    const ak = String(a.perm_key || '');
    const bk = String(b.perm_key || '');
    const am = ak.startsWith('module.') ? 0 : 1;
    const bm = bk.startsWith('module.') ? 0 : 1;
    if (am !== bm) return am - bm;
    return ak.localeCompare(bk);
  };
  groups.forEach((g) => g.items.sort(sortFn));
  other.items.sort(sortFn);
  return groups.filter((g) => g.items.length > 0).concat(other.items.length > 0 ? [other] : []);
}

function tOrFallback(key, fallback) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    const v = window.i18n.t(key);
    if (v && v !== key) return v;
  }
  return fallback;
}

function syncGroupState(groupEl) {
  const children = [...groupEl.querySelectorAll('input.perm-row-input')];
  const checkedChildren = children.filter((c) => c.checked).length;
  const total = children.length;
  const toggle = groupEl.querySelector('input.perm-group-toggle');
  if (toggle) {
    if (total === 0 || checkedChildren === 0) {
      toggle.checked = false;
      toggle.indeterminate = false;
    } else if (checkedChildren === total) {
      toggle.checked = true;
      toggle.indeterminate = false;
    } else {
      toggle.checked = false;
      toggle.indeterminate = true;
    }
  }
  const countEl = groupEl.querySelector('.perm-group-count');
  if (countEl) countEl.textContent = `${checkedChildren} / ${total}`;
}

function bindPermGroupEvents(container) {
  if (container.__permGroupBound) return;
  container.__permGroupBound = true;

  // change: hem grup toggle hem satır checkbox.
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.classList.contains('perm-group-toggle')) {
      const groupEl = t.closest('.perm-group');
      if (!groupEl) return;
      const next = !!t.checked;
      groupEl.querySelectorAll('input.perm-row-input').forEach((cb) => {
        cb.checked = next;
      });
      syncGroupState(groupEl);
      // Faz 4.1.a: filtre aktifse count badge ve "sadece seçili" görünümü tazelenir.
      applyPermFilters(container.id);
      // Faz 4.1.b: izin değişikliği → dirty.
      markPermDirty(container.id);
      return;
    }
    if (t.classList.contains('perm-row-input')) {
      const groupEl = t.closest('.perm-group');
      if (groupEl) syncGroupState(groupEl);
      applyPermFilters(container.id);
      markPermDirty(container.id);
    }
  });

  // <summary> tıklaması details'i toggle eder; içindeki checkbox click'in
  // accordion'u kapatmasını engelle.
  container.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t instanceof HTMLInputElement && t.classList.contains('perm-group-toggle')) {
      ev.stopPropagation();
    }
  });
}

function renderCheckboxes(containerId, checkedIds) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const set = new Set(checkedIds);
  const groups = groupPermissions(catalog);
  c.classList.add('perm-list-grouped');

  if (!groups.length) {
    c.innerHTML = '';
    return;
  }

  c.innerHTML = groups
    .map((g) => {
      const groupLabel = tOrFallback(g.i18nKey, g.fallback);
      const itemsHtml = g.items
        .map(
          (p) => `<label class="perm-row">
              <input type="checkbox" class="perm-row-input" value="${p.id}" data-perm-id="${p.id}" data-group="${esc(
            g.id
          )}" ${set.has(p.id) ? 'checked' : ''} />
              <span class="perm-row-text">
                <span class="perm-row-name">${esc(p.name)}</span>
                <code class="perm-row-key">${esc(p.perm_key)}</code>
              </span>
            </label>`
        )
        .join('');
      return `<details class="perm-group" data-group="${esc(g.id)}">
          <summary class="perm-group-header">
            <input type="checkbox" class="perm-group-toggle" aria-label="${esc(groupLabel)}" />
            <span class="perm-group-title" data-i18n="${esc(g.i18nKey)}">${esc(groupLabel)}</span>
            <span class="perm-group-count" aria-hidden="true">0 / ${g.items.length}</span>
            <span class="perm-group-caret" aria-hidden="true"></span>
          </summary>
          <div class="perm-group-items">${itemsHtml}</div>
        </details>`;
    })
    .join('');

  // Grupların initial state'lerini hesapla + event'leri tek seferlik bağla.
  c.querySelectorAll('.perm-group').forEach((groupEl) => syncGroupState(groupEl));
  bindPermGroupEvents(c);
  // Faz 4.1.a: yeniden render sonrası mevcut filtreler yeniden uygulanır.
  applyPermFilters(containerId);
  // Faz 4.1.b: server'dan yeni veri → temiz başlangıç.
  markPermClean(containerId);
}

function getCheckedIds(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return [];
  // YALNIZCA satır checkbox'ları — grup toggle ve indeterminate'ler hariç.
  return [...c.querySelectorAll('input.perm-row-input:checked')].map((i) => +i.value);
}

/**
 * Faz 4.1.a: Permission listesi için canlı arama + "sadece seçili" filtre.
 *
 * Tasarım kuralları:
 *   - Backend'e dokunmaz; tamamen DOM tarafında show/hide.
 *   - Filtreler renderCheckboxes sonrası ve her checkbox change sonrası
 *     yeniden uygulanır (kullanıcı bir kutuyu tikleyince "sadece seçili"
 *     görünümü canlı güncellenir).
 *   - Filtre aktifken grup count badge "görünür / toplam" formatına döner;
 *     filtre kapanınca "seçili / toplam"a geri döner (syncGroupState).
 *   - Boş sonuçta perm-empty-state görünür.
 *
 * Filtre çubuğu: <div class="perm-filter-bar" data-perm-target="<containerId>">
 *   .perm-search-input             - canlı arama (debounce)
 *   .perm-search-clear             - X butonu
 *   .perm-only-selected-input      - sadece seçili toggle
 *
 * Empty state: <div class="perm-empty-state" data-perm-target="<containerId>">
 */
const __permFilterDebounce = new Map();

function getPermFilterBar(containerId) {
  return document.querySelector(`.perm-filter-bar[data-perm-target="${containerId}"]`);
}

function getPermEmptyState(containerId) {
  return document.querySelector(`.perm-empty-state[data-perm-target="${containerId}"]`);
}

function getPermFilterState(containerId) {
  const bar = getPermFilterBar(containerId);
  const q = String(bar?.querySelector('.perm-search-input')?.value || '')
    .toLocaleLowerCase('tr-TR')
    .trim();
  const onlySelected = !!bar?.querySelector('.perm-only-selected-input')?.checked;
  return { q, onlySelected, active: !!q || onlySelected };
}

/**
 * @param {string} containerId  'rolePermList' | 'userPermList'
 */
function applyPermFilters(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const { q, onlySelected, active } = getPermFilterState(containerId);

  // Clear butonu görünürlüğü.
  const bar = getPermFilterBar(containerId);
  const clearBtn = bar?.querySelector('.perm-search-clear');
  if (clearBtn) clearBtn.hidden = !q;

  let visibleTotal = 0;
  c.querySelectorAll('.perm-group').forEach((groupEl) => {
    let visibleInGroup = 0;
    let totalInGroup = 0;
    let checkedInGroup = 0;
    groupEl.querySelectorAll('.perm-row').forEach((rowEl) => {
      totalInGroup += 1;
      const cb = rowEl.querySelector('input.perm-row-input');
      if (cb && cb.checked) checkedInGroup += 1;
      const nameTxt = (rowEl.querySelector('.perm-row-name')?.textContent || '')
        .toLocaleLowerCase('tr-TR');
      const keyTxt = (rowEl.querySelector('.perm-row-key')?.textContent || '')
        .toLocaleLowerCase('tr-TR');
      const matchesQ = !q || nameTxt.indexOf(q) !== -1 || keyTxt.indexOf(q) !== -1;
      const matchesSel = !onlySelected || (cb && cb.checked);
      const show = matchesQ && matchesSel;
      rowEl.style.display = show ? '' : 'none';
      if (show) visibleInGroup += 1;
    });

    // Grubun görünürlüğü.
    groupEl.style.display = visibleInGroup > 0 ? '' : 'none';

    // Count badge — filtre aktif: "görünür / toplam", değilse: "seçili / toplam".
    const countEl = groupEl.querySelector('.perm-group-count');
    if (countEl) {
      countEl.textContent = active
        ? `${visibleInGroup} / ${totalInGroup}`
        : `${checkedInGroup} / ${totalInGroup}`;
    }

    // Filtre aktifken gruplar otomatik açılsın (kullanıcı eşleşmeleri görsün).
    if (active && visibleInGroup > 0 && groupEl.tagName === 'DETAILS') {
      groupEl.open = true;
    }

    visibleTotal += visibleInGroup;
  });

  const empty = getPermEmptyState(containerId);
  if (empty) empty.hidden = visibleTotal !== 0;
}

/**
 * Filtre çubuğunu containerId hedefine bağlar. Tek seferlik bind; bir kez
 * çağrılınca __bound flag'i ile tekrarı engellenir.
 *
 * @param {string} containerId
 */
function bindPermFilterBar(containerId) {
  const bar = getPermFilterBar(containerId);
  if (!bar || bar.__bound) return;
  bar.__bound = true;

  const input = bar.querySelector('.perm-search-input');
  const clearBtn = bar.querySelector('.perm-search-clear');
  const onlySel = bar.querySelector('.perm-only-selected-input');

  const debounced = () => {
    const prev = __permFilterDebounce.get(containerId);
    if (prev) clearTimeout(prev);
    __permFilterDebounce.set(
      containerId,
      setTimeout(() => applyPermFilters(containerId), 80)
    );
  };

  input?.addEventListener('input', debounced);
  input?.addEventListener('search', () => applyPermFilters(containerId));
  clearBtn?.addEventListener('click', () => {
    if (input) input.value = '';
    applyPermFilters(containerId);
    input?.focus();
  });
  onlySel?.addEventListener('change', () => applyPermFilters(containerId));
}

/**
 * Faz 4.1.b: Kaydedilmemiş değişiklik (dirty) takibi.
 *
 * Kapsam:
 *   - permission checkbox ve grup toggle değişiklikleri → dirty
 *   - applyTemplate (add/replace) → dirty
 *   - filter/search/onlySelected DİRTY SAYILMAZ
 *   - renderCheckboxes (server'dan yeniden yükleme) → clean
 *   - başarılı save sonrası → clean
 *
 * Her liste için ayrı state; iki listenin dirty durumu birbirinden bağımsız.
 * beforeunload uyarısı yalnızca en az bir liste dirty ise gösterilir.
 *
 * Subject değişimi (#roleSelect, #userSelectExtra) sırasında ilgili listenin
 * dirty olması durumunda confirm gösterilir; iptal edilirse select önceki
 * değerine geri alınır.
 */
const __permDirty = { rolePermList: false, userPermList: false };
const __subjectLastValue = { roleSelect: '', userSelectExtra: '' };

const SAVE_BUTTON_BY_LIST = {
  rolePermList: 'btnSaveRolePerms',
  userPermList: 'btnSaveUserPerms',
};

function getPermDirtyBadge(containerId) {
  return document.querySelector(`.perm-dirty-badge[data-perm-target="${containerId}"]`);
}

function refreshPermDirtyUi(containerId) {
  const dirty = !!__permDirty[containerId];
  const badge = getPermDirtyBadge(containerId);
  if (badge) {
    badge.setAttribute('data-state', dirty ? 'dirty' : 'clean');
    const textEl = badge.querySelector('.perm-dirty-text');
    if (textEl) {
      const key = dirty ? 'admin.perm.unsaved' : 'admin.perm.saved';
      const fallback = dirty ? 'Kaydedilmemiş değişiklikler var' : 'Tüm değişiklikler kaydedildi';
      textEl.setAttribute('data-i18n', key);
      textEl.textContent = tOrFallback(key, fallback);
    }
  }
  const btnId = SAVE_BUTTON_BY_LIST[containerId];
  if (btnId) {
    const btn = document.getElementById(btnId);
    if (btn) btn.disabled = !dirty;
  }
}

function markPermDirty(containerId) {
  if (!(containerId in __permDirty)) return;
  if (__permDirty[containerId]) return; // zaten dirty
  __permDirty[containerId] = true;
  refreshPermDirtyUi(containerId);
}

function markPermClean(containerId) {
  if (!(containerId in __permDirty)) return;
  __permDirty[containerId] = false;
  refreshPermDirtyUi(containerId);
}

function isAnyPermDirty() {
  return Object.values(__permDirty).some(Boolean);
}

/** Tek seferlik global beforeunload handler. */
function bindPermBeforeUnload() {
  if (window.__permBeforeUnloadBound) return;
  window.__permBeforeUnloadBound = true;
  window.addEventListener('beforeunload', (ev) => {
    if (!isAnyPermDirty()) return undefined;
    // Modern tarayıcılar mesajı kendileri seçer; sadece returnValue set etmek
    // uyarıyı tetikler.
    const msg = tOrFallback('admin.perm.leaveConfirm', 'Kaydedilmemiş izin değişiklikleri var.');
    ev.preventDefault();
    ev.returnValue = msg;
    return msg;
  });
}

/**
 * Faz 4: Yetki şablonları — opsiyonel hızlı başlangıç.
 *
 * Bu liste yalnızca UI tarafında çalışır:
 *   - Admin bir şablon seçer → checkbox'lar işaretlenir.
 *   - DB'ye yazılmaz. Mevcut "Kaydet" akışı korunur.
 *   - "Mevcut seçimlere ekle" → checkbox state'ini sıfırlamadan ekler.
 *   - "Temizle + uygula" → önce hepsini söker, sonra şablonu işaretler.
 *
 * Yeni şablon eklemek için sadece bu listeye ekleme yeterli; i18n key'ini de
 * 4 dilde tanımlamayı unutmayın (admin.perm.template.opt.<id>).
 */
const PERM_TEMPLATES = [
  {
    id: 'depocu',
    nameKey: 'admin.perm.template.opt.depocu',
    fallback: 'Depocu',
    keys: [
      'stock.hub.view',
      'stock.products.view',
      'stock.in.view',
      'stock.in.create',
      'stock.movements.view',
      'purchasing.request.create',
    ],
  },
  {
    id: 'muhasebeUzmani',
    nameKey: 'admin.perm.template.opt.muhasebeUzmani',
    fallback: 'Muhasebe Uzmanı',
    keys: [
      'hr.hub.view',
      'hr.attendance.view',
      'hr.payroll.view',
      'hr.payroll.edit',
      'hr.salary.view_group',
      'hr.salary.view_total',
      'hr.salary.history_view',
    ],
  },
  {
    id: 'projeSorumlusu',
    nameKey: 'admin.perm.template.opt.projeSorumlusu',
    fallback: 'Proje Sorumlusu',
    keys: ['projects.hub.view', 'projects.control.view', 'purchasing.request.create', 'purchasing.request.view'],
  },
  {
    id: 'satinalmaSorumlusu',
    nameKey: 'admin.perm.template.opt.satinalmaSorumlusu',
    fallback: 'Satınalma Sorumlusu',
    keys: [
      'purchasing.hub.view',
      'purchasing.request.view',
      'purchasing.processing.view',
      'purchasing.order.view',
      'purchasing.order.price_edit',
      'purchasing.suppliers.view',
    ],
  },
  {
    id: 'fabrikaMuduru',
    nameKey: 'admin.perm.template.opt.fabrikaMuduru',
    fallback: 'Fabrika Müdürü',
    // NOT: admin.full şablonda KASTEN yer almaz — kullanıcı kuralı.
    keys: [
      // stock.*.view
      'stock.hub.view',
      'stock.products.view',
      'stock.brands.view',
      'stock.warehouses.view',
      'stock.in.view',
      'stock.out.view',
      'stock.movements.view',
      'stock.reports.view',
      // purchasing.*.view
      'purchasing.hub.view',
      'purchasing.request.view',
      'purchasing.processing.view',
      'purchasing.order.view',
      'purchasing.receipt.view',
      'purchasing.suppliers.view',
      // projects.*.view
      'projects.hub.view',
      'projects.control.view',
      // HR (sınırlı, görüntüleme)
      'hr.hub.view',
      'hr.employees.view',
      'hr.attendance.view',
      'hr.payroll.view',
    ],
  },
];

function fillPermTemplateSelect() {
  const sel = document.getElementById('permTemplateSelect');
  if (!sel) return;
  const placeholderLabel = tOrFallback('admin.perm.template.placeholder', '— Şablon seçin —');
  const opts = [`<option value="">${esc(placeholderLabel)}</option>`];
  for (const tpl of PERM_TEMPLATES) {
    const label = tOrFallback(tpl.nameKey, tpl.fallback);
    opts.push(`<option value="${esc(tpl.id)}">${esc(label)} (${tpl.keys.length})</option>`);
  }
  sel.innerHTML = opts.join('');
}

function getSelectedTemplate() {
  const sel = document.getElementById('permTemplateSelect');
  const id = String(sel?.value || '');
  if (!id) return null;
  return PERM_TEMPLATES.find((x) => x.id === id) || null;
}

/**
 * Catalog'daki perm_key → id eşlemesini bulur.
 * Catalog'da olmayan key sessizce atlanır (örn. ileri sürümler için
 * tanımlı ama DB'ye henüz eklenmemiş anahtarlar — fail-soft).
 */
function templateKeysToCatalogIds(template) {
  if (!template || !Array.isArray(template.keys)) return { ids: [], matched: 0, missing: [] };
  const idByKey = new Map(catalog.map((p) => [String(p.perm_key), p.id]));
  const ids = [];
  const missing = [];
  for (const k of template.keys) {
    const id = idByKey.get(String(k));
    if (id != null) ids.push(id);
    else missing.push(k);
  }
  return { ids, matched: ids.length, missing };
}

function updatePermTemplateInfo() {
  const info = document.getElementById('permTemplateInfo');
  const btnAdd = document.getElementById('btnPermTemplateAdd');
  const btnRep = document.getElementById('btnPermTemplateReplace');
  const tpl = getSelectedTemplate();
  const enabled = !!tpl;
  if (btnAdd) btnAdd.disabled = !enabled;
  if (btnRep) btnRep.disabled = !enabled;
  if (!info) return;
  if (!tpl) {
    info.textContent = '';
    info.classList.remove('is-warning');
    return;
  }
  const { matched, missing } = templateKeysToCatalogIds(tpl);
  const tplName = tOrFallback(tpl.nameKey, tpl.fallback);
  const summary = tOrFallback('admin.perm.template.countInfo', '{name}: {count} izin içerir')
    .replace('{name}', tplName)
    .replace('{count}', String(matched));
  if (missing.length) {
    info.classList.add('is-warning');
    const warn = tOrFallback('admin.perm.template.missingInfo', '{count} anahtar katalogda yok ve atlanacak').replace(
      '{count}',
      String(missing.length)
    );
    info.textContent = `${summary} • ${warn}`;
  } else {
    info.classList.remove('is-warning');
    info.textContent = summary;
  }
}

/**
 * Şablonu rol/pozisyon izinleri listesine uygular.
 * NOT: DB'ye DOKUNMAZ — yalnızca DOM checkbox state'i değişir.
 * Admin "Kaydet" butonuna basana kadar hiçbir şey kalıcı değildir.
 *
 * @param {'add'|'replace'} mode
 */
function applyTemplate(mode) {
  const container = document.getElementById('rolePermList');
  const tpl = getSelectedTemplate();
  if (!container || !tpl) return;
  const { ids } = templateKeysToCatalogIds(tpl);
  const tplIdSet = new Set(ids);

  const inputs = container.querySelectorAll('input.perm-row-input');
  if (!inputs.length) return;

  inputs.forEach((cb) => {
    const id = Number(cb.value);
    const inTemplate = tplIdSet.has(id);
    if (mode === 'replace') {
      cb.checked = inTemplate;
    } else if (mode === 'add') {
      if (inTemplate) cb.checked = true;
    }
  });

  // Tüm grupların state'lerini güncelle (toggle + count badge).
  container.querySelectorAll('.perm-group').forEach((g) => syncGroupState(g));
  // Faz 4.1.a: filtre aktifse görünüm tazelenir.
  applyPermFilters(container.id);
  // Faz 4.1.b: şablon uygulaması kullanıcı eylemidir → dirty.
  markPermDirty(container.id);
}

/** Şablon dropdown'unu init() içinde tek seferlik bağla. */
function bindPermTemplateTool() {
  const sel = document.getElementById('permTemplateSelect');
  const btnAdd = document.getElementById('btnPermTemplateAdd');
  const btnRep = document.getElementById('btnPermTemplateReplace');
  if (!sel || sel.__bound) {
    return;
  }
  sel.__bound = true;
  sel.addEventListener('change', () => {
    clearError();
    updatePermTemplateInfo();
  });
  btnAdd?.addEventListener('click', () => {
    clearError();
    applyTemplate('add');
  });
  btnRep?.addEventListener('click', () => {
    clearError();
    applyTemplate('replace');
  });
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
  // Faz 4: opsiyonel yetki şablonu aracı — catalog yüklendikten sonra dropdown doldurulur.
  fillPermTemplateSelect();
  bindPermTemplateTool();
  updatePermTemplateInfo();
  // Faz 4.1.a: permission listesi filtre çubukları (her iki liste için ayrı state).
  bindPermFilterBar('rolePermList');
  bindPermFilterBar('userPermList');
  // Faz 4.1.b: dirty UI initial state + global beforeunload kancası.
  refreshPermDirtyUi('rolePermList');
  refreshPermDirtyUi('userPermList');
  bindPermBeforeUnload();
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

  // Faz 4.1.b: subject değişimi → dirty ise confirm; iptal edilirse select geri alınır.
  const roleSelEl = document.getElementById('roleSelect');
  __subjectLastValue.roleSelect = String(roleSelEl?.value || '');
  roleSelEl?.addEventListener('change', async (ev) => {
    clearError();
    const nextVal = String(ev.target.value || '');
    if (__permDirty.rolePermList) {
      const ok = window.confirm(tOrFallback('admin.perm.leaveConfirm', 'Kaydedilmemiş izin değişiklikleri var.'));
      if (!ok) {
        ev.target.value = __subjectLastValue.roleSelect;
        return;
      }
    }
    await loadRolePerms();
    __subjectLastValue.roleSelect = nextVal;
  });

  const userSelEl = document.getElementById('userSelectExtra');
  __subjectLastValue.userSelectExtra = String(userSelEl?.value || '');
  userSelEl?.addEventListener('change', async (ev) => {
    clearError();
    const nextVal = String(ev.target.value || '');
    if (__permDirty.userPermList) {
      const ok = window.confirm(tOrFallback('admin.perm.leaveConfirm', 'Kaydedilmemiş izin değişiklikleri var.'));
      if (!ok) {
        ev.target.value = __subjectLastValue.userSelectExtra;
        return;
      }
    }
    await loadUserExtra();
    __subjectLastValue.userSelectExtra = nextVal;
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
    // Faz 4.1.b: başarılı save → temiz duruma dön.
    markPermClean('rolePermList');
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
    markPermClean('userPermList');
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

  await initBrandLogoCard();

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

async function initBrandLogoCard() {
  const previewImg = document.getElementById('brandLogoImg');
  const emptyEl = document.getElementById('brandLogoEmpty');
  const fileInput = document.getElementById('brandLogoInput');
  const chooseBtn = document.getElementById('brandLogoChooseBtn');
  const uploadBtn = document.getElementById('brandLogoUploadBtn');
  const removeBtn = document.getElementById('brandLogoRemoveBtn');
  const fileNameEl = document.getElementById('brandLogoFileName');
  const msgEl = document.getElementById('brandLogoMsg');
  const errEl2 = document.getElementById('brandLogoErr');
  if (!previewImg || !fileInput || !uploadBtn) return;

  function setPreview(url) {
    if (url) {
      previewImg.src = `${url}?_t=${Date.now()}`;
      previewImg.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
      if (removeBtn) removeBtn.hidden = false;
    } else {
      previewImg.removeAttribute('src');
      previewImg.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      if (removeBtn) removeBtn.hidden = true;
    }
  }

  function setMsg(text) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.display = text ? 'block' : 'none';
  }

  function setErr(text) {
    if (!errEl2) return;
    errEl2.textContent = text || '';
    errEl2.style.display = text ? 'block' : 'none';
  }

  async function loadCurrent() {
    try {
      const r = await fetch('/api/admin/settings/brand-logo', { credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(apiErr(d, 'api.error.unknown'));
        return;
      }
      setPreview(d.logoUrl || '');
    } catch (_) {
      setErr(t('api.error.unknown'));
    }
  }

  chooseBtn?.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    setMsg('');
    setErr('');
    const f = fileInput.files && fileInput.files[0];
    if (!f) {
      uploadBtn.disabled = true;
      if (fileNameEl) fileNameEl.textContent = '';
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowed.includes(f.type)) {
      setErr(t('admin.logo.err_invalid_type'));
      uploadBtn.disabled = true;
      if (fileNameEl) fileNameEl.textContent = '';
      fileInput.value = '';
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      setErr(t('admin.logo.err_too_big'));
      uploadBtn.disabled = true;
      if (fileNameEl) fileNameEl.textContent = '';
      fileInput.value = '';
      return;
    }
    if (fileNameEl) fileNameEl.textContent = f.name;
    uploadBtn.disabled = false;
  });

  uploadBtn.addEventListener('click', async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    setMsg('');
    setErr('');
    uploadBtn.disabled = true;
    try {
      const fd = new FormData();
      fd.append('logo', f);
      const r = await fetch('/api/admin/settings/brand-logo', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(apiErr(d, 'api.error.unknown'));
        return;
      }
      setPreview(d.logoUrl || '');
      setMsg(t('admin.logo.uploaded'));
      fileInput.value = '';
      if (fileNameEl) fileNameEl.textContent = '';
    } catch (_) {
      setErr(t('api.error.unknown'));
    } finally {
      uploadBtn.disabled = !(fileInput.files && fileInput.files[0]);
    }
  });

  removeBtn?.addEventListener('click', async () => {
    setMsg('');
    setErr('');
    if (!window.confirm(t('admin.logo.confirm_remove'))) return;
    try {
      const r = await fetch('/api/admin/settings/brand-logo', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(apiErr(d, 'api.error.unknown'));
        return;
      }
      setPreview('');
      setMsg(t('admin.logo.removed'));
    } catch (_) {
      setErr(t('api.error.unknown'));
    }
  });

  await loadCurrent();
}

init().catch((e) => {
  showError(e.message || 'Yükleme hatası');
});
