(function () {
  const empBody = document.getElementById('empBody');
  const statusFilter = document.getElementById('statusFilter');
  const searchInput = document.getElementById('searchInput');
  const btnSearch = document.getElementById('btnSearch');
  const msgEl = document.getElementById('msg');

  let employees = [];

  function showMsg(text, ok = true) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = ok ? '#065f46' : '#b91c1c';
  }

  function statusLabel(s) {
    if (s === 'active') return 'Aktif';
    if (s === 'passive') return 'Pasif';
    if (s === 'terminated') return 'Isten ayrildi';
    return s || '-';
  }

  async function loadEmployees() {
    const qs = new URLSearchParams();
    if (statusFilter.value) qs.set('status', statusFilter.value);
    if (searchInput.value.trim()) qs.set('search', searchInput.value.trim());
    const { ok, data } = await window.hrApi(`/api/hr/employees?${qs.toString()}`);
    if (!ok || !data?.ok) {
      empBody.innerHTML = '<tr><td colspan="7">Personeller yuklenemedi</td></tr>';
      showMsg(data?.message || 'Personeller yuklenemedi', false);
      return;
    }
    employees = data.data?.employees || data.employees || [];
    renderEmployees();
  }

  function renderEmployees() {
    if (!employees.length) {
      empBody.innerHTML = '<tr><td colspan="7">Personel kaydi yok</td></tr>';
      return;
    }
    empBody.innerHTML = employees
      .map(
        (e) => `<tr>
        <td>${e.employee_no || '-'}</td>
        <td>${e.full_name || '-'}</td>
        <td>${e.department_name || '-'}</td>
        <td>${e.position_name || '-'}</td>
        <td>${e.user_username || '-'}</td>
        <td>${statusLabel(e.employment_status)}</td>
        <td class="table-actions">
          <a class="version-btn" style="width:auto;text-decoration:none" href="/hr-employee-form.html?id=${e.id}">Duzenle</a>
          <button type="button" class="secondary-btn" data-act="status" data-id="${e.id}" data-next="active">Aktif</button>
          <button type="button" class="secondary-btn" data-act="status" data-id="${e.id}" data-next="passive">Pasif</button>
          <button type="button" class="secondary-btn btn-danger" data-act="status" data-id="${e.id}" data-next="terminated">Isten ayrildi</button>
        </td>
      </tr>`
      )
      .join('');
  }

  async function onTableClick(e) {
    const btn = e.target.closest('button[data-act="status"]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const next = btn.getAttribute('data-next');
    const { ok, data } = await window.hrApi(`/api/hr/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ employment_status: next }),
    });
    if (!ok || !data?.ok) return showMsg(data?.message || 'Durum guncellenemedi', false);
    showMsg('Personel durumu guncellendi');
    await loadEmployees();
  }

  async function initHrEmployeesPage() {
    btnSearch?.addEventListener('click', loadEmployees);
    empBody?.addEventListener('click', onTableClick);
    await loadEmployees();
  }

  window.initHrEmployeesPage = initHrEmployeesPage;
})();
