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
  const depSubmitBtn = document.getElementById('depSubmitBtn');
  const posSubmitBtn = document.getElementById('posSubmitBtn');

  let departments = [];
  let positions = [];
  let langBound = false;

  const svgPlus =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
  const svgEdit =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"></path></svg>';
  const svgPause =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>';
  const svgPlay =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7-11-7z"></path></svg>';

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function escAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function apiErr(data, fallbackKey) {
    if (window.i18n && typeof window.i18n.apiErrorText === 'function') {
      const m = window.i18n.apiErrorText(data);
      const unk = window.i18n.t('api.error.unknown');
      if (m && m !== unk) return m;
    }
    return t(fallbackKey);
  }

  function showMsg(text, ok = true) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = ok ? '#065f46' : '#b91c1c';
  }

  function applySubmitAriaLabels() {
    const labDep = t('hr.structure.addDepAria');
    const labPos = t('hr.structure.addPosAria');
    if (depSubmitBtn) {
      depSubmitBtn.setAttribute('aria-label', labDep);
      depSubmitBtn.setAttribute('title', labDep);
    }
    if (posSubmitBtn) {
      posSubmitBtn.setAttribute('aria-label', labPos);
      posSubmitBtn.setAttribute('title', labPos);
    }
  }

  function bindLangRefresh() {
    if (langBound) return;
    const sel = document.getElementById('languageSelect');
    if (!sel) return;
    langBound = true;
    sel.addEventListener('change', async () => {
      if (window.i18n && window.i18n.loadDict) {
        await window.i18n.loadDict(window.i18n.getLang());
      }
      window.i18n?.apply?.(document);
      applySubmitAriaLabels();
      renderDepartments();
      renderPositions();
      renderDepartmentSelect();
    });
  }

  async function loadDepartments() {
    const { ok, data } = await window.hrApi('/api/hr/departments');
    if (!ok || !data?.ok) {
      depBody.innerHTML = `<tr><td colspan="4">${t('hr.structure.depsLoadErr')}</td></tr>`;
      return false;
    }
    departments = data.data?.departments || data.departments || [];
    renderDepartments();
    renderDepartmentSelect();
    return true;
  }

  function renderDepartments() {
    if (!departments.length) {
      depBody.innerHTML = `<tr><td colspan="4">${t('hr.structure.noDeps')}</td></tr>`;
      return;
    }
    depBody.innerHTML = departments
      .map((d) => {
        const active = Number(d.is_active) === 1;
        const st = active ? t('hr.emp.status.active') : t('hr.emp.status.passive');
        const next = active ? 0 : 1;
        const toggleTitle = active ? t('hr.structure.toggleToPassive') : t('hr.structure.toggleToActive');
        const editLab = escAttr(t('hr.emp.edit'));
        const toggleLab = escAttr(toggleTitle);
        const toggleCls = active ? 'hr-st-row-toggle-on' : 'hr-st-row-toggle-off';
        const toggleSvg = active ? svgPause : svgPlay;
        return `<tr>
          <td>${d.name || '-'}</td>
          <td>${d.code || '-'}</td>
          <td>${st}</td>
          <td class="erp-table-actions">
            <button type="button" class="hr-st-icon-btn hr-st-row-edit" data-act="edit-dep" data-id="${d.id}" title="${editLab}" aria-label="${editLab}">${svgEdit}</button>
            <button type="button" class="hr-st-icon-btn ${toggleCls}" data-act="toggle-dep" data-id="${d.id}" data-next="${next}" title="${toggleLab}" aria-label="${toggleLab}">${toggleSvg}</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function renderDepartmentSelect() {
    const active = departments.filter((d) => Number(d.is_active) === 1);
    if (!active.length) {
      posDepartment.innerHTML = `<option value="">${t('hr.structure.noDeptForPos')}</option>`;
      return;
    }
    posDepartment.innerHTML = active.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  async function loadPositions() {
    const { ok, data } = await window.hrApi('/api/hr/positions');
    if (!ok || !data?.ok) {
      posBody.innerHTML = `<tr><td colspan="5">${t('hr.structure.posLoadErr')}</td></tr>`;
      return false;
    }
    positions = data.data?.positions || data.positions || [];
    renderPositions();
    return true;
  }

  function renderPositions() {
    if (!positions.length) {
      posBody.innerHTML = `<tr><td colspan="5">${t('hr.structure.noPos')}</td></tr>`;
      return;
    }
    posBody.innerHTML = positions
      .map((p) => {
        const active = Number(p.is_active) === 1;
        const st = active ? t('hr.emp.status.active') : t('hr.emp.status.passive');
        const next = active ? 0 : 1;
        const toggleTitle = active ? t('hr.structure.toggleToPassive') : t('hr.structure.toggleToActive');
        const editLab = escAttr(t('hr.emp.edit'));
        const toggleLab = escAttr(toggleTitle);
        const toggleCls = active ? 'hr-st-row-toggle-on' : 'hr-st-row-toggle-off';
        const toggleSvg = active ? svgPause : svgPlay;
        return `<tr>
          <td>${p.name || '-'}</td>
          <td>${p.department_name || '-'}</td>
          <td>${p.code || '-'}</td>
          <td>${st}</td>
          <td class="erp-table-actions">
            <button type="button" class="hr-st-icon-btn hr-st-row-edit" data-act="edit-pos" data-id="${p.id}" title="${editLab}" aria-label="${editLab}">${svgEdit}</button>
            <button type="button" class="hr-st-icon-btn ${toggleCls}" data-act="toggle-pos" data-id="${p.id}" data-next="${next}" title="${toggleLab}" aria-label="${toggleLab}">${toggleSvg}</button>
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
      showMsg(apiErr(data, 'hr.structure.msg.depAddFail'), false);
      return;
    }
    depForm.reset();
    showMsg(t('hr.structure.msg.depAdded'));
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
      showMsg(apiErr(data, 'hr.structure.msg.posAddFail'), false);
      return;
    }
    posForm.reset();
    showMsg(t('hr.structure.msg.posAdded'));
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
      if (!ok || !data?.ok) return showMsg(apiErr(data, 'hr.structure.msg.statusFail'), false);
      await loadDepartments();
      return showMsg(t('hr.structure.msg.depStatusOk'));
    }
    if (act === 'toggle-pos') {
      const next = Number(btn.getAttribute('data-next')) === 1 ? 1 : 0;
      const { ok, data } = await window.hrApi(`/api/hr/positions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: next }),
      });
      if (!ok || !data?.ok) return showMsg(apiErr(data, 'hr.structure.msg.statusFail'), false);
      await loadPositions();
      return showMsg(t('hr.structure.msg.posStatusOk'));
    }
    if (act === 'edit-dep') {
      const row = departments.find((d) => String(d.id) === String(id));
      if (!row) return;
      const name = window.prompt(t('hr.structure.prompt.depName'), row.name || '');
      if (name == null) return;
      const code = window.prompt(t('hr.structure.prompt.depCode'), row.code || '') ?? row.code;
      const { ok, data } = await window.hrApi(`/api/hr/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, code }),
      });
      if (!ok || !data?.ok) return showMsg(apiErr(data, 'hr.structure.msg.depUpdFail'), false);
      await loadDepartments();
      return showMsg(t('hr.structure.msg.depUpdOk'));
    }
    if (act === 'edit-pos') {
      const row = positions.find((p) => String(p.id) === String(id));
      if (!row) return;
      const name = window.prompt(t('hr.structure.prompt.posName'), row.name || '');
      if (name == null) return;
      const code = window.prompt(t('hr.structure.prompt.posCode'), row.code || '') ?? row.code;
      const depId = window.prompt(t('hr.structure.prompt.depId'), String(row.department_id || ''));
      const payload = { name, code };
      if (depId != null && String(depId).trim() !== '') payload.department_id = depId;
      const { ok, data } = await window.hrApi(`/api/hr/positions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!ok || !data?.ok) return showMsg(apiErr(data, 'hr.structure.msg.posUpdFail'), false);
      await loadPositions();
      return showMsg(t('hr.structure.msg.posUpdOk'));
    }
  }

  async function initHrStructurePage() {
    bindLangRefresh();
    applySubmitAriaLabels();
    depForm?.addEventListener('submit', submitDepartment);
    posForm?.addEventListener('submit', submitPosition);
    depBody?.addEventListener('click', handleActions);
    posBody?.addEventListener('click', handleActions);
    if (depSubmitBtn) depSubmitBtn.innerHTML = svgPlus;
    if (posSubmitBtn) posSubmitBtn.innerHTML = svgPlus;
    await loadDepartments();
    await loadPositions();
  }

  window.initHrStructurePage = initHrStructurePage;
})();
