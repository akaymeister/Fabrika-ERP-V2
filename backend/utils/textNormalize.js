/**
 * Kullanıcı metin alanlarının kayıtta tutarlı görünmesi: Türkçe büyük harf (I/İ, i/ı).
 * Girişte küçük harf de yazılabilir; persist ederken büyütülür.
 * Not: e-posta, oturum şifreleri, teknik slug/kod (ör. unbranded) istisna tutulur.
 */

/**
 * @param {unknown} value
 * @returns {string} trim sonrası boşsa boş string
 */
function toUpperTr(value) {
  if (value == null) {
    return '';
  }
  const s = String(value).trim();
  if (s === '') {
    return '';
  }
  return s.toLocaleUpperCase('tr-TR');
}

/**
 * Not / açıklama: boş veya sadece boşluk -> null
 * @param {unknown} value
 * @returns {string|null}
 */
function optionalNoteUpperTr(value) {
  if (value == null) {
    return null;
  }
  const s = String(value).trim();
  if (s === '') {
    return null;
  }
  return s.toLocaleUpperCase('tr-TR');
}

module.exports = { toUpperTr, optionalNoteUpperTr };
