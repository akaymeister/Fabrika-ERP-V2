/**
 * Süper yönetim modülü hızlı menü: <div id="navSlot"></div> + initAdminPageNav('admin'|'home')
 */
const ADMIN_NAV_FALLBACK_TR = {
  'nav.dashboard': 'Ana sayfa',
  'admin.title': 'Süper yönetim',
};

function tAdminNav(k) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    const s = window.i18n.t(k);
    if (s && s !== k) {
      return s;
    }
  }
  return ADMIN_NAV_FALLBACK_TR[k] || k;
}

function adminModuleNavHTML(active) {
  return `<nav class="stock-nav" aria-label="Admin">
    <a href="/" class="${active === 'home' ? 'active' : ''}" data-i18n="nav.dashboard">${tAdminNav('nav.dashboard')}</a>
    <a href="/admin.html" class="${active === 'admin' ? 'active' : ''}" data-i18n="admin.title">${tAdminNav('admin.title')}</a>
  </nav>`;
}

async function initAdminPageNav(active) {
  if (typeof window.initGlobalNavigation === 'function') {
    await window.initGlobalNavigation('admin');
  }
  if (window.i18n && window.i18n.loadDict) {
    await window.i18n.loadDict(window.i18n.getLang());
  }
  const slot = document.getElementById('navSlot');
  if (slot) {
    slot.innerHTML = adminModuleNavHTML(active);
  }
  if (window.i18n && window.i18n.apply) {
    window.i18n.apply(document);
  }
}

window.adminModuleNavHTML = adminModuleNavHTML;
window.initAdminPageNav = initAdminPageNav;
