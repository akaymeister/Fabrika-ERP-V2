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
    const off = r.official_salary_uzs;
    const uuz = r.unofficial_salary_uzs;
    const uusd = r.unofficial_salary_usd;
    const tot = r.total_salary_amount;
    const cur = r.total_salary_currency || 'UZS';
    const rOff = recValue(off, pct);
    const rUuz = uuz == null ? null : recValue(uuz, pct);
    const rUusd = uusd == null ? null : recValue(uusd, pct);
    const rTot = recValue(tot, pct);

    const set = (sel, val, ccy) => {
      const el = tr.querySelector(sel);
      if (!el) return;
      el.textContent = val == null ? '-' : fmtMoney(val, ccy);
    };
    set('.comp-rec-official', rOff, 'UZS');
    set('.comp-rec-uuz', rUuz, 'UZS');
    set('.comp-rec-uusd', rUusd, 'USD');
    set('.comp-rec-total', rTot, cur);
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
    const th = (k, cls) => `<th class="${cls || ''}" data-i18n="${k}">${t(k)}</th>`;
    const cells = [
      th('hr.compensation.col.photo', 'comp-col-photo'),
      th('hr.compensation.col.name', 'comp-name comp-col-name'),
      th('hr.compensation.col.official', 'comp-num'),
      th('hr.compensation.col.unofficialUzs', 'comp-num'),
      th('hr.compensation.col.unofficialUsd', 'comp-num'),
      th('hr.compensation.col.total', 'comp-num'),
    ];
    cells.push(
      th('hr.compensation.col.raisePct', 'comp-num comp-col-raise'),
      th('hr.compensation.col.recOfficial', 'comp-num'),
      th('hr.compensation.col.recUnofficialUzs', 'comp-num'),
      th('hr.compensation.col.recUnofficialUsd', 'comp-num'),
      th('hr.compensation.col.recTotal', 'comp-num')
    );
    compHead.innerHTML = `<tr>${cells.join('')}</tr>`;
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
        const off = r.official_salary_uzs;
        const uuz = r.unofficial_salary_uzs;
        const uusd = r.unofficial_salary_usd;
        const tot = r.total_salary_amount;
        const cur = r.total_salary_currency || 'UZS';

        const ro = !canEditRaise ? ' readonly' : '';
        const raiseVal = pct === 0 ? '' : String(pct).replace('.', ',');
        const raiseInput = `<input type="text" class="comp-raise x-raise" inputmode="decimal" autocomplete="off" data-id="${esc(id)}" value="${esc(raiseVal)}" title="${esc(t('hr.compensation.raiseHint'))}"${ro} />`;

        let html = `<tr data-id="${esc(id)}">
        <td class="comp-col-photo">${photoCell(r)}</td>
        <td class="comp-name comp-col-name">${esc(r.person_name || '-')}</td>
        <td class="comp-num">${esc(fmtMoney(off, 'UZS'))}</td>
        <td class="comp-num">${uuz == null ? '-' : esc(fmtMoney(uuz, 'UZS'))}</td>
        <td class="comp-num">${uusd == null ? '-' : esc(fmtMoney(uusd, 'USD'))}</td>
        <td class="comp-num">${esc(fmtMoney(tot, cur))}</td>`;

        const rOff = recValue(off, pct);
        const rUuz = uuz == null ? null : recValue(uuz, pct);
        const rUusd = uusd == null ? null : recValue(uusd, pct);
        const rTot = recValue(tot, pct);

        html += `<td class="comp-num comp-col-raise">${raiseInput}</td>`;
        html += `<td class="comp-num comp-rec-official">${rOff == null ? '-' : esc(fmtMoney(rOff, 'UZS'))}</td>`;
        html += `<td class="comp-num comp-rec-uuz">${rUuz == null ? '-' : esc(fmtMoney(rUuz, 'UZS'))}</td>`;
        html += `<td class="comp-num comp-rec-uusd">${rUusd == null ? '-' : esc(fmtMoney(rUusd, 'USD'))}</td>`;
        html += `<td class="comp-num comp-rec-total">${rTot == null ? '-' : esc(fmtMoney(rTot, cur))}</td>`;
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
