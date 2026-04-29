(function () {
  const SETTING_KEYS = [
    'daily_start_time',
    'daily_end_time',
    'break_1_minutes',
    'break_2_minutes',
    'break_3_minutes',
    'lunch_minutes',
    'holiday_days',
    'weekly_work_hours',
    'daily_work_hours',
    'overtime_multiplier_1',
    'overtime_multiplier_2',
    'overtime_multiplier_3',
  ];

  const settingsMsg = document.getElementById('settingsMsg');
  const workTypesList = document.getElementById('workTypesList');
  const workStatusesList = document.getElementById('workStatusesList');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnAddWorkType = document.getElementById('btnAddWorkType');
  const btnAddWorkStatus = document.getElementById('btnAddWorkStatus');

  let workTypes = [];
  let workStatuses = [];

  function t(k) {
    return window.i18n?.t ? window.i18n.t(k) : k;
  }

  function setMsg(text, isErr) {
    if (!settingsMsg) return;
    settingsMsg.textContent = text || '';
    settingsMsg.style.color = isErr ? '#b91c1c' : '#166534';
  }

  function val(id) {
    return document.getElementById(id)?.value || '';
  }

  function renderEditableRows(target, rows, kind) {
    if (!target) return;
    if (!rows.length) {
      target.innerHTML = `<p class="muted">${t('hr.settings.empty')}</p>`;
      return;
    }
    target.innerHTML = rows
      .map(
        (row) => `<div class="hr-settings-row" data-kind="${kind}" data-id="${row.id}">
          <input class="x-code" type="text" value="${String(row.code || '').replace(/"/g, '&quot;')}" />
          <input class="x-name" type="text" value="${String(row.name || '').replace(/"/g, '&quot;')}" />
          <input class="x-sort" type="number" step="1" value="${Number(row.sort_order || 100)}" />
          <label class="hr-settings-toggle">
            <input class="x-active" type="checkbox" ${row.is_active ? 'checked' : ''}/>
            <span>${t('common.active')}</span>
          </label>
          <button class="version-btn x-save">${t('common.save')}</button>
          <button class="logout-btn x-del">${t('common.delete')}</button>
        </div>`
      )
      .join('');
  }

  async function loadBundle() {
    const { ok, data } = await window.hrApi('/api/hr/settings?includeInactive=1');
    if (!ok || !data?.ok) {
      setMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'), true);
      return;
    }
    const payload = data.data || data;
    const settings = payload.settings || {};
    SETTING_KEYS.forEach((k) => {
      const el = document.getElementById(k);
      if (el) el.value = settings[k] == null ? '' : settings[k];
    });
    workTypes = payload.workTypes || [];
    workStatuses = payload.workStatuses || [];
    renderEditableRows(workTypesList, workTypes, 'type');
    renderEditableRows(workStatusesList, workStatuses, 'status');
  }

  async function saveSettings() {
    const payload = {};
    SETTING_KEYS.forEach((k) => {
      payload[k] = val(k);
    });
    const { ok, data } = await window.hrApi('/api/hr/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!ok || !data?.ok) {
      setMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'), true);
      return;
    }
    setMsg(t('hr.settings.saved'), false);
    window.appNotify?.success?.(t('hr.settings.saved'));
  }

  async function createItem(kind) {
    const base = kind === 'type' ? '/api/hr/work-types' : '/api/hr/work-statuses';
    const name = window.prompt(t('hr.settings.enterName'));
    if (!name) return;
    const code = window.prompt(t('hr.settings.enterCode'));
    if (!code) return;
    const { ok, data } = await window.hrApi(base, {
      method: 'POST',
      body: JSON.stringify({ name, code, sort_order: 100, is_active: 1 }),
    });
    if (!ok || !data?.ok) {
      window.appNotify?.error?.((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'));
      return;
    }
    await loadBundle();
  }

  async function updateItem(rowEl) {
    const id = rowEl.getAttribute('data-id');
    const kind = rowEl.getAttribute('data-kind');
    const base = kind === 'type' ? '/api/hr/work-types' : '/api/hr/work-statuses';
    const payload = {
      code: rowEl.querySelector('.x-code')?.value || '',
      name: rowEl.querySelector('.x-name')?.value || '',
      sort_order: rowEl.querySelector('.x-sort')?.value || 100,
      is_active: rowEl.querySelector('.x-active')?.checked ? 1 : 0,
    };
    const { ok, data } = await window.hrApi(`${base}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!ok || !data?.ok) {
      window.appNotify?.error?.((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'));
      return;
    }
    window.appNotify?.success?.(t('common.saved'));
    await loadBundle();
  }

  async function deleteItem(rowEl) {
    const id = rowEl.getAttribute('data-id');
    const kind = rowEl.getAttribute('data-kind');
    const base = kind === 'type' ? '/api/hr/work-types' : '/api/hr/work-statuses';
    if (!window.confirm(t('common.confirmDelete'))) return;
    const { ok, data } = await window.hrApi(`${base}/${id}`, { method: 'DELETE' });
    if (!ok || !data?.ok) {
      window.appNotify?.error?.((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('api.error.unknown'));
      return;
    }
    await loadBundle();
  }

  function bindCrudDelegation(target) {
    target?.addEventListener('click', async (e) => {
      const row = e.target.closest('.hr-settings-row');
      if (!row) return;
      if (e.target.classList.contains('x-save')) await updateItem(row);
      if (e.target.classList.contains('x-del')) await deleteItem(row);
    });
  }

  async function initHrSettingsPage() {
    btnSaveSettings?.addEventListener('click', saveSettings);
    btnAddWorkType?.addEventListener('click', () => createItem('type'));
    btnAddWorkStatus?.addEventListener('click', () => createItem('status'));
    bindCrudDelegation(workTypesList);
    bindCrudDelegation(workStatusesList);
    await loadBundle();
    window.i18n?.apply?.(document);
  }

  window.initHrSettingsPage = initHrSettingsPage;
})();
