(function () {
  const identityFields = document.getElementById('identityFields');
  const salaryFields = document.getElementById('salaryFields');
  const addressFields = document.getElementById('addressFields');
  const photoSlot = document.getElementById('photoSlot');
  const msgEl = document.getElementById('msg');
  const btnEdit = document.getElementById('btnEdit');
  const btnPhotoEdit = document.getElementById('btnPhotoEdit');
  const btnBack = document.getElementById('btnBack');

  const params = new URLSearchParams(window.location.search);
  const employeeId = params.get('id');

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function showMsg(text, ok = true) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = ok ? '#065f46' : '#b91c1c';
  }

  function getName(e) {
    const fn = String(e.first_name || '').trim();
    const ln = String(e.last_name || '').trim();
    const full = fn || ln ? `${fn} ${ln}`.trim() : String(e.full_name || '').trim();
    return full || '-';
  }

  function getDisplayName(e) {
    const nm = getName(e);
    return e.employee_no ? `${e.employee_no} - ${nm}` : nm;
  }

  function fmtMoney(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function value(v) {
    if (v == null) return '-';
    const s = String(v).trim();
    return s || '-';
  }

  function renderField(container, label, val) {
    const box = document.createElement('div');
    box.className = 'emp-detail-field';
    box.innerHTML = `<p class="emp-detail-label">${label}</p><p class="emp-detail-value">${value(val).replace(/\n/g, '<br />')}</p>`;
    container.appendChild(box);
  }

  function renderStat(container, label, val) {
    const box = document.createElement('div');
    box.className = 'emp-stat-card';
    box.innerHTML = `<p class="emp-detail-label">${label}</p><p class="emp-stat-value">${value(val)}</p>`;
    container.appendChild(box);
  }

  function renderPhoto(e) {
    const fn = String(e.first_name || '').trim().charAt(0);
    const ln = String(e.last_name || '').trim().charAt(0);
    const full = String(e.full_name || '').trim();
    const initials = (fn + ln || full.slice(0, 2) || '?').toUpperCase();
    const rel = e.photo_path ? String(e.photo_path).replace(/^\/+/, '') : '';
    if (rel) {
      photoSlot.innerHTML = `<img class="emp-photo-main" src="/uploads/${encodeURI(rel)}" alt="" />`;
    } else {
      photoSlot.innerHTML = `<div class="emp-photo-placeholder">${initials}</div>`;
    }
  }

  function renderIdentity(e) {
    identityFields.innerHTML = '';
    const fullName = getName(e);
    const fullParts = fullName === '-' ? [] : fullName.split(/\s+/).filter(Boolean);
    const fallbackFirst = fullParts[0] || '-';
    const fallbackLast = fullParts.length > 1 ? fullParts.slice(1).join(' ') : '-';
    renderField(identityFields, t('hr.emp.employeeNo'), e.employee_no || '-');
    renderField(identityFields, t('hr.emp.firstName'), e.first_name || fallbackFirst);
    renderField(identityFields, t('hr.emp.lastName'), e.last_name || fallbackLast);
    renderField(identityFields, t('hr.emp.nationality'), e.nationality || '-');
    renderField(identityFields, t('hr.emp.birthDate'), e.birth_date || '-');
    renderField(identityFields, t('hr.emp.gender'), e.gender || '-');
    renderField(identityFields, t('hr.emp.email'), e.email || '-');
    renderField(identityFields, t('hr.emp.phone'), e.phone || '-');
    renderField(identityFields, t('hr.emp.overtimeEligible'), Number(e.overtime_eligible || 0) === 1 ? t('hr.emp.yes') : t('hr.emp.no'));
    renderField(identityFields, t('hr.emp.identityNo'), e.identity_no || '-');
    renderField(identityFields, t('hr.emp.passportNo'), e.passport_no || '-');
    renderField(identityFields, t('hr.emp.marital'), e.marital_status || '-');
  }

  function renderSalary(e) {
    salaryFields.innerHTML = '';
    const unofficial =
      e.unofficial_salary_amount != null
        ? Number(e.unofficial_salary_amount)
        : Number(e.salary_amount || 0) - Number(e.official_salary_amount || 0);
    renderStat(salaryFields, t('hr.emp.salaryCurrency'), e.salary_currency || '-');
    renderStat(salaryFields, t('hr.emp.salaryTotal'), fmtMoney(e.salary_amount));
    renderStat(salaryFields, t('hr.emp.salaryOfficial'), fmtMoney(e.official_salary_amount));
    renderStat(salaryFields, t('hr.emp.salaryUnofficial'), fmtMoney(unofficial));
  }

  function renderAddress(e) {
    addressFields.innerHTML = '';
    renderField(addressFields, t('hr.emp.country'), e.country || '-');
    renderField(addressFields, t('hr.emp.region'), e.region_or_city || '-');
    renderField(addressFields, t('hr.emp.addressLine'), e.address_line || '-');
    renderField(addressFields, t('hr.emp.postCode'), e.post_code || '-');
  }

  async function loadEmployee() {
    if (!employeeId) {
      showMsg(t('hr.emp.detail.loadFail'), false);
      return;
    }
    const res = await window.hrApi(`/api/hr/employees/${encodeURIComponent(employeeId)}`);
    if (!res.ok || !res.data?.ok) {
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(res.data)) || t('hr.emp.detail.loadFail'), false);
      return;
    }
    const e = res.data.data?.employee || res.data.employee || {};
    document.title = `${getDisplayName(e)} - Fabrika ERP V2`;
    renderIdentity(e);
    renderPhoto(e);
    renderSalary(e);
    renderAddress(e);
    if (btnEdit) btnEdit.href = `/hr-employee-form.html?id=${encodeURIComponent(employeeId)}`;
    if (btnPhotoEdit) btnPhotoEdit.href = `/hr-employee-form.html?id=${encodeURIComponent(employeeId)}`;
    if (btnBack) btnBack.href = '/hr-employees.html';
  }

  async function initHrEmployeeDetailPage() {
    await loadEmployee();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrEmployeeDetailPage = initHrEmployeeDetailPage;
})();
