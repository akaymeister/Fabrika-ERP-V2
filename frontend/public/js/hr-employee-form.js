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
  const officialSalaryCurrency = document.getElementById('officialSalaryCurrency');
  const officialSalaryFx = document.getElementById('officialSalaryFx');
  const unofficialSalary = document.getElementById('unofficialSalary');
  const salaryFxHint = document.getElementById('salaryFxHint');
  const salaryFxErr = document.getElementById('salaryFxErr');
  const officialCurrencyLockHint = document.getElementById('officialCurrencyLockHint');
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

  const btnOpenRevision = document.getElementById('btnOpenRevision');
  const salaryReadonlyHint = document.getElementById('salaryReadonlyHint');
  const compHistorySection = document.getElementById('compHistorySection');
  const compHistoryBody = document.getElementById('compHistoryBody');
  const revisionModalBackdrop = document.getElementById('revisionModalBackdrop');
  const revisionModalCancel = document.getElementById('revisionModalCancel');
  const revisionModalSubmit = document.getElementById('revisionModalSubmit');
  const revEffectiveFrom = document.getElementById('revEffectiveFrom');
  const revReason = document.getElementById('revReason');
  const revSalaryAmount = document.getElementById('revSalaryAmount');
  const revSalaryCurrency = document.getElementById('revSalaryCurrency');
  const revOfficialSalary = document.getElementById('revOfficialSalary');
  const revOfficialSalaryCurrency = document.getElementById('revOfficialSalaryCurrency');
  const revOfficialSalaryFx = document.getElementById('revOfficialSalaryFx');
  const revUnofficialSalary = document.getElementById('revUnofficialSalary');
  const revSalaryFxHint = document.getElementById('revSalaryFxHint');
  const revSalaryFxErr = document.getElementById('revSalaryFxErr');
  const revOfficialCurrencyLockHint = document.getElementById('revOfficialCurrencyLockHint');

  const params = new URLSearchParams(window.location.search);
  const editingId = params.get('id');

  let departments = [];
  let positions = [];
  let users = [];
  let currentPhotoPath = null;
  let canSalaryEdit = false;
  let canHistoryView = false;
  let _revWagePreviewTimer = null;
  let _revWagePreviewSeq = 0;
  let _lastRevisionBreakdown = null;

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

  async function loadHrFormPermissions() {
    canSalaryEdit = false;
    canHistoryView = false;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const u = data && data.user;
      if (!u) return;
      if (u.isSuperAdmin === true) {
        canSalaryEdit = true;
        canHistoryView = true;
        return;
      }
      const list = Array.isArray(u.permissions) ? u.permissions : [];
      canSalaryEdit = list.includes('hr.salary.edit');
      canHistoryView = list.includes('hr.salary.history_view');
    } catch (_) {
      /* ignore */
    }
  }

  function setSalaryFieldsReadonly(ro) {
    [salaryAmount, officialSalary, officialSalaryFx].forEach((el) => {
      if (!el) return;
      el.readOnly = ro;
      el.classList.toggle('is-readonly', ro);
    });
    if (salaryCurrency) salaryCurrency.disabled = ro;
    if (officialSalaryCurrency) officialSalaryCurrency.disabled = ro;
  }

  function refreshSalaryEditChrome() {
    const isEdit = !!editingId;
    if (isEdit) {
      setSalaryFieldsReadonly(true);
      if (salaryReadonlyHint) {
        salaryReadonlyHint.classList.remove('is-hidden');
        const hintKey = canSalaryEdit ? 'hr.emp.salaryReadonlyHint' : 'hr.emp.salaryReadonlyNoPermHint';
        salaryReadonlyHint.removeAttribute('data-i18n');
        salaryReadonlyHint.textContent = t(hintKey);
      }
    } else {
      setSalaryFieldsReadonly(false);
      salaryReadonlyHint?.classList.add('is-hidden');
    }
    if (btnOpenRevision) {
      if (isEdit && canSalaryEdit) btnOpenRevision.classList.remove('is-hidden');
      else btnOpenRevision.classList.add('is-hidden');
    }
    if (compHistorySection) {
      if (isEdit && canHistoryView) compHistorySection.classList.remove('is-hidden');
      else compHistorySection.classList.add('is-hidden');
    }
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderCompensationHistoryTable(rows) {
    if (!compHistoryBody) return;
    if (!rows || !rows.length) {
      compHistoryBody.innerHTML = `<tr><td colspan="5" class="muted">${escHtml(t('hr.emp.compHistoryEmpty'))}</td></tr>`;
      return;
    }
    compHistoryBody.innerHTML = rows
      .map((r) => {
        const from = r.effective_from ? String(r.effective_from).slice(0, 10) : '-';
        const to = r.effective_to ? String(r.effective_to).slice(0, 10) : '—';
        const sc = String(r.salary_currency || '').toUpperCase();
        const total = `${fmtTrMoney(Number(r.salary_amount), 2)} ${escHtml(sc)}`;
        const oc = String(r.official_salary_currency || '').toUpperCase();
        const off = `${fmtTrMoney(Number(r.official_salary_amount), 2)} ${escHtml(oc)}`;
        const reason = escHtml(r.reason || '');
        return `<tr><td>${escHtml(from)}</td><td>${escHtml(to)}</td><td>${total}</td><td>${off}</td><td>${reason}</td></tr>`;
      })
      .join('');
  }

  async function loadCompensationHistory() {
    if (!compHistoryBody || !editingId || !canHistoryView) return;
    const res = await fetch(`/api/hr/employees/${encodeURIComponent(editingId)}/compensation-history`, {
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      compHistoryBody.innerHTML = `<tr><td colspan="5" class="muted">${escHtml(t('hr.att.loadFailed'))}</td></tr>`;
      return;
    }
    const rows = data.rows || [];
    renderCompensationHistoryTable(rows);
  }

  /**
   * Dil seçimi (i18n.js) loadDict + apply tamamlandıktan sonra (macrotask):
   * salt okunur ipucu, maaş FX ipuçları, revizyon modalı ve geçmiş tablo başlıkları güncellenir.
   */
  async function applyEmployeeFormDynamicI18n() {
    refreshSalaryEditChrome();
    if (window.i18n && typeof window.i18n.apply === 'function') {
      if (compHistorySection) window.i18n.apply(compHistorySection);
      if (revisionModalBackdrop) window.i18n.apply(revisionModalBackdrop);
    }
    syncOfficialSalaryAuxFields();
    schedulePreview();
    syncRevOfficialSalaryAuxFields();
    scheduleRevPreview();
    await loadCompensationHistory();
  }

  function bindLanguageSelectForEmpFormI18n() {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect || languageSelect.dataset.empFormLangBound === '1') return;
    languageSelect.dataset.empFormLangBound = '1';
    languageSelect.addEventListener('change', () => {
      window.setTimeout(() => {
        void applyEmployeeFormDynamicI18n();
      }, 0);
    });
  }

  function closeRevisionModal() {
    if (!revisionModalBackdrop) return;
    revisionModalBackdrop.classList.remove('is-open');
    revisionModalBackdrop.setAttribute('aria-hidden', 'true');
  }

  function setRevSalaryFxState(fxApplicable) {
    if (revOfficialSalaryFx) {
      if (fxApplicable) {
        revOfficialSalaryFx.removeAttribute('readonly');
        revOfficialSalaryFx.classList.remove('is-readonly');
      } else {
        revOfficialSalaryFx.setAttribute('readonly', 'readonly');
        revOfficialSalaryFx.classList.add('is-readonly');
        setMoneyValue(revOfficialSalaryFx, 1, 2);
      }
    }
    if (revSalaryFxHint) {
      const k = fxApplicable ? 'hr.emp.salaryFxStandard' : 'hr.emp.salaryFxAuto';
      revSalaryFxHint.setAttribute('data-i18n', k);
      revSalaryFxHint.textContent = t(k);
    }
  }

  function clearRevSalaryError() {
    if (revSalaryFxErr) revSalaryFxErr.textContent = '';
  }

  function setRevSalaryError(messageKey) {
    if (!revSalaryFxErr) return;
    if (!messageKey) {
      revSalaryFxErr.textContent = '';
      return;
    }
    const txt = t(messageKey);
    revSalaryFxErr.textContent = txt && txt !== messageKey ? txt : messageKey;
  }

  function applyRevBreakdownToUI(breakdown) {
    _lastRevisionBreakdown = breakdown || null;
    if (!breakdown) {
      setMoneyValue(revUnofficialSalary, 0, 2);
      setRevSalaryError(null);
      return;
    }
    setRevSalaryFxState(!!breakdown.fx_applicable);
    if (breakdown.unofficial_salary_amount != null) {
      setMoneyValue(revUnofficialSalary, Number(breakdown.unofficial_salary_amount), 2);
    } else {
      setMoneyValue(revUnofficialSalary, 0, 2);
    }
    if (Array.isArray(breakdown.errors) && breakdown.errors.length) {
      setRevSalaryError(breakdown.errors[0].messageKey || 'api.hr.salary_amount_invalid');
    } else {
      clearRevSalaryError();
    }
  }

  async function fetchRevWagePreview() {
    const seq = ++_revWagePreviewSeq;
    const mainCur = revSalaryCurrency?.value === 'USD' ? 'USD' : 'UZS';
    const offAmt = readMoney(revOfficialSalary);
    const pos = offAmt > 0;
    const offCur = pos ? (revOfficialSalaryCurrency?.value === 'USD' ? 'USD' : 'UZS') : mainCur;
    const sameCurrency = mainCur === offCur;
    const fxRaw = revOfficialSalaryFx ? parseTrDecimal(revOfficialSalaryFx.value) : null;
    const payload = {
      salary_amount: readMoney(revSalaryAmount),
      salary_currency: mainCur,
      official_salary_amount: offAmt,
      official_salary_currency: offCur,
      official_salary_fx_rate: sameCurrency ? 1 : Number.isFinite(fxRaw) && fxRaw > 0 ? fxRaw : null,
    };
    try {
      const res = await window.hrApi('/api/hr/wage/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (seq !== _revWagePreviewSeq) return;
      const breakdown = res?.data?.data?.breakdown || res?.data?.breakdown || null;
      applyRevBreakdownToUI(breakdown);
    } catch (_) {
      if (seq !== _revWagePreviewSeq) return;
    }
  }

  function scheduleRevPreview() {
    if (_revWagePreviewTimer) clearTimeout(_revWagePreviewTimer);
    _revWagePreviewTimer = setTimeout(fetchRevWagePreview, 250);
  }

  function applyRevCurrencyParityVisuals() {
    const sameCurrency = (revSalaryCurrency?.value || 'UZS') === (revOfficialSalaryCurrency?.value || 'UZS');
    setRevSalaryFxState(!sameCurrency);
  }

  function syncRevOfficialSalaryAuxFields() {
    const mainCur = revSalaryCurrency?.value === 'USD' ? 'USD' : 'UZS';
    const offAmt = readMoney(revOfficialSalary);
    const pos = offAmt > 0;
    if (revOfficialSalaryCurrency) {
      revOfficialSalaryCurrency.disabled = !pos;
      revOfficialSalaryCurrency.classList.toggle('is-readonly', !pos);
      if (!pos) {
        revOfficialSalaryCurrency.value = mainCur;
      }
    }
    if (!pos && revOfficialSalaryFx) {
      setMoneyValue(revOfficialSalaryFx, 1, 2);
    }
    if (revOfficialCurrencyLockHint) {
      revOfficialCurrencyLockHint.classList.toggle('is-hidden', pos);
      if (window.i18n && window.i18n.apply) window.i18n.apply(revOfficialCurrencyLockHint);
    }
    if (pos) {
      applyRevCurrencyParityVisuals();
    } else {
      setRevSalaryFxState(false);
    }
  }

  function openRevisionModal() {
    if (!editingId || !canSalaryEdit || !revisionModalBackdrop) return;
    revSalaryCurrency.value = salaryCurrency.value === 'USD' ? 'USD' : 'UZS';
    setMoneyValue(revSalaryAmount, readMoney(salaryAmount), 2);
    setMoneyValue(revOfficialSalary, readMoney(officialSalary), 2);
    if (revOfficialSalaryCurrency) {
      revOfficialSalaryCurrency.value = officialSalaryCurrency.value === 'USD' ? 'USD' : 'UZS';
    }
    const fx = officialSalaryFx ? parseTrDecimal(officialSalaryFx.value) : 1;
    setMoneyValue(revOfficialSalaryFx, Number.isFinite(fx) && fx > 0 ? fx : 1, 2);
    if (revEffectiveFrom) {
      revEffectiveFrom.value = new Date().toISOString().slice(0, 10);
    }
    if (revReason) revReason.value = '';
    _lastRevisionBreakdown = null;
    clearRevSalaryError();
    syncRevOfficialSalaryAuxFields();
    scheduleRevPreview();
    revisionModalBackdrop.classList.add('is-open');
    revisionModalBackdrop.setAttribute('aria-hidden', 'false');
    if (window.i18n && window.i18n.apply) window.i18n.apply(revisionModalBackdrop);
  }

  async function submitRevisionModal() {
    if (!editingId) return;
    if (!revEffectiveFrom?.value || !String(revEffectiveFrom.value).trim()) {
      showPopup(t('api.hr.compensation_revision_effective_required'), true);
      return;
    }
    if (!revReason?.value || !String(revReason.value).trim()) {
      showPopup(t('api.hr.compensation_revision_reason_required'), true);
      return;
    }
    if (_lastRevisionBreakdown && Array.isArray(_lastRevisionBreakdown.errors) && _lastRevisionBreakdown.errors.length) {
      const k = _lastRevisionBreakdown.errors[0].messageKey || 'api.hr.salary_amount_invalid';
      showPopup(t(k) !== k ? t(k) : k, true);
      return;
    }
    const mainCur = revSalaryCurrency?.value === 'USD' ? 'USD' : 'UZS';
    const offAmt = readMoney(revOfficialSalary);
    const pos = offAmt > 0;
    const offCur = pos ? (revOfficialSalaryCurrency?.value === 'USD' ? 'USD' : 'UZS') : mainCur;
    const sameCurrency = mainCur === offCur;
    const fxRaw = revOfficialSalaryFx ? parseTrDecimal(revOfficialSalaryFx.value) : null;
    const fxVal = sameCurrency ? 1 : Number.isFinite(fxRaw) && fxRaw > 0 ? fxRaw : 1;
    const body = {
      effective_from: String(revEffectiveFrom.value).trim().slice(0, 10),
      reason: revReason.value.trim(),
      salary_amount: readMoney(revSalaryAmount),
      salary_currency: mainCur,
      official_salary_amount: offAmt,
      official_salary_currency: offCur,
      official_salary_fx_rate: fxVal,
    };
    const res = await window.hrApi(`/api/hr/employees/${encodeURIComponent(editingId)}/compensation-revisions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.data?.ok) {
      const errText = (window.i18n?.apiErrorText && window.i18n.apiErrorText(res.data)) || res.data?.message || '—';
      showPopup(errText, true);
      return;
    }
    closeRevisionModal();
    showMsg(t('hr.emp.revisionSaved'));
    showPopup(t('hr.emp.revisionSaved'), false);
    await loadEmployee();
    await loadCompensationHistory();
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

  /**
   * Locale ondalık parser: "1.000.000,52" veya "1000000.52" → 1000000.52
   * Boş / hatalı değer → null.
   */
  function parseTrDecimal(raw) {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s) return null;
    s = s.replace(/\s/g, '');
    const hasComma = s.indexOf(',') >= 0;
    const hasDot = s.indexOf('.') >= 0;
    if (hasComma && hasDot) {
      // "1.234,56" → "1234.56"
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      // "1234,56" → "1234.56"
      s = s.replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function fmtTrMoney(value, decimals) {
    const n = Number(value);
    const d = Number.isFinite(decimals) ? decimals : 2;
    if (!Number.isFinite(n)) return d > 0 ? '0,' + '0'.repeat(d) : '0';
    return n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function setMoneyValue(el, value, decimals) {
    if (!el) return;
    el.value = fmtTrMoney(value, decimals);
  }

  function readMoney(el) {
    if (!el) return 0;
    const n = parseTrDecimal(el.value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function attachMoneyFormatter(el, decimals) {
    if (!el) return;
    el.addEventListener('focus', () => {
      const n = parseTrDecimal(el.value);
      if (Number.isFinite(n)) el.value = String(n).replace('.', ',');
    });
    el.addEventListener('blur', () => {
      setMoneyValue(el, parseTrDecimal(el.value), decimals);
    });
  }

  // ---------------------------------------------------------------------------
  //  Maaş preview: Frontend bağımsız hesap motoru DEĞİL.
  //  Tüm rakamlar /api/hr/wage/preview üzerinden TEK backend motorundan gelir.
  // ---------------------------------------------------------------------------
  let _wagePreviewTimer = null;
  let _wagePreviewSeq = 0;
  let _lastBreakdown = null;

  function setSalaryFxState(fxApplicable) {
    if (officialSalaryFx) {
      if (fxApplicable) {
        officialSalaryFx.removeAttribute('readonly');
        officialSalaryFx.classList.remove('is-readonly');
      } else {
        officialSalaryFx.setAttribute('readonly', 'readonly');
        officialSalaryFx.classList.add('is-readonly');
        // Aynı currency: kur otomatik 1
        setMoneyValue(officialSalaryFx, 1, 2);
      }
    }
    if (salaryFxHint) {
      const k = fxApplicable ? 'hr.emp.salaryFxStandard' : 'hr.emp.salaryFxAuto';
      salaryFxHint.setAttribute('data-i18n', k);
      salaryFxHint.textContent = t(k);
    }
  }

  function clearSalaryError() {
    if (salaryFxErr) salaryFxErr.textContent = '';
  }

  function setSalaryError(messageKey) {
    if (!salaryFxErr) return;
    if (!messageKey) {
      salaryFxErr.textContent = '';
      return;
    }
    const txt = t(messageKey);
    salaryFxErr.textContent = txt && txt !== messageKey ? txt : messageKey;
  }

  function applyBreakdownToUI(breakdown) {
    _lastBreakdown = breakdown || null;
    if (!breakdown) {
      setMoneyValue(unofficialSalary, 0, 2);
      setSalaryError(null);
      return;
    }
    setSalaryFxState(!!breakdown.fx_applicable);
    if (breakdown.unofficial_salary_amount != null) {
      setMoneyValue(unofficialSalary, Number(breakdown.unofficial_salary_amount), 2);
    } else {
      setMoneyValue(unofficialSalary, 0, 2);
    }
    if (Array.isArray(breakdown.errors) && breakdown.errors.length) {
      setSalaryError(breakdown.errors[0].messageKey || 'api.hr.salary_amount_invalid');
    } else {
      clearSalaryError();
    }
  }

  async function fetchWagePreview() {
    const seq = ++_wagePreviewSeq;
    const mainCur = salaryCurrency?.value === 'USD' ? 'USD' : 'UZS';
    const offAmt = readMoney(officialSalary);
    const pos = offAmt > 0;
    const offCur = pos ? (officialSalaryCurrency?.value === 'USD' ? 'USD' : 'UZS') : mainCur;
    const sameCurrency = mainCur === offCur;
    const fxRaw = officialSalaryFx ? parseTrDecimal(officialSalaryFx.value) : null;
    const payload = {
      salary_amount: readMoney(salaryAmount),
      salary_currency: mainCur,
      official_salary_amount: offAmt,
      official_salary_currency: offCur,
      official_salary_fx_rate: sameCurrency ? 1 : Number.isFinite(fxRaw) && fxRaw > 0 ? fxRaw : null,
    };
    try {
      const res = await window.hrApi('/api/hr/wage/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (seq !== _wagePreviewSeq) return; // race koruması
      const breakdown = res?.data?.data?.breakdown || res?.data?.breakdown || null;
      applyBreakdownToUI(breakdown);
    } catch (_) {
      if (seq !== _wagePreviewSeq) return;
      // Sessizce başarısız: kullanıcı yazmaya devam edebilir, kayıt sırasında backend yine doğrular.
    }
  }

  function schedulePreview() {
    if (_wagePreviewTimer) clearTimeout(_wagePreviewTimer);
    _wagePreviewTimer = setTimeout(fetchWagePreview, 250);
  }

  function applyCurrencyParityVisuals() {
    const sameCurrency = (salaryCurrency?.value || 'UZS') === (officialSalaryCurrency?.value || 'UZS');
    setSalaryFxState(!sameCurrency);
  }

  /** Resmi tutar > 0 değilse resmi para birimi = ana maaş birimi, kur 1; seçim kilitlenir. */
  function syncOfficialSalaryAuxFields() {
    const mainCur = salaryCurrency?.value === 'USD' ? 'USD' : 'UZS';
    const offAmt = readMoney(officialSalary);
    const pos = offAmt > 0;
    if (officialSalaryCurrency) {
      officialSalaryCurrency.disabled = !pos;
      officialSalaryCurrency.classList.toggle('is-readonly', !pos);
      if (!pos) {
        officialSalaryCurrency.value = mainCur;
      }
    }
    if (!pos && officialSalaryFx) {
      setMoneyValue(officialSalaryFx, 1, 2);
    }
    if (officialCurrencyLockHint) {
      officialCurrencyLockHint.classList.toggle('is-hidden', pos);
      if (window.i18n && window.i18n.apply) window.i18n.apply(officialCurrencyLockHint);
    }
    if (pos) {
      applyCurrencyParityVisuals();
    } else {
      setSalaryFxState(false);
    }
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
      refreshSalaryEditChrome();
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
    setMoneyValue(salaryAmount, e.salary_amount != null ? Number(e.salary_amount) : 0, 2);
    setMoneyValue(officialSalary, e.official_salary_amount != null ? Number(e.official_salary_amount) : 0, 2);
    if (officialSalaryCurrency) {
      const oc = String(e.official_salary_currency || '').toUpperCase();
      officialSalaryCurrency.value = oc === 'USD' || oc === 'UZS' ? oc : (e.salary_currency === 'USD' ? 'USD' : 'UZS');
    }
    if (officialSalaryFx) {
      const fx = e.official_salary_fx_rate != null ? Number(e.official_salary_fx_rate) : 1;
      setMoneyValue(officialSalaryFx, Number.isFinite(fx) && fx > 0 ? fx : 1, 2);
    }
    // Backend'in döndürdüğü resmi olmayan maaş varsa önce onu basıp, sonra preview ile doğrula.
    if (e.unofficial_salary_amount != null) {
      setMoneyValue(unofficialSalary, Number(e.unofficial_salary_amount), 2);
    }
    syncOfficialSalaryAuxFields();
    schedulePreview();
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
    refreshSalaryEditChrome();
  }

  function buildPayload() {
    const base = {
      first_name: firstName.value,
      last_name: lastName.value,
      birth_date: birthDate.value || null,
      gender: gender.value || null,
      marital_status: maritalStatus.value || null,
      nationality: nationality.value || null,
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
    if (editingId) return base;
    return {
      ...base,
      salary_currency: salaryCurrency.value,
      salary_amount: readMoney(salaryAmount),
      official_salary_amount: readMoney(officialSalary),
      official_salary_currency: (() => {
        const main = salaryCurrency.value === 'USD' ? 'USD' : 'UZS';
        const oa = readMoney(officialSalary);
        if (!(oa > 0)) return main;
        return officialSalaryCurrency ? (officialSalaryCurrency.value === 'USD' ? 'USD' : 'UZS') : main;
      })(),
      official_salary_fx_rate: (() => {
        const main = salaryCurrency.value === 'USD' ? 'USD' : 'UZS';
        const oa = readMoney(officialSalary);
        if (!(oa > 0)) return 1;
        const oc = officialSalaryCurrency ? (officialSalaryCurrency.value === 'USD' ? 'USD' : 'UZS') : main;
        if (main === oc) return 1;
        const v = officialSalaryFx ? parseTrDecimal(officialSalaryFx.value) : null;
        return Number.isFinite(v) && v > 0 ? v : 1;
      })(),
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
    // Yeni personelde maaş POST ile gider; düzenlemede PATCH maaş içermez.
    if (!editingId && _lastBreakdown && Array.isArray(_lastBreakdown.errors) && _lastBreakdown.errors.length) {
      const k = _lastBreakdown.errors[0].messageKey || 'api.hr.salary_amount_invalid';
      const txt = t(k);
      showMsg(txt && txt !== k ? txt : k, false);
      showPopup(txt && txt !== k ? txt : k, true);
      return;
    }
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
    await loadCompensationHistory();
    if (photoFile) photoFile.value = '';
  }

  async function initHrEmployeeFormPage() {
    await loadHrFormPermissions();
    await loadDepsAndPositions();
    await loadUsers();
    await loadEmployee();
    await loadCompensationHistory();
    countryCode?.addEventListener('change', () => syncRegions(null));
    departmentId?.addEventListener('change', syncPositions);
    // Frontend manuel maaş matematiği yapmıyor; tüm hesap backend'den geliyor.
    salaryAmount?.addEventListener('input', () => {
      syncOfficialSalaryAuxFields();
      schedulePreview();
    });
    officialSalary?.addEventListener('input', () => {
      syncOfficialSalaryAuxFields();
      schedulePreview();
    });
    officialSalary?.addEventListener('blur', () => {
      syncOfficialSalaryAuxFields();
      schedulePreview();
    });
    officialSalaryFx?.addEventListener('input', schedulePreview);
    salaryCurrency?.addEventListener('change', () => {
      syncOfficialSalaryAuxFields();
      schedulePreview();
    });
    officialSalaryCurrency?.addEventListener('change', () => {
      applyCurrencyParityVisuals();
      schedulePreview();
    });
    attachMoneyFormatter(salaryAmount, 2);
    attachMoneyFormatter(officialSalary, 2);
    attachMoneyFormatter(officialSalaryFx, 2);
    syncOfficialSalaryAuxFields();
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

    btnOpenRevision?.addEventListener('click', openRevisionModal);
    revisionModalCancel?.addEventListener('click', closeRevisionModal);
    revisionModalSubmit?.addEventListener('click', () => {
      submitRevisionModal();
    });
    revisionModalBackdrop?.addEventListener('click', (ev) => {
      if (ev.target === revisionModalBackdrop) closeRevisionModal();
    });
    const revDialog = revisionModalBackdrop?.querySelector('.emp-revision-modal');
    revDialog?.addEventListener('click', (ev) => ev.stopPropagation());

    attachMoneyFormatter(revSalaryAmount, 2);
    attachMoneyFormatter(revOfficialSalary, 2);
    attachMoneyFormatter(revOfficialSalaryFx, 2);
    revSalaryAmount?.addEventListener('input', () => {
      syncRevOfficialSalaryAuxFields();
      scheduleRevPreview();
    });
    revOfficialSalary?.addEventListener('input', () => {
      syncRevOfficialSalaryAuxFields();
      scheduleRevPreview();
    });
    revOfficialSalary?.addEventListener('blur', () => {
      syncRevOfficialSalaryAuxFields();
      scheduleRevPreview();
    });
    revOfficialSalaryFx?.addEventListener('input', scheduleRevPreview);
    revSalaryCurrency?.addEventListener('change', () => {
      syncRevOfficialSalaryAuxFields();
      scheduleRevPreview();
    });
    revOfficialSalaryCurrency?.addEventListener('change', () => {
      applyRevCurrencyParityVisuals();
      scheduleRevPreview();
    });
    syncRevOfficialSalaryAuxFields();

    bindLanguageSelectForEmpFormI18n();

    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrEmployeeFormPage = initHrEmployeeFormPage;
})();
