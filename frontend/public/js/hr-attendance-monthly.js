(function () {
  const monthKeyEl = document.getElementById('monthKey');
  const mDayFilter = document.getElementById('mDayFilter');
  const btnLoad = document.getElementById('btnLoadMonthly');
  const msgEl = document.getElementById('monthlyMsg');
  const summaryBody = document.getElementById('summaryBody');
  const summaryHeadRow = document.getElementById('summaryHeadRow');
  const monthlyBody = document.getElementById('monthlyBody');
  const mNatFilter = document.getElementById('mNatFilter');
  const mNameFilter = document.getElementById('mNameFilter');
  const mDepFilter = document.getElementById('mDepFilter');
  const mPosFilter = document.getElementById('mPosFilter');
  const attmEditModal = document.getElementById('attmEditModal');
  const attmEditReasonInput = document.getElementById('attmEditReasonInput');
  const attmEditReasonErr = document.getElementById('attmEditReasonErr');
  const attmEditCancel = document.getElementById('attmEditCancel');
  const attmEditGo = document.getElementById('attmEditGo');

  let departments = [];
  let positions = [];
  let projects = [];
  let workTypes = [];
  let workStatuses = [];
  let isLocked = false;
  let monthlyRowsAll = [];
  let salaryVisibility = { group: false, rsu: false, grsu: false, su: false };
  let canEditAttendance = false;
  let pendingWorkDateForEdit = '';
  const liveCards = document.getElementById('liveCards');
  const kpiTotalNormal = document.getElementById('kpiTotalNormal');
  const kpiTotalOvertime = document.getElementById('kpiTotalOvertime');
  const kpiNormalUsd = document.getElementById('kpiNormalUsd');
  const kpiFmUsd = document.getElementById('kpiFmUsd');
  const kpiOfficialUzs = document.getElementById('kpiOfficialUzs');
  const kpiNonOfficialUzs = document.getElementById('kpiNonOfficialUzs');
  const kpiUnofficialUsd = document.getElementById('kpiUnofficialUsd');

  const ICON_EDIT_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function fmtHours(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    return String(Math.round(n * 100) / 100).replace('.', ',');
  }

  function fmtMoney(v, cc) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '-';
    const c = String(cc || '').toUpperCase() === 'USD' ? 'USD' : 'UZS';
    return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
  }

  async function loadMePerms() {
    canEditAttendance = false;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const u = data && data.user;
      if (!u) return;
      if (u.isSuperAdmin === true) {
        canEditAttendance = true;
        return;
      }
      const list = Array.isArray(u.permissions) ? u.permissions : [];
      canEditAttendance = list.includes('hr.attendance.edit');
    } catch (_) {
      canEditAttendance = false;
    }
  }

  function projectLabel(id) {
    const p = projects.find((x) => String(x.id) === String(id || ''));
    if (!id || !p) return '-';
    return String(p.project_code || p.name || p.id);
  }

  function statusLabel(code) {
    const s = workStatuses.find((x) => String(x.code) === String(code || ''));
    return s ? String(s.name || code) : String(code || '-');
  }

  function typeLabel(code) {
    const s = workTypes.find((x) => String(x.code) === String(code || ''));
    return s ? String(s.name || code) : String(code || '-');
  }

  function renderSummaryHead() {
    if (!summaryHeadRow) return;
    const cols = [
      ['hr.att.colEmployee', t('hr.att.colEmployee')],
      ['hr.att.colTotalHours', t('hr.att.colTotalHours')],
      ['hr.att.colOvertimeHours', t('hr.att.colOvertimeHours')],
    ];
    if (salaryVisibility.group && salaryVisibility.rsu) cols.push(['hr.att.monthly.col.ru_uzs_nm', t('hr.att.monthly.col.ru_uzs_nm')]);
    if (salaryVisibility.group && salaryVisibility.grsu) cols.push(['hr.att.monthly.col.gr_uzs_nm', t('hr.att.monthly.col.gr_uzs_nm')]);
    if (salaryVisibility.group && salaryVisibility.su) cols.push(['hr.att.monthly.col.gr_usd_nm', t('hr.att.monthly.col.gr_usd_nm')]);
    if (salaryVisibility.group && salaryVisibility.rsu && salaryVisibility.grsu) cols.push(['hr.att.monthly.col.fm_uzs', t('hr.att.monthly.col.fm_uzs')]);
    if (salaryVisibility.group && salaryVisibility.su) cols.push(['hr.att.monthly.col.fm_usd', t('hr.att.monthly.col.fm_usd')]);
    summaryHeadRow.innerHTML = cols.map(([k, label]) => `<th data-i18n="${k}">${label}</th>`).join('');
  }

  function renderKpis(totals) {
    if (!liveCards) return;
    const hasFinance = !!salaryVisibility.group;
    liveCards.classList.toggle('hidden', !hasFinance);
    if (!kpiTotalNormal || !kpiTotalOvertime) return;
    kpiTotalNormal.textContent = fmtHours(totals?.total_normal_hours || 0);
    kpiTotalOvertime.textContent = fmtHours(totals?.total_overtime_hours || 0);
    if (!hasFinance) return;
    if (kpiNormalUsd) kpiNormalUsd.textContent = totals?.total_gr_usd_nm == null ? '-' : fmtMoney(totals.total_gr_usd_nm, 'USD');
    if (kpiFmUsd) kpiFmUsd.textContent = totals?.total_fm_usd == null ? '-' : fmtMoney(totals.total_fm_usd, 'USD');
    if (kpiOfficialUzs) kpiOfficialUzs.textContent = totals?.total_ru_uzs_nm == null ? '-' : fmtMoney(totals.total_ru_uzs_nm, 'UZS');
    if (kpiNonOfficialUzs) {
      kpiNonOfficialUzs.textContent =
        totals?.total_non_official_uzs == null ? '-' : fmtMoney(totals.total_non_official_uzs, 'UZS');
    }
    if (kpiUnofficialUsd) {
      kpiUnofficialUsd.textContent =
        totals?.total_unofficial_usd == null ? '-' : fmtMoney(totals.total_unofficial_usd, 'USD');
    }
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

  function renderMonthlyRowsTable(rows) {
    const filtered = rowsForDayFilter(rows);
    const editLabel = t('hr.att.monthly.editDailyRow');
    monthlyBody.innerHTML = filtered.length
      ? filtered
          .map((r) => {
            const dateStr = String(r.work_date || '').slice(0, 10);
            const showEdit = canEditAttendance;
            const actionTd = showEdit
              ? `<td><button type="button" class="attm-icon-btn attm-edit-row" data-work-date="${escHtml(
                  dateStr
                )}" title="${escHtml(editLabel)}" aria-label="${escHtml(editLabel)}">${ICON_EDIT_SVG}</button></td>`
              : '<td></td>';
            return `<tr>
                <td>${escHtml(dateStr)}</td>
                <td>${escHtml(displayNameOnly(r.employee_name) || '-')}</td>
                <td>${escHtml(projectLabel(r.project_id))}</td>
                <td>${escHtml(statusLabel(r.work_status))}</td>
                <td>${escHtml(typeLabel(r.work_type))}</td>
                <td>${escHtml(fmtHours(r.total_hours))}</td>
                <td>${escHtml(fmtHours(r.overtime_hours))}</td>
                <td>${escHtml(String(r.note || ''))}</td>
                ${actionTd}
              </tr>`;
          })
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
    salaryVisibility = payload.salaryVisibility || { group: false, rsu: false, grsu: false, su: false };
    const summary = payload.summary || [];
    renderSummaryHead();
    monthlyRowsAll = payload.rows || [];
    summaryBody.innerHTML = summary.length
      ? summary
          .map((x) => {
            const cells = [
              `<td>${displayNameOnly(x.employee_name) || '-'}</td>`,
              `<td>${fmtHours(x.total_normal_hours || x.total_hours || 0)}</td>`,
              `<td>${fmtHours(x.total_overtime_hours || x.overtime_hours || 0)}</td>`,
            ];
            if (salaryVisibility.group && salaryVisibility.rsu) cells.push(`<td>${x.ru_uzs_nm == null ? '-' : fmtMoney(x.ru_uzs_nm, 'UZS')}</td>`);
            if (salaryVisibility.group && salaryVisibility.grsu) cells.push(`<td>${x.gr_uzs_nm == null ? '-' : fmtMoney(x.gr_uzs_nm, 'UZS')}</td>`);
            if (salaryVisibility.group && salaryVisibility.su) cells.push(`<td>${x.gr_usd_nm == null ? '-' : fmtMoney(x.gr_usd_nm, 'USD')}</td>`);
            if (salaryVisibility.group && salaryVisibility.rsu && salaryVisibility.grsu) {
              cells.push(`<td>${x.fm_uzs == null ? '-' : fmtMoney(x.fm_uzs, 'UZS')}</td>`);
            }
            if (salaryVisibility.group && salaryVisibility.su) cells.push(`<td>${x.fm_usd == null ? '-' : fmtMoney(x.fm_usd, 'USD')}</td>`);
            return `<tr>${cells.join('')}</tr>`;
          })
          .join('')
      : `<tr><td colspan="${summaryHeadRow?.children?.length || 3}">${t('hr.att.noRows')}</td></tr>`;
    renderKpis(payload.summaryTotals || {});
    syncDayOptions();
    renderMonthlyRowsTable(monthlyRowsAll);
    showMsg(payload.isLocked ? t('hr.att.monthly.lockedHint') : '', false);
  }

  function closeAttmEditModal() {
    if (attmEditModal) attmEditModal.classList.remove('attm-modal-open');
    pendingWorkDateForEdit = '';
    if (attmEditReasonInput) attmEditReasonInput.value = '';
    if (attmEditReasonErr) attmEditReasonErr.textContent = '';
  }

  function openAttmEditModal(workDate) {
    pendingWorkDateForEdit = String(workDate || '').slice(0, 10);
    if (attmEditReasonInput) attmEditReasonInput.value = '';
    if (attmEditReasonErr) attmEditReasonErr.textContent = '';
    if (attmEditModal) attmEditModal.classList.add('attm-modal-open');
    attmEditReasonInput?.focus();
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

    monthlyBody?.addEventListener('click', (e) => {
      const btn = e.target.closest('.attm-edit-row');
      if (!btn) return;
      const d = btn.getAttribute('data-work-date');
      if (!d) return;
      openAttmEditModal(d);
    });

    attmEditCancel?.addEventListener('click', closeAttmEditModal);
    attmEditGo?.addEventListener('click', () => {
      const raw = String(attmEditReasonInput?.value || '').trim();
      if (!raw) {
        if (attmEditReasonErr) attmEditReasonErr.textContent = t('hr.att.monthly.editReasonRequired');
        attmEditReasonInput?.focus();
        return;
      }
      const d = pendingWorkDateForEdit;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        closeAttmEditModal();
        return;
      }
      window.location.href = `/hr-attendance.html?date=${encodeURIComponent(d)}&editReason=${encodeURIComponent(raw)}`;
    });

    attmEditModal?.addEventListener('click', (e) => {
      if (e.target === attmEditModal) closeAttmEditModal();
    });

    await loadMePerms();
    await loadMDeptPos();
    await loadProjectsAndOptions();
    btnLoad?.addEventListener('click', loadMonthly);
    await loadMonthly();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrAttendanceMonthlyPage = initHrAttendanceMonthlyPage;
})();
