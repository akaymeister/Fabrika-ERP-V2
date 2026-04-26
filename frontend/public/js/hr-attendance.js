(function () {
  const workDateEl = document.getElementById('workDate');
  const btnLoadDaily = document.getElementById('btnLoadDaily');
  const btnSaveDaily = document.getElementById('btnSaveDaily');
  const dailyBody = document.getElementById('dailyBody');
  const msgEl = document.getElementById('msg');
  const lockHint = document.getElementById('lockHint');

  let dailyRows = [];
  let projects = [];
  let isLocked = false;

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function showMsg(text, isErr) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = isErr ? '#b91c1c' : '#166534';
  }

  function fmtTime(v) {
    const s = String(v || '');
    return s ? s.slice(0, 5) : '';
  }

  function statusOptionsHtml(selected) {
    const v = String(selected || 'worked');
    const opts = [
      ['worked', 'hr.att.status.worked'],
      ['absent', 'hr.att.status.absent'],
      ['leave', 'hr.att.status.leave'],
      ['sick_leave', 'hr.att.status.sick_leave'],
      ['half_day', 'hr.att.status.half_day'],
      ['overtime', 'hr.att.status.overtime'],
    ];
    return opts.map(([key, tk]) => `<option value="${key}"${key === v ? ' selected' : ''}>${t(tk)}</option>`).join('');
  }

  function workTypeOptionsHtml(selected) {
    const v = String(selected || 'normal');
    const opts = [
      ['normal', 'hr.att.workType.normal'],
      ['assembly', 'hr.att.workType.assembly'],
      ['production', 'hr.att.workType.production'],
      ['shipment', 'hr.att.workType.shipment'],
      ['office', 'hr.att.workType.office'],
      ['other', 'hr.att.workType.other'],
    ];
    return opts.map(([key, tk]) => `<option value="${key}"${key === v ? ' selected' : ''}>${t(tk)}</option>`).join('');
  }

  function projectOptionsHtml(selected) {
    const cur = String(selected || '');
    let html = `<option value="">${t('hr.att.noProject')}</option>`;
    projects.forEach((p) => {
      const sel = String(p.id) === cur ? ' selected' : '';
      html += `<option value="${p.id}"${sel}>${p.project_code || p.name || p.id}</option>`;
    });
    return html;
  }

  function renderDailyRows() {
    if (!dailyRows.length) {
      dailyBody.innerHTML = `<tr><td colspan="9">${t('hr.att.empty')}</td></tr>`;
      return;
    }
    dailyBody.innerHTML = dailyRows
      .map(
        (r, idx) => `<tr class="${isLocked ? 'att-row-locked' : ''}" data-i="${idx}">
        <td>${r.full_name || '-'}${r.employee_no ? ` <span style="color:#64748b">(${r.employee_no})</span>` : ''}</td>
        <td><select class="pur-inp x-project" ${isLocked ? 'disabled' : ''}>${projectOptionsHtml(r.project_id)}</select></td>
        <td><select class="pur-inp x-status" ${isLocked ? 'disabled' : ''}>${statusOptionsHtml(r.work_status)}</select></td>
        <td><select class="pur-inp x-worktype" ${isLocked ? 'disabled' : ''}>${workTypeOptionsHtml(r.work_type)}</select></td>
        <td><input class="pur-inp x-in" type="time" value="${fmtTime(r.check_in_time)}" ${isLocked ? 'disabled' : ''}/></td>
        <td><input class="pur-inp x-out" type="time" value="${fmtTime(r.check_out_time)}" ${isLocked ? 'disabled' : ''}/></td>
        <td><input class="pur-inp x-total" type="number" min="0" step="0.25" value="${Number(r.total_hours || 0)}" ${isLocked ? 'disabled' : ''}/></td>
        <td><input class="pur-inp x-ot" type="number" min="0" step="0.25" value="${Number(r.overtime_hours || 0)}" ${isLocked ? 'disabled' : ''}/></td>
        <td><input class="pur-inp x-note" type="text" value="${String(r.note || '').replace(/"/g, '&quot;')}" ${isLocked ? 'disabled' : ''}/></td>
      </tr>`
      )
      .join('');
  }

  async function loadProjects() {
    const { ok, data } = await window.hrApi('/api/hr/attendance-projects');
    if (!ok || !data || !data.ok) return;
    projects = data.data?.projects || data.projects || [];
  }

  async function loadDaily() {
    const date = workDateEl && workDateEl.value ? workDateEl.value : '';
    if (!date) return showMsg(t('hr.att.dateRequired'), true);
    const { ok, data } = await window.hrApi(`/api/hr/attendance/daily?date=${encodeURIComponent(date)}`);
    if (!ok || !data?.ok) {
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'), true);
      return;
    }
    const payload = data.data || data;
    dailyRows = payload.rows || [];
    isLocked = !!payload.isLocked;
    if (lockHint) lockHint.style.display = isLocked ? 'block' : 'none';
    if (btnSaveDaily) btnSaveDaily.disabled = isLocked;
    renderDailyRows();
  }

  function collectRows() {
    const rows = [];
    dailyBody.querySelectorAll('tr[data-i]').forEach((tr, idx) => {
      const src = dailyRows[idx];
      if (!src || !src.employee_id) return;
      rows.push({
        employee_id: src.employee_id,
        project_id: tr.querySelector('.x-project')?.value || null,
        work_status: tr.querySelector('.x-status')?.value || 'worked',
        work_type: tr.querySelector('.x-worktype')?.value || 'normal',
        check_in_time: tr.querySelector('.x-in')?.value || null,
        check_out_time: tr.querySelector('.x-out')?.value || null,
        total_hours: tr.querySelector('.x-total')?.value || 0,
        overtime_hours: tr.querySelector('.x-ot')?.value || 0,
        note: tr.querySelector('.x-note')?.value || null,
      });
    });
    return rows;
  }

  async function saveDaily() {
    if (isLocked) {
      showMsg(t('hr.att.locked.hint'), true);
      return;
    }
    const date = workDateEl && workDateEl.value ? workDateEl.value : '';
    if (!date) return showMsg(t('hr.att.dateRequired'), true);
    const payload = { workDate: date, entries: collectRows() };
    const { ok, data } = await window.hrApi('/api/hr/attendance/daily-bulk', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!ok || !data?.ok) {
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'), true);
      return;
    }
    showMsg(t('hr.att.daily.saved'), false);
    if (window.appNotify?.success) window.appNotify.success(t('hr.att.daily.saved'));
    await loadDaily();
  }

  async function initHrAttendancePage() {
    if (workDateEl && !workDateEl.value) {
      workDateEl.value = new Date().toISOString().slice(0, 10);
    }
    btnLoadDaily?.addEventListener('click', loadDaily);
    btnSaveDaily?.addEventListener('click', saveDaily);
    await loadProjects();
    await loadDaily();
  }

  window.initHrAttendancePage = initHrAttendancePage;
})();
