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
  const btnSavePricing = document.getElementById('btnSavePricing');
  const btnCompleteOrder = document.getElementById('btnCompleteOrder');
  const btnReviseOrder = document.getElementById('btnReviseOrder');
  const procLockHint = document.getElementById('procLockHint');
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
   * type="number" birim fiyat alanı: görünüm en fazla 2 ondalık (ayırıcı her zaman nokta).
   * Kayıtta input.value parseFloat ile okunur; step=0.0001 ile ince giriş mümkün.
   */
  function fmtUnitPriceInputValue(raw) {
    if (raw == null || raw === '') {
      return '';
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return '';
    }
    return n.toFixed(2);
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

  function orderQtyValue(item) {
    const q = Number(item && item.qty_ordered);
    return Number.isFinite(q) && q > 0 ? q : 0;
  }

  function lineUnitPriceValue(input) {
    const priceRaw = input && input.priceEl ? String(input.priceEl.value || '').trim() : '';
    const unitPrice = priceRaw === '' ? null : parseFloat(priceRaw.replace(',', '.'));
    return Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
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
    const unitPrice = priceRaw === '' ? null : parseFloat(priceRaw.replace(',', '.'));
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
      [line.supSearchEl, line.supEl, line.priceEl, line.curEl, line.fxEl].forEach((el) => {
        if (!el) return;
        if (el.closest('tr') && el.closest('tr').classList.contains('po-line-cancelled')) return;
        el.disabled = !editable;
      });
    }

    if (btnPrint) btnPrint.disabled = !hasOrder;
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
    linesDetailBody.querySelectorAll('.po-line-sup').forEach((el) => {
      const cur = el.value;
      el.innerHTML = supplierOptionsHtml(cur);
    });
  }

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

    const order = selectedOrder;
    const projectLabel = fmtDisplayUpper(order.project_label || order.project_code || '—');
    if (orderMeta) {
      orderMeta.textContent = `${fmtDisplayUpper(order.order_code || order.id)} · ${projectLabel}`;
    }
    renderBadges(order);

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
          : `<button type="button" class="logout-btn po-line-cancel text-ui app-button app-button-danger" data-oi="${esc(it.id)}" ${canCancel ? '' : 'disabled title="' + esc(tK('purch.proc.cancelLineDisabledReceipt')) + '"'}">${esc(tK('purch.proc.btnCancelLine'))}</button>`;
        return `<tr${rowCls}>
          <td><span class="text-meta proc-product-code-muted">${esc(fmtDisplayUpper(it.product_code || ''))}</span><br/>${esc(fmtDisplayUpper(it.product_name || ''))}${cancelReasonHtml}</td>
          <td class="r-stock">${qtyCellHtml(it, it.qty_ordered)}</td>
          <td class="r-stock">${qtyCellHtml(it, it.qty_received)}</td>
          <td class="r-stock">${qtyCellHtml(it, it.qty_remaining)}</td>
          <td>
            <input class="pur-inp po-line-supsearch app-input" data-i="${i}" placeholder="${esc(tK('purch.proc.supSearchPh'))}" ${cancelled ? 'disabled' : ''} />
            <select class="pur-inp po-line-sup app-select" data-i="${i}" ${cancelled ? 'disabled' : ''}>${supplierOptionsHtml(it.line_supplier_id || order.supplier_id || '')}</select>
          </td>
          <td><input type="number" class="pur-inp po-line-price app-input" data-i="${i}" min="0" step="0.0001" value="${esc(fmtUnitPriceInputValue(it.unit_price))}" title="${esc(fmtMoneyDisplay(it.unit_price))}" ${cancelled ? 'disabled' : ''} /></td>
          <td><input type="text" class="pur-inp po-line-total app-input" data-i="${i}" value="${esc(fmtMoneyDisplay((Number(it.qty_ordered) || 0) * (Number(it.unit_price) || 0)))}" readonly /></td>
          <td><select class="pur-inp po-line-cur app-select" data-i="${i}" ${cancelled ? 'disabled' : ''}>${currencyOptionsHtml(lineCurrency)}</select></td>
          <td><input type="number" class="pur-inp po-line-fx app-input" data-i="${i}" min="0" step="0.0001" value="${esc(fmtFxInputValue(fxRate))}" ${cancelled ? 'disabled' : ''} /></td>
          <td class="po-line-actions-cell">${cancelBtn}</td>
        </tr>`;
      })
      .join('');

    linesDetailBody.querySelectorAll('.po-line-sup').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i].supEl = el;
    });
    linesDetailBody.querySelectorAll('.po-line-supsearch').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i].supSearchEl = el;
      el.addEventListener('input', () => {
        const q = String(el.value || '').trim().toLowerCase();
        const sel = lineInputs[i].supEl;
        if (!sel) return;
        const cur = sel.value;
        let html = '<option value="">—</option>';
        const filtered = q ? suppliers.filter((r) => String(r.name || '').toLowerCase().includes(q)) : suppliers;
        filtered.forEach((row) => {
          const selected = String(row.id) === String(cur) ? ' selected' : '';
          html += `<option value="${esc(row.id)}"${selected}>${esc(row.name)}</option>`;
        });
        sel.innerHTML = html;
      });
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
    linesDetailBody.querySelectorAll('.po-line-cancel').forEach((btn) => {
      btn.addEventListener('click', () => {
        const oi = btn.getAttribute('data-oi');
        if (oi) openCancelModal(oi);
      });
    });
    linesDetailBody.querySelectorAll('.po-line-sup, .po-line-price, .po-line-cur, .po-line-fx').forEach((el) => {
      const ev = el.tagName === 'SELECT' ? 'change' : 'input';
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
    });
    syncAllLineTotals();
    updateProcessUiState();
    if (window.i18n && window.i18n.apply) window.i18n.apply(orderFormBlock);
    applyTitleCase(orderFormBlock);
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
      const unitPrice = priceRaw === '' ? null : parseFloat(priceRaw.replace(',', '.'));
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

  function printOrder() {
    if (!selectedOrder) {
      showMsg(tK('purch.proc.selectPo'), true);
      return;
    }
    const id = currentOrderId();
    if (id == null) {
      showMsg(tK('api.pur.order_not_found'), true);
      return;
    }
    const url = `/purchase-order-print.html?id=${encodeURIComponent(id)}&autoprint=1`;
    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
      showMsg(tK('purch.proc.printPopupFallback'), true);
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
  if (btnSavePricing) btnSavePricing.addEventListener('click', savePricing);
  if (btnCompleteOrder) btnCompleteOrder.addEventListener('click', completeOrder);
  if (btnReviseOrder) btnReviseOrder.addEventListener('click', () => postBuyerAction('revise'));

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
