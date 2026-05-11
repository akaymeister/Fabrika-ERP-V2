(function () {
  const payMonth = document.getElementById('payMonth');
  const payPeriodDisplay = document.getElementById('payPeriodDisplay');
  const payStateRead = document.getElementById('payStateRead');
  const payPayDateInfo = document.getElementById('payPayDateInfo');
  const paySearch = document.getElementById('paySearch');
  const payDep = document.getElementById('payDep');
  const btnPayLoad = document.getElementById('btnPayLoad');
  const btnPayRecalc = document.getElementById('btnPayRecalc');
  const btnPayLock = document.getElementById('btnPayLock');
  const btnPayUnlock = document.getElementById('btnPayUnlock');
  const linkPayMonthly = document.getElementById('linkPayMonthly');
  const linkPayLocks = document.getElementById('linkPayLocks');
  const payMsg = document.getElementById('payMsg');
  const payBody = document.getElementById('payBody');
  const payDispBody = document.getElementById('payDispBody');
  const btnPayNewDispute = document.getElementById('btnPayNewDispute');
  const payKpiHead = document.getElementById('payKpiHead');
  const payKpiNormH = document.getElementById('payKpiNormH');
  const payKpiOtH = document.getElementById('payKpiOtH');
  const payKpiActiveSalaryUsd = document.getElementById('payKpiActiveSalaryUsd');
  const payKpiAcc = document.getElementById('payKpiAcc');
  const payKpiAccTotalUsd = document.getElementById('payKpiAccTotalUsd');
  const payKpiOfficialUsd = document.getElementById('payKpiOfficialUsd');
  const payKpiTotalOvertimeUsd = document.getElementById('payKpiTotalOvertimeUsd');
  const payKpiOfficialUz = document.getElementById('payKpiOfficialUz');
  const payKpiGrUz = document.getElementById('payKpiGrUz');
  const payKpiFmUz = document.getElementById('payKpiFmUz');
  const payKpiUnofficialUsd = document.getElementById('payKpiUnofficialUsd');
  const payKpiDisp = document.getElementById('payKpiDisp');
  const payDispModal = document.getElementById('payDispModal');
  const payDispEmp = document.getElementById('payDispEmp');
  const payDispDay = document.getElementById('payDispDay');
  const payDispType = document.getElementById('payDispType');
  const payDispDesc = document.getElementById('payDispDesc');
  const payDispCancel = document.getElementById('payDispCancel');
  const payDispSave = document.getElementById('payDispSave');
  const payDayModal = document.getElementById('payDayModal');
  const payDayModalClose = document.getElementById('payDayModalClose');
  const payDayModalEmp = document.getElementById('payDayModalEmp');
  const payDayBody = document.getElementById('payDayBody');
  const payUsdUzsRate = document.getElementById('payUsdUzsRate');
  const payUsdUzsRateHint = document.getElementById('payUsdUzsRateHint');
  const btnPaySaveDefaultFx = document.getElementById('btnPaySaveDefaultFx');

  let canEditDispute = false;
  let canUnlockAttendance = false;
  /** @type {any} */
  let lastPayload = null;

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function showMsg(text, isErr) {
    if (!payMsg) return;
    payMsg.textContent = text || '';
    payMsg.style.color = isErr ? '#b91c1c' : '#166534';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function monthNowStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function fmtHours(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    return String(Math.round(n * 100) / 100).replace('.', ',');
  }

  function fmtUz(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    const formatted = x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} UZS`;
  }

  function fmtUsd(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    const formatted = x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} USD`;
  }

  function fxFromPayload(p) {
    const n = Number(p?.payrollUsdUzs?.effectiveRate);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function usdByFx(uzs, fx) {
    const x = Number(uzs);
    const r = Number(fx);
    if (!Number.isFinite(x) || !Number.isFinite(r) || r <= 0) return null;
    return x / r;
  }

  function n0(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function createUsdAgg() {
    return { value: 0, hasValue: false, missingFx: false };
  }

  function addUsd(agg, v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return;
    agg.value += n;
    agg.hasValue = true;
  }

  function addUzsAsUsd(agg, uzs, fx) {
    const u = Number(uzs);
    if (!Number.isFinite(u) || u === 0) return;
    const usd = usdByFx(u, fx);
    if (usd == null) {
      agg.missingFx = true;
      return;
    }
    agg.value += usd;
    agg.hasValue = true;
  }

  function fmtUsdAgg(agg, vis, dash = '—') {
    if (!vis) return dash;
    if (agg.missingFx) return dash;
    return agg.hasValue ? fmtUsd(agg.value) : dash;
  }

  function fmtBase(row) {
    if (row.total_salary_uzs != null && Number.isFinite(Number(row.total_salary_uzs))) {
      return fmtUz(row.total_salary_uzs);
    }
    if (row.total_salary_usd != null && Number.isFinite(Number(row.total_salary_usd))) {
      const formatted = Number(row.total_salary_usd).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${formatted} USD`;
    }
    return '—';
  }

  function accrualUz(row) {
    const ru = row.ru_uzs_nm;
    const gr = row.gr_uzs_nm;
    const fm = row.fm_uzs;
    if (ru == null && gr == null && fm == null) return null;
    const sum = Number(ru || 0) + Number(gr || 0) + Number(fm || 0);
    return Number.isFinite(sum) ? sum : null;
  }

  /** Dönem: resmi + resmi olmayan normal tahakkuk (UZS); ayrı satırda gayri resmi normal USD. */
  function sumNormalUzs(row) {
    const ru = row.ru_uzs_nm;
    const gr = row.gr_uzs_nm;
    if (ru == null && gr == null) return null;
    return Number(ru || 0) + Number(gr || 0);
  }

  function normalWorkDueCell(row, vis) {
    if (!vis) return '—';
    const uzs = sumNormalUzs(row);
    return uzs != null ? esc(fmtUz(uzs)) : '—';
  }

  /** Dönem: fazla mesai UZS + FM USD. */
  function overtimeDueCell(row, vis) {
    if (!vis) return '—';
    return row.fm_uzs != null && Number.isFinite(Number(row.fm_uzs)) ? esc(fmtUz(row.fm_uzs)) : '—';
  }

  /** UZS dönem tahakkuku + varsa gayri resmi USD (normal + FM) toplamı. */
  function totalDueCell(row, vis) {
    if (!vis) return '—';
    const uzs = accrualUz(row);
    return uzs != null ? esc(fmtUz(uzs)) : '—';
  }

  function normalUsdEqCell(row, vis, fx) {
    if (!vis) return '—';
    const n = usdByFx(sumNormalUzs(row), fx);
    return n != null ? esc(fmtUsd(n)) : '—';
  }

  function overtimeUsdEqCell(row, vis, fx) {
    if (!vis) return '—';
    const n = usdByFx(row.fm_uzs, fx);
    return n != null ? esc(fmtUsd(n)) : '—';
  }

  /** Dönem tahakkukunun USD karşılığı: (ru+gr+fm) UZS / kur + gayri resmi normal USD + FM USD. Tablo KPI ve detay aynı formülü kullanır. */
  function accrualTotalUsdAgg(row, fx) {
    const agg = createUsdAgg();
    addUzsAsUsd(agg, accrualUz(row), fx);
    addUsd(agg, n0(row.gr_usd_nm) + n0(row.fm_usd));
    return agg;
  }

  function totalUsdEqCell(row, vis, fx) {
    if (!vis) return '—';
    return esc(fmtUsdAgg(accrualTotalUsdAgg(row, fx), true));
  }

  function detailUsdDue(row, fx) {
    const normal = createUsdAgg();
    addUzsAsUsd(normal, sumNormalUzs(row), fx);
    addUsd(normal, n0(row.gr_usd_nm));

    const overtime = createUsdAgg();
    addUzsAsUsd(overtime, n0(row.fm_uzs), fx);
    addUsd(overtime, n0(row.fm_usd));

    const total = accrualTotalUsdAgg(row, fx);

    return { normal, overtime, total };
  }

  function totalAccrualFromPayload(p) {
    if (!p || !p.summary || !p.summary.length) return null;
    const vis = !!(p.salaryVisibility && p.salaryVisibility.group);
    if (!vis) return null;
    let s = 0;
    let any = false;
    p.summary.forEach((row) => {
      const v = accrualUz(row);
      if (v != null) {
        any = true;
        s += v;
      }
    });
    return any ? s : null;
  }

  function syncPeriodChrome() {
    const mk = payMonth && payMonth.value ? payMonth.value : '';
    if (payPeriodDisplay) payPeriodDisplay.value = mk || '';
    if (linkPayMonthly) {
      linkPayMonthly.href = mk ? `/hr-attendance-monthly.html?month=${encodeURIComponent(mk)}` : '/hr-attendance-monthly.html';
    }
    if (linkPayLocks) {
      linkPayLocks.href = '/hr-attendance-locks.html';
    }
    if (payPayDateInfo) payPayDateInfo.value = t('hr.payroll.payDatePlaceholder');
  }

  function setPeriodStateRead(isLocked) {
    if (!payStateRead) return;
    payStateRead.value = isLocked ? t('hr.payroll.stateLocked') : t('hr.payroll.stateReady');
  }

  function updateLockButtons(isLocked) {
    if (btnPayLock) {
      if (canUnlockAttendance && !isLocked) btnPayLock.classList.remove('is-hidden');
      else btnPayLock.classList.add('is-hidden');
    }
    if (btnPayUnlock) {
      if (canUnlockAttendance && isLocked) btnPayUnlock.classList.remove('is-hidden');
      else btnPayUnlock.classList.add('is-hidden');
    }
  }

  function applyPayrollFxFromPayload(p) {
    if (!payUsdUzsRate) return;
    const fx = p && p.payrollUsdUzs;
    const hasFrozen =
      fx &&
      fx.monthStoredRate != null &&
      String(fx.monthStoredRate).trim() !== '' &&
      Number.isFinite(Number(fx.monthStoredRate)) &&
      Number(fx.monthStoredRate) > 0;
    const locked = !!(p && p.isLocked);
    const ro = hasFrozen || locked;
    payUsdUzsRate.readOnly = ro;
    payUsdUzsRate.disabled = ro;
    if (btnPaySaveDefaultFx) btnPaySaveDefaultFx.disabled = ro;
    const eff = fx && fx.effectiveRate != null && Number.isFinite(Number(fx.effectiveRate)) ? Number(fx.effectiveRate) : null;
    payUsdUzsRate.value = eff != null ? String(eff) : '';
    if (payUsdUzsRateHint) {
      payUsdUzsRateHint.textContent = '';
      if (hasFrozen) payUsdUzsRateHint.textContent = t('hr.payroll.payUsdUzsFrozenHint');
      else if (locked) payUsdUzsRateHint.textContent = t('hr.payroll.payUsdUzsLockedHint');
      else payUsdUzsRateHint.textContent = t('hr.payroll.payUsdUzsHint');
    }
  }

  async function saveDefaultPayrollFx() {
    if (!payUsdUzsRate || payUsdUzsRate.disabled) return;
    const raw = String(payUsdUzsRate.value || '')
      .trim()
      .replace(',', '.');
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) {
      showMsg(t('hr.payroll.payUsdUzsLockRequired'), true);
      return;
    }
    const normalized = String(Math.round(n * 1000000) / 1000000);
    showMsg('', false);
    const { ok, data } = await window.hrApi('/api/hr/settings', {
      method: 'PUT',
      body: JSON.stringify({ payroll_usd_uzs_rate: normalized }),
    });
    if (!ok || !data?.ok) {
      showMsg(
        (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.payroll.saveFailed'),
        true
      );
      return;
    }
    showMsg(t('hr.payroll.defaultFxSaved'), false);
    await loadSnapshot({ silent: true });
  }

  async function loadMePerms() {
    canEditDispute = false;
    canUnlockAttendance = false;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const u = data && data.user;
      if (!u) return;
      if (u.isSuperAdmin === true) {
        canEditDispute = true;
        canUnlockAttendance = true;
        return;
      }
      const list = Array.isArray(u.permissions) ? u.permissions : [];
      canEditDispute = list.includes('hr.payroll.edit');
      canUnlockAttendance = list.includes('hr.attendance.unlock');
    } catch {
      canEditDispute = false;
      canUnlockAttendance = false;
    }
  }

  async function loadDepartments() {
    if (!payDep) return;
    const { ok, data } = await window.hrApi('/api/hr/departments');
    if (!ok || !data?.ok) return;
    const deps = data.data?.departments || data.departments || [];
    const cur = payDep.value;
    payDep.innerHTML = `<option value="">${t('hr.emp.filterDept')}</option>`;
    deps.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name;
      payDep.appendChild(o);
    });
    if (cur && [...payDep.options].some((o) => o.value === cur)) payDep.value = cur;
  }

  async function loadEmployeesForModal() {
    if (!payDispEmp) return;
    const { ok, data } = await window.hrApi('/api/hr/employees?status=active');
    if (!ok || !data?.ok) return;
    const list = data.employees || data.data?.employees || [];
    const cur = payDispEmp.value;
    payDispEmp.innerHTML = `<option value="">${t('hr.payroll.pickEmployee')}</option>`;
    list.forEach((e) => {
      const o = document.createElement('option');
      o.value = e.id;
      const lab = e.employee_display || `${e.employee_no || ''} ${e.first_name || ''}`.trim();
      o.textContent = lab || String(e.id);
      payDispEmp.appendChild(o);
    });
    if (cur && [...payDispEmp.options].some((o) => o.value === cur)) payDispEmp.value = cur;
  }

  function summaryItem(label, valueHtml) {
    return `<div class="sd-item">${esc(label)}<strong>${valueHtml}</strong></div>`;
  }

  function workStatusLabel(code) {
    const c = String(code || '').trim();
    const k = `hr.att.status.${c}`;
    const x = t(k);
    return x !== k ? x : c || '—';
  }

  function renderTable(p) {
    if (!payBody) return;
    const summary = (p && p.summary) || [];
    const vis = !!(p && p.salaryVisibility && p.salaryVisibility.group);
    const fx = fxFromPayload(p);
    payBody.innerHTML = summary.length
      ? summary
          .map((row) => {
            const eid = Number(row.employee_id);
            const name = esc(row.employee_name || row.full_name || '—');
            const dep = esc(row.department_name || '—');
            const wd = esc(String(row.worked_days != null ? row.worked_days : '—'));
            const nh = esc(fmtHours(row.total_normal_hours != null ? row.total_normal_hours : row.total_hours));
            const oh = esc(fmtHours(row.total_overtime_hours != null ? row.total_overtime_hours : row.overtime_hours));
            const normalDue = normalWorkDueCell(row, vis);
            const otDue = overtimeDueCell(row, vis);
            const totalDue = totalDueCell(row, vis);
            const normalUsdEq = normalUsdEqCell(row, vis, fx);
            const otUsdEq = overtimeUsdEqCell(row, vis, fx);
            const totalUsdEq = totalUsdEqCell(row, vis, fx);
            const od = Number(row.payroll_open_disputes || 0);
            const dispCell =
              od > 0
                ? `<span class="payroll-disp-badge is-open">${esc(String(od))}</span>`
                : `<span class="payroll-disp-badge is-no">0</span>`;
            const detailBtn = `<button type="button" class="payroll-live-detail-btn payroll-open-days" data-eid="${esc(String(eid))}" data-ename="${name}">${esc(t('hr.payroll.btnDetail'))}</button>`;
            return `<tr>
              <td>${name}</td>
              <td>${dep}</td>
              <td class="payroll-num">${wd}</td>
              <td class="payroll-num">${nh}</td>
              <td class="payroll-num">${oh}</td>
              <td class="payroll-num payroll-due-stack">${normalDue}</td>
              <td class="payroll-num payroll-due-stack">${otDue}</td>
              <td class="payroll-num payroll-due-stack">${totalDue}</td>
              <td class="payroll-num payroll-due-stack">${normalUsdEq}</td>
              <td class="payroll-num payroll-due-stack">${otUsdEq}</td>
              <td class="payroll-num payroll-due-stack">${totalUsdEq}</td>
              <td>${dispCell}</td>
              <td>${detailBtn}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="13">${esc(t('hr.payroll.emptyLines'))}</td></tr>`;

    payBody.querySelectorAll('.payroll-open-days').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-eid'));
        const ename = btn.getAttribute('data-ename') || '';
        openDayModal(id, ename);
      });
    });
  }

  function openDayModal(employeeId, displayName) {
    if (!payDayModal || !payDayBody) return;
    const vis = !!(lastPayload && lastPayload.salaryVisibility && lastPayload.salaryVisibility.group);
    const summaryList = (lastPayload && lastPayload.summary) || [];
    const srow = summaryList.find((s) => Number(s.employee_id) === employeeId) || null;
    const rows = ((lastPayload && lastPayload.rows) || []).filter((r) => Number(r.employee_id) === employeeId);
    const fx = fxFromPayload(lastPayload);
    rows.sort((a, b) => String(a.work_date || '').localeCompare(String(b.work_date || '')));
    if (payDayModalEmp) payDayModalEmp.textContent = displayName ? `${t('hr.payroll.dayModalEmp')}: ${displayName}` : '';

    const payDaySummary = document.getElementById('payDaySummary');
    const payDaySummaryNote = document.getElementById('payDaySummaryNote');
    let nh = 0;
    let oh = 0;
    if (srow) {
      nh = Number(srow.total_normal_hours != null ? srow.total_normal_hours : srow.total_hours) || 0;
      oh = Number(srow.total_overtime_hours != null ? srow.total_overtime_hours : srow.overtime_hours) || 0;
    } else {
      rows.forEach((r) => {
        nh += Number(r.total_hours) || 0;
        oh += Number(r.overtime_hours) || 0;
      });
    }
    if (payDaySummaryNote) {
      if (!vis) {
        payDaySummaryNote.classList.remove('is-hidden');
        if (window.i18n && window.i18n.apply) window.i18n.apply(payDaySummaryNote);
      } else {
        payDaySummaryNote.classList.add('is-hidden');
      }
    }
    if (payDaySummary) {
      if (!vis) {
        payDaySummary.innerHTML = [
          summaryItem(t('hr.payroll.daySumNormalH'), esc(fmtHours(nh))),
          summaryItem(t('hr.payroll.daySumOtH'), esc(fmtHours(oh))),
        ].join('');
      } else if (srow) {
        const acc = accrualUz(srow);
        const nhr = srow.total_normal_hours != null ? srow.total_normal_hours : srow.total_hours;
        const ohr = srow.total_overtime_hours != null ? srow.total_overtime_hours : srow.overtime_hours;
        const usdDue = detailUsdDue(srow, fx);
        payDaySummary.innerHTML = [
          summaryItem(t('hr.payroll.daySumNormalH'), esc(fmtHours(nhr))),
          summaryItem(t('hr.payroll.daySumOtH'), esc(fmtHours(ohr))),
          summaryItem(t('hr.payroll.daySumOfficialUz'), esc(srow.ru_uzs_nm != null ? fmtUz(srow.ru_uzs_nm) : '—')),
          summaryItem(t('hr.payroll.daySumUnofNormalUz'), esc(srow.gr_uzs_nm != null ? fmtUz(srow.gr_uzs_nm) : '—')),
          summaryItem(t('hr.payroll.daySumFmUz'), esc(srow.fm_uzs != null ? fmtUz(srow.fm_uzs) : '—')),
          summaryItem(t('hr.payroll.daySumGrUsd'), esc(srow.gr_usd_nm != null ? fmtUsd(srow.gr_usd_nm) : '—')),
          summaryItem(t('hr.payroll.daySumFmUsd'), esc(srow.fm_usd != null ? fmtUsd(srow.fm_usd) : '—')),
          summaryItem(t('hr.payroll.daySumBase'), esc(fmtBase(srow))),
          summaryItem(t('hr.payroll.daySumTotalUz'), esc(acc != null ? fmtUz(acc) : '—')),
          summaryItem(t('hr.payroll.daySumNormalUsdDue'), esc(fmtUsdAgg(usdDue.normal, true))),
          summaryItem(t('hr.payroll.daySumOtUsdDue'), esc(fmtUsdAgg(usdDue.overtime, true))),
          summaryItem(t('hr.payroll.daySumTotalUsdDue'), esc(fmtUsdAgg(usdDue.total, true))),
        ].join('');
      } else {
        payDaySummary.innerHTML = [
          summaryItem(t('hr.payroll.daySumNormalH'), esc(fmtHours(nh))),
          summaryItem(t('hr.payroll.daySumOtH'), esc(fmtHours(oh))),
          summaryItem(t('hr.payroll.daySumTotalUz'), '—'),
        ].join('');
      }
    }

    payDayBody.innerHTML = rows.length
      ? rows
          .map((r) => {
            const d = String(r.work_date || '').slice(0, 10);
            const cin = r.check_in_time != null ? String(r.check_in_time).slice(0, 8) : '—';
            const cout = r.check_out_time != null ? String(r.check_out_time).slice(0, 8) : '—';
            return `<tr>
              <td>${esc(d)}</td>
              <td>${esc(cin)}</td>
              <td>${esc(cout)}</td>
              <td class="payroll-num">${esc(fmtHours(r.total_hours))}</td>
              <td class="payroll-num">${esc(fmtHours(r.overtime_hours))}</td>
              <td>${esc(workStatusLabel(r.work_status))}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="6">${esc(t('hr.payroll.dayEmpty'))}</td></tr>`;
    payDayModal.classList.add('attm-modal-open');
  }

  function closeDayModal() {
    if (payDayModal) payDayModal.classList.remove('attm-modal-open');
  }

  function disputeTypeLabel(code) {
    const c = String(code || '').toLowerCase();
    if (c === 'overtime') return t('hr.payroll.typeOvertime');
    if (c === 'workday') return t('hr.payroll.typeWorkday');
    if (c === 'deduction') return t('hr.payroll.typeDeduction');
    return t('hr.payroll.typeOther');
  }

  function disputeStatusLabel(st) {
    const s = String(st || '').toLowerCase();
    if (s === 'open') return t('hr.payroll.statusOpen');
    if (s === 'approved') return t('hr.payroll.statusApproved');
    if (s === 'rejected') return t('hr.payroll.statusRejected');
    if (s === 'resolved') return t('hr.payroll.statusResolved');
    return esc(st || '—');
  }

  function renderDisputes(p) {
    if (!payDispBody) return;
    const rows = (p && p.payroll_disputes) || [];
    if (!rows.length) {
      payDispBody.innerHTML = `<tr><td colspan="7">${esc(t('hr.payroll.disputesEmpty'))}</td></tr>`;
      return;
    }
    payDispBody.innerHTML = rows
      .map((d) => {
        const no = esc(d.request_no || String(d.id || ''));
        const emp = esc(d.employee_display || d.employee_name || '—');
        const day = d.dispute_date ? esc(String(d.dispute_date).slice(0, 10)) : '—';
        const typ = esc(disputeTypeLabel(d.request_type));
        const desc = esc(String(d.description || '').slice(0, 220));
        const st = String(d.status || '').toLowerCase();
        let badgeClass = 'is-done';
        if (st === 'open') badgeClass = 'is-open';
        else if (st === 'rejected') badgeClass = 'is-rejected';
        const badge = `<span class="payroll-disp-badge ${badgeClass}">${esc(disputeStatusLabel(st))}</span>`;
        let actions = '—';
        if (canEditDispute && st === 'open') {
          actions = `<span class="payroll-actions-gap">
            <button type="button" class="version-btn app-button app-button-primary payroll-set-status" data-id="${esc(String(d.id))}" data-status="approved">${esc(t('hr.payroll.btnApprove'))}</button>
            <button type="button" class="version-btn app-button app-button-secondary payroll-set-status" data-id="${esc(String(d.id))}" data-status="rejected">${esc(t('hr.payroll.btnReject'))}</button>
            <button type="button" class="version-btn app-button app-button-secondary payroll-set-status" data-id="${esc(String(d.id))}" data-status="resolved">${esc(t('hr.payroll.btnResolve'))}</button>
          </span>`;
        }
        return `<tr>
          <td>${no}</td>
          <td>${emp}</td>
          <td>${day}</td>
          <td>${typ}</td>
          <td>${desc}</td>
          <td>${badge}</td>
          <td>${actions}</td>
        </tr>`;
      })
      .join('');

    payDispBody.querySelectorAll('.payroll-set-status').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const status = btn.getAttribute('data-status');
        if (!id || !status) return;
        showMsg('', false);
        const { ok, data } = await window.hrApi(`/api/hr/payroll/disputes/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        if (!ok || !data?.ok) {
          showMsg(
            (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.payroll.saveFailed'),
            true
          );
          return;
        }
        showMsg(t('hr.payroll.disputeUpdated'), false);
        await loadSnapshot();
      });
    });
  }

  function renderKpi(p) {
    const summary = (p && p.summary) || [];
    const totals = (p && p.summaryTotals) || {};
    const vis = !!(p && p.salaryVisibility && p.salaryVisibility.group);
    const dash = '—';
    const fx = fxFromPayload(p);
    const activeRoster = p && p.active_roster;
    if (payKpiHead) {
      payKpiHead.textContent =
        activeRoster && activeRoster.headcount != null ? String(activeRoster.headcount) : String(summary.length);
    }
    if (payKpiNormH) payKpiNormH.textContent = fmtHours(totals.total_normal_hours);
    if (payKpiOtH) payKpiOtH.textContent = fmtHours(totals.total_overtime_hours);
    const acc = totalAccrualFromPayload(p);
    if (payKpiAcc) payKpiAcc.textContent = vis && acc != null ? fmtUz(acc) : dash;
    if (payKpiOfficialUz) {
      const v = totals.total_ru_uzs_nm;
      payKpiOfficialUz.textContent = vis && v != null && Number.isFinite(Number(v)) ? fmtUz(v) : dash;
    }
    if (payKpiGrUz) {
      const v = totals.total_gr_uzs_nm;
      payKpiGrUz.textContent = vis && v != null && Number.isFinite(Number(v)) ? fmtUz(v) : dash;
    }
    if (payKpiFmUz) {
      const v = totals.total_fm_uzs_nm;
      payKpiFmUz.textContent = vis && v != null && Number.isFinite(Number(v)) ? fmtUz(v) : dash;
    }
    const officialUsdAgg = createUsdAgg();
    const unofficialUsdAgg = createUsdAgg();
    const overtimeUsdAgg = createUsdAgg();
    const totalAccrualUsdAgg = createUsdAgg();

    summary.forEach((row) => {
      addUzsAsUsd(officialUsdAgg, n0(row.ru_uzs_nm), fx);

      addUzsAsUsd(unofficialUsdAgg, n0(row.gr_uzs_nm), fx);
      addUsd(unofficialUsdAgg, n0(row.gr_usd_nm));

      addUzsAsUsd(overtimeUsdAgg, n0(row.fm_uzs), fx);
      addUsd(overtimeUsdAgg, n0(row.fm_usd));

      const rowAccUsd = accrualTotalUsdAgg(row, fx);
      totalAccrualUsdAgg.value += rowAccUsd.value;
      totalAccrualUsdAgg.hasValue = totalAccrualUsdAgg.hasValue || rowAccUsd.hasValue;
      totalAccrualUsdAgg.missingFx = totalAccrualUsdAgg.missingFx || rowAccUsd.missingFx;
    });

    if (payKpiActiveSalaryUsd) {
      if (!vis || !activeRoster || activeRoster.missing_fx) payKpiActiveSalaryUsd.textContent = dash;
      else if (activeRoster.total_salary_usd == null || !Number.isFinite(Number(activeRoster.total_salary_usd))) {
        payKpiActiveSalaryUsd.textContent = dash;
      } else {
        payKpiActiveSalaryUsd.textContent = fmtUsd(activeRoster.total_salary_usd);
      }
    }
    if (payKpiOfficialUsd) payKpiOfficialUsd.textContent = fmtUsdAgg(officialUsdAgg, vis, dash);
    if (payKpiUnofficialUsd) payKpiUnofficialUsd.textContent = fmtUsdAgg(unofficialUsdAgg, vis, dash);
    if (payKpiTotalOvertimeUsd) payKpiTotalOvertimeUsd.textContent = fmtUsdAgg(overtimeUsdAgg, vis, dash);
    if (payKpiAccTotalUsd) payKpiAccTotalUsd.textContent = fmtUsdAgg(totalAccrualUsdAgg, vis, dash);

    const nd = p && p.payroll_open_dispute_count != null ? p.payroll_open_dispute_count : 0;
    if (payKpiDisp) payKpiDisp.textContent = String(nd);
  }

  async function loadSnapshot(opts) {
    const silent = opts && opts.silent;
    const mk = payMonth && payMonth.value ? payMonth.value : '';
    if (!mk) {
      showMsg(t('hr.payroll.pickMonth'), true);
      return;
    }
    const qs = new URLSearchParams({ month: mk });
    if (paySearch && String(paySearch.value).trim()) qs.set('search', String(paySearch.value).trim());
    if (payDep && payDep.value) qs.set('departmentId', payDep.value);
    if (!silent) showMsg('', false);
    const { ok, data } = await window.hrApi(`/api/hr/payroll/snapshot?${qs.toString()}`);
    if (!ok || !data?.ok) {
      showMsg(
        (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.payroll.loadFailed'),
        true
      );
      return;
    }
    lastPayload = data;
    const locked = !!(lastPayload && lastPayload.isLocked);
    setPeriodStateRead(locked);
    updateLockButtons(locked);
    applyPayrollFxFromPayload(lastPayload);
    renderKpi(lastPayload);
    renderTable(lastPayload);
    renderDisputes(lastPayload);
    if (btnPayNewDispute) {
      if (canEditDispute) btnPayNewDispute.classList.remove('is-hidden');
      else btnPayNewDispute.classList.add('is-hidden');
    }
    if (!silent) showMsg(t('hr.payroll.loadDone'), false);
  }

  async function postLock(isLock) {
    const mk = payMonth && payMonth.value ? payMonth.value : '';
    if (!mk) return showMsg(t('hr.payroll.pickMonth'), true);
    const msgKey = isLock ? 'hr.payroll.confirmLock' : 'hr.payroll.confirmUnlock';
    // eslint-disable-next-line no-alert
    if (typeof window.confirm === 'function' && !window.confirm(t(msgKey))) return;
    const url = isLock ? '/api/hr/attendance-locks/lock' : '/api/hr/attendance-locks/unlock';
    showMsg('', false);
    const body = { month: mk, note: null };
    if (isLock) {
      const raw = payUsdUzsRate && String(payUsdUzsRate.value).trim().replace(',', '.');
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
        (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.payroll.saveFailed'),
        true
      );
      return;
    }
    showMsg(isLock ? t('hr.payroll.lockDone') : t('hr.payroll.unlockDone'), false);
    await loadSnapshot({ silent: true });
  }

  function openDisputeModal() {
    if (!payDispModal) return;
    if (payMonth && payMonth.value) {
      const first = `${payMonth.value}-01`;
      if (payDispDay) {
        payDispDay.min = first;
        const [y, m] = payMonth.value.split('-').map((x) => parseInt(x, 10));
        const last = new Date(y, m, 0).getDate();
        payDispDay.max = `${payMonth.value}-${String(last).padStart(2, '0')}`;
      }
    }
    if (payDispDesc) payDispDesc.value = '';
    if (payDispType) payDispType.value = 'other';
    payDispModal.classList.add('is-open');
  }

  function closeDisputeModal() {
    if (payDispModal) payDispModal.classList.remove('is-open');
  }

  async function saveDispute() {
    const mk = payMonth && payMonth.value ? payMonth.value : '';
    if (!mk) {
      showMsg(t('hr.payroll.pickMonth'), true);
      return;
    }
    const empId = payDispEmp && payDispEmp.value ? payDispEmp.value : '';
    if (!empId) {
      showMsg(t('hr.payroll.needEmployee'), true);
      return;
    }
    const body = {
      period_month: mk,
      employee_id: Number(empId),
      request_type: payDispType ? payDispType.value : 'other',
      description: payDispDesc ? String(payDispDesc.value).trim() : '',
    };
    if (payDispDay && payDispDay.value) body.dispute_date = payDispDay.value;
    showMsg('', false);
    const { ok, data } = await window.hrApi('/api/hr/payroll/disputes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!ok || !data?.ok) {
      showMsg(
        (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.payroll.saveFailed'),
        true
      );
      return;
    }
    closeDisputeModal();
    showMsg(t('hr.payroll.disputeCreated'), false);
    await loadSnapshot({ silent: true });
  }

  async function initHrPayrollPage() {
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
    await loadMePerms();
    if (payMonth) payMonth.value = monthNowStr();
    syncPeriodChrome();
    await loadDepartments();
    await loadEmployeesForModal();
    payMonth?.addEventListener('change', () => {
      syncPeriodChrome();
    });
    btnPayLoad?.addEventListener('click', () => loadSnapshot());
    btnPayRecalc?.addEventListener('click', async () => {
      await loadSnapshot({ silent: true });
      showMsg(t('hr.payroll.recalcDone'), false);
    });
    btnPayLock?.addEventListener('click', () => postLock(true));
    btnPayUnlock?.addEventListener('click', () => postLock(false));
    btnPaySaveDefaultFx?.addEventListener('click', () => saveDefaultPayrollFx());
    btnPayNewDispute?.addEventListener('click', () => openDisputeModal());
    payDispCancel?.addEventListener('click', closeDisputeModal);
    payDispSave?.addEventListener('click', () => saveDispute());
    payDispModal?.addEventListener('click', (e) => {
      if (e.target === payDispModal) closeDisputeModal();
    });
    payDayModalClose?.addEventListener('click', closeDayModal);
    payDayModal?.addEventListener('click', (e) => {
      if (e.target === payDayModal) closeDayModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (payDispModal && payDispModal.classList.contains('is-open')) closeDisputeModal();
        if (payDayModal && payDayModal.classList.contains('attm-modal-open')) closeDayModal();
      }
    });
    await loadSnapshot({ silent: true });
  }

  window.initHrPayrollPage = initHrPayrollPage;
})();
