/**
 * IK modulu hizli menu standardi: <div id="navSlot"></div> + initHrPageNav(activeKey)
 * Anahtarlar: hub | employees | employee-form | structure | attendance
 */
const HR_NAV_FALLBACK_TR = {
  'nav.hr.hub': 'IK PANELI',
  'nav.hr.employees': 'PERSONELLER',
  'nav.hr.employeeForm': 'PERSONEL KARTI',
  'nav.hr.structure': 'DEPARTMAN / POZISYON',
  'nav.hr.attendance': 'PUANTAJ',
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
    { href: '/hr-attendance.html', key: 'attendance', k: 'nav.hr.attendance' },
  ];
  return `<nav class="stock-nav" aria-label="HR">
    ${items
      .map((i) => `<a href="${i.href}" class="${i.key === active ? 'active' : ''}" data-i18n="${i.k}">${tHrNav(i.k)}</a>`)
      .join('')}
  </nav>`;
}

async function hrApi(path, options = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
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

window.hrNavHTML = hrNavHTML;
window.hrApi = hrApi;
window.initHrPageNav = initHrPageNav;
