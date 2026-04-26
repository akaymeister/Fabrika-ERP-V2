(function () {
  const monthEl = document.getElementById('lockMonth');
  const noteEl = document.getElementById('lockNote');
  const btnLock = document.getElementById('btnLockMonth');
  const btnUnlock = document.getElementById('btnUnlockMonth');
  const msgEl = document.getElementById('locksMsg');
  const bodyEl = document.getElementById('locksBody');

  function showMsg(text, isErr) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = isErr ? '#b91c1c' : '#166534';
  }

  async function loadLocks() {
    const { ok, data } = await window.hrApi('/api/hr/attendance-locks');
    if (!ok || !data?.ok) {
      showMsg(data?.message || 'Yuklenemedi', true);
      return;
    }
    const rows = data.data?.locks || data.locks || [];
    bodyEl.innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<tr><td>${r.month_key}</td><td>${Number(r.is_locked) === 1 ? 'Kilitli' : 'Acik'}</td><td>${r.note || '-'}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="3">Kayit yok</td></tr>';
  }

  async function postAction(url) {
    const month = monthEl && monthEl.value ? monthEl.value : '';
    if (!month) return showMsg('Ay secin', true);
    const { ok, data } = await window.hrApi(url, {
      method: 'POST',
      body: JSON.stringify({ month, note: noteEl?.value || null }),
    });
    if (!ok || !data?.ok) {
      showMsg(data?.message || 'Islem basarisiz', true);
      return;
    }
    showMsg('Kaydedildi', false);
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

