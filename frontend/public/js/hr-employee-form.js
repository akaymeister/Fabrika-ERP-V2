(function () {
  const form = document.getElementById('empForm');
  const msgEl = document.getElementById('msg');
  const employeeNoDisplay = document.getElementById('employeeNoDisplay');
  const firstName = document.getElementById('firstName');
  const lastName = document.getElementById('lastName');
  const birthDate = document.getElementById('birthDate');
  const gender = document.getElementById('gender');
  const maritalStatus = document.getElementById('maritalStatus');
  const nationality = document.getElementById('nationality');
  const photoFile = document.getElementById('photoFile');
  const photoPreview = document.getElementById('photoPreview');
  const photoFallback = document.getElementById('photoFallback');
  const salaryCurrency = document.getElementById('salaryCurrency');
  const salaryAmount = document.getElementById('salaryAmount');
  const officialSalary = document.getElementById('officialSalary');
  const unofficialSalary = document.getElementById('unofficialSalary');
  const countryCode = document.getElementById('countryCode');
  const regionSelect = document.getElementById('regionSelect');
  const addressLine = document.getElementById('addressLine');
  const phone = document.getElementById('phone');
  const phoneSecondary = document.getElementById('phoneSecondary');
  const identityNo = document.getElementById('identityNo');
  const passportNo = document.getElementById('passportNo');
  const email = document.getElementById('email');
  const hireDate = document.getElementById('hireDate');
  const employmentStatus = document.getElementById('employmentStatus');
  const overtimeEligible = document.getElementById('overtimeEligible');
  const departmentId = document.getElementById('departmentId');
  const positionId = document.getElementById('positionId');
  const userId = document.getElementById('userId');
  const telegramUsername = document.getElementById('telegramUsername');
  const telegramChatId = document.getElementById('telegramChatId');
  const telegramNotifyEnabled = document.getElementById('telegramNotifyEnabled');
  const note = document.getElementById('note');

  const params = new URLSearchParams(window.location.search);
  const editingId = params.get('id');

  let departments = [];
  let positions = [];
  let users = [];
  let currentPhotoPath = null;

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

  function showPopup(text, isErr = true) {
    if (!text) return;
    if (window.appNotify && typeof window.appNotify[isErr ? 'error' : 'success'] === 'function') {
      window.appNotify[isErr ? 'error' : 'success'](text);
      return;
    }
    window.alert(text);
  }

  function syncRegions(preserveValue) {
    const cc = countryCode.value;
    const loc = window.HR_LOCATION && window.HR_LOCATION.regionsByCountry;
    const list = cc && loc ? loc[cc] : null;
    const prev = preserveValue != null ? preserveValue : regionSelect.value;
    regionSelect.innerHTML = `<option value="">${t('hr.emp.regionPick')}</option>`;
    if (!list || !cc) {
      regionSelect.disabled = true;
      regionSelect.value = '';
      return;
    }
    regionSelect.disabled = false;
    list.forEach((name) => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      regionSelect.appendChild(o);
    });
    if (prev) {
      const n = normTr(prev);
      for (const opt of regionSelect.options) {
        if (opt.value && normTr(opt.value) === n) {
          regionSelect.value = opt.value;
          return;
        }
      }
    }
  }

  function syncUnofficial() {
    const total = Number(salaryAmount.value);
    const off = Number(officialSalary.value);
    const u = (Number.isFinite(total) ? total : 0) - (Number.isFinite(off) ? off : 0);
    unofficialSalary.value = Number.isFinite(u) ? String(Math.round(u * 100) / 100) : '0';
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
    departmentId.innerHTML = `<option value="">${t('hr.emp.regionPick')}</option>`;
    departments.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name;
      departmentId.appendChild(o);
    });
    syncPositions();
  }

  function syncPositions() {
    const dep = departmentId.value ? String(departmentId.value) : '';
    const filtered = dep ? positions.filter((p) => String(p.department_id) === dep) : positions;
    const current = positionId.value;
    positionId.innerHTML = `<option value="">${t('hr.emp.regionPick')}</option>`;
    filtered.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      positionId.appendChild(o);
    });
    if (current && filtered.some((p) => String(p.id) === String(current))) {
      positionId.value = current;
    }
  }

  async function loadUsers() {
    const q = editingId ? `?employeeId=${encodeURIComponent(editingId)}` : '';
    const res = await window.hrApi(`/api/hr/users${q}`);
    if (!res.ok || !res.data?.ok) {
      userId.innerHTML = `<option value="">${t('hr.att.loadFailed')}</option>`;
      return;
    }
    users = res.data.data?.users || res.data.users || [];
    userId.innerHTML = `<option value="">${t('hr.emp.userLink')}</option>`;
    users.forEach((u) => {
      const o = document.createElement('option');
      o.value = u.id;
      o.textContent = `${u.username} - ${u.full_name || ''}`;
      userId.appendChild(o);
    });
  }

  function updatePhotoPreviewFromPath(rel) {
    if (!photoPreview || !photoFallback) return;
    if (rel) {
      photoPreview.src = `/uploads/${rel.replace(/^\/+/, '')}`;
      photoPreview.style.display = 'inline-block';
      photoFallback.style.display = 'none';
    } else {
      photoPreview.removeAttribute('src');
      photoPreview.style.display = 'none';
      const initials = `${String(firstName?.value || '').trim().charAt(0)}${String(lastName?.value || '').trim().charAt(0)}`
        .toUpperCase()
        .trim();
      photoFallback.textContent = initials || '?';
      photoFallback.style.display = 'flex';
    }
  }

  async function loadEmployee() {
    if (!editingId) {
      employeeNoDisplay.value = '';
      currentPhotoPath = null;
      updatePhotoPreviewFromPath(null);
      return;
    }
    const res = await window.hrApi(`/api/hr/employees/${encodeURIComponent(editingId)}`);
    if (!res.ok || !res.data?.ok) {
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(res.data)) || res.data?.message || '—', false);
      return;
    }
    const e = res.data.data?.employee || res.data.employee || {};
    employeeNoDisplay.value = e.employee_no || '';
    firstName.value = e.first_name || '';
    lastName.value = e.last_name || '';
    birthDate.value = e.birth_date ? String(e.birth_date).slice(0, 10) : '';
    gender.value = e.gender || '';
    maritalStatus.value = e.marital_status || '';
    nationality.value = e.nationality || '';
    salaryCurrency.value = e.salary_currency === 'USD' ? 'USD' : 'UZS';
    salaryAmount.value = e.salary_amount != null ? String(e.salary_amount) : '0';
    officialSalary.value = e.official_salary_amount != null ? String(e.official_salary_amount) : '0';
    syncUnofficial();
    countryCode.value = e.country || '';
    syncRegions(e.region_or_city || '');
    phone.value = e.phone || '';
    phoneSecondary.value = e.phone_secondary || '';
    identityNo.value = e.identity_no || '';
    passportNo.value = e.passport_no || '';
    email.value = e.email || '';
    hireDate.value = e.hire_date ? String(e.hire_date).slice(0, 10) : '';
    employmentStatus.value = e.employment_status || 'active';
    if (overtimeEligible) overtimeEligible.value = Number(e.overtime_eligible) === 1 ? '1' : '0';
    departmentId.value = e.department_id ? String(e.department_id) : '';
    syncPositions();
    positionId.value = e.position_id ? String(e.position_id) : '';
    userId.value = e.user_id ? String(e.user_id) : '';
    if (telegramUsername) telegramUsername.value = e.telegram_username || '';
    if (telegramChatId) telegramChatId.value = e.telegram_chat_id || '';
    if (telegramNotifyEnabled) {
      telegramNotifyEnabled.value = Number(e.telegram_notify_enabled) === 0 ? '0' : '1';
    }
    note.value = e.note || '';
    addressLine.value = e.address_line || '';
    currentPhotoPath = e.photo_path || null;
    updatePhotoPreviewFromPath(currentPhotoPath);
  }

  function buildPayload() {
    return {
      first_name: firstName.value,
      last_name: lastName.value,
      birth_date: birthDate.value || null,
      gender: gender.value || null,
      marital_status: maritalStatus.value || null,
      nationality: nationality.value || null,
      salary_currency: salaryCurrency.value,
      salary_amount: salaryAmount.value === '' ? 0 : Number(salaryAmount.value),
      official_salary_amount: officialSalary.value === '' ? 0 : Number(officialSalary.value),
      country: countryCode.value || null,
      region_or_city: regionSelect.value || null,
      address_line: addressLine.value || null,
      phone: phone.value || null,
      phone_secondary: phoneSecondary.value || null,
      identity_no: identityNo.value || null,
      passport_no: passportNo.value || null,
      email: email.value || null,
      hire_date: hireDate.value,
      employment_status: employmentStatus.value,
      overtime_eligible: overtimeEligible?.value === '1' ? 1 : 0,
      department_id: departmentId.value || null,
      position_id: positionId.value || null,
      user_id: userId.value || null,
      telegram_username: telegramUsername?.value || null,
      telegram_chat_id: telegramChatId?.value || null,
      telegram_notify_enabled: telegramNotifyEnabled?.value === '0' ? 0 : 1,
      note: note.value || null,
    };
  }

  function validateRequiredFields() {
    const missing = [];
    if (!String(firstName.value || '').trim()) missing.push(t('hr.emp.firstName'));
    if (!String(lastName.value || '').trim()) missing.push(t('hr.emp.lastName'));
    if (!String(hireDate.value || '').trim()) missing.push(t('hr.emp.hireDate'));
    if (!String(employmentStatus.value || '').trim()) missing.push(t('hr.emp.status'));
    if (!String(departmentId.value || '').trim()) missing.push(t('hr.emp.department'));
    if (!String(positionId.value || '').trim()) missing.push(t('hr.emp.position'));
    if (!String(phone.value || '').trim()) missing.push(t('hr.emp.phone'));
    if (!String(email.value || '').trim()) missing.push(t('hr.emp.email'));
    if (!String(nationality.value || '').trim()) missing.push(t('hr.emp.nationality'));
    if (missing.length) {
      const msg = `Eksik alanlar: ${missing.join(', ')}`;
      showMsg(msg, false);
      showPopup(msg, true);
      return false;
    }
    return true;
  }

  async function uploadPhotoIfAny(empId) {
    if (!photoFile || !photoFile.files || !photoFile.files[0] || !empId) return { ok: true };
    const fd = new FormData();
    fd.append('photo', photoFile.files[0]);
    const res = await window.hrApi(`/api/hr/employees/${encodeURIComponent(empId)}/photo`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok || !res.data?.ok) {
      showMsg(
        (window.i18n?.apiErrorText && window.i18n.apiErrorText(res.data)) || res.data?.message || t('api.hr.photo_invalid'),
        false
      );
      return { ok: false };
    }
    return { ok: true };
  }

  async function saveEmployee(e) {
    e.preventDefault();
    if (!validateRequiredFields()) return;
    const payload = buildPayload();
    const url = editingId ? `/api/hr/employees/${encodeURIComponent(editingId)}` : '/api/hr/employees';
    const method = editingId ? 'PATCH' : 'POST';
    const res = await window.hrApi(url, { method, body: JSON.stringify(payload) });
    if (!res.ok || !res.data?.ok) {
      const errText = (window.i18n?.apiErrorText && window.i18n.apiErrorText(res.data)) || res.data?.message || '—';
      showMsg(errText, false);
      showPopup(errText, true);
      return;
    }
    const newId = editingId || res.data.id;
    const up = await uploadPhotoIfAny(newId);
    if (!up.ok) return;
    showMsg(t('hr.emp.saved'));
    showPopup(t('hr.emp.saved'), false);
    if (!editingId && newId) {
      window.location.href = `/hr-employee-form.html?id=${encodeURIComponent(newId)}`;
      return;
    }
    await loadEmployee();
    if (photoFile) photoFile.value = '';
  }

  async function initHrEmployeeFormPage() {
    await loadDepsAndPositions();
    await loadUsers();
    await loadEmployee();
    countryCode?.addEventListener('change', () => syncRegions(null));
    departmentId?.addEventListener('change', syncPositions);
    salaryAmount?.addEventListener('input', syncUnofficial);
    officialSalary?.addEventListener('input', syncUnofficial);
    photoFile?.addEventListener('change', () => {
      const f = photoFile.files && photoFile.files[0];
      if (f && photoPreview) {
        photoPreview.src = URL.createObjectURL(f);
        photoPreview.style.display = 'inline-block';
        if (photoFallback) photoFallback.style.display = 'none';
      }
    });
    firstName?.addEventListener('input', () => updatePhotoPreviewFromPath(currentPhotoPath));
    lastName?.addEventListener('input', () => updatePhotoPreviewFromPath(currentPhotoPath));
    form?.addEventListener('submit', saveEmployee);
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrEmployeeFormPage = initHrEmployeeFormPage;
})();
