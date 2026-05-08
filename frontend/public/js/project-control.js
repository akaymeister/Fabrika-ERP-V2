(function initProjectControlModule() {
  function t(key) {
    if (window.i18n && typeof window.i18n.t === 'function') return window.i18n.t(key);
    return key;
  }

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const PHASE_COLS = new Set(['roleve', 'cizim', 'malzeme_siparisi', 'uretim', 'boya', 'sevk', 'montaj']);
  const OPERATIONAL_DYNAMIC_KEYS = new Set([
    'roleve',
    'cizim',
    'malzeme_siparisi',
    'uretim',
    'boya',
    'sevk',
    'montaj',
    'kat',
    'oda_no',
    'mahal',
    'miktar',
    'urun_miktar',
    'adet',
    'birim',
    'plan_tarih',
    'termin_tarih',
  ]);
  const HIDDEN_DYNAMIC_KEYS = new Set([
    'sn',
    'seq_no',
    'urun',
    'urun_adi',
    'product_name',
    'status',
    'progress',
    'priority',
    'assigned_employee_id',
    'department_id',
    'notes',
  ]);

  function asArray(v) {
    if (Array.isArray(v)) return v;
    return [];
  }

  function fmtCurrency(v) {
    const n = Number(String(v ?? '').replace(',', '.'));
    if (!Number.isFinite(n)) return String(v ?? '');
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  function normKey(v) {
    return String(v || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function dynamicValue(item, ...keys) {
    const dyn = item?.dynamic_data_json || {};
    for (const key of keys) {
      const nk = normKey(key);
      if (Object.prototype.hasOwnProperty.call(dyn, nk) && dyn[nk] != null && dyn[nk] !== '') return dyn[nk];
    }
    return '';
  }

  function getProductImage(item) {
    return String(dynamicValue(item, 'urun_gorseli', 'gorsel', 'resim', 'image', 'foto') || '').trim();
  }

  function fmtPriceValue(raw) {
    if (raw == null || raw === '') return '-';
    const s = String(raw).trim();
    const n = Number(s.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return s;
    return fmtCurrency(n);
  }

  function showMsg(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove('is-hidden');
      el.style.display = 'block';
      return;
    }
    el.textContent = '';
    el.classList.add('is-hidden');
    el.style.display = 'none';
  }

  function apiError(data) {
    if (window.i18n && typeof window.i18n.apiErrorText === 'function') {
      return window.i18n.apiErrorText(data);
    }
    return (data && (data.message || data.error)) || t('api.error.unknown');
  }

  async function api(path, options = {}) {
    if (window.projectApi) return window.projectApi(path, options);
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, res, data };
  }

  let projects = [];
  let revisions = [];
  let currentDetail = null;
  let detailLimit = 200;
  let detailOffset = 0;
  let showAllColumns = false;
  let selectedWorkItemId = null;
  let pendingPanelWorkItemId = null;
  let pendingPanelDynamicChanges = {};

  const PRODUCT_DETAIL_FIELDS = [
    { key: 'sn', labelKey: 'project.control.colSeq' },
    { key: 'kat', labelKey: 'project.control.colFloor' },
    { key: 'oda_no', labelKey: 'project.control.colRoomNo' },
    { key: 'mahal', labelKey: 'project.control.colMahal' },
    { key: 'urun_adi', labelKey: 'project.control.colProductName' },
    { key: 'urun_kodu', labelKey: 'project.control.colProductCode' },
    { key: 'urun_grubu', labelKey: 'project.control.colProductGroup' },
    { key: 'urun_tanimi', labelKey: 'project.control.colProductDesc' },
    { key: 'urun_olcusu', labelKey: 'project.control.colProductSize' },
    { key: 'urun_miktar', labelKey: 'project.control.colQtyUnit' },
    { key: 'aktif_pasif', labelKey: 'project.control.activePassive' },
    { key: 'durum', labelKey: 'project.control.colStatus' },
  ];

  const PRICE_DETAIL_FIELDS = [
    { labelKey: 'project.control.priceUnitUsd', keys: ['birim_fiyat_usd', 'birin_fiyat_usd'] },
    { labelKey: 'project.control.priceUnitUsdNds', keys: ['nds_dahil_birim_usd', 'nsd_dahil_birim_usd', 'nsd_dahil_birim_fiyat_usd'] },
    { labelKey: 'project.control.priceTotalUsd', keys: ['toplam_usd'] },
    { labelKey: 'project.control.priceUnitUzs', keys: ['birim_fiyat_uzs', 'birin_fiyat_uzs'] },
    { labelKey: 'project.control.priceUnitUzsNsd', keys: ['nsd_dahil_birim_uzs', 'nds_dahil_birim_uzs'] },
    { labelKey: 'project.control.priceTotalUzs', keys: ['toplam_uzs'] },
  ];

  function projectLabel(row) {
    const name = row.project_name || '';
    const code = row.project_code || '';
    return `${name}${code ? ` (${code})` : ''}`;
  }

  function fillProjectSelect(selectId, withAllOption = false) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    let html = '';
    if (withAllOption) {
      html += `<option value="">${esc(t('project.control.allProjects'))}</option>`;
    } else {
      html += `<option value="">${esc(t('project.control.selectProject'))}</option>`;
    }
    projects.forEach((p) => {
      html += `<option value="${esc(p.id)}">${esc(`${p.name} (${p.project_code})`)}</option>`;
    });
    sel.innerHTML = html;
  }

  async function loadProjects() {
    const { ok, data } = await api('/api/project-control/projects');
    if (!ok) {
      showMsg('uploadMsg', apiError(data));
      return;
    }
    projects = data.projects || [];
    fillProjectSelect('projectId', false);
    fillProjectSelect('filterProject', true);
  }

  async function loadRevisions() {
    showMsg('listMsg', '');
    const projectId = document.getElementById('filterProject')?.value || '';
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const { ok, data } = await api(`/api/project-control/boq${q}`);
    if (!ok) {
      showMsg('listMsg', apiError(data));
      return;
    }
    revisions = data.revisions || [];
    renderRevisionRows();
  }

  function renderRevisionRows() {
    const tb = document.getElementById('boqListBody');
    if (!tb) return;
    if (!revisions.length) {
      tb.innerHTML = `<tr><td colspan="8" class="muted">${esc(t('project.control.empty'))}</td></tr>`;
      return;
    }
    tb.innerHTML = revisions
      .map((r) => {
        const active = Number(r.is_active_revision) === 1 ? t('project.control.yes') : t('project.control.no');
        return `<tr>
          <td>${esc(projectLabel(r))}</td>
          <td>${esc(r.original_filename || r.document_name || '')}</td>
          <td>${esc(r.revision_no || 1)}</td>
          <td>${esc(active)}</td>
          <td>${esc(r.uploaded_at || '')}</td>
          <td>${esc(r.row_count || 0)}</td>
          <td>${esc(r.status || '')}</td>
          <td>
            <div class="table-actions erp-table-actions">
              <button type="button" class="btn btn-sm btn-secondary" data-act="detail" data-id="${esc(r.id)}">${esc(t('project.control.detail'))}</button>
              <button type="button" class="btn btn-sm btn-secondary" data-act="edit" data-id="${esc(r.id)}">${esc(t('project.control.edit'))}</button>
              <button type="button" class="btn btn-sm btn-danger" data-act="delete" data-id="${esc(r.id)}">${esc(t('project.control.delete'))}</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');

    tb.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-act');
        const id = Number.parseInt(btn.getAttribute('data-id') || '0', 10);
        if (!id) return;
        if (act === 'detail') {
          detailOffset = 0;
          await openDetail(id, false);
          return;
        }
        if (act === 'edit') {
          await editRevision(id);
          return;
        }
        if (act === 'delete') {
          await deleteRevision(id);
        }
      });
    });
  }

  async function uploadBoq(e) {
    e.preventDefault();
    showMsg('uploadMsg', '');
    const projectId = document.getElementById('projectId')?.value;
    const file = document.getElementById('boqFile')?.files?.[0];
    if (!projectId || !file) {
      showMsg('uploadMsg', t('project.control.uploadMissing'));
      return;
    }
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('documentName', document.getElementById('documentName')?.value || '');
    formData.append('disciplineType', document.getElementById('disciplineType')?.value || '');
    formData.append('revisionNote', document.getElementById('revisionNote')?.value || '');
    formData.append('file', file);
    let res;
    let data;
    try {
      res = await fetch('/api/project-control/boq', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      data = await res.json().catch(() => ({}));
    } catch {
      showMsg('uploadMsg', t('api.error.network'));
      return;
    }
    if (!res.ok) {
      showMsg('uploadMsg', apiError(data));
      return;
    }
    e.target.reset();
    await loadRevisions();
    showMsg('uploadMsg', t('project.control.uploadOk'));
  }

  async function openDetail(revisionId, append = false) {
    showMsg('detailMsg', '');
    const q = `?limit=${encodeURIComponent(detailLimit)}&offset=${encodeURIComponent(detailOffset)}`;
    const { ok, data } = await api(`/api/project-control/boq/${revisionId}${q}`);
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return;
    }
    if (!append || !currentDetail || !currentDetail.revision || Number(currentDetail.revision.id) !== Number(revisionId)) {
      currentDetail = data;
    } else {
      currentDetail.workItems = [...(currentDetail.workItems || []), ...(data.workItems || [])];
      currentDetail.paging = data.paging || currentDetail.paging;
      currentDetail.columns = data.columns || currentDetail.columns;
      currentDetail.permissions = data.permissions || currentDetail.permissions;
    }
    renderDetail(currentDetail);
  }

  function extractValue(item, col) {
    if (item.dynamic_data_json && Object.prototype.hasOwnProperty.call(item.dynamic_data_json, col.column_key)) {
      return item.dynamic_data_json[col.column_key];
    }
    return '';
  }

  function columnInputType(col) {
    if (col.input_type) return String(col.input_type).toLowerCase();
    return 'text';
  }

  function columnClassByType(col) {
    const tpe = columnInputType(col);
    if (tpe === 'currency' || tpe === 'number') return 'pc-col-numeric';
    if (tpe === 'date' || tpe === 'toggle') return 'pc-col-compact';
    return 'pc-col-wide';
  }

  function shouldShowDynamicColumn(col) {
    const key = String(col.column_key || '').toLowerCase();
    if (showAllColumns) return true;
    if (OPERATIONAL_DYNAMIC_KEYS.has(key)) return true;
    if (PHASE_COLS.has(key)) return true;
    const tpe = columnInputType(col);
    return ['dropdown', 'toggle', 'date', 'number', 'currency'].includes(tpe);
  }

  function renderDynamicCell(item, col) {
    const value = extractValue(item, col);
    const inputType = columnInputType(col);
    const key = col.column_key;
    const label = col.column_label || key;
    const title = esc(value ?? '');

    if (inputType === 'readonly') {
      return `<span class="pc-cell-text" title="${title}">${esc(value ?? '')}</span>`;
    }
    if (inputType === 'dropdown' || PHASE_COLS.has(key)) {
      const options = asArray(col.options_json);
      const current = String(value ?? '').trim();
      const rows = options.length ? options : ['Bekliyor', 'Devam', 'Tamam', 'Gecikti', 'Revizyon'];
      return `<select class="pc-dyn-input pc-dyn-select ${PHASE_COLS.has(key) ? 'pc-phase-select' : ''}" data-col-key="${esc(key)}" data-col-label="${esc(label)}">
        ${rows.map((opt) => `<option value="${esc(opt)}" ${current === String(opt) ? 'selected' : ''}>${esc(opt)}</option>`).join('')}
      </select>`;
    }
    if (inputType === 'toggle') {
      const on = ['1', 'true', 'evet', 'yes', 'tamam', 'tamamlandi', 'tamamlandı'].includes(String(value ?? '').trim().toLowerCase());
      return `<label class="pc-switch"><input type="checkbox" class="pc-dyn-input pc-dyn-toggle" data-col-key="${esc(key)}" ${on ? 'checked' : ''}><span></span></label>`;
    }
    if (inputType === 'date') {
      const d = String(value ?? '').slice(0, 10);
      return `<input type="date" class="pc-dyn-input pc-dyn-date" data-col-key="${esc(key)}" value="${esc(d)}" />`;
    }
    if (inputType === 'number') {
      return `<input type="number" step="0.01" class="pc-dyn-input pc-dyn-number" data-col-key="${esc(key)}" value="${esc(value ?? '')}" />`;
    }
    if (inputType === 'currency') {
      return `<input type="text" class="pc-dyn-input pc-dyn-currency ta-right" data-col-key="${esc(key)}" value="${esc(fmtCurrency(value))}" title="${title}" />`;
    }
    return `<span class="pc-cell-text" title="${title}">${esc(value ?? '')}</span>`;
  }

  function statusClass(v) {
    const s = String(v || '').trim().toLocaleLowerCase('tr-TR');
    if (!s) return 'wait';
    if (s.includes('tamam') || s.includes('bitti') || s.includes('done') || s.includes('completed')) return 'done';
    if (s.includes('gecik') || s.includes('delay')) return 'delay';
    if (s.includes('revizyon') || s.includes('revision')) return 'rev';
    if (s.includes('bekle') || s.includes('wait') || s.includes('pasif')) return 'wait';
    return 'work';
  }

  function phaseLabelByKey(key) {
    const k = String(key || '').toLowerCase();
    const labels = {
      roleve: 'Röleve',
      cizim: 'Çizim',
      malzeme_siparisi: 'Malzeme Siparişi',
      uretim: 'Üretim',
      boya: 'Boya',
      sevk: 'Sevk',
      montaj: 'Montaj',
    };
    return labels[k] || k;
  }

  function formatWorkStatus(item) {
    const phaseKey = dynamicValue(item, 'durum_faz', 'phase_key', 'aktif_faz');
    const status = dynamicValue(item, 'durum', 'status') || item.status || 'pending';
    if (!phaseKey) return status;
    return `${phaseLabelByKey(phaseKey)}: ${status}`;
  }

  function refreshPanelSaveButton() {
    const btn = document.getElementById('btnSaveDetailPanels');
    if (!btn) return;
    const hasPending = Object.keys(pendingPanelDynamicChanges || {}).length > 0;
    btn.disabled = !hasPending;
  }

  function renderDetailPanels(item) {
    const infoEl = document.getElementById('detailProductInfo');
    const imgEl = document.getElementById('detailProductImage');
    const imgFallback = document.getElementById('detailProductImageFallback');
    const phaseBody = document.getElementById('detailPhaseBody');
    if (!infoEl || !imgEl || !imgFallback || !phaseBody) return;
    if (!item) {
      pendingPanelWorkItemId = null;
      pendingPanelDynamicChanges = {};
      refreshPanelSaveButton();
      infoEl.innerHTML = '';
      phaseBody.innerHTML = '';
      imgEl.style.display = 'none';
      imgFallback.style.display = 'flex';
      return;
    }

    const dyn = item.dynamic_data_json || {};
    pendingPanelWorkItemId = item.id;
    pendingPanelDynamicChanges = {};
    refreshPanelSaveButton();
    const imageUrl = getProductImage(item);
    if (imageUrl) {
      imgEl.src = imageUrl;
      imgEl.style.display = 'block';
      imgFallback.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      imgFallback.style.display = 'flex';
    }

    const productDetailsHtml = PRODUCT_DETAIL_FIELDS.map((f) => {
      const val = dynamicValue(item, f.key) || (f.key === 'sn' ? item.seq_no : '');
      return `<div class="project-control-kv"><div class="k">${esc(t(f.labelKey))}</div><div class="v">${esc(val || '-')}</div></div>`;
    }).join('');
    const assigneeName = item.assigned_employee_name || (item.assigned_employee_id ? `#${item.assigned_employee_id}` : '-');
    const priceDetailsHtml = PRICE_DETAIL_FIELDS.map((f) => {
      const raw = dynamicValue(item, ...(f.keys || []));
      return `<div class="project-control-kv"><div class="k">${esc(t(f.labelKey))}</div><div class="v v-price">${esc(fmtPriceValue(raw))}</div></div>`;
    }).join('');
    infoEl.innerHTML = `
      <div class="project-control-detail-section">
        <h5>${esc(t('project.control.sectionProductDetails'))}</h5>
        ${productDetailsHtml}
        <div class="project-control-kv"><div class="k">${esc(t('project.control.colAssignee'))}</div><div class="v">${esc(assigneeName)}</div></div>
        <div class="project-control-subsection-title">${esc(t('project.control.sectionPriceDetails'))}</div>
        ${priceDetailsHtml}
      </div>
    `;

    const phaseConfig = [
      { key: 'roleve', label: 'RÖLEVE', dateKeys: ['roleve_tarihi', 'roleve_tarih'] },
      { key: 'cizim', label: 'ÇİZİM', dateKeys: ['cizim_tarihi', 'cizim_tarih'] },
      { key: 'malzeme_siparisi', label: 'MALZEME SİPARİŞİ', dateKeys: ['malzeme_siparisi_tarihi', 'malzeme_tarih'] },
      { key: 'uretim', label: 'ÜRETİM', dateKeys: ['uretime_verilis_tarihi', 'uretim_tarihi', 'uretim_tarih'] },
      { key: 'boya', label: 'BOYA', dateKeys: ['boya_tarihi', 'boya_tarih'] },
      { key: 'sevk', label: 'SEVK', dateKeys: ['sevk_tarihi', 'sevk_tarih'] },
      { key: 'montaj', label: 'MONTAJ', dateKeys: ['montaj_tarihi', 'montaj_tarih'] },
    ];
    const opts = ['Bekliyor', 'Devam', 'Tamam', 'Gecikti', 'Revizyon'];
    phaseBody.innerHTML = phaseConfig.map((p) => {
      const current = String(dynamicValue(item, p.key) || 'Bekliyor');
      const dateVal = dynamicValue(item, ...p.dateKeys) || '-';
      return `<tr data-phase-key="${esc(p.key)}">
        <td>${esc(p.label)}</td>
        <td>
          <select class="pc-phase-status ${statusClass(current)}" data-col-key="${esc(p.key)}">
            ${opts.map((o) => `<option value="${esc(o)}" ${String(o) === current ? 'selected' : ''}>${esc(o)}</option>`).join('')}
          </select>
        </td>
        <td>${esc(dateVal)}</td>
      </tr>`;
    }).join('');

    phaseBody.querySelectorAll('.pc-phase-status').forEach((sel) => {
      sel.addEventListener('change', () => {
        sel.classList.remove('wait', 'work', 'done', 'delay', 'rev');
        sel.classList.add(statusClass(sel.value));
        const key = sel.getAttribute('data-col-key');
        if (!key) return;
        pendingPanelDynamicChanges[key] = sel.value;
        pendingPanelDynamicChanges.durum = sel.value;
        pendingPanelDynamicChanges.durum_faz = key;
        refreshPanelSaveButton();
      });
    });
  }

  function openDetailPanelsModal(workItemId = null) {
    const modal = document.getElementById('detailPanelsModal');
    if (!modal) return;
    const fallback = (currentDetail?.workItems || [])[0] || null;
    const item = workItemId ? findDetailItem(workItemId) : findDetailItem(selectedWorkItemId) || fallback;
    if (item) {
      selectedWorkItemId = item.id;
      renderDetailPanels(item);
    }
    modal.classList.remove('is-hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('project-control-modal-open');
  }

  function closeDetailPanelsModal() {
    const modal = document.getElementById('detailPanelsModal');
    if (!modal) return;
    modal.classList.add('is-hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('project-control-modal-open');
  }

  async function saveDetailPanelsChanges() {
    const workItemId = Number.parseInt(String(pendingPanelWorkItemId || selectedWorkItemId || ''), 10);
    if (!workItemId) return;
    const keys = Object.keys(pendingPanelDynamicChanges || {});
    if (!keys.length) return;
    const item = findDetailItem(workItemId);
    if (!item) return;
    const dyn = { ...(item.dynamic_data_json || {}) };
    keys.forEach((k) => {
      dyn[k] = pendingPanelDynamicChanges[k];
    });
    const { ok, data } = await api(`/api/project-control/work-items/${workItemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ dynamic_data_json: dyn }),
    });
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return;
    }
    item.dynamic_data_json = dyn;
    pendingPanelDynamicChanges = {};
    refreshPanelSaveButton();
    if (currentDetail) renderDetail(currentDetail);
    showMsg('detailMsg', t('project.control.inlineSaved'));
  }

  function renderDetail(detail) {
    const card = document.getElementById('detailCard');
    const head = document.getElementById('detailHead');
    const body = document.getElementById('detailBody');
    const title = document.getElementById('detailTitle');
    const loadMoreBtn = document.getElementById('btnLoadMoreRows');
    if (!card || !head || !body) return;

    const r = detail.revision || {};
    if (title) title.textContent = `${t('project.control.detailTitle')}: ${r.document_name || ''} / REV-${r.revision_no || 1}`;

    const columns = [
      { key: '__seq', label: t('project.control.colSeq'), cls: 'pc-col-compact' },
      { key: '__thumb', label: t('project.control.colImage'), cls: 'pc-col-compact' },
      { key: '__kat', label: t('project.control.colFloor'), cls: 'pc-col-compact' },
      { key: '__mahal', label: t('project.control.colMahal'), cls: 'pc-col-wide' },
      { key: '__product_name', label: t('project.control.colProductName'), cls: 'pc-col-wide' },
      { key: '__status', label: t('project.control.colWorkStatus'), cls: 'pc-col-compact' },
      { key: '__active_passive', label: t('project.control.activePassive'), cls: 'pc-col-compact' },
      { key: '__assignee', label: t('project.control.colAssignee'), cls: 'pc-col-wide' },
      { key: '__update', label: t('project.control.update'), cls: 'pc-col-compact' },
    ];
    const btnToggleColumns = document.getElementById('btnToggleColumns');
    if (btnToggleColumns) {
      btnToggleColumns.style.display = 'none';
    }

    head.innerHTML = `<tr>${columns
      .map((c, idx) => {
        return `<th class="${idx === 0 ? 'sticky-col' : ''} ${esc(c.cls || 'pc-col-compact')}" data-col="${esc(c.key)}">${esc(c.label)}</th>`;
      })
      .join('')}</tr>`;

    body.innerHTML = (detail.workItems || [])
      .map((item) => {
        const thumb = getProductImage(item);
        const productLabel = dynamicValue(item, 'urun_adi') || item.product_name || item.title || '';
        const kat = dynamicValue(item, 'kat') || item.location_floor || '-';
        const mahal = dynamicValue(item, 'mahal') || item.mahal || '-';
        const activePassiveRaw = String(dynamicValue(item, 'aktif_pasif') || '').trim();
        const activePassiveChecked = ['1', 'true', 'evet', 'yes', 'aktif'].includes(activePassiveRaw.toLowerCase());
        const assignee = item.assigned_employee_name || (item.assigned_employee_id ? `#${item.assigned_employee_id}` : '-');
        return `<tr data-id="${esc(item.id)}">
          <td class="sticky-col" title="${esc(item.seq_no || '')}">${esc(item.seq_no || '')}</td>
          <td title="${esc(productLabel)}">
            ${thumb ? `<img class="pc-thumb" src="${esc(thumb)}" alt="${esc(productLabel)}" />` : `<span class="pc-thumb-empty">${esc(t('project.control.noImage'))}</span>`}
          </td>
          <td>${esc(kat)}</td>
          <td>${esc(mahal)}</td>
          <td>${esc(productLabel)}</td>
          <td>${esc(formatWorkStatus(item))}</td>
          <td>
            <label class="pc-switch">
              <input type="checkbox" class="pc-dyn-input pc-dyn-toggle" data-col-key="aktif_pasif" ${activePassiveChecked ? 'checked' : ''}>
              <span></span>
            </label>
          </td>
          <td>
            <div class="project-control-assign-box">
              <div class="pc-assign-combo">
                <input type="text" class="pc-assign-search" autocomplete="off" placeholder="${esc(t('project.control.personSearchPh'))}" />
                <div class="pc-assign-dropdown is-hidden"></div>
              </div>
              <button type="button" class="btn btn-sm btn-secondary" data-act="assign-quick">${esc(t('project.control.assign'))}</button>
              <span class="pc-assignee-text">${esc(assignee)}</span>
            </div>
          </td>
          <td>
            <button type="button" class="btn btn-sm btn-secondary" data-act="open-panels">${esc(t('project.control.update'))}</button>
          </td>
        </tr>`;
      })
      .join('');

    const selected = (detail.workItems || []).find((w) => Number(w.id) === Number(selectedWorkItemId))
      || (detail.workItems || [])[0]
      || null;
    selectedWorkItemId = selected ? selected.id : null;
    renderDetailPanels(selected);

    card.classList.remove('is-hidden');
    card.style.display = 'block';
    if (loadMoreBtn) {
      const hasMore = !!detail?.paging?.hasMore;
      loadMoreBtn.classList.toggle('is-hidden', !hasMore);
      loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    wireDetailRowActions();
  }

  async function editRevision(id) {
    const revision_note = window.prompt(t('project.control.revisionNotePrompt'), '');
    if (revision_note == null) return;
    const { ok, data } = await api(`/api/project-control/boq/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ revision_note }),
    });
    if (!ok) {
      showMsg('listMsg', apiError(data));
      return;
    }
    await loadRevisions();
  }

  async function deleteRevision(id) {
    if (!window.confirm(t('project.control.confirmDeleteBoq'))) return;
    const { ok, data } = await api(`/api/project-control/boq/${id}`, { method: 'DELETE' });
    if (!ok) {
      showMsg('listMsg', apiError(data));
      return;
    }
    await loadRevisions();
    const detailCard = document.getElementById('detailCard');
    if (detailCard) detailCard.style.display = 'none';
  }

  function employeeLabel(emp) {
    if (!emp) return '';
    const full = String(emp.full_name || '').trim();
    if (full) return full;
    const first = String(emp.first_name || '').trim();
    const last = String(emp.last_name || '').trim();
    return `${first} ${last}`.trim() || String(emp.employee_no || '').trim() || `#${emp.id || ''}`;
  }

  async function searchEmployees(searchText) {
    const q = searchText ? `?search=${encodeURIComponent(searchText)}` : '';
    const { ok, data } = await api(`/api/project-control/employees${q}`);
    if (!ok) return { ok: false, data };
    return { ok: true, employees: data.employees || [] };
  }

  async function assignPerson(workItemId, searchText, selectedEmployeeId = null) {
    let employeeId = Number.parseInt(String(selectedEmployeeId || ''), 10);
    if (!employeeId) {
      const res = await searchEmployees(searchText);
      if (!res.ok) {
        showMsg('detailMsg', apiError(res.data));
        return;
      }
      const emps = res.employees || [];
      if (!emps.length) {
        showMsg('detailMsg', t('project.control.employeeNotFound'));
        return;
      }
      employeeId = Number.parseInt(String(emps[0].id || ''), 10);
    }
    if (!employeeId) {
      showMsg('detailMsg', t('project.control.employeeNotFound'));
      return;
    }
    const assign = await api(`/api/project-control/work-items/${workItemId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    });
    if (!assign.ok) {
      showMsg('detailMsg', apiError(assign.data));
      return;
    }
    if (currentDetail?.revision?.id) {
      detailOffset = 0;
      await openDetail(currentDetail.revision.id, false);
    }
  }

  async function rowEdit(workItemId) {
    const status = window.prompt(t('project.control.statusPrompt'), 'in_progress');
    if (status == null) return;
    const progress = window.prompt(t('project.control.progressPrompt'), '10');
    const notes = trById(workItemId)?.querySelector('.pc-notes-input')?.value || '';
    const payload = { status, notes };
    if (progress != null && progress !== '') payload.progress = Number(progress) || 0;
    const { ok, data } = await api(`/api/project-control/work-items/${workItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return;
    }
    if (currentDetail?.revision?.id) {
      detailOffset = 0;
      await openDetail(currentDetail.revision.id, false);
    }
  }

  function findDetailItem(workItemId) {
    return (currentDetail?.workItems || []).find((x) => Number(x.id) === Number(workItemId)) || null;
  }

  async function patchDynamicField(workItemId, colKey, rawValue) {
    const item = findDetailItem(workItemId);
    if (!item) return false;
    const dyn = { ...(item.dynamic_data_json || {}) };
    dyn[colKey] = rawValue;
    const { ok, data } = await api(`/api/project-control/work-items/${workItemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ dynamic_data_json: dyn }),
    });
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return false;
    }
    item.dynamic_data_json = dyn;
    showMsg('detailMsg', t('project.control.inlineSaved'));
    return true;
  }

  async function openHistory(workItemId) {
    const { ok, data } = await api(`/api/project-control/work-items/${workItemId}/history?limit=20`);
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return;
    }
    const list = (data.history || [])
      .slice(0, 10)
      .map((x) => `${x.changed_at} | ${x.change_type} | ${x.field_name || '-'}`)
      .join('\n');
    window.alert(list || t('project.control.empty'));
  }

  function trById(workItemId) {
    return document.querySelector(`#detailBody tr[data-id="${String(workItemId)}"]`);
  }

  async function updateDepartmentTaskFlow(workItemId) {
    const phase_key = window.prompt(t('project.control.phasePrompt'), 'uretim');
    if (!phase_key) return;
    const department_id = window.prompt(t('project.control.departmentPrompt'), '');
    if (!department_id) return;
    const status = window.prompt(t('project.control.statusPrompt'), 'in_progress');
    if (!status) return;
    const progress = window.prompt(t('project.control.progressPrompt'), '10');
    const notes = trById(workItemId)?.querySelector('.pc-notes-input')?.value || '';
    const { ok, data } = await api(`/api/project-control/work-items/${workItemId}/department-tasks`, {
      method: 'POST',
      body: JSON.stringify({
        phase_key,
        department_id: Number(department_id) || null,
        status,
        progress: Number(progress) || 0,
        notes,
      }),
    });
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return;
    }
    showMsg('detailMsg', t('project.control.departmentTaskSaved'));
  }

  async function rowDelete(workItemId) {
    if (!window.confirm(t('project.control.confirmDeleteRow'))) return;
    const { ok, data } = await api(`/api/project-control/work-items/${workItemId}`, { method: 'DELETE' });
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return;
    }
    if (currentDetail?.revision?.id) {
      detailOffset = 0;
      await openDetail(currentDetail.revision.id, false);
    }
  }

  function wireDetailRowActions() {
    const body = document.getElementById('detailBody');
    if (!body) return;
    const setActiveRow = (id) => {
      selectedWorkItemId = id;
      body.querySelectorAll('tr[data-id]').forEach((x) => x.classList.toggle('pc-row-active', Number(x.getAttribute('data-id')) === Number(id)));
      renderDetailPanels(findDetailItem(id));
    };
    body.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = Number.parseInt(tr.getAttribute('data-id') || '0', 10);
      if (!id) return;
      tr.addEventListener('click', () => setActiveRow(id));
      const assignInput = tr.querySelector('.pc-assign-search');
      const assignDropdown = tr.querySelector('.pc-assign-dropdown');
      let selectedEmployeeId = null;
      let employeeSearchTimer = null;
      let employeeSearchToken = 0;

      const hideDropdown = () => {
        if (!assignDropdown) return;
        assignDropdown.classList.add('is-hidden');
        assignDropdown.innerHTML = '';
      };
      const showDropdown = (employees) => {
        if (!assignDropdown || !assignInput) return;
        if (!employees.length) {
          assignDropdown.innerHTML = `<div class="pc-assign-option pc-assign-option-empty">${esc(t('project.control.employeeNotFound'))}</div>`;
          assignDropdown.classList.remove('is-hidden');
          return;
        }
        assignDropdown.innerHTML = employees
          .map((emp) => {
            const label = employeeLabel(emp);
            const secondary = String(emp.employee_no || '').trim();
            return `<button type="button" class="pc-assign-option" data-employee-id="${esc(emp.id)}" data-label="${esc(label)}">
              <span>${esc(label)}</span>
              ${secondary ? `<small>${esc(secondary)}</small>` : ''}
            </button>`;
          })
          .join('');
        assignDropdown.classList.remove('is-hidden');
        assignDropdown.querySelectorAll('.pc-assign-option[data-employee-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            selectedEmployeeId = Number.parseInt(btn.getAttribute('data-employee-id') || '0', 10) || null;
            assignInput.value = btn.getAttribute('data-label') || '';
            hideDropdown();
          });
        });
      };

      if (assignInput) {
        assignInput.addEventListener('input', () => {
          selectedEmployeeId = null;
          if (employeeSearchTimer) window.clearTimeout(employeeSearchTimer);
          employeeSearchTimer = window.setTimeout(async () => {
            const q = String(assignInput.value || '').trim();
            if (q.length < 1) {
              hideDropdown();
              return;
            }
            const token = ++employeeSearchToken;
            const res = await searchEmployees(q);
            if (token !== employeeSearchToken) return;
            if (!res.ok) {
              showMsg('detailMsg', apiError(res.data));
              hideDropdown();
              return;
            }
            showDropdown(res.employees || []);
          }, 220);
        });
        assignInput.addEventListener('focus', () => {
          if (assignInput.value.trim()) assignInput.dispatchEvent(new Event('input'));
        });
        assignInput.addEventListener('blur', () => {
          window.setTimeout(hideDropdown, 140);
        });
      }

      tr.querySelector('button[data-act="assign-quick"]')?.addEventListener('click', async () => {
        const q = assignInput?.value || '';
        await assignPerson(id, q, selectedEmployeeId);
        selectedEmployeeId = null;
        hideDropdown();
      });
      tr.querySelector('button[data-act="open-panels"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openDetailPanelsModal(id);
      });
      tr.querySelector('button[data-act="row-edit"]')?.addEventListener('click', async () => {
        await rowEdit(id);
      });
      tr.querySelector('button[data-act="dept-task"]')?.addEventListener('click', async () => {
        await updateDepartmentTaskFlow(id);
      });
      tr.querySelector('button[data-act="history"]')?.addEventListener('click', async () => {
        await openHistory(id);
      });
      tr.querySelector('button[data-act="row-delete"]')?.addEventListener('click', async () => {
        await rowDelete(id);
      });
      tr.querySelectorAll('.pc-dyn-input[data-col-key]').forEach((input) => {
        const colKey = input.getAttribute('data-col-key');
        if (!colKey) return;
        const apply = async () => {
          if (input.classList.contains('pc-dyn-toggle')) {
            const prev = !input.checked;
            const ok = await patchDynamicField(id, colKey, input.checked ? 'Aktif' : 'Pasif');
            if (!ok) input.checked = prev;
            return;
          }
          await patchDynamicField(id, colKey, input.value);
        };
        input.addEventListener('change', apply);
        if (input.classList.contains('pc-dyn-currency') || input.classList.contains('pc-dyn-number')) {
          input.addEventListener('blur', apply);
        }
      });
    });
    if (selectedWorkItemId) {
      setActiveRow(selectedWorkItemId);
    }
  }

  async function addRow() {
    if (!currentDetail?.revision) return;
    const title = window.prompt(t('project.control.rowTitlePrompt'), '');
    if (title == null) return;
    const { ok, data } = await api('/api/project-control/work-items', {
      method: 'POST',
      body: JSON.stringify({
        project_id: currentDetail.revision.project_id,
        boq_document_id: currentDetail.revision.boq_document_id,
        boq_revision_id: currentDetail.revision.id,
        title,
        product_name: title,
        dynamic_data_json: {},
      }),
    });
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return;
    }
    detailOffset = 0;
    await openDetail(currentDetail.revision.id, false);
  }

  async function addColumn() {
    if (!currentDetail?.revision) return;
    const column_label = window.prompt(t('project.control.columnLabelPrompt'), '');
    if (!column_label) return;
    const column_key = window.prompt(t('project.control.columnKeyPrompt'), '');
    if (!column_key) return;
    const { ok, data } = await api('/api/project-control/columns', {
      method: 'POST',
      body: JSON.stringify({
        boq_revision_id: currentDetail.revision.id,
        column_label,
        column_key,
      }),
    });
    if (!ok) {
      showMsg('detailMsg', apiError(data));
      return;
    }
    detailOffset = 0;
    await openDetail(currentDetail.revision.id, false);
  }

  function wireUi() {
    const uploadPanel = document.getElementById('uploadPanel');
    document.getElementById('btnToggleUpload')?.addEventListener('click', () => {
      if (!uploadPanel) return;
      uploadPanel.classList.toggle('is-hidden');
      uploadPanel.style.display = uploadPanel.classList.contains('is-hidden') ? 'none' : 'block';
    });
    document.getElementById('boqUploadForm')?.addEventListener('submit', uploadBoq);
    document.getElementById('btnRefreshList')?.addEventListener('click', loadRevisions);
    document.getElementById('filterProject')?.addEventListener('change', loadRevisions);
    document.getElementById('btnAddRow')?.addEventListener('click', addRow);
    document.getElementById('btnAddColumn')?.addEventListener('click', addColumn);
    document.getElementById('btnToggleColumns')?.addEventListener('click', () => {
      showAllColumns = !showAllColumns;
      if (currentDetail) renderDetail(currentDetail);
    });
    document.getElementById('btnInitDeptTasks')?.addEventListener('click', async () => {
      if (!currentDetail?.workItems?.length) return;
      const firstItemId = currentDetail.workItems[0].id;
      const { ok, data } = await api(`/api/project-control/work-items/${firstItemId}/department-tasks/init`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!ok) {
        showMsg('detailMsg', apiError(data));
        return;
      }
      showMsg('detailMsg', t('project.control.departmentTaskInitOk'));
    });
    document.getElementById('btnLoadMoreRows')?.addEventListener('click', async () => {
      if (!currentDetail?.revision?.id) return;
      if (!currentDetail?.paging?.hasMore) return;
      detailOffset = Number(currentDetail.paging.offset || 0) + Number(currentDetail.paging.limit || detailLimit);
      await openDetail(currentDetail.revision.id, true);
    });
    document.querySelectorAll('[data-act="close-panels-modal"]').forEach((el) => {
      el.addEventListener('click', closeDetailPanelsModal);
    });
    document.getElementById('btnSaveDetailPanels')?.addEventListener('click', async () => {
      await saveDetailPanelsChanges();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDetailPanelsModal();
    });
    document.getElementById('languageSelect')?.addEventListener('change', (e) => {
      const v = e.target.value;
      if (!v || !window.i18n) return;
      localStorage.setItem('erp_lang', v);
      window.i18n.loadDict(v).then(() => {
        window.i18n.apply(document);
      });
    });
  }

  async function start() {
    const lang = window.i18n && window.i18n.getLang ? window.i18n.getLang() : 'tr';
    if (window.i18n && window.i18n.loadDict) await window.i18n.loadDict(lang);
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
    const sel = document.getElementById('languageSelect');
    if (sel) sel.value = lang;
    if (window.initProjectPageNav) await window.initProjectPageNav('control');
    wireUi();
    await loadProjects();
    await loadRevisions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
