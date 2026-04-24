/**
 * Satınalmacı işleme ekranı:
 *   Üst:   yönetici onayı almış talepler (Gelen siparişler)
 *   Orta:  seçilen talebin satırları + tedarikçi/fiyat/kur + 3 buton
 *   Alt:   bilgi amaçlı satınalma talepleri listesi
 */
(function () {
  const msg = document.getElementById('msg');
  const reqBody = document.getElementById('reqBody');
  const ordBody = document.getElementById('ordBody');
  const detailEmpty = document.getElementById('detailEmpty');
  const orderFormBlock = document.getElementById('orderFormBlock');

  const fODate = document.getElementById('fODate');
  const fDDate = document.getElementById('fDDate');
  const fCur = document.getElementById('fCur');
  const fNote = document.getElementById('fNote');
  const linesDetailBody = document.getElementById('linesDetailBody');
  const orderMeta = document.getElementById('orderMeta');

  const btnStart = document.getElementById('btnStart');
  const btnComplete = document.getElementById('btnComplete');
  const btnPrint = document.getElementById('btnPrint');

  let suppliers = [];
  let selectedRequest = null;
  let lineInputs = [];

  function tK(k) {
    return window.i18n && window.i18n.t ? window.i18n.t(k) : k;
  }

  function apiMsg(data) {
    if (window.i18n && typeof window.i18n.apiErrorText === 'function') {
      return window.i18n.apiErrorText(data);
    }
    if (!data || typeof data !== 'object') {
      return tK('api.error.unknown');
    }
    if (data.messageKey && window.i18n) {
      const m = tK(data.messageKey);
      if (m && m !== data.messageKey) {
        return m;
      }
    }
    if (data.message) {
      return String(data.message);
    }
    if (data.error) {
      return String(data.error);
    }
    return tK('api.error.unknown');
  }

  function currentRequestId() {
    if (!selectedRequest) {
      return null;
    }
    const raw = selectedRequest.id != null ? selectedRequest.id : selectedRequest.request_id;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function showMsg(t, isErr) {
    if (!msg) return;
    msg.textContent = t;
    msg.style.color = isErr ? '#b91c1c' : '#0f766e';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtLineTotal(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : '—';
  }

  function procLabel(state) {
    if (!state) return '—';
    if (state === 'started') return tK('purch.proc.procStarted');
    if (state === 'ongoing') return tK('purch.proc.procOngoing');
    return String(state);
  }

  function statusLabel(s) {
    if (s == null) return '—';
    const k = 'purch.status.req.' + s;
    const v = tK(k);
    return v && v !== k ? v : String(s);
  }

  async function loadSuppliers() {
    const { ok, data } = await window.purApi('/api/purchasing/suppliers');
    if (ok && data && data.ok) suppliers = data.suppliers || [];
    refreshAllSupplierDropdowns();
  }

  function supplierOptionsHtml(selectedId) {
    let h = '<option value="">—</option>';
    suppliers.forEach((r) => {
      const sel = String(r.id) === String(selectedId) ? ' selected' : '';
      h += `<option value="${esc(r.id)}"${sel}>${esc(r.name)}</option>`;
    });
    return h;
  }

  function refreshAllSupplierDropdowns() {
    if (!linesDetailBody) return;
    linesDetailBody.querySelectorAll('.po-line-sup').forEach((el) => {
      const cur = el.value;
      el.innerHTML = supplierOptionsHtml(cur);
    });
  }

  async function loadIncomingRequests() {
    const { ok, data } = await window.purApi(
      '/api/purchasing/requests?statuses=' + encodeURIComponent('approved,partial')
    );
    if (!ok || !data || !data.ok) {
      ordBody.innerHTML = '<tr><td colspan="6">—</td></tr>';
      return;
    }
    const rows = data.requests || [];
    if (!rows.length) {
      ordBody.innerHTML = '<tr><td colspan="6">' + esc(tK('purch.proc.noIncomingV2')) + '</td></tr>';
      return;
    }
    ordBody.innerHTML = rows
      .map(
        (r) => `<tr data-rid="${r.id}" class="po-row" style="cursor:pointer">
          <td>${esc(r.request_code || r.id)}</td>
          <td>${esc(r.project_code || '—')}</td>
          <td>${esc(r.requester_name || '—')}</td>
          <td>${esc(statusLabel(r.pr_status))}</td>
          <td style="font-size:12px">${esc(procLabel(r.procurement_state))}</td>
          <td>${esc(String(r.created_at || '').slice(0, 10))}</td>
        </tr>`
      )
      .join('');
    ordBody.querySelectorAll('.po-row').forEach((tr) => {
      tr.addEventListener('click', () => {
        const id = tr.getAttribute('data-rid');
        document.querySelectorAll('#ordBody .po-row').forEach((x) => x.classList.remove('po-row-sel'));
        tr.classList.add('po-row-sel');
        selectRequest(id);
      });
    });
  }

  async function loadRequestsInfo() {
    const { ok, data } = await window.purApi(
      '/api/purchasing/requests?statuses=' +
        encodeURIComponent('approved,partial,ordered,pending,revision_requested,draft')
    );
    if (!ok || !data || !data.ok) {
      if (reqBody) reqBody.innerHTML = '<tr><td colspan="6">—</td></tr>';
      return;
    }
    const rows = data.requests || [];
    if (!rows.length) {
      if (reqBody) reqBody.innerHTML = '<tr><td colspan="6">' + esc(tK('purch.req.empty')) + '</td></tr>';
      return;
    }
    if (reqBody) {
      reqBody.innerHTML = rows
        .map(
          (r) => `<tr>
            <td><a href="/purchase-requests.html">${esc(r.request_code || r.id)}</a></td>
            <td>${esc(r.project_code || '—')}</td>
            <td>${esc(r.requester_name || '—')}</td>
            <td>${esc(statusLabel(r.pr_status))}</td>
            <td style="font-size:12px">${esc(procLabel(r.procurement_state))}</td>
            <td>${esc(String(r.created_at || '').slice(0, 10))}</td>
          </tr>`
        )
        .join('');
    }
  }

  function recalcLineTotal(i) {
    const r = selectedRequest;
    if (!r || !lineInputs[i]) return;
    const it = (r.items || [])[i];
    if (!it) return;
    const inp = lineInputs[i];
    const p = inp.priceEl ? parseFloat(String(inp.priceEl.value).replace(',', '.')) : 0;
    const q = Number(it.quantity) || 0;
    const tot = (Number.isFinite(p) ? p : 0) * q;
    const el = linesDetailBody.querySelector('.po-line-total[data-i="' + i + '"]');
    if (el) el.textContent = fmtLineTotal(tot);
  }

  async function selectRequest(id) {
    selectedRequest = null;
    lineInputs = [];
    const { ok, data } = await window.purApi('/api/purchasing/requests/' + encodeURIComponent(id));
    if (!ok || !data || !data.ok || !data.request) {
      showMsg(tK('api.error.unknown'), true);
      return;
    }
    selectedRequest = data.request;
    if (detailEmpty) detailEmpty.hidden = true;
    if (orderFormBlock) orderFormBlock.hidden = false;

    const r = selectedRequest;
    if (orderMeta) {
      const proj = r.project_code ? (r.project_code + (r.project_name ? ' — ' + r.project_name : '')) : '—';
      orderMeta.textContent = (r.request_code || '') + ' · ' + proj + ' · ' + (r.requester_name || '—');
    }
    if (fODate) fODate.value = new Date().toISOString().slice(0, 10);
    if (fDDate) fDDate.value = '';
    if (fCur && !fCur.value) fCur.value = 'UZS';
    if (fNote) fNote.value = r.note || '';

    const items = r.items || [];
    lineInputs = items.map(() => ({}));
    linesDetailBody.innerHTML = items
      .map((it, i) => {
        const unit = it.unit_code || it.p_unit_code || it.p_unit_legacy || '—';
        const stockTxt = it.stock_display_text != null ? it.stock_display_text : '—';
        const img = it.line_image_path
          ? `<a href="${esc(it.line_image_path)}" target="_blank" rel="noopener"><img src="${esc(it.line_image_path)}" alt="" class="pur-d-img" /></a>`
          : '';
        const pdf = it.line_pdf_path
          ? `<a href="${esc(it.line_pdf_path)}" target="_blank" rel="noopener">PDF</a>`
          : '';
        const attachCell = [img, pdf].filter(Boolean).join(' ') || '—';
        return `<tr>
          <td><span style="font-size:11px;color:#64748b">${esc(it.product_code || '')}</span><br/>${esc(it.product_name || '')}</td>
          <td class="r-stock">${esc(String(it.quantity))}</td>
          <td>${esc(unit)}</td>
          <td class="r-stock">${esc(String(stockTxt))}</td>
          <td>
            <input class="pur-inp po-line-supsearch" data-i="${i}" placeholder="${esc(tK('purch.proc.supSearchPh'))}" style="width:140px;margin-bottom:4px"/>
            <select class="pur-inp po-line-sup" data-i="${i}">${supplierOptionsHtml('')}</select>
          </td>
          <td><input type="number" class="pur-inp po-line-price" data-i="${i}" min="0" step="0.0001" value="" style="width:110px" /></td>
          <td><input type="text" class="pur-inp po-line-cur" data-i="${i}" maxlength="3" value="UZS" style="width:64px;text-transform:uppercase" /></td>
          <td class="r-stock po-line-total" data-i="${i}">0.00</td>
          <td style="font-size:12px;white-space:nowrap">${attachCell}</td>
        </tr>`;
      })
      .join('');

    linesDetailBody.querySelectorAll('.po-line-sup').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i] = lineInputs[i] || {};
      lineInputs[i].supEl = el;
    });
    linesDetailBody.querySelectorAll('.po-line-supsearch').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i] = lineInputs[i] || {};
      lineInputs[i].supSearchEl = el;
      el.addEventListener('input', () => {
        const q = String(el.value || '').trim().toLowerCase();
        const sel = lineInputs[i].supEl;
        if (!sel) return;
        const cur = sel.value;
        let h = '<option value="">—</option>';
        const filtered = q
          ? suppliers.filter((r) => String(r.name || '').toLowerCase().includes(q))
          : suppliers;
        filtered.forEach((r) => {
          const s = String(r.id) === String(cur) ? ' selected' : '';
          h += `<option value="${esc(r.id)}"${s}>${esc(r.name)}</option>`;
        });
        sel.innerHTML = h;
      });
    });
    linesDetailBody.querySelectorAll('.po-line-price').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i] = lineInputs[i] || {};
      lineInputs[i].priceEl = el;
      const upd = () => recalcLineTotal(i);
      el.addEventListener('input', upd);
      el.addEventListener('change', upd);
    });
    linesDetailBody.querySelectorAll('.po-line-cur').forEach((el) => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      lineInputs[i] = lineInputs[i] || {};
      lineInputs[i].curEl = el;
    });

    if (btnStart) btnStart.disabled = false;
    if (btnComplete) { btnComplete.disabled = false; btnComplete.style.opacity = '1'; }
    if (btnPrint) btnPrint.disabled = false;
    if (window.i18n && window.i18n.apply) window.i18n.apply(orderFormBlock);
  }

  function collectLines(requireAll) {
    if (!selectedRequest) return null;
    const items = selectedRequest.items || [];
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const inp = lineInputs[i] || {};
      const p = inp.priceEl ? parseFloat(String(inp.priceEl.value).replace(',', '.')) : NaN;
      const c = inp.curEl ? String(inp.curEl.value || '').trim().toUpperCase().slice(0, 3) : 'UZS';
      const sid = inp.supEl && inp.supEl.value ? parseInt(String(inp.supEl.value), 10) : null;
      const hasSup = Number.isFinite(sid) && sid > 0;
      const hasPrice = Number.isFinite(p) && p >= 0;
      if (!hasSup && !hasPrice && !requireAll) continue;
      if (requireAll) {
        if (!hasSup) return { error: tK('purch.proc.errSupLine') };
        if (!hasPrice) return { error: tK('purch.proc.errPriceLine') };
      } else if (!hasSup || !hasPrice) {
        continue;
      }
      out.push({
        requestItemId: it.id,
        supplierId: sid,
        unitPrice: p,
        currency: c || 'UZS',
      });
    }
    return { lines: out };
  }

  async function startProcessing() {
    if (!selectedRequest) return;
    const rid = currentRequestId();
    if (rid == null) {
      showMsg(tK('api.pur.request_not_found'), true);
      return;
    }
    const url = '/api/purchasing/requests/' + encodeURIComponent(rid) + '/buyer-action';
    const { ok, data, status } = await window.purApi(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'process' }),
    });
    if (!ok) {
      showMsg(apiMsg(data) || 'HTTP ' + status, true);
      return;
    }
    showMsg(tK('purch.proc.startOkV2'));
    await loadIncomingRequests();
    await loadRequestsInfo();
  }

  async function completeOrder() {
    if (!selectedRequest) return;
    const c = collectLines(false);
    if (!c || !c.lines || !c.lines.length) {
      showMsg(tK('purch.proc.completeNeedAtLeastOne'), true);
      return;
    }
    const body = {
      action: 'complete',
      orderDate: fODate ? fODate.value : undefined,
      deliveryDate: fDDate && fDDate.value ? fDDate.value : null,
      currency: fCur ? fCur.value : undefined,
      note: fNote ? fNote.value : undefined,
      lines: c.lines,
    };
    const rid = currentRequestId();
    if (rid == null) {
      showMsg(tK('api.pur.request_not_found'), true);
      return;
    }
    const url = '/api/purchasing/requests/' + encodeURIComponent(rid) + '/buyer-action';
    const { ok, data, status } = await window.purApi(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!ok) {
      showMsg(apiMsg(data) || 'HTTP ' + status, true);
      return;
    }
    const oids = (data && data.orderIds) || [];
    showMsg(tK('purch.proc.completeGrNav'));
    const first = oids[0];
    const gotoUrl = first ? '/goods-receipt.html?orderId=' + encodeURIComponent(first) : '/goods-receipt.html';
    window.location.href = gotoUrl;
  }

  /** Yazdırma: aynı sayfada gizli iframe oluştur -> içine HTML yaz -> iframe.contentWindow.print() */
  function printForm() {
    if (!selectedRequest) return;
    const r = selectedRequest;
    const items = r.items || [];
    const c = collectLines(false);
    const ld = c && c.lines ? c.lines : [];
    function supName(id) {
      const s = suppliers.find((x) => String(x.id) === String(id));
      return s ? s.name : '';
    }
    const rowsHtml = items
      .map((it) => {
        const unit = it.unit_code || it.p_unit_code || it.p_unit_legacy || '';
        const l = ld.find((x) => x.requestItemId === it.id);
        const sup = l ? supName(l.supplierId) : '';
        const price = l ? l.unitPrice : '';
        const cur = l ? (l.currency || '') : '';
        const total = l && l.unitPrice != null
          ? (Number(l.unitPrice) * (Number(it.quantity) || 0)).toFixed(2)
          : '';
        return `<tr>
          <td>${esc(it.product_code || '')}</td>
          <td>${esc(it.product_name || '')}</td>
          <td style="text-align:right">${esc(String(it.quantity))}</td>
          <td>${esc(unit)}</td>
          <td>${esc(sup)}</td>
          <td style="text-align:right">${esc(String(price))}</td>
          <td>${esc(cur)}</td>
          <td style="text-align:right">${esc(total)}</td>
        </tr>`;
      })
      .join('');
    const attachHtml = items
      .map((it) => {
        const img = it.line_image_path;
        const pdf = it.line_pdf_path;
        if (!img && !pdf) return '';
        return `<div style="margin-top:10px;page-break-inside:avoid">
          <div style="font-weight:600;margin-bottom:4px">${esc(it.product_code || '')} — ${esc(it.product_name || '')}</div>
          ${img ? '<img src="' + esc(img) + '" style="max-height:260px;max-width:380px;border:1px solid #cbd5e1;border-radius:6px"/>' : ''}
          ${pdf ? '<div style="margin-top:4px"><a href="' + esc(pdf) + '">' + esc(pdf) + '</a></div>' : ''}
        </div>`;
      })
      .join('');
    const css = `
      body{font-family:system-ui,Segoe UI,Arial;margin:16px;color:#0f172a}
      h1{font-size:18px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #cbd5e1;padding:6px 8px}
      th{background:#f1f5f9;text-align:left}
      .meta{margin:6px 0 14px;font-size:13px;line-height:1.5}
      @page{margin:12mm}
    `;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.request_code || '')}</title><style>${css}</style></head>
      <body>
        <h1>${esc(tK('purch.print.formTitle'))} — ${esc(r.request_code || '')}</h1>
        <div class="meta">
          <div><strong>${esc(tK('purch.req.lColProject'))}:</strong> ${esc(r.project_code || '')} ${esc(r.project_name || '')}</div>
          <div><strong>${esc(tK('purch.req.lColUser'))}:</strong> ${esc(r.requester_name || '')}</div>
          <div><strong>${esc(tK('purch.wf.colDate'))}:</strong> ${esc(String(r.created_at || '').slice(0, 10))}</div>
          ${r.note ? '<div><strong>' + esc(tK('purch.ordNote')) + ':</strong> ' + esc(r.note) + '</div>' : ''}
        </div>
        <table>
          <thead><tr>
            <th>${esc(tK('purch.col.product'))}</th>
            <th>${esc(tK('purch.proc.colProductName'))}</th>
            <th>${esc(tK('purch.req.colQty'))}</th>
            <th>${esc(tK('purch.proc.colUnit'))}</th>
            <th>${esc(tK('purch.col.supplier'))}</th>
            <th>${esc(tK('purch.col.unitPrice'))}</th>
            <th>${esc(tK('purch.cur'))}</th>
            <th>${esc(tK('purch.proc.colLineTotal'))}</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        ${attachHtml ? '<h3 style="margin-top:14px">' + esc(tK('purch.print.attachments')) + '</h3>' + attachHtml : ''}
      </body></html>`;

    function printViaHiddenIframe() {
      let iframe = document.getElementById('__printIframe');
      if (iframe) {
        iframe.remove();
      }
      iframe = document.createElement('iframe');
      iframe.id = '__printIframe';
      iframe.setAttribute('title', 'print');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(iframe);
      const w = iframe.contentWindow;
      const doc = iframe.contentDocument || w.document;
      doc.open();
      doc.write(html);
      doc.close();
      const doPrint = () => {
        try {
          w.focus();
          w.print();
        } catch (e) {
          showMsg(tK('purch.proc.printFailed') + (e && e.message ? ' ' + e.message : ''), true);
        }
      };
      if (w.document.readyState === 'complete') {
        setTimeout(doPrint, 50);
      } else {
        w.addEventListener('load', () => setTimeout(doPrint, 50), { once: true });
      }
    }

    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const u = URL.createObjectURL(blob);
      const w = window.open(u, '_blank', 'noopener,noreferrer');
      if (!w) {
        URL.revokeObjectURL(u);
        showMsg(tK('purch.proc.printPopupFallback'), true);
        printViaHiddenIframe();
        return;
      }
      const runTabPrint = () => {
        try {
          w.focus();
          w.print();
        } catch {
          try {
            w.close();
          } catch {
            /* ignore */
          }
          printViaHiddenIframe();
        } finally {
          setTimeout(() => URL.revokeObjectURL(u), 60_000);
        }
      };
      if (w.document.readyState === 'complete') {
        setTimeout(runTabPrint, 0);
      } else {
        w.addEventListener('load', runTabPrint, { once: true });
      }
    } catch (e) {
      showMsg(tK('purch.proc.printFailed') + (e && e.message ? ' ' + e.message : ''), true);
      printViaHiddenIframe();
    }
  }

  document.getElementById('logoutBtn') &&
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.preventDefault();
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => {
        location.href = '/login.html';
      });
    });

  if (btnStart) btnStart.addEventListener('click', startProcessing);
  if (btnComplete) btnComplete.addEventListener('click', completeOrder);
  if (btnPrint) btnPrint.addEventListener('click', printForm);

  (async function init() {
    if (window.initPurchasingPageNav) {
      await window.initPurchasingPageNav('proc');
    }
    const sc = window.getPurchasingScope ? getPurchasingScope() : { canPurchasing: true };
    if (sc.canPurchasing) {
      await loadSuppliers();
    }
    await loadIncomingRequests();
    await loadRequestsInfo();
    if (window.i18n && window.i18n.apply) window.i18n.apply(document);

    const langSel = document.getElementById('languageSelect');
    if (langSel) {
      langSel.addEventListener('change', async () => {
        if (sc.canPurchasing) {
          await loadSuppliers();
        }
        await loadIncomingRequests();
        await loadRequestsInfo();
        const id = currentRequestId();
        if (id != null) {
          await selectRequest(String(id));
          const tr = document.querySelector('#ordBody tr[data-rid="' + id + '"]');
          if (tr) {
            document.querySelectorAll('#ordBody .po-row').forEach((x) => x.classList.remove('po-row-sel'));
            tr.classList.add('po-row-sel');
          }
        }
        if (window.i18n && window.i18n.apply) {
          window.i18n.apply(document);
        }
      });
    }
  })();
})();
