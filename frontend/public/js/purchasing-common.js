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

// Faz 3 granular: __purScope hem eski hem yeni flag'leri tutar.
// purchasing-common.js bu objeyi /api/purchasing/scope'tan doldurur.
let __purScope = {
  canPurchasing: false,
  canRequest: false,
  canApprove: false,
  canReceipt: false,
  canStock: false,
  // Faz 3 granular alt flag'ler — backend getScope.granular karşılığı.
  granular: {
    hubView: false,
    requestView: false,
    requestCreate: false,
    requestApprove: false,
    processingView: false,
    orderView: false,
    orderPriceEdit: false,
    receiptView: false,
    receiptCreate: false,
    suppliersView: false,
  },
};

/**
 * Granular helper'lar — sayfa içi buton/satır gating'i için bu fonksiyonları çağırın.
 */
function purCanRequestCreate() {
  return !!(__purScope.granular.requestCreate || __purScope.canRequest || __purScope.canPurchasing);
}
function purCanRequestApprove() {
  return !!(__purScope.granular.requestApprove || __purScope.canApprove);
}
function purCanOrderPriceEdit() {
  return !!(__purScope.granular.orderPriceEdit || __purScope.canPurchasing);
}
function purCanReceiptCreate() {
  return !!(__purScope.granular.receiptCreate || __purScope.canPurchasing || __purScope.canReceipt);
}
function purCanProcessingView() {
  return !!(__purScope.granular.processingView || __purScope.canPurchasing);
}
function purCanSuppliersView() {
  return !!(__purScope.granular.suppliersView || __purScope.canPurchasing);
}

/**
 * Görünebilir herhangi bir satınalma ekranı var mı
 */
function hasAnyPurchasingNav() {
  return !!(
    __purScope.canPurchasing ||
    __purScope.canRequest ||
    __purScope.canApprove ||
    __purScope.canReceipt ||
    __purScope.canStock ||
    __purScope.granular.hubView ||
    __purScope.granular.requestView ||
    __purScope.granular.requestCreate ||
    __purScope.granular.requestApprove ||
    __purScope.granular.processingView ||
    __purScope.granular.orderView ||
    __purScope.granular.receiptView ||
    __purScope.granular.suppliersView
  );
}

function purchasingNavHTML(active) {
  const items = [
    { href: '/purchase-requisition-open.html', key: 'openreq', k: 'nav.purch.requisitionOpen', need: 'reqOpen' },
    { href: '/purchase-requests.html', key: 'listreq', k: 'nav.purch.requests', need: 'reqList' },
    { href: '/purchase-requests.html?pending', key: 'appr', k: 'nav.purch.approvals', need: 'approve' },
    { href: '/purchase-processing.html', key: 'proc', k: 'nav.purch.processing', need: 'processing' },
    { href: '/suppliers.html', key: 'suppliers', k: 'nav.purch.suppliers', need: 'suppliers' },
    { href: '/purchasing.html', key: 'hub', k: 'nav.purch.hub', need: 'any' },
  ];
  return `<nav class="stock-nav app-sub-nav" aria-label="Purchasing">
    ${items
      .map((i) => {
        if (i.need === 'any' && !hasAnyPurchasingNav()) return '';
        if (i.need === 'reqOpen' && !purCanRequestCreate()) return '';
        if (i.need === 'reqList' && !(__purScope.granular.requestView || __purScope.canRequest || __purScope.canApprove || __purScope.canPurchasing)) return '';
        if (i.need === 'approve' && !purCanRequestApprove()) return '';
        if (i.need === 'processing' && !purCanProcessingView()) return '';
        if (i.need === 'suppliers' && !purCanSuppliersView()) return '';
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

function emptyGranular() {
  return {
    hubView: false,
    requestView: false,
    requestCreate: false,
    requestApprove: false,
    processingView: false,
    orderView: false,
    orderPriceEdit: false,
    receiptView: false,
    receiptCreate: false,
    suppliersView: false,
  };
}

async function loadPurchasingScope() {
  const { ok, data } = await purApi('/api/purchasing/scope');
  if (ok && data && data.ok) {
    const g = data.granular && typeof data.granular === 'object' ? data.granular : {};
    __purScope = {
      canPurchasing: !!data.canPurchasing,
      canRequest: !!data.canRequest,
      canApprove: !!data.canApprove,
      canReceipt: !!data.canReceipt,
      canStock: !!data.canStock,
      granular: {
        hubView: !!g.hubView,
        requestView: !!g.requestView,
        requestCreate: !!g.requestCreate,
        requestApprove: !!g.requestApprove,
        processingView: !!g.processingView,
        orderView: !!g.orderView,
        orderPriceEdit: !!g.orderPriceEdit,
        receiptView: !!g.receiptView,
        receiptCreate: !!g.receiptCreate,
        suppliersView: !!g.suppliersView,
      },
    };
  } else {
    // Güvenli varsayılan: fail-closed — hiçbir yetki yok.
    __purScope = {
      canPurchasing: false,
      canRequest: false,
      canApprove: false,
      canReceipt: false,
      canStock: false,
      granular: emptyGranular(),
    };
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
  if (window.authContext && typeof window.authContext.load === 'function') {
    await window.authContext.load();
    showStockIn =
      window.authContext.isSuperAdmin() ||
      window.authContext.hasAny(['module.stock', 'stock.in.view']);
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
// Faz 3 granular helper'ları — sayfa içi UI kodları bunları çağırarak buton/satır gizler.
window.purCanRequestCreate = purCanRequestCreate;
window.purCanRequestApprove = purCanRequestApprove;
window.purCanOrderPriceEdit = purCanOrderPriceEdit;
window.purCanReceiptCreate = purCanReceiptCreate;
window.purCanProcessingView = purCanProcessingView;
window.purCanSuppliersView = purCanSuppliersView;
