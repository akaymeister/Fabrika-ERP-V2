/**
 * Fabrika ERP — global UI formatting helpers (Phase 1).
 * Sadece görüntüleme; kayıtlı / hesaplanan ham değerlere dokunmaz.
 *
 * Kullanım: sayfaya script ekleyin, sonra örn. window.uiFormat.fmtMoney(x)
 */
(function (global) {
  'use strict';

  /** @type {Record<string, string>} */
  const LANG_TO_LOCALE = { tr: 'tr-TR', uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

  function resolveUiLocale() {
    if (typeof document === 'undefined') {
      return 'tr-TR';
    }
    const lang = document.documentElement.getAttribute('lang') || 'tr';
    return LANG_TO_LOCALE[lang] || 'tr-TR';
  }

  /**
   * @param {unknown} value
   * @returns {number}
   */
  function toFiniteNumber(value) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Para ve tutar gösterimi: 2 ondalık (locale’e göre ayırıcılar).
   * @param {unknown} value
   * @returns {string}
   */
  function fmtMoney(value) {
    const n = toFiniteNumber(value);
    try {
      return new Intl.NumberFormat(resolveUiLocale(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return n.toFixed(2);
    }
  }

  /**
   * Stok / miktar / ölçü gösterimi: 2 ondalık.
   * @param {unknown} value
   * @returns {string}
   */
  function fmtQty(value) {
    const n = toFiniteNumber(value);
    try {
      return new Intl.NumberFormat(resolveUiLocale(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return n.toFixed(2);
    }
  }

  /**
   * Kullanıcı verisi (kod, ad, birim vb.) ekranda büyük harf.
   * Türkçe İ/I kuralları için tr-TR (stok tarafındaki görüntüleme ile uyumlu).
   * @param {unknown} text
   * @returns {string}
   */
  function fmtDisplayUpper(text) {
    return String(text ?? '').toLocaleUpperCase('tr-TR');
  }

  /**
   * Menü, buton, başlık vb.: tek cümle — ilk harf büyük, kalanı küçük (aktif UI dili).
   * @param {unknown} text
   * @returns {string}
   */
  function fmtTitleLabel(text) {
    const s = String(text ?? '').trim();
    if (!s) {
      return '';
    }
    const loc = resolveUiLocale();
    const lower = s.toLocaleLowerCase(loc);
    const first = lower.charAt(0).toLocaleUpperCase(loc);
    return first + lower.slice(1);
  }

  const uiFormat = {
    fmtMoney,
    fmtQty,
    fmtDisplayUpper,
    fmtTitleLabel,
  };

  global.uiFormat = uiFormat;
})(typeof window !== 'undefined' ? window : globalThis);
