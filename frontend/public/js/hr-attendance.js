(function () {
  const form = document.getElementById('attendanceForm');
  const saveBtn = document.getElementById('attendanceSaveBtn');
  const resetBtn = document.getElementById('attendanceResetBtn');
  const msgEl = document.getElementById('msg');
  const employeeIdEl = document.getElementById('employeeId');
  const workDateEl = document.getElementById('workDate');
  const checkInTimeEl = document.getElementById('checkInTime');
  const checkOutTimeEl = document.getElementById('checkOutTime');
  const workStatusEl = document.getElementById('workStatus');
  const overtimeEl = document.getElementById('overtimeHours');
  const noteEl = document.getElementById('attendanceNote');

  const filterEmployeeEl = document.getElementById('filterEmployeeId');
  const filterStatusEl = document.getElementById('filterStatus');
  const filterFromDateEl = document.getElementById('filterFromDate');
  const filterToDateEl = document.getElementById('filterToDate');
  const btnApplyFilters = document.getElementById('btnApplyFilters');
  const btnClearFilters = document.getElementById('btnClearFilters');
  const attendanceBody = document.getElementById('attendanceBody');

  let employees = [];
  let attendanceRows = [];
  let editingId = null;

  function showMsg(text, ok = true) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = ok ? '#065f46' : '#b91c1c';
  }

  function statusLabel(s) {
    if (s === 'worked') return 'Calisti';
    if (s === 'absent') return 'Gelmedi';
    if (s === 'leave') return 'Izinli';
    if (s === 'sick_leave') return 'Raporlu';
    if (s === 'half_day') return 'Yarim gun';
    return s || '-';
  }

  function normalizeTime(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const m = s.match(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/);
    if (!m) return null;
    return `${m[1]}:${m[2]}`;
  }

  function validateClient() {
    const status = String(workStatusEl.value || '');
    const inTime = normalizeTime(checkInTimeEl.value);
    const outTime = normalizeTime(checkOutTimeEl.value);
    if ((status === 'worked' || status === 'half_day') && (!inTime || !outTime)) {
      return 'Calisti/Yarim gun icin giris-cikis saati zorunlu.';
    }
    if (inTime && outTime && outTime <= inTime) {
      return 'Cikis saati giris saatinden sonra olmali.';
    }
    return null;
  }

  async function loadEmployees() {
    const { ok, data } = await window.hrApi('/api/hr/employees');
    if (!ok || !data?.ok) {
      showMsg(data?.message || 'Personeller yuklenemedi', false);
      return false;
    }
    employees = data.data?.employees || data.employees || [];
    const opts =
      '<option value="">Personel secin</option>' +
      employees
        .map((e) => `<option value="${e.id}">${e.full_name}${e.employee_no ? ` (${e.employee_no})` : ''}</option>`)
        .join('');
    employeeIdEl.innerHTML = opts;
    filterEmployeeEl.innerHTML = '<option value="">Tum personeller</option>' + opts.replace('<option value="">Personel secin</option>', '');
    return true;
  }

  function rowTime(v) {
    const s = String(v || '');
    if (!s) return '-';
    return s.slice(0, 5);
  }

  function renderAttendance() {
    if (!attendanceRows.length) {
      attendanceBody.innerHTML = '<tr><td colspan="8">Kayit bulunamadi</td></tr>';
      return;
    }
    attendanceBody.innerHTML = attendanceRows
      .map(
        (r) => `<tr>
          <td>${r.employee_name || '-'}</td>
          <td>${String(r.work_date || '').slice(0, 10)}</td>
          <td>${statusLabel(r.work_status)}</td>
          <td>${rowTime(r.check_in_time)}</td>
          <td>${rowTime(r.check_out_time)}</td>
          <td>${Number(r.overtime_hours || 0)}</td>
          <td>${r.note || '-'}</td>
          <td class="table-actions"><button type="button" class="secondary-btn btn-edit" data-act="edit" data-id="${r.id}">Duzenle</button></td>
        </tr>`
      )
      .join('');
  }

  async function loadAttendance() {
    const qs = new URLSearchParams();
    if (filterEmployeeEl.value) qs.set('employeeId', filterEmployeeEl.value);
    if (filterStatusEl.value) qs.set('status', filterStatusEl.value);
    if (filterFromDateEl.value) qs.set('from', filterFromDateEl.value);
    if (filterToDateEl.value) qs.set('to', filterToDateEl.value);
    const { ok, data } = await window.hrApi(`/api/hr/attendance?${qs.toString()}`);
    if (!ok || !data?.ok) {
      attendanceBody.innerHTML = '<tr><td colspan="8">Kayitlar yuklenemedi</td></tr>';
      showMsg(data?.message || 'Kayitlar yuklenemedi', false);
      return false;
    }
    attendanceRows = data.data?.attendance || data.attendance || [];
    renderAttendance();
    return true;
  }

  function resetForm() {
    editingId = null;
    form.reset();
    overtimeEl.value = '0';
    saveBtn.textContent = 'Kaydet';
  }

  function setFormFromRow(row) {
    editingId = row.id;
    employeeIdEl.value = row.employee_id ? String(row.employee_id) : '';
    workDateEl.value = String(row.work_date || '').slice(0, 10);
    checkInTimeEl.value = normalizeTime(row.check_in_time) || '';
    checkOutTimeEl.value = normalizeTime(row.check_out_time) || '';
    workStatusEl.value = row.work_status || 'worked';
    overtimeEl.value = String(Number(row.overtime_hours || 0));
    noteEl.value = row.note || '';
    saveBtn.textContent = 'Guncelle';
  }

  async function submitForm(e) {
    e.preventDefault();
    const v = validateClient();
    if (v) return showMsg(v, false);
    const payload = {
      employee_id: employeeIdEl.value || null,
      work_date: workDateEl.value || null,
      check_in_time: checkInTimeEl.value || null,
      check_out_time: checkOutTimeEl.value || null,
      work_status: workStatusEl.value || null,
      overtime_hours: overtimeEl.value || 0,
      note: noteEl.value || null,
    };
    const url = editingId ? `/api/hr/attendance/${editingId}` : '/api/hr/attendance';
    const method = editingId ? 'PATCH' : 'POST';
    const { ok, data } = await window.hrApi(url, { method, body: JSON.stringify(payload) });
    if (!ok || !data?.ok) {
      return showMsg(data?.message || 'Kayit basarisiz', false);
    }
    showMsg(editingId ? 'Kayit guncellendi' : 'Kayit eklendi');
    resetForm();
    await loadAttendance();
  }

  function onTableClick(e) {
    const btn = e.target.closest('button[data-act="edit"]');
    if (!btn) return;
    const id = String(btn.getAttribute('data-id') || '');
    const row = attendanceRows.find((x) => String(x.id) === id);
    if (!row) return;
    setFormFromRow(row);
  }

  async function initHrAttendancePage() {
    form?.addEventListener('submit', submitForm);
    resetBtn?.addEventListener('click', resetForm);
    btnApplyFilters?.addEventListener('click', loadAttendance);
    btnClearFilters?.addEventListener('click', async () => {
      filterEmployeeEl.value = '';
      filterStatusEl.value = '';
      filterFromDateEl.value = '';
      filterToDateEl.value = '';
      await loadAttendance();
    });
    attendanceBody?.addEventListener('click', onTableClick);
    await loadEmployees();
    await loadAttendance();
  }

  window.initHrAttendancePage = initHrAttendancePage;
})();
