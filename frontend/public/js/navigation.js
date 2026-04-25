/**
 * Global üst modül menüsü (Faz A/B).
 * Login ve print sayfaları bu dosyayı include etmezse menü render edilmez.
 */
(function initNavigationModule() {
  const GLOBAL_MODULES = [
    {
      moduleKey: 'dashboard',
      label: 'Ana sayfa',
      href: '/',
      iconClass: 'mod-home',
      requiredRole: null,
      requiredPermission: null,
    },
    {
      moduleKey: 'stock',
      label: 'Stok yönetimi',
      href: '/stock.html',
      iconClass: 'mod-stock',
      requiredRole: null,
      requiredPermission: 'module.stock',
    },
    {
      moduleKey: 'purchasing',
      label: 'Satınalma yönetimi',
      href: '/purchasing.html',
      iconClass: 'mod-purchasing',
      requiredRole: null,
      requiredPermission: 'module.purchasing',
    },
    {
      moduleKey: 'project',
      label: 'Proje yönetimi',
      href: '/projects.html',
      iconClass: 'mod-project',
      requiredRole: null,
      requiredPermission: 'module.project',
    },
    {
      moduleKey: 'hr',
      label: 'IK yönetimi',
      href: '/hr.html',
      iconClass: 'mod-hr',
      requiredRole: null,
      requiredPermission: 'module.hr',
    },
    {
      moduleKey: 'admin',
      label: 'Super yonetim',
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
    if (!item.requiredRole) {
      return true;
    }
    if (!user) {
      return false;
    }
    if (user.isSuperAdmin === true) {
      return true;
    }
    const slug = user.role && user.role.slug ? String(user.role.slug) : '';
    return slug === item.requiredRole;
  }

  function renderGlobalNav(items, activeModuleKey) {
    return `<nav class="stock-nav global-module-nav" aria-label="Global modules">
      ${items
        .map((item) => {
          const active = item.moduleKey === activeModuleKey ? 'active' : '';
          const disabled = item.disabled ? 'aria-disabled="true"' : '';
          const href = item.disabled ? 'javascript:void(0)' : item.href;
          return `<a href="${safeText(href)}" class="${active} ${safeText(item.iconClass || '')}" ${disabled} data-module-key="${safeText(
            item.moduleKey
          )}">${safeText(item.label)}</a>`;
        })
        .join('')}
    </nav>`;
  }

  async function initGlobalNavigation(activeModuleKey) {
    const slot = document.getElementById('globalNavSlot');
    if (!slot) {
      return;
    }
    const user = await currentUserInfo();
    const visibleItems = GLOBAL_MODULES.filter((item) => hasRoleAccess(item, user));
    slot.innerHTML = renderGlobalNav(visibleItems, activeModuleKey);
  }

  window.navigationSchema = GLOBAL_MODULES;
  window.initGlobalNavigation = initGlobalNavigation;
})();
