(function () {
  function t(k) {
    return window.i18n?.t ? window.i18n.t(k) : k;
  }

  function showMsg(id, text, err) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = text ? 'block' : 'none';
    el.textContent = text || '';
    if (err != null) el.style.color = err ? '#b91c1c' : '#166534';
  }

  function row(label, value) {
    return `<div><label class="muted">${label}</label><p>${value == null || value === '' ? '-' : value}</p></div>`;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function renderProfile(profile) {
    const user = profile?.user || {};
    const emp = profile?.employee || null;
    const summary = document.getElementById('summaryGrid');
    const account = document.getElementById('accountGrid');
    const salary = document.getElementById('salaryGrid');
    const att = document.getElementById('attendanceGrid');
    const adv = document.getElementById('advanceGrid');
    const unlinked = document.getElementById('unlinkedInfo');
    const avatar = document.getElementById('myAvatar');

    if (avatar) {
      const name = String(emp?.full_name || user?.full_name || user?.username || 'U');
      const inits = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((x) => x[0]?.toUpperCase() || '')
        .join('');
      avatar.textContent = inits || 'U';
      if (emp?.photo_path) {
        avatar.innerHTML = `<img src="/uploads/${String(emp.photo_path).replace(/^\/+/, '')}" alt="avatar" class="my-prof-avatar-img" />`;
      }
    }

    if (summary) {
      summary.innerHTML = [
        row(t('me.empNo'), emp?.employee_no),
        row(t('me.fullName'), emp?.full_name || user?.full_name),
        row(t('me.department'), emp?.department?.name),
        row(t('me.position'), emp?.position?.name),
        row(t('me.nationality'), emp?.nationality),
        row(t('me.hireDate'), emp?.hire_date),
        row(t('me.status'), emp?.employment_status || (user?.is_active ? 'active' : 'passive')),
      ].join('');
    }

    if (account) {
      account.innerHTML = [
        row(t('me.username'), user?.username),
        row(t('me.email'), user?.email),
        row(t('me.role'), user?.role?.name || user?.role?.slug),
        row(t('me.linkedEmployee'), emp?.employee_no ? `${emp.employee_no} - ${emp.full_name || ''}` : '-'),
        row(t('me.lastLogin'), user?.last_login_at),
      ].join('');
    }

    if (salary) {
      salary.innerHTML = [
        row(t('me.salaryCurrency'), emp?.salary?.currency),
        row(t('me.salaryTotal'), emp?.salary?.total),
        row(t('me.salaryOfficial'), emp?.salary?.official),
        row(t('me.salaryUnofficial'), emp?.salary?.unofficial),
      ].join('');
    }

    if (att) {
      att.innerHTML = [
        row(t('me.workedDays'), profile?.summary?.attendance?.worked_days_this_month),
        row(t('me.absentDays'), profile?.summary?.attendance?.absent_days_this_month),
        row(t('me.overtimeHours'), profile?.summary?.attendance?.overtime_hours_this_month),
        row(t('me.workProjects'), (profile?.summary?.attendance?.projects || []).join(', ')),
      ].join('');
    }

    if (adv) {
      adv.innerHTML = [
        row(t('me.advanceTotal'), profile?.summary?.advance?.total_advance),
        row(t('me.advanceBalance'), profile?.summary?.advance?.remaining_balance),
        row(t('me.paymentHistory'), (profile?.summary?.advance?.history || []).length),
      ].join('');
    }

    if (unlinked) unlinked.style.display = emp ? 'none' : 'block';
  }

  function applyMustChangeBanner(profile) {
    const el = document.getElementById('mustChangeBanner');
    if (!el) return;
    const params = new URLSearchParams(window.location.search);
    const force = params.get('mustChangePassword') === '1' || profile?.user?.must_change_password;
    if (force) {
      el.style.display = 'block';
      el.textContent = t('me.mustChangePasswordBanner');
      window.requestAnimationFrame(() => {
        document.getElementById('change-password')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  async function loadProfile() {
    const r = await api('/api/me/profile');
    if (!r.ok) {
      showMsg('profileMsg', window.i18n?.apiErrorText ? window.i18n.apiErrorText(r.data) : 'Profil yüklenemedi', true);
      return;
    }
    const profile = r.data.profile || {};
    renderProfile(profile);
    applyMustChangeBanner(profile);
  }

  async function changePassword() {
    const payload = {
      currentPassword: document.getElementById('curPass')?.value || '',
      newPassword: document.getElementById('newPass')?.value || '',
      confirmPassword: document.getElementById('confirmPass')?.value || '',
    };
    const r = await api('/api/me/change-password', { method: 'POST', body: JSON.stringify(payload) });
    if (!r.ok) {
      showMsg('passMsg', window.i18n?.apiErrorText ? window.i18n.apiErrorText(r.data) : 'Şifre değiştirilemedi', true);
      return;
    }
    showMsg('passMsg', t('me.passwordChanged'), false);
    if (document.getElementById('curPass')) document.getElementById('curPass').value = '';
    if (document.getElementById('newPass')) document.getElementById('newPass').value = '';
    if (document.getElementById('confirmPass')) document.getElementById('confirmPass').value = '';
    const b = document.getElementById('mustChangeBanner');
    if (b) {
      b.style.display = 'none';
      b.textContent = '';
    }
    if (window.history?.replaceState) {
      window.history.replaceState({}, '', '/my-profile.html');
    }
    await loadProfile();
  }

  async function init() {
    await window.i18n?.loadDict?.(window.i18n.getLang());
    await window.initGlobalNavigation?.('dashboard');
    await loadProfile();
    window.i18n?.apply?.(document);
    document.getElementById('btnMePass')?.addEventListener('click', changePassword);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
