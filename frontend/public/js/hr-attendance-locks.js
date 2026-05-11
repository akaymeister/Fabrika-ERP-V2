(function () {
  const monthEl = document.getElementById('lockMonth');
  const lockUsdEl = document.getElementById('lockUsdUzsRate');
  const noteEl = document.getElementById('lockNote');
  const btnLock = document.getElementById('btnLockMonth');
  const btnUnlock = document.getElementById('btnUnlockMonth');
  const msgEl = document.getElementById('locksMsg');
  const bodyEl = document.getElementById('locksBody');

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function showMsg(text, isErr) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = isErr ? '#b91c1c' : '#166534';
  }

  async function loadLocks() {
    const { ok, data } = await window.hrApi('/api/hr/attendance-locks');
    if (!ok || !data?.ok) {
      showMsg(
        (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.att.locks.loadFailed'),
        true
      );
      return;
    }
    const rows = data.data?.locks || data.locks || [];
    bodyEl.innerHTML = rows.length
      ? rows
          .map((r) => {
            const fx =
              r.payroll_usd_uzs_rate != null && Number.isFinite(Number(r.payroll_usd_uzs_rate))
                ? String(r.payroll_usd_uzs_rate)
                : '—';
            return `<tr><td>${r.month_key}</td><td>${Number(r.is_locked) === 1 ? t('hr.att.locks.stateLocked') : t('hr.att.locks.stateUnlocked')}</td><td>${fx}</td><td>${r.note || '-'}</td></tr>`;
          })
          .join('')
      : `<tr><td colspan="4">${t('hr.att.noRows')}</td></tr>`;
  }

  async function postAction(url) {
    const month = monthEl && monthEl.value ? monthEl.value : '';
    if (!month) return showMsg(t('hr.att.locks.pickMonth'), true);
    const body = { month, note: noteEl?.value || null };
    if (url.includes('/lock')) {
      const raw = lockUsdEl && String(lockUsdEl.value).trim().replace(',', '.');
      const n = Number(raw);
      if (!raw || !Number.isFinite(n) || n <= 0) {
        showMsg(t('hr.payroll.payUsdUzsLockRequired'), true);
        return;
      }
      body.payroll_usd_uzs_rate = n;
    }
    const { ok, data } = await window.hrApi(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!ok || !data?.ok) {
      showMsg(
        (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.att.locks.actionFailed'),
        true
      );
      return;
    }
    showMsg(t('hr.att.locks.saveOk'), false);
    await loadLocks();
  }

  async function initHrAttendanceLocksPage() {
    if (monthEl && !monthEl.value) monthEl.value = new Date().toISOString().slice(0, 7);
    btnLock?.addEventListener('click', () => postAction('/api/hr/attendance-locks/lock'));
    btnUnlock?.addEventListener('click', () => postAction('/api/hr/attendance-locks/unlock'));
    await loadLocks();
  }

  window.initHrAttendanceLocksPage = initHrAttendanceLocksPage;
})();

