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
    normalizeUiTitles(el);
  }

  function localTitleCase(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const lang = getLang();
    const locale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'tr-TR';
    const lower = raw.toLocaleLowerCase(locale);
    const first = lower.charAt(0).toLocaleUpperCase(locale);
    return first + lower.slice(1);
  }

  function normalizeUiTitles(root) {
    const el = root || document;
    const selector = [
      'title[data-i18n]',
      'h1[data-i18n]',
      'h2[data-i18n]',
      'h3[data-i18n]',
      'h4[data-i18n]',
      'th[data-i18n]',
      'button[data-i18n]',
      'a[data-i18n]',
      'label[data-i18n]',
      '.version-btn[data-i18n]',
      '.module-button[data-i18n]',
      '.logout-btn[data-i18n]',
    ].join(', ');
    el.querySelectorAll(selector).forEach((n) => {
      if (!n || !n.textContent) return;
      if (window.uiFormat && typeof window.uiFormat.fmtTitleLabel === 'function') {
        n.textContent = window.uiFormat.fmtTitleLabel(n.textContent);
        return;
      }
      n.textContent = localTitleCase(n.textContent);
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
