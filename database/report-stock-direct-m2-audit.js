/**
 * Salt okunur: Stok girişlerinde doğrudan m² girişi (direct_m2_entry=1) ile kayıtlı
 * hareketleri listeler. Yeni stok girişi arayüzü birim fiyatı ürün birimine göre ister;
 * bu rapor eski / istisnai kayıtları gözden geçirmek içindir.
 *
 * Çalıştırma: node database/report-stock-direct-m2-audit.js
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [cols] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movements' AND COLUMN_NAME = 'direct_m2_entry'`
    );
    if (!Number(cols[0].c)) {
      // eslint-disable-next-line no-console
      console.log('[report] stock_movements.direct_m2_entry kolonu yok; rapor atlandı.');
      return;
    }
    const [cnt] = await conn.query(
      `SELECT COUNT(*) AS n FROM stock_movements WHERE movement_type = 'in' AND direct_m2_entry = 1`
    );
    const n = Number(cnt[0].n) || 0;
    // eslint-disable-next-line no-console
    console.log(`[report] Doğrudan m² ile girilmiş stok girişi sayısı: ${n}`);
    if (n === 0) {
      return;
    }
    const [rows] = await conn.query(
      `SELECT sm.id, sm.product_id, p.product_code, sm.qty AS qty_m2, sm.primary_qty, sm.primary_unit,
              sm.line_total_uzs, sm.created_at
       FROM stock_movements sm
       INNER JOIN products p ON p.id = sm.product_id
       WHERE sm.movement_type = 'in' AND sm.direct_m2_entry = 1
       ORDER BY sm.id DESC
       LIMIT 50`
    );
    // eslint-disable-next-line no-console
    console.table(rows);
    if (n > 50) {
      // eslint-disable-next-line no-console
      console.log(`(İlk 50 satır; toplam ${n})`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[report]', e);
  process.exit(1);
});
