(function () {
  const msgEl = document.getElementById('msg');
  const depBody = document.getElementById('depBody');
  const posBody = document.getElementById('posBody');
  const depForm = document.getElementById('depForm');
  const depName = document.getElementById('depName');
  const depCode = document.getElementById('depCode');
  const posForm = document.getElementById('posForm');
  const posDepartment = document.getElementById('posDepartment');
  const posName = document.getElementById('posName');
  const posCode = document.getElementById('posCode');

  let departments = [];
  let positions = [];

  function showMsg(text, ok = true) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = ok ? '#065f46' : '#b91c1c';
  }

  async function loadDepartments() {
    const { ok, data } = await window.hrApi('/api/hr/departments');
    if (!ok || !data?.ok) {
      depBody.innerHTML = '<tr><td colspan="4">Departmanlar yuklenemedi</td></tr>';
      return false;
    }
    departments = data.data?.departments || data.departments || [];
    renderDepartments();
    renderDepartmentSelect();
    return true;
  }

  function renderDepartments() {
    if (!departments.length) {
      depBody.innerHTML = '<tr><td colspan="4">Departman yok</td></tr>';
      return;
    }
    depBody.innerHTML = departments
      .map((d) => {
        const st = Number(d.is_active) === 1 ? 'Aktif' : 'Pasif';
        return `<tr>
          <td>${d.name || '-'}</td>
          <td>${d.code || '-'}</td>
          <td>${st}</td>
          <td class="table-actions">
            <button type="button" class="secondary-btn btn-edit" data-act="edit-dep" data-id="${d.id}">Duzenle</button>
            <button type="button" class="secondary-btn" data-act="toggle-dep" data-id="${d.id}" data-next="${Number(d.is_active) === 1 ? 0 : 1}">
              ${Number(d.is_active) === 1 ? 'Pasif yap' : 'Aktif yap'}
            </button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function renderDepartmentSelect() {
    const active = departments.filter((d) => Number(d.is_active) === 1);
    if (!active.length) {
      posDepartment.innerHTML = '<option value="">Departman yok</option>';
      return;
    }
    posDepartment.innerHTML = active.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  async function loadPositions() {
    const { ok, data } = await window.hrApi('/api/hr/positions');
    if (!ok || !data?.ok) {
      posBody.innerHTML = '<tr><td colspan="5">Pozisyonlar yuklenemedi</td></tr>';
      return false;
    }
    positions = data.data?.positions || data.positions || [];
    renderPositions();
    return true;
  }

  function renderPositions() {
    if (!positions.length) {
      posBody.innerHTML = '<tr><td colspan="5">Pozisyon yok</td></tr>';
      return;
    }
    posBody.innerHTML = positions
      .map((p) => {
        const st = Number(p.is_active) === 1 ? 'Aktif' : 'Pasif';
        return `<tr>
          <td>${p.name || '-'}</td>
          <td>${p.department_name || '-'}</td>
          <td>${p.code || '-'}</td>
          <td>${st}</td>
          <td class="table-actions">
            <button type="button" class="secondary-btn btn-edit" data-act="edit-pos" data-id="${p.id}">Duzenle</button>
            <button type="button" class="secondary-btn" data-act="toggle-pos" data-id="${p.id}" data-next="${Number(p.is_active) === 1 ? 0 : 1}">
              ${Number(p.is_active) === 1 ? 'Pasif yap' : 'Aktif yap'}
            </button>
          </td>
        </tr>`;
      })
      .join('');
  }

  async function submitDepartment(e) {
    e.preventDefault();
    const payload = { name: depName.value, code: depCode.value || null };
    const { ok, data } = await window.hrApi('/api/hr/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!ok || !data?.ok) {
      showMsg(data?.message || 'Departman eklenemedi', false);
      return;
    }
    depForm.reset();
    showMsg('Departman eklendi');
    await loadDepartments();
  }

  async function submitPosition(e) {
    e.preventDefault();
    const payload = {
      department_id: posDepartment.value,
      name: posName.value,
      code: posCode.value || null,
    };
    const { ok, data } = await window.hrApi('/api/hr/positions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!ok || !data?.ok) {
      showMsg(data?.message || 'Pozisyon eklenemedi', false);
      return;
    }
    posForm.reset();
    showMsg('Pozisyon eklendi');
    await loadPositions();
  }

  async function handleActions(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    if (!id) return;
    if (act === 'toggle-dep') {
      const next = Number(btn.getAttribute('data-next')) === 1 ? 1 : 0;
      const { ok, data } = await window.hrApi(`/api/hr/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: next }),
      });
      if (!ok || !data?.ok) return showMsg(data?.message || 'Durum guncellenemedi', false);
      await loadDepartments();
      return showMsg('Departman durumu guncellendi');
    }
    if (act === 'toggle-pos') {
      const next = Number(btn.getAttribute('data-next')) === 1 ? 1 : 0;
      const { ok, data } = await window.hrApi(`/api/hr/positions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: next }),
      });
      if (!ok || !data?.ok) return showMsg(data?.message || 'Durum guncellenemedi', false);
      await loadPositions();
      return showMsg('Pozisyon durumu guncellendi');
    }
    if (act === 'edit-dep') {
      const row = departments.find((d) => String(d.id) === String(id));
      if (!row) return;
      const name = window.prompt('Departman adi', row.name || '');
      if (name == null) return;
      const code = window.prompt('Departman kodu (opsiyonel)', row.code || '') ?? row.code;
      const { ok, data } = await window.hrApi(`/api/hr/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, code }),
      });
      if (!ok || !data?.ok) return showMsg(data?.message || 'Departman guncellenemedi', false);
      await loadDepartments();
      return showMsg('Departman guncellendi');
    }
    if (act === 'edit-pos') {
      const row = positions.find((p) => String(p.id) === String(id));
      if (!row) return;
      const name = window.prompt('Pozisyon adi', row.name || '');
      if (name == null) return;
      const code = window.prompt('Pozisyon kodu (opsiyonel)', row.code || '') ?? row.code;
      const depId = window.prompt('Departman ID', String(row.department_id || ''));
      const payload = { name, code };
      if (depId != null && String(depId).trim() !== '') payload.department_id = depId;
      const { ok, data } = await window.hrApi(`/api/hr/positions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!ok || !data?.ok) return showMsg(data?.message || 'Pozisyon guncellenemedi', false);
      await loadPositions();
      return showMsg('Pozisyon guncellendi');
    }
  }

  async function initHrStructurePage() {
    depForm?.addEventListener('submit', submitDepartment);
    posForm?.addEventListener('submit', submitPosition);
    depBody?.addEventListener('click', handleActions);
    posBody?.addEventListener('click', handleActions);
    await loadDepartments();
    await loadPositions();
  }

  window.initHrStructurePage = initHrStructurePage;
})();
