/**
 * Satınalma siparişi aç — sadece form (liste / onay yok)
 */
(function () {
  const fmtQ = (n) => (window.fmtQty ? window.fmtQty(n) : (Number(n) || 0).toFixed(2));

  let whTree = [];
  let unitList = [];
  let lineCounter = 0;
  let editId = null;
  let ddCloseBound = false;

  const msg = document.getElementById('msg');

  function showMsg(t, isErr) {
    msg.textContent = t;
    msg.style.color = isErr ? '#b91c1c' : '#0f766e';
  }

  function tKey(k) {
    return window.i18n && window.i18n.t ? window.i18n.t(k) : k;
  }

  function fillWh(sel, val) {
    sel.innerHTML = '<option value="">—</option>';
    whTree.forEach((w) => sel.add(new Option(w.name, w.id)));
    if (val) sel.value = String(val);
  }

  function fillSub(sel, whId, val) {
    sel.innerHTML = '<option value="">—</option>';
    if (!whId) return;
    const w = whTree.find((x) => String(x.id) === String(whId));
    (w && w.subcategories ? w.subcategories : []).forEach((s) => sel.add(new Option(s.name, s.id)));
    if (val) sel.value = String(val);
  }

  function fillUnits(sel, val) {
    sel.innerHTML = '<option value="">—</option>';
    unitList.forEach((u) => sel.add(new Option(u.code, u.id)));
    if (val) sel.value = String(val);
  }

  function applyStockCell(tr, p) {
    const st = tr.querySelector('.r-stock');
    if (!p || !st) return;
    st.textContent = p.stock_display && p.stock_display.text ? p.stock_display.text : '—';
  }

  function filterProducts(list, q) {
    const qLower = String(q || '')
      .trim()
      .toLowerCase();
    if (!qLower) return list || [];
    return (list || []).filter((p) => {
      const code = String(p.product_code || '').toLowerCase();
      const name = String(p.name || '').toLowerCase();
      return code.includes(qLower) || name.includes(qLower);
    });
  }

  function positionProductSuggest(tr) {
    const ul = tr.querySelector('.r-pr-dd');
    const inp = tr.querySelector('.r-pr-q');
    if (!ul || !inp || ul.hidden) return;
    const rect = inp.getBoundingClientRect();
    const ddWidth = Math.max(rect.width, 320);
    const vw = document.documentElement.clientWidth || window.innerWidth || 0;
    const left = Math.min(rect.left, Math.max(0, vw - ddWidth - 8));
    ul.style.left = left + 'px';
    ul.style.top = rect.bottom + 4 + 'px';
    ul.style.width = ddWidth + 'px';
  }

  function renderProductSuggest(tr) {
    const ul = tr.querySelector('.r-pr-dd');
    const inp = tr.querySelector('.r-pr-q');
    if (!ul || !inp) return;
    const list = tr._purProducts || [];
    const q = inp.value;
    const rows = filterProducts(list, q);
    if (!rows.length) {
      ul.innerHTML = `<li class="pur-prod-suggest-empty">${tKey('purch.open.prodNoMatch')}</li>`;
    } else {
      ul.innerHTML = rows
        .map((p) => {
          const st = p.stock_display && p.stock_display.text ? p.stock_display.text : '—';
          const label = `${p.product_code || ''} — ${p.name || ''}`.trim() || `#${p.id}`;
          return `<li class="pur-prod-suggest-item" data-pid="${p.id}" tabindex="0"><span class="pur-prod-suggest-label">${label}</span><span class="pur-prod-suggest-stock">${st}</span></li>`;
        })
        .join('');
    }
    ul.hidden = false;
    positionProductSuggest(tr);
  }

  function closeProductSuggest(tr) {
    const ul = tr.querySelector('.r-pr-dd');
    if (ul) ul.hidden = true;
  }

  let suggestRepositionBound = false;
  function bindSuggestReposition() {
    if (suggestRepositionBound) return;
    suggestRepositionBound = true;
    const reposAll = () => {
      document.querySelectorAll('#linesBody tr').forEach((row) => {
        const ul = row.querySelector('.r-pr-dd');
        if (ul && !ul.hidden) positionProductSuggest(row);
      });
    };
    window.addEventListener('scroll', reposAll, true);
    window.addEventListener('resize', reposAll);
  }

  function pickProduct(tr, p) {
    const hid = tr.querySelector('.r-pr-val');
    const qinp = tr.querySelector('.r-pr-q');
    if (!hid || !qinp || !p) return;
    hid.value = String(p.id);
    const label = `${p.product_code || ''} — ${p.name || ''}`.trim() || `#${p.id}`;
    qinp.value = label;
    applyStockCell(tr, p);
    const uu = tr.querySelector('.r-unit');
    if (p.unit_id && uu && Array.from(uu.options).some((o) => o.value === String(p.unit_id))) {
      uu.value = String(p.unit_id);
    }
    closeProductSuggest(tr);
  }

  function bindDdCloseOnce() {
    if (ddCloseBound) return;
    ddCloseBound = true;
    document.addEventListener(
      'click',
      (ev) => {
        document.querySelectorAll('#linesBody tr .r-pr-dd').forEach((ul) => {
          if (!ul.hidden && !ul.closest('tr')?.contains(ev.target)) {
            ul.hidden = true;
          }
        });
      },
      true
    );
  }

  async function loadProductsForRow(tr) {
    const wid = tr.querySelector('.r-wh')?.value;
    const sid = tr.querySelector('.r-sc')?.value;
    const qinp = tr.querySelector('.r-pr-q');
    const hid = tr.querySelector('.r-pr-val');
    if (!qinp || !hid) return;
    hid.value = '';
    qinp.value = '';
    qinp.disabled = true;
    tr._purProducts = [];
    tr.querySelector('.r-stock').textContent = '—';
    closeProductSuggest(tr);
    if (!wid || !sid) return;
    const { ok, data } = await window.purApi(
      '/api/purchasing/products?warehouseId=' + encodeURIComponent(wid) + '&warehouseSubcategoryId=' + encodeURIComponent(sid)
    );
    if (!ok || !data || !data.ok) return;
    tr._purProducts = data.products || [];
    qinp.disabled = false;
    qinp.focus();
    renderProductSuggest(tr);
    bindDdCloseOnce();
    bindSuggestReposition();
  }

  function readRow(tr) {
    return {
      wh: tr.querySelector('.r-wh')?.value || '',
      sc: tr.querySelector('.r-sc')?.value || '',
      p: tr.querySelector('.r-pr-val')?.value || '',
      qty: tr.querySelector('.r-qty')?.value || '',
      un: tr.querySelector('.r-unit')?.value || '',
      note: tr.querySelector('.r-note')?.value || '',
      imgPath: tr.dataset.imagePath || '',
      pdfPath: tr.dataset.pdfPath || '',
    };
  }

  function lineRowHtml() {
    const svgUp =
      '<svg class="pur-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>';
    const svgPdf =
      '<svg class="pur-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v4h4M8 13h8M8 17h6"/></svg>';
    const svgCopy =
      '<svg class="pur-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    return `
      <td><select class="r-wh pur-inp app-select"></select></td>
      <td><select class="r-sc pur-inp app-select" disabled></select></td>
      <td class="pur-req-prod-cell">
        <div class="pur-prod-dd-wrap">
          <input type="text" class="r-pr-q pur-inp app-input" disabled autocomplete="off" data-i18n-placeholder="purch.open.prodSearchPh" />
          <input type="hidden" class="r-pr-val" value="" />
          <ul class="pur-prod-suggest r-pr-dd" hidden></ul>
        </div>
      </td>
      <td class="r-stock-cell"><span class="r-stock">—</span></td>
      <td class="pur-req-qty-cell"><input type="number" class="r-qty pur-inp app-input" min="0" step="any" /></td>
      <td class="pur-req-unit-cell"><select class="r-unit pur-inp app-select"></select></td>
      <td class="pur-req-file-cell">
        <label class="pur-file-icon-btn" data-i18n-title="purch.req.uploadImgAria">
          <input type="file" accept="image/*" class="r-file-img app-visually-hidden" />
          ${svgUp}
        </label>
        <div class="r-imgbox"><img class="r-imgprev is-hidden" alt="" /></div>
      </td>
      <td class="pur-req-file-cell">
        <label class="pur-file-icon-btn pur-file-icon-pdf" data-i18n-title="purch.req.uploadPdfAria">
          <input type="file" accept="application/pdf,.pdf" class="r-file-pdf app-visually-hidden" />
          ${svgPdf}
        </label>
      </td>
      <td><input type="text" class="r-note pur-inp r-note-input app-input" /></td>
      <td class="pur-req-copy-cell">
        <button type="button" class="btn btn-icon pur-row-copy" title="" data-i18n-title="purch.req.copyRowAria">${svgCopy}</button>
      </td>`;
  }

  function wireRow(tr) {
    const wh = tr.querySelector('.r-wh');
    const sc = tr.querySelector('.r-sc');
    const qinp = tr.querySelector('.r-pr-q');
    const hid = tr.querySelector('.r-pr-val');
    const uu = tr.querySelector('.r-unit');
    const dd = tr.querySelector('.r-pr-dd');

    wh.addEventListener('change', () => {
      fillSub(sc, wh.value, '');
      const subs = (wh.value && whTree.find((x) => String(x.id) === String(wh.value))?.subcategories) || [];
      sc.disabled = !wh.value || subs.length === 0;
      if (hid) hid.value = '';
      if (qinp) {
        qinp.value = '';
        qinp.disabled = true;
      }
      tr._purProducts = [];
      closeProductSuggest(tr);
      tr.querySelector('.r-stock').textContent = '—';
    });

    sc.addEventListener('change', () => {
      if (sc.value) {
        loadProductsForRow(tr);
      } else {
        if (hid) hid.value = '';
        if (qinp) {
          qinp.value = '';
          qinp.disabled = true;
        }
        tr._purProducts = [];
        closeProductSuggest(tr);
        tr.querySelector('.r-stock').textContent = '—';
      }
    });

    if (qinp) {
      qinp.addEventListener('focus', () => {
        if (!tr._purProducts || !tr._purProducts.length) return;
        renderProductSuggest(tr);
      });
      qinp.addEventListener('input', () => {
        renderProductSuggest(tr);
      });
    }

    if (dd) {
      dd.addEventListener('mousedown', (e) => {
        const li = e.target.closest('.pur-prod-suggest-item[data-pid]');
        if (!li) return;
        e.preventDefault();
        const pid = li.getAttribute('data-pid');
        const p = (tr._purProducts || []).find((x) => String(x.id) === String(pid));
        if (p) pickProduct(tr, p);
      });
    }

    tr.querySelector('.r-file-img').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      const im = tr.querySelector('.r-imgprev');
      if (!f) {
        tr.dataset.imagePath = '';
        if (im) {
          im.classList.add('is-hidden');
          im.removeAttribute('src');
        }
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        im.src = r.result;
        im.classList.remove('is-hidden');
      };
      r.readAsDataURL(f);
      const up = await window.purApiUploadFile('/api/purchasing/line-attachment', f, 'image');
      if (up.ok && up.data && up.data.ok) tr.dataset.imagePath = up.data.relPath || '';
      else showMsg(tKey('purch.req.uploadErr'), true);
    });

    tr.querySelector('.r-file-pdf').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) {
        tr.dataset.pdfPath = '';
        return;
      }
      const up = await window.purApiUploadFile('/api/purchasing/line-attachment', f, 'pdf');
      if (up.ok && up.data && up.data.ok) tr.dataset.pdfPath = up.data.relPath || '';
      else showMsg(tKey('purch.req.uploadErr'), true);
    });

    tr.querySelector('.pur-row-copy').addEventListener('click', (ev) => {
      ev.preventDefault();
      const anchor = ev.currentTarget.closest('tr');
      if (!anchor) return;
      const snap = readRow(anchor);
      insertNewLineAfter(anchor, snap);
    });
  }

  function initRowFromSnapshot(tr, snap) {
    const wh = tr.querySelector('.r-wh');
    const sc = tr.querySelector('.r-sc');
    const qinp = tr.querySelector('.r-pr-q');
    const hid = tr.querySelector('.r-pr-val');
    const uu = tr.querySelector('.r-unit');
    fillWh(wh, snap.wh);
    fillSub(sc, wh.value, snap.sc);
    fillUnits(uu, snap.un);
    const subs = (wh.value && whTree.find((x) => String(x.id) === String(wh.value))?.subcategories) || [];
    sc.disabled = !wh.value || subs.length === 0;
    if (wh.value && snap.sc) {
      sc.disabled = false;
      loadProductsForRow(tr).then(() => {
        if (snap.p) {
          const p = (tr._purProducts || []).find((x) => String(x.id) === String(snap.p));
          if (p) pickProduct(tr, p);
        }
        if (snap.un) uu.value = String(snap.un);
        if (snap.qty !== undefined && snap.qty !== '') tr.querySelector('.r-qty').value = snap.qty;
        if (snap.note) tr.querySelector('.r-note').value = snap.note;
      });
    } else {
      if (snap.qty !== undefined && snap.qty !== '') tr.querySelector('.r-qty').value = snap.qty;
      if (snap.note) tr.querySelector('.r-note').value = snap.note;
    }
  }

  function insertNewLineAfter(anchorTr, snap) {
    lineCounter += 1;
    const tr = document.createElement('tr');
    tr.dataset.rid = String(lineCounter);
    tr.innerHTML = lineRowHtml();
    const tbody = document.getElementById('linesBody');
    if (anchorTr && anchorTr.parentNode === tbody) {
      anchorTr.insertAdjacentElement('afterend', tr);
    } else {
      tbody.appendChild(tr);
    }
    fillWh(tr.querySelector('.r-wh'), null);
    fillSub(tr.querySelector('.r-sc'), '', '');
    fillUnits(tr.querySelector('.r-unit'), null);
    wireRow(tr);
    const hasSnap =
      snap &&
      (snap.wh ||
        snap.sc ||
        snap.p ||
        (snap.note != null && String(snap.note).trim() !== '') ||
        (snap.qty !== undefined && snap.qty !== ''));
    if (hasSnap) {
      tr.dataset.imagePath = snap.imgPath != null ? snap.imgPath : snap.img || '';
      tr.dataset.pdfPath = snap.pdfPath != null ? snap.pdfPath : snap.pdf || '';
      initRowFromSnapshot(tr, snap);
    }
    if (window.i18n && window.i18n.apply) window.i18n.apply(tr);
  }

  function addFirstLine() {
    insertNewLineAfter(null, null);
  }

  function collectPayload(mode) {
    const pid = document.getElementById('fProject').value;
    const title = document.getElementById('fTitle').value;
    const note = document.getElementById('fNote').value;
    const items = [];
    document.getElementById('linesBody').querySelectorAll('tr').forEach((tr) => {
      const pr = tr.querySelector('.r-pr-val')?.value;
      const q = tr.querySelector('.r-qty')?.value;
      if (!pr) return;
      const productId = parseInt(pr, 10);
      const quantity = parseFloat(String(q).replace(',', '.'));
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      const wid = tr.querySelector('.r-wh')?.value;
      const sid = tr.querySelector('.r-sc')?.value;
      const u = tr.querySelector('.r-unit');
      const unitId = u && u.value ? parseInt(u.value, 10) : null;
      let uc = u && u.selectedOptions[0] ? u.selectedOptions[0].text : '';
      if (unitId && unitList.length) {
        const fu = unitList.find((x) => String(x.id) === String(unitId));
        if (fu) uc = fu.code;
      }
      items.push({
        productId,
        quantity,
        unitId: unitId && unitId > 0 ? unitId : undefined,
        unitCode: uc || undefined,
        warehouseId: wid ? parseInt(wid, 10) : undefined,
        warehouseSubcategoryId: sid ? parseInt(sid, 10) : undefined,
        lineNote: (tr.querySelector('.r-note')?.value || '').trim() || undefined,
        lineImagePath: tr.dataset.imagePath || undefined,
        linePdfPath: tr.dataset.pdfPath || undefined,
      });
    });
    return { projectId: parseInt(pid, 10), title, note, items, mode };
  }

  async function doSave(mode) {
    const p = collectPayload(mode);
    if (!p.projectId) {
      showMsg(tKey('purch.req.errProject'), true);
      return;
    }
    if (!p.items.length) {
      showMsg(tKey('purch.req.errLines'), true);
      return;
    }
    const isEdit = editId != null;
    const { ok, data } = isEdit
      ? await window.purApi('/api/purchasing/requests/' + editId, { method: 'PUT', body: JSON.stringify(p) })
      : await window.purApi('/api/purchasing/requests', { method: 'POST', body: JSON.stringify(p) });
    if (!ok) {
      showMsg((window.i18n && window.i18n.apiErrorText) ? window.i18n.apiErrorText(data) : (data && data.message) || 'Hata', true);
      return;
    }
    if (isEdit) {
      showMsg(tKey('purch.req.updated'));
      return;
    }
    showMsg(tKey('purch.req.ok') + (data && data.requestCode ? ' ' + data.requestCode : ''));
    document.getElementById('fTitle').value = '';
    document.getElementById('fNote').value = '';
    document.getElementById('linesBody').innerHTML = '';
    addFirstLine();
    refreshCodePreview();
  }

  async function refreshCodePreview() {
    const pid = document.getElementById('fProject').value;
    const el = document.getElementById('codePreview');
    if (!pid) {
      el.textContent = '—';
      return;
    }
    const { ok, data } = await window.purApi('/api/purchasing/next-request-code?projectId=' + encodeURIComponent(pid));
    if (ok && data && data.ok) el.textContent = data.requestCode || '—';
    else el.textContent = (window.i18n && window.i18n.apiErrorText) ? window.i18n.apiErrorText(data) : '—';
  }

  async function loadWhUnits() {
    const [w, u] = await Promise.all([window.purApi('/api/purchasing/warehouses'), window.purApi('/api/purchasing/units')]);
    if (w.ok && w.data && w.data.ok) whTree = w.data.warehouses || [];
    if (u.ok && u.data && u.data.ok) unitList = u.data.units || [];
  }

  async function loadProjects() {
    const { ok, data } = await window.purApi('/api/purchasing/projects-brief');
    const sel = document.getElementById('fProject');
    sel.innerHTML = '<option value="">— proje —</option>';
    if (ok && data && data.ok && data.projects) {
      data.projects.forEach((p) => {
        sel.add(new Option((p.project_code || '') + ' — ' + (p.name || ''), p.id));
      });
    }
  }

  async function loadEditFromServer() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
      return;
    }
    const { ok, data } = await window.purApi('/api/purchasing/requests/' + encodeURIComponent(id));
    if (!ok || !data || !data.request) {
      return;
    }
    const rq = data.request;
    if (rq.requester_id && rq.requester_id !== undefined) {
      /* server session — ignore client check; backend enforces on PUT */
    }
    if (!['draft', 'revision_requested'].includes(String(rq.pr_status))) {
      showMsg(tKey('purch.req.cannotEdit'), true);
      return;
    }
    editId = String(rq.id);
    document.getElementById('fProject').value = String(rq.project_id || '');
    document.getElementById('fTitle').value = rq.title || '';
    document.getElementById('fNote').value = rq.note || '';
    document.getElementById('codePreview').textContent = rq.request_code || '—';
    document.getElementById('linesBody').innerHTML = '';
    (rq.items || []).forEach((it) => {
      const snap = {
        wh: it.warehouse_id != null ? String(it.warehouse_id) : '',
        sc: it.warehouse_subcategory_id != null ? String(it.warehouse_subcategory_id) : '',
        p: it.product_id != null ? String(it.product_id) : '',
        qty: it.quantity,
        un: it.unit_id != null ? String(it.unit_id) : '',
        note: it.line_note || '',
        img: it.line_image_path,
        pdf: it.line_pdf_path,
      };
      const tr = insertNewLineWithSnapshot(snap);
      if (it.line_image_path) {
        tr.dataset.imagePath = it.line_image_path;
        const im = tr.querySelector('.r-imgprev');
        if (im) {
          im.src = it.line_image_path;
          im.classList.remove('is-hidden');
        }
      }
      if (it.line_pdf_path) {
        tr.dataset.pdfPath = it.line_pdf_path;
      }
    });
  }

  function insertNewLineWithSnapshot(snap) {
    lineCounter += 1;
    const tr = document.createElement('tr');
    tr.dataset.rid = String(lineCounter);
    tr.innerHTML = lineRowHtml();
    const tbody = document.getElementById('linesBody');
    tbody.appendChild(tr);
    fillWh(tr.querySelector('.r-wh'), null);
    fillSub(tr.querySelector('.r-sc'), '', '');
    fillUnits(tr.querySelector('.r-unit'), null);
    wireRow(tr);
    if (snap && (snap.wh || snap.sc)) {
      tr.dataset.imagePath = snap.img || '';
      tr.dataset.pdfPath = snap.pdf || '';
      initRowFromSnapshot(tr, snap);
    }
    if (window.i18n && window.i18n.apply) {
      window.i18n.apply(tr);
    }
    return tr;
  }

  function start() {
    document.getElementById('addLine').addEventListener('click', () => insertNewLineAfter(null, null));
    document.getElementById('submitReq').addEventListener('click', () => doSave('submit'));
    document.getElementById('saveDraft').addEventListener('click', () => doSave('draft'));
    document.getElementById('fProject').addEventListener('change', () => refreshCodePreview());
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => {
        location.href = '/login.html';
      });
    });

    (async function init() {
      if (window.initPurchasingPageNav) await window.initPurchasingPageNav('openreq');
      await loadWhUnits();
      await loadProjects();
      const qid = new URLSearchParams(window.location.search).get('id');
      if (qid) {
        await loadEditFromServer();
        if (document.getElementById('linesBody').querySelectorAll('tr').length === 0) {
          addFirstLine();
        }
      } else {
        addFirstLine();
        await refreshCodePreview();
      }
      if (window.i18n && window.i18n.apply) window.i18n.apply(document);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
