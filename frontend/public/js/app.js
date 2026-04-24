/**
 * Dashboard: oturum, KPI (API), son hareketler, çıkış.
 */

let dashboardCurrency = 'UZS';

function t(key) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key);
  }
  return key;
}

const fmtMoney = (n) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: dashboardCurrency,
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);
  } catch {
    return `${Number(n) || 0} ${dashboardCurrency}`;
  }
};

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString();
};

const typeLabel = (movType) => {
  if (movType === 'in') return t('dashboard.typeIn');
  if (movType === 'out') return t('dashboard.typeOut');
  if (movType === 'adjustment') return t('dashboard.typeAdj');
  return movType || '—';
};

async function loadUser() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return null;
  }
  const data = await res.json();
  if (!data?.user) {
    window.location.href = '/login.html';
    return null;
  }
  return data.user;
}

function renderUser(user) {
  const ufn = document.getElementById('userFullName');
  if (ufn) {
    ufn.textContent = user.fullName || '—';
    ufn.classList.add('display-upper');
  }
  const ur = document.getElementById('userRole');
  if (ur) {
    ur.textContent = user.role?.name || '—';
    ur.classList.add('display-upper');
  }
  const sid = document.getElementById('sessionInfo');
  if (sid) {
    sid.textContent = `${t('sessionPrefix')} ${user.username} (${user.role?.slug || '—'})`;
  }
  const admin = document.getElementById('adminLink');
  if (admin) {
    const show = user.isSuperAdmin === true || user.role?.slug === 'super_admin';
    admin.style.display = show ? 'inline-flex' : 'none';
  }
}

async function loadSummary() {
  const res = await fetch('/api/dashboard/summary', { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return;
  }
  const data = await res.json();
  if (!data.ok) return;
  const elV = document.getElementById('kpiStockValue');
  const elP = document.getElementById('kpiProductCount');
  const elA = document.getElementById('kpiActiveProjects');
  const elB = document.getElementById('kpiPendingPurchases');
  if (elV) elV.textContent = fmtMoney(data.totalStockValue);
  if (elP) elP.textContent = String(data.productCount ?? 0);
  if (elA) elA.textContent = String(data.activeProjectCount ?? 0);
  if (elB) elB.textContent = String(data.pendingPurchaseCount ?? 0);
  const hint = document.getElementById('heroDataHint');
  if (hint) hint.textContent = t('dashboard.kpiDataFresh');
}

async function loadActivity() {
  const res = await fetch('/api/dashboard/activity?limit=10', { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return;
  }
  const data = await res.json();
  const tbody = document.getElementById('recentMovementsBody');
  if (!tbody) return;
  const rows = data.movements || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(t('dashboard.movEmpty'))}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (m) => `<tr>
        <td>${fmtDate(m.created_at)}</td>
        <td><code class="display-upper">${escapeHtml(m.product_code || '')}</code></td>
        <td class="display-upper">${escapeHtml(m.product_name || '')}</td>
        <td class="display-upper">${escapeHtml(typeLabel(m.movement_type))}</td>
        <td>${escapeHtml(String(m.qty ?? ''))}</td>
        <td class="display-upper">${escapeHtml(m.user_username || '—')}</td>
      </tr>`
    )
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* ignore */
  }
  window.location.href = '/login.html';
});

function checkForbiddenQuery() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('err') === 'forbidden') {
    const s = document.createElement('p');
    s.style.cssText = 'background:#fef2f2;border:1px solid #fecaca;padding:10px 14px;border-radius:8px;color:#991b1b';
    s.textContent = t('dashboard.forbidden');
    document.querySelector('.container')?.prepend(s);
    window.history.replaceState({}, '', '/');
  }
}

async function boot() {
  if (window.i18n) {
    await window.i18n.loadDict(window.i18n.getLang());
    window.i18n.apply(document);
  }
  try {
    const pr = await fetch('/api/public/config', { cache: 'no-store' });
    const pd = await pr.json();
    if (pd.defaultCurrency) {
      dashboardCurrency = String(pd.defaultCurrency).toUpperCase();
    }
  } catch {
    /* default UZS */
  }
  checkForbiddenQuery();
  const user = await loadUser();
  if (!user) return;
  renderUser(user);
  await loadSummary();
  await loadActivity();
}

boot().catch(() => {
  window.location.href = '/login.html';
});
