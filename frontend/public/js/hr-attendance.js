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
  const sundayOverrideBox = document.getElementById('sundayOverrideBox');
  const btnSundayOpen = document.getElementById('btnSundayOpen');
  const btnSundayClose = document.getElementById('btnSundayClose');
  const chkSundayPaidDaily = document.getElementById('chkSundayPaidDaily');
  const editReasonBanner = document.getElementById('editReasonBanner');
  const editReasonTextEl = document.getElementById('editReasonText');

  let dailyRows = [];
  /** Aylık ekrandan gelen düzenleme gerekçesi; ilk başarılı kayıtta tüketilir ve URL'den silinir. */
  let urlEditReason = '';
  let projects = [];
  let isLocked = false;
  let canEditDaily = false;
  let departments = [];
  const sundayDayOverrides = {};
  const dirtyRows = new Set();
  let workTypes = [];
  let workStatuses = [];
  let attendanceRules = {
    standardStart: '08:00',
    standardEnd: '18:00',
    break1: { start: '', end: '' },
    break2: { start: '', end: '' },
    break3: { start: '', end: '' },
    break4: { start: '', end: '' },
    lunch: { start: '', end: '' },
    timeDeductionMinutes: 0,
    standardDailyMinutes: 0,
    sundayWorkable: false,
    sundayPaid: false,
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    statusMultipliers: {},
  };
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function applyUrlParamsToDailyPage() {
    try {
      const sp = new URLSearchParams(window.location.search);
      const d = sp.get('date');
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && workDateEl) workDateEl.value = d;
      const er = sp.get('editReason');
      if (er != null && er !== '') {
        try {
          urlEditReason = decodeURIComponent(er);
        } catch {
          urlEditReason = er;
        }
      }
    } catch (_) {
      /* ignore */
    }
  }

  function refreshEditReasonBanner() {
    if (!editReasonBanner || !editReasonTextEl) return;
    const v = String(urlEditReason || '').trim();
    if (!v) {
      editReasonBanner.classList.remove('open');
      editReasonTextEl.textContent = '';
      return;
    }
    editReasonTextEl.textContent = v;
    editReasonBanner.classList.add('open');
  }

  function consumeEditReasonAfterSave() {
    if (!String(urlEditReason || '').trim()) return;
    urlEditReason = '';
    refreshEditReasonBanner();
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('editReason');
      const q = url.searchParams.toString();
      window.history.replaceState({}, '', q ? `${url.pathname}?${q}` : url.pathname);
    } catch (_) {
      /* ignore */
    }
  }

  function rowReadOnly() {
    return isLocked || !canEditDaily;
  }

  async function loadMeForDaily() {
    canEditDaily = false;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const u = data && data.user;
      if (!u) return;
      if (u.isSuperAdmin === true) {
        canEditDaily = true;
        return;
      }
      const list = Array.isArray(u.permissions) ? u.permissions : [];
      canEditDaily = list.includes('hr.attendance.edit');
    } catch (_) {
      canEditDaily = false;
    }
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

  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function timeToMinutes(v) {
    const s = String(v || '').trim();
    if (!/^\d{2}:\d{2}$/.test(s)) return null;
    const [h, m] = s.split(':').map((x) => Number(x) || 0);
    return h * 60 + m;
  }

  function diffMinutes(start, end) {
    const startMinutes = timeToMinutes(start);
    let endMinutes = timeToMinutes(end);
    if (startMinutes == null || endMinutes == null) return 0;
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    return Math.max(0, endMinutes - startMinutes);
  }

  function minutesToDecimalHours(minutes) {
    return round2((Number(minutes) || 0) / 60);
  }

  function formatDecimalHourTR(value) {
    const n = round2(value);
    return String(n).replace('.', ',');
  }

  function clampMin(value, min = 0) {
    return Math.max(min, Number(value) || 0);
  }

  function parseDecimalHourInput(v) {
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? round2(n) : 0;
  }

  function round2(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }

  function isOvertimeEligible(v) {
    if (v === null || v === undefined || v === '') return true;
    return Number(v) === 1;
  }

  function isSundayDate(dateRaw) {
    const d = new Date(`${String(dateRaw || '').slice(0, 10)}T00:00:00`);
    return Number.isFinite(d.getTime()) && d.getDay() === 0;
  }

  function dayKeyFromDate(dateRaw) {
    const d = new Date(`${String(dateRaw || '').slice(0, 10)}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return '';
    return DAY_KEYS[d.getDay()] || '';
  }

  function parseWorkingDays(raw) {
    return String(raw || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter((x) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(x));
  }

  function hhmmFromMinutes(total) {
    const m = ((Number(total) || 0) % (24 * 60) + 24 * 60) % (24 * 60);
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return `${h}:${mm}`;
  }

  function safeEndMinutes(startRaw, endRaw) {
    const start = timeToMinutes(startRaw);
    let end = timeToMinutes(endRaw);
    if (start == null || end == null) return null;
    if (end < start) end += 24 * 60;
    return { start, end };
  }

  function overlapMinutes(rangeStart, rangeEnd, itemStart, itemEnd) {
    const s = Math.max(rangeStart, itemStart);
    const e = Math.min(rangeEnd, itemEnd);
    return clampMin(e - s, 0);
  }

  function breakOverlapMinutes(rangeStart, rangeEnd, br) {
    const hit = safeEndMinutes(br?.start, br?.end);
    if (!hit) return 0;
    return overlapMinutes(rangeStart, rangeEnd, hit.start, hit.end);
  }

  function computeStandardDailyMinutes() {
    const range = safeEndMinutes(attendanceRules.standardStart, attendanceRules.standardEnd);
    if (!range) return 0;
    const b1 = breakOverlapMinutes(range.start, range.end, attendanceRules.break1);
    const b2 = breakOverlapMinutes(range.start, range.end, attendanceRules.break2);
    const lunch = breakOverlapMinutes(range.start, range.end, attendanceRules.lunch);
    return clampMin(range.end - range.start - b1 - b2 - lunch - toNum(attendanceRules.timeDeductionMinutes), 0);
  }

  function resolveStatusCode(raw) {
    const code = String(raw || '').trim().toLowerCase();
    if (!code) return 'worked';
    if (code === 'absent') return 'absent';
    if (code === 'paid_leave') return 'paid_leave';
    if (code === 'unpaid_leave') return 'unpaid_leave';
    if (code === 'leave') return 'paid_leave';
    if (code === 'sick_leave') return 'unpaid_leave';
    return code;
  }

  function computeNormalDayMinutes(startRaw, endRaw) {
    const range = safeEndMinutes(startRaw, endRaw);
    if (!range) return { normalMinutes: 0, overtimeMinutes: 0 };
    const stdEnd = timeToMinutes(attendanceRules.standardEnd || '18:00') ?? (18 * 60);
    const normalEnd = Math.min(range.end, stdEnd);
    const normalBase = clampMin(normalEnd - range.start, 0);
    const normalBreaks =
      breakOverlapMinutes(range.start, normalEnd, attendanceRules.break1) +
      breakOverlapMinutes(range.start, normalEnd, attendanceRules.break2) +
      breakOverlapMinutes(range.start, normalEnd, attendanceRules.lunch);
    const normalMinutes = clampMin(normalBase - normalBreaks - toNum(attendanceRules.timeDeductionMinutes), 0);
    const overtimeBase = clampMin(range.end - stdEnd, 0);
    const break3Overtime = breakOverlapMinutes(stdEnd, range.end, attendanceRules.break3);
    const overtimeMinutes = clampMin(overtimeBase - break3Overtime, 0);
    return { normalMinutes, overtimeMinutes };
  }

  function computeSundayOvertimeMinutes(startRaw, endRaw) {
    const range = safeEndMinutes(startRaw, endRaw);
    if (!range) return 0;
    const totalBase = clampMin(range.end - range.start, 0);
    const breaks =
      breakOverlapMinutes(range.start, range.end, attendanceRules.break1) +
      breakOverlapMinutes(range.start, range.end, attendanceRules.break2) +
      breakOverlapMinutes(range.start, range.end, attendanceRules.lunch);
    let result = clampMin(totalBase - breaks, 0);
    const stdEnd = timeToMinutes(attendanceRules.standardEnd || '18:00') ?? (18 * 60);
    if (range.end > stdEnd) {
      result = clampMin(result - breakOverlapMinutes(stdEnd, range.end, attendanceRules.break3), 0);
    }
    return result;
  }

  function getStatusMultiplier(statusCode) {
    const key = String(statusCode || '').trim().toLowerCase();
    const n = Number(attendanceRules.statusMultipliers?.[key]);
    return Number.isFinite(n) && n >= 0 ? n : 1;
  }

  function getSundayRuleByDate(dateRaw) {
    const date = String(dateRaw || '').slice(0, 10);
    const override = sundayDayOverrides[date] || {};
    return {
      workable: override.workable !== undefined ? !!override.workable : !!attendanceRules.sundayWorkable,
      paid: override.paid !== undefined ? !!override.paid : !!attendanceRules.sundayPaid,
    };
  }

  function refreshSundayOverrideUi() {
    if (!sundayOverrideBox) return;
    const date = workDateEl?.value || '';
    const isSunday = dayKeyFromDate(date) === 'sun';
    sundayOverrideBox.classList.toggle('open', isSunday);
    if (!isSunday) return;
    const rule = getSundayRuleByDate(date);
    if (chkSundayPaidDaily) chkSundayPaidDaily.checked = !!rule.paid;
    if (btnSundayOpen) btnSundayOpen.disabled = !canEditDaily || !!rule.workable;
    if (btnSundayClose) btnSundayClose.disabled = !canEditDaily || !rule.workable;
    if (chkSundayPaidDaily) chkSundayPaidDaily.disabled = !canEditDaily;
  }

  function getDayTypeLabel(dayType) {
    return dayType === 'weekend_unpaid' ? t('hr.att.dayType.weekend_unpaid') : t('hr.att.dayType.working_day');
  }

  function applyRowRules(tr, idx) {
    const row = dailyRows[idx] || {};
    const date = workDateEl?.value || '';
    const dayKey = dayKeyFromDate(date);
    const isSunday = dayKey === 'sun';
    const sundayRule = isSunday ? getSundayRuleByDate(date) : null;
    const dayAllowed = attendanceRules.workingDays.includes(dayKey);
    const isWeekendUnpaid = isSunday && !sundayRule?.workable;
    const disallowEntry = isSunday ? !sundayRule?.workable : !dayAllowed;
    const inEl = tr.querySelector('.x-in');
    const outEl = tr.querySelector('.x-out');
    const totalEl = tr.querySelector('.x-total');
    const otEl = tr.querySelector('.x-ot');

    if (!inEl || !outEl || !totalEl || !otEl) return;
    tr.querySelectorAll('.x-project,.x-status,.x-worktype,.x-note-btn,.x-copy-btn').forEach((el) => {
      el.disabled = rowReadOnly() || disallowEntry;
    });
    inEl.disabled = rowReadOnly() || disallowEntry;
    outEl.disabled = rowReadOnly() || disallowEntry;

    if (disallowEntry) {
      inEl.value = '';
      outEl.value = '';
      totalEl.value = formatDecimalHourTR(0);
      otEl.value = formatDecimalHourTR(0);
      tr.dataset.dayType = isWeekendUnpaid ? 'weekend_unpaid' : 'working_day';
      tr.dataset.dailyWage = '0';
      return;
    }

    const statusCode = resolveStatusCode(tr.querySelector('.x-status')?.value || row.work_status || 'worked');
    const overtimeEligible = isOvertimeEligible(row.overtime_eligible);
    const statusMultiplier = getStatusMultiplier(statusCode);
    tr.dataset.statusMultiplier = String(statusMultiplier);

    const standardRange = safeEndMinutes(attendanceRules.standardStart, attendanceRules.standardEnd);
    if (statusCode === 'paid_leave' && standardRange) {
      inEl.value = hhmmFromMinutes(standardRange.start);
      outEl.value = hhmmFromMinutes(standardRange.end);
      inEl.disabled = true;
      outEl.disabled = true;
    } else if (statusCode === 'absent' || statusCode === 'unpaid_leave') {
      inEl.value = '';
      outEl.value = '';
      inEl.disabled = true;
      outEl.disabled = true;
    }

    if (statusCode === 'absent' || statusCode === 'unpaid_leave') {
      totalEl.value = formatDecimalHourTR(0);
      otEl.value = formatDecimalHourTR(0);
      tr.dataset.dailyWage = '0';
      tr.dataset.dayType = 'working_day';
      return;
    }

    if (isSunday) {
      if (!sundayRule?.paid) {
        totalEl.value = formatDecimalHourTR(0);
        otEl.value = formatDecimalHourTR(0);
        tr.dataset.dailyWage = '0';
        tr.dataset.dayType = 'weekend_unpaid';
        return;
      }
      const sundayOvertimeMinutes =
        statusCode === 'paid_leave' ? attendanceRules.standardDailyMinutes : computeSundayOvertimeMinutes(inEl.value, outEl.value);
      totalEl.value = formatDecimalHourTR(0);
      const sundayOt = minutesToDecimalHours(sundayOvertimeMinutes) * statusMultiplier;
      otEl.value = formatDecimalHourTR(overtimeEligible ? sundayOt : 0);
      tr.dataset.dailyWage = '1';
      tr.dataset.dayType = 'working_day';
      return;
    }

    if (statusCode === 'paid_leave') {
      totalEl.value = formatDecimalHourTR(minutesToDecimalHours(attendanceRules.standardDailyMinutes) * statusMultiplier);
      otEl.value = formatDecimalHourTR(0);
      tr.dataset.dailyWage = '1';
      tr.dataset.dayType = 'working_day';
      return;
    }

    const calc = computeNormalDayMinutes(inEl.value || row.check_in_time, outEl.value || row.check_out_time);
    totalEl.value = formatDecimalHourTR(minutesToDecimalHours(calc.normalMinutes) * statusMultiplier);
    const regularOt = minutesToDecimalHours(calc.overtimeMinutes) * statusMultiplier;
    otEl.value = formatDecimalHourTR(overtimeEligible ? regularOt : 0);
    tr.dataset.dailyWage = '1';
    tr.dataset.dayType = 'working_day';
  }

  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statusOptionsHtml(selected) {
    const fallbackStatuses = [
      { code: 'worked', name: t('hr.att.status.worked') },
      { code: 'absent', name: t('hr.att.status.absent') },
      { code: 'paid_leave', name: t('hr.att.status.paid_leave') },
      { code: 'unpaid_leave', name: t('hr.att.status.unpaid_leave') },
      { code: 'overtime', name: t('hr.att.status.overtime') },
    ];
    const dynamicStatuses = (workStatuses || []).filter((s) => Number(s.is_active ?? 1) === 1);
    const source = dynamicStatuses.length ? dynamicStatuses : fallbackStatuses;
    const v = resolveStatusCode(selected || 'worked');
    const seen = new Set();
    return source
      .map((it) => {
        const key = resolveStatusCode(String(it.code || '').trim());
        if (seen.has(key)) return '';
        seen.add(key);
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
        (r, idx) => {
          const name = r.full_name || r.employee_name || r.employee_display || '-';
          const empNo = r.employee_no || r.employee_code || r.emp_no || '';
          const dayType = r.day_type || 'working_day';
          const overtimeBadge = isOvertimeEligible(r.overtime_eligible) ? '' : `<span class="att-day-type">${escHtml(t('hr.att.overtimeOff'))}</span>`;
          return `<tr class="${rowReadOnly() ? 'att-row-locked' : ''}" data-i="${idx}">
        <td><span>${escHtml(name)}</span>${empNo ? `<span class="att-emp-code">${escHtml(empNo)}</span>` : ''}${overtimeBadge}<span class="att-day-type">${escHtml(
            getDayTypeLabel(dayType)
          )}</span></td>
        <td><select class="pur-inp x-project" ${rowReadOnly() ? 'disabled' : ''}>${projectOptionsHtml(r.project_id)}</select></td>
        <td><select class="pur-inp x-status" ${rowReadOnly() ? 'disabled' : ''}>${statusOptionsHtml(r.work_status)}</select></td>
        <td><select class="pur-inp x-worktype" ${rowReadOnly() ? 'disabled' : ''}>${workTypeOptionsHtml(r.work_type)}</select></td>
        <td><input class="pur-inp x-in" type="time" value="${fmtTime(r.check_in_time)}" ${rowReadOnly() ? 'disabled' : ''}/></td>
        <td><input class="pur-inp x-out" type="time" value="${fmtTime(r.check_out_time)}" ${rowReadOnly() ? 'disabled' : ''}/></td>
        <td class="att-input-col"><input class="pur-inp x-total" type="text" value="${formatDecimalHourTR(Number(r.total_hours || 0))}" readonly /></td>
        <td class="att-input-col"><input class="pur-inp x-ot" type="text" value="${formatDecimalHourTR(Number(r.overtime_hours || 0))}" readonly /></td>
        <td class="att-actions-col">
          <div class="att-mini-actions">
            <button type="button" class="att-mini-btn x-note-btn ${r.note ? 'has-note' : ''}" ${rowReadOnly() ? 'disabled' : ''} title="${escHtml(
              t('hr.att.colNote')
            )}" aria-label="${escHtml(t('hr.att.colNote'))}">📝</button>
            <button type="button" class="att-mini-btn x-copy-btn" ${rowReadOnly() ? 'disabled' : ''} title="${escHtml(
              t('purch.req.copyRow')
            )}" aria-label="${escHtml(t('purch.req.copyRow'))}">⤵</button>
          </div>
        </td>
      </tr>`;
        }
      )
      .join('');
    dailyRows.forEach((r, idx) => {
      const tr = dailyBody.querySelector(`tr[data-i="${idx}"]`);
      if (!tr) return;
      const date = workDateEl?.value || '';
      const sundayRule = dayKeyFromDate(date) === 'sun' ? getSundayRuleByDate(date) : null;
      const isWeekendUnpaid = dayKeyFromDate(date) === 'sun' && !sundayRule?.workable;
      r.day_type = isWeekendUnpaid ? 'weekend_unpaid' : 'working_day';
      applyRowRules(tr, idx);
    });
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
    if (!workStatuses.some((s) => String(s.code || '').trim().toLowerCase() === 'paid_leave')) {
      workStatuses.push({ code: 'paid_leave', name: t('hr.att.status.paid_leave'), multiplier: 1 });
    }
    if (!workStatuses.some((s) => String(s.code || '').trim().toLowerCase() === 'unpaid_leave')) {
      workStatuses.push({ code: 'unpaid_leave', name: t('hr.att.status.unpaid_leave'), multiplier: 0 });
    }
    const statusMultipliers = {};
    workStatuses.forEach((s) => {
      const key = String(s.code || '').trim().toLowerCase();
      if (!key) return;
      const n = Number(s.multiplier);
      statusMultipliers[key] = Number.isFinite(n) && n >= 0 ? n : 1;
    });
    const settings = payload.settings || {};
    const standardStart = settings.standard_start_time || settings.daily_start_time || '08:00';
    const standardEnd = settings.standard_end_time || settings.daily_end_time || '18:00';
    const break1 = { start: settings.break_1_start_time || '', end: settings.break_1_end_time || '' };
    const break2 = { start: settings.break_2_start_time || '', end: settings.break_2_end_time || '' };
    const break3 = { start: settings.break_3_start_time || '', end: settings.break_3_end_time || '' };
    const break4 = { start: settings.break_4_start_time || '', end: settings.break_4_end_time || '' };
    const lunch = { start: settings.lunch_start_time || '', end: settings.lunch_end_time || '' };
    const timeDeductionMinutes = Math.round(parseDecimalHourInput(settings.time_deduction_hours || 0) * 60);
    const workingDays = parseWorkingDays(settings.working_days || 'mon,tue,wed,thu,fri,sat');
    attendanceRules = {
      standardStart,
      standardEnd,
      break1,
      break2,
      break3,
      break4,
      lunch,
      timeDeductionMinutes,
      standardDailyMinutes: 0,
      sundayWorkable: String(settings.sunday_workable || '0') === '1' || workingDays.includes('sun'),
      sundayPaid: String(settings.sunday_paid || '0') === '1',
      workingDays: workingDays.length ? workingDays : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      statusMultipliers,
    };
    attendanceRules.standardDailyMinutes = computeStandardDailyMinutes();
    if (!workTypes.length) workTypes = [{ code: 'normal', name: t('hr.att.workType.normal') }];
    if (!workStatuses.length) workStatuses = [{ code: 'worked', name: t('hr.att.status.worked') }];
    refreshSundayOverrideUi();
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
    if (btnSaveDaily) btnSaveDaily.disabled = rowReadOnly();
    refreshSundayOverrideUi();
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
      total_hours: parseDecimalHourInput(tr.querySelector('.x-total')?.value || 0),
      overtime_hours: parseDecimalHourInput(tr.querySelector('.x-ot')?.value || 0),
      note: tr.dataset.note || null,
    };
  }

  async function saveRowByIndex(idx) {
    if (rowReadOnly()) return;
    const tr = dailyBody.querySelector(`tr[data-i="${idx}"]`);
    if (!tr) return;
    applyRowRules(tr, idx);
    const row = collectRow(tr, idx);
    if (!row) return;
    const date = workDateEl && workDateEl.value ? workDateEl.value : '';
    if (!date) return;
    const payload = { workDate: date, entries: [row] };
    const reasonTrim = String(urlEditReason || '').trim();
    if (reasonTrim) payload.editReason = reasonTrim;
    const { ok, data } = await window.hrApi('/api/hr/attendance/daily-bulk', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!ok || !data?.ok) {
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'), true);
      return;
    }
    if (reasonTrim) consumeEditReasonAfterSave();
    if (dailyRows[idx] && !dailyRows[idx].attendance_id) dailyRows[idx].attendance_id = -1;
    dirtyRows.delete(String(idx));
    renderMissingCount();
  }

  async function saveDaily() {
    if (isLocked) {
      showMsg(t('hr.att.locked.hint'), true);
      return;
    }
    if (!canEditDaily) {
      showMsg(t('api.permission.denied'), true);
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

  async function recalcAndPersistAllRows() {
    if (rowReadOnly() || !dailyRows.length) return;
    const trs = dailyBody?.querySelectorAll('tr[data-i]') || [];
    trs.forEach((tr) => {
      const idx = Number(tr.getAttribute('data-i'));
      if (!Number.isFinite(idx)) return;
      applyRowRules(tr, idx);
      dirtyRows.add(String(idx));
    });
    for (const i of [...dirtyRows]) {
      // eslint-disable-next-line no-await-in-loop
      await saveRowByIndex(Number(i));
    }
  }

  async function initHrAttendancePage() {
    if (workDateEl && !workDateEl.value) {
      workDateEl.value = new Date().toISOString().slice(0, 10);
    }
    applyUrlParamsToDailyPage();
    refreshEditReasonBanner();
    btnLoadDaily?.addEventListener('click', loadDaily);
    btnSaveDaily?.addEventListener('click', saveDaily);
    workDateEl?.addEventListener('change', () => {
      refreshSundayOverrideUi();
      loadDaily();
    });
    btnSundayOpen?.addEventListener('click', () => {
      if (!canEditDaily) return;
      const date = String(workDateEl?.value || '').slice(0, 10);
      if (!date) return;
      const prev = sundayDayOverrides[date] || {};
      sundayDayOverrides[date] = { ...prev, workable: true };
      refreshSundayOverrideUi();
      renderDailyRows();
      recalcAndPersistAllRows();
    });
    btnSundayClose?.addEventListener('click', () => {
      if (!canEditDaily) return;
      const date = String(workDateEl?.value || '').slice(0, 10);
      if (!date) return;
      const prev = sundayDayOverrides[date] || {};
      sundayDayOverrides[date] = { ...prev, workable: false };
      refreshSundayOverrideUi();
      renderDailyRows();
      recalcAndPersistAllRows();
    });
    chkSundayPaidDaily?.addEventListener('change', () => {
      if (!canEditDaily) return;
      const date = String(workDateEl?.value || '').slice(0, 10);
      if (!date) return;
      const prev = sundayDayOverrides[date] || {};
      sundayDayOverrides[date] = { ...prev, paid: !!chkSundayPaidDaily.checked };
      refreshSundayOverrideUi();
      renderDailyRows();
      recalcAndPersistAllRows();
    });
    dailyBody?.addEventListener('change', async (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (!tr || rowReadOnly()) return;
      const idx = String(tr.getAttribute('data-i'));
      applyRowRules(tr, Number(idx));
      dirtyRows.add(idx);
      await saveRowByIndex(Number(idx));
    });
    dailyBody?.addEventListener('click', async (e) => {
      if (rowReadOnly()) return;
      const noteBtn = e.target.closest('.x-note-btn');
      if (noteBtn) {
        const tr = noteBtn.closest('tr[data-i]');
        if (!tr) return;
        const idx = String(tr.getAttribute('data-i'));
        const prev = tr.dataset.note || '';
        const next = String(window.prompt(t('hr.att.colNote'), prev) || '').trim();
        tr.dataset.note = next;
        noteBtn.classList.toggle('has-note', !!next);
        dirtyRows.add(idx);
        await saveRowByIndex(Number(idx));
        return;
      }
      const copyBtn = e.target.closest('.x-copy-btn');
      if (copyBtn) {
        const tr = copyBtn.closest('tr[data-i]');
        if (!tr) return;
        const idx = Number(tr.getAttribute('data-i'));
        if (!Number.isFinite(idx)) return;
        const nextTr = dailyBody.querySelector(`tr[data-i="${idx + 1}"]`);
        if (!nextTr) return;
        const inVal = tr.querySelector('.x-in')?.value || '';
        const outVal = tr.querySelector('.x-out')?.value || '';
        const inNext = nextTr.querySelector('.x-in');
        const outNext = nextTr.querySelector('.x-out');
        if (inNext) inNext.value = inVal;
        if (outNext) outNext.value = outVal;
        applyRowRules(nextTr, idx + 1);
        dirtyRows.add(String(idx + 1));
        await saveRowByIndex(idx + 1);
      }
    });
    await loadMeForDaily();
    await loadAttDepartments();
    await loadProjects();
    await loadSettingOptions();
    await loadDaily();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrAttendancePage = initHrAttendancePage;
})();
