(function () {
  const monthKeyEl = document.getElementById('monthKey');
  const mDayFilter = document.getElementById('mDayFilter');
  const btnLoad = document.getElementById('btnLoadMonthly');
  const msgEl = document.getElementById('monthlyMsg');
  const summaryBody = document.getElementById('summaryBody');
  const monthlyBody = document.getElementById('monthlyBody');
  const mNatFilter = document.getElementById('mNatFilter');
  const mNameFilter = document.getElementById('mNameFilter');
  const mDepFilter = document.getElementById('mDepFilter');
  const mPosFilter = document.getElementById('mPosFilter');

  let departments = [];
  let positions = [];
  let projects = [];
  let workTypes = [];
  let workStatuses = [];
  let isLocked = false;
  let monthlyRowsAll = [];

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function showMsg(text, isErr) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = isErr ? '#b91c1c' : '#166534';
  }

  function daysInMonthYm(ym) {
    const parts = String(ym || '').split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 31;
    return new Date(y, m, 0).getDate();
  }

  function syncDayOptions() {
    if (!mDayFilter || !monthKeyEl) return;
    const ym = monthKeyEl.value;
    const prev = mDayFilter.value;
    const dim = daysInMonthYm(ym);
    mDayFilter.innerHTML = `<option value="">${t('hr.att.monthly.allDays')}</option>`;
    for (let d = 1; d <= dim; d += 1) {
      const val = String(d).padStart(2, '0');
      const o = document.createElement('option');
      o.value = val;
      o.textContent = String(d);
      mDayFilter.appendChild(o);
    }
    if (prev && Number(prev) >= 1 && Number(prev) <= dim) {
      mDayFilter.value = String(Number(prev)).padStart(2, '0');
    } else {
      mDayFilter.value = '';
    }
  }

  function rowsForDayFilter(rows) {
    const day = mDayFilter?.value;
    if (!day) return rows;
    const ym = monthKeyEl?.value;
    if (!ym) return rows;
    const prefix = `${ym}-${String(day).padStart(2, '0')}`;
    return (rows || []).filter((r) => String(r.work_date || '').slice(0, 10) === prefix);
  }

  function displayNameOnly(v) {
    const s = String(v || '').trim();
    const p = s.indexOf(' - ');
    return p > -1 ? s.slice(p + 3).trim() : s;
  }

  function syncMPosFilter() {
    if (!mDepFilter || !mPosFilter) return;
    const dep = mDepFilter.value ? String(mDepFilter.value) : '';
    const filtered = dep ? positions.filter((p) => String(p.department_id) === dep) : positions;
    const cur = mPosFilter.value;
    mPosFilter.innerHTML = `<option value="">${t('hr.emp.filterPos')}</option>`;
    filtered.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      mPosFilter.appendChild(o);
    });
    if (cur && filtered.some((p) => String(p.id) === String(cur))) mPosFilter.value = cur;
  }

  async function loadMDeptPos() {
    const depRes = await window.hrApi('/api/hr/departments');
    if (depRes.ok && depRes.data?.ok) {
      departments = depRes.data.data?.departments || depRes.data.departments || [];
    }
    const posRes = await window.hrApi('/api/hr/positions');
    if (posRes.ok && posRes.data?.ok) {
      positions = posRes.data.data?.positions || posRes.data.positions || [];
    }
    if (!mDepFilter) return;
    mDepFilter.innerHTML = `<option value="">${t('hr.emp.filterDept')}</option>`;
    departments.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name;
      mDepFilter.appendChild(o);
    });
    syncMPosFilter();
  }

  async function loadProjectsAndOptions() {
    const pRes = await window.hrApi('/api/hr/attendance-projects');
    if (pRes.ok && pRes.data?.ok) projects = pRes.data.data?.projects || pRes.data.projects || [];
    const sRes = await window.hrApi('/api/hr/settings');
    if (sRes.ok && sRes.data?.ok) {
      const payload = sRes.data.data || sRes.data;
      workTypes = payload.workTypes || [];
      workStatuses = payload.workStatuses || [];
    }
  }

  function projectOptions(cur) {
    let html = '<option value="">-</option>';
    projects.forEach((p) => {
      const v = String(p.id);
      html += `<option value="${v}"${String(cur || '') === v ? ' selected' : ''}>${p.project_code || p.name || p.id}</option>`;
    });
    return html;
  }
  function statusOptions(cur) {
    return (workStatuses || [])
      .map((s) => `<option value="${s.code}"${String(cur || '') === String(s.code) ? ' selected' : ''}>${s.name || s.code}</option>`)
      .join('');
  }
  function typeOptions(cur) {
    return (workTypes || [])
      .map((s) => `<option value="${s.code}"${String(cur || '') === String(s.code) ? ' selected' : ''}>${s.name || s.code}</option>`)
      .join('');
  }

  function renderMonthlyRowsTable(rows) {
    const filtered = rowsForDayFilter(rows);
    monthlyBody.innerHTML = filtered.length
      ? filtered
          .map(
            (r) =>
              `<tr data-id="${r.id}" data-locked="${isLocked ? '1' : '0'}" data-orig='${encodeURIComponent(
                JSON.stringify({
                  project_id: r.project_id || null,
                  work_status: r.work_status || '',
                  work_type: r.work_type || '',
                  total_hours: Number(r.total_hours || 0),
                  overtime_hours: Number(r.overtime_hours || 0),
                  note: String(r.note || ''),
                })
              )}'>
                <td>${String(r.work_date || '').slice(0, 10)}</td>
                <td>${displayNameOnly(r.employee_name) || '-'}</td>
                <td><select class="x-project" ${isLocked ? 'disabled' : ''}>${projectOptions(r.project_id)}</select></td>
                <td><select class="x-status" ${isLocked ? 'disabled' : ''}>${statusOptions(r.work_status)}</select></td>
                <td><select class="x-type" ${isLocked ? 'disabled' : ''}>${typeOptions(r.work_type)}</select></td>
                <td><input class="x-total" type="number" min="0" step="0.25" value="${Number(r.total_hours || 0)}" ${isLocked ? 'disabled' : ''}/></td>
                <td><input class="x-ot" type="number" min="0" step="0.25" value="${Number(r.overtime_hours || 0)}" ${isLocked ? 'disabled' : ''}/></td>
                <td><input class="x-note" type="text" value="${String(r.note || '').replace(/"/g, '&quot;')}" ${isLocked ? 'disabled' : ''}/></td>
                <td><button type="button" class="version-btn attm-row-btn x-save" ${isLocked ? 'disabled' : ''}>${t('common.save')}</button></td>
              </tr>`
          )
          .join('')
      : `<tr><td colspan="9">${t('hr.att.noRows')}</td></tr>`;
  }

  async function loadMonthly() {
    const mk = monthKeyEl && monthKeyEl.value ? monthKeyEl.value : '';
    if (!mk) return showMsg(t('hr.att.monthly.pickMonth'), true);
    const qs = new URLSearchParams({ month: mk });
    if (mNatFilter?.value) qs.set('nationality', mNatFilter.value);
    if (mNameFilter?.value && String(mNameFilter.value).trim()) qs.set('search', String(mNameFilter.value).trim());
    if (mDepFilter?.value) qs.set('departmentId', mDepFilter.value);
    if (mPosFilter?.value) qs.set('positionId', mPosFilter.value);
    const { ok, data } = await window.hrApi(`/api/hr/attendance/monthly?${qs.toString()}`);
    if (!ok || !data?.ok) {
      showMsg(
        (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.att.loadFailed'),
        true
      );
      return;
    }
    const payload = data.data || data;
    isLocked = !!payload.isLocked;
    const summary = payload.summary || [];
    monthlyRowsAll = payload.rows || [];
    summaryBody.innerHTML = summary.length
      ? summary
          .map(
            (x) =>
              `<tr><td>${displayNameOnly(x.employee_name) || '-'}</td><td>${Number(x.total_hours || 0).toFixed(2)}</td><td>${Number(x.overtime_hours || 0).toFixed(2)}</td></tr>`
          )
          .join('')
      : `<tr><td colspan="3">${t('hr.att.noRows')}</td></tr>`;
    syncDayOptions();
    renderMonthlyRowsTable(monthlyRowsAll);
    showMsg(payload.isLocked ? t('hr.att.monthly.lockedHint') : '', false);
  }

  async function onMonthlyBodyClick(e) {
    const btn = e.target.closest('.x-save');
    if (!btn) return;
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    if (tr.getAttribute('data-locked') === '1') {
      showMsg(t('hr.att.monthly.lockedHint'), true);
      return;
    }
    const id = tr.getAttribute('data-id');
    const orig = JSON.parse(decodeURIComponent(tr.getAttribute('data-orig') || ''));
    const next = {
      project_id: tr.querySelector('.x-project')?.value || null,
      work_status: tr.querySelector('.x-status')?.value || '',
      work_type: tr.querySelector('.x-type')?.value || '',
      total_hours: Number(tr.querySelector('.x-total')?.value || 0),
      overtime_hours: Number(tr.querySelector('.x-ot')?.value || 0),
      note: String(tr.querySelector('.x-note')?.value || '').trim(),
    };
    const changed =
      String(next.project_id || '') !== String(orig.project_id || '') ||
      String(next.work_status || '') !== String(orig.work_status || '') ||
      String(next.work_type || '') !== String(orig.work_type || '') ||
      Number(next.total_hours || 0) !== Number(orig.total_hours || 0) ||
      Number(next.overtime_hours || 0) !== Number(orig.overtime_hours || 0) ||
      String(next.note || '') !== String(orig.note || '');
    if (!changed) {
      showMsg(t('api.hr.nothing_to_update'), true);
      return;
    }
    if (!next.note) {
      showMsg(t('hr.att.monthly.noteRequired'), true);
      tr.querySelector('.x-note')?.focus();
      return;
    }
    const { ok, data } = await window.hrApi(`/api/hr/attendance/monthly/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(next),
    });
    if (!ok || !data?.ok) {
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'), true);
      return;
    }
    showMsg(t('hr.att.monthly.rowSaved'), false);
    await loadMonthly();
  }

  async function initHrAttendanceMonthlyPage() {
    if (monthKeyEl && !monthKeyEl.value) monthKeyEl.value = new Date().toISOString().slice(0, 7);
    syncDayOptions();
    monthKeyEl?.addEventListener('change', () => {
      syncDayOptions();
      monthlyRowsAll = [];
      renderMonthlyRowsTable([]);
    });
    mDayFilter?.addEventListener('change', () => {
      renderMonthlyRowsTable(monthlyRowsAll);
    });
    mDepFilter?.addEventListener('change', syncMPosFilter);
    await loadMDeptPos();
    await loadProjectsAndOptions();
    btnLoad?.addEventListener('click', loadMonthly);
    monthlyBody?.addEventListener('click', onMonthlyBodyClick);
    await loadMonthly();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrAttendanceMonthlyPage = initHrAttendanceMonthlyPage;
})();
