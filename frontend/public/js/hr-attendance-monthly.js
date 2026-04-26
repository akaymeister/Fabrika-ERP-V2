(function () {
  const monthKeyEl = document.getElementById('monthKey');
  const btnLoad = document.getElementById('btnLoadMonthly');
  const msgEl = document.getElementById('monthlyMsg');
  const summaryBody = document.getElementById('summaryBody');
  const monthlyBody = document.getElementById('monthlyBody');

  function showMsg(text, isErr) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = isErr ? '#b91c1c' : '#166534';
  }

  async function loadMonthly() {
    const mk = monthKeyEl && monthKeyEl.value ? monthKeyEl.value : '';
    if (!mk) return showMsg('Ay secin', true);
    const { ok, data } = await window.hrApi(`/api/hr/attendance/monthly?month=${encodeURIComponent(mk)}`);
    if (!ok || !data?.ok) {
      showMsg(data?.message || 'Yuklenemedi', true);
      return;
    }
    const payload = data.data || data;
    const summary = payload.summary || [];
    const rows = payload.rows || [];
    summaryBody.innerHTML = summary.length
      ? summary
          .map(
            (x) =>
              `<tr><td>${x.employee_name || '-'}</td><td>${Number(x.total_hours || 0).toFixed(2)}</td><td>${Number(x.overtime_hours || 0).toFixed(2)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="3">Kayit yok</td></tr>';
    monthlyBody.innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<tr><td>${String(r.work_date || '').slice(0, 10)}</td><td>${r.employee_name || '-'}</td><td>${r.project_code || '-'}</td><td>${r.work_status || '-'}</td><td>${r.work_type || '-'}</td><td>${Number(r.total_hours || 0).toFixed(2)}</td><td>${Number(r.overtime_hours || 0).toFixed(2)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="7">Kayit yok</td></tr>';
    showMsg(payload.isLocked ? 'Bu ay kilitli' : '', false);
  }

  async function initHrAttendanceMonthlyPage() {
    if (monthKeyEl && !monthKeyEl.value) monthKeyEl.value = new Date().toISOString().slice(0, 7);
    btnLoad?.addEventListener('click', loadMonthly);
    await loadMonthly();
  }

  window.initHrAttendanceMonthlyPage = initHrAttendanceMonthlyPage;
})();

