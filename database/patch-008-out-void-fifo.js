/**
 * Çıkış hareketi: FIFO tüketim anlık görüntüsü + iptal denetim tablosu
 * node database/patch-008-out-void-fifo.js
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasColumn(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
  );
  return r[0].c > 0;
}

async function hasTable(conn, t) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [t]
  );
  return r[0].c > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  if (!(await hasColumn(conn, 'stock_movements', 'out_fifo_taken'))) {
    await conn.query(
      'ALTER TABLE stock_movements ADD COLUMN out_fifo_taken JSON NULL COMMENT \'FIFO m2: [{layerId,m2}]\' AFTER note'
    );
    // eslint-disable-next-line no-console
    console.log('[patch-008] stock_movements.out_fifo_taken eklendi');
  } else {
    // eslint-disable-next-line no-console
    console.log('[patch-008] out_fifo_taken zaten var, atlandı');
  }
  if (!(await hasTable(conn, 'stock_out_void_audit'))) {
    await conn.query(`
      CREATE TABLE stock_out_void_audit (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        old_movement_id BIGINT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NOT NULL,
        void_reason TEXT NOT NULL,
        voided_by INT UNSIGNED NOT NULL,
        kind ENUM('delete','replace') NOT NULL DEFAULT 'delete',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_void_out_mov (old_movement_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // eslint-disable-next-line no-console
    console.log('[patch-008] stock_out_void_audit oluşturuldu');
  } else {
    // eslint-disable-next-line no-console
    console.log('[patch-008] stock_out_void_audit zaten var, atlandı');
  }
  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[patch-008] Bitti.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-008]', e.message);
  process.exit(1);
});
