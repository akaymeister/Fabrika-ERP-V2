/**
 * Süper yönetim modülü hızlı menü: <div id="navSlot"></div> + initAdminPageNav(activeKey)
 * Anahtarlar: home | new-user | users | perms | settings
 */
const ADMIN_NAV_FALLBACK_TR = {
  'nav.dashboard': 'Ana sayfa',
  'admin.title': 'Süper yönetim',
  'nav.admin.home': 'Süper yönetim',
  'nav.admin.newUser': 'Yeni kullanıcı ekle',
  'nav.admin.users': 'Kullanıcılar',
  'nav.admin.perms': 'Rol yetkileri / ek yetkiler',
  'nav.admin.settings': 'Sistem ayarları',
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
  const items = [
    { href: '/admin.html', key: 'home', i18n: 'nav.admin.home' },
    { href: '/admin-user-new.html', key: 'new-user', i18n: 'nav.admin.newUser' },
    { href: '/admin-users.html', key: 'users', i18n: 'nav.admin.users' },
    { href: '/admin-permissions.html', key: 'perms', i18n: 'nav.admin.perms' },
    { href: '/admin-settings.html', key: 'settings', i18n: 'nav.admin.settings' },
  ];
  return `<nav class="stock-nav app-sub-nav" aria-label="Admin">
    <a href="/" class="${active === 'dashboard' ? 'active' : ''}" data-i18n="nav.dashboard">${tAdminNav('nav.dashboard')}</a>
    ${items
      .map(
        (i) =>
          `<a href="${i.href}" class="${active === i.key ? 'active' : ''}" data-i18n="${i.i18n}">${tAdminNav(i.i18n)}</a>`
      )
      .join('')}
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
