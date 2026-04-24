/**
 * Satınalma işleme ekranı:
 *   Üst: fiyat bekleyen satınalma siparişleri
 *   Alt: seçilen siparişin supplier / price / currency / fx düzenleme formu
 */
(function () {
  const msg = document.getElementById('msg');
  const ordBody = document.getElementById('ordBody');
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

  let suppliers = [];
  let selectedOrder = null;
  let lineInputs = [];

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

  function fmtQty(value) {
    const n = Number(value);
    return Number.isFinite(n) ? String(Number(n.toFixed(4))) : '0';
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
    return `<div style="font-size:11px;color:#64748b">${esc(tK(labelKey))}: ${esc(fmtQty(value))}</div>`;
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

  async function loadSuppliers() {
    const { ok, data } = await window.purApi('/api/purchasing/suppliers');
    if (ok && data && data.ok) suppliers = data.suppliers || [];
    refreshAllSupplierDropdowns();
  }

  function supplierOptionsHtml(selectedId) {
    let html = '<option value="">—</option>';
    suppliers.forEach((row) => {
      const selected = String(row.id) === String(selectedId) ? ' selected' : '';
      html += `<option value="${esc(row.id)}"${selected}>${esc(row.name)}</option>`;
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
    const { ok, data } = await window.purApi('/api/purchasing/orders?forPricing=1');
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
        return `<tr data-oid="${esc(id)}" class="po-row${sel}" style="cursor:pointer">
          <td>${esc(row.order_code || row.id)}</td>
          <td>${esc(row.project_code || row.project_label || '—')}</td>
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
    document.querySelectorAll('#completedOrdBody .po-row').forEach((x) => x.classList.remove('po-row-sel'));
    const tr = document.querySelector(`#ordBody .po-row[data-oid="${id}"]`);
    const trCompleted = document.querySelector(`#completedOrdBody .po-row[data-oid="${id}"]`);
    if (tr) tr.classList.add('po-row-sel');
    if (trCompleted) trCompleted.classList.add('po-row-sel');
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
        return `<tr data-oid="${esc(id)}" class="po-row${sel}" style="cursor:pointer">
          <td>${esc(row.order_code || row.id)}</td>
          <td>${esc(row.project_code || row.project_label || '—')}</td>
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
      `<span class="proc-badge">${esc(tK('purch.col.supplier'))}: ${esc(order.supplier_name || '—')}</span>`,
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
    const projectLabel = order.project_label || order.project_code || '—';
    if (orderMeta) {
      orderMeta.textContent = `${order.order_code || order.id} · ${projectLabel}`;
    }
    renderBadges(order);

    const items = Array.isArray(order.items) ? order.items : [];
    lineInputs = items.map(() => ({}));
    linesDetailBody.innerHTML = items
      .map((it, i) => {
        const lineCurrency = String(it.currency || order.currency || 'UZS').toUpperCase();
        const fxRate =
          it.fx_rate != null && it.fx_rate !== ''
            ? String(it.fx_rate)
            : lineCurrency === 'UZS' || lineCurrency === 'SYSTEM'
              ? '1'
              : '';
        return `<tr>
          <td><span style="font-size:11px;color:#64748b">${esc(it.product_code || '')}</span><br/>${esc(it.product_name || '')}</td>
          <td class="r-stock">${qtyCellHtml(it, it.qty_ordered)}</td>
          <td class="r-stock">${qtyCellHtml(it, it.qty_received)}</td>
          <td class="r-stock">${qtyCellHtml(it, it.qty_remaining)}</td>
          <td>
            <input class="pur-inp po-line-supsearch" data-i="${i}" placeholder="${esc(tK('purch.proc.supSearchPh'))}" style="width:150px;margin-bottom:4px" />
            <select class="pur-inp po-line-sup" data-i="${i}">${supplierOptionsHtml(it.line_supplier_id || order.supplier_id || '')}</select>
          </td>
          <td><input type="number" class="pur-inp po-line-price" data-i="${i}" min="0" step="0.0001" value="${esc(it.unit_price != null ? it.unit_price : '')}" style="width:120px" /></td>
          <td><input type="text" class="pur-inp po-line-cur" data-i="${i}" maxlength="3" value="${esc(lineCurrency)}" style="width:72px;text-transform:uppercase" /></td>
          <td><input type="number" class="pur-inp po-line-fx" data-i="${i}" min="0" step="0.0001" value="${esc(fxRate)}" style="width:110px" /></td>
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
    linesDetailBody.querySelectorAll('.po-line-fx').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i].fxEl = el;
    });

    [btnStart, btnPrint, btnSavePricing, btnCompleteOrder, btnReviseOrder].forEach((btn) => {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
    if (window.i18n && window.i18n.apply) window.i18n.apply(orderFormBlock);
  }

  function collectPricingLines() {
    if (!selectedOrder) return { lines: [] };
    const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    const lines = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const input = lineInputs[i] || {};
      const supplierId = input.supEl && input.supEl.value ? parseInt(String(input.supEl.value), 10) : null;
      const priceRaw = input.priceEl ? String(input.priceEl.value).trim() : '';
      const unitPrice = priceRaw === '' ? null : parseFloat(priceRaw.replace(',', '.'));
      const currency = input.curEl ? String(input.curEl.value || '').trim().toUpperCase().slice(0, 3) : 'UZS';
      const fxRaw = input.fxEl ? String(input.fxEl.value).trim() : '';
      const fxRate = fxRaw === '' ? null : parseFloat(fxRaw.replace(',', '.'));
      const hasAny =
        (Number.isFinite(supplierId) && supplierId > 0) ||
        priceRaw !== '' ||
        String(currency || '').trim() !== '' ||
        fxRaw !== '';
      if (!hasAny) continue;
      if (!Number.isFinite(supplierId) || supplierId < 1) {
        return { error: tK('purch.proc.errSupLine') };
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return { error: tK('purch.proc.errPriceLine') };
      }
      if (!['UZS', 'SYSTEM'].includes(currency) && (!Number.isFinite(fxRate) || fxRate <= 0)) {
        return { error: tK('api.pur.fx_required') };
      }
      lines.push({
        orderItemId: item.id,
        supplierId,
        unitPrice,
        currency: currency || 'UZS',
        fxRate: ['UZS', 'SYSTEM'].includes(currency || 'UZS') ? 1 : fxRate,
      });
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
      return;
    }
    if (!collected.lines.length) {
      showMsg(tK('purch.proc.completeNeedAtLeastOne'), true);
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
    await loadCompletedOrders(true);
    await selectOrder(String(id));
    highlightSelectedOrder(String(id));
  }

  function printOrder() {
    if (!selectedOrder) {
      showMsg(tK('purch.proc.selectPo'), true);
      return;
    }
    window.print();
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
  if (btnCompleteOrder) btnCompleteOrder.addEventListener('click', () => postBuyerAction('complete'));
  if (btnReviseOrder) btnReviseOrder.addEventListener('click', () => postBuyerAction('revise'));

  (async function init() {
    if (window.initPurchasingPageNav) {
      await window.initPurchasingPageNav('proc');
    }
    const sc = window.getPurchasingScope ? getPurchasingScope() : { canPurchasing: true };
    if (sc.canPurchasing) {
      await loadSuppliers();
    }
    await loadIncomingOrders(false);
    await loadCompletedOrders(false);
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);

    const langSel = document.getElementById('languageSelect');
    if (langSel) {
      langSel.addEventListener('change', async () => {
        if (sc.canPurchasing) {
          await loadSuppliers();
        }
        const id = currentOrderId();
        await loadIncomingOrders(true);
        await loadCompletedOrders(true);
        if (id != null) {
          await selectOrder(String(id));
          highlightSelectedOrder(String(id));
        }
        if (window.i18n && window.i18n.apply) {
          window.i18n.apply(document);
        }
      });
    }
  })();
})();
