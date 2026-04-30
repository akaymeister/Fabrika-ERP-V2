/**
 * IK modulu hizli menu standardi: <div id="navSlot"></div> + initHrPageNav(activeKey)
 * Anahtarlar: hub | employees | employee-form | structure | attendance-daily | attendance-monthly | attendance-locks | compensation | payroll
 */
const HR_NAV_FALLBACK_TR = {
  'nav.hr.hub': 'IK paneli',
  'nav.hr.employees': 'Personeller',
  'nav.hr.employeeForm': 'Personel kartı',
  'nav.hr.structure': 'Departman / Pozisyon',
  'nav.hr.attendanceDaily': 'Günlük puantaj',
  'nav.hr.attendanceMonthly': 'Aylık puantaj',
  'nav.hr.attendanceLocks': 'Ay kilitleri',
  'nav.hr.compensation': 'Ücret değerlendirme',
  'nav.hr.payroll': 'Bordro yönetimi',
  'nav.hr.settings': 'Ayarlar',
};

function tHrNav(k) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    const s = window.i18n.t(k);
    if (s && s !== k) return s;
  }
  return HR_NAV_FALLBACK_TR[k] || k;
}

function hrNavHTML(active) {
  const items = [
    { href: '/hr.html', key: 'hub', k: 'nav.hr.hub' },
    { href: '/hr-employees.html', key: 'employees', k: 'nav.hr.employees' },
    { href: '/hr-employee-form.html', key: 'employee-form', k: 'nav.hr.employeeForm' },
    { href: '/hr-structure.html', key: 'structure', k: 'nav.hr.structure' },
    { href: '/hr-attendance.html', key: 'attendance-daily', k: 'nav.hr.attendanceDaily' },
    { href: '/hr-attendance-monthly.html', key: 'attendance-monthly', k: 'nav.hr.attendanceMonthly' },
    { href: '/hr-attendance-locks.html', key: 'attendance-locks', k: 'nav.hr.attendanceLocks' },
    { href: '/hr-compensation.html', key: 'compensation', k: 'nav.hr.compensation' },
    { href: '/hr-payroll.html', key: 'payroll', k: 'nav.hr.payroll' },
    { href: '/hr-settings.html', key: 'settings', k: 'nav.hr.settings' },
  ];
  return `<nav class="stock-nav app-sub-nav" aria-label="HR">
    ${items
      .map((i) => `<a href="${i.href}" class="${i.key === active ? 'active' : ''}" data-i18n="${i.k}">${tHrNav(i.k)}</a>`)
      .join('')}
  </nav>`;
}

async function hrApi(path, options = {}) {
  try {
    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = { ...(options.headers || {}) };
    if (!isForm && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (isForm) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers,
      ...options,
    });
    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : { message: (await res.text().catch(() => '')).slice(0, 300) };
    if (res.status === 401) {
      window.location.href = '/login.html';
      return { ok: false, status: 401, res, data };
    }
    if (res.status === 403) {
      window.location.href = '/?err=forbidden';
      return { ok: false, status: 403, res, data };
    }
    return { ok: res.ok, status: res.status, res, data };
  } catch (e) {
    return { ok: false, status: 0, res: null, data: { message: e && e.message ? e.message : 'Network' } };
  }
}

async function initHrPageNav(active) {
  if (typeof window.initGlobalNavigation === 'function') {
    await window.initGlobalNavigation('hr');
  }
  if (window.i18n && window.i18n.loadDict) {
    await window.i18n.loadDict(window.i18n.getLang());
  }
  const slot = document.getElementById('navSlot');
  if (slot) {
    slot.innerHTML = hrNavHTML(active);
  }
  if (window.i18n && window.i18n.apply) {
    window.i18n.apply(document);
  }
}

/**
 * İK sayfalarında sayfa bazlı yetki kontrolü (statik HTML için).
 * @param {string} permKey permissions.perm_key
 * @returns {Promise<boolean>}
 */
async function hrAssertPermission(permKey) {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) {
      window.location.href = '/login.html';
      return false;
    }
    const data = await res.json().catch(() => ({}));
    const u = data && data.user;
    if (!u) {
      window.location.href = '/login.html';
      return false;
    }
    if (u.isSuperAdmin === true) return true;
    const list = Array.isArray(u.permissions) ? u.permissions : [];
    if (list.includes(permKey)) return true;
    window.location.href = '/?err=forbidden';
    return false;
  } catch {
    window.location.href = '/?err=forbidden';
    return false;
  }
}

window.hrNavHTML = hrNavHTML;
window.hrApi = hrApi;
window.initHrPageNav = initHrPageNav;
window.hrAssertPermission = hrAssertPermission;
