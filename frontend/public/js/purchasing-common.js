/**
 * Hızlı menü standardı: sayfada <div id="navSlot"></div> + initPurchasingPageNav('anahtar').
 * Anahtarlar: openreq | listreq | appr | proc | suppliers | hub
 */
const PUR_NAV_FALLBACK_TR = {
  'nav.purch.requisitionOpen': 'TALEP AÇ',
  'nav.purch.requests': 'TALEPLER & ONAY',
  'nav.purch.approvals': 'YÖNETİCİ ONAYLARI',
  'nav.purch.processing': 'SATINALMA İŞLEME',
  'nav.purch.suppliers': 'TEDARİKÇİLER',
  'nav.purch.hub': 'SATINALMA',
};

function tNav(k) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    const s = window.i18n.t(k);
    if (s && s !== k) {
      return s;
    }
  }
  return PUR_NAV_FALLBACK_TR[k] || k;
}

let __purScope = { canPurchasing: false, canRequest: false, canApprove: false, canReceipt: false, canStock: false };

/**
 * Görünebilir herhangi bir satınalma ekranı var mı
 */
function hasAnyPurchasingNav() {
  return !!(
    __purScope.canPurchasing ||
    __purScope.canRequest ||
    __purScope.canApprove ||
    __purScope.canReceipt ||
    __purScope.canStock
  );
}

function purchasingNavHTML(active) {
  const items = [
    { href: '/purchase-requisition-open.html', key: 'openreq', k: 'nav.purch.requisitionOpen', need: 'request' },
    { href: '/purchase-requests.html', key: 'listreq', k: 'nav.purch.requests', need: 'see' },
    { href: '/purchase-requests.html?pending', key: 'appr', k: 'nav.purch.approvals', need: 'approve' },
    { href: '/purchase-processing.html', key: 'proc', k: 'nav.purch.processing', need: 'purch' },
    { href: '/suppliers.html', key: 'suppliers', k: 'nav.purch.suppliers', need: 'purch' },
    { href: '/purchasing.html', key: 'hub', k: 'nav.purch.hub', need: 'any' },
  ];
  return `<nav class="stock-nav app-sub-nav" aria-label="Purchasing">
    ${items
      .map((i) => {
        if (i.need === 'any' && !hasAnyPurchasingNav()) {
          return '';
        }
        if (i.need === 'request' && !__purScope.canRequest && !__purScope.canPurchasing) {
          return '';
        }
        if (i.need === 'see' && !__purScope.canRequest && !__purScope.canApprove && !__purScope.canPurchasing) {
          return '';
        }
        if (i.need === 'approve' && !__purScope.canApprove) {
          return '';
        }
        if (i.need === 'purch' && !__purScope.canPurchasing) {
          return '';
        }
        if (i.need === 'receipt' && !(__purScope.canReceipt || __purScope.canPurchasing || __purScope.canStock)) {
          return '';
        }
        return `<a href="${i.href}" class="${i.key === active ? 'active' : ''}" data-i18n="${i.k}">${tNav(i.k)}</a>`;
      })
      .join('')}
  </nav>`;
}

async function purApi(path, options) {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...((options && options.headers) || {}) },
      ...options,
    });
    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : { message: (await res.text().catch(() => '')).slice(0, 200) };
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
 * @param {string} url api path with optional ?type=
 * @param {File} file
 * @param {'image'|'pdf'} kind
 */
async function purApiUploadFile(url, file, kind) {
  const fd = new FormData();
  fd.append('file', file);
  const u = url + (url.includes('?') ? '&' : '?') + 'type=' + encodeURIComponent(kind);
  try {
    const res = await fetch(u, { method: 'POST', body: fd, credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
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
    return { res: null, data: { message: e.message }, ok: false, status: 0 };
  }
}

async function loadPurchasingScope() {
  const { ok, data } = await purApi('/api/purchasing/scope');
  if (ok && data && data.ok) {
    __purScope = {
      canPurchasing: !!data.canPurchasing,
      canRequest: !!data.canRequest,
      canApprove: !!data.canApprove,
      canReceipt: !!data.canReceipt,
      canStock: !!data.canStock,
    };
  } else {
    __purScope = { canPurchasing: true, canRequest: true, canApprove: true, canReceipt: true, canStock: true };
  }
  return __purScope;
}

async function initPurchasingPageNav(active) {
  if (typeof window.initGlobalNavigation === 'function') {
    await window.initGlobalNavigation('purchasing');
  }
  if (window.i18n && window.i18n.loadDict) {
    await window.i18n.loadDict(window.i18n.getLang());
  }
  await loadPurchasingScope();
  const slot = document.getElementById('navSlot');
  if (slot) {
    slot.innerHTML = purchasingNavHTML(active);
  }
  if (window.i18n && window.i18n.apply) {
    window.i18n.apply(document);
  }
  if (window.loadErpPublicConfig) {
    await window.loadErpPublicConfig();
  } else {
    try {
      const r = await fetch('/api/public/config', { cache: 'no-store' });
      const d = await r.json();
      if (d && d.data && d.data.defaultCurrency) {
        window.__erpCurrency = String(d.data.defaultCurrency).toUpperCase();
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Mal kabul: üstte stok modülü hızlı menüsü, altında satınalma modülü (depo + satınalmacı için).
 * @param {string} stockActive stock-common anahtarı (örn. 'receipt')
 * @param {string} purActive purchasing-common anahtarı (örn. 'receipt')
 */
async function initStockAndPurchasingPageNav(stockActive, purActive) {
  if (typeof window.initGlobalNavigation === 'function') {
    await window.initGlobalNavigation('purchasing');
  }
  if (window.i18n && window.i18n.loadDict) {
    await window.i18n.loadDict(window.i18n.getLang());
  }
  await loadPurchasingScope();
  let showStockIn = false;
  try {
    const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (r.ok) {
      const d = await r.json();
      const u = d && d.user;
      showStockIn = !!(u && (u.isSuperAdmin === true || (u.role && u.role.slug === 'super_admin')));
    }
  } catch {
    /* ignore */
  }
  const slot = document.getElementById('navSlot');
  if (slot) {
    slot.className = 'page-nav-stack';
    const sNav = window.stockNavHTML ? window.stockNavHTML(stockActive, { showStockIn }) : '';
    const pNav = purchasingNavHTML(purActive);
    slot.innerHTML = sNav + pNav;
  }
  const panelIn = document.getElementById('stockPanelLinkIn');
  if (panelIn) {
    panelIn.style.display = showStockIn ? '' : 'none';
  }
  if (window.i18n && window.i18n.apply) {
    window.i18n.apply(document);
  }
  if (window.loadErpPublicConfig) {
    await window.loadErpPublicConfig();
  } else {
    try {
      const r = await fetch('/api/public/config', { cache: 'no-store' });
      const d = await r.json();
      if (d && d.data && d.data.defaultCurrency) {
        window.__erpCurrency = String(d.data.defaultCurrency).toUpperCase();
      }
    } catch {
      /* ignore */
    }
  }
}

function fmtPrice(p) {
  if (p == null || p === '') {
    return '—';
  }
  const c = window.__erpCurrency || 'UZS';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(
      Number(p) || 0
    );
  } catch {
    return `${p} ${c}`;
  }
}

window.purApi = purApi;
window.purApiUploadFile = purApiUploadFile;
window.initPurchasingPageNav = initPurchasingPageNav;
window.initStockAndPurchasingPageNav = initStockAndPurchasingPageNav;
window.loadPurchasingScope = loadPurchasingScope;
window.getPurchasingScope = () => __purScope;
window.purchasingNavHTML = purchasingNavHTML;
window.fmtPrice = fmtPrice;
