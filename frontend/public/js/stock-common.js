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

function stockNavHTML(active) {
  const items = [
    { href: '/stock.html', key: 'hub', k: 'nav.stock.hub' },
    { href: '/stock-brands.html', key: 'brands', k: 'nav.stock.brands' },
    { href: '/stock-warehouses.html', key: 'warehouses', k: 'nav.stock.warehouses' },
    { href: '/stock-products.html', key: 'products', k: 'nav.stock.products' },
    { href: '/stock-in.html', key: 'in', k: 'nav.stock.in' },
    { href: '/stock-out.html', key: 'out', k: 'nav.stock.out' },
    { href: '/goods-receipt.html', key: 'receipt', k: 'nav.stock.receipt' },
    { href: '/stock-movements.html', key: 'mov', k: 'nav.stock.mov' },
  ];
  return `<nav class="stock-nav" aria-label="Stock module">
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
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(Number(n) || 0);
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
  if (window.i18n && window.i18n.loadDict) {
    await window.i18n.loadDict(window.i18n.getLang());
  }
  const slot = document.getElementById('navSlot');
  if (slot) {
    slot.innerHTML = stockNavHTML(active);
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
