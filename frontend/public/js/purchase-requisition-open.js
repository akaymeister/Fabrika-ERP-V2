/**
 * Satınalma siparişi aç — sadece form (liste / onay yok)
 */
(function () {
  const fmtQ = (n) => (window.fmtQty ? window.fmtQty(n) : (Number(n) || 0).toFixed(2));

  let whTree = [];
  let unitList = [];
  let lineCounter = 0;
  let editId = null;

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

  async function loadProductsForRow(tr) {
    const wid = tr.querySelector('.r-wh')?.value;
    const sid = tr.querySelector('.r-sc')?.value;
    const pr = tr.querySelector('.r-pr');
    if (!pr) return;
    pr.innerHTML = '<option value="">—</option>';
    tr.querySelector('.r-stock').textContent = '—';
    if (!wid || !sid) return;
    const { ok, data } = await window.purApi(
      '/api/purchasing/products?warehouseId=' + encodeURIComponent(wid) + '&warehouseSubcategoryId=' + encodeURIComponent(sid)
    );
    if (!ok || !data || !data.ok) return;
    (data.products || []).forEach((p) => {
      pr.add(new Option((p.product_code || '') + ' — ' + (p.name || ''), p.id));
    });
  }

  function readRow(tr) {
    return {
      wh: tr.querySelector('.r-wh')?.value || '',
      sc: tr.querySelector('.r-sc')?.value || '',
      p: tr.querySelector('.r-pr')?.value || '',
      qty: tr.querySelector('.r-qty')?.value || '',
      un: tr.querySelector('.r-unit')?.value || '',
      note: tr.querySelector('.r-note')?.value || '',
    };
  }

  function wireRow(tr) {
    const wh = tr.querySelector('.r-wh');
    const sc = tr.querySelector('.r-sc');
    const pr = tr.querySelector('.r-pr');
    const uu = tr.querySelector('.r-unit');

    wh.addEventListener('change', () => {
      fillSub(sc, wh.value, '');
      const subs = (wh.value && whTree.find((x) => String(x.id) === String(wh.value))?.subcategories) || [];
      sc.disabled = !wh.value || subs.length === 0;
      pr.innerHTML = '<option value="">—</option>';
      pr.disabled = true;
      tr.querySelector('.r-stock').textContent = '—';
    });

    sc.addEventListener('change', () => {
      if (sc.value) {
        pr.disabled = false;
        loadProductsForRow(tr);
      } else {
        pr.innerHTML = '<option value="">—</option>';
        tr.querySelector('.r-stock').textContent = '—';
      }
    });

    pr.addEventListener('change', async () => {
      const id = pr.value;
      if (!id) {
        tr.querySelector('.r-stock').textContent = '—';
        return;
      }
      const { ok, data } = await window.purApi(
        '/api/purchasing/products?warehouseId=' + encodeURIComponent(wh.value) + '&warehouseSubcategoryId=' + encodeURIComponent(sc.value)
      );
      if (!ok || !data || !data.products) return;
      const p = (data.products || []).find((x) => String(x.id) === String(id));
      if (p) {
        applyStockCell(tr, p);
        if (p.unit_id && uu && Array.from(uu.options).some((o) => o.value === String(p.unit_id))) {
          uu.value = String(p.unit_id);
        }
      }
    });

    tr.querySelector('.r-file-img').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      const im = tr.querySelector('.r-imgprev');
      if (!f) {
        tr.dataset.imagePath = '';
        if (im) {
          im.style.display = 'none';
          im.removeAttribute('src');
        }
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        im.src = r.result;
        im.style.display = 'block';
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

    tr.querySelector('.copy-row-btn').addEventListener('click', () => {
      const snap = readRow(tr);
      insertNewLineAfter(tr, snap);
    });
  }

  function initRowFromSnapshot(tr, snap) {
    const wh = tr.querySelector('.r-wh');
    const sc = tr.querySelector('.r-sc');
    const pr = tr.querySelector('.r-pr');
    const uu = tr.querySelector('.r-unit');
    fillWh(wh, snap.wh);
    fillSub(sc, wh.value, snap.sc);
    fillUnits(uu, snap.un);
    const subs = (wh.value && whTree.find((x) => String(x.id) === String(wh.value))?.subcategories) || [];
    sc.disabled = !wh.value || subs.length === 0;
    if (wh.value && snap.sc) {
      sc.disabled = false;
      pr.disabled = false;
      loadProductsForRow(tr).then(() => {
        if (snap.p) {
          pr.value = String(snap.p);
          pr.dispatchEvent(new Event('change'));
        }
        setTimeout(() => {
          if (snap.un) uu.value = String(snap.un);
          if (snap.qty !== undefined && snap.qty !== '') tr.querySelector('.r-qty').value = snap.qty;
          if (snap.note) tr.querySelector('.r-note').value = snap.note;
        }, 0);
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
    tr.innerHTML = `
      <td><select class="r-wh pur-inp"></select></td>
      <td><select class="r-sc pur-inp" disabled></select></td>
      <td><select class="r-pr pur-inp" disabled><option value="">—</option></select></td>
      <td class="r-stock-cell"><span class="r-stock">—</span></td>
      <td><input type="number" class="r-qty pur-inp" min="0" step="any" /></td>
      <td><select class="r-unit pur-inp"></select></td>
      <td>
        <input type="file" accept="image/*" class="r-file-img r-file-input" />
        <div class="r-imgbox"><img class="r-imgprev" alt="" style="display:none" /></div>
      </td>
      <td><input type="file" accept="application/pdf,.pdf" class="r-file-pdf r-file-input" /></td>
      <td><input type="text" class="r-note pur-inp r-note-input" /></td>
      <td><button type="button" class="copy-row-btn" data-i18n="purch.req.copyRow">Kopya</button></td>`;
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
    if (snap && (snap.wh || snap.sc)) {
      tr.dataset.imagePath = '';
      tr.dataset.pdfPath = '';
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
      const pr = tr.querySelector('.r-pr')?.value;
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
          im.style.display = 'block';
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
    tr.innerHTML = `
      <td><select class="r-wh pur-inp"></select></td>
      <td><select class="r-sc pur-inp" disabled></select></td>
      <td><select class="r-pr pur-inp" disabled><option value="">—</option></select></td>
      <td class="r-stock-cell"><span class="r-stock">—</span></td>
      <td><input type="number" class="r-qty pur-inp" min="0" step="any" /></td>
      <td><select class="r-unit pur-inp"></select></td>
      <td>
        <input type="file" accept="image/*" class="r-file-img r-file-input" />
        <div class="r-imgbox"><img class="r-imgprev" alt="" style="display:none" /></div>
      </td>
      <td><input type="file" accept="application/pdf,.pdf" class="r-file-pdf r-file-input" /></td>
      <td><input type="text" class="r-note pur-inp r-note-input" /></td>
      <td><button type="button" class="copy-row-btn" data-i18n="purch.req.copyRow">Kopya</button></td>`;
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
