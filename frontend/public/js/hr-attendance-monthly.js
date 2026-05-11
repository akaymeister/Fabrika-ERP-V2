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
  const btnImportMonthlyExcel = document.getElementById('btnImportMonthlyExcel');
  const btnDownloadMonthlyExcelFormat = document.getElementById('btnDownloadMonthlyExcelFormat');
  const monthlyExcelFile = document.getElementById('monthlyExcelFile');
  const attmEditModal = document.getElementById('attmEditModal');
  const attmEditReasonInput = document.getElementById('attmEditReasonInput');
  const attmEditReasonErr = document.getElementById('attmEditReasonErr');
  const attmEditCancel = document.getElementById('attmEditCancel');
  const attmEditGo = document.getElementById('attmEditGo');
  const attmImportModal = document.getElementById('attmImportModal');
  const attmImportTargetMonth = document.getElementById('attmImportTargetMonth');
  const attmImportSummary = document.getElementById('attmImportSummary');
  const attmImportBody = document.getElementById('attmImportBody');
  const attmImportErr = document.getElementById('attmImportErr');
  const attmImportCancel = document.getElementById('attmImportCancel');
  const attmImportSave = document.getElementById('attmImportSave');
  const attmImportEmployeeOptions = document.getElementById('attmImportEmployeeOptions');
  const attmImportProjectOptions = document.getElementById('attmImportProjectOptions');

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
  let importDraftRows = [];
  const liveCards = document.getElementById('liveCards');
  const kpiTotalNormal = document.getElementById('kpiTotalNormal');
  const kpiTotalOvertime = document.getElementById('kpiTotalOvertime');
  const kpiNormalUsd = document.getElementById('kpiNormalUsd');
  const kpiFmUsd = document.getElementById('kpiFmUsd');
  const kpiOfficialUzs = document.getElementById('kpiOfficialUzs');
  const kpiNonOfficialUzs = document.getElementById('kpiNonOfficialUzs');
  const kpiUnofficialUsd = document.getElementById('kpiUnofficialUsd');

  // Personel arama combobox elementleri
  const mNameCmb = document.getElementById('mNameCmb');
  const mNameCmbPanel = document.getElementById('mNameCmbPanel');
  const mNameCmbList = document.getElementById('mNameCmbList');
  const mNameCmbEmpty = document.getElementById('mNameCmbEmpty');
  const mNameCmbClear = document.getElementById('mNameCmbClear');
  let employeesAll = [];
  let employeesLoaded = false;
  let _empCmbRepositionFn = null;

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

  function parseTimeHHmm(v) {
    if (v instanceof Date && Number.isFinite(v.getTime())) {
      const hh = String(v.getHours()).padStart(2, '0');
      const mm = String(v.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const fullMinutes = Math.round(((v % 1 + 1) % 1) * 24 * 60);
      const hh = String(Math.floor(fullMinutes / 60) % 24).padStart(2, '0');
      const mm = String(fullMinutes % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    const s = String(v == null ? '' : v).trim();
    if (!s) return null;
    let m = s.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)(?::([0-5]\d))?$/);
    if (!m) m = s.match(/^([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)(?:\s*[APMapm]{2})?$/);
    if (!m) return null;
    return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
  }

  function parseNum(v) {
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function parseDateYmd(v) {
    if (v instanceof Date && Number.isFinite(v.getTime())) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, '0');
      const d = String(v.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof v === 'number' && Number.isFinite(v) && window.XLSX?.SSF?.parse_date_code) {
      const p = window.XLSX.SSF.parse_date_code(v);
      if (p && Number.isFinite(p.y) && Number.isFinite(p.m) && Number.isFinite(p.d)) {
        const y = String(p.y).padStart(4, '0');
        const m = String(p.m).padStart(2, '0');
        const d = String(p.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    const s = String(v == null ? '' : v).trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    m = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{4})[./-](\d{2})[./-](\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const parsed = new Date(s);
    if (Number.isFinite(parsed.getTime())) {
      const y = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
    return null;
  }

  function normalizeHeader(k) {
    return String(k || '')
      .replace(/\uFEFF/g, '')
      .trim()
      .toLowerCase()
      .replace(/[ç]/g, 'c')
      .replace(/[ğ]/g, 'g')
      .replace(/[ı]/g, 'i')
      .replace(/[ö]/g, 'o')
      .replace(/[ş]/g, 's')
      .replace(/[ü]/g, 'u')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
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
    closeEmpCmbPanel();
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

  // -------- Personel adı searchable combobox --------
  async function loadEmployeesForCombo() {
    if (employeesLoaded) return;
    try {
      const { ok, data } = await window.hrApi('/api/hr/employees');
      if (!ok || !data?.ok) return;
      const list = data.data?.employees || data.employees || [];
      employeesAll = list
        .map((e) => {
          const fullName = displayNameOnly(
            e.display_name || e.full_name || e.name || `${e.first_name || ''} ${e.last_name || ''}`
          );
          const depObj = departments.find((d) => String(d.id) === String(e.department_id || ''));
          const posObj = positions.find((p) => String(p.id) === String(e.position_id || ''));
          return {
            id: e.id,
            employeeNo: String(e.employee_no || '').trim(),
            name: fullName,
            department_id: e.department_id || '',
            position_id: e.position_id || '',
            departmentName: depObj?.name || e.department_name || '',
            positionName: posObj?.name || e.position_name || '',
          };
        })
        .filter((e) => e.name);
      employeesLoaded = true;
    } catch (_) {
      /* sessizce yut */
    }
  }

  function pickCell(row, keys) {
    for (const key of keys) {
      const hit = row[key];
      if (hit != null && String(hit).trim() !== '') return hit;
    }
    return '';
  }

  const IMPORT_KEYS = {
    date: ['date', 'tarih', 'calisma_tarihi', 'work_date', 'gun', 'gun_tarihi'],
    employeeId: ['employee_id', 'personel_id', 'calisan_id'],
    employeeNo: ['employee_no', 'personel_no', 'sicil_no', 'sicil', 'emp_no'],
    employeeName: ['employee_name', 'personel', 'ad_soyad', 'isim', 'calisan', 'calisan_adi'],
    checkIn: ['check_in', 'check_in_time', 'giris', 'giris_saati', 'in', 'giris_saati'],
    checkOut: ['check_out', 'check_out_time', 'cikis', 'cikis_saati', 'out', 'cikis_saati'],
    workStatus: ['work_status', 'durum', 'status'],
    workType: ['work_type', 'is_tipi', 'type'],
    overtime: ['overtime_hours', 'fm', 'mesai', 'fazla_mesai'],
    projectId: ['project_id', 'proje_id'],
    projectCode: ['project_code', 'proje_kodu', 'project', 'proje'],
    note: ['note', 'not', 'aciklama'],
  };

  function mapImportRow(rawRow) {
    const row = {};
    Object.keys(rawRow || {}).forEach((k) => {
      row[normalizeHeader(k)] = rawRow[k];
    });
    const date = parseDateYmd(pickCell(row, IMPORT_KEYS.date));
    const employeeId = parseNum(pickCell(row, IMPORT_KEYS.employeeId));
    const employeeNo = String(pickCell(row, IMPORT_KEYS.employeeNo) || '')
      .trim()
      .toUpperCase();
    const employeeName = String(pickCell(row, IMPORT_KEYS.employeeName) || '').trim();
    const checkIn = parseTimeHHmm(pickCell(row, IMPORT_KEYS.checkIn));
    const checkOut = parseTimeHHmm(pickCell(row, IMPORT_KEYS.checkOut));
    const workStatus = String(pickCell(row, IMPORT_KEYS.workStatus) || 'worked').trim().toLowerCase();
    const workType = String(pickCell(row, IMPORT_KEYS.workType) || 'normal').trim().toLowerCase();
    const overtimeHoursRaw = parseNum(pickCell(row, IMPORT_KEYS.overtime));
    const projectIdRaw = parseNum(pickCell(row, IMPORT_KEYS.projectId));
    const projectCode = String(pickCell(row, IMPORT_KEYS.projectCode) || '').trim().toUpperCase();
    const note = String(pickCell(row, IMPORT_KEYS.note) || '').trim();
    return {
      date,
      employeeId: Number.isFinite(employeeId) && employeeId > 0 ? Math.trunc(employeeId) : null,
      employeeNo,
      employeeName,
      checkIn,
      checkOut,
      workStatus,
      workType,
      overtimeHours: Number.isFinite(overtimeHoursRaw) && overtimeHoursRaw >= 0 ? overtimeHoursRaw : 0,
      projectIdRaw: Number.isFinite(projectIdRaw) && projectIdRaw > 0 ? Math.trunc(projectIdRaw) : null,
      projectCode,
      note: note || null,
    };
  }

  function resolveEmployeeIdForImport(item, byId, byNo, byName) {
    if (item.employeeId && byId.has(item.employeeId)) return item.employeeId;
    if (item.employeeNo && byNo.has(item.employeeNo)) return byNo.get(item.employeeNo);
    if (item.employeeName) {
      const k = item.employeeName.toLowerCase();
      if (byName.has(k)) return byName.get(k);
    }
    return null;
  }

  async function importMonthlyFromExcel(file) {
    if (!file) return;
    if (isLocked) return showMsg(t('hr.att.monthly.lockedHint'), true);
    if (!canEditAttendance) return showMsg(t('api.permission.denied'), true);
    if (!(window.XLSX && window.XLSX.read)) {
      showMsg(t('hr.att.monthly.importLibMissing'), true);
      return;
    }
    const mk = monthKeyEl && monthKeyEl.value ? monthKeyEl.value : '';
    if (!mk) return showMsg(t('hr.att.monthly.pickMonth'), true);
    showMsg(t('hr.att.monthly.importReading'), false);
    await loadEmployeesForCombo();
    const byId = new Map();
    const byNo = new Map();
    const byName = new Map();
    employeesAll.forEach((e) => {
      byId.set(Number(e.id), Number(e.id));
      if (e.employeeNo) byNo.set(String(e.employeeNo).toUpperCase(), Number(e.id));
      if (e.name) byName.set(String(e.name).toLowerCase(), Number(e.id));
    });
    const projectByCode = new Map(projects.map((p) => [String(p.project_code || '').trim().toUpperCase(), Number(p.id)]));
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames && wb.SheetNames[0];
    if (!firstSheet) return showMsg(t('hr.att.monthly.importEmpty'), true);
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], {
      defval: '',
      raw: false,
      cellDates: true,
      dateNF: 'yyyy-mm-dd',
    });
    if (!rows.length) return showMsg(t('hr.att.monthly.importEmpty'), true);

    const grouped = new Map();
    let skipped = 0;
    for (const r of rows) {
      const item = mapImportRow(r);
      if (!item.date) {
        skipped += 1;
        continue;
      }
      if (!item.date.startsWith(`${mk}-`)) {
        skipped += 1;
        continue;
      }
      const employeeId = resolveEmployeeIdForImport(item, byId, byNo, byName);
      if (!employeeId) {
        skipped += 1;
        continue;
      }
      const projectId = item.projectIdRaw || (item.projectCode && projectByCode.get(item.projectCode)) || null;
      const entry = {
        employee_id: employeeId,
        project_id: projectId,
        work_status: item.workStatus || 'worked',
        work_type: item.workType || 'normal',
        check_in_time: item.checkIn || null,
        check_out_time: item.checkOut || null,
        overtime_hours: item.overtimeHours || 0,
        note: item.note,
      };
      if (!grouped.has(item.date)) grouped.set(item.date, []);
      grouped.get(item.date).push(entry);
    }
    if (!grouped.size) return showMsg(t('hr.att.monthly.importNoValidRows'), true);

    let savedDates = 0;
    let savedRows = 0;
    for (const [workDate, entries] of grouped.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const { ok, data } = await window.hrApi('/api/hr/attendance/daily-bulk', {
        method: 'PUT',
        body: JSON.stringify({ workDate, entries }),
      });
      if (!ok || !data?.ok) {
        showMsg(
          `${t('hr.att.monthly.importFailedAtDate')} ${workDate} - ${
            (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.att.loadFailed')
          }`,
          true
        );
        return;
      }
      savedDates += 1;
      savedRows += entries.length;
    }
    showMsg(`${t('hr.att.monthly.importDone')} ${savedRows} / ${savedDates}. ${t('hr.att.monthly.importSkipped')} ${skipped}.`, false);
    await loadMonthly();
  }

  function downloadMonthlyExcelTemplate() {
    if (!(window.XLSX && window.XLSX.utils && window.XLSX.writeFile)) {
      showMsg(t('hr.att.monthly.importLibMissing'), true);
      return;
    }
    const templateRows = [
      {
        tarih: '2026-05-11',
        employee_no: 'PRS-001',
        giris: '08:00',
        cikis: '18:00',
        work_status: 'worked',
        work_type: 'normal',
        overtime_hours: 0,
        project_code: '',
        note: '',
      },
      {
        tarih: '2026-05-11',
        employee_no: 'PRS-002',
        giris: '08:00',
        cikis: '04:00',
        work_status: 'worked',
        work_type: 'normal',
        overtime_hours: 2,
        project_code: '',
        note: 'GECE TASAN CALISMA',
      },
    ];
    const ws = window.XLSX.utils.json_to_sheet(templateRows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'attendance_import');
    window.XLSX.writeFile(wb, 'aylik-puantaj-import-sablonu.xlsx');
  }

  function employeeOptionText(e) {
    const no = String(e.employeeNo || '').trim();
    const nm = String(e.name || '').trim();
    return no ? `${no} - ${nm}` : nm;
  }

  function projectOptionText(p) {
    const code = String(p.project_code || '').trim();
    const nm = String(p.name || '').trim();
    return code ? `${code} - ${nm}` : nm || String(p.id || '');
  }

  function normalizeProjectInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const low = s.toLowerCase();
    if (['-', '--', '---', 'yok', 'none', 'null', 'n/a', 'na', 'bos', 'boş', '(bos)', '(boş)'].includes(low)) return '';
    return s;
  }

  function resolveEmployeeFromInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const onlyNum = Number(s);
    if (Number.isFinite(onlyNum) && employeesAll.some((e) => Number(e.id) === Number(onlyNum))) return Math.trunc(onlyNum);
    const up = s.toUpperCase();
    const byNo = employeesAll.find((e) => String(e.employeeNo || '').toUpperCase() === up);
    if (byNo) return Number(byNo.id);
    const low = s.toLowerCase();
    const byName = employeesAll.find((e) => String(e.name || '').toLowerCase() === low);
    if (byName) return Number(byName.id);
    const byLabel = employeesAll.find((e) => employeeOptionText(e).toLowerCase() === low);
    if (byLabel) return Number(byLabel.id);
    const parts = s.split('-').map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const byNoFromLabel = employeesAll.find((e) => String(e.employeeNo || '').toUpperCase() === String(parts[0]).toUpperCase());
      if (byNoFromLabel) return Number(byNoFromLabel.id);
      const byNameFromLabel = employeesAll.find((e) => String(e.name || '').toLowerCase() === parts.slice(1).join('-').toLowerCase());
      if (byNameFromLabel) return Number(byNameFromLabel.id);
    }
    const byNameContains = employeesAll.find((e) => String(e.name || '').toLowerCase().includes(low));
    if (byNameContains) return Number(byNameContains.id);
    return null;
  }

  function resolveProjectFromInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const onlyNum = Number(s);
    if (Number.isFinite(onlyNum) && projects.some((p) => Number(p.id) === Number(onlyNum))) return Math.trunc(onlyNum);
    const up = s.toUpperCase();
    const byCode = projects.find((p) => String(p.project_code || '').toUpperCase() === up);
    if (byCode) return Number(byCode.id);
    const low = s.toLowerCase();
    const byName = projects.find((p) => String(p.name || '').toLowerCase() === low);
    if (byName) return Number(byName.id);
    const byLabel = projects.find((p) => projectOptionText(p).toLowerCase() === low);
    if (byLabel) return Number(byLabel.id);
    const parts = s.split('-').map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const byCodeFromLabel = projects.find((p) => String(p.project_code || '').toUpperCase() === String(parts[0]).toUpperCase());
      if (byCodeFromLabel) return Number(byCodeFromLabel.id);
      const byNameFromLabel = projects.find((p) => String(p.name || '').toLowerCase() === parts.slice(1).join('-').toLowerCase());
      if (byNameFromLabel) return Number(byNameFromLabel.id);
    }
    const byNameContains = projects.find((p) => String(p.name || '').toLowerCase().includes(low));
    if (byNameContains) return Number(byNameContains.id);
    return null;
  }

  function validDateYmd(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  }

  function dayKeyFromYmd(dateRaw) {
    const s = String(dateRaw || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const d = new Date(`${s}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return '';
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()] || '';
  }

  function uniqueMonthsFromDraft(rows) {
    const set = new Set();
    (rows || []).forEach((r) => {
      if (validDateYmd(r.date)) set.add(String(r.date).slice(0, 7));
    });
    return [...set];
  }

  function importRowErrors(row, targetMonth) {
    const errs = [];
    if (!row.include) return errs;
    if (!validDateYmd(row.date)) errs.push(t('hr.att.monthly.importErrDate'));
    else if (targetMonth && !String(row.date).startsWith(`${targetMonth}-`)) errs.push(t('hr.att.monthly.importErrMonthMismatch'));
    if (!row.employeeIdResolved) errs.push(t('hr.att.monthly.importErrEmployee'));
    const ws = String(row.workStatus || '').trim().toLowerCase();
    const checkInNorm = parseTimeHHmm(row.checkIn);
    const checkOutNorm = parseTimeHHmm(row.checkOut);
    const strictTime = ws === 'worked' || ws === 'half_day' || ws === 'overtime';
    if (strictTime) {
      if (!checkInNorm) errs.push(t('hr.att.monthly.importErrCheckIn'));
      if (!checkOutNorm) errs.push(t('hr.att.monthly.importErrCheckOut'));
    } else {
      if (String(row.checkIn || '').trim() && !checkInNorm) errs.push(t('hr.att.monthly.importErrCheckIn'));
      if (String(row.checkOut || '').trim() && !checkOutNorm) errs.push(t('hr.att.monthly.importErrCheckOut'));
    }
    if (checkInNorm && checkOutNorm && checkInNorm === checkOutNorm) errs.push(t('api.hr.attendance_time_order_invalid'));
    if (String(row.projectInput || '').trim() && !row.projectIdResolved) errs.push(t('hr.att.monthly.importErrProject'));
    if (!workStatuses.some((x) => String(x.code || '').trim().toLowerCase() === ws)) errs.push(t('hr.att.monthly.importErrStatus'));
    const wt = String(row.workType || '').trim().toLowerCase();
    if (!workTypes.some((x) => String(x.code || '').trim().toLowerCase() === wt)) errs.push(t('hr.att.monthly.importErrType'));
    return errs;
  }

  function recalcImportDraftRows() {
    const targetMonth = attmImportTargetMonth?.value || '';
    importDraftRows = importDraftRows.map((r) => {
      const employeeIdResolved = resolveEmployeeFromInput(r.employeeInput);
      const projectIdResolved = resolveProjectFromInput(r.projectInput);
      const checkIn = parseTimeHHmm(r.checkIn) || String(r.checkIn || '').trim();
      const checkOut = parseTimeHHmm(r.checkOut) || String(r.checkOut || '').trim();
      const next = {
        ...r,
        employeeIdResolved,
        projectIdResolved,
        checkIn,
        checkOut,
      };
      next.errors = importRowErrors(next, targetMonth);
      return next;
    });
  }

  function renderImportSummary() {
    if (!attmImportSummary) return;
    const included = importDraftRows.filter((r) => r.include).length;
    const ready = importDraftRows.filter((r) => r.include && (!r.errors || !r.errors.length)).length;
    const bad = importDraftRows.filter((r) => r.include && r.errors && r.errors.length).length;
    attmImportSummary.textContent = `${t('hr.att.monthly.importSummary')}: ${included} | ${t('hr.att.monthly.importReady')}: ${ready} | ${t('hr.att.monthly.importNeedsFix')}: ${bad}`;
  }

  function renderImportDraftRows() {
    if (!attmImportBody) return;
    if (!importDraftRows.length) {
      attmImportBody.innerHTML = `<tr><td colspan="10">${escHtml(t('hr.att.monthly.importEmpty'))}</td></tr>`;
      renderImportSummary();
      return;
    }
    attmImportBody.innerHTML = importDraftRows
      .map((r, idx) => {
        const badClass = (c) => (r.errors.some((e) => e === c) ? 'is-bad' : '');
        const statusText = r.errors.length ? r.errors.join(', ') : t('hr.att.monthly.importRowReady');
        const projectRaw = normalizeProjectInput(r.projectInput);
        const projectResolvedId = resolveProjectFromInput(projectRaw);
        const unknownExcelProject = projectRaw && !projectResolvedId;
        const projectSelectOptions = [
          `<option value="">${escHtml(t('hr.att.noProject') || '-')}</option>`,
          unknownExcelProject
            ? `<option value="" selected>${escHtml(
                `${t('hr.att.monthly.importErrProject')}: ${projectRaw}`
              )}</option>`
            : '',
          ...projects.map((p) => {
            const pid = String(p.id || '');
            const label = projectOptionText(p);
            return `<option value="${escHtml(pid)}"${pid === String(projectResolvedId || '') ? ' selected' : ''}>${escHtml(
              label
            )}</option>`;
          }),
        ].join('');
        return `<tr data-i="${idx}">
          <td><input class="x-imp-include" type="checkbox" ${r.include ? 'checked' : ''} /></td>
          <td><input class="x-imp-date ${badClass(t('hr.att.monthly.importErrDate'))} ${badClass(
            t('hr.att.monthly.importErrMonthMismatch')
          )}" type="date" value="${escHtml(r.date || '')}" /></td>
          <td><input class="x-imp-emp ${badClass(t('hr.att.monthly.importErrEmployee'))}" list="attmImportEmployeeOptions" value="${escHtml(
            r.employeeInput || ''
          )}" /></td>
          <td><select class="x-imp-project-select ${badClass(t('hr.att.monthly.importErrProject'))}">${projectSelectOptions}</select></td>
          <td><input class="x-imp-in ${badClass(t('hr.att.monthly.importErrCheckIn'))}" type="time" value="${escHtml(r.checkIn || '')}" /></td>
          <td><input class="x-imp-out ${badClass(t('hr.att.monthly.importErrCheckOut'))}" type="time" value="${escHtml(r.checkOut || '')}" /></td>
          <td><select class="x-imp-status ${badClass(t('hr.att.monthly.importErrStatus'))}">${workStatuses
            .map((s) => {
              const code = String(s.code || '').trim().toLowerCase();
              const name = String(s.name || code);
              return `<option value="${escHtml(code)}"${code === String(r.workStatus || '').toLowerCase() ? ' selected' : ''}>${escHtml(
                name
              )}</option>`;
            })
            .join('')}</select></td>
          <td><select class="x-imp-type ${badClass(t('hr.att.monthly.importErrType'))}">${workTypes
            .map((s) => {
              const code = String(s.code || '').trim().toLowerCase();
              const name = String(s.name || code);
              return `<option value="${escHtml(code)}"${code === String(r.workType || '').toLowerCase() ? ' selected' : ''}>${escHtml(
                name
              )}</option>`;
            })
            .join('')}</select></td>
          <td><input class="x-imp-note" type="text" value="${escHtml(r.note || '')}" /></td>
          <td><span class="attm-import-row-status">${escHtml(statusText)}</span></td>
        </tr>`;
      })
      .join('');
    renderImportSummary();
  }

  function syncImportDraftFromDom() {
    if (!attmImportBody || !importDraftRows.length) return;
    const trs = attmImportBody.querySelectorAll('tr[data-i]');
    trs.forEach((tr) => {
      const idx = Number(tr.getAttribute('data-i'));
      if (!Number.isFinite(idx) || !importDraftRows[idx]) return;
      const row = importDraftRows[idx];
      row.include = !!tr.querySelector('.x-imp-include')?.checked;
      row.date = String(tr.querySelector('.x-imp-date')?.value || '').trim();
      row.employeeInput = String(tr.querySelector('.x-imp-emp')?.value || '').trim();
      row.projectInput = String(tr.querySelector('.x-imp-project-select')?.value || '').trim();
      row.checkIn = String(tr.querySelector('.x-imp-in')?.value || '').trim();
      row.checkOut = String(tr.querySelector('.x-imp-out')?.value || '').trim();
      row.workStatus = String(tr.querySelector('.x-imp-status')?.value || '').trim().toLowerCase();
      row.workType = String(tr.querySelector('.x-imp-type')?.value || '').trim().toLowerCase();
      row.note = String(tr.querySelector('.x-imp-note')?.value || '');
    });
  }

  function refreshImportReferenceLists() {
    if (attmImportEmployeeOptions) {
      attmImportEmployeeOptions.innerHTML = employeesAll
        .map((e) => `<option value="${escHtml(employeeOptionText(e))}"></option>`)
        .join('');
    }
    if (attmImportProjectOptions) {
      attmImportProjectOptions.innerHTML = projects
        .map((p) => `<option value="${escHtml(projectOptionText(p))}"></option>`)
        .join('');
    }
  }

  function openImportModal(rows, suggestedMonth) {
    importDraftRows = rows || [];
    if (attmImportTargetMonth) attmImportTargetMonth.value = suggestedMonth || '';
    if (attmImportErr) attmImportErr.textContent = '';
    refreshImportReferenceLists();
    recalcImportDraftRows();
    renderImportDraftRows();
    if (attmImportModal) attmImportModal.classList.add('attm-modal-open');
  }

  function closeImportModal() {
    if (attmImportModal) attmImportModal.classList.remove('attm-modal-open');
    importDraftRows = [];
    if (attmImportErr) attmImportErr.textContent = '';
  }

  function mapImportRow(rawRow) {
    const row = {};
    Object.keys(rawRow || {}).forEach((k) => {
      row[normalizeHeader(k)] = rawRow[k];
    });
    const date = parseDateYmd(pickCell(row, IMPORT_KEYS.date)) || '';
    const employeeId = parseNum(pickCell(row, IMPORT_KEYS.employeeId));
    const employeeNo = String(pickCell(row, IMPORT_KEYS.employeeNo) || '')
      .trim()
      .toUpperCase();
    const employeeName = String(pickCell(row, IMPORT_KEYS.employeeName) || '').trim();
    const checkIn = parseTimeHHmm(pickCell(row, IMPORT_KEYS.checkIn)) || '';
    const checkOut = parseTimeHHmm(pickCell(row, IMPORT_KEYS.checkOut)) || '';
    const workStatus = String(pickCell(row, IMPORT_KEYS.workStatus) || 'worked').trim().toLowerCase();
    const workType = String(pickCell(row, IMPORT_KEYS.workType) || 'normal').trim().toLowerCase();
    const overtimeHoursRaw = parseNum(pickCell(row, IMPORT_KEYS.overtime));
    const projectIdRaw = parseNum(pickCell(row, IMPORT_KEYS.projectId));
    const projectCode = String(pickCell(row, IMPORT_KEYS.projectCode) || '').trim().toUpperCase();
    const note = String(pickCell(row, IMPORT_KEYS.note) || '').trim();
    const employeeInput =
      employeeNo || employeeName || (Number.isFinite(employeeId) && employeeId > 0 ? String(Math.trunc(employeeId)) : '');
    const projectInput =
      projectCode || (Number.isFinite(projectIdRaw) && projectIdRaw > 0 ? String(Math.trunc(projectIdRaw)) : '');
    return {
      include: true,
      date,
      employeeInput,
      employeeIdResolved: null,
      projectInput,
      projectIdResolved: null,
      checkIn,
      checkOut,
      workStatus,
      workType,
      overtimeHours: Number.isFinite(overtimeHoursRaw) && overtimeHoursRaw >= 0 ? overtimeHoursRaw : 0,
      note: note || '',
      errors: [],
    };
  }

  async function importMonthlyFromExcel(file) {
    if (!file) return;
    if (isLocked) return showMsg(t('hr.att.monthly.lockedHint'), true);
    if (!canEditAttendance) return showMsg(t('api.permission.denied'), true);
    if (!(window.XLSX && window.XLSX.read)) {
      showMsg(t('hr.att.monthly.importLibMissing'), true);
      return;
    }
    showMsg(t('hr.att.monthly.importReading'), false);
    await loadEmployeesForCombo();
    if (!projects.length) {
      await loadProjectsAndOptions();
    }
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames && wb.SheetNames[0];
    if (!firstSheet) return showMsg(t('hr.att.monthly.importEmpty'), true);
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], {
      defval: '',
      raw: false,
      cellDates: true,
      dateNF: 'yyyy-mm-dd',
    });
    if (!rows.length) return showMsg(t('hr.att.monthly.importEmpty'), true);
    const draft = rows.map((r) => mapImportRow(r));
    const months = uniqueMonthsFromDraft(draft);
    const suggestedMonth = months.length === 1 ? months[0] : monthKeyEl?.value || '';
    openImportModal(draft, suggestedMonth);
  }

  async function saveImportDraftRows() {
    if (!importDraftRows.length) return;
    syncImportDraftFromDom();
    recalcImportDraftRows();
    renderImportDraftRows();
    if (attmImportErr) attmImportErr.textContent = '';
    const targetMonth = attmImportTargetMonth?.value || '';
    if (!targetMonth) {
      if (attmImportErr) attmImportErr.textContent = t('hr.att.monthly.pickMonth');
      return;
    }
    const included = importDraftRows.filter((r) => r.include);
    if (!included.length) {
      if (attmImportErr) attmImportErr.textContent = t('hr.att.monthly.importNoValidRows');
      return;
    }
    const bad = included.filter((r) => r.errors && r.errors.length);
    if (bad.length) {
      if (attmImportErr) attmImportErr.textContent = t('hr.att.monthly.importNeedFixFirst');
      return;
    }
    const dupMap = new Map();
    for (const r of included) {
      const key = `${r.date}__${r.employeeIdResolved}`;
      const prev = dupMap.get(key) || 0;
      dupMap.set(key, prev + 1);
    }
    const dupKey = [...dupMap.entries()].find(([, c]) => c > 1)?.[0] || '';
    if (dupKey) {
      const [d, eid] = String(dupKey).split('__');
      const emp = employeesAll.find((e) => String(e.id) === String(eid));
      const empLabel = emp ? employeeOptionText(emp) : eid;
      if (attmImportErr) {
        attmImportErr.textContent = `${t('hr.att.monthly.importDuplicateEmployeeDay')}: ${d} - ${empLabel}. ${t(
          'hr.att.monthly.importDuplicateEmployeeDayHint'
        )}`;
      }
      return;
    }
    const grouped = new Map();
    included.forEach((r) => {
      const projectResolvedId = resolveProjectFromInput(r.projectInput);
      const dayKey = dayKeyFromYmd(r.date);
      const ws = String(r.workStatus || '').trim().toLowerCase();
      const hasWorkInput = !!(String(r.checkIn || '').trim() && String(r.checkOut || '').trim());
      const isSundayWorked = dayKey === 'sun' && (hasWorkInput || ws === 'worked' || ws === 'half_day' || ws === 'overtime');
      const entry = {
        employee_id: r.employeeIdResolved,
        project_id: projectResolvedId || null,
        work_status: r.workStatus || 'worked',
        work_type: r.workType || 'normal',
        check_in_time: r.checkIn || null,
        check_out_time: r.checkOut || null,
        note: String(r.note || '').trim() || null,
      };
      if (isSundayWorked) {
        // Excel'de Pazar çalışması varsa bu satır için günlük override otomatik açılır.
        entry.sunday_workable_override = 1;
        entry.sunday_paid_override = 1;
      }
      if (!grouped.has(r.date)) grouped.set(r.date, []);
      grouped.get(r.date).push(entry);
    });
    let savedDates = 0;
    let savedRows = 0;
    for (const [workDate, entries] of grouped.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const { ok, data } = await window.hrApi('/api/hr/attendance/daily-bulk', {
        method: 'PUT',
        body: JSON.stringify({ workDate, entries }),
      });
      if (!ok || !data?.ok) {
        if (attmImportErr) {
          attmImportErr.textContent = `${t('hr.att.monthly.importFailedAtDate')} ${workDate} - ${
            (window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.att.loadFailed')
          }`;
        }
        return;
      }
      savedDates += 1;
      savedRows += entries.length;
    }
    closeImportModal();
    showMsg(`${t('hr.att.monthly.importDone')} ${savedRows} / ${savedDates}. ${t('hr.att.monthly.importSkipped')} 0.`, false);
    await loadMonthly();
  }

  function downloadMonthlyExcelTemplate() {
    if (!(window.XLSX && window.XLSX.utils && window.XLSX.writeFile)) {
      showMsg(t('hr.att.monthly.importLibMissing'), true);
      return;
    }
    const templateRows = [
      {
        tarih: '2026-05-11',
        personel_no: 'PRS-001',
        personel: 'AHMET YILMAZ',
        proje_kodu: 'PRJ-001',
        giris: '08:00',
        cikis: '18:00',
        work_status: 'worked',
        work_type: 'normal',
        overtime_hours: 0,
        note: '',
      },
    ];
    const ws = window.XLSX.utils.json_to_sheet(templateRows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'attendance_import');
    window.XLSX.writeFile(wb, 'aylik-puantaj-import-sablonu.xlsx');
  }

  function renderEmpCmbList() {
    if (!mNameCmbList) return;
    const q = String((mNameFilter && mNameFilter.value) || '').trim().toLowerCase();
    const dep = mDepFilter?.value ? String(mDepFilter.value) : '';
    const pos = mPosFilter?.value ? String(mPosFilter.value) : '';
    let list = employeesAll.slice();
    if (dep) list = list.filter((e) => String(e.department_id || '') === dep);
    if (pos) list = list.filter((e) => String(e.position_id || '') === pos);
    if (q) list = list.filter((e) => String(e.name || '').toLowerCase().includes(q));
    list = list.slice(0, 100);
    if (mNameCmbEmpty) mNameCmbEmpty.hidden = list.length > 0;
    mNameCmbList.innerHTML = list
      .map((e) => {
        const meta = [e.departmentName, e.positionName].filter(Boolean).join(' · ');
        const metaHtml = meta ? `<span class="attm-emp-cmb-opt-meta">${escHtml(meta)}</span>` : '';
        return `<li role="option" data-name="${escHtml(e.name)}" class="attm-emp-cmb-opt">${escHtml(
          e.name
        )}${metaHtml}</li>`;
      })
      .join('');
  }

  function positionEmpCmbPanel() {
    if (!mNameCmbPanel || !mNameFilter || mNameCmbPanel.hidden) return;
    const rect = mNameFilter.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const desired = Math.max(rect.width, 280);
    const width = Math.min(desired, vw - 16);
    let left = rect.left;
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
    const panelHeight = mNameCmbPanel.offsetHeight || 280;
    let top = rect.bottom + 4;
    if (top + panelHeight > vh - 8) {
      const altTop = rect.top - panelHeight - 4;
      if (altTop > 8) top = altTop;
      else top = Math.max(8, vh - panelHeight - 8);
    }
    mNameCmbPanel.style.width = width + 'px';
    mNameCmbPanel.style.left = left + 'px';
    mNameCmbPanel.style.top = top + 'px';
  }

  function bindEmpCmbReposition(on) {
    if (on && !_empCmbRepositionFn) {
      _empCmbRepositionFn = positionEmpCmbPanel;
      window.addEventListener('scroll', _empCmbRepositionFn, true);
      window.addEventListener('resize', _empCmbRepositionFn);
    } else if (!on && _empCmbRepositionFn) {
      window.removeEventListener('scroll', _empCmbRepositionFn, true);
      window.removeEventListener('resize', _empCmbRepositionFn);
      _empCmbRepositionFn = null;
    }
  }

  async function openEmpCmbPanel() {
    if (!mNameCmbPanel) return;
    await loadEmployeesForCombo();
    if (mNameCmbPanel.parentNode !== document.body) document.body.appendChild(mNameCmbPanel);
    mNameCmbPanel.hidden = false;
    if (mNameFilter) mNameFilter.setAttribute('aria-expanded', 'true');
    renderEmpCmbList();
    positionEmpCmbPanel();
    bindEmpCmbReposition(true);
  }

  function closeEmpCmbPanel() {
    if (!mNameCmbPanel) return;
    mNameCmbPanel.hidden = true;
    if (mNameFilter) mNameFilter.setAttribute('aria-expanded', 'false');
    bindEmpCmbReposition(false);
  }

  function updateEmpCmbClearBtn() {
    if (!mNameCmbClear) return;
    const has = String((mNameFilter && mNameFilter.value) || '').length > 0;
    mNameCmbClear.hidden = !has;
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
    try {
      const p = new URLSearchParams(window.location.search || '');
      const m = p.get('month');
      if (m && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m)) && monthKeyEl) monthKeyEl.value = String(m);
    } catch (_) {
      /* ignore */
    }
    syncDayOptions();
    monthKeyEl?.addEventListener('change', () => {
      syncDayOptions();
      monthlyRowsAll = [];
      renderMonthlyRowsTable([]);
    });
    mDayFilter?.addEventListener('change', () => {
      renderMonthlyRowsTable(monthlyRowsAll);
    });
    mDepFilter?.addEventListener('change', () => {
      syncMPosFilter();
      if (mNameCmbPanel && !mNameCmbPanel.hidden) renderEmpCmbList();
    });
    mPosFilter?.addEventListener('change', () => {
      if (mNameCmbPanel && !mNameCmbPanel.hidden) renderEmpCmbList();
    });

    // Personel adı searchable combobox bağlamaları
    mNameFilter?.addEventListener('focus', () => {
      openEmpCmbPanel();
    });
    mNameFilter?.addEventListener('click', (e) => {
      e.stopPropagation();
      openEmpCmbPanel();
    });
    mNameFilter?.addEventListener('input', () => {
      updateEmpCmbClearBtn();
      if (mNameCmbPanel?.hidden) {
        openEmpCmbPanel();
      } else {
        renderEmpCmbList();
        positionEmpCmbPanel();
      }
    });
    mNameFilter?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeEmpCmbPanel();
      } else if (e.key === 'Enter') {
        const visible = mNameCmbPanel && !mNameCmbPanel.hidden;
        if (visible) {
          const first = mNameCmbList?.querySelector('.attm-emp-cmb-opt');
          if (first) {
            e.preventDefault();
            first.click();
            return;
          }
        }
        closeEmpCmbPanel();
        loadMonthly();
      }
    });
    mNameCmbList?.addEventListener('click', (e) => {
      const li = e.target.closest('.attm-emp-cmb-opt');
      if (!li) return;
      const name = li.getAttribute('data-name') || '';
      if (mNameFilter) mNameFilter.value = name;
      updateEmpCmbClearBtn();
      closeEmpCmbPanel();
      mNameFilter?.focus();
    });
    mNameCmbClear?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mNameFilter) mNameFilter.value = '';
      updateEmpCmbClearBtn();
      if (mNameCmbPanel && !mNameCmbPanel.hidden) {
        renderEmpCmbList();
      }
      mNameFilter?.focus();
    });
    document.addEventListener('click', (e) => {
      if (!mNameCmbPanel || mNameCmbPanel.hidden) return;
      const t = e.target;
      if (!t || !(t instanceof Node)) return;
      if (t === mNameFilter || t === mNameCmbClear) return;
      if (t.closest && (t.closest('#mNameCmbPanel') || t.closest('#mNameCmb'))) return;
      closeEmpCmbPanel();
    });

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
    attmImportCancel?.addEventListener('click', closeImportModal);
    attmImportSave?.addEventListener('click', () => saveImportDraftRows());
    attmImportModal?.addEventListener('click', (e) => {
      if (e.target === attmImportModal) closeImportModal();
    });
    attmImportTargetMonth?.addEventListener('change', () => {
      recalcImportDraftRows();
      renderImportDraftRows();
    });
    attmImportBody?.addEventListener('change', (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (!tr) return;
      const idx = Number(tr.getAttribute('data-i'));
      if (!Number.isFinite(idx) || !importDraftRows[idx]) return;
      const row = importDraftRows[idx];
      if (e.target.classList.contains('x-imp-include')) row.include = !!e.target.checked;
      if (e.target.classList.contains('x-imp-date')) row.date = String(e.target.value || '').trim();
      if (e.target.classList.contains('x-imp-emp')) row.employeeInput = String(e.target.value || '').trim();
      if (e.target.classList.contains('x-imp-project-select')) row.projectInput = String(e.target.value || '').trim();
      if (e.target.classList.contains('x-imp-in')) row.checkIn = String(e.target.value || '').trim();
      if (e.target.classList.contains('x-imp-out')) row.checkOut = String(e.target.value || '').trim();
      if (e.target.classList.contains('x-imp-status')) row.workStatus = String(e.target.value || '').trim().toLowerCase();
      if (e.target.classList.contains('x-imp-type')) row.workType = String(e.target.value || '').trim().toLowerCase();
      if (e.target.classList.contains('x-imp-note')) row.note = String(e.target.value || '');
      recalcImportDraftRows();
      renderImportDraftRows();
    });

    await loadMePerms();
    await loadMDeptPos();
    await loadProjectsAndOptions();
    btnLoad?.addEventListener('click', loadMonthly);
    btnDownloadMonthlyExcelFormat?.addEventListener('click', downloadMonthlyExcelTemplate);
    btnImportMonthlyExcel?.addEventListener('click', () => {
      if (monthlyExcelFile) monthlyExcelFile.click();
    });
    monthlyExcelFile?.addEventListener('change', async () => {
      const file = monthlyExcelFile.files && monthlyExcelFile.files[0];
      if (!file) return;
      await importMonthlyFromExcel(file);
      monthlyExcelFile.value = '';
    });
    await loadMonthly();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrAttendanceMonthlyPage = initHrAttendanceMonthlyPage;
})();
