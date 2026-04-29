(function () {
  const workDateEl = document.getElementById('workDate');
  const btnLoadDaily = document.getElementById('btnLoadDaily');
  const btnSaveDaily = document.getElementById('btnSaveDaily');
  const dailyBody = document.getElementById('dailyBody');
  const msgEl = document.getElementById('msg');
  const lockHint = document.getElementById('lockHint');
  const missingCountEl = document.getElementById('missingCount');
  const attNatFilter = document.getElementById('attNatFilter');
  const attDepFilter = document.getElementById('attDepFilter');
  const attNameFilter = document.getElementById('attNameFilter');

  let dailyRows = [];
  let projects = [];
  let isLocked = false;
  let departments = [];
  const dirtyRows = new Set();
  let workTypes = [];
  let workStatuses = [];

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  async function loadAttDepartments() {
    const depRes = await window.hrApi('/api/hr/departments');
    if (depRes.ok && depRes.data?.ok) {
      departments = depRes.data.data?.departments || depRes.data.departments || [];
    }
    if (!attDepFilter) return;
    attDepFilter.innerHTML = `<option value="">${t('hr.emp.filterDept')}</option>`;
    departments.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name;
      attDepFilter.appendChild(o);
    });
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
    return (workStatuses || [])
      .map((it) => {
        const key = String(it.code || '').trim();
        const label = String(it.name || key);
        return `<option value="${key}"${key === v ? ' selected' : ''}>${label}</option>`;
      })
      .join('');
  }

  function workTypeOptionsHtml(selected) {
    const v = String(selected || 'normal');
    return (workTypes || [])
      .map((it) => {
        const key = String(it.code || '').trim();
        const label = String(it.name || key);
        return `<option value="${key}"${key === v ? ' selected' : ''}>${label}</option>`;
      })
      .join('');
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
        <td>${r.employee_display || r.full_name || '-'}</td>
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
    renderMissingCount();
  }

  function renderMissingCount() {
    if (!missingCountEl) return;
    const missing = (dailyRows || []).filter((r) => !r.attendance_id).length;
    const txt = `${t('hr.att.daily.missingCount') || 'Giriş yapılmayan personel'}: ${missing}`;
    missingCountEl.textContent = txt;
  }

  async function loadProjects() {
    const { ok, data } = await window.hrApi('/api/hr/attendance-projects');
    if (!ok || !data || !data.ok) return;
    projects = data.data?.projects || data.projects || [];
  }

  async function loadSettingOptions() {
    const { ok, data } = await window.hrApi('/api/hr/settings');
    if (!ok || !data?.ok) {
      workTypes = [{ code: 'normal', name: t('hr.att.workType.normal') }];
      workStatuses = [{ code: 'worked', name: t('hr.att.status.worked') }];
      return;
    }
    const payload = data.data || data;
    workTypes = payload.workTypes || [];
    workStatuses = payload.workStatuses || [];
    if (!workTypes.length) workTypes = [{ code: 'normal', name: t('hr.att.workType.normal') }];
    if (!workStatuses.length) workStatuses = [{ code: 'worked', name: t('hr.att.status.worked') }];
  }

  async function loadDaily() {
    const date = workDateEl && workDateEl.value ? workDateEl.value : '';
    if (!date) return showMsg(t('hr.att.dateRequired'), true);
    const qs = new URLSearchParams({ date });
    if (attNatFilter?.value) qs.set('nationality', attNatFilter.value);
    if (attDepFilter?.value) qs.set('departmentId', attDepFilter.value);
    if (attNameFilter?.value && String(attNameFilter.value).trim()) qs.set('search', String(attNameFilter.value).trim());
    const { ok, data } = await window.hrApi(`/api/hr/attendance/daily?${qs.toString()}`);
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

  function collectRow(tr, idx) {
    const src = dailyRows[idx];
    if (!src || !src.employee_id) return null;
    return {
      employee_id: src.employee_id,
      project_id: tr.querySelector('.x-project')?.value || null,
      work_status: tr.querySelector('.x-status')?.value || 'worked',
      work_type: tr.querySelector('.x-worktype')?.value || 'normal',
      check_in_time: tr.querySelector('.x-in')?.value || null,
      check_out_time: tr.querySelector('.x-out')?.value || null,
      total_hours: tr.querySelector('.x-total')?.value || 0,
      overtime_hours: tr.querySelector('.x-ot')?.value || 0,
      note: tr.querySelector('.x-note')?.value || null,
    };
  }

  async function saveRowByIndex(idx) {
    if (isLocked) return;
    const tr = dailyBody.querySelector(`tr[data-i="${idx}"]`);
    if (!tr) return;
    const row = collectRow(tr, idx);
    if (!row) return;
    const date = workDateEl && workDateEl.value ? workDateEl.value : '';
    if (!date) return;
    const payload = { workDate: date, entries: [row] };
    const { ok, data } = await window.hrApi('/api/hr/attendance/daily-bulk', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!ok || !data?.ok) {
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'), true);
      return;
    }
    if (dailyRows[idx] && !dailyRows[idx].attendance_id) dailyRows[idx].attendance_id = -1;
    dirtyRows.delete(String(idx));
    renderMissingCount();
  }

  async function saveDaily() {
    if (isLocked) {
      showMsg(t('hr.att.locked.hint'), true);
      return;
    }
    const dirty = [...dirtyRows];
    if (!dirty.length) {
      showMsg(t('api.hr.nothing_to_update') || 'Guncellenecek satir yok', true);
      return;
    }
    for (const i of dirty) {
      // eslint-disable-next-line no-await-in-loop
      await saveRowByIndex(Number(i));
    }
    showMsg(t('hr.att.daily.saved'), false);
  }

  async function initHrAttendancePage() {
    if (workDateEl && !workDateEl.value) {
      workDateEl.value = new Date().toISOString().slice(0, 10);
    }
    btnLoadDaily?.addEventListener('click', loadDaily);
    btnSaveDaily?.addEventListener('click', saveDaily);
    dailyBody?.addEventListener('change', async (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (!tr || isLocked) return;
      const idx = String(tr.getAttribute('data-i'));
      dirtyRows.add(idx);
      await saveRowByIndex(Number(idx));
    });
    await loadAttDepartments();
    await loadProjects();
    await loadSettingOptions();
    await loadDaily();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrAttendancePage = initHrAttendancePage;
})();
