/**
 * Admin’de kayıtlı proje kodu öneki: A–Z, 0–9, tire; 2–16 karakter.
 * @param {unknown} raw
 * @returns {string} geçersizse boş string
 */
function normalizeProjectCodePrefix(raw) {
  if (raw == null) {
    return '';
  }
  const s = String(raw)
    .trim()
    .toLocaleUpperCase('en-US')
    .replace(/[^A-Z0-9\-]/g, '');
  if (s.length < 2 || s.length > 16) {
    return '';
  }
  if (s.startsWith('-') || s.endsWith('-') || s.includes('--')) {
    return '';
  }
  return s;
}

/**
 * @param {string} prefix
 * @param {number} year tam yıl (örn. 2026)
 * @param {number} sequence yıl içi sıra (1..n)
 */
function formatAutoProjectCode(prefix, year, sequence) {
  const yy = Number(year) % 100;
  const seq = Math.max(1, Math.floor(Number(sequence)) || 1);
  const seqStr = String(seq).padStart(3, '0');
  return `${prefix}-${String(yy).padStart(2, '0')}-${seqStr}`;
}

/**
 * Kısa ad + sıra + yıl: ör. AHKFC-VLM00126
 * {COMPANY}-{SHORT}{NNN}{YY}
 * @param {string} companyCode AHKFC
 * @param {string} shortCode VLM
 * @param {number} year
 * @param {number} sequence
 */
function formatProjectCodeWithShort(companyCode, shortCode, year, sequence) {
  const comp = String(companyCode || '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9]/g, '');
  const short = String(shortCode || '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9]/g, '');
  const yy = String(Number(year) % 100).padStart(2, '0');
  const seq = Math.max(1, Math.floor(Number(sequence)) || 1);
  const seqStr = String(seq).padStart(3, '0');
  if (!comp || !short) {
    return '';
  }
  return `${comp}-${short}${seqStr}${yy}`;
}

/**
 * Yeni kural: [Önek]-[KısaKod]-[YY][SSS] — ör. PRJ-MOB-26001 (yıl içi global sıra)
 * @param {string} prefix normalizeProjectCodePrefix sonrası veya PRJ
 * @param {string} shortCode normalizeProjectShort sonrası
 * @param {number} year tam yıl
 * @param {number} sequence 1..n global (yıl bazında)
 */
function formatProjectCodeGlobalSeq(prefix, shortCode, year, sequence) {
  const p = normalizeProjectCodePrefix(prefix) || 'PRJ';
  const short = normalizeProjectShort(shortCode);
  const yy = String(Number(year) % 100).padStart(2, '0');
  const seq = Math.max(1, Math.floor(Number(sequence)) || 1);
  const tail = `${yy}${String(seq).padStart(3, '0')}`;
  if (!short) {
    return '';
  }
  return `${p}-${short}-${tail}`;
}

/**
 * 2–8 karakter, a–z, 0–9
 * @param {unknown} raw
 * @returns {string} geçersizse boş
 */
function normalizeProjectShort(raw) {
  if (raw == null) {
    return '';
  }
  const s = String(raw)
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9]/g, '');
  if (s.length < 2 || s.length > 8) {
    return '';
  }
  return s;
}

module.exports = {
  normalizeProjectCodePrefix,
  formatAutoProjectCode,
  formatProjectCodeWithShort,
  formatProjectCodeGlobalSeq,
  normalizeProjectShort,
};
