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

  // Faz 3 granular: her modül kartı için, eski kaba modül izni VEYA herhangi
  // bir granular izinden biri varsa kart görünür. Bu sayede:
  //   - eski 'module.stock' yetkili kullanıcı (geriye uyum) kartı görür,
  //   - sadece 'stock.in.view' verilmiş kullanıcı da kartı görür (hub içinde
  //     filtrelenmiş alt menüyü açacak).
  const GLOBAL_MODULES = [
    {
      moduleKey: 'dashboard',
      labelKey: 'nav.dashboard',
      fallback: 'Ana sayfa',
      href: '/',
      iconClass: 'mod-home',
      requiredRole: null,
      requiredAnyPermission: null,
    },
    {
      moduleKey: 'stock',
      labelKey: 'nav.stock',
      fallback: 'Stok',
      href: '/stock.html',
      iconClass: 'mod-stock',
      requiredRole: null,
      requiredAnyPermission: [
        'module.stock',
        'stock.hub.view',
        'stock.products.view',
        'stock.brands.view',
        'stock.warehouses.view',
        'stock.in.view',
        'stock.out.view',
        'stock.movements.view',
        'stock.reports.view',
      ],
    },
    {
      moduleKey: 'purchasing',
      labelKey: 'nav.purchasing',
      fallback: 'Satınalma',
      href: '/purchasing.html',
      iconClass: 'mod-purchasing',
      requiredRole: null,
      requiredAnyPermission: [
        'module.purchasing',
        'module.purchasing.request',
        'module.purchasing.approve',
        'module.purchasing.receipt',
        'purchasing.hub.view',
        'purchasing.request.view',
        'purchasing.request.create',
        'purchasing.request.approve',
        'purchasing.processing.view',
        'purchasing.order.view',
        'purchasing.receipt.view',
        'purchasing.suppliers.view',
      ],
    },
    {
      moduleKey: 'project',
      labelKey: 'nav.projects',
      fallback: 'Proje',
      href: '/projects.html',
      iconClass: 'mod-project',
      requiredRole: null,
      requiredAnyPermission: ['module.projects', 'projects.hub.view', 'projects.control.view'],
    },
    {
      moduleKey: 'hr',
      labelKey: 'nav.hr',
      fallback: 'İK',
      href: '/hr.html',
      iconClass: 'mod-hr',
      requiredRole: null,
      requiredAnyPermission: [
        'module.hr',
        'hr.hub.view',
        'hr.employees.view',
        'hr.attendance.view',
        'hr.payroll.view',
        'hr.compensation.view',
      ],
    },
    {
      moduleKey: 'admin',
      labelKey: 'nav.admin',
      fallback: 'Süper Yönetim',
      href: '/admin.html',
      iconClass: 'mod-admin',
      requiredRole: 'super_admin',
      requiredAnyPermission: null,
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
    if (window.authContext && typeof window.authContext.load === 'function') {
      return window.authContext.load();
    }
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      return data && data.user ? data.user : null;
    } catch {
      return null;
    }
  }

  function hasRoleAccess(item, user) {
    if (!item.requiredRole) return true;
    if (!user) return false;
    if (user.isSuperAdmin === true) return true;
    const slug = user.role && user.role.slug ? String(user.role.slug) : '';
    return slug === item.requiredRole;
  }

  function hasPermissionAccess(item, user) {
    // Hiç permission gereksinimi yoksa serbest.
    if (!item.requiredAnyPermission && !item.requiredPermission) return true;
    if (!user) return false;

    // Faz 3: requiredAnyPermission (liste) — en az biri yeterli.
    if (Array.isArray(item.requiredAnyPermission) && item.requiredAnyPermission.length > 0) {
      if (window.authContext && typeof window.authContext.hasAny === 'function') {
        return window.authContext.hasAny(item.requiredAnyPermission);
      }
      if (user.isSuperAdmin === true) return true;
      const list = Array.isArray(user.permissions) ? user.permissions : [];
      for (const k of item.requiredAnyPermission) {
        if (k && list.indexOf(String(k)) !== -1) return true;
      }
      return false;
    }

    // Geriye uyumluluk: tek requiredPermission (liste tanımlanmamışsa).
    if (item.requiredPermission) {
      if (window.authContext && typeof window.authContext.has === 'function') {
        return window.authContext.has(item.requiredPermission);
      }
      if (user.isSuperAdmin === true) return true;
      const list = Array.isArray(user.permissions) ? user.permissions : [];
      return list.indexOf(item.requiredPermission) !== -1;
    }

    return true;
  }

  function tGlobal(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const s = window.i18n.t(key);
      if (s && s !== key) return s;
    }
    return fallback || key;
  }

  function renderGlobalNav(items, activeModuleKey) {
    return `<nav class="stock-nav app-main-nav global-module-nav app-global-module-nav" aria-label="Global modules">
      ${items
        .map((item) => {
          const active = item.moduleKey === activeModuleKey ? 'active' : '';
          const disabled = item.disabled ? 'aria-disabled="true"' : '';
          const href = item.disabled ? 'javascript:void(0)' : item.href;
          const iconCls = safeText(item.iconClass || '');
          return `<a href="${safeText(href)}" class="app-module-nav-link ${active} ${iconCls}" ${disabled} data-module-key="${safeText(
            item.moduleKey
          )}"><span class="app-module-nav-dot" aria-hidden="true"></span><span class="app-module-nav-text" data-i18n="${safeText(
            item.labelKey || ''
          )}">${safeText(tGlobal(item.labelKey, item.fallback))}</span></a>`;
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
      <button type="button" class="global-icon-btn" id="btnGlobalNotif" title="${safeText(tGlobal('nav.userMenu.notifications', 'Bildirimler'))}" aria-label="${safeText(tGlobal('nav.userMenu.notifications', 'Bildirimler'))}">${ICON_BELL_SVG}</button>
      <button type="button" class="global-icon-btn" id="btnGlobalMsg" title="${safeText(tGlobal('nav.userMenu.messages', 'Mesajlar'))}" aria-label="${safeText(tGlobal('nav.userMenu.messages', 'Mesajlar'))}">${ICON_MSG_SVG}</button>
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
          <a href="/my-profile.html" data-i18n="nav.userMenu.profile">${safeText(tGlobal('nav.userMenu.profile', 'Profilim'))}</a>
          <a href="/my-profile.html#change-password" data-i18n="nav.userMenu.changePassword">${safeText(tGlobal('nav.userMenu.changePassword', 'Şifre değiştir'))}</a>
          <button type="button" id="btnGlobalNotifications" data-i18n="nav.userMenu.notifications">${safeText(tGlobal('nav.userMenu.notifications', 'Bildirimler'))}</button>
          <button type="button" id="btnGlobalLogout" data-i18n="nav.logout">${safeText(tGlobal('nav.logout', 'Çıkış'))}</button>
        </div>
      </div>
      <div class="global-user-dropdown global-notif-dropdown" id="globalNotifDropdown" style="display:none">
        <p data-i18n="nav.userMenu.noNotifications">${safeText(tGlobal('nav.userMenu.noNotifications', 'Henüz bildiriminiz yok.'))}</p>
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
      if (window.authContext && typeof window.authContext.reset === 'function') {
        window.authContext.reset();
      }
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
    if (window.i18n && typeof window.i18n.apply === 'function') {
      window.i18n.apply(document);
    }
    markNavReady();
  }

  window.navigationSchema = GLOBAL_MODULES;
  window.initGlobalNavigation = initGlobalNavigation;
})();
