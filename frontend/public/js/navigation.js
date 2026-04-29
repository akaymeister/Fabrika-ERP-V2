/**
 * Global üst modül menüsü (Faz 2 Global ERP UI Standard).
 *
 * Contract (bozulmamalı):
 * - #globalNavSlot: ana modül menüsü render hedefi
 * - #navSlot: modül içi secondary nav render hedefi (module common dosyaları)
 * - #languageSelect: tekil dil seçici (i18n.js ve navigation.js ortak kullanır)
 * - Mevcut sayfa id/event binding akışı korunur.
 *
 * Login ve print sayfaları bu dosyayı include etmezse menü render edilmez.
 */
(function initNavigationModule() {
  function markNavLoading() {
    document.documentElement.classList.add('nav-loading');
    if (document.body) document.body.classList.add('nav-loading');
  }
  function markNavReady() {
    document.documentElement.classList.remove('nav-loading');
    document.documentElement.classList.add('nav-ready');
    if (document.body) {
      document.body.classList.remove('nav-loading');
      document.body.classList.add('nav-ready');
    }
  }
  markNavLoading();

  const GLOBAL_MODULES = [
    {
      moduleKey: 'dashboard',
      labelKey: 'nav.dashboard',
      fallback: 'Ana sayfa',
      href: '/',
      iconClass: 'mod-home',
      requiredRole: null,
      requiredPermission: null,
    },
    {
      moduleKey: 'stock',
      labelKey: 'nav.stock',
      fallback: 'Stok',
      href: '/stock.html',
      iconClass: 'mod-stock',
      requiredRole: null,
      requiredPermission: 'module.stock',
    },
    {
      moduleKey: 'purchasing',
      labelKey: 'nav.purchasing',
      fallback: 'Satınalma',
      href: '/purchasing.html',
      iconClass: 'mod-purchasing',
      requiredRole: null,
      requiredPermission: 'module.purchasing',
    },
    {
      moduleKey: 'project',
      labelKey: 'nav.projects',
      fallback: 'Proje',
      href: '/projects.html',
      iconClass: 'mod-project',
      requiredRole: null,
      requiredPermission: 'module.project',
    },
    {
      moduleKey: 'hr',
      labelKey: 'nav.hr',
      fallback: 'İK',
      href: '/hr.html',
      iconClass: 'mod-hr',
      requiredRole: null,
      requiredPermission: 'module.hr',
    },
    {
      moduleKey: 'admin',
      labelKey: 'nav.admin',
      fallback: 'Süper Yönetim',
      href: '/admin.html',
      iconClass: 'mod-admin',
      requiredRole: 'super_admin',
      requiredPermission: null,
    },
  ];

  function safeText(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function currentUserInfo() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) {
        return null;
      }
      const data = await res.json().catch(() => ({}));
      return data && data.user ? data.user : null;
    } catch {
      return null;
    }
  }

  function hasRoleAccess(item, user) {
    if (!item.requiredRole) return true;
    if (!user) {
      return false;
    }
    if (user.isSuperAdmin === true) {
      return true;
    }
    const slug = user.role && user.role.slug ? String(user.role.slug) : '';
    return slug === item.requiredRole;
  }

  function hasPermissionAccess(item, user) {
    if (!item.requiredPermission) return true;
    if (!user) return false;
    if (user.isSuperAdmin === true) return true;
    const list = Array.isArray(user.permissions) ? user.permissions : [];
    if (!list.length) return true;
    return list.includes(item.requiredPermission);
  }

  function tGlobal(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const s = window.i18n.t(key);
      if (s && s !== key) return s;
    }
    return fallback || key;
  }

  function renderGlobalNav(items, activeModuleKey) {
    return `<nav class="stock-nav app-main-nav global-module-nav" aria-label="Global modules">
      ${items
        .map((item) => {
          const active = item.moduleKey === activeModuleKey ? 'active' : '';
          const disabled = item.disabled ? 'aria-disabled="true"' : '';
          const href = item.disabled ? 'javascript:void(0)' : item.href;
          return `<a href="${safeText(href)}" class="${active} ${safeText(item.iconClass || '')}" ${disabled} data-module-key="${safeText(
            item.moduleKey
          )}" data-i18n="${safeText(item.labelKey || '')}">${safeText(tGlobal(item.labelKey, item.fallback))}</a>`;
        })
        .join('')}
    </nav>`;
  }

  function ensureLanguageSelect(topbarRight) {
    let sel = topbarRight.querySelector('#languageSelect');
    if (sel) return sel;
    sel = document.createElement('select');
    sel.id = 'languageSelect';
    sel.setAttribute('aria-label', 'Language');
    sel.style.maxWidth = '120px';
    sel.style.padding = '8px';
    sel.style.borderRadius = '8px';
    sel.innerHTML =
      '<option value="tr">Türkçe</option>' +
      '<option value="uz">O‘zbekcha</option>' +
      '<option value="ru">Русский</option>' +
      '<option value="en">English</option>';
    topbarRight.appendChild(sel);
    return sel;
  }

  function normalizeTopbarRight() {
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return null;
    topbarRight.classList.add('app-topbar-right');
    const languageSelect = ensureLanguageSelect(topbarRight);
    [...topbarRight.children].forEach((el) => {
      if (languageSelect && (el === languageSelect || (el.contains && el.contains(languageSelect)))) return;
      if (el.id === 'globalUserTools') return;
      if (el.getAttribute('data-topbar-persist') === '1') return;
      el.remove();
    });
    return topbarRight;
  }

  function roleLabel(user) {
    if (user?.employeePositionName) return String(user.employeePositionName).toUpperCase();
    const slug = String(user?.role?.slug || '').toLowerCase();
    if (slug === 'super_admin') return 'SÜPER ADMIN';
    if (slug === 'admin') return 'ADMIN';
    return 'PERSONEL';
  }

  function profileName(user) {
    const emp = [user?.employeeFirstName, user?.employeeLastName].filter(Boolean).join(' ').trim();
    if (emp) return emp;
    return String(user?.fullName || user?.username || 'USER').trim();
  }

  function initialsOf(user) {
    const src = profileName(user);
    const parts = src.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    const a = (parts[0][0] || '').toUpperCase();
    const b = parts[1] ? (parts[1][0] || '').toUpperCase() : '';
    return `${a}${b}`.trim() || 'U';
  }

  /** Basit vektör ikonlar (emoji/ harf yerine; UTF-8 bağımsız) */
  const ICON_BELL_SVG =
    '<svg class="global-icon-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  const ICON_MSG_SVG =
    '<svg class="global-icon-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  function ensureUserTools(user) {
    const topbarRight = normalizeTopbarRight();
    if (!topbarRight || document.getElementById('globalUserTools')) return;
    const photo = user?.employeePhoto ? `/uploads/${String(user.employeePhoto).replace(/^\/+/, '')}` : '';
    const avatarHtml = photo
      ? `<img src="${safeText(photo)}" alt="avatar" class="global-user-avatar-img" />`
      : `<span class="global-user-avatar-fallback">${safeText(initialsOf(user))}</span>`;
    const html = `<div id="globalUserTools" class="global-user-tools">
      <button type="button" class="global-icon-btn" id="btnGlobalNotif" title="Bildirim" aria-label="Bildirim">${ICON_BELL_SVG}</button>
      <button type="button" class="global-icon-btn" id="btnGlobalMsg" title="Mesaj" aria-label="Mesaj">${ICON_MSG_SVG}</button>
      <div class="global-user-wrap">
        <button type="button" class="global-user-btn" id="btnGlobalUserMenu">
          <span class="global-user-avatar">${avatarHtml}</span>
          <span class="global-user-meta">
            <span class="global-user-name">${safeText(profileName(user))}</span>
            <span class="global-user-role">${safeText(roleLabel(user))}</span>
          </span>
          <span class="global-user-caret">▾</span>
        </button>
        <div class="global-user-dropdown" id="globalUserDropdown" style="display:none">
          <a href="/my-profile.html">Profilim</a>
          <a href="/my-profile.html#change-password">Sifre Degistir</a>
          <button type="button" id="btnGlobalNotifications">Bildirimler</button>
          <button type="button" id="btnGlobalLogout">Cikis Yap</button>
        </div>
      </div>
      <div class="global-user-dropdown global-notif-dropdown" id="globalNotifDropdown" style="display:none">
        <p>Henüz bildiriminiz yok.</p>
      </div>
    </div>`;
    topbarRight.insertAdjacentHTML('beforeend', html);

    const userBtn = document.getElementById('btnGlobalUserMenu');
    const userDd = document.getElementById('globalUserDropdown');
    const notifBtn = document.getElementById('btnGlobalNotif');
    const msgBtn = document.getElementById('btnGlobalMsg');
    const notifDd = document.getElementById('globalNotifDropdown');
    const toggle = (el, force) => {
      if (!el) return;
      const next = force != null ? !!force : el.style.display === 'none';
      el.style.display = next ? 'block' : 'none';
    };
    userBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(userDd);
      toggle(notifDd, false);
    });
    notifBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(notifDd);
      toggle(userDd, false);
    });
    msgBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(notifDd, true);
      toggle(userDd, false);
    });
    document.getElementById('btnGlobalNotifications')?.addEventListener('click', () => {
      toggle(notifDd, true);
      toggle(userDd, false);
    });
    document.getElementById('btnGlobalLogout')?.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      window.location.href = '/login.html';
    });
    document.addEventListener('click', () => {
      toggle(userDd, false);
      toggle(notifDd, false);
    });
  }

  async function initGlobalNavigation(activeModuleKey) {
    document.body?.classList?.add('app-shell');
    const slot = document.getElementById('globalNavSlot');
    if (!slot) {
      markNavReady();
      return;
    }
    slot.classList.add('app-main-nav-slot');
    normalizeTopbarRight();
    const user = await currentUserInfo();
    const visibleItems = GLOBAL_MODULES.filter((item) => hasRoleAccess(item, user) && hasPermissionAccess(item, user));
    slot.innerHTML = renderGlobalNav(visibleItems, activeModuleKey);
    ensureUserTools(user);
    markNavReady();
  }

  window.navigationSchema = GLOBAL_MODULES;
  window.initGlobalNavigation = initGlobalNavigation;
})();
