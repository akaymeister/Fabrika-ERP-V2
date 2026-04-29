(function () {
  const empBody = document.getElementById('empBody');
  const statusFilter = document.getElementById('statusFilter');
  const natFilter = document.getElementById('natFilter');
  const countryFilter = document.getElementById('countryFilter');
  const regionFilter = document.getElementById('regionFilter');
  const departmentFilter = document.getElementById('departmentFilter');
  const positionFilter = document.getElementById('positionFilter');
  const searchInput = document.getElementById('searchInput');
  const btnSearch = document.getElementById('btnSearch');
  const msgEl = document.getElementById('msg');

  let employees = [];
  let departments = [];
  let positions = [];

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function normTr(s) {
    return String(s || '')
      .trim()
      .toLocaleUpperCase('tr-TR');
  }

  function showMsg(text, ok = true) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = ok ? '#065f46' : '#b91c1c';
  }

  function natLabel(code) {
    if (!code) return '—';
    const k = `hr.emp.nat.${code}`;
    const s = t(k);
    return s !== k ? s : code;
  }

  function statusLabel(s) {
    const k =
      s === 'active'
        ? 'hr.emp.status.active'
        : s === 'passive'
          ? 'hr.emp.status.passive'
          : s === 'terminated'
            ? 'hr.emp.status.terminated'
            : '';
    if (!k) return s || '—';
    const x = t(k);
    return x !== k ? x : s;
  }

  function displayNameOnly(e) {
    const fn = String(e.first_name || '').trim();
    const ln = String(e.last_name || '').trim();
    if (fn || ln) return `${fn} ${ln}`.trim();
    const full = String(e.full_name || '').trim();
    if (full) return full;
    const disp = String(e.employee_display || '').trim();
    return disp.replace(/^PRS-\d+\s*-\s*/i, '').trim() || '—';
  }

  function avatarHtml(e) {
    const rel = e.photo_path ? String(e.photo_path).replace(/^\/+/, '') : '';
    if (rel) {
      const src = `/uploads/${encodeURI(rel)}`;
      return `<img class="hr-emp-avatar" src="${src}" alt="" />`;
    }
    const a = (e.first_name || '').trim().charAt(0);
    const b = (e.last_name || '').trim().charAt(0);
    const initials = `${a}${b}`.toUpperCase() || '?';
    return `<div class="hr-emp-avatar hr-emp-avatar--placeholder" aria-hidden="true">${initials}</div>`;
  }

  function syncRegionFilterOptions(preserve) {
    const cc = countryFilter.value;
    const loc = window.HR_LOCATION && window.HR_LOCATION.regionsByCountry;
    const list = cc && loc ? loc[cc] : null;
    const prev = preserve != null ? preserve : regionFilter.value;
    regionFilter.innerHTML = `<option value="">${t('hr.emp.filterRegion')}</option>`;
    if (!list || !cc) {
      regionFilter.disabled = true;
      regionFilter.value = '';
      return;
    }
    regionFilter.disabled = false;
    list.forEach((name) => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      regionFilter.appendChild(o);
    });
    if (prev) {
      const n = normTr(prev);
      for (const opt of regionFilter.options) {
        if (opt.value && normTr(opt.value) === n) {
          regionFilter.value = opt.value;
          return;
        }
      }
    }
  }

  function syncPositionFilterOptions() {
    const dep = departmentFilter.value ? String(departmentFilter.value) : '';
    const filtered = dep ? positions.filter((p) => String(p.department_id) === dep) : positions;
    const cur = positionFilter.value;
    positionFilter.innerHTML = `<option value="">${t('hr.emp.filterPos')}</option>`;
    filtered.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      positionFilter.appendChild(o);
    });
    if (cur && filtered.some((p) => String(p.id) === String(cur))) positionFilter.value = cur;
  }

  async function loadDeptPos() {
    const depRes = await window.hrApi('/api/hr/departments');
    if (depRes.ok && depRes.data?.ok) {
      departments = depRes.data.data?.departments || depRes.data.departments || [];
    }
    const posRes = await window.hrApi('/api/hr/positions');
    if (posRes.ok && posRes.data?.ok) {
      positions = posRes.data.data?.positions || posRes.data.positions || [];
    }
    departmentFilter.innerHTML = `<option value="">${t('hr.emp.filterDept')}</option>`;
    departments.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name;
      departmentFilter.appendChild(o);
    });
    syncPositionFilterOptions();
  }

  async function loadEmployees() {
    const qs = new URLSearchParams();
    if (statusFilter.value) qs.set('status', statusFilter.value);
    if (searchInput.value.trim()) qs.set('search', searchInput.value.trim());
    if (natFilter.value) qs.set('nationality', natFilter.value);
    if (countryFilter.value) qs.set('country', countryFilter.value);
    if (regionFilter.value) qs.set('region', regionFilter.value);
    if (departmentFilter.value) qs.set('departmentId', departmentFilter.value);
    if (positionFilter.value) qs.set('positionId', positionFilter.value);
    const { ok, data } = await window.hrApi(`/api/hr/employees?${qs.toString()}`);
    if (!ok || !data?.ok) {
      empBody.innerHTML = `<tr><td colspan="9">${t('hr.att.loadFailed')}</td></tr>`;
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || '—', false);
      return;
    }
    employees = data.data?.employees || data.employees || [];
    renderEmployees();
    showMsg('', true);
  }

  function renderEmployees() {
    if (!employees.length) {
      empBody.innerHTML = `<tr><td colspan="9">${t('hr.att.noRows')}</td></tr>`;
      return;
    }
    empBody.innerHTML = employees
      .map(
        (e) => `<tr>
        <td>${avatarHtml(e)}</td>
        <td>${e.employee_no || '—'}</td>
        <td>${displayNameOnly(e)}</td>
        <td>${natLabel(e.nationality)}</td>
        <td>${e.department_name || '—'}</td>
        <td>${e.position_name || '—'}</td>
        <td>${e.user_username || '—'}</td>
        <td>${statusLabel(e.employment_status)}</td>
        <td class="table-actions">
          <a class="version-btn emp-row-btn" href="/hr-employee-detail.html?id=${e.id}" data-i18n="hr.emp.view">Görüntüle</a>
          <a class="version-btn emp-row-btn" href="/hr-employee-form.html?id=${e.id}" data-i18n="hr.emp.edit">Düzenle</a>
          <label class="emp-mini-toggle" title="${statusLabel(e.employment_status)}">
            <input type="checkbox" data-act="quick-toggle" data-id="${e.id}" ${e.employment_status === 'active' ? 'checked' : ''} />
            <span class="emp-mini-slider"></span>
          </label>
          <button type="button" class="secondary-btn btn-danger emp-row-btn" data-act="status" data-id="${e.id}" data-next="terminated" data-i18n="hr.emp.status.terminated">İşten ayrıldı</button>
        </td>
      </tr>`
      )
      .join('');
    if (window.i18n && window.i18n.apply) window.i18n.apply(empBody);
  }

  async function onTableClick(e) {
    const btn = e.target.closest('button[data-act="status"]');
    const tgl = e.target.closest('input[data-act="quick-toggle"]');
    let id;
    let next;
    if (btn) {
      id = btn.getAttribute('data-id');
      next = btn.getAttribute('data-next');
    } else if (tgl) {
      id = tgl.getAttribute('data-id');
      next = tgl.checked ? 'active' : 'passive';
    } else {
      return;
    }
    const { ok, data } = await window.hrApi(`/api/hr/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ employment_status: next }),
    });
    if (!ok || !data?.ok) {
      if (tgl) tgl.checked = !tgl.checked;
      return showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || '—', false);
    }
    showMsg(t('hr.emp.saved'));
    await loadEmployees();
  }

  async function initHrEmployeesPage() {
    await loadDeptPos();
    countryFilter?.addEventListener('change', () => syncRegionFilterOptions(null));
    departmentFilter?.addEventListener('change', syncPositionFilterOptions);
    btnSearch?.addEventListener('click', loadEmployees);
    empBody?.addEventListener('click', onTableClick);
    syncRegionFilterOptions(null);
    await loadEmployees();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrEmployeesPage = initHrEmployeesPage;
})();
