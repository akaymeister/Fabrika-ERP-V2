/**
 * STK-00001 formatı (5 hane, sıfırla doldurulur).
 */
function formatProductCode(n) {
  return `STK-${String(n).padStart(5, '0')}`;
}

/**
 * Sıradaki numara: mevcut STK- kodlarından türetir (eşzamanlı kayıt riski: unique hata yanıtında tekrar).
 */
async function nextProductCodeFromDb(pool) {
  const [rows] = await pool.query(
    `SELECT COALESCE(
       MAX(
         CAST(SUBSTRING_INDEX(product_code, '-', -1) AS UNSIGNED)
       ),
       0
     ) AS n
     FROM products
     WHERE product_code REGEXP ?`,
    ['^STK-[0-9]{1,6}$']
  );
  const n = Number(rows[0]?.n) || 0;
  return formatProductCode(n + 1);
}

module.exports = { formatProductCode, nextProductCodeFromDb };
