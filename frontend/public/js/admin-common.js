/**
 * Süper yönetim modülü hızlı menü: <div id="navSlot"></div> + initAdminPageNav(activeKey)
 * Anahtarlar: home | new-user | users | perms | settings
 */
const ADMIN_NAV_FALLBACK_TR = {
  'nav.dashboard': 'Ana sayfa',
  'admin.title': 'Super yonetim',
  'nav.admin.home': 'Super yonetim',
  'nav.admin.newUser': 'Yeni kullanici ekle',
  'nav.admin.users': 'Kullanicilar',
  'nav.admin.perms': 'Rol yetkileri / ek yetkiler',
  'nav.admin.settings': 'Sistem ayarlari',
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
    { href: '/admin.html', key: 'home', label: 'Süper Yönetim' },
    { href: '/admin-user-new.html', key: 'new-user', label: 'Yeni Kullanıcı Ekle' },
    { href: '/admin-users.html', key: 'users', label: 'Kullanıcılar' },
    { href: '/admin-permissions.html', key: 'perms', label: 'Rol Yetkileri / Ek Yetkiler' },
    { href: '/admin-settings.html', key: 'settings', label: 'Sistem Ayarları' },
  ];
  return `<nav class="stock-nav" aria-label="Admin">
    <a href="/" class="${active === 'dashboard' ? 'active' : ''}" data-i18n="nav.dashboard">${tAdminNav('nav.dashboard')}</a>
    ${items
      .map(
        (i) => `<a href="${i.href}" class="${active === i.key ? 'active' : ''}">${i.label}</a>`
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
