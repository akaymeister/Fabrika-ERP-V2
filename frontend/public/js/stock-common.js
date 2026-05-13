/**
 * Hızlı menü standardı: sayfada <div id="navSlot"></div> + initStockPageNav('anahtar').
 * Anahtarlar: hub | brands | warehouses | products | in | out | receipt | mov
 */
const STOCK_PATH = '/stock.html';

const NAV_FALLBACK_TR = {
  'nav.stock.hub': 'Özet',
  'nav.stock.brands': 'Markalar',
  'nav.stock.warehouses': 'Depolar',
  'nav.stock.products': 'Ürünler',
  'nav.stock.in': 'Stok giriş',
  'nav.stock.out': 'Stok çıkış',
  'nav.stock.receipt': 'Mal kabul',
  'nav.stock.mov': 'Hareketler',
};

function tNav(k) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    const s = window.i18n.t(k);
    if (s && s !== k) {
      return s;
    }
  }
  return NAV_FALLBACK_TR[k] || k;
}

/**
 * Faz 3 granular: her link için "any of" permission listesi. authContext.hasAny()
 * ile filtrelenir. Eski 'module.stock' yetkili kullanıcı (geriye uyum) tüm
 * linkleri görür; sadece 'stock.in.view' yetkili kullanıcı yalnızca Stok Giriş.
 *
 * @param {string} active
 * @param {{ showStockIn?: boolean }} [opts] — Geriye uyum için tutuluyor; artık granular kontrol esastır.
 */
function stockNavHTML(active, opts = {}) {
  const allItems = [
    { href: '/stock.html', key: 'hub', k: 'nav.stock.hub', need: ['module.stock', 'stock.hub.view', 'stock.products.view', 'stock.brands.view', 'stock.warehouses.view', 'stock.in.view', 'stock.out.view', 'stock.movements.view', 'stock.reports.view'] },
    { href: '/stock-brands.html', key: 'brands', k: 'nav.stock.brands', need: ['module.stock', 'stock.brands.view'] },
    { href: '/stock-warehouses.html', key: 'warehouses', k: 'nav.stock.warehouses', need: ['module.stock', 'stock.warehouses.view'] },
    { href: '/stock-products.html', key: 'products', k: 'nav.stock.products', need: ['module.stock', 'stock.products.view'] },
    { href: '/stock-in.html', key: 'in', k: 'nav.stock.in', need: ['module.stock', 'stock.in.view'] },
    { href: '/stock-out.html', key: 'out', k: 'nav.stock.out', need: ['module.stock', 'stock.out.view'] },
    { href: '/goods-receipt.html', key: 'receipt', k: 'nav.stock.receipt', need: ['module.stock', 'module.purchasing.receipt', 'module.purchasing', 'purchasing.receipt.view', 'purchasing.receipt.create'] },
    { href: '/stock-movements.html', key: 'mov', k: 'nav.stock.mov', need: ['module.stock', 'stock.movements.view'] },
  ];

  const ctx = (typeof window !== 'undefined' && window.authContext) || null;
  const isSuper = ctx && typeof ctx.isSuperAdmin === 'function' && ctx.isSuperAdmin();

  // Eski opts.showStockIn parametresi: super_admin için Stok Giriş'i zorla göster.
  // Granular dünyada: stock.in.view veya module.stock varsa zaten görünür.
  const forceStockIn = opts && opts.showStockIn === true;

  const items = allItems.filter((i) => {
    if (isSuper) return true;
    if (i.key === 'in' && forceStockIn) return true;
    if (ctx && typeof ctx.hasAny === 'function') {
      return ctx.hasAny(i.need);
    }
    // authContext yoksa eski davranışa düş: stock.in ve receipt için showStockIn baz alınır,
    // diğerleri gösterilir (geriye uyum — nadir yol).
    if (i.key === 'in') return forceStockIn;
    return true;
  });

  return `<nav class="stock-nav app-sub-nav" aria-label="Stock module">
    ${items
      .map(
        (i) =>
          `<a href="${i.href}" class="${i.key === active ? 'active' : ''}" data-i18n="${i.k}">${tNav(
            i.k
          )}</a>`
      )
      .join('')}
  </nav>`;
}

async function loadErpPublicConfig() {
  if (window.__erpCurrency !== undefined && window.__erpPublicCfg) {
    return window.__erpCurrency;
  }
  let cur = 'UZS';
  try {
    const res = await fetch('/api/public/config', { cache: 'no-store' });
    const d = await res.json();
    if (d.defaultCurrency) {
      cur = String(d.defaultCurrency).toUpperCase();
    }
  } catch {
    /* keep default */
  }
  window.__erpCurrency = cur;
  window.__erpPublicCfg = true;
  return cur;
}

async function stockApi(path, options = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : { message: (await res.text().catch(() => '')).slice(0, 200) || res.statusText };
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

function fmtMoney(n) {
  const c = window.__erpCurrency || 'UZS';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(
      Number(n) || 0
    );
  } catch {
    return `${Number(n) || 0} ${c}`;
  }
}

function fmtQty(n) {
  const x = Number(n) || 0;
  try {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(x);
  } catch {
    return String(Math.round(x * 100) / 100);
  }
}

function fmtUsd(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
      Number(n) || 0
    );
  } catch {
    return `$${(Number(n) || 0).toFixed(2)}`;
  }
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString();
}

/**
 * Görüntü: Türkçe büyük (I/İ) — formlar ve tablo ile aynı kural
 * @param {string} s
 */
function toUpperTrClient(s) {
  return String(s || '').toLocaleUpperCase('tr-TR');
}

/**
 * Bosh stok sahifasida i18n yuklangach navigatsiyani chizish.
 */
async function initStockPageNav(active) {
  if (typeof window.initGlobalNavigation === 'function') {
    await window.initGlobalNavigation('stock');
  }
  if (window.i18n && window.i18n.loadDict) {
    await window.i18n.loadDict(window.i18n.getLang());
  }
  // Faz 3: showStockIn artık granular — module.stock veya stock.in.view yeterli.
  let showStockIn = false;
  if (window.authContext && typeof window.authContext.load === 'function') {
    await window.authContext.load();
    showStockIn =
      window.authContext.isSuperAdmin() ||
      window.authContext.hasAny(['module.stock', 'stock.in.view']);
  }
  const slot = document.getElementById('navSlot');
  if (slot) {
    slot.innerHTML = stockNavHTML(active, { showStockIn });
  }
  const panelIn = document.getElementById('stockPanelLinkIn');
  if (panelIn) {
    panelIn.style.display = showStockIn ? '' : 'none';
  }
  if (window.i18n && window.i18n.apply) {
    window.i18n.apply(document);
  }
  await loadErpPublicConfig();
}

window.stockNavHTML = stockNavHTML;
window.stockApi = stockApi;
window.fmtMoney = fmtMoney;
window.fmtQty = fmtQty;
window.fmtUsd = fmtUsd;
window.fmtDate = fmtDate;
window.STOCK_PATH = STOCK_PATH;
window.loadErpPublicConfig = loadErpPublicConfig;
window.initStockPageNav = initStockPageNav;
window.toUpperTrClient = toUpperTrClient;
