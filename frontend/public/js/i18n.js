(function () {
  const SUPPORTED = ['tr', 'uz', 'ru', 'en'];
  let dict = {};

  function getLang() {
    const fromLs = localStorage.getItem('erp_lang');
    if (fromLs && SUPPORTED.includes(fromLs)) {
      return fromLs;
    }
    const sel = document.getElementById('languageSelect');
    if (sel && SUPPORTED.includes(sel.value)) {
      return sel.value;
    }
    return 'tr';
  }

  async function loadDict(lang) {
    const res = await fetch(`/i18n/${lang}.json`, { cache: 'no-store' });
    if (!res.ok) {
      return;
    }
    dict = await res.json();
  }

  function t(key) {
    return dict[key] || key;
  }

  /**
   * API JSON: { message, messageKey, error } — messageKey üzerinden çeviri
   */
  function apiErrorText(data) {
    if (!data || typeof data !== 'object') {
      return t('api.error.unknown');
    }
    if (data.messageKey) {
      const m = t(data.messageKey);
      if (m && m !== data.messageKey) {
        return m;
      }
    }
    if (data.message) {
      return data.message;
    }
    if (data.error) {
      return String(data.error);
    }
    return t('api.error.unknown');
  }

  function apply(root) {
    const el = root || document;
    el.querySelectorAll('[data-i18n]').forEach((n) => {
      const k = n.getAttribute('data-i18n');
      if (!k) {
        return;
      }
      const v = t(k);
      if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') {
        if (n.hasAttribute('placeholder')) {
          n.setAttribute('placeholder', v);
        } else {
          n.value = v;
        }
      } else if (n.tagName === 'SELECT') {
        /* textContent tüm <option> öğelerini siler; dinamik select'leri boş bırakmayın */
      } else {
        n.textContent = v;
      }
    });
    el.querySelectorAll('[data-i18n-placeholder]').forEach((n) => {
      const k = n.getAttribute('data-i18n-placeholder');
      if (k) {
        n.setAttribute('placeholder', t(k));
      }
    });
  }

  function setDocumentLang(lang) {
    if (SUPPORTED.includes(lang)) {
      document.documentElement.setAttribute('lang', lang);
    }
  }

  async function init() {
    const lang = getLang();
    setDocumentLang(lang);
    await loadDict(lang);
    apply(document);
    const sel = document.getElementById('languageSelect');
    if (sel) {
      sel.value = lang;
      sel.addEventListener('change', async () => {
        localStorage.setItem('erp_lang', sel.value);
        setDocumentLang(sel.value);
        await loadDict(sel.value);
        apply(document);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.i18n = { t, apply, init, getLang, loadDict, SUPPORTED, apiErrorText };
})();
