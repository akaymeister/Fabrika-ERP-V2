/**
 * Hızlı menü standardı: sayfada <div id="navSlot"></div> + initProjectPageNav('anahtar').
 * Anahtarlar: hub | add | cost | quotes — stok/satınalma ile aynı .stock-nav şeridi.
 */
const PROJECT_HUB = '/projects.html';

const PROJECT_NAV_FALLBACK_TR = {
  'nav.project.hub': 'Özet',
  'nav.project.add': 'Proje ekle',
  'nav.project.costs': 'Proje maliyet kontrolü',
  'nav.project.quotes': 'Proje fiyat teklifleri',
};

function tProjectNav(k) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    const s = window.i18n.t(k);
    if (s && s !== k) {
      return s;
    }
  }
  return PROJECT_NAV_FALLBACK_TR[k] || k;
}

/**
 * Stok modülü ile aynı: `stock-nav` (tam yatay şerit, aktif koyu arka plan).
 * @param {string} active 'hub' | 'add' | 'cost' | 'quotes'
 */
function projectNavHTML(active) {
  const items = [
    { href: '/projects.html', key: 'hub', k: 'nav.project.hub' },
    { href: '/project-list.html', key: 'add', k: 'nav.project.add' },
    { href: '/project-costs.html', key: 'cost', k: 'nav.project.costs' },
    { href: '/project-quotes.html', key: 'quotes', k: 'nav.project.quotes' },
  ];
  return `<nav class="stock-nav" aria-label="Project module">
    ${items
      .map(
        (i) =>
          `<a href="${i.href}" class="${i.key === active ? 'active' : ''}" data-i18n="${i.k}">${tProjectNav(
            i.k
          )}</a>`
      )
      .join('')}
  </nav>`;
}

async function projectApi(path, options = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');
    const data = isJson
      ? await res.json().catch(() => ({}))
      : { message: (await res.text().catch(() => '')).slice(0, 200) || res.statusText };
    if (res.status === 401) {
      window.location.href = '/login.html';
      return { res, data, ok: false, status: 401 };
    }
    if (res.status === 403) {
      window.location.href = '/?err=forbidden';
      return { res, data, ok: false, status: 403 };
    }
    return { res, data, ok: res.ok, status: res.status };
  } catch (e) {
    return {
      res: null,
      data: { message: e && e.message ? e.message : 'Network', messageKey: 'api.error.network' },
      ok: false,
      status: 0,
    };
  }
}

/**
 * @param {string} active 'hub' | 'code' | 'cost' | 'quotes'
 */
async function initProjectPageNav(active) {
  if (typeof window.initGlobalNavigation === 'function') {
    await window.initGlobalNavigation('project');
  }
  if (window.i18n && window.i18n.loadDict) {
    await window.i18n.loadDict(window.i18n.getLang());
  }
  const slot = document.getElementById('navSlot');
  if (slot) {
    slot.innerHTML = projectNavHTML(active);
  }
  if (window.i18n && window.i18n.apply) {
    window.i18n.apply(document);
  }
}

/**
 * Görüntü: Türkçe büyük (I/İ, i/ı)
 * @param {string} s
 */
function toUpperTrClient(s) {
  return String(s || '').toLocaleUpperCase('tr-TR');
}

window.projectNavHTML = projectNavHTML;
window.projectApi = projectApi;
window.initProjectPageNav = initProjectPageNav;
window.toUpperTrClient = toUpperTrClient;
window.PROJECT_HUB = PROJECT_HUB;
