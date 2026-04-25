(function () {
  const form = document.getElementById('empForm');
  const msgEl = document.getElementById('msg');
  const employeeNo = document.getElementById('employeeNo');
  const fullName = document.getElementById('fullName');
  const phone = document.getElementById('phone');
  const email = document.getElementById('email');
  const hireDate = document.getElementById('hireDate');
  const employmentStatus = document.getElementById('employmentStatus');
  const departmentId = document.getElementById('departmentId');
  const positionId = document.getElementById('positionId');
  const userId = document.getElementById('userId');
  const note = document.getElementById('note');

  const params = new URLSearchParams(window.location.search);
  const editingId = params.get('id');

  let departments = [];
  let positions = [];
  let users = [];

  function showMsg(text, ok = true) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = ok ? '#065f46' : '#b91c1c';
  }

  async function loadDepsAndPositions() {
    const depRes = await window.hrApi('/api/hr/departments');
    if (depRes.ok && depRes.data?.ok) {
      departments = depRes.data.data?.departments || depRes.data.departments || [];
    }
    const posRes = await window.hrApi('/api/hr/positions');
    if (posRes.ok && posRes.data?.ok) {
      positions = posRes.data.data?.positions || posRes.data.positions || [];
    }
    departmentId.innerHTML =
      '<option value="">Departman secin</option>' +
      departments.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
    syncPositions();
  }

  function syncPositions() {
    const dep = departmentId.value ? String(departmentId.value) : '';
    const filtered = dep ? positions.filter((p) => String(p.department_id) === dep) : positions;
    const current = positionId.value;
    positionId.innerHTML =
      '<option value="">Pozisyon secin</option>' + filtered.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
    if (current && filtered.some((p) => String(p.id) === String(current))) {
      positionId.value = current;
    }
  }

  async function loadUsers() {
    const q = editingId ? `?employeeId=${encodeURIComponent(editingId)}` : '';
    const res = await window.hrApi(`/api/hr/users${q}`);
    if (!res.ok || !res.data?.ok) {
      userId.innerHTML = '<option value="">Kullanici listesi yuklenemedi</option>';
      return;
    }
    users = res.data.data?.users || res.data.users || [];
    userId.innerHTML =
      '<option value="">Kullanici baglama (opsiyonel)</option>' +
      users.map((u) => `<option value="${u.id}">${u.username} - ${u.full_name || ''}</option>`).join('');
  }

  async function loadEmployee() {
    if (!editingId) return;
    const res = await window.hrApi(`/api/hr/employees/${encodeURIComponent(editingId)}`);
    if (!res.ok || !res.data?.ok) {
      showMsg(res.data?.message || 'Personel detayi yuklenemedi', false);
      return;
    }
    const e = res.data.data?.employee || res.data.employee || {};
    employeeNo.value = e.employee_no || '';
    fullName.value = e.full_name || '';
    phone.value = e.phone || '';
    email.value = e.email || '';
    hireDate.value = e.hire_date ? String(e.hire_date).slice(0, 10) : '';
    employmentStatus.value = e.employment_status || 'active';
    departmentId.value = e.department_id ? String(e.department_id) : '';
    syncPositions();
    positionId.value = e.position_id ? String(e.position_id) : '';
    userId.value = e.user_id ? String(e.user_id) : '';
    note.value = e.note || '';
  }

  function buildPayload() {
    return {
      employee_no: employeeNo.value || null,
      full_name: fullName.value,
      phone: phone.value || null,
      email: email.value || null,
      hire_date: hireDate.value,
      employment_status: employmentStatus.value,
      department_id: departmentId.value || null,
      position_id: positionId.value || null,
      user_id: userId.value || null,
      note: note.value || null,
    };
  }

  async function saveEmployee(e) {
    e.preventDefault();
    const payload = buildPayload();
    const url = editingId ? `/api/hr/employees/${encodeURIComponent(editingId)}` : '/api/hr/employees';
    const method = editingId ? 'PATCH' : 'POST';
    const res = await window.hrApi(url, { method, body: JSON.stringify(payload) });
    if (!res.ok || !res.data?.ok) {
      return showMsg(res.data?.message || 'Kayit basarisiz', false);
    }
    showMsg('Personel kaydedildi');
    if (!editingId) {
      form.reset();
    }
  }

  async function initHrEmployeeFormPage() {
    await loadDepsAndPositions();
    await loadUsers();
    await loadEmployee();
    departmentId?.addEventListener('change', syncPositions);
    form?.addEventListener('submit', saveEmployee);
  }

  window.initHrEmployeeFormPage = initHrEmployeeFormPage;
})();
