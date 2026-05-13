/**
 * Satınalma işleme ekranı:
 *   Üst: fiyat bekleyen satınalma siparişleri
 *   Alt: seçilen siparişin supplier / price / currency / fx düzenleme formu
 */
(function () {
  const msg = document.getElementById('msg');
  const ordBody = document.getElementById('ordBody');
  const activeOrdBody = document.getElementById('activeOrdBody');
  const completedOrdBody = document.getElementById('completedOrdBody');
  const detailEmpty = document.getElementById('detailEmpty');
  const orderFormBlock = document.getElementById('orderFormBlock');
  const linesDetailBody = document.getElementById('linesDetailBody');
  const orderMeta = document.getElementById('orderMeta');
  const orderBadges = document.getElementById('orderBadges');
  const btnStart = document.getElementById('btnStart');
  const btnPrint = document.getElementById('btnPrint');
  const btnPrintDlg = document.getElementById('btnPrintDlg');
  const btnSavePricing = document.getElementById('btnSavePricing');
  const btnCompleteOrder = document.getElementById('btnCompleteOrder');
  const btnReviseOrder = document.getElementById('btnReviseOrder');
  const procLockHint = document.getElementById('procLockHint');
  const procDlg = document.getElementById('procDlg');
  const procDlgClose = document.getElementById('procDlgClose');
  const cancelLineModal = document.getElementById('cancelLineModal');
  const cancelLineReason = document.getElementById('cancelLineReason');
  const cancelLineConfirm = document.getElementById('cancelLineConfirm');
  const cancelLineDismiss = document.getElementById('cancelLineDismiss');

  let suppliers = [];
  let selectedOrder = null;
  let lineInputs = [];
  let cancelLineItemId = null;

  function orderBuyerStatus(order) {
    return String((order && (order.buyer_status || order.buyer_state)) || 'draft')
      .trim()
      .toLowerCase();
  }

  function isOrderProcessingStarted(order) {
    const st = orderBuyerStatus(order);
    return st === 'in_progress' || st === 'prices_saved' || st === 'revision_requested';
  }

  function isOrderCompleted(order) {
    return orderBuyerStatus(order) === 'completed';
  }

  function tK(k) {
    return window.i18n && window.i18n.t ? window.i18n.t(k) : k;
  }

  function apiMsg(data) {
    if (window.i18n && typeof window.i18n.apiErrorText === 'function') {
      return window.i18n.apiErrorText(data);
    }
    if (!data || typeof data !== 'object') return tK('api.error.unknown');
    if (data.messageKey && window.i18n) {
      const v = tK(data.messageKey);
      if (v && v !== data.messageKey) return v;
    }
    return data.message || data.error || tK('api.error.unknown');
  }

  function showMsg(text, isErr) {
    if (!msg) return;
    msg.textContent = text || '';
    msg.style.color = isErr ? '#b91c1c' : '#0f766e';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtQtyDisplay(value) {
    if (window.uiFormat && typeof window.uiFormat.fmtQty === 'function') {
      return window.uiFormat.fmtQty(value);
    }
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  }

  function fmtMoneyDisplay(value) {
    if (window.uiFormat && typeof window.uiFormat.fmtMoney === 'function') {
      return window.uiFormat.fmtMoney(value);
    }
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  }

  /**
   * tr-TR vb.: binlik `.`, ondalık `,` (örn. 1.000.000,52). Virgül yoksa İngilizce `12.34` de kabul edilir.
   * @param {unknown} raw
   * @returns {number|null}
   */
  function parseLocaleDecimalInput(raw) {
    let s = String(raw ?? '')
      .trim()
      .replace(/\s/g, '');
    if (!s) return null;
    s = s.replace(/'/g, '');
    if (s.indexOf(',') >= 0) {
      const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount >= 2) {
      const n = parseFloat(s.replace(/\./g, ''));
      return Number.isFinite(n) ? n : null;
    }
    const n2 = parseFloat(s);
    return Number.isFinite(n2) ? n2 : null;
  }

  /** Birim fiyat metin alanı: locale ile 2 ondalık (örn. 1.000.000,52). */
  function fmtUnitPriceFieldDisplay(raw) {
    if (raw == null || raw === '') {
      return '';
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return '';
    }
    return fmtMoneyDisplay(n);
  }

  function formatUnitPriceInput(el) {
    if (!el || el.disabled) return;
    const raw = String(el.value || '').trim();
    if (raw === '') {
      el.value = '';
      el.removeAttribute('title');
      return;
    }
    const n = parseLocaleDecimalInput(raw);
    if (n == null || !Number.isFinite(n) || n < 0) {
      return;
    }
    const disp = fmtMoneyDisplay(n);
    el.value = disp;
    el.title = disp;
  }

  /**
   * type="number" kur alanı: görünüm en fazla 2 ondalık (ayırıcı nokta).
   * Kaydetmede input.value parseFloat ile okunur; step=0.0001 korunur.
   */
  function fmtFxInputValue(raw) {
    if (raw == null || raw === '') {
      return '';
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return '';
    }
    return n.toFixed(2);
  }

  function fmtDisplayUpper(value) {
    if (window.uiFormat && typeof window.uiFormat.fmtDisplayUpper === 'function') {
      return window.uiFormat.fmtDisplayUpper(value);
    }
    return String(value == null ? '' : value).toLocaleUpperCase('tr-TR');
  }

  function fmtTitleLabel(value) {
    if (window.uiFormat && typeof window.uiFormat.fmtTitleLabel === 'function') {
      return window.uiFormat.fmtTitleLabel(value);
    }
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    const lower = raw.toLocaleLowerCase('tr-TR');
    return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
  }

  function applyTitleCase(root) {
    const target = root || document;
    target.querySelectorAll('title[data-i18n], h1[data-i18n], h2[data-i18n], h3[data-i18n], th[data-i18n], button[data-i18n], a[data-i18n], label[data-i18n]').forEach((el) => {
      if (!el || !el.textContent) return;
      el.textContent = fmtTitleLabel(el.textContent);
    });
  }

  function fmtQty(value) {
    return fmtQtyDisplay(value);
  }

  function normalizeUnitCode(value) {
    return String(value || '').trim().toUpperCase();
  }

  function primaryUnit(item) {
    return normalizeUnitCode(item.primary_unit || item.request_unit || item.p_unit_code || item.p_unit_legacy || 'ADET') || 'ADET';
  }

  function isM2Unit(value) {
    const unit = String(value || '').trim().toLowerCase();
    return unit === 'm2' || unit === 'm²' || unit === 'sqm';
  }

  function isM3Unit(value) {
    const unit = String(value || '').trim().toLowerCase();
    return unit === 'm3' || unit.indexOf('m³') >= 0;
  }

  function calcM2ForQty(item, qty) {
    const q = Number(qty) || 0;
    if (q <= 0) return null;
    const unit = primaryUnit(item);
    if (isM2Unit(unit)) return q;
    const m2PerUnit = Number(item.m2_per_piece);
    return Number.isFinite(m2PerUnit) && m2PerUnit > 0 ? q * m2PerUnit : null;
  }

  function calcM3ForQty(item, qty) {
    const q = Number(qty) || 0;
    if (q <= 0) return null;
    const unit = primaryUnit(item);
    if (isM3Unit(unit)) return q;
    const calcM2 = calcM2ForQty(item, q);
    const depth = Number(item.depth_mm) || 0;
    return calcM2 != null && depth > 0 ? calcM2 * (depth / 1000) : null;
  }

  function helperLineHtml(labelKey, value) {
    if (value == null) return '';
    return `<div class="text-meta proc-qty-helper-meta">${esc(tK(labelKey))}: ${esc(fmtQty(value))}</div>`;
  }

  function qtyCellHtml(item, qty) {
    const unit = primaryUnit(item);
    const calcM2 = calcM2ForQty(item, qty);
    const calcM3 = calcM3ForQty(item, qty);
    let html = `<div>${esc(fmtQty(qty))} ${esc(unit)}</div>`;
    if (calcM2 != null && !isM2Unit(unit)) {
      html += helperLineHtml('stock.mov.colQtyM2Helper', calcM2);
    }
    if (calcM3 != null && !isM3Unit(unit)) {
      html += helperLineHtml('stock.mov.colQtyM3Helper', calcM3);
    }
    return html;
  }

  function qtyCellPlain(item, qty) {
    const unit = primaryUnit(item);
    return `<div>${esc(fmtQty(qty))} ${esc(unit)}</div>`;
  }

  function openProcDialog() {
    if (!procDlg) return;
    if (typeof procDlg.showModal === 'function' && !procDlg.open) {
      try {
        procDlg.showModal();
      } catch (e) {
        procDlg.setAttribute('open', 'open');
      }
    } else if (!procDlg.open) {
      procDlg.setAttribute('open', 'open');
    }
  }

  function closeProcDialog() {
    if (!procDlg) return;
    closeAllSupCombos();
    if (typeof procDlg.close === 'function' && procDlg.open) {
      procDlg.close();
    } else {
      procDlg.removeAttribute('open');
    }
  }

  function orderQtyValue(item) {
    const q = Number(item && item.qty_ordered);
    return Number.isFinite(q) && q > 0 ? q : 0;
  }

  function lineUnitPriceValue(input) {
    const priceRaw = input && input.priceEl ? String(input.priceEl.value || '').trim() : '';
    if (priceRaw === '') return 0;
    const unitPrice = parseLocaleDecimalInput(priceRaw);
    return unitPrice != null && Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
  }

  function calcLineTotal(item, input) {
    return orderQtyValue(item) * lineUnitPriceValue(input);
  }

  function syncLineTotalCell(idx) {
    if (idx == null || idx < 0) return;
    const items = Array.isArray(selectedOrder && selectedOrder.items) ? selectedOrder.items : [];
    const item = items[idx];
    if (!item) return;
    const input = lineInputs[idx] || {};
    if (!input.totalEl) return;
    const total = calcLineTotal(item, input);
    input.totalEl.value = fmtMoneyDisplay(total);
    input.totalEl.title = fmtMoneyDisplay(total);
  }

  function syncAllLineTotals() {
    for (let i = 0; i < lineInputs.length; i++) {
      syncLineTotalCell(i);
    }
  }

  function currentOrderId() {
    const raw = selectedOrder && selectedOrder.id;
    const id = parseInt(String(raw), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  function statusLabel(group, value) {
    if (!value) return '—';
    let normalized = String(value);
    if (group === 'receipt') {
      if (normalized === 'awaiting_receipt') normalized = 'pending';
      else if (normalized === 'partially_received' || normalized === 'partial_received') normalized = 'partial';
      else if (normalized === 'received_completed') normalized = 'completed';
      else if (normalized === 'cancelled') normalized = 'cancelled';
    }
    if (group === 'pricing') {
      if (normalized === 'fully_priced') normalized = 'priced';
    }
    const keys = [`purch.status.${group}.${normalized}`];
    if (group === 'receipt') keys.push(`purch.status.ord.${value}`);
    for (const key of keys) {
      const text = tK(key);
      if (text && text !== key) return text;
    }
    return String(value);
  }

  function activeLineEntries() {
    const items = Array.isArray(selectedOrder && selectedOrder.items) ? selectedOrder.items : [];
    const entries = [];
    for (let i = 0; i < items.length; i++) {
      if (isLineCancelled(items[i])) continue;
      entries.push({ item: items[i], input: lineInputs[i] || {} });
    }
    return entries;
  }

  function isLineEntryComplete(entry) {
    if (!entry || !entry.input) return false;
    const supplierId = entry.input.supEl && entry.input.supEl.value ? parseInt(String(entry.input.supEl.value), 10) : null;
    const priceRaw = entry.input.priceEl ? String(entry.input.priceEl.value).trim() : '';
    const unitPrice = priceRaw === '' ? null : parseLocaleDecimalInput(priceRaw);
    const fxRaw = entry.input.fxEl ? String(entry.input.fxEl.value).trim() : '';
    const fxRate = fxRaw === '' ? null : parseFloat(fxRaw.replace(',', '.'));
    const currency = allowedPricingCurrency(entry.input.curEl ? entry.input.curEl.value : 'UZS');
    return (
      Number.isFinite(supplierId) &&
      supplierId > 0 &&
      Number.isFinite(unitPrice) &&
      unitPrice >= 0 &&
      Number.isFinite(fxRate) &&
      fxRate > 0 &&
      (currency === 'UZS' || currency === 'USD')
    );
  }

  function allRequiredPricingFieldsFilled() {
    const entries = activeLineEntries();
    if (!entries.length) return false;
    for (const entry of entries) {
      if (!isLineEntryComplete(entry)) {
        return false;
      }
    }
    return true;
  }

  function updateProcessUiState() {
    const hasOrder = !!selectedOrder;
    const completed = hasOrder && isOrderCompleted(selectedOrder);
    const started = hasOrder && isOrderProcessingStarted(selectedOrder);
    const editable = started && !completed;
    const completeReady = editable && allRequiredPricingFieldsFilled();
    const canRevise = editable && hasOrder;

    if (procLockHint) procLockHint.hidden = !hasOrder || editable;

    for (const line of lineInputs) {
      if (!line) continue;
      [line.supSearchEl, line.supEl, line.priceEl, line.curEl, line.fxEl, line.supCmbBtn].forEach((el) => {
        if (!el) return;
        if (el.closest('tr') && el.closest('tr').classList.contains('po-line-cancelled')) return;
        el.disabled = !editable;
      });
    }

    if (btnPrint) btnPrint.disabled = !hasOrder;
    if (btnPrintDlg) btnPrintDlg.disabled = !hasOrder;
    if (btnStart) btnStart.disabled = !hasOrder || started || completed;
    if (btnSavePricing) btnSavePricing.disabled = !editable;
    if (btnCompleteOrder) btnCompleteOrder.disabled = !completeReady;
    if (btnReviseOrder) btnReviseOrder.disabled = !canRevise;
  }

  function isLineCancelled(it) {
    return !!(it && (it.is_line_cancelled || String(it.line_status || '').toLowerCase() === 'cancelled'));
  }

  function allowedPricingCurrency(raw) {
    const cur = String(raw || '').trim().toUpperCase();
    if (cur === 'USD') return 'USD';
    return 'UZS';
  }

  function currencyOptionsHtml(selected) {
    const cur = allowedPricingCurrency(selected);
    return `
      <option value="UZS"${cur === 'UZS' ? ' selected' : ''}>UZS</option>
      <option value="USD"${cur === 'USD' ? ' selected' : ''}>USD</option>
    `;
  }

  function openCancelModal(itemId) {
    cancelLineItemId = itemId != null ? String(itemId) : null;
    if (cancelLineReason) cancelLineReason.value = '';
    if (cancelLineModal) {
      cancelLineModal.classList.add('proc-modal-open');
      if (cancelLineReason) cancelLineReason.focus();
    }
  }

  function closeCancelModal() {
    cancelLineItemId = null;
    if (cancelLineModal) cancelLineModal.classList.remove('proc-modal-open');
    if (cancelLineReason) cancelLineReason.value = '';
  }

  async function loadSuppliers() {
    const { ok, data } = await window.purApi('/api/purchasing/suppliers');
    if (ok && data && data.ok) {
      const raw = data.suppliers || [];
      suppliers = raw.filter((row) => !/^tedarikçi\s+bekleniyor$/i.test(String(row.name || '').trim()));
    }
    refreshAllSupplierDropdowns();
  }

  function supplierOptionsHtml(selectedId) {
    let html = '<option value="">—</option>';
    suppliers.forEach((row) => {
      const selected = String(row.id) === String(selectedId) ? ' selected' : '';
      html += `<option value="${esc(row.id)}"${selected}>${esc(fmtDisplayUpper(row.name))}</option>`;
    });
    return html;
  }

  function refreshAllSupplierDropdowns() {
    if (!linesDetailBody) return;
    linesDetailBody.querySelectorAll('.proc-sup-cmb').forEach((cmb) => {
      const labelEl = cmb.querySelector('.proc-sup-cmb-label');
      const supEl = cmb.querySelector('.po-line-sup');
      if (!labelEl || !supEl) return;
      const id = String(supEl.value || '');
      const row = id ? suppliers.find((r) => String(r.id) === id) : null;
      const text = row ? fmtDisplayUpper(row.name || '') : '';
      labelEl.textContent = text || tK('purch.proc.supSearchPh');
      labelEl.classList.toggle('is-placeholder', !text);
    });
  }

  function closeAllSupCombos(except) {
    if (!linesDetailBody) return;
    linesDetailBody.querySelectorAll('.proc-sup-cmb.is-open').forEach((cmb) => {
      if (cmb === except) return;
      const panel = cmb.querySelector('.proc-sup-cmb-panel');
      const btn = cmb.querySelector('.proc-sup-cmb-btn');
      if (panel) panel.hidden = true;
      cmb.classList.remove('is-open');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('.proc-sup-cmb')) return;
    if (e.target.closest('.proc-sup-cmb-panel')) return;
    closeAllSupCombos();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllSupCombos();
  });

  async function loadIncomingOrders(keepSelection) {
    const prevSelectedId = keepSelection ? currentOrderId() : null;
    const { ok, data } = await window.purApi('/api/purchasing/orders?forPricing=1&buyerStatus=draft');
    if (!ok || !data || !data.ok) {
      ordBody.innerHTML = '<tr><td colspan="5">—</td></tr>';
      return;
    }
    const rows = data.orders || [];
    if (!rows.length) {
      ordBody.innerHTML = `<tr><td colspan="5">${esc(tK('purch.proc.noIncomingV2'))}</td></tr>`;
      if (!keepSelection) {
        selectedOrder = null;
        lineInputs = [];
        if (orderFormBlock) orderFormBlock.hidden = true;
        if (detailEmpty) detailEmpty.hidden = false;
      }
      return;
    }
    ordBody.innerHTML = rows
      .map((row) => {
        const id = row.id;
        const sel = prevSelectedId != null && Number(id) === Number(prevSelectedId) ? ' po-row-sel' : '';
        return `<tr data-oid="${esc(id)}" class="po-row${sel}">
          <td>${esc(fmtDisplayUpper(row.order_code || row.id))}</td>
          <td>${esc(fmtDisplayUpper(row.project_code || row.project_label || '—'))}</td>
          <td>${esc(statusLabel('receipt', row.receipt_status || row.status))}</td>
          <td>${esc(statusLabel('pricing', row.pricing_status))}</td>
          <td>${esc(String(row.order_date || row.created_at || '').slice(0, 10))}</td>
        </tr>`;
      })
      .join('');
    ordBody.querySelectorAll('.po-row').forEach((tr) => {
      tr.addEventListener('click', async () => {
        const id = tr.getAttribute('data-oid');
        highlightSelectedOrder(id);
        await selectOrder(id);
      });
    });
  }

  function highlightSelectedOrder(id) {
    document.querySelectorAll('#ordBody .po-row').forEach((x) => x.classList.remove('po-row-sel'));
    document.querySelectorAll('#activeOrdBody .po-row').forEach((x) => x.classList.remove('po-row-sel'));
    document.querySelectorAll('#completedOrdBody .po-row').forEach((x) => x.classList.remove('po-row-sel'));
    const tr = document.querySelector(`#ordBody .po-row[data-oid="${id}"]`);
    const trActive = document.querySelector(`#activeOrdBody .po-row[data-oid="${id}"]`);
    const trCompleted = document.querySelector(`#completedOrdBody .po-row[data-oid="${id}"]`);
    if (tr) tr.classList.add('po-row-sel');
    if (trActive) trActive.classList.add('po-row-sel');
    if (trCompleted) trCompleted.classList.add('po-row-sel');
  }

  async function loadActiveOrders(keepSelection) {
    if (!activeOrdBody) return;
    const prevSelectedId = keepSelection ? currentOrderId() : null;
    const { ok, data } = await window.purApi('/api/purchasing/orders?buyerStatus=in_progress,prices_saved,revision_requested');
    if (!ok || !data || !data.ok) {
      activeOrdBody.innerHTML = '<tr><td colspan="6">—</td></tr>';
      return;
    }
    const rows = data.orders || [];
    if (!rows.length) {
      activeOrdBody.innerHTML = `<tr><td colspan="6">${esc(tK('purch.proc.noActive'))}</td></tr>`;
      return;
    }
    activeOrdBody.innerHTML = rows
      .map((row) => {
        const id = row.id;
        const sel = prevSelectedId != null && Number(id) === Number(prevSelectedId) ? ' po-row-sel' : '';
        return `<tr data-oid="${esc(id)}" class="po-row${sel}">
          <td>${esc(fmtDisplayUpper(row.order_code || row.id))}</td>
          <td>${esc(fmtDisplayUpper(row.project_code || row.project_label || '—'))}</td>
          <td>${esc(statusLabel('receipt', row.receipt_status || row.status))}</td>
          <td>${esc(statusLabel('pricing', row.pricing_status))}</td>
          <td>${esc(statusLabel('buyer', row.buyer_status || row.buyer_state || 'draft'))}</td>
          <td>${esc(String(row.order_date || row.created_at || '').slice(0, 10))}</td>
        </tr>`;
      })
      .join('');
    activeOrdBody.querySelectorAll('.po-row').forEach((tr) => {
      tr.addEventListener('click', async () => {
        const id = tr.getAttribute('data-oid');
        highlightSelectedOrder(id);
        await selectOrder(id);
      });
    });
  }

  async function loadCompletedOrders(keepSelection) {
    if (!completedOrdBody) return;
    const prevSelectedId = keepSelection ? currentOrderId() : null;
    const { ok, data } = await window.purApi('/api/purchasing/orders?completedByBuyer=1');
    if (!ok || !data || !data.ok) {
      completedOrdBody.innerHTML = '<tr><td colspan="6">—</td></tr>';
      return;
    }
    const rows = data.orders || [];
    if (!rows.length) {
      completedOrdBody.innerHTML = `<tr><td colspan="6">${esc(tK('purch.proc.noCompleted'))}</td></tr>`;
      return;
    }
    completedOrdBody.innerHTML = rows
      .map((row) => {
        const id = row.id;
        const sel = prevSelectedId != null && Number(id) === Number(prevSelectedId) ? ' po-row-sel' : '';
        return `<tr data-oid="${esc(id)}" class="po-row${sel}">
          <td>${esc(fmtDisplayUpper(row.order_code || row.id))}</td>
          <td>${esc(fmtDisplayUpper(row.project_code || row.project_label || '—'))}</td>
          <td>${esc(statusLabel('receipt', row.receipt_status || row.status))}</td>
          <td>${esc(statusLabel('pricing', row.pricing_status))}</td>
          <td>${esc(statusLabel('buyer', row.buyer_status || row.buyer_state || 'draft'))}</td>
          <td>${esc(String(row.order_date || row.created_at || '').slice(0, 10))}</td>
        </tr>`;
      })
      .join('');
    completedOrdBody.querySelectorAll('.po-row').forEach((tr) => {
      tr.addEventListener('click', async () => {
        const id = tr.getAttribute('data-oid');
        highlightSelectedOrder(id);
        await selectOrder(id);
      });
    });
  }

  function renderBadges(order) {
    if (!orderBadges) return;
    orderBadges.innerHTML = [
      `<span class="proc-badge">${esc(tK('purch.proc.colReceiptStatus'))}: ${esc(statusLabel('receipt', order.receipt_status || order.status))}</span>`,
      `<span class="proc-badge">${esc(tK('purch.proc.colPricingStatus'))}: ${esc(statusLabel('pricing', order.pricing_status))}</span>`,
      `<span class="proc-badge">${esc(tK('purch.proc.colBuyerStatus'))}: ${esc(statusLabel('buyer', order.buyer_status || order.buyer_state || 'draft'))}</span>`,
      `<span class="proc-badge">${esc(tK('purch.col.supplier'))}: ${esc(fmtDisplayUpper(order.supplier_name || '—'))}</span>`,
    ].join('');
  }

  async function selectOrder(id) {
    selectedOrder = null;
    lineInputs = [];
    const { ok, data, status } = await window.purApi('/api/purchasing/orders/' + encodeURIComponent(id));
    if (!ok || !data || !data.ok || !data.order) {
      showMsg(apiMsg(data) || `HTTP ${status}`, true);
      return;
    }
    selectedOrder = data.order;
    if (detailEmpty) detailEmpty.hidden = true;
    if (orderFormBlock) orderFormBlock.hidden = false;
    openProcDialog();

    const order = selectedOrder;
    const projectLabel = fmtDisplayUpper(order.project_label || order.project_code || '—');
    if (orderMeta) {
      orderMeta.textContent = `${fmtDisplayUpper(order.order_code || order.id)} · ${projectLabel}`;
    }
    renderBadges(order);

    document.querySelectorAll('.proc-sup-cmb-panel').forEach((p) => {
      if (p && p.parentNode && (!linesDetailBody || !linesDetailBody.contains(p))) {
        try { p.parentNode.removeChild(p); } catch (e) { /* ignore */ }
      }
    });
    const items = Array.isArray(order.items) ? order.items : [];
    lineInputs = items.map(() => ({}));
    linesDetailBody.innerHTML = items
      .map((it, i) => {
        const cancelled = isLineCancelled(it);
        const lineCurrency = allowedPricingCurrency(it.currency || order.currency || 'UZS');
        const fxRate =
          it.fx_rate != null && it.fx_rate !== ''
            ? String(it.fx_rate)
            : '';
        const rowCls = cancelled ? ' class="po-line-cancelled"' : '';
        const cancelReasonHtml =
          cancelled && it.cancel_reason
            ? `<div class="proc-cancel-badge">${esc(tK('purch.proc.lineCancelledBadge'))}</div><div class="text-meta proc-cancel-reason-text"><strong>${esc(tK('purch.proc.cancelReasonPrefix'))}</strong> ${esc(it.cancel_reason)}</div>`
            : '';
        const recv = Number(it.qty_received) || 0;
        const canCancel = !cancelled && recv <= 0.0001;
        const cancelBtn = cancelled
          ? '—'
          : `<button type="button" class="btn btn-danger btn-sm po-line-cancel text-ui" data-action="cancel-line" data-perm-any="module.purchasing module.purchasing.approve purchasing.order.price_edit" data-oi="${esc(it.id)}" ${canCancel ? '' : 'disabled title="' + esc(tK('purch.proc.cancelLineDisabledReceipt')) + '"'}">${esc(tK('purch.proc.btnCancelLine'))}</button>`;
        const supSelectedId = String(it.line_supplier_id || order.supplier_id || '');
        const supSelectedRow = suppliers.find((s) => String(s.id) === supSelectedId);
        const supLabel = supSelectedRow ? fmtDisplayUpper(supSelectedRow.name || '') : '';
        return `<tr${rowCls}>
          <td class="proc-col-prod"><span class="text-meta proc-product-code-muted">${esc(fmtDisplayUpper(it.product_code || ''))}</span><br/><span class="proc-prod-name">${esc(fmtDisplayUpper(it.product_name || ''))}</span>${cancelReasonHtml}</td>
          <td class="proc-col-qty r-stock">${qtyCellPlain(it, it.qty_ordered)}</td>
          <td class="proc-col-qty r-stock">${qtyCellPlain(it, it.qty_received)}</td>
          <td class="proc-col-qty r-stock">${qtyCellPlain(it, it.qty_remaining)}</td>
          <td class="proc-col-supplier">
            <div class="proc-sup-cmb" data-i="${i}">
              <input type="hidden" class="po-line-sup" data-i="${i}" value="${esc(supSelectedId)}" />
              <button type="button" class="proc-sup-cmb-btn" data-i="${i}" ${cancelled ? 'disabled' : ''} aria-haspopup="listbox" aria-expanded="false">
                <span class="proc-sup-cmb-label${supLabel ? '' : ' is-placeholder'}">${esc(supLabel || tK('purch.proc.supSearchPh'))}</span>
                <span class="proc-sup-cmb-caret" aria-hidden="true">▾</span>
              </button>
              <div class="proc-sup-cmb-panel" hidden>
                <input type="text" class="app-input proc-sup-cmb-search" data-i="${i}" data-i18n-placeholder="purch.proc.supSearchPh" />
                <ul class="proc-sup-cmb-list" data-i="${i}" role="listbox"></ul>
              </div>
            </div>
          </td>
          <td><input type="text" class="pur-inp po-line-price app-input proc-line-price-input" inputmode="decimal" autocomplete="off" data-i="${i}" value="${esc(fmtUnitPriceFieldDisplay(it.unit_price))}" title="${esc(fmtMoneyDisplay(it.unit_price))}" ${cancelled ? 'disabled' : ''} /></td>
          <td><input type="text" class="pur-inp po-line-total app-input" data-i="${i}" value="${esc(fmtMoneyDisplay((Number(it.qty_ordered) || 0) * (Number(it.unit_price) || 0)))}" readonly /></td>
          <td class="proc-col-cur"><select class="pur-inp po-line-cur app-select" data-i="${i}" ${cancelled ? 'disabled' : ''}>${currencyOptionsHtml(lineCurrency)}</select></td>
          <td class="proc-col-fx"><input type="number" class="pur-inp po-line-fx app-input" data-i="${i}" min="0" step="0.0001" value="${esc(fmtFxInputValue(fxRate))}" ${cancelled ? 'disabled' : ''} /></td>
          <td class="po-line-actions-cell proc-col-actions">${cancelBtn}</td>
        </tr>`;
      })
      .join('');

    // Dinamik cancel-line buton gating'i (data-perm-any taşır).
    if (window.authContext && typeof window.authContext.applyActionPermissionGating === 'function') {
      window.authContext.applyActionPermissionGating(linesDetailBody);
    }
    linesDetailBody.querySelectorAll('.po-line-sup').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i].supEl = el;
    });
    linesDetailBody.querySelectorAll('.proc-sup-cmb').forEach((cmb) => {
      const i = parseInt(cmb.getAttribute('data-i'), 10);
      const btn = cmb.querySelector('.proc-sup-cmb-btn');
      const panel = cmb.querySelector('.proc-sup-cmb-panel');
      const search = cmb.querySelector('.proc-sup-cmb-search');
      const list = cmb.querySelector('.proc-sup-cmb-list');
      const labelEl = cmb.querySelector('.proc-sup-cmb-label');
      lineInputs[i].supSearchEl = search;
      lineInputs[i].supCmb = cmb;
      lineInputs[i].supCmbBtn = btn;

      function renderList() {
        if (!list) return;
        const q = String((search && search.value) || '').trim().toLowerCase();
        const cur = lineInputs[i].supEl ? String(lineInputs[i].supEl.value || '') : '';
        const filtered = q ? suppliers.filter((r) => String(r.name || '').toLowerCase().includes(q)) : suppliers;
        const opts = [`<li role="option" data-id="" class="proc-sup-cmb-opt${cur === '' ? ' is-active' : ''}">—</li>`];
        filtered.forEach((row) => {
          const sel = String(row.id) === cur ? ' is-active' : '';
          opts.push(`<li role="option" data-id="${esc(row.id)}" class="proc-sup-cmb-opt${sel}">${esc(fmtDisplayUpper(row.name))}</li>`);
        });
        list.innerHTML = opts.join('');
      }

      function positionPanel() {
        if (!panel || !btn || panel.hidden) return;
        const rect = btn.getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        const desired = Math.max(rect.width, 260);
        const width = Math.min(desired, vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
        const panelHeight = panel.offsetHeight || 280;
        let top = rect.bottom + 4;
        if (top + panelHeight > vh - 8) {
          const altTop = rect.top - panelHeight - 4;
          if (altTop > 8) top = altTop;
          else top = Math.max(8, vh - panelHeight - 8);
        }
        panel.style.width = width + 'px';
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
      }

      function bindReposition(on) {
        const fn = positionPanel;
        if (on) {
          window.addEventListener('scroll', fn, true);
          window.addEventListener('resize', fn);
          lineInputs[i]._supCmbReposition = fn;
        } else if (lineInputs[i]._supCmbReposition) {
          window.removeEventListener('scroll', lineInputs[i]._supCmbReposition, true);
          window.removeEventListener('resize', lineInputs[i]._supCmbReposition);
          lineInputs[i]._supCmbReposition = null;
        }
      }

      function openPanel() {
        if (!panel || btn?.disabled) return;
        closeAllSupCombos(cmb);
        const host = procDlg && procDlg.open ? procDlg : document.body;
        if (panel.parentNode !== host) {
          host.appendChild(panel);
        }
        panel.hidden = false;
        cmb.classList.add('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        renderList();
        positionPanel();
        bindReposition(true);
        if (search) {
          search.value = '';
          setTimeout(() => search.focus(), 0);
        }
      }

      function closePanel() {
        if (!panel) return;
        panel.hidden = true;
        cmb.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        bindReposition(false);
      }

      lineInputs[i].closeSupPanel = closePanel;

      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (panel && panel.hidden) openPanel();
          else closePanel();
        });
      }
      if (search) {
        search.addEventListener('input', renderList);
        search.addEventListener('click', (e) => e.stopPropagation());
        search.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            closePanel();
            if (btn) btn.focus();
          } else if (e.key === 'Enter') {
            const first = list && list.querySelector('.proc-sup-cmb-opt');
            if (first) first.click();
          }
        });
      }
      if (list) {
        list.addEventListener('click', (e) => {
          const li = e.target.closest('.proc-sup-cmb-opt');
          if (!li) return;
          const id = li.getAttribute('data-id') || '';
          const supEl = lineInputs[i].supEl;
          if (supEl) {
            supEl.value = id;
            supEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (labelEl) {
            const row = id ? suppliers.find((r) => String(r.id) === String(id)) : null;
            const text = row ? fmtDisplayUpper(row.name || '') : '';
            labelEl.textContent = text || tK('purch.proc.supSearchPh');
            labelEl.classList.toggle('is-placeholder', !text);
          }
          closePanel();
        });
      }
    });
    linesDetailBody.querySelectorAll('.po-line-price').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i].priceEl = el;
    });
    linesDetailBody.querySelectorAll('.po-line-cur').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i].curEl = el;
    });
    linesDetailBody.querySelectorAll('.po-line-total').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i].totalEl = el;
    });
    linesDetailBody.querySelectorAll('.po-line-fx').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i].fxEl = el;
    });
    linesDetailBody.querySelectorAll('.po-line-sup, .po-line-price, .po-line-cur, .po-line-fx').forEach((el) => {
      const isHiddenSup = el.classList.contains('po-line-sup');
      const ev = el.tagName === 'SELECT' || isHiddenSup ? 'change' : 'input';
      el.addEventListener(ev, () => {
        const idx = parseInt(el.getAttribute('data-i'), 10);
        syncLineTotalCell(idx);
        updateProcessUiState();
      });
      if (ev !== 'change') {
        el.addEventListener('change', () => {
          const idx = parseInt(el.getAttribute('data-i'), 10);
          syncLineTotalCell(idx);
          updateProcessUiState();
        });
      }
      if (el.classList.contains('po-line-price')) {
        el.addEventListener('blur', () => {
          formatUnitPriceInput(el);
          const idx = parseInt(el.getAttribute('data-i'), 10);
          syncLineTotalCell(idx);
          updateProcessUiState();
        });
      }
    });
    syncAllLineTotals();
    updateProcessUiState();
    if (window.i18n && window.i18n.apply) {
      window.i18n.apply(orderFormBlock);
      if (procDlg) window.i18n.apply(procDlg);
    }
    applyTitleCase(orderFormBlock);
    if (procDlg) applyTitleCase(procDlg);
  }

  function formatAllUnitPriceInputs() {
    lineInputs.forEach((row) => {
      if (row && row.priceEl) formatUnitPriceInput(row.priceEl);
    });
  }

  function collectPricingLines() {
    if (!selectedOrder) return { error: tK('api.pur.order_not_found'), lines: [] };
    const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    const lines = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (isLineCancelled(item)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const input = lineInputs[i] || {};
      const supplierId = input.supEl && input.supEl.value ? parseInt(String(input.supEl.value), 10) : null;
      const priceRaw = input.priceEl ? String(input.priceEl.value).trim() : '';
      const unitPrice = priceRaw === '' ? null : parseLocaleDecimalInput(priceRaw);
      const currency = allowedPricingCurrency(input.curEl ? input.curEl.value : 'UZS');
      const fxRaw = input.fxEl ? String(input.fxEl.value).trim() : '';
      const fxRate = fxRaw === '' ? null : parseFloat(fxRaw.replace(',', '.'));
      if (!Number.isFinite(supplierId) || supplierId < 1) {
        return { error: tK('purch.proc.errSupLine') };
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return { error: tK('purch.proc.errPriceLine') };
      }
      if (!Number.isFinite(fxRate) || fxRate <= 0) {
        return { error: tK('api.pur.fx_required') };
      }
      lines.push({
        orderItemId: item.id,
        supplierId,
        unitPrice,
        currency,
        fxRate,
      });
    }
    if (!lines.length) {
      const hasActive = items.some((it) => !isLineCancelled(it));
      if (!hasActive) {
        return { error: tK('purch.proc.saveNoOpenLines') };
      }
      return { error: tK('purch.proc.completeMissingRequired') };
    }
    return { lines };
  }

  async function startProcessing() {
    const id = currentOrderId();
    if (id == null) {
      showMsg(tK('api.pur.order_not_found'), true);
      return;
    }
    const { ok, data, status } = await window.purApi(`/api/purchasing/orders/${encodeURIComponent(id)}/start-processing`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!ok) {
      showMsg(apiMsg(data) || `HTTP ${status}`, true);
      return;
    }
    showMsg(tK('purch.proc.startOkV2'));
    await loadIncomingOrders(true);
    await loadActiveOrders(true);
    await loadCompletedOrders(true);
    await selectOrder(String(id));
    highlightSelectedOrder(String(id));
  }

  async function savePricing() {
    const id = currentOrderId();
    if (id == null) {
      showMsg(tK('api.pur.order_not_found'), true);
      return;
    }
    formatAllUnitPriceInputs();
    const collected = collectPricingLines();
    if (collected.error) {
      showMsg(collected.error, true);
      if (window.appNotify && typeof window.appNotify.modalError === 'function') {
        window.appNotify.modalError(collected.error, tK('ui.notify.errorTitle'));
      }
      return;
    }
    if (!collected.lines.length) {
      const errText = tK('purch.proc.completeNeedAtLeastOne');
      showMsg(errText, true);
      if (window.appNotify && typeof window.appNotify.modalError === 'function') {
        window.appNotify.modalError(errText, tK('ui.notify.errorTitle'));
      }
      return;
    }
    const { ok, data, status } = await window.purApi(`/api/purchasing/orders/${encodeURIComponent(id)}/pricing`, {
      method: 'PUT',
      body: JSON.stringify({ lines: collected.lines }),
    });
    if (!ok) {
      showMsg(apiMsg(data) || `HTTP ${status}`, true);
      return;
    }
    showMsg(`${tK('purch.proc.saved')} ${statusLabel('pricing', data.pricingStatus)}`);
    await loadIncomingOrders(true);
    await loadActiveOrders(true);
    await loadCompletedOrders(true);
    await selectOrder(String(id));
    highlightSelectedOrder(String(id));
  }

  async function completeOrder() {
    const id = currentOrderId();
    if (id == null) {
      showMsg(tK('api.pur.order_not_found'), true);
      return;
    }
    if (!isOrderProcessingStarted(selectedOrder)) {
      showMsg(tK('purch.proc.startRequired'), true);
      return;
    }
    if (!allRequiredPricingFieldsFilled()) {
      const errText = tK('purch.proc.completeMissingRequired');
      showMsg(errText, true);
      if (window.appNotify && typeof window.appNotify.modalError === 'function') {
        window.appNotify.modalError(errText, tK('ui.notify.errorTitle'));
      }
      return;
    }
    formatAllUnitPriceInputs();
    const collected = collectPricingLines();
    if (collected.error) {
      showMsg(collected.error, true);
      if (window.appNotify && typeof window.appNotify.modalError === 'function') {
        window.appNotify.modalError(collected.error, tK('ui.notify.errorTitle'));
      }
      return;
    }
    const { ok: saveOk, data: saveData, status: saveStatus } = await window.purApi(`/api/purchasing/orders/${encodeURIComponent(id)}/pricing`, {
      method: 'PUT',
      body: JSON.stringify({ lines: collected.lines }),
    });
    const pricingReadonly =
      !saveOk && saveData && typeof saveData === 'object' && String(saveData.messageKey || '') === 'api.pur.order_readonly';
    if (!saveOk && !pricingReadonly) {
      const errText = apiMsg(saveData) || `HTTP ${saveStatus}`;
      showMsg(errText, true);
      if (window.appNotify && typeof window.appNotify.modalError === 'function') {
        window.appNotify.modalError(errText, tK('ui.notify.errorTitle'));
      }
      return;
    }
    const { ok, data, status } = await window.purApi(`/api/purchasing/orders/${encodeURIComponent(id)}/buyer-action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'complete' }),
    });
    if (!ok) {
      const errText = apiMsg(data) || `HTTP ${status}`;
      showMsg(errText, true);
      if (window.appNotify && typeof window.appNotify.modalError === 'function') {
        window.appNotify.modalError(errText, tK('ui.notify.errorTitle'));
      }
      return;
    }
    showMsg(tK('purch.proc.completeOk'));
    await loadIncomingOrders(true);
    await loadActiveOrders(true);
    await loadCompletedOrders(true);
    await selectOrder(String(id));
    highlightSelectedOrder(String(id));
  }

  async function postBuyerAction(action) {
    const id = currentOrderId();
    if (id == null) {
      showMsg(tK('api.pur.order_not_found'), true);
      return;
    }
    const { ok, data, status } = await window.purApi(`/api/purchasing/orders/${encodeURIComponent(id)}/buyer-action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    if (!ok) {
      showMsg(apiMsg(data) || `HTTP ${status}`, true);
      return;
    }
    const msgKey =
      action === 'complete'
        ? 'purch.proc.completeOk'
        : action === 'revise'
          ? 'purch.proc.reviseOk'
          : 'purch.proc.startOkV2';
    showMsg(tK(msgKey));
    await loadIncomingOrders(true);
    await loadActiveOrders(true);
    await loadCompletedOrders(true);
    await selectOrder(String(id));
    highlightSelectedOrder(String(id));
  }

  function buildOrderPrintHtml(order) {
    const items = Array.isArray(order && order.items) ? order.items : [];
    const orderCode = fmtDisplayUpper(order.order_code || order.id || '');
    const projectLine =
      `${fmtDisplayUpper(order.project_code || '—')}` +
      (order.project_name ? ` — ${fmtDisplayUpper(order.project_name)}` : order.project_label ? ` — ${fmtDisplayUpper(order.project_label)}` : '');
    const orderDate = String(order.order_date || order.created_at || '').slice(0, 10);
    const supplierName = fmtDisplayUpper(order.supplier_name || '—');

    let totalAll = 0;
    const rows = items
      .map((it, idx) => {
        const cancelled = isLineCancelled(it);
        const qty = Number(it.qty_ordered) || 0;
        const unitPrice = Number(it.unit_price) || 0;
        const lineTotal = qty * unitPrice;
        if (!cancelled) totalAll += lineTotal;
        const cur = allowedPricingCurrency(it.currency || order.currency || 'UZS');
        const fxRate =
          it.fx_rate != null && it.fx_rate !== ''
            ? Number(it.fx_rate)
            : null;
        const supplierLabel = (() => {
          const id = it.line_supplier_id || order.supplier_id;
          const row = id ? suppliers.find((r) => String(r.id) === String(id)) : null;
          return row ? fmtDisplayUpper(row.name || '') : (order.supplier_name ? fmtDisplayUpper(order.supplier_name) : '—');
        })();
        return `<tr${cancelled ? ' class="row-cancelled"' : ''}>
          <td class="cnum">${idx + 1}</td>
          <td class="cprod">${it.product_code ? `<div class="pc"><strong>${esc(fmtDisplayUpper(it.product_code))}</strong></div>` : ''}<div class="pn">${esc(fmtDisplayUpper(it.product_name || ''))}</div>${cancelled ? `<div class="cancelled-tag">${esc(tK('purch.proc.lineCancelledBadge'))}</div>` : ''}</td>
          <td class="cqty">${esc(fmtQty(qty))} ${esc(primaryUnit(it))}</td>
          <td class="csup">${esc(supplierLabel)}</td>
          <td class="cprice">${esc(fmtMoneyDisplay(unitPrice))}</td>
          <td class="ctotal">${esc(fmtMoneyDisplay(lineTotal))}</td>
          <td class="ccur">${esc(cur)}</td>
          <td class="cfx">${fxRate != null && Number.isFinite(fxRate) ? esc(fmtMoneyDisplay(fxRate)) : '—'}</td>
        </tr>`;
      })
      .join('');

    const styles = `
      @page { size: A4 landscape; margin: 12mm 14mm; }
      * { box-sizing: border-box; }
      body { font: 11px/1.45 Arial, Helvetica, sans-serif; color:#111; margin:0; }
      h1 { font-size: 17px; margin: 0 0 6px; letter-spacing:.5px; }
      .meta { display:grid; grid-template-columns: repeat(3, 1fr); gap: 4px 20px; margin: 6px 0 12px; font-size: 11px; }
      .meta div { padding: 2px 0; }
      table.print-items { width:100%; border-collapse: collapse; table-layout: fixed; }
      table.print-items th, table.print-items td { border:1px solid #888; padding:6px 8px; vertical-align: top; }
      table.print-items th { background:#eee; text-align:left; font-size: 10px; }
      table.print-items td.cnum { width: 28px; text-align:center; white-space:nowrap; }
      table.print-items th.cw-prod, table.print-items td.cprod {
        width: 32%;
        white-space: normal !important;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      table.print-items td.cprod .pc { font-size: 10px; color:#333; margin-bottom: 3px; }
      table.print-items td.cprod .pn { font-size: 11px; font-weight: 600; }
      table.print-items td.cprod .cancelled-tag { margin-top: 3px; font-size: 9px; color:#b91c1c; }
      table.print-items th.cw-qty, table.print-items td.cqty { width: 9%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      table.print-items th.cw-sup, table.print-items td.csup {
        width: 18%;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      table.print-items th.cw-price, table.print-items td.cprice { width: 11%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      table.print-items th.cw-total, table.print-items td.ctotal { width: 11%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      table.print-items th.cw-cur, table.print-items td.ccur { width: 6%; text-align: center; white-space: nowrap; }
      table.print-items th.cw-fx, table.print-items td.cfx { width: 8%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      tr.row-cancelled td { color:#94a3b8; text-decoration: line-through; }
      tfoot td { font-weight: 700; background:#f8fafc; }
      .footer { margin-top: 22px; display:grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      .sig { border-top:1px solid #444; padding-top: 6px; text-align:center; font-size: 10px; }
      @media print {
        a { color:#000; text-decoration: none; }
        table.print-items th, table.print-items td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;

    return `<!DOCTYPE html><html lang="tr"><head>
      <meta charset="UTF-8" />
      <title>${esc(orderCode)}</title>
      <style>${styles}</style>
    </head><body>
      <h1>${esc(tK('purch.proc.printTitle'))}</h1>
      <div class="meta">
        <div><strong>${esc(tK('purch.proc.colOrderCode'))}:</strong> ${esc(orderCode)}</div>
        <div><strong>${esc(tK('purch.wf.colDate'))}:</strong> ${esc(orderDate)}</div>
        <div><strong>${esc(tK('purch.req.lColProject'))}:</strong> ${esc(projectLine)}</div>
        <div><strong>${esc(tK('purch.col.supplier'))}:</strong> ${esc(supplierName)}</div>
        <div><strong>${esc(tK('purch.proc.colReceiptStatus'))}:</strong> ${esc(statusLabel('receipt', order.receipt_status || order.status))}</div>
        <div><strong>${esc(tK('purch.proc.colPricingStatus'))}:</strong> ${esc(statusLabel('pricing', order.pricing_status))}</div>
      </div>
      <table class="print-items">
        <thead><tr>
          <th>#</th>
          <th class="cw-prod">${esc(tK('purch.proc.colProductName'))}</th>
          <th class="cw-qty">${esc(tK('purch.gr.colOrderQty'))}</th>
          <th class="cw-sup">${esc(tK('purch.col.supplier'))}</th>
          <th class="cw-price">${esc(tK('purch.col.unitPrice'))}</th>
          <th class="cw-total">${esc(tK('purch.proc.colLineTotal'))}</th>
          <th class="cw-cur">${esc(tK('purch.cur'))}</th>
          <th class="cw-fx">${esc(tK('purch.proc.colFxRate'))}</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="8">—</td></tr>`}</tbody>
        <tfoot><tr>
          <td colspan="5" style="text-align:right">${esc(tK('purch.proc.printGrandTotal'))}</td>
          <td class="ctotal">${esc(fmtMoneyDisplay(totalAll))}</td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table>
      <div class="footer">
        <div class="sig">${esc(tK('purch.print.sigRequester'))}</div>
        <div class="sig">${esc(tK('purch.print.sigApprover'))}</div>
        <div class="sig">${esc(tK('purch.print.sigBuyer'))}</div>
      </div>
    </body></html>`;
  }

  function printInIframe(htmlPayload) {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      let done = false;
      let timer = null;
      function cleanup() {
        if (done) return;
        done = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        try {
          iframe.remove();
        } catch (e) {
          /* ignore */
        }
        resolve();
      }
      iframe.addEventListener(
        'load',
        async () => {
          try {
            const win = iframe.contentWindow;
            if (win && win.document && win.document.images) {
              const imgs = win.document.images;
              const promises = [];
              for (let i = 0; i < imgs.length; i += 1) {
                const im = imgs[i];
                if (im.complete) continue;
                promises.push(
                  new Promise((res) => {
                    im.addEventListener('load', () => res(), { once: true });
                    im.addEventListener('error', () => res(), { once: true });
                  })
                );
              }
              if (promises.length) await Promise.all(promises);
            }
          } catch (e) {
            /* ignore */
          }
          try {
            iframe.contentWindow.addEventListener(
              'afterprint',
              () => setTimeout(cleanup, 200),
              { once: true }
            );
          } catch (e) {
            /* ignore */
          }
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            cleanup();
            return;
          }
          timer = setTimeout(cleanup, 30000);
        },
        { once: true }
      );
      iframe.addEventListener('error', cleanup, { once: true });
      document.body.appendChild(iframe);
      try {
        iframe.srcdoc = htmlPayload;
      } catch (e) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          doc.open();
          doc.write(htmlPayload);
          doc.close();
        } catch (e2) {
          cleanup();
        }
      }
    });
  }

  async function printOrder() {
    if (!selectedOrder) {
      showMsg(tK('purch.proc.selectPo'), true);
      return;
    }
    if (btnPrint) btnPrint.disabled = true;
    if (btnPrintDlg) btnPrintDlg.disabled = true;
    try {
      await printInIframe(buildOrderPrintHtml(selectedOrder));
    } finally {
      if (btnPrint) btnPrint.disabled = !selectedOrder;
      if (btnPrintDlg) btnPrintDlg.disabled = !selectedOrder;
    }
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => {
        location.href = '/login.html';
      });
    });
  }

  if (btnStart) btnStart.addEventListener('click', startProcessing);
  if (btnPrint) btnPrint.addEventListener('click', printOrder);
  if (btnPrintDlg) btnPrintDlg.addEventListener('click', printOrder);
  if (procDlgClose) procDlgClose.addEventListener('click', () => closeProcDialog());
  if (procDlg) {
    procDlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeProcDialog();
    });
    procDlg.addEventListener('click', (e) => {
      if (e.target === procDlg) closeProcDialog();
    });
  }
  if (btnSavePricing) btnSavePricing.addEventListener('click', savePricing);
  if (btnCompleteOrder) btnCompleteOrder.addEventListener('click', completeOrder);
  if (btnReviseOrder) btnReviseOrder.addEventListener('click', () => postBuyerAction('revise'));

  if (linesDetailBody) {
    linesDetailBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="cancel-line"][data-oi]');
      if (!btn || !linesDetailBody.contains(btn)) return;
      const oi = btn.getAttribute('data-oi');
      if (oi) openCancelModal(oi);
    });
  }

  if (cancelLineDismiss) {
    cancelLineDismiss.addEventListener('click', () => closeCancelModal());
  }
  if (cancelLineModal) {
    cancelLineModal.addEventListener('click', (e) => {
      if (e.target === cancelLineModal) closeCancelModal();
    });
  }
  if (cancelLineConfirm) {
    cancelLineConfirm.addEventListener('click', async () => {
      const oid = currentOrderId();
      const iid = cancelLineItemId;
      const reason = cancelLineReason ? String(cancelLineReason.value || '').trim() : '';
      if (oid == null || !iid) {
        closeCancelModal();
        return;
      }
      if (!reason) {
        showMsg(tK('api.pur.cancel_reason_required'), true);
        return;
      }
      const { ok, data, status } = await window.purApi(`/api/purchasing/orders/${encodeURIComponent(oid)}/items/${encodeURIComponent(iid)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!ok) {
        showMsg(apiMsg(data) || `HTTP ${status}`, true);
        return;
      }
      closeCancelModal();
      showMsg(tK('purch.proc.cancelOk'));
      await loadIncomingOrders(true);
      await loadActiveOrders(true);
      await loadCompletedOrders(true);
      await selectOrder(String(oid));
      highlightSelectedOrder(String(oid));
    });
  }

  (async function init() {
    if (window.initPurchasingPageNav) {
      await window.initPurchasingPageNav('proc');
    }
    // Statik aksiyon butonları için permission gating (btnStart, btnSavePricing,
    // btnCompleteOrder, btnReviseOrder). data-perm-any taşımayanlar etkilenmez.
    if (window.authContext && typeof window.authContext.applyActionPermissionGating === 'function') {
      window.authContext.applyActionPermissionGating(document);
    }
    const sc = window.getPurchasingScope ? getPurchasingScope() : { canPurchasing: true };
    if (sc.canPurchasing) {
      await loadSuppliers();
    }
    await loadIncomingOrders(false);
    await loadActiveOrders(false);
    await loadCompletedOrders(false);
    updateProcessUiState();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);
    applyTitleCase(document);

    const langSel = document.getElementById('languageSelect');
    if (langSel) {
      langSel.addEventListener('change', async () => {
        if (sc.canPurchasing) {
          await loadSuppliers();
        }
        const id = currentOrderId();
        await loadIncomingOrders(true);
        await loadActiveOrders(true);
        await loadCompletedOrders(true);
        if (id != null) {
          await selectOrder(String(id));
          highlightSelectedOrder(String(id));
        }
        if (window.i18n && window.i18n.apply) {
          window.i18n.apply(document);
        }
        applyTitleCase(document);
      });
    }
  })();
})();
