/**
 * Talep listesi + detay; onay yalnızca ?pending sayfasında
 */
(function () {
  const msg = document.getElementById('msg');
  const tbody = document.getElementById('reqBody');
  const det = document.getElementById('detailPanel');
  const flt = document.getElementById('fFilter');
  const pendingExtras = document.getElementById('prPendingExtras');
  const dlg = document.getElementById('prViewDlg');
  const dlgTitle = document.getElementById('prViewTitle');
  const dlgBody = document.getElementById('prViewBody');
  const dlgFooter = document.getElementById('prViewFooter');
  const dlgPrintBtn = document.getElementById('prViewPrint');
  const dlgPrintAttachBtn = document.getElementById('prViewPrintAttach');
  const dlgCloseBtn = document.getElementById('prViewClose');
  let list = [];
  let sel = null;
  let scope = { canApprove: false };
  let isPendingUrl = false;
  let dlgRequest = null;

  function tKey(k) {
    return window.i18n && window.i18n.t ? window.i18n.t(k) : k;
  }

  const ST = {
    draft: 'purch.status.reqV2.draft',
    pending: 'purch.status.req.pending',
    approved: 'purch.status.req.approved',
    rejected: 'purch.status.req.rejected',
    revision_requested: 'purch.status.reqV2.revision',
    ordered: 'purch.status.reqV2.ordered',
    partial: 'purch.status.req.partial',
    cancelled: 'purch.status.ord.cancelled',
  };

  function stLabel(s) {
    return tKey(ST[s] || s || '—');
  }

  function buyerStLabel(s) {
    const norm = String(s || '').trim().toLowerCase();
    if (!norm) return '—';
    const k = 'purch.status.buyer.' + norm;
    const v = tKey(k);
    return v && v !== k ? v : norm;
  }

  function ordStatusLabel(s) {
    const norm = String(s || '').trim().toLowerCase();
    if (!norm) return '—';
    const k = 'purch.status.ord.' + norm;
    const v = tKey(k);
    if (v && v !== k) return v;
    return norm;
  }

  function recentOrderStatusLabel(o) {
    if (o && o.status === 'cancelled') return ordStatusLabel('cancelled');
    if (o && o.buyer_status && o.buyer_status !== 'draft') {
      return buyerStLabel(o.buyer_status);
    }
    if (o && o.receipt_status && o.receipt_status !== 'awaiting_receipt' && o.receipt_status !== 'pending') {
      const k = 'purch.status.receipt.' + String(o.receipt_status).toLowerCase();
      const v = tKey(k);
      if (v && v !== k) return v;
    }
    return ordStatusLabel(o && o.status ? o.status : 'approved');
  }

  function procLabel(state) {
    if (!state) {
      return '—';
    }
    if (state === 'started') {
      return tKey('purch.proc.procStarted');
    }
    if (state === 'ongoing') {
      return tKey('purch.proc.procOngoing');
    }
    return '—';
  }

  function fmtQtyLocal(q) {
    if (window.uiFormat && typeof window.uiFormat.fmtQty === 'function') {
      return window.uiFormat.fmtQty(q);
    }
    if (typeof window.fmtQty === 'function') {
      return window.fmtQty(q);
    }
    return String(q ?? '—');
  }

  function showMsg(t, isErr) {
    msg.textContent = t;
    msg.style.color = isErr ? '#b91c1c' : '#0f766e';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderRow(r) {
    const date = String(r.created_at || '').slice(0, 10);
    return `<tr data-id="${r.id}" class="pr-row">
      <td>${esc(date)}</td>
      <td><strong>${esc(r.request_code || r.id)}</strong></td>
      <td>${esc(r.project_code || '—')}</td>
      <td>${esc(r.requester_name || '—')}</td>
      <td>${stLabel(r.pr_status)}</td>
      <td>${esc(procLabel(r.procurement_state))}</td>
      <td class="pr-cell-view">
        <button type="button" class="pr-view-btn" data-action="view" data-id="${esc(r.id)}" title="${esc(tKey('purch.wf.viewBtn'))}" aria-label="${esc(tKey('purch.wf.viewBtn'))}">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="pr-icon-svg"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
          <span class="pr-view-btn-label">${esc(tKey('purch.wf.viewBtn'))}</span>
        </button>
      </td>
    </tr>`;
  }

  function imgCell(url) {
    if (!url) {
      return '—';
    }
    return `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="" class="pr-det-img pr-det-img-thumb" /></a>`;
  }

  function renderDetail() {
    if (!det) return;
    if (!sel) {
      det.innerHTML = `<p class="muted">${tKey('purch.wf.selectRow')}</p>`;
      return;
    }
    const r = list.find((x) => String(x.id) === String(sel.id)) || sel;
    const it = (r.items || [])
      .map(
        (l) => `<tr>
        <td>${esc(l.product_code)} — ${esc(l.product_name)}</td>
        <td>${esc(fmtQtyLocal(l.quantity))} ${esc(l.unit_code || '')}</td>
        <td>${imgCell(l.line_image_path)}</td>
        <td>${l.line_pdf_path ? `<a href="${esc(l.line_pdf_path)}" target="_blank">PDF</a>` : '—'}</td>
        <td>${esc(l.line_note || '—')}</td>
      </tr>`
      )
      .join('');
    const note = r.status_message ? `<p class="pr-det-revision-note"><strong>${tKey('purch.wf.lastNote')}</strong> ${esc(r.status_message)}</p>` : '';
    const appr = r.approver_name ? `<p>${tKey('purch.wf.approver')}: ${esc(r.approver_name)}</p>` : '';
    const editL =
      r.pr_status === 'revision_requested' || r.pr_status === 'draft'
        ? `<p><a class="btn btn-secondary btn-sm pr-det-edit-link" href="/purchase-requisition-open.html?id=${r.id}">${tKey('purch.wf.editReq')}</a></p>`
        : '';
    const procExtra = r.procurement_state
      ? `<p class="text-ui pr-det-proc-extra"><strong>${tKey('purch.wf.colProcure')}:</strong> ${esc(procLabel(r.procurement_state))}</p>`
      : '';
    det.innerHTML = `
      <h4 class="app-card-title">${esc(r.request_code || r.id)}</h4>
      <p>${tKey('purch.wf.project')}: <strong>${esc(r.project_code || '—')}</strong> — ${esc(r.project_name || '')}</p>
      <p>${tKey('purch.wf.requester')}: ${esc(r.requester_name || '—')}</p>
      <p>${tKey('purch.req.lColStatus')}: <strong>${stLabel(r.pr_status)}</strong></p>
      ${procExtra}
      ${note}${appr}
      ${editL}
      <p>${tKey('purch.req.note')}: ${esc(r.note || '—')}</p>
      <div class="app-table-scroll">
        <table class="pr-det-table app-table">
          <thead><tr>
            <th>${tKey('purch.req.colProd')}</th>
            <th>${tKey('purch.req.colQty')} / ${tKey('purch.req.colUnit')}</th>
            <th>${tKey('purch.req.colImg')}</th>
            <th>${tKey('purch.req.colPdf')}</th>
            <th>${tKey('purch.req.colNoteShort')}</th>
          </tr></thead>
          <tbody>${it || '<tr><td colspan="5">—</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  function renderDialog(r) {
    if (!dlg || !dlgBody || !dlgFooter || !dlgTitle) return;
    dlgTitle.textContent = r.request_code || ('#' + r.id);

    const itemRows = (r.items || [])
      .map(
        (l) => `<tr>
        <td class="pr-view-cell-prod app-table-cell-wrap">${l.product_code ? `<div class="pr-view-prod-code"><strong>${esc(l.product_code)}</strong></div>` : ''}<div class="pr-view-prod-name">${esc(l.product_name || '')}</div></td>
        <td class="pr-view-cell-qty">${esc(fmtQtyLocal(l.quantity))} ${esc(l.unit_code || '')}</td>
        <td class="pr-view-cell-img">${l.line_image_path ? `<a href="${esc(l.line_image_path)}" target="_blank" rel="noopener"><img src="${esc(l.line_image_path)}" alt="" class="pr-line-img" /></a>` : '—'}</td>
        <td class="pr-view-cell-pdf">${l.line_pdf_path ? `<a href="${esc(l.line_pdf_path)}" target="_blank" rel="noopener">${esc(tKey('purch.req.colPdf'))}</a>` : '—'}</td>
        <td class="pr-view-cell-note app-table-cell-wrap">${esc(l.line_note || '—')}</td>
      </tr>`
      )
      .join('');

    const pdfCount = (r.items || []).reduce((acc, l) => acc + (l.line_pdf_path ? 1 : 0), 0);
    if (dlgPrintAttachBtn) {
      dlgPrintAttachBtn.hidden = pdfCount === 0;
      const baseLabel = tKey('purch.print.btnAttach');
      dlgPrintAttachBtn.textContent = pdfCount > 0 ? `${baseLabel} (${pdfCount})` : baseLabel;
    }

    const notePart = r.status_message
      ? `<p class="pr-view-note"><strong>${tKey('purch.wf.lastNote')}</strong> ${esc(r.status_message)}</p>`
      : '';
    const apprPart = r.approver_name ? `<p>${tKey('purch.wf.approver')}: ${esc(r.approver_name)}</p>` : '';
    const procPart = r.procurement_state
      ? `<p><strong>${tKey('purch.wf.colProcure')}:</strong> ${esc(procLabel(r.procurement_state))}</p>`
      : '';

    dlgBody.innerHTML = `
      <div class="pr-view-meta">
        <p><strong>${tKey('purch.wf.project')}:</strong> ${esc(r.project_code || '—')}${r.project_name ? ' — ' + esc(r.project_name) : ''}</p>
        <p><strong>${tKey('purch.wf.requester')}:</strong> ${esc(r.requester_name || '—')}</p>
        <p><strong>${tKey('purch.wf.colDate')}:</strong> ${esc(String(r.created_at || '').slice(0, 16).replace('T', ' '))}</p>
        <p><strong>${tKey('purch.req.lColStatus')}:</strong> ${stLabel(r.pr_status)}</p>
        ${procPart}
        ${notePart}${apprPart}
        ${r.note ? `<p><strong>${tKey('purch.req.note')}:</strong> ${esc(r.note)}</p>` : ''}
      </div>
      <div class="app-table-scroll">
        <table class="pr-det-table app-table pr-view-items">
          <thead><tr>
            <th class="pr-view-th-prod">${tKey('purch.req.colProd')}</th>
            <th class="pr-view-th-qty">${tKey('purch.req.colQty')} / ${tKey('purch.req.colUnit')}</th>
            <th class="pr-view-th-img">${tKey('purch.req.colImg')}</th>
            <th class="pr-view-th-pdf">${tKey('purch.req.colPdf')}</th>
            <th class="pr-view-th-note">${tKey('purch.req.colNoteShort')}</th>
          </tr></thead>
          <tbody>${itemRows || '<tr><td colspan="5">—</td></tr>'}</tbody>
        </table>
      </div>
    `;

    const canActApproval = isPendingUrl && scope.canApprove && r.pr_status === 'pending';
    if (canActApproval) {
      // data-perm-any: scope.canApprove zaten gate ediyor, ama defense-in-depth
      // amaçlı her butona ayrıca yetki anahtarı koyuyoruz; scope yüklenemese
      // bile authContext üzerinden gating çalışsın.
      dlgFooter.innerHTML = `
        <label class="app-label" for="prViewActNote">${tKey('purch.wf.actionNote')}</label>
        <textarea id="prViewActNote" class="app-input app-textarea pr-view-note-input" rows="2"></textarea>
        <div class="pr-act-buttons" role="group" aria-label="${esc(tKey('purch.req.lColAction'))}">
          <button type="button" class="btn btn-success btn-sm" data-action="approve" data-perm-any="module.purchasing.approve purchasing.request.approve" data-id="${esc(r.id)}">${tKey('purch.req.approve')}</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="reject" data-perm-any="module.purchasing.approve purchasing.request.approve" data-id="${esc(r.id)}">${tKey('purch.req.reject')}</button>
          <button type="button" class="btn btn-warning btn-sm" data-action="revise" data-perm-any="module.purchasing.approve purchasing.request.approve" data-id="${esc(r.id)}">${tKey('purch.wf.requestRevision')}</button>
        </div>
      `;
      dlgFooter.hidden = false;
      if (window.authContext && typeof window.authContext.applyActionPermissionGating === 'function') {
        window.authContext.applyActionPermissionGating(dlgFooter);
      }
    } else {
      dlgFooter.innerHTML = '';
      dlgFooter.hidden = true;
    }

    if (window.i18n && window.i18n.apply) {
      window.i18n.apply(dlg);
    }
  }

  async function openDialogForId(id) {
    if (!dlg) return;
    dlgRequest = null;
    if (dlgTitle) dlgTitle.textContent = '…';
    if (dlgBody) dlgBody.innerHTML = `<p class="muted">${esc(tKey('purch.req.loading'))}</p>`;
    if (dlgFooter) {
      dlgFooter.innerHTML = '';
      dlgFooter.hidden = true;
    }
    if (dlgPrintAttachBtn) {
      dlgPrintAttachBtn.hidden = true;
      dlgPrintAttachBtn.disabled = false;
    }
    if (typeof dlg.showModal === 'function' && !dlg.open) {
      dlg.showModal();
    } else if (!dlg.open) {
      dlg.setAttribute('open', 'open');
    }
    const { ok, data } = await window.purApi('/api/purchasing/requests/' + encodeURIComponent(id));
    if (!ok || !data || !data.ok || !data.request) {
      if (dlgBody) dlgBody.innerHTML = `<p class="is-err">${esc((window.i18n && window.i18n.apiErrorText) ? window.i18n.apiErrorText(data) : tKey('api.error.unknown'))}</p>`;
      return;
    }
    dlgRequest = data.request;
    sel = data.request;
    const i = list.findIndex((x) => String(x.id) === String(id));
    if (i >= 0) list[i] = data.request;
    renderDialog(data.request);
  }

  function closeDialog() {
    if (!dlg) return;
    if (typeof dlg.close === 'function' && dlg.open) {
      dlg.close();
    } else {
      dlg.removeAttribute('open');
    }
    dlgRequest = null;
  }

  async function onDialogActions(e) {
    const btn = e.target.closest('button[data-action][data-id]');
    if (!btn || !dlgFooter || !dlgFooter.contains(btn)) return;
    const action = String(btn.getAttribute('data-action') || '').trim();
    let st = null;
    if (action === 'approve') st = 'approved';
    else if (action === 'reject') st = 'rejected';
    else if (action === 'revise') st = 'revision_requested';
    if (!st) return;
    const noteEl = document.getElementById('prViewActNote');
    const note = (noteEl && noteEl.value) || '';
    if ((st === 'rejected' || st === 'revision_requested') && !note.trim()) {
      showMsg(tKey('purch.wf.noteRequired'), true);
      if (noteEl) noteEl.focus();
      return;
    }
    const id = btn.getAttribute('data-id');
    btn.disabled = true;
    const { ok, data } = await window.purApi('/api/purchasing/requests/' + encodeURIComponent(id) + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: st, note: note.trim() || undefined }),
    });
    btn.disabled = false;
    if (!ok) {
      showMsg((window.i18n && window.i18n.apiErrorText) ? window.i18n.apiErrorText(data) : tKey('api.error.unknown'), true);
      return;
    }
    showMsg(tKey('purch.wf.statusOk'));
    closeDialog();
    await load();
    await loadPendingSidePanels();
  }

  function buildPrintHtml(r) {
    const fmtDate = String(r.created_at || '').slice(0, 16).replace('T', ' ');
    const itemsHtml = (r.items || [])
      .map(
        (l, idx) => `<tr>
        <td class="cnum">${idx + 1}</td>
        <td class="cprod">${l.product_code ? `<div class="pc"><strong>${esc(l.product_code)}</strong></div>` : ''}<div class="pn">${esc(l.product_name || '')}</div></td>
        <td class="cqty">${esc(fmtQtyLocal(l.quantity))} ${esc(l.unit_code || '')}</td>
        <td class="cimg">${l.line_image_path ? `<img src="${esc(l.line_image_path)}" alt="" />` : '—'}</td>
        <td class="cnote">${esc(l.line_note || '')}</td>
      </tr>`
      )
      .join('');

    const styles = `
      @page { size: A4 landscape; margin: 12mm 14mm; }
      * { box-sizing: border-box; }
      body { font: 11px/1.45 Arial, Helvetica, sans-serif; color:#111; margin:0; }
      h1 { font-size: 17px; margin: 0 0 4px; letter-spacing: .5px; }
      .meta { display:grid; grid-template-columns: repeat(3, 1fr); gap:4px 20px; margin: 8px 0 12px; font-size: 11px; }
      .meta div { padding: 2px 0; }
      table.print-items { width:100%; border-collapse: collapse; table-layout: fixed; }
      table.print-items th, table.print-items td { border:1px solid #888; padding:6px 8px; vertical-align: top; }
      table.print-items th { background:#eee; text-align:left; font-size: 10px; }
      table.print-items td.cnum { width: 3%; text-align:center; white-space: nowrap; }
      table.print-items th.cw-prod, table.print-items td.cprod {
        width: 46%;
        white-space: normal !important;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
        -webkit-hyphens: auto;
      }
      table.print-items td.cprod .pc { margin-bottom: 4px; font-size: 10px; color: #333; }
      table.print-items td.cprod .pn { font-size: 11px; font-weight: 600; }
      table.print-items td.cqty { width: 11%; white-space: nowrap; }
      table.print-items td.cimg { width: 9%; text-align:center; }
      table.print-items td.cimg img { max-width: 72px; max-height: 72px; object-fit: contain; }
      table.print-items td.cnote {
        width: 31%;
        white-space: normal !important;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .footer { margin-top: 24px; display:grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      .sig { border-top:1px solid #444; padding-top: 6px; text-align:center; font-size: 10px; }
      .note-block { margin: 8px 0; font-size: 11px; }
      .pdf-list { margin-top: 14px; padding-top: 8px; border-top:1px dashed #888; font-size: 10px; }
      .pdf-list h4 { margin: 0 0 6px; font-size: 11px; }
      .pdf-list ul { margin: 0; padding-left: 18px; }
      @media print {
        a { color:#000; text-decoration: none; }
        table.print-items th, table.print-items td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;

    const pdfList = (r.items || [])
      .filter((l) => !!l.line_pdf_path)
      .map((l, idx) => `<li>${esc(l.product_code || '')}${l.product_code ? ' — ' : ''}${esc(l.product_name || '')} → <a href="${esc(l.line_pdf_path)}" target="_blank">PDF</a></li>`)
      .join('');

    const projectLine = `${esc(r.project_code || '—')}${r.project_name ? ' — ' + esc(r.project_name) : ''}`;
    const generalNote = r.note ? `<div class="note-block"><strong>${esc(tKey('purch.req.note'))}:</strong> ${esc(r.note)}</div>` : '';
    const statusNote = r.status_message ? `<div class="note-block"><strong>${esc(tKey('purch.wf.lastNote'))}</strong> ${esc(r.status_message)}</div>` : '';

    return `<!DOCTYPE html><html lang="tr"><head>
      <meta charset="UTF-8" />
      <title>${esc(r.request_code || r.id)}</title>
      <style>${styles}</style>
    </head><body>
      <h1>${esc(tKey('purch.print.requestTitle'))}</h1>
      <div class="meta">
        <div><strong>${esc(tKey('purch.req.lColCode'))}:</strong> ${esc(r.request_code || r.id)}</div>
        <div><strong>${esc(tKey('purch.wf.colDate'))}:</strong> ${esc(fmtDate)}</div>
        <div><strong>${esc(tKey('purch.wf.project'))}:</strong> ${projectLine}</div>
        <div><strong>${esc(tKey('purch.wf.requester'))}:</strong> ${esc(r.requester_name || '—')}</div>
        <div><strong>${esc(tKey('purch.req.lColStatus'))}:</strong> ${esc(stLabel(r.pr_status))}</div>
        <div><strong>${esc(tKey('purch.wf.colProcure'))}:</strong> ${esc(procLabel(r.procurement_state))}</div>
      </div>
      ${generalNote}${statusNote}
      <table class="print-items">
        <thead><tr>
          <th class="cw-num">#</th>
          <th class="cw-prod">${esc(tKey('purch.req.colProd'))}</th>
          <th class="cw-qty">${esc(tKey('purch.req.colQty'))} / ${esc(tKey('purch.req.colUnit'))}</th>
          <th class="cw-img">${esc(tKey('purch.req.colImg'))}</th>
          <th class="cw-note">${esc(tKey('purch.req.colNoteShort'))}</th>
        </tr></thead>
        <tbody>${itemsHtml || `<tr><td colspan="5">—</td></tr>`}</tbody>
      </table>
      ${pdfList ? `<div class="pdf-list"><h4>${esc(tKey('purch.print.pdfAttachments'))}</h4><ul>${pdfList}</ul></div>` : ''}
      <div class="footer">
        <div class="sig">${esc(tKey('purch.print.sigRequester'))}</div>
        <div class="sig">${esc(tKey('purch.print.sigApprover'))}</div>
        <div class="sig">${esc(tKey('purch.print.sigBuyer'))}</div>
      </div>
    </body></html>`;
  }

  async function waitImagesLoaded(win) {
    try {
      const imgs = (win && win.document && win.document.images) || [];
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
    } catch (e) {
      /* ignore */
    }
  }

  function printInIframe(payload, isHtml) {
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
            if (isHtml) {
              await waitImagesLoaded(iframe.contentWindow);
            } else {
              await new Promise((r) => setTimeout(r, 700));
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
      if (isHtml) {
        try {
          iframe.srcdoc = payload;
        } catch (e) {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(payload);
            doc.close();
          } catch (e2) {
            cleanup();
          }
        }
      } else {
        iframe.src = payload;
      }
    });
  }

  function collectPdfPaths(r) {
    const pdfPaths = [];
    const seen = new Set();
    (r && r.items ? r.items : []).forEach((l) => {
      const p = l.line_pdf_path;
      if (p && !seen.has(p)) {
        seen.add(p);
        pdfPaths.push(p);
      }
    });
    return pdfPaths;
  }

  async function printRequest(r) {
    if (!r) return;
    if (dlgPrintBtn) dlgPrintBtn.disabled = true;
    try {
      await printInIframe(buildPrintHtml(r), true);
    } finally {
      if (dlgPrintBtn) dlgPrintBtn.disabled = false;
    }
  }

  async function printAttachmentsOnly(r) {
    if (!r) return;
    const pdfPaths = collectPdfPaths(r);
    if (pdfPaths.length === 0) return;
    if (dlgPrintAttachBtn) dlgPrintAttachBtn.disabled = true;
    try {
      for (let i = 0; i < pdfPaths.length; i += 1) {
        try {
          await printInIframe(pdfPaths[i], false);
        } catch (e) {
          /* ignore one pdf and continue */
        }
      }
    } finally {
      if (dlgPrintAttachBtn) dlgPrintAttachBtn.disabled = false;
    }
  }

  async function loadPendingSidePanels() {
    if (!isPendingUrl || !pendingExtras) return;
    pendingExtras.hidden = false;
    const [ordRes, rejRes] = await Promise.all([
      window.purApi('/api/purchasing/orders?recentBuyerCompleted=1&limit=10'),
      window.purApi('/api/purchasing/requests?statuses=rejected,revision_requested'),
    ]);
    const ordRows =
      ordRes.ok && ordRes.data && ordRes.data.ok && Array.isArray(ordRes.data.orders)
        ? ordRes.data.orders
        : [];
    const rejRows =
      rejRes.ok && rejRes.data && rejRes.data.ok && Array.isArray(rejRes.data.requests) ? rejRes.data.requests : [];
    const ordBody =
      ordRows.length === 0
        ? `<tr><td colspan="5">—</td></tr>`
        : ordRows
            .map(
              (o) => `<tr>
          <td>${esc(String(o.order_date || o.updated_at || '').slice(0, 10))}</td>
          <td><strong>${esc(o.linked_request_code || o.request_code || '—')}</strong></td>
          <td>${esc(o.project_code || '—')}</td>
          <td>${esc(o.linked_requester_name || o.requester_name || '—')}</td>
          <td>${esc(recentOrderStatusLabel(o))}</td>
        </tr>`
            )
            .join('');
    const rejBody =
      rejRows.length === 0
        ? `<tr><td colspan="5">—</td></tr>`
        : rejRows
            .map(
              (x) => `<tr>
          <td>${esc(x.request_code || x.id)}</td>
          <td>${esc(x.project_code || '—')}</td>
          <td>${esc(x.requester_name || '—')}</td>
          <td>${esc(stLabel(x.pr_status))}</td>
          <td>${esc(x.status_message || '—')}</td>
        </tr>`
            )
            .join('');
    pendingExtras.innerHTML = `
      <section class="card app-card erp-card app-card-stack-mt">
        <h3 class="app-card-title" data-i18n="purch.wf.cardRecentOrders">Son Onaylanan Siparişler</h3>
        <p class="muted text-meta" data-i18n="purch.wf.cardRecentOrdersSub">Onayı verilip satınalmaya aktarılan son 10 sipariş</p>
        <div class="app-table-scroll">
          <table class="app-table pr-side-table">
            <thead><tr>
              <th data-i18n="purch.wf.colDate">Tarih</th>
              <th data-i18n="purch.req.lColCode">Talep no</th>
              <th data-i18n="purch.req.lColProject">Proje</th>
              <th data-i18n="purch.wf.colRequesterShort">Talep eden</th>
              <th data-i18n="purch.req.lColStatus">Durum</th>
            </tr></thead>
            <tbody>${ordBody}</tbody>
          </table>
        </div>
      </section>
      <section class="card app-card erp-card app-card-stack-mt">
        <h3 class="app-card-title" data-i18n="purch.wf.cardRejectedTitle">Red / Revizyon Bekleyen Talepler</h3>
        <div class="app-table-scroll">
          <table class="app-table pr-side-table">
            <thead><tr>
              <th data-i18n="purch.req.lColCode">Talep no</th>
              <th data-i18n="purch.req.lColProject">Proje</th>
              <th data-i18n="purch.req.lColUser">Talep eden</th>
              <th data-i18n="purch.req.lColStatus">Durum</th>
              <th data-i18n="purch.wf.colNoteShort">Açıklama</th>
            </tr></thead>
            <tbody>${rejBody}</tbody>
          </table>
        </div>
      </section>`;
    if (window.i18n && window.i18n.apply) {
      window.i18n.apply(pendingExtras);
    }
  }

  async function load() {
    const st = (flt && flt.value) || '';
    const q = st ? '?status=' + encodeURIComponent(st) : '';
    const { ok, data } = await window.purApi('/api/purchasing/requests' + q);
    if (!ok || !data || !data.ok) {
      tbody.innerHTML = '<tr><td colspan="7">—</td></tr>';
      return;
    }
    list = data.requests || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7">' + tKey('purch.req.empty') + '</td></tr>';
    } else {
      tbody.innerHTML = list.map(renderRow).join('');
    }
    if (window.i18n && window.i18n.apply) {
      window.i18n.apply(document);
    }
    if (isPendingUrl) {
      await loadPendingSidePanels();
    } else if (pendingExtras) {
      pendingExtras.hidden = true;
      pendingExtras.innerHTML = '';
    }
  }

  function start() {
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => {
        location.href = '/login.html';
      });
    });
    if (flt) {
      flt.addEventListener('change', () => load());
    }
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button.pr-view-btn[data-id]');
        if (btn) {
          e.preventDefault();
          const id = btn.getAttribute('data-id');
          if (id) void openDialogForId(id);
          return;
        }
        const tr = e.target.closest('tr.pr-row[data-id]');
        if (tr) {
          const id = tr.getAttribute('data-id');
          if (id) void openDialogForId(id);
        }
      });
    }
    if (dlg) {
      dlgCloseBtn?.addEventListener('click', () => closeDialog());
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) closeDialog();
      });
      dlg.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeDialog();
      });
      dlgFooter?.addEventListener('click', onDialogActions);
      dlgPrintBtn?.addEventListener('click', () => {
        if (dlgRequest) void printRequest(dlgRequest);
      });
      dlgPrintAttachBtn?.addEventListener('click', () => {
        if (dlgRequest) void printAttachmentsOnly(dlgRequest);
      });
    }
    (async function () {
      isPendingUrl = window.location.search.includes('pending');
      if (window.initPurchasingPageNav) {
        await window.initPurchasingPageNav(isPendingUrl ? 'appr' : 'listreq');
      }
      const s = window.getPurchasingScope && window.getPurchasingScope();
      if (s) {
        scope = s;
      }
      // Statik buton gating (Talep aç / Satınalma işleme linkleri)
      if (window.authContext && typeof window.authContext.applyActionPermissionGating === 'function') {
        window.authContext.applyActionPermissionGating(document);
      }
      if (flt) {
        flt.value = '';
      }
      await load();
      if (window.i18n && window.i18n.apply) {
        window.i18n.apply(document);
      }
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
