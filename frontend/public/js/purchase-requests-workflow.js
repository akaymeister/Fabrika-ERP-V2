/**
 * Talep listesi + detay + onay / red / revizyon
 */
(function () {
  const msg = document.getElementById('msg');
  const tbody = document.getElementById('reqBody');
  const det = document.getElementById('detailPanel');
  const flt = document.getElementById('fFilter');
  let list = [];
  let sel = null;
  let scope = { canApprove: false };

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

  function showMsg(t, isErr) {
    msg.textContent = t;
    msg.style.color = isErr ? '#b91c1c' : '#0f766e';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderRow(r) {
    return `<tr data-id="${r.id}" class="pr-row" style="cursor:pointer"><td>${esc(r.request_code || r.id)}</td><td>${esc(
      r.project_code || '—'
    )}</td><td>${esc(r.requester_name || '—')}</td><td>${stLabel(r.pr_status)}</td><td>${esc(procLabel(r.procurement_state))}</td><td>${esc(
      r.created_at || ''
    ).slice(0, 10)}</td></tr>`;
  }

  function imgCell(url) {
    if (!url) {
      return '—';
    }
    return `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="" class="pr-det-img" style="max-height:56px;max-width:80px" /></a>`;
  }

  function renderDetail() {
    if (!sel) {
      det.innerHTML = `<p class="muted">${tKey('purch.wf.selectRow')}</p>`;
      return;
    }
    const r = list.find((x) => String(x.id) === String(sel.id)) || sel;
    const it = (r.items || [])
      .map(
        (l) => `<tr>
        <td>${esc(l.product_code)} — ${esc(l.product_name)}</td>
        <td>${esc(String(l.quantity))} ${esc(l.unit_code || '')}</td>
        <td>${imgCell(l.line_image_path)}</td>
        <td>${l.line_pdf_path ? `<a href="${esc(l.line_pdf_path)}" target="_blank">PDF</a>` : '—'}</td>
        <td>${esc(l.line_note || '—')}</td>
      </tr>`
      )
      .join('');
    const canAct = scope.canApprove && r.pr_status === 'pending';
    const note = r.status_message ? `<p style="color:#b45309"><strong>${tKey('purch.wf.lastNote')}</strong> ${esc(r.status_message)}</p>` : '';
    const appr = r.approver_name ? `<p>${tKey('purch.wf.approver')}: ${esc(r.approver_name)}</p>` : '';
    const editL =
      r.pr_status === 'revision_requested' || r.pr_status === 'draft'
        ? `<p><a class="version-btn" href="/purchase-requisition-open.html?id=${r.id}" style="text-decoration:none">${tKey('purch.wf.editReq')}</a></p>`
        : '';
    const procExtra = r.procurement_state
      ? `<p class="text-ui" style="color:#0369a1"><strong>${tKey('purch.wf.colProcure')}:</strong> ${esc(procLabel(r.procurement_state))}</p>`
      : '';
    det.innerHTML = `
      <h4>${esc(r.request_code || r.id)}</h4>
      <p>${tKey('purch.wf.project')}: <strong>${esc(r.project_code || '—')}</strong> — ${esc(r.project_name || '')}</p>
      <p>${tKey('purch.wf.requester')}: ${esc(r.requester_name || '—')}</p>
      <p>${tKey('purch.req.lColStatus')}: <strong>${stLabel(r.pr_status)}</strong></p>
      ${procExtra}
      ${note}${appr}
      ${editL}
      <p>${tKey('purch.req.note')}: ${esc(r.note || '—')}</p>
      <div style="overflow-x:auto">
        <table class="pr-det-table">
          <thead><tr>
            <th>${tKey('purch.req.colProd')}</th>
            <th>${tKey('purch.req.colQty')} / ${tKey('purch.req.colUnit')}</th>
            <th>${tKey('purch.req.colImg')}</th>
            <th>${tKey('purch.req.colPdf')}</th>
            <th>${tKey('purch.req.colLineNote')}</th>
          </tr></thead>
          <tbody>${it || '<tr><td colspan="5">—</td></tr>'}</tbody>
        </table>
      </div>
      <div class="pr-act" style="margin-top:12px;${canAct ? '' : 'display:none'}">
        <label for="actNote">${tKey('purch.wf.actionNote')}</label>
        <textarea id="actNote" rows="2" style="width:100%;max-width:480px;border-radius:8px;padding:8px;box-sizing:border-box;display:block"></textarea>
        <div class="pr-act-buttons" role="group" aria-label="${esc(tKey('purch.req.lColAction'))}">
          <button type="button" class="version-btn" id="btnAp">${tKey('purch.req.approve')}</button>
          <button type="button" class="version-btn" style="background:#b91c1c;border:none" id="btnRj">${tKey('purch.req.reject')}</button>
          <button type="button" class="version-btn" style="background:#b45309;border:none" id="btnRv">${tKey('purch.wf.requestRevision')}</button>
        </div>
      </div>
    `;
    if (canAct) {
      document.getElementById('btnAp').addEventListener('click', () => doPatch('approved'));
      document.getElementById('btnRj').addEventListener('click', () => doPatch('rejected'));
      document.getElementById('btnRv').addEventListener('click', () => doPatch('revision_requested'));
    }
  }

  async function doPatch(st) {
    if (!sel) {
      return;
    }
    const note = (document.getElementById('actNote') && document.getElementById('actNote').value) || '';
    if ((st === 'rejected' || st === 'revision_requested') && !note.trim()) {
      showMsg(tKey('purch.wf.noteRequired'), true);
      return;
    }
    const { ok, data } = await window.purApi('/api/purchasing/requests/' + sel.id + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: st, note: note.trim() || undefined }),
    });
    if (!ok) {
      showMsg((window.i18n && window.i18n.apiErrorText) ? window.i18n.apiErrorText(data) : tKey('api.error.unknown'), true);
      return;
    }
    showMsg(tKey('purch.wf.statusOk'));
    await load();
    const row = (list || []).find((x) => String(x.id) === String(sel.id));
    sel = row || null;
    renderDetail();
  }

  async function load() {
    const st = (flt && flt.value) || '';
    const q = st ? '?status=' + encodeURIComponent(st) : '';
    const { ok, data } = await window.purApi('/api/purchasing/requests' + q);
    if (!ok || !data || !data.ok) {
      tbody.innerHTML = '<tr><td colspan="6">—</td></tr>';
      return;
    }
    list = data.requests || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6">' + tKey('purch.req.empty') + '</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(renderRow).join('');
    tbody.querySelectorAll('.pr-row').forEach((tr) => {
      tr.addEventListener('click', () => {
        const id = tr.getAttribute('data-id');
        sel = list.find((x) => String(x.id) === String(id)) || { id };
        document.querySelectorAll('.pr-row').forEach((r) => r.classList.remove('pr-row-sel'));
        tr.classList.add('pr-row-sel');
        (async function () {
          const { ok: o2, data: d2 } = await window.purApi('/api/purchasing/requests/' + id);
          if (o2 && d2 && d2.ok && d2.request) {
            sel = d2.request;
            const i = list.findIndex((x) => String(x.id) === String(id));
            if (i >= 0) {
              list[i] = d2.request;
            }
          }
          renderDetail();
        })();
      });
    });
    if (window.i18n && window.i18n.apply) {
      window.i18n.apply(document);
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
    (async function () {
      const approvalsQueue = window.location.search.includes('pending');
      if (window.initPurchasingPageNav) {
        await window.initPurchasingPageNav(approvalsQueue ? 'appr' : 'listreq');
      }
      const s = window.getPurchasingScope && window.getPurchasingScope();
      if (s) {
        scope = s;
      }
      if (approvalsQueue) {
        if (flt) {
          flt.value = 'pending';
        }
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
