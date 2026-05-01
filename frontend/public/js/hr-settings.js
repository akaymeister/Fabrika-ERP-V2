(function () {
  const SETTING_KEYS = [
    'standard_start_time',
    'standard_end_time',
    'break_1_start_time',
    'break_1_end_time',
    'break_2_start_time',
    'break_2_end_time',
    'break_3_start_time',
    'break_3_end_time',
    'break_4_start_time',
    'break_4_end_time',
    'lunch_start_time',
    'lunch_end_time',
    'overtime_start_time',
    'overtime_end_time',
    'monthly_work_days',
    'monthly_work_hours',
    'time_deduction_hours',
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
    'working_days',
    'sunday_workable',
    'sunday_paid',
  ];
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const TIME_PAIRS = [
    ['break_1_start_time', 'break_1_end_time', 'break_1_total_hours'],
    ['break_2_start_time', 'break_2_end_time', 'break_2_total_hours'],
    ['break_3_start_time', 'break_3_end_time', 'break_3_total_hours'],
    ['break_4_start_time', 'break_4_end_time', 'break_4_total_hours'],
    ['lunch_start_time', 'lunch_end_time', 'lunch_total_hours'],
    ['overtime_start_time', 'overtime_end_time', 'overtime_total_hours'],
  ];

  const settingsMsg = document.getElementById('settingsMsg');
  const workTypesList = document.getElementById('workTypesList');
  const workStatusesList = document.getElementById('workStatusesList');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnAddWorkType = document.getElementById('btnAddWorkType');
  const btnAddWorkStatus = document.getElementById('btnAddWorkStatus');

  let workTypes = [];
  let workStatuses = [];
  let listenersBound = false;
  let formulaListenerBound = false;

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

  function parseDays(raw) {
    return String(raw || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter((x) => DAY_KEYS.includes(x));
  }

  function selectedDays() {
    return DAY_KEYS.filter((d) => document.getElementById(`wd_${d}`)?.checked);
  }

  function setSelectedDays(days) {
    DAY_KEYS.forEach((d) => {
      const el = document.getElementById(`wd_${d}`);
      if (el) el.checked = days.includes(d);
    });
  }

  function timeToMinutes(v) {
    const s = String(v || '').trim();
    if (!/^\d{2}:\d{2}$/.test(s)) return null;
    const [hh, mm] = s.split(':').map((x) => Number(x) || 0);
    return hh * 60 + mm;
  }

  function diffMinutes(start, end) {
    const startMinutes = timeToMinutes(start);
    let endMinutes = timeToMinutes(end);
    if (startMinutes == null || endMinutes == null) return 0;
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    return Math.max(0, endMinutes - startMinutes);
  }

  function minutesToDecimalHours(minutes) {
    return Math.round(((Number(minutes) || 0) / 60) * 100) / 100;
  }

  function formatDecimalHourTR(value) {
    const n = Math.round((Number(value) || 0) * 100) / 100;
    return n.toFixed(2).replace('.', ',');
  }

  function parseDecimalHourInput(v) {
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
  }

  function diffHoursByIds(startId, endId) {
    return minutesToDecimalHours(diffMinutes(val(startId), val(endId)));
  }

  function setHourOutput(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = formatDecimalHourTR(n);
  }

  function recalcScheduleGrid() {
    TIME_PAIRS.forEach(([startId, endId, outId]) => {
      setHourOutput(outId, diffHoursByIds(startId, endId));
    });

    const b1Minutes = diffMinutes(val('break_1_start_time'), val('break_1_end_time'));
    const b2Minutes = diffMinutes(val('break_2_start_time'), val('break_2_end_time'));
    const b3Minutes = diffMinutes(val('break_3_start_time'), val('break_3_end_time'));
    const b4Minutes = diffMinutes(val('break_4_start_time'), val('break_4_end_time'));
    const lunchMinutes = diffMinutes(val('lunch_start_time'), val('lunch_end_time'));
    const stdRawMinutes = diffMinutes(val('standard_start_time'), val('standard_end_time'));
    const timeDeductionMinutes = Math.max(0, Math.round(parseDecimalHourInput(val('time_deduction_hours')) * 60));
    const stdNetMinutes = Math.max(0, stdRawMinutes - b1Minutes - b2Minutes - lunchMinutes - timeDeductionMinutes);
    const stdNet = minutesToDecimalHours(stdNetMinutes);
    setHourOutput('standard_total_hours', stdNet);
    setHourOutput('daily_work_hours', stdNet);

    const monthDays = Number(val('monthly_work_days')) || 0;
    const monthHours = Math.round(monthDays * stdNet * 100) / 100;
    setHourOutput('monthly_work_hours', monthHours);

    // Backward-compatible keys consumed elsewhere.
    const b1m = b1Minutes;
    const b2m = b2Minutes;
    const b3m = b3Minutes + b4Minutes;
    const lunchM = lunchMinutes;
    const wDays = Math.max(1, selectedDays().length);
    const weekly = Math.round((stdNet * wDays) * 100) / 100;
    const legacyPairs = [
      ['daily_start_time', val('standard_start_time')],
      ['daily_end_time', val('standard_end_time')],
      ['break_1_minutes', String(b1m)],
      ['break_2_minutes', String(b2m)],
      ['break_3_minutes', String(b3m)],
      ['lunch_minutes', String(lunchM)],
      ['weekly_work_hours', String(weekly)],
      ['daily_work_hours', String(stdNet)],
      ['monthly_work_hours', String(monthHours)],
    ];
    legacyPairs.forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    });
  }

  function renderEditableRows(target, rows, kind) {
    if (!target) return;
    if (!rows.length) {
      target.innerHTML = `<p class="muted">${t('hr.settings.empty')}</p>`;
      return;
    }
    if (kind === 'status') {
      target.innerHTML = rows
        .map(
          (row) => `<div class="hr-settings-row status-row" data-kind="${kind}" data-id="${row.id}">
            <input class="x-code" type="hidden" value="${String(row.code || '').replace(/"/g, '&quot;')}" />
            <input class="x-sort" type="hidden" value="${Number(row.sort_order || 100)}" />
            <input class="x-name" type="text" value="${String(row.name || '').replace(/"/g, '&quot;')}" />
            <input class="x-mult" type="number" min="0" step="0.01" value="${Number(row.multiplier || 1)}" placeholder="${t(
              'hr.settings.multiplier'
            )}" />
            <label class="hr-settings-toggle">
              <input class="x-active" type="checkbox" ${row.is_active ? 'checked' : ''}/>
              <span>${t('common.active')}</span>
            </label>
            <button class="btn btn-primary btn-sm x-save">${t('common.save')}</button>
            <button class="btn btn-danger btn-sm x-del">${t('common.delete')}</button>
          </div>`
        )
        .join('');
      return;
    }
    target.innerHTML = rows
      .map(
        (row) => `<div class="hr-settings-row type-row" data-kind="${kind}" data-id="${row.id}">
          <input class="x-code" type="hidden" value="${String(row.code || '').replace(/"/g, '&quot;')}" />
          <input class="x-sort" type="hidden" value="${Number(row.sort_order || 100)}" />
          <input class="x-name" type="text" value="${String(row.name || '').replace(/"/g, '&quot;')}" />
          <label class="hr-settings-toggle">
            <input class="x-active" type="checkbox" ${row.is_active ? 'checked' : ''}/>
            <span>${t('common.active')}</span>
          </label>
          <button class="btn btn-primary btn-sm x-save">${t('common.save')}</button>
          <button class="btn btn-danger btn-sm x-del">${t('common.delete')}</button>
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
    if (document.getElementById('standard_start_time') && settings.standard_start_time == null) {
      document.getElementById('standard_start_time').value = settings.daily_start_time || '';
    }
    if (document.getElementById('standard_end_time') && settings.standard_end_time == null) {
      document.getElementById('standard_end_time').value = settings.daily_end_time || '';
    }
    setSelectedDays(parseDays(settings.working_days || 'mon,tue,wed,thu,fri,sat'));
    const sundayWorkable = document.getElementById('sunday_workable');
    const sundayPaid = document.getElementById('sunday_paid');
    if (sundayWorkable) sundayWorkable.checked = String(settings.sunday_workable || '0') === '1';
    if (sundayPaid) sundayPaid.checked = String(settings.sunday_paid || '0') === '1';
    recalcScheduleGrid();
    workTypes = payload.workTypes || [];
    workStatuses = payload.workStatuses || [];
    renderEditableRows(workTypesList, workTypes, 'type');
    renderEditableRows(workStatusesList, workStatuses, 'status');
  }

  async function saveSettings() {
    const payload = {};
    SETTING_KEYS.filter((k) => !['working_days', 'sunday_workable', 'sunday_paid'].includes(k)).forEach((k) => {
      const raw = val(k);
      payload[k] = /_hours$/.test(k) ? raw.replace(',', '.') : raw;
    });
    if (document.getElementById('sunday_workable')?.checked && !document.getElementById('wd_sun')?.checked) {
      document.getElementById('wd_sun').checked = true;
    }
    if (!document.getElementById('sunday_workable')?.checked && document.getElementById('wd_sun')?.checked) {
      document.getElementById('wd_sun').checked = false;
    }
    payload.working_days = selectedDays().join(',');
    payload.sunday_workable = document.getElementById('sunday_workable')?.checked ? '1' : '0';
    payload.sunday_paid = document.getElementById('sunday_paid')?.checked ? '1' : '0';
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
    const body = { name, code, sort_order: 100, is_active: 1 };
    if (kind === 'status') {
      const rawMult = String(window.prompt(t('hr.settings.multiplier'), '1') || '1').replace(',', '.');
      const n = Number(rawMult);
      body.multiplier = Number.isFinite(n) && n >= 0 ? n : 1;
    }
    const { ok, data } = await window.hrApi(base, {
      method: 'POST',
      body: JSON.stringify(body),
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
    if (kind === 'status') {
      const rawMult = String(rowEl.querySelector('.x-mult')?.value || '1').replace(',', '.');
      const n = Number(rawMult);
      payload.multiplier = Number.isFinite(n) && n >= 0 ? n : 1;
    }
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
      const targetEl = e.target;
      if (!(targetEl instanceof Element)) return;
      const saveBtn = targetEl.closest('button.x-save');
      if (saveBtn) {
        const row = saveBtn.closest('.hr-settings-row');
        if (row) await updateItem(row);
        return;
      }
      const delBtn = targetEl.closest('button.x-del');
      if (delBtn) {
        const row = delBtn.closest('.hr-settings-row');
        if (row) await deleteItem(row);
      }
    });
  }

  async function initHrSettingsPage() {
    if (!listenersBound) {
      listenersBound = true;
      btnSaveSettings?.addEventListener('click', saveSettings);
      btnAddWorkType?.addEventListener('click', () => createItem('type'));
      btnAddWorkStatus?.addEventListener('click', () => createItem('status'));
      bindCrudDelegation(workTypesList);
      bindCrudDelegation(workStatusesList);
      [
        'standard_start_time',
        'standard_end_time',
        'break_1_start_time',
        'break_1_end_time',
        'break_2_start_time',
        'break_2_end_time',
        'break_3_start_time',
        'break_3_end_time',
        'break_4_start_time',
        'break_4_end_time',
        'lunch_start_time',
        'lunch_end_time',
        'overtime_start_time',
        'overtime_end_time',
        'monthly_work_days',
        'time_deduction_hours',
      ].forEach((id) => document.getElementById(id)?.addEventListener('input', recalcScheduleGrid));
      DAY_KEYS.forEach((d) => document.getElementById(`wd_${d}`)?.addEventListener('change', recalcScheduleGrid));
      document.getElementById('sunday_workable')?.addEventListener('change', (e) => {
        const sunEl = document.getElementById('wd_sun');
        if (sunEl) sunEl.checked = !!e.target.checked;
        recalcScheduleGrid();
      });
      document.getElementById('wd_sun')?.addEventListener('change', (e) => {
        const sunWork = document.getElementById('sunday_workable');
        if (sunWork) sunWork.checked = !!e.target.checked;
        recalcScheduleGrid();
      });
    }
    if (!formulaListenerBound) {
      formulaListenerBound = true;
      document.addEventListener('click', (e) => {
        const targetEl = e.target;
        if (!(targetEl instanceof Element)) return;
        const infoBtn = targetEl.closest('.hr-formula-btn');
        if (!infoBtn) return;
        const txt = infoBtn.getAttribute('title') || '';
        if (!txt) return;
        if (window.appNotify?.info) {
          window.appNotify.info(txt);
        } else {
          window.alert(txt);
        }
      });
    }
    await loadBundle();
    window.i18n?.apply?.(document);
  }

  window.initHrSettingsPage = initHrSettingsPage;
})();
