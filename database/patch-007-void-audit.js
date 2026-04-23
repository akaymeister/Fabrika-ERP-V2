/**
 * Stok giriş iptal kaydı
 * node database/patch-007-void-audit.js
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
  if (!(await hasTable(conn, 'stock_in_void_audit'))) {
    await conn.query(`
      CREATE TABLE stock_in_void_audit (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        old_movement_id INT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NOT NULL,
        void_reason TEXT NOT NULL,
        voided_by INT UNSIGNED NOT NULL,
        kind ENUM('delete','replace') NOT NULL DEFAULT 'delete',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_void_mov (old_movement_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // eslint-disable-next-line no-console
    console.log('[patch-007] stock_in_void_audit oluşturuldu');
  } else {
    // eslint-disable-next-line no-console
    console.log('[patch-007] stock_in_void_audit zaten var, atlandı');
  }
  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[patch-007] Bitti.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-007]', e.message);
  process.exit(1);
});
