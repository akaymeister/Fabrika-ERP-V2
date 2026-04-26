/**
 * Toast + modal bildirimleri (alert yerine).
 * window.appNotify.toast(msg, { type, durationMs })
 * window.appNotify.success(msg) / .error(msg)
 * window.appNotify.modalError(msg, title)
 */
(function () {
  function ensureToastHost() {
    let host = document.getElementById('app-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'app-toast-host';
      host.setAttribute('aria-live', 'polite');
      Object.assign(host.style, {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: 'min(420px, calc(100vw - 32px))',
        pointerEvents: 'none',
      });
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, opts) {
    const o = opts || {};
    const type = o.type === 'success' ? 'success' : o.type === 'warning' ? 'warning' : 'error';
    const ms = Math.max(2500, o.durationMs || (type === 'error' ? 5200 : 4000));
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.textContent = String(message || '');
    const bg = type === 'success' ? '#0f766e' : type === 'warning' ? '#b45309' : '#b91c1c';
    Object.assign(el.style, {
      pointerEvents: 'auto',
      background: bg,
      color: '#fff',
      padding: '12px 14px',
      borderRadius: '10px',
      fontSize: '14px',
      lineHeight: '1.35',
      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      cursor: 'pointer',
    });
    host.appendChild(el);
    const t = setTimeout(() => {
      el.remove();
    }, ms);
    el.addEventListener('click', () => {
      clearTimeout(t);
      el.remove();
    });
  }

  function ensureModal() {
    let backdrop = document.getElementById('app-notify-modal');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'app-notify-modal';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    Object.assign(backdrop.style, {
      display: 'none',
      position: 'fixed',
      inset: '0',
      background: 'rgba(15,23,42,0.45)',
      zIndex: '10000',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#fff',
      borderRadius: '12px',
      maxWidth: '420px',
      width: '100%',
      padding: '20px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
      border: '1px solid #e2e8f0',
    });
    const h = document.createElement('h3');
    h.id = 'app-notify-modal-title';
    Object.assign(h.style, { margin: '0 0 12px', fontSize: '1.05rem' });
    const p = document.createElement('p');
    p.id = 'app-notify-modal-body';
    Object.assign(p.style, { margin: '0 0 16px', fontSize: '14px', lineHeight: '1.45', color: '#334155' });
    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', gap: '10px' });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'version-btn';
    btn.id = 'app-notify-modal-ok';
    actions.appendChild(btn);
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(actions);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function modalError(message, title) {
    const backdrop = ensureModal();
    const titleEl = document.getElementById('app-notify-modal-title');
    const bodyEl = document.getElementById('app-notify-modal-body');
    const okBtn = document.getElementById('app-notify-modal-ok');
    const t =
      title ||
      (window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t('ui.notify.errorTitle') : '') ||
      'Hata';
    const okLabel =
      (window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t('ui.notify.ok') : '') || 'Tamam';
    if (titleEl) titleEl.textContent = t;
    if (bodyEl) bodyEl.textContent = String(message || '');
    if (okBtn) okBtn.textContent = okLabel;
    backdrop.style.display = 'flex';
    const close = () => {
      backdrop.style.display = 'none';
    };
    if (okBtn) {
      okBtn.onclick = () => close();
    }
    backdrop.onclick = (ev) => {
      if (ev.target === backdrop) close();
    };
    if (okBtn) okBtn.focus();
  }

  window.appNotify = {
    toast,
    success: (m, opts) => toast(m, Object.assign({}, opts, { type: 'success' })),
    error: (m, opts) => toast(m, Object.assign({}, opts, { type: 'error' })),
    modalError,
  };
})();
