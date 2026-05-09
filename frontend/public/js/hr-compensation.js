(function () {
  const compSearch = document.getElementById('compSearch');
  const compDep = document.getElementById('compDep');
  const btnCompLoad = document.getElementById('btnCompLoad');
  const compHead = document.getElementById('compHead');
  const compBody = document.getElementById('compBody');
  const compMsg = document.getElementById('compMsg');

  let rows = [];
  /** @type {Record<string, number>} employee id -> raise percent */
  const raiseById = {};
  let canEditRaise = false;

  function t(k) {
    return window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(k) : k;
  }

  function showMsg(text, isErr) {
    if (!compMsg) return;
    compMsg.textContent = text || '';
    compMsg.style.color = isErr ? '#b91c1c' : '#166534';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtMoney(val, currency) {
    const c = String(currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
    if (val == null || !Number.isFinite(Number(val))) return '-';
    const n = Number(val);
    const formatted = n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${c}`;
  }

  function parseRaisePct(raw) {
    const s = String(raw == null ? '' : raw).trim().replace(',', '.');
    if (s === '') return 0;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }

  function recValue(base, pct) {
    if (base == null || !Number.isFinite(Number(base))) return null;
    const b = Number(base);
    return b + (b * pct) / 100;
  }

  function updateRecCells(tr, r, pct) {
    if (!tr || !r) return;
    // ORİJİNAL para birimi alanları: tavsiye değer = orijinal × (1 + pct/100)
    const totOrig = r.total_salary_amount;
    const offOrig = r.official_salary_amount;
    const unofOrig = r.unofficial_salary_amount;
    const totOrigCur = r.total_salary_currency || 'UZS';
    const offOrigCur = r.official_salary_currency || totOrigCur;
    const unofOrigCur = r.unofficial_salary_currency || totOrigCur;
    // NORMALIZE alanları: zam orijinal currency üzerinde tanımlı; normalize alanlar
    // backend'den gelen oranları aynen kullanır (zam aynı oranda yansır).
    const totUzs = r.total_salary_uzs;
    const totUsd = r.total_salary_usd;
    const offUzs = r.official_salary_uzs;
    const offUsd = r.official_salary_usd;
    const unofUzs = r.unofficial_salary_uzs;
    const unofUsd = r.unofficial_salary_usd;

    const set = (sel, val, ccy) => {
      const el = tr.querySelector(sel);
      if (!el) return;
      el.textContent = val == null ? '-' : fmtMoney(val, ccy);
    };
    set('.comp-rec-total-orig', recValue(totOrig, pct), totOrigCur);
    set('.comp-rec-off-orig', recValue(offOrig, pct), offOrigCur);
    set('.comp-rec-unof-orig', unofOrig == null ? null : recValue(unofOrig, pct), unofOrigCur);
    set('.comp-rec-total-uzs', totUzs == null ? null : recValue(totUzs, pct), 'UZS');
    set('.comp-rec-total-usd', totUsd == null ? null : recValue(totUsd, pct), 'USD');
    set('.comp-rec-off-uzs', offUzs == null ? null : recValue(offUzs, pct), 'UZS');
    set('.comp-rec-off-usd', offUsd == null ? null : recValue(offUsd, pct), 'USD');
    set('.comp-rec-unof-uzs', unofUzs == null ? null : recValue(unofUzs, pct), 'UZS');
    set('.comp-rec-unof-usd', unofUsd == null ? null : recValue(unofUsd, pct), 'USD');
  }

  async function loadMeFlags() {
    canEditRaise = false;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const u = data && data.user;
      if (!u) return;
      if (u.isSuperAdmin === true) {
        canEditRaise = true;
        return;
      }
      const list = Array.isArray(u.permissions) ? u.permissions : [];
      canEditRaise = list.includes('hr.compensation.edit');
    } catch {
      canEditRaise = false;
    }
  }

  async function loadDepartments() {
    if (!compDep) return;
    const { ok, data } = await window.hrApi('/api/hr/departments');
    if (!ok || !data?.ok) return;
    const deps = data.data?.departments || data.departments || [];
    const cur = compDep.value;
    compDep.innerHTML = `<option value="">${t('hr.emp.filterDept')}</option>`;
    deps.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name;
      compDep.appendChild(o);
    });
    if (cur && [...compDep.options].some((o) => o.value === cur)) compDep.value = cur;
  }

  function renderHead() {
    if (!compHead) return;
    const th = (k, cls, extra) => `<th class="${cls || ''}" data-i18n="${k}"${extra || ''}>${t(k)}</th>`;
    // İki grup: ORİJİNAL (kaydedilmiş para birimi) + NORMALIZE (USD/UZS rapor alanları)
    const groupRow = `
      <tr class="comp-group-row">
        <th class="comp-col-photo" rowspan="2"></th>
        <th class="comp-name comp-col-name" rowspan="2" data-i18n="hr.compensation.col.name">${t('hr.compensation.col.name')}</th>
        <th class="comp-group-orig" colspan="3" data-i18n="hr.compensation.group.original">${t('hr.compensation.group.original')}</th>
        <th class="comp-group-norm" colspan="6" data-i18n="hr.compensation.group.normalized">${t('hr.compensation.group.normalized')}</th>
        <th class="comp-num comp-col-raise" rowspan="2" data-i18n="hr.compensation.col.raisePct">${t('hr.compensation.col.raisePct')}</th>
        <th class="comp-group-orig" colspan="3" data-i18n="hr.compensation.group.original">${t('hr.compensation.group.original')}</th>
        <th class="comp-group-norm" colspan="6" data-i18n="hr.compensation.group.normalized">${t('hr.compensation.group.normalized')}</th>
      </tr>
    `;
    const detailRow = `
      <tr class="comp-detail-row">
        ${th('hr.compensation.col.totalOriginal', 'comp-num')}
        ${th('hr.compensation.col.officialOriginal', 'comp-num')}
        ${th('hr.compensation.col.unofficialOriginal', 'comp-num')}
        ${th('hr.compensation.col.totalUzs', 'comp-num')}
        ${th('hr.compensation.col.totalUsd', 'comp-num')}
        ${th('hr.compensation.col.officialUzs', 'comp-num')}
        ${th('hr.compensation.col.officialUsd', 'comp-num')}
        ${th('hr.compensation.col.unofficialUzs', 'comp-num')}
        ${th('hr.compensation.col.unofficialUsd', 'comp-num')}
        ${th('hr.compensation.col.totalOriginal', 'comp-num')}
        ${th('hr.compensation.col.officialOriginal', 'comp-num')}
        ${th('hr.compensation.col.unofficialOriginal', 'comp-num')}
        ${th('hr.compensation.col.totalUzs', 'comp-num')}
        ${th('hr.compensation.col.totalUsd', 'comp-num')}
        ${th('hr.compensation.col.officialUzs', 'comp-num')}
        ${th('hr.compensation.col.officialUsd', 'comp-num')}
        ${th('hr.compensation.col.unofficialUzs', 'comp-num')}
        ${th('hr.compensation.col.unofficialUsd', 'comp-num')}
      </tr>
    `;
    compHead.innerHTML = groupRow + detailRow;
    if (window.i18n && window.i18n.apply) window.i18n.apply(compHead);
  }

  function photoCell(r) {
    const path = r.photo_path ? String(r.photo_path).replace(/^\/+/, '') : '';
    if (path) {
      return `<img class="comp-photo" src="/uploads/${esc(path)}" alt="" loading="lazy" />`;
    }
    const initials = String(r.person_name || '?')
      .trim()
      .split(/\s+/)
      .map((x) => x[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return `<div class="comp-photo-ph">${esc(initials || '?')}</div>`;
  }

  function renderBody() {
    if (!compBody) return;
    if (!rows.length) {
      compBody.innerHTML = `<tr><td colspan="99" class="muted">${t('hr.compensation.empty')}</td></tr>`;
      return;
    }
    compBody.innerHTML = rows
      .map((r) => {
        const id = String(r.id);
        const pct = raiseById[id] != null ? raiseById[id] : 0;

        // ORİJİNAL para birimi alanları
        const totOrig = r.total_salary_amount;
        const offOrig = r.official_salary_amount;
        const unofOrig = r.unofficial_salary_amount;
        const totOrigCur = r.total_salary_currency || 'UZS';
        const offOrigCur = r.official_salary_currency || totOrigCur;
        const unofOrigCur = r.unofficial_salary_currency || totOrigCur;
        // NORMALIZE rapor alanları (backend'den geliyor; eksikse null)
        const totUzs = r.total_salary_uzs;
        const totUsd = r.total_salary_usd;
        const offUzs = r.official_salary_uzs;
        const offUsd = r.official_salary_usd;
        const unofUzs = r.unofficial_salary_uzs;
        const unofUsd = r.unofficial_salary_usd;

        const ro = !canEditRaise ? ' readonly' : '';
        const raiseVal = pct === 0 ? '' : String(pct).replace('.', ',');
        const raiseInput = `<input type="text" class="comp-raise x-raise" inputmode="decimal" autocomplete="off" data-id="${esc(id)}" value="${esc(raiseVal)}" title="${esc(t('hr.compensation.raiseHint'))}"${ro} />`;

        const cellOrNull = (val, ccy, cls) =>
          `<td class="comp-num ${cls || ''}">${val == null ? '-' : esc(fmtMoney(val, ccy))}</td>`;

        let html = `<tr data-id="${esc(id)}">
        <td class="comp-col-photo">${photoCell(r)}</td>
        <td class="comp-name comp-col-name">${esc(r.person_name || '-')}</td>`;

        // === Mevcut: Orijinal grup ===
        html += cellOrNull(totOrig, totOrigCur);
        html += cellOrNull(offOrig, offOrigCur);
        html += cellOrNull(unofOrig, unofOrigCur);
        // === Mevcut: Normalize grup ===
        html += cellOrNull(totUzs, 'UZS');
        html += cellOrNull(totUsd, 'USD');
        html += cellOrNull(offUzs, 'UZS');
        html += cellOrNull(offUsd, 'USD');
        html += cellOrNull(unofUzs, 'UZS');
        html += cellOrNull(unofUsd, 'USD');

        // === Zam ===
        html += `<td class="comp-num comp-col-raise">${raiseInput}</td>`;

        // === Tavsiye: Orijinal grup ===
        html += cellOrNull(recValue(totOrig, pct), totOrigCur, 'comp-rec-total-orig');
        html += cellOrNull(recValue(offOrig, pct), offOrigCur, 'comp-rec-off-orig');
        html += cellOrNull(unofOrig == null ? null : recValue(unofOrig, pct), unofOrigCur, 'comp-rec-unof-orig');
        // === Tavsiye: Normalize grup ===
        html += cellOrNull(totUzs == null ? null : recValue(totUzs, pct), 'UZS', 'comp-rec-total-uzs');
        html += cellOrNull(totUsd == null ? null : recValue(totUsd, pct), 'USD', 'comp-rec-total-usd');
        html += cellOrNull(offUzs == null ? null : recValue(offUzs, pct), 'UZS', 'comp-rec-off-uzs');
        html += cellOrNull(offUsd == null ? null : recValue(offUsd, pct), 'USD', 'comp-rec-off-usd');
        html += cellOrNull(unofUzs == null ? null : recValue(unofUzs, pct), 'UZS', 'comp-rec-unof-uzs');
        html += cellOrNull(unofUsd == null ? null : recValue(unofUsd, pct), 'USD', 'comp-rec-unof-usd');

        html += '</tr>';
        return html;
      })
      .join('');
  }

  async function loadRows() {
    showMsg('', false);
    const qs = new URLSearchParams();
    if (compSearch?.value && String(compSearch.value).trim()) qs.set('search', String(compSearch.value).trim());
    if (compDep?.value) qs.set('departmentId', compDep.value);
    const { ok, data } = await window.hrApi(`/api/hr/compensation/employees?${qs.toString()}`);
    if (!ok || !data?.ok) {
      showMsg((window.i18n?.apiErrorText && window.i18n.apiErrorText(data)) || data?.message || t('hr.compensation.loadFailed'), true);
      rows = [];
      renderHead();
      renderBody();
      return;
    }
    const payload = data.data || data;
    rows = payload.rows || [];
    rows.forEach((r) => {
      const id = String(r.id);
      if (raiseById[id] === undefined) raiseById[id] = 0;
    });
    renderHead();
    renderBody();
  }

  async function initHrCompensationPage() {
    await loadMeFlags();
    await loadDepartments();
    compBody?.addEventListener('input', (e) => {
      const inp = e.target.closest('.x-raise');
      if (!inp || inp.readOnly) return;
      const id = inp.getAttribute('data-id');
      if (!id) return;
      const normalized = String(inp.value || '').replace(',', '.');
      if (normalized !== '' && Number(normalized) < 0) {
        inp.value = '';
        raiseById[id] = 0;
      } else {
        raiseById[id] = parseRaisePct(inp.value);
      }
      const tr = inp.closest('tr[data-id]');
      const row = rows.find((x) => String(x.id) === id);
      if (tr && row) updateRecCells(tr, row, raiseById[id]);
    });
    compBody?.addEventListener('focusout', (e) => {
      const inp = e.target.closest('.x-raise');
      if (!inp || inp.readOnly) return;
      const id = inp.getAttribute('data-id');
      if (!id) return;
      const pct = parseRaisePct(inp.value);
      raiseById[id] = pct;
      inp.value = pct === 0 ? '' : String(pct).replace('.', ',');
    });
    btnCompLoad?.addEventListener('click', loadRows);
    await loadRows();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
  }

  window.initHrCompensationPage = initHrCompensationPage;
})();
